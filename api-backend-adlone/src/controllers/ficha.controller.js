import fichaService from '../services/ficha.service.js';
import logger from '../utils/logger.js';
import { successResponse, errorResponse } from '../utils/response.js';

class FichaIngresoController {
    async getAll(_req, res) {
        try {
            const result = await fichaService.getAllFichas();
            return successResponse(res, result, 'Fichas obtenidas exitosamente');
        } catch (err) {
            logger.error('Error in getAll fichas controller:', err);
            return errorResponse(res, 'Error al obtener fichas', 500, err.message);
        }
    }

    async getEnProceso(req, res) {
        try {
            const { month, year } = req.query;
            const result = await fichaService.getEnProcesoFichas(month, year);
            return successResponse(res, result, 'Fichas en proceso obtenidas exitosamente');
        } catch (err) {
            logger.error('Error in getEnProceso fichas controller:', err);
            return errorResponse(res, 'Error al obtener fichas en proceso', 500, err.message);
        }
    }

    async resolveGoogleMaps(req, res) {
        try {
            const { url } = req.query;
            if (!url) {
                return successResponse(res, { finalUrl: null }, 'No URL provided');
            }
            // Fetch handles redirects automatically
            const response = await fetch(url, { method: 'HEAD', redirect: 'follow' }).catch(() => null);
            if (response && response.url) {
                return successResponse(res, { finalUrl: response.url }, 'URL resolved');
            }
            return successResponse(res, { finalUrl: url }, 'URL kept as is');
        } catch (err) {
            logger.error('Error resolving Google Maps URL:', err);
            return successResponse(res, { finalUrl: req.query.url }, 'Failed to resolve URL');
        }
    }

    async create(req, res) {
        try {
            // Basic validation
            if (!req.body.antecedentes || !req.body.analisis) {
                return errorResponse(res, 'Datos incompletos: Faltan antecedentes o análisis', 400);
            }

            // Inject authenticated user if available
            const data = { ...req.body };
            if (req.user) {
                data.user = req.user;
            }

            const result = await fichaService.createFicha(data);
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

    async getHistorial(req, res) {
        try {
            const { id } = req.params;
            const result = await fichaService.getHistorial(id);
            return successResponse(res, result, 'Historial recuperado exitosamente');
        } catch (err) {
            logger.error('Error in getHistorial controller:', err);
            return errorResponse(res, 'Error al obtener historial', 500, err.message);
        }
    }

    async approve(req, res) {
        try {
            const { id } = req.params;
            const { observaciones } = req.body;
            const userData = req.user || { id: 0 };

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
            const { observaciones } = req.body;
            const userData = req.user || { id: 0 };

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
            const { observaciones } = req.body;
            const userData = req.user || { id: 0 };

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
            const { observaciones } = req.body;
            const userData = req.user || { id: 0 };

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
            const { idMuestreador, fecha, observaciones } = req.body;
            const userData = req.user || { id: 0 };

            const result = await fichaService.updateAgenda(id, { idMuestreador, fecha, observaciones }, userData);
            return successResponse(res, result, 'Agenda actualizada correctamente');
        } catch (err) {
            logger.error('Error in updateAgenda controller:', err);
            return errorResponse(res, 'Error al actualizar agenda', 500, err.message);
        }
    }

    async getForAssignment(_req, res) {
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
            const userData = req.user || { id: 0 };
            const result = await fichaService.batchUpdateAgenda(req.body, userData);
            return successResponse(res, result, 'Asignaciones actualizadas exitosamente');
        } catch (err) {
            logger.error('Error in batchUpdateAgenda controller:', err);
            return errorResponse(res, 'Error al actualizar asignaciones', 500, err.message);
        }
    }

    async cancelSampling(req, res) {
        try {
            const { idAgenda, idFicha, motivo_cancelacion, idEstadoMuestreo } = req.body;
            const userData = req.user || { id: 0 };
            const result = await fichaService.cancelAgendaSampling(idAgenda, idFicha, userData, motivo_cancelacion, idEstadoMuestreo);
            return successResponse(res, result, 'Muestreo cancelado exitosamente');
        } catch (err) {
            logger.error('Error in cancelSampling controller:', err);
            return errorResponse(res, 'Error al cancelar el muestreo', 500, err.message);
        }
    }
    async update(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            const userData = req.user || { id: 0 };

            // Call service update method
            const result = await fichaService.updateFicha(id, updateData, userData);
            return successResponse(res, result, 'Ficha actualizada exitosamente');
        } catch (err) {
            logger.error('Error in update ficha controller:', err);
            return errorResponse(res, 'Error al actualizar la ficha', 500, err.message);
        }
    }

