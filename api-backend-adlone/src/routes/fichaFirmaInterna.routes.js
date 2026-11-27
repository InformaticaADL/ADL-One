import express from 'express';
import { protectInternalService } from '../middlewares/protectInternalService.js';
import fichaFirmaService from '../services/fichaFirma.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

// Quien recibe un equipo lo ve y lo acepta (o rechaza) desde ADL SAMPLING. Solo servidor a servidor: api-app-mam valida la sesión del muestreador y
// manda su id con la clave interna. Montada en /api/firmas-fichas-interno.
const router = express.Router();
router.use(protectInternalService);

const manejar = (fn, mensaje) => async (req, res) => {
    const idMuestreador = Number(req.params.idMuestreador);
    const idFicha = req.params.idFicha === undefined ? null : Number(req.params.idFicha);
    if (!Number.isInteger(idMuestreador) || idMuestreador <= 0 || (idFicha !== null && !Number.isInteger(idFicha))) return errorResponse(res, 'Solicitud no válida', 400);
    try {
        return await fn(req, res, idMuestreador, idFicha);
    } catch (e) {
        if (e.statusCode && (e.statusCode < 500 || e.statusCode === 503)) return errorResponse(res, e.message, e.statusCode);
        logger.error(`${mensaje}:`, e);
        return errorResponse(res, mensaje, 500);
    }
};

router.get('/muestreador/:idMuestreador/pendientes', manejar(async (req, res, m) =>
    successResponse(res, await fichaFirmaService.pendientesMuestreador(m)), 'No se pudieron leer los equipos por recibir'));

router.get('/muestreador/:idMuestreador/:idFicha/pdf', manejar(async (req, res, m, f) => {
    const { buffer } = await fichaFirmaService.pdfMuestreador(f, m);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
}, 'No se pudo generar la ficha'));

router.post('/muestreador/:idMuestreador/:idFicha/aceptar', manejar(async (req, res, m, f) =>
    successResponse(res, await fichaFirmaService.aceptar(f, m), 'Equipo aceptado'), 'No se pudo registrar la aceptación'));

router.post('/muestreador/:idMuestreador/:idFicha/rechazar', manejar(async (req, res, m, f) =>
    successResponse(res, await fichaFirmaService.rechazar(f, m, req.body?.motivo), 'Rechazo registrado'), 'No se pudo registrar el rechazo'));

export default router;
