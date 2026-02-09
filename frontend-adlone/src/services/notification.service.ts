import axios from 'axios';
import API_CONFIG from '../config/api.config';

const API_URL = '/notifications';

const getAuthHeader = () => {
    const token = sessionStorage.getItem('token');
    return { headers: { Authorization: `Bearer ${token}` } };
};

export const notificationService = {
    getEvents: async () => {
        const response = await axios.get(`${API_CONFIG.getBaseURL()}/api${API_URL}/events`, getAuthHeader());
        return response.data;
    },

    getRecipients: async (eventId: number) => {
        const response = await axios.get(`${API_CONFIG.getBaseURL()}/api${API_URL}/events/${eventId}/recipients`, getAuthHeader());
        return response.data;
    },

    addRecipient: async (eventId: number, data: { idUsuario?: number; idRol?: number; tipoEnvio: string }) => {
        const response = await axios.post(`${API_CONFIG.getBaseURL()}/api${API_URL}/events/${eventId}/recipients`, data, getAuthHeader());
        return response.data;
    },

    removeRecipient: async (idRelacion: number) => {
        const response = await axios.delete(`${API_CONFIG.getBaseURL()}/api${API_URL}/recipients/${idRelacion}`, getAuthHeader());
        return response.data;
    }
};
