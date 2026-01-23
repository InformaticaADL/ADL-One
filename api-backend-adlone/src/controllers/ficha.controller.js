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
}

export default new FichaIngresoController();
