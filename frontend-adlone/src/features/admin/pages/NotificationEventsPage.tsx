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
    const filteredEvents = events;

    const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});
    const [moduleSearchTerms, setModuleSearchTerms] = useState<Record<string, string>>({});

    const toggleModule = (module: string) => {
        setCollapsedModules(prev => ({
            ...prev,
            [module]: !prev[module]
        }));
    };

    const [collapsedThemes, setCollapsedThemes] = useState<Record<string, boolean>>({});

    const toggleTheme = (module: string, theme: string) => {
        const key = `${module}-${theme}`;
        setCollapsedThemes(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // Group by module with local filtering
    const groupedEvents = filteredEvents.reduce((acc, ev) => {
        const module = ev.modulo || 'Sin Módulo';
        const localSearch = (moduleSearchTerms[module] || '').toLowerCase();

        const matchesLocalSearch = !localSearch ||
            ev.codigo_evento.toLowerCase().includes(localSearch) ||
            ev.descripcion.toLowerCase().includes(localSearch);

        if (matchesLocalSearch) {
            if (!acc[module]) acc[module] = [];
            acc[module].push(ev);
        }
        return acc;
    }, {} as Record<string, NotificationEvent[]>);

    const getThemeColor = (theme: string) => {
        const colors: Record<string, { bg: string, text: string, border: string }> = {
            'Reporte de Problema': { bg: '#fff5f5', text: '#c53030', border: '#feb2b2' },
            'Registro de Equipo (Alta)': { bg: '#ebf8ff', text: '#2b6cb0', border: '#90cdf4' },
            'Baja de Equipo': { bg: '#f7fafc', text: '#4a5568', border: '#e2e8f0' },
            'Baja por Pérdida': { bg: '#fffaf0', text: '#c05621', border: '#fbd38d' },
            'Equipo Deshabilitado': { bg: '#faf5ff', text: '#6b46c1', border: '#d6bcfa' },
            'Revisión de Equipo': { bg: '#edf2f7', text: '#2d3748', border: '#cbd5e0' },
            'Vigencia Próxima': { bg: '#fff5f7', text: '#b83280', border: '#fbb6ce' },
            'Traspaso de Equipo': { bg: '#e6fffa', text: '#2c7a7b', border: '#81e6d9' },
            'Reactivación de Equipo': { bg: '#f0fff4', text: '#2f855a', border: '#9ae6b4' },
            'Nuevo Equipo': { bg: '#ebf4ff', text: '#3182ce', border: '#90cdf4' },
            'Gestión General / Otras': { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' },
            'Fichas de Ingreso': { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
        };
        return colors[theme] || { bg: '#f7fafc', text: '#4a5568', border: '#e2e8f0' };
    };

    const getEventTheme = (code: string) => {
        if (code.includes('FICHA_')) return 'Fichas de Ingreso';
        if (code.includes('_REPORTE_PROBLEMA')) return 'Reporte de Problema';
        if (code.includes('_ALTA')) return 'Registro de Equipo (Alta)';
        if (code.includes('_BAJA')) return 'Baja de Equipo';
        if (code.includes('_EQUIPO_PERDIDO')) return 'Baja por Pérdida';
        if (code.includes('_EQUIPO_DESHABILITADO')) return 'Equipo Deshabilitado';
        if (code.includes('_REVISION')) return 'Revisión de Equipo';
        if (code.includes('_VIGENCIA_PROXIMA')) return 'Vigencia Próxima';
        if (code.includes('_TRASPASO')) return 'Traspaso de Equipo';
        if (code.includes('_REAC')) return 'Reactivación de Equipo';
        if (code.includes('_NUEVO_EQUIPO')) return 'Nuevo Equipo';
        if (code === 'SOL_EQUIPO_NUEVA') return 'Gestión General / Otras';
        return 'Otros';
    };

    return (
        <div className="admin-container">
            <div className="admin-header-section responsive-header">
                {/* Izquierda: botón Volver */}
                <div style={{ justifySelf: 'start' }}>
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
                </div>

                {/* Centro: título + subtítulo */}
                <div style={{ justifySelf: 'center', textAlign: 'center' }}>
                    <h1 className="admin-title" style={{ margin: '0 0 0.15rem 0' }}>Configuración de Correos - Paso 1</h1>
                    <p className="admin-subtitle" style={{ margin: 0 }}>Seleccione el evento que desea configurar</p>
                </div>

                {/* Derecha: vacío (balance) */}
                <div></div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', maxWidth: '1200px', margin: '0 auto' }}>

                {/* Main Content Area */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '30px', height: '30px', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spinner-spin 1s linear infinite' }}></div>
                        <p style={{ color: '#64748b' }}>Cargando eventos de notificación...</p>
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '4rem',
                        backgroundColor: '#f8fafc',
                        borderRadius: '12px',
                        border: '2px dashed #e2e8f0',
                        color: '#94a3b8'
                    }}>
                        <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>📭 No se encontraron eventos</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {modules.sort().map((module) => {
                            const moduleEvents = groupedEvents[module] || [];
                            const isModuleExpanded = !collapsedModules[module];
                            const localSearch = moduleSearchTerms[module] || '';

                            // Only show module if it has events matching global filter OR if it matches local search
                            // Actually groupedEvents already filtered them.
                            if (moduleEvents.length === 0 && localSearch === '' && Object.keys(groupedEvents).includes(module)) return null;
                            if (moduleEvents.length === 0 && localSearch === '' && !Object.keys(groupedEvents).includes(module)) return null;


                            const themes = moduleEvents.reduce((acc, ev) => {
                                const theme = getEventTheme(ev.codigo_evento);
                                if (!acc[theme]) acc[theme] = [];
                                acc[theme].push(ev);
                                return acc;
                            }, {} as Record<string, NotificationEvent[]>);

                            return (
                                <div key={module} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                                    {/* Module Header with Search */}
                                    <div
                                        onClick={() => toggleModule(module)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '1rem 1.5rem',
                                            backgroundColor: '#f8fafc',
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            gap: '1rem',
                                            flexWrap: 'wrap'
                                        }}
                                    >
                                        <div style={{
                                            transition: 'transform 0.2s',
                                            transform: isModuleExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            color: '#64748b'
                                        }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="6 9 12 15 18 9"></polyline>
                                            </svg>
                                        </div>
                                        <span style={{ fontSize: '1.4rem' }}>📁</span>
                                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', flex: '0 1 auto' }}>
                                            {module.toUpperCase()}
                                        </h3>

                                        {/* Per-Module Searcher */}
                                        <div
                                            onClick={(e) => e.stopPropagation()}
                                            style={{
                                                marginLeft: 'auto',
                                                position: 'relative',
                                                minWidth: '250px',
                                                maxWidth: '400px',
                                                flex: 1
                                            }}
                                        >
                                            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
                                            <input
                                                type="text"
                                                placeholder={`Buscar en ${module}...`}
                                                value={localSearch}
                                                onChange={(e) => {
                                                    setModuleSearchTerms(prev => ({ ...prev, [module]: e.target.value }));
                                                    if (!isModuleExpanded) toggleModule(module); // Auto-expand when searching
                                                }}
                                                style={{
                                                    width: '100%',
                                                    padding: '8px 12px 8px 32px',
                                                    borderRadius: '8px',
                                                    border: '1px solid #cbd5e0',
                                                    fontSize: '0.85rem',
                                                    outline: 'none',
                                                    backgroundColor: 'white'
                                                }}
                                            />
                                        </div>

                                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, marginLeft: '1rem' }}>
                                            {moduleEvents.length} eventos
                                        </span>
                                    </div>

                                    {isModuleExpanded && (
                                        <div style={{ padding: '1.5rem', backgroundColor: 'white', borderTop: '1px solid #e2e8f0' }}>
                                            {moduleEvents.length === 0 && localSearch !== '' ? (
                                                <p style={{ color: '#94a3b8', textAlign: 'center', margin: '1rem 0' }}>No hay resultados para "{localSearch}"</p>
                                            ) : (
                                                <>
                                                    {/* Theme Chips (Side-by-Side) */}
                                                    <div style={{
                                                        display: 'flex',
                                                        flexWrap: 'wrap',
                                                        gap: '0.75rem',
                                                        marginBottom: '2rem',
                                                        borderBottom: '1px solid #f1f5f9',
                                                        paddingBottom: '1rem'
                                                    }}>
                                                        {Object.entries(themes).sort(([a], [b]) => a.localeCompare(b)).map(([theme, themeEvents]) => {
                                                            const colors = getThemeColor(theme);
                                                            const themeKey = `${module}-${theme}`;
                                                            const isThemeExpanded = collapsedThemes[themeKey];

                                                            return (
                                                                <div
                                                                    key={theme}
                                                                    onClick={() => toggleTheme(module, theme)}
                                                                    style={{
                                                                        fontSize: '0.75rem',
                                                                        fontWeight: 700,
                                                                        color: isThemeExpanded ? 'white' : colors.text,
                                                                        backgroundColor: isThemeExpanded ? colors.text : colors.bg,
                                                                        border: `1px solid ${isThemeExpanded ? colors.text : colors.border}`,
                                                                        padding: '6px 14px',
                                                                        borderRadius: '20px',
                                                                        textTransform: 'uppercase',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.5rem',
                                                                        boxShadow: isThemeExpanded ? `0 4px 6px ${colors.text}33` : 'none'
                                                                    }}
                                                                >
                                                                    {theme}
                                                                    <span style={{
                                                                        fontSize: '0.7em',
                                                                        opacity: isThemeExpanded ? 1 : 0.7,
                                                                        backgroundColor: isThemeExpanded ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
                                                                        padding: '2px 6px',
                                                                        borderRadius: '8px'
                                                                    }}>
                                                                        {themeEvents.length}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Event Grids */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                                                        {Object.entries(themes).sort(([a], [b]) => a.localeCompare(b)).map(([theme, themeEvents]) => {
                                                            const colors = getThemeColor(theme);
                                                            const themeKey = `${module}-${theme}`;
                                                            const isThemeExpanded = collapsedThemes[themeKey];

                                                            if (!isThemeExpanded) return null;

                                                            return (
                                                                <div key={theme} style={{ animation: 'slideDown 0.3s ease' }}>
                                                                    <h4 style={{ fontSize: '0.85rem', color: colors.text, fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                        <span style={{ width: '3px', height: '14px', backgroundColor: colors.text, borderRadius: '2px' }}></span>
                                                                        {theme}
                                                                    </h4>
                                                                    <div style={{
                                                                        display: 'grid',
                                                                        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',
                                                                        gap: '1rem'
                                                                    }}>
                                                                        {themeEvents.map(ev => (
                                                                            <div
                                                                                key={ev.id_evento}
                                                                                onClick={() => onSelectEvent(ev)}
                                                                                style={{
                                                                                    padding: '1.25rem',
                                                                                    borderRadius: '12px',
                                                                                    border: '1px solid #e2e8f0',
                                                                                    borderLeft: `5px solid ${colors.text}`,
                                                                                    backgroundColor: 'white',
                                                                                    cursor: 'pointer',
                                                                                    transition: 'all 0.3s'
                                                                                }}
                                                                                onMouseEnter={(e) => {
                                                                                    e.currentTarget.style.transform = 'translateY(-3px)';
                                                                                    e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
                                                                                    e.currentTarget.style.borderColor = colors.border;
                                                                                }}
                                                                                onMouseLeave={(e) => {
                                                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                                                    e.currentTarget.style.boxShadow = 'none';
                                                                                    e.currentTarget.style.borderColor = '#e2e8f0';
                                                                                }}
                                                                            >
                                                                                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.5rem', fontFamily: 'monospace', wordBreak: 'break-all', whiteSpace: 'normal' }}>
                                                                                    {ev.codigo_evento}
                                                                                </div>
                                                                                <div style={{ fontSize: '0.95rem', color: '#1e293b', fontWeight: 700, marginBottom: '0.5rem', wordWrap: 'break-word' }}>
                                                                                    {ev.descripcion}
                                                                                </div>
                                                                                <div style={{ fontSize: '0.8rem', color: '#64748b', wordWrap: 'break-word' }}>
                                                                                    📧 {ev.asunto_template.length > 40 ? ev.asunto_template.substring(0, 40) + '...' : ev.asunto_template}
                                                                                </div>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3b82f6;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};
