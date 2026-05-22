import apiClient from '../../../config/axios.config';

export interface GrupoRuta {
    id_grupo: number;
    nombre_grupo: string;
    descripcion?: string;
    cantidad_rutas?: number;
}

export interface RutaPlanificada {
    id_ruta_planificada: number;
    nombre_ruta: string;
    descripcion?: string;
    estado: string;
    creador?: string;
    fecha_creacion: string;
    cantidad_fichas: number;
    total_ejecuciones: number;
    ultima_ejecucion?: string;
    id_grupo?: number;
    nombre_grupo?: string;
}

export const rutasPlanificadasService = {
    // ─── Grupos ───────────────────────────────────────────────────────────────
    getGrupos: async (): Promise<GrupoRuta[]> => {
        const response = await apiClient.get('/api/rutas-planificadas/grupos');
        return response.data.data;
    },
    createGrupo: async (data: { nombre_grupo: string; descripcion?: string }): Promise<GrupoRuta> => {
        const response = await apiClient.post('/api/rutas-planificadas/grupos', data);
        return response.data.data;
    },
    updateGrupo: async (id: number, data: { nombre_grupo: string; descripcion?: string }): Promise<GrupoRuta> => {
        const response = await apiClient.put(`/api/rutas-planificadas/grupos/${id}`, data);
        return response.data.data;
    },
    deleteGrupo: async (id: number): Promise<void> => {
        await apiClient.delete(`/api/rutas-planificadas/grupos/${id}`);
    },

    // ─── Rutas ────────────────────────────────────────────────────────────────
    getAll: async (): Promise<RutaPlanificada[]> => {
        const response = await apiClient.get('/api/rutas-planificadas');
        return response.data.data;
    },
    getById: async (id: number) => {
        const response = await apiClient.get(`/api/rutas-planificadas/${id}`);
        return response.data.data;
    },
    create: async (data: { nombre_ruta: string; descripcion?: string; id_grupo?: number; fichas: { id_fichaingresoservicio: number; orden: number; frecuencia_correlativo?: string }[] }) => {
        const response = await apiClient.post('/api/rutas-planificadas', data);
        return response.data.data;
    },
    update: async (id: number, data: { nombre_ruta: string; descripcion?: string; id_grupo?: number; fichas: { id_fichaingresoservicio: number; orden: number; frecuencia_correlativo?: string }[] }) => {
        const response = await apiClient.put(`/api/rutas-planificadas/${id}`, data);
        return response.data.data;
    },
    updateRutaGrupo: async (id: number, id_grupo: number | null): Promise<void> => {
        await apiClient.patch(`/api/rutas-planificadas/${id}/grupo`, { id_grupo });
    },
    clone: async (id: number, options?: { nombre_ruta?: string; id_grupo?: number | null }) => {
        const response = await apiClient.post(`/api/rutas-planificadas/${id}/clone`, options ?? {});
        return response.data.data;
    },
    delete: async (id: number) => {
        const response = await apiClient.delete(`/api/rutas-planificadas/${id}`);
        return response.data.data;
    },
    asignar: async (id: number, data: { assignDate: string; assignMuestreadorInst: string; assignMuestreadorRet?: string; observaciones?: string }) => {
        const response = await apiClient.post(`/api/rutas-planificadas/${id}/asignar`, data);
        return response.data.data;
    },
};
