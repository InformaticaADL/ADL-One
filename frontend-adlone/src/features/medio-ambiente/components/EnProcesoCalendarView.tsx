import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fichaService } from '../services/ficha.service';
import { catalogosService } from '../services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { CoordinacionDetailView } from './CoordinacionDetailView';
import '../../admin/admin.css';

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
}

interface CalendarEvent extends FichaEvento {
    tipo_evento: 'INICIO' | 'RETIRO';
    event_dia: number;
    event_mes: number;
    event_ano: number;
}

const filterStyle: React.CSSProperties = {
    padding: '0.5rem 2rem 0.5rem 1rem',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    backgroundColor: 'white',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#1e293b',
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2364748b\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.75rem center',
    backgroundSize: '1rem',
    width: '100%',
    minWidth: '220px',
};

const navBtnStyle: React.CSSProperties = {
    background: 'white',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '4px 12px',
    cursor: 'pointer',
    fontSize: '0.85rem'
};

export const EnProcesoCalendarView: React.FC<Props> = ({ onBackToMenu }) => {
    const { showToast } = useToast();
    const { user, hasPermission } = useAuth();
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
    const [muestreadoresList, setMuestreadoresList] = useState<any[]>([]);
    const [isSavingEvent, setIsSavingEvent] = useState(false);
    const [showVersionPrompt, setShowVersionPrompt] = useState(false);
    const [pendingPayload, setPendingPayload] = useState<any>(null);

    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const filterPanelRef = useRef<HTMLDivElement>(null);

    const [globalMuestreadores, setGlobalMuestreadores] = useState<any[]>([]);
    const [globalEmpresas, setGlobalEmpresas] = useState<any[]>([]);

    const [equiposMuestreo, setEquiposMuestreo] = useState<any[]>([]);
    const [isLoadingEquipos, setIsLoadingEquipos] = useState(false);

    useEffect(() => {
        const loadCatalogs = async () => {
            try {
                const [mData, eData] = await Promise.all([
                    catalogosService.getMuestreadores(),
                    catalogosService.getEmpresasServicio()
                ]);
                setGlobalMuestreadores(mData || []);
                setGlobalEmpresas(eData || []);
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

            setEquiposMuestreo([]);

            let currentEvDate = selectedEvent.fecha;
            if (selectedEvent.tipo_evento === 'RETIRO' && selectedEvent.fecha_retiro) {
                currentEvDate = selectedEvent.fecha_retiro;
            }

            const currDateObj = currentEvDate ? new Date(currentEvDate) : new Date();
            const dateStr = `${currDateObj.getUTCFullYear()}-${String(currDateObj.getUTCMonth() + 1).padStart(2, '0')}-${String(currDateObj.getUTCDate()).padStart(2, '0')}`;
            setEditedDate(dateStr);
            setEditedSamplerId(selectedEvent.tipo_evento === 'INICIO' ? (selectedEvent.id_muestreador || '') : (selectedEvent.id_muestreador2 || selectedEvent.id_muestreador || ''));

            // Load equipos
            const loadEquipos = async () => {
                setIsLoadingEquipos(true);
                try {
                    const equipos = await fichaService.getSamplingEquipos(selectedEvent.id, selectedEvent.correlativo);
                    setEquiposMuestreo(equipos.data || equipos || []);
                } catch (error) {
                    console.error("Error loading sampling equipments:", error);
                    showToast({ type: 'error', message: 'Error cargando equipos del muestreo' });
                } finally {
                    setIsLoadingEquipos(false);
                }
            };
            loadEquipos();
        }
    }, [selectedEvent, showToast]);

    const loadMuestreadoresForEdit = async () => {
        try {
            const data = await catalogosService.getMuestreadores();
            setMuestreadoresList(data || []);
        } catch (error) {
            console.error('Error loading muestreadores', error);
            showToast({ type: 'error', message: 'Error cargando lista de muestreadores' });
        }
    };

    const loadData = useCallback(async () => {
        try {
            let response;
            if (viewMode === 'year') {
                response = await fichaService.getEnProceso(undefined, currentMonth.getFullYear());
            } else {
                response = await fichaService.getEnProceso(currentMonth.getMonth() + 1, currentMonth.getFullYear());
            }

            let data: FichaEvento[] = [];
            if (Array.isArray(response)) data = response;
            else if (response && response.data && Array.isArray(response.data)) data = response.data;
            else if (response && Array.isArray(response.recordset)) data = response.recordset;

            setFichas(data || []);
        } catch (error) {
            console.error('Error loading calendar data:', error);
            showToast({ type: 'error', message: 'Error cargando el calendario de fichas.' });
        } finally {
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
                event_dia: f.dia,
                event_mes: f.mes,
                event_ano: f.ano
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

    const empresas = useMemo(() => {
        if (globalEmpresas.length > 0) {
            return globalEmpresas
                .map(e => e.nombre || e.nombre_empresaservicios || e.razon_social)
                .filter(Boolean)
                .sort();
        }
        const unique = Array.from(new Set(fichas.map(f => f.empresa_servicio))).filter(Boolean);
        return unique.sort();
    }, [fichas, globalEmpresas]);

    const muestreadores = useMemo(() => {
        if (globalMuestreadores.length > 0) {
            return globalMuestreadores
                .map(m => m.nombre || m.nombre_muestreador)
                .filter(Boolean)
                .sort();
        }
        const unique = Array.from(new Set(fichas.map(f => f.muestreador))).filter(Boolean);
        return unique.sort();
    }, [fichas, globalMuestreadores]);

    const centros = useMemo(() => {
        let pool = fichas;
        if (selectedEmpresa) {
            pool = fichas.filter(f => f.empresa_servicio === selectedEmpresa);
        }
        const unique = Array.from(new Set(pool.map(f => f.centro))).filter(Boolean);
        return unique.sort();
    }, [fichas, selectedEmpresa]);

    useEffect(() => {
        if (selectedCentro && !centros.includes(selectedCentro)) {
            setSelectedCentro('');
        }
    }, [selectedEmpresa, centros, selectedCentro]);

    const companyColorMap = useMemo(() => {
        const map: Record<string, { bg: string, text: string }> = {};
        const colors = [
            { bg: '#e0f2fe', text: '#0369a1' },
            { bg: '#f0fdf4', text: '#15803d' },
            { bg: '#fff7ed', text: '#c2410c' },
            { bg: '#faf5ff', text: '#7e22ce' },
            { bg: '#fff1f2', text: '#be123c' },
            { bg: '#ecfeff', text: '#0e7490' },
            { bg: '#fdf2f8', text: '#be185d' }
        ];
        empresas.forEach((e, idx) => {
            map[e || ''] = colors[idx % colors.length];
        });
        return map;
    }, [empresas]);

    const monthName = currentMonth.toLocaleString('es-ES', { month: 'long' });
    const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

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
        return (
            <CoordinacionDetailView
                fichaId={detailFichaId}
                onBack={() => setDetailFichaId(null)}
            />
        );
    }

    let innerContent;
    if (selectedEvent) {
        innerContent = (
            <div className="admin-container" style={{ maxWidth: '100%', padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.2)',
                    width: '95%',
                    maxWidth: '1000px',
                    padding: '1rem 2rem 2rem',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    position: 'relative'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderBottom: '1px solid #f1f5f9',
                        paddingBottom: '0.4rem',
                        marginBottom: '0',
                        position: 'relative',
                        width: '100%',
                        minHeight: '2.5rem'
                    }}>
                        <button
                            onClick={() => setSelectedEvent(null)}
                            style={{
                                position: 'absolute',
                                left: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                padding: '0.4rem 0.8rem',
                                border: '1px solid #e2e8f0',
                                background: '#f8fafc',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                color: '#64748b',
                                fontSize: '0.75rem',
                                transition: 'all 0.2s',
                                zIndex: 10
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f1f5f9';
                                e.currentTarget.style.borderColor = '#cbd5e1';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#f8fafc';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                            Volver
                        </button>

                        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#1e293b' }}>Resumen de Muestreo</h2>

                        <span style={{
                            position: 'absolute',
                            right: 0,
                            padding: '4px 12px',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            backgroundColor: selectedEvent.tipo_evento === 'INICIO' ? '#dbeafe' : '#fee2e2',
                            color: selectedEvent.tipo_evento === 'INICIO' ? '#1e40af' : '#b91c1c',
                            textTransform: 'uppercase'
                        }}>
                            {selectedEvent.tipo_evento}
                        </span>
                    </div>

                    {/* Título Equipos y Versiones (Moved to top right of main grid section) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem', alignItems: 'stretch' }}>
                        {/* Left Column: Form Details */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '1rem', alignItems: 'start' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Cod. Correlativo</label>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0f172a', padding: '8px 6px', backgroundColor: '#fbfcff', border: '1px solid #e2e8f0', borderRadius: '6px', wordBreak: 'break-all', whiteSpace: 'normal', minHeight: '38px', display: 'flex', alignItems: 'center' }}>{selectedEvent.frecuencia_correlativo || selectedEvent.correlativo || selectedEvent.id}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'flex-end' }}>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Monitoreo</label>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', padding: '8px 10px', backgroundColor: '#fbfcff', border: '1px solid #e2e8f0', borderRadius: '6px', minHeight: '38px', display: 'flex', alignItems: 'center' }}>{selectedEvent.tipo_ficha || '-'}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'flex-end' }}>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Empresa Servicio</label>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', padding: '8px 10px', backgroundColor: '#fbfcff', border: '1px solid #e2e8f0', borderRadius: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minHeight: '38px', display: 'flex', alignItems: 'center' }} title={selectedEvent.empresa_servicio}>{selectedEvent.empresa_servicio}</span>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'end' }}>
                                <div>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Fuente Centro</label>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', padding: '8px 10px', backgroundColor: '#fbfcff', border: '1px solid #e2e8f0', borderRadius: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={selectedEvent.centro}>{selectedEvent.centro || '-'}</span>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Sub Área</label>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', padding: '8px 10px', backgroundColor: '#fbfcff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>{selectedEvent.subarea || '-'}</span>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1rem', alignItems: 'end' }}>
                                <div>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Contacto Empresa</label>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', display: 'block', padding: '8px 10px', backgroundColor: '#fbfcff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>{selectedEvent.contacto || '-'}</span>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Correo Contacto</label>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', wordBreak: 'break-all', display: 'block', padding: '8px 10px', backgroundColor: '#fbfcff', border: '1px solid #e2e8f0', borderRadius: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={selectedEvent.correo_contacto}>{selectedEvent.correo_contacto || '-'}</span>
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Objetivo del Muestreo</label>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', wordBreak: 'break-word', display: 'block', padding: '8px 10px', backgroundColor: '#fbfcff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>{selectedEvent.objetivo || '-'}</span>
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Correo Empresa</label>
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', wordBreak: 'break-all', display: 'block', padding: '8px 10px', backgroundColor: '#fbfcff', border: '1px solid #e2e8f0', borderRadius: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={selectedEvent.correo_empresa}>{selectedEvent.correo_empresa || '-'}</span>
                                </div>
                                <button
                                    onClick={() => setDetailFichaId(selectedEvent.id)}
                                    style={{
                                        padding: '5px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid #2563eb',
                                        backgroundColor: '#eff6ff',
                                        color: '#2563eb',
                                        fontWeight: 700,
                                        fontSize: '0.7rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        height: '28px',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#2563eb';
                                        e.currentTarget.style.color = 'white';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '#eff6ff';
                                        e.currentTarget.style.color = '#2563eb';
                                    }}
                                >
                                    Ver detalle completo
                                </button>
                            </div>                            <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.4rem 0' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', minWidth: '120px' }}>
                                        {selectedEvent.tipo_evento === 'INICIO' ? 'Fecha Inicio:' : 'Fecha Término:'}
                                    </label>
                                    {isEditingDate ? (
                                        <input
                                            type="date"
                                            value={editedDate}
                                            onChange={(e) => setEditedDate(e.target.value)}
                                            style={{ padding: '0.3rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', flex: 1, maxWidth: '180px' }}
                                        />
                                    ) : (
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '1px', display: 'inline-block', minWidth: '120px' }}>
                                            {selectedEvent.tipo_evento === 'INICIO'
                                                ? (selectedEvent.fecha ? new Date(selectedEvent.fecha).toLocaleDateString('es-ES', { timeZone: 'UTC' }) : '-')
                                                : (selectedEvent.fecha_retiro ? new Date(selectedEvent.fecha_retiro).toLocaleDateString('es-ES', { timeZone: 'UTC' }) : '-')
                                            }
                                        </span>
                                    )}
                                </div>
                                {(() => {
                                    const stateStr = (selectedEvent.estado_caso || '').trim().toLowerCase();
                                    const corrStr = (selectedEvent.correlativo || '').trim().toLowerCase();
                                    const isRestricted = stateStr === 'cancelado' || corrStr.includes('cancelado') || (selectedEvent as any).id_validaciontecnica === 7 || stateStr === 'ejecutado' || corrStr.includes('ejecutado');

                                    return selectedEvent.tipo_evento === 'INICIO' && !isRestricted && hasPermission('MA_CALENDARIO_REAGENDAR') && (
                                        <button
                                            onClick={() => setIsEditingDate(!isEditingDate)}
                                            style={{
                                                padding: '0.3rem 0.8rem',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                backgroundColor: isEditingDate ? '#f1f5f9' : 'white',
                                                color: '#475569',
                                                fontWeight: 700,
                                                fontSize: '0.75rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            {isEditingDate ? 'Cancelar ed.' : 'Reagendar'}
                                        </button>
                                    );
                                })()}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', minWidth: '120px' }}>Muestreador Asignado:</label>
                                    {isEditingSampler ? (
                                        <select
                                            value={editedSamplerId}
                                            onChange={(e) => setEditedSamplerId(Number(e.target.value))}
                                            style={{ padding: '0.3rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '0.8rem', flex: 1, maxWidth: '180px' }}
                                        >
                                            <option value="">Seleccione un muestreador...</option>
                                            {muestreadoresList.map(m => (
                                                <option key={m.id || m.id_muestreador} value={m.id || m.id_muestreador}>{m.nombre || m.nombre_muestreador}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: '1px', display: 'inline-block', minWidth: '120px' }}>
                                            {selectedEvent.tipo_evento === 'RETIRO' ? (selectedEvent.muestreador_retiro || selectedEvent.muestreador || 'Sin Asignar') : (selectedEvent.muestreador || 'Sin Asignar')}
                                        </span>
                                    )}
                                </div>
                                {(() => {
                                    const stateStr = (selectedEvent.estado_caso || '').trim().toLowerCase();
                                    const corrStr = (selectedEvent.correlativo || '').trim().toLowerCase();
                                    const isRestricted = stateStr === 'cancelado' || corrStr.includes('cancelado') || (selectedEvent as any).id_validaciontecnica === 7 || stateStr === 'ejecutado' || corrStr.includes('ejecutado');

                                    return !isRestricted && hasPermission('MA_CALENDARIO_REASIGNAR') && (
                                        <button
                                            onClick={() => {
                                                if (!isEditingSampler && muestreadoresList.length === 0) loadMuestreadoresForEdit();
                                                setIsEditingSampler(!isEditingSampler);
                                            }}
                                            style={{
                                                padding: '0.3rem 0.8rem',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                backgroundColor: isEditingSampler ? '#f1f5f9' : 'white',
                                                color: '#475569',
                                                fontWeight: 700,
                                                fontSize: '0.75rem',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                            }}
                                        >
                                            {isEditingSampler ? 'Cancelar ed.' : 'Reasignar'}
                                        </button>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Right Column: Equipos y Versiones Section */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            borderLeft: '1px solid #e2e8f0',
                            paddingLeft: '2rem',
                            height: '100%'
                        }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', marginBottom: '1rem', textTransform: 'uppercase', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.5rem' }}>Equipos y Versiones</h3>
                            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
                                {isLoadingEquipos ? (
                                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                                        <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                                            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Cargando equipos...</span>
                                        </span>
                                    </div>
                                ) : equiposMuestreo.length > 0 ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                                        {equiposMuestreo.map((eq, idx) => (
                                            <div key={eq.id_equipo || idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '0.4rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>{eq.nombre_equipo || eq.nombre || `Equipo ID: ${eq.id_equipo}`}</span>
                                                    <div style={{ backgroundColor: '#f1f5f9', padding: '0.1rem 0.3rem', borderRadius: '9999px', fontSize: '0.55rem', fontWeight: 800, color: '#475569', border: '1px solid #cbd5e1', whiteSpace: 'nowrap', marginLeft: '0.3rem' }}>
                                                        v. {eq.version || 1}
                                                    </div>
                                                </div>
                                                <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 500, lineHeight: 1.1 }}>{eq.codigo_equipo || eq.codigo || 'Sin código'} • {eq.tipo_equipo || eq.tipoequipo || 'Sin tipo'}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #e2e8f0', fontSize: '0.85rem', fontWeight: 500 }}>
                                        No hay equipos registrados para este muestreo.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.5rem 0' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', paddingTop: '0.5rem' }}>
                        {(() => {
                            const stateStr = (selectedEvent.estado_caso || '').trim().toLowerCase();
                            const corrStr = (selectedEvent.correlativo || '').trim().toLowerCase();
                            const isWait = stateStr === 'cancelado' || corrStr.includes('cancelado') || (selectedEvent as any).id_validaciontecnica === 7;
                            const isDone = stateStr === 'ejecutado' || corrStr.includes('ejecutado');

                            if (isWait) {
                                return (
                                    <div style={{
                                        width: '100%',
                                        padding: '0.8rem',
                                        backgroundColor: '#fdf2f2',
                                        border: '1px solid #f87171',
                                        borderRadius: '10px',
                                        color: '#b91c1c',
                                        fontWeight: 700,
                                        textAlign: 'center',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.4rem',
                                        fontSize: '0.85rem'
                                    }}>
                                        ESTE MUESTREO HA SIDO CANCELADO
                                        {(selectedEvent as any).motivo_cancelacion && (
                                            <div style={{ marginLeft: '1rem', fontStyle: 'italic', fontWeight: 500 }}>
                                                - "{(selectedEvent as any).motivo_cancelacion}"
                                            </div>
                                        )}
                                    </div>
                                );
                            }

                            if (isDone) {
                                return (
                                    <div style={{
                                        width: '100%',
                                        padding: '0.8rem',
                                        backgroundColor: '#f0fdf4',
                                        border: '1px solid #4ade80',
                                        borderRadius: '10px',
                                        color: '#166534',
                                        fontWeight: 700,
                                        textAlign: 'center',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.4rem',
                                        fontSize: '0.85rem'
                                    }}>
                                        ESTE MUESTREO YA HA SIDO EJECUTADO
                                    </div>
                                );
                            }

                            return (
                                <>
                                    {hasPermission('MA_CALENDARIO_CANCELAR') && (
                                        <button
                                            onClick={() => setShowCancelConfirm(true)}
                                            disabled={isSavingEvent}
                                            style={{
                                                padding: '0.5rem 1.8rem',
                                                borderRadius: '8px',
                                                border: 'none',
                                                backgroundColor: '#ef4444',
                                                color: 'white',
                                                fontWeight: 700,
                                                fontSize: '0.85rem',
                                                cursor: isSavingEvent ? 'not-allowed' : 'pointer',
                                                transition: 'all 0.2s',
                                                boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.4)'
                                            }}
                                        >
                                            {isSavingEvent ? 'Procesando...' : 'CANCELAR MUESTREO'}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            if (!isEditingDate && !isEditingSampler) {
                                                showToast({ type: 'info', message: 'No hay cambios para guardar.' });
                                                return;
                                            }
                                            // Calculate automated withdrawal date if start is being moved
                                            let finalFecha = selectedEvent.fecha;
                                            let finalFechaRetiro = selectedEvent.fecha_retiro;

                                            if (selectedEvent.tipo_evento === 'INICIO' && isEditingDate) {
                                                finalFecha = editedDate;
                                                // If there's a withdrawal date, maintain the gap
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
                                        disabled={isSavingEvent}
                                        style={{
                                            marginLeft: 'auto',
                                            padding: '0.6rem 2rem',
                                            borderRadius: '8px',
                                            border: 'none',
                                            backgroundColor: isSavingEvent ? '#93c5fd' : '#2563eb',
                                            color: 'white',
                                            fontWeight: 700,
                                            fontSize: '0.85rem',
                                            cursor: isSavingEvent ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s',
                                            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)'
                                        }}
                                    >
                                        {isSavingEvent ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </>
                            );
                        })()}
                    </div>
                </div>

                {/* VERSION PROMPT MODAL */}
                {showVersionPrompt && pendingPayload && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999
                    }}>
                        <div style={{
                            backgroundColor: 'white', borderRadius: '16px', padding: '2rem', maxWidth: '500px', width: '90%',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: 'center'
                        }}>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', marginBottom: '1rem' }}>
                                Versión de Equipos
                            </h3>
                            <p style={{ fontSize: '0.95rem', color: '#475569', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                                ¿Desea mantener la versión de equipos registrada al momento de la asignación original o actualizar con la versión actual de los equipos maestros?
                            </p>
                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                <button
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
                                    style={{
                                        padding: '0.75rem 1.5rem', borderRadius: '10px', border: '1px solid #2563eb',
                                        backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 700, fontSize: '0.9rem',
                                        cursor: 'pointer', transition: 'all 0.2s'
                                    }}
                                >
                                    Mantener versión original
                                </button>
                                <button
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
                                    style={{
                                        padding: '0.75rem 1.5rem', borderRadius: '10px', border: 'none',
                                        backgroundColor: '#2563eb', color: 'white', fontWeight: 700, fontSize: '0.9rem',
                                        cursor: 'pointer', transition: 'all 0.2s',
                                        boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)'
                                    }}
                                >
                                    Usar versión actual
                                </button>
                            </div>
                            <button
                                onClick={() => { setShowVersionPrompt(false); setPendingPayload(null); }}
                                style={{
                                    marginTop: '1rem', padding: '0.5rem 1rem', borderRadius: '8px',
                                    border: '1px solid #e2e8f0', backgroundColor: 'transparent', color: '#94a3b8',
                                    fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    } else if (viewMode === 'day' && selectedDay !== null) {
        innerContent = (
            <div className="admin-container" style={{ maxWidth: '100%', padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <button
                            onClick={() => setViewMode('month')}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem',
                                border: '1px solid #e2e8f0', background: 'white', borderRadius: '8px', cursor: 'pointer',
                                fontWeight: 600, color: '#64748b', transition: 'all 0.2s'
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                            Volver al Mes
                        </button>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                            {selectedDay} de {capitalizedMonth} de {currentMonth.getFullYear()}
                        </h2>
                    </div>
                </div>

                <div style={{ flexGrow: 1, display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', minHeight: '400px' }}>
                    {Object.entries(samplerGroups).length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', color: '#94a3b8' }}>
                            <p style={{ fontSize: '1.2rem', fontWeight: 500 }}>No hay muestreos programados para este día.</p>
                        </div>
                    ) : (
                        Object.entries(samplerGroups).map(([muestreador, events]) => (
                            <div key={muestreador} style={{ minWidth: '320px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700 }}>
                                        {muestreador.charAt(0)}
                                    </div>
                                    <span style={{ fontWeight: 700, color: '#1e293b' }}>{muestreador}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 'auto', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '10px' }}>
                                        {events.length} {events.length === 1 ? 'tarea' : 'tareas'}
                                    </span>
                                </div>
                                <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto' }}>
                                    {events.map((ev) => {
                                        const estadoCasoStr = (ev.estado_caso || '').trim().toLowerCase();
                                        const correlativoStr = (ev.correlativo || '').trim().toLowerCase();
                                        const isCancelled = estadoCasoStr === 'cancelado' || correlativoStr.includes('cancelado') || (ev as any).id_validaciontecnica === 7;
                                        const isEjecutado = estadoCasoStr === 'ejecutado' || correlativoStr.includes('ejecutado');
                                        const isPendiente = estadoCasoStr === 'pendiente' || correlativoStr.includes('pendiente');

                                        let bgColor = 'white';
                                        let borderColor = ev.tipo_evento === 'INICIO' ? '#dbeafe' : '#fee2e2';
                                        let borderLeftColor = ev.tipo_evento === 'INICIO' ? '#3b82f6' : '#ef4444';
                                        let textColor = 'inherit';

                                        if (isCancelled) {
                                            bgColor = '#fee2e2';
                                            borderColor = '#fca5a5';
                                            borderLeftColor = '#ef4444';
                                            textColor = '#991b1b';
                                        } else if (isEjecutado) {
                                            bgColor = '#dcfce7';
                                            borderColor = '#86efac';
                                            borderLeftColor = '#22c55e';
                                            textColor = '#166534';
                                        } else if (isPendiente) {
                                            bgColor = '#ffedd5';
                                            borderColor = '#fdba74';
                                            borderLeftColor = '#f97316';
                                            textColor = '#9a3412';
                                        }

                                        return (
                                            <div
                                                key={`${ev.id}-${ev.tipo_evento}`}
                                                onClick={() => setSelectedEvent(ev)}
                                                style={{
                                                    borderRadius: '10px', padding: '0.75rem', cursor: 'pointer', position: 'relative',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)', transition: 'all 0.2s',
                                                    display: 'flex', flexDirection: 'column', gap: '0.4rem',
                                                    border: `1px solid ${borderColor}`,
                                                    borderLeft: `5px solid ${borderLeftColor}`,
                                                    backgroundColor: bgColor,
                                                    color: textColor
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                                    <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{ev.correlativo}</span>
                                                    <span style={{ fontSize: '0.6rem', fontWeight: 900, padding: '2px 6px', borderRadius: '4px', backgroundColor: ev.tipo_evento === 'INICIO' ? '#3b82f6' : '#ef4444', color: 'white', textTransform: 'uppercase' }}>
                                                        {ev.tipo_evento}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.9 }}>{ev.empresa_servicio}</div>
                                                <div style={{ fontSize: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0', marginTop: '0.1rem', lineHeight: '1.2' }}>
                                                    <div><span style={{ fontWeight: 800, opacity: 0.8 }}>Centro:</span> {ev.centro}</div>
                                                    <div><span style={{ fontWeight: 800, opacity: 0.8 }}>Muestreador:</span> {ev.tipo_evento === 'INICIO' ? ev.muestreador : (ev.muestreador_retiro || ev.muestreador)}</div>
                                                    <div><span style={{ fontWeight: 800, opacity: 0.8 }}>Objetivo:</span> {ev.objetivo}</div>
                                                </div>
                                                {isCancelled && <div style={{ marginTop: '4px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Muestreo Cancelado</div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    } else if (viewMode === 'month') {
        innerContent = (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => <div key={d} style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 700, color: '#64748b' }}>{d}</div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(80px, 1fr)', flexGrow: 1, backgroundColor: '#f1f5f9', gap: '1px', overflowY: 'auto' }}>
                    {calendarCells.map((day, idx) => {
                        if (day === null) return <div key={`empty-${idx}`} style={{ background: '#f8fafc' }} />;
                        const todayStr = new Date();
                        const isToday = day === todayStr.getDate() && currentMonth.getMonth() === todayStr.getMonth() && currentMonth.getFullYear() === todayStr.getFullYear();
                        const dayEvents = filteredEvents.filter(f => f.event_dia === day && f.event_mes === currentMonth.getMonth() + 1 && f.event_ano === currentMonth.getFullYear());
                        return (
                            <div key={day} onClick={() => { if (dayEvents.length) { setSelectedDay(day); setViewMode('day'); } }} style={{ background: 'white', padding: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.15rem', cursor: dayEvents.length ? 'pointer' : 'default', backgroundColor: isToday ? '#eff6ff' : 'white', border: isToday ? '2px solid #3b82f6' : 'none' }}>
                                <div style={{ fontWeight: 700, color: dayEvents.length ? '#1e293b' : '#94a3b8' }}>{day}</div>
                                {dayEvents.slice(0, 3).map((ev, eIdx) => {
                                    const estadoCasoStr = (ev.estado_caso || '').trim().toLowerCase();
                                    const correlativoStr = (ev.correlativo || '').trim().toLowerCase();
                                    const colorsArr = companyColorMap[ev.empresa_servicio || ''] || { bg: '#e2e8f0', text: '#334155' };
                                    const isCancelled = estadoCasoStr === 'cancelado' || correlativoStr.includes('cancelado') || (ev as any).id_validaciontecnica === 7;
                                    const isEjecutado = estadoCasoStr === 'ejecutado' || correlativoStr.includes('ejecutado');
                                    const isPendiente = estadoCasoStr === 'pendiente' || correlativoStr.includes('pendiente');

                                    let bg = colorsArr.bg;
                                    let text = colorsArr.text;
                                    let borderStyle = 'none';

                                    if (isCancelled) {
                                        bg = '#fee2e2';
                                        text = '#991b1b';
                                        borderStyle = '1px solid #fca5a5';
                                    } else if (isEjecutado) {
                                        bg = '#dcfce7';
                                        text = '#166534';
                                        borderStyle = '1px solid #86efac';
                                    } else if (isPendiente) {
                                        bg = '#ffedd5';
                                        text = '#9a3412';
                                        borderStyle = '1px solid #fdba74';
                                    }

                                    return (
                                        <div key={eIdx} style={{ background: bg, color: text, border: borderStyle, fontSize: '0.6rem', padding: '2px 4px', borderRadius: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: isCancelled ? 'line-through' : 'none' }}>
                                            {ev.tipo_evento.charAt(0)}: {ev.correlativo}
                                        </div>
                                    );
                                })}
                                {dayEvents.length > 3 && <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>+ {dayEvents.length - 3} más</div>}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    } else if (viewMode === 'week') {
        const startOfWeek = new Date(currentMonth);
        const day = currentMonth.getDay();
        const diff = currentMonth.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);

        const weekDays = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            weekDays.push(d);
        }

        innerContent = (
            <div style={{ flexGrow: 1, display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '1rem' }}>
                {weekDays.map((date) => {
                    const dayEvents = filteredEvents.filter(ev =>
                        ev.event_dia === date.getDate() &&
                        ev.event_mes === date.getMonth() + 1 &&
                        ev.event_ano === date.getFullYear()
                    );
                    const isToday = new Date().toDateString() === date.toDateString();

                    return (
                        <div key={date.toISOString()} style={{
                            minWidth: '200px', flex: 1, backgroundColor: isToday ? '#eff6ff' : '#f8fafc',
                            borderRadius: '12px', border: `1px solid ${isToday ? '#3b82f6' : '#e2e8f0'}`,
                            display: 'flex', flexDirection: 'column', overflow: 'hidden'
                        }}>
                            <div style={{
                                padding: '0.75rem', backgroundColor: isToday ? '#3b82f6' : '#fff',
                                borderBottom: '1px solid #e2e8f0', textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: isToday ? '#fff' : '#64748b', textTransform: 'uppercase' }}>
                                    {date.toLocaleDateString('es-ES', { weekday: 'short' })}
                                </div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: isToday ? '#fff' : '#1e293b' }}>
                                    {date.getDate()}
                                </div>
                            </div>
                            <div style={{ padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
                                {dayEvents.length === 0 ? (
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center', padding: '1rem' }}>S/A</div>
                                ) : (
                                    dayEvents.map(ev => {
                                        const estadoCasoStr = (ev.estado_caso || '').trim().toLowerCase();
                                        const correlativoStr = (ev.correlativo || '').trim().toLowerCase();
                                        const isCancelled = estadoCasoStr === 'cancelado' || correlativoStr.includes('cancelado') || (ev as any).id_validaciontecnica === 7;
                                        const isEjecutado = estadoCasoStr === 'ejecutado' || correlativoStr.includes('ejecutado');
                                        const isPendiente = estadoCasoStr === 'pendiente' || correlativoStr.includes('pendiente');

                                        const colorsArr = companyColorMap[ev.empresa_servicio || ''] || { bg: '#e2e8f0', text: '#334155' };

                                        let bg = colorsArr.bg;
                                        let text = colorsArr.text;
                                        let borderLeftStyle = ev.tipo_evento === 'INICIO' ? '#3b82f6' : '#ef4444';
                                        let borderStyle = '1px solid transparent';

                                        if (isCancelled) {
                                            bg = '#fee2e2';
                                            text = '#991b1b';
                                            borderLeftStyle = '#ef4444';
                                            borderStyle = '1px solid #fca5a5';
                                        } else if (isEjecutado) {
                                            bg = '#dcfce7';
                                            text = '#166534';
                                            borderLeftStyle = '#22c55e';
                                            borderStyle = '1px solid #86efac';
                                        } else if (isPendiente) {
                                            bg = '#ffedd5';
                                            text = '#9a3412';
                                            borderLeftStyle = '#f97316';
                                            borderStyle = '1px solid #fdba74';
                                        }

                                        return (
                                            <div
                                                key={`${ev.id}-${ev.tipo_evento}`}
                                                onClick={() => setSelectedEvent(ev)}
                                                style={{
                                                    padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.65rem',
                                                    background: bg, color: text,
                                                    borderLeft: `3px solid ${borderLeftStyle}`,
                                                    border: borderStyle,
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s'
                                                }}
                                            >
                                                <div style={{ fontWeight: 800 }}>{ev.correlativo}</div>
                                                <div style={{ opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.empresa_servicio}</div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    } else if (viewMode === 'year') {
        const year = currentMonth.getFullYear();
        const months = Array.from({ length: 12 }, (_, i) => i);

        innerContent = (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem', overflowY: 'auto' }}>
                {months.map(m => {
                    const monthDate = new Date(year, m, 1);
                    const daysInMonth = new Date(year, m + 1, 0).getDate();
                    const firstDayRaw = new Date(year, m, 1).getDay();
                    const firstDay = (firstDayRaw === 0 ? 7 : firstDayRaw) - 1;
                    const monthName = monthDate.toLocaleString('es-ES', { month: 'long' });
                    const monthEvents = filteredEvents.filter(ev => ev.event_mes === m + 1 && ev.event_ano === year);

                    return (
                        <div
                            key={m}
                            onClick={() => {
                                setCurrentMonth(new Date(year, m, 1));
                                setViewMode('month');
                            }}
                            style={{
                                background: 'white',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                padding: '1rem',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#f8fafc';
                                e.currentTarget.style.borderColor = '#3b82f6';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'white';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                            }}
                        >
                            <h3 style={{ textTransform: 'capitalize', fontSize: '1rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.75rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {monthName}
                                <span style={{ fontSize: '0.7rem', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '10px' }}>{monthEvents.length}</span>
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => (
                                    <div key={d} style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textAlign: 'center', marginBottom: '4px' }}>{d}</div>
                                ))}
                                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                                {Array.from({ length: daysInMonth }).map((_, i) => {
                                    const day = i + 1;
                                    const hasEvents = monthEvents.some(ev => ev.event_dia === day);
                                    return (
                                        <div
                                            key={day}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const newDate = new Date(year, m, day);
                                                setCurrentMonth(newDate);
                                                setViewMode('month');
                                            }}
                                            style={{
                                                fontSize: '0.65rem', padding: '4px 0', textAlign: 'center', borderRadius: '4px', cursor: 'pointer',
                                                background: hasEvents ? '#3b82f6' : 'transparent',
                                                color: hasEvents ? 'white' : '#64748b',
                                                fontWeight: hasEvents ? 700 : 500
                                            }}
                                        >
                                            {day}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }


    return (
        <div className="admin-container" style={{ maxWidth: '100%', padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {(!selectedEvent) && (
                <div className="admin-header-section" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={onBackToMenu} className="btn-back">
                        <span className="icon-circle">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        </span>
                        Volver al Menú
                    </button>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <h1 className="admin-title" style={{ margin: 0 }}>Calendario Fichas en Proceso</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <button onClick={() => changeViewDate(-1)} style={navBtnStyle}>{"< Anterior"}</button>
                            <span style={{ fontSize: '1.1rem', fontWeight: 600, textTransform: 'capitalize', minWidth: '180px', textAlign: 'center' }}>
                                {viewMode === 'year' ? `${currentMonth.getFullYear()}` :
                                    viewMode === 'week' ? `Semana del ${new Date(currentMonth.getFullYear(), currentMonth.getMonth(), currentMonth.getDate() - (currentMonth.getDay() === 0 ? 6 : currentMonth.getDay() - 1)).toLocaleDateString('es-ES')}` :
                                        `${capitalizedMonth} ${currentMonth.getFullYear()}`}
                            </span>
                            <button onClick={() => changeViewDate(1)} style={navBtnStyle}>{"Siguiente >"}</button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', position: 'relative' }}>
                        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '4px' }}>
                            {(['day', 'week', 'month', 'year'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => {
                                        setViewMode(mode);
                                        if (mode === 'day') setSelectedDay(currentMonth.getDate());
                                    }}
                                    style={{
                                        padding: '4px 12px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        backgroundColor: viewMode === mode ? 'white' : 'transparent',
                                        boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                        color: viewMode === mode ? '#2563eb' : '#64748b',
                                        fontWeight: 700,
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        textTransform: 'uppercase',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {mode === 'day' ? 'Día' : mode === 'week' ? 'Semana' : mode === 'month' ? 'Mes' : 'Año'}
                                </button>
                            ))}
                        </div>

                        <div style={{ position: 'relative' }} ref={filterPanelRef}>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.5rem 1rem',
                                    border: '1px solid #e2e8f0',
                                    background: 'white',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    color: showFilters ? '#2563eb' : '#475569',
                                    boxShadow: showFilters ? '0 0 0 2px rgba(37, 99, 235, 0.1)' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
                                Filtros
                            </button>

                            {showFilters && (
                                <div style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 8px)',
                                    right: 0,
                                    zIndex: 5000,
                                    background: 'white',
                                    padding: '1.25rem',
                                    borderRadius: '12px',
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                                    minWidth: '300px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1rem'
                                }}>
                                    <div>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', display: 'block' }}>BUSCAR</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text"
                                                placeholder="Correlativo, centro, empresa..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                style={{ ...filterStyle, backgroundImage: 'none', padding: '10px 12px' }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', display: 'block' }}>EMPRESA</label>
                                        <select value={selectedEmpresa} onChange={(e) => setSelectedEmpresa(e.target.value)} style={filterStyle}>
                                            <option value="">Todas las Empresas</option>
                                            {empresas.map(e => <option key={e} value={e}>{e}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', display: 'block' }}>MUESTREADOR</label>
                                        <select value={selectedMuestreador} onChange={(e) => setSelectedMuestreador(e.target.value)} style={filterStyle}>
                                            <option value="">Todos los Muestreadores</option>
                                            {muestreadores.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.4rem', display: 'block' }}>FUENTE EMISORA</label>
                                        <select value={selectedCentro} onChange={(e) => setSelectedCentro(e.target.value)} style={filterStyle}>
                                            <option value="">Todos los Centros</option>
                                            {centros.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>

                                    {(searchTerm || selectedEmpresa || selectedMuestreador || selectedCentro) && (
                                        <button
                                            onClick={() => {
                                                setSearchTerm('');
                                                setSelectedEmpresa('');
                                                setSelectedMuestreador('');
                                                setSelectedCentro('');
                                            }}
                                            style={{
                                                marginTop: '0.5rem',
                                                padding: '0.6rem',
                                                borderRadius: '8px',
                                                border: '1px solid #fee2e2',
                                                backgroundColor: '#fef2f2',
                                                color: '#b91c1c',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                cursor: 'pointer'
                                            }}
                                        >
                                            Limpiar Filtros
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {innerContent}

            {showCancelConfirm && selectedEvent && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 3000 }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', width: '90%', maxWidth: '450px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, textAlign: 'center', marginBottom: '1rem' }}>¿Confirmar Cancelación?</h3>
                        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '1.5rem' }}>Estás a punto de cancelar el muestreo <strong>{selectedEvent.correlativo}</strong>.</p>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Motivo de cancelación <span style={{ color: '#ef4444' }}>*</span></label>
                            <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Escribe el motivo aquí..."
                                style={{ width: '100%', minHeight: '100px', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', resize: 'vertical' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={() => { setShowCancelConfirm(false); setCancelReason(''); }} style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', fontWeight: 700, cursor: 'pointer' }}>Mantener</button>
                            <button
                                onClick={async () => {
                                    setIsSavingEvent(true);
                                    try {
                                        await fichaService.cancelAgendaSampling(selectedEvent.id_agenda, selectedEvent.id, { id: user?.id || 0, usuario: user?.name || '' }, cancelReason);
                                        showToast({ type: 'success', message: 'Muestreo cancelado correctamente.' });
                                        setShowCancelConfirm(false);
                                        setCancelReason('');
                                        setSelectedEvent(null);
                                        loadData();
                                    } catch (err) {
                                        console.error(err);
                                        showToast({ type: 'error', message: 'Error al cancelar.' });
                                    } finally {
                                        setIsSavingEvent(false);
                                    }
                                }}
                                disabled={!cancelReason.trim() || isSavingEvent}
                                style={{ flex: 1, padding: '0.75rem', borderRadius: '10px', border: 'none', backgroundColor: (!cancelReason.trim() || isSavingEvent) ? '#cbd5e1' : '#ef4444', color: 'white', fontWeight: 700, cursor: (!cancelReason.trim() || isSavingEvent) ? 'not-allowed' : 'pointer' }}
                            >
                                {isSavingEvent ? 'Cancelando...' : 'Sí, Cancelar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
