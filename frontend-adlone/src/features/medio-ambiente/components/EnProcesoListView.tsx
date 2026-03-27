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
    Badge, 
    Group, 
    ActionIcon, 
    Tooltip,
    ScrollArea,
    Text,
    Pagination,
    Center,
    Loader,
    Divider,
    Box
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { 
    IconSearch, 
    IconEraser, 
    IconEdit,
    IconFilter,
    IconClockPlay
} from '@tabler/icons-react';

interface Props {
    onBackToMenu: () => void;
    onViewDetail: (id: number) => void;
}

export const EnProcesoListView: React.FC<Props> = ({ onBackToMenu, onViewDetail }) => {
    // State
    const [searchId, setSearchId] = useState('');
    const [dateFrom, setDateFrom] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [dateTo, setDateTo] = useState(() => {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    });
    const { showToast } = useToast();
    const isMobile = useMediaQuery('(max-width: 768px)');

    const [searchTipo, setSearchTipo] = useState<string | null>(null);
    const [searchEmpresaServicio, setSearchEmpresaServicio] = useState<string | null>(null);
    const [searchMuestreador, setSearchMuestreador] = useState<string | null>(null);
    const [searchObjetivo, setSearchObjetivo] = useState<string | null>(null);
    const [searchSubArea, setSearchSubArea] = useState<string | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [fichas, setFichas] = useState<any[]>([]);

    const itemsPerPage = 12;

    useEffect(() => {
        loadFichas();
    }, []);

    const loadFichas = async () => {
        setLoading(true);
        try {
            const response = await fichaService.getEnProceso();
            let data = [];
            if (Array.isArray(response)) data = response;
            else if (response && response.data && Array.isArray(response.data)) data = response.data;
            else if (response && Array.isArray(response.recordset)) data = response.recordset;

            setFichas(data || []);
        } catch (error) {
            console.error("Error loading en proceso fichas:", error);
            showToast({ type: 'error', message: 'Error cargando las fichas en proceso.' });
        } finally {
            setLoading(false);
        }
    };

    const getUniqueValues = (key: string) => {
        const values = new Set<string>();
        fichas.forEach(f => {
            if (f[key]) values.add(String(f[key]).trim());
        });
        return Array.from(values).sort().map(v => ({ value: v, label: v }));
    };

    const uniqueTipos = useMemo(() => getUniqueValues('tipo_ficha'), [fichas]);
    const uniqueEmpServicio = useMemo(() => getUniqueValues('empresa_servicio'), [fichas]);
    const uniqueMuestreadores = useMemo(() => getUniqueValues('muestreador'), [fichas]);
    const uniqueObjetivos = useMemo(() => getUniqueValues('objetivo'), [fichas]);
    const uniqueSubAreas = useMemo(() => getUniqueValues('subarea'), [fichas]);

    const handleClearFilters = () => {
        setSearchId('');
        setDateFrom('');
        setDateTo('');
        setSearchTipo(null);
        setSearchEmpresaServicio(null);
        setSearchMuestreador(null);
        setSearchObjetivo(null);
        setSearchSubArea(null);
        setCurrentPage(1);
    };

    const filteredFichas = useMemo(() => {
        return fichas.filter(f => {
            const displayId = f.correlativo || f.id || f.fichaingresoservicio || '';
            const matchId = searchId ? String(displayId).includes(searchId) : true;

            const check = (val: string, search: string | null) => {
                if (!search) return true;
                return (val || '').toString().toLowerCase().includes(search.toLowerCase());
            };

            const matchTipo = check(f.tipo_ficha, searchTipo);
            const matchEmpresaServicio = check(f.empresa_servicio, searchEmpresaServicio);
            const matchMuestreador = check(f.muestreador, searchMuestreador);
            const matchObjetivo = check(f.objetivo, searchObjetivo);
            const matchSubArea = check(f.subarea, searchSubArea);

            let matchDate = true;
            if (dateFrom || dateTo) {
                if (!f.fecha) return false;
                let rowDate: Date;
                if (typeof f.fecha === 'string' && f.fecha.includes('/')) {
                    const parts = f.fecha.split('/');
                    rowDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                } else {
                    rowDate = new Date(f.fecha);
                }
                rowDate.setHours(0, 0, 0, 0);

                if (dateFrom && rowDate < new Date(dateFrom)) matchDate = false;
                if (dateTo && rowDate > new Date(dateTo)) matchDate = false;
            }

            return matchId && matchDate && matchTipo && matchEmpresaServicio && matchMuestreador && matchObjetivo && matchSubArea;
        });
    }, [fichas, searchId, dateFrom, dateTo, searchTipo, searchEmpresaServicio, searchMuestreador, searchObjetivo, searchSubArea]);

    const sortedFichas = useMemo(() => {
        return [...filteredFichas].sort((a, b) => {
            const dateA = a.fecha ? new Date(a.fecha).getTime() : 0;
            const dateB = b.fecha ? new Date(b.fecha).getTime() : 0;
            return dateB - dateA;
        });
    }, [filteredFichas]);

    const totalPages = Math.ceil(sortedFichas.length / itemsPerPage) || 1;
    const displayedFichas = sortedFichas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <Box p="md" style={{ width: '100%' }}>
            <Stack gap="lg">
                <PageHeader 
                    title="Fichas en Proceso" 
                    subtitle="Seguimiento de servicios programados y en ejecución"
                    onBack={onBackToMenu}
                    rightSection={
                        <Group gap="xs" wrap={isMobile ? "wrap" : "nowrap"}>
                            <Text size="xs" fw={500} c="dimmed">{filteredFichas.length} registros</Text>
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
                        <SimpleGrid cols={{ base: 1, sm: 3, md: 4, lg: 6 }} spacing="sm">
                            <TextInput 
                                label="N° Ficha" 
                                placeholder="Eje: 1234" 
                                value={searchId} 
                                onChange={(e) => setSearchId(e.target.value)} 
                                size="xs"
                                leftSection={<IconSearch size={14} />}
                            />
                            <TextInput 
                                label="Desde" 
                                type="date" 
                                value={dateFrom} 
                                onChange={(e) => setDateFrom(e.target.value)} 
                                size="xs"
                            />
                            <TextInput 
                                label="Hasta" 
                                type="date" 
                                value={dateTo} 
                                onChange={(e) => setDateTo(e.target.value)} 
                                size="xs"
                            />
                            <Select 
                                label="Tipo Ficha" 
                                placeholder="Todos" 
                                data={uniqueTipos} 
                                value={searchTipo} 
                                onChange={setSearchTipo} 
                                searchable 
                                size="xs"
                                clearable
                            />
                            <Select 
                                label="Empresa Servicio" 
                                placeholder="Todos" 
                                data={uniqueEmpServicio} 
                                value={searchEmpresaServicio} 
                                onChange={setSearchEmpresaServicio} 
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
                            <Select 
                                label="Sub Área" 
                                placeholder="Todos" 
                                data={uniqueSubAreas} 
                                value={searchSubArea} 
                                onChange={setSearchSubArea} 
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
                                    <Text size="sm" c="dimmed">Cargando fichas en proceso...</Text>
                                </Stack>
                            </Center>
                        ) : (
                            <Table striped highlightOnHover withTableBorder={false} verticalSpacing="xs">
                                <Table.Thead bg="gray.1">
                                    <Table.Tr>
                                        <Table.Th w={100}>N° Ficha</Table.Th>
                                        <Table.Th w={120}>Fecha M.</Table.Th>
                                        <Table.Th>Muestreador</Table.Th>
                                        <Table.Th w={120}>Tipo</Table.Th>
                                        <Table.Th>Empresa Srv.</Table.Th>
                                        <Table.Th>Contacto</Table.Th>
                                        <Table.Th>Objetivo</Table.Th>
                                        <Table.Th w={100}>Sub Área</Table.Th>
                                        <Table.Th ta="center" w={80}>Gesti.</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {displayedFichas.map((ficha) => (
                                        <Table.Tr key={`${ficha.id}-${ficha.correlativo}`}>
                                            <Table.Td fw={700} c="emerald.8">{ficha.correlativo || ficha.id || '-'}</Table.Td>
                                            <Table.Td>
                                                <Text size="xs" fw={500}>
                                                    {ficha.fecha ? new Date(ficha.fecha).toLocaleDateString('es-ES') : 'Sin Fecha'}
                                                </Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap="xs">
                                                    <IconClockPlay size={14} color="var(--mantine-color-blue-6)" />
                                                    <Text size="xs" fw={500}>{ficha.muestreador || 'Por Asignar'}</Text>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge variant="dot" size="sm" color="blue">{ficha.tipo_ficha || '-'}</Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                <Stack gap={0}>
                                                    <Text size="xs" fw={500} truncate title={ficha.empresa_servicio}>{ficha.empresa_servicio || '-'}</Text>
                                                    {ficha.correo_empresa && <Text size="10px" c="dimmed">{ficha.correo_empresa}</Text>}
                                                </Stack>
                                            </Table.Td>
                                            <Table.Td>
                                                <Stack gap={0}>
                                                    <Text size="xs" fw={500} truncate title={ficha.contacto}>{ficha.contacto || '-'}</Text>
                                                    {ficha.correo_contacto && <Text size="10px" c="dimmed">{ficha.correo_contacto}</Text>}
                                                </Stack>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="xs" truncate title={ficha.objetivo}>{ficha.objetivo || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="xs">{ficha.subarea || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td ta="center">
                                                <Tooltip label="Gestionar Ficha">
                                                    <ActionIcon 
                                                        color="emerald" 
                                                        variant="filled" 
                                                        onClick={() => onViewDetail(ficha.id)}
                                                    >
                                                        <IconEdit size={18} />
                                                    </ActionIcon>
                                                </Tooltip>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                    {displayedFichas.length === 0 && (
                                        <Table.Tr>
                                            <Table.Td colSpan={9} ta="center" py="xl">
                                                <Text c="dimmed">No se encontraron fichas en proceso.</Text>
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
                            size={isMobile ? "xs" : "sm"}
                            siblings={isMobile ? 0 : 1}
                            boundaries={isMobile ? 0 : 1}
                            withEdges={!isMobile}
                        />
                    </Center>
                </Paper>
            </Stack>
        </Box>
    );
};
