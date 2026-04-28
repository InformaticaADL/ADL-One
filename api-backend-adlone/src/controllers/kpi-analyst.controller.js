import { errorResponse, successResponse } from '../utils/response.js';
import logger from '../utils/logger.js';
import * as kpiAnalystService from '../services/kpi-analyst.service.js';

export const getDashboardKpis = async (req, res) => {
    try {
        const forceRefresh = req.query.refresh === 'true';
        const snapshot = await kpiAnalystService.getSnapshot({ forceRefresh });
        return successResponse(res, snapshot, 'Dashboard KPI generado correctamente');
    } catch (error) {
        logger.error('Error in getDashboardKpis controller:', error);
        return errorResponse(res, 'No fue posible generar el dashboard KPI', 500);
    }
};

export const executeDashboardKpis = async (req, res) => {
    try {
        const snapshot = await kpiAnalystService.runAnalysis({
            mode: 'manual',
            windowDays: req.body?.windowDays,
        });
        return successResponse(res, snapshot, 'Ejecucion manual completada');
    } catch (error) {
        logger.error('Error in executeDashboardKpis controller:', error);
        return errorResponse(res, 'No fue posible ejecutar el agente analista', 500);
    }
};

export const registerDashboardKpiEvent = async (req, res) => {
    try {
        const snapshot = await kpiAnalystService.notifyEvent(req.body || {});
        return successResponse(res, snapshot, 'Evento procesado correctamente');
    } catch (error) {
        logger.error('Error in registerDashboardKpiEvent controller:', error);
        return errorResponse(res, 'No fue posible procesar el evento', 500);
    }
};

export const getDashboardKpiStatus = async (_req, res) => {
    try {
        const status = kpiAnalystService.getAgentStatus();
        return successResponse(res, status, 'Estado del agente obtenido correctamente');
    } catch (error) {
        logger.error('Error in getDashboardKpiStatus controller:', error);
        return errorResponse(res, 'No fue posible obtener el estado del agente', 500);
    }
};

export const analyzeExcelDashboard = async (req, res) => {
    try {
        if (!req.file?.buffer) {
            return errorResponse(res, 'Debe adjuntar un archivo Excel', 400);
        }

        const analysis = await kpiAnalystService.analyzeExcelBuffer(req.file.buffer, req.file.originalname);
        return successResponse(res, analysis, 'Excel analizado correctamente');
    } catch (error) {
        logger.error('Error in analyzeExcelDashboard controller:', error);
        return errorResponse(res, 'No fue posible analizar el Excel', 500);
    }
};
