import React, { useState, useMemo, useEffect } from 'react';
import { adminService } from '../../../services/admin.service';
import { CoordinacionDetailView } from '../components/CoordinacionDetailView';
import '../../admin/admin.css';

interface Props {
    onBack: () => void;
}

interface DBRow {
    id_agendamam: number;
    fecha_muestreo: string | null;
    dia: number | null;
    mes: number | null;
    ano: number | null;
    frecuencia: string | null;
    id_fichaingresoservicio: number;
    id_estadomuestreo: number | null;
    id_empresa: number | null;
    nombre_empresa: string | null;
    id_fuenteemisora: number | null;
    nombre_fuenteemisora: string | null;
    nombre_fuenteemisora_ma: string | null;
    nombre_objetivomuestreo_ma: string | null;
    nombre_sector: string | null;
}

// Pastel colors to ensure text is readable
const PASTEL_COLORS = [
    '#bae6fd', '#bbf7d0', '#fef08a', '#fbcfe8', '#e9d5ff', '#fed7aa', '#c7d2fe', '#a7f3d0'
];

export const CalendarioReplicaPage: React.FC<Props> = ({ onBack }) => {
    const [selectedEmpresa, setSelectedEmpresa] = useState('');
    const [selectedFuente, setSelectedFuente] = useState('');
    const [dbData, setDbData] = useState<DBRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchDay, setSearchDay] = useState<number | ''>('');

    // Calendar state (defaults to current date month/year)
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedFichaId, setSelectedFichaId] = useState<number | null>(null);

    // Fetch data from real DB whenever month/year changes
    const month = currentDate.getMonth(); // 0 is January
    const year = currentDate.getFullYear();
    const today = new Date();
    const isPastMonth = (year < today.getFullYear()) || (year === today.getFullYear() && month < today.getMonth());

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Adjusting month + 1 because DB is likely 1-indexed for month
                const response = await adminService.getCalendarioReplica(month + 1, year);
                if (response.success && response.data) {
                    setDbData(response.data);
                }
            } catch (error) {
                console.error("Failed to load calendario data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [month, year]);

    // Extract unique companies
    const empresas = useMemo(() => {
        const unique = Array.from(new Set(dbData.map(d => d.nombre_empresa))).filter(Boolean) as string[];
        return unique.sort();
    }, [dbData]);

    // Extract unique sources based on selected company
    const fuentes = useMemo(() => {
        const filteredList = selectedEmpresa
            ? dbData.filter(d => d.nombre_empresa === selectedEmpresa)
            : dbData;
        const unique = Array.from(new Set(filteredList.map(d => d.nombre_fuenteemisora))).filter(Boolean) as string[];
        return unique.sort();
    }, [dbData, selectedEmpresa]);

    // Map companies to pastel colors
    const companyColorMap = useMemo(() => {
        const map: Record<string, { bg: string, text: string }> = {};
        empresas.forEach((e, idx) => {
            const bg = PASTEL_COLORS[idx % PASTEL_COLORS.length];
            map[e] = { bg, text: '#1e293b' };
        });
        return map;
    }, [empresas]);

    // JS Date is 0-indexed for months. 
    // new Date(year, month + 1, 0) gives the last day of the current month.
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // getDay() is 0 for Sunday, 1 for Monday.
    // Our grid starts on Monday.
    let firstDayOfWeek = new Date(year, month, 1).getDay() - 1;
    if (firstDayOfWeek === -1) firstDayOfWeek = 6; // Sunday becomes 6

    const emptyDaysBefore = firstDayOfWeek;
    const calendarCells = Array.from({ length: emptyDaysBefore + daysInMonth }, (_, i) => {
        if (i < emptyDaysBefore) return null;
        return i - emptyDaysBefore + 1;
    });

    // Formatting Date for display
    const monthFormatter = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' });
    const formattedMonth = monthFormatter.format(currentDate);

    // Handlers
    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    if (selectedFichaId) {
        return (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'white', zIndex: 1000, overflow: 'auto' }}>
                <CoordinacionDetailView
                    fichaId={selectedFichaId}
                    onBack={() => setSelectedFichaId(null)}
                />
            </div>
        );
    }

    return (
        <div className="admin-container" style={{ maxWidth: '100%', padding: '1rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="admin-header-section" style={{
                marginBottom: '1.5rem',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem'
            }}>
                <div style={{ flex: '1 1 200px' }}>
                    <button onClick={onBack} className="btn-back">
                        <span className="icon-circle">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                        </span>
                        Volver a Medio Ambiente
                    </button>
                </div>

                <div style={{ flex: '2 1 400px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <h1 className="admin-title" style={{ margin: 0, textAlign: 'center' }}>Calendario de Terreno</h1>

                    {/* Navigation Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button onClick={prevMonth} style={navBtnStyle} title="Mes Anterior">{"< Mes Anterior"}</button>
                        </div>
                        <div style={{
                            fontSize: '1.1rem',
                            fontWeight: 600,
                            color: '#334155',
                            textTransform: 'capitalize',
                            minWidth: '150px',
                            textAlign: 'center'
                        }}>
                            {formattedMonth}
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button onClick={nextMonth} style={navBtnStyle} title="Mes Siguiente">{"Mes Siguiente >"}</button>
                        </div>
                    </div>
                </div>

                <div style={{ flex: '1 1 300px', display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', position: 'relative' }}>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem',
                            border: '1px solid #e2e8f0', background: showFilters ? '#f1f5f9' : 'white',
                            borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#475569',
                            transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line>
                            <line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line>
                            <line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line>
                            <line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line>
                        </svg>
                        Filtros
                    </button>
                    {showFilters && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.75rem',
                            position: 'absolute',
                            top: 'calc(100% + 5px)',
                            right: 0,
                            zIndex: 1000,
                            background: 'white',
                            padding: '1rem',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
                            minWidth: '260px'
                        }}>
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value.replace(/[0-9]/g, ''))}
                                style={{ ...filterStyle, backgroundImage: 'none', padding: '8px 12px', border: '1px solid #cbd5e1' }}
                            />

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <select
                                    value={currentDate.getMonth()}
                                    onChange={(e) => {
                                        const newDate = new Date(currentDate);
                                        newDate.setMonth(parseInt(e.target.value));
                                        setCurrentDate(newDate);
                                    }}
                                    style={{ ...filterStyle, minWidth: '120px' }}
                                >
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i} value={i}>
                                            {new Date(2000, i).toLocaleString('es-CL', { month: 'long' }).charAt(0).toUpperCase() + new Date(2000, i).toLocaleString('es-CL', { month: 'long' }).slice(1)}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={currentDate.getFullYear()}
                                    onChange={(e) => {
                                        const newDate = new Date(currentDate);
                                        newDate.setFullYear(parseInt(e.target.value));
                                        setCurrentDate(newDate);
                                    }}
                                    style={{ ...filterStyle, minWidth: '94px' }}
                                >
                                    {Array.from({ length: 5 }, (_, i) => {
                                        const year = new Date().getFullYear() - 2 + i;
                                        return <option key={year} value={year}>{year}</option>;
                                    })}
                                </select>
                            </div>

                            <select
                                value={searchDay}
                                onChange={(e) => setSearchDay(e.target.value === '' ? '' : parseInt(e.target.value))}
                                style={filterStyle}
                            >
                                <option value="">Cualquier día</option>
                                {Array.from({ length: 31 }, (_, i) => (
                                    <option key={i + 1} value={i + 1}>Día {i + 1}</option>
                                ))}
                            </select>

                            <div style={{ height: '1px', background: '#e2e8f0', margin: '0.25rem 0' }}></div>

                            <select
                                value={selectedEmpresa}
                                onChange={(e) => {
                                    setSelectedEmpresa(e.target.value);
                                    setSelectedFuente(''); // Reset fuente on empresa change
                                }}
                                style={filterStyle}
                            >
                                <option value="">Todas las Empresas</option>
                                {empresas.map(emp => (
                                    <option key={emp} value={emp}>{emp}</option>
                                ))}
                            </select>

                            <select
                                value={selectedFuente}
                                onChange={(e) => setSelectedFuente(e.target.value)}
                                style={filterStyle}
                            >
                                <option value="">Todas las Fuentes</option>
                                {fuentes.map(fte => (
                                    <option key={fte} value={fte}>{fte}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            <div style={{
                background: 'white',
                borderRadius: '12px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                flexGrow: 1,
                overflow: 'hidden',
                position: 'relative'
            }}>
                {isLoading && (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(255,255,255,0.7)', zIndex: 10,
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        fontWeight: 'bold', color: '#64748b'
                    }}>
                        Cargando...
                    </div>
                )}
                {/* Header Row */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    textAlign: 'center',
                    fontWeight: 600,
                    color: '#475569',
                    fontSize: '0.9rem'
                }}>
                    <div style={{ padding: '0.75rem' }}>Lunes</div>
                    <div style={{ padding: '0.75rem' }}>Martes</div>
                    <div style={{ padding: '0.75rem' }}>Miércoles</div>
                    <div style={{ padding: '0.75rem' }}>Jueves</div>
                    <div style={{ padding: '0.75rem' }}>Viernes</div>
                    <div style={{ padding: '0.75rem' }}>Sábado</div>
                    <div style={{ padding: '0.75rem' }}>Domingo</div>
                </div>

                {/* Calendar Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gridAutoRows: 'minmax(120px, 1fr)',
                    flexGrow: 1,
                    overflowY: 'auto',
                    backgroundColor: '#f1f5f9',
                    gap: '1px', // Creates inner borders
                    filter: isPastMonth ? 'grayscale(1) opacity(0.8)' : 'none',
                    transition: 'filter 0.3s ease'
                }}>
                    {calendarCells.map((day, idx) => {
                        if (day === null) {
                            return <div key={`empty-${idx}`} style={{ background: '#f8fafc' }} />;
                        }

                        const today = new Date();
                        const isToday = day === today.getDate() &&
                            currentDate.getMonth() === today.getMonth() &&
                            currentDate.getFullYear() === today.getFullYear();

                        // Filter events for this day
                        let dayEvents: DBRow[] = [];

                        dayEvents = dbData.filter(row => {
                            if (row.dia !== day) return false;
                            if (selectedEmpresa && row.nombre_empresa !== selectedEmpresa) return false;
                            if (selectedFuente && row.nombre_fuenteemisora !== selectedFuente) return false;
                            if (searchDay !== '' && row.dia !== searchDay) return false;
                            if (searchTerm) {
                                const search = searchTerm.toLowerCase();
                                const match = (row.nombre_empresa || '').toLowerCase().includes(search) ||
                                    (row.nombre_fuenteemisora || '').toLowerCase().includes(search) ||
                                    (row.nombre_objetivomuestreo_ma || '').toLowerCase().includes(search) ||
                                    (row.frecuencia || '').toLowerCase().includes(search) ||
                                    String(row.id_fichaingresoservicio || '').toLowerCase().includes(search);
                                if (!match) return false;
                            }
                            return true;
                        });

                        return (
                            <div key={day} style={{
                                background: isToday ? '#eff6ff' : 'white',
                                padding: '0.5rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem',
                                position: 'relative',
                                border: isToday ? '2px solid #3b82f6' : 'none',
                                zIndex: isToday ? 1 : 0
                            }}>
                                <div style={{
                                    fontWeight: 700,
                                    color: isToday ? '#1e40af' : '#64748b',
                                    fontSize: '0.9rem',
                                    marginBottom: '0.25rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span>{day}</span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto', maxHeight: '100px', flexGrow: 1, paddingRight: '4px' }}>
                                    {dayEvents.map((ev, eIdx) => {
                                        const empresaName = ev.nombre_empresa || 'Desconocida';
                                        const colors = companyColorMap[empresaName] || { bg: '#e2e8f0', text: '#334155' };
                                        return (
                                            <div
                                                key={`${day}-${eIdx}`}
                                                title={`${empresaName} - ${ev.nombre_fuenteemisora || ''}\nObjetivo: ${ev.nombre_objetivomuestreo_ma || ''}\nSector: ${ev.nombre_sector || ''}\nFrecuencia: ${ev.frecuencia || ''}`}
                                                style={{
                                                    background: colors.bg,
                                                    color: colors.text,
                                                    fontSize: '0.7rem',
                                                    padding: '0.25rem 0.4rem',
                                                    borderRadius: '4px',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    fontWeight: 600,
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => setSelectedFichaId(ev.id_fichaingresoservicio)}
                                            >
                                                {ev.nombre_fuenteemisora || 'Sin Fuente'}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// Common Styles
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
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '0.25rem 0.75rem',
    cursor: 'pointer',
    color: '#475569',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.9rem'
};
