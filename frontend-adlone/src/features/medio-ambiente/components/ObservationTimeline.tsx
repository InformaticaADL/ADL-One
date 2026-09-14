import React, { useEffect, useState } from 'react';
import { Timeline, Typography, Tag, Spin } from 'antd';
import {
    IconPencil,
    IconCheck,
    IconX,
    IconAlertTriangle,
    IconCalendar,
    IconInfoCircle,
    IconChevronDown
} from '@tabler/icons-react';
import { fichaService } from '../services/ficha.service';

const { Text } = Typography;

interface TimelineEvent {
    id: string; // Unique ID for key/expansion
    date: Date;
    action: string;
    user: string;
    observation: string;
    stateChange?: { from: string; to: string };
    type: 'CREATION' | 'APPROVAL' | 'REJECTION' | 'REVIEW' | 'ASSIGNMENT' | 'OTHER';
}

interface ObservationTimelineProps {
    fichaId: number;
    // Optional data to synthesize creation event if missing in DB history
    creationData?: {
        date: string;
        user: string;
        observation: string;
    };
}

const TYPE_COLOR: Record<TimelineEvent['type'], { antd: string; hex: string; bg: string }> = {
    CREATION: { antd: 'blue', hex: '#0062a8', bg: 'var(--app-accent-bg)' },
    APPROVAL: { antd: 'green', hex: '#0d9488', bg: 'rgba(13,148,136,0.1)' },
    REJECTION: { antd: 'red', hex: '#e03131', bg: 'rgba(224,49,49,0.08)' },
    REVIEW: { antd: 'orange', hex: '#e8590c', bg: 'rgba(232,89,12,0.08)' },
    ASSIGNMENT: { antd: 'purple', hex: '#9c36b5', bg: 'rgba(156,54,181,0.08)' },
    OTHER: { antd: 'gray', hex: '#868e96', bg: 'var(--app-hover-bg)' },
};

export const ObservationTimeline: React.FC<ObservationTimelineProps> = ({ fichaId, creationData }) => {
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const determineType = (action: string): TimelineEvent['type'] => {
        const act = action.toUpperCase();
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
            'EDICION_COMERCIAL': 'editada por el Área Comercial'
        };

        if (actionMap[action]) return actionMap[action];
        const lowerAction = action.toLowerCase();
        if (actionMap[lowerAction]) return actionMap[lowerAction];
        return action.replace(/_/g, ' ').toLowerCase();
    };

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 32 }}>
            <Spin size="small" />
            <Text type="secondary" style={{ fontSize: 12 }}>Cargando línea de tiempo...</Text>
        </div>
    );

    if (events.length === 0) return (
        <div style={{ padding: 32, textAlign: 'center' }}>
            <Text type="secondary" italic style={{ fontSize: 13 }}>No hay eventos registrados.</Text>
        </div>
    );

    return (
        <div style={{ maxHeight: 350, overflowY: 'auto', overflowX: 'hidden', paddingRight: 8 }}>
            <Timeline
                items={events.map((event) => {
                    const isExpanded = expandedIds.has(event.id);
                    const color = TYPE_COLOR[event.type];

                    return {
                        key: event.id,
                        dot: (
                            <div style={{
                                width: 24, height: 24, borderRadius: '50%', backgroundColor: color.hex, color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {getIcon(event.type)}
                            </div>
                        ),
                        children: (
                            <div style={{ border: '1px solid var(--app-border)', borderRadius: 10, overflow: 'hidden' }}>
                                <button
                                    onClick={() => toggleExpand(event.id)}
                                    style={{
                                        width: '100%', padding: 12, backgroundColor: isExpanded ? color.bg : 'transparent',
                                        border: 'none', borderBottom: isExpanded ? `1px solid ${color.hex}33` : 'none',
                                        cursor: 'pointer', textAlign: 'left',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
                                    }}
                                >
                                    <div style={{ flex: 1 }}>
                                        <Text strong style={{ fontSize: 13, lineHeight: 1.2, display: 'block' }}>
                                            {`Ficha ${fichaId} ${humanizeAction(event.action)}`}
                                        </Text>
                                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                                            Responsable: <Text strong style={{ fontSize: 12 }}>{event.user}</Text>
                                        </Text>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            {event.date.toLocaleString()}
                                        </Text>
                                    </div>
                                    <IconChevronDown
                                        size={16}
                                        style={{
                                            transform: isExpanded ? 'rotate(180deg)' : 'none',
                                            transition: 'transform 200ms ease',
                                            color: 'var(--app-text-secondary)',
                                            flexShrink: 0,
                                            marginTop: 2,
                                        }}
                                    />
                                </button>

                                {isExpanded && (
                                    <div style={{ padding: 12 }}>
                                        {event.stateChange && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                                <Tag>{event.stateChange.from || 'Inicio'}</Tag>
                                                <Text type="secondary" style={{ fontSize: 12 }}>→</Text>
                                                <Tag color={color.antd}>{event.stateChange.to}</Tag>
                                            </div>
                                        )}

                                        {event.observation ? (
                                            <div style={{ backgroundColor: 'var(--app-hover-bg)', border: '1px solid var(--app-border)', borderRadius: 8, padding: 10 }}>
                                                <Text style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{event.observation}</Text>
                                            </div>
                                        ) : (
                                            <Text type="secondary" italic style={{ fontSize: 12 }}>Sin observaciones registradas.</Text>
                                        )}
                                    </div>
                                )}
                            </div>
                        ),
                    };
                })}
            />
        </div>
    );
};
