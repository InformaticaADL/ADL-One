import React, { useState, useRef, useEffect } from 'react';
import { AntecedentesForm } from '../components/AntecedentesForm';
import type { AntecedentesFormHandle } from '../components/AntecedentesForm';
import { AnalysisForm } from '../components/AnalysisForm';
import { ObservacionesForm } from '../components/ObservacionesForm';
import { CommercialDetailView } from '../components/CommercialDetailView';
import { CatalogosProvider } from '../context/CatalogosContext';
import { ToastProvider, useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { ToastContainer } from '../../../components/Toast/Toast';
import { fichaService } from '../services/ficha.service';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { SelectionCard } from '../components/SelectionCard';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useNavStore } from '../../../store/navStore';

import { 
    Modal, 
    Button, 
    Text, 
    Title, 
    Stack, 
    Group, 
    ThemeIcon, 
    Paper, 
    SimpleGrid, 
    ActionIcon, 
    Divider,
    Box,
    Tabs,
    TextInput,
    Select,
    Table,
    Badge,
    Pagination,
    ScrollArea,
    Container
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { 
    IconCheck, 
    IconChevronLeft, 
    IconPlus, 
    IconTrash, 
    IconFileText, 
    IconArrowRight,
    IconTable,
    IconAdjustmentsHorizontal,
    IconDownload,
    IconEdit,
    IconHistory
} from '@tabler/icons-react';

interface Props {
    onBack: () => void;
}

const SuccessModal = ({
    isOpen,
    onClose,
    fichaId
}: {
    isOpen: boolean;
    onClose: () => void;
    fichaId: number | null
}) => {
    return (
        <Modal 
            opened={isOpen} 
            onClose={onClose} 
            title="¡Ficha Creada Exitosamente!"
            centered
            size="md"
            radius="lg"
            withCloseButton={false}
        >
            <Stack align="center" py="xl">
                <ThemeIcon size={80} radius="xl" color="green" variant="light">
                    <IconCheck size={40} />
                </ThemeIcon>
                
                <Title order={3} ta="center">Registro Confirmado</Title>
                
                <Text ta="center" c="dimmed">
                    Se ha generado la Ficha N° <Text span fw={700} c="blue">{fichaId}</Text> correctamente en el sistema.
                </Text>

                <Button 
                    fullWidth 
                    size="md" 
                    color="green" 
                    radius="md" 
                    onClick={onClose}
                    mt="lg"
                >
                    Aceptar y Volver
                </Button>
            </Stack>
        </Modal>
    );
};

const CommercialForm = ({ onBackToMenu }: { onBackToMenu: () => void }) => {
    const isMobile = useMediaQuery('(max-width: 550px)');
    const isVerySmall = useMediaQuery('(max-width: 450px)');
    const { user } = useAuth();
    const { showToast } = useToast();
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [createdFichaId, setCreatedFichaId] = useState<number | null>(null);
    const [isAntecedentesValid, setIsAntecedentesValid] = useState(false);
    const [observaciones, setObservaciones] = useState('');
    const [activeTab, setActiveTab] = useState<string | null>('antecedentes');
    const antecedentesRef = useRef<AntecedentesFormHandle>(null);
    const topRef = useRef<HTMLDivElement>(null);
    const [savedAnalysis, setSavedAnalysis] = useState<any[]>([]);

    const scrollToTop = () => {
        if (topRef.current) {
            topRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
    };

    const handleSave = async () => {
        try {
            const antData = antecedentesRef.current?.getData ? antecedentesRef.current.getData() : null;
            if (!antData) {
                showToast({ type: 'warning', message: 'Por favor complete los antecedentes requeridos' });
                return;
            }

            const payload = {
                antecedentes: antData,
                analisis: savedAnalysis,
                observaciones: observaciones || 'No Aplica',
                user: { id: user?.id || 0 }
            };

            const result = await fichaService.create(payload);

            if (result && (result.success || result.data?.success)) {
                const idToUse = result.data?.id || result.id;
                if (idToUse) {
                    setCreatedFichaId(Number(idToUse));
                    setShowSuccessModal(true);
                } else {
                    showToast({ type: 'warning', message: 'Ficha creada pero no se recibió un ID válido.' });
                }
            } else {
                showToast({ type: 'error', message: 'Error al respuesta del servidor' });
            }

        } catch (error: any) {
            console.error("Error saving ficha:", error);
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al grabar la ficha' });
        }
    };

    const handleCloseSuccess = () => {
        setShowSuccessModal(false);
        setCreatedFichaId(null);
        onBackToMenu();
    };

    return (
        <Container fluid w="100%" mx="auto" px={0} py="md" style={{ maxWidth: '100% !important' }}>
            <SuccessModal
                isOpen={showSuccessModal}
                onClose={handleCloseSuccess}
                fichaId={createdFichaId}
            />

            <Stack gap="lg">
                <div ref={topRef} style={{ height: 0, overflow: 'hidden' }} />
                <PageHeader 
                    title="Nueva Ficha Comercial"
                    onBack={onBackToMenu}
                />

                <Paper withBorder p={0} radius="lg" shadow="sm" style={{ width: '100% !important', maxWidth: '100% !important', overflow: 'hidden' }}>
                    <Tabs 
                        value={activeTab} 
                        onChange={(val) => {
                            setActiveTab(val);
                            scrollToTop();
                        }} 
                        variant="outline" 
                        radius="md" 
                        style={{ width: '100% !important' }}
                    >
                        <Tabs.List grow style={{ borderBottom: '1px solid #dee2e6' }}>
                            <Tabs.Tab 
                                value="antecedentes" 
                                leftSection={<IconFileText size={isVerySmall ? 16 : (isMobile ? 18 : 22)} />}
                                px={isVerySmall ? 4 : (isMobile ? 'xs' : 'xl')} 
                                py={isMobile ? 'xs' : 'md'}
                                style={{ 
                                    flex: '1 1 0%', 
                                    fontSize: isVerySmall ? '0.75rem' : (isMobile ? '0.85rem' : '1rem'), 
                                    fontWeight: 600, 
                                    minWidth: 0 
                                }}
                            >
                                {isVerySmall ? 'Antec.' : 'Antecedentes'}
                            </Tabs.Tab>
                            <Tabs.Tab 
                                value="analisis" 
                                leftSection={<IconTable size={isVerySmall ? 16 : (isMobile ? 18 : 22)} />}
                                px={isVerySmall ? 4 : (isMobile ? 'xs' : 'xl')} 
                                py={isMobile ? 'xs' : 'md'}
                                style={{ 
                                    flex: '1 1 0%', 
                                    fontSize: isVerySmall ? '0.75rem' : (isMobile ? '0.85rem' : '1rem'), 
                                    fontWeight: 600, 
                                    minWidth: 0 
                                }}
                            >
                                {isVerySmall ? 'Análisis' : 'Análisis'}
                            </Tabs.Tab>
                            <Tabs.Tab 
                                value="observaciones" 
                                leftSection={<IconEdit size={isVerySmall ? 16 : (isMobile ? 18 : 22)} />}
                                px={isVerySmall ? 4 : (isMobile ? 'xs' : 'xl')} 
                                py={isMobile ? 'xs' : 'md'}
                                style={{ 
                                    flex: '1 1 0%', 
                                    fontSize: isVerySmall ? '0.75rem' : (isMobile ? '0.85rem' : '1rem'), 
                                    fontWeight: 600, 
                                    minWidth: 0 
                                }}
                            >
                                {isVerySmall ? 'Obs.' : 'Observaciones'}
                            </Tabs.Tab>
                        </Tabs.List>

                        <Tabs.Panel value="antecedentes" p={isMobile ? 'md' : 50} pt="xl" style={{ width: '100% !important', minHeight: '70vh' }}>
                            <AntecedentesForm
                                ref={antecedentesRef}
                                onValidationChange={setIsAntecedentesValid}
                            />
                        </Tabs.Panel>

                        <Tabs.Panel value="analisis" p={isMobile ? 'md' : 50} pt="xl" style={{ width: '100% !important' }}>
                            <AnalysisForm
                                savedAnalysis={savedAnalysis}
                                onSavedAnalysisChange={setSavedAnalysis}
                            />
                        </Tabs.Panel>

                        <Tabs.Panel value="observaciones" p={isMobile ? 'md' : 50} pt="xl" style={{ width: '100% !important' }}>
                            <ObservacionesForm
                                value={observaciones}
                                onChange={setObservaciones}
                            />
                        </Tabs.Panel>
                    </Tabs>

                    <Box px={isMobile ? 'md' : 50} pb={isMobile ? 'md' : 50}>
                        <Divider mb="xl" />
                        <Group justify="flex-end" gap="md">
                            {activeTab === 'antecedentes' && (
                                <Button
                                    size="md"
                                    rightSection={<IconArrowRight size={20} />}
                                    onClick={() => {
                                        setActiveTab('analisis');
                                        scrollToTop();
                                    }}
                                    disabled={!isAntecedentesValid}
                                >
                                    Siguiente
                                </Button>
                            )}

                            {activeTab === 'analisis' && (
                                <>
                                    <Button
                                        variant="outline"
                                        color="gray"
                                        size="md"
                                        leftSection={<IconChevronLeft size={20} />}
                                        onClick={() => setActiveTab('antecedentes')}
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        size="md"
                                        rightSection={<IconArrowRight size={20} />}
                                        onClick={() => {
                                            setActiveTab('observaciones');
                                            scrollToTop();
                                        }}
                                        disabled={savedAnalysis.length === 0}
                                    >
                                        Siguiente
                                    </Button>
                                </>
                            )}

                            {activeTab === 'observaciones' && (
                                <>
                                    <Button
                                        variant="outline"
                                        color="gray"
                                        size="md"
                                        leftSection={<IconChevronLeft size={20} />}
                                        onClick={() => setActiveTab('analisis')}
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        color="green"
                                        size="md"
                                        leftSection={<IconPlus size={20} />}
                                        onClick={handleSave}
                                        disabled={!isAntecedentesValid || savedAnalysis.length === 0 || observaciones.trim().length === 0}
                                    >
                                        Grabar Ficha
                                    </Button>
                                </>
                            )}
                        </Group>
                    </Box>
                </Paper>
            </Stack>
        </Container>
    );
};

const CommercialMenu = ({ onCreate, onConsult, onHistory, onBack }: { onCreate: () => void, onConsult: () => void, onHistory: () => void, onBack: () => void }) => {
    return (
        <Box p="md" style={{ width: '100%' }}>
            <Stack gap="lg">
                <PageHeader 
                    title="Gestión Comercial"
                    onBack={onBack}
                />

                <Paper withBorder p="xl" radius="lg" shadow="sm" style={{ width: '100% !important' }}>
                    <Stack gap="xl">
                        <Text size="lg" c="dimmed" ta="center">
                            Seleccione una opción para comenzar la gestión de fichas comerciales
                        </Text>

                        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl" mt="xl">
                            <ProtectedContent permission="FI_NEW_CREAR">
                                <SelectionCard
                                    title="Nueva Ficha"
                                    description="Crear una nueva solicitud de análisis desde cero, ingresando antecedentes y parámetros."
                                    icon={<IconPlus size={32} />}
                                    color="#228be6"
                                    onClick={onCreate}
                                />
                            </ProtectedContent>

                            <ProtectedContent permission="FI_CONSULTAR">
                                <SelectionCard
                                    title="Consultar Fichas"
                                    description="Buscar, visualizar y gestionar el histórico de fichas comerciales existentes."
                                    icon={<IconTable size={32} />}
                                    color="#7950f2"
                                    onClick={onConsult}
                                />
                            </ProtectedContent>

                            <ProtectedContent permission="MA_COMERCIAL_HISTORIAL_ACCESO">
                                <SelectionCard
                                    title="Muestreos Completados"
                                    description="Histórico de servicios ejecutados y reportes generados. Permite realizar remuestreos."
                                    icon={<IconHistory size={32} />}
                                    color="#15aabf"
                                    onClick={onHistory}
                                />
                            </ProtectedContent>
                        </SimpleGrid>
                    </Stack>
                </Paper>
            </Stack>
        </Box>
    );
};

const ConsultarFichasView = ({ onBackToMenu, onViewDetail }: { onBackToMenu: () => void, onViewDetail: (id: number) => void }) => {
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
    const isMobile = useMediaQuery('(max-width: 768px)');

    const itemsPerPage = 10;

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

    useEffect(() => {
        setCurrentPage(1);
    }, [searchId, dateFrom, dateTo, searchEstado, searchTipo, searchEmpresaFacturar, searchEmpresaServicio, searchCentro, searchObjetivo, searchSubArea, searchUsuario]);

    const getUniqueValues = (key: string) => {
        const values = new Set<string>();
        fichas.forEach(f => {
            if (f[key]) values.add(String(f[key]).trim());
        });
        return Array.from(values).sort().map(val => ({ value: val, label: val }));
    };

    const uniqueEstados = React.useMemo(() => getUniqueValues('estado_ficha'), [fichas]);
    const uniqueTipos = React.useMemo(() => getUniqueValues('tipo_fichaingresoservicio'), [fichas]);
    const uniqueEmpFacturar = React.useMemo(() => getUniqueValues('empresa_facturar'), [fichas]);
    const uniqueEmpServicio = React.useMemo(() => getUniqueValues('empresa_servicio'), [fichas]);
    const uniqueCentros = React.useMemo(() => getUniqueValues('centro'), [fichas]);
    const uniqueObjetivos = React.useMemo(() => getUniqueValues('nombre_objetivomuestreo_ma'), [fichas]);
    const uniqueSubAreas = React.useMemo(() => getUniqueValues('nombre_subarea'), [fichas]);
    const uniqueUsuarios = React.useMemo(() => getUniqueValues('nombre_usuario'), [fichas]);

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
                    title="Consultar Fichas Comerciales"
                    onBack={onBackToMenu}
                />

                <Paper withBorder p="xl" radius="lg" shadow="sm" style={{ width: '100% !important' }}>
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
                                        placeholder="Buscar por ID..."
                                        value={searchId}
                                        onChange={(e) => setSearchId(e.target.value)}
                                        size="xs"
                                    />
                                    <Select
                                        label="Estado"
                                        placeholder="Seleccionar..."
                                        data={uniqueEstados}
                                        value={searchEstado}
                                        onChange={(v) => setSearchEstado(v || '')}
                                        size="xs"
                                        searchable
                                        clearable
                                    />
                                    <TextInput label="Fecha Desde" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} size="xs" />
                                    <TextInput label="Fecha Hasta" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} size="xs" />
                                    <Select label="Tipo" placeholder="Seleccionar..." data={uniqueTipos} value={searchTipo} onChange={(v) => setSearchTipo(v || '')} size="xs" searchable clearable />
                                    <Select label="Empresa" placeholder="Seleccionar..." data={uniqueEmpFacturar} value={searchEmpresaFacturar} onChange={(v) => setSearchEmpresaFacturar(v || '')} size="xs" searchable clearable />
                                    <Select label="E. Servicio" placeholder="Seleccionar..." data={uniqueEmpServicio} value={searchEmpresaServicio} onChange={(v) => setSearchEmpresaServicio(v || '')} size="xs" searchable clearable />
                                    <Select label="Fuente Emisora" placeholder="Seleccionar..." data={uniqueCentros} value={searchCentro} onChange={(v) => setSearchCentro(v || '')} size="xs" searchable clearable />
                                    <Select label="Objetivo" placeholder="Seleccionar..." data={uniqueObjetivos} value={searchObjetivo} onChange={(v) => setSearchObjetivo(v || '')} size="xs" searchable clearable />
                                    <Select label="Sub Área" placeholder="Seleccionar..." data={uniqueSubAreas} value={searchSubArea} onChange={(v) => setSearchSubArea(v || '')} size="xs" searchable clearable />
                                    <Select label="Usuario" placeholder="Seleccionar..." data={uniqueUsuarios} value={searchUsuario} onChange={(v) => setSearchUsuario(v || '')} size="xs" searchable clearable />
                                </SimpleGrid>
                            </Stack>
                        </Paper>

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
                                                        <Table.Td fw={700}>{ficha.fichaingresoservicio || ficha.id_fichaingresoservicio}</Table.Td>
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
                                                                <ProtectedContent permission="FI_EXPORTAR_CFI">
                                                                    <ActionIcon 
                                                                        color="red" 
                                                                        variant="subtle"
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            const pdfBlob = await fichaService.downloadPdf(ficha.id_fichaingresoservicio || ficha.fichaingresoservicio);
                                                                            const url = window.URL.createObjectURL(pdfBlob);
                                                                            const link = document.createElement('a');
                                                                            link.href = url;
                                                                            link.setAttribute('download', `Ficha_${ficha.id_fichaingresoservicio}.pdf`);
                                                                            document.body.appendChild(link);
                                                                            link.click();
                                                                            document.body.removeChild(link);
                                                                        }}
                                                                    >
                                                                        <IconDownload size={18} />
                                                                    </ActionIcon>
                                                                </ProtectedContent>
                                                            )}
                                                        </Table.Td>
                                                        <Table.Td align="center">
                                                            <ProtectedContent permission="FI_VER">
                                                                <ActionIcon 
                                                                    color="blue" 
                                                                    variant="light"
                                                                    onClick={() => onViewDetail(ficha.id_fichaingresoservicio || ficha.fichaingresoservicio)}
                                                                >
                                                                    <IconArrowRight size={18} />
                                                                </ActionIcon>
                                                            </ProtectedContent>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                )
                                            })
                                        )}
                                    </Table.Tbody>
                                </Table>
                            </ScrollArea>
                        </Box>

                        <Group justify="space-between" mt="md" wrap={isMobile ? "wrap" : "nowrap"}>
                            <Text size="xs" c="dimmed">
                                {isMobile ? `${filteredFichas.length} reg.` : `Mostrando ${filteredFichas.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} a ${Math.min(currentPage * itemsPerPage, filteredFichas.length)} de ${filteredFichas.length} registros`}
                            </Text>
                            <Pagination 
                                total={totalPages} 
                                value={currentPage} 
                                onChange={setCurrentPage} 
                                size={isMobile ? "xs" : "sm"}
                                radius="md"
                                siblings={isMobile ? 0 : 1}
                                boundaries={isMobile ? 0 : 1}
                                withEdges={!isMobile}
                            />
                        </Group>
                    </Stack>
                </Paper>
            </Stack>
        </Box>
    );
};

