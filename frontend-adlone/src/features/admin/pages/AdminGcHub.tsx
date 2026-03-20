import React from 'react';
import { 
    SimpleGrid, 
    Card, 
    Text, 
    ThemeIcon, 
    rem, 
    UnstyledButton,
    Container,
    Box
} from '@mantine/core';
import { 
    IconDeviceDesktop,
    IconSettings,
} from '@tabler/icons-react';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';

interface Props {
    onNavigate: (view: string) => void;
    onBack: () => void;
}

export const AdminGcHub: React.FC<Props> = ({ onNavigate, onBack }) => {
    const { hasPermission } = useAuth();

    const OPTIONS = [
        {
            id: 'admin-equipos-gestion',
            label: 'Gestión de Equipos',
            icon: (
                <Box style={{ position: 'relative' }}>
                    <IconDeviceDesktop style={{ width: rem(32), height: rem(32) }} />
                    <IconSettings 
                        style={{ 
                            position: 'absolute', 
                            bottom: -4, 
                            right: -4, 
                            width: rem(16), 
                            height: rem(16),
                            backgroundColor: 'white',
                            borderRadius: '50%'
                        }} 
                    />
                </Box>
            ),
            color: 'blue',
            description: 'Inventario, configuración y mantenimiento preventivo de equipos.',
            permission: 'MA_A_GEST_EQUIPO'
        },
    ];

    const visibleOptions = OPTIONS.filter(opt => {
        if (opt.id === 'admin-equipos-gestion') {
            return hasPermission('GC_ACCESO') || hasPermission('AI_MA_ADMIN_ACCESO') || hasPermission('GC_EQUIPOS') || hasPermission('MA_A_GEST_EQUIPO');
        }
        return hasPermission(opt.permission);
    });

    return (
        <Container fluid py="md">
            <PageHeader 
                title="Gestión de Calidad" 
                subtitle="Gestión de inventarios, validación de equipos y control de calidad ADL."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Administración', onClick: onBack },
                    { label: 'Gestión de Calidad' }
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

                {visibleOptions.length === 0 && (
                    <Card withBorder p="xl" radius="md" bg="gray.0">
                        <Text c="dimmed" ta="center">No tiene permisos para acceder a las funcionalidades de este hub.</Text>
                    </Card>
                )}
            </SimpleGrid>
        </Container>
    );
};
