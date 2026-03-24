import { useState, useEffect } from 'react';
import {
    Modal, TextInput, Textarea, Button, Group, Avatar, Text, Box,
    ScrollArea, ActionIcon, Badge, Divider, Loader, Center, Menu, FileButton,
    Tabs, Stack, Paper, Grid, UnstyledButton
} from '@mantine/core';
import { 
    IconTrash, IconUserPlus, IconUsers, IconSearch, IconDotsVertical, 
    IconLogout, IconCamera, IconInfoCircle, IconUsersGroup 
} from '@tabler/icons-react';
import { generalChatService } from '../../services/general-chat.service';
import type { ChatContact, ChatMember } from '../../services/general-chat.service';
import API_CONFIG from '../../config/api.config';
import { useAuth } from '../../contexts/AuthContext';
import { useChatStore } from '../../store/chatStore';
import { ConfirmModal } from '../../components/common/ConfirmModal';

interface ChatGroupModalProps {
    opened: boolean;
    onClose: () => void;
    onCreated: () => void;
    editConversationId: number | null;
    onViewMember: (userId: number) => void;
}

const ChatGroupModal: React.FC<ChatGroupModalProps> = ({ 
    opened, onClose, onCreated, editConversationId, onViewMember 
}) => {
    const { user } = useAuth();
    const conversations = useChatStore(s => s.conversations);
    const editingConv = editConversationId ? conversations.find(c => c.id_conversacion === editConversationId) : null;

    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [fotoFile, setFotoFile] = useState<File | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<ChatContact[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<ChatContact[]>([]);
    const [existingMembers, setExistingMembers] = useState<ChatMember[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searching, setSearching] = useState(false);
    const [confirmLeave, setConfirmLeave] = useState(false);
    const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null);

    const isEditing = editConversationId !== null;
    const myRole = existingMembers.find(m => m.id_entidad === user?.id)?.rol;
    const isAdmin = myRole === 'ADMIN';

    useEffect(() => {
        const fetchInitial = async () => {
            if (opened) {
                if (isEditing && editConversationId) {
                    setNombre(editingConv?.nombre_grupo || '');
                    setDescripcion(editingConv?.descripcion || '');
                    const members = await loadGroupData();
                    loadInitialContacts(members);
                } else {
                    loadInitialContacts([]);
                }
            }
        };
        fetchInitial();
        if (!opened) {
            setNombre('');
            setDescripcion('');
            setFotoFile(null);
            setSelectedMembers([]);
            setExistingMembers([]);
            setSearchQuery('');
            setSearchResults([]);
        }
    }, [opened, editConversationId]);

    const loadInitialContacts = async (currentExisting: ChatMember[]) => {
        setSearching(true);
        try {
            const all = await generalChatService.searchContacts('', true);
            const existingIds = new Set([
                ...currentExisting.map(m => m.id_entidad),
                ...selectedMembers.map(m => m.id_entidad),
                user?.id || 0
            ]);
            setSearchResults(all.filter(r => !existingIds.has(r.id_entidad)));
        } catch (err) {
            console.error(err);
        } finally {
            setSearching(false);
        }
    };

    const loadGroupData = async () => {
        if (!editConversationId) return [];
        setLoading(true);
        try {
            const members = await generalChatService.getConversationMembers(editConversationId);
            setExistingMembers(members);
            return members;
        } catch (err) {
            console.error(err);
            return [];
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (q: string) => {
        setSearchQuery(q);
        if (q.trim().length < 2) { setSearchResults([]); return; }
        setSearching(true);
        try {
            const results = await generalChatService.searchContacts(q, true);
            // Exclude current user and existing members
            const existingIds = new Set([
                ...existingMembers.map(m => m.id_entidad),
                ...selectedMembers.map(m => m.id_entidad),
                user?.id || 0
            ]);
            setSearchResults(results.filter(r => !existingIds.has(r.id_entidad)));
        } catch (err) {
            console.error(err);
        } finally {
            setSearching(false);
        }
    };

    const addMember = (contact: ChatContact) => {
        setSelectedMembers(prev => [...prev, contact]);
        setSearchResults(prev => prev.filter(r => r.id_entidad !== contact.id_entidad));
        setSearchQuery('');
    };

    const removePendingMember = (id: number) => {
        setSelectedMembers(prev => prev.filter(m => m.id_entidad !== id));
    };

    const handleRemoveExistingMember = async (memberId: number) => {
        if (!editConversationId) return;
        try {
            await generalChatService.removeGroupMember(editConversationId, memberId);
            setExistingMembers(prev => prev.filter(m => m.id_entidad !== memberId));
        } catch (err) {
            console.error('Error removing member:', err);
        }
    };

    const handleChangeRole = async (memberId: number, newRole: 'ADMIN' | 'MIEMBRO') => {
        if (!editConversationId) return;
        try {
            await generalChatService.updateGroupMemberRole(editConversationId, memberId, newRole);
            setExistingMembers(prev => prev.map(m => m.id_entidad === memberId ? { ...m, rol: newRole } : m));
        } catch (err) {
            console.error('Error changing role:', err);
        }
    };

    const handleLeaveGroup = async () => {
        if (!editConversationId) return;
        setConfirmLeave(true);
    };

    const confirmLeaveGroup = async () => {
        if (!editConversationId) return;
        setConfirmLeave(false);
        setSaving(true);
        try {
            await generalChatService.leaveGroup(editConversationId);
            onCreated();
        } catch (err) {
            console.error('Error leaving group:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (isEditing && editConversationId) {
                // Add new members
                for (const member of selectedMembers) {
                    await generalChatService.addGroupMember(editConversationId, member.id_entidad);
                }
                // Update name and description if changed
                const updateData: any = {};
                if (nombre.trim() && nombre.trim() !== editingConv?.nombre_grupo) updateData.nombre_grupo = nombre.trim();
                if (descripcion.trim() !== (editingConv?.descripcion || '')) updateData.descripcion = descripcion.trim();
                if (fotoFile) updateData.foto = fotoFile;
                
                if (Object.keys(updateData).length > 0) {
                    await generalChatService.updateGroup(editConversationId, updateData);
                }
            } else {
                // Create new group
                if (!nombre.trim() || selectedMembers.length === 0) return;
                await generalChatService.createGroup(nombre.trim(), selectedMembers.map(m => m.id_entidad), descripcion.trim(), fotoFile || undefined);
            }
            onCreated();
        } catch (err) {
            console.error('Error saving group:', err);
        } finally {
            setSaving(false);
        }
    };

    const baseUrl = API_CONFIG.getBaseURL();

    return (
        <>
            <Modal
                opened={opened}
                onClose={onClose}
                title={isEditing ? 'Configurar Grupo' : 'Nuevo Grupo'}
                size="xl"
            >
            {loading ? (
                <Center p="xl"><Loader /></Center>
            ) : (
                <Box pt="xs">
                    <Tabs defaultValue="info" color="blue" variant="pills" radius="md">
                        <Tabs.List grow mb="md">
                            <Tabs.Tab value="info" leftSection={<IconInfoCircle size={16} />}>Información</Tabs.Tab>
                            <Tabs.Tab value="members" leftSection={<IconUsersGroup size={16} />}>Miembros</Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="info">
                            <Stack gap="md">
                                {/* Group Image */}
                                <Paper withBorder p="md" radius="md" style={{ background: 'var(--mantine-color-gray-0)' }}>
                                    <Center>
                                        <Box style={{ position: 'relative' }}>
                                            <Avatar
                                                src={fotoFile ? URL.createObjectURL(fotoFile) : (editingConv?.foto_display ? `${baseUrl}${editingConv.foto_display}` : null)}
                                                size={120}
                                                radius="100%"
                                                color="blue"
                                                styles={{ root: { border: '4px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } }}
                                            >
                                                <IconUsers size={60} />
                                            </Avatar>
                                            {(!isEditing || isAdmin) && (
                                                <FileButton onChange={setFotoFile} accept="image/png,image/jpeg">
                                                    {(props) => (
                                                        <ActionIcon
                                                            {...props}
                                                            variant="filled"
                                                            color="blue"
                                                            radius="xl"
                                                            size="lg"
                                                            style={{ position: 'absolute', bottom: 0, right: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
                                                        >
                                                            <IconCamera size={18} />
                                                        </ActionIcon>
                                                    )}
                                                </FileButton>
                                            )}
                                        </Box>
                                    </Center>
                                </Paper>

                                <TextInput
                                    label="Nombre del grupo"
                                    placeholder="Ej: Equipo Informática"
                                    value={nombre}
                                    onChange={(e) => setNombre(e.currentTarget.value)}
                                    required={!isEditing}
                                    disabled={isEditing && !isAdmin}
                                    size="md"
                                />

                                <Textarea
                                    label="Descripción"
                                    placeholder={isAdmin ? "Añade una descripción al grupo..." : "Sin descripción"}
                                    value={descripcion}
                                    onChange={(e) => setDescripcion(e.currentTarget.value)}
                                    autosize
                                    minRows={3}
                                    disabled={isEditing && !isAdmin}
                                />
                            </Stack>
                        </Tabs.Panel>

                        <Tabs.Panel value="members">
                            <Grid gutter="xl">
                                <Grid.Col span={{ base: 12, md: 6 }}>
                                    {/* Existing members */}
                                    {isEditing && (
                                        <Box>
                                            <Text size="sm" fw={600} mb="xs">Miembros del grupo ({existingMembers.length})</Text>
                                            <ScrollArea.Autosize mah={400} type="auto">
                                                <Stack gap={8}>
                                                    {existingMembers.map(member => (
                                                        <Menu key={`${member.tipo_entidad || 'MEM'}-${member.id_entidad}`} position="bottom-start" shadow="md" withinPortal={true}>
                                                            <Menu.Target>
                                                                <UnstyledButton
                                                                    p="xs"
                                                                    style={{ 
                                                                        borderRadius: 12, 
                                                                        background: 'var(--mantine-color-gray-0)',
                                                                        width: '100%',
                                                                        transition: 'all 0.2s ease',
                                                                        border: '1px solid var(--mantine-color-gray-2)'
                                                                    }}
                                                                    className="member-item-btn"
                                                                >
                                                                    <Group justify="space-between" h={50} wrap="nowrap">
                                                                        <Group gap="sm" style={{ flex: 1, minWidth: 0 }} wrap="nowrap">
                                                                            <Avatar src={member.foto ? `${baseUrl}${member.foto}` : null} size={42} radius="xl" color="blue">
                                                                                {member.nombre?.charAt(0)?.toUpperCase()}
                                                                            </Avatar>
                                                                            <Box style={{ flex: 1, minWidth: 0 }}>
                                                                                <Text size="sm" fw={700} truncate>{member.nombre}</Text>
                                                                                <Text size="xs" c="dimmed" truncate>{member.cargo || member.email}</Text>
                                                                            </Box>
                                                                        </Group>
                                                                        <Group gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
                                                                            {member.rol === 'ADMIN' && (
                                                                                <Badge size="xs" variant="light" color="blue" styles={{ label: { textTransform: 'none' } }}>
                                                                                    Admin
                                                                                </Badge>
                                                                            )}
                                                                            <IconDotsVertical size={16} color="var(--mantine-color-gray-5)" />
                                                                        </Group>
                                                                    </Group>
                                                                </UnstyledButton>
                                                            </Menu.Target>
                                                            <Menu.Dropdown>
                                                                <Menu.Item 
                                                                    leftSection={<IconInfoCircle size={16} />} 
                                                                    onClick={() => { onClose(); onViewMember(member.id_entidad); }}
                                                                >
                                                                    Ver perfil
                                                                </Menu.Item>
                                                                
                                                                {isAdmin && member.id_entidad !== user?.id && (
                                                                    <>
                                                                        <Menu.Divider />
                                                                        {member.rol !== 'ADMIN' ? (
                                                                            <Menu.Item onClick={() => handleChangeRole(member.id_entidad, 'ADMIN')}>
                                                                                Hacer administrador
                                                                            </Menu.Item>
                                                                        ) : (
                                                                            <Menu.Item onClick={() => handleChangeRole(member.id_entidad, 'MIEMBRO')}>
                                                                                Quitar administrador
                                                                            </Menu.Item>
                                                                        )}
                                                                        <Menu.Item 
                                                                            color="red" 
                                                                            leftSection={<IconTrash size={16} />} 
                                                                            onClick={() => setConfirmRemoveId(member.id_entidad)}
                                                                        >
                                                                            Expulsar del grupo
                                                                        </Menu.Item>
                                                                    </>
                                                                )}
                                                            </Menu.Dropdown>
                                                        </Menu>
                                                    ))}
                                                </Stack>
                                            </ScrollArea.Autosize>
                                        </Box>
                                    )}
                                    {!isEditing && (
                                        <Center h={200} style={{ flexDirection: 'column', color: 'var(--mantine-color-dimmed)' }}>
                                            <IconUsers size={48} stroke={1.5} />
                                            <Text size="sm" mt="sm">Agregue miembros en el panel derecho</Text>
                                        </Center>
                                    )}
                                </Grid.Col>

                                <Grid.Col span={{ base: 12, md: 6 }}>
                                    {/* Search & add members (Admin only or new group) */}
                                    {(!isEditing || isAdmin) ? (
                                        <Box>
                                            <Text size="sm" fw={600} mb="xs">
                                                {isEditing ? 'Agregar nuevos integrantes' : 'Seleccionar integrantes'}
                                            </Text>

                                            <TextInput
                                                placeholder="Buscar por nombre o correo..."
                                                leftSection={<IconSearch size={16} />}
                                                value={searchQuery}
                                                onChange={(e) => handleSearch(e.currentTarget.value)}
                                                mb="xs"
                                                size="sm"
                                            />

                                            {/* Search results */}
                                                    {searchResults.length > 0 && (
                                                <ScrollArea.Autosize mah={300} mb="xs" type="auto">
                                                    <Stack gap={6}>
                                                        {searchResults.map(contact => (
                                                            <UnstyledButton
                                                                key={`${contact.tipo_entidad}-${contact.id_entidad}`}
                                                                component="div"
                                                                p="xs"
                                                                style={{ 
                                                                    cursor: 'pointer', 
                                                                    borderRadius: 12,
                                                                    background: 'var(--mantine-color-gray-0)',
                                                                    border: '1px solid var(--mantine-color-gray-1)',
                                                                    transition: 'transform 0.1s ease',
                                                                }}
                                                                onClick={() => addMember(contact)}
                                                                className="search-result-item"
                                                            >
                                                                <Group justify="space-between">
                                                                    <Group gap="sm">
                                                                        <Avatar src={contact.foto ? `${baseUrl}${contact.foto}` : null} size={36} radius="xl" color="blue">
                                                                            {contact.nombre?.charAt(0)?.toUpperCase()}
                                                                        </Avatar>
                                                                        <Box>
                                                                            <Text size="sm" fw={600}>{contact.nombre}</Text>
                                                                            <Text size="xs" c="dimmed">{contact.cargo || contact.email}</Text>
                                                                        </Box>
                                                                    </Group>
                                                                    <ActionIcon variant="light" color="blue" radius="xl" size="md">
                                                                        <IconUserPlus size={18} />
                                                                    </ActionIcon>
                                                                </Group>
                                                            </UnstyledButton>
                                                        ))}
                                                    </Stack>
                                                </ScrollArea.Autosize>
                                            )}

                                            {searching && <Center p="xs"><Loader size="xs" /></Center>}

                                            {/* Selected new members */}
                                            {selectedMembers.length > 0 && (
                                                <Box mt="md">
                                                    <Text size="xs" fw={500} c="dimmed" mb={8}>Por agregar:</Text>
                                                    <ScrollArea.Autosize mah={100}>
                                                        <Group gap={6}>
                                                            {selectedMembers.map(m => (
                                                                <Badge
                                                                    key={`${m.tipo_entidad}-${m.id_entidad}`}
                                                                    variant="filled"
                                                                    color="blue"
                                                                    size="md"
                                                                    radius="sm"
                                                                    pr={0}
                                                                    rightSection={
                                                                        <ActionIcon size="xs" variant="transparent" color="white" onClick={() => removePendingMember(m.id_entidad)}>
                                                                            <IconTrash size={12} />
                                                                        </ActionIcon>
                                                                    }
                                                                >
                                                                    {m.nombre}
                                                                </Badge>
                                                            ))}
                                                        </Group>
                                                    </ScrollArea.Autosize>
                                                </Box>
                                            )}
                                        </Box>
                                    ) : (
                                        <Center h={200} style={{ flexDirection: 'column', color: 'var(--mantine-color-dimmed)' }}>
                                            <Text size="sm">No tienes permisos para agregar miembros</Text>
                                        </Center>
                                    )}
                                </Grid.Col>
                            </Grid>
                        </Tabs.Panel>
                    </Tabs>

                    {/* Footer Actions */}
                    <Divider my="lg" />
                    <Group justify="space-between" mb="xs">
                        {isEditing ? (
                            <Button 
                                variant="subtle" 
                                color="red" 
                                size="sm"
                                leftSection={<IconLogout size={16} />} 
                                onClick={handleLeaveGroup} 
                                disabled={saving}
                            >
                                Salir del grupo
                            </Button>
                        ) : (
                            <Box />
                        )}
                        <Group gap="sm">
                            <Button variant="default" onClick={onClose}>
                                {isEditing && !isAdmin ? 'Cerrar' : 'Cancelar'}
                            </Button>
                            {(!isEditing || isAdmin) && (
                                <Button
                                    onClick={handleSave}
                                    loading={saving}
                                    disabled={!isEditing && (!nombre.trim() || selectedMembers.length === 0)}
                                    leftSection={<IconUsers size={18} />}
                                    size="sm"
                                >
                                    {isEditing ? 'Guardar Cambios' : 'Crear Grupo'}
                                </Button>
                            )}
                        </Group>
                    </Group>
                </Box>
            )}
        </Modal>

        <ConfirmModal
            isOpen={confirmLeave}
            title="Salir del Grupo"
            message="¿Estás seguro de que deseas salir del grupo? No podrás ver los mensajes nuevos a menos que te vuelvan a invitar."
            confirmText="Salir del grupo"
            confirmColor="var(--mantine-color-red-6)"
            onConfirm={confirmLeaveGroup}
            onCancel={() => setConfirmLeave(false)}
        />

        <ConfirmModal
            isOpen={confirmRemoveId !== null}
            title="Expulsar Miembro"
            message="¿Estás seguro de que deseas expulsar a este miembro del grupo?"
            confirmText="Expulsar"
            confirmColor="var(--mantine-color-red-6)"
            onConfirm={() => {
                if (confirmRemoveId) handleRemoveExistingMember(confirmRemoveId);
                setConfirmRemoveId(null);
            }}
            onCancel={() => setConfirmRemoveId(null)}
        />
    </>
);
};

export default ChatGroupModal;
