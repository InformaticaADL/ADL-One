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
router.post('/prefacturas/previsualizar', authenticate, facturacionSaludController.previsualizarPrefacturas);
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

// Mantención de facturas creadas (réplica de ADLSOFT; ver docs/facturacion-salud-replica-adlsoft.md)
router.delete('/facturas/numero/:factura', authenticate, facturacionSaludController.eliminarFacturaPorNumero);
router.put('/prefacturas/:id/empresa', authenticate, facturacionSaludController.cambiarEmpresaFactura);
router.get('/prefacturas/:id/ordenes-compra-oc', authenticate, facturacionSaludController.listarOc);
router.post('/prefacturas/:id/ordenes-compra-oc', authenticate, facturacionSaludController.agregarOc);
router.post('/prefacturas/:id/ordenes-compra-oc/eliminar', authenticate, facturacionSaludController.eliminarOc);
router.post('/prefacturas/otros-ing-des/grabar', authenticate, facturacionSaludController.grabarOiOd);

// Datos previos a exportar y archivo plano de las facturas de casos (réplica de ADLSOFT)
router.get('/dte/casos/facturas', authenticate, facturacionSaludController.listarFacturasExportacion);
router.post('/dte/casos/exportar', authenticate, facturacionSaludController.exportarFacturasCasos);
router.get('/dte/casos/ordenes-compra/buscar', authenticate, facturacionSaludController.buscarOcEnOtrasFacturas);
router.put('/prefacturas/:id/exportacion/:accion', authenticate, facturacionSaludController.modificarDatosExportacion);
router.get('/prefacturas/:id/exportacion-oc-hes', authenticate, facturacionSaludController.listarOcHes);
router.post('/prefacturas/:id/exportacion-oc-hes', authenticate, facturacionSaludController.agregarOcHes);
router.put('/prefacturas/:id/exportacion-oc-hes', authenticate, facturacionSaludController.modificarOcHes);
router.post('/prefacturas/:id/exportacion-oc-hes/eliminar', authenticate, facturacionSaludController.eliminarOcHes);

// Consulta de una factura, "Graba Factura" y guías de despacho (réplica de ADLSOFT)
router.get('/facturas/consulta', authenticate, facturacionSaludController.consultarFactura);
router.post('/prefacturas/:id/grabar', authenticate, facturacionSaludController.grabarFactura);
router.get('/guias/pendientes', authenticate, facturacionSaludController.listarGuiasPendientes);
router.post('/guias/neto', authenticate, facturacionSaludController.calcularNetoGuias);
router.post('/prefacturas/:id/guias/reservar', authenticate, facturacionSaludController.reservarGuias);
router.post('/prefacturas/:id/guias/liberar', authenticate, facturacionSaludController.liberarGuias);
router.get('/prefacturas/:id/pdf-resumen', authenticate, facturacionSaludController.descargarPdfResumen);
router.get('/prefacturas/:id/pdf-detalle', authenticate, facturacionSaludController.descargarPdfDetalle);
router.get('/prefacturas/:id/datos-resumen', authenticate, facturacionSaludController.datosExcelResumen);
router.get('/prefacturas/:id/datos-detalle', authenticate, facturacionSaludController.datosExcelDetalle);

// Otras ventas, notas de crédito/débito y sus archivos planos (réplica de ADLSOFT)
router.get('/maestros/documentos', authenticate, facturacionSaludController.getMaestrosDocumentos);
router.get('/otras-ventas/casos-factura', authenticate, facturacionSaludController.listarCasosDeFactura);
router.post('/otras-ventas/nota-credito-casos', authenticate, facturacionSaludController.crearNotaCreditoCasos);
router.get('/otras-ventas', authenticate, facturacionSaludController.listarOtrasVentas);
router.get('/otras-ventas/referencia', authenticate, facturacionSaludController.buscarReferenciaOtrasVentas);
router.post('/otras-ventas', authenticate, facturacionSaludController.crearOtraVenta);
router.put('/otras-ventas/:id/:accion', authenticate, facturacionSaludController.modificarOtraVenta);
router.get('/dte/otras/:flujo', authenticate, facturacionSaludController.listarDocumentosArchivo);
router.post('/dte/otras/:flujo/exportar', authenticate, facturacionSaludController.exportarDocumentosArchivo);

router.get('/prefacturas/:id/excel', authenticate, facturacionSaludController.descargarExcelPrefactura);

// 3. Otras Ventas / Otros Cobros y Notas de Crédito / Débito (facturacion_otro)
router.get('/otros-cobros', authenticate, facturacionSaludController.listarOtrosCobros);
router.get('/otros-cobros/referencia', authenticate, facturacionSaludController.buscarFacturaReferencia);
router.post('/otros-cobros', authenticate, facturacionSaludController.crearOtroCobro);

// 4. Exportación de Facturación Electrónica DTE (35 columnas felectronicatxt)
router.get('/dte/documentos', authenticate, facturacionSaludController.listarDocumentosDte);
router.post('/dte/exportar', authenticate, facturacionSaludController.generarArchivoDte);

export default router;

