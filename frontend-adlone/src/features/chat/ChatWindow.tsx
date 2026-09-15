import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
    IconArrowLeft, IconDotsVertical, IconPaperclip, IconSend, IconTrash,
    IconUsers, IconUser, IconEraser, IconFile, IconBan,
} from '@tabler/icons-react';
import type { ChatConversation, ChatMessage } from '../../services/general-chat.service';
import API_CONFIG from '../../config/api.config';
import { useConfirm } from './FluentConfirm';
import ChatAvatar from './ChatAvatar';

interface ChatWindowProps {
    conversation: ChatConversation;
    messages: ChatMessage[];
    loading: boolean;
    currentUserId: number;
    onSend: (mensaje?: string, archivo?: File, replyToId?: number) => void;
    onClearChat: () => void;
    onDeleteMessage: (messageId: number) => void;
    onViewProfile: (userId: number) => void;
    onEditGroup: (conversationId: number) => void;
    isMobile?: boolean;
    onBack: () => void;
    onTypingStart: () => void;
    onTypingStop: () => void;
    typingUsers: Array<{ userId?: number; name?: string }>;
    onAddReaction: (messageId: number, emoji: string) => void;
    onLoadMore: () => void;
    hasMoreMessages: boolean;
    otherUserReadAt: string | null;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
    conversation, messages, loading, currentUserId, onSend, onClearChat, onDeleteMessage,
    onViewProfile, onEditGroup, isMobile, onBack, onTypingStart, onTypingStop, typingUsers,
    onLoadMore, hasMoreMessages,
}) => {
    const [text, setText] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const { ask, dialog } = useConfirm();

    const baseUrl = API_CONFIG.getBaseURL();
    const isGroup = conversation.tipo === 'GRUPO';

    useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length, conversation.id_conversacion]);

    const send = () => { const t = text.trim(); if (!t) return; onSend(t); setText(''); onTypingStop(); };
    const handleType = (v: string) => { setText(v); onTypingStart(); clearTimeout(typingTimer.current); typingTimer.current = setTimeout(onTypingStop, 1500); };
    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) onSend(undefined, f); e.target.value = ''; };
    const openHeader = () => { if (isGroup) onEditGroup(conversation.id_conversacion); else if (conversation.contacto_id) onViewProfile(conversation.contacto_id); };

    const dayLabel = (date: string) => {
        const d = new Date(date), now = new Date();
        if (d.toDateString() === now.toDateString()) return 'Hoy';
        const y = new Date(now); y.setDate(now.getDate() - 1);
        if (d.toDateString() === y.toDateString()) return 'Ayer';
        return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' });
    };
    const timeLabel = (date: string) => new Date(date).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

    let lastDay = '';
    const typingText = typingUsers.length > 0
        ? (isGroup ? `${typingUsers.map((t) => t.name).filter(Boolean).join(', ')} escribiendo…` : 'escribiendo…') : '';

    return (
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
            <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
                {isMobile && (
                    <Button variant="ghost" size="icon" aria-label="Volver" onClick={onBack}>
                        <IconArrowLeft size={20} />
                    </Button>
                )}
                <ChatAvatar name={conversation.nombre_display} foto={conversation.foto_display} size={40} group={isGroup} onClick={openHeader} />
                <div className="min-w-0 flex-1 cursor-pointer" onClick={openHeader}>
                    <div className="truncate text-[15px] font-bold leading-tight text-foreground">{conversation.nombre_display || 'Chat'}</div>
                    <div className="text-xs text-muted-foreground">{isGroup ? `${conversation.total_miembros} miembros` : 'Conversación directa'}</div>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Opciones">
                            <IconDotsVertical size={20} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {isGroup ? (
                            <DropdownMenuItem onSelect={() => onEditGroup(conversation.id_conversacion)}>
                                <IconUsers size={15} /> Editar grupo
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem onSelect={() => conversation.contacto_id && onViewProfile(conversation.contacto_id)}>
                                <IconUser size={15} /> Ver perfil
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                            danger
                            onSelect={() => ask({ title: 'Limpiar chat', danger: true, confirmLabel: 'Limpiar', message: 'Se eliminarán todos los mensajes de esta conversación para ti.', onConfirm: onClearChat })}
                        >
                            <IconEraser size={15} /> Limpiar chat
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto bg-muted/40 px-6 py-4" ref={scrollRef}>
                {loading && messages.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                ) : (
                    <>
                        {hasMoreMessages && (
                            <Button variant="ghost" size="sm" className="mx-auto my-1" onClick={onLoadMore}>
                                Cargar mensajes anteriores
                            </Button>
                        )}
                        {messages.map((m) => {
                            const mine = Number(m.id_emisor) === Number(currentUserId);
                            const thisDay = dayLabel(m.fecha);
                            const showDay = thisDay !== lastDay; lastDay = thisDay;

                            if (m.tipo_mensaje === 'SISTEMA') {
                                return (
                                    <div key={m.id_mensaje} className="contents">
                                        {showDay && (
                                            <div className="my-2 self-center rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase text-muted-foreground">
                                                {thisDay}
                                            </div>
                                        )}
                                        <div className="my-0.5 self-center rounded-full bg-accent px-3 py-1 text-xs text-accent-foreground">{m.mensaje}</div>
                                    </div>
                                );
                            }
                            return (
                                <div key={m.id_mensaje} className="contents">
                                    {showDay && (
                                        <div className="my-2 self-center rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold uppercase text-muted-foreground">
                                            {thisDay}
                                        </div>
                                    )}
                                    <div className={`flex max-w-[72%] flex-col ${mine ? 'self-end items-end' : 'self-start items-start'}`}>
                                        {isGroup && !mine && <span className="mb-0.5 ml-1 text-xs font-semibold text-primary">{m.nombre_emisor}</span>}
                                        {m.id_mensaje_padre && !m.padre_eliminado && (
                                            <div className="mb-1 rounded border-l-2 border-primary bg-accent px-2 py-0.5 text-xs">
                                                <span className="block text-[11px] font-semibold text-primary">{m.nombre_emisor_padre || 'Respuesta'}</span>
                                                {m.tipo_mensaje_padre === 'ARCHIVO' ? `📎 ${m.archivo_nombre_padre || 'Archivo'}` : (m.mensaje_padre || '')}
                                            </div>
                                        )}
                                        <div
                                            className={`whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm leading-relaxed ${
                                                mine
                                                    ? 'rounded-tr-sm bg-primary text-primary-foreground'
                                                    : 'rounded-tl-sm border border-border bg-card text-foreground'
                                            }`}
                                        >
                                            {m.eliminado ? (
                                                <span className="inline-flex items-center gap-1 italic opacity-70"><IconBan size={16} /> Mensaje eliminado</span>
                                            ) : m.tipo_mensaje === 'ARCHIVO' && m.archivo_ruta ? (
                                                <a className="inline-flex items-center gap-2 font-semibold text-inherit no-underline" href={`${baseUrl}${m.archivo_ruta}`} target="_blank" rel="noreferrer" download={m.archivo_nombre || undefined}>
                                                    <IconFile size={20} />
                                                    <span>{m.archivo_nombre || 'Archivo'}{m.mensaje ? <><br />{m.mensaje}</> : null}</span>
                                                </a>
                                            ) : m.mensaje}
                                        </div>
                                        <div className="mt-0.5 ml-1 mr-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                            <span>{timeLabel(m.fecha)}</span>
                                            {m.editado && !m.eliminado && <span>· editado</span>}
                                            {mine && !m.eliminado && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5"
                                                    title="Eliminar mensaje"
                                                    aria-label="Eliminar mensaje"
                                                    onClick={() => ask({ title: 'Eliminar mensaje', danger: true, confirmLabel: 'Eliminar', message: '¿Eliminar este mensaje para todos?', onConfirm: () => onDeleteMessage(m.id_mensaje) })}
                                                >
                                                    <IconTrash size={13} />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {typingText && <div className="self-start px-1.5 py-1 text-xs italic text-muted-foreground">{typingText}</div>}
                    </>
                )}
            </div>

            <div className="flex items-end gap-2 border-t border-border px-4 py-2.5">
                <input ref={fileRef} type="file" hidden onChange={handleFile} />
                <Button variant="ghost" size="icon" title="Adjuntar archivo" aria-label="Adjuntar archivo" onClick={() => fileRef.current?.click()}>
                    <IconPaperclip size={20} />
                </Button>
                <Textarea
                    className="max-h-32 min-h-9 flex-1 resize-none py-2"
                    rows={1}
                    value={text}
                    placeholder="Escribe un mensaje..."
                    onChange={(e) => handleType(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    onBlur={onTypingStop}
                />
                <Button size="icon" aria-label="Enviar" onClick={send} disabled={!text.trim()}>
                    <IconSend size={18} />
                </Button>
            </div>
            {dialog}
        </div>
    );
};

export default ChatWindow;
