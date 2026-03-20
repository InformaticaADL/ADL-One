import React, { useState, useEffect, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { 
    Container, 
    Stack, 
    Paper, 
    SimpleGrid, 
    TextInput, 
    Select, 
    Button, 
    Table, 
    Group, 
    ActionIcon, 
    Tooltip,
    ScrollArea,
    Text,
    Pagination,
    Center,
    Loader,
    Divider
} from '@mantine/core';
import { 
    IconSearch, 
    IconEraser, 
    IconFileDescription, 
    IconChartBar,
    IconPhoto,
    IconSend,
    IconFilter,
    IconCheck
} from '@tabler/icons-react';

interface Props {
    onBackToMenu: () => void;
    onViewDetail: (id: number) => void;
}

export const MuestreosEjecutadosListView: React.FC<Props> = ({ onBackToMenu, onViewDetail }) => {
    const { showToast } = useToast();
    const [muestreos, setMuestreos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchCorrelativo, setSearchCorrelativo] = useState('');
    const [searchCliente, setSearchCliente] = useState<string | null>(null);
    const [searchMuestreador, setSearchMuestreador] = useState<string | null>(null);
    const [searchObjetivo, setSearchObjetivo] = useState<string | null>(null);
    
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    useEffect(() => {
        loadMuestreos();
    }, []);

    const loadMuestreos = async () => {
        setLoading(true);
        try {
            const response = await fichaService.getMuestreosEjecutados();
            let data = [];
            if (Array.isArray(response)) data = response;
            else if (response && response.data && Array.isArray(response.data)) data = response.data;
            else if (response && Array.isArray(response.recordset)) data = response.recordset;

            setMuestreos(data || []);
        } catch (error) {
            console.error("Error loading muestreos ejecutados:", error);
            showToast({ type: 'error', message: "Error al cargar los muestreos ejecutados" });
        } finally {
            setLoading(false);
        }
    };

    const getUniqueValues = (key: string) => {
        const values = new Set<string>();
        muestreos.forEach(m => {
            if (m[key]) values.add(String(m[key]).trim());
        });
        return Array.from(values).sort().map(v => ({ value: v, label: v }));
    };

    const uniqueClientes = useMemo(() => getUniqueValues('cliente'), [muestreos]);
    const uniqueMuestreadores = useMemo(() => getUniqueValues('muestreador'), [muestreos]);
    const uniqueObjetivos = useMemo(() => getUniqueValues('objetivo'), [muestreos]);

    const handleClearFilters = () => {
        setSearchCorrelativo('');
        setSearchCliente(null);
        setSearchMuestreador(null);
        setSearchObjetivo(null);
        setCurrentPage(1);
    };

    const filteredMuestreos = useMemo(() => {
        return muestreos.filter(m => {
            const check = (val: string, search: string | null) => {
                if (!search) return true;
                return (val || '').toString().toLowerCase().includes(search.toLowerCase());
            };
            const matchCorr = check(m.frecuencia_correlativo, searchCorrelativo);
            const matchCliente = check(m.cliente, searchCliente);
            const matchMues = check(m.muestreador, searchMuestreador);
            const matchObj = check(m.objetivo, searchObjetivo);

            return matchCorr && matchCliente && matchMues && matchObj;
        });
    }, [muestreos, searchCorrelativo, searchCliente, searchMuestreador, searchObjetivo]);

    const sortedMuestreos = useMemo(() => {
        return [...filteredMuestreos].sort((a, b) => {
            const dateA = a.fecha_muestreo ? new Date(a.fecha_muestreo).getTime() : 0;
            const dateB = b.fecha_muestreo ? new Date(b.fecha_muestreo).getTime() : 0;
            return dateB - dateA;
        });
    }, [filteredMuestreos]);

    const totalPages = Math.ceil(sortedMuestreos.length / itemsPerPage) || 1;
    const displayedMuestreos = sortedMuestreos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleDownloadPdf = async (idFicha: number) => {
        try {
            if (!idFicha) {
                showToast({ type: 'error', message: "No se pudo obtener el ID de la ficha" });
                return;
            }
            showToast({ type: 'info', message: "Generando reporte PDF..." });
            const pdfBlob = await fichaService.downloadPdf(idFicha);
            const url = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Ficha_${idFicha}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error al descargar PDF:", error);
            showToast({ type: 'error', message: "Error al descargar el PDF" });
        }
    };

    const handleComingSoon = (feature: string) => {
        showToast({ type: 'info', message: `${feature}: Funcionalidad próximamente disponible` });
    };

    return (
        <Container fluid p="md">
            <Stack gap="lg">
                <PageHeader 
                    title="Muestreos Completados" 
                    subtitle="Histórico de servicios ejecutados y reportes generados"
                    onBack={onBackToMenu}
                    rightSection={
                        <Group gap="xs">
                            <Text size="sm" fw={500} c="dimmed">{filteredMuestreos.length} servicios registrados</Text>
                            <Button variant="light" color="gray" leftSection={<IconEraser size={16} />} onClick={handleClearFilters}>
                                Limpiar Filtros
                            </Button>
                        </Group>
                    }
                />

                <Paper withBorder p="md" radius="md" shadow="xs">
                    <Stack gap="md">
                        <Group gap="xs" align="center">
                            <IconFilter size={18} color="var(--mantine-color-blue-6)" />
                            <Text fw={700} size="sm" c="blue.7">Filtros de Búsqueda</Text>
                        </Group>
                        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
                            <TextInput 
                                label="Correlativo" 
                                placeholder="Eje: 99-1..." 
                                value={searchCorrelativo} 
                                onChange={(e) => setSearchCorrelativo(e.target.value)} 
                                size="xs"
                                leftSection={<IconSearch size={14} />}
                            />
                            <Select 
                                label="Cliente" 
                                placeholder="Todos" 
                                data={uniqueClientes} 
                                value={searchCliente} 
                                onChange={setSearchCliente} 
                                searchable 
                                size="xs"
                                clearable
                            />
                            <Select 
                                label="Muestreador" 
                                placeholder="Todos" 
                                data={uniqueMuestreadores} 
                                value={searchMuestreador} 
                                onChange={setSearchMuestreador} 
                                searchable 
                                size="xs"
                                clearable
                            />
                            <Select 
                                label="Objetivo" 
                                placeholder="Todos" 
                                data={uniqueObjetivos} 
                                value={searchObjetivo} 
                                onChange={setSearchObjetivo} 
                                searchable 
                                size="xs"
                                clearable
                            />
                        </SimpleGrid>
                    </Stack>
                </Paper>

                <Paper withBorder radius="md" p={0} shadow="sm" style={{ overflow: 'hidden' }}>
                    <ScrollArea h="auto">
                        {loading ? (
                            <Center p="xl">
                                <Stack align="center" gap="xs">
                                    <Loader size="lg" />
                                    <Text size="sm" c="dimmed">Cargando registros históricos...</Text>
                                </Stack>
                            </Center>
                        ) : (
                            <Table striped highlightOnHover withTableBorder={false} verticalSpacing="xs">
                                <Table.Thead bg="gray.1">
                                    <Table.Tr>
                                        <Table.Th w={180}>Correlativo</Table.Th>
                                        <Table.Th w={120}>Fecha M.</Table.Th>
                                        <Table.Th>Cliente</Table.Th>
                                        <Table.Th>Fuente Emisora</Table.Th>
                                        <Table.Th>Área / Objetivo</Table.Th>
                                        <Table.Th>Muestreador</Table.Th>
                                        <Table.Th ta="center" w={250}>Acciones</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {displayedMuestreos.map((m, idx) => (
                                        <Table.Tr key={`${m.correlativo_ficha || m.id_fichaingresoservicio}-${idx}`}>
                                            <Table.Td>
                                                <Group gap={5}>
                                                    <IconCheck size={14} color="var(--mantine-color-green-6)" />
                                                    <Text size="xs" fw={700} truncate title={m.frecuencia_correlativo}>
                                                        {m.frecuencia_correlativo || '-'}
                                                    </Text>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="xs">
                                                    {m.fecha_muestreo ? new Date(m.fecha_muestreo).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : '-'}
                                                </Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="xs" truncate title={m.cliente}>{m.cliente || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="xs" truncate title={m.centro}>{m.centro || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Stack gap={0}>
                                                    <Text size="xs" fw={500}>{m.nombre_subarea || '-'}</Text>
                                                    <Text size="10px" c="dimmed">{m.objetivo || '-'}</Text>
                                                </Stack>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="xs">{m.muestreador || 'Sin Asignar'}</Text>
                                            </Table.Td>
                                            <Table.Td ta="center">
                                                <Group gap={5} justify="center">
                                                    <Tooltip label="Ver Ficha">
                                                        <Button 
                                                            variant="light" 
                                                            color="gray" 
                                                            size="compact-xs" 
                                                            leftSection={<IconChartBar size={14} />}
                                                            onClick={() => onViewDetail(m.id_fichaingresoservicio || m.correlativo_ficha)}
                                                        >
                                                            Datos
                                                        </Button>
                                                    </Tooltip>
                                                    <Tooltip label="Descargar Informe">
                                                        <Button 
                                                            variant="light" 
                                                            color="red" 
                                                            size="compact-xs" 
                                                            leftSection={<IconFileDescription size={14} />}
                                                            onClick={() => handleDownloadPdf(m.id_fichaingresoservicio || m.correlativo_ficha)}
                                                        >
                                                            Informe
                                                        </Button>
                                                    </Tooltip>
                                                    <ActionIcon 
                                                        variant="subtle" 
                                                        color="gray" 
                                                        onClick={() => handleComingSoon("Fotos")}
                                                        title="Ver Fotos"
                                                    >
                                                        <IconPhoto size={16} />
                                                    </ActionIcon>
                                                    <ActionIcon 
                                                        variant="subtle" 
                                                        color="gray" 
                                                        onClick={() => handleComingSoon("Detalles de Envío")}
                                                        title="Historial de Envío"
                                                    >
                                                        <IconSend size={16} />
                                                    </ActionIcon>
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                    {displayedMuestreos.length === 0 && (
                                        <Table.Tr>
                                            <Table.Td colSpan={7} ta="center" py="xl">
                                                <Text c="dimmed">No se encontraron muestreos ejecutados.</Text>
                                            </Table.Td>
                                        </Table.Tr>
                                    )}
                                </Table.Tbody>
                            </Table>
                        )}
                    </ScrollArea>
                    
                    <Divider />
                    
                    <Center p="md">
                        <Pagination 
                            total={totalPages} 
                            value={currentPage} 
                            onChange={setCurrentPage} 
                            radius="md" 
                            size="sm"
                            withEdges
                        />
                    </Center>
                </Paper>
            </Stack>
        </Container>
    );
};
