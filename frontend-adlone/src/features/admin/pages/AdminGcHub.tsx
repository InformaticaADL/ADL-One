import React from 'react';
import { IconDeviceDesktop, IconSettings, IconChartBar, IconCalendarEvent, IconTemperature, IconArchive, IconCalendarCheck, IconPackageImport, IconPlayerPlay, IconDroplet } from '@tabler/icons-react';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { HubGrid, type HubOption } from '../components/HubGrid';

interface Props {
    onNavigate: (view: string) => void;
    onBack: () => void;
}

export const AdminGcHub: React.FC<Props> = ({ onNavigate, onBack }) => {
    const { hasPermission } = useAuth();

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
        },
        {
            id: 'gc-nuevo-equipo',
            label: 'Nuevo Equipo',
            icon: <IconPackageImport size={20} stroke={1.75} />,
            description: 'Ingreso de un equipo al inventario: tipo existente (código automático) o equipo nuevo.',
        },
        {
            id: 'gc-puesta-marcha',
            label: 'Puesta en Marcha',
            icon: <IconPlayerPlay size={20} stroke={1.75} />,
            description: 'Recepción, puesta en marcha y verificación de equipos (OI-FoGe-42), con firma de Área Técnica y Calidad.',
        },
        {
            id: 'gc-dashboard-equipos',
            label: 'Dashboard de Equipos',
            icon: <IconChartBar size={20} stroke={1.75} />,
            description: 'KPIs, gráficos y análisis del inventario de equipos de calidad.',
        },
        {
            id: 'gc-calendario-vencimientos',
            label: 'Calendario de Vencimientos',
            icon: <IconCalendarEvent size={20} stroke={1.75} />,
            description: 'Vista mensual de vencimientos de equipos con alertas por proximidad.',
        },
        {
            id: 'gc-verificacion-temperatura',
            label: 'Verificación de Temperatura',
            icon: <IconTemperature size={20} stroke={1.75} />,
            description: 'Formulario OI-FoGe-39: mediciones, firma del muestreador y PDF en el equipo.',
        },
        {
            id: 'gc-verificacion-caudal',
            label: 'Verificación Sonda Caudal',
            icon: <IconDroplet size={20} stroke={1.75} />,
            description: 'Formulario OI-FoGe-30: verificación semestral (±10 %) de sondas de caudal contra el molinete, con V°B°.',
        },
        {
            id: 'gc-archivo-fichas',
            label: 'Archivo de Fichas',
            icon: <IconArchive size={20} stroke={1.75} />,
            description: 'Fichas guardadas de los equipos (OI-FoGe-22/24/36/42) por año de vigencia, formulario y sede.',
        },
        {
            id: 'gc-revision-documental',
            label: 'Revisión documental',
            icon: <IconCalendarCheck size={20} stroke={1.75} />,
            description: 'Fechas de revisión anual que llevan los formularios de equipos.',
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

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Gestión de Calidad"
                subtitle="Gestión de inventarios, validación de equipos y control de calidad ADL."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Admin. Info', onClick: onBack },
                    { label: 'Gestión de Calidad' }
                ]}
            />

            <HubGrid options={visibleOptions} onNavigate={onNavigate} emptyText="No tiene permisos para acceder a las funcionalidades de este hub." />
        </div>
    );
};
