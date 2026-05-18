import ursService from '../services/urs.service.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { getConnection } from '../config/database.js';
import sql from 'mssql';

// Returns true if user can act on a request:
// - Admin (AI_MA_ADMIN_ACCESO)
// - Creator of the request
// - Has GESTION permission for the request type (explicit or via role)
// - Is the current derivation target
async function canActOnRequest(idSolicitud, reqUser) {
    if (reqUser.permissions?.includes('AI_MA_ADMIN_ACCESO')) return true;
    try {
        const pool = await getConnection();
        const res = await pool.request()
            .input('id', sql.Numeric(10, 0), idSolicitud)
            .input('userId', sql.Numeric(10, 0), reqUser.id)
            .query(`
                SELECT 1 as ok FROM mae_solicitud WHERE id_solicitud = @id AND id_solicitante = @userId

                UNION

                -- GESTION permission via rel_solicitud_tipo_permiso (explicit user or via role)
                SELECT 1 FROM mae_solicitud s
                JOIN rel_solicitud_tipo_permiso p ON p.id_tipo = s.id_tipo AND p.tipo_acceso = 'GESTION'
                LEFT JOIN rel_usuario_rol ur ON (p.id_rol = ur.id_rol AND ur.id_usuario = @userId)
                WHERE s.id_solicitud = @id
                AND (p.id_usuario = @userId OR ur.id_rol IS NOT NULL)

                UNION

                -- Current derivation target (user or via role)
                SELECT 1 FROM mae_solicitud_derivacion d
                LEFT JOIN rel_usuario_rol ur_d ON (d.id_rol_destino = ur_d.id_rol AND ur_d.id_usuario = @userId)
                WHERE d.id_solicitud = @id
                AND (d.usuario_destino = @userId OR ur_d.id_rol IS NOT NULL)
                AND d.fecha = (SELECT MAX(fecha) FROM mae_solicitud_derivacion WHERE id_solicitud = @id)
            `);
        return res.recordset.length > 0;
    } catch { return false; }
}

class UrsController {
    async getTypes(req, res) {
        try {
            const { all } = req.query;
            const userId = all === 'true' ? null : req.user.id;
            const isAdmin = req.user.permissions?.includes('AI_MA_ADMIN_ACCESO');
            const types = await ursService.getTypes(all !== 'true', userId, isAdmin);
            res.json(types);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener tipos de solicitud' });
        }
    }

