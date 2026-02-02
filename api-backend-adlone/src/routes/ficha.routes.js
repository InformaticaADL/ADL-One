import express from 'express';
import fichaController from '../controllers/ficha.controller.js';
// import authMiddleware from '../middlewares/auth.middleware.js'; // Uncomment if needed

const router = express.Router();

router.get('/', fichaController.getAll);
router.get('/for-assignment', fichaController.getForAssignment);
router.post('/create', fichaController.create);
router.post('/:id/approve', fichaController.approve);
router.post('/:id/reject', fichaController.reject);
router.post('/:id/approve-coordinacion', fichaController.approveCoordinacion);
router.post('/:id/review-coordinacion', fichaController.reviewCoordinacion);
router.get('/:id/assignment-detail', fichaController.getAssignmentDetail);
router.get('/:id/historial', fichaController.getHistorial);
router.get('/:id', fichaController.getById);
router.post('/batch-agenda', fichaController.batchUpdateAgenda);
router.post('/:id/agenda', fichaController.updateAgenda);
router.post('/:id/update', fichaController.update);

export default router;
