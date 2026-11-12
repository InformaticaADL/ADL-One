import sql from 'mssql';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';

// Documentos de Gestión de Calidad guardados (migrations/add_gc_documentos.sql):
// el PDF tal como salió, de qué formulario es, de qué módulo y equipo /
// muestreador, con qué datos se llenó, quién lo guardó y cuándo.
//   mae_gc_formulario  catálogo de formularios (código, nombre, área, módulo…)
//   mae_gc_documento   cada documento guardado

const TABLA = 'mae_gc_documento';
const error = (message, status = 400) => Object.assign(new Error(message), { status });

// Fichas de equipo → formulario de Gestión de Calidad.
export const FORMULARIOS_EQUIPO = {
    tecnica: { codigo: 'OI-FoGe-22', tipo_documento: 'FICHA_TECNICA' },
    historial: { codigo: 'OI-FoGe-24', tipo_documento: 'HISTORIAL' },
    entrega: { codigo: 'OI-FoGe-36', tipo_documento: 'ENTREGA' },
    recepcion: { codigo: 'OI-FoGe-42', tipo_documento: 'RECEPCION' },
};
const TIPO_POR_FORMULARIO = Object.fromEntries(Object.entries(FORMULARIOS_EQUIPO).map(([tipo, f]) => [f.codigo, tipo]));

// Mientras falten las tablas se vuelve a revisar (funciona apenas se ejecute
// la migración, sin reiniciar), pero el aviso sale una sola vez.
let tablasListas = false;
let avisado = false;
export const hayTablasGc = async (pool) => {
    if (tablasListas) return true;
    const r = await pool.request().query(`SELECT OBJECT_ID('${TABLA}', 'U') AS d, OBJECT_ID('mae_gc_formulario', 'U') AS f`);
    tablasListas = !!(r.recordset[0]?.d && r.recordset[0]?.f);
    if (!tablasListas && !avisado) {
        avisado = true;
        logger.warn('Faltan mae_gc_formulario / mae_gc_documento — ejecute migrations/add_gc_documentos.sql');
    }
    return tablasListas;
};
const exigirTablas = async (pool) => {
    if (!(await hayTablasGc(pool))) throw error('Falta ejecutar la migración add_gc_documentos.sql en la base de datos', 503);
};

// Los datos se guardan sin las imágenes de las firmas (ya van en el PDF).
const ES_FIRMA = (v) => typeof v === 'string' && v.startsWith('data:image');
const datosSinFirmas = (body) => JSON.stringify(body || {}, (k, v) => (ES_FIRMA(v) ? '[firma]' : v)).slice(0, 200_000);
const tieneFirmas = (body) => JSON.stringify(body || {}).includes('data:image') || !!body?.usar_mi_firma_entrega;

