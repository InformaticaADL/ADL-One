import React, { useState, useEffect, useMemo } from 'react';
import { 
    Container, 
    Stack, 
    Group, 
    Title, 
    Text, 
    Button, 
    TextInput, 
    Autocomplete,
    Select, 
    NumberInput, 
    Checkbox, 
    Textarea, 
    Paper, 
    Grid, 
    Divider, 
    Stepper, 
    ActionIcon, 
    Alert, 
    Table, 
    Badge, 
    ScrollArea, 
    Box,
    LoadingOverlay,
    Modal,
    Collapse,
    Transition,
    Tooltip,
    Indicator
} from '@mantine/core';
import { 
    IconArrowLeft, 
    IconHistory, 
    IconAlertTriangle, 
    IconInfoCircle, 
    IconDeviceFloppy, 
    IconChevronRight, 
    IconChevronLeft, 
    IconEdit
} from '@tabler/icons-react';

import { equipoService, type Equipo, type EquipoHistorial } from '../services/equipo.service';
import { adminService } from '../../../services/admin.service';
import { useToast } from '../../../contexts/ToastContext';
import { useNavStore } from '../../../store/navStore';
import { useAuth } from '../../../contexts/AuthContext';
import { EquipmentRequestsModal } from './EquipmentRequestsModal';

// Using a local HybridSelect replacement with Mantine components.
// If strict=true, it uses Select (must be in list).
// If strict=false, it uses Autocomplete (can type any value).
const MantineHybridSelect: React.FC<any> = ({ label, value, options, onChange, placeholder, strict, required, disabled, leftSection, ...others }) => {
    const data = options.map((o: any) => typeof o === 'string' ? o : (o.label || o.value));
    
    if (strict) {
        return (
            <Select
                label={label}
                placeholder={placeholder}
                data={data}
                value={value}
                onChange={onChange}
                searchable
                required={required}
                disabled={disabled}
                leftSection={leftSection}
                clearable
                nothingFoundMessage="No se encontró"
                {...others}
            />
        );
    }

    return (
        <Autocomplete
            label={label}
            placeholder={placeholder}
            data={data}
            value={value}
            onChange={onChange}
            required={required}
            disabled={disabled}
            leftSection={leftSection}
            {...others}
        />
    );
};

interface Props {
    onCancel: () => void;
    onSave: () => void;
    initialData?: (Equipo & { requestId?: number; requestStatus?: string }) | null;
    pendingRequests?: any[];
    onRefreshSolicitudes?: () => void;
}

