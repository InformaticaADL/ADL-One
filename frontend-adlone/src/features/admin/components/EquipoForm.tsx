import React, { useState, useEffect, useMemo, useId, useRef } from 'react';
import { formatearFechaHoraCorta } from '@/lib/fechas';
import {
    IconArrowLeft,
    IconHistory,
    IconAlertTriangle,
    IconInfoCircle,
    IconDeviceFloppy,
    IconChevronRight,
    IconEdit,
    IconX,
    IconFile,
    IconTrash,
    IconDownload,
    IconPaperclip,
    IconGitCompare,
    IconArrowRight,
    IconFileText,
    IconFileDescription,
    IconFileCertificate,
    IconClipboardCheck,
} from '@tabler/icons-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { FichasEquipoDialog, type TipoFichaEquipo } from './FichasEquipoDialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { equipoService, type Equipo, type EquipoHistorial } from '../services/equipo.service';
import { descargarDocumentoRevision, formatearTamano } from '../utils/documentosEquipo';
import { ordenarObservacion, prefijoFechaHoy, conPrefijoFecha, textoSinPrefijo, fechaLineaObservacion } from '../utils/observacionEquipo';
import { Textarea } from '@/components/ui/textarea';
import { controlDeEquipo, sumarMeses, type ReglasControl, type ModalidadControl } from '../utils/reglasControlEquipo';
import { Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle, AttachmentDescription, AttachmentActions, AttachmentAction } from '@/components/ui/attachment';
import { adminService } from '../../../services/admin.service';
import { catalogosService } from '../../medio-ambiente/services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { useNavStore } from '../../../store/navStore';
import { useAuth } from '../../../contexts/AuthContext';
import { EquipmentRequestsModal } from './EquipmentRequestsModal';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { FieldLabel } from '../../../components/common/FieldHelp';
import { PasosLayout, type PasoInfo, type EstadoPaso } from '../../medio-ambiente/components/PasosLayout';
import { validarCodigoTipoNuevo, requisitosNorma, sugerirSigla } from '../utils/codigoEquipo';

// Valores de "Influencia Significativa" del inventario OI-FoGe-21.
const INFLUENCIAS = ['Alta', 'Media', 'Baja'];

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
    /** Solo escritura, sin lista desplegable de sugerencias (ej. el tipo y el nombre de un tipo de equipo nuevo). */
    sinSugerencias?: boolean;
}> = ({ label, value, options, onChange, placeholder, strict, required, disabled, error, sinSugerencias }) => {
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
                        list={sinSugerencias ? undefined : datalistId}
                        autoComplete={sinSugerencias ? 'off' : undefined}
                        placeholder={placeholder}
                        value={value ?? ''}
                        onChange={(e) => onChange(e.target.value || null)}
                        disabled={disabled}
                        className={cn(error && 'border-destructive')}
                    />
                    {!sinSugerencias && (
                        <datalist id={datalistId}>
                            {data.map((d) => <option key={d} value={d} />)}
                        </datalist>
                    )}
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
    /** Solo al crear. 'nuevo': tipo de equipo que aún no existe (se escribe el código a mano y de él sale la sigla); si no, el código es correlativo automático. */
    modoCreacion?: 'existente' | 'nuevo';
    /**
     * Equipo que ya existía antes de la app (se carga desde el inventario en Excel): conserva su estado y sus fechas.
     * Sin esto, un equipo creado en la app nace Fuera de Servicio, sin vigencia y pendiente de su Puesta en Marcha.
     */
    inventarioExistente?: boolean;
}

// Requisitos del equipo al crearlo (definidos por Gestión de Calidad). Las verificaciones de Cloro y Oxígeno son
// las diarias que hace el muestreador en terreno: solo se registra que el equipo las requiere.
const TIPOS_VERIFICACION = [
    { id: 'TEMPERATURA', label: 'Temperatura (verificación inicial)' },
    { id: 'CAUDAL', label: 'Caudal' },
    { id: 'CLORO', label: 'Cloro' },
    { id: 'OXIGENO', label: 'Oxígeno / Saturación de oxígeno' },
    { id: 'FUNCIONAMIENTO', label: 'Funcionamiento' },
] as const;
interface RequisitosEquipo { puesta_marcha: boolean; mantencion_anual: boolean; verificaciones: string[] }
const leerRequisitos = (v: unknown): RequisitosEquipo | null => {
    if (!v) return null;
    try {
        const o = typeof v === 'string' ? JSON.parse(v) : v;
        return { puesta_marcha: o?.puesta_marcha !== false, mantencion_anual: !!o?.mantencion_anual, verificaciones: Array.isArray(o?.verificaciones) ? o.verificaciones : [] };
    } catch { return null; }
};

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

// ─── Pasos / secciones ────────────────────────────────────────────────────────────────────────────
// Al crear: pasos en orden (con aviso de lo que falta y bloqueo de los no visitados). Al editar: las mismas
// secciones, con navegación libre. Los campos de cada sección se muestran u ocultan, no se desmontan.
type PasoEq = 'ident' | 'tecnica' | 'verif' | 'inventario' | 'documento' | 'cantidad' | 'revision';
const PASOS_EQ: Record<PasoEq, { titulo: string; descripcion: string; subtitulo: string; ayuda: string }> = {
    ident: { titulo: 'Identificación', descripcion: 'Qué equipo es y quién lo tiene', subtitulo: 'Tipo, sede, nombre, código y responsable del equipo.', ayuda: 'Elija el tipo, la sede y el nombre: el código se genera solo. Lo marcado con * es obligatorio.' },
    tecnica: { titulo: 'Configuración técnica', descripcion: 'Qué mide y sus errores', subtitulo: 'Qué mide, unidad, errores de calibración y observación.', ayuda: 'Indique qué mide el equipo y deje en la observación cualquier detalle o historial relevante.' },
    verif: { titulo: 'Verificación y vigencia', descripcion: 'Revisión y vencimiento', subtitulo: 'Cuándo toca la próxima revisión y hasta cuándo está vigente.', ayuda: 'La siguiente revisión se propone a 90 días de la última; ajústela si corresponde.' },
    inventario: { titulo: 'Inventario y compra', descripcion: 'Marca, modelo y compra', subtitulo: 'Datos del inventario (OI-FoGe-21), compra y baja del equipo.', ayuda: 'Todo es opcional en este paso, pero ayuda a la ficha técnica y a las fichas de entrega.' },
    documento: { titulo: 'Documento de la revisión', descripcion: 'Informe o certificado', subtitulo: 'Adjunte el informe de la mantención o el certificado de calibración.', ayuda: 'El archivo se guarda junto con el equipo, al presionar Actualizar.' },
    cantidad: { titulo: 'Cantidad y resumen', descripcion: 'Revise y cree el equipo', subtitulo: 'Revise los datos y elija cuántas unidades crear.', ayuda: 'Si necesita varias unidades iguales, indique la cantidad: en el paso siguiente confirma cada código.' },
    revision: { titulo: 'Revisión masiva', descripcion: 'Confirmar códigos', subtitulo: 'Confirme el código, la sede y el N° de serie de cada unidad.', ayuda: 'Puede ajustar los códigos y sedes de cada unidad antes de crearlas.' },
};
// Qué paso contiene cada campo obligatorio (data-campo → paso).
const PASO_DE_CAMPO: Record<string, PasoEq> = {
    tipo: 'ident', ubicacion: 'ident', estado: 'ident', nombre: 'ident', codigo: 'ident', id_muestreador: 'ident',
    que_mide: 'tecnica', observacion: 'tecnica', siguiente_verificacion: 'verif', modalidad_control: 'verif',
    n_documento_compra: 'inventario',
};

// ─── Borrador del equipo en creación (se guarda en este navegador) ───────────────────────────────────
interface BorradorEquipo {
    version: 1;
    guardadoEn: number;
    formData: Record<string, unknown>;
    bulkQuantity: number;
    pasoActual: PasoEq;
    maxPaso: number;
}
const claveBorradorEq = (idUsuario: unknown) => `adlone:borrador-equipo-v1:${idUsuario ?? 0}`;
const leerBorradorEq = (clave: string): BorradorEquipo | null => {
    try {
        const raw = localStorage.getItem(clave);
        if (!raw) return null;
        const d = JSON.parse(raw);
        return d?.version === 1 && d.formData ? d : null;
    } catch { return null; }
};
const escribirBorradorEq = (clave: string, valor: unknown): boolean => {
    try { localStorage.setItem(clave, JSON.stringify(valor)); return true; } catch { return false; }
};
const borrarBorradorEq = (clave: string) => { try { localStorage.removeItem(clave); } catch { /* sin acceso al almacenamiento */ } };
// Se recalculan al abrir el borrador (código y correlativo se piden de nuevo para no repetir uno ya usado).
const CAMPOS_NO_RESTAURAR = ['codigo', 'correlativo', 'sigla', 'previousCode', 'previousStatus'];

const SectionDivider: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
    <div className="my-2 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        {children && <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>}
        <div className="h-px flex-1 bg-border" />
    </div>
);

// Estados del equipo (columna ESTADO del inventario OI-FoGe-21).
const ESTADOS_EQUIPO = ['Operativo', 'Fuera de Servicio', 'Dado de Baja'];

