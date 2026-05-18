import rutasEjecucionesService from '../services/rutas-ejecuciones.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

class RutasEjecucionesController {
    async getFichasDisponibles(req, res) {
        try {
            const { id } = req.params;
            const result = await rutasEjecucionesService.getFichasDisponibles(id);
            return successResponse(res, result, 'Fichas disponibles obtenidas');
        } catch (error) {
            logger.error('Error getting fichas disponibles:', error);
            return errorResponse(res, error.message || 'Error al obtener fichas disponibles', 500);
        }
    }

    async getEjecucionesByPlantilla(req, res) {
        try {
            const { id } = req.params;
            const ejecuciones = await rutasEjecucionesService.getEjecucionesByPlantilla(id);
            return successResponse(res, ejecuciones, 'Ejecuciones obtenidas');
        } catch (error) {
            logger.error('Error getting ejecuciones:', error);
            return errorResponse(res, 'Error al obtener ejecuciones', 500, error.message);
        }
    }

    async getEjecucionById(req, res) {
        try {
            const { id } = req.params;
            const ejec = await rutasEjecucionesService.getEjecucionById(id);
            if (!ejec) return errorResponse(res, 'Ejecución no encontrada', 404);
            return successResponse(res, ejec, 'Ejecución obtenida');
        } catch (error) {
            logger.error('Error getting ejecucion detail:', error);
            return errorResponse(res, 'Error al obtener la ejecución', 500, error.message);
        }
    }

    async createEjecucion(req, res) {
        try {
            const data = req.body;
            const user = req.user;

            if (!data.id_ruta_planificada || !data.fecha_ejecucion || !data.id_muestreador_inst) {
                return errorResponse(res, 'Faltan datos obligatorios (id_ruta_planificada, fecha_ejecucion, id_muestreador_inst)', 400);
            }
            if (!data.fichas || data.fichas.length === 0) {
                return errorResponse(res, 'Debe seleccionar al menos una ficha', 400);
            }

            const result = await rutasEjecucionesService.createEjecucion(data, user);
            return successResponse(res, result, 'Ejecución creada y fichas asignadas correctamente', 201);
        } catch (error) {
            logger.error('Error creating ejecucion:', error);
            return errorResponse(res, error.message || 'Error al crear la ejecución', 500);
        }
    }
}

export default new RutasEjecucionesController();
