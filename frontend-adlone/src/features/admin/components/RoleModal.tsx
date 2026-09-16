import React, { useEffect, useState, useMemo } from 'react';
import {
    IconSearch,
    IconShield,
    IconInfoCircle,
    IconChevronRight,
    IconChevronDown,
    IconCheck,
    IconWorld,
    IconBuildingHospital,
    IconMicroscope,
    IconFlask,
    IconSettings,
    IconChartBar,
    IconLeaf
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { rbacService } from '../services/rbac.service';
import type { Role, Permission } from '../services/rbac.service';
import { useToast } from '../../../contexts/ToastContext';
import { ConfirmModal } from '../../../components/common/ConfirmModal';

interface Props {
    role: Role | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const RoleModal: React.FC<Props> = ({ role, isOpen, onClose, onSuccess }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { showToast } = useToast();
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [loading, setLoading] = useState(false);
    const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
    const [affectedCount, setAffectedCount] = useState<number | null>(null);

    // Permissions Management
    const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
    const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);

    // UI States
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<string>('GENERAL');
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const doSave = async () => {
        setConfirmSaveOpen(false);
        setLoading(true);
        try {
            let savedRole = role;

            if (!savedRole) {
                savedRole = await rbacService.createRole(nombre.trim(), descripcion);
            } else {
                await rbacService.updateRole(savedRole.id_rol, nombre.trim(), descripcion);
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

    const handleSave = async () => {
        if (!nombre.trim()) {
            showToast({ type: 'warning', message: 'El nombre es obligatorio' });
            return;
        }

        // New role: no users yet, save directly
        if (!role) {
            doSave();
            return;
        }

        // Existing role: check how many users will be affected
        try {
            const users = await rbacService.getUsersByRole(role.id_rol);
            if (users.length === 0) {
                doSave();
            } else {
                setAffectedCount(users.length);
                setConfirmSaveOpen(true);
            }
        } catch {
            // If fetch fails, proceed without warning
            doSave();
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
            const sub = p.submodulo || 'General';

            // Normalización básica para asegurar que los nombres coincidan con las pestañas
            const modUpper = mod.toUpperCase().trim();

            if (modUpper.includes('ADMIN')) mod = 'Admin. Información';
            else if (modUpper.includes('CALIDAD')) mod = 'Gestión de Calidad';
            else if (modUpper.includes('MEDIO AMBIENTE')) mod = 'Medio Ambiente';
            else if (modUpper.includes('LABORATORY')) mod = 'Laboratory';
            else if (modUpper.includes('MICROSCOP')) mod = 'Microscopía';
            else if (modUpper.includes('OTROS')) mod = 'Otros';

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
        'Admin. Info': <IconBuildingHospital size={16} />,
        'Gestión de Calidad': <IconChartBar size={16} />,
        'Laboratory': <IconFlask size={16} />,
        'Microscopía': <IconMicroscope size={16} />,
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

    const renderPermissionCard = (p: Permission) => {
        const selected = selectedPermissions.includes(p.id_permiso);
        return (
            <div
                key={p.id_permiso}
                onClick={() => togglePermission(p.id_permiso)}
                className={cn(
                    'cursor-pointer rounded-md border p-2 transition-colors',
                    selected ? 'border-primary bg-primary/10' : 'border-border bg-card'
                )}
            >
                <div className="flex flex-nowrap items-start gap-2">
                    <Checkbox checked={selected} className="pointer-events-none mt-0.5" />
                    <div className="min-w-0 flex-1">
                        <p className="block truncate text-[13px] font-semibold text-foreground">{p.nombre}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{p.codigo}</p>
                    </div>
                </div>
            </div>
        );
    };

    const generalPanel = (
        <div className="flex-1 overflow-y-auto p-4">
            <div className={cn('flex flex-col gap-6', isMobile && 'pb-[120px]')}>
                <div>
                    <h3 className="mb-4 text-base font-semibold text-foreground">Información del Rol</h3>
                    <p className="mb-6 block text-[13px] text-muted-foreground">
                        Introduce el nombre y una descripción clara para que otros administradores sepan qué permite hacer este rol.
                    </p>
                </div>

                <Field label="Nombre del Rol *">
                    <Input
                        placeholder="Ej: Administrador Maestro"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                    />
                </Field>
                <Field label="Descripción">
                    <Input
                        placeholder="Describe el alcance de este rol..."
                        value={descripcion}
                        onChange={(e) => setDescripcion(e.target.value)}
                    />
                </Field>

                <div className="mt-2 rounded-lg border border-border bg-muted/40 p-4">
                    <div className="flex gap-4">
                        <IconShield className="shrink-0 text-primary" />
                        <div>
                            <p className="block text-[13px] font-semibold text-foreground">Resumen de Permisos</p>
                            <p className="text-xs text-muted-foreground">
                                Este rol tiene actualmente <span className="text-xs font-semibold text-primary">{selectedPermissions.length}</span> permisos otorgados de un total de {allPermissions.length}.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderModulePanel = (moduleName: string, submodules: Record<string, Permission[]>) => {
        const allModulePerms = Object.values(submodules).flat();
        const allSelectedInModule = allModulePerms.every(p => selectedPermissions.includes(p.id_permiso));

        return (
            <div className="flex-1 overflow-y-auto p-4">
                <div className={cn('flex flex-col gap-6', isMobile && 'pb-[120px]')}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h3 className="m-0 text-lg font-semibold text-foreground">{moduleName}</h3>
                            <p className="text-[13px] text-muted-foreground">Administra los accesos específicos para este módulo.</p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={isMobile ? 'w-full' : undefined}
                            onClick={() => toggleSelectAllCategory(allModulePerms)}
                        >
                            {allSelectedInModule ? 'Desmarcar' : 'Marcar Todo'}
                        </Button>
                    </div>

                    <div className="flex flex-col gap-4">
                        {moduleName === 'Medio Ambiente' ? (
                            <div className="rounded-lg border border-border p-4">
                                <div
                                    className="flex cursor-pointer flex-wrap items-center justify-between gap-2"
                                    onClick={() => {
                                        const allSubKeys = Object.keys(submodules).map(s => `${moduleName}:${s}`);
                                        const someClosed = allSubKeys.some(k => expandedSubmodules[k] === false);
                                        const newState: Record<string, boolean> = {};
                                        allSubKeys.forEach(k => newState[k] = someClosed);
                                        setExpandedSubmodules(prev => ({ ...prev, ...newState }));
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <IconChevronDown size={14} />
                                        <span className="text-[13px] font-semibold uppercase text-foreground">MEDIOAMBIENTE</span>
                                        <Badge variant="secondary">{Object.values(submodules).reduce((acc, curr) => acc + curr.length, 0)} permisos</Badge>
                                    </div>
                                    <label className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <Checkbox
                                            checked={allSelectedInModule}
                                            onCheckedChange={() => toggleSelectAllCategory(allModulePerms)}
                                        />
                                        <span className="text-sm text-foreground">Marcar Todo Gestión</span>
                                    </label>
                                </div>

                                <div className="mt-4">
                                    {Object.entries(submodules).map(([subName, perms], idx) => (
                                        <div key={subName} className={idx > 0 ? 'mt-6' : undefined}>
                                            <div className="mb-2 flex items-center gap-2">
                                                <span className="text-[11px] font-semibold text-primary">{subName}</span>
                                                <Badge variant="secondary">{perms.length}</Badge>
                                                <div className="h-px flex-1 bg-border" />
                                            </div>
                                            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                                                {perms.map(p => renderPermissionCard(p))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            Object.entries(submodules).map(([subName, perms]) => {
                                const subId = `${moduleName}:${subName}`;
                                const isExpanded = expandedSubmodules[subId] !== false;
                                const allSubSelected = perms.every(p => selectedPermissions.includes(p.id_permiso));

                                return (
                                    <div key={subName} className="rounded-lg border border-border p-4">
                                        <div
                                            className="flex cursor-pointer flex-wrap items-center justify-between gap-2"
                                            onClick={() => toggleSubmodule(moduleName, subName)}
                                        >
                                            <div className="flex items-center gap-2">
                                                {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                                                <span className="text-[13px] font-semibold uppercase text-foreground">{subName}</span>
                                                <Badge variant="secondary">{perms.length} permisos</Badge>
                                            </div>
                                            <label className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={allSubSelected}
                                                    onCheckedChange={() => toggleSelectAllCategory(perms)}
                                                />
                                                <span className="text-sm text-foreground">Marcar Submódulo</span>
                                            </label>
                                        </div>

                                        {isExpanded && (
                                            <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                                                {perms.map(p => renderPermissionCard(p))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="flex h-[85vh] max-w-5xl flex-col gap-0 p-0">
                <DialogHeader className="border-b border-border p-4">
                    <div className="flex items-center gap-2">
                        <IconShield size={22} className="text-primary" />
                        <div>
                            <DialogTitle>{role ? 'Configurar Rol / Permisos' : 'Crear Nuevo Rol de Acceso'}</DialogTitle>
                            <p className="text-xs text-muted-foreground">{role ? `Editando: ${role.nombre_rol}` : 'Define capacidades del sistema'}</p>
                        </div>
                    </div>
                </DialogHeader>

                <div className={cn('flex flex-1 overflow-hidden', isMobile ? 'flex-col' : 'flex-row')}>
                    {isMobile ? (
                        <>
                            <div className="flex flex-col gap-2 border-b border-border bg-muted/40 p-4">
                                <Button
                                    variant={activeTab === 'GENERAL' ? 'default' : 'outline'}
                                    className="w-full"
                                    onClick={() => setActiveTab('GENERAL')}
                                >
                                    <IconInfoCircle size={16} /> Info. General
                                </Button>

                                <div className="relative">
                                    <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar permisos..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-8"
                                    />
                                </div>

                                <Combobox
                                    placeholder="Seleccionar módulo..."
                                    options={Object.keys(hierarchicalPermissions).map(mod => ({ value: mod, label: mod }))}
                                    value={activeTab === 'GENERAL' ? undefined : activeTab}
                                    onValueChange={(val) => val && setActiveTab(val)}
                                    className="w-full"
                                />
                            </div>
                            <div className="flex min-h-0 flex-1">
                                {activeTab === 'GENERAL' ? generalPanel : (
                                    hierarchicalPermissions[activeTab] ? renderModulePanel(activeTab, hierarchicalPermissions[activeTab]) : generalPanel
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex w-[280px] flex-col border-r border-border bg-muted/40 p-3">
                                <div className="relative mb-4">
                                    <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar permisos..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-8"
                                    />
                                </div>

                                <button
                                    onClick={() => setActiveTab('GENERAL')}
                                    className={cn(
                                        'mb-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold',
                                        activeTab === 'GENERAL' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
                                    )}
                                >
                                    <IconInfoCircle size={16} />
                                    Info. General
                                </button>

                                <div className="my-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                                    <span>Módulos</span>
                                    <div className="h-px flex-1 bg-border" />
                                </div>

                                <div className="flex-1 overflow-y-auto">
                                    <div className="flex flex-col gap-1">
                                        {Object.entries(hierarchicalPermissions).map(([moduleName, submods]) => {
                                            const modulePerms = Object.values(submods).flat();
                                            const selectedInModule = modulePerms.filter(p => selectedPermissions.includes(p.id_permiso)).length;
                                            const isActive = activeTab === moduleName;

                                            return (
                                                <button
                                                    key={moduleName}
                                                    onClick={() => setActiveTab(moduleName)}
                                                    className={cn(
                                                        'flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold',
                                                        isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
                                                    )}
                                                >
                                                    {getModuleIcon(moduleName)}
                                                    <span className="flex-1 truncate">{moduleName}</span>
                                                    {selectedInModule > 0 && (
                                                        <Badge variant={isActive ? 'outline' : 'secondary'} className={isActive ? 'border-primary-foreground/40 text-primary-foreground' : undefined}>
                                                            {selectedInModule}
                                                        </Badge>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="flex min-h-0 flex-1">
                                {activeTab === 'GENERAL' ? generalPanel : (
                                    hierarchicalPermissions[activeTab] ? renderModulePanel(activeTab, hierarchicalPermissions[activeTab]) : generalPanel
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className={cn('flex justify-end gap-2 border-t border-border bg-muted/40 p-6', isMobile && 'flex-col pb-[60px]')}>
                    <Button variant="outline" className={isMobile ? 'w-full' : undefined} onClick={onClose}>
                        Cancelar / Descartar
                    </Button>
                    <Button
                        disabled={loading}
                        onClick={handleSave}
                        className={isMobile ? 'w-full' : undefined}
                    >
                        {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <IconCheck size={18} />}
                        Guardar Cambios
                    </Button>
                </div>
            </DialogContent>

            <ConfirmModal
                isOpen={confirmSaveOpen}
                title="Guardar Cambios de Permisos"
                message={`${affectedCount} usuario${affectedCount !== 1 ? 's' : ''} ${affectedCount !== 1 ? 'tienen' : 'tiene'} este rol asignado y ${affectedCount !== 1 ? 'serán desconectados' : 'será desconectado'} para aplicar los nuevos permisos. ¿Confirmas?`}
                confirmText="Sí, guardar"
                cancelText="Cancelar"
                confirmColor="#1c7ed6"
                onConfirm={doSave}
                onCancel={() => { setConfirmSaveOpen(false); setAffectedCount(null); }}
            />
        </Dialog>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
            {children}
        </div>
    );
}
