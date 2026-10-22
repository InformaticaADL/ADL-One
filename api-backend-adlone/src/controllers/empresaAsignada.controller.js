import empresaAsignadaService from '../services/empresaAsignada.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function listar(req, res) {
    try {
        const rows = await empresaAsignadaService.listarTodas();
        successResponse(res, rows);
    } catch (e) {
        errorResponse(res, e.message, 500);
    }
}

export async function misEmpresas(req, res) {
    try {
        // req.user.id es el campo que deja el JWT de ADL ONE (ver auth.middleware.js).
        const rows = await empresaAsignadaService.misEmpresas(req.user.id, req.query.area || null);
        successResponse(res, rows);
    } catch (e) {
        errorResponse(res, e.message, 500);
    }
}

export async function crear(req, res) {
    try {
        const { id_usuario, id_empresa, area } = req.body || {};
        if (!id_usuario || !id_empresa || !['LAB', 'MAM'].includes(area)) {
            return errorResponse(res, 'id_usuario, id_empresa y area (LAB|MAM) son requeridos.', 400);
        }
        await empresaAsignadaService.asignar({
            idUsuario:   Number(id_usuario),
            idEmpresa:   Number(id_empresa),
            area,
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
        await empresaAsignadaService.quitar(id);
        successResponse(res, { ok: true });
    } catch (e) {
        errorResponse(res, e.message, 500);
    }
}
