import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { catalogosService } from '../services/catalogos.service';
import { fichaService } from '../services/ficha.service';
import { getNotificationSocket } from '../../../store/notificationStore';
import { useFichasFiltersStore } from '../store/fichasFiltersStore';
import { PageHeader } from '../../../components/layout/PageHeader';
import { FichaUniversalView } from '../components/FichaUniversalView';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
    IconCalendar,
    IconChevronLeft,
    IconChevronRight,
    IconFilter,
    IconSearch,
    IconX,
    IconDeviceFloppy,
    IconAlertCircle
} from '@tabler/icons-react';

interface Props {
    onBackToMenu: () => void;
}

interface FichaEvento {
    id: number;
    id_agenda: number;
    id_muestreador?: number | null;
    id_muestreador2?: number | null;
    correlativo: string;
    ficha_correlativo?: string;
    frecuencia_correlativo?: string;
    fecha: string;
    muestreador: string;
    dia: number;
    mes: number;
    ano: number;
    centro: string;
    fecha_retiro?: string;
    fichaingresoservicio?: string | number;
    id_fichaingresoservicio?: string | number;
    glosa?: string;
    tipo_ficha?: string;
    contacto?: string;
    correo_empresa?: string;
    correo_contacto?: string;
    objetivo?: string;
    empresa_servicio?: string;
    subarea?: string;
    estado_caso?: string;
    id_validaciontecnica?: number;
    muestreador_retiro?: string;
    motivo_cancelacion?: string;
    id_estadomuestreo?: number | null;
    instalacion_completado?: string | null;
    retiro_completado?: string | null;
    realizado_por_gem?: string | null;
    es_remuestreo?: string | null;
    id_ficha_original?: number | null;
    cliente?: string;
    email_cliente?: string;
    base_operaciones?: string;
    id_grupo?: number | null;
    punto_muestreo?: string;
}

interface CalendarEvent extends FichaEvento {
    tipo_evento: 'INICIO' | 'RETIRO';
    event_dia: number;
    event_mes: number;
    event_ano: number;
}

// Junta en un bloque los puntos de una misma visita (mismo grupo, mismo tipo de evento y mismo número de servicio "X-Y-...").
// Los eventos sin grupo quedan como bloques de un solo elemento, en su posición original.
function agruparPorVisita(events: CalendarEvent[]): CalendarEvent[][] {
    const bloques: CalendarEvent[][] = [];
    const porClave = new Map<string, CalendarEvent[]>();
    events.forEach((ev) => {
        if (ev.id_grupo == null) { bloques.push([ev]); return; }
        const servicio = (ev.correlativo || '').split('-')[1] || '';
        const clave = `${ev.id_grupo}|${ev.tipo_evento}|${servicio}`;
        const existente = porClave.get(clave);
        if (existente) existente.push(ev);
        else { const nuevo = [ev]; porClave.set(clave, nuevo); bloques.push(nuevo); }
    });
    return bloques;
}

interface UpdateAgendaPayload {
    assignments: Array<{
        id: number;
        fecha: string;
        fechaRetiro: string;
        idMuestreadorInstalacion: number;
        idMuestreadorRetiro: number;
        idFichaIngresoServicio: number;
        frecuenciaCorrelativo: string;
    }>;
    user: { id: number; usuario: string };
}

// Estados sobre los colores del tema: pendiente = warning, realizada = success, NO realizada = destructive, cancelada = gris (muted).
// (Los nombres de las claves son históricos: 'red' es «cancelada» y 'violet' es «no realizada».)
const STATUS_HEX: Record<string, string> = { orange: 'var(--sc-warning)', green: 'var(--sc-success)', red: 'var(--sc-muted-foreground)', violet: 'var(--sc-destructive)' };
const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'destructive' | 'secondary'> = { orange: 'warning', green: 'success', red: 'secondary', violet: 'destructive' };

// Estado de un servicio (funciones puras: se usan también para filtrar).
const evCancelado = (ev: { estado_caso?: string; motivo_cancelacion?: string }) => {
    const x = (ev.estado_caso || ev.motivo_cancelacion || '').toUpperCase();
    return x.includes('CANCELAD') || x.includes('ANULAD');
};
const evEjecutado = (ev: { id_estadomuestreo?: number | null; realizado_por_gem?: string | null; tipo_evento?: string; instalacion_completado?: string | null; retiro_completado?: string | null; estado_caso?: string }) => {
    if (ev.id_estadomuestreo === 3) return true;
    if (ev.realizado_por_gem) return true;
    if (ev.tipo_evento === 'INICIO' && ev.instalacion_completado === 'S') return true;
    if (ev.tipo_evento === 'RETIRO' && ev.retiro_completado === 'S') return true;
    const x = (ev.estado_caso || '').toUpperCase();
    return x.includes('EJECUTADO') || x.includes('REALIZADO') || x.includes('COMPLETADO');
};
// «No realizada»: la fecha ya pasó y no se ejecutó ni se canceló.
const evNoRealizado = (ev: { event_dia: number; event_mes: number; event_ano: number } & Parameters<typeof evEjecutado>[0] & Parameters<typeof evCancelado>[0]) => {
    if (evCancelado(ev) || evEjecutado(ev)) return false;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    return new Date(ev.event_ano, ev.event_mes - 1, ev.event_dia) < hoy;
};
const ESTADOS_FILTRO = [
    { value: 'pendiente', label: 'Pendiente' },
    { value: 'realizada', label: 'Realizada' },
    { value: 'no_realizada', label: 'No realizada' },
    { value: 'cancelada', label: 'Cancelada' },
];
const estadoClave = (ev: Parameters<typeof evNoRealizado>[0]) => (evCancelado(ev) ? 'cancelada' : evEjecutado(ev) ? 'realizada' : evNoRealizado(ev) ? 'no_realizada' : 'pendiente');

const StaticField = ({ label, value }: { label: string; value: any }) => (
    <div>
        <span className="block text-[11px] font-bold uppercase text-muted-foreground">{label}</span>
        <div className="mt-0.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5">
            <span className="block truncate text-[13.5px] font-medium" title={String(value || '-')}>
                {value || '-'}
            </span>
        </div>
    </div>
);

function SectionDivider({ children }: { children?: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            {children && <span className="text-xs text-primary">{children}</span>}
            <div className="h-px flex-1 bg-border" />
        </div>
    );
}

