import React, { useEffect, useState } from 'react';
import {
    IconPencil,
    IconCheck,
    IconX,
    IconAlertTriangle,
    IconCalendar,
    IconInfoCircle,
    IconChevronDown,
    IconLink,
    IconCalendarOff,
    IconBan
} from '@tabler/icons-react';
import { fichaService } from '../services/ficha.service';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TimelineEvent {
    id: string; // Unique ID for key/expansion
    date: Date;
    action: string;
    user: string;
    observation: string;
    stateChange?: { from: string; to: string };
    type: 'CREATION' | 'APPROVAL' | 'REJECTION' | 'REVIEW' | 'ASSIGNMENT' | 'GROUP' | 'UNASSIGN' | 'CANCEL' | 'OTHER';
}

interface ObservationTimelineProps {
    /** Sin límite de altura propio: para mostrarla dentro de un panel que ya hace scroll. */
    sinLimiteDeAltura?: boolean;
    fichaId: number;
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
    GROUP: { badgeVariant: 'info', dotClass: 'bg-sky-500 text-white', expandedClass: 'bg-sky-500/5', borderClass: 'border-sky-500/20' },
    UNASSIGN: { badgeVariant: 'warning', dotClass: 'bg-warning text-warning-foreground', expandedClass: 'bg-warning/5', borderClass: 'border-warning/20' },
    CANCEL: { badgeVariant: 'destructive', dotClass: 'bg-destructive text-destructive-foreground', expandedClass: 'bg-destructive/5', borderClass: 'border-destructive/20' },
    OTHER: { badgeVariant: 'outline', dotClass: 'bg-muted-foreground text-background', expandedClass: 'bg-muted/40', borderClass: 'border-border' },
};

