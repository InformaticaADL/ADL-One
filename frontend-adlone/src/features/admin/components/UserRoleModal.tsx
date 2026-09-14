import React, { useEffect, useState } from 'react';
import {
    Modal,
    Typography,
    Button,
    Input,
    Checkbox,
    Divider,
    Card,
    Tag
} from 'antd';
import {
    IconSearch,
    IconShieldCheck,
    IconCheck
} from '@tabler/icons-react';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { rbacService } from '../services/rbac.service';
import type { Role, User } from '../services/rbac.service';
import { useToast } from '../../../contexts/ToastContext';

const { Text } = Typography;

interface Props {
    user: User | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const RoleListItem = React.memo(({
    role,
    isSelected,
    onToggle
}: {
    role: Role,
    isSelected: boolean,
    onToggle: (id: number) => void
}) => {
    return (
        <Card
            size="small"
            style={{
                cursor: 'pointer',
                transition: 'all 0.2s',
                backgroundColor: isSelected ? 'var(--app-accent-bg)' : undefined,
                borderColor: isSelected ? '#4dabf7' : undefined
            }}
            onClick={() => onToggle(role.id_rol)}
        >
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <Checkbox
                    checked={isSelected}
                    onChange={() => {}} // Handled by Card
                    tabIndex={-1}
                />
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                        <div>
                            <Text strong style={{ fontSize: 13, display: 'block' }}>{role.nombre_rol}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>{role.descripcion || 'Sin descripción'}</Text>
                        </div>
                        <Tag color={role.estado ? 'green' : 'red'}>
                            {role.estado ? 'Activo' : 'Inactivo'}
                        </Tag>
                    </div>
                </div>
            </div>
        </Card>
    );
});

export const UserRoleModal: React.FC<Props> = ({ user, isOpen, onClose, onSuccess }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { showToast } = useToast();
    const [roles, setRoles] = useState<Role[]>([]);
    const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
    const [roleSearchTerm, setRoleSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(roleSearchTerm), 200);
        return () => clearTimeout(id);
    }, [roleSearchTerm]);

    useEffect(() => {
        if (isOpen) {
            loadRoles();
            if (user) {
                loadUserRoles(user.id_usuario);
            } else {
                setSelectedRoleIds([]);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, user]);

    const loadRoles = async () => {
        try {
            const data = await rbacService.getRoles();
            setRoles(data);
        } catch (error) {
            console.error('Error loading roles:', error);
            showToast({ type: 'error', message: 'Error cargando roles' });
        }
    };

    const loadUserRoles = async (userId: number) => {
        try {
            const userRoles = await rbacService.getUserRoles(userId);
            setSelectedRoleIds(userRoles.map(r => r.id_rol));
        } catch (error) {
            console.error('Error loading user roles:', error);
        }
    };

    const toggleRole = React.useCallback((roleId: number) => {
        setSelectedRoleIds(prev =>
            prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
        );
    }, []);

    const handleSave = async () => {
        if (!user) return;

        setLoading(true);
        try {
            await rbacService.assignRolesToUser(user.id_usuario, selectedRoleIds);
            showToast({ type: 'success', message: 'Roles asignados correctamente' });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error assigning roles:', error);
            showToast({ type: 'error', message: 'Error asignando roles' });
        } finally {
            setLoading(false);
        }
    };

    const filteredRoles = React.useMemo(() => {
        const activeRoles = roles.filter(r => r.estado);
        if (!debouncedSearch.trim()) return activeRoles;
        const term = debouncedSearch.toLowerCase();
        return activeRoles.filter(role =>
            role.nombre_rol.toLowerCase().includes(term) ||
            (role.descripcion && role.descripcion.toLowerCase().includes(term))
        );
    }, [roles, debouncedSearch]);

    return (
        <Modal
            open={isOpen}
            onCancel={onClose}
            footer={null}
            width={isMobile ? '100%' : 640}
            style={isMobile ? { top: 0, maxWidth: '100vw', margin: 0 } : undefined}
            styles={{ body: { padding: 0 } }}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconShieldCheck size={22} color="#1677ff" />
                    <div>
                        <Text strong style={{ display: 'block' }}>Asignar Roles</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{user?.nombre_real || user?.nombre_usuario}</Text>
                    </div>
                </div>
            }
        >
            <div style={{ height: isMobile ? 'calc(100dvh - 180px)' : '60vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: isMobile ? 100 : 0 }}>
                        <div>
                            <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 16 }}>Seleccione los roles que desea asignar a este usuario.</Text>
                            <Input
                                placeholder="Buscar rol..."
                                prefix={<IconSearch size={16} style={{ color: 'var(--app-text-secondary)' }} />}
                                value={roleSearchTerm}
                                onChange={(e) => setRoleSearchTerm(e.target.value)}
                            />
                        </div>

                        <Divider>Roles Disponibles</Divider>

                        {roles.length === 0 ? (
                            <Text type="secondary" style={{ textAlign: 'center', display: 'block', padding: '32px 0' }}>No hay roles disponibles.</Text>
                        ) : filteredRoles.length === 0 ? (
                            <Text type="secondary" style={{ textAlign: 'center', display: 'block', padding: '32px 0' }}>No se encontraron roles.</Text>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {filteredRoles.map(role => (
                                    <RoleListItem
                                        key={role.id_rol}
                                        role={role}
                                        isSelected={selectedRoleIds.includes(role.id_rol)}
                                        onToggle={toggleRole}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Divider style={{ margin: 0 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 24, paddingBottom: isMobile ? 60 : 24, backgroundColor: 'var(--app-hover-bg)' }}>
                <Button onClick={onClose} block={isMobile}>
                    Cancelar / Descartar
                </Button>
                <Button
                    type="primary"
                    loading={loading}
                    onClick={handleSave}
                    icon={<IconCheck size={18} />}
                    block={isMobile}
                >
                    {loading ? 'Guardando...' : 'Guardar Asignaciones'}
                </Button>
            </div>
        </Modal>
    );
};
