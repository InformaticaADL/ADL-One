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
                fecha_rec_ini = null,
                fecha_rec_fin = null,
                fecha_inf_ini = null,
                fecha_inf_fin = null,
                ensilaje = 'false',
                proa = 'false'
            } = req.query;

            const data = await facturacionSaludService.getEmpresasConCasosElegibles({
                eligeprograma: Number(eligeprograma) || 4,
                id_empresaservicio: id_empresaservicio ? Number(id_empresaservicio) : null,
                fecha_rec_ini,
                fecha_rec_fin,
                fecha_inf_ini,
                fecha_inf_fin,
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
                fecha_rec_ini = null,
                fecha_rec_fin = null,
                fecha_inf_ini = null,
                fecha_inf_fin = null,
                ensilaje = 'false',
                proa = 'false'
            } = req.query;

            const data = await facturacionSaludService.getCasosElegiblesPorEmpresa({
                eligeprograma: Number(eligeprograma) || 4,
                id_empresaservicio: id_empresaservicio ? Number(id_empresaservicio) : null,
                fecha_rec_ini,
                fecha_rec_fin,
                fecha_inf_ini,
                fecha_inf_fin,
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
}

export default new FacturacionSaludController();
