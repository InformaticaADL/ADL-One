import axios from 'axios';
import API_CONFIG from '../../../config/api.config';

// Create axios instance
const axiosInstance = axios.create({
    baseURL: `${API_CONFIG.getBaseURL()}/api/fichas`,
    timeout: 30000, // 30 seconds for heavier write operations
    headers: {
        'Content-Type': 'application/json'
    }
});

export const fichaService = {
    getAll: async () => {
        const response = await axiosInstance.get('/');
        return response.data;
    },
    create: async (data: any) => {
        const response = await axiosInstance.post('/create', data);
        return response.data;
    },
    update: async (id: number, data: any) => {
        const response = await axiosInstance.post(`/${id}/update`, data);
        return response.data;
    },
    getById: async (id: number) => {
        const response = await axiosInstance.get(`/${id}`);
        return response.data;
    },
    approve: async (id: number, data: any) => {
        const response = await axiosInstance.post(`/${id}/approve`, data);
        return response.data;
    },
    reject: async (id: number, data: any) => {
        const response = await axiosInstance.post(`/${id}/reject`, data);
        return response.data;
    },
    approveCoordinacion: async (id: number, data: any) => {
        const response = await axiosInstance.post(`/${id}/approve-coordinacion`, data);
        return response.data;
    },
    reviewCoordinacion: async (id: number, data: any) => {
        const response = await axiosInstance.post(`/${id}/review-coordinacion`, data);
        return response.data;
    },
    updateAgenda: async (id: number, data: any) => {
        const response = await axiosInstance.post(`/${id}/agenda`, data);
        return response.data;
    },
    getForAssignment: async () => {
        const response = await axiosInstance.get('/for-assignment');
        return response.data;
    },
    getAssignmentDetail: async (id: number) => {
        const response = await axiosInstance.get(`/${id}/assignment-detail`);
        return response.data.data; // Backend wraps in { success, data, message }
    },
    batchUpdateAgenda: async (data: {
        assignments: {
            id: number,
            fecha: string,
            idMuestreadorInstalacion: number,
            idMuestreadorRetiro: number,
            idFichaIngresoServicio: number,
            frecuenciaCorrelativo: string
        }[],
        user?: any
    }) => {
        const response = await axiosInstance.post('/batch-agenda', data);
        return response.data.data; // Access nested data from successResponse wrapper
    },
    getHistorial: async (id: number) => {
        const response = await axiosInstance.get(`/${id}/historial`);
        return response.data.data;
    }
};
