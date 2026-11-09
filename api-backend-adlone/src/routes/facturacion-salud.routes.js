import express from 'express';
import facturacionSaludController from '../controllers/facturacion-salud.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = express.Router();

// Ampliar límite JSON para envíos de valorización/agrupación de casos de salud
router.use(express.json({ limit: '10mb' }));

// Dashboard y Catálogos Maestros (Conexión estrictamente local: localhost -> LaboratorioADL)
router.get('/dashboard', authenticate, facturacionSaludController.getDashboard);
router.get('/maestros', authenticate, facturacionSaludController.getMaestros);

// 1. Pre-Facturación y Valorización de Casos de Salud
router.get('/empresas-elegibles', authenticate, facturacionSaludController.getEmpresasElegibles);
router.get('/casos-elegibles', authenticate, facturacionSaludController.getCasosElegibles);
router.post('/valorizar', authenticate, facturacionSaludController.valorizarCasos);
router.put('/casos/linea-manual', authenticate, facturacionSaludController.actualizarLineaCasoManual);
router.put('/casos/cambiar-empresa', authenticate, facturacionSaludController.cambiarEmpresaCaso);

// 2. Gestión de Pre-Facturas de Casos (facturacion_enc / facturacion_det / OI / OD / OC / Excel)
router.post('/prefacturas', authenticate, facturacionSaludController.crearPrefacturas);
router.get('/prefacturas', authenticate, facturacionSaludController.listarPrefacturas);
router.get('/prefacturas/:id', authenticate, facturacionSaludController.getPrefacturaDetalle);
router.put('/prefacturas/:id', authenticate, facturacionSaludController.actualizarPrefactura);
router.delete('/prefacturas/:id', authenticate, facturacionSaludController.eliminarPrefactura);
router.delete('/prefacturas/:id/casos/:idCaso', authenticate, facturacionSaludController.quitarCasoPrefactura);

router.post('/prefacturas/:id/otros-ingresos', authenticate, facturacionSaludController.agregarOtroIngreso);
router.delete('/prefacturas/:id/otros-ingresos/:item', authenticate, facturacionSaludController.eliminarOtroIngreso);
router.post('/prefacturas/:id/otros-descuentos', authenticate, facturacionSaludController.agregarOtroDescuento);
router.delete('/prefacturas/:id/otros-descuentos/:item', authenticate, facturacionSaludController.eliminarOtroDescuento);

router.get('/prefacturas/:id/excel', authenticate, facturacionSaludController.descargarExcelPrefactura);

// 3. Otras Ventas / Otros Cobros y Notas de Crédito / Débito (facturacion_otro)
router.get('/otros-cobros', authenticate, facturacionSaludController.listarOtrosCobros);
router.get('/otros-cobros/referencia', authenticate, facturacionSaludController.buscarFacturaReferencia);
router.post('/otros-cobros', authenticate, facturacionSaludController.crearOtroCobro);

// 4. Exportación de Facturación Electrónica DTE (35 columnas felectronicatxt)
router.get('/dte/documentos', authenticate, facturacionSaludController.listarDocumentosDte);
router.post('/dte/exportar', authenticate, facturacionSaludController.generarArchivoDte);

export default router;

