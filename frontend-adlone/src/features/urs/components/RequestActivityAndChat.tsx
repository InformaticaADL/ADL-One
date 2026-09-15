import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { IconMessage, IconSend, IconPaperclip, IconX } from '@tabler/icons-react';
import { ursService } from '../../../services/urs.service';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
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
        <div className="flex h-full flex-col overflow-hidden bg-background">
            <div className="flex shrink-0 items-center gap-2 border-b border-border p-3">
                <span className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-primary/10 text-primary">
                    <IconMessage size={15} />
                </span>
                <h4 className="m-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">Chat de comunicación</h4>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3" ref={viewport}>
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
                                    <div className="my-1 flex items-center gap-2">
                                        <div className="h-px flex-1 bg-border" />
                                        <span className="text-[11px] font-semibold capitalize text-muted-foreground">{getDateLabel(msg.fecha)}</span>
                                        <div className="h-px flex-1 bg-border" />
                                    </div>
                                )}
                                <div className={cn('flex max-w-[85%] flex-col', isOwn ? 'self-end items-end' : 'self-start items-start')}>
                                    <div className="mb-0.5 flex items-center gap-1.5">
                                        <span className="text-[11px] font-bold" style={{ color: isOwn ? 'var(--sc-primary)' : userColor }}>{msg.nombre_usuario}</span>
                                        <span className="text-[11px] text-muted-foreground">{new Date(msg.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className={cn(
                                        'whitespace-pre-wrap break-words rounded-xl border border-border px-3 py-2 text-sm leading-relaxed',
                                        isOwn ? 'rounded-br-sm bg-primary/10' : 'rounded-bl-sm bg-muted'
                                    )}>
                                        {msg.mensaje}
                                        {msg.adjuntos && msg.adjuntos.length > 0 && msg.adjuntos.map((file: any) => (
                                            <a key={file.id_adjunto}
                                                className="mt-1.5 flex max-w-[220px] items-center gap-1.5 rounded-md border border-border bg-background px-1.5 py-1 text-primary no-underline hover:bg-muted"
                                                target="_blank" rel="noreferrer"
                                                href={`${import.meta.env.VITE_API_URL}/api/urs/download/${file.id_adjunto}?token=${token}`}>
                                                <FileIcon mimetype={file.tipo_archivo} filename={file.nombre_archivo} size={18} />
                                                <span className="truncate text-[11px] font-semibold">{file.nombre_archivo}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })
                ) : (
                    <div className="py-10 text-center text-xs italic text-muted-foreground">Sin mensajes aún.</div>
                )}
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-border p-3">
                {files.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                        {files.map((f, i) => (
                            <Badge key={i} variant="secondary" className="gap-1">
                                {f.name}
                                <button type="button" onClick={() => removeFile(i)} aria-label="Quitar archivo">
                                    <IconX size={12} />
                                </button>
                            </Badge>
                        ))}
                    </div>
                )}
                <div className="flex items-end gap-2">
                    <input ref={fileInputRef} type="file" multiple hidden
                        accept="image/*,application/pdf,.xlsx,.xls,.doc,.docx,.txt,.csv"
                        onChange={(e) => { const list = Array.from(e.target.files || []); setFiles(prev => [...prev, ...list]); e.target.value = ''; }} />
                    <Button variant="ghost" size="icon" title="Adjuntar archivo" onClick={() => fileInputRef.current?.click()}>
                        <IconPaperclip size={18} />
                    </Button>
                    <Textarea placeholder="Escribe un mensaje..." rows={1} className="flex-1 resize-none"
                        value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={handleKeyDown} />
                    <Button size="icon" disabled={sending || (!comment.trim() && files.length === 0)} onClick={handleSendMessage}>
                        {sending ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        ) : (
                            <IconSend size={18} />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};

const BUBBLE_COLORS = ['#1677ff', '#389e0d', '#d46b08', '#722ed1', '#c41d7f', '#2f54eb', '#08979c', '#7cb305', '#531dab'];

export default RequestActivityAndChat;
