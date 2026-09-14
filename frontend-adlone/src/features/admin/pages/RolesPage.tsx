import React, { useEffect, useState } from 'react';
import {
    Typography,
    Button,
    Table,
    Tag,
    Card,
    Spin,
    Tooltip
} from 'antd';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconPlus,
    IconEdit,
    IconShieldLock,
    IconToggleLeft,
    IconToggleRight
} from '@tabler/icons-react';
import { rbacService } from '../services/rbac.service';
import type { Role } from '../services/rbac.service';
import { RoleModal } from '../components/RoleModal';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';

const { Text } = Typography;

interface Props {
    onBack?: () => void;
}

export const RolesPage: React.FC<Props> = ({ onBack }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { showToast } = useToast();
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [confirmRole, setConfirmRole] = useState<Role | null>(null);
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const [affectedUsersCount, setAffectedUsersCount] = useState<number | null>(null);

    useEffect(() => {
        loadRoles();
    }, []);

    const loadRoles = async () => {
        setLoading(true);
        try {
            const data = await rbacService.getRoles();
            setRoles(data);
        } catch (error) {
            console.error('Error loading roles:', error);
            showToast({ type: 'error', message: 'Error cargando roles' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setSelectedRole(null);
        setIsModalOpen(true);
    };

    const handleEdit = (role: Role) => {
        setSelectedRole(role);
        setIsModalOpen(true);
    };

    const openConfirmToggle = async (role: Role) => {
        setConfirmRole(role);
        setAffectedUsersCount(null);
        if (role.estado) {
            try {
                const users = await rbacService.getUsersByRole(role.id_rol);
                setAffectedUsersCount(users.length);
            } catch {
                setAffectedUsersCount(null);
            }
        }
    };

    const handleToggleStatus = async () => {
        if (!confirmRole) return;
        setTogglingId(confirmRole.id_rol);
        try {
            await rbacService.toggleRoleStatus(confirmRole.id_rol, !confirmRole.estado);
            showToast({
                type: 'success',
                message: `Rol "${confirmRole.nombre_rol}" ${!confirmRole.estado ? 'activado' : 'desactivado'} correctamente`
            });
            loadRoles();
        } catch {
            showToast({ type: 'error', message: 'Error al cambiar estado del rol' });
        } finally {
            setTogglingId(null);
            setConfirmRole(null);
            setAffectedUsersCount(null);
        }
    };

    const columns = [
        {
            title: 'Nombre del Rol', key: 'nombre',
            render: (_: unknown, role: Role) => (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <IconShieldLock size={16} color={role.estado ? '#1677ff' : 'var(--app-border)'} />
                    <Text strong={role.estado} type={role.estado ? undefined : 'secondary'} style={{ fontSize: 13 }}>{role.nombre_rol}</Text>
                </div>
            ),
        },
        {
            title: 'Descripción', key: 'descripcion',
            render: (_: unknown, role: Role) => <Text type="secondary" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role.descripcion || 'Sin descripción'}</Text>,
        },
        {
            title: 'Estado', key: 'estado', align: 'center' as const,
            render: (_: unknown, role: Role) => <Tag color={role.estado ? 'green' : 'red'}>{role.estado ? 'Activo' : 'Inactivo'}</Tag>,
        },
        {
            title: 'Acciones', key: 'acciones', align: 'right' as const,
            render: (_: unknown, role: Role) => (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Button size="small" icon={<IconEdit size={14} />} onClick={() => handleEdit(role)}>
                        Editar / Permisos
                    </Button>
                    <Tooltip title={role.estado ? 'Desactivar rol' : 'Activar rol'}>
                        <Button
                            size="small"
                            danger={role.estado}
                            style={!role.estado ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}
                            icon={role.estado ? <IconToggleLeft size={14} /> : <IconToggleRight size={14} />}
                            onClick={() => openConfirmToggle(role)}
                            loading={togglingId === role.id_rol}
                        >
                            {role.estado ? 'Desactivar' : 'Activar'}
                        </Button>
                    </Tooltip>
                </div>
            ),
        },
    ];

    return (
        <div style={{ padding: isMobile ? 8 : 16, width: '100%' }}>
            <PageHeader
                title="Administración de Roles"
                subtitle="Gestiona los perfiles de acceso y permisos."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Administración', onClick: onBack },
                    { label: 'Informática', onClick: onBack },
                    { label: 'Roles de Sistema' }
                ]}
                rightSection={
                    <Button
                        type="primary"
                        icon={<IconPlus size={18} />}
                        onClick={handleCreate}
                        block={isMobile}
                        style={{ marginTop: isMobile ? 16 : 0 }}
                    >
                        Nuevo Rol
                    </Button>
                }
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 32 }}>
                <Card size="small" style={{ backgroundColor: 'var(--app-accent-bg)' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: isMobile ? 'wrap' : 'nowrap', alignItems: 'flex-start' }}>
                        <IconShieldLock size={20} color="#1c7ed6" style={{ flexShrink: 0, marginTop: 2 }} />
                        <Text style={{ fontSize: 13, color: '#1864ab' }}>
                            Los roles permiten agrupar permisos y asignarlos masivamente a los usuarios para facilitar la administración.
                        </Text>
                    </div>
                </Card>

                <div style={{ position: 'relative' }}>
                    {loading && (
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.6)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Spin />
                        </div>
                    )}

                    {isMobile ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {roles.length > 0 ? (
                                roles.map((role) => (
                                    <Card key={role.id_rol} size="small">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <IconShieldLock size={20} color="#1677ff" />
                                                <Text strong style={{ fontSize: 13 }}>{role.nombre_rol}</Text>
                                            </div>
                                            <Tag color={role.estado ? 'green' : 'red'}>{role.estado ? 'Activo' : 'Inactivo'}</Tag>
                                        </div>
                                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
                                            {role.descripcion || 'Sin descripción'}
                                        </Text>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <Button
                                                size="small"
                                                style={{ flex: 1 }}
                                                icon={<IconEdit size={14} />}
                                                onClick={() => handleEdit(role)}
                                            >
                                                Editar / Permisos
                                            </Button>
                                            <Button
                                                size="small"
                                                danger={role.estado}
                                                style={!role.estado ? { color: '#2f9e44', borderColor: '#2f9e44' } : undefined}
                                                icon={role.estado ? <IconToggleLeft size={14} /> : <IconToggleRight size={14} />}
                                                onClick={() => openConfirmToggle(role)}
                                                loading={togglingId === role.id_rol}
                                            >
                                                {role.estado ? 'Desactivar' : 'Activar'}
                                            </Button>
                                        </div>
                                    </Card>
                                ))
                            ) : (
                                <Card style={{ textAlign: 'center' }}>
                                    <Text type="secondary">No hay roles definidos</Text>
                                </Card>
                            )}
                        </div>
                    ) : (
                        <Card styles={{ body: { padding: 0 } }}>
                            <Table
                                rowKey="id_rol"
                                columns={columns}
                                dataSource={roles}
                                pagination={false}
                                scroll={{ x: 600 }}
                                locale={{ emptyText: <Text type="secondary">No hay roles definidos</Text> }}
                            />
                        </Card>
                    )}
                </div>
            </div>

            <RoleModal
                isOpen={isModalOpen}
                role={selectedRole}
                onClose={() => setIsModalOpen(false)}
                onSuccess={loadRoles}
            />

            <ConfirmModal
                isOpen={!!confirmRole}
                title={confirmRole?.estado ? 'Desactivar Rol' : 'Activar Rol'}
                message={
                    confirmRole?.estado
                        ? `¿Desactivar el rol "${confirmRole?.nombre_rol}"? ${affectedUsersCount !== null ? `${affectedUsersCount} usuario${affectedUsersCount !== 1 ? 's' : ''} ${affectedUsersCount !== 1 ? 'perderán' : 'perderá'} sus permisos asociados y serán desconectados.` : 'Los usuarios que lo tengan asignado perderán sus permisos asociados.'}`
                        : `¿Activar el rol "${confirmRole?.nombre_rol}"? Los usuarios que lo tengan asignado recuperarán sus permisos.`
                }
                confirmText={confirmRole?.estado ? 'Desactivar' : 'Activar'}
                cancelText="Cancelar"
                confirmColor={confirmRole?.estado ? '#e03131' : '#2f9e44'}
                onConfirm={handleToggleStatus}
                onCancel={() => { setConfirmRole(null); setAffectedUsersCount(null); }}
            />
        </div>
    );
};
