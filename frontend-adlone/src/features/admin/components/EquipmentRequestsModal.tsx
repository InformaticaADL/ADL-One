import React, { useState, useEffect } from 'react';
import {
    IconCalendar,
    IconUser,
    IconMapPin,
    IconCheck,
    IconInfoCircle
} from '@tabler/icons-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { adminService } from '../../../services/admin.service';
import { ursService } from '../../../services/urs.service';
import { useToast } from '../../../contexts/ToastContext';

interface EquipmentRequestsModalProps {
    idEquipo: number | string | null;
    nombreEquipo: string;
    isOpen: boolean;
    onClose: () => void;
    onRefresh: () => void;
    codigoEquipo?: string;
    requests: any[];
}

export const EquipmentRequestsModal: React.FC<EquipmentRequestsModalProps> = ({
    nombreEquipo,
    codigoEquipo,
    isOpen,
    onClose,
    onRefresh,
    requests
}) => {
    const displayRequests = requests || [];
    const [processingId, setProcessingId] = useState<number | null>(null);
    const { showToast } = useToast();

    useEffect(() => {
        // Simple mount dependency
    }, [isOpen]);

    const handleMarkAsRealizada = async (sol: any) => {
        setProcessingId(sol.id_solicitud);
        try {
            if (sol.id_tipo || (sol.origen_tabla && sol.origen_tabla !== 'GENERAL')) {
                // Es URS
                await ursService.updateStatus(sol.id_solicitud, {
                    status: 'REALIZADA',
                    comment: 'Equipo gestionado y marcado como realizado automáticamente.'
                });
            } else {
                // Es Legacy
                await adminService.updateSolicitudStatus(
                    sol.id_solicitud,
                    'REALIZADA',
                    'Solicitud marcada como realizada desde el panel de equipos.'
                );
            }
            showToast({ type: 'success', message: `Solicitud #${sol.id_solicitud} marcada como realizada` });
            onRefresh();
            onClose();

        } catch (error) {
            console.error('Error updating status:', error);
            showToast({ type: 'error', message: 'Error al actualizar la solicitud' });
        } finally {
            setProcessingId(null);
        }
    };

    const getStatusVariant = (status: string): BadgeProps['variant'] => {
        const s = (status || '').toUpperCase().trim();
        switch (s) {
            case 'PENDIENTE':
            case 'PENDIENTE_TECNICA':
            case 'PENDIENTE_CALIDAD': return 'warning';
            case 'EN_REVISION':
            case 'EN_REVISION_TECNICA': return 'secondary';
            case 'ACEPTADA': return 'success';
            case 'RECHAZADA':
            case 'RECHAZADO_TECNICA': return 'destructive';
            case 'REALIZADA': return 'outline';
            default: return 'outline';
        }
    };

    const getStatusLabel = (status: string) => {
        return (status || '').replace(/_/g, ' ');
    };

    /** Converts code-like strings to human-readable text */
    const CODE_VALUE_MAP: Record<string, string> = {
        'VIDA_UTIL': 'Vida Útil',
        'DANIO': 'Daño',
        'DANO': 'Daño',
        'OBSOLESCENCIA': 'Obsolescencia',
        'PERDIDA': 'Pérdida',
        'ROBO': 'Robo',
        'DETERIORO': 'Deterioro',
        'REEMPLAZO': 'Reemplazo',
        'OTRO': 'Otro',
    };

    const formatCodeValue = (value: string | null | undefined): string => {
        if (!value) return '';
        const upper = String(value).trim().toUpperCase();
        if (CODE_VALUE_MAP[upper]) return CODE_VALUE_MAP[upper];
        return String(value);
    };

    const renderSolicitudDetails = (sol: any) => {
        const d = sol.datos_json || {};
        const typeRaw = sol.tipo_solicitud || sol.nombre_tipo || '';
        const type = typeRaw.toUpperCase();

        const isTraspaso = type.includes('TRASPASO') || d._form_type === 'TRASPASO_EQUIPO' || d.isTransfer;
        const isAlta = type.includes('ALTA') || (type.includes('REACTIVACI') && d.isReactivation);
        const isProblem = type.includes('PROBLEMA') || type.includes('FALLA');

        return (
            <div className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-primary">{typeRaw}</span>

                {/* Specific Details based on Type */}
                <div className="mt-0.5">
                    {isTraspaso && (
                        <div className="flex flex-col gap-0.5">
                            {d.traspaso_de && (
                                <div className="flex items-center gap-1">
                                    <span className="text-xs font-semibold text-muted-foreground">Tipo Traspaso:</span>
                                    <span className="text-xs font-semibold text-primary">
                                        {d.traspaso_de.map((t: string) => t === 'UBICACION' ? 'Sede' : (t === 'RESPONSABLE' ? 'Muestreador' : t)).join(' y ')}
                                    </span>
                                </div>
                            )}
                            {(d.nombre_centro_destino || d.nueva_ubicacion || d.destino || d.ubicacion_destino) && (
                                <div className="flex flex-nowrap items-center gap-1">
                                    <IconMapPin size={12} className="text-primary" />
                                    <span className="text-xs font-semibold text-foreground">Sede Destino:</span>
                                    <Badge variant="outline" className="min-w-fit">
                                        {d.nombre_centro_destino || d.nueva_ubicacion || d.destino || d.ubicacion_destino}
                                    </Badge>
                                </div>
                            )}
                            {(d.nombre_muestreador_destino || d.nuevo_responsable_nombre || d.nuevo_responsable || d.responsable_destino) && (
                                <div className="flex flex-nowrap items-center gap-1">
                                    <IconUser size={12} className="text-primary" />
                                    <span className="text-xs font-semibold text-foreground">Nuevo Responsable:</span>
                                    <span className="text-xs font-semibold text-primary">
                                        {d.nombre_muestreador_destino || d.nuevo_responsable_nombre || d.nuevo_responsable || d.responsable_destino}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ALTA / REACTIVACION DETAILS */}
                    {isAlta && (
                        <div className="flex flex-nowrap items-center gap-1">
                            <IconCalendar size={12} className="text-primary" />
                            <span className="text-xs font-semibold text-foreground">Nueva Vigencia:</span>
                            <Badge variant="outline">
                                {d.nueva_vigencia_solicitada || d.vigencia_propuesta || d.fecha_vigencia || d.vigencia}
                            </Badge>
                        </div>
                    )}

                    {/* PROBLEM REPORT DETAILS */}
                    {isProblem && (
                        <div className="flex flex-col gap-0.5">
                            {d.criticidad && (
                                <Badge variant={d.criticidad.toUpperCase() === 'ALTA' ? 'destructive' : 'warning'}>
                                    CRITICIDAD: {d.criticidad}
                                </Badge>
                            )}
                            {d.descripcion_falla && (
                                <span className="text-xs font-semibold text-destructive">Falla: {d.descripcion_falla}</span>
                            )}
                        </div>
                    )}
                </div>

                {/* General Motive/Comments (Always at the bottom) */}
                {(d.motivo || d.observaciones || d.descripcion || d.comentario) && (
                    <p className="line-clamp-3 text-xs italic text-muted-foreground">
                        "{formatCodeValue(String(d.motivo || d.observaciones || d.descripcion || d.comentario))}"
                    </p>
                )}
            </div>
        );
    };

    const formatDate = (date: string) => {
        if (!date) return '-';
        return new Date(date).toLocaleString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Solicitudes Pendientes</DialogTitle>
                    <div className="flex items-center gap-1.5">
                        {codigoEquipo && <Badge variant="outline">{codigoEquipo}</Badge>}
                        <span className="text-[13px] text-muted-foreground">{nombreEquipo}</span>
                    </div>
                </DialogHeader>

                <div className="relative mt-2 min-h-[200px] min-w-0">
                    {displayRequests.length === 0 ? (
                        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
                            <IconInfoCircle size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                            <span>No hay solicitudes pendientes activas para este equipo.</span>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead>ID</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Solicitante</TableHead>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead className="text-right">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {displayRequests.map((sol) => (
                                            <TableRow key={`${sol.origen_tabla}-${sol.id_solicitud}`}>
                                                <TableCell title={sol.origen_tabla === 'GENERAL' ? 'Solicitud GERR (Sistema General)' : 'Solicitud de Equipo'}>
                                                    <span className={cn('text-[13px] font-semibold', sol.origen_tabla === 'GENERAL' && 'text-primary')}>
                                                        #{sol.id_solicitud}
                                                    </span>
                                                </TableCell>
                                                <TableCell>{renderSolicitudDetails(sol)}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-nowrap items-center gap-1.5">
                                                        <IconUser size={14} className="text-muted-foreground" />
                                                        <span className="text-xs text-foreground">{sol.nombre_solicitante || 'N/A'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-nowrap items-center gap-1.5">
                                                        <IconCalendar size={14} className="text-muted-foreground" />
                                                        <span className="text-xs text-foreground">{formatDate(sol.fecha_creacion)}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={getStatusVariant(sol.estado)} className="min-w-20 justify-center">
                                                        {getStatusLabel(sol.estado)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {(sol.estado === 'PENDIENTE' || sol.estado === 'ACEPTADA') && (
                                                        <Button
                                                            size="sm"
                                                            className="bg-success text-success-foreground hover:bg-success/90"
                                                            disabled={processingId === sol.id_solicitud}
                                                            onClick={() => handleMarkAsRealizada(sol)}
                                                        >
                                                            {processingId === sol.id_solicitud ? (
                                                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                            ) : (
                                                                <IconCheck size={14} />
                                                            )}
                                                            Realizar
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <p className="text-xs italic text-muted-foreground">
                                * Las solicitudes GERR provienen del sistema general de requerimientos.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
