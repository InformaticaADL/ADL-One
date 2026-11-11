import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    IconSearch,
    IconEye,
    IconEyeOff,
} from '@tabler/icons-react';

import { Download, Ellipsis, Shield, UserCheck, UserPen, UserPlus, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Combobox } from '@/components/ui/combobox';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import type { ColumnDef, Table as TanTable } from '@tanstack/react-table';
import { AdvancedDataTable, DataTableColumnHeader } from '@/components/data-table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { useTemaNeutro } from '../../../hooks/useTemaNeutro';
import { useAuth } from '../../../contexts/AuthContext';
import { toastAccion } from '@/lib/toastAccion';
import { rbacService, type User, type CreateUserData, type UpdateUserData, type Role } from '../services/rbac.service';
import { catalogosService } from '../../medio-ambiente/services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';

interface Props {
    onBack?: () => void;
}

const PAGE_SIZE = 10;
// Mismo criterio de orden "es" (acentos, numérico) que usaba useTableSort.
const localeSort = (a: string, b: string) => (a || '').localeCompare(b || '', 'es', { numeric: true, sensitivity: 'base' });

const EMPTY_FORM: CreateUserData = {
    nombre_usuario: '',
    nombre_real: '',
    correo_electronico: '',
    id_cargo: undefined,
    clave_usuario: '',
};

const initials = (name: string) => (name || '?').trim().charAt(0).toUpperCase();

