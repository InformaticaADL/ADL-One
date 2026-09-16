import React, { useState } from 'react';
import {
    IconCalendar,
    IconUser,
    IconCheck,
    IconInfoCircle,
    IconBriefcase,
    IconSignature,
    IconArrowRight,
    IconBuildingCommunity,
    IconList,
    IconChevronDown
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { adminService } from '../../../services/admin.service';
import { ursService } from '../../../services/urs.service';
import { useToast } from '../../../contexts/ToastContext';

interface SamplerRequestsModalProps {
    idMuestreador: number | string | null;
    nombreMuestreador: string;
    isOpen: boolean;
    onClose: () => void;
    onRefresh: () => void;
    requests: any[];
}

export const SamplerRequestsModal: React.FC<SamplerRequestsModalProps> = ({
    nombreMuestreador,
    isOpen,
    onClose,
    onRefresh,
    requests
}) => {
    const displayRequests = requests || [];
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [confirmDisableSol, setConfirmDisableSol] = useState<any | null>(null);
    const { showToast } = useToast();
    const isMobile = useMediaQuery('(max-width: 768px)');

    const handleMarkAsRealizada = async (sol: any) => {
        const typeRaw = sol.tipo_solicitud || sol.nombre_tipo || '';
        const isDeshabilitar = typeRaw.toUpperCase().includes('DESHABILITAR');

        if (isDeshabilitar) {
            setConfirmDisableSol(sol);
            return;
        }

        await executeUpdate(sol);
    };

    const executeUpdate = async (sol: any) => {
        setProcessingId(sol.id_solicitud);
        try {
            if (sol.id_tipo || (sol.origen_tabla && sol.origen_tabla !== 'GENERAL')) {
                // Es URS
                await ursService.updateStatus(sol.id_solicitud, {
                    status: 'REALIZADA',
                    comment: 'Solicitud gestionada y marcada como realizada automáticamente.'
                });
            } else {
                // Es Legacy
                await adminService.updateSolicitudStatus(
                    sol.id_solicitud,
                    'REALIZADA',
                    'Solicitud marcada como realizada desde el panel de muestreadores.'
                );
            }
            showToast({ type: 'success', message: `Solicitud #${sol.id_solicitud} marcada como realizada` });
            onRefresh();
        } catch (error) {
            console.error('Error updating status:', error);
            showToast({ type: 'error', message: 'Error al actualizar la solicitud' });
        } finally {
            setProcessingId(null);
        }
    };

    const getStatusVariant = (status: string): 'success' | 'destructive' | 'warning' | 'secondary' | 'default' => {
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
            case 'REALIZADA': return 'default';
            default: return 'secondary';
        }
    };

    const getStatusLabel = (status: string) => {
        return (status || '').replace(/_/g, ' ');
    };

    const renderSolicitudDetails = (sol: any) => {
        const d = sol.datos_json || {};
        const typeRaw = sol.tipo_solicitud || sol.nombre_tipo || '';
        const type = typeRaw.toUpperCase();

        const isDeshabilitar = type.includes('DESHABILITAR');
        const isFirma = type.includes('FIRMA');
        const isTraspaso = type.includes('TRASPASO');

        const transferType = d.tipo_traspaso; // BASE, MUESTREADOR, MANUAL
        const equipmentCount = d.reasignacion_manual?.length || 0;

        return (
            <div className="flex flex-col gap-2">
                <p className="text-[13px] font-semibold text-primary">{typeRaw}</p>

                <div>
                    {isDeshabilitar && (
                        <div className="flex flex-col gap-1">
                            <div className="flex flex-nowrap items-center gap-1">
                                <IconBriefcase size={14} className="text-destructive" />
                                <span className="text-xs font-semibold text-destructive">Solicitud de Deshabilitación</span>
                            </div>

                            {transferType === 'BASE' && (
                                <div className="flex flex-nowrap items-center gap-1">
                                    <IconBuildingCommunity size={12} className="text-muted-foreground" />
                                    <span className="text-xs font-semibold text-foreground">Traspaso a Base:</span>
                                    <span className="text-xs text-primary">{d.base_destino || 'Principal'}</span>
                                </div>
                            )}

                            {transferType === 'MUESTREADOR' && (
                                <div className="flex flex-nowrap items-center gap-1">
                                    <IconUser size={12} className="text-muted-foreground" />
                                    <span className="text-xs font-semibold text-foreground">Traspaso a:</span>
                                    <span className="text-xs text-primary">{d.muestreador_destino_nombre || 'Muestreador Destino'}</span>
                                </div>
                            )}

                            {transferType === 'MANUAL' && (
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex flex-nowrap items-center gap-1">
                                        <IconList size={12} className="text-muted-foreground" />
                                        <span className="text-xs font-semibold text-foreground">Traspaso Manual ({equipmentCount} equipos)</span>
                                    </div>
                                    <details className="text-xs">
                                        <summary className="flex cursor-pointer list-none items-center gap-1 font-semibold text-foreground">
                                            <IconChevronDown size={12} />
                                            Ver Detalle de Equipos
                                        </summary>
                                        <div className="mt-1 flex flex-col gap-0.5 pl-4">
                                            {d.reasignacion_manual?.map((item: any, idx: number) => (
                                                <div key={idx} className="flex flex-nowrap justify-between gap-1">
                                                    <span className="truncate text-xs text-foreground">{item.nombre_equipo}</span>
                                                    <IconArrowRight size={10} />
                                                    <span className="text-xs font-semibold text-secondary-foreground">{item.id_muestreador_nuevo ? 'Asignado' : 'Pendiente'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                </div>
                            )}
                        </div>
                    )}
                    {isFirma && (
                        <div className="flex flex-nowrap items-center gap-1">
                            <IconSignature size={12} className="text-primary" />
                            <span className="text-xs font-semibold text-primary">Actualización de Firma</span>
                        </div>
                    )}
                    {isTraspaso && (
                        <div className="flex flex-nowrap items-center gap-1">
                            <IconUser size={12} className="text-primary" />
                            <span className="text-xs font-semibold text-success">Asignación de Equipos</span>
                        </div>
                    )}
                </div>

                {(d.observaciones || d.descripcion || d.comentario) && (
                    <div className="mt-1">
                        <p className="mb-1 block text-[11px] text-muted-foreground">Observaciones</p>
                        <p className="text-xs italic text-muted-foreground">
                            "{d.observaciones || d.descripcion || d.comentario}"
                        </p>
                    </div>
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
        <>
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-h-[85vh] max-w-[900px] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Solicitudes Pendientes</DialogTitle>
                    <p className="text-[13px] text-muted-foreground">{nombreMuestreador}</p>
                </DialogHeader>

                <div className="relative min-h-[200px]">
                    {displayRequests.length === 0 ? (
                        <div className="flex items-start gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
                            <IconInfoCircle size={16} className="mt-0.5 shrink-0 text-primary" />
                            <p className="text-sm text-foreground">No hay solicitudes pendientes activas para este muestreador.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {!isMobile ? (
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
                                        {displayRequests.map((sol: any) => (
                                            <TableRow key={`${sol.origen_tabla}-${sol.id_solicitud}`}>
                                                <TableCell><span className="text-[13px] font-semibold text-foreground">#{sol.id_solicitud}</span></TableCell>
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
                                                <TableCell><Badge variant={getStatusVariant(sol.estado)} className="min-w-[80px] justify-center">{getStatusLabel(sol.estado)}</Badge></TableCell>
                                                <TableCell className="text-right">
                                                    {(sol.estado === 'PENDIENTE' || sol.estado === 'ACEPTADA') && (
                                                        <Button
                                                            size="sm"
                                                            className="bg-success text-success-foreground hover:bg-success/90"
                                                            disabled={processingId === sol.id_solicitud}
                                                            onClick={() => handleMarkAsRealizada(sol)}
                                                        >
                                                            {processingId === sol.id_solicitud ? (
                                                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-success-foreground border-t-transparent" />
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
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {displayRequests.map((sol: any) => (
                                        <Card key={`${sol.origen_tabla}-${sol.id_solicitud}`} className="p-3">
                                            <div className="flex flex-col gap-2">
                                                <div className="flex justify-between">
                                                    <span className="text-[13px] font-semibold text-primary">#{sol.id_solicitud}</span>
                                                    <Badge variant={getStatusVariant(sol.estado)}>{getStatusLabel(sol.estado)}</Badge>
                                                </div>

                                                <div className="border-t border-dashed border-border" />

                                                {renderSolicitudDetails(sol)}

                                                <div className="border-t border-dashed border-border" />

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <p className="block text-[11px] font-semibold text-muted-foreground">SOLICITANTE</p>
                                                        <p className="text-xs font-semibold text-foreground">{sol.nombre_solicitante || 'N/A'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="block text-[11px] font-semibold text-muted-foreground">FECHA</p>
                                                        <p className="text-xs font-semibold text-foreground">{formatDate(sol.fecha_creacion)}</p>
                                                    </div>
                                                </div>

                                                {(sol.estado === 'PENDIENTE' || sol.estado === 'ACEPTADA') && (
                                                    <Button
                                                        className="mt-2 w-full bg-success text-success-foreground hover:bg-success/90"
                                                        disabled={processingId === sol.id_solicitud}
                                                        onClick={() => handleMarkAsRealizada(sol)}
                                                    >
                                                        {processingId === sol.id_solicitud ? (
                                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-success-foreground border-t-transparent" />
                                                        ) : (
                                                            <IconCheck size={16} />
                                                        )}
                                                        Marcar como Realizada
                                                    </Button>
                                                )}
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" className={isMobile ? 'w-full' : undefined} onClick={onClose}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

            <Dialog open={!!confirmDisableSol} onOpenChange={(open) => { if (!open) setConfirmDisableSol(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Deshabilitación</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        ¿Está seguro de que desea deshabilitar este muestreador y reasignar todos sus equipos según lo solicitado?
                        Esta acción es irreversible y afectará el acceso del usuario.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDisableSol(null)}>Cancelar</Button>
                        <Button
                            variant="destructive"
                            onClick={async () => {
                                const sol = confirmDisableSol;
                                setConfirmDisableSol(null);
                                if (sol) await executeUpdate(sol);
                            }}
                        >
                            Confirmar y Ejecutar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
