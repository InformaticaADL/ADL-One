import SolicitudesProxyService from '../services/solicitudesProxy.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import sql from 'mssql';
import { getConnection } from '../config/database.js';
import { getIo } from '../utils/socketManager.js';

export async function listar(req, res) {
    try {
        const rows = await SolicitudesProxyService.listar(req.user.id);
        successResponse(res, rows);
    } catch (e) {
        errorResponse(res, e.message, 500);
    }
}

export async function detalle(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return errorResponse(res, 'Id inválido.', 400);
        const row = await SolicitudesProxyService.detalle(id);
        if (!row) return errorResponse(res, 'Solicitud no encontrada.', 404);
        successResponse(res, row);
    } catch (e) {
        errorResponse(res, e.message, 500);
    }
}

export async function responder(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return errorResponse(res, 'Id inválido.', 400);
        const { texto } = req.body || {};
        if (!texto || !String(texto).trim()) return errorResponse(res, 'Escribe un mensaje.', 400);
        const result = await SolicitudesProxyService.responder(id, {
            texto: String(texto).trim(),
            // El JWT de ADL ONE guarda el nombre real en `name` y el login en `username`
            // (ver auth.service.js: name: user.usuario, username: user.nombre_usuario) —
            // no existen campos `nombre`/`usuario`/`email` en el payload.
            autorNombre: req.user.name || req.user.username || null,
            autorEmail:  null,
        });
        successResponse(res, result);
    } catch (e) {
        errorResponse(res, e.message, 500);
    }
}

export async function cambiarEstado(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return errorResponse(res, 'Id inválido.', 400);
        const { estado } = req.body || {};
        if (!estado) return errorResponse(res, 'estado es requerido.', 400);
        const result = await SolicitudesProxyService.cambiarEstado(id, estado);
        successResponse(res, result);
    } catch (e) {
        errorResponse(res, e.message, 500);
    }
}

export async function tomar(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return errorResponse(res, 'Id inválido.', 400);
        const result = await SolicitudesProxyService.tomar(id, {
            autorNombre: req.user.name || req.user.username || null,
            autorEmail:  null,
        });
        successResponse(res, result);
    } catch (e) {
        errorResponse(res, e.message, 500);
    }
}

/**
 * POST /api/solicitudes-clientes/interno/aviso — lo llama WebClientesV2 (servidor a servidor) justo después de escribir
 * los avisos de una solicitud en mae_notificacion. Emite cada aviso por el socket de su destinatario para que salga en
 * vivo (aviso emergente, campana y contador) sin esperar al refresco. Solo emite avisos ya existentes de tipo
 * solicitud_cliente: la llamada no puede crear ni inventar notificaciones.
 */
export async function avisoInterno(req, res) {
    try {
        const ids = (Array.isArray(req.body?.ids) ? req.body.ids : [])
            .map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 100);
        if (!ids.length) return errorResponse(res, 'ids es requerido.', 400);
        const pool = await getConnection();
        const request = pool.request();
        ids.forEach((id, i) => request.input('i' + i, sql.Numeric(10, 0), id));
        const r = await request.query(`
            SELECT id_notificacion, id_usuario, titulo, mensaje, tipo, id_referencia, area, fecha_creacion
            FROM dbo.mae_notificacion
            WHERE tipo = 'solicitud_cliente' AND id_notificacion IN (${ids.map((_, i) => '@i' + i).join(',')})`);
        let io = null;
        try { io = getIo(); } catch { /* socket no inicializado: los avisos igual están en la base */ }
        if (io) {
            for (const n of r.recordset) {
                io.to(`user_${n.id_usuario}`).emit('nuevaNotificacion', {
                    id_notificacion: n.id_notificacion,
                    id_usuario: n.id_usuario,
                    titulo: n.titulo,
                    mensaje: n.mensaje,
                    tipo: n.tipo,
                    id_referencia: n.id_referencia,
                    area: n.area,
                    fecha_creacion: n.fecha_creacion,
                });
            }
        }
        successResponse(res, { emitidos: io ? r.recordset.length : 0 });
    } catch (e) {
        errorResponse(res, e.message, 500);
    }
}
