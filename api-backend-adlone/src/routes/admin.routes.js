import express from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { equipoController } from '../controllers/equipo.controller.js';
import solicitudController from '../controllers/solicitud.controller.js';
import { authenticate as verifyToken } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';
// Note: Middleware path usually plural 'middlewares' or 'middleware'. Checking file list earlier showed 'middlewares' dir.

const router = express.Router();

// --- MUESTREADORES ---
router.get('/muestreadores', verifyToken, verifyPermission('MA_MUESTREADORES'), adminController.getMuestreadores);
router.post('/muestreadores', verifyToken, verifyPermission('AI_MA_CREAR_NEW_MUESTREADOR'), adminController.createMuestreador);
router.put('/muestreadores/:id', verifyToken, verifyPermission('AI_MA_EDITAR_MUESTREADOR'), adminController.updateMuestreador);
router.delete('/muestreadores/:id', verifyToken, verifyPermission('AI_MA_DESHABILITAR_MUESTREADOR'), adminController.disableMuestreador);
router.post('/muestreadores/:id/disable-with-reassignment', verifyToken, verifyPermission('AI_MA_DESHABILITAR_MUESTREADOR'), adminController.disableMuestreadorWithReassignment);
router.put('/muestreadores/:id/enable', verifyToken, verifyPermission('AI_MA_DESHABILITAR_MUESTREADOR'), adminController.enableMuestreador);
router.get('/muestreadores/check-duplicate', verifyToken, adminController.checkDuplicateMuestreador);
router.get('/muestreadores/export-pdf', verifyToken, verifyPermission('MU_EXP'), adminController.downloadMuestreadoresPdf);

// --- DASHBOARD ---
router.get('/dashboard/stats', verifyToken, adminController.getDashboardStats);

// --- CALENDARIO REPLICA ---
router.get('/calendario', verifyToken, adminController.getCalendario);

// --- EXPORT DATA ---
router.get('/export-table', verifyToken, adminController.getExportData);
router.get('/export-pdf', verifyToken, adminController.downloadBulkPdf);

// --- EQUIPOS ---
router.get('/equipos/comparison-resampling', verifyToken, verifyPermission('MA_A_GEST_EQUIPO'), equipoController.getEquipmentComparison);
router.get('/equipos/catalogo', verifyToken, verifyPermission('MA_A_GEST_EQUIPO'), equipoController.getEquipoCatalogo);
router.post('/equipos/catalogo', verifyToken, verifyPermission('AI_MA_CREAR_EQUIPO'), equipoController.createEquipoCatalogo);
router.put('/equipos/catalogo/:id', verifyToken, verifyPermission('AI_MA_EDITAR_EQUIPO'), equipoController.updateEquipoCatalogo);
router.delete('/equipos/catalogo/:id', verifyToken, verifyPermission('EQ_DESACTIVAR'), equipoController.deleteEquipoCatalogo);
router.get('/equipos/suggest-code', verifyToken, verifyPermission('MA_A_GEST_EQUIPO'), equipoController.suggestNextCode);
router.get('/equipos/next-correlativo/:tipo', verifyToken, verifyPermission('MA_A_GEST_EQUIPO'), equipoController.getNextCorrelativo);
router.get('/equipos/export/excel', verifyToken, verifyPermission('EQ_EXP'), equipoController.exportExcel);
router.get('/equipos', verifyToken, verifyPermission('MA_A_GEST_EQUIPO'), equipoController.getEquipos);
router.get('/equipos/:id', verifyToken, verifyPermission('MA_A_GEST_EQUIPO'), equipoController.getEquipoById);
router.post('/equipos', verifyToken, verifyPermission('AI_MA_CREAR_EQUIPO'), equipoController.createEquipo);
router.post('/equipos/bulk', verifyToken, verifyPermission('AI_MA_CREAR_EQUIPO'), equipoController.createEquiposBulk);
router.put('/equipos/:id', verifyToken, verifyPermission('AI_MA_EDITAR_EQUIPO'), equipoController.updateEquipo);
router.get('/equipos/:id/historial', verifyToken, verifyPermission('EQ_HISTORY'), equipoController.getEquipoHistorial);
router.post('/equipos/:id/restore/:idHistorial', verifyToken, verifyPermission('EQ_UPDATE'), equipoController.restoreVersion);
router.delete('/equipos/:id', verifyToken, verifyPermission('EQ_DESACTIVAR'), equipoController.deleteEquipo);
router.post('/equipos/check-expiration', verifyToken, verifyPermission('MA_A_GEST_EQUIPO'), equipoController.checkExpiration);

// --- SOLICITUDES ---
router.get('/equipos/:id/solicitudes', verifyToken, verifyPermission('EQ_VER_SOLICITUD'), solicitudController.getSolicitudesByEquipo);
router.post('/solicitudes', verifyToken, solicitudController.create);
router.get('/solicitudes', verifyToken, solicitudController.getAll);
router.put('/solicitudes/:id/status', verifyToken, solicitudController.updateStatus);
router.put('/solicitudes/:id/technical-review', verifyToken, solicitudController.reviewTechnical);
router.post('/solicitudes/:id/accept-review', verifyToken, solicitudController.acceptForReview);
router.get('/solicitudes/:id/historial', verifyToken, solicitudController.getHistorial);

export default router;
