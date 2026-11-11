import facturacionSaludService from '../services/facturacion-salud.service.js';
import logger from '../utils/logger.js';

class FacturacionSaludController {
    async getDashboard(req, res) {
        try {
            const data = await facturacionSaludService.getDashboardSalud();
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.getDashboard:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al obtener dashboard de Facturación Salud' });
        }
    }

    async getMaestros(req, res) {
        try {
            const data = await facturacionSaludService.getMaestrosSalud();
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.getMaestros:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al obtener catálogos de Facturación Salud' });
        }
    }

    async getEmpresasElegibles(req, res) {
        try {
            const {
                eligeprograma = 4,
                id_empresaservicio = null,
                fecha_proceso_ini = null,
                fecha_proceso_fin = null,
                ensilaje = 'false',
                proa = 'false'
            } = req.query;

            const data = await facturacionSaludService.getEmpresasConCasosElegibles({
                eligeprograma: Number(eligeprograma) || 4,
                id_empresaservicio: id_empresaservicio ? Number(id_empresaservicio) : null,
                fecha_proceso_ini,
                fecha_proceso_fin,
                ensilaje: ensilaje === 'true' || ensilaje === '1',
                proa: proa === 'true' || proa === '1'
            });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.getEmpresasElegibles:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al obtener empresas con casos pendientes' });
        }
    }

    async getCasosElegibles(req, res) {
        try {
            const {
                eligeprograma = 4,
                id_empresaservicio = null,
                fecha_proceso_ini = null,
                fecha_proceso_fin = null,
                ensilaje = 'false',
                proa = 'false'
            } = req.query;

            const data = await facturacionSaludService.getCasosElegiblesPorEmpresa({
                eligeprograma: Number(eligeprograma) || 4,
                id_empresaservicio: id_empresaservicio ? Number(id_empresaservicio) : null,
                fecha_proceso_ini,
                fecha_proceso_fin,
                ensilaje: ensilaje === 'true' || ensilaje === '1',
                proa: proa === 'true' || proa === '1'
            });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.getCasosElegibles:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al obtener casos elegibles' });
        }
    }

    async valorizarCasos(req, res) {
        try {
            const data = await facturacionSaludService.valorizarCasosSalud(req.body);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.valorizarCasos:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al valorizar casos de salud' });
        }
    }

    async actualizarLineaCasoManual(req, res) {
        try {
            const data = await facturacionSaludService.actualizarLineaCasoManual(req.body);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.actualizarLineaCasoManual:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al actualizar valor unitario del caso' });
        }
    }

    async previsualizarPrefacturas(req, res) {
        try {
            const data = await facturacionSaludService.previsualizarPrefacturasSalud(req.body);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.previsualizarPrefacturas:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al pre-ver la facturación de salud' });
        }
    }

    async crearPrefacturas(req, res) {
        try {
            const data = await facturacionSaludService.crearPrefacturasSalud(req.body);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.crearPrefacturas:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al crear pre-facturas de salud' });
        }
    }

    async listarPrefacturas(req, res) {
        try {
            const { emitido = 'ALL', id_empresaservicio = null, busqueda = '', limite = 300 } = req.query;
            const data = await facturacionSaludService.listarPrefacturasSalud({
                emitido,
                id_empresaservicio,
                busqueda,
                limite
            });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.listarPrefacturas:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al listar pre-facturas' });
        }
    }

    async getPrefacturaDetalle(req, res) {
        try {
            const { id } = req.params;
            const data = await facturacionSaludService.getPrefacturaSaludDetalle(id);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.getPrefacturaDetalle:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al obtener detalle de pre-factura' });
        }
    }

    async agregarOtroIngreso(req, res) {
        try {
            const { id } = req.params;
            const data = await facturacionSaludService.agregarOtroIngreso({
                id_facturacion: id,
                ...req.body
            });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.agregarOtroIngreso:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al agregar otro ingreso (OI)' });
        }
    }

    async eliminarOtroIngreso(req, res) {
        try {
            const { id, item } = req.params;
            const data = await facturacionSaludService.eliminarOtroIngreso({
                id_facturacion: id,
                id_otrosingresos: item
            });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.eliminarOtroIngreso:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al eliminar otro ingreso (OI)' });
        }
    }

    async agregarOtroDescuento(req, res) {
        try {
            const { id } = req.params;
            const data = await facturacionSaludService.agregarOtroDescuento({
                id_facturacion: id,
                ...req.body
            });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.agregarOtroDescuento:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al agregar otro descuento (OD)' });
        }
    }

