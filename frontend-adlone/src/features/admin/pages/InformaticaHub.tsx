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

const COLOR_MAP: Record<string, { color: string; bg: string }> = {
    blue: { color: '#1c7ed6', bg: 'var(--app-accent-bg)' },
    teal: { color: '#0c8599', bg: 'rgba(12,133,153,0.1)' },
    orange: { color: '#e8590c', bg: 'rgba(232,89,12,0.1)' },
    cyan: { color: '#0891b2', bg: 'rgba(8,145,178,0.1)' },
    grape: { color: '#9c36b5', bg: 'rgba(156,54,181,0.1)' },
    red: { color: '#e03131', bg: 'rgba(224,49,49,0.1)' },
};

export const InformaticaHub: React.FC<Props> = ({ onNavigate, onBack }) => {
    const { hasPermission } = useAuth();

    const RAW_OPTIONS = [
        {
            id: 'admin-roles',
            label: 'Gestión de Roles',
            icon: <IconShieldCheck size={32} />,
            color: 'blue',
            description: 'Definir perfiles y permisos del sistema.',
            permission: 'INF_ROLES'
        },
        {
            id: 'admin-users',
            label: 'Gestión de Usuarios',
            icon: <IconUser size={32} />,
            color: 'teal',
            description: 'Crear, editar y administrar usuarios.',
            permission: 'INF_USUARIOS'
        },
        {
            id: 'admin-notifications',
            label: 'Notificaciones',
            icon: <IconBell size={32} />,
            color: 'orange',
            description: 'Configurar eventos y destinatarios de correo.',
            permission: 'INF_NOTIF'
        },
        {
            id: 'admin-urs',
            label: 'Administración URS',
            icon: <IconMail size={32} />,
            color: 'cyan',
            description: 'Configurar tipos de solicitud y flujos URS.',
            permission: 'INF_SOLICITUDES'
        },
        {
            id: 'admin-menu-web',
            label: 'Configuración Menú Web',
            icon: <IconLayoutSidebar size={32} />,
            color: 'grape',
            description: 'Administrar botones, íconos y permisos de accesos (CMS).',
            permission: 'INF_ACCESO'
        },
        {
            id: 'admin-maestros',
            label: 'Maestros',
            icon: <IconDatabase size={32} />,
            color: 'red',
            description: 'Gestionar tablas maestras utilizadas en crear ficha.',
            permission: 'INF_ACCESO' // Using INF_ACCESO for now or INF_MAESTROS if defined
        },
    ];

    const visibleOptions: HubOption[] = RAW_OPTIONS
        .filter(opt => hasPermission(opt.permission))
        .map(opt => ({
            id: opt.id,
            label: opt.label,
            icon: opt.icon,
            description: opt.description,
            color: COLOR_MAP[opt.color].color,
            bg: COLOR_MAP[opt.color].bg,
        }));

    return (
        <div style={{ padding: 16, width: '100%' }}>
            <PageHeader
                title="Informática"
                subtitle="Centro de control, seguridad y configuración técnica del sistema."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Administración', onClick: onBack },
                    { label: 'Informática' }
                ]}
            />

            <HubGrid options={visibleOptions} onNavigate={onNavigate} />
        </div>
    );
};
