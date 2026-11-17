import express from 'express';
import { authenticate as verifyToken } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';
import { permisoConRespaldo } from '../middlewares/permisoConRespaldo.js';
import { verificacionTemperaturaController as c } from '../controllers/verificacionTemperatura.controller.js';

// Formulario OI-FoGe-39 (Verificación Intermedia de Temperatura) — Gestión de Calidad.
//
// Permisos:
//   GC_VERIF_TEMP         ver, crear, llenar, enviar a firma y eliminar borradores.
//   GC_VERIF_TEMP_FIRMAR  firmar, devolver a borrador y anular (cambian el registro
//                         del equipo o lo cierran).
//   GC_VERIF_TEMP_PATRON  registrar y corregir los errores de los termómetros patrón.
// Los dos últimos se crean en migrations/add_trazabilidad_verificacion_temperatura.sql
// y se asignan a los roles que ya tenían GC_VERIF_TEMP; mientras esa migración
// no corra, basta GC_VERIF_TEMP (ver permisoConRespaldo).
const router = express.Router();
export const PERMISO_BASE = 'GC_VERIF_TEMP';
export const PERMISO_FIRMAR = 'GC_VERIF_TEMP_FIRMAR';
export const PERMISO_PATRON = 'GC_VERIF_TEMP_PATRON';
const permiso = [verifyToken, verifyPermission(PERMISO_BASE)];
const firmar = [verifyToken, verifyPermission(PERMISO_BASE), permisoConRespaldo(PERMISO_FIRMAR, PERMISO_BASE)];
const patron = [verifyToken, verifyPermission(PERMISO_BASE), permisoConRespaldo(PERMISO_PATRON, PERMISO_BASE)];

router.get('/', ...permiso, c.listar);
router.get('/acciones', ...permiso, c.acciones);
router.get('/periodos', ...permiso, c.periodos);
router.get('/equipos-elegibles', ...permiso, c.elegibles);
router.get('/patrones', ...permiso, c.patrones);
router.get('/resumen', ...permiso, c.resumen);
router.get('/errores-patron', ...permiso, c.erroresPatron);
router.post('/errores-patron', ...patron, c.guardarErroresPatron);
router.put('/errores-patron/:idError', ...patron, c.actualizarErrorPatron);
router.delete('/errores-patron/anio/:anio', ...patron, c.eliminarAnioErroresPatron);
router.get('/muestreadores', ...permiso, c.muestreadores);
router.get('/muestreadores/:idMuestreador/firma', ...permiso, c.firmaRegistrada);
router.post('/', ...permiso, c.crear);
router.post('/lote', ...permiso, c.crearLote);
router.get('/:id', ...permiso, c.obtener);
router.put('/:id', ...permiso, c.actualizar);
router.get('/:id/pdf', ...permiso, c.pdf);
router.post('/:id/enviar-firma', ...permiso, c.enviarFirma);
router.post('/:id/volver-borrador', ...firmar, c.volverBorrador);
router.post('/:id/firmar', ...firmar, c.firmar);
router.post('/:id/firma-remota', ...firmar, c.iniciarFirmaRemota);
router.get('/:id/firma-remota/:token', ...firmar, c.estadoFirmaRemota);
router.post('/:id/anular', ...firmar, c.anular);
router.delete('/:id', ...permiso, c.eliminar);

export default router;
