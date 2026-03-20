import React, { useState, useEffect, useRef } from 'react';
import { chatService } from '../../services/chat.service';
import type { ChatMessage, ChatContact } from '../../services/chat.service';
import { useAuth } from '../../contexts/AuthContext';
import './ChatModule.css';

const ChatModule: React.FC = () => {
    const { user } = useAuth();
    const [contacts, setContacts] = useState<ChatContact[]>([]);
    const [activeContact, setActiveContact] = useState<ChatContact | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ChatContact[]>([]);
    const [allUsers, setAllUsers] = useState<ChatContact[]>([]);
    const [showSearchDropdown, setShowSearchDropdown] = useState(false);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Cargar chats recientes al inicio
    useEffect(() => {
        loadRecentChats();
        loadAllUsers();
    }, [activeContact]);

    useEffect(() => {
        if (activeContact) {
            loadMessages(activeContact.id_usuario);
        }
    }, [activeContact]);

    const loadRecentChats = async () => {
        try {
            const data = await chatService.getRecentChats();
            setContacts(data);
        } catch (error) {
            console.error("Error loading recent chats:", error);
        }
    };

    const loadAllUsers = async () => {
        try {
            const data = await chatService.searchUsers(''); 
            setAllUsers(data);
        } catch (error) {
            console.error("Error loading all users:", error);
        }
    };

    const loadMessages = async (targetId: number) => {
        try {
            const data = await chatService.getConversation(targetId);
            setMessages(data);
            scrollToBottom();
            await chatService.markAsRead(targetId);
            loadRecentChats(); 
        } catch (error) {
            console.error("Error loading messages:", error);
        }
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.trim() === '') {
            setSearchResults([]);
            return;
        }
        try {
            const data = await chatService.searchUsers(query);
            setSearchResults(data);
        } catch (error) {
            console.error("Error searching users:", error);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeContact) return;

        try {
            const sent = await chatService.sendMessage(activeContact.id_usuario, newMessage);
            setMessages(prev => [...prev, { ...sent, es_mio: true }]);
            setNewMessage('');
            scrollToBottom();
            loadRecentChats();
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    const scrollToBottom = () => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    };

    const startChat = (contact: ChatContact) => {
        setActiveContact(contact);
        setSearchQuery('');
        setSearchResults([]);
        setShowSearchDropdown(false);
    };

    const displayedSearchResults = searchQuery.trim() === '' ? allUsers : searchResults;

    return (
        <div className="chat-container">
            {/* Sidebar: Lista de contactos y búsqueda */}
            <div className="chat-sidebar">
                <div className="chat-sidebar-header">
                    <div style={{ position: 'relative' }}>
                        <input 
                            type="text" 
                            className="chat-search-input" 
                            placeholder="Buscar persona..."
                            value={searchQuery}
                            onFocus={() => setShowSearchDropdown(true)}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                        {showSearchDropdown && displayedSearchResults.length > 0 && (
                            <div className="chat-searching-results">
                                <div style={{ padding: '0.5rem 1rem', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, borderBottom: '1px solid #f1f5f9' }}>
                                    {searchQuery.trim() === '' ? 'SUGERENCIAS' : 'RESULTADOS DE BÚSQUEDA'}
                                </div>
                                {displayedSearchResults.map(res => (
                                    <div key={res.id_usuario} className="chat-contact-item" onClick={() => startChat(res)}>
                                        <img src={res.foto || '/default-avatar.png'} className="chat-contact-avatar small" style={{ width: 28, height: 28 }} alt="" />
                                        <div className="chat-contact-info">
                                            <div className="chat-contact-name" style={{ fontSize: '0.85rem' }}>{res.nombre}</div>
                                        </div>
                                    </div>
                                ))}
                                <div 
                                    style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.7rem', color: '#3b82f6', cursor: 'pointer' }}
                                    onClick={() => setShowSearchDropdown(false)}
                                >
                                    Cerrar
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="chat-contact-list">
                    {contacts.length > 0 ? (
                        contacts.map(c => (
                            <div 
                                key={c.id_usuario} 
                                className={`chat-contact-item ${activeContact?.id_usuario === c.id_usuario ? 'active' : ''}`}
                                onClick={() => setActiveContact(c)}
                            >
                                <img src={c.foto || '/default-avatar.png'} className="chat-contact-avatar" alt={c.nombre} />
                                <div className="chat-contact-info">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div className="chat-contact-name">{c.nombre}</div>
                                        {c.unread_count && c.unread_count > 0 ? (
                                            <span className="chat-unread-badge">{c.unread_count}</span>
                                        ) : null}
                                    </div>
                                    <div className="chat-contact-lastmsg">{c.ultimo_mensaje || 'Sin mensajes'}</div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="chat-empty-state" style={{ padding: '2rem', textAlign: 'center' }}>
                            <p>No tienes conversaciones recientes.</p>
                            <p style={{ fontSize: '0.8rem' }}>Usa el buscador para iniciar una.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Ventana de Chat */}
            <div className="chat-window">
                {activeContact ? (
                    <>
                        <div className="chat-window-header">
                            <img src={activeContact.foto || '/default-avatar.png'} className="chat-contact-avatar small" style={{ width: 32, height: 32 }} alt="" />
                            <div style={{ marginLeft: '0.8rem' }}>
                                <div className="chat-contact-name" style={{ marginBottom: 0 }}>{activeContact.nombre}</div>
                                <div style={{ fontSize: '0.75rem', color: '#10b981' }}>En línea</div>
                            </div>
                        </div>

                        <div className="chat-messages-area">
                            {messages.map((m, i) => {
                                const isMio = m.id_emisor === Number(user?.id);
                                return (
                                    <div key={i} className={`chat-message ${isMio ? 'sent' : 'received'}`}>
                                        <div className="chat-bubble">
                                            {m.mensaje}
                                        </div>
                                        <div className="chat-msg-time">
                                            {new Date(m.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <form className="chat-input-container" onSubmit={handleSendMessage}>
                            <textarea 
                                className="chat-input" 
                                placeholder="Escribe un mensaje..."
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSendMessage(e);
                                    }
                                }}
                                rows={1}
                            />
                            <button type="submit" className="chat-send-btn">
                                <span style={{ fontSize: '1.2rem' }}>➤</span>
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="chat-empty-state">
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
                        <h3>Tus Mensajes</h3>
                        <p>Selecciona una conversación para empezar.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatModule;
