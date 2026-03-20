import rbacService from '../services/rbac.service.js';
import authService from '../services/auth.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';
import path from 'path';
import fs from 'fs';

class UserController {
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

            if (!avatarPath) {
                return errorResponse(res, 'No se proporcionó la ruta del avatar', 400);
            }

            // Update user in DB using rbacService
            await rbacService.updateUserProfilePicture(userId, avatarPath);

            return successResponse(res, { foto: avatarPath }, 'Avatar actualizado correctamente');
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
