import axios from 'axios';
import API_CONFIG from '../config/api.config';

const getAuthHeader = () => {
    const token = sessionStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
};

export const adminService = {
    // --- MUESTREADORES ---
    getMuestreadores: async (nombre?: string, estado: string = 'ACTIVOS') => {
        const response = await axios.get(`${API_CONFIG.getBaseURL()}/api/admin/muestreadores`, {
            params: { nombre, estado },
            ...getAuthHeader()
        });
        return response.data;
    },

    createMuestreador: async (data: any) => {
        const response = await axios.post(`${API_CONFIG.getBaseURL()}/api/admin/muestreadores`, data, getAuthHeader());
        return response.data;
    },

    updateMuestreador: async (id: number, data: any) => {
        const response = await axios.put(`${API_CONFIG.getBaseURL()}/api/admin/muestreadores/${id}`, data, getAuthHeader());
        return response.data;
    },

    disableMuestreador: async (id: number) => {
        const response = await axios.delete(`${API_CONFIG.getBaseURL()}/api/admin/muestreadores/${id}`, getAuthHeader());
        return response.data;
    },
};
