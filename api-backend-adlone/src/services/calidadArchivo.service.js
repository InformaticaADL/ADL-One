import sql from 'mssql';
import { getConnection } from '../config/database.js';
import { getConnectionAdlWeb } from '../config/databaseAdlWeb.js';
import logger from '../utils/logger.js';
import quejasService, { TIPOS, ESTADOS } from './quejasApelaciones.service.js';
import revisionDocumentalService from './revisionDocumental.service.js';
import { pdfListadoQa } from './calidad.pdf.js';

// Archivo en ADL-One de las quejas y apelaciones CERRADAS en ADLWeb (migrations/add_calidad_auditorias.sql) y el
// Listado de Quejas y Apelaciones (OI-FoGe-06).
//
// sincronizar(): lo llama el scheduler cada 15 minutos. Copia cada caso cerrado (cerrada / no procede) que no esté en
// el archivo o que haya cambiado en ADLWeb desde la última copia (si se reabrió y se volvió a cerrar). Guarda las
// columnas principales para buscar y el caso completo en JSON. No borra nada: un caso reabierto conserva su copia
// anterior hasta que se vuelva a cerrar. Nunca escribe en ADLWeb.

const fallo = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const CERRADOS = ['cerrada', 'no_procede'];
const TIPO_ARCHIVO = { queja: 'QUEJA', apelacion: 'APELACION' };
const ORIGEN_ARCHIVO = { interno: 'INTERNO', externo: 'EXTERNO' };
const clip = (v, max) => (v === null || v === undefined ? null : String(v).slice(0, max));
const fechaYmd = (v) => {
    if (!v) return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    return String(v).slice(0, 10);
};

let tablaLista = false;
const hayTabla = async (pool) => {
    if (tablaLista) return true;
    tablaLista = !!(await pool.request().query("SELECT OBJECT_ID('mae_gc_qa_archivo', 'U') AS t")).recordset[0].t;
    return tablaLista;
};
const exigirTabla = async (pool) => {
    if (!(await hayTabla(pool))) throw fallo('Falta ejecutar la migración add_calidad_auditorias.sql en la base de ADL-One.', 503);
};

let sincronizando = null;

