import express from 'express';
import multer from 'multer';
import { authenticate } from '../middlewares/auth.middleware.js';
import { requireCalidad } from '../middlewares/requireCalidad.js';
import service from '../services/quejasApelaciones.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

// Quejas y apelaciones (NCh-ISO/IEC 17025 cl. 7.9). Montada en /api/calidad/quejas-apelaciones.
// Los datos están en la base de ADLWeb (ver config/databaseAdlWeb.js); se administran
// desde ADL-One y desde el panel de ADLWeb. Acceso: área de Gestión de Calidad (e Informática).
const router = express.Router();
router.use(authenticate, requireCalidad);

const usuario = (req) => req.user?.username || req.user?.name || null;

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

const enviarArchivo = (res, { buffer, nombre, tipo = 'application/vnd.oasis.opendocument.text' }) => {
    res.setHeader('Content-Type', tipo);
    res.setHeader('Content-Disposition', `attachment; filename="${nombre.replace(/[^\w.\- ]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(nombre)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
};

// Adjuntos: en memoria (se guardan en la base de ADLWeb, como allá).
const TIPOS_ARCHIVO = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const subir = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => (TIPOS_ARCHIVO.includes(file.mimetype)
        ? cb(null, true)
        : cb(new Error('Solo se aceptan archivos PDF, JPG, PNG o WEBP de hasta 5 MB.'))),
});
const subirArchivo = (req, res, next) => subir.single('archivo')(req, res, (err) => {
    if (!err) return next();
    return errorResponse(res, err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el máximo de 5 MB.' : (err.message || 'Archivo no válido.'), 400);
});

// Antes de /:id para que no se tomen como id.
router.get('/', manejar(async (req, res) => successResponse(res, await service.listar(req.query)), 'No se pudieron cargar las quejas y apelaciones'));
router.get('/estadistica', manejar(async (req, res) => successResponse(res, await service.estadistica(req.query)), 'No se pudo calcular la estadística'));
router.get('/usuarios', manejar(async (req, res) => successResponse(res, await service.usuarios()), 'No se pudieron leer los usuarios'));
router.post('/', manejar(async (req, res) => successResponse(res, await service.crear(req.body, usuario(req)), 'Caso registrado', 201), 'No se pudo crear el registro'));

router.get('/:id', manejar(async (req, res) => successResponse(res, await service.obtener(req.params.id)), 'No se pudo cargar el caso'));
router.get('/:id/historial', manejar(async (req, res) => successResponse(res, await service.historial(req.params.id)), 'No se pudo cargar el historial'));
router.get('/:id/correos', manejar(async (req, res) => successResponse(res, await service.correos(req.params.id)), 'No se pudieron cargar los correos'));
router.post('/:id/correos/:correoId/reintentar', manejar(async (req, res) => successResponse(res, await service.reintentarCorreo(req.params.id, req.params.correoId, usuario(req)), 'Correo vuelto a la cola'), 'No se pudo reintentar el correo'));
router.get('/:id/formulario',manejar(async (req, res) => enviarArchivo(res, await service.formulario(req.params.id, usuario(req))), 'No se pudo generar el formulario OI-FoGe-05'));
router.put('/:id/registro', manejar(async (req, res) => successResponse(res, await service.editarRegistro(req.params.id, req.body, usuario(req)), 'Registro guardado'), 'No se pudo guardar el registro'));
router.put('/:id/evaluacion', manejar(async (req, res) => successResponse(res, await service.guardarEvaluacion(req.params.id, req.body, usuario(req)), 'Evaluación guardada'), 'No se pudo guardar la evaluación'));
router.post('/:id/evaluacion/reabrir', manejar(async (req, res) => successResponse(res, await service.reabrirEvaluacion(req.params.id, req.body, usuario(req)), 'Evaluación reabierta'), 'No se pudo reabrir la evaluación'));
router.put('/:id/tratamiento', manejar(async (req, res) => successResponse(res, await service.guardarTratamiento(req.params.id, req.body, usuario(req)), 'Tratamiento guardado'), 'No se pudo guardar el tratamiento'));
router.post('/:id/acuse', manejar(async (req, res) => successResponse(res, await service.enviarAcuse(req.params.id, usuario(req)), 'Acuse de recibo enviado', 201), 'No se pudo enviar el acuse de recibo'));
router.post('/:id/notificaciones', manejar(async (req, res) => successResponse(res, await service.agregarNotificacion(req.params.id, req.body, usuario(req)), 'Notificación registrada', 201), 'No se pudo registrar la notificación'));

router.get('/:id/adjuntos/:adjId', manejar(async (req, res) => {
    const a = await service.adjunto(req.params.id, req.params.adjId);
    return enviarArchivo(res, { buffer: a.contenido, nombre: a.nombre, tipo: a.tipo });
}, 'No se pudo descargar el adjunto'));
router.post('/:id/adjuntos', subirArchivo, manejar(async (req, res) =>
    successResponse(res, await service.subirAdjunto(req.params.id, req.file, req.body?.descripcion, usuario(req)), 'Adjunto guardado', 201), 'No se pudo guardar el adjunto'));

router.post('/:id/acciones', manejar(async (req, res) => successResponse(res, await service.abrirAccion(req.params.id, req.body, usuario(req)), 'Acción correctiva abierta', 201), 'No se pudo abrir la acción correctiva'));
router.put('/:id/acciones/:acId', manejar(async (req, res) => successResponse(res, await service.guardarAccion(req.params.id, req.params.acId, req.body, usuario(req)), 'Acción correctiva guardada'), 'No se pudo guardar la acción correctiva'));
router.post('/:id/acciones/:acId/anular', manejar(async (req, res) => successResponse(res, await service.anularAccion(req.params.id, req.params.acId, req.body?.motivo, usuario(req)), 'Acción correctiva anulada'), 'No se pudo anular la acción correctiva'));
router.get('/:id/acciones/:acId/formulario', manejar(async (req, res) => enviarArchivo(res, await service.formularioAccion(req.params.id, req.params.acId, usuario(req))), 'No se pudo generar el formulario OI-FoGe-02'));

export default router;