const MuestreosCompletadosView = ({ onBackToMenu, onViewDetail }: { onBackToMenu: () => void, onViewDetail: (id: number, correlativo: string) => void }) => {
    const { hasPermission } = useAuth();
    const [searchId, setSearchId] = useState('');
    const [searchCaso, setSearchCaso] = useState('');
    const [searchCliente, setSearchCliente] = useState('');
    const [searchEstado, setSearchEstado] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [muestreos, setMuestreos] = useState<any[]>([]);

    const itemsPerPage = 10;

    useEffect(() => {
        const loadMuestreos = async () => {
            setLoading(true);
            try {
                const response = await fichaService.getMuestreosEjecutados();
                
                let data: any[] = [];
                if (Array.isArray(response)) data = response;
                else if (response && response.data && Array.isArray(response.data)) data = response.data;
                else if (response && response.recordset && Array.isArray(response.recordset)) data = response.recordset;

                setMuestreos(data || []);
            } catch (error) {
                console.error("Error loading muestreos ejecutados:", error);
                setMuestreos([]);
            } finally {
                setLoading(false);
            }
        };
        loadMuestreos();
    }, []);

    const filteredMuestreos = muestreos.filter(m => {
        const check = (val: string, search: string) => (!search || (val || '').toString().toLowerCase().includes(search.toLowerCase()));
        return check(m.correlativo_ficha, searchId) && 
               check(m.caso_adlab, searchCaso) && 
               check(m.cliente, searchCliente) && 
               check(m.estado_muestreo, searchEstado);
    });

    const totalPages = Math.ceil(filteredMuestreos.length / itemsPerPage);
    const displayedMuestreos = filteredMuestreos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <Box p="md" style={{ width: '100%' }}>
            <Stack gap="lg">
                <PageHeader 
                    title="Muestreos Completados"
                    subtitle="Histórico de servicios ejecutados"
                    onBack={onBackToMenu}
                />

                <Paper withBorder p="xl" radius="lg" shadow="sm">
                    <Stack gap="md">
                        <SimpleGrid cols={{ base: 1, sm: 4 }} spacing="sm">
                            <TextInput
                                label="Ficha"
                                placeholder="Buscar por N° Ficha..."
                                value={searchId}
                                onChange={(e) => setSearchId(e.target.value)}
                                size="xs"
                            />
                            <TextInput
                                label="Caso"
                                placeholder="Buscar por Caso ADL..."
                                value={searchCaso}
                                onChange={(e) => setSearchCaso(e.target.value)}
                                size="xs"
                            />
                            <TextInput
                                label="Cliente"
                                placeholder="Buscar por Cliente..."
                                value={searchCliente}
                                onChange={(e) => setSearchCliente(e.target.value)}
                                size="xs"
                            />
                            <TextInput
                                label="Estado"
                                placeholder="Estado muestreo..."
                                value={searchEstado}
                                onChange={(e) => setSearchEstado(e.target.value)}
                                size="xs"
                            />
                        </SimpleGrid>

                        <ScrollArea h={500} mt="md">
                            <Table verticalSpacing="sm" highlightOnHover striped withTableBorder>
                                <Table.Thead bg="gray.1">
                                    <Table.Tr>
                                        <Table.Th>Ficha</Table.Th>
                                        <Table.Th>Caso ADL</Table.Th>
                                        <Table.Th>Correlativo</Table.Th>
                                        <Table.Th>Fecha</Table.Th>
                                        <Table.Th>Cliente</Table.Th>
                                        <Table.Th>Centro</Table.Th>
                                        <Table.Th>Muestreador</Table.Th>
                                        <Table.Th>Estado</Table.Th>
                                        <Table.Th w={60}>Ver</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {loading ? (
                                        <Table.Tr><Table.Td colSpan={9} align="center">Cargando...</Table.Td></Table.Tr>
                                    ) : displayedMuestreos.length === 0 ? (
                                        <Table.Tr><Table.Td colSpan={9} align="center">Sin registros</Table.Td></Table.Tr>
                                    ) : (
                                        displayedMuestreos.map((m, idx) => (
                                            <Table.Tr key={idx}>
                                                <Table.Td fw={700}>{m.correlativo_ficha}</Table.Td>
                                                <Table.Td fw={600} c="blue">{m.caso_adlab}</Table.Td>
                                                <Table.Td fz="xs">{m.frecuencia_correlativo}</Table.Td>
                                                <Table.Td fz="xs">
                                                    {m.fecha_muestreo ? new Date(m.fecha_muestreo).toLocaleDateString('es-CL') : 'S/F'}
                                                </Table.Td>
                                                <Table.Td fz="xs">{m.cliente}</Table.Td>
                                                <Table.Td fz="xs">{m.centro}</Table.Td>
                                                <Table.Td fz="xs">{m.muestreador || 'S/M'}</Table.Td>
                                                <Table.Td>
                                                    <Badge color="green" variant="light" size="sm">{m.estado_muestreo}</Badge>
                                                </Table.Td>
                                                <Table.Td>
                                                    <ProtectedContent permission={['MA_COMERCIAL_HISTORIAL_DETALLE', 'FI_VER']}>
                                                        <ActionIcon 
                                                            color="blue" 
                                                            variant="light"
                                                            onClick={() => onViewDetail(m.id_fichaingresoservicio, m.frecuencia_correlativo)}
                                                        >
                                                            <IconArrowRight size={18} />
                                                        </ActionIcon>
                                                    </ProtectedContent>
                                                </Table.Td>
                                            </Table.Tr>
                                        ))
                                    )}
                                </Table.Tbody>
                            </Table>
                        </ScrollArea>

                        <Group justify="space-between" mt="md">
                            <Text size="xs" c="dimmed">Mostrando {displayedMuestreos.length} de {filteredMuestreos.length} registros</Text>
                            <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} size="sm" radius="md" />
                        </Group>
                    </Stack>
                </Paper>
            </Stack>
        </Box>
    );
};

