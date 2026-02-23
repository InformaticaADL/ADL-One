import express from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { equipoController } from '../controllers/equipo.controller.js';
import solicitudController from '../controllers/solicitud.controller.js';
import { authenticate as verifyToken } from '../middlewares/auth.middleware.js';
// Note: Middleware path usually plural 'middlewares' or 'middleware'. Checking file list earlier showed 'middlewares' dir.

const router = express.Router();

// --- MUESTREADORES ---
router.get('/muestreadores', verifyToken, adminController.getMuestreadores);
router.post('/muestreadores', verifyToken, adminController.createMuestreador);
router.put('/muestreadores/:id', verifyToken, adminController.updateMuestreador);
router.delete('/muestreadores/:id', verifyToken, adminController.disableMuestreador);

// --- DASHBOARD ---
router.get('/dashboard/stats', verifyToken, adminController.getDashboardStats);

// --- EQUIPOS ---
router.get('/equipos/suggest-code', verifyToken, equipoController.suggestNextCode);
router.get('/equipos/next-correlativo/:tipo', verifyToken, equipoController.getNextCorrelativo);
router.get('/equipos', verifyToken, equipoController.getEquipos);
router.get('/equipos/:id', verifyToken, equipoController.getEquipoById);
router.post('/equipos', verifyToken, equipoController.createEquipo);
router.put('/equipos/:id', verifyToken, equipoController.updateEquipo);
router.get('/equipos/:id/historial', verifyToken, equipoController.getEquipoHistorial);
router.post('/equipos/:id/restore/:idHistorial', verifyToken, equipoController.restoreVersion);
router.delete('/equipos/:id', verifyToken, equipoController.deleteEquipo);
router.post('/equipos/check-expiration', verifyToken, equipoController.checkExpiration);

// --- SOLICITUDES ---
router.post('/solicitudes', verifyToken, solicitudController.create);
router.get('/solicitudes', verifyToken, solicitudController.getAll);
router.put('/solicitudes/:id/status', verifyToken, solicitudController.updateStatus);
router.put('/solicitudes/:id/technical-review', verifyToken, solicitudController.reviewTechnical);
router.post('/solicitudes/:id/accept-review', verifyToken, solicitudController.acceptForReview);

export default router;