export const EquipoForm: React.FC<Props> = ({ onCancel, onSave, initialData, pendingRequests = [], onRefreshSolicitudes, modoCreacion, inventarioExistente = false }) => {
    // Alta en la app (no un equipo del inventario anterior): nace Fuera de Servicio, sin vigencia y pendiente de su
    // Puesta en Marcha, que es la que fija la vigencia según el control de fechas del equipo.
    const altaNueva = !initialData?.id_equipo && !inventarioExistente;
    // Sin vigencia todavía: el alta nueva y el equipo que espera su primera Puesta en Marcha.
    const sinVigenciaPorPm = altaNueva || !!initialData?.pendiente_pm;
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
        estado: 'Inactivo',
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
        estado_equipo: 'Fuera de Servicio',
        proveedor: '',
        fecha_compra: '',
        documento_compra: '',
        n_documento_compra: '',
        valor_unitario: '',
        fecha_baja: '',
        marca: '',
        modelo: '',
        n_serie: '',
        influencia_significativa: '',
        justificacion_influencia: ''
    });

    // Solo al dar de alta en la app: qué requiere el equipo (va aparte de formData para no reenviarlo al editar).
    const [requisitosAlta, setRequisitosAlta] = useState<RequisitosEquipo>({ puesta_marcha: true, mantencion_anual: false, verificaciones: [] });
    const requisitosGuardados = leerRequisitos(initialData?.requisitos);
    const [loading, setLoading] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    // Formularios del equipo en PDF. La ficha de entrega toma lo que hay en el
    // formulario (sirve también al crear el equipo, antes de guardarlo).
    const [fichaAbierta, setFichaAbierta] = useState<TipoFichaEquipo | null>(null);
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [allEquipos, setAllEquipos] = useState<Equipo[]>([]);
    const [history, setHistory] = useState<EquipoHistorial[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [showRevisionConfirm, setShowRevisionConfirm] = useState(false);
    // Observación obligatoria al registrar una revisión: queda como una línea fechada en la observación del equipo.
    const [obsRevision, setObsRevision] = useState('');
    // Al actualizar un equipo: la observación obligatoria que acompaña el cambio.
    const [obsActualizar, setObsActualizar] = useState('');
    const [compareVersion, setCompareVersion] = useState<any | null>(null);
    const [compareOnlyChanges, setCompareOnlyChanges] = useState(false);
    const [editingObsIdx, setEditingObsIdx] = useState<number | null>(null);
    const [editingObsText, setEditingObsText] = useState('');
    const [requestedChanges, setRequestedChanges] = useState<any>(null);
    const [originalUltimaVerificacion, setOriginalUltimaVerificacion] = useState<string>(initialRevision);
    const [originalSiguienteVerificacion, setOriginalSiguienteVerificacion] = useState<string>(initialSiguiente);
    const [generatingCode, setGeneratingCode] = useState(false);
    const [namesOptions, setNamesOptions] = useState<string[]>([]);
    const [tipoOptions, setTipoOptions] = useState<string[]>([]);
    const [reglasControl, setReglasControl] = useState<ReglasControl | null>(null);
    const [queMideOptions, setQueMideOptions] = useState<string[]>([]);
    const [unidadesOptions, setUnidadesOptions] = useState<string[]>([]);
    const [sedeOptions, setSedeOptions] = useState<string[]>([]);
    const [, setEstadoOptions] = useState<string[]>([]);
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
    // Paso actual y el más lejano visitado (al crear); al editar solo cuenta el actual.
    const [pasoActual, setPasoActual] = useState<PasoEq>('ident');
    const [maxPaso, setMaxPaso] = useState(0);
    const topRef = useRef<HTMLDivElement>(null);
    const [showRequestsModal, setShowRequestsModal] = useState(false);
    // --- Documento de la revisión/mantención ---
    // Es un atributo de la versión del equipo, no una lista de adjuntos: se
    // sube el archivo, la ruta queda en formData y se graba junto al equipo.
    const [docFile, setDocFile] = useState<File | null>(null);
    const [docNombre, setDocNombre] = useState('');
    const [docUploading, setDocUploading] = useState(false);
    const [docDescargando, setDocDescargando] = useState(false);
    const [docTamano, setDocTamano] = useState<number | null>(null);
    // Documento guardado de la versión vigente: base para saber si hay un cambio
    // pendiente. Se actualiza al habilitar otra versión del historial.
    const [originalDocumentoRuta, setOriginalDocumentoRuta] = useState<string | null>(initialData?.documento_ruta ?? null);
    const docFileInputRef = useRef<HTMLInputElement>(null);
    const isMobile = useMediaQuery('(max-width: 768px)');

    const { showToast } = useToast();
    const { hideNotification } = useNavStore();
    const { hasPermission, user } = useAuth();

    // ── Un solo formulario: si el nombre escrito no está en el catálogo, se puede registrar ahí mismo como tipo nuevo ──
    const normNombre = (t: unknown) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
    const [tipoNuevoMarcado, setTipoNuevoMarcado] = useState(modoCreacion === 'nuevo');
    const esCreacionForm = !initialData?.id_equipo;
    const nombreEnCatalogo = useMemo(
        () => fullCatalogItems.find((c: any) => normNombre(c.nombre) === normNombre(formData.nombre)) || null,
        [fullCatalogItems, formData.nombre],
    );
    // El nombre escrito no está registrado (y el catálogo ya cargó).
    const nombreSinRegistrar = esCreacionForm && !!String(formData.nombre || '').trim() && fullCatalogItems.length > 0 && !nombreEnCatalogo;
    // Influencia significativa y justificación las define el tipo de equipo (catálogo, hoja «Influencia» del
    // inventario OI-FoGe-21): se rellenan solas y no se editan. Solo un tipo nuevo, o uno que aún no las tiene, se escriben a mano.
    const influenciaDelTipo: { influencia: string; justificacion: string } | null = nombreEnCatalogo?.influencia_significativa
        ? { influencia: String(nombreEnCatalogo.influencia_significativa), justificacion: String(nombreEnCatalogo.justificacion_influencia || '') }
        : null;
    // Marca, modelo y proveedor: sugerencias con los valores ya cargados en el inventario, para no tipear variantes
    // del mismo valor. Las que solo difieren en mayúsculas o tildes se juntan y queda la forma más usada.
    const opcionesInventario = useMemo(() => {
        const de = (campo: 'marca' | 'modelo' | 'proveedor') => {
            const grupos = new Map<string, Map<string, number>>();
            for (const e of allEquipos) {
                const v = String(e?.[campo] ?? '').replace(/\s+/g, ' ').trim();
                if (!v) continue;
                const clave = normNombre(v);
                const formas = grupos.get(clave) ?? new Map<string, number>();
                formas.set(v, (formas.get(v) ?? 0) + 1);
                grupos.set(clave, formas);
            }
            return [...grupos.values()]
                .map((formas) => [...formas.entries()].sort((a, b) => b[1] - a[1])[0][0])
                .sort((a, b) => a.localeCompare(b, 'es'));
        };
        return { marca: de('marca'), modelo: de('modelo'), proveedor: de('proveedor') };
    }, [allEquipos]);

    useEffect(() => {
        if (!influenciaDelTipo) return;
        if (formData.influencia_significativa === influenciaDelTipo.influencia && (formData.justificacion_influencia || '') === influenciaDelTipo.justificacion) return;
        setFormData((p: Record<string, unknown>) => ({ ...p, influencia_significativa: influenciaDelTipo.influencia, justificacion_influencia: influenciaDelTipo.justificacion }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [influenciaDelTipo?.influencia, influenciaDelTipo?.justificacion]);
    // Tipo nuevo: marcado y con un nombre que de verdad no está (si se elige uno registrado, vuelve a «existente»).
    const esNuevoTipo = esCreacionForm && tipoNuevoMarcado && !nombreEnCatalogo;
    // La sigla de un tipo nuevo la define Gestión de Calidad: permiso «Nuevo Equipo: registrar un tipo de equipo nuevo».
    const puedeCrearTipo = hasPermission('GC_CREAR_TIPO');
    // Nombres del catálogo parecidos al escrito (para no crear «Sonda de caudal» si ya existe «SONDA CAUDAL»).
    const nombresParecidos = useMemo(() => {
        const n = normNombre(formData.nombre);
        if (!nombreSinRegistrar || n.length < 3) return [] as string[];
        const palabras = n.split(' ').filter((w) => w.length >= 3);
        return fullCatalogItems
            .map((c: any) => String(c.nombre || '').trim())
            .filter((nom: string) => {
                const c = normNombre(nom);
                return c.includes(n) || n.includes(c) || palabras.some((w) => c.split(' ').includes(w));
            })
            .slice(0, 4);
    }, [nombreSinRegistrar, formData.nombre, fullCatalogItems]);

    // Permissions
    // RB-08: AI_MA_ADMIN_ACCESO eliminado (no existe en BD). Solo permisos reales.
    const canCreateEquipo = hasPermission('AI_MA_CREAR_EQUIPO');
    const canEditEquipo = hasPermission('AI_MA_EDITAR_EQUIPO');
    const isSuper = false;

    // Borrador: solo en creación pura (sin solicitud ni equipo de partida).
    const conBorrador = !initialData;
    const claveBorr = claveBorradorEq(user?.id);
    const [borradorPendiente, setBorradorPendiente] = useState<BorradorEquipo | null>(() => (conBorrador ? leerBorradorEq(claveBorradorEq(user?.id)) : null));
    const borradorCerrado = useRef(false);

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
    // Extrae la primera fecha válida contenida en el texto de la observación (formato YYYY-MM-DD), o null si no contiene fecha
    const extraerFechaObservacion = (texto: string): string | null => {
        if (!texto || !texto.trim()) return null;
        const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (const l of lineas) {
            const v = fechaLineaObservacion(l);
            if (v && v >= 19900101 && v <= 21001231) {
                const s = String(v);
                const yyyy = s.slice(0, 4);
                const mm = s.slice(4, 6);
                const dd = s.slice(6, 8);
                return `${yyyy}-${mm}-${dd}`;
            }
        }
        return null;
    };

    // --- Documento de la revisión/mantención ---
    // Solo en edición: registrar una mantención es editar el equipo, y al crear
    // todavía no hay versión a la cual asociar el informe.
    const idEquipoActual = initialData?.id_equipo;

    // El archivo NO se sube al elegirlo — solo queda en memoria (docFile) hasta
    // que se graba el equipo. Antes se subía de inmediato, lo que dejaba el
    // archivo huérfano en el servidor si el usuario cancelaba el formulario o
    // quitaba el documento sin guardar. La subida real ocurre en handleSave,
    // justo antes de armar el payload, junto con la versión nueva del equipo.
    const handleSeleccionarDoc = (file: File | null) => {
        setDocFile(file);
        if (file) setDocTamano(file.size);
    };

    const handleDescargarDoc = async () => {
        if (!idEquipoActual) return;
        setDocDescargando(true);
        try {
            await descargarDocumentoRevision('equipo', idEquipoActual, formData.documento_nombre);
        } catch {
            showToast({ type: 'error', message: 'No se pudo descargar el documento' });
        } finally {
            setDocDescargando(false);
        }
    };

    // documento_ruta en null es la señal explícita de "quitar" para el backend;
    // el borrado real se aplica al grabar, como cualquier otro campo.
    const handleQuitarDoc = () => {
        setFormData((p: any) => ({ ...p, documento_nombre: null, documento_ruta: null }));
        setDocFile(null);
        setDocNombre('');
        setDocTamano(null);
        if (docFileInputRef.current) docFileInputRef.current.value = '';
    };

    const handleDescargarDocHistorial = async (h: EquipoHistorial) => {
        try {
            await descargarDocumentoRevision('historial', (h as any).id_historial, h.documento_nombre);
        } catch {
            showToast({ type: 'error', message: 'No se pudo descargar el documento de esa versión' });
        }
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
                        estado_equipo: baseData.estado_equipo || '',
                        proveedor: baseData.proveedor || '',
                        fecha_compra: baseData.fecha_compra ? baseData.fecha_compra.split('T')[0] : '',
                        documento_compra: baseData.documento_compra || '',
                        n_documento_compra: baseData.n_documento_compra || '',
                        valor_unitario: baseData.valor_unitario ?? '',
                        fecha_baja: baseData.fecha_baja ? baseData.fecha_baja.split('T')[0] : '',
                        marca: baseData.marca || '',
                        modelo: baseData.modelo || '',
                        n_serie: baseData.n_serie || '',
                        influencia_significativa: baseData.influencia_significativa || '',
                        justificacion_influencia: baseData.justificacion_influencia || ''
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
        if (isNew && nombreSinRegistrar && !esNuevoTipo) {
            if (formData.codigo) setFormData((prev: any) => ({ ...prev, codigo: '', previousCode: null, previousStatus: null }));
            return;
        }
        if (esNuevoTipo) {
            // Tipo nuevo: el código se arma solo con la sigla que define Calidad, el correlativo 01 y la sede.
            const sigla = String(formData.sigla || '').trim();
            const codigo = sigla.length === 3 ? `${sigla}.01/MA.${formData.ubicacion}` : '';
            if (formData.codigo !== codigo || Number(formData.correlativo) !== 1) {
                setFormData((prev: any) => ({ ...prev, codigo, correlativo: 1, previousCode: null, previousStatus: null }));
            }
            return;
        }

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

    // Reglas de control por tipo de equipo (qué ciclo de fechas aplica y cada cuánto).
    useEffect(() => {
        equipoService.getReglasControl().then(setReglasControl).catch(() => setReglasControl(null));
    }, []);

    // Control que rige para este equipo según su nombre: sonda de caudal y molinete
    // eligen entre dos ciclos (solo rige el elegido); el resto trae uno fijo; los
    // complementos (baterías, botellas…) no vencen. Sin regla, todo igual que antes.
    const control = useMemo(() => {
        const c = controlDeEquipo(reglasControl, formData.nombre, formData.modalidad_control);
        if (c || !reglasControl) return c;
        // Nombre sin regla fija en el catálogo estático (REGLAS_POR_NOMBRE): puede ser
        // un tipo nuevo que Calidad recién está creando (esNuevoTipo, elige entre todas
        // las modalidades) o un equipo YA EXISTENTE de un tipo nuevo anterior (ej.
        // "Adaptador"), que trae su modalidad guardada desde que se creó — en ambos
        // casos se respeta la modalidad elegida/guardada en vez de pedir fechas de
        // nuevo al editarlo (antes esto solo se honraba durante la creación).
        const elegida = String(formData.modalidad_control || '') as ModalidadControl;
        const info = reglasControl.modalidades[elegida];
        if (!info) return null;
        return {
            permitidas: esNuevoTipo ? (Object.keys(reglasControl.modalidades) as ModalidadControl[]) : [elegida],
            elegible: esNuevoTipo, modalidad: elegida, info, meses: info.meses, sinVencimiento: elegida === 'SIN_VENCIMIENTO',
        };
    }, [reglasControl, formData.nombre, formData.modalidad_control, esNuevoTipo]);
    // Tipo nuevo todavía sin control de fechas elegido.
    const faltaControlNuevo = esNuevoTipo && !!reglasControl && !control;
    const esSinVencimiento = !!control?.sinVencimiento;
    const mesesControl = control?.meses ?? null;

    // Alta nueva: los requisitos se proponen según el control de fechas (se pueden cambiar).
    useEffect(() => {
        if (!altaNueva || !control?.modalidad) return;
        setRequisitosAlta((r) => ({
            ...r,
            mantencion_anual: control.modalidad === 'MANTENCION_ANUAL',
            verificaciones: control.modalidad === 'VERIFICACION_TRIMESTRAL'
                ? [...new Set([...r.verificaciones, 'TEMPERATURA'])]
                : r.verificaciones,
        }));
    }, [altaNueva, control?.modalidad]);

    // Guarda la modalidad que rige y recalcula la siguiente fecha (última + frecuencia)
    // solo cuando cambia la modalidad o la última fecha: al abrir un equipo existente
    // se respeta la fecha guardada.
    const previoControl = useRef<{ modalidad: ModalidadControl | null; ultima: string } | null>(null);
    useEffect(() => {
        if (!control) return;
        const ultima = String(formData.ultima_verificacion || '');
        const previo = previoControl.current;
        previoControl.current = { modalidad: control.modalidad, ultima };
        setFormData((p: any) => {
            const next = { ...p };
            let cambio = false;
            if (p.modalidad_control !== control.modalidad) { next.modalidad_control = control.modalidad; cambio = true; }
            const cambioCiclo = !!previo && (previo.modalidad !== control.modalidad || previo.ultima !== ultima);
            if (cambioCiclo && control.meses && ultima) {
                const sig = sumarMeses(ultima, control.meses);
                if (sig && sig !== p.siguiente_verificacion) { next.siguiente_verificacion = sig; cambio = true; }
            }
            return cambio ? next : p;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [control?.modalidad, formData.ultima_verificacion]);

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

    // Comparación completa entre dos versiones: `base` (la anterior) y `actual`.
    // Ambas se llevan a la misma forma de texto para mostrarlas lado a lado y
    // marcar cuáles campos cambiaron.
    const buildComparison = (base: any, actual: any, actualEsFormulario: boolean) => {
        const nombreResponsable = (id: any) =>
            muestreadores.find(m => String(m.id_muestreador) === String(id))?.nombre_muestreador || (id ? `ID ${id}` : '—');
        const dash = (v: any) => (v === null || v === undefined || String(v).trim() === '' ? '—' : String(v));
        const fechaDMY = (v: any) => {
            if (!v) return '—';
            const partes = String(v).split('T')[0].split('-');
            return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : String(v);
        };
        const siNo = (v: any) => (['S', 'SI', 'Si'].includes(String(v ?? '').trim()) ? 'Sí' : 'No');
        const asociado = (v: any) => (v === null || v === undefined || v === '' || v === '0' || v === 'No Aplica' ? 'No aplica' : String(v));
        // Mismo patrón que fmtClp en el módulo de Facturación ("$ " + miles con punto).
        const peso = (v: any) => {
            if (v === null || v === undefined || v === '') return '—';
            const n = Number(v);
            return Number.isNaN(n) ? String(v) : `$ ${n.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`;
        };

        const snap = (x: any, esForm: boolean) => ({
            codigo: dash(x.codigo),
            nombre: dash(x.nombre),
            tipo: dash(x.tipo),
            ubicacion: dash(x.ubicacion),
            responsable: nombreResponsable(x.id_muestreador),
            habilitacion: dash(x.estado),
            estadoEquipo: dash(x.estado_equipo),
            ultima: fechaDMY(x.ultima_verificacion),
            siguiente: x.siguiente_verificacion ? fechaDMY(x.siguiente_verificacion) : (esForm ? '—' : dash(x.vigencia)),
            plazo: dash(x.plazo_vigencia),
            queMide: dash(x.que_mide),
            unidad: dash(x.unidad_medida_textual),
            sigla: dash(x.unidad_medida_sigla),
            error0: String(x.error0 ?? 0),
            error15: String(x.error15 ?? 0),
            error30: String(x.error30 ?? 0),
            fc0: dash(x.fc0),
            fc15: dash(x.fc15),
            fc30: dash(x.fc30),
            fc: siNo(x.tiene_fc),
            visible: siNo(x.visible_muestreador),
            informe: siNo(x.informe),
            asociado: asociado(x.equipo_asociado),
            documento: x.documento_ruta ? dash(x.documento_nombre || 'Documento') : 'Sin documento',
            observacion: dash(x.observacion),
            proveedor: dash(x.proveedor),
            fechaCompra: fechaDMY(x.fecha_compra),
            documentoCompra: dash(x.documento_compra),
            nDocumentoCompra: dash(x.n_documento_compra),
            valorUnitario: peso(x.valor_unitario),
            fechaBaja: fechaDMY(x.fecha_baja),
            marca: dash(x.marca),
            modelo: dash(x.modelo),
            nSerie: dash(x.n_serie),
            influencia: dash(x.influencia_significativa),
            justificacion: dash(x.justificacion_influencia)
        });

        const a = snap(base, false);
        const b = snap(actual, actualEsFormulario);

        const secciones: Array<{ titulo: string; campos: Array<[string, keyof typeof a]> }> = [
            { titulo: 'Identificación', campos: [['Código', 'codigo'], ['Nombre', 'nombre'], ['Tipo de equipo', 'tipo'], ['Sede', 'ubicacion'], ['Responsable', 'responsable']] },
            { titulo: 'Estado y vigencia', campos: [['Habilitación', 'habilitacion'], ['Estado del equipo', 'estadoEquipo'], ['Última revisión', 'ultima'], ['Vigente hasta', 'siguiente'], ['Plazo de vigencia', 'plazo']] },
            { titulo: 'Medición', campos: [['¿Qué mide?', 'queMide'], ['Unidad de medida', 'unidad'], ['Sigla de la unidad', 'sigla'], ['Error 0', 'error0'], ['FC 0', 'fc0'], ['Error 15', 'error15'], ['FC 15', 'fc15'], ['Error 30', 'error30'], ['FC 30', 'fc30']] },
            { titulo: 'Configuración', campos: [['Factor de corrección', 'fc'], ['Visible para muestreadores', 'visible'], ['Incluir en informe', 'informe'], ['Equipo asociado', 'asociado']] },
            { titulo: 'Documento y notas', campos: [['Documento adjunto', 'documento'], ['Observación', 'observacion']] },
            { titulo: 'Inventario', campos: [['Marca', 'marca'], ['Modelo', 'modelo'], ['N° de serie', 'nSerie'], ['Influencia significativa', 'influencia'], ['Justificación', 'justificacion']] },
            { titulo: 'Compra y Baja', campos: [['Proveedor', 'proveedor'], ['Fecha de compra', 'fechaCompra'], ['Documento', 'documentoCompra'], ['N° Documento', 'nDocumentoCompra'], ['Valor unitario', 'valorUnitario'], ['Fecha dado de baja', 'fechaBaja']] }
        ];

        return secciones.map(sec => ({
            titulo: sec.titulo,
            filas: sec.campos.map(([campo, key]) => ({
                campo,
                anterior: a[key],
                actual: b[key],
                cambio: a[key].trim().toLowerCase() !== b[key].trim().toLowerCase()
            }))
        }));
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
                        estado_equipo: b.estado_equipo || '',
                        proveedor: b.proveedor || '',
                        fecha_compra: b.fecha_compra ? b.fecha_compra.split('T')[0] : '',
                        documento_compra: b.documento_compra || '',
                        n_documento_compra: b.n_documento_compra || '',
                        valor_unitario: b.valor_unitario ?? '',
                        fecha_baja: b.fecha_baja ? b.fecha_baja.split('T')[0] : '',
                        marca: b.marca || '',
                        modelo: b.modelo || '',
                        n_serie: b.n_serie || '',
                        influencia_significativa: b.influencia_significativa || '',
                        justificacion_influencia: b.justificacion_influencia || ''
                    });
                    // El documento pasa a ser el de la versión habilitada; se descarta
                    // cualquier archivo que estuviera pendiente de guardar.
                    setOriginalDocumentoRuta(b.documento_ruta ?? null);
                    setDocFile(null);
                    setDocNombre('');
                    setDocTamano(null);
                    if (docFileInputRef.current) docFileInputRef.current.value = '';
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
        const next90 = mesesControl ? sumarMeses(todayStr, mesesControl) : calculateNext90Days(todayStr);
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

    // Crear un solo equipo no tiene nada que revisar en masa: el formulario es
    // de un paso y el botón principal crea directamente. El segundo paso
    // ("Revisión Masiva") solo aparece desde 2 unidades en adelante.
    const esCreacion = !initialData?.id_equipo;
    const esMasivo = esCreacion && bulkQuantity > 1;
    // El botón principal lleva al paso de revisión (en vez de crear) solo cuando
    // hay varias unidades y todavía estamos en el formulario.
    const irARevision = esMasivo && activeStep === 0;

    // Si la cantidad vuelve a 1, el paso 2 deja de existir: se regresa al
    // formulario para no quedar en un paso que ya no se muestra.
    useEffect(() => {
        if (!esMasivo && activeStep !== 0) setActiveStep(0);
    }, [esMasivo, activeStep]);

    // Tipo nuevo: la sigla (3 letras, libre) y el código armado SIGLA.01/MA.SEDE con la sede del equipo.
    // Tipo nuevo: la sigla se propone con el nombre (las 3 primeras letras relevantes) hasta que Calidad la cambie.
    const siglaEditada = useRef(false);
    useEffect(() => {
        if (!esNuevoTipo || siglaEditada.current) return;
        const s = sugerirSigla(formData.nombre);
        if (s !== (formData.sigla || '')) setFormData((p: any) => ({ ...p, sigla: s }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [esNuevoTipo, formData.nombre]);
    // ¿La sigla está libre? (no la tiene otro tipo ni otro equipo)
    const [estadoSigla, setEstadoSigla] = useState<{ sigla: string; disponible: boolean | null; usada_por: string | null }>({ sigla: '', disponible: null, usada_por: null });
    useEffect(() => {
        const s = String(formData.sigla || '').trim();
        if (!esNuevoTipo || !/^[A-Za-z]{3}$/.test(s)) return;
        let vigente = true;
        const t = setTimeout(() => {
            equipoService.siglaDisponible(s)
                .then((r) => { if (vigente) setEstadoSigla({ sigla: s, disponible: r.disponible, usada_por: r.usada_por }); })
                .catch(() => { if (vigente) setEstadoSigla({ sigla: s, disponible: null, usada_por: null }); });
        }, 400);
        return () => { vigente = false; clearTimeout(t); };
    }, [esNuevoTipo, formData.sigla]);
    const errorSigla = !esNuevoTipo ? null
        : !/^[A-Za-z]{3}$/.test(String(formData.sigla || '').trim()) ? (String(formData.sigla || '').trim() ? 'La sigla debe tener 3 letras.' : 'Falta la sigla (3 letras).')
            : estadoSigla.sigla === String(formData.sigla).trim() && estadoSigla.disponible === false ? `La sigla ya la usa ${estadoSigla.usada_por}.` : null;
    const errorCodigoNuevo = !esNuevoTipo ? null : (errorSigla || (formData.codigo ? validarCodigoTipoNuevo(formData.codigo, formData.ubicacion) : null));

    // Documentos que la norma exige para este tipo de equipo (aviso al ingresarlo).
    const requisitos = !initialData?.id_equipo ? requisitosNorma(formData.nombre, formData.tipo, formData.que_mide) : [];

    const isFormValid = useMemo(() => {
        const isEdit = !!initialData?.id_equipo;
        const hasNewRevision = isEdit
            ? (formData.ultima_verificacion && formData.ultima_verificacion !== originalUltimaVerificacion)
            : !!formData.ultima_verificacion;

        if (isEdit) {
            // Editar un equipo ya NO exige registrar una revisión nueva ni adjuntar
            // documento — eran alternativas obligatorias entre sí, pero bloqueaban
            // ediciones simples (ej. corregir el Estado o la Observación) que no
            // implican una revisión/calibración real.
            return !!(
                formData.nombre &&
                formData.tipo &&
                formData.ubicacion &&
                formData.estado_equipo &&
                formData.codigo &&
                formData.id_muestreador &&
                (sinVigenciaPorPm || formData.siguiente_verificacion || esSinVencimiento) &&
                !generatingCode &&
                !docUploading
            );
        }

        // Creación: todos los campos son obligatorios
        return !!(
            !errorCodigoNuevo &&
            !faltaControlNuevo &&
            !(nombreSinRegistrar && !esNuevoTipo) &&
            formData.nombre &&
            formData.tipo &&
            formData.ubicacion &&
            formData.estado_equipo &&
            formData.codigo &&
            hasNewRevision &&
            formData.id_muestreador &&
            formData.que_mide &&
            formData.observacion &&
            String(formData.n_documento_compra || '').trim() &&
            (sinVigenciaPorPm || formData.siguiente_verificacion || esSinVencimiento) &&
            !generatingCode &&
            !docUploading
        );
    }, [formData, generatingCode, initialData, originalUltimaVerificacion, originalDocumentoRuta, docFile, docUploading, esSinVencimiento, errorCodigoNuevo, faltaControlNuevo, esNuevoTipo, nombreSinRegistrar, sinVigenciaPorPm]);

    // Lo que falta para poder guardar. `campo` es el data-campo del bloque del
    // formulario: el aviso junto al botón lo usa para llevar al usuario ahí.
    const faltantes = useMemo(() => {
        const missing: { label: string; campo?: string }[] = [];
        if (!formData.tipo) missing.push({ label: 'Tipo de Equipo', campo: 'tipo' });
        if (!formData.ubicacion) missing.push({ label: 'Ubicación (Sede)', campo: 'ubicacion' });
        if (!formData.estado_equipo) missing.push({ label: 'Estado', campo: 'estado' });
        if (!formData.nombre) missing.push({ label: 'Nombre del Equipo', campo: 'nombre' });
        else if (nombreSinRegistrar && !esNuevoTipo) missing.push({ label: 'Nombre no registrado (elíjalo del catálogo o márquelo como tipo nuevo)', campo: 'nombre' });
        if (!formData.codigo) missing.push({ label: 'Código Final', campo: 'codigo' });
        else if (errorCodigoNuevo) missing.push({ label: errorSigla ? 'Sigla del tipo nuevo' : 'Código Final (formato o sede)', campo: 'codigo' });
        if (faltaControlNuevo) missing.push({ label: 'Control de fechas del tipo nuevo', campo: 'modalidad_control' });

        const isEdit = !!initialData?.id_equipo;
        // En edición ya no es obligatorio registrar revisión (ver isFormValid); en
        // creación sigue exigiendo la fecha de la revisión inicial.
        if (!isEdit && !formData.ultima_verificacion) missing.push({ label: 'Fecha Creación', campo: 'codigo' });

        if (!formData.id_muestreador) missing.push({ label: 'Responsable (Muestreador)', campo: 'id_muestreador' });
        if (!isEdit && !formData.que_mide) missing.push({ label: '¿Qué Mide?', campo: 'que_mide' });
        if (!isEdit && !formData.observacion) missing.push({ label: 'Observación', campo: 'observacion' });
        // Sin Adquisiciones en la aplicación, Calidad ingresa el N° de documento de compra al crear el equipo.
        if (!isEdit && !String(formData.n_documento_compra || '').trim()) missing.push({ label: 'N° Documento (compra)', campo: 'n_documento_compra' });
        if (!sinVigenciaPorPm && !formData.siguiente_verificacion && !esSinVencimiento) missing.push({ label: 'Siguiente Revisión (Vigente hasta:)', campo: 'siguiente_verificacion' });
        return missing;
    }, [formData, initialData, esSinVencimiento, errorCodigoNuevo, errorSigla, faltaControlNuevo, esNuevoTipo, nombreSinRegistrar, sinVigenciaPorPm]);

    // Lleva al campo que falta, lo enfoca y enciende las marcas rojas.
    const irACampo = (campo?: string) => {
        setAttemptedSubmit(true);
        if (!campo) return;
        // El campo puede estar en otro paso (oculto): se abre primero.
        const paso = PASO_DE_CAMPO[campo];
        if (paso) { setActiveStep(0); setPasoActual(paso); }
        setTimeout(() => {
            const bloque = document.querySelector<HTMLElement>(`[data-campo="${campo}"]`);
            if (!bloque) return;
            bloque.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const control = bloque.querySelector<HTMLElement>('input:not([readonly]):not([disabled]), textarea, button[role="combobox"], button:not([disabled])');
            setTimeout(() => control?.focus({ preventScroll: true }), 350);
        }, 60);
    };

    // Botón de acción principal: el del encabezado y el del pie comparten
    // etiqueta, estado y acción para que no puedan quedar desalineados.
    const accionLabel = !esCreacion
        ? 'Actualizar'
        : irARevision ? 'Siguiente' : (activeStep === 1 ? 'Guardar Todo' : 'Crear');
    const sinPermiso = !(esCreacion ? canCreateEquipo : canEditEquipo);
    const accionDeshabilitada = !isFormValid || sinPermiso;
    // Motivos que no son un campo: esperas y permisos.
    const bloqueos = [
        ...(generatingCode ? ['Generando el código del equipo…'] : []),
        ...(docUploading ? ['Esperando que termine la carga del archivo…'] : []),
        ...(sinPermiso ? [`No tienes permiso para ${esCreacion ? 'crear' : 'editar'} equipos`] : []),
    ];
    // Al editar, el equipo ya existe: lo que falte se marca en rojo desde que
    // carga, sin esperar a que se intente guardar (el botón está deshabilitado
    // y nunca llegaría ese intento).
    const mostrarErrores = attemptedSubmit || (!esCreacion && !loading);

    // ─── Pasos: lista, estado de cada uno y navegación ───────────────────────────────────────────────
    const idsPasos: PasoEq[] = esCreacion
        ? ['ident', 'tecnica', 'verif', 'inventario', 'cantidad', ...(esMasivo ? ['revision' as PasoEq] : [])]
        : ['ident', 'tecnica', 'verif', 'inventario', ...(idEquipoActual ? ['documento' as PasoEq] : [])];
    // En la revisión masiva (activeStep 1) el paso mostrado es «revision».
    const pasoMostrado: PasoEq = esCreacion && activeStep === 1 ? 'revision' : pasoActual;
    const idxActual = Math.max(0, idsPasos.indexOf(pasoMostrado));
    const faltanDePaso = (id: PasoEq) => faltantes.filter((f) => f.campo && PASO_DE_CAMPO[f.campo] === id);
    const pasosInfo: PasoInfo[] = idsPasos.map((id, i) => {
        const f = faltanDePaso(id).length;
        const visitado = !esCreacion || i <= maxPaso || id === 'revision';
        const estado: EstadoPaso = i === idxActual ? 'actual' : visitado ? (f > 0 ? 'error' : 'completo') : 'pendiente';
        return {
            id,
            titulo: PASOS_EQ[id].titulo,
            descripcion: PASOS_EQ[id].descripcion,
            estado,
            aviso: f > 0 ? `Faltan ${f} ${f > 1 ? 'campos' : 'campo'}` : undefined,
            bloqueado: esCreacion && !visitado,
        };
    });
    const irAPaso = (id: PasoEq) => {
        const i = idsPasos.indexOf(id);
        setActiveStep(0);
        setPasoActual(id);
        if (esCreacion) setMaxPaso((m) => Math.max(m, i));
        setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
    };
    const elegirPaso = (i: number) => {
        const id = idsPasos[i];
        if (!id) return;
        if (id === 'revision') { if (activeStep === 0) handleNext(); return; }
        if (esCreacion && i > maxPaso) return;
        irAPaso(id);
    };
    // «Siguiente» en los pasos de datos exige lo obligatorio de ese paso; el último paso crea / actualiza.
    const esUltimoPaso = !esCreacion || pasoMostrado === 'cantidad' || pasoMostrado === 'revision';
    const siguientePaso = () => {
        if (esUltimoPaso) { handleNext(); return; }
        const f = faltanDePaso(pasoMostrado);
        if (f.length > 0) {
            setAttemptedSubmit(true);
            showToast({ id: 'equipo-paso-guard', type: 'warning', message: `Falta: ${f.slice(0, 3).map((x) => x.label).join(', ')}${f.length > 3 ? ` y ${f.length - 3} más` : ''}.` });
            return;
        }
        if (generatingCode) {
            showToast({ id: 'equipo-paso-guard', type: 'info', message: 'Generando el código del equipo… intente de nuevo en un momento.' });
            return;
        }
        irAPaso(idsPasos[idxActual + 1]);
    };
    const atrasPaso = esCreacion && (activeStep === 1 || idxActual > 0)
        ? () => (activeStep === 1 ? irAPaso('cantidad') : irAPaso(idsPasos[idxActual - 1]))
        : undefined;
    const textoSiguientePaso = !esCreacion ? 'Actualizar' : (esUltimoPaso ? accionLabel : 'Siguiente');

    // ─── Borrador (solo creación) ────────────────────────────────────────────────────────────────────
    const hayContenido = (f: Record<string, unknown>) => !!(f.tipo || f.ubicacion || f.nombre || f.id_muestreador || f.marca || f.modelo || f.n_serie || f.proveedor || f.observacion);
    const estadoBorrRef = useRef<Omit<BorradorEquipo, 'version' | 'guardadoEn'> | null>(null);
    estadoBorrRef.current = { formData, bulkQuantity, pasoActual, maxPaso };
    const guardarBorradorAhora = (): boolean => {
        if (!conBorrador || borradorCerrado.current || borradorPendiente) return true;
        const e = estadoBorrRef.current;
        if (!e || !hayContenido(e.formData)) return true;
        return escribirBorradorEq(claveBorr, { version: 1, guardadoEn: Date.now(), ...e });
    };
    const guardarBorradorRef = useRef(guardarBorradorAhora);
    guardarBorradorRef.current = guardarBorradorAhora;
    useEffect(() => {
        if (!conBorrador) return;
        const guardar = () => { guardarBorradorRef.current(); };
        const t = setInterval(guardar, 4000);
        window.addEventListener('beforeunload', guardar);
        return () => { clearInterval(t); window.removeEventListener('beforeunload', guardar); guardar(); };
    }, [conBorrador]);
    const descartarBorrador = () => {
        borrarBorradorEq(claveBorr);
        setBorradorPendiente(null);
    };
    const continuarBorrador = () => {
        const d = borradorPendiente;
        setBorradorPendiente(null);
        if (!d) return;
        const guardado = { ...d.formData };
        CAMPOS_NO_RESTAURAR.forEach((k) => delete guardado[k]);
        // La fecha de creación es la de hoy; la siguiente revisión se recalcula solo si era la propuesta automática.
        const eraAutomatica = guardado.siguiente_verificacion === calculateNext90Days(String(d.formData.ultima_verificacion || ''));
        setFormData((p: Record<string, unknown>) => ({
            ...p,
            ...guardado,
            ultima_verificacion: defaultRevisionDate,
            siguiente_verificacion: eraAutomatica ? defaultSiguienteDate : guardado.siguiente_verificacion,
        }));
        setBulkQuantity(Number(d.bulkQuantity) || 1);
        const id: PasoEq = (['ident', 'tecnica', 'verif', 'inventario', 'cantidad'] as PasoEq[]).includes(d.pasoActual) ? d.pasoActual : 'ident';
        setPasoActual(id);
        setMaxPaso(Math.min(Number(d.maxPaso) || 0, 4));
    };

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

        // Si es creación y ya ingresó una observación en la sección 2 (técnica),
        // y dicha observación contiene una fecha, sincronizamos la fecha de creación con esa fecha
        let updatedFormData = formData;
        if (!initialData?.id_equipo && formData.observacion) {
            const fechaDeObs = extraerFechaObservacion(formData.observacion);
            if (fechaDeObs && fechaDeObs !== formData.ultima_verificacion) {
                const next = mesesControl ? sumarMeses(fechaDeObs, mesesControl) : calculateNext90Days(fechaDeObs);
                updatedFormData = {
                    ...formData,
                    ultima_verificacion: fechaDeObs,
                    ...(altaNueva ? {} : { siguiente_verificacion: next, vigencia: next }),
                };
                setFormData(updatedFormData);
            }
        }

        // Edición → ir directo a confirmar guardado, con la observación obligatoria ya fechada
        if (initialData?.id_equipo) {
            setObsActualizar(prefijoFechaHoy());
            setShowSaveConfirm(true);
            return;
        }

        // E-01: en el paso 0 se generan los ítems; con más de uno se avanza a la
        // revisión masiva y con uno solo se va directo a confirmar la creación.
        if (activeStep === 0) {
            generateBulkItems(bulkQuantity, updatedFormData);
            if (esMasivo) {
                setActiveStep(1);
            } else if (String(updatedFormData.observacion || '').trim()) {
                // Si en la sección 2 ya agregó una observación, se omite el modal de confirmación y se guarda directamente
                handleSave(undefined, updatedFormData);
            } else {
                setShowSaveConfirm(true);
            }
        } else {
            if (String(updatedFormData.observacion || '').trim()) {
                handleSave(undefined, updatedFormData);
            } else {
                setShowSaveConfirm(true);
            }
        }
    };

    const handleSave = async (observacionNueva?: string, customFormData?: any) => {
        setLoading(true);
        setShowSaveConfirm(false);
        try {
            const isEdit = !!initialData?.id_equipo;
            if (isEdit) {
                // El documento se sube recién acá, no al elegirlo — si la subida falla,
                // el guardado se corta antes de tocar la BD y no queda nada huérfano.
                let documentoNombre = formData.documento_nombre;
                let documentoRuta = formData.documento_ruta;
                if (docFile) {
                    setDocUploading(true);
                    try {
                        const subido = await equipoService.subirArchivoDocumento(docFile, docNombre.trim() || docFile.name);
                        documentoNombre = subido.documento_nombre;
                        documentoRuta = subido.documento_ruta;
                    } finally {
                        setDocUploading(false);
                    }
                }
                // La observación obligatoria de la actualización (ya fechada) viaja aparte: el servidor la guarda
                // debajo de las anteriores, sin reordenarla con ellas.
                const data = {
                    ...formData,
                    ...(observacionNueva?.trim() ? { observacion_agregada: observacionNueva.trim() } : {}),
                    documento_nombre: documentoNombre,
                    documento_ruta: documentoRuta,
                    equipo_asociado: (formData.equipo_asociado === 'No Aplica' || !formData.equipo_asociado) ? '0' : String(formData.equipo_asociado),
                };
                await equipoService.updateEquipo(initialData!.id_equipo, data);
                if (initialData.requestId) {
                    const isTech = initialData.requestStatus === 'PENDIENTE_TECNICA';
                    await adminService.updateSolicitudStatus(initialData.requestId, isTech ? 'PENDIENTE_CALIDAD' : 'APROBADO', isTech ? 'Actualizado por Técnica' : 'Aprobado');
                    if (isTech) hideNotification(`${initialData.requestId}-PENDIENTE_TECNICA`);
                }
                showToast({ type: 'success', message: 'Equipo actualizado correctamente' });
            } else {
                const sourceItems = (customFormData && bulkItems.length <= 1)
                    ? [{ ...customFormData, correlativo: customFormData.correlativo || 1, codigo: customFormData.codigo, id_temp: 0 }]
                    : bulkItems;
                const items = sourceItems.map(it => ({
                    ...it,
                    equipo_asociado: (it.equipo_asociado === 'No Aplica' || !it.equipo_asociado) ? '0' : String(it.equipo_asociado),
                    // Tipo nuevo: el servidor valida la sigla y deja el tipo en el catálogo para los siguientes equipos iguales.
                    ...(esNuevoTipo ? { tipo_nuevo: true } : {}),
                    // Alta en la app: Fuera de Servicio y sin vigencia; queda pendiente de su Puesta en Marcha si la requiere.
                    ...(altaNueva ? {
                        estado_equipo: 'Fuera de Servicio',
                        estado: 'Inactivo',
                        siguiente_verificacion: null,
                        vigencia: null,
                        pendiente_pm: requisitosAlta.puesta_marcha,
                        requisitos: JSON.stringify(requisitosAlta),
                    } : {}),
                    // Equipo del inventario anterior a la app: se carga con su estado y fechas.
                    ...(inventarioExistente ? { origen_excel: true } : {}),
                }));
                if (items.length > 1) await equipoService.createEquiposBulk(items);
                else await equipoService.createEquipo(items[0]);

                const reqId = (initialData as any)?.requestId;
                if (reqId) {
                    const isTech = (initialData as any).requestStatus === 'PENDIENTE_TECNICA';
                    await adminService.updateSolicitudStatus(reqId, isTech ? 'PENDIENTE_CALIDAD' : 'APROBADO', 'Equipo creado');
                    if (isTech) hideNotification(`${reqId}-PENDIENTE_TECNICA`);
                }
                showToast({ type: 'success', message: items.length > 1 ? 'Equipos creados correctamente' : 'Equipo creado correctamente' });
                // Ya está creado: el borrador no se vuelve a guardar al cerrar el formulario.
                borradorCerrado.current = true;
                borrarBorradorEq(claveBorr);
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

    // Solo se ve la sección del paso actual (en la revisión masiva, ninguna del formulario).
    const ver = (id: PasoEq) => (activeStep === 0 && pasoActual === id ? 'flex flex-col gap-6' : 'hidden');

    // --- Renders ---
    return (
        <div ref={topRef} className={cn('shadcn-scope relative w-full scroll-mt-4 p-4', esNuevoTipo && 'tema-tipo-nuevo')}>
            {(loading || processingAction) && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            )}

            {/* Volver arriba a la izquierda, igual que en las demás pantallas (PageHeader). */}
            <Button variant="link" size="sm" onClick={onCancel} className="mb-1 h-auto self-start p-0 font-medium">
                <IconArrowLeft size={14} />
                Volver
            </Button>

            <div className={cn('rounded-xl border border-border bg-card p-5 shadow-sm', esNuevoTipo && 'border-t-4 border-t-primary')}>
                <div className="flex flex-col gap-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        {esNuevoTipo ? (
                            <div className={cn('flex flex-col', !isMobile && 'flex-1')}>
                                <h2 className="m-0 flex flex-wrap items-center gap-2 text-xl font-semibold text-foreground">
                                    Nuevo tipo de equipo
                                    <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Tipo no registrado</Badge>
                                </h2>
                                <span className="text-xs text-muted-foreground">
                                    Define un tipo que aún no está en el catálogo y registra su primer equipo. El tipo queda guardado para los siguientes equipos iguales.
                                </span>
                            </div>
                        ) : (
                            <div className={cn('flex flex-col', !isMobile && 'flex-1')}>
                                <h2 className="m-0 text-xl font-semibold text-foreground">
                                    {requestedChanges?.isReactivation ? 'Activación de Equipo' : (initialData?.id_equipo ? 'Editar Equipo' : 'Nuevo Equipo')}
                                </h2>
                                <span className="text-xs text-muted-foreground">
                                    {initialData?.id_equipo ? `Modificando equipo: ${formData.codigo}` : 'Completa los datos para dar de alta nuevos equipos en el sistema.'}
                                </span>
                            </div>
                        )}

                        <div className={cn('flex flex-wrap gap-2', isMobile && 'w-full')}>
                            <ProtectedContent permission="EQ_HISTORY">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowHistory(!showHistory)}
                                    className={cn(isMobile && 'flex-1')}
                                >
                                    <IconHistory size={18} /> {isMobile ? 'Historial' : (showHistory ? 'Ocultar Historial' : 'Ver Historial')}
                                </Button>
                            </ProtectedContent>
                            <ProtectedContent permission="MA_A_GEST_EQUIPO">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className={cn(isMobile && 'flex-1')}>
                                            <IconFileText size={18} /> Fichas
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-64">
                                        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Generar formulario en PDF</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => setFichaAbierta('entrega')}>
                                            <IconFileCertificate size={16} /> Ficha de entrega (OI-FoGe-36)
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setFichaAbierta('recepcion')}>
                                            <IconClipboardCheck size={16} /> Recepción y puesta en marcha (OI-FoGe-42)
                                        </DropdownMenuItem>
                                        {!esCreacion && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => setFichaAbierta('tecnica')}>
                                                    <IconFileDescription size={16} /> Ficha técnica (OI-FoGe-22)
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setFichaAbierta('historial')}>
                                                    <IconHistory size={16} /> Historial por año (OI-FoGe-24)
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </ProtectedContent>
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
                                                <TableHead>Documento</TableHead>
                                                <TableHead>Acción</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {history.length === 0 ? (
                                                <TableRow className="hover:bg-transparent">
                                                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Sin versiones previas.</TableCell>
                                                </TableRow>
                                            ) : (
                                                history.map((h: any) => {
                                                    // La versión vigente ya está habilitada: no se puede "habilitar" otra vez.
                                                    const esActiva = h.version === formData.version;
                                                    // Para la vigente el documento de verdad es el de mae_equipo
                                                    // (formData); el snapshot del historial puede ser anterior.
                                                    const docRuta = esActiva ? formData.documento_ruta : h.documento_ruta;
                                                    const docNombreVer = (esActiva ? formData.documento_nombre : h.documento_nombre)
                                                        || (docRuta ? String(docRuta).split('/').pop() : '')
                                                        || 'Documento';
                                                    return (
                                                    <TableRow
                                                        key={h.id_historial}
                                                        className={cn(
                                                            esActiva && 'bg-primary/5',
                                                            lastRestoredVersion?.previous === h.version && 'bg-warning/10'
                                                        )}
                                                    >
                                                        <TableCell className="font-semibold text-foreground">
                                                            <span className={cn(esActiva && 'underline decoration-primary decoration-2 underline-offset-4')}>{h.version}</span>
                                                        </TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">{formatearFechaHoraCorta(String(h.fecha_cambio), true)}</TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">{h.nombre_usuario_cambio || 'Sistema'}</TableCell>
                                                        <TableCell className="text-sm text-foreground">{h.codigo}</TableCell>
                                                        {/* Cada versión conserva el documento con que se registró
                                                            esa revisión, aunque el equipo ya tenga uno más nuevo. */}
                                                        <TableCell className="text-sm">
                                                            {docRuta ? (
                                                                <button
                                                                    type="button"
                                                                    title={`Descargar ${docNombreVer}`}
                                                                    onClick={() => (esActiva ? handleDescargarDoc() : handleDescargarDocHistorial(h))}
                                                                    className="flex min-w-0 items-center gap-1 text-xs text-primary hover:underline"
                                                                >
                                                                    <IconPaperclip size={13} className="shrink-0" />
                                                                    <span className="truncate">{docNombreVer}</span>
                                                                </button>
                                                            ) : (
                                                                <span className="text-xs text-muted-foreground">Sin documento</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-8 gap-1.5 rounded-md border border-transparent px-2.5 text-muted-foreground hover:border-border hover:bg-background hover:text-foreground"
                                                                    onClick={() => { setCompareOnlyChanges(false); setCompareVersion(h); }}
                                                                >
                                                                    <IconGitCompare size={14} />
                                                                    Comparar
                                                                </Button>
                                                                {esActiva ? (
                                                                    <Badge variant="secondary">Versión actual</Badge>
                                                                ) : (
                                                                    <Button size="sm" onClick={() => handleRestore(h)}>Habilitar</Button>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                    );
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Pasos (al crear) / secciones (al editar): mismo diseño que la ficha de ingreso. */}
                    {(!esCreacion || esUltimoPaso) && !loading && accionDeshabilitada && (faltantes.length > 0 || bloqueos.length > 0) && (
                        <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3" role="status">
                            <div className="flex items-start gap-2.5">
                                <IconAlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold">
                                        {faltantes.length > 0
                                            ? `Para ${esCreacion ? 'guardar' : 'actualizar'} el equipo falta${faltantes.length === 1 ? '' : 'n'} ${faltantes.length} campo${faltantes.length === 1 ? '' : 's'}`
                                            : `Todavía no se puede ${esCreacion ? 'guardar' : 'actualizar'}`}
                                    </p>
                                    {faltantes.length > 0 && (
                                        <>
                                            <p className="mt-0.5 text-xs text-muted-foreground">Presiona uno para ir al campo.</p>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {faltantes.map((f) => (
                                                    <button
                                                        key={f.label}
                                                        type="button"
                                                        onClick={() => irACampo(f.campo)}
                                                        className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-background px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                                                    >
                                                        {f.label}
                                                        <IconChevronRight size={12} />
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                    {bloqueos.length > 0 && (
                                        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                                            {bloqueos.map((b) => <li key={b}>{b}</li>)}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    <PasosLayout
                        className="p-0 md:p-0"
                        titulo={esNuevoTipo ? 'Tipo nuevo' : esCreacion ? 'Nuevo equipo' : 'Equipo'}
                        libre={!esCreacion}
                        pasos={pasosInfo}
                        actual={idxActual}
                        ayuda={esNuevoTipo && pasoMostrado === 'ident'
                            ? 'Escriba el tipo y el nombre, revise la sigla propuesta (3 letras) y elija la sede: el código del primer equipo se arma solo.'
                            : PASOS_EQ[pasoMostrado].ayuda}
                        encabezado={{ titulo: PASOS_EQ[pasoMostrado].titulo, subtitulo: PASOS_EQ[pasoMostrado].subtitulo }}
                        onElegirPaso={elegirPaso}
                        onAtras={atrasPaso}
                        textoSiguiente={textoSiguientePaso}
                        onSiguiente={siguientePaso}
                        siguienteDeshabilitado={esUltimoPaso && accionDeshabilitada}
                        guardando={loading}
                        pieExtra={(
                            <>
                                <Button type="button" variant="outline" className="rounded-full" onClick={onCancel}>Cancelar</Button>
                                {initialData?.requestId && !initialData.id_equipo && (
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        className="rounded-full"
                                        onClick={() => setRejectingSolicitud({ id_solicitud: initialData.requestId, tipo_solicitud: 'ALTA', datos_json: initialData })}
                                    >
                                        Rechazar Solicitud
                                    </Button>
                                )}
                            </>
                        )}
                    >
                    {activeStep === 0 && (
                        <div className="mt-2 flex flex-col gap-6">
                            {requisitos.length > 0 && (
                                <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                                    <p className="font-semibold">Documentos que exige la norma para este equipo</p>
                                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
                                        {requisitos.map((r) => <li key={r}>{r}</li>)}
                                    </ul>
                                </div>
                            )}
                            <div className={ver('ident')}>
                            {esCreacionForm && (
                                <label className={cn('flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors',
                                    esNuevoTipo ? 'border-primary/40 bg-primary/10' : 'border-dashed border-border bg-muted/30 hover:bg-muted/50',
                                    puedeCrearTipo ? 'cursor-pointer' : 'cursor-not-allowed opacity-75')}>
                                    <Checkbox checked={esNuevoTipo} disabled={!puedeCrearTipo || !!nombreEnCatalogo}
                                        onCheckedChange={(v) => setTipoNuevoMarcado(v === true)} className="mt-0.5" />
                                    <span>
                                        <span className="font-semibold">El equipo es de un tipo que no está registrado: registrar tipo nuevo</span>
                                        <span className="block text-xs text-muted-foreground">
                                            {!puedeCrearTipo
                                                ? 'Registrar tipos nuevos requiere el permiso «Nuevo Equipo: registrar un tipo de equipo nuevo» (lo tiene Gestión de Calidad).'
                                                : nombreEnCatalogo
                                                    ? `«${String(formData.nombre).trim()}» ya está en el catálogo: se ingresa como equipo de un tipo registrado.`
                                                    : esNuevoTipo
                                                        ? 'Se define el tipo (sigla, qué mide y control de fechas) y queda en el catálogo. Desmarque para volver a un tipo registrado.'
                                                        : 'Márquelo si el tipo de equipo todavía no existe en el catálogo.'}
                                        </span>
                                    </span>
                                </label>
                            )}
                            {esNuevoTipo && (
                                <div className="overflow-hidden rounded-xl border border-primary/30 bg-primary/5">
                                    <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-primary">Definición del tipo</p>
                                            <ol className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                                <li><b className="text-foreground">1.</b> Tipo y nombre del equipo (no existen en el catálogo).</li>
                                                <li><b className="text-foreground">2.</b> Sigla de 3 letras: se propone con el nombre; la define Calidad y no se repite entre tipos.</li>
                                                <li><b className="text-foreground">3.</b> Sede: el código del primer equipo queda con el correlativo 01.</li>
                                            </ol>
                                        </div>
                                        <div className="rounded-lg border border-primary/30 bg-background px-4 py-3 text-center md:min-w-[230px]">
                                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Código del primer equipo</p>
                                            <p className={cn('mt-0.5 font-mono text-2xl font-bold tracking-wide', formData.codigo ? 'text-primary' : 'text-muted-foreground/60')}>
                                                {formData.codigo || `${(formData.sigla || '___').padEnd(3, '_')}.01/MA.${formData.ubicacion || '__'}`}
                                            </p>
                                            <p className={cn('mt-0.5 text-[11px]', errorSigla && (String(formData.sigla || '').trim() || mostrarErrores) ? 'text-destructive' : !errorSigla && estadoSigla.disponible && estadoSigla.sigla === String(formData.sigla).trim() ? 'text-success' : 'text-muted-foreground')}>
                                                {errorSigla && (String(formData.sigla || '').trim() || mostrarErrores)
                                                    ? errorSigla
                                                    : estadoSigla.disponible && estadoSigla.sigla === String(formData.sigla).trim() ? `Sigla ${formData.sigla} disponible` : 'Sigla + 01 + MA + sede'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
<div className="grid grid-cols-12 gap-4">
                                <div className={colSpanClass(4)} data-campo="tipo">
                                    <HybridSelect
                                        label={<FieldLabel label="Tipo de Equipo *" help="Categoría del equipo (ej: Multiparámetro, pH-metro, Termómetro) para agrupar equipos con características similares." />}
                                        placeholder={esNuevoTipo ? 'Escriba el tipo nuevo (ej. Computador)' : 'Seleccione...'}
                                        value={formData.tipo}
                                        options={tipoOptions}
                                        onChange={(val: any) => setFormData((p: any) => ({ ...p, tipo: val, nombre: esNuevoTipo ? p.nombre : '' }))}
                                        strict={!isSuper && !esNuevoTipo}
                                        sinSugerencias={esNuevoTipo}
                                        required
                                        disabled={!!initialData?.id_equipo}
                                        error={mostrarErrores && !formData.tipo && "Obligatorio"}
                                    />
                                </div>
                                <div className={colSpanClass(4)} data-campo="ubicacion">
                                    <HybridSelect
                                        label={<FieldLabel label="Ubicación (Sede) *" help="Sede física de ADL donde se almacena y opera el equipo (ej: PM para Puerto Montt, CO para Coyhaique)." />}
                                        placeholder="Seleccione..."
                                        value={formData.ubicacion}
                                        options={sedeOptions}
                                        onChange={(val: any) => setFormData((p: any) => ({ ...p, ubicacion: val }))}
                                        strict
                                        required
                                        error={mostrarErrores && !formData.ubicacion && "Obligatorio"}
                                    />
                                </div>
                                <div className={colSpanClass(4)} data-campo="estado">
                                    {/* Estado del equipo (columna ESTADO del inventario). Activo/Inactivo
                                        se deriva: Operativo → Activo; Fuera de Servicio o Dado de Baja → Inactivo. */}
                                    {altaNueva ? (
                                        <>
                                            <div className="mb-1"><FieldLabel label="Estado" help="Un equipo nuevo nace Fuera de Servicio: pasa a Operativo después de su Puesta en Marcha y de los documentos que requiera (verificaciones, certificados, informes)." /></div>
                                            <Input value="Fuera de Servicio" readOnly className="cursor-default bg-muted/50" />
                                            <p className="mt-1 text-xs text-muted-foreground">Pendiente de puesta en marcha.</p>
                                        </>
                                    ) : (
                                    <HybridSelect
                                        label={<FieldLabel label="Estado *" help="Operativo: en uso. Fuera de Servicio: no disponible por ahora (falla, mantención o calibración). Dado de Baja: retirado definitivamente. Fuera de Servicio y Dado de Baja dejan el equipo inactivo." />}
                                        placeholder="Seleccione..."
                                        value={formData.estado_equipo}
                                        options={ESTADOS_EQUIPO.filter(o => estadoEquipoOptions.length === 0 || estadoEquipoOptions.some(c => c.toLowerCase() === o.toLowerCase()))}
                                        onChange={(val: any) => setFormData((p: any) => ({
                                            ...p,
                                            estado_equipo: val || '',
                                            estado: !val ? p.estado : (val === 'Operativo' ? 'Activo' : 'Inactivo'),
                                        }))}
                                        strict
                                        required
                                        error={mostrarErrores && !formData.estado_equipo && "Obligatorio"}
                                    />
                                    )}
                                </div>
                                <div className={colSpanClass(6)} data-campo="nombre">
                                    <HybridSelect
                                        label={<FieldLabel label="Nombre del Equipo *" help="Modelo o nombre específico del equipo (ej: HI98194, YSI ProDSS) según catálogo." />}
                                        placeholder={esNuevoTipo ? 'Escriba el nombre del equipo nuevo' : 'Seleccione o escriba...'}
                                        value={formData.nombre}
                                        options={namesOptions}
                                        onChange={(val: any) => {
                                            const m = nameToMetadata[val?.trim()];
                                            setFormData((p: any) => ({
                                                ...p, nombre: val,
                                                tipo: m?.tipo || p.tipo,
                                                que_mide: m?.que_mide || p.que_mide,
                                                unidad_medida_textual: m?.unidad_medida_textual || p.unidad_medida_textual,
                                                unidad_medida_sigla: m?.unidad_medida_sigla || p.unidad_medida_sigla
                                            }));
                                        }}
                                        strict={false}
                                        sinSugerencias={esNuevoTipo}
                                        required
                                        error={mostrarErrores && !formData.nombre && "Obligatorio"}
                                    />
                                </div>
                                {nombreSinRegistrar && !esNuevoTipo && (
                                    <div className={cn('col-span-12 rounded-lg border p-3 text-sm md:order-none',
                                        esNuevoTipo ? 'border-primary/40 bg-primary/5' : 'border-warning/50 bg-warning/10')}>
                                        {!esNuevoTipo && (
                                            <>
                                                <p className="font-medium">«{String(formData.nombre).trim()}» no está registrado en el catálogo de equipos.</p>
                                                {nombresParecidos.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                                                        <span className="text-muted-foreground">¿Es alguno de estos?</span>
                                                        {nombresParecidos.map((nom) => (
                                                            <button key={nom} type="button"
                                                                className="rounded-full border border-border bg-background px-2.5 py-1 hover:border-primary hover:text-primary"
                                                                onClick={() => {
                                                                    const m = nameToMetadata[nom];
                                                                    setFormData((p: any) => ({ ...p, nombre: nom, tipo: m?.tipo || p.tipo, que_mide: m?.que_mide || p.que_mide, unidad_medida_textual: m?.unidad_medida_textual || p.unidad_medida_textual, unidad_medida_sigla: m?.unidad_medida_sigla || p.unidad_medida_sigla }));
                                                                }}>
                                                                Usar «{nom}»
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        <label className={cn('mt-2 flex items-start gap-2', puedeCrearTipo ? 'cursor-pointer' : 'cursor-not-allowed opacity-70', esNuevoTipo && 'mt-0')}>
                                            <Checkbox checked={esNuevoTipo} disabled={!puedeCrearTipo} onCheckedChange={(v) => setTipoNuevoMarcado(v === true)} className="mt-0.5" />
                                            <span>
                                                <span className="font-semibold">Registrar «{String(formData.nombre).trim()}» como tipo de equipo nuevo</span>
                                                <span className="block text-xs text-muted-foreground">
                                                    {puedeCrearTipo
                                                        ? 'Se define su sigla, qué mide y su control de fechas; queda en el catálogo para los siguientes equipos iguales.'
                                                        : 'Registrar tipos nuevos requiere el permiso «Nuevo Equipo: registrar un tipo de equipo nuevo». Elija un nombre del catálogo o pida a Calidad que lo registre.'}
                                                </span>
                                            </span>
                                        </label>
                                    </div>
                                )}
                                <div className={colSpanClass(esNuevoTipo ? 6 : 3)}>
                                    <div className="mb-1"><FieldLabel label="Sigla" help="Sigla identificadora que forma parte del código de barra del equipo (ej: MULTI, PH, TERM)." /></div>
                                    <div className="relative">
                                        <Input
                                            placeholder={esNuevoTipo ? 'Ej: COM' : 'Ej: PH'}
                                            value={formData.sigla}
                                            maxLength={esNuevoTipo ? 3 : undefined}
                                            onChange={(e) => {
                                                if (esNuevoTipo) siglaEditada.current = true;
                                                const v = esNuevoTipo ? e.target.value.replace(/[^A-Za-z]/g, '').slice(0, 3) : e.target.value;
                                                setFormData((p: any) => ({ ...p, sigla: v }));
                                            }}
                                            className={cn(generatingCode && 'pr-8', esNuevoTipo && errorSigla && (String(formData.sigla || '').trim() || mostrarErrores) && 'border-destructive', esNuevoTipo && 'font-mono font-semibold uppercase')}
                                        />
                                        {generatingCode && (
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                                <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className={cn(colSpanClass(3), esNuevoTipo && 'hidden')}>
                                    <div className="mb-1"><FieldLabel label="Correlativo" help="Número correlativo único de la unidad del equipo para diferenciarlo de otros del mismo tipo y sede." /></div>
                                    <Input
                                        type="number"
                                        value={formData.correlativo}
                                        onChange={(e) => setFormData((p: any) => ({ ...p, correlativo: e.target.value === '' ? null : Number(e.target.value) }))}
                                        disabled={!isSuper}
                                    />
                                </div>
                                {esNuevoTipo && (String(formData.sigla || '').trim() || mostrarErrores) && (
                                    <p className={cn('col-span-12 -mt-2 text-xs', errorSigla ? 'text-destructive' : 'text-muted-foreground')}>
                                        {errorSigla
                                            || (estadoSigla.sigla === String(formData.sigla).trim() && estadoSigla.disponible
                                                ? `Sigla ${formData.sigla} disponible. El tipo queda en el catálogo con esta sigla y los siguientes equipos iguales toman el correlativo automático.`
                                                : 'Sigla del tipo nuevo: 3 letras relevantes del equipo (la define Calidad y no se repite entre tipos).')}
                                    </p>
                                )}
                                {initialData?.id_equipo ? (
                                    <>
                                        <div className={colSpanClass(4)} data-campo="codigo">
                                            <div className="mb-1"><FieldLabel label="Código Final *" help="Código único de barra generado de forma automática para la identificación del equipo en terreno." /></div>
                                            <Input
                                                value={formData.codigo}
                                                readOnly={!isSuper}
                                                className={cn('font-bold', mostrarErrores && !formData.codigo && 'border-destructive')}
                                            />
                                            {formData.previousCode && <span className="text-xs text-muted-foreground">Anterior: {formData.previousCode}</span>}
                                            {mostrarErrores && !formData.codigo && <p className="text-xs text-destructive">Obligatorio</p>}
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
                                                    onClick={() => { setObsRevision(prefijoFechaHoy()); setShowRevisionConfirm(true); }}
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
                                        <div className={cn(colSpanClass(8), esNuevoTipo && "hidden")} data-campo="codigo">
                                            <div className="mb-1"><FieldLabel label="Código Final *" help="Código único de barra generado de forma automática para la identificación del equipo en terreno." /></div>
                                            <Input
                                                value={formData.codigo}
                                                readOnly={!isSuper}
                                                placeholder={esNuevoTipo ? 'Se arma con la sigla y la sede' : undefined}
                                                className={cn('font-bold', mostrarErrores && !formData.codigo && 'border-destructive')}
                                            />
                                            {esNuevoTipo && <span className="text-xs text-muted-foreground">Código automático: sigla + correlativo 01 + área MA + sede.</span>}
                                            {errorCodigoNuevo && !errorSigla && <span className="text-xs text-destructive">{errorCodigoNuevo}</span>}
                                            {formData.previousCode && <span className="text-xs text-muted-foreground">Anterior: {formData.previousCode}</span>}
                                            {mostrarErrores && !formData.codigo && <p className="text-xs text-destructive">Obligatorio</p>}
                                        </div>
                                        <div className={colSpanClass(4)}>
                                            <div className="mb-1"><FieldLabel label="Fecha Creación *" help="Fecha de creación del registro del equipo en el sistema. Por defecto es la fecha de hoy, pero puede modificarla si el equipo fue ingresado en otra fecha." /></div>
                                            <Input
                                                type="date"
                                                value={formData.ultima_verificacion}
                                                onChange={(e) => {
                                                    const nuevaFecha = e.target.value;
                                                    const next = mesesControl ? sumarMeses(nuevaFecha, mesesControl) : calculateNext90Days(nuevaFecha);
                                                    setFormData((p: any) => ({ ...p, ultima_verificacion: nuevaFecha, siguiente_verificacion: next, vigencia: next }));
                                                }}
                                                className={cn(mostrarErrores && !formData.ultima_verificacion && 'border-destructive')}
                                            />
                                            {mostrarErrores && !formData.ultima_verificacion && <p className="text-xs text-destructive">Se requiere una fecha de creación válida</p>}
                                        </div>
                                    </>
                                )}
                                <div className={colSpanClass(6)} data-campo="id_muestreador">
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
                                        className={cn(mostrarErrores && !formData.id_muestreador && 'border-destructive')}
                                    />
                                    {mostrarErrores && !formData.id_muestreador && <p className="text-xs text-destructive">Obligatorio</p>}
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
                            </div>
                            <div className={ver('tecnica')}>

                            <div className="grid grid-cols-12 gap-4">
                                <div className={colSpanClass(4)} data-campo="que_mide">
                                    <HybridSelect
                                        label={<FieldLabel label={esCreacion ? '¿Qué Mide? *' : '¿Qué Mide?'} help="Parámetro o variable física/química que mide el equipo (ej: pH, Conductividad, Oxígeno Disuelto, Temperatura)." />}
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
                                        error={mostrarErrores && esCreacion && !formData.que_mide && "Obligatorio"}
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
                                        {/* Al crear, en su lugar se pregunta «¿Requiere verificación?» (paso Verificación y vigencia):
                                            el factor de corrección sale de la Verificación de Temperatura, que un equipo nuevo aún no tiene. */}
                                        {!altaNueva && (
                                        <label className="flex items-center gap-2">
                                            <Checkbox
                                                checked={formData.tiene_fc === 'SI'}
                                                onCheckedChange={(checked) => setFormData((p: any) => ({ ...p, tiene_fc: checked ? 'SI' : 'NO' }))}
                                            />
                                            <FieldLabel label="Tiene Factor de Corrección" help="Indica si se debe aplicar una constante de corrección a los valores medidos por el equipo. Si está activo, el FC de cada punto (Error con signo invertido) aparece debajo de Error 0/15/30 y se calcula solo — no es editable directamente." />
                                        </label>
                                        )}
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
                                {!esCreacion && (
                                    <>
                                <div className={colSpanClass(4)}>
                                    <div className="mb-1"><FieldLabel label="Error 0" help="Desviación o error detectado en la medición del punto de calibración cero. Si 'Tiene Factor de Corrección' está activo, el FC (valor con signo invertido) se calcula y guarda automáticamente al guardar el equipo." /></div>
                                    <Input type="number" step="0.01" value={formData.error0} onChange={(e) => setFormData((p: any) => ({ ...p, error0: e.target.value === '' ? null : Number(e.target.value) }))} />
                                    {formData.tiene_fc === 'SI' && (
                                        <p className="mt-1 text-xs text-muted-foreground">FC: {formData.error0 === null || formData.error0 === '' ? '—' : (-Number(formData.error0)).toFixed(1)}</p>
                                    )}
                                </div>
                                <div className={colSpanClass(4)}>
                                    <div className="mb-1"><FieldLabel label="Error 15" help="Desviación o error detectado en la medición del punto de calibración intermedio (ej: 15°C o patrón intermedio). El FC correspondiente se calcula solo automáticamente al guardar." /></div>
                                    <Input type="number" step="0.01" value={formData.error15} onChange={(e) => setFormData((p: any) => ({ ...p, error15: e.target.value === '' ? null : Number(e.target.value) }))} />
                                    {formData.tiene_fc === 'SI' && (
                                        <p className="mt-1 text-xs text-muted-foreground">FC: {formData.error15 === null || formData.error15 === '' ? '—' : (-Number(formData.error15)).toFixed(1)}</p>
                                    )}
                                </div>
                                <div className={colSpanClass(4)}>
                                    <div className="mb-1"><FieldLabel label="Error 30" help="Desviación o error detectado en la medición del punto de calibración alto (ej: 30°C o patrón alto). El FC correspondiente se calcula solo automáticamente al guardar." /></div>
                                    <Input type="number" step="0.01" value={formData.error30} onChange={(e) => setFormData((p: any) => ({ ...p, error30: e.target.value === '' ? null : Number(e.target.value) }))} />
                                    {formData.tiene_fc === 'SI' && (
                                        <p className="mt-1 text-xs text-muted-foreground">FC: {formData.error30 === null || formData.error30 === '' ? '—' : (-Number(formData.error30)).toFixed(1)}</p>
                                    )}
                                </div>
                                    </>
                                )}
                                <div className="col-span-12" data-campo="observacion">
                                    <div className="mb-1"><FieldLabel label={esCreacion ? 'Observación *' : 'Observación'} help="Comentarios adicionales, historial de fallas, reparaciones o detalles relevantes del equipo." /></div>
                                    <textarea
                                        placeholder="Detalles sobre el equipo..."
                                        value={formData.observacion || ''}
                                        onChange={(e) => setFormData((p: any) => ({ ...p, observacion: e.target.value }))}
                                        // Al salir del campo se ordenan las líneas y, si es creación y trae fecha, sincroniza Fecha Creación
                                        onBlur={(e) => {
                                            const val = e.target.value;
                                            const ordenada = ordenarObservacion(val);
                                            const fObs = esCreacion ? extraerFechaObservacion(val) : null;
                                            if (fObs) {
                                                const next = mesesControl ? sumarMeses(fObs, mesesControl) : calculateNext90Days(fObs);
                                                setFormData((p: any) => ({
                                                    ...p,
                                                    observacion: ordenada,
                                                    ultima_verificacion: fObs,
                                                    // Un equipo nuevo no tiene vigencia hasta su Puesta en Marcha.
                                                    ...(altaNueva ? {} : { siguiente_verificacion: next, vigencia: next }),
                                                }));
                                            } else if (ordenada !== val.trim()) {
                                                setFormData((p: any) => ({ ...p, observacion: ordenada }));
                                            }
                                        }}
                                        rows={3}
                                        className={cn(
                                            'flex min-h-[72px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                                            mostrarErrores && esCreacion && !formData.observacion && 'border-destructive'
                                        )}
                                    />
                                    {mostrarErrores && esCreacion && !formData.observacion
                                        ? <p className="text-xs text-destructive">Obligatorio</p>
                                        : <p className="mt-1 text-xs text-muted-foreground">Al salir del campo, las líneas con fecha se ordenan. Si ingresó una fecha en la observación al crear, se toma como Fecha de Creación automáticamente.</p>}
                                </div>
                            </div>
                            </div>
                            <div className={ver('verif')}>

                            {faltaControlNuevo && reglasControl && (
                                <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-3" data-campo="modalidad_control">
                                    <div className="mb-2"><FieldLabel label="Control de fechas del tipo nuevo *" help="Qué revisión periódica lleva este tipo de equipo. Queda guardado en el catálogo para los siguientes equipos iguales." /></div>
                                    <div className="flex flex-wrap gap-2">
                                        {(Object.keys(reglasControl.modalidades) as ModalidadControl[]).map((m) => (
                                            <Button key={m} type="button" size="sm" variant="outline" onClick={() => setFormData((p: any) => ({ ...p, modalidad_control: m }))}>
                                                {reglasControl.modalidades[m].nombre}{reglasControl.modalidades[m].meses ? ` · cada ${reglasControl.modalidades[m].meses} meses` : ''}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {control && (
                                <div className="mb-4 rounded-md border bg-muted/30 p-3" data-campo="modalidad_control">
                                    <div className="mb-2"><FieldLabel label="Control de fechas del equipo" help="Qué revisión periódica lleva este equipo. Solo rige la que se elige: la otra no aplica ni genera vencimientos." /></div>
                                    {control.elegible ? (
                                        <div className="flex flex-wrap gap-2">
                                            {control.permitidas.map((m) => (
                                                <Button
                                                    key={m}
                                                    type="button"
                                                    size="sm"
                                                    variant={m === control.modalidad ? 'default' : 'outline'}
                                                    onClick={() => setFormData((p: any) => ({ ...p, modalidad_control: m }))}
                                                >
                                                    {reglasControl?.modalidades[m]?.nombre ?? m}
                                                    {reglasControl?.modalidades[m]?.meses ? ` · cada ${reglasControl.modalidades[m].meses} meses` : ''}
                                                </Button>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm">
                                            <span className="font-medium">{control.info.nombre}</span>
                                            {control.meses ? ` · cada ${control.meses} meses` : ''}
                                        </p>
                                    )}
                                    {esSinVencimiento && (
                                        <p className="mt-2 text-xs text-muted-foreground">Es un complemento: no tiene fecha de vencimiento. Solo se da de baja manualmente.</p>
                                    )}
                                </div>
                            )}
                            {altaNueva && (
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                                        <IconInfoCircle size={18} className="mt-0.5 shrink-0 text-primary" />
                                        <span>
                                            La vigencia se calcula sola al aprobar la <b>Puesta en Marcha</b>
                                            {control?.modalidad === 'CALIBRACION_ANUAL' ? ', desde la fecha del informe de calibración del proveedor'
                                                : control?.modalidad === 'VERIFICACION_TRIMESTRAL' ? ', con la Verificación de Temperatura que se firme después'
                                                    : esSinVencimiento ? ' (este tipo no vence)'
                                                        : mesesControl ? `: ${mesesControl} meses desde esa fecha` : ''}.
                                            {' '}Mientras tanto el equipo queda Fuera de Servicio.
                                        </span>
                                    </div>
                                    <div className="rounded-lg border border-border p-3">
                                        <p className="mb-2 text-sm font-medium">¿Qué requiere este equipo?</p>
                                        <div className="flex flex-col gap-2.5">
                                            {([
                                                ['puesta_marcha', '¿Requiere Puesta en Marcha?'],
                                                ['mantencion_anual', '¿Requiere Mantención anual?'],
                                            ] as const).map(([clave, texto]) => (
                                                <div key={clave} className="flex flex-wrap items-center justify-between gap-2">
                                                    <span className="text-sm">{texto}</span>
                                                    <div className="flex gap-1">
                                                        {[true, false].map((v) => (
                                                            <Button key={String(v)} type="button" size="sm" variant={requisitosAlta[clave] === v ? 'default' : 'outline'}
                                                                onClick={() => setRequisitosAlta((r) => ({ ...r, [clave]: v }))}>
                                                                {v ? 'Sí' : 'No'}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <span className="text-sm">¿Requiere verificación?</span>
                                                <div className="flex gap-1">
                                                    {[true, false].map((v) => (
                                                        <Button key={String(v)} type="button" size="sm" variant={(requisitosAlta.verificaciones.length > 0) === v ? 'default' : 'outline'}
                                                            onClick={() => setRequisitosAlta((r) => ({ ...r, verificaciones: v ? (r.verificaciones.length ? r.verificaciones : ['FUNCIONAMIENTO']) : [] }))}>
                                                            {v ? 'Sí' : 'No'}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                            {requisitosAlta.verificaciones.length > 0 && (
                                                <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-md bg-muted/40 p-3">
                                                    {TIPOS_VERIFICACION.map((t) => (
                                                        <label key={t.id} className="flex items-center gap-2 text-sm">
                                                            <Checkbox
                                                                checked={requisitosAlta.verificaciones.includes(t.id)}
                                                                onCheckedChange={(c) => setRequisitosAlta((r) => {
                                                                    const sin = r.verificaciones.filter((x) => x !== t.id);
                                                                    const lista = c ? [...sin, t.id] : sin;
                                                                    return { ...r, verificaciones: lista };
                                                                })}
                                                            />
                                                            {t.label}
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <p className="mt-2 text-xs text-muted-foreground">Certificados, manuales e informes se adjuntan en la Puesta en Marcha o al editar el equipo.</p>
                                    </div>
                                </div>
                            )}
                            {!altaNueva && requisitosGuardados && (
                                <div className="mb-4 rounded-md border bg-muted/30 p-3 text-sm">
                                    <p className="mb-1 font-medium">Requisitos definidos al crear el equipo</p>
                                    <p className="text-muted-foreground">
                                        Puesta en Marcha: {requisitosGuardados.puesta_marcha ? 'Sí' : 'No'} · Mantención anual: {requisitosGuardados.mantencion_anual ? 'Sí' : 'No'} · Verificación: {requisitosGuardados.verificaciones.length
                                            ? requisitosGuardados.verificaciones.map((v) => TIPOS_VERIFICACION.find((t) => t.id === v)?.label ?? v).join(', ')
                                            : 'No'}
                                    </p>
                                    {initialData?.pendiente_pm && <p className="mt-1 text-xs text-warning">Pendiente de su primera Puesta en Marcha: la vigencia se fija al aprobarla.</p>}
                                </div>
                            )}
                            <div className={cn('grid grid-cols-12 gap-4', (esSinVencimiento || altaNueva) && 'hidden')}>
                                <div className={colSpanClass(6)} data-campo="siguiente_verificacion">
                                    <div className="mb-1 inline-flex flex-wrap items-center gap-1.5">
                                        <FieldLabel label="Siguiente Revisión (Vigente hasta:) *" help={`Fecha programada para la próxima revisión técnica (${mesesControl ? `${control?.info.nombre}, cada ${mesesControl} meses` : 'por defecto 90 días'} después de la última). Corresponde también a la fecha de vigencia.`} />
                                        <span className="text-xs font-normal text-muted-foreground">
                                            {mesesControl ? `(Auto: Última + ${mesesControl} meses)` : '(Auto: Última + 90 días)'}
                                        </span>
                                    </div>
                                    <Input
                                        type="date"
                                        value={formData.siguiente_verificacion}
                                        onChange={(e) => setFormData((p: any) => ({ ...p, siguiente_verificacion: e.target.value }))}
                                        className={cn(mostrarErrores && !sinVigenciaPorPm && !formData.siguiente_verificacion && 'border-destructive')}
                                    />
                                    {mostrarErrores && !sinVigenciaPorPm && !formData.siguiente_verificacion && <p className="text-xs text-destructive">Obligatorio</p>}
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

                            </div>
                            <div className={ver('inventario')}>
<SectionDivider>Datos del Inventario</SectionDivider>
                            <div className="grid grid-cols-12 gap-4">
                                <div className={colSpanClass(4)}>
                                    <HybridSelect
                                        label={<FieldLabel label="Marca" help="Fabricante del equipo (columna MARCA del inventario OI-FoGe-21). Elija una de la lista o escriba una nueva." />}
                                        placeholder="Seleccione o escriba..."
                                        value={formData.marca || ''}
                                        options={opcionesInventario.marca}
                                        onChange={(val) => setFormData((p: Record<string, unknown>) => ({ ...p, marca: val || '' }))}
                                    />
                                </div>
                                <div className={colSpanClass(4)}>
                                    <HybridSelect
                                        label={<FieldLabel label="Modelo" help="Modelo del equipo según el fabricante. Elija uno de la lista o escriba uno nuevo." />}
                                        placeholder="Seleccione o escriba..."
                                        value={formData.modelo || ''}
                                        options={opcionesInventario.modelo}
                                        onChange={(val) => setFormData((p: Record<string, unknown>) => ({ ...p, modelo: val || '' }))}
                                    />
                                </div>
                                <div className={colSpanClass(4)}>
                                    <div className="mb-1"><FieldLabel label="N° de Serie" help="Número de serie del fabricante (S/N si no tiene)." /></div>
                                    <Input value={formData.n_serie || ''} onChange={(e) => setFormData((p: any) => ({ ...p, n_serie: e.target.value }))} />
                                </div>
                                <div className={colSpanClass(4)}>
                                    {influenciaDelTipo ? (
                                        <>
                                            <div className="mb-1"><FieldLabel label="Influencia Significativa" help="La define el tipo de equipo (hoja «Influencia» del inventario OI-FoGe-21): se completa sola." /></div>
                                            <Input value={influenciaDelTipo.influencia} readOnly className="cursor-default bg-muted/50" />
                                        </>
                                    ) : (
                                        <HybridSelect
                                            label={<FieldLabel label="Influencia Significativa" help="Cuánto influye el equipo en los resultados que se informan: Alta, Media o Baja." />}
                                            placeholder="Seleccione..."
                                            value={formData.influencia_significativa || null}
                                            options={INFLUENCIAS}
                                            onChange={(val: any) => setFormData((p: any) => ({ ...p, influencia_significativa: val || '' }))}
                                            strict
                                        />
                                    )}
                                </div>
                                <div className="col-span-12 md:col-span-8">
                                    <div className="mb-1"><FieldLabel label="Justificación" help={influenciaDelTipo ? 'La define el tipo de equipo: se completa sola.' : 'Por qué el equipo tiene esa influencia significativa (columna JUSTIFICACIÓN del inventario).'} /></div>
                                    <textarea
                                        value={formData.justificacion_influencia || ''}
                                        readOnly={!!influenciaDelTipo}
                                        onChange={(e) => setFormData((p: any) => ({ ...p, justificacion_influencia: e.target.value }))}
                                        rows={2}
                                        maxLength={1000}
                                        className={cn(
                                            'flex min-h-[56px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                                            influenciaDelTipo && 'cursor-default bg-muted/50',
                                        )}
                                    />
                                    {influenciaDelTipo && <p className="mt-1 text-xs text-muted-foreground">Definidas por el tipo «{nombreEnCatalogo?.nombre}».</p>}
                                </div>
                            </div>

                            <SectionDivider>Compra y Baja</SectionDivider>
                            <div className="grid grid-cols-12 gap-4">
                                <div className={colSpanClass(6)}>
                                    <HybridSelect
                                        label={<FieldLabel label="Proveedor" help="Empresa o distribuidor al que se le compró el equipo. Elija uno de la lista o escriba uno nuevo." />}
                                        placeholder="Seleccione o escriba..."
                                        value={formData.proveedor || ''}
                                        options={opcionesInventario.proveedor}
                                        onChange={(val) => setFormData((p: Record<string, unknown>) => ({ ...p, proveedor: val || '' }))}
                                    />
                                </div>
                                <div className={colSpanClass(6)}>
                                    <div className="mb-1"><FieldLabel label="Fecha de Compra" help="Fecha en que se adquirió el equipo." /></div>
                                    <Input type="date" value={formData.fecha_compra || ''} onChange={(e) => setFormData((p: any) => ({ ...p, fecha_compra: e.target.value }))} />
                                </div>
                                <div className={colSpanClass(4)}>
                                    <div className="mb-1"><FieldLabel label="Documento" help="Tipo de documento de la compra (ej: Factura, Guía de Despacho, Orden de Compra)." /></div>
                                    <Input value={formData.documento_compra || ''} onChange={(e) => setFormData((p: Record<string, unknown>) => ({ ...p, documento_compra: e.target.value }))} />
                                </div>
                                <div className={colSpanClass(4)} data-campo="n_documento_compra">
                                    <div className="mb-1"><FieldLabel label={esCreacion ? 'N° Documento *' : 'N° Documento'} help="Número de la factura u orden de compra del equipo. Es obligatorio al crear el equipo (lo ingresa Gestión de Calidad)." /></div>
                                    <Input value={formData.n_documento_compra || ''} placeholder={esCreacion ? 'N° de factura u orden de compra' : undefined}
                                        className={cn(mostrarErrores && esCreacion && !String(formData.n_documento_compra || '').trim() && 'border-destructive')}
                                        onChange={(e) => setFormData((p: any) => ({ ...p, n_documento_compra: e.target.value }))} />
                                </div>
                                <div className={colSpanClass(4)}>
                                    <div className="mb-1"><FieldLabel label="Valor Unitario" help="Precio de compra del equipo." /></div>
                                    <div className="relative">
                                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                                        <Input
                                            type="text"
                                            inputMode="numeric"
                                            className="pl-6"
                                            value={formData.valor_unitario === null || formData.valor_unitario === undefined || formData.valor_unitario === '' ? '' : Number(formData.valor_unitario).toLocaleString('es-CL')}
                                            onChange={(e) => {
                                                const raw = e.target.value.replace(/\D/g, '');
                                                setFormData((p: any) => ({ ...p, valor_unitario: raw === '' ? null : Number(raw) }));
                                            }}
                                        />
                                    </div>
                                </div>
                                {!esCreacion && (
                                <div className={colSpanClass(6)}>
                                    <div className="mb-1"><FieldLabel label="Fecha Dado de Baja" help="Fecha en que el equipo dejó de estar operativo, si corresponde." /></div>
                                    <Input type="date" value={formData.fecha_baja || ''} onChange={(e) => setFormData((p: any) => ({ ...p, fecha_baja: e.target.value }))} />
                                </div>
                                )}
                            </div>

                            </div>
                            <div className={ver('documento')}>
{/* --- Documento de la mantención (solo en edición) --- */}
                            {idEquipoActual && (
                                <>
                                    
                                    <div className="flex flex-col gap-3">
                                        <p className="text-[13px] text-muted-foreground">
                                            Adjunte el informe de la mantención, una foto del equipo intervenido o el certificado de calibración (PDF o imagen, hasta 20 MB). Queda asociado a esta revisión: al registrar la próxima, el informe actual pasa al historial junto con su versión.
                                        </p>

                                        {(formData.documento_ruta || docFile) ? (
                                            <Attachment size="sm">
                                                <AttachmentMedia>
                                                    <IconFile />
                                                </AttachmentMedia>
                                                <AttachmentContent>
                                                    <AttachmentTitle>{docFile ? docFile.name : (formData.documento_nombre || 'Documento')}</AttachmentTitle>
                                                    <AttachmentDescription>
                                                        {docFile
                                                            ? `Pendiente de guardar${formatearTamano(docTamano) ? ` · ${formatearTamano(docTamano)}` : ''}`
                                                            : [
                                                                formData.documento_fecha ? new Date(formData.documento_fecha).toLocaleDateString('es-CL') : '',
                                                                `Versión ${formData.version || 'vigente'}`
                                                            ].filter(Boolean).join(' · ')}
                                                    </AttachmentDescription>
                                                </AttachmentContent>
                                                <AttachmentActions>
                                                    {/* Solo se puede descargar lo ya guardado: un archivo recién
                                                        elegido todavía no está asociado al equipo. */}
                                                    {!docFile && (
                                                        <AttachmentAction
                                                            aria-label="Descargar documento"
                                                            title="Descargar"
                                                            disabled={docDescargando}
                                                            onClick={handleDescargarDoc}
                                                        >
                                                            {docDescargando
                                                                ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                                : <IconDownload size={14} />}
                                                        </AttachmentAction>
                                                    )}
                                                    <ProtectedContent permission="AI_MA_EDITAR_EQUIPO">
                                                        <AttachmentAction
                                                            aria-label="Quitar documento"
                                                            title="Quitar"
                                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                            onClick={handleQuitarDoc}
                                                        >
                                                            <IconTrash size={14} />
                                                        </AttachmentAction>
                                                    </ProtectedContent>
                                                </AttachmentActions>
                                            </Attachment>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">Esta revisión aún no tiene documento adjunto.</p>
                                        )}

                                        <ProtectedContent permission="AI_MA_EDITAR_EQUIPO">
                                            <div className="flex flex-wrap items-end gap-2">
                                                <div className="min-w-[180px] flex-1">
                                                    <input
                                                        ref={docFileInputRef}
                                                        type="file"
                                                        accept="application/pdf,image/*"
                                                        className="hidden"
                                                        onChange={(e) => handleSeleccionarDoc(e.target.files?.[0] ?? null)}
                                                    />
                                                    <div className="mb-1"><FieldLabel label="Archivo" help="Informe de mantención, foto del equipo o certificado. Formatos aceptados: PDF, JPG, PNG o WEBP." /></div>
                                                    <div className="relative">
                                                        <Input
                                                            readOnly
                                                            placeholder={formData.documento_ruta ? 'Seleccionar otro archivo...' : 'Seleccionar archivo...'}
                                                            value={docFile?.name ?? ''}
                                                            onClick={() => docFileInputRef.current?.click()}
                                                            className="cursor-pointer pr-8"
                                                        />
                                                        {docUploading
                                                            ? <span className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                                            : <IconPaperclip size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />}
                                                    </div>
                                                </div>
                                                <div className="min-w-[180px] flex-1">
                                                    <div className="mb-1"><FieldLabel label="Nombre del documento" help="Con qué nombre se verá en el listado de equipos. Si lo deja vacío, se usa el nombre del archivo." /></div>
                                                    <Input
                                                        placeholder="Ej: Informe mantención marzo"
                                                        value={docNombre}
                                                        onChange={(e) => {
                                                            setDocNombre(e.target.value);
                                                            // El título es parte del mismo guardado que la ruta.
                                                            if (formData.documento_ruta) {
                                                                setFormData((prev: any) => ({ ...prev, documento_nombre: e.target.value.trim() || docFile?.name || prev.documento_nombre }));
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </ProtectedContent>

                                        {docFile && (
                                            <p className="text-xs text-warning">
                                                El documento se guardará cuando presione {initialData?.id_equipo ? 'Actualizar' : 'Guardar'}.
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}

                            </div>
                            <div className={ver('cantidad')}>
                                <div className="rounded-lg border border-border bg-muted/30 p-4">
                                    <p className="mb-2 text-sm font-semibold">Resumen del equipo</p>
                                    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                                        {[
                                            ['Nombre', formData.nombre],
                                            ['Tipo', formData.tipo],
                                            ['Sede', formData.ubicacion],
                                            ['Estado', formData.estado_equipo],
                                            ['Código', formData.codigo],
                                            ['Responsable', muestreadores.find((m) => String(m.id_muestreador) === String(formData.id_muestreador))?.nombre_muestreador],
                                            ['¿Qué mide?', formData.que_mide],
                                            ['Siguiente revisión', formData.siguiente_verificacion ? formatDateToSpanish(formData.siguiente_verificacion) : ''],
                                        ].map(([k, v]) => (
                                            <div key={k} className="flex justify-between gap-3 border-b border-border/60 py-1">
                                                <dt className="text-muted-foreground">{k}</dt>
                                                <dd className="min-w-0 truncate text-right font-medium">{v || <span className="text-destructive">Falta</span>}</dd>
                                            </div>
                                        ))}
                                    </dl>
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
                                                <TableHead>N° Serie</TableHead>
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
                                                        {/* Cada unidad tiene su propia serie, aunque compartan tipo. La vigencia no va acá: nace con la Puesta en Marcha. */}
                                                        <Input
                                                            value={item.n_serie || ''}
                                                            placeholder="S/N"
                                                            onChange={(e) => {
                                                                const n = [...bulkItems];
                                                                n[idx].n_serie = e.target.value;
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

                    </PasosLayout>
                </div>
            </div>

            {/* --- Modals --- */}
            {/* Borrador de un equipo que quedó a medias */}
            <Dialog open={!!borradorPendiente} onOpenChange={() => { /* hay que elegir una opción */ }}>
                <DialogContent className="max-w-[460px] grid-cols-[minmax(0,1fr)] gap-4" showCloseButton={false} onInteractOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <IconHistory size={20} />
                            </span>
                            <div className="min-w-0 text-left">
                                <DialogTitle>Hay un equipo sin terminar</DialogTitle>
                                <DialogDescription className="mt-1">Lo que había llenado quedó guardado en este navegador.</DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    {borradorPendiente && (() => {
                        const d = borradorPendiente.formData || {};
                        const texto = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
                        const minutos = Math.max(0, Math.round((Date.now() - borradorPendiente.guardadoEn) / 60000));
                        const haceCuanto = minutos < 1 ? 'recién' : minutos < 60 ? `hace ${minutos} min`
                            : minutos < 60 * 24 ? `hace ${Math.round(minutos / 60)} h` : `hace ${Math.round(minutos / 1440)} día(s)`;
                        const filas: [string, string][] = [
                            ['Equipo', texto(d.nombre) || 'Sin nombre todavía'],
                            ['Tipo', texto(d.tipo)],
                            ['Código', texto(d.codigo)],
                            ['Sede', texto(d.ubicacion)],
                            ['Quedó en', PASOS_EQ[borradorPendiente.pasoActual]?.titulo || ''],
                        ].filter(([, v]) => v) as [string, string][];
                        return (
                            <div className="rounded-lg border border-border bg-muted/30 p-3">
                                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
                                    {filas.map(([k, v]) => (
                                        <React.Fragment key={k}>
                                            <dt className="text-muted-foreground">{k}</dt>
                                            <dd className="truncate font-medium" title={v}>{v}</dd>
                                        </React.Fragment>
                                    ))}
                                </dl>
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Guardado {haceCuanto} · {new Date(borradorPendiente.guardadoEn).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        );
                    })()}
                    <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={descartarBorrador}>
                            <IconTrash size={15} /> Descartar
                        </Button>
                        <Button onClick={continuarBorrador}>
                            Continuar donde quedé <IconArrowRight size={15} />
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showSaveConfirm} onOpenChange={(abrir) => { setShowSaveConfirm(abrir); if (!abrir) setObsActualizar(''); }}>
                {initialData?.id_equipo ? (
                    /* Actualizar un equipo: se ven todas las observaciones hasta ahora y se pide una nueva (obligatoria). */
                    <DialogContent className="max-w-[560px] grid-cols-[minmax(0,1fr)]">
                        <DialogHeader>
                            <DialogTitle>Actualizar equipo</DialogTitle>
                            <DialogDescription>
                                {formData.codigo ? `${formData.codigo}${formData.nombre ? ` · ${formData.nombre}` : ''}. ` : ''}Revise las observaciones que ya tiene y agregue la de esta actualización.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex min-w-0 flex-col gap-3">
                            <div>
                                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Observaciones hasta el momento</p>
                                {String(formData.observacion || '').trim() ? (
                                    <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2">
                                        {String(formData.observacion).split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l, i) => (
                                            <li key={i} className="whitespace-pre-wrap break-words rounded bg-background px-2 py-1 text-xs">{l}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-xs text-muted-foreground">Este equipo todavía no tiene observaciones.</p>
                                )}
                            </div>
                            <div>
                                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Observación de esta actualización <span className="text-destructive">*</span></p>
                                {/* La fecha de hoy ya viene escrita al comienzo (18.11.26) y no se puede borrar: se escribe a continuación. */}
                                <Textarea
                                    rows={3}
                                    autoFocus
                                    value={obsActualizar}
                                    onChange={(e) => setObsActualizar(conPrefijoFecha(e.target.value, prefijoFechaHoy()))}
                                    onFocus={(e) => { const n = e.target.value.length; e.target.setSelectionRange(n, n); }}
                                    placeholder="Ej.: 18.11.26 se corrigió la sede, cambio de responsable…"
                                    aria-required="true"
                                    className={textoSinPrefijo(obsActualizar, prefijoFechaHoy()).length < 3 ? 'border-destructive/50' : undefined}
                                />
                                <p className={textoSinPrefijo(obsActualizar, prefijoFechaHoy()).length < 3 ? 'mt-1 text-[11px] text-destructive' : 'mt-1 text-[11px] text-muted-foreground'}>
                                    {textoSinPrefijo(obsActualizar, prefijoFechaHoy()).length < 3 ? 'Obligatoria: escriba qué se cambió, después de la fecha, para poder actualizar.' : 'Se agrega a las observaciones del equipo tal como está escrita.'}
                                </p>
                            </div>
                        </div>
                        <DialogFooter className="sm:justify-stretch">
                            <Button variant="outline" className="flex-1" onClick={() => { setShowSaveConfirm(false); setObsActualizar(''); }}>No, revisar</Button>
                            <Button className="flex-1" disabled={textoSinPrefijo(obsActualizar, prefijoFechaHoy()).length < 3} onClick={() => { const t = obsActualizar; setObsActualizar(''); handleSave(t); }}>
                                <IconDeviceFloppy size={16} /> Actualizar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                ) : (
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
                            <Button className="flex-1" onClick={() => handleSave()}>Sí, confirmar</Button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>

            <Dialog open={showRevisionConfirm} onOpenChange={(abrir) => { setShowRevisionConfirm(abrir); if (!abrir) setObsRevision(''); }}>
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
                        <div>
                            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Observación <span className="text-destructive">*</span></p>
                            <Textarea
                                rows={3}
                                value={obsRevision}
                                onChange={(e) => setObsRevision(conPrefijoFecha(e.target.value, prefijoFechaHoy()))}
                                onFocus={(e) => { const n = e.target.value.length; e.target.setSelectionRange(n, n); }}
                                placeholder="Ej.: 18.11.26 se revisó el equipo y funciona según lo esperado…"
                                aria-required="true"
                                className={textoSinPrefijo(obsRevision, prefijoFechaHoy()).length < 3 ? 'border-destructive/50' : undefined}
                            />
                            <p className={textoSinPrefijo(obsRevision, prefijoFechaHoy()).length < 3 ? 'mt-1 text-[11px] text-destructive' : 'mt-1 text-[11px] text-muted-foreground'}>
                                {textoSinPrefijo(obsRevision, prefijoFechaHoy()).length < 3 ? 'Obligatoria: escriba qué se revisó, después de la fecha, para poder registrar.' : 'Se agrega a la observación del equipo tal como está escrita.'}
                            </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            * Al confirmar, se actualizará el estado temporal del equipo. Los cambios se guardarán definitivamente al presionar el botón "Actualizar" del formulario.
                        </p>
                    </div>
                    <DialogFooter className="sm:justify-stretch">
                        <Button variant="outline" className="flex-1" onClick={() => { setShowRevisionConfirm(false); setObsRevision(''); }}>
                            Cancelar
                        </Button>
                        <Button
                            className="flex-1"
                            disabled={textoSinPrefijo(obsRevision, prefijoFechaHoy()).length < 3}
                            onClick={() => {
                                handleSetToday();
                                // La observación obligatoria ya trae la fecha de hoy al comienzo.
                                const linea = obsRevision.trim();
                                setFormData((p: any) => ({ ...p, observacion: ordenarObservacion([String(p.observacion || '').trim(), linea].filter(Boolean).join('\n')) }));
                                setShowRevisionConfirm(false);
                                setObsRevision('');
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
                <DialogContent className="max-h-[88vh] max-w-[920px] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center gap-2">
                            <IconGitCompare size={20} className="text-primary" />
                            <DialogTitle>Comparar versiones</DialogTitle>
                        </div>
                    </DialogHeader>
                    {compareVersion && (() => {
                        // Si se compara la versión vigente, no tiene sentido contra sí
                        // misma: se muestra contra la versión inmediatamente anterior.
                        const esVigente = compareVersion.version === formData.version;
                        const numVersion = (v: any) => parseInt(String(v).replace(/\D/g, ''), 10) || 0;
                        const otras = history.filter((x: any) => x.version !== formData.version);
                        const anterior = esVigente
                            ? ([...otras]
                                .filter((x: any) => numVersion(x.version) < numVersion(formData.version))
                                .sort((x: any, y: any) => numVersion(y.version) - numVersion(x.version))[0] ?? otras[0] ?? null)
                            : compareVersion;
                        const filaVigente = history.find((x: any) => x.version === formData.version);
                        const fmtFecha = (v: any) => (v ? formatearFechaHoraCorta(String(v), true) : '');

                        if (!anterior) {
                            return (
                                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
                                    <IconInfoCircle size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">Sin versión anterior</p>
                                        <p className="text-sm text-muted-foreground">Esta es la primera versión registrada, no hay con qué compararla.</p>
                                    </div>
                                </div>
                            );
                        }

                        const secciones = buildComparison(anterior, formData, true);
                        const totalCambios = secciones.reduce((n, sec) => n + sec.filas.filter(f => f.cambio).length, 0);
                        const puedeHabilitar = anterior.version !== formData.version;

                        return (
                            <div className="flex flex-col gap-4">
                                <div className="grid grid-cols-1 items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr]">
                                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                                        <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Anterior</p>
                                        <p className="m-0 mt-0.5 text-base font-semibold text-foreground">{anterior.version}</p>
                                        <p className="m-0 text-xs text-muted-foreground">
                                            {anterior.nombre_usuario_cambio || 'Sistema'} · {fmtFecha(anterior.fecha_cambio)}
                                        </p>
                                    </div>
                                    <div className="hidden items-center justify-center text-muted-foreground sm:flex">
                                        <IconArrowRight size={18} />
                                    </div>
                                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                                        <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-primary">Actual</p>
                                        <p className="m-0 mt-0.5 text-base font-semibold text-foreground">{formData.version}</p>
                                        <p className="m-0 text-xs text-muted-foreground">
                                            {filaVigente ? `${filaVigente.nombre_usuario_cambio || 'Sistema'} · ${fmtFecha(filaVigente.fecha_cambio)}` : 'Datos actuales del equipo'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="m-0 text-sm text-muted-foreground">
                                        {totalCambios === 0
                                            ? 'Las dos versiones son idénticas.'
                                            : <><strong className="font-semibold text-foreground">{totalCambios}</strong> {totalCambios === 1 ? 'campo cambió' : 'campos cambiaron'}</>}
                                    </p>
                                    <div className="flex gap-1 rounded-lg bg-muted p-1">
                                        {([{ label: 'Todo', value: false }, { label: 'Solo cambios', value: true }] as const).map(opt => (
                                            <button
                                                key={opt.label}
                                                type="button"
                                                onClick={() => setCompareOnlyChanges(opt.value)}
                                                className={cn(
                                                    'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                                                    compareOnlyChanges === opt.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                                )}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-4">
                                    {secciones.map(sec => {
                                        const filas = compareOnlyChanges ? sec.filas.filter(f => f.cambio) : sec.filas;
                                        if (filas.length === 0) return null;
                                        return (
                                            <section key={sec.titulo}>
                                                <p className="mb-1.5 mt-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{sec.titulo}</p>
                                                <div className="overflow-hidden rounded-lg border border-border">
                                                    {filas.map((f, i) => (
                                                        <div
                                                            key={f.campo}
                                                            className={cn(
                                                                'grid grid-cols-2 gap-x-4 gap-y-1 px-3 py-2 text-sm sm:grid-cols-[180px_1fr_1fr]',
                                                                i > 0 && 'border-t border-border',
                                                                f.cambio && 'bg-primary/5'
                                                            )}
                                                        >
                                                            <span className="col-span-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground sm:col-span-1 sm:text-sm">
                                                                {f.cambio && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                                                                {f.campo}
                                                            </span>
                                                            <span className={cn('min-w-0 whitespace-pre-wrap break-words', f.cambio ? 'text-muted-foreground line-through decoration-muted-foreground/50' : 'text-foreground')}>
                                                                {f.anterior}
                                                            </span>
                                                            <span className={cn('min-w-0 whitespace-pre-wrap break-words', f.cambio ? 'font-semibold text-foreground' : 'text-foreground')}>
                                                                {f.actual}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </section>
                                        );
                                    })}
                                    {compareOnlyChanges && totalCambios === 0 && (
                                        <p className="m-0 py-4 text-center text-sm text-muted-foreground">No hay diferencias entre estas versiones.</p>
                                    )}
                                </div>

                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setCompareVersion(null)}>
                                        Cerrar
                                    </Button>
                                    {puedeHabilitar && (
                                        <Button
                                            onClick={() => {
                                                handleRestore(anterior);
                                                setCompareVersion(null);
                                            }}
                                        >
                                            Habilitar {anterior.version}
                                        </Button>
                                    )}
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

            <FichasEquipoDialog
                tipo={fichaAbierta}
                idEquipo={initialData?.id_equipo || null}
                // Lo que está en pantalla, aunque no se haya guardado todavía.
                equipo={{
                    ...formData,
                    valor_unitario: formData.valor_unitario === '' ? null : formData.valor_unitario,
                    nombre_asignado: muestreadores.find((m) => String(m.id_muestreador) === String(formData.id_muestreador))?.nombre_muestreador || '',
                }}
                onClose={() => setFichaAbierta(null)}
            />
        </div>
    );
};