const ComercialPageContent: React.FC<Props> = ({ onBack }) => {
    const { hasPermission, user } = useAuth();
    const { 
        maComercialMode: viewMode, 
        setMaComercialMode: setViewMode,
        setSelectedFicha,
        setActiveSubmodule,
        pendingRequestId,
        setPendingRequestId
    } = useNavStore();
    
    const [selectedFichaId, setSelectedFichaId] = useState<number | null>(null);

    // 1. Navegación Automática por Permisos
    useEffect(() => {
        if (!user || viewMode !== 'menu') return;

        const canCreate = hasPermission('FI_NEW_CREAR');
        const canConsult = hasPermission('FI_CONSULTAR');
        const canHistory = hasPermission('MA_COMERCIAL_HISTORIAL_ACCESO');

        // Si SOLO tiene permiso para crear, ir directo
        if (canCreate && !canConsult && !canHistory) {
            setViewMode('create');
        }
        // Si SOLO tiene permiso para consultar (o si no puede crear pero sí consultar), ir directo
        else if (canConsult && !canCreate && !canHistory) {
            setViewMode('consult');
        }
        // Si SOLO tiene permiso para el historial
        else if (canHistory && !canCreate && !canConsult) {
            setViewMode('history');
        }
    }, [viewMode, setViewMode, user, hasPermission]);

    // 2. Navegación por Request pendiente (Notificaciones)
    useEffect(() => {
        if (pendingRequestId && (viewMode === 'menu' || viewMode === 'consult' || viewMode === 'history')) {
            setSelectedFichaId(pendingRequestId);
            setSelectedFicha(pendingRequestId, null);
            setViewMode('detail');
            setPendingRequestId(null);
        }
    }, [pendingRequestId, viewMode, setPendingRequestId, setSelectedFicha]);

    const handleViewDetail = (id: number) => {
        setSelectedFichaId(id);
        setSelectedFicha(id, null);
        setViewMode('detail');
    };

    const handleViewExecutionDetail = (id: number, correlativo: string) => {
        setSelectedFicha(id, correlativo);
        setActiveSubmodule('ma-ficha-detalle'); // This is the correct ID used in DashboardPage.tsx
    };

    if (viewMode === 'menu') {
        return (
            <CommercialMenu
                onCreate={() => setViewMode('create')}
                onConsult={() => setViewMode('consult')}
                onHistory={() => setViewMode('history')}
                onBack={onBack}
            />
        );
    }

    if (viewMode === 'create') {
        return <CommercialForm onBackToMenu={() => setViewMode('menu')} />;
    }

    if (viewMode === 'history') {
        return (
            <MuestreosCompletadosView
                onBackToMenu={() => setViewMode('menu')}
                onViewDetail={handleViewExecutionDetail}
            />
        );
    }

    if (viewMode === 'consult') {
        return (
            <ConsultarFichasView
                onBackToMenu={() => setViewMode('menu')}
                onViewDetail={handleViewDetail}
            />
        );
    }

    if (viewMode === 'detail' && selectedFichaId) {
        return (
            <CommercialDetailView
                fichaId={selectedFichaId}
                onBack={() => setViewMode('consult')}
            />
        );
    }

    return null;
};

export const ComercialPage: React.FC<Props> = (props) => {
    return (
        <ToastProvider>
            <CatalogosProvider>
                <ComercialPageContent {...props} />
            </CatalogosProvider>
            <ToastContainer />
        </ToastProvider>
    );
};
