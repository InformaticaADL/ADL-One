import React, { useState, useEffect, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { useCatalogos } from '../context/CatalogosContext';
import { catalogosService } from '../services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { adminService } from '../../../services/admin.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { 
    Stack, 
    Paper, 
    TextInput, 
    Select, 
    Button, 
    Table, 
    Badge, 
    Group, 
    ScrollArea,
    Text,
    Divider,
    Box,
    LoadingOverlay,
    Alert,
    Modal,
    Radio
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { 
    IconCalendarEvent,
    IconUserPlus, 
    IconDeviceFloppy, 
    IconBolt,
    IconInfoCircle,
    IconBuilding,
    IconTarget,
    IconMapPin,
    IconUser
} from '@tabler/icons-react';

interface Props {
    fichaId: number;
    onBack: () => void;
}

export const AssignmentDetailView: React.FC<Props> = ({ fichaId, onBack }) => {
    // Context & Services
    const { getCatalogo } = useCatalogos();
    const { showToast } = useToast();
    const { user } = useAuth();

    // State
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [muestreadores, setMuestreadores] = useState<any[]>([]);

    const [muestreadorInstalacion, setMuestreadorInstalacion] = useState<Record<number, number>>({});
    const [muestreadorRetiro, setMuestreadorRetiro] = useState<Record<number, number>>({});
    const [selectedDate, setSelectedDate] = useState('');
    const [dbFieldValue, setDbFieldValue] = useState(''); 
    const [frequencyDays, setFrequencyDays] = useState<number>(0);
    const [numericFrequency, setNumericFrequency] = useState<number>(1);
    const [frecuenciaFactor, setFrecuenciaFactor] = useState<number>(1);
    const [totalServicios, setTotalServicios] = useState<number>(0);
    const [duracionMuestreo, setDuracionMuestreo] = useState<number>(0);
    const [editableDates, setEditableDates] = useState<Record<number, string>>({});
    const [editableRetiroDates, setEditableRetiroDates] = useState<Record<number, string>>({});

    // New State for Versions Comparison
    const [versionModalOpen, setVersionModalOpen] = useState(false);
    const [comparisonLoading, setComparisonLoading] = useState(false);
    const [comparisonData, setComparisonData] = useState<any[]>([]);
    const [activeRowCorrelativo, setActiveRowCorrelativo] = useState('');
    // State to store chosen versions: { correlativo: { idEquipo: 'original' | 'nueva' } }
    const [equipmentSelections, setEquipmentSelections] = useState<Record<string, Record<number, 'original' | 'nueva'>>>({});

    const resamplingData = useMemo(() => {
        if (rows.length === 0) return null;
        const first = rows[0];
        // Normalización para SQL Server (puede venir como 'S', 1 o boolean)
        if (first.es_remuestreo !== 'S' && first.es_remuestreo !== true && first.es_remuestreo !== 1) return null;
        
        return {
            idOriginal: first.id_ficha_original,
            nombreOriginal: first.nombre_muestreador_original,
            idMuestreadorOriginal: first.id_muestreador_original
        };
    }, [rows]);

    const handleTechnicianChange = (rowId: number, newId: number, type: 'instalacion' | 'retiro') => {
        const applyChange = () => {
            if (type === 'instalacion') {
                setMuestreadorInstalacion(p => ({ ...p, [rowId]: newId }));
                if (!muestreadorRetiro[rowId]) {
                    setMuestreadorRetiro(p => ({ ...p, [rowId]: newId }));
                }
            } else {
                setMuestreadorRetiro(p => ({ ...p, [rowId]: newId }));
            }
        };

        // Validación de conflicto (Remuestreo) - Pop up modal
        if (resamplingData && resamplingData.idMuestreadorOriginal && newId !== 0 && newId !== resamplingData.idMuestreadorOriginal) {
            modals.openConfirmModal({
                title: 'Confirmar Cambio de Muestreador',
                centered: true,
                children: (
                    <Stack gap="xs">
                        <Text size="sm">
                            Atención: El muestreador seleccionado no es el que realizó el muestreo original (<b>{resamplingData.nombreOriginal}</b>).
                        </Text>
                        <Text size="sm" c="dimmed">
                            Cambiar el muestreador en un remuestreo puede generar conflictos técnicos, ya que el nuevo muestreador podría no contar con los mismos equipos o conocimientos específicos utilizados en el muestreo original.
                        </Text>
                        <Text size="sm" fw={500}>
                            ¿Desea proceder con esta asignación de todas formas?
                        </Text>
                    </Stack>
                ),
                labels: { confirm: 'Confirmar Asignación', cancel: 'Cancelar' },
                confirmProps: { color: 'orange' },
                onConfirm: applyChange
            });
        } else {
            applyChange();
        }
    };

    const handleViewVersions = async (idMuestreador: number, correlativo: string) => {
        if (!resamplingData?.idOriginal || !idMuestreador) return;
        
        setComparisonLoading(true);
        setVersionModalOpen(true);
        setActiveRowCorrelativo(correlativo);
        
        try {
            const response = await adminService.getEquipmentComparison(resamplingData.idOriginal, fichaId, idMuestreador);
            if (response.success) {
                setComparisonData(response.data);
                
                // Initialize selections for this correlativo if not set
                if (!equipmentSelections[correlativo]) {
                    const initial: Record<number, 'original' | 'nueva'> = {};
                    response.data.forEach((item: any) => {
                        // Default to original if version is the same, otherwise require choice?
                        // Let's default to original to be safer in resampling
                        initial[item.id_equipo] = 'original';
                    });
                    setEquipmentSelections(prev => ({ ...prev, [correlativo]: initial }));
                }
            } else {
                showToast({ message: 'Error al obtener comparación de equipos', type: 'error' });
            }
        } catch (error) {
            console.error("Error fetching comparison:", error);
            showToast({ message: 'Error al conectar con el servidor', type: 'error' });
        } finally {
            setComparisonLoading(false);
        }
    };

    const handleBulkSelection = (type: 'original' | 'nueva') => {
        if (!activeRowCorrelativo || comparisonData.length === 0) return;
        
        const newSelections = { ...equipmentSelections[activeRowCorrelativo] };
        comparisonData.forEach(item => {
            newSelections[item.id_equipo] = type;
        });
        
        setEquipmentSelections(prev => ({
            ...prev,
            [activeRowCorrelativo]: newSelections
        }));
    };

    const loadAssignmentData = async () => {
        setLoading(true);
        try {
            const data = await fichaService.getAssignmentDetail(fichaId);
            if (Array.isArray(data)) {
                setRows(data);
                if (data.length > 0) {
                    setDbFieldValue(data[0].nombre_frecuencia || '');
                    setFrequencyDays(data[0].dias || 0);
                    setNumericFrequency(Number(data[0].frecuencia) || 1);
                    setFrecuenciaFactor(Number(data[0].frecuencia_factor) || 1);
                    setTotalServicios(Number(data[0].total_servicios) || data.length);
                    setDuracionMuestreo(Number(data[0].ma_duracion_muestreo) || 0);

                    const existingDates: Record<number, string> = {};
                    const existingRetiroDates: Record<number, string> = {};
                    const existingInstalacion: Record<number, number> = {};
                    const existingRetiro: Record<number, number> = {};

                    let firstRowDate = '';

                    data.forEach((row: any) => {
                        let samplingDate = '';
                        if (row.fecha_muestreo && !['  /  /    ', '01/01/1900', '1900-01-01'].includes(row.fecha_muestreo)) {
                            samplingDate = formatDate(row.fecha_muestreo);
                        } else if (row.dia && row.mes && row.ano) {
                            samplingDate = `${row.ano}-${String(row.mes).padStart(2, '0')}-${String(row.dia).padStart(2, '0')}`;
                        }

                        if (samplingDate) {
                            existingDates[row.id_agendamam] = samplingDate;
                            if (!firstRowDate) firstRowDate = samplingDate;
                        }

                        if (row.fecha_retiro && !['01/01/1900', '1900-01-01', '  /  /    '].includes(row.fecha_retiro)) {
                            existingRetiroDates[row.id_agendamam] = formatDate(row.fecha_retiro);
                        }

                        if (row.id_muestreador) existingInstalacion[row.id_agendamam] = row.id_muestreador;
                        if (row.id_muestreador2) existingRetiro[row.id_agendamam] = row.id_muestreador2;
                    });

                    setEditableDates(existingDates);
                    setEditableRetiroDates(existingRetiroDates);
                    setMuestreadorInstalacion(existingInstalacion);
                    setMuestreadorRetiro(existingRetiro);
                    if (firstRowDate && !selectedDate) setSelectedDate(firstRowDate);
                }
            }
        } catch (error) {
            console.error("Error loading assignment data:", error);
            showToast({ message: 'Error al cargar datos de asignación', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date: any) => {
        if (!date) return '';
        let dateStr = '';
        if (typeof date === 'string') {
            if (date.includes('T')) dateStr = date.split('T')[0];
            else if (date.includes('/')) {
                const parts = date.split('/');
                if (parts.length === 3) dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else if (date.includes('-')) dateStr = date;
        } else if (date instanceof Date) {
            dateStr = date.toISOString().split('T')[0];
        }
        return dateStr;
    };

    useEffect(() => {
        const loadInitialData = async () => {
            await loadAssignmentData();
            try {
                const mData = await getCatalogo('muestreadores', () => catalogosService.getMuestreadores());
                setMuestreadores(mData || []);
            } catch (err) {
                console.error("Error loading muestreadores:", err);
            }
        };

        if (fichaId) {
            loadInitialData();
        }
    }, [fichaId]);

    const handleCalculateDates = () => {
        if (rows.length === 0 || !selectedDate) return;

        const newDates: Record<number, string> = {};
        const newRetiroDates: Record<number, string> = {};
        const dayOffset = Math.floor(duracionMuestreo / 24);
        const isMensual = dbFieldValue?.toUpperCase().includes('MENSUAL');

        rows.forEach((row, index) => {
            const base = new Date(selectedDate + 'T00:00:00');
            if (isMensual) {
                const monthOffset = Math.floor(index / numericFrequency);
                const partOfMonth = index % numericFrequency;
                const daysOffset = Math.floor((30 / numericFrequency) * partOfMonth);
                base.setMonth(base.getMonth() + monthOffset);
                base.setDate(base.getDate() + daysOffset);
            } else {
                const interval = (frequencyDays / numericFrequency) * index;
                base.setDate(base.getDate() + Math.floor(interval));
            }
            
            const retirementDateStr = base.toISOString().split('T')[0];
            newRetiroDates[row.id_agendamam] = retirementDateStr;

            const instDate = new Date(retirementDateStr + 'T00:00:00');
            instDate.setDate(instDate.getDate() - dayOffset);
            newDates[row.id_agendamam] = instDate.toISOString().split('T')[0];
        });

        setEditableDates(newDates);
        setEditableRetiroDates(newRetiroDates);
        showToast({ message: 'Fechas calculadas según programación', type: 'success' });
    };

    const handleSaveAssignment = async () => {
        if (rows.some(r => !editableDates[r.id_agendamam])) {
            showToast({ message: 'Debe calcular o ingresar fechas para todos los registros', type: 'warning' });
            return;
        }

        if (rows.some(r => !muestreadorInstalacion[r.id_agendamam])) {
            showToast({ message: 'Debe seleccionar Muestreador de Instalación para todos los registros', type: 'warning' });
            return;
        }

        if (resamplingData) {
            const rowsMissingVersions = rows.filter(r => 
                muestreadorInstalacion[r.id_agendamam] === resamplingData.idMuestreadorOriginal && 
                !equipmentSelections[r.frecuencia_correlativo]
            );
            
            if (rowsMissingVersions.length > 0) {
                showToast({ 
                    message: `Debe seleccionar las versiones de equipos para ${rowsMissingVersions.length} registros de remuestreo`, 
                    type: 'warning' 
                });
                return;
            }
        }

        const executeSave = async () => {
            setSaving(true);
            try {
                const assignments = rows.map((row: any) => ({
                    id: row.id_agendamam,
                    fecha: editableDates[row.id_agendamam],
                    fechaRetiro: editableRetiroDates[row.id_agendamam] || editableDates[row.id_agendamam],
                    idMuestreadorInstalacion: muestreadorInstalacion[row.id_agendamam],
                    idMuestreadorRetiro: muestreadorRetiro[row.id_agendamam] || muestreadorInstalacion[row.id_agendamam],
                    idFichaIngresoServicio: row.id_fichaingresoservicio,
                    frecuenciaCorrelativo: row.frecuencia_correlativo,
                    equipmentSelections: equipmentSelections[row.frecuencia_correlativo] || null,
                    // Send full data of items for easier backend processing
                    equipmentComparisonData: equipmentSelections[row.frecuencia_correlativo] ? comparisonData : null
                }));

                const response = await fichaService.batchUpdateAgenda({
                    assignments,
                    user: user ? { id: user.id } : { id: 0 },
                    observaciones: 'Asignación de recursos y programación masiva desde sistema.'
                });

                showToast({ message: response.message || 'Asignación guardada correctamente', type: 'success' });
                setTimeout(() => onBack(), 1500);
            } catch (error) {
                console.error("Error saving assignment:", error);
                showToast({ message: 'Error al guardar la asignación', type: 'error' });
            } finally {
                setSaving(false);
            }
        };

        // Verificación final de conflictos de muestreador (solo para remuestreos)
        const hasConflicts = resamplingData && rows.some(row => {
            const instId = muestreadorInstalacion[row.id_agendamam];
            const retId = muestreadorRetiro[row.id_agendamam] || instId;
            const originalId = resamplingData.idMuestreadorOriginal;
            return (instId && instId !== originalId) || (retId && retId !== originalId);
        });

        if (hasConflicts) {
            modals.openConfirmModal({
                title: 'Confirmar Guardado con Conflictos',
                centered: true,
                size: 'md',
                children: (
                    <Stack gap="sm">
                        <Text size="sm">
                            Se ha detectado que uno o más muestreadores asignados <b>no coinciden</b> con el muestreador original de la ficha <b>#{resamplingData?.idOriginal}</b> ({resamplingData?.nombreOriginal}).
                        </Text>
                        <Text size="sm" c="orange" fw={500}>
                            Atención: Realizar un remuestreo con personal distinto puede derivar en inconsistencias técnicas, falta de equipos específicos o fallos en la metodología aplicada originalmente.
                        </Text>
                        <Text size="sm">
                            ¿Está seguro que desea proceder con el guardado de la planificación actual?
                        </Text>
                    </Stack>
                ),
                labels: { confirm: 'Confirmar y Guardar', cancel: 'Volver a Revisar' },
                confirmProps: { color: 'orange' },
                onConfirm: executeSave
            });
        } else {
            executeSave();
        }
    };

    const muestreadorOptions = useMemo(() => 
        muestreadores.map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador })),
        [muestreadores]
    );

    return (
        <Box p="md" style={{ width: '100%' }}>
            <Stack gap="lg">
                <PageHeader 
                    title={`Asignación de Recursos - Ficha ${fichaId}${resamplingData ? ` (REMUESTREO DE LA FICHA N° ${resamplingData.idOriginal})` : ''}`}
                    subtitle={resamplingData ? "Gestione la asignación para este remuestreo" : "Defina fechas y muestreadores responsables para cada servicio"}
                    onBack={onBack}
                    rightSection={
                        <ProtectedContent permission="FI_GEST_ASIG">
                            <Button 
                                color="grape" 
                                size="md" 
                                leftSection={<IconDeviceFloppy size={20} />} 
                                onClick={handleSaveAssignment} 
                                loading={saving}
                            >
                                Guardar Planificación
                            </Button>
                        </ProtectedContent>
                    }
                />

                {resamplingData && (
                    <Alert icon={<IconInfoCircle size="1.1rem" />} title="Ficha de Remuestreo" color="blue" radius="md" variant="light">
                        Esta ficha corresponde a un remuestreo de la ficha <b>#{resamplingData.idOriginal}</b>. 
                        El muestreador original fue: <b>{resamplingData.nombreOriginal || 'No identificado'}</b>.
                        Se recomienda asignar al mismo muestreador para evitar conflictos de equipamiento, o verificar la disponibilidad de equipos equivalentes.
                    </Alert>
                )}

                <Paper withBorder p="xl" radius="lg" shadow="sm">
                    <Stack gap="xl">
                        {/* Unified Configuration & Metadata Header */}
                        <Paper withBorder p="md" radius="md" bg="gray.1" shadow="xs">
                            <Group justify="space-between" align="center">
                                {/* Left Side: Technical Metrics */}
                                <Group gap="lg">
                                    <Stack gap={0} align="center">
                                        <Text size="xs" fw={700} c="dimmed" tt="uppercase">Frecuencia</Text>
                                        <Text fw={700} size="sm">{numericFrequency} {rows[0]?.nombre_frecuencia ? `(${rows[0].nombre_frecuencia})` : ''}</Text>
                                    </Stack>
                                    <Divider orientation="vertical" />
                                    <Stack gap={0} align="center">
                                        <Text size="xs" fw={700} c="dimmed" tt="uppercase">Periodo</Text>
                                        <Text fw={700} size="sm">{dbFieldValue || '-'}</Text>
                                    </Stack>
                                    <Divider orientation="vertical" />
                                    <Stack gap={0} align="center">
                                        <Text size="xs" fw={700} c="dimmed" tt="uppercase">Factor</Text>
                                        <Text fw={700} size="sm">{frecuenciaFactor}</Text>
                                    </Stack>
                                    <Divider orientation="vertical" />
                                    <Stack gap={0} align="center">
                                        <Text size="xs" fw={700} c="dimmed" tt="uppercase">Servicios</Text>
                                        <Badge color="blue" variant="filled">{totalServicios}</Badge>
                                    </Stack>
                                    <Divider orientation="vertical" />
                                    <Stack gap={0} align="center">
                                        <Text size="xs" fw={700} c="dimmed" tt="uppercase">Duración</Text>
                                        <Text fw={700} size="sm">{duracionMuestreo} hrs</Text>
                                    </Stack>
                                </Group>

                                {/* Right Side: Ficha Metadata */}
                                {rows[0] && (
                                    <Group gap="xl">
                                        <Group gap="xs">
                                            <IconBuilding size={16} color="gray" />
                                            <Stack gap={0}>
                                                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Empresa</Text>
                                                <Text size="sm" fw={600}>{rows[0].empresa_servicio}</Text>
                                            </Stack>
                                        </Group>
                                        <Group gap="xs">
                                            <IconTarget size={16} color="gray" />
                                            <Stack gap={0}>
                                                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Objetivo</Text>
                                                <Text size="sm" fw={600}>{rows[0].nombre_objetivomuestreo}</Text>
                                            </Stack>
                                        </Group>
                                        <Group gap="xs">
                                            <IconMapPin size={16} color="gray" />
                                            <Stack gap={0}>
                                                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Sub-Área</Text>
                                                <Text size="sm" fw={600}>{rows[0].nombre_subarea}</Text>
                                            </Stack>
                                        </Group>
                                    </Group>
                                )}
                            </Group>
                        </Paper>

                        <Divider />

                        {/* Bulk Assignment Controls */}
                        <Group align="flex-end" justify="center" gap="xl">
                            <ProtectedContent permission="FI_GEST_ASIG">
                                <Group align="flex-end">
                                    <TextInput 
                                        size="xs"
                                        label="Fecha Referencia (Muestreo)" 
                                        type="date" 
                                        value={selectedDate} 
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSelectedDate(val);
                                        }} 
                                        leftSection={<IconCalendarEvent size={14} />}
                                    />
                                    <Button 
                                        size="xs"
                                        variant="light" 
                                        color="blue" 
                                        leftSection={<IconBolt size={14} />} 
                                        onClick={handleCalculateDates}
                                        disabled={!selectedDate}
                                    >
                                        Auto-Calcular
                                    </Button>
                                </Group>
                            </ProtectedContent>

                            <Divider orientation="vertical" />

                            <ProtectedContent permission="FI_GEST_ASIG">
                                <Group align="flex-end">
                                    <Select 
                                        size="xs"
                                        label="M. Instalación (Todos)" 
                                        placeholder="Seleccionar..." 
                                        data={muestreadorOptions}
                                        onChange={(val) => {
                                            if (val) {
                                                const id = Number(val);
                                                const applyBulk = () => {
                                                    const newInst: Record<number, number> = {}; 
                                                    const newRet: Record<number, number> = {};
                                                    rows.forEach(r => {
                                                        newInst[r.id_agendamam as number] = id;
                                                        newRet[r.id_agendamam as number] = muestreadorRetiro[r.id_agendamam] || id;
                                                    });
                                                    setMuestreadorInstalacion(newInst);
                                                    setMuestreadorRetiro(newRet);
                                                };
                                                if (resamplingData && resamplingData.idMuestreadorOriginal && id !== resamplingData.idMuestreadorOriginal) {
                                                    modals.openConfirmModal({
                                                        title: 'Confirmar Asignación',
                                                        children: <Text size="sm">¿Asignar a muestreador distinto al original?</Text>,
                                                        labels: { confirm: 'Sí', cancel: 'No' },
                                                        onConfirm: applyBulk
                                                    });
                                                } else { applyBulk(); }
                                            }
                                        }}
                                        searchable
                                        leftSection={<IconUserPlus size={14} />}
                                    />
                                    <Select 
                                        size="xs"
                                        label="M. Retiro (Todos)" 
                                        placeholder="Seleccionar..." 
                                        data={muestreadorOptions}
                                        onChange={(val) => {
                                            if (val) {
                                                const id = Number(val);
                                                const applyBulkRetiro = () => {
                                                    const newRet: Record<number, number> = {};
                                                    rows.forEach(r => { newRet[r.id_agendamam as number] = id; });
                                                    setMuestreadorRetiro(newRet);
                                                };
                                                if (resamplingData && resamplingData.idMuestreadorOriginal && id !== resamplingData.idMuestreadorOriginal) {
                                                    modals.openConfirmModal({
                                                        title: 'Confirmar Asignación',
                                                        children: <Text size="sm">¿Asignar a retiro distinto al original?</Text>,
                                                        labels: { confirm: 'Sí', cancel: 'No' },
                                                        onConfirm: applyBulkRetiro
                                                    });
                                                } else { applyBulkRetiro(); }
                                            }
                                        }}
                                        searchable
                                        leftSection={<IconUserPlus size={14} />}
                                    />
                                </Group>
                            </ProtectedContent>
                        </Group>

                        <Divider />

                        {/* Assignments Table */}
                        <Box pos="relative">
                            <LoadingOverlay visible={loading} />
                            <ScrollArea h={500}>
                                <Table 
                                    striped 
                                    highlightOnHover 
                                    withTableBorder 
                                    withColumnBorders
                                    verticalSpacing={4} 
                                    horizontalSpacing={4}
                                    style={{ fontSize: '11px' }}
                                >
                                    <Table.Thead bg="gray.1">
                                        <Table.Tr>
                                            <Table.Th w={50} ta="center">Ficha</Table.Th>
                                            <Table.Th w={160} ta="center">Correlativo</Table.Th>
                                            <Table.Th w={90} ta="center">Estado</Table.Th>
                                            <Table.Th w={135} ta="center">F. Instalación</Table.Th>
                                            <Table.Th w={135} ta="center">F. Muestreo</Table.Th>
                                            <Table.Th w={130} ta="center">Coordinador</Table.Th>
                                            <Table.Th w={145} ta="center">
                                                <Group gap={4} wrap="nowrap" justify="center">
                                                    M. Instalación
                                                    <Text size="9px" c="blue" fw={700}>(Orig.)</Text>
                                                </Group>
                                            </Table.Th>
                                            <Table.Th w={145} ta="center">
                                                <Group gap={4} wrap="nowrap" justify="center">
                                                    M. Retiro
                                                    <Text size="9px" c="blue" fw={700}>(Orig.)</Text>
                                                </Group>
                                            </Table.Th>
                                            <Table.Th w={135} ta="center"></Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {rows.map((row) => {
                                            const isCancelled = ['CANCELADO', 'ANULADO'].includes((row.nombre_estadomuestreo || '').toUpperCase());
                                            const rowId = row.id_agendamam;
                                            
                                            return (
                                                <Table.Tr key={rowId} style={{ opacity: isCancelled ? 0.5 : 1 }}>
                                                    <Table.Td ta="center">{row.num_ficha}</Table.Td>
                                                    <Table.Td ta="center" fw={700}>{row.frecuencia_correlativo}</Table.Td>
                                                    <Table.Td ta="center">
                                                        <Badge 
                                                            variant="light" 
                                                            h="auto"
                                                            py={4}
                                                            color={isCancelled ? 'red' : (row.nombre_estadomuestreo?.includes('POR') ? 'orange' : 'green')}
                                                        >
                                                            <Stack gap={0} align="center">
                                                                {row.nombre_estadomuestreo?.split(' ').map((part: string, i: number) => (
                                                                    <Text key={i} size="10px" fw={700} style={{ lineHeight: 1 }}>{part}</Text>
                                                                ))}
                                                            </Stack>
                                                        </Badge>
                                                    </Table.Td>
                                                    <Table.Td ta="center">
                                                        <TextInput 
                                                            type="date" 
                                                            size="xs" 
                                                            style={{ width: 125, margin: '0 auto' }}
                                                            disabled={isCancelled}
                                                            value={editableDates[rowId] || ''} 
                                                            onChange={(e) => {
                                                                const val = e.currentTarget.value;
                                                                setEditableDates(prev => ({ ...prev, [rowId]: val }));
                                                            }}
                                                            error={!editableDates[rowId]}
                                                        />
                                                    </Table.Td>
                                                    <Table.Td ta="center">
                                                        <TextInput 
                                                            type="date" 
                                                            size="xs" 
                                                            style={{ width: 125, margin: '0 auto' }}
                                                            disabled={isCancelled}
                                                            value={editableRetiroDates[rowId] || ''} 
                                                            onChange={(e) => {
                                                                const val = e.currentTarget.value;
                                                                setEditableRetiroDates(prev => ({ ...prev, [rowId]: val }));
                                                            }}
                                                            error={!editableRetiroDates[rowId]}
                                                        />
                                                    </Table.Td>
                                                    <Table.Td ta="center">
                                                        <Text size="xs" fw={500}>{row.nombre_coordinador}</Text>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Group gap={4} align="center" wrap="nowrap" justify="center">
                                                            <Select 
                                                                size="xs" 
                                                                disabled={isCancelled}
                                                                style={{ width: 140 }}
                                                                data={muestreadorOptions}
                                                                value={String(muestreadorInstalacion[rowId] || '')}
                                                                onChange={(v) => handleTechnicianChange(rowId, Number(v), 'instalacion')}
                                                                searchable
                                                                placeholder="Seleccionar..."
                                                                leftSection={<IconUser size={14} />}
                                                                error={resamplingData && muestreadorInstalacion[rowId] && resamplingData.idMuestreadorOriginal && muestreadorInstalacion[rowId] !== resamplingData.idMuestreadorOriginal}
                                                            />
                                                            {resamplingData && muestreadorInstalacion[rowId] === resamplingData.idMuestreadorOriginal && (
                                                                <Text size="10px" c="blue" fw={700} style={{ whiteSpace: 'nowrap' }}>H. ✓</Text>
                                                            )}
                                                        </Group>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Group gap={4} align="center" wrap="nowrap" justify="center">
                                                            <Select 
                                                                size="xs" 
                                                                disabled={isCancelled}
                                                                style={{ width: 140 }}
                                                                data={muestreadorOptions}
                                                                value={String(muestreadorRetiro[rowId] || '')}
                                                                onChange={(v) => handleTechnicianChange(rowId, Number(v), 'retiro')}
                                                                searchable
                                                                placeholder="Seleccionar..."
                                                                leftSection={<IconUser size={14} />}
                                                                error={resamplingData && muestreadorRetiro[rowId] && resamplingData.idMuestreadorOriginal && muestreadorRetiro[rowId] !== resamplingData.idMuestreadorOriginal}
                                                            />
                                                            {resamplingData && muestreadorRetiro[rowId] === resamplingData.idMuestreadorOriginal && (
                                                                <Text size="10px" c="blue" fw={700} style={{ whiteSpace: 'nowrap' }}>H. ✓</Text>
                                                            )}
                                                        </Group>
                                                    </Table.Td>
                                                    <Table.Td style={{ borderLeft: 'none' }} ta="center">
                                                        {resamplingData && (muestreadorInstalacion[rowId] === resamplingData.idMuestreadorOriginal || muestreadorRetiro[rowId] === resamplingData.idMuestreadorOriginal) && (
                                                                <Button 
                                                                    variant="light" 
                                                                    size="compact-xs" 
                                                                    h="auto"
                                                                    py={4}
                                                                    color={equipmentSelections[row.frecuencia_correlativo] ? "green" : "blue"}
                                                                    leftSection={<IconBolt size={12} />}
                                                                    onClick={() => handleViewVersions(resamplingData.idMuestreadorOriginal, row.frecuencia_correlativo)}
                                                                >
                                                                    <Stack gap={0} align="flex-start">
                                                                        <Text size="10px" fw={700} style={{ lineHeight: 1 }}>
                                                                            {equipmentSelections[row.frecuencia_correlativo] ? "Versiones" : "Config."}
                                                                        </Text>
                                                                        <Text size="10px" fw={700} style={{ lineHeight: 1 }}>
                                                                            {equipmentSelections[row.frecuencia_correlativo] ? "OK" : "Versiones"}
                                                                        </Text>
                                                                    </Stack>
                                                                </Button>
                                                        )}
                                                    </Table.Td>
                                                </Table.Tr>
                                            );
                                        })}
                                    </Table.Tbody>
                                </Table>
                            </ScrollArea>
                        </Box>
                    </Stack>
                </Paper>
            </Stack>

            {/* Modal de Comparación de Versiones */}
            <Modal
                title={`Comparación de Equipos - Correlativo ${activeRowCorrelativo}`}
                opened={versionModalOpen}
                onClose={() => setVersionModalOpen(false)}
                size="70%"
                radius="md"
                centered
            >
                <Box pos="relative">
                    <LoadingOverlay visible={comparisonLoading} />
                    
                    <Group justify="space-between" mb="md">
                        <Text size="sm" c="dimmed">
                            Versión al momento del muestreo original <b>(Ficha #{resamplingData?.idOriginal})</b> vs Versión vigente actual <b>(mae_equipo)</b>
                        </Text>
                        <Group gap="xs">
                            <Button size="compact-xs" variant="outline" color="blue" onClick={() => handleBulkSelection('original')}>
                                Usar Todas Originales
                            </Button>
                            <Button size="compact-xs" variant="outline" color="green" onClick={() => handleBulkSelection('nueva')}>
                                Usar Todas Actuales
                            </Button>
                        </Group>
                    </Group>

                    {comparisonData.length === 0 && !comparisonLoading ? (
                        <Alert color="orange" title="Sin Datos">
                            No se encontraron registros de equipos para este correlativo en la ficha original (#<b>{resamplingData?.idOriginal}</b>).
                        </Alert>
                    ) : (
                        <Table striped highlightOnHover withTableBorder withColumnBorders verticalSpacing="xs">
                            <Table.Thead bg="gray.0">
                                <Table.Tr>
                                    <Table.Th rowSpan={2}>Equipo / Código</Table.Th>
                                    <Table.Th ta="center" colSpan={4} bg="blue.0" c="blue.9">Versión Original (Ficha #{resamplingData?.idOriginal})</Table.Th>
                                    <Table.Th ta="center" colSpan={4} bg="green.0" c="green.9">Versión Actual (Vigente)</Table.Th>
                                </Table.Tr>
                                <Table.Tr>
                                    <Table.Th ta="center" w={80} bg="blue.0">Versión</Table.Th>
                                    <Table.Th ta="center" w={60} bg="blue.0">E 0%</Table.Th>
                                    <Table.Th ta="center" w={60} bg="blue.0">E 15%</Table.Th>
                                    <Table.Th ta="center" w={60} bg="blue.0">E 30%</Table.Th>
                                    
                                    <Table.Th ta="center" w={80} bg="green.0">Versión</Table.Th>
                                    <Table.Th ta="center" w={60} bg="green.0">E 0%</Table.Th>
                                    <Table.Th ta="center" w={60} bg="green.0">E 15%</Table.Th>
                                    <Table.Th ta="center" w={60} bg="green.0">E 30%</Table.Th>
                                    <Table.Th ta="center" w={140} bg="gray.1">Selección Versión</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {comparisonData.map((item, idx) => {
                                    const versionChanged = item.version_original !== item.version_nueva;
                                    const error0Changed = Number(item.error0_original) !== Number(item.error0_nueva);
                                    const error15Changed = Number(item.error15_original) !== Number(item.error15_nueva);
                                    const error30Changed = Number(item.error30_original) !== Number(item.error30_nueva);
                                    
                                    const hasAnomalies = versionChanged || error0Changed || error15Changed || error30Changed;
                                    const currentSelection = (equipmentSelections[activeRowCorrelativo] || {})[item.id_equipo];

                                    return (
                                        <Table.Tr key={idx} bg={hasAnomalies ? 'orange.0' : undefined}>
                                            <Table.Td>
                                                <Stack gap={0}>
                                                    <Text size="sm" fw={600}>{item.nombre}</Text>
                                                    <Text size="xs" c="dimmed">{item.codigo}</Text>
                                                </Stack>
                                            </Table.Td>
                                            
                                            {/* ORIGINAL */}
                                            <Table.Td ta="center" bg="blue.0"><Badge variant="outline" size="sm">{item.version_original || 'v1'}</Badge></Table.Td>
                                            <Table.Td ta="center" bg="blue.0" style={{ fontSize: '11px' }}>{item.error0_original}%</Table.Td>
                                            <Table.Td ta="center" bg="blue.0" style={{ fontSize: '11px' }}>{item.error15_original}%</Table.Td>
                                            <Table.Td ta="center" bg="blue.0" style={{ fontSize: '11px' }}>{item.error30_original}%</Table.Td>
                                            
                                            {/* NUEVO */}
                                            <Table.Td ta="center" bg="green.0">
                                                <Badge variant="filled" color={versionChanged ? 'orange' : 'green'} size="sm">
                                                    {item.version_nueva}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td ta="center" bg="green.0" fw={error0Changed ? 700 : 400} c={error0Changed ? 'orange.9' : undefined} style={{ fontSize: '12px' }}>
                                                {item.error0_nueva}%
                                            </Table.Td>
                                            <Table.Td ta="center" bg="green.0" fw={error15Changed ? 700 : 400} c={error15Changed ? 'orange.9' : undefined} style={{ fontSize: '12px' }}>
                                                {item.error15_nueva}%
                                            </Table.Td>
                                            <Table.Td ta="center" bg="green.0" fw={error30Changed ? 700 : 400} c={error30Changed ? 'orange.9' : undefined} style={{ fontSize: '12px' }}>
                                                {item.error30_nueva}%
                                            </Table.Td>

                                            <Table.Td ta="center">
                                                <Radio.Group
                                                    value={currentSelection}
                                                    onChange={(val) => {
                                                        setEquipmentSelections(prev => {
                                                            const correlSelections = { ...(prev[activeRowCorrelativo] || {}) };
                                                            correlSelections[item.id_equipo] = val as any;
                                                            return { ...prev, [activeRowCorrelativo]: correlSelections };
                                                        });
                                                    }}
                                                >
                                                    <Group gap="xs">
                                                        <Radio value="original" label="Ori." size="xs" />
                                                        <Radio value="nueva" label="Act." size="xs" />
                                                    </Group>
                                                </Radio.Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    );
                                })}
                            </Table.Tbody>
                        </Table>
                    )}

                    <Group justify="flex-end" mt="xl">
                        <Button variant="light" color="gray" onClick={() => setVersionModalOpen(false)}>Cerrar</Button>
                        <Button color="blue" onClick={() => setVersionModalOpen(false)}>Aceptar</Button>
                    </Group>
                </Box>
            </Modal>
        </Box>
    );
};
