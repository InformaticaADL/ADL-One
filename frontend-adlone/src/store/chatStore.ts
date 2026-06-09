import { create } from 'zustand';
import { generalChatService } from '../services/general-chat.service';
import type { ChatConversation, ChatMessage, ChatContact, ChatReaccion } from '../services/general-chat.service';

export interface TypingUser { userId: number; name: string; }

interface ChatState {
    // State
    conversations: ChatConversation[];
    activeConversation: ChatConversation | null;
    messages: ChatMessage[];
    favorites: ChatContact[];
    loading: boolean;
    messagesLoading: boolean;
    messagesPage: number;
    hasMoreMessages: boolean;
    drafts: Record<number, { text: string; files: File[] }>;
    typingUsers: Record<number, TypingUser[]>;

    // Actions
    fetchConversations: () => Promise<void>;
    setActiveConversation: (conv: ChatConversation | null) => void;
    fetchMessages: (conversationId: number, page?: number) => Promise<void>;
    loadMoreMessages: (conversationId: number) => Promise<void>;
    fetchFavorites: () => Promise<void>;
    addMessage: (message: ChatMessage) => void;
    updateConversationLastMessage: (conversationId: number, message: ChatMessage) => void;
    updateMessageReactions: (messageId: number, reacciones: ChatReaccion[]) => void;
    markMessageDeleted: (messageId: number) => void;
    decrementUnread: (conversationId: number) => void;
    removeConversation: (conversationId: number) => void;
    deleteConversation: (conversationId: number) => Promise<void>;
    refreshConversation: (conversationId: number) => void;
    setDraft: (conversationId: number, draft: { text: string; files: File[] }) => void;
    clearDraft: (conversationId: number) => void;
    setTypingUser: (conversationId: number, userId: number, name: string) => void;
    removeTypingUser: (conversationId: number, userId: number) => void;
    reset: () => void;
}

// Estado inicial reutilizable: se aplica al crear el store y al hacer reset (logout).
const initialState = {
    conversations: [] as ChatConversation[],
    activeConversation: null as ChatConversation | null,
    messages: [] as ChatMessage[],
    favorites: [] as ChatContact[],
    loading: false,
    messagesLoading: false,
    messagesPage: 1,
    hasMoreMessages: true,
    drafts: {} as Record<number, { text: string; files: File[] }>,
    typingUsers: {} as Record<number, TypingUser[]>,
};

export const useChatStore = create<ChatState>((set, get) => ({
    ...initialState,

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
        set({ messagesLoading: true, messagesPage: 1, hasMoreMessages: true });
        try {
            const messages = await generalChatService.getMessages(conversationId, page);
            set({ messages, messagesLoading: false, hasMoreMessages: messages.length >= 50 });
        } catch (error) {
            console.error('Error fetching messages:', error);
            set({ messagesLoading: false });
        }
    },

    loadMoreMessages: async (conversationId) => {
        const state = get();
        if (state.messagesLoading || !state.hasMoreMessages) return;
        const nextPage = state.messagesPage + 1;
        set({ messagesLoading: true });
        try {
            const older = await generalChatService.getMessages(conversationId, nextPage);
            set(s => ({
                messages: [...older, ...s.messages],
                messagesPage: nextPage,
                hasMoreMessages: older.length >= 50,
                messagesLoading: false
            }));
        } catch (error) {
            console.error('Error loading more messages:', error);
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

    updateMessageReactions: (messageId, reacciones) => {
        set((state) => ({
            messages: state.messages.map(m =>
                Number(m.id_mensaje) === Number(messageId) ? { ...m, reacciones } : m
            )
        }));
    },

    markMessageDeleted: (messageId) => {
        set((state) => ({
            messages: state.messages.map(m =>
                m.id_mensaje === messageId ? { ...m, eliminado: true, mensaje: null, archivo_ruta: null, archivo_nombre: null } : m
            )
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
    },

    setTypingUser: (conversationId, userId, name) => {
        set((state) => {
            const prev = (state.typingUsers[conversationId] || []).filter(t => t.userId !== userId);
            return { typingUsers: { ...state.typingUsers, [conversationId]: [...prev, { userId, name }] } };
        });
    },

    removeTypingUser: (conversationId, userId) => {
        set((state) => {
            const prev = state.typingUsers[conversationId] || [];
            return { typingUsers: { ...state.typingUsers, [conversationId]: prev.filter(t => t.userId !== userId) } };
        });
    },

    // Limpia todo el estado del chat. Se llama en logout para que el siguiente
    // usuario que inicie sesión no vea conversaciones, mensajes ni borradores ajenos.
    reset: () => set({ ...initialState }),
}));
