import generalChatService from '../services/general-chat.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';
import path from 'path';
import fs from 'fs';

class GeneralChatController {

    // ─── CONVERSACIONES ────────────────────────────────────────

    async getConversations(req, res) {
        try {
            const userId = req.user.id;
            const conversations = await generalChatService.getConversations(userId);
            return successResponse(res, conversations);
        } catch (error) {
            logger.error('Error in getConversations:', error);
            return errorResponse(res, 'Error al obtener conversaciones', 500);
        }
    }

    async getOrCreateDirect(req, res) {
        try {
            const userId = req.user.id;
            const { targetUserId } = req.params;
            if (!targetUserId) return errorResponse(res, 'ID de usuario destino requerido', 400);
            const result = await generalChatService.getOrCreateDirectConversation(userId, Number(targetUserId));
            return successResponse(res, result, result.created ? 'Conversación creada' : 'Conversación encontrada');
        } catch (error) {
            logger.error('Error in getOrCreateDirect:', error);
            return errorResponse(res, 'Error al obtener/crear conversación', 500);
        }
    }

    // ─── GRUPOS ────────────────────────────────────────────────

    async createGroup(req, res) {
        try {
            const userId = req.user.id;
            const { nombre, memberIds, descripcion } = req.body;
            
            // memberIds might come as a string if using FormData
            const parsedMembers = typeof memberIds === 'string' ? JSON.parse(memberIds) : memberIds;

            if (!nombre || !parsedMembers || !Array.isArray(parsedMembers) || parsedMembers.length < 1) {
                return errorResponse(res, 'Nombre y al menos 1 miembro son requeridos', 400);
            }

            const foto_grupo = req.file ? `/uploads/chat/${req.file.filename}` : null;

            const result = await generalChatService.createGroup(userId, nombre, parsedMembers, descripcion || '', foto_grupo);
            return successResponse(res, result, 'Grupo creado exitosamente');
        } catch (error) {
            logger.error('Error in createGroup:', error);
            return errorResponse(res, error.message || 'Error al crear grupo', 500);
        }
    }

    async updateGroup(req, res) {
        try {
            const userId = req.user.id;
            const { conversationId } = req.params;
            const data = { ...req.body };
            if (req.file) {
                data.foto_grupo = `/uploads/chat/${req.file.filename}`;
            }
            const result = await generalChatService.updateGroup(userId, Number(conversationId), data);
            return successResponse(res, result, 'Grupo actualizado');
        } catch (error) {
            logger.error('Error in updateGroup:', error);
            return errorResponse(res, error.message || 'Error al actualizar grupo', error.message?.includes('permisos') ? 403 : 500);
        }
    }

    async addGroupMember(req, res) {
        try {
            const userId = req.user.id;
            const { conversationId } = req.params;
            const { targetUserId } = req.body;
            if (!targetUserId) return errorResponse(res, 'ID de usuario requerido', 400);
            const result = await generalChatService.addGroupMember(userId, Number(conversationId), Number(targetUserId));
            return successResponse(res, result, 'Miembro agregado');
        } catch (error) {
            logger.error('Error in addGroupMember:', error);
            return errorResponse(res, error.message || 'Error al agregar miembro', error.message?.includes('permisos') ? 403 : 500);
        }
    }

    async removeGroupMember(req, res) {
        try {
            const userId = req.user.id;
            const { conversationId, userId: targetUserId } = req.params;
            const result = await generalChatService.removeGroupMember(userId, Number(conversationId), Number(targetUserId));
            return successResponse(res, result, 'Miembro removido');
        } catch (error) {
            logger.error('Error in removeGroupMember:', error);
            return errorResponse(res, error.message || 'Error al remover miembro', error.message?.includes('permisos') ? 403 : 500);
        }
    }

