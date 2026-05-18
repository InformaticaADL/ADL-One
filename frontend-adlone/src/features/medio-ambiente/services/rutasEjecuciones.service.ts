import apiClient from '../../../config/axios.config';

export interface CorrelativoOption {
    id_agendamam: number;
    frecuencia_correlativo: string;
    nombre_estadomuestreo: string | null;
    fecha_muestreo: string | null;
    status: 'DISPONIBLE' | 'AGENDADO' | 'EN_RUTA';
}

export interface FichaDisponible {
    id_fichaingresoservicio: number;
    orden: number;
    centro: string | null;
    empresa_servicio: string | null;
    objetivo: string | null;
    ref_google: string | null;
    ma_coordenadas: string | null;
    latitud: string | null;
    longitud: string | null;
    correlativos: CorrelativoOption[];
    suggested_correlativo: string | null;
    suggested_id_agendamam: number | null;
    disponibles: number;
    total: number;
}

export interface FichasDisponiblesResponse {
    plantilla: {
        id_ruta_planificada: number;
        nombre_ruta: string;
        estado: string;
        creador: string | null;
    };
    fichas: FichaDisponible[];
}

export interface EjecucionFichaInput {
    id_fichaingresoservicio: number;
    orden: number;
    frecuencia_correlativo: string;
    id_agendamam?: number;
}

export interface CreateEjecucionInput {
    id_ruta_planificada: number;
    fecha_ejecucion: string;
    id_muestreador_inst: number;
    id_muestreador_ret?: number;
    fichas: EjecucionFichaInput[];
    observaciones?: string;
}

export const rutasEjecucionesService = {
    getFichasDisponibles: async (idPlantilla: number): Promise<FichasDisponiblesResponse> => {
        const response = await apiClient.get(`/api/rutas-ejecuciones/plantilla/${idPlantilla}/fichas-disponibles`);
        return response.data.data;
    },

    getEjecucionesByPlantilla: async (idPlantilla: number): Promise<any[]> => {
        const response = await apiClient.get(`/api/rutas-ejecuciones/plantilla/${idPlantilla}`);
        return response.data.data;
    },

    getEjecucionById: async (id: number): Promise<any> => {
        const response = await apiClient.get(`/api/rutas-ejecuciones/${id}`);
        return response.data.data;
    },

    create: async (data: CreateEjecucionInput): Promise<any> => {
        const response = await apiClient.post('/api/rutas-ejecuciones', data);
        return response.data.data;
    }
};
