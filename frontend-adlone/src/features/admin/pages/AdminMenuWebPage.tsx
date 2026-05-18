import React, { useEffect, useState, useMemo } from 'react';
import {
    Box,
    Card,
    Tabs,
    Table,
    Button,
    Group,
    ActionIcon,
    Modal,
    TextInput,
    Select,
    NumberInput,
    Badge,
    Text,
    Switch,
    LoadingOverlay,
    Popover,
    Stack
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
    IconEdit,
    IconTrash,
    IconPlus,
    IconFolders,
    IconLink,
    IconAlertTriangle
} from '@tabler/icons-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';
import { useNavStore } from '../../../store/navStore';
import { IconRegistry, getIconComponent } from '../../../config/iconRegistry';

interface Props {
    onBack: () => void;
}

// Lifted out of component — stable reference, no recreation on re-render
const PermissionsRenderer = ({ permsStr, color = "blue" }: { permsStr: string; color?: string }) => {
    if (!permsStr) return <Badge color="gray" variant="light">Público</Badge>;
    const perms = permsStr.split(',').map(p => p.trim()).filter(Boolean);
    if (perms.length <= 1) {
        return <Badge size="sm" color={color}>{perms[0]}</Badge>;
    }
    return (
        <Popover width={250} position="bottom" withArrow shadow="md">
            <Popover.Target>
                <Badge style={{ cursor: 'pointer', textTransform: 'none' }} color={color} variant="light">
                    Ver {perms.length} Permisos
                </Badge>
            </Popover.Target>
            <Popover.Dropdown>
                <Group gap="xs">
                    {perms.map(p => <Badge key={p} size="sm" color={color}>{p}</Badge>)}
                </Group>
            </Popover.Dropdown>
        </Popover>
    );
};

// Static — computed once at module load, not on every render
const iconOptions = Object.keys(IconRegistry).map(k => ({ value: k, label: k }));

const renderSelectOption = ({ option }: { option: any }) => {
    const Icn = getIconComponent(option.value);
    return (
        <Group gap="sm">
            {Icn ? <Icn size={18} /> : null}
            <Text size="sm">{option.label}</Text>
        </Group>
    );
};

