import express from 'express';
import multer from 'multer';
import ursController from '../controllers/urs.controller.js';
import { authenticate, authenticateDownload } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';
import { validateRequest, ursValidationSchemas } from '../middlewares/validate.middleware.js';
import solicitudEquipoService from '../services/solicitudEquipo.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

const upload = multer();

const router = express.Router();

// Descarga de adjuntos: iniciada por el navegador (<a href>), no puede enviar
// el header Authorization → usa authenticateDownload (acepta token por query).
// Debe ir ANTES del router.use(authenticate) global, que es solo-header.
router.get('/download/:idAdjunto', authenticateDownload, ursController.downloadAttachment);

// All URS routes require authentication
router.use(authenticate);

router.get('/types', ursController.getTypes);
router.post('/types', verifyPermission(['RBAC_MANAGE', 'INF_SOLICITUDES']), validateRequest(ursValidationSchemas.createUpdateType), ursController.createUpdateType);
router.put('/types/:id', verifyPermission(['RBAC_MANAGE', 'INF_SOLICITUDES']), validateRequest(ursValidationSchemas.createUpdateType), ursController.createUpdateType);
router.patch('/types/:id/status', verifyPermission(['RBAC_MANAGE', 'INF_SOLICITUDES']), validateRequest(ursValidationSchemas.toggleTypeStatus), ursController.toggleTypeStatus);

router.get('/unread-count', ursController.getUnreadCount);
router.get('/', validateRequest(ursValidationSchemas.getRequests), ursController.getRequests);
router.post('/', upload.any(), validateRequest(ursValidationSchemas.createRequest), ursController.createRequest);
router.get('/:id', validateRequest(ursValidationSchemas.getRequestById), ursController.getRequestById);
router.put('/:id/status', validateRequest(ursValidationSchemas.updateStatus), ursController.updateStatus);
router.post('/:id/comments', upload.any(), validateRequest(ursValidationSchemas.addComment), ursController.addComment);
router.post('/:id/derive', validateRequest(ursValidationSchemas.derive), ursController.derive);

// Aplicar una solicitud aceptada en los equipos (Gestión de Equipos): qué cambia y hacerlo.
const permisoEquipos = ['AI_MA_EDITAR_EQUIPO', 'MA_A_GEST_EQUIPO', 'GC_ACCESO'];
const manejarEquipo = (fn, mensaje) => async (req, res) => {
    try {
        return await fn(req, res);
    } catch (e) {
        if (e.statusCode && e.statusCode < 500) return errorResponse(res, e.message, e.statusCode);
        logger.error(`${mensaje}:`, e);
        return errorResponse(res, mensaje, 500);
    }
};
router.get('/:id/plan-equipo', verifyPermission(permisoEquipos), manejarEquipo(async (req, res) =>
    successResponse(res, await solicitudEquipoService.plan(req.params.id), 'Cambios de la solicitud'), 'No se pudieron preparar los cambios del equipo'));
router.post('/:id/aplicar-equipo', verifyPermission('AI_MA_EDITAR_EQUIPO'), manejarEquipo(async (req, res) =>
    successResponse(res, await solicitudEquipoService.aplicar(req.params.id, req.user?.id), 'Solicitud aplicada en los equipos'), 'No se pudo aplicar la solicitud en los equipos'));

// --- Granular Permissions & Notifications (Phase 22) ---
router.get('/types/:id/permissions', ursController.getPermissions);
router.post('/types/:id/permissions', verifyPermission(['RBAC_MANAGE', 'INF_SOLICITUDES']), ursController.addPermission);
router.delete('/permissions/:idRelacion', verifyPermission(['RBAC_MANAGE', 'INF_SOLICITUDES']), ursController.removePermission);
router.get('/types/:id/derivation-targets', ursController.getDerivationTargets);
router.get('/types/:id/notifications', ursController.getNotificationConfig);
router.post('/types/:id/notifications', verifyPermission(['RBAC_MANAGE', 'INF_SOLICITUDES']), ursController.saveNotificationConfig);

export default router;
