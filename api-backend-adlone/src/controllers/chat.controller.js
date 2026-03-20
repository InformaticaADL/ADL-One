import chatService from '../services/chat.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

class ChatController {
    async getRecentChats(req, res) {
        try {
            const userId = req.user.id;
            const chats = await chatService.getRecentChats(userId);
            return successResponse(res, chats);
        } catch (error) {
            logger.error('Error getting recent chats:', error);
            return errorResponse(res, 'Error al obtener chats recientes', 500);
        }
    }

    async getConversation(req, res) {
        try {
            const userId = req.user.id;
            const { targetUserId } = req.params;
            const messages = await chatService.getConversation(userId, targetUserId);
            return successResponse(res, messages);
        } catch (error) {
            logger.error('Error getting conversation:', error);
            return errorResponse(res, 'Error al obtener la conversación', 500);
        }
    }

    async sendMessage(req, res) {
        try {
            const userId = req.user.id;
            const { targetUserId, mensaje } = req.body;
            if (!targetUserId || !mensaje) {
                return errorResponse(res, 'Faltan campos obligatorios', 400);
            }
            const message = await chatService.sendMessage(userId, targetUserId, mensaje);
            return successResponse(res, message, 'Mensaje enviado');
        } catch (error) {
            logger.error('Error sending message:', error);
            return errorResponse(res, 'Error al enviar mensaje', 500);
        }
    }

    async markAsRead(req, res) {
        try {
            const userId = req.user.id;
            const { targetUserId } = req.params;
            await chatService.markAsRead(userId, targetUserId);
            return successResponse(res, null, 'Marcado como leído');
        } catch (error) {
            logger.error('Error marking as read:', error);
            return errorResponse(res, 'Error al marcar como leído', 500);
        }
    }

    async searchUsers(req, res) {
        try {
            const { q } = req.query;
            const users = await chatService.searchUsers(q || '');
            return successResponse(res, users);
        } catch (error) {
            logger.error('Error searching users for chat:', error);
            return errorResponse(res, 'Error al buscar usuarios', 500);
        }
    }
}

export default new ChatController();
