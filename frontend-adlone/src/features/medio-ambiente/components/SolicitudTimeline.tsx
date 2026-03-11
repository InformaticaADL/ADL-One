import React, { useEffect, useState } from 'react';
import { adminService } from '../../../services/admin.service';

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

export const SolicitudTimeline: React.FC<SolicitudTimelineProps> = ({ solicitudId, creationData }) => {
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (solicitudId) {
            setLoading(true);
            adminService.getSolicitudHistorial(solicitudId)
                .then(data => {
                    const mappedEvents: TimelineEvent[] = (data || []).map((item: any, idx: number) => {
                        // Correct 3-hour offset: The server sends local time strings that are interpreted as UTC
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

                    // Check if Creation exists
                    const hasCreation = mappedEvents.some(e => e.type === 'CREATION');

                    if (!hasCreation && creationData) {
                        // Synthesize creation event
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
                .catch(err => {
                    console.error('Failed to load history:', err);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [solicitudId, creationData]);

    const determineType = (action: string): TimelineEvent['type'] => {
        if (!action) return 'OTHER';
        const act = action.toUpperCase();
        if (act.includes('CREACION')) return 'CREATION';
        if (act.includes('APROB') || act.includes('ACEPT')) return 'APPROVAL';
        if (act.includes('RECHAZ')) return 'REJECTION';
        if (act.includes('REVISION')) return 'REVIEW';
        if (act.includes('ASIGN')) return 'ASSIGNMENT';
        if (act.includes('RESOLUCION')) return 'APPROVAL'; // Usually final resolution is approval or handled via observation
        return 'OTHER';
    };

    const toggleExpand = (id: string) => {
        const next = new Set(expandedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedIds(next);
    };

    const getIcon = (type: TimelineEvent['type']) => {
        switch (type) {
            case 'CREATION':
                return (
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#E0E7FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4F46E5', zIndex: 2 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    </div>
                );
            case 'APPROVAL':
                return (
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A', zIndex: 2 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                );
            case 'REJECTION':
                return (
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626', zIndex: 2 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                    </div>
                );
            case 'REVIEW':
                return (
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706', zIndex: 2 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                    </div>
                );
            case 'ASSIGNMENT':
                return (
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9333EA', zIndex: 2 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    </div>
                );
            default:
                return (
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', zIndex: 2 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                );
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                <div style={{ display: 'inline-block', width: '20px', height: '20px', border: '2px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>Cargando historial...</div>
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 0.5rem', display: 'block' }}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <div style={{ fontSize: '0.875rem' }}>No hay historial disponible para esta solicitud.</div>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', paddingLeft: '1rem', paddingTop: '0.5rem' }}>
            {/* Timeline vertical line */}
            <div style={{
                position: 'absolute',
                left: '26px', // 1rem (16px) + 16px (half icon) - 1px (half line width) + adjustments based on actual rendering
                top: '0',
                bottom: '0',
                width: '2px',
                background: '#e2e8f0',
                zIndex: 1
            }}></div>

            <style>{`
                @keyframes spin { 100% { transform: rotate(360deg); } }
                .timeline-card:hover { transform: translateX(4px); border-color: #cbd5e1; }
            `}</style>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {events.map((event) => {
                    const isExpanded = expandedIds.has(event.id);
                    // Determine if we need to truncate the observation
                    const isLongObs = event.observation && event.observation.length > 150;
                    const displayObs = (!isExpanded && isLongObs)
                        ? event.observation.substring(0, 150) + '...'
                        : event.observation;

                    return (
                        <div key={event.id} style={{ display: 'flex', gap: '1rem', position: 'relative' }}>
                            {/* Icon */}
                            <div style={{ marginTop: '0.25rem' }}>
                                {getIcon(event.type)}
                            </div>

                            {/* Content Card */}
                            <div
                                className="timeline-card"
                                style={{
                                    flex: 1,
                                    background: 'white',
                                    border: '1px solid #edeff5',
                                    borderRadius: '8px',
                                    padding: '1rem',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                    transition: 'all 0.2s',
                                    width: 'calc(100% - 48px)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>
                                            {(() => {
                                                const friendlyAction: Record<string, string> = {
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
                                                return friendlyAction[event.action] || event.action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
                                            })()}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                                            <span style={{
                                                background: '#f1f5f9', color: '#475569', fontSize: '0.75rem', padding: '0.125rem 0.5rem', borderRadius: '12px', fontWeight: 500
                                            }}>{event.user}</span>
                                        </div>
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '0.8rem', textAlign: 'right' }}>
                                        <div style={{ fontWeight: 500 }}>{event.date.toLocaleDateString('es-CL')}</div>
                                        <div>{event.date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</div>
                                    </div>
                                </div>

                                {/* State Change Badge (if available) */}
                                {event.stateChange && event.stateChange.to && event.stateChange.to !== event.stateChange.from && (
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px',
                                        padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: '#64748b',
                                        marginBottom: '0.5rem'
                                    }}>
                                        <span style={{ opacity: 0.7 }}>Estado:</span>
                                        {(() => {
                                            const friendlyState = (s: string) => {
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
                                            return (
                                                <>
                                                    {event.stateChange.from && (
                                                        <>
                                                            <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{friendlyState(event.stateChange.from)}</span>
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                                                        </>
                                                    )}
                                                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{friendlyState(event.stateChange.to)}</span>
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Observation Text */}
                                {event.observation && (
                                    <div style={{
                                        background: '#f8fafc',
                                        padding: '0.75rem',
                                        borderRadius: '6px',
                                        color: '#334155',
                                        fontSize: '0.875rem',
                                        lineHeight: '1.5',
                                        border: '1px solid #f1f5f9',
                                        whiteSpace: 'pre-wrap',
                                        marginTop: '0.5rem'
                                    }}>
                                        {displayObs}

                                        {isLongObs && (
                                            <button
                                                onClick={() => toggleExpand(event.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#3b82f6',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 500,
                                                    padding: 0,
                                                    marginTop: '0.25rem',
                                                    cursor: 'pointer',
                                                    display: 'block'
                                                }}
                                            >
                                                {isExpanded ? 'Ver menos' : 'Ver más'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
