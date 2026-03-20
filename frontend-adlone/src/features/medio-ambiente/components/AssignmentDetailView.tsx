import React, { useState, useEffect, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { useCatalogos } from '../context/CatalogosContext';
import { catalogosService } from '../services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { 
    Container, 
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
    LoadingOverlay
} from '@mantine/core';
import { 
    IconCalendarEvent,
    IconUserPlus, 
    IconDeviceFloppy, 
    IconBolt
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

        setSaving(true);
        try {
            const assignments = rows.map((row: any) => ({
                id: row.id_agendamam,
                fecha: editableDates[row.id_agendamam],
                fechaRetiro: editableRetiroDates[row.id_agendamam] || editableDates[row.id_agendamam],
                idMuestreadorInstalacion: muestreadorInstalacion[row.id_agendamam],
                idMuestreadorRetiro: muestreadorRetiro[row.id_agendamam] || muestreadorInstalacion[row.id_agendamam],
                idFichaIngresoServicio: row.id_fichaingresoservicio,
                frecuenciaCorrelativo: row.frecuencia_correlativo
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

    const muestreadorOptions = useMemo(() => 
        muestreadores.map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador })),
        [muestreadores]
    );

    return (
        <Container fluid p="md">
            <Stack gap="lg">
                <PageHeader 
                    title={`Asignación de Recursos - Ficha ${fichaId}`}
                    subtitle="Defina fechas y técnicos responsables para cada servicio"
                    onBack={onBack}
                    rightSection={
                        <Button 
                            color="grape" 
                            size="md" 
                            leftSection={<IconDeviceFloppy size={20} />} 
                            onClick={handleSaveAssignment} 
                            loading={saving}
                        >
                            Guardar Planificación
                        </Button>
                    }
                />

                <Paper withBorder p="xl" radius="lg" shadow="sm">
                    <Stack gap="xl">
                        {/* Configuration Header */}
                        <Group align="flex-end" justify="center" gap="xl">
                            <Paper withBorder p="md" radius="md" bg="gray.0">
                                <Group gap="md">
                                    <Stack gap={0}>
                                        <Text size="xs" fw={700} c="dimmed">FRECUENCIA</Text>
                                        <Text fw={600}>{numericFrequency}</Text>
                                    </Stack>
                                    <Divider orientation="vertical" />
                                    <Stack gap={0}>
                                        <Text size="xs" fw={700} c="dimmed">PERIODO</Text>
                                        <Text fw={600}>{dbFieldValue || '-'}</Text>
                                    </Stack>
                                    <Divider orientation="vertical" />
                                    <Stack gap={0}>
                                        <Text size="xs" fw={700} c="dimmed">FACTOR</Text>
                                        <Text fw={600}>{frecuenciaFactor}</Text>
                                    </Stack>
                                    <Divider orientation="vertical" />
                                    <Stack gap={0}>
                                        <Text size="xs" fw={700} c="dimmed">TOTAL SERV.</Text>
                                        <Text fw={600}>{totalServicios}</Text>
                                    </Stack>
                                    <Divider orientation="vertical" />
                                    <Stack gap={0}>
                                        <Text size="xs" fw={700} c="dimmed">DURACIÓN</Text>
                                        <Text fw={600}>{duracionMuestreo} HRS</Text>
                                    </Stack>
                                </Group>
                            </Paper>

                            <Group align="flex-end">
                                <TextInput 
                                    label="Fecha Referencia (Muestreo)" 
                                    type="date" 
                                    value={selectedDate} 
                                    onChange={(e) => setSelectedDate(e.target.value)} 
                                    leftSection={<IconCalendarEvent size={16} />}
                                />
                                <Button 
                                    variant="light" 
                                    color="blue" 
                                    leftSection={<IconBolt size={18} />} 
                                    onClick={handleCalculateDates}
                                    disabled={!selectedDate}
                                >
                                    Auto-Calcular Fechas
                                </Button>
                            </Group>

                            <Divider orientation="vertical" />

                            <Group align="flex-end">
                                <Select 
                                    label="Asignar M. Instalación (Todos)" 
                                    placeholder="Seleccionar..." 
                                    data={muestreadorOptions}
                                    onChange={(val) => {
                                        if (val) {
                                            const id = Number(val);
                                            const newInst: Record<number, number> = {}; 
                                            const newRet: Record<number, number> = {};
                                            rows.forEach(r => {
                                                newInst[r.id_agendamam as number] = id;
                                                newRet[r.id_agendamam as number] = muestreadorRetiro[r.id_agendamam] || id;
                                            });
                                            setMuestreadorInstalacion(newInst);
                                            setMuestreadorRetiro(newRet);
                                        }
                                    }}
                                    searchable
                                    leftSection={<IconUserPlus size={16} />}
                                />
                                <Select 
                                    label="Asignar M. Retiro (Todos)" 
                                    placeholder="Seleccionar..." 
                                    data={muestreadorOptions}
                                    onChange={(val) => {
                                        if (val) {
                                            const id = Number(val);
                                            const newRet: Record<number, number> = {};
                                            rows.forEach(r => { newRet[r.id_agendamam as number] = id; });
                                            setMuestreadorRetiro(newRet);
                                        }
                                    }}
                                    searchable
                                    leftSection={<IconUserPlus size={16} />}
                                />
                            </Group>
                        </Group>

                        <Divider />

                        {/* Assignments Table */}
                        <Box pos="relative">
                            <LoadingOverlay visible={loading} />
                            <ScrollArea h={500}>
                                <Table striped highlightOnHover withTableBorder verticalSpacing="sm">
                                    <Table.Thead bg="gray.1">
                                        <Table.Tr>
                                            <Table.Th ta="center" w={80}>Ficha</Table.Th>
                                            <Table.Th ta="center" w={80}>Correl.</Table.Th>
                                            <Table.Th w={130}>Estado</Table.Th>
                                            <Table.Th w={150}>F. Instalación</Table.Th>
                                            <Table.Th w={150}>F. Muestreo</Table.Th>
                                            <Table.Th>Frecuencia</Table.Th>
                                            <Table.Th>E. Servicio</Table.Th>
                                            <Table.Th>Obj. Muestreo</Table.Th>
                                            <Table.Th>Sub Área</Table.Th>
                                            <Table.Th>Coordinador</Table.Th>
                                            <Table.Th w={200}>M. Instalación</Table.Th>
                                            <Table.Th w={200}>M. Retiro</Table.Th>
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
                                                    <Table.Td>
                                                        <Badge 
                                                            variant="light" 
                                                            color={isCancelled ? 'red' : (row.nombre_estadomuestreo?.includes('POR') ? 'orange' : 'green')}
                                                        >
                                                            {row.nombre_estadomuestreo}
                                                        </Badge>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <TextInput 
                                                            type="date" 
                                                            size="xs" 
                                                            disabled={isCancelled}
                                                            value={editableDates[rowId] || ''} 
                                                            onChange={(e) => setEditableDates(prev => ({ ...prev, [rowId]: e.currentTarget.value }))}
                                                            error={!editableDates[rowId]}
                                                        />
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <TextInput 
                                                            type="date" 
                                                            size="xs" 
                                                            disabled={isCancelled}
                                                            value={editableRetiroDates[rowId] || ''} 
                                                            onChange={(e) => setEditableRetiroDates(prev => ({ ...prev, [rowId]: e.currentTarget.value }))}
                                                            error={!editableRetiroDates[rowId]}
                                                        />
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Text size="xs">{row.nombre_frecuencia}</Text>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Text size="xs" truncate maw={150}>{row.empresa_servicio}</Text>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Text size="xs" truncate maw={150}>{row.nombre_objetivomuestreo}</Text>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Text size="xs">{row.nombre_subarea}</Text>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Text size="xs" truncate maw={120}>{row.nombre_coordinador}</Text>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Select 
                                                            size="xs" 
                                                            disabled={isCancelled}
                                                            data={muestreadorOptions}
                                                            value={String(muestreadorInstalacion[rowId] || '')}
                                                            onChange={(v) => {
                                                                const id = Number(v);
                                                                setMuestreadorInstalacion(p => ({ ...p, [rowId]: id }));
                                                                setMuestreadorRetiro(p => ({ ...p, [rowId]: p[rowId] || id }));
                                                            }}
                                                            searchable
                                                            placeholder="Técnico..."
                                                        />
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Select 
                                                            size="xs" 
                                                            disabled={isCancelled}
                                                            data={muestreadorOptions}
                                                            value={String(muestreadorRetiro[rowId] || '')}
                                                            onChange={(v) => setMuestreadorRetiro(p => ({ ...p, [rowId]: Number(v) }))}
                                                            searchable
                                                            placeholder="Técnico..."
                                                        />
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
        </Container>
    );
};
