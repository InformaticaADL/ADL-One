import React, { useState, useEffect } from 'react';
import { 
    Stack, 
    Group, 
    Text, 
    Button, 
    TextInput, 
    Select, 
    Table, 
    Badge, 
    ActionIcon, 
    Paper, 
    Modal, 
    PasswordInput,
    Box,
    Checkbox,
    ScrollArea,
    LoadingOverlay,
    Tooltip,
    useMantineTheme,
    Avatar
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { 
    IconSearch, 
    IconPlus, 
    IconEdit, 
    IconKey, 
    IconBan, 
    IconCheck, 
    IconUser,
    IconMail,
    IconShield
} from '@tabler/icons-react';
import { rbacService, type User, type CreateUserData, type UpdateUserData, type Role } from '../services/rbac.service';
import { catalogosService } from '../../medio-ambiente/services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { PageHeader } from '../../../components/layout/PageHeader';

interface Props {
    onBack?: () => void;
}

export const UsersManagementPage: React.FC<Props> = ({ onBack }) => {
    const theme = useMantineTheme();
    const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
    const { showToast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [cargos, setCargos] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('active');

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    // Form states
    const [formData, setFormData] = useState<CreateUserData>({
        nombre_usuario: '',
        nombre_real: '',
        correo_electronico: '',
        id_cargo: undefined,
        clave_usuario: ''
    });
    const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
    const [roleSearchTerm, setRoleSearchTerm] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        loadUsers();
        loadRoles();
        loadCargos();
    }, []);

    const loadCargos = async () => {
        try {
            const data = await catalogosService.getCargos();
            setCargos(data);
        } catch (error) {
            console.error('Error loading cargos:', error);
        }
    };

    const loadUsers = async () => {
        try {
            setLoading(true);
            const data = await rbacService.getAllUsersWithStatus();
            setUsers(data);
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cargar usuarios' });
        } finally {
            setLoading(false);
        }
    };

    const loadRoles = async () => {
        try {
            const data = await rbacService.getRoles();
            setRoles(data);
        } catch (error) {
            console.error('Error loading roles:', error);
        }
    };

    const handleCreateUser = async () => {
        if (!formData.nombre_usuario || !formData.nombre_real || !formData.clave_usuario) {
            return showToast({ type: 'error', message: 'Complete los campos requeridos' });
        }

        try {
            setLoading(true);
            const newUser = await rbacService.createUser(formData);

            if (selectedRoles.length > 0) {
                await rbacService.assignRolesToUser(newUser.id_usuario, selectedRoles);
            }

            showToast({ type: 'success', message: 'Usuario creado exitosamente' });
            setShowCreateModal(false);
            resetForm();
            loadUsers();
        } catch (error: any) {
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al crear usuario' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateUser = async () => {
        if (!selectedUser) return;

        const updateData: UpdateUserData = {
            nombre_usuario: formData.nombre_usuario,
            nombre_real: formData.nombre_real,
            correo_electronico: formData.correo_electronico,
            id_cargo: formData.id_cargo
        };

        try {
            setLoading(true);
            await rbacService.updateUser(selectedUser.id_usuario, updateData);
            await rbacService.assignRolesToUser(selectedUser.id_usuario, selectedRoles);

            showToast({ type: 'success', message: 'Usuario actualizado exitosamente' });
            setShowEditModal(false);
            resetForm();
            loadUsers();
        } catch (error) {
            showToast({ type: 'error', message: 'Error al actualizar usuario' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (!selectedUser) return;
        if (!newPassword || newPassword !== confirmPassword) {
            return showToast({ type: 'error', message: 'Las contraseñas no coinciden' });
        }

        try {
            setLoading(true);
            await rbacService.updateUserPassword(selectedUser.id_usuario, newPassword);
            showToast({ type: 'success', message: 'Contraseña actualizada exitosamente' });
            setShowPasswordModal(false);
            setNewPassword('');
            setConfirmPassword('');
            setSelectedUser(null);
        } catch (error) {
            showToast({ type: 'error', message: 'Error al actualizar contraseña' });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async () => {
        if (!selectedUser) return;
        const newStatus = selectedUser.habilitado !== 'S';

        try {
            setLoading(true);
            await rbacService.toggleUserStatus(selectedUser.id_usuario, newStatus);
            showToast({
                type: 'success',
                message: `Usuario ${newStatus ? 'habilitado' : 'deshabilitado'} exitosamente`
            });
            setShowConfirmModal(false);
            setSelectedUser(null);
            loadUsers();
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cambiar estado del usuario' });
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        resetForm();
        setSelectedRoles([]);
        setShowCreateModal(true);
    };

    const openEditModal = async (user: User) => {
        setSelectedUser(user);
        setFormData({
            nombre_usuario: user.nombre_usuario,
            nombre_real: user.nombre_real,
            correo_electronico: user.correo_electronico || '',
            id_cargo: user.id_cargo,
            clave_usuario: ''
        });

        try {
            const userRoles = await rbacService.getUserRoles(user.id_usuario);
            setSelectedRoles(userRoles.map(r => r.id_rol));
        } catch (error) {
            console.error('Error loading user roles:', error);
            setSelectedRoles([]);
        }

        setShowEditModal(true);
    };

    const openPasswordModal = (user: User) => {
        setSelectedUser(user);
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordModal(true);
    };

    const openConfirmModal = (user: User) => {
        setSelectedUser(user);
        setShowConfirmModal(true);
    };

    const resetForm = () => {
        setFormData({
            nombre_usuario: '',
            nombre_real: '',
            correo_electronico: '',
            id_cargo: undefined,
            clave_usuario: ''
        });
        setSelectedRoles([]);
        setSelectedUser(null);
    };

    const toggleRole = (roleId: number) => {
        setSelectedRoles(prev =>
            prev.includes(roleId)
                ? prev.filter(id => id !== roleId)
                : [...prev, roleId]
        );
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch =
            user.nombre_usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.nombre_real.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.correo_electronico && user.correo_electronico.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus =
            filterStatus === 'all' ||
            (filterStatus === 'active' && user.habilitado === 'S') ||
            (filterStatus === 'inactive' && user.habilitado === 'N');

        return matchesSearch && matchesStatus;
    });

    return (
        <Box p={isMobile ? "xs" : "md"} style={{ width: '100%' }}>
            <PageHeader
                title="Gestión de Usuarios"
                subtitle="Administra accesos y roles del personal."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Administración', onClick: onBack },
                    { label: 'Usuarios' }
                ]}
                rightSection={
                    <Button 
                        leftSection={<IconPlus size={18} />}
                        onClick={openCreateModal}
                        radius="md"
                        color="blue"
                        fullWidth={isMobile}
                        mt={isMobile ? "md" : 0}
                    >
                        Nuevo Usuario
                    </Button>
                }
            />

            <Stack gap="lg" mt="xl">

                {/* Filters Section */}
                <Paper withBorder p="md" radius="md" shadow="sm">
                    <Group grow={!isMobile} align="flex-end">
                        <TextInput 
                            label="Búsqueda"
                            placeholder="Nombre or email..."
                            leftSection={<IconSearch size={16} />}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.currentTarget.value)}
                            radius="md"
                        />
                        <Select 
                            label="Estado"
                            value={filterStatus}
                            onChange={(val) => setFilterStatus(val || 'all')}
                            data={[
                                { value: 'all', label: 'Todos' },
                                { value: 'active', label: 'Solo Activos' },
                                { value: 'inactive', label: 'Solo Inactivos' }
                            ]}
                            radius="md"
                        />
                    </Group>
                </Paper>

                {/* Content Section */}
                <Box pos="relative">
                    <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
                    
                    {isMobile ? (
                        <Stack gap="sm">
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => (
                                    <Paper key={user.id_usuario} withBorder p="md" radius="md" shadow="xs">
                                        <Group justify="space-between" align="flex-start" mb="sm" wrap="nowrap">
                                            <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                                                <Avatar radius="md" color="blue" variant="light" size={40}>
                                                    <IconUser size={24} />
                                                </Avatar>
                                                <Box style={{ flex: 1, minWidth: 0 }}>
                                                    <Text size="sm" fw={700} truncate>{user.nombre_real}</Text>
                                                    <Text size="xs" c="dimmed">@{user.nombre_usuario}</Text>
                                                </Box>
                                            </Group>
                                            <Badge 
                                                color={user.habilitado === 'S' ? 'green' : 'red'} 
                                                variant="light"
                                                size="xs"
                                            >
                                                {user.habilitado === 'S' ? 'ACTIVO' : 'INACTIVO'}
                                            </Badge>
                                        </Group>

                                        <Stack gap={8} mb="md">
                                            <Group gap="xs">
                                                <IconMail size={14} color="gray" />
                                                <Text size="xs" c="blue" truncate>{user.correo_electronico || '-'}</Text>
                                            </Group>
                                            <Group gap="xs">
                                                <IconShield size={14} color="gray" />
                                                <Text size="xs" fw={500}>{user.nombre_cargo || 'Sin Cargo'}</Text>
                                            </Group>
                                            <Group gap={4} wrap="wrap">
                                                {user.roles?.map((rol, i) => (
                                                    <Badge key={i} size="xs" variant="gray" radius="xs">{rol}</Badge>
                                                ))}
                                            </Group>
                                        </Stack>

                                        <Group gap="xs" justify="flex-end" pt="xs" style={{ borderTop: '1px solid var(--mantine-color-gray-1)' }}>
                                            <ActionIcon variant="light" color="blue" onClick={() => openEditModal(user)} size="lg">
                                                <IconEdit size={18} />
                                            </ActionIcon>
                                            <ActionIcon variant="light" color="orange" onClick={() => openPasswordModal(user)} size="lg">
                                                <IconKey size={18} />
                                            </ActionIcon>
                                            <ActionIcon variant="light" color={user.habilitado === 'S' ? 'red' : 'green'} onClick={() => openConfirmModal(user)} size="lg">
                                                {user.habilitado === 'S' ? <IconBan size={18} /> : <IconCheck size={18} />}
                                            </ActionIcon>
                                        </Group>
                                    </Paper>
                                ))
                            ) : (
                                <Paper withBorder p="xl" radius="md" ta="center">
                                    <Text c="dimmed">No se encontraron usuarios</Text>
                                </Paper>
                            )}
                        </Stack>
                    ) : (
                        <Paper withBorder radius="md" shadow="sm">
                            <Table.ScrollContainer minWidth={800}>
                                <Table verticalSpacing="sm" highlightOnHover>
                                    <Table.Thead bg="gray.0">
                                        <Table.Tr>
                                            <Table.Th>Usuario</Table.Th>
                                            <Table.Th>Nombre Real</Table.Th>
                                            <Table.Th>Cargo</Table.Th>
                                            <Table.Th>Roles</Table.Th>
                                            <Table.Th>Email</Table.Th>
                                            <Table.Th ta="center">Estado</Table.Th>
                                            <Table.Th ta="right">Acciones</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {filteredUsers.length > 0 ? (
                                            filteredUsers.map((user) => (
                                                <Table.Tr key={user.id_usuario}>
                                                    <Table.Td>
                                                        <Group gap="sm">
                                                            <Avatar size="sm" color="blue" radius="xl" variant="light">
                                                                <IconUser size={14} />
                                                            </Avatar>
                                                            <Text size="sm" fw={600}>{user.nombre_usuario}</Text>
                                                        </Group>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Text size="sm">{user.nombre_real}</Text>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Text size="sm">{user.nombre_cargo || '-'}</Text>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Group gap={4}>
                                                            {user.roles?.map((rol, i) => (
                                                                <Badge key={i} size="xs" variant="gray" radius="xs">{rol}</Badge>
                                                            ))}
                                                        </Group>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Group gap="xs">
                                                            <IconMail size={14} color="gray" />
                                                            <Text size="xs" c="blue">{user.correo_electronico || '-'}</Text>
                                                        </Group>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Group justify="center">
                                                            <Badge 
                                                                color={user.habilitado === 'S' ? 'green' : 'red'} 
                                                                variant="light"
                                                                radius="sm"
                                                            >
                                                                {user.habilitado === 'S' ? 'Activo' : 'Inactivo'}
                                                            </Badge>
                                                        </Group>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Group gap={8} justify="flex-end">
                                                            <Tooltip label="Editar datos">
                                                                <ActionIcon variant="light" color="blue" onClick={() => openEditModal(user)}>
                                                                    <IconEdit size={16} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                            <Tooltip label="Cambiar contraseña">
                                                                <ActionIcon variant="light" color="orange" onClick={() => openPasswordModal(user)}>
                                                                    <IconKey size={16} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                            <Tooltip label={user.habilitado === 'S' ? 'Deshabilitar' : 'Habilitar'}>
                                                                <ActionIcon variant="light" color={user.habilitado === 'S' ? 'red' : 'green'} onClick={() => openConfirmModal(user)}>
                                                                    {user.habilitado === 'S' ? <IconBan size={16} /> : <IconCheck size={16} />}
                                                                </ActionIcon>
                                                            </Tooltip>
                                                        </Group>
                                                    </Table.Td>
                                                </Table.Tr>
                                            ))
                                        ) : (
                                            <Table.Tr>
                                                <Table.Td colSpan={7} ta="center" py="xl">
                                                    <Text c="dimmed">No se encontraron usuarios</Text>
                                                </Table.Td>
                                            </Table.Tr>
                                        )}
                                    </Table.Tbody>
                                </Table>
                            </Table.ScrollContainer>
                        </Paper>
                    )}
                </Box>
            </Stack>

            {/* Create / Edit Modal */}
            <Modal
                opened={showCreateModal || showEditModal}
                onClose={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    resetForm();
                }}
                title={
                    <Group gap="xs">
                        {showCreateModal ? <IconPlus size={20} /> : <IconEdit size={20} />}
                        <Text fw={700}>{showCreateModal ? 'Crear Nuevo Usuario' : 'Editar Usuario'}</Text>
                    </Group>
                }
                size="lg"
                radius="md"
                fullScreen={isMobile}
            >
                <Stack gap="md">
                    <Group grow={!isMobile}>
                        <TextInput 
                            label="Nombre de Usuario (Login)"
                            placeholder="ej: jdoe"
                            required
                            value={formData.nombre_usuario}
                            onChange={(e) => setFormData({...formData, nombre_usuario: e.currentTarget.value})}
                        />
                        <TextInput 
                            label="Nombre Real"
                            placeholder="ej: Juan Doe"
                            required
                            value={formData.nombre_real}
                            onChange={(e) => setFormData({...formData, nombre_real: e.currentTarget.value})}
                        />
                    </Group>
                    
                    <TextInput 
                        label="Correo Electrónico"
                        placeholder="usuario@ejemplo.com"
                        type="email"
                        value={formData.correo_electronico}
                        onChange={(e) => setFormData({...formData, correo_electronico: e.currentTarget.value})}
                    />

                    {showCreateModal && (
                        <PasswordInput 
                            label="Contraseña"
                            placeholder="Ingresa la contraseña inicial"
                            required
                            value={formData.clave_usuario}
                            onChange={(e) => setFormData({...formData, clave_usuario: e.currentTarget.value})}
                        />
                    )}

                    <Select 
                        label="Cargo"
                        placeholder="Selecciona el cargo"
                        data={cargos.map(c => ({ value: String(c.id_cargo), label: c.nombre_cargo }))}
                        value={formData.id_cargo ? String(formData.id_cargo) : undefined}
                        onChange={(val) => setFormData({...formData, id_cargo: val ? Number(val) : undefined})}
                        radius="md"
                        searchable
                        leftSection={<IconShield size={16} />}
                    />

                    <Box mt="md">
                        <Group justify="space-between" mb="xs">
                            <Text size="sm" fw={600} display="flex" style={{ alignItems: 'center', gap: '8px' }}>
                                <IconShield size={16} color="var(--mantine-color-blue-filled)" /> Roles Asignados
                            </Text>
                            <Text size="xs" c="dimmed">{selectedRoles.length} seleccionados</Text>
                        </Group>
                        
                        <TextInput 
                            placeholder="Filtrar roles..."
                            size="xs"
                            mb="xs"
                            leftSection={<IconSearch size={14} />}
                            value={roleSearchTerm}
                            onChange={(e) => setRoleSearchTerm(e.currentTarget.value)}
                        />

                        <Paper withBorder p="xs" radius="sm" bg="gray.0">
                            <ScrollArea h={isMobile ? 250 : 180} scrollbarSize={6}>
                                <Stack gap={4}>
                                    {roles
                                        .filter(r => 
                                            r.nombre_rol.toLowerCase().includes(roleSearchTerm.toLowerCase()) ||
                                            (r.descripcion && r.descripcion.toLowerCase().includes(roleSearchTerm.toLowerCase()))
                                        )
                                        .map((role) => (
                                            <Paper 
                                                key={role.id_rol} 
                                                p="xs" 
                                                radius="xs" 
                                                withBorder={selectedRoles.includes(role.id_rol)}
                                                style={{ 
                                                    cursor: 'pointer',
                                                    backgroundColor: selectedRoles.includes(role.id_rol) ? 'var(--mantine-color-blue-0)' : 'transparent',
                                                    borderColor: selectedRoles.includes(role.id_rol) ? 'var(--mantine-color-blue-2)' : 'transparent'
                                                }}
                                                onClick={() => toggleRole(role.id_rol)}
                                            >
                                                <Group gap="sm" wrap="nowrap">
                                                    <Checkbox 
                                                        checked={selectedRoles.includes(role.id_rol)} 
                                                        onChange={() => {}} // Controlled by Paper click
                                                        tabIndex={-1}
                                                        styles={{ input: { cursor: 'pointer' } }}
                                                    />
                                                    <Box>
                                                        <Text size="sm" fw={500}>{role.nombre_rol}</Text>
                                                        {role.descripcion && <Text size="xs" c="dimmed" lineClamp={1}>{role.descripcion}</Text>}
                                                    </Box>
                                                </Group>
                                            </Paper>
                                        ))
                                    }
                                </Stack>
                            </ScrollArea>
                        </Paper>
                    </Box>

                    <Group justify="flex-end" mt="xl">
                        <Button variant="subtle" color="gray" onClick={() => { setShowCreateModal(false); setShowEditModal(false); resetForm(); }}>
                            Cancelar
                        </Button>
                        <Button 
                            onClick={showCreateModal ? handleCreateUser : handleUpdateUser}
                            loading={loading}
                            radius="md"
                            color="blue"
                            fullWidth={isMobile}
                        >
                            {showCreateModal ? 'Crear Usuario' : 'Guardar Cambios'}
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            {/* Password Modal */}
            <Modal
                opened={showPasswordModal}
                onClose={() => { setShowPasswordModal(false); setSelectedUser(null); }}
                title={<Group gap="xs"><IconKey size={20} /><Text fw={700}>Cambiar Contraseña</Text></Group>}
                radius="md"
                fullScreen={isMobile}
            >
                <Stack gap="md">
                    <Text size="sm">Usuario: <strong>{selectedUser?.nombre_usuario}</strong></Text>
                    <PasswordInput 
                        label="Nueva Contraseña"
                        placeholder="Ingresa la nueva contraseña"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.currentTarget.value)}
                    />
                    <PasswordInput 
                        label="Confirmar Contraseña"
                        placeholder="Repite la contraseña"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                    />
                    <Group justify="flex-end" mt="lg">
                        <Button variant="subtle" color="gray" onClick={() => setShowPasswordModal(false)}>
                            Cancelar
                        </Button>
                        <Button color="orange" onClick={handleUpdatePassword} loading={loading} fullWidth={isMobile}>
                            Actualizar Contraseña
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            {/* Confirm Status Modal */}
            <ConfirmModal
                isOpen={showConfirmModal}
                title={selectedUser?.habilitado === 'S' ? 'Deshabilitar Usuario' : 'Habilitar Usuario'}
                message={
                    selectedUser?.habilitado === 'S'
                        ? `¿Está seguro que desea deshabilitar al usuario "${selectedUser?.nombre_usuario}"? No podrá acceder al sistema.`
                        : `¿Está seguro que desea habilitar al usuario "${selectedUser?.nombre_usuario}"? Podrá acceder nuevamente.`
                }
                confirmText={selectedUser?.habilitado === 'S' ? 'Deshabilitar' : 'Habilitar'}
                cancelText="Cancelar"
                confirmColor={selectedUser?.habilitado === 'S' ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-green-6)'}
                onConfirm={handleToggleStatus}
                onCancel={() => {
                    setShowConfirmModal(false);
                    setSelectedUser(null);
                }}
            />
        </Box>
    );
};
