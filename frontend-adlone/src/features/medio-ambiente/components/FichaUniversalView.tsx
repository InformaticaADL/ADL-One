import React, { useEffect, useState, useRef, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { ObservacionesForm } from './ObservacionesForm';
import { ObservationTimeline } from './ObservationTimeline';
import { WorkflowAlert } from '../../../components/ui/WorkflowAlert';
import { AntecedentesForm, type AntecedentesFormHandle } from './AntecedentesForm';
import { AnalysisForm } from './AnalysisForm';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { useToast } from '../../../contexts/ToastContext';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { mapToAntecedentes } from '../utils/fichaMapping';

import { 
    Button, 
    Text, 
    Title, 
    Stack, 
    Group, 
    Paper, 
    SimpleGrid, 
    Table,
    Badge,
    Tabs, 
    ScrollArea, 
    LoadingOverlay,
    Box,
    Divider,
    Textarea,
    Tooltip
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { 
    IconDeviceFloppy,
    IconX,
    IconEdit,
    IconClipboardList, 
    IconFlask, 
    IconHistory,
    IconCheck, 
    IconRotate,
    IconMessageDots,
    IconFileDownload
} from '@tabler/icons-react';

interface Props {
    fichaId: number;
    onBack: () => void;
}

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

export const FichaUniversalView: React.FC<Props> = ({ fichaId, onBack }) => {
    const { showToast } = useToast();
    const catalogos = useCachedCatalogos();
    const auth = useAuth();
    const { hasPermission, user } = auth;
    const isMobile = useMediaQuery('(max-width: 500px)');
    const isVerySmall = useMediaQuery('(max-width: 450px)');

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('antecedentes');
    const [visitedTabs, setVisitedTabs] = useState({ antecedentes: true, analisis: false, observaciones: false });
    const allTabsVisited = visitedTabs.antecedentes && visitedTabs.analisis && visitedTabs.observaciones;
    const [data, setData] = useState<any>(null);
    const [laboratorios, setLaboratorios] = useState<any[]>([]);
    
    // Edit States
    const [isEditing, setIsEditing] = useState(false);
    const [analysisList, setAnalysisList] = useState<any[]>([]);
    const antecedentesRef = useRef<AntecedentesFormHandle>(null);
    const mappedInitialDataRef = useRef<any>(null);
    const [showCancelModal, setShowCancelModal] = useState(false);

    // Observations for actions
    const [newObservation, setNewObservation] = useState(''); // Comercial
    const [tecnicaObs, setTecnicaObs] = useState(''); // Técnica
    const [coordinacionObs, setCoordinacionObs] = useState(''); // Coordinación

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{
        type: 'approve_tech' | 'reject_tech' | 'approve_coord' | 'reject_coord';
        title: string;
        message: string;
    } | null>(null);

    const timelineCreationData = useMemo(() => {
        if (!data) return undefined;
        return {
            date: data.fecha_fichacomercial || new Date().toISOString(),
            user: data.responsablemuestreo || 'Comercial',
            observation: data.observaciones_comercial || ''
        };
    }, [data]);

    useEffect(() => {
        loadData();
    }, [fichaId]);

    const loadData = async () => {
        if (!fichaId) return;
        setLoading(true);
        try {
            const [fichaResponse, labsData] = await Promise.all([
                fichaService.getById(fichaId),
                catalogos.getLaboratorios()
            ]);

            let fichaData = null;
            if (fichaResponse && fichaResponse.success && fichaResponse.data) {
                fichaData = fichaResponse.data;
            } else if (fichaResponse && (fichaResponse.encabezado || fichaResponse.fichaingresoservicio)) {
                fichaData = fichaResponse;
            }

            if (fichaData) {
                setData(fichaData);
            } else {
                showToast({ type: 'error', message: 'No se pudo cargar la ficha' });
            }
            setLaboratorios(labsData || []);
        } catch (error) {
            console.error("Error loading data:", error);
            showToast({ type: 'error', message: "Error al cargar datos" });
        } finally {
            setLoading(false);
        }
    };

    const getLabName = (id: any) => {
        if (!id) return null;
        const lab = laboratorios.find(l => l.id_laboratorioensayo === id || l.id_laboratorioensayo === Number(id));
        return lab ? lab.nombre_laboratorioensayo : null;
    };

    // Comercial Edit Logic
    const handleEditStart = () => {
        if (!data) return;
        const mappedAnalysis = (data.detalles || []).map((row: any, index: number) => ({
            ...row,
            savedId: `edit-${index}-${Date.now()}`,
            nombre_tecnica: row.nombre_tecnica || row.nombre_determinacion || row.nombre_examen,
            nombre_laboratorioensayo: getLabName(row.id_laboratorioensayo),
            nombre_laboratorioensayo_2: getLabName(row.id_laboratorioensayo_2 || row.id_laboratorioensayo2),
            item: index + 1
        }));

        mappedInitialDataRef.current = mapToAntecedentes(data, data.agenda);
        setAnalysisList(mappedAnalysis);
        setNewObservation('');
        setIsEditing(true);
        setActiveTab('antecedentes');
    };

    const handleSaveChanges = async () => {
        if (!fichaId || !antecedentesRef.current) return;
        if (!newObservation || !newObservation.trim()) {
            showToast({ type: 'warning', message: 'Debe ingresar una observación para guardar los cambios.' });
            setActiveTab('observaciones');
            return;
        }

        const payload = {
            antecedentes: antecedentesRef.current.getData(),
            analisis: analysisList,
            observaciones: newObservation
        };

        try {
            setLoading(true);
            const response = await fichaService.update(fichaId, payload, auth?.user);
            if (response && response.success) {
                showToast({ type: 'success', message: 'Ficha actualizada correctamente' });
                setIsEditing(false);
                setNewObservation('');
                onBack(); // Alternatively reload data
            } else {
                showToast({ type: 'error', message: response.message || 'Error al actualizar ficha' });
            }
        } catch (error) {
            showToast({ type: 'error', message: 'Excepción al guardar cambios' });
        } finally {
            setLoading(false);
        }
    };

    // Tech & Coord Actions
    const handleActionClick = (type: 'approve_tech' | 'reject_tech' | 'approve_coord' | 'reject_coord') => {
        if (type === 'reject_tech' && !tecnicaObs.trim()) {
            showToast({ type: 'warning', message: 'Debe ingresar una observación para rechazar' });
            return;
        }
        if (type === 'approve_coord' && !coordinacionObs.trim()) {
            showToast({ type: 'warning', message: 'Debe ingresar una observación para aceptar' });
            return;
        }
        if (type === 'reject_coord' && !coordinacionObs.trim()) {
            showToast({ type: 'warning', message: 'Debe ingresar una observación para solicitar revisión' });
            return;
        }

        const actionConfig = {
            approve_tech: { title: 'Confirmar Aprobación Técnica', message: '¿Está seguro de ACEPTAR esta ficha técnicamente? Esta acción habilitará la ficha para coordinación.' },
            reject_tech: { title: 'Solicitar Revisión Técnica', message: '¿Está seguro de solicitar una REVISIÓN para esta ficha? Volverá al área comercial para su corrección.' },
            approve_coord: { title: 'Confirmar Aprobación Coordinación', message: '¿Está seguro de ACEPTAR esta ficha? Esta acción habilitará la ficha para su programación.' },
            reject_coord: { title: 'Solicitar Revisión Coordinación', message: '¿Está seguro de solicitar una REVISIÓN? La ficha volverá a Comercial para corrección desde inicio.' }
        };

        setConfirmAction({
            type,
            ...actionConfig[type]
        });
        setShowConfirmModal(true);
    };

    const handleDownloadPdf = async () => {
        if (!fichaId) return;
        try {
            const pdfBlob = await fichaService.downloadPdf(fichaId);
            const url = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            const fileName = data?.caso_adlab || data?.frecuencia_correlativo || `Ficha_${fichaId}`;
            link.href = url;
            link.setAttribute('download', `${fileName}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
        } catch (error) {
            showToast({ type: 'error', message: 'Error al generar el PDF' });
        }
    };

    const processAction = async () => {
        if (!confirmAction) return;
        setActionLoading(true);
        try {
            switch (confirmAction.type) {
                case 'approve_tech':
                    await fichaService.approve(fichaId, { observaciones: tecnicaObs, user: { id: user?.id || 0 } });
                    showToast({ type: 'success', message: 'Ficha ACEPTADA técnicamente' });
                    break;
                case 'reject_tech':
                    await fichaService.reject(fichaId, { observaciones: tecnicaObs, user: { id: user?.id || 0 } });
                    showToast({ type: 'info', message: 'Revisión solicitada a Comercial' });
                    break;
                case 'approve_coord':
                    await fichaService.approveCoordinacion(fichaId, { observaciones: coordinacionObs, user: { id: user?.id || 0 } });
                    showToast({ type: 'success', message: 'Ficha APROBADA para programación' });
                    break;
                case 'reject_coord':
                    await fichaService.reviewCoordinacion(fichaId, { observaciones: coordinacionObs, user: { id: user?.id || 0 } });
                    showToast({ type: 'info', message: 'Ficha devuelta a Comercial' });
                    break;
            }
            onBack();
        } catch (error) {
            console.error(error);
            showToast({ type: 'error', message: 'Error al procesar la ficha' });
        } finally {
            setActionLoading(false);
            setShowConfirmModal(false);
        }
    };

    if (loading && !data) return <LoadingOverlay visible />;

    const statusObj = getStatusProps(data?.estado_ficha);

    const StaticField = ({ label, value }: { label: string, value: any }) => (
        <Stack gap={2}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ whiteSpace: 'nowrap' }} truncate>{label}</Text>
            <Paper withBorder p="xs" radius="md" bg="gray.0">
                <Text size="sm" fw={500} truncate title={String(value || '-')}>
                    {value || '-'}
                </Text>
            </Paper>
        </Stack>
    );

    // Capabilities
    const canEdit = hasPermission('FI_EDITAR') && !isEditing && [1, 2, 3, 4].includes(Number(data?.id_validaciontecnica));
    const canProcessTech = (hasPermission('FI_APROBAR_TEC') || hasPermission('FI_RECHAZAR_TEC')) && [0, 3, 4].includes(data?.id_validaciontecnica || -1);
    const canProcessCoord = (hasPermission('FI_APROBAR_COO') || hasPermission('FI_RECHAZAR_COO')) && data?.id_validaciontecnica === 1;

    const det = data?.detalles || [];

    return (
        <Box p="md" style={{ width: '100% !important', maxWidth: '100% !important' }}>
            <Stack gap="lg">
                <PageHeader 
                    title={`Ficha N° ${data?.fichaingresoservicio || '-'}${data?.es_remuestreo === 'S' ? ` (REMUESTREO DE LA FICHA N° ${data?.id_ficha_original})` : ''}`}
                    subtitle={isEditing ? 'Modo Edición' : 'Visor Universal de Ficha'}
                    onBack={onBack}
                    rightSection={
                        <Group gap="sm">
                            <Badge size="xl" radius="md" variant="light" color={statusObj.color}>
                                {statusObj.label}
                            </Badge>
                            {isEditing ? (
                                <>
                                    <Button color="green" leftSection={<IconDeviceFloppy size={18} />} onClick={handleSaveChanges} loading={loading}>
                                        Guardar
                                    </Button>
                                    <Button variant="light" color="gray" leftSection={<IconX size={18} />} onClick={() => setShowCancelModal(true)}>
                                        Cancelar
                                    </Button>
                                </>
                            ) : (
                                canEdit && (
                                    <Button color="blue" leftSection={<IconEdit size={18} />} onClick={handleEditStart}>
                                        Editar Comercial
                                    </Button>
                                )
                            )}
                            <ProtectedContent permission="FI_EXPORTAR_CFI">
                                <Tooltip 
                                    label={data?.id_validaciontecnica === 2 || data?.id_validaciontecnica === 4 ? 'Atención: Esta ficha ha sido rechazada.' : 'Descargar Ficha Técnica'}
                                    color={data?.id_validaciontecnica === 2 || data?.id_validaciontecnica === 4 ? 'red' : 'blue'}
                                >
                                    <Button 
                                        variant="light" 
                                        color={data?.id_validaciontecnica === 2 || data?.id_validaciontecnica === 4 ? 'red' : 'green'} 
                                        leftSection={<IconFileDownload size={18} />} 
                                        onClick={handleDownloadPdf}
                                    >
                                        Exportar PDF
                                    </Button>
                                </Tooltip>
                            </ProtectedContent>
                        </Group>
                    }
                />

                <Paper withBorder p={0} radius="lg" shadow="sm" style={{ width: '100% !important', maxWidth: '100% !important', overflow: 'hidden' }}>
                    <Stack gap={0}>
                        {/* Unified Alerts */}
                        <Box p={isMobile ? 'md' : 'xl'} pb={0}>
                            {[1, 2, 3, 4, 5, 6, 7].includes(Number(data?.id_validaciontecnica)) && (
                                <Box mb="md">
                                    {data.id_validaciontecnica === 3 && <WorkflowAlert type="warning" title="Pendiente Técnica" message="Esta ficha requiere revisión por el Área Técnica." />}
                                    {data.id_validaciontecnica === 1 && <WorkflowAlert type="info" title="Pendiente Coordinación" message="Aprobada técnicamente. Revisión de Coordinación pendiente." />}
                                    {data.id_validaciontecnica === 2 && <WorkflowAlert type="error" title="Rechazada Técnica" message="Devuelta a Comercial. Requiere correcciones." />}
                                    {data.id_validaciontecnica === 4 && <WorkflowAlert type="error" title="Rechazada Coordinación" message="Devuelta a Comercial. Requiere correcciones de inicio." />}
                                    {data.id_validaciontecnica === 5 && <WorkflowAlert type="info" title="En Proceso / Programación" message="Ficha con programación activa en terreno." />}
                                    {data.id_validaciontecnica === 6 && <WorkflowAlert type="info" title="Aprobada Coordinación" message="Pendiente de ejecución/programación final." />}
                                    {data.id_validaciontecnica === 7 && <WorkflowAlert type="error" title="Ficha Cancelada" message="Esta ficha ha sido anulada en el sistema." />}
                                </Box>
                            )}
                        </Box>

                        <Tabs value={activeTab} onChange={(v) => { setActiveTab(v || 'antecedentes'); setVisitedTabs(prev => ({ ...prev, [v || 'antecedentes']: true })); }} variant="outline" radius="md" mt="xl" style={{ width: '100% !important' }}>
                            <Tabs.List grow>
                                <Tabs.Tab 
                                    value="antecedentes" 
                                    leftSection={<IconClipboardList size={isVerySmall ? 16 : (isMobile ? 18 : 22)} />} 
                                    px={isVerySmall ? 4 : (isMobile ? 'xs' : 'xl')} 
                                    py={isMobile ? 'xs' : 'md'}
                                    style={{ flex: '1 1 0%', fontSize: isVerySmall ? '0.75rem' : (isMobile ? '0.85rem' : '1rem'), fontWeight: 600, minWidth: 0, whiteSpace: 'nowrap' }}
                                >
                                    {isVerySmall ? 'Antec.' : 'Antecedentes'}
                                </Tabs.Tab>
                                <Tabs.Tab 
                                    value="analisis" 
                                    leftSection={<IconFlask size={isVerySmall ? 16 : (isMobile ? 18 : 22)} />} 
                                    px={isVerySmall ? 4 : (isMobile ? 'xs' : 'xl')} 
                                    py={isMobile ? 'xs' : 'md'}
                                    style={{ flex: '1 1 0%', fontSize: isVerySmall ? '0.75rem' : (isMobile ? '0.85rem' : '1rem'), fontWeight: 600, minWidth: 0, whiteSpace: 'nowrap' }}
                                >
                                    {isVerySmall ? 'Análisis' : 'Análisis'}
                                </Tabs.Tab>
                                <Tabs.Tab 
                                    value="observaciones" 
                                    leftSection={<IconHistory size={isVerySmall ? 16 : (isMobile ? 18 : 22)} />} 
                                    px={isVerySmall ? 4 : (isMobile ? 'xs' : 'xl')} 
                                    py={isMobile ? 'xs' : 'md'}
                                    style={{ flex: '1 1 0%', fontSize: isVerySmall ? '0.75rem' : (isMobile ? '0.85rem' : '1rem'), fontWeight: 600, minWidth: 0, whiteSpace: 'nowrap' }}
                                >
                                    {isVerySmall ? 'Historial/Valid.' : 'Validación e Historial'}
                                </Tabs.Tab>
                            </Tabs.List>

                                <Tabs.Panel value="antecedentes" p={isMobile ? 'md' : 50} pt="xl" style={{ width: '100% !important', minHeight: '70vh' }}>
                                    {isEditing ? (
                                        <AntecedentesForm ref={antecedentesRef} initialData={mappedInitialDataRef.current} />
                                    ) : (
                                        <Stack gap="lg">
                                            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                                                <StaticField label="Monitoreo" value={data.tipo_fichaingresoservicio} />
                                                <StaticField label="Base Operaciones" value={data.id_lugaranalisis === 0 ? 'No Aplica' : data.nombre_lugaranalisis} />
                                                <StaticField label="Cliente" value={data.nombre_empresa} />
                                                <StaticField label="Empresa Servicio" value={data.nombre_empresaservicios} />
                                            </SimpleGrid>

                                            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                                                <StaticField label="Fuente Emisora" value={data.nombre_centro} />
                                                <StaticField label="Comuna" value={data.nombre_comuna} />
                                                <StaticField label="Región" value={data.nombre_region} />
                                                <StaticField label="Código Centro" value={data.codigo_centro} />
                                            </SimpleGrid>

                                            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                                                <StaticField label="Tipo Agua" value={data.nombre_tipoagua || data.tipo_agua} />
                                                <StaticField label="Contacto" value={data.nombre_contacto} />
                                                <StaticField label="E-mail" value={data.email_contacto} />
                                                <StaticField label="Objetivo" value={data.nombre_objetivomuestreo_ma} />
                                            </SimpleGrid>

                                            <StaticField label="Tabla / Glosa" value={data.nombre_tabla_largo} />

                                            <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
                                                <StaticField label="Es ETFA" value={data.etfa ? 'Sí' : 'No'} />
                                                <StaticField label="Inspector" value={data.agenda?.nombre_inspector} />
                                                <Box style={{ gridColumn: 'span 2' }}>
                                                    <StaticField label="Punto de Muestreo" value={data.ma_punto_muestreo} />
                                                </Box>
                                            </SimpleGrid>
                                            
                                            <Divider label="Frecuencia y Programación" labelPosition="center" />
                                            
                                            <SimpleGrid cols={{ base: 1, sm: 4 }}>
                                                <StaticField label="Frecuencia" value={data.agenda?.frecuencia} />
                                                <StaticField label="Periodo" value={data.agenda?.nombre_frecuencia} />
                                                <StaticField label="Factor" value={data.agenda?.frecuencia_factor} />
                                                <StaticField label="Total Servicios" value={data.agenda?.total_servicios} />
                                            </SimpleGrid>
                                            <Text size="sm" c="dimmed" fs="italic" ta="center">
                                                {`Se realizarán ${data.agenda?.total_servicios || '—'} muestreo(s) en total, con una frecuencia de ${data.agenda?.frecuencia || '—'} vez/veces cada periodo ${(data.agenda?.nombre_frecuencia || '—').toLowerCase()}, multiplicado por un factor de ${data.agenda?.frecuencia_factor || '—'}.`}
                                            </Text>

                                            <Divider label="Detalles del Servicio" labelPosition="center" />
                                            
                                            <SimpleGrid cols={{ base: 1, sm: 3 }}>
                                                <StaticField label="Componente" value={data.nombre_tipomuestra} />
                                                <StaticField label="Sub Área" value={data.nombre_subarea} />
                                                <StaticField label="Instrumento" value={data.instrumento_ambiental} />
                                            </SimpleGrid>

                                            <SimpleGrid cols={{ base: 1, sm: 4 }}>
                                                <StaticField label="Responsable" value={data.responsablemuestreo} />
                                                <StaticField label="Cargo" value={data.nombre_cargo} />
                                                <StaticField label="Tipo Muestreo" value={data.nombre_tipomuestreo} />
                                                <StaticField label="Actividad" value={data.nombre_actividadmuestreo} />
                                            </SimpleGrid>
                                        </Stack>
                                    )}
                                </Tabs.Panel>

                                <Tabs.Panel value="analisis" p={isMobile ? 'md' : 50} pt="xl" style={{ width: '100% !important' }}>
                                    {isEditing ? (
                                        <AnalysisForm savedAnalysis={analysisList} onSavedAnalysisChange={setAnalysisList} />
                                    ) : (
                                        <Stack gap="xl">
                                            <Paper withBorder p="md" radius="md" bg="blue.0">
                                                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                                                    <StaticField label="Normativa" value={det[0]?.nombre_normativa} />
                                                    <StaticField label="Referencia" value={det[0]?.nombre_normativareferencia || det[0]?.nombre_referencia} />
                                                </SimpleGrid>
                                            </Paper>

                                            <ScrollArea>
                                                <Table striped highlightOnHover withTableBorder>
                                                    <Table.Thead bg="gray.1">
                                                        <Table.Tr>
                                                            <Table.Th>Análisis</Table.Th>
                                                            <Table.Th>Tipo Muestra</Table.Th>
                                                            <Table.Th ta="right">Límite Min</Table.Th>
                                                            <Table.Th ta="right">Límite Max</Table.Th>
                                                            <Table.Th ta="center">Error</Table.Th>
                                                            <Table.Th>Tipo Entrega</Table.Th>
                                                            <Table.Th>Lab. Principal</Table.Th>
                                                            <Table.Th>Lab. Secundario</Table.Th>
                                                            {hasPermission('FI_EXP_VER_UF') && <Table.Th ta="center">UF</Table.Th>}
                                                        </Table.Tr>
                                                    </Table.Thead>
                                                    <Table.Tbody>
                                                        {det.map((row: any, i: number) => (
                                                            <Table.Tr key={i}>
                                                                <Table.Td fw={600}>{row.nombre_tecnica || row.nombre_determinacion || '-'}</Table.Td>
                                                                <Table.Td>{row.tipo_analisis || row.nombre_tipomuestra || '-'}</Table.Td>
                                                                <Table.Td ta="right">{row.limitemax_d}</Table.Td>
                                                                <Table.Td ta="right">{row.limitemax_h}</Table.Td>
                                                                <Table.Td ta="center">{row.llevaerror === 'S' || row.llevaerror === true ? 'Sí' : 'No'}</Table.Td>
                                                                <Table.Td>{row.nombre_tipoentrega}</Table.Td>
                                                                <Table.Td>{getLabName(row.id_laboratorioensayo) || 'Interno'}</Table.Td>
                                                                <Table.Td>{getLabName(row.id_laboratorioensayo_2) || '-'}</Table.Td>
                                                                {hasPermission('FI_EXP_VER_UF') && (
                                                                    <Table.Td ta="center">
                                                                        <Text size="sm" fw={700} c="blue.7">{row.uf_individual > 0 ? Number(row.uf_individual).toFixed(2) : '—'}</Text>
                                                                    </Table.Td>
                                                                )}
                                                            </Table.Tr>
                                                        ))}
                                                    </Table.Tbody>
                                                </Table>
                                            </ScrollArea>
                                        </Stack>
                                    )}
                                </Tabs.Panel>

                                <Tabs.Panel value="observaciones" p={isMobile ? 'md' : 50} pt="xl" style={{ width: '100% !important' }}>
                                    <Stack gap="xl">
                                        {/* Bloque: Edición Comercial */}
                                        {isEditing && (
                                            <Paper withBorder p="md" radius="md" bg="green.0">
                                                <Stack gap="sm">
                                                    <Title order={5} c="green.9">Nueva Observación Comercial Requerida</Title>
                                                    <Text size="xs" c="green.7">Describa los motivos de los cambios realizados comercialmente.</Text>
                                                    <Textarea
                                                        value={newObservation}
                                                        onChange={(e) => setNewObservation(e.currentTarget.value)}
                                                        placeholder="Describa aquí los cambios..."
                                                        minRows={3}
                                                    />
                                                </Stack>
                                            </Paper>
                                        )}

                                        {/* Bloque: Acción Técnica */}
                                        {!isEditing && canProcessTech && (
                                            <Paper withBorder p="md" radius="md" bg="blue.0">
                                                <Stack gap="sm">
                                                    <Group gap="xs">
                                                        <IconMessageDots size={20} color="var(--mantine-color-blue-7)" />
                                                        <Title order={5} c="blue.9">Gestión Técnica: Validación</Title>
                                                    </Group>
                                                    <Text size="xs" c="blue.7">Ingrese sus observaciones técnicas antes de aprobar o solicitar revisión.</Text>
                                                    <Textarea
                                                        placeholder="Ingrese sus observaciones técnicas aquí..."
                                                        value={tecnicaObs}
                                                        onChange={(e) => setTecnicaObs(e.currentTarget.value)}
                                                        minRows={3}
                                                        radius="md"
                                                    />
                                                    <Group justify="flex-end" mt="md">
                                                        <ProtectedContent permission="FI_APROBAR_TEC">
                                                            <Tooltip label="Debe visualizar todas las pestañas (Antecedentes, Análisis, Historial) antes de probar" disabled={allTabsVisited} color="red">
                                                                <Box display="inline-block">
                                                                    <Button color="blue" leftSection={<IconCheck size={18} />} onClick={() => handleActionClick('approve_tech')} loading={actionLoading} disabled={!allTabsVisited}>
                                                                        Aprobar Técnica
                                                                    </Button>
                                                                </Box>
                                                            </Tooltip>
                                                        </ProtectedContent>
                                                        <ProtectedContent permission="FI_RECHAZAR_TEC">
                                                            <Button variant="light" color="red" leftSection={<IconRotate size={18} />} onClick={() => handleActionClick('reject_tech')} loading={actionLoading}>
                                                                Pedir Corrección Comercial
                                                            </Button>
                                                        </ProtectedContent>
                                                    </Group>
                                                </Stack>
                                            </Paper>
                                        )}

                                        {/* Bloque: Acción Coordinación */}
                                        {!isEditing && canProcessCoord && (
                                            <Paper withBorder p="md" radius="md" bg="grape.0">
                                                <Stack gap="sm">
                                                    <Group gap="xs">
                                                        <IconMessageDots size={20} color="var(--mantine-color-grape-7)" />
                                                        <Title order={5} c="grape.9">Gestión Coordinación: Aprobación Logística</Title>
                                                    </Group>
                                                    <Text size="xs" c="grape.7">Ingrese comentarios operativos finales antes de habilitar la Ficha para programación y asignación de terreno.</Text>
                                                    <Textarea
                                                        placeholder="Ingrese las observaciones de coordinación aquí..."
                                                        value={coordinacionObs}
                                                        onChange={(e) => setCoordinacionObs(e.currentTarget.value)}
                                                        minRows={3}
                                                        radius="md"
                                                    />
                                                    <Group justify="flex-end" mt="md">
                                                        <ProtectedContent permission="FI_APROBAR_COO">
                                                            <Tooltip label="Debe visualizar todas las pestañas (Antecedentes, Análisis, Historial) antes de probar" disabled={allTabsVisited} color="red">
                                                                <Box display="inline-block">
                                                                    <Button color="grape" leftSection={<IconCheck size={18} />} onClick={() => handleActionClick('approve_coord')} loading={actionLoading} disabled={!allTabsVisited}>
                                                                        Aprobar Coordinación
                                                                    </Button>
                                                                </Box>
                                                            </Tooltip>
                                                        </ProtectedContent>
                                                        <ProtectedContent permission="FI_RECHAZAR_COO">
                                                            <Button variant="light" color="red" leftSection={<IconRotate size={18} />} onClick={() => handleActionClick('reject_coord')} loading={actionLoading}>
                                                                Devolver a Comercial
                                                            </Button>
                                                        </ProtectedContent>
                                                    </Group>
                                                </Stack>
                                            </Paper>
                                        )}
                                        
                                        <Box>
                                            <Title order={4} mb="lg" fw={700}>Línea de Tiempo y Validación</Title>
                                            <ObservationTimeline fichaId={fichaId} creationData={timelineCreationData} />
                                        </Box>
                                    </Stack>
                                </Tabs.Panel>
                        </Tabs>
                    </Stack>
                </Paper>
            </Stack>

            <ConfirmModal
                isOpen={showCancelModal}
                title="Descartar cambios"
                message="¿Estás seguro de que deseas cancelar la edición? Los cambios no guardados se perderán."
                onConfirm={() => {
                    setIsEditing(false);
                    setShowCancelModal(false);
                }}
                onCancel={() => setShowCancelModal(false)}
            />

            <ConfirmModal
                isOpen={showConfirmModal}
                title={confirmAction?.title || ''}
                message={confirmAction?.message || ''}
                confirmColor={confirmAction?.type.includes('approve') ? '#10b981' : '#ef4444'}
                onConfirm={processAction}
                onCancel={() => setShowConfirmModal(false)}
            />
        </Box>
    );
};
