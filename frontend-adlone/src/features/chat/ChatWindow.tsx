import { useState, useRef, useEffect } from 'react';
import {
    Box, ScrollArea, TextInput, ActionIcon, Avatar, Text, Group, Paper,
    Tooltip, Menu, Loader, Center, FileButton, Badge, Modal, Button, Stack, Popover
} from '@mantine/core';
import {
    IconSend, IconPaperclip, IconDotsVertical, IconTrash, IconClearAll,
    IconUsers, IconDownload, IconFile, IconUserCircle, IconSettings, IconArrowLeft, IconMoodSmile
} from '@tabler/icons-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import type { ChatConversation, ChatMessage } from '../../services/general-chat.service';
import API_CONFIG from '../../config/api.config';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { useChatStore } from '../../store/chatStore';

interface ChatWindowProps {
    conversation: ChatConversation;
    messages: ChatMessage[];
    loading: boolean;
    currentUserId: number;
    onSend: (mensaje?: string, archivo?: File) => Promise<void>;
    onClearChat: () => void;
    onDeleteMessage: (messageId: number) => void;
    onViewProfile: (userId: number) => void;
    onEditGroup: (conversationId: number) => void;
    isMobile?: boolean;
    onBack?: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
    conversation, messages, loading, currentUserId,
    onSend, onClearChat, onDeleteMessage, onViewProfile, onEditGroup, isMobile, onBack
}) => {
    const { drafts, setDraft, clearDraft } = useChatStore();
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [confirmClear, setConfirmClear] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const viewport = useRef<HTMLDivElement>(null);
    const fileResetRef = useRef<() => void>(null);
    const [selectedImage, setSelectedImage] = useState<{ url: string, messageId: number, name: string } | null>(null);

    // Track current state for draft saving on switch/unmount
    const lastConvId = useRef<number>(conversation.id_conversacion);
    const textRef = useRef(text);
    const filesRef = useRef(pendingFiles);

    useEffect(() => { textRef.current = text; }, [text]);
    useEffect(() => { filesRef.current = pendingFiles; }, [pendingFiles]);

    // Load draft on mount or conversation change
    useEffect(() => {
        // 1. Save previous draft
        if (lastConvId.current !== conversation.id_conversacion) {
            setDraft(lastConvId.current, { text: textRef.current, files: filesRef.current });
        }

        // 2. Load new draft
        const draft = drafts[conversation.id_conversacion];
        if (draft) {
            setText(draft.text || '');
            setPendingFiles(draft.files || []);
        } else {
            setText('');
            setPendingFiles([]);
        }

        lastConvId.current = conversation.id_conversacion;
    }, [conversation.id_conversacion, drafts, setDraft]);

    // Save draft on unmount
    useEffect(() => {
        return () => {
            if (lastConvId.current) {
                setDraft(lastConvId.current, { text: textRef.current, files: filesRef.current });
            }
        };
    }, [setDraft]);

    // Auto-scroll to bottom
    useEffect(() => {
        setTimeout(() => {
            if (viewport.current) {
                viewport.current.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
            }
        }, 100);
    }, [messages.length]);

    const handleSend = async () => {
        const msg = text.trim();
        if (!msg && pendingFiles.length === 0) return;
        setSending(true);
        try {
            // First message with text and first file (if any)
            const firstFile = pendingFiles[0];
            await onSend(msg || undefined, firstFile || undefined);

            // Remaining files as separate messages
            for (let i = 1; i < pendingFiles.length; i++) {
                await onSend(undefined, pendingFiles[i]);
            }

            setText('');
            setPendingFiles([]);
            fileResetRef.current?.(); // Clear file input value
            clearDraft(conversation.id_conversacion); // Clear draft after successful send
        } catch (err) {
            console.error('Error sending messages:', err);
        } finally {
            setSending(false);
        }
    };

    const baseUrl = API_CONFIG.getBaseURL();

    const handleDownload = (messageId: number) => {
        if (!messageId) {
            console.error('No messageId provided for download');
            return;
        }
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const url = `${baseUrl}/api/gchat/download/${messageId}${token ? `?token=${token}` : ''}`;
        
        console.log('Initiating download:', url);

        // Create hidden link to force download
        const link = document.createElement('a');
        link.href = url;
        link.style.display = 'none';
        link.setAttribute('download', ''); // Use backend's filename via Content-Disposition
        document.body.appendChild(link);
        link.click();
        
        // Cleanup with delay to ensure click is processed
        setTimeout(() => {
            if (document.body.contains(link)) {
                document.body.removeChild(link);
            }
        }, 100);
    };

    const handleFileClick = (messageId: number) => {
        if (!messageId) return;
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const url = `${baseUrl}/api/gchat/download/${messageId}${token ? `?token=${token}` : ''}`;
        window.open(url, '_blank');
    };

    const handleFileUpload = (files: File[] | File | null) => {
        if (!files) return;
        const newFiles = Array.isArray(files) ? files : [files];
        setPendingFiles(prev => [...prev, ...newFiles]);
        // Reset the input so the user can select the same file again 
        // or click the button multiple times to add more files
        fileResetRef.current?.();
    };

    const removePendingFile = (index: number) => {
        setPendingFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatMsgTime = (date: string) => {
        const d = new Date(date);
        return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDateSeparator = (date: string) => {
        const d = new Date(date);
        const now = new Date();
        if (d.toDateString() === now.toDateString()) return 'Hoy';
        const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
        return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const isImageFile = (name: string | null) => {
        if (!name) return false;
        return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
    };

    const avatar = conversation.foto_display ? `${baseUrl}${conversation.foto_display}` : null;

    const getGroupUserColor = (userId: number) => {
        const colors = ['red', 'pink', 'grape', 'violet', 'indigo', 'cyan', 'teal', 'green', 'lime', 'orange'];
        return colors[userId % colors.length];
    };

    // Group messages by date
    let lastDate = '';

    return (
        <Box style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--mantine-color-body)' }}>
            {/* Header */}
            <Box
                p="sm"
                px="md"
                style={{
                    borderBottom: '1px solid var(--mantine-color-default-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? 8 : 12,
                    minHeight: 64
                }}
            >
                {isMobile && (
                    <ActionIcon variant="subtle" color="gray" onClick={onBack} size="lg">
                        <IconArrowLeft size={24} />
                    </ActionIcon>
                )}

                <Box 
                    style={{ 
                        flex: 1, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: isMobile ? 'center' : 'flex-start',
                        gap: 12,
                        cursor: 'pointer',
                        paddingRight: isMobile ? 40 : 0 // Balance the back button for centering
                    }}
                    onClick={() => {
                        if (conversation.tipo === 'DIRECTA' && conversation.contacto_id) {
                            onViewProfile(conversation.contacto_id);
                        } else if (conversation.tipo === 'GRUPO') {
                            onEditGroup(conversation.id_conversacion);
                        }
                    }}
                >
                    {!isMobile && (
                        <Avatar
                            src={avatar}
                            radius="xl"
                            size={40}
                            color={conversation.tipo === 'GRUPO' ? 'teal' : 'blue'}
                        >
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

                <Menu position="bottom-end" withArrow shadow="md">
                    <Menu.Target>
                        <ActionIcon variant="subtle" color="gray" size="lg">
                            <IconDotsVertical size={20} />
                        </ActionIcon>
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

            {/* Messages */}
            <ScrollArea
                style={{ flex: 1 }}
                type="auto"
                viewportRef={viewport}
                px="md"
                py="sm"
            >
                {loading ? (
                    <Center style={{ height: 200 }}><Loader size="md" /></Center>
                ) : messages.length === 0 ? (
                    <Center style={{ height: 200, flexDirection: 'column', gap: 8 }}>
                        <Text size="sm" c="dimmed">No hay mensajes aún</Text>
                        <Text size="xs" c="dimmed">Envía el primer mensaje 👋</Text>
                    </Center>
                ) : (
                    messages.map((msg) => {
                        const isMine = msg.id_emisor === currentUserId;
                        const isSystem = msg.tipo_mensaje === 'SISTEMA';
                        const msgDate = formatDateSeparator(msg.fecha);
                        const showDateSep = msgDate !== lastDate;
                        if (showDateSep) lastDate = msgDate;

                        return (
                            <Box key={msg.id_mensaje}>
                                {showDateSep && (
                                    <Center my="sm">
                                        <Badge variant="light" color="gray" size="sm" radius="sm">
                                            {msgDate}
                                        </Badge>
                                    </Center>
                                )}

                                {isSystem ? (
                                    <Center my="xs">
                                        <Text size="xs" c="dimmed" fs="italic">{msg.mensaje}</Text>
                                    </Center>
                                ) : (
                                    <Box
                                        mb="xs"
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: isMine ? 'flex-end' : 'flex-start',
                                            maxWidth: '75%',
                                            marginLeft: isMine ? 'auto' : 0,
                                            marginRight: isMine ? 0 : 'auto'
                                        }}
                                    >
                                        {/* Sender name for groups and direct (if requested) */}
                                        <Text size="xs" fw={700} c={`${getGroupUserColor(msg.id_emisor || 0)}.7`} mb={2} 
                                              mx={4}
                                              style={{ cursor: 'pointer', textAlign: isMine ? 'right' : 'left' }}
                                              onClick={() => onViewProfile(msg.id_emisor)}>
                                            {msg.nombre_emisor}
                                        </Text>

                                        <Paper
                                            p="xs"
                                            px="sm"
                                            radius="md"
                                            style={{
                                                background: isMine
                                                    ? 'var(--mantine-color-blue-6)'
                                                    : 'light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-4))',
                                                color: isMine ? 'white' : 'inherit',
                                                borderBottomRightRadius: isMine ? 2 : undefined,
                                                borderBottomLeftRadius: !isMine ? 2 : undefined,
                                                position: 'relative'
                                            }}
                                        >
                                            {/* File attachment */}
                                            {msg.tipo_mensaje === 'ARCHIVO' && msg.archivo_nombre && (
                                                <Box mb={msg.mensaje ? 6 : 0}>
                                                    {isImageFile(msg.archivo_nombre) ? (
                                                        <Box style={{ position: 'relative', display: 'inline-block' }}>
                                                            <img
                                                                src={`${baseUrl}${msg.archivo_ruta}`}
                                                                alt={msg.archivo_nombre}
                                                                style={{
                                                                    maxWidth: 280,
                                                                    maxHeight: 200,
                                                                    borderRadius: 8,
                                                                    objectFit: 'cover',
                                                                    cursor: 'pointer'
                                                                }}
                                                                onClick={() => setSelectedImage({
                                                                    url: `${baseUrl}${msg.archivo_ruta}`,
                                                                    messageId: msg.id_mensaje,
                                                                    name: msg.archivo_nombre!
                                                                })}
                                                                title="Presione para ver imagen ampliada"
                                                            />
                                                        </Box>
                                                    ) : (
                                                        <Group
                                                            gap="xs"
                                                            p="xs"
                                                            w="100%"
                                                            style={{
                                                                background: isMine
                                                                    ? 'rgba(255,255,255,0.15)'
                                                                    : 'light-dark(var(--mantine-color-gray-2), var(--mantine-color-dark-4))',
                                                                borderRadius: 6,
                                                                cursor: 'pointer',
                                                                color: isMine ? 'white' : 'inherit' // Ensure readability
                                                            }}
                                                            onClick={() => handleFileClick(msg.id_mensaje)}
                                                            title="Presione para descargar y abrir archivo"
                                                        >
                                                            <IconFile size={20} style={{ color: isMine ? 'white' : 'var(--mantine-color-gray-7)' }} />
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

                                            {/* Text content */}
                                            {msg.mensaje && (
                                                <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                    {msg.mensaje}
                                                </Text>
                                            )}

                                            {/* Time */}
                                            <Text
                                                size="xs"
                                                style={{
                                                    opacity: isMine ? 0.8 : 0.6,
                                                    textAlign: 'right',
                                                    marginTop: 2,
                                                    fontSize: 10,
                                                    color: isMine ? 'rgba(255,255,255,0.9)' : 'var(--mantine-color-black)',
                                                    fontWeight: isMine ? 400 : 700
                                                }}
                                            >
                                                {formatMsgTime(msg.fecha)}
                                                {msg.editado && ' · editado'}
                                            </Text>

                                            {/* Delete own message */}
                                            {isMine && (
                                                <ActionIcon
                                                    size="xs"
                                                    variant="transparent"
                                                    color={isMine ? 'white' : 'gray'}
                                                    style={{
                                                        position: 'absolute',
                                                        top: 2,
                                                        right: 2,
                                                        opacity: 0,
                                                        transition: 'opacity 150ms'
                                                    }}
                                                    className="msg-delete-btn"
                                                    onClick={() => onDeleteMessage(msg.id_mensaje)}
                                                >
                                                    <IconTrash size={12} />
                                                </ActionIcon>
                                            )}
                                        </Paper>
                                    </Box>
                                )}
                            </Box>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </ScrollArea>

            {/* Input */}
            <Box
                p="sm"
                px="md"
                style={{
                    borderTop: '1px solid var(--mantine-color-default-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                }}
            >
                {/* File Previews */}
                {pendingFiles.length > 0 && (
                    <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {pendingFiles.map((file, index) => (
                            <Box key={`${file.name}-${index}`} style={{ 
                                position: 'relative', display: 'inline-flex', alignItems: 'center',
                                background: 'var(--mantine-color-gray-1)', padding: '6px 10px', borderRadius: 8,
                                maxWidth: '100%'
                            }}>
                                {file.type.startsWith('image/') ? (
                                    <img src={URL.createObjectURL(file)} alt="preview" style={{ maxHeight: 60, borderRadius: 4 }} />
                                ) : (
                                    <Group gap="xs">
                                        <IconFile size={20} style={{ color: 'var(--mantine-color-gray-6)' }} />
                                        <Text size="xs" truncate fw={500} style={{ maxWidth: 150 }}>{file.name}</Text>
                                    </Group>
                                )}
                                <ActionIcon 
                                    size="xs" color="red" radius="xl" variant="filled" 
                                    style={{ position: 'absolute', top: -6, right: -6, boxShadow: 'var(--mantine-shadow-sm)' }} 
                                    onClick={() => removePendingFile(index)}
                                >
                                    <IconTrash size={12} />
                                </ActionIcon>
                            </Box>
                        ))}
                    </Box>
                )}

                <Box style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                    <Popover position="top-start" withArrow shadow="md" withinPortal>
                        <Popover.Target>
                            <Tooltip label="Insertar emoji">
                                <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    size="lg"
                                    radius="md"
                                    disabled={sending}
                                >
                                    <IconMoodSmile size={20} />
                                </ActionIcon>
                            </Tooltip>
                        </Popover.Target>
                        <Popover.Dropdown p={0}>
                            <EmojiPicker onEmojiClick={(emojiData) => setText(prev => prev + emojiData.emoji)} width={300} height={350} theme={Theme.AUTO} />
                        </Popover.Dropdown>
                    </Popover>

                    <FileButton onChange={handleFileUpload} accept="*/*" multiple resetRef={fileResetRef}>
                        {(props) => (
                            <Tooltip label="Adjuntar archivo">
                                <ActionIcon
                                    {...props}
                                    variant="light"
                                    color="gray"
                                    size="lg"
                                    radius="md"
                                    disabled={sending}
                                >
                                    <IconPaperclip size={20} />
                                </ActionIcon>
                            </Tooltip>
                        )}
                    </FileButton>

                    <TextInput
                        placeholder="Escribe un mensaje..."
                        value={text}
                        onChange={(e) => setText(e.currentTarget.value)}
                        onKeyDown={handleKeyDown}
                        radius="md"
                        size="sm"
                        style={{ flex: 1 }}
                        disabled={sending}
                    />

                    <ActionIcon
                        variant="filled"
                        color="blue"
                        size="lg"
                        radius="md"
                        onClick={handleSend}
                        loading={sending}
                        disabled={(!text.trim() && pendingFiles.length === 0) || sending}
                    >
                        <IconSend size={18} />
                    </ActionIcon>
                </Box>
            </Box>

            <ConfirmModal
                isOpen={confirmClear}
                title="Limpiar Chat"
                message="¿Estás seguro de que deseas limpiar todos los mensajes de esta conversación? Esta acción no se puede deshacer."
                confirmText="Limpiar"
                confirmColor="var(--mantine-color-orange-6)"
                onConfirm={() => {
                    onClearChat();
                    setConfirmClear(false);
                }}
                onCancel={() => setConfirmClear(false)}
            />

            {/* Image Viewer Local Overlay */}
            {selectedImage && (
                <Box
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.75)',
                        zIndex: 200,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(2px)'
                    }}
                    onClick={() => setSelectedImage(null)}
                >
                    <Box 
                        onClick={(e) => e.stopPropagation()}
                        p="md"
                        style={{
                            backgroundColor: 'var(--mantine-color-body)',
                            borderRadius: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            maxWidth: '90%',
                            maxHeight: '90%'
                        }}
                    >
                        <Group justify="space-between" wrap="nowrap">
                            <Text fw={600} size="sm" truncate>{selectedImage.name || 'Visor de Imagen'}</Text>
                            <ActionIcon variant="subtle" color="gray" onClick={() => setSelectedImage(null)}>
                                <IconClearAll size={16} />
                            </ActionIcon>
                        </Group>
                        <Box style={{ flex: 1, overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
                            <img 
                                src={selectedImage.url} 
                                alt={selectedImage.name} 
                                style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} 
                            />
                        </Box>
                        <Button 
                            leftSection={<IconDownload size={16} />} 
                            onClick={() => handleDownload(selectedImage.messageId)}
                            fullWidth
                            color="blue"
                        >
                            Descargar Imagen Original
                        </Button>
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default ChatWindow;
