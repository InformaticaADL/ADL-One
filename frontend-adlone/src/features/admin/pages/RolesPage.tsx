import React, { useEffect, useState } from 'react';
import { 
    Stack, 
    Group,
    Text, 
    Button, 
    Table, 
    Badge, 
    Paper, 
    LoadingOverlay,
    Box,
    useMantineTheme
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { 
    IconPlus, 
    IconEdit, 
    IconShieldLock
} from '@tabler/icons-react';
import { rbacService } from '../services/rbac.service';
import type { Role } from '../services/rbac.service';
import { RoleModal } from '../components/RoleModal';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';

interface Props {
    onBack?: () => void;
}

export const RolesPage: React.FC<Props> = ({ onBack }) => {
    const theme = useMantineTheme();
    const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
    const { showToast } = useToast();
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);

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

    return (
        <Box p={isMobile ? "xs" : "md"} style={{ width: '100%' }}>
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
                        leftSection={<IconPlus size={18} />}
                        onClick={handleCreate}
                        radius="md"
                        color="blue"
                        fullWidth={isMobile}
                        mt={isMobile ? "md" : 0}
                    >
                        Nuevo Rol
                    </Button>
                }
            />

            <Stack gap="lg" mt="xl">
                {/* Info Card */}
                <Paper withBorder p="md" radius="md" bg="blue.0">
                    <Group gap="xs" wrap={isMobile ? "wrap" : "nowrap"} align="flex-start">
                        <IconShieldLock size={20} color="var(--mantine-color-blue-6)" style={{ flexShrink: 0, marginTop: 2 }} />
                        <Text size="sm" fw={500} c="blue.9">
                            Los roles permiten agrupar permisos y asignarlos masivamente a los usuarios para facilitar la administración.
                        </Text>
                    </Group>
                </Paper>

                {/* Roles Content */}
                <Box pos="relative">
                    <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
                    
                    {isMobile ? (
                        <Stack gap="sm">
                            {roles.length > 0 ? (
                                roles.map((role) => (
                                    <Paper key={role.id_rol} withBorder p="md" radius="md" shadow="xs">
                                        <Group justify="space-between" align="center" mb="xs">
                                            <Group gap="sm" wrap="nowrap">
                                                <IconShieldLock size={20} color="var(--mantine-color-blue-filled)" />
                                                <Text fw={700} size="sm">{role.nombre_rol}</Text>
                                            </Group>
                                            <Badge color={role.estado ? 'green' : 'red'} variant="light" size="xs">
                                                {role.estado ? 'Activo' : 'Inactivo'}
                                            </Badge>
                                        </Group>
                                        <Text size="xs" c="dimmed" mb="md" lineClamp={2}>
                                            {role.descripcion || 'Sin descripción'}
                                        </Text>
                                        <Button
                                            variant="light"
                                            color="blue"
                                            fullWidth
                                            leftSection={<IconEdit size={14} />}
                                            onClick={() => handleEdit(role)}
                                            size="xs"
                                            radius="md"
                                        >
                                            Editar Permisos
                                        </Button>
                                    </Paper>
                                ))
                            ) : (
                                <Paper withBorder p="xl" radius="md" ta="center">
                                    <Text c="dimmed">No hay roles definidos</Text>
                                </Paper>
                            )}
                        </Stack>
                    ) : (
                        <Paper withBorder radius="md" shadow="sm">
                            <Table.ScrollContainer minWidth={600}>
                                <Table verticalSpacing="md" highlightOnHover>
                                    <Table.Thead bg="gray.0">
                                        <Table.Tr>
                                            <Table.Th>Nombre del Rol</Table.Th>
                                            <Table.Th>Descripción</Table.Th>
                                            <Table.Th ta="center">Estado</Table.Th>
                                            <Table.Th ta="right">Acciones</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {roles.length > 0 ? (
                                            roles.map((role) => (
                                                <Table.Tr key={role.id_rol}>
                                                    <Table.Td>
                                                        <Group gap="sm">
                                                            <IconShieldLock size={16} color="var(--mantine-color-blue-filled)" />
                                                            <Text size="sm" fw={600}>{role.nombre_rol}</Text>
                                                        </Group>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Text size="sm" c="dimmed" lineClamp={1}>
                                                            {role.descripcion || 'Sin descripción'}
                                                        </Text>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Group justify="center">
                                                            <Badge 
                                                                color={role.estado ? 'green' : 'red'} 
                                                                variant="light"
                                                                radius="sm"
                                                            >
                                                                {role.estado ? 'Activo' : 'Inactivo'}
                                                            </Badge>
                                                        </Group>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Group justify="flex-end" gap="xs">
                                                            <Button
                                                                variant="light"
                                                                color="blue"
                                                                size="xs"
                                                                leftSection={<IconEdit size={14} />}
                                                                onClick={() => handleEdit(role)}
                                                                radius="md"
                                                            >
                                                                Editar / Permisos
                                                            </Button>
                                                        </Group>
                                                    </Table.Td>
                                                </Table.Tr>
                                            ))
                                        ) : (
                                            <Table.Tr>
                                                <Table.Td colSpan={4} ta="center" py="xl">
                                                    <Text c="dimmed">No hay roles definidos</Text>
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

            <RoleModal
                isOpen={isModalOpen}
                role={selectedRole}
                onClose={() => setIsModalOpen(false)}
                onSuccess={loadRoles}
            />
        </Box>
    );
};
