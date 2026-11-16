import express from 'express';
import biologiaMolecularController from '../controllers/biologia-molecular.controller.js';
import historicoBiologiaMolecularController from '../controllers/historico-biologia-molecular.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';

const router = express.Router();


// Rutas protegidas para usuarios con acceso a Biología Molecular, Informática o Admin Info
const authGuard = [authenticate, verifyPermission(['BM_ACCESO', 'INF_ACCESO', 'AI_ACCESO'])];

// GET /api/biologia-molecular/muestras
router.get('/muestras', authGuard, biologiaMolecularController.getConsultaMuestras);

// GET /api/biologia-molecular/export-excel (Streaming .xlsx nativo para altos volúmenes)
router.get('/export-excel', authGuard, biologiaMolecularController.exportExcel);

// GET /api/biologia-molecular/export-csv (Streaming .csv compatible con Excel)
router.get('/export-csv', authGuard, biologiaMolecularController.exportCsv);

// ==========================================
// Rutas Históricas (2006 - 2012)
// Solo accesibles por usuario FERNANDOB e Informática
// ==========================================
router.get('/historico/muestras', authenticate, historicoBiologiaMolecularController.getConsultaHistorico);
router.get('/historico/filtros', authenticate, historicoBiologiaMolecularController.getFiltrosHistorico);
router.get('/historico/export-excel', authenticate, historicoBiologiaMolecularController.exportExcel);
router.get('/historico/export-csv', authenticate, historicoBiologiaMolecularController.exportCsv);

export default router;

