import rutasPlanificadasService from '../services/rutas-planificadas.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

class RutasPlanificadasController {
    async getAllRutas(req, res) {
        try {
            const rutas = await rutasPlanificadasService.getAll();
            return successResponse(res, rutas, 'Rutas obtenidas correctamente');
        } catch (error) {
            logger.error('Error fetching rutas planificadas:', error);
            return errorResponse(res, 'Error al obtener las rutas', 500, error.message);
        }
    }

    async getRutaDetalle(req, res) {
        try {
            const { id } = req.params;
            const detalle = await rutasPlanificadasService.getById(id);
            if (!detalle) {
                return errorResponse(res, 'Ruta no encontrada', 404);
            }
            return successResponse(res, detalle, 'Detalle de ruta obtenido');
        } catch (error) {
            logger.error(`Error fetching ruta ${req.params.id}:`, error);
            return errorResponse(res, 'Error al obtener la ruta', 500, error.message);
        }
    }

    async createRuta(req, res) {
        try {
            const data = req.body;
            const user = req.user;
            
            if (!data.nombre_ruta || !data.fichas || data.fichas.length === 0) {
                return errorResponse(res, 'Faltan datos obligatorios (nombre_ruta, fichas)', 400);
            }

            const result = await rutasPlanificadasService.create(data, user);
            return successResponse(res, result, 'Ruta guardada correctamente', 201);
        } catch (error) {
            logger.error('Error creando ruta:', error);
            return errorResponse(res, 'Error al crear la ruta', 500, error.message);
        }
    }

    async deleteRuta(req, res) {
        try {
            const { id } = req.params;
            await rutasPlanificadasService.delete(id);
            return successResponse(res, { deleted: true }, 'Ruta eliminada');
        } catch (error) {
            logger.error('Error deleting ruta:', error);
            return errorResponse(res, 'Error al eliminar la ruta', 500, error.message);
        }
    }

    async asignarRuta(req, res) {
        try {
            // Este endpoint tomará el ID de la ruta planificada, y los parámetros de asignación
            // (fecha, instalador, retirador) y usará ficha.service.js para agendarlos masivamente.
            // Una vez asignada, la ruta cambiará a estado ASIGNADA.
            const { id } = req.params;
            const assignmentParams = req.body;
            const user = req.user;
            
            const result = await rutasPlanificadasService.asignar(id, assignmentParams, user);
            return successResponse(res, result, 'Ruta asignada exitosamente');
        } catch (error) {
            logger.error('Error asignando ruta:', error);
            return errorResponse(res, 'Error al asignar la ruta', 500, error.message);
        }
    }
}

export default new RutasPlanificadasController();
