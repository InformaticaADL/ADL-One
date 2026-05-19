import { Router } from 'express';
import { catalogosController } from '../controllers/catalogos.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';

const router = Router();

// Bloque 1: Identificación
router.get('/lugares-analisis', authenticate, catalogosController.getLugaresAnalisis);
router.get('/empresas-servicio', authenticate, catalogosController.getEmpresasServicio);
router.get('/clientes', authenticate, catalogosController.getClientes);
router.get('/contactos', authenticate, catalogosController.getContactos);
router.get('/centros', authenticate, catalogosController.getCentros);

// Bloque 2: Datos del Servicio y Muestreo
router.get('/objetivos-muestreo', authenticate, catalogosController.getObjetivosMuestreo);
router.get('/componentes-ambientales', authenticate, catalogosController.getComponentesAmbientales);
router.get('/subareas', authenticate, catalogosController.getSubAreas);
router.get('/inspectores', authenticate, catalogosController.getInspectores);
router.get('/tipos-muestreo', authenticate, catalogosController.getTiposMuestreo);
router.get('/tipos-muestra', authenticate, catalogosController.getTiposMuestra);
router.get('/actividades-muestreo', authenticate, catalogosController.getActividadesMuestreo);
router.get('/tipos-descarga', authenticate, catalogosController.getTiposDescarga);
router.get('/modalidades', authenticate, catalogosController.getModalidades);
router.get('/cargos', authenticate, catalogosController.getCargos);
router.get('/frecuencias-periodo', authenticate, catalogosController.getFrecuenciasPeriodo);
router.get('/formas-canal', authenticate, catalogosController.getFormasCanal);
router.get('/dispositivos-hidraulicos', authenticate, catalogosController.getDispositivosHidraulicos);
router.get('/muestreadores', authenticate, catalogosController.getMuestreadores);
router.get('/coordinadores', authenticate, catalogosController.getCoordinadores);
router.get('/instrumentos-ambientales', authenticate, catalogosController.getInstrumentosAmbientales);
router.get('/unidades-medida', authenticate, catalogosController.getUnidadesMedida);
router.get('/estados-muestreo', authenticate, catalogosController.getEstadosMuestreo);

// Maestros CRUD — require INF_ACCESO (Informática module permission) for writes
router.get('/maestros/:tableName', authenticate, catalogosController.getMaestroData);
router.post('/maestros', authenticate, verifyPermission('INF_ACCESO'), catalogosController.createMaestro);
router.put('/maestros', authenticate, verifyPermission('INF_ACCESO'), catalogosController.updateMaestro);
router.delete('/maestros', authenticate, verifyPermission('INF_ACCESO'), catalogosController.toggleMaestroStatus);

export default router;
