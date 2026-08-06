import express from 'express';
import trackingController from '../controllers/tracking.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { protectInternalService } from '../middlewares/protectInternalService.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';

const router = express.Router();

router.post('/interno/posicion', protectInternalService, trackingController.recibirPosicion);
router.post('/interno/jornada-iniciada', protectInternalService, trackingController.recibirJornadaIniciada);
router.get('/hoy', authenticate, verifyPermission('AI_MA_HOY_EN_VIVO'), trackingController.getSnapshot);
router.get('/historial', authenticate, verifyPermission('AI_MA_HOY_EN_VIVO'), trackingController.getHistorial);

export default router;
