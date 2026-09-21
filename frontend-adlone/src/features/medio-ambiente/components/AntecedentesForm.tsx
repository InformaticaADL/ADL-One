import React, { useCallback, useEffect, useState, useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import type { LugarAnalisis, EmpresaServicio, Cliente, Contacto, Centro } from '../services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconInfoCircle,
    IconBuilding,
    IconMail,
    IconMapPin,
    IconFlask,
    IconCertificate,
    IconClock,
    IconAdjustmentsHorizontal,
    IconPlus,
    IconCheck,
    IconAlertTriangle,
    IconExternalLink
} from '@tabler/icons-react';
import { CreateEmpresaServicioModal } from './CreateEmpresaServicioModal';
import apiClient from '../../../config/axios.config';
import { FieldLabel } from '../../../components/common/FieldHelp';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Combobox } from '../../../components/ui/combobox';
import { Alert, AlertDescription } from '../../../components/ui/alert';
import { cn } from '../../../lib/utils';

// Validates a Google Maps reference string client-side before hitting the backend.
// Defined outside the component so it is never recreated on re-renders.
const validarRefGoogle = (valor: string): { valido: boolean; error?: string } => {
    if (!valor || !valor.trim()) return { valido: true }; // optional field
    const t = valor.trim().toLowerCase();
    if (t.length < 10) return { valido: false, error: 'El link debe tener al menos 10 caracteres.' };
    const basura = ['asd','aas','aaa','aasd','fdsg','fdsd','asds','ssdf','qwerty','noaplica','no aplica','maps','mapa','no hay','no tiene','n/a','na','null','undefined','pendiente','.','..','sin link','-'];
    if (basura.includes(t)) return { valido: false, error: 'Ingresa un link válido de Google Maps o coordenadas reales.' };
    if (!/[0-9.]/.test(t) && !t.includes('http') && !t.includes('goo.gl')) {
        return { valido: false, error: 'No se reconoce como link de Google Maps ni coordenadas.' };
    }
    const esUrl = t.includes('google.') || t.includes('goo.gl') || t.includes('maps.app');
    const esCoord = /^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(t);
    if (!esUrl && !esCoord) {
        return { valido: false, error: 'Debe ser una URL de Google Maps o coordenadas en formato: -41.45,-72.92' };
    }
    return { valido: true };
};

// Helper to dedup options
const dedupOptions = (options: { value: string; label: string }[]) => {
    const seen = new Set();
    return options.filter(opt => {
        const val = String(opt.value);
        if (seen.has(val)) return false;
        seen.add(val);
        return true;
    });
};

// Ancho de cada campo según lo que realmente contiene (un nombre de empresa
// necesita más espacio que "2019" o "19S") — en vez de una grilla pareja de
// N columnas fijas, cada fila es un flex-wrap y cada campo pide su propio
// ancho, así una fila cabe con 2 campos largos o con 5 campos cortos.
type FieldSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
// Cada tier define basis + grow + un tope de ancho. El grow en TODOS los
// tiers reparte el sobrante de la fila entre sus campos en proporción a su
// tamaño base, en vez de que se lo lleve entero el único campo con grow (lo
// que hacía que "Instrumento Ambiental" se viera enorme). El tope es solo
// una red de seguridad: las filas están armadas para llenar su ancho, así
// que en la práctica casi nunca se activa.
const FIELD_SIZE_CLASS: Record<FieldSize, string> = {
    xs: 'flex-[0.3_1_92px] max-w-[160px]',
    sm: 'flex-[0.6_1_120px] max-w-[260px]',
    md: 'flex-[0.9_1_170px] max-w-[360px]',
    lg: 'flex-[1.2_1_210px] max-w-[520px]',
    xl: 'flex-[1.8_1_260px] max-w-[760px]',
    full: 'flex-[1_1_100%] max-w-full',
};

// Fila flexible: los campos se envuelven a la siguiente línea según su
// tamaño real, no según un conteo fijo de columnas.
function Row({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn('flex flex-wrap items-end gap-4', className)}>{children}</div>;
}

// Extremely Fast Input Wrapper to isolate typing updates.
// Uses startTransition for the parent callback so AntecedentesForm (30+ states)
// only re-renders at low priority — the local input state updates immediately.
const TextInput = React.memo(({ value: parentValue, onChange, label, description, error, size, className, ...props }: any) => {
    const [localValue, setLocalValue] = useState(parentValue || '');

    // Sincronizar desde arriba sólo si difiere
    useEffect(() => {
        if (parentValue !== undefined && parentValue !== localValue) {
           setLocalValue(parentValue || '');
        }
    }, [parentValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value;
        setLocalValue(next);
        if (onChange) React.startTransition(() => onChange({ target: { value: next } } as any));
    };

    return (
        <div className={cn('min-w-0', size ? FIELD_SIZE_CLASS[size as FieldSize] : 'w-full', className)}>
            {label && <div className="mb-1.5">{typeof label === 'string' ? <span className="text-[13px] font-medium">{label}</span> : label}</div>}
            <Input
                value={localValue}
                onChange={handleChange}
                className={cn(error && 'border-destructive focus-visible:ring-destructive')}
                {...props}
            />
            {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
            {description && <p className="mt-1 text-[11px] text-muted-foreground">{description}</p>}
        </div>
    );
});

// Select con label arriba (mantiene la firma value/onChange/data de siempre) —
// implementado sobre Combobox (buscador integrado), reemplazo obligatorio de
// todo AntD Select según convención del proyecto.
const Select = ({ label, data, value, onChange, disabled, placeholder, size, rightSection, onDropdownOpen, error }: any) => {
    const options = (data || []).map((opt: any) => (typeof opt === 'string' ? { value: opt, label: opt } : { value: String(opt.value), label: opt.label }));
    return (
        <div className={cn('min-w-0', size ? FIELD_SIZE_CLASS[size as FieldSize] : 'w-full')}>
            {label && <div className="mb-1.5 flex items-center justify-between">{typeof label === 'string' ? <span className="text-[13px] font-medium">{label}</span> : label}</div>}
            <div className="flex items-center gap-1.5">
                <Combobox
                    className={cn('flex-1', error && 'border-destructive')}
                    options={options}
                    value={value || undefined}
                    onValueChange={(v) => onChange?.(v ?? null)}
                    disabled={disabled}
                    placeholder={placeholder}
                    onOpenChange={(open: boolean) => { if (open) onDropdownOpen?.(); }}
                />
                {rightSection}
            </div>
            {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}
        </div>
    );
};

// Module-level memoized component (avoids recreation on every parent render)
const StaticField = React.memo(({ label, value, icon: Icon, size }: { label: string, value: string, icon: any, size?: FieldSize }) => (
    <div className={cn('min-w-0', size ? FIELD_SIZE_CLASS[size] : 'w-full')}>
        <div className="mb-0.5 flex items-center gap-1">
            <Icon size={12} className="text-muted-foreground" />
            <span className="text-[11px] font-bold uppercase text-muted-foreground">{label}</span>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-1.5">
            <span className="block truncate text-[13.5px] font-medium" title={value}>{value || '-'}</span>
        </div>
    </div>
));

// Define interface for exposed methods
export interface AntecedentesFormHandle {
    getData: () => any;
}

// Tarjeta de bloque compartida — reemplaza Paper withBorder p="md" radius="lg".
function Block({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-border bg-background p-5">
            {children}
        </div>
    );
}

function BlockTitle({ icon: Icon, color, children }: { icon: any; color: string; children: React.ReactNode }) {
    return (
        <div className="mb-4 flex items-center gap-2">
            <Icon size={18} color={color} />
            <span className="text-[13px] font-semibold" style={{ color }}>{children}</span>
        </div>
    );
}

// Separador horizontal simple, con o sin etiqueta centrada — reemplaza AntD Divider.
function Divider({ label }: { label?: React.ReactNode }) {
    if (!label) return <div className="my-2 h-px w-full bg-border" />;
    return (
        <div className="my-2 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{label}</span>
            <div className="h-px flex-1 bg-border" />
        </div>
    );
}

function InlineAlert({ type, icon, children }: { type: 'success' | 'warning'; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <Alert variant={type} className={cn('py-2 text-xs', type === 'success' ? 'text-success' : 'text-warning')}>
            {icon}
            <AlertDescription className="text-xs text-current">{children}</AlertDescription>
        </Alert>
    );
}

interface SectionNavItem {
    id: string;
    label: string;
    icon: React.ElementType;
    complete: boolean;
}

// Índice lateral de las 4 secciones — cada punto pasa a "completo" (check
// verde) apenas se llenan sus campos obligatorios, sin forzar un orden: el
// usuario puede saltar libremente entre secciones haciendo click.
function SectionNav({ items, active, onNavigate, isMobile }: { items: SectionNavItem[]; active: string; onNavigate: (id: string) => void; isMobile: boolean }) {
    return (
        <div className={cn(
            'rounded-xl border border-border bg-card p-2',
            isMobile ? 'flex flex-row gap-1 overflow-x-auto' : 'sticky top-5 flex w-[220px] shrink-0 flex-col gap-1'
        )}>
            {items.map((item, idx) => {
                const Icon = item.icon;
                const isActive = active === item.id;
                return (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => onNavigate(item.id)}
                        className={cn(
                            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12.5px] font-semibold leading-snug transition-colors',
                            isMobile ? 'whitespace-nowrap' : 'whitespace-normal',
                            isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'
                        )}
                    >
                        <span className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold',
                            item.complete
                                ? 'border-success bg-success text-success-foreground'
                                : isActive ? 'border-primary text-primary' : 'border-border text-muted-foreground'
                        )}>
                            {item.complete ? <IconCheck size={11} /> : idx + 1}
                        </span>
                        <Icon size={14} className="mt-0.5 shrink-0 self-start" />
                        {!isMobile && <span className="min-w-0 flex-1">{item.label}</span>}
                    </button>
                );
            })}
        </div>
    );
}