const gcDocumentosService = {
    /**
     * Guarda la ficha de un equipo. `tipo`: tecnica | historial | entrega | recepcion.
     * `equipo`: { id_equipo (null si se está creando), codigo, nombre, sede }.
     */
    async guardarFichaEquipo({ tipo, equipo = {}, anio = null, buffer, nombre, datos, usuario, firmas = [] }) {
        const form = FORMULARIOS_EQUIPO[tipo];
        if (!form) throw error('Tipo de ficha inválido');
        const pool = await getConnection();
        await exigirTablas(pool);
        const f = (await pool.request().input('cod', sql.VarChar(20), form.codigo)
            .query('SELECT area, modulo FROM mae_gc_formulario WHERE codigo_formulario = @cod')).recordset[0];
        if (!f) throw error(`El formulario ${form.codigo} no está en el catálogo de Gestión de Calidad`, 500);

        // El documento y sus firmas se guardan juntos (o ninguno).
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            const r = await new sql.Request(tx)
                .input('form', sql.VarChar(20), form.codigo)
                .input('area', sql.NVarChar(80), f.area)
                .input('modulo', sql.VarChar(20), f.modulo)
                .input('tipoDoc', sql.VarChar(30), form.tipo_documento)
                .input('ent', sql.Numeric(10, 0), equipo.id_equipo ? Number(equipo.id_equipo) : null)
                .input('codEnt', sql.VarChar(100), String(equipo.codigo || '').slice(0, 100) || null)
                .input('nomEnt', sql.NVarChar(200), String(equipo.nombre || '').slice(0, 200) || null)
                .input('sede', sql.VarChar(10), String(equipo.sede || '').slice(0, 10) || null)
                .input('anio', sql.Int, anio ? Number(anio) : null)
                .input('archivo', sql.NVarChar(200), String(nombre).slice(0, 200))
                .input('pdf', sql.VarBinary(sql.MAX), buffer)
                .input('tam', sql.Int, buffer?.length || null)
                .input('datos', sql.NVarChar(sql.MAX), datosSinFirmas(datos))
                .input('firmas', sql.Bit, firmas.length || tieneFirmas(datos) ? 1 : 0)
                .input('usu', sql.Numeric(10, 0), usuario?.id ? Number(usuario.id) : null)
                .input('nomUsu', sql.NVarChar(150), usuario?.name ? String(usuario.name).slice(0, 150) : null)
                .query(`INSERT INTO ${TABLA} (codigo_formulario, area, modulo, tipo_documento, entidad_tipo, id_entidad, codigo_entidad,
                            nombre_entidad, sede, anio, nombre_archivo, pdf, tamano_bytes, datos, con_firmas, id_usuario, nombre_usuario)
                        OUTPUT INSERTED.id_documento, INSERTED.fecha_creacion
                        VALUES (@form, @area, @modulo, @tipoDoc, 'EQUIPO', @ent, @codEnt,
                            @nomEnt, @sede, @anio, @archivo, @pdf, @tam, @datos, @firmas, @usu, @nomUsu)`);
            const idDocumento = r.recordset[0].id_documento;

            // Quién firmó, en qué calidad y con qué versión de su firma.
            for (const fm of firmas) {
                await new sql.Request(tx)
                    .input('doc', sql.Int, idDocumento)
                    .input('rol', sql.VarChar(20), fm.rol)
                    .input('tipo', sql.VarChar(15), fm.tipo_firmante || null)
                    .input('id', sql.Numeric(10, 0), fm.id_firmante ? Number(fm.id_firmante) : null)
                    .input('nombre', sql.NVarChar(150), fm.nombre_firmante ? String(fm.nombre_firmante).slice(0, 150) : null)
                    .input('cargo', sql.NVarChar(150), fm.cargo ? String(fm.cargo).slice(0, 150) : null)
                    .input('modo', sql.VarChar(15), fm.modo)
                    .input('idFirma', sql.Int, fm.id_firma ? Number(fm.id_firma) : null)
                    .query(`INSERT INTO mae_gc_documento_firma (id_documento, rol, tipo_firmante, id_firmante, nombre_firmante, cargo, modo, id_firma)
                            VALUES (@doc, @rol, @tipo, @id, @nombre, @cargo, @modo, @idFirma)`);
            }
            await tx.commit();
            return { id_ficha: idDocumento, fecha_creacion: r.recordset[0].fecha_creacion, nombre };
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },

    /** Fichas vigentes de un equipo (sin el PDF), las más nuevas primero. */
    async listarFichasEquipo(idEquipo, tipo = null) {
        const pool = await getConnection();
        if (!(await hayTablasGc(pool))) return { disponible: false, fichas: [] };
        const req = pool.request().input('eq', sql.Numeric(10, 0), Number(idEquipo));
        if (tipo && FORMULARIOS_EQUIPO[tipo]) req.input('form', sql.VarChar(20), FORMULARIOS_EQUIPO[tipo].codigo);
        const r = await req.query(`
            SELECT id_documento, codigo_formulario, anio, nombre_archivo, nombre_usuario, fecha_creacion, con_firmas
            FROM ${TABLA}
            WHERE modulo = 'EQUIPOS' AND entidad_tipo = 'EQUIPO' AND id_entidad = @eq AND estado = 'VIGENTE'
              ${tipo && FORMULARIOS_EQUIPO[tipo] ? 'AND codigo_formulario = @form' : ''}
            ORDER BY fecha_creacion DESC, id_documento DESC`);
        return {
            disponible: true,
            fichas: r.recordset.map((d) => ({
                id_ficha: d.id_documento,
                tipo: TIPO_POR_FORMULARIO[d.codigo_formulario] || null,
                formato: d.codigo_formulario,
                anio: d.anio,
                nombre_archivo: d.nombre_archivo,
                nombre_usuario: d.nombre_usuario,
                fecha_creacion: d.fecha_creacion,
                con_firmas: !!d.con_firmas,
            })),
        };
    },

    async pdf(idDocumento) {
        const id = Number(idDocumento);
        if (!Number.isInteger(id) || id <= 0) throw error('Documento inválido');
        const pool = await getConnection();
        await exigirTablas(pool);
        const r = await pool.request().input('id', sql.Int, id)
            .query(`SELECT nombre_archivo, pdf FROM ${TABLA} WHERE id_documento = @id`);
        const d = r.recordset[0];
        if (!d) throw error('Documento no encontrado', 404);
        return { buffer: d.pdf, nombre: d.nombre_archivo };
    },
};

export default gcDocumentosService;
