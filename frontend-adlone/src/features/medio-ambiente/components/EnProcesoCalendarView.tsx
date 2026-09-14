import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
    Button,
    Select,
    Input,
    Tooltip,
    Tag,
    Modal,
    Divider,
    Spin,
    Typography,
    Segmented,
} from 'antd';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { catalogosService } from '../services/catalogos.service';
import { fichaService } from '../services/ficha.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { FichaUniversalView } from '../components/FichaUniversalView';
import {
    IconCalendar,
    IconChevronLeft,
    IconChevronRight,
    IconFilter,
    IconSearch,
    IconDeviceFloppy,
    IconAlertCircle
} from '@tabler/icons-react';

const { Text, Title } = Typography;

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

const StaticField = ({ label, value }: { label: string, value: any }) => (
    <div>
        <Text style={{ fontSize: 11, fontWeight: 700, color: 'var(--app-text-secondary)', textTransform: 'uppercase', display: 'block' }}>{label}</Text>
        <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: '6px 10px', backgroundColor: 'var(--app-hover-bg)', marginTop: 2 }}>
            <Text style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }} title={String(value || '-')}>
                {value || '-'}
            </Text>
        </div>
    </div>
);

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
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Acceso Denegado</h2>
                <p>No tiene permisos para ver el Calendario En Proceso.</p>
                <button
                    onClick={onBackToMenu}
                    style={{ marginTop: '1rem', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                >
                    Volver
                </button>
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
                style={{
                    border: '1px solid var(--app-border)',
                    borderLeft: `4px solid ${STATUS_HEX[statusColor]}`,
                    borderRadius: 6, padding: compact ? 6 : 8,
                    opacity: cancelled ? 0.65 : 1,
                    backgroundColor: cancelled ? 'rgba(224,49,49,0.06)' : 'var(--app-bg)',
                    cursor: 'pointer',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <Text style={{
                        fontSize: 10, fontWeight: 900, color: STATUS_HEX[statusColor], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        textDecoration: cancelled ? 'line-through' : 'none',
                    }}>
                        {ev.correlativo}
                    </Text>
                    <Tag color={statusColor} style={{ flexShrink: 0, fontSize: compact ? 8 : 10, lineHeight: '14px', padding: '0 4px', marginInlineEnd: 0 }}>
                        {cancelled ? (compact ? 'C' : 'CANCEL.') : (isPuntualEvent(ev) ? (compact ? 'P' : 'PUNT.') : (compact ? ev.tipo_evento.charAt(0) : ev.tipo_evento))}
                    </Tag>
                </div>
                <Text style={{ fontSize: 12, fontWeight: 700, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ev.empresa_servicio}>
                    {ev.empresa_servicio}
                </Text>
                <Text type="secondary" style={{ fontSize: compact ? 9 : 10, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {compact ? (ev.muestreador || 'Sin Asignar') : ev.centro}
                </Text>
                {cancelled && ev.motivo_cancelacion && (
                    <Text style={{ fontSize: 9, color: '#e03131', fontWeight: 600, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ev.motivo_cancelacion}>
                        ⚠ {ev.motivo_cancelacion}
                    </Text>
                )}
            </div>
        );
    };

    return (
        <div>
            <PageHeader
                title="Calendario de Servicios"
                subtitle={!isCompact ? `${capitalizedMonth} ${currentMonth.getFullYear()}` : undefined}
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'Calendario Terreno' }
                ]}
                rightSection={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: isCompact ? 'wrap' : 'nowrap' }}>
                        <Segmented
                            value={viewMode}
                            onChange={(v) => {
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
                            options={[
                                { label: 'Mes', value: 'month' },
                                { label: 'Semana', value: 'week' },
                                { label: 'Día', value: 'day' },
                                { label: 'Año', value: 'year' },
                            ]}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Button type="text" shape="circle" icon={<IconChevronLeft size={16} />} onClick={() => changeViewDate(-1)} />
                            <Button type="text" size="small" onClick={() => setCurrentMonth(new Date())}>Hoy</Button>
                            <Button type="text" shape="circle" icon={<IconChevronRight size={16} />} onClick={() => changeViewDate(1)} />
                        </div>
                        <Tooltip title="Filtros Avanzados">
                            <Button
                                type={showFilters ? 'primary' : 'default'}
                                shape="circle"
                                size="large"
                                icon={<IconFilter size={20} />}
                                onClick={() => setShowFilters(!showFilters)}
                            />
                        </Tooltip>
                    </div>
                }
            />

            {showFilters && (
                <div ref={filterPanelRef} style={{ border: '1px solid var(--app-border)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                        <Field label="Buscar">
                            <Input placeholder="N° ficha, correlativo, empresa, muestreador..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} prefix={<IconSearch size={14} />} />
                        </Field>
                        <Field label="Empresa Servicio">
                            <Select placeholder="Todas" options={empresas.map(e => ({ value: e, label: e }))} value={selectedEmpresa || undefined} onChange={(v) => setSelectedEmpresa(v || '')} allowClear showSearch style={{ width: '100%' }} />
                        </Field>
                        <Field label="Muestreador">
                            <Select placeholder="Todos" options={muestreadores.map(m => ({ value: m, label: m }))} value={selectedMuestreador || undefined} onChange={(v) => setSelectedMuestreador(v || '')} allowClear showSearch style={{ width: '100%' }} />
                        </Field>
                        <Field label="Centro / Fuente">
                            <Select placeholder="Todos" options={centros.map(c => ({ value: c, label: c }))} value={selectedCentro || undefined} onChange={(v) => setSelectedCentro(v || '')} allowClear showSearch style={{ width: '100%' }} />
                        </Field>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>Leyenda:</Text>
                <Tag color="orange">Pendiente</Tag>
                <Tag color="green">Ejecutado</Tag>
                <Tag color="red">Cancelado</Tag>
            </div>

            <div style={{ border: '1px solid var(--app-border)', borderRadius: 10, padding: 16, position: 'relative', minHeight: 650 }}>
                {isLoading && (
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--app-bg)', opacity: 0.75, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                            <Spin size="large" />
                            <Text strong style={{ color: 'var(--app-accent-text)' }}>Cargando datos...</Text>
                        </div>
                    </div>
                )}

                {viewMode === 'day' && selectedDay !== null && (
                    <div style={{ padding: '8px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Button type="text" icon={<IconChevronLeft size={16} />} onClick={() => { setViewMode('month'); setSelectedDay(null); }}>
                                Volver al Mes
                            </Button>
                            <Title level={4} style={{ margin: 0 }}>{selectedDay} de {capitalizedMonth} de {currentMonth.getFullYear()}</Title>
                        </div>

                        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                            {Object.entries(samplerGroups).length === 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '80px 0' }}>
                                    <IconCalendar size={48} color="var(--app-text-secondary)" />
                                    <Text type="secondary" style={{ fontSize: 16, fontWeight: 500 }}>No hay servicios para este dia</Text>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                                    {Object.entries(samplerGroups).map(([muestreador, events]) => (
                                        <div key={muestreador} style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 10, backgroundColor: 'var(--app-hover-bg)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: '#1677ff', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13 }}>
                                                        {muestreador.charAt(0)}
                                                    </div>
                                                    <Text strong style={{ fontSize: 13 }}>{muestreador}</Text>
                                                </div>
                                                <Tag>{events.length}</Tag>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                    <div style={{ padding: '8px 0' }}>
                        {isCompact && (
                            <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 8, backgroundColor: 'var(--app-accent-bg)', marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Button type="text" shape="circle" icon={<IconChevronLeft size={20} />} onClick={() => changeViewDate(-1)} />
                                    <Text strong style={{ fontSize: 15, textTransform: 'capitalize', color: 'var(--app-accent-text)' }}>{capitalizedMonth} {currentMonth.getFullYear()}</Text>
                                    <Button type="text" shape="circle" icon={<IconChevronRight size={20} />} onClick={() => changeViewDate(1)} />
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isCompact ? 4 : 5, marginBottom: 8 }}>
                            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                                <Text key={d} type="secondary" style={{ fontSize: isCompact ? 10 : 12, fontWeight: 800, textAlign: 'center', textTransform: 'uppercase' }}>{d}</Text>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isCompact ? 4 : 5 }}>
                            {calendarCells.map((day, idx) => {
                                const events = day ? filteredEvents.filter(ev => ev.event_dia === day && ev.event_mes === currentMonth.getMonth() + 1 && ev.event_ano === currentMonth.getFullYear()) : [];
                                const todayDate = new Date();
                                const isToday = day === todayDate.getDate() && currentMonth.getMonth() === todayDate.getMonth() && currentMonth.getFullYear() === todayDate.getFullYear();
                                const maxBadges = isCompact ? 4 : 3;

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => { if (day) { setSelectedDay(day); setViewMode('day'); } }}
                                        style={{
                                            padding: isCompact ? 2 : 5,
                                            height: isMobile ? 65 : (isCompact ? 100 : 120),
                                            border: '1px solid var(--app-border)',
                                            borderRadius: 8,
                                            cursor: day ? 'pointer' : 'default',
                                            backgroundColor: isToday ? 'var(--app-accent-bg)' : (day ? 'var(--app-bg)' : 'transparent'),
                                            opacity: day ? 1 : 0.3,
                                            boxShadow: isToday ? 'inset 0 0 0 1px var(--app-accent-text)' : 'none',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {day && (
                                            <>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `0 ${isCompact ? 2 : 4}px` }}>
                                                    <Text style={{ fontSize: isCompact && !isMobile ? 13 : (isMobile ? 12 : 13), fontWeight: isToday ? 900 : 700, color: isToday ? 'var(--app-accent-text)' : 'var(--app-text)' }}>{day}</Text>
                                                    {isMobile && events.length > 0 && (
                                                        <div style={{ display: 'flex', gap: 2 }}>
                                                            {events.slice(0, 2).map((_, eidx) => (
                                                                <div key={eidx} style={{ height: 4, width: 4, borderRadius: '50%', backgroundColor: '#1677ff' }} />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                {!isMobile && (
                                                    <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        {events.slice(0, maxBadges).map((ev, eidx) => (
                                                            <Tag
                                                                key={eidx}
                                                                color={getStatusColor(ev)}
                                                                style={{ width: '100%', textAlign: 'center', fontSize: isCompact ? 10 : 8, padding: '1px 2px', margin: 0, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                            >
                                                                {ev.correlativo}
                                                            </Tag>
                                                        ))}
                                                        {events.length > maxBadges && (
                                                            <Text type="secondary" style={{ fontSize: 10, textAlign: 'center' }}>+{events.length - maxBadges}</Text>
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
                    <div style={{ padding: '8px 0' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                            {weekDays.map((date, idx) => {
                                const d = date.getDate();
                                const m = date.getMonth() + 1;
                                const y = date.getFullYear();
                                const dayName = date.toLocaleString('es-ES', { weekday: 'short' }).toUpperCase();
                                const isToday = d === new Date().getDate() && date.getMonth() === new Date().getMonth() && y === new Date().getFullYear();

                                const dayEvents = filteredEvents.filter(ev => ev.event_dia === d && ev.event_mes === m && ev.event_ano === y);

                                return (
                                    <div key={idx} style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 8, backgroundColor: isToday ? 'var(--app-accent-bg)' : 'var(--app-hover-bg)', minHeight: 550, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <div style={{ textAlign: 'center', paddingBottom: 4, borderBottom: '1px solid var(--app-border)' }}>
                                            <Text type="secondary" style={{ fontSize: 12, fontWeight: 800, color: isToday ? 'var(--app-accent-text)' : undefined }}>{dayName}</Text>
                                            <Text style={{ fontSize: 18, fontWeight: 900, display: 'block', color: isToday ? 'var(--app-accent-text)' : 'var(--app-text)' }}>{d}</Text>
                                        </div>
                                        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                    <div style={{ padding: '8px 0' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
                            {Array.from({ length: 12 }).map((_, mIdx) => {
                                const mDate = new Date(currentMonth.getFullYear(), mIdx, 1);
                                const mName = mDate.toLocaleString('es-ES', { month: 'long' });
                                const mCaps = mName.charAt(0).toUpperCase() + mName.slice(1);
                                const mEvents = filteredEvents.filter(ev => ev.event_mes === mIdx + 1 && ev.event_ano === currentMonth.getFullYear());

                                return (
                                    <div
                                        key={mIdx}
                                        onClick={() => { setCurrentMonth(mDate); setViewMode('month'); }}
                                        style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 16, cursor: 'pointer', height: 200 }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                            <Text strong style={{ fontSize: 15 }}>{mCaps}</Text>
                                            <Tag>{mEvents.length}</Tag>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                                            {Array.from({ length: 31 }).map((__, dIdx) => {
                                                const hasEvent = mEvents.some(e => e.event_dia === dIdx + 1);
                                                return (
                                                    <div
                                                        key={dIdx}
                                                        style={{
                                                            height: 10,
                                                            backgroundColor: hasEvent ? '#1677ff' : 'var(--app-hover-bg)',
                                                            borderRadius: 2,
                                                            border: hasEvent ? '1px solid #00508a' : 'none'
                                                        }}
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

            <Modal
                open={!!selectedEvent}
                onCancel={() => setSelectedEvent(null)}
                width={720}
                footer={null}
                title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 24 }}>
                        <Text strong style={{ fontSize: 16 }}>Resumen de Muestreo - {selectedEvent?.correlativo}</Text>
                        {selectedEvent && <Tag color={getStatusColor(selectedEvent)} style={{ fontSize: 13 }}>{selectedEvent.estado_caso}</Tag>}
                    </div>
                }
            >
                {selectedEvent && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {selectedEvent.es_remuestreo === 'S' && (
                            <div style={{ border: '1px solid var(--app-accent-text)', borderRadius: 8, padding: 8, backgroundColor: 'var(--app-accent-bg)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <IconAlertCircle size={18} color="var(--app-accent-text)" />
                                    <Text strong style={{ fontSize: 13, color: 'var(--app-accent-text)' }}>REMUESTREO DE LA FICHA N° {selectedEvent.id_ficha_original}</Text>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                            <StaticField label="Monitoreo" value={selectedEvent.tipo_ficha} />
                            <StaticField label="Sub Área" value={selectedEvent.subarea} />
                            <StaticField label="Objetivo" value={selectedEvent.objetivo} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                            <StaticField label="Empresa Servicio" value={selectedEvent.empresa_servicio} />
                            <StaticField label="Centro / Fuente" value={selectedEvent.centro} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                            <StaticField label="Contacto Empresa" value={selectedEvent.contacto || ''} />
                            <StaticField label="E-mail Contacto" value={selectedEvent.correo_contacto || ''} />
                        </div>

                        <StaticField label="Glosa / Tabla" value={selectedEvent.glosa} />

                        <Divider titlePlacement="center">
                            <Text style={{ fontSize: 12, color: 'var(--app-accent-text)' }}>Gestión de Agenda</Text>
                        </Divider>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'flex-end' }}>
                            <div>
                                {hasPermission('MA_CALENDARIO_REAGENDAR') && !isExecutedEvent(selectedEvent) ? (
                                    <>
                                        <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Fecha de Muestreo (Agenda)</Text>
                                        <Input type="date" min={todayStr} value={editedDate} onChange={(e) => { setEditedDate(e.target.value); setIsEditingDate(true); }} />
                                    </>
                                ) : (
                                    <StaticField label="Fecha de Muestreo (Agenda)" value={editedDate} />
                                )}
                            </div>
                            <div>
                                {hasPermission('MA_CALENDARIO_REASIGNAR') && !isExecutedEvent(selectedEvent) ? (
                                    <>
                                        <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Re-Asignar Muestreador</Text>
                                        <Select
                                            style={{ width: '100%' }}
                                            placeholder="Seleccione..."
                                            options={muestreadorOptions}
                                            value={editedSamplerId ? String(editedSamplerId) : undefined}
                                            onChange={(val) => { if (val) setEditedSamplerId(Number(val)); setIsEditingSampler(true); }}
                                            showSearch
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

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                            <ProtectedContent permission="FI_CAL_DETALLE">
                                <Button
                                    icon={<IconSearch size={16} />}
                                    onClick={() => {
                                        if (selectedEvent) {
                                            setDetailFichaId(selectedEvent.id);
                                            setSelectedEvent(null);
                                        }
                                    }}
                                >
                                    Ver Detalle Completo
                                </Button>
                            </ProtectedContent>

                            <div style={{ display: 'flex', gap: 8 }}>
                                {selectedEvent && !isCancelledEvent(selectedEvent) && !isExecutedEvent(selectedEvent) && (
                                    <ProtectedContent permission="MA_CALENDARIO_CANCELAR">
                                        <Button danger onClick={() => setShowCancelConfirm(true)}>Cancelar Muestreo</Button>
                                    </ProtectedContent>
                                )}
                                <ProtectedContent permission={['MA_CALENDARIO_REAGENDAR', 'MA_CALENDARIO_REASIGNAR']}>
                                    <Button
                                        type="primary"
                                        icon={<IconDeviceFloppy size={18} />}
                                        disabled={(!isEditingDate && !isEditingSampler) || isSavingEvent}
                                        loading={isSavingEvent}
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
                                        Guardar Cambios
                                    </Button>
                                </ProtectedContent>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                open={showCancelConfirm}
                onCancel={() => setShowCancelConfirm(false)}
                title="Confirmar Cancelación de Muestreo"
                centered
                footer={null}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Text style={{ fontSize: 13 }}>¿Está seguro que desea cancelar este muestreo? Esta acción es irreversible.</Text>

                    <div>
                        <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Motivo de Cancelación *</Text>
                        <Select
                            style={{ width: '100%' }}
                            placeholder="Seleccione un motivo..."
                            options={cancellationOptions}
                            value={selectedReasonId ? String(selectedReasonId) : undefined}
                            onChange={(val) => setSelectedReasonId(Number(val) || '')}
                        />
                    </div>

                    <div>
                        <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Observaciones adicionales *</Text>
                        <Input placeholder="Ingrese detalle del motivo..." value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button onClick={() => setShowCancelConfirm(false)}>No, Volver</Button>
                        <Button
                            danger
                            type="primary"
                            disabled={!cancelReason.trim() || !selectedReasonId || isSavingEvent}
                            loading={isSavingEvent}
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
                            Sí, Cancelar
                        </Button>
                    </div>
                </div>
            </Modal>

            <Modal
                open={showVersionPrompt}
                onCancel={() => setShowVersionPrompt(false)}
                title="Versión de Equipos"
                centered
                footer={null}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Text style={{ fontSize: 13 }}>
                        ¿Desea mantener la versión de equipos registrada al momento de la asignación original o actualizar con la versión actual de los equipos maestros?
                    </Text>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                            style={{ flex: 1 }}
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
                            type="primary"
                            style={{ flex: 1 }}
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
            </Modal>

            <Modal
                open={showReactivateConfirm}
                onCancel={() => setShowReactivateConfirm(false)}
                title="Reactivar y Reagendar Muestreo"
                centered
                footer={null}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {selectedEvent && (
                        <>
                            <div style={{ border: '1px solid rgba(224,49,49,0.25)', borderRadius: 8, padding: 10, backgroundColor: 'rgba(224,49,49,0.08)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <IconAlertCircle size={18} color="#e03131" />
                                    <Text strong style={{ fontSize: 13 }}>Este muestreo fue cancelado anteriormente</Text>
                                </div>
                            </div>

                            <div>
                                <Text style={{ fontSize: 11, fontWeight: 700, color: 'var(--app-text-secondary)', textTransform: 'uppercase', display: 'block' }}>Motivo de cancelación</Text>
                                <Text style={{ fontSize: 13 }}>{selectedEvent.motivo_cancelacion || 'No especificado'}</Text>
                            </div>

                            {cancelReason && (
                                <div>
                                    <Text style={{ fontSize: 11, fontWeight: 700, color: 'var(--app-text-secondary)', textTransform: 'uppercase', display: 'block' }}>Observaciones</Text>
                                    <Text style={{ fontSize: 13 }}>{cancelReason}</Text>
                                </div>
                            )}

                            <Divider style={{ margin: 0 }} />

                            <div>
                                <Text style={{ fontSize: 11, fontWeight: 700, color: 'var(--app-text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Nuevos datos</Text>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text style={{ fontSize: 13 }}>Fecha:</Text>
                                        <Text strong style={{ fontSize: 13 }}>{editedDate ? new Date(editedDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}</Text>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text style={{ fontSize: 13 }}>Muestreador:</Text>
                                        <Text strong style={{ fontSize: 13 }}>{globalMuestreadores.find(m => m.id_muestreador === Number(editedSamplerId))?.nombre_muestreador || 'Sin Asignar'}</Text>
                                    </div>
                                </div>
                            </div>

                            <Text type="secondary" style={{ fontSize: 13 }}>¿Desea reactivar este muestreo y aplicar los cambios?</Text>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <Button onClick={() => setShowReactivateConfirm(false)}>No, Volver</Button>
                                <Button
                                    type="primary"
                                    loading={isReactivating}
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
                                    Sí, Reactivar
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
        </div>
    );
}
