import express from 'express';
import healthController from '../controllers/health.controller.js';

const router = express.Router();

/**
 * @route   GET /api/health
 * @desc    Health check endpoint
 * @access  Public
 */
router.get('/', healthController.getHealth.bind(healthController));

export default router;
