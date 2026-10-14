import express from 'express';
import biologiaMolecularController from '../controllers/biologia-molecular.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';

const router = express.Router();

// Rutas protegidas para usuarios con acceso a Biología Molecular, Informática o Admin Info
const authGuard = [authenticate, verifyPermission(['BM_ACCESO', 'INF_ACCESO', 'AI_ACCESO'])];

// GET /api/biologia-molecular/muestras
router.get('/muestras', authGuard, biologiaMolecularController.getConsultaMuestras);

export default router;
