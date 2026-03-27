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
    Divider
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { 
    IconDeviceFloppy,
    IconX,
    IconEdit,
    IconClipboardList, 
    IconFlask, 
    IconHistory
} from '@tabler/icons-react';

interface Props {
    fichaId: number;
    onBack: () => void;
}

const mapToAntecedentes = (enc: any, agenda: any) => {
    if (!enc) return {};
    agenda = agenda || {};

    let zona = '', utmNorte = '', utmEste = '';
    const coordStr = enc.ma_coordenadas || '';
    const coordMatch = coordStr.match(/^(.*?) UTM (\d+)E (\d+)S/);
    if (coordMatch) {
        zona = coordMatch[1];
        utmNorte = coordMatch[2];
        utmEste = coordMatch[3];
    } else {
        const parts = coordStr.split(' ');
        zona = parts[0] || '';
    }

    let selInst = '';
    let nroInst = '';
    let anioInst = '';
    const rawInst = (enc.instrumento_ambiental || enc.ma_instrumento_ambiental || '').trim();

    if (rawInst && rawInst !== 'No aplica') {
        const upper = rawInst.toUpperCase();
        if (upper.startsWith('RCA')) selInst = 'RCA';
        else if (upper.startsWith('RES. EX') || upper.startsWith('RES EX') || upper.startsWith('RESOLUCION EX')) selInst = 'Res. Ex.';
        else if (upper.startsWith('DECRETO')) selInst = 'Decreto';
        else if (upper.startsWith('CARTA')) selInst = 'Carta';
        else if (upper.startsWith('RES SIS') || upper.startsWith('RESOLUCION SIS')) selInst = 'Res Sis';
        else if (upper.startsWith('DGTM')) selInst = 'DGTM';
        else selInst = 'Otro';

        let rest = rawInst;
        if (selInst !== 'Otro') {
            if (selInst === 'Res. Ex.') rest = rawInst.replace(/^Res\.?\s*Ex(enta)?\.?\s*(N°)?/i, '').trim();
            else if (selInst === 'RCA') rest = rawInst.replace(/^RCA\s*(N°)?/i, '').trim();
            else if (selInst === 'Decreto') rest = rawInst.replace(/^Decreto\s*(N°)?/i, '').trim();
            else if (selInst === 'Carta') rest = rawInst.replace(/^Carta\s*(N°)?/i, '').trim();
            else if (selInst === 'Res Sis') rest = rawInst.replace(/^Res\.?\s*Sis\.?\s*(N°)?/i, '').trim();
            else if (selInst === 'DGTM') rest = rawInst.replace(/^DGTM\s*(N°)?/i, '').trim();
        }

        const splitSlash = rest.split('/');
        if (splitSlash.length === 2) {
            nroInst = splitSlash[0].trim();
            anioInst = splitSlash[1].trim();
        } else {
            nroInst = rest;
        }
    } else if (rawInst === 'No aplica') {
        selInst = 'No aplica';
    }

    return {
        selectedEmpresa: enc.id_empresaservicios,
        selectedCliente: enc.id_empresa,
        selectedFuente: enc.id_centro,
        selectedContacto: (enc.id_contacto === 0 || !enc.id_contacto)
            ? (enc.nombre_contacto === 'No Aplica' ? 'No Aplica' : 'primary')
            : String(enc.id_contacto),
        selectedObjetivo: enc.id_objetivomuestreo_ma,
        selectedComponente: enc.id_tipomuestra,
        selectedSubArea: enc.id_subarea,
        selectedInstrumento: selInst || enc.ma_instrumento_ambiental || '',
        nroInstrumento: nroInst || enc.ma_nro_instrumento || '',
        anioInstrumento: anioInst || enc.ma_anio_instrumento || '',
        selectedInspector: agenda.id_inspectorambiental || enc.id_inspectorambiental || '',
        responsableMuestreo: enc.responsablemuestreo,
        cargoResponsable: enc.id_cargo,
        selectedTipoMuestreo: enc.id_tipomuestreo,
        selectedTipoMuestra: enc.id_tipomuestra_ma,
        selectedActividad: enc.id_actividadmuestreo,
        duracion: enc.ma_duracion_muestreo,
        selectedTipoDescarga: enc.id_tipodescarga,
        refGoogle: enc.referencia_googlemaps,
        medicionCaudal: enc.medicion_caudal,
        selectedModalidad: enc.id_modalidad,
        formaCanal: enc.id_formacanal,
        tipoMedidaCanal: enc.id_um_formacanal,
        detalleCanal: enc.formacanal_medida,
        dispositivo: enc.id_dispositivohidraulico,
        tipoMedidaDispositivo: enc.id_um_dispositivohidraulico,
        detalleDispositivo: enc.dispositivohidraulico_medida,
        frecuencia: agenda.frecuencia || enc.frecuencia || enc.ma_frecuencia,
        totalServicios: agenda.total_servicios || enc.total_servicios || enc.total_servicios_ma,
        factor: agenda.frecuencia_factor || enc.frecuencia_factor,
        periodo: agenda.id_frecuencia || enc.id_frecuencia,
        tipoMonitoreo: enc.tipo_fichaingresoservicio || '',
        selectedLugar: enc.id_lugaranalisis || '',
        puntoMuestreo: enc.ma_punto_muestreo || '',
        zona: zona || '',
        utmNorte: utmNorte || '',
        utmEste: utmEste || '',
        glosa: enc.nombre_tabla || enc.nombre_tabla_largo || enc.glosa || enc.ma_nombre_tabla || ''
    };
};

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

