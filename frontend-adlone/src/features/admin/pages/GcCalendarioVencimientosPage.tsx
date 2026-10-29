import React, { useEffect, useState, useMemo } from 'react';
import {
    IconArrowLeft, IconChevronLeft, IconChevronRight,
    IconAlertTriangle,
    IconCalendar, IconSearch, IconX, IconDeviceDesktop,
    IconUser, IconMapPin, IconCalendarStats, IconClock,
} from '@tabler/icons-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import apiClient from '../../../config/axios.config';
import type { Equipo } from '../services/equipo.service';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

interface Props { onBack: () => void; hideHeader?: boolean; onEditEquipo?: (eq: Equipo) => void }

type EstadoVig = 'vencido' | 'por_vencer' | 'vigente' | 'sin_fecha';

const ESTADO: Record<EstadoVig, {
    label: string;
    badgeCls: string;
    dotCls: string;
    barCls: string;
    kpiRing: string;
    kpiBg: string;
    kpiIcon: string;
    kpiNum: string;
}> = {
    vencido: {
        label: 'Vencido',
        badgeCls: 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-400 dark:ring-red-800',
        dotCls: 'bg-red-500',
        barCls: 'bg-red-500',
        kpiRing: 'ring-red-200 dark:ring-red-800',
        kpiBg: 'bg-red-50 dark:bg-red-950/40',
        kpiIcon: 'text-red-500',
        kpiNum: 'text-red-600 dark:text-red-400',
    },
    por_vencer: {
        label: 'Por vencer',
        badgeCls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:ring-amber-800',
        dotCls: 'bg-amber-500',
        barCls: 'bg-amber-400',
        kpiRing: 'ring-amber-200 dark:ring-amber-800',
        kpiBg: 'bg-amber-50 dark:bg-amber-950/40',
        kpiIcon: 'text-amber-500',
        kpiNum: 'text-amber-600 dark:text-amber-400',
    },
    vigente: {
        label: 'Vigente',
        badgeCls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-800',
        dotCls: 'bg-emerald-500',
        barCls: 'bg-emerald-500',
        kpiRing: 'ring-emerald-200 dark:ring-emerald-800',
        kpiBg: 'bg-emerald-50 dark:bg-emerald-950/40',
        kpiIcon: 'text-emerald-500',
        kpiNum: 'text-emerald-600 dark:text-emerald-400',
    },
    sin_fecha: {
        label: 'Sin fecha',
        badgeCls: 'bg-muted text-muted-foreground ring-1 ring-border',
        dotCls: 'bg-muted-foreground/40',
        barCls: 'bg-muted-foreground/30',
        kpiRing: 'ring-border',
        kpiBg: 'bg-muted/50',
        kpiIcon: 'text-muted-foreground',
        kpiNum: 'text-muted-foreground',
    },
};

// Parsea DD/MM/YYYY o ISO — igual que el dashboard
function parseVigenciaStr(str: string | null | undefined): dayjs.Dayjs | null {
    if (!str) return null;
    const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
        const d = dayjs(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
        return d.isValid() ? d : null;
    }
    const d = dayjs(str);
    return d.isValid() ? d : null;
}

function getEstado(vigencia: string | null | undefined): EstadoVig {
    if (!vigencia) return 'sin_fecha';
    const d = parseVigenciaStr(vigencia);
    if (!d) return 'sin_fecha';
    const hoy = dayjs().startOf('day');
    if (d.isBefore(hoy)) return 'vencido';
    if (d.isBefore(hoy.add(30, 'day'))) return 'por_vencer';
    return 'vigente';
}

function getVigencia(e: Equipo): string | null {
    return e.vigencia || e.siguiente_verificacion || null;
}

// ─── Badge compacto en celda del calendario ───────────────────────────────────
const EquipoBadge: React.FC<{ eq: Equipo; selected: boolean; onClick: (eq: Equipo) => void }> = ({ eq, selected, onClick }) => {
    const estado = getEstado(getVigencia(eq));
    const s = ESTADO[estado];
    return (
        <button
            type="button"
            onClick={() => onClick(eq)}
            title={`${eq.nombre} — ${eq.codigo}`}
            className={cn(
                'flex w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium transition-all',
                selected
                    ? 'ring-2 ring-primary/60 ' + s.badgeCls
                    : s.badgeCls + ' hover:brightness-95'
            )}
        >
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', s.dotCls)} />
            <span className="truncate">{eq.codigo || eq.nombre}</span>
        </button>
    );
};

