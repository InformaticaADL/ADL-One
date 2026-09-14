import React, { useState, useEffect, useMemo } from 'react';
import {
    Typography,
    Button,
    Input,
    Select,
    Table,
    Tag,
    Card,
    Modal,
    Checkbox,
    Spin,
    Tooltip,
    Avatar
} from 'antd';
import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconSearch,
    IconPlus,
    IconEdit,
    IconKey,
    IconBan,
    IconCheck,
    IconUser,
    IconMail,
    IconShield,
    IconClock
} from '@tabler/icons-react';
import { rbacService, type User, type CreateUserData, type UpdateUserData, type Role } from '../services/rbac.service';
import { catalogosService } from '../../medio-ambiente/services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { PageHeader } from '../../../components/layout/PageHeader';

const { Text } = Typography;

interface Props {
    onBack?: () => void;
}

export const UsersManagementPage: React.FC<Props> = ({ onBack }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { showToast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [cargos, setCargos] = useState<any[]>([]);
    // RB-01: separar loading de listado vs operaciones en modal (evita el overlay blanco residual)
    const [loading, setLoading] = useState(false); // listado
    const [savingUser, setSavingUser] = useState(false); // modal de crear/editar/cambiar pass
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('active');
    const [filterRole, setFilterRole] = useState<string>('all');

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
            setSavingUser(true);
            const newUser = await rbacService.createUser(formData);

            if (selectedRoles.length > 0) {
                await rbacService.assignRolesToUser(newUser.id_usuario, selectedRoles);
            }

            showToast({ type: 'success', message: 'Usuario creado exitosamente' });
            setShowCreateModal(false);
            resetForm();
            loadUsers();
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Error al crear usuario';
            showToast({ type: 'error', message: msg });
        } finally {
            setSavingUser(false);
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
            setSavingUser(true);
            await rbacService.updateUser(selectedUser.id_usuario, updateData);
            await rbacService.assignRolesToUser(selectedUser.id_usuario, selectedRoles);

            showToast({ type: 'success', message: 'Usuario actualizado exitosamente' });
            setShowEditModal(false);
            resetForm();
            loadUsers();
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Error al actualizar usuario';
            showToast({ type: 'error', message: msg });
        } finally {
            setSavingUser(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (!selectedUser) return;
        if (!newPassword || newPassword !== confirmPassword) {
            return showToast({ type: 'error', message: 'Las contraseñas no coinciden' });
        }

        try {
            setSavingUser(true);
            await rbacService.updateUserPassword(selectedUser.id_usuario, newPassword);
            showToast({ type: 'success', message: 'Contraseña actualizada exitosamente' });
            setShowPasswordModal(false);
            setNewPassword('');
            setConfirmPassword('');
            setSelectedUser(null);
        } catch (error) {
            showToast({ type: 'error', message: 'Error al actualizar contraseña' });
        } finally {
            setSavingUser(false);
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
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Error al cambiar estado del usuario';
            showToast({ type: 'error', message: msg });
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
        setRoleSearchTerm('');
        setSelectedUser(null);
    };

    const toggleRole = (roleId: number) => {
        setSelectedRoles(prev =>
            prev.includes(roleId)
                ? prev.filter(id => id !== roleId)
                : [...prev, roleId]
        );
    };

    const filteredUsers = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return users.filter(user => {
            const matchesSearch =
                (user.nombre_usuario ?? '').toLowerCase().includes(term) ||
                (user.nombre_real ?? '').toLowerCase().includes(term) ||
                (user.correo_electronico ?? '').toLowerCase().includes(term);

            const matchesStatus =
                filterStatus === 'all' ||
                (filterStatus === 'active' && user.habilitado === 'S') ||
                (filterStatus === 'inactive' && user.habilitado === 'N');

            const matchesRole =
                filterRole === 'all' ||
                (user.roles && user.roles.includes(filterRole));

            return matchesSearch && matchesStatus && matchesRole;
        });
    }, [users, searchTerm, filterStatus, filterRole]);

    // RB-01: memoizar lista de roles filtrados para que no se recalcule en cada keystroke del form
    const memoizedRoles = useMemo(() => {
        const term = roleSearchTerm.toLowerCase();
        return roles
            .filter(r => r.estado && r.nombre_rol)
            .filter(r =>
                (r.nombre_rol ?? '').toLowerCase().includes(term) ||
                (r.descripcion && r.descripcion.toLowerCase().includes(term))
            );
    }, [roles, roleSearchTerm]);

    const columns = [
        {
            title: 'Usuario', key: 'usuario',
            render: (_: unknown, user: User) => (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Avatar size="small" style={{ backgroundColor: 'var(--app-accent-bg)', color: '#1677ff' }}>
                        <IconUser size={14} />
                    </Avatar>
                    <Text strong style={{ fontSize: 13 }}>{user.nombre_usuario}</Text>
                </div>
            ),
        },
        { title: 'Nombre Real', key: 'nombre_real', render: (_: unknown, user: User) => <Text style={{ fontSize: 13 }}>{user.nombre_real}</Text> },
        { title: 'Cargo', key: 'cargo', render: (_: unknown, user: User) => <Text style={{ fontSize: 13 }}>{user.nombre_cargo || '-'}</Text> },
        {
            title: 'Roles', key: 'roles',
            render: (_: unknown, user: User) => (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {user.roles?.map((rol, i) => <Tag key={i}>{rol}</Tag>)}
                </div>
            ),
        },
        {
            title: 'Email', key: 'email',
            render: (_: unknown, user: User) => (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <IconMail size={14} color="gray" />
                    <Text style={{ fontSize: 12, color: '#1c7ed6' }}>{user.correo_electronico || '-'}</Text>
                </div>
            ),
        },
        {
            title: 'Último Acceso', key: 'ultimo_acceso',
            render: (_: unknown, user: User) => (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <IconClock size={14} color="gray" />
                    <Text type="secondary" style={{ fontSize: 12 }}>{user.ultimo_acceso ?? 'Nunca'}</Text>
                </div>
            ),
        },
        {
            title: 'Estado', key: 'estado', align: 'center' as const,
            render: (_: unknown, user: User) => (
                <Tag color={user.habilitado === 'S' ? 'green' : 'red'}>
                    {user.habilitado === 'S' ? 'Activo' : 'Inactivo'}
                </Tag>
            ),
        },
        {
            title: 'Acciones', key: 'acciones', align: 'right' as const,
            render: (_: unknown, user: User) => (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Tooltip title="Editar datos">
                        <Button type="text" size="small" icon={<IconEdit size={16} />} onClick={() => openEditModal(user)} />
                    </Tooltip>
                    <Tooltip title="Cambiar contraseña">
                        <Button type="text" size="small" icon={<IconKey size={16} />} onClick={() => openPasswordModal(user)} />
                    </Tooltip>
                    <Tooltip title={user.habilitado === 'S' ? 'Deshabilitar' : 'Habilitar'}>
                        <Button
                            type="text"
                            size="small"
                            danger={user.habilitado === 'S'}
                            icon={user.habilitado === 'S' ? <IconBan size={16} /> : <IconCheck size={16} />}
                            onClick={() => openConfirmModal(user)}
                        />
                    </Tooltip>
                </div>
            ),
        },
    ];

    return (
        <div style={{ padding: isMobile ? 8 : 16, width: '100%' }}>
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
                        type="primary"
                        icon={<IconPlus size={18} />}
                        onClick={openCreateModal}
                        block={isMobile}
                        style={{ marginTop: isMobile ? 16 : 0 }}
                    >
                        Nuevo Usuario
                    </Button>
                }
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 32 }}>

                {/* Filters Section */}
                <Card size="small">
                    <div style={{ display: 'flex', gap: 16, flexWrap: isMobile ? 'wrap' : 'nowrap', alignItems: 'flex-end' }}>
                        <Field label="Búsqueda" style={{ flex: 1 }}>
                            <Input
                                placeholder="Nombre o email..."
                                prefix={<IconSearch size={16} />}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </Field>
                        <Field label="Estado" style={{ flex: 1 }}>
                            <Select
                                value={filterStatus}
                                onChange={(val) => setFilterStatus(val || 'all')}
                                options={[
                                    { value: 'all', label: 'Todos' },
                                    { value: 'active', label: 'Solo Activos' },
                                    { value: 'inactive', label: 'Solo Inactivos' }
                                ]}
                                style={{ width: '100%' }}
                            />
                        </Field>
                        <Field label="Rol" style={{ flex: 1 }}>
                            <Select
                                placeholder="Filtrar por rol..."
                                value={filterRole}
                                onChange={(val) => setFilterRole(val || 'all')}
                                options={[
                                    { value: 'all', label: 'Todos los roles' },
                                    ...roles
                                        .filter(r => r.nombre_rol)
                                        .map(r => ({ value: String(r.nombre_rol), label: String(r.nombre_rol) }))
                                ]}
                                showSearch
                                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                allowClear
                                style={{ width: '100%' }}
                            />
                        </Field>
                    </div>
                </Card>

                {/* Content Section */}
                <div style={{ position: 'relative' }}>
                    {loading && !showCreateModal && !showEditModal && !showPasswordModal && !showConfirmModal && (
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                            <Spin size="large" />
                        </div>
                    )}

                    {isMobile ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => (
                                    <Card key={user.id_usuario} size="small">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'nowrap' }}>
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', flex: 1, minWidth: 0 }}>
                                                <Avatar style={{ backgroundColor: 'var(--app-accent-bg)', color: '#1677ff' }} size={40}>
                                                    <IconUser size={24} />
                                                </Avatar>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <Text strong style={{ fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.nombre_real}</Text>
                                                    <Text type="secondary" style={{ fontSize: 12 }}>@{user.nombre_usuario}</Text>
                                                </div>
                                            </div>
                                            <Tag color={user.habilitado === 'S' ? 'green' : 'red'}>
                                                {user.habilitado === 'S' ? 'ACTIVO' : 'INACTIVO'}
                                            </Tag>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                <IconMail size={14} color="gray" />
                                                <Text style={{ fontSize: 12, color: '#1c7ed6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.correo_electronico || '-'}</Text>
                                            </div>
                                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                <IconShield size={14} color="gray" />
                                                <Text style={{ fontSize: 12, fontWeight: 500 }}>{user.nombre_cargo || 'Sin Cargo'}</Text>
                                            </div>
                                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                <IconClock size={14} color="gray" />
                                                <Text type="secondary" style={{ fontSize: 12 }}>{user.ultimo_acceso ?? 'Nunca'}</Text>
                                            </div>
                                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                {user.roles?.map((rol, i) => <Tag key={i}>{rol}</Tag>)}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--app-border)' }}>
                                            <Button type="text" icon={<IconEdit size={18} />} onClick={() => openEditModal(user)} />
                                            <Button type="text" icon={<IconKey size={18} />} onClick={() => openPasswordModal(user)} />
                                            <Button
                                                type="text"
                                                danger={user.habilitado === 'S'}
                                                icon={user.habilitado === 'S' ? <IconBan size={18} /> : <IconCheck size={18} />}
                                                onClick={() => openConfirmModal(user)}
                                            />
                                        </div>
                                    </Card>
                                ))
                            ) : (
                                <Card style={{ textAlign: 'center' }}>
                                    <Text type="secondary">No se encontraron usuarios</Text>
                                </Card>
                            )}
                        </div>
                    ) : (
                        <Card size="small" styles={{ body: { padding: 0 } }}>
                            <Table
                                rowKey="id_usuario"
                                columns={columns}
                                dataSource={filteredUsers}
                                pagination={false}
                                size="small"
                                scroll={{ x: 900 }}
                                locale={{ emptyText: <Text type="secondary">No se encontraron usuarios</Text> }}
                            />
                        </Card>
                    )}
                </div>
            </div>

            {/* Create / Edit Modal */}
            <Modal
                open={showCreateModal || showEditModal}
                onCancel={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    resetForm();
                }}
                title={
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {showCreateModal ? <IconPlus size={20} /> : <IconEdit size={20} />}
                        <Text strong>{showCreateModal ? 'Crear Nuevo Usuario' : 'Editar Usuario'}</Text>
                    </div>
                }
                width={isMobile ? '100%' : 640}
                style={isMobile ? { top: 0, maxWidth: '100%', margin: 0 } : undefined}
                footer={null}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', gap: 16, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                        <Field label="Nombre de Usuario (Login)" required style={{ flex: 1 }}>
                            <Input
                                placeholder="ej: jdoe"
                                value={formData.nombre_usuario}
                                onChange={(e) => setFormData({ ...formData, nombre_usuario: e.target.value })}
                            />
                        </Field>
                        <Field label="Nombre Real" required style={{ flex: 1 }}>
                            <Input
                                placeholder="ej: Juan Doe"
                                value={formData.nombre_real}
                                onChange={(e) => setFormData({ ...formData, nombre_real: e.target.value })}
                            />
                        </Field>
                    </div>

                    <Field label="Correo Electrónico">
                        <Input
                            placeholder="usuario@ejemplo.com"
                            type="email"
                            value={formData.correo_electronico}
                            onChange={(e) => setFormData({ ...formData, correo_electronico: e.target.value })}
                        />
                    </Field>

                    {showCreateModal && (
                        <Field label="Contraseña" required>
                            <Input.Password
                                placeholder="Ingresa la contraseña inicial"
                                value={formData.clave_usuario}
                                onChange={(e) => setFormData({ ...formData, clave_usuario: e.target.value })}
                                iconRender={(visible) => (visible ? <IconEyeOff size={16} /> : <IconEye size={16} />)}
                            />
                        </Field>
                    )}

                    <Field label="Cargo">
                        <Select
                            placeholder="Selecciona el cargo"
                            options={cargos.map(c => ({ value: String(c.id_cargo), label: c.nombre_cargo }))}
                            value={formData.id_cargo ? String(formData.id_cargo) : undefined}
                            onChange={(val) => setFormData({ ...formData, id_cargo: val ? Number(val) : undefined })}
                            showSearch
                            filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                            style={{ width: '100%' }}
                        />
                    </Field>

                    <div style={{ marginTop: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                            <Text strong style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <IconShield size={16} color="#1c7ed6" /> Roles Asignados
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>{selectedRoles.length} seleccionados</Text>
                        </div>

                        <Input
                            placeholder="Filtrar roles..."
                            size="small"
                            style={{ marginBottom: 8 }}
                            prefix={<IconSearch size={14} />}
                            value={roleSearchTerm}
                            onChange={(e) => setRoleSearchTerm(e.target.value)}
                        />

                        <Card size="small" style={{ backgroundColor: 'var(--app-hover-bg)' }} styles={{ body: { padding: 8 } }}>
                            <div style={{ height: isMobile ? 250 : 180, overflowY: 'auto' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {memoizedRoles.map((role) => {
                                        const checked = selectedRoles.includes(role.id_rol);
                                        return (
                                            <div
                                                key={role.id_rol}
                                                style={{
                                                    padding: 8, borderRadius: 4, cursor: 'pointer',
                                                    border: `1px solid ${checked ? '#a5d8ff' : 'transparent'}`,
                                                    backgroundColor: checked ? 'var(--app-accent-bg)' : 'transparent',
                                                }}
                                                onClick={() => toggleRole(role.id_rol)}
                                            >
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
                                                    <Checkbox checked={checked} onChange={() => {}} onClick={(e) => e.stopPropagation()} />
                                                    <div>
                                                        <Text style={{ fontSize: 13, fontWeight: 500 }}>{role.nombre_rol}</Text>
                                                        {role.descripcion && (
                                                            <Text type="secondary" style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role.descripcion}</Text>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
                        <Button type="text" onClick={() => { setShowCreateModal(false); setShowEditModal(false); resetForm(); }}>
                            Cancelar
                        </Button>
                        <Button
                            type="primary"
                            onClick={showCreateModal ? handleCreateUser : handleUpdateUser}
                            loading={savingUser}
                            block={isMobile}
                        >
                            {showCreateModal ? 'Crear Usuario' : 'Guardar Cambios'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Password Modal */}
            <Modal
                open={showPasswordModal}
                onCancel={() => { setShowPasswordModal(false); setSelectedUser(null); }}
                title={<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><IconKey size={20} /><Text strong>Cambiar Contraseña</Text></div>}
                width={isMobile ? '100%' : 480}
                style={isMobile ? { top: 0, maxWidth: '100%', margin: 0 } : undefined}
                footer={null}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Text style={{ fontSize: 13 }}>Usuario: <strong>{selectedUser?.nombre_usuario}</strong></Text>
                    <Field label="Nueva Contraseña">
                        <Input.Password
                            placeholder="Ingresa la nueva contraseña"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            iconRender={(visible) => (visible ? <IconEyeOff size={16} /> : <IconEye size={16} />)}
                        />
                    </Field>
                    <Field label="Confirmar Contraseña">
                        <Input.Password
                            placeholder="Repite la contraseña"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            iconRender={(visible) => (visible ? <IconEyeOff size={16} /> : <IconEye size={16} />)}
                        />
                    </Field>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                        <Button type="text" onClick={() => setShowPasswordModal(false)}>
                            Cancelar
                        </Button>
                        <Button danger type="primary" onClick={handleUpdatePassword} loading={savingUser} block={isMobile}>
                            Actualizar Contraseña
                        </Button>
                    </div>
                </div>
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
                confirmColor={selectedUser?.habilitado === 'S' ? '#e03131' : '#2f9e44'}
                onConfirm={handleToggleStatus}
                onCancel={() => {
                    setShowConfirmModal(false);
                    setSelectedUser(null);
                }}
            />
        </div>
    );
};

function Field({ label, required, style, children }: { label: string; required?: boolean; style?: React.CSSProperties; children: React.ReactNode }) {
    return (
        <div style={style}>
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>
                {label}{required && <span style={{ color: '#e03131' }}> *</span>}
            </Text>
            {children}
        </div>
    );
}

export default UsersManagementPage;
