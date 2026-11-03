import express from 'express';
import { authenticate as verifyToken } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';
import { verificacionTemperaturaController as c } from '../controllers/verificacionTemperatura.controller.js';

// Formulario OI-FoGe-39 (Verificación Intermedia de Temperatura) — Gestión de Calidad.
const router = express.Router();
const permiso = [verifyToken, verifyPermission('GC_VERIF_TEMP')];

router.get('/', ...permiso, c.listar);
router.get('/periodos', ...permiso, c.periodos);
router.get('/equipos-elegibles', ...permiso, c.elegibles);
router.get('/patrones', ...permiso, c.patrones);
router.get('/muestreadores', ...permiso, c.muestreadores);
router.get('/muestreadores/:idMuestreador/firma', ...permiso, c.firmaRegistrada);
router.post('/', ...permiso, c.crear);
router.post('/lote', ...permiso, c.crearLote);
router.get('/:id', ...permiso, c.obtener);
router.put('/:id', ...permiso, c.actualizar);
router.get('/:id/pdf', ...permiso, c.pdf);
router.post('/:id/enviar-firma', ...permiso, c.enviarFirma);
router.post('/:id/volver-borrador', ...permiso, c.volverBorrador);
router.post('/:id/firmar', ...permiso, c.firmar);
router.post('/:id/firma-remota', ...permiso, c.iniciarFirmaRemota);
router.get('/:id/firma-remota/:token', ...permiso, c.estadoFirmaRemota);
router.post('/:id/anular', ...permiso, c.anular);

export default router;
