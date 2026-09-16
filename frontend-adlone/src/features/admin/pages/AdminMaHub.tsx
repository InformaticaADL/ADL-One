import React from 'react';
import { IconUsers } from '@tabler/icons-react';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { HubGrid, type HubOption } from '../components/HubGrid';

interface Props {
    onNavigate: (view: string) => void;
    onBack: () => void;
}

export const AdminMaHub: React.FC<Props> = ({ onNavigate, onBack }) => {
    const { hasPermission } = useAuth();

    const OPTIONS: HubOption[] = [
        {
            id: 'admin-muestreadores',
            label: 'Muestreadores',
            icon: <IconUsers size={19} stroke={1.75} />,
            description: 'Gestión de muestreadores activos, firmas y datos de personal técnico.',
        },
    ];

    const PERMISSIONS: Record<string, string> = { 'admin-muestreadores': 'MA_MUESTREADORES' };
    const visibleOptions = OPTIONS.filter(opt => hasPermission(PERMISSIONS[opt.id]));

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Medio Ambiente"
                subtitle="Gestión de recursos, personal y equipos del área de Medio Ambiente."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Administración', onClick: onBack },
                    { label: 'Medio Ambiente' }
                ]}
            />

            <HubGrid options={visibleOptions} onNavigate={onNavigate} />
        </div>
    );
};
