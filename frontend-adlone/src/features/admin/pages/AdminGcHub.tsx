import React from 'react';
import { IconDeviceDesktop, IconSettings, IconChartBar, IconCalendarEvent, IconTemperature, IconArchive, IconCalendarCheck, IconPackageImport, IconPlayerPlay, IconDroplet, IconMessageReport, IconGavel } from '@tabler/icons-react';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { HubGrid, type HubOption } from '../components/HubGrid';
import { esAreaCalidad } from '../utils/areasRoles';

interface Props {
    onNavigate: (view: string) => void;
    onBack: () => void;
    /** Qué subcategoría de G. Calidad mostrar: Medio Ambiente (con sus submódulos), Calidad (quejas y apelaciones) o Laboratorio (sin los suyos propios todavía). */
    seccion: 'mam' | 'cal' | 'lab';
}

// Calidad: submódulos del sistema de gestión de calidad. Sus datos viven en la base de ADLWeb
// y también se administran desde el panel de ADLWeb.
const OPCIONES_CALIDAD: HubOption[] = [
    {
        id: 'gc-quejas',
        label: 'Quejas',
        icon: <IconMessageReport size={20} stroke={1.75} />,
        description: 'Registro de quejas con su historial: evaluación, tratamiento, acciones correctivas y notificaciones (OI-FoGe-05).',
        grupo: 'Quejas y apelaciones (NCh-ISO/IEC 17025 cl. 7.9)',
    },
    {
        id: 'gc-apelaciones',
        label: 'Apelaciones',
        icon: <IconGavel size={20} stroke={1.75} />,
        description: 'Registro de apelaciones con su historial: reunión de análisis, evaluación, tratamiento y notificaciones (OI-FoGe-05).',
        grupo: 'Quejas y apelaciones (NCh-ISO/IEC 17025 cl. 7.9)',
    },
    {
        id: 'gc-qa-dashboard',
        label: 'Dashboard',
        icon: <IconChartBar size={20} stroke={1.75} />,
        description: 'Plazos por vencer y vencidos, tendencia mensual, causas, tiempos y carga por responsable. Exporta a Excel.',
        grupo: 'Quejas y apelaciones (NCh-ISO/IEC 17025 cl. 7.9)',
    },
];

