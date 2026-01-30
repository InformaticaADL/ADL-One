import React, { useState, useEffect } from 'react';
import { notificationService } from '../../../services/notification.service';
import { useToast } from '../../../contexts/ToastContext';
import '../admin.css';

interface NotificationEvent {
    id_evento: number;
    codigo_evento: string;
    descripcion: string;
    asunto_template: string;
    modulo?: string;
}

interface Props {
    onBack?: () => void;
    onSelectEvent: (event: NotificationEvent) => void;
}

export const NotificationEventsPage: React.FC<Props> = ({ onBack, onSelectEvent }) => {
    const { showToast } = useToast();
    const [events, setEvents] = useState<NotificationEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedModule, setSelectedModule] = useState<string>('');

    useEffect(() => {
        loadEvents();
    }, []);

    const loadEvents = async () => {
        try {
            setLoading(true);
            const data = await notificationService.getEvents();
            setEvents(data);
        } catch (error) {
            console.error(error);
            showToast({ type: 'error', message: "Error al cargar eventos" });
        } finally {
            setLoading(false);
        }
    };

    // Get unique modules
    const modules = Array.from(new Set(events.map(e => e.modulo || 'Sin Módulo')));

    // Filter events
    const filteredEvents = events.filter(ev => {
        const matchesSearch =
            ev.codigo_evento.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ev.descripcion.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesModule = !selectedModule || (ev.modulo || 'Sin Módulo') === selectedModule;

        return matchesSearch && matchesModule;
    });

    // Group by module
    const groupedEvents = filteredEvents.reduce((acc, ev) => {
        const module = ev.modulo || 'Sin Módulo';
        if (!acc[module]) acc[module] = [];
        acc[module].push(ev);
        return acc;
    }, {} as Record<string, NotificationEvent[]>);

    return (
        <div className="admin-container">
            <div className="admin-header-section">
                {onBack && (
                    <button onClick={onBack} className="btn-back">
                        <span className="icon-circle">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                        </span>
                        Volver
                    </button>
                )}
                <h1 className="admin-title">Configuración de Correos - Paso 1</h1>
                <p className="admin-subtitle">Seleccione el evento que desea configurar</p>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', maxWidth: '1200px', margin: '0 auto' }}>
                {/* Filters */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#374151' }}>
                            🔍 Buscar Evento
                        </label>
                        <input
                            type="text"
                            placeholder="Buscar por código o descripción..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>
                    <div style={{ minWidth: '250px' }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#374151' }}>
                            📁 Filtrar por Módulo
                        </label>
                        <select
                            value={selectedModule}
                            onChange={(e) => setSelectedModule(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '6px',
                                border: '1px solid #d1d5db',
                                fontSize: '0.9rem'
                            }}
                        >
                            <option value="">Todos los módulos</option>
                            {modules.map(mod => (
                                <option key={mod} value={mod}>{mod}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Events grouped by module */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                        Cargando eventos...
                    </div>
                ) : Object.keys(groupedEvents).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                        No se encontraron eventos
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        {Object.entries(groupedEvents).map(([module, moduleEvents]) => (
                            <div key={module}>
                                <h3 style={{
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    color: '#1f2937',
                                    marginBottom: '1rem',
                                    paddingBottom: '0.5rem',
                                    borderBottom: '2px solid #e5e7eb'
                                }}>
                                    📁 {module} ({moduleEvents.length})
                                </h3>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                                    gap: '1rem'
                                }}>
                                    {moduleEvents.map(ev => (
                                        <div
                                            key={ev.id_evento}
                                            onClick={() => onSelectEvent(ev)}
                                            style={{
                                                padding: '1rem',
                                                borderRadius: '8px',
                                                border: '1px solid #e5e7eb',
                                                backgroundColor: 'white',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.borderColor = '#3b82f6';
                                                e.currentTarget.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.1)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.borderColor = '#e5e7eb';
                                                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                            }}
                                        >
                                            <div style={{
                                                fontSize: '0.85rem',
                                                fontWeight: 700,
                                                color: '#3b82f6',
                                                marginBottom: '0.5rem'
                                            }}>
                                                {ev.codigo_evento}
                                            </div>
                                            <div style={{
                                                fontSize: '0.9rem',
                                                color: '#1f2937',
                                                marginBottom: '0.5rem',
                                                fontWeight: 500
                                            }}>
                                                {ev.descripcion}
                                            </div>
                                            <div style={{
                                                fontSize: '0.75rem',
                                                color: '#6b7280',
                                                fontStyle: 'italic'
                                            }}>
                                                📧 {ev.asunto_template}
                                            </div>
                                            <div style={{
                                                marginTop: '0.75rem',
                                                paddingTop: '0.75rem',
                                                borderTop: '1px solid #f3f4f6',
                                                fontSize: '0.75rem',
                                                color: '#3b82f6',
                                                fontWeight: 600,
                                                textAlign: 'right'
                                            }}>
                                                Configurar destinatarios →
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
