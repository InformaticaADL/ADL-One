import { Router } from 'express';
import { catalogosController } from '../controllers/catalogos.controller.js';

const router = Router();

// Bloque 1: Identificación
router.get('/lugares-analisis', catalogosController.getLugaresAnalisis);
router.get('/empresas-servicio', catalogosController.getEmpresasServicio);
router.get('/clientes', catalogosController.getClientes);
router.get('/contactos', catalogosController.getContactos);
router.get('/centros', catalogosController.getCentros);

// Bloque 2: Datos del Servicio y Muestreo
router.get('/objetivos-muestreo', catalogosController.getObjetivosMuestreo);
router.get('/componentes-ambientales', catalogosController.getComponentesAmbientales);
router.get('/subareas', catalogosController.getSubAreas);
router.get('/inspectores', catalogosController.getInspectores);
router.get('/tipos-muestreo', catalogosController.getTiposMuestreo);
router.get('/tipos-muestra', catalogosController.getTiposMuestra);
router.get('/actividades-muestreo', catalogosController.getActividadesMuestreo);
router.get('/tipos-descarga', catalogosController.getTiposDescarga);
router.get('/modalidades', catalogosController.getModalidades);
router.get('/cargos', catalogosController.getCargos);
router.get('/frecuencias-periodo', catalogosController.getFrecuenciasPeriodo);
router.get('/formas-canal', catalogosController.getFormasCanal);
router.get('/dispositivos-hidraulicos', catalogosController.getDispositivosHidraulicos);
router.get('/muestreadores', catalogosController.getMuestreadores);
router.get('/coordinadores', catalogosController.getCoordinadores);

export default router;
