import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// All routes require authentication
router.get('/events', authenticate, notificationController.getEvents);
router.get('/events/:eventId/recipients', authenticate, notificationController.getRecipients);
router.post('/events/:eventId/recipients', authenticate, notificationController.addRecipient);
router.delete('/recipients/:id', authenticate, notificationController.removeRecipient);

// Test endpoints
router.get('/test/smtp', authenticate, notificationController.testSMTP);
router.post('/test/send', authenticate, notificationController.sendTestNotification);
router.post('/test/html', authenticate, notificationController.testCustomHTML);

export default router;
