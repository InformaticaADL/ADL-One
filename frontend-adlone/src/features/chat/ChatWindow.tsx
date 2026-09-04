import { useEffect, useRef, useState } from 'react';
import { Button, Input, Spin, Dropdown, Tooltip } from 'antd';
import {
    IconArrowLeft, IconDotsVertical, IconPaperclip, IconSend, IconTrash,
    IconUsers, IconUser, IconEraser, IconFile, IconBan,
} from '@tabler/icons-react';
import type { ChatConversation, ChatMessage } from '../../services/general-chat.service';
import API_CONFIG from '../../config/api.config';
import { useConfirm } from './FluentConfirm';
import ChatAvatar from './ChatAvatar';

const { TextArea } = Input;

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

const C = {
    border: '#f0f0f0', text: 'rgba(0,0,0,0.88)', textSec: 'rgba(0,0,0,0.65)', textTer: 'rgba(0,0,0,0.45)',
    primary: '#1677ff', primaryBg: '#e6f4ff', bg: '#ffffff', bgLayout: '#f5f5f5',
};

const CSS = `
.adl-cw-win { flex:1; display:flex; flex-direction:column; min-width:0; overflow:hidden; background:${C.bg}; }
.adl-cw-head { display:flex; align-items:center; column-gap:12px; padding:10px 16px; border-bottom:1px solid ${C.border}; }
.adl-cw-who { flex:1; min-width:0; cursor:pointer; }
.adl-cw-whoname { font-weight:700; font-size:15px; line-height:1.2; color:${C.text}; }
.adl-cw-whost { font-size:12px; color:${C.textTer}; margin-top:2px; }
.adl-cw-msgs { flex:1; min-height:0; overflow-y:auto; padding:16px 24px; display:flex; flex-direction:column; row-gap:4px; background:${C.bgLayout}; }
.adl-cw-daysep { align-self:center; margin:8px 0; font-size:11px; font-weight:600; color:${C.textTer}; background:${C.bg}; border:1px solid ${C.border}; padding:3px 12px; border-radius:999px; text-transform:uppercase; }
.adl-cw-sys { align-self:center; font-size:12px; color:${C.textSec}; background:${C.primaryBg}; padding:4px 12px; border-radius:999px; margin:3px 0; }
.adl-cw-msg { display:flex; flex-direction:column; max-width:min(72%, 560px); }
.adl-cw-msg.mine { align-self:flex-end; align-items:flex-end; }
.adl-cw-msg.theirs { align-self:flex-start; align-items:flex-start; }
.adl-cw-sender { font-size:12px; font-weight:600; margin:0 4px 2px; color:${C.primary}; }
.adl-cw-bubble { padding:8px 12px; border-radius:12px; font-size:14px; line-height:1.45; word-break:break-word; white-space:pre-wrap; }
.adl-cw-bubble.theirs { background:${C.bg}; border:1px solid ${C.border}; border-top-left-radius:4px; color:${C.text}; }
.adl-cw-bubble.mine { background:${C.primary}; color:#fff; border-top-right-radius:4px; }
.adl-cw-deleted { font-style:italic; opacity:.7; display:inline-flex; align-items:center; column-gap:4px; }
.adl-cw-file { display:inline-flex; align-items:center; column-gap:8px; color:inherit; text-decoration:none; font-weight:600; }
.adl-cw-meta { display:flex; align-items:center; column-gap:6px; margin:3px 4px 0; font-size:11px; color:${C.textTer}; }
.adl-cw-reply { border-left:3px solid ${C.primary}; padding:2px 8px; margin-bottom:5px; background:${C.primaryBg}; border-radius:4px; font-size:12px; }
.adl-cw-replyname { display:block; color:${C.primary}; font-size:11px; font-weight:600; }
.adl-cw-typing { align-self:flex-start; font-size:12px; color:${C.textTer}; padding:4px 6px; font-style:italic; }
.adl-cw-inputbar { display:flex; align-items:flex-end; column-gap:8px; padding:10px 16px; border-top:1px solid ${C.border}; }
.adl-cw-center { flex:1; display:flex; align-items:center; justify-content:center; }
`;

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

    const headerMenu = [
        isGroup
            ? { key: 'edit', icon: <IconUsers size={16} />, label: 'Editar grupo', onClick: () => onEditGroup(conversation.id_conversacion) }
            : { key: 'profile', icon: <IconUser size={16} />, label: 'Ver perfil', onClick: () => conversation.contacto_id && onViewProfile(conversation.contacto_id) },
        {
            key: 'clear', icon: <IconEraser size={16} />, danger: true, label: 'Limpiar chat',
            onClick: () => ask({ title: 'Limpiar chat', danger: true, confirmLabel: 'Limpiar', message: 'Se eliminarán todos los mensajes de esta conversación para ti.', onConfirm: onClearChat }),
        },
    ];

    return (
        <div className="adl-cw-win">
            <style>{CSS}</style>
            <div className="adl-cw-head">
                {isMobile && <Button type="text" icon={<IconArrowLeft size={20} />} onClick={onBack} aria-label="Volver" />}
                <ChatAvatar name={conversation.nombre_display} foto={conversation.foto_display} size={40} group={isGroup} onClick={openHeader} />
                <div className="adl-cw-who" onClick={openHeader}>
                    <div className="adl-cw-whoname">{conversation.nombre_display || 'Chat'}</div>
                    <div className="adl-cw-whost">{isGroup ? `${conversation.total_miembros} miembros` : 'Conversación directa'}</div>
                </div>
                <Dropdown trigger={['click']} placement="bottomRight" menu={{ items: headerMenu }}>
                    <Button type="text" icon={<IconDotsVertical size={20} />} aria-label="Opciones" />
                </Dropdown>
            </div>

            <div className="adl-cw-msgs" ref={scrollRef}>
                {loading && messages.length === 0 ? (
                    <div className="adl-cw-center"><Spin tip="Cargando mensajes…"><div style={{ padding: 30 }} /></Spin></div>
                ) : (
                    <>
                        {hasMoreMessages && (
                            <Button type="text" size="small" style={{ alignSelf: 'center', margin: '4px 0' }} onClick={onLoadMore}>
                                Cargar mensajes anteriores
                            </Button>
                        )}
                        {messages.map((m) => {
                            const mine = Number(m.id_emisor) === Number(currentUserId);
                            const thisDay = dayLabel(m.fecha);
                            const showDay = thisDay !== lastDay; lastDay = thisDay;

                            if (m.tipo_mensaje === 'SISTEMA') {
                                return (
                                    <div key={m.id_mensaje} style={{ display: 'contents' }}>
                                        {showDay && <div className="adl-cw-daysep">{thisDay}</div>}
                                        <div className="adl-cw-sys">{m.mensaje}</div>
                                    </div>
                                );
                            }
                            return (
                                <div key={m.id_mensaje} style={{ display: 'contents' }}>
                                    {showDay && <div className="adl-cw-daysep">{thisDay}</div>}
                                    <div className={`adl-cw-msg ${mine ? 'mine' : 'theirs'}`}>
                                        {isGroup && !mine && <span className="adl-cw-sender">{m.nombre_emisor}</span>}
                                        {m.id_mensaje_padre && !m.padre_eliminado && (
                                            <div className="adl-cw-reply">
                                                <span className="adl-cw-replyname">{m.nombre_emisor_padre || 'Respuesta'}</span>
                                                {m.tipo_mensaje_padre === 'ARCHIVO' ? `📎 ${m.archivo_nombre_padre || 'Archivo'}` : (m.mensaje_padre || '')}
                                            </div>
                                        )}
                                        <div className={`adl-cw-bubble ${mine ? 'mine' : 'theirs'}`}>
                                            {m.eliminado ? (
                                                <span className="adl-cw-deleted"><IconBan size={16} /> Mensaje eliminado</span>
                                            ) : m.tipo_mensaje === 'ARCHIVO' && m.archivo_ruta ? (
                                                <a className="adl-cw-file" href={`${baseUrl}${m.archivo_ruta}`} target="_blank" rel="noreferrer" download={m.archivo_nombre || undefined}>
                                                    <IconFile size={20} />
                                                    <span>{m.archivo_nombre || 'Archivo'}{m.mensaje ? <><br />{m.mensaje}</> : null}</span>
                                                </a>
                                            ) : m.mensaje}
                                        </div>
                                        <div className="adl-cw-meta">
                                            <span>{timeLabel(m.fecha)}</span>
                                            {m.editado && !m.eliminado && <span>· editado</span>}
                                            {mine && !m.eliminado && (
                                                <Tooltip title="Eliminar mensaje">
                                                    <Button type="text" size="small" icon={<IconTrash size={15} />} aria-label="Eliminar mensaje"
                                                        onClick={() => ask({ title: 'Eliminar mensaje', danger: true, confirmLabel: 'Eliminar', message: '¿Eliminar este mensaje para todos?', onConfirm: () => onDeleteMessage(m.id_mensaje) })} />
                                                </Tooltip>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {typingText && <div className="adl-cw-typing">{typingText}</div>}
                    </>
                )}
            </div>

            <div className="adl-cw-inputbar">
                <input ref={fileRef} type="file" hidden onChange={handleFile} />
                <Tooltip title="Adjuntar archivo">
                    <Button type="text" icon={<IconPaperclip size={20} />} aria-label="Adjuntar archivo" onClick={() => fileRef.current?.click()} />
                </Tooltip>
                <TextArea style={{ flex: 1 }} value={text} autoSize={{ minRows: 1, maxRows: 5 }}
                    placeholder="Escribe un mensaje…"
                    onChange={(e) => handleType(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    onBlur={onTypingStop} />
                <Button type="primary" icon={<IconSend size={18} />} aria-label="Enviar" onClick={send} disabled={!text.trim()} />
            </div>
            {dialog}
        </div>
    );
};

export default ChatWindow;
