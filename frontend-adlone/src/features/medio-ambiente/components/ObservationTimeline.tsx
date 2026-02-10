import React, { useEffect, useState } from 'react';
import { fichaService } from '../services/ficha.service';

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

export const ObservationTimeline: React.FC<ObservationTimelineProps> = ({ fichaId, creationData }) => {
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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

    const determineType = (action: string): TimelineEvent['type'] => {
        const act = action.toUpperCase();
        if (act.includes('CREACION') || act.includes('CREADA')) return 'CREATION';
        if (act.includes('APROB') || act.includes('ACEPT')) return 'APPROVAL';
        if (act.includes('RECHAZ')) return 'REJECTION';
        if (act.includes('REVISI')) return 'REVIEW';
        if (act.includes('ASIGNA')) return 'ASSIGNMENT';
        return 'OTHER';
    };

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
            case 'CREATION': return '📝';
            case 'APPROVAL': return '✅';
            case 'REJECTION': return '❌';
            case 'REVIEW': return '⚠️';
            case 'ASSIGNMENT': return '📅';
            default: return 'ℹ️';
        }
    };

    // Humanize action text from database field names
    const humanizeAction = (action: string): string => {
        const actionMap: Record<string, string> = {
            'aprobacion_tecnica': 'aprobada por el Área Técnica',
            'aprobacion_coordinacion': 'aprobada por el Área Coordinación',
            'rechazo_tecnica': 'rechazada por el Área Técnica',
            'rechazo_coordinacion': 'rechazada por el Área Coordinación',
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

        // Try exact match first
        if (actionMap[action]) {
            return actionMap[action];
        }

        // Try lowercase match
        const lowerAction = action.toLowerCase();
        if (actionMap[lowerAction]) {
            return actionMap[lowerAction];
        }

        // If no match, clean up underscores and return
        return action.replace(/_/g, ' ').toLowerCase();
    };

    const getColor = (type: TimelineEvent['type']) => {
        switch (type) {
            case 'CREATION': return '#3b82f6'; // Blue
            case 'APPROVAL': return '#10b981'; // Green
            case 'REJECTION': return '#ef4444'; // Red
            case 'REVIEW': return '#f59e0b'; // Amber
            case 'ASSIGNMENT': return '#8b5cf6'; // Purple
            default: return '#6b7280'; // Gray
        }
    };

    if (loading) return <div style={{ padding: '1rem', color: '#6b7280', textAlign: 'center' }}>Cargando línea de tiempo...</div>;

    if (events.length === 0) return <div style={{ padding: '1rem', color: '#9ca3af', textAlign: 'center', fontStyle: 'italic' }}>No hay eventos registrados.</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            {events.map((event, index) => {
                const isExpanded = expandedIds.has(event.id);
                const color = getColor(event.type);
                const isLast = index === events.length - 1;

                return (
                    <div key={event.id} style={{ display: 'flex', gap: '1rem' }}>
                        {/* Timeline Connector */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '40px' }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                backgroundColor: color,
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 1,
                                fontSize: '1.2rem'
                            }}>
                                {getIcon(event.type)}
                            </div>
                            {!isLast && (
                                <div style={{
                                    width: '2px',
                                    flexGrow: 1,
                                    backgroundColor: '#e5e7eb',
                                    margin: '4px 0'
                                }} />
                            )}
                        </div>

                        {/* Content Card */}
                        <div style={{ flexGrow: 1 }}>
                            <div
                                onClick={() => toggleExpand(event.id)}
                                style={{
                                    border: `1px solid ${isExpanded ? color : '#e5e7eb'}`,
                                    borderRadius: '8px',
                                    backgroundColor: 'white',
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    boxShadow: isExpanded ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                                }}
                            >
                                {/* Header */}
                                <div style={{
                                    padding: '12px 16px',
                                    backgroundColor: isExpanded ? `${color}10` : 'white', // 10% opacity hex
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#1f2937', fontSize: '0.95rem' }}>
                                            {`Ficha ${fichaId} ${humanizeAction(event.action)}. Responsable: ${event.user}.`}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>
                                            {event.date.toLocaleString()}
                                        </div>
                                    </div>
                                    <div style={{
                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.2s',
                                        color: '#6b7280'
                                    }}>
                                        ▼
                                    </div>
                                </div>

                                {/* Body (Details) */}
                                {isExpanded && (
                                    <div style={{ padding: '16px', borderTop: '1px solid #f3f4f6' }}>
                                        {event.stateChange && (
                                            <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '8px' }}>
                                                Estado: <strong>{event.stateChange.from || 'Inicio'}</strong> &rarr; <strong>{event.stateChange.to}</strong>
                                            </div>
                                        )}
                                        {event.observation ? (
                                            <div style={{
                                                backgroundColor: '#f9fafb',
                                                padding: '12px',
                                                borderRadius: '6px',
                                                border: '1px solid #e5e7eb',
                                                fontSize: '0.9rem',
                                                color: '#374151',
                                                whiteSpace: 'pre-wrap'
                                            }}>
                                                {event.observation}
                                            </div>
                                        ) : (
                                            <div style={{ fontStyle: 'italic', color: '#9ca3af', fontSize: '0.9rem' }}>
                                                Sin observaciones registradas.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
