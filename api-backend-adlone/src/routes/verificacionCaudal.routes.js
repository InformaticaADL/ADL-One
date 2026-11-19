import express from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';
import verificacionCaudalService from '../services/verificacionCaudal.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

// Verificación Intermedia Sonda Caudal (OI-FoGe-30). Montada en /api/verificaciones-caudal. La ve y registra quien
// gestiona equipos o tiene Gestión de Calidad; el V°B° pide además el rol de Calidad o de Medio Ambiente (lo valida el servicio).
const router = express.Router();
router.use(authenticate);
const permiso = verifyPermission(['MA_A_GEST_EQUIPO', 'GC_ACCESO']);

const manejar = (fn, mensaje) => async (req, res) => {
    try {
        return await fn(req, res);
    } catch (e) {
        const codigo = e.statusCode || e.status;
        if (codigo && codigo < 600) return errorResponse(res, e.message, codigo);
        logger.error(`${mensaje}:`, e);
        return errorResponse(res, mensaje, 500);
    }
};

const enviarPdf = (res, buffer, nombre) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline${nombre ? `; filename="${encodeURIComponent(nombre)}"` : ''}`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
};

router.get('/', permiso, manejar(async (req, res) => successResponse(res, await verificacionCaudalService.listar(req.query)), 'No se pudieron leer las verificaciones'));
router.get('/elegibles', permiso, manejar(async (req, res) => successResponse(res, await verificacionCaudalService.elegibles()), 'No se pudieron leer las sondas'));
router.get('/referencias', permiso, manejar(async (req, res) => successResponse(res, await verificacionCaudalService.referencias()), 'No se pudieron leer los equipos de referencia'));
router.post('/vista-previa', permiso, manejar(async (req, res) => {
    const { buffer } = await verificacionCaudalService.vistaPrevia(req.body);
    return enviarPdf(res, buffer);
}, 'No se pudo generar la vista previa'));
router.post('/', permiso, manejar(async (req, res) => successResponse(res, await verificacionCaudalService.crear(req.body, req.user), 'Verificación registrada'), 'No se pudo registrar la verificación'));
router.get('/:id', permiso, manejar(async (req, res) => successResponse(res, await verificacionCaudalService.obtener(req.params.id, req.user)), 'No se pudo leer la verificación'));
router.put('/:id', permiso, manejar(async (req, res) => successResponse(res, await verificacionCaudalService.actualizar(req.params.id, req.body, req.user), 'Verificación guardada'), 'No se pudo guardar la verificación'));
router.get('/:id/pdf', permiso, manejar(async (req, res) => {
    const { buffer, nombre } = await verificacionCaudalService.pdf(req.params.id);
    return enviarPdf(res, buffer, nombre);
}, 'No se pudo generar el PDF'));
router.post('/:id/firmar', permiso, manejar(async (req, res) => successResponse(res, await verificacionCaudalService.firmar(req.params.id, req.body, req.user), 'V°B° registrado'), 'No se pudo registrar el V°B°'));
router.post('/:id/anular', permiso, manejar(async (req, res) => successResponse(res, await verificacionCaudalService.anular(req.params.id, req.body?.motivo, req.user), 'Verificación anulada'), 'No se pudo anular la verificación'));

export default router;
