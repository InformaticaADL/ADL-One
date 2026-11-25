import sql from 'mssql';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import revisionDocumentalService from './revisionDocumental.service.js';
import { pdfPrograma } from './calidad.pdf.js';

// G. Calidad → Calidad → Programa Anual de Auditorías Internas (OI-FoGe-07).
// migrations/add_calidad_auditorias.sql: mae_gc_iso_elemento (catálogo editable), mae_gc_programa_auditoria (uno por
// año) y mae_gc_programa_item (cada mes marcado de un elemento = una auditoría programada).
//
// Un item con id_auditoria ya está tomado por una auditoría creada (fase 3): no se puede desmarcar desde aquí, solo
// anulando esa auditoría. El estado de cada item lo actualiza la fase 3 (PROGRAMADA → REALIZADA/REPROGRAMADA/CANCELADA).

const fallo = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const clip = (v, max) => (v === null || v === undefined ? null : String(v).trim().slice(0, max));

let tablaLista = false;
const hayTabla = async (pool) => {
    if (tablaLista) return true;
    tablaLista = !!(await pool.request().query("SELECT OBJECT_ID('mae_gc_programa_item', 'U') AS t").then((r) => r.recordset[0].t));
    return tablaLista;
};
const exigirTabla = async (pool) => {
    if (!(await hayTabla(pool))) throw fallo('Falta ejecutar la migración add_calidad_auditorias.sql en la base de ADL-One.', 503);
};

