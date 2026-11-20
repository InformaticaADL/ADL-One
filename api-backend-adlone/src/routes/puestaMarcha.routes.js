import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';
import puestaMarchaService, { carpetaAdjuntos } from '../services/puestaMarcha.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

// Puestas en marcha de equipos (OI-FoGe-42). Montada en /api/puestas-marcha. Las ve y registra quien gestiona equipos
// o tiene Gestión de Calidad; firmar pide además ser una de las dos partes (el servicio exige personas distintas).
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

const TIPOS_ARCHIVO = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const subir = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => { fs.mkdirSync(carpetaAdjuntos, { recursive: true }); cb(null, carpetaAdjuntos); },
        filename: (req, file, cb) => cb(null, `pm-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => (TIPOS_ARCHIVO.includes(file.mimetype) ? cb(null, true) : cb(new Error('Formato no permitido: adjunte un PDF o una imagen'))),
});
const subirArchivo = (req, res, next) => subir.single('archivo')(req, res, (err) => {
    if (!err) return next();
    return errorResponse(res, err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el máximo de 20 MB' : (err.message || 'No se pudo procesar el archivo'), 400);
});

router.get('/', permiso, manejar(async (req, res) => successResponse(res, await puestaMarchaService.listar(req.query)), 'No se pudieron leer las puestas en marcha'));
router.get('/equipo/:idEquipo/datos', permiso, manejar(async (req, res) => successResponse(res, await puestaMarchaService.datosEquipo(req.params.idEquipo)), 'No se pudieron leer los datos del equipo'));
// Quién puede firmar (áreas del usuario y muestreadores con competencias) y equipos que sirven de patrón de referencia.
router.get('/firmantes', permiso, manejar(async (req, res) => successResponse(res, await puestaMarchaService.firmantes(req.user)), 'No se pudieron leer los firmantes'));
// Personas con el permiso para firmar por un rol (Combobox de "Enviar a firmar") y mis puestas en marcha pendientes.
router.get('/usuarios-para-firmar', permiso, manejar(async (req, res) => successResponse(res, await puestaMarchaService.usuariosParaFirmar(req.query.rol)), 'No se pudieron leer los posibles firmantes'));
router.get('/firmas-pendientes', permiso, manejar(async (req, res) => successResponse(res, await puestaMarchaService.misFirmasPendientes(req.user)), 'No se pudieron leer las firmas pendientes'));
router.get('/patrones', permiso, manejar(async (req, res) => successResponse(res, await puestaMarchaService.patronesReferencia()), 'No se pudieron leer los patrones'));
router.post('/', permiso, manejar(async (req, res) => successResponse(res, await puestaMarchaService.crear(req.body, req.user), 'Puesta en marcha registrada'), 'No se pudo registrar la puesta en marcha'));

// Vista previa del formulario mientras se llena una puesta en marcha nueva (no guarda nada).
router.post('/vista-previa', permiso, manejar(async (req, res) => {
    const { buffer } = await puestaMarchaService.vistaPrevia(req.body, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
}, 'No se pudo generar la vista previa'));

// Antes de /:id para que no lo tome como id.
router.get('/adjuntos/:idAdjunto', permiso, manejar(async (req, res) => {
    const { ruta, nombre } = await puestaMarchaService.archivoAdjunto(req.params.idAdjunto);
    return res.download(ruta, nombre);
}, 'No se pudo descargar el documento'));
router.delete('/adjuntos/:idAdjunto', permiso, manejar(async (req, res) =>
    successResponse(res, await puestaMarchaService.eliminarAdjunto(req.params.idAdjunto, req.user), 'Documento eliminado'), 'No se pudo eliminar el documento'));

router.get('/:id', permiso, manejar(async (req, res) => successResponse(res, await puestaMarchaService.obtener(req.params.id, req.user)), 'No se pudo leer la puesta en marcha'));
// Vista previa mientras se edita una puesta en marcha guardada (no guarda nada).
router.post('/:id/vista-previa', permiso, manejar(async (req, res) => {
    const { buffer } = await puestaMarchaService.vistaPreviaEdicion(req.params.id, req.body, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
}, 'No se pudo generar la vista previa'));
router.get('/:id/pdf', permiso, manejar(async (req, res) => {
    const { buffer, nombre } = await puestaMarchaService.pdf(req.params.id, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(nombre)}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
}, 'No se pudo generar el PDF'));
// Edición (también ya aprobada) y registro interno de uso: solo Gestión de Calidad (lo valida el servicio).
router.put('/:id', permiso, manejar(async (req, res) => successResponse(res, await puestaMarchaService.editar(req.params.id, req.body, req.user), 'Puesta en marcha actualizada'), 'No se pudo actualizar la puesta en marcha'));
router.get('/:id/registro-interno', permiso, manejar(async (req, res) => successResponse(res, await puestaMarchaService.registroInterno(req.params.id, req.user)), 'No se pudo leer el registro interno'));
router.post('/:id/firmar', permiso, manejar(async (req, res) => successResponse(res, await puestaMarchaService.firmar(req.params.id, req.body, req.user), 'Firma registrada'), 'No se pudo registrar la firma'));
router.post('/:id/enviar-a-firmar', permiso, manejar(async (req, res) => successResponse(res, await puestaMarchaService.enviarAFirmar(req.params.id, req.body, req.user), 'Enviado a firmar'), 'No se pudo enviar a firmar'));
router.post('/:id/anular', permiso, manejar(async (req, res) => successResponse(res, await puestaMarchaService.anular(req.params.id, req.body?.motivo, req.user), 'Puesta en marcha anulada'), 'No se pudo anular la puesta en marcha'));
router.post('/:id/adjuntos', permiso, subirArchivo, manejar(async (req, res) =>
    successResponse(res, await puestaMarchaService.adjuntar(req.params.id, { documento: req.body?.documento, archivo: req.file, observacion: req.body?.observacion }, req.user), 'Documento adjuntado'), 'No se pudo adjuntar el documento'));

export default router;
