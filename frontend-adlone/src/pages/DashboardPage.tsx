import { useEffect, useState } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useNavStore } from '../store/navStore';
import { useAuth } from '../contexts/AuthContext';
import { FichasIngresoPage } from '../features/medio-ambiente/pages/FichasIngresoPage';
import { SolicitudesMaPage } from '../features/medio-ambiente/pages/SolicitudesMaPage';

import { RolesPage } from '../features/admin/pages/RolesPage';
import { AdminInfoHub } from '../features/admin/pages/AdminInfoHub';
import { InformaticaHub } from '../features/admin/pages/InformaticaHub';
import { UsersManagementPage } from '../features/admin/pages/UsersManagementPage';
import { UserRolesPage } from '../features/admin/pages/UserRolesPage';
import { AdminMaHub } from '../features/admin/pages/AdminMaHub';
import { AdminGcHub } from '../features/admin/pages/AdminGcHub';
import { MuestreadoresPage } from '../features/admin/pages/MuestreadoresPage';
import { EquiposPage } from '../features/admin/pages/EquiposPage';

import { NotificationsPage } from '../features/admin/pages/NotificationsPage';
import { adminService } from '../services/admin.service';

const DashboardPage = () => {
    const { activeModule, activeSubmodule, setActiveSubmodule, resetNavigation } = useNavStore();
    const { user, hasPermission } = useAuth();

    // Dashboard Stats State
    const [stats, setStats] = useState({
        pendientes: 0,
        pendientesCalidad: 0,
        pendientesTecnica: 0,
        muestrasHoy: 0,
        informesPorValidar: 0
    });

    // Fetch Stats
    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Only fetch if on the main generic dashboard view
                if (!activeSubmodule && (!activeModule || activeModule === 'admin_informacion')) {
                    const data = await adminService.getDashboardStats();
                    if (data) setStats(data);
                }
            } catch (error) {
                console.error("Error fetching dashboard stats:", error);
            }
        };
        fetchStats();
    }, [activeModule, activeSubmodule]);

    // Helper function to check if user has ANY admin info access
    const hasAdminAccess = () => {
        return hasPermission('AI_MA_ADMIN_ACCESO') || hasPermission('AI_ACCESO') ||
            [
                'GEM_ACCESO', 'MA_ACCESO', 'INF_ACCESO', 'NEC_ACCESO',
                'MIC_ACCESO', 'BM_ACCESO', 'CC_ACCESO', 'BAC_ACCESO',
                'SCR_ACCESO', 'DER_ACCESO', 'ATL_ACCESO', 'ID_ACCESO',
                'PVE_ACCESO', 'COM_ACCESO', 'GC_ACCESO', 'ADM_ACCESO',
                'MA_ACCESO', 'MA_A_REPORTES'
            ].some(p => hasPermission(p));
    };

    // Security Guard: Reset navigation if user doesn't have admin role for admin module
    useEffect(() => {
        if (activeModule === 'admin_informacion' && !hasAdminAccess()) {
            console.warn('Unauthorized access attempt to admin module. Resetting navigation.');
            resetNavigation();
        }
    }, [activeModule, user, resetNavigation]);

    // Renderizador de contenido dinámico
    const renderContent = () => {
        // --- Shared Submodules (Accessible from any module sidebar) ---

        if (activeSubmodule === 'ma-fichas-ingreso') {
            return <FichasIngresoPage />;
        }

        if (activeSubmodule === 'ma-solicitudes') {
            if (!hasPermission('AI_MA_SOLICITUDES') && !hasPermission('AI_MA_ADMIN_ACCESO')) {
                return (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                        <h2>Acceso Restringido</h2>
                        <p>No tienes los permisos necesarios para realizar solicitudes de equipos.</p>
                    </div>
                );
            }
            return <SolicitudesMaPage onBack={() => setActiveSubmodule('medio_ambiente')} />;
        }

        if (activeSubmodule === 'admin-equipos-gestion') {
            if (!hasPermission('MA_A_GEST_EQUIPO') && !hasPermission('GC_EQUIPOS') && !hasPermission('GC_ACCESO')) {
                return (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                        <h2>Acceso Restringido</h2>
                        <p>No tienes los permisos necesarios para gestionar esta sección.</p>
                    </div>
                );
            }
            return <EquiposPage onBack={() => setActiveSubmodule((activeModule as string) === 'gestion_calidad' ? 'gestion_calidad' : 'medio_ambiente')} />;
        }

        if (activeSubmodule === 'admin-muestreadores') {
            if (!hasPermission('MA_MUESTREADORES')) {
                return (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                        <h2>Acceso Restringido</h2>
                        <p>No tienes los permisos necesarios para gestionar muestreadores.</p>
                    </div>
                );
            }
            return <MuestreadoresPage onBack={() => setActiveSubmodule('medio_ambiente')} />;
        }

        if (activeSubmodule === 'ma-reportes-view') {
            // Reportes view (Read Only / Vouchers)
            if (!hasPermission('MA_A_REPORTES') && !hasPermission('MA_A_GEST_EQUIPO') && !hasPermission('GC_EQUIPOS') && !hasPermission('GC_ACCESO')) {
                return (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                        <h2>Acceso Restringido</h2>
                        <p>No tienes los permisos necesarios para visualizar reportes.</p>
                    </div>
                );
            }
            return <SolicitudesMaPage
                onBack={() => setActiveSubmodule((activeModule as string) === 'gestion_calidad' ? 'gestion_calidad' : 'medio_ambiente')}
                viewOnly={true}
            />;
        }

        // --- Module: Admin Información (Hub & Specialist areas) ---
        if (activeModule === 'admin_informacion') {
            if (!hasAdminAccess()) {
                return (
                    <div className="dashboard-content" style={{ textAlign: 'center', padding: '3rem' }}>
                        <h1 style={{ color: '#d32f2f', marginBottom: '1rem' }}>🚫 Acceso Denegado</h1>
                        <p style={{ color: '#546e7a', fontSize: '1.1rem' }}>No tienes permisos para acceder a esta sección administrativa.</p>
                    </div>
                );
            }

            // Area: Informatica
            const informaticaViews = ['informatica', 'admin-roles', 'admin-users', 'admin-user-roles', 'admin-notifications'];
            if (informaticaViews.includes(activeSubmodule)) {
                if (!hasPermission('INF_ACCESO')) return <AdminInfoHub onNavigate={(id) => setActiveSubmodule(id)} />;

                if (activeSubmodule === 'informatica') return <InformaticaHub onNavigate={(v) => setActiveSubmodule(v)} onBack={() => setActiveSubmodule('')} />;
                if (activeSubmodule === 'admin-roles') return <RolesPage onBack={() => setActiveSubmodule('informatica')} />;
                if (activeSubmodule === 'admin-users') return <UsersManagementPage onBack={() => setActiveSubmodule('informatica')} />;
                if (activeSubmodule === 'admin-user-roles') return <UserRolesPage onBack={() => setActiveSubmodule('informatica')} />;
                if (activeSubmodule === 'admin-notifications') return <NotificationsPage onBack={() => setActiveSubmodule('informatica')} />;
            }

            // Area: Medio Ambiente Hub
            if (activeSubmodule === 'medio_ambiente') {
                const hasMaAccess = hasPermission('MA_ACCESO') || hasPermission('AI_MA_ADMIN_ACCESO');
                if (!hasMaAccess) return <AdminInfoHub onNavigate={(id) => setActiveSubmodule(id)} />;
                return <AdminMaHub onNavigate={(v) => setActiveSubmodule(v)} onBack={() => setActiveSubmodule('')} />;
            }

            // Area: Gestión de Calidad Hub
            if (activeSubmodule === 'gestion_calidad') {
                const hasGcAccess = hasPermission('GC_ACCESO') || hasPermission('AI_MA_ADMIN_ACCESO');
                if (!hasGcAccess) return <AdminInfoHub onNavigate={(id) => setActiveSubmodule(id)} />;
                return <AdminGcHub onNavigate={(v) => setActiveSubmodule(v)} onBack={() => setActiveSubmodule('')} />;
            }

            // Default Admin Home
            return <AdminInfoHub onNavigate={(id) => setActiveSubmodule(id)} />;
        }

        // --- Default Dashboard (Stats) ---
        return (
            <div className="dashboard-content" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
                {/* Hero Section */}
                <div style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                    borderRadius: '16px',
                    padding: '3rem 2.5rem',
                    marginBottom: '2.5rem',
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
                }}>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <h1 style={{
                            fontSize: '2.5rem',
                            fontWeight: 800,
                            marginBottom: '0.75rem',
                            letterSpacing: '-0.025em'
                        }}>
                            Bienvenido a <span style={{ color: '#38bdf8' }}>ADL One</span>
                        </h1>
                        <p style={{
                            fontSize: '1.2rem',
                            color: '#94a3b8',
                            maxWidth: '600px',
                            lineHeight: '1.6'
                        }}>
                            Gestione sus operaciones, monitoree el estado de sus equipos y valide la información crítica desde un solo panel centralizado.
                        </p>
                    </div>
                    {/* Decorative element */}
                    <div style={{
                        position: 'absolute',
                        top: '-20%',
                        right: '-10%',
                        width: '400px',
                        height: '400px',
                        background: 'radial-gradient(circle, rgba(56, 189, 248, 0.1) 0%, transparent 70%)',
                        zIndex: 0
                    }} />
                </div>

                {/* Stats Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: '2rem'
                }}>
                    {/* Stat Card: Solicitudes */}
                    <div className="stat-card-modern" style={{
                        background: 'white',
                        borderRadius: '16px',
                        padding: '1.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.5rem',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                        border: '1px solid #f1f5f9',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        cursor: 'default'
                    }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
                        }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '12px',
                            background: '#eff6ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#2563eb'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                                Solicitudes Pendientes
                            </h3>
                            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b' }}>
                                {hasPermission('AI_MA_ADMIN_ACCESO') ? stats.pendientes :
                                    (hasPermission('GC_ACCESO') || hasPermission('GC_EQUIPOS')) ? stats.pendientesCalidad :
                                        (hasPermission('MA_A_GEST_EQUIPO') || hasPermission('AI_MA_SOLICITUDES')) ? stats.pendientesTecnica :
                                            stats.pendientes}
                            </span>
                        </div>
                    </div>

                    {/* Stat Card: Muestras */}
                    <div className="stat-card-modern" style={{
                        background: 'white',
                        borderRadius: '16px',
                        padding: '1.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.5rem',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                        border: '1px solid #f1f5f9',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        cursor: 'default'
                    }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
                        }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '12px',
                            background: '#f0fdf4',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#16a34a'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                <line x1="12" y1="22.08" x2="12" y2="12"></line>
                            </svg>
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                                Muestras Hoy
                            </h3>
                            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b' }}>
                                {stats.muestrasHoy}
                            </span>
                        </div>
                    </div>

                    {/* Stat Card: Informes */}
                    <div className="stat-card-modern" style={{
                        background: 'white',
                        borderRadius: '16px',
                        padding: '1.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.5rem',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                        border: '1px solid #f1f5f9',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        cursor: 'default'
                    }}
                        onMouseEnter={e => {
                            e.currentTarget.style.transform = 'translateY(-4px)';
                            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
                        }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '12px',
                            background: '#fef2f2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#dc2626'
                        }}>
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                            </svg>
                        </div>
                        <div>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                                Informes por Validar
                            </h3>
                            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b' }}>
                                {stats.informesPorValidar}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <MainLayout>
            {renderContent()}
        </MainLayout>
    );
};

export default DashboardPage;
