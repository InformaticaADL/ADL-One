import React, { useState, useEffect } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { fichaService } from '../services/ficha.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { FichaExportModal } from './FichaExportModal';

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
    ScrollArea,
    Tooltip
} from '@mantine/core';
import { 
    IconAdjustmentsHorizontal,
    IconDownload,
    IconTrash,
    IconEye,
    IconEdit
} from '@tabler/icons-react';

interface Props {
    onBackToMenu: () => void;
    onViewDetail: (id: number) => void;
}

export const FichasExploradorView: React.FC<Props> = ({ onBackToMenu, onViewDetail }) => {
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

                // Ordenar por ID de mayor a menor
                data.sort((a, b) => {
                    const idA = a.id_fichaingresoservicio || a.fichaingresoservicio || 0;
                    const idB = b.id_fichaingresoservicio || b.fichaingresoservicio || 0;
                    return idB - idA;
                });

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

    // For FichaExportModal format
    const getPlainValues = (key: string) => {
        const values = new Set<string>();
        fichas.forEach(f => {
            if (f[key]) values.add(String(f[key]).trim());
        });
        return Array.from(values).sort();
    };

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
                    title="Explorador de Fichas de Ingreso"
                    onBack={onBackToMenu}
                    rightSection={
                        <ProtectedContent permission="FI_EXP_MC">
                            <Button 
                                variant="filled" 
                                size="sm" 
                                color="green" 
                                leftSection={<IconDownload size={16} />}
                                onClick={() => setShowExportModal(true)}
                            >
                                Exportar PDF
                            </Button>
                        </ProtectedContent>
                    }
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

                        <FichaExportModal 
                            isOpen={showExportModal}
                            onClose={() => setShowExportModal(false)}
                            initialFilters={{
                                ficha: searchId, estado: searchEstado, fechaDesde: dateFrom, fechaHasta: dateTo, tipo: searchTipo, empresaFacturar: searchEmpresaFacturar, empresaServicio: searchEmpresaServicio, centro: searchCentro, objetivo: searchObjetivo, subArea: searchSubArea, usuario: searchUsuario
                            }}
                            catalogos={{
                                estados: getPlainValues('estado_ficha'), tipos: getPlainValues('tipo_fichaingresoservicio'), empresasFacturar: getPlainValues('empresa_facturar'), empresasServicio: getPlainValues('empresa_servicio'), centros: getPlainValues('centro'), objetivos: getPlainValues('nombre_objetivomuestreo_ma'), subAreas: getPlainValues('nombre_subarea'), fichas: getPlainValues('id_fichaingresoservicio'), usuarios: getPlainValues('nombre_usuario')
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
                                                        <Table.Td fw={700} c="blue.8">{ficha.fichaingresoservicio || '-'}</Table.Td>
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
                                                            <ProtectedContent permission={['FI_EXPORTAR_CFI', 'FI_EXP_AFE']}>
                                                                <Tooltip 
                                                                    label={(ficha.estado_ficha || '').toUpperCase().includes('RECHAZADA') ? 'Atención: Esta ficha ha sido rechazada' : 'Descargar PDF'}
                                                                    color={(ficha.estado_ficha || '').toUpperCase().includes('RECHAZADA') ? 'red' : 'blue'}
                                                                >
                                                                    <ActionIcon 
                                                                        color={(ficha.estado_ficha || '').toUpperCase().includes('RECHAZADA') ? 'red' : 'gray'} 
                                                                        variant="subtle"
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            const idFicha = ficha.id_fichaingresoservicio || ficha.fichaingresoservicio;
                                                                            try {
                                                                                const pdfBlob = await fichaService.downloadPdf(Number(idFicha));
                                                                                const url = window.URL.createObjectURL(pdfBlob);
                                                                                const link = document.createElement('a');
                                                                                const fileName = ficha.frecuencia_correlativo || `Ficha_${idFicha}`;
                                                                                link.href = url;
                                                                                link.setAttribute('download', `${fileName}.pdf`);
                                                                                document.body.appendChild(link);
                                                                                link.click();
                                                                                document.body.removeChild(link);
                                                                            } catch(err) {
                                                                                console.error(err);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <IconDownload size={18} />
                                                                    </ActionIcon>
                                                                </Tooltip>
                                                            </ProtectedContent>
                                                        </Table.Td>
                                                        <Table.Td align="center">
                                                            <ProtectedContent permission={['FI_CONSULTAR', 'FI_VER', 'FI_APROBAR_TEC', 'FI_RECHAZAR_TEC', 'FI_APROBAR_COO', 'FI_RECHAZAR_COO', 'FI_EDITAR']}>
                                                                <ActionIcon 
                                                                    color="blue" 
                                                                    variant="light"
                                                                    onClick={() => onViewDetail(ficha.id_fichaingresoservicio || ficha.fichaingresoservicio)}
                                                                >
                                                                    <IconEye size={18} />
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
