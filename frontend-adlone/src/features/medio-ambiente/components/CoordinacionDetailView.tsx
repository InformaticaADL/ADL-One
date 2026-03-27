import React, { useEffect, useState, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { ObservationTimeline } from './ObservationTimeline';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import { WorkflowAlert } from '../../../components/ui/WorkflowAlert';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { useMediaQuery } from '@mantine/hooks';

import { 
    Button, 
    Text, 
    Title, 
    Stack, 
    Group, 
    Paper, 
    SimpleGrid, 
    Divider,
    Box,
    Table,
    Badge,
    Tabs,
    ScrollArea,
    LoadingOverlay,
    Textarea
} from '@mantine/core';
import { 
    IconCheck, 
    IconRotate,
    IconClipboardList,
    IconFlask,
    IconHistory,
    IconMessageDots
} from '@tabler/icons-react';

interface Props {
    fichaId: number;
    onBack: () => void;
}

export const CoordinacionDetailView: React.FC<Props> = ({ fichaId, onBack }) => {
    const { showToast } = useToast();
    const { user, hasPermission } = useAuth();
    const catalogos = useCachedCatalogos();
    const isMobile = useMediaQuery('(max-width: 500px)');

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('antecedentes');
    const [data, setData] = useState<any>(null);
    const [laboratorios, setLaboratorios] = useState<any[]>([]);
    const [coordinacionObs, setCoordinacionObs] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{
        type: 'approve' | 'reject';
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
        loadFicha();
    }, [fichaId]);

    const loadFicha = async () => {
        if (!fichaId) return;
        setLoading(true);
        try {
            const [response, labsData] = await Promise.all([
                fichaService.getById(fichaId),
                catalogos.getLaboratorios()
            ]);

            const fichaData = response.data || response;
            setData(fichaData);
            setLaboratorios(labsData || []);
            setCoordinacionObs('');
        } catch (error) {
            console.error("Error loading ficha:", error);
            showToast({ type: 'error', message: "Error al cargar ficha" });
        } finally {
            setLoading(false);
        }
    };

    const getLabName = (id: any) => {
        if (!id) return null;
        const lab = laboratorios.find((l: any) => l.id_laboratorioensayo === id || l.id_laboratorioensayo === Number(id));
        return lab ? lab.nombre_laboratorioensayo : null;
    };

    const handleAcceptClick = () => {
        if (!coordinacionObs.trim()) {
            showToast({ type: 'warning', message: 'Debe ingresar una observación para aceptar' });
            setActiveTab('observaciones');
            return;
        }
        setConfirmAction({
            type: 'approve',
            title: 'Confirmar Aprobación',
            message: '¿Está seguro de ACEPTAR esta ficha? Esta acción habilitará la ficha para su programación.'
        });
        setShowConfirmModal(true);
    };

    const handleRejectClick = () => {
        if (!coordinacionObs.trim()) {
            showToast({ type: 'warning', message: 'Debe ingresar una observación para solicitar revisión' });
            setActiveTab('observaciones');
            return;
        }
        setConfirmAction({
            type: 'reject',
            title: 'Solicitar Revisión',
            message: '¿Está seguro de solicitar una REVISIÓN? La ficha volverá al estado anterior para su corrección.'
        });
        setShowConfirmModal(true);
    };

    const onConfirmAction = async () => {
        if (!confirmAction) return;
        setActionLoading(true);
        try {
            if (confirmAction.type === 'approve') {
                await fichaService.approveCoordinacion(fichaId, {
                    observaciones: coordinacionObs,
                    user: { id: user?.id || 0 }
                });
                showToast({ type: 'success', message: 'Observaciones guardadas correctamente' });
            } else {
                await fichaService.reviewCoordinacion(fichaId, {
                    observaciones: coordinacionObs,
                    user: { id: user?.id || 0 }
                });
                showToast({ type: 'success', message: 'Revisión solicitada correctamente' });
            }
            onBack();
        } catch (error) {
            console.error(error);
            showToast({ type: 'error', message: `Error al procesar la ficha` });
        } finally {
            setActionLoading(false);
            setShowConfirmModal(false);
        }
    };

    if (loading && !data) return <LoadingOverlay visible />;

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

    const det = data?.detalles || [];
    const canProcess = hasPermission('MA_COORDINACION_APROBAR') && data?.id_validaciontecnica === 1;

    return (
        <Box p="md" style={{ width: '100% !important', maxWidth: '100% !important' }}>
            <Stack gap="lg">
                 <PageHeader 
                    title={`Gestión Coordinación - Ficha N° ${data?.fichaingresoservicio || '-'}`}
                    subtitle="Validación Final para Programación"
                    onBack={onBack}
                    rightSection={
                        <Group gap="sm">
                            <Badge size="xl" radius="md" variant="light" color={statusObj.color}>
                                {statusObj.label}
                            </Badge>
                        </Group>
                    }
                />

                <Paper withBorder p={0} radius="lg" shadow="sm" style={{ width: '100% !important', maxWidth: '100% !important', overflow: 'hidden' }}>
                    <Stack gap={0}>
                        {/* Status Alerts */}
                        <Box p={isMobile ? 'md' : 'xl'} pb={0}>
                            {[0, 3].includes(data?.id_validaciontecnica || 0) && <WorkflowAlert type="warning" title="Pendiente Técnica" message="Esta ficha aún no ha sido aprobada por el Área Técnica." />}
                            {data?.id_validaciontecnica === 2 && <WorkflowAlert type="error" title="Rechazada Técnica" message="Esta ficha fue rechazada por el Área Técnica y devuelta a Comercial." />}
                            {data?.id_validaciontecnica === 4 && <WorkflowAlert type="error" title="Rechazada Coordinación" message="Ficha rechazada y devuelta al Área Técnica para revisión." />}
                            {[5, 6].includes(data?.id_validaciontecnica || 0) && <WorkflowAlert type="info" title="Gestionada" message="Ficha en proceso de programación o ejecución." />}
                            {data?.id_validaciontecnica === 7 && <WorkflowAlert type="error" title="Ficha Cancelada" message="Esta ficha ha sido anulada." />}
                        </Box>

                        <Tabs value={activeTab} onChange={(v) => setActiveTab(v || 'antecedentes')} variant="outline" radius="md" mt="xl">
                            <Tabs.List grow>
                                <Tabs.Tab 
                                    value="antecedentes" 
                                    leftSection={<IconClipboardList size={isMobile ? 18 : 22} />} 
                                    px={isMobile ? 'xs' : 'xl'} 
                                    py={isMobile ? 'xs' : 'md'}
                                    style={{ flex: '1 1 0%', fontSize: isMobile ? '0.85rem' : '1rem', fontWeight: 600, minWidth: 0, whiteSpace: 'nowrap' }}
                                >
                                    Antecedentes
                                </Tabs.Tab>
                                <Tabs.Tab 
                                    value="analisis" 
                                    leftSection={<IconFlask size={isMobile ? 18 : 22} />} 
                                    px={isMobile ? 'xs' : 'xl'} 
                                    py={isMobile ? 'xs' : 'md'}
                                    style={{ flex: '1 1 0%', fontSize: isMobile ? '0.85rem' : '1rem', fontWeight: 600, minWidth: 0, whiteSpace: 'nowrap' }}
                                >
                                    Análisis
                                </Tabs.Tab>
                                <Tabs.Tab 
                                    value="observaciones" 
                                    leftSection={<IconHistory size={isMobile ? 18 : 22} />} 
                                    px={isMobile ? 'xs' : 'xl'} 
                                    py={isMobile ? 'xs' : 'md'}
                                    style={{ flex: '1 1 0%', fontSize: isMobile ? '0.85rem' : '1rem', fontWeight: 600, minWidth: 0, whiteSpace: 'nowrap' }}
                                >
                                    Validación e Historial
                                </Tabs.Tab>
                            </Tabs.List>

                                <Tabs.Panel value="antecedentes" p={isMobile ? 'md' : 50} pt="xl" style={{ minHeight: '70vh' }}>
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
                                            <StaticField label="¿Es ETFA?" value={data.etfa ? 'Sí' : 'No'} />
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
                                </Tabs.Panel>

                                <Tabs.Panel value="analisis" p={isMobile ? 'md' : 50} pt="xl">
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
                                                        </Table.Tr>
                                                    ))}
                                                </Table.Tbody>
                                            </Table>
                                        </ScrollArea>
                                    </Stack>
                                </Tabs.Panel>

                                <Tabs.Panel value="observaciones" p={isMobile ? 'md' : 50} pt="xl">
                                    <Stack gap="xl">
                                        {canProcess ? (
                                            <Paper withBorder p="md" radius="md" bg="grape.0">
                                                <Stack gap="sm">
                                                    <Group gap="xs">
                                                        <IconMessageDots size={20} color="var(--mantine-color-grape-7)" />
                                                        <Title order={5} c="grape.9">Gestión Coordinación</Title>
                                                    </Group>
                                                    <Text size="xs" c="grape.7">Ingrese las observaciones finales antes de aprobar para programación. Estos comentarios son fundamentales para el éxito del muestreo en terreno.</Text>
                                                    <Textarea
                                                        label="Instrucciones / Observaciones de Coordinación"
                                                        placeholder="Ingrese las observaciones aquí..."
                                                        value={coordinacionObs}
                                                        onChange={(e) => setCoordinacionObs(e.currentTarget.value)}
                                                        minRows={4}
                                                        radius="md"
                                                    />
                                                    <Group justify="flex-end" mt="md">
                                                        <Button color="green" leftSection={<IconCheck size={18} />} onClick={handleAcceptClick} loading={actionLoading}>
                                                            Aprobar para Programación
                                                        </Button>
                                                        <Button variant="light" color="red" leftSection={<IconRotate size={18} />} onClick={handleRejectClick} loading={actionLoading}>
                                                            Devolver a Técnica
                                                        </Button>
                                                    </Group>
                                                </Stack>
                                            </Paper>
                                        ) : (
                                            !hasPermission('MA_COORDINACION_APROBAR') && (
                                                <WorkflowAlert type="warning" title="Sin Permisos" message="No tiene los permisos necesarios para realizar acciones de coordinación en esta ficha." />
                                            )
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
                isOpen={showConfirmModal}
                title={confirmAction?.title || ''}
                message={confirmAction?.message || ''}
                onConfirm={onConfirmAction}
                onCancel={() => setShowConfirmModal(false)}
            />
        </Box>
    );
};
