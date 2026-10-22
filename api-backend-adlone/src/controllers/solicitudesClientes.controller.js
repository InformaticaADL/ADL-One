import SolicitudesProxyService from '../services/solicitudesProxy.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

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
