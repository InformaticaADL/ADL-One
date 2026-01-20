import { catalogosService } from '../services/catalogos.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

export const catalogosController = {
    getLugaresAnalisis: async (req, res) => {
        try {
            const data = await catalogosService.getLugaresAnalisis();
            return successResponse(res, data, 'Lugares de análisis retrieved successfully');
        } catch (error) {
            return errorResponse(res, error.message, 500);
        }
    },

    getEmpresasServicio: async (req, res) => {
        try {
            const { sedeId } = req.query;
            const data = await catalogosService.getEmpresasServicio(sedeId);
            return successResponse(res, data, 'Empresas de servicio retrieved successfully');
        } catch (error) {
            return errorResponse(res, error.message, 500);
        }
    },

    getClientes: async (req, res) => {
        try {
            const { empresaId } = req.query;
            const data = await catalogosService.getClientes(empresaId);
            return successResponse(res, data, 'Clientes retrieved successfully');
        } catch (error) {
            return errorResponse(res, error.message, 500);
        }
    },

    getContactos: async (req, res) => {
        try {
            const { clienteId } = req.query;
            const data = await catalogosService.getContactos(clienteId);
            return successResponse(res, data, 'Contactos retrieved successfully');
        } catch (error) {
            return errorResponse(res, error.message, 500);
        }
    },

    getCentros: async (req, res) => {
        try {
            const { clienteId } = req.query;
            const data = await catalogosService.getCentros(clienteId);
            return successResponse(res, data, 'Centros retrieved successfully');
        } catch (error) {
            return errorResponse(res, error.message, 500);
        }
    },
    getObjetivosMuestreo: async (req, res) => {
        try {
            const { clienteId } = req.query;
            const data = await catalogosService.getObjetivosMuestreo(clienteId);
            return successResponse(res, data, 'Objetivos Muestreo retrieved successfully');
        } catch (error) {
            return errorResponse(res, error.message, 500);
        }
    },

    getComponentesAmbientales: async (req, res) => {
        try {
            const data = await catalogosService.getComponentesAmbientales();
            return successResponse(res, data, 'Componentes Ambientales retrieved successfully');
        } catch (error) {
            return errorResponse(res, error.message, 500);
        }
    },

    getSubAreas: async (req, res) => {
        try {
            const { componenteId } = req.query;
            const data = await catalogosService.getSubAreas(componenteId);
            return successResponse(res, data, 'SubAreas retrieved successfully');
        } catch (error) {
            return errorResponse(res, error.message, 500);
        }
    },

    getInspectores: async (req, res) => {
        try {
            const data = await catalogosService.getInspectores();
            return successResponse(res, data, 'Inspectores retrieved successfully');
        } catch (error) {
            return errorResponse(res, error.message, 500);
        }
    },

    getTiposMuestreo: async (req, res) => {
        try {
            const data = await catalogosService.getTiposMuestreo();
            return successResponse(res, data, 'Tipos Muestreo retrieved successfully');
        } catch (error) {
            return errorResponse(res, error.message, 500);
        }
    },

    getTiposMuestra: async (req, res) => {
        try {
            const { tipoMuestreoId } = req.query;
            const data = await catalogosService.getTiposMuestra(tipoMuestreoId);
            return successResponse(res, data, 'Tipos Muestra retrieved successfully');
        } catch (error) {
            return errorResponse(res, error.message, 500);
        }
    },

    getActividadesMuestreo: async (req, res) => {
        try {
            const { tipoMuestraId } = req.query;
            const data = await catalogosService.getActividadesMuestreo(tipoMuestraId);
            return successResponse(res, data, 'Actividades Muestreo retrieved successfully');
        } catch (error) {
            return errorResponse(res, error.message, 500);
        }
    },

    getTiposDescarga: async (req, res) => {
        try {
            const data = await catalogosService.getTiposDescarga();
            return successResponse(res, data, 'Tipos Descarga retrieved successfully');
        } catch (error) {
            return errorResponse(res, error.message, 500);
        }
    },

    getModalidades: async (req, res) => {
        try {
            const data = await catalogosService.getModalidades();
            return successResponse(res, data, 'Modalidades retrieved successfully');
        } catch (error) {
            return errorResponse(res, error.message, 500);
        }
    },

    getCargos: async (req, res) => {
        try {
            const data = await catalogosService.getCargos();
            return successResponse(res, data, 'Cargos retrieved successfully');
        } catch (error) {
            return errorResponse(res, error.message, 500);
        }
    },

    getFrecuenciasPeriodo: async (req, res) => {
        try {
            const data = await catalogosService.getFrecuenciasPeriodo();
            return successResponse(res, data, 'Frecuencias Periodo retrieved successfully');
        } catch (error) {
            return errorResponse(res, error.message, 500);
        }
    },

    getFormasCanal: async (req, res) => {
        try {
            const data = await catalogosService.getFormasCanal();
            return successResponse(res, data, 'Formas Canal retrieved successfully');
        } catch (error) {
            return errorResponse(res, error.message, 500);
        }
    },

    getDispositivosHidraulicos: async (req, res) => {
        try {
            const data = await catalogosService.getDispositivosHidraulicos();
            return successResponse(res, data, 'Dispositivos Hidraulicos retrieved successfully');
        } catch (error) {
            return errorResponse(res, error.message, 500);
        }
    },
};
