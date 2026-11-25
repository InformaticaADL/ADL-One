import sql from 'mssql';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import revisionDocumentalService from './revisionDocumental.service.js';
import { pdfAccionCorrectiva } from './calidad.pdf.js';

// G. Calidad → Calidad → Acción Correctiva (OI-FoGe-02). Se abre desde una NC de una auditoría interna (fase 3) o
// suelta, para cualquier otro origen (queja, apelación, auditoría externa, revisión de gerencia, autodetectada u otro).
// migrations/add_calidad_auditorias.sql: mae_gc_accion_correctiva.

const fallo = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const clip = (v, max) => (v === null || v === undefined || v === '' ? null : String(v).trim().slice(0, max));
const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const bitOrNull = (v) => (v === null || v === undefined ? null : v ? 1 : 0);
const ORIGENES = ['AUDITORIA_INTERNA', 'AUDITORIA_EXTERNA_2', 'AUDITORIA_EXTERNA_3', 'QUEJA', 'APELACION', 'REVISION_GERENCIA', 'AUTODETECTADA', 'OTRO'];
const MAX_SEGUIMIENTOS = 3;

let tablaLista = false;
const hayTabla = async (pool) => {
    if (tablaLista) return true;
    tablaLista = !!(await pool.request().query("SELECT OBJECT_ID('mae_gc_accion_correctiva', 'U') AS t")).recordset[0].t;
    return tablaLista;
};
const exigirTabla = async (pool) => {
    if (!(await hayTabla(pool))) throw fallo('Falta ejecutar la migración add_calidad_auditorias.sql en la base de ADL-One.', 503);
};

const siguienteFolio = async (pool) => {
    const r = await pool.request().query("SELECT COUNT(*) AS n FROM mae_gc_accion_correctiva WHERE folio IS NOT NULL AND folio LIKE 'AC-' + CAST(YEAR(GETDATE()) AS VARCHAR) + '-%'");
    return `AC-${new Date().getFullYear()}-${String(r.recordset[0].n + 1).padStart(2, '0')}`;
};

const parseSeguimientos = (raw) => { try { const v = raw ? JSON.parse(raw) : []; return Array.isArray(v) ? v : []; } catch { return []; } };

const view = (a) => ({
    ...a,
    fecha_deteccion: a.fecha_deteccion ? String(a.fecha_deteccion).slice(0, 10) : null,
    fecha_inicio: a.fecha_inicio ? String(a.fecha_inicio).slice(0, 10) : null,
    plazo: a.plazo ? String(a.plazo).slice(0, 10) : null,
    fecha_seguimiento: a.fecha_seguimiento ? String(a.fecha_seguimiento).slice(0, 10) : null,
    cierre_fecha: a.cierre_fecha ? String(a.cierre_fecha).slice(0, 10) : null,
    seguimientos: parseSeguimientos(a.seguimientos),
    procede_ac: a.procede_ac === null ? null : !!a.procede_ac,
    cumplimiento_plazo: a.cumplimiento_plazo === null ? null : !!a.cumplimiento_plazo,
    causa_eliminada: a.causa_eliminada === null ? null : !!a.causa_eliminada,
    se_levanta_nc: a.se_levanta_nc === null ? null : !!a.se_levanta_nc,
});

const cargar = async (pool, id) => {
    const a = (await pool.request().input('id', sql.Int, Number(id)).query('SELECT * FROM mae_gc_accion_correctiva WHERE id_accion = @id')).recordset[0];
    if (!a) throw fallo('Acción correctiva no encontrada', 404);
    return a;
};

