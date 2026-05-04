import express from 'express';
import fichaController from '../controllers/ficha.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';
import { validateRequest, fichaValidationSchemas } from '../middlewares/validate.middleware.js';

const router = express.Router();

router.get('/', authenticate, fichaController.getAll);
router.get('/en-proceso', authenticate, validateRequest(fichaValidationSchemas.getEnProceso), fichaController.getEnProceso);
router.get('/for-assignment', authenticate, fichaController.getForAssignment);
router.get('/ejecutados', authenticate, fichaController.getMuestreosEjecutados);
router.get('/resolve-url', authenticate, fichaController.resolveGoogleMaps);

router.post('/create', authenticate, verifyPermission('FI_CREAR'), validateRequest(fichaValidationSchemas.create), fichaController.create);
router.post('/:id/approve', authenticate, verifyPermission('FI_APROBAR_TEC'), validateRequest(fichaValidationSchemas.approve), fichaController.approve);
router.post('/:id/reject', authenticate, verifyPermission('FI_RECHAZAR_TEC'), validateRequest(fichaValidationSchemas.reject), fichaController.reject);
router.post('/:id/approve-coordinacion', authenticate, verifyPermission('FI_APROBAR_COO'), validateRequest(fichaValidationSchemas.approveCoordinacion), fichaController.approveCoordinacion);
router.post('/:id/review-coordinacion', authenticate, verifyPermission('FI_RECHAZAR_COO'), validateRequest(fichaValidationSchemas.reviewCoordinacion), fichaController.reviewCoordinacion);
router.post('/batch-agenda', authenticate, verifyPermission('FI_GEST_ASIG'), validateRequest(fichaValidationSchemas.batchUpdateAgenda), fichaController.batchUpdateAgenda);
router.post('/cancel-sampling', authenticate, verifyPermission('MA_CALENDARIO_CANCELAR'), fichaController.cancelSampling);
router.post('/enviar-documento-manual', authenticate, fichaController.enviarDocumentoManual);
router.get('/:id/assignment-detail', authenticate, validateRequest(fichaValidationSchemas.getAssignmentDetail), fichaController.getAssignmentDetail);
router.get('/:id/execution-detail', authenticate, fichaController.getExecutionDetail);
router.get('/:id/historial', authenticate, fichaController.getHistorial);
router.get('/:id/pdf', authenticate, fichaController.downloadPdf);
router.get('/:id/excel', authenticate, fichaController.downloadExcel);
router.get('/:id/sampling-equipos', authenticate, fichaController.getSamplingEquipos);
router.get('/:id', authenticate, validateRequest(fichaValidationSchemas.getById), fichaController.getById);
router.post('/:id/agenda', authenticate, verifyPermission('FI_GEST_ASIG'), validateRequest(fichaValidationSchemas.updateAgenda), fichaController.updateAgenda);
router.post('/:id/update', authenticate, verifyPermission('FI_EDITAR'), fichaController.update);

export default router;

