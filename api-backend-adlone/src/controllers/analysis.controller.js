import * as analysisService from '../services/analysis.service.js';
import logger from '../utils/logger.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * Get all normativas
 */
export const getNormativas = async (req, res) => {
    try {
        const normativas = await analysisService.getNormativas();
        return successResponse(res, normativas, 'Normativas retrieved successfully');
    } catch (error) {
        logger.error('Error in getNormativas controller:', error);
        return errorResponse(res, 'Error retrieving normativas', 500);
    }
};

/**
 * Get referencias by normativa
 */
export const getReferenciasByNormativa = async (req, res) => {
    try {
        const { normativaId } = req.query;

        if (!normativaId) {
            return errorResponse(res, 'normativaId is required', 400);
        }

        const referencias = await analysisService.getReferenciasByNormativa(normativaId);
        return successResponse(res, referencias, 'Referencias retrieved successfully');
    } catch (error) {
        logger.error('Error in getReferenciasByNormativa controller:', error);
        return errorResponse(res, 'Error retrieving referencias', 500);
    }
};

/**
 * Get analysis by normativa and referencia
 */
export const getAnalysisByNormativaReferencia = async (req, res) => {
    try {
        const { normativaId, referenciaId } = req.query;

        if (!normativaId || !referenciaId) {
            return errorResponse(res, 'normativaId and referenciaId are required', 400);
        }

        const analysis = await analysisService.getAnalysisByNormativaReferencia(normativaId, referenciaId);
        return successResponse(res, analysis, 'Analysis retrieved successfully');
    } catch (error) {
        logger.error('Error in getAnalysisByNormativaReferencia controller:', error);
        return errorResponse(res, 'Error retrieving analysis', 500);
    }
};

/**
 * Get laboratorios for Lab Derivado field
 */
export const getLaboratorios = async (req, res) => {
    try {
        const laboratorios = await analysisService.getLaboratorios();
        return successResponse(res, laboratorios, 'Laboratorios retrieved successfully');
    } catch (error) {
        logger.error('Error in getLaboratorios controller:', error);
        return errorResponse(res, 'Error retrieving laboratorios', 500);
    }
};

/**
 * Get tipos de entrega for Tipo de Entrega field
 */
export const getTiposEntrega = async (req, res) => {
    try {
        const tiposEntrega = await analysisService.getTiposEntrega();
        return successResponse(res, tiposEntrega, 'Tipos de entrega retrieved successfully');
    } catch (error) {
        logger.error('Error in getTiposEntrega controller:', error);
        return errorResponse(res, 'Error retrieving tipos de entrega', 500);
    }
};