    async eliminarOtroDescuento(req, res) {
        try {
            const { id, item } = req.params;
            const data = await facturacionSaludService.eliminarOtroDescuento({
                id_facturacion: id,
                id_otrosdescuentos: item
            });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.eliminarOtroDescuento:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al eliminar otro descuento (OD)' });
        }
    }

    async actualizarPrefactura(req, res) {
        try {
            const { id } = req.params;
            const data = await facturacionSaludService.actualizarDatosPrefactura({
                id_facturacion: id,
                ...req.body
            });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.actualizarPrefactura:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al actualizar pre-factura' });
        }
    }

    async eliminarPrefactura(req, res) {
        try {
            const { id } = req.params;
            const data = await facturacionSaludService.eliminarPrefacturaSalud(id);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.eliminarPrefactura:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al eliminar y liberar pre-factura' });
        }
    }

    async quitarCasoPrefactura(req, res) {
        try {
            const { id, idCaso } = req.params;
            const data = await facturacionSaludService.quitarCasoDePrefacturaSalud({
                id_facturacion: id,
                id_caso: idCaso
            });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.quitarCasoPrefactura:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al quitar caso de la pre-factura' });
        }
    }

    async cambiarEmpresaCaso(req, res) {
        try {
            const { id_caso, id_empresaservicio } = req.body;
            const data = await facturacionSaludService.cambiarEmpresaFacturarCaso({
                id_caso,
                id_empresaservicio
            });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.cambiarEmpresaCaso:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al cambiar empresa a facturar del caso' });
        }
    }

    async descargarExcelPrefactura(req, res) {
        try {
            const { id } = req.params;
            const { tipo = 'DETALLE' } = req.query;
            await facturacionSaludService.generarExcelRespaldoPrefactura(res, {
                id_facturacion: id,
                tipo: String(tipo).toUpperCase()
            });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.descargarExcelPrefactura:', error);
            if (!res.headersSent) {
                return res.status(500).json({ success: false, message: error.message || 'Error al generar Excel de respaldo' });
            }
        }
    }

    async listarOtrosCobros(req, res) {
        try {
            const { id_tipodocumento = 'ALL', emitido = 'ALL', busqueda = '', limite = 300 } = req.query;
            const data = await facturacionSaludService.listarOtrosCobrosSalud({
                id_tipodocumento,
                emitido,
                busqueda,
                limite
            });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.listarOtrosCobros:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al listar otros cobros / notas' });
        }
    }

    async buscarFacturaReferencia(req, res) {
        try {
            const { folio, origen = 'CASOS' } = req.query;
            const data = await facturacionSaludService.buscarFacturaParaNotaCredito({ folio, origen });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.buscarFacturaReferencia:', error);
            return res.status(404).json({ success: false, message: error.message || 'Error al buscar factura de referencia' });
        }
    }

    async crearOtroCobro(req, res) {
        try {
            const data = await facturacionSaludService.crearDocumentoOtroCobro(req.body);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.crearOtroCobro:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al crear documento (FEA/FEE/NCE/NDE)' });
        }
    }

    async listarDocumentosDte(req, res) {
        try {
            const { flujo = 'FEA_CASOS', solo_pendientes = 'true', busqueda = '' } = req.query;
            const data = await facturacionSaludService.listarDocumentosDteSalud({
                flujo,
                solo_pendientes: solo_pendientes === 'true' || solo_pendientes === '1',
                busqueda
            });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.listarDocumentosDte:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al listar documentos DTE' });
        }
    }

    async generarArchivoDte(req, res) {
        try {
            const { flujo = 'FEA_CASOS', ids_facturacion = [], marcar_emitido = false } = req.body;
            const data = await facturacionSaludService.generarArchivoPlanoDteSalud({
                flujo,
                ids_facturacion,
                marcar_emitido: Boolean(marcar_emitido)
            });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.generarArchivoDte:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al generar archivo plano DTE (35 columnas)' });
        }
    }

    async eliminarFacturaPorNumero(req, res) {
        try {
            const data = await facturacionSaludService.eliminarFacturaPorNumeroSalud(req.params.factura);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.eliminarFacturaPorNumero:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al eliminar la factura' });
        }
    }

    async cambiarEmpresaFactura(req, res) {
        try {
            const data = await facturacionSaludService.cambiarEmpresaFacturaSalud({ id_facturacion: req.params.id, id_empresaservicio: req.body.id_empresaservicio, motivo: req.body.motivo, id_usuario: req.user ? (req.user.id_usuario || req.user.id) : 0 });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.cambiarEmpresaFactura:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al cambiar la empresa a facturar' });
        }
    }

