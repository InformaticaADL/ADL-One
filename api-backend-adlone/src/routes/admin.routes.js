import express from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { authenticate as verifyToken } from '../middlewares/auth.middleware.js';
// Note: Middleware path usually plural 'middlewares' or 'middleware'. Checking file list earlier showed 'middlewares' dir.

const router = express.Router();

router.get('/muestreadores', verifyToken, adminController.getMuestreadores);
router.post('/muestreadores', verifyToken, adminController.createMuestreador);
router.put('/muestreadores/:id', verifyToken, adminController.updateMuestreador);
router.delete('/muestreadores/:id', verifyToken, adminController.disableMuestreador);

export default router;