const calidadAccionCorrectivaService = {
    async listar({ anio, estado, origen } = {}) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const req = pool.request();
        const where = [];
        if (Number.isFinite(parseInt(anio, 10))) { req.input('a', sql.Int, parseInt(anio, 10)); where.push('YEAR(fecha_creacion) = @a'); }
        if (['ABIERTA', 'CERRADA', 'ANULADA'].includes(estado)) { req.input('e', sql.VarChar(10), estado); where.push('estado = @e'); }
        if (ORIGENES.includes(origen)) { req.input('o', sql.VarChar(25), origen); where.push('origen = @o'); }
        const r = await req.query(`
            SELECT id_accion, folio, origen, estado, area, fecha_deteccion, plazo, responsable, requisito, id_auditoria
            FROM mae_gc_accion_correctiva ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
            ORDER BY CASE estado WHEN 'ABIERTA' THEN 0 ELSE 1 END, plazo, id_accion DESC`);
        const hoy = new Date().toISOString().slice(0, 10);
        return r.recordset.map((a) => ({ ...a, fecha_deteccion: a.fecha_deteccion ? String(a.fecha_deteccion).slice(0, 10) : null, plazo: a.plazo ? String(a.plazo).slice(0, 10) : null, vencida: a.estado === 'ABIERTA' && a.plazo && String(a.plazo).slice(0, 10) < hoy }));
    },

    async obtener(id) {
        const pool = await getConnection();
        await exigirTabla(pool);
        return view(await cargar(pool, id));
    },

    /** Abre una AC desde un hallazgo NC de una auditoría (fase 3): copia área/fecha/requisito/hallazgo y bloquea el hallazgo. */
    async abrirDesdeHallazgo(idHallazgo, usuario) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const hz = (await pool.request().input('id', sql.Int, Number(idHallazgo)).query('SELECT * FROM mae_gc_auditoria_hallazgo WHERE id_hallazgo = @id')).recordset[0];
        if (!hz) throw fallo('El hallazgo no existe.', 404);
        if (hz.resultado !== 'NC') throw fallo('Solo se abre acción correctiva a un hallazgo No Conforme.');
        if (hz.id_accion) throw fallo('Este hallazgo ya tiene una acción correctiva.', 409);
        const hoja = (await pool.request().input('id', sql.Int, hz.id_hoja).query('SELECT * FROM mae_gc_auditoria_hoja WHERE id_hoja = @id')).recordset[0];
        const auditoria = (await pool.request().input('id', sql.Int, hz.id_auditoria).query('SELECT folio FROM mae_gc_auditoria WHERE id_auditoria = @id')).recordset[0];
        const folio = await siguienteFolio(pool);
        const r = await pool.request()
            .input('folio', sql.VarChar(20), folio).input('origen', sql.VarChar(25), 'AUDITORIA_INTERNA')
            .input('aud', sql.Int, hz.id_auditoria).input('hz', sql.Int, hz.id_hallazgo)
            .input('area', sql.NVarChar(200), clip(hoja?.area, 200)).input('fd', sql.Date, hoja?.fecha || null)
            .input('detectado', sql.NVarChar(300), clip(hoja?.auditor ? `${hoja.auditor}, Auditor Interno` : null, 300))
            .input('req', sql.NVarChar(500), clip(hz.requisito, 500)).input('hallazgo', sql.NVarChar(sql.MAX), clip(hz.evidencia, 4000))
            .input('u', sql.Numeric(10, 0), usuario?.id || null).input('nombre', sql.NVarChar(150), clip(usuario?.name, 150))
            .query(`INSERT INTO mae_gc_accion_correctiva (folio, origen, id_auditoria, id_hallazgo, area, fecha_deteccion, fecha_inicio, detectado_por, requisito, hallazgo, id_usuario_crea, nombre_crea)
                    OUTPUT INSERTED.id_accion VALUES (@folio, @origen, @aud, @hz, @area, @fd, @fd, @detectado, @req, @hallazgo, @u, @nombre)`);
        const idAccion = r.recordset[0].id_accion;
        await pool.request().input('id', sql.Int, hz.id_hallazgo).input('ac', sql.Int, idAccion).query('UPDATE mae_gc_auditoria_hallazgo SET id_accion = @ac WHERE id_hallazgo = @id');
        logger.info(`[Acciones correctivas] ${usuario?.name || 'alguien'} abrió ${folio} desde la auditoría ${auditoria?.folio || hz.id_auditoria}.`);
        return { id_accion: idAccion, folio };
    },

    /** AC suelta: queja, apelación, auditoría externa, revisión de gerencia, autodetectada u otro. */
    async crear({ origen, origen_otro: origenOtro, area, fecha_deteccion: fechaDeteccion, detectado_por: detectadoPor, requisito } = {}, usuario) {
        const pool = await getConnection();
        await exigirTabla(pool);
        if (!ORIGENES.includes(origen)) throw fallo('Origen inválido.');
        const folio = await siguienteFolio(pool);
        const r = await pool.request()
            .input('folio', sql.VarChar(20), folio).input('origen', sql.VarChar(25), origen).input('otro', sql.NVarChar(150), clip(origenOtro, 150))
            .input('area', sql.NVarChar(200), clip(area, 200)).input('fd', sql.Date, esFecha(fechaDeteccion) ? fechaDeteccion : null)
            .input('detectado', sql.NVarChar(300), clip(detectadoPor, 300)).input('req', sql.NVarChar(500), clip(requisito, 500))
            .input('u', sql.Numeric(10, 0), usuario?.id || null).input('nombre', sql.NVarChar(150), clip(usuario?.name, 150))
            .query(`INSERT INTO mae_gc_accion_correctiva (folio, origen, origen_otro, area, fecha_deteccion, fecha_inicio, detectado_por, requisito, id_usuario_crea, nombre_crea)
                    OUTPUT INSERTED.id_accion VALUES (@folio, @origen, @otro, @area, @fd, @fd, @detectado, @req, @u, @nombre)`);
        return { id_accion: r.recordset[0].id_accion, folio };
    },

    /** Guarda todo el formulario (secciones I a IV); se puede llamar varias veces mientras sigue abierta. */
    async guardar(id, data, usuario) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const a = await cargar(pool, id);
        if (a.estado !== 'ABIERTA') throw fallo(`Esta acción correctiva está ${a.estado === 'CERRADA' ? 'cerrada' : 'anulada'}.`, 409);
        const seguimientos = (Array.isArray(data.seguimientos) ? data.seguimientos : [])
            .slice(0, MAX_SEGUIMIENTOS)
            .map((s) => ({ fecha: esFecha(s.fecha) ? s.fecha : null, cumplimiento: clip(s.cumplimiento, 50), responsable: clip(s.responsable, 150), observaciones: clip(s.observaciones, 500) }));
        await pool.request().input('id', sql.Int, a.id_accion)
            .input('area', sql.NVarChar(200), clip(data.area, 200))
            .input('fd', sql.Date, esFecha(data.fecha_deteccion) ? data.fecha_deteccion : null)
            .input('fi', sql.Date, esFecha(data.fecha_inicio) ? data.fecha_inicio : null)
            .input('detectado', sql.NVarChar(300), clip(data.detectado_por, 300))
            .input('req', sql.NVarChar(500), clip(data.requisito, 500))
            .input('hallazgo', sql.NVarChar(sql.MAX), clip(data.hallazgo, 4000))
            .input('justificacion', sql.NVarChar(sql.MAX), clip(data.justificacion, 4000))
            .input('correccion', sql.NVarChar(sql.MAX), clip(data.correccion_inmediata, 4000))
            .input('procede', sql.Bit, bitOrNull(data.procede_ac))
            .input('participantes', sql.NVarChar(1000), clip(data.participantes, 1000))
            .input('tecnica', sql.NVarChar(200), clip(data.tecnica, 200))
            .input('alcance', sql.NVarChar(sql.MAX), clip(data.alcance, 4000))
            .input('accion', sql.NVarChar(sql.MAX), clip(data.accion_propuesta, 4000))
            .input('responsable', sql.NVarChar(150), clip(data.responsable, 150))
            .input('plazo', sql.Date, esFecha(data.plazo) ? data.plazo : null)
            .input('fs', sql.Date, esFecha(data.fecha_seguimiento) ? data.fecha_seguimiento : null)
            .input('cumple', sql.Bit, bitOrNull(data.cumplimiento_plazo))
            .input('obs', sql.NVarChar(sql.MAX), clip(data.observaciones, 4000))
            .input('segs', sql.NVarChar(sql.MAX), JSON.stringify(seguimientos))
            .input('eficacia', sql.NVarChar(sql.MAX), clip(data.eficacia, 4000))
            .input('causaElim', sql.Bit, bitOrNull(data.causa_eliminada))
            .input('levantaNc', sql.Bit, bitOrNull(data.se_levanta_nc))
            .input('obsFinales', sql.NVarChar(sql.MAX), clip(data.observaciones_finales, 4000))
            .query(`UPDATE mae_gc_accion_correctiva SET area = @area, fecha_deteccion = @fd, fecha_inicio = @fi, detectado_por = @detectado,
                    requisito = @req, hallazgo = @hallazgo, justificacion = @justificacion, correccion_inmediata = @correccion, procede_ac = @procede,
                    participantes = @participantes, tecnica = @tecnica, alcance = @alcance, accion_propuesta = @accion, responsable = @responsable,
                    plazo = @plazo, fecha_seguimiento = @fs, cumplimiento_plazo = @cumple, observaciones = @obs, seguimientos = @segs,
                    eficacia = @eficacia, causa_eliminada = @causaElim, se_levanta_nc = @levantaNc, observaciones_finales = @obsFinales,
                    fecha_modificacion = GETDATE() WHERE id_accion = @id`);
        logger.info(`[Acciones correctivas] ${usuario?.name || 'alguien'} guardó ${a.folio}.`);
        return { ok: true };
    },

    /** Cierra la AC (con el nombre y la fecha de quien cierra; la firma queda en el PDF). */
    async cerrar(id, { nombre, firma } = {}, usuario) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const a = await cargar(pool, id);
        if (a.estado !== 'ABIERTA') throw fallo('Esta acción correctiva ya no está abierta.', 409);
        await pool.request().input('id', sql.Int, a.id_accion)
            .input('nombre', sql.NVarChar(150), clip(nombre || usuario?.name, 150))
            .input('firma', sql.NVarChar(sql.MAX), firma || null)
            .query(`UPDATE mae_gc_accion_correctiva SET estado = 'CERRADA', cierre_nombre = @nombre, cierre_fecha = CONVERT(date, GETDATE()),
                    cierre_firma = @firma, fecha_modificacion = GETDATE() WHERE id_accion = @id`);
        logger.info(`[Acciones correctivas] ${usuario?.name || 'alguien'} cerró ${a.folio}.`);
        return { ok: true };
    },

    async anular(id, motivo, usuario) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const a = await cargar(pool, id);
        const m = clip(motivo, 300);
        if (!m || m.length < 3) throw fallo('Escriba el motivo de la anulación.');
        if (a.estado === 'CERRADA') throw fallo('Una acción correctiva cerrada no se puede anular.', 409);
        await pool.request().input('id', sql.Int, a.id_accion).input('motivo', sql.NVarChar(300), m)
            .query("UPDATE mae_gc_accion_correctiva SET estado = 'ANULADA', motivo_anulacion = @motivo, fecha_modificacion = GETDATE() WHERE id_accion = @id");
        if (a.id_hallazgo) await pool.request().input('id', sql.Int, a.id_hallazgo).query('UPDATE mae_gc_auditoria_hallazgo SET id_accion = NULL WHERE id_hallazgo = @id');
        logger.info(`[Acciones correctivas] ${usuario?.name || 'alguien'} anuló ${a.folio}: ${m}`);
        return { ok: true };
    },

    async pdf(id) {
        const a = view(await cargar(await getConnection(), id));
        const buffer = await pdfAccionCorrectiva({ encabezado: await revisionDocumentalService.encabezado('OI-FoGe-02'), ac: a });
        return { buffer, nombre: `OI-FoGe-02 Acción Correctiva ${a.folio || id}.pdf` };
    },
    async vistaPreviaPdf(id, body) {
        const actual = view(await cargar(await getConnection(), id));
        return pdfAccionCorrectiva({ encabezado: await revisionDocumentalService.encabezado('OI-FoGe-02'), ac: { ...actual, ...body } });
    },
};

export default calidadAccionCorrectivaService;
