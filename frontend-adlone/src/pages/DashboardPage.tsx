import { useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useNavStore } from '../store/navStore';
import { useAuth } from '../contexts/AuthContext';
import { FichasIngresoPage } from '../features/medio-ambiente/pages/FichasIngresoPage';
import { TecnicaPage } from '../features/medio-ambiente/pages/TecnicaPage';
import { CoordinacionPage } from '../features/medio-ambiente/pages/CoordinacionPage';
import { SolicitudesMaPage } from '../features/medio-ambiente/pages/SolicitudesMaPage';

import { RolesPage } from '../features/admin/pages/RolesPage';
import { AdminInfoHub } from '../features/admin/pages/AdminInfoHub';
import { InformaticaHub } from '../features/admin/pages/InformaticaHub';
import { UsersManagementPage } from '../features/admin/pages/UsersManagementPage';
import { UserRolesPage } from '../features/admin/pages/UserRolesPage';
import { AdminMaHub } from '../features/admin/pages/AdminMaHub';
import { MuestreadoresPage } from '../features/admin/pages/MuestreadoresPage';
import { EquiposPage } from '../features/admin/pages/EquiposPage';
import { NotificationsPage } from '../features/admin/pages/NotificationsPage';

const DashboardPage = () => {
    const { activeModule, activeSubmodule, setActiveSubmodule, resetNavigation } = useNavStore();
    const { user, hasPermission } = useAuth();

    // Helper function to check if user has ANY admin info access
    const hasAdminAccess = () => {
        return hasPermission('MA_ADMIN_ACCESO') || hasPermission('AI_ACCESO') ||
            [
                'AI_GEM_ACCESO', 'AI_MA_ACCESO', 'AI_INF_ACCESO', 'AI_NEC_ACCESO',
                'AI_MIC_ACCESO', 'AI_BM_ACCESO', 'AI_CC_ACCESO', 'AI_BAC_ACCESO',
                'AI_SCR_ACCESO', 'AI_DER_ACCESO', 'AI_ATL_ACCESO', 'AI_ID_ACCESO',
                'AI_PVE_ACCESO', 'AI_COM_ACCESO', 'AI_GC_ACCESO', 'AI_ADM_ACCESO'
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
        if (activeSubmodule === 'ma-fichas-ingreso') {
            return <FichasIngresoPage />;
        }
        if (activeSubmodule === 'ma-tecnica') {
            return <TecnicaPage onBack={() => { }} />;
        }
        if (activeSubmodule === 'ma-coordinacion') {
            return <CoordinacionPage onBack={() => { }} />;
        }
        if (activeSubmodule === 'ma-solicitudes') {
            if (!hasPermission('AI_MA_SOLICITUDES') && !hasPermission('MA_ADMIN_ACCESO')) {
                return (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                        <h2>Acceso Restringido</h2>
                        <p>No tienes los permisos necesarios para realizar solicitudes de equipos.</p>
                    </div>
                );
            }
            return <SolicitudesMaPage onBack={() => setActiveSubmodule('')} />;
        }
        if (activeSubmodule === 'gc-equipos') {
            if (!hasPermission('AI_GC_ACCESO') && !hasPermission('AI_GC_EQUIPOS')) {
                return (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                        <h2>Acceso Restringido</h2>
                        <p>No tienes los permisos necesarios para gestionar esta sección.</p>
                    </div>
                );
            }
            return <EquiposPage onBack={() => setActiveSubmodule('')} />;
        }


        // Module: Admin información
        if (activeModule === 'admin_informacion') {
            // Permission Guard: Validate admin access before rendering
            if (!hasAdminAccess()) {
                return (
                    <div className="dashboard-content" style={{ textAlign: 'center', padding: '3rem' }}>
                        <h1 style={{ color: '#d32f2f', marginBottom: '1rem' }}>🚫 Acceso Denegado</h1>
                        <p style={{ color: '#546e7a', fontSize: '1.1rem' }}>
                            No tienes permisos para acceder a esta sección administrativa.
                        </p>
                        <p style={{ color: '#78909c', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                            Si crees que esto es un error, contacta al administrador del sistema.
                        </p>
                    </div>
                );
            }

            // Case: Informatica Area
            const informaticaViews = ['informatica', 'admin-roles', 'admin-users', 'admin-user-roles', 'admin-notifications'];
            if (informaticaViews.includes(activeSubmodule)) {
                if (!hasPermission('AI_INF_ACCESO')) {
                    return <AdminInfoHub onNavigate={(areaId) => setActiveSubmodule(areaId)} />;
                }

                if (activeSubmodule === 'informatica') {
                    return (
                        <InformaticaHub
                            onNavigate={(view) => setActiveSubmodule(view)}
                            onBack={() => setActiveSubmodule('')}
                        />
                    );
                }
                if (activeSubmodule === 'admin-roles') {
                    if (!hasPermission('AI_INF_ROLES')) return <InformaticaHub onNavigate={(view) => setActiveSubmodule(view)} onBack={() => setActiveSubmodule('')} />;
                    return <RolesPage onBack={() => setActiveSubmodule('informatica')} />;
                }
                if (activeSubmodule === 'admin-users') {
                    if (!hasPermission('AI_INF_USERS')) return <InformaticaHub onNavigate={(view) => setActiveSubmodule(view)} onBack={() => setActiveSubmodule('')} />;
                    return <UsersManagementPage onBack={() => setActiveSubmodule('informatica')} />;
                }
                if (activeSubmodule === 'admin-user-roles') {
                    if (!hasPermission('AI_INF_ROLES')) return <InformaticaHub onNavigate={(view) => setActiveSubmodule(view)} onBack={() => setActiveSubmodule('')} />;
                    return <UserRolesPage onBack={() => setActiveSubmodule('informatica')} />;
                }
                if (activeSubmodule === 'admin-notifications') {
                    if (!hasPermission('AI_INF_NOTIF')) return <InformaticaHub onNavigate={(view) => setActiveSubmodule(view)} onBack={() => setActiveSubmodule('')} />;
                    return <NotificationsPage onBack={() => setActiveSubmodule('informatica')} />;
                }
            }

            // Case: Medio Ambiente Area
            const maViews = ['medio_ambiente', 'admin-muestreadores', 'admin-equipos'];
            if (maViews.includes(activeSubmodule)) {
                if (!hasPermission('AI_MA_ACCESO')) {
                    return <AdminInfoHub onNavigate={(areaId) => setActiveSubmodule(areaId)} />;
                }

                if (activeSubmodule === 'medio_ambiente') {
                    return (
                        <AdminMaHub
                            onNavigate={(view) => setActiveSubmodule(view)}
                            onBack={() => setActiveSubmodule('')}
                        />
                    );
                }
                if (activeSubmodule === 'admin-muestreadores') {
                    if (!hasPermission('AI_MA_MUESTREADORES')) return <AdminMaHub onNavigate={(view) => setActiveSubmodule(view)} onBack={() => setActiveSubmodule('')} />;
                    return <MuestreadoresPage onBack={() => setActiveSubmodule('medio_ambiente')} />;
                }
                if (activeSubmodule === 'admin-equipos') {
                    if (!hasPermission('AI_MA_EQUIPOS')) return <AdminMaHub onNavigate={(view) => setActiveSubmodule(view)} onBack={() => setActiveSubmodule('')} />;
                    return <EquiposPage onBack={() => setActiveSubmodule('medio_ambiente')} />;
                }
            }

            // Default: Show Main Hub
            return <AdminInfoHub onNavigate={(areaId) => setActiveSubmodule(areaId)} />;
        }

        // Default Dashboard Content
        return (
            <div className="dashboard-content">
                <h1>Bienvenido a ADL One</h1>
                <p>Seleccione un módulo del menú lateral para comenzar.</p>

                <div style={{
                    marginTop: '2rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: '1.5rem'
                }}>
                    {['Solicitudes Pendientes', 'Muestras Hoy', 'Informes por Validar'].map((item) => (
                        <div key={item} style={{
                            background: 'white',
                            padding: '1.5rem',
                            borderRadius: '1rem',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                            borderTop: '4px solid #ff9800'
                        }}>
                            <h3 style={{ margin: '0 0 0.5rem 0', color: '#546e7a' }}>{item}</h3>
                            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1565c0' }}>12</span>
                        </div>
                    ))}
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
