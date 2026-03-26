import React from 'react';
import { 
    SimpleGrid, 
    Card, 
    Text, 
    ThemeIcon, 
    rem, 
    UnstyledButton,
    Box,
    Badge
} from '@mantine/core';
import { 
    IconUsers,
} from '@tabler/icons-react';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';

interface Props {
    onNavigate: (view: string) => void;
    onBack: () => void;
}

export const AdminMaHub: React.FC<Props> = ({ onNavigate, onBack }) => {
    const { hasPermission } = useAuth();

    const OPTIONS = [
        { 
            id: 'admin-muestreadores', 
            label: 'Muestreadores', 
            icon: <IconUsers style={{ width: rem(32), height: rem(32) }} />, 
            color: 'teal',
            description: 'Gestión de muestreadores activos, firmas y datos de personal técnico.', 
            permission: 'MA_MUESTREADORES' 
        },
    ];

    const visibleOptions = OPTIONS.filter(opt => hasPermission(opt.permission));

    return (
        <Box p="md" style={{ width: '100%' }}>
            <PageHeader 
                title="Medio Ambiente" 
                subtitle="Gestión de recursos, personal y equipos del área de Medio Ambiente."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Administración', onClick: onBack },
                    { label: 'Medio Ambiente' }
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
                                {opt.id === 'ma-solicitudes' && (
                                    <Badge color="blue" variant="filled" size="xs" ml="sm">
                                        MIGRADO A URS
                                    </Badge>
                                )}
                            </Text>

                            <Text size="sm" c="dimmed" lh={1.5}>
                                {opt.description}
                            </Text>
                        </Card>
                    </UnstyledButton>
                ))}

                {visibleOptions.length === 0 && (
                    <Card withBorder p="xl" radius="md" bg="gray.0">
                        <Text c="dimmed" ta="center">No tiene permisos para acceder a las funcionalidades de este módulo.</Text>
                    </Card>
                )}
            </SimpleGrid>
        </Box>
    );
};
