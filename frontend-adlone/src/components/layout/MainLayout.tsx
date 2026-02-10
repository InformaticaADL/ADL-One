import React, { useState } from 'react';
import { useNavStore } from '../../store/navStore';
import { useAuth } from '../../contexts/AuthContext';
import { adminService } from '../../services/admin.service';
import { useEffect } from 'react';
import './MainLayout.css';
import logoAdl from '../../assets/images/logo-adlone.png';
import logoUser from '../../assets/images/logo_user.png';

// Módulos reales de ADL One
const MODULES = [
    // Grupo 1: Unidades
    { id: 'gem', label: 'GEM', icon: '🧬' },
    { id: 'necropsia', label: 'Necropsia', icon: '🐟' },
    { id: 'microscopia', label: 'Microscopía', icon: '🔬' },
    { id: 'biologia_molecular', label: 'Biología Molecular', icon: '🧪' },
    { id: 'cultivo_celular', label: 'Cultivo Celular', icon: '🧫' },
    { id: 'bacteriologia', label: 'Bacteriología', icon: '🦠' },
    { id: 'screening', label: 'Screening', icon: '🔎' },
    { id: 'derivaciones', label: 'Derivaciones', icon: '📬' },
    { id: 'medio_ambiente', label: 'Medio Ambiente', icon: '🌿' }, // Could add MA_ACCESO here too if desired, but user asked about Admin
    { id: 'atl', label: 'ATL', icon: '⚖️' },
    { id: 'id', label: 'I+D', icon: '💡' },
    { id: 'pve', label: 'PVE', icon: '🩺' },
    { id: 'informatica', label: 'Informática', icon: '💻' },
    { id: 'comercial', label: 'Comercial', icon: '📈' },
    { id: 'gestion_calidad', label: 'Gestión de Calidad', icon: '⭐' },
    { id: 'administracion', label: 'Administración', icon: '🏢' },

    // Separador
    { id: 'div1', type: 'divider', label: '', icon: '' },

    // Grupo 2: Gestión
    { id: 'facturacion', label: 'Facturación', icon: '💲' },
    { id: 'estadistica', label: 'Estadística', icon: '📊' },
    { id: 'admin_informacion', label: 'Admin. Información', icon: '📂', permission: 'MA_ADMIN_ACCESO' }, // Added permission

    // Separador
    { id: 'div2', type: 'divider', label: '', icon: '' },

    // Grupo 3: Soporte
    { id: 'ayuda', label: 'Ayuda', icon: '❓' },
];

// Simulamos Submódulos 
const SUBMODULES_MOCK: Record<string, any[]> = {
    'medio_ambiente': [
        { id: 'ma-fichas-ingreso', label: 'Fichas de ingreso', permission: 'MA_ACCESO' },
        { id: 'ma-solicitudes', label: 'Realizar Solicitudes', permission: 'MA_ACCESO' },
    ],
    'administracion': [], // Now empty, managed via AdminInfoHub
    // Agregamos datos para GEM para evitar menú vacío
    'gem': [
        { category: 'Gestión GEM' },
        { id: 'gem-dashboard', label: 'Dashboard General' },
        { id: 'gem-reportes', label: 'Reportes Consolidados' },
        { id: 'gem-config', label: 'Configuración' }
    ]
};

interface MainLayoutProps {
    children?: React.ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
    // Usamos el store global en lugar de useState local
    const { activeModule, activeSubmodule, drawerOpen, setActiveModule, setActiveSubmodule, setDrawerOpen } = useNavStore();

    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [hiddenNotifications, setHiddenNotifications] = useState<number[]>([]);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    // Context User
    const { user, logout, hasPermission } = useAuth();

    // Fetch notifications
    const fetchNotifications = async () => {
        try {
            // Depending on user role, we might want different notifications. 
            // For now, mirroring what was in the pages:
            const data = await adminService.getSolicitudes({
                estado: hasPermission('MA_ADMIN_ACCESO') ? 'PENDIENTE' : undefined,
                solo_mias: !hasPermission('MA_ADMIN_ACCESO')
            });

            // Filter strictly for "TODAY" as requested
            const today = new Date().toLocaleDateString();
            const todayNotifications = data.filter((sol: any) =>
                new Date(sol.fecha_solicitud).toLocaleDateString() === today
            );

            setNotifications(todayNotifications);
        } catch (error) {
            console.error("Error fetching global notifications:", error);
        }
    };

