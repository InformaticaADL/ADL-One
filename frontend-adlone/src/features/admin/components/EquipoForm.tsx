import React, { useState, useEffect, useMemo } from 'react';
import { 
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
import { useMediaQuery } from '@mantine/hooks';
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
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { FieldLabel } from '../../../components/common/FieldHelp';

// Using a local HybridSelect replacement with Mantine components.
// If strict=true, it uses Select (must be in list).
// If strict=false, it uses Autocomplete (can type any value).
const MantineHybridSelect: React.FC<any> = ({ label, value, options, onChange, placeholder, strict, required, disabled, leftSection, ...others }) => {
    const data = Array.from(new Set(options.map((o: any) => typeof o === 'string' ? o : (o.label || o.value))));
    
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
        version: initialData?.version || 'v1',
        // Campos nuevos
        ultima_verificacion: '',
        siguiente_verificacion: '',
        plazo_vigencia: '',
        estado_equipo: ''
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
    const isMobile = useMediaQuery('(max-width: 768px)');

    const { showToast } = useToast();
    const { hideNotification } = useNavStore();
    const { hasPermission } = useAuth();

    // Permissions
    // RB-08: AI_MA_ADMIN_ACCESO eliminado (no existe en BD). Solo permisos reales.
    const canCreateEquipo = hasPermission('AI_MA_CREAR_EQUIPO');
    const canEditEquipo = hasPermission('AI_MA_EDITAR_EQUIPO');
    const isSuper = false;

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
                    adminService.getMuestreadores('', ''),   // todos: activos e inactivos
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
                        equipo_asociado: (!baseData.equipo_asociado || baseData.equipo_asociado === 0 || baseData.equipo_asociado === '0') ? 'No Aplica' : baseData.equipo_asociado,
                        correlativo: Number(baseData.correlativo) || 0,
                        version: baseData.version || 'v1',
                        // Campos nuevos: formatear fechas si vienen como ISO
                        ultima_verificacion: baseData.ultima_verificacion ? baseData.ultima_verificacion.split('T')[0] : '',
                        siguiente_verificacion: baseData.siguiente_verificacion ? baseData.siguiente_verificacion.split('T')[0] : '',
                        plazo_vigencia: baseData.plazo_vigencia || '',
                        estado_equipo: baseData.estado_equipo || ''
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

    // Sincronizar vigencia (fecha_vigencia) con siguiente_verificacion en tiempo real
    useEffect(() => {
        if (formData.vigencia !== formData.siguiente_verificacion) {
            setFormData((prev: any) => ({ ...prev, vigencia: formData.siguiente_verificacion || '' }));
        }
    }, [formData.siguiente_verificacion]);

    // Sincronizar equipo_asociado si viene como ID numérico heredado
    useEffect(() => {
        if (allEquipos.length > 0 && formData.equipo_asociado && !isNaN(Number(formData.equipo_asociado)) && Number(formData.equipo_asociado) !== 0) {
            const found = allEquipos.find(e => Number(e.id_equipo) === Number(formData.equipo_asociado));
            if (found && found.codigo) {
                setFormData((p: any) => ({ ...p, equipo_asociado: found.codigo }));
            }
        }
    }, [allEquipos, formData.equipo_asociado]);

    const warningsAlert = useMemo(() => {
        if (!initialData?.id_equipo) return null;
        
        const warnings: string[] = [];
        
        // 1. Check calibration dates
        if (formData.vigencia) {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            
            const vigDate = new Date(formData.vigencia + 'T00:00:00');
            if (!isNaN(vigDate.getTime())) {
                vigDate.setHours(0, 0, 0, 0);
                const diffTime = vigDate.getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                const isExpired = diffDays < 0;
                const isExpiringSoon = diffDays >= 0 && diffDays <= 30;
                const isCurrentlyActive = String(formData.estado).toLowerCase() === 'activo';
                
                if (isExpired) {
                    warnings.push(`La fecha de vigencia de este equipo (${formData.vigencia}) ya ha expirado.`);
                    if (isCurrentlyActive) {
                        warnings.push(`El estado actual del equipo es "Activo", pero ya debería estar inactivo debido a su vigencia vencida.`);
                    }
                } else if (isExpiringSoon) {
                    warnings.push(`La fecha de vigencia de este equipo (${formData.vigencia}) está por vencer en ${diffDays} día(s).`);
                }
            }
        }
        
        // 2. Check manager status
        if (formData.id_muestreador && muestreadores.length > 0) {
            const assignedMuestreador = muestreadores.find(m => String(m.id_muestreador) === String(formData.id_muestreador));
            if (assignedMuestreador && (assignedMuestreador.habilitado === 'N' || assignedMuestreador.habilitado === false)) {
                warnings.push(`El responsable asignado (${assignedMuestreador.nombre_muestreador}) se encuentra inactivo/deshabilitado.`);
            }
        }
        
        if (warnings.length === 0) return null;
        
        return {
            title: "Advertencias del Equipo",
            color: "orange",
            messages: warnings
        };
    }, [initialData?.id_equipo, formData.vigencia, formData.estado, formData.id_muestreador, muestreadores]);

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
        if (!isFormValid) {
            showToast({ type: 'error', message: 'Por favor complete todos los campos obligatorios.' });
            return;
        }
        // Edición → ir directo a confirmar guardado
        if (initialData?.id_equipo) {
            setShowSaveConfirm(true);
            return;
        }
        // E-01: si estamos en step 0 → generar bulk y avanzar; si estamos en step 1 → guardar.
        if (activeStep === 0) {
            generateBulkItems(bulkQuantity, formData);
            setActiveStep(1);
        } else {
            setShowSaveConfirm(true);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        setShowSaveConfirm(false);
        try {
            const isEdit = !!initialData?.id_equipo;
            if (isEdit) {
                const data = { ...formData, equipo_asociado: (formData.equipo_asociado === 'No Aplica' || !formData.equipo_asociado) ? '0' : String(formData.equipo_asociado) };
                await equipoService.updateEquipo(initialData!.id_equipo, data);
                if (initialData.requestId) {
                    const isTech = initialData.requestStatus === 'PENDIENTE_TECNICA';
                    await adminService.updateSolicitudStatus(initialData.requestId, isTech ? 'PENDIENTE_CALIDAD' : 'APROBADO', isTech ? 'Actualizado por Técnica' : 'Aprobado');
                    if (isTech) hideNotification(`${initialData.requestId}-PENDIENTE_TECNICA`);
                }
                showToast({ type: 'success', message: 'Equipo actualizado correctamente' });
            } else {
                const items = bulkItems.map(it => ({ ...it, equipo_asociado: (it.equipo_asociado === 'No Aplica' || !it.equipo_asociado) ? '0' : String(it.equipo_asociado) }));
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
        <Box p="md" style={{ width: '100%' }}>
            <LoadingOverlay visible={loading || processingAction} />
            
            <Paper shadow="sm" radius="md" p="xl" withBorder>
                <Stack gap="xl">
                    <Group justify="space-between" align="flex-start">
                        <Stack gap={0} flex={isMobile ? 'none' : 1}>
                            <Title order={isMobile ? 3 : 2}>
                                {requestedChanges?.isReactivation ? 'Activación de Equipo' : (initialData?.id_equipo ? 'Editar Equipo' : 'Nuevo Equipo')}
                            </Title>
                            <Text c="dimmed" size="xs">
                                {initialData?.id_equipo ? `Modificando equipo: ${formData.codigo}` : 'Completa los datos para dar de alta nuevos equipos en el sistema.'}
                            </Text>
                        </Stack>

                        <Group gap="xs" style={{ width: isMobile ? '100%' : 'auto' }} grow={isMobile}>
                            <Button variant="subtle" leftSection={<IconArrowLeft size={18} />} onClick={onCancel} color="gray" size={isMobile ? 'xs' : 'sm'}>
                                {isMobile ? 'Volver' : 'Volver'}
                            </Button>
                            <ProtectedContent permission="EQ_HISTORY">
                                <Button 
                                    variant="light" 
                                    leftSection={<IconHistory size={18} />} 
                                    onClick={() => setShowHistory(!showHistory)}
                                    size={isMobile ? 'xs' : 'sm'}
                                >
                                    {isMobile ? 'Historial' : (showHistory ? 'Ocultar Historial' : 'Ver Historial')}
                                </Button>
                            </ProtectedContent>
                            <ProtectedContent permission="EQ_UPDATE">
                                <Button 
                                    leftSection={<IconDeviceFloppy size={18} />}
                                    onClick={handleSave}
                                    loading={loading}
                                    color="adl-blue"
                                    size={isMobile ? 'xs' : 'sm'}
                                >
                                    {initialData?.id_equipo ? 'Guardar' : 'Crear'}
                                </Button>
                            </ProtectedContent>
                        </Group>
                    </Group>

                    {initialData && formData.version && (
                        <Badge variant="light" color="blue" size="lg" radius="sm">
                            Versión Activa: {formData.version}
                        </Badge>
                    )}

                    {warningsAlert && (
                        <Alert 
                            icon={<IconAlertTriangle size={20} />} 
                            title={warningsAlert.title} 
                            color={warningsAlert.color} 
                            variant="light" 
                            radius="md"
                        >
                            <Stack gap="xs">
                                {warningsAlert.messages.map((msg, idx) => (
                                    <Text key={idx} size="sm" style={{ margin: 0 }}>{msg}</Text>
                                ))}
                            </Stack>
                        </Alert>
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
                                <Grid gutter="xs">
                                    {requestedChanges.nueva_ubicacion && (
                                        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                                            <Paper p="xs" withBorder bg="white">
                                                <Text size="xs" c="dimmed" tt="uppercase">Ubicación</Text>
                                                <Text fw={700} color="blue" size="sm">{requestedChanges.nueva_ubicacion}</Text>
                                            </Paper>
                                        </Grid.Col>
                                    )}
                                    {requestedChanges.nuevo_responsable_id && (
                                        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                                            <Paper p="xs" withBorder bg="white">
                                                <Text size="xs" c="dimmed" tt="uppercase">Responsable</Text>
                                                <Text fw={700} color="blue" size="sm">{muestreadores.find(m => m.id_muestreador === requestedChanges.nuevo_responsable_id)?.nombre_muestreador || '---'}</Text>
                                            </Paper>
                                        </Grid.Col>
                                    )}
                                    {requestedChanges.vigencia && (
                                        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                                            <Paper p="xs" withBorder bg="white">
                                                <Text size="xs" c="dimmed" tt="uppercase">Vigencia</Text>
                                                <Text fw={700} color="blue" size="sm">{requestedChanges.vigencia}</Text>
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

                    <Stepper active={activeStep} onStepClick={setActiveStep} color="adl-blue" size="sm" orientation={isMobile ? 'vertical' : 'horizontal'}>
                        <Stepper.Step label="Información General" description="Datos del equipo">
                            <Stack gap="xl" mt="md">
                                <Grid>
                                    <Grid.Col span={{ base: 12, md: 4 }}>
                                        <MantineHybridSelect
                                            label={<FieldLabel label="Tipo de Equipo *" help="Categoría del equipo (ej: Multiparámetro, pH-metro, Termómetro) para agrupar equipos con características similares." />}
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
                                            label={<FieldLabel label="Ubicación (Sede) *" help="Sede física de ADL donde se almacena y opera el equipo (ej: PM para Puerto Montt, CO para Coyhaique)." />}
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
                                            label={<FieldLabel label="Estado *" help="Estado de habilitación del equipo (ej: Habilitado) para su uso general en el sistema." />}
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
                                            label={<FieldLabel label="Nombre del Equipo *" help="Modelo o nombre específico del equipo (ej: HI98194, YSI ProDSS) según catálogo." />}
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
                                            strict={!isSuper && !initialData?.id_equipo}
                                            required
                                            error={attemptedSubmit && !formData.nombre && "Obligatorio"}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 6, md: 3 }}>
                                        <TextInput
                                            label={<FieldLabel label="Sigla" help="Sigla identificadora que forma parte del código de barra del equipo (ej: MULTI, PH, TERM)." />}
                                            placeholder="Ej: PH"
                                            value={formData.sigla}
                                            onChange={(e) => setFormData((p: any) => ({ ...p, sigla: e.target.value }))}
                                            rightSection={generatingCode && <LoadingOverlay visible loaderProps={{ size: 'xs' }} />}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 6, md: 3 }}>
                                        <NumberInput
                                            label={<FieldLabel label="Correlativo" help="Número correlativo único de la unidad del equipo para diferenciarlo de otros del mismo tipo y sede." />}
                                            value={formData.correlativo}
                                            onChange={(val) => setFormData((p: any) => ({ ...p, correlativo: val }))}
                                            disabled={!isSuper}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, md: 8 }}>
                                        <TextInput
                                            label={<FieldLabel label="Código Final *" help="Código único de barra generado de forma automática para la identificación del equipo en terreno." />}
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
                                            label={<FieldLabel label="Vigencia *" help="Fecha límite de vigencia de la última calibración o certificación del equipo." />}
                                            type="date"
                                            value={formData.vigencia}
                                            readOnly
                                            required
                                            description="Sincronizada con Siguiente Verificación"
                                            error={attemptedSubmit && !formData.vigencia && "Obligatorio"}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, md: 6 }}>
                                        <Select
                                            label={<FieldLabel label="Responsable (Muestreador) *" help="Muestreador responsable del cuidado y traslado del equipo en terreno." />}
                                            placeholder="Seleccione..."
                                            data={muestreadores
                                                .filter(m => {
                                                    const isEditing = !!initialData?.id_equipo;
                                                    const isActive = !(m.habilitado === 'N' || m.habilitado === false);
                                                    const isCurrentlySelected = String(m.id_muestreador) === String(formData.id_muestreador);
                                                    return isEditing ? (isActive || isCurrentlySelected) : isActive;
                                                })
                                                .map(m => ({
                                                    value: String(m.id_muestreador),
                                                    label: m.habilitado === 'N' || m.habilitado === false
                                                        ? `${m.nombre_muestreador} (Inactivo)`
                                                        : m.nombre_muestreador
                                                }))}
                                            value={String(formData.id_muestreador)}
                                            onChange={(val) => setFormData((p: any) => ({ ...p, id_muestreador: val }))}
                                            required
                                            searchable
                                            error={attemptedSubmit && !formData.id_muestreador && "Obligatorio"}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, md: 6 }}>
                                        {/* E-01: mostrar nombre + código para que el usuario pueda elegir, no IDs crudos */}
                                        <Select
                                            label={<FieldLabel label="Equipo Asociado" help="Equipo complementario asignado a esta unidad (ej: sonda de repuesto, electrodo asociado)." />}
                                            placeholder={allEquipos.length === 0 ? 'No hay equipos para asociar' : 'Buscar equipo...'}
                                            value={String(formData.equipo_asociado)}
                                            data={(() => {
                                                const seen = new Set();
                                                const optionsList = [
                                                    { value: 'No Aplica', label: 'No Aplica' },
                                                    ...allEquipos
                                                        .filter(e => e && e.codigo)
                                                        .map(e => ({
                                                            value: e.codigo,
                                                            label: `${e.codigo || ''} - ${e.nombre || 'Sin nombre'}`.trim()
                                                        }))
                                                ];
                                                return optionsList.filter(opt => {
                                                    if (seen.has(opt.value)) return false;
                                                    seen.add(opt.value);
                                                    return true;
                                                });
                                            })()}
                                            onChange={(val) => setFormData((p: any) => ({ ...p, equipo_asociado: val || 'No Aplica' }))}
                                            searchable
                                            clearable
                                            nothingFoundMessage="Sin coincidencias"
                                        />
                                    </Grid.Col>
                                </Grid>
                                <Divider label="Configuración Técnica" labelPosition="center" />
                                <Grid>
                                    <Grid.Col span={{ base: 12, md: 4 }}>
                                        <MantineHybridSelect
                                            label={<FieldLabel label="¿Qué Mide? *" help="Parámetro o variable física/química que mide el equipo (ej: pH, Conductividad, Oxígeno Disuelto, Temperatura)." />}
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
                                            label={<FieldLabel label="Unidad de Medida" help="Nombre completo de la unidad de medida utilizada para registrar los datos (ej: Miligramos por Litro, Grados Celsius)." />}
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
                                            label={<FieldLabel label="Sigla Unidad" help="Abreviación técnica de la unidad de medida (ej: mg/L, °C, µS/cm)." />}
                                            value={formData.unidad_medida_sigla}
                                            onChange={(e) => setFormData((p: any) => ({ ...p, unidad_medida_sigla: e.target.value }))}
                                            placeholder="mg/L, %"
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={12}>
                                        <Group gap="xl" p="md" bg="gray.0">
                                            <Checkbox 
                                                label={<FieldLabel label="Tiene Factor de Corrección" help="Indica si se debe aplicar una constante de corrección a los valores medidos por el equipo." />} 
                                                checked={formData.tiene_fc === 'SI'} 
                                                onChange={(e) => setFormData((p: any) => ({ ...p, tiene_fc: e.target.checked ? 'SI' : 'NO' }))} 
                                            />
                                            <Checkbox 
                                                label={<FieldLabel label="Visible para Muestreadores" help="Determina si el equipo estará visible y seleccionable para los muestreadores en la aplicación móvil." />} 
                                                checked={formData.visible_muestreador === 'SI'} 
                                                onChange={(e) => setFormData((p: any) => ({ ...p, visible_muestreador: e.target.checked ? 'SI' : 'NO' }))} 
                                            />
                                            <Checkbox 
                                                label={<FieldLabel label="Incluir en Informe" help="Indica si el equipo y sus mediciones asociadas deben ser impresos en el informe final de resultados." />} 
                                                checked={formData.informe === 'SI'} 
                                                onChange={(e) => setFormData((p: any) => ({ ...p, informe: e.target.checked ? 'SI' : 'NO' }))} 
                                            />
                                        </Group>
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, sm: 4, md: 4 }}>
                                        <NumberInput label={<FieldLabel label="Error 0" help="Desviación o error detectado en la medición del punto de calibración cero." />} value={formData.error0} onChange={(v) => setFormData((p: any) => ({ ...p, error0: v }))} step={0.01} />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, sm: 4, md: 4 }}>
                                        <NumberInput label={<FieldLabel label="Error 15" help="Desviación o error detectado en la medición del punto de calibración intermedio (ej: 15°C o patrón intermedio)." />} value={formData.error15} onChange={(v) => setFormData((p: any) => ({ ...p, error15: v }))} step={0.01} />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, sm: 4, md: 4 }}>
                                        <NumberInput label={<FieldLabel label="Error 30" help="Desviación o error detectado en la medición del punto de calibración alto (ej: 30°C o patrón alto)." />} value={formData.error30} onChange={(v) => setFormData((p: any) => ({ ...p, error30: v }))} step={0.01} />
                                    </Grid.Col>
                                    <Grid.Col span={12}>
                                        <Textarea
                                            label={<FieldLabel label="Observaciones *" help="Comentarios adicionales, historial de fallas, reparaciones o detalles relevantes del equipo." />}
                                            placeholder="Detalles sobre el equipo..."
                                            value={formData.observacion || ''}
                                            onChange={(e) => setFormData((p: any) => ({ ...p, observacion: e.target.value }))}
                                            required
                                            minRows={3}
                                            error={attemptedSubmit && !formData.observacion && "Obligatorio"}
                                        />
                                    </Grid.Col>
                                </Grid>

                                <Divider label="Verificación y Estado" labelPosition="center" />
                                <Grid align="flex-end">
                                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                                        <TextInput
                                            label={<FieldLabel label="Última Verificación" help="Fecha en que se realizó la última verificación técnica de calibración del equipo." />}
                                            type="date"
                                            value={formData.ultima_verificacion}
                                            onChange={(e) => {
                                                const newDate = e.target.value;
                                                let sigVerif = formData.siguiente_verificacion;
                                                if (newDate) {
                                                    const d = new Date(newDate);
                                                    d.setDate(d.getDate() + 90);
                                                    sigVerif = d.toISOString().split('T')[0];
                                                }
                                                setFormData((p: any) => ({ ...p, ultima_verificacion: newDate, siguiente_verificacion: sigVerif }));
                                            }}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                                        <TextInput
                                            label={<FieldLabel label="Siguiente Verificación *" help="Fecha programada para la próxima verificación técnica (por defecto 90 días después de la última). Corresponde también a la fecha de vigencia." />}
                                            type="date"
                                            value={formData.siguiente_verificacion}
                                            description="Auto: Última + 90 días (editable)"
                                            onChange={(e) => setFormData((p: any) => ({ ...p, siguiente_verificacion: e.target.value }))}
                                            required
                                            error={attemptedSubmit && !formData.siguiente_verificacion && "Obligatorio"}
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                                        <Select
                                            label={<FieldLabel label="Estado del Equipo" help="Estado operativo actual del equipo (ej: Operativo, En Mantención, En Calibración, Fuera de Servicio)." />}
                                            placeholder="Seleccione..."
                                            data={[
                                                'Operativo',
                                                'Dado de Baja',
                                                'En Mantención',
                                                'En Calibración',
                                                'Fuera de Servicio',
                                            ]}
                                            value={formData.estado_equipo}
                                            onChange={(val) => setFormData((p: any) => ({ ...p, estado_equipo: val || '' }))}
                                            clearable
                                        />
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                                        <Textarea
                                            label={<FieldLabel label="Plazo Vigencia" help="Comentarios o aclaraciones sobre el plazo de vigencia de la calibración del equipo (ej: Hasta el día 30 del mes...)." />}
                                            placeholder="Ej: Hasta el día 30 del mes..."
                                            value={formData.plazo_vigencia || ''}
                                            onChange={(e) => setFormData((p: any) => ({ ...p, plazo_vigencia: e.target.value }))}
                                            minRows={2}
                                            autosize
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
                        {!initialData?.id_equipo && (
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
                                                        <Table.Th style={{ minWidth: '150px' }}>Código</Table.Th>
                                                        <Table.Th style={{ minWidth: '140px' }}>Ubicación</Table.Th>
                                                        <Table.Th style={{ minWidth: '130px' }}>Vigencia</Table.Th>
                                                        <Table.Th w={60}>Obs.</Table.Th>
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
                                                                        n[idx].siguiente_verificacion = e.target.value;
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
                        )}

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
        </Box>
    );
};