// ─── Panel de detalle del equipo ──────────────────────────────────────────────
const DetallePanel: React.FC<{ eq: Equipo; onClose: () => void; onEdit?: (eq: Equipo) => void }> = ({ eq, onClose, onEdit }) => {
    const vig = getVigencia(eq);
    const estado = getEstado(vig);
    const s = ESTADO[estado];
    const diasRestantes = vig ? (parseVigenciaStr(vig)?.diff(dayjs().startOf('day'), 'day') ?? null) : null;

    const urgencyLabel = () => {
        if (estado === 'vencido' && diasRestantes !== null)
            return `Venció hace ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) !== 1 ? 's' : ''}`;
        if (estado === 'por_vencer' && diasRestantes !== null)
            return `Vence en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}`;
        if (estado === 'vigente' && diasRestantes !== null)
            return `${diasRestantes} días restantes`;
        return 'Sin fecha registrada';
    };

    const rows = [
        { icon: <IconDeviceDesktop size={13} />, label: 'Tipo', val: eq.tipo },
        { icon: <IconMapPin size={13} />, label: 'Ubicación', val: eq.ubicacion },
        { icon: <IconUser size={13} />, label: 'Técnico', val: eq.nombre_asignado },
        { icon: <IconCalendarStats size={13} />, label: 'Ult. verificación', val: eq.ultima_verificacion ? dayjs(eq.ultima_verificacion).format('DD/MM/YYYY') : null },
        { icon: <IconClock size={13} />, label: 'Plazo vigencia', val: eq.plazo_vigencia },
        { icon: null, label: 'Estado equipo', val: eq.estado_equipo },
    ].filter(r => r.val);

    return (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            {/* Color bar top */}
            <div className={cn('h-1 w-full', s.barCls)} />

            <div className="p-4">
                {/* Header */}
                <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', s.kpiBg)}>
                            <IconDeviceDesktop size={18} className={s.kpiIcon} />
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold leading-snug">{eq.nombre}</p>
                            <p className="text-[11px] font-mono text-muted-foreground">{eq.codigo}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        <IconX size={13} />
                    </button>
                </div>

                {/* Urgency pill */}
                <div className={cn('mb-3 flex items-center justify-between rounded-lg px-3 py-2', s.kpiBg)}>
                    <span className={cn('text-xs font-semibold', s.kpiNum)}>{urgencyLabel()}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', s.badgeCls)}>
                        {s.label}
                    </span>
                </div>

                {/* Vencimiento destacado */}
                {vig && (
                    <div className="mb-3 flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                        <IconCalendar size={14} className="text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Vencimiento</span>
                        <span className="ml-auto text-xs font-bold tabular-nums">{parseVigenciaStr(vig)?.format('DD MMM YYYY') ?? vig}</span>
                    </div>
                )}

                {/* Filas de detalle */}
                <div className="divide-y divide-border/60">
                    {rows.map(r => (
                        <div key={r.label} className="flex items-center gap-2 py-1.5">
                            {r.icon && <span className="text-muted-foreground">{r.icon}</span>}
                            <span className="text-[11px] text-muted-foreground">{r.label}</span>
                            <span className="ml-auto max-w-[55%] truncate text-right text-[11px] font-medium">{r.val}</span>
                        </div>
                    ))}
                </div>

                {onEdit && (
                    <button
                        type="button"
                        onClick={() => onEdit(eq)}
                        className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                        Abrir ficha del equipo
                    </button>
                )}
            </div>
        </div>
    );
};

