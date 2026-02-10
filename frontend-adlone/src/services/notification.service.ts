import apiClient from '../config/axios.config';

export const notificationService = {
    getEvents: async () => {
        const response = await apiClient.get('/api/notifications/events');
        return response.data;
    },

    getRecipients: async (eventId: number) => {
        const response = await apiClient.get(`/api/notifications/events/${eventId}/recipients`);
        return response.data;
    },

    addRecipient: async (eventId: number, data: { idUsuario?: number; idRol?: number; tipoEnvio: string }) => {
        const response = await apiClient.post(`/api/notifications/events/${eventId}/recipients`, data);
        return response.data;
    },

    removeRecipient: async (idRelacion: number) => {
        const response = await apiClient.delete(`/api/notifications/recipients/${idRelacion}`);
        return response.data;
    }
};
