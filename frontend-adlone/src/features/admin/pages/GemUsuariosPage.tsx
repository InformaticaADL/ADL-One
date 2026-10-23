import React, { useState, useEffect, useMemo } from 'react';
import {
    IconSearch,
    IconPlus,
    IconPencil,
    IconUserOff,
    IconUserCheck,
    IconEye,
    IconEyeOff,
    IconDownload,
    IconX,
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { RowActionsMenu, type RowAction } from '@/components/ui/row-actions-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Combobox } from '@/components/ui/combobox';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { DataPagination } from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { gemUsuariosService } from '../services/gemUsuarios.service';
import type { User, CreateUserData, UpdateUserData } from '../services/rbac.service';
import { catalogosService } from '../../medio-ambiente/services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';

interface Props {
    onBack?: () => void;
}

interface Empresa {
    id_empresa: number;
    nombre_empresa: string;
}

const PAGE_SIZE = 10;
const localeSort = (a: string, b: string) => (a || '').localeCompare(b || '', 'es', { numeric: true, sensitivity: 'base' });

// Único cargo del área GEM MaM — confirmado en mae_cargo (id_cargo=81,
// "Asistente Gestión de muestras Medio Ambiente"), el combobox de Cargo se
// acota a este solo, en vez de mostrar el catálogo completo de la empresa.
const CARGO_GEM_ID = 81;

const EMPTY_FORM: CreateUserData = {
    nombre_usuario: '',
    nombre_real: '',
    correo_electronico: '',
    id_cargo: CARGO_GEM_ID,
    clave_usuario: '',
};

const initials = (name: string) => (name || '?').trim().charAt(0).toUpperCase();

// Gestión acotada para el Jefe Técnico: solo usuarios del rol "Área GEM MaM"
// (el backend ya filtra la lista) — crear, editar, deshabilitar/habilitar, y
// asignar una o más empresas a cargo. Calcada de UsersManagementPage.tsx, sin
// selector de roles (siempre GEM) y con "Empresas a cargo" en su lugar.
export const GemUsuariosPage: React.FC<Props> = ({ onBack }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { showToast } = useToast();

    const [users, setUsers] = useState<User[]>([]);
    const [cargos, setCargos] = useState<any[]>([]);
    const [empresas, setEmpresas] = useState<Empresa[]>([]);
    const [loading, setLoading] = useState(false);

    // Lista
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('active');
    const [mobilePage, setMobilePage] = useState(1);
    const [mobilePageSize, setMobilePageSize] = useState(PAGE_SIZE);
    const [confirmUser, setConfirmUser] = useState<User | null>(null);

    // Formulario (vista de página)
    const [view, setView] = useState<'list' | 'form'>('list');
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState<CreateUserData>(EMPTY_FORM);
    const [selectedEmpresas, setSelectedEmpresas] = useState<number[]>([]);
    const [empresaSearchTerm, setEmpresaSearchTerm] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [saving, setSaving] = useState(false);

    const isEdit = editingUser !== null;

    useEffect(() => {
        loadUsers();
        loadCargos();
        loadEmpresas();
    }, []);

    const loadCargos = async () => {
        try {
            const all = await catalogosService.getCargos();
            setCargos((all as any[]).filter((c) => c.id_cargo === CARGO_GEM_ID));
        } catch (error) {
            console.error('Error loading cargos:', error);
        }
    };

    const loadEmpresas = async () => {
        try {
            const data = await catalogosService.getClientes();
            setEmpresas((data as any[]).map((item) => ({ id_empresa: item.id_empresa, nombre_empresa: item.nombre_empresa })));
        } catch (error) {
            console.error('Error loading empresas:', error);
        }
    };

    const loadUsers = async () => {
        try {
            setLoading(true);
            setUsers(await gemUsuariosService.getUsuarios());
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cargar usuarios' });
        } finally {
            setLoading(false);
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
            return matchesSearch && matchesStatus;
        });
    }, [users, searchTerm, filterStatus]);

    const mobileTotalPages = Math.max(1, Math.ceil(filteredUsers.length / mobilePageSize));
    const mobileCurrentPage = Math.min(mobilePage, mobileTotalPages);
    const paginatedUsersMobile = filteredUsers.slice((mobileCurrentPage - 1) * mobilePageSize, mobileCurrentPage * mobilePageSize);

    const exportCsv = () => {
        const header = ['Usuario', 'Nombre', 'Email', 'Cargo', 'Estado', 'Ultimo acceso'];
        const rows = filteredUsers.map((u) => [
            u.nombre_usuario,
            u.nombre_real,
            u.correo_electronico || '',
            u.nombre_cargo || '',
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
        link.download = `usuarios_gem_${new Date().toISOString().slice(0, 10)}.csv`;
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
            await gemUsuariosService.toggleStatus(confirmUser.id_usuario, newStatus);
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
        setSelectedEmpresas([]);
        setEmpresaSearchTerm('');
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
            const asignadas = await gemUsuariosService.getEmpresas(user.id_usuario);
            setSelectedEmpresas(asignadas.map((e) => e.id_empresa));
        } catch (error) {
            console.error('Error loading empresas asignadas:', error);
        }
        setView('form');
    };

    const closeForm = () => {
        resetForm();
        setView('list');
    };

    const toggleEmpresa = (idEmpresa: number) =>
        setSelectedEmpresas((prev) => (prev.includes(idEmpresa) ? prev.filter((id) => id !== idEmpresa) : [...prev, idEmpresa]));

    const visibleEmpresas = useMemo(() => {
        const term = empresaSearchTerm.toLowerCase();
        return empresas.filter((e) => (e.nombre_empresa ?? '').toLowerCase().includes(term));
    }, [empresas, empresaSearchTerm]);

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
                await gemUsuariosService.updateUsuario(editingUser.id_usuario, updateData);
                await gemUsuariosService.setEmpresas(editingUser.id_usuario, selectedEmpresas);
                if (newPassword) {
                    await gemUsuariosService.updatePassword(editingUser.id_usuario, newPassword);
                }
                showToast({ type: 'success', message: 'Usuario actualizado exitosamente' });
            } else {
                const newUser = await gemUsuariosService.createUsuario({ ...formData, clave_usuario: newPassword });
                if (selectedEmpresas.length > 0) {
                    await gemUsuariosService.setEmpresas(newUser.id_usuario, selectedEmpresas);
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
        const formTitle = isEdit ? 'Editar usuario GEM' : 'Nuevo usuario GEM';
        return (
            <div className="shadcn-scope w-full p-4 md:p-6">
                <PageHeader
                    title={formTitle}
                    subtitle={isEdit ? 'Actualiza los datos, la contraseña y las empresas a cargo del usuario.' : 'Crea una cuenta de acceso para el área GEM MaM.'}
                    breadcrumbItems={[
                        { label: 'Medio Ambiente', onClick: onBack },
                        { label: 'Usuarios GEM', onClick: closeForm },
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
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <CardTitle>Información personal</CardTitle>
                                        <CardDescription>Datos de identificación y cargo del usuario.</CardDescription>
                                    </div>
                                    <Badge variant="outline">Área GEM MaM</Badge>
                                </div>
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
                                    <CardTitle>Empresas a cargo</CardTitle>
                                    <CardDescription>{selectedEmpresas.length} de {empresas.length} empresas asignadas</CardDescription>
                                </div>
                                {selectedEmpresas.length > 0 && (
                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSelectedEmpresas([])}>
                                        Quitar todas
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                            <div className="relative">
                                <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar empresa..."
                                    value={empresaSearchTerm}
                                    onChange={(e) => setEmpresaSearchTerm(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                            <div className="max-h-[440px] overflow-y-auto rounded-lg border border-border">
                                {visibleEmpresas.length === 0 ? (
                                    <p className="p-6 text-center text-sm text-muted-foreground">Sin empresas que coincidan</p>
                                ) : (
                                    visibleEmpresas.map((empresa) => {
                                        const checked = selectedEmpresas.includes(empresa.id_empresa);
                                        return (
                                            <label
                                                key={empresa.id_empresa}
                                                htmlFor={`empresa-${empresa.id_empresa}`}
                                                className={cn(
                                                    'flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 transition-colors last:border-b-0',
                                                    checked ? 'bg-primary/5' : 'hover:bg-muted/60'
                                                )}
                                            >
                                                <Checkbox
                                                    id={`empresa-${empresa.id_empresa}`}
                                                    checked={checked}
                                                    onCheckedChange={() => toggleEmpresa(empresa.id_empresa)}
                                                />
                                                <span className="min-w-0 truncate text-sm font-medium text-foreground">{empresa.nombre_empresa}</span>
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

    const rowActions = (user: User) => {
        const actions: RowAction[] = [
            { label: 'Editar', icon: <IconPencil size={16} />, onClick: () => openEdit(user) },
            {
                label: user.habilitado === 'S' ? 'Deshabilitar' : 'Habilitar',
                icon: user.habilitado === 'S' ? <IconUserOff size={16} /> : <IconUserCheck size={16} />,
                onClick: () => setConfirmUser(user),
                danger: user.habilitado === 'S',
                separatorBefore: true,
            },
        ];
        return (
            <div className="flex justify-end">
                <RowActionsMenu actions={actions} label={`Acciones para ${user.nombre_real || user.nombre_usuario}`} />
            </div>
        );
    };

    const userColumns: ColumnDef<User>[] = [
        {
            id: 'nombre',
            header: 'Usuario',
            accessorFn: (u) => u.nombre_real || u.nombre_usuario || '',
            sortingFn: (a, b) => localeSort(a.getValue('nombre'), b.getValue('nombre')),
            cell: ({ row }) => (
                <div className="flex items-center gap-2.5">
                    <Avatar>
                        <AvatarFallback>{initials(row.original.nombre_real)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{row.original.nombre_real}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.original.correo_electronico || `@${row.original.nombre_usuario}`}</p>
                    </div>
                </div>
            ),
        },
        {
            id: 'cargo',
            header: 'Cargo',
            accessorFn: (u) => u.nombre_cargo || '',
            sortingFn: (a, b) => localeSort(a.getValue('cargo'), b.getValue('cargo')),
            cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.nombre_cargo || '-'}</span>,
        },
        {
            id: 'estado',
            header: 'Estado',
            accessorFn: (u) => (u.habilitado === 'S' ? 0 : 1),
            cell: ({ row }) => statusBadge(row.original),
        },
        {
            id: 'ultimo_acceso',
            header: 'Último acceso',
            accessorFn: (u) => u.ultimo_acceso || '',
            sortingFn: (a, b) => localeSort(a.getValue('ultimo_acceso'), b.getValue('ultimo_acceso')),
            cell: ({ row }) => <span className="whitespace-nowrap text-sm text-muted-foreground">{row.original.ultimo_acceso ?? 'Nunca'}</span>,
        },
        {
            id: 'acciones',
            header: () => <div className="text-right">Acciones</div>,
            enableSorting: false,
            cell: ({ row }) => rowActions(row.original),
        },
    ];

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Usuarios GEM"
                subtitle="Administra las cuentas del área GEM MaM y las empresas a cargo de cada una."
                onBack={onBack}
                breadcrumbItems={[{ label: 'Medio Ambiente', onClick: onBack }, { label: 'Usuarios GEM' }]}
                rightSection={
                    <Button onClick={openCreate} className={cn(isMobile && 'w-full')}>
                        <IconPlus size={16} /> Nuevo usuario
                    </Button>
                }
            />

            <div className="mt-6 flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <Tabs value={filterStatus} onValueChange={(v) => { setFilterStatus(v as typeof filterStatus); setMobilePage(1); }}>
                        <TabsList>
                            <TabsTrigger value="all">Todos</TabsTrigger>
                            <TabsTrigger value="active">Activos</TabsTrigger>
                            <TabsTrigger value="inactive">Inactivos</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <span className="text-sm text-muted-foreground">{filteredUsers.length} resultados</span>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="relative">
                        <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Buscar usuarios..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setMobilePage(1); }}
                            className="pl-8 sm:w-96"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                aria-label="Limpiar búsqueda"
                                onClick={() => { setSearchTerm(''); setMobilePage(1); }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <IconX size={14} />
                            </button>
                        )}
                    </div>

                    <Button variant="outline" size="sm" onClick={exportCsv}>
                        <IconDownload size={15} /> Exportar
                    </Button>
                </div>

                <div className={cn('relative', isMobile && 'overflow-hidden rounded-xl border border-border bg-card')}>
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    )}

                    {isMobile ? (
                        <div className="flex flex-col divide-y divide-border">
                            {paginatedUsersMobile.length > 0 ? paginatedUsersMobile.map((user) => (
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
                                        <div className="mt-2 flex justify-end">
                                            {rowActions(user)}
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <p className="p-6 text-center text-sm text-muted-foreground">No se encontraron usuarios</p>
                            )}
                        </div>
                    ) : (
                        <DataTable
                            columns={userColumns}
                            data={filteredUsers}
                            pageSize={PAGE_SIZE}
                            emptyMessage="No se encontraron usuarios"
                        />
                    )}
                </div>

                {isMobile && (
                    <DataPagination
                        page={mobileCurrentPage}
                        pageSize={mobilePageSize}
                        total={filteredUsers.length}
                        onPageChange={setMobilePage}
                        onPageSizeChange={(size) => { setMobilePageSize(size); setMobilePage(1); }}
                    />
                )}
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

export default GemUsuariosPage;
