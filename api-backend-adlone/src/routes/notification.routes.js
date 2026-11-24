import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';
import * as correosAdmin from '../controllers/correosAdmin.controller.js';

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

// Architecture 3.0 Routes
router.get('/catalog', authenticate, notificationController.getNotificationCatalog);
router.post('/config', authenticate, notificationController.saveNotificationConfig);

// Administrador de correos: quién recibe de verdad cada aviso (permiso de Notificaciones)
const soloNotificaciones = [authenticate, verifyPermission('INF_NOTIF')];
router.get('/events/catalogo', ...soloNotificaciones, correosAdmin.getCatalogoAdmin);
router.get('/events/:codigo/destinatarios', ...soloNotificaciones, correosAdmin.getDestinatarios);
router.get('/events/:codigo/roles', ...soloNotificaciones, correosAdmin.getRolesDelEvento);
router.put('/events/:codigo/limites', ...soloNotificaciones, correosAdmin.putLimiteDeRol);
router.get('/personas/:idUsuario', ...soloNotificaciones, correosAdmin.getVistaPorPersona);
router.put('/silencios', ...soloNotificaciones, correosAdmin.putSilencio);

// TEMPORARY: Email Viewer
router.get('/preview', notificationController.previewIndex);
router.get('/preview/:eventCode', notificationController.previewEventHTML);

export default router;
