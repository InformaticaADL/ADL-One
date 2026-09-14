import React, { useState, useEffect, useMemo } from 'react';
import {
    Typography,
    Button,
    Input,
    AutoComplete,
    Select,
    InputNumber,
    Checkbox,
    Card,
    Divider,
    Steps,
    Alert,
    Table,
    Tag,
    Modal,
    Tooltip,
    Badge,
    Spin
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconArrowLeft,
    IconHistory,
    IconAlertTriangle,
    IconInfoCircle,
    IconDeviceFloppy,
    IconChevronRight,
    IconChevronLeft,
    IconEdit,
    IconX
} from '@tabler/icons-react';

import { equipoService, type Equipo, type EquipoHistorial } from '../services/equipo.service';
import { adminService } from '../../../services/admin.service';
import { catalogosService } from '../../medio-ambiente/services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { useNavStore } from '../../../store/navStore';
import { useAuth } from '../../../contexts/AuthContext';
import { EquipmentRequestsModal } from './EquipmentRequestsModal';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { FieldLabel } from '../../../components/common/FieldHelp';

const { Text, Title } = Typography;
const { TextArea } = Input;

// Local HybridSelect replacement using antd components.
// If strict=true, it uses Select (must be in list).
// If strict=false, it uses AutoComplete (can type any value).
const HybridSelect: React.FC<any> = ({ label, value, options, onChange, placeholder, strict, required, disabled, error, ...others }) => {
    const data = Array.from(new Set(options.map((o: any) => typeof o === 'string' ? o : (o.label || o.value)))) as string[];
    const selectOptions = data.map((d) => ({ value: d, label: d }));

    return (
        <div>
            {label && <div style={{ marginBottom: 4 }}>{typeof label === 'string' ? <Text>{label}{required && ' *'}</Text> : label}</div>}
            {strict ? (
                <Select
                    placeholder={placeholder}
                    options={selectOptions}
                    value={value ?? undefined}
                    onChange={(v) => onChange(v ?? null)}
                    showSearch
                    allowClear
                    disabled={disabled}
                    status={error ? 'error' : undefined}
                    filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                    style={{ width: '100%' }}
                    notFoundContent="No se encontró"
                    {...others}
                />
            ) : (
                <AutoComplete
                    placeholder={placeholder}
                    options={selectOptions}
                    value={value ?? undefined}
                    onChange={(v) => onChange(v ?? null)}
                    disabled={disabled}
                    status={error ? 'error' : undefined}
                    filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                    style={{ width: '100%' }}
                    {...others}
                />
            )}
            {error && <Text type="danger" style={{ fontSize: 12, display: 'block', marginTop: 2 }}>{error}</Text>}
        </div>
    );
};

interface Props {
    onCancel: () => void;
    onSave: () => void;
    initialData?: (Equipo & { requestId?: number; requestStatus?: string }) | null;
    pendingRequests?: any[];
    onRefreshSolicitudes?: () => void;
}

// Grid helpers (replace Mantine Grid/Grid.Col)
const gridRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16, width: '100%' };

