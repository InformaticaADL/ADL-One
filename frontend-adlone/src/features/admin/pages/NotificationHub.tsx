import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    ChevronRight,
    ChevronDown,
    BellRing,
    Search,
    ArrowLeft,
    RefreshCw,
    Shield,
    Leaf,
    UserCircle,
    Server,
    Zap
} from 'lucide-react';
import { notificationService } from '../../../services/notification.service';
import { useToast } from '../../../contexts/ToastContext';
import { EventRow } from '../components/notifications/EventRow';
import { RecipientModal } from '../components/notifications/RecipientModal';
import '../admin.css';

interface Module {
    id: string | number;
    nombre: string;
    icono?: string;
    funcionalidades: Funcionalidad[];
}

interface Funcionalidad {
    id: number;
    nombre: string;
    eventos: any[];
}

export const NotificationHub: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const { showToast } = useToast();
    const [catalog, setCatalog] = useState<Module[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeModuleId, setActiveModuleId] = useState<string | number | null>(null);
    const [expandedFuncs, setExpandedFuncs] = useState<Record<number, boolean>>({});
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        loadCatalog();
    }, []);

    const loadCatalog = async () => {
        try {
            setLoading(true);
            const data = await notificationService.getNotificationCatalog();
            
            // Separar eventos transaccionales
            const processedModules: Module[] = [];
            let dynamicEvents: any[] = [];
            
            data.forEach((mod: any) => {
                const cleanMod = { ...mod, funcionalidades: [] };
                mod.funcionalidades.forEach((func: any) => {
                    const normalEvents: any[] = [];
                    func.eventos.forEach((ev: any) => {
                        if (ev.es_transaccional) {
                            dynamicEvents.push(ev);
                        } else {
                            normalEvents.push(ev);
                        }
                    });
                    if (normalEvents.length > 0) {
                        cleanMod.funcionalidades.push({ ...func, eventos: normalEvents });
                    }
                });
                if (cleanMod.funcionalidades.length > 0) {
                    processedModules.push(cleanMod);
                }
            });
            
            if (dynamicEvents.length > 0) {
                processedModules.push({
                    id: 'dynamic-events',
                    nombre: 'Eventos Dinámicos',
                    icono: 'zap',
                    funcionalidades: [
                        {
                            id: 999999, // Fake ID
                            nombre: 'Notificaciones Transaccionales',
                            eventos: dynamicEvents
                        }
                    ]
                });
            }

            setCatalog(processedModules);

            // Auto-select first module if exists
            if (processedModules.length > 0 && !activeModuleId) {
                setActiveModuleId(processedModules[0].id || processedModules[0].nombre);
            }
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cargar el catálogo de notificaciones' });
        } finally {
            setLoading(false);
        }
    };

    const toggleFunc = (id: number) => {
        setExpandedFuncs(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleOpenSettings = (event: any) => {
        setSelectedEvent(event);
        setIsModalOpen(true);
    };

    // Obtener el módulo activo
    const activeModule = catalog.find(m => (m.id || m.nombre) === activeModuleId);

    // NUEVO: Lógica para filtrar las funcionalidades y eventos según el SearchTerm
    const filteredFuncionalidades = activeModule ? activeModule.funcionalidades.map(func => {
        // Filtramos los eventos de esta funcionalidad
        const filteredEvents = func.eventos.filter(ev =>
            (ev.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (ev.codigo || ev.codigo_evento || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

        return {
            ...func,
            eventos: filteredEvents,
            // Guardamos un flag para saber si la funcionalidad completa hace match con el nombre
            matchesName: (func.nombre || '').toLowerCase().includes(searchTerm.toLowerCase())
        };
    }).filter(func => func.eventos.length > 0 || func.matchesName) : [];

    // Expande automáticamente los acordeones si hay una búsqueda activa
    useEffect(() => {
        if (searchTerm.length > 2 && activeModule) {
            const newExpanded: Record<number, boolean> = {};
            filteredFuncionalidades.forEach(f => { newExpanded[f.id] = true; });
            setExpandedFuncs(newExpanded);
        }
    }, [searchTerm, activeModuleId]);

    // Get Module Icon
    const getModuleIcon = (name: string, isDynamic?: boolean) => {
        if (isDynamic || name === 'Eventos Dinámicos') return <Zap size={20} color="#8b5cf6" />;
        const n = name.toUpperCase();
        if (n.includes('MEDIO') || n.includes('AMBIENTE')) return <Leaf size={20} />;
        if (n.includes('ADMIN') || n.includes('SISTEMA')) return <Shield size={20} />;
        if (n.includes('USUARIO')) return <UserCircle size={20} />;
        return <Server size={20} />;
    };

    return (
        <div className="admin-container" style={{ maxWidth: '1400px' }}>
            {/* Header Aesthetics 3.0 */}
            <div className="notification-hub-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '2rem',
                padding: '1.5rem',
                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(20px)',
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.4)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.05)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    {onBack && (
                        <button onClick={onBack} className="btn-back" style={{ marginBottom: 0 }}>
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                            Hub de Notificaciones <span style={{ color: '#3b82f6', fontSize: '0.8rem', verticalAlign: 'middle', marginLeft: '8px', padding: '4px 10px', backgroundColor: '#eff6ff', borderRadius: '20px', fontWeight: 700 }}>v3.0</span>
                        </h1>
                        <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.95rem' }}>Administre destinatarios y canales de alerta para todo el sistema.</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="search-box-glass">
                        <Search size={18} color="#94a3b8" />
                        <input
                            type="text"
                            placeholder="Buscar evento o sección..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button onClick={loadCatalog} className="btn-icon-glass" title="Refrescar">
                        <RefreshCw size={20} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {loading && catalog.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '5rem' }}>
                    <div className="loader-dots"></div>
                    <p style={{ color: '#64748b', marginTop: '1rem' }}>Sincronizando catálogo universal...</p>
                </div>
            ) : (
                <div className="hub-layout-3col">
                    {/* Column 1: Modules Navigation */}
                    <div className="module-nav-sidebar">
                        <h3 className="sidebar-title">MÓDULOS</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {catalog.map(mod => {
                                const modId = mod.id || mod.nombre;
                                const isActive = activeModuleId === modId;
                                return (
                                    <div
                                        key={modId}
                                        onClick={() => {
                                            setActiveModuleId(modId);
                                            setSearchTerm(''); // Limpiar busqueda al cambiar módulo
                                        }}
                                        className={`module-nav-item ${isActive ? 'active' : ''}`}
                                    >
                                        <div className="icon-box">
                                            {getModuleIcon(mod.nombre)}
                                        </div>
                                        <span className="module-name">{mod.nombre}</span>
                                        {isActive && <ChevronRight size={16} style={{ marginLeft: 'auto' }} />}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Column 2: Main Area (Accordions) */}
                    <div className="main-content-area-glass">
                        {activeModule ? (
                            <div style={{ animation: 'fadeIn 0.4s ease' }}>
                                <div style={{ marginBottom: '2rem' }}>
                                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1e293b' }}>
                                        {activeModule.nombre}
                                    </h2>
                                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                                        {searchTerm ? `Resultados de búsqueda para "${searchTerm}"` : `${activeModule.funcionalidades.length} funcionalidade(s) configuradas en este módulo.`}
                                    </p>
                                </div>

                                {filteredFuncionalidades.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                                        <p>No se encontraron eventos o funcionalidades con ese nombre.</p>
                                    </div>
                                ) : (
                                    filteredFuncionalidades.map(func => (
                                        <div key={func.id} className="func-accordion">
                                            <div
                                                className="accordion-header"
                                                onClick={() => toggleFunc(func.id)}
                                            >
                                                <div className="icon-circle-mini">
                                                    <LayoutDashboard size={18} />
                                                </div>
                                                <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{func.nombre}</span>
                                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>{func.eventos.length} eventos</span>
                                                    <div style={{ transform: expandedFuncs[func.id] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                                                        <ChevronDown size={20} color="#94a3b8" />
                                                    </div>
                                                </div>
                                            </div>

                                            {expandedFuncs[func.id] && (
                                                <div className="accordion-content" style={{ animation: 'slideDown 0.3s ease' }}>
                                                    {func.eventos.map(ev => (
                                                        <EventRow
                                                            key={ev.id}
                                                            event={ev}
                                                            onOpenSettings={handleOpenSettings}
                                                            onStatusChange={loadCatalog} // CORRECCIÓN: Avisar al padre
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
                                <BellRing size={64} strokeWidth={1} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                                <p>Seleccione un módulo para comenzar la configuración.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <RecipientModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                event={selectedEvent}
                onSaved={loadCatalog}
            />

            <style>{`
                .hub-layout-3col {
                    display: grid;
                    grid-template-columns: 300px 1fr;
                    gap: 2rem;
                    height: calc(100vh - 250px);
                }
                .module-nav-sidebar {
                    background: rgba(255, 255, 255, 0.4);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    padding: 1.5rem;
                    border: 1px solid rgba(255,255,255,0.2);
                }
                .sidebar-title {
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #94a3b8;
                    letter-spacing: 0.1em;
                    margin-bottom: 1.5rem;
                    padding-left: 0.5rem;
                }
                .module-nav-item {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    color: #64748b;
                    font-weight: 600;
                }
                .module-nav-item:hover {
                    background: rgba(255,255,255,0.8);
                    color: #3b82f6;
                    transform: translateX(4px);
                }
                .module-nav-item.active {
                    background: #3b82f6;
                    color: white;
                    box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3);
                }
                .icon-box {
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 10px;
                    background: rgba(0,0,0,0.03);
                }
                .active .icon-box {
                    background: rgba(255,255,255,0.2);
                }
                .main-content-area-glass {
                    background: rgba(255, 255, 255, 0.6);
                    backdrop-filter: blur(10px);
                    border-radius: 24px;
                    padding: 2.5rem;
                    border: 1px solid rgba(255,255,255,0.4);
                    overflow-y: auto;
                    box-shadow: inset 0 0 20px rgba(0,0,0,0.02);
                }
                .search-box-glass {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    background: rgba(255,255,255,0.9);
                    border: 1px solid #e2e8f0;
                    padding: 0.6rem 1rem;
                    border-radius: 12px;
                    min-width: 300px;
                }
                .search-box-glass input {
                    border: none;
                    background: transparent;
                    outline: none;
                    font-size: 0.9rem;
                    width: 100%;
                }
                .btn-icon-glass {
                    width: 44px;
                    height: 44px;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    color: #64748b;
                }
                .btn-icon-glass:hover {
                    background: #f8fafc;
                    color: #3b82f6;
                    border-color: #3b82f6;
                }
                .func-accordion {
                    margin-bottom: 1.5rem;
                    border-radius: 16px;
                    overflow: hidden;
                    background: white;
                    border: 1px solid #f1f5f9;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
                }
                .accordion-header {
                    padding: 1.25rem 1.75rem;
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .accordion-header:hover {
                    background: #f8fafc;
                }
                .accordion-content {
                    padding: 0 1.75rem 1.75rem 1.75rem;
                }
                .icon-circle-mini {
                    width: 32px;
                    height: 32px;
                    background: #eff6ff;
                    color: #3b82f6;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>
        </div>
    );
};