import sql from 'mssql';
import { getConnection } from '../config/database.js';
import { errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

// Permiso nuevo con respaldo. Sirve para separar acciones de una sección que
// hasta ahora usaba un solo permiso (ej. firmar o anular en Verificación de
// Temperatura) sin dejar a nadie afuera mientras la migración que crea el
// permiso nuevo no se haya ejecutado:
//   - si el código nuevo YA existe en mae_permiso, se exige ese código;
//   - si todavía no existe, basta con el permiso base de la sección.
// Así el despliegue del código y la migración pueden ir en distinto orden.

const existencia = new Map(); // codigo -> { existe, revisado }
const REVISAR_CADA = 5 * 60 * 1000;

export const permisoRegistrado = async (codigo) => {
    const c = existencia.get(codigo);
    if (c?.existe) return true;
    if (c && Date.now() - c.revisado < REVISAR_CADA) return false;
    let existe = false;
    try {
        const pool = await getConnection();
        const r = await pool.request().input('c', sql.VarChar(50), codigo)
            .query('SELECT 1 AS x FROM mae_permiso WHERE codigo = @c');
        existe = r.recordset.length > 0;
    } catch (e) {
        logger.warn(`No se pudo verificar el permiso ${codigo}: ${e.message}`);
    }
    existencia.set(codigo, { existe, revisado: Date.now() });
    return existe;
};

/** true si el usuario puede hacer la acción: tiene el permiso nuevo o, mientras no exista, el base. */
export const puedeConRespaldo = async (user, nuevo, base) => {
    const permisos = user?.permissions || [];
    if (permisos.includes(nuevo)) return true;
    if (await permisoRegistrado(nuevo)) return false;
    return permisos.includes(base);
};

export const permisoConRespaldo = (nuevo, base) => async (req, res, next) => {
    try {
        if (!req.user) return errorResponse(res, 'Usuario no autenticado', 401);
        if (await puedeConRespaldo(req.user, nuevo, base)) return next();
        return errorResponse(res, 'No tiene permisos para realizar esta acción', 403);
    } catch (error) {
        logger.error('Error en permisoConRespaldo:', error);
        return errorResponse(res, 'Error al verificar permisos', 500);
    }
};
