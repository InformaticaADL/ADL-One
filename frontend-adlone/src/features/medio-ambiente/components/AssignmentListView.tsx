import React, { useState, useEffect, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
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
    IconFileDownload, 
    IconCalendarStats,
    IconFilter
} from '@tabler/icons-react';

interface Props {
    onBackToMenu: () => void;
    onViewAssignment: (id: number) => void;
}

export const AssignmentListView: React.FC<Props> = ({ onBackToMenu, onViewAssignment }) => {
    // State
    const [searchId, setSearchId] = useState('');
    const [searchEstado, setSearchEstado] = useState<string | null>(null);
    const [searchMonitoreo, setSearchMonitoreo] = useState<string | null>(null);
    const [searchEmpresaFacturar, setSearchEmpresaFacturar] = useState<string | null>(null);
    const [searchEmpresaServicio, setSearchEmpresaServicio] = useState<string | null>(null);
    const [searchCentro, setSearchCentro] = useState<string | null>(null);
    const [searchObjetivo, setSearchObjetivo] = useState<string | null>(null);
    const [searchSubArea, setSearchSubArea] = useState<string | null>(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [fichas, setFichas] = useState<any[]>([]);
    const isMobile = useMediaQuery('(max-width: 768px)');

    const itemsPerPage = 12;

    useEffect(() => {
        loadFichas();
    }, []);

    const loadFichas = async () => {
        setLoading(true);
        try {
            const response = await fichaService.getForAssignment();
            let data = [];
            if (Array.isArray(response)) data = response;
            else if (response && response.data && Array.isArray(response.data)) data = response.data;
            else if (response && Array.isArray(response.recordset)) data = response.recordset;

            setFichas(data || []);
        } catch (error) {
            console.error("Error loading fichas for assignment:", error);
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

    const uniqueEstados = useMemo(() => {
        const v1 = getUniqueValues('estado_ficha');
        return v1.length > 0 ? v1 : getUniqueValues('nombre_estadomuestreo');
    }, [fichas]);

    const uniqueMonitoreo = useMemo(() => {
        const v1 = getUniqueValues('nombre_frecuencia');
        return v1.length > 0 ? v1 : getUniqueValues('frecuencia');
    }, [fichas]);

    const uniqueEmpFacturar = useMemo(() => getUniqueValues('empresa_facturar'), [fichas]);
    
    const uniqueEmpServicio = useMemo(() => {
        const set = new Set<string>();
        fichas.forEach(f => {
            const val = f.empresa_servicio || f.nombre_empresaservicios;
            if (val) set.add(String(val).trim());
        });
        return Array.from(set).sort().map(v => ({ value: v, label: v }));
    }, [fichas]);

    const uniqueCentros = useMemo(() => {
        const set = new Set<string>();
        fichas.forEach(f => {
            const val = f.centro || f.nombre_centro;
            if (val) set.add(String(val).trim());
        });
        return Array.from(set).sort().map(v => ({ value: v, label: v }));
    }, [fichas]);

    const uniqueObjetivos = useMemo(() => getUniqueValues('nombre_objetivomuestreo_ma'), [fichas]);

    const uniqueSubAreas = useMemo(() => {
        const set = new Set<string>();
        fichas.forEach(f => {
            const val = f.subarea || f.nombre_subarea;
            if (val) set.add(String(val).trim());
        });
        return Array.from(set).sort().map(v => ({ value: v, label: v }));
    }, [fichas]);

    const handleClearFilters = () => {
        setSearchId('');
        setSearchEstado(null);
        setSearchMonitoreo(null);
        setSearchEmpresaFacturar(null);
        setSearchEmpresaServicio(null);
        setSearchCentro(null);
        setSearchObjetivo(null);
        setSearchSubArea(null);
        setDateFrom('');
        setDateTo('');
        setCurrentPage(1);
    };

    const filteredFichas = useMemo(() => {
        return fichas.filter(f => {
            const displayId = f.fichaingresoservicio || f.id_fichaingresoservicio || '';
            const matchId = searchId ? String(displayId).includes(searchId) : true;

            const check = (val: string, search: string | null) => {
                if (!search) return true;
                return (val || '').toString().toLowerCase().includes(search.toLowerCase());
            };

            const matchEstado = check(f.estado_ficha || f.nombre_estadomuestreo, searchEstado);
            const matchMonitoreo = check(f.nombre_frecuencia || f.frecuencia, searchMonitoreo);
            const matchEmpFacturar = check(f.empresa_facturar, searchEmpresaFacturar);
            const matchEmpServicio = check(f.empresa_servicio || f.nombre_empresaservicios, searchEmpresaServicio);
            const matchCentro = check(f.centro || f.nombre_centro, searchCentro);
            const matchObjetivo = check(f.nombre_objetivomuestreo_ma, searchObjetivo);
            const matchSubArea = check(f.subarea || f.nombre_subarea, searchSubArea);

            let matchDate = true;
            if (dateFrom || dateTo) {
                const fDate = f.fecha || f.fecha_muestreo;
                if (!fDate) matchDate = false;
                else {
                    let rowDate: Date;
                    if (typeof fDate === 'string' && fDate.includes('/')) {
                        const parts = fDate.split('/');
                        rowDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    } else {
                        rowDate = new Date(fDate);
                    }
                    rowDate.setHours(0, 0, 0, 0);

                    if (dateFrom && rowDate < new Date(dateFrom)) matchDate = false;
                    if (dateTo && rowDate > new Date(dateTo)) matchDate = false;
                }
            }

            return matchId && matchEstado && matchMonitoreo && matchEmpFacturar && matchEmpServicio && matchCentro && matchObjetivo && matchSubArea && matchDate;
        });
    }, [fichas, searchId, searchEstado, searchMonitoreo, searchEmpresaFacturar, searchEmpresaServicio, searchCentro, searchObjetivo, searchSubArea, dateFrom, dateTo]);

    const sortedFichas = useMemo(() => {
        const getStatusPriority = (status: string) => {
            const s = (status || '').toUpperCase();
            if (s.includes('POR ASIGNAR')) return 1;
            if (s.includes('PENDIENTE')) return 2;
            if (s.includes('EJECUTADO') || s.includes('VIGENTE') || s.includes('EMITIDA')) return 3;
            return 4;
        };

        return [...filteredFichas].sort((a, b) => {
            const statusA = a.estado_ficha || a.nombre_estadomuestreo || '';
            const statusB = b.estado_ficha || b.nombre_estadomuestreo || '';
            const p = getStatusPriority(statusA) - getStatusPriority(statusB);
            if (p !== 0) return p;
            return (b.id_fichaingresoservicio || 0) - (a.id_fichaingresoservicio || 0);
        });
    }, [filteredFichas]);

    const totalPages = Math.ceil(sortedFichas.length / itemsPerPage);
    const displayedFichas = sortedFichas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const getStatusBadge = (status: string) => {
        const s = (status || '').toUpperCase();
        let color = 'gray';
        if (s.includes('COORDINACIÓN')) color = 'red';
        else if (s.includes('PROGRAMACIÓN')) color = 'orange';
        else if (s.includes('EN PROCESO') || s.includes('VIGENTE') || s.includes('APROBADA') || s.includes('EJECUTADO')) color = 'green';
        else if (s.includes('PENDIENTE') || s.includes('ÁREA TÉCNICA')) color = 'yellow';
        else if (s.includes('RECHAZADA') || s.includes('CANCELADO') || s.includes('ANULADA')) color = 'red';

        return (
            <Badge color={color} variant="light" size="sm" fullWidth>
                {status || '-'}
            </Badge>
        );
    };

    return (
        <Box p="md" style={{ width: '100%' }}>
            <Stack gap="lg">
                <PageHeader 
                    title="Planificación y Asignación" 
                    subtitle="Gestión de recursos y programación de muestreos"
                    onBack={onBackToMenu}
                    rightSection={
                        <Group gap="xs" wrap={isMobile ? "wrap" : "nowrap"}>
                            <Text size="xs" fw={500} c="dimmed">{filteredFichas.length} registros encontrados</Text>
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
                        <SimpleGrid cols={{ base: 1, sm: 3, md: 5, lg: 6 }} spacing="sm">
                            <TextInput 
                                label="N° Ficha" 
                                placeholder="Eje: 1234" 
                                value={searchId} 
                                onChange={(e) => setSearchId(e.target.value)} 
                                size="xs"
                                leftSection={<IconSearch size={14} />}
                            />
                            <Select 
                                label="Estado" 
                                placeholder="Todos" 
                                data={uniqueEstados} 
                                value={searchEstado} 
                                onChange={setSearchEstado} 
                                searchable 
                                size="xs"
                                clearable
                            />
                            <Select 
                                label="Monitoreo" 
                                placeholder="Todos" 
                                data={uniqueMonitoreo} 
                                value={searchMonitoreo} 
                                onChange={setSearchMonitoreo} 
                                searchable 
                                size="xs"
                                clearable
                            />
                            <Select 
                                label="E. Facturar" 
                                placeholder="Todos" 
                                data={uniqueEmpFacturar} 
                                value={searchEmpresaFacturar} 
                                onChange={setSearchEmpresaFacturar} 
                                searchable 
                                size="xs"
                                clearable
                            />
                            <Select 
                                label="E. Servicio" 
                                placeholder="Todos" 
                                data={uniqueEmpServicio} 
                                value={searchEmpresaServicio} 
                                onChange={setSearchEmpresaServicio} 
                                searchable 
                                size="xs"
                                clearable
                            />
                            <Select 
                                label="Fuente Emisora" 
                                placeholder="Todos" 
                                data={uniqueCentros} 
                                value={searchCentro} 
                                onChange={setSearchCentro} 
                                searchable 
                                size="xs"
                                clearable
                            />
                            <Select 
                                label="Obj. Muestreo" 
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
                        </SimpleGrid>
                    </Stack>
                </Paper>

                <Paper withBorder radius="md" p={0} shadow="sm" style={{ overflow: 'hidden' }}>
                    <ScrollArea h="auto">
                        {loading ? (
                            <Center p="xl">
                                <Stack align="center" gap="xs">
                                    <Loader size="lg" />
                                    <Text size="sm" c="dimmed">Cargando asignaciones...</Text>
                                </Stack>
                            </Center>
                        ) : (
                            <Table striped highlightOnHover withTableBorder={false} verticalSpacing="xs">
                                <Table.Thead bg="gray.1">
                                    <Table.Tr>
                                        <Table.Th w={100}>N° Ficha</Table.Th>
                                        <Table.Th w={180}>Estado</Table.Th>
                                        <Table.Th w={120}>Frecuencia</Table.Th>
                                        <Table.Th>E. Facturar</Table.Th>
                                        <Table.Th>E. Servicio</Table.Th>
                                        <Table.Th>Centro</Table.Th>
                                        <Table.Th>Obj. Muestreo</Table.Th>
                                        <Table.Th ta="center" w={80}>PDF</Table.Th>
                                        <Table.Th ta="center" w={80}>Asignar</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {displayedFichas.map((row) => (
                                        <Table.Tr key={row.id_fichaingresoservicio || row.fichaingresoservicio}>
                                            <Table.Td fw={700} c="blue.8">{row.fichaingresoservicio || row.id_fichaingresoservicio}</Table.Td>
                                            <Table.Td>{getStatusBadge(row.estado_ficha || row.nombre_estadomuestreo)}</Table.Td>
                                            <Table.Td fz="xs">{row.nombre_frecuencia || row.frecuencia || '-'}</Table.Td>
                                            <Table.Td>
                                                <Text size="xs" truncate title={row.empresa_facturar}>{row.empresa_facturar || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="xs" truncate title={row.empresa_servicio || row.nombre_empresaservicios}>{row.empresa_servicio || row.nombre_empresaservicios || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="xs" truncate title={row.centro || row.nombre_centro}>{row.centro || row.nombre_centro || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td>
                                                <Text size="xs" truncate title={row.nombre_objetivomuestreo_ma}>{row.nombre_objetivomuestreo_ma || '-'}</Text>
                                            </Table.Td>
                                            <Table.Td ta="center">
                                                <ProtectedContent permission="FI_EXP_AFE">
                                                    <Tooltip label="Descargar PDF">
                                                        <ActionIcon 
                                                            color="red" 
                                                            variant="light" 
                                                            onClick={() => {
                                                                const idFicha = row.id_fichaingresoservicio || row.fichaingresoservicio;
                                                                fichaService.downloadPdf(Number(idFicha)).then(blob => {
                                                                    const url = window.URL.createObjectURL(blob);
                                                                    const link = document.createElement('a');
                                                                    link.href = url;
                                                                    link.setAttribute('download', `Ficha_${idFicha}.pdf`);
                                                                    document.body.appendChild(link);
                                                                    link.click();
                                                                    link.parentNode?.removeChild(link);
                                                                });
                                                            }}
                                                        >
                                                            <IconFileDownload size={18} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                </ProtectedContent>
                                            </Table.Td>
                                            <Table.Td ta="center">
                                                <ProtectedContent permission="FI_GEST_ASIG">
                                                    <Tooltip label="Gestionar Asignación">
                                                        <ActionIcon 
                                                            color="grape" 
                                                            variant="filled" 
                                                            onClick={() => onViewAssignment(row.id_fichaingresoservicio || row.fichaingresoservicio)}
                                                        >
                                                            <IconCalendarStats size={18} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                </ProtectedContent>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                    {displayedFichas.length === 0 && (
                                        <Table.Tr>
                                            <Table.Td colSpan={9} ta="center" py="xl">
                                                <Text c="dimmed">No se encontraron fichas para los filtros seleccionados.</Text>
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
