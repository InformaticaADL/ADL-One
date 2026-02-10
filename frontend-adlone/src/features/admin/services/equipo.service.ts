import apiClient from '../../../config/axios.config';

// No need for custom axios instance - using centralized apiClient with automatic token injection


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
        que_mide: string[];
        unidades: string[];
    };

}

export const equipoService = {
    getEquipos: async (params: any): Promise<EquiposResponse> => {
        const response = await apiClient.get('/api/admin/equipos/', { params });
        return response.data;
    },

    createEquipo: async (data: Partial<Equipo>): Promise<any> => {
        const response = await apiClient.post('/api/admin/equipos/', data);
        return response.data;
    },

    getEquipoById: async (id: number): Promise<any> => {
        const response = await apiClient.get(`/api/admin/equipos/${id}`);
        return response.data;
    },

    updateEquipo: async (id: number, data: Partial<Equipo>): Promise<any> => {
        const response = await apiClient.put(`/api/admin/equipos/${id}`, data);
        return response.data;
    },

    deleteEquipo: async (id: number): Promise<any> => {
        const response = await apiClient.delete(`/api/admin/equipos/${id}`);
        return response.data;
    },

    getEquipoHistorial: async (id: number): Promise<any> => {
        const response = await apiClient.get(`/api/admin/equipos/${id}/historial`);
        return response.data;
    },

    getNextCorrelativo: async (tipo: string): Promise<any> => {
        const response = await apiClient.get(`/api/admin/equipos/next-correlativo/${encodeURIComponent(tipo)}`);
        return response.data;
    },

    suggestNextCode: async (tipo: string, ubicacion: string, nombre: string = ''): Promise<any> => {
        const response = await apiClient.get('/api/admin/equipos/suggest-code', {
            params: { tipo, ubicacion, nombre }
        });
        return response.data;
    },

    restoreVersion: async (id: number, idHistorial: number): Promise<any> => {
        const response = await apiClient.post(`/api/admin/equipos/${id}/restore/${idHistorial}`);
        return response.data;
    }
};

export default equipoService;
