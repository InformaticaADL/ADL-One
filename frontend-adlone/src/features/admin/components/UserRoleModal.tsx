import React, { useEffect, useState } from 'react';
import { 
    Modal, 
    Stack, 
    Group, 
    Text, 
    Button, 
    TextInput, 
    Checkbox, 
    ScrollArea, 
    Divider, 
    Paper,
    Box,
    Badge
} from '@mantine/core';
import { 
    IconSearch, 
    IconShieldCheck,
    IconCheck
} from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
import { rbacService } from '../services/rbac.service';
import type { Role, User } from '../services/rbac.service';
import { useToast } from '../../../contexts/ToastContext';

interface Props {
    user: User | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const UserRoleModal: React.FC<Props> = ({ user, isOpen, onClose, onSuccess }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { showToast } = useToast();
    const [roles, setRoles] = useState<Role[]>([]);
    const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
    const [roleSearchTerm, setRoleSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadRoles();
            if (user) {
                loadUserRoles(user.id_usuario);
            } else {
                setSelectedRoleIds([]);
            }
        }
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

    const toggleRole = (roleId: number) => {
        setSelectedRoleIds(prev =>
            prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
        );
    };

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

    const filteredRoles = roles.filter(role =>
        role.nombre_rol.toLowerCase().includes(roleSearchTerm.toLowerCase()) ||
        (role.descripcion && role.descripcion.toLowerCase().includes(roleSearchTerm.toLowerCase()))
    );

    return (
        <Modal
            opened={isOpen}
            onClose={onClose}
            title={
                <Group gap="xs">
                    <IconShieldCheck size={22} color="var(--mantine-color-blue-filled)" />
                    <Stack gap={0}>
                        <Text fw={700}>Asignar Roles</Text>
                        <Text size="xs" c="dimmed">{user?.nombre_real || user?.nombre_usuario}</Text>
                    </Stack>
                </Group>
            }
            size={isMobile ? "100%" : "lg"}
            fullScreen={isMobile}
            radius="md"
            styles={{ body: { padding: 0 } }}
        >
            <Box h={isMobile ? "calc(100dvh - 180px)" : "60vh"} display="flex" style={{ flexDirection: 'column' }}>
                <ScrollArea style={{ flex: 1 }} p="md">
                    <Stack gap="md" pb={isMobile ? 100 : 0}>
                        <Box>
                            <Text size="sm" c="dimmed" mb="md">Seleccione los roles que desea asignar a este usuario.</Text>
                            <TextInput 
                                placeholder="Buscar rol..."
                                leftSection={<IconSearch size={16} />}
                                value={roleSearchTerm}
                                onChange={(e) => setRoleSearchTerm(e.currentTarget.value)}
                                radius="md"
                            />
                        </Box>

                        <Divider label="Roles Disponibles" labelPosition="center" />

                        {roles.length === 0 ? (
                            <Text ta="center" py="xl" c="dimmed">No hay roles disponibles.</Text>
                        ) : filteredRoles.length === 0 ? (
                            <Text ta="center" py="xl" c="dimmed">No se encontraron roles.</Text>
                        ) : (
                            <Stack gap="xs">
                                {filteredRoles.map(role => (
                                    <Paper 
                                        key={role.id_rol} 
                                        withBorder 
                                        p="md" 
                                        radius="md"
                                        bg={selectedRoleIds.includes(role.id_rol) ? 'blue.0' : 'white'}
                                        style={{ 
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            borderColor: selectedRoleIds.includes(role.id_rol) ? 'var(--mantine-color-blue-3)' : undefined
                                        }}
                                        onClick={() => toggleRole(role.id_rol)}
                                    >
                                        <Group gap="md" wrap="nowrap">
                                            <Checkbox 
                                                checked={selectedRoleIds.includes(role.id_rol)}
                                                onChange={() => {}} // Handled by Paper
                                                size="md"
                                            />
                                            <Box style={{ flex: 1 }}>
                                                <Group justify="space-between" align="flex-start" wrap="nowrap">
                                                    <Box>
                                                        <Text fw={600} size="sm">{role.nombre_rol}</Text>
                                                        <Text size="xs" c="dimmed" lineClamp={2}>{role.descripcion || 'Sin descripción'}</Text>
                                                    </Box>
                                                    <Badge 
                                                        size="xs" 
                                                        variant="light" 
                                                        color={role.estado ? 'green' : 'red'}
                                                    >
                                                        {role.estado ? 'Activo' : 'Inactivo'}
                                                    </Badge>
                                                </Group>
                                            </Box>
                                        </Group>
                                    </Paper>
                                ))}
                            </Stack>
                        )}
                    </Stack>
                </ScrollArea>
            </Box>

            <Divider />
            <Group justify="flex-end" p="lg" pb={isMobile ? 60 : 'lg'} bg="gray.0">
                <Button variant="subtle" color="gray" onClick={onClose} fullWidth={isMobile}>
                    Cancelar / Descartar
                </Button>
                <Button 
                    color="adl-blue" 
                    loading={loading} 
                    onClick={handleSave}
                    leftSection={<IconCheck size={18} />}
                    radius="md"
                    fullWidth={isMobile}
                >
                    {loading ? 'Guardando...' : 'Guardar Asignaciones'}
                </Button>
            </Group>
        </Modal>
    );
};