// ─── Componente principal ─────────────────────────────────────────────────────
export const GcCalendarioVencimientosPage: React.FC<Props> = ({ onBack, hideHeader = false, onEditEquipo }) => {
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mes, setMes] = useState(() => dayjs().startOf('month'));
    const [search, setSearch] = useState('');
    const [filtroEstado, setFiltroEstado] = useState<EstadoVig | 'todos'>('todos');
    const [seleccionado, setSeleccionado] = useState<Equipo | null>(null);
    const [diaPopup, setDiaPopup] = useState<{ label: string; equipos: Equipo[] } | null>(null);

    useEffect(() => {
        apiClient.get('/api/admin/equipos', { params: { limit: 5000, page: 1 } })
            .then(r => {
                const data = r.data?.data?.equipos ?? r.data?.data ?? [];
                setEquipos(Array.isArray(data) ? data : []);
            })
            .catch(() => setError('No se pudieron cargar los equipos.'))
            .finally(() => setLoading(false));
    }, []);

    const equiposMes = useMemo(() => equipos.filter(e => {
        const v = getVigencia(e);
        if (!v) return false;
        const d = parseVigenciaStr(v);
        return d !== null && d.isSame(mes, 'month');
    }), [equipos, mes]);

    const equiposFiltrados = useMemo(() => {
        let list = equipos.filter(e => getVigencia(e) !== null);
        if (filtroEstado !== 'todos') list = list.filter(e => getEstado(getVigencia(e)) === filtroEstado);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(e =>
                e.nombre?.toLowerCase().includes(q) ||
                e.codigo?.toLowerCase().includes(q) ||
                e.nombre_asignado?.toLowerCase().includes(q) ||
                e.tipo?.toLowerCase().includes(q)
            );
        }
        return list.sort((a, b) => (parseVigenciaStr(getVigencia(a))?.isBefore(parseVigenciaStr(getVigencia(b))!) ? -1 : 1));
    }, [equipos, filtroEstado, search]);

    const diasGrilla = useMemo(() => {
        const inicio = mes.startOf('month');
        const fin = mes.endOf('month');
        const primerDia = inicio.day() === 0 ? 6 : inicio.day() - 1;
        const dias: (dayjs.Dayjs | null)[] = Array(primerDia).fill(null);
        for (let d = inicio; !d.isAfter(fin); d = d.add(1, 'day')) dias.push(d);
        while (dias.length % 7 !== 0) dias.push(null);
        return dias;
    }, [mes]);

    const equiposPorDia = useMemo(() => {
        const map = new Map<string, Equipo[]>();
        for (const e of equiposMes) {
            const v = getVigencia(e);
            if (!v) continue;
            const key = parseVigenciaStr(v)?.format('YYYY-MM-DD');
            if (!key) continue;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(e);
        }
        return map;
    }, [equiposMes]);

    const hoyStr = dayjs().format('YYYY-MM-DD');
    const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    if (loading) return (
        <div className="shadcn-scope flex h-72 flex-col items-center justify-center gap-3">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Cargando equipos…</p>
        </div>
    );

    if (error) return (
        <div className="shadcn-scope flex h-72 flex-col items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <IconAlertTriangle size={22} className="text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button onClick={onBack} className="text-xs text-primary underline">Volver</button>
        </div>
    );

    return (
        <div className="shadcn-scope flex flex-col gap-5 pb-8 pt-4">

            {/* ── Header (solo en vista standalone) ──────────────────────── */}
            {!hideHeader && (
                <div className="flex items-center gap-3 border-b pb-4">
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground shadow-xs hover:bg-muted hover:text-foreground transition-colors"
                    >
                        <IconArrowLeft size={14} />
                        Volver
                    </button>
                    <div className="h-4 w-px bg-border" />
                    <IconCalendar size={16} className="text-primary" />
                    <h2 className="text-sm font-semibold">Calendario de Vencimientos</h2>
                </div>
            )}

            {/* ── Layout principal ────────────────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_300px]">

                {/* ── COLUMNA IZQUIERDA: Calendario ──────────────────────── */}
                <div className="flex flex-col gap-3 xl:sticky xl:top-4 xl:self-start">

                    {/* Navegación mes */}
                    <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-2.5">
                        <button
                            type="button"
                            onClick={() => setMes(m => m.subtract(1, 'month'))}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                            <IconChevronLeft size={15} />
                        </button>

                        <div className="text-center">
                            <p className="text-sm font-bold capitalize tracking-tight">{mes.format('MMMM YYYY')}</p>
                            <p className="text-[11px] text-muted-foreground">
                                {equiposMes.length > 0
                                    ? `${equiposMes.length} equipo${equiposMes.length !== 1 ? 's' : ''} vence${equiposMes.length === 1 ? '' : 'n'} este mes`
                                    : 'Sin vencimientos este mes'}
                            </p>
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setMes(dayjs().startOf('month'))}
                                className="rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
                            >
                                Hoy
                            </button>
                            <button
                                type="button"
                                onClick={() => setMes(m => m.add(1, 'month'))}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                                <IconChevronRight size={15} />
                            </button>
                        </div>
                    </div>

                    {/* Grilla */}
                    <div className="overflow-hidden rounded-xl border bg-card">
                        {/* Cabecera días */}
                        <div className="grid grid-cols-7 border-b">
                            {DIAS_SEMANA.map((d, i) => (
                                <div
                                    key={d}
                                    className={cn(
                                        'py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider',
                                        i >= 5 ? 'text-muted-foreground/50' : 'text-muted-foreground'
                                    )}
                                >
                                    {d}
                                </div>
                            ))}
                        </div>

                        {/* Celdas */}
                        <div className="grid grid-cols-7">
                            {diasGrilla.map((dia, i) => {
                                if (!dia) return (
                                    <div
                                        key={`empty-${i}`}
                                        className="min-h-[88px] border-b border-r bg-muted/5 last:border-r-0"
                                    />
                                );
                                const key = dia.format('YYYY-MM-DD');
                                const eqDia = equiposPorDia.get(key) ?? [];
                                const esHoy = key === hoyStr;
                                const esFinde = dia.day() === 0 || dia.day() === 6;
                                const diaSeleccionado = seleccionado ? parseVigenciaStr(getVigencia(seleccionado))?.format('YYYY-MM-DD') === key : false;
                                const MAX_VISIBLE = 2;
                                const hayMas = eqDia.length > MAX_VISIBLE;

                                return (
                                    <div
                                        key={key}
                                        className={cn(
                                            'group min-h-[88px] border-b border-r p-1.5 last:border-r-0 transition-colors',
                                            esFinde && !eqDia.length && 'bg-muted/5',
                                            eqDia.length > 0 && !esHoy && !diaSeleccionado && 'hover:bg-muted/20',
                                            esHoy && !diaSeleccionado && 'bg-primary/5',
                                            diaSeleccionado && 'bg-primary/10 ring-2 ring-inset ring-primary/40'
                                        )}
                                    >
                                        {/* Número del día */}
                                        <div className="mb-1.5 flex items-center justify-between">
                                            <span className={cn(
                                                'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium',
                                                esHoy
                                                    ? 'bg-primary text-primary-foreground font-bold'
                                                    : esFinde
                                                    ? 'text-muted-foreground/50'
                                                    : 'text-muted-foreground'
                                            )}>
                                                {dia.date()}
                                            </span>
                                            {eqDia.length > 0 && (
                                                <span className="text-[9px] font-bold text-muted-foreground">
                                                    {eqDia.length}
                                                </span>
                                            )}
                                        </div>

                                        {/* Badges equipos */}
                                        <div className="flex flex-col gap-0.5">
                                            {eqDia.slice(0, MAX_VISIBLE).map(eq => (
                                                <EquipoBadge
                                                    key={eq.id_equipo}
                                                    eq={eq}
                                                    selected={seleccionado?.id_equipo === eq.id_equipo}
                                                    onClick={onEditEquipo ?? setSeleccionado}
                                                />
                                            ))}
                                            {hayMas && (
                                                <button
                                                    type="button"
                                                    className="rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                                                    onClick={e => { e.stopPropagation(); setDiaPopup({ label: dia.format('D [de] MMMM'), equipos: eqDia }); }}
                                                >
                                                    +{eqDia.length - MAX_VISIBLE} más
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Leyenda */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-0.5">
                        {Object.entries(ESTADO).filter(([k]) => k !== 'sin_fecha').map(([k, v]) => (
                            <button
                                key={k}
                                type="button"
                                onClick={() => setFiltroEstado(filtroEstado === k ? 'todos' : k as EstadoVig)}
                                className={cn(
                                    'flex items-center gap-1.5 text-[11px] transition-opacity',
                                    filtroEstado !== 'todos' && filtroEstado !== k ? 'opacity-40' : 'opacity-100'
                                )}
                            >
                                <span className={cn('h-2 w-2 rounded-full', v.dotCls)} />
                                <span className="text-muted-foreground">{v.label}</span>
                            </button>
                        ))}
                        <span className="ml-auto text-[11px] text-muted-foreground">
                            {onEditEquipo ? 'Click en calendario para abrir ficha' : 'Click en un equipo para ver detalle'}
                        </span>
                    </div>
                </div>

                {/* ── COLUMNA DERECHA: Panel + Lista ─────────────────────── */}
                <div className="flex flex-col gap-3">

                    {/* Detalle del equipo seleccionado */}
                    {seleccionado && (
                        <DetallePanel eq={seleccionado} onClose={() => setSeleccionado(null)} onEdit={onEditEquipo} />
                    )}

                    {/* Buscador */}
                    <div className="relative">
                        <IconSearch size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Buscar equipo, código…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="h-8 pl-8 text-xs"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <IconX size={12} />
                            </button>
                        )}
                    </div>

                    {/* Filtros estado */}
                    <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
                        {(['todos', 'vencido', 'por_vencer', 'vigente'] as const).map(f => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setFiltroEstado(f)}
                                className={cn(
                                    'flex-1 rounded-md py-1 text-[10px] font-medium transition-colors',
                                    filtroEstado === f
                                        ? 'bg-background text-foreground shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                )}
                            >
                                {f === 'todos' ? 'Todos' : f === 'vencido' ? 'Vencidos' : f === 'por_vencer' ? '30d' : 'Vigentes'}
                            </button>
                        ))}
                    </div>

                    {/* Lista */}
                    <div className="overflow-hidden rounded-xl border bg-card">
                        <div className="max-h-[420px] divide-y overflow-y-auto">
                            {equiposFiltrados.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <IconCalendar size={28} className="mb-2 text-muted-foreground/30" />
                                    <p className="text-xs text-muted-foreground">Sin equipos</p>
                                </div>
                            ) : equiposFiltrados.map(eq => {
                                const vig = getVigencia(eq);
                                const estado = getEstado(vig);
                                const s = ESTADO[estado];
                                const esMes = vig && (parseVigenciaStr(vig)?.isSame(mes, 'month') ?? false);
                                const active = seleccionado?.id_equipo === eq.id_equipo;
                                return (
                                    <button
                                        key={eq.id_equipo}
                                        type="button"
                                        onClick={() => {
                                            setSeleccionado(active ? null : eq);
                                            if (vig && !active) {
                                                const d = parseVigenciaStr(vig);
                                                if (d) setMes(d.startOf('month'));
                                            }
                                        }}
                                        className={cn(
                                            'group w-full px-3 py-2 text-left transition-colors hover:bg-muted/40',
                                            active && 'bg-muted/60'
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={cn('h-2 w-1 shrink-0 rounded-full', s.dotCls)} />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-[11px] font-semibold leading-tight">{eq.nombre}</p>
                                                <p className="text-[10px] text-muted-foreground">{eq.codigo}{eq.nombre_asignado ? ` · ${eq.nombre_asignado}` : ''}</p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                {vig && (
                                                    <p className={cn(
                                                        'text-[10px] font-bold tabular-nums',
                                                        esMes ? 'text-primary' : 'text-muted-foreground'
                                                    )}>
                                                        {parseVigenciaStr(vig)?.format('DD/MM/YY') ?? vig}
                                                    </p>
                                                )}
                                                <span className={cn('rounded-full px-1.5 py-px text-[9px] font-medium', s.badgeCls)}>
                                                    {s.label}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex items-center justify-between border-t bg-muted/20 px-3 py-2">
                            <span className="text-[11px] text-muted-foreground">
                                {equiposFiltrados.length} equipo{equiposFiltrados.length !== 1 ? 's' : ''}
                            </span>
                            {filtroEstado !== 'todos' && (
                                <button
                                    type="button"
                                    onClick={() => setFiltroEstado('todos')}
                                    className="text-[11px] text-primary hover:underline"
                                >
                                    Ver todos
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Modal popup día ─────────────────────────────────────────── */}
            {diaPopup && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
                    onClick={() => setDiaPopup(null)}
                >
                    <div
                        className="shadcn-scope w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b px-4 py-3">
                            <div className="flex items-center gap-2">
                                <IconCalendar size={15} className="text-primary" />
                                <span className="text-sm font-semibold capitalize">{diaPopup.label}</span>
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    {diaPopup.equipos.length} equipos
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDiaPopup(null)}
                                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                                <IconX size={13} />
                            </button>
                        </div>

                        {/* Lista */}
                        <div className="max-h-80 divide-y overflow-y-auto">
                            {diaPopup.equipos.map(eq => {
                                const vig = getVigencia(eq);
                                const estado = getEstado(vig);
                                const s = ESTADO[estado];
                                return (
                                    <button
                                        key={eq.id_equipo}
                                        type="button"
                                        onClick={() => {
                                            setDiaPopup(null);
                                            if (onEditEquipo) {
                                                onEditEquipo(eq);
                                            } else {
                                                setSeleccionado(eq);
                                            }
                                        }}
                                        className="group w-full px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span className={cn('h-2 w-2 shrink-0 rounded-full', s.dotCls)} />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-xs font-semibold">{eq.nombre}</p>
                                                <p className="text-[10px] text-muted-foreground">{eq.codigo}{eq.nombre_asignado ? ` · ${eq.nombre_asignado}` : ''}</p>
                                            </div>
                                            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium', s.badgeCls)}>
                                                {s.label}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
