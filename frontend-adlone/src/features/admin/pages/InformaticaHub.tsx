import React from 'react';
import {
    IconShieldCheck,
    IconUser,
    IconBell,
    IconMail,
    IconLayoutSidebar,
    IconDatabase
} from '@tabler/icons-react';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { HubGrid, type HubOption } from '../components/HubGrid';

interface Props {
    onNavigate: (view: string) => void;
    onBack: () => void;
}

export const InformaticaHub: React.FC<Props> = ({ onNavigate, onBack }) => {
    const { hasPermission } = useAuth();

    const RAW_OPTIONS = [
        {
            id: 'admin-roles',
            label: 'Gestión de Roles',
            icon: <IconShieldCheck size={19} stroke={1.75} />,
            description: 'Definir perfiles y permisos del sistema.',
            permission: 'INF_ROLES'
        },
        {
            id: 'admin-users',
            label: 'Gestión de Usuarios',
            icon: <IconUser size={19} stroke={1.75} />,
            description: 'Crear, editar y administrar usuarios.',
            permission: 'INF_USUARIOS'
        },
        {
            id: 'admin-notifications',
            label: 'Notificaciones',
            icon: <IconBell size={19} stroke={1.75} />,
            description: 'Configurar eventos y destinatarios de correo.',
            permission: 'INF_NOTIF'
        },
        {
            id: 'admin-urs',
            label: 'Administración URS',
            icon: <IconMail size={19} stroke={1.75} />,
            description: 'Configurar tipos de solicitud y flujos URS.',
            permission: 'INF_SOLICITUDES'
        },
        {
            id: 'admin-menu-web',
            label: 'Configuración Menú Web',
            icon: <IconLayoutSidebar size={19} stroke={1.75} />,
            description: 'Administrar botones, íconos y permisos de accesos (CMS).',
            permission: 'INF_ACCESO'
        },
        {
            id: 'admin-maestros',
            label: 'Maestros',
            icon: <IconDatabase size={19} stroke={1.75} />,
            description: 'Gestionar tablas maestras utilizadas en crear ficha.',
            permission: 'INF_ACCESO' // Using INF_ACCESO for now or INF_MAESTROS if defined
        },
    ];

    const visibleOptions: HubOption[] = RAW_OPTIONS.filter(opt => hasPermission(opt.permission));

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Informática"
                subtitle="Centro de control, seguridad y configuración técnica del sistema."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Admin. Info', onClick: onBack },
                    { label: 'Informática' }
                ]}
            />

            <HubGrid options={visibleOptions} onNavigate={onNavigate} />
        </div>
    );
};
