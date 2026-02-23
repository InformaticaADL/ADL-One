import apiClient from '../config/axios.config';

export const adminService = {
    // --- MUESTREADORES ---
    getMuestreadores: async (nombre?: string, estado: string = 'ACTIVOS') => {
        const response = await apiClient.get('/api/admin/muestreadores', {
            params: { nombre, estado }
        });
        return response.data;
    },

    createMuestreador: async (data: any) => {
        const response = await apiClient.post('/api/admin/muestreadores', data);
        return response.data;
    },

    updateMuestreador: async (id: number, data: any) => {
        const response = await apiClient.put(`/api/admin/muestreadores/${id}`, data);
        return response.data;
    },

    disableMuestreador: async (id: number) => {
        const response = await apiClient.delete(`/api/admin/muestreadores/${id}`);
        return response.data;
    },

    // --- SOLICITUDES ---
    createSolicitud: async (data: any) => {
        const response = await apiClient.post('/api/admin/solicitudes', data);
        return response.data;
    },

    getSolicitudes: async (params?: { estado?: string; solo_mias?: boolean; origen_solicitud?: string; estado_tecnica?: string }) => {
        const response = await apiClient.get('/api/admin/solicitudes', {
            params
        });
        return response.data;
    },

    updateSolicitudStatus: async (id: number, estado: string, feedback: string, datos_json?: any, id_equipo_procesado?: string | number, accion_item?: 'APROBADO' | 'RECHAZADO') => {
        const response = await apiClient.put(`/api/admin/solicitudes/${id}/status`, {
            estado,
            feedback_admin: feedback,
            datos_json,
            id_equipo_procesado,
            accion_item
        });
        return response.data;
    },

    reviewSolicitudTechnical: async (id: number, estado_tecnica: string, feedback: string, datos_json?: any) => {
        const response = await apiClient.put(`/api/admin/solicitudes/${id}/technical-review`, {
            estado_tecnica,
            feedback,
            datos_json
        });
        return response.data;
    },

    acceptSolicitudForReview: async (id: number, feedback?: string) => {
        const response = await apiClient.post(`/api/admin/solicitudes/${id}/accept-review`, { feedback });
        return response.data;
    },

    // --- DASHBOARD ---
    getDashboardStats: async () => {
        const response = await apiClient.get('/api/admin/dashboard/stats');
        return response.data;
    }
};
