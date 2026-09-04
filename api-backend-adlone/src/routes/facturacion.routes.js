import express from 'express';
import multer from 'multer';
import facturacionController from '../controllers/facturacion.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';
import { protectWebClientesService } from '../middlewares/protectWebClientesService.js';

const uploadOc = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const router = express.Router();

// Fase 1 — motor de precios / cola de casos facturables (solo lectura).
router.get('/casos-facturables', authenticate, verifyPermission('FAC_PROCESAR'), facturacionController.getCasosFacturables);

// Vista previa del PDF de una selección de casos, sin persistir ni bloquear nada.
router.post('/prefacturas/preview-pdf', authenticate, verifyPermission('FAC_PROCESAR'), facturacionController.generarPdfPreview);

// Fase 2 — crear pre-facturas (agrupa, congela precio y bloquea los casos).
router.post('/prefacturas', authenticate, verifyPermission('FAC_PREFACTURAS_CREAR'), facturacionController.crearPrefacturas);
router.get('/prefacturas', authenticate, verifyPermission('FAC_PREFACTURAS_VER'), facturacionController.listarPrefacturas);
router.get('/prefacturas/:id', authenticate, verifyPermission('FAC_PREFACTURAS_VER'), facturacionController.getPrefacturaDetalle);
// Corrección antes de emitir: errores de tipeo, casos mal incluidos, o anular
// completo devolviendo los casos a la cola de facturables.
router.put('/prefacturas/:id', authenticate, verifyPermission('FAC_PREFACTURAS_CREAR'), facturacionController.actualizarPrefactura);
router.delete('/prefacturas/:id/casos/:idPfCaso', authenticate, verifyPermission('FAC_PREFACTURAS_CREAR'), facturacionController.quitarCasoDePrefactura);
router.post('/prefacturas/:id/anular', authenticate, verifyPermission('FAC_PREFACTURAS_CREAR'), facturacionController.anularPrefactura);

// Fase 3 — PDF, envío por email, y registro de OC/HES.
router.post('/prefacturas/:id/pdf', authenticate, verifyPermission('FAC_PREFACTURAS_PDF'), facturacionController.generarPdfs);
router.post('/prefacturas/:id/enviar', authenticate, verifyPermission('FAC_PREFACTURAS_EMAIL'), facturacionController.enviarPorEmail);
router.post('/prefacturas/:id/ordenes-compra', authenticate, verifyPermission('FAC_OC_REGISTRAR'), facturacionController.registrarOrdenCompra);

// Fase 4 — emisión: archivo plano al Sistema de Ventas.
router.post('/emision/archivo-plano', authenticate, verifyPermission('FAC_EMISION'), facturacionController.generarArchivoPlano);
router.get('/emision/lotes', authenticate, verifyPermission('FAC_PREFACTURAS_VER'), facturacionController.listarLotesEmision);

// Fase 5 — dashboard y UF automática.
router.get('/dashboard', authenticate, verifyPermission('FAC_DASHBOARD'), facturacionController.getDashboard);
router.post('/uf/actualizar', authenticate, verifyPermission('FAC_UF_ADMIN'), facturacionController.actualizarUf);
router.get('/uf/historial', authenticate, verifyPermission('FAC_UF_ADMIN'), facturacionController.listarUfHistorial);
router.post('/uf/manual', authenticate, verifyPermission('FAC_UF_ADMIN'), facturacionController.registrarUfManual);

// Maestros reales de ADL Soft (LaboratorioADL): forma de pago y glosa.
router.get('/maestros/formas-pago', authenticate, verifyPermission('FAC_PROCESAR'), facturacionController.listarFormasPago);
router.get('/maestros/glosas', authenticate, verifyPermission('FAC_PROCESAR'), facturacionController.listarGlosas);

// Configuración — snapshot por cliente (email de facturación, requiere OC/HES, datos del Sistema de Ventas).
router.get('/cliente-config/:idEmpresaServicio', authenticate, verifyPermission('FAC_UF_ADMIN'), facturacionController.getClienteConfig);
router.post('/cliente-config/:idEmpresaServicio', authenticate, verifyPermission('FAC_UF_ADMIN'), facturacionController.upsertClienteConfig);

// Fase 6 — portal de clientes (ADL WEB GO).
router.post('/prefacturas/:id/portal', authenticate, verifyPermission('FAC_PREFACTURAS_EMAIL'), facturacionController.publicarEnPortal);
router.post('/interno/oc-portal', protectWebClientesService, facturacionController.recibirOrdenCompraDesdePortal);

// Fase 7 — bandeja de OCs (intake asistido, respaldo del portal).
router.post('/prefacturas/:id/oc-candidatos', authenticate, verifyPermission('FAC_OC_REGISTRAR'), uploadOc.single('archivo'), facturacionController.crearCandidatoOc);
// OC anticipada: llega antes que la pre-factura, se guarda contra el cliente.
router.post('/oc-candidatos', authenticate, verifyPermission('FAC_OC_REGISTRAR'), uploadOc.single('archivo'), facturacionController.crearCandidatoOc);
router.get('/oc-candidatos', authenticate, verifyPermission('FAC_OC_REGISTRAR'), facturacionController.listarCandidatosOc);
router.post('/oc-candidatos/:id/confirmar', authenticate, verifyPermission('FAC_OC_REGISTRAR'), facturacionController.confirmarCandidatoOc);
router.post('/oc-candidatos/:id/descartar', authenticate, verifyPermission('FAC_OC_REGISTRAR'), facturacionController.descartarCandidatoOc);

