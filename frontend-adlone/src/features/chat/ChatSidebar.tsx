import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
    IconDotsVertical, IconStar, IconStarFilled, IconTrash, IconUser,
    IconRefresh, IconMessages, IconUsers, IconSearch, IconPlus,
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
    onChangeView: (v: ChatView) => void;
    counts: { chats: number; favoritos: number; grupos: number };
    onSelect: (conv: ChatConversation) => void;
    onStartDirect: (contactId: number) => void;
    onSelectById: (conversationId: number) => void;
    onCreateGroup: () => void;
    onViewProfile: (userId: number) => void;
    isMobile?: boolean;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
    conversations, activeConversation, view, onChangeView, counts, onStartDirect, onSelect, onSelectById, onCreateGroup, onViewProfile, isMobile,
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
        return (
            <button
                key={conv.id_conversacion}
                type="button"
                onClick={() => onSelect(conv)}
                className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${active ? 'bg-accent' : 'hover:bg-muted'}`}
            >
                {active && <span className="absolute left-0.5 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full bg-primary" />}
                <span className="relative shrink-0">
                    <ChatAvatar name={conv.nombre_display} foto={conv.foto_display} size={40} group={group} />
                    {unread && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-destructive" />}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${unread ? 'font-semibold text-foreground' : 'font-medium text-foreground'}`}>
                            {conv.nombre_display || 'Chat'}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatTime(conv.ultimo_mensaje_fecha)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                        <span className={`truncate text-xs ${unread ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{preview}</span>
                        <span className="flex shrink-0 items-center gap-1">
                            {group && <Badge variant="outline">Grupo</Badge>}
                            {unread && <Badge variant="destructive">{conv.no_leidos}</Badge>}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        aria-label="Opciones"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <IconDotsVertical size={16} />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                    <DropdownMenuItem onSelect={() => toggleFav(conv)}>
                                        {isFav ? <IconStarFilled size={15} /> : <IconStar size={15} />}
                                        {isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        danger
                                        onSelect={() => ask({
                                            title: 'Eliminar conversación', danger: true, confirmLabel: 'Eliminar',
                                            message: 'Se ocultará y se limpiará el historial, pero reaparecerá si recibes nuevos mensajes.',
                                            onConfirm: () => deleteConversation(conv.id_conversacion),
                                        })}
                                    >
                                        <IconTrash size={15} />
                                        Eliminar chat
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
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
        <div className={`flex min-h-0 flex-col overflow-hidden border-r border-border bg-card ${isMobile ? 'w-full' : 'w-[360px] shrink-0'}`}>
            <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
                <h1 className="text-xl font-bold text-foreground">Mensajes</h1>
                <Button size="icon" className="h-8 w-8 rounded-full" title="Nuevo grupo" aria-label="Nuevo grupo" onClick={onCreateGroup}>
                    <IconPlus size={16} />
                </Button>
            </div>

            <div className="px-3 pb-2">
                <Tabs value={view} onValueChange={(v) => onChangeView(v as ChatView)}>
                    <TabsList className="w-full">
                        <TabsTrigger value="chats" className="flex-1">Chats <span className="ml-1 text-xs opacity-70">{counts.chats}</span></TabsTrigger>
                        <TabsTrigger value="favoritos" className="flex-1">Favoritos <span className="ml-1 text-xs opacity-70">{counts.favoritos}</span></TabsTrigger>
                        <TabsTrigger value="grupos" className="flex-1">Grupos <span className="ml-1 text-xs opacity-70">{counts.grupos}</span></TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <div
                className="relative flex items-center gap-2 border-b border-border px-3 pb-3"
                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setShowResults(false); }}
            >
                <div className="relative flex-1">
                    <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar conversaciones..."
                        className="pl-8"
                        value={search}
                        onFocus={() => setShowResults(true)}
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" title="Actualizar" aria-label="Actualizar"
                    onClick={() => { fetchConversations(); fetchFavorites(); }}>
                    <IconRefresh size={17} />
                </Button>
                {showResults && search.length > 0 && (
                    <div className="absolute left-3 right-3 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg">
                        {searching ? (
                            <div className="flex justify-center p-4">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            </div>
                        ) : searchResults.length === 0 ? (
                            <div className="p-4 text-center text-xs text-muted-foreground">Sin resultados</div>
                        ) : searchResults.map((item) => (
                            <button
                                key={`${item.tipo_entidad}-${item.id_entidad}`}
                                type="button"
                                className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted"
                                onClick={() => pickResult(item)}
                            >
                                <ChatAvatar name={item.nombre} foto={item.foto} size={32} group={item.tipo_entidad === 'GROUP'} />
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold text-foreground">{item.nombre}</span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {item.tipo_entidad === 'GROUP' ? 'Grupo' : (item.cargo || item.email)}
                                    </span>
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-1">
                {view === 'favoritos' ? (
                    favorites.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center text-muted-foreground">
                            {empty.icon}<p className="whitespace-pre-line text-sm">{empty.text}</p>
                        </div>
                    ) : favorites.map((fav) => (
                        <button
                            key={`fav-${fav.tipo_entidad}-${fav.id_entidad}`}
                            type="button"
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted"
                            onClick={() => (fav.tipo_entidad === 'GROUP' ? onSelectById(fav.id_entidad) : onStartDirect(fav.id_entidad))}
                        >
                            <ChatAvatar name={fav.nombre} foto={fav.foto} size={40} group={fav.tipo_entidad === 'GROUP'} />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-foreground">{fav.nombre}</span>
                                <span className="mt-0.5 flex items-center justify-between gap-2">
                                    <span className="truncate text-xs text-muted-foreground">{fav.tipo_entidad === 'GROUP' ? 'Grupo' : (fav.cargo || fav.email)}</span>
                                    <span className="flex shrink-0 items-center gap-1">
                                        {fav.tipo_entidad === 'USER' && (
                                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ver perfil" title="Ver perfil"
                                                onClick={(e) => { e.stopPropagation(); onViewProfile(fav.id_entidad); }}>
                                                <IconUser size={16} />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-warning" aria-label="Quitar de favoritos" title="Quitar de favoritos"
                                            onClick={(e) => { e.stopPropagation(); toggleFavById(fav.id_entidad, fav.tipo_entidad); }}>
                                            <IconStarFilled size={16} />
                                        </Button>
                                    </span>
                                </span>
                            </span>
                        </button>
                    ))
                ) : (
                    list.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center text-muted-foreground">
                            {empty.icon}<p className="whitespace-pre-line text-sm">{empty.text}</p>
                        </div>
                    ) : list.map(renderConversation)
                )}
            </div>
            {dialog}
        </div>
    );
};

export default ChatSidebar;
