import authService from '../services/auth.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

class AuthController {
    async login(req, res) {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return errorResponse(res, 'Usuario y contraseña son requeridos', 400);
            }

            const result = await authService.login(username, password);

            if (result) {
                return successResponse(res, result, 'Login exitoso');
            } else {
                return errorResponse(res, 'Credenciales inválidas', 401);
            }
        } catch (err) {
            logger.error('Controller Login Error:', err);
            // Don't expose internal errors unless necessary
            const msg = err.message === 'Usuario deshabilitado' ? err.message : 'Error en el servidor al intentar loguearse';
            return errorResponse(res, msg, 500);
        }
    }
}

export default new AuthController();
