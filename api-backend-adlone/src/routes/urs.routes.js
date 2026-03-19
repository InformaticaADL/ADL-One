import express from 'express';
import multer from 'multer';
import ursController from '../controllers/urs.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const upload = multer();

const router = express.Router();

// All URS routes require authentication
router.use(authenticate);

router.get('/types', ursController.getTypes);
router.post('/types', ursController.createUpdateType);
router.put('/types/:id', ursController.createUpdateType);
router.patch('/types/:id/status', ursController.toggleTypeStatus);

router.get('/', ursController.getRequests);
router.post('/', upload.any(), ursController.createRequest);
router.get('/:id', ursController.getRequestById);
router.put('/:id/status', ursController.updateStatus);
router.post('/:id/comments', upload.any(), ursController.addComment);
router.post('/:id/derive', ursController.derive);
router.get('/download/:idAdjunto', ursController.downloadAttachment);

// --- Granular Permissions & Notifications (Phase 22) ---
router.get('/types/:id/permissions', ursController.getPermissions);
router.post('/types/:id/permissions', ursController.addPermission);
router.delete('/permissions/:idRelacion', ursController.removePermission);
router.get('/types/:id/derivation-targets', ursController.getDerivationTargets);
router.get('/types/:id/notifications', ursController.getNotificationConfig);
router.post('/types/:id/notifications', ursController.saveNotificationConfig);

export default router;