// Piloto shadcn/ui. Lista con orden por columna y paginación; crear/editar
// es una vista de página completa (no modal) con el cambio de contraseña
// integrado en la edición. Navegación solo por breadcrumb.
export const UsersManagementPage: React.FC<Props> = ({ onBack }) => {
    useTemaNeutro({ escala: true });
    const { showToast } = useToast();
    const { user: usuarioActual } = useAuth();

    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [cargos, setCargos] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Lista
    const tabla = useRef<TanTable<User> | null>(null);
    const [confirmBulk, setConfirmBulk] = useState<{ usuarios: User[]; limpiar: () => void } | null>(null);
    const [confirmUser, setConfirmUser] = useState<User | null>(null);

    // Formulario (vista de página)
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState<CreateUserData>(EMPTY_FORM);
    const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
    const [roleSearchTerm, setRoleSearchTerm] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [saving, setSaving] = useState(false);

    const isEdit = editingUser !== null;

    useEffect(() => {
        loadUsers();
        loadRoles();
        loadCargos();
    }, []);

    const loadCargos = async () => {
        try {
            setCargos(await catalogosService.getCargos());
        } catch (error) {
            console.error('Error loading cargos:', error);
        }
    };

    const loadUsers = async () => {
        try {
            setLoading(true);
            setUsers(await rbacService.getAllUsersWithStatus());
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cargar usuarios' });
        } finally {
            setLoading(false);
        }
    };

    const loadRoles = async () => {
        try {
            setRoles(await rbacService.getRoles());
        } catch (error) {
            console.error('Error loading roles:', error);
        }
    };

    // ---- Lista ----------------------------------------------------------

    const exportCsv = () => {
        const header = ['Usuario', 'Nombre', 'Email', 'Cargo', 'Roles', 'Estado', 'Ultimo acceso'];
        const rows = (tabla.current?.getFilteredRowModel().rows.map((r) => r.original) ?? users).map((u) => [
            u.nombre_usuario,
            u.nombre_real,
            u.correo_electronico || '',
            u.nombre_cargo || '',
            (u.roles || []).join(' | '),
            u.habilitado === 'S' ? 'Activo' : 'Inactivo',
            u.ultimo_acceso || 'Nunca',
        ]);
        const csv = [header, ...rows]
            .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `usuarios_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleToggleStatus = async () => {
        if (!confirmUser) return;
        const newStatus = confirmUser.habilitado !== 'S';
        try {
            setLoading(true);
            await rbacService.toggleUserStatus(confirmUser.id_usuario, newStatus);
            showToast({ type: 'success', message: `Usuario ${newStatus ? 'habilitado' : 'deshabilitado'} exitosamente` });
            setConfirmUser(null);
            loadUsers();
        } catch (error: any) {
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al cambiar estado del usuario' });
        } finally {
            setLoading(false);
        }
    };

    // ---- Formulario -----------------------------------------------------

    const resetForm = () => {
        setFormData(EMPTY_FORM);
        setSelectedRoles([]);
        setRoleSearchTerm('');
        setNewPassword('');
        setConfirmPassword('');
        setEditingUser(null);
    };

    const openCreate = () => {
        resetForm();
        setView('form');
    };

    const openEdit = async (user: User) => {
        resetForm();
        setEditingUser(user);
        setFormData({
            nombre_usuario: user.nombre_usuario,
            nombre_real: user.nombre_real,
            correo_electronico: user.correo_electronico || '',
            id_cargo: user.id_cargo,
            clave_usuario: '',
        });
        try {
            const userRoles = await rbacService.getUserRoles(user.id_usuario);
            setSelectedRoles(userRoles.map((r) => r.id_rol));
        } catch (error) {
            console.error('Error loading user roles:', error);
        }
        setView('form');
    };

    const closeForm = () => {
        resetForm();
        setView('list');
    };

    const toggleRole = (roleId: number) =>
        setSelectedRoles((prev) => (prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]));

    const visibleRoles = useMemo(() => {
        const term = roleSearchTerm.toLowerCase();
        return roles
            .filter((r) => r.estado && r.nombre_rol)
            .filter((r) => (r.nombre_rol ?? '').toLowerCase().includes(term) || (r.descripcion ?? '').toLowerCase().includes(term));
    }, [roles, roleSearchTerm]);

    const handleSubmit = async () => {
        if (!formData.nombre_real || !formData.nombre_usuario) {
            return showToast({ type: 'error', message: 'Completa el nombre real y el nombre de usuario' });
        }
        if (!isEdit && !newPassword) {
            return showToast({ type: 'error', message: 'Ingresa una contraseña inicial' });
        }
        if ((newPassword || confirmPassword) && newPassword !== confirmPassword) {
            return showToast({ type: 'error', message: 'Las contraseñas no coinciden' });
        }

        try {
            setSaving(true);
            if (isEdit && editingUser) {
                const updateData: UpdateUserData = {
                    nombre_usuario: formData.nombre_usuario,
                    nombre_real: formData.nombre_real,
                    correo_electronico: formData.correo_electronico,
                    id_cargo: formData.id_cargo,
                };
                await rbacService.updateUser(editingUser.id_usuario, updateData);
                await rbacService.assignRolesToUser(editingUser.id_usuario, selectedRoles);
                if (newPassword) {
                    await rbacService.updateUserPassword(editingUser.id_usuario, newPassword);
                }
                showToast({ type: 'success', message: 'Usuario actualizado exitosamente' });
            } else {
                const newUser = await rbacService.createUser({ ...formData, clave_usuario: newPassword });
                if (selectedRoles.length > 0) {
                    await rbacService.assignRolesToUser(newUser.id_usuario, selectedRoles);
                }
                showToast({ type: 'success', message: 'Usuario creado exitosamente' });
            }
            closeForm();
            loadUsers();
        } catch (error: any) {
            showToast({
                type: 'error',
                message: error.response?.data?.message || (isEdit ? 'Error al actualizar usuario' : 'Error al crear usuario'),
            });
        } finally {
            setSaving(false);
        }
    };

    // ---- Render: formulario ---------------------------------------------

    if (view === 'form') {
        const formTitle = isEdit ? 'Editar usuario' : 'Nuevo usuario';
        return (
            <div className="shadcn-scope w-full p-4 md:p-6">
                <PageHeader
                    title={formTitle}
                    subtitle={isEdit ? 'Actualiza los datos, la contraseña y los roles del usuario.' : 'Crea una cuenta de acceso y asígnale roles.'}
                    breadcrumbItems={[
                        { label: 'Informática', onClick: onBack },
                        { label: 'Usuarios', onClick: closeForm },
                        { label: formTitle },
                    ]}
                />

                {isEdit && editingUser && (
                    <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                        <Avatar className="h-11 w-11">
                            <AvatarFallback className="text-sm">{initials(editingUser.nombre_real)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">{editingUser.nombre_real}</p>
                            <p className="truncate text-xs text-muted-foreground">
                                @{editingUser.nombre_usuario} · Último acceso: {editingUser.ultimo_acceso ?? 'Nunca'}
                            </p>
                        </div>
                        <Badge variant={editingUser.habilitado === 'S' ? 'success' : 'destructive'}>
                            {editingUser.habilitado === 'S' ? 'Activo' : 'Inactivo'}
                        </Badge>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
                    <div className="flex flex-col gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Información personal</CardTitle>
                                <CardDescription>Datos de identificación y cargo del usuario.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field id="nombre_real" label="Nombre real" required>
                                        <Input
                                            id="nombre_real"
                                            placeholder="ej: Juan Pérez"
                                            value={formData.nombre_real}
                                            onChange={(e) => setFormData({ ...formData, nombre_real: e.target.value })}
                                        />
                                    </Field>
                                    <Field id="nombre_usuario" label="Nombre de usuario (login)" required>
                                        <Input
                                            id="nombre_usuario"
                                            placeholder="ej: jperez"
                                            value={formData.nombre_usuario}
                                            onChange={(e) => setFormData({ ...formData, nombre_usuario: e.target.value })}
                                        />
                                    </Field>
                                    <Field id="correo" label="Correo electrónico">
                                        <Input
                                            id="correo"
                                            type="email"
                                            placeholder="usuario@adldiagnostic.cl"
                                            value={formData.correo_electronico}
                                            onChange={(e) => setFormData({ ...formData, correo_electronico: e.target.value })}
                                        />
                                    </Field>
                                    <Field id="cargo" label="Cargo">
                                        <Combobox
                                            value={formData.id_cargo ? String(formData.id_cargo) : undefined}
                                            onValueChange={(v) => setFormData({ ...formData, id_cargo: v ? Number(v) : undefined })}
                                            placeholder="Selecciona el cargo"
                                            searchPlaceholder="Buscar cargo..."
                                            options={cargos.map((c) => ({ value: String(c.id_cargo), label: c.nombre_cargo }))}
                                        />
                                    </Field>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>{isEdit ? 'Cambiar contraseña' : 'Contraseña'}</CardTitle>
                                <CardDescription>
                                    {isEdit
                                        ? 'Opcional. Déjalo en blanco para mantener la contraseña actual.'
                                        : 'Contraseña inicial con la que el usuario ingresará al sistema.'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field id="password" label={isEdit ? 'Nueva contraseña' : 'Contraseña'} required={!isEdit}>
                                        <PasswordInput id="password" value={newPassword} onChange={setNewPassword} placeholder="••••••••" />
                                    </Field>
                                    <Field id="password_confirm" label="Confirmar contraseña" required={!isEdit}>
                                        <PasswordInput id="password_confirm" value={confirmPassword} onChange={setConfirmPassword} placeholder="••••••••" />
                                    </Field>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="h-fit lg:sticky lg:top-4">
                        <CardHeader>
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-col gap-1.5">
                                    <CardTitle>Roles y permisos</CardTitle>
                                    <CardDescription>{selectedRoles.length} de {roles.filter((r) => r.estado).length} roles asignados</CardDescription>
                                </div>
                                {selectedRoles.length > 0 && (
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSelectedRoles([])}>
                                        Quitar todos
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            <div className="relative">
                                <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar rol..."
                                    value={roleSearchTerm}
                                    onChange={(e) => setRoleSearchTerm(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                            <div className="max-h-[440px] overflow-y-auto rounded-lg border border-border">
                                {visibleRoles.length === 0 ? (
                                    <p className="p-6 text-center text-sm text-muted-foreground">Sin roles que coincidan</p>
                                ) : (
                                    visibleRoles.map((role) => {
                                        const checked = selectedRoles.includes(role.id_rol);
                                        return (
                                            <label
                                                key={role.id_rol}
                                                htmlFor={`role-${role.id_rol}`}
                                                className={cn(
                                                    'flex cursor-pointer items-start gap-3 border-b border-border px-3 py-2.5 transition-colors last:border-b-0',
                                                    checked ? 'bg-primary/5' : 'hover:bg-muted/60'
                                                )}
                                            >
                                                <Checkbox
                                                    id={`role-${role.id_rol}`}
                                                    checked={checked}
                                                    onCheckedChange={() => toggleRole(role.id_rol)}
                                                    className="mt-0.5"
                                                />
                                                <span className="min-w-0">
                                                    <span className="block text-sm font-medium text-foreground">{role.nombre_rol}</span>
                                                    {role.descripcion && (
                                                        <span className="block text-xs text-muted-foreground">{role.descripcion}</span>
                                                    )}
                                                </span>
                                            </label>
                                        );
                                    })
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
                    <Button variant="outline" onClick={closeForm} disabled={saving}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={saving}>
                        {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear usuario'}
                    </Button>
                </div>
            </div>
        );
    }

    // ---- Acciones masivas ----------------------------------------------

    const cambiarEstadoMasivo = (lista: User[], habilitar: boolean, limpiar: () => void) => {
        const accion = Promise.allSettled(lista.map((u) => rbacService.toggleUserStatus(u.id_usuario, habilitar))).then((res) => {
            const ok = res.filter((r) => r.status === 'fulfilled').length;
            if (ok === 0) throw new Error('No se pudo actualizar ningún usuario');
            return { ok, fallidos: res.length - ok };
        });
        limpiar();
        toastAccion(accion, {
            cargando: habilitar ? 'Habilitando usuarios...' : 'Deshabilitando usuarios...',
            exito: (r) => {
                const palabra = habilitar ? (r.ok === 1 ? 'habilitado' : 'habilitados') : (r.ok === 1 ? 'deshabilitado' : 'deshabilitados');
                return `${r.ok} ${r.ok === 1 ? 'usuario' : 'usuarios'} ${palabra}${r.fallidos ? ` · ${r.fallidos} con error` : ''}.`;
            },
        });
        accion.then(() => loadUsers()).catch(() => undefined);
    };

    // ---- Render: lista --------------------------------------------------

    const statusBadge = (user: User) => {
        const activo = user.habilitado === 'S';
        return (
            <Badge variant="outline" className={cn('capitalize', activo ? 'border-teal-200 bg-teal-100/30 text-teal-900 dark:text-teal-200' : 'border-neutral-300 bg-neutral-300/40')}>
                {activo ? 'Activo' : 'Inactivo'}
            </Badge>
        );
    };

    // Menú de la fila, como el de la plantilla: botón fantasma con puntos horizontales y los íconos a la derecha de cada opción.
    const rowActions = (user: User) => {
        const activo = user.habilitado === 'S';
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="flex h-8 w-8 p-0 data-[state=open]:bg-muted">
                        <Ellipsis className="h-4 w-4" />
                        <span className="sr-only">Abrir menú de {user.nombre_real || user.nombre_usuario}</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[160px]">
                    <DropdownMenuItem onSelect={() => openEdit(user)}>
                        Editar <span className="ms-auto"><UserPen size={16} /></span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setConfirmUser(user)} className={activo ? 'text-red-500' : undefined}>
                        {activo ? 'Deshabilitar' : 'Habilitar'} <span className="ms-auto">{activo ? <UserX size={16} /> : <UserCheck size={16} />}</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };

    const userColumns: ColumnDef<User>[] = [
        {
            id: 'usuario',
            meta: { titulo: 'Usuario' },
            enableHiding: false,
            header: ({ column }) => <DataTableColumnHeader column={column} title="Usuario" />,
            accessorFn: (u) => u.nombre_usuario || '',
            sortingFn: (a, b) => localeSort(a.getValue('usuario'), b.getValue('usuario')),
            cell: ({ row }) => <span className="ps-3">{row.original.nombre_usuario}</span>,
        },
        {
            id: 'nombre',
            meta: { titulo: 'Nombre' },
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
            accessorFn: (u) => u.nombre_real || '',
            sortingFn: (a, b) => localeSort(a.getValue('nombre'), b.getValue('nombre')),
            cell: ({ row }) => <span>{row.original.nombre_real}</span>,
        },
        {
            id: 'correo',
            meta: { titulo: 'Correo', className: 'hidden md:table-cell' },
            header: ({ column }) => <DataTableColumnHeader column={column} title="Correo" />,
            accessorFn: (u) => u.correo_electronico || '',
            sortingFn: (a, b) => localeSort(a.getValue('correo'), b.getValue('correo')),
            cell: ({ row }) => <span className="ps-2">{row.original.correo_electronico || '-'}</span>,
        },
        {
            id: 'cargo',
            meta: { titulo: 'Cargo', className: 'hidden lg:table-cell' },
            header: ({ column }) => <DataTableColumnHeader column={column} title="Cargo" />,
            accessorFn: (u) => u.nombre_cargo || '',
            sortingFn: (a, b) => localeSort(a.getValue('cargo'), b.getValue('cargo')),
            cell: ({ row }) => <span className="ps-2">{row.original.nombre_cargo || '-'}</span>,
        },
        {
            id: 'estado',
            meta: { titulo: 'Estado' },
            enableHiding: false,
            enableSorting: false,
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
            accessorFn: (u) => (u.habilitado === 'S' ? 'Activo' : 'Inactivo'),
            filterFn: (row, id, valor: string[]) => valor.includes(row.getValue(id)),
            cell: ({ row }) => <div className="flex space-x-2">{statusBadge(row.original)}</div>,
        },
        {
            id: 'roles',
            meta: { titulo: 'Roles' },
            enableHiding: false,
            header: ({ column }) => <DataTableColumnHeader column={column} title="Roles" />,
            accessorFn: (u) => (u.roles && u.roles.length > 0 ? u.roles.join(', ') : ''),
            getUniqueValues: (u) => u.roles ?? [],
            filterFn: (row, _id, valor: string[]) => valor.some((v) => row.original.roles?.includes(v)),
            sortingFn: (a, b) => localeSort(a.getValue('roles'), b.getValue('roles')),
            cell: ({ row }) => (
                <div className="flex items-center gap-x-4">
                    {(row.original.roles ?? []).map((rol) => (
                        <div key={rol} className="flex items-center gap-x-2">
                            <Shield size={16} className="text-muted-foreground" />
                            <span className="text-sm">{rol}</span>
                        </div>
                    ))}
                </div>
            ),
        },
        {
            id: 'ultimo_acceso',
            meta: { titulo: 'Último acceso', className: 'hidden xl:table-cell' },
            header: ({ column }) => <DataTableColumnHeader column={column} title="Último acceso" />,
            accessorFn: (u) => u.ultimo_acceso || '',
            sortingFn: (a, b) => localeSort(a.getValue('ultimo_acceso'), b.getValue('ultimo_acceso')),
            cell: ({ row }) => <span className="ps-2">{row.original.ultimo_acceso ?? 'Nunca'}</span>,
        },
        {
            id: 'acciones',
            enableHiding: false,
            enableSorting: false,
            header: () => null,
            cell: ({ row }) => rowActions(row.original),
        },
    ];

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Usuarios"
                subtitle="Administra accesos y roles del personal."
                breadcrumbItems={[{ label: 'Informática', onClick: onBack }, { label: 'Usuarios' }]}
                rightSection={
                    <div className="flex gap-2">
                        <Button variant="outline" className="space-x-1" onClick={exportCsv}>
                            <span>Exportar</span> <Download size={18} />
                        </Button>
                        <Button className="space-x-1" onClick={openCreate}>
                            <span>Nuevo usuario</span> <UserPlus size={18} />
                        </Button>
                    </div>
                }
            />

            <div className="mt-6 flex flex-col gap-4">
                <AdvancedDataTable
                    columns={userColumns}
                    data={users}
                    getRowId={(u) => String(u.id_usuario)}
                    cargando={loading}
                    pageSize={PAGE_SIZE}
                    mensajeVacio="No se encontraron usuarios"
                    busqueda={{
                        placeholder: 'Buscar usuarios...',
                        texto: (u) => [u.nombre_usuario, u.nombre_real, u.correo_electronico, u.nombre_cargo].filter(Boolean).join(' '),
                    }}
                    filtrosIniciales={[{ id: 'estado', value: ['Activo'] }]}
                    filtros={[
                        { columna: 'estado', titulo: 'Estado', opciones: [{ label: 'Activo', value: 'Activo' }, { label: 'Inactivo', value: 'Inactivo' }] },
                        { columna: 'roles', titulo: 'Rol', opciones: roles.filter((r) => r.nombre_rol).map((r) => ({ label: String(r.nombre_rol), value: String(r.nombre_rol) })) },
                    ]}
                    onTabla={(t) => { tabla.current = t; }}
                    entidad={{ singular: 'usuario', plural: 'usuarios' }}
                    accionesMasivas={(t) => {
                        const elegidos = t.getFilteredSelectedRowModel().rows.map((r) => r.original);
                        const aHabilitar = elegidos.filter((u) => u.habilitado !== 'S');
                        // Nunca se deshabilita la propia cuenta desde acá: quedaría fuera del sistema.
                        const aDeshabilitar = elegidos.filter((u) => u.habilitado === 'S' && u.id_usuario !== usuarioActual?.id);
                        return (
                            <>
                                <Button variant="outline" size="sm" className="text-sm" disabled={aHabilitar.length === 0} title={aHabilitar.length ? undefined : 'Todos los elegidos ya están habilitados'}
                                    onClick={() => cambiarEstadoMasivo(aHabilitar, true, () => t.resetRowSelection())}>
                                    <UserCheck size={16} /> Habilitar{aHabilitar.length ? ` (${aHabilitar.length})` : ''}
                                </Button>
                                <Button variant="outline" size="sm" className="text-sm" disabled={aDeshabilitar.length === 0} title={aDeshabilitar.length ? undefined : 'No hay usuarios habilitados para deshabilitar'}
                                    onClick={() => setConfirmBulk({ usuarios: aDeshabilitar, limpiar: () => t.resetRowSelection() })}>
                                    <UserX size={16} /> Deshabilitar{aDeshabilitar.length ? ` (${aDeshabilitar.length})` : ''}
                                </Button>
                            </>
                        );
                    }}
                />
            </div>

            <Dialog open={confirmBulk !== null} onOpenChange={(open) => { if (!open) setConfirmBulk(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Deshabilitar {confirmBulk?.usuarios.length === 1 ? 'usuario' : 'usuarios'}</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        {confirmBulk?.usuarios.length === 1
                            ? `¿Deshabilitar a "${confirmBulk.usuarios[0].nombre_real}"? No podrá acceder al sistema.`
                            : `¿Deshabilitar a ${confirmBulk?.usuarios.length} usuarios? No podrán acceder al sistema.`}
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmBulk(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={() => { if (confirmBulk) cambiarEstadoMasivo(confirmBulk.usuarios, false, confirmBulk.limpiar); setConfirmBulk(null); }}>
                            Deshabilitar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={confirmUser !== null} onOpenChange={(open) => { if (!open) setConfirmUser(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{confirmUser?.habilitado === 'S' ? 'Deshabilitar usuario' : 'Habilitar usuario'}</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        {confirmUser?.habilitado === 'S'
                            ? `¿Deshabilitar a "${confirmUser?.nombre_real}"? No podrá acceder al sistema.`
                            : `¿Habilitar a "${confirmUser?.nombre_real}"? Podrá acceder nuevamente.`}
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmUser(null)}>Cancelar</Button>
                        <Button variant={confirmUser?.habilitado === 'S' ? 'destructive' : 'default'} onClick={handleToggleStatus}>
                            {confirmUser?.habilitado === 'S' ? 'Deshabilitar' : 'Habilitar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

function Field({ id, label, required, children }: { id: string; label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
                {label}{required && <span className="text-destructive"> *</span>}
            </Label>
            {children}
        </div>
    );
}

function PasswordInput({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
    const [visible, setVisible] = useState(false);
    return (
        <div className="relative">
            <Input
                id={id}
                type={visible ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="pr-9"
            />
            <button
                type="button"
                aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setVisible((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
                {visible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </button>
        </div>
    );
}

export default UsersManagementPage;
