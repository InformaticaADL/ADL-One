import React, { useState, useMemo, useEffect } from 'react';
import { adminService } from '../../../services/admin.service';
import { FichaUniversalView } from '../components/FichaUniversalView';
import { Typography, Button, Select, Input, Tooltip, Card, Spin, Tag } from 'antd';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconChevronLeft,
    IconChevronRight,
    IconArrowLeft,
    IconFilter,
    IconInfoCircle
} from '@tabler/icons-react';

const { Title, Text } = Typography;

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
    const [searchDay, setSearchDay] = useState<string | null>(null);

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedFichaId, setSelectedFichaId] = useState<number | null>(null);
    const [selectedDayMobile, setSelectedDayMobile] = useState<number>(new Date().getDate());

    const isMobile = useMediaQuery('(max-width: 768px)');
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const today = new Date();
    const isPastMonth = (year < today.getFullYear()) || (year === today.getFullYear() && month < today.getMonth());

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
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

    const empresas = useMemo(() => {
        const unique = Array.from(new Set(dbData.map(d => d.nombre_empresa))).filter(Boolean) as string[];
        return unique.sort();
    }, [dbData]);

    const fuentes = useMemo(() => {
        const filteredList = selectedEmpresa
            ? dbData.filter(d => d.nombre_empresa === selectedEmpresa)
            : dbData;
        const unique = Array.from(new Set(filteredList.map(d => d.nombre_fuenteemisora))).filter(Boolean) as string[];
        return unique.sort();
    }, [dbData, selectedEmpresa]);

    const companyColorMap = useMemo(() => {
        const map: Record<string, { bg: string, text: string }> = {};
        const uniqueEmpresas = Array.from(new Set(dbData.map(d => d.nombre_empresa))).filter(Boolean) as string[];
        uniqueEmpresas.sort().forEach((e, idx) => {
            const bg = PASTEL_COLORS[idx % PASTEL_COLORS.length];
            map[e] = { bg, text: '#1e293b' };
        });
        return map;
    }, [dbData]);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDayOfWeek = new Date(year, month, 1).getDay() - 1;
    if (firstDayOfWeek === -1) firstDayOfWeek = 6;

    const calendarCells = useMemo(() => {
        const cells = Array.from({ length: firstDayOfWeek + daysInMonth }, (_, i) => {
            if (i < firstDayOfWeek) return null;
            return i - firstDayOfWeek + 1;
        });
        return cells;
    }, [firstDayOfWeek, daysInMonth]);

    const formattedMonth = useMemo(() => {
        return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(currentDate);
    }, [currentDate]);

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    if (selectedFichaId) {
        return (
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--app-bg-elevated)', zIndex: 1000, padding: 0 }}>
                <FichaUniversalView
                    fichaId={selectedFichaId}
                    onBack={() => setSelectedFichaId(null)}
                />
            </div>
        );
    }

    return (
        <div style={{ padding: '16px 0', width: '100%' }}>
            <Card style={{ borderRadius: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <Button
                            type="text"
                            size={isMobile ? 'small' : 'middle'}
                            icon={<IconArrowLeft size={isMobile ? 16 : 20} />}
                            onClick={onBack}
                        >
                            {isMobile ? 'Volver' : 'Volver a Medio Ambiente'}
                        </Button>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: isMobile ? '1 1 100%' : 'auto', order: isMobile ? 3 : 2 }}>
                            {!isMobile && (
                                <>
                                    <Title level={2} style={{ margin: 0, fontWeight: 800, color: '#1864ab' }}>Calendario de Terreno</Title>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                                        <Button type="text" shape="circle" icon={<IconChevronLeft size={20} />} onClick={prevMonth} />
                                        <Text strong style={{ fontSize: 16, width: 180, textAlign: 'center', textTransform: 'capitalize' }}>
                                            {formattedMonth}
                                        </Text>
                                        <Button type="text" shape="circle" icon={<IconChevronRight size={20} />} onClick={nextMonth} />
                                    </div>
                                </>
                            )}
                            {isMobile && <Title level={4} style={{ margin: 0, fontWeight: 800, color: '#1864ab' }}>Calendario de Terreno</Title>}
                        </div>
                        <Button
                            type={showFilters ? 'primary' : 'default'}
                            size={isMobile ? 'small' : 'middle'}
                            icon={<IconFilter size={18} />}
                            onClick={() => setShowFilters(!showFilters)}
                            style={{ order: isMobile ? 2 : 3 }}
                        >
                            Filtros
                        </Button>
                    </div>

                    {showFilters && (
                        <Card size="small" style={{ backgroundColor: 'var(--app-hover-bg)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                                <Field label="Buscar">
                                    <Input
                                        placeholder="Nombre, ficha..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        size="small"
                                    />
                                </Field>
                                <Field label="Día">
                                    <Select
                                        placeholder="Todos"
                                        options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `Día ${i + 1}` }))}
                                        value={searchDay ?? undefined}
                                        onChange={setSearchDay}
                                        size="small"
                                        allowClear
                                        style={{ width: '100%' }}
                                    />
                                </Field>
                                <Field label="Empresa">
                                    <Select
                                        placeholder="Todas"
                                        options={empresas.map(e => ({ value: e, label: e }))}
                                        value={selectedEmpresa || undefined}
                                        onChange={(v) => { setSelectedEmpresa(v || ''); setSelectedFuente(''); }}
                                        size="small"
                                        allowClear
                                        style={{ width: '100%' }}
                                    />
                                </Field>
                                <Field label="Fuente">
                                    <Select
                                        placeholder="Todas"
                                        options={fuentes.map(f => ({ value: f, label: f }))}
                                        value={selectedFuente || undefined}
                                        onChange={(v) => setSelectedFuente(v || '')}
                                        size="small"
                                        allowClear
                                        style={{ width: '100%' }}
                                    />
                                </Field>
                                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                                    <Button block type="text" size="small" onClick={() => {
                                        setSearchTerm('');
                                        setSearchDay(null);
                                        setSelectedEmpresa('');
                                        setSelectedFuente('');
                                    }}>
                                        Limpiar Filtros
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )}

                    <div style={{ position: 'relative', minHeight: 400 }}>
                        {isLoading && (
                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <Spin />
                            </div>
                        )}

                        {!isMobile ? (
                            <div style={{
                                display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1,
                                backgroundColor: 'var(--app-border)', border: '1px solid var(--app-border)', borderRadius: 8, overflow: 'hidden',
                            }}>
                                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(dayName => (
                                    <div key={dayName} style={{ padding: 8, backgroundColor: 'var(--app-hover-bg)', display: 'flex', justifyContent: 'center' }}>
                                        <Text strong style={{ fontSize: 13, color: 'var(--app-text-secondary)' }}>{dayName}</Text>
                                    </div>
                                ))}

                                {calendarCells.map((day, idx) => {
                                    if (day === null) return <div key={`empty-${idx}`} style={{ backgroundColor: 'var(--app-hover-bg)', minHeight: 120 }} />;

                                    const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

                                    const dayEvents = dbData.filter(row => {
                                        if (row.dia !== day) return false;
                                        if (selectedEmpresa && row.nombre_empresa !== selectedEmpresa) return false;
                                        if (selectedFuente && row.nombre_fuenteemisora !== selectedFuente) return false;
                                        if (searchDay && String(row.dia) !== searchDay) return false;
                                        if (searchTerm) {
                                            const search = searchTerm.toLowerCase();
                                            return (row.nombre_empresa?.toLowerCase().includes(search) ||
                                                    row.nombre_fuenteemisora?.toLowerCase().includes(search) ||
                                                    row.nombre_objetivomuestreo_ma?.toLowerCase().includes(search) ||
                                                    String(row.id_fichaingresoservicio).includes(search));
                                        }
                                        return true;
                                    });

                                    return (
                                        <div
                                            key={day}
                                            style={{
                                                padding: 8,
                                                backgroundColor: isToday ? 'var(--app-accent-bg)' : 'var(--app-bg-elevated)',
                                                minHeight: 120,
                                                borderTop: '1px solid var(--app-border)',
                                                borderLeft: idx % 7 !== 0 ? '1px solid var(--app-border)' : 'none',
                                                filter: isPastMonth ? 'grayscale(0.4) opacity(0.8)' : 'none',
                                                transition: 'all 0.2s',
                                                ...(isToday ? { border: '2px solid #4dabf7', zIndex: 1 } : {})
                                            }}
                                        >
                                            <Text strong style={{ fontSize: 13, color: isToday ? '#1864ab' : 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>
                                                {day}
                                            </Text>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                {dayEvents.map((ev, eIdx) => {
                                                    const empresa = ev.nombre_empresa || '';
                                                    const colors = companyColorMap[empresa] || { bg: '#f1f3f5', text: '#495057' };
                                                    return (
                                                        <Tooltip
                                                            key={`${day}-${eIdx}`}
                                                            title={<>{empresa} - {ev.nombre_fuenteemisora}<br />Obj: {ev.nombre_objetivomuestreo_ma || '-'}</>}
                                                        >
                                                            <div
                                                                style={{
                                                                    padding: '2px 6px',
                                                                    backgroundColor: colors.bg,
                                                                    cursor: 'pointer',
                                                                    borderRadius: 4,
                                                                    borderLeft: `3px solid ${colors.text}`,
                                                                    overflow: 'hidden',
                                                                }}
                                                                onClick={() => setSelectedFichaId(ev.id_fichaingresoservicio)}
                                                            >
                                                                <Text
                                                                    strong
                                                                    title={ev.nombre_fuenteemisora || ''}
                                                                    style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                                                                >
                                                                    {ev.nombre_fuenteemisora || 'S/F'}
                                                                </Text>
                                                            </div>
                                                        </Tooltip>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <Card size="small" style={{ backgroundColor: 'var(--app-accent-bg)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Button type="text" shape="circle" icon={<IconChevronLeft size={20} />} onClick={prevMonth} />
                                        <Text strong style={{ fontSize: 16, textTransform: 'capitalize', color: '#1864ab' }}>
                                            {formattedMonth}
                                        </Text>
                                        <Button type="text" shape="circle" icon={<IconChevronRight size={20} />} onClick={nextMonth} />
                                    </div>
                                </Card>

                                <div style={{ overflowX: 'auto' }}>
                                    <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 8, paddingBottom: 8 }}>
                                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                            const hasEvents = dbData.some(ev => ev.dia === day);
                                            const isSelected = selectedDayMobile === day;
                                            const dateObj = new Date(year, month, day);
                                            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

                                            return (
                                                <div
                                                    key={day}
                                                    onClick={() => setSelectedDayMobile(day)}
                                                    style={{
                                                        cursor: 'pointer',
                                                        minWidth: 55,
                                                        textAlign: 'center',
                                                        borderRadius: 12,
                                                        border: `1px solid ${isSelected ? '#4dabf7' : 'var(--app-border)'}`,
                                                        backgroundColor: isSelected ? 'var(--app-accent-bg)' : isToday ? 'var(--app-hover-bg)' : 'var(--app-bg-elevated)',
                                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                        transform: isSelected ? 'scale(1.05)' : 'none',
                                                        boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                                                        padding: 8,
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 10, color: isSelected ? '#1864ab' : 'var(--app-text-secondary)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                                                        {new Intl.DateTimeFormat('es-CL', { weekday: 'short' }).format(dateObj)}
                                                    </Text>
                                                    <Text style={{ fontWeight: 900, fontSize: 16, color: isSelected ? '#1864ab' : 'var(--app-text)', display: 'block' }}>{day}</Text>
                                                    {hasEvents && (
                                                        <div style={{ height: 5, width: 5, backgroundColor: isSelected ? '#1864ab' : '#74c0fc', borderRadius: '50%', margin: '4px auto 0' }} />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                                        <Text strong style={{ fontSize: 15, color: '#1864ab' }}>Servicios del Día {selectedDayMobile}</Text>
                                        <Tag color="blue">{dbData.filter(ev => ev.dia === selectedDayMobile).length} Servicios</Tag>
                                    </div>

                                    {dbData.filter(ev => ev.dia === selectedDayMobile).length === 0 ? (
                                        <Card size="small" style={{ backgroundColor: 'var(--app-hover-bg)', borderStyle: 'dashed' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16 }}>
                                                <IconInfoCircle size={40} color="var(--app-text-secondary)" />
                                                <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>No hay servicios programados para esta fecha</Text>
                                            </div>
                                        </Card>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {dbData.filter(ev => {
                                                if (ev.dia !== selectedDayMobile) return false;
                                                if (selectedEmpresa && ev.nombre_empresa !== selectedEmpresa) return false;
                                                if (selectedFuente && ev.nombre_fuenteemisora !== selectedFuente) return false;
                                                if (searchTerm) {
                                                    const s = searchTerm.toLowerCase();
                                                    return (ev.nombre_empresa?.toLowerCase().includes(s) ||
                                                           ev.nombre_fuenteemisora?.toLowerCase().includes(s));
                                                }
                                                return true;
                                            }).map((ev, eIdx) => {
                                                const empresa = ev.nombre_empresa || '';
                                                const colors = companyColorMap[empresa] || { bg: '#f1f3f5', text: '#495057' };
                                                return (
                                                    <Card
                                                        key={eIdx}
                                                        size="small"
                                                        onClick={() => setSelectedFichaId(ev.id_fichaingresoservicio)}
                                                        style={{
                                                            borderRadius: 12,
                                                            borderLeft: `6px solid ${colors.text}`,
                                                            cursor: 'pointer',
                                                            background: `linear-gradient(to right, ${colors.bg}0A, var(--app-bg-elevated))`
                                                        }}
                                                    >
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                                                                <Text strong style={{ fontSize: 12, color: '#1864ab', letterSpacing: 0.5 }}>
                                                                    FICHA #{ev.id_fichaingresoservicio}
                                                                </Text>
                                                                <Tag color="blue">{ev.nombre_objetivomuestreo_ma}</Tag>
                                                            </div>
                                                            <div>
                                                                <Text strong style={{ fontSize: 13, lineHeight: 1.2, display: 'block' }}>{ev.nombre_empresa}</Text>
                                                                <Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>{ev.nombre_fuenteemisora}</Text>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.text }} />
                                                                <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Programado</Text>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Card>
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
