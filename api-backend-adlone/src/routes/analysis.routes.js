import express from 'express';
import * as analysisController from '../controllers/analysis.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateRequest, analysisValidationSchemas } from '../middlewares/validate.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/analysis/normativas
 * @desc    Get all normativas
 * @access  Private
 */
router.get('/normativas', authenticate, analysisController.getNormativas);

/**
 * @route   GET /api/analysis/referencias
 * @desc    Get referencias by normativa
 * @query   normativaId
 * @access  Private
 */
router.get('/referencias', authenticate, validateRequest(analysisValidationSchemas.getReferenciasByNormativa), analysisController.getReferenciasByNormativa);

/**
 * @route   GET /api/analysis/analisis
 * @desc    Get analysis by normativa and referencia
 * @query   normativaId, referenciaId
 * @access  Private
 */
router.get('/analisis', authenticate, validateRequest(analysisValidationSchemas.getAnalysisByNormativaReferencia), analysisController.getAnalysisByNormativaReferencia);

/**
 * @route   GET /api/analysis/laboratorios
 * @desc    Get laboratorios for Lab Derivado field
 */
router.get('/laboratorios', analysisController.getLaboratorios);

/**
 * @route   GET /api/analysis/tipos-entrega
 * @desc    Get tipos de entrega for Tipo de Entrega field
 */
router.get('/tipos-entrega', analysisController.getTiposEntrega);

export default router;
