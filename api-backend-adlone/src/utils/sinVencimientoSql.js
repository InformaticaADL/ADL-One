// Fragmento SQL para dejar fuera de los vencimientos a los complementos
// (modalidad_control = 'SIN_VENCIMIENTO': baterías, botellas, cargadores…).
// Lo usan las tareas automáticas (inactivación diaria, avisos de vencimiento) y los
// contadores del panel. Si la migración add_modalidad_control_equipo.sql aún no corrió,
// devuelve '' y todo sigue como antes.

let existe = false;
let revisadoEn = 0;

const revisar = async (pool) => {
    if (existe) return true;
    if (Date.now() - revisadoEn < 5 * 60 * 1000) return false;
    revisadoEn = Date.now();
    try {
        const r = await pool.request().query("SELECT COL_LENGTH('mae_equipo', 'modalidad_control') AS c");
        existe = !!r.recordset[0]?.c;
    } catch {
        existe = false;
    }
    return existe;
};

/** ' AND ISNULL(<alias>.modalidad_control, \'\') <> \'SIN_VENCIMIENTO\'' o '' si la columna no existe. */
export const excluirSinVencimiento = async (pool, alias = '') => {
    if (!(await revisar(pool))) return '';
    const col = alias ? `${alias}.modalidad_control` : 'modalidad_control';
    return ` AND ISNULL(${col}, '') <> 'SIN_VENCIMIENTO'`;
};
