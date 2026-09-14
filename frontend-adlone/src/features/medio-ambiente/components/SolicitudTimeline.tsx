import React, { useEffect, useState } from 'react';
import { Timeline, Typography, Tag, Spin } from 'antd';
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

interface SolicitudTimelineProps {
    solicitudId: number;
    // Optional data to synthesize creation event if missing in DB history
    creationData?: {
        date: string;
        user: string;
        observation: string;
    };
}

const TYPE_COLOR: Record<TimelineEvent['type'], { antd: string; hex: string; bg: string }> = {
    CREATION: { antd: 'geekblue', hex: '#4263eb', bg: 'rgba(66,99,235,0.08)' },
    APPROVAL: { antd: 'green', hex: '#2f9e44', bg: 'rgba(47,158,68,0.08)' },
    REJECTION: { antd: 'red', hex: '#e03131', bg: 'rgba(224,49,49,0.08)' },
    REVIEW: { antd: 'gold', hex: '#f08c00', bg: 'rgba(240,140,0,0.08)' },
    ASSIGNMENT: { antd: 'purple', hex: '#9c36b5', bg: 'rgba(156,54,181,0.08)' },
    OTHER: { antd: 'gray', hex: '#868e96', bg: 'var(--app-hover-bg)' },
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 32 }}>
            <Spin size="small" />
            <Text type="secondary" style={{ fontSize: 12 }}>Cargando historial...</Text>
        </div>
    );

    if (events.length === 0) return (
        <div style={{ padding: 32, textAlign: 'center' }}>
            <Text type="secondary" italic style={{ fontSize: 13 }}>No hay historial disponible.</Text>
        </div>
    );

    return (
        <Timeline
            items={events.map((event) => {
                const isExpanded = expandedIds.has(event.id);
                const color = TYPE_COLOR[event.type];

                return {
                    key: event.id,
                    dot: (
                        <div style={{
                            width: 22, height: 22, borderRadius: '50%', backgroundColor: color.bg, color: color.hex,
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
                                    <Text strong style={{ fontSize: 13, display: 'block' }}>{getFriendlyAction(event.action)}</Text>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                        <Tag style={{ fontSize: 11, marginInlineEnd: 0 }}>{event.user}</Tag>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            {event.date.toLocaleDateString('es-CL')} {event.date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </div>
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
                                            {event.stateChange.from && (
                                                <>
                                                    <Tag>{getFriendlyState(event.stateChange.from)}</Tag>
                                                    <IconArrowRight size={12} style={{ color: 'var(--app-text-secondary)' }} />
                                                </>
                                            )}
                                            <Tag color={color.antd}>{getFriendlyState(event.stateChange.to)}</Tag>
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
    );
};
