import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import generalChatController from '../controllers/general-chat.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

dotenv.config();

const router = express.Router();

// ─── Multer config for chat file uploads ───────────────────
const uploadDir = path.resolve(process.env.UPLOAD_PATH || path.resolve(process.cwd(), 'uploads'), 'chat');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `chat-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

// ─── Conversaciones ────────────────────────────────────────
router.get('/conversations', authenticate, generalChatController.getConversations);
router.post('/conversations/direct/:targetUserId', authenticate, generalChatController.getOrCreateDirect);

// ─── Grupos ────────────────────────────────────────────────
router.post('/groups', authenticate, upload.single('foto'), generalChatController.createGroup);
router.put('/groups/:conversationId', authenticate, upload.single('foto'), generalChatController.updateGroup);
router.post('/groups/:conversationId/members', authenticate, generalChatController.addGroupMember);
router.delete('/groups/:conversationId/members/:userId', authenticate, generalChatController.removeGroupMember);
router.put('/groups/:conversationId/members/:userId/role', authenticate, generalChatController.updateGroupMemberRole);
router.post('/groups/:conversationId/leave', authenticate, generalChatController.leaveGroup);

// ─── Mensajes ──────────────────────────────────────────────
router.delete('/conversations/:conversationId', authenticate, generalChatController.deleteConversation);
router.get('/conversations/:conversationId/messages', authenticate, generalChatController.getMessages);
router.post('/conversations/:conversationId/messages', authenticate, upload.single('archivo'), generalChatController.sendMessage);
router.put('/conversations/:conversationId/read', authenticate, generalChatController.markAsRead);
router.put('/conversations/:conversationId/clear', authenticate, generalChatController.clearMessages);
router.put('/conversations/:conversationId/unhide', authenticate, generalChatController.unhideConversation);
router.delete('/messages/:messageId', authenticate, generalChatController.deleteMessage);

// ─── Contactos ─────────────────────────────────────────────
router.get('/contacts/search', authenticate, generalChatController.searchContacts);
router.get('/contacts/favorites', authenticate, generalChatController.getFavorites);
router.post('/contacts/favorites/:contactId', authenticate, generalChatController.addFavorite);
router.delete('/contacts/favorites/:contactId', authenticate, generalChatController.removeFavorite);

// ─── Miembros & Perfil ────────────────────────────────────
router.get('/conversations/:conversationId/members', authenticate, generalChatController.getConversationMembers);
router.get('/users/:userId/profile', authenticate, generalChatController.getUserProfile);

// ─── Descargas ─────────────────────────────────────────────
router.get('/download/:messageId', authenticate, generalChatController.downloadAttachment);

export default router;