export const AdminGcHub: React.FC<Props> = ({ onNavigate, onBack, seccion }) => {
    const { hasPermission, user } = useAuth();

    const GC_ACCESS = hasPermission('GC_ACCESO') || hasPermission('GC_EQUIPOS') || hasPermission('MA_A_GEST_EQUIPO');

    const OPTIONS: HubOption[] = [
        {
            id: 'admin-equipos-gestion',
            label: 'Inventario de Equipos',
            icon: (
                <div className="relative">
                    <IconDeviceDesktop size={19} stroke={1.75} />
                    <IconSettings size={11} className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background text-primary" />
                </div>
            ),
            description: 'Inventario, configuración y mantenimiento preventivo de equipos.',
            grupo: 'Equipos',
        },
        {
            id: 'gc-nuevo-equipo',
            label: 'Nuevo Equipo',
            icon: <IconPackageImport size={20} stroke={1.75} />,
            description: 'Ingreso de un equipo al inventario: tipo existente (código automático) o equipo nuevo.',
            grupo: 'Equipos',
        },
        {
            id: 'gc-dashboard-equipos',
            label: 'Dashboard',
            icon: <IconChartBar size={20} stroke={1.75} />,
            description: 'Resumen general, dashboard de equipos y estadística de temperaturas.',
            grupo: 'Equipos',
        },
        {
            id: 'gc-calendario-vencimientos',
            label: 'Calendario de Vencimientos',
            icon: <IconCalendarEvent size={20} stroke={1.75} />,
            description: 'Vista mensual de vencimientos de equipos con alertas por proximidad.',
            grupo: 'Equipos',
        },
        {
            id: 'gc-puesta-marcha',
            label: 'Puesta en Marcha',
            icon: <IconPlayerPlay size={20} stroke={1.75} />,
            description: 'Recepción, puesta en marcha y verificación de equipos (OI-FoGe-42), con firma de Área Técnica y Calidad.',
            grupo: 'Verificaciones',
        },
        {
            id: 'gc-verificacion-temperatura',
            label: 'Verificación de Temperatura',
            icon: <IconTemperature size={20} stroke={1.75} />,
            description: 'Formulario OI-FoGe-39: mediciones, firma del muestreador y PDF en el equipo.',
            grupo: 'Verificaciones',
        },
        {
            id: 'gc-verificacion-caudal',
            label: 'Verificación Sonda Caudal',
            icon: <IconDroplet size={20} stroke={1.75} />,
            description: 'Formulario OI-FoGe-30: verificación semestral (±10 %) de sondas de caudal contra el molinete, con V°B°.',
            grupo: 'Verificaciones',
        },
        {
            id: 'gc-archivo-fichas',
            label: 'Archivo de Fichas',
            icon: <IconArchive size={20} stroke={1.75} />,
            description: 'Fichas guardadas de los equipos (OI-FoGe-22/24/36/42) por año de vigencia, formulario y sede.',
            grupo: 'Documentación',
        },
        {
            id: 'gc-revision-documental',
            label: 'Revisión documental',
            icon: <IconCalendarCheck size={20} stroke={1.75} />,
            description: 'Fechas de revisión anual que llevan los formularios de equipos.',
            grupo: 'Documentación',
        },
    ];

    const visibleOptions = OPTIONS.filter(opt => {
        if (opt.id === 'gc-verificacion-temperatura') return hasPermission('GC_VERIF_TEMP');
        // Mismo permiso de lectura que las fichas en el backend (permisoFichas).
        if (opt.id === 'gc-archivo-fichas') return GC_ACCESS || hasPermission('GC_VERIF_TEMP');
        if (opt.id === 'gc-nuevo-equipo') return GC_ACCESS && hasPermission('AI_MA_CREAR_EQUIPO');
        if (opt.id === 'gc-revision-documental' || opt.id === 'gc-puesta-marcha' || opt.id === 'gc-verificacion-caudal') return GC_ACCESS;
        if (opt.id === 'admin-equipos-gestion' || opt.id === 'gc-dashboard-equipos' || opt.id === 'gc-calendario-vencimientos') {
            // RB-08: removido AI_MA_ADMIN_ACCESO
            return GC_ACCESS;
        }
        return false;
    });

    if (seccion === 'cal') {
        return (
            <div className="shadcn-scope w-full p-4 md:p-6">
                <PageHeader
                    title="Gestión de Calidad · Calidad"
                    subtitle="Sistema de gestión de calidad del laboratorio."
                    onBack={onBack}
                    breadcrumbItems={[{ label: 'Calidad' }]}
                />
                <HubGrid
                    options={esAreaCalidad(user?.roles) ? OPCIONES_CALIDAD : []}
                    onNavigate={onNavigate}
                    emptyText="Esta sección es exclusiva del área de Gestión de Calidad."
                />
            </div>
        );
    }

    if (seccion === 'lab') {
        return (
            <div className="shadcn-scope w-full p-4 md:p-6">
                <PageHeader
                    title="Gestión de Calidad · Laboratorio"
                    subtitle="Sección pendiente de definir."
                    onBack={onBack}
                    breadcrumbItems={[{ label: 'G.C. LAB' }]}
                />
                <Card className="mt-2 bg-muted/40 p-5">
                    <p className="text-center text-sm text-muted-foreground">Sección pendiente de definir.</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Gestión de Calidad · Medio Ambiente"
                subtitle="Gestión de inventarios, validación de equipos y control de calidad ADL."
                onBack={onBack}
                breadcrumbItems={[{ label: 'G.C. MAM' }]}
            />
            <HubGrid options={visibleOptions} onNavigate={onNavigate} emptyText="No tiene permisos para acceder a las funcionalidades de este hub." />
        </div>
    );
};
