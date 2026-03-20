import express from 'express';
import chatController from '../controllers/chat.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/recent', authenticate, chatController.getRecentChats);
router.get('/conversation/:targetUserId', authenticate, chatController.getConversation);
router.post('/send', authenticate, chatController.sendMessage);
router.put('/read/:targetUserId', authenticate, chatController.markAsRead);
router.get('/users/search', authenticate, chatController.searchUsers);

export default router;
