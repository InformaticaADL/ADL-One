import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ConfigProvider, Button, Input, Tag, Divider, Tooltip } from 'antd';
import { IconMessage, IconSend, IconPaperclip, IconX } from '@tabler/icons-react';
import { ursService } from '../../../services/urs.service';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import FileIcon from './FileIcon';

const { TextArea } = Input;

interface RequestActivityAndChatProps {
    request: any;
    onReload: () => void;
}

const BUBBLE_COLORS = ['#1677ff', '#389e0d', '#d46b08', '#722ed1', '#c41d7f', '#2f54eb', '#08979c', '#7cb305', '#531dab'];

const C = {
    border: '#f0f0f0', text: 'rgba(0,0,0,0.88)', textSec: 'rgba(0,0,0,0.65)', textTer: 'rgba(0,0,0,0.45)',
    primary: '#1677ff', primaryBg: '#e6f4ff', primaryBorder: '#91caff', bg: '#ffffff', bgLayout: '#fafafa',
};

const CSS = `
.adl-ch-root { display:flex; flex-direction:column; height:100%; background:${C.bg}; overflow:hidden; }
.adl-ch-header { display:flex; align-items:center; column-gap:8px; padding:12px; border-bottom:1px solid ${C.border}; flex-shrink:0; }
.adl-ch-headicon { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:6px; background:${C.primaryBg}; color:${C.primary}; }
.adl-ch-headtitle { margin:0; font-size:12px; font-weight:700; letter-spacing:.8px; text-transform:uppercase; color:${C.textSec}; }
.adl-ch-scroll { flex:1; overflow-y:auto; padding:12px; display:flex; flex-direction:column; row-gap:12px; }
.adl-ch-datelabel { font-size:11px; font-weight:600; color:${C.textTer}; text-transform:capitalize; }
.adl-ch-msg { display:flex; flex-direction:column; max-width:85%; }
.adl-ch-msg.own { align-self:flex-end; align-items:flex-end; }
.adl-ch-msg.other { align-self:flex-start; align-items:flex-start; }
.adl-ch-meta { display:flex; align-items:center; column-gap:6px; margin-bottom:3px; }
.adl-ch-author { font-size:11px; font-weight:700; }
.adl-ch-time { font-size:11px; color:${C.textTer}; }
.adl-ch-bubble { padding:8px 12px; border-radius:12px; font-size:14px; line-height:1.5; white-space:pre-wrap; word-break:break-word; overflow-wrap:break-word; border:1px solid ${C.border}; }
.adl-ch-bubble.own { background:${C.primaryBg}; border-color:${C.primaryBorder}; border-bottom-right-radius:4px; }
.adl-ch-bubble.other { background:${C.bgLayout}; border-bottom-left-radius:4px; }
.adl-ch-attach { display:flex; align-items:center; column-gap:6px; margin-top:6px; padding:4px 6px; border:1px solid ${C.border}; border-radius:6px; background:${C.bg}; text-decoration:none; color:${C.primary}; cursor:pointer; max-width:220px; }
.adl-ch-attach:hover { background:${C.bgLayout}; }
.adl-ch-attachname { font-size:11px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.adl-ch-emptychat { text-align:center; color:${C.textTer}; font-style:italic; font-size:12px; padding:40px 0; }
.adl-ch-input { border-top:1px solid ${C.border}; padding:12px; display:flex; flex-direction:column; row-gap:8px; flex-shrink:0; }
.adl-ch-chips { display:flex; flex-wrap:wrap; gap:6px; }
.adl-ch-inputrow { display:flex; align-items:flex-end; column-gap:8px; }
`;