    async createUpdateType(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;
            const result = await ursService.createUpdateType(id || null, data);
            res.json(result);
        } catch (error) {
            logger.error('Error in UrsController.createUpdateType:', error);
            res.status(500).json({ error: 'Error al guardar el tipo de solicitud' });
        }
    }

    async toggleTypeStatus(req, res) {
        try {
            const { id } = req.params;
            const { estado } = req.body;
            await ursService.toggleTypeStatus(id, estado);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Error al cambiar estado del tipo' });
        }
    }

    async createRequest(req, res) {
        try {
            // Support both direct JSON or FormData (which might use datos_json or strings)
            let { id_tipo, datos, datos_json, prioridad, area_actual, observaciones } = req.body;
            const id_solicitante = req.user.id;

            // Fallback for field name mismatch
            const finalDatos = datos || datos_json;

            if (!id_tipo || !finalDatos) {
                return res.status(400).json({ error: 'ID de tipo y datos son requeridos' });
            }

            // If it's a string (from FormData), parse it
            let parsedDatos = finalDatos;
            if (typeof finalDatos === 'string') {
                try {
                    parsedDatos = JSON.parse(finalDatos);
                } catch (e) {
                    return res.status(400).json({ error: 'Formato de datos inválido (JSON mal formado)' });
                }
            }

            const solicitud = await ursService.createRequest(id_tipo, id_solicitante, parsedDatos, prioridad, area_actual, observaciones, req.files);
            res.status(201).json(solicitud);
        } catch (error) {
            logger.error('Error en UrsController.createRequest:', error);
            res.status(500).json({ error: 'Error al crear la solicitud' });
        }
    }

    async getRequests(req, res) {
        try {
            const { estado, area_actual, mías } = req.query;
            const filtros = { estado, area_actual };
            
            if (mías === 'true') {
                filtros.id_solicitante = req.user.id;
            }

            const isAdmin = req.user.permissions?.includes('AI_MA_ADMIN_ACCESO');
            const solicitudes = await ursService.getRequests(filtros, req.user.id, isAdmin);
            res.json(solicitudes);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener solicitudes' });
        }
    }

    async getRequestById(req, res) {
        try {
            const { id } = req.params;
            const solicitud = await ursService.getRequestById(id, req.user.id);
            if (!solicitud) return res.status(404).json({ error: 'Solicitud no encontrada' });
            res.json(solicitud);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener detalle de solicitud' });
        }
    }

    async updateStatus(req, res) {
        try {
            const { id } = req.params;
            const estado = req.body.status || req.body.estado;
            const observaciones = req.body.comment || req.body.observaciones || '';
            const idUsuario = req.user.id;
            const isAdmin = req.user.permissions?.includes('AI_MA_ADMIN_ACCESO');

            // CANCELADA: only the creator or admin can cancel, and only from PENDIENTE
            if (estado === 'CANCELADA') {
                const pool = await getConnection();
                const check = await pool.request()
                    .input('id', sql.Numeric(10, 0), id)
                    .input('userId', sql.Numeric(10, 0), idUsuario)
                    .query(`SELECT estado, id_solicitante FROM mae_solicitud WHERE id_solicitud = @id`);

                if (!check.recordset.length) return res.status(404).json({ error: 'Solicitud no encontrada' });
                const { estado: estadoActual, id_solicitante } = check.recordset[0];

                if (!isAdmin && Number(id_solicitante) !== Number(idUsuario)) {
                    return res.status(403).json({ error: 'Solo el solicitante puede cancelar su propia solicitud' });
                }
                if (estadoActual !== 'PENDIENTE') {
                    return res.status(400).json({ error: 'Solo se puede cancelar una solicitud en estado PENDIENTE' });
                }
            } else {
                if (!await canActOnRequest(id, req.user)) {
                    return res.status(403).json({ error: 'No autorizado para modificar esta solicitud' });
                }
            }

            const solicitud = await ursService.updateStatus(id, estado, idUsuario, observaciones);
            res.json(solicitud);
        } catch (error) {
            res.status(500).json({ error: 'Error al actualizar estado' });
        }
    }

    async addComment(req, res) {
        try {
            const { id } = req.params;
            const { mensaje, es_privado } = req.body;
            const idUsuario = req.user.id;

            const comentario = await ursService.addComment(id, idUsuario, mensaje, es_privado, req.files);
            res.json(comentario);
        } catch (error) {
            res.status(500).json({ error: 'Error al agregar comentario' });
        }
    }

    async derive(req, res) {
        try {
            const { id } = req.params;
            if (!await canActOnRequest(id, req.user)) {
                return res.status(403).json({ error: 'No autorizado para derivar esta solicitud' });
            }
            const areaDestino = req.body.area || req.body.area_destino || 'DERIVACION';
            const usuarioDestino = req.body.userId || req.body.id_usuario_destino;
            const finalRolId = req.body.roleId || req.body.id_rol_destino;
            const motivo = req.body.comment || req.body.motivo || '';
            const idUsuarioOrigen = req.user.id;

            const solicitud = await ursService.derive(id, idUsuarioOrigen, areaDestino, usuarioDestino, motivo, finalRolId);
            res.json(solicitud);
        } catch (error) {
            logger.error('Error al derivar solicitud:', error);
            res.status(500).json({ error: 'Error al derivar solicitud' });
        }
    }

    // --- Granular Permissions (Phase 10) ---

    async getPermissions(req, res) {
        try {
            const { id } = req.params;
            const data = await ursService.getPermissions(id);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener permisos' });
        }
    }

    async addPermission(req, res) {
        try {
            const { id } = req.params;
            const result = await ursService.addPermission(id, req.body);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: 'Error al agregar permiso' });
        }
    }

    async removePermission(req, res) {
        try {
            const { idRelacion } = req.params;
            await ursService.removePermission(idRelacion);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar permiso' });
        }
    }

    async getDerivationTargets(req, res) {
        try {
            const { id } = req.params;
            const data = await ursService.getDerivationTargets(id);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener destinos de derivación' });
        }
    }

    async getNotificationConfig(req, res) {
        try {
            const { id } = req.params;
            const data = await ursService.getNotificationConfig(id);
            res.json(data);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener configuración de notificaciones' });
        }
    }

    async saveNotificationConfig(req, res) {
        try {
            const { id } = req.params;
            const result = await ursService.saveNotificationConfig(id, req.body);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: 'Error al guardar configuración de notificaciones' });
        }
    }
    async downloadAttachment(req, res) {
        try {
            const { idAdjunto } = req.params;
            const adjunto = await ursService.getAttachmentById(idAdjunto);

            if (!adjunto) {
                return res.status(404).json({ error: 'Archivo no encontrado' });
            }

            const baseDir = path.resolve(process.env.UPLOAD_PATH || 'uploads');
            const filePath = path.resolve(baseDir, adjunto.ruta_archivo);

            if (!filePath.startsWith(baseDir + path.sep) && filePath !== baseDir) {
                return res.status(403).json({ error: 'Acceso denegado' });
            }

            if (!fs.existsSync(filePath)) {
                logger.error(`File physically missing: ${filePath}`);
                return res.status(404).json({ error: 'El archivo físico no existe en el servidor' });
            }

            res.download(filePath, adjunto.nombre_archivo);
        } catch (error) {
            logger.error('Error in downloadAttachment:', error);
            res.status(500).json({ error: 'Error al procesar la descarga' });
        }
    }
}

export default new UrsController();