export const EquipoForm: React.FC<Props> = ({ onCancel, onSave, initialData, pendingRequests = [], onRefreshSolicitudes }) => {
    // --- Helpers for default dates ---
    const getTodayString = () => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const calculateNext90Days = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        d.setDate(d.getDate() + 90);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const formatDateToSpanish = (dateStr: string) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
    };

    const defaultRevisionDate = getTodayString();
    const defaultSiguienteDate = calculateNext90Days(defaultRevisionDate);

    const parseInitialDate = (dateStr: string | undefined | null) => {
        if (!dateStr) return '';
        let clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        if (clean.includes('/')) {
            const parts = clean.split('/');
            if (parts.length === 3) {
                if (parts[2].length === 4) {
                    clean = `${parts[2]}-${parts[1]}-${parts[0]}`;
                } else if (parts[0].length === 4) {
                    clean = `${parts[0]}-${parts[1]}-${parts[2]}`;
                }
            }
        }
        return clean;
    };

    const initialRevision = parseInitialDate(initialData?.ultima_verificacion) || (initialData?.id_equipo ? '' : defaultRevisionDate);
    const initialSiguiente = parseInitialDate(initialData?.siguiente_verificacion) || (initialData?.id_equipo ? '' : defaultSiguienteDate);

    // --- State ---
    const [formData, setFormData] = useState<any>({
        codigo: '',
        nombre: '',
        tipo: '',
        ubicacion: '',
        estado: '',
        vigencia: initialSiguiente,
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
        ultima_verificacion: initialRevision,
        siguiente_verificacion: initialSiguiente,
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
    const [showRevisionConfirm, setShowRevisionConfirm] = useState(false);
    const [compareVersion, setCompareVersion] = useState<any | null>(null);
    const [editingObsIdx, setEditingObsIdx] = useState<number | null>(null);
    const [editingObsText, setEditingObsText] = useState('');
    const [requestedChanges, setRequestedChanges] = useState<any>(null);
    const [originalUltimaVerificacion, setOriginalUltimaVerificacion] = useState<string>(initialRevision);
    const [originalSiguienteVerificacion, setOriginalSiguienteVerificacion] = useState<string>(initialSiguiente);
    const [generatingCode, setGeneratingCode] = useState(false);
    const [namesOptions, setNamesOptions] = useState<string[]>([]);
    const [tipoOptions, setTipoOptions] = useState<string[]>([]);
    const [queMideOptions, setQueMideOptions] = useState<string[]>([]);
    const [unidadesOptions, setUnidadesOptions] = useState<string[]>([]);
    const [sedeOptions, setSedeOptions] = useState<string[]>([]);
    const [estadoOptions, setEstadoOptions] = useState<string[]>([]);
    const [estadoEquipoOptions, setEstadoEquipoOptions] = useState<string[]>([]);
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

    const colSpan = (md: number): React.CSSProperties => ({ gridColumn: isMobile ? 'span 12' : `span ${md}` });

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
                const [mRes, eRes, allERes, estadoEquipoRes] = await Promise.all([
                    adminService.getMuestreadores('', ''),   // todos: activos e inactivos
                    equipoService.getEquipos({ limit: 1 }),
                    equipoService.getEquipos({ limit: 2000 }),
                    catalogosService.getEstadosEquipo().catch(err => {
                        console.error('Error loading dynamic estados equipo, using fallback', err);
                        return [];
                    })
                ]);

                setMuestreadores(mRes.data || []);
                setAllEquipos(allERes.data || []);

                if (estadoEquipoRes && estadoEquipoRes.length > 0) {
                    const activeNames = estadoEquipoRes
                        .filter((item: any) => item.activo === true || item.activo === 1 || item.activo === 'S')
                        .map((item: any) => item.nombre);
                    setEstadoEquipoOptions(activeNames);
                }

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

                    if (hasId) {
                        const equipRes = await equipoService.getEquipoById(initialData.id_equipo);
                        if (equipRes.success) {
                            baseData = { ...equipRes.data, ...initialData };
                            if (!initialData.vigencia && equipRes.data.vigencia) baseData.vigencia = equipRes.data.vigencia;
                            if (isTraspaso) {
                                setRequestedChanges({
                                    nueva_ubicacion: initialData.ubicacion,
                                    nuevo_responsable_id: initialData.id_muestreador,
                                    vigencia: initialData.vigencia
                                });
                            }
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

                    const origUltima = hasId ? (baseData.ultima_verificacion ? baseData.ultima_verificacion.split('T')[0] : '') : defaultRevisionDate;
                    const origSiguiente = hasId ? (baseData.siguiente_verificacion ? baseData.siguiente_verificacion.split('T')[0] : '') : defaultSiguienteDate;
                    setOriginalUltimaVerificacion(origUltima);
                    setOriginalSiguienteVerificacion(origSiguiente);

                    setFormData({
                        ...baseData,
                        vigencia: hasId ? formattedDate : origSiguiente,
                        id_muestreador: isTraspaso ? (initialData.id_muestreador || baseData.id_muestreador) : (isAlta ? (initialData.id_muestreador || 0) : baseData.id_muestreador),
                        error0: Number(baseData.error0) || 0,
                        error15: Number(baseData.error15) || 0,
                        error30: Number(baseData.error30) || 0,
                        equipo_asociado: (!baseData.equipo_asociado || baseData.equipo_asociado === 0 || baseData.equipo_asociado === '0') ? 'No Aplica' : baseData.equipo_asociado,
                        correlativo: Number(baseData.correlativo) || 0,
                        version: baseData.version || 'v1',
                        tiene_fc: (baseData.tiene_fc === 'S' || baseData.tiene_fc === 'SI') ? 'SI' : 'NO',
                        visible_muestreador: (baseData.visible_muestreador === 'S' || baseData.visible_muestreador === 'SI') ? 'SI' : 'NO',
                        informe: (baseData.informe === 'S' || baseData.informe === 'SI') ? 'SI' : 'NO',
                        ultima_verificacion: origUltima,
                        siguiente_verificacion: origSiguiente,
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.tipo, formData.ubicacion, formData.nombre, formData.sigla, formData.correlativo]);

    // Sincronizar vigencia (fecha_vigencia) con siguiente_verificacion en tiempo real
    useEffect(() => {
        if (formData.vigencia !== formData.siguiente_verificacion) {
            setFormData((prev: any) => ({ ...prev, vigencia: formData.siguiente_verificacion || '' }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            color: "warning" as const,
            messages: warnings
        };
    }, [initialData?.id_equipo, formData.vigencia, formData.estado, formData.id_muestreador, muestreadores]);

    const getVersionDiff = (h: any) => {
        const diffList: Array<{ campo: string, oldValue: string, newValue: string }> = [];

        const getSamplerName = (id: any) => {
            return muestreadores.find(m => String(m.id_muestreador) === String(id))?.nombre_muestreador || `ID ${id}`;
        };

        const formatYMDToDMY = (dateStr: string) => {
            if (!dateStr) return '---';
            const parts = dateStr.split('-');
            if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
            return dateStr;
        };

        const comparisons = [
            { campo: 'Código', oldVal: h.codigo, newVal: formData.codigo },
            { campo: 'Nombre', oldVal: h.nombre, newVal: formData.nombre },
            { campo: 'Tipo de Equipo', oldVal: h.tipo, newVal: formData.tipo },
            { campo: 'Ubicación (Sede)', oldVal: h.ubicacion, newVal: formData.ubicacion },
            { campo: 'Estado Habilitación', oldVal: h.estado, newVal: formData.estado },
            { campo: 'Responsable', oldVal: getSamplerName(h.id_muestreador), newVal: getSamplerName(formData.id_muestreador) },
            {
                campo: 'Siguiente Revisión (Vigente hasta)',
                oldVal: h.siguiente_verificacion ? formatYMDToDMY(h.siguiente_verificacion.split('T')[0]) : (h.vigencia || '---'),
                newVal: formData.siguiente_verificacion ? formatYMDToDMY(formData.siguiente_verificacion) : '---'
            },
            {
                campo: 'Fecha de Creación',
                oldVal: h.ultima_verificacion ? formatYMDToDMY(h.ultima_verificacion.split('T')[0]) : '---',
                newVal: formData.ultima_verificacion ? formatYMDToDMY(formData.ultima_verificacion) : '---'
            },
            { campo: 'Plazo Vigencia', oldVal: h.plazo_vigencia || '---', newVal: formData.plazo_vigencia || '---' },
            { campo: 'Estado del Equipo', oldVal: h.estado_equipo || '---', newVal: formData.estado_equipo || '---' },
            { campo: '¿Qué Mide?', oldVal: h.que_mide || '---', newVal: formData.que_mide || '---' },
            { campo: 'Unidad de Medida', oldVal: h.unidad_medida_textual || '---', newVal: formData.unidad_medida_textual || '---' },
            { campo: 'Sigla Unidad', oldVal: h.unidad_medida_sigla || '---', newVal: formData.unidad_medida_sigla || '---' },
            { campo: 'Tiene Factor de Corrección', oldVal: h.tiene_fc === 'S' || h.tiene_fc === 'SI' ? 'SÍ' : 'NO', newVal: formData.tiene_fc === 'SI' ? 'SÍ' : 'NO' },
            { campo: 'Visible para Muestreadores', oldVal: h.visible_muestreador === 'S' || h.visible_muestreador === 'SI' ? 'SÍ' : 'NO', newVal: formData.visible_muestreador === 'SI' ? 'SÍ' : 'NO' },
            { campo: 'Incluir en Informe', oldVal: h.informe === 'S' || h.informe === 'SI' ? 'SÍ' : 'NO', newVal: formData.informe === 'SI' ? 'SÍ' : 'NO' },
            { campo: 'Error 0', oldVal: String(h.error0 ?? 0), newVal: String(formData.error0 ?? 0) },
            { campo: 'Error 15', oldVal: String(h.error15 ?? 0), newVal: String(formData.error15 ?? 0) },
            { campo: 'Error 30', oldVal: String(h.error30 ?? 0), newVal: String(formData.error30 ?? 0) },
            { campo: 'Equipo Asociado', oldVal: h.equipo_asociado === '0' ? 'No Aplica' : (h.equipo_asociado || 'No Aplica'), newVal: formData.equipo_asociado || 'No Aplica' },
            { campo: 'Observación', oldVal: h.observacion || '---', newVal: formData.observacion || '---' }
        ];

        comparisons.forEach(c => {
            const cleanOld = String(c.oldVal || '').trim().toLowerCase();
            const cleanNew = String(c.newVal || '').trim().toLowerCase();
            if (cleanOld !== cleanNew) {
                diffList.push({
                    campo: c.campo,
                    oldValue: String(c.oldVal || '---'),
                    newValue: String(c.newVal || '---')
                });
            }
        });

        return diffList;
    };

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
                    const origUltima = parseInitialDate(b.ultima_verificacion);
                    const origSiguiente = parseInitialDate(b.siguiente_verificacion);
                    setOriginalUltimaVerificacion(origUltima);
                    setOriginalSiguienteVerificacion(origSiguiente);

                    setFormData({
                        ...b,
                        vigencia: fd,
                        version: b.version || 'v1',
                        tiene_fc: (b.tiene_fc === 'S' || b.tiene_fc === 'SI') ? 'SI' : 'NO',
                        visible_muestreador: (b.visible_muestreador === 'S' || b.visible_muestreador === 'SI') ? 'SI' : 'NO',
                        informe: (b.informe === 'S' || b.informe === 'SI') ? 'SI' : 'NO',
                        ultima_verificacion: origUltima,
                        siguiente_verificacion: origSiguiente,
                        plazo_vigencia: b.plazo_vigencia || '',
                        estado_equipo: b.estado_equipo || ''
                    });
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

    const handleSetToday = () => {
        const todayStr = getTodayString();
        const next90 = calculateNext90Days(todayStr);
        setFormData((prev: any) => ({
            ...prev,
            ultima_verificacion: todayStr,
            siguiente_verificacion: next90,
            vigencia: next90
        }));
    };

    const handleResetRevision = () => {
        setFormData((prev: any) => ({
            ...prev,
            ultima_verificacion: originalUltimaVerificacion,
            siguiente_verificacion: originalSiguienteVerificacion,
            vigencia: originalSiguienteVerificacion
        }));
    };

    const isFormValid = useMemo(() => {
        const isEdit = !!initialData?.id_equipo;
        const hasNewRevision = isEdit
            ? (formData.ultima_verificacion && formData.ultima_verificacion !== originalUltimaVerificacion)
            : !!formData.ultima_verificacion;

        return !!(
            formData.nombre &&
            formData.tipo &&
            formData.ubicacion &&
            formData.estado &&
            formData.codigo &&
            hasNewRevision &&
            formData.id_muestreador &&
            formData.que_mide &&
            formData.observacion &&
            formData.siguiente_verificacion &&
            !generatingCode
        );
    }, [formData, generatingCode, initialData, originalUltimaVerificacion]);

    const missingFields = useMemo(() => {
        const missing = [];
        if (!formData.nombre) missing.push("Nombre del Equipo");
        if (!formData.tipo) missing.push("Tipo de Equipo");
        if (!formData.ubicacion) missing.push("Ubicación (Sede)");
        if (!formData.estado) missing.push("Estado");
        if (!formData.codigo) missing.push("Código Final");

        const isEdit = !!initialData?.id_equipo;
        const hasNewRevision = isEdit
            ? (formData.ultima_verificacion && formData.ultima_verificacion !== originalUltimaVerificacion)
            : !!formData.ultima_verificacion;
        if (!hasNewRevision) {
            missing.push(isEdit ? "Revisión Actual (Registrar hoy)" : "Fecha Creación");
        }

        if (!formData.id_muestreador) missing.push("Responsable (Muestreador)");
        if (!formData.que_mide) missing.push("¿Qué Mide?");
        if (!formData.observacion) missing.push("Observación");
        if (!formData.siguiente_verificacion) missing.push("Siguiente Revisión (Vigente hasta:)");
        return missing;
    }, [formData, initialData, originalUltimaVerificacion]);

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

    // --- Table columns ---
    const historyColumns: ColumnsType<EquipoHistorial> = [
        { title: 'Versión', dataIndex: 'version', key: 'version', render: (v) => <Text strong>{v}</Text> },
        { title: 'Fecha', dataIndex: 'fecha_cambio', key: 'fecha_cambio', render: (v) => new Date(v).toLocaleString() },
        { title: 'Usuario', dataIndex: 'nombre_usuario_cambio', key: 'nombre_usuario_cambio', render: (v) => v || 'Sistema' },
        { title: 'Código', dataIndex: 'codigo', key: 'codigo' },
        {
            title: 'Acción', key: 'accion', render: (_, h) => (
                <div style={{ display: 'flex', gap: 8 }}>
                    <Button size="small" onClick={() => setCompareVersion(h)}>Comparar</Button>
                    <Button size="small" type="primary" onClick={() => handleRestore(h)}>Habilitar</Button>
                </div>
            )
        }
    ];

    const bulkColumns: ColumnsType<any> = [
        { title: '#', key: 'idx', width: 40, render: (_, __, idx) => idx + 1 },
        {
            title: 'Código', key: 'codigo', render: (_, item, idx) => (
                <Input
                    size="small"
                    value={item.codigo}
                    onChange={(e) => {
                        const n = [...bulkItems];
                        n[idx].codigo = e.target.value;
                        setBulkItems(n);
                    }}
                />
            )
        },
        {
            title: 'Ubicación', key: 'ubicacion', render: (_, item, idx) => (
                <Select
                    size="small"
                    options={sedeOptions.map(s => ({ value: s, label: s }))}
                    value={item.ubicacion ?? undefined}
                    onChange={(v) => {
                        const n = [...bulkItems];
                        n[idx].ubicacion = v;
                        const fc = n[idx].correlativo < 10 ? `0${n[idx].correlativo}` : `${n[idx].correlativo}`;
                        n[idx].codigo = `${n[idx].sigla}.${fc}/MA.${v}`;
                        setBulkItems(n);
                    }}
                    style={{ width: '100%' }}
                />
            )
        },
        {
            title: 'Vigencia', key: 'vigencia', render: (_, item, idx) => (
                <Input
                    type="date"
                    size="small"
                    value={item.vigencia}
                    onChange={(e) => {
                        const n = [...bulkItems];
                        n[idx].vigencia = e.target.value;
                        n[idx].siguiente_verificacion = e.target.value;
                        setBulkItems(n);
                    }}
                />
            )
        },
        {
            title: 'Obs.', key: 'obs', width: 60, render: (_, item, idx) => (
                <Button
                    type="text"
                    size="small"
                    icon={<IconEdit size={16} color={item.observacion ? '#1c7ed6' : '#868e96'} />}
                    onClick={() => { setEditingObsIdx(idx); setEditingObsText(item.observacion || ''); }}
                />
            )
        }
    ];

    // --- Renders ---
    return (
        <div style={{ padding: 16, width: '100%', position: 'relative' }}>
            {(loading || processingAction) && (
                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.6)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Spin size="large" />
                </div>
            )}

            <Card style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: isMobile ? 'none' : 1 }}>
                            <Title level={isMobile ? 4 : 3} style={{ margin: 0 }}>
                                {requestedChanges?.isReactivation ? 'Activación de Equipo' : (initialData?.id_equipo ? 'Editar Equipo' : 'Nuevo Equipo')}
                            </Title>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                {initialData?.id_equipo ? `Modificando equipo: ${formData.codigo}` : 'Completa los datos para dar de alta nuevos equipos en el sistema.'}
                            </Text>
                        </div>

                        <div style={{ display: 'flex', gap: 8, width: isMobile ? '100%' : 'auto', flexWrap: 'wrap' }}>
                            <Button icon={<IconArrowLeft size={18} />} onClick={onCancel} style={isMobile ? { flex: 1 } : undefined}>
                                Volver
                            </Button>
                            <ProtectedContent permission="EQ_HISTORY">
                                <Button
                                    icon={<IconHistory size={18} />}
                                    onClick={() => setShowHistory(!showHistory)}
                                    style={isMobile ? { flex: 1 } : undefined}
                                >
                                    {isMobile ? 'Historial' : (showHistory ? 'Ocultar Historial' : 'Ver Historial')}
                                </Button>
                            </ProtectedContent>
                            {!initialData?.id_equipo && (
                                <ProtectedContent permission="EQ_UPDATE">
                                    <Button
                                        type="primary"
                                        icon={<IconDeviceFloppy size={18} />}
                                        onClick={handleSave}
                                        loading={loading}
                                        style={isMobile ? { flex: 1 } : undefined}
                                    >
                                        Crear
                                    </Button>
                                </ProtectedContent>
                            )}
                        </div>
                    </div>

                    {initialData && formData.version && (
                        <div>
                            <Tag color="blue" style={{ fontSize: 13, padding: '4px 10px' }}>
                                Versión Activa: {formData.version}
                            </Tag>
                        </div>
                    )}

                    {warningsAlert && (
                        <Alert
                            icon={<IconAlertTriangle size={20} />}
                            showIcon
                            message={warningsAlert.title}
                            type={warningsAlert.color}
                            description={
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {warningsAlert.messages.map((msg, idx) => (
                                        <Text key={idx} style={{ fontSize: 13, margin: 0 }}>{msg}</Text>
                                    ))}
                                </div>
                            }
                        />
                    )}

                    {/* Requested Changes (Traspaso/Alta Suggestion) */}
                    {!!(initialData?.requestId && requestedChanges) && (
                        <Card size="small" style={{ backgroundColor: '#e7f3ff', borderColor: '#a5d8ff' }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                                <IconInfoCircle size={20} color="#1864ab" />
                                <Text strong>Cambios sugeridos por Medio Ambiente</Text>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                                {requestedChanges.nueva_ubicacion && (
                                    <Card size="small" styles={{ body: { padding: 8 } }} style={{ backgroundColor: '#fff' }}>
                                        <Text style={{ fontSize: 11, textTransform: 'uppercase' }} type="secondary">Ubicación</Text>
                                        <Text strong style={{ color: '#1c7ed6', fontSize: 13, display: 'block' }}>{requestedChanges.nueva_ubicacion}</Text>
                                    </Card>
                                )}
                                {requestedChanges.nuevo_responsable_id && (
                                    <Card size="small" styles={{ body: { padding: 8 } }} style={{ backgroundColor: '#fff' }}>
                                        <Text style={{ fontSize: 11, textTransform: 'uppercase' }} type="secondary">Responsable</Text>
                                        <Text strong style={{ color: '#1c7ed6', fontSize: 13, display: 'block' }}>{muestreadores.find(m => m.id_muestreador === requestedChanges.nuevo_responsable_id)?.nombre_muestreador || '---'}</Text>
                                    </Card>
                                )}
                                {requestedChanges.vigencia && (
                                    <Card size="small" styles={{ body: { padding: 8 } }} style={{ backgroundColor: '#fff' }}>
                                        <Text style={{ fontSize: 11, textTransform: 'uppercase' }} type="secondary">Vigencia</Text>
                                        <Text strong style={{ color: '#1c7ed6', fontSize: 13, display: 'block' }}>{requestedChanges.vigencia}</Text>
                                    </Card>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* History Section */}
                    {showHistory && (
                        <Card size="small" style={{ backgroundColor: 'var(--app-hover-bg)' }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                                <IconHistory size={20} />
                                <Text strong>Historial de Versiones</Text>
                            </div>
                            <div style={{ overflowY: 'auto', maxHeight: 300 }}>
                                <Table
                                    size="small"
                                    columns={historyColumns}
                                    dataSource={history}
                                    rowKey="id_historial"
                                    loading={loadingHistory}
                                    pagination={false}
                                    locale={{ emptyText: 'Sin versiones previas.' }}
                                    rowClassName={(h) => lastRestoredVersion?.previous === h.version ? 'row-restored' : ''}
                                />
                            </div>
                        </Card>
                    )}

                    <Steps
                        current={activeStep}
                        onChange={setActiveStep}
                        size="small"
                        direction={isMobile ? 'vertical' : 'horizontal'}
                        items={[
                            { title: 'Información General', description: 'Datos del equipo' },
                            ...(!initialData?.id_equipo ? [{ title: 'Revisión Masiva', description: 'Confirmar seriales' }] : [])
                        ]}
                    />

                    {activeStep === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 8 }}>
                            <div style={gridRowStyle}>
                                <div style={colSpan(4)}>
                                    <HybridSelect
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
                                </div>
                                <div style={colSpan(4)}>
                                    <HybridSelect
                                        label={<FieldLabel label="Ubicación (Sede) *" help="Sede física de ADL donde se almacena y opera el equipo (ej: PM para Puerto Montt, CO para Coyhaique)." />}
                                        placeholder="Seleccione..."
                                        value={formData.ubicacion}
                                        options={sedeOptions}
                                        onChange={(val: any) => setFormData((p: any) => ({ ...p, ubicacion: val }))}
                                        strict
                                        required
                                        error={attemptedSubmit && !formData.ubicacion && "Obligatorio"}
                                    />
                                </div>
                                <div style={colSpan(4)}>
                                    <HybridSelect
                                        label={<FieldLabel label="Estado *" help="Estado de habilitación del equipo (ej: Habilitado) para su uso general en el sistema." />}
                                        placeholder="Seleccione..."
                                        value={formData.estado}
                                        options={estadoOptions}
                                        onChange={(val: any) => setFormData((p: any) => ({ ...p, estado: val }))}
                                        strict
                                        required
                                        error={attemptedSubmit && !formData.estado && "Obligatorio"}
                                    />
                                </div>
                                <div style={colSpan(6)}>
                                    <HybridSelect
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
                                </div>
                                <div style={colSpan(3)}>
                                    <div style={{ marginBottom: 4 }}><FieldLabel label="Sigla" help="Sigla identificadora que forma parte del código de barra del equipo (ej: MULTI, PH, TERM)." /></div>
                                    <Input
                                        placeholder="Ej: PH"
                                        value={formData.sigla}
                                        onChange={(e) => setFormData((p: any) => ({ ...p, sigla: e.target.value }))}
                                        suffix={generatingCode ? <Spin size="small" /> : undefined}
                                    />
                                </div>
                                <div style={colSpan(3)}>
                                    <div style={{ marginBottom: 4 }}><FieldLabel label="Correlativo" help="Número correlativo único de la unidad del equipo para diferenciarlo de otros del mismo tipo y sede." /></div>
                                    <InputNumber
                                        value={formData.correlativo}
                                        onChange={(val) => setFormData((p: any) => ({ ...p, correlativo: val }))}
                                        disabled={!isSuper}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                {initialData?.id_equipo ? (
                                    <>
                                        <div style={colSpan(4)}>
                                            <div style={{ marginBottom: 4 }}><FieldLabel label="Código Final *" help="Código único de barra generado de forma automática para la identificación del equipo en terreno." /></div>
                                            <Input
                                                value={formData.codigo}
                                                readOnly={!isSuper}
                                                style={{ fontWeight: 700 }}
                                                status={attemptedSubmit && !formData.codigo ? 'error' : undefined}
                                            />
                                            {formData.previousCode && <Text type="secondary" style={{ fontSize: 12 }}>Anterior: {formData.previousCode}</Text>}
                                            {attemptedSubmit && !formData.codigo && <Text type="danger" style={{ fontSize: 12 }}>Obligatorio</Text>}
                                        </div>
                                        <div style={colSpan(4)}>
                                            <div style={{ marginBottom: 4 }}><FieldLabel label="Última Revisión" help="Fecha de la última revisión registrada de este equipo." /></div>
                                            <Input
                                                value={formatDateToSpanish(originalUltimaVerificacion)}
                                                readOnly
                                                disabled
                                            />
                                        </div>
                                        <div style={colSpan(4)}>
                                            <div style={{ marginBottom: 4 }}><FieldLabel label="Revisión Actual" help="Presione para registrar la nueva revisión técnica con fecha de hoy." /></div>
                                            <Input
                                                placeholder="Presione para registrar hoy"
                                                value={formData.ultima_verificacion === originalUltimaVerificacion ? '' : formatDateToSpanish(formData.ultima_verificacion)}
                                                onClick={() => setShowRevisionConfirm(true)}
                                                style={{ cursor: 'pointer' }}
                                                readOnly
                                                suffix={
                                                    formData.ultima_verificacion !== originalUltimaVerificacion && (
                                                        <Button
                                                            type="text"
                                                            size="small"
                                                            icon={<IconX size={16} />}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleResetRevision();
                                                            }}
                                                        />
                                                    )
                                                }
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div style={colSpan(8)}>
                                            <div style={{ marginBottom: 4 }}><FieldLabel label="Código Final *" help="Código único de barra generado de forma automática para la identificación del equipo en terreno." /></div>
                                            <Input
                                                value={formData.codigo}
                                                readOnly={!isSuper}
                                                style={{ fontWeight: 700 }}
                                                status={attemptedSubmit && !formData.codigo ? 'error' : undefined}
                                            />
                                            {formData.previousCode && <Text type="secondary" style={{ fontSize: 12 }}>Anterior: {formData.previousCode}</Text>}
                                            {attemptedSubmit && !formData.codigo && <Text type="danger" style={{ fontSize: 12 }}>Obligatorio</Text>}
                                        </div>
                                        <div style={colSpan(4)}>
                                            <div style={{ marginBottom: 4 }}><FieldLabel label="Fecha Creación *" help="Fecha de creación del registro del equipo en el sistema. Se establece de forma automática con la fecha de hoy." /></div>
                                            <Input
                                                type="date"
                                                value={formData.ultima_verificacion}
                                                readOnly
                                                status={attemptedSubmit && !formData.ultima_verificacion ? 'error' : undefined}
                                            />
                                            {attemptedSubmit && !formData.ultima_verificacion && <Text type="danger" style={{ fontSize: 12 }}>Se requiere una fecha de creación válida</Text>}
                                        </div>
                                    </>
                                )}
                                <div style={colSpan(6)}>
                                    <div style={{ marginBottom: 4 }}><FieldLabel label="Responsable (Muestreador) *" help="Muestreador responsable del cuidado y traslado del equipo en terreno." /></div>
                                    <Select
                                        placeholder="Seleccione..."
                                        options={muestreadores.map(m => ({
                                            value: String(m.id_muestreador),
                                            label: m.habilitado === 'N' || m.habilitado === false
                                                ? `${m.nombre_muestreador} (Inactivo)`
                                                : m.nombre_muestreador
                                        }))}
                                        value={formData.id_muestreador ? String(formData.id_muestreador) : undefined}
                                        onChange={(val) => setFormData((p: any) => ({ ...p, id_muestreador: val ?? null }))}
                                        showSearch
                                        filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                        status={attemptedSubmit && !formData.id_muestreador ? 'error' : undefined}
                                        style={{ width: '100%' }}
                                    />
                                    {attemptedSubmit && !formData.id_muestreador && <Text type="danger" style={{ fontSize: 12 }}>Obligatorio</Text>}
                                </div>
                                <div style={colSpan(6)}>
                                    {/* E-01: mostrar nombre + código para que el usuario pueda elegir, no IDs crudos */}
                                    <div style={{ marginBottom: 4 }}><FieldLabel label="Equipo Asociado" help="Equipo complementario asignado a esta unidad (ej: sonda de repuesto, electrodo asociado)." /></div>
                                    <Select
                                        placeholder={allEquipos.length === 0 ? 'No hay equipos para asociar' : 'Buscar equipo...'}
                                        value={formData.equipo_asociado ? String(formData.equipo_asociado) : undefined}
                                        options={(() => {
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
                                        showSearch
                                        allowClear
                                        filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                        notFoundContent="Sin coincidencias"
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            </div>
                            <Divider>Configuración Técnica</Divider>
                            <div style={gridRowStyle}>
                                <div style={colSpan(4)}>
                                    <HybridSelect
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
                                </div>
                                <div style={colSpan(4)}>
                                    <HybridSelect
                                        label={<FieldLabel label="Unidad de Medida" help="Nombre completo de la unidad de medida utilizada para registrar los datos (ej: Miligramos por Litro, Grados Celsius)." />}
                                        value={formData.unidad_medida_textual}
                                        options={unidadesOptions}
                                        onChange={(val: any) => {
                                            const sig = autoGenerateSigla(val);
                                            setFormData((p: any) => ({ ...p, unidad_medida_textual: val, unidad_medida_sigla: sig || p.unidad_medida_sigla }));
                                        }}
                                    />
                                </div>
                                <div style={colSpan(4)}>
                                    <div style={{ marginBottom: 4 }}><FieldLabel label="Sigla Unidad" help="Abreviación técnica de la unidad de medida (ej: mg/L, °C, µS/cm)." /></div>
                                    <Input
                                        value={formData.unidad_medida_sigla}
                                        onChange={(e) => setFormData((p: any) => ({ ...p, unidad_medida_sigla: e.target.value }))}
                                        placeholder="mg/L, %"
                                    />
                                </div>
                                <div style={{ gridColumn: 'span 12' }}>
                                    <div style={{ display: 'flex', gap: 24, padding: 16, backgroundColor: 'var(--app-hover-bg)', flexWrap: 'wrap' }}>
                                        <Checkbox
                                            checked={formData.tiene_fc === 'SI'}
                                            onChange={(e) => setFormData((p: any) => ({ ...p, tiene_fc: e.target.checked ? 'SI' : 'NO' }))}
                                        >
                                            <FieldLabel label="Tiene Factor de Corrección" help="Indica si se debe aplicar una constante de corrección a los valores medidos por el equipo." />
                                        </Checkbox>
                                        <Checkbox
                                            checked={formData.visible_muestreador === 'SI'}
                                            onChange={(e) => setFormData((p: any) => ({ ...p, visible_muestreador: e.target.checked ? 'SI' : 'NO' }))}
                                        >
                                            <FieldLabel label="Visible para Muestreadores" help="Determina si el equipo estará visible y seleccionable para los muestreadores en la aplicación móvil." />
                                        </Checkbox>
                                        <Checkbox
                                            checked={formData.informe === 'SI'}
                                            onChange={(e) => setFormData((p: any) => ({ ...p, informe: e.target.checked ? 'SI' : 'NO' }))}
                                        >
                                            <FieldLabel label="Incluir en Informe" help="Indica si el equipo y sus mediciones asociadas deben ser impresos en el informe final de resultados." />
                                        </Checkbox>
                                    </div>
                                </div>
                                <div style={colSpan(4)}>
                                    <div style={{ marginBottom: 4 }}><FieldLabel label="Error 0" help="Desviación o error detectado en la medición del punto de calibración cero." /></div>
                                    <InputNumber value={formData.error0} onChange={(v) => setFormData((p: any) => ({ ...p, error0: v }))} step={0.01} style={{ width: '100%' }} />
                                </div>
                                <div style={colSpan(4)}>
                                    <div style={{ marginBottom: 4 }}><FieldLabel label="Error 15" help="Desviación o error detectado en la medición del punto de calibración intermedio (ej: 15°C o patrón intermedio)." /></div>
                                    <InputNumber value={formData.error15} onChange={(v) => setFormData((p: any) => ({ ...p, error15: v }))} step={0.01} style={{ width: '100%' }} />
                                </div>
                                <div style={colSpan(4)}>
                                    <div style={{ marginBottom: 4 }}><FieldLabel label="Error 30" help="Desviación o error detectado en la medición del punto de calibración alto (ej: 30°C o patrón alto)." /></div>
                                    <InputNumber value={formData.error30} onChange={(v) => setFormData((p: any) => ({ ...p, error30: v }))} step={0.01} style={{ width: '100%' }} />
                                </div>
                                <div style={{ gridColumn: 'span 12' }}>
                                    <div style={{ marginBottom: 4 }}><FieldLabel label="Observación *" help="Comentarios adicionales, historial de fallas, reparaciones o detalles relevantes del equipo." /></div>
                                    <TextArea
                                        placeholder="Detalles sobre el equipo..."
                                        value={formData.observacion || ''}
                                        onChange={(e) => setFormData((p: any) => ({ ...p, observacion: e.target.value }))}
                                        rows={3}
                                        status={attemptedSubmit && !formData.observacion ? 'error' : undefined}
                                    />
                                    {attemptedSubmit && !formData.observacion && <Text type="danger" style={{ fontSize: 12 }}>Obligatorio</Text>}
                                </div>
                            </div>
                            <Divider>Verificación y Estado</Divider>
                            <div style={gridRowStyle}>
                                <div style={colSpan(6)}>
                                    <div style={{ marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                        <FieldLabel label="Siguiente Revisión (Vigente hasta:) *" help="Fecha programada para la próxima revisión técnica (por defecto 90 días después de la última). Corresponde también a la fecha de vigencia." />
                                        <span style={{ fontSize: 12, color: '#868e96', fontWeight: 400 }}>
                                            (Auto: Última + 90 días)
                                        </span>
                                    </div>
                                    <Input
                                        type="date"
                                        value={formData.siguiente_verificacion}
                                        readOnly
                                        status={attemptedSubmit && !formData.siguiente_verificacion ? 'error' : undefined}
                                    />
                                    {attemptedSubmit && !formData.siguiente_verificacion && <Text type="danger" style={{ fontSize: 12 }}>Obligatorio</Text>}
                                </div>
                                <div style={colSpan(6)}>
                                    <div style={{ marginBottom: 4 }}><FieldLabel label="Estado del Equipo" help="Estado operativo actual del equipo (ej: Operativo, En Mantención, En Calibración, Fuera de Servicio)." /></div>
                                    <Select
                                        placeholder="Seleccione..."
                                        options={(estadoEquipoOptions.length > 0 ? estadoEquipoOptions : [
                                            'Operativo',
                                            'Dado de Baja',
                                            'En Mantención',
                                            'En Calibración',
                                            'Fuera de Servicio',
                                        ]).map(o => ({ value: o, label: o }))}
                                        value={formData.estado_equipo || undefined}
                                        onChange={(val) => setFormData((p: any) => ({ ...p, estado_equipo: val || '' }))}
                                        allowClear
                                        style={{ width: '100%' }}
                                    />
                                </div>
                                <div style={{ gridColumn: 'span 12' }}>
                                    <div style={{ marginBottom: 4 }}>
                                        <FieldLabel
                                            label={
                                                <>
                                                    Plazo Vigencia{" "}
                                                    <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--app-text-secondary)' }}>
                                                        (observación)
                                                    </span>
                                                </>
                                            }
                                            help="Comentarios o aclaraciones sobre el plazo de vigencia de la calibración del equipo (ej: Hasta el día 30 del mes...)."
                                        />
                                    </div>
                                    <TextArea
                                        placeholder="Ej: Hasta el día 30 del mes..."
                                        value={formData.plazo_vigencia || ''}
                                        onChange={(e) => setFormData((p: any) => ({ ...p, plazo_vigencia: e.target.value }))}
                                        autoSize={{ minRows: 2 }}
                                    />
                                </div>
                            </div>

                            {!initialData?.id_equipo && (
                                <Card size="small" style={{ backgroundColor: '#e7f3ff' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                                        <div>
                                            <Text strong style={{ color: '#1864ab' }}>Creación Masiva</Text>
                                            <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>¿Deseas crear múltiples unidades de este modelo?</Text>
                                        </div>
                                        <div>
                                            <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Cantidad</Text>
                                            <InputNumber
                                                value={bulkQuantity}
                                                onChange={(val) => setBulkQuantity(Number(val) || 1)}
                                                min={1} max={50}
                                                style={{ width: 80 }}
                                            />
                                        </div>
                                    </div>
                                </Card>
                            )}
                        </div>
                    )}
                    {activeStep === 1 && !initialData?.id_equipo && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
                            <Alert type="info" showIcon icon={<IconInfoCircle size={18} />} message={
                                `Se generarán ${bulkQuantity} equipos basados en la plantilla. Puedes ajustar los códigos y sedes individualmente antes de confirmar.`
                            } />
                            <Card size="small" styles={{ body: { padding: 0 } }}>
                                <div style={{ overflowY: 'auto', maxHeight: 400 }}>
                                    <Table
                                        size="small"
                                        columns={bulkColumns}
                                        dataSource={bulkItems}
                                        rowKey="id_temp"
                                        pagination={false}
                                    />
                                </div>
                            </Card>
                        </div>
                    )}

                    <Divider style={{ marginTop: 24 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        {activeStep === 1 ? (
                            <Button icon={<IconChevronLeft size={18} />} onClick={() => setActiveStep(0)}>
                                Volver al Formulario
                            </Button>
                        ) : <div />}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Button onClick={onCancel}>Cancelar</Button>
                            {initialData?.requestId && (!initialData.id_equipo) && (
                                <Button
                                    danger
                                    onClick={() => setRejectingSolicitud({ id_solicitud: initialData.requestId, tipo_solicitud: 'ALTA', datos_json: initialData })}
                                >
                                    Rechazar Solicitud
                                </Button>
                            )}
                            <Tooltip
                                title={!isFormValid ? `Campos obligatorios faltantes: ${missingFields.join(', ')}` : (initialData?.id_equipo ? 'Actualizar equipo' : 'Guardar equipo')}
                                open={isFormValid && (initialData?.id_equipo ? canEditEquipo : canCreateEquipo) ? false : undefined}
                            >
                                <span style={{ display: 'inline-block' }}>
                                    <Button
                                        type="primary"
                                        disabled={!isFormValid || !(initialData?.id_equipo ? canEditEquipo : canCreateEquipo)}
                                        onClick={handleNext}
                                        icon={activeStep === 0 && !initialData?.id_equipo ? undefined : <IconDeviceFloppy size={18} />}
                                    >
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                            {initialData?.id_equipo ? 'Actualizar' : (activeStep === 0 ? 'Siguiente' : 'Guardar Todo')}
                                            {activeStep === 0 && !initialData?.id_equipo && <IconChevronRight size={18} />}
                                        </span>
                                    </Button>
                                </span>
                            </Tooltip>
                        </div>
                    </div>
                </div>
            </Card>

            {/* --- Modals --- */}
            <Modal open={showSaveConfirm} onCancel={() => setShowSaveConfirm(false)} title="Confirmar Guardado" centered footer={null} width={420}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '16px 0' }}>
                    <IconDeviceFloppy size={48} color="#1c7ed6" />
                    <Text style={{ textAlign: 'center' }}>¿Deseas confirmar los cambios realizados en el sistema?</Text>
                    <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 16 }}>
                        <Button style={{ flex: 1 }} onClick={() => setShowSaveConfirm(false)}>No, revisar</Button>
                        <Button style={{ flex: 1 }} type="primary" onClick={handleSave}>Sí, confirmar</Button>
                    </div>
                </div>
            </Modal>

            <Modal
                open={showRevisionConfirm}
                onCancel={() => setShowRevisionConfirm(false)}
                title="Registrar Revisión"
                centered
                footer={null}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Text style={{ fontSize: 13 }}>
                        Se registrará la revisión técnica del equipo con la fecha de hoy:
                    </Text>
                    <Card size="small" style={{ backgroundColor: 'var(--app-hover-bg)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div style={{ gridColumn: 'span 2' }}>
                                <Text style={{ fontSize: 11, textTransform: 'uppercase' }} type="secondary">Fecha de Revisión</Text>
                                <Text strong style={{ color: '#1c7ed6', fontSize: 15, display: 'block' }}>
                                    {formatDateToSpanish(getTodayString())}
                                </Text>
                            </div>
                            <div>
                                <Text style={{ fontSize: 11, textTransform: 'uppercase' }} type="secondary">Próxima Verificación</Text>
                                <Text strong style={{ color: '#0c8599', fontSize: 15, display: 'block' }}>
                                    {formatDateToSpanish(calculateNext90Days(getTodayString()))}
                                </Text>
                            </div>
                            <div>
                                <Text style={{ fontSize: 11, textTransform: 'uppercase' }} type="secondary">Vigencia Hasta</Text>
                                <Text strong style={{ color: '#2f9e44', fontSize: 15, display: 'block' }}>
                                    {formatDateToSpanish(calculateNext90Days(getTodayString()))}
                                </Text>
                            </div>
                        </div>
                    </Card>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        * Al confirmar, se actualizará el estado temporal del equipo. Los cambios se guardarán definitivamente al presionar el botón "Actualizar" del formulario.
                    </Text>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <Button style={{ flex: 1 }} onClick={() => setShowRevisionConfirm(false)}>
                            Cancelar
                        </Button>
                        <Button
                            style={{ flex: 1 }}
                            type="primary"
                            onClick={() => {
                                handleSetToday();
                                setShowRevisionConfirm(false);
                            }}
                        >
                            Confirmar y Registrar
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal open={!!rejectingSolicitud} onCancel={() => setRejectingSolicitud(null)} title="Motivo de Rechazo" centered footer={null}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>Explica brevemente por qué se rechaza esta solicitud.</Text>
                    <div>
                        <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Observaciones *</Text>
                        <TextArea
                            rows={4}
                            value={adminFeedback}
                            onChange={(e) => setAdminFeedback(e.currentTarget.value)}
                            placeholder="Ej: Información insuficiente..."
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <Button style={{ flex: 1 }} onClick={() => setRejectingSolicitud(null)}>Cancelar</Button>
                        <Button style={{ flex: 1 }} danger type="primary" onClick={handleRejectIndividual} disabled={!adminFeedback.trim()}>Confirmar Rechazo</Button>
                    </div>
                </div>
            </Modal>

            <Modal open={editingObsIdx !== null} onCancel={() => setEditingObsIdx(null)} title={`Editar Observación - Item #${(editingObsIdx || 0) + 1}`} width={600} footer={null}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <TextArea
                        rows={8}
                        value={editingObsText}
                        onChange={(e) => setEditingObsText(e.currentTarget.value)}
                        autoFocus
                    />
                    <Button type="primary" onClick={() => {
                        const n = [...bulkItems];
                        n[editingObsIdx!].observacion = editingObsText;
                        setBulkItems(n);
                        setEditingObsIdx(null);
                    }}>Guardar Observación</Button>
                </div>
            </Modal>

            <Modal
                open={compareVersion !== null}
                onCancel={() => setCompareVersion(null)}
                title={
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <IconHistory size={20} color="#1c7ed6" />
                        <Text strong>Comparación con Versión del Historial</Text>
                    </div>
                }
                centered
                width={800}
                footer={null}
            >
                {compareVersion && (() => {
                    const diffs = getVersionDiff(compareVersion);
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <Text type="secondary" style={{ fontSize: 13 }}>
                                Mostrando las diferencias entre el registro histórico (<strong>{compareVersion.version}</strong>, modificado por <strong>{compareVersion.nombre_usuario_cambio || 'Sistema'}</strong> el {new Date(compareVersion.fecha_cambio).toLocaleString()}) y el estado actual del formulario.
                            </Text>

                            {diffs.length === 0 ? (
                                <Alert type="info" showIcon icon={<IconInfoCircle size={16} />} message="Sin diferencias" description="Los datos de la versión del historial seleccionada coinciden exactamente con los datos actuales en el formulario." />
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: 'var(--app-hover-bg)' }}>
                                                <th style={{ textAlign: 'left', padding: 8, border: '1px solid var(--app-border)' }}>Campo</th>
                                                <th style={{ textAlign: 'left', padding: 8, border: '1px solid var(--app-border)' }}>Versión Histórica ({compareVersion.version})</th>
                                                <th style={{ textAlign: 'left', padding: 8, border: '1px solid var(--app-border)' }}>Valor en Formulario (Actual)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {diffs.map((d, index) => (
                                                <tr key={index}>
                                                    <td style={{ padding: 8, border: '1px solid var(--app-border)', fontWeight: 500 }}>{d.campo}</td>
                                                    <td style={{ padding: 8, border: '1px solid var(--app-border)', color: '#c92a2a', backgroundColor: '#fff5f5' }}>
                                                        {d.oldValue}
                                                    </td>
                                                    <td style={{ padding: 8, border: '1px solid var(--app-border)', color: '#2b8a3e', backgroundColor: '#ebfbee' }}>
                                                        {d.newValue}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                                <Button onClick={() => setCompareVersion(null)}>
                                    Cerrar
                                </Button>
                                <Button
                                    type="primary"
                                    onClick={() => {
                                        handleRestore(compareVersion);
                                        setCompareVersion(null);
                                    }}
                                >
                                    Restaurar esta Versión
                                </Button>
                            </div>
                        </div>
                    );
                })()}
            </Modal>

            {/* Floating button for requests */}
            {initialData?.id_equipo && pendingRequests && pendingRequests.length > 0 && (
                <div style={{ position: 'fixed', bottom: 40, right: 40, zIndex: 100 }}>
                    <Badge count={pendingRequests.length} color="red">
                        <Tooltip title="Ver Solicitudes Pendientes" placement="left">
                            <Button
                                shape="circle"
                                type="primary"
                                style={{ width: 56, height: 56, backgroundColor: '#e8590c', borderColor: '#e8590c', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                                icon={<IconAlertTriangle size={28} />}
                                onClick={() => setShowRequestsModal(true)}
                            />
                        </Tooltip>
                    </Badge>
                </div>
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
        </div>
    );
};
