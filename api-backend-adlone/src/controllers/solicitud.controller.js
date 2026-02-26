import solicitudService from '../services/solicitud.service.js';
import logger from '../utils/logger.js';

class SolicitudController {
    async create(req, res) {
        try {
            const { tipo_solicitud, datos_json, origen_solicitud } = req.body;
            const usuario_solicita = req.user?.id;

            if (!usuario_solicita) {
                return res.status(401).json({ message: 'Usuario no identificado' });
            }

            const result = await solicitudService.create({
                tipo_solicitud,
                datos_json,
                usuario_solicita,
                origen_solicitud
            });

            res.status(201).json(result);
        } catch (error) {
            logger.error('Controller Error creating solicitud:', error);
            res.status(500).json({ message: 'Error al crear la solicitud' });
        }
    }

    async reviewTechnical(req, res) {
        try {
            const { id } = req.params;
            const { estado_tecnica, feedback, datos_json } = req.body;
            const user = req.user;
            const perms = user?.permissions || [];

            // Verify permission: needs to be Technical Area (or Admin)
            const isMAMan = perms.includes('AI_MA_SOLICITUDES') || perms.includes('AI_MA_EQUIPOS') || perms.includes('MA_SOLICITUDES') || perms.includes('MA_EQUIPOS');
            const isSAMan = perms.includes('AI_MA_ADMIN_ACCESO') || perms.includes('MA_ADMIN_ACCESO');

            if (!isMAMan && !isSAMan) {
                return res.status(403).json({ message: 'No tiene permisos para revisión técnica' });
            }

            const usuario_tecnica = user.id;

            await solicitudService.reviewTechnical(id, {
                estado_tecnica,
                feedback,
                usuario_tecnica,
                datos_json
            });

            res.json({ success: true, message: 'Revisión técnica registrada' });
        } catch (error) {
            logger.error('Controller Error reviewing technical:', error);
            res.status(500).json({ message: 'Error al registrar revisión técnica' });
        }
    }

    async getAll(req, res) {
        try {
            const user = req.user;
            const perms = user?.permissions || [];
            let isSuperAdmin = perms.includes('AI_MA_ADMIN_ACCESO') || perms.includes('MA_ADMIN_ACCESO');
            let isGC = perms.includes('GC_ACCESO') || perms.includes('GC_EQUIPOS');
            let isMA = perms.includes('AI_MA_SOLICITUDES') || perms.includes('AI_MA_EQUIPOS') || perms.includes('MA_SOLICITUDES') || perms.includes('MA_EQUIPOS');
            let hasReportPermission = perms.includes('MA_A_REPORTES') || perms.includes('MA_A_REPORTES_DETALLE');
            let allowedSections = [];

            if (!isSuperAdmin && !isGC && !hasReportPermission && req.query.solo_mias !== 'true') {
                if (isMA) {
                    allowedSections.push('GEM', 'GER', 'MAM', 'MA', 'Medio Ambiente', 'AY', 'VI', 'PM', 'PA', 'CH', 'CM', 'CN', 'Terreno');
                }
                if (perms.includes('INF_NOTIF')) allowedSections.push('INF');

                // If no permission to see any section, return empty immediately
                if (allowedSections.length === 0) {
                    return res.json([]);
                }
            }

            const filters = {
                estado: req.query.estado,
                origen_solicitud: req.query.origen_solicitud, // Missing parameter restored
                usuario_solicita: req.query.solo_mias === 'true' ? req.user?.id : null,
                usuario_excluir: req.query.excluir_mias === 'true' ? req.user?.id : null,
                secciones: allowedSections.length > 0 ? allowedSections : null,
                siempre_incluir_usuario: req.user?.id,
                // NEW: Stricter restriction logic for linear flow visibility
                // Even SuperAdmins shouldn't see "Quality tasks" that are still in "Technical stage".
                // If the user has Quality permissions (including Admins), we restrict Muestreador PENDIENTE_TECNICA requests UNLESS they explicitly have Technical Area permissions.
                restrictTechnicalPending: isGC && !isMA
            };


            const solicitudes = await solicitudService.getSolicitudes(filters);
            res.json(solicitudes);
        } catch (error) {
            logger.error('Controller Error fetching solicitudes:', error);
            res.status(500).json({ message: 'Error al obtener las solicitudes' });
        }
    }

    async updateStatus(req, res) {
        try {
            const { id } = req.params;
            const { estado, feedback_admin, datos_json, id_equipo_procesado, accion_item } = req.body;
            const user = req.user;
            const perms = user?.permissions || [];

            // Check if user has ANY management permission
            const isSAMan = perms.includes('AI_MA_ADMIN_ACCESO') || perms.includes('MA_ADMIN_ACCESO');
            const isMAMan = perms.includes('AI_MA_SOLICITUDES') || perms.includes('AI_MA_EQUIPOS') || perms.includes('MA_SOLICITUDES') || perms.includes('MA_EQUIPOS') || perms.includes('MA_NOTIF_REC') || perms.includes('MA_NOTIF_ENV');
            const isGCMan = perms.includes('GC_ACCESO') || perms.includes('GC_EQUIPOS');
            const isINFMan = perms.includes('INF_NOTIF');

            if (!isSAMan && !isMAMan && !isGCMan && !isINFMan) {
                logger.warn(`User ${user?.id} attempted to update solicitud ${id} without permission`);
                return res.status(403).json({ message: 'No tiene permisos para procesar esta solicitud' });
            }

            const adminId = req.user?.id;

            const result = await solicitudService.updateStatus(id, estado, feedback_admin, adminId, datos_json, id_equipo_procesado, accion_item);
            res.json(result);
        } catch (error) {
            logger.error('Controller Error updating status:', error);
            res.status(500).json({ message: 'Error al actualizar el estado de la solicitud' });
        }
    }

    async acceptForReview(req, res) {
        try {
            const { id } = req.params;
            const user = req.user;
            const perms = user?.permissions || [];

            const isSAMan = perms.includes('AI_MA_ADMIN_ACCESO') || perms.includes('MA_ADMIN_ACCESO');
            const isMAMan = perms.includes('AI_MA_SOLICITUDES') || perms.includes('AI_MA_EQUIPOS') || perms.includes('MA_SOLICITUDES') || perms.includes('MA_EQUIPOS');

            if (!isSAMan && !isMAMan) {
                logger.warn(`User ${user?.id} attempted to accept solicitud ${id} without permission`);
                return res.status(403).json({ message: 'No tiene permisos para aceptar esta solicitud' });
            }

            const { feedback } = req.body;
            const usuarioTecnica = req.user?.id;
            const result = await solicitudService.acceptForReview(id, usuarioTecnica, feedback);
            res.json(result);
        } catch (error) {
            logger.error('Controller Error accepting for review:', error);
            res.status(500).json({ message: 'Error al aceptar la solicitud para revisión' });
        }
    }
}

export default new SolicitudController();