export const AntecedentesForm = forwardRef<AntecedentesFormHandle, { initialData?: any, onValidationChange?: (isValid: boolean) => void }>((props, ref) => {
    const { initialData, onValidationChange } = props;
    const { hasPermission } = useAuth();
    const catalogos = useCachedCatalogos();
    const { showToast } = useToast();
    const isMobile = useMediaQuery('(max-width: 768px)');

    // Catalog State
    const [lugares, setLugares] = useState<LugarAnalisis[]>([]);
    const [empresas, setEmpresas] = useState<EmpresaServicio[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [contactos, setContactos] = useState<Contacto[]>([]);
    const [fuentesEmisoras, setFuentesEmisoras] = useState<Centro[]>([]);

    // Form State
    const [tipoMonitoreo, setTipoMonitoreo] = useState<string | null>(null);
    const [selectedLugar, setSelectedLugar] = useState<string | null>(null);
    const [selectedEmpresa, setSelectedEmpresa] = useState<string | null>(null);
    const [selectedCliente, setSelectedCliente] = useState<string | null>(null);
    const [selectedFuente, setSelectedFuente] = useState<string | null>(null);
    const [selectedContacto, setSelectedContacto] = useState<string | null>(null);

    // Auto-filled Address Fields
    const [ubicacion, setUbicacion] = useState<string>('');
    const [comuna, setComuna] = useState<string>('');
    const [region, setRegion] = useState<string>('');
    const [tipoAgua, setTipoAgua] = useState<string>('');
    const [codigo, setCodigo] = useState<string>('');

    // --- Block 2 State ---
    const [objetivos, setObjetivos] = useState<any[]>([]);
    const [selectedObjetivo, setSelectedObjetivo] = useState<string | null>(null);
    const [frecuencia, setFrecuencia] = useState<string>('');
    const [factor, setFactor] = useState<string>('1');
    const [periodo, setPeriodo] = useState<string | null>(null);
    const [frecuenciasOptions, setFrecuenciasOptions] = useState<any[]>([]);
    const [totalServicios, setTotalServicios] = useState<string>('');

    // --- Block 3 State ---
    const [zona, setZona] = useState<string | null>(null);
    const [utmNorte, setUtmNorte] = useState<string>('');
    const [utmEste, setUtmEste] = useState<string>('');
    const [selectedInstrumento, setSelectedInstrumento] = useState<string | null>(null);
    const [nroInstrumento, setNroInstrumento] = useState<string>('');
    const [anioInstrumento, setAnioInstrumento] = useState<string>('');
    const [instrumentosAmbientales, setInstrumentosAmbientales] = useState<any[]>([]);
    const [zonasUTMList, setZonasUTMList] = useState<any[]>([]);

    const [componentes, setComponentes] = useState<any[]>([]);
    const [selectedComponente, setSelectedComponente] = useState<string | null>(null);
    const [subAreas, setSubAreas] = useState<any[]>([]);
    const [selectedSubArea, setSelectedSubArea] = useState<string | null>(null);

    const [glosa, setGlosa] = useState<string>('');
    const [esETFA, setEsETFA] = useState<string>('No');
    const [inspectores, setInspectores] = useState<any[]>([]);
    const [selectedInspector, setSelectedInspector] = useState<string | null>(null);

    // --- Block 4 State ---
    const [responsableMuestreo, setResponsableMuestreo] = useState<string | null>('ADL');
    const [cargos, setCargos] = useState<any[]>([]);
    const [cargoResponsable, setCargoResponsable] = useState<string | null>(null);
    const [puntoMuestreo, setPuntoMuestreo] = useState<string>('');
    const [tiposMuestreo, setTiposMuestreo] = useState<any[]>([]);
    const [selectedTipoMuestreo, setSelectedTipoMuestreo] = useState<string | null>(null);
    const [tiposMuestra, setTiposMuestra] = useState<any[]>([]);
    const [selectedTipoMuestra, setSelectedTipoMuestra] = useState<string | null>(null);
    const [actividades, setActividades] = useState<any[]>([]);
    const [selectedActividad, setSelectedActividad] = useState<string | null>(null);
    const [duracion, setDuracion] = useState<string>('');
    const [tiposDescarga, setTiposDescarga] = useState<any[]>([]);
    const [selectedTipoDescarga, setSelectedTipoDescarga] = useState<string | null>(null);
    const [refGoogle, setRefGoogle] = useState<string>('');
    const [verifyStatus, setVerifyStatus] = useState<'idle' | 'loading' | 'ok' | 'warn' | 'invalid'>('idle');
    const [verifiedCoords, setVerifiedCoords] = useState<{ lat: number; lon: number } | null>(null);
    const [verifyError, setVerifyError] = useState<string>('');
    const [medicionCaudal, setMedicionCaudal] = useState<string | null>(null);
    const [modalidades, setModalidades] = useState<any[]>([]);
    const [selectedModalidad, setSelectedModalidad] = useState<string | null>(null);

    // --- Block 5 State ---
    const [formasCanal, setFormasCanal] = useState<any[]>([]);
    const [formaCanal, setFormaCanal] = useState<string | null>(null);
    const [detalleCanal, setDetalleCanal] = useState<string>('');
    const [dispositivos, setDispositivos] = useState<any[]>([]);
    const [dispositivo, setDispositivo] = useState<string | null>(null);
    const [detalleDispositivo, setDetalleDispositivo] = useState<string>('');
    const [unidadesMedida, setUnidadesMedida] = useState<any[]>([]);
    const [tipoMedidaCanal, setTipoMedidaCanal] = useState<string | null>(null);
    const [tipoMedidaDispositivo, setTipoMedidaDispositivo] = useState<string | null>(null);

    const [idTipoAgua, setIdTipoAgua] = useState<number | null>(null);
    const [createEmpresaOpened, setCreateEmpresaOpened] = useState(false);
    const isHydrating = useRef(!!initialData);
    const hasHydrated = useRef(false);

    // Índice lateral: qué sección está en pantalla (scrollspy) + refs para el scroll-to-section.
    const [activeSection, setActiveSection] = useState('ident');
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const scrollToSection = useCallback((id: string) => {
        sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) setActiveSection(entry.target.id.replace('ficha-sec-', ''));
                });
            },
            { rootMargin: '-15% 0px -70% 0px', threshold: 0 }
        );
        Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
        return () => observer.disconnect();
    }, []);

    // Validation Effect (debounced to avoid per-keystroke parent re-renders)
    useEffect(() => {
        const timer = setTimeout(() => {
            const requiredFields = [
                // Bloque 1
                tipoMonitoreo, selectedLugar, selectedCliente, selectedEmpresa, selectedFuente, selectedContacto,
                // Bloque 2
                selectedObjetivo, responsableMuestreo, cargoResponsable,
                puntoMuestreo, periodo, frecuencia, factor, totalServicios,
                // Bloque 3
                zona, utmNorte, utmEste,
                selectedInstrumento,
                selectedComponente, selectedSubArea, glosa,
                // Bloque 4
                selectedTipoMuestreo, selectedTipoMuestra, selectedActividad,
                selectedTipoDescarga, medicionCaudal
            ];

            // ✅ PUNTUAL: la duración no aplica (muestreo instantáneo de un solo día). Solo se exige en Compuesta.
            if (tipoMonitoreo !== 'Puntual') {
                requiredFields.push(duracion);
            }

            // F-01f: Número/Año de instrumento solo son obligatorios cuando el instrumento NO es "Otro" ni "No aplica"
            const instLow = (selectedInstrumento || '').toLowerCase();
            if (instLow !== 'otro' && instLow !== 'no aplica' && selectedInstrumento) {
                requiredFields.push(nroInstrumento, anioInstrumento);
            } else if (instLow === 'otro') {
                // Con "Otro" exigimos al menos el texto en Número
                requiredFields.push(nroInstrumento);
            }

            // Campos condicionales de Hidráulica (Bloque 5)
            // F-01a (regresión): detectar "No Aplica" case-insensitive y también vía label cuando el value es id de BD
            const isNA = (val: string | null, list?: any[]) => {
                if (!val) return true;
                const s = String(val).trim().toLowerCase();
                if (s === '' || s === 'no aplica' || s === 'noaplica' || s === 'n/a' || s === 'na') return true;
                if (list) {
                    const item = list.find(x => String(x.value) === String(val));
                    if (item && /no\s*aplica/i.test(String(item.label || ''))) return true;
                }
                return false;
            };
            if (medicionCaudal && !isNA(medicionCaudal)) {
                requiredFields.push(selectedModalidad);
                if (selectedModalidad && !isNA(selectedModalidad, modalidades)) {
                    requiredFields.push(formaCanal, dispositivo);
                    if (formaCanal && !isNA(formaCanal, formasCanal)) requiredFields.push(tipoMedidaCanal, detalleCanal);
                    if (dispositivo && !isNA(dispositivo, dispositivos)) requiredFields.push(tipoMedidaDispositivo, detalleDispositivo);
                }
            }

            const isValid = requiredFields.every(field => {
                if (field === null || field === undefined) return false;
                const s = String(field).trim();
                return s.length > 0 && s !== 'null' && s !== 'undefined';
            });

            if (onValidationChange) {
                onValidationChange(isValid);
            }
        }, 150);

        return () => clearTimeout(timer);
    }, [
        tipoMonitoreo, selectedLugar, selectedCliente, selectedEmpresa, selectedFuente, selectedContacto,
        selectedObjetivo, responsableMuestreo, cargoResponsable,
        puntoMuestreo, periodo, frecuencia, factor, totalServicios,
        zona, utmNorte, utmEste,
        selectedInstrumento, nroInstrumento, anioInstrumento,
        selectedComponente, selectedSubArea, glosa,
        selectedTipoMuestreo, selectedTipoMuestra, selectedActividad, duracion,
        selectedTipoDescarga, medicionCaudal,
        selectedModalidad, formaCanal, dispositivo, tipoMedidaCanal, detalleCanal, tipoMedidaDispositivo, detalleDispositivo,
        onValidationChange
    ]);

    // Initial Data Hydration
    useEffect(() => {
        if (initialData && !hasHydrated.current) {
            isHydrating.current = true;

            setTipoMonitoreo(initialData.tipoMonitoreo || null);
            setSelectedLugar(String(initialData.selectedLugar ?? ''));
            setSelectedEmpresa(String(initialData.selectedEmpresa ?? ''));
            setSelectedCliente(String(initialData.selectedCliente ?? ''));
            setSelectedFuente(String(initialData.selectedFuente ?? ''));
            setSelectedContacto(String(initialData.selectedContacto ?? ''));
            setSelectedObjetivo(String(initialData.selectedObjetivo ?? ''));
            setUbicacion(initialData.ubicacion || '');
            setComuna(initialData.comuna || '');
            setRegion(initialData.region || '');
            setTipoAgua(initialData.tipoAgua || '');
            setIdTipoAgua(initialData.idTipoAgua ?? null);
            setCodigo(initialData.codigo || '');
            setGlosa(initialData.glosa || '');
            setEsETFA(initialData.esETFA || 'No');
            setPuntoMuestreo(initialData.puntoMuestreo || '');
            setZona(initialData.zona || null);
            setUtmNorte(initialData.utmNorte || '');
            setUtmEste(initialData.utmEste || '');
            setSelectedComponente(String(initialData.selectedComponente ?? ''));
            setSelectedSubArea(String(initialData.selectedSubArea ?? ''));
            setSelectedInstrumento(initialData.selectedInstrumento || null);
            setNroInstrumento(initialData.nroInstrumento || '');
            setAnioInstrumento(initialData.anioInstrumento || '');
            setSelectedInspector(String(initialData.selectedInspector ?? ''));
            setResponsableMuestreo(initialData.responsableMuestreo || 'ADL');
            setCargoResponsable(String(initialData.cargoResponsable ?? ''));
            setSelectedTipoMuestreo(String(initialData.selectedTipoMuestreo ?? ''));
            setSelectedTipoMuestra(String(initialData.selectedTipoMuestra ?? ''));
            setSelectedActividad(String(initialData.selectedActividad ?? ''));
            setDuracion(initialData.duracion || '');
            setSelectedTipoDescarga(String(initialData.selectedTipoDescarga ?? ''));
            setRefGoogle(initialData.refGoogle || '');
            setMedicionCaudal(initialData.medicionCaudal || null);
            setSelectedModalidad(String(initialData.selectedModalidad ?? ''));
            setFormaCanal(String(initialData.formaCanal ?? ''));
            setDetalleCanal(initialData.detalleCanal || '');
            setDispositivo(String(initialData.dispositivo ?? ''));
            setDetalleDispositivo(initialData.detalleDispositivo || '');
            setTipoMedidaCanal(initialData.tipoMedidaCanal ? String(initialData.tipoMedidaCanal) : null);
            setTipoMedidaDispositivo(initialData.tipoMedidaDispositivo ? String(initialData.tipoMedidaDispositivo) : null);
            setFrecuencia(String(initialData.frecuencia ?? ''));
            setFactor(String(initialData.factor ?? '1'));
            setPeriodo(String(initialData.periodo ?? ''));
            setTotalServicios(String(initialData.totalServicios ?? ''));

            hasHydrated.current = true;
        }
    }, [initialData]);

    // Reset verification state when user edits the link
    useEffect(() => {
        if (verifyStatus !== 'idle') {
            setVerifyStatus('idle');
            setVerifiedCoords(null);
            setVerifyError('');
        }
    }, [refGoogle]);

    const handleVerifyLink = useCallback(async () => {
        const link = refGoogle.trim();
        if (!link) return;
        const validacion = validarRefGoogle(link);
        if (!validacion.valido) {
            setVerifyStatus('invalid');
            setVerifyError(validacion.error || 'Link inválido.');
            setVerifiedCoords(null);
            return;
        }
        setVerifyStatus('loading');
        setVerifiedCoords(null);
        setVerifyError('');
        try {
            const { data } = await apiClient.post('/api/fichas/verificar-link', { link });
            if (data?.data?.ok) {
                setVerifyStatus('ok');
                setVerifiedCoords({ lat: data.data.lat, lon: data.data.lon });
            } else {
                setVerifyStatus('warn');
                setVerifyError('No pudimos extraer coordenadas de este link. La ficha se guardará igual, pero no aparecerá en el cálculo de ruta.');
            }
        } catch {
            setVerifyStatus('warn');
            setVerifyError('No se pudo verificar el link ahora. Puedes guardar igual.');
        }
    }, [refGoogle]);

    // Handle Legacy Unit extraction from string
    useEffect(() => {
        if (unidadesMedida.length > 0) {
            const isUnitEmpty = (u: any) => !u || String(u) === '0' || String(u) === '-1' || String(u) === 'null';
            const normalize = (s: string) => s.trim().toUpperCase().replace(/Μ|µ/g, 'U').replace(/\s+/g, '');
            const sortedUnits = [...unidadesMedida].sort((a,b) => b.label.length - a.label.length);

            if (typeof detalleCanal === 'string' && detalleCanal.trim()) {
                const det = normalize(detalleCanal);
                const match = sortedUnits.find(u => u.label !== 'No Aplica' && u.label !== '-' && det.endsWith(normalize(u.label)));
                if (match) {
                    if (isUnitEmpty(tipoMedidaCanal)) setTipoMedidaCanal(match.value);
                    const regex = new RegExp(match.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
                    const withoutStr = detalleCanal.replace(regex, '').trim();
                    if (withoutStr === detalleCanal) { // fallback
                         if (detalleCanal !== detalleCanal.slice(0, -match.label.length).trim()) setDetalleCanal(detalleCanal.slice(0, -match.label.length).trim());
                    } else if (detalleCanal !== withoutStr) {
                         setDetalleCanal(withoutStr);
                    }
                }
            }
            if (typeof detalleDispositivo === 'string' && detalleDispositivo.trim()) {
                const det = normalize(detalleDispositivo);
                const match = sortedUnits.find(u => u.label !== 'No Aplica' && u.label !== '-' && det.endsWith(normalize(u.label)));
                if (match) {
                    if (isUnitEmpty(tipoMedidaDispositivo)) setTipoMedidaDispositivo(match.value);
                    const regex = new RegExp(match.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
                    const withoutStr = detalleDispositivo.replace(regex, '').trim();
                    if (withoutStr === detalleDispositivo) { // fallback
                         if (detalleDispositivo !== detalleDispositivo.slice(0, -match.label.length).trim()) setDetalleDispositivo(detalleDispositivo.slice(0, -match.label.length).trim());
                    } else if (detalleDispositivo !== withoutStr) {
                         setDetalleDispositivo(withoutStr);
                    }
                }
            }
        }
    }, [unidadesMedida, tipoMedidaCanal, detalleCanal, tipoMedidaDispositivo, detalleDispositivo]);

    // Handle Legacy string-to-ID conversion for Frecuencia Periodo
    useEffect(() => {
        if (frecuenciasOptions.length > 0 && typeof periodo === 'string' && isNaN(Number(periodo)) && periodo !== 'No Aplica') {
            const match = frecuenciasOptions.find(f => f.nombre?.toLowerCase() === periodo.toLowerCase().trim());
            if (match) {
                setPeriodo(String(match.id));
            }
        }
    }, [frecuenciasOptions, periodo]);

    useImperativeHandle(ref, () => ({
        getData: () => {
            const contactoObj = contactos.find(c => String(c.id) === selectedContacto);
            const empresaObj = empresas.find(e => String(e.id) === selectedEmpresa);
            let finalContactoNombre = '';
            if (contactoObj) {
                finalContactoNombre = contactoObj.nombre;
            } else if (selectedContacto === 'primary' && empresaObj) {
                finalContactoNombre = empresaObj.contacto || '';
            }

            return {
                tipoMonitoreo: tipoMonitoreo || '',
                selectedLugar: selectedLugar || '',
                selectedEmpresa: selectedEmpresa || '',
                selectedCliente: selectedCliente || '',
                selectedFuente: selectedFuente || '',
                tipoAgua: tipoAgua || '',
                idTipoAgua,
                selectedObjetivo: selectedObjetivo || '',
                glosa: glosa || '',
                esETFA: esETFA || '',
                puntoMuestreo: puntoMuestreo || '',
                zona: zona || '',
                utmNorte: utmNorte || '',
                utmEste: utmEste || '',
                selectedComponente: selectedComponente || '',
                selectedSubArea: selectedSubArea || '',
                selectedTipoDescarga: selectedTipoDescarga || '',
                selectedContacto: selectedContacto || '',
                contactoNombre: finalContactoNombre,
                selectedTipoMuestreo: selectedTipoMuestreo || '',
                selectedTipoMuestra: selectedTipoMuestra || '',
                selectedActividad: selectedActividad || '',
                duracion: duracion || '',
                refGoogle: refGoogle || '',
                medicionCaudal: medicionCaudal || '',
                selectedModalidad: selectedModalidad || '',
                responsableMuestreo: responsableMuestreo || '',
                cargoResponsable: cargoResponsable || '',
                selectedInspector: selectedInspector || '',
                detalleCanal: (() => {
                    if (!detalleCanal || detalleCanal === 'No Aplica') return detalleCanal;
                    const unit = unidadesMedida.find(u => String(u.id) === String(tipoMedidaCanal))?.nombre;
                    if (unit && !String(detalleCanal).endsWith(unit)) return `${detalleCanal}${unit}`;
                    return detalleCanal;
                })(),
                detalleDispositivo: (() => {
                    if (!detalleDispositivo || detalleDispositivo === 'No Aplica') return detalleDispositivo;
                    const unit = unidadesMedida.find(u => String(u.id) === String(tipoMedidaDispositivo))?.nombre;
                    if (unit && !String(detalleDispositivo).endsWith(unit)) return `${detalleDispositivo}${unit}`;
                    return detalleDispositivo;
                })(),
                formaCanal,
                tipoMedidaCanal,
                dispositivo,
                tipoMedidaDispositivo,
                frecuencia,
                factor,
                periodo,
                totalServicios,
                ubicacion,
                comuna,
                region,
                selectedInstrumento,
                nroInstrumento,
                anioInstrumento
            };
        }
    }));

    // Cascade Effects (Maintained from original)
    useEffect(() => {
        if (isHydrating.current) return;
        if (!tipoMonitoreo) setSelectedLugar(null);
        // ✅ PUNTUAL: muestreo instantáneo (un solo día) → la duración no aplica, se fija en 0.
        if (tipoMonitoreo === 'Puntual') setDuracion('0');
    }, [tipoMonitoreo]);

    // 2. EMPRESA CASCADE
    const handleEmpresaChange = (v: string | null) => {
        setSelectedEmpresa(v || '');
        if (isHydrating.current) return;

        // Reset dependents
        setFuentesEmisoras([]);
        setSelectedFuente(null);
        setContactos([]);
        setSelectedContacto(null);
        setObjetivos([]);
        setSelectedObjetivo(null);

        if (v && v !== 'No Aplica') {
            const idS = Number(v);
            loadFuentesEmisoras(undefined, idS);
            loadContactos(undefined, idS);
            loadObjetivos(undefined, idS);
        }
    };

    const handleComponenteChange = (val: string | null) => {
        setSelectedComponente(val || '');
        if (isHydrating.current) return;
        setSubAreas([]);
        setSelectedSubArea(null);
        if (val && val !== 'No Aplica') loadSubAreas(val);
    };

    const handleTipoMuestreoChange = (val: string | null) => {
        setSelectedTipoMuestreo(val || '');
        if (isHydrating.current) return;
        setTiposMuestra([]);
        setSelectedTipoMuestra(null);
        if (val && val !== 'No Aplica') loadTiposMuestra(val);
    };

    const handleTipoMuestraChange = (val: string | null) => {
        setSelectedTipoMuestra(val || '');
        if (isHydrating.current) return;
        setActividades([]);
        setSelectedActividad(null);
        if (val && val !== 'No Aplica') loadActividades(val);
    };

    useEffect(() => {
        if (selectedFuente) {
            const fuente = fuentesEmisoras.find(f => f.id.toString() === selectedFuente);
            if (fuente) {
                setUbicacion(fuente.direccion || fuente.ubicacion || '');
                setComuna(fuente.comuna || fuente.nombre_comuna || '');
                setRegion(fuente.region || fuente.nombre_region || '');
                setTipoAgua(fuente.tipo_agua || '');
                const fuenteAny = fuente as any;
                setIdTipoAgua(fuenteAny.id_tipoagua || fuenteAny.IdTipoAgua || fuenteAny.ID_TIPOAGUA || null);
                setCodigo(fuente.codigo || '');
            }
        } else if (!initialData) {
            setUbicacion(''); setComuna(''); setRegion(''); setTipoAgua(''); setCodigo('');
        }
    }, [selectedFuente, fuentesEmisoras]);

    // Data Loaders (Maintained from original)
    const loadLugares = async () => {
        try {
            const data = await catalogos.getLugaresAnalisis();
            setLugares(data.map((item: any) => ({
                id: item.id_lugaranalisis || item.IdLugarAnalisis || item.ID || item.id,
                nombre: item.nombre_lugaranalisis || item.NombreLugar || item.Nombre || item.nombre
            })));
        } catch { /* noop */ }
    };

    const loadEmpresas = async () => {
        try {
            const data = await catalogos.getEmpresasServicio();
            setEmpresas(data.map((item: any) => ({
                id: item.id_empresaservicio,
                nombre: item.nombre_empresaservicios,
                email: item.email_empresaservicios || item.email || '',
                contacto: item.contacto_empresaservicios || '',
                email_contacto: item.email_contacto || ''
            })));
        } catch { /* noop */ }
    };

    const loadClientes = async () => {
        try {
            const data = await catalogos.getClientes();
            setClientes(data.map((item: any) => ({
                id: item.id_empresa,
                nombre: item.nombre_empresa,
                email: item.email_empresa || '',
                id_empresaservicio: item.id_empresaservicio || 0
            })));
        } catch { /* noop */ }
    };

    const loadContactos = async (clienteId?: number, empresaServicioId?: number) => {
        try {
            const data = await catalogos.getContactos(clienteId, empresaServicioId);
            setContactos(data.map((item: any) => ({
                id: item.id_contacto || item.id,
                nombre: item.nombre_contacto || item.nombre || item.nombres || item.nombre_persona,
                email: item.email || item.email_contacto,
                telefono: item.telefono || item.fono_contacto
            })));
        } catch { /* noop */ }
    };

    const loadFuentesEmisoras = async (clienteId?: number, empresaServicioId?: number) => {
        try {
            const data = await catalogos.getCentros(clienteId, empresaServicioId);
            const mapped = data.map((item: any) => ({
                id: item.id_centro || item.id,
                nombre: item.nombre_centro || item.nombre,
                direccion: item.direccion || item.ubicacion,
                comuna: item.nombre_comuna || item.comuna,
                region: item.nombre_region || item.region,
                tipo_agua: item.tipo_agua || item.TipoAgua || item.tipoagua || item.nombre_tipoagua,
                id_tipoagua: item.id_tipoagua || item.IdTipoAgua || item.ID_TIPOAGUA,
                codigo: item.codigo_centro || item.codigo || item.codigo_ma
            }));
            setFuentesEmisoras(mapped);
            if (!isHydrating.current && mapped.length > 0) setSelectedFuente(String(mapped[0].id));
        } catch { /* noop */ }
    };

    const loadObjetivos = async (clienteId?: number, empresaServicioId?: number) => {
        try {
            const data = await catalogos.getObjetivosMuestreo(clienteId, empresaServicioId);
            setObjetivos((data || []).map((o: any) => ({
                id: o.id_objetivomuestreo_ma || o.id,
                nombre: o.nombre_objetivomuestreo_ma || o.nombre
            })));
        } catch { /* noop */ }
    };

    const loadSubAreas = async (componenteId: string) => {
        try {
            const data = await catalogos.getSubAreas(componenteId);
            setSubAreas((data || []).map((s: any) => ({
                id: s.id_subarea || s.id,
                nombre: s.nombre_subarea || s.nombre
            })));
        } catch { /* noop */ }
    };

    const loadTiposMuestra = async (tipoMuestreoId: string) => {
        try {
            const data = await catalogos.getTiposMuestra(tipoMuestreoId);
            setTiposMuestra(data || []);
        } catch { /* noop */ }
    };

    const loadActividades = async (tipoMuestraId: string) => {
        try {
            const data = await catalogos.getActividadesMuestreo(tipoMuestraId);
            setActividades(data || []);
        } catch { /* noop */ }
    };

    const loadCatalogosComplementarios = async () => {
        try {
            const [comps, insp, tMuestreo, tDescarga, mods, instrs, umeds, cargosList, freqsList, formasCanalList, dispositivosList, zonasUTMListRes] = await Promise.all([
                catalogos.getComponentesAmbientales(), catalogos.getInspectores(), catalogos.getTiposMuestreo(),
                catalogos.getTiposDescarga(), catalogos.getModalidades(), catalogos.getInstrumentosAmbientales(),
                catalogos.getUnidadesMedida(), catalogos.getCargos(), catalogos.getFrecuenciasPeriodo(),
                catalogos.getFormasCanal(), catalogos.getDispositivosHidraulicos(), catalogos.getZonasUTM()
            ]);

            setUnidadesMedida((umeds || []).map((u: any) => ({ value: String(u.id_umedida || u.id || ''), label: u.nombre_umedida || u.nombre || '-' })).filter(u => u.label !== 'NA' && u.label !== 'No Aplica'));
            setZonasUTMList((zonasUTMListRes || []).map((z: any) => ({ value: z.nombre_zonautm, label: z.nombre_zonautm })));
            setComponentes((comps || []).map((c: any) => ({ value: String(c.id_tipomuestra || c.id), label: c.nombre_tipomuestra || c.nombre })));
            setInspectores((insp || []).map((i: any) => ({ value: String(i.id_inspectorambiental || i.id), label: i.nombre_inspector || i.nombre })));
            setTiposMuestreo((tMuestreo || []).map((t: any) => ({ value: String(t.id_tipomuestreo || t.id), label: t.nombre_tipomuestreo || t.nombre })));
            setTiposDescarga((tDescarga || []).map((t: any) => ({ value: String(t.id || t.id_tipodescarga), label: t.nombre || t.nombre_tipodescarga })));
            setModalidades((mods || []).map((m: any) => ({ value: String(m.id_modalidad || m.id), label: m.nombre_modalidad || m.nombre })));
            setInstrumentosAmbientales((instrs || []).map((i: any) => ({ value: i.nombre, label: i.nombre })));
            setCargos((cargosList || []).map((c: any, index: number) => ({ id: String(c.id_cargo || c.id || `cargo-${index}`), nombre: c.nombre_cargo || 'Sin Nombre', cliente: c.cliente })));
            setFrecuenciasOptions((freqsList || []).map((f: any, index: number) => ({ id: String(f.id_frecuencia || f.id_frecuenciaperiodo || f.id || `freq-${index}`), nombre: f.nombre_frecuencia || f.nombre, cantidad: f.cantidad, multiplicadopor: f.multiplicadopor })));
            setFormasCanal((formasCanalList || []).map((f: any) => ({ value: String(f.id_formacanal || f.id), label: f.nombre_formacanal || f.nombre })));
            setDispositivos((dispositivosList || []).map((d: any) => ({ value: String(d.id_dispositivohidraulico || d.id), label: d.nombre_dispositivohidraulico || d.nombre })));

            if (isHydrating.current && initialData) {
                const depLoads: Promise<any>[] = [];
                if (initialData.selectedEmpresa && initialData.selectedEmpresa !== 'No Aplica') depLoads.push(loadFuentesEmisoras(undefined, Number(initialData.selectedEmpresa)), loadContactos(undefined, Number(initialData.selectedEmpresa)), loadObjetivos(undefined, Number(initialData.selectedEmpresa)));
                if (initialData.selectedComponente) depLoads.push(loadSubAreas(String(initialData.selectedComponente)));
                if (initialData.selectedTipoMuestreo) depLoads.push(loadTiposMuestra(String(initialData.selectedTipoMuestreo)));
                if (initialData.selectedTipoMuestra) depLoads.push(loadActividades(String(initialData.selectedTipoMuestra)));
                await Promise.all(depLoads);
                isHydrating.current = false;
            } else { isHydrating.current = false; }
        } catch { /* noop */ }
    };

    useEffect(() => {
        loadLugares(); loadEmpresas(); loadClientes(); loadCatalogosComplementarios();
    }, []);

    // Memoized Select Data for Performance
    const filteredCargosMemo = useMemo(() => {
        if (responsableMuestreo === 'ADL') return cargos; // show all cargos; auto-fill selects the right one
        if (responsableMuestreo === 'Cliente') return cargos.filter(c => c.cliente === 'S' || c.cliente === true);
        return cargos;
    }, [cargos, responsableMuestreo]);

    // F-01e: opción "No Aplica" eliminada del hardcoding. Si un campo debe permitirla, debe
    // configurarse en el maestro correspondiente.
    const lugaresData = useMemo(() => lugares.map(l => ({ value: String(l.id), label: l.nombre })), [lugares]);
    // F-01a (regresión): helper para detectar "No Aplica" robusto (por value vacío o por label del registro)
    const isNoAplicaValue = (val: string | null | undefined, list?: any[]) => {
        if (val === null || val === undefined) return true;
        const s = String(val).trim().toLowerCase();
        if (s === '' || s === 'no aplica' || s === 'noaplica' || s === 'n/a' || s === 'na' || s === 'null' || s === 'undefined') return true;
        if (list && list.length) {
            const item = list.find((x: any) => String(x.value ?? x.id) === String(val));
            if (item && /no\s*aplica/i.test(String(item.label || item.nombre || ''))) return true;
        }
        return false;
    };

    const clientesData = useMemo(() => clientes.filter(c => c.nombre && c.nombre.trim().toLowerCase() !== 'no aplica').map(c => ({ value: String(c.id), label: c.nombre })), [clientes]);
    const empresasData = useMemo(() => empresas.filter(e => e.nombre && e.nombre.trim().toLowerCase() !== 'no aplica').map(e => ({ value: String(e.id), label: e.nombre })), [empresas]);
    const fuentesData = useMemo(() => fuentesEmisoras.map(f => ({ value: String(f.id), label: f.nombre })), [fuentesEmisoras]);
    const objetivosData = useMemo(() => dedupOptions(objetivos.map(o => ({ value: String(o.id), label: o.nombre }))), [objetivos]);
    const cargosData = useMemo(() => dedupOptions(filteredCargosMemo.map(c => ({ value: String(c.id), label: c.nombre }))), [filteredCargosMemo]);
    const frecuenciasData = useMemo(() => dedupOptions(frecuenciasOptions.map(f => ({ value: String(f.id), label: f.nombre }))), [frecuenciasOptions]);
    const componentesData = useMemo(() => componentes, [componentes]);
    const subAreasData = useMemo(() => subAreas.map(s => ({ value: String(s.id), label: s.nombre })), [subAreas]);
    const inspectoresData = useMemo(() => inspectores, [inspectores]);
    const tiposMuestreoData = useMemo(() => tiposMuestreo, [tiposMuestreo]);
    const tiposMuestraData = useMemo(() => tiposMuestra.map(t => ({ value: String(t.id_tipomuestra_ma), label: t.nombre_tipomuestra_ma })), [tiposMuestra]);
    const actividadesData = useMemo(() => actividades.map(a => ({ value: String(a.id_actividadmuestreo), label: a.nombre_actividadmuestreo })), [actividades]);
    const tiposDescargaData = useMemo(() => tiposDescarga, [tiposDescarga]);
    const modalidadesData = useMemo(() => modalidades, [modalidades]);
    const formasCanalData = useMemo(() => formasCanal, [formasCanal]);
    const dispositivosData = useMemo(() => dispositivos, [dispositivos]);
    const zonasUTMData = useMemo(() => zonasUTMList, [zonasUTMList]);

    // Completitud por sección para el índice lateral — mismo criterio de
    // "campo obligatorio lleno" que la validación general de más abajo, pero
    // desglosado por bloque en vez de un solo isValid para todo el formulario.
    const isFieldSet = (v: unknown) => {
        if (v === null || v === undefined) return false;
        const s = String(v).trim();
        return s.length > 0 && s !== 'null' && s !== 'undefined';
    };

    const block1Complete = useMemo(
        () => [tipoMonitoreo, selectedLugar, selectedCliente, selectedEmpresa, selectedFuente, selectedContacto].every(isFieldSet),
        [tipoMonitoreo, selectedLugar, selectedCliente, selectedEmpresa, selectedFuente, selectedContacto]
    );

    const block2Complete = useMemo(
        () => [selectedObjetivo, responsableMuestreo, cargoResponsable, puntoMuestreo, periodo, frecuencia, factor, totalServicios].every(isFieldSet),
        [selectedObjetivo, responsableMuestreo, cargoResponsable, puntoMuestreo, periodo, frecuencia, factor, totalServicios]
    );

    const block3Complete = useMemo(() => {
        const req = [zona, utmNorte, utmEste, selectedInstrumento, selectedComponente, selectedSubArea, glosa];
        const instLow = (selectedInstrumento || '').toLowerCase();
        if (instLow === 'otro') req.push(nroInstrumento);
        else if (instLow !== 'no aplica' && selectedInstrumento) req.push(nroInstrumento, anioInstrumento);
        return req.every(isFieldSet);
    }, [zona, utmNorte, utmEste, selectedInstrumento, selectedComponente, selectedSubArea, glosa, nroInstrumento, anioInstrumento]);

    const block4Complete = useMemo(() => {
        const req = [selectedTipoMuestreo, selectedTipoMuestra, selectedActividad, selectedTipoDescarga, medicionCaudal];
        if (tipoMonitoreo !== 'Puntual') req.push(duracion);
        if (medicionCaudal && !isNoAplicaValue(medicionCaudal)) {
            req.push(selectedModalidad);
            if (selectedModalidad && !isNoAplicaValue(selectedModalidad, modalidades)) {
                req.push(formaCanal, dispositivo);
                if (formaCanal && !isNoAplicaValue(formaCanal, formasCanal)) req.push(tipoMedidaCanal, detalleCanal);
                if (dispositivo && !isNoAplicaValue(dispositivo, dispositivos)) req.push(tipoMedidaDispositivo, detalleDispositivo);
            }
        }
        return req.every(isFieldSet);
    }, [selectedTipoMuestreo, selectedTipoMuestra, selectedActividad, selectedTipoDescarga, medicionCaudal, tipoMonitoreo, duracion, selectedModalidad, modalidades, formaCanal, dispositivo, formasCanal, dispositivos, tipoMedidaCanal, detalleCanal, tipoMedidaDispositivo, detalleDispositivo]);

    const sectionNavItems: SectionNavItem[] = [
        { id: 'ident', label: 'Identificación', icon: IconBuilding, complete: block1Complete },
        { id: 'servicio', label: 'Datos del Servicio', icon: IconAdjustmentsHorizontal, complete: block2Complete },
        { id: 'clasif', label: 'Clasificación Técnica', icon: IconCertificate, complete: block3Complete },
        { id: 'operativo', label: 'Detalles Operativos', icon: IconClock, complete: block4Complete },
    ];

    const handlePeriodoChange = (val: string | null) => {
        setPeriodo(val);
        const selectedFreq = frecuenciasOptions.find(f => String(f.id) === val);
        if (selectedFreq) {
            setFrecuencia(String(selectedFreq.cantidad || 1));
            setFactor(String(selectedFreq.multiplicadopor || 1));
        } else if (val === 'No Aplica') {
            setFrecuencia('No Aplica'); setFactor('No Aplica'); setTotalServicios('No Aplica');
        }
    };

    useEffect(() => {
        if (isHydrating.current) return;
        if (selectedSubArea && selectedFuente && selectedObjetivo) {
            const fuenteName = fuentesEmisoras.find(f => String(f.id) === selectedFuente)?.nombre || '';
            const objName = objetivos.find(o => String(o.id) === selectedObjetivo)?.nombre || '';
            if (fuenteName && objName) setGlosa(`${fuenteName.trim()} - ${objName.trim()}`);
        }
    }, [selectedSubArea, selectedFuente, selectedObjetivo, fuentesEmisoras, objetivos]);

    // LÓGICA AUTOMÁTICA DE CARGO
    useEffect(() => {
        if (isHydrating.current) return;
        if (responsableMuestreo === 'ADL' && cargos.length > 0) {
            const match = cargos.find(c => c.nombre?.toUpperCase().includes('MUESTREADOR'));
            if (match) setCargoResponsable(String(match.id));
        } else if (responsableMuestreo !== 'ADL') {
            setCargoResponsable(null);
        }
    }, [responsableMuestreo, cargos]);

    useEffect(() => {
        if (frecuencia === 'No Aplica' || factor === 'No Aplica') setTotalServicios('No Aplica');
        else if (frecuencia && factor && !isNaN(Number(frecuencia)) && !isNaN(Number(factor))) setTotalServicios(String(Number(frecuencia) * Number(factor)));
    }, [frecuencia, factor]);

    return (
        <div className="shadcn-scope flex w-full flex-col gap-4 md:flex-row md:items-start md:gap-6">
            <SectionNav items={sectionNavItems} active={activeSection} onNavigate={scrollToSection} isMobile={isMobile} />

            <div className="flex min-w-0 flex-1 flex-col" style={{ gap: isMobile ? 16 : 24 }}>
            <div ref={(el) => { sectionRefs.current.ident = el; }} id="ficha-sec-ident">
            <Block>
                <BlockTitle icon={IconBuilding} color="var(--sc-primary)">Identificación y Ubicación</BlockTitle>

                <Row className="mb-4">
                    <Select
                        size="sm"
                        label={<FieldLabel label="Monitoreo agua/RIL *" help="Tipo de toma de muestra: Puntual es una sola extracción en un momento dado; Compuesta mezcla varias extracciones a lo largo del tiempo para obtener un promedio." />}
                        placeholder="Seleccione..."
                        data={['Compuesta', 'Puntual']}
                        value={tipoMonitoreo}
                        onChange={setTipoMonitoreo}
                    />
                    <Select
                        size="sm"
                        label={<FieldLabel label="Base de operaciones *" help="Laboratorio o sede de ADL desde la cual partirá el equipo de muestreo. Determina la logística del viaje." />}
                        placeholder="Cargando..."
                        data={lugaresData}
                        value={selectedLugar}
                        onChange={setSelectedLugar}
                        disabled={!tipoMonitoreo}
                    />
                    <Select
                        size="lg"
                        label={<FieldLabel label="Empresa a Facturar *" help="Empresa o cliente al que se emitirá la factura por el servicio de análisis. Puede ser diferente de la empresa de servicio." />}
                        placeholder="Buscar cliente..."
                        data={clientesData}
                        value={selectedCliente}
                        onChange={(v: string | null) => setSelectedCliente(v || '')}
                    />
                    <Select
                        size="lg"
                        label={<FieldLabel label="Empresa de servicio *" help="Empresa que opera el establecimiento a muestrear (ej. salmonicultura, industria). Al seleccionarla se cargarán automáticamente sus centros, contactos y objetivos." />}
                        placeholder="Buscar empresa..."
                        data={empresasData}
                        value={selectedEmpresa}
                        onChange={handleEmpresaChange}
                        rightSection={
                            hasPermission('FI_CREAR_EMPRESA') && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 shrink-0 rounded-full"
                                    onClick={() => setCreateEmpresaOpened(true)}
                                    title="Crear nueva empresa"
                                >
                                    <IconPlus size={16} />
                                </Button>
                            )
                        }
                    />
                </Row>

                <Row className="mb-4">
                    <Select
                        size="lg"
                        label={<FieldLabel label="Fuente emisora *" help="Centro de cultivo o instalación específica donde se tomará la muestra. Al seleccionarlo se autocompletan Tipo de Agua, Comuna y Región." />}
                        placeholder="Seleccione empresa primero"
                        data={fuentesData}
                        value={selectedFuente}
                        onChange={(v: string | null) => setSelectedFuente(v || '')}
                        disabled={!selectedEmpresa || selectedEmpresa === 'No Aplica'}
                    />
                    <StaticField size="sm" label="Tipo agua" value={tipoAgua} icon={IconFlask} />
                    <StaticField size="sm" label="Comuna" value={comuna} icon={IconMapPin} />
                    <StaticField size="sm" label="Región" value={region} icon={IconMapPin} />
                </Row>

                <Row>
                    <TextInput
                        size="md"
                        label={<FieldLabel label="Ubicación / Dirección" help="Dirección física del centro de cultivo o fuente emisora. Se completa automáticamente al seleccionar la fuente emisora, pero puede editarse." />}
                        value={ubicacion}
                        onChange={(e: any) => setUbicacion(e.target.value)}
                    />
                    <StaticField size="xs" label="Código Centro" value={codigo} icon={IconInfoCircle} />
                    <Select
                        size="md"
                        label={<FieldLabel label="Contacto empresa *" help="Persona de contacto de la empresa de servicio que coordinará el acceso al centro para el día del muestreo." />}
                        placeholder="Seleccione..."
                        data={[
                            ...(empresas.find(e => String(e.id) === selectedEmpresa)?.contacto ? [{ value: 'primary', label: empresas.find(e => String(e.id) === selectedEmpresa)?.contacto || '' }] : []),
                            ...contactos.map(c => ({ value: String(c.id), label: c.nombre }))
                        ]}
                        value={selectedContacto}
                        onChange={(v: string | null) => setSelectedContacto(v || '')}
                        disabled={!selectedEmpresa || selectedEmpresa === 'No Aplica'}
                    />
                    <StaticField
                        size="md"
                        label="E-mail Contacto"
                        value={selectedContacto === 'primary' ? (empresas.find(e => String(e.id) === selectedEmpresa)?.email || '-') : (contactos.find(c => String(c.id) === selectedContacto)?.email || '-')}
                        icon={IconMail}
                    />
                </Row>
            </Block>
            </div>

            {/* Sección 2: Datos del Servicio */}
            <div ref={(el) => { sectionRefs.current.servicio = el; }} id="ficha-sec-servicio">
            <Block>
                <BlockTitle icon={IconAdjustmentsHorizontal} color="#9c36b5">Datos del Servicio y Frecuencia</BlockTitle>

                <Row className="mb-4">
                    <Select
                        size="sm"
                        label={<FieldLabel label="Objetivo del Muestreo *" help="Propósito regulatorio o técnico del muestreo. Ejemplos: Autocontrol (obligación legal), Patología (diagnóstico de enfermedad), Fisicoquímica (análisis de parámetros físicos)." />}
                        placeholder="Seleccione..."
                        data={objetivosData}
                        value={selectedObjetivo}
                        onChange={(v: string | null) => setSelectedObjetivo(v || '')}
                        disabled={!selectedEmpresa || selectedEmpresa === 'No Aplica'}
                    />
                    <Select
                        size="md"
                        label={<FieldLabel label="Responsable Muestreo *" help="Quién tomará físicamente las muestras en terreno. ADL: el muestreador es personal de ADL. Cliente: el propio cliente toma la muestra y la envía al laboratorio." />}
                        data={['ADL', 'Cliente']}
                        value={responsableMuestreo}
                        onChange={setResponsableMuestreo}
                    />
                    <Select
                        size="sm"
                        label={<FieldLabel label="Cargo *" help="Cargo profesional del responsable del muestreo. Si el responsable es ADL, se asigna automáticamente el cargo de Muestreador." />}
                        placeholder="Seleccione..."
                        data={cargosData}
                        value={cargoResponsable}
                        onChange={(v: string | null) => setCargoResponsable(v || '')}
                        disabled={responsableMuestreo === 'ADL'}
                    />
                    <TextInput
                        size="md"
                        label={<FieldLabel label="Punto de Muestreo *" help="Nombre o código que identifica el punto exacto donde se tomará la muestra dentro del centro. Ejemplos: Efluente Final, Punto 1, PM-01." />}
                        value={puntoMuestreo}
                        onChange={(e: any) => setPuntoMuestreo(e.target.value)}
                    />
                </Row>

                <Divider />

                <Row>
                    <Select
                        size="sm"
                        label={<FieldLabel label="Frecuencia Periodo *" help="Período de tiempo con que se repite el muestreo. Ejemplos: Mensual, Trimestral, Semestral. Al seleccionarlo se autocompletan los campos de Cantidad y Factor." />}
                        data={frecuenciasData}
                        value={periodo}
                        onChange={handlePeriodoChange}
                        onDropdownOpen={() => {
                            if (!puntoMuestreo.trim()) showToast({ type: 'warning', message: 'Debe ingresar el Punto de Muestreo' });
                        }}
                    />
                    <TextInput
                        size="sm"
                        label={<FieldLabel label="Cant. Frecuencia" help="Número de veces que se realiza el muestreo dentro del período seleccionado. Se completa automáticamente según la frecuencia, pero puede ajustarse." />}
                        value={frecuencia}
                        onChange={(e: any) => setFrecuencia(e.target.value)}
                    />
                    <TextInput
                        size="sm"
                        label={<FieldLabel label="Factor" help="Multiplicador que ajusta el número total de servicios. Útil cuando hay más de una ubicación o muestra por visita. Total = Cantidad × Factor." />}
                        value={factor}
                        onChange={(e: any) => setFactor(e.target.value)}
                    />
                    <div className={cn('min-w-0', FIELD_SIZE_CLASS.sm)}>
                        <span className="mb-1 block text-[11px] font-bold uppercase text-muted-foreground">Total Servicios</span>
                        <div className="flex h-[34px] items-center justify-center rounded-lg bg-primary text-[15px] font-bold text-primary-foreground">
                            {totalServicios || '0'}
                        </div>
                    </div>
                </Row>

                {periodo && periodo !== 'No Aplica' && frecuencia && factor && totalServicios && (
                    <p className="mt-2 text-center text-xs italic text-muted-foreground">
                        Se realizarán <b>{totalServicios}</b> muestreo(s) en total, con una frecuencia de <b>{frecuencia}</b> vez/veces cada periodo <b>{frecuenciasData.find(f => f.value === periodo)?.label?.toLowerCase() || periodo}</b>, multiplicado por un factor de <b>{factor}</b>.
                    </p>
                )}
            </Block>
            </div>

            {/* Sección 3: Clasificación Técnica */}
            <div ref={(el) => { sectionRefs.current.clasif = el; }} id="ficha-sec-clasif">
            <Block>
                <BlockTitle icon={IconCertificate} color="#0d9488">Clasificación Técnica y Geográfica</BlockTitle>

                <Row className="mb-4">
                    <Select
                        size="xs"
                        label={<FieldLabel label="Zona UTM *" help="Huso o banda de la cuadrícula UTM donde se ubica el punto de muestreo. En Chile continental se usa mayoritariamente la Zona 19S. Selecciónela según la ubicación geográfica del centro." />}
                        data={zonasUTMData}
                        value={zona}
                        onChange={(v: string | null) => setZona(v || '')}
                    />
                    <TextInput
                        size="sm"
                        label={<FieldLabel label="UTM Norte *" help="Coordenada Norte en sistema de coordenadas UTM. Es el valor de latitud expresado en metros. Ejemplo: 5837000. Debe ser un número de 7 dígitos aproximadamente." />}
                        value={utmNorte}
                        onChange={(e: any) => setUtmNorte(e.target.value)}
                        disabled={!zona || zona === 'No aplica'}
                    />
                    <TextInput
                        size="sm"
                        label={<FieldLabel label="UTM Este *" help="Coordenada Este en sistema UTM. Es el valor de longitud expresado en metros. Ejemplo: 672000. Debe ser un número de 6 dígitos aproximadamente." />}
                        value={utmEste}
                        onChange={(e: any) => setUtmEste(e.target.value)}
                        disabled={!zona || zona === 'No aplica'}
                    />
                    <Select
                        size="md"
                        label={<FieldLabel label="Instrumento Ambiental *" help="Marco regulatorio o norma legal que obliga a realizar este muestreo. Ejemplos: RCA (Resolución de Calificación Ambiental), DS90, D.S. 46. Seleccione 'No aplica' si no existe obligación regulatoria." />}
                        data={instrumentosAmbientales}
                        value={selectedInstrumento}
                        onChange={(val: string | null) => {
                            setSelectedInstrumento(val || '');
                            // F-15: limpiar campos dependientes al elegir "No aplica"
                            if (val === 'No aplica') {
                                setEsETFA('No');
                                setNroInstrumento('');
                                setAnioInstrumento('');
                            } else {
                                setEsETFA('Si');
                            }
                        }}
                    />
                    <TextInput
                        size="xs"
                        // F-01f: con "Otro" el número/año NO son obligatorios (solo "Otro" + texto libre)
                        label={<FieldLabel label={selectedInstrumento?.toLowerCase() === 'otro' ? 'Número Instrumento' : 'Número Instrumento *'} help="Número o código identificador del instrumento ambiental (ej: número de RCA, decreto o resolución). Solo se aceptan números salvo cuando el instrumento es 'Otro'." />}
                        placeholder={selectedInstrumento?.toLowerCase() === 'otro' ? 'Texto libre (ej: Resolución SISS 2122/2023)' : 'Solo número (ej: 123)'}
                        value={nroInstrumento}
                        disabled={selectedInstrumento === 'No aplica'}
                        inputMode={selectedInstrumento?.toLowerCase() === 'otro' ? 'text' : 'numeric'}
                        onChange={(e: any) => {
                            const val = String(e.target.value || '');
                            // F-01c: si no es "Otro", solo permitir números (filtro estricto en input)
                            if (selectedInstrumento?.toLowerCase() === 'otro') {
                                setNroInstrumento(val);
                            } else {
                                setNroInstrumento(val.replace(/[^0-9]/g, ''));
                            }
                        }}
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                            // F-01c: bloquear teclas no numéricas si NO es "Otro"
                            if (selectedInstrumento?.toLowerCase() !== 'otro' && selectedInstrumento !== 'No aplica') {
                                const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
                                if (!allowedKeys.includes(e.key) && !/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey) {
                                    e.preventDefault();
                                }
                            }
                        }}
                    />
                    <TextInput
                        size="xs"
                        // F-01f: con "Otro" el año tampoco es obligatorio
                        label={<FieldLabel label={selectedInstrumento?.toLowerCase() === 'otro' ? 'Año Instrumento' : 'Año Instrumento *'} help="Año de emisión o vigencia del instrumento ambiental. Debe ser un año de 4 dígitos entre 1900 y el año actual." />}
                        placeholder="YYYY (ej: 2024)"
                        value={anioInstrumento}
                        disabled={selectedInstrumento === 'No aplica' || selectedInstrumento?.toLowerCase() === 'otro'}
                        onChange={(e: any) => {
                            // F-01d: solo dígitos, máx 4
                            const cleaned = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                            setAnioInstrumento(cleaned);
                        }}
                        error={(() => {
                            if (!anioInstrumento) return null;
                            const n = Number(anioInstrumento);
                            const currentYear = new Date().getFullYear();
                            if (anioInstrumento.length !== 4 || n < 1900 || n > currentYear + 1) {
                                return `Año inválido (1900-${currentYear + 1})`;
                            }
                            return null;
                        })()}
                        maxLength={4}
                    />
                </Row>

                <Divider />

                <Row className="mb-4">
                    <Select
                        size="md"
                        label={<FieldLabel label="Componente Ambiental *" help="Componente del medio ambiente al que corresponde la muestra. Ejemplos: Agua Superficial, Agua Marina, Sedimento, Atmósfera. Al seleccionarlo se cargarán las Sub Áreas disponibles." />}
                        data={componentesData}
                        value={selectedComponente}
                        onChange={handleComponenteChange}
                    />
                    <Select
                        size="md"
                        label={<FieldLabel label="Sub Área *" help="Clasificación más específica dentro del componente ambiental seleccionado. Depende del Componente elegido anteriormente." />}
                        data={subAreasData}
                        value={selectedSubArea}
                        onChange={(v: string | null) => setSelectedSubArea(v || '')}
                        disabled={!selectedComponente}
                    />
                    <Select size="xs" label={<FieldLabel label="¿Es ETFA?" help="Indica si el establecimiento es una Empresa de Tratamiento de Fangs y Aguas (ETFA). Se activa automáticamente al seleccionar un instrumento ambiental válido. Puede modificarse manualmente." />} data={['Si', 'No']} value={esETFA} onChange={(v: string | null) => setEsETFA(v || 'No')} />
                    <Select
                        size="sm"
                        label={<FieldLabel label="Inspector Ambiental" help="Profesional inspector de ADL designado para supervisar este muestreo. Campo opcional disponible solo cuando el responsable es ADL." />}
                        data={inspectoresData}
                        value={selectedInspector}
                        onChange={(v: string | null) => setSelectedInspector(v || '')}
                        disabled={responsableMuestreo !== 'ADL'}
                    />
                </Row>

                <Row>
                    <TextInput
                        size="full"
                        label={<FieldLabel label="Nombre de la Tabla (Glosa) *" help="Nombre descriptivo que identificará la tabla de resultados en el informe final. Se autocompleta como: 'Nombre del Centro - Objetivo del Muestreo'. Puede editarse libremente. Máximo 100 caracteres." />}
                        value={glosa}
                        onChange={(e: any) => setGlosa(e.target.value)}
                        maxLength={100}
                        description={`${glosa.length}/100 caracteres`}
                    />
                </Row>
            </Block>
            </div>

            {/* Sección 4: Detalles Operativos */}
            <div ref={(el) => { sectionRefs.current.operativo = el; }} id="ficha-sec-operativo">
            <Block>
                <BlockTitle icon={IconClock} color="#e8590c">Detalles Operativos y Descarga</BlockTitle>

                <Row className="mb-4">
                    <Select
                        size="sm"
                        label={<FieldLabel label="Tipo Muestreo *" help="Metodología general de recolección de la muestra. Ejemplos: Simple (grab), Integrado, Compuesto. Al seleccionarlo se cargarán los Tipos de Muestra disponibles." />}
                        data={tiposMuestreoData}
                        value={selectedTipoMuestreo}
                        onChange={handleTipoMuestreoChange}
                    />
                    <Select
                        size="sm"
                        label={<FieldLabel label="Tipo Muestra *" help="Material físico que se recolectará. Ejemplos: Agua Superficial, Sedimento, Biota, Efluente. Depende del Tipo de Muestreo seleccionado." />}
                        data={tiposMuestraData}
                        value={selectedTipoMuestra}
                        onChange={handleTipoMuestraChange}
                        disabled={!selectedTipoMuestreo}
                    />
                    <Select
                        size="md"
                        label={<FieldLabel label="Actividad *" help="Técnica o procedimiento específico para obtener la muestra. Ejemplos: Tomada con balde, Bomba peristáltica, Red de arrastre. Depende del Tipo de Muestra." />}
                        data={actividadesData}
                        value={selectedActividad}
                        onChange={(v: string | null) => setSelectedActividad(v || '')}
                        disabled={!selectedTipoMuestra}
                    />
                    {/* ✅ PUNTUAL: muestreo de un solo día → no se pide duración. Solo aplica en Compuesta. */}
                    {tipoMonitoreo !== 'Puntual' && (
                        <TextInput
                            size="xs"
                            label={<FieldLabel label="Duración (Hrs) *" help="Tiempo estimado en horas enteras que tomará el muestreo completo en el centro. No incluir el tiempo de traslado. Solo se aceptan números enteros." />}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            value={duracion}
                            placeholder="Solo horas enteras"
                            onChange={(e: any) => {
                                // F-16: solo enteros, sin decimal ni letras
                                const cleaned = String(e.target.value).replace(/[^0-9]/g, '');
                                setDuracion(cleaned);
                            }}
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                // Bloquear punto, coma, e, +, -
                                if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) {
                                    e.preventDefault();
                                }
                            }}
                        />
                    )}
                    <Select
                        size="sm"
                        label={<FieldLabel label="Tipo Descarga *" help="Clasificación del tipo de descarga del establecimiento según la normativa ambiental. Ejemplos: Punto de Descarga, Cuerpo Receptor. Requerido para la clasificación del informe." />}
                        data={tiposDescargaData}
                        value={selectedTipoDescarga}
                        onChange={(v: string | null) => setSelectedTipoDescarga(v || '')}
                    />
                </Row>

                <div className="mb-4 flex flex-col gap-1.5">
                    {/* El texto de ayuda va fuera de la fila: dentro del TextInput
                        empujaba su borde inferior y el botón —alineado con items-end—
                        quedaba a la altura de ese texto en vez de la del input. */}
                    <div className="flex items-end gap-2">
                        <div className="relative min-w-0 flex-1">
                            <TextInput
                                label={<FieldLabel label="Referencia Google Maps" help="Enlace de Google Maps o coordenadas geográficas (latitud,longitud) del punto de muestreo. Permite geolocalizar el centro en el planificador de rutas. Ejemplo: https://maps.app.goo.gl/XYZ o -41.45,-72.92" />}
                                placeholder="https://maps.app.goo.gl/... o -41.45,-72.92"
                                value={refGoogle}
                                onChange={(e: any) => setRefGoogle(e.target.value)}
                                onBlur={() => { if (refGoogle.trim() && verifyStatus === 'idle') handleVerifyLink(); }}
                                error={verifyStatus === 'invalid' ? verifyError : undefined}
                            />
                            {verifyStatus === 'loading' && (
                                <div className="pointer-events-none absolute right-2.5 top-[34px] h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            )}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleVerifyLink}
                            disabled={!refGoogle.trim() || verifyStatus === 'loading'}
                            className="shrink-0"
                        >
                            {verifyStatus === 'loading' && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                            Verificar
                        </Button>
                    </div>
                    <p className="m-0 text-[11px] text-muted-foreground">
                        Si no es ingresada, esta ficha quedará inhabilitada para generación de rutas.
                    </p>

                    {verifyStatus === 'ok' && verifiedCoords && (
                        <div className="flex flex-col gap-1.5">
                            <InlineAlert type="success" icon={<IconCheck size={16} />}>
                                <div className="flex flex-nowrap items-center justify-between gap-2">
                                    <span>
                                        Ubicación detectada — Lat: {verifiedCoords.lat.toFixed(6)} · Lon: {verifiedCoords.lon.toFixed(6)}
                                    </span>
                                    <a
                                        href={`https://www.google.com/maps?q=${verifiedCoords.lat},${verifiedCoords.lon}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex shrink-0 items-center gap-1 text-primary"
                                    >
                                        <IconExternalLink size={12} /> Abrir
                                    </a>
                                </div>
                            </InlineAlert>
                            <div className="h-[200px] overflow-hidden rounded-lg border border-success/30">
                                <iframe
                                    title="Ubicación en mapa"
                                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${verifiedCoords.lon - 0.01},${verifiedCoords.lat - 0.01},${verifiedCoords.lon + 0.01},${verifiedCoords.lat + 0.01}&layer=mapnik&marker=${verifiedCoords.lat},${verifiedCoords.lon}`}
                                    width="100%"
                                    height="200"
                                    style={{ border: 'none', display: 'block' }}
                                    loading="lazy"
                                />
                            </div>
                        </div>
                    )}

                    {verifyStatus === 'warn' && (
                        <InlineAlert type="warning" icon={<IconAlertTriangle size={16} />}>{verifyError}</InlineAlert>
                    )}
                </div>

                <Divider label="Hidráulica y Caudal" />

                <Row>
                    <Select
                        size="sm"
                        label={<FieldLabel label="Medición Caudal" help="Indica si se medirá el caudal de la descarga y cómo. Manual: se mide en terreno por el muestreador. Automático: existe un caudalímetro instalado. No Aplica: no se mide caudal." />}
                        data={['Manual', 'Automático', 'No Aplica']}
                        value={medicionCaudal}
                        onChange={(v: string | null) => setMedicionCaudal(v || '')}
                    />
                    <Select
                        size="sm"
                        label={<FieldLabel label="Modalidad" help="Método hidráulico para medir el caudal. Se activa solo si la Medición de Caudal no es 'No Aplica'. Determina qué campos de canal y dispositivo se requieren." />}
                        data={modalidadesData}
                        value={selectedModalidad}
                        onChange={(v: string | null) => setSelectedModalidad(v || '')}
                        disabled={isNoAplicaValue(medicionCaudal)}
                    />
                    <div className={cn('flex min-w-0 flex-col gap-1', FIELD_SIZE_CLASS.md)}>
                        <Select
                            label={<FieldLabel label="Forma Canal" help="Geometría del canal o sección de descarga donde se medirá el caudal. Ejemplos: Rectangular, Trapezoidal, Circular. Determina la fórmula hidráulica que se aplicará." />}
                            data={formasCanalData}
                            value={formaCanal}
                            onChange={(v: string | null) => setFormaCanal(v || '')}
                            disabled={isNoAplicaValue(selectedModalidad, modalidades)}
                        />
                        <div className="flex gap-1">
                            <div className="min-w-0 flex-1">
                                <Select
                                    placeholder="Unidad"
                                    data={unidadesMedida}
                                    value={tipoMedidaCanal}
                                    onChange={(v: string | null) => setTipoMedidaCanal(v || '')}
                                    disabled={isNoAplicaValue(formaCanal, formasCanal)}
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <TextInput
                                    placeholder="Valor"
                                    value={detalleCanal}
                                    onChange={(e: any) => setDetalleCanal(e.target.value)}
                                    disabled={!tipoMedidaCanal}
                                />
                            </div>
                        </div>
                    </div>
                    <div className={cn('flex min-w-0 flex-col gap-1', FIELD_SIZE_CLASS.md)}>
                        <Select
                            label={<FieldLabel label="Dispositivo Hidr." help="Instrumento o equipo utilizado para medir el caudal del dispositivo de descarga. Ejemplos: Caudalímetro electromagnético, Aforador Parshall, Vertedero. Seleccione 'No Aplica' si no existe dispositivo." />}
                            data={dispositivosData}
                            value={dispositivo}
                            onChange={(v: string | null) => setDispositivo(v || '')}
                            disabled={isNoAplicaValue(selectedModalidad, modalidades)}
                        />
                        <div className="flex gap-1">
                            <div className="min-w-0 flex-1">
                                <Select
                                    placeholder="Unidad"
                                    data={unidadesMedida}
                                    value={tipoMedidaDispositivo}
                                    onChange={(v: string | null) => setTipoMedidaDispositivo(v || '')}
                                    disabled={isNoAplicaValue(dispositivo, dispositivos)}
                                />
                            </div>
                            <div className="min-w-0 flex-1">
                                <TextInput
                                    placeholder="Valor"
                                    value={detalleDispositivo}
                                    onChange={(e: any) => setDetalleDispositivo(e.target.value)}
                                    disabled={!tipoMedidaDispositivo}
                                />
                            </div>
                        </div>
                    </div>
                </Row>
            </Block>
            </div>
            </div>

            <CreateEmpresaServicioModal
                opened={createEmpresaOpened}
                onClose={() => setCreateEmpresaOpened(false)}
                onCreated={() => {
                    loadEmpresas(); // Refrescar catálogo
                }}
            />
        </div>
    );
});
