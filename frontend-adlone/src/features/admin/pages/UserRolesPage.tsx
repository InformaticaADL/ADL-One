import React, { useEffect, useState } from 'react';
import { 
    Stack, 
    Group, 
    Text, 
    TextInput, 
    Table, 
    Button, 
    Paper, 
    LoadingOverlay,
    Box,
    Avatar
} from '@mantine/core';
import { 
    IconSearch, 
    IconShieldLock, 
    IconUser
} from '@tabler/icons-react';
import { rbacService } from '../services/rbac.service';
import type { User } from '../services/rbac.service';
import { UserRoleModal } from '../components/UserRoleModal';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';

interface Props {
    onBack?: () => void;
}

export const UserRolesPage: React.FC<Props> = ({ onBack }) => {
    const { showToast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await rbacService.getUsers();
            setUsers(data);
        } catch (error) {
            console.error('Error loading users:', error);
            showToast({ type: 'error', message: 'Error cargando usuarios' });
        } finally {
            setLoading(false);
        }
    };

    const handleAssignClick = (user: User) => {
        setSelectedUser(user);
        setIsModalOpen(true);
    };

    const filteredUsers = users.filter(user =>
        user.nombre_usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.nombre_real && user.nombre_real.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <Box p="md" style={{ width: '100%' }}>
            <PageHeader
                title="Asignación de Roles"
                subtitle="Vincula roles de seguridad a cada integrante para definir sus permisos."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Administración', onClick: onBack },
                    { label: 'Informática', onClick: onBack },
                    { label: 'Asignación de Roles' }
                ]}
                rightSection={
                    <TextInput 
                        placeholder="Buscar por nombre o usuario..."
                        leftSection={<IconSearch size={16} />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.currentTarget.value)}
                        radius="md"
                        w={300}
                    />
                }
            />

            <Stack gap="lg" mt="xl">
                {/* Users Table */}
                <Paper withBorder radius="md" shadow="sm" pos="relative">
                    <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
                    <Table.ScrollContainer minWidth={600}>
                        <Table verticalSpacing="md" highlightOnHover>
                            <Table.Thead bg="gray.0">
                                <Table.Tr>
                                    <Table.Th>Usuario</Table.Th>
                                    <Table.Th>Nombre Completo</Table.Th>
                                    <Table.Th ta="right">Acción</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {filteredUsers.length > 0 ? (
                                    filteredUsers.map((user) => (
                                        <Table.Tr key={user.id_usuario}>
                                            <Table.Td>
                                                <Group gap="sm">
                                                    <Avatar color="blue" radius="xl" size="sm">
                                                        <IconUser size={16} />
                                                    </Avatar>
                                                    <Box>
                                                        <Text size="sm" fw={600}>{user.nombre_usuario}</Text>
                                                        <Text size="xs" c="dimmed">ID: {user.id_usuario}</Text>
                                                    </Box>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="sm">{user.nombre_real || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group justify="flex-end">
                                                    <Button
                                                        variant="light"
                                                        color="blue"
                                                        size="xs"
                                                        radius="md"
                                                        leftSection={<IconShieldLock size={14} />}
                                                        onClick={() => handleAssignClick(user)}
                                                    >
                                                        Asignar Roles
                                                    </Button>
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))
                                ) : (
                                    <Table.Tr>
                                        <Table.Td colSpan={3} ta="center" py="xl">
                                            <Text c="dimmed">
                                                {searchTerm ? 'No se encontraron usuarios coincidentes' : 'No hay usuarios en el sistema'}
                                            </Text>
                                        </Table.Td>
                                    </Table.Tr>
                                )}
                            </Table.Tbody>
                        </Table>
                    </Table.ScrollContainer>
                </Paper>
            </Stack>

            <UserRoleModal
                user={selectedUser}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedUser(null);
                }}
                onSuccess={() => {}}
            />
        </Box>
    );
};
