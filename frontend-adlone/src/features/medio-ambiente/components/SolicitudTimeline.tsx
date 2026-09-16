import React, { useEffect, useState } from 'react';
import {
    IconPencil,
    IconCheck,
    IconX,
    IconAlertTriangle,
    IconUsers,
    IconInfoCircle,
    IconChevronDown,
    IconArrowRight
} from '@tabler/icons-react';
import { adminService } from '../../../services/admin.service';
import { Timeline } from '@/components/ui/timeline';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TimelineEvent {
    id: string; // Unique ID for key/expansion
    date: Date;
    action: string;
    user: string;
    observation: string;
    stateChange?: { from: string; to: string };
    type: 'CREATION' | 'APPROVAL' | 'REJECTION' | 'REVIEW' | 'ASSIGNMENT' | 'OTHER';
}

interface SolicitudTimelineProps {
    solicitudId: number;
    // Optional data to synthesize creation event if missing in DB history
    creationData?: {
        date: string;
        user: string;
        observation: string;
    };
}

type TimelineTypeStyle = {
    badgeVariant: NonNullable<BadgeProps['variant']>;
    dotClass: string;
    expandedClass: string;
    borderClass: string;
};

const TYPE_STYLE: Record<TimelineEvent['type'], TimelineTypeStyle> = {
    CREATION: { badgeVariant: 'default', dotClass: 'bg-primary text-primary-foreground', expandedClass: 'bg-primary/5', borderClass: 'border-primary/20' },
    APPROVAL: { badgeVariant: 'success', dotClass: 'bg-success text-success-foreground', expandedClass: 'bg-success/5', borderClass: 'border-success/20' },
    REJECTION: { badgeVariant: 'destructive', dotClass: 'bg-destructive text-destructive-foreground', expandedClass: 'bg-destructive/5', borderClass: 'border-destructive/20' },
    REVIEW: { badgeVariant: 'warning', dotClass: 'bg-warning text-warning-foreground', expandedClass: 'bg-warning/5', borderClass: 'border-warning/20' },
    ASSIGNMENT: { badgeVariant: 'secondary', dotClass: 'bg-violet-500 text-white', expandedClass: 'bg-violet-500/5', borderClass: 'border-violet-500/20' },
    OTHER: { badgeVariant: 'outline', dotClass: 'bg-muted-foreground text-background', expandedClass: 'bg-muted/40', borderClass: 'border-border' },
};

