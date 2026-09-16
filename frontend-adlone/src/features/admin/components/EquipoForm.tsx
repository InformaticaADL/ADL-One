import React, { useState, useEffect, useMemo, useId } from 'react';
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

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { equipoService, type Equipo, type EquipoHistorial } from '../services/equipo.service';
import { adminService } from '../../../services/admin.service';
import { catalogosService } from '../../medio-ambiente/services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { useNavStore } from '../../../store/navStore';
import { useAuth } from '../../../contexts/AuthContext';
import { EquipmentRequestsModal } from './EquipmentRequestsModal';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { FieldLabel } from '../../../components/common/FieldHelp';

// Local HybridSelect replacement using shadcn components.
// If strict=true, it uses Combobox (must be in list).
// If strict=false, it uses an Input + datalist (can type any value, with suggestions).
const HybridSelect: React.FC<{
    label?: React.ReactNode;
    value: any;
    options: any[];
    onChange: (val: string | null) => void;
    placeholder?: string;
    strict?: boolean;
    required?: boolean;
    disabled?: boolean;
    error?: string | false;
}> = ({ label, value, options, onChange, placeholder, strict, required, disabled, error }) => {
    const data = Array.from(new Set(options.map((o: any) => typeof o === 'string' ? o : (o.label || o.value)))) as string[];
    const comboOptions = data.map((d) => ({ value: d, label: d }));
    const datalistId = useId();

    return (
        <div>
            {label && (
                <div className="mb-1">
                    {typeof label === 'string' ? <span className="text-sm">{label}{required && ' *'}</span> : label}
                </div>
            )}
            {strict ? (
                <Combobox
                    placeholder={placeholder}
                    options={comboOptions}
                    value={value ?? undefined}
                    onValueChange={(v) => onChange(v || null)}
                    disabled={disabled}
                    emptyText="No se encontró"
                    className={cn(error && 'border-destructive')}
                />
            ) : (
                <>
                    <Input
                        list={datalistId}
                        placeholder={placeholder}
                        value={value ?? ''}
                        onChange={(e) => onChange(e.target.value || null)}
                        disabled={disabled}
                        className={cn(error && 'border-destructive')}
                    />
                    <datalist id={datalistId}>
                        {data.map((d) => <option key={d} value={d} />)}
                    </datalist>
                </>
            )}
            {error && <p className="mt-0.5 text-xs text-destructive">{error}</p>}
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

// Grid helper: 12-col layout that collapses to full-width on mobile.
const colSpanClass = (md: number): string => {
    switch (md) {
        case 3: return 'col-span-12 md:col-span-3';
        case 4: return 'col-span-12 md:col-span-4';
        case 6: return 'col-span-12 md:col-span-6';
        case 8: return 'col-span-12 md:col-span-8';
        default: return 'col-span-12';
    }
};

const SectionDivider: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
    <div className="my-2 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        {children && <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>}
        <div className="h-px flex-1 bg-border" />
    </div>
);

const NO_ESTADO_EQUIPO = '__NONE__';

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

    // --- Renders ---
    return (
        <div className="shadcn-scope relative w-full p-4">
            {(loading || processingAction) && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            )}

            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-col gap-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className={cn('flex flex-col', !isMobile && 'flex-1')}>
                            <h2 className="m-0 text-xl font-semibold text-foreground">
                                {requestedChanges?.isReactivation ? 'Activación de Equipo' : (initialData?.id_equipo ? 'Editar Equipo' : 'Nuevo Equipo')}
                            </h2>
                            <span className="text-xs text-muted-foreground">
                                {initialData?.id_equipo ? `Modificando equipo: ${formData.codigo}` : 'Completa los datos para dar de alta nuevos equipos en el sistema.'}
                            </span>
                        </div>

                        <div className={cn('flex flex-wrap gap-2', isMobile && 'w-full')}>
                            <Button variant="outline" onClick={onCancel} className={cn(isMobile && 'flex-1')}>
                                <IconArrowLeft size={18} /> Volver
                            </Button>
                            <ProtectedContent permission="EQ_HISTORY">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowHistory(!showHistory)}
                                    className={cn(isMobile && 'flex-1')}
                                >
                                    <IconHistory size={18} /> {isMobile ? 'Historial' : (showHistory ? 'Ocultar Historial' : 'Ver Historial')}
                                </Button>
                            </ProtectedContent>
                            {!initialData?.id_equipo && (
                                <ProtectedContent permission="EQ_UPDATE">
                                    <Button
                                        onClick={handleSave}
                                        disabled={loading}
                                        className={cn(isMobile && 'flex-1')}
                                    >
                                        {loading ? (
                                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        ) : (
                                            <IconDeviceFloppy size={18} />
                                        )}
                                        Crear
                                    </Button>
                                </ProtectedContent>
                            )}
                        </div>
                    </div>

                    {initialData && formData.version && (
                        <div>
                            <Badge variant="outline" className="border-primary/40 bg-primary/10 px-2.5 py-1 text-[13px] text-primary">
                                Versión Activa: {formData.version}
                            </Badge>
                        </div>
                    )}

                    {warningsAlert && (
                        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3.5">
                            <IconAlertTriangle size={20} className="mt-0.5 shrink-0 text-warning" />
                            <div className="flex flex-col gap-1">
                                <span className="text-sm font-semibold text-foreground">{warningsAlert.title}</span>
                                {warningsAlert.messages.map((msg, idx) => (
                                    <span key={idx} className="text-[13px] text-foreground">{msg}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Requested Changes (Traspaso/Alta Suggestion) */}
                    {!!(initialData?.requestId && requestedChanges) && (
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                            <div className="mb-3 flex items-center gap-2">
                                <IconInfoCircle size={20} className="text-primary" />
                                <span className="text-sm font-semibold text-foreground">Cambios sugeridos por Medio Ambiente</span>
                            </div>
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2">
                                {requestedChanges.nueva_ubicacion && (
                                    <div className="rounded-lg border border-border bg-card p-2">
                                        <p className="text-[11px] uppercase text-muted-foreground">Ubicación</p>
                                        <p className="text-[13px] font-semibold text-primary">{requestedChanges.nueva_ubicacion}</p>
                                    </div>
                                )}
                                {requestedChanges.nuevo_responsable_id && (
                                    <div className="rounded-lg border border-border bg-card p-2">
                                        <p className="text-[11px] uppercase text-muted-foreground">Responsable</p>
                                        <p className="text-[13px] font-semibold text-primary">{muestreadores.find(m => m.id_muestreador === requestedChanges.nuevo_responsable_id)?.nombre_muestreador || '---'}</p>
                                    </div>
                                )}
                                {requestedChanges.vigencia && (
                                    <div className="rounded-lg border border-border bg-card p-2">
                                        <p className="text-[11px] uppercase text-muted-foreground">Vigencia</p>
                                        <p className="text-[13px] font-semibold text-primary">{requestedChanges.vigencia}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* History Section */}
                    {showHistory && (
                        <div className="rounded-lg border border-border bg-muted/40 p-4">
                            <div className="mb-4 flex items-center gap-2">
                                <IconHistory size={20} />
                                <span className="text-sm font-semibold text-foreground">Historial de Versiones</span>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto">
                                {loadingHistory ? (
                                    <div className="flex justify-center py-6">
                                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead>Versión</TableHead>
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>Usuario</TableHead>
                                                <TableHead>Código</TableHead>
                                                <TableHead>Acción</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {history.length === 0 ? (
                                                <TableRow className="hover:bg-transparent">
                                                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Sin versiones previas.</TableCell>
                                                </TableRow>
                                            ) : (
                                                history.map((h: any) => (
                                                    <TableRow key={h.id_historial} className={cn(lastRestoredVersion?.previous === h.version && 'bg-warning/10')}>
                                                        <TableCell className="font-semibold text-foreground">{h.version}</TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">{new Date(h.fecha_cambio).toLocaleString()}</TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">{h.nombre_usuario_cambio || 'Sistema'}</TableCell>
                                                        <TableCell className="text-sm text-foreground">{h.codigo}</TableCell>
                                                        <TableCell>
                                                            <div className="flex gap-2">
                                                                <Button variant="outline" size="sm" onClick={() => setCompareVersion(h)}>Comparar</Button>
                                                                <Button size="sm" onClick={() => handleRestore(h)}>Habilitar</Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step indicator */}
                    {!initialData?.id_equipo ? (
                        <div className="flex items-center gap-2">
                            {[
                                { idx: 0, title: 'Información General', desc: 'Datos del equipo' },
                                { idx: 1, title: 'Revisión Masiva', desc: 'Confirmar seriales' },
                            ].map((step, i) => (
                                <React.Fragment key={step.idx}>
                                    <button
                                        type="button"
                                        onClick={() => setActiveStep(step.idx)}
                                        className="flex items-center gap-2 rounded-md px-1 py-1 text-left"
                                    >
                                        <span className={cn(
                                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
                                            activeStep === step.idx ? 'border-primary bg-primary text-primary-foreground'
                                                : activeStep > step.idx ? 'border-primary text-primary' : 'border-border text-muted-foreground'
                                        )}>
                                            {step.idx + 1}
                                        </span>
                                        <span className="flex flex-col">
                                            <span className={cn('text-sm font-medium', activeStep === step.idx ? 'text-foreground' : 'text-muted-foreground')}>{step.title}</span>
                                            <span className="text-xs text-muted-foreground">{step.desc}</span>
                                        </span>
                                    </button>
                                    {i === 0 && <div className="h-px flex-1 bg-border" />}
                                </React.Fragment>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary bg-primary text-xs font-medium text-primary-foreground">1</span>
                            <span className="flex flex-col">
                                <span className="text-sm font-medium text-foreground">Información General</span>
                                <span className="text-xs text-muted-foreground">Datos del equipo</span>
                            </span>
                        </div>
                    )}

                    {activeStep === 0 && (
                        <div className="mt-2 flex flex-col gap-6">
                            <div className="grid grid-cols-12 gap-4">
                                <div className={colSpanClass(4)}>
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
                                <div className={colSpanClass(4)}>
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
                                <div className={colSpanClass(4)}>
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
                                <div className={colSpanClass(6)}>
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
                                <div className={colSpanClass(3)}>
                                    <div className="mb-1"><FieldLabel label="Sigla" help="Sigla identificadora que forma parte del código de barra del equipo (ej: MULTI, PH, TERM)." /></div>
                                    <div className="relative">
                                        <Input
                                            placeholder="Ej: PH"
                                            value={formData.sigla}
                                            onChange={(e) => setFormData((p: any) => ({ ...p, sigla: e.target.value }))}
                                            className={cn(generatingCode && 'pr-8')}
                                        />
                                        {generatingCode && (
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                                <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className={colSpanClass(3)}>
                                    <div className="mb-1"><FieldLabel label="Correlativo" help="Número correlativo único de la unidad del equipo para diferenciarlo de otros del mismo tipo y sede." /></div>
                                    <Input
                                        type="number"
                                        value={formData.correlativo}
                                        onChange={(e) => setFormData((p: any) => ({ ...p, correlativo: e.target.value === '' ? null : Number(e.target.value) }))}
                                        disabled={!isSuper}
                                    />
                                </div>
                                {initialData?.id_equipo ? (
                                    <>
                                        <div className={colSpanClass(4)}>
                                            <div className="mb-1"><FieldLabel label="Código Final *" help="Código único de barra generado de forma automática para la identificación del equipo en terreno." /></div>
                                            <Input
                                                value={formData.codigo}
                                                readOnly={!isSuper}
                                                className={cn('font-bold', attemptedSubmit && !formData.codigo && 'border-destructive')}
                                            />
                                            {formData.previousCode && <span className="text-xs text-muted-foreground">Anterior: {formData.previousCode}</span>}
                                            {attemptedSubmit && !formData.codigo && <p className="text-xs text-destructive">Obligatorio</p>}
                                        </div>
                                        <div className={colSpanClass(4)}>
                                            <div className="mb-1"><FieldLabel label="Última Revisión" help="Fecha de la última revisión registrada de este equipo." /></div>
                                            <Input
                                                value={formatDateToSpanish(originalUltimaVerificacion)}
                                                readOnly
                                                disabled
                                            />
                                        </div>
                                        <div className={colSpanClass(4)}>
                                            <div className="mb-1"><FieldLabel label="Revisión Actual" help="Presione para registrar la nueva revisión técnica con fecha de hoy." /></div>
                                            <div className="relative">
                                                <Input
                                                    placeholder="Presione para registrar hoy"
                                                    value={formData.ultima_verificacion === originalUltimaVerificacion ? '' : formatDateToSpanish(formData.ultima_verificacion)}
                                                    onClick={() => setShowRevisionConfirm(true)}
                                                    className="cursor-pointer pr-8"
                                                    readOnly
                                                />
                                                {formData.ultima_verificacion !== originalUltimaVerificacion && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2"
                                                        title="Restablecer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleResetRevision();
                                                        }}
                                                    >
                                                        <IconX size={16} />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className={colSpanClass(8)}>
                                            <div className="mb-1"><FieldLabel label="Código Final *" help="Código único de barra generado de forma automática para la identificación del equipo en terreno." /></div>
                                            <Input
                                                value={formData.codigo}
                                                readOnly={!isSuper}
                                                className={cn('font-bold', attemptedSubmit && !formData.codigo && 'border-destructive')}
                                            />
                                            {formData.previousCode && <span className="text-xs text-muted-foreground">Anterior: {formData.previousCode}</span>}
                                            {attemptedSubmit && !formData.codigo && <p className="text-xs text-destructive">Obligatorio</p>}
                                        </div>
                                        <div className={colSpanClass(4)}>
                                            <div className="mb-1"><FieldLabel label="Fecha Creación *" help="Fecha de creación del registro del equipo en el sistema. Se establece de forma automática con la fecha de hoy." /></div>
                                            <Input
                                                type="date"
                                                value={formData.ultima_verificacion}
                                                readOnly
                                                className={cn(attemptedSubmit && !formData.ultima_verificacion && 'border-destructive')}
                                            />
                                            {attemptedSubmit && !formData.ultima_verificacion && <p className="text-xs text-destructive">Se requiere una fecha de creación válida</p>}
                                        </div>
                                    </>
                                )}
                                <div className={colSpanClass(6)}>
                                    <div className="mb-1"><FieldLabel label="Responsable (Muestreador) *" help="Muestreador responsable del cuidado y traslado del equipo en terreno." /></div>
                                    <Combobox
                                        placeholder="Seleccione..."
                                        options={muestreadores.map(m => ({
                                            value: String(m.id_muestreador),
                                            label: m.habilitado === 'N' || m.habilitado === false
                                                ? `${m.nombre_muestreador} (Inactivo)`
                                                : m.nombre_muestreador
                                        }))}
                                        value={formData.id_muestreador ? String(formData.id_muestreador) : undefined}
                                        onValueChange={(val) => setFormData((p: any) => ({ ...p, id_muestreador: val ?? null }))}
                                        className={cn(attemptedSubmit && !formData.id_muestreador && 'border-destructive')}
                                    />
                                    {attemptedSubmit && !formData.id_muestreador && <p className="text-xs text-destructive">Obligatorio</p>}
                                </div>
                                <div className={colSpanClass(6)}>
                                    {/* E-01: mostrar nombre + código para que el usuario pueda elegir, no IDs crudos */}
                                    <div className="mb-1"><FieldLabel label="Equipo Asociado" help="Equipo complementario asignado a esta unidad (ej: sonda de repuesto, electrodo asociado)." /></div>
                                    <Combobox
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
                                        onValueChange={(val) => setFormData((p: any) => ({ ...p, equipo_asociado: val || 'No Aplica' }))}
                                        emptyText="Sin coincidencias"
                                    />
                                </div>
                            </div>
                            <SectionDivider>Configuración Técnica</SectionDivider>
                            <div className="grid grid-cols-12 gap-4">
                                <div className={colSpanClass(4)}>
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
                                <div className={colSpanClass(4)}>
                                    <HybridSelect
                                        label={<FieldLabel label="Unidad de Medida" help="Nombre completo de la unidad de medida utilizada para registrar los datos (ej: Miligramos por Litro, Grados Celsius)." />}
                                        value={formData.unidad_medida_textual}
                                        options={unidadesOptions}
                                        onChange={(val: any) => {
                                            const sig = autoGenerateSigla(val || '');
                                            setFormData((p: any) => ({ ...p, unidad_medida_textual: val, unidad_medida_sigla: sig || p.unidad_medida_sigla }));
                                        }}
                                    />
                                </div>
                                <div className={colSpanClass(4)}>
                                    <div className="mb-1"><FieldLabel label="Sigla Unidad" help="Abreviación técnica de la unidad de medida (ej: mg/L, °C, µS/cm)." /></div>
                                    <Input
                                        value={formData.unidad_medida_sigla}
                                        onChange={(e) => setFormData((p: any) => ({ ...p, unidad_medida_sigla: e.target.value }))}
                                        placeholder="mg/L, %"
                                    />
                                </div>
                                <div className="col-span-12">
                                    <div className="flex flex-wrap gap-6 rounded-lg bg-muted/40 p-4">
                                        <label className="flex items-center gap-2">
                                            <Checkbox
                                                checked={formData.tiene_fc === 'SI'}
                                                onCheckedChange={(checked) => setFormData((p: any) => ({ ...p, tiene_fc: checked ? 'SI' : 'NO' }))}
                                            />
                                            <FieldLabel label="Tiene Factor de Corrección" help="Indica si se debe aplicar una constante de corrección a los valores medidos por el equipo." />
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <Checkbox
                                                checked={formData.visible_muestreador === 'SI'}
                                                onCheckedChange={(checked) => setFormData((p: any) => ({ ...p, visible_muestreador: checked ? 'SI' : 'NO' }))}
                                            />
                                            <FieldLabel label="Visible para Muestreadores" help="Determina si el equipo estará visible y seleccionable para los muestreadores en la aplicación móvil." />
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <Checkbox
                                                checked={formData.informe === 'SI'}
                                                onCheckedChange={(checked) => setFormData((p: any) => ({ ...p, informe: checked ? 'SI' : 'NO' }))}
                                            />
                                            <FieldLabel label="Incluir en Informe" help="Indica si el equipo y sus mediciones asociadas deben ser impresos en el informe final de resultados." />
                                        </label>
                                    </div>
                                </div>
                                <div className={colSpanClass(4)}>
                                    <div className="mb-1"><FieldLabel label="Error 0" help="Desviación o error detectado en la medición del punto de calibración cero." /></div>
                                    <Input type="number" step="0.01" value={formData.error0} onChange={(e) => setFormData((p: any) => ({ ...p, error0: e.target.value === '' ? null : Number(e.target.value) }))} />
                                </div>
                                <div className={colSpanClass(4)}>
                                    <div className="mb-1"><FieldLabel label="Error 15" help="Desviación o error detectado en la medición del punto de calibración intermedio (ej: 15°C o patrón intermedio)." /></div>
                                    <Input type="number" step="0.01" value={formData.error15} onChange={(e) => setFormData((p: any) => ({ ...p, error15: e.target.value === '' ? null : Number(e.target.value) }))} />
                                </div>
                                <div className={colSpanClass(4)}>
                                    <div className="mb-1"><FieldLabel label="Error 30" help="Desviación o error detectado en la medición del punto de calibración alto (ej: 30°C o patrón alto)." /></div>
                                    <Input type="number" step="0.01" value={formData.error30} onChange={(e) => setFormData((p: any) => ({ ...p, error30: e.target.value === '' ? null : Number(e.target.value) }))} />
                                </div>
                                <div className="col-span-12">
                                    <div className="mb-1"><FieldLabel label="Observación *" help="Comentarios adicionales, historial de fallas, reparaciones o detalles relevantes del equipo." /></div>
                                    <textarea
                                        placeholder="Detalles sobre el equipo..."
                                        value={formData.observacion || ''}
                                        onChange={(e) => setFormData((p: any) => ({ ...p, observacion: e.target.value }))}
                                        rows={3}
                                        className={cn(
                                            'flex min-h-[72px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                                            attemptedSubmit && !formData.observacion && 'border-destructive'
                                        )}
                                    />
                                    {attemptedSubmit && !formData.observacion && <p className="text-xs text-destructive">Obligatorio</p>}
                                </div>
                            </div>
                            <SectionDivider>Verificación y Estado</SectionDivider>
                            <div className="grid grid-cols-12 gap-4">
                                <div className={colSpanClass(6)}>
                                    <div className="mb-1 inline-flex flex-wrap items-center gap-1.5">
                                        <FieldLabel label="Siguiente Revisión (Vigente hasta:) *" help="Fecha programada para la próxima revisión técnica (por defecto 90 días después de la última). Corresponde también a la fecha de vigencia." />
                                        <span className="text-xs font-normal text-muted-foreground">
                                            (Auto: Última + 90 días)
                                        </span>
                                    </div>
                                    <Input
                                        type="date"
                                        value={formData.siguiente_verificacion}
                                        readOnly
                                        className={cn(attemptedSubmit && !formData.siguiente_verificacion && 'border-destructive')}
                                    />
                                    {attemptedSubmit && !formData.siguiente_verificacion && <p className="text-xs text-destructive">Obligatorio</p>}
                                </div>
                                <div className={colSpanClass(6)}>
                                    <div className="mb-1"><FieldLabel label="Estado del Equipo" help="Estado operativo actual del equipo (ej: Operativo, En Mantención, En Calibración, Fuera de Servicio)." /></div>
                                    <Combobox
                                        placeholder="Seleccione..."
                                        options={[
                                            { value: NO_ESTADO_EQUIPO, label: 'Sin especificar' },
                                            ...(estadoEquipoOptions.length > 0 ? estadoEquipoOptions : [
                                                'Operativo',
                                                'Dado de Baja',
                                                'En Mantención',
                                                'En Calibración',
                                                'Fuera de Servicio',
                                            ]).map(o => ({ value: o, label: o }))
                                        ]}
                                        value={formData.estado_equipo || NO_ESTADO_EQUIPO}
                                        onValueChange={(val) => setFormData((p: any) => ({ ...p, estado_equipo: val === NO_ESTADO_EQUIPO ? '' : val }))}
                                    />
                                </div>
                                <div className="col-span-12">
                                    <div className="mb-1">
                                        <FieldLabel
                                            label={
                                                <>
                                                    Plazo Vigencia{" "}
                                                    <span className="text-[11px] font-normal text-muted-foreground">
                                                        (observación)
                                                    </span>
                                                </>
                                            }
                                            help="Comentarios o aclaraciones sobre el plazo de vigencia de la calibración del equipo (ej: Hasta el día 30 del mes...)."
                                        />
                                    </div>
                                    <textarea
                                        placeholder="Ej: Hasta el día 30 del mes..."
                                        value={formData.plazo_vigencia || ''}
                                        onChange={(e) => setFormData((p: any) => ({ ...p, plazo_vigencia: e.target.value }))}
                                        rows={2}
                                        className="flex min-h-[56px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            {!initialData?.id_equipo && (
                                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-primary">Creación Masiva</p>
                                            <p className="text-xs text-muted-foreground">¿Deseas crear múltiples unidades de este modelo?</p>
                                        </div>
                                        <div>
                                            <p className="mb-1 text-xs text-foreground">Cantidad</p>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={50}
                                                value={bulkQuantity}
                                                onChange={(e) => setBulkQuantity(Number(e.target.value) || 1)}
                                                className="w-20"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {activeStep === 1 && !initialData?.id_equipo && (
                        <div className="mt-2 flex flex-col gap-4">
                            <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3.5">
                                <IconInfoCircle size={18} className="mt-0.5 shrink-0 text-primary" />
                                <span className="text-sm text-foreground">
                                    {`Se generarán ${bulkQuantity} equipos basados en la plantilla. Puedes ajustar los códigos y sedes individualmente antes de confirmar.`}
                                </span>
                            </div>
                            <div className="overflow-hidden rounded-lg border border-border">
                                <div className="max-h-[400px] overflow-y-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="w-10">#</TableHead>
                                                <TableHead>Código</TableHead>
                                                <TableHead>Ubicación</TableHead>
                                                <TableHead>Vigencia</TableHead>
                                                <TableHead className="w-16">Obs.</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {bulkItems.map((item, idx) => (
                                                <TableRow key={item.id_temp}>
                                                    <TableCell>{idx + 1}</TableCell>
                                                    <TableCell>
                                                        <Input
                                                            value={item.codigo}
                                                            onChange={(e) => {
                                                                const n = [...bulkItems];
                                                                n[idx].codigo = e.target.value;
                                                                setBulkItems(n);
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Combobox
                                                            options={sedeOptions.map(s => ({ value: s, label: s }))}
                                                            value={item.ubicacion ?? undefined}
                                                            onValueChange={(v) => {
                                                                const n = [...bulkItems];
                                                                n[idx].ubicacion = v;
                                                                const fc = n[idx].correlativo < 10 ? `0${n[idx].correlativo}` : `${n[idx].correlativo}`;
                                                                n[idx].codigo = `${n[idx].sigla}.${fc}/MA.${v}`;
                                                                setBulkItems(n);
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="date"
                                                            value={item.vigencia}
                                                            onChange={(e) => {
                                                                const n = [...bulkItems];
                                                                n[idx].vigencia = e.target.value;
                                                                n[idx].siguiente_verificacion = e.target.value;
                                                                setBulkItems(n);
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            title="Editar observación"
                                                            className={item.observacion ? 'text-primary' : 'text-muted-foreground'}
                                                            onClick={() => { setEditingObsIdx(idx); setEditingObsText(item.observacion || ''); }}
                                                        >
                                                            <IconEdit size={16} />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    )}

                    <SectionDivider />
                    <div className="flex flex-wrap justify-between gap-3">
                        {activeStep === 1 ? (
                            <Button variant="outline" onClick={() => setActiveStep(0)}>
                                <IconChevronLeft size={18} /> Volver al Formulario
                            </Button>
                        ) : <div />}
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={onCancel}>Cancelar</Button>
                            {initialData?.requestId && (!initialData.id_equipo) && (
                                <Button
                                    variant="destructive"
                                    onClick={() => setRejectingSolicitud({ id_solicitud: initialData.requestId, tipo_solicitud: 'ALTA', datos_json: initialData })}
                                >
                                    Rechazar Solicitud
                                </Button>
                            )}
                            <span
                                className="inline-block"
                                title={!isFormValid ? `Campos obligatorios faltantes: ${missingFields.join(', ')}` : (initialData?.id_equipo ? 'Actualizar equipo' : 'Guardar equipo')}
                            >
                                <Button
                                    disabled={!isFormValid || !(initialData?.id_equipo ? canEditEquipo : canCreateEquipo)}
                                    onClick={handleNext}
                                >
                                    {!(activeStep === 0 && !initialData?.id_equipo) && <IconDeviceFloppy size={18} />}
                                    {initialData?.id_equipo ? 'Actualizar' : (activeStep === 0 ? 'Siguiente' : 'Guardar Todo')}
                                    {activeStep === 0 && !initialData?.id_equipo && <IconChevronRight size={18} />}
                                </Button>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Modals --- */}
            <Dialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
                <DialogContent className="max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Confirmar Guardado</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-3 py-2">
                        <IconDeviceFloppy size={48} className="text-primary" />
                        <p className="text-center text-sm text-foreground">¿Deseas confirmar los cambios realizados en el sistema?</p>
                    </div>
                    <DialogFooter className="sm:justify-stretch">
                        <Button variant="outline" className="flex-1" onClick={() => setShowSaveConfirm(false)}>No, revisar</Button>
                        <Button className="flex-1" onClick={handleSave}>Sí, confirmar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showRevisionConfirm} onOpenChange={setShowRevisionConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Registrar Revisión</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                        <p className="text-[13px] text-foreground">
                            Se registrará la revisión técnica del equipo con la fecha de hoy:
                        </p>
                        <div className="rounded-lg border border-border bg-muted/40 p-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <p className="text-[11px] uppercase text-muted-foreground">Fecha de Revisión</p>
                                    <p className="text-[15px] font-semibold text-primary">
                                        {formatDateToSpanish(getTodayString())}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[11px] uppercase text-muted-foreground">Próxima Verificación</p>
                                    <p className="text-[15px] font-semibold text-primary">
                                        {formatDateToSpanish(calculateNext90Days(getTodayString()))}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-[11px] uppercase text-muted-foreground">Vigencia Hasta</p>
                                    <p className="text-[15px] font-semibold text-success">
                                        {formatDateToSpanish(calculateNext90Days(getTodayString()))}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            * Al confirmar, se actualizará el estado temporal del equipo. Los cambios se guardarán definitivamente al presionar el botón "Actualizar" del formulario.
                        </p>
                    </div>
                    <DialogFooter className="sm:justify-stretch">
                        <Button variant="outline" className="flex-1" onClick={() => setShowRevisionConfirm(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className="flex-1"
                            onClick={() => {
                                handleSetToday();
                                setShowRevisionConfirm(false);
                            }}
                        >
                            Confirmar y Registrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!rejectingSolicitud} onOpenChange={(open) => { if (!open) setRejectingSolicitud(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Motivo de Rechazo</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                        <p className="text-[13px] text-muted-foreground">Explica brevemente por qué se rechaza esta solicitud.</p>
                        <div>
                            <p className="mb-1 text-xs text-foreground">Observaciones *</p>
                            <textarea
                                rows={4}
                                value={adminFeedback}
                                onChange={(e) => setAdminFeedback(e.currentTarget.value)}
                                placeholder="Ej: Información insuficiente..."
                                className="flex min-h-[96px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                        </div>
                    </div>
                    <DialogFooter className="sm:justify-stretch">
                        <Button variant="outline" className="flex-1" onClick={() => setRejectingSolicitud(null)}>Cancelar</Button>
                        <Button variant="destructive" className="flex-1" onClick={handleRejectIndividual} disabled={!adminFeedback.trim()}>Confirmar Rechazo</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={editingObsIdx !== null} onOpenChange={(open) => { if (!open) setEditingObsIdx(null); }}>
                <DialogContent className="max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>{`Editar Observación - Item #${(editingObsIdx || 0) + 1}`}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                        <textarea
                            rows={8}
                            value={editingObsText}
                            onChange={(e) => setEditingObsText(e.currentTarget.value)}
                            autoFocus
                            className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                        <Button onClick={() => {
                            const n = [...bulkItems];
                            n[editingObsIdx!].observacion = editingObsText;
                            setBulkItems(n);
                            setEditingObsIdx(null);
                        }}>Guardar Observación</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={compareVersion !== null} onOpenChange={(open) => { if (!open) setCompareVersion(null); }}>
                <DialogContent className="max-h-[85vh] max-w-[800px] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center gap-2">
                            <IconHistory size={20} className="text-primary" />
                            <DialogTitle>Comparación con Versión del Historial</DialogTitle>
                        </div>
                    </DialogHeader>
                    {compareVersion && (() => {
                        const diffs = getVersionDiff(compareVersion);
                        return (
                            <div className="flex flex-col gap-3">
                                <p className="text-[13px] text-muted-foreground">
                                    Mostrando las diferencias entre el registro histórico (<strong>{compareVersion.version}</strong>, modificado por <strong>{compareVersion.nombre_usuario_cambio || 'Sistema'}</strong> el {new Date(compareVersion.fecha_cambio).toLocaleString()}) y el estado actual del formulario.
                                </p>

                                {diffs.length === 0 ? (
                                    <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
                                        <IconInfoCircle size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">Sin diferencias</p>
                                            <p className="text-sm text-muted-foreground">Los datos de la versión del historial seleccionada coinciden exactamente con los datos actuales en el formulario.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead>Campo</TableHead>
                                                    <TableHead>{`Versión Histórica (${compareVersion.version})`}</TableHead>
                                                    <TableHead>Valor en Formulario (Actual)</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {diffs.map((d, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell className="font-medium text-foreground">{d.campo}</TableCell>
                                                        <TableCell className="bg-destructive/10 text-destructive">{d.oldValue}</TableCell>
                                                        <TableCell className="bg-success/10 text-success">{d.newValue}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}

                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setCompareVersion(null)}>
                                        Cerrar
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            handleRestore(compareVersion);
                                            setCompareVersion(null);
                                        }}
                                    >
                                        Restaurar esta Versión
                                    </Button>
                                </DialogFooter>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Floating button for requests */}
            {initialData?.id_equipo && pendingRequests && pendingRequests.length > 0 && (
                <div className="fixed bottom-10 right-10 z-[100]">
                    <div className="relative">
                        <Button
                            size="icon"
                            title="Ver Solicitudes Pendientes"
                            className="h-14 w-14 rounded-full bg-warning text-warning-foreground shadow-lg hover:bg-warning/90"
                            onClick={() => setShowRequestsModal(true)}
                        >
                            <IconAlertTriangle size={28} />
                        </Button>
                        <Badge variant="destructive" className="absolute -right-1 -top-1 h-5 min-w-5 justify-center rounded-full px-1">
                            {pendingRequests.length}
                        </Badge>
                    </div>
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
