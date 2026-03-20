import { useEffect, useState } from 'react';
import { MainLayout } from '../components/layout/MainLayout';
import { useNavStore } from '../store/navStore';
import { useAuth } from '../contexts/AuthContext';
import { FichasIngresoPage } from '../features/medio-ambiente/pages/FichasIngresoPage';
import { CalendarioReplicaPage } from '../features/medio-ambiente/pages/CalendarioReplicaPage';

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

import { NotificationsPage } from '../features/admin/pages/NotificationsPage';
import { adminService } from '../services/admin.service';
import {
    ResponsiveContainer,
    PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    AreaChart, Area
} from 'recharts';

const DashboardPage = () => {
    const { activeModule, activeSubmodule, previousSubmodule, setActiveSubmodule, resetNavigation } = useNavStore();
    const { user, hasPermission } = useAuth();

    // Dashboard Stats State
    const [stats, setStats] = useState({
        pendientes: 0,
        pendientesCalidad: 0,
        pendientesTecnica: 0,
        muestrasHoy: 0,
        informesPorRealizar: 0,
        informesRealizados: 0,
        equiposActivos: 0,
        equiposInactivos: 0,
        fichasPendientes: 0,
        fichasEnProceso: 0,
        totalFichas: 0,
        muestreosPendientes: 0,
        muestreosRetiro: 0,
        totalMuestreos: 0,
        aprobadasMes: 0,
        rechazadasMes: 0,
        equiposVencidos: 0,
        totalUsuarios: 0,
        charts: {
            solicitudesPorTipo: [] as any[],
            evolucionSolicitudes: [] as any[],
            equiposPorTipo: [] as any[],
            actividadMuestreo: [] as any[]
        }
    });

    // Fetch Stats
    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Only fetch if on a landing page (no submodule active)
                if (!activeSubmodule) {
                    const response = await adminService.getDashboardStats();
                    if (response?.success && response?.data) {
                        setStats(response.data);
                    }
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

    // --- DASHBOARD HELPERS ---
    const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#6366f1', '#f43f5e', '#8b5cf6', '#ec4899'];

    const ChartGradients = () => (
        <svg style={{ height: 0, width: 0, position: 'absolute' }}>
            <defs>
                <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorWarning" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="colorInfo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
            </defs>
        </svg>
    );

    const renderStatCard = (title: string, value: string | number, icon: any, color: string, bgColor: string) => (
        <div className="stat-card-modern" style={{
            background: 'white',
            borderRadius: '16px',
            padding: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            border: '1px solid #f1f5f9',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: 'default'
        }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
            }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color }}>
                {icon}
            </div>
            <div>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.25rem', letterSpacing: '0.05em' }}>{title}</h3>
                <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b' }}>{value}</span>
            </div>
        </div>
    );

    const formatChartLabel = (label: string) => {
        if (!label) return '';
        return label.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    };

    const groupSmallItems = (data: any[], threshold = 0.03) => {
        if (!data || data.length <= 8) return data;
        const total = data.reduce((acc, item) => acc + item.value, 0);
        const largeItems = data.filter(item => (item.value / total) >= threshold);
        const smallItems = data.filter(item => (item.value / total) < threshold);

        if (smallItems.length > 0) {
            largeItems.push({
                name: 'Otros',
                value: smallItems.reduce((acc, item) => acc + item.value, 0)
            });
        }
        return largeItems.sort((a, b) => b.value - a.value);
    };

    const DashboardHero = ({ title, subtitle }: { title: string, subtitle: string }) => (
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
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '0.75rem', letterSpacing: '-0.025em' }}>
                    {title}
                </h1>
                <p style={{ fontSize: '1.2rem', color: '#94a3b8', maxWidth: '100%', lineHeight: '1.6' }}>
                    {subtitle}
                </p>
            </div>
            <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(56, 189, 248, 0.1) 0%, transparent 70%)', zIndex: 0 }} />
        </div>
    );

    const renderQualityDashboard = () => (
        <div className="dashboard-content" style={{ padding: '2rem', maxWidth: '100%', margin: '0', backgroundColor: '#f8fafc', minHeight: '100%' }}>
            <div style={{ maxWidth: '100%', margin: '0' }}>
                <ChartGradients />
                <DashboardHero
                    title="Gestión de Calidad"
                    subtitle="Monitoreo de equipos, validaciones técnicas y cumplimiento de estándares de calidad."
                />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                    {renderStatCard("Pendientes Calidad", stats.pendientesCalidad, <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>, "#f59e0b", "#fffbeb")}
                    {renderStatCard("Aprobadas (Mes)", stats.aprobadasMes, <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>, "#10b981", "#ecfdf5")}
                    {renderStatCard("Rechazadas (Mes)", stats.rechazadasMes, <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>, "#ef4444", "#fef2f2")}
                    {renderStatCard("Equipos Activos", stats.equiposActivos, <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>, "#0284c7", "#f0f9ff")}
                    {renderStatCard("Equipos Vencidos", stats.equiposVencidos, <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>, "#dc2626", "#fff1f2")}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem', marginTop: '2.5rem' }}>
                    <div style={{ background: 'white', borderRadius: '20px', padding: '2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ width: '4px', height: '24px', background: '#0ea5e9', borderRadius: '2px' }} />
                            Equipos por Tipo
                        </h3>
                        <div style={{ width: '100%', height: '350px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={groupSmallItems(stats?.charts?.equiposPorTipo || [])}
                                        cx="40%" cy="50%"
                                        innerRadius={80} outerRadius={120}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {groupSmallItems(stats?.charts?.equiposPorTipo || []).map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend
                                        layout="vertical"
                                        align="right"
                                        verticalAlign="middle"
                                        iconType="circle"
                                        wrapperStyle={{ paddingLeft: '20px', fontSize: '0.85rem' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div style={{ background: 'white', borderRadius: '20px', padding: '2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ width: '4px', height: '24px', background: '#f59e0b', borderRadius: '2px' }} />
                            Solicitudes por Tipo
                        </h3>
                        <div style={{ width: '100%', height: '350px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats?.charts?.solicitudesPorTipo || []} layout="vertical" margin={{ left: 20, right: 30 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        width={160}
                                        tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
                                        tickFormatter={formatChartLabel}
                                    />
                                    <RechartsTooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="value" fill="url(#colorWarning)" radius={[0, 6, 6, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderEnvironmentDashboard = () => (
        <div className="dashboard-content" style={{ padding: '2rem', maxWidth: '100%', margin: '0', backgroundColor: '#f8fafc', minHeight: '100%' }}>
            <div style={{ maxWidth: '100%', margin: '0' }}>
                <ChartGradients />
                <DashboardHero
                    title="Operaciones Medio Ambiente"
                    subtitle="Seguimiento de muestreos en terreno, fichas de ingreso y gestión de informes operativos."
                />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {renderStatCard("Muestras Hoy", stats.muestrasHoy, <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>, "#059669", "#ecfdf5")}
                    {renderStatCard("Fichas Pendientes", stats.fichasPendientes, <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>, "#ea580c", "#fff7ed")}
                    {renderStatCard("Muestreos Pend.", stats.muestreosPendientes, <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>, "#c026d3", "#fdf4ff")}
                    {renderStatCard("Informes Pend.", stats.informesPorRealizar, <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><path d="M7 10h10M7 14h10M7 18h6"></path></svg>, "#dc2626", "#fef2f2")}
                </div>

                <div style={{ marginTop: '2.5rem', background: 'white', borderRadius: '20px', padding: '2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ width: '4px', height: '24px', background: '#10b981', borderRadius: '2px' }} />
                        Actividad de Muestreo (Anual)
                    </h3>
                    <div style={{ width: '100%', height: '400px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats?.charts?.actividadMuestreo || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                    tickFormatter={(val) => ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][val - 1]}
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <RechartsTooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="value" fill="url(#colorSuccess)" radius={[6, 6, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderITDashboard = () => (
        <div className="dashboard-content" style={{ padding: '2rem', maxWidth: '100%', margin: '0', backgroundColor: '#f8fafc', minHeight: '100%' }}>
            <div style={{ maxWidth: '100%', margin: '0' }}>
                <ChartGradients />
                <DashboardHero
                    title="Administración de Sistemas"
                    subtitle="Control de usuarios, seguridad, roles y métricas globales de la plataforma ADL One."
                />

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {renderStatCard("Usuarios Activos", stats.totalUsuarios, <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>, "#6366f1", "#eef2ff")}
                    {renderStatCard("Solicitudes Totales", stats.pendientes, <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="12" y1="17" x2="12" y2="21"></line></svg>, "#2563eb", "#eff6ff")}
                    {renderStatCard("Equipos Globales", stats.equiposActivos + stats.equiposInactivos, <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path></svg>, "#0284c7", "#f0f9ff")}
                </div>

                <div style={{ marginTop: '2.5rem', background: 'white', borderRadius: '20px', padding: '2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ width: '4px', height: '24px', background: '#6366f1', borderRadius: '2px' }} />
                        Uso de Plataforma (Solicitudes)
                    </h3>
                    <div style={{ width: '100%', height: '400px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats?.charts?.evolucionSolicitudes || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                    tickFormatter={(val) => new Date(val).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                <RechartsTooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                />
                                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorInfo)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderGenericDashboard = () => (
        <div className="dashboard-content" style={{ padding: '2rem', maxWidth: '100%', margin: '0', backgroundColor: '#f8fafc', minHeight: '100%' }}>
            <div style={{ maxWidth: '100%', margin: '0' }}>
                <DashboardHero
                    title={`Bienvenido a ADL One`}
                    subtitle="Gestione sus operaciones y monitoree el estado de sus equipos desde un solo panel centralizado."
                />
                {/* ... keeping the original structure for fallback ... */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    {renderStatCard("Fichas Pendientes", stats.fichasPendientes, <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path></svg>, "#ea580c", "#fff7ed")}
                    {renderStatCard("Muestreos Pend.", stats.muestreosPendientes, <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>, "#c026d3", "#fdf4ff")}
                    {renderStatCard("Solicitudes Equipos", stats.pendientes, <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect></svg>, "#2563eb", "#eff6ff")}
                    {renderStatCard("Muestras Hoy", stats.muestrasHoy, <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>, "#059669", "#ecfdf5")}
                </div>
            </div>
        </div>
    );

    // Renderizador de contenido dinámico
    const renderContent = () => {
        // --- 1. Submódulos Compartidos (Alta Prioridad) ---
        if (activeSubmodule === 'ma-fichas-ingreso') return <FichasIngresoPage />;
        if (activeSubmodule === 'ma-calendario-replica') return <CalendarioReplicaPage onBack={() => setActiveSubmodule('medio_ambiente')} />;
        if (activeSubmodule === 'admin-equipos-gestion') return <EquiposPage onBack={() => setActiveSubmodule(previousSubmodule || ((activeModule as string) === 'gestion_calidad' ? 'gestion_calidad' : 'medio_ambiente'))} />;
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
            // CASO A: Se presionó el logo de ADL One (!activeModule) o se acaba de entrar a la app
            if (!activeModule) {
                // Queremos que apenas entre, vea su dashboard principal según permisos
                if (hasPermission('GC_ACCESO')) return renderQualityDashboard();
                if (hasPermission('MA_ACCESO')) return renderEnvironmentDashboard();
                if (hasAdminAccess()) return renderITDashboard();
                return renderGenericDashboard();
            }

            if (activeModule === 'solicitudes') {
                return <UniversalInbox />;
            }

            if (activeModule === 'notificaciones') {
                return <UserNotificationsPage />;
            }

            // CASO B: Se presionó una Unidad (ej. GEM, Necropsia) pero no hay submódulo
            if (activeModule === 'gestion_calidad') return renderQualityDashboard();
            if (activeModule === 'medio_ambiente') return renderEnvironmentDashboard();
            if (activeModule === 'admin_informacion' && hasAdminAccess()) return renderITDashboard();

            // Fallback genérico para otras unidades
            return renderGenericDashboard();
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
