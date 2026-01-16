import { useState } from 'react';
import './MainLayout.css';
import logoAdl from '../../assets/images/logo-adlone.png';

// Módulos reales de ADL One definidos por el usuario
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
        { id: 'ma-1', label: 'Fichas de ingreso' }
    ]
};

interface MainLayoutProps {
    children?: React.ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
    const [activeModule, setActiveModule] = useState('gem'); // Default a GEM
    const [activeSubmodule, setActiveSubmodule] = useState('');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    // Datos simulados de usuario
    const user = {
        name: "Dr. Usuario Prueba",
        role: "Administrador",
        avatar: "https://ui-avatars.com/api/?name=Usuario+Prueba&background=1565c0&color=fff"
    };

    const handleLogout = () => {
        // Si la lógica real existiera:
        console.log("Cerrando sesión...");
        window.location.reload();
    };

    const handleModuleClick = (mod: any) => {
        if (mod.type === 'divider') return;

        setActiveModule(mod.id);

        if (SUBMODULES_MOCK[mod.id]) {
            setDrawerOpen(true);
            setActiveSubmodule('');
        } else {
            setDrawerOpen(false);
        }
    };

    const getSubmodules = () => {
        return SUBMODULES_MOCK[activeModule] || [];
    };

    return (
        <div className="app-layout">
            {/* --- Sidebar Lateral --- */}
            <aside className="app-sidebar">
                <div className="sidebar-header">
                    <img src={logoAdl} alt="ADL Logo" className="sidebar-logo" />
                </div>

                <div className="sidebar-menu">
                    {/* Título de sección opcional */}
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

            {/* --- Panel Secundario (Drawer) --- */}
            <div className={`module-drawer ${drawerOpen ? 'open' : ''}`}>
                <div className="drawer-header">
                    <div className="drawer-title">{MODULES.find(m => m.id === activeModule)?.label}</div>
                    <button className="btn-close-drawer" onClick={() => setDrawerOpen(false)}>✕</button>
                </div>
                <div className="drawer-content">
                    {getSubmodules().map((item, index) => (
                        item.category ? (
                            <div key={index} className="submodule-category">{item.category}</div>
                        ) : (
                            <div
                                key={item.id}
                                className={`submodule-item ${activeSubmodule === item.id ? 'active' : ''}`}
                                onClick={() => setActiveSubmodule(item.id)}
                            >
                                {item.label}
                            </div>
                        )
                    ))}
                </div>
            </div>

            <div className={`drawer-backdrop ${drawerOpen ? 'visible' : ''}`} onClick={() => setDrawerOpen(false)}></div>

            {/* --- Header Superior --- */}
            <header className="app-header">
                <div className="header-left">
                    {/* Titulo de Pagina Dinamico */}
                    <h2 className="page-title">{MODULES.find(m => m.id === activeModule)?.label}</h2>
                </div>

                <div className="header-right">
                    <div
                        className="user-profile-container"
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        onBlur={() => setTimeout(() => setShowProfileMenu(false), 200)} // Cierra al perder foco
                        tabIndex={0}
                    >
                        <div className="user-profile">
                            <img src={user.avatar} alt="Avatar" className="user-avatar" />
                            <div className="user-info">
                                <span className="user-name">{user.name}</span>
                            </div>
                            <span className="dropdown-arrow">▼</span>
                        </div>

                        {/* Dropdown Menu */}
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
