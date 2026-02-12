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
    { id: 'admin_informacion', label: 'Admin. Información', icon: '📂', permission: 'AI_ACCESO' }, // Broad access

    // Separador
    { id: 'div2', type: 'divider', label: '', icon: '' },

    // Grupo 3: Soporte
    { id: 'ayuda', label: 'Ayuda', icon: '❓' },
];

// Simulamos Submódulos 
const SUBMODULES_MOCK: Record<string, any[]> = {
    'medio_ambiente': [
        { id: 'ma-fichas-ingreso', label: 'Fichas de ingreso', permission: 'MA_ACCESO' },
        { id: 'ma-solicitudes', label: 'Realizar Solicitudes', permission: 'AI_MA_SOLICITUDES' },
    ],
    'administracion': [], // Now empty, managed via AdminInfoHub
    // Agregamos datos para GEM para evitar menú vacío
    'gem': [
        { category: 'Gestión GEM' },
        { id: 'gem-dashboard', label: 'Dashboard General' },
        { id: 'gem-reportes', label: 'Reportes Consolidados' },
        { id: 'gem-config', label: 'Configuración' }
    ],
    'gestion_calidad': [
        { id: 'gc-equipos', label: 'Equipos', permission: 'AI_GC_ACCESO' }, // Broad access
        { id: 'gc-equipos', label: 'Equipos', permission: 'AI_GC_EQUIPOS' }, // Specific role
    ]
};

interface MainLayoutProps {
    children?: React.ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
    // Usamos el store global en lugar de useState local
    const { activeModule, activeSubmodule, drawerOpen, setActiveModule, setActiveSubmodule, setDrawerOpen, setPendingRequestId, hiddenNotifications, hideNotification } = useNavStore();

    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [selectedNotification, setSelectedNotification] = useState<any | null>(null);

    // Context User
    const { user, logout, hasPermission } = useAuth();

    // Permissions for "Gestión de Equipos" (Admins/Approvers)
    const isGCMan = hasPermission('AI_GC_ACCESO') || hasPermission('AI_GC_EQUIPOS');
    const isMAMan = hasPermission('AI_MA_EQUIPOS') || hasPermission('AI_MA_SOLICITUDES');
    const isINFMan = hasPermission('AI_INF_NOTIF');
    const isSuper = hasPermission('MA_ADMIN_ACCESO');

    const isManagementUser = isGCMan || isMAMan || isINFMan || isSuper;

