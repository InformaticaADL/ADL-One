import express from 'express';
import * as analysisController from '../controllers/analysis.controller.js';

const router = express.Router();

/**
 * @route   GET /api/analysis/normativas
 * @desc    Get all normativas
 * @access  Public (TODO: Add auth middleware)
 */
router.get('/normativas', analysisController.getNormativas);

/**
 * @route   GET /api/analysis/referencias
 * @desc    Get referencias by normativa
 * @query   normativaId
 * @access  Public (TODO: Add auth middleware)
 */
router.get('/referencias', analysisController.getReferenciasByNormativa);

/**
 * @route   GET /api/analysis/analisis
 * @desc    Get analysis by normativa and referencia
 * @query   normativaId, referenciaId
 * @access  Public (TODO: Add auth middleware)
 */
router.get('/analisis', analysisController.getAnalysisByNormativaReferencia);

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
