import apiClient from '../config/axios.config';

// ─── Interfaces ────────────────────────────────────────────
export interface ChatConversation {
    id_conversacion: number;
    tipo: 'DIRECTA' | 'GRUPO';
    nombre_grupo: string | null;
    foto_grupo: string | null;
    descripcion: string | null;
    fecha_creacion: string;
    ultimo_mensaje_fecha: string | null;
    ultimo_mensaje: string | null;
    ultimo_tipo_mensaje: string | null;
    ultimo_emisor_id: number | null;
    ultimo_emisor_nombre: string | null;
    contacto_id: number | null;
    nombre_display: string;
    foto_display: string | null;
    no_leidos: number;
    total_miembros: number;
    es_favorito: number;
}

export interface ChatMessage {
    id_mensaje: number;
    id_conversacion: number;
    id_emisor: number;
    mensaje: string | null;
    tipo_mensaje: 'TEXTO' | 'ARCHIVO' | 'SISTEMA';
    fecha: string;
    editado: boolean;
    eliminado: boolean;
    archivo_ruta: string | null;
    archivo_nombre: string | null;
    nombre_emisor: string;
    foto_emisor: string | null;
    leido_por_mi: boolean;
}

export interface ChatContact {
    id_entidad: number;
    nombre: string;
    foto: string | null;
    email: string;
    tipo_entidad: 'USER' | 'GROUP';
    cargo?: string | null;
    id_usuario?: number; // for backward compatibility if needed
}

export interface ChatMember extends ChatContact {
    id_participante: number;
    rol: 'ADMIN' | 'MIEMBRO';
    activo: boolean;
    fecha_union: string;
}

export interface UserProfile extends ChatContact {
    roles: string | null;
}

// ─── Service ───────────────────────────────────────────────
class GeneralChatService {

    // Conversaciones
    async getConversations(): Promise<ChatConversation[]> {
        const res = await apiClient.get('/api/gchat/conversations');
        return res.data.data;
    }

    async getOrCreateDirect(targetUserId: number): Promise<{ id_conversacion: number; created: boolean }> {
        const res = await apiClient.post(`/api/gchat/conversations/direct/${targetUserId}`);
        return res.data.data;
    }

    async deleteConversation(conversationId: number): Promise<void> {
        await apiClient.delete(`/api/gchat/conversations/${conversationId}`);
    }

    // Grupos
    async createGroup(nombre: string, memberIds: number[], descripcion?: string, foto?: File): Promise<{ id_conversacion: number }> {
        if (foto) {
            const formData = new FormData();
            formData.append('nombre', nombre);
            formData.append('memberIds', JSON.stringify(memberIds));
            if (descripcion) formData.append('descripcion', descripcion);
            formData.append('foto', foto);
            const res = await apiClient.post('/api/gchat/groups', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return res.data.data;
        }
        const res = await apiClient.post('/api/gchat/groups', { nombre, memberIds, descripcion });
        return res.data.data;
    }

    async updateGroup(conversationId: number, data: { nombre_grupo?: string; foto?: File; descripcion?: string }): Promise<void> {
        if (data.foto) {
            const formData = new FormData();
            if (data.nombre_grupo) formData.append('nombre_grupo', data.nombre_grupo);
            if (data.descripcion) formData.append('descripcion', data.descripcion);
            formData.append('foto', data.foto);
            await apiClient.put(`/api/gchat/groups/${conversationId}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return;
        }
        await apiClient.put(`/api/gchat/groups/${conversationId}`, data);
    }

    async addGroupMember(conversationId: number, targetUserId: number): Promise<void> {
        await apiClient.post(`/api/gchat/groups/${conversationId}/members`, { targetUserId });
    }

    async removeGroupMember(conversationId: number, userId: number): Promise<void> {
        await apiClient.delete(`/api/gchat/groups/${conversationId}/members/${userId}`);
    }

    async updateGroupMemberRole(conversationId: number, userId: number, role: 'ADMIN' | 'MIEMBRO'): Promise<void> {
        await apiClient.put(`/api/gchat/groups/${conversationId}/members/${userId}/role`, { role });
    }

    async leaveGroup(conversationId: number): Promise<void> {
        await apiClient.post(`/api/gchat/groups/${conversationId}/leave`);
    }

    async getConversationMembers(conversationId: number): Promise<ChatMember[]> {
        const res = await apiClient.get(`/api/gchat/conversations/${conversationId}/members`);
        return res.data.data;
    }

    // Mensajes
    async getMessages(conversationId: number, page = 1): Promise<ChatMessage[]> {
        const res = await apiClient.get(`/api/gchat/conversations/${conversationId}/messages`, { params: { page } });
        return res.data.data;
    }

    async sendMessage(conversationId: number, mensaje?: string, archivo?: File): Promise<ChatMessage> {
        if (archivo) {
            const formData = new FormData();
            if (mensaje) formData.append('mensaje', mensaje);
            formData.append('archivo', archivo);
            const res = await apiClient.post(`/api/gchat/conversations/${conversationId}/messages`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return res.data.data;
        }
        const res = await apiClient.post(`/api/gchat/conversations/${conversationId}/messages`, { mensaje });
        return res.data.data;
    }

    async markAsRead(conversationId: number): Promise<void> {
        await apiClient.put(`/api/gchat/conversations/${conversationId}/read`);
    }

    async clearMessages(conversationId: number): Promise<void> {
        await apiClient.put(`/api/gchat/conversations/${conversationId}/clear`);
    }

    async unhideConversation(conversationId: number): Promise<void> {
        await apiClient.put(`/api/gchat/conversations/${conversationId}/unhide`);
    }

    async deleteMessage(messageId: number): Promise<void> {
        await apiClient.delete(`/api/gchat/messages/${messageId}`);
    }

    // Contactos
    async searchContacts(query: string, onlyUsers: boolean = false): Promise<ChatContact[]> {
        const res = await apiClient.get('/api/gchat/contacts/search', { params: { q: query, onlyUsers } });
        return res.data.data;
    }

    async getFavorites(): Promise<ChatContact[]> {
        const res = await apiClient.get('/api/gchat/contacts/favorites');
        return res.data.data;
    }

    async addFavorite(contactId: number, tipo: 'USER' | 'GROUP' = 'USER'): Promise<any> {
        console.log('TRACE: addFavorite call', { contactId, tipo });
        const res = await apiClient.post(`/api/gchat/contacts/favorites/${contactId}`, {}, { params: { tipo } });
        return res.data;
    }

    async removeFavorite(contactId: number, tipo: 'USER' | 'GROUP' = 'USER'): Promise<any> {
        console.log('TRACE: removeFavorite call', { contactId, tipo });
        const res = await apiClient.delete(`/api/gchat/contacts/favorites/${contactId}`, { params: { tipo } });
        return res.data;
    }

    // Perfil
    async getUserProfile(userId: number): Promise<UserProfile> {
        const res = await apiClient.get(`/api/gchat/users/${userId}/profile`);
        return res.data.data;
    }

    // Download URL helper
    getDownloadUrl(messageId: number): string {
        return `/api/gchat/download/${messageId}`;
    }
}

export const generalChatService = new GeneralChatService();
