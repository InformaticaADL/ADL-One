import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { catalogosService } from '../services/catalogos.service';
import { fichaService } from '../services/ficha.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { FichaUniversalView } from '../components/FichaUniversalView';
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
    realizado_por_gem?: string | null;
    es_remuestreo?: string | null;
    id_ficha_original?: number | null;
    cliente?: string;
    email_cliente?: string;
}

interface CalendarEvent extends FichaEvento {
    tipo_evento: 'INICIO' | 'RETIRO';
    event_dia: number;
    event_mes: number;
    event_ano: number;
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

const STATUS_HEX: Record<string, string> = { orange: '#e8590c', green: '#2f9e44', red: '#e03131' };
const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'destructive'> = { orange: 'warning', green: 'success', red: 'destructive' };

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
    const [selectedEmpresa, setSelectedEmpresa] = useState('');
    const [selectedMuestreador, setSelectedMuestreador] = useState('');
    const [selectedCentro, setSelectedCentro] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'month' | 'day' | 'week' | 'year'>('month');
    const [showFilters, setShowFilters] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [detailFichaId, setDetailFichaId] = useState<number | null>(null);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    const [isEditingDate, setIsEditingDate] = useState(false);
    const [isEditingSampler, setIsEditingSampler] = useState(false);
    const [editedDate, setEditedDate] = useState('');
    const [editedSamplerId, setEditedSamplerId] = useState<number | ''>('');
    const [cancellationReasons, setCancellationReasons] = useState<any[]>([]);
    const [selectedReasonId, setSelectedReasonId] = useState<number | ''>('');
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
                    catalogosService.getEstadosMuestreo()
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

    const loadData = useCallback(async () => {
        const month = currentMonth.getMonth() + 1;
        const year = currentMonth.getFullYear();
        const fetchKey = `${viewMode}-${month}-${year}`;

        if (lastFetchRef.current === fetchKey) return;

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
    }, [allEvents, selectedEmpresa, selectedMuestreador, selectedCentro, searchTerm]);

