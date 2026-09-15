import React, { useState, useEffect, useMemo } from 'react';
import {
    IconPlus,
    IconSearch,
    IconEdit,
    IconPower,
    IconFileDescription,
    IconCheck,
    IconBell,
    IconSchool,
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Table, TableHeader, TableBody, TableRow, SortableTableHead, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { useTableSort } from '../../../hooks/useTableSort';
import { adminService } from '../../../services/admin.service';
import { ursService } from '../../../services/urs.service';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { MuestreadorForm } from '../components/MuestreadorForm';
import { SamplerRequestsModal } from '../components/SamplerRequestsModal';
import SamplerDeactivationModal from '../components/SamplerDeactivationModal';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useToast } from '../../../contexts/ToastContext';
import { useNavStore } from '../../../store/navStore';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';

interface Props {
    onBack: () => void;
}

type SortKey = 'nombre' | 'contacto' | 'estado' | 'entrenamiento';

export const MuestreadoresPage: React.FC<Props> = ({ onBack }) => {
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [solicitudesRealizadas, setSolicitudesRealizadas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ACTIVOS');

    const [selectedMuestreador, setSelectedMuestreador] = useState<any | null>(null);

    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [muestreadorToDisable, setMuestreadorToDisable] = useState<any | null>(null);
    const [isEnableConfirmOpen, setIsEnableConfirmOpen] = useState(false);
    const [muestreadorToEnable, setMuestreadorToEnable] = useState<any | null>(null);
    const [showRequestsModal, setShowRequestsModal] = useState(false);
    const [requestsSamplerInfo, setRequestsSamplerInfo] = useState<{ id: string | number; nombre: string } | null>(null);

    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const { showToast } = useToast();
    const { pendingRequestId } = useNavStore();

    const isMobile = useMediaQuery('(max-width: 768px)');

    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await adminService.getMuestreadores(searchTerm, statusFilter);
            setMuestreadores(result.data || []);
        } catch (error) {
            console.error('Error fetching muestreadores:', error);
            showToast({ type: 'error', message: 'Error al cargar los muestreadores' });
        } finally {
            setLoading(false);
        }
    };

    const loadSolicitudes = async () => {
        try {
            const targetStates = 'ACEPTADA';
            const [legacyData, ursData] = await Promise.all([
                adminService.getSolicitudes({ estado: targetStates }).catch(() => []),
                ursService.getRequests({ estado: targetStates }).catch(() => []),
            ]);
            const data = [...(Array.isArray(legacyData) ? legacyData : []), ...(Array.isArray(ursData) ? ursData : [])];
            const filtered = data.filter((s: any) => {
                if (s.modulo_destino === 'MUESTREADORES') return true;
                const typeRaw = (s.tipo_solicitud || s.nombre_tipo || '').toUpperCase();
                return typeRaw.includes('MUESTREADOR') || typeRaw.includes('FIRMA') || typeRaw.includes('DESHABILITAR');
            });
            setSolicitudesRealizadas(filtered);
        } catch (error) {
            console.error('Error loading solicitudes:', error);
        }
    };

    useEffect(() => {
        loadSolicitudes();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData();
        }, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, statusFilter]);

    useEffect(() => {
        if (!pendingRequestId || solicitudesRealizadas.length === 0 || muestreadores.length === 0) return;
        const sol = solicitudesRealizadas.find((s) => s.id_solicitud === pendingRequestId);
        if (!sol) return;
        const d = sol.datos_json || {};
        const idStr = String(d.id_muestreador || d.muestreador_origen_id || d.nuevo_responsable_id || '');
        const target = muestreadores.find((m) => String(m.id_muestreador) === idStr);
        if (target) {
            handleOpenRequests(target);
        }
    }, [pendingRequestId, solicitudesRealizadas, muestreadores]);

    const handleCreate = () => {
        setSelectedMuestreador(null);
        setViewMode('form');
    };

    const handleEdit = (m: any) => {
        setSelectedMuestreador(m);
        setViewMode('form');
    };

    const handleOpenRequests = (m: any) => {
        setRequestsSamplerInfo({ id: m.id_muestreador, nombre: m.nombre_muestreador });
        setShowRequestsModal(true);
    };

    const pendingBySampler = useMemo(() => {
        const map = new Map<string, any[]>();
        for (const sol of solicitudesRealizadas) {
            const d = sol.datos_json || {};
            const ids = [d.id_muestreador, d.muestreador_origen_id, d.muestreador_destino_id, d.nuevo_responsable_id, d.id_muestreador_nuevo]
                .filter(Boolean).map(String);
            for (const idStr of ids) {
                if (!map.has(idStr)) map.set(idStr, []);
                map.get(idStr)!.push(sol);
            }
        }
        return map;
    }, [solicitudesRealizadas]);

    const getPendingRequestsForSampler = (id: number) => pendingBySampler.get(String(id)) ?? [];

    const handleDisableClick = (m: any) => {
        setMuestreadorToDisable(m);
        setIsConfirmModalOpen(true);
    };

    const handleEnableClick = (m: any) => {
        setMuestreadorToEnable(m);
        setIsEnableConfirmOpen(true);
    };

    const confirmEnable = async () => {
        if (!muestreadorToEnable) return;
        try {
            await adminService.enableMuestreador(muestreadorToEnable.id_muestreador);
            showToast({ type: 'success', message: 'Muestreador habilitado correctamente' });
            fetchData();
            setIsEnableConfirmOpen(false);
            setMuestreadorToEnable(null);
        } catch (error) {
            console.error(error);
            showToast({ type: 'error', message: 'Error al habilitar' });
        }
    };

    const handleToggleEntrenamiento = async (m: any) => {
        const nuevo = m.en_entrenamiento === 'S' ? 'N' : 'S';
        try {
            await adminService.setEntrenamiento(m.id_muestreador, nuevo);
            showToast({ type: 'success', message: nuevo === 'N' ? 'Marcado como Operativo' : 'Marcado En entrenamiento' });
            fetchData();
        } catch {
            showToast({ type: 'error', message: 'Error al actualizar estado de entrenamiento' });
        }
    };

    const parseCompetencias = (m: any): { nombre: string; activo: string }[] => {
        try { return JSON.parse(m.competencias_json || '[]'); } catch { return []; }
    };

    const renderCompetencias = (m: any) => {
        const comps = parseCompetencias(m);
        if (comps.length === 0) return <span className="text-xs text-muted-foreground">Sin competencias</span>;
        return (
            <div className="flex flex-wrap gap-1">
                {comps.map((c, i) => (
                    <Badge
                        key={i}
                        variant="outline"
                        className={c.activo !== 'S' ? 'opacity-50' : undefined}
                        title={c.activo === 'S' ? c.nombre : `${c.nombre} (inactiva)`}
                    >
                        {c.nombre}
                    </Badge>
                ))}
            </div>
        );
    };

    const handleExportPdf = async () => {
        setIsExporting(true);
        try {
            const blob = await adminService.getMuestreadoresPdf(searchTerm, statusFilter);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Muestreadores_${new Date().toISOString().split('T')[0]}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting PDF:', error);
            showToast({ type: 'error', message: 'Error al exportar PDF' });
        } finally {
            setIsExporting(false);
        }
    };

    const sortAccessors: Record<SortKey, (m: any) => string | number | null | undefined> = {
        nombre: (m) => m.nombre_muestreador,
        contacto: (m) => m.correo_electronico,
        estado: (m) => (m.habilitado === 'S' ? 0 : 1),
        entrenamiento: (m) => (m.en_entrenamiento === 'S' ? 0 : 1),
    };
    const { sorted, sort, toggleSort } = useTableSort(muestreadores, sortAccessors);
    const sortProps = (key: SortKey) => ({ active: sort.key === key, direction: sort.direction, onSort: () => toggleSort(key) });

    const trainingBadge = (m: any) => (
        <Badge
            variant={m.en_entrenamiento === 'S' ? 'warning' : 'success'}
            className="cursor-pointer"
            title={m.en_entrenamiento === 'S' ? 'En entrenamiento — clic para marcar Operativo' : 'Operativo — clic para marcar En entrenamiento'}
            onClick={() => handleToggleEntrenamiento(m)}
        >
            <IconSchool size={10} className="mr-1" /> {m.en_entrenamiento === 'S' ? 'En entrenamiento' : 'Operativo'}
        </Badge>
    );

    const signature = (m: any, size: 'sm' | 'lg') => (
        m.firma_muestreador ? (
            <div
                onClick={() => setZoomedImage(m.firma_muestreador)}
                title="Ver firma ampliada"
                className={cn(
                    'flex cursor-pointer items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30',
                    size === 'sm' ? 'h-10 w-24' : 'h-12 w-28'
                )}
            >
                <img src={m.firma_muestreador} className="h-9 object-contain" alt="Firma" />
            </div>
        ) : (
            <span className="text-xs italic text-muted-foreground">Sin firma registrada</span>
        )
    );

    const content = viewMode === 'form' ? (
        <MuestreadorForm
            initialData={selectedMuestreador}
            pendingRequests={selectedMuestreador ? getPendingRequestsForSampler(selectedMuestreador.id_muestreador) : []}
            onSave={() => {
                fetchData();
                loadSolicitudes();
                setViewMode('list');
            }}
            onCancel={() => setViewMode('list')}
            onViewRequests={() => handleOpenRequests(selectedMuestreador!)}
        />
    ) : (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Gestión de Muestreadores"
                subtitle={!isMobile ? 'Administra el personal de muestreo técnico y sus firmas digitales autorizadas.' : undefined}
                onBack={onBack}
                breadcrumbItems={[{ label: 'Administración', onClick: onBack }, { label: 'Muestreadores' }]}
                rightSection={
                    <div className="flex gap-2">
                        <ProtectedContent permission="MU_EXP">
                            <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleExportPdf} disabled={isExporting}>
                                <IconFileDescription size={16} /> Exportar PDF
                            </Button>
                        </ProtectedContent>
                        <ProtectedContent permission="AI_MA_CREAR_NUEVO_MUESTREADOR">
                            <Button onClick={handleCreate}>
                                <IconPlus size={16} /> Nuevo{!isMobile && ' muestreador'}
                            </Button>
                        </ProtectedContent>
                    </div>
                }
            />

            <div className="mt-6 flex flex-col gap-4">
                <div className={cn('flex gap-4', isMobile ? 'flex-col' : 'flex-row items-center')}>
                    <div className="relative flex-1">
                        <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input placeholder="Buscar por nombre o ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8" />
                    </div>
                    <Combobox
                        value={statusFilter}
                        onValueChange={(v) => setStatusFilter(v || 'ACTIVOS')}
                        placeholder="Filtrar por estado"
                        searchPlaceholder="Buscar..."
                        className={isMobile ? undefined : 'w-56'}
                        options={[
                            { value: 'ACTIVOS', label: 'Solo activos' },
                            { value: 'INACTIVOS', label: 'Solo inactivos' },
                            { value: 'TODOS', label: 'Todos' },
                        ]}
                    />
                </div>

                <div className="relative overflow-hidden rounded-xl border border-border bg-card">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    )}

                    {!isMobile ? (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <SortableTableHead {...sortProps('nombre')}>Muestreador</SortableTableHead>
                                    <SortableTableHead {...sortProps('contacto')}>Contacto</SortableTableHead>
                                    <SortableTableHead {...sortProps('estado')}>Estado</SortableTableHead>
                                    <SortableTableHead {...sortProps('entrenamiento')}>Entrenamiento</SortableTableHead>
                                    <TableHead>Competencias</TableHead>
                                    <TableHead>Firma digital</TableHead>
                                    <TableHead className="text-center">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sorted.length > 0 ? sorted.map((m) => {
                                    const hasPending = getPendingRequestsForSampler(m.id_muestreador).length > 0;
                                    return (
                                        <TableRow key={m.id_muestreador}>
                                            <TableCell>
                                                <p className="text-sm font-medium text-foreground">{m.nombre_muestreador}</p>
                                                <p className="text-xs text-muted-foreground">ID: {m.id_muestreador}</p>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{m.correo_electronico || '—'}</TableCell>
                                            <TableCell><Badge variant={m.habilitado === 'S' ? 'success' : 'destructive'}>{m.habilitado === 'S' ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                                            <TableCell>{trainingBadge(m)}</TableCell>
                                            <TableCell>{renderCompetencias(m)}</TableCell>
                                            <TableCell>{signature(m, 'sm')}</TableCell>
                                            <TableCell>
                                                <div className="flex justify-center gap-1">
                                                    <ProtectedContent permission="MU_SOLICITUDES">
                                                        <Button variant="ghost" size="icon" title="Ver solicitudes" onClick={() => handleOpenRequests(m)}>
                                                            <IconBell size={16} className={hasPending ? 'text-warning' : undefined} />
                                                        </Button>
                                                    </ProtectedContent>
                                                    <ProtectedContent permission="AI_MA_EDITAR_MUESTREADOR">
                                                        <Button variant="ghost" size="icon" title="Editar información" onClick={() => handleEdit(m)}>
                                                            <IconEdit size={16} />
                                                        </Button>
                                                    </ProtectedContent>
                                                    <ProtectedContent permission="AI_MA_DESHABILITAR_MUESTREADOR">
                                                        {m.habilitado === 'S' ? (
                                                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" title="Deshabilitar muestreador" onClick={() => handleDisableClick(m)}>
                                                                <IconPower size={16} />
                                                            </Button>
                                                        ) : (
                                                            <Button variant="ghost" size="icon" className="text-success hover:bg-success/10 hover:text-success" title="Habilitar muestreador" onClick={() => handleEnableClick(m)}>
                                                                <IconCheck size={16} />
                                                            </Button>
                                                        )}
                                                    </ProtectedContent>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                }) : (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                                            No se encontraron muestreadores con los filtros aplicados.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="flex flex-col gap-3 p-3">
                            {muestreadores.length === 0 && !loading ? (
                                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No se encontraron muestreadores.</p>
                            ) : (
                                muestreadores.map((m) => {
                                    const hasPending = getPendingRequestsForSampler(m.id_muestreador).length > 0;
                                    return (
                                        <div key={m.id_muestreador} className="rounded-xl border border-border p-3.5">
                                            <div className="mb-3 flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-semibold text-primary">{m.nombre_muestreador}</p>
                                                    <p className="text-xs font-medium text-muted-foreground">ID: {m.id_muestreador}</p>
                                                </div>
                                                <div className="flex flex-wrap justify-end gap-1">
                                                    <Badge variant={m.habilitado === 'S' ? 'success' : 'destructive'}>{m.habilitado === 'S' ? 'Activo' : 'Inactivo'}</Badge>
                                                    {trainingBadge(m)}
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-3 border-t border-dashed border-border pt-3">
                                                <div>
                                                    <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">Contacto</p>
                                                    <p className="text-sm font-medium text-foreground">{m.correo_electronico || 'Sin correo registrado'}</p>
                                                </div>
                                                <div>
                                                    <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">Firma digital</p>
                                                    {signature(m, 'lg')}
                                                </div>
                                                <div>
                                                    <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">Competencias</p>
                                                    {renderCompetencias(m)}
                                                </div>
                                            </div>

                                            <div className="mt-3 flex gap-2 border-t border-dashed border-border pt-3">
                                                <ProtectedContent permission="MU_SOLICITUDES">
                                                    <Button variant="outline" size="sm" className={cn('flex-1', hasPending && 'text-warning')} onClick={() => handleOpenRequests(m)}>
                                                        <IconBell size={16} /> Solicitudes
                                                    </Button>
                                                </ProtectedContent>
                                                <ProtectedContent permission="AI_MA_EDITAR_MUESTREADOR">
                                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(m)}>
                                                        <IconEdit size={16} /> Editar
                                                    </Button>
                                                </ProtectedContent>
                                                <ProtectedContent permission="AI_MA_DESHABILITAR_MUESTREADOR">
                                                    {m.habilitado === 'S' ? (
                                                        <Button variant="outline" size="sm" className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDisableClick(m)}>
                                                            <IconPower size={16} /> Baja
                                                        </Button>
                                                    ) : (
                                                        <Button variant="outline" size="sm" className="flex-1 text-success hover:bg-success/10 hover:text-success" onClick={() => handleEnableClick(m)}>
                                                            <IconCheck size={16} /> Alta
                                                        </Button>
                                                    )}
                                                </ProtectedContent>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <>
            {content}
            <SamplerRequestsModal
                idMuestreador={requestsSamplerInfo?.id || null}
                nombreMuestreador={requestsSamplerInfo?.nombre || ''}
                isOpen={showRequestsModal}
                onClose={() => setShowRequestsModal(false)}
                onRefresh={() => {
                    loadSolicitudes();
                    fetchData();
                }}
                requests={getPendingRequestsForSampler(Number(requestsSamplerInfo?.id))}
            />

            <SamplerDeactivationModal
                opened={isConfirmModalOpen}
                onClose={() => {
                    setIsConfirmModalOpen(false);
                    setMuestreadorToDisable(null);
                }}
                sampler={{
                    id_muestreador: muestreadorToDisable?.id_muestreador,
                    nombre_muestreador: muestreadorToDisable?.nombre_muestreador || '',
                }}
                onSuccess={() => {
                    fetchData();
                    loadSolicitudes();
                }}
            />

            <ConfirmModal
                isOpen={isEnableConfirmOpen}
                title="Confirmar Habilitación"
                message={`¿Está seguro de habilitar a ${muestreadorToEnable?.nombre_muestreador}? El muestreador podrá ser asignado a nuevas fichas.`}
                confirmText="Habilitar"
                confirmColor="#2f9e44"
                onConfirm={confirmEnable}
                onCancel={() => {
                    setIsEnableConfirmOpen(false);
                    setMuestreadorToEnable(null);
                }}
            />

            <Dialog open={!!zoomedImage} onOpenChange={(open) => !open && setZoomedImage(null)}>
                <DialogContent className="max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle>Firma Digital</DialogTitle>
                    </DialogHeader>
                    <div className="flex justify-center rounded-lg border border-border bg-muted/40 p-6">
                        <img src={zoomedImage ?? undefined} className="max-h-[400px] object-contain" alt="Firma ampliada" />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
};
