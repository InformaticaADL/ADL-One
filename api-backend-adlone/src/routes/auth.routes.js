import express from 'express';
import authController from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/login', authController.login);

// S-14/15/16/17: flujo de recuperación de contraseña
router.post('/forgot-password', authController.requestPasswordReset);
router.get('/reset-password/validate', authController.validateResetToken);
router.post('/reset-password', authController.resetPassword);

export default router;
