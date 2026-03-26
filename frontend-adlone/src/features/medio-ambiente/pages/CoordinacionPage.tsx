import React, { useState, useEffect } from 'react';
import { CoordinacionDetailView } from '../components/CoordinacionDetailView';
import { AssignmentListView } from '../components/AssignmentListView';
import { AssignmentDetailView } from '../components/AssignmentDetailView';
import { EnProcesoListView } from '../components/EnProcesoListView';
import { EnProcesoCalendarView } from '../components/EnProcesoCalendarView';
import { CoordinacionDashboardView } from '../components/CoordinacionDashboardView';
import { MuestreosEjecutadosListView } from '../components/MuestreosEjecutadosListView';
import { CatalogosProvider } from '../context/CatalogosContext';
import { ToastProvider } from '../../../contexts/ToastContext';
import { ToastContainer } from '../../../components/Toast/Toast';
import { fichaService } from '../services/ficha.service';
import { useAuth } from '../../../contexts/AuthContext';
import { FichaExportModal } from '../components/FichaExportModal';
import { SelectionCard } from '../components/SelectionCard';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useNavStore } from '../../../store/navStore';

import { 
    Button, 
    Text, 
    Stack, 
    Group, 
    Paper, 
    SimpleGrid, 
    ActionIcon, 
    Box,
    TextInput,
    Select,
    Table,
    Badge,
    Pagination,
    ScrollArea
} from '@mantine/core';
import { 
    IconAdjustmentsHorizontal,
    IconDownload,
    IconTrash,
    IconTable,
    IconCalendar,
    IconChartBar,
    IconChecklist,
    IconLayoutGrid,
    IconEdit
} from '@tabler/icons-react';

interface Props {
    onBack: () => void;
}

