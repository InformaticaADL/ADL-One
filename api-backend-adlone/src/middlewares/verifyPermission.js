import { errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

const SUPER_ADMIN_PERMISSION = 'AI_MA_ADMIN_ACCESO';

export const verifyPermission = (requiredPermission) => {
    return (req, res, next) => {
        try {
            const user = req.user;

            if (!user) {
                return errorResponse(res, 'Usuario no autenticado', 401);
            }

            const userPermissions = user.permissions || [];

            if (userPermissions.includes(SUPER_ADMIN_PERMISSION)) {
                return next();
            }

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
