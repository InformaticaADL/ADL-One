import React, { useEffect, useState } from 'react';
import {
    IconPlus,
    IconEdit,
    IconShieldLock,
    IconToggleLeft,
    IconToggleRight,
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, SortableTableHead, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { useTableSort } from '../../../hooks/useTableSort';
import { rbacService } from '../services/rbac.service';
import type { Role } from '../services/rbac.service';
import { RoleModal } from '../components/RoleModal';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';

interface Props {
    onBack?: () => void;
}

type SortKey = 'nombre' | 'descripcion' | 'estado';

const SORT_ACCESSORS: Record<SortKey, (r: Role) => string | number | null | undefined> = {
    nombre: (r) => r.nombre_rol,
    descripcion: (r) => r.descripcion,
    estado: (r) => (r.estado ? 0 : 1),
};

// RoleModal (editor de permisos, 548 líneas) sigue en Ant Design por ahora
// — se comparte igual desde acá, se puede migrar aparte después.
export const RolesPage: React.FC<Props> = ({ onBack }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { showToast } = useToast();
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);
    const [confirmRole, setConfirmRole] = useState<Role | null>(null);
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const [affectedUsersCount, setAffectedUsersCount] = useState<number | null>(null);

    useEffect(() => {
        loadRoles();
    }, []);

    const loadRoles = async () => {
        setLoading(true);
        try {
            setRoles(await rbacService.getRoles());
        } catch (error) {
            console.error('Error loading roles:', error);
            showToast({ type: 'error', message: 'Error cargando roles' });
        } finally {
            setLoading(false);
        }
    };

    const { sorted, sort, toggleSort } = useTableSort(roles, SORT_ACCESSORS);
    const sortProps = (key: SortKey) => ({ active: sort.key === key, direction: sort.direction, onSort: () => toggleSort(key) });

    const handleCreate = () => {
        setSelectedRole(null);
        setIsModalOpen(true);
    };

    const handleEdit = (role: Role) => {
        setSelectedRole(role);
        setIsModalOpen(true);
    };

    const openConfirmToggle = async (role: Role) => {
        setConfirmRole(role);
        setAffectedUsersCount(null);
        if (role.estado) {
            try {
                const users = await rbacService.getUsersByRole(role.id_rol);
                setAffectedUsersCount(users.length);
            } catch {
                setAffectedUsersCount(null);
            }
        }
    };

    const handleToggleStatus = async () => {
        if (!confirmRole) return;
        setTogglingId(confirmRole.id_rol);
        try {
            await rbacService.toggleRoleStatus(confirmRole.id_rol, !confirmRole.estado);
            showToast({
                type: 'success',
                message: `Rol "${confirmRole.nombre_rol}" ${!confirmRole.estado ? 'activado' : 'desactivado'} correctamente`,
            });
            loadRoles();
        } catch {
            showToast({ type: 'error', message: 'Error al cambiar estado del rol' });
        } finally {
            setTogglingId(null);
            setConfirmRole(null);
            setAffectedUsersCount(null);
        }
    };

    const toggleAction = (role: Role) => (
        <Button
            variant="outline"
            size="sm"
            className={role.estado ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : 'text-success hover:bg-success/10 hover:text-success'}
            onClick={() => openConfirmToggle(role)}
            disabled={togglingId === role.id_rol}
        >
            {role.estado ? <IconToggleLeft size={14} /> : <IconToggleRight size={14} />}
            {role.estado ? 'Desactivar' : 'Activar'}
        </Button>
    );

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Administración de Roles"
                subtitle="Gestiona los perfiles de acceso y permisos."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Informática', onClick: onBack },
                    { label: 'Roles de Sistema' },
                ]}
                rightSection={
                    <Button onClick={handleCreate} className={isMobile ? 'w-full' : undefined}>
                        <IconPlus size={16} /> Nuevo rol
                    </Button>
                }
            />

            <div className="mt-6 flex flex-col gap-4">
                <div className="flex items-start gap-2 rounded-xl bg-accent p-3.5">
                    <IconShieldLock size={18} className="mt-0.5 shrink-0 text-primary" />
                    <p className="text-sm text-accent-foreground">
                        Los roles permiten agrupar permisos y asignarlos masivamente a los usuarios para facilitar la administración.
                    </p>
                </div>

                <div className="relative overflow-hidden rounded-xl border border-border bg-card">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    )}

                    {isMobile ? (
                        <div className="flex flex-col divide-y divide-border">
                            {sorted.length > 0 ? sorted.map((role) => (
                                <div key={role.id_rol} className="p-3">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <IconShieldLock size={18} className={role.estado ? 'text-primary' : 'text-muted-foreground'} />
                                            <span className="text-sm font-semibold text-foreground">{role.nombre_rol}</span>
                                        </div>
                                        <Badge variant={role.estado ? 'success' : 'destructive'}>{role.estado ? 'Activo' : 'Inactivo'}</Badge>
                                    </div>
                                    <p className="mb-3 text-xs text-muted-foreground">{role.descripcion || 'Sin descripción'}</p>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(role)}>
                                            <IconEdit size={14} /> Editar / Permisos
                                        </Button>
                                        {toggleAction(role)}
                                    </div>
                                </div>
                            )) : (
                                <p className="p-6 text-center text-sm text-muted-foreground">No hay roles definidos</p>
                            )}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <SortableTableHead {...sortProps('nombre')}>Nombre del rol</SortableTableHead>
                                    <SortableTableHead {...sortProps('descripcion')}>Descripción</SortableTableHead>
                                    <SortableTableHead {...sortProps('estado')}>Estado</SortableTableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sorted.length > 0 ? sorted.map((role) => (
                                    <TableRow key={role.id_rol}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <IconShieldLock size={16} className={role.estado ? 'text-primary' : 'text-muted-foreground'} />
                                                <span className={role.estado ? 'text-sm font-medium text-foreground' : 'text-sm text-muted-foreground'}>{role.nombre_rol}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-sm truncate text-sm text-muted-foreground">{role.descripcion || 'Sin descripción'}</TableCell>
                                        <TableCell><Badge variant={role.estado ? 'success' : 'destructive'}>{role.estado ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                                        <TableCell>
                                            <div className="flex justify-end gap-2">
                                                <Button variant="outline" size="sm" onClick={() => handleEdit(role)}>
                                                    <IconEdit size={14} /> Editar / Permisos
                                                </Button>
                                                {toggleAction(role)}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">No hay roles definidos</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>

            <RoleModal
                isOpen={isModalOpen}
                role={selectedRole}
                onClose={() => setIsModalOpen(false)}
                onSuccess={loadRoles}
            />

            <Dialog open={!!confirmRole} onOpenChange={(open) => { if (!open) { setConfirmRole(null); setAffectedUsersCount(null); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{confirmRole?.estado ? 'Desactivar rol' : 'Activar rol'}</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        {confirmRole?.estado
                            ? `¿Desactivar el rol "${confirmRole?.nombre_rol}"? ${affectedUsersCount !== null ? `${affectedUsersCount} usuario${affectedUsersCount !== 1 ? 's' : ''} ${affectedUsersCount !== 1 ? 'perderán' : 'perderá'} sus permisos asociados y serán desconectados.` : 'Los usuarios que lo tengan asignado perderán sus permisos asociados.'}`
                            : `¿Activar el rol "${confirmRole?.nombre_rol}"? Los usuarios que lo tengan asignado recuperarán sus permisos.`}
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setConfirmRole(null); setAffectedUsersCount(null); }}>Cancelar</Button>
                        <Button variant={confirmRole?.estado ? 'destructive' : 'default'} onClick={handleToggleStatus}>
                            {confirmRole?.estado ? 'Desactivar' : 'Activar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
