import axios from 'axios';
import API_CONFIG from '../../../config/api.config';

// Define types based on expected DB response
export interface LugarAnalisis {
    id: number;
    nombre: string;
}

export interface EmpresaServicio {
    id: number;
    nombre: string;
}

export interface Cliente {
    id: number;
    nombre: string;
}

export interface Contacto {
    id: number;
    nombre: string;
    email?: string;
    telefono?: string;
}

export interface Centro {
    id: number;
    nombre: string;
    direccion?: string;
    ubicacion?: string;
    comuna?: string;
    region?: string;
    nombre_comuna?: string;
    nombre_region?: string;
    codigo?: string;
    tipo_agua?: string;
}

const BASE_URL = `${API_CONFIG.getBaseURL()}/api/catalogos`;

export const catalogosService = {
    getLugaresAnalisis: async (): Promise<LugarAnalisis[]> => {
        try {
            const response = await axios.get(`${BASE_URL}/lugares-analisis`);
            return response.data.data;
        } catch (error) {
            console.error('Error fetching Lugares de Analisis:', error);
            throw error;
        }
    },

    getEmpresasServicio: async (sedeId?: number): Promise<EmpresaServicio[]> => {
        try {
            const response = await axios.get(`${BASE_URL}/empresas-servicio`, {
                params: { sedeId }
            });
            return response.data.data;
        } catch (error) {
            console.error('Error fetching Empresas Servicio:', error);
            throw error;
        }
    },

    getClientes: async (empresaId?: number): Promise<Cliente[]> => {
        try {
            const response = await axios.get(`${BASE_URL}/clientes`, {
                params: { empresaId }
            });
            return response.data.data;
        } catch (error) {
            console.error('Error fetching Clientes:', error);
            throw error;
        }
    },

    getContactos: async (clienteId?: number): Promise<Contacto[]> => {
        try {
            const response = await axios.get(`${BASE_URL}/contactos`, {
                params: { clienteId }
            });
            return response.data.data;
        } catch (error) {
            console.error('Error fetching Contactos:', error);
            throw error;
        }
    },

    getCentros: async (clienteId?: number): Promise<Centro[]> => {
        try {
            const response = await axios.get(`${BASE_URL}/centros`, {
                params: { clienteId }
            });
            return response.data.data;
        } catch (error) {
            console.error('Error fetching Centros:', error);
            throw error;
        }
    },

    // Bloque 2: Datos del Servicio y Muestreo
    // Bloque 2: Datos del Servicio y Muestreo
    getObjetivosMuestreo: async (clienteId?: number): Promise<any[]> => {
        try {
            const response = await axios.get(`${BASE_URL}/objetivos-muestreo`, { params: { clienteId } });
            return response.data.data;
        } catch (error) {
            console.error('Error fetching Objetivos:', error);
            throw error;
        }
    },

    getComponentesAmbientales: async (): Promise<any[]> => {
        try {
            const response = await axios.get(`${BASE_URL}/componentes-ambientales`);
            return response.data.data;
        } catch (error) {
            console.error('Error fetching Componentes Ambientales:', error);
            throw error;
        }
    },

    getSubAreas: async (componenteId: string): Promise<any[]> => {
        try {
            const response = await axios.get(`${BASE_URL}/subareas`, { params: { componenteId } });
            return response.data.data;
        } catch (error) {
            console.error('Error fetching SubAreas:', error);
            throw error;
        }
    },

    getInspectores: async (): Promise<any[]> => {
        try {
            const response = await axios.get(`${BASE_URL}/inspectores`);
            return response.data.data;
        } catch (error) {
            console.error('Error fetching Inspectores:', error);
            throw error;
        }
    },

    getTiposMuestreo: async (): Promise<any[]> => {
        try {
            const response = await axios.get(`${BASE_URL}/tipos-muestreo`);
            return response.data.data;
        } catch (error) {
            console.error('Error fetching Tipos Muestreo:', error);
            throw error;
        }
    },

    getTiposMuestra: async (tipoMuestreoId: string): Promise<any[]> => {
        try {
            const response = await axios.get(`${BASE_URL}/tipos-muestra`, { params: { tipoMuestreoId } });
            return response.data.data;
        } catch (error) {
            console.error('Error fetching Tipos Muestreo:', error);
            throw error;
        }
    },

    getActividadesMuestreo: async (tipoMuestraId: string): Promise<any[]> => {
        try {
            const response = await axios.get(`${BASE_URL}/actividades-muestreo`, { params: { tipoMuestraId } });
            return response.data.data;
        } catch (error) {
            console.error('Error fetching Actividades Muestreo:', error);
            throw error;
        }
    },

    getTiposDescarga: async (): Promise<any[]> => {
        try {
            const response = await axios.get(`${BASE_URL}/tipos-descarga`);
            return response.data.data;
        } catch (error) {
            console.error('Error fetching Tipos Descarga:', error);
            throw error;
        }
    },

    getModalidades: async (): Promise<any[]> => {
        try {
            const response = await axios.get(`${BASE_URL}/modalidades`);
            return response.data.data;
        } catch (error) {
            console.error('Error fetching Modalidades:', error);
            throw error;
        }
    },

    getCargos: async (): Promise<any[]> => {
        try {
            const response = await axios.get(`${BASE_URL}/cargos`);
            return response.data.data;
        } catch (error) {
            console.error('Error fetching Cargos:', error);
            throw error;
        }
    },

    getFrecuenciasPeriodo: async (): Promise<any[]> => {
        try {
            const response = await axios.get(`${BASE_URL}/frecuencias-periodo`);
            return response.data.data;
        } catch (error) {
            console.error('Error fetching Frecuencias Periodo:', error);
            throw error;
        }
    },

    getFormasCanal: async (): Promise<any[]> => {
        try {
            const response = await axios.get(`${BASE_URL}/formas-canal`);
            return response.data.data;
        } catch (error) {
            console.error('Error fetching Formas Canal:', error);
            throw error;
        }
    },

    getDispositivosHidraulicos: async (): Promise<any[]> => {
        try {
            const response = await axios.get(`${BASE_URL}/dispositivos-hidraulicos`);
            return response.data.data;
        } catch (error) {
            console.error('Error fetching Dispositivos Hidraulicos:', error);
            throw error;
        }
    },
};
