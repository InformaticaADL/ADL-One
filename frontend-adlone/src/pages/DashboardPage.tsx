import { useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useNavStore } from '../store/navStore';
import { useAuth } from '../contexts/AuthContext';
import { FichasIngresoPage } from '../features/medio-ambiente/pages/FichasIngresoPage';
import { TecnicaPage } from '../features/medio-ambiente/pages/TecnicaPage';
import { CoordinacionPage } from '../features/medio-ambiente/pages/CoordinacionPage';

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

    // Helper function to check if user is admin
    const isAdmin = () => {
        // Check for MA_ADMIN_ACCESO permission (the actual permission code in the database)
        return hasPermission('MA_ADMIN_ACCESO');
    };

    // Security Guard: Reset navigation if user doesn't have admin role for admin module
    useEffect(() => {
        if (activeModule === 'admin_informacion' && !isAdmin()) {
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


        // Module: Admin información
        if (activeModule === 'admin_informacion') {
            // Permission Guard: Validate admin role before rendering
            if (!isAdmin()) {
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

            if (activeSubmodule === 'informatica') {
                return (
                    <InformaticaHub
                        onNavigate={(view) => setActiveSubmodule(view)}
                        onBack={() => setActiveSubmodule('')}
                    />
                );
            }
            if (activeSubmodule === 'admin-roles') {
                return <RolesPage onBack={() => setActiveSubmodule('informatica')} />;
            }
            if (activeSubmodule === 'admin-users') {
                return <UsersManagementPage onBack={() => setActiveSubmodule('informatica')} />;
            }
            if (activeSubmodule === 'admin-user-roles') {
                return <UserRolesPage onBack={() => setActiveSubmodule('informatica')} />;
            }
            if (activeSubmodule === 'admin-notifications') {
                return <NotificationsPage onBack={() => setActiveSubmodule('informatica')} />;
            }

            // Module: Admin MA
            if (activeSubmodule === 'medio_ambiente') {
                return (
                    <AdminMaHub
                        onNavigate={(view) => setActiveSubmodule(view)}
                        onBack={() => setActiveSubmodule('')}
                    />
                );
            }
            if (activeSubmodule === 'admin-muestreadores') {
                return <MuestreadoresPage onBack={() => setActiveSubmodule('medio_ambiente')} />;
            }
            if (activeSubmodule === 'admin-equipos') {
                return <EquiposPage onBack={() => setActiveSubmodule('medio_ambiente')} />;
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
