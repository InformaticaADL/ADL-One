import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Container,
    Paper,
    Text,
    Button,
    Group,
    ActionIcon,
    Table,
    Checkbox,
    Badge,
    Loader,
    Stack,
    Select,
    Collapse,
    Box,
    Tooltip,
    Flex,
    Avatar,
    TextInput
} from '@mantine/core';
import {
    IconUsers,
    IconUser,
    IconShield,
    IconDeviceFloppy,
    IconPlus,
    IconX,
    IconEye,
    IconUserCheck,
    IconGitBranch,
    IconChevronDown,
    IconChevronUp,
    IconAlertTriangle,
    IconInfoCircle,
    IconSettings
} from '@tabler/icons-react';

import { ursService } from '../../../services/urs.service';
import { rbacService } from '../services/rbac.service';
import type { Role, User as UserType } from '../services/rbac.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';

interface RequestType {
    id_tipo: number;
    nombre: string;
    area_destino: string;
    estado: boolean;
}

type AccessType = 'ENVIO' | 'VISTA' | 'GESTION' | 'DERIVACION';

interface PermissionEntry {
    type: 'role' | 'user';
    id: number;
    name: string;
    ENVIO: boolean;
    VISTA: boolean;
    GESTION: boolean;
    DERIVACION: boolean;
    isNew?: boolean;
    membersLoaded?: boolean;
    members?: string[];
}

const ACCESS_LABELS: { key: AccessType; label: string; icon: React.ReactNode }[] = [
    { key: 'ENVIO',     label: 'Crear',   icon: <IconPlus size={14} /> },
    { key: 'VISTA',     label: 'Solo Ver', icon: <IconEye size={14} /> },
    { key: 'GESTION',   label: 'Accionar', icon: <IconUserCheck size={14} /> },
    { key: 'DERIVACION',label: 'Derivar',  icon: <IconGitBranch size={14} /> },
];

interface Props {
    requestType: RequestType;
    onBack: () => void;
}

