import { useState, useEffect } from 'react';
import { Modal, Button, Tag, Input, Tabs, Spin, Dropdown, Avatar } from 'antd';
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

const { TextArea } = Input;

interface ChatGroupModalProps {
    opened: boolean;
    onClose: () => void;
    onCreated: () => void;
    editConversationId: number | null;
    onViewMember: (userId: number) => void;
}

const C = {
    border: '#f0f0f0', text: 'rgba(0,0,0,0.88)', textTer: 'rgba(0,0,0,0.45)',
    primary: '#1677ff', primaryBg: '#e6f4ff', bg: '#ffffff', bgLayout: '#fafafa', hover: '#f5f5f5',
};

const CSS = `
.adl-gm-photo { display:flex; justify-content:center; padding:16px; background:${C.bgLayout}; border-radius:8px; }
.adl-gm-photoinner { position:relative; }
.adl-gm-cam { position:absolute; bottom:0; right:0; }
.adl-gm-fields { display:flex; flex-direction:column; row-gap:12px; margin-top:12px; }
.adl-gm-flabel { font-size:13px; font-weight:600; color:${C.text}; margin-bottom:4px; }
.adl-gm-tabbody { padding-top:8px; min-height:320px; }
.adl-gm-cols { display:flex; column-gap:32px; flex-wrap:wrap; row-gap:16px; }
.adl-gm-col { flex:1 1 260px; min-width:0; }
.adl-gm-coltitle { font-size:14px; font-weight:600; margin-bottom:12px; color:${C.text}; }
.adl-gm-scroll { max-height:340px; overflow-y:auto; display:flex; flex-direction:column; row-gap:4px; margin-top:8px; }
.adl-gm-row { display:flex; align-items:center; column-gap:12px; width:100%; padding:8px; border:none; background:transparent; cursor:pointer; border-radius:6px; text-align:left; }
.adl-gm-row:hover { background:${C.hover}; }
.adl-gm-rowbody { flex:1; min-width:0; }
.adl-gm-rowname { font-weight:600; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:${C.text}; }
.adl-gm-rowsub { font-size:12px; color:${C.textTer}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.adl-gm-pills { display:flex; flex-wrap:wrap; gap:4px; margin-top:12px; }
.adl-gm-emptycol { display:flex; flex-direction:column; align-items:center; row-gap:12px; padding:40px 16px; color:${C.textTer}; text-align:center; }
.adl-gm-footer { display:flex; justify-content:space-between; align-items:center; width:100%; }
.adl-gm-trailing { display:flex; align-items:center; column-gap:4px; flex-shrink:0; }
`;

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

    const infoTab = (
        <div className="adl-gm-tabbody">
            <div className="adl-gm-photo">
                <div className="adl-gm-photoinner">
                    {photoPreview
                        ? <Avatar src={photoPreview} size={120} />
                        : <ChatAvatar name={nombre || 'Grupo'} foto={editingConv?.foto_display} size={120} group />}
                    {(!isEditing || isAdmin) && (
                        <>
                            <input ref={(el) => { fotoRef.el = el; }} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => setFotoFile(e.target.files?.[0] || null)} />
                            <span className="adl-gm-cam"><Button type="primary" shape="circle" icon={<IconCamera size={18} />} aria-label="Cambiar foto" onClick={() => fotoRef.el?.click()} /></span>
                        </>
                    )}
                </div>
            </div>
            <div className="adl-gm-fields">
                <div>
                    <div className="adl-gm-flabel">Nombre del grupo</div>
                    <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Equipo Informática" disabled={isEditing && !isAdmin} />
                </div>
                <div>
                    <div className="adl-gm-flabel">Descripción</div>
                    <TextArea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} autoSize={{ minRows: 3, maxRows: 6 }}
                        placeholder={isAdmin || !isEditing ? 'Añade una descripción…' : 'Sin descripción'} disabled={isEditing && !isAdmin} />
                </div>
            </div>
        </div>
    );

    const membersTab = (
        <div className="adl-gm-tabbody">
            <div className="adl-gm-cols">
                <div className="adl-gm-col">
                    {isEditing ? (
                        <>
                            <div className="adl-gm-coltitle">Miembros del grupo</div>
                            <div className="adl-gm-scroll">
                                {existingMembers.map((m) => {
                                    const items = [
                                        { key: 'profile', icon: <IconUser size={16} />, label: 'Ver perfil', onClick: () => { onClose(); onViewMember(m.id_entidad); } },
                                        ...(isAdmin && m.id_entidad !== user?.id ? [
                                            { key: 'role', icon: <IconShield size={16} />, label: m.rol !== 'ADMIN' ? 'Hacer administrador' : 'Quitar administrador', onClick: () => changeRole(m.id_entidad, m.rol !== 'ADMIN' ? 'ADMIN' : 'MIEMBRO') },
                                            { key: 'kick', icon: <IconTrash size={16} />, danger: true, label: 'Expulsar del grupo', onClick: () => ask({ title: 'Expulsar miembro', danger: true, confirmLabel: 'Expulsar', message: '¿Expulsar a este miembro del grupo?', onConfirm: () => removeExisting(m.id_entidad) }) },
                                        ] : []),
                                    ];
                                    return (
                                        <Dropdown key={`${m.tipo_entidad || 'MEM'}-${m.id_entidad}`} trigger={['click']} placement="bottomLeft" menu={{ items }}>
                                            <button type="button" className="adl-gm-row">
                                                <ChatAvatar name={m.nombre} foto={m.foto} size={40} />
                                                <span className="adl-gm-rowbody"><span className="adl-gm-rowname" style={{ display: 'block' }}>{m.nombre}</span><span className="adl-gm-rowsub" style={{ display: 'block' }}>{m.cargo || m.email}</span></span>
                                                <span className="adl-gm-trailing">{m.rol === 'ADMIN' && <Tag color="blue" style={{ marginInlineEnd: 0 }}>Admin</Tag>}<IconDotsVertical size={18} /></span>
                                            </button>
                                        </Dropdown>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <div className="adl-gm-emptycol"><IconUsers size={34} /><span>Agrega miembros en el panel de la derecha</span></div>
                    )}
                </div>

                <div className="adl-gm-col">
                    {(!isEditing || isAdmin) ? (
                        <>
                            <div className="adl-gm-coltitle">{isEditing ? 'Agregar integrantes' : 'Seleccionar integrantes'}</div>
                            <Input prefix={<IconSearch size={16} color={C.textTer} />} value={searchQuery} onChange={(e) => handleSearch(e.target.value)} placeholder="Buscar por nombre o correo…" />
                            <div className="adl-gm-scroll">
                                {searchResults.map((c) => (
                                    <button key={`${c.tipo_entidad}-${c.id_entidad}`} type="button" className="adl-gm-row" onClick={() => addMember(c)}>
                                        <ChatAvatar name={c.nombre} foto={c.foto} size={36} />
                                        <span className="adl-gm-rowbody"><span className="adl-gm-rowname" style={{ display: 'block' }}>{c.nombre}</span><span className="adl-gm-rowsub" style={{ display: 'block' }}>{c.cargo || c.email}</span></span>
                                        <IconUserPlus size={18} color={C.primary} />
                                    </button>
                                ))}
                            </div>
                            {selectedMembers.length > 0 && (
                                <div className="adl-gm-pills">
                                    {selectedMembers.map((m) => (
                                        <Tag key={`${m.tipo_entidad}-${m.id_entidad}`} color="blue" closable onClose={() => removePending(m.id_entidad)} closeIcon={<IconX size={12} />}>
                                            {m.nombre}
                                        </Tag>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="adl-gm-emptycol"><IconShield size={34} /><span>No tienes permisos para agregar miembros</span></div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <Modal
            open={opened}
            title={isEditing ? 'Configurar grupo' : 'Nuevo grupo'}
            onCancel={onClose}
            width="min(48rem, 96vw)"
            styles={{ body: { paddingTop: 8 } }}
            footer={
                <div className="adl-gm-footer">
                    {isEditing ? <Button type="text" icon={<IconLogout size={16} />} onClick={leaveGroup} disabled={saving}>Salir del grupo</Button> : <span />}
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button onClick={onClose}>{isEditing && !isAdmin ? 'Cerrar' : 'Cancelar'}</Button>
                        {(!isEditing || isAdmin) && (
                            <Button type="primary" icon={<IconUsers size={16} />} onClick={handleSave} loading={saving}
                                disabled={saving || (!isEditing && (!nombre.trim() || selectedMembers.length === 0))}>
                                {isEditing ? 'Guardar cambios' : 'Crear grupo'}
                            </Button>
                        )}
                    </div>
                </div>
            }>
            <style>{CSS}</style>
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin tip="Cargando…"><div style={{ padding: 20 }} /></Spin></div>
            ) : (
                <Tabs activeKey={tab} onChange={(k) => setTab(k as 'info' | 'members')}
                    items={[
                        { key: 'info', label: 'Información', children: infoTab },
                        { key: 'members', label: `Miembros${isEditing ? ` (${existingMembers.length})` : ''}`, children: membersTab },
                    ]} />
            )}
            {dialog}
        </Modal>
    );
};

export default ChatGroupModal;
