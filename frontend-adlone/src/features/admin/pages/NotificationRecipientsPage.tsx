import React, { useState, useEffect, useMemo } from 'react';
import { 
    Container, 
    Grid, 
    Card, 
    Text, 
    Stack, 
    Group, 
    Select, 
    TextInput, 
    Checkbox, 
    Button, 
    ActionIcon, 
    Badge, 
    Loader, 
    Modal, 
    Table, 
    Alert,
    Divider,
    Paper,
    ScrollArea,
    Center,
    Tooltip
} from '@mantine/core';
import { 
    IconUserPlus, 
    IconUsers, 
    IconMail, 
    IconBell, 
    IconTrash, 
    IconSearch, 
    IconInfoCircle,
    IconUser,
    IconBriefcase
} from '@tabler/icons-react';
import { notificationService } from '../../../services/notification.service';
import { rbacService } from '../services/rbac.service';
import type { Role, User } from '../services/rbac.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';

interface NotificationEvent {
    id_evento: number;
    codigo_evento: string;
    descripcion: string;
    asunto_template: string;
    modulo?: string;
}

interface Recipient {
    id_relacion: number;
    id_usuario?: number;
    id_rol?: number;
    nombre_usuario?: string;
    nombre_rol?: string;
    tipo_envio: string;
    envia_email?: boolean;
    envia_web?: boolean;
    area_destino?: string;
}

interface Props {
    event: NotificationEvent;
    onBack: () => void;
}