const RequestActivityAndChat: React.FC<RequestActivityAndChatProps> = ({ request, onReload }) => {
    const [comment, setComment] = useState('');
    const [sending, setSending] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const viewport = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { token } = useAuth();
    const { showToast } = useToast();

    const scrollToBottom = () => { viewport.current?.scrollTo({ top: viewport.current.scrollHeight, behavior: 'smooth' }); };
    useEffect(() => { scrollToBottom(); }, [request.conversacion]);

    const handleSendMessage = async () => {
        if (!comment.trim() && files.length === 0) return;
        setSending(true);
        try {
            await ursService.addComment(request.id_solicitud, comment, false, files);
            setComment('');
            setFiles([]);
            onReload();
        } catch {
            showToast({ type: 'error', message: 'Error al enviar el mensaje' });
        } finally { setSending(false); }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
    };

    const removeFile = (index: number) => setFiles(prev => prev.filter((_, i) => i !== index));

    const getUserColor = (userId: any) => {
        const idStr = String(userId || '0');
        let hash = 0;
        for (let i = 0; i < idStr.length; i++) hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
        return BUBBLE_COLORS[Math.abs(hash) % BUBBLE_COLORS.length];
    };

    const getDateLabel = (dateStr: string): string => {
        const d = new Date(dateStr);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === today.toDateString()) return 'Hoy';
        if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
        return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    const chatMessages = useMemo(() => (request.conversacion || []).filter((m: any) => !m.es_sistema), [request.conversacion]);

    return (
        <ConfigProvider theme={{ token: { colorPrimary: C.primary, borderRadius: 8 } }}>
            <style>{CSS}</style>
            <div className="adl-ch-root">
                <div className="adl-ch-header">
                    <span className="adl-ch-headicon"><IconMessage size={15} /></span>
                    <h4 className="adl-ch-headtitle">Chat de comunicación</h4>
                </div>

                <div className="adl-ch-scroll" ref={viewport}>
                    {chatMessages.length > 0 ? (
                        chatMessages.map((msg: any, i: number) => {
                            const isOwn = msg.es_mio;
                            const userColor = getUserColor(msg.id_usuario);
                            const msgDate = new Date(msg.fecha).toDateString();
                            const prevDate = i > 0 ? new Date(chatMessages[i - 1].fecha).toDateString() : null;
                            const showDateSep = msgDate !== prevDate;
                            return (
                                <React.Fragment key={i}>
                                    {showDateSep && (
                                        <Divider style={{ margin: '4px 0' }}><span className="adl-ch-datelabel">{getDateLabel(msg.fecha)}</span></Divider>
                                    )}
                                    <div className={`adl-ch-msg ${isOwn ? 'own' : 'other'}`}>
                                        <div className="adl-ch-meta">
                                            <span className="adl-ch-author" style={{ color: isOwn ? C.primary : userColor }}>{msg.nombre_usuario}</span>
                                            <span className="adl-ch-time">{new Date(msg.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className={`adl-ch-bubble ${isOwn ? 'own' : 'other'}`}>
                                            {msg.mensaje}
                                            {msg.adjuntos && msg.adjuntos.length > 0 && msg.adjuntos.map((file: any) => (
                                                <a key={file.id_adjunto} className="adl-ch-attach" target="_blank" rel="noreferrer"
                                                    href={`${import.meta.env.VITE_API_URL}/api/urs/download/${file.id_adjunto}?token=${token}`}>
                                                    <FileIcon mimetype={file.tipo_archivo} filename={file.nombre_archivo} size={18} />
                                                    <span className="adl-ch-attachname">{file.nombre_archivo}</span>
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })
                    ) : (
                        <div className="adl-ch-emptychat">Sin mensajes aún.</div>
                    )}
                </div>

                <div className="adl-ch-input">
                    {files.length > 0 && (
                        <div className="adl-ch-chips">
                            {files.map((f, i) => (
                                <Tag key={i} color="blue" closable onClose={() => removeFile(i)} closeIcon={<IconX size={12} />}>{f.name}</Tag>
                            ))}
                        </div>
                    )}
                    <div className="adl-ch-inputrow">
                        <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }}
                            accept="image/*,application/pdf,.xlsx,.xls,.doc,.docx,.txt,.csv"
                            onChange={(e) => { const list = Array.from(e.target.files || []); setFiles(prev => [...prev, ...list]); e.target.value = ''; }} />
                        <Tooltip title="Adjuntar archivo">
                            <Button type="text" icon={<IconPaperclip size={18} />} onClick={() => fileInputRef.current?.click()} />
                        </Tooltip>
                        <TextArea placeholder="Escribe un mensaje..." autoSize={{ minRows: 1, maxRows: 4 }} style={{ flex: 1 }}
                            value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={handleKeyDown} />
                        <Button type="primary" icon={<IconSend size={18} />} loading={sending}
                            disabled={!comment.trim() && files.length === 0} onClick={handleSendMessage} />
                    </div>
                </div>
            </div>
        </ConfigProvider>
    );
};

export default RequestActivityAndChat;