// --- Coordination List Component ---
const CoordinacionListView = ({ onBackToMenu, onViewDetail }: { onBackToMenu: () => void, onViewDetail: (id: number) => void }) => {
    // State
    const [searchId, setSearchId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchEstado, setSearchEstado] = useState('');
    const [searchTipo, setSearchTipo] = useState('');
    const [searchEmpresaFacturar, setSearchEmpresaFacturar] = useState('');
    const [searchEmpresaServicio, setSearchEmpresaServicio] = useState('');
    const [searchCentro, setSearchCentro] = useState('');
    const [searchObjetivo, setSearchObjetivo] = useState('');
    const [searchSubArea, setSearchSubArea] = useState('');
    const [searchUsuario, setSearchUsuario] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [fichas, setFichas] = useState<any[]>([]);
    const [showExportModal, setShowExportModal] = useState(false);

    const itemsPerPage = 10;

    // Load Data
    useEffect(() => {
        const loadFichas = async () => {
            setLoading(true);
            try {
                const response = await fichaService.getAll();
                let data: any[] = [];
                if (Array.isArray(response)) data = response;
                else if (response && response.data && Array.isArray(response.data)) data = response.data;
                else if (response && Array.isArray(response.recordset)) data = response.recordset;

                setFichas(data || []);
            } catch (error) {
                console.error("Error loading fichas:", error);
            } finally {
                setLoading(false);
            }
        };
        loadFichas();
    }, []);

    // Reset on filter
    useEffect(() => {
        setCurrentPage(1);
    }, [searchId, dateFrom, dateTo, searchEstado, searchTipo, searchEmpresaFacturar, searchEmpresaServicio, searchCentro, searchObjetivo, searchSubArea, searchUsuario]);

    const getUniqueValues = (key: string) => {
        const values = new Set<string>();
        fichas.forEach(f => {
            if (f[key]) values.add(String(f[key]).trim());
        });
        return Array.from(values).sort();
    };

    const uniqueEstados = React.useMemo(() => getUniqueValues('estado_ficha'), [fichas]);
    const uniqueTipos = React.useMemo(() => getUniqueValues('tipo_fichaingresoservicio'), [fichas]);
    const uniqueEmpFacturar = React.useMemo(() => getUniqueValues('empresa_facturar'), [fichas]);
    const uniqueEmpServicio = React.useMemo(() => getUniqueValues('empresa_servicio'), [fichas]);
    const uniqueCentros = React.useMemo(() => getUniqueValues('centro'), [fichas]);
    const uniqueObjetivos = React.useMemo(() => getUniqueValues('nombre_objetivomuestreo_ma'), [fichas]);
    const uniqueSubAreas = React.useMemo(() => getUniqueValues('nombre_subarea'), [fichas]);
    const uniqueUsuarios = React.useMemo(() => getUniqueValues('nombre_usuario'), [fichas]);
    const uniqueFichas = React.useMemo(() => getUniqueValues('id_fichaingresoservicio'), [fichas]);

    const handleClearFilters = () => {
        setSearchId('');
        setDateFrom('');
        setDateTo('');
        setSearchEstado('');
        setSearchTipo('');
        setSearchEmpresaFacturar('');
        setSearchEmpresaServicio('');
        setSearchCentro('');
        setSearchObjetivo('');
        setSearchSubArea('');
        setSearchUsuario('');
    };

    const filteredFichas = fichas.filter(f => {
        const displayId = f.fichaingresoservicio || f.id_fichaingresoservicio || '';
        const matchId = searchId ? String(displayId).includes(searchId) : true;
        const check = (val: string, search: string) => (!search || (val || '').toString().toLowerCase().includes(search.toLowerCase()));

        const matchEstado = check(f.estado_ficha, searchEstado);
        const matchTipo = check(f.tipo_fichaingresoservicio, searchTipo);
        const matchEmpresaFacturar = check(f.empresa_facturar, searchEmpresaFacturar);
        const matchEmpresaServicio = check(f.empresa_servicio, searchEmpresaServicio);
        const matchCentro = check(f.centro, searchCentro);
        const matchObjetivo = check(f.nombre_objetivomuestreo_ma, searchObjetivo);
        const matchSubArea = check(f.nombre_subarea, searchSubArea);
        const matchUsuario = check(f.nombre_usuario, searchUsuario);

        let matchDate = true;
        if (dateFrom || dateTo) {
            if (!f.fecha) return false;
            const parts = f.fecha.split('/');
            if (parts.length === 3) {
                const [d, m, y] = parts;
                const rowDate = new Date(`${y}-${m}-${d}`);
                rowDate.setHours(0, 0, 0, 0);
                if (dateFrom) {
                    const dFrom = new Date(dateFrom);
                    dFrom.setHours(0, 0, 0, 0);
                    if (rowDate < dFrom) matchDate = false;
                }
                if (dateTo && matchDate) {
                    const dTo = new Date(dateTo);
                    dTo.setHours(0, 0, 0, 0);
                    if (rowDate > dTo) matchDate = false;
                }
            }
        }
        return matchId && matchDate && matchEstado && matchTipo && matchEmpresaFacturar && matchEmpresaServicio && matchCentro && matchObjetivo && matchSubArea && matchUsuario;
    });

    const totalPages = Math.ceil(filteredFichas.length / itemsPerPage);
    const displayedFichas = filteredFichas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getStatusProps = (status: string) => {
        const s = (status || '').toUpperCase();
        if (s.includes('RECHAZADA') || s.includes('CANCELADO') || s.includes('REVISAR')) return { color: 'red', label: s };
        if (s.includes('COORDINACIÓN')) return { color: 'blue', label: s };
        if (s.includes('PROGRAMACIÓN')) return { color: 'grape', label: s };
        if (s.includes('PENDIENTE') || s.includes('ÁREA TÉCNICA')) return { color: 'yellow', label: 'PENDIENTE TÉCNICA' };
        if (s.includes('ASIGNAR')) return { color: 'orange', label: s };
        if (s.includes('VIGENTE') || s.includes('APROBADA') || s.includes('EJECUTADO') || s.includes('EN PROCESO')) return { color: 'green', label: s };
        return { color: 'gray', label: s || 'SIN ESTADO' };
    };

    return (
        <Box p="md" style={{ width: '100%' }}>
            <Stack gap="lg">
                <PageHeader 
                    title="Consultar Fichas (Coordinación)"
                    onBack={onBackToMenu}
                    rightSection={
                        <Button 
                            variant="filled" 
                            size="sm" 
                            color="green" 
                            leftSection={<IconDownload size={16} />}
                            onClick={() => setShowExportModal(true)}
                        >
                            Exportar PDF
                        </Button>
                    }
                />

                <Paper withBorder p="xl" radius="lg" shadow="sm">
                    <Stack gap="xl">
                        <Paper withBorder p="md" radius="md" bg="gray.0">
                            <Stack gap="sm">
                                <Group justify="space-between">
                                    <Group gap="xs">
                                        <IconAdjustmentsHorizontal size={20} color="gray" />
                                        <Text fw={600} size="sm">Filtros de Búsqueda</Text>
                                    </Group>
                                    <Button 
                                        variant="subtle" 
                                        size="compact-xs" 
                                        color="gray" 
                                        leftSection={<IconTrash size={14} />}
                                        onClick={handleClearFilters}
                                    >
                                        Limpiar Filtros
                                    </Button>
                                </Group>
                                
                                <SimpleGrid cols={{ base: 1, sm: 2, md: 4, lg: 6 }} spacing="sm">
                                    <TextInput
                                        label="N° Ficha"
                                        placeholder="Buscar..."
                                        value={searchId}
                                        onChange={(e) => setSearchId(e.target.value)}
                                        size="xs"
                                    />
                                    <Select
                                        label="Estado"
                                        placeholder="Seleccionar..."
                                        data={uniqueEstados.map(v => ({ value: v, label: v }))}
                                        value={searchEstado}
                                        onChange={(v) => setSearchEstado(v || '')}
                                        size="xs"
                                        searchable
                                        clearable
                                    />
                                    <TextInput label="Fecha Desde" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} size="xs" />
                                    <TextInput label="Fecha Hasta" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} size="xs" />
                                    <Select label="Tipo" placeholder="Seleccionar..." data={uniqueTipos.map(v => ({ value: v, label: v }))} value={searchTipo} onChange={(v) => setSearchTipo(v || '')} size="xs" searchable clearable />
                                    <Select label="E. Facturar" placeholder="Seleccionar..." data={uniqueEmpFacturar.map(v => ({ value: v, label: v }))} value={searchEmpresaFacturar} onChange={(v) => setSearchEmpresaFacturar(v || '')} size="xs" searchable clearable />
                                </SimpleGrid>
                            </Stack>
                        </Paper>

                        <FichaExportModal 
                            isOpen={showExportModal}
                            onClose={() => setShowExportModal(false)}
                            initialFilters={{
                                ficha: searchId,
                                estado: searchEstado,
                                fechaDesde: dateFrom,
                                fechaHasta: dateTo,
                                tipo: searchTipo,
                                empresaFacturar: searchEmpresaFacturar,
                                empresaServicio: searchEmpresaServicio,
                                centro: searchCentro,
                                objetivo: searchObjetivo,
                                subArea: searchSubArea,
                                usuario: searchUsuario
                            }}
                            catalogos={{
                                estados: uniqueEstados,
                                tipos: uniqueTipos,
                                empresasFacturar: uniqueEmpFacturar,
                                empresasServicio: uniqueEmpServicio,
                                centros: uniqueCentros,
                                objetivos: uniqueObjetivos,
                                subAreas: uniqueSubAreas,
                                fichas: uniqueFichas,
                                usuarios: uniqueUsuarios
                            }}
                        />

                        <Box pos="relative">
                            <ScrollArea h={550} offsetScrollbars>
                                <Table verticalSpacing="sm" highlightOnHover striped withTableBorder>
                                    <Table.Thead bg="gray.1">
                                        <Table.Tr>
                                            <Table.Th w={80}>ID</Table.Th>
                                            <Table.Th w={180}>Estado</Table.Th>
                                            <Table.Th w={100}>Fecha</Table.Th>
                                            <Table.Th w={150}>Facturar a</Table.Th>
                                            <Table.Th>E. Servicio</Table.Th>
                                            <Table.Th>Objetivo</Table.Th>
                                            <Table.Th w={60}>PDF</Table.Th>
                                            <Table.Th w={60}>Ver</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {loading ? (
                                            <Table.Tr>
                                                <Table.Td colSpan={8} align="center" py="xl">
                                                    <Text c="dimmed">Cargando datos...</Text>
                                                </Table.Td>
                                            </Table.Tr>
                                        ) : displayedFichas.length === 0 ? (
                                            <Table.Tr>
                                                <Table.Td colSpan={8} align="center" py="xl">
                                                    <Text c="dimmed">No se encontraron registros</Text>
                                                </Table.Td>
                                            </Table.Tr>
                                        ) : (
                                            displayedFichas.map((ficha, idx) => {
                                                const status = getStatusProps(ficha.estado_ficha);
                                                return (
                                                    <Table.Tr key={idx}>
                                                        <Table.Td fw={700}>{ficha.fichaingresoservicio || '-'}</Table.Td>
                                                        <Table.Td>
                                                            <Badge color={status.color} variant="light" size="sm" fullWidth>
                                                                {status.label}
                                                            </Badge>
                                                        </Table.Td>
                                                        <Table.Td fz="xs">{ficha.fecha}</Table.Td>
                                                        <Table.Td fz="xs" style={{ minWidth: 150 }} title={ficha.empresa_facturar}>
                                                            {ficha.empresa_facturar}
                                                        </Table.Td>
                                                        <Table.Td fz="xs" style={{ minWidth: 150 }} title={ficha.empresa_servicio}>
                                                            {ficha.empresa_servicio}
                                                        </Table.Td>
                                                        <Table.Td fz="xs" style={{ minWidth: 150 }} title={ficha.nombre_objetivomuestreo_ma}>
                                                            {ficha.nombre_objetivomuestreo_ma}
                                                        </Table.Td>
                                                        <Table.Td align="center">
                                                            {(ficha.estado_ficha || '').toUpperCase().includes('EN PROCESO') && (
                                                                <ActionIcon 
                                                                    color="red" 
                                                                    variant="subtle"
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        const idFicha = ficha.id_fichaingresoservicio || ficha.fichaingresoservicio;
                                                                        const pdfBlob = await fichaService.downloadPdf(Number(idFicha));
                                                                        const url = window.URL.createObjectURL(pdfBlob);
                                                                        const link = document.createElement('a');
                                                                        link.href = url;
                                                                        link.setAttribute('download', `Ficha_${idFicha}.pdf`);
                                                                        document.body.appendChild(link);
                                                                        link.click();
                                                                        document.body.removeChild(link);
                                                                    }}
                                                                >
                                                                    <IconDownload size={18} />
                                                                </ActionIcon>
                                                            )}
                                                        </Table.Td>
                                                        <Table.Td align="center">
                                                            <ActionIcon 
                                                                color="grape" 
                                                                variant="light"
                                                                onClick={() => onViewDetail(ficha.id_fichaingresoservicio || ficha.fichaingresoservicio)}
                                                            >
                                                                <IconEdit size={18} />
                                                            </ActionIcon>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                )
                                            })
                                        )}
                                    </Table.Tbody>
                                </Table>
                            </ScrollArea>
                        </Box>

                        <Group justify="space-between" mt="md">
                            <Text size="xs" c="dimmed">
                                Mostrando {filteredFichas.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} a {Math.min(currentPage * itemsPerPage, filteredFichas.length)} de {filteredFichas.length} registros
                            </Text>
                            <Pagination 
                                total={totalPages} 
                                value={currentPage} 
                                onChange={setCurrentPage} 
                                size="sm" 
                                radius="md"
                            />
                        </Group>
                    </Stack>
                </Paper>
            </Stack>
        </Box>
    );
};

