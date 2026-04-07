import { useEffect } from 'react';
import { 
    Stack, 
    Title, 
    Text, 
    SimpleGrid, 
    Box,
    Divider,
    Paper
} from '@mantine/core';
import { SelectionCard } from '../components/SelectionCard';
import { ComercialPage } from './ComercialPage';
import { TecnicaPage } from './TecnicaPage';
import { CoordinacionPage } from './CoordinacionPage';
import { useAuth } from '../../../contexts/AuthContext';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { useNavStore } from '../../../store/navStore';

export const FichasIngresoPage = () => {
    const { user, hasPermission } = useAuth();
    const { maArea, setMaArea, pendingRequestId } = useNavStore();

    useEffect(() => {
        // Solo intentar autoseleccionar si hay un request pendiente Y el usuario está cargado
        if (pendingRequestId && !maArea && user) {
            if (hasPermission('MA_TECNICA_ACCESO')) {
                setMaArea('tecnica');
            } else if (hasPermission('MA_COMERCIAL_ACCESO')) {
                setMaArea('comercial');
            } else if (hasPermission('MA_COORDINACION_ACCESO')) {
                setMaArea('coordinacion');
            }
        }
    }, [pendingRequestId, maArea, setMaArea, user, hasPermission]);

    if (maArea === 'comercial') {
        return (
            <ProtectedContent permission="MA_COMERCIAL_ACCESO" fallback={<Text ta="center" mt="xl" c="red">No tiene permisos</Text>}>
                <ComercialPage onBack={() => setMaArea(null)} />
            </ProtectedContent>
        );
    }
    if (maArea === 'tecnica') {
        return (
            <ProtectedContent permission="MA_TECNICA_ACCESO" fallback={<Text ta="center" mt="xl" c="red">No tiene permisos</Text>}>
                <TecnicaPage onBack={() => setMaArea(null)} />
            </ProtectedContent>
        );
    }
    if (maArea === 'coordinacion') {
        return (
            <ProtectedContent permission="MA_COORDINACION_ACCESO" fallback={<Text ta="center" mt="xl" c="red">No tiene permisos</Text>}>
                <CoordinacionPage onBack={() => setMaArea(null)} />
            </ProtectedContent>
        );
    }

    return (
        <Box p="md" style={{ width: '100% !important', maxWidth: '100% !important' }}>
            <Paper withBorder p="xl" radius="lg" shadow="sm" style={{ width: '100% !important', maxWidth: '100% !important' }}>
                <Stack gap={40}>
                    <Box>
                        <Title order={1} fw={900} ta="center" fz={42} c="blue.7">
                            Fichas de Ingreso
                        </Title>
                        <Text size="xl" c="dimmed" ta="center" mt="md" fw={500}>
                            Seleccione el área de trabajo para comenzar la gestión de muestras y servicios
                        </Text>
                    </Box>

                    <Divider variant="dashed" />

                    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing={40}>
                        <ProtectedContent permission="MA_COMERCIAL_ACCESO">
                            <SelectionCard
                                title="Comercial"
                                description="Gestión de cotizaciones, clientes y oportunidades comerciales para medio ambiente."
                                icon="💼"
                                color="#1565c0" // Azul ADL
                                onClick={() => setMaArea('comercial')}
                            />
                        </ProtectedContent>

                        <ProtectedContent permission="MA_TECNICA_ACCESO">
                            <SelectionCard
                                title="Área Técnica"
                                description="Ingreso de muestras técnicas, control de parámetros y gestión de análisis de laboratorio."
                                icon="🧪"
                                color="#2e7d32" // Verde Técnico
                                onClick={() => setMaArea('tecnica')}
                            />
                        </ProtectedContent>

                        <ProtectedContent permission="MA_COORDINACION_ACCESO">
                            <SelectionCard
                                title="Coordinación"
                                description="Planificación de muestreos, logística de retiro y coordinación de personal en terreno."
                                icon="📅"
                                color="#f57c00" // Naranja ADL
                                onClick={() => setMaArea('coordinacion')}
                            />
                        </ProtectedContent>
                    </SimpleGrid>
                </Stack>
            </Paper>
        </Box>
    );
};
