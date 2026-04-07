import { useEffect } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useNavStore } from '../store/navStore';
import { useAuth } from '../contexts/AuthContext';
import { FichasIngresoPage } from '../features/medio-ambiente/pages/FichasIngresoPage';
import { CalendarioReplicaPage } from '../features/medio-ambiente/pages/CalendarioReplicaPage';
import { FichaDetailView } from '../features/medio-ambiente/pages/FichaDetailView';
import { RemuestreoPage } from '../features/medio-ambiente/pages/RemuestreoPage';

import { RolesPage } from '../features/admin/pages/RolesPage';
import AdminUrsPage from '../features/admin/pages/AdminUrsPage';
import { AdminInfoHub } from '../features/admin/pages/AdminInfoHub';
import { InformaticaHub } from '../features/admin/pages/InformaticaHub';
import { UsersManagementPage } from '../features/admin/pages/UsersManagementPage';
import { UserRolesPage } from '../features/admin/pages/UserRolesPage';
import { AdminMaHub } from '../features/admin/pages/AdminMaHub';
import { AdminGcHub } from '../features/admin/pages/AdminGcHub';
import { MuestreadoresPage } from '../features/admin/pages/MuestreadoresPage';
import { EquiposPage } from '../features/admin/pages/EquiposPage';
import NewRequestPage from '../features/urs/pages/NewRequestPage';
import UniversalInbox from '../features/urs/components/UniversalInbox';
import { UserNotificationsPage } from '../features/notifications/pages/UserNotificationsPage';
import { ProfilePage } from '../features/auth/pages/ProfilePage';
import ChatModule from '../features/chat/ChatModule';
import { WelcomePage } from './WelcomePage';

import { NotificationsPage } from '../features/admin/pages/NotificationsPage';


const DashboardPage = () => {
    const { 
        activeModule, 
        activeSubmodule, 
        setActiveSubmodule, 
        resetNavigation
    } = useNavStore();
    const { user, hasPermission } = useAuth();

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

    // Los ayudantes de dashboard han sido removidos ya que ahora se muestra el WelcomePage por defecto.

    // Las funciones de landing dashboards específicos han sido removidas para mantener el WelcomePage como vista por defecto.

    // Renderizador de contenido dinámico
    const renderContent = () => {
        // --- 1. Submódulos Compartidos (Alta Prioridad) ---
        if (activeSubmodule === 'ma-fichas-ingreso') return <FichasIngresoPage />;
        if (activeSubmodule === 'ma-ficha-detalle') return <FichaDetailView />;
        if (activeSubmodule === 'ma-remuestreo') return <RemuestreoPage />;
        if (activeSubmodule === 'ma-calendario-replica') return <CalendarioReplicaPage onBack={() => setActiveSubmodule('medio_ambiente')} />;
        if (activeSubmodule === 'admin-equipos-gestion') return <EquiposPage onBack={() => setActiveSubmodule('')} />;
        if (activeSubmodule === 'admin-muestreadores') return <MuestreadoresPage onBack={() => setActiveSubmodule('medio_ambiente')} />;
        if (activeSubmodule === 'urs-new-request') return <NewRequestPage onBack={() => setActiveSubmodule('urs_bandeja')} />;

        // --- 2. Lógica Específica del Módulo de Administración ---
        if (activeModule === 'admin_informacion') {
            if (!hasAdminAccess()) return <div className="dashboard-content" style={{ textAlign: 'center', padding: '3rem' }}><h1>🚫 Denegado</h1></div>;

            if (activeSubmodule === 'informatica') return <InformaticaHub onNavigate={(v) => setActiveSubmodule(v)} onBack={() => setActiveSubmodule('')} />;
            if (['admin-roles', 'admin-users', 'admin-user-roles', 'admin-notifications', 'admin-urs'].includes(activeSubmodule)) {
                if (activeSubmodule === 'admin-roles') return <RolesPage onBack={() => setActiveSubmodule('informatica')} />;
                if (activeSubmodule === 'admin-users') return <UsersManagementPage onBack={() => setActiveSubmodule('informatica')} />;
                if (activeSubmodule === 'admin-user-roles') return <UserRolesPage onBack={() => setActiveSubmodule('informatica')} />;
                if (activeSubmodule === 'admin-notifications') return <NotificationsPage onBack={() => setActiveSubmodule('informatica')} />;
                if (activeSubmodule === 'admin-urs') return <AdminUrsPage onBack={() => setActiveSubmodule('informatica')} />;
            }

            if (activeSubmodule === 'medio_ambiente') return <AdminMaHub onNavigate={(v) => setActiveSubmodule(v)} onBack={() => setActiveSubmodule('')} />;
            if (activeSubmodule === 'gestion_calidad') return <AdminGcHub onNavigate={(v) => setActiveSubmodule(v)} onBack={() => setActiveSubmodule('')} />;

            // RESTAURADO: Si estamos en Admin Info pero sin submódulo específico, mostrar el Hub original con las opciones
            return <AdminInfoHub onNavigate={(id) => setActiveSubmodule(id)} />;
        }

        // --- 3. Lógica de Aterrizaje (Logo de ADL One o Fallbacks) ---
        if (!activeSubmodule) {
            // Módulos que SI tienen su propia vista de aterrizaje directa (Stand-alone)
            if (activeModule === 'solicitudes') return <UniversalInbox />;
            if (activeModule === 'notificaciones') return <UserNotificationsPage />;
            if (activeModule === 'chat') return <ChatModule />;
            if (activeModule === 'perfil') return <ProfilePage />;

            // Para todo lo demás (Medio Ambiente, Calidad, Inicio, etc.), mostrar el WelcomePage
            return <WelcomePage />;
        }

        // Fallback final
        return <AdminInfoHub onNavigate={(id) => setActiveSubmodule(id)} />;
    };

    return (
        <MainLayout>
            {renderContent()}
        </MainLayout>
    );
};

export default DashboardPage;
