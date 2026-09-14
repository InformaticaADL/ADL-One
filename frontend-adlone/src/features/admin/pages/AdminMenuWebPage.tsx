import React, { useEffect, useState, useMemo } from 'react';
import {
    Card,
    Tabs,
    Table,
    Button,
    Modal,
    Input,
    Select,
    InputNumber,
    Tag,
    Typography,
    Switch,
    Spin,
    Popover
} from 'antd';
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

const { Text } = Typography;

interface Props {
    onBack: () => void;
}

// Lifted out of component — stable reference, no recreation on re-render
const PermissionsRenderer = ({ permsStr, color = "blue" }: { permsStr: string; color?: string }) => {
    if (!permsStr) return <Tag>Público</Tag>;
    const perms = permsStr.split(',').map(p => p.trim()).filter(Boolean);
    if (perms.length <= 1) {
        return <Tag color={color}>{perms[0]}</Tag>;
    }
    return (
        <Popover
            content={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 250 }}>{perms.map(p => <Tag key={p} color={color}>{p}</Tag>)}</div>}
        >
            <Tag color={color} style={{ cursor: 'pointer', textTransform: 'none' }}>
                Ver {perms.length} Permisos
            </Tag>
        </Popover>
    );
};

// Static — computed once at module load, not on every render
const iconOptions = Object.keys(IconRegistry).map(k => {
    const Icn = getIconComponent(k);
    return {
        value: k,
        label: (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {Icn ? <Icn size={18} /> : null}
                <Text style={{ fontSize: 13 }}>{k}</Text>
            </div>
        ),
    };
});

const emptyModForm = {
    id_modulo: '',
    label: '',
    icon_name: 'IconLeaf',
    grupo: 'unidades',
    permissions_str: '',
    sort_order: 0,
    activo: true
};

