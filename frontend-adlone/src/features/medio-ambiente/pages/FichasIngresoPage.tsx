import { useState, useEffect, useRef } from 'react';
import { 
    Stack, 
    Title, 
    Text, 
    SimpleGrid, 
    Box,
    Divider,
    Paper,
    Container
} from '@mantine/core';
import { SelectionCard } from '../components/SelectionCard';
import { ComercialPage } from './ComercialPage';
import { TecnicaPage } from './TecnicaPage';
import { CoordinacionPage } from './CoordinacionPage';
import { useAuth } from '../../../contexts/AuthContext';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { useNavStore } from '../../../store/navStore';

export const FichasIngresoPage = () => {
    const [selectedOption, setSelectedOption] = useState<'comercial' | 'tecnica' | 'coordinacion' | null>(null);
    const { user, hasPermission } = useAuth();
    const { pendingRequestId, setActiveSubmodule, previousSubmodule } = useNavStore();

    const handleGlobalBack = () => {
        // Navigate back to the previous global submodule, skipping the selection cards screen
        setActiveSubmodule(previousSubmodule || '');
    };

    const normalize = (str: string) => 
        str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim() : "";

    const hasRole = (roleName: string | string[]) => {
        const userRoles = (user?.roles || []).map(r => normalize(r));
        const userCargo = normalize(user?.cargo || '');
        
        const names = Array.isArray(roleName) ? roleName : [roleName];
        return names.some(name => {
            const normalizedSearch = normalize(name);
            return userRoles.includes(normalizedSearch) || userCargo === normalizedSearch;
        });
    };

    const isAdmin = hasRole('ADMINISTRADOR');

    // Role markers
    const isComercialRole = hasRole('COMERCIAL');
    const isTecnicaRole = hasRole(['JEFE TECNICO', 'TECNICO']);
    const isCoordinacionRole = hasRole(['COORDINACION', 'COORDINADOR']);

    // Role-based visibility flags
    const showComercial = isAdmin || (isComercialRole) || (!isTecnicaRole && !isCoordinacionRole && hasPermission(['MA_COMERCIAL_ACCESO', 'FI_NEW_CREAR']));
    const showTecnica = isAdmin || (isTecnicaRole) || (!isComercialRole && !isCoordinacionRole && hasPermission('MA_TECNICA_ACCESO'));
    const showCoordinacion = isAdmin || (isCoordinacionRole) || (!isComercialRole && !isTecnicaRole && hasPermission(['MA_COORDINACION_ACCESO', 'FI_ASIG_GRUPO', 'MA_CALENDARIO_ACCESO', 'MA_COMERCIAL_HISTORIAL_ACCESO', 'FI_EXP_MC', 'FI_VER', 'FI_APROBAR', 'FI_EXPORTAR_CFI']));

    const hasAutoJumped = useRef(false);
    
    // Auto-selection logic for roles and notifications
    useEffect(() => {
        // If we already have a selection or we manually navigated back, don't jump
        if (selectedOption !== null || hasAutoJumped.current) return;

        // 1. Priority: Navigation from notification
        if (pendingRequestId) {
            if (showTecnica) {
                setSelectedOption('tecnica');
                hasAutoJumped.current = true;
                return;
            } else if (showComercial) {
                setSelectedOption('comercial');
                hasAutoJumped.current = true;
                return;
            }
        }

        // 2. Role-based auto-jump (Only for non-admins with exactly one access)
        if (!isAdmin) {
            const options = [];
            if (showCoordinacion) options.push('coordinacion');
            if (showTecnica) options.push('tecnica');
            if (showComercial) options.push('comercial');

            if (options.length === 1) {
                setSelectedOption(options[0] as any);
                hasAutoJumped.current = true;
            }
        }
    }, [pendingRequestId, selectedOption, showTecnica, showComercial, showCoordinacion, isAdmin]);


    if (selectedOption === 'comercial') {
        return (
            <ProtectedContent permission={['MA_COMERCIAL_ACCESO', 'FI_CONSULTAR', 'FI_NEW_CREAR', 'MA_COMERCIAL_HISTORIAL_ACCESO']} fallback={<Text ta="center" mt="xl" c="red">No tiene permisos</Text>}>
                <ComercialPage onBack={handleGlobalBack} />
            </ProtectedContent>
        );
    }

    if (selectedOption === 'tecnica') {
        return (
            <ProtectedContent permission={['MA_TECNICA_ACCESO', 'FI_VER', 'FI_APROBAR', 'FI_REVISION']} fallback={<Text ta="center" mt="xl" c="red">No tiene permisos</Text>}>
                <TecnicaPage onBack={handleGlobalBack} />
            </ProtectedContent>
        );
    }

    if (selectedOption === 'coordinacion') {
        return (
            <ProtectedContent permission={['MA_COORDINACION_ACCESO', 'FI_ASIG_GRUPO', 'MA_CALENDARIO_ACCESO', 'MA_COMERCIAL_HISTORIAL_ACCESO', 'FI_EXP_MC', 'FI_VER', 'FI_APROBAR', 'FI_EXPORTAR_CFI']} fallback={<Text ta="center" mt="xl" c="red">No tiene permisos</Text>}>
                <CoordinacionPage onBack={handleGlobalBack} />
            </ProtectedContent>
        );
    }


    return (
        <Container fluid p="md" style={{ width: '100% !important', maxWidth: '100% !important' }}>
            <Paper withBorder p={50} radius="lg" shadow="sm" style={{ width: '100% !important', maxWidth: '100% !important' }}>
                <Stack gap="xl">
                    <Box>
                        <Title order={1} fw={900} ta="center" fz={42} c="blue.7">
                            Fichas de Ingreso
                        </Title>
                        <Text size="xl" c="dimmed" ta="center" mt="md" fw={500}>
                            Seleccione el área de trabajo para comenzar la gestión de muestras y servicios
                        </Text>
                    </Box>

                    <Divider variant="dashed" />

                    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing={40} mt="xl">
                        {showComercial && (
                            <SelectionCard
                                title="Gestión Comercial"
                                description="Gestión de cotizaciones, clientes y oportunidades comerciales para medio ambiente."
                                icon="💼"
                                color="#1565c0"
                                onClick={() => setSelectedOption('comercial')}
                            />
                        )}

                        {showTecnica && (
                            <SelectionCard
                                title="Área Técnica"
                                description="Ingreso de muestras técnicas, control de parámetros y gestión de análisis de laboratorio."
                                icon="🧪"
                                color="#2e7d32"
                                onClick={() => setSelectedOption('tecnica')}
                            />
                        )}

                        {showCoordinacion && (
                            <SelectionCard
                                title="Coordinación"
                                description="Planificación de muestreos, logística de retiro y coordinación de personal en terreno."
                                icon="📅"
                                color="#f57c00"
                                onClick={() => setSelectedOption('coordinacion')}
                            />
                        )}
                    </SimpleGrid>
                </Stack>
            </Paper>
        </Container>
    );
};
