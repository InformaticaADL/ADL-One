import React, { useState, useEffect, useMemo } from 'react';
import { IconSearch, IconPlus, IconTrash, IconBuilding } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { rbacService, type User } from '../services/rbac.service';
import { empresaAsignadaService, type EmpresaAsignada, type EmpresaCatalogo } from '../../../services/empresaAsignada.service';

interface Props {
    onBack: () => void;
}

const AREA_LABEL: Record<string, string> = { LAB: 'Laboratorio', MAM: 'Medio Ambiente' };

export const EmpresasAsignadasPage: React.FC<Props> = ({ onBack }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { showToast } = useToast();

    const [asignaciones, setAsignaciones] = useState<EmpresaAsignada[]>([]);
    const [usuarios, setUsuarios] = useState<User[]>([]);
    const [empresas, setEmpresas] = useState<EmpresaCatalogo[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [showForm, setShowForm] = useState(false);
    const [formUsuario, setFormUsuario] = useState<string | undefined>(undefined);
    const [formEmpresa, setFormEmpresa] = useState<string | undefined>(undefined);
    const [formArea, setFormArea] = useState<string | undefined>(undefined);
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<EmpresaAsignada | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [a, u, e] = await Promise.allSettled([
                empresaAsignadaService.listarTodas(),
                rbacService.getAllUsersWithStatus(),
                empresaAsignadaService.empresas(),
            ]);
            if (a.status === 'fulfilled') setAsignaciones(a.value);
            else showToast({ type: 'error', message: 'Error al cargar las asignaciones' });
            if (u.status === 'fulfilled') setUsuarios(u.value.filter((x) => x.habilitado === 'S'));
            else showToast({ type: 'error', message: 'Error al cargar los usuarios' });
            if (e.status === 'fulfilled') setEmpresas(e.value);
            else showToast({ type: 'warning', message: 'No se pudieron cargar las empresas del portal (WebClientesV2 no disponible)' });
        } finally {
            setLoading(false);
        }
    };

    const filtered = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return asignaciones.filter((a) =>
            (a.nombre_usuario || '').toLowerCase().includes(term) ||
            (a.nombre_empresa || '').toLowerCase().includes(term)
        );
    }, [asignaciones, searchTerm]);

    const openForm = () => {
        setFormUsuario(undefined);
        setFormEmpresa(undefined);
        setFormArea(undefined);
        setShowForm(true);
    };

    const handleCrear = async () => {
        if (!formUsuario || !formEmpresa || !formArea) {
            return showToast({ type: 'error', message: 'Selecciona usuario, empresa y área' });
        }
        try {
            setSaving(true);
            await empresaAsignadaService.asignar(Number(formUsuario), Number(formEmpresa), formArea as 'LAB' | 'MAM');
            showToast({ type: 'success', message: 'Asignación creada' });
            setShowForm(false);
            loadData();
        } catch (error: any) {
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al crear la asignación' });
        } finally {
            setSaving(false);
        }
    };

    const handleEliminar = async () => {
        if (!confirmDelete) return;
        try {
            await empresaAsignadaService.quitar(confirmDelete.id);
            showToast({ type: 'success', message: 'Asignación eliminada' });
            setConfirmDelete(null);
            loadData();
        } catch (error) {
            showToast({ type: 'error', message: 'Error al eliminar la asignación' });
        }
    };

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Solicitudes de clientes"
                subtitle="Asigna qué persona atiende las solicitudes de cada empresa, por área."
                onBack={onBack}
                breadcrumbItems={[{ label: 'Informática', onClick: onBack }, { label: 'Solicitudes de clientes' }]}
                rightSection={
                    <Button onClick={openForm} className={isMobile ? 'w-full' : undefined}>
                        <IconPlus size={16} /> Nueva asignación
                    </Button>
                }
            />

            <div className="mt-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Buscar usuario o empresa..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={isMobile ? 'w-full pl-8' : 'w-72 pl-8'}
                        />
                    </div>
                    <span className="text-sm text-muted-foreground">{filtered.length} asignaciones</span>
                </div>

                <div className="relative overflow-hidden rounded-xl border border-border bg-card">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    )}

                    {isMobile ? (
                        <div className="flex flex-col divide-y divide-border">
                            {filtered.length > 0 ? filtered.map((a) => (
                                <div key={a.id} className="flex items-start justify-between gap-2 p-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-foreground">{a.nombre_usuario}</p>
                                        <p className="truncate text-xs text-muted-foreground">{a.nombre_empresa || `Empresa #${a.id_empresa}`}</p>
                                        <Badge variant="outline" className="mt-1">{AREA_LABEL[a.area] || a.area}</Badge>
                                    </div>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDelete(a)}>
                                        <IconTrash size={16} />
                                    </Button>
                                </div>
                            )) : (
                                <p className="p-6 text-center text-sm text-muted-foreground">Sin asignaciones todavía</p>
                            )}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Usuario</TableHead>
                                    <TableHead>Empresa</TableHead>
                                    <TableHead>Área</TableHead>
                                    <TableHead>Asignado el</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.length > 0 ? filtered.map((a) => (
                                    <TableRow key={a.id}>
                                        <TableCell className="text-sm font-medium text-foreground">{a.nombre_usuario}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{a.nombre_empresa || `Empresa #${a.id_empresa}`}</TableCell>
                                        <TableCell><Badge variant="outline">{AREA_LABEL[a.area] || a.area}</Badge></TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{a.asignado_en ? new Date(a.asignado_en).toLocaleDateString('es-CL') : '-'}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDelete(a)}>
                                                <IconTrash size={16} />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={5} className="py-16 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <IconBuilding size={40} className="text-muted-foreground/40" />
                                                <p className="text-sm font-medium text-muted-foreground">Sin asignaciones todavía</p>
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
                        <DialogTitle>Nueva asignación</DialogTitle>
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
                        <div className="flex flex-col gap-1.5">
                            <Label>Empresa</Label>
                            <Combobox
                                value={formEmpresa}
                                onValueChange={setFormEmpresa}
                                placeholder="Selecciona la empresa"
                                searchPlaceholder="Buscar empresa..."
                                options={empresas.map((e) => ({ value: String(e.id_empresa), label: e.nombre_empresa }))}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Área</Label>
                            <Combobox
                                value={formArea}
                                onValueChange={setFormArea}
                                placeholder="Selecciona el área"
                                options={[
                                    { value: 'LAB', label: 'Laboratorio' },
                                    { value: 'MAM', label: 'Medio Ambiente' },
                                ]}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</Button>
                        <Button onClick={handleCrear} disabled={saving}>{saving ? 'Guardando...' : 'Crear asignación'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={confirmDelete !== null} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Eliminar asignación</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        ¿Quitar a "{confirmDelete?.nombre_usuario}" de "{confirmDelete?.nombre_empresa || `Empresa #${confirmDelete?.id_empresa}`}"
                        ({AREA_LABEL[confirmDelete?.area || ''] || confirmDelete?.area})?
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

export default EmpresasAsignadasPage;
