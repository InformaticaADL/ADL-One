import React, { useCallback, useEffect, useState, useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import type { LugarAnalisis, EmpresaServicio, Cliente, Contacto, Centro } from '../services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import {
    Stack,
    SimpleGrid,
    TextInput as MantineTextInput,
    Select,
    Text,
    Paper,
    Divider,
    Badge,
    Box,
    Group,
    ActionIcon,
    Button,
    Alert,
    Loader,
    Anchor
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
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

// Extremely Fast TextInput Wrapper to isolate typing updates.
// Uses startTransition for the parent callback so AntecedentesForm (30+ states)
// only re-renders at low priority — the local input state updates immediately.
const TextInput = React.memo(({ value: parentValue, onChange, ...props }: any) => {
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

    return <MantineTextInput value={localValue} onChange={handleChange} {...props} />;
});

// Module-level memoized component (avoids recreation on every parent render)
const StaticField = React.memo(({ label, value, icon: Icon }: { label: string, value: string, icon: any }) => (
    <Stack gap={2}>
        <Group gap={4}>
            <Icon size={12} color="var(--mantine-color-dimmed)" />
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">{label}</Text>
        </Group>
        <Paper withBorder px="xs" py={6} radius="md" bg="gray.1">
            <Text size="sm" fw={500} truncate title={value}>{value || '-'}</Text>
        </Paper>
    </Stack>
));

// Define interface for exposed methods
export interface AntecedentesFormHandle {
    getData: () => any;
}

export const AntecedentesForm = forwardRef<AntecedentesFormHandle, { initialData?: any, onValidationChange?: (isValid: boolean) => void }>((props, ref) => {
    const { initialData, onValidationChange } = props;
    const { hasPermission } = useAuth();
    const catalogos = useCachedCatalogos();
    const { showToast } = useToast();
    const isMobile = useMediaQuery('(max-width: 768px)');
    const isVerySmall = useMediaQuery('(max-width: 480px)');

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
            console.log('Hydrating AntecedentesForm', initialData);
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
        } catch (err) {}
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
        } catch (err) {}
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
        } catch (err) {}
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
        } catch (err) {}
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
        } catch (err) {}
    };

    const loadObjetivos = async (clienteId?: number, empresaServicioId?: number) => {
        try {
            const data = await catalogos.getObjetivosMuestreo(clienteId, empresaServicioId);
            setObjetivos((data || []).map((o: any) => ({
                id: o.id_objetivomuestreo_ma || o.id,
                nombre: o.nombre_objetivomuestreo_ma || o.nombre
            })));
        } catch (error) {}
    };

    const loadSubAreas = async (componenteId: string) => {
        try {
            const data = await catalogos.getSubAreas(componenteId);
            setSubAreas((data || []).map((s: any) => ({
                id: s.id_subarea || s.id,
                nombre: s.nombre_subarea || s.nombre
            })));
        } catch (error) {}
    };

    const loadTiposMuestra = async (tipoMuestreoId: string) => {
        try {
            const data = await catalogos.getTiposMuestra(tipoMuestreoId);
            setTiposMuestra(data || []);
        } catch (error) {}
    };

    const loadActividades = async (tipoMuestraId: string) => {
        try {
            const data = await catalogos.getActividadesMuestreo(tipoMuestraId);
            setActividades(data || []);
        } catch (error) {}
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
        } catch (error) {}
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

    // StaticField moved to module level for performance

    return (
        <Stack gap={isMobile ? "md" : "xl"} p={isMobile ? 0 : "xs"} style={{ width: '100% !important' }}>
            {/* Block 1: Identificación */}
            <Paper withBorder p="md" radius="lg" shadow="xs" style={{ width: '100% !important' }}>
                <Stack gap="md">
                    <Group gap="xs">
                        <IconBuilding size={18} color="var(--mantine-color-blue-6)" />
                        <Text fw={700} size="sm" c="blue.7">Identificación y Ubicación</Text>
                    </Group>
                    
                    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                        <Select 
                            label={<FieldLabel label="Monitoreo agua/RIL *" help="Tipo de toma de muestra: Puntual es una sola extracción en un momento dado; Compuesta mezcla varias extracciones a lo largo del tiempo para obtener un promedio." />}
                            placeholder="Seleccione..."
                            data={['Compuesta', 'Puntual']}
                            value={tipoMonitoreo}
                            onChange={setTipoMonitoreo}
                            size="sm"
                            radius="md"
                        />
                        <Select 
                            label={<FieldLabel label="Base de operaciones *" help="Laboratorio o sede de ADL desde la cual partirá el equipo de muestreo. Determina la logística del viaje." />}
                            placeholder="Cargando..."
                            data={lugaresData}
                            value={selectedLugar}
                            onChange={setSelectedLugar}
                            disabled={!tipoMonitoreo}
                            searchable
                            size="sm"
                            radius="md"
                        />
                        <Select 
                            label={<FieldLabel label="Empresa a Facturar *" help="Empresa o cliente al que se emitirá la factura por el servicio de análisis. Puede ser diferente de la empresa de servicio." />}
                            placeholder="Buscar cliente..."
                            data={clientesData}
                            value={selectedCliente}
                            onChange={(v) => setSelectedCliente(v || '')}
                            searchable
                            size="sm"
                            radius="md"
                        />
                        <Box style={{ position: 'relative' }}>
                            <Select 
                                label={<FieldLabel label="Empresa de servicio *" help="Empresa que opera el establecimiento a muestrear (ej. salmonicultura, industria). Al seleccionarla se cargarán automáticamente sus centros, contactos y objetivos." />}
                                placeholder="Buscar empresa..."
                                data={empresasData}
                                value={selectedEmpresa}
                                onChange={handleEmpresaChange}
                                searchable
                                size="sm"
                                radius="md"
                                rightSection={
                                    hasPermission('FI_CREAR_EMPRESA') && (
                                        <ActionIcon 
                                            variant="subtle" 
                                            color="teal" 
                                            onClick={() => setCreateEmpresaOpened(true)}
                                            title="Crear nueva empresa"
                                        >
                                            <IconPlus size={16} />
                                        </ActionIcon>
                                    )
                                }
                            />
                        </Box>
                    </SimpleGrid>

                    <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="md">
                        <Box style={{ gridColumn: 'span 2' }}>
                            <Select 
                                label={<FieldLabel label="Fuente emisora *" help="Centro de cultivo o instalación específica donde se tomará la muestra. Al seleccionarlo se autocompletan Tipo de Agua, Comuna y Región." />}
                                placeholder="Seleccione empresa primero"
                                data={fuentesData}
                                value={selectedFuente}
                                onChange={(val) => setSelectedFuente(val || '')}
                                disabled={!selectedEmpresa || selectedEmpresa === 'No Aplica'}
                                searchable
                                size="sm"
                                radius="md"
                            />
                        </Box>
                        <StaticField label="Tipo agua" value={tipoAgua} icon={IconFlask} />
                        <StaticField label="Comuna" value={comuna} icon={IconMapPin} />
                        <StaticField label="Región" value={region} icon={IconMapPin} />
                    </SimpleGrid>

                    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                        <TextInput 
                            label={<FieldLabel label="Ubicación / Dirección" help="Dirección física del centro de cultivo o fuente emisora. Se completa automáticamente al seleccionar la fuente emisora, pero puede editarse." />}
                            value={ubicacion} 
                            onChange={(e: any) => setUbicacion(e.target.value)}
                            size="sm"
                            radius="md"
                        />
                        <StaticField label="Código Centro" value={codigo} icon={IconInfoCircle} />
                        <StaticField label="ID Centro" value={selectedFuente || ''} icon={IconInfoCircle} />
                        <Select 
                            label={<FieldLabel label="Contacto empresa *" help="Persona de contacto de la empresa de servicio que coordinará el acceso al centro para el día del muestreo." />}
                            placeholder="Seleccione..."
                            data={[
                                ...(empresas.find(e => String(e.id) === selectedEmpresa)?.contacto ? [{ value: 'primary', label: empresas.find(e => String(e.id) === selectedEmpresa)?.contacto || '' }] : []),
                                ...contactos.map(c => ({ value: String(c.id), label: c.nombre }))
                            ]}
                            value={selectedContacto}
                            onChange={(v) => setSelectedContacto(v || '')}
                            disabled={!selectedEmpresa || selectedEmpresa === 'No Aplica'}
                            searchable
                            size="sm"
                            radius="md"
                        />
                        <StaticField 
                            label="E-mail Contacto" 
                            value={selectedContacto === 'primary' ? (empresas.find(e => String(e.id) === selectedEmpresa)?.email || '-') : (contactos.find(c => String(c.id) === selectedContacto)?.email || '-')} 
                            icon={IconMail} 
                        />
                    </SimpleGrid>
                </Stack>
            </Paper>

            {/* Block 2: Datos del Servicio */}
            <Paper withBorder p="md" radius="lg" shadow="xs" style={{ width: '100% !important' }}>
                <Stack gap="md">
                    <Group gap="xs">
                        <IconAdjustmentsHorizontal size={18} color="var(--mantine-color-grape-6)" />
                        <Text fw={700} size="sm" c="grape.7">Datos del Servicio y Frecuencia</Text>
                    </Group>

                    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                        <Select 
                            label={<FieldLabel label="Objetivo del Muestreo *" help="Propósito regulatorio o técnico del muestreo. Ejemplos: Autocontrol (obligación legal), Patología (diagnóstico de enfermedad), Fisicoquímica (análisis de parámetros físicos)." />}
                            placeholder="Seleccione..."
                            data={objetivosData}
                            value={selectedObjetivo}
                            onChange={(v) => setSelectedObjetivo(v || '')}
                            disabled={!selectedEmpresa || selectedEmpresa === 'No Aplica'}
                            searchable
                            size="sm"
                            radius="md"
                        />
                        <Select 
                            label={<FieldLabel label="Responsable Muestreo *" help="Quién tomará físicamente las muestras en terreno. ADL: el muestreador es personal de ADL. Cliente: el propio cliente toma la muestra y la envía al laboratorio." />}
                            data={['ADL', 'Cliente']}
                            value={responsableMuestreo}
                            onChange={setResponsableMuestreo}
                            size="sm"
                            radius="md"
                        />
                        <Select 
                            label={<FieldLabel label="Cargo *" help="Cargo profesional del responsable del muestreo. Si el responsable es ADL, se asigna automáticamente el cargo de Muestreador." />}
                            placeholder="Seleccione..."
                            data={cargosData}
                            value={cargoResponsable}
                            onChange={(v) => setCargoResponsable(v || '')}
                            disabled={responsableMuestreo === 'ADL'}
                            size="sm"
                            radius="md"
                        />
                    </SimpleGrid>

                    <Divider />

                    <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="sm">
                        <TextInput 
                            label={<FieldLabel label="Punto de Muestreo *" help="Nombre o código que identifica el punto exacto donde se tomará la muestra dentro del centro. Ejemplos: Efluente Final, Punto 1, PM-01." />}
                            value={puntoMuestreo} 
                            onChange={(e: any) => setPuntoMuestreo(e.target.value)}
                            size="sm"
                            radius="md"
                        />
                        <Select 
                            label={<FieldLabel label="Frecuencia Periodo *" help="Período de tiempo con que se repite el muestreo. Ejemplos: Mensual, Trimestral, Semestral. Al seleccionarlo se autocompletan los campos de Cantidad y Factor." />}
                            data={frecuenciasData}
                            value={periodo}
                            onChange={handlePeriodoChange}
                            onDropdownOpen={() => {
                                if (!puntoMuestreo.trim()) showToast({ type: 'warning', message: 'Debe ingresar el Punto de Muestreo' });
                            }}
                            size="sm"
                            radius="md"
                        />
                        <TextInput 
                            label={<FieldLabel label="Cant. Frecuencia" help="Número de veces que se realiza el muestreo dentro del período seleccionado. Se completa automáticamente según la frecuencia, pero puede ajustarse." />}
                            value={frecuencia}
                            onChange={(e: any) => setFrecuencia(e.target.value)}
                            size="sm"
                            radius="md"
                        />
                        <TextInput 
                            label={<FieldLabel label="Factor" help="Multiplicador que ajusta el número total de servicios. Útil cuando hay más de una ubicación o muestra por visita. Total = Cantidad × Factor." />}
                            value={factor} 
                            onChange={(e: any) => setFactor(e.target.value)}
                            size="sm"
                            radius="md"
                        />
                        <Box>
                            <Text size="xs" fw={700} c="dimmed" mb={4} tt="uppercase">Total Servicios</Text>
                            <Badge size="xl" radius="md" fullWidth h={34} variant="filled" color="blue">
                                {totalServicios || '0'}
                            </Badge>
                        </Box>
                    </SimpleGrid>

                    {periodo && periodo !== 'No Aplica' && frecuencia && factor && totalServicios && (
                        <Text size="xs" c="dimmed" fs="italic" mt={-4} ta="center">
                            Se realizarán <Text component="span" fw={700} size="xs">{totalServicios}</Text> muestreo(s) en total, con una frecuencia de <Text component="span" fw={700} size="xs">{frecuencia}</Text> vez/veces cada periodo <Text component="span" fw={700} size="xs">{frecuenciasData.find(f => f.value === periodo)?.label?.toLowerCase() || periodo}</Text>, multiplicado por un factor de <Text component="span" fw={700} size="xs">{factor}</Text>.
                        </Text>
                    )}
                </Stack>
            </Paper>

            {/* Block 3: Clasificación Técnica */}
            <Paper withBorder p="md" radius="lg" shadow="xs" style={{ width: '100% !important' }}>
                <Stack gap="md">
                    <Group gap="xs">
                        <IconCertificate size={18} color="var(--mantine-color-teal-6)" />
                        <Text fw={700} size="sm" c="teal.7">Clasificación Técnica y Geográfica</Text>
                    </Group>

                    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                        <Select 
                            label={<FieldLabel label="Zona UTM *" help="Huso o banda de la cuadrícula UTM donde se ubica el punto de muestreo. En Chile continental se usa mayoritariamente la Zona 19S. Selecciónela según la ubicación geográfica del centro." />}
                            data={zonasUTMData}
                            value={zona}
                            onChange={(v) => setZona(v || '')}
                            size="sm"
                            radius="md"
                        />
                        <TextInput 
                            label={<FieldLabel label="UTM Norte *" help="Coordenada Norte en sistema de coordenadas UTM. Es el valor de latitud expresado en metros. Ejemplo: 5837000. Debe ser un número de 7 dígitos aproximadamente." />}
                            value={utmNorte} 
                            onChange={(e: any) => setUtmNorte(e.target.value)} 
                            disabled={!zona || zona === 'No aplica'}
                            size="sm"
                            radius="md"
                        />
                        <TextInput 
                            label={<FieldLabel label="UTM Este *" help="Coordenada Este en sistema UTM. Es el valor de longitud expresado en metros. Ejemplo: 672000. Debe ser un número de 6 dígitos aproximadamente." />}
                            value={utmEste} 
                            onChange={(e: any) => setUtmEste(e.target.value)} 
                            disabled={!zona || zona === 'No aplica'}
                            size="sm"
                            radius="md"
                        />
                    </SimpleGrid>

                    <Divider />

                    <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
                        <Box style={{ gridColumn: isVerySmall ? 'span 1' : 'span 2' }}>
                            <Select
                                label={<FieldLabel label="Instrumento Ambiental *" help="Marco regulatorio o norma legal que obliga a realizar este muestreo. Ejemplos: RCA (Resolución de Calificación Ambiental), DS90, D.S. 46. Seleccione 'No aplica' si no existe obligación regulatoria." />}
                                data={instrumentosAmbientales}
                                value={selectedInstrumento}
                                onChange={(val) => {
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
                                searchable
                                size="sm"
                                radius="md"
                            />
                        </Box>
                        <TextInput
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
                            size="sm"
                            radius="md"
                        />
                        <TextInput
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
                            size="sm"
                            radius="md"
                        />
                    </SimpleGrid>

                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <Select 
                            label={<FieldLabel label="Componente Ambiental *" help="Componente del medio ambiente al que corresponde la muestra. Ejemplos: Agua Superficial, Agua Marina, Sedimento, Atmósfera. Al seleccionarlo se cargarán las Sub Áreas disponibles." />}
                            data={componentesData}
                            value={selectedComponente}
                            onChange={handleComponenteChange}
                            size="sm"
                            radius="md"
                        />
                        <Select 
                            label={<FieldLabel label="Sub Área *" help="Clasificación más específica dentro del componente ambiental seleccionado. Depende del Componente elegido anteriormente." />}
                            data={subAreasData}
                            value={selectedSubArea}
                            onChange={(v) => setSelectedSubArea(v || '')}
                            disabled={!selectedComponente}
                            size="sm"
                            radius="md"
                        />
                    </SimpleGrid>

                    <TextInput 
                        label={<FieldLabel label="Nombre de la Tabla (Glosa) *" help="Nombre descriptivo que identificará la tabla de resultados en el informe final. Se autocompleta como: 'Nombre del Centro - Objetivo del Muestreo'. Puede editarse libremente. Máximo 100 caracteres." />}
                        value={glosa} 
                        onChange={(e: any) => setGlosa(e.target.value)} 
                        maxLength={100}
                        description={`${glosa.length}/100 caracteres`}
                        size="sm"
                        radius="md"
                    />

                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                        <Select label={<FieldLabel label="¿Es ETFA?" help="Indica si el establecimiento es una Empresa de Tratamiento de Fangs y Aguas (ETFA). Se activa automáticamente al seleccionar un instrumento ambiental válido. Puede modificarse manualmente." />} data={['Si', 'No']} value={esETFA} onChange={(val) => setEsETFA(val || 'No')} size="sm" radius="md" />
                        <Select 
                            label={<FieldLabel label="Inspector Ambiental" help="Profesional inspector de ADL designado para supervisar este muestreo. Campo opcional disponible solo cuando el responsable es ADL." />}
                            data={inspectoresData}
                            value={selectedInspector}
                            onChange={(val) => setSelectedInspector(val || '')}
                            disabled={responsableMuestreo !== 'ADL'}
                            size="sm"
                            radius="md"
                        />
                    </SimpleGrid>
                </Stack>
            </Paper>

            {/* Block 4: Detalles Operativos */}
            <Paper withBorder p="md" radius="lg" shadow="xs">
                <Stack gap="md">
                    <Group gap="xs">
                        <IconClock size={18} color="var(--mantine-color-orange-6)" />
                        <Text fw={700} size="sm" c="orange.7">Detalles Operativos y Descarga</Text>
                    </Group>

                    <SimpleGrid cols={{ base: 1, sm: 3, md: 5 }} spacing="sm">
                        <Select 
                            label={<FieldLabel label="Tipo Muestreo *" help="Metodología general de recolección de la muestra. Ejemplos: Simple (grab), Integrado, Compuesto. Al seleccionarlo se cargarán los Tipos de Muestra disponibles." />}
                            data={tiposMuestreoData}
                            value={selectedTipoMuestreo}
                            onChange={handleTipoMuestreoChange}
                            size="sm"
                            radius="md"
                        />
                        <Select 
                            label={<FieldLabel label="Tipo Muestra *" help="Material físico que se recolectará. Ejemplos: Agua Superficial, Sedimento, Biota, Efluente. Depende del Tipo de Muestreo seleccionado." />}
                            data={tiposMuestraData}
                            value={selectedTipoMuestra}
                            onChange={handleTipoMuestraChange}
                            disabled={!selectedTipoMuestreo}
                            size="sm"
                            radius="md"
                        />
                        <Select 
                            label={<FieldLabel label="Actividad *" help="Técnica o procedimiento específico para obtener la muestra. Ejemplos: Tomada con balde, Bomba peristáltica, Red de arrastre. Depende del Tipo de Muestra." />}
                            data={actividadesData}
                            value={selectedActividad}
                            onChange={(val) => setSelectedActividad(val || '')}
                            disabled={!selectedTipoMuestra}
                            size="sm"
                            radius="md"
                        />
                        {/* ✅ PUNTUAL: muestreo de un solo día → no se pide duración. Solo aplica en Compuesta. */}
                        {tipoMonitoreo !== 'Puntual' && (
                            <TextInput
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
                                size="sm"
                                radius="md"
                            />
                        )}
                        <Select 
                            label={<FieldLabel label="Tipo Descarga *" help="Clasificación del tipo de descarga del establecimiento según la normativa ambiental. Ejemplos: Punto de Descarga, Cuerpo Receptor. Requerido para la clasificación del informe." />}
                            data={tiposDescargaData}
                            value={selectedTipoDescarga}
                            onChange={(val) => setSelectedTipoDescarga(val || '')}
                            size="sm"
                            radius="md"
                        />
                    </SimpleGrid>

                    <Stack gap={6}>
                        <Group align="flex-end" gap="xs">
                            <Box style={{ flex: 1 }}>
                                <TextInput
                                    label={<FieldLabel label="Referencia Google Maps" help="Enlace de Google Maps o coordenadas geográficas (latitud,longitud) del punto de muestreo. Permite geolocalizar el centro en el planificador de rutas. Ejemplo: https://maps.app.goo.gl/XYZ o -41.45,-72.92" />}
                                    description="Si no es ingresada, esta ficha quedará inhabilitada para generación de rutas."
                                    placeholder="https://maps.app.goo.gl/... o -41.45,-72.92"
                                    value={refGoogle}
                                    onChange={(e: any) => setRefGoogle(e.target.value)}
                                    onBlur={() => { if (refGoogle.trim() && verifyStatus === 'idle') handleVerifyLink(); }}
                                    size="sm"
                                    radius="md"
                                    error={verifyStatus === 'invalid' ? verifyError : undefined}
                                    rightSection={verifyStatus === 'loading' ? <Loader size={14} /> : undefined}
                                />
                            </Box>
                            <Button
                                size="sm"
                                variant="light"
                                color="blue"
                                onClick={handleVerifyLink}
                                loading={verifyStatus === 'loading'}
                                disabled={!refGoogle.trim()}
                                style={{ flexShrink: 0 }}
                            >
                                Verificar
                            </Button>
                        </Group>

                        {verifyStatus === 'ok' && verifiedCoords && (
                            <Stack gap={6}>
                                <Alert color="green" icon={<IconCheck size={16} />} p="xs" radius="md">
                                    <Group gap="xs" justify="space-between" wrap="nowrap">
                                        <Text size="xs" fw={500}>
                                            Ubicación detectada — Lat: {verifiedCoords.lat.toFixed(6)} · Lon: {verifiedCoords.lon.toFixed(6)}
                                        </Text>
                                        <Anchor
                                            href={`https://www.google.com/maps?q=${verifiedCoords.lat},${verifiedCoords.lon}`}
                                            target="_blank"
                                            size="xs"
                                            style={{ flexShrink: 0 }}
                                        >
                                            <Group gap={4} wrap="nowrap">
                                                <IconExternalLink size={12} />
                                                Abrir
                                            </Group>
                                        </Anchor>
                                    </Group>
                                </Alert>
                                <Box style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--mantine-color-green-3)', height: 200 }}>
                                    <iframe
                                        title="Ubicación en mapa"
                                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${verifiedCoords.lon - 0.01},${verifiedCoords.lat - 0.01},${verifiedCoords.lon + 0.01},${verifiedCoords.lat + 0.01}&layer=mapnik&marker=${verifiedCoords.lat},${verifiedCoords.lon}`}
                                        width="100%"
                                        height="200"
                                        style={{ border: 'none', display: 'block' }}
                                        loading="lazy"
                                    />
                                </Box>
                            </Stack>
                        )}

                        {verifyStatus === 'warn' && (
                            <Alert color="orange" icon={<IconAlertTriangle size={16} />} p="xs" radius="md">
                                <Text size="xs">{verifyError}</Text>
                            </Alert>
                        )}
                    </Stack>

                    <Divider label="Hidráulica y Caudal" labelPosition="center" />

                    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                        <Select 
                            label={<FieldLabel label="Medición Caudal" help="Indica si se medirá el caudal de la descarga y cómo. Manual: se mide en terreno por el muestreador. Automático: existe un caudalímetro instalado. No Aplica: no se mide caudal." />}
                            data={['Manual', 'Automático', 'No Aplica']} 
                            value={medicionCaudal} 
                            onChange={(val) => setMedicionCaudal(val || '')}
                            size="sm"
                            radius="md"
                        />
                        <Select
                            label={<FieldLabel label="Modalidad" help="Método hidráulico para medir el caudal. Se activa solo si la Medición de Caudal no es 'No Aplica'. Determina qué campos de canal y dispositivo se requieren." />}
                            data={modalidadesData}
                            value={selectedModalidad}
                            onChange={(val) => setSelectedModalidad(val || '')}
                            disabled={isNoAplicaValue(medicionCaudal)}
                            size="sm"
                            radius="md"
                        />
                        <Stack gap={4}>
                            <Select
                                label={<FieldLabel label="Forma Canal" help="Geometría del canal o sección de descarga donde se medirá el caudal. Ejemplos: Rectangular, Trapezoidal, Circular. Determina la fórmula hidráulica que se aplicará." />}
                                data={formasCanalData}
                                value={formaCanal}
                                onChange={(val) => setFormaCanal(val || '')}
                                disabled={isNoAplicaValue(selectedModalidad, modalidades)}
                                size="xs"
                                radius="md"
                            />
                            <Group gap={4} grow>
                                <Select
                                    placeholder="Unidad"
                                    data={unidadesMedida}
                                    value={tipoMedidaCanal}
                                    onChange={(val) => setTipoMedidaCanal(val || '')}
                                    disabled={isNoAplicaValue(formaCanal, formasCanal)}
                                    size="xs"
                                    radius="md"
                                />
                                <TextInput
                                    placeholder="Valor"
                                    value={detalleCanal}
                                    onChange={(e: any) => setDetalleCanal(e.target.value)}
                                    disabled={!tipoMedidaCanal}
                                    size="xs"
                                    radius="md"
                                />
                            </Group>
                        </Stack>
                        <Stack gap={4}>
                            <Select
                                label={<FieldLabel label="Dispositivo Hidr." help="Instrumento o equipo utilizado para medir el caudal del dispositivo de descarga. Ejemplos: Caudalímetro electromagnético, Aforador Parshall, Vertedero. Seleccione 'No Aplica' si no existe dispositivo." />}
                                data={dispositivosData}
                                value={dispositivo}
                                onChange={(val) => setDispositivo(val || '')}
                                disabled={isNoAplicaValue(selectedModalidad, modalidades)}
                                size="xs"
                                radius="md"
                            />
                            <Group gap={4} grow>
                                <Select
                                    placeholder="Unidad"
                                    data={unidadesMedida}
                                    value={tipoMedidaDispositivo}
                                    onChange={(val) => setTipoMedidaDispositivo(val || '')}
                                    disabled={isNoAplicaValue(dispositivo, dispositivos)}
                                    size="xs"
                                    radius="md"
                                />
                                <TextInput 
                                    placeholder="Valor" 
                                    value={detalleDispositivo} 
                                    onChange={(e: any) => setDetalleDispositivo(e.target.value)} 
                                    disabled={!tipoMedidaDispositivo}
                                    size="xs"
                                    radius="md"
                                />
                            </Group>
                        </Stack>
                    </SimpleGrid>
                </Stack>
            </Paper>

            <CreateEmpresaServicioModal 
                opened={createEmpresaOpened}
                onClose={() => setCreateEmpresaOpened(false)}
                onCreated={() => {
                    loadEmpresas(); // Refrescar catálogo
                }}
            />
        </Stack>
    );
});
