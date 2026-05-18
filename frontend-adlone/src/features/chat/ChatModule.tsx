import { useEffect, useCallback, useState, useRef } from 'react';
import { Paper, Text, Loader, Center, useMantineTheme } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconMessageCircle } from '@tabler/icons-react';
import { useChatStore } from '../../store/chatStore';
import { useAuth } from '../../contexts/AuthContext';
import { useNavStore } from '../../store/navStore';
import { useToast } from '../../contexts/ToastContext';
import { generalChatService } from '../../services/general-chat.service';
import type { ChatMessage } from '../../services/general-chat.service';
import { io, Socket } from 'socket.io-client';
import API_CONFIG from '../../config/api.config';
import ChatSidebar from './ChatSidebar';
import ChatWindow from './ChatWindow';
import ChatGroupModal from './ChatGroupModal';
import ContactProfileDrawer from './ContactProfileDrawer';
import './ChatModule.css';

let chatSocket: Socket | null = null;

const ChatModule: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const {
        conversations, activeConversation, messages, loading, messagesLoading,
        hasMoreMessages, fetchConversations, setActiveConversation, fetchMessages,
        loadMoreMessages, addMessage, updateConversationLastMessage, updateMessageReactions,
        markMessageDeleted, decrementUnread, fetchFavorites, typingUsers, setTypingUser, removeTypingUser,
    } = useChatStore();

    // Typing auto-clear timeouts — keyed by `${conversationId}_${userId}`
    const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    const [groupModalOpen, setGroupModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<number | null>(null);
    const [profileUserId, setProfileUserId] = useState<number | null>(null);
    const [profileOpen, setProfileOpen] = useState(false);
    const [otherUserReadAt, setOtherUserReadAt] = useState<Record<number, string>>({});
    
    const theme = useMantineTheme();
    const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

    // deep-linking from notifications
    const { pendingChatId, setPendingChatId, activeModule } = useNavStore();

    // Init: fetch conversations and favorites
    useEffect(() => {
        const init = async () => {
            await fetchConversations();
            await fetchFavorites();
        };
        init();
    }, []);


    // Socket.IO for real-time messages
    useEffect(() => {
        if (!user?.id) return;

        const baseUrl = API_CONFIG.getBaseURL();
        chatSocket = io(baseUrl);

        chatSocket.on('connect', () => {
            chatSocket?.emit('join', user.id);
        });

        chatSocket.on('nuevoChatMensaje', (msg: ChatMessage) => {
            const state = useChatStore.getState();
            
            // If the conversation is not in our list (might be hidden), re-fetch list
            const convExists = state.conversations.find(c => c.id_conversacion === msg.id_conversacion);
            if (!convExists) {
                fetchConversations();
            }

            // If the message is for the active conversation, add it
            if (state.activeConversation?.id_conversacion === msg.id_conversacion) {
                addMessage(msg);
                generalChatService.markAsRead(msg.id_conversacion).catch(() => {});
            }
            // Update conversation list
            updateConversationLastMessage(msg.id_conversacion, msg);
        });

        chatSocket.on('chatConversacionNueva', () => {
            fetchConversations();
        });

        chatSocket.on('chatMiembroRemovido', (data: { id_conversacion: number; nombre_grupo?: string }) => {
            fetchConversations();
            const state = useChatStore.getState();
            if (state.activeConversation?.id_conversacion === data.id_conversacion) {
                setActiveConversation(null);
                showToast({ type: 'info', message: `Fuiste removido del grupo${data.nombre_grupo ? ` "${data.nombre_grupo}"` : ''}` });
            }
        });

        chatSocket.on('chatTyping', ({ conversationId, userId, name }: { conversationId: number; userId: number; name: string }) => {
            const key = `${conversationId}_${userId}`;
            if (typingTimeoutsRef.current[key]) clearTimeout(typingTimeoutsRef.current[key]);
            setTypingUser(conversationId, userId, name);
            // Auto-clear after 4s in case typingStop is never received
            typingTimeoutsRef.current[key] = setTimeout(() => {
                removeTypingUser(conversationId, userId);
                delete typingTimeoutsRef.current[key];
            }, 4000);
        });

        chatSocket.on('chatStopTyping', ({ conversationId, userId }: { conversationId: number; userId: number }) => {
            const key = `${conversationId}_${userId}`;
            if (typingTimeoutsRef.current[key]) {
                clearTimeout(typingTimeoutsRef.current[key]);
                delete typingTimeoutsRef.current[key];
            }
            removeTypingUser(conversationId, userId);
        });

        chatSocket.on('chatReaccion', ({ messageId, reacciones }: { messageId: number; conversationId: number; reacciones: any[] }) => {
            updateMessageReactions(messageId, reacciones);
        });

        chatSocket.on('chatMarkRead', ({ conversationId, readByUserId, fecha }: { conversationId: number; readByUserId: number; fecha: string }) => {
            if (readByUserId !== user?.id) {
                setOtherUserReadAt(prev => ({ ...prev, [conversationId]: fecha }));
            }
        });

        chatSocket.on('chatMensajeEliminado', ({ messageId }: { messageId: number; conversationId: number }) => {
            markMessageDeleted(messageId);
        });

        return () => {
            // Clear all pending typing timeouts on disconnect
            Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
            typingTimeoutsRef.current = {};
            chatSocket?.disconnect();
            chatSocket = null;
        };
    }, [user?.id]);

    // Fetch messages when active conversation changes
    useEffect(() => {
        if (activeConversation) {
            fetchMessages(activeConversation.id_conversacion);
            generalChatService.markAsRead(activeConversation.id_conversacion).catch(() => {});
            decrementUnread(activeConversation.id_conversacion);
        }
    }, [activeConversation?.id_conversacion]);

    const handleSelectConversation = useCallback((conv: typeof conversations[0]) => {
        setActiveConversation(conv);
    }, []);

    const handleStartDirectChat = useCallback(async (contactId: number) => {
        try {
            const result = await generalChatService.getOrCreateDirect(contactId);
            await fetchConversations();
            const state = useChatStore.getState();
            const conv = state.conversations.find(c => Number(c.id_conversacion) === Number(result.id_conversacion));
            if (conv) setActiveConversation(conv);
        } catch {
            showToast({ type: 'error', message: 'Error al abrir el chat' });
        }
    }, [fetchConversations, setActiveConversation]);

    const handleSelectConversationById = useCallback(async (conversationId: number) => {
        try {
            await generalChatService.unhideConversation(conversationId);
            await fetchConversations();
            const state = useChatStore.getState();
            const conv = state.conversations.find(c => Number(c.id_conversacion) === Number(conversationId));
            if (conv) setActiveConversation(conv);
        } catch {
            showToast({ type: 'error', message: 'Error al abrir la conversación' });
        }
    }, [fetchConversations, setActiveConversation]);

    // Deep-linking logic (Chat)
    useEffect(() => {
        if (activeModule === 'chat' && pendingChatId) {
            const conversationId = Number(pendingChatId);
            const target = conversations.find(c => c.id_conversacion === conversationId);
            if (target) {
                setActiveConversation(target);
                setPendingChatId(null); // Clear after use
            } else if (!loading) {
                // If not found in current loaded list, try to unhide and select
                handleSelectConversationById(conversationId).finally(() => {
                    setPendingChatId(null);
                });
            }
        }
    }, [activeModule, pendingChatId, conversations, loading, setActiveConversation, setPendingChatId, handleSelectConversationById]);

    const handleTypingStart = useCallback(() => {
        if (!activeConversation) return;
        chatSocket?.emit('typingStart', { conversationId: activeConversation.id_conversacion });
    }, [activeConversation]);

    const handleTypingStop = useCallback(() => {
        if (!activeConversation) return;
        chatSocket?.emit('typingStop', { conversationId: activeConversation.id_conversacion });
    }, [activeConversation]);

    const handleSendMessage = useCallback(async (mensaje?: string, archivo?: File, replyToId?: number) => {
        if (!activeConversation) return;
        try {
            const newMsg = await generalChatService.sendMessage(activeConversation.id_conversacion, mensaje, archivo, replyToId);
            addMessage(newMsg);
            updateConversationLastMessage(activeConversation.id_conversacion, newMsg);
        } catch {
            showToast({ type: 'error', message: 'Error al enviar el mensaje' });
        }
    }, [activeConversation]);

    const handleAddReaction = useCallback(async (messageId: number, emoji: string) => {
        try {
            const reacciones = await generalChatService.addReaction(messageId, emoji);
            updateMessageReactions(messageId, reacciones);
        } catch {
            showToast({ type: 'error', message: 'Error al reaccionar' });
        }
    }, [updateMessageReactions]);

    const handleLoadMore = useCallback(() => {
        if (!activeConversation || !hasMoreMessages || messagesLoading) return;
        loadMoreMessages(activeConversation.id_conversacion);
    }, [activeConversation, hasMoreMessages, messagesLoading, loadMoreMessages]);

    const handleClearChat = useCallback(async () => {
        if (!activeConversation) return;
        try {
            await generalChatService.clearMessages(activeConversation.id_conversacion);
            fetchMessages(activeConversation.id_conversacion);
        } catch {
            showToast({ type: 'error', message: 'Error al limpiar el chat' });
        }
    }, [activeConversation]);

    const handleDeleteMessage = useCallback(async (messageId: number) => {
        try {
            await generalChatService.deleteMessage(messageId);
            markMessageDeleted(messageId);
        } catch {
            showToast({ type: 'error', message: 'Error al eliminar el mensaje' });
        }
    }, [markMessageDeleted]);

    const handleViewProfile = useCallback((userId: number) => {
        setProfileUserId(userId);
        setProfileOpen(true);
    }, []);

    const handleGroupCreated = useCallback(async () => {
        setGroupModalOpen(false);
        setEditingGroup(null);
        await fetchConversations();
    }, []);

    const handleEditGroup = useCallback((conversationId: number) => {
        setEditingGroup(conversationId);
        setGroupModalOpen(true);
    }, []);

    if (loading && conversations.length === 0) {
        return (
            <Center style={{ height: '100%' }}>
                <Loader size="lg" color="blue" />
            </Center>
        );
    }

    return (
        <>
            <Paper
                radius={0}
                style={{
                    display: 'flex',
                    height: '100%',
                    overflow: 'hidden',
                }}
            >
                {(!isMobile || !activeConversation) && (
                    <ChatSidebar
                        conversations={conversations}
                        activeConversation={activeConversation}
                        onSelect={handleSelectConversation}
                        onStartDirect={handleStartDirectChat}
                        onSelectById={handleSelectConversationById}
                        onCreateGroup={() => setGroupModalOpen(true)}
                        onViewProfile={handleViewProfile}
                        isMobile={isMobile}
                    />
                )}

                {activeConversation ? (
                    (!isMobile || activeConversation) && (
                        <ChatWindow
                            conversation={activeConversation}
                            messages={messages}
                            loading={messagesLoading}
                            currentUserId={user?.id || 0}
                            onSend={handleSendMessage}
                            onClearChat={handleClearChat}
                            onDeleteMessage={handleDeleteMessage}
                            onViewProfile={handleViewProfile}
                            onEditGroup={handleEditGroup}
                            isMobile={isMobile}
                            onBack={() => setActiveConversation(null)}
                            onTypingStart={handleTypingStart}
                            onTypingStop={handleTypingStop}
                            typingUsers={typingUsers[activeConversation.id_conversacion] || []}
                            onAddReaction={handleAddReaction}
                            onLoadMore={handleLoadMore}
                            hasMoreMessages={hasMoreMessages}
                            otherUserReadAt={otherUserReadAt[activeConversation.id_conversacion] || null}
                        />
                    )
                ) : !isMobile && (
                    <Center style={{ flex: 1, flexDirection: 'column', gap: 16 }}>
                        <IconMessageCircle size={80} stroke={1} style={{ color: 'var(--mantine-color-dimmed)' }} />
                        <Text size="xl" c="dimmed" fw={500}>Chat General ADL One</Text>
                        <Text size="sm" c="dimmed">Selecciona una conversación o busca un contacto para comenzar</Text>
                    </Center>
                )}
            </Paper>

            <ChatGroupModal
                opened={groupModalOpen}
                onClose={() => { setGroupModalOpen(false); setEditingGroup(null); }}
                onCreated={handleGroupCreated}
                editConversationId={editingGroup}
                onViewMember={handleViewProfile}
            />

            <ContactProfileDrawer
                opened={profileOpen}
                onClose={() => setProfileOpen(false)}
                userId={profileUserId}
                onStartChat={handleStartDirectChat}
            />
        </>
    );
};

export default ChatModule;
