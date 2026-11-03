import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import firmaRemotaService from '../services/firmaRemota.service.js';
import verificacionTemperaturaService from '../services/verificacionTemperatura.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

// Página pública que abre el muestreador al escanear el QR de firma (sin login:
// la llave es el token de un solo uso del enlace). Montada en /firma.
const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(__dirname, '../public/firma-remota');
const TOKEN = /^[a-f0-9]{64}$/;

// Se monta antes del express.json global (ver server.js), así que lee su propio JSON.
router.use(express.json({ limit: '1mb' }));

router.use((req, res, next) => {
    // Ningún dato de esta página debe quedar en caché del celular ni de un proxy.
    res.setHeader('Cache-Control', 'no-store');
    // El CSP global de helmet trae "upgrade-insecure-requests": en la red local
    // (http://IP:8002) el celular pedía firma.js por https y la página quedaba
    // rota (ERR_SSL_PROTOCOL_ERROR). Acá va el mismo CSP, sin esa regla.
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ].join('; '));
    // Estos dos solo aplican sobre https y en http el navegador los ignora con advertencias.
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.removeHeader('Origin-Agent-Cluster');
    res.removeHeader('Strict-Transport-Security');
    next();
});

router.get('/assets/firma.js', (req, res) => res.sendFile(path.join(DIR, 'firma.js')));

router.get('/api/:token', (req, res) => {
    if (!TOKEN.test(req.params.token)) return errorResponse(res, 'Enlace no válido', 404);
    try {
        return successResponse(res, firmaRemotaService.info(req.params.token));
    } catch (e) {
        return errorResponse(res, e.message, e.statusCode || 500);
    }
});

// "Grabar firma": la ficha queda firmada y registrada en el equipo en ese
// momento (PDF definitivo, documento de la revisión y datos del equipo), a
// nombre del usuario que generó el QR.
router.post('/api/:token', async (req, res) => {
    if (!TOKEN.test(req.params.token)) return errorResponse(res, 'Enlace no válido', 404);
    try {
        const f = firmaRemotaService.recibirFirma(req.params.token, req.body?.firma);
        await verificacionTemperaturaService.firmar(f.idVerificacion, f.idUsuario, { id_muestreador: f.idMuestreador, firma: f.firma });
        logger.info(`[FirmaRemota] Ficha ${f.idVerificacion} firmada desde el celular y registrada en el equipo`);
        return successResponse(res, { ok: true }, 'Firma registrada');
    } catch (e) {
        if (!e.statusCode || e.statusCode >= 500) logger.error('[FirmaRemota] No se pudo registrar la firma:', e);
        return errorResponse(res, e.statusCode && e.statusCode < 500 ? e.message : 'No se pudo registrar la firma. Intente de nuevo o avise a Gestión de Calidad.', e.statusCode || 500);
    }
});

// Después de firmar: las otras fichas del mismo muestreador pendientes de firma.
router.get('/api/:token/pendientes', async (req, res) => {
    if (!TOKEN.test(req.params.token)) return errorResponse(res, 'Enlace no válido', 404);
    try {
        return successResponse(res, await verificacionTemperaturaService.pendientesCelular(req.params.token));
    } catch (e) {
        if (!e.statusCode) logger.error('[FirmaRemota] pendientes:', e);
        return errorResponse(res, e.statusCode ? e.message : 'No se pudo cargar la lista', e.statusCode || 500);
    }
});

// Abre la firma de una de esas fichas (devuelve el enlace de su propia sesión).
router.post('/api/:token/abrir/:idVerificacion', async (req, res) => {
    if (!TOKEN.test(req.params.token) || !/^\d+$/.test(req.params.idVerificacion)) return errorResponse(res, 'Enlace no válido', 404);
    try {
        return successResponse(res, await verificacionTemperaturaService.abrirDesdeCelular(req.params.token, Number(req.params.idVerificacion)));
    } catch (e) {
        if (!e.statusCode) logger.error('[FirmaRemota] abrir:', e);
        return errorResponse(res, e.statusCode ? e.message : 'No se pudo abrir la ficha', e.statusCode || 500);
    }
});

router.get('/:token', (req, res) => {
    if (!TOKEN.test(req.params.token)) return res.status(404).send('Enlace no válido');
    return res.sendFile(path.join(DIR, 'index.html'));
});

export default router;
