import React from 'react';
import { 
    SimpleGrid, 
    Card, 
    Text, 
    ThemeIcon, 
    rem, 
    UnstyledButton,
    Box
} from '@mantine/core';
import { 
    IconShieldCheck, 
    IconUser, 
    IconUsers, 
    IconBell, 
    IconMail,
} from '@tabler/icons-react';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';

interface Props {
    onNavigate: (view: string) => void;
    onBack: () => void;
}

export const InformaticaHub: React.FC<Props> = ({ onNavigate, onBack }) => {
    const { hasPermission } = useAuth();

    const OPTIONS = [
        { 
            id: 'admin-roles', 
            label: 'Gestión de Roles', 
            icon: <IconShieldCheck style={{ width: rem(32), height: rem(32) }} />, 
            color: 'blue',
            description: 'Definir perfiles y permisos del sistema.', 
            permission: 'INF_ROLES' 
        },
        { 
            id: 'admin-users', 
            label: 'Gestión de Usuarios', 
            icon: <IconUser style={{ width: rem(32), height: rem(32) }} />, 
            color: 'teal',
            description: 'Crear, editar y administrar usuarios.', 
            permission: 'INF_USUARIOS' 
        },
        { 
            id: 'admin-user-roles', 
            label: 'Asignación de Roles', 
            icon: <IconUsers style={{ width: rem(32), height: rem(32) }} />, 
            color: 'indigo',
            description: 'Asignar roles a los usuarios.', 
            permission: 'INF_ROLES' 
        },
        { 
            id: 'admin-notifications', 
            label: 'Notificaciones', 
            icon: <IconBell style={{ width: rem(32), height: rem(32) }} />, 
            color: 'orange',
            description: 'Configurar eventos y destinatarios de correo.', 
            permission: 'INF_NOTIF' 
        },
        { 
            id: 'admin-urs', 
            label: 'Administración URS', 
            icon: <IconMail style={{ width: rem(32), height: rem(32) }} />, 
            color: 'cyan',
            description: 'Configurar tipos de solicitud y flujos URS.', 
            permission: 'INF_SOLICITUDES' 
        },
    ];

    const visibleOptions = OPTIONS.filter(opt => hasPermission(opt.permission));

    return (
        <Box p="md" style={{ width: '100%' }}>
            <PageHeader 
                title="Informática" 
                subtitle="Centro de control, seguridad y configuración técnica del sistema."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Administración', onClick: onBack },
                    { label: 'Informática' }
                ]}
            />

            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg" mt="xl">
                {visibleOptions.map((opt) => (
                    <UnstyledButton 
                        key={opt.id} 
                        onClick={() => onNavigate(opt.id)}
                    >
                        <Card 
                            shadow="sm" 
                            padding="xl" 
                            radius="md" 
                            withBorder
                            style={{
                                height: '100%',
                                transition: 'all 0.2s ease',
                                cursor: 'pointer',
                                '&:hover': {
                                    transform: 'translateY(-5px)',
                                    boxShadow: 'var(--mantine-shadow-md)',
                                    borderColor: `var(--mantine-color-${opt.color}-light-color)`
                                }
                            }}
                        >
                            <ThemeIcon 
                                size={60} 
                                radius="md" 
                                variant="light" 
                                color={opt.color}
                                mb="md"
                            >
                                {opt.icon}
                            </ThemeIcon>

                            <Text fw={700} size="lg" mb={4}>
                                {opt.label}
                            </Text>

                            <Text size="sm" c="dimmed" lh={1.5}>
                                {opt.description}
                            </Text>
                        </Card>
                    </UnstyledButton>
                ))}
            </SimpleGrid>
        </Box>
    );
};
