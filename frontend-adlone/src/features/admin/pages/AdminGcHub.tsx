import React from 'react';
import { IconDeviceDesktop, IconSettings, IconChartBar, IconCalendarEvent } from '@tabler/icons-react';
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
            label: 'Gestión de Equipos',
            icon: (
                <div className="relative">
                    <IconDeviceDesktop size={19} stroke={1.75} />
                    <IconSettings size={11} className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background text-primary" />
                </div>
            ),
            description: 'Inventario, configuración y mantenimiento preventivo de equipos.',
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
    ];

    const visibleOptions = OPTIONS.filter(opt => {
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
