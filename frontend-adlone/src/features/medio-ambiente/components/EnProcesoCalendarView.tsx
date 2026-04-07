import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
    Stack, 
    Paper, 
    Group, 
    Title, 
    Text, 
    Button, 
    Select, 
    TextInput, 
    ActionIcon, 
    Tooltip, 
    SimpleGrid,
    Badge,
    Modal,
    Divider,
    Box,
    Center,
    ScrollArea,
    UnstyledButton,
    Grid,
    Loader
} from '@mantine/core';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useMediaQuery } from '@mantine/hooks';
import { catalogosService } from '../services/catalogos.service';
import { fichaService } from '../services/ficha.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { CommercialDetailView } from './CommercialDetailView';
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
    const [pendingPayload, setPendingPayload] = useState<any>(null);

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
            setEditedSamplerId(selectedEvent.id_muestreador2 || selectedEvent.id_muestreador || '');
        }
    }, [selectedEvent, showToast]);

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

    const changeViewDate = (offset: number) => {
        let next = new Date(currentMonth);
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

            if (f.fecha_retiro && f.fecha_retiro !== '01/01/1900') {
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

    const getStatusColor = useCallback((ev: CalendarEvent) => {
        const fullStatusInfo = `${ev.estado_caso || ''} ${ev.correlativo || ''}`.toLowerCase();
        
        if (fullStatusInfo.includes('pendiente')) return 'orange';
        if (fullStatusInfo.includes('ejecutado')) return 'green';
        if (fullStatusInfo.includes('cancelado')) return 'red';
        
        // Fallback a colores fijos si no se encuentra palabra clave
        return ev.tipo_evento === 'INICIO' ? 'orange' : 'red';
    }, []);

    const StaticField = ({ label, value }: { label: string, value: any }) => (
        <Stack gap={2}>
            <Text size="xs" fw={700} c="dimmed" tt="uppercase">{label}</Text>
            <Paper withBorder p="xs" radius="md" bg="gray.0">
                <Text size="sm" fw={500} truncate title={String(value || '-')}>
                    {value || '-'}
                </Text>
            </Paper>
        </Stack>
    );


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

    const calendarCells = [];
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
        if ((viewMode !== 'day' && viewMode !== 'week') || selectedDay === null && viewMode === 'day') return {};

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

    if (detailFichaId) {
        return <CommercialDetailView fichaId={detailFichaId} onBack={() => setDetailFichaId(null)} />;
    }

    return (
        <Box p="md" style={{ width: '100%' }}>
            <Stack gap="lg">
                <PageHeader 
                    title="Calendario de Servicios" 
                    subtitle={!isCompact ? `${capitalizedMonth} ${currentMonth.getFullYear()}` : undefined}
                    onBack={onBackToMenu}
                    rightSection={
                        <Group gap="xs" wrap={isCompact ? "wrap" : "nowrap"}>
                            <Button.Group style={{ width: isCompact ? '100%' : 'auto' }}>
                                <Button 
                                    variant={viewMode === 'month' ? 'filled' : 'light'} 
                                    onClick={() => setViewMode('month')}
                                    size="xs"
                                    style={{ flex: 1 }}
                                >Mes</Button>
                                <Button 
                                    variant={viewMode === 'week' ? 'filled' : 'light'} 
                                    onClick={() => setViewMode('week')}
                                    size="xs"
                                    style={{ flex: 1 }}
                                >Semana</Button>
                                <Button 
                                    variant={viewMode === 'day' ? 'filled' : 'light'} 
                                    onClick={() => { 
                                        const today = new Date();
                                        if (viewMode !== 'day' && selectedDay === null) {
                                            if (currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear()) {
                                                setSelectedDay(today.getDate());
                                            } else {
                                                setSelectedDay(1);
                                            }
                                        }
                                        setViewMode('day'); 
                                    }}
                                    size="xs"
                                    style={{ flex: 1 }}
                                >Día</Button>
                                <Button 
                                    variant={viewMode === 'year' ? 'filled' : 'light'} 
                                    onClick={() => setViewMode('year')}
                                    size="xs"
                                    style={{ flex: 1 }}
                                >Año</Button>
                            </Button.Group>
                            <Group gap={5} style={{ flex: isCompact ? '1 1 auto' : 'auto' }}>
                                <ActionIcon variant="light" onClick={() => changeViewDate(-1)} size="md">
                                    <IconChevronLeft size={16} />
                                </ActionIcon>
                                <Button variant="subtle" size="xs" onClick={() => setCurrentMonth(new Date())}>Hoy</Button>
                                <ActionIcon variant="light" onClick={() => changeViewDate(1)} size="md">
                                    <IconChevronRight size={16} />
                                </ActionIcon>
                            </Group>
                            <Tooltip label="Filtros Avanzados">
                                <ActionIcon 
                                    variant={showFilters ? 'filled' : 'light'} 
                                    size="lg" 
                                    onClick={() => setShowFilters(!showFilters)}
                                >
                                    <IconFilter size={20} />
                                </ActionIcon>
                            </Tooltip>
                        </Group>
                    }
                />

                {showFilters && (
                    <Paper withBorder p="md" radius="md" shadow="xs">
                        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm">
                            <TextInput 
                                label="Buscar" 
                                placeholder="Ficha, empresa, muestreador..." 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)}
                                leftSection={<IconSearch size={14} />}
                                size="xs"
                            />
                            <Select 
                                label="Empresa Servicio" 
                                placeholder="Todas" 
                                data={empresas} 
                                value={selectedEmpresa} 
                                onChange={(val) => setSelectedEmpresa(val || '')}
                                clearable
                                searchable
                                size="xs"
                            />
                            <Select 
                                label="Muestreador" 
                                placeholder="Todos" 
                                data={muestreadores} 
                                value={selectedMuestreador} 
                                onChange={(val) => setSelectedMuestreador(val || '')}
                                clearable
                                searchable
                                size="xs"
                            />
                            <Select 
                                label="Centro / Fuente" 
                                placeholder="Todos" 
                                data={centros} 
                                value={selectedCentro} 
                                onChange={(val) => setSelectedCentro(val || '')}
                                clearable
                                searchable
                                size="xs"
                            />
                        </SimpleGrid>
                    </Paper>
                )}



                <Paper withBorder radius="md" shadow="sm" p="md" pos="relative" style={{ minHeight: '650px' }}>
                    {isLoading && (
                        <div style={{ 
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                            backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Stack align="center" gap="xs">
                                <Loader size="xl" variant="bars" />
                                <Text fw={500} c="blue.7">Cargando datos...</Text>
                            </Stack>
                        </div>
                    )}
                    {viewMode === 'day' && selectedDay !== null && (
                        <Box py="sm">
                            <Group justify="space-between" mb="md">
                                <Button 
                                    variant="subtle" 
                                    leftSection={<IconChevronLeft size={16} />} 
                                    onClick={() => { setViewMode('month'); setSelectedDay(null); }}
                                    size="sm"
                                >
                                    Volver al Mes
                                </Button>
                                <Title order={3}>
                                    {selectedDay} de {capitalizedMonth} de {currentMonth.getFullYear()}
                                </Title>
                            </Group>

                            <ScrollArea h={500}>
                                <Grid>
                                    {Object.entries(samplerGroups).length === 0 ? (
                                        <Grid.Col span={12}>
                                            <Center h={300}>
                                                <Stack align="center" gap="xs">
                                                    <IconCalendar size={48} color="var(--mantine-color-gray-4)" />
                                                    <Text size="lg" fw={500} c="dimmed">No hay servicios para este dia</Text>
                                                </Stack>
                                            </Center>
                                        </Grid.Col>
                                    ) : (
                                        Object.entries(samplerGroups).map(([muestreador, events]) => (
                                            <Grid.Col key={muestreador} span={{ base: 12, md: 6, lg: 4 }}>
                                                <Paper withBorder radius="md" p="sm" bg="gray.0" h="100%">
                                                    <Group justify="space-between" mb="sm">
                                                        <Group gap="xs">
                                                            <div style={{ 
                                                                width: 32, height: 32, borderRadius: '50%', 
                                                                backgroundColor: 'var(--mantine-color-blue-6)', 
                                                                color: 'white', display: 'flex', alignItems: 'center', 
                                                                justifyContent: 'center', fontWeight: 700, fontSize: 13 
                                                            }}>
                                                                {muestreador.charAt(0)}
                                                            </div>
                                                            <Text fw={700} size="sm">{muestreador}</Text>
                                                        </Group>
                                                        <Badge variant="light" size="xs">{events.length}</Badge>
                                                    </Group>
                                                    <Stack gap="xs">
                                                        {events.sort((a,b) => a.correlativo.localeCompare(b.correlativo)).map((ev) => {
                                                            const statusColor = getStatusColor(ev);
                                                            const isCancelled = statusColor === 'red';

                                                            return (
                                                                <UnstyledButton
                                                                    key={`${ev.id}-${ev.tipo_evento}`}
                                                                    onClick={() => {
                                                                        setSelectedEvent(ev);
                                                                    }}
                                                                >
                                                                    <Paper 
                                                                        withBorder p="xs" radius="sm" shadow="xs"
                                                                        style={{ 
                                                                            borderLeftWidth: 4, 
                                                                            borderLeftColor: `var(--mantine-color-${statusColor}-6)`,
                                                                            opacity: isCancelled ? 0.6 : 1,
                                                                        }}
                                                                        bg="white"
                                                                    >
                                                                        <Group justify="space-between" mb={4} wrap="nowrap" gap="xs">
                                                                            <Text size="10px" fw={900} c={statusColor} truncate>{ev.correlativo}</Text>
                                                                            <Badge size="10px" color={statusColor} radius="xs" style={{ flexShrink: 0 }}>{ev.tipo_evento}</Badge>
                                                                        </Group>
                                                                        <Text size="xs" fw={700} truncate title={ev.empresa_servicio}>{ev.empresa_servicio}</Text>
                                                                        <Text size="10px" c="dimmed" truncate>{ev.centro}</Text>
                                                                    </Paper>
                                                                </UnstyledButton>
                                                            );
                                                        })}
                                                    </Stack>
                                                </Paper>
                                            </Grid.Col>
                                        ))
                                    )}
                                </Grid>
                            </ScrollArea>
                        </Box>
                    )}

                    {viewMode === 'month' && (
                        <Box py="sm">
                            {/* Compact Month Navigation inside the calendar area */}
                            {isCompact && (
                                <Paper withBorder p="xs" radius="md" bg="blue.0" mb="md" shadow="xs">
                                    <Group justify="space-between">
                                        <ActionIcon variant="subtle" onClick={() => changeViewDate(-1)} size="md">
                                            <IconChevronLeft size={20} />
                                        </ActionIcon>
                                        <Text fw={800} size="md" style={{ textTransform: 'capitalize' }} c="blue.9">
                                            {capitalizedMonth} {currentMonth.getFullYear()}
                                        </Text>
                                        <ActionIcon variant="subtle" onClick={() => changeViewDate(1)} size="md">
                                            <IconChevronRight size={20} />
                                        </ActionIcon>
                                    </Group>
                                </Paper>
                            )}

                            <Grid columns={7} gutter={isCompact ? 4 : 5} mb="xs">
                                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
                                    <Grid.Col key={d} span={1}>
                                        <Text size={isCompact ? "10px" : "xs"} fw={800} ta="center" c="dimmed" tt="uppercase">
                                            {d}
                                        </Text>
                                    </Grid.Col>
                                ))}
                            </Grid>

                            <Grid columns={7} gutter={isCompact ? 4 : 5}>
                                {calendarCells.map((day, idx) => {
                                    const events = day ? filteredEvents.filter(ev => ev.event_dia === day && ev.event_mes === currentMonth.getMonth() + 1 && ev.event_ano === currentMonth.getFullYear()) : [];
                                    const todayDate = new Date();
                                    const isToday = day === todayDate.getDate() && currentMonth.getMonth() === todayDate.getMonth() && currentMonth.getFullYear() === todayDate.getFullYear();

                                    return (
                                        <Grid.Col key={idx} span={1}>
                                            <Box 
                                                p={isCompact ? 2 : 5} 
                                                h={isMobile ? 65 : (isCompact ? 100 : 120)}
                                                onClick={() => { if(day) { setSelectedDay(day); setViewMode('day'); } }}
                                                style={{ 
                                                    border: '1px solid var(--mantine-color-gray-2)',
                                                    borderRadius: '8px',
                                                    cursor: day ? 'pointer' : 'default',
                                                    transition: 'all 0.1s ease',
                                                    backgroundColor: isToday ? 'var(--mantine-color-blue-0)' : (day ? 'white' : 'transparent'),
                                                    opacity: day ? 1 : 0.3,
                                                    boxShadow: isToday ? '0 0 0 1px var(--mantine-color-blue-4) inset' : 'none'
                                                }}
                                            >
                                                {day && (
                                                    <>
                                                        <Group justify="space-between" align="center" gap={0} px={isCompact ? 2 : 4}>
                                                            <Text size={isCompact && !isMobile ? "sm" : (isMobile ? "xs" : "sm")} fw={isToday ? 900 : 700} c={isToday ? 'blue.7' : 'dark'}>{day}</Text>
                                                            {isMobile && events.length > 0 && (
                                                                <Group gap={2}>
                                                                    {events.slice(0, 2).map((_, eidx) => (
                                                                        <Box key={eidx} h={4} w={4} bg="blue.5" style={{ borderRadius: '50%' }} />
                                                                    ))}
                                                                    {events.length > 2 && <Box h={2} w={2} bg="gray.4" style={{ borderRadius: '50%' }} />}
                                                                </Group>
                                                            )}
                                                        </Group>
                                                        {!isMobile && (
                                                            <Box mt={4}>
                                                                <Stack gap={2}>
                                                                    {events.slice(0, isCompact ? 4 : 3).map((ev, eidx) => (
                                                                        <Badge 
                                                                            key={eidx} 
                                                                            size={isCompact ? "sm" : "10px"} 
                                                                            variant="filled" 
                                                                            color={getStatusColor(ev)}
                                                                            fullWidth radius="xs"
                                                                            styles={{ label: { padding: '2px', fontSize: isCompact ? '10px' : '8px', textTransform: 'none' } }}
                                                                        >
                                                                            {ev.correlativo}
                                                                        </Badge>
                                                                    ))}
                                                                    {events.length > (isCompact ? 4 : 3) && (
                                                                        <Text size="10px" ta="center" c="dimmed">+{events.length - (isCompact ? 4 : 3)}</Text>
                                                                    )}
                                                                </Stack>
                                                            </Box>
                                                        )}
                                                    </>
                                                )}
                                            </Box>
                                        </Grid.Col>
                                    );
                                })}
                            </Grid>
                        </Box>
                    )}

                    {viewMode === 'week' && (
                        <Box py="sm">
                            <SimpleGrid cols={{ base: 1, sm: 3, md: 7 }} spacing="xs">
                                {weekDays.map((date, idx) => {
                                    const d = date.getDate();
                                    const m = date.getMonth() + 1;
                                    const y = date.getFullYear();
                                    const dayName = date.toLocaleString('es-ES', { weekday: 'short' }).toUpperCase();
                                    const isToday = d === new Date().getDate() && date.getMonth() === new Date().getMonth() && y === new Date().getFullYear();
                                    
                                    const dayEvents = filteredEvents.filter(ev => ev.event_dia === d && ev.event_mes === m && ev.event_ano === y);

                                    return (
                                        <Paper key={idx} withBorder radius="md" p="xs" bg={isToday ? 'blue.0' : 'gray.0'} style={{ minHeight: '550px' }}>
                                            <Stack gap="xs">
                                                <Box ta="center" py={4} style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                                                    <Text size="xs" fw={800} c={isToday ? 'blue.7' : 'dimmed'}>{dayName}</Text>
                                                    <Text size="lg" fw={900} c={isToday ? 'blue.7' : 'dark'}>{d}</Text>
                                                </Box>
                                                <ScrollArea h={480} offsetScrollbars>
                                                    <Stack gap={6}>
                                                        {dayEvents.sort((a,b) => a.correlativo.localeCompare(b.correlativo)).map((ev) => {
                                                            const statusColor = getStatusColor(ev);
                                                            const isCancelled = statusColor === 'red';

                                                            return (
                                                                <UnstyledButton
                                                                    key={`${ev.id}-${ev.tipo_evento}`}
                                                                    onClick={() => {
                                                                        setSelectedEvent(ev);
                                                                    }}
                                                                >
                                                                    <Paper 
                                                                        withBorder p={6} radius="xs" shadow="xs"
                                                                        style={{ 
                                                                            borderLeftWidth: 4, 
                                                                            borderLeftColor: `var(--mantine-color-${statusColor}-6)`,
                                                                            opacity: isCancelled ? 0.6 : 1,
                                                                        }}
                                                                        bg="white"
                                                                    >
                                                                        <Group justify="space-between" mb={2} wrap="nowrap" gap="xs">
                                                                            <Text size="10px" fw={900} c={statusColor} truncate>{ev.correlativo}</Text>
                                                                            <Badge size="8px" variant="filled" color={statusColor} style={{ flexShrink: 0 }}>{ev.tipo_evento.charAt(0)}</Badge>
                                                                        </Group>
                                                                        <Text size="xs" fw={700} truncate lh={1}>{ev.empresa_servicio}</Text>
                                                                        <Text size="9px" c="dimmed" truncate>{ev.muestreador || 'Sin Asignar'}</Text>
                                                                    </Paper>
                                                                </UnstyledButton>
                                                            );
                                                        })}
                                                    </Stack>
                                                </ScrollArea>
                                            </Stack>
                                        </Paper>
                                    );
                                })}
                            </SimpleGrid>
                        </Box>
                    )}


                    {viewMode === 'year' && (
                        <Box py="sm">
                            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="xl">
                                {Array.from({ length: 12 }).map((_, mIdx) => {
                                    const mDate = new Date(currentMonth.getFullYear(), mIdx, 1);
                                    const mName = mDate.toLocaleString('es-ES', { month: 'long' });
                                    const mCaps = mName.charAt(0).toUpperCase() + mName.slice(1);
                                    const mEvents = filteredEvents.filter(ev => ev.event_mes === mIdx + 1 && ev.event_ano === currentMonth.getFullYear());
                                    
                                    return (
                                        <Paper 
                                            key={mIdx} withBorder p="md" radius="md" 
                                            onClick={() => { setCurrentMonth(mDate); setViewMode('month'); }} 
                                            style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                                            className="year-month-card"
                                            h={200}
                                        >
                                            <Group justify="space-between" mb="md">
                                                <Text size="md" fw={700}>{mCaps}</Text>
                                                <Badge size="sm" variant="filled">{mEvents.length}</Badge>
                                            </Group>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                                                {Array.from({ length: 31 }).map((__, dIdx) => {
                                                    const hasEvent = mEvents.some(e => e.event_dia === dIdx + 1);
                                                    return (
                                                        <div 
                                                            key={dIdx} 
                                                            style={{ 
                                                                height: 10, 
                                                                backgroundColor: hasEvent ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-gray-1)', 
                                                                borderRadius: 2,
                                                                border: hasEvent ? '1px solid var(--mantine-color-blue-8)' : 'none'
                                                            }} 
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </Paper>
                                    );
                                })}
                            </SimpleGrid>
                        </Box>
                    )}
                </Paper>
            </Stack>
            <Modal
                opened={!!selectedEvent}
                onClose={() => setSelectedEvent(null)}
                title={
                    <Group justify="space-between" w="100%" pr="lg">
                        <Text fw={900} size="lg">Resumen de Muestreo - {selectedEvent?.correlativo}</Text>
                        {selectedEvent && <Badge size="lg" radius="sm" color={getStatusColor(selectedEvent)}>{selectedEvent.estado_caso}</Badge>}
                    </Group>
                }
                size="xl"
                radius="md"
            >
                {selectedEvent && (
                    <Stack gap="md">
                        {selectedEvent.es_remuestreo === 'S' && (
                            <Paper withBorder p="xs" radius="md" bg="blue.0" mb="sm" style={{ borderColor: 'var(--mantine-color-blue-4)' }}>
                                <Group gap="xs">
                                    <IconAlertCircle size={18} color="var(--mantine-color-blue-6)" />
                                    <Text size="sm" fw={700} c="blue.9">
                                        REMUESTREO DE LA FICHA N° {selectedEvent.id_ficha_original}
                                    </Text>
                                </Group>
                            </Paper>
                        )}

                        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                            <StaticField label="Monitoreo" value={selectedEvent.tipo_ficha} />
                            <StaticField label="Sub Área" value={selectedEvent.subarea} />
                            <StaticField label="Objetivo" value={selectedEvent.objetivo} />
                        </SimpleGrid>

                        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                            <StaticField label="Empresa Servicio" value={selectedEvent.empresa_servicio} />
                            <StaticField label="Centro / Fuente" value={selectedEvent.centro} />
                        </SimpleGrid>

                        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                            <StaticField label="Contacto Empresa" value={selectedEvent.contacto || ''} />
                            <StaticField label="E-mail Contacto" value={selectedEvent.correo_contacto || ''} />
                        </SimpleGrid>

                        <StaticField label="Glosa / Tabla" value={selectedEvent.glosa} />

                        <Divider label="Gestión de Agenda" labelPosition="center" color="blue" />
                        
                        <Grid align="flex-end">
                            <Grid.Col span={6}>
                                <TextInput 
                                    label="Fecha de Muestreo (Agenda)" 
                                    type="date"
                                    value={editedDate}
                                    onChange={(e) => { setEditedDate(e.target.value); setIsEditingDate(true); }}
                                    size="sm"
                                />
                            </Grid.Col>
                            <Grid.Col span={6}>
                                <Select 
                                    label="Re-Asignar Muestreador" 
                                    placeholder="Seleccione..."
                                    data={Array.from(new Map(globalMuestreadores.map(m => [m.id_muestreador.toString(), m.nombre_muestreador])).entries()).map(([value, label]) => ({ value, label }))}
                                    value={editedSamplerId.toString()}
                                    onChange={(val) => { setEditedSamplerId(Number(val) || ''); setIsEditingSampler(true); }}
                                    size="sm"
                                    searchable
                                />
                            </Grid.Col>
                        </Grid>
                        <Group justify="space-between" mt="xl">
                            <Button 
                                variant="light" 
                                color="gray" 
                                leftSection={<IconSearch size={16} />}
                                onClick={() => {
                                    if (selectedEvent) {
                                        setDetailFichaId(selectedEvent.id);
                                        setSelectedEvent(null);
                                    }
                                }}
                            >
                                Ver Detalle Completo
                            </Button>
                            
                            <Group gap="sm">
                                <Button variant="outline" color="red" onClick={() => setShowCancelConfirm(true)}>
                                    Cancelar Muestreo
                                </Button>
                                <Button 
                                    leftSection={<IconDeviceFloppy size={18} />} 
                                    disabled={(!isEditingDate && !isEditingSampler) || isSavingEvent}
                                    loading={isSavingEvent}
                                    onClick={async () => {
                                        if (!selectedEvent) return;
                                        
                                        let finalFecha = selectedEvent.fecha;
                                        let finalFechaRetiro = selectedEvent.fecha_retiro;

                                        if (selectedEvent.tipo_evento === 'INICIO' && isEditingDate) {
                                            finalFecha = editedDate;
                                            if (selectedEvent.fecha && selectedEvent.fecha_retiro) {
                                                const start = new Date(selectedEvent.fecha);
                                                const end = new Date(selectedEvent.fecha_retiro);
                                                const gapMs = end.getTime() - start.getTime();
                                                if (gapMs > 0) {
                                                    const newStart = new Date(editedDate + 'T00:00:00Z');
                                                    const newEnd = new Date(newStart.getTime() + gapMs);
                                                    finalFechaRetiro = newEnd.toISOString().split('T')[0];
                                                }
                                            }
                                        } else if (selectedEvent.tipo_evento === 'RETIRO' && isEditingDate) {
                                            finalFechaRetiro = editedDate;
                                        }

                                        const payload = {
                                            assignments: [{
                                                id: selectedEvent.id_agenda,
                                                fecha: finalFecha,
                                                fechaRetiro: finalFechaRetiro,
                                                idMuestreadorInstalacion: selectedEvent.tipo_evento === 'INICIO' ? Number(editedSamplerId) || 0 : Number(selectedEvent.id_muestreador) || 0,
                                                idMuestreadorRetiro: selectedEvent.tipo_evento === 'RETIRO' ? Number(editedSamplerId) || 0 : Number(selectedEvent.id_muestreador2 || selectedEvent.id_muestreador) || 0,
                                                idFichaIngresoServicio: selectedEvent.id,
                                                frecuenciaCorrelativo: selectedEvent.correlativo
                                            }],
                                            user: { id: user?.id || 0, usuario: user?.name || 'Sistema' }
                                        };
                                        setPendingPayload(payload);
                                        setShowVersionPrompt(true);
                                    }}
                                >
                                    Guardar Cambios
                                </Button>
                            </Group>
                        </Group>
                    </Stack>
                )}
            </Modal>

            <Modal
                opened={showCancelConfirm}
                onClose={() => setShowCancelConfirm(false)}
                title="Confirmar Cancelación de Muestreo"
                centered
            >
                <Stack gap="md">
                    <Text size="sm">¿Está seguro que desea cancelar este muestreo? Esta acción es irreversible.</Text>
                    
                    <Select 
                        label="Motivo de Cancelación" 
                        placeholder="Seleccione un motivo..."
                        data={Array.from(new Map(cancellationReasons.map(r => [r.id_estadomuestreo.toString(), r.nombre_estadomuestreo])).entries()).map(([value, label]) => ({ value, label }))}
                        value={selectedReasonId.toString()}
                        onChange={(val) => setSelectedReasonId(Number(val) || '')}
                        required
                    />

                    <TextInput 
                        label="Observaciones adicionales" 
                        placeholder="Ingrese detalle del motivo..."
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        required
                    />

                    <Group justify="flex-end" mt="md">
                        <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>No, Volver</Button>
                        <Button 
                            color="red" 
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
                    </Group>
                </Stack>
            </Modal>

            <Modal
                opened={showVersionPrompt}
                onClose={() => setShowVersionPrompt(false)}
                title="Versión de Equipos"
                centered
            >
                <Stack>
                    <Text size="sm">¿Desea mantener la versión de equipos registrada al momento de la asignación original o actualizar con la versión actual de los equipos maestros?</Text>
                    <Group justify="flex-end" grow>
                        <Button 
                            variant="light"
                            onClick={async () => {
                                setShowVersionPrompt(false);
                                setIsSavingEvent(true);
                                try {
                                    await fichaService.batchUpdateAgenda(pendingPayload);
                                    showToast({ type: 'success', message: 'Muestreo reprogramado (versión original mantenida).' });
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
                            onClick={async () => {
                                setShowVersionPrompt(false);
                                setIsSavingEvent(true);
                                try {
                                    const updatedPayload = { ...pendingPayload };
                                    updatedPayload.assignments = updatedPayload.assignments.map((a: any) => ({
                                        ...a,
                                        actualizarVersiones: true
                                    }));
                                    await fichaService.batchUpdateAgenda(updatedPayload);
                                    showToast({ type: 'success', message: 'Muestreo reprogramado con versiones actualizadas.' });
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
                    </Group>
                </Stack>
            </Modal>
        </Box>
    );
};