const emptyLinkForm = {
    id_link: null as number | null,
    id_modulo: '',
    id_accion: '',
    label: '',
    permissions_str: '',
    sort_order: 0,
    activo: true
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

    // Form state
    const [modForm, setModForm] = useState(emptyModForm);
    const [modErrors, setModErrors] = useState<Record<string, string>>({});
    const [linkForm, setLinkForm] = useState(emptyLinkForm);
    const [linkErrors, setLinkErrors] = useState<Record<string, string>>({});

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Derived: module lookup map for the links tab (shows if parent is inactive)
    const moduloMap = useMemo(() => new Map(modulos.map(m => [m.id_modulo, m])), [modulos]);

    // Derived: options for "Módulo Padre" select in link form
    const moduloOptions = useMemo(
        () => modulos.map(m => ({ value: m.id_modulo, label: `${m.label}${!m.activo ? ' (inactivo)' : ''}` })),
        [modulos]
    );

    const openModModal = (mod?: any) => {
        setModErrors({});
        if (mod) {
            setEditingMod(mod);
            setModForm({
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
            setModForm(emptyModForm);
        }
        setModModalOpen(true);
    };

    const openLinkModal = (link?: any) => {
        setLinkErrors({});
        if (link) {
            setEditingLink(link);
            setLinkForm({
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
            setLinkForm(emptyLinkForm);
        }
        setLinkModalOpen(true);
    };

    const validateMod = (): boolean => {
        const errors: Record<string, string> = {};
        if (!/^[a-z0-9_]+$/.test(modForm.id_modulo)) errors.id_modulo = 'Solo minúsculas, números y guión bajo (ej: medio_ambiente)';
        if (!modForm.label.trim()) errors.label = 'El nombre es requerido';
        setModErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const validateLink = (): boolean => {
        const errors: Record<string, string> = {};
        if (!linkForm.id_accion.trim()) errors.id_accion = 'El ID de acción es requerido';
        if (!linkForm.label.trim()) errors.label = 'El nombre es requerido';
        if (!linkForm.id_modulo) errors.id_modulo = 'Selecciona un módulo padre';
        setLinkErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const saveModulo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving || !validateMod()) return;
        setIsSaving(true);
        try {
            if (editingMod) {
                await apiClient.put(`/api/menu/admin/modulos/${modForm.id_modulo}`, modForm);
                showToast({ type: 'success', message: 'Módulo actualizado.' });
            } else {
                await apiClient.post('/api/menu/admin/modulos', modForm);
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

    const saveLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving || !validateLink()) return;
        setIsSaving(true);
        try {
            if (editingLink) {
                await apiClient.put(`/api/menu/admin/links/${linkForm.id_link}`, linkForm);
                showToast({ type: 'success', message: 'Sub-enlace actualizado.' });
            } else {
                await apiClient.post('/api/menu/admin/links', linkForm);
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

    const modColumns = [
        { title: 'ID Clave', key: 'id', render: (_: unknown, m: any) => <Text strong style={{ fontSize: 13 }}>{m.id_modulo}</Text> },
        { title: 'Label (Nombre Vista)', dataIndex: 'label', key: 'label' },
        {
            title: 'Ícono', key: 'icon',
            render: (_: unknown, m: any) => {
                const Icn = getIconComponent(m.icon_name);
                return (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Icn size={18} />
                        <Text style={{ fontSize: 13 }}>{m.icon_name}</Text>
                    </div>
                );
            },
        },
        { title: 'Grupo', dataIndex: 'grupo', key: 'grupo' },
        { title: 'Permisos Requeridos', key: 'permisos', render: (_: unknown, m: any) => <PermissionsRenderer permsStr={m.permissions_str} /> },
        { title: 'Orden', dataIndex: 'sort_order', key: 'sort_order' },
        { title: 'Estado', key: 'estado', render: (_: unknown, m: any) => (m.activo ? <Tag color="green">Activo</Tag> : <Tag color="red">Inactivo</Tag>) },
        {
            title: 'Acciones', key: 'acciones',
            render: (_: unknown, m: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button type="text" size="small" icon={<IconEdit size={16} color="#1c7ed6" />} onClick={() => openModModal(m)} />
                    {m.activo && (
                        <Button type="text" size="small" icon={<IconTrash size={16} color="#e03131" />} onClick={() => setDeleteConfirm({ type: 'mod', id: m.id_modulo, label: m.label })} />
                    )}
                </div>
            ),
        },
    ];

    const linkColumns = [
        { title: 'ID Accion (React)', key: 'id', render: (_: unknown, l: any) => <Text strong style={{ fontSize: 13 }}>{l.id_accion}</Text> },
        { title: 'Label (Nombre Vista)', dataIndex: 'label', key: 'label' },
        {
            title: 'Unidad Padre', key: 'padre',
            render: (_: unknown, l: any) => {
                const parentMod = moduloMap.get(l.id_modulo);
                const parentInactive = parentMod && !parentMod.activo;
                return (
                    <div style={{ display: 'flex', gap: 4 }}>
                        <Tag color={parentInactive ? 'default' : 'geekblue'}>{l.id_modulo}</Tag>
                        {parentInactive && <Tag color="orange">módulo inactivo</Tag>}
                    </div>
                );
            },
        },
        { title: 'Permisos Opcionales', key: 'permisos', render: (_: unknown, l: any) => <PermissionsRenderer permsStr={l.permissions_str} color="purple" /> },
        { title: 'Orden', dataIndex: 'sort_order', key: 'sort_order' },
        { title: 'Estado', key: 'estado', render: (_: unknown, l: any) => (l.activo ? <Tag color="green">Activo</Tag> : <Tag color="red">Inactivo</Tag>) },
        {
            title: 'Acciones', key: 'acciones',
            render: (_: unknown, l: any) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button type="text" size="small" icon={<IconEdit size={16} color="#1c7ed6" />} onClick={() => openLinkModal(l)} />
                    {l.activo && (
                        <Button type="text" size="small" icon={<IconTrash size={16} color="#e03131" />} onClick={() => setDeleteConfirm({ type: 'link', id: l.id_link, label: l.label })} />
                    )}
                </div>
            ),
        },
    ];

    return (
        <div style={{ padding: 16, position: 'relative' }}>
            {loading && (
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Spin />
                </div>
            )}

            <PageHeader
                title="Configuración de Menú"
                subtitle="Administre las unidades principales y los enlaces visibles del panel lateral."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Informática', onClick: onBack },
                    { label: 'Menú Web' }
                ]}
            />

            <Card style={{ marginTop: 32 }}>
                <Tabs
                    defaultActiveKey="modulos"
                    items={[
                        {
                            key: 'modulos',
                            label: <span><IconFolders size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Unidades Principales</span>,
                            children: (
                                <div style={{ paddingTop: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                                        <Button type="primary" icon={<IconPlus size={16} />} onClick={() => openModModal()}>
                                            Nueva Unidad
                                        </Button>
                                    </div>
                                    <Table rowKey="id_modulo" columns={modColumns} dataSource={modulos} pagination={false} size="small" scroll={{ x: 900 }} />
                                </div>
                            ),
                        },
                        {
                            key: 'links',
                            label: <span><IconLink size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Sub-enlaces</span>,
                            children: (
                                <div style={{ paddingTop: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                                        <Button type="primary" style={{ backgroundColor: '#9c36b5' }} icon={<IconPlus size={16} />} onClick={() => openLinkModal()}>
                                            Nuevo Enlace
                                        </Button>
                                    </div>
                                    <Table rowKey="id_link" columns={linkColumns} dataSource={links} pagination={false} size="small" scroll={{ x: 900 }} />
                                </div>
                            ),
                        },
                    ]}
                />
            </Card>

            {/* Modal Unidades */}
            <Modal open={modModalOpen} onCancel={() => setModModalOpen(false)} footer={null} title={editingMod ? "Editar Unidad" : "Nueva Unidad"}>
                <form onSubmit={saveModulo}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                        <Field label="ID Clave (Interno) *" hint="Solo minúsculas, números y guión bajo" error={modErrors.id_modulo}>
                            <Input
                                placeholder="ej: medio_ambiente"
                                value={modForm.id_modulo}
                                onChange={(e) => setModForm({ ...modForm, id_modulo: e.target.value })}
                                disabled={!!editingMod}
                                status={modErrors.id_modulo ? 'error' : undefined}
                            />
                        </Field>
                        <Field label="Label (Nombre Visible) *" error={modErrors.label}>
                            <Input value={modForm.label} onChange={(e) => setModForm({ ...modForm, label: e.target.value })} status={modErrors.label ? 'error' : undefined} />
                        </Field>
                        <Field label="Ícono Tabler">
                            <Select
                                options={iconOptions}
                                showSearch
                                filterOption={(input, option) => (option?.value as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                value={modForm.icon_name}
                                onChange={(v) => setModForm({ ...modForm, icon_name: v })}
                                style={{ width: '100%' }}
                            />
                        </Field>
                        <Field label="Grupo">
                            <Select
                                options={[{ value: 'unidades', label: 'Unidades' }, { value: 'gestion', label: 'Gestión' }]}
                                value={modForm.grupo}
                                onChange={(v) => setModForm({ ...modForm, grupo: v })}
                                style={{ width: '100%' }}
                            />
                        </Field>
                        <Field label="Permisos (sep. comas)">
                            <Input
                                placeholder="MA_ACCESO, INF_ACCESO"
                                value={modForm.permissions_str}
                                onChange={(e) => setModForm({ ...modForm, permissions_str: e.target.value })}
                            />
                        </Field>
                        <Field label="Orden">
                            <InputNumber style={{ width: '100%' }} value={modForm.sort_order} onChange={(v) => setModForm({ ...modForm, sort_order: v ?? 0 })} />
                        </Field>
                        {editingMod && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                <Switch checked={modForm.activo} onChange={(checked) => setModForm({ ...modForm, activo: checked })} />
                                <Text style={{ fontSize: 13 }}>Módulo Activo</Text>
                            </div>
                        )}
                        <Button htmlType="submit" type="primary" block loading={isSaving} style={{ marginTop: 12 }}>Guardar</Button>
                    </div>
                </form>
            </Modal>

            {/* Modal Links */}
            <Modal open={linkModalOpen} onCancel={() => setLinkModalOpen(false)} footer={null} title={editingLink ? "Editar Enlace" : "Nuevo Enlace"}>
                <form onSubmit={saveLink}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                        <Field label="ID Acción (React Route Clave) *" error={linkErrors.id_accion}>
                            <Input
                                placeholder="ej: ma-fichas-ingreso"
                                value={linkForm.id_accion}
                                onChange={(e) => setLinkForm({ ...linkForm, id_accion: e.target.value })}
                                status={linkErrors.id_accion ? 'error' : undefined}
                            />
                        </Field>
                        <Field label="Label (Nombre Visible) *" error={linkErrors.label}>
                            <Input value={linkForm.label} onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })} status={linkErrors.label ? 'error' : undefined} />
                        </Field>
                        <Field label="Módulo Padre *" error={linkErrors.id_modulo}>
                            <Select
                                options={moduloOptions}
                                showSearch
                                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                value={linkForm.id_modulo || undefined}
                                onChange={(v) => setLinkForm({ ...linkForm, id_modulo: v })}
                                style={{ width: '100%' }}
                                status={linkErrors.id_modulo ? 'error' : undefined}
                            />
                        </Field>
                        <Field label="Permisos Extra (sep. comas)" hint="Vacío hereda acceso del padre.">
                            <Input
                                placeholder="FI_NEW_CREAR"
                                value={linkForm.permissions_str}
                                onChange={(e) => setLinkForm({ ...linkForm, permissions_str: e.target.value })}
                            />
                        </Field>
                        <Field label="Orden">
                            <InputNumber style={{ width: '100%' }} value={linkForm.sort_order} onChange={(v) => setLinkForm({ ...linkForm, sort_order: v ?? 0 })} />
                        </Field>
                        {editingLink && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                <Switch checked={linkForm.activo} onChange={(checked) => setLinkForm({ ...linkForm, activo: checked })} />
                                <Text style={{ fontSize: 13 }}>Enlace Activo</Text>
                            </div>
                        )}
                        <Button htmlType="submit" type="primary" style={{ backgroundColor: '#9c36b5', marginTop: 12 }} block loading={isSaving}>Guardar</Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                open={!!deleteConfirm}
                onCancel={() => setDeleteConfirm(null)}
                footer={null}
                width={420}
                centered
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconAlertTriangle size={18} color="#e8590c" />
                        <Text strong>Confirmar deshabilitación</Text>
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
                    <div>
                        <Text style={{ fontSize: 13 }}>
                            ¿Está seguro de deshabilitar{' '}
                            <Text strong>{deleteConfirm?.label}</Text>?
                        </Text>
                        {deleteConfirm?.type === 'mod' && (
                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                                También se deshabilitarán todos sus sub-enlaces asociados.
                            </Text>
                        )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button onClick={() => setDeleteConfirm(null)} disabled={isDeleting}>
                            Cancelar
                        </Button>
                        <Button danger type="primary" onClick={confirmDelete} loading={isDeleting}>
                            Deshabilitar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
            {hint && !error && <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>{hint}</Text>}
            {error && <Text type="danger" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>{error}</Text>}
        </div>
    );
}