export const AdminMenuWebPage: React.FC<Props> = ({ onBack }) => {
    const { showToast } = useToast();
    const { setDynamicModules } = useNavStore();

    const [modulos, setModulos] = useState<any[]>([]);
    const [links, setLinks] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Modals state
    const [modModalOpen, setModModalOpen] = useState(false);
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [editingMod, setEditingMod] = useState<any>(null);
    const [editingLink, setEditingLink] = useState<any>(null);

    // Delete confirmation state
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'mod' | 'link'; id: string | number; label: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await apiClient.get('/api/menu/admin/modulos');
            if (res.data.success) {
                setModulos(res.data.data.modulos);
                setLinks(res.data.data.links);
            }
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cargar la configuración del menú.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Derived: module lookup map for the links tab (shows if parent is inactive)
    const moduloMap = useMemo(() => new Map(modulos.map(m => [m.id_modulo, m])), [modulos]);

    // Derived: options for "Módulo Padre" select in link form
    const moduloOptions = useMemo(
        () => modulos.map(m => ({ value: m.id_modulo, label: `${m.label}${!m.activo ? ' (inactivo)' : ''}` })),
        [modulos]
    );

    const formMod = useForm({
        initialValues: {
            id_modulo: '',
            label: '',
            icon_name: 'IconLeaf',
            grupo: 'unidades',
            permissions_str: '',
            sort_order: 0,
            activo: true
        },
        validate: {
            id_modulo: (v) => /^[a-z0-9_]+$/.test(v) ? null : 'Solo minúsculas, números y guión bajo (ej: medio_ambiente)',
            label: (v) => v.trim() ? null : 'El nombre es requerido'
        }
    });

    const formLink = useForm({
        initialValues: {
            id_link: null,
            id_modulo: '',
            id_accion: '',
            label: '',
            permissions_str: '',
            sort_order: 0,
            activo: true
        },
        validate: {
            id_accion: (v) => v.trim() ? null : 'El ID de acción es requerido',
            label: (v) => v.trim() ? null : 'El nombre es requerido',
            id_modulo: (v) => v ? null : 'Selecciona un módulo padre'
        }
    });

    const openModModal = (mod?: any) => {
        if (mod) {
            setEditingMod(mod);
            formMod.setValues({
                id_modulo: mod.id_modulo,
                label: mod.label,
                icon_name: mod.icon_name,
                grupo: mod.grupo,
                permissions_str: mod.permissions_str || '',
                sort_order: mod.sort_order,
                activo: mod.activo
            });
        } else {
            setEditingMod(null);
            formMod.reset();
        }
        setModModalOpen(true);
    };

    const openLinkModal = (link?: any) => {
        if (link) {
            setEditingLink(link);
            formLink.setValues({
                id_link: link.id_link,
                id_modulo: link.id_modulo,
                id_accion: link.id_accion,
                label: link.label,
                permissions_str: link.permissions_str || '',
                sort_order: link.sort_order,
                activo: link.activo
            });
        } else {
            setEditingLink(null);
            formLink.reset();
        }
        setLinkModalOpen(true);
    };

    const saveModulo = async (values: typeof formMod.values) => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            if (editingMod) {
                await apiClient.put(`/api/menu/admin/modulos/${values.id_modulo}`, values);
                showToast({ type: 'success', message: 'Módulo actualizado.' });
            } else {
                await apiClient.post('/api/menu/admin/modulos', values);
                showToast({ type: 'success', message: 'Módulo creado.' });
            }
            setDynamicModules([]); // Invalidate Sidebar cache so it re-fetches
            await fetchData();
            setModModalOpen(false);
        } catch (error: any) {
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al guardar.' });
        } finally {
            setIsSaving(false);
        }
    };

    const saveLink = async (values: typeof formLink.values) => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            if (editingLink) {
                await apiClient.put(`/api/menu/admin/links/${values.id_link}`, values);
                showToast({ type: 'success', message: 'Sub-enlace actualizado.' });
            } else {
                await apiClient.post('/api/menu/admin/links', values);
                showToast({ type: 'success', message: 'Sub-enlace creado.' });
            }
            setDynamicModules([]); // Invalidate Sidebar cache
            await fetchData();
            setLinkModalOpen(false);
        } catch (error: any) {
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al guardar.' });
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteConfirm || isDeleting) return;
        setIsDeleting(true);
        try {
            if (deleteConfirm.type === 'mod') {
                await apiClient.delete(`/api/menu/admin/modulos/${deleteConfirm.id}`);
                showToast({ type: 'success', message: 'Módulo deshabilitado.' });
            } else {
                await apiClient.delete(`/api/menu/admin/links/${deleteConfirm.id}`);
                showToast({ type: 'success', message: 'Enlace deshabilitado.' });
            }
            setDynamicModules([]); // Invalidate Sidebar cache
            await fetchData();
        } catch {
            showToast({ type: 'error', message: 'Error al deshabilitar.' });
        } finally {
            setIsDeleting(false);
            setDeleteConfirm(null);
        }
    };

    return (
        <Box p="md" style={{ position: 'relative' }}>
            <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ radius: "sm", blur: 2 }} />

            <PageHeader
                title="Configuración de Menú"
                subtitle="Administre las unidades principales y los enlaces visibles del panel lateral."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Informática', onClick: onBack },
                    { label: 'Menú Web' }
                ]}
            />

            <Card shadow="sm" radius="md" mt="xl" p="md" withBorder>
                <Tabs defaultValue="modulos">
                    <Tabs.List>
                        <Tabs.Tab value="modulos" leftSection={<IconFolders size={16} />}>
                            Unidades Principales
                        </Tabs.Tab>
                        <Tabs.Tab value="links" leftSection={<IconLink size={16} />}>
                            Sub-enlaces
                        </Tabs.Tab>
                    </Tabs.List>

                    <Tabs.Panel value="modulos" pt="xl">
                        <Group justify="end" mb="md">
                            <Button leftSection={<IconPlus size={16} />} onClick={() => openModModal()}>
                                Nueva Unidad
                            </Button>
                        </Group>

                        <Table striped highlightOnHover withTableBorder>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>ID Clave</Table.Th>
                                    <Table.Th>Label (Nombre Vista)</Table.Th>
                                    <Table.Th>Ícono</Table.Th>
                                    <Table.Th>Grupo</Table.Th>
                                    <Table.Th>Permisos Requeridos</Table.Th>
                                    <Table.Th>Orden</Table.Th>
                                    <Table.Th>Estado</Table.Th>
                                    <Table.Th>Acciones</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {modulos.map((m) => {
                                    const Icn = getIconComponent(m.icon_name);
                                    return (
                                        <Table.Tr key={m.id_modulo}>
                                            <Table.Td><Text fw={500} size="sm">{m.id_modulo}</Text></Table.Td>
                                            <Table.Td>{m.label}</Table.Td>
                                            <Table.Td>
                                                <Group gap="xs">
                                                    <Icn size={18} />
                                                    <Text size="sm">{m.icon_name}</Text>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>{m.grupo}</Table.Td>
                                            <Table.Td>
                                                <PermissionsRenderer permsStr={m.permissions_str} />
                                            </Table.Td>
                                            <Table.Td>{m.sort_order}</Table.Td>
                                            <Table.Td>
                                                {m.activo
                                                    ? <Badge color="teal">Activo</Badge>
                                                    : <Badge color="red">Inactivo</Badge>}
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap="xs">
                                                    <ActionIcon variant="light" color="blue" onClick={() => openModModal(m)}>
                                                        <IconEdit size={16} />
                                                    </ActionIcon>
                                                    {m.activo && (
                                                        <ActionIcon
                                                            variant="light"
                                                            color="red"
                                                            onClick={() => setDeleteConfirm({ type: 'mod', id: m.id_modulo, label: m.label })}
                                                        >
                                                            <IconTrash size={16} />
                                                        </ActionIcon>
                                                    )}
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </Tabs.Panel>

                    <Tabs.Panel value="links" pt="xl">
                        <Group justify="end" mb="md">
                            <Button leftSection={<IconPlus size={16} />} onClick={() => openLinkModal()} color="grape">
                                Nuevo Enlace
                            </Button>
                        </Group>
                        <Table striped highlightOnHover withTableBorder>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>ID Accion (React)</Table.Th>
                                    <Table.Th>Label (Nombre Vista)</Table.Th>
                                    <Table.Th>Unidad Padre</Table.Th>
                                    <Table.Th>Permisos Opcionales</Table.Th>
                                    <Table.Th>Orden</Table.Th>
                                    <Table.Th>Estado</Table.Th>
                                    <Table.Th>Acciones</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {links.map((l) => {
                                    const parentMod = moduloMap.get(l.id_modulo);
                                    const parentInactive = parentMod && !parentMod.activo;
                                    return (
                                        <Table.Tr key={l.id_link}>
                                            <Table.Td><Text fw={500} size="sm">{l.id_accion}</Text></Table.Td>
                                            <Table.Td>{l.label}</Table.Td>
                                            <Table.Td>
                                                <Group gap={4}>
                                                    <Badge color={parentInactive ? 'gray' : 'indigo'}>{l.id_modulo}</Badge>
                                                    {parentInactive && (
                                                        <Badge size="xs" color="orange" variant="light">módulo inactivo</Badge>
                                                    )}
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <PermissionsRenderer permsStr={l.permissions_str} color="grape" />
                                            </Table.Td>
                                            <Table.Td>{l.sort_order}</Table.Td>
                                            <Table.Td>
                                                {l.activo
                                                    ? <Badge color="teal">Activo</Badge>
                                                    : <Badge color="red">Inactivo</Badge>}
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap="xs">
                                                    <ActionIcon variant="light" color="blue" onClick={() => openLinkModal(l)}>
                                                        <IconEdit size={16} />
                                                    </ActionIcon>
                                                    {l.activo && (
                                                        <ActionIcon
                                                            variant="light"
                                                            color="red"
                                                            onClick={() => setDeleteConfirm({ type: 'link', id: l.id_link, label: l.label })}
                                                        >
                                                            <IconTrash size={16} />
                                                        </ActionIcon>
                                                    )}
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    </Tabs.Panel>
                </Tabs>
            </Card>

            {/* Modal Unidades */}
            <Modal opened={modModalOpen} onClose={() => setModModalOpen(false)} title={editingMod ? "Editar Unidad" : "Nueva Unidad"}>
                <form onSubmit={formMod.onSubmit(saveModulo)}>
                    <TextInput
                        label="ID Clave (Interno)"
                        placeholder="ej: medio_ambiente"
                        description="Solo minúsculas, números y guión bajo"
                        {...formMod.getInputProps('id_modulo')}
                        required
                        disabled={!!editingMod}
                    />
                    <TextInput label="Label (Nombre Visible)" mt="sm" {...formMod.getInputProps('label')} required />
                    <Select
                        label="Ícono Tabler"
                        data={iconOptions}
                        renderOption={renderSelectOption}
                        searchable
                        mt="sm"
                        {...formMod.getInputProps('icon_name')}
                    />
                    <Select
                        label="Grupo"
                        data={[{ value: 'unidades', label: 'Unidades' }, { value: 'gestion', label: 'Gestión' }]}
                        mt="sm"
                        {...formMod.getInputProps('grupo')}
                    />
                    <TextInput
                        label="Permisos (sep. comas)"
                        placeholder="MA_ACCESO, INF_ACCESO"
                        mt="sm"
                        {...formMod.getInputProps('permissions_str')}
                    />
                    <NumberInput label="Orden" mt="sm" {...formMod.getInputProps('sort_order')} />
                    {editingMod && <Switch label="Módulo Activo" mt="md" {...formMod.getInputProps('activo', { type: 'checkbox' })} />}
                    <Button type="submit" fullWidth mt="xl" loading={isSaving}>Guardar</Button>
                </form>
            </Modal>

            {/* Modal Links */}
            <Modal opened={linkModalOpen} onClose={() => setLinkModalOpen(false)} title={editingLink ? "Editar Enlace" : "Nuevo Enlace"}>
                <form onSubmit={formLink.onSubmit(saveLink)}>
                    <TextInput
                        label="ID Acción (React Route Clave)"
                        placeholder="ej: ma-fichas-ingreso"
                        {...formLink.getInputProps('id_accion')}
                        required
                    />
                    <TextInput label="Label (Nombre Visible)" mt="sm" {...formLink.getInputProps('label')} required />
                    <Select
                        label="Módulo Padre"
                        data={moduloOptions}
                        searchable
                        mt="sm"
                        {...formLink.getInputProps('id_modulo')}
                        required
                    />
                    <TextInput
                        label="Permisos Extra (sep. comas)"
                        description="Vacío hereda acceso del padre."
                        placeholder="FI_NEW_CREAR"
                        mt="sm"
                        {...formLink.getInputProps('permissions_str')}
                    />
                    <NumberInput label="Orden" mt="sm" {...formLink.getInputProps('sort_order')} />
                    {editingLink && <Switch label="Enlace Activo" mt="md" {...formLink.getInputProps('activo', { type: 'checkbox' })} />}
                    <Button type="submit" color="grape" fullWidth mt="xl" loading={isSaving}>Guardar</Button>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                opened={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                title={
                    <Group gap="xs">
                        <IconAlertTriangle size={18} color="var(--mantine-color-orange-6)" />
                        <Text fw={600}>Confirmar deshabilitación</Text>
                    </Group>
                }
                size="sm"
                centered
            >
                <Stack gap="lg">
                    <Text size="sm">
                        ¿Está seguro de deshabilitar{' '}
                        <Text span fw={700}>{deleteConfirm?.label}</Text>?
                        {deleteConfirm?.type === 'mod' && (
                            <Text size="xs" c="dimmed" mt={4}>
                                También se deshabilitarán todos sus sub-enlaces asociados.
                            </Text>
                        )}
                    </Text>
                    <Group justify="flex-end" gap="sm">
                        <Button variant="default" onClick={() => setDeleteConfirm(null)} disabled={isDeleting}>
                            Cancelar
                        </Button>
                        <Button color="red" onClick={confirmDelete} loading={isDeleting}>
                            Deshabilitar
                        </Button>
                    </Group>
                </Stack>
            </Modal>
        </Box>
    );
};
