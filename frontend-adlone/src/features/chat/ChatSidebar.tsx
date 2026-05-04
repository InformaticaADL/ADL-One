import { useState, useEffect, useRef } from 'react';
import {
    Box, TextInput, ScrollArea, UnstyledButton, Avatar, Text, Group, Badge,
    ActionIcon, Tooltip, Tabs, Loader, Center, Menu
} from '@mantine/core';
import {
    IconSearch, IconPlus, IconUsers, IconStar, IconStarFilled,
    IconUserCircle, IconDotsVertical, IconTrash
} from '@tabler/icons-react';
import { generalChatService } from '../../services/general-chat.service';
import type { ChatConversation, ChatContact } from '../../services/general-chat.service';
import { useChatStore } from '../../store/chatStore';
import { useAuth } from '../../contexts/AuthContext';
import API_CONFIG from '../../config/api.config';
import { ConfirmModal } from '../../components/common/ConfirmModal';

interface ChatSidebarProps {
    conversations: ChatConversation[];
    activeConversation: ChatConversation | null;
    onSelect: (conv: ChatConversation) => void;
    onStartDirect: (contactId: number) => void;
    onSelectById: (conversationId: number) => void;
    onCreateGroup: () => void;
    onViewProfile: (userId: number) => void;
    isMobile?: boolean;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
    conversations, activeConversation, onSelect, onStartDirect, onSelectById, onCreateGroup, onViewProfile, isMobile
}) => {
    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState<ChatContact[]>([]);
    const [searching, setSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [activeTab, setActiveTab] = useState<string | null>('chats');
    const { favorites, fetchFavorites, deleteConversation, messages } = useChatStore();
    const { user } = useAuth();
    const searchRef = useRef<HTMLDivElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    useEffect(() => {
        fetchFavorites();
    }, []);

    // Click outside to close search results
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        if (timerRef.current) clearTimeout(timerRef.current);
        setShowResults(true);
        setSearching(true);
        timerRef.current = setTimeout(async () => {
            try {
                const results = await generalChatService.searchContacts(value);
                const filteredResults = results.filter(
                    (contact) => !(contact.tipo_entidad === 'USER' && String(contact.id_entidad) === String(user?.id))
                );
                setSearchResults(filteredResults);
            } catch (err) {
                console.error(err);
            } finally {
                setSearching(false);
            }
        }, 300);
    };

    const handleSearchFocus = () => {
        setShowResults(true);
        if (searchResults.length === 0 && !searching) {
            handleSearchChange(search);
        }
    };

    const handleSelectItem = (item: ChatContact) => {
        setSearch('');
        setShowResults(false);
        setSearchResults([]);
        if (item.tipo_entidad === 'GROUP') {
            onSelectById(item.id_entidad);
        } else {
            onStartDirect(item.id_entidad);
        }
    };

    const handleToggleFavorite = async (e: React.MouseEvent, conversation: ChatConversation) => {
        e.stopPropagation();
        try {
            const isCurrentlyFav = conversation.es_favorito === 1;
            const targetId = conversation.tipo === 'DIRECTA' ? conversation.contacto_id : conversation.id_conversacion;
            const tipo = conversation.tipo === 'DIRECTA' ? 'USER' : 'GROUP';

            if (!targetId) return;

            if (isCurrentlyFav) {
                await generalChatService.removeFavorite(targetId, tipo);
            } else {
                await generalChatService.addFavorite(targetId, tipo);
            }
            // fetchConversations is passed via props? No, I should use the one from store or refresh.
            // In typical cases here conversations come from props but fetch is in store.
            useChatStore.getState().fetchConversations();
            fetchFavorites();
        } catch (err) {
            console.error(err);
        }
    };

    const handleToggleFavoriteById = async (e: React.MouseEvent, id: number, tipo: 'USER' | 'GROUP') => {
        e.stopPropagation();
        const isFav = favorites.some(f => f.id_entidad === id);
        try {
            if (isFav) {
                await generalChatService.removeFavorite(id, tipo);
            } else {
                await generalChatService.addFavorite(id, tipo);
            }
            useChatStore.getState().fetchConversations();
            fetchFavorites();
        } catch (err) {
            console.error(err);
        }
    };

    const formatTime = (date: string | null) => {
        if (!date) return '';
        const d = new Date(date);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        // Use local time for formatting
        if (isToday) return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
        return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
    };

    const filteredConversations = conversations.filter(c => {
        if (!search || showResults) return true;
        const name = c.nombre_display || '';
        return name.toLowerCase().includes(search.toLowerCase());
    });

    const renderConversationItem = (conv: ChatConversation) => {
        const isActive = activeConversation?.id_conversacion === conv.id_conversacion;
        const baseUrl = API_CONFIG.getBaseURL();
        const avatar = conv.foto_display ? `${baseUrl}${conv.foto_display}` : null;
        const isFav = conv.es_favorito === 1;

        return (
            <UnstyledButton
                component="div"
                key={conv.id_conversacion}
                onClick={() => onSelect(conv)}
                p="sm"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    borderRadius: 8,
                    background: isActive
                        ? 'var(--mantine-color-blue-light)'
                        : 'transparent',
                    transition: 'background 150ms ease',
                    width: '100%'
                }}
                className="chat-conversation-item"
            >
                <Avatar src={avatar} radius="xl" size={48} color={conv.tipo === 'GRUPO' ? 'teal' : 'blue'}>
                    {conv.tipo === 'GRUPO' ? <IconUsers size={22} /> : conv.nombre_display?.charAt(0)?.toUpperCase()}
                </Avatar>
                <Box style={{ flex: 1, minWidth: 0 }}>
                    <Group justify="space-between" wrap="nowrap" gap={4}>
                        <Text size="sm" fw={600} truncate style={{ flex: 1 }}>
                            {conv.nombre_display || 'Chat'}
                        </Text>
                        <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                            {formatTime(conv.ultimo_mensaje_fecha)}
                        </Text>
                    </Group>
                    <Group justify="space-between" wrap="nowrap" gap={4}>
                        <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
                            {conv.ultimo_tipo_mensaje === 'ARCHIVO' ? '📎 Archivo adjunto' :
                             conv.ultimo_tipo_mensaje === 'SISTEMA' ? `ℹ️ ${conv.ultimo_mensaje || ''}` :
                             conv.ultimo_mensaje || (activeConversation?.id_conversacion === conv.id_conversacion && messages.length === 0 ? '' : ' ')}
                        </Text>
                        <Group gap={4} style={{ flexShrink: 0 }}>
                            {conv.no_leidos > 0 && (
                                <Badge size="sm" variant="filled" color="blue" circle>
                                    {conv.no_leidos > 99 ? '99+' : conv.no_leidos}
                                </Badge>
                            )}

                            <Menu position="bottom-end" shadow="md" withinPortal>
                                <Menu.Target>
                                    <ActionIcon
                                        size="sm"
                                        variant="subtle"
                                        color="gray"
                                        onClick={(e) => e.stopPropagation()}
                                        className="chat-item-menu-btn"
                                    >
                                        <IconDotsVertical size={14} />
                                    </ActionIcon>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    <Menu.Item
                                        leftSection={isFav ? <IconStarFilled size={14} /> : <IconStar size={14} />}
                                        onClick={(e) => handleToggleFavorite(e, conv)}
                                    >
                                        {isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                                    </Menu.Item>
                                    <Menu.Item
                                        color="red"
                                        leftSection={<IconTrash size={14} />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmDeleteId(conv.id_conversacion);
                                        }}
                                    >
                                        Eliminar chat
                                    </Menu.Item>
                                </Menu.Dropdown>
                            </Menu>

                            <ActionIcon
                                size="xs"
                                variant="transparent"
                                onClick={(e) => handleToggleFavorite(e, conv)}
                                color={isFav ? 'yellow' : 'gray'}
                            >
                                {isFav ? <IconStarFilled size={14} /> : <IconStar size={14} />}
                            </ActionIcon>
                        </Group>
                    </Group>
                </Box>
            </UnstyledButton>
        );
    };

    return (
        <Box
            style={{
                width: isMobile ? '100%' : 340,
                borderRight: isMobile ? 'none' : '1px solid var(--mantine-color-default-border)',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--mantine-color-body)'
            }}
        >
            {/* Header */}
            <Box p="sm" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                <Group justify="space-between" mb="xs">
                    <Text size="lg" fw={700}>Chat</Text>
                    <Group gap={4}>
                        <Tooltip label="Nuevo grupo">
                            <ActionIcon variant="light" color="blue" onClick={onCreateGroup}>
                                <IconUsers size={18} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                </Group>

                {/* Search */}
                <Box ref={searchRef} style={{ position: 'relative' }}>
                    <TextInput
                        placeholder="Buscar contacto o grupo..."
                        leftSection={<IconSearch size={16} />}
                        value={search}
                        onChange={(e) => handleSearchChange(e.currentTarget.value)}
                        onFocus={handleSearchFocus}
                        size="sm"
                        radius="md"
                    />
                    {showResults && (
                        <Box
                            style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                zIndex: 100,
                                background: 'var(--mantine-color-body)',
                                border: '1px solid var(--mantine-color-default-border)',
                                borderRadius: '0 0 8px 8px',
                                boxShadow: 'var(--mantine-shadow-md)',
                                maxHeight: 300,
                                overflowY: 'auto'
                            }}
                        >
                            {searching ? (
                                <Center p="md"><Loader size="sm" /></Center>
                            ) : searchResults.length === 0 ? (
                                <Text p="md" c="dimmed" size="sm" ta="center">Sin resultados</Text>
                            ) : (
                                searchResults.map(item => (
                                    <UnstyledButton
                                        component="div"
                                        key={`${item.tipo_entidad}-${item.id_entidad}`}
                                        onClick={() => handleSelectItem(item)}
                                        p="xs"
                                        px="sm"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                                            borderRadius: 4, transition: 'background 150ms ease'
                                        }}
                                        className="chat-conversation-item"
                                    >
                                        <Avatar
                                            src={item.foto ? `${API_CONFIG.getBaseURL()}${item.foto}` : null}
                                            size={36} radius="xl" color={item.tipo_entidad === 'GROUP' ? 'teal' : 'blue'}
                                        >
                                            {item.tipo_entidad === 'GROUP' ? <IconUsers size={18} /> : item.nombre?.charAt(0)?.toUpperCase()}
                                        </Avatar>
                                        <Box style={{ flex: 1, minWidth: 0 }}>
                                            <Text size="sm" fw={500} truncate>{item.nombre}</Text>
                                            <Text size="xs" c="dimmed" truncate>{item.tipo_entidad === 'GROUP' ? 'Grupo' : (item.cargo || item.email)}</Text>
                                        </Box>
                                        {item.tipo_entidad === 'USER' && (
                                            <Tooltip label="Ver perfil">
                                                <ActionIcon size="sm" variant="subtle" onClick={(e) => { e.stopPropagation(); onViewProfile(item.id_entidad); }}>
                                                    <IconUserCircle size={16} />
                                                </ActionIcon>
                                            </Tooltip>
                                        )}
                                    </UnstyledButton>
                                ))
                            )}
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Tabs: Chats | Favoritos */}
            <Tabs value={activeTab} onChange={setActiveTab} variant="default">
                <Tabs.List grow>
                    <Tabs.Tab value="chats" leftSection={<IconSearch size={14} />}>Chats</Tabs.Tab>
                    <Tabs.Tab value="favoritos" leftSection={<IconStarFilled size={14} />}>Favoritos</Tabs.Tab>
                </Tabs.List>
            </Tabs>

            {/* List */}
            <ScrollArea style={{ flex: 1 }} type="auto" p="xs">
                {activeTab === 'chats' ? (
                    filteredConversations.length === 0 ? (
                        <Center style={{ padding: 40, flexDirection: 'column', gap: 8 }}>
                            <IconPlus size={32} stroke={1} style={{ color: 'var(--mantine-color-dimmed)' }} />
                            <Text size="sm" c="dimmed" ta="center">
                                No tienes conversaciones aún.{'\n'}Busca un contacto para comenzar.
                            </Text>
                        </Center>
                    ) : (
                        filteredConversations.map(renderConversationItem)
                    )
                ) : (
                    favorites.length === 0 ? (
                        <Center style={{ padding: 40, flexDirection: 'column', gap: 8 }}>
                            <IconStar size={32} stroke={1} style={{ color: 'var(--mantine-color-dimmed)' }} />
                            <Text size="sm" c="dimmed" ta="center">
                                No tienes contactos favoritos.{'\n'}Marca la ⭐ en un contacto.
                            </Text>
                        </Center>
                    ) : (
                        favorites.map(fav => {
                            return (
                                <UnstyledButton
                                    key={`fav-${fav.tipo_entidad}-${fav.id_entidad}`}
                                    component="div"
                                    onClick={() => fav.tipo_entidad === 'GROUP' ? onSelectById(fav.id_entidad) : onStartDirect(fav.id_entidad)}
                                    p="sm"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        borderRadius: 8, width: '100%', transition: 'background 150ms ease'
                                    }}
                                    className="chat-conversation-item"
                                >
                                    <Avatar
                                        src={fav.foto ? `${API_CONFIG.getBaseURL()}${fav.foto}` : null}
                                        size={42} radius="xl" color={fav.tipo_entidad === 'GROUP' ? 'teal' : 'blue'}
                                    >
                                        {fav.tipo_entidad === 'GROUP' ? <IconUsers size={20} /> : fav.nombre?.charAt(0)?.toUpperCase()}
                                    </Avatar>
                                    <Box style={{ flex: 1, minWidth: 0 }}>
                                        <Text size="sm" fw={500} truncate>{fav.nombre}</Text>
                                        <Text size="xs" c="dimmed" truncate>{fav.tipo_entidad === 'GROUP' ? 'Grupo' : (fav.cargo || fav.email)}</Text>
                                    </Box>
                                    <Group gap={4}>
                                        <Menu position="bottom-end" shadow="md" withinPortal>
                                            <Menu.Target>
                                                <ActionIcon
                                                    size="sm"
                                                    variant="subtle"
                                                    color="gray"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <IconDotsVertical size={14} />
                                                </ActionIcon>
                                            </Menu.Target>
                                            <Menu.Dropdown>
                                                <Menu.Item
                                                    leftSection={<IconStar size={14} />}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleFavoriteById(e, fav.id_entidad, fav.tipo_entidad);
                                                    }}
                                                >
                                                    Quitar de favoritos
                                                </Menu.Item>
                                                <Menu.Item
                                                    leftSection={<IconUserCircle size={14} />}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onViewProfile(fav.id_entidad);
                                                    }}
                                                >
                                                    Ver perfil
                                                </Menu.Item>
                                            </Menu.Dropdown>
                                        </Menu>

                                        <ActionIcon size="xs" variant="transparent" color="yellow" onClick={(e) => handleToggleFavoriteById(e, fav.id_entidad, fav.tipo_entidad)}>
                                            <IconStarFilled size={14} />
                                        </ActionIcon>
                                    </Group>
                                </UnstyledButton>
                            );
                        })
                    )
                )}
            </ScrollArea>

            <ConfirmModal
                isOpen={confirmDeleteId !== null}
                title="Eliminar Conversación"
                message="¿Estás seguro de que deseas eliminar esta conversación de tu bandeja? Se ocultará y se limpiará el historial, pero reaparecerá si recibes nuevos mensajes."
                confirmText="Eliminar"
                confirmColor="var(--mantine-color-red-6)"
                onConfirm={() => {
                    if (confirmDeleteId) deleteConversation(confirmDeleteId);
                    setConfirmDeleteId(null);
                }}
                onCancel={() => setConfirmDeleteId(null)}
            />
        </Box>
    );
};

export default ChatSidebar;
