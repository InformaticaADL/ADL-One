import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import {
    Box, ScrollArea, TextInput, ActionIcon, Avatar, Text, Group, Paper,
    Tooltip, Menu, Loader, Center, FileButton, Badge, Button, Stack, Popover, Modal
} from '@mantine/core';
import {
    IconSend, IconPaperclip, IconDotsVertical, IconTrash, IconClearAll,
    IconUsers, IconDownload, IconFile, IconUserCircle, IconSettings, IconArrowLeft, IconMoodSmile,
    IconInfoCircle, IconSearch, IconX, IconCornerUpLeft, IconChevronUp, IconBan,
    IconFileTypePdf, IconFileTypeXls, IconFileTypeDoc, IconFileTypePpt, IconFileTypeZip,
    IconFileTypeTxt, IconFileTypeCsv, IconFileTypeJpg, IconFileTypePng
} from '@tabler/icons-react';

// CH-03: devolver icono y color por extensión del archivo
const getFileIconAndColor = (name: string | null | undefined): { Icon: any; color: string } => {
    const fn = (name || '').toLowerCase();
    if (/\.(pdf)$/.test(fn)) return { Icon: IconFileTypePdf, color: '#d92d20' };           // rojo PDF
    if (/\.(xlsx?|xlsm)$/.test(fn)) return { Icon: IconFileTypeXls, color: '#1d6f42' };    // verde Excel
    if (/\.(csv)$/.test(fn)) return { Icon: IconFileTypeCsv, color: '#1d6f42' };
    if (/\.(docx?)$/.test(fn)) return { Icon: IconFileTypeDoc, color: '#2b579a' };         // azul Word
    if (/\.(pptx?)$/.test(fn)) return { Icon: IconFileTypePpt, color: '#d24726' };         // naranjo PPT
    if (/\.(zip|rar|7z|tar|gz)$/.test(fn)) return { Icon: IconFileTypeZip, color: '#9c6f1c' };
    if (/\.(txt|log)$/.test(fn)) return { Icon: IconFileTypeTxt, color: '#475569' };
    if (/\.(jpg|jpeg)$/.test(fn)) return { Icon: IconFileTypeJpg, color: '#6b7280' };
    if (/\.(png)$/.test(fn)) return { Icon: IconFileTypePng, color: '#6b7280' };
    return { Icon: IconFile, color: '#6b7280' };
};
import type { TypingUser } from '../../store/chatStore';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import type { ChatConversation, ChatMessage } from '../../services/general-chat.service';
import { generalChatService } from '../../services/general-chat.service';
import API_CONFIG from '../../config/api.config';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { useChatStore } from '../../store/chatStore';

interface ChatWindowProps {
    conversation: ChatConversation;
    messages: ChatMessage[];
    loading: boolean;
    currentUserId: number;
    onSend: (mensaje?: string, archivo?: File, replyToId?: number) => Promise<void>;
    onClearChat: () => void;
    onDeleteMessage: (messageId: number) => void;
    onViewProfile: (userId: number) => void;
    onEditGroup: (conversationId: number) => void;
    isMobile?: boolean;
    onBack?: () => void;
    onTypingStart?: () => void;
    onTypingStop?: () => void;
    typingUsers?: TypingUser[];
    onAddReaction?: (messageId: number, emoji: string) => Promise<void>;
    onLoadMore?: () => void;
    hasMoreMessages?: boolean;
    otherUserReadAt?: string | null;
}

const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '👏'];

