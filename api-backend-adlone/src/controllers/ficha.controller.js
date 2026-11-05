import fichaService from '../services/ficha.service.js';
import logger from '../utils/logger.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { resolverGoogleMapsLink } from '../utils/resolverGoogleMapsLink.js';

// In-memory cache for resolved Google short URLs (goo.gl always resolves to the same destination)
const resolvedUrlCache = new Map();

// Varios coordinadores trabajan en simultáneo sobre el mismo calendario — sin esto, cada uno solo
// ve los cambios de los demás al recargar la página manualmente. Se emite a TODOS los clientes
// conectados (no a una room específica) porque cualquier coordinador puede estar mirando cualquier
// mes/vista del calendario en ese momento.
function notificarCalendarioActualizado() {
    if (global.io) global.io.emit('calendario:actualizado');
}

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

    async getDefaultAnalyses(_req, res) {
        try {
            const result = await fichaService.getDefaultTerrenoAnalyses();
            return successResponse(res, result, 'Análisis fijos por defecto');
        } catch (err) {
            logger.error('Error in getDefaultAnalyses controller:', err);
            return errorResponse(res, 'Error al obtener análisis por defecto', 500, err.message);
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
            notificarCalendarioActualizado();
            return successResponse(res, { ...result, ubicacion_lat, ubicacion_lon }, 'Ficha creada exitosamente', 201);
        } catch (err) {
            logger.error('Error in create ficha controller:', err);
            return errorResponse(res, 'Error al crear la ficha de ingreso', 500, err.message);
        }
    }

    // Visita con varios puntos: crea una ficha por punto (cada punto puede traer sus propios antecedentes y análisis; el costo
    // operativo se reparte entre los puntos) y las agrupa.
    async createGrupo(req, res) {
        try {
            if (!req.body.antecedentes || !req.body.analisis) {
                return errorResponse(res, 'Datos incompletos: Faltan antecedentes o análisis', 400);
            }
            const data = { ...req.body };
            if (req.user) data.user = req.user;

            // Coordenadas de cada punto a partir de su enlace de Google Maps (igual que en la creación simple).
            const resolver = async (ref) => {
                const link = String(ref || '').trim();
                if (!link) return { lat: null, lon: null };
                try {
                    const coords = await resolverGoogleMapsLink(link);
                    return coords ? { lat: coords.lat, lon: coords.lon } : { lat: null, lon: null };
                } catch (e) {
                    logger.warn(`[ficha-create-grupo] Error resolving link: ${e.message}`);
                    return { lat: null, lon: null };
                }
            };
            const base = await resolver(data.antecedentes?.refGoogle);
            data.antecedentes = { ...data.antecedentes, ubicacion_lat: base.lat, ubicacion_lon: base.lon };
            if (Array.isArray(data.puntosAdicionales)) {
                data.puntosAdicionales = await Promise.all(data.puntosAdicionales.map(async (p) => {
                    const c = await resolver(p.refGoogle);
                    return { ...p, ubicacion_lat: c.lat, ubicacion_lon: c.lon };
                }));
            }

            const result = await fichaService.createFichaGrupo(data);
            notificarCalendarioActualizado();
            return successResponse(res, result, result.message || 'Ficha creada exitosamente', 201);
        } catch (err) {
            logger.error('Error in createGrupo ficha controller:', err);
            return errorResponse(res, err.statusCode ? err.message : 'Error al crear la visita con varios puntos', err.statusCode || 500, err.message);
        }
    }

    async agrupar(req, res) {
        try {
            const result = await fichaService.agruparFichas({ ids: req.body?.ids, user: req.user, nota: req.body?.nota });
            notificarCalendarioActualizado();
            return successResponse(res, result, 'Fichas agrupadas');
        } catch (err) {
            logger.error('Error in agrupar fichas controller:', err);
            return errorResponse(res, err.statusCode ? err.message : 'Error al agrupar las fichas', err.statusCode || 500, err.message);
        }
    }

    async desagrupar(req, res) {
        try {
            const result = await fichaService.desagruparGrupo(req.body?.id_grupo, req.user);
            notificarCalendarioActualizado();
            return successResponse(res, result, 'Grupo deshecho');
        } catch (err) {
            logger.error('Error in desagrupar controller:', err);
            return errorResponse(res, err.statusCode ? err.message : 'Error al deshacer el grupo', err.statusCode || 500, err.message);
        }
    }

    // Otros puntos de la visita que comparten un muestreo (para cancelarlos juntos desde el calendario).
    async getPuntosVisita(req, res) {
        try {
            const modo = req.query.modo === 'ejecutados' ? 'ejecutados' : 'cancelables';
            const result = await fichaService.getPuntosDeVisitaDeAgenda(req.params.idAgendamam, modo);
            return successResponse(res, result, 'Puntos de la visita');
        } catch (err) {
            logger.error('Error in getPuntosVisita controller:', err);
            return errorResponse(res, err.statusCode ? err.message : 'Error al obtener los puntos de la visita', err.statusCode || 500, err.message);
        }
    }

    async getAcompanante(req, res) {
        try {
            return successResponse(res, await fichaService.getAcompananteVisita(req.params.id), 'Acompañante de la visita');
        } catch (err) {
            logger.error('Error in getAcompanante controller:', err);
            return errorResponse(res, 'Error al obtener el acompañante', 500, err.message);
        }
    }

    async setAcompanante(req, res) {
        try {
            const result = await fichaService.setAcompananteVisita(req.params.id, req.body?.id_muestreador, req.user);
            return successResponse(res, result, 'Acompañante guardado');
        } catch (err) {
            logger.error('Error in setAcompanante controller:', err);
            return errorResponse(res, err.statusCode ? err.message : 'Error al guardar el acompañante', err.statusCode || 500, err.message);
        }
    }

    async getGrupo(req, res) {
        try {
            const result = await fichaService.getGrupoDeFicha(req.params.id);
            return successResponse(res, result, 'Grupo de la ficha');
        } catch (err) {
            logger.error('Error in getGrupo controller:', err);
            return errorResponse(res, 'Error al obtener el grupo', 500, err.message);
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

    // Aprueba todos los puntos de la visita de la ficha (etapa técnica o de coordinación)
    async aprobarVisita(req, res) {
        try {
            const { id } = req.params;
            const { observaciones } = req.body;
            const etapa = req.params.etapa === 'coordinacion' ? 'coordinacion' : 'tecnica';
            const userData = req.user || { id: 0 };
            const result = await fichaService.aprobarVisita(id, { observaciones, etapa }, userData);
            return successResponse(res, result, 'Visita aprobada');
        } catch (err) {
            logger.error('Error in aprobarVisita controller:', err);
            return errorResponse(res, err.statusCode ? err.message : 'Error al aprobar la visita', err.statusCode || 500, err.message);
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
            notificarCalendarioActualizado();
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
                user: userData,
                reactivating
            });
            notificarCalendarioActualizado();
            return successResponse(res, result, 'Asignaciones actualizadas exitosamente');
        } catch (err) {
            logger.error('Error in batchUpdateAgenda controller:', err);
            return errorResponse(res, 'Error al actualizar asignaciones', 500, err.message);
        }
    }

    async cancelSampling(req, res) {
        try {
            const { idAgenda, idFicha, motivo_cancelacion, idMotivoCancelacion, tambien } = req.body;
            const userData = req.user || { id: 0 };

            // Otros puntos de la misma visita que se cancelan junto con este (mismo muestreo, mismo motivo y observación).
            const extras = Array.isArray(tambien) ? [...new Set(tambien.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : [];
            let permitidos = new Map();
            if (extras.length > 0) {
                const lista = await fichaService.getPuntosDeVisitaDeAgenda(idAgenda);
                permitidos = new Map(lista.map((p) => [p.id_agenda, p]));
                if (extras.some((id) => !permitidos.has(id))) {
                    return errorResponse(res, 'Alguno de los puntos indicados no pertenece a esta visita o ya no se puede cancelar', 400);
                }
            }

            const nombresExtras = extras.map((id) => permitidos.get(id).punto || `ficha ${permitidos.get(id).id_ficha}`);
            const obsPrincipal = extras.length > 0
                ? `${String(motivo_cancelacion || '').trim()} (se cancelan también los puntos: ${nombresExtras.join(', ')})`
                : motivo_cancelacion;
            const result = await fichaService.cancelAgendaSampling(idAgenda, idFicha, userData, obsPrincipal, idMotivoCancelacion);

            const cancelados = [Number(idAgenda)];
            const fallidos = [];
            for (const id of extras) {
                const p = permitidos.get(id);
                try {
                    await fichaService.cancelAgendaSampling(p.id_agenda, p.id_ficha, userData,
                        `${String(motivo_cancelacion || '').trim()} (cancelado junto con otros puntos de la visita)`, idMotivoCancelacion, { sinNotificar: true });
                    cancelados.push(id);
                } catch (e) {
                    logger.warn(`[cancel-sampling] no se pudo cancelar el punto ${p.punto || p.id_ficha}: ${e.message}`);
                    fallidos.push({ id_agenda: id, punto: p.punto || null, error: e.message });
                }
            }
            notificarCalendarioActualizado();
            return successResponse(res, { ...result, cancelados, fallidos },
                fallidos.length > 0 ? 'Muestreo cancelado, pero algunos puntos de la visita no se pudieron cancelar' : 'Muestreo cancelado exitosamente');
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
            notificarCalendarioActualizado();
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
    async getMuestreosEjecutados(req, res) {
        try {
            const result = await fichaService.getMuestreosEjecutados(req.user);
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
            notificarCalendarioActualizado();
            return successResponse(res, result, 'Estado de realizado actualizado exitosamente');
        } catch (err) {
            logger.error('Error in updateRealizadoGem controller:', err);
            return errorResponse(res, 'Error al actualizar estado realizado', 500, err.message);
        }
    }

    async updateCasoAdlab(req, res) {
        try {
            const { idAgendamam } = req.params;
            const { casoAdlab } = req.body;

            if (!idAgendamam) {
                return errorResponse(res, 'ID de agenda requerido', 400);
            }
            if (!casoAdlab || typeof casoAdlab !== 'string' || casoAdlab.trim().length === 0) {
                return errorResponse(res, 'El código de caso (caso_adlab) es obligatorio', 400);
            }
            if (casoAdlab.trim().length > 10) {
                return errorResponse(res, 'El código de caso no puede superar los 10 caracteres', 400);
            }

            const result = await fichaService.updateCasoAdlab(idAgendamam, casoAdlab.trim());
            return successResponse(res, result, 'Código de caso asignado exitosamente');
        } catch (err) {
            logger.error('Error in updateCasoAdlab controller:', err);
            return errorResponse(res, err.message || 'Error al asignar el código de caso', 500, err.message);
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

    async regenerarDocumentos(req, res) {
        try {
            const { id_agendamam, foma, cadena } = req.body;
            if (!id_agendamam) {
                return errorResponse(res, 'id_agendamam requerido', 400);
            }

            const result = await fichaService.regenerarDocumentos(id_agendamam, {
                foma: !!foma,
                cadena: !!cadena,
            });

            return successResponse(res, result, 'Regeneración de documentos procesada');
        } catch (err) {
            logger.error('Error in regenerarDocumentos controller:', err);
            return errorResponse(res, 'Error al regenerar documentos', 500, err.message);
        }
    }

    async notificarMuestreoCompletado(req, res) {
        try {
            const { frecuencia_correlativo } = req.body;
            if (!frecuencia_correlativo) {
                return errorResponse(res, 'frecuencia_correlativo requerido', 400);
            }

            const result = await fichaService.notificarMuestreoCompletado(frecuencia_correlativo);
            return successResponse(res, result, 'Notificación procesada');
        } catch (err) {
            logger.error('Error in notificarMuestreoCompletado controller:', err);
            return errorResponse(res, 'Error al notificar muestreo completado', 500, err.message);
        }
    }
}

export default new FichaIngresoController();
