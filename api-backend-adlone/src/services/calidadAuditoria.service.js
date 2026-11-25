import sql from 'mssql';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import revisionDocumentalService from './revisionDocumental.service.js';
import { pdfPlan, pdfReunion, pdfHallazgos, pdfInforme } from './calidad.pdf.js';

// G. Calidad → Calidad → Auditoría interna: Plan (OI-FoGe-08), Reunión Inicial y Final (OI-FoGe-10) y Hallazgos
// (OI-FoGe-09). Se crea desde un mes marcado del Programa Anual (o suelta, sin programa) y se va llenando en cadena:
// Plan → Reunión → Hallazgos → (fase siguiente) Informe y Acciones Correctivas.
//
// migrations/add_calidad_auditorias.sql: mae_gc_auditoria, _agenda, _asistente, _hoja, _hallazgo.

const fallo = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const clip = (v, max) => (v === null || v === undefined || v === '' ? null : String(v).trim().slice(0, max));
const esFecha = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

let tablaLista = false;
const hayTabla = async (pool) => {
    if (tablaLista) return true;
    tablaLista = !!(await pool.request().query("SELECT OBJECT_ID('mae_gc_auditoria', 'U') AS t")).recordset[0].t;
    return tablaLista;
};
const exigirTabla = async (pool) => {
    if (!(await hayTabla(pool))) throw fallo('Falta ejecutar la migración add_calidad_auditorias.sql en la base de ADL-One.', 503);
};

const siguienteFolio = async (pool, anio) => {
    const r = await pool.request().input('anio', sql.Int, anio)
        .query("SELECT COUNT(*) AS n FROM mae_gc_auditoria WHERE anio = @anio AND folio IS NOT NULL");
    return `AI-${anio}-${String(r.recordset[0].n + 1).padStart(2, '0')}`;
};

const cargarAuditoria = async (pool, id) => {
    const a = (await pool.request().input('id', sql.Int, Number(id)).query('SELECT * FROM mae_gc_auditoria WHERE id_auditoria = @id')).recordset[0];
    if (!a) throw fallo('Auditoría no encontrada', 404);
    return a;
};