    useEffect(() => {
        if (user) {
            fetchNotifications();
            const interval = setInterval(fetchNotifications, 60000); // Poll every minute
            return () => clearInterval(interval);
        }
    }, [user]);

    // Imagen de perfil fija según requerimiento
    // Imagen de perfil fija según requerimiento
    const profileImage = logoUser;

    const handleLogout = () => {
        logout();
    };

    const handleModuleClick = (mod: any) => {
        if (mod.type === 'divider') return;

        // Si cambiamos de módulo, el store mantiene su estado, pero si queremos resetear submodulo:
        if (activeModule !== mod.id) {
            setActiveSubmodule('');
        }
        setActiveModule(mod.id);

        // Abrir drawer si tiene submódulos
        if (SUBMODULES_MOCK[mod.id]) {
            setDrawerOpen(true);
            setMobileSidebarOpen(false);
        } else {
            setDrawerOpen(false);
            setMobileSidebarOpen(false); // Cerrar sidebar si es navegación directa
        }
    };

    const getSubmodules = () => {
        return SUBMODULES_MOCK[activeModule] || [];
    };

    const handleSubmoduleClick = (item: any) => {
        setActiveSubmodule(item.id);
    };

    return (
        <div className="app-layout">
            {/* --- Sidebar Lateral --- */}
            <aside className={`app-sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
                <div className="sidebar-header">
                    <img src={logoAdl} alt="ADL Logo" className="sidebar-logo" />
                    <button
                        className="btn-close-sidebar-mobile"
                        onClick={() => setMobileSidebarOpen(false)}
                    >✕</button>
                </div>

                <div className="sidebar-menu">
                    <div style={{ padding: '0 0.8rem 0.5rem', fontSize: '0.7rem', fontWeight: 'bold', color: '#a1a1aa', letterSpacing: '0.5px' }}>UNIDADES</div>

                    {MODULES.filter(mod => !mod.permission || hasPermission(mod.permission)).map((mod) => (
                        mod.type === 'divider' ? (
                            <div key={mod.id} style={{ height: '1px', backgroundColor: '#e4e4e7', margin: '0.5rem 1rem' }} />
                        ) : (
                            <div
                                key={mod.id}
                                className={`menu-item ${activeModule === mod.id ? 'active' : ''}`}
                                onClick={() => handleModuleClick(mod)}
                            >
                                <span className="item-icon">{mod.icon}</span>
                                <span className="item-label">{mod.label}</span>
                            </div>
                        )
                    ))}
                </div>
            </aside>

            {/* Backdrop para Sidebar Móvil */}
            <div
                className={`sidebar-backdrop ${mobileSidebarOpen ? 'visible' : ''}`}
                onClick={() => setMobileSidebarOpen(false)}
            ></div>

            {/* --- RENDERIZADO CONDICIONAL DEL DRAWER --- */}
            {drawerOpen && (
                <>
                    <div className="module-drawer open">
                        <div className="drawer-header">
                            <div className="drawer-title">{MODULES.find(m => m.id === activeModule)?.label}</div>
                            <button
                                onClick={() => setDrawerOpen(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    padding: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#52525b',
                                    flexShrink: 0,
                                    zIndex: 50
                                }}
                                type="button"
                                aria-label="Cerrar"
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="drawer-content">
                            {getSubmodules().length > 0 ? (
                                getSubmodules()
                                    .filter(item => !item.permission || hasPermission(item.permission))
                                    .map((item, index) => (
                                        item.category ? (
                                            <div key={index} className="submodule-category">{item.category}</div>
                                        ) : (
                                            <div
                                                key={item.id}
                                                className={`submodule-item ${activeSubmodule === item.id ? 'active' : ''}`}
                                                onClick={() => handleSubmoduleClick(item)}
                                            >
                                                {item.label}
                                            </div>
                                        )
                                    ))
                            ) : (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.9rem' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                                    No hay opciones disponibles <br /> para este módulo.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="drawer-backdrop visible" onClick={() => setDrawerOpen(false)}></div>
                </>
            )}

            {/* --- Header Superior --- */}
            <header className="app-header">
                <div className="header-left">
                    <button
                        className="hamburger-menu"
                        onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
                        aria-label="Toggle menu"
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <line x1="3" y1="18" x2="21" y2="18"></line>
                        </svg>
                    </button>
                    <h2 className="page-title">{MODULES.find(m => m.id === activeModule)?.label}</h2>
                </div>

                <div className="header-right">
                    {/* Notifications Icon */}
                    <div
                        className="notification-container"
                        style={{ position: 'relative', marginRight: '1rem' }}
                        tabIndex={0}
                        onBlur={() => setTimeout(() => setShowNotifications(false), 200)}
                    >
                        <button
                            className="btn-icon-header"
                            onClick={() => setShowNotifications(!showNotifications)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '8px',
                                borderRadius: '50%',
                                transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                            </svg>
                            {notifications.filter(n => !hiddenNotifications.includes(n.id_solicitud)).length > 0 && (
                                <span style={{
                                    position: 'absolute',
                                    top: '4px',
                                    right: '4px',
                                    background: '#ef4444',
                                    color: 'white',
                                    fontSize: '0.65rem',
                                    fontWeight: 'bold',
                                    minWidth: '16px',
                                    height: '16px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 4px',
                                    border: '2px solid white'
                                }}>
                                    {notifications.filter(n => !hiddenNotifications.includes(n.id_solicitud)).length}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <div className="notifications-dropdown" style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                width: '320px',
                                backgroundColor: 'white',
                                borderRadius: '12px',
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                                border: '1px solid #e2e8f0',
                                marginTop: '0.5rem',
                                zIndex: 1000,
                                overflow: 'hidden'
                            }}>
                                <div style={{ padding: '1rem', borderBottom: '1px solid #f1f5f9', fontWeight: 600, fontSize: '0.9rem', color: '#1e293b', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Notificaciones de hoy</span>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>{new Date().toLocaleDateString()}</span>
                                </div>
                                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                    {notifications.filter(n => !hiddenNotifications.includes(n.id_solicitud)).length === 0 ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                                            No hay notificaciones para hoy
                                        </div>
                                    ) : (
                                        notifications
                                            .filter(n => !hiddenNotifications.includes(n.id_solicitud))
                                            .map((sol, i) => (
                                                <div
                                                    key={sol.id_solicitud}
                                                    style={{
                                                        padding: '0.75rem 1rem',
                                                        borderBottom: '1px solid #f8fafc',
                                                        cursor: 'pointer',
                                                        backgroundColor: 'transparent',
                                                        transition: 'background-color 0.2s',
                                                        position: 'relative'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', paddingRight: '1.5rem' }}>
                                                        <span style={{
                                                            fontSize: '0.6rem',
                                                            fontWeight: 'bold',
                                                            background: sol.tipo_solicitud === 'ALTA' ? '#dcfce7' : sol.tipo_solicitud === 'TRASPASO' ? '#dbeafe' : '#fee2e2',
                                                            color: sol.tipo_solicitud === 'ALTA' ? '#166534' : sol.tipo_solicitud === 'TRASPASO' ? '#1e40af' : '#991b1b',
                                                            padding: '1px 5px',
                                                            borderRadius: '3px'
                                                        }}>{sol.tipo_solicitud}</span>
                                                        <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.8rem' }}>
                                                            {sol.tipo_solicitud === 'ALTA' ? (sol.datos_json?.nombre || 'Equipo') :
                                                                sol.tipo_solicitud === 'BAJA' ? (sol.datos_json?.codigo || 'Baja') :
                                                                    (sol.datos_json?.codigo || 'Traspaso')}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                        {sol.nombre_solicitante || 'Usuario'} • {new Date(sol.fecha_solicitud).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setHiddenNotifications(prev => [...prev, sol.id_solicitud]);
                                                        }}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '0.75rem',
                                                            right: '0.5rem',
                                                            background: 'none',
                                                            border: 'none',
                                                            color: '#cbd5e1',
                                                            cursor: 'pointer',
                                                            padding: '4px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            borderRadius: '4px'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.color = '#94a3b8'}
                                                        onMouseLeave={(e) => e.currentTarget.style.color = '#cbd5e1'}
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                    </button>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div
                        className="user-profile-container"
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        onBlur={() => setTimeout(() => setShowProfileMenu(false), 200)}
                        tabIndex={0}
                    >
                        <div className="user-profile">
                            <img src={profileImage} alt="Avatar" className="user-avatar" />
                            <div className="user-info">
                                <span className="user-name">{user?.name || 'Usuario'}</span>
                            </div>
                            <span className="dropdown-arrow">▼</span>
                        </div>

                        {showProfileMenu && (
                            <div className="profile-dropdown">
                                <button className="dropdown-item" onClick={handleLogout}>
                                    Cerrar sesión
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* --- Contenido Principal --- */}
            <main className="app-content">
                {children}
            </main>

        </div>
    );
};
