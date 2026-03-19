import express from 'express';
import notificacionController from '../controllers/notificacion.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = express.Router();

// All UNS routes require authentication
router.use(authenticate);

router.get('/', notificacionController.getMyNotifications);
router.put('/:id/read', notificacionController.markAsRead);
router.put('/read-by-ref/:idReferencia', notificacionController.markAsReadByRef);

export default router;
