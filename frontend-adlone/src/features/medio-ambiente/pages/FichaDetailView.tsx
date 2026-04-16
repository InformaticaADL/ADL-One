import { useEffect, useState } from 'react';
import { fichaService } from '../services/ficha.service';
import {
    Grid,
    Paper,
    Text,
    Title,
    Badge,
    Group,
    Tabs,
    Button,
    ActionIcon,
    Divider,
    Stack,
    Box,
    Loader,
    Alert,
    Table,
    SimpleGrid,
    Card,
    Image,
    Modal,
    ThemeIcon,
    Collapse,
    TextInput,
    Tooltip
} from '@mantine/core';
import {
    IconArrowLeft,
    IconDatabase,
    IconTool,
    IconPhoto,
    IconSignature,
    IconCalendarTime,
    IconMapPin,
    IconAlertCircle,
    IconFlask,
    IconFileText,
    IconDownload,
    IconExternalLink,
    IconSend,
    IconChevronDown,
    IconChevronUp,
    IconRefresh,
    IconCheck,
    IconMailForward
} from '@tabler/icons-react';
import { useNavStore } from '../../../store/navStore';
import apiClient from '../../../config/axios.config';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { useAuth } from '../../../contexts/AuthContext';

export const FichaDetailView = () => {
    const {
        selectedFichaId,
        selectedCorrelativo,
        setActiveSubmodule
    } = useNavStore();
    const { hasPermission } = useAuth();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<any>(null);
    const [openedImage, setOpenedImage] = useState<string | null>(null);
    const [expandedDocs, setExpandedDocs] = useState<string[]>([]);

    const [resendModalOpen, setResendModalOpen] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState<any>(null);
    const [resendTo, setResendTo] = useState('vremolcoy@adldiagnostic.cl');
    const [resendCc, setResendCc] = useState('');
    const [resendLoading, setResendLoading] = useState(false);
    const [resendError, setResendError] = useState('');
    const [resendSuccess, setResendSuccess] = useState(false);

    const toggleDoc = (docId: string) => {
        setExpandedDocs(prev =>
            prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
        );
    };

    const handleResend = async () => {
        setResendError('');
        setResendLoading(true);
        try {
            await fichaService.enviarDocumentoManual({
                idFicha: Number(selectedFichaId),
                correlativo: selectedCorrelativo as string,
                documento: selectedDocument,
                to: resendTo,
                cc: resendCc
            });
            setResendSuccess(true);
        } catch (e: any) {
            setResendError(e.response?.data?.message || 'Error al reenviar el documento');
        } finally {
            setResendLoading(false);
        }
    };

    useEffect(() => {
        const fetchDetail = async () => {
            if (!selectedFichaId || !selectedCorrelativo) {
                setError('No se ha seleccionado ninguna ficha');
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const response = await apiClient.get(`/api/fichas/${selectedFichaId}/execution-detail`, {
                    params: { correlativo: selectedCorrelativo }
                });
                setData(response.data.data || response.data);
                setError(null);
            } catch (err: any) {
                console.error('Error fetching detail:', err);
                setError(err.response?.data?.message || 'Error al cargar los detalles de la ficha');
            } finally {
                setLoading(false);
            }
        };

        fetchDetail();
    }, [selectedFichaId, selectedCorrelativo]);

    const handleBack = () => {
        setActiveSubmodule('ma-fichas-ingreso');
    };

    const handleDownload = async (url: string, fileName: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error('Error downloading file:', error);
        }
    };

    if (loading) {
        return (
            <Box p="xl" style={{ width: '100%' }}>
                <Stack align="center" justify="center" style={{ height: '50vh' }}>
                    <Loader size="xl" />
                    <Text size="lg">Cargando detalles de la ejecución...</Text>
                </Stack>
            </Box>
        );
    }

    if (error || !data) {
        return (
            <Box p="xl" style={{ width: '100%' }}>
                <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" variant="filled">
                    {error || 'No se pudo cargar la información'}
                </Alert>
                <Button variant="light" mt="md" onClick={handleBack} leftSection={<IconArrowLeft size={16} />}>
                    Volver
                </Button>
            </Box>
        );
    }

    const { ficha, equipos, analisis, media, procesos } = data;

    // Helper to format values consistently
    const fmt = (v: any) => (v !== null && v !== undefined && v !== '' ? String(v) : '—');

    // Improved date formatter DD-MM-YYYY
    const parseFechaStr = (str: string) => {
        if (!str || str === 'Invalid Date' || str === '—') return '—';
        try {
            // Handle YYYY-MM-DD from backend
            const [year, month, day] = str.split('-');
            if (year && month && day && year.length === 4) {
                return `${day}-${month}-${year}`;
            }
            // Fallback for DD/MM/YYYY
            return str.replace(/\//g, '-');
        } catch (e) {
            return str;
        }
    };


    return (
        <Box p="md" style={{ width: '100%', maxWidth: '100%', scrollbarGutter: 'stable', overflowX: 'hidden' }}>

            {/* Header */}
            <Paper p="lg" radius="md" mb="md" withBorder shadow="sm" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', overflow: 'hidden' }}>
                <Grid align="center" gutter="lg" style={{ width: '100%', margin: 0 }}>
                    <Grid.Col span={{ base: 12, md: 3 }}>
                        <Group align="flex-start" wrap="nowrap">
                            <ActionIcon variant="light" color="blue" onClick={handleBack} size="lg" mt={5}>
                                <IconArrowLeft size={20} />
                            </ActionIcon>
                            <div>
                                <Title order={2} c="blue.9" style={{ lineHeight: 1.2 }}>{ficha?.caso_adlab || 'Caso S/N'}</Title>
                                <Text size="xs" c="dimmed" fw={700} mt={4}>{ficha?.frecuencia_correlativo || 'Correlativo S/N'}</Text>
                                <Badge color="green" variant="filled" size="sm" mt={6}>EJECUTADO</Badge>
                            </div>
                        </Group>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 7 }}>
                        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
                            {/* Group 1: Empresa Context */}
                            <Stack gap={4}>
                                <Text size="xs" fw={700} c="blue.7" style={{ whiteSpace: 'nowrap' }}>EMPRESA / CONTACTO / UBICACIÓN</Text>
                                <Text size="sm" fw={700} c="blue.9">{ficha?.nombre_empresa || '—'}</Text>
                                <Text size="xs" fw={500} c="dimmed">{ficha?.nombre_contacto || '—'}</Text>
                                <Group gap={4} mt={4}>
                                    <IconMapPin size={12} color="gray" />
                                    <Text size="xs" fw={500} c="dimmed" truncate>{ficha?.latitud ? `${ficha.latitud}, ${ficha.longitud}` : (ficha?.ma_coordenadas || '—')}</Text>
                                    {ficha?.referencia_googlemaps && (
                                        <ActionIcon
                                            variant="subtle"
                                            color="blue"
                                            size="sm"
                                            component="a"
                                            href={ficha.referencia_googlemaps}
                                            target="_blank"
                                        >
                                            <IconMapPin size={14} />
                                        </ActionIcon>
                                    )}
                                </Group>
                            </Stack>

                            {/* Group 2: Technical Context */}
                            <Stack gap={4}>
                                <Text size="xs" fw={700} c="blue.7" style={{ whiteSpace: 'nowrap' }}>CENTRO / OBJETIVO</Text>
                                <Text size="sm" fw={700}>{ficha?.nombre_centro || '—'}</Text>
                                <Text size="xs" fw={500} c="dimmed" style={{ whiteSpace: 'normal' }}>{ficha?.nombre_objetivomuestreo_ma || '—'}</Text>
                            </Stack>

                            {/* Group 3: Operational */}
                            <Stack gap={4}>
                                <Text size="xs" fw={700} c="blue.7" style={{ whiteSpace: 'nowrap' }}>DETALLE ACTIVIDAD</Text>
                                <SimpleGrid cols={2} spacing="xs">
                                    <Box>
                                        <Text size="10px" fw={700} c="dimmed">INICIO</Text>
                                        <Text size="xs" fw={600}>{parseFechaStr(ficha?.ma_muestreo_fechai)}</Text>
                                        <Text size="xs" c="dimmed" truncate title={procesos?.instalacion?.nombreMuestreador}>{procesos?.instalacion?.nombreMuestreador || '—'}</Text>
                                    </Box>
                                    <Box>
                                        <Text size="10px" fw={700} c="dimmed">TÉRMINO</Text>
                                        <Text size="xs" fw={600}>{parseFechaStr(ficha?.ma_muestreo_fechat)}</Text>
                                        <Text size="xs" c="dimmed" truncate title={procesos?.retiro?.nombreMuestreador}>{procesos?.retiro?.nombreMuestreador || '—'}</Text>
                                    </Box>
                                </SimpleGrid>
                            </Stack>
                        </SimpleGrid>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 2 }}>
                        <Stack gap="xs" align="flex-end" justify="center" h="100%">
                            <ProtectedContent permission="MA_COMERCIAL_REMUESTREAR">
                                <Button
                                    variant="light"
                                    color="grape"
                                    fullWidth
                                    leftSection={<IconRefresh size={18} />}
                                    onClick={() => setActiveSubmodule('ma-remuestreo')}
                                >
                                    Remuestreo
                                </Button>
                            </ProtectedContent>
                            <ProtectedContent permission="FI_EXP_MC">
                                <Tooltip
                                    label={(ficha?.estado_ficha || '').toUpperCase().includes('RECHAZADA') ? 'Atención: Esta ficha ha sido rechazada' : 'Descargar PDF'}
                                    color={(ficha?.estado_ficha || '').toUpperCase().includes('RECHAZADA') ? 'red' : 'blue'}
                                >
                                    <Button
                                        fullWidth
                                        leftSection={<IconDownload size={16} />}
                                        variant="filled"
                                        color={(ficha?.estado_ficha || '').toUpperCase().includes('RECHAZADA') ? 'red' : 'blue'}
                                        onClick={async () => {
                                            try {
                                                const pdfBlob = await fichaService.downloadPdf(Number(selectedFichaId));
                                                const url = window.URL.createObjectURL(pdfBlob);
                                                const link = document.createElement('a');
                                                const fileName = ficha?.caso_adlab || selectedCorrelativo || `Ficha_${selectedFichaId}`;
                                                link.href = url;
                                                link.setAttribute('download', `${fileName}.pdf`);
                                                document.body.appendChild(link);
                                                link.click();
                                                document.body.removeChild(link);
                                                window.URL.revokeObjectURL(url);
                                            } catch (err) {
                                                console.error('Error downloading PDF:', err);
                                            }
                                        }}
                                    >
                                        Exportar PDF
                                    </Button>
                                </Tooltip>
                            </ProtectedContent>
                        </Stack>
                    </Grid.Col>
                </Grid>
            </Paper>

            <Tabs defaultValue="datos_ingresados" color="blue" variant="pills" radius="md" style={{ width: '100%' }}>
                <Tabs.List mb="md">
                    <Tabs.Tab value="datos_ingresados" leftSection={<IconDatabase size={16} />}>
                        Datos ingresados
                    </Tabs.Tab>
                    <Tabs.Tab value="documentos" leftSection={<IconFileText size={16} />}>
                        Documentos
                    </Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="datos_ingresados" style={{ width: '100%', overflow: 'hidden', scrollbarGutter: 'stable' }}>
                    <Box p="0" style={{ width: '100%' }}>
                        <Paper withBorder radius="md" shadow="xs" style={{ width: '100%', overflow: 'hidden' }}>
                            <Tabs defaultValue="equipos" variant="outline" style={{ width: '100%' }}>
                                <Tabs.List grow>
                                    <Tabs.Tab value="equipos" leftSection={<IconTool size={16} />}>Equipos</Tabs.Tab>
                                    <Tabs.Tab value="datos" leftSection={<IconCalendarTime size={16} />}>Datos</Tabs.Tab>
                                    <Tabs.Tab value="analisis" leftSection={<IconFlask size={16} />}>Análisis</Tabs.Tab>
                                    <Tabs.Tab value="fotos" leftSection={<IconPhoto size={16} />}>Fotos</Tabs.Tab>
                                    <Tabs.Tab value="firmas" leftSection={<IconSignature size={16} />}>Firmas</Tabs.Tab>
                                </Tabs.List>

                                {/* --- SUB-TAB: EQUIPOS --- */}
                                <Tabs.Panel value="equipos" style={{ width: '100%', overflow: 'hidden' }}>
                                    <Box p="md" style={{ width: '100%', boxSizing: 'border-box' }}>
                                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" style={{ width: '100%' }}>
                                            <Box>
                                                <Group mb="md">
                                                    <IconTool color="orange" size={20} />
                                                    <Title order={5}>Equipos Instalación</Title>
                                                </Group>
                                                <Stack gap="xs">
                                                    {equipos?.filter((e: any) => e.usado_instalacion === 'S').length > 0 ? (
                                                        equipos.filter((e: any) => e.usado_instalacion === 'S').map((eq: any, i: number) => (
                                                            <Paper key={i} withBorder p="xs" radius="sm">
                                                                <Text fw={600} size="sm">{eq.nombre}</Text>
                                                                <Text size="xs" c="dimmed">Código: {eq.codigo}</Text>
                                                            </Paper>
                                                        ))
                                                    ) : <Text fs="italic" size="sm" c="dimmed">No hay equipos registrados.</Text>}
                                                </Stack>
                                            </Box>
                                            <Box>
                                                <Group mb="md">
                                                    <IconTool color="blue" size={20} />
                                                    <Title order={5}>Equipos Retiro</Title>
                                                </Group>
                                                <Stack gap="xs">
                                                    {equipos?.filter((e: any) => e.usado_retiro === 'S').length > 0 ? (
                                                        equipos.filter((e: any) => e.usado_retiro === 'S').map((eq: any, i: number) => (
                                                            <Paper key={i} withBorder p="xs" radius="sm">
                                                                <Text fw={600} size="sm">{eq.nombre}</Text>
                                                                <Text size="xs" c="dimmed">Código: {eq.codigo}</Text>
                                                            </Paper>
                                                        ))
                                                    ) : <Text fs="italic" size="sm" c="dimmed">No hay equipos registrados.</Text>}
                                                </Stack>
                                            </Box>
                                        </SimpleGrid>
                                        <Divider my="lg" label="Condiciones de Medición" labelPosition="center" />
                                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl">
                                            <Box style={{ minWidth: 0 }}>
                                                <Text fw={700} size="xs" c="dimmed">FLUJO LAMINAR</Text>
                                                <Badge color={procesos?.instalacion?.condiciones?.flujoLaminar === 'S' ? 'green' : 'gray'}>
                                                    {procesos?.instalacion?.condiciones?.flujoLaminar === 'S' ? 'SÍ' : 'NO'}
                                                </Badge>
                                            </Box>
                                            <Box style={{ minWidth: 0 }}>
                                                <Text fw={700} size="xs" c="dimmed">VELOCIDAD UNIFORME</Text>
                                                <Badge color={procesos?.instalacion?.condiciones?.velUniforme === 'S' ? 'green' : 'gray'}>
                                                    {procesos?.instalacion?.condiciones?.velUniforme === 'S' ? 'SÍ' : 'NO'}
                                                </Badge>
                                            </Box>
                                        </SimpleGrid>
                                        <Text fw={700} size="xs" c="dimmed" mt="md">OBSERVACIONES TÉCNICAS</Text>
                                        <Text fs="italic" size="sm" c="dimmed">{procesos?.instalacion?.condiciones?.observaciones || 'Sin observaciones.'}</Text>
                                    </Box>
                                </Tabs.Panel>

                                {/* --- SUB-TAB: DATOS --- */}
                                <Tabs.Panel value="datos" style={{ width: '100%', overflow: 'hidden' }}>
                                    <Box p="md" style={{ width: '100%', boxSizing: 'border-box' }}>
                                        <Stack gap="xl" style={{ width: '100%' }}>
                                            <SimpleGrid cols={{ base: 1, md: ficha?.tipo_fichaingresoservicio !== 'Puntual' ? 3 : 2 }} spacing="lg" style={{ width: '100%', minWidth: 0 }}>
                                                {/* Instalación */}
                                                <Box style={{ minWidth: 0 }}>
                                                    <Title order={5} mb="sm" c="orange.7">Instalación</Title>
                                                    <Paper withBorder p="md" radius="md" style={{ width: '100%', overflow: 'hidden' }}>
                                                        <Stack gap="xs">
                                                            <Group justify="space-between" wrap="wrap">
                                                                <Text size="sm" c="dimmed">Fecha Inicio</Text>
                                                                <Text fw={600} size="sm">{parseFechaStr(ficha?.ma_muestreo_fechai)}</Text>
                                                            </Group>
                                                            <Group justify="space-between" wrap="wrap">
                                                                <Text size="sm" c="dimmed">Hora Inicio</Text>
                                                                <Text fw={600} size="sm">{fmt(ficha?.ma_muestreo_horai)}</Text>
                                                            </Group>
                                                            <Group justify="space-between" wrap="wrap">
                                                                <Text size="sm" c="dimmed">Temp. Inicio</Text>
                                                                <Text fw={600} size="sm" c="orange.8">{fmt(ficha?.ma_temperaturai)} °C</Text>
                                                            </Group>
                                                            <Group justify="space-between" wrap="wrap">
                                                                <Text size="sm" c="dimmed">Temp. Inicio corregida</Text>
                                                                <Text fw={600} size="sm" c="orange.8">{fmt(ficha?.temperatura_corregidai)} °C</Text>
                                                            </Group>
                                                            <Group justify="space-between" wrap="wrap">
                                                                <Text size="sm" c="dimmed">pH Inicio</Text>
                                                                <Text fw={600} size="sm" c="orange.8">{fmt(ficha?.ma_phi)}</Text>
                                                            </Group>
                                                            {ficha?.totalizador_inicio && (
                                                                <Group justify="space-between" wrap="wrap">
                                                                    <Text size="sm" c="dimmed">Totalizador Inicio</Text>
                                                                    <Text fw={600} size="sm">{fmt(ficha?.totalizador_inicio)} m³</Text>
                                                                </Group>
                                                            )}
                                                        </Stack>
                                                    </Paper>
                                                </Box>

                                                {/* Retiro */}
                                                <Box style={{ minWidth: 0 }}>
                                                    <Title order={5} mb="sm" c="blue.7">Retiro</Title>
                                                    <Paper withBorder p="md" radius="md" style={{ width: '100%', overflow: 'hidden' }}>
                                                        <Stack gap="xs">
                                                            <Group justify="space-between" wrap="wrap">
                                                                <Text size="sm" c="dimmed">Fecha Término</Text>
                                                                <Text fw={600} size="sm">{parseFechaStr(ficha?.ma_muestreo_fechat)}</Text>
                                                            </Group>
                                                            <Group justify="space-between" wrap="wrap">
                                                                <Text size="sm" c="dimmed">Hora Término</Text>
                                                                <Text fw={600} size="sm">{fmt(ficha?.ma_muestreo_horat)}</Text>
                                                            </Group>
                                                            <Group justify="space-between" wrap="wrap">
                                                                <Text size="sm" c="dimmed">Temp. Término</Text>
                                                                <Text fw={600} size="sm" c="blue.8">{fmt(ficha?.ma_temperaturat)} °C</Text>
                                                            </Group>
                                                            <Group justify="space-between" wrap="wrap">
                                                                <Text size="sm" c="dimmed">Temp. Término corregida</Text>
                                                                <Text fw={600} size="sm" c="blue.8">{fmt(ficha?.temperatura_corregidat)} °C</Text>
                                                            </Group>
                                                            <Group justify="space-between" wrap="wrap">
                                                                <Text size="sm" c="dimmed">pH Término</Text>
                                                                <Text fw={600} size="sm" c="blue.8">{fmt(ficha?.ma_pht)}</Text>
                                                            </Group>
                                                            {ficha?.totalizador_final && (
                                                                <Group justify="space-between" wrap="wrap">
                                                                    <Text size="sm" c="dimmed">Totalizador Final</Text>
                                                                    <Text fw={600} size="sm">{fmt(ficha?.totalizador_final)} m³</Text>
                                                                </Group>
                                                            )}
                                                        </Stack>
                                                    </Paper>
                                                </Box>

                                                {/* Datos Compuestos / VDD */}
                                                {ficha?.tipo_fichaingresoservicio !== 'Puntual' && (
                                                    <Box style={{ minWidth: 0 }}>
                                                        <Title order={5} mb="sm" c="teal.7">Datos Compuestos / VDD</Title>
                                                        <Paper withBorder p="md" radius="md" style={{ width: '100%', overflow: 'hidden' }}>
                                                            <Stack gap="xs">
                                                                <Group justify="space-between" wrap="wrap">
                                                                    <Text size="sm" c="dimmed">Fecha Compuesta</Text>
                                                                    <Text fw={600} size="sm">{parseFechaStr(ficha?.ma_fecha_compuesta)}</Text>
                                                                </Group>
                                                                <Group justify="space-between" wrap="wrap">
                                                                    <Text size="sm" c="dimmed">Hora Compuesta</Text>
                                                                    <Text fw={600} size="sm">{fmt(ficha?.ma_hora_compuesta)}</Text>
                                                                </Group>
                                                                <Group justify="space-between" wrap="wrap">
                                                                    <Text size="sm" c="dimmed">Temp. Compuesta</Text>
                                                                    <Text fw={600} size="sm" c="teal.8">{fmt(ficha?.ma_temperatura_compuesta)} °C</Text>
                                                                </Group>
                                                                <Group justify="space-between" wrap="wrap">
                                                                    <Text size="sm" c="dimmed">Temp. Compuesta corregida</Text>
                                                                    <Text fw={600} size="sm" c="teal.8">{fmt(ficha?.temperatura_corregidacompuesta)} °C</Text>
                                                                </Group>
                                                                <Group justify="space-between" wrap="wrap">
                                                                    <Text size="sm" c="dimmed">pH Compuesto</Text>
                                                                    <Text fw={600} size="sm" c="teal.8">{fmt(ficha?.ma_ph_compuesta)}</Text>
                                                                </Group>
                                                                <Group justify="space-between" wrap="wrap">
                                                                    <Text size="sm" c="dimmed" fw={700}>VDD</Text>
                                                                    <Text fw={800} c="blue.8" size="md">{fmt(ficha?.vdd)} m³/h</Text>
                                                                </Group>
                                                            </Stack>
                                                        </Paper>
                                                    </Box>
                                                )}
                                            </SimpleGrid>
                                        </Stack>
                                    </Box>
                                </Tabs.Panel>

                                {/* --- SUB-TAB: ANÁLISIS --- */}
                                <Tabs.Panel value="analisis" style={{ width: '100%', overflow: 'hidden' }}>
                                    <Box p="md" style={{ width: '100%', boxSizing: 'border-box' }}>
                                        <Stack gap="xl" style={{ width: '100%' }}>
                                            {/* Análisis de Terreno */}
                                            <Box>
                                                <Group mb="md">
                                                    <IconTool color="teal" size={20} />
                                                    <Title order={5}>Análisis de Terreno</Title>
                                                </Group>
                                                <Paper withBorder radius="md" p="0" style={{ overflow: 'hidden', width: '100%' }}>
                                                    <Table withTableBorder={false} withColumnBorders>
                                                        <Table.Thead bg="teal.0">
                                                            <Table.Tr>
                                                                <Table.Th>Parámetro</Table.Th>
                                                                <Table.Th ta="center">Valor</Table.Th>
                                                            </Table.Tr>
                                                        </Table.Thead>
                                                        <Table.Tbody>
                                                            {analisis?.filter((item: any) => item.tipo_analisis !== 'Laboratorio').map((item: any, i: number) => (
                                                                <Table.Tr key={i}>
                                                                    <Table.Td fw={500}>{item.parametro}</Table.Td>
                                                                    <Table.Td ta="center">
                                                                        <Badge variant="light" color="teal">{item.valor}</Badge>
                                                                    </Table.Td>
                                                                </Table.Tr>
                                                            ))}
                                                            {analisis?.filter((item: any) => item.tipo_analisis !== 'Laboratorio').length === 0 && (
                                                                <Table.Tr>
                                                                    <Table.Td colSpan={2} style={{ textAlign: 'center' }} p="md">
                                                                        <Text fs="italic" c="dimmed" size="sm">No hay parámetros de terreno registrados.</Text>
                                                                    </Table.Td>
                                                                </Table.Tr>
                                                            )}
                                                        </Table.Tbody>
                                                    </Table>
                                                </Paper>
                                            </Box>

                                            {/* Análisis de Laboratorio */}
                                            <Box>
                                                <Group mb="md">
                                                    <IconFlask color="blue" size={20} />
                                                    <Title order={5}>Análisis de Laboratorio</Title>
                                                </Group>
                                                <Paper withBorder radius="md" p="0" style={{ overflow: 'hidden', width: '100%' }}>
                                                    <Table withTableBorder={false} withColumnBorders>
                                                        <Table.Thead bg="blue.0">
                                                            <Table.Tr>
                                                                <Table.Th>Parámetro</Table.Th>
                                                                <Table.Th>Laboratorio Asignado</Table.Th>
                                                            </Table.Tr>
                                                        </Table.Thead>
                                                        <Table.Tbody>
                                                            {analisis?.filter((item: any) => item.tipo_analisis === 'Laboratorio').map((item: any, i: number) => {
                                                                return (
                                                                    <Table.Tr key={i}>
                                                                        <Table.Td fw={500}>{item.parametro}</Table.Td>
                                                                        <Table.Td>
                                                                            <Text size="xs" fw={500} c={item.id_laboratorioensayo_2 > 0 ? 'orange.8' : 'blue.8'}>
                                                                                {item.nombre_laboratorioensayo || '—'}
                                                                            </Text>
                                                                        </Table.Td>
                                                                    </Table.Tr>
                                                                );
                                                            })}
                                                            {analisis?.filter((item: any) => item.tipo_analisis === 'Laboratorio').length === 0 && (
                                                                <Table.Tr>
                                                                    <Table.Td colSpan={2} style={{ textAlign: 'center' }} p="md">
                                                                        <Text fs="italic" c="dimmed" size="sm">No hay parámetros de laboratorio registrados.</Text>
                                                                    </Table.Td>
                                                                </Table.Tr>
                                                            )}
                                                        </Table.Tbody>
                                                    </Table>
                                                </Paper>
                                            </Box>
                                        </Stack>
                                    </Box>
                                </Tabs.Panel>

                                {/* --- SUB-TAB: FOTOS --- */}
                                <Tabs.Panel value="fotos" style={{ width: '100%', overflow: 'hidden' }}>
                                    <Box p="md" style={{ width: '100%', boxSizing: 'border-box' }}>
                                        <Stack gap="xl" style={{ width: '100%' }}>
                                            {/* Fotos Instalación */}
                                            <Box>
                                                <Group mb="md">
                                                    <IconPhoto color="orange" size={20} />
                                                    <Title order={5}>Fotos Instalación</Title>
                                                </Group>
                                                <Paper withBorder p="md" radius="md" style={{ width: '100%' }}>
                                                    <SimpleGrid cols={{ base: 1, sm: 2, md: 4, lg: 5 }} spacing="md">
                                                        {media?.ma_fotografia?.split(';').filter((p: string) => p.toLowerCase().includes('instalacion')).length > 0 ? (
                                                            media.ma_fotografia.split(';').filter((p: string) => p.toLowerCase().includes('instalacion')).map((photo: string, idx: number) => (
                                                                <Card key={idx} padding="xs" radius="md" withBorder shadow="sm" style={{ cursor: 'pointer' }} onClick={() => setOpenedImage(`${apiClient.defaults.baseURL}${photo}`)}>
                                                                    <Card.Section>
                                                                        <Image
                                                                            src={`${apiClient.defaults.baseURL}${photo}`}
                                                                            height={140}
                                                                            fallbackSrc="https://placehold.co/400x300?text=Sin+Imagen"
                                                                        />
                                                                    </Card.Section>
                                                                </Card>
                                                            ))
                                                        ) : <Text fs="italic" size="sm" c="dimmed">No hay fotos de instalación.</Text>}
                                                    </SimpleGrid>
                                                </Paper>
                                            </Box>

                                            <Divider />

                                            {/* Fotos Retiro */}
                                            <Box>
                                                <Group mb="md">
                                                    <IconPhoto color="blue" size={20} />
                                                    <Title order={5}>Fotos Retiro</Title>
                                                </Group>
                                                <Paper withBorder p="md" radius="md" style={{ width: '100%' }}>
                                                    <SimpleGrid cols={{ base: 1, sm: 2, md: 4, lg: 5 }} spacing="md">
                                                        {media?.ma_fotografia?.split(';').filter((p: string) => p.toLowerCase().includes('retiro')).length > 0 ? (
                                                            media.ma_fotografia.split(';').filter((p: string) => p.toLowerCase().includes('retiro')).map((photo: string, idx: number) => (
                                                                <Card key={idx} padding="xs" radius="md" withBorder shadow="sm" style={{ cursor: 'pointer' }} onClick={() => setOpenedImage(`${apiClient.defaults.baseURL}${photo}`)}>
                                                                    <Card.Section>
                                                                        <Image
                                                                            src={`${apiClient.defaults.baseURL}${photo}`}
                                                                            height={140}
                                                                            fallbackSrc="https://placehold.co/400x300?text=Sin+Imagen"
                                                                        />
                                                                    </Card.Section>
                                                                </Card>
                                                            ))
                                                        ) : <Text fs="italic" size="sm" c="dimmed">No hay fotos de retiro.</Text>}
                                                    </SimpleGrid>
                                                </Paper>
                                            </Box>
                                        </Stack>
                                    </Box>
                                </Tabs.Panel>

                                {/* --- SUB-TAB: FIRMAS --- */}
                                <Tabs.Panel value="firmas" style={{ width: '100%', overflow: 'hidden' }}>
                                    <Box p="md" style={{ width: '100%', boxSizing: 'border-box' }}>
                                        <Tabs defaultValue="instalacion_f" variant="pills" radius="xl" mb="md" style={{ width: '100%' }}>
                                            <Tabs.List justify="center">
                                                <Tabs.Tab value="instalacion_f" color="orange">Instalación</Tabs.Tab>
                                                <Tabs.Tab value="retiro_f" color="blue">Retiro</Tabs.Tab>
                                            </Tabs.List>

                                            <Tabs.Panel value="instalacion_f" pt="md" style={{ width: '100%', overflow: 'hidden', scrollbarGutter: 'stable' }}>
                                                <Stack gap="xl" style={{ width: '100%' }}>
                                                    {/* Muestreador Section */}
                                                    <Paper withBorder p="md" radius="md" style={{ width: '100%' }}>
                                                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" style={{ width: '100%' }}>
                                                            <Box>
                                                                <Title order={6} mb="xs" c="dimmed">MUESTREADOR</Title>
                                                                <Text size="lg" fw={700}>{procesos?.instalacion?.nombreMuestreador || '—'}</Text>
                                                                <Box mt="md" p="xs" bg="gray.0" style={{ borderRadius: 8, border: '1px dashed #ced4da', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    {procesos?.instalacion?.firmas?.find((f: any) => f.rol === 'muestreador') ? (
                                                                        <Image
                                                                            src={`${apiClient.defaults.baseURL}${procesos.instalacion.firmas.find((f: any) => f.rol === 'muestreador').ruta}`}
                                                                            height={100}
                                                                            fit="contain"
                                                                        />
                                                                    ) : <Text fs="italic" size="xs" c="dimmed">Sin firma registrada.</Text>}
                                                                </Box>
                                                            </Box>
                                                            <Box>
                                                                <Title order={6} mb="xs" c="dimmed">OBSERVACIONES MUESTREADOR</Title>
                                                                <Box p="md" bg="gray.0" style={{ borderRadius: 8, height: 160, overflowY: 'auto' }}>
                                                                    <Text size="sm" fs="italic">
                                                                        {procesos?.instalacion?.observaciones || 'Sin observaciones.'}
                                                                    </Text>
                                                                </Box>
                                                            </Box>
                                                        </SimpleGrid>
                                                    </Paper>

                                                    <Divider label="Observador de terreno" labelPosition="center" />

                                                    {/* Observador Section */}
                                                    {procesos?.instalacion?.nombreObservador && procesos?.instalacion?.nombreObservador !== 'S/D' ? (
                                                        <Paper withBorder p="md" radius="md" style={{ width: '100%' }}>
                                                            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" style={{ width: '100%' }}>
                                                                <Box>
                                                                    <Title order={6} mb="xs" c="dimmed">NOMBRE OBSERVADOR</Title>
                                                                    <Text size="md" fw={600}>{procesos.instalacion.nombreObservador}</Text>
                                                                    <Title order={6} mt="md" mb="xs" c="dimmed">CARGO</Title>
                                                                    <Text size="sm">{procesos.instalacion.cargoObservador || '—'}</Text>
                                                                </Box>
                                                                <Box>
                                                                    <Title order={6} mb="xs" c="dimmed">FIRMA OBSERVADOR</Title>
                                                                    <Box p="xs" bg="gray.0" style={{ borderRadius: 8, border: '1px dashed #ced4da', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        {procesos?.instalacion?.firmas?.find((f: any) => f.rol === 'observador') ? (
                                                                            <Image
                                                                                src={`${apiClient.defaults.baseURL}${procesos.instalacion.firmas.find((f: any) => f.rol === 'observador').ruta}`}
                                                                                height={100}
                                                                                fit="contain"
                                                                            />
                                                                        ) : <Text fs="italic" size="xs" c="dimmed">Sin firma registrada.</Text>}
                                                                    </Box>
                                                                </Box>
                                                            </SimpleGrid>
                                                        </Paper>
                                                    ) : (
                                                        <Alert color="blue" variant="light" icon={<IconAlertCircle size={16} />}>
                                                            Observador de terreno no registrado en el proceso
                                                        </Alert>
                                                    )}
                                                </Stack>
                                            </Tabs.Panel>

                                            <Tabs.Panel value="retiro_f" pt="md" style={{ width: '100%', overflow: 'hidden', scrollbarGutter: 'stable' }}>
                                                <Stack gap="xl" style={{ width: '100%' }}>
                                                    {/* Muestreador Section */}
                                                    <Paper withBorder p="md" radius="md" style={{ width: '100%' }}>
                                                        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" style={{ width: '100%' }}>
                                                            <Box>
                                                                <Title order={6} mb="xs" c="dimmed">MUESTREADOR</Title>
                                                                <Text size="lg" fw={700}>{procesos?.retiro?.nombreMuestreador || '—'}</Text>
                                                                <Box mt="md" p="xs" bg="gray.0" style={{ borderRadius: 8, border: '1px dashed #ced4da', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    {procesos?.retiro?.firmas?.find((f: any) => f.rol === 'muestreador') ? (
                                                                        <Image
                                                                            src={`${apiClient.defaults.baseURL}${procesos.retiro.firmas.find((f: any) => f.rol === 'muestreador').ruta}`}
                                                                            height={100}
                                                                            fit="contain"
                                                                        />
                                                                    ) : <Text fs="italic" size="xs" c="dimmed">Sin firma registrada.</Text>}
                                                                </Box>
                                                            </Box>
                                                            <Box>
                                                                <Title order={6} mb="xs" c="dimmed">OBSERVACIONES MUESTREADOR</Title>
                                                                <Box p="md" bg="gray.0" style={{ borderRadius: 8, height: 160, overflowY: 'auto' }}>
                                                                    <Text size="sm" fs="italic">
                                                                        {procesos?.retiro?.observaciones || 'Sin observaciones.'}
                                                                    </Text>
                                                                </Box>
                                                            </Box>
                                                        </SimpleGrid>
                                                    </Paper>

                                                    <Divider label="Observador de terreno" labelPosition="center" />

                                                    {/* Observador Section */}
                                                    {procesos?.retiro?.nombreObservador && procesos?.retiro?.nombreObservador !== 'S/D' ? (
                                                        <Paper withBorder p="md" radius="md" style={{ width: '100%' }}>
                                                            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" style={{ width: '100%' }}>
                                                                <Box>
                                                                    <Title order={6} mb="xs" c="dimmed">NOMBRE OBSERVADOR</Title>
                                                                    <Text size="md" fw={600}>{procesos.retiro.nombreObservador}</Text>
                                                                    <Title order={6} mt="md" mb="xs" c="dimmed">CARGO</Title>
                                                                    <Text size="sm">{procesos.retiro.cargoObservador || '—'}</Text>
                                                                </Box>
                                                                <Box>
                                                                    <Title order={6} mb="xs" c="dimmed">FIRMA OBSERVADOR</Title>
                                                                    <Box p="xs" bg="gray.0" style={{ borderRadius: 8, border: '1px dashed #ced4da', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        {procesos?.retiro?.firmas?.find((f: any) => f.rol === 'observador') ? (
                                                                            <Image
                                                                                src={`${apiClient.defaults.baseURL}${procesos.retiro.firmas.find((f: any) => f.rol === 'observador').ruta}`}
                                                                                height={100}
                                                                                fit="contain"
                                                                            />
                                                                        ) : <Text fs="italic" size="xs" c="dimmed">Sin firma registrada.</Text>}
                                                                    </Box>
                                                                </Box>
                                                            </SimpleGrid>
                                                        </Paper>
                                                    ) : (
                                                        <Alert color="blue" variant="light" icon={<IconAlertCircle size={16} />}>
                                                            Observador de terreno no registrado en el proceso
                                                        </Alert>
                                                    )}
                                                </Stack>
                                            </Tabs.Panel>
                                        </Tabs>
                                    </Box>
                                </Tabs.Panel>
                            </Tabs>
                        </Paper>
                    </Box>
                </Tabs.Panel>

                <Tabs.Panel value="documentos" style={{ width: '100%', scrollbarGutter: 'stable' }}>
                    <Paper p="md" withBorder radius="md" style={{ width: '100%' }}>
                        <Stack gap="xl">
                            <Group justify="space-between">
                                <Stack gap={0}>
                                    <Title order={4} c="blue.8">Documentos de Respaldo</Title>
                                    <Text size="xs" c="dimmed">Archivos PDF generados para el cliente y laboratorios</Text>
                                </Stack>
                            </Group>

                            {media?.documentos && media.documentos.length > 0 ? (
                                <Stack gap="xl">
                                    {/* FoMa Group */}
                                    {media.documentos.filter((d: any) => d.tipo === 'FoMa').length > 0 && (
                                        <Box>
                                            <Divider label="FOMA" labelPosition="left" mb="md" />
                                            <Stack gap="sm">
                                                {media.documentos.filter((d: any) => d.tipo === 'FoMa').map((doc: any, index: number) => (
                                                    <Card key={`foma-${index}`} withBorder radius="md" p="xs">
                                                        <Group justify="space-between" wrap="nowrap">
                                                            <Group wrap="nowrap">
                                                                <ThemeIcon variant="light" color="red" size="md">
                                                                    <IconFileText size={18} />
                                                                </ThemeIcon>
                                                                <Box>
                                                                    <Text fw={700} size="sm">{doc.label}</Text>
                                                                    <Text size="xs" c="dimmed">{doc.nombre}</Text>
                                                                </Box>
                                                            </Group>
                                                            <Group gap="xs">
                                                                <Button
                                                                    size="compact-xs"
                                                                    variant="light"
                                                                    leftSection={<IconExternalLink size={12} />}
                                                                    onClick={() => window.open(`${apiClient.defaults.baseURL}${doc.ruta}`, '_blank')}
                                                                >
                                                                    Abrir
                                                                </Button>
                                                                <Button
                                                                    size="compact-xs"
                                                                    variant="light"
                                                                    color="green"
                                                                    leftSection={<IconSend size={12} />}
                                                                    onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc); setResendSuccess(false); setResendTo('vremolcoy@adldiagnostic.cl'); setResendCc(''); setResendModalOpen(true); }}
                                                                >
                                                                    Reenviar
                                                                </Button>
                                                                <Button
                                                                    size="compact-xs"
                                                                    variant="subtle"
                                                                    color="gray"
                                                                    leftSection={<IconDownload size={12} />}
                                                                    onClick={() => handleDownload(`${apiClient.defaults.baseURL}${doc.ruta}`, doc.nombre)}
                                                                >
                                                                    Descargar
                                                                </Button>
                                                            </Group>
                                                        </Group>
                                                    </Card>
                                                ))}
                                            </Stack>
                                        </Box>
                                    )}

                                    {/* Cadena de Custodia Group */}
                                    {media.documentos.filter((d: any) => d.tipo === 'Cadena de Custodia').length > 0 && (
                                        <Box>
                                            <Divider label="CADENAS DE CUSTODIA" labelPosition="left" mb="md" />
                                            <Stack gap="sm">
                                                {media.documentos.filter((d: any) => d.tipo === 'Cadena de Custodia').map((doc: any, index: number) => {
                                                    const isExpanded = expandedDocs.includes(doc.nombre);
                                                    const labTests = analisis?.filter((a: any) =>
                                                        a.tipo_analisis === 'Laboratorio' &&
                                                        doc.label && a.nombre_laboratorioensayo &&
                                                        (a.nombre_laboratorioensayo.toLowerCase().includes(doc.label.toLowerCase()) ||
                                                            doc.label.toLowerCase().includes(a.nombre_laboratorioensayo.toLowerCase()))
                                                    ) || [];

                                                    return (
                                                        <Card key={`cadena-${index}`} withBorder radius="md" p={0}>
                                                            <Box p="xs" style={{ cursor: 'pointer' }} onClick={() => toggleDoc(doc.nombre)}>
                                                                <Group justify="space-between" wrap="nowrap">
                                                                    <Group wrap="nowrap">
                                                                        <ThemeIcon variant="light" color="blue" size="md">
                                                                            <IconFileText size={18} />
                                                                        </ThemeIcon>
                                                                        <Box>
                                                                            <Group gap="xs">
                                                                                <Text fw={700} size="sm">{doc.label}</Text>
                                                                                {isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                                                                            </Group>
                                                                            <Text size="xs" c="dimmed">{doc.nombre}</Text>
                                                                        </Box>
                                                                    </Group>
                                                                    <Group gap="xs">
                                                                        <Button
                                                                            size="compact-xs"
                                                                            variant="light"
                                                                            leftSection={<IconExternalLink size={12} />}
                                                                            onClick={(e) => { e.stopPropagation(); window.open(`${apiClient.defaults.baseURL}${doc.ruta}`, '_blank'); }}
                                                                        >
                                                                            Abrir
                                                                        </Button>
                                                                        <Button
                                                                            size="compact-xs"
                                                                            variant="light"
                                                                            color="green"
                                                                            leftSection={<IconSend size={12} />}
                                                                            onClick={(e) => { e.stopPropagation(); setSelectedDocument(doc); setResendSuccess(false); setResendTo('vremolcoy@adldiagnostic.cl'); setResendCc(''); setResendModalOpen(true); }}
                                                                        >
                                                                            Reenviar
                                                                        </Button>
                                                                        <Button
                                                                            size="compact-xs"
                                                                            variant="subtle"
                                                                            color="gray"
                                                                            leftSection={<IconDownload size={12} />}
                                                                            onClick={(e) => { e.stopPropagation(); handleDownload(`${apiClient.defaults.baseURL}${doc.ruta}`, doc.nombre); }}
                                                                        >
                                                                            Descargar
                                                                        </Button>
                                                                    </Group>
                                                                </Group>
                                                            </Box>

                                                            <Collapse in={isExpanded}>
                                                                <Box p="md" bg="gray.0" style={{ borderTop: '1px solid #dee2e6' }}>
                                                                    <Text size="xs" fw={700} mb="xs" c="dimmed">ANÁLISIS ASOCIADOS A ESTA CADENA:</Text>
                                                                    {labTests.length > 0 ? (
                                                                        <Table withTableBorder withColumnBorders bg="white">
                                                                            <Table.Thead>
                                                                                <Table.Tr>
                                                                                    <Table.Th>Parámetro</Table.Th>
                                                                                </Table.Tr>
                                                                            </Table.Thead>
                                                                            <Table.Tbody>
                                                                                {labTests.map((t: any, idx: number) => (
                                                                                    <Table.Tr key={idx}>
                                                                                        <Table.Td>{t.parametro}</Table.Td>
                                                                                    </Table.Tr>
                                                                                ))}
                                                                            </Table.Tbody>
                                                                        </Table>
                                                                    ) : (
                                                                        <Text size="xs" fs="italic" c="dimmed">No se pudieron vincular análisis automáticamente por nombre.</Text>
                                                                    )}
                                                                </Box>
                                                            </Collapse>
                                                        </Card>
                                                    );
                                                })}
                                            </Stack>
                                        </Box>
                                    )}
                                </Stack>
                            ) : (
                                <Stack align="center" py="xl" gap="sm">
                                    <IconFileText size={40} color="gray" />
                                    <Text c="dimmed">No se encontraron documentos (FoMa/Cadenas) en la carpeta del correlativo.</Text>
                                </Stack>
                            )}
                        </Stack>
                    </Paper>
                </Tabs.Panel>
            </Tabs>

            <Modal opened={!!openedImage} onClose={() => setOpenedImage(null)} size="xl" centered padding={0}>
                {openedImage && (
                    <Image
                        src={openedImage}
                        fit="contain"
                        style={{ maxHeight: '90vh' }}
                    />
                )}
            </Modal>

            <Modal
                opened={resendModalOpen}
                onClose={() => setResendModalOpen(false)}
                title={
                    <Group align="center" gap="sm">
                        <ThemeIcon size="md" variant="light" color="blue">
                            <IconSend size={16} />
                        </ThemeIcon>
                        <Text fw={600} c="blue.8">Gestión de Reenvío de Documentos</Text>
                    </Group>
                }
                size="md"
                centered
                padding="xl"
            >
                {selectedDocument && (
                    <Stack gap="md">
                        {resendSuccess ? (
                            <Stack align="center" gap="md" py="xl">
                                <ThemeIcon color="green" size={80} radius="100%">
                                    <IconCheck size={40} />
                                </ThemeIcon>
                                <Title order={3} ta="center">¡Documento Enviado!</Title>
                                <Text c="dimmed" ta="center">El documento ha sido despachado exitosamente (en fase de pruebas hacia: vremolcoy@adldiagnostic.cl).</Text>
                                <Button color="blue" variant="light" onClick={() => setResendModalOpen(false)} mt="md">
                                    Cerrar y volver a la ficha
                                </Button>
                            </Stack>
                        ) : (
                            <>
                                <Alert color="blue" variant="light" icon={<IconMailForward size={16} />}>
                                    Está preparando el envío de: <b>{selectedDocument.label}</b> ({selectedDocument.tipo || 'Documento'})
                                </Alert>

                                <Stack gap="md" mt="md">
                                    <TextInput
                                        label="Para (To)"
                                        placeholder="correo@ejemplo.com"
                                        value={resendTo}
                                        onChange={(e) => setResendTo(e.currentTarget.value)}
                                        disabled // Temporary for testing phase
                                        description="Destinatario bloqueado en fase de pruebas."
                                    />
                                    <TextInput
                                        label="Copia (CC)"
                                        placeholder="copia@ejemplo.com"
                                        value={resendCc}
                                        onChange={(e) => setResendCc(e.currentTarget.value)}
                                        description="Separar multiplicidad con comas."
                                    />

                                    <Card withBorder p="sm" radius="md" bg="gray.0">
                                        <Group wrap="nowrap">
                                            <ThemeIcon size="lg" variant="light" color="red" radius="md">
                                                <IconFileText size={20} />
                                            </ThemeIcon>
                                            <Box style={{ flex: 1, overflow: 'hidden' }}>
                                                <Text size="sm" fw={500} truncate>Archivo Adjunto</Text>
                                                <Text size="xs" c="dimmed" truncate>
                                                    {selectedDocument.nombre || 'Documento.pdf'}
                                                </Text>
                                            </Box>
                                        </Group>
                                    </Card>

                                    {resendError && <Alert color="red" variant="filled" title="Error de envío">{resendError}</Alert>}

                                    <Group justify="flex-end" mt="md">
                                        <Button variant="subtle" color="gray" onClick={() => setResendModalOpen(false)} disabled={resendLoading}>Cancelar</Button>
                                        <Button
                                            color="green"
                                            onClick={handleResend}
                                            loading={resendLoading}
                                            leftSection={<IconSend size={16} />}
                                        >
                                            Enviar Correo
                                        </Button>
                                    </Group>
                                </Stack>
                            </>
                        )}
                    </Stack>
                )}
            </Modal>
        </Box>
    );
};