// --- Main Orchestrator ---
const CoordinacionPageContent: React.FC<Props> = ({ onBack }) => {
    const { hasPermission } = useAuth();
    const { maCoordMode: mode, setMaCoordMode: setMode } = useNavStore();
    const [selectedFichaId, setSelectedFichaId] = useState<number | null>(null);
    const [detailReturnMode, setDetailReturnMode] = useState<string>('list_consultar');

    const goToDetailConsultar = (id: number, source: string = 'list_consultar') => {
        setDetailReturnMode(source);
        setSelectedFichaId(id);
        setMode('detail_consultar');
    };

    const goToDetailAssign = (id: number) => {
        setSelectedFichaId(id);
        setMode('detail_assign');
    };

    if (mode === 'detail_consultar' && selectedFichaId) {
        return (
            <CoordinacionDetailView
                fichaId={selectedFichaId}
                onBack={() => setMode(detailReturnMode)}
            />
        );
    }

    if (mode === 'detail_assign' && selectedFichaId) {
        return (
            <AssignmentDetailView
                fichaId={selectedFichaId}
                onBack={() => setMode('list_assign')}
            />
        );
    }

    if (mode === 'list_consultar') {
        return (
            <CoordinacionListView
                onBackToMenu={() => setMode('menu')}
                onViewDetail={(id) => goToDetailConsultar(id, 'list_consultar')}
            />
        );
    }

    if (mode === 'list_assign') {
        return (
            <AssignmentListView
                onBackToMenu={() => setMode('menu')}
                onViewAssignment={goToDetailAssign}
            />
        );
    }

    if (mode === 'list_en_proceso') {
        return (
            <EnProcesoListView
                onBackToMenu={() => setMode('menu')}
                onViewDetail={(id) => goToDetailConsultar(id, 'list_en_proceso')}
            />
        );
    }

    if (mode === 'calendar_en_proceso') {
        return (
            <EnProcesoCalendarView
                onBackToMenu={() => setMode('menu')}
            />
        );
    }

    if (mode === 'list_ejecutados') {
        return (
            <MuestreosEjecutadosListView
                onBackToMenu={() => setMode('menu')}
            />
        );
    }

    if (mode === 'dashboard') {
        return (
            <CoordinacionDashboardView
                onBack={() => setMode('menu')}
            />
        );
    }

    return (
        <Box p="md" style={{ width: '100%' }}>
            <Stack gap="lg">
                <PageHeader 
                    title="Gestión Coordinación"
                    onBack={onBack}
                />

                <Paper withBorder p="xl" radius="lg" shadow="sm">
                    <Stack gap="xl">
                        <Text size="lg" c="dimmed" ta="center">
                            Seleccione una opción para la programación y seguimiento de muestreos
                        </Text>

                        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xl" mt="xl">
                            <SelectionCard
                                title="Consultar Fichas"
                                description="Visualizar y gestionar fichas de ingreso, antecedentes y observaciones."
                                icon={<IconTable size={32} />}
                                color="#7c3aed"
                                onClick={() => setMode('list_consultar')}
                            />

                            <SelectionCard
                                title="Asignación Fechas"
                                description="Programar fechas de muestreo y asignar muestreadores responsables."
                                icon={<IconCalendar size={32} />}
                                color="#2563eb"
                                onClick={() => setMode('list_assign')}
                            />

                            {hasPermission('MA_CALENDARIO_ACCESO') && (
                                <SelectionCard
                                    title="Calendario Programación"
                                    description="Visualizar la programación mensual de muestreos en terreno de forma gráfica."
                                    icon={<IconLayoutGrid size={32} />}
                                    color="#0d9488"
                                    onClick={() => setMode('calendar_en_proceso')}
                                />
                            )}

                            <SelectionCard
                                title="Muestreos Ejecutados"
                                description="Muestreos ejecutados al 100%. Acceso a datos e informes emitidos."
                                icon={<IconChecklist size={32} />}
                                color="#059669"
                                onClick={() => setMode('list_ejecutados')}
                            />

                            <SelectionCard
                                title="Dashboard Interactivo"
                                description="Métricas de gestión, tendencias de ingresos y distribución operativa."
                                icon={<IconChartBar size={32} />}
                                color="#db2777"
                                onClick={() => setMode('dashboard')}
                            />
                        </SimpleGrid>
                    </Stack>
                </Paper>
            </Stack>
        </Box>
    );
};

export const CoordinacionPage: React.FC<Props> = (props) => {
    return (
        <ToastProvider>
            <CatalogosProvider>
                <CoordinacionPageContent {...props} />
            </CatalogosProvider>
            <ToastContainer />
        </ToastProvider>
    );
};