    // Fetch notifications
    const fetchNotifications = async () => {
        try {
            // isAdminArea is true if in the general admin hub OR specific management areas like Quality Control

            // Permissions for "Área de Solicitudes" (Requesters/Users)

            const solicitudesData = await adminService.getSolicitudes({
                estado: undefined, // Fetch all to decide in frontend
                solo_mias: !isManagementUser // If not manager/approver, only show mine
            });

            console.log("Bell Debug - Raw Solicitudes:", solicitudesData);
            console.log("Bell Debug - Current User ID:", user?.id);
            console.log("Bell Debug - Hidden Notifications:", hiddenNotifications);

            // 1. Filter Equipment Requests
            const filteredEquipos = solicitudesData.filter((sol: any) => {
                const isPending = sol.estado === 'PENDIENTE';
                const isResult = sol.estado === 'APROBADO' || sol.estado === 'RECHAZADA' || sol.estado === 'RECHAZADO';
                const sec = sol.seccion_solicitante;
                const isMaSection = ['GEM', 'GER', 'MAM', 'MA', 'Medio Ambiente', 'AY', 'VI', 'PM', 'PA', 'CH', 'CM', 'CN', 'Terreno'].includes(sec);

                if (isPending) {
                    // 1. Global Managers (SuperAdmin or Quality Control) see everything pending
                    if (isSuper || isGCMan) return true;

                    // 2. Area Managers/Users with Receive OR Send permission see Area sections
                    if (isMAMan && isMaSection) return true;

                    // 3. ICT Managers
                    if (isINFMan && sec === 'INF') return true;

                    // 4. Default: Requesters see their own pending items
                    return String(sol.usuario_solicita) === String(user?.id);
                }

                if (isResult) {
                    const isMyOwn = String(sol.usuario_solicita) === String(user?.id);

                    if (!isMyOwn) return false;

                    // Results are only for TODAY as requested by user
                    if (!sol.fecha_revision) {
                        console.log(`Bell Debug - Solicitud ${sol.id_solicitud} excluded: No revision date`);
                        return false;
                    }

                    try {
                        const revDate = new Date(sol.fecha_revision);
                        const today = new Date();

                        const isSameDay = revDate.getDate() === today.getDate() &&
                            revDate.getMonth() === today.getMonth() &&
                            revDate.getFullYear() === today.getFullYear();

                        console.log(`Bell Debug - Result ${sol.id_solicitud}: rev=${revDate.toLocaleDateString()}, today=${today.toLocaleDateString()}, isSameDay=${isSameDay}`);

                        return isSameDay;
                    } catch (e) {
                        return false;
                    }
                }

                console.log(`Bell Debug - Solicitud ${sol.id_solicitud} excluded: state=${sol.estado}`);
                return false;
            });

            console.log("Bell Debug - Final count:", filteredEquipos.length);

            // 3. Map to common shape
            const equipmentNotifs = filteredEquipos.map((e: any) => {
                const isMyOwn = String(e.usuario_solicita) === String(user?.id);
                const isPending = e.estado === 'PENDIENTE';
                const isManagerReview = isManagementUser && isPending && !isMyOwn;

                let tag = e.tipo_solicitud;
                let tagColor = e.tipo_solicitud === 'ALTA' ? '#dcfce7' : e.tipo_solicitud === 'TRASPASO' ? '#dbeafe' : '#fee2e2';
                let tagTextColor = e.tipo_solicitud === 'ALTA' ? '#166534' : e.tipo_solicitud === 'TRASPASO' ? '#1e40af' : '#991b1b';

                if (!isManagerReview) {
                    // Requester view or Manager seeing their own result: prioritize STATUS
                    if (isPending) {
                        tag = 'PENDIENTE';
                        tagColor = '#fef3c7';
                        tagTextColor = '#92400e';
                    } else {
                        const isApproved = e.estado === 'APROBADO';
                        tag = isApproved ? 'APROBADA' : 'RECHAZADA';
                        tagColor = isApproved ? '#dcfce7' : '#fee2e2';
                        tagTextColor = isApproved ? '#166534' : '#991b1b';
                    }
                }

                let typeLabel = e.tipo_solicitud === 'ALTA' ? 'Alta' : e.tipo_solicitud === 'TRASPASO' ? 'Traspaso' : 'Baja';
                if (e.tipo_solicitud === 'ALTA' && e.datos_json?.isReactivation) {
                    typeLabel = 'Activación';
                } else if (e.tipo_solicitud === 'ALTA') {
                    typeLabel = 'Registro Nuevo';
                }

                return {
                    id: `${e.id_solicitud}-${e.estado}`, // ID único por estado para invalidar descartes previos
                    type: 'EQUIPO',
                    title: e.tipo_solicitud === 'ALTA' ? (e.datos_json?.nombre || 'Equipo') :
                        e.tipo_solicitud === 'BAJA' ? (e.datos_json?.codigo || 'Baja') :
                            (e.datos_json?.codigo || 'Traspaso'),
                    subtitle: isPending
                        ? `${typeLabel} • ${e.nombre_solicitante || 'Usuario'} • ${new Date(e.fecha_solicitud).toLocaleDateString()}`
                        : `${typeLabel} • ${e.nombre_revisor || 'Revisor'} • ${new Date(e.fecha_revision).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                    tag,
                    tagColor,
                    tagTextColor,
                    original: e
                };
            });

            const fichaNotifs: any[] = []; // Explicitly removed as per user request

            setNotifications([...equipmentNotifs, ...fichaNotifs]);
        } catch (error) {
            console.error("Error fetching global notifications:", error);
        }
    };

    const handleNotificationClick = (item: any) => {
        // 1. Initial State
        setShowNotifications(false);

        // 2. Routing and Marking as Read
        if (item.type === 'EQUIPO') {
            const sol = item.original;
            if (sol.estado === 'PENDIENTE') {
                // Actionable item: Do NOT hide notification
                if (sol.seccion_solicitante === 'INF') {
                    setActiveModule('informatica');
                } else if (['GES', 'GEM', 'GER', 'MAM', 'MA', 'Medio Ambiente', 'AY', 'VI', 'PM', 'PA', 'CH', 'CM', 'CN', 'Terreno'].includes(sol.seccion_solicitante)) {
                    // Decide redirection: Approvers (Global Quality Control or Admin) vs Requesters (MA users)
                    const isApprover = hasPermission('AI_GC_ACCESO') || hasPermission('AI_GC_EQUIPOS') || hasPermission('MA_ADMIN_ACCESO');
                    const sub = isApprover ? 'gc-equipos' : 'ma-solicitudes';

                    setActiveModule('admin_informacion');
                    setActiveSubmodule(sub);
                    setPendingRequestId(sol.id_solicitud);
                } else {
                    setActiveModule('admin_informacion');
                    setPendingRequestId(sol.id_solicitud);
                }
            } else {
                // Result item: Hide notification + Show Modal
                hideNotification(item.id);
                setSelectedNotification(sol);
            }
        }
        else if (item.type === 'FICHA') {
            // Actionable item: Do NOT hide notification
            setActiveModule('medio_ambiente');
            setActiveSubmodule('ma-fichas-ingreso');
        }
    };

    useEffect(() => {
        if (user) {
            fetchNotifications();
            const interval = setInterval(fetchNotifications, 60000); // Poll every minute
            return () => clearInterval(interval);
        }
    }, [user, activeModule]);


    // Imagen de perfil fija según requerimiento
    // Imagen de perfil fija según requerimiento
    const profileImage = logoUser;

    const handleLogout = () => {
        logout();
    };

    const canAccessModule = (module: any) => {
        if (!module.permission) return true;
        // hasPermission now internally handles Super Admin (MA_ADMIN_ACCESO) bypass
        if (hasPermission(module.permission)) return true;
        // Special case for AI: Any area access grants hub access
        if (module.id === 'admin_informacion') {
            return [
                'AI_GEM_ACCESO', 'AI_MA_ACCESO', 'AI_INF_ACCESO', 'AI_NEC_ACCESO',
                'AI_MIC_ACCESO', 'AI_BM_ACCESO', 'AI_CC_ACCESO', 'AI_BAC_ACCESO',
                'AI_SCR_ACCESO', 'AI_DER_ACCESO', 'AI_ATL_ACCESO', 'AI_ID_ACCESO',
                'AI_PVE_ACCESO', 'AI_COM_ACCESO', 'AI_GC_ACCESO', 'AI_ADM_ACCESO'
            ].some(p => hasPermission(p));
        }
        return false;
    };

    const visibleModules = MODULES.filter(m => m.type === 'divider' || canAccessModule(m));

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

                    {visibleModules.map((mod) => (
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
                                    .filter(item => {
                                        if (item.id === 'ma-solicitudes') {
                                            return hasPermission('AI_MA_SOLICITUDES') || hasPermission('AI_MA_NOTIF_ENV') || hasPermission('MA_ADMIN_ACCESO');
                                        }
                                        return !item.permission || hasPermission(item.permission);
                                    })
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
                            {notifications.filter(n => !hiddenNotifications.includes(String(n.id))).length > 0 && (
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
                                    {notifications.filter(n => !hiddenNotifications.includes(String(n.id))).length}
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
                                    <span>{notifications.some(n => n.tag === 'PENDIENTE' || !['APROBADA', 'RECHAZADA'].includes(n.tag))
                                        ? 'Solicitudes Pendientes'
                                        : 'Notificaciones de Usuario'}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>{new Date().toLocaleDateString()}</span>
                                </div>
                                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                    {notifications.filter(n => !hiddenNotifications.includes(String(n.id))).length === 0 ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                                            No hay notificaciones pendientes
                                        </div>
                                    ) : (
                                        notifications
                                            .filter(n => !hiddenNotifications.includes(String(n.id)))
                                            .map((item) => (
                                                <div
                                                    key={item.id}
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
                                                    <div
                                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', paddingRight: '1.5rem' }}
                                                        onClick={() => handleNotificationClick(item)}
                                                    >
                                                        <span style={{
                                                            fontSize: '0.6rem',
                                                            fontWeight: 'bold',
                                                            background: item.tagColor,
                                                            color: item.tagTextColor,
                                                            padding: '1px 5px',
                                                            borderRadius: '3px'
                                                        }}>{item.tag}</span>
                                                        <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.8rem' }}>
                                                            {item.title}
                                                        </span>
                                                    </div>
                                                    <div
                                                        style={{ fontSize: '0.75rem', color: '#64748b' }}
                                                        onClick={() => handleNotificationClick(item)}
                                                    >
                                                        {item.subtitle}
                                                    </div>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            hideNotification(item.id);
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
            </header >

            {/* --- Contenido Principal --- */}
            < main className="app-content" >
                {children}
            </main >

            {/* Modal de Resultado de Solicitud */}
            {
                selectedNotification && (
                    <div className="modal-overlay" style={{ zIndex: 9999 }}>
                        <div className="modal-content animate-pop-in" style={{ maxWidth: '400px', padding: '2rem', textAlign: 'center' }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '32px',
                                background: selectedNotification.estado === 'APROBADO' ? '#dcfce7' : '#fee2e2',
                                color: selectedNotification.estado === 'APROBADO' ? '#166534' : '#991b1b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.5rem',
                                fontSize: '2rem'
                            }}>
                                {selectedNotification.estado === 'APROBADO' ? '✓' : '✕'}
                            </div>

                            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#1e293b' }}>
                                Solicitud {selectedNotification.estado === 'APROBADO' ? 'Aprobada' : 'Rechazada'}
                            </h2>
                            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                                Tu solicitud de <strong>{selectedNotification.tipo_solicitud}</strong> para el equipo
                                <strong> {selectedNotification.datos_json?.codigo || selectedNotification.datos_json?.nombre}</strong> ha sido procesada.
                            </p>

                            {selectedNotification.feedback_admin && (
                                <div style={{
                                    background: '#f8fafc',
                                    padding: '1rem',
                                    borderRadius: '8px',
                                    marginBottom: '1.5rem',
                                    fontSize: '0.9rem',
                                    color: '#475569',
                                    borderLeft: '4px solid #cbd5e1',
                                    textAlign: 'left'
                                }}>
                                    <strong>Comentarios:</strong><br />
                                    {selectedNotification.feedback_admin}
                                </div>
                            )}

                            <button
                                className="btn-primary"
                                style={{ width: '100%' }}
                                onClick={() => setSelectedNotification(null)}
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