const calidadAuditoriaService = {
    /** Auditorías de un año (o todas). */
    async listar({ anio } = {}) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const req = pool.request();
        let where = '';
        if (Number.isFinite(parseInt(anio, 10))) { req.input('a', sql.Int, parseInt(anio, 10)); where = 'WHERE anio = @a'; }
        const r = await req.query(`
            SELECT id_auditoria, folio, anio, mes, estado, fecha, auditor_lider,
                   (SELECT COUNT(*) FROM mae_gc_auditoria_hallazgo h WHERE h.id_auditoria = a.id_auditoria AND h.resultado = 'NC') AS no_conformidades,
                   (SELECT COUNT(*) FROM mae_gc_auditoria_hallazgo h WHERE h.id_auditoria = a.id_auditoria AND h.resultado = 'OBS') AS observaciones
            FROM mae_gc_auditoria a ${where} ORDER BY anio DESC, ISNULL(mes, 0) DESC, id_auditoria DESC`);
        return r.recordset;
    },

    /** Crea una auditoría desde un mes marcado del Programa Anual (fase 2). El item queda tomado (no se puede desmarcar). */
    async crearDesdeItem(idItem, usuario) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const item = (await pool.request().input('id', sql.Int, Number(idItem)).query('SELECT * FROM mae_gc_programa_item WHERE id_item = @id')).recordset[0];
        if (!item) throw fallo('El mes del programa no existe.', 404);
        if (item.id_auditoria) throw fallo('Este mes ya tiene una auditoría creada.', 409);
        const prog = (await pool.request().input('id', sql.Int, item.id_programa).query('SELECT anio FROM mae_gc_programa_auditoria WHERE id_programa = @id')).recordset[0];
        const anio = prog?.anio;
        const folio = await siguienteFolio(pool, anio);
        const r = await pool.request()
            .input('folio', sql.VarChar(20), folio).input('anio', sql.Int, anio).input('mes', sql.TinyInt, item.mes)
            .input('prog', sql.Int, item.id_programa)
            .input('u', sql.Numeric(10, 0), usuario?.id || null).input('nombre', sql.NVarChar(150), clip(usuario?.name, 150))
            .query(`INSERT INTO mae_gc_auditoria (folio, anio, mes, id_programa, id_usuario_crea, nombre_crea)
                    OUTPUT INSERTED.id_auditoria VALUES (@folio, @anio, @mes, @prog, @u, @nombre)`);
        const idAuditoria = r.recordset[0].id_auditoria;
        await pool.request().input('id', sql.Int, idItem).input('aud', sql.Int, idAuditoria)
            .query('UPDATE mae_gc_programa_item SET id_auditoria = @aud WHERE id_item = @id');
        // Agenda inicial con el elemento que originó la auditoría (se puede ampliar en el plan).
        await pool.request().input('aud', sql.Int, idAuditoria).input('criterio', sql.NVarChar(500), `${item.referencia ? `${item.referencia} ` : ''}${item.elemento}`)
            .query("INSERT INTO mae_gc_auditoria_agenda (id_auditoria, orden, criterio) VALUES (@aud, 1, @criterio)");
        logger.info(`[Auditorías] ${usuario?.name || 'alguien'} creó la auditoría ${folio} desde el programa.`);
        return { id_auditoria: idAuditoria, folio };
    },

    /** Auditoría suelta, sin un mes del programa. */
    async crear({ anio, mes } = {}, usuario) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const a = Number(anio) || new Date().getFullYear();
        const folio = await siguienteFolio(pool, a);
        const r = await pool.request()
            .input('folio', sql.VarChar(20), folio).input('anio', sql.Int, a).input('mes', sql.TinyInt, mes || null)
            .input('u', sql.Numeric(10, 0), usuario?.id || null).input('nombre', sql.NVarChar(150), clip(usuario?.name, 150))
            .query(`INSERT INTO mae_gc_auditoria (folio, anio, mes, id_usuario_crea, nombre_crea)
                    OUTPUT INSERTED.id_auditoria VALUES (@folio, @anio, @mes, @u, @nombre)`);
        return { id_auditoria: r.recordset[0].id_auditoria, folio };
    },

    /** Detalle completo: auditoría + agenda + asistentes (por reunión) + hojas con sus hallazgos. */
    async obtener(id) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const a = await cargarAuditoria(pool, id);
        const agenda = (await pool.request().input('id', sql.Int, a.id_auditoria).query('SELECT * FROM mae_gc_auditoria_agenda WHERE id_auditoria = @id ORDER BY orden')).recordset;
        const asistentes = (await pool.request().input('id', sql.Int, a.id_auditoria).query('SELECT * FROM mae_gc_auditoria_asistente WHERE id_auditoria = @id ORDER BY reunion, orden')).recordset;
        const hojas = (await pool.request().input('id', sql.Int, a.id_auditoria).query('SELECT * FROM mae_gc_auditoria_hoja WHERE id_auditoria = @id ORDER BY orden')).recordset;
        const hallazgos = hojas.length
            ? (await pool.request().query(`SELECT * FROM mae_gc_auditoria_hallazgo WHERE id_hoja IN (${hojas.map((h) => h.id_hoja).join(',')}) ORDER BY orden`)).recordset
            : [];
        return {
            ...a,
            fecha: a.fecha ? String(a.fecha).slice(0, 10) : null,
            fecha_reunion_inicial: a.fecha_reunion_inicial ? String(a.fecha_reunion_inicial).slice(0, 10) : null,
            fecha_reunion_final: a.fecha_reunion_final ? String(a.fecha_reunion_final).slice(0, 10) : null,
            agenda,
            asistentes_inicial: asistentes.filter((x) => x.reunion === 'INICIAL'),
            asistentes_final: asistentes.filter((x) => x.reunion === 'FINAL'),
            hojas: hojas.map((h) => ({ ...h, fecha: h.fecha ? String(h.fecha).slice(0, 10) : null, hallazgos: hallazgos.filter((x) => x.id_hoja === h.id_hoja) })),
        };
    },

    // ── Plan (OI-FoGe-08) ──
    async guardarPlan(id, { fecha, objetivos, alcance, auditor_lider: auditorLider, agenda = [] }, usuario) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const a = await cargarAuditoria(pool, id);
        if (a.estado === 'ANULADA') throw fallo('Esta auditoría está anulada.', 409);
        await pool.request().input('id', sql.Int, a.id_auditoria)
            .input('fecha', sql.Date, esFecha(fecha) ? fecha : null)
            .input('obj', sql.NVarChar(2000), clip(objetivos, 2000))
            .input('alc', sql.NVarChar(2000), clip(alcance, 2000))
            .input('lider', sql.NVarChar(150), clip(auditorLider, 150))
            .query(`UPDATE mae_gc_auditoria SET fecha = @fecha, objetivos = @obj, alcance = @alc, auditor_lider = @lider,
                    estado = CASE WHEN estado = 'PLANIFICADA' THEN 'EN_CURSO' ELSE estado END, fecha_modificacion = GETDATE()
                    WHERE id_auditoria = @id`);
        // Agenda: se reemplaza completa (sin registros dependientes críticos; las hojas guardan su propia copia de área/auditor).
        await pool.request().input('id', sql.Int, a.id_auditoria).query('DELETE FROM mae_gc_auditoria_agenda WHERE id_auditoria = @id');
        let orden = 1;
        for (const f of Array.isArray(agenda) ? agenda : []) {
            await pool.request()
                .input('aud', sql.Int, a.id_auditoria).input('orden', sql.Int, orden++)
                .input('horario', sql.NVarChar(50), clip(f.horario, 50)).input('area', sql.NVarChar(200), clip(f.area, 200))
                .input('criterio', sql.NVarChar(500), clip(f.criterio, 500)).input('auditor', sql.NVarChar(150), clip(f.auditor, 150))
                .input('obs', sql.NVarChar(1000), clip(f.observacion, 1000))
                .query(`INSERT INTO mae_gc_auditoria_agenda (id_auditoria, orden, horario, area, criterio, auditor, observacion)
                        VALUES (@aud, @orden, @horario, @area, @criterio, @auditor, @obs)`);
        }
        logger.info(`[Auditorías] ${usuario?.name || 'alguien'} guardó el plan de ${a.folio}.`);
        return { ok: true };
    },

    // ── Reunión Inicial y Final (OI-FoGe-10) ──
    async guardarReunion(id, reunion, { fecha, asistentes = [] }, usuario) {
        if (!['INICIAL', 'FINAL'].includes(reunion)) throw fallo('Tipo de reunión inválido.');
        const pool = await getConnection();
        await exigirTabla(pool);
        const a = await cargarAuditoria(pool, id);
        if (a.estado === 'ANULADA') throw fallo('Esta auditoría está anulada.', 409);
        const campoFecha = reunion === 'INICIAL' ? 'fecha_reunion_inicial' : 'fecha_reunion_final';
        await pool.request().input('id', sql.Int, a.id_auditoria).input('fecha', sql.Date, esFecha(fecha) ? fecha : null)
            .query(`UPDATE mae_gc_auditoria SET ${campoFecha} = @fecha, fecha_modificacion = GETDATE() WHERE id_auditoria = @id`);
        // Se conservan las firmas ya puestas de quien sigue en la lista (por nombre); las nuevas quedan sin firmar.
        const previos = (await pool.request().input('id', sql.Int, a.id_auditoria).input('r', sql.VarChar(10), reunion)
            .query('SELECT * FROM mae_gc_auditoria_asistente WHERE id_auditoria = @id AND reunion = @r')).recordset;
        await pool.request().input('id', sql.Int, a.id_auditoria).input('r', sql.VarChar(10), reunion)
            .query('DELETE FROM mae_gc_auditoria_asistente WHERE id_auditoria = @id AND reunion = @r');
        let orden = 1;
        for (const p of Array.isArray(asistentes) ? asistentes : []) {
            const nombre = clip(p.nombre, 150);
            if (!nombre) continue;
            const previo = previos.find((x) => x.nombre.trim().toLowerCase() === nombre.trim().toLowerCase());
            const firma = p.firma !== undefined ? p.firma : previo?.firma || null;
            const fechaFirma = p.firma !== undefined ? (p.firma ? new Date() : null) : previo?.fecha_firma || null;
            await pool.request()
                .input('aud', sql.Int, a.id_auditoria).input('r', sql.VarChar(10), reunion).input('orden', sql.Int, orden++)
                .input('nombre', sql.NVarChar(150), nombre).input('cargo', sql.NVarChar(150), clip(p.cargo, 150))
                .input('firma', sql.NVarChar(sql.MAX), firma).input('ff', sql.DateTime, fechaFirma)
                .query(`INSERT INTO mae_gc_auditoria_asistente (id_auditoria, reunion, orden, nombre, cargo, firma, fecha_firma)
                        VALUES (@aud, @r, @orden, @nombre, @cargo, @firma, @ff)`);
        }
        logger.info(`[Auditorías] ${usuario?.name || 'alguien'} guardó la reunión ${reunion.toLowerCase()} de ${a.folio}.`);
        return { ok: true };
    },

    // ── Hallazgos (OI-FoGe-09) ──
    /**
     * `hojas`: [{ id_hoja?, area, auditor, fecha, observaciones_oportunidades,
     *             hallazgos: [{ id_hallazgo?, requisito, que_verificar, evidencia, resultado, observaciones }] }]
     * Un hallazgo con `id_accion` (acción correctiva ya abierta) no se puede eliminar ni cambiar de resultado: se
     * devuelve en `bloqueados` y se conserva tal cual.
     */
    async guardarHojas(id, { hojas = [] } = {}, usuario) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const a = await cargarAuditoria(pool, id);
        if (a.estado === 'ANULADA') throw fallo('Esta auditoría está anulada.', 409);
        const hojasActuales = (await pool.request().input('id', sql.Int, a.id_auditoria).query('SELECT * FROM mae_gc_auditoria_hoja WHERE id_auditoria = @id')).recordset;
        const hallazgosActuales = hojasActuales.length
            ? (await pool.request().query(`SELECT * FROM mae_gc_auditoria_hallazgo WHERE id_hoja IN (${hojasActuales.map((h) => h.id_hoja).join(',')})`)).recordset
            : [];
        const bloqueados = [];
        const idsHojasEnviadas = new Set();
        let ordenHoja = 1;

        for (const hRaw of Array.isArray(hojas) ? hojas : []) {
            let idHoja = hRaw.id_hoja && hojasActuales.some((x) => x.id_hoja === hRaw.id_hoja) ? hRaw.id_hoja : null;
            if (idHoja) {
                await pool.request().input('id', sql.Int, idHoja).input('orden', sql.Int, ordenHoja)
                    .input('area', sql.NVarChar(200), clip(hRaw.area, 200)).input('auditor', sql.NVarChar(150), clip(hRaw.auditor, 150))
                    .input('fecha', sql.Date, esFecha(hRaw.fecha) ? hRaw.fecha : null)
                    .input('obs', sql.NVarChar(sql.MAX), clip(hRaw.observaciones_oportunidades, 4000))
                    .query('UPDATE mae_gc_auditoria_hoja SET orden = @orden, area = @area, auditor = @auditor, fecha = @fecha, observaciones_oportunidades = @obs WHERE id_hoja = @id');
            } else {
                const r = await pool.request().input('aud', sql.Int, a.id_auditoria).input('orden', sql.Int, ordenHoja)
                    .input('area', sql.NVarChar(200), clip(hRaw.area, 200)).input('auditor', sql.NVarChar(150), clip(hRaw.auditor, 150))
                    .input('fecha', sql.Date, esFecha(hRaw.fecha) ? hRaw.fecha : null)
                    .input('obs', sql.NVarChar(sql.MAX), clip(hRaw.observaciones_oportunidades, 4000))
                    .query(`INSERT INTO mae_gc_auditoria_hoja (id_auditoria, orden, area, auditor, fecha, observaciones_oportunidades)
                            OUTPUT INSERTED.id_hoja VALUES (@aud, @orden, @area, @auditor, @fecha, @obs)`);
                idHoja = r.recordset[0].id_hoja;
            }
            idsHojasEnviadas.add(idHoja);
            ordenHoja += 1;

            const existentesDeHoja = hallazgosActuales.filter((x) => x.id_hoja === idHoja);
            const idsEnviados = new Set();
            let ordenH = 1;
            for (const hz of Array.isArray(hRaw.hallazgos) ? hRaw.hallazgos : []) {
                const previo = hz.id_hallazgo ? existentesDeHoja.find((x) => x.id_hallazgo === hz.id_hallazgo) : null;
                if (previo?.id_accion && previo.resultado !== (hz.resultado || null)) {
                    bloqueados.push({ hoja: hRaw.area, requisito: previo.requisito });
                    // Se conserva tal cual (no se aplica el cambio de resultado).
                    idsEnviados.add(previo.id_hallazgo);
                    ordenH += 1;
                    continue;
                }
                if (previo) {
                    await pool.request().input('id', sql.Int, previo.id_hallazgo).input('orden', sql.Int, ordenH)
                        .input('req', sql.NVarChar(500), clip(hz.requisito, 500)).input('qv', sql.NVarChar(1000), clip(hz.que_verificar, 1000))
                        .input('ev', sql.NVarChar(sql.MAX), clip(hz.evidencia, 4000)).input('res', sql.VarChar(3), ['C', 'NC', 'OBS'].includes(hz.resultado) ? hz.resultado : null)
                        .input('obs', sql.NVarChar(1000), clip(hz.observaciones, 1000))
                        .query(`UPDATE mae_gc_auditoria_hallazgo SET orden = @orden, requisito = @req, que_verificar = @qv, evidencia = @ev,
                                resultado = @res, observaciones = @obs WHERE id_hallazgo = @id`);
                    idsEnviados.add(previo.id_hallazgo);
                } else {
                    const r = await pool.request().input('hoja', sql.Int, idHoja).input('aud', sql.Int, a.id_auditoria).input('orden', sql.Int, ordenH)
                        .input('req', sql.NVarChar(500), clip(hz.requisito, 500)).input('qv', sql.NVarChar(1000), clip(hz.que_verificar, 1000))
                        .input('ev', sql.NVarChar(sql.MAX), clip(hz.evidencia, 4000)).input('res', sql.VarChar(3), ['C', 'NC', 'OBS'].includes(hz.resultado) ? hz.resultado : null)
                        .input('obs', sql.NVarChar(1000), clip(hz.observaciones, 1000))
                        .query(`INSERT INTO mae_gc_auditoria_hallazgo (id_hoja, id_auditoria, orden, requisito, que_verificar, evidencia, resultado, observaciones)
                                OUTPUT INSERTED.id_hallazgo VALUES (@hoja, @aud, @orden, @req, @qv, @ev, @res, @obs)`);
                    idsEnviados.add(r.recordset[0].id_hallazgo);
                }
                ordenH += 1;
            }
            // Elimina los hallazgos de esta hoja que ya no vienen, salvo los con acción correctiva (se conservan).
            for (const ex of existentesDeHoja) {
                if (idsEnviados.has(ex.id_hallazgo)) continue;
                if (ex.id_accion) { bloqueados.push({ hoja: hRaw.area, requisito: ex.requisito }); continue; }
                await pool.request().input('id', sql.Int, ex.id_hallazgo).query('DELETE FROM mae_gc_auditoria_hallazgo WHERE id_hallazgo = @id');
            }
        }
        // Elimina las hojas que ya no vienen (y sus hallazgos, si no tienen acción correctiva).
        for (const h of hojasActuales) {
            if (idsHojasEnviadas.has(h.id_hoja)) continue;
            const conAccion = hallazgosActuales.some((x) => x.id_hoja === h.id_hoja && x.id_accion);
            if (conAccion) { bloqueados.push({ hoja: h.area, requisito: '(hoja completa: tiene hallazgos con acción correctiva)' }); continue; }
            await pool.request().input('id', sql.Int, h.id_hoja).query('DELETE FROM mae_gc_auditoria_hallazgo WHERE id_hoja = @id; DELETE FROM mae_gc_auditoria_hoja WHERE id_hoja = @id');
        }
        logger.info(`[Auditorías] ${usuario?.name || 'alguien'} guardó los hallazgos de ${a.folio}.`);
        return { ok: true, bloqueados };
    },

    // ── Informe (OI-FoGe-11): se arma con los anexos de NC y OBS que salen solos de los hallazgos. ──
    async guardarInforme(id, data, usuario) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const a = await cargarAuditoria(pool, id);
        if (a.estado === 'ANULADA') throw fallo('Esta auditoría está anulada.', 409);
        await pool.request().input('id', sql.Int, a.id_auditoria)
            .input('rep', sql.NVarChar(300), clip(data.representante_auditado, 300))
            .input('docs', sql.NVarChar(2000), clip(data.documentos_referencia, 2000))
            .input('entrev', sql.NVarChar(2000), clip(data.entrevistados, 2000))
            .input('desc', sql.NVarChar(sql.MAX), clip(data.descripcion_hallazgos, 4000))
            .input('juicio', sql.NVarChar(sql.MAX), clip(data.juicio_auditor, 4000))
            .input('cap', sql.NVarChar(sql.MAX), clip(data.capacidad_sistema, 4000))
            .input('oport', sql.NVarChar(sql.MAX), clip(data.oportunidades, 4000))
            .input('dist', sql.NVarChar(1000), clip(data.distribucion, 1000))
            .input('fi', sql.Date, esFecha(data.fecha_informe) ? data.fecha_informe : null)
            .input('firma', sql.NVarChar(sql.MAX), data.firma_auditor_lider || null)
            .query(`UPDATE mae_gc_auditoria SET representante_auditado = @rep, documentos_referencia = @docs, entrevistados = @entrev,
                    descripcion_hallazgos = @desc, juicio_auditor = @juicio, capacidad_sistema = @cap, oportunidades = @oport,
                    distribucion = @dist, fecha_informe = @fi, firma_auditor_lider = @firma,
                    estado = CASE WHEN @fi IS NOT NULL THEN 'CERRADA' ELSE estado END, fecha_modificacion = GETDATE() WHERE id_auditoria = @id`);
        logger.info(`[Auditorías] ${usuario?.name || 'alguien'} guardó el informe de ${a.folio}.`);
        return { ok: true };
    },

    /** Anexos del informe: las NC y las OBS de todos los hallazgos, numeradas en orden. */
    async anexosInforme(id) {
        const d = await this.obtener(id);
        const todos = d.hojas.flatMap((h) => h.hallazgos.map((hz) => ({ ...hz, area: h.area, auditor: h.auditor })));
        let n = 0;
        const noConformidades = todos.filter((h) => h.resultado === 'NC').map((h) => ({ numero: ++n, area: h.area, descripcion: h.evidencia || h.observaciones, referencia: h.requisito, auditor: h.auditor }));
        n = 0;
        const observacionesAuditoria = todos.filter((h) => h.resultado === 'OBS').map((h) => ({ numero: ++n, area: h.area, descripcion: h.evidencia || h.observaciones, auditor: h.auditor }));
        return { noConformidades, observacionesAuditoria };
    },

    async pdfInforme(id) {
        const d = await this.obtener(id);
        const anexos = await this.anexosInforme(id);
        const buffer = await pdfInforme({ encabezado: await revisionDocumentalService.encabezado('OI-FoGe-11'), auditoria: d, ...anexos });
        return { buffer, nombre: `OI-FoGe-11 Informe de Auditoría ${d.folio || id}.pdf` };
    },
    async vistaPreviaInforme(id, body) {
        const d = await this.obtener(id);
        const anexos = await this.anexosInforme(id);
        return pdfInforme({ encabezado: await revisionDocumentalService.encabezado('OI-FoGe-11'), auditoria: { ...d, ...body }, ...anexos });
    },

    /** Anula la auditoría y libera el mes del programa (si venía de uno) para poder reprogramarlo. */
    async anular(id, motivo, usuario) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const a = await cargarAuditoria(pool, id);
        const m = clip(motivo, 300);
        if (!m || m.length < 3) throw fallo('Escriba el motivo de la anulación.');
        await pool.request().input('id', sql.Int, a.id_auditoria).input('motivo', sql.NVarChar(300), m)
            .query("UPDATE mae_gc_auditoria SET estado = 'ANULADA', motivo_anulacion = @motivo, fecha_modificacion = GETDATE() WHERE id_auditoria = @id");
        await pool.request().input('aud', sql.Int, a.id_auditoria).query('UPDATE mae_gc_programa_item SET id_auditoria = NULL WHERE id_auditoria = @aud');
        logger.info(`[Auditorías] ${usuario?.name || 'alguien'} anuló la auditoría ${a.folio}: ${m}`);
        return { ok: true };
    },

    // ── PDF ──
    async pdfPlan(id) {
        const d = await this.obtener(id);
        const buffer = await pdfPlan({ encabezado: await revisionDocumentalService.encabezado('OI-FoGe-08'), auditoria: d, agenda: d.agenda });
        return { buffer, nombre: `OI-FoGe-08 Plan de Auditoría ${d.folio || id}.pdf` };
    },
    async pdfReunion(id) {
        const d = await this.obtener(id);
        const buffer = await pdfReunion({ encabezado: await revisionDocumentalService.encabezado('OI-FoGe-10'), auditoria: d, inicial: d.asistentes_inicial, final: d.asistentes_final });
        return { buffer, nombre: `OI-FoGe-10 Reunión Inicial y Final ${d.folio || id}.pdf` };
    },
    async pdfHallazgos(id) {
        const d = await this.obtener(id);
        const buffer = await pdfHallazgos({ encabezado: await revisionDocumentalService.encabezado('OI-FoGe-09'), hojas: d.hojas });
        return { buffer, nombre: `OI-FoGe-09 Hallazgos de Auditoría ${d.folio || id}.pdf` };
    },

    // Vista previa (sin guardar): combina lo guardado con lo que llega en el body.
    async vistaPreviaPlan(id, body) {
        const d = await this.obtener(id);
        const combinado = { ...d, ...body };
        return pdfPlan({ encabezado: await revisionDocumentalService.encabezado('OI-FoGe-08'), auditoria: combinado, agenda: body.agenda || d.agenda });
    },
    async vistaPreviaReunion(id, reunion, body) {
        const d = await this.obtener(id);
        const combinado = { ...d, [reunion === 'INICIAL' ? 'fecha_reunion_inicial' : 'fecha_reunion_final']: body.fecha ?? (reunion === 'INICIAL' ? d.fecha_reunion_inicial : d.fecha_reunion_final) };
        return pdfReunion({
            encabezado: await revisionDocumentalService.encabezado('OI-FoGe-10'),
            auditoria: combinado,
            inicial: reunion === 'INICIAL' ? (body.asistentes || d.asistentes_inicial) : d.asistentes_inicial,
            final: reunion === 'FINAL' ? (body.asistentes || d.asistentes_final) : d.asistentes_final,
        });
    },
    async vistaPreviaHallazgos(id, body) {
        return pdfHallazgos({ encabezado: await revisionDocumentalService.encabezado('OI-FoGe-09'), hojas: body.hojas || [] });
    },
};

export default calidadAuditoriaService;
