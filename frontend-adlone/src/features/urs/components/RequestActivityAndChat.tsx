import React, { useState, useRef, useEffect } from 'react';
import { ursService } from '../../../services/urs.service';
import { useAuth } from '../../../contexts/AuthContext';
import FileIcon from './FileIcon';
import './UniversalInbox.css'; // Reusing established styles

interface RequestActivityAndChatProps {
    request: any;
    onReload: () => void;
}

const RequestActivityAndChat: React.FC<RequestActivityAndChatProps> = ({ request, onReload }) => {
    const [comment, setComment] = useState('');
    const [sending, setSending] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { token } = useAuth();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setFiles(prev => [...prev, ...newFiles]);
            // Reset value so if the user deletes and re-adds the same file, it triggers
            e.target.value = ''; 
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const getUserColor = (id: number) => {
        const colors = [
            '#2563eb', '#059669', '#d97706', '#7c3aed', 
            '#db2777', '#4b5563', '#ea580c', '#0891b2'
        ];
        return colors[id % colors.length];
    };

    return (
        <div className="col-activity">
            <div className="activity-history">
                <h3 style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Historial de Derivaciones
                </h3>
                <div className="timeline-v2">
                    {request.historial_derivaciones && request.historial_derivaciones.length > 0 ? (
                        request.historial_derivaciones.map((h: any, i: number) => (
                            <div key={i} className="timeline-item animate-slide-in" style={{ animationDelay: `${i * 0.1}s` }}>
                                <div className="timeline-marker"></div>
                                <div className="timeline-content">
                                    <div className="timeline-title" style={{ fontSize: '0.85rem' }}>{h.area_origen} ➔ {h.area_destino}</div>
                                    <div className="timeline-meta">
                                        <span>Por {h.usuario_origen}</span>
                                        <span>{new Date(h.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    {h.motivo && <div className="timeline-comment">"{h.motivo}"</div>}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0' }}>
                            Sin derivaciones registradas.
                        </div>
                    )}
                </div>
            </div>

            <div className="activity-chat">
                <div className="chat-header">
                    <h3>CHAT</h3>
                </div>

                <div className="chat-messages">
                    {request.conversacion && request.conversacion.length > 0 ? (
                        request.conversacion.map((msg: any, i: number) => {
                            const userColor = getUserColor(msg.id_usuario);
                            return (
                                <div key={i} className={`message-item ${msg.es_mio ? 'own' : ''} ${msg.es_privado ? 'internal' : ''}`}>
                                    <div className="message-meta">
                                        <span className="msg-user" style={{ color: msg.es_mio ? '#1e40af' : userColor, fontWeight: 700 }}>
                                            {msg.nombre_usuario}
                                            {msg.nombre_rol && <span style={{ opacity: 0.6, fontSize: '0.7rem', marginLeft: '4px', fontWeight: 400 }}>• {msg.nombre_rol}</span>}
                                        </span>
                                        <span className="msg-date">{new Date(msg.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <div className="message-text">{msg.mensaje}</div>
                                    
                                    {msg.adjuntos && msg.adjuntos.length > 0 && (
                                        <div className="chat-msg-attachments">
                                            {msg.adjuntos.map((file: any) => (
                                                <a 
                                                    key={file.id_adjunto}
                                                    href={`${import.meta.env.VITE_API_URL}/api/urs/download/${file.id_adjunto}?token=${token}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="chat-attachment-link"
                                                >
                                                    <span className="file-icon">
                                                        <FileIcon mimetype={file.tipo_archivo} filename={file.nombre_archivo} size={20} />
                                                    </span>
                                                    <span className="file-name">{file.nombre_archivo}</span>
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    ) : (
                        <div style={{ textAlign: 'center', marginTop: '2rem', color: '#cbd5e1' }}>Sin mensajes aún.</div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <form className="chat-input-area" onSubmit={handleSendMessage}>
                    {files.length > 0 && (
                        <div className="chat-pending-files">
                            {files.map((f: File, i: number) => (
                                <div key={i} className="pending-file-tag">
                                    <FileIcon filename={f.name} mimetype={f.type} size={14} />
                                    <span>{f.name}</span>
                                    <button type="button" onClick={() => removeFile(i)}>✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                            multiple
                        />
                        <button
                            type="button"
                            className="chat-attach-btn"
                            onClick={() => fileInputRef.current?.click()}
                            title="Adjuntar archivos"
                        >
                            📎
                        </button>
                        <textarea
                            placeholder="Escribe un mensaje..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            onKeyDown={handleKeyDown}
                            style={{
                                flex: 1,
                                border: '1px solid #e2e8f0',
                                borderTop: '2px solid #3b82f6',
                                borderRadius: '8px',
                                padding: '0.6rem',
                                fontSize: '0.9rem',
                                resize: 'none',
                                height: '42px',
                                outline: 'none'
                            }}
                        ></textarea>
                        <button
                            type="submit"
                            disabled={sending || (!comment.trim() && files.length === 0)}
                            style={{
                                background: (sending || (!comment.trim() && files.length === 0)) ? '#cbd5e1' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                width: '42px',
                                height: '42px',
                                cursor: (sending || (!comment.trim() && files.length === 0)) ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                            }}
                        >
                            {sending ? '...' : <span style={{ fontSize: '1.2rem' }}>➤</span>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RequestActivityAndChat;
