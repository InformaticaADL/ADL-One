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
                <div style={{ position: 'relative' }}>
                    <IconDeviceDesktop size={32} />
                    <IconSettings
                        size={16}
                        style={{
                            position: 'absolute',
                            bottom: -4,
                            right: -4,
                            backgroundColor: 'white',
                            borderRadius: '50%'
                        }}
                    />
                </div>
            ),
            color: '#1c7ed6',
            bg: 'var(--app-accent-bg)',
            description: 'Inventario de equipos ADL, bitácora de mantenimiento y configuración técnica.',
        },
    ];

    const visibleOptions = OPTIONS.filter(() => hasPermission('MA_A_GEST_EQUIPO'));

    return (
        <div style={{ padding: 16, width: '100%' }}>
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
