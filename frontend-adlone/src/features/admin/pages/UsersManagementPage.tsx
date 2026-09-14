import React, { useState, useEffect, useMemo } from 'react';
import {
    IconSearch,
    IconPlus,
    IconPencil,
    IconUserOff,
    IconUserCheck,
    IconEye,
    IconEyeOff,
    IconColumns3,
    IconDownload,
    IconX,
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Combobox } from '@/components/ui/combobox';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, SortableTableHead, TableCell } from '@/components/ui/table';
import { DataPagination } from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { useTableSort } from '../../../hooks/useTableSort';
import { rbacService, type User, type CreateUserData, type UpdateUserData, type Role } from '../services/rbac.service';
import { catalogosService } from '../../medio-ambiente/services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';

interface Props {
    onBack?: () => void;
}

type SortKey = 'nombre' | 'cargo' | 'roles' | 'estado' | 'ultimo_acceso';

const SORT_ACCESSORS: Record<SortKey, (u: User) => string | number | null | undefined> = {
    nombre: (u) => u.nombre_real || u.nombre_usuario,
    cargo: (u) => u.nombre_cargo,
    roles: (u) => (u.roles && u.roles.length > 0 ? u.roles.join(', ') : null),
    estado: (u) => (u.habilitado === 'S' ? 0 : 1),
    ultimo_acceso: (u) => u.ultimo_acceso,
};

