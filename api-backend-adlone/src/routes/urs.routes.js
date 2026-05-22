import express from 'express';
import multer from 'multer';
import ursController from '../controllers/urs.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';
import { validateRequest, ursValidationSchemas } from '../middlewares/validate.middleware.js';

const upload = multer();

const router = express.Router();

// All URS routes require authentication
router.use(authenticate);

router.get('/types', ursController.getTypes);
router.post('/types', verifyPermission(['RBAC_MANAGE', 'INF_SOLICITUDES']), validateRequest(ursValidationSchemas.createUpdateType), ursController.createUpdateType);
router.put('/types/:id', verifyPermission(['RBAC_MANAGE', 'INF_SOLICITUDES']), validateRequest(ursValidationSchemas.createUpdateType), ursController.createUpdateType);
router.patch('/types/:id/status', verifyPermission(['RBAC_MANAGE', 'INF_SOLICITUDES']), validateRequest(ursValidationSchemas.toggleTypeStatus), ursController.toggleTypeStatus);

router.get('/download/:idAdjunto', ursController.downloadAttachment);

router.get('/unread-count', ursController.getUnreadCount);
router.get('/', validateRequest(ursValidationSchemas.getRequests), ursController.getRequests);
router.post('/', upload.any(), validateRequest(ursValidationSchemas.createRequest), ursController.createRequest);
router.get('/:id', validateRequest(ursValidationSchemas.getRequestById), ursController.getRequestById);
router.put('/:id/status', validateRequest(ursValidationSchemas.updateStatus), ursController.updateStatus);
router.post('/:id/comments', upload.any(), validateRequest(ursValidationSchemas.addComment), ursController.addComment);
router.post('/:id/derive', validateRequest(ursValidationSchemas.derive), ursController.derive);

// --- Granular Permissions & Notifications (Phase 22) ---
router.get('/types/:id/permissions', ursController.getPermissions);
router.post('/types/:id/permissions', verifyPermission(['RBAC_MANAGE', 'INF_SOLICITUDES']), ursController.addPermission);
router.delete('/permissions/:idRelacion', verifyPermission(['RBAC_MANAGE', 'INF_SOLICITUDES']), ursController.removePermission);
router.get('/types/:id/derivation-targets', ursController.getDerivationTargets);
router.get('/types/:id/notifications', ursController.getNotificationConfig);
router.post('/types/:id/notifications', verifyPermission(['RBAC_MANAGE', 'INF_SOLICITUDES']), ursController.saveNotificationConfig);

export default router;