const RequestTypePermissionsPage: React.FC<Props> = ({ requestType, onBack }) => {
    const { showToast } = useToast();

    const [entries, setEntries] = useState<PermissionEntry[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [users, setUsers] = useState<UserType[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Header edit states
    const [typeName, setTypeName] = useState(requestType.nombre);
    const [areaDestino, setAreaDestino] = useState(requestType.area_destino);
    const [isEditingHeader, setIsEditingHeader] = useState(false);

    // Expanded row state
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
    const [loadingMembersIdx, setLoadingMembersIdx] = useState<number | null>(null);

    // User→roles map
    const [userRolesMap, setUserRolesMap] = useState<Map<number, number[]>>(new Map());

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [perms, allRoles, allUsers] = await Promise.all([
                ursService.getPermissions(requestType.id_tipo),
                rbacService.getRoles(),
                rbacService.getUsers(),
            ]);

            setRoles(allRoles);
            setUsers(allUsers);

            const map = new Map<string, PermissionEntry>();
            perms.forEach((p: any) => {
                let key: string;
                if (p.id_rol) {
                    key = `role_${p.id_rol}`;
                    if (!map.has(key)) map.set(key, { type: 'role', id: p.id_rol, name: p.nombre_rol || `Rol ${p.id_rol}`, ENVIO: false, VISTA: false, GESTION: false, DERIVACION: false });
                } else if (p.id_usuario) {
                    key = `user_${p.id_usuario}`;
                    if (!map.has(key)) map.set(key, { type: 'user', id: p.id_usuario, name: p.nombre_real || p.nombre_usuario || `Usuario ${p.id_usuario}`, ENVIO: false, VISTA: false, GESTION: false, DERIVACION: false });
                } else return;
                map.get(key)![p.tipo_acceso as AccessType] = true;
            });

            setEntries(Array.from(map.values()));
        } catch {
            showToast({ type: 'error', message: 'Error al cargar permisos' });
        } finally {
            setLoading(false);
        }
    }, [requestType.id_tipo, showToast]);

    useEffect(() => { load(); }, [load]);

    const rolesInList = useMemo(() => new Set(entries.filter(e => e.type === 'role').map(e => e.id)), [entries]);

    const userOverlapsWithRole = (userId: number): boolean => {
        const userRoles = userRolesMap.get(userId) || [];
        return userRoles.some(rId => rolesInList.has(rId));
    };

    const toggleCell = (idx: number, access: AccessType) =>
        setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [access]: !e[access] } : e));

    const removeEntry = (idx: number) => {
        setEntries(prev => prev.filter((_, i) => i !== idx));
        if (expandedIdx === idx) setExpandedIdx(null);
    };

    const loadMembers = async (idx: number, entry: PermissionEntry) => {
        if (expandedIdx === idx) {
            setExpandedIdx(null);
            return;
        }
        if (entry.membersLoaded) {
            setExpandedIdx(idx);
            return;
        }
        try {
            setLoadingMembersIdx(idx);
            let memberNames: string[] = [];
            if (entry.type === 'role') {
                const roleUsers = await rbacService.getUsersByRole(entry.id);
                memberNames = roleUsers.map(u => u.nombre_real || u.nombre_usuario);
            } else {
                const userRoles = await rbacService.getUserRoles(entry.id);
                memberNames = userRoles.map(r => r.nombre_rol);
                setUserRolesMap(prev => new Map(prev).set(entry.id, userRoles.map(r => r.id_rol)));
            }
            setEntries(prev => prev.map((e, i) => i === idx ? { ...e, membersLoaded: true, members: memberNames } : e));
            setExpandedIdx(idx);
        } catch {
            showToast({ type: 'error', message: 'Error al cargar detalles de la entidad' });
        } finally {
            setLoadingMembersIdx(null);
        }
    };

    const addEntry = async (type: 'role' | 'user', idValue: string | null) => {
        if (!idValue) return;
        const id = parseInt(idValue);
        const item = type === 'role' 
            ? roles.find(r => r.id_rol === id) 
            : users.find(u => u.id_usuario === id);
        
        if (!item) return;

        const name = type === 'role' ? (item as Role).nombre_rol : ((item as UserType).nombre_real || (item as UserType).nombre_usuario);
        const key = `${type}_${id}`;
        
        if (entries.some(e => `${e.type}_${e.id}` === key)) {
            showToast({ type: 'warning', message: 'Esta entidad ya está en la lista.' });
            return;
        }

        const newEntry: PermissionEntry = { type, id, name, ENVIO: false, VISTA: false, GESTION: false, DERIVACION: false, isNew: true };
        setEntries(prev => [...prev, newEntry]);

        if (type === 'user') {
            try {
                const userRoles = await rbacService.getUserRoles(id);
                setUserRolesMap(prev => new Map(prev).set(id, userRoles.map(r => r.id_rol)));
                setEntries(prev => prev.map(e =>
                    e.type === 'user' && e.id === id
                        ? { ...e, membersLoaded: true, members: userRoles.map(r => r.nombre_rol) }
                        : e
                ));
            } catch { /* silent */ }
        }
    };

    const save = async () => {
        try {
            setSaving(true);

            // 1. Update Basic Info if changed
            if (typeName !== requestType.nombre || areaDestino !== requestType.area_destino) {
                await ursService.createUpdateType(requestType.id_tipo, {
                    nombre: typeName,
                    area_destino: areaDestino,
                    estado: requestType.estado
                    // formulario_config and workflow_config remain the same as they are not edited here
                });
            }

            // 2. Update Permissions
            const currentPerms = await ursService.getPermissions(requestType.id_tipo);
            const toAdd: any[] = [];
            const toDeleteIds: number[] = [];

            entries.forEach(entry => {
                (['ENVIO', 'VISTA', 'GESTION', 'DERIVACION'] as AccessType[]).forEach(access => {
                    const existing = currentPerms.find((p: any) =>
                        entry.type === 'role' ? p.id_rol === entry.id && p.tipo_acceso === access
                                               : p.id_usuario === entry.id && p.tipo_acceso === access
                    );
                    if (entry[access] && !existing) toAdd.push({ ...(entry.type === 'role' ? { id_rol: entry.id } : { id_usuario: entry.id }), tipo_acceso: access });
                    else if (!entry[access] && existing) toDeleteIds.push(existing.id_permiso_sol);
                });
            });

            currentPerms.forEach((p: any) => {
                const key = p.id_rol ? `role_${p.id_rol}` : `user_${p.id_usuario}`;
                if (!entries.some(e => `${e.type}_${e.id}` === key) && !toDeleteIds.includes(p.id_permiso_sol)) {
                    toDeleteIds.push(p.id_permiso_sol);
                }
            });

            await Promise.allSettled([
                ...toAdd.map(item => ursService.addPermission(requestType.id_tipo, item)),
                ...toDeleteIds.map(id => ursService.removePermission(id)),
            ]);
            showToast({ type: 'success', message: '¡Cambios guardados correctamente!' });
            setIsEditingHeader(false);
            load();
        } catch {
            showToast({ type: 'error', message: 'Error al guardar los cambios' });
        } finally {
            setSaving(false);
        }
    };

    const rolesOptions = roles
        .filter(r => !entries.some(e => e.type === 'role' && e.id === r.id_rol))
        .map(r => ({ value: r.id_rol.toString(), label: r.nombre_rol }));

    const usersOptions = users
        .filter(u => !entries.some(e => e.type === 'user' && e.id === u.id_usuario))
        .map(u => {
            const hasOver = userOverlapsWithRole(u.id_usuario);
            return { 
                value: u.id_usuario.toString(), 
                label: (u.nombre_real || u.nombre_usuario) + (hasOver ? ' (⚠️ Rol ya activo)' : '')
            };
        });

    return (
        <Container fluid py="md">
            <PageHeader
                title={`Permisos: ${typeName}`}
                subtitle={`Define quién puede crear, ver, gestionar o derivar el trámite "${typeName}".`}
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Administración', onClick: onBack },
                    { label: 'Solicitudes URS', onClick: onBack },
                    { label: 'Configuración de Permisos' }
                ]}
                rightSection={
                    <Button 
                        leftSection={saving ? <Loader size={14} color="white" /> : <IconDeviceFloppy size={16} />}
                        onClick={save}
                        disabled={saving}
                        radius="md"
                        color="blue"
                    >
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                }
            />

            <Stack gap="lg" mt="xl">
                {/* Header Section / Basic Info Edit */}
                <Paper withBorder p="md" radius="md" bg="gray.0">
                    <Group justify="space-between" align="flex-end">
                        <Box style={{ flex: 1 }}>
                            {isEditingHeader ? (
                                <Group gap="md">
                                    <TextInput 
                                        label="Nombre del Trámite"
                                        placeholder="Ej: Solicitud de Vacaciones"
                                        value={typeName}
                                        onChange={(e) => setTypeName(e.currentTarget.value)}
                                        style={{ flex: 2 }}
                                        radius="md"
                                    />
                                    <TextInput 
                                        label="Área Responsable"
                                        placeholder="Ej: Recursos Humanos"
                                        value={areaDestino}
                                        onChange={(e) => setAreaDestino(e.currentTarget.value)}
                                        style={{ flex: 1 }}
                                        radius="md"
                                    />
                                    <ActionIcon variant="light" color="red" size="lg" mb={2} onClick={() => setIsEditingHeader(false)} radius="md">
                                        <IconX size={18} />
                                    </ActionIcon>
                                </Group>
                            ) : (
                                <Box>
                                    <Group gap="xs" mb={4}>
                                        <Text size="sm" fw={700} c="dark.4">Información Básica del Trámite</Text>
                                        <Tooltip label="Editar nombre y área">
                                            <ActionIcon variant="subtle" color="blue" size="sm" onClick={() => setIsEditingHeader(true)}>
                                                <IconSettings size={14} />
                                            </ActionIcon>
                                        </Tooltip>
                                    </Group>
                                    <Group gap="xl">
                                        <Box>
                                            <Text size="xs" c="dimmed" fw={500}>Nombre del Trámite</Text>
                                            <Text size="sm" fw={600}>{typeName}</Text>
                                        </Box>
                                        <Box>
                                            <Text size="xs" c="dimmed" fw={500}>Área Destino / Responsable</Text>
                                            <Badge variant="outline" color="blue" radius="sm" mt={2}>{areaDestino}</Badge>
                                        </Box>
                                        <Box>
                                            <Text size="xs" c="dimmed" fw={500}>Estado actual</Text>
                                            <Badge variant="light" color={requestType.estado ? 'teal' : 'red'} radius="sm" mt={2}>
                                                {requestType.estado ? 'ACTIVO' : 'INACTIVO'}
                                            </Badge>
                                        </Box>
                                    </Group>
                                </Box>
                            )}
                        </Box>
                    </Group>
                </Paper>

                {loading ? (
                    <Flex justify="center" align="center" h={300}>
                        <Loader color="blue" size="lg" />
                    </Flex>
                ) : (
                    <Paper withBorder radius="lg" shadow="sm" style={{ overflow: 'hidden' }}>
                        <Table verticalSpacing="sm">
                            <Table.Thead bg="gray.0">
                                <Table.Tr>
                                    <Table.Th>
                                        <Group gap="xs" c="gray.6">
                                            <IconShield size={14} />
                                            <Text size="xs" fw={700} tt="uppercase" lts="0.05em">Entidad</Text>
                                        </Group>
                                    </Table.Th>
                                    {ACCESS_LABELS.map(a => (
                                        <Table.Th key={a.key} style={{ width: 115 }}>
                                            <Flex direction="column" align="center" justify="center" gap={2} c="gray.6">
                                                <Box c="gray.5" style={{ display: 'flex' }}>{a.icon}</Box>
                                                <Text size="10px" fw={700} tt="uppercase" lts="0.04em" ta="center">{a.label}</Text>
                                            </Flex>
                                        </Table.Th>
                                    ))}
                                    <Table.Th style={{ width: 60 }} />
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {entries.length === 0 ? (
                                    <Table.Tr>
                                        <Table.Td colSpan={6} py={60}>
                                            <Stack align="center" gap="xs">
                                                <IconUsers size={40} style={{ opacity: 0.2 }} />
                                                <Text fw={600} size="sm" c="dimmed">Sin entidades configuradas</Text>
                                                <Text size="xs" c="dimmed">Usa los selectores de abajo para añadir roles o usuarios.</Text>
                                            </Stack>
                                        </Table.Td>
                                    </Table.Tr>
                                ) : entries.map((entry, idx) => {
                                    const isExpanded = expandedIdx === idx;
                                    const isLoadingThis = loadingMembersIdx === idx;
                                    const hasOverlap = entry.type === 'user' && userOverlapsWithRole(entry.id);

                                    return (
                                        <React.Fragment key={`${entry.type}_${entry.id}`}>
                                            <Table.Tr bg={entry.isNew ? 'yellow.0' : undefined}>
                                                <Table.Td>
                                                    <Group gap="sm" wrap="nowrap">
                                                        <Avatar 
                                                            radius="md" 
                                                            color={entry.type === 'role' ? 'blue' : 'teal'} 
                                                            variant="light"
                                                            size={32}
                                                        >
                                                            {entry.type === 'role' ? <IconUsers size={16} /> : <IconUser size={16} />}
                                                        </Avatar>
                                                        <Box style={{ flex: 1, minWidth: 0 }}>
                                                            <Group gap={6} wrap="nowrap">
                                                                <Text size="sm" fw={600} truncate>{entry.name}</Text>
                                                                {entry.isNew && (
                                                                    <Badge size="xs" color="yellow" variant="light">NUEVO</Badge>
                                                                )}
                                                                {hasOverlap && (
                                                                    <Tooltip label="Este usuario ya está cubierto por un rol activo">
                                                                        <Badge 
                                                                            size="xs" 
                                                                            color="orange" 
                                                                            variant="outline" 
                                                                            leftSection={<IconAlertTriangle size={10} />}
                                                                        >
                                                                            Rol Activo
                                                                        </Badge>
                                                                    </Tooltip>
                                                                )}
                                                            </Group>
                                                            <Group gap="xs" mt={2}>
                                                                <Text size="10px" c="dimmed" fw={700}>{entry.type === 'role' ? '👥 ROL' : '👤 USUARIO'}</Text>
                                                                <Button 
                                                                    variant="transparent" 
                                                                    color="gray" 
                                                                    size="compact-xs" 
                                                                    leftSection={isLoadingThis ? <Loader size={10} /> : isExpanded ? <IconChevronUp size={10} /> : <IconChevronDown size={10} />}
                                                                    onClick={() => loadMembers(idx, entry)}
                                                                    styles={{ label: { fontSize: '10px' }}}
                                                                >
                                                                    {entry.type === 'role' ? 'Usuarios' : 'Roles'}
                                                                </Button>
                                                            </Group>
                                                        </Box>
                                                    </Group>
                                                </Table.Td>
                                                
                                                {ACCESS_LABELS.map(a => (
                                                    <Table.Td key={a.key}>
                                                        <Flex justify="center" align="center">
                                                            <Checkbox 
                                                                checked={entry[a.key]} 
                                                                onChange={() => toggleCell(idx, a.key)} 
                                                                size="sm"
                                                                color="blue"
                                                                styles={{ input: { cursor: 'pointer' }}}
                                                            />
                                                        </Flex>
                                                    </Table.Td>
                                                ))}

                                                <Table.Td>
                                                    <Flex justify="center">
                                                        <ActionIcon variant="subtle" color="red" onClick={() => removeEntry(idx)}>
                                                            <IconX size={16} />
                                                        </ActionIcon>
                                                    </Flex>
                                                </Table.Td>
                                            </Table.Tr>
                                            
                                            {/* Expandable area */}
                                            <Table.Tr style={{ display: isExpanded ? 'table-row' : 'none' }}>
                                                <Table.Td colSpan={6} p={0}>
                                                    <Collapse in={isExpanded}>
                                                        <Box px="xl" pb="sm" pt={0}>
                                                            <Paper withBorder p="xs" radius="md" bg="gray.0">
                                                                <Text size="10px" fw={800} c="gray.6" tt="uppercase" mb={6} lts="0.03em">
                                                                    {entry.type === 'role' ? 'Usuarios asignados a este rol' : 'Roles que posee el usuario'}
                                                                </Text>
                                                                <Flex gap={5} wrap="wrap">
                                                                    {entry.members && entry.members.length > 0 ? entry.members.map((m, i) => (
                                                                        <Badge 
                                                                            key={i} 
                                                                            variant="outline" 
                                                                            color={entry.type === 'role' ? 'blue' : 'teal'} 
                                                                            size="sm" 
                                                                            leftSection={entry.type === 'role' ? <IconUser size={10} /> : <IconUsers size={10} />}
                                                                        >
                                                                            {m}
                                                                        </Badge>
                                                                    )) : (
                                                                        <Text size="xs" c="dimmed" fs="italic">No se encontraron datos asociados.</Text>
                                                                    )}
                                                                </Flex>
                                                            </Paper>
                                                        </Box>
                                                    </Collapse>
                                                </Table.Td>
                                            </Table.Tr>
                                        </React.Fragment>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>

                        {/* Footer Adder */}
                        <Box p="md" bg="gray.0" style={{ borderTop: '1px solid #f1f5f9' }}>
                            <Group align="flex-start" gap="md">
                                <Select 
                                    placeholder="Añadir Rol..."
                                    searchable
                                    data={rolesOptions}
                                    nothingFoundMessage="No se encontraron roles"
                                    leftSection={<IconUsers size={14} color="#228be6" />}
                                    size="sm"
                                    radius="md"
                                    value={null}
                                    onChange={(val) => addEntry('role', val)}
                                    styles={{ input: { backgroundColor: 'white' }}}
                                />
                                <Select 
                                    placeholder="Añadir Usuario..."
                                    searchable
                                    data={usersOptions}
                                    nothingFoundMessage="No se encontraron usuarios"
                                    leftSection={<IconUser size={14} color="#12b886" />}
                                    size="sm"
                                    radius="md"
                                    value={null}
                                    onChange={(val) => addEntry('user', val)}
                                    styles={{ input: { backgroundColor: 'white' }}}
                                />
                                <Box style={{ flex: 1 }}>
                                    <Group gap="xs" mt={5}>
                                        <IconInfoCircle size={14} color="#94a3b8" />
                                        <Text size="xs" c="dimmed" fw={500}>
                                            Los <strong>roles</strong> gestionan permisos de grupos. Los <strong>usuarios</strong> definen excepciones puntuales.
                                        </Text>
                                    </Group>
                                </Box>
                            </Group>
                        </Box>
                    </Paper>
                )}
            </Stack>
        </Container>
    );
};

export default RequestTypePermissionsPage;
