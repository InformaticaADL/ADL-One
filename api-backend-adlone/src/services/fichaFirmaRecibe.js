import sql from 'mssql';
import logger from '../utils/logger.js';

// Quien RECIBE el equipo acepta (o rechaza) la ficha de entrega desde ADL SAMPLING
// (migrations/2026-11-27-firma-muestreador-ficha-equipo.sql). Se pide solo con FIRMA_EQUIPO_EN_APP=1 en el .env (cuando la app que permite aceptar ya
// está instalada); sin eso, o sin la tabla, las fichas funcionan como antes.

const normalizar = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const ES_BASE = /^(base|sede)\b/; // equipos a nombre de una base: no hay una persona que acepte en la app

/** A quién se le pide aceptar en la app: la persona habilitada que tiene asignado el equipo, si es quien figura recibiéndolo. */
export const elegirReceptor = (muestreador, responsableEquipo) => {
    if (!muestreador?.id_muestreador || String(muestreador.habilitado ?? '').trim().toUpperCase() !== 'S') return null;
    const nombre = normalizar(muestreador.nombre_muestreador);
    if (!nombre || ES_BASE.test(nombre)) return null;
    const escrito = normalizar(responsableEquipo);
    if (escrito && escrito !== nombre) return null;
    return { id_muestreador: Number(muestreador.id_muestreador), nombre: String(muestreador.nombre_muestreador).trim() };
};

/** La fila de quien recibe vista como un firmante más de la ficha (null si no se le pidió o ya no corresponde). */
export const comoFirmante = (fila) => (!fila || fila.estado === 'ANULADA' ? null : {
    rol: 'RECIBE',
    nombre: fila.nombre,
    cargo: null,
    estado: fila.estado === 'ACEPTADA' ? 'FIRMADA' : fila.estado,
    modo: fila.estado === 'ACEPTADA' ? 'GUARDADA' : null,
    fecha_firma: fila.estado === 'ACEPTADA' ? fila.fecha_respuesta : null,
});

let hayTabla = false;
export const hayTablaRecibe = async (pool) => {
    if (!hayTabla) hayTabla = !!(await pool.request().query("SELECT OBJECT_ID('mae_ficha_firma_recibe', 'U') AS id")).recordset[0]?.id;
    return hayTabla;
};

export const aceptacionEnAppActiva = () => String(process.env.FIRMA_EQUIPO_EN_APP || '').trim() === '1';

export const receptorDe = async (pool, idEquipo, responsableEquipo) => {
    if (!aceptacionEnAppActiva() || !idEquipo || !(await hayTablaRecibe(pool))) return null;
    const m = (await pool.request().input('e', sql.Numeric(10, 0), Number(idEquipo)).query(`
        SELECT m.id_muestreador, m.nombre_muestreador, m.habilitado
        FROM mae_equipo e JOIN mae_muestreador m ON m.id_muestreador = e.id_muestreador WHERE e.id_equipo = @e`)).recordset[0];
    return elegirReceptor(m, responsableEquipo);
};

export const insertarRecibe = (tx, idFicha, receptor) => new sql.Request(tx)
    .input('f', sql.Int, idFicha)
    .input('m', sql.Numeric(10, 0), receptor.id_muestreador)
    .input('n', sql.NVarChar(150), receptor.nombre.slice(0, 150))
    .query('INSERT INTO mae_ficha_firma_recibe (id_ficha_firma, id_muestreador, nombre) VALUES (@f, @m, @n)');

export const leerRecibe = async (pool, idFicha) => {
    if (!(await hayTablaRecibe(pool))) return null;
    return (await pool.request().input('f', sql.Int, Number(idFicha))
        .query('SELECT * FROM mae_ficha_firma_recibe WHERE id_ficha_firma = @f')).recordset[0] || null;
};

/** Map id_ficha_firma → fila, para las listas. */
export const recibePorFichas = async (pool, ids) => {
    const lista = [...new Set(ids.map(Number).filter(Number.isInteger))];
    if (!lista.length || !(await hayTablaRecibe(pool))) return new Map();
    const r = await pool.request().query(`SELECT * FROM mae_ficha_firma_recibe WHERE id_ficha_firma IN (${lista.join(',')})`);
    return new Map(r.recordset.map((x) => [x.id_ficha_firma, x]));
};

/** Pasa la respuesta pendiente a `estado`. Devuelve false si ya no estaba pendiente (otra respuesta llegó antes). */
export const resolverRecibe = async (pool, idFicha, estado, { idFirma = null, motivo = null } = {}) => {
    if (!(await hayTablaRecibe(pool))) return false;
    const r = await pool.request()
        .input('f', sql.Int, Number(idFicha)).input('e', sql.VarChar(12), estado)
        .input('firma', sql.Int, idFirma).input('m', sql.NVarChar(300), motivo ? String(motivo).slice(0, 300) : null)
        .query(`UPDATE mae_ficha_firma_recibe SET estado = @e, id_firma = @firma, motivo = @m, fecha_respuesta = GETDATE()
                WHERE id_ficha_firma = @f AND estado = 'PENDIENTE'`);
    return r.rowsAffected[0] > 0;
};

/** Notificación al teléfono (la envía ADL SAMPLING). Si no se puede, solo queda en el log: la ficha igual aparece en la app. */
export const avisarEnLaApp = async (idMuestreador, titulo, mensaje) => {
    const base = process.env.APP_MAM_API_URL;
    if (!base || !process.env.INTERNAL_API_KEY) return;
    try {
        const r = await fetch(`${base}/equipos/interno/aviso`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_API_KEY },
            body: JSON.stringify({ id_muestreador: Number(idMuestreador), titulo, mensaje }),
            signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) logger.warn(`Aviso en ADL SAMPLING no enviado al muestreador ${idMuestreador}: HTTP ${r.status}`);
    } catch (e) {
        logger.warn(`Aviso en ADL SAMPLING no enviado al muestreador ${idMuestreador}: ${e.message}`);
    }
};
