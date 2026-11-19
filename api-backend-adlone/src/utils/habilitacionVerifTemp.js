// Habilitación para la verificación de temperatura (OI-FoGe-39), definida por Gestión de Calidad.
//   · Un equipo Operativo aparece siempre en Verificación de Temperatura.
//   · Un equipo Fuera de Servicio o Dado de Baja aparece solo si se habilitó desde el Inventario de Equipos
//     (columna mae_equipo.habilitado_verif_temp, migrations/alter_equipo_habilitado_verif_temp.sql).
// Mientras la columna no exista, los Fuera de Servicio y Dados de Baja no aparecen.

let columnaExiste = false;
let revisada = 0;

/** ¿Existe la columna? Se recuerda cuando existe; si falta, se vuelve a revisar cada 5 minutos. */
export const hayColumnaHabilitaVerifTemp = async (pool) => {
    if (columnaExiste) return true;
    if (Date.now() - revisada < 5 * 60 * 1000) return false;
    const r = await pool.request().query("SELECT COL_LENGTH('mae_equipo', 'habilitado_verif_temp') AS c");
    revisada = Date.now();
    columnaExiste = !!r.recordset[0].c;
    return columnaExiste;
};

/** Estado que no necesita habilitación (SQL, alias `e`). */
const SQL_SIN_RESTRICCION = "(ISNULL(e.Estado, '') NOT LIKE '%baja%' AND ISNULL(e.Estado, '') NOT LIKE '%fuera%')";

/** Condición SQL (alias `e`) para que un equipo aparezca en Verificación de Temperatura según su estado. */
export const filtroEstadoVerifTemp = (conColumna) => (conColumna
    ? `(${SQL_SIN_RESTRICCION} OR ISNULL(e.habilitado_verif_temp, 0) = 1)`
    : SQL_SIN_RESTRICCION);

/** La misma regla en JS: ¿necesita habilitación un equipo con este estado? */
export const requiereHabilitacion = (estado) => /baja|fuera/i.test(String(estado || ''));