export const SolicitudTimeline: React.FC<SolicitudTimelineProps> = ({ solicitudId, creationData }) => {
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const determineType = (action: string): TimelineEvent['type'] => {
        if (!action) return 'OTHER';
        const act = action.toUpperCase();
        if (act.includes('CREACION')) return 'CREATION';
        if (act.includes('APROB') || act.includes('ACEPT')) return 'APPROVAL';
        if (act.includes('RECHAZ')) return 'REJECTION';
        if (act.includes('REVISION')) return 'REVIEW';
        if (act.includes('ASIGN')) return 'ASSIGNMENT';
        if (act.includes('RESOLUCION')) return 'APPROVAL';
        return 'OTHER';
    };

    useEffect(() => {
        if (solicitudId) {
            setLoading(true);
            adminService.getSolicitudHistorial(solicitudId)
                .then(data => {
                    const mappedEvents: TimelineEvent[] = (data || []).map((item: any, idx: number) => {
                        const date = new Date(item.fecha);
                        return {
                            id: `hist-${item.id_historial || idx}`,
                            date: date,
                            action: item.accion,
                            user: item.nombre_real || item.nombre_usuario || 'Sistema',
                            observation: item.observacion,
                            stateChange: item.estado_nuevo ? { from: item.estado_anterior, to: item.estado_nuevo } : undefined,
                            type: determineType(item.accion)
                        };
                    });

                    const hasCreation = mappedEvents.some(e => e.type === 'CREATION');

                    if (!hasCreation && creationData) {
                        const creationEvent: TimelineEvent = {
                            id: 'synth-creation',
                            date: new Date(creationData.date),
                            action: 'Creación de Solicitud',
                            user: creationData.user,
                            observation: creationData.observation || 'Solicitud ingresada al sistema.',
                            type: 'CREATION'
                        };
                        mappedEvents.push(creationEvent);
                    }

                    // Sort descending (newest first)
                    mappedEvents.sort((a, b) => b.date.getTime() - a.date.getTime());
                    setEvents(mappedEvents);
                })
                .catch(err => console.error('Failed to load history:', err))
                .finally(() => setLoading(false));
        }
    }, [solicitudId, creationData]);

    const toggleExpand = (id: string) => {
        const next = new Set(expandedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedIds(next);
    };

    const getIcon = (type: TimelineEvent['type']) => {
        switch (type) {
            case 'CREATION': return <IconPencil size={13} />;
            case 'APPROVAL': return <IconCheck size={13} />;
            case 'REJECTION': return <IconX size={13} />;
            case 'REVIEW': return <IconAlertTriangle size={13} />;
            case 'ASSIGNMENT': return <IconUsers size={13} />;
            default: return <IconInfoCircle size={13} />;
        }
    };

    const getFriendlyAction = (action: string) => {
        const actionMap: Record<string, string> = {
            'CREACION_SOLICITUD': 'Creación de Solicitud',
            'ACEPTACION_REVISION': 'Aceptado para Revisión',
            'DERIVACION_CALIDAD': 'Derivado a Calidad',
            'CONCLUIDO_TECNICA': 'Concluido por Área Técnica',
            'RECHAZADO_TECNICA': 'Rechazado por Área Técnica',
            'APROBACION_CALIDAD': 'Aprobado por Calidad',
            'RECHAZO_CALIDAD': 'Rechazado por Calidad',
            'CIERRE_AUTOMATICO': 'Cierre Automático',
            'CAMBIO_ESTADO': 'Cambio de Estado'
        };
        return actionMap[action] || action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
    };

    const getFriendlyState = (s: string) => {
        if (!s) return '';
        const states: Record<string, string> = {
            'PENDIENTE': 'Pendiente',
            'PENDIENTE_TECNICA': 'Pendiente Área Técnica',
            'EN_REVISION_TECNICA': 'En Revisión Área Técnica',
            'PENDIENTE_CALIDAD': 'Pendiente Área Calidad',
            'APROBADO': 'Aprobado',
            'RECHAZADO': 'Rechazado',
            'CONCLUIDO': 'Concluido',
            'DERIVADO': 'Derivado'
        };
        return states[s] || s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
    };

    if (loading) return (
        <div className="flex flex-col items-center gap-2 py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-xs text-muted-foreground">Cargando historial...</span>
        </div>
    );

    if (events.length === 0) return (
        <div className="py-8 text-center">
            <span className="text-sm italic text-muted-foreground">No hay historial disponible.</span>
        </div>
    );

    return (
        <Timeline items={events.map((event) => {
            const isExpanded = expandedIds.has(event.id);
            const style = TYPE_STYLE[event.type];

            return {
                key: event.id,
                dot: (
                    <div className={cn('flex h-[22px] w-[22px] items-center justify-center rounded-full', style.dotClass)}>
                        {getIcon(event.type)}
                    </div>
                ),
                content: (
                    <div className={cn('overflow-hidden rounded-[10px] border', style.borderClass)}>
                        <button
                            type="button"
                            onClick={() => toggleExpand(event.id)}
                            className={cn(
                                'flex w-full items-start justify-between gap-2 border-none p-3 text-left transition-colors',
                                isExpanded ? style.expandedClass : 'bg-transparent'
                            )}
                        >
                            <div className="flex-1">
                                <span className="block text-[13px] font-semibold leading-tight text-foreground">{getFriendlyAction(event.action)}</span>
                                <div className="mt-1 flex items-center gap-2">
                                    <Badge variant="outline" className="text-[11px]">{event.user}</Badge>
                                    <span className="text-xs text-muted-foreground">
                                        {event.date.toLocaleDateString('es-CL')} {event.date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                            <IconChevronDown
                                size={16}
                                className={cn('mt-0.5 shrink-0 text-muted-foreground transition-transform duration-200', isExpanded && 'rotate-180')}
                            />
                        </button>

                        {isExpanded && (
                            <div className="p-3">
                                {event.stateChange && (
                                    <div className="mb-3 flex items-center gap-2">
                                        {event.stateChange.from && (
                                            <>
                                                <Badge variant="outline">{getFriendlyState(event.stateChange.from)}</Badge>
                                                <IconArrowRight size={12} className="text-muted-foreground" />
                                            </>
                                        )}
                                        <Badge variant={style.badgeVariant}>{getFriendlyState(event.stateChange.to)}</Badge>
                                    </div>
                                )}

                                {event.observation ? (
                                    <div className="rounded-lg border border-border bg-muted/40 p-2.5">
                                        <span className="whitespace-pre-wrap text-sm">{event.observation}</span>
                                    </div>
                                ) : (
                                    <span className="text-xs italic text-muted-foreground">Sin observaciones registradas.</span>
                                )}
                            </div>
                        )}
                    </div>
                ),
            };
        })} />
    );
};
