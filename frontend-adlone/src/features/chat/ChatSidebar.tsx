import { useState, useEffect, useRef } from 'react';
import { Button, Input, Badge, Tag, Spin, Dropdown, Tooltip } from 'antd';
import {
    IconDotsVertical, IconStar, IconStarFilled, IconTrash, IconUser,
    IconRefresh, IconMessages, IconUsers, IconSearch,
} from '@tabler/icons-react';
import { generalChatService } from '../../services/general-chat.service';
import type { ChatConversation, ChatContact } from '../../services/general-chat.service';
import { useChatStore } from '../../store/chatStore';
import { useAuth } from '../../contexts/AuthContext';
import type { ChatView } from './ChatNav';
import { useConfirm } from './FluentConfirm';
import ChatAvatar from './ChatAvatar';

interface ChatSidebarProps {
    conversations: ChatConversation[];
    activeConversation: ChatConversation | null;
    view: ChatView;
    onSelect: (conv: ChatConversation) => void;
    onStartDirect: (contactId: number) => void;
    onSelectById: (conversationId: number) => void;
    onCreateGroup: () => void;
    onViewProfile: (userId: number) => void;
    isMobile?: boolean;
}

const C = {
    border: '#f0f0f0', text: 'rgba(0,0,0,0.88)', textSec: 'rgba(0,0,0,0.65)', textTer: 'rgba(0,0,0,0.45)',
    primary: '#1677ff', primaryBg: '#e6f4ff', bg: '#ffffff', hover: '#fafafa',
};

const CSS = `
.adl-sb-list { width:360px; flex-shrink:0; display:flex; flex-direction:column; min-height:0; overflow:hidden; background:${C.bg}; border-right:1px solid ${C.border}; }
.adl-sb-list.mobile { width:100%; }
.adl-sb-toolbar { display:flex; align-items:center; column-gap:8px; padding:12px; border-bottom:1px solid ${C.border}; position:relative; }
.adl-sb-results { position:absolute; top:100%; left:12px; right:12px; z-index:20; background:${C.bg}; border:1px solid ${C.border}; border-radius:8px; box-shadow:0 6px 16px rgba(0,0,0,.12); max-height:320px; overflow-y:auto; margin-top:4px; padding:4px; }
.adl-sb-scroll { flex:1; min-height:0; overflow-y:auto; padding:4px; }
.adl-sb-item { position:relative; display:flex; align-items:center; column-gap:12px; width:100%; padding:10px 12px; border:none; background:transparent; cursor:pointer; text-align:left; border-radius:8px; color:${C.text}; }
.adl-sb-item:hover { background:${C.hover}; }
.adl-sb-item.active { background:${C.primaryBg}; }
.adl-sb-item.active::before { content:""; position:absolute; left:3px; top:50%; transform:translateY(-50%); width:4px; height:34px; border-radius:4px; background:${C.primary}; }
.adl-sb-avatar { position:relative; flex-shrink:0; }
.adl-sb-dot { position:absolute; top:-1px; right:-1px; width:12px; height:12px; border-radius:50%; background:#ff4d4f; border:2px solid ${C.bg}; }
.adl-sb-body { flex:1; min-width:0; }
.adl-sb-row1 { display:flex; align-items:center; justify-content:space-between; column-gap:8px; }
.adl-sb-name { font-weight:600; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:${C.text}; }
.adl-sb-time { font-size:12px; color:${C.textTer}; flex-shrink:0; }
.adl-sb-row2 { display:flex; align-items:center; justify-content:space-between; column-gap:8px; margin-top:2px; }
.adl-sb-preview { font-size:12px; color:${C.textTer}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.adl-sb-unread { color:${C.text}; font-weight:600; }
.adl-sb-trailing { display:flex; align-items:center; column-gap:4px; flex-shrink:0; }
.adl-sb-empty { display:flex; flex-direction:column; align-items:center; row-gap:12px; padding:48px 24px; text-align:center; color:${C.textTer}; }
.adl-sb-emptytext { margin:0; font-size:14px; white-space:pre-line; }
.adl-sb-acrow { display:flex; align-items:center; column-gap:12px; width:100%; padding:8px; border:none; background:transparent; cursor:pointer; border-radius:6px; text-align:left; }
.adl-sb-acrow:hover { background:${C.hover}; }
`;

