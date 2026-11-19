import express from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';
import revisionDocumentalService from '../services/revisionDocumental.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

// Fechas de revisión documental de los formularios. Montada en /api/revision-documental.
// Verlas, cualquiera con sesión; cambiarlas pide el permiso de Gestión de Calidad.
const router = express.Router();
router.use(authenticate);

const manejar = (fn, mensaje) => async (req, res) => {
    try {
        return await fn(req, res);
    } catch (e) {
        if (e.statusCode) return errorResponse(res, e.message, e.statusCode);
        logger.error(`${mensaje}:`, e);
        return errorResponse(res, mensaje, 500);
    }
};

const permiso = verifyPermission(['GC_EQUIPOS', 'MA_A_GEST_EQUIPO']);

router.get('/', manejar(async (req, res) => successResponse(res, await revisionDocumentalService.listar()), 'No se pudieron leer las fechas de revisión'));
// Vista previa del formulario con el encabezado que se está editando (no guarda nada).
router.post('/documentos/:codigo/vista-previa', permiso, manejar(async (req, res) => {
    const buffer = await revisionDocumentalService.vistaPrevia(req.params.codigo, req.body || {});
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
}, 'No se pudo generar la vista previa'));
router.put('/documentos/:codigo', permiso, manejar(async (req, res) =>
    successResponse(res, await revisionDocumentalService.guardarDocumento(req.params.codigo, req.body || {}, req.user?.id), 'Encabezado del documento guardado'),
'No se pudo guardar el encabezado del documento'));
router.put('/:anio', permiso, manejar(async (req, res) =>
    successResponse(res, await revisionDocumentalService.guardar({ ...req.body, anio: req.params.anio }, req.user?.id), 'Fecha de revisión guardada'),
'No se pudo guardar la fecha de revisión'));
router.delete('/:anio', permiso, manejar(async (req, res) =>
    successResponse(res, await revisionDocumentalService.eliminar(req.params.anio), 'Fecha de revisión eliminada'), 'No se pudo eliminar la fecha de revisión'));

export default router;