    async listarOc(req, res) {
        try {
            const data = await facturacionSaludService.listarOcSalud(req.params.id);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.listarOc:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al listar las órdenes de compra' });
        }
    }

    async agregarOc(req, res) {
        try {
            const data = await facturacionSaludService.agregarOcSalud({ ...req.body, id_facturacion: req.params.id, id_usuario: req.user ? (req.user.id_usuario || req.user.id) : 0 });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.agregarOc:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al agregar la orden de compra' });
        }
    }

    async eliminarOc(req, res) {
        try {
            const data = await facturacionSaludService.eliminarOcSalud({ ...req.body, id_facturacion: req.params.id, id_usuario: req.user ? (req.user.id_usuario || req.user.id) : 0 });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.eliminarOc:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al eliminar la orden de compra' });
        }
    }

    async grabarOiOd(req, res) {
        try {
            const data = await facturacionSaludService.grabarOiOdSalud(req.body.facturas);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.grabarOiOd:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al grabar otros ingresos y descuentos' });
        }
    }

    async listarFacturasExportacion(req, res) {
        try {
            const data = await facturacionSaludService.listarFacturasExportacionSalud(req.query.estado);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.listarFacturasExportacion:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al listar las facturas para exportar' });
        }
    }

    async exportarFacturasCasos(req, res) {
        try {
            const data = await facturacionSaludService.exportarFacturasCasosSalud(req.body.ids_facturacion);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.exportarFacturasCasos:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al generar el archivo plano' });
        }
    }

    async modificarDatosExportacion(req, res) {
        try {
            const data = await facturacionSaludService.modificarDatosExportacionSalud(req.params.accion, { ...req.body, id_facturacion: req.params.id });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.modificarDatosExportacion:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al guardar los datos de la factura' });
        }
    }

    async agregarOcHes(req, res) {
        try {
            const data = await facturacionSaludService.agregarOcHesSalud({ ...req.body, id_facturacion: req.params.id });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.agregarOcHes:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al agregar la OC / HES' });
        }
    }

    async modificarOcHes(req, res) {
        try {
            const data = await facturacionSaludService.modificarOcHesSalud({ ...req.body, id_facturacion: req.params.id });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.modificarOcHes:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al modificar la OC / HES' });
        }
    }

    async eliminarOcHes(req, res) {
        try {
            const data = await facturacionSaludService.eliminarOcHesSalud({ ...req.body, id_facturacion: req.params.id });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.eliminarOcHes:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al eliminar la OC / HES' });
        }
    }

    async buscarOcEnOtrasFacturas(req, res) {
        try {
            const data = await facturacionSaludService.buscarOcEnOtrasFacturasSalud(req.query.ocompra);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.buscarOcEnOtrasFacturas:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al buscar la orden de compra' });
        }
    }

    async consultarFactura(req, res) {
        try {
            const data = await facturacionSaludService.consultarFacturaSalud({ id_facturacion: req.query.id_facturacion, factura: req.query.factura });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.consultarFactura:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al consultar la factura' });
        }
    }

    async grabarFactura(req, res) {
        try {
            const data = await facturacionSaludService.grabarFacturaSalud({ ...req.body, id_facturacion: req.params.id });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.grabarFactura:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al grabar la factura' });
        }
    }

    async listarGuiasPendientes(req, res) {
        try {
            const data = await facturacionSaludService.listarGuiasPendientesSalud(req.query.id_empresaservicio);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.listarGuiasPendientes:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al listar las guías de despacho' });
        }
    }

    async calcularNetoGuias(req, res) {
        try {
            const data = await facturacionSaludService.calcularNetoGuiasSalud({ ids_gd: req.body.ids_gd, uf: req.body.uf });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.calcularNetoGuias:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al calcular el neto de las guías' });
        }
    }

    async reservarGuias(req, res) {
        try {
            const data = await facturacionSaludService.reservarGuiasSalud({ ids_gd: req.body.ids_gd, uf: req.body.uf, id_facturacion: req.params.id });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.reservarGuias:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al reservar las guías' });
        }
    }

    async liberarGuias(req, res) {
        try {
            const data = await facturacionSaludService.liberarGuiasSalud(req.params.id);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.liberarGuias:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al liberar las guías' });
        }
    }

