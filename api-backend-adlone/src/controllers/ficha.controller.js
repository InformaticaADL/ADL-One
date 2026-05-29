import fichaService from '../services/ficha.service.js';
import logger from '../utils/logger.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { resolverGoogleMapsLink } from '../utils/resolverGoogleMapsLink.js';

// In-memory cache for resolved Google short URLs (goo.gl always resolves to the same destination)
const resolvedUrlCache = new Map();

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
        const ALLOWED_HOSTS = new Set(['maps.google.com', 'www.google.com', 'goo.gl', 'maps.app.goo.gl']);
        try {
            const { url } = req.query;
            if (!url) {
                return successResponse(res, { finalUrl: null }, 'No URL provided');
            }
            let parsed;
            try { parsed = new URL(url); } catch {
                return errorResponse(res, 'URL inválida', 400);
            }
            if (!ALLOWED_HOSTS.has(parsed.hostname)) {
                return errorResponse(res, 'Dominio no permitido', 400);
            }

            // Return cached result immediately — goo.gl URLs never change destination
            if (resolvedUrlCache.has(url)) {
                return successResponse(res, { finalUrl: resolvedUrlCache.get(url), cached: true }, 'URL resolved (cached)');
            }

            const response = await fetch(url, { method: 'HEAD', redirect: 'follow' }).catch(() => null);
            const finalUrl = (response && response.url) ? response.url : url;
            resolvedUrlCache.set(url, finalUrl);
            return successResponse(res, { finalUrl }, 'URL resolved');
        } catch (err) {
            logger.error('Error resolving Google Maps URL:', err);
            return successResponse(res, { finalUrl: req.query.url }, 'Failed to resolve URL');
        }
    }

    async verificarLink(req, res) {
        try {
            const { link } = req.body;
            if (!link || typeof link !== 'string' || link.trim().length < 5) {
                return successResponse(res, { ok: false, motivo: 'invalido' });
            }
            const coords = await resolverGoogleMapsLink(link.trim());
            if (!coords) {
                return successResponse(res, { ok: false, motivo: 'no_extraible' });
            }
            return successResponse(res, { ok: true, lat: coords.lat, lon: coords.lon });
        } catch (err) {
            logger.error('Error in verificarLink:', err);
            return successResponse(res, { ok: false, motivo: 'no_extraible' });
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

            // Resolve Google Maps coordinates before saving
            const refGoogle = data.antecedentes?.refGoogle?.trim();
            let ubicacion_lat = null, ubicacion_lon = null;
            if (refGoogle) {
                try {
                    const coords = await resolverGoogleMapsLink(refGoogle);
                    if (coords) {
                        ubicacion_lat = coords.lat;
                        ubicacion_lon = coords.lon;
                    } else {
                        logger.info(`[ficha-create] referencia="${refGoogle}" coords=null reason="no_pattern_matched"`);
                    }
                } catch (e) {
                    logger.warn(`[ficha-create] Error resolving link: ${e.message}`);
                }
            }
            data.antecedentes = { ...data.antecedentes, ubicacion_lat, ubicacion_lon };

            const result = await fichaService.createFicha(data);
            return successResponse(res, { ...result, ubicacion_lat, ubicacion_lon }, 'Ficha creada exitosamente', 201);
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
            // Extract reactivating flag from payload; default to false if not present
            const { reactivating = false } = req.body;

            // Pass the flag along with the request body to the service
            const result = await fichaService.batchUpdateAgenda({
                ...req.body,
                reactivating
            }, userData);
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
            const updateData = { ...req.body };
            const userData = req.user || { id: 0 };

            // Resolve Google Maps coordinates on every edit
            const refGoogle = updateData.antecedentes?.refGoogle?.trim();
            let ubicacion_lat = null, ubicacion_lon = null;
            if (refGoogle) {
                try {
                    const coords = await resolverGoogleMapsLink(refGoogle);
                    if (coords) {
                        ubicacion_lat = coords.lat;
                        ubicacion_lon = coords.lon;
                    } else {
                        logger.info(`[ficha-update] id=${id} referencia="${refGoogle}" coords=null reason="no_pattern_matched"`);
                    }
                } catch (e) {
                    logger.warn(`[ficha-update] Error resolving link: ${e.message}`);
                }
            }
            updateData.antecedentes = { ...updateData.antecedentes, ubicacion_lat, ubicacion_lon };

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

    async updateRealizadoGem(req, res) {
        try {
            const { idAgendamam } = req.params;
            const { isRealizado } = req.body;
            const userData = req.user || { id: 0 };
            
            if (!idAgendamam) {
                return errorResponse(res, 'ID de agenda requerido', 400);
            }

            // Restrict to users with the GEM_REALIZADO permission
            const userPermissions = userData.permissions || [];
            const hasGemPermission = userPermissions.includes('GEM_REALIZADO');
            if (!hasGemPermission) {
                return errorResponse(res, 'No tienes permiso para realizar esta acción', 403);
            }

            const result = await fichaService.updateRealizadoGem(idAgendamam, userData, isRealizado);
            return successResponse(res, result, 'Estado de realizado actualizado exitosamente');
        } catch (err) {
            logger.error('Error in updateRealizadoGem controller:', err);
            return errorResponse(res, 'Error al actualizar estado realizado', 500, err.message);
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
            const userData = req.user || { id: 0 };
            
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
