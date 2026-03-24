import { useEffect, useCallback, useState } from 'react';
import { Paper, Text, Loader, Center } from '@mantine/core';
import { IconMessageCircle } from '@tabler/icons-react';
import { useChatStore } from '../../store/chatStore';
import { useAuth } from '../../contexts/AuthContext';
import { useNavStore } from '../../store/navStore';
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
    const {
        conversations, activeConversation, messages, loading, messagesLoading,
        fetchConversations, setActiveConversation, fetchMessages, addMessage,
        updateConversationLastMessage, decrementUnread, fetchFavorites
    } = useChatStore();

    const [groupModalOpen, setGroupModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<number | null>(null);
    const [profileUserId, setProfileUserId] = useState<number | null>(null);
    const [profileOpen, setProfileOpen] = useState(false);

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

        chatSocket.on('chatMiembroRemovido', (data: { id_conversacion: number }) => {
            fetchConversations();
            const state = useChatStore.getState();
            if (state.activeConversation?.id_conversacion === data.id_conversacion) {
                setActiveConversation(null);
            }
        });

        return () => {
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
        } catch (error) {
            console.error('Error starting direct chat:', error);
        }
    }, [fetchConversations, setActiveConversation]);

    const handleSelectConversationById = useCallback(async (conversationId: number) => {
        try {
            await generalChatService.unhideConversation(conversationId);
            await fetchConversations();
            const state = useChatStore.getState();
            const conv = state.conversations.find(c => Number(c.id_conversacion) === Number(conversationId));
            if (conv) setActiveConversation(conv);
        } catch (error) {
            console.error('Error opening conversation:', error);
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

    const handleSendMessage = useCallback(async (mensaje?: string, archivo?: File) => {
        if (!activeConversation) return;
        try {
            const newMsg = await generalChatService.sendMessage(activeConversation.id_conversacion, mensaje, archivo);
            addMessage(newMsg);
            updateConversationLastMessage(activeConversation.id_conversacion, newMsg);
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }, [activeConversation]);

    const handleClearChat = useCallback(async () => {
        if (!activeConversation) return;
        try {
            await generalChatService.clearMessages(activeConversation.id_conversacion);
            fetchMessages(activeConversation.id_conversacion);
        } catch (error) {
            console.error('Error clearing messages:', error);
        }
    }, [activeConversation]);

    const handleDeleteMessage = useCallback(async (messageId: number) => {
        try {
            await generalChatService.deleteMessage(messageId);
            if (activeConversation) fetchMessages(activeConversation.id_conversacion);
        } catch (error) {
            console.error('Error deleting message:', error);
        }
    }, [activeConversation]);

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
            <Center style={{ height: 'calc(100vh - 84px)' }}>
                <Loader size="lg" color="blue" />
            </Center>
        );
    }

    return (
        <>
            <Paper
                radius="md"
                style={{
                    display: 'flex',
                    height: 'calc(100vh - 84px)',
                    overflow: 'hidden',
                    border: '1px solid var(--mantine-color-default-border)'
                }}
            >
                <ChatSidebar
                    conversations={conversations}
                    activeConversation={activeConversation}
                    onSelect={handleSelectConversation}
                    onStartDirect={handleStartDirectChat}
                    onSelectById={handleSelectConversationById}
                    onCreateGroup={() => setGroupModalOpen(true)}
                    onViewProfile={handleViewProfile}
                />

                {activeConversation ? (
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
                    />
                ) : (
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
