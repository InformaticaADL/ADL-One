import React, { useState, useEffect, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { 
    Stack, 
    Paper, 
    SimpleGrid, 
    TextInput, 
    Select, 
    Button, 
    Table, 
    Group, 
    ScrollArea,
    Text,
    Pagination,
    Center,
    Loader,
    Divider,
    Tooltip,
    ActionIcon,
    Box
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { 
    IconSearch,
    IconEraser, 
    IconFilter,
    IconExternalLink
} from '@tabler/icons-react';

import { useNavStore } from '../../../store/navStore';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';

interface Props {
    onBackToMenu: () => void;
}

export const MuestreosEjecutadosListView: React.FC<Props> = ({ onBackToMenu }) => {
    const { setSelectedFicha, setActiveSubmodule } = useNavStore();
    const { showToast } = useToast();
    const [muestreos, setMuestreos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const isMobile = useMediaQuery('(max-width: 768px)');

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
            const matchCorr = check(m.frecuencia_correlativo, searchCorrelativo) || check(m.caso_adlab, searchCorrelativo);
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


    return (
        <Box p="md" style={{ width: '100%' }}>
            <Stack gap="lg">
                <PageHeader 
                    title="Muestreos Completados" 
                    subtitle="Histórico de servicios ejecutados y reportes generados"
                    onBack={onBackToMenu}
                    rightSection={
                        <Group gap="xs" wrap={isMobile ? "wrap" : "nowrap"}>
                            <Text size="xs" fw={500} c="dimmed">{filteredMuestreos.length} servicios registrados</Text>
                            <Button variant="light" color="gray" size="xs" leftSection={<IconEraser size={14} />} onClick={handleClearFilters}>
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
                                label="Correlativo / ID Caso" 
                                placeholder="Eje: 99-1 o ID Caso..." 
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
                            <Table striped highlightOnHover withTableBorder={false} verticalSpacing="xs" miw={1400}>
                                <Table.Thead bg="gray.1">
                                    <Table.Tr>
                                        <Table.Th w={80} style={{ whiteSpace: 'nowrap' }}>ID Caso</Table.Th>
                                        <Table.Th w={150} style={{ whiteSpace: 'nowrap' }}>Correlativo</Table.Th>
                                        <Table.Th w={110} style={{ whiteSpace: 'nowrap' }}>Fecha M.</Table.Th>
                                        <Table.Th miw={200}>Cliente</Table.Th>
                                        <Table.Th miw={200}>Fuente Emisora</Table.Th>
                                        <Table.Th miw={180}>Área / Objetivo</Table.Th>
                                        <Table.Th miw={150}>M. Inst.</Table.Th>
                                        <Table.Th miw={150}>M. Ret.</Table.Th>
                                        <Table.Th ta="center" w={80}>Acciones</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {displayedMuestreos.map((m, idx) => (
                                        <Table.Tr key={`${m.id_agendamam || m.correlativo_ficha || m.id_fichaingresoservicio}-${idx}`}>
                                            <Table.Td style={{ whiteSpace: 'nowrap' }}>
                                                <Text size="xs" fw={700} c="blue.7">{m.caso_adlab || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td style={{ whiteSpace: 'nowrap' }}>
                                                <Text size="xs" fw={600} truncate title={m.frecuencia_correlativo}>
                                                    {m.frecuencia_correlativo || '-'}
                                                </Text>
                                            </Table.Td>
                                            <Table.Td style={{ whiteSpace: 'nowrap' }}>
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
                                            <Table.Td style={{ whiteSpace: 'nowrap' }}>
                                                <Text size="xs">{m.muestreador || 'Sin Asignar'}</Text>
                                            </Table.Td>
                                            <Table.Td style={{ whiteSpace: 'nowrap' }}>
                                                <Text size="xs">{m.muestreador_retiro || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td ta="center">
                                                <ProtectedContent permission={['MA_COMERCIAL_HISTORIAL_DETALLE', 'FI_VER']}>
                                                    <Tooltip label="Ver Detalle Ejecución">
                                                        <ActionIcon 
                                                            variant="light" 
                                                            color="blue" 
                                                            onClick={() => {
                                                                setSelectedFicha(
                                                                    m.id_fichaingresoservicio || m.correlativo_ficha,
                                                                    m.frecuencia_correlativo
                                                                );
                                                                setActiveSubmodule('ma-ficha-detalle');
                                                            }}
                                                        >
                                                            <IconExternalLink size={16} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                </ProtectedContent>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                    {displayedMuestreos.length === 0 && (
                                        <Table.Tr>
                                            <Table.Td colSpan={9} ta="center" py="xl">
                                                <Text c="dimmed">No se encontraron muestreos ejecutados.</Text>
                                            </Table.Td>
                                        </Table.Tr>
                                    )}
                                </Table.Tbody>
                            </Table>
                        )}
                    </ScrollArea>
                    <Divider />
                    <Group justify="space-between" p="md">
                        <Text size="sm" c="dimmed">Mostrando {displayedMuestreos.length} de {filteredMuestreos.length} registros</Text>
                        <Pagination 
                            total={totalPages} 
                            value={currentPage} 
                            onChange={setCurrentPage} 
                            radius="md" 
                            size={isMobile ? "xs" : "sm"}
                            siblings={isMobile ? 0 : 1}
                            boundaries={isMobile ? 0 : 1}
                            withEdges={!isMobile}
                        />
                    </Group>
                </Paper>
            </Stack>
        </Box>
    );
};
