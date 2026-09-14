import React, { useState, useEffect, useMemo } from 'react';
import {
    IconSearch,
    IconPlus,
    IconPencil,
    IconKey,
    IconBan,
    IconCheck,
    IconEye,
    IconEyeOff,
    IconShieldCheck,
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { rbacService, type User, type CreateUserData, type UpdateUserData, type Role } from '../services/rbac.service';
import { catalogosService } from '../../medio-ambiente/services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';

interface Props {
    onBack?: () => void;
}

// Piloto shadcn/ui — misma lógica de negocio que la versión AntD anterior,
// reconstruida como componentes propios (Radix + Tailwind, sin librería de
// componentes) y con la estructura de página del "Users" de referencia:
// tabs de estado (Todos/Activos/Inactivos) en vez de un Select, búsqueda +
// filtro de rol en una sola fila, celda de identidad (avatar+nombre+email)
// combinada en una sola columna, badges neutros para rol, badge de color
// solo para estado real.
export const UsersManagementPage: React.FC<Props> = ({ onBack }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { showToast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [cargos, setCargos] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingUser, setSavingUser] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('active');
    const [filterRole, setFilterRole] = useState<string>('all');

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    const [formData, setFormData] = useState<CreateUserData>({
        nombre_usuario: '',
        nombre_real: '',
        correo_electronico: '',
        id_cargo: undefined,
        clave_usuario: ''
    });
    const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
    const [roleSearchTerm, setRoleSearchTerm] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [showPw2, setShowPw2] = useState(false);

    useEffect(() => {
        loadUsers();
        loadRoles();
        loadCargos();
    }, []);

    const loadCargos = async () => {
        try {
            const data = await catalogosService.getCargos();
            setCargos(data);
        } catch (error) {
            console.error('Error loading cargos:', error);
        }
    };

    const loadUsers = async () => {
        try {
            setLoading(true);
            const data = await rbacService.getAllUsersWithStatus();
            setUsers(data);
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cargar usuarios' });
        } finally {
            setLoading(false);
        }
    };

    const loadRoles = async () => {
        try {
            const data = await rbacService.getRoles();
            setRoles(data);
        } catch (error) {
            console.error('Error loading roles:', error);
        }
    };

    const handleCreateUser = async () => {
        if (!formData.nombre_usuario || !formData.nombre_real || !formData.clave_usuario) {
            return showToast({ type: 'error', message: 'Complete los campos requeridos' });
        }
        try {
            setSavingUser(true);
            const newUser = await rbacService.createUser(formData);
            if (selectedRoles.length > 0) {
                await rbacService.assignRolesToUser(newUser.id_usuario, selectedRoles);
            }
            showToast({ type: 'success', message: 'Usuario creado exitosamente' });
            setShowCreateModal(false);
            resetForm();
            loadUsers();
        } catch (error: any) {
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al crear usuario' });
        } finally {
            setSavingUser(false);
        }
    };

    const handleUpdateUser = async () => {
        if (!selectedUser) return;
        const updateData: UpdateUserData = {
            nombre_usuario: formData.nombre_usuario,
            nombre_real: formData.nombre_real,
            correo_electronico: formData.correo_electronico,
            id_cargo: formData.id_cargo
        };
        try {
            setSavingUser(true);
            await rbacService.updateUser(selectedUser.id_usuario, updateData);
            await rbacService.assignRolesToUser(selectedUser.id_usuario, selectedRoles);
            showToast({ type: 'success', message: 'Usuario actualizado exitosamente' });
            setShowEditModal(false);
            resetForm();
            loadUsers();
        } catch (error: any) {
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al actualizar usuario' });
        } finally {
            setSavingUser(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (!selectedUser) return;
        if (!newPassword || newPassword !== confirmPassword) {
            return showToast({ type: 'error', message: 'Las contraseñas no coinciden' });
        }
        try {
            setSavingUser(true);
            await rbacService.updateUserPassword(selectedUser.id_usuario, newPassword);
            showToast({ type: 'success', message: 'Contraseña actualizada exitosamente' });
            setShowPasswordModal(false);
            setNewPassword('');
            setConfirmPassword('');
            setSelectedUser(null);
        } catch (error) {
            showToast({ type: 'error', message: 'Error al actualizar contraseña' });
        } finally {
            setSavingUser(false);
        }
    };

    const handleToggleStatus = async () => {
        if (!selectedUser) return;
        const newStatus = selectedUser.habilitado !== 'S';
        try {
            setLoading(true);
            await rbacService.toggleUserStatus(selectedUser.id_usuario, newStatus);
            showToast({ type: 'success', message: `Usuario ${newStatus ? 'habilitado' : 'deshabilitado'} exitosamente` });
            setShowConfirmModal(false);
            setSelectedUser(null);
            loadUsers();
        } catch (error: any) {
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al cambiar estado del usuario' });
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        resetForm();
        setSelectedRoles([]);
        setShowCreateModal(true);
    };

    const openEditModal = async (user: User) => {
        setSelectedUser(user);
        setFormData({
            nombre_usuario: user.nombre_usuario,
            nombre_real: user.nombre_real,
            correo_electronico: user.correo_electronico || '',
            id_cargo: user.id_cargo,
            clave_usuario: ''
        });
        try {
            const userRoles = await rbacService.getUserRoles(user.id_usuario);
            setSelectedRoles(userRoles.map(r => r.id_rol));
        } catch (error) {
            console.error('Error loading user roles:', error);
            setSelectedRoles([]);
        }
        setShowEditModal(true);
    };

    const openPasswordModal = (user: User) => {
        setSelectedUser(user);
        setNewPassword('');
        setConfirmPassword('');
        setShowPw(false);
        setShowPw2(false);
        setShowPasswordModal(true);
    };

    const openConfirmModal = (user: User) => {
        setSelectedUser(user);
        setShowConfirmModal(true);
    };

    const resetForm = () => {
        setFormData({ nombre_usuario: '', nombre_real: '', correo_electronico: '', id_cargo: undefined, clave_usuario: '' });
        setSelectedRoles([]);
        setRoleSearchTerm('');
        setSelectedUser(null);
    };

    const toggleRole = (roleId: number) => {
        setSelectedRoles(prev => (prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]));
    };

    const filteredUsers = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return users.filter(user => {
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

    const memoizedRoles = useMemo(() => {
        const term = roleSearchTerm.toLowerCase();
        return roles
            .filter(r => r.estado && r.nombre_rol)
            .filter(r => (r.nombre_rol ?? '').toLowerCase().includes(term) || (r.descripcion && r.descripcion.toLowerCase().includes(term)));
    }, [roles, roleSearchTerm]);

    const initials = (name: string) => (name || '?').trim().charAt(0).toUpperCase();

    return (
        <div className="w-full p-4 md:p-6">
            <PageHeader
                title="Usuarios"
                subtitle="Administra accesos y roles del personal."
                onBack={onBack}
                breadcrumbItems={[{ label: 'Administración', onClick: onBack }, { label: 'Usuarios' }]}
                rightSection={
                    <Button onClick={openCreateModal} className={cn(isMobile && 'w-full')}>
                        <IconPlus size={16} /> Nuevo Usuario
                    </Button>
                }
            />

            <div className="mt-6 flex flex-col gap-4">
                {/* Filtros: tabs de estado + búsqueda + rol, sin tarjeta con borde */}
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
                        <TabsList>
                            <TabsTrigger value="all">Todos</TabsTrigger>
                            <TabsTrigger value="active">Activos</TabsTrigger>
                            <TabsTrigger value="inactive">Inactivos</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex flex-col gap-3 sm:flex-row">
                        <div className="relative">
                            <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Buscar usuarios..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-8 sm:w-64"
                            />
                        </div>
                        <Select value={filterRole} onValueChange={setFilterRole}>
                            <SelectTrigger className="sm:w-44">
                                <SelectValue placeholder="Rol" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los roles</SelectItem>
                                {roles.filter(r => r.nombre_rol).map(r => (
                                    <SelectItem key={r.id_rol} value={String(r.nombre_rol)}>{r.nombre_rol}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Tabla / lista */}
                <div className="relative rounded-xl border border-border bg-card">
                    {loading && !showCreateModal && !showEditModal && !showPasswordModal && !showConfirmModal && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    )}

                    {isMobile ? (
                        <div className="flex flex-col gap-3 p-3">
                            {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                                <div key={user.id_usuario} className="rounded-lg border border-border p-3">
                                    <div className="mb-2 flex items-start justify-between gap-2">
                                        <div className="flex min-w-0 items-center gap-2.5">
                                            <Avatar>
                                                <AvatarFallback>{initials(user.nombre_real)}</AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-foreground">{user.nombre_real}</p>
                                                <p className="truncate text-xs text-muted-foreground">{user.correo_electronico || `@${user.nombre_usuario}`}</p>
                                            </div>
                                        </div>
                                        <Badge variant={user.habilitado === 'S' ? 'success' : 'destructive'}>
                                            {user.habilitado === 'S' ? 'Activo' : 'Inactivo'}
                                        </Badge>
                                    </div>
                                    <div className="mb-3 flex flex-wrap gap-1.5">
                                        <span className="text-xs text-muted-foreground">{user.nombre_cargo || 'Sin cargo'}</span>
                                        {user.roles?.map((rol, i) => <Badge key={i} variant="outline">{rol}</Badge>)}
                                    </div>
                                    <div className="flex justify-end gap-1 border-t border-border pt-2">
                                        <Button variant="ghost" size="icon" title="Editar" onClick={() => openEditModal(user)}><IconPencil size={16} /></Button>
                                        <Button variant="ghost" size="icon" title="Cambiar contraseña" onClick={() => openPasswordModal(user)}><IconKey size={16} /></Button>
                                        <Button variant="ghost" size="icon" title={user.habilitado === 'S' ? 'Deshabilitar' : 'Habilitar'} onClick={() => openConfirmModal(user)}>
                                            {user.habilitado === 'S' ? <IconBan size={16} /> : <IconCheck size={16} />}
                                        </Button>
                                    </div>
                                </div>
                            )) : (
                                <p className="p-6 text-center text-sm text-muted-foreground">No se encontraron usuarios</p>
                            )}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Usuario</TableHead>
                                    <TableHead>Cargo</TableHead>
                                    <TableHead>Roles</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Último acceso</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.length > 0 ? filteredUsers.map((user) => (
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
                                        <TableCell>
                                            <Badge variant={user.habilitado === 'S' ? 'success' : 'destructive'}>
                                                {user.habilitado === 'S' ? 'Activo' : 'Inactivo'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{user.ultimo_acceso ?? 'Nunca'}</TableCell>
                                        <TableCell>
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" title="Editar" onClick={() => openEditModal(user)}><IconPencil size={16} /></Button>
                                                <Button variant="ghost" size="icon" title="Cambiar contraseña" onClick={() => openPasswordModal(user)}><IconKey size={16} /></Button>
                                                <Button variant="ghost" size="icon" title={user.habilitado === 'S' ? 'Deshabilitar' : 'Habilitar'} onClick={() => openConfirmModal(user)}>
                                                    {user.habilitado === 'S' ? <IconBan size={16} /> : <IconCheck size={16} />}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No se encontraron usuarios</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>

            {/* Crear / Editar */}
            <Dialog open={showCreateModal || showEditModal} onOpenChange={(open) => { if (!open) { setShowCreateModal(false); setShowEditModal(false); resetForm(); } }}>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{showCreateModal ? 'Crear nuevo usuario' : 'Editar usuario'}</DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-4 sm:flex-row">
                            <Field label="Nombre de usuario (login)" required className="flex-1">
                                <Input placeholder="ej: jdoe" value={formData.nombre_usuario} onChange={(e) => setFormData({ ...formData, nombre_usuario: e.target.value })} />
                            </Field>
                            <Field label="Nombre real" required className="flex-1">
                                <Input placeholder="ej: Juan Doe" value={formData.nombre_real} onChange={(e) => setFormData({ ...formData, nombre_real: e.target.value })} />
                            </Field>
                        </div>

                        <Field label="Correo electrónico">
                            <Input type="email" placeholder="usuario@ejemplo.com" value={formData.correo_electronico} onChange={(e) => setFormData({ ...formData, correo_electronico: e.target.value })} />
                        </Field>

                        {showCreateModal && (
                            <Field label="Contraseña" required>
                                <div className="relative">
                                    <Input
                                        type={showPw ? 'text' : 'password'}
                                        placeholder="Contraseña inicial"
                                        value={formData.clave_usuario}
                                        onChange={(e) => setFormData({ ...formData, clave_usuario: e.target.value })}
                                        className="pr-9"
                                    />
                                    <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                                        {showPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                                    </button>
                                </div>
                            </Field>
                        )}

                        <Field label="Cargo">
                            <Select value={formData.id_cargo ? String(formData.id_cargo) : undefined} onValueChange={(v) => setFormData({ ...formData, id_cargo: v ? Number(v) : undefined })}>
                                <SelectTrigger><SelectValue placeholder="Selecciona el cargo" /></SelectTrigger>
                                <SelectContent>
                                    {cargos.map((c) => <SelectItem key={c.id_cargo} value={String(c.id_cargo)}>{c.nombre_cargo}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </Field>

                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                                    <IconShieldCheck size={15} className="text-primary" /> Roles asignados
                                </span>
                                <span className="text-xs text-muted-foreground">{selectedRoles.length} seleccionados</span>
                            </div>
                            <div className="relative mb-2">
                                <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input placeholder="Filtrar roles..." value={roleSearchTerm} onChange={(e) => setRoleSearchTerm(e.target.value)} className="h-8 pl-8 text-xs" />
                            </div>
                            <div className="max-h-44 overflow-y-auto rounded-lg border border-border bg-muted/40 p-1.5">
                                <div className="flex flex-col gap-1">
                                    {memoizedRoles.map((role) => {
                                        const checked = selectedRoles.includes(role.id_rol);
                                        return (
                                            <div
                                                key={role.id_rol}
                                                onClick={() => toggleRole(role.id_rol)}
                                                className={cn(
                                                    'flex cursor-pointer items-center gap-2.5 rounded-md border p-2 transition-colors',
                                                    checked ? 'border-primary/40 bg-primary/10' : 'border-transparent hover:bg-muted'
                                                )}
                                            >
                                                <Checkbox checked={checked} onCheckedChange={() => toggleRole(role.id_rol)} onClick={(e) => e.stopPropagation()} />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-foreground">{role.nombre_rol}</p>
                                                    {role.descripcion && <p className="truncate text-xs text-muted-foreground">{role.descripcion}</p>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => { setShowCreateModal(false); setShowEditModal(false); resetForm(); }}>Cancelar</Button>
                        <Button onClick={showCreateModal ? handleCreateUser : handleUpdateUser} disabled={savingUser}>
                            {savingUser ? 'Guardando...' : showCreateModal ? 'Crear usuario' : 'Guardar cambios'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Contraseña */}
            <Dialog open={showPasswordModal} onOpenChange={(open) => { if (!open) { setShowPasswordModal(false); setSelectedUser(null); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cambiar contraseña</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <p className="text-sm text-foreground">Usuario: <strong>{selectedUser?.nombre_usuario}</strong></p>
                        <Field label="Nueva contraseña">
                            <div className="relative">
                                <Input type={showPw ? 'text' : 'password'} placeholder="Ingresa la nueva contraseña" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pr-9" />
                                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    {showPw ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                                </button>
                            </div>
                        </Field>
                        <Field label="Confirmar contraseña">
                            <div className="relative">
                                <Input type={showPw2 ? 'text' : 'password'} placeholder="Repite la contraseña" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pr-9" />
                                <button type="button" onClick={() => setShowPw2(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    {showPw2 ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                                </button>
                            </div>
                        </Field>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowPasswordModal(false)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleUpdatePassword} disabled={savingUser}>
                            {savingUser ? 'Actualizando...' : 'Actualizar contraseña'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirmar habilitar/deshabilitar */}
            <Dialog open={showConfirmModal} onOpenChange={(open) => { if (!open) { setShowConfirmModal(false); setSelectedUser(null); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedUser?.habilitado === 'S' ? 'Deshabilitar usuario' : 'Habilitar usuario'}</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        {selectedUser?.habilitado === 'S'
                            ? `¿Estás seguro que deseas deshabilitar al usuario "${selectedUser?.nombre_usuario}"? No podrá acceder al sistema.`
                            : `¿Estás seguro que deseas habilitar al usuario "${selectedUser?.nombre_usuario}"? Podrá acceder nuevamente.`}
                    </p>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => { setShowConfirmModal(false); setSelectedUser(null); }}>Cancelar</Button>
                        <Button variant={selectedUser?.habilitado === 'S' ? 'destructive' : 'default'} onClick={handleToggleStatus}>
                            {selectedUser?.habilitado === 'S' ? 'Deshabilitar' : 'Habilitar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
    return (
        <div className={className}>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {label}{required && <span className="text-destructive"> *</span>}
            </Label>
            {children}
        </div>
    );
}

export default UsersManagementPage;
