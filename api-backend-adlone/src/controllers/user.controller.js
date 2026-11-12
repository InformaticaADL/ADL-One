import rbacService from '../services/rbac.service.js';
import authService from '../services/auth.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';
import path from 'path';
import fs from 'fs';
import firmaDigitalService from '../services/firmaDigital.service.js';

// Errores con status < 500 (validación, falta la migración) van con su mensaje.
const responderError = (res, err, mensaje) => {
    if (err.status && err.status < 500) return errorResponse(res, err.message, err.status);
    logger.error(`${mensaje}:`, err);
    return errorResponse(res, mensaje, err.status || 500);
};

class UserController {
    // Firma guardada del usuario (para firmar formularios sin dibujarla cada vez).
    async getFirma(req, res) {
        try {
            const firma = await firmaDigitalService.obtener('USUARIO', req.user.id);
            return successResponse(res, { firma, disponible: await firmaDigitalService.disponible() }, 'Firma del usuario');
        } catch (err) {
            return responderError(res, err, 'Error al leer la firma');
        }
    }

    async saveFirma(req, res) {
        try {
            await firmaDigitalService.guardar('USUARIO', req.user.id, { imagen: req.body?.firma, origen: req.body?.origen, idUsuarioRegistra: req.user.id });
            return successResponse(res, { guardada: true }, 'Firma guardada');
        } catch (err) {
            return responderError(res, err, 'Error al guardar la firma');
        }
    }

    async deleteFirma(req, res) {
        try {
            await firmaDigitalService.quitar('USUARIO', req.user.id);
            return successResponse(res, { guardada: false }, 'Firma eliminada');
        } catch (err) {
            return responderError(res, err, 'Error al eliminar la firma');
        }
    }

    async uploadProfilePicture(req, res) {
        try {
            if (!req.file) {
                return errorResponse(res, 'No se ha subido ningún archivo', 400);
            }

            const userId = req.user.id;
            const fileName = req.file.filename;
            const photoPath = `/uploads/profile_pics/${fileName}`;

            // Update user in DB
            await rbacService.updateUserProfilePicture(userId, photoPath);

            return successResponse(res, { foto: photoPath }, 'Foto de perfil actualizada correctamente');
        } catch (err) {
            logger.error('Error in uploadProfilePicture controller:', err);
            return errorResponse(res, 'Error al subir la foto de perfil', 500, err.message);
        }
    }

    async getProfile(req, res) {
        try {
            const userId = req.user.id;
            const users = await rbacService.getAllUsersWithStatus();
            const user = users.find(u => u.id_usuario === userId);

            if (!user) {
                return errorResponse(res, 'Usuario no encontrado', 404);
            }

            return successResponse(res, user, 'Perfil recuperado correctamente');
        } catch (err) {
            logger.error('Error in getProfile controller:', err);
            return errorResponse(res, 'Error al recuperar el perfil', 500, err.message);
        }
    }

    async setPredefinedAvatar(req, res) {
        try {
            const { avatarPath } = req.body;
            const userId = req.user.id;

            if (avatarPath === undefined) {
                return errorResponse(res, 'No se proporcionó la ruta del avatar', 400);
            }

            // Update user in DB using rbacService (null means removing avatar)
            await rbacService.updateUserProfilePicture(userId, avatarPath || null);

            return successResponse(res, { foto: avatarPath || null }, 'Avatar actualizado correctamente');
        } catch (err) {
            logger.error('Error in setPredefinedAvatar controller:', err);
            return errorResponse(res, 'Error al actualizar el avatar', 500, err.message);
        }
    }

    async changePassword(req, res) {
        try {
            const userId = req.user.id;
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                return errorResponse(res, 'Faltan datos obligatorios', 400);
            }

            await authService.changePassword(userId, currentPassword, newPassword);
            return successResponse(res, null, 'Contraseña actualizada correctamente');
        } catch (err) {
            logger.error('Error in changePassword controller:', err);
            return errorResponse(res, err.message, 500);
        }
    }
}

export default new UserController();
