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
    create: async (data: any) => {
        const response = await axiosInstance.post('/create', data);
        return response.data;
    },
    getAll: async () => {
        const response = await axiosInstance.get('/');
        return response.data;
    },
    getById: async (id: number) => {
        const response = await axiosInstance.get(`/${id}`);
        return response.data;
    },
    approve: async (id: number, payload: { observaciones: string, user: { id: number } }) => {
        const response = await axiosInstance.post(`/${id}/approve`, payload);
        return response.data;
    },
    reject: async (id: number, payload: { observaciones: string, user: { id: number } }) => {
        const response = await axiosInstance.post(`/${id}/reject`, payload);
        return response.data;
    }

};
