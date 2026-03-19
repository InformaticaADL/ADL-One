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

    addRecipient: async (eventId: number, data: { 
        idUsuario?: number; 
        idRol?: number; 
        tipoEnvio: string;
        enviaEmail?: boolean;
        enviaWeb?: boolean;
        plantillaWeb?: string;
        plantillaWebTitulo?: string;
        areaDestino?: string;
    }) => {
        const response = await apiClient.post(`/api/notifications/events/${eventId}/recipients`, data);
        return response.data;
    },

    removeRecipient: async (idRelacion: number) => {
        const response = await apiClient.delete(`/api/notifications/recipients/${idRelacion}`);
        return response.data;
    },

    // --- New UNS Methods ---
    getMyNotifications: async (soloNoLeidas = true) => {
        const response = await apiClient.get(`/api/uns`, { params: { soloNoLeidas } });
        return response.data;
    },

    markAsRead: async (id: number) => {
        const response = await apiClient.put(`/api/uns/${id}/read`);
        return response.data;
    },
    
    markAsReadByRef: async (idReferencia: number) => {
        const response = await apiClient.put(`/api/uns/read-by-ref/${idReferencia}`);
        return response.data;
    },

    // Architecture 3.0 Methods
    getNotificationCatalog: async () => {
        const response = await apiClient.get('/api/notifications/catalog');
        return response.data;
    },

    saveNotificationConfig: async (eventId: number, configs: any[]) => {
        const response = await apiClient.post('/api/notifications/config', {
            id_evento: eventId,
            configs
        });
        return response.data;
    }
};
