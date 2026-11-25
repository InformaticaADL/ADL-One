import sql from 'mssql';
import { getConnection } from '../config/database.js';
import { areasPorRoles } from '../utils/areasRoles.js';
import { errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

/**
 * Solo deja pasar a quien pertenece al área de Gestión de Calidad según sus roles
 * (rol «Área Gestión de Calidad»; Informática también, por soporte y pruebas).
 * Es la misma regla de utils/areasRoles.js que se usa para las firmas de Calidad.
 *
 * Los roles se leen de la base en cada petición (no del token), así un cambio de
 * rol rige de inmediato. Solo lectura sobre la base de ADL-One.
 * Responde 403 (no 401) para no cerrar la sesión del usuario.
 */
export const requireCalidad = async (req, res, next) => {
    try {
        if (!req.user?.id) return errorResponse(res, 'No autenticado', 401);
        const pool = await getConnection();
        const r = await pool.request()
            .input('u', sql.Numeric(10, 0), Number(req.user.id))
            .query('SELECT r.nombre_rol FROM rel_usuario_rol ur JOIN mae_rol r ON r.id_rol = ur.id_rol WHERE ur.id_usuario = @u');
        if (!areasPorRoles(r.recordset.map((x) => x.nombre_rol)).CALIDAD) {
            return errorResponse(res, 'Quejas y apelaciones es exclusivo del área de Gestión de Calidad.', 403);
        }
        return next();
    } catch (e) {
        logger.error('requireCalidad: no se pudieron leer los roles del usuario:', e);
        return errorResponse(res, 'No se pudo validar el acceso', 500);
    }
};
