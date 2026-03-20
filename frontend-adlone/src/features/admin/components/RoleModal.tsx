import React, { useEffect, useState, useMemo } from 'react';
import { 
    Modal, 
    Stack, 
    Group, 
    TextInput, 
    Text, 
    Button, 
    Tabs, 
    ScrollArea, 
    Checkbox, 
    Paper, 
    Box, 
    Divider,
    Collapse,
    Grid,
    Badge,
    ActionIcon,
    Tooltip,
    Title
} from '@mantine/core';
import { 
    IconSearch, 
    IconShield, 
    IconInfoCircle, 
    IconChevronRight, 
    IconChevronDown,
    IconCheck,
    IconX,
    IconWorld,
    IconBuildingHospital,
    IconMicroscope,
    IconFlask,
    IconSettings,
    IconChartBar,
    IconLeaf
} from '@tabler/icons-react';
import { rbacService } from '../services/rbac.service';
import type { Role, Permission } from '../services/rbac.service';
import { useToast } from '../../../contexts/ToastContext';

interface Props {
    role: Role | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const RoleModal: React.FC<Props> = ({ role, isOpen, onClose, onSuccess }) => {
    const { showToast } = useToast();
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [loading, setLoading] = useState(false);

    // Permissions Management
    const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
    const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);

