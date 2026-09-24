import { revisionDuplicadosService } from '../services/revisionDuplicados.service.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

const usuarioId = (req) => { const n = Number(req.user?.id ?? req.user?.userId ?? req.user?.id_usuario); return Number.isFinite(n) ? n : null; };
const fallo = (res, error, msg) => {
  if (error.status) return errorResponse(res, error.message, error.status);
  logger.error(`revisionDuplicados: ${msg}`, error);
  return errorResponse(res, msg, 500);
};

export const revisionDuplicadosController = {
  resumen: async (req, res) => {
    try { return successResponse(res, await revisionDuplicadosService.resumen()); }
    catch (e) { return fallo(res, e, 'Error al obtener el resumen de duplicados'); }
  },

  listar: async (req, res) => {
    try {
      const { items, total, page, limit } = await revisionDuplicadosService.listar(req.query);
      return paginatedResponse(res, items, page, limit, total);
    } catch (e) { return fallo(res, e, 'Error al listar duplicados'); }
  },

  resolver: async (req, res) => {
    try {
      const r = await revisionDuplicadosService.resolver(Number(req.params.id), req.body || {}, usuarioId(req));
      return successResponse(res, r, 'Par resuelto');
    } catch (e) { return fallo(res, e, 'Error al resolver el par'); }
  },

  resolverLote: async (req, res) => {
    try {
      const { ids, accion, observacion } = req.body || {};
      if (!Array.isArray(ids) || !ids.length) return errorResponse(res, 'Indica al menos un par', 400);
      const r = await revisionDuplicadosService.resolverLote(ids, { accion, observacion }, usuarioId(req));
      return successResponse(res, r, `${r.ok} par(es) resuelto(s)${r.errores.length ? `, ${r.errores.length} con error` : ''}`);
    } catch (e) { return fallo(res, e, 'Error al resolver el lote'); }
  },
};
