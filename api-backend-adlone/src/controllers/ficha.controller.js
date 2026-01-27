import fichaService from '../services/ficha.service.js';
import logger from '../utils/logger.js';
import { successResponse, errorResponse } from '../utils/response.js';

class FichaIngresoController {
    async getAll(req, res) {
        try {
            const result = await fichaService.getAllFichas();
            return successResponse(res, result, 'Fichas obtenidas exitosamente');
        } catch (err) {
            logger.error('Error in getAll fichas controller:', err);
            return errorResponse(res, 'Error al obtener fichas', 500, err.message);
        }
    }

    async create(req, res) {
        try {
            // Basic validation
            if (!req.body.antecedentes || !req.body.analisis) {
                return errorResponse(res, 'Datos incompletos: Faltan antecedentes o análisis', 400);
            }

            const result = await fichaService.createFicha(req.body);
            return successResponse(res, result, 'Ficha creada exitosamente', 201);
        } catch (err) {
            logger.error('Error in create ficha controller:', err);
            return errorResponse(res, 'Error al crear la ficha de ingreso', 500, err.message);
        }
    }

    async getById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return errorResponse(res, 'ID de ficha requerido', 400);
            }

            logger.info(`Solicitando ficha ID: ${id}`);
            const result = await fichaService.getFichaById(id);
            if (!result) {
                return errorResponse(res, 'Ficha no encontrada', 404);
            }

            return successResponse(res, result, 'Ficha recuperada exitosamente');
        } catch (err) {
            logger.error('Error in getById ficha controller:', err);
            return errorResponse(res, 'Error al recuperar la ficha', 500, err.message);
        }
    }

    async approve(req, res) {
        try {
            const { id } = req.params;
            const { observaciones, user } = req.body;
            const userData = user || { id: 0 };

            const result = await fichaService.approveFicha(id, { observaciones }, userData);
            return successResponse(res, result, 'Ficha aceptada exitosamente');
        } catch (err) {
            logger.error('Error in approve ficha controller:', err);
            return errorResponse(res, 'Error al aceptar la ficha', 500, err.message);
        }
    }

    async reject(req, res) {
        try {
            const { id } = req.params;
            const { observaciones, user } = req.body;
            const userData = user || { id: 0 };

            const result = await fichaService.rejectFicha(id, { observaciones }, userData);
            return successResponse(res, result, 'Ficha rechazada exitosamente');
        } catch (err) {
            logger.error('Error in reject ficha controller:', err);
            return errorResponse(res, 'Error al rechazar la ficha', 500, err.message);
        }
    }

    async approveCoordinacion(req, res) {
        try {
            const { id } = req.params;
            const { observaciones, user } = req.body;
            const userData = user || { id: 0 };

            const result = await fichaService.approveCoordinacion(id, { observaciones }, userData);
            return successResponse(res, result, 'Ficha aceptada por coordinación exitosamente');
        } catch (err) {
            logger.error('Error in approveCoordinacion controller:', err);
            return errorResponse(res, 'Error al aceptar la ficha desde coordinación', 500, err.message);
        }
    }

    async reviewCoordinacion(req, res) {
        try {
            const { id } = req.params;
            const { observaciones, user } = req.body;
            const userData = user || { id: 0 };

            const result = await fichaService.reviewCoordinacion(id, { observaciones }, userData);
            return successResponse(res, result, 'Ficha enviada a revisión exitosamente');
        } catch (err) {
            logger.error('Error in reviewCoordinacion controller:', err);
            return errorResponse(res, 'Error al enviar la ficha a revisión', 500, err.message);
        }
    }

    async updateAgenda(req, res) {
        try {
            const { id } = req.params;
            const { idMuestreador, fecha, observaciones, user } = req.body;
            const userData = user || { id: 0 };

            const result = await fichaService.updateAgenda(id, { idMuestreador, fecha, observaciones }, userData);
            return successResponse(res, result, 'Agenda actualizada correctamente');
        } catch (err) {
            logger.error('Error in updateAgenda controller:', err);
            return errorResponse(res, 'Error al actualizar agenda', 500, err.message);
        }
    }

    async getForAssignment(req, res) {
        try {
            const result = await fichaService.getForAssignment();
            return successResponse(res, result, 'Fichas para asignación obtenidas exitosamente');
        } catch (err) {
            logger.error('Error in getForAssignment controller:', err);
            return errorResponse(res, 'Error al obtener fichas para asignación', 500, err.message);
        }
    }

    async getAssignmentDetail(req, res) {
        try {
            const { id } = req.params;
            const { idEstadoMuestreo } = req.query; // Optional query param

            // Default to '1' (Por Asignar) if not provided, or handle logic
            const estado = idEstadoMuestreo ? parseInt(idEstadoMuestreo) : 1;

            const result = await fichaService.getForAssignmentDetail(id, estado);
            return successResponse(res, result, 'Detalle de asignación obtenido exitosamente');
        } catch (err) {
            logger.error('Error in getAssignmentDetail controller:', err);
            return errorResponse(res, 'Error al obtener detalle de asignación', 500, err.message);
        }
    }

    async batchUpdateAgenda(req, res) {
        try {
            const userData = req.body.user || { id: 0 };
            const result = await fichaService.batchUpdateAgenda(req.body, userData);
            return successResponse(res, result, 'Asignaciones actualizadas exitosamente');
        } catch (err) {
            logger.error('Error in batchUpdateAgenda controller:', err);
            return errorResponse(res, 'Error al actualizar asignaciones', 500, err.message);
        }
    }
}

export default new FichaIngresoController();
