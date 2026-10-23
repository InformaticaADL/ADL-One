import verificadorSolicitudesService from '../services/verificadorSolicitudes.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function listar(req, res) {
    try {
        const rows = await verificadorSolicitudesService.listar();
        successResponse(res, rows);
    } catch (e) {
        errorResponse(res, e.message, 500);
    }
}

export async function crear(req, res) {
    try {
        const { id_usuario } = req.body || {};
        if (!id_usuario) {
            return errorResponse(res, 'id_usuario es requerido.', 400);
        }
        await verificadorSolicitudesService.agregar({
            idUsuario:   Number(id_usuario),
            asignadoPor: req.user.id,
        });
        successResponse(res, { ok: true });
    } catch (e) {
        errorResponse(res, e.message, 500);
    }
}

export async function eliminar(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return errorResponse(res, 'Id inválido.', 400);
        }
        await verificadorSolicitudesService.quitar(id);
        successResponse(res, { ok: true });
    } catch (e) {
        errorResponse(res, e.message, 500);
    }
}