    // UI States
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<string | null>('GENERAL');
    const [expandedSubmodules, setExpandedSubmodules] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (isOpen) {
            loadPermissions();
            if (role) {
                setNombre(role.nombre_rol);
                setDescripcion(role.descripcion);
                loadRolePermissions(role.id_rol);
            } else {
                setNombre('');
                setDescripcion('');
                setSelectedPermissions([]);
            }
        }
    }, [isOpen, role]);

    const loadPermissions = async () => {
        try {
            const perms = await rbacService.getAllPermissions();
            setAllPermissions(perms);
        } catch (error) {
            console.error('Error loading permissions:', error);
            showToast({ type: 'error', message: 'Error cargando permisos' });
        }
    };

    const loadRolePermissions = async (roleId: number) => {
        try {
            const perms = await rbacService.getRolePermissions(roleId);
            setSelectedPermissions(perms.map(p => p.id_permiso));
        } catch (error) {
            console.error('Error loading role permissions:', error);
        }
    };

    const handleSave = async () => {
        if (!nombre) {
            showToast({ type: 'warning', message: 'El nombre es obligatorio' });
            return;
        }

        setLoading(true);
        try {
            let savedRole = role;

            if (!savedRole) {
                savedRole = await rbacService.createRole(nombre, descripcion);
            }

            if (savedRole) {
                await rbacService.assignPermissionsToRole(savedRole.id_rol, selectedPermissions);
                showToast({ type: 'success', message: 'Rol guardado correctamente' });
                onSuccess();
                onClose();
            }
        } catch (error) {
            console.error('Error saving role:', error);
            showToast({ type: 'error', message: 'Error al guardar rol' });
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = (id: number) => {
        setSelectedPermissions(prev => 
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const toggleSelectAllCategory = (perms: Permission[]) => {
        const allIds = perms.map(p => p.id_permiso);
        const allSelected = allIds.every(id => selectedPermissions.includes(id));

        if (allSelected) {
            setSelectedPermissions(prev => prev.filter(id => !allIds.includes(id)));
        } else {
            setSelectedPermissions(prev => {
                const newIds = allIds.filter(id => !prev.includes(id));
                return [...prev, ...newIds];
            });
        }
    };

    const filteredPermissions = allPermissions.filter(p =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.modulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.submodulo && p.submodulo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        p.codigo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const hierarchicalPermissions = useMemo(() => {
        const groups: Record<string, Record<string, Permission[]>> = {};

        filteredPermissions.forEach(p => {
            let mod = p.modulo || 'Otros';
            let sub = p.submodulo || 'General';

            if (['MA_A_REPORTES', 'MA_A_REPORTES_DETALLE', 'MA_A_REPORTES_REVISION'].includes(p.codigo)) {
                mod = 'Medio Ambiente';
                sub = 'Reportes';
            }

            if (!groups[mod]) groups[mod] = {};
            if (!groups[mod][sub]) groups[mod][sub] = [];
            groups[mod][sub].push(p);
        });

        return groups;
    }, [filteredPermissions]);

    const moduleIcons: Record<string, React.ReactNode> = {
        'Informática': <IconSettings size={16} />,
        'General': <IconWorld size={16} />,
        'Medio Ambiente': <IconLeaf size={16} />,
        'Administración': <IconBuildingHospital size={16} />,
        'Laboratory': <IconFlask size={16} />,
        'Microscopía': <IconMicroscope size={16} />,
        'Calidad': <IconChartBar size={16} />,
        'Otros': <IconInfoCircle size={16} />
    };

    const getModuleIcon = (name: string) => {
        const found = Object.keys(moduleIcons).find(key => name.toLowerCase().includes(key.toLowerCase()));
        return found ? moduleIcons[found] : <IconShield size={16} />;
    };

    const toggleSubmodule = (mod: string, sub: string) => {
        const key = `${mod}:${sub}`;
        setExpandedSubmodules(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <Modal
            opened={isOpen}
            onClose={onClose}
            size="85%"
            title={
                <Group gap="xs">
                    <IconShield size={22} color="var(--mantine-color-blue-filled)" />
                    <Stack gap={0}>
                        <Text fw={700}>{role ? 'Configurar Rol / Permisos' : 'Crear Nuevo Rol de Acceso'}</Text>
                        <Text size="xs" c="dimmed">{role ? `Editando: ${role.nombre_rol}` : 'Define capacidades del sistema'}</Text>
                    </Stack>
                </Group>
            }
            radius="md"
            styles={{ body: { padding: 0 } }}
        >
            <Box h="75vh" display="flex" style={{ overflow: 'hidden' }}>
                <Tabs 
                    orientation="vertical" 
                    value={activeTab} 
                    onChange={setActiveTab}
                    variant="pills"
                    styles={{
                        root: { display: 'flex', width: '100%', borderTop: '1px solid var(--mantine-color-gray-2)' },
                        list: { 
                            width: 280, 
                            borderRight: '1px solid var(--mantine-color-gray-2)',
                            backgroundColor: 'var(--mantine-color-gray-0)',
                            padding: '12px'
                        },
                        panel: { flex: 1, padding: '24px', overflowY: 'auto' },
                        tab: { 
                            justifyContent: 'flex-start',
                            marginBottom: '4px',
                            fontWeight: 600,
                            padding: '10px 12px'
                        }
                    }}
                >
                    <Tabs.List>
                        <TextInput 
                            placeholder="Buscar permisos..."
                            leftSection={<IconSearch size={14} />}
                            size="xs"
                            mb="md"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.currentTarget.value)}
                            radius="md"
                        />

                        <Tabs.Tab value="GENERAL" leftSection={<IconInfoCircle size={16} />}>
                            Info. General
                        </Tabs.Tab>

                        <Divider my="sm" label="Módulos" labelPosition="center" />

                        <ScrollArea style={{ height: 'calc(75vh - 180px)' }} scrollbarSize={4}>
                            {Object.entries(hierarchicalPermissions).map(([moduleName, submods]) => {
                                const modulePerms = Object.values(submods).flat();
                                const selectedInModule = modulePerms.filter(p => selectedPermissions.includes(p.id_permiso)).length;
                                
                                return (
                                    <Tabs.Tab 
                                        key={moduleName} 
                                        value={moduleName} 
                                        leftSection={getModuleIcon(moduleName)}
                                        rightSection={
                                            selectedInModule > 0 && (
                                                <Badge size="xs" circle color="blue">{selectedInModule}</Badge>
                                            )
                                        }
                                    >
                                        <Text size="sm" lineClamp={1}>{moduleName}</Text>
                                    </Tabs.Tab>
                                );
                            })}
                        </ScrollArea>
                    </Tabs.List>

                    <Tabs.Panel value="GENERAL">
                        <Stack gap="lg">
                            <Box>
                                <Title order={4} mb="md">Información del Rol</Title>
                                <Text size="sm" c="dimmed" mb="xl">
                                    Introduce el nombre y una descripción clara para que otros administradores sepan qué permite hacer este rol.
                                </Text>
                            </Box>

                            <TextInput 
                                label="Nombre del Rol"
                                placeholder="Ej: Administrador Maestro"
                                required
                                value={nombre}
                                onChange={(e) => setNombre(e.currentTarget.value)}
                                disabled={!!role}
                                radius="md"
                            />
                            <TextInput 
                                label="Descripción"
                                placeholder="Describe el alcance de este rol..."
                                value={descripcion}
                                onChange={(e) => setDescripcion(e.currentTarget.value)}
                                radius="md"
                            />

                            <Paper withBorder p="md" radius="md" bg="gray.0" mt="xl">
                                <Group gap="md">
                                    <IconShield color="var(--mantine-color-blue-6)" />
                                    <Box>
                                        <Text fw={600} size="sm">Resumen de Permisos</Text>
                                        <Text size="xs" c="dimmed">
                                            Este rol tiene actualmente <Text component="span" fw={700} c="blue">{selectedPermissions.length}</Text> permisos otorgados de un total de {allPermissions.length}.
                                        </Text>
                                    </Box>
                                </Group>
                            </Paper>
                        </Stack>
                    </Tabs.Panel>

                    {Object.entries(hierarchicalPermissions).map(([moduleName, submodules]) => (
                        <Tabs.Panel key={moduleName} value={moduleName}>
                            <Stack gap="xl">
                                <Group justify="space-between" align="flex-start">
                                    <Box>
                                        <Title order={3}>{moduleName}</Title>
                                        <Text size="sm" c="dimmed">Administra los accesos específicos para este módulo.</Text>
                                    </Box>
                                    <Button 
                                        variant="subtle" 
                                        size="xs"
                                        onClick={() => toggleSelectAllCategory(Object.values(submodules).flat())}
                                    >
                                        {Object.values(submodules).flat().every(p => selectedPermissions.includes(p.id_permiso)) 
                                            ? 'Desmarcar Todo' : 'Marcar Todo el Módulo'}
                                    </Button>
                                </Group>

                                <Stack gap="md">
                                    {Object.entries(submodules).map(([subName, perms]) => {
                                        const subId = `${moduleName}:${subName}`;
                                        const isExpanded = expandedSubmodules[subId] !== false;

                                        return (
                                            <Paper key={subName} withBorder p="md" radius="md">
                                                <Group 
                                                    justify="space-between" 
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => toggleSubmodule(moduleName, subName)}
                                                >
                                                    <Group gap="xs">
                                                        {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                                                        <Text fw={700} size="sm" style={{ textTransform: 'uppercase' }}>{subName}</Text>
                                                        <Badge size="xs" variant="outline">{perms.length} permisos</Badge>
                                                    </Group>
                                                    <Checkbox 
                                                        size="xs"
                                                        label="Marcar Submódulo"
                                                        checked={perms.every(p => selectedPermissions.includes(p.id_permiso))}
                                                        onClick={(e) => e.stopPropagation()}
                                                        onChange={() => toggleSelectAllCategory(perms)}
                                                    />
                                                </Group>

                                                <Collapse in={isExpanded}>
                                                    <Grid mt="md" gutter="md">
                                                        {perms.map(p => (
                                                            <Grid.Col key={p.id_permiso} span={{ base: 12, md: 6, lg: 4 }}>
                                                                <Paper 
                                                                    withBorder 
                                                                    p="xs" 
                                                                    radius="sm"
                                                                    bg={selectedPermissions.includes(p.id_permiso) ? 'blue.0' : 'white'}
                                                                    style={{ 
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s',
                                                                        borderColor: selectedPermissions.includes(p.id_permiso) ? 'var(--mantine-color-blue-3)' : undefined
                                                                    }}
                                                                    onClick={() => togglePermission(p.id_permiso)}
                                                                >
                                                                    <Group gap="xs" wrap="nowrap" align="flex-start">
                                                                        <Checkbox 
                                                                            checked={selectedPermissions.includes(p.id_permiso)}
                                                                            onChange={() => {}} // Done by Paper
                                                                            size="xs"
                                                                            mt={3}
                                                                        />
                                                                        <Box style={{ flex: 1 }}>
                                                                            <Text size="sm" fw={500} lineClamp={1}>{p.nombre}</Text>
                                                                            <Text size="xs" c="dimmed" ff="monospace">{p.codigo}</Text>
                                                                        </Box>
                                                                    </Group>
                                                                </Paper>
                                                            </Grid.Col>
                                                        ))}
                                                    </Grid>
                                                </Collapse>
                                            </Paper>
                                        );
                                    })}
                                </Stack>
                            </Stack>
                        </Tabs.Panel>
                    ))}
                </Tabs>
            </Box>

            <Divider />
            <Group justify="flex-end" p="md" bg="gray.0">
                <Button variant="subtle" color="gray" onClick={onClose}>
                    Cancelar / Descartar
                </Button>
                <Button 
                    color="adl-blue" 
                    loading={loading} 
                    onClick={handleSave}
                    leftSection={<IconCheck size={18} />}
                    radius="md"
                >
                    Guardar Rol y Permisos
                </Button>
            </Group>
        </Modal>
    );
};