    async datosExcelResumen(req, res) {
        try {
            const data = await facturacionSaludService.datosExcelResumenSalud(req.params.id);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.datosExcelResumen:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al preparar el resumen' });
        }
    }

    async datosExcelDetalle(req, res) {
        try {
            const data = await facturacionSaludService.datosExcelDetalleSalud(req.params.id, req.query.lote === 'true');
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.datosExcelDetalle:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al preparar el detalle' });
        }
    }

    async listarOtrasVentas(req, res) {
        try {
            const data = await facturacionSaludService.listarOtrasVentasSalud(req.query.estado);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.listarOtrasVentas:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al listar los documentos' });
        }
    }

    async buscarReferenciaOtrasVentas(req, res) {
        try {
            const data = await facturacionSaludService.buscarReferenciaOtrasVentasSalud({ numero: req.query.numero, fecha: req.query.fecha, tipoImpuesto: req.query.tipoImpuesto });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.buscarReferenciaOtrasVentas:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al buscar la factura de referencia' });
        }
    }

    async crearOtraVenta(req, res) {
        try {
            const data = await facturacionSaludService.crearOtraVentaSalud(req.body);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.crearOtraVenta:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al crear el documento' });
        }
    }

    async modificarOtraVenta(req, res) {
        try {
            const data = await facturacionSaludService.modificarOtraVentaSalud(req.params.accion, { ...req.body, id_otroscobros: req.params.id });
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.modificarOtraVenta:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al modificar el documento' });
        }
    }

    async listarDocumentosArchivo(req, res) {
        try {
            const data = await facturacionSaludService.listarDocumentosArchivoSalud(String(req.params.flujo).toUpperCase(), req.query.estado);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.listarDocumentosArchivo:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al listar los documentos del archivo' });
        }
    }

    async exportarDocumentosArchivo(req, res) {
        try {
            const data = await facturacionSaludService.exportarDocumentosArchivoSalud(String(req.params.flujo).toUpperCase(), req.body.ids_facturacion);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.exportarDocumentosArchivo:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al generar el archivo plano' });
        }
    }

    async getMaestrosDocumentos(req, res) {
        try {
            const data = await facturacionSaludService.getMaestrosDocumentosSalud();
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.getMaestrosDocumentos:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al obtener los catálogos de documentos' });
        }
    }

    async listarCasosDeFactura(req, res) {
        try {
            const data = await facturacionSaludService.listarCasosDeFacturaSalud(req.query.id_facturacion);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.listarCasosDeFactura:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al listar los casos de la factura' });
        }
    }

    async crearNotaCreditoCasos(req, res) {
        try {
            const data = await facturacionSaludService.crearNotaCreditoCasosSalud(req.body);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.crearNotaCreditoCasos:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al crear la nota de crédito por casos' });
        }
    }

    async listarOcHes(req, res) {
        try {
            const data = await facturacionSaludService.listarOcHesSalud(req.params.id);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error('Error in FacturacionSaludController.listarOcHes:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al listar las OC y HES' });
        }
    }

    async descargarPdfResumen(req, res) {
        try {
            const { buffer, nombre, ruta } = await facturacionSaludService.generarPdfResumenSalud(req.params.id);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nombre)}"`);
            res.setHeader('X-Nombre-Archivo', encodeURIComponent(nombre));
            res.setHeader('X-Ruta-Guardada', encodeURIComponent(ruta || ''));
            res.setHeader('Access-Control-Expose-Headers', 'X-Nombre-Archivo, X-Ruta-Guardada, Content-Disposition');
            return res.send(buffer);
        } catch (error) {
            logger.error('Error in FacturacionSaludController.descargarPdfResumen:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al generar el PDF de resumen' });
        }
    }

    async descargarPdfDetalle(req, res) {
        try {
            const { buffer, nombre, ruta } = await facturacionSaludService.generarPdfDetalleSalud(req.params.id);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(nombre)}"`);
            res.setHeader('X-Nombre-Archivo', encodeURIComponent(nombre));
            res.setHeader('X-Ruta-Guardada', encodeURIComponent(ruta || ''));
            res.setHeader('Access-Control-Expose-Headers', 'X-Nombre-Archivo, X-Ruta-Guardada, Content-Disposition');
            return res.send(buffer);
        } catch (error) {
            logger.error('Error in FacturacionSaludController.descargarPdfDetalle:', error);
            return res.status(500).json({ success: false, message: error.message || 'Error al generar el PDF de detalle' });
        }
    }
}

export default new FacturacionSaludController();