export const NotificationRecipientsPage: React.FC<Props> = ({ event, onBack }) => {
    const { showToast } = useToast();
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Catalogs
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);

    // Selection state
    const [addType, setAddType] = useState<string>('ROLE');
    const [sendType, setSendType] = useState<string>('TO');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

    // UNS Rule Configuration
    const [enviaWeb, setEnviaWeb] = useState(false);
    const [enviaEmail, setEnviaEmail] = useState(true);
    const [areaDestino, setAreaDestino] = useState('');

    // Modal state
    const [membersModalOpened, setMembersModalOpened] = useState(false);
    const [modalRoleId, setModalRoleId] = useState<number | null>(null);
    const [modalRoleMembers, setModalRoleMembers] = useState<User[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);

    // Confirm modal state
    const [deleteModalOpened, setDeleteModalOpened] = useState(false);
    const [recipientToDelete, setRecipientToDelete] = useState<number | null>(null);

    useEffect(() => {
        loadCatalogs();
        loadRecipients(event.id_evento);
    }, [event]);

    // Reset selections when changing type
    useEffect(() => {
        setSelectedItems(new Set());
        setSearchTerm('');
    }, [addType]);

    const loadCatalogs = async () => {
        try {
            const [u, r] = await Promise.all([rbacService.getUsers(), rbacService.getRoles()]);
            setUsers(u);
            setRoles(r);
        } catch (error) {
            console.error(error);
        }
    };

    const loadRecipients = async (eventId: number) => {
        try {
            setLoading(true);
            const data = await notificationService.getRecipients(eventId);
            setRecipients(data);
        } catch (error) {
            showToast({ type: 'error', message: "Error al cargar destinatarios" });
        } finally {
            setLoading(false);
        }
    };

    const handleViewRoleMembers = async (roleId: number) => {
        try {
            setModalRoleId(roleId);
            setMembersLoading(true);
            setMembersModalOpened(true);
            const members = await rbacService.getUsersByRole(roleId);
            setModalRoleMembers(members);
        } catch (error) {
            showToast({ type: 'error', message: "Error al cargar usuarios del rol" });
            setMembersModalOpened(false);
        } finally {
            setMembersLoading(false);
        }
    };

    const handleToggleItem = (id: number) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedItems(newSet);
    };

    const handleAddSelected = async () => {
        if (selectedItems.size === 0) {
            return showToast({ type: 'error', message: "Seleccione al menos un elemento" });
        }

        try {
            setActionLoading(true);
            const promises = Array.from(selectedItems).map(id => {
                const payload = {
                    idUsuario: addType === 'USER' ? id : undefined,
                    idRol: addType === 'ROLE' ? id : undefined,
                    tipoEnvio: sendType,
                    enviaWeb,
                    enviaEmail,
                    areaDestino
                };
                return notificationService.addRecipient(event.id_evento, payload);
            });

            await Promise.all(promises);
            showToast({ type: 'success', message: `${selectedItems.size} regla(s) configurada(s)` });
            loadRecipients(event.id_evento);
            setSelectedItems(new Set());
        } catch (error: any) {
            const msg = error.response?.data?.message || "Error al agregar";
            showToast({ type: 'error', message: msg });
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemove = (id: number) => {
        setRecipientToDelete(id);
        setDeleteModalOpened(true);
    };

    const confirmDelete = async () => {
        if (!recipientToDelete) return;
        try {
            setActionLoading(true);
            await notificationService.removeRecipient(recipientToDelete);
            showToast({ type: 'success', message: "Eliminado correctamente" });
            loadRecipients(event.id_evento);
        } catch (error) {
            showToast({ type: 'error', message: "Error al eliminar" });
        } finally {
            setActionLoading(false);
            setDeleteModalOpened(false);
            setRecipientToDelete(null);
        }
    };

    const filteredItems = useMemo(() => {
        if (addType === 'ROLE') {
            return roles.filter(r => r.nombre_rol.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return users.filter(u =>
            u.nombre_usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.nombre_real.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.correo_electronico && u.correo_electronico.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [addType, searchTerm, roles, users]);

    const selectedRole = roles.find(r => r.id_rol === modalRoleId);

    return (
        <Container fluid py="md">
            <PageHeader 
                title="Configuración de Destinatarios"
                subtitle={`Evento: ${event.codigo_evento} - ${event.descripcion}`}
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Administración', onClick: onBack },
                    { label: 'Notificaciones', onClick: onBack },
                    { label: 'Destinatarios' }
                ]}
            />

            <Grid mt="xl" gutter="lg">
                <Grid.Col span={{ base: 12, md: 5 }}>
                    <Card withBorder radius="md" padding="lg" h="100%">
                        <Group mb="md">
                            <IconUserPlus size={20} color="var(--mantine-color-blue-6)" />
                            <Text fw={700}>Agregar Destinatarios</Text>
                        </Group>

                        <Stack gap="md">
                            <Grid gutter="sm">
                                <Grid.Col span={6}>
                                    <Select 
                                        label="Tipo Destinatario"
                                        value={addType}
                                        onChange={(val) => setAddType(val || 'ROLE')}
                                        data={[
                                            { value: 'ROLE', label: 'Rol (Grupo)' },
                                            { value: 'USER', label: 'Usuario Individual' }
                                        ]}
                                        radius="md"
                                    />
                                </Grid.Col>
                                <Grid.Col span={6}>
                                    <Select 
                                        label="Modo de Envío"
                                        value={sendType}
                                        onChange={(val) => setSendType(val || 'TO')}
                                        disabled={!enviaEmail}
                                        data={[
                                            { value: 'TO', label: 'Para (TO)' },
                                            { value: 'CC', label: 'Copia (CC)' },
                                            { value: 'BCC', label: 'Copia Oculta (BCC)' }
                                        ]}
                                        radius="md"
                                    />
                                </Grid.Col>
                            </Grid>

                            <Group grow align="flex-end">
                                <Stack gap={4}>
                                    <Text size="xs" fw={700} c="dimmed">Canales Habilitados</Text>
                                    <Group>
                                        <Checkbox 
                                            label="Email" 
                                            checked={enviaEmail} 
                                            onChange={(e) => setEnviaEmail(e.currentTarget.checked)} 
                                        />
                                        <Checkbox 
                                            label="Web" 
                                            checked={enviaWeb} 
                                            onChange={(e) => setEnviaWeb(e.currentTarget.checked)} 
                                        />
                                    </Group>
                                </Stack>
                                <TextInput 
                                    label="Área Destino (Opcional)"
                                    placeholder="Ej: Lab, Bioq..."
                                    value={areaDestino}
                                    onChange={(e) => setAreaDestino(e.currentTarget.value)}
                                    radius="md"
                                />
                            </Group>

                            {enviaWeb && (
                                <Alert icon={<IconInfoCircle size={16} />} color="blue" radius="md" variant="light">
                                    El sistema generará notificaciones automáticas en la campanita para este evento.
                                </Alert>
                            )}

                            <Divider label="Selección de elementos" labelPosition="center" />

                            <TextInput 
                                placeholder={`Buscar ${addType === 'ROLE' ? 'rol' : 'usuario'}...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                                leftSection={<IconSearch size={16} />}
                                radius="md"
                            />

                            <Paper withBorder radius="md">
                                <ScrollArea h={300} p="xs">
                                    <Stack gap={4}>
                                        {filteredItems.map(item => {
                                            const id = addType === 'ROLE' ? (item as Role).id_rol : (item as User).id_usuario;
                                            const isSelected = selectedItems.has(id);
                                            const name = addType === 'ROLE' ? (item as Role).nombre_rol : (item as User).nombre_usuario;
                                            const sub = addType === 'USER' ? (item as User).correo_electronico : null;

                                            return (
                                                <Group 
                                                    key={id} 
                                                    wrap="nowrap" 
                                                    p="xs" 
                                                    onClick={() => handleToggleItem(id)}
                                                    style={{ 
                                                        cursor: 'pointer', 
                                                        borderRadius: 'var(--mantine-radius-sm)',
                                                        backgroundColor: isSelected ? 'var(--mantine-color-blue-light)' : 'transparent',
                                                        transition: 'background-color 0.1s ease'
                                                    }}
                                                >
                                                    <Checkbox 
                                                        checked={isSelected} 
                                                        onChange={() => {}} 
                                                        tabIndex={-1} 
                                                        styles={{ input: { cursor: 'pointer' } }}
                                                    />
                                                    <Stack gap={0} flex={1}>
                                                        <Text size="sm" fw={isSelected ? 600 : 400}>{name}</Text>
                                                        {sub && <Text size="xs" c="dimmed">{sub}</Text>}
                                                    </Stack>
                                                    {addType === 'ROLE' && (
                                                        <ActionIcon 
                                                            variant="light" 
                                                            onClick={(e) => { e.stopPropagation(); handleViewRoleMembers(id); }}
                                                            size="sm"
                                                        >
                                                            <IconUsers size={14} />
                                                        </ActionIcon>
                                                    )}
                                                </Group>
                                            );
                                        })}
                                        {filteredItems.length === 0 && (
                                            <Center py="xl">
                                                <Text size="sm" c="dimmed">No se encontraron resultados</Text>
                                            </Center>
                                        )}
                                    </Stack>
                                </ScrollArea>
                            </Paper>

                            <Button 
                                onClick={handleAddSelected} 
                                loading={actionLoading} 
                                disabled={selectedItems.size === 0}
                                fullWidth
                                radius="md"
                                leftSection={<IconUserPlus size={18} />}
                            >
                                Vincular Seleccionados ({selectedItems.size})
                            </Button>
                        </Stack>
                    </Card>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 7 }}>
                    <Card withBorder radius="md" padding="lg" h="100%">
                        <Group justify="space-between" mb="lg">
                            <Group>
                                <IconUsers size={20} color="var(--mantine-color-teal-6)" />
                                <Text fw={700}>Destinatarios Configurados</Text>
                            </Group>
                            <Badge variant="light" color="teal">{recipients.length} reglas</Badge>
                        </Group>

                        {loading ? (
                            <Center h={400}>
                                <Loader type="dots" />
                            </Center>
                        ) : (
                            <ScrollArea h={600}>
                                <Table verticalSpacing="sm">
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th>Tipo</Table.Th>
                                            <Table.Th>Destinatario</Table.Th>
                                            <Table.Th>Canales</Table.Th>
                                            <Table.Th w={50}></Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {recipients.map(rec => (
                                            <Table.Tr key={rec.id_relacion}>
                                                <Table.Td>
                                                    <Badge 
                                                        size="xs" 
                                                        variant="light" 
                                                        color={rec.id_rol ? 'indigo' : 'gray'}
                                                        leftSection={rec.id_rol ? <IconBriefcase size={10} /> : <IconUser size={10} />}
                                                    >
                                                        {rec.id_rol ? 'ROL' : 'USR'}
                                                    </Badge>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Stack gap={2}>
                                                        <Text size="sm" fw={600}>{rec.nombre_rol || rec.nombre_usuario}</Text>
                                                        {rec.area_destino && <Text size="xs" c="dimmed">Área: {rec.area_destino}</Text>}
                                                    </Stack>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Group gap={4}>
                                                        {rec.envia_email && (
                                                            <Tooltip label={`Modo: ${rec.tipo_envio}`}>
                                                                <Badge size="xs" color="teal" variant="outline" leftSection={<IconMail size={10} />}>
                                                                    {rec.tipo_envio}
                                                                </Badge>
                                                            </Tooltip>
                                                        )}
                                                        {rec.envia_web && (
                                                            <Badge size="xs" color="blue" variant="outline" leftSection={<IconBell size={10} />}>
                                                                WEB
                                                            </Badge>
                                                        )}
                                                    </Group>
                                                </Table.Td>
                                                <Table.Td>
                                                    <ActionIcon color="red" variant="subtle" onClick={() => handleRemove(rec.id_relacion)}>
                                                        <IconTrash size={16} />
                                                    </ActionIcon>
                                                </Table.Td>
                                            </Table.Tr>
                                        ))}
                                        {recipients.length === 0 && (
                                            <Table.Tr>
                                                <Table.Td colSpan={4}>
                                                    <Center py={100}>
                                                        <Stack align="center" gap="xs">
                                                            <IconUsers size={40} color="var(--mantine-color-gray-3)" />
                                                            <Text c="dimmed" size="sm">Sin destinatarios configurados</Text>
                                                        </Stack>
                                                    </Center>
                                                </Table.Td>
                                            </Table.Tr>
                                        )}
                                    </Table.Tbody>
                                </Table>
                            </ScrollArea>
                        )}
                    </Card>
                </Grid.Col>
            </Grid>

            {/* Modal: Role Members */}
            <Modal
                opened={membersModalOpened}
                onClose={() => setMembersModalOpened(false)}
                title={
                    <Group gap="xs">
                        <IconUsers size={20} />
                        <Text fw={700}>Usuarios del Rol: {selectedRole?.nombre_rol}</Text>
                    </Group>
                }
                size="lg"
                radius="md"
            >
                {membersLoading ? (
                    <Center py="xl"><Loader /></Center>
                ) : (
                    <Stack>
                        <Alert color="blue" variant="light">
                            {modalRoleMembers.length} usuario(s) activo(s) recibirán notificaciones a través de este rol.
                        </Alert>
                        <ScrollArea h={400}>
                            <Table verticalSpacing="xs">
                                <Table.Thead>
                                    <Table.Tr>
                                        <Table.Th>Usuario</Table.Th>
                                        <Table.Th>Correo</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {modalRoleMembers.map(member => (
                                        <Table.Tr key={member.id_usuario}>
                                            <Table.Td>
                                                <Stack gap={0}>
                                                    <Text size="sm" fw={600}>{member.nombre_usuario}</Text>
                                                    <Text size="xs" c="dimmed">{member.nombre_real}</Text>
                                                </Stack>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm">{member.correo_electronico || '-'}</Text>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                    {modalRoleMembers.length === 0 && (
                                        <Table.Tr>
                                            <Table.Td colSpan={2}>
                                                <Center py="xl">Este rol no tiene usuarios asignados actualmente.</Center>
                                            </Table.Td>
                                        </Table.Tr>
                                    )}
                                </Table.Tbody>
                            </Table>
                        </ScrollArea>
                    </Stack>
                )}
            </Modal>

            {/* Modal: Confirm Delete */}
            <Modal
                opened={deleteModalOpened}
                onClose={() => setDeleteModalOpened(false)}
                title="Confirmar eliminación"
                centered
                radius="md"
            >
                <Stack>
                    <Text size="sm">
                        ¿Está seguro que desea eliminar este destinatario? Esta regla de notificación dejará de aplicarse inmediatamente.
                    </Text>
                    <Group justify="flex-end" mt="md">
                        <Button variant="light" color="gray" onClick={() => setDeleteModalOpened(false)}>Cancelar</Button>
                        <Button color="red" loading={actionLoading} onClick={confirmDelete}>Eliminar regla</Button>
                    </Group>
                </Stack>
            </Modal>
        </Container>
    );
};