    async updateGroupMemberRole(req, res) {
        try {
            const userId = req.user.id;
            const { conversationId, userId: targetUserId } = req.params;
            const { role } = req.body;
            if (!role || !['ADMIN', 'MIEMBRO'].includes(role.toUpperCase())) {
                return errorResponse(res, 'Rol inválido', 400);
            }
            const result = await generalChatService.updateGroupMemberRole(userId, Number(conversationId), Number(targetUserId), role.toUpperCase());
            return successResponse(res, result, 'Rol actualizado');
        } catch (error) {
            logger.error('Error in updateGroupMemberRole:', error);
            return errorResponse(res, error.message || 'Error al actualizar rol', error.message?.includes('permisos') ? 403 : 500);
        }
    }

    async leaveGroup(req, res) {
        try {
            const userId = req.user.id;
            const { conversationId } = req.params;
            const result = await generalChatService.leaveGroup(userId, Number(conversationId));
            return successResponse(res, result, 'Saliste del grupo');
        } catch (error) {
            logger.error('Error in leaveGroup:', error);
            return errorResponse(res, 'Error al salir del grupo', 500);
        }
    }

    async getConversationMembers(req, res) {
        try {
            const { conversationId } = req.params;
            const members = await generalChatService.getConversationMembers(Number(conversationId));
            return successResponse(res, members);
        } catch (error) {
            logger.error('Error in getConversationMembers:', error);
            return errorResponse(res, 'Error al obtener miembros', 500);
        }
    }

    async deleteConversation(req, res) {
        try {
            const userId = req.user.id;
            const { conversationId } = req.params;
            const result = await generalChatService.deleteConversation(userId, Number(conversationId));
            return successResponse(res, result, 'Conversación eliminada');
        } catch (error) {
            logger.error('Error in deleteConversation:', error);
            return errorResponse(res, 'Error al eliminar conversación', 500);
        }
    }

    // ─── MENSAJES ──────────────────────────────────────────────

