import apiClient from '../../../config/axios.config';

// Using centralized apiClient with automatic token injection


export const fichaService = {
    getAll: async () => {
        const response = await apiClient.get('/api/fichas/');
        return response.data;
    },
    getEnProceso: async (month?: number, year?: number) => {
        let url = '/api/fichas/en-proceso';
        const params = new URLSearchParams();
        if (month) params.append('month', month.toString());
        if (year) params.append('year', year.toString());

        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;

        const response = await apiClient.get(url);
        return response.data;
    },
    getMuestreosEjecutados: async () => {
        const response = await apiClient.get('/api/fichas/ejecutados');
        return response.data;
    },

    create: async (data: any) => {
        const response = await apiClient.post('/api/fichas/create', data);
        return response.data;
    },
    update: async (id: number, data: any, user?: any) => {
        const payload = { ...data, user };
        const response = await apiClient.post(`/api/fichas/${id}/update`, payload);
        return response.data;
    },
    getById: async (id: number) => {
        const response = await apiClient.get(`/api/fichas/${id}`);
        return response.data;
    },
    approve: async (id: number, data: any) => {
        const response = await apiClient.post(`/api/fichas/${id}/approve`, data);
        return response.data;
    },
    reject: async (id: number, data: any) => {
        const response = await apiClient.post(`/api/fichas/${id}/reject`, data);
        return response.data;
    },
    approveCoordinacion: async (id: number, data: any) => {
        const response = await apiClient.post(`/api/fichas/${id}/approve-coordinacion`, data);
        return response.data;
    },
    reviewCoordinacion: async (id: number, data: any) => {
        const response = await apiClient.post(`/api/fichas/${id}/review-coordinacion`, data);
        return response.data;
    },
    updateAgenda: async (id: number, data: any) => {
        const response = await apiClient.post(`/api/fichas/${id}/agenda`, data);
        return response.data;
    },
    getForAssignment: async () => {
        const response = await apiClient.get('/api/fichas/for-assignment');
        return response.data;
    },
    getAssignmentDetail: async (id: number) => {
        const response = await apiClient.get(`/api/fichas/${id}/assignment-detail`);
        return response.data.data; // Backend wraps in { success, data, message }
    },
    batchUpdateAgenda: async (data: {
        assignments: {
            id: number,
            fecha: string,
            fechaRetiro?: string,
            idMuestreadorInstalacion: number,
            idMuestreadorRetiro: number,
            idFichaIngresoServicio: number,
            frecuenciaCorrelativo: string
        }[],

        user?: any,
        observaciones?: string
    }) => {
        const response = await apiClient.post('/api/fichas/batch-agenda', data);
        return response.data.data; // Access nested data from successResponse wrapper
    },
    getHistorial: async (id: number) => {
        const response = await apiClient.get(`/api/fichas/${id}/historial`);
        return response.data.data;
    },
    cancelAgendaSampling: async (idAgenda: number, idFicha: number, user: any, motivo_cancelacion: string, idEstadoMuestreo?: number) => {
        const response = await apiClient.post('/api/fichas/cancel-sampling', { idAgenda, idFicha, user, motivo_cancelacion, idEstadoMuestreo });
        return response.data;
    },
    getSamplingEquipos: async (idFicha: number, correlativo: string) => {
        const response = await apiClient.get(`/api/fichas/${idFicha}/sampling-equipos?correlativo=${correlativo}`);
        return response.data;
    },
    downloadPdf: async (id: number) => {
        const response = await apiClient.get(`/api/fichas/${id}/pdf`, { responseType: 'blob' });
        return response.data;
    },
    downloadExcel: async (id: number) => {
        const response = await apiClient.get(`/api/fichas/${id}/excel`, { responseType: 'blob' });
        return response.data;
    },
    enviarDocumentoManual: async (data: { idFicha: number; correlativo: string; documento: any; to: string; cc: string }) => {
        const response = await apiClient.post('/api/fichas/enviar-documento-manual', data);
        return response.data;
    }
};