    async getSamplingEquipos(req, res) {
        try {
            const { id } = req.params;
            const { correlativo } = req.query;
            if (!id || !correlativo) {
                return errorResponse(res, 'ID de ficha y correlativo requeridos', 400);
            }

            const result = await fichaService.getSamplingEquipos(id, correlativo);
            return successResponse(res, result, 'Equipos del muestreo obtenidos exitosamente');
        } catch (err) {
            logger.error('Error in getSamplingEquipos controller:', err);
            return errorResponse(res, 'Error al obtener equipos del muestreo', 500, err.message);
        }
    }
    async downloadPdf(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return errorResponse(res, 'ID de ficha requerido', 400);
            }

            const pdfBuffer = await fichaService.generateFichaPdfBuffer(id);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="ficha_${id}.pdf"`);
            res.send(pdfBuffer);
            
        } catch (err) {
            logger.error('Error in downloadPdf ficha controller:', err);
            return errorResponse(res, 'Error al generar el PDF de la ficha', 500, err.message);
        }
    }

    async downloadExcel(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return errorResponse(res, 'ID de ficha requerido', 400);
            }

            const excelBuffer = await fichaService.generateFichaExcelBuffer(id);

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="ficha_${id}.xlsx"`);
            res.send(excelBuffer);
            
        } catch (err) {
            logger.error('Error in downloadExcel ficha controller:', err);
            return errorResponse(res, 'Error al generar el Excel de la ficha', 500, err.message);
        }
    }
    async getMuestreosEjecutados(_req, res) {
        try {
            const result = await fichaService.getMuestreosEjecutados();
            return successResponse(res, result, 'Muestreos ejecutados obtenidos exitosamente');
        } catch (err) {
            logger.error('Error in getMuestreosEjecutados controller:', err);
            return errorResponse(res, 'Error al obtener muestreos ejecutados', 500, err.message);
        }
    }

    async getExecutionDetail(req, res) {
        try {
            const { id } = req.params;
            const { correlativo } = req.query;
            if (!id || !correlativo) {
                return errorResponse(res, 'ID de ficha y correlativo requeridos', 400);
            }

            const result = await fichaService.getExecutionDetail(id, correlativo);
            return successResponse(res, result, 'Detalle de ejecución obtenido exitosamente');
        } catch (err) {
            logger.error('Error in getExecutionDetail controller:', err);
            return errorResponse(res, 'Error al obtener detalle de ejecución', 500, err.message);
        }
    }

    async enviarDocumentoManual(req, res) {
        try {
            const { idFicha, correlativo, documento, to, cc } = req.body;
            const userData = req.user || req.body.user || { id: 0 };
            
            if (!idFicha || !correlativo || !documento) {
                return errorResponse(res, 'Faltan datos requeridos (idFicha, correlativo, documento)', 400);
            }

            const result = await fichaService.enviarDocumentosManual({ 
                idFicha, 
                correlativo, 
                documento, 
                to, 
                cc, 
                user: userData 
            });
            
            return successResponse(res, result, 'Documento enviado exitosamente');
        } catch (err) {
            logger.error('Error in enviarDocumentoManual controller:', err);
            return errorResponse(res, 'Error al enviar el documento', 500, err.message);
        }
    }
}

export default new FichaIngresoController();
