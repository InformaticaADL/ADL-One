import rutasPlanificadasService from '../services/rutas-planificadas.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

class RutasPlanificadasController {

    // ─── GRUPOS ────────────────────────────────────────────────────────────────

    async getGrupos(_req, res) {
        try {
            const grupos = await rutasPlanificadasService.getGrupos();
            return successResponse(res, grupos, 'Grupos obtenidos correctamente');
        } catch (error) {
            logger.error('Error fetching grupos rutas:', error);
            return errorResponse(res, 'Error al obtener los grupos', 500, error.message);
        }
    }

    async createGrupo(req, res) {
        try {
            const { nombre_grupo, descripcion } = req.body;
            if (!nombre_grupo) return errorResponse(res, 'El nombre del grupo es obligatorio', 400);
            const grupo = await rutasPlanificadasService.createGrupo({ nombre_grupo, descripcion });
            return successResponse(res, grupo, 'Grupo creado correctamente', 201);
        } catch (error) {
            logger.error('Error creando grupo:', error);
            // R-05: propagar mensaje y statusCode (ej. 409 si duplicado)
            return errorResponse(res, error.message || 'Error al crear el grupo', error.statusCode || 500);
        }
    }

    async updateGrupo(req, res) {
        try {
            const { id } = req.params;
            const { nombre_grupo, descripcion } = req.body;
            if (!nombre_grupo) return errorResponse(res, 'El nombre del grupo es obligatorio', 400);
            const grupo = await rutasPlanificadasService.updateGrupo(id, { nombre_grupo, descripcion });
            return successResponse(res, grupo, 'Grupo actualizado correctamente');
        } catch (error) {
            logger.error('Error actualizando grupo:', error);
            return errorResponse(res, error.message || 'Error al actualizar el grupo', error.statusCode || 500);
        }
    }

    async deleteGrupo(req, res) {
        try {
            const { id } = req.params;
            await rutasPlanificadasService.deleteGrupo(id);
            return successResponse(res, { deleted: true }, 'Grupo eliminado');
        } catch (error) {
            logger.error('Error eliminando grupo:', error);
            return errorResponse(res, 'Error al eliminar el grupo', 500, error.message);
        }
    }

    // ─── RUTAS ─────────────────────────────────────────────────────────────────

    async getAllRutas(_req, res) {
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
            if (!detalle) return errorResponse(res, 'Ruta no encontrada', 404);
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

    async updateRutaGrupo(req, res) {
        try {
            const { id } = req.params;
            const { id_grupo } = req.body;
            // R-05 fix: usar setGrupoOfRuta (antes se llamaba updateGrupo y chocaba con updateGrupo de grupos)
            const result = await rutasPlanificadasService.setGrupoOfRuta(id, id_grupo ?? null);
            return successResponse(res, result, 'Grupo actualizado correctamente');
        } catch (error) {
            logger.error('Error actualizando grupo de ruta:', error);
            return errorResponse(res, 'Error al actualizar el grupo', 500, error.message);
        }
    }

    async updateRuta(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;
            const user = req.user;
            if (!data.nombre_ruta || !data.fichas || data.fichas.length === 0) {
                return errorResponse(res, 'Faltan datos obligatorios (nombre_ruta, fichas)', 400);
            }
            const result = await rutasPlanificadasService.update(id, data, user);
            return successResponse(res, result, 'Ruta actualizada correctamente');
        } catch (error) {
            logger.error('Error actualizando ruta:', error);
            return errorResponse(res, 'Error al actualizar la ruta', 500, error.message);
        }
    }

    async cloneRuta(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const options = req.body || {};
            const result = await rutasPlanificadasService.clone(id, user, options);
            return successResponse(res, result, 'Ruta clonada correctamente', 201);
        } catch (error) {
            logger.error('Error clonando ruta:', error);
            return errorResponse(res, 'Error al clonar la ruta', 500, error.message);
        }
    }

    async deleteRuta(req, res) {
        try {
            const { id } = req.params;
            await rutasPlanificadasService.delete(id);
            return successResponse(res, { deleted: true }, 'Ruta eliminada');
        } catch (error) {
            logger.error('Error deleting ruta:', error);
            return errorResponse(res, error.message || 'Error al eliminar la ruta', 500, error.message);
        }
    }

    async asignarRuta(req, res) {
        try {
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