// Fase 8 — estado de cuenta (sin pago en línea).
router.get('/estado-cuenta/:idEmpresaServicio', authenticate, verifyPermission('FAC_PREFACTURAS_VER'), facturacionController.getEstadoCuenta);
router.post('/emision/:id/marcar-pagada', authenticate, verifyPermission('FAC_FOLIO'), facturacionController.marcarFacturaPagada);

// Fase 9 — motor de precios (resolución) + cotizaciones.
router.get('/precios/resolver', authenticate, verifyPermission('FAC_PRECIOS_ADMIN'), facturacionController.resolverPrecio);
// Tablas MA con tarifa para un cliente+centro: sin elegir tabla el motor no
// puede resolver ningún precio (ninguna tarifa cargada es genérica).
router.get('/precios/tablas', authenticate, verifyPermission('FAC_COTIZACIONES_VER'), facturacionController.listarTablasDeConvenio);
router.post('/cotizaciones', authenticate, verifyPermission('FAC_COTIZACIONES_CREAR'), facturacionController.crearCotizacion);
router.get('/cotizaciones', authenticate, verifyPermission('FAC_COTIZACIONES_VER'), facturacionController.listarCotizaciones);
// Puente con el portal (ADL WEB GO / WebClientesV2): bandeja de solicitudes.
// Registrada ANTES de '/cotizaciones/:id' — si no, ese wildcard la captura
// tratando "portal-solicitudes" como un id (mismo motivo que ya documenta
// el comentario de montaje '/api/v1' antes de '/api' en WebClientesV2).
router.post('/interno/cotizacion-solicitada', protectWebClientesService, facturacionController.recibirSolicitudCotizacionPortal);
router.post('/interno/cotizacion-evento', protectWebClientesService, facturacionController.registrarEventoPortal);
router.get('/cotizaciones/bandeja', authenticate, verifyPermission('FAC_COTIZACIONES_VER'), facturacionController.listarBandejaCotizaciones);
router.get('/cotizaciones/portal-solicitudes', authenticate, verifyPermission('FAC_COTIZACIONES_VER'), facturacionController.listarSolicitudesCotizacionPortal);
router.get('/cotizaciones/portal-solicitudes/:id', authenticate, verifyPermission('FAC_COTIZACIONES_VER'), facturacionController.getSolicitudPortal);
router.get('/cotizaciones/portal-solicitudes/:id/mensajes', authenticate, verifyPermission('FAC_COTIZACIONES_VER'), facturacionController.listarMensajesSolicitudPortal);
// Los mensajes al portal pueden llevar archivos (Word, PDF, imágenes) — el
// mismo límite de 15 MB que la carga de OCs.
router.post('/cotizaciones/portal-solicitudes/:id/mensajes', authenticate, verifyPermission('FAC_COTIZACIONES_CREAR'), uploadOc.array('archivos', 10), facturacionController.enviarMensajeSolicitudPortal);
router.get('/cotizaciones/portal-solicitudes/:id/adjuntos', authenticate, verifyPermission('FAC_COTIZACIONES_VER'), facturacionController.listarAdjuntosSolicitudPortal);
router.get('/cotizaciones/portal-solicitudes/:id/adjuntos/:idAdjunto', authenticate, verifyPermission('FAC_COTIZACIONES_VER'), facturacionController.descargarAdjuntoSolicitudPortal);
router.post('/cotizaciones/portal-solicitudes/:id/marcar-vista', authenticate, verifyPermission('FAC_COTIZACIONES_VER'), facturacionController.marcarVistaStaffPortal);

router.get('/cotizaciones/:id', authenticate, verifyPermission('FAC_COTIZACIONES_VER'), facturacionController.getCotizacionDetalle);
router.post('/cotizaciones/:id/estado', authenticate, verifyPermission('FAC_COTIZACIONES_CREAR'), facturacionController.cambiarEstadoCotizacion);
router.post('/cotizaciones/:id/vincular-portal', authenticate, verifyPermission('FAC_COTIZACIONES_CREAR'), facturacionController.vincularCotizacionAPortal);
router.post('/cotizaciones/:id/publicar-portal', authenticate, verifyPermission('FAC_COTIZACIONES_CREAR'), facturacionController.publicarCotizacionEnPortal);
// Precio a mano: para análisis sin tarifa y líneas que no son del catálogo.
router.put('/cotizaciones/:id/items/:idItem/precio', authenticate, verifyPermission('FAC_COTIZACIONES_CREAR'), facturacionController.actualizarPrecioItemCotizacion);
router.get('/cotizaciones/:id/pdf', authenticate, verifyPermission('FAC_COTIZACIONES_VER'), facturacionController.descargarPdfCotizacion);
// Cotización → ficha: precarga del formulario y marca de conversión.
router.get('/cotizaciones/:id/para-ficha', authenticate, verifyPermission('FAC_COTIZACIONES_VER'), facturacionController.getCotizacionParaFicha);
router.post('/cotizaciones/:id/marcar-convertida', authenticate, verifyPermission('FAC_COTIZACIONES_CREAR'), facturacionController.marcarCotizacionConvertida);
router.get('/cotizaciones/:id/mensajes-portal', authenticate, verifyPermission('FAC_COTIZACIONES_VER'), facturacionController.listarMensajesCotizacionPortal);
router.post('/cotizaciones/:id/mensajes-portal', authenticate, verifyPermission('FAC_COTIZACIONES_CREAR'), facturacionController.enviarMensajeCotizacionPortal);

// Fase 10 — recurrencia y convenio.
router.get('/fichas-proximas-renovar', authenticate, verifyPermission('FAC_DASHBOARD'), facturacionController.getFichasProximasARenovar);
router.get('/tarifas-vigentes/:idEmpresaServicio', authenticate, verifyPermission('FAC_PRECIOS_ADMIN'), facturacionController.getTarifasVigentesCliente);

export default router;
