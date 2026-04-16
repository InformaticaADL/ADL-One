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
import { useAuth } from '../../../contexts/AuthContext';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { useNavStore } from '../../../store/navStore';
import { CatalogosProvider } from '../context/CatalogosContext';

import { FichaCreateForm } from '../components/FichaCreateForm';
import { FichasExploradorView } from '../components/FichasExploradorView';
import { FichaUniversalView } from '../components/FichaUniversalView';
import { AssignmentListView } from '../components/AssignmentListView';
import { AssignmentDetailView } from '../components/AssignmentDetailView';
import { EnProcesoCalendarView } from '../components/EnProcesoCalendarView';
import { MuestreosEjecutadosListView } from '../components/MuestreosEjecutadosListView';
import { CoordinacionDashboardView } from '../components/CoordinacionDashboardView';

import { 
    IconPlus, 
    IconTable, 
    IconMapPin, 
    IconCalendar, 
    IconHistory, 
    IconChartBar 
} from '@tabler/icons-react';

export const FichasIngresoPage = () => {
    const { user, hasPermission } = useAuth();
    const { 
        fichasMode, 
        setFichasMode,
        pendingRequestId,
        setPendingRequestId, 
        selectedFichaId,
        setSelectedFicha,
        setActiveSubmodule, 
        previousSubmodule 
    } = useNavStore();

    const handleGlobalBack = () => {
        // Navigate back to the previous global submodule
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

    // Handle Deep Linking from Notifications
    useEffect(() => {
        if (pendingRequestId) {
            setSelectedFicha(pendingRequestId, null);
            setFichasMode('detail_ficha');
            setPendingRequestId(null);
        }
    }, [pendingRequestId]);

    // Render content based on router, wrapped in context
    const renderContent = () => {
        switch (fichasMode) {
            case 'create_ficha':
            return (
                <ProtectedContent permission="FI_CREAR" fallback={<Text ta="center" mt="xl" c="red">No tiene permisos para crear fichas</Text>}>
                    <FichaCreateForm onBackToMenu={() => setFichasMode('menu')} />
                </ProtectedContent>
            );
        case 'list_fichas':
            return (
                <ProtectedContent permission={['FI_CONSULTAR', 'FI_APROBAR_TEC', 'FI_RECHAZAR_TEC', 'FI_APROBAR_COO', 'FI_RECHAZAR_COO', 'FI_EDITAR']} fallback={<Text ta="center" mt="xl" c="red">No tiene permisos consultar fichas</Text>}>
                    <FichasExploradorView 
                        onBackToMenu={() => setFichasMode('menu')} 
                        onViewDetail={(id) => {
                            setSelectedFicha(id, null);
                            setFichasMode('detail_ficha');
                        }}
                    />
                </ProtectedContent>
            );
        case 'detail_ficha':
            return selectedFichaId ? (
                <FichaUniversalView 
                    fichaId={selectedFichaId} 
                    onBack={() => setFichasMode('list_fichas')} 
                />
            ) : null;
        case 'list_assign':
            return (
                <ProtectedContent permission="FI_ASIG_GRUPO" fallback={<Text ta="center" mt="xl" c="red">No tiene permisos</Text>}>
                    <AssignmentListView 
                        onBackToMenu={() => setFichasMode('menu')} 
                        onViewAssignment={(id) => {
                            setSelectedFicha(id, null);
                            setFichasMode('detail_assign');
                        }}
                    />
                </ProtectedContent>
            );
        case 'detail_assign':
            return selectedFichaId ? (
                <AssignmentDetailView 
                    fichaId={selectedFichaId} 
                    onBack={() => setFichasMode('list_assign')} 
                />
            ) : null;
        case 'calendar':
            return (
                <ProtectedContent permission="MA_CALENDARIO_ACCESO" fallback={<Text ta="center" mt="xl" c="red">No tiene permisos</Text>}>
                    <EnProcesoCalendarView onBackToMenu={() => setFichasMode('menu')} />
                </ProtectedContent>
            );
        case 'list_ejecutados':
            return (
                <ProtectedContent permission={['MA_COMERCIAL_HISTORIAL_ACCESO', 'FI_EXP_MC']} fallback={<Text ta="center" mt="xl" c="red">No tiene permisos</Text>}>
                    <MuestreosEjecutadosListView onBackToMenu={() => setFichasMode('menu')} />
                </ProtectedContent>
            );
        case 'dashboard':
            return (
                <ProtectedContent permission="MA_COORDINACION_ACCESO" fallback={<Text ta="center" mt="xl" c="red">No tiene permisos</Text>}>
                    <CoordinacionDashboardView onBackToMenu={() => setFichasMode('menu')} />
                </ProtectedContent>
            );
        case 'menu':
        default:
            return (
                <Container fluid p="md" style={{ width: '100% !important', maxWidth: '100% !important' }}>
                    <Paper withBorder p={50} radius="lg" shadow="sm" style={{ width: '100% !important', maxWidth: '100% !important' }}>
                        <Stack gap="xl">
                            <Box>
                                <Title order={1} fw={800} ta="center" fz={32} c="blue.8">
                                    Fichas de Ingreso (Universal)
                                </Title>
                                <Text size="md" c="dimmed" ta="center" mt="xs" fw={500}>
                                    Gestión unificada según su nivel de acceso
                                </Text>
                            </Box>

                            <Divider variant="dashed" />

                            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing={40} mt="xl">
                                <ProtectedContent permission="FI_CREAR">
                                    <SelectionCard
                                        title="Nueva Ficha"
                                        description="Crear una nueva solicitud de análisis desde cero, ingresando antecedentes y parámetros."
                                        icon={<IconPlus size={32} />}
                                        color="#228be6"
                                        onClick={() => setFichasMode('create_ficha')}
                                    />
                                </ProtectedContent>

                                <ProtectedContent permission={['FI_CONSULTAR', 'FI_VER', 'FI_APROBAR_TEC', 'FI_RECHAZAR_TEC', 'FI_APROBAR_COO', 'FI_RECHAZAR_COO', 'FI_EDITAR']}>
                                    <SelectionCard
                                        title="Explorador y Validación"
                                        description="Buscador universal. Permite visualizar, editar, aprobar o rechazar fichas según el área correspondiente."
                                        icon={<IconTable size={32} />}
                                        color="#7950f2"
                                        onClick={() => setFichasMode('list_fichas')}
                                    />
                                </ProtectedContent>

                                <ProtectedContent permission="FI_ASIG_GRUPO">
                                    <SelectionCard
                                        title="Asignación Terreno"
                                        description="Programar logística. Asignar fechas, vehículos y equipos a las fichas aprobadas."
                                        icon={<IconMapPin size={32} />}
                                        color="#f59f00"
                                        onClick={() => setFichasMode('list_assign')}
                                    />
                                </ProtectedContent>

                                <ProtectedContent permission="MA_CALENDARIO_ACCESO">
                                    <SelectionCard
                                        title="Calendario Terreno"
                                        description="Visualizar la programación mensual de muestreos en terreno de forma gráfica."
                                        icon={<IconCalendar size={32} />}
                                        color="#12b886"
                                        onClick={() => setFichasMode('calendar')}
                                    />
                                </ProtectedContent>

                                <ProtectedContent permission={['MA_COMERCIAL_HISTORIAL_ACCESO', 'FI_EXP_MC']}>
                                    <SelectionCard
                                        title="Muestreos Completados"
                                        description="Histórico unificado de servicios ejecutados y reportes generados. Permite remuestreos."
                                        icon={<IconHistory size={32} />}
                                        color="#15aabf"
                                        onClick={() => setFichasMode('list_ejecutados')}
                                    />
                                </ProtectedContent>

                                <ProtectedContent permission="MA_COORDINACION_ACCESO">
                                    <SelectionCard
                                        title="Dashboard KPIS"
                                        description="Métricas operativas, rendimiento de laboratorios y reportes analíticos."
                                        icon={<IconChartBar size={32} />}
                                        color="#e64980"
                                        onClick={() => setFichasMode('dashboard')}
                                    />
                                </ProtectedContent>
                            </SimpleGrid>
                        </Stack>
                    </Paper>
                </Container>
            );
        }
    };

    return (
        <CatalogosProvider>
            {renderContent()}
        </CatalogosProvider>
    );
};