    const empresas = useMemo(() => Array.from(new Set(allEvents.map(e => (e.empresa_servicio || '').trim()))).filter(Boolean).sort(), [allEvents]);
    const muestreadores = useMemo(() => Array.from(new Set(allEvents.map(e => (e.muestreador || '').trim()))).filter(Boolean).sort(), [allEvents]);
    const muestreadorOptions = useMemo(() =>
        globalMuestreadores.map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador })),
        [globalMuestreadores]
    );

    const cancellationOptions = useMemo(() =>
        cancellationReasons.map(r => ({ value: String(r.id_estadomuestreo), label: r.nombre_estadomuestreo })),
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
        const s = (ev.estado_caso || '').toUpperCase();
        return s.includes('EJECUTADO') || s.includes('REALIZADO') || s.includes('COMPLETADO');
    }, []);

    const getStatusColor = useCallback((ev: CalendarEvent): 'orange' | 'green' | 'red' => {
        if (isCancelledEvent(ev)) return 'red';
        if (isExecutedEvent(ev)) return 'green';
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
        return <FichaUniversalView fichaId={detailFichaId} onBack={() => setDetailFichaId(null)} />;
    }

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
                    backgroundColor: cancelled ? 'rgba(224,49,49,0.06)' : undefined
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
                <span className="block truncate text-xs font-bold" title={ev.empresa_servicio}>
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
                            className="h-11 w-11 rounded-full"
                            title="Filtros Avanzados"
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <IconFilter size={20} />
                        </Button>
                    </div>
                }
            />

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
                    </div>
                </div>
            )}

            <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Leyenda:</span>
                <Badge variant="warning">Pendiente</Badge>
                <Badge variant="success">Ejecutado</Badge>
                <Badge variant="destructive">Cancelado</Badge>
            </div>

            <div className="relative min-h-[650px] rounded-[10px] border border-border p-4">
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
                                                {events.sort((a, b) => a.correlativo.localeCompare(b.correlativo)).map((ev) => (
                                                    <EventCard key={`${ev.id}-${ev.tipo_evento}`} ev={ev} />
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

                        <div className="mb-2 grid grid-cols-7" style={{ gap: isCompact ? 4 : 5 }}>
                            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                                <span key={d} className="text-center font-extrabold uppercase text-muted-foreground" style={{ fontSize: isCompact ? 10 : 12 }}>{d}</span>
                            ))}
                        </div>

                        <div className="grid grid-cols-7" style={{ gap: isCompact ? 4 : 5 }}>
                            {calendarCells.map((day, idx) => {
                                const events = day ? filteredEvents.filter(ev => ev.event_dia === day && ev.event_mes === currentMonth.getMonth() + 1 && ev.event_ano === currentMonth.getFullYear()) : [];
                                const todayDate = new Date();
                                const isToday = day === todayDate.getDate() && currentMonth.getMonth() === todayDate.getMonth() && currentMonth.getFullYear() === todayDate.getFullYear();
                                const maxBadges = isCompact ? 4 : 3;

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
                                            padding: isCompact ? 2 : 5,
                                            height: isMobile ? 65 : (isCompact ? 100 : 120),
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
                                                    {isMobile && events.length > 0 && (
                                                        <div className="flex gap-0.5">
                                                            {events.slice(0, 2).map((_, eidx) => (
                                                                <div key={eidx} className="h-1 w-1 rounded-full bg-primary" />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {!isMobile && (
                                                    <div className="mt-1 flex flex-col gap-0.5">
                                                        {events.slice(0, maxBadges).map((ev, eidx) => (
                                                            <Badge
                                                                key={eidx}
                                                                variant={STATUS_VARIANT[getStatusColor(ev)]}
                                                                className="w-full justify-center truncate px-0.5 py-0 text-center leading-[1.4]"
                                                                style={{ fontSize: isCompact ? 10 : 8 }}
                                                            >
                                                                {ev.correlativo}
                                                            </Badge>
                                                        ))}
                                                        {events.length > maxBadges && (
                                                            <span className="text-center text-[10px] text-muted-foreground">+{events.length - maxBadges}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {viewMode === 'week' && (
                    <div className="py-2">
                        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
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
                                            {dayEvents.sort((a, b) => a.correlativo.localeCompare(b.correlativo)).map((ev) => (
                                                <EventCard key={`${ev.id}-${ev.tipo_evento}`} ev={ev} compact />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {viewMode === 'year' && (
                    <div className="py-2">
                        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                            {Array.from({ length: 12 }).map((_, mIdx) => {
                                const mDate = new Date(currentMonth.getFullYear(), mIdx, 1);
                                const mName = mDate.toLocaleString('es-ES', { month: 'long' });
                                const mCaps = mName.charAt(0).toUpperCase() + mName.slice(1);
                                const mEvents = filteredEvents.filter(ev => ev.event_mes === mIdx + 1 && ev.event_ano === currentMonth.getFullYear());

                                return (
                                    <div
                                        key={mIdx}
                                        onClick={() => { setCurrentMonth(mDate); setViewMode('month'); }}
                                        className="h-[200px] cursor-pointer rounded-lg border border-border p-4"
                                    >
                                        <div className="mb-4 flex items-center justify-between">
                                            <span className="text-[15px] font-semibold">{mCaps}</span>
                                            <Badge variant="secondary">{mEvents.length}</Badge>
                                        </div>
                                        <div className="grid grid-cols-7 gap-[3px]">
                                            {Array.from({ length: 31 }).map((__, dIdx) => {
                                                const hasEvent = mEvents.some(e => e.event_dia === dIdx + 1);
                                                return (
                                                    <div
                                                        key={dIdx}
                                                        className={cn('h-2.5 rounded-sm', hasEvent ? 'border border-[#00508a] bg-primary' : 'bg-muted/40')}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <Dialog open={!!selectedEvent} onOpenChange={(open) => { if (!open) setSelectedEvent(null); }}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[720px]">
                    <DialogHeader>
                        <div className="flex items-center justify-between pr-6">
                            <DialogTitle>Resumen de Muestreo - {selectedEvent?.correlativo}</DialogTitle>
                            {selectedEvent && <Badge variant={STATUS_VARIANT[getStatusColor(selectedEvent)]} className="text-[13px]">{selectedEvent.estado_caso}</Badge>}
                        </div>
                    </DialogHeader>
                    {selectedEvent && (
                        <div className="flex flex-col gap-4">
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
                                        <ProtectedContent permission="MA_CALENDARIO_CANCELAR">
                                            <Button variant="destructive" onClick={() => setShowCancelConfirm(true)}>Cancelar Muestreo</Button>
                                        </ProtectedContent>
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

            <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Cancelación de Muestreo</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <p className="text-[13px]">¿Está seguro que desea cancelar este muestreo? Esta acción es irreversible.</p>

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
                                    await fichaService.cancelAgendaSampling(
                                        selectedEvent.id_agenda,
                                        selectedEvent.id,
                                        { id: user?.id || 0, usuario: user?.name || '' },
                                        cancelReason,
                                        Number(selectedReasonId)
                                    );
                                    showToast({ type: 'success', message: 'Muestreo cancelado correctamente.' });
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
