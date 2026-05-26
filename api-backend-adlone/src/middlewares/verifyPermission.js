import { errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

// RB-08: super-admin bypass eliminado. Toda la autorización debe pasar por la
// matriz de roles/permisos almacenada en BD (mae_permiso / rel_rol_permiso).
// Si se necesita un "rol global", asignar todos los permisos a ese rol en BD.

export const verifyPermission = (requiredPermission) => {
    return (req, res, next) => {
        try {
            const user = req.user;

            if (!user) {
                return errorResponse(res, 'Usuario no autenticado', 401);
            }

            const userPermissions = user.permissions || [];
            const required = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
            const hasPermission = required.some(p => userPermissions.includes(p));

            if (hasPermission) {
                return next();
            }

            return errorResponse(res, 'No tiene permisos para realizar esta acción', 403);
        } catch (error) {
            logger.error('Error in verifyPermission:', error);
            return errorResponse(res, 'Error al verificar permisos', 500);
        }
    };
};