const PAGE_SIZE = 10;

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
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { showToast } = useToast();

    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [cargos, setCargos] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Lista
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('active');
    const [filterRole, setFilterRole] = useState<string>('all');
    const [page, setPage] = useState(1);
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

    const filteredUsers = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return users.filter((user) => {
            const matchesSearch =
                (user.nombre_usuario ?? '').toLowerCase().includes(term) ||
                (user.nombre_real ?? '').toLowerCase().includes(term) ||
                (user.correo_electronico ?? '').toLowerCase().includes(term);
            const matchesStatus =
                filterStatus === 'all' ||
                (filterStatus === 'active' && user.habilitado === 'S') ||
                (filterStatus === 'inactive' && user.habilitado === 'N');
            const matchesRole = filterRole === 'all' || (user.roles && user.roles.includes(filterRole));
            return matchesSearch && matchesStatus && matchesRole;
        });
    }, [users, searchTerm, filterStatus, filterRole]);

    const { sorted, sort, toggleSort } = useTableSort(filteredUsers, SORT_ACCESSORS);

    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const paginatedUsers = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const sortProps = (key: SortKey) => ({
        active: sort.key === key,
        direction: sort.direction,
        onSort: () => { toggleSort(key); setPage(1); },
    });

    const exportCsv = () => {
        const header = ['Usuario', 'Nombre', 'Email', 'Cargo', 'Roles', 'Estado', 'Ultimo acceso'];
        const rows = sorted.map((u) => [
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
                        { label: 'Administración', onClick: onBack },
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

    // ---- Render: lista --------------------------------------------------

    const statusBadge = (user: User) => (
        <Badge variant={user.habilitado === 'S' ? 'success' : 'destructive'}>
            {user.habilitado === 'S' ? 'Activo' : 'Inactivo'}
        </Badge>
    );

    const rowActions = (user: User) => (
        <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" aria-label="Editar" onClick={() => openEdit(user)}>
                <IconPencil size={16} />
            </Button>
            {user.habilitado === 'S' ? (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    title="Deshabilitar"
                    aria-label="Deshabilitar"
                    onClick={() => setConfirmUser(user)}
                >
                    <IconUserOff size={16} />
                </Button>
            ) : (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-success hover:bg-success/10 hover:text-success"
                    title="Habilitar"
                    aria-label="Habilitar"
                    onClick={() => setConfirmUser(user)}
                >
                    <IconUserCheck size={16} />
                </Button>
            )}
        </div>
    );

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Usuarios"
                subtitle="Administra accesos y roles del personal."
                breadcrumbItems={[{ label: 'Administración', onClick: onBack }, { label: 'Usuarios' }]}
                rightSection={
                    <Button onClick={openCreate} className={cn(isMobile && 'w-full')}>
                        <IconPlus size={16} /> Nuevo usuario
                    </Button>
                }
            />

            <div className="mt-6 flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <Tabs value={filterStatus} onValueChange={(v) => { setFilterStatus(v as typeof filterStatus); setPage(1); }}>
                        <TabsList>
                            <TabsTrigger value="all">Todos</TabsTrigger>
                            <TabsTrigger value="active">Activos</TabsTrigger>
                            <TabsTrigger value="inactive">Inactivos</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <span className="text-sm text-muted-foreground">{filteredUsers.length} resultados</span>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <div className="relative">
                            <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Buscar usuarios..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                                className="pl-8 sm:w-96"
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    aria-label="Limpiar búsqueda"
                                    onClick={() => { setSearchTerm(''); setPage(1); }}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <IconX size={14} />
                                </button>
                            )}
                        </div>
                        <Combobox
                            value={filterRole}
                            onValueChange={(v) => { setFilterRole(v); setPage(1); }}
                            placeholder="Rol"
                            searchPlaceholder="Buscar rol..."
                            className="sm:w-48"
                            options={[
                                { value: 'all', label: 'Todos los roles' },
                                ...roles.filter((r) => r.nombre_rol).map((r) => ({ value: String(r.nombre_rol), label: r.nombre_rol })),
                            ]}
                        />
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" title="Elegir columnas visibles (próximamente)">
                            <IconColumns3 size={15} /> Columnas
                        </Button>
                        <Button variant="outline" size="sm" onClick={exportCsv}>
                            <IconDownload size={15} /> Exportar
                        </Button>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-xl border border-border bg-card">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    )}

                    {isMobile ? (
                        <div className="flex flex-col divide-y divide-border">
                            {paginatedUsers.length > 0 ? paginatedUsers.map((user) => (
                                <div key={user.id_usuario} className="flex items-start gap-3 p-3">
                                    <Avatar>
                                        <AvatarFallback>{initials(user.nombre_real)}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="truncate text-sm font-semibold text-foreground">{user.nombre_real}</p>
                                            {statusBadge(user)}
                                        </div>
                                        <p className="truncate text-xs text-muted-foreground">{user.correo_electronico || `@${user.nombre_usuario}`}</p>
                                        <p className="mt-1 truncate text-xs text-muted-foreground">{user.nombre_cargo || 'Sin cargo'}</p>
                                        <div className="mt-2 flex items-center justify-between gap-2">
                                            <div className="flex min-w-0 flex-wrap gap-1">
                                                {user.roles?.map((rol, i) => <Badge key={i} variant="outline">{rol}</Badge>)}
                                            </div>
                                            {rowActions(user)}
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <p className="p-6 text-center text-sm text-muted-foreground">No se encontraron usuarios</p>
                            )}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <SortableTableHead {...sortProps('nombre')}>Usuario</SortableTableHead>
                                    <SortableTableHead {...sortProps('cargo')}>Cargo</SortableTableHead>
                                    <SortableTableHead {...sortProps('roles')}>Roles</SortableTableHead>
                                    <SortableTableHead {...sortProps('estado')}>Estado</SortableTableHead>
                                    <SortableTableHead {...sortProps('ultimo_acceso')}>Último acceso</SortableTableHead>
                                    <TableHead className="w-24 text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedUsers.length > 0 ? paginatedUsers.map((user) => (
                                    <TableRow key={user.id_usuario}>
                                        <TableCell>
                                            <div className="flex items-center gap-2.5">
                                                <Avatar>
                                                    <AvatarFallback>{initials(user.nombre_real)}</AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-foreground">{user.nombre_real}</p>
                                                    <p className="truncate text-xs text-muted-foreground">{user.correo_electronico || `@${user.nombre_usuario}`}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{user.nombre_cargo || '-'}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {user.roles?.map((rol, i) => <Badge key={i} variant="outline">{rol}</Badge>)}
                                            </div>
                                        </TableCell>
                                        <TableCell>{statusBadge(user)}</TableCell>
                                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{user.ultimo_acceso ?? 'Nunca'}</TableCell>
                                        <TableCell>{rowActions(user)}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No se encontraron usuarios</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>

                <DataPagination page={currentPage} pageSize={PAGE_SIZE} total={sorted.length} onPageChange={setPage} />
            </div>

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
