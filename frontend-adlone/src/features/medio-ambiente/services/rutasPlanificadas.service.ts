import apiClient from '../../../config/axios.config';

export const rutasPlanificadasService = {
    getAll: async () => {
        const response = await apiClient.get('/api/rutas-planificadas');
        return response.data.data;
    },
    getById: async (id: number) => {
        const response = await apiClient.get(`/api/rutas-planificadas/${id}`);
        return response.data.data;
    },
    create: async (data: { nombre_ruta: string, fichas: { id_fichaingresoservicio: number, orden: number, frecuencia_correlativo?: string }[] }) => {
        const response = await apiClient.post('/api/rutas-planificadas', data);
        return response.data.data;
    },
    delete: async (id: number) => {
        const response = await apiClient.delete(`/api/rutas-planificadas/${id}`);
        return response.data.data;
    },
    asignar: async (id: number, data: { assignDate: string, assignMuestreadorInst: string, assignMuestreadorRet?: string }) => {
        const response = await apiClient.post(`/api/rutas-planificadas/${id}/asignar`, data);
        return response.data.data;
    }
};