const calidadProgramaService = {
    // ── Catálogo de elementos ISO (editable) ──
    async listarElementos({ soloActivos = true } = {}) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const r = await pool.request().query(`
            SELECT id_elemento, referencia, nombre, orden, activo FROM mae_gc_iso_elemento
            ${soloActivos ? 'WHERE activo = 1 ' : ''}ORDER BY orden`);
        return r.recordset.map((e) => ({ ...e, activo: !!e.activo }));
    },

    async crearElemento({ referencia, nombre }, usuario) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const nom = clip(nombre, 200);
        if (!nom) throw fallo('Escriba el nombre del elemento.');
        const maxOrden = (await pool.request().query('SELECT ISNULL(MAX(orden), 0) AS m FROM mae_gc_iso_elemento')).recordset[0].m;
        const r = await pool.request()
            .input('ref', sql.NVarChar(30), clip(referencia, 30))
            .input('nombre', sql.NVarChar(200), nom)
            .input('orden', sql.Int, maxOrden + 1)
            .query('INSERT INTO mae_gc_iso_elemento (referencia, nombre, orden) OUTPUT INSERTED.id_elemento VALUES (@ref, @nombre, @orden)');
        logger.info(`[Programa auditorías] ${usuario?.name || 'alguien'} agregó el elemento «${nom}».`);
        return { id_elemento: r.recordset[0].id_elemento };
    },

    async editarElemento(id, { referencia, nombre, activo }, usuario) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const sets = [];
        const req = pool.request().input('id', sql.Int, Number(id));
        if (nombre !== undefined) {
            const nom = clip(nombre, 200);
            if (!nom) throw fallo('El nombre no puede quedar vacío.');
            req.input('nombre', sql.NVarChar(200), nom); sets.push('nombre = @nombre');
        }
        if (referencia !== undefined) { req.input('ref', sql.NVarChar(30), clip(referencia, 30)); sets.push('referencia = @ref'); }
        if (activo !== undefined) { req.input('activo', sql.Bit, activo ? 1 : 0); sets.push('activo = @activo'); }
        if (!sets.length) return { ok: true };
        await req.query(`UPDATE mae_gc_iso_elemento SET ${sets.join(', ')} WHERE id_elemento = @id`);
        logger.info(`[Programa auditorías] ${usuario?.name || 'alguien'} editó el elemento ${id}.`);
        return { ok: true };
    },

    // ── Programa de un año ──
    async obtenerPrograma(anio) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const a = Number(anio);
        if (!Number.isInteger(a) || a < 2000 || a > 2100) throw fallo('Año inválido.');
        const programa = (await pool.request().input('a', sql.Int, a).query('SELECT * FROM mae_gc_programa_auditoria WHERE anio = @a')).recordset[0] || null;
        const elementos = await this.listarElementos();
        let items = [];
        if (programa) {
            items = (await pool.request().input('p', sql.Int, programa.id_programa)
                .query('SELECT * FROM mae_gc_programa_item WHERE id_programa = @p')).recordset;
        }
        const porElemento = new Map();
        for (const it of items) {
            const l = porElemento.get(it.id_elemento) || [];
            l.push(it);
            porElemento.set(it.id_elemento, l);
        }
        const filas = elementos.map((e) => {
            const its = porElemento.get(e.id_elemento) || [];
            const meses = {};
            for (const it of its) meses[it.mes] = { estado: it.estado, id_auditoria: it.id_auditoria, id_item: it.id_item };
            return { id_elemento: e.id_elemento, referencia: e.referencia, nombre: e.nombre, meses };
        });
        return {
            anio: a,
            existe: !!programa,
            fecha_actualizacion: programa?.fecha_actualizacion ? String(programa.fecha_actualizacion).slice(0, 10) : null,
            observaciones: programa?.observaciones || null,
            filas,
        };
    },

    /**
     * Guarda el programa de un año: `meses` = { [id_elemento]: [1,3,7,...] } (los meses marcados de cada elemento; los
     * que falten se desmarcan). Los items ya tomados por una auditoría (id_auditoria no nulo) nunca se tocan, se
     * sigan marcando o no: hay que anular esa auditoría para liberarlos.
     */
    async guardarPrograma(anio, { meses = {}, observaciones, fecha_actualizacion } = {}, usuario) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const a = Number(anio);
        if (!Number.isInteger(a) || a < 2000 || a > 2100) throw fallo('Año inválido.');
        const elementos = await this.listarElementos({ soloActivos: false });
        const porId = new Map(elementos.map((e) => [e.id_elemento, e]));

        let programa = (await pool.request().input('a', sql.Int, a).query('SELECT * FROM mae_gc_programa_auditoria WHERE anio = @a')).recordset[0];
        if (!programa) {
            const r = await pool.request()
                .input('a', sql.Int, a)
                .input('u', sql.Numeric(10, 0), usuario?.id || null)
                .input('nombre', sql.NVarChar(150), clip(usuario?.name, 150))
                .query(`INSERT INTO mae_gc_programa_auditoria (anio, id_usuario_crea, nombre_crea)
                        OUTPUT INSERTED.* VALUES (@a, @u, @nombre)`);
            programa = r.recordset[0];
        }
        await pool.request()
            .input('id', sql.Int, programa.id_programa)
            .input('obs', sql.NVarChar(1000), clip(observaciones, 1000))
            .input('fa', sql.Date, fecha_actualizacion || null)
            .query(`UPDATE mae_gc_programa_auditoria SET observaciones = @obs, fecha_actualizacion = @fa, fecha_modificacion = GETDATE() WHERE id_programa = @id`);

        const actuales = (await pool.request().input('p', sql.Int, programa.id_programa)
            .query('SELECT * FROM mae_gc_programa_item WHERE id_programa = @p')).recordset;
        const actualPorClave = new Map(actuales.map((x) => [`${x.id_elemento}:${x.mes}`, x]));
        const bloqueados = []; // meses que se intentó desmarcar pero ya tienen auditoría

        for (const [idElStr, listaMeses] of Object.entries(meses)) {
            const idEl = Number(idElStr);
            const elemento = porId.get(idEl);
            if (!elemento) continue;
            const deseados = new Set((Array.isArray(listaMeses) ? listaMeses : []).map(Number).filter((m) => m >= 1 && m <= 12));
            // Agregar los nuevos.
            for (const mes of deseados) {
                if (actualPorClave.has(`${idEl}:${mes}`)) continue;
                await pool.request()
                    .input('p', sql.Int, programa.id_programa).input('e', sql.Int, idEl)
                    .input('ref', sql.NVarChar(30), elemento.referencia).input('nom', sql.NVarChar(200), elemento.nombre)
                    .input('mes', sql.TinyInt, mes)
                    .query(`INSERT INTO mae_gc_programa_item (id_programa, id_elemento, referencia, elemento, mes)
                            VALUES (@p, @e, @ref, @nom, @mes)`);
            }
            // Quitar los que ya no están marcados (solo si no tienen auditoría).
            for (const it of actuales.filter((x) => x.id_elemento === idEl && !deseados.has(x.mes))) {
                if (it.id_auditoria) { bloqueados.push({ elemento: elemento.nombre, mes: it.mes }); continue; }
                await pool.request().input('id', sql.Int, it.id_item).query('DELETE FROM mae_gc_programa_item WHERE id_item = @id');
            }
        }
        logger.info(`[Programa auditorías] ${usuario?.name || 'alguien'} guardó el programa ${a}.`);
        return { ok: true, bloqueados };
    },

    /**
     * Vista previa del programa con lo que se está marcando en pantalla (sin guardar nada): toma `meses` igual que
     * guardarPrograma, pero arma las filas en memoria combinando con lo que ya hay guardado (para no perder el
     * estado/id_auditoria de los meses que vienen de una auditoría creada).
     */
    async vistaPreviaPdf(anio, { meses = {}, observaciones } = {}) {
        const actual = await this.obtenerPrograma(anio);
        const guardadosPorElemento = new Map(actual.filas.map((f) => [f.id_elemento, f.meses]));
        const filas = actual.filas.map((f) => {
            const deseados = new Set((meses[f.id_elemento] || meses[String(f.id_elemento)] || []).map(Number));
            const guardados = guardadosPorElemento.get(f.id_elemento) || {};
            const nuevaMeses = {};
            for (const mes of deseados) nuevaMeses[mes] = guardados[mes] || { estado: 'PROGRAMADA', id_auditoria: null };
            // Los meses con auditoría creada siempre se muestran, aunque no vengan marcados (no se pueden quitar).
            for (const [mes, info] of Object.entries(guardados)) if (info.id_auditoria) nuevaMeses[mes] = info;
            return { ...f, meses: nuevaMeses };
        });
        return pdfPrograma({
            encabezado: await revisionDocumentalService.encabezado('OI-FoGe-07'),
            anio: Number(anio),
            fecha_actualizacion: actual.fecha_actualizacion,
            observaciones: observaciones ?? actual.observaciones,
            filas,
        });
    },

    async pdfPrograma(anio) {
        const { filas, fecha_actualizacion, observaciones } = await this.obtenerPrograma(anio);
        const buffer = await pdfPrograma({
            encabezado: await revisionDocumentalService.encabezado('OI-FoGe-07'),
            anio: Number(anio),
            fecha_actualizacion,
            observaciones,
            filas,
        });
        return { buffer, nombre: `OI-FoGe-07 Programa Anual de Auditorías Internas ${anio}.pdf` };
    },
};

export default calidadProgramaService;
