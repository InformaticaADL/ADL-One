import express from 'express';
import fichaController from '../controllers/ficha.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', fichaController.getAll);
router.get('/for-assignment', fichaController.getForAssignment);
router.post('/create', authenticate, fichaController.create);
router.post('/:id/approve', authenticate, fichaController.approve);
router.post('/:id/reject', authenticate, fichaController.reject);
router.post('/:id/approve-coordinacion', authenticate, fichaController.approveCoordinacion);
router.post('/:id/review-coordinacion', authenticate, fichaController.reviewCoordinacion);
router.get('/:id/assignment-detail', fichaController.getAssignmentDetail);
router.get('/:id/historial', fichaController.getHistorial);
router.get('/:id', fichaController.getById);
router.post('/batch-agenda', fichaController.batchUpdateAgenda);
router.post('/:id/agenda', fichaController.updateAgenda);
router.post('/:id/update', fichaController.update);

export default router;