const ChatSidebar: React.FC<ChatSidebarProps> = ({
    conversations, activeConversation, view, onStartDirect, onSelect, onSelectById, onViewProfile, isMobile,
}) => {
    const [search, setSearch] = useState('');
    const [searchResults, setSearchResults] = useState<ChatContact[]>([]);
    const [searching, setSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const { favorites, fetchFavorites, fetchConversations, deleteConversation } = useChatStore();
    const { user } = useAuth();
    const { ask, dialog } = useConfirm();
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => { fetchFavorites(); }, []);

    const handleSearch = (value: string) => {
        setSearch(value); setShowResults(true); setSearching(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
            try {
                const results = await generalChatService.searchContacts(value);
                setSearchResults(results.filter((c) => !(c.tipo_entidad === 'USER' && String(c.id_entidad) === String(user?.id))));
            } catch { setSearchResults([]); } finally { setSearching(false); }
        }, 300);
    };
    const pickResult = (item: ChatContact) => {
        setSearch(''); setSearchResults([]); setShowResults(false);
        if (item.tipo_entidad === 'GROUP') onSelectById(item.id_entidad); else onStartDirect(item.id_entidad);
    };

    const toggleFav = async (conv: ChatConversation) => {
        try {
            const isFav = conv.es_favorito === 1;
            const targetId = conv.tipo === 'DIRECTA' ? conv.contacto_id : conv.id_conversacion;
            const tipo = conv.tipo === 'DIRECTA' ? 'USER' : 'GROUP';
            if (!targetId) return;
            if (isFav) await generalChatService.removeFavorite(targetId, tipo); else await generalChatService.addFavorite(targetId, tipo);
            fetchConversations(); fetchFavorites();
        } catch { /* noop */ }
    };
    const toggleFavById = async (id: number, tipo: 'USER' | 'GROUP') => {
        try {
            const isFav = favorites.some((f) => f.id_entidad === id);
            if (isFav) await generalChatService.removeFavorite(id, tipo); else await generalChatService.addFavorite(id, tipo);
            fetchConversations(); fetchFavorites();
        } catch { /* noop */ }
    };

    const formatTime = (date: string | null) => {
        if (!date) return '';
        const d = new Date(date), now = new Date();
        if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        const y = new Date(now); y.setDate(now.getDate() - 1);
        if (d.toDateString() === y.toDateString()) return 'Ayer';
        return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
    };

    const renderConversation = (conv: ChatConversation) => {
        const active = activeConversation?.id_conversacion === conv.id_conversacion;
        const group = conv.tipo === 'GRUPO';
        const unread = conv.no_leidos > 0;
        const isFav = conv.es_favorito === 1;
        const preview = conv.ultimo_tipo_mensaje === 'ARCHIVO' ? '📎 Archivo adjunto'
            : conv.ultimo_tipo_mensaje === 'SISTEMA' ? `ℹ️ ${conv.ultimo_mensaje || ''}`
                : conv.ultimo_mensaje || ' ';
        const menuItems = [
            {
                key: 'fav', icon: isFav ? <IconStarFilled size={16} /> : <IconStar size={16} />,
                label: isFav ? 'Quitar de favoritos' : 'Añadir a favoritos',
                onClick: ({ domEvent }: { domEvent: any }) => { domEvent.stopPropagation(); toggleFav(conv); },
            },
            {
                key: 'del', icon: <IconTrash size={16} />, danger: true, label: 'Eliminar chat',
                onClick: ({ domEvent }: { domEvent: any }) => {
                    domEvent.stopPropagation();
                    ask({
                        title: 'Eliminar conversación', danger: true, confirmLabel: 'Eliminar',
                        message: 'Se ocultará y se limpiará el historial, pero reaparecerá si recibes nuevos mensajes.',
                        onConfirm: () => deleteConversation(conv.id_conversacion),
                    });
                },
            },
        ];
        return (
            <button key={conv.id_conversacion} type="button" className={`adl-sb-item ${active ? 'active' : ''}`} onClick={() => onSelect(conv)}>
                <span className="adl-sb-avatar">
                    <ChatAvatar name={conv.nombre_display} foto={conv.foto_display} size={40} group={group} />
                    {unread && <span className="adl-sb-dot" />}
                </span>
                <span className="adl-sb-body">
                    <span className="adl-sb-row1">
                        <span className={`adl-sb-name ${unread ? 'adl-sb-unread' : ''}`}>{conv.nombre_display || 'Chat'}</span>
                        <span className="adl-sb-time">{formatTime(conv.ultimo_mensaje_fecha)}</span>
                    </span>
                    <span className="adl-sb-row2">
                        <span className={`adl-sb-preview ${unread ? 'adl-sb-unread' : ''}`}>{preview}</span>
                        <span className="adl-sb-trailing">
                            {group && <Tag color="blue" style={{ marginInlineEnd: 0 }}>Grupo</Tag>}
                            {unread && <Badge count={conv.no_leidos} size="small" />}
                            <Dropdown trigger={['click']} placement="bottomRight" menu={{ items: menuItems }}>
                                <Button type="text" size="small" icon={<IconDotsVertical size={18} />}
                                    onClick={(e) => e.stopPropagation()} aria-label="Opciones" />
                            </Dropdown>
                        </span>
                    </span>
                </span>
            </button>
        );
    };

    const list = view === 'grupos' ? conversations.filter((c) => c.tipo === 'GRUPO') : conversations;
    const empty = {
        chats: { icon: <IconMessages size={34} />, text: 'No tienes conversaciones aún.\nBusca un contacto para comenzar.' },
        grupos: { icon: <IconUsers size={34} />, text: 'No perteneces a ningún grupo.\nCrea uno con el botón +.' },
        favoritos: { icon: <IconStar size={34} />, text: 'No tienes contactos favoritos.\nMarca la ⭐ en un contacto.' },
    }[view];

    return (
        <div className={`adl-sb-list ${isMobile ? 'mobile' : ''}`}>
            <style>{CSS}</style>
            <div className="adl-sb-toolbar"
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setShowResults(false); }}>
                <Input allowClear placeholder="Buscar contacto o grupo…" prefix={<IconSearch size={16} color={C.textTer} />}
                    style={{ flex: 1 }} value={search} onFocus={() => setShowResults(true)}
                    onChange={(e) => handleSearch(e.target.value)} />
                <Tooltip title="Actualizar">
                    <Button type="text" icon={<IconRefresh size={18} />} aria-label="Actualizar"
                        onClick={() => { fetchConversations(); fetchFavorites(); }} />
                </Tooltip>
                {showResults && search.length > 0 && (
                    <div className="adl-sb-results">
                        {searching ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><Spin size="small" /></div>
                        ) : searchResults.length === 0 ? (
                            <div style={{ padding: 16, textAlign: 'center', color: C.textTer, fontSize: 12 }}>Sin resultados</div>
                        ) : searchResults.map((item) => (
                            <button key={`${item.tipo_entidad}-${item.id_entidad}`} type="button" className="adl-sb-acrow" onClick={() => pickResult(item)}>
                                <ChatAvatar name={item.nombre} foto={item.foto} size={32} group={item.tipo_entidad === 'GROUP'} />
                                <span style={{ minWidth: 0 }}>
                                    <span style={{ display: 'block', fontWeight: 600, fontSize: 14, color: C.text }}>{item.nombre}</span>
                                    <span style={{ display: 'block', fontSize: 12, color: C.textTer, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {item.tipo_entidad === 'GROUP' ? 'Grupo' : (item.cargo || item.email)}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="adl-sb-scroll">
                {view === 'favoritos' ? (
                    favorites.length === 0 ? (
                        <div className="adl-sb-empty">{empty.icon}<p className="adl-sb-emptytext">{empty.text}</p></div>
                    ) : favorites.map((fav) => (
                        <button key={`fav-${fav.tipo_entidad}-${fav.id_entidad}`} type="button" className="adl-sb-item"
                            onClick={() => (fav.tipo_entidad === 'GROUP' ? onSelectById(fav.id_entidad) : onStartDirect(fav.id_entidad))}>
                            <span className="adl-sb-avatar">
                                <ChatAvatar name={fav.nombre} foto={fav.foto} size={40} group={fav.tipo_entidad === 'GROUP'} />
                            </span>
                            <span className="adl-sb-body">
                                <span className="adl-sb-row1"><span className="adl-sb-name">{fav.nombre}</span></span>
                                <span className="adl-sb-row2">
                                    <span className="adl-sb-preview">{fav.tipo_entidad === 'GROUP' ? 'Grupo' : (fav.cargo || fav.email)}</span>
                                    <span className="adl-sb-trailing">
                                        {fav.tipo_entidad === 'USER' && (
                                            <Button type="text" size="small" icon={<IconUser size={18} />} aria-label="Ver perfil"
                                                onClick={(e) => { e.stopPropagation(); onViewProfile(fav.id_entidad); }} />
                                        )}
                                        <Button type="text" size="small" icon={<IconStarFilled size={18} color="#faad14" />} aria-label="Quitar de favoritos"
                                            onClick={(e) => { e.stopPropagation(); toggleFavById(fav.id_entidad, fav.tipo_entidad); }} />
                                    </span>
                                </span>
                            </span>
                        </button>
                    ))
                ) : (
                    list.length === 0 ? (
                        <div className="adl-sb-empty">{empty.icon}<p className="adl-sb-emptytext">{empty.text}</p></div>
                    ) : list.map(renderConversation)
                )}
            </div>
            {dialog}
        </div>
    );
};

export default ChatSidebar;