export const EnProcesoCalendarView: React.FC<Props> = ({ onBackToMenu }) => {
    const { showToast } = useToast();
    const { user, hasPermission } = useAuth();
    const isMobile = useMediaQuery('(max-width: 768px)');
    const isCompact = useMediaQuery('(max-width: 1200px)');
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [fichas, setFichas] = useState<FichaEvento[]>([]);
    // Filtros persistidos fuera del componente (ver fichasFiltersStore): esta vista
    // vuelve a montarse limpia al volver desde el menú, perdiendo un useState local.
    const { selectedEmpresa, selectedMuestreador, selectedCentro, selectedPrograma, selectedEstado, searchTerm } = useFichasFiltersStore((s) => s.calendario);
    const resetCalendarioFiltros = useFichasFiltersStore((s) => s.resetCalendario);
    const setCalendarioFiltros = useFichasFiltersStore((s) => s.setCalendario);
    const setSelectedEmpresa = (v: string) => setCalendarioFiltros({ selectedEmpresa: v });
    const setSelectedMuestreador = (v: string) => setCalendarioFiltros({ selectedMuestreador: v });
    const setSelectedCentro = (v: string) => setCalendarioFiltros({ selectedCentro: v });
    const setSearchTerm = (v: string) => setCalendarioFiltros({ searchTerm: v });
    const setSelectedPrograma = (v: string) => setCalendarioFiltros({ selectedPrograma: v });
    const setSelectedEstado = (v: string) => setCalendarioFiltros({ selectedEstado: v });
    const [viewMode, setViewMode] = useState<'month' | 'day' | 'week' | 'year'>('month');
    const [showFilters, setShowFilters] = useState(false);
    // Semana: por día (columnas de día con sus muestreadores) o por muestreador (una fila por muestreador).
    const [semanaPor, setSemanaPor] = useState<'dias' | 'muestreadores'>('dias');
    // Reprogramar una visita completa (nueva fecha y muestreador)
    const [showReagendar, setShowReagendar] = useState(false);
    const [reagFecha, setReagFecha] = useState('');
    const [reagMuestreador, setReagMuestreador] = useState('');
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [detailFichaId, setDetailFichaId] = useState<number | null>(null);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [showQuitarAsig, setShowQuitarAsig] = useState(false);
    // Visita (varios puntos del mismo grupo, día y servicio) abierta como un todo, y sus acciones.
    const [visita, setVisita] = useState<CalendarEvent[] | null>(null);
    const [showQuitarVisita, setShowQuitarVisita] = useState(false);
    const [showCancelVisita, setShowCancelVisita] = useState(false);
    // Si no es null, el diálogo «cancelar» afecta solo a ese punto de la visita (no a toda).
    const [soloPunto, setSoloPunto] = useState<CalendarEvent | null>(null);
    const [cancelReason, setCancelReason] = useState('');

    const [isEditingDate, setIsEditingDate] = useState(false);
    const [isEditingSampler, setIsEditingSampler] = useState(false);
    const [editedDate, setEditedDate] = useState('');
    const [editedSamplerId, setEditedSamplerId] = useState<number | ''>('');
    const [cancellationReasons, setCancellationReasons] = useState<any[]>([]);
    const [selectedReasonId, setSelectedReasonId] = useState<number | ''>('');
    // Otros puntos de la misma visita que se pueden cancelar junto con este muestreo.
    const [puntosVisita, setPuntosVisita] = useState<{ id_agenda: number; id_ficha: number; punto: string | null }[]>([]);
    const [puntosACancelar, setPuntosACancelar] = useState<Set<number>>(new Set());
    const [isSavingEvent, setIsSavingEvent] = useState(false);
    const [showVersionPrompt, setShowVersionPrompt] = useState(false);
    const [pendingPayload, setPendingPayload] = useState<UpdateAgendaPayload | null>(null);
    const [showReactivateConfirm, setShowReactivateConfirm] = useState(false);
    const [isReactivating, setIsReactivating] = useState(false);

    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const filterPanelRef = useRef<HTMLDivElement>(null);

    const [globalMuestreadores, setGlobalMuestreadores] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const lastFetchRef = useRef<string>('');


    useEffect(() => {
        const loadCatalogs = async () => {
            try {
                const [mData, rData] = await Promise.all([
                    catalogosService.getMuestreadores(),
                    catalogosService.getMotivosCancelacion()
                ]);
                setGlobalMuestreadores(mData || []);
                setCancellationReasons(rData || []);
            } catch (error) {
                console.error("Error cargando catálogos para filtros:", error);
            }
        };
        loadCatalogs();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // Las listas de los selectores (Combobox) se dibujan en un portal FUERA del panel: elegir una opción no es un «clic afuera».
            const alvo = event.target as HTMLElement | null;
            if (alvo?.closest?.('[data-radix-popper-content-wrapper], [data-radix-portal], [role="listbox"], [role="dialog"]')) return;
            if (showFilters && filterPanelRef.current && !filterPanelRef.current.contains(event.target as Node)) {
                setShowFilters(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showFilters]);

    useEffect(() => {
        if (selectedEvent) {
            setIsEditingDate(false);
            setIsEditingSampler(false);
            setIsSavingEvent(false);

            let currentEvDate = selectedEvent.fecha;
            if (selectedEvent.tipo_evento === 'RETIRO' && selectedEvent.fecha_retiro) {
                currentEvDate = selectedEvent.fecha_retiro;
            }

            const currDateObj = currentEvDate ? new Date(currentEvDate) : new Date();
            const dateStr = `${currDateObj.getUTCFullYear()}-${String(currDateObj.getUTCMonth() + 1).padStart(2, '0')}-${String(currDateObj.getUTCDate()).padStart(2, '0')}`;
            setEditedDate(dateStr);
            // C-06: usar muestreador correcto según tipo de evento
            const correctSamplerId = selectedEvent.tipo_evento === 'RETIRO'
                ? (selectedEvent.id_muestreador2 || selectedEvent.id_muestreador)
                : selectedEvent.id_muestreador;
            setEditedSamplerId(correctSamplerId || '');
        }
    }, [selectedEvent]);

    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    const loadData = useCallback(async (force = false) => {
        const month = currentMonth.getMonth() + 1;
        const year = currentMonth.getFullYear();
        const fetchKey = `${viewMode}-${month}-${year}`;

        if (!force && lastFetchRef.current === fetchKey) return;

        setIsLoading(true);
        try {
            let response;
            if (viewMode === 'year') {
                response = await fichaService.getEnProceso(undefined, year);
            } else {
                response = await fichaService.getEnProceso(month, year);
            }

            let data: FichaEvento[] = [];
            if (Array.isArray(response)) data = response;
            else if (response && response.data && Array.isArray(response.data)) data = response.data;
            else if (response && Array.isArray(response.recordset)) data = response.recordset;

            setFichas(data || []);
            lastFetchRef.current = fetchKey;
        } catch (error) {
            console.error('Error loading calendar data:', error);
            showToast({ type: 'error', message: 'Error cargando el calendario de fichas.' });
        } finally {
            setIsLoading(false);
        }
    }, [currentMonth, showToast, viewMode]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Varios coordinadores editan el mismo calendario en simultáneo — sin esto,
    // cada uno solo ve las reprogramaciones/cancelaciones de los demás al
    // recargar la página manualmente. Reusa la conexión Socket.IO ya abierta
    // por notificationStore en vez de crear una segunda.
    useEffect(() => {
        const socket = getNotificationSocket();
        if (!socket) return;
        const onCalendarioActualizado = () => loadData(true);
        socket.on('calendario:actualizado', onCalendarioActualizado);
        return () => { socket.off('calendario:actualizado', onCalendarioActualizado); };
    }, [loadData]);

    const changeViewDate = (offset: number) => {
        const next = new Date(currentMonth);
        if (viewMode === 'month') {
            next.setMonth(currentMonth.getMonth() + offset);
        } else if (viewMode === 'day') {
            next.setDate(currentMonth.getDate() + offset);
        } else if (viewMode === 'week') {
            next.setDate(currentMonth.getDate() + (offset * 7));
        } else if (viewMode === 'year') {
            next.setFullYear(currentMonth.getFullYear() + offset);
        }
        setCurrentMonth(next);
        if (viewMode === 'day') {
            setSelectedDay(next.getDate());
        }
    };

    const allEvents = useMemo(() => {
        const events: CalendarEvent[] = [];
        fichas.forEach(f => {
            events.push({
                ...f,
                tipo_evento: 'INICIO',
                event_dia: Number(f.dia),
                event_mes: Number(f.mes),
                event_ano: Number(f.ano)
            });

            // ✅ PUNTUAL: un solo día/proceso (instalación = retiro). No se genera evento RETIRO
            // separado para no duplicar la ficha en el calendario. Solo las compuestas lo tienen.
            const esPuntual = (f.tipo_ficha || '').toString().trim().toLowerCase() === 'puntual';
            if (!esPuntual && f.fecha_retiro && f.fecha_retiro !== '01/01/1900') {
                const dRetiro = new Date(f.fecha_retiro);
                events.push({
                    ...f,
                    tipo_evento: 'RETIRO',
                    event_dia: dRetiro.getUTCDate(),
                    event_mes: dRetiro.getUTCMonth() + 1,
                    event_ano: dRetiro.getUTCFullYear()
                });
            }
        });
        return events;
    }, [fichas]);

    const filteredEvents = useMemo(() => {
        return allEvents.filter(ev => {
            if (selectedEmpresa && ev.empresa_servicio !== selectedEmpresa) return false;
            if (selectedMuestreador && ev.muestreador !== selectedMuestreador) return false;
            if (selectedCentro && ev.centro !== selectedCentro) return false;
            if (selectedPrograma && (ev.objetivo || '') !== selectedPrograma) return false;
            if (selectedEstado && estadoClave(ev) !== selectedEstado) return false;
            if (searchTerm) {
                const search = searchTerm.toLowerCase();
                return (ev.empresa_servicio || '').toLowerCase().includes(search) ||
                    (ev.muestreador || '').toLowerCase().includes(search) ||
                    (ev.centro || '').toLowerCase().includes(search) ||
                    String(ev.fichaingresoservicio || '').toLowerCase().includes(search) ||
                    (ev.correlativo || '').toLowerCase().includes(search);
            }
            return true;
        });
    }, [allEvents, selectedEmpresa, selectedMuestreador, selectedCentro, selectedPrograma, selectedEstado, searchTerm]);
    const programas = useMemo(() => Array.from(new Set(allEvents.map((e) => (e.objetivo || '').trim()))).filter(Boolean).sort(), [allEvents]);
    const filtrosActivos = [searchTerm, selectedEmpresa, selectedMuestreador, selectedCentro, selectedPrograma, selectedEstado].filter(Boolean).length;

    const empresas = useMemo(() => Array.from(new Set(allEvents.map(e => (e.empresa_servicio || '').trim()))).filter(Boolean).sort(), [allEvents]);
    const muestreadores = useMemo(() => Array.from(new Set(allEvents.map(e => (e.muestreador || '').trim()))).filter(Boolean).sort(), [allEvents]);
    const muestreadorOptions = useMemo(() =>
        globalMuestreadores.map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador })),
        [globalMuestreadores]
    );

    // Al abrir la cancelación, trae los otros puntos de la visita que comparten este muestreo (si la ficha es de una visita).
    useEffect(() => {
        setPuntosVisita([]);
        setPuntosACancelar(new Set());
        if (!(showCancelConfirm || showQuitarAsig) || !selectedEvent?.id_agenda) return;
        let cancelado = false;
        fichaService.getPuntosVisita(Number(selectedEvent.id_agenda))
            .then(lista => { if (!cancelado) setPuntosVisita(lista); })
            .catch(() => { /* sin la lista se cancela solo este punto, como siempre */ });
        return () => { cancelado = true; };
    }, [showCancelConfirm, showQuitarAsig, selectedEvent?.id_agenda]);

    // Visita abierta: se relee la agenda cada 30 s y el modal refleja lo que los muestreadores van ejecutando.
    useEffect(() => {
        if (!visita) return;
        const t = setInterval(() => { loadData(true); }, 30000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [!!visita, loadData]);
    useEffect(() => {
        if (!visita) return;
        const ids = new Set(visita.map((v) => Number(v.id_agenda)));
        const tipo = visita[0].tipo_evento;
        const frescos = allEvents.filter((e) => ids.has(Number(e.id_agenda)) && e.tipo_evento === tipo);
        const firma = (l: CalendarEvent[]) => JSON.stringify(l.map((e) => [e.id_agenda, e.estado_caso, e.motivo_cancelacion, e.instalacion_completado, e.retiro_completado, e.id_estadomuestreo, e.realizado_por_gem, e.muestreador, e.fecha]));
        if (frescos.length === 0) { if (allEvents.length > 0) setVisita(null); return; }
        if (firma(frescos) !== firma(visita)) setVisita(frescos);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allEvents]);

    const cancellationOptions = useMemo(() =>
        cancellationReasons.map(r => ({ value: String(r.id_motivocancelacion), label: r.nombre_motivo })),
        [cancellationReasons]
    );
    const centros = useMemo(() => {
        const filtered = allEvents.filter(e => !selectedEmpresa || e.empresa_servicio === selectedEmpresa);
        return Array.from(new Set(filtered.map(e => (e.centro || '').trim()))).filter(Boolean).sort();
    }, [allEvents, selectedEmpresa]);


    useEffect(() => {
        if (selectedCentro && !centros.includes(selectedCentro)) {
            setSelectedCentro('');
        }
    }, [selectedEmpresa, centros, selectedCentro]);

    const monthName = currentMonth.toLocaleString('es-ES', { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    const isCancelledEvent = useCallback((ev: CalendarEvent) => {
        const s = (ev.estado_caso || ev.motivo_cancelacion || '').toUpperCase();
        return s.includes('CANCELAD') || s.includes('ANULAD');
    }, []);

    // ✅ PUNTUAL: muestreo de un solo día (sin instalación/retiro separados)
    const isPuntualEvent = useCallback((ev: CalendarEvent) => {
        return (ev.tipo_ficha || '').toString().trim().toLowerCase() === 'puntual';
    }, []);

    const isExecutedEvent = useCallback((ev: CalendarEvent) => {
        if (ev.id_estadomuestreo === 3) return true;
        if (ev.realizado_por_gem) return true;
        // Compuesta: cada tarjeta (INICIO/RETIRO) representa una visita distinta del
        // muestreador, así que se marca en verde apenas SU visita quedó completada,
        // sin esperar a que la ficha entera (instalación + retiro) esté cerrada.
        if (ev.tipo_evento === 'INICIO' && ev.instalacion_completado === 'S') return true;
        if (ev.tipo_evento === 'RETIRO' && ev.retiro_completado === 'S') return true;
        const s = (ev.estado_caso || '').toUpperCase();
        return s.includes('EJECUTADO') || s.includes('REALIZADO') || s.includes('COMPLETADO');
    }, []);

    const getStatusColor = useCallback((ev: CalendarEvent): 'orange' | 'green' | 'red' | 'violet' => {
        if (isCancelledEvent(ev)) return 'red';
        if (isExecutedEvent(ev)) return 'green';
        if (evNoRealizado(ev)) return 'violet';
        return 'orange';
    }, [isCancelledEvent, isExecutedEvent]);

    // Helper function to build the update payload with validation and date calculation
    const buildUpdatePayload = useCallback((): UpdateAgendaPayload | null => {
        if (!selectedEvent) return null;

        // Validation
        if (isEditingSampler && !editedSamplerId) {
            showToast({ type: 'warning', message: 'Debe seleccionar un muestreador válido' });
            return null;
        }

        if (isEditingDate && !editedDate) {
            showToast({ type: 'warning', message: 'Debe ingresar una fecha válida' });
            return null;
        }

        // Date calculation
        let finalFecha = selectedEvent.fecha;
        let finalFechaRetiro = selectedEvent.fecha_retiro;

        if (selectedEvent.tipo_evento === 'INICIO' && isEditingDate) {
            finalFecha = editedDate;
            if (selectedEvent.fecha && selectedEvent.fecha_retiro) {
                try {
                    const start = new Date(selectedEvent.fecha);
                    const end = new Date(selectedEvent.fecha_retiro);
                    const gapMs = end.getTime() - start.getTime();
                    if (gapMs >= 0) {
                        const newStart = new Date(editedDate + 'T00:00:00');
                        const newEnd = new Date(newStart.getTime() + gapMs);
                        const year = newEnd.getFullYear();
                        const month = String(newEnd.getMonth() + 1).padStart(2, '0');
                        const day = String(newEnd.getDate()).padStart(2, '0');
                        finalFechaRetiro = `${year}-${month}-${day}`;
                    }
                } catch (err) {
                    console.error('Error calculating retiro date:', err);
                }
            }
        } else if (selectedEvent.tipo_evento === 'RETIRO' && isEditingDate) {
            finalFechaRetiro = editedDate;
        }

        // Sampler ID extraction
        const currentSamplerId = isEditingSampler
            ? Number(editedSamplerId)
            : (selectedEvent.tipo_evento === 'INICIO'
                ? Number(selectedEvent.id_muestreador) || 0
                : Number(selectedEvent.id_muestreador2 || selectedEvent.id_muestreador) || 0);

        // Payload construction
        const payload: UpdateAgendaPayload = {
            assignments: [{
                id: selectedEvent.id_agenda,
                fecha: finalFecha || '',
                fechaRetiro: finalFechaRetiro || '',
                idMuestreadorInstalacion: selectedEvent.tipo_evento === 'INICIO' ? currentSamplerId : (Number(selectedEvent.id_muestreador) || 0),
                idMuestreadorRetiro: selectedEvent.tipo_evento === 'RETIRO' ? currentSamplerId : (Number(selectedEvent.id_muestreador2 || selectedEvent.id_muestreador) || 0),
                idFichaIngresoServicio: selectedEvent.id,
                frecuenciaCorrelativo: selectedEvent.correlativo
            }],
            user: { id: user?.id || 0, usuario: user?.name || 'Sistema' }
        };

        return payload;
    }, [selectedEvent, isEditingSampler, editedSamplerId, isEditingDate, editedDate, user, showToast]);

    const weekDays = useMemo(() => {
        const days = [];
        const startOfWeek = new Date(currentMonth);
        const day = currentMonth.getDay();
        const diff = currentMonth.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            days.push(d);
        }
        return days;
    }, [currentMonth]);

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    let firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    if (firstDayOfMonth === 0) firstDayOfMonth = 7;
    const emptyCells = firstDayOfMonth - 1;

    const calendarCells: (number | null)[] = [];
    for (let i = 0; i < emptyCells; i++) calendarCells.push(null);
    for (let i = 1; i <= daysInMonth; i++) calendarCells.push(i);

    const selectedDayEvents = useMemo(() => {
        if (selectedDay === null) return [];
        return filteredEvents.filter(f => f.event_dia === selectedDay && f.event_mes === currentMonth.getMonth() + 1 && f.event_ano === currentMonth.getFullYear());
    }, [selectedDay, filteredEvents, currentMonth]);

    const weekEvents = useMemo(() => {
        if (viewMode !== 'week') return [];
        const startOfWeek = new Date(currentMonth);
        const day = currentMonth.getDay();
        const diff = currentMonth.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        return filteredEvents.filter(ev => {
            const evDate = new Date(ev.event_ano, ev.event_mes - 1, ev.event_dia);
            return evDate >= startOfWeek && evDate <= endOfWeek;
        });
    }, [filteredEvents, viewMode, currentMonth]);

    const samplerGroups = useMemo(() => {
        if ((viewMode !== 'day' && viewMode !== 'week') || (selectedDay === null && viewMode === 'day')) return {};

        const groups: Record<string, CalendarEvent[]> = {};
        const eventsToGroup = viewMode === 'day' ? selectedDayEvents : weekEvents;

        const daySamplers = Array.from(new Set(eventsToGroup.map(ev => ev.muestreador || 'Sin Asignar')));
        daySamplers.sort().forEach(s => groups[s] = []);
        eventsToGroup.forEach(ev => {
            const key = ev.muestreador || 'Sin Asignar';
            groups[key].push(ev);
        });
        return groups;
    }, [selectedDayEvents, weekEvents, viewMode, selectedDay]);

    if (!hasPermission('MA_CALENDARIO_ACCESO')) {
        return (
            <div className="shadcn-scope flex flex-col items-center gap-4 p-8 text-center">
                <h2 className="text-2xl font-semibold text-muted-foreground">Acceso Denegado</h2>
                <p className="text-muted-foreground">No tiene permisos para ver el Calendario En Proceso.</p>
                <Button variant="outline" onClick={onBackToMenu}>Volver</Button>
            </div>
        );
    }

    if (detailFichaId) {
        return <FichaUniversalView fichaId={detailFichaId} onBack={() => setDetailFichaId(null)} onCambiarFicha={(id) => setDetailFichaId(id)} />;
    }

    // Fichas sueltas (sin visita) del mismo centro, mismo día y mismo muestreador que se pueden unir en una sola visita.
    const [agrupando, setAgrupando] = useState(false);
    const sueltasParaAgrupar = (evs: CalendarEvent[]): CalendarEvent[][] => {
        const mapa = new Map<string, CalendarEvent[]>();
        evs.forEach((ev) => {
            if (ev.id_grupo != null || isCancelledEvent(ev) || isExecutedEvent(ev)) return;
            const k = `${(ev.centro || '').trim()}|${(ev.empresa_servicio || '').trim()}|${ev.tipo_evento}`;
            mapa.set(k, [...(mapa.get(k) || []), ev]);
        });
        return [...mapa.values()].filter((g) => new Set(g.map((x) => Number(x.id))).size >= 2);
    };
    const agruparSueltas = async (grupo: CalendarEvent[]) => {
        setAgrupando(true);
        try {
            const ids = [...new Set(grupo.map((x) => Number(x.id)))].sort((a, b) => a - b);
            await fichaService.agrupar(ids, undefined, true);
            showToast({ type: 'success', message: `${ids.length} puntos agrupados como una sola visita` });
            lastFetchRef.current = '';
            loadData();
        } catch (err: any) {
            showToast({ type: 'error', message: err?.response?.data?.message || 'No se pudieron agrupar las fichas.' });
        } finally {
            setAgrupando(false);
        }
    };

    // Resumen de un conjunto de eventos en VISITAS (una visita = un servicio: varios puntos juntos o una ficha suelta).
    // Una visita está realizada cuando todos sus puntos vigentes se ejecutaron.
    const resumenDeEventos = (evs: CalendarEvent[]) => {
        const unicos = (f: (e: CalendarEvent) => string | undefined) => new Set(evs.map((e) => (f(e) || '').trim()).filter(Boolean)).size;
        const bloques = agruparPorVisita(evs);
        const vigentes = bloques.filter((b) => b.some((e) => !isCancelledEvent(e)));
        const realizadas = vigentes.filter((b) => b.filter((e) => !isCancelledEvent(e)).every((e) => isExecutedEvent(e))).length;
        const noRealizadas = vigentes.filter((b) => b.filter((e) => !isCancelledEvent(e)).some((e) => !isExecutedEvent(e)) && b.some((e) => evNoRealizado(e))).length;
        const r = { muestreadores: unicos((e) => e.muestreador), empresas: unicos((e) => e.empresa_servicio), centros: unicos((e) => e.centro), visitas: bloques.length, hechos: realizadas, vigentes: vigentes.length, noRealizadas, detalle: '' };
        r.detalle = `${r.visitas} ${r.visitas === 1 ? 'visita' : 'visitas'}\n${r.muestreadores} muestreadores · ${r.empresas} empresas · ${r.centros} centros\n${r.hechos} de ${r.vigentes} visitas realizadas${r.noRealizadas ? ` · ${r.noRealizadas} no realizadas` : ''}`;
        return r;
    };

    // Una visita con varios puntos se ve como UNA tarjeta: lo común una vez y los puntos como etiquetas. Al hacer clic se abre la visita completa.
    const TarjetaVisita = ({ bloque }: { bloque: CalendarEvent[] }) => {
        const base = bloque[0];
        const cancelados = bloque.filter((x) => isCancelledEvent(x)).length;
        const ejecutados = bloque.filter((x) => !isCancelledEvent(x) && isExecutedEvent(x)).length;
        const pendientes = bloque.length - cancelados - ejecutados;
        const noReal = pendientes > 0 && bloque.some((e) => evNoRealizado(e));
        const color = cancelados === bloque.length ? 'red' : (pendientes === 0 ? 'green' : noReal ? 'violet' : 'orange');
        const MAX = 6;
        const hechos = ejecutados;
        const total = bloque.length - cancelados;
        return (
            <button
                type="button"
                title="Abrir la visita completa"
                onClick={() => {
                    if (!hasPermission('FI_CAL_DETALLE')) { showToast({ type: 'warning', message: 'No tiene permisos para ver el detalle de este muestreo.' }); return; }
                    setVisita(bloque);
                }}
                className="flex w-full flex-col gap-1 rounded-md border border-border bg-card p-2 text-left transition-colors hover:border-primary hover:bg-primary/5"
                style={{ borderLeft: `4px solid ${STATUS_HEX[color]}` }}
            >
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wide text-primary">Visita · {bloque.length} puntos{base.tipo_evento === 'RETIRO' ? ' · retiro' : ''}</span>
                    <Badge variant={STATUS_VARIANT[color]} className="shrink-0 px-1 py-0 text-[10px] leading-[14px]">
                        {cancelados === bloque.length ? 'CANCEL.' : pendientes === 0 ? 'REALIZADA' : noReal ? 'NO REALIZADA' : ejecutados > 0 ? `${ejecutados} de ${total} REALIZ.` : 'AGENDADA'}
                    </Badge>
                </div>
                <span className="block truncate text-[15px] font-extrabold leading-tight" title={base.centro}>{base.centro}</span>
                <span className="block truncate text-xs font-medium text-muted-foreground" title={base.empresa_servicio}>{base.empresa_servicio}</span>
                {base.objetivo && <span className="w-fit max-w-full truncate rounded bg-primary/10 px-1.5 py-0 text-[10px] font-semibold text-primary" title="Programa (objetivo del muestreo)">{base.objetivo}</span>}
                {total > 0 && (
                    <div className="h-1 w-full overflow-hidden rounded bg-muted" title={`${hechos} de ${total} puntos ejecutados`}>
                        <div className="h-full bg-success" style={{ width: `${Math.round((hechos / total) * 100)}%` }} />
                    </div>
                )}
                <div className="mt-0.5 flex flex-wrap gap-1">
                    {bloque.slice(0, MAX).map((ev) => (
                        <span key={`${ev.id}-${ev.tipo_evento}`} className={cn('max-w-[120px] truncate rounded border border-border bg-muted/60 px-1.5 py-0 text-[10px]', isCancelledEvent(ev) && 'line-through opacity-60')} title={ev.punto_muestreo || ev.correlativo}>
                            {ev.punto_muestreo || ev.correlativo}
                        </span>
                    ))}
                    {bloque.length > MAX && <span className="rounded px-1 text-[10px] text-muted-foreground">+{bloque.length - MAX} más</span>}
                </div>
            </button>
        );
    };

    // Línea delgada para la vista semanal: centro, programa y estado (pendiente / realizada). El detalle está al hacer clic.
    const FilaDelgada = ({ bloque }: { bloque: CalendarEvent[] }) => {
        const base = bloque[0];
        const cancelados = bloque.filter((x) => isCancelledEvent(x)).length;
        const ejecutados = bloque.filter((x) => !isCancelledEvent(x) && isExecutedEvent(x)).length;
        const total = bloque.length - cancelados;
        const noReal = bloque.some((e) => evNoRealizado(e));
        const color = cancelados === bloque.length ? 'red' : (ejecutados === total ? 'green' : noReal ? 'violet' : 'orange');
        const estado = cancelados === bloque.length ? 'Cancelada' : ejecutados === total ? 'Realizada' : noReal ? 'No realizada' : ejecutados > 0 ? `${ejecutados}/${total} realizadas` : 'Pendiente';
        const abrir = () => {
            if (!hasPermission('FI_CAL_DETALLE')) { showToast({ type: 'warning', message: 'No tiene permisos para ver el detalle de este muestreo.' }); return; }
            if (bloque.length > 1) setVisita(bloque); else setSelectedEvent(base);
        };
        return (
            <button
                type="button"
                onClick={abrir}
                title={`${base.centro} · ${base.empresa_servicio}${bloque.length > 1 ? ` · visita de ${bloque.length} puntos` : ''}`}
                className="flex w-full flex-col gap-0.5 rounded border border-border bg-background px-1.5 py-1 text-left hover:border-primary hover:bg-primary/5"
                style={{ borderLeft: `3px solid ${STATUS_HEX[color]}` }}
            >
                <span className="block break-words text-[11px] font-bold leading-tight">{base.centro}{bloque.length > 1 ? ` · ${bloque.length} pts` : ''}</span>
                <span className="flex items-center justify-between gap-1 leading-tight">
                    <span className="min-w-0 truncate text-[10px] text-muted-foreground" title={base.objetivo || ''}>{base.objetivo || '—'}</span>
                    <span className="shrink-0 text-[10px] font-semibold" style={{ color: STATUS_HEX[color] }}>{estado}</span>
                </span>
            </button>
        );
    };

    const EventCard = ({ ev, compact }: { ev: CalendarEvent; compact?: boolean }) => {
        const statusColor = getStatusColor(ev);
        const cancelled = isCancelledEvent(ev);
        return (
            <div
                role="button"
                tabIndex={0}
                onClick={() => {
                    if (!hasPermission('FI_CAL_DETALLE')) {
                        showToast({ type: 'warning', message: 'No tiene permisos para ver el detalle de este muestreo.' });
                        return;
                    }
                    setSelectedEvent(ev);
                }}
                className={cn('cursor-pointer rounded-md border border-border bg-card', compact ? 'p-1.5' : 'p-2', cancelled && 'opacity-65')}
                style={{
                    borderLeft: `4px solid ${STATUS_HEX[statusColor]}`,
                    backgroundColor: cancelled ? 'color-mix(in srgb, var(--sc-muted-foreground) 10%, transparent)' : undefined
                }}
            >
                <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span
                        className={cn('truncate text-[10px] font-black', cancelled && 'line-through')}
                        style={{ color: STATUS_HEX[statusColor] }}
                    >
                        {ev.correlativo}
                    </span>
                    <Badge variant={STATUS_VARIANT[statusColor]} className={cn('shrink-0 px-1 py-0 leading-[14px]', compact ? 'text-[8px]' : 'text-[10px]')}>
                        {cancelled ? (compact ? 'C' : 'CANCEL.') : (isPuntualEvent(ev) ? (compact ? 'P' : 'PUNT.') : (compact ? ev.tipo_evento.charAt(0) : ev.tipo_evento))}
                    </Badge>
                </div>
                {ev.punto_muestreo ? (
                    <span className="block truncate text-xs font-bold" title={`Punto de muestreo: ${ev.punto_muestreo}`}>
                        Punto: {ev.punto_muestreo}
                    </span>
                ) : null}
                <span className={cn('block truncate', ev.punto_muestreo ? 'text-[11px] font-medium' : 'text-xs font-bold')} title={ev.empresa_servicio}>
                    {ev.empresa_servicio}
                </span>
                <span className="block truncate text-muted-foreground" style={{ fontSize: compact ? 9 : 10 }}>
                    {compact ? (ev.muestreador || 'Sin Asignar') : ev.centro}
                </span>
                {cancelled && ev.motivo_cancelacion && (
                    <span className="block truncate text-[9px] font-semibold text-destructive" title={ev.motivo_cancelacion}>
                        ⚠ {ev.motivo_cancelacion}
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="shadcn-scope">
            <PageHeader
                title="Calendario de Servicios"
                subtitle={!isCompact ? `${capitalizedMonth} ${currentMonth.getFullYear()}` : undefined}
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'Calendario Terreno' }
                ]}
                rightSection={
                    <div className={cn('flex items-center gap-2', isCompact && 'flex-wrap')}>
                        <Tabs
                            value={viewMode}
                            onValueChange={(v) => {
                                const val = v as typeof viewMode;
                                if (val === 'day') {
                                    const today = new Date();
                                    if (viewMode !== 'day' && selectedDay === null) {
                                        if (currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear()) {
                                            setSelectedDay(today.getDate());
                                        } else {
                                            setSelectedDay(1);
                                        }
                                    }
                                }
                                setViewMode(val);
                            }}
                        >
                            <TabsList>
                                <TabsTrigger value="month">Mes</TabsTrigger>
                                <TabsTrigger value="week">Semana</TabsTrigger>
                                <TabsTrigger value="day">Día</TabsTrigger>
                                <TabsTrigger value="year">Año</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => changeViewDate(-1)}>
                                <IconChevronLeft size={16} />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>Hoy</Button>
                            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => changeViewDate(1)}>
                                <IconChevronRight size={16} />
                            </Button>
                        </div>
                        <Button
                            variant={showFilters ? 'default' : 'outline'}
                            size="icon"
                            className="relative h-11 w-11 rounded-full"
                            title="Filtros Avanzados"
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <IconFilter size={20} />
                            {filtrosActivos > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{filtrosActivos}</span>}
                        </Button>
                    </div>
                }
            />

            {filtrosActivos > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5" aria-label="Filtros aplicados">
                    <span className="text-xs font-semibold text-muted-foreground">Filtrando por:</span>
                    {([
                        searchTerm && ['Búsqueda', searchTerm, () => setSearchTerm('')],
                        selectedEmpresa && ['Empresa', selectedEmpresa, () => setSelectedEmpresa('')],
                        selectedMuestreador && ['Muestreador', selectedMuestreador, () => setSelectedMuestreador('')],
                        selectedCentro && ['Centro', selectedCentro, () => setSelectedCentro('')],
                        selectedPrograma && ['Programa', selectedPrograma, () => setSelectedPrograma('')],
                        selectedEstado && ['Estado', ESTADOS_FILTRO.find((e) => e.value === selectedEstado)?.label || selectedEstado, () => setSelectedEstado('')],
                    ].filter(Boolean) as [string, string, () => void][]).map(([etiqueta, valor, quitar]) => (
                        <span key={etiqueta} className="inline-flex max-w-[260px] items-center gap-1 rounded-full border border-primary/40 bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs">
                            <span className="text-muted-foreground">{etiqueta}:</span>
                            <strong className="truncate" title={valor}>{valor}</strong>
                            <button type="button" aria-label={`Quitar el filtro ${etiqueta}`} title="Quitar este filtro" onClick={quitar} className="rounded-full p-0.5 hover:bg-primary/20">
                                <IconX size={12} />
                            </button>
                        </span>
                    ))}
                    {filtrosActivos > 1 && <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={resetCalendarioFiltros}>Limpiar todos</Button>}
                </div>
            )}

            {showFilters && (
                <div ref={filterPanelRef} className="mb-4 rounded-[10px] border border-border p-4">
                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                        <Field label="Buscar">
                            <div className="relative">
                                <IconSearch size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="N° ficha, correlativo, empresa, muestreador..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                        </Field>
                        <Field label="Empresa Servicio">
                            <Combobox placeholder="Todas" options={empresas.map(e => ({ value: e, label: e }))} value={selectedEmpresa} onValueChange={(v) => setSelectedEmpresa(v || '')} />
                        </Field>
                        <Field label="Muestreador">
                            <Combobox placeholder="Todos" options={muestreadores.map(m => ({ value: m, label: m }))} value={selectedMuestreador} onValueChange={(v) => setSelectedMuestreador(v || '')} />
                        </Field>
                        <Field label="Centro / Fuente">
                            <Combobox placeholder="Todos" options={centros.map(c => ({ value: c, label: c }))} value={selectedCentro} onValueChange={(v) => setSelectedCentro(v || '')} />
                        </Field>
                        <Field label="Programa">
                            <Combobox placeholder="Todos" options={programas.map(pr => ({ value: pr, label: pr }))} value={selectedPrograma} onValueChange={(v) => setSelectedPrograma(v || '')} />
                        </Field>
                        <Field label="Estado">
                            <Combobox placeholder="Todos" options={ESTADOS_FILTRO} value={selectedEstado} onValueChange={(v) => setSelectedEstado(v || '')} />
                        </Field>
                    </div>
                </div>
            )}

            <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Leyenda:</span>
                <Badge variant="warning">Pendiente</Badge>
                <Badge variant="success">Ejecutado</Badge>
                <Badge variant="destructive">Cancelado</Badge>
            </div>

            <div className="relative rounded-[10px] border border-border p-4">
                {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/75">
                        <div className="flex flex-col items-center gap-2">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            <span className="font-semibold text-primary">Cargando datos...</span>
                        </div>
                    </div>
                )}

                {viewMode === 'day' && selectedDay !== null && (
                    <div className="py-2">
                        <div className="mb-4 flex items-center justify-between">
                            <Button variant="ghost" onClick={() => { setViewMode('month'); setSelectedDay(null); }}>
                                <IconChevronLeft size={16} />
                                Volver al Mes
                            </Button>
                            <h4 className="m-0 text-lg font-semibold">{selectedDay} de {capitalizedMonth} de {currentMonth.getFullYear()}</h4>
                        </div>

                        <div className="max-h-[500px] overflow-y-auto">
                            {Object.entries(samplerGroups).length === 0 ? (
                                <div className="flex flex-col items-center gap-2 py-20">
                                    <IconCalendar size={48} className="text-muted-foreground" />
                                    <span className="text-base font-medium text-muted-foreground">No hay servicios para este dia</span>
                                </div>
                            ) : (
                                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                                    {Object.entries(samplerGroups).map(([muestreador, events]) => (
                                        <div key={muestreador} className="rounded-lg border border-border bg-muted/40 p-2.5">
                                            <div className="mb-2 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">
                                                        {muestreador.charAt(0)}
                                                    </div>
                                                    <span className="text-[13px] font-semibold">{muestreador}</span>
                                                </div>
                                                <Badge variant="secondary">{events.length}</Badge>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                {sueltasParaAgrupar(events).map((grupo) => (
                                                    <div key={`sueltas-${grupo[0].id}`} className="flex flex-col gap-1.5 rounded-md border border-primary/40 bg-primary/5 p-2 text-[11.5px]">
                                                        <span><strong>{grupo.length} fichas sueltas</strong> de {grupo[0].centro} el mismo día con el mismo muestreador. Pueden ser <strong>una sola visita</strong>.</span>
                                                        <ProtectedContent permission={['FI_CREAR', 'FI_GEST_ASIG']}>
                                                            <Button size="sm" variant="secondary" disabled={agrupando} onClick={() => agruparSueltas(grupo)}>Agrupar como visita de {grupo.length} puntos</Button>
                                                        </ProtectedContent>
                                                    </div>
                                                ))}
                                                {agruparPorVisita(events.sort((a, b) => a.correlativo.localeCompare(b.correlativo))).map((bloque) => (
                                                    bloque.length > 1 ? (
                                                        <TarjetaVisita key={`visita-${bloque[0].id_grupo}-${bloque[0].tipo_evento}-${bloque[0].id}`} bloque={bloque} />
                                                    ) : (
                                                        <EventCard key={`${bloque[0].id}-${bloque[0].tipo_evento}`} ev={bloque[0]} />
                                                    )
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {viewMode === 'month' && (
                    <div className="py-2">
                        {isCompact && (
                            <div className="mb-4 rounded-lg border border-border bg-accent p-2">
                                <div className="flex items-center justify-between">
                                    <Button variant="ghost" size="icon" className="rounded-full" onClick={() => changeViewDate(-1)}>
                                        <IconChevronLeft size={20} />
                                    </Button>
                                    <span className="text-[15px] font-semibold capitalize text-primary">{capitalizedMonth} {currentMonth.getFullYear()}</span>
                                    <Button variant="ghost" size="icon" className="rounded-full" onClick={() => changeViewDate(1)}>
                                        <IconChevronRight size={20} />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {(() => {
                            const delMes = filteredEvents.filter((ev) => ev.event_mes === currentMonth.getMonth() + 1 && ev.event_ano === currentMonth.getFullYear());
                            if (delMes.length === 0) return null;
                            const r = resumenDeEventos(delMes);
                            return (
                                <p className="mb-2 mt-0 text-xs text-muted-foreground">
                                    <strong className="text-foreground">{capitalizedMonth}:</strong> {r.visitas} {r.visitas === 1 ? 'visita' : 'visitas'} · {r.muestreadores} muestreadores con trabajo · {r.empresas} empresas · {r.centros} centros · {r.hechos} de {r.vigentes} visitas realizadas{r.noRealizadas > 0 && <strong style={{ color: STATUS_HEX.violet }}> · {r.noRealizadas} no realizadas</strong>}
                                </p>
                            );
                        })()}
                        <div className="mb-2 grid grid-cols-7" style={{ gap: isCompact ? 4 : 5 }}>
                            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                                <span key={d} className="text-center font-extrabold uppercase text-muted-foreground" style={{ fontSize: isCompact ? 10 : 12 }}>{d}</span>
                            ))}
                        </div>

                        <div className="grid grid-cols-7" style={{ gap: isCompact ? 4 : 5 }}>
                            {calendarCells.map((day, idx) => {
                                const events = day ? filteredEvents.filter(ev => ev.event_dia === day && ev.event_mes === currentMonth.getMonth() + 1 && ev.event_ano === currentMonth.getFullYear()) : [];
                                // Los puntos de una misma visita cuentan como un solo bloque ("Visita · N")
                                const bloques = agruparPorVisita(events);
                                const todayDate = new Date();
                                const isToday = day === todayDate.getDate() && currentMonth.getMonth() === todayDate.getMonth() && currentMonth.getFullYear() === todayDate.getFullYear();
                                const maxBadges = isCompact ? 3 : 2;

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => { if (day) { setSelectedDay(day); setViewMode('day'); } }}
                                        className={cn(
                                            'overflow-hidden rounded-lg border border-border',
                                            day ? 'cursor-pointer' : 'cursor-default opacity-30',
                                            day ? (isToday ? 'bg-accent shadow-[inset_0_0_0_1px_var(--sc-primary)]' : 'bg-card') : 'bg-transparent'
                                        )}
                                        style={{
                                            padding: isCompact ? 2 : 4,
                                            // 6 filas de celdas: cada píxel de alto se multiplica por 6.
                                            // A 120px la vista de mes no entraba en pantalla.
                                            height: isMobile ? 56 : (isCompact ? 96 : 104),
                                        }}
                                    >
                                        {day && (
                                            <>
                                                <div className="flex items-center justify-between" style={{ padding: `0 ${isCompact ? 2 : 4}px` }}>
                                                    <span
                                                        className={isToday ? 'text-primary' : 'text-foreground'}
                                                        style={{ fontSize: isCompact && !isMobile ? 13 : (isMobile ? 12 : 13), fontWeight: isToday ? 900 : 700 }}
                                                    >
                                                        {day}
                                                    </span>
                                                    {isMobile && bloques.length > 0 && (
                                                        <div className="flex gap-0.5">
                                                            {bloques.slice(0, 2).map((_, eidx) => (
                                                                <div key={eidx} className="h-1 w-1 rounded-full bg-primary" />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {!isMobile && events.length > 0 && (() => {
                                                    const resumen = resumenDeEventos(events);
                                                    return (
                                                        <div className="mt-0.5 flex flex-col gap-px leading-tight" title={resumen.detalle}>
                                                            <span className="font-bold text-primary" style={{ fontSize: isCompact ? 10 : 11 }}>
                                                                {resumen.visitas} {resumen.visitas === 1 ? 'visita' : 'visitas'}
                                                                {resumen.noRealizadas > 0 && <span style={{ color: STATUS_HEX.violet }}> · {resumen.noRealizadas} sin realizar</span>}
                                                            </span>
                                                            <span className="text-muted-foreground" style={{ fontSize: isCompact ? 9.5 : 10.5 }}>
                                                                {resumen.muestreadores} {resumen.muestreadores === 1 ? 'muestreador' : 'muestreadores'}
                                                            </span>
                                                            <span className="text-muted-foreground" style={{ fontSize: isCompact ? 9.5 : 10.5 }}>
                                                                {resumen.centros} {resumen.centros === 1 ? 'centro' : 'centros'}
                                                            </span>
                                                            <div className="mt-0.5 h-1 w-full overflow-hidden rounded bg-muted" title={`${resumen.hechos} de ${resumen.vigentes} visitas realizadas`}>
                                                                <div className="h-full bg-success" style={{ width: `${resumen.vigentes ? Math.round((resumen.hechos / resumen.vigentes) * 100) : 0}%` }} />
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {viewMode === 'week' && (
                    <div className="flex justify-end pb-1">
                        <Tabs value={semanaPor} onValueChange={(v) => setSemanaPor(v as 'dias' | 'muestreadores')}>
                            <TabsList>
                                <TabsTrigger value="dias">Por día</TabsTrigger>
                                <TabsTrigger value="muestreadores">Por muestreador</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                )}

                {viewMode === 'week' && semanaPor === 'muestreadores' && (() => {
                    const enSemana = weekDays.map((d) => filteredEvents.filter((ev) => ev.event_dia === d.getDate() && ev.event_mes === d.getMonth() + 1 && ev.event_ano === d.getFullYear()));
                    const nombres = Array.from(new Set(enSemana.flat().map((e) => e.muestreador || 'Sin asignar'))).sort((a, b) => a.localeCompare(b));
                    if (nombres.length === 0) {
                        return (
                            <div className="flex flex-col items-center gap-2 py-16">
                                <IconCalendar size={44} className="text-muted-foreground" />
                                <span className="text-sm font-medium text-muted-foreground">No hay visitas esta semana</span>
                            </div>
                        );
                    }
                    return (
                        <div className="overflow-x-auto py-2">
                            <table className="w-full min-w-[980px] border-collapse text-xs">
                                <thead>
                                    <tr>
                                        <th className="sticky left-0 z-10 w-44 border-b border-border bg-background px-2 py-1.5 text-left font-semibold text-muted-foreground">Muestreador</th>
                                        {weekDays.map((d, i) => {
                                            const esHoy = d.toDateString() === new Date().toDateString();
                                            return (
                                                <th key={i} className={cn('border-b border-border px-2 py-1.5 text-center font-semibold', esHoy ? 'bg-accent text-primary' : 'text-muted-foreground')}>
                                                    {d.toLocaleString('es-ES', { weekday: 'short' }).toUpperCase()} {d.getDate()}
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {nombres.map((nombre) => {
                                        const propios = enSemana.flat().filter((e) => (e.muestreador || 'Sin asignar') === nombre);
                                        const rs = resumenDeEventos(propios);
                                        return (
                                            <tr key={nombre} className="align-top">
                                                <td className="sticky left-0 z-10 border-b border-border bg-background px-2 py-1.5">
                                                    <div className="text-[13px] font-semibold leading-tight">{nombre}</div>
                                                    <div className="text-[10px] text-muted-foreground">{rs.visitas} {rs.visitas === 1 ? 'visita' : 'visitas'} · {rs.centros} {rs.centros === 1 ? 'centro' : 'centros'}</div>
                                                    {rs.noRealizadas > 0 && <div className="text-[10px] font-semibold" style={{ color: STATUS_HEX.violet }}>{rs.noRealizadas} sin realizar</div>}
                                                </td>
                                                {enSemana.map((evsDia, i) => {
                                                    const delMu = evsDia.filter((e) => (e.muestreador || 'Sin asignar') === nombre);
                                                    return (
                                                        <td key={i} className="border-b border-l border-border p-1">
                                                            <div className="flex flex-col gap-1">
                                                                {agruparPorVisita(delMu.sort((a, b) => a.correlativo.localeCompare(b.correlativo))).map((bloque) => (
                                                                    <FilaDelgada key={`m-${bloque[0].id_grupo ?? bloque[0].id}-${bloque[0].tipo_evento}-${bloque[0].id}`} bloque={bloque} />
                                                                ))}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    );
                })()}

                {viewMode === 'week' && semanaPor === 'dias' && (
                    <div className="py-2">
                        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                            {weekDays.map((date, idx) => {
                                const d = date.getDate();
                                const m = date.getMonth() + 1;
                                const y = date.getFullYear();
                                const dayName = date.toLocaleString('es-ES', { weekday: 'short' }).toUpperCase();
                                const isToday = d === new Date().getDate() && date.getMonth() === new Date().getMonth() && y === new Date().getFullYear();

                                const dayEvents = filteredEvents.filter(ev => ev.event_dia === d && ev.event_mes === m && ev.event_ano === y);

                                return (
                                    <div key={idx} className={cn('flex min-h-[550px] flex-col gap-2 rounded-lg border border-border p-2', isToday ? 'bg-accent' : 'bg-muted/40')}>
                                        <div className="border-b border-border pb-1 text-center">
                                            <span className={cn('text-xs font-extrabold', isToday ? 'text-primary' : 'text-muted-foreground')}>{dayName}</span>
                                            <span className={cn('block text-lg font-black', isToday ? 'text-primary' : 'text-foreground')}>{d}</span>
                                        </div>
                                        <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
                                            {Object.entries(dayEvents.reduce<Record<string, CalendarEvent[]>>((acc, ev) => { const k = ev.muestreador || 'Sin asignar'; (acc[k] = acc[k] || []).push(ev); return acc; }, {}))
                                                .sort(([a], [b]) => a.localeCompare(b))
                                                .map(([nombre, evs]) => {
                                                    const bloquesM = agruparPorVisita(evs.sort((a, b) => a.correlativo.localeCompare(b.correlativo)));
                                                    const centrosM = Array.from(new Set(evs.map((e) => (e.centro || '').trim()).filter(Boolean)));
                                                    return (
                                                        <details key={nombre} className="group rounded-md border border-border bg-card">
                                                            <summary className="flex cursor-pointer list-none flex-col gap-0.5 p-1.5 hover:bg-primary/5">
                                                                <span className="flex items-center justify-between gap-1 text-xs font-bold">
                                                                    <span className="truncate" title={nombre}>{nombre}</span>
                                                                    <Badge variant="secondary" className="shrink-0 px-1 py-0 text-[10px]">{bloquesM.length} {bloquesM.length === 1 ? 'visita' : 'visitas'} · {evs.length} pts</Badge>
                                                                </span>
                                                                <span className="truncate text-[10px] text-muted-foreground" title={centrosM.join(' · ')}>{centrosM.join(' · ') || 'Sin centro'}</span>
                                                            </summary>
                                                            <div className="flex flex-col gap-1.5 border-t border-border p-1.5">
                                                                {bloquesM.map((bloque) => (
                                                                    <FilaDelgada key={`v-${bloque[0].id_grupo ?? bloque[0].id}-${bloque[0].tipo_evento}-${bloque[0].id}`} bloque={bloque} />
                                                                ))}
                                                            </div>
                                                        </details>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {viewMode === 'year' && (() => {
                    const anio = currentMonth.getFullYear();
                    const delAnio = filteredEvents.filter((ev) => ev.event_ano === anio);
                    const tot = resumenDeEventos(delAnio);
                    const hoy = new Date();
                    // Intensidad según los servicios del día (visitas y fichas sueltas cuentan una vez).
                    const nivel = (n: number) => (n === 0 ? 'bg-muted/40' : n === 1 ? 'bg-primary/25' : n <= 3 ? 'bg-primary/55' : 'bg-primary');
                    return (
                        <div className="py-2">
                            {delAnio.length > 0 && (
                                <p className="mb-3 mt-0 text-xs text-muted-foreground">
                                    <strong className="text-foreground">{anio}:</strong> {tot.visitas} visitas · {tot.muestreadores} muestreadores · {tot.empresas} empresas · {tot.centros} centros · {tot.hechos} de {tot.vigentes} visitas realizadas{tot.noRealizadas > 0 && <strong style={{ color: STATUS_HEX.violet }}> · {tot.noRealizadas} no realizadas</strong>}
                                </p>
                            )}
                            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))' }}>
                                {Array.from({ length: 12 }).map((_, mIdx) => {
                                    const mDate = new Date(anio, mIdx, 1);
                                    const mName = mDate.toLocaleString('es-ES', { month: 'long' });
                                    const mCaps = mName.charAt(0).toUpperCase() + mName.slice(1);
                                    const mEvents = delAnio.filter((ev) => ev.event_mes === mIdx + 1);
                                    const r = resumenDeEventos(mEvents);
                                    const diasMes = new Date(anio, mIdx + 1, 0).getDate();
                                    const offset = (mDate.getDay() + 6) % 7; // lunes = 0
                                    const esMesActual = hoy.getFullYear() === anio && hoy.getMonth() === mIdx;
                                    const serviciosDelDia = (d: number) => agruparPorVisita(mEvents.filter((e) => e.event_dia === d));
                                    return (
                                        <div
                                            key={mIdx}
                                            onClick={() => { setCurrentMonth(mDate); setViewMode('month'); }}
                                            className={cn('cursor-pointer rounded-lg border bg-card p-3 transition-colors hover:border-primary hover:bg-primary/5', esMesActual ? 'border-primary' : 'border-border')}
                                            title={r.visitas ? r.detalle : 'Sin visitas este mes'}
                                        >
                                            <div className="mb-1.5 flex items-center justify-between">
                                                <span className="text-sm font-bold">{mCaps}</span>
                                                {r.visitas > 0
                                                    ? <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{r.visitas} {r.visitas === 1 ? 'visita' : 'visitas'}</Badge>
                                                    : <span className="text-[10px] text-muted-foreground">sin visitas</span>}
                                            </div>
                                            <div className="mb-0.5 grid grid-cols-7 gap-[2px] text-center text-[8px] font-semibold text-muted-foreground">
                                                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((l, i) => <span key={i}>{l}</span>)}
                                            </div>
                                            <div className="grid grid-cols-7 gap-[2px]">
                                                {Array.from({ length: offset }).map((__, i) => <div key={`o${i}`} className="h-3" />)}
                                                {Array.from({ length: diasMes }).map((__, dIdx) => {
                                                    const d = dIdx + 1;
                                                    const sv = serviciosDelDia(d);
                                                    const esHoy = esMesActual && hoy.getDate() === d;
                                                    return (
                                                        <div
                                                            key={d}
                                                            className={cn('flex h-3 items-center justify-center rounded-[2px] text-[7px] leading-none', nivel(sv.length), sv.length >= 4 ? 'text-primary-foreground' : 'text-muted-foreground', esHoy && 'ring-1 ring-foreground')}
                                                            title={sv.length ? `${d}: ${sv.length} ${sv.length === 1 ? 'visita' : 'visitas'}` : `${d}: sin visitas`}
                                                        >
                                                            {d}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {r.visitas > 0 && (
                                                <div className="mt-2 flex flex-col gap-0.5 text-[10.5px] leading-tight">
                                                    <span className="font-semibold text-foreground">{r.visitas} {r.visitas === 1 ? 'visita' : 'visitas'} · {r.muestreadores} {r.muestreadores === 1 ? 'muestreador' : 'muestreadores'}</span>
                                                    <span className="text-muted-foreground">{r.centros} {r.centros === 1 ? 'centro' : 'centros'} · {r.empresas} {r.empresas === 1 ? 'empresa' : 'empresas'}</span>
                                                    <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded bg-muted" title={`${r.hechos} de ${r.vigentes} visitas realizadas`}>
                                                        <div className="h-full bg-success" style={{ width: `${r.vigentes ? Math.round((r.hechos / r.vigentes) * 100) : 0}%` }} />
                                                    </div>
                                                    <span className="text-muted-foreground">{r.hechos} de {r.vigentes} realizadas{r.noRealizadas > 0 && <span style={{ color: STATUS_HEX.violet }}> · {r.noRealizadas} sin realizar</span>}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}
            </div>

            <Dialog open={!!selectedEvent} onOpenChange={(open) => { if (!open) setSelectedEvent(null); }}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[720px]">
                    <DialogHeader>
                        <div className="flex items-center justify-between pr-6">
                            <DialogTitle>{selectedEvent?.punto_muestreo ? `Punto «${selectedEvent.punto_muestreo}»` : 'Resumen de Muestreo'} · {selectedEvent?.correlativo}</DialogTitle>
                            {selectedEvent && <Badge variant={STATUS_VARIANT[getStatusColor(selectedEvent)]} className="text-[13px]">{selectedEvent.estado_caso}</Badge>}
                        </div>
                    </DialogHeader>
                    {selectedEvent && (
                        <div className="flex flex-col gap-4">
                            {evNoRealizado(selectedEvent) && (
                                <div className="rounded-lg border p-2 text-[13px]" style={{ borderColor: STATUS_HEX.violet, backgroundColor: 'color-mix(in srgb, var(--sc-destructive) 8%, transparent)' }}>
                                    <strong style={{ color: STATUS_HEX.violet }}>No realizada en su fecha.</strong>{' '}
                                    <span className="text-muted-foreground">Cambia la fecha y el muestreador más abajo para reagendarla, usa «Quitar asignación» para dejarla pendiente de coordinar, o cancélala.</span>
                                </div>
                            )}
                            {selectedEvent.es_remuestreo === 'S' && (
                                <div className="rounded-lg border border-primary bg-accent p-2">
                                    <div className="flex items-center gap-2">
                                        <IconAlertCircle size={18} className="text-primary" />
                                        <span className="text-[13px] font-semibold text-primary">REMUESTREO DE LA FICHA N° {selectedEvent.id_ficha_original}</span>
                                    </div>
                                </div>
                            )}

                            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                                <StaticField label="Monitoreo" value={selectedEvent.tipo_ficha} />
                                <StaticField label="Sub Área" value={selectedEvent.subarea} />
                                <StaticField label="Objetivo" value={selectedEvent.objetivo} />
                            </div>

                            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                                <StaticField label="Empresa Servicio" value={selectedEvent.empresa_servicio} />
                                <StaticField label="Centro / Fuente" value={selectedEvent.centro} />
                                <StaticField label="Base Operaciones" value={selectedEvent.base_operaciones} />
                            </div>

                            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                                <StaticField label="Contacto Empresa" value={selectedEvent.contacto || ''} />
                                <StaticField label="E-mail Contacto" value={selectedEvent.correo_contacto || ''} />
                            </div>

                            <StaticField label="Glosa / Tabla" value={selectedEvent.glosa} />

                            <SectionDivider>Gestión de Agenda</SectionDivider>

                            <div className="grid grid-cols-2 items-end gap-4">
                                <div>
                                    {hasPermission('MA_CALENDARIO_REAGENDAR') && !isExecutedEvent(selectedEvent) ? (
                                        <>
                                            <span className="mb-1 block text-xs">Fecha de Muestreo (Agenda)</span>
                                            <DatePicker
                                                value={editedDate}
                                                onChange={(v) => {
                                                    // Reglas de negocio originales no permitían fechas pasadas (min={todayStr}
                                                    // del input nativo); DatePicker no soporta min/max, así que se valida aquí.
                                                    if (v && v < todayStr) return;
                                                    setEditedDate(v);
                                                    setIsEditingDate(true);
                                                }}
                                            />
                                        </>
                                    ) : (
                                        <StaticField label="Fecha de Muestreo (Agenda)" value={editedDate} />
                                    )}
                                </div>
                                <div>
                                    {hasPermission('MA_CALENDARIO_REASIGNAR') && !isExecutedEvent(selectedEvent) ? (
                                        <>
                                            <span className="mb-1 block text-xs">Re-Asignar Muestreador</span>
                                            <Combobox
                                                placeholder="Seleccione..."
                                                options={muestreadorOptions}
                                                value={editedSamplerId ? String(editedSamplerId) : ''}
                                                onValueChange={(val) => { if (val) setEditedSamplerId(Number(val)); setIsEditingSampler(true); }}
                                            />
                                        </>
                                    ) : (
                                        <StaticField
                                            label="Muestreador Asignado"
                                            value={globalMuestreadores.find(m => m.id_muestreador === Number(editedSamplerId))?.nombre_muestreador || 'Sin Asignar'}
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="mt-2 flex justify-between">
                                <ProtectedContent permission="FI_CAL_DETALLE">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            if (selectedEvent) {
                                                setDetailFichaId(selectedEvent.id);
                                                setSelectedEvent(null);
                                            }
                                        }}
                                    >
                                        <IconSearch size={16} />
                                        Ver Detalle Completo
                                    </Button>
                                </ProtectedContent>

                                <div className="flex gap-2">
                                    {selectedEvent && !isCancelledEvent(selectedEvent) && !isExecutedEvent(selectedEvent) && (
                                        <>
                                        <ProtectedContent permission={['FI_GEST_ASIG', 'MA_CALENDARIO_CANCELAR']}>
                                            <Button variant="outline" onClick={() => setShowQuitarAsig(true)} title="Vuelve a dejarlo pendiente de coordinar (sin cancelar)">Quitar asignación</Button>
                                        </ProtectedContent>
                                        <ProtectedContent permission="MA_CALENDARIO_CANCELAR">
                                            <Button variant="destructive" onClick={() => setShowCancelConfirm(true)}>Cancelar Muestreo</Button>
                                        </ProtectedContent>
                                        </>
                                    )}
                                    <ProtectedContent permission={['MA_CALENDARIO_REAGENDAR', 'MA_CALENDARIO_REASIGNAR']}>
                                        <Button
                                            disabled={(!isEditingDate && !isEditingSampler) || isSavingEvent}
                                            onClick={async () => {
                                                if (!selectedEvent) return;

                                                const payload = buildUpdatePayload();
                                                if (!payload) return;

                                                // Cancelled services show reactivation modal
                                                if (isCancelledEvent(selectedEvent)) {
                                                    setPendingPayload(payload);
                                                    setShowReactivateConfirm(true);
                                                    return;
                                                }

                                                // Pending services: check if date changed for version prompt
                                                if (isEditingDate) {
                                                    setPendingPayload(payload);
                                                    setShowVersionPrompt(true);
                                                } else {
                                                    // Only sampler changed: save directly
                                                    setIsSavingEvent(true);
                                                    fichaService.batchUpdateAgenda(payload)
                                                        .then(() => {
                                                            showToast({ type: 'success', message: 'Muestreador re-asignado correctamente.' });
                                                            lastFetchRef.current = '';
                                                            setSelectedEvent(null);
                                                            loadData();
                                                        })
                                                        .catch((error) => {
                                                            console.error('Error saving reassignment:', error);
                                                            showToast({ type: 'error', message: 'Error al re-asignar el muestreador.' });
                                                        })
                                                        .finally(() => setIsSavingEvent(false));
                                                }
                                            }}
                                        >
                                            {isSavingEvent ? (
                                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                            ) : (
                                                <IconDeviceFloppy size={18} />
                                            )}
                                            Guardar Cambios
                                        </Button>
                                    </ProtectedContent>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Visita completa: lo común una sola vez y la lista de sus puntos ── */}
            <Dialog open={!!visita && !showQuitarVisita && !showCancelVisita} onOpenChange={(o) => { if (!o) setVisita(null); }}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[720px]">
                    {visita && (() => {
                        const base = visita[0];
                        const cancelados = visita.filter((x) => isCancelledEvent(x));
                        const hechos = visita.filter((x) => !isCancelledEvent(x) && isExecutedEvent(x));
                        const activos = visita.filter((x) => !isCancelledEvent(x) && !isExecutedEvent(x));
                        const vigentes = visita.length - cancelados.length;
                        const pct = vigentes > 0 ? Math.round((hechos.length / vigentes) * 100) : 0;
                        const fechaDe = (v?: string) => (v && !String(v).startsWith('1900') ? String(v).slice(0, 10).split('-').reverse().join('-') : '—');
                        const esRetiro = base.tipo_evento === 'RETIRO';
                        const etiquetaEstado = (ev: CalendarEvent) => (isCancelledEvent(ev) ? 'Cancelado' : isExecutedEvent(ev) ? (isPuntualEvent(ev) ? 'Realizado' : (ev.tipo_evento === 'RETIRO' ? 'Retirado' : 'Instalado')) : evNoRealizado(ev) ? 'No realizado' : 'Agendado');
                        const visitaNoRealizada = activos.length > 0 && activos.some((x) => evNoRealizado(x));
                        return (
                            <>
                                <DialogHeader>
                                    <div className="flex items-start justify-between gap-3 pr-6">
                                        <div className="min-w-0">
                                            <DialogTitle className="truncate text-xl font-extrabold leading-tight">{base.centro}</DialogTitle>
                                            <p className="m-0 truncate text-sm text-muted-foreground">{base.empresa_servicio}</p>
                                        </div>
                                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                                            {base.objetivo && <Badge variant="info" title="Programa (objetivo del muestreo)">{base.objetivo}</Badge>}
                                            {base.subarea && <Badge variant="secondary">{base.subarea}</Badge>}
                                            {base.tipo_ficha && <Badge variant="outline">{base.tipo_ficha}{esRetiro ? ' · retiro' : ''}</Badge>}
                                        </div>
                                    </div>
                                </DialogHeader>
                                <div className="flex flex-col gap-4">
                                    {visitaNoRealizada && (
                                        <div className="rounded-lg border p-3 text-[13px]" style={{ borderColor: STATUS_HEX.violet, backgroundColor: 'color-mix(in srgb, var(--sc-destructive) 8%, transparent)' }}>
                                            <p className="m-0 font-semibold" style={{ color: STATUS_HEX.violet }}>
                                                Esta visita no se realizó en su fecha ({String(base.tipo_evento === 'RETIRO' ? (base.fecha_retiro || base.fecha) : base.fecha || '').slice(0, 10).split('-').reverse().join('-')}).
                                            </p>
                                            <p className="mb-2 mt-1 text-muted-foreground">Elige qué hacer con los {activos.length} {activos.length === 1 ? 'punto que falta' : 'puntos que faltan'}:</p>
                                            <div className="flex flex-wrap gap-2">
                                                <ProtectedContent permission={['FI_GEST_ASIG', 'MA_CALENDARIO_REAGENDAR']}>
                                                    <Button size="sm" onClick={() => { setReagFecha(''); setReagMuestreador(base.id_muestreador ? String(base.id_muestreador) : ''); setShowReagendar(true); }}>Reagendar y reasignar</Button>
                                                </ProtectedContent>
                                                <ProtectedContent permission={['FI_GEST_ASIG', 'MA_CALENDARIO_CANCELAR']}>
                                                    <Button size="sm" variant="outline" onClick={() => setShowQuitarVisita(true)}>Dejar pendiente de coordinar</Button>
                                                </ProtectedContent>
                                                <ProtectedContent permission="MA_CALENDARIO_CANCELAR">
                                                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => { setSoloPunto(null); setShowCancelVisita(true); }}>Cancelar la visita</Button>
                                                </ProtectedContent>
                                            </div>
                                        </div>
                                    )}
                                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                                        <div className="mb-1.5 flex items-center justify-between text-sm">
                                            <span className="font-semibold">{hechos.length} de {vigentes} {vigentes === 1 ? 'punto ejecutado' : 'puntos ejecutados'}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {activos.length > 0 ? `${activos.length} por ejecutar` : (vigentes > 0 ? 'Visita completa' : 'Visita cancelada')}
                                                {cancelados.length > 0 ? ` · ${cancelados.length} cancelado${cancelados.length > 1 ? 's' : ''}` : ''}
                                                {' · se actualiza sola'}
                                            </span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded bg-muted">
                                            <div className="h-full bg-success transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
                                        <StaticField label="Muestreador" value={base.muestreador || 'Sin Asignar'} />
                                        {!isPuntualEvent(base) && <StaticField label={esRetiro ? 'Muestreador instalación' : 'Muestreador retiro'} value={(esRetiro ? base.muestreador : base.muestreador_retiro) || '—'} />}
                                        <StaticField label={isPuntualEvent(base) ? 'Fecha de muestreo' : 'Instalación'} value={fechaDe(base.fecha)} />
                                        {!isPuntualEvent(base) && <StaticField label="Retiro" value={fechaDe(base.fecha_retiro)} />}
                                        <StaticField label="Base de operaciones" value={base.base_operaciones} />
                                        <StaticField label="Contacto" value={base.contacto || ''} />
                                        <StaticField label="E-mail contacto" value={base.correo_contacto || ''} />
                                    </div>
                                    <StaticField label="Glosa / Tabla" value={base.glosa} />
                                    <SectionDivider>Puntos de la visita</SectionDivider>
                                    <div className="overflow-hidden rounded-lg border border-border">
                                        <table className="w-full border-collapse text-[13px]">
                                            <thead>
                                                <tr className="bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                                                    <th className="px-3 py-2">Punto de muestreo</th>
                                                    <th className="px-3 py-2">Servicio</th>
                                                    <th className="px-3 py-2">Estado</th>
                                                    <th className="px-3 py-2 text-right">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {visita.map((ev) => {
                                                    const color = getStatusColor(ev);
                                                    const activo = !isCancelledEvent(ev) && !isExecutedEvent(ev);
                                                    return (
                                                        <tr key={`${ev.id}-${ev.tipo_evento}`} className="border-t border-border">
                                                            <td className={cn('px-3 py-1.5 font-medium', isCancelledEvent(ev) && 'line-through opacity-60')}>{ev.punto_muestreo || `Ficha ${ev.ficha_correlativo || ev.id}`}</td>
                                                            <td className="px-3 py-1.5 text-muted-foreground">{ev.correlativo}</td>
                                                            <td className="px-3 py-1.5">
                                                                <Badge variant={STATUS_VARIANT[color]}>{etiquetaEstado(ev)}</Badge>
                                                                {isCancelledEvent(ev) && ev.motivo_cancelacion && <span className="mt-0.5 block text-[11px] text-destructive" title={ev.motivo_cancelacion}>{ev.motivo_cancelacion}</span>}
                                                            </td>
                                                            <td className="px-3 py-1.5 text-right">
                                                                <div className="flex justify-end gap-1">
                                                                    <Button size="sm" variant="ghost" onClick={() => { setSelectedEvent(ev); }}>Ver punto</Button>
                                                                    {activo && (
                                                                        <ProtectedContent permission="MA_CALENDARIO_CANCELAR">
                                                                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { setSoloPunto(ev); setShowCancelVisita(true); }}>Cancelar punto</Button>
                                                                        </ProtectedContent>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    {hechos.length > 0 && activos.length > 0 && (
                                        <p className="m-0 text-xs text-muted-foreground">Los puntos ya ejecutados no se pueden cancelar ni desagendar; las acciones de la visita afectan solo a los {activos.length} que faltan.</p>
                                    )}
                                </div>
                                <DialogFooter className="gap-2 sm:justify-between">
                                    <Button variant="outline" onClick={() => setVisita(null)}>Cerrar</Button>
                                    <div className="flex gap-2">
                                        {activos.length > 0 && (
                                            <ProtectedContent permission={['FI_GEST_ASIG', 'MA_CALENDARIO_CANCELAR']}>
                                                <Button variant="outline" onClick={() => setShowQuitarVisita(true)} title="Vuelve a dejar los puntos que faltan pendientes de coordinar (sin cancelar)">Quitar asignación de la visita</Button>
                                            </ProtectedContent>
                                        )}
                                        {activos.length > 0 && (
                                            <ProtectedContent permission="MA_CALENDARIO_CANCELAR">
                                                <Button variant="destructive" onClick={() => { setSoloPunto(null); setShowCancelVisita(true); }}>Cancelar la visita</Button>
                                            </ProtectedContent>
                                        )}
                                    </div>
                                </DialogFooter>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            <Dialog open={showReagendar} onOpenChange={setShowReagendar}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Reagendar y reasignar la visita</DialogTitle></DialogHeader>
                    <div className="flex flex-col gap-4">
                        <p className="text-[13px]">Se mueven a la nueva fecha y al muestreador elegido los puntos que faltan por realizar ({visita ? visita.filter((x) => !isCancelledEvent(x) && !isExecutedEvent(x)).length : 0}). Los ya realizados no se tocan.</p>
                        <div>
                            <span className="mb-1 block text-xs">Nuevo muestreador *</span>
                            <Combobox placeholder="Seleccione..." options={muestreadorOptions} value={reagMuestreador} onValueChange={setReagMuestreador} />
                        </div>
                        <div>
                            <span className="mb-1 block text-xs">Nueva fecha *</span>
                            <DatePicker value={reagFecha} onChange={(v) => { if (v && v < todayStr) return; setReagFecha(v); }} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowReagendar(false)}>Volver</Button>
                        <Button
                            disabled={!reagFecha || !reagMuestreador || isSavingEvent}
                            onClick={async () => {
                                if (!visita) return;
                                setIsSavingEvent(true);
                                try {
                                    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                    const nuevoMu = Number(reagMuestreador);
                                    const asignaciones = visita.filter((x) => !isCancelledEvent(x) && !isExecutedEvent(x)).map((ev) => {
                                        const f0 = String(ev.fecha || '').slice(0, 10);
                                        const f1 = String(ev.fecha_retiro || '').slice(0, 10);
                                        const hayRetiro = !!f1 && !f1.startsWith('1900');
                                        const brecha = hayRetiro && f0 ? new Date(f1 + 'T00:00:00').getTime() - new Date(f0 + 'T00:00:00').getTime() : 0;
                                        const instalador = Number(ev.id_muestreador) || 0;
                                        const retirador = Number(ev.id_muestreador2 || ev.id_muestreador) || 0;
                                        if (ev.tipo_evento === 'RETIRO') {
                                            return { id: ev.id_agenda, fecha: f0, fechaRetiro: reagFecha, idMuestreadorInstalacion: instalador, idMuestreadorRetiro: nuevoMu, idFichaIngresoServicio: Number(ev.id), frecuenciaCorrelativo: ev.correlativo };
                                        }
                                        const nuevoRetiro = isPuntualEvent(ev) || !hayRetiro || brecha < 0 ? reagFecha : ymd(new Date(new Date(reagFecha + 'T00:00:00').getTime() + brecha));
                                        return { id: ev.id_agenda, fecha: reagFecha, fechaRetiro: nuevoRetiro, idMuestreadorInstalacion: nuevoMu, idMuestreadorRetiro: isPuntualEvent(ev) ? nuevoMu : retirador, idFichaIngresoServicio: Number(ev.id), frecuenciaCorrelativo: ev.correlativo };
                                    });
                                    const res = await fichaService.batchUpdateAgenda({ assignments: asignaciones, user: { id: user?.id || 0 }, observaciones: 'Reagendada desde el calendario (visita no realizada en su fecha).' } as any);
                                    showToast({ type: 'success', message: res?.message || 'Visita reagendada.' });
                                    lastFetchRef.current = '';
                                    setShowReagendar(false);
                                    setVisita(null);
                                    loadData(true);
                                } catch (err: any) {
                                    showToast({ type: 'error', message: err?.response?.data?.message || 'No se pudo reagendar la visita.' });
                                } finally {
                                    setIsSavingEvent(false);
                                }
                            }}
                        >
                            {isSavingEvent && <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />}
                            Reagendar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showQuitarVisita} onOpenChange={setShowQuitarVisita}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Quitar la asignación de la visita</DialogTitle></DialogHeader>
                    <p className="text-[13px]">
                        Los {visita ? visita.filter((x) => !isCancelledEvent(x) && !isExecutedEvent(x)).length : 0} puntos pendientes de la visita vuelven a quedar <strong>pendientes de coordinar</strong>, sin responsable ni fecha.
                        No es una cancelación y se pueden agendar de nuevo.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowQuitarVisita(false)}>No, volver</Button>
                        <Button
                            disabled={isSavingEvent}
                            onClick={async () => {
                                if (!visita) return;
                                setIsSavingEvent(true);
                                try {
                                    const ids = visita.filter((x) => !isCancelledEvent(x) && !isExecutedEvent(x)).map((x) => Number(x.id_agenda));
                                    const res = await fichaService.quitarAsignacion(ids);
                                    showToast({ type: 'success', message: res?.message || 'Asignación quitada.' });
                                    lastFetchRef.current = '';
                                    setShowQuitarVisita(false);
                                    setVisita(null);
                                    loadData();
                                } catch (err: any) {
                                    showToast({ type: 'error', message: err?.response?.data?.message || 'No se pudo quitar la asignación.' });
                                } finally {
                                    setIsSavingEvent(false);
                                }
                            }}
                        >
                            {isSavingEvent && <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />}
                            Sí, quitar la asignación
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showCancelVisita} onOpenChange={(o) => { setShowCancelVisita(o); if (!o) setSoloPunto(null); }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{soloPunto ? `Cancelar el punto «${soloPunto.punto_muestreo || soloPunto.correlativo}»` : 'Cancelar la visita completa'}</DialogTitle></DialogHeader>
                    <div className="flex flex-col gap-4">
                        <p className="text-[13px]">
                            {soloPunto ? 'Se cancela solo este punto; el resto de la visita sigue como está.' : `Se cancelan los ${visita ? visita.filter((x) => !isCancelledEvent(x) && !isExecutedEvent(x)).length : 0} puntos pendientes de la visita con el mismo motivo.`} Esta acción es irreversible.
                        </p>
                        <div>
                            <span className="mb-1 block text-xs">Motivo de Cancelación *</span>
                            <Combobox placeholder="Seleccione un motivo..." options={cancellationOptions} value={selectedReasonId ? String(selectedReasonId) : ''} onValueChange={(val) => setSelectedReasonId(Number(val) || '')} />
                        </div>
                        <div>
                            <span className="mb-1 block text-xs">Observaciones adicionales *</span>
                            <Input placeholder="Ingrese detalle del motivo..." value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCancelVisita(false)}>No, volver</Button>
                        <Button
                            variant="destructive"
                            disabled={!cancelReason.trim() || !selectedReasonId || isSavingEvent}
                            onClick={async () => {
                                if (!visita) return;
                                setIsSavingEvent(true);
                                try {
                                    const activos = soloPunto ? [soloPunto] : visita.filter((x) => !isCancelledEvent(x) && !isExecutedEvent(x));
                                    const [primero, ...resto] = activos;
                                    const res = await fichaService.cancelAgendaSampling(
                                        primero.id_agenda, primero.id, { id: user?.id || 0, usuario: user?.name || '' },
                                        cancelReason, Number(selectedReasonId), resto.map((x) => Number(x.id_agenda))
                                    );
                                    const fallidos: { punto: string | null }[] = res?.data?.fallidos ?? [];
                                    const total: number = res?.data?.cancelados?.length ?? 1;
                                    showToast(fallidos.length > 0
                                        ? { type: 'warning', message: `Se cancelaron ${total} punto(s), pero no se pudo cancelar: ${fallidos.map(f => f.punto || 'un punto').join(', ')}.` }
                                        : { type: 'success', message: soloPunto ? 'Punto cancelado.' : `Se cancelaron ${total} puntos de la visita.` });
                                    lastFetchRef.current = '';
                                    setShowCancelVisita(false);
                                    if (!soloPunto) setVisita(null); // al cancelar un solo punto la visita sigue abierta y se refresca
                                    setSoloPunto(null);
                                    setCancelReason('');
                                    setSelectedReasonId('');
                                    loadData();
                                } catch (err: any) {
                                    showToast({ type: 'error', message: err?.response?.data?.message || 'Error al cancelar la visita.' });
                                } finally {
                                    setIsSavingEvent(false);
                                }
                            }}
                        >
                            {isSavingEvent && <div className="h-4 w-4 animate-spin rounded-full border-2 border-destructive-foreground border-t-transparent" />}
                            {soloPunto ? 'Sí, cancelar el punto' : 'Sí, cancelar la visita'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showQuitarAsig} onOpenChange={setShowQuitarAsig}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Quitar la asignación</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <p className="text-[13px]">
                            El muestreo vuelve a quedar <strong>pendiente de coordinar</strong>, sin responsable ni fecha, y se puede agendar de nuevo.
                            No es una cancelación: no queda ningún motivo registrado.
                        </p>
                        {puntosVisita.length > 0 && (
                            <label className="flex items-start gap-2 rounded-md border border-border p-3 text-[13px]">
                                <Checkbox
                                    className="mt-0.5"
                                    checked={puntosACancelar.size === puntosVisita.length}
                                    onCheckedChange={(v) => setPuntosACancelar(v === true ? new Set(puntosVisita.map(p => p.id_agenda)) : new Set())}
                                />
                                <span>
                                    Quitar también la asignación de los otros {puntosVisita.length} {puntosVisita.length === 1 ? 'punto' : 'puntos'} de esta visita
                                    <span className="block text-xs text-muted-foreground">{puntosVisita.map(p => p.punto || `Ficha ${p.id_ficha}`).join(', ')}</span>
                                </span>
                            </label>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowQuitarAsig(false)}>No, volver</Button>
                        <Button
                            disabled={isSavingEvent}
                            onClick={async () => {
                                if (!selectedEvent) return;
                                setIsSavingEvent(true);
                                try {
                                    const res = await fichaService.quitarAsignacion([Number(selectedEvent.id_agenda), ...puntosACancelar]);
                                    showToast({ type: 'success', message: res?.message || 'Asignación quitada.' });
                                    setPuntosVisita([]);
                                    setPuntosACancelar(new Set());
                                    lastFetchRef.current = '';
                                    setShowQuitarAsig(false);
                                    setSelectedEvent(null);
                                    loadData();
                                } catch (err: any) {
                                    showToast({ type: 'error', message: err?.response?.data?.message || 'No se pudo quitar la asignación.' });
                                } finally {
                                    setIsSavingEvent(false);
                                }
                            }}
                        >
                            {isSavingEvent && <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />}
                            Sí, quitar la asignación
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Cancelación de Muestreo</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <p className="text-[13px]">¿Está seguro que desea cancelar este muestreo? Esta acción es irreversible.</p>

                        {puntosVisita.length > 0 && (
                            <div className="rounded-md border border-border bg-muted/30 p-3">
                                <p className="m-0 mb-2 text-xs text-muted-foreground">
                                    Este muestreo es parte de una visita con varios puntos. Por defecto se cancela <b className="text-foreground">solo este punto</b>;
                                    marque los que también quiera cancelar.
                                </p>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <span className="text-xs font-medium text-foreground">Cancelar también</span>
                                    <button
                                        type="button"
                                        className="text-xs text-primary underline-offset-2 hover:underline"
                                        onClick={() => setPuntosACancelar(puntosACancelar.size === puntosVisita.length ? new Set() : new Set(puntosVisita.map(p => p.id_agenda)))}
                                    >
                                        {puntosACancelar.size === puntosVisita.length ? 'Quitar todos' : 'Marcar todos'}
                                    </button>
                                </div>
                                <ul className="m-0 flex max-h-40 list-none flex-col gap-1 overflow-y-auto p-0">
                                    {puntosVisita.map(p => (
                                        <li key={p.id_agenda}>
                                            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                                                <Checkbox
                                                    checked={puntosACancelar.has(p.id_agenda)}
                                                    onCheckedChange={(v) => setPuntosACancelar(prev => {
                                                        const sig = new Set(prev);
                                                        if (v === true) sig.add(p.id_agenda); else sig.delete(p.id_agenda);
                                                        return sig;
                                                    })}
                                                />
                                                <span>{p.punto || `Ficha ${p.id_ficha}`}</span>
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div>
                            <span className="mb-1 block text-xs">Motivo de Cancelación *</span>
                            <Combobox
                                placeholder="Seleccione un motivo..."
                                options={cancellationOptions}
                                value={selectedReasonId ? String(selectedReasonId) : ''}
                                onValueChange={(val) => setSelectedReasonId(Number(val) || '')}
                            />
                        </div>

                        <div>
                            <span className="mb-1 block text-xs">Observaciones adicionales *</span>
                            <Input placeholder="Ingrese detalle del motivo..." value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>No, Volver</Button>
                        <Button
                            variant="destructive"
                            disabled={!cancelReason.trim() || !selectedReasonId || isSavingEvent}
                            onClick={async () => {
                                if (!selectedEvent) return;
                                setIsSavingEvent(true);
                                try {
                                    const resCancel = await fichaService.cancelAgendaSampling(
                                        selectedEvent.id_agenda,
                                        selectedEvent.id,
                                        { id: user?.id || 0, usuario: user?.name || '' },
                                        cancelReason,
                                        Number(selectedReasonId),
                                        [...puntosACancelar]
                                    );
                                    const fallidosCancel: { punto: string | null }[] = resCancel?.data?.fallidos ?? [];
                                    const totalCancelados: number = resCancel?.data?.cancelados?.length ?? 1;
                                    showToast(fallidosCancel.length > 0
                                        ? { type: 'warning', message: `Se cancelaron ${totalCancelados} punto(s), pero no se pudo cancelar: ${fallidosCancel.map(f => f.punto || 'un punto').join(', ')}.` }
                                        : { type: 'success', message: totalCancelados > 1 ? `Se cancelaron ${totalCancelados} puntos de la visita.` : 'Muestreo cancelado correctamente.' });
                                    setPuntosVisita([]);
                                    setPuntosACancelar(new Set());
                                    lastFetchRef.current = '';
                                    setShowCancelConfirm(false);
                                    setCancelReason('');
                                    setSelectedReasonId('');
                                    setSelectedEvent(null);
                                    loadData();
                                } catch (err) {
                                    console.error(err);
                                    showToast({ type: 'error', message: 'Error al cancelar.' });
                                } finally {
                                    setIsSavingEvent(false);
                                }
                            }}
                        >
                            {isSavingEvent && <div className="h-4 w-4 animate-spin rounded-full border-2 border-destructive-foreground border-t-transparent" />}
                            Sí, Cancelar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showVersionPrompt} onOpenChange={setShowVersionPrompt}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Versión de Equipos</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <p className="text-[13px]">
                            ¿Desea mantener la versión de equipos registrada al momento de la asignación original o actualizar con la versión actual de los equipos maestros?
                        </p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={async () => {
                                    if (!pendingPayload) return;
                                    setShowVersionPrompt(false);
                                    setIsSavingEvent(true);
                                    try {
                                        await fichaService.batchUpdateAgenda(pendingPayload);
                                        showToast({ type: 'success', message: 'Muestreo reprogramado (versión original mantenida).' });
                                        lastFetchRef.current = '';
                                        setSelectedEvent(null);
                                        loadData();
                                    } catch (error) {
                                        console.error('Error saving event:', error);
                                        showToast({ type: 'error', message: 'Error al intentar re-agendar el muestreo.' });
                                    } finally {
                                        setIsSavingEvent(false);
                                        setPendingPayload(null);
                                    }
                                }}
                            >
                                Mantener original
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={async () => {
                                    if (!pendingPayload) return;
                                    setShowVersionPrompt(false);
                                    setIsSavingEvent(true);
                                    try {
                                        const updatedPayload: any = { ...pendingPayload };
                                        updatedPayload.assignments = updatedPayload.assignments.map((a: any) => ({
                                            ...a,
                                            actualizarVersiones: true
                                        }));
                                        await fichaService.batchUpdateAgenda(updatedPayload);
                                        showToast({ type: 'success', message: 'Muestreo reprogramado con versiones actualizadas.' });
                                        lastFetchRef.current = '';
                                        setSelectedEvent(null);
                                        loadData();
                                    } catch (error) {
                                        console.error('Error saving event:', error);
                                        showToast({ type: 'error', message: 'Error al intentar re-agendar el muestreo.' });
                                    } finally {
                                        setIsSavingEvent(false);
                                        setPendingPayload(null);
                                    }
                                }}
                            >
                                Usar versión actual
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showReactivateConfirm} onOpenChange={setShowReactivateConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reactivar y Reagendar Muestreo</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        {selectedEvent && (
                            <>
                                <div className="rounded-lg border border-destructive/25 bg-destructive/10 p-2.5">
                                    <div className="flex items-center gap-2">
                                        <IconAlertCircle size={18} className="text-destructive" />
                                        <span className="text-[13px] font-semibold">Este muestreo fue cancelado anteriormente</span>
                                    </div>
                                </div>

                                <div>
                                    <span className="block text-[11px] font-bold uppercase text-muted-foreground">Motivo de cancelación</span>
                                    <span className="text-[13px]">{selectedEvent.motivo_cancelacion || 'No especificado'}</span>
                                </div>

                                {cancelReason && (
                                    <div>
                                        <span className="block text-[11px] font-bold uppercase text-muted-foreground">Observaciones</span>
                                        <span className="text-[13px]">{cancelReason}</span>
                                    </div>
                                )}

                                <div className="h-px bg-border" />

                                <div>
                                    <span className="mb-2 block text-[11px] font-bold uppercase text-muted-foreground">Nuevos datos</span>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between">
                                            <span className="text-[13px]">Fecha:</span>
                                            <span className="text-[13px] font-semibold">{editedDate ? new Date(editedDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-[13px]">Muestreador:</span>
                                            <span className="text-[13px] font-semibold">{globalMuestreadores.find(m => m.id_muestreador === Number(editedSamplerId))?.nombre_muestreador || 'Sin Asignar'}</span>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-[13px] text-muted-foreground">¿Desea reactivar este muestreo y aplicar los cambios?</p>
                            </>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowReactivateConfirm(false)}>No, Volver</Button>
                        <Button
                            disabled={isReactivating}
                            onClick={async () => {
                                setIsReactivating(true);
                                try {
                                    if (!pendingPayload) return;
                                    const reactivatePayload: any = {
                                        ...pendingPayload,
                                        reactivating: true
                                    };

                                    await fichaService.batchUpdateAgenda(reactivatePayload);
                                    showToast({ type: 'success', message: 'Muestreo reactivado y reprogramado.' });
                                    lastFetchRef.current = '';
                                    setSelectedEvent(null);
                                    setShowReactivateConfirm(false);
                                    loadData();
                                } catch (error) {
                                    console.error('Error reactivating:', error);
                                    showToast({ type: 'error', message: 'Error al reactivar el muestreo.' });
                                } finally {
                                    setIsReactivating(false);
                                }
                            }}
                        >
                            {isReactivating && <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />}
                            Sí, Reactivar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
            {children}
        </div>
    );
}
