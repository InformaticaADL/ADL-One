import apiClient from '../config/axios.config';

export const ursService = {
    async getRequestTypes(all = false): Promise<any[]> {
        const response = await apiClient.get(`/api/urs/types${all ? '?all=true' : ''}`);
        return response.data;
    },

    async createUpdateType(id: number | null, data: any): Promise<any> {
        if (id) {
            const response = await apiClient.put(`/api/urs/types/${id}`, data);
            return response.data;
        } else {
            const response = await apiClient.post('/api/urs/types', data);
            return response.data;
        }
    },

    async toggleTypeStatus(id: number, estado: boolean): Promise<any> {
        const response = await apiClient.patch(`/api/urs/types/${id}/status`, { estado });
        return response.data;
    },

    createRequest: async (data: { id_tipo: number; datos_json: any; prioridad?: string; archivos?: any[] }) => {
        const formData = new FormData();
        formData.append('id_tipo', data.id_tipo.toString());
        formData.append('datos_json', JSON.stringify(data.datos_json));
        formData.append('prioridad', data.prioridad || 'NORMAL');
        formData.append('observaciones', (data as any).observaciones || '');
        
        if (data.archivos) {
            data.archivos.forEach(file => {
                formData.append('archivos', file);
            });
        }

        const response = await apiClient.post('/api/urs', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    getRequests: async (filters: any = {}) => {
        const response = await apiClient.get('/api/urs', { params: filters });
        return response.data;
    },

    getRequestDetail: async (id: number) => {
        const response = await apiClient.get(`/api/urs/${id}`);
        return response.data;
    },

    updateStatus: async (id: number, data: { status: string; comment?: string }) => {
        const response = await apiClient.put(`/api/urs/${id}/status`, data);
        return response.data;
    },

    addComment: async (id: number, mensaje: string, es_privado: boolean = false, archivos?: File[]) => {
        const formData = new FormData();
        formData.append('mensaje', mensaje);
        formData.append('es_privado', String(es_privado));
        
        if (archivos && archivos.length > 0) {
            archivos.forEach(file => {
                formData.append('archivos', file);
            });
        }

        const response = await apiClient.post(`/api/urs/${id}/comments`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data;
    },

    deriveRequest: async (id: number, data: { area: string; userId?: number; roleId?: number; comment?: string }) => {
        const response = await apiClient.post(`/api/urs/${id}/derive`, data);
        return response.data;
    },

    // --- Granular Permissions (Phase 22) ---
    async getPermissions(id: number): Promise<any[]> {
        const response = await apiClient.get(`/api/urs/types/${id}/permissions`);
        return response.data;
    },

    async addPermission(id: number, data: { id_rol?: number; id_usuario?: number; tipo_acceso: 'ENVIO' | 'VISTA' | 'GESTION' | 'DERIVACION' | 'DESTINO_DERIVACION' }): Promise<any> {
        const response = await apiClient.post(`/api/urs/types/${id}/permissions`, data);
        return response.data;
    },

    async removePermission(idRelacion: number): Promise<any> {
        const response = await apiClient.delete(`/api/urs/permissions/${idRelacion}`);
        return response.data;
    },

    async getDerivationTargets(idTipo: number): Promise<any[]> {
        const response = await apiClient.get(`/api/urs/types/${idTipo}/derivation-targets?t=${Date.now()}`);
        return response.data;
    },

    async getNotificationConfig(idTipo: number): Promise<any[]> {
        const response = await apiClient.get(`/api/urs/types/${idTipo}/notifications`);
        return response.data;
    },

    async saveNotificationConfig(idTipo: number, configs: any[]): Promise<any> {
        const response = await apiClient.post(`/api/urs/types/${idTipo}/notifications`, configs);
        return response.data;
    }
};
