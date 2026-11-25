import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller.js';
import { authenticate, authenticateDownload } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';
import * as correosAdmin from '../controllers/correosAdmin.controller.js';

const router = Router();

// TODAS las rutas de administración de notificaciones exigen sesión Y el permiso de Notificaciones (INF_NOTIF), el mismo que da acceso a la pantalla.
// Antes bastaba con haber iniciado sesión: cualquier persona podía leer los destinatarios, cambiar la configuración o mandar correos de prueba con texto libre.
const soloNotificaciones = [authenticate, verifyPermission('INF_NOTIF')];

// Destinatarios por evento (versión antigua)
router.get('/events', ...soloNotificaciones, notificationController.getEvents);
router.get('/events/:eventId/recipients', ...soloNotificaciones, notificationController.getRecipients);
router.post('/events/:eventId/recipients', ...soloNotificaciones, notificationController.addRecipient);
router.delete('/recipients/:id', ...soloNotificaciones, notificationController.removeRecipient);

// Envíos de prueba
router.get('/test/smtp', ...soloNotificaciones, notificationController.testSMTP);
router.post('/test/send', ...soloNotificaciones, notificationController.sendTestNotification);
router.post('/test/html', ...soloNotificaciones, notificationController.testCustomHTML);

// Pantalla de Notificaciones: catálogo y guardado de la configuración
router.get('/catalog', ...soloNotificaciones, notificationController.getNotificationCatalog);
router.post('/config', ...soloNotificaciones, notificationController.saveNotificationConfig);

// Administrador de correos: quién recibe de verdad cada aviso
router.get('/events/catalogo', ...soloNotificaciones, correosAdmin.getCatalogoAdmin);
router.get('/events/:codigo/destinatarios', ...soloNotificaciones, correosAdmin.getDestinatarios);
router.get('/events/:codigo/roles', ...soloNotificaciones, correosAdmin.getRolesDelEvento);
router.put('/events/:codigo/limites', ...soloNotificaciones, correosAdmin.putLimiteDeRol);
router.get('/personas/:idUsuario', ...soloNotificaciones, correosAdmin.getVistaPorPersona);
router.put('/silencios', ...soloNotificaciones, correosAdmin.putSilencio);

// Visor de correos (herramienta de desarrollo). Se abre desde el navegador, que no puede mandar el encabezado Authorization: por eso acepta el token en
// la dirección (?token=…), igual que las descargas. Sigue exigiendo una sesión válida y el permiso de Notificaciones; antes estaba abierto a cualquiera.
const soloNotificacionesDesdeNavegador = [authenticateDownload, verifyPermission('INF_NOTIF')];
router.get('/preview', ...soloNotificacionesDesdeNavegador, notificationController.previewIndex);
router.get('/preview/:eventCode', ...soloNotificacionesDesdeNavegador, notificationController.previewEventHTML);

export default router;