    async getMessages(req, res) {
        try {
            const userId = req.user.id;
            const { conversationId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const messages = await generalChatService.getMessages(userId, Number(conversationId), page);
            return successResponse(res, messages);
        } catch (error) {
            logger.error('Error in getMessages:', error);
            return errorResponse(res, error.message || 'Error al obtener mensajes', error.message?.includes('participante') ? 403 : 500);
        }
    }

    async sendMessage(req, res) {
        try {
            const userId = req.user.id;
            const { conversationId } = req.params;
            const { mensaje } = req.body;
            const file = req.file || null;

            if (!mensaje && !file) {
                return errorResponse(res, 'Mensaje o archivo requerido', 400);
            }

            // Process file path for storage
            let fileData = null;
            if (file) {
                fileData = {
                    path: `/uploads/chat/${file.filename}`,
                    originalname: file.originalname
                };
            }

            const result = await generalChatService.sendMessage(userId, Number(conversationId), mensaje, fileData);
            return successResponse(res, result, 'Mensaje enviado');
        } catch (error) {
            logger.error('Error in sendMessage:', error);
            return errorResponse(res, error.message || 'Error al enviar mensaje', error.message?.includes('participante') ? 403 : 500);
        }
    }

    async markAsRead(req, res) {
        try {
            const userId = req.user.id;
            const { conversationId } = req.params;
            const result = await generalChatService.markAsRead(userId, Number(conversationId));
            return successResponse(res, result, 'Marcado como leído');
        } catch (error) {
            logger.error('Error in markAsRead:', error);
            return errorResponse(res, 'Error al marcar como leído', 500);
        }
    }

    async clearMessages(req, res) {
        try {
            const userId = req.user.id;
            const { conversationId } = req.params;
            const result = await generalChatService.clearMessages(userId, Number(conversationId));
            return successResponse(res, result, 'Mensajes limpiados');
        } catch (error) {
            logger.error('Error in clearMessages:', error);
            return errorResponse(res, 'Error al limpiar mensajes', 500);
        }
    }

    async unhideConversation(req, res) {
        try {
            const userId = req.user.id;
            const { conversationId } = req.params;
            const result = await generalChatService.ensureVisible(userId, Number(conversationId));
            return successResponse(res, result, 'Conversación visible');
        } catch (error) {
            logger.error('Error in unhideConversation:', error);
            return errorResponse(res, 'Error al mostrar conversación', 500);
        }
    }

    async deleteMessage(req, res) {
        try {
            const userId = req.user.id;
            const { messageId } = req.params;
            const result = await generalChatService.deleteMessage(userId, Number(messageId));
            return successResponse(res, result, 'Mensaje eliminado');
        } catch (error) {
            logger.error('Error in deleteMessage:', error);
            return errorResponse(res, 'Error al eliminar mensaje', 500);
        }
    }

    // ─── CONTACTOS ─────────────────────────────────────────────

    async searchContacts(req, res) {
        try {
            const userId = req.user.id;
            const { q, onlyUsers } = req.query;
            const contacts = await generalChatService.searchContacts(userId, q || '', onlyUsers === 'true');
            return successResponse(res, contacts);
        } catch (error) {
            logger.error('Error in searchContacts:', error);
            return errorResponse(res, 'Error al buscar contactos', 500);
        }
    }

    async getFavorites(req, res) {
        try {
            const userId = req.user.id;
            const favorites = await generalChatService.getFavoriteContacts(userId);
            return successResponse(res, favorites);
        } catch (error) {
            logger.error('Error in getFavorites:', error);
            return errorResponse(res, 'Error al obtener favoritos', 500);
        }
    }

    async addFavorite(req, res) {
        try {
            console.log('TRACE: addFavorite reached', { params: req.params, query: req.query });
            const userId = req.user.id;
            const { contactId } = req.params;
            const { tipo } = req.query;
            const result = await generalChatService.addFavoriteContact(userId, Number(contactId), tipo || 'USER');
            return successResponse(res, result, 'Agregado a favoritos');
        } catch (error) {
            console.error('TRACE: addFavorite Error:', error);
            logger.error('Error in addFavorite:', error);
            return errorResponse(res, 'Error al agregar favorito', 500);
        }
    }

    async removeFavorite(req, res) {
        try {
            const userId = req.user.id;
            const { contactId } = req.params;
            const { tipo } = req.query;
            const result = await generalChatService.removeFavoriteContact(userId, Number(contactId), tipo || 'USER');
            return successResponse(res, result, 'Removido de favoritos');
        } catch (error) {
            logger.error('Error in removeFavorite:', error);
            return errorResponse(res, 'Error al remover favorito', 500);
        }
    }

    // ─── PERFIL ────────────────────────────────────────────────

    async getUserProfile(req, res) {
        try {
            const { userId } = req.params;
            const profile = await generalChatService.getUserProfile(Number(userId));
            if (!profile) return errorResponse(res, 'Usuario no encontrado', 404);
            return successResponse(res, profile);
        } catch (error) {
            logger.error('Error in getUserProfile:', error);
            return errorResponse(res, 'Error al obtener perfil', 500);
        }
    }

    // ─── DESCARGA DE ADJUNTOS ──────────────────────────────────

    async downloadAttachment(req, res) {
        try {
            const { messageId } = req.params;
            const attachment = await generalChatService.getAttachment(Number(messageId));
            if (!attachment) return errorResponse(res, 'Adjunto no encontrado', 404);

            const uploadPath = process.env.UPLOAD_PATH || path.resolve(process.cwd(), 'uploads');
            const filePath = path.join(uploadPath, 'chat', path.basename(attachment.archivo_ruta));

            if (!fs.existsSync(filePath)) {
                return errorResponse(res, 'Archivo no encontrado en el servidor', 404);
            }

            res.setHeader('Content-Disposition', `attachment; filename="${attachment.archivo_nombre}"`);
            res.sendFile(filePath);
        } catch (error) {
            logger.error('Error in downloadAttachment:', error);
            return errorResponse(res, 'Error al descargar adjunto', 500);
        }
    }
}

export default new GeneralChatController();
