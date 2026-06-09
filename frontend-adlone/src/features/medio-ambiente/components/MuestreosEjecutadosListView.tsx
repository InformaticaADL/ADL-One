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
    Box,
    Badge,
    Popover,
    UnstyledButton,
    ThemeIcon
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { DatePickerInput } from '@mantine/dates';
import {
    IconSearch,
    IconEraser,
    IconFilter,
    IconExternalLink,
    IconCalendar,
    IconX
} from '@tabler/icons-react';

import { useNavStore } from '../../../store/navStore';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';

interface Props {
    onBackToMenu: () => void;
}

interface GroupedMuestreo {
    fecha: string;
    etiqueta: string;
    items: any[];
}

export const MuestreosEjecutadosListView: React.FC<Props> = ({ onBackToMenu }) => {
    const { setSelectedFicha, setActiveSubmodule, activeModule } = useNavStore();
    const { showToast } = useToast();
    const [muestreos, setMuestreos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const isMobile = useMediaQuery('(max-width: 768px)');

    const [realizadoStates, setRealizadoStates] = useState<Record<string, {realizado: boolean, userName: string, fecha: string}>>({});

    // Filters
    const [searchCorrelativo, setSearchCorrelativo] = useState('');
    const [searchCliente, setSearchCliente] = useState<string | null>(null);
    const [searchMuestreador, setSearchMuestreador] = useState<string | null>(null);
    const [searchObjetivo, setSearchObjetivo] = useState<string | null>(null);
    const [fechaDesde, setFechaDesde] = useState<Date | null>(null);
    const [fechaHasta, setFechaHasta] = useState<Date | null>(null);

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

            // Initialize realizadoStates from DB data
            const initialStates: Record<string, {realizado: boolean, userName: string, fecha: string}> = {};
            (data || []).forEach((m: any) => {
                const key = m.id_agendamam?.toString();
                if (key && m.realizado_por_gem) {
                    initialStates[key] = {
                        realizado: true,
                        userName: m.realizado_por_gem,
                        fecha: m.fecha_realizado_gem ? new Date(m.fecha_realizado_gem).toLocaleString('es-CL') : ''
                    };
                }
            });
            setRealizadoStates(initialStates);
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
        setFechaDesde(null);
        setFechaHasta(null);
        setCurrentPage(1);
    };

    const getDayLabel = (date: Date) => {
        const label = date.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        // Capitalizar primera letra para que se vea mejor
        return label.charAt(0).toUpperCase() + label.slice(1);
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

            // Filtro de fecha
            let matchFecha = false;
            if (m.fecha_retiro) {
                matchFecha = true;
                const fecha = new Date(m.fecha_retiro);
                if (fechaDesde) {
                    const desde = new Date(fechaDesde);
                    desde.setHours(0, 0, 0, 0);
                    matchFecha = matchFecha && fecha >= desde;
                }
                if (fechaHasta) {
                    const hasta = new Date(fechaHasta);
                    hasta.setHours(23, 59, 59, 999);
                    matchFecha = matchFecha && fecha <= hasta;
                }
            }

            return matchCorr && matchCliente && matchMues && matchObj && matchFecha;
        });
    }, [muestreos, searchCorrelativo, searchCliente, searchMuestreador, searchObjetivo, fechaDesde, fechaHasta]);

    const sortedMuestreos = useMemo(() => {
        return [...filteredMuestreos].sort((a, b) => {
            const dateA = a.fecha_retiro ? new Date(a.fecha_retiro).getTime() : 0;
            const dateB = b.fecha_retiro ? new Date(b.fecha_retiro).getTime() : 0;
            return dateB - dateA; // Más recientes primero
        });
    }, [filteredMuestreos]);

    const groupedMuestreos = useMemo(() => {
        const groups: Record<string, GroupedMuestreo> = {};
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        sortedMuestreos.forEach(m => {
            if (!m.fecha_retiro) return;
            const fecha = new Date(m.fecha_retiro);
            fecha.setHours(0, 0, 0, 0);
            const fechaStr = fecha.toISOString().split('T')[0];

            if (!groups[fechaStr]) {
                groups[fechaStr] = {
                    fecha: fechaStr,
                    etiqueta: getDayLabel(fecha),
                    items: []
                };
            }
            groups[fechaStr].items.push(m);
        });

        return Object.values(groups).sort((a, b) => {
            return new Date(b.fecha).getTime() - new Date(a.fecha).getTime(); // Más recientes primero
        });
    }, [sortedMuestreos]);

    const totalItems = sortedMuestreos.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    // Paginate grouped data
    let itemCount = 0;
    let pageStart = (currentPage - 1) * itemsPerPage;
    let pageEnd = currentPage * itemsPerPage;
    const displayedGroups: GroupedMuestreo[] = [];

    for (const group of groupedMuestreos) {
        const groupStart = itemCount;
        const groupEnd = itemCount + group.items.length;

        if (groupEnd > pageStart && groupStart < pageEnd) {
            displayedGroups.push({
                ...group,
                items: group.items.slice(
                    Math.max(0, pageStart - groupStart),
                    Math.max(0, pageEnd - groupStart)
                )
            });
        }
        itemCount += group.items.length;
        if (itemCount >= pageEnd) break;
    }


    return (
        <Box p="md" style={{ width: '100%' }}>
            <Stack gap="lg">
                <PageHeader
                    title="Muestreos Completados"
                    subtitle="Histórico de servicios ejecutados y reportes generados"
                    onBack={onBackToMenu}
                    breadcrumbItems={[
                        { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                        { label: 'Muestreos Completados' }
                    ]}
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
                        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 6 }} spacing="sm">
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
                            <DatePickerInput
                                label="Desde"
                                placeholder="Desde"
                                value={fechaDesde}
                                onChange={(val: any) => setFechaDesde(val)}
                                locale="es"
                                size="xs"
                                clearable
                                leftSection={<IconCalendar size={14} />}
                                valueFormat="DD/MM/YYYY"
                            />
                            <DatePickerInput
                                label="Hasta"
                                placeholder="Hasta"
                                value={fechaHasta}
                                onChange={(val: any) => setFechaHasta(val)}
                                locale="es"
                                size="xs"
                                clearable
                                leftSection={<IconCalendar size={14} />}
                                valueFormat="DD/MM/YYYY"
                            />
                        </SimpleGrid>
                    </Stack>
                </Paper>

                <Stack gap="md">
                    {loading ? (
                        <Paper withBorder radius="md" p="xl" shadow="sm">
                            <Center>
                                <Stack align="center" gap="xs">
                                    <Loader size="lg" />
                                    <Text size="sm" c="dimmed">Cargando registros históricos...</Text>
                                </Stack>
                            </Center>
                        </Paper>
                    ) : displayedGroups.length === 0 ? (
                        <Paper withBorder radius="md" p="xl" shadow="sm">
                            <Center>
                                <Text c="dimmed">No se encontraron muestreos ejecutados.</Text>
                            </Center>
                        </Paper>
                    ) : (
                        displayedGroups.map((group) => (
                            <Paper key={group.fecha} withBorder radius="md" shadow="sm" p={0} style={{ overflow: 'hidden' }}>
                                <Box p="md" bg="blue.0">
                                    <Group justify="space-between">
                                        <Text fw={700} size="md">{group.etiqueta}</Text>
                                        <Badge color="blue" variant="light">{group.items.length} servicios</Badge>
                                    </Group>
                                </Box>
                                <ScrollArea>
                                    <Table striped highlightOnHover withTableBorder={false} verticalSpacing="xs" miw={1000}>
                                        <Table.Thead bg="gray.1">
                                            <Table.Tr>
                                                {(activeModule !== 'gem' && activeModule !== 'unidades-gem') && <Table.Th w={60} style={{ whiteSpace: 'nowrap' }}>ID</Table.Th>}
                                                <Table.Th w={120} style={{ whiteSpace: 'nowrap' }}>Correlativo</Table.Th>
                                                <Table.Th w={100} style={{ whiteSpace: 'nowrap' }}>Fecha</Table.Th>
                                                <Table.Th miw={180}>Cliente</Table.Th>
                                                <Table.Th miw={180}>F. Emisora</Table.Th>
                                                <Table.Th miw={160}>Área / Obj.</Table.Th>
                                                <Table.Th miw={120}>M. Inst.</Table.Th>
                                                <Table.Th miw={120}>M. Ret.</Table.Th>
                                                <Table.Th miw={140}>Realizado por GEM</Table.Th>
                                                <Table.Th ta="center" w={80}>Acciones</Table.Th>
                                            </Table.Tr>
                                        </Table.Thead>
                                        <Table.Tbody>
                                            {group.items.map((m, idx) => {
                                                const key = m.id_agendamam?.toString();
                                                const isRealizado = realizadoStates[key]?.realizado || false;
                                                return (
                                                    <Table.Tr
                                                        key={`${m.id_agendamam || m.correlativo_ficha || m.id_fichaingresoservicio}-${idx}`}
                                                        style={{
                                                            backgroundColor: isRealizado ? 'rgba(34, 197, 94, 0.10)' : undefined,
                                                            outline: isRealizado ? '1.5px solid rgba(34, 197, 94, 0.4)' : undefined,
                                                            transition: 'background-color 0.3s ease, outline 0.3s ease'
                                                        }}
                                                    >
                                                        {(activeModule !== 'gem' && activeModule !== 'unidades-gem') && (
                                                            <Table.Td style={{ whiteSpace: 'nowrap' }}>
                                                                <Text size="xs" fw={700} c="blue.7">{m.caso_adlab || '-'}</Text>
                                                            </Table.Td>
                                                        )}
                                                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                                                            <Text size="xs" fw={600} truncate title={m.frecuencia_correlativo}>
                                                                {m.frecuencia_correlativo || '-'}
                                                            </Text>
                                                        </Table.Td>
                                                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                                                            <Text size="xs">
                                                                {m.fecha_retiro ? new Date(m.fecha_retiro).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : '-'}
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
                                                        <Table.Td>
                                                            {realizadoStates[key]?.realizado ? (
                                                                <Stack gap={0}>
                                                                    <Text size="10px" fw={700} c="teal.7">✓ Realizado</Text>
                                                                    <Text size="10px" c="dimmed" style={{ whiteSpace: 'normal', lineHeight: 1.3 }}>
                                                                        <strong>Por:</strong> {realizadoStates[key]?.userName}<br/>
                                                                        <strong>Fecha:</strong> {realizadoStates[key]?.fecha}
                                                                    </Text>
                                                                </Stack>
                                                            ) : (
                                                                <Text size="10px" c="dimmed">Pendiente</Text>
                                                            )}
                                                        </Table.Td>
                                                        <Table.Td ta="center">
                                                            <ProtectedContent permission={['MA_COMERCIAL_HISTORIAL_DETALLE', 'FI_VER', 'FI_APROBAR_TEC', 'FI_APROBAR_COO']}>
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
                                                );
                                            })}
                                        </Table.Tbody>
                                    </Table>
                                </ScrollArea>
                            </Paper>
                        ))
                    )}

                    <Divider />
                    <Group justify="space-between" p="md">
                        <Text size="sm" c="dimmed">Mostrando {sortedMuestreos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).length} de {filteredMuestreos.length} registros</Text>
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
                </Stack>
            </Stack>
        </Box>
    );
};