const calidadArchivoService = {
    /** Copia al archivo los casos cerrados nuevos o cambiados. → { copiados, actualizados, revisados } */
    async sincronizar() {
        // Una sola a la vez (scheduler y botón «Sincronizar ahora»).
        if (sincronizando) return sincronizando;
        sincronizando = (async () => {
            const pool = await getConnection();
            if (!(await hayTabla(pool))) return { copiados: 0, actualizados: 0, revisados: 0, omitido: 'Falta la migración add_calidad_auditorias.sql' };
            const web = await getConnectionAdlWeb();
            const cerrados = (await web.request().query(`
                SELECT id, actualizado_en FROM dbo.quejas_apelaciones WHERE estado IN ('cerrada', 'no_procede')`)).recordset;
            const copias = new Map((await pool.request().query('SELECT id_caso_adlweb, actualizado_adlweb FROM mae_gc_qa_archivo')).recordset
                .map((x) => [Number(x.id_caso_adlweb), x.actualizado_adlweb]));
            let copiados = 0;
            let actualizados = 0;
            for (const c of cerrados) {
                const previa = copias.get(Number(c.id));
                const cambio = previa === undefined || (c.actualizado_en && (!previa || new Date(c.actualizado_en).getTime() > new Date(previa).getTime() + 1000));
                if (!cambio) continue;
                try {
                    const caso = await quejasService.obtener(c.id);
                    if (!CERRADOS.includes(caso.estado)) continue; // se reabrió entre la consulta y ahora
                    await this.guardarCopia(pool, caso, c.actualizado_en, previa !== undefined);
                    if (previa === undefined) copiados += 1; else actualizados += 1;
                } catch (e) {
                    logger.warn(`[Archivo quejas] No se pudo copiar el caso ${c.id}: ${e.message}`);
                }
            }
            if (copiados || actualizados) logger.info(`[Archivo quejas] ${copiados} caso(s) copiado(s), ${actualizados} actualizado(s).`);
            return { copiados, actualizados, revisados: cerrados.length };
        })();
        try { return await sincronizando; } finally { sincronizando = null; }
    },

    async guardarCopia(pool, caso, actualizadoAdlweb, existe) {
        const req = pool.request()
            .input('id', sql.Int, Number(caso.id))
            .input('tipo', sql.VarChar(10), TIPO_ARCHIVO[caso.tipo] || 'QUEJA')
            .input('folio', sql.NVarChar(50), clip(caso.folio, 50))
            .input('origen', sql.VarChar(10), ORIGEN_ARCHIVO[caso.origen] || null)
            .input('empresa', sql.NVarChar(150), clip(caso.empresa, 150))
            .input('nombre', sql.NVarChar(150), clip(caso.nombre, 150))
            .input('correo', sql.NVarChar(254), clip(caso.correo, 254))
            .input('fecha', sql.Date, caso.fecha_recepcion || null)
            .input('motivo', sql.NVarChar(sql.MAX), caso.motivo || null)
            .input('conclusiones', sql.NVarChar(sql.MAX), caso.conclusiones || null)
            .input('responsable', sql.NVarChar(150), clip(caso.responsable, 150))
            .input('estado', sql.VarChar(20), caso.estado)
            .input('procede', sql.Bit, caso.procede === null || caso.procede === undefined ? null : caso.procede ? 1 : 0)
            .input('cerrado', sql.DateTime, caso.cerrado_en ? new Date(caso.cerrado_en) : null)
            .input('act', sql.DateTime, actualizadoAdlweb ? new Date(actualizadoAdlweb) : null)
            .input('acciones', sql.Int, Array.isArray(caso.acciones) ? caso.acciones.length : 0)
            .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(caso));
        const cols = `tipo = @tipo, folio = @folio, origen = @origen, empresa = @empresa, nombre = @nombre, correo = @correo,
            fecha_recepcion = @fecha, motivo = @motivo, conclusiones = @conclusiones, responsable = @responsable, estado = @estado,
            procede = @procede, cerrado_en = @cerrado, actualizado_adlweb = @act, acciones = @acciones, datos = @datos`;
        if (existe) {
            await req.query(`UPDATE mae_gc_qa_archivo SET ${cols}, fecha_actualizacion = GETDATE() WHERE id_caso_adlweb = @id`);
        } else {
            await req.query(`
                INSERT INTO mae_gc_qa_archivo (id_caso_adlweb, tipo, folio, origen, empresa, nombre, correo, fecha_recepcion, motivo,
                    conclusiones, responsable, estado, procede, cerrado_en, actualizado_adlweb, acciones, datos)
                VALUES (@id, @tipo, @folio, @origen, @empresa, @nombre, @correo, @fecha, @motivo,
                    @conclusiones, @responsable, @estado, @procede, @cerrado, @act, @acciones, @datos)`);
        }
    },

    /** Casos archivados (sin el JSON completo). ?anio= ?tipo=queja|apelacion */
    async archivo(query = {}) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const req = pool.request();
        const where = [];
        const anio = parseInt(query.anio, 10);
        if (Number.isFinite(anio)) { req.input('anio', sql.Int, anio); where.push('YEAR(fecha_recepcion) = @anio'); }
        if (TIPO_ARCHIVO[query.tipo]) { req.input('tipo', sql.VarChar(10), TIPO_ARCHIVO[query.tipo]); where.push('tipo = @tipo'); }
        const r = await req.query(`
            SELECT id_archivo, id_caso_adlweb, tipo, folio, origen, empresa, nombre, CONVERT(VARCHAR(10), fecha_recepcion, 23) AS fecha_recepcion,
                   motivo, responsable, estado, procede, cerrado_en, acciones, fecha_copia, fecha_actualizacion
            FROM mae_gc_qa_archivo ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
            ORDER BY fecha_recepcion DESC, id_archivo DESC`);
        const ultima = (await pool.request().query('SELECT MAX(COALESCE(fecha_actualizacion, fecha_copia)) AS u FROM mae_gc_qa_archivo')).recordset[0]?.u || null;
        return { casos: r.recordset, ultima_copia: ultima };
    },

    /** Un caso archivado completo (como se copió desde ADLWeb). */
    async casoArchivado(idCaso) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const r = (await pool.request().input('id', sql.Int, Number(idCaso))
            .query('SELECT * FROM mae_gc_qa_archivo WHERE id_caso_adlweb = @id')).recordset[0];
        if (!r) throw fallo('El caso no está en el archivo de ADL-One.', 404);
        let datos = {};
        try { datos = JSON.parse(r.datos || '{}'); } catch { datos = {}; }
        return { ...r, datos };
    },

    /**
     * Filas del Listado OI-FoGe-06. Toma los casos de ADLWeb (todos los recibidos, con su estado); si ADLWeb no responde,
     * los del archivo de ADL-One (solo cerrados). ?anio= ?tipo=queja|apelacion ?estado=todos|cerrados|abiertos
     */
    async listado(query = {}) {
        const anio = parseInt(query.anio, 10);
        const tipo = TIPOS[query.tipo] ? query.tipo : null;
        const estado = ['cerrados', 'abiertos'].includes(query.estado) ? query.estado : 'todos';
        let fuente = 'adlweb';
        let filas;
        try {
            filas = (await quejasService.listar({ ...(Number.isFinite(anio) ? { anio } : {}), ...(tipo ? { tipo } : {}) })).map((c) => ({
                id: c.id, folio: c.folio, tipo: c.tipo, origen: c.origen, empresa: c.empresa, nombre: c.nombre, motivo: c.motivo,
                fecha_recepcion: fechaYmd(c.fecha_recepcion), estado: c.estado, estadoLabel: c.estadoLabel, cerrado: !!c.cerrado,
            }));
        } catch (e) {
            logger.warn(`[Listado quejas] ADLWeb no respondió, se usa el archivo de ADL-One: ${e.message}`);
            fuente = 'archivo';
            const { casos } = await this.archivo({ anio: query.anio, tipo });
            filas = casos.map((c) => ({
                id: c.id_caso_adlweb, folio: c.folio, tipo: c.tipo === 'APELACION' ? 'apelacion' : 'queja', origen: (c.origen || '').toLowerCase(),
                empresa: c.empresa, nombre: c.nombre, motivo: c.motivo, fecha_recepcion: c.fecha_recepcion,
                estado: c.estado, estadoLabel: ESTADOS[c.estado] || c.estado, cerrado: true,
            }));
        }
        if (estado === 'cerrados') filas = filas.filter((f) => f.cerrado);
        if (estado === 'abiertos') filas = filas.filter((f) => !f.cerrado);
        // En el formulario van de la más antigua a la más reciente.
        filas.sort((a, b) => String(a.fecha_recepcion || '').localeCompare(String(b.fecha_recepcion || '')) || String(a.folio || '').localeCompare(String(b.folio || '')));
        // Cuáles ya están copiados en ADL-One.
        try {
            const pool = await getConnection();
            if (await hayTabla(pool)) {
                const ids = new Set((await pool.request().query('SELECT id_caso_adlweb FROM mae_gc_qa_archivo')).recordset.map((x) => Number(x.id_caso_adlweb)));
                filas = filas.map((f) => ({ ...f, archivado: ids.has(Number(f.id)) }));
            }
        } catch { /* sin marca de archivado */ }
        return { fuente, filas };
    },

    /** PDF del Listado OI-FoGe-06 con los mismos filtros. `excluir`: ids de casos que no van en el listado. */
    async listadoPdf(query = {}) {
        const { filas } = await this.listado(query);
        const excluir = new Set(String(query.excluir || '').split(',').map(Number).filter(Boolean));
        const anio = parseInt(query.anio, 10);
        const partes = [
            Number.isFinite(anio) ? `Año ${anio}` : 'Todos los años',
            query.tipo === 'queja' ? 'Solo quejas' : query.tipo === 'apelacion' ? 'Solo apelaciones' : null,
            query.estado === 'cerrados' ? 'Solo cerradas' : query.estado === 'abiertos' ? 'Solo en curso' : null,
        ].filter(Boolean);
        const buffer = await pdfListadoQa({
            encabezado: await revisionDocumentalService.encabezado('OI-FoGe-06'),
            anio: Number.isFinite(anio) ? anio : null,
            filtro: partes.join(' · '),
            filas: filas.filter((f) => !excluir.has(Number(f.id))).map((f) => ({ ...f, estadoLabel: query.conEstado === '1' ? f.estadoLabel : null })),
        });
        return { buffer, nombre: `OI-FoGe-06 Listado de Quejas y Apelaciones${Number.isFinite(anio) ? ` ${anio}` : ''}.pdf` };
    },
};

export default calidadArchivoService;
