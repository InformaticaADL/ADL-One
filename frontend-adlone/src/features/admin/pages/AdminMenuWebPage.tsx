import React, { useEffect, useState, useMemo } from 'react';
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
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Combobox } from '@/components/ui/combobox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface Props {
    onBack: () => void;
}

// Lifted out of component — stable reference, no recreation on re-render
const PermissionsRenderer = ({ permsStr, }: { permsStr: string }) => {
    if (!permsStr) return <Badge variant="outline">Público</Badge>;
    const perms = permsStr.split(',').map(p => p.trim()).filter(Boolean);
    if (perms.length <= 1) {
        return <Badge variant="outline">{perms[0]}</Badge>;
    }
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button type="button">
                    <Badge variant="outline" className="cursor-pointer normal-case">Ver {perms.length} Permisos</Badge>
                </button>
            </PopoverTrigger>
            <PopoverContent className="flex w-auto max-w-[250px] flex-wrap gap-2 p-2">
                {perms.map(p => <Badge key={p} variant="outline">{p}</Badge>)}
            </PopoverContent>
        </Popover>
    );
};

// Static — computed once at module load, not on every render
const iconOptions = Object.keys(IconRegistry).map(k => ({ value: k, label: k }));

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

const GRUPO_OPTIONS = [
    { value: 'unidades', label: 'Unidades' },
    { value: 'gestion', label: 'Gestión' }
];

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

    return (
        <div className="shadcn-scope relative w-full p-4 md:p-6">
            {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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

            <Card className="mt-8 p-6">
                <Tabs defaultValue="modulos">
                    <TabsList>
                        <TabsTrigger value="modulos" className="gap-1.5"><IconFolders size={16} /> Unidades Principales</TabsTrigger>
                        <TabsTrigger value="links" className="gap-1.5"><IconLink size={16} /> Sub-enlaces</TabsTrigger>
                    </TabsList>

                    <TabsContent value="modulos" className="pt-4">
                        <div className="mb-4 flex justify-end">
                            <Button onClick={() => openModModal()}>
                                <IconPlus size={16} /> Nueva Unidad
                            </Button>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID Clave</TableHead>
                                        <TableHead>Label (Nombre Vista)</TableHead>
                                        <TableHead>Ícono</TableHead>
                                        <TableHead>Grupo</TableHead>
                                        <TableHead>Permisos Requeridos</TableHead>
                                        <TableHead>Orden</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="w-[90px]">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {modulos.map((m) => {
                                        const Icn = getIconComponent(m.icon_name);
                                        return (
                                            <TableRow key={m.id_modulo}>
                                                <TableCell className="font-semibold">{m.id_modulo}</TableCell>
                                                <TableCell>{m.label}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Icn size={18} />
                                                        <span className="text-sm">{m.icon_name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{m.grupo}</TableCell>
                                                <TableCell><PermissionsRenderer permsStr={m.permissions_str} /></TableCell>
                                                <TableCell>{m.sort_order}</TableCell>
                                                <TableCell>
                                                    <Badge variant={m.activo ? 'success' : 'destructive'}>{m.activo ? 'Activo' : 'Inactivo'}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <Button variant="ghost" size="icon" title="Editar" onClick={() => openModModal(m)}>
                                                            <IconEdit size={16} />
                                                        </Button>
                                                        {m.activo && (
                                                            <Button variant="ghost" size="icon" title="Deshabilitar" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ type: 'mod', id: m.id_modulo, label: m.label })}>
                                                                <IconTrash size={16} />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    <TabsContent value="links" className="pt-4">
                        <div className="mb-4 flex justify-end">
                            <Button onClick={() => openLinkModal()}>
                                <IconPlus size={16} /> Nuevo Enlace
                            </Button>
                        </div>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID Accion (React)</TableHead>
                                        <TableHead>Label (Nombre Vista)</TableHead>
                                        <TableHead>Unidad Padre</TableHead>
                                        <TableHead>Permisos Opcionales</TableHead>
                                        <TableHead>Orden</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="w-[90px]">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {links.map((l) => {
                                        const parentMod = moduloMap.get(l.id_modulo);
                                        const parentInactive = parentMod && !parentMod.activo;
                                        return (
                                            <TableRow key={l.id_link}>
                                                <TableCell className="font-semibold">{l.id_accion}</TableCell>
                                                <TableCell>{l.label}</TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <Badge variant="outline">{l.id_modulo}</Badge>
                                                        {parentInactive && <Badge variant="warning">módulo inactivo</Badge>}
                                                    </div>
                                                </TableCell>
                                                <TableCell><PermissionsRenderer permsStr={l.permissions_str} /></TableCell>
                                                <TableCell>{l.sort_order}</TableCell>
                                                <TableCell>
                                                    <Badge variant={l.activo ? 'success' : 'destructive'}>{l.activo ? 'Activo' : 'Inactivo'}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <Button variant="ghost" size="icon" title="Editar" onClick={() => openLinkModal(l)}>
                                                            <IconEdit size={16} />
                                                        </Button>
                                                        {l.activo && (
                                                            <Button variant="ghost" size="icon" title="Deshabilitar" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm({ type: 'link', id: l.id_link, label: l.label })}>
                                                                <IconTrash size={16} />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
            </Card>

            {/* Modal Unidades */}
            <Dialog open={modModalOpen} onOpenChange={setModModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingMod ? 'Editar Unidad' : 'Nueva Unidad'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={saveModulo} className="flex flex-col gap-3">
                        <Field label="ID Clave (Interno) *" hint="Solo minúsculas, números y guión bajo" error={modErrors.id_modulo}>
                            <Input
                                placeholder="ej: medio_ambiente"
                                value={modForm.id_modulo}
                                onChange={(e) => setModForm({ ...modForm, id_modulo: e.target.value })}
                                disabled={!!editingMod}
                                className={modErrors.id_modulo ? 'border-destructive' : undefined}
                            />
                        </Field>
                        <Field label="Label (Nombre Visible) *" error={modErrors.label}>
                            <Input
                                value={modForm.label}
                                onChange={(e) => setModForm({ ...modForm, label: e.target.value })}
                                className={modErrors.label ? 'border-destructive' : undefined}
                            />
                        </Field>
                        <Field label="Ícono Tabler">
                            <Combobox
                                options={iconOptions}
                                value={modForm.icon_name}
                                onValueChange={(v) => setModForm({ ...modForm, icon_name: v })}
                            />
                        </Field>
                        <Field label="Grupo">
                            <Combobox
                                options={GRUPO_OPTIONS}
                                value={modForm.grupo}
                                onValueChange={(v) => setModForm({ ...modForm, grupo: v })}
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
                            <Input
                                type="number"
                                value={modForm.sort_order}
                                onChange={(e) => setModForm({ ...modForm, sort_order: Number(e.target.value) || 0 })}
                            />
                        </Field>
                        {editingMod && (
                            <div className="mt-1 flex items-center gap-2">
                                <Switch checked={modForm.activo} onCheckedChange={(checked) => setModForm({ ...modForm, activo: checked })} />
                                <span className="text-sm text-foreground">Módulo Activo</span>
                            </div>
                        )}
                        <Button type="submit" disabled={isSaving} className="mt-3 w-full">
                            {isSaving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : null}
                            Guardar
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Links */}
            <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingLink ? 'Editar Enlace' : 'Nuevo Enlace'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={saveLink} className="flex flex-col gap-3">
                        <Field label="ID Acción (React Route Clave) *" error={linkErrors.id_accion}>
                            <Input
                                placeholder="ej: ma-fichas-ingreso"
                                value={linkForm.id_accion}
                                onChange={(e) => setLinkForm({ ...linkForm, id_accion: e.target.value })}
                                className={linkErrors.id_accion ? 'border-destructive' : undefined}
                            />
                        </Field>
                        <Field label="Label (Nombre Visible) *" error={linkErrors.label}>
                            <Input
                                value={linkForm.label}
                                onChange={(e) => setLinkForm({ ...linkForm, label: e.target.value })}
                                className={linkErrors.label ? 'border-destructive' : undefined}
                            />
                        </Field>
                        <Field label="Módulo Padre *" error={linkErrors.id_modulo}>
                            <Combobox
                                options={moduloOptions}
                                value={linkForm.id_modulo || undefined}
                                onValueChange={(v) => setLinkForm({ ...linkForm, id_modulo: v })}
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
                            <Input
                                type="number"
                                value={linkForm.sort_order}
                                onChange={(e) => setLinkForm({ ...linkForm, sort_order: Number(e.target.value) || 0 })}
                            />
                        </Field>
                        {editingLink && (
                            <div className="mt-1 flex items-center gap-2">
                                <Switch checked={linkForm.activo} onCheckedChange={(checked) => setLinkForm({ ...linkForm, activo: checked })} />
                                <span className="text-sm text-foreground">Enlace Activo</span>
                            </div>
                        )}
                        <Button type="submit" disabled={isSaving} className="mt-3 w-full">
                            {isSaving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : null}
                            Guardar
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
                <DialogContent className="max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <IconAlertTriangle size={18} className="text-warning" />
                            Confirmar deshabilitación
                        </DialogTitle>
                    </DialogHeader>
                    <div>
                        <p className="text-sm text-foreground">
                            ¿Está seguro de deshabilitar <span className="font-semibold">{deleteConfirm?.label}</span>?
                        </p>
                        {deleteConfirm?.type === 'mod' && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                También se deshabilitarán todos sus sub-enlaces asociados.
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={isDeleting}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
                            {isDeleting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
                            Deshabilitar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="mb-1 text-xs text-muted-foreground">{label}</p>
            {children}
            {hint && !error && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
            {error && <p className="mt-0.5 text-[11px] text-destructive">{error}</p>}
        </div>
    );
}
