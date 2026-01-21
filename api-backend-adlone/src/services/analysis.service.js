import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';

/**
 * Get all normativas for analysis
 */
export const getNormativas = async () => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .execute('Consulta_App_Ma_Normativa');

        logger.info(`Normativas retrieved: ${result.recordset.length} records`);
        return result.recordset;
    } catch (error) {
        logger.error('Error in getNormativas:', error);
        throw error;
    }
};

/**
 * Get referencias by normativa ID
 * @param {number} normativaId - ID of the normativa
 */
export const getReferenciasByNormativa = async (normativaId) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('xid_normativa', normativaId)
            .execute('Consulta_App_Ma_NormativaReferencia');

        logger.info(`Referencias for normativa ${normativaId}: ${result.recordset.length} records`);
        return result.recordset;
    } catch (error) {
        logger.error('Error in getReferenciasByNormativa:', error);
        throw error;
    }
};

/**
 * Get analysis by normativa and referencia
 * @param {number} normativaId - ID of the normativa (not used in SP but kept for consistency)
 * @param {number} referenciaId - ID of the referencia
 */
export const getAnalysisByNormativaReferencia = async (normativaId, referenciaId) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('xid_normativareferencia', referenciaId)
            .execute('Consulta_App_Ma_ReferenciaAnalisis');

        // Initialize marca field to false for all records (FoxPro: REPLACE marca WITH .f.)
        const analysisWithMarca = result.recordset.map(record => ({
            ...record,
            marca: false,
            selected: false // For React checkbox state
        }));

        if (analysisWithMarca.length > 0) {
            // logger.info(`🔍 Analysis Structure Keys: ${Object.keys(analysisWithMarca[0]).join(', ')}`);
        }

        logger.info(`Analysis for referencia ${referenciaId}: ${analysisWithMarca.length} records`);
        return analysisWithMarca;
    } catch (error) {
        logger.error('Error in getAnalysisByNormativaReferencia:', error);
        throw error;
    }
};

/**
 * Get laboratorios for Lab Derivado field
 */
export const getLaboratorios = async () => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .execute('consulta_laboratorioensayo');

        logger.info(`Laboratorios retrieved: ${result.recordset.length} records`);
        return result.recordset;
    } catch (error) {
        logger.error('Error in getLaboratorios:', error);
        throw error;
    }
};

/**
 * Get tipos de entrega for Tipo de Entrega field
 */
export const getTiposEntrega = async () => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .execute('Maestro_Tipoentrega');

        logger.info(`Tipos de entrega retrieved: ${result.recordset.length} records`);
        return result.recordset;
    } catch (error) {
        logger.error('Error in getTiposEntrega:', error);
        throw error;
    }
};
