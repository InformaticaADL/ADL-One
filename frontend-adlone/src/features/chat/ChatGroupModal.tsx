import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import {
    IconX, IconCamera, IconDotsVertical, IconUser, IconShield, IconTrash,
    IconUsers, IconLogout, IconUserPlus, IconSearch,
} from '@tabler/icons-react';
import { generalChatService } from '../../services/general-chat.service';
import type { ChatContact, ChatMember } from '../../services/general-chat.service';
import { useAuth } from '../../contexts/AuthContext';
import { useChatStore } from '../../store/chatStore';
import { useConfirm } from './FluentConfirm';
import ChatAvatar from './ChatAvatar';

interface ChatGroupModalProps {
    opened: boolean;
    onClose: () => void;
    onCreated: () => void;
    editConversationId: number | null;
    onViewMember: (userId: number) => void;
}

const ChatGroupModal: React.FC<ChatGroupModalProps> = ({ opened, onClose, onCreated, editConversationId, onViewMember }) => {
    const { user } = useAuth();
    const conversations = useChatStore((st) => st.conversations);
    const editingConv = editConversationId ? conversations.find((c) => c.id_conversacion === editConversationId) : null;
    const { ask, dialog } = useConfirm();

    const [tab, setTab] = useState<'info' | 'members'>('info');
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [fotoFile, setFotoFile] = useState<File | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ChatContact[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<ChatContact[]>([]);
    const [existingMembers, setExistingMembers] = useState<ChatMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [fotoRef] = useState(() => ({ el: null as HTMLInputElement | null }));

    const isEditing = editConversationId !== null;
    const myRole = existingMembers.find((m) => m.id_entidad === user?.id)?.rol;
    const isAdmin = myRole === 'ADMIN';

    useEffect(() => {
        const init = async () => {
            if (opened) {
                setTab('info');
                if (isEditing && editConversationId) {
                    setNombre(editingConv?.nombre_grupo || '');
                    setDescripcion(editingConv?.descripcion || '');
                    const members = await loadGroupData();
                    loadInitialContacts(members);
                } else loadInitialContacts([]);
            }
        };
        init();
        if (!opened) {
            setNombre(''); setDescripcion(''); setFotoFile(null);
            setSelectedMembers([]); setExistingMembers([]); setSearchQuery(''); setSearchResults([]);
        }
    }, [opened, editConversationId]);

    const loadInitialContacts = async (currentExisting: ChatMember[]) => {
        try {
            const all = await generalChatService.searchContacts('', true);
            const ids = new Set([...currentExisting.map((m) => m.id_entidad), ...selectedMembers.map((m) => m.id_entidad), user?.id || 0]);
            setSearchResults(all.filter((r) => !ids.has(r.id_entidad)));
        } catch (e) { console.error(e); }
    };
    const loadGroupData = async () => {
        if (!editConversationId) return [];
        setLoading(true);
        try { const m = await generalChatService.getConversationMembers(editConversationId); setExistingMembers(m); return m; }
        catch (e) { console.error(e); return []; } finally { setLoading(false); }
    };
    const handleSearch = async (q: string) => {
        setSearchQuery(q);
        if (q.trim().length < 2) { setSearchResults([]); return; }
        try {
            const results = await generalChatService.searchContacts(q, true);
            const ids = new Set([...existingMembers.map((m) => m.id_entidad), ...selectedMembers.map((m) => m.id_entidad), user?.id || 0]);
            setSearchResults(results.filter((r) => !ids.has(r.id_entidad)));
        } catch (e) { console.error(e); }
    };
    const addMember = (c: ChatContact) => { setSelectedMembers((p) => [...p, c]); setSearchResults((p) => p.filter((r) => r.id_entidad !== c.id_entidad)); setSearchQuery(''); };
    const removePending = (id: number) => setSelectedMembers((p) => p.filter((m) => m.id_entidad !== id));

    const removeExisting = async (memberId: number) => {
        if (!editConversationId) return;
        try { await generalChatService.removeGroupMember(editConversationId, memberId); setExistingMembers((p) => p.filter((m) => m.id_entidad !== memberId)); } catch (e) { console.error(e); }
    };
    const changeRole = async (memberId: number, role: 'ADMIN' | 'MIEMBRO') => {
        if (!editConversationId) return;
        try { await generalChatService.updateGroupMemberRole(editConversationId, memberId, role); setExistingMembers((p) => p.map((m) => (m.id_entidad === memberId ? { ...m, rol: role } : m))); } catch (e) { console.error(e); }
    };
    const leaveGroup = () => ask({
        title: 'Salir del grupo', danger: true, confirmLabel: 'Salir',
        message: 'No verás mensajes nuevos a menos que te vuelvan a invitar.',
        onConfirm: async () => { if (!editConversationId) return; setSaving(true); try { await generalChatService.leaveGroup(editConversationId); onCreated(); } catch (e) { console.error(e); } finally { setSaving(false); } },
    });
    const handleSave = async () => {
        setSaving(true);
        try {
            if (isEditing && editConversationId) {
                for (const m of selectedMembers) await generalChatService.addGroupMember(editConversationId, m.id_entidad);
                const upd: Record<string, unknown> = {};
                if (nombre.trim() && nombre.trim() !== editingConv?.nombre_grupo) upd.nombre_grupo = nombre.trim();
                if (descripcion.trim() !== (editingConv?.descripcion || '')) upd.descripcion = descripcion.trim();
                if (fotoFile) upd.foto = fotoFile;
                if (Object.keys(upd).length > 0) await generalChatService.updateGroup(editConversationId, upd);
            } else {
                if (!nombre.trim() || selectedMembers.length === 0) return;
                await generalChatService.createGroup(nombre.trim(), selectedMembers.map((m) => m.id_entidad), descripcion.trim(), fotoFile || undefined);
            }
            onCreated();
        } catch (e) { console.error(e); } finally { setSaving(false); }
    };

    const photoPreview = fotoFile ? URL.createObjectURL(fotoFile) : null;

    return (
        <Dialog open={opened} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="shadcn-scope max-w-[min(48rem,96vw)]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Configurar grupo' : 'Nuevo grupo'}</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                ) : (
                    <Tabs value={tab} onValueChange={(k) => setTab(k as 'info' | 'members')}>
                        <TabsList>
                            <TabsTrigger value="info">Información</TabsTrigger>
                            <TabsTrigger value="members">Miembros{isEditing ? ` (${existingMembers.length})` : ''}</TabsTrigger>
                        </TabsList>

                        <TabsContent value="info" className="min-h-[320px] pt-2">
                            <div className="flex justify-center rounded-lg bg-muted/60 p-4">
                                <div className="relative">
                                    {photoPreview
                                        ? <img src={photoPreview} alt="Vista previa" className="h-[120px] w-[120px] rounded-full object-cover" />
                                        : <ChatAvatar name={nombre || 'Grupo'} foto={editingConv?.foto_display} size={120} group />}
                                    {(!isEditing || isAdmin) && (
                                        <>
                                            <input ref={(el) => { fotoRef.el = el; }} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => setFotoFile(e.target.files?.[0] || null)} />
                                            <Button size="icon" className="absolute bottom-0 right-0 h-8 w-8 rounded-full" aria-label="Cambiar foto" onClick={() => fotoRef.el?.click()}>
                                                <IconCamera size={16} />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="mt-3 flex flex-col gap-3">
                                <div>
                                    <div className="mb-1 text-xs font-semibold text-foreground">Nombre del grupo</div>
                                    <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Equipo Informática" disabled={isEditing && !isAdmin} />
                                </div>
                                <div>
                                    <div className="mb-1 text-xs font-semibold text-foreground">Descripción</div>
                                    <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3}
                                        placeholder={isAdmin || !isEditing ? 'Añade una descripción…' : 'Sin descripción'} disabled={isEditing && !isAdmin} />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="members" className="min-h-[320px] pt-2">
                            <div className="flex flex-wrap gap-8">
                                <div className="min-w-0 flex-1 basis-[260px]">
                                    {isEditing ? (
                                        <>
                                            <div className="mb-3 text-sm font-semibold text-foreground">Miembros del grupo</div>
                                            <div className="mt-2 flex max-h-[340px] flex-col gap-1 overflow-y-auto">
                                                {existingMembers.map((m) => (
                                                    <DropdownMenu key={`${m.tipo_entidad || 'MEM'}-${m.id_entidad}`}>
                                                        <DropdownMenuTrigger asChild>
                                                            <button type="button" className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted">
                                                                <ChatAvatar name={m.nombre} foto={m.foto} size={40} />
                                                                <span className="min-w-0 flex-1">
                                                                    <span className="block truncate text-sm font-semibold text-foreground">{m.nombre}</span>
                                                                    <span className="block truncate text-xs text-muted-foreground">{m.cargo || m.email}</span>
                                                                </span>
                                                                <span className="flex shrink-0 items-center gap-1">
                                                                    {m.rol === 'ADMIN' && <Badge variant="outline">Admin</Badge>}
                                                                    <IconDotsVertical size={18} />
                                                                </span>
                                                            </button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="start">
                                                            <DropdownMenuItem onSelect={() => { onClose(); onViewMember(m.id_entidad); }}>
                                                                <IconUser size={15} /> Ver perfil
                                                            </DropdownMenuItem>
                                                            {isAdmin && m.id_entidad !== user?.id && (
                                                                <>
                                                                    <DropdownMenuItem onSelect={() => changeRole(m.id_entidad, m.rol !== 'ADMIN' ? 'ADMIN' : 'MIEMBRO')}>
                                                                        <IconShield size={15} /> {m.rol !== 'ADMIN' ? 'Hacer administrador' : 'Quitar administrador'}
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        danger
                                                                        onSelect={() => ask({ title: 'Expulsar miembro', danger: true, confirmLabel: 'Expulsar', message: '¿Expulsar a este miembro del grupo?', onConfirm: () => removeExisting(m.id_entidad) })}
                                                                    >
                                                                        <IconTrash size={15} /> Expulsar del grupo
                                                                    </DropdownMenuItem>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-muted-foreground">
                                            <IconUsers size={34} /><span>Agrega miembros en el panel de la derecha</span>
                                        </div>
                                    )}
                                </div>

                                <div className="min-w-0 flex-1 basis-[260px]">
                                    {(!isEditing || isAdmin) ? (
                                        <>
                                            <div className="mb-3 text-sm font-semibold text-foreground">{isEditing ? 'Agregar integrantes' : 'Seleccionar integrantes'}</div>
                                            <div className="relative">
                                                <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                                <Input className="pl-8" value={searchQuery} onChange={(e) => handleSearch(e.target.value)} placeholder="Buscar por nombre o correo…" />
                                            </div>
                                            <div className="mt-2 flex max-h-[340px] flex-col gap-1 overflow-y-auto">
                                                {searchResults.map((c) => (
                                                    <button key={`${c.tipo_entidad}-${c.id_entidad}`} type="button" className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted" onClick={() => addMember(c)}>
                                                        <ChatAvatar name={c.nombre} foto={c.foto} size={36} />
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate text-sm font-semibold text-foreground">{c.nombre}</span>
                                                            <span className="block truncate text-xs text-muted-foreground">{c.cargo || c.email}</span>
                                                        </span>
                                                        <IconUserPlus size={18} className="text-primary" />
                                                    </button>
                                                ))}
                                            </div>
                                            {selectedMembers.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-1">
                                                    {selectedMembers.map((m) => (
                                                        <Badge key={`${m.tipo_entidad}-${m.id_entidad}`} variant="outline" className="gap-1 pr-1">
                                                            {m.nombre}
                                                            <button type="button" aria-label="Quitar" onClick={() => removePending(m.id_entidad)} className="rounded-full p-0.5 hover:bg-muted">
                                                                <IconX size={12} />
                                                            </button>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center text-muted-foreground">
                                            <IconShield size={34} /><span>No tienes permisos para agregar miembros</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                )}

                <DialogFooter className="sm:justify-between">
                    {isEditing ? (
                        <Button variant="ghost" className="text-muted-foreground" disabled={saving} onClick={leaveGroup}>
                            <IconLogout size={16} /> Salir del grupo
                        </Button>
                    ) : <span />}
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>{isEditing && !isAdmin ? 'Cerrar' : 'Cancelar'}</Button>
                        {(!isEditing || isAdmin) && (
                            <Button
                                onClick={handleSave}
                                disabled={saving || (!isEditing && (!nombre.trim() || selectedMembers.length === 0))}
                            >
                                {saving ? 'Guardando…' : <><IconUsers size={16} /> {isEditing ? 'Guardar cambios' : 'Crear grupo'}</>}
                            </Button>
                        )}
                    </div>
                </DialogFooter>
                {dialog}
            </DialogContent>
        </Dialog>
    );
};

export default ChatGroupModal;
