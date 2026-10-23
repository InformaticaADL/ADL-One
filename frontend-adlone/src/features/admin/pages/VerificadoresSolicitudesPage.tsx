import React, { useState, useEffect, useMemo } from 'react';
import { IconSearch, IconPlus, IconTrash, IconUserCheck } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { rbacService, type User } from '../services/rbac.service';
import { verificadorSolicitudesService, type VerificadorSolicitud } from '../../../services/verificadorSolicitudes.service';

interface Props {
    onBack: () => void;
}

export const VerificadoresSolicitudesPage: React.FC<Props> = ({ onBack }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { showToast } = useToast();

    const [verificadores, setVerificadores] = useState<VerificadorSolicitud[]>([]);
    const [usuarios, setUsuarios] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [showForm, setShowForm] = useState(false);
    const [formUsuario, setFormUsuario] = useState<string | undefined>(undefined);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<VerificadorSolicitud | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [v, u] = await Promise.all([
                verificadorSolicitudesService.listar(),
                rbacService.getAllUsersWithStatus(),
            ]);
            setVerificadores(v);
            setUsuarios(u.filter((x) => x.habilitado === 'S'));
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cargar los verificadores' });
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return verificadores.filter((v) => (v.nombre_usuario || '').toLowerCase().includes(term));
    }, [verificadores, searchTerm]);

    const openForm = () => {
        setFormUsuario(undefined);
        setShowForm(true);
    };

    const handleCrear = async () => {
        if (!formUsuario) {
            return showToast({ type: 'error', message: 'Selecciona un usuario' });
        }
        try {
            setSaving(true);
            await verificadorSolicitudesService.agregar(Number(formUsuario));
            showToast({ type: 'success', message: 'Verificador agregado' });
            setShowForm(false);
            loadData();
        } catch (error: any) {
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al agregar el verificador' });
        } finally {
            setSaving(false);
        }
    };

    const handleEliminar = async () => {
        if (!confirmDelete) return;
        try {
            await verificadorSolicitudesService.quitar(confirmDelete.id);
            showToast({ type: 'success', message: 'Verificador eliminado' });
            setConfirmDelete(null);
            loadData();
        } catch (error) {
            showToast({ type: 'error', message: 'Error al eliminar el verificador' });
        }
    };

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Verificadores de Solicitudes"
                subtitle="Usuarios que reciben copia de TODAS las solicitudes de clientes, sin importar la empresa. No aprueban ni bloquean nada, solo quedan informados."
                onBack={onBack}
                breadcrumbItems={[{ label: 'Informática', onClick: onBack }, { label: 'Verificadores de Solicitudes' }]}
                rightSection={
                    <Button onClick={openForm} className={isMobile ? 'w-full' : undefined}>
                        <IconPlus size={16} /> Nuevo verificador
                    </Button>
                }
            />

            <div className="mt-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Buscar usuario..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={isMobile ? 'w-full pl-8' : 'w-72 pl-8'}
                        />
                    </div>
                    <span className="text-sm text-muted-foreground">{filtered.length} verificadores</span>
                </div>

                <div className="relative overflow-hidden rounded-xl border border-border bg-card">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    )}

                    {isMobile ? (
                        <div className="flex flex-col divide-y divide-border">
                            {filtered.length > 0 ? filtered.map((v) => (
                                <div key={v.id} className="flex items-start justify-between gap-2 p-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-foreground">{v.nombre_usuario}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            Desde el {v.asignado_en ? new Date(v.asignado_en).toLocaleDateString('es-CL') : '-'}
                                        </p>
                                    </div>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDelete(v)}>
                                        <IconTrash size={16} />
                                    </Button>
                                </div>
                            )) : (
                                <p className="p-6 text-center text-sm text-muted-foreground">Sin verificadores todavía</p>
                            )}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Usuario</TableHead>
                                    <TableHead>Agregado el</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length > 0 ? filtered.map((v) => (
                                    <TableRow key={v.id}>
                                        <TableCell className="text-sm font-medium text-foreground">{v.nombre_usuario}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{v.asignado_en ? new Date(v.asignado_en).toLocaleDateString('es-CL') : '-'}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDelete(v)}>
                                                <IconTrash size={16} />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={3} className="py-16 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <IconUserCheck size={40} className="text-muted-foreground/40" />
                                                <p className="text-sm font-medium text-muted-foreground">Sin verificadores todavía</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>

            <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nuevo verificador</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <Label>Usuario</Label>
                            <Combobox
                                value={formUsuario}
                                onValueChange={setFormUsuario}
                                placeholder="Selecciona el usuario"
                                searchPlaceholder="Buscar usuario..."
                                options={usuarios.map((u) => ({ value: String(u.id_usuario), label: u.nombre_real || u.nombre_usuario }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</Button>
                        <Button onClick={handleCrear} disabled={saving}>{saving ? 'Guardando...' : 'Agregar verificador'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={confirmDelete !== null} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Eliminar verificador</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        ¿Quitar a "{confirmDelete?.nombre_usuario}" de la lista de verificadores?
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleEliminar}>Eliminar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default VerificadoresSolicitudesPage;
