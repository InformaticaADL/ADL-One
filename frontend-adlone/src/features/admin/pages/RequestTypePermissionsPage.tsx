import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    IconSettings,
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { ursService } from '../../../services/urs.service';
import { rbacService } from '../services/rbac.service';
import type { Role, User as UserType } from '../services/rbac.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';

interface RequestType {
    id_tipo: number;
    nombre: string;
    area_destino: string;
    modulo_destino?: string | null;
    estado: boolean;
}

type AccessType = 'ENVIO' | 'VISTA' | 'GESTION' | 'DERIVACION' | 'DESTINO_DERIVACION';

interface PermissionEntry {
    type: 'role' | 'user';
    id: number;
    name: string;
    ENVIO: boolean;
    VISTA: boolean;
    GESTION: boolean;
    DERIVACION: boolean;
    DESTINO_DERIVACION: boolean;
    isNew?: boolean;
    membersLoaded?: boolean;
    members?: string[];
}

const ACCESS_LABELS: { key: AccessType; label: string; icon: React.ReactNode }[] = [
    { key: 'ENVIO', label: 'Crear', icon: <IconPlus size={14} /> },
    { key: 'VISTA', label: 'Solo ver', icon: <IconEye size={14} /> },
    { key: 'GESTION', label: 'Accionar', icon: <IconUserCheck size={14} /> },
    { key: 'DERIVACION', label: 'Derivar', icon: <IconGitBranch size={14} /> },
    { key: 'DESTINO_DERIVACION', label: 'Recibir derivación', icon: <IconUser size={14} /> },
];

interface Props {
    requestType: RequestType;
    onBack: () => void;
}

