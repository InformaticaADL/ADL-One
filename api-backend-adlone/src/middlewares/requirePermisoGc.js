import { getConnection } from '../config/database.js';
import { puedeGc } from '../utils/permisosCalidad.js';
import { errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Exige un permiso de Gestión de Calidad (utils/permisosCalidad.js). Se lee de la base en cada petición, así un cambio
 * en Configurar rol / permisos rige de inmediato; mientras la migración no cree el permiso, rige el rol del área.
 * Responde 403 (no 401) para no cerrar la sesión.
 */
export const requirePermisoGc = (codigo) => async (req, res, next) => {
    try {
        if (!req.user?.id) return errorResponse(res, 'No autenticado', 401);
        const pool = await getConnection();
        if (await puedeGc(pool, req.user.id, codigo)) return next();
        return errorResponse(res, `No tiene el permiso ${codigo}.`, 403);
    } catch (e) {
        logger.error(`requirePermisoGc(${codigo}):`, e);
        return errorResponse(res, 'No se pudo validar el acceso', 500);
    }
};

export default requirePermisoGc;
