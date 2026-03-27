import React, { useState, useEffect, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { 
    Box, 
    Stack, 
    Paper, 
    SimpleGrid, 
    TextInput, 
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
    Divider
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { 
    IconSearch, 
    IconEraser, 
    IconFileDownload, 
    IconEye,
    IconFilter
} from '@tabler/icons-react';

interface Props {
    onBackToMenu: () => void;
    onViewDetail: (id: number) => void;
}

export const CoordinationListView: React.FC<Props> = ({ onBackToMenu, onViewDetail }) => {
    // State
    const [searchId, setSearchId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [fichas, setFichas] = useState<any[]>([]);
    const isMobile = useMediaQuery('(max-width: 768px)');

    const itemsPerPage = 15;

    useEffect(() => {
        loadFichas();
    }, []);

    const loadFichas = async () => {
        setLoading(true);
        try {
            const response = await fichaService.getAll();
            let data = [];
            if (Array.isArray(response)) data = response;
            else if (response && response.data && Array.isArray(response.data)) data = response.data;
            else if (response && Array.isArray(response.recordset)) data = response.recordset;

            setFichas(data || []);
        } catch (error) {
            console.error("Error loading coordination fichas:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = () => {
        setSearchId('');
        setDateFrom('');
        setDateTo('');
        setCurrentPage(1);
    };

    const handleDownloadPdf = async (id: number) => {
        try {
            const blob = await fichaService.downloadPdf(id);
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Ficha_${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (error) {
            console.error("Error downloading PDF:", error);
        }
    };

    const filteredFichas = useMemo(() => {
        return fichas.filter(f => {
            const displayId = f.fichaingresoservicio || f.id_fichaingresoservicio || '';
            const matchId = searchId ? String(displayId).includes(searchId) : true;

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

            return matchId && matchDate;
        });
    }, [fichas, searchId, dateFrom, dateTo]);

    const sortedFichas = useMemo(() => {
        return [...filteredFichas].sort((a, b) => {
            return (b.id_fichaingresoservicio || 0) - (a.id_fichaingresoservicio || 0);
        });
    }, [filteredFichas]);

    const totalPages = Math.ceil(sortedFichas.length / itemsPerPage) || 1;
    const displayedFichas = sortedFichas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getStatusBadge = (status: string) => {
        const s = (status || '').toUpperCase();
        let color = 'gray';
        if (s.includes('BORRADOR')) color = 'gray';
        else if (s.includes('EMITIDA') || s.includes('VIGENTE') || s.includes('APROBADA')) color = 'green';
        else if (s.includes('RECHAZADA') || s.includes('ANULADA')) color = 'red';
        else if (s.includes('PENDIENTE')) color = 'yellow';

        return (
            <Badge color={color} variant="light" size="sm">
                {status || '-'}
            </Badge>
        );
    };

    return (
        <Box p="md" style={{ width: '100%' }}>
            <Stack gap="lg">
                <PageHeader 
                    title="Bandeja de Coordinación" 
                    subtitle="Consulta y seguimiento general de fichas de servicio"
                    onBack={onBackToMenu}
                    rightSection={
                        <Group gap="xs" wrap={isMobile ? "wrap" : "nowrap"}>
                            <Text size="xs" fw={500} c="dimmed">{filteredFichas.length} fichas encontradas</Text>
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
                        <SimpleGrid cols={{ base: 1, sm: 3, md: 4 }} spacing="sm">
                            <TextInput 
                                label="N° Ficha" 
                                placeholder="Eje: 105" 
                                value={searchId} 
                                onChange={(e) => setSearchId(e.target.value)} 
                                size="xs"
                                leftSection={<IconSearch size={14} />}
                            />
                            <TextInput 
                                label="Fecha Desde" 
                                type="date" 
                                value={dateFrom} 
                                onChange={(e) => setDateFrom(e.target.value)} 
                                size="xs"
                            />
                            <TextInput 
                                label="Fecha Hasta" 
                                type="date" 
                                value={dateTo} 
                                onChange={(e) => setDateTo(e.target.value)} 
                                size="xs"
                            />
                        </SimpleGrid>
                    </Stack>
                </Paper>

                <Paper withBorder radius="md" p={0} shadow="sm" style={{ overflow: 'hidden' }}>
                    <ScrollArea h={600}>
                        {loading ? (
                            <Center p="xl">
                                <Stack align="center" gap="xs">
                                    <Loader size="lg" />
                                    <Text size="sm" c="dimmed">Cargando bandeja de coordinación...</Text>
                                </Stack>
                            </Center>
                        ) : (
                            <Table striped highlightOnHover withTableBorder={false} verticalSpacing="xs">
                                <Table.Thead bg="gray.1">
                                    <Table.Tr>
                                        <Table.Th w={100}>N° Ficha</Table.Th>
                                        <Table.Th w={150}>Estado</Table.Th>
                                        <Table.Th w={120}>Fecha</Table.Th>
                                        <Table.Th w={120}>Tipo</Table.Th>
                                        <Table.Th>E. Facturar</Table.Th>
                                        <Table.Th>E. Servicio</Table.Th>
                                        <Table.Th>Fuente Emisora</Table.Th>
                                        <Table.Th>Objetivo</Table.Th>
                                        <Table.Th>Sub Área</Table.Th>
                                        <Table.Th ta="center" w={60}>PDF</Table.Th>
                                        <Table.Th ta="center" w={60}>Acc.</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {displayedFichas.map((ficha) => (
                                        <Table.Tr key={ficha.id_fichaingresoservicio || ficha.fichaingresoservicio}>
                                            <Table.Td fw={700} c="blue.8">{ficha.fichaingresoservicio || '-'}</Table.Td>
                                            <Table.Td>{getStatusBadge(ficha.estado_ficha)}</Table.Td>
                                            <Table.Td fz="xs">{ficha.fecha || '-'}</Table.Td>
                                            <Table.Td fz="xs">{ficha.tipo_fichaingresoservicio || '-'}</Table.Td>
                                            <Table.Td>
                                                <Text size="xs" truncate title={ficha.empresa_facturar}>{ficha.empresa_facturar || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="xs" truncate title={ficha.empresa_servicio}>{ficha.empresa_servicio || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="xs" truncate title={ficha.centro}>{ficha.centro || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="xs" truncate title={ficha.nombre_objetivomuestreo_ma}>{ficha.nombre_objetivomuestreo_ma || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="xs" truncate title={ficha.nombre_subarea}>{ficha.nombre_subarea || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td ta="center">
                                                <Tooltip label="Descargar PDF">
                                                    <ActionIcon 
                                                        color="red" 
                                                        variant="light" 
                                                        onClick={() => handleDownloadPdf(ficha.id_fichaingresoservicio || ficha.fichaingresoservicio)}
                                                    >
                                                        <IconFileDownload size={18} />
                                                    </ActionIcon>
                                                </Tooltip>
                                            </Table.Td>
                                            <Table.Td ta="center">
                                                <Tooltip label="Ver Detalle">
                                                    <ActionIcon 
                                                        color="blue" 
                                                        variant="filled" 
                                                        onClick={() => onViewDetail(ficha.id_fichaingresoservicio || ficha.fichaingresoservicio)}
                                                    >
                                                        <IconEye size={18} />
                                                    </ActionIcon>
                                                </Tooltip>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                    {displayedFichas.length === 0 && (
                                        <Table.Tr>
                                            <Table.Td colSpan={11} ta="center" py="xl">
                                                <Text c="dimmed">No se encontraron fichas en la bandeja.</Text>
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
