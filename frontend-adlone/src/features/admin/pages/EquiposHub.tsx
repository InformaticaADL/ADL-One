import React from 'react';
import { IconDeviceDesktop, IconSettings } from '@tabler/icons-react';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { HubGrid, type HubOption } from '../components/HubGrid';

interface Props {
    onNavigate: (view: string) => void;
    onBack: () => void;
}

export const EquiposHub: React.FC<Props> = ({ onNavigate, onBack }) => {
    const { hasPermission } = useAuth();

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
            description: 'Inventario de equipos ADL, bitácora de mantenimiento y configuración técnica.',
        },
    ];

    const visibleOptions = OPTIONS.filter(() => hasPermission('MA_A_GEST_EQUIPO'));

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Centro de Equipos"
                subtitle="Gestión y control centralizado del inventario tecnológico."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Medio Ambiente', onClick: onBack },
                    { label: 'Equipos' }
                ]}
            />

            <HubGrid options={visibleOptions} onNavigate={onNavigate} emptyText="No tiene permisos para acceder a las funcionalidades de este centro." />
        </div>
    );
};
