import { lazy, Suspense, useEffect, useState } from 'react';
import {
    Stack,
    Title,
    Text,
    SimpleGrid,
    Box,
    Divider,
    Paper,
    Container,
    Loader,
    Center,
} from '@mantine/core';
import { SelectionCard } from '../components/SelectionCard';
import { useAuth } from '../../../contexts/AuthContext';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { useNavStore } from '../../../store/navStore';
import { CatalogosProvider } from '../context/CatalogosContext';

// Carga estática: componentes livianos usados frecuentemente
import { FichaCreateChoice } from '../components/FichaCreateChoice';
import { FichaCreateForm } from '../components/FichaCreateForm';
import { FichasExploradorView } from '../components/FichasExploradorView';
import { FichaUniversalView } from '../components/FichaUniversalView';
import { AssignmentListView } from '../components/AssignmentListView';
import { AssignmentDetailView } from '../components/AssignmentDetailView';

// Carga diferida: componentes pesados (Leaflet, ExcelJS, Chart, etc.)
const BulkFichaCreator = lazy(() => import('../components/BulkFichaCreator').then(m => ({ default: m.BulkFichaCreator })));
const EnProcesoCalendarView = lazy(() => import('../components/EnProcesoCalendarView').then(m => ({ default: m.EnProcesoCalendarView })));
const MuestreosEjecutadosListView = lazy(() => import('../components/MuestreosEjecutadosListView').then(m => ({ default: m.MuestreosEjecutadosListView })));
const CoordinacionDashboardView = lazy(() => import('../components/CoordinacionDashboardView').then(m => ({ default: m.CoordinacionDashboardView })));
const RouteMapPlannerView = lazy(() => import('../components/RouteMapPlannerView').then(m => ({ default: m.RouteMapPlannerView })));
const RutasListView = lazy(() => import('../components/RutasListView').then(m => ({ default: m.RutasListView })));
const KpiAnalystDashboardView = lazy(() => import('../components/KpiAnalystDashboardView').then(m => ({ default: m.KpiAnalystDashboardView })));
const EmpresaServicioFormView = lazy(() => import('../components/EmpresaServicioFormView').then(m => ({ default: m.EmpresaServicioFormView })));

const LazyFallback = () => (
    <Center h={300}><Loader size="md" /></Center>
);

import { 
    IconPlus, 
    IconTable, 
    IconMapPin, 
    IconCalendar, 
    IconHistory, 
    IconChartBar,
    IconRoute,
    IconBuilding 
} from '@tabler/icons-react';