export const EquipoForm: React.FC<Props> = ({ onCancel, onSave, initialData, pendingRequests = [], onRefreshSolicitudes }) => {
    // --- State ---
    const [formData, setFormData] = useState<any>({
        codigo: '',
        nombre: '',
        tipo: '',
        ubicacion: '',
        estado: '',
        vigencia: '',
        id_muestreador: '',
        sigla: '',
        correlativo: 0,
        equipo_asociado: 'No Aplica',
        tiene_fc: 'NO',
        visible_muestreador: 'NO',
        informe: 'NO',
        que_mide: '',
        unidad_medida_textual: '',
        unidad_medida_sigla: '',
        observacion: '',
        error0: 0,
        error15: 0,
        error30: 0,
        version: initialData?.version || 'v1'
    });

    const [loading, setLoading] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [allEquipos, setAllEquipos] = useState<Equipo[]>([]);
    const [history, setHistory] = useState<EquipoHistorial[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [editingObsIdx, setEditingObsIdx] = useState<number | null>(null);
    const [editingObsText, setEditingObsText] = useState('');
    const [requestedChanges, setRequestedChanges] = useState<any>(null);
    const [generatingCode, setGeneratingCode] = useState(false);
    const [namesOptions, setNamesOptions] = useState<string[]>([]);
    const [tipoOptions, setTipoOptions] = useState<string[]>([]);
    const [queMideOptions, setQueMideOptions] = useState<string[]>([]);
    const [unidadesOptions, setUnidadesOptions] = useState<string[]>([]);
    const [sedeOptions, setSedeOptions] = useState<string[]>([]);
    const [estadoOptions, setEstadoOptions] = useState<string[]>([]);
    const [fullCatalogItems, setFullCatalogItems] = useState<any[]>([]);
    const [nameToMetadata, setNameToMetadata] = useState<Record<string, any>>({});
    const [rejectingSolicitud, setRejectingSolicitud] = useState<any>(null);
    const [adminFeedback, setAdminFeedback] = useState('');
    const [processingAction, setProcessingAction] = useState(false);
    const [attemptedSubmit, setAttemptedSubmit] = useState(false);
    const [lastRestoredVersion, setLastRestoredVersion] = useState<{ active: string, previous: string } | null>(null);
    const [activeStep, setActiveStep] = useState(0); // 0: Form, 1: Bulk Check
    const [bulkQuantity, setBulkQuantity] = useState(1);
    const [bulkItems, setBulkItems] = useState<any[]>([]);
    const [showRequestsModal, setShowRequestsModal] = useState(false);

    const { showToast } = useToast();
    const { hideNotification } = useNavStore();
    const { hasPermission } = useAuth();

    // Permissions
    const isSuper = hasPermission('AI_MA_ADMIN_ACCESO');
    const canCreateEquipo = hasPermission('AI_MA_CREAR_EQUIPO') || isSuper;
    const canEditEquipo = hasPermission('AI_MA_EDITAR_EQUIPO') || isSuper;

    // --- Helpers ---
    const autoGenerateSigla = (text: string) => {
        if (!text) return '';
        return text.split(',')
            .map(part => part.trim()
                .replace(/^(Unid\. de |Unidades de |Grados |de |en )/i, '')
            )
            .filter(part => part.length > 0)
            .join('/');
    };

    // --- Side Effects ---
    useEffect(() => {
        if (fullCatalogItems.length > 0) {
            const newMap: Record<string, any> = {};
            fullCatalogItems.forEach(item => {
                if (item.nombre) {
                    newMap[item.nombre.trim()] = {
                        que_mide: item.que_mide,
                        unidad_medida_textual: item.unidad_medida_textual,
                        unidad_medida_sigla: item.unidad_medida_sigla,
                        tipo: item.tipo_equipo
                    };
                }
            });
            setNameToMetadata(newMap);
        }
    }, [fullCatalogItems]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [mRes, eRes, allERes] = await Promise.all([
                    adminService.getMuestreadores('', 'ACTIVOS'),
                    equipoService.getEquipos({ limit: 1 }),
                    equipoService.getEquipos({ limit: 2000 })
                ]);

                setMuestreadores(mRes.data || []);
                setAllEquipos(allERes.data || []);

                if (eRes.catalogs) {
                    setFullCatalogItems(eRes.catalogs.nombres || []);
                    setTipoOptions(eRes.catalogs.tipos?.filter((t: string) => t?.trim()) || []);
                    setQueMideOptions(eRes.catalogs.que_mide?.filter((t: string) => t?.trim()) || []);
                    setUnidadesOptions(eRes.catalogs.unidades?.filter((t: string) => t?.trim()) || []);
                    setSedeOptions(eRes.catalogs.sedes?.filter((t: string) => t?.trim()) || []);
                    setEstadoOptions(eRes.catalogs.estados?.filter((t: string) => t?.trim()) || []);
                }
            } catch (err) {
                console.error('Error loading initial catalogs', err);
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (fullCatalogItems.length > 0) {
            const filtered = fullCatalogItems
                .filter((n: any) => !formData.tipo || n.tipo_equipo === formData.tipo);
            setNamesOptions(filtered.map(n => n.nombre).sort());
        }
    }, [formData.tipo, fullCatalogItems]);

    useEffect(() => {
        if (initialData) {
            const hasId = !!initialData.id_equipo && initialData.id_equipo !== 0;
            const isTraspaso = initialData.requestId && hasId;
            const isAlta = initialData.requestId && !hasId;

            const loadFullData = async () => {
                setLoading(true);
                try {
                    let baseData = initialData as any;

                    if (isTraspaso) {
                        const equipRes = await equipoService.getEquipoById(initialData.id_equipo);
                        if (equipRes.success) {
                            baseData = { ...equipRes.data, ...initialData };
                            if (!initialData.vigencia && equipRes.data.vigencia) baseData.vigencia = equipRes.data.vigencia;
                            setRequestedChanges({
                                nueva_ubicacion: initialData.ubicacion,
                                nuevo_responsable_id: initialData.id_muestreador,
                                vigencia: initialData.vigencia
                            });
                        }
                    } else if (isAlta) {
                        setRequestedChanges(initialData);
                    }

                    // Format date for input
                    let formattedDate = '';
                    if (baseData.vigencia) {
                        if (baseData.vigencia.includes('/')) {
                            const [day, month, year] = baseData.vigencia.split('/');
                            formattedDate = `${year}-${month}-${day}`;
                        } else {
                            try { formattedDate = new Date(baseData.vigencia).toISOString().split('T')[0]; } catch { formattedDate = ''; }
                        }
                    }

                    setFormData({
                        ...baseData,
                        vigencia: formattedDate,
                        id_muestreador: isTraspaso ? (initialData.id_muestreador || baseData.id_muestreador) : (isAlta ? (initialData.id_muestreador || 0) : baseData.id_muestreador),
                        error0: Number(baseData.error0) || 0,
                        error15: Number(baseData.error15) || 0,
                        error30: Number(baseData.error30) || 0,
                        equipo_asociado: (!baseData.equipo_asociado || baseData.equipo_asociado === 0) ? 'No Aplica' : baseData.equipo_asociado,
                        correlativo: Number(baseData.correlativo) || 0,
                        version: baseData.version || 'v1'
                    });

                    if (hasId) {
                        setLoadingHistory(true);
                        const histRes = await equipoService.getEquipoHistorial(baseData.id_equipo);
                        if (histRes.success) setHistory(histRes.data || []);
                        setLoadingHistory(false);
                    }
                } catch (err) {
                    console.error('Error loading full data', err);
                    showToast({ type: 'error', message: 'Error al cargar datos del equipo' });
                } finally {
                    setLoading(false);
                }
            };
            loadFullData();
        }
    }, [initialData]);

    // Code generation logic
    useEffect(() => {
        if (!formData.tipo || !formData.ubicacion || !formData.nombre) return;
        const isNew = !initialData?.id_equipo;

        if (isNew) {
            const timer = setTimeout(async () => {
                setGeneratingCode(true);
                try {
                    const res = await equipoService.suggestNextCode(formData.tipo, formData.ubicacion, formData.nombre);
                    if (res.success && res.data.suggestedCode) {
                        setFormData((prev: any) => ({
                            ...prev,
                            sigla: res.data.sigla,
                            correlativo: res.data.correlativo,
                            codigo: res.data.suggestedCode,
                            previousCode: res.data.previousCode,
                            previousStatus: res.data.previousStatus
                        }));
                    }
                } catch (err) { console.error(err); } 
                finally { setGeneratingCode(false); }
            }, 600);
            return () => clearTimeout(timer);
        } else {
            const formattedCorr = formData.correlativo < 10 ? `0${formData.correlativo}` : `${formData.correlativo}`;
            const newCode = `${formData.sigla}.${formattedCorr}/MA.${formData.ubicacion}`;
            if (formData.codigo !== newCode) {
                setFormData((prev: any) => ({ ...prev, codigo: newCode }));
            }
        }
    }, [formData.tipo, formData.ubicacion, formData.nombre, formData.sigla, formData.correlativo]);

    // --- Handlers ---
    const handleRestore = async (h: any) => {
        if (!initialData?.id_equipo) return;
        setLoading(true);
        try {
            const res = await equipoService.restoreVersion(initialData.id_equipo, h.id_historial);
            if (res.success) {
                const equipRes = await equipoService.getEquipoById(initialData.id_equipo);
                if (equipRes.success) {
                    const b = equipRes.data;
                    let fd = '';
                    if (b.vigencia) {
                        if (b.vigencia.includes('/')) {
                            const [d, m, y] = b.vigencia.split('/');
                            fd = `${y}-${m}-${d}`;
                        } else {
                            try { fd = new Date(b.vigencia).toISOString().split('T')[0]; } catch { fd = ''; }
                        }
                    }
                    setFormData({ ...b, vigencia: fd, version: b.version || 'v1' });
                }
                const histRes = await equipoService.getEquipoHistorial(initialData.id_equipo);
                if (histRes.success) setHistory(histRes.data || []);
                setLastRestoredVersion({ active: h.version, previous: formData.version });
                showToast({ type: 'success', message: `Versión ${h.version} habilitada correctamente.` });
                if (onRefreshSolicitudes) onRefreshSolicitudes();
            }
        } catch (err: any) {
            showToast({ type: 'error', message: err.response?.data?.message || 'Error al habilitar versión' });
        } finally { setLoading(false); }
    };

    const isFormValid = useMemo(() => (
        formData.nombre && formData.tipo && formData.ubicacion && formData.estado && 
        formData.codigo && formData.vigencia && formData.observacion && !generatingCode
    ), [formData, generatingCode]);

    const generateBulkItems = (quantity: number, baseData: any) => {
        const items = [];
        for (let i = 0; i < quantity; i++) {
            const nextCorr = Number(baseData.correlativo) + i;
            const formattedCorr = nextCorr < 10 ? `0${nextCorr}` : `${nextCorr}`;
            const code = `${baseData.sigla}.${formattedCorr}/MA.${baseData.ubicacion}`;
            items.push({ ...baseData, correlativo: nextCorr, codigo: code, id_temp: i });
        }
        setBulkItems(items);
    };

    const handleNext = () => {
        setAttemptedSubmit(true);
        if (isFormValid) {
            if (!initialData?.id_equipo) {
                generateBulkItems(bulkQuantity, formData);
                setActiveStep(1);
            } else {
                setShowSaveConfirm(true);
            }
        } else {
            showToast({ type: 'error', message: 'Por favor complete todos los campos obligatorios.' });
        }
    };

    const handleSave = async () => {
        setLoading(true);
        setShowSaveConfirm(false);
        try {
            const isEdit = !!initialData?.id_equipo;
            if (isEdit) {
                const data = { ...formData, equipo_asociado: formData.equipo_asociado === 'No Aplica' ? 0 : Number(formData.equipo_asociado) };
                await equipoService.updateEquipo(initialData!.id_equipo, data);
                if (initialData.requestId) {
                    const isTech = initialData.requestStatus === 'PENDIENTE_TECNICA';
                    await adminService.updateSolicitudStatus(initialData.requestId, isTech ? 'PENDIENTE_CALIDAD' : 'APROBADO', isTech ? 'Actualizado por Técnica' : 'Aprobado');
                    if (isTech) hideNotification(`${initialData.requestId}-PENDIENTE_TECNICA`);
                }
                showToast({ type: 'success', message: 'Equipo actualizado correctamente' });
            } else {
                const items = bulkItems.map(it => ({ ...it, equipo_asociado: it.equipo_asociado === 'No Aplica' ? 0 : Number(it.equipo_asociado) }));
                if (items.length > 1) await equipoService.createEquiposBulk(items);
                else await equipoService.createEquipo(items[0]);
                
                const reqId = (initialData as any)?.requestId;
                if (reqId) {
                    const isTech = (initialData as any).requestStatus === 'PENDIENTE_TECNICA';
                    await adminService.updateSolicitudStatus(reqId, isTech ? 'PENDIENTE_CALIDAD' : 'APROBADO', 'Equipo creado');
                    if (isTech) hideNotification(`${reqId}-PENDIENTE_TECNICA`);
                }
                showToast({ type: 'success', message: items.length > 1 ? 'Equipos creados correctamente' : 'Equipo creado correctamente' });
            }
            onSave();
        } catch (err: any) {
            showToast({ type: 'error', message: err.response?.data?.message || 'Error al guardar' });
        } finally { setLoading(false); }
    };



    const handleRejectIndividual = async () => {
        if (!rejectingSolicitud || !adminFeedback.trim()) return;
        setProcessingAction(true);
        try {
            let newJson = rejectingSolicitud.datos_json;
            const isBulk = (rejectingSolicitud.tipo_solicitud === 'BAJA' && newJson?.equipos_baja) || (rejectingSolicitud.tipo_solicitud === 'ALTA' && newJson?.isReactivation && newJson?.equipos_alta);
            
            if (isBulk) {
                const field = rejectingSolicitud.tipo_solicitud === 'BAJA' ? 'equipos_baja' : 'equipos_alta';
                const list = newJson[field].map((e: any) => String(e.id) === String(formData.id_equipo) ? { ...e, procesado: true, rechazado: true } : e);
                newJson = { ...newJson, [field]: list };
                const done = list.every((e: any) => e.procesado);
                const approved = list.some((e: any) => e.procesado && !e.rechazado);
                if (done) {
                    await adminService.updateSolicitudStatus(rejectingSolicitud.id_solicitud, approved ? 'APROBADO' : 'RECHAZADO', adminFeedback, newJson, formData.id_equipo, 'RECHAZADO');
                    hideNotification(`${rejectingSolicitud.id_solicitud}-PENDIENTE`);
                } else {
                    await adminService.updateSolicitudStatus(rejectingSolicitud.id_solicitud, 'PENDIENTE', adminFeedback, newJson, formData.id_equipo, 'RECHAZADO');
                }
            } else {
                await adminService.updateSolicitudStatus(rejectingSolicitud.id_solicitud, 'RECHAZADO', adminFeedback, undefined, formData.id_equipo, 'RECHAZADO');
                hideNotification(`${rejectingSolicitud.id_solicitud}-PENDIENTE`);
            }
            showToast({ type: 'info', message: 'Rechazado' });
            if (onRefreshSolicitudes) onRefreshSolicitudes();
            onSave();
        } catch { showToast({ type: 'error', message: 'Error al rechazar' }); } 
        finally { setProcessingAction(false); setRejectingSolicitud(null); setAdminFeedback(''); }
    };

    // --- Renders ---
    return (
        <Container fluid>
            <LoadingOverlay visible={loading || processingAction} />
            
            <Paper shadow="sm" radius="md" p="xl" withBorder>
                <Stack gap="xl">
                    <Group justify="space-between" align="flex-start">
                        <Stack gap={0}>
                            <Title order={2}>
                                {requestedChanges?.isReactivation ? 'Activación de Equipo' : (initialData?.id_equipo ? 'Editar Equipo' : 'Nuevo Equipo')}
                            </Title>
                            <Text c="dimmed" size="sm">
                                {initialData?.id_equipo ? `Modificando equipo: ${formData.codigo}` : 'Completa los datos para dar de alta nuevos equipos en el sistema.'}
                            </Text>
                        </Stack>

                        <Group>
                            <Button variant="subtle" leftSection={<IconArrowLeft size={18} />} onClick={onCancel} color="gray">
                                Volver
                            </Button>
                            {initialData?.id_equipo && (
                                <Button 
                                    variant="light" 
                                    leftSection={<IconHistory size={18} />} 
                                    onClick={() => setShowHistory(!showHistory)}
                                >
                                    {showHistory ? 'Ocultar Historial' : 'Ver Historial'}
                                </Button>
                            )}
                            <Button 
                                leftSection={<IconDeviceFloppy size={18} />}
                                onClick={handleSave}
                                loading={loading}
                                color="adl-blue"
                            >
                                {initialData?.id_equipo ? 'Guardar Cambios' : 'Crear Equipo'}
                            </Button>
                        </Group>
                    </Group>

                    {initialData && formData.version && (
                        <Badge variant="light" color="blue" size="lg" radius="sm">
                            Versión Activa: {formData.version}
                        </Badge>
                    )}

                    {/* Pending Requests Section Removed */}


                    {/* Requested Changes (Traspaso/Alta Suggestion) */}
                    <Transition mounted={!!(initialData?.requestId && requestedChanges)} transition="fade" duration={400}>
                        {(styles) => (
                            <Paper p="md" bg="blue.0" radius="md" withBorder style={{ ...styles, borderColor: 'var(--mantine-color-blue-2)' }}>
                                <Group gap="xs" mb="sm" color="blue.9">
                                    <IconInfoCircle size={20} />
                                    <Text fw={700}>Cambios sugeridos por Medio Ambiente</Text>
                                </Group>
                                <Grid>
                                    {requestedChanges.nueva_ubicacion && (
                                        <Grid.Col span={{ base: 6, md: 4 }}>
                                            <Paper p="xs" withBorder bg="white">
                                                <Text size="xs" c="dimmed" tt="uppercase">Ubicación</Text>
                                                <Text fw={700} color="blue">{requestedChanges.nueva_ubicacion}</Text>
                                            </Paper>
                                        </Grid.Col>
                                    )}
                                    {requestedChanges.nuevo_responsable_id && (
                                        <Grid.Col span={{ base: 6, md: 4 }}>
                                            <Paper p="xs" withBorder bg="white">
                                                <Text size="xs" c="dimmed" tt="uppercase">Responsable</Text>
                                                <Text fw={700} color="blue">{muestreadores.find(m => m.id_muestreador === requestedChanges.nuevo_responsable_id)?.nombre_muestreador || '---'}</Text>
                                            </Paper>
                                        </Grid.Col>
                                    )}
                                    {requestedChanges.vigencia && (
                                        <Grid.Col span={{ base: 6, md: 4 }}>
                                            <Paper p="xs" withBorder bg="white">
                                                <Text size="xs" c="dimmed" tt="uppercase">Vigencia</Text>
                                                <Text fw={700} color="blue">{requestedChanges.vigencia}</Text>
                                            </Paper>
                                        </Grid.Col>
                                    )}
                                </Grid>
                            </Paper>
                        )}
                    </Transition>

                    {/* History Section */}
                    <Collapse in={showHistory}>
                        <Paper withBorder p="md" bg="gray.0">
                            <Group gap="xs" mb="md">
                                <IconHistory size={20} />
                                <Text fw={700}>Historial de Versiones</Text>
                            </Group>
                            <ScrollArea.Autosize mah={300}>
                                <Table striped withTableBorder>
                                    <Table.Thead>
                                        <Table.Tr>
                                            <Table.Th>Versión</Table.Th>
                                            <Table.Th>Fecha</Table.Th>
                                            <Table.Th>Usuario</Table.Th>
                                            <Table.Th>Código</Table.Th>
                                            <Table.Th>Acción</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {loadingHistory ? (
                                            <Table.Tr><Table.Td colSpan={5} ta="center">Cargando...</Table.Td></Table.Tr>
                                        ) : history.length === 0 ? (
                                            <Table.Tr><Table.Td colSpan={5} ta="center">Sin versiones previas.</Table.Td></Table.Tr>
                                        ) : (
                                            history.map(h => (
                                                <Table.Tr key={h.id_historial} bg={lastRestoredVersion?.previous === h.version ? 'orange.0' : undefined}>
                                                    <Table.Td fw={700}>{h.version}</Table.Td>
                                                    <Table.Td>{new Date(h.fecha_cambio).toLocaleString()}</Table.Td>
                                                    <Table.Td>{h.nombre_usuario_cambio || 'Sistema'}</Table.Td>
                                                    <Table.Td>{h.codigo}</Table.Td>
                                                    <Table.Td>
                                                        <Button size="compact-xs" onClick={() => handleRestore(h)}>Habilitar</Button>
                                                    </Table.Td>
                                                </Table.Tr>
                                            ))
                                        )}
                                    </Table.Tbody>
                                </Table>
                            </ScrollArea.Autosize>
                        </Paper>
                    </Collapse>

                    <Stepper active={activeStep} onStepClick={setActiveStep} color="adl-blue" size="sm">
                        <Stepper.Step label="Información General" description="Datos del equipo">
                            <Stack gap="xl" mt="md">
                                <Grid>
                                    <Grid.Col span={{ base: 12, md: 4 }}>
                                        <MantineHybridSelect
                                            label="Tipo de Equipo"
                                            placeholder="Seleccione..."
                                            value={formData.tipo}
                                            options={tipoOptions}
                                            onChange={(val: any) => setFormData((p: any) => ({ ...p, tipo: val, nombre: '' }))}
                                            strict={!isSuper}
                                            required
                                            disabled={!!initialData?.id_equipo}
                                            error={attemptedSubmit && !formData.tipo && "Obligatorio"}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, md: 4 }}>
                                        <MantineHybridSelect
                                            label="Ubicación (Sede)"
                                            placeholder="Seleccione..."
                                            value={formData.ubicacion}
                                            options={sedeOptions}
                                            onChange={(val: any) => setFormData((p: any) => ({ ...p, ubicacion: val }))}
                                            strict
                                            required
                                            error={attemptedSubmit && !formData.ubicacion && "Obligatorio"}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, md: 4 }}>
                                        <MantineHybridSelect
                                            label="Estado"
                                            placeholder="Seleccione..."
                                            value={formData.estado}
                                            options={estadoOptions}
                                            onChange={(val: any) => setFormData((p: any) => ({ ...p, estado: val }))}
                                            strict
                                            required
                                            error={attemptedSubmit && !formData.estado && "Obligatorio"}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, md: 6 }}>
                                        <MantineHybridSelect
                                            label="Nombre del Equipo"
                                            placeholder="Seleccione o escriba..."
                                            value={formData.nombre}
                                            options={namesOptions}
                                            onChange={(val: any) => {
                                                const m = nameToMetadata[val?.trim()];
                                                setFormData((p: any) => ({
                                                    ...p, nombre: val,
                                                    que_mide: m?.que_mide || p.que_mide,
                                                    unidad_medida_textual: m?.unidad_medida_textual || p.unidad_medida_textual,
                                                    unidad_medida_sigla: m?.unidad_medida_sigla || p.unidad_medida_sigla
                                                }));
                                            }}
                                            strict={!isSuper}
                                            required
                                            error={attemptedSubmit && !formData.nombre && "Obligatorio"}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 6, md: 3 }}>
                                        <TextInput
                                            label="Sigla"
                                            placeholder="Ej: PH"
                                            value={formData.sigla}
                                            onChange={(e) => setFormData((p: any) => ({ ...p, sigla: e.target.value }))}
                                            rightSection={generatingCode && <LoadingOverlay visible loaderProps={{ size: 'xs' }} />}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 6, md: 3 }}>
                                        <NumberInput
                                            label="Correlativo"
                                            value={formData.correlativo}
                                            onChange={(val) => setFormData((p: any) => ({ ...p, correlativo: val }))}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, md: 8 }}>
                                        <TextInput
                                            label="Código Final"
                                            value={formData.codigo}
                                            readOnly={!isSuper}
                                            required
                                            fw={700}
                                            description={formData.previousCode && `Anterior: ${formData.previousCode}`}
                                            error={attemptedSubmit && !formData.codigo && "Obligatorio"}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, md: 4 }}>
                                        <TextInput
                                            label="Vigencia"
                                            type="date"
                                            value={formData.vigencia}
                                            onChange={(e) => setFormData((p: any) => ({ ...p, vigencia: e.target.value }))}
                                            required
                                            error={attemptedSubmit && !formData.vigencia && "Obligatorio"}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, md: 6 }}>
                                        <Select
                                            label="Responsable (Muestreador)"
                                            placeholder="Seleccione..."
                                            data={muestreadores.map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador }))}
                                            value={String(formData.id_muestreador)}
                                            onChange={(val) => setFormData((p: any) => ({ ...p, id_muestreador: val }))}
                                            required
                                            searchable
                                            error={attemptedSubmit && !formData.id_muestreador && "Obligatorio"}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, md: 6 }}>
                                        <MantineHybridSelect
                                            label="Equipo Asociado"
                                            value={String(formData.equipo_asociado)}
                                            options={['No Aplica', ...allEquipos.map(e => String(e.id_equipo))]}
                                            onChange={(val: any) => setFormData((p: any) => ({ ...p, equipo_asociado: val }))}
                                            strict={false}
                                        />
                                    </Grid.Col>
                                </Grid>
                                <Divider label="Configuración Técnica" labelPosition="center" />
                                <Grid>
                                    <Grid.Col span={{ base: 12, md: 4 }}>
                                        <MantineHybridSelect
                                            label="¿Qué Mide?"
                                            value={formData.que_mide}
                                            options={queMideOptions}
                                            onChange={(val: any) => {
                                                const m = fullCatalogItems.find(it => it.que_mide === val);
                                                setFormData((p: any) => ({
                                                    ...p, que_mide: val,
                                                    unidad_medida_textual: m?.unidad_medida_textual || p.unidad_medida_textual,
                                                    unidad_medida_sigla: m?.unidad_medida_sigla || p.unidad_medida_sigla
                                                }));
                                            }}
                                            required
                                            error={attemptedSubmit && !formData.que_mide && "Obligatorio"}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, md: 4 }}>
                                        <MantineHybridSelect
                                            label="Unidad de Medida"
                                            value={formData.unidad_medida_textual}
                                            options={unidadesOptions}
                                            onChange={(val: any) => {
                                                const sig = autoGenerateSigla(val);
                                                setFormData((p: any) => ({ ...p, unidad_medida_textual: val, unidad_medida_sigla: sig || p.unidad_medida_sigla }));
                                            }}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, md: 4 }}>
                                        <TextInput
                                            label="Sigla Unidad"
                                            value={formData.unidad_medida_sigla}
                                            onChange={(e) => setFormData((p: any) => ({ ...p, unidad_medida_sigla: e.target.value }))}
                                            placeholder="mg/L, %"
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={12}>
                                        <Group gap="xl" p="md" bg="gray.0">
                                            <Checkbox 
                                                label="Tiene Factor de Corrección" 
                                                checked={formData.tiene_fc === 'SI'} 
                                                onChange={(e) => setFormData((p: any) => ({ ...p, tiene_fc: e.target.checked ? 'SI' : 'NO' }))} 
                                            />
                                            <Checkbox 
                                                label="Visible para Muestreadores" 
                                                checked={formData.visible_muestreador === 'SI'} 
                                                onChange={(e) => setFormData((p: any) => ({ ...p, visible_muestreador: e.target.checked ? 'SI' : 'NO' }))} 
                                            />
                                            <Checkbox 
                                                label="Incluir en Informe" 
                                                checked={formData.informe === 'SI'} 
                                                onChange={(e) => setFormData((p: any) => ({ ...p, informe: e.target.checked ? 'SI' : 'NO' }))} 
                                            />
                                        </Group>
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 4, md: 4 }}>
                                        <NumberInput label="Error 0" value={formData.error0} onChange={(v) => setFormData((p: any) => ({ ...p, error0: v }))} step={0.01} />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 4, md: 4 }}>
                                        <NumberInput label="Error 15" value={formData.error15} onChange={(v) => setFormData((p: any) => ({ ...p, error15: v }))} step={0.01} />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 4, md: 4 }}>
                                        <NumberInput label="Error 30" value={formData.error30} onChange={(v) => setFormData((p: any) => ({ ...p, error30: v }))} step={0.01} />
                                    </Grid.Col>
                                    <Grid.Col span={12}>
                                        <Textarea
                                            label="Observaciones"
                                            placeholder="Detalles sobre el equipo..."
                                            value={formData.observacion}
                                            onChange={(e) => setFormData((p: any) => ({ ...p, observacion: e.target.value }))}
                                            required
                                            minRows={3}
                                            error={attemptedSubmit && !formData.observacion && "Obligatorio"}
                                        />
                                    </Grid.Col>
                                </Grid>
                                {!initialData?.id_equipo && (
                                    <Paper withBorder p="md" bg="blue.0" radius="md">
                                        <Group justify="space-between">
                                            <Box>
                                                <Text fw={700} color="blue.9">Creación Masiva</Text>
                                                <Text size="xs" c="dimmed">¿Deseas crear múltiples unidades de este modelo?</Text>
                                            </Box>
                                            <NumberInput 
                                                value={bulkQuantity} 
                                                onChange={(val) => setBulkQuantity(Number(val) || 1)} 
                                                min={1} max={50} 
                                                label="Cantidad" 
                                                w={80}
                                            />
                                        </Group>
                                    </Paper>
                                )}
                            </Stack>
                        </Stepper.Step>
                        <Stepper.Step label="Revisión Masiva" description="Confirmar seriales">
                            <Stack gap="md" mt="md">
                                <Alert color="blue" icon={<IconInfoCircle size={18} />}>
                                    Se generarán {bulkQuantity} equipos basados en la plantilla. Puedes ajustar los códigos y sedes individualmente antes de confirmar.
                                </Alert>
                                <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                                    <ScrollArea h={400}>
                                        <Table highlightOnHover verticalSpacing="xs">
                                            <Table.Thead bg="gray.1">
                                                <Table.Tr>
                                                    <Table.Th w={40}>#</Table.Th>
                                                    <Table.Th>Código</Table.Th>
                                                    <Table.Th>Ubicación</Table.Th>
                                                    <Table.Th>Vigencia</Table.Th>
                                                    <Table.Th>Obs.</Table.Th>
                                                </Table.Tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                                {bulkItems.map((item, idx) => (
                                                    <Table.Tr key={idx}>
                                                        <Table.Td>{idx + 1}</Table.Td>
                                                        <Table.Td>
                                                            <TextInput 
                                                                size="xs" 
                                                                value={item.codigo} 
                                                                onChange={(e) => {
                                                                    const n = [...bulkItems];
                                                                    n[idx].codigo = e.target.value;
                                                                    setBulkItems(n);
                                                                }}
                                                            />
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <Select 
                                                                size="xs" 
                                                                data={sedeOptions} 
                                                                value={item.ubicacion}
                                                                onChange={(v) => {
                                                                    const n = [...bulkItems];
                                                                    n[idx].ubicacion = v;
                                                                    const fc = n[idx].correlativo < 10 ? `0${n[idx].correlativo}` : `${n[idx].correlativo}`;
                                                                    n[idx].codigo = `${n[idx].sigla}.${fc}/MA.${v}`;
                                                                    setBulkItems(n);
                                                                }}
                                                            />
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <TextInput 
                                                                type="date" 
                                                                size="xs" 
                                                                value={item.vigencia}
                                                                onChange={(e) => {
                                                                    const n = [...bulkItems];
                                                                    n[idx].vigencia = e.target.value;
                                                                    setBulkItems(n);
                                                                }}
                                                            />
                                                        </Table.Td>
                                                        <Table.Td>
                                                            <ActionIcon 
                                                                variant="subtle" 
                                                                color={item.observacion ? 'blue' : 'gray'}
                                                                onClick={() => { setEditingObsIdx(idx); setEditingObsText(item.observacion || ''); }}
                                                            >
                                                                <IconEdit size={16} />
                                                            </ActionIcon>
                                                        </Table.Td>
                                                    </Table.Tr>
                                                ))}
                                            </Table.Tbody>
                                        </Table>
                                    </ScrollArea>
                                </Paper>
                            </Stack>
                        </Stepper.Step>
                    </Stepper>
                    <Divider mt="xl" />
                    <Group justify="space-between">
                        {activeStep === 1 ? (
                            <Button variant="subtle" leftSection={<IconChevronLeft size={18} />} onClick={() => setActiveStep(0)}>
                                Volver al Formulario
                            </Button>
                        ) : <Box />}
                        <Group>
                            <Button variant="outline" color="gray" onClick={onCancel}>Cancelar</Button>
                            {initialData?.requestId && (!initialData.id_equipo) && (
                                <Button 
                                    variant="outline" 
                                    color="red" 
                                    onClick={() => setRejectingSolicitud({ id_solicitud: initialData.requestId, tipo_solicitud: 'ALTA', datos_json: initialData })}
                                >
                                    Rechazar Solicitud
                                </Button>
                            )}
                            <Button 
                                color="adl-blue"
                                disabled={!isFormValid || !(initialData?.id_equipo ? canEditEquipo : canCreateEquipo)}
                                onClick={handleNext}
                                rightSection={activeStep === 0 && !initialData?.id_equipo ? <IconChevronRight size={18} /> : <IconDeviceFloppy size={18} />}
                            >
                                {initialData?.id_equipo ? 'Actualizar' : (activeStep === 0 ? 'Siguiente' : 'Guardar Todo')}
                            </Button>
                        </Group>
                    </Group>
                </Stack>
            </Paper>

            {/* --- Modals --- */}
            <Modal opened={showSaveConfirm} onClose={() => setShowSaveConfirm(false)} title="Confirmar Guardado" centered size="sm">
                <Stack align="center" py="md">
                    <IconDeviceFloppy size={48} color="var(--mantine-color-blue-6)" />
                    <Text ta="center">¿Deseas confirmar los cambios realizados en el sistema?</Text>
                    <Group grow w="100%" mt="lg">
                        <Button variant="subtle" color="gray" onClick={() => setShowSaveConfirm(false)}>No, revisar</Button>
                        <Button color="blue" onClick={handleSave}>Sí, confirmar</Button>
                    </Group>
                </Stack>
            </Modal>

            <Modal opened={!!rejectingSolicitud} onClose={() => setRejectingSolicitud(null)} title="Motivo de Rechazo" centered>
                <Stack>
                    <Text size="sm" c="dimmed">Explica brevemente por qué se rechaza esta solicitud.</Text>
                    <Textarea 
                        label="Observaciones" 
                        required 
                        minRows={4} 
                        value={adminFeedback} 
                        onChange={(e) => setAdminFeedback(e.currentTarget.value)}
                        placeholder="Ej: Información insuficiente..."
                    />
                    <Group grow mt="md">
                        <Button variant="subtle" color="gray" onClick={() => setRejectingSolicitud(null)}>Cancelar</Button>
                        <Button color="red" onClick={handleRejectIndividual} disabled={!adminFeedback.trim()}>Confirmar Rechazo</Button>
                    </Group>
                </Stack>
            </Modal>

            <Modal opened={editingObsIdx !== null} onClose={() => setEditingObsIdx(null)} title={`Editar Observación - Item #${(editingObsIdx || 0) + 1}`} size="lg">
                <Stack>
                    <Textarea 
                        minRows={8} 
                        value={editingObsText} 
                        onChange={(e) => setEditingObsText(e.currentTarget.value)} 
                        autoFocus
                    />
                    <Button onClick={() => {
                        const n = [...bulkItems];
                        n[editingObsIdx!].observacion = editingObsText;
                        setBulkItems(n);
                        setEditingObsIdx(null);
                    }}>Guardar Observación</Button>
                </Stack>
            </Modal>



            {/* Floating button for requests */}
            {initialData?.id_equipo && pendingRequests && pendingRequests.length > 0 && (
                <Box style={{ position: 'fixed', bottom: 40, right: 40, zIndex: 100 }}>
                    <Indicator 
                        inline 
                        label={pendingRequests.length} 
                        size={22} 
                        color="red" 
                        withBorder
                    >
                        <Tooltip label="Ver Solicitudes Pendientes" position="left">
                            <ActionIcon 
                                size={56} 
                                radius="xl" 
                                variant="filled" 
                                color="orange"
                                onClick={() => setShowRequestsModal(true)}
                                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                            >
                                <IconAlertTriangle size={28} />
                            </ActionIcon>
                        </Tooltip>
                    </Indicator>
                </Box>
            )}

            <EquipmentRequestsModal 
                isOpen={showRequestsModal}
                onClose={() => setShowRequestsModal(false)}
                idEquipo={initialData?.id_equipo || null}
                nombreEquipo={formData.nombre}
                codigoEquipo={formData.codigo}
                requests={pendingRequests || []}
                onRefresh={() => {
                    if (onRefreshSolicitudes) onRefreshSolicitudes();
                }}
            />
        </Container>
    );
};
