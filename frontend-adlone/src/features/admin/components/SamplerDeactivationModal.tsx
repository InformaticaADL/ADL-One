import React, { useState, useEffect } from 'react';
import {
    IconUserMinus,
    IconBuildingCommunity,
    IconUsers,
    IconEdit,
    IconHash,
    IconAlertTriangle
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { adminService } from '../../../services/admin.service';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';

interface SamplerDeactivationModalProps {
    opened: boolean;
    onClose: () => void;
    sampler: { id_muestreador: number; nombre_muestreador: string } | null;
    onSuccess: () => void;
}

const SamplerDeactivationModal: React.FC<SamplerDeactivationModalProps> = ({
    opened,
    onClose,
    sampler,
    onSuccess
}) => {
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [transferType, setTransferType] = useState<'BASE' | 'MUESTREADOR' | 'MANUAL' | ''>('');
    const [targetBase, setTargetBase] = useState<string | null>(null);
    const [targetMuestreadorId, setTargetMuestreadorId] = useState<string | null>(null);
    const [equipmentList, setEquipmentList] = useState<any[]>([]);
    const [manualAssignments, setManualAssignments] = useState<Record<number, number>>({});
    const [loading, setLoading] = useState(false);
    const [loadingEquipos, setLoadingEquipos] = useState(false);
    const [equipmentCount, setEquipmentCount] = useState<number | null>(null);
    // MS-04: asignaciones futuras de muestreo
    const [futureAssignments, setFutureAssignments] = useState<{ count: number; assignments: any[] } | null>(null);
    const { showToast } = useToast();
    const isMobile = useMediaQuery('(max-width: 768px)');

    useEffect(() => {
        if (opened) {
            apiClient.get('/api/catalogos/muestreadores')
                .then(res => setMuestreadores(res.data.data))
                .catch(console.error);
        } else {
            // Reset state on close
            setTransferType('');
            setTargetBase(null);
            setTargetMuestreadorId(null);
            setManualAssignments({});
        }
    }, [opened]);

    useEffect(() => {
        if (opened && sampler) {
            setLoadingEquipos(true);
            setEquipmentCount(null);
            setFutureAssignments(null);
            apiClient.get(`/api/admin/equipos?id_muestreador=${sampler.id_muestreador}&limit=100`)
                .then(res => {
                    const list = res.data.data || [];
                    setEquipmentList(list);
                    setEquipmentCount(list.length);
                })
                .catch(console.error)
                .finally(() => setLoadingEquipos(false));

            // MS-04: chequear asignaciones futuras de muestreo
            apiClient.get(`/api/admin/muestreadores/${sampler.id_muestreador}/future-assignments`)
                .then(res => setFutureAssignments(res.data?.data || { count: 0, assignments: [] }))
                .catch(() => setFutureAssignments({ count: 0, assignments: [] }));
        }
    }, [opened, sampler]);

    const bases = [
        { value: 'Base Aysén', label: '🏢 Base Aysén' },
        { value: 'Base Puerto Montt', label: '🏢 Base Puerto Montt' },
        { value: 'Base Villarrica', label: '🏢 Base Villarrica' },
        { value: 'Sede Villarrica', label: '🏢 Sede Villarrica' }
    ];

    const handleConfirm = async () => {
        if (!sampler || !transferType) return;

        // Validation for MANUAL
        if (transferType === 'MANUAL' && equipmentList.length > 0) {
            const allAssigned = equipmentList.every(eq => manualAssignments[eq.id_equipo]);
            if (!allAssigned) {
                showToast({
                    type: 'warning',
                    message: 'Debe asignar todos los equipos antes de continuar con el traspaso manual.'
                });
                return;
            }
        }

        setLoading(true);
        try {
            const reassignmentOptions: any = {
                tipoTraspaso: transferType,
            };

            if (transferType === 'BASE') {
                if (!targetBase) throw new Error("Debe seleccionar una base de destino");
                reassignmentOptions.baseDestino = targetBase;
            } else if (transferType === 'MUESTREADOR') {
                if (!targetMuestreadorId) throw new Error("Debe seleccionar un muestreador de destino");
                reassignmentOptions.idDestino = Number(targetMuestreadorId);
            } else if (transferType === 'MANUAL') {
                reassignmentOptions.reasignacionManual = equipmentList.map(eq => ({
                    id_equipo: eq.id_equipo,
                    sede_nueva: 'PM', // Default for now
                    id_muestreador_nuevo: manualAssignments[eq.id_equipo]
                }));
            }

            await adminService.disableWithReassignment(sampler.id_muestreador, reassignmentOptions);

            showToast({
                type: 'success',
                message: `Muestreador ${sampler.nombre_muestreador} deshabilitado y equipos reasignados.`
            });

            onSuccess();
            onClose();
        } catch (error: any) {
            showToast({
                type: 'error',
                message: error.message || 'Error al deshabilitar muestreador'
            });
        } finally {
            setLoading(false);
        }
    };

    const opciones: { id: 'BASE' | 'MUESTREADOR' | 'MANUAL'; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
        { id: 'BASE', label: 'Traspaso a Base', icon: <IconBuildingCommunity size={20} />, color: '#1c7ed6', bg: 'rgba(28,126,214,0.1)' },
        { id: 'MUESTREADOR', label: 'A Compañero', icon: <IconUsers size={20} />, color: '#0c8599', bg: 'rgba(12,133,153,0.1)' },
        { id: 'MANUAL', label: 'Manual', icon: <IconEdit size={20} />, color: '#4c6ef5', bg: 'rgba(76,110,245,0.1)' },
    ];

    const otherMuestreadores = muestreadores
        .filter(m => m.id_muestreador !== sampler?.id_muestreador)
        .map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador }));

    return (
        <Dialog open={opened} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <IconUserMinus size={20} className="text-destructive" />
                        <DialogTitle>Deshabilitar Muestreador</DialogTitle>
                    </div>
                </DialogHeader>

                <div className="flex flex-col gap-6">
                    <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
                        <IconAlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
                        <p className="text-sm text-foreground">
                            Está a punto de deshabilitar a <b>{sampler?.nombre_muestreador}</b>. Todos sus equipos deben ser reasignados para completar esta acción.
                        </p>
                    </div>

                    {/* MS-04: advertencia si hay muestreos futuros */}
                    {futureAssignments && futureAssignments.count > 0 && (
                        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                            <IconAlertTriangle size={18} className="mt-0.5 shrink-0 text-destructive" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground">Asignaciones de muestreo pendientes</p>
                                <p className="text-[13px] text-muted-foreground">
                                    Este muestreador tiene <b>{futureAssignments.count}</b> muestreo{futureAssignments.count !== 1 ? 's' : ''} programado{futureAssignments.count !== 1 ? 's' : ''} para fechas futuras.
                                    Tras deshabilitarlo, esos muestreos quedarán <b>huérfanos</b> y deberán ser reasignados manualmente desde Asignación o el Calendario.
                                </p>
                                <div className="mt-2 flex flex-col gap-0.5">
                                    {futureAssignments.assignments.slice(0, 5).map((a: any) => (
                                        <p key={a.id_agendamam} className="text-xs text-muted-foreground">
                                            • Ficha #{a.id_fichaingresoservicio} — {a.frecuencia_correlativo} ({a.rol === 'INSTALACION' ? 'instalación' : 'retiro'}) — {a.fecha_muestreo ? new Date(a.fecha_muestreo).toLocaleDateString('es-CL') : '-'}
                                        </p>
                                    ))}
                                    {futureAssignments.assignments.length > 5 && (
                                        <p className="text-xs italic text-muted-foreground">y {futureAssignments.assignments.length - 5} más...</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <p className="text-[13px] font-semibold text-foreground">¿Qué desea hacer con los equipos? ({equipmentCount ?? '...'})</p>

                        {/* Equipos list */}
                        {equipmentList.length > 0 && (
                            <Card className="bg-muted/40 p-3">
                                <div className="flex max-h-[140px] flex-col gap-1 overflow-y-auto">
                                    {loadingEquipos ? (
                                        <div className="flex justify-center p-2">
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                        </div>
                                    ) : equipmentList.map(eq => (
                                        <div key={eq.id_equipo} className="flex flex-nowrap items-center gap-2">
                                            <Badge variant="secondary" className="shrink-0">{eq.codigo || `#${eq.id_equipo}`}</Badge>
                                            <span className="truncate text-xs font-semibold text-foreground">{eq.nombre}</span>
                                            {eq.ubicacion && <span className="shrink-0 text-xs text-muted-foreground">{eq.ubicacion}</span>}
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )}

                        <div className={cn('grid gap-2', isMobile ? 'grid-cols-1' : 'grid-cols-3')}>
                            {opciones.map((opt) => {
                                const selected = transferType === opt.id;
                                return (
                                    <div
                                        key={opt.id}
                                        onClick={() => setTransferType(opt.id)}
                                        className="cursor-pointer rounded-lg border p-4 text-center transition-colors"
                                        style={{
                                            borderColor: selected ? opt.color : 'var(--sc-border)',
                                            backgroundColor: selected ? opt.bg : 'var(--sc-card)',
                                        }}
                                    >
                                        <div className="flex flex-col items-center">
                                            <div
                                                className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg"
                                                style={{ backgroundColor: opt.bg, color: opt.color }}
                                            >
                                                {opt.icon}
                                            </div>
                                            <span className="text-xs font-semibold" style={{ color: selected ? opt.color : 'var(--sc-muted-foreground)' }}>
                                                {opt.label}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {transferType === 'BASE' && (
                        <Field label="Base de destino *">
                            <Combobox
                                placeholder="Seleccione base..."
                                options={bases}
                                value={targetBase ?? undefined}
                                onValueChange={(v) => setTargetBase(v || null)}
                                className="w-full"
                            />
                        </Field>
                    )}

                    {transferType === 'MUESTREADOR' && (
                        <Field label="Muestreador de destino *">
                            <Combobox
                                placeholder="Seleccione destino..."
                                options={otherMuestreadores}
                                value={targetMuestreadorId ?? undefined}
                                onValueChange={(v) => setTargetMuestreadorId(v || null)}
                                className="w-full"
                            />
                        </Field>
                    )}

                    {transferType === 'MANUAL' && (
                        <Card className="bg-muted/40 p-3">
                            <div className="mb-2 flex justify-between">
                                <span className="text-[11px] font-semibold text-muted-foreground">Equipos de {sampler?.nombre_muestreador}</span>
                                <Badge variant="secondary">{equipmentList.length} ítems</Badge>
                            </div>

                            <div className="mb-4 border-t border-border" />

                            <div className="flex max-h-[300px] flex-col gap-3 overflow-y-auto">
                                {loadingEquipos ? (
                                    <div className="flex justify-center p-8">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                    </div>
                                ) : equipmentList.length === 0 ? (
                                    <p className="py-4 text-center text-sm text-muted-foreground">No hay equipos asignados.</p>
                                ) : (
                                    equipmentList.map(eq => (
                                        <div key={eq.id_equipo} className="rounded-lg border border-border bg-card p-2">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex flex-nowrap items-center justify-between">
                                                    <div className="flex flex-1 items-center gap-2 overflow-hidden">
                                                        <Badge variant="outline" className="shrink-0">
                                                            <IconHash size={10} /> {eq.codigo}
                                                        </Badge>
                                                        <span className="truncate text-sm font-semibold text-foreground">{eq.nombre}</span>
                                                    </div>
                                                    {!isMobile && (
                                                        <Combobox
                                                            placeholder="Destino"
                                                            options={otherMuestreadores}
                                                            value={manualAssignments[eq.id_equipo] ? String(manualAssignments[eq.id_equipo]) : undefined}
                                                            onValueChange={(val) => setManualAssignments({ ...manualAssignments, [eq.id_equipo]: Number(val) })}
                                                            className="w-[140px]"
                                                        />
                                                    )}
                                                </div>
                                                {isMobile && (
                                                    <Field label="Asignar a:">
                                                        <Combobox
                                                            placeholder="Seleccione destino"
                                                            options={otherMuestreadores}
                                                            value={manualAssignments[eq.id_equipo] ? String(manualAssignments[eq.id_equipo]) : undefined}
                                                            onValueChange={(val) => setManualAssignments({ ...manualAssignments, [eq.id_equipo]: Number(val) })}
                                                            className="w-full"
                                                        />
                                                    </Field>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    )}

                    <div className={cn('mt-6 flex justify-end gap-2', isMobile && 'flex-col')}>
                        <Button variant="outline" className={isMobile ? 'w-full' : undefined} onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            className={isMobile ? 'w-full' : undefined}
                            disabled={loading || !transferType || (transferType === 'BASE' && !targetBase) || (transferType === 'MUESTREADOR' && !targetMuestreadorId)}
                            onClick={handleConfirm}
                        >
                            {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-destructive-foreground border-t-transparent" />}
                            Confirmar Baja
                        </Button>
                    </div>
                </div>
            </DialogContent>
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

export default SamplerDeactivationModal;
