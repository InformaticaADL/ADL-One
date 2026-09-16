import React, { useState, useMemo, useEffect } from 'react';
import { adminService } from '../../../services/admin.service';
import { FichaUniversalView } from '../components/FichaUniversalView';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconChevronLeft,
    IconChevronRight,
    IconArrowLeft,
    IconFilter,
    IconInfoCircle
} from '@tabler/icons-react';

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
            <div className="shadcn-scope fixed inset-0 z-[1000] bg-card p-0">
                <FichaUniversalView
                    fichaId={selectedFichaId}
                    onBack={() => setSelectedFichaId(null)}
                />
            </div>
        );
    }

    return (
        <div className="shadcn-scope w-full py-4">
            <Card className="rounded-2xl">
                <div className="flex flex-col gap-6 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <Button variant="ghost" size={isMobile ? 'sm' : 'default'} onClick={onBack}>
                            <IconArrowLeft size={isMobile ? 16 : 20} />
                            {isMobile ? 'Volver' : 'Volver a Medio Ambiente'}
                        </Button>
                        <div className={cn('flex flex-col items-center', isMobile ? 'order-3 flex-[1_1_100%]' : 'order-2')}>
                            {!isMobile && (
                                <>
                                    <h2 className="m-0 text-2xl font-extrabold text-primary">Calendario de Terreno</h2>
                                    <div className="mt-2 flex items-center gap-2">
                                        <Button variant="ghost" size="icon" className="rounded-full" onClick={prevMonth}>
                                            <IconChevronLeft size={20} />
                                        </Button>
                                        <span className="w-[180px] text-center text-base font-semibold capitalize text-foreground">
                                            {formattedMonth}
                                        </span>
                                        <Button variant="ghost" size="icon" className="rounded-full" onClick={nextMonth}>
                                            <IconChevronRight size={20} />
                                        </Button>
                                    </div>
                                </>
                            )}
                            {isMobile && <h4 className="m-0 text-lg font-extrabold text-primary">Calendario de Terreno</h4>}
                        </div>
                        <Button
                            variant={showFilters ? 'default' : 'outline'}
                            size={isMobile ? 'sm' : 'default'}
                            className={isMobile ? 'order-2' : 'order-3'}
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            <IconFilter size={18} />
                            Filtros
                        </Button>
                    </div>

                    {showFilters && (
                        <Card className="bg-muted/40 p-4">
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                                <Field label="Buscar">
                                    <Input
                                        placeholder="Nombre, ficha..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="h-8 text-sm"
                                    />
                                </Field>
                                <Field label="Día">
                                    <Combobox
                                        placeholder="Todos"
                                        searchPlaceholder="Buscar día..."
                                        options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `Día ${i + 1}` }))}
                                        value={searchDay ?? ''}
                                        onValueChange={(v) => setSearchDay(v || null)}
                                    />
                                </Field>
                                <Field label="Empresa">
                                    <Combobox
                                        placeholder="Todas"
                                        searchPlaceholder="Buscar empresa..."
                                        options={empresas.map(e => ({ value: e, label: e }))}
                                        value={selectedEmpresa}
                                        onValueChange={(v) => { setSelectedEmpresa(v || ''); setSelectedFuente(''); }}
                                    />
                                </Field>
                                <Field label="Fuente">
                                    <Combobox
                                        placeholder="Todas"
                                        searchPlaceholder="Buscar fuente..."
                                        options={fuentes.map(f => ({ value: f, label: f }))}
                                        value={selectedFuente}
                                        onValueChange={(v) => setSelectedFuente(v || '')}
                                    />
                                </Field>
                                <div className="flex items-end">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full"
                                        onClick={() => {
                                            setSearchTerm('');
                                            setSearchDay(null);
                                            setSelectedEmpresa('');
                                            setSelectedFuente('');
                                        }}
                                    >
                                        Limpiar Filtros
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )}

                    <div className="relative min-h-[400px]">
                        {isLoading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            </div>
                        )}

                        {!isMobile ? (
                            <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border">
                                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(dayName => (
                                    <div key={dayName} className="flex justify-center bg-muted/50 p-2">
                                        <span className="text-[13px] font-semibold text-muted-foreground">{dayName}</span>
                                    </div>
                                ))}

                                {calendarCells.map((day, idx) => {
                                    if (day === null) return <div key={`empty-${idx}`} className="min-h-[120px] bg-muted/50" />;

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
                                            className={cn(
                                                'min-h-[120px] border-t border-border p-2',
                                                idx % 7 !== 0 && 'border-l',
                                                isPastMonth ? 'opacity-80 grayscale-[0.4]' : '',
                                                isToday ? 'z-[1] border-2 border-sky-400 bg-accent' : 'bg-card'
                                            )}
                                        >
                                            <span className={cn('mb-1 block text-[13px] font-semibold', isToday ? 'text-primary' : 'text-muted-foreground')}>
                                                {day}
                                            </span>
                                            <div className="flex flex-col gap-1">
                                                {dayEvents.map((ev, eIdx) => {
                                                    const empresa = ev.nombre_empresa || '';
                                                    const colors = companyColorMap[empresa] || { bg: '#f1f3f5', text: '#495057' };
                                                    return (
                                                        <div
                                                            key={`${day}-${eIdx}`}
                                                            title={`${empresa} - ${ev.nombre_fuenteemisora}\nObj: ${ev.nombre_objetivomuestreo_ma || '-'}`}
                                                            className="cursor-pointer overflow-hidden rounded px-1.5 py-0.5"
                                                            style={{ backgroundColor: colors.bg, borderLeft: `3px solid ${colors.text}` }}
                                                            onClick={() => setSelectedFichaId(ev.id_fichaingresoservicio)}
                                                        >
                                                            <span
                                                                title={ev.nombre_fuenteemisora || ''}
                                                                className="block overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-semibold text-slate-800"
                                                            >
                                                                {ev.nombre_fuenteemisora || 'S/F'}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <Card className="bg-accent p-3">
                                    <div className="flex items-center justify-between">
                                        <Button variant="ghost" size="icon" className="rounded-full" onClick={prevMonth}>
                                            <IconChevronLeft size={20} />
                                        </Button>
                                        <span className="text-base font-semibold capitalize text-primary">
                                            {formattedMonth}
                                        </span>
                                        <Button variant="ghost" size="icon" className="rounded-full" onClick={nextMonth}>
                                            <IconChevronRight size={20} />
                                        </Button>
                                    </div>
                                </Card>

                                <div className="overflow-x-auto">
                                    <div className="flex flex-nowrap gap-2 pb-2">
                                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                            const hasEvents = dbData.some(ev => ev.dia === day);
                                            const isSelected = selectedDayMobile === day;
                                            const dateObj = new Date(year, month, day);
                                            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

                                            return (
                                                <div
                                                    key={day}
                                                    onClick={() => setSelectedDayMobile(day)}
                                                    className={cn(
                                                        'min-w-[55px] cursor-pointer rounded-xl border p-2 text-center transition-transform',
                                                        isSelected ? 'scale-105 border-sky-400 bg-accent shadow-sm' : isToday ? 'border-border bg-muted/50' : 'border-border bg-card'
                                                    )}
                                                >
                                                    <span className={cn('block text-[10px] font-bold uppercase', isSelected ? 'text-primary' : 'text-muted-foreground')}>
                                                        {new Intl.DateTimeFormat('es-CL', { weekday: 'short' }).format(dateObj)}
                                                    </span>
                                                    <span className={cn('block text-base font-black', isSelected ? 'text-primary' : 'text-foreground')}>{day}</span>
                                                    {hasEvents && (
                                                        <span className={cn('mx-auto mt-1 block h-[5px] w-[5px] rounded-full', isSelected ? 'bg-primary' : 'bg-sky-300')} />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <div className="flex items-center justify-between px-1">
                                        <span className="text-[15px] font-semibold text-primary">Servicios del Día {selectedDayMobile}</span>
                                        <Badge variant="default">{dbData.filter(ev => ev.dia === selectedDayMobile).length} Servicios</Badge>
                                    </div>

                                    {dbData.filter(ev => ev.dia === selectedDayMobile).length === 0 ? (
                                        <Card className="border-dashed bg-muted/50 p-4">
                                            <div className="flex flex-col items-center gap-2">
                                                <IconInfoCircle size={40} className="text-muted-foreground" />
                                                <span className="text-[13px] font-medium text-muted-foreground">No hay servicios programados para esta fecha</span>
                                            </div>
                                        </Card>
                                    ) : (
                                        <div className="flex flex-col gap-3">
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
                                                        onClick={() => setSelectedFichaId(ev.id_fichaingresoservicio)}
                                                        className="cursor-pointer rounded-xl p-3"
                                                        style={{ borderLeft: `6px solid ${colors.text}`, background: `linear-gradient(to right, ${colors.bg}0A, var(--sc-card))` }}
                                                    >
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex flex-nowrap justify-between">
                                                                <span className="text-xs font-semibold tracking-wide text-primary">
                                                                    FICHA #{ev.id_fichaingresoservicio}
                                                                </span>
                                                                <Badge variant="default">{ev.nombre_objetivomuestreo_ma}</Badge>
                                                            </div>
                                                            <div>
                                                                <span className="block text-[13px] font-semibold leading-tight text-foreground">{ev.nombre_empresa}</span>
                                                                <span className="text-xs font-medium text-muted-foreground">{ev.nombre_fuenteemisora}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.text }} />
                                                                <span className="text-[11px] font-bold uppercase text-muted-foreground">Programado</span>
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
            <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
            {children}
        </div>
    );
}
