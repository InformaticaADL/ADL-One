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
    caudal: { codigo: 'OI-FoGe-30', tipo_documento: 'VERIFICACION_CAUDAL' },
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
        // Año de vigencia de la ficha: el historial cubre el año que se pidió; las
        // demás (técnica, entrega, recepción) valen para el año en que se emiten,
        // así el archivo se consulta por año ("las fichas técnicas del 2026").
        const anioDoc = anio ? Number(anio) : new Date().getFullYear();
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
                .input('anio', sql.Int, anioDoc)
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
            SELECT id_documento, codigo_formulario, anio, nombre_archivo, nombre_usuario, fecha_creacion, con_firmas, codigo_entidad, sede
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
                // Código y sede del equipo cuando se emitió la ficha (cambian si el equipo cambió de sede).
                codigo_equipo: d.codigo_entidad || null,
                sede: d.sede || null,
            })),
        };
    },

    /**
     * Archivo de fichas de todos los equipos, para consultarlas por año
     * ("las fichas técnicas del 2025"). Filtros opcionales: tipo, año, sede,
     * estado (VIGENTE | ANULADO | TODOS) y texto (código o nombre del equipo,
     * quién la guardó). Sin el PDF; paginado.
     */
    async listarArchivo({ tipo = null, anio = null, sede = null, estado = 'VIGENTE', q = '', page = 1, limit = 50 } = {}) {
        const pool = await getConnection();
        if (!(await hayTablasGc(pool))) return { disponible: false, fichas: [], total: 0, page: 1, limit };
        const pg = Math.max(1, Number(page) || 1);
        const lim = Math.min(200, Math.max(1, Number(limit) || 50));
        const texto = String(q || '').trim();
        // Misma condición para la lista y el total: cada consulta liga sus propios parámetros.
        const cond = ["d.modulo = 'EQUIPOS'", "d.entidad_tipo = 'EQUIPO'"];
        const ligar = (req) => {
            if (tipo && FORMULARIOS_EQUIPO[tipo]) req.input('form', sql.VarChar(20), FORMULARIOS_EQUIPO[tipo].codigo);
            if (anio) req.input('anio', sql.Int, Number(anio));
            if (sede) req.input('sede', sql.VarChar(10), String(sede).slice(0, 10));
            if (estado === 'VIGENTE' || estado === 'ANULADO') req.input('est', sql.VarChar(15), estado);
            if (texto) req.input('q', sql.NVarChar(200), `%${texto.slice(0, 150)}%`);
            return req;
        };
        if (tipo && FORMULARIOS_EQUIPO[tipo]) cond.push('d.codigo_formulario = @form');
        if (anio) cond.push('d.anio = @anio');
        if (sede) cond.push('d.sede = @sede');
        if (estado === 'VIGENTE' || estado === 'ANULADO') cond.push('d.estado = @est');
        if (texto) cond.push('(d.codigo_entidad LIKE @q OR d.nombre_entidad LIKE @q OR d.nombre_usuario LIKE @q)');
        const where = `WHERE ${cond.join(' AND ')}`;
        const [lista, cuenta] = await Promise.all([
            ligar(pool.request()).input('off', sql.Int, (pg - 1) * lim).input('lim', sql.Int, lim).query(`
                SELECT d.id_documento, d.codigo_formulario, f.nombre AS nombre_formulario, d.id_entidad, d.codigo_entidad, d.nombre_entidad, d.sede,
                       d.anio, d.fecha_documento, d.nombre_archivo, d.tamano_bytes, d.con_firmas, d.estado, d.motivo_anulacion, d.fecha_anulacion,
                       d.nombre_usuario, d.fecha_creacion
                FROM ${TABLA} d
                LEFT JOIN mae_gc_formulario f ON f.codigo_formulario = d.codigo_formulario
                ${where}
                ORDER BY d.fecha_creacion DESC, d.id_documento DESC
                OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY`),
            ligar(pool.request()).query(`SELECT COUNT(*) AS n FROM ${TABLA} d ${where}`),
        ]);
        return {
            disponible: true,
            total: cuenta.recordset[0]?.n ?? 0,
            page: pg,
            limit: lim,
            fichas: lista.recordset.map((d) => ({
                id_ficha: d.id_documento,
                tipo: TIPO_POR_FORMULARIO[d.codigo_formulario] || null,
                formato: d.codigo_formulario,
                nombre_formulario: d.nombre_formulario,
                id_equipo: d.id_entidad,
                codigo_equipo: d.codigo_entidad,
                nombre_equipo: d.nombre_entidad,
                sede: d.sede,
                anio: d.anio,
                fecha_documento: d.fecha_documento,
                nombre_archivo: d.nombre_archivo,
                tamano_bytes: d.tamano_bytes,
                con_firmas: !!d.con_firmas,
                estado: d.estado,
                motivo_anulacion: d.motivo_anulacion,
                fecha_anulacion: d.fecha_anulacion,
                nombre_usuario: d.nombre_usuario,
                fecha_creacion: d.fecha_creacion,
            })),
        };
    },

    /** Años con fichas guardadas y cuántas vigentes hay de cada formulario (para los filtros del archivo). */
    async aniosArchivo() {
        const pool = await getConnection();
        if (!(await hayTablasGc(pool))) return { disponible: false, anios: [] };
        const r = await pool.request().query(`
            SELECT anio, codigo_formulario, COUNT(*) AS n
            FROM ${TABLA}
            WHERE modulo = 'EQUIPOS' AND entidad_tipo = 'EQUIPO' AND estado = 'VIGENTE' AND anio IS NOT NULL
            GROUP BY anio, codigo_formulario
            ORDER BY anio DESC`);
        const porAnio = new Map();
        for (const f of r.recordset) {
            if (!porAnio.has(f.anio)) porAnio.set(f.anio, { anio: f.anio, total: 0, por_tipo: {} });
            const a = porAnio.get(f.anio);
            a.total += f.n;
            a.por_tipo[TIPO_POR_FORMULARIO[f.codigo_formulario] || f.codigo_formulario] = f.n;
        }
        return { disponible: true, anios: [...porAnio.values()] };
    },

    /**
     * Documento vigente más reciente del mismo formulario para un equipo (y año,
     * en el historial). La pantalla avisa antes de guardar otro igual.
     */
    async vigenteIgual(tipo, idEquipo, anio = null) {
        const form = FORMULARIOS_EQUIPO[tipo];
        if (!form || !idEquipo) return null;
        const pool = await getConnection();
        if (!(await hayTablasGc(pool))) return null;
        const req = pool.request().input('eq', sql.Numeric(10, 0), Number(idEquipo)).input('form', sql.VarChar(20), form.codigo);
        if (anio) req.input('anio', sql.Int, Number(anio));
        const r = await req.query(`
            SELECT TOP 1 id_documento, anio, nombre_usuario, fecha_creacion
            FROM ${TABLA}
            WHERE modulo = 'EQUIPOS' AND entidad_tipo = 'EQUIPO' AND id_entidad = @eq
              AND codigo_formulario = @form AND estado = 'VIGENTE' ${anio ? 'AND anio = @anio' : ''}
            ORDER BY fecha_creacion DESC, id_documento DESC`);
        return r.recordset[0] || null;
    },

    /**
     * Anula un documento guardado (queda registrado como ANULADO, con motivo;
     * el PDF no se borra). Un documento guardado no se edita: se anula y se
     * guarda otro.
     */
    async anular(idDocumento, motivo, usuario = null) {
        const id = Number(idDocumento);
        if (!Number.isInteger(id) || id <= 0) throw error('Documento inválido');
        const m = String(motivo || '').trim();
        if (!m) throw error('Indique el motivo de la anulación');
        const pool = await getConnection();
        await exigirTablas(pool);
        const d = (await pool.request().input('id', sql.Int, id)
            .query(`SELECT estado, codigo_formulario, codigo_entidad FROM ${TABLA} WHERE id_documento = @id`)).recordset[0];
        if (!d) throw error('Documento no encontrado', 404);
        if (d.estado === 'ANULADO') throw error('El documento ya está anulado', 409);
        await pool.request()
            .input('id', sql.Int, id)
            .input('mot', sql.NVarChar(300), m.slice(0, 300))
            .input('usu', sql.Numeric(10, 0), usuario?.id ? Number(usuario.id) : null)
            .query(`UPDATE ${TABLA} SET estado = 'ANULADO', motivo_anulacion = @mot, fecha_anulacion = GETDATE(), id_usuario_anula = @usu
                    WHERE id_documento = @id AND estado = 'VIGENTE'`);
        logger.info(`Documento GC ${id} (${d.codigo_formulario} ${d.codigo_entidad || ''}) anulado: ${m.slice(0, 120)}`);
        return { success: true };
    },

    /**
     * PDF que se guardó en el archivo al firmar/aprobar un registro (ej. origen PUESTA_EN_MARCHA, clave
     * id_puesta_marcha = 12). Prefiere el vigente y el más reciente. null si no hay copia guardada.
     */
    async pdfDeOrigen(origen, clave, id) {
        if (!/^[a-z_]+$/.test(clave)) return null;
        const pool = await getConnection();
        if (!(await hayTablasGc(pool))) return null;
        const r = await pool.request()
            .input('o', sql.NVarChar(50), origen)
            .input('id', sql.NVarChar(20), String(id))
            .query(`SELECT TOP 1 nombre_archivo, pdf FROM ${TABLA}
                    WHERE CASE WHEN ISJSON(datos) = 1 THEN JSON_VALUE(datos, '$.origen') END = @o
                      AND CASE WHEN ISJSON(datos) = 1 THEN JSON_VALUE(datos, '$.${clave}') END = @id
                    ORDER BY CASE WHEN estado = 'VIGENTE' THEN 0 ELSE 1 END, id_documento DESC`);
        const d = r.recordset[0];
        return d?.pdf ? { buffer: d.pdf, nombre: d.nombre_archivo } : null;
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
