import { errorResponse } from '../utils/response.js';

/**
 * Middleware to check if the user has a specific permission.
 * Assumes that 'req.user' is already populated by the authentication middleware
 * and that it contains a 'permissions' array (from the token or fetched independently).
 * 
 * @param {string} requiredPermission - The code of the permission to check (e.g., 'MA_COMERCIAL_VIEW')
 */
export const verifyPermission = (requiredPermission) => {
    return (req, res, next) => {
        try {
            const user = req.user;

            if (!user) {
                return errorResponse(res, 'Usuario no autenticado', 401);
            }

            // If user is Admin (role check as fallback/superuser)
            // Ideally we rely on permissions, but Admin usually has all.
            // Adjust according to requirements. Here we check specific permission.

            const userPermissions = user.permissions || [];

            // Also allow if user has 'ADMIN_ACCESS' or similar super permission if designed so.
            // For now, strict check:
            if (userPermissions.includes(requiredPermission)) {
                return next();
            }

            // Fallback: Check if user role is 'Administrador' (Hardcoded legacy support if needed)
            // But better to rely on DB permissions. 
            // The DB seed assigned all permissions to Administrator, so strict check should work.

            return errorResponse(res, 'No tiene permisos para realizar esta acción', 403);
        } catch (error) {
            console.error('Error in verifyPermission:', error);
            return errorResponse(res, 'Error al verificar permisos', 500);
        }
    };
};
