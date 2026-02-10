import axios from 'axios';
import API_CONFIG from '../../../config/api.config';

const axiosInstance = axios.create({
    baseURL: `${API_CONFIG.getBaseURL()}/api/admin/equipos`,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add interceptor to include token
axiosInstance.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export interface Equipo {
    id_equipo: number;
    codigo: string;
    nombre: string;
    tipo: string;
    ubicacion: string;
    vigencia: string;
    id_muestreador: number;
    estado: string;
    nombre_asignado?: string;
    sigla?: string;
    correlativo?: number;
    tiene_fc?: string;

    equipo_asociado?: number;
    observacion?: string;
    visible_muestreador?: string;
    que_mide?: string;
    unidad_medida_textual?: string;
    unidad_medida_sigla?: string;
    informe?: string;
    error0?: number;
    error15?: number;
    error30?: number;
    version?: string;
}

export interface EquipoHistorial extends Equipo {
    id_historial: number;
    fecha_cambio: string;
    nombre_usuario_cambio: string;
    version?: string;
}

export interface EquiposResponse {
    success: boolean;
    data: Equipo[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    catalogs?: {
        tipos: string[];
        estados: string[];
        sedes: string[];
        nombres: string[];
    };
}

export const equipoService = {
    getEquipos: async (params: any): Promise<EquiposResponse> => {
        const response = await axiosInstance.get('/', { params });
        return response.data;
    },

    createEquipo: async (data: Partial<Equipo>): Promise<any> => {
        const response = await axiosInstance.post('/', data);
        return response.data;
    },

    getEquipoById: async (id: number): Promise<any> => {
        const response = await axiosInstance.get(`/${id}`);
        return response.data;
    },

    updateEquipo: async (id: number, data: Partial<Equipo>): Promise<any> => {
        const response = await axiosInstance.put(`/${id}`, data);
        return response.data;
    },

    deleteEquipo: async (id: number): Promise<any> => {
        const response = await axiosInstance.delete(`/${id}`);
        return response.data;
    },

    getEquipoHistorial: async (id: number): Promise<any> => {
        const response = await axiosInstance.get(`/${id}/historial`);
        return response.data;
    },

    getNextCorrelativo: async (tipo: string): Promise<any> => {
        const response = await axiosInstance.get(`/next-correlativo/${encodeURIComponent(tipo)}`);
        return response.data;
    },

    suggestNextCode: async (tipo: string, ubicacion: string, nombre: string = ''): Promise<any> => {
        const response = await axiosInstance.get('/suggest-code', {
            params: { tipo, ubicacion, nombre }
        });
        return response.data;
    },

    restoreVersion: async (id: number, idHistorial: number): Promise<any> => {
        const response = await axiosInstance.post(`/${id}/restore/${idHistorial}`);
        return response.data;
    }
};

export default equipoService;
