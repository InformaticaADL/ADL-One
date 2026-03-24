import { create } from 'zustand';
import { generalChatService } from '../services/general-chat.service';
import type { ChatConversation, ChatMessage, ChatContact } from '../services/general-chat.service';

interface ChatState {
    // State
    conversations: ChatConversation[];
    activeConversation: ChatConversation | null;
    messages: ChatMessage[];
    favorites: ChatContact[];
    loading: boolean;
    messagesLoading: boolean;
    drafts: Record<number, { text: string; files: File[] }>;

    // Actions
    fetchConversations: () => Promise<void>;
    setActiveConversation: (conv: ChatConversation | null) => void;
    fetchMessages: (conversationId: number, page?: number) => Promise<void>;
    fetchFavorites: () => Promise<void>;
    addMessage: (message: ChatMessage) => void;
    updateConversationLastMessage: (conversationId: number, message: ChatMessage) => void;
    decrementUnread: (conversationId: number) => void;
    removeConversation: (conversationId: number) => void;
    deleteConversation: (conversationId: number) => Promise<void>;
    refreshConversation: (conversationId: number) => void;
    setDraft: (conversationId: number, draft: { text: string; files: File[] }) => void;
    clearDraft: (conversationId: number) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
    conversations: [],
    activeConversation: null,
    messages: [],
    favorites: [],
    loading: false,
    messagesLoading: false,
    drafts: {},

    fetchConversations: async () => {
        set({ loading: true });
        try {
            const conversations = await generalChatService.getConversations();
            set({ conversations, loading: false });
        } catch (error) {
            console.error('Error fetching conversations:', error);
            set({ loading: false });
        }
    },

    setActiveConversation: (conv) => {
        const current = get().activeConversation;
        if (current?.id_conversacion === conv?.id_conversacion) return;
        set({ activeConversation: conv, messages: [] });
    },

    fetchMessages: async (conversationId, page = 1) => {
        set({ messagesLoading: true });
        try {
            const messages = await generalChatService.getMessages(conversationId, page);
            set({ messages, messagesLoading: false });
        } catch (error) {
            console.error('Error fetching messages:', error);
            set({ messagesLoading: false });
        }
    },

    fetchFavorites: async () => {
        try {
            const favorites = await generalChatService.getFavorites();
            set({ favorites });
        } catch (error) {
            console.error('Error fetching favorites:', error);
        }
    },

    addMessage: (message) => {
        set((state) => ({
            messages: [...state.messages, message]
        }));
    },

    updateConversationLastMessage: (conversationId, message) => {
        set((state) => ({
            conversations: state.conversations.map(c =>
                c.id_conversacion === conversationId
                    ? {
                        ...c,
                        ultimo_mensaje: message.mensaje,
                        ultimo_mensaje_fecha: message.fecha,
                        ultimo_emisor_nombre: message.nombre_emisor,
                        ultimo_tipo_mensaje: message.tipo_mensaje,
                        no_leidos: state.activeConversation?.id_conversacion === conversationId
                            ? c.no_leidos
                            : c.no_leidos + 1
                    }
                    : c
            ).sort((a, b) => {
                const dateA = a.ultimo_mensaje_fecha ? new Date(a.ultimo_mensaje_fecha).getTime() : 0;
                const dateB = b.ultimo_mensaje_fecha ? new Date(b.ultimo_mensaje_fecha).getTime() : 0;
                return dateB - dateA;
            })
        }));
    },

    decrementUnread: (conversationId) => {
        set((state) => ({
            conversations: state.conversations.map(c =>
                c.id_conversacion === conversationId ? { ...c, no_leidos: 0 } : c
            )
        }));
    },

    removeConversation: (conversationId) => {
        set((state) => ({
            conversations: state.conversations.filter(c => c.id_conversacion !== conversationId),
            activeConversation: state.activeConversation?.id_conversacion === conversationId ? null : state.activeConversation
        }));
    },

    deleteConversation: async (conversationId) => {
        try {
            await generalChatService.deleteConversation(conversationId);
            get().removeConversation(conversationId);
        } catch (error) {
            console.error('Error deleting conversation:', error);
        }
    },

    refreshConversation: async (_conversationId) => {
        // Refresh full conversations list to get updated data
        const { fetchConversations } = get();
        await fetchConversations();
    },

    setDraft: (conversationId, draft) => {
        set((state) => ({
            drafts: {
                ...state.drafts,
                [conversationId]: draft
            }
        }));
    },

    clearDraft: (conversationId) => {
        set((state) => ({
            drafts: {
                ...state.drafts,
                [conversationId]: { text: '', files: [] }
            }
        }));
    }
}));
