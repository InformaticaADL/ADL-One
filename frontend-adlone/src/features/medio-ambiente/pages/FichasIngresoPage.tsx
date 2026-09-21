import { lazy, Suspense, useEffect, useState } from 'react';
import { SelectionCard } from '../components/SelectionCard';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useAuth } from '../../../contexts/AuthContext';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { useNavStore } from '../../../store/navStore';
import { CatalogosProvider } from '../context/CatalogosContext';

const NoPermiso = ({ children }: { children: React.ReactNode }) => (
    <p className="mt-8 text-center text-sm text-destructive">{children}</p>
);

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

const LazyFallback = () => (
    <div className="flex h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
);

import { 
    IconPlus, 
    IconTable, 
    IconMapPin, 
    IconCalendar, 
    IconHistory, 
    IconChartBar,
    IconRoute
} from '@tabler/icons-react';

export const FichasIngresoPage = () => {
    const { hasPermission } = useAuth();
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
                    <ProtectedContent permission="FI_CREAR" fallback={<NoPermiso>No tiene permisos para crear fichas</NoPermiso>}>
                        <FichaCreateChoice 
                            onBack={() => setFichasMode('menu')}
                            onManual={() => setFichasMode('create_manual')}
                            onBulk={() => setFichasMode('create_bulk')}
                        />
                    </ProtectedContent>
                );
            case 'create_manual':
                return (
                    <ProtectedContent permission="FI_CREAR" fallback={<NoPermiso>No tiene permisos para crear fichas</NoPermiso>}>
                        <FichaCreateForm
                            onBackToMenu={() => setFichasMode('create_choice')}
                            onSuccess={() => setFichasMode('list_fichas')}
                        />
                    </ProtectedContent>
                );
            case 'create_bulk':
                return (
                    <ProtectedContent permission="FI_CREAR" fallback={<NoPermiso>No tiene permisos para crear fichas</NoPermiso>}>
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
                <ProtectedContent permission={['FI_CONSULTAR', 'FI_APROBAR_TEC', 'FI_RECHAZAR_TEC', 'FI_APROBAR_COO', 'FI_RECHAZAR_COO', 'FI_EDITAR']} fallback={<NoPermiso>No tiene permisos consultar fichas</NoPermiso>}>
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
                <ProtectedContent permission="FI_ASIG_GRUPO" fallback={<NoPermiso>No tiene permisos</NoPermiso>}>
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
                <ProtectedContent permission="MA_CALENDARIO_ACCESO" fallback={<NoPermiso>No tiene permisos</NoPermiso>}>
                    <Suspense fallback={<LazyFallback />}>
                        <EnProcesoCalendarView onBackToMenu={() => setFichasMode('menu')} />
                    </Suspense>
                </ProtectedContent>
            );
        case 'list_ejecutados':
            return (
                <ProtectedContent permission={['MA_COMERCIAL_HISTORIAL_ACCESO', 'FI_EXP_MC']} fallback={<NoPermiso>No tiene permisos</NoPermiso>}>
                    <Suspense fallback={<LazyFallback />}>
                        <MuestreosEjecutadosListView onBackToMenu={() => setFichasMode('menu')} />
                    </Suspense>
                </ProtectedContent>
            );
        case 'dashboard':
            return (
                <ProtectedContent permission="MA_COORDINACION_ACCESO" fallback={<NoPermiso>No tiene permisos</NoPermiso>}>
                    <Suspense fallback={<LazyFallback />}>
                        <CoordinacionDashboardView onBack={() => setFichasMode('menu')} />
                    </Suspense>
                </ProtectedContent>
            );
        case 'kpi_dashboard':
            return (
                <ProtectedContent permission="MA_COORDINACION_ACCESO" fallback={<NoPermiso>No tiene permisos</NoPermiso>}>
                    <Suspense fallback={<LazyFallback />}>
                        <KpiAnalystDashboardView onBack={() => setFichasMode('menu')} />
                    </Suspense>
                </ProtectedContent>
            );
        case 'route_planner':
            return (
                <ProtectedContent permission="FI_ASIG_GRUPO" fallback={<NoPermiso>No tiene permisos</NoPermiso>}>
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
                <ProtectedContent permission="FI_ASIG_GRUPO" fallback={<NoPermiso>No tiene permisos</NoPermiso>}>
                    <Suspense fallback={<LazyFallback />}>
                        <RouteMapPlannerView
                            onBack={() => { setEditingRutaId(null); setFichasMode('route_planner'); }}
                            editRutaId={editingRutaId}
                        />
                    </Suspense>
                </ProtectedContent>
            );

        case 'menu':
        default: {
            // Se filtra ANTES de dibujar la grilla (no con <ProtectedContent> envolviendo
            // cada ítem): así se sabe cuántos van a quedar visibles y se puede hacer que
            // el último ocupe el ancho completo cuando sobra impar, en vez de dejar un
            // hueco vacío al lado — eso es lo que se veía mal con 7 ítems en 2 columnas.
            const items = [
                {
                    permission: 'FI_CREAR', title: 'Nueva Ficha',
                    description: 'Crear una nueva solicitud de análisis desde cero, ingresando antecedentes y parámetros.',
                    icon: <IconPlus size={22} />, onClick: () => setFichasMode('create_choice'),
                },
                {
                    permission: ['FI_CONSULTAR', 'FI_VER', 'FI_APROBAR_TEC', 'FI_RECHAZAR_TEC', 'FI_APROBAR_COO', 'FI_RECHAZAR_COO', 'FI_EDITAR'],
                    title: 'Explorador y Validación',
                    description: 'Buscador universal. Permite visualizar, editar, aprobar o rechazar fichas según el área correspondiente.',
                    icon: <IconTable size={22} />, onClick: () => setFichasMode('list_fichas'),
                },
                {
                    permission: 'FI_ASIG_GRUPO', title: 'Asignación Terreno',
                    description: 'Programar logística. Asignar fechas, vehículos y equipos a las fichas aprobadas.',
                    icon: <IconMapPin size={22} />, onClick: () => setFichasMode('list_assign'),
                },
                {
                    permission: 'MA_CALENDARIO_ACCESO', title: 'Calendario Terreno',
                    description: 'Visualizar la programación mensual de muestreos en terreno de forma gráfica.',
                    icon: <IconCalendar size={22} />, onClick: () => setFichasMode('calendar'),
                },
                {
                    permission: ['MA_COMERCIAL_HISTORIAL_ACCESO', 'FI_EXP_MC'], title: 'Muestreos Completados',
                    description: 'Histórico unificado de servicios ejecutados y reportes generados. Permite remuestreos.',
                    icon: <IconHistory size={22} />, onClick: () => setFichasMode('list_ejecutados'),
                },
                {
                    permission: 'FI_ASIG_GRUPO', title: 'Planificador de Rutas',
                    description: 'Visualice fichas en el mapa, arme rutas de muestreo y asigne recursos geográficamente.',
                    icon: <IconRoute size={22} />, onClick: () => setFichasMode('route_planner'),
                },
                {
                    permission: 'MA_COORDINACION_ACCESO', title: 'Dashboard Operativo',
                    description: 'Vista minimalista de la coordinación diaria, carga de trabajo y estados.',
                    icon: <IconChartBar size={22} />, onClick: () => setFichasMode('dashboard'),
                },
            ].filter((item) => hasPermission(item.permission));

            return (
                <div>
                    <PageHeader title="Fichas de Ingreso" subtitle="Gestión unificada según su nivel de acceso" />

                    <div className="flex max-w-[640px] flex-col gap-2.5">
                        {items.map((item) => (
                            <SelectionCard key={item.title} {...item} />
                        ))}
                    </div>
                </div>
            );
        }
        }
    };

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <CatalogosProvider>
                {renderContent()}
            </CatalogosProvider>
        </div>
    );
};
