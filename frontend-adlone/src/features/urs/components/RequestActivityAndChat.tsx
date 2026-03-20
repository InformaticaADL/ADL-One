import React, { useState, useRef, useEffect } from 'react';
import {
    Stack,
    Group,
    Paper,
    Text,
    Title,
    ScrollArea,
    ActionIcon,
    Textarea,
    Timeline,
    ThemeIcon,
    Box,
    Badge,
    Tooltip,
    FileButton,
    Center
} from '@mantine/core';
import {
    IconArrowRight,
    IconHistory,
    IconMessage,
    IconSend,
    IconPaperclip,
    IconX,
    IconUser
} from '@tabler/icons-react';
import { ursService } from '../../../services/urs.service';
import { useAuth } from '../../../contexts/AuthContext';
import FileIcon from './FileIcon';

interface RequestActivityAndChatProps {
    request: any;
    onReload: () => void;
}

const RequestActivityAndChat: React.FC<RequestActivityAndChatProps> = ({ request, onReload }) => {
    const [comment, setComment] = useState('');
    const [sending, setSending] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const viewport = useRef<HTMLDivElement>(null);
    const { token } = useAuth();

    const scrollToBottom = () => {
        viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [request.conversacion]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!comment.trim() && files.length === 0) return;

        setSending(true);
        try {
            await ursService.addComment(request.id_solicitud, comment, false, files);
            setComment('');
            setFiles([]);
            onReload();
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const getUserColor = (id: number) => {
        const colors = [
            'blue', 'teal', 'orange', 'violet', 
            'pink', 'gray', 'red', 'cyan'
        ];
        return colors[id % colors.length];
    };

    return (
        <Stack h="100%" gap={0}>
            {/* History Section */}
            <Paper p="md" bg="gray.0" radius={0} style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                <Group gap="xs" mb="md">
                    <ThemeIcon variant="light" color="gray" size="sm" radius="md">
                        <IconHistory size={14} />
                    </ThemeIcon>
                    <Title order={6} c="dimmed" tt="uppercase" lts="0.5px">Historial de Derivaciones</Title>
                </Group>

                <ScrollArea.Autosize mah={200} type="hover">
                    {request.historial_derivaciones && request.historial_derivaciones.length > 0 ? (
                        <Timeline active={request.historial_derivaciones.length - 1} bulletSize={20} lineWidth={2}>
                            {request.historial_derivaciones.map((h: any, i: number) => (
                                <Timeline.Item 
                                    key={i} 
                                    bullet={<IconArrowRight size={12} />}
                                    title={
                                        <Text size="xs" fw={700}>
                                            {h.area_origen} <IconArrowRight size={10} style={{ verticalAlign: 'middle' }} /> {h.area_destino}
                                        </Text>
                                    }
                                >
                                    <Text size="xs" c="dimmed">Por {h.usuario_origen} • {new Date(h.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                    {h.motivo && (
                                        <Text size="xs" mt={4} style={{ fontStyle: 'italic' }}>"{h.motivo}"</Text>
                                    )}
                                </Timeline.Item>
                            ))}
                        </Timeline>
                    ) : (
                        <Paper p="sm" withBorder radius="md" style={{ borderStyle: 'dashed' }}>
                            <Text size="xs" c="dimmed" ta="center">Sin derivaciones registradas.</Text>
                        </Paper>
                    )}
                </ScrollArea.Autosize>
            </Paper>

            {/* Chat Section */}
            <Stack gap={0} flex={1} style={{ overflow: 'hidden' }}>
                <Group p="sm" bg="white" style={{ borderBottom: '1px solid var(--mantine-color-gray-1)' }}>
                    <ThemeIcon variant="light" color="adl-blue" size="sm" radius="md">
                        <IconMessage size={14} />
                    </ThemeIcon>
                    <Title order={6} lts="1px">CHAT</Title>
                </Group>

                <ScrollArea flex={1} p="md" viewportRef={viewport}>
                    <Stack gap="lg">
                        {request.conversacion && request.conversacion.length > 0 ? (
                            request.conversacion.map((msg: any, i: number) => {
                                const isOwn = msg.es_mio;
                                const userColor = getUserColor(msg.id_usuario);
                                return (
                                    <Box key={i} style={{ alignSelf: isOwn ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                                        <Group gap={6} mb={4} justify={isOwn ? 'flex-end' : 'flex-start'}>
                                            {!isOwn && <IconUser size={12} color={`var(--mantine-color-${userColor}-6)`} />}
                                            <Text size="xs" fw={800} c={isOwn ? 'adl-blue.7' : `${userColor}.7`}>
                                                {msg.nombre_usuario}
                                            </Text>
                                            <Text size="xs" c="dimmed">
                                                {new Date(msg.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </Group>
                                        
                                        <Paper 
                                            p="sm" 
                                            radius="lg" 
                                            shadow="xs"
                                            withBorder
                                            bg={isOwn ? 'var(--mantine-color-blue-0)' : `var(--mantine-color-${userColor}-0)`}
                                            style={{ 
                                                borderBottomRightRadius: isOwn ? 4 : 'var(--mantine-radius-lg)',
                                                borderBottomLeftRadius: !isOwn ? 4 : 'var(--mantine-radius-lg)',
                                                borderColor: isOwn ? 'var(--mantine-color-blue-2)' : `var(--mantine-color-${userColor}-2)`
                                            }}
                                        >
                                            <Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>{msg.mensaje}</Text>
                                            
                                            {msg.adjuntos && msg.adjuntos.length > 0 && (
                                                <Group gap={6} mt="xs">
                                                    {msg.adjuntos.map((file: any) => (
                                                        <Tooltip key={file.id_adjunto} label={`Descargar ${file.nombre_archivo}`}>
                                                            <ActionIcon 
                                                                component="a"
                                                                href={`${import.meta.env.VITE_API_URL}/api/urs/download/${file.id_adjunto}?token=${token}`}
                                                                variant="light" 
                                                                color="gray" 
                                                                size="sm"
                                                                target="_blank"
                                                            >
                                                                <FileIcon mimetype={file.tipo_archivo} size={16} />
                                                            </ActionIcon>
                                                        </Tooltip>
                                                    ))}
                                                </Group>
                                            )}
                                        </Paper>
                                        

                                    </Box>
                                );
                            })
                        ) : (
                            <Center py={40}>
                                <Text size="xs" c="dimmed italic">Sin mensajes aún.</Text>
                            </Center>
                        )}
                    </Stack>
                </ScrollArea>

                {/* Input Area */}
                <Box p="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)', backgroundColor: 'white' }}>
                    <Stack gap="xs">
                        {files.length > 0 && (
                            <Group gap={6} wrap="wrap">
                                {files.map((f, i) => (
                                    <Badge 
                                        key={i} 
                                        variant="light" 
                                        color="blue" 
                                        rightSection={
                                            <ActionIcon size="xs" color="blue" variant="transparent" onClick={() => removeFile(i)}>
                                                <IconX size={10} />
                                            </ActionIcon>
                                        }
                                    >
                                        {f.name}
                                    </Badge>
                                ))}
                            </Group>
                        )}
                        
                        <Group align="flex-end" gap="xs">
                            <FileButton onChange={(payload) => setFiles(prev => [...prev, ...payload])} accept="*" multiple>
                                {(props) => (
                                    <ActionIcon {...props} variant="light" color="gray" size="lg" radius="md">
                                        <IconPaperclip size={20} />
                                    </ActionIcon>
                                )}
                            </FileButton>

                            <Textarea 
                                placeholder="Escribe un mensaje..."
                                flex={1}
                                minRows={1}
                                maxRows={4}
                                autosize
                                value={comment}
                                onChange={(e) => setComment(e.currentTarget.value)}
                                onKeyDown={handleKeyDown}
                                radius="md"
                                styles={{ input: { fontSize: 'var(--mantine-font-size-sm)' } }}
                            />

                            <ActionIcon 
                                variant="filled" 
                                color="adl-blue" 
                                size="lg" 
                                radius="md"
                                loading={sending}
                                disabled={!comment.trim() && files.length === 0}
                                onClick={() => handleSendMessage()}
                            >
                                <IconSend size={20} />
                            </ActionIcon>
                        </Group>
                    </Stack>
                </Box>
            </Stack>
        </Stack>
    );
};

export default RequestActivityAndChat;
