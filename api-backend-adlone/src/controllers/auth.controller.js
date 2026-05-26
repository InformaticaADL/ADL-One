import authService from '../services/auth.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

class AuthController {
    async login(req, res) {
        try {
            const { username, password, rememberMe } = req.body;

            if (!username || !password) {
                return errorResponse(res, 'Usuario y contraseña son requeridos', 400);
            }

            // S-11: trim defensivo también en backend
            const cleanUsername = String(username).trim();
            const cleanPassword = String(password).trim();

            const result = await authService.login(cleanUsername, cleanPassword, rememberMe);

            if (result) {
                return successResponse(res, result, 'Login exitoso');
            } else {
                // S-02 / S-03: credenciales válidas en usuario pero contraseña incorrecta
                return errorResponse(res, 'Credenciales inválidas', 401);
            }
        } catch (err) {
            logger.error('Controller Login Error:', err);
            // S-03: usuario inexistente devuelve 404 con mensaje específico
            if (err.code === 'USER_NOT_FOUND') {
                return errorResponse(res, err.message, err.statusCode || 404);
            }
            // S-13: cuenta bloqueada
            if (err.code === 'ACCOUNT_LOCKED') {
                return errorResponse(res, err.message, err.statusCode || 423);
            }
            if (err.message === 'Usuario deshabilitado') {
                return errorResponse(res, err.message, 403);
            }
            return errorResponse(res, 'Error en el servidor al intentar loguearse', 500);
        }
    }

    // S-14/S-15: solicitar reset (envío de email).
    // Negocio prefirió mensajes específicos en sistema interno.
    async requestPasswordReset(req, res) {
        try {
            const { email } = req.body;
            if (!email) return errorResponse(res, 'Email requerido', 400);
            const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
            await authService.requestPasswordReset(email, String(ip).split(',')[0].trim());
            return successResponse(res, { sent: true }, 'Hemos enviado un correo con las instrucciones para restablecer tu contraseña.');
        } catch (err) {
            logger.error('Controller requestPasswordReset error:', err);
            if (err.code === 'EMAIL_NOT_FOUND') {
                return errorResponse(res, err.message, err.statusCode || 404);
            }
            if (err.code === 'USER_DISABLED') {
                return errorResponse(res, err.message, err.statusCode || 403);
            }
            return errorResponse(res, err.message || 'No se pudo procesar la solicitud', err.statusCode || 500);
        }
    }

    // S-16: validar token (usado por el frontend al abrir el link).
    async validateResetToken(req, res) {
        try {
            const { token } = req.query;
            if (!token) return errorResponse(res, 'Token requerido', 400);
            const result = await authService.validateResetToken(token);
            if (!result.valid) {
                return errorResponse(res, result.reason === 'TOKEN_USED'
                    ? 'El link ya fue utilizado'
                    : result.reason === 'TOKEN_EXPIRED'
                        ? 'El link ha expirado'
                        : 'El link no es válido', 410);
            }
            return successResponse(res, { nombreUsuario: result.nombreUsuario }, 'Token válido');
        } catch (err) {
            logger.error('Controller validateResetToken error:', err);
            return errorResponse(res, 'Error al validar token', 500);
        }
    }

    // S-14/16: aplicar nueva contraseña usando token.
    async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;
            if (!token || !newPassword) return errorResponse(res, 'Token y nueva contraseña son requeridos', 400);
            await authService.consumeResetToken(token, newPassword);
            return successResponse(res, { success: true }, 'Contraseña restablecida correctamente. Ya puede iniciar sesión.');
        } catch (err) {
            logger.error('Controller resetPassword error:', err);
            return errorResponse(res, err.message || 'No se pudo restablecer la contraseña', err.statusCode || 500);
        }
    }
}

export default new AuthController();
