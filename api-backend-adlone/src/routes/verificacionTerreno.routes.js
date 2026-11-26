import express from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';
import crud from '../services/verificacionTerrenoCrud.service.js';
import { buscarMuestreos } from '../services/verificacionTerreno.service.js';
import { ITEMS_VERIF_EQUIPOS, BUFFERS_PH, ITEMS_MAU, ITEMS_MATERIALES, CARACTERISTICAS } from '../services/verificacionTerreno.items.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

// G.C. Medio Ambiente → verificaciones de terreno (OI-FoGe-26, OI-FoMa-03, OI-FoMa-19).
// Montado en /api/verificaciones-terreno. El :tipo es equipos | mau | materiales.
const router = express.Router();
router.use(authenticate);

// Mientras la migración no cree el permiso propio, vale el acceso de G. Calidad o la gestión de equipos.
const permiso = verifyPermission(['MA_VERIF_TERRENO', 'GC_ACCESO', 'MA_A_GEST_EQUIPO', 'GC_VERIF_TEMP']);

const manejar = (fn, mensaje) => async (req, res) => {
    try {
        return await fn(req, res);
    } catch (e) {
        if (e.statusCode && e.statusCode < 600) return errorResponse(res, e.message, e.statusCode);
        logger.error(`${mensaje}:`, e);
        return errorResponse(res, mensaje, 500);
    }
};

const enviarPdf = (res, { buffer, nombre }) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(nombre)}`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
};

// Los ítems impresos de cada formulario, para que el frontend no tenga otra copia.
router.get('/items', permiso, (req, res) => successResponse(res, {
    equipos: ITEMS_VERIF_EQUIPOS, buffers: BUFFERS_PH, mau: ITEMS_MAU,
    materiales: ITEMS_MATERIALES, caracteristicas: CARACTERISTICAS,
}));

// Muestreos para elegir, del más reciente al más antiguo; `q` busca por folio, empresa o punto.
router.get('/:tipo/muestreos', permiso, manejar(async (req, res) =>
    successResponse(res, await buscarMuestreos({ texto: req.query.q, limite: req.query.limite, tabla: req.params.tipo })),
'No se pudieron leer los muestreos'));

// Lo que trae el muestreo, antes de crear nada.
router.get('/:tipo/previo/:folio', permiso, manejar(async (req, res) =>
    successResponse(res, await crud.previo(req.params.tipo, req.params.folio)), 'No se pudo leer el muestreo'));

router.get('/:tipo', permiso, manejar(async (req, res) =>
    successResponse(res, await crud.listar(req.params.tipo, req.query)), 'No se pudo leer el listado'));

router.post('/:tipo', permiso, manejar(async (req, res) =>
    successResponse(res, await crud.crear(req.params.tipo, req.body?.folio, req.user), 'Formulario creado'), 'No se pudo crear el formulario'));

router.post('/:tipo/vista-previa', permiso, manejar(async (req, res) =>
    enviarPdf(res, await crud.vistaPrevia(req.params.tipo, req.body || {})), 'No se pudo generar la vista previa'));

router.get('/:tipo/:id', permiso, manejar(async (req, res) =>
    successResponse(res, await crud.obtener(req.params.tipo, req.params.id)), 'No se pudo leer el formulario'));

router.put('/:tipo/:id', permiso, manejar(async (req, res) =>
    successResponse(res, await crud.guardar(req.params.tipo, req.params.id, req.body || {}), 'Guardado'), 'No se pudo guardar'));

router.post('/:tipo/:id/firmar', permiso, manejar(async (req, res) =>
    successResponse(res, await crud.firmar(req.params.tipo, req.params.id, req.body || {}), 'Formulario firmado'), 'No se pudo firmar'));

router.post('/:tipo/:id/anular', permiso, manejar(async (req, res) =>
    successResponse(res, await crud.anular(req.params.tipo, req.params.id, req.body?.motivo), 'Formulario anulado'), 'No se pudo anular'));

router.get('/:tipo/:id/pdf', permiso, manejar(async (req, res) =>
    enviarPdf(res, await crud.pdf(req.params.tipo, req.params.id)), 'No se pudo generar el PDF'));

export default router;
