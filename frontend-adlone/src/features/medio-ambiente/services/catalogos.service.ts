import axios, { AxiosError } from 'axios';
import API_CONFIG from '../../../config/api.config';

// Create axios instance with optimized configuration
const axiosInstance = axios.create({
    baseURL: `${API_CONFIG.getBaseURL()}/api/catalogos`,
    timeout: 15000, // 15 seconds timeout
    headers: {
        // Note: Accept-Encoding is set automatically by browsers
        'Content-Type': 'application/json'
    }
});

// Request deduplication map to prevent duplicate simultaneous requests
const pendingRequests = new Map<string, Promise<any>>();

// Retry logic with exponential backoff
const retryRequest = async (
    fn: () => Promise<any>,
    retries = 3,
    delay = 1000
): Promise<any> => {
    try {
        return await fn();
    } catch (error) {
        if (retries === 0) throw error;

        const axiosError = error as AxiosError;
        const shouldRetry =
            axiosError.code === 'ECONNABORTED' ||
            axiosError.code === 'ETIMEDOUT' ||
            (axiosError.response?.status && axiosError.response.status >= 500);

        if (!shouldRetry) throw error;

        await new Promise(resolve => setTimeout(resolve, delay));
        return retryRequest(fn, retries - 1, delay * 2); // Exponential backoff
    }
};

// Request deduplication wrapper
const deduplicatedRequest = async <T>(
    key: string,
    requestFn: () => Promise<T>
): Promise<T> => {
    // If request is already pending, return the existing promise
    if (pendingRequests.has(key)) {
        return pendingRequests.get(key) as Promise<T>;
    }

    // Create new request promise
    const requestPromise = retryRequest(requestFn)
        .finally(() => {
            // Remove from pending requests when complete
            pendingRequests.delete(key);
        });

    pendingRequests.set(key, requestPromise);
    return requestPromise;
};

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


export const catalogosService = {
    getLugaresAnalisis: async (): Promise<LugarAnalisis[]> => {
        return deduplicatedRequest('lugares-analisis', async () => {
            const response = await axiosInstance.get('/lugares-analisis');
            return response.data.data;
        });
    },

    getEmpresasServicio: async (sedeId?: number): Promise<EmpresaServicio[]> => {
        const key = `empresas-servicio${sedeId ? `-${sedeId}` : ''}`;
        return deduplicatedRequest(key, async () => {
            const response = await axiosInstance.get('/empresas-servicio', {
                params: { sedeId }
            });
            return response.data.data;
        });
    },

    getClientes: async (empresaId?: number): Promise<Cliente[]> => {
        const key = `clientes${empresaId ? `-${empresaId}` : ''}`;
        return deduplicatedRequest(key, async () => {
            const response = await axiosInstance.get('/clientes', {
                params: { empresaId }
            });
            return response.data.data;
        });
    },

    getContactos: async (clienteId?: number): Promise<Contacto[]> => {
        const key = `contactos${clienteId ? `-${clienteId}` : ''}`;
        return deduplicatedRequest(key, async () => {
            const response = await axiosInstance.get('/contactos', {
                params: { clienteId }
            });
            return response.data.data;
        });
    },

    getCentros: async (clienteId?: number): Promise<Centro[]> => {
        const key = `centros${clienteId ? `-${clienteId}` : ''}`;
        return deduplicatedRequest(key, async () => {
            const response = await axiosInstance.get('/centros', {
                params: { clienteId }
            });
            return response.data.data;
        });
    },

    // Bloque 2: Datos del Servicio y Muestreo
    // Bloque 2: Datos del Servicio y Muestreo
    getObjetivosMuestreo: async (clienteId?: number): Promise<any[]> => {
        const key = `objetivos-muestreo${clienteId ? `-${clienteId}` : ''}`;
        return deduplicatedRequest(key, async () => {
            const response = await axiosInstance.get('/objetivos-muestreo', { params: { clienteId } });
            return response.data.data;
        });
    },

    getComponentesAmbientales: async (): Promise<any[]> => {
        return deduplicatedRequest('componentes-ambientales', async () => {
            const response = await axiosInstance.get('/componentes-ambientales');
            return response.data.data;
        });
    },

    getSubAreas: async (componenteId: string): Promise<any[]> => {
        return deduplicatedRequest(`subareas-${componenteId}`, async () => {
            const response = await axiosInstance.get('/subareas', { params: { componenteId } });
            return response.data.data;
        });
    },

    getInspectores: async (): Promise<any[]> => {
        return deduplicatedRequest('inspectores', async () => {
            const response = await axiosInstance.get('/inspectores');
            return response.data.data;
        });
    },

    getTiposMuestreo: async (): Promise<any[]> => {
        return deduplicatedRequest('tipos-muestreo', async () => {
            const response = await axiosInstance.get('/tipos-muestreo');
            return response.data.data;
        });
    },

    getTiposMuestra: async (tipoMuestreoId: string): Promise<any[]> => {
        return deduplicatedRequest(`tipos-muestra-${tipoMuestreoId}`, async () => {
            const response = await axiosInstance.get('/tipos-muestra', { params: { tipoMuestreoId } });
            return response.data.data;
        });
    },

    getActividadesMuestreo: async (tipoMuestraId: string): Promise<any[]> => {
        return deduplicatedRequest(`actividades-muestreo-${tipoMuestraId}`, async () => {
            const response = await axiosInstance.get('/actividades-muestreo', { params: { tipoMuestraId } });
            return response.data.data;
        });
    },

    getTiposDescarga: async (): Promise<any[]> => {
        return deduplicatedRequest('tipos-descarga', async () => {
            const response = await axiosInstance.get('/tipos-descarga');
            return response.data.data;
        });
    },

    getModalidades: async (): Promise<any[]> => {
        return deduplicatedRequest('modalidades', async () => {
            const response = await axiosInstance.get('/modalidades');
            return response.data.data;
        });
    },

    getCargos: async (): Promise<any[]> => {
        return deduplicatedRequest('cargos', async () => {
            const response = await axiosInstance.get('/cargos');
            return response.data.data;
        });
    },

    getFrecuenciasPeriodo: async (): Promise<any[]> => {
        return deduplicatedRequest('frecuencias-periodo', async () => {
            const response = await axiosInstance.get('/frecuencias-periodo');
            return response.data.data;
        });
    },

    getFormasCanal: async (): Promise<any[]> => {
        return deduplicatedRequest('formas-canal', async () => {
            const response = await axiosInstance.get('/formas-canal');
            return response.data.data;
        });
    },

    getDispositivosHidraulicos: async (): Promise<any[]> => {
        return deduplicatedRequest('dispositivos-hidraulicos', async () => {
            const response = await axiosInstance.get('/dispositivos-hidraulicos');
            return response.data.data;
        });
    },

    getMuestreadores: async (): Promise<any[]> => {
        return deduplicatedRequest('muestreadores', async () => {
            const response = await axiosInstance.get('/muestreadores');
            return response.data.data;
        });
    },

    getCoordinadores: async (): Promise<any[]> => {
        return deduplicatedRequest('coordinadores', async () => {
            const response = await axiosInstance.get('/coordinadores');
            return response.data.data;
        });
    },
};