export const CommercialDetailView: React.FC<Props> = ({ fichaId, onBack }) => {
    const { showToast } = useToast();
    const catalogos = useCachedCatalogos();
    const auth = useAuth();
    const { hasPermission } = auth;
    const isMobile = useMediaQuery('(max-width: 500px)');
    const isVerySmall = useMediaQuery('(max-width: 450px)');

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('antecedentes');
    const [data, setData] = useState<any>(null);
    const [laboratorios, setLaboratorios] = useState<any[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [analysisList, setAnalysisList] = useState<any[]>([]);
    const antecedentesRef = useRef<AntecedentesFormHandle>(null);
    const [newObservation, setNewObservation] = useState('');
    const mappedInitialDataRef = useRef<any>(null);
    const [showCancelModal, setShowCancelModal] = useState(false);

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
            showToast({ type: 'error', message: 'Debe ingresar una observación para guardar los cambios.' });
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
                onBack();
            } else {
                showToast({ type: 'error', message: response.message || 'Error al actualizar ficha' });
            }
        } catch (error) {
            showToast({ type: 'error', message: 'Excepción al guardar cambios' });
        } finally {
            setLoading(false);
        }
    };

    if (loading && !data) return <LoadingOverlay visible />;

    const statusObj = getStatusProps(data?.estado_ficha);

    const StaticField = ({ label, value }: { label: string, value: any }) => (
        <Stack gap={2}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">{label}</Text>
            <Paper withBorder p="xs" radius="md" bg="gray.0">
                <Text size="sm" fw={500} truncate title={String(value || '-')}>
                    {value || '-'}
                </Text>
            </Paper>
        </Stack>
    );

    const canEdit = hasPermission('MA_COMERCIAL_EDITAR') && !isEditing && [1, 2, 3, 4].includes(Number(data?.id_validaciontecnica));

    return (
        <Box p="md" style={{ width: '100% !important', maxWidth: '100% !important' }}>
            <Stack gap="lg">
                <PageHeader 
                    title={`Ficha N° ${data?.fichaingresoservicio || '-'}`}
                    subtitle={isEditing ? 'Modo Edición' : 'Detalles de la Ficha'}
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
                                        Editar
                                    </Button>
                                )
                            )}
                        </Group>
                    }
                />

                <Paper withBorder p={0} radius="lg" shadow="sm" style={{ width: '100% !important', maxWidth: '100% !important', overflow: 'hidden' }}>
                    <Stack gap={0}>
                        {/* Alerts */}
                        <Box p={isMobile ? 'md' : 'xl'} pb={0}>
                            {[1, 2, 3, 4, 5, 6, 7].includes(Number(data?.id_validaciontecnica)) && (
                                <Box mb="md">
                                    {data.id_validaciontecnica === 3 && <WorkflowAlert type="info" title="Pendiente Técnica" message="En revisión por el Área Técnica." />}
                                    {data.id_validaciontecnica === 1 && <WorkflowAlert type="info" title="Aprobada Técnica" message="Revisión de Coordinación pendiente." />}
                                    {data.id_validaciontecnica === 2 && <WorkflowAlert type="warning" title="Rechazada Técnica" message="Requiere correcciones comerciales." />}
                                    {data.id_validaciontecnica === 4 && <WorkflowAlert type="warning" title="Rechazada Coordinación" message="Requiere correcciones comerciales." />}
                                    {data.id_validaciontecnica === 5 && <WorkflowAlert type="info" title="En Proceso" message="Ficha con programación activa." />}
                                    {data.id_validaciontecnica === 6 && <WorkflowAlert type="info" title="Aprobada Coordinación" message="Pendiente de programación final." />}
                                    {data.id_validaciontecnica === 7 && <WorkflowAlert type="error" title="Ficha Cancelada" message="Esta ficha ha sido anulada." />}
                                </Box>
                            )}
                        </Box>

                        <Tabs value={activeTab} onChange={(v) => setActiveTab(v || 'antecedentes')} variant="outline" radius="md" mt="xl" style={{ width: '100% !important' }}>
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
                                    {isVerySmall ? 'Historial' : 'Validación e Historial'}
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
                                                    <StaticField label="Normativa" value={data.detalles?.[0]?.nombre_normativa} />
                                                    <StaticField label="Referencia" value={data.detalles?.[0]?.nombre_normativareferencia || data.detalles?.[0]?.nombre_referencia} />
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
                                                            <Table.Th>Laboratorio</Table.Th>
                                                        </Table.Tr>
                                                    </Table.Thead>
                                                    <Table.Tbody>
                                                        {(data.detalles || []).map((row: any, i: number) => (
                                                            <Table.Tr key={i}>
                                                                <Table.Td fw={600}>{row.nombre_tecnica || row.nombre_determinacion || '-'}</Table.Td>
                                                                <Table.Td>{row.nombre_tipomuestra || '-'}</Table.Td>
                                                                <Table.Td ta="right">{row.limitemax_d}</Table.Td>
                                                                <Table.Td ta="right">{row.limitemax_h}</Table.Td>
                                                                <Table.Td ta="center">{row.llevaerror === 'S' || row.llevaerror === true ? 'Sí' : 'No'}</Table.Td>
                                                                <Table.Td>{row.nombre_tipoentrega}</Table.Td>
                                                                <Table.Td>{getLabName(row.id_laboratorioensayo) || 'Interno'}</Table.Td>
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
                                        {isEditing && (
                                            <Paper withBorder p="md" radius="md" bg="green.0">
                                                <Stack gap="sm">
                                                    <Title order={5} c="green.9">Nueva Observación Requerida</Title>
                                                    <Text size="xs" c="green.7">Describa los motivos de los cambios realizados. Esta observación quedará registrada en el historial.</Text>
                                                    <ObservacionesForm
                                                        label=""
                                                        value={newObservation}
                                                        onChange={setNewObservation}
                                                        readOnly={false}
                                                        placeholder="Describa aquí los cambios..."
                                                    />
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
        </Box>
    );
};
