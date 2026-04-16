import express from 'express';
import fichaController from '../controllers/ficha.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';

const router = express.Router();

router.get('/', authenticate, fichaController.getAll);
router.get('/en-proceso', authenticate, fichaController.getEnProceso);
router.get('/for-assignment', authenticate, fichaController.getForAssignment);
router.get('/ejecutados', authenticate, fichaController.getMuestreosEjecutados);

router.post('/create', authenticate, verifyPermission('FI_NEW_CREAR'), fichaController.create);
router.post('/:id/approve', authenticate, verifyPermission('FI_APROBAR'), fichaController.approve);
router.post('/:id/reject', authenticate, verifyPermission('FI_REVISION'), fichaController.reject);
router.post('/:id/approve-coordinacion', authenticate, verifyPermission('FI_APROBAR'), fichaController.approveCoordinacion);
router.post('/:id/review-coordinacion', authenticate, verifyPermission('FI_REVISION'), fichaController.reviewCoordinacion);
router.get('/:id/assignment-detail', authenticate, fichaController.getAssignmentDetail);
router.get('/:id/historial', authenticate, fichaController.getHistorial);
router.get('/:id', authenticate, fichaController.getById);
router.get('/:id/pdf', authenticate, fichaController.downloadPdf);
router.get('/:id/excel', authenticate, fichaController.downloadExcel);
router.get('/:id/sampling-equipos', authenticate, fichaController.getSamplingEquipos);
router.get('/:id/execution-detail', authenticate, fichaController.getExecutionDetail);
router.post('/batch-agenda', authenticate, verifyPermission('FI_GEST_ASIG'), fichaController.batchUpdateAgenda);
router.post('/cancel-sampling', authenticate, verifyPermission('MA_CALENDARIO_CANCELAR'), fichaController.cancelSampling);
router.post('/enviar-documento-manual', authenticate, fichaController.enviarDocumentoManual);
router.post('/:id/agenda', authenticate, verifyPermission('FI_GEST_ASIG'), fichaController.updateAgenda);
router.post('/:id/update', authenticate, verifyPermission('FI_EDITAR'), fichaController.update);

export default router;

