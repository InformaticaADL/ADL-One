import { useState } from 'react';
import { useNavStore } from '../../store/navStore';
import { useAuth } from '../../contexts/AuthContext';
import './MainLayout.css';
import logoAdl from '../../assets/images/logo-adlone.png';

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
    { id: 'medio_ambiente', label: 'Medio Ambiente', icon: '🌿' },
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
    { id: 'admin_informacion', label: 'Admin. Información', icon: '📂' },

    // Separador
    { id: 'div2', type: 'divider', label: '', icon: '' },

    // Grupo 3: Soporte
    { id: 'ayuda', label: 'Ayuda', icon: '❓' },
];

// Simulamos Submódulos 
const SUBMODULES_MOCK: Record<string, any[]> = {
    'medio_ambiente': [
        { id: 'ma-fichas-ingreso', label: 'Fichas de ingreso' },
        { id: 'ma-tecnica', label: 'Gestión Técnica' },
        { id: 'ma-coordinacion', label: 'Coordinación' }
    ],
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
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);



    // Context User
    const { user, logout } = useAuth();

    // Imagen de perfil fija según requerimiento
    const profileImage = "https://ui-avatars.com/api/?name=Usuario&background=1565c0&color=fff"; // Placeholder si no hay local
    // O si tenemos una imagen local importada: import userPlaceholder from '../../assets/images/user-placeholder.png'; 
    // Por ahora uso la URL generada o un placeholder simple.

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
            // En móvil, si abrimos drawer, podemos cerrar el sidebar para dar foco al drawer,
            // o mantenerlo. Si el drawer cubre todo, da igual. Cerremos el sidebar por limpieza.
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
        // El store tiene logica para cerrar drawer si se desea, o lo hacemos aqui explicito
        // Segun requerimiento: "al seleccionar, cerrar drawer".
        // En useNavStore puse: setActiveSubmodule: (submoduleId) => set({ activeSubmodule: submoduleId, drawerOpen: false }),
        // Así que solo llamar a setActiveSubmodule cierra el drawer y fija el id.
    };

    return (
        <div className="app-layout">
            {/* --- Sidebar Lateral --- */}
            <aside className={`app-sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`}>
                <div className="sidebar-header">
                    <img src={logoAdl} alt="ADL Logo" className="sidebar-logo" />
                    {/* Botón cerrar sidebar en móvil (opcional pero útil) */}
                    <button
                        className="btn-close-sidebar-mobile"
                        onClick={() => setMobileSidebarOpen(false)}
                        style={{ display: 'none' }} // Se mostrará por CSS en móvil
                    >✕</button>
                </div>

                <div className="sidebar-menu">
                    <div style={{ padding: '0 0.8rem 0.5rem', fontSize: '0.7rem', fontWeight: 'bold', color: '#a1a1aa', letterSpacing: '0.5px' }}>UNIDADES</div>

                    {MODULES.map((mod) => (
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
            {/* Backdrop para Sidebar Móvil */}
            <div
                className={`sidebar-backdrop ${mobileSidebarOpen ? 'visible' : ''}`}
                onClick={() => setMobileSidebarOpen(false)}
            ></div>

            {/* --- RENDERIZADO CONDICIONAL DEL DRAWER (Fix Definitivo Visual) --- */}
            {drawerOpen && (
                <>
                    {/* Drawer (Siempre 'open' porque solo existe si es true) */}
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
                                    flexShrink: 0, /* Prevent shrinking */
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
                                getSubmodules().map((item, index) => (
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

                    {/* Backdrop */}
                    <div className="drawer-backdrop visible" onClick={() => setDrawerOpen(false)}></div>
                </>
            )}

            {/* --- Header Superior --- */}
            <header className="app-header">
                <div className="header-left">
                    {/* Hamburger Menu Button for Mobile */}
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