const RequestTypePermissionsPage: React.FC<Props> = ({ requestType, onBack }) => {
    const { showToast } = useToast();
    const isMobile = useMediaQuery('(max-width: 768px)');
    const isCompact = useMediaQuery('(max-width: 1200px)');

    const [entries, setEntries] = useState<PermissionEntry[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [users, setUsers] = useState<UserType[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [typeName, setTypeName] = useState(requestType.nombre);
    const [areaDestino, setAreaDestino] = useState(requestType.area_destino);
    const [moduloDestino, setModuloDestino] = useState(requestType.modulo_destino || '');
    const [isEditingHeader, setIsEditingHeader] = useState(false);

    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
    const [loadingMembersIdx, setLoadingMembersIdx] = useState<number | null>(null);
    const [userRolesMap, setUserRolesMap] = useState<Map<number, number[]>>(new Map());
    const [addRole, setAddRole] = useState<string | undefined>(undefined);
    const [addUser, setAddUser] = useState<string | undefined>(undefined);

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
                    if (!map.has(key)) map.set(key, { type: 'role', id: p.id_rol, name: p.nombre_rol || `Rol ${p.id_rol}`, ENVIO: false, VISTA: false, GESTION: false, DERIVACION: false, DESTINO_DERIVACION: false });
                } else if (p.id_usuario) {
                    key = `user_${p.id_usuario}`;
                    if (!map.has(key)) map.set(key, { type: 'user', id: p.id_usuario, name: p.nombre_real || p.nombre_usuario || `Usuario ${p.id_usuario}`, ENVIO: false, VISTA: false, GESTION: false, DERIVACION: false, DESTINO_DERIVACION: false });
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

    const rolesInList = useMemo(() => new Set(entries.filter((e) => e.type === 'role').map((e) => e.id)), [entries]);

    const userOverlapsWithRole = (userId: number): boolean => {
        const userRoles = userRolesMap.get(userId) || [];
        return userRoles.some((rId) => rolesInList.has(rId));
    };

    const toggleCell = (idx: number, access: AccessType) =>
        setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, [access]: !e[access] } : e)));

    const removeEntry = (idx: number) => {
        setEntries((prev) => prev.filter((_, i) => i !== idx));
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
                memberNames = roleUsers.map((u) => u.nombre_real || u.nombre_usuario);
            } else {
                const userRoles = await rbacService.getUserRoles(entry.id);
                memberNames = userRoles.map((r) => r.nombre_rol);
                setUserRolesMap((prev) => new Map(prev).set(entry.id, userRoles.map((r) => r.id_rol)));
            }
            setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, membersLoaded: true, members: memberNames } : e)));
            setExpandedIdx(idx);
        } catch {
            showToast({ type: 'error', message: 'Error al cargar detalles de la entidad' });
        } finally {
            setLoadingMembersIdx(null);
        }
    };

    const addEntry = async (type: 'role' | 'user', idValue?: string) => {
        if (!idValue) return;
        const id = parseInt(idValue);
        const item = type === 'role' ? roles.find((r) => r.id_rol === id) : users.find((u) => u.id_usuario === id);
        if (!item) return;

        const name = type === 'role' ? (item as Role).nombre_rol : ((item as UserType).nombre_real || (item as UserType).nombre_usuario);
        const key = `${type}_${id}`;

        if (entries.some((e) => `${e.type}_${e.id}` === key)) {
            showToast({ type: 'warning', message: 'Esta entidad ya está en la lista.' });
            return;
        }

        const newEntry: PermissionEntry = { type, id, name, ENVIO: false, VISTA: false, GESTION: false, DERIVACION: false, DESTINO_DERIVACION: false, isNew: true };
        setEntries((prev) => [...prev, newEntry]);
        if (type === 'role') setAddRole(undefined); else setAddUser(undefined);

        if (type === 'user') {
            try {
                const userRoles = await rbacService.getUserRoles(id);
                setUserRolesMap((prev) => new Map(prev).set(id, userRoles.map((r) => r.id_rol)));
                setEntries((prev) => prev.map((e) =>
                    e.type === 'user' && e.id === id ? { ...e, membersLoaded: true, members: userRoles.map((r) => r.nombre_rol) } : e
                ));
            } catch { /* silent */ }
        }
    };

    const save = async () => {
        try {
            setSaving(true);

            if (typeName !== requestType.nombre || areaDestino !== requestType.area_destino) {
                await ursService.createUpdateType(requestType.id_tipo, {
                    nombre: typeName,
                    area_destino: areaDestino,
                    modulo_destino: moduloDestino || null,
                    estado: requestType.estado,
                });
            }

            const currentPerms = await ursService.getPermissions(requestType.id_tipo);
            const toAdd: any[] = [];
            const toDeleteIds: number[] = [];

            entries.forEach((entry) => {
                (['ENVIO', 'VISTA', 'GESTION', 'DERIVACION', 'DESTINO_DERIVACION'] as AccessType[]).forEach((access) => {
                    const existing = currentPerms.find((p: any) =>
                        entry.type === 'role' ? p.id_rol === entry.id && p.tipo_acceso === access : p.id_usuario === entry.id && p.tipo_acceso === access
                    );
                    if (entry[access] && !existing) toAdd.push({ ...(entry.type === 'role' ? { id_rol: entry.id } : { id_usuario: entry.id }), tipo_acceso: access });
                    else if (!entry[access] && existing) toDeleteIds.push(existing.id_permiso_sol);
                });
            });

            currentPerms.forEach((p: any) => {
                const key = p.id_rol ? `role_${p.id_rol}` : `user_${p.id_usuario}`;
                if (!entries.some((e) => `${e.type}_${e.id}` === key) && !toDeleteIds.includes(p.id_permiso_sol)) {
                    toDeleteIds.push(p.id_permiso_sol);
                }
            });

            await Promise.allSettled([
                ...toAdd.map((item) => ursService.addPermission(requestType.id_tipo, item)),
                ...toDeleteIds.map((id) => ursService.removePermission(id)),
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
        .filter((r) => !entries.some((e) => e.type === 'role' && e.id === r.id_rol))
        .map((r) => ({ value: r.id_rol.toString(), label: r.nombre_rol }));

    const usersOptions = users
        .filter((u) => !entries.some((e) => e.type === 'user' && e.id === u.id_usuario))
        .map((u) => ({
            value: u.id_usuario.toString(),
            label: (u.nombre_real || u.nombre_usuario) + (userOverlapsWithRole(u.id_usuario) ? ' (⚠ Rol ya activo)' : ''),
        }));

    const renderMembers = (entry: PermissionEntry) => (
        <div className="rounded-lg bg-muted/50 p-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase text-muted-foreground">
                {entry.type === 'role' ? 'Usuarios asignados a este rol' : 'Roles que posee el usuario'}
            </p>
            <div className="flex flex-wrap gap-1.5">
                {entry.members && entry.members.length > 0 ? entry.members.map((m, i) => (
                    <Badge key={i} variant="outline">{m}</Badge>
                )) : (
                    <p className="text-xs italic text-muted-foreground">No se encontraron datos asociados.</p>
                )}
            </div>
        </div>
    );

    const entityIdentity = (entry: PermissionEntry, size: 'sm' | 'lg') => {
        const hasOverlap = entry.type === 'user' && userOverlapsWithRole(entry.id);
        return (
            <div className="flex min-w-0 items-center gap-3">
                <Avatar className={size === 'lg' ? 'h-10 w-10 rounded-lg' : 'rounded-lg'}>
                    <AvatarFallback className="rounded-lg">
                        {entry.type === 'role' ? <IconUsers size={size === 'lg' ? 18 : 14} /> : <IconUser size={size === 'lg' ? 18 : 14} />}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-foreground">{entry.name}</span>
                        {entry.isNew && <Badge variant="warning">Nuevo</Badge>}
                        {hasOverlap && (
                            <Badge variant="warning" title="Este usuario ya está cubierto por un rol activo">
                                <IconAlertTriangle size={10} className="mr-1" /> Rol activo
                            </Badge>
                        )}
                    </div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {entry.type === 'role' ? 'Rol' : 'Usuario'}
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title={`Permisos: ${typeName}`}
                subtitle={`Define quién puede crear, ver, gestionar o derivar el trámite "${typeName}".`}
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Administración', onClick: onBack },
                    { label: 'Solicitudes URS', onClick: onBack },
                    { label: 'Configuración de permisos' },
                ]}
                rightSection={
                    <Button onClick={save} disabled={saving}>
                        <IconDeviceFloppy size={16} /> {saving ? 'Guardando...' : 'Guardar cambios'}
                    </Button>
                }
            />

            <div className="mt-6 flex flex-col gap-4">
                <div className="rounded-xl border border-border bg-muted/40 p-4">
                    {isEditingHeader ? (
                        <div className="flex flex-wrap items-end gap-4">
                            <Field label="Nombre del trámite" className="min-w-[220px] flex-[2]">
                                <Input value={typeName} onChange={(e) => setTypeName(e.target.value)} placeholder="Ej: Solicitud de Vacaciones" />
                            </Field>
                            <Field label="Área responsable" className="min-w-[160px] flex-1">
                                <Input value={areaDestino} onChange={(e) => setAreaDestino(e.target.value)} placeholder="Ej: Recursos Humanos" />
                            </Field>
                            <Field label="Módulo UI (filtro)" className="min-w-[160px] flex-1">
                                <Input value={moduloDestino} onChange={(e) => setModuloDestino(e.target.value)} placeholder="Ej: EQUIPOS" />
                            </Field>
                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setIsEditingHeader(false)}>
                                <IconX size={18} />
                            </Button>
                        </div>
                    ) : (
                        <div>
                            <div className="mb-3 flex items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">Información básica del trámite</p>
                                <Button variant="ghost" size="icon" className="h-6 w-6" title="Editar nombre y área" onClick={() => setIsEditingHeader(true)}>
                                    <IconSettings size={14} />
                                </Button>
                            </div>
                            <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-4')}>
                                <div>
                                    <p className="text-xs text-muted-foreground">Nombre del trámite</p>
                                    <p className="truncate text-sm font-semibold text-foreground">{typeName}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Área destino / responsable</p>
                                    <Badge variant="outline" className="mt-1">{areaDestino}</Badge>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Estado actual</p>
                                    <Badge variant={requestType.estado ? 'success' : 'destructive'} className="mt-1">
                                        {requestType.estado ? 'Activo' : 'Inactivo'}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Módulo destino</p>
                                    <Badge variant="outline" className="mt-1">{moduloDestino || 'Ninguno'}</Badge>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="flex h-72 items-center justify-center">
                        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                ) : (
                    <div className={cn('overflow-hidden rounded-xl', !isCompact && 'border border-border bg-card')}>
                        {!isCompact ? (
                            entries.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-16">
                                    <IconUsers size={40} className="text-muted-foreground/30" />
                                    <p className="text-sm font-medium text-foreground">Sin entidades configuradas</p>
                                    <p className="text-xs text-muted-foreground">Usa los selectores de abajo para añadir roles o usuarios.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead>
                                                <span className="flex items-center gap-1.5"><IconShield size={13} /> Entidad</span>
                                            </TableHead>
                                            {ACCESS_LABELS.map((a) => (
                                                <TableHead key={a.key} className="w-28 text-center">
                                                    <span className="flex flex-col items-center gap-1">
                                                        {a.icon}
                                                        <span className="text-center">{a.label}</span>
                                                    </span>
                                                </TableHead>
                                            ))}
                                            <TableHead className="w-12" />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {entries.map((entry, idx) => {
                                            const isExpanded = expandedIdx === idx;
                                            const isLoadingThis = loadingMembersIdx === idx;
                                            return (
                                                <React.Fragment key={`${entry.type}_${entry.id}`}>
                                                    <TableRow className={cn(entry.isNew && 'bg-warning/5')}>
                                                        <TableCell>
                                                            <div className="flex flex-col gap-1">
                                                                {entityIdentity(entry, 'sm')}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 w-fit px-1.5 text-[10px] text-muted-foreground"
                                                                    onClick={() => loadMembers(idx, entry)}
                                                                >
                                                                    {isLoadingThis ? (
                                                                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                                                                    ) : isExpanded ? <IconChevronUp size={10} /> : <IconChevronDown size={10} />}
                                                                    {entry.type === 'role' ? 'Usuarios' : 'Roles'}
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                        {ACCESS_LABELS.map((a) => (
                                                            <TableCell key={a.key} className="text-center">
                                                                <Checkbox checked={entry[a.key]} onCheckedChange={() => toggleCell(idx, a.key)} />
                                                            </TableCell>
                                                        ))}
                                                        <TableCell>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeEntry(idx)}>
                                                                <IconX size={16} />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                    {isExpanded && (
                                                        <TableRow className="hover:bg-transparent">
                                                            <TableCell colSpan={7} className="bg-muted/20 py-3">
                                                                {renderMembers(entry)}
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )
                        ) : (
                            <div className="flex flex-col gap-3">
                                {entries.length === 0 ? (
                                    <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-10">
                                        <IconUsers size={40} className="text-muted-foreground/30" />
                                        <p className="text-sm font-medium text-foreground">Sin entidades configuradas</p>
                                        <p className="text-center text-xs text-muted-foreground">Usa los selectores de abajo para añadir roles o usuarios.</p>
                                    </div>
                                ) : (
                                    entries.map((entry, idx) => {
                                        const isExpanded = expandedIdx === idx;
                                        const isLoadingThis = loadingMembersIdx === idx;
                                        return (
                                            <div key={`${entry.type}_${entry.id}`} className="rounded-xl border border-border bg-card p-3.5">
                                                <div className="mb-3 flex items-start justify-between gap-2">
                                                    {entityIdentity(entry, 'lg')}
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeEntry(idx)}>
                                                        <IconX size={18} />
                                                    </Button>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    {ACCESS_LABELS.map((a) => (
                                                        <div
                                                            key={a.key}
                                                            onClick={() => toggleCell(idx, a.key)}
                                                            className={cn(
                                                                'flex cursor-pointer items-center justify-between rounded-lg border p-2',
                                                                entry[a.key] ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/30'
                                                            )}
                                                        >
                                                            <span className="flex items-center gap-1.5">
                                                                <span className={entry[a.key] ? 'text-primary' : 'text-muted-foreground'}>{a.icon}</span>
                                                                <span className={cn('text-xs font-medium', entry[a.key] ? 'text-foreground' : 'text-muted-foreground')}>{a.label}</span>
                                                            </span>
                                                            <Checkbox checked={entry[a.key]} onCheckedChange={() => toggleCell(idx, a.key)} onClick={(e) => e.stopPropagation()} />
                                                        </div>
                                                    ))}
                                                </div>

                                                <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => loadMembers(idx, entry)}>
                                                    {isLoadingThis ? (
                                                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                                                    ) : isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                                                    {entry.type === 'role' ? 'Ver usuarios del rol' : 'Ver roles del usuario'}
                                                </Button>

                                                {isExpanded && <div className="mt-2">{renderMembers(entry)}</div>}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        <div className={cn('flex flex-wrap items-start gap-4 p-4', !isCompact && 'border-t border-border bg-muted/40', isCompact && 'mt-2')}>
                            <Combobox
                                value={addRole}
                                onValueChange={(v) => { setAddRole(v); addEntry('role', v); }}
                                placeholder="Añadir rol..."
                                searchPlaceholder="Buscar rol..."
                                emptyText="No se encontraron roles"
                                className={isMobile ? 'w-full' : 'flex-1'}
                                options={rolesOptions}
                            />
                            <Combobox
                                value={addUser}
                                onValueChange={(v) => { setAddUser(v); addEntry('user', v); }}
                                placeholder="Añadir usuario..."
                                searchPlaceholder="Buscar usuario..."
                                emptyText="No se encontraron usuarios"
                                className={isMobile ? 'w-full' : 'flex-1'}
                                options={usersOptions}
                            />
                            <div className={cn('flex items-center gap-1.5', isMobile ? 'w-full justify-center text-center' : 'flex-[2]')}>
                                <IconInfoCircle size={14} className="shrink-0 text-muted-foreground" />
                                <p className="text-xs font-medium text-muted-foreground">
                                    Los <strong className="text-foreground">roles</strong> gestionan permisos de grupos. Los <strong className="text-foreground">usuarios</strong> definen excepciones.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
    return (
        <div className={className}>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</Label>
            {children}
        </div>
    );
}

export default RequestTypePermissionsPage;