const ChatWindow: React.FC<ChatWindowProps> = ({
    conversation, messages, loading, currentUserId,
    onSend, onClearChat, onDeleteMessage, onViewProfile, onEditGroup, isMobile, onBack,
    onTypingStart, onTypingStop, typingUsers = [],
    onAddReaction, onLoadMore, hasMoreMessages = false, otherUserReadAt = null
}) => {
    const { drafts, setDraft, clearDraft } = useChatStore();
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [confirmClear, setConfirmClear] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [fileSizeError, setFileSizeError] = useState<string | null>(null);
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [reactPopover, setReactPopover] = useState<number | null>(null);
    const [selectedImage, setSelectedImage] = useState<{ url: string; messageId: number; name: string } | null>(null);

    const isTypingRef = useRef(false);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const viewport = useRef<HTMLDivElement>(null);
    const fileResetRef = useRef<() => void>(null);
    const topSentinelRef = useRef<HTMLDivElement>(null);
    const prevScrollHeightRef = useRef<number>(0);
    const isLoadingMoreRef = useRef(false);
    const prevMessageCountRef = useRef(messages.length);

    const lastConvId = useRef<number>(conversation.id_conversacion);
    const textRef = useRef(text);
    const filesRef = useRef(pendingFiles);

    useEffect(() => { textRef.current = text; }, [text]);
    useEffect(() => { filesRef.current = pendingFiles; }, [pendingFiles]);

    // Draft save/restore on conversation change
    useEffect(() => {
        if (lastConvId.current !== conversation.id_conversacion) {
            setDraft(lastConvId.current, { text: textRef.current, files: filesRef.current });
        }
        const draft = drafts[conversation.id_conversacion];
        if (draft) {
            setText(draft.text || '');
            setPendingFiles(draft.files || []);
        } else {
            setText('');
            setPendingFiles([]);
        }
        lastConvId.current = conversation.id_conversacion;
        setReplyTo(null);
        setSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
    }, [conversation.id_conversacion, drafts, setDraft]);

    useEffect(() => {
        return () => {
            if (lastConvId.current) setDraft(lastConvId.current, { text: textRef.current, files: filesRef.current });
        };
    }, [setDraft]);

    // Scroll: auto-scroll for new messages, preserve position for load-more
    useLayoutEffect(() => {
        const currentCount = messages.length;
        const prevCount = prevMessageCountRef.current;
        if (currentCount > prevCount) {
            if (isLoadingMoreRef.current) {
                if (viewport.current) {
                    viewport.current.scrollTop += viewport.current.scrollHeight - prevScrollHeightRef.current;
                }
                isLoadingMoreRef.current = false;
            } else {
                setTimeout(() => {
                    if (viewport.current) viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
                }, 50);
            }
        }
        prevMessageCountRef.current = currentCount;
    }, [messages.length]);

    // IntersectionObserver for infinite scroll at top
    useEffect(() => {
        if (!hasMoreMessages || !topSentinelRef.current) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !isLoadingMoreRef.current) {
                    isLoadingMoreRef.current = true;
                    prevScrollHeightRef.current = viewport.current?.scrollHeight || 0;
                    onLoadMore?.();
                }
            },
            { threshold: 0.1, root: viewport.current }
        );
        observer.observe(topSentinelRef.current);
        return () => observer.disconnect();
    }, [hasMoreMessages, onLoadMore]);

    // Stop typing on conversation change / unmount
    useEffect(() => {
        return () => {
            if (isTypingRef.current) { isTypingRef.current = false; onTypingStop?.(); }
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        };
    }, [conversation.id_conversacion]);

    const handleTyping = () => {
        if (!isTypingRef.current) { isTypingRef.current = true; onTypingStart?.(); }
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => { isTypingRef.current = false; onTypingStop?.(); }, 2500);
    };

    const handleSend = async () => {
        const msg = text.trim();
        if (!msg && pendingFiles.length === 0) return;
        if (isTypingRef.current) {
            isTypingRef.current = false; onTypingStop?.();
            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        }
        const currentReplyId = replyTo?.id_mensaje;
        setReplyTo(null);
        setSending(true);
        try {
            await onSend(msg || undefined, pendingFiles[0] || undefined, currentReplyId);
            for (let i = 1; i < pendingFiles.length; i++) await onSend(undefined, pendingFiles[i]);
            setText('');
            setPendingFiles([]);
            fileResetRef.current?.();
            clearDraft(conversation.id_conversacion);
        } finally {
            setSending(false);
        }
    };

    const handleSearch = useCallback(async (q: string) => {
        if (q.trim().length < 2) { setSearchResults([]); return; }
        setSearchLoading(true);
        try {
            const results = await generalChatService.searchMessages(conversation.id_conversacion, q.trim());
            setSearchResults(results);
        } catch { setSearchResults([]); }
        finally { setSearchLoading(false); }
    }, [conversation.id_conversacion]);

    useEffect(() => {
        const t = setTimeout(() => handleSearch(searchQuery), 400);
        return () => clearTimeout(t);
    }, [searchQuery, handleSearch]);

    const baseUrl = API_CONFIG.getBaseURL();

    const handleDownload = async (messageId: number, fileName?: string) => {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const url = `${baseUrl}/api/gchat/download/${messageId}`;
        try {
            const response = await fetch(url, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName || 'archivo';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => { URL.revokeObjectURL(blobUrl); document.body.removeChild(link); }, 100);
        } catch {
            window.open(url, '_blank');
        }
    };

    const handleFileClick = (messageId: number) => {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        window.open(`${baseUrl}/api/gchat/download/${messageId}${token ? `?token=${token}` : ''}`, '_blank');
    };

    const handleFileUpload = (files: File[] | File | null) => {
        if (!files) return;
        const newFiles = Array.isArray(files) ? files : [files];
        const oversized = newFiles.filter(f => f.size > MAX_FILE_SIZE_BYTES);
        if (oversized.length > 0) {
            setFileSizeError(`${oversized.map(f => f.name).join(', ')} supera el límite de ${MAX_FILE_SIZE_MB} MB`);
            setTimeout(() => setFileSizeError(null), 4000);
            return;
        }
        setFileSizeError(null);
        setPendingFiles(prev => [...prev, ...newFiles]);
        fileResetRef.current?.();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
        if (e.key === 'Escape') setReplyTo(null);
    };

    const formatMsgTime = (date: string) => new Date(date).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    const formatDateSeparator = (date: string) => {
        const d = new Date(date);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) return 'Hoy';
        const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
        return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const isImageFile = (name: string | null) => !!name && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);

    const avatar = conversation.foto_display ? `${baseUrl}${conversation.foto_display}` : null;

    const getGroupUserColor = (userId: number) => {
        const colors = ['red', 'pink', 'grape', 'violet', 'indigo', 'cyan', 'teal', 'green', 'lime', 'orange'];
        return colors[userId % colors.length];
    };

    const groupReactions = (reacciones: ChatMessage['reacciones']) => {
        const map: Record<string, { count: number; users: string[]; mine: boolean }> = {};
        for (const r of reacciones || []) {
            if (!map[r.emoji]) map[r.emoji] = { count: 0, users: [], mine: false };
            map[r.emoji].count++;
            map[r.emoji].users.push(r.nombre_usuario);
            if (r.id_usuario === currentUserId) map[r.emoji].mine = true;
        }
        return Object.entries(map);
    };

    const lastSentMessage = [...messages].reverse().find(m => m.id_emisor === currentUserId && !m.eliminado && m.tipo_mensaje !== 'SISTEMA');
    const showVisto = conversation.tipo === 'DIRECTA' && otherUserReadAt && lastSentMessage
        && new Date(otherUserReadAt) >= new Date(lastSentMessage.fecha);

    let lastDate = '';

    const renderMessageList = (msgs: ChatMessage[]) => {
        lastDate = '';
        return msgs.map((msg) => {
            const isMine = msg.id_emisor === currentUserId;
            const isSystem = msg.tipo_mensaje === 'SISTEMA';
            const isDeleted = !!msg.eliminado;
            const msgDate = formatDateSeparator(msg.fecha);
            const showDateSep = msgDate !== lastDate;
            if (showDateSep) lastDate = msgDate;
            const reactions = groupReactions(msg.reacciones || []);
            const isLastSent = msg.id_mensaje === lastSentMessage?.id_mensaje;

            return (
                <Box key={msg.id_mensaje}>
                    {showDateSep && (
                        <Center my="sm">
                            <Badge variant="light" color="gray" size="sm" radius="sm">{msgDate}</Badge>
                        </Center>
                    )}

                    {isSystem ? (
                        <Center my="sm">
                            <Paper px="sm" py={4} radius="xl" withBorder
                                style={{ borderColor: 'var(--mantine-color-gray-3)', background: 'var(--mantine-color-gray-0)' }}>
                                <Group gap={5}>
                                    <IconInfoCircle size={12} color="var(--mantine-color-gray-5)" />
                                    <Text size="xs" c="dimmed">{msg.mensaje}</Text>
                                </Group>
                            </Paper>
                        </Center>
                    ) : (
                        <Box
                            className="msg-row"
                            mb={reactions.length > 0 && !isDeleted ? 20 : "xs"}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: isMine ? 'flex-end' : 'flex-start',
                            }}
                        >
                            {/* Sender name */}
                            <Text size="xs" fw={700} c={`${getGroupUserColor(msg.id_emisor || 0)}.7`} mb={2}
                                mx={4}
                                style={{ cursor: 'pointer', textAlign: isMine ? 'right' : 'left' }}
                                onClick={() => !isDeleted && onViewProfile(msg.id_emisor)}>
                                {msg.nombre_emisor}
                            </Text>

                            {/* Bubble row: [actions | bubble] or [bubble | actions] */}
                            <Group gap={6} align="center" wrap="nowrap" style={{ maxWidth: '100%' }}>

                                {/* Action bar for OWN messages (left side of bubble) */}
                                {isMine && !isDeleted && (
                                    <Group gap={2} className="msg-actions" wrap="nowrap">
                                        <Tooltip label="Responder" position="top" withArrow>
                                            <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => setReplyTo(msg)}>
                                                <IconCornerUpLeft size={15} />
                                            </ActionIcon>
                                        </Tooltip>
                                        <Popover
                                            opened={reactPopover === msg.id_mensaje}
                                            onChange={o => { if (!o) setReactPopover(null); }}
                                            position="top" withArrow shadow="md"
                                        >
                                            <Popover.Target>
                                                <Tooltip label="Reaccionar" position="top" withArrow>
                                                    <ActionIcon size="sm" variant="subtle" color="gray"
                                                        onClick={() => setReactPopover(p => p === msg.id_mensaje ? null : msg.id_mensaje)}>
                                                        <IconMoodSmile size={15} />
                                                    </ActionIcon>
                                                </Tooltip>
                                            </Popover.Target>
                                            <Popover.Dropdown p={6}>
                                                <Group gap={4}>
                                                    {QUICK_REACTIONS.map(emoji => (
                                                        <ActionIcon key={emoji} variant="subtle" size="md"
                                                            onClick={(e) => { e.stopPropagation(); onAddReaction?.(msg.id_mensaje, emoji); setReactPopover(null); }}
                                                            style={{ fontSize: 18 }}>
                                                            {emoji}
                                                        </ActionIcon>
                                                    ))}
                                                </Group>
                                            </Popover.Dropdown>
                                        </Popover>
                                        <Tooltip label="Eliminar" position="top" withArrow>
                                            <ActionIcon size="sm" variant="subtle" color="red"
                                                onClick={() => setConfirmDeleteId(msg.id_mensaje)}>
                                                <IconTrash size={15} />
                                            </ActionIcon>
                                        </Tooltip>
                                    </Group>
                                )}

                                {/* The bubble */}
                                <Box style={{ maxWidth: '100%', minWidth: 0, position: 'relative' }}>
                                    {isDeleted ? (
                                        /* Deleted message placeholder */
                                        <Paper
                                            p="xs" px="sm" radius="md"
                                            style={{
                                                background: 'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-6))',
                                                border: '1px dashed var(--mantine-color-gray-4)'
                                            }}
                                        >
                                            <Group gap={6}>
                                                <IconBan size={14} color="var(--mantine-color-gray-5)" />
                                                <Text size="sm" fs="italic" c="dimmed">
                                                    {isMine ? 'Eliminaste este mensaje' : 'Mensaje eliminado'}
                                                </Text>
                                            </Group>
                                        </Paper>
                                    ) : (
                                        <Paper
                                            p="xs" px="sm" radius="md"
                                            style={{
                                                background: isMine
                                                    ? 'var(--mantine-color-blue-6)'
                                                    : 'light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-4))',
                                                color: isMine ? 'white' : 'inherit',
                                                borderBottomRightRadius: isMine ? 2 : undefined,
                                                borderBottomLeftRadius: !isMine ? 2 : undefined,
                                            }}
                                        >
                                            {/* Quoted reply snippet */}
                                            {msg.id_mensaje_padre && (
                                                <Box
                                                    mb={4} p="xs"
                                                    style={{
                                                        borderLeft: `3px solid ${isMine ? 'rgba(255,255,255,0.6)' : 'var(--mantine-color-blue-4)'}`,
                                                        borderRadius: 4,
                                                        background: isMine
                                                            ? 'rgba(255,255,255,0.12)'
                                                            : 'light-dark(var(--mantine-color-gray-3), var(--mantine-color-dark-6))',
                                                    }}
                                                >
                                                    {msg.padre_eliminado ? (
                                                        <Text size="xs" fs="italic" style={{ opacity: 0.7 }}>Mensaje eliminado</Text>
                                                    ) : (
                                                        <>
                                                            <Text size="xs" fw={700} style={{ opacity: isMine ? 0.85 : 1 }}
                                                                c={isMine ? undefined : `${getGroupUserColor(msg.id_emisor_padre || 0)}.7`}>
                                                                {msg.nombre_emisor_padre || 'Mensaje'}
                                                            </Text>
                                                            <Text size="xs" lineClamp={1} style={{ opacity: 0.8 }}>
                                                                {msg.tipo_mensaje_padre === 'ARCHIVO'
                                                                    ? `📎 ${msg.archivo_nombre_padre || 'Archivo'}`
                                                                    : msg.mensaje_padre || ''}
                                                            </Text>
                                                        </>
                                                    )}
                                                </Box>
                                            )}

                                            {/* File attachment */}
                                            {msg.tipo_mensaje === 'ARCHIVO' && msg.archivo_nombre && (
                                                <Box mb={msg.mensaje ? 6 : 0}>
                                                    {isImageFile(msg.archivo_nombre) ? (
                                                        <img
                                                            src={`${baseUrl}${msg.archivo_ruta}`}
                                                            alt={msg.archivo_nombre}
                                                            style={{ maxWidth: 280, maxHeight: 200, borderRadius: 8, objectFit: 'cover', cursor: 'pointer', display: 'block' }}
                                                            onClick={() => setSelectedImage({ url: `${baseUrl}${msg.archivo_ruta}`, messageId: msg.id_mensaje, name: msg.archivo_nombre! })}
                                                        />
                                                    ) : (
                                                        <Group gap="xs" p="xs" w="100%"
                                                            style={{
                                                                background: isMine ? 'rgba(255,255,255,0.15)' : 'light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-4))',
                                                                borderRadius: 6, cursor: 'pointer', color: isMine ? 'white' : 'inherit'
                                                            }}
                                                            onClick={() => handleFileClick(msg.id_mensaje)}
                                                        >
                                                            {(() => {
                                                                // CH-03: icono SIEMPRE con su color específico (PDF rojo, Excel verde, etc.)
                                                                // sobre un fondo blanco para contraste, incluso en mensajes propios.
                                                                const { Icon, color } = getFileIconAndColor(msg.archivo_nombre);
                                                                return (
                                                                    <Box style={{
                                                                        backgroundColor: 'white',
                                                                        borderRadius: 6,
                                                                        padding: 4,
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        flexShrink: 0
                                                                    }}>
                                                                        <Icon size={22} color={color} stroke={1.5} />
                                                                    </Box>
                                                                );
                                                            })()}
                                                            <Box style={{ flex: 1, minWidth: 0 }}>
                                                                <Text size="xs" fw={500} truncate style={{ color: isMine ? 'white' : 'var(--mantine-color-gray-8)' }}>
                                                                    {msg.archivo_nombre}
                                                                </Text>
                                                            </Box>
                                                            <IconDownload size={16} style={{ color: isMine ? 'white' : 'var(--mantine-color-gray-7)' }} />
                                                        </Group>
                                                    )}
                                                </Box>
                                            )}

                                            {/* Text */}
                                            {msg.mensaje && (
                                                <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                    {msg.mensaje}
                                                </Text>
                                            )}

                                            {/* Timestamp */}
                                            <Text size="xs" style={{
                                                opacity: isMine ? 0.8 : 0.6, textAlign: 'right', marginTop: 2, fontSize: 10,
                                                color: isMine ? 'rgba(255,255,255,0.9)' : 'var(--mantine-color-black)',
                                                fontWeight: isMine ? 400 : 700
                                            }}>
                                                {formatMsgTime(msg.fecha)}{msg.editado && ' · editado'}
                                            </Text>
                                        </Paper>
                                    )}

                                    {/* Reactions strip — overlapping bubble bottom (WhatsApp style) */}
                                    {reactions.length > 0 && !isDeleted && (
                                        <Group
                                            gap={4}
                                            justify={isMine ? 'flex-end' : 'flex-start'}
                                            style={{
                                                position: 'absolute',
                                                bottom: -14,
                                                right: isMine ? 4 : undefined,
                                                left: isMine ? undefined : 4,
                                                zIndex: 2,
                                            }}
                                        >
                                            {reactions.map(([emoji, data]) => (
                                                <Tooltip key={emoji} label={data.users.join(', ')} position="top" withArrow>
                                                    <Box
                                                        onClick={() => onAddReaction?.(msg.id_mensaje, emoji)}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 3,
                                                            background: data.mine
                                                                ? 'light-dark(var(--mantine-color-blue-1), var(--mantine-color-blue-9))'
                                                                : 'light-dark(white, var(--mantine-color-dark-5))',
                                                            border: `1.5px solid ${data.mine ? 'var(--mantine-color-blue-4)' : 'var(--mantine-color-default-border)'}`,
                                                            borderRadius: 20,
                                                            padding: '2px 7px',
                                                            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                                                            cursor: 'pointer',
                                                            userSelect: 'none',
                                                        }}
                                                    >
                                                        <span style={{ fontSize: 15, lineHeight: 1 }}>{emoji}</span>
                                                        {data.count > 1 && (
                                                            <Text size="xs" fw={600} style={{ fontSize: 12, lineHeight: 1 }}
                                                                c={data.mine ? 'blue.7' : 'dimmed'}>
                                                                {data.count}
                                                            </Text>
                                                        )}
                                                    </Box>
                                                </Tooltip>
                                            ))}
                                        </Group>
                                    )}

                                    {/* Read receipt */}
                                    {isLastSent && showVisto && (
                                        <Text size="xs" c="dimmed" ta="right" mt={reactions.length > 0 ? 18 : 2} style={{ fontSize: 10 }}>
                                            Visto {formatMsgTime(otherUserReadAt!)}
                                        </Text>
                                    )}
                                </Box>

                                {/* Action bar for OTHERS' messages (right side of bubble) */}
                                {!isMine && !isDeleted && (
                                    <Group gap={2} className="msg-actions" wrap="nowrap">
                                        <Tooltip label="Responder" position="top" withArrow>
                                            <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => setReplyTo(msg)}>
                                                <IconCornerUpLeft size={15} />
                                            </ActionIcon>
                                        </Tooltip>
                                        <Popover
                                            opened={reactPopover === msg.id_mensaje}
                                            onChange={o => { if (!o) setReactPopover(null); }}
                                            position="top" withArrow shadow="md"
                                        >
                                            <Popover.Target>
                                                <Tooltip label="Reaccionar" position="top" withArrow>
                                                    <ActionIcon size="sm" variant="subtle" color="gray"
                                                        onClick={() => setReactPopover(p => p === msg.id_mensaje ? null : msg.id_mensaje)}>
                                                        <IconMoodSmile size={15} />
                                                    </ActionIcon>
                                                </Tooltip>
                                            </Popover.Target>
                                            <Popover.Dropdown p={6}>
                                                <Group gap={4}>
                                                    {QUICK_REACTIONS.map(emoji => (
                                                        <ActionIcon key={emoji} variant="subtle" size="md"
                                                            onClick={(e) => { e.stopPropagation(); onAddReaction?.(msg.id_mensaje, emoji); setReactPopover(null); }}
                                                            style={{ fontSize: 18 }}>
                                                            {emoji}
                                                        </ActionIcon>
                                                    ))}
                                                </Group>
                                            </Popover.Dropdown>
                                        </Popover>
                                    </Group>
                                )}
                            </Group>
                        </Box>
                    )}
                </Box>
            );
        });
    };

    return (
        <Box style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--mantine-color-body)' }}>

            {/* Header */}
            <Box p="sm" px="md" style={{
                borderBottom: '1px solid var(--mantine-color-default-border)',
                display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, minHeight: 64
            }}>
                {isMobile && (
                    <ActionIcon variant="subtle" color="gray" onClick={onBack} size="lg">
                        <IconArrowLeft size={24} />
                    </ActionIcon>
                )}

                {searchOpen ? (
                    <TextInput
                        placeholder="Buscar mensajes..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.currentTarget.value)}
                        style={{ flex: 1 }} size="sm" radius="md" autoFocus
                        rightSection={searchLoading ? <Loader size="xs" /> : undefined}
                    />
                ) : (
                    <Box
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center',
                            justifyContent: isMobile ? 'center' : 'flex-start',
                            gap: 12, cursor: 'pointer', paddingRight: isMobile ? 40 : 0
                        }}
                        onClick={() => {
                            if (conversation.tipo === 'DIRECTA' && conversation.contacto_id) onViewProfile(conversation.contacto_id);
                            else if (conversation.tipo === 'GRUPO') onEditGroup(conversation.id_conversacion);
                        }}
                    >
                        {!isMobile && (
                            <Avatar src={avatar} radius="xl" size={40} color={conversation.tipo === 'GRUPO' ? 'teal' : 'blue'}>
                                {conversation.tipo === 'GRUPO' ? <IconUsers size={20} /> : conversation.nombre_display?.charAt(0)?.toUpperCase()}
                            </Avatar>
                        )}
                        <Box style={{ textAlign: isMobile ? 'center' : 'left' }}>
                            <Text size={isMobile ? 'md' : 'sm'} fw={700} truncate="end" lineClamp={1}>
                                {conversation.nombre_display || 'Chat'}
                            </Text>
                            {conversation.tipo === 'GRUPO' && (
                                <Text size="xs" c="dimmed">{conversation.total_miembros} miembros</Text>
                            )}
                        </Box>
                    </Box>
                )}

                <Tooltip label={searchOpen ? 'Cerrar búsqueda' : 'Buscar mensajes'}>
                    <ActionIcon variant="subtle" color={searchOpen ? 'blue' : 'gray'} size="lg"
                        onClick={() => { setSearchOpen(o => !o); setSearchQuery(''); setSearchResults([]); }}>
                        {searchOpen ? <IconX size={18} /> : <IconSearch size={18} />}
                    </ActionIcon>
                </Tooltip>

                <Menu position="bottom-end" withArrow shadow="md">
                    <Menu.Target>
                        <ActionIcon variant="subtle" color="gray" size="lg"><IconDotsVertical size={20} /></ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                        {conversation.tipo === 'DIRECTA' && conversation.contacto_id && (
                            <Menu.Item leftSection={<IconUserCircle size={14} />} onClick={() => onViewProfile(conversation.contacto_id!)}>
                                Ver perfil
                            </Menu.Item>
                        )}
                        {conversation.tipo === 'GRUPO' && (
                            <Menu.Item leftSection={<IconSettings size={14} />} onClick={() => onEditGroup(conversation.id_conversacion)}>
                                Configurar grupo
                            </Menu.Item>
                        )}
                        <Menu.Divider />
                        <Menu.Item leftSection={<IconClearAll size={14} />} color="orange" onClick={() => setConfirmClear(true)}>
                            Limpiar chat
                        </Menu.Item>
                    </Menu.Dropdown>
                </Menu>
            </Box>

            {/* Messages / Search results */}
            <ScrollArea style={{ flex: 1 }} type="auto" viewportRef={viewport} px="md" py="sm">
                {searchOpen ? (
                    <Box>
                        {searchQuery.length < 2 ? (
                            <Center style={{ height: 120 }}>
                                <Text size="sm" c="dimmed">Escribe al menos 2 caracteres para buscar</Text>
                            </Center>
                        ) : searchLoading ? (
                            <Center style={{ height: 120 }}><Loader size="md" /></Center>
                        ) : searchResults.length === 0 ? (
                            <Center style={{ height: 120 }}>
                                <Text size="sm" c="dimmed">No se encontraron mensajes</Text>
                            </Center>
                        ) : (
                            <Stack gap="xs">
                                <Text size="xs" c="dimmed">{searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}</Text>
                                {searchResults.map(msg => (
                                    <Paper key={msg.id_mensaje} p="sm" radius="md" withBorder style={{ borderColor: 'var(--mantine-color-gray-3)' }}>
                                        <Group justify="space-between" mb={4}>
                                            <Text size="xs" fw={700} c={`${getGroupUserColor(msg.id_emisor)}.7`}>{msg.nombre_emisor}</Text>
                                            <Text size="xs" c="dimmed">{formatMsgTime(msg.fecha)} · {formatDateSeparator(msg.fecha)}</Text>
                                        </Group>
                                        <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.mensaje}</Text>
                                    </Paper>
                                ))}
                            </Stack>
                        )}
                    </Box>
                ) : loading ? (
                    <Center style={{ height: 200 }}><Loader size="md" /></Center>
                ) : messages.length === 0 ? (
                    <Center style={{ height: 200, flexDirection: 'column', gap: 8 }}>
                        <Text size="sm" c="dimmed">No hay mensajes aún</Text>
                        <Text size="xs" c="dimmed">Envía el primer mensaje 👋</Text>
                    </Center>
                ) : (
                    <>
                        <div ref={topSentinelRef} style={{ height: 1 }} />
                        {hasMoreMessages && (
                            <Center mb="sm">
                                <ActionIcon variant="light" color="gray" size="sm" radius="xl"
                                    onClick={() => {
                                        isLoadingMoreRef.current = true;
                                        prevScrollHeightRef.current = viewport.current?.scrollHeight || 0;
                                        onLoadMore?.();
                                    }}>
                                    <IconChevronUp size={14} />
                                </ActionIcon>
                            </Center>
                        )}
                        {renderMessageList(messages)}
                    </>
                )}
            </ScrollArea>

            {/* Typing indicator */}
            {typingUsers.length > 0 && (
                <Box px="md" pb={4} style={{ minHeight: 20 }}>
                    <Text size="xs" c="dimmed" fs="italic">
                        {typingUsers.length === 1
                            ? `${typingUsers[0].name} está escribiendo...`
                            : `${typingUsers.map(t => t.name).join(', ')} están escribiendo...`}
                    </Text>
                </Box>
            )}

            {fileSizeError && (
                <Box px="md" pb={4}><Text size="xs" c="red">{fileSizeError}</Text></Box>
            )}

            {/* Input area */}
            <Box p="sm" px="md" style={{ borderTop: '1px solid var(--mantine-color-default-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* Reply preview bar */}
                {replyTo && (
                    <Box px="sm" py={6} style={{
                        borderLeft: '3px solid var(--mantine-color-blue-4)', borderRadius: 6,
                        background: 'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-6))',
                        display: 'flex', alignItems: 'center', gap: 8
                    }}>
                        <Box style={{ flex: 1, minWidth: 0 }}>
                            <Text size="xs" fw={700} c="blue.6" truncate>{replyTo.nombre_emisor}</Text>
                            <Text size="xs" c="dimmed" truncate lineClamp={1}>
                                {replyTo.tipo_mensaje === 'ARCHIVO'
                                    ? `📎 ${replyTo.archivo_nombre || 'Archivo'}`
                                    : replyTo.mensaje || ''}
                            </Text>
                        </Box>
                        <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setReplyTo(null)}>
                            <IconX size={12} />
                        </ActionIcon>
                    </Box>
                )}

                {/* File previews */}
                {pendingFiles.length > 0 && (
                    <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {pendingFiles.map((file, index) => (
                            <Box key={`${file.name}-${index}`} style={{
                                position: 'relative', display: 'inline-flex', alignItems: 'center',
                                background: 'var(--mantine-color-gray-1)', padding: '6px 10px', borderRadius: 8
                            }}>
                                {file.type.startsWith('image/') ? (
                                    <img src={URL.createObjectURL(file)} alt="preview" style={{ maxHeight: 60, borderRadius: 4 }} />
                                ) : (
                                    <Group gap="xs">
                                        {(() => {
                                            // CH-03: usar prop `color` de Tabler en vez de style.color para garantizar que se aplique
                                            const { Icon, color } = getFileIconAndColor(file.name);
                                            return <Icon size={22} color={color} stroke={1.5} />;
                                        })()}
                                        <Text size="xs" truncate fw={500} style={{ maxWidth: 150 }}>{file.name}</Text>
                                    </Group>
                                )}
                                <ActionIcon size="xs" color="red" radius="xl" variant="filled"
                                    style={{ position: 'absolute', top: -6, right: -6, boxShadow: 'var(--mantine-shadow-sm)' }}
                                    onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== index))}>
                                    <IconTrash size={12} />
                                </ActionIcon>
                            </Box>
                        ))}
                    </Box>
                )}

                <Box style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                    <Popover position="top-start" withArrow shadow="md" withinPortal opened={emojiOpen} onChange={setEmojiOpen}>
                        <Popover.Target>
                            <Tooltip label="Insertar emoji">
                                <ActionIcon variant="subtle" color="gray" size="lg" radius="md" disabled={sending}
                                    onClick={() => setEmojiOpen(o => !o)}>
                                    <IconMoodSmile size={20} />
                                </ActionIcon>
                            </Tooltip>
                        </Popover.Target>
                        <Popover.Dropdown p={0}>
                            <EmojiPicker onEmojiClick={(d) => { setText(p => p + d.emoji); setEmojiOpen(false); }}
                                width={300} height={350} theme={Theme.AUTO} />
                        </Popover.Dropdown>
                    </Popover>

                    <FileButton onChange={handleFileUpload} accept="*/*" multiple resetRef={fileResetRef}>
                        {(props) => (
                            <Tooltip label="Adjuntar archivo">
                                <ActionIcon {...props} variant="light" color="gray" size="lg" radius="md" disabled={sending}>
                                    <IconPaperclip size={20} />
                                </ActionIcon>
                            </Tooltip>
                        )}
                    </FileButton>

                    <TextInput
                        placeholder="Escribe un mensaje..."
                        value={text}
                        onChange={e => { setText(e.currentTarget.value); handleTyping(); }}
                        onKeyDown={handleKeyDown}
                        radius="md" size="sm" style={{ flex: 1 }} disabled={sending}
                    />

                    <ActionIcon variant="filled" color="blue" size="lg" radius="md"
                        onClick={handleSend} loading={sending}
                        disabled={(!text.trim() && pendingFiles.length === 0) || sending}>
                        <IconSend size={18} />
                    </ActionIcon>
                </Box>
            </Box>

            {/* Confirm: clear chat */}
            <ConfirmModal
                isOpen={confirmClear}
                title="Limpiar Chat"
                message="¿Estás seguro de que deseas limpiar todos los mensajes de esta conversación? Esta acción no se puede deshacer."
                confirmText="Limpiar"
                confirmColor="var(--mantine-color-orange-6)"
                onConfirm={() => { onClearChat(); setConfirmClear(false); }}
                onCancel={() => setConfirmClear(false)}
            />

            {/* Confirm: delete message */}
            <ConfirmModal
                isOpen={confirmDeleteId !== null}
                title="Eliminar mensaje"
                message="¿Eliminar este mensaje para todos? Esta acción no se puede deshacer."
                confirmText="Eliminar"
                confirmColor="var(--mantine-color-red-6)"
                onConfirm={() => {
                    if (confirmDeleteId !== null) onDeleteMessage(confirmDeleteId);
                    setConfirmDeleteId(null);
                }}
                onCancel={() => setConfirmDeleteId(null)}
            />

            {/* Image viewer — rendered in a Portal so it covers the full viewport including sidebar */}
            <Modal
                opened={!!selectedImage}
                onClose={() => setSelectedImage(null)}
                title={selectedImage?.name || 'Visor de Imagen'}
                size="xl"
                centered
                overlayProps={{ backgroundOpacity: 0.75, blur: 4 }}
                styles={{ body: { display: 'flex', flexDirection: 'column', gap: 12 } }}
            >
                {selectedImage && (
                    <>
                        <Box style={{ display: 'flex', justifyContent: 'center', overflow: 'hidden' }}>
                            <img
                                src={selectedImage.url}
                                alt={selectedImage.name}
                                style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 4 }}
                            />
                        </Box>
                        <Button
                            leftSection={<IconDownload size={16} />}
                            onClick={() => handleDownload(selectedImage.messageId, selectedImage.name)}
                            fullWidth
                            color="blue"
                        >
                            Descargar Imagen Original
                        </Button>
                    </>
                )}
            </Modal>
        </Box>
    );
};

export default ChatWindow;