export const ObservationTimeline: React.FC<ObservationTimelineProps> = ({ fichaId, creationData, sinLimiteDeAltura }) => {
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const determineType = (action: string): TimelineEvent['type'] => {
        const act = action.toUpperCase();
        if (act.includes('GRUPO')) return 'GROUP';
        if (act.includes('DESASIGNACION')) return 'UNASSIGN';
        if (act.includes('CANCELACION') || act.includes('CANCELAD')) return 'CANCEL';
        if (act.includes('CREACION') || act.includes('CREADA')) return 'CREATION';
        if (act.includes('APROB') || act.includes('ACEPT')) return 'APPROVAL';
        if (act.includes('RECHAZ')) return 'REJECTION';
        if (act.includes('REVISI')) return 'REVIEW';
        if (act.includes('ASIGNA')) return 'ASSIGNMENT';
        return 'OTHER';
    };

    useEffect(() => {
        if (fichaId) {
            setLoading(true);
            fichaService.getHistorial(fichaId)
                .then(data => {
                    const mappedEvents: TimelineEvent[] = (data || []).map((item: any, idx: number) => ({
                        id: `hist-${item.id_historial || idx}`,
                        date: new Date(item.fecha),
                        action: item.accion,
                        user: item.nombre_real || item.nombre_usuario || 'Sistema',
                        observation: item.observacion,
                        stateChange: item.estado_nuevo ? { from: item.estado_anterior, to: item.estado_nuevo } : undefined,
                        type: determineType(item.accion)
                    }));

                    // Check if Creation exists
                    const hasCreation = mappedEvents.some(e => e.type === 'CREATION');

                    if (!hasCreation && creationData) {
                        // Synthesize creation event
                        const creationEvent: TimelineEvent = {
                            id: 'synth-creation',
                            date: new Date(creationData.date),
                            action: 'FICHA CREADA',
                            user: creationData.user || 'Desconocido',
                            observation: creationData.observation,
                            type: 'CREATION',
                            stateChange: { from: '', to: 'NUEVA' }
                        };
                        mappedEvents.push(creationEvent);
                    }

                    // Sort by date ASCENDING for timeline flow (Oldest first)
                    mappedEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

                    setEvents(mappedEvents);
                })
                .catch(err => console.error("Error loading history:", err))
                .finally(() => setLoading(false));
        }
    }, [fichaId, creationData]);

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedIds);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedIds(newExpanded);
    };

    const getIcon = (type: TimelineEvent['type']) => {
        switch (type) {
            case 'CREATION': return <IconPencil size={13} />;
            case 'APPROVAL': return <IconCheck size={13} />;
            case 'REJECTION': return <IconX size={13} />;
            case 'REVIEW': return <IconAlertTriangle size={13} />;
            case 'ASSIGNMENT': return <IconCalendar size={13} />;
            case 'GROUP': return <IconLink size={13} />;
            case 'UNASSIGN': return <IconCalendarOff size={13} />;
            case 'CANCEL': return <IconBan size={13} />;
            default: return <IconInfoCircle size={13} />;
        }
    };

    const humanizeAction = (action: string): string => {
        const actionMap: Record<string, string> = {
            'aprobacion_tecnica': 'aprobada por el Área Técnica',
            'aprobacion_coordinacion': 'aprobada por el Área Coordinación',
            'rechazo_tecnica': 'rechazada por el Área Técnica, solicitud de revisión',
            'rechazo_coordinacion': 'rechazada por el Área Coordinación, solicitud de revisión',
            'asignacion_muestreador': 'programación realizada por el Área Coordinación',
            'ASIGNACION_MASIVA': 'programación realizada por el Área Coordinación',
            'ASIGNACION_MUESTREO': 'programación realizada por el Área Coordinación',
            'revision': 'en revisión',
            'creacion': 'creada por el Área Comercial',
            'CREACION_FICHA': 'creada por el Área Comercial',
            'actualizacion': 'actualizada',
            'FICHA CREADA': 'creada por el Área Comercial',
            'EDICION_POR_AREA_COMERCIAL': 'editada por el Área Comercial',
            'EDICION_COMERCIAL': 'editada por el Área Comercial',
            'GRUPO_MUESTREO': 'agrupada como punto de una visita',
            'DESASIGNACION_MUESTREO': 'sin asignación: vuelve a quedar pendiente de coordinar',
            'CANCELACION_MUESTREO': 'con un muestreo cancelado por Coordinación',
            'CANCELACION_FICHA': 'cancelada',
        };

        if (actionMap[action]) return actionMap[action];
        const lowerAction = action.toLowerCase();
        if (actionMap[lowerAction]) return actionMap[lowerAction];
        return action.replace(/_/g, ' ').toLowerCase();
    };

    if (loading) return (
        <div className="flex flex-col items-center gap-2 py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-xs text-muted-foreground">Cargando línea de tiempo...</span>
        </div>
    );

    if (events.length === 0) return (
        <div className="py-8 text-center">
            <span className="text-sm italic text-muted-foreground">No hay eventos registrados.</span>
        </div>
    );

    return (
        <div className={cn(sinLimiteDeAltura ? 'overflow-x-hidden' : 'max-h-[350px] overflow-y-auto overflow-x-hidden pr-2')}>
            <ol className="flex flex-col">
                {events.map((event, idx) => {
                const isExpanded = expandedIds.has(event.id);
                const style = TYPE_STYLE[event.type];

                return (
                    <li key={event.id} className="relative pb-4 pl-10 last:pb-0">
                        {idx < events.length - 1 && <span className="absolute left-[11px] top-7 h-[calc(100%-12px)] w-px bg-border" aria-hidden="true" />}
                        <span className={cn('absolute left-0 top-2 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-background', style.dotClass)}>
                            {getIcon(event.type)}
                        </span>
                        <div className={cn('overflow-hidden rounded-lg border', style.borderClass)}>
                            <button
                                type="button"
                                onClick={() => toggleExpand(event.id)}
                                className={cn(
                                    'flex w-full items-start justify-between gap-2 border-none p-3 text-left transition-colors',
                                    isExpanded ? style.expandedClass : 'bg-transparent'
                                )}
                            >
                                <div className="flex-1">
                                    <span className="block text-[13px] font-semibold leading-tight text-foreground">
                                        {`Ficha ${fichaId} ${humanizeAction(event.action)}`}
                                    </span>
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                        Responsable: <span className="font-semibold text-foreground">{event.user}</span>
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {event.date.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
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
                                            <Badge variant="outline">{event.stateChange.from || 'Inicio'}</Badge>
                                            <span className="text-xs text-muted-foreground">→</span>
                                            <Badge variant={style.badgeVariant}>{event.stateChange.to}</Badge>
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
                    </li>
                );
            })}
            </ol>
        </div>
    );
};
