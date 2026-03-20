import apiClient from '../config/axios.config';

export interface ChatMessage {
    id_mensaje?: number;
    id_emisor: number;
    id_receptor: number;
    mensaje: string;
    fecha: string;
    leido: boolean;
    es_mio?: boolean;
}

export interface ChatContact {
    id_usuario: number;
    nombre: string;
    foto: string | null;
    ultimo_mensaje?: string;
    fecha_ultimo?: string;
    unread_count?: number;
}

class ChatService {
    private getBaseUrl() {
        return '/api/chat';
    }

    async getRecentChats(): Promise<ChatContact[]> {
        const res = await apiClient.get(`${this.getBaseUrl()}/recent`);
        return res.data.data;
    }

    async getConversation(targetUserId: number): Promise<ChatMessage[]> {
        const res = await apiClient.get(`${this.getBaseUrl()}/conversation/${targetUserId}`);
        return res.data.data;
    }

    async sendMessage(targetUserId: number, mensaje: string): Promise<ChatMessage> {
        const res = await apiClient.post(`${this.getBaseUrl()}/send`, { targetUserId, mensaje });
        return res.data.data;
    }

    async markAsRead(targetUserId: number): Promise<void> {
        await apiClient.put(`${this.getBaseUrl()}/read/${targetUserId}`, {});
    }

    async searchUsers(query: string): Promise<ChatContact[]> {
        const res = await apiClient.get(`${this.getBaseUrl()}/users/search?q=${query}`);
        return res.data.data;
    }
}

export const chatService = new ChatService();