export const FichasIngresoPage = () => {
    useAuth();
    const { 
        fichasMode, 
        setFichasMode,
        pendingRequestId,
        setPendingRequestId, 
        selectedFichaId,
        setSelectedFicha
    } = useNavStore();
    const [editingRutaId, setEditingRutaId] = useState<number | null>(null);









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
            case 'create_choice':
                return (
                    <ProtectedContent permission="FI_CREAR" fallback={<Text ta="center" mt="xl" c="red">No tiene permisos para crear fichas</Text>}>
                        <FichaCreateChoice 
                            onBack={() => setFichasMode('menu')}
                            onManual={() => setFichasMode('create_manual')}
                            onBulk={() => setFichasMode('create_bulk')}
                        />
                    </ProtectedContent>
                );
            case 'create_manual':
                return (
                    <ProtectedContent permission="FI_CREAR" fallback={<Text ta="center" mt="xl" c="red">No tiene permisos para crear fichas</Text>}>
                        <FichaCreateForm onBackToMenu={() => setFichasMode('create_choice')} />
                    </ProtectedContent>
                );
            case 'create_bulk':
                return (
                    <ProtectedContent permission="FI_CREAR" fallback={<Text ta="center" mt="xl" c="red">No tiene permisos para crear fichas</Text>}>
                        <Suspense fallback={<LazyFallback />}>
                            <BulkFichaCreator
                                onBack={() => setFichasMode('create_choice')}
                                onSuccess={() => setFichasMode('list_fichas')}
                            />
                        </Suspense>
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
                    <Suspense fallback={<LazyFallback />}>
                        <EnProcesoCalendarView onBackToMenu={() => setFichasMode('menu')} />
                    </Suspense>
                </ProtectedContent>
            );
        case 'list_ejecutados':
            return (
                <ProtectedContent permission={['MA_COMERCIAL_HISTORIAL_ACCESO', 'FI_EXP_MC']} fallback={<Text ta="center" mt="xl" c="red">No tiene permisos</Text>}>
                    <Suspense fallback={<LazyFallback />}>
                        <MuestreosEjecutadosListView onBackToMenu={() => setFichasMode('menu')} />
                    </Suspense>
                </ProtectedContent>
            );
        case 'dashboard':
            return (
                <ProtectedContent permission="MA_COORDINACION_ACCESO" fallback={<Text ta="center" mt="xl" c="red">No tiene permisos</Text>}>
                    <Suspense fallback={<LazyFallback />}>
                        <CoordinacionDashboardView onBack={() => setFichasMode('menu')} />
                    </Suspense>
                </ProtectedContent>
            );
        case 'kpi_dashboard':
            return (
                <ProtectedContent permission="MA_COORDINACION_ACCESO" fallback={<Text ta="center" mt="xl" c="red">No tiene permisos</Text>}>
                    <Suspense fallback={<LazyFallback />}>
                        <KpiAnalystDashboardView onBack={() => setFichasMode('menu')} />
                    </Suspense>
                </ProtectedContent>
            );
        case 'route_planner':
            return (
                <ProtectedContent permission="FI_ASIG_GRUPO" fallback={<Text ta="center" mt="xl" c="red">No tiene permisos</Text>}>
                    <Suspense fallback={<LazyFallback />}>
                        <RutasListView
                            onBackToMenu={() => setFichasMode('menu')}
                            onNuevaRuta={() => { setEditingRutaId(null); setFichasMode('route_planner_map'); }}
                            onEditarRuta={(rutaId) => { setEditingRutaId(rutaId); setFichasMode('route_planner_map'); }}
                        />
                    </Suspense>
                </ProtectedContent>
            );
        case 'route_planner_map':
            return (
                <ProtectedContent permission="FI_ASIG_GRUPO" fallback={<Text ta="center" mt="xl" c="red">No tiene permisos</Text>}>
                    <Suspense fallback={<LazyFallback />}>
                        <RouteMapPlannerView
                            onBack={() => { setEditingRutaId(null); setFichasMode('route_planner'); }}
                            editRutaId={editingRutaId}
                        />
                    </Suspense>
                </ProtectedContent>
            );
        case 'manage_empresas':
            return (
                <ProtectedContent permission="FI_CREAR_EMPRESA" fallback={<Text ta="center" mt="xl" c="red">No tiene permisos</Text>}>
                    <Suspense fallback={<LazyFallback />}>
                        <EmpresaServicioFormView onBack={() => setFichasMode('menu')} />
                    </Suspense>
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
                                        onClick={() => setFichasMode('create_choice')}
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

                                <ProtectedContent permission="FI_ASIG_GRUPO">
                                    <SelectionCard
                                        title="Planificador de Rutas"
                                        description="Visualice fichas en el mapa, arme rutas de muestreo y asigne recursos geográficamente."
                                        icon={<IconRoute size={32} />}
                                        color="#20c997"
                                        onClick={() => setFichasMode('route_planner')}
                                    />
                                </ProtectedContent>

                                <ProtectedContent permission="MA_COORDINACION_ACCESO">
                                    <SelectionCard
                                        title="Dashboard Inteligente"
                                        description="Análisis automático de métricas operativas, rendimiento de laboratorios y detección de riesgos."
                                        icon={<IconChartBar size={32} />}
                                        color="#e64980"
                                        onClick={() => setFichasMode('kpi_dashboard')}
                                    />
                                </ProtectedContent>


                                <ProtectedContent permission="FI_CREAR_EMPRESA">
                                    <SelectionCard
                                        title="Empresas de Servicio"
                                        description="Gestionar el maestro de empresas prestadoras de servicios de muestreo y terreno."
                                        icon={<IconBuilding size={32} />}
                                        color="#0ca678"
                                        onClick={() => setFichasMode('manage_empresas')}
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
