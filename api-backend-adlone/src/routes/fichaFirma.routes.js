import express from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';
import fichaFirmaService from '../services/fichaFirma.service.js';
import firmaRemotaService, { urlPublica } from '../services/firmaRemota.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

// Fichas de equipo enviadas a firmar (sección "Firmas pendientes" de Solicitudes). Montada en /api/firmas-fichas.
// Enviar una ficha pide el mismo permiso que preparar fichas de equipo; ver y firmar solo pide ser quien debe
// firmar (o quien la envió): lo comprueba el servicio.
const router = express.Router();
router.use(authenticate);

const manejar = (fn, mensaje) => async (req, res) => {
    try {
        return await fn(req, res);
    } catch (e) {
        if (e.statusCode && e.statusCode < 500) return errorResponse(res, e.message, e.statusCode);
        if (e.statusCode === 503) return errorResponse(res, e.message, 503);
        logger.error(`${mensaje}:`, e);
        return errorResponse(res, mensaje, 500);
    }
};

const permisoPreparar = verifyPermission(['MA_A_GEST_EQUIPO', 'GC_VERIF_TEMP']);

router.post('/', permisoPreparar, manejar(async (req, res) =>
    successResponse(res, await fichaFirmaService.crear(req.body, req.user), 'Ficha enviada a firmar'), 'No se pudo enviar la ficha a firmar'));

router.get('/pendientes', manejar(async (req, res) =>
    successResponse(res, await fichaFirmaService.pendientes(req.user)), 'No se pudieron leer las firmas pendientes'));
router.get('/pendientes/contar', manejar(async (req, res) =>
    successResponse(res, { total: await fichaFirmaService.contar(req.user) }), 'No se pudo contar las firmas pendientes'));
router.get('/enviadas', manejar(async (req, res) =>
    successResponse(res, await fichaFirmaService.enviadas(req.user)), 'No se pudieron leer las fichas enviadas'));
// Todas las solicitudes de firma, para el seguimiento (permiso GC_SEGUIMIENTO_FIRMAS; lo valida el servicio).
router.get('/seguimiento/acceso', manejar(async (req, res) =>
    successResponse(res, { puede: await fichaFirmaService.accesoSeguimiento(req.user) }), 'No se pudo revisar el acceso al seguimiento'));
router.get('/seguimiento', manejar(async (req, res) =>
    successResponse(res, await fichaFirmaService.seguimiento(req.user)), 'No se pudo leer el seguimiento de firmas'));

// QR del celular: el estado se consulta con el token (antes que /:id para que no lo tome como id).
router.get('/qr/:token', manejar(async (req, res) => {
    try {
        return successResponse(res, firmaRemotaService.estadoFicha(req.params.token, req.user?.id || null));
    } catch (e) {
        if (e.statusCode) return errorResponse(res, e.message, e.statusCode);
        throw e;
    }
}, 'No se pudo consultar la firma del celular'));

router.get('/:id', manejar(async (req, res) =>
    successResponse(res, await fichaFirmaService.obtener(req.params.id, req.user)), 'No se pudo leer la solicitud de firma'));

router.get('/:id/pdf', manejar(async (req, res) => {
    const { buffer, nombre } = await fichaFirmaService.pdf(req.params.id, req.user);
    res.setHeader('Content-Type', 'application/pdf');
    // Solo para ver: sin nombre de archivo para descargar.
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Nombre-Archivo', encodeURIComponent(nombre || 'ficha.pdf'));
    return res.send(buffer);
}, 'No se pudo generar la ficha'));

router.post('/:id/vista-previa', manejar(async (req, res) => {
    const { buffer } = await fichaFirmaService.pdfProvisional(req.params.id, req.user, {
        imagen: req.body?.imagen, usarRegistrada: !!req.body?.usar_registrada, imagenEquipo: req.body?.imagen_equipo,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
}, 'No se pudo generar la vista previa'));

router.post('/:id/firmar', manejar(async (req, res) =>
    successResponse(res, await fichaFirmaService.firmar(req.params.id, req.user, { imagen: req.body?.imagen, usarRegistrada: !!req.body?.usar_registrada, imagenEquipo: req.body?.imagen_equipo }), 'Firma registrada'), 'No se pudo registrar la firma'));

// Firmar la firma del Perfil desde el celular (QR): no depende de ninguna ficha.
router.post('/perfil/qr', manejar(async (req, res) => {
    const sesion = await firmaRemotaService.crearFicha({
        titulo: 'Mi firma',
        subtitulo: 'Perfil de usuario',
        slots: [{ id: 'firma', titulo: 'Mi firma', nombre: req.user.name || null }],
        idUsuario: req.user.id,
        url: (token) => urlPublica(req, token),
    });
    return successResponse(res, sesion, 'Código QR generado');
}, 'No se pudo generar el código QR'));

router.post('/:id/qr', manejar(async (req, res) => {
    const f = await fichaFirmaService.validarFirmante(req.params.id, req.user);
    const hechas = new Set((Array.isArray(req.body?.slots) ? req.body.slots : []).filter((x) => x?.firmada).map((x) => String(x.id)));
    const sesion = await firmaRemotaService.crearFicha({
        titulo: 'Firma de ficha de entrega',
        subtitulo: f.codigo_equipo ? `Equipo ${f.codigo_equipo}` : undefined,
        // Lo que ya está firmado en la pantalla (lo manda la web) se muestra en gris en el celular.
        slots: [
            { firmada: hechas.has('firma'), id: 'firma', titulo: f.roles.length > 1 ? 'Responsable de entrega y de área' : (f.rol === 'ENTREGA' ? 'Responsable de entrega' : 'Responsable de área'), nombre: f.nombre },
            // Quien entrega le pide la firma a quien recibe el equipo: se firma en el mismo celular.
            ...(f.requiere_firma_equipo ? [{ firmada: hechas.has('equipo'), id: 'equipo', titulo: 'Responsable del equipo (recibe)', nombre: f.responsable_equipo || null }] : []),
        ],
        idUsuario: req.user.id,
        url: (token) => urlPublica(req, token),
    });
    return successResponse(res, sesion, 'Código QR generado');
}, 'No se pudo generar el código QR'));

router.post('/:id/cancelar', manejar(async (req, res) =>
    successResponse(res, await fichaFirmaService.cancelar(req.params.id, req.user, req.body?.motivo), 'Solicitud de firma cancelada'), 'No se pudo cancelar la solicitud de firma'));

export default router;
