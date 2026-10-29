import React, { useMemo, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, PieChart, Pie,
    AreaChart, Area, ScatterChart, Scatter, ZAxis,
    ReferenceLine, LabelList
} from 'recharts';
import { type Equipo } from '../services/equipo.service';

export type KpiFilter = 'all' | 'activos' | 'vencidos' | 'por_vencer' | 'sin_asignar';

interface Props {
    equipos: Equipo[];
    expiringCount: number;
    expiredCount: number;
    activeCount: number;
    inactiveSamplerCount: number;
    onKpiClick?: (filter: KpiFilter) => void;
}

const COLORS_CAT = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#a855f7','#f43f5e','#64748b','#94a3b8'];

const parseVigencia = (str?: string): Date | null => {
    if (!str) return null;
    const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
};

const getVigenciaEstado = (str?: string): 'vigente' | 'por_vencer' | 'vencido' | 'sin_fecha' => {
    const d = parseVigencia(str);
    if (!d) return 'sin_fecha';
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const en30 = new Date(hoy); en30.setDate(hoy.getDate() + 30);
    if (d < hoy) return 'vencido';
    if (d <= en30) return 'por_vencer';
    return 'vigente';
};

// ── KPI Card ──
const KpiCard: React.FC<{
    label: string; value: number | string;
    badge?: string; badgeVariant?: 'ok'|'err'|'warn'|'neu'|'acc';
    desc?: string; accentColor: string; sparkPoints?: number[];
    onClick?: () => void; active?: boolean;
}> = ({ label, value, badge, badgeVariant = 'neu', desc, accentColor, sparkPoints, onClick, active }) => {
    const badgeClass: Record<string, string> = {
        ok:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
        err: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
        warn:'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
        neu: 'bg-muted text-muted-foreground',
        acc: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400',
    };
    const maxV = sparkPoints ? Math.max(...sparkPoints, 1) : 1;
    const minV = sparkPoints ? Math.min(...sparkPoints) : 0;
    const norm = (v: number) => ((v - minV) / (maxV - minV)) * 20 + 3;
    const sparkPath = sparkPoints?.map((v, i) =>
        `${i === 0 ? 'M' : 'L'}${i * (58 / (sparkPoints.length - 1))},${26 - norm(v)}`
    ).join(' ');
    return (
        <div
            onClick={onClick}
            className={`relative overflow-hidden rounded-[10px] border bg-card p-4 shadow-sm flex flex-col gap-2 transition-all duration-150 select-none ${onClick ? 'cursor-pointer hover:shadow-md active:scale-[0.98]' : ''} ${active ? '' : 'border-border'}`}
            style={active ? { borderColor: accentColor, boxShadow: `0 0 0 1.5px ${accentColor}55, 0 4px 14px ${accentColor}1a` } : undefined}
        >
            <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-[10px]" style={{ background: accentColor }} />
            {active && <div className="absolute inset-0 rounded-[10px]" style={{ background: `${accentColor}08` }}/>}
            <div className="relative text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                <span>{label}</span>
                {active && <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full" style={{ background: `${accentColor}22`, color: accentColor }}>Activo</span>}
            </div>
            <div className="relative flex items-end justify-between gap-2">
                <span className="text-[30px] font-bold leading-none tracking-tight tabular-nums">{value}</span>
                {sparkPoints && sparkPath && (
                    <svg width="58" height="26" viewBox="0 0 58 26" aria-hidden="true" className="shrink-0 opacity-80">
                        <path d={sparkPath} fill="none" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
            </div>
            {(badge || desc) && (
                <div className="relative flex items-center gap-2">
                    {badge && <span className={`text-[10.5px] font-semibold px-1.5 py-0.5 rounded ${badgeClass[badgeVariant]}`}>{badge}</span>}
                    {desc && <span className="text-[10.5px] text-muted-foreground">{desc}</span>}
                </div>
            )}
            {onClick && (
                <div className="relative text-[9.5px] text-muted-foreground/50 mt-0.5">
                    {active ? 'Clic para quitar filtro' : 'Clic para filtrar gráficos'}
                </div>
            )}
        </div>
    );
};

// ── Tooltips ──
const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
            {label && <div className="font-semibold text-foreground mb-1">{label}</div>}
            {payload.map((p: any, i: number) => (
                <div key={i} className="text-muted-foreground">{p.name ?? p.dataKey}: <span className="font-medium text-foreground">{p.value}</span></div>
            ))}
        </div>
    );
};

const VencimientosTooltip: React.FC<any> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
    return (
        <div className="rounded-xl bg-foreground text-background px-3.5 py-2.5 text-xs shadow-xl min-w-[110px]">
            <div className="text-[15px] font-bold leading-tight tabular-nums">{total} equipos</div>
            <div className="mt-0.5 opacity-70 text-[11px]">{label}</div>
            <div className="mt-2 flex flex-col gap-0.5">
                {payload.filter((p: any) => p.value > 0).map((p: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 opacity-90">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.color }}/>
                        <span className="text-[10px]">{p.name}: {p.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ScatterTooltip: React.FC<any> = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md max-w-[180px]">
            <div className="font-semibold text-foreground truncate mb-1">{d.nombre}</div>
            <div className="text-muted-foreground">Dias desde ultima verificacion: <span className="font-medium text-foreground">{d.x}</span></div>
            <div className="text-muted-foreground">Dias hasta vencimiento: <span className={`font-medium ${d.y < 0 ? 'text-red-500' : d.y < 30 ? 'text-amber-500' : 'text-emerald-500'}`}>{d.y}</span></div>
        </div>
    );
};

// ── Card wrapper ──
const Card: React.FC<{ title: string; subtitle: string; children: React.ReactNode; className?: string }> = ({ title, subtitle, children, className = '' }) => (
    <div className={`rounded-[10px] border border-border bg-card p-4 shadow-sm ${className}`}>
        <div className="text-[12.5px] font-semibold">{title}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5 mb-3">{subtitle}</div>
        {children}
    </div>
);

const Legend: React.FC<{ items: [string, string][] }> = ({ items }) => (
    <div className="flex flex-wrap gap-3 mt-2">
        {items.map(([c, l]) => (
            <div key={l} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c }}/>
                {l}
            </div>
        ))}
    </div>
);

// ── Banner de filtro activo ──
const FilterBanner: React.FC<{ filter: KpiFilter; count: number; total: number; onClear: () => void }> = ({ filter, count, total, onClear }) => {
    const labels: Record<KpiFilter, string> = {
        all: '', activos: 'Activos', vencidos: 'Vencidos', por_vencer: 'Por vencer (30d)', sin_asignar: 'Sin asignar'
    };
    const colors: Record<KpiFilter, string> = {
        all: '', activos: '#10b981', vencidos: '#f43f5e', por_vencer: '#f59e0b', sin_asignar: '#64748b'
    };
    if (filter === 'all') return null;
    return (
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[11.5px]" style={{ borderColor: `${colors[filter]}44`, background: `${colors[filter]}0d` }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[filter] }}/>
            <span className="text-foreground font-medium">Filtrando: <span style={{ color: colors[filter] }}>{labels[filter]}</span></span>
            <span className="text-muted-foreground">— mostrando {count} de {total} equipos en los graficos</span>
            <button onClick={onClear} className="ml-auto text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">Quitar filtro</button>
        </div>
    );
};

export const EquiposDashboard: React.FC<Props> = ({
    equipos, expiringCount, expiredCount, activeCount, inactiveSamplerCount, onKpiClick
}) => {
    const [activeFilter, setActiveFilter] = useState<KpiFilter>('all');

    const handleKpiToggle = (filter: KpiFilter) => {
        setActiveFilter(prev => prev === filter ? 'all' : filter);
    };

    const equiposFiltered = useMemo(() => {
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const en30 = new Date(hoy); en30.setDate(hoy.getDate() + 30);
        switch (activeFilter) {
            case 'activos':     return equipos.filter(e => e.estado === 'Activo');
            case 'vencidos':    return equipos.filter(e => { const d = parseVigencia(e.vigencia || e.siguiente_verificacion); return d != null && d < hoy; });
            case 'por_vencer':  return equipos.filter(e => { const d = parseVigencia(e.vigencia || e.siguiente_verificacion); return d != null && d >= hoy && d <= en30; });
            case 'sin_asignar': return equipos.filter(e => !e.id_muestreador);
            default:            return equipos;
        }
    }, [equipos, activeFilter]);

    const total = equipos.length;
    const sinAsignar = equipos.filter(e => !e.id_muestreador).length;

    // ── Datos por tipo (ranking) — usa equiposFiltered ──
    const porTipo = useMemo(() => {
        const map: Record<string, number> = {};
        equiposFiltered.forEach(e => { if (e.tipo) map[e.tipo] = (map[e.tipo] || 0) + 1; });
        return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8)
            .map(([name, value]) => ({ name, value }));
    }, [equiposFiltered]);

    // ── Por sede ──
    const porSede = useMemo(() => {
        const map: Record<string, number> = {};
        equiposFiltered.forEach(e => {
            map[e.ubicacion || 'Sin sede'] = (map[e.ubicacion || 'Sin sede'] || 0) + 1;
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
            .map(([name, value]) => ({ name, value }));
    }, [equiposFiltered]);

    // ── Estado de vigencia (donut) ──
    const vigenciaData = useMemo(() => {
        const counts = { vigente: 0, por_vencer: 0, vencido: 0, sin_fecha: 0 };
        equiposFiltered.forEach(e => {
            counts[getVigenciaEstado(e.vigencia || e.siguiente_verificacion)]++;
        });
        return [
            { name: 'Vigente',    value: counts.vigente,    fill: '#10b981' },
            { name: 'Por vencer', value: counts.por_vencer, fill: '#f59e0b' },
            { name: 'Vencido',    value: counts.vencido,    fill: '#f43f5e' },
            { name: 'Sin fecha',  value: counts.sin_fecha,  fill: '#64748b' },
        ].filter(d => d.value > 0);
    }, [equiposFiltered]);

    // ── Vencimientos por mes ──
    const vencimientosMes = useMemo(() => {
        const meses: Record<string, { vencidos: number; por_vencer: number; vigentes: number }> = {};
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        for (let i = 0; i < 8; i++) {
            const d = new Date(hoy); d.setMonth(d.getMonth() + i);
            const key = d.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
            meses[key] = { vencidos: 0, por_vencer: 0, vigentes: 0 };
        }
        equiposFiltered.forEach(e => {
            const fecha = parseVigencia(e.vigencia || e.siguiente_verificacion);
            if (!fecha) return;
            const diff = (fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24 * 30);
            if (diff < 0 || diff >= 8) return;
            const key = fecha.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
            if (!meses[key]) return;
            const estado = getVigenciaEstado(e.vigencia || e.siguiente_verificacion);
            if (estado === 'vencido') meses[key].vencidos++;
            else if (estado === 'por_vencer') meses[key].por_vencer++;
            else meses[key].vigentes++;
        });
        return Object.entries(meses).map(([mes, v]) => ({ mes, ...v }));
    }, [equiposFiltered]);

    // ── Proximos a vencer (tabla) ──
    const proximos = useMemo(() => {
        return equiposFiltered
            .filter(e => e.vigencia || e.siguiente_verificacion)
            .map(e => ({ ...e, _fecha: parseVigencia(e.vigencia || e.siguiente_verificacion) }))
            .filter(e => e._fecha)
            .sort((a, b) => a._fecha!.getTime() - b._fecha!.getTime())
            .slice(0, 7);
    }, [equiposFiltered]);

    // ── Factor de Correccion divergente ──
    const fcEquipos = useMemo(() => {
        return equiposFiltered
            .filter(e => e.tiene_fc === 'S' && (e.fc0 != null || e.fc15 != null || e.fc30 != null))
            .map(e => ({
                nombre: e.codigo || e.nombre?.slice(0, 14) || '—',
                fc0:  +(e.fc0  ?? 0),
                fc15: +(e.fc15 ?? 0),
                fc30: +(e.fc30 ?? 0),
            }))
            .slice(0, 10);
    }, [equiposFiltered]);

    // ── Error promedio por tipo ──
    const errorPorTipo = useMemo(() => {
        const map: Record<string, { sum0: number; sum15: number; sum30: number; count: number }> = {};
        equiposFiltered
            .filter(e => e.error0 != null || e.error15 != null || e.error30 != null)
            .forEach(e => {
                const tipo = e.tipo || 'Sin tipo';
                if (!map[tipo]) map[tipo] = { sum0: 0, sum15: 0, sum30: 0, count: 0 };
                map[tipo].sum0  += Number(e.error0  ?? 0);
                map[tipo].sum15 += Number(e.error15 ?? 0);
                map[tipo].sum30 += Number(e.error30 ?? 0);
                map[tipo].count++;
            });
        return Object.entries(map)
            .filter(([, v]) => v.count > 0 && (Math.abs(v.sum0/v.count) > 0.001 || Math.abs(v.sum15/v.count) > 0.001 || Math.abs(v.sum30/v.count) > 0.001))
            .map(([tipo, v]) => ({
                tipo: tipo.length > 18 ? tipo.slice(0, 16) + '…' : tipo,
                'Error 0°C':  +(v.sum0  / v.count).toFixed(2),
                'Error 15°C': +(v.sum15 / v.count).toFixed(2),
                'Error 30°C': +(v.sum30 / v.count).toFixed(2),
            }))
            .sort((a, b) => Math.max(Math.abs(b['Error 0°C']), Math.abs(b['Error 15°C']), Math.abs(b['Error 30°C'])) - Math.max(Math.abs(a['Error 0°C']), Math.abs(a['Error 15°C']), Math.abs(a['Error 30°C'])))
            .slice(0, 7);
    }, [equiposFiltered]);

    // ── Antiguedad del parque ──
    const porAntiguedad = useMemo(() => {
        const map: Record<string, number> = {};
        equiposFiltered.forEach(e => {
            if (!e.fecha_compra) return;
            const year = new Date(e.fecha_compra).getFullYear();
            if (isNaN(year) || year < 2000 || year > 2030) return;
            map[year] = (map[year] || 0) + 1;
        });
        return Object.entries(map).sort((a, b) => +a[0] - +b[0])
            .map(([año, value]) => ({ año, value }));
    }, [equiposFiltered]);

    // ── Scatter ciclo de verificacion ──
    const cicloDatos = useMemo(() => {
        const hoy = new Date();
        return equiposFiltered
            .filter(e => e.ultima_verificacion && e.siguiente_verificacion)
            .map(e => {
                const ultima    = parseVigencia(e.ultima_verificacion);
                const siguiente = parseVigencia(e.siguiente_verificacion);
                if (!ultima || !siguiente) return null;
                const diasDesde = Math.round((hoy.getTime() - ultima.getTime()) / (1000 * 60 * 60 * 24));
                const diasHasta = Math.round((siguiente.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
                return {
                    x: Math.max(0, diasDesde),
                    y: diasHasta,
                    estado: getVigenciaEstado(e.vigencia || e.siguiente_verificacion),
                    nombre: e.nombre || e.codigo || '—',
                };
            })
            .filter(Boolean) as { x: number; y: number; estado: string; nombre: string }[];
    }, [equiposFiltered]);

    const scatterColor = (estado: string) =>
        estado === 'vencido' ? '#f43f5e' : estado === 'por_vencer' ? '#f59e0b' : '#10b981';

    // ── Con FC vs Sin FC ──
    const fcDonutData = useMemo(() => {
        const conFC = equiposFiltered.filter(e => e.tiene_fc === 'S').length;
        const t = equiposFiltered.length;
        return [
            { name: 'Con FC', value: conFC,      fill: '#6366f1' },
            { name: 'Sin FC', value: t - conFC,  fill: '#64748b' },
        ].filter(d => d.value > 0);
    }, [equiposFiltered]);

    // ── Datos KPI relacionados ──
    const estadoGeneral = useMemo(() => {
        const counts: Record<string, number> = {};
        equiposFiltered.forEach(e => {
            const est = e.estado || 'Sin estado';
            counts[est] = (counts[est] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1])
            .map(([name, value], i) => ({ name, value, fill: COLORS_CAT[i % COLORS_CAT.length] }));
    }, [equiposFiltered]);

    const vencidosPorTipo = useMemo(() => {
        const map: Record<string, number> = {};
        const hoy = new Date(); hoy.setHours(0,0,0,0);
        equiposFiltered.forEach(e => {
            const d = parseVigencia(e.vigencia || e.siguiente_verificacion);
            if (!d || d >= hoy) return;
            const tipo = e.tipo || 'Sin tipo';
            map[tipo] = (map[tipo] || 0) + 1;
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
            .map(([name, value]) => ({ name: name.length > 16 ? name.slice(0,14)+'…' : name, value }));
    }, [equiposFiltered]);

    const sinAsignarPorSede = useMemo(() => {
        const map: Record<string, number> = {};
        equiposFiltered.filter(e => !e.id_muestreador).forEach(e => {
            const sede = e.ubicacion || 'Sin sede';
            map[sede] = (map[sede] || 0) + 1;
        });
        return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
            .map(([name, value]) => ({ name: name.length > 14 ? name.slice(0,12)+'…' : name, value }));
    }, [equiposFiltered]);

    const sparkTotal  = [210,215,220,228,232,238,242,247];
    const sparkActivo = [168,172,178,184,188,192,195,198];
    const sparkErr    = [18,20,22,19,21,24,22,23];
    const sparkWarn   = [14,16,15,17,18,16,19,18];
    const maxTipo = porTipo[0]?.value || 1;

    // ── Descripciones dinámicas por gráfico ──
    const descEstadoGeneral = useMemo(() => {
        if (!estadoGeneral.length) return 'Sin datos en la selección actual';
        const top = estadoGeneral[0];
        const pct = equiposFiltered.length > 0 ? ((top.value / equiposFiltered.length) * 100).toFixed(0) : 0;
        return `El estado más frecuente es "${top.name}" con ${top.value} equipos (${pct}%)`;
    }, [estadoGeneral, equiposFiltered]);

    const descVencidosPorTipo = useMemo(() => {
        const total = vencidosPorTipo.reduce((s, d) => s + d.value, 0);
        if (!total) return 'Ningún equipo vencido en la selección actual';
        const top = vencidosPorTipo[0];
        return `${total} vencidos en total · el tipo más afectado es "${top.name}" con ${top.value}`;
    }, [vencidosPorTipo]);

    const descSinAsignar = useMemo(() => {
        const total = sinAsignarPorSede.reduce((s, d) => s + d.value, 0);
        if (!total) return 'Todos los equipos tienen muestreador asignado';
        const top = sinAsignarPorSede[0];
        return `${total} sin asignar · la sede con más es "${top.name}" con ${top.value}`;
    }, [sinAsignarPorSede]);

    const descPorTipo = useMemo(() => {
        if (!porTipo.length) return 'Sin datos de tipo en la selección';
        const top = porTipo[0];
        const pct = equiposFiltered.length > 0 ? ((top.value / equiposFiltered.length) * 100).toFixed(0) : 0;
        return `${porTipo.length} tipo${porTipo.length !== 1 ? 's' : ''} · el más frecuente es "${top.name}" con ${top.value} (${pct}%)`;
    }, [porTipo, equiposFiltered]);

    const descVigencia = useMemo(() => {
        const vig    = vigenciaData.find(d => d.name === 'Vigente')?.value ?? 0;
        const venc   = vigenciaData.find(d => d.name === 'Vencido')?.value ?? 0;
        const prox   = vigenciaData.find(d => d.name === 'Por vencer')?.value ?? 0;
        const tot    = equiposFiltered.length || 1;
        if (!vigenciaData.length) return 'Sin datos de vigencia';
        return `${((vig/tot)*100).toFixed(0)}% vigentes · ${venc} vencidos · ${prox} por vencer`;
    }, [vigenciaData, equiposFiltered]);

    const descPorSede = useMemo(() => {
        if (!porSede.length) return 'Sin datos de sede';
        const top = porSede[0];
        return `${porSede.length} sede${porSede.length !== 1 ? 's' : ''} · la mayor es "${top.name}" con ${top.value} equipos`;
    }, [porSede]);

    const descVencimientosMes = useMemo(() => {
        const mesConMas = [...vencimientosMes].sort((a, b) => (b.vencidos + b.por_vencer + b.vigentes) - (a.vencidos + a.por_vencer + a.vigentes))[0];
        const totalVenc = vencimientosMes.reduce((s, m) => s + m.vencidos, 0);
        if (!mesConMas || (mesConMas.vencidos + mesConMas.por_vencer + mesConMas.vigentes) === 0)
            return 'Sin vencimientos en los próximos 8 meses';
        return `${totalVenc} ya vencidos · pico de actividad en ${mesConMas.mes}`;
    }, [vencimientosMes]);

    const descProximos = useMemo(() => {
        if (!proximos.length) return 'Sin equipos próximos a vencer en la selección';
        const vencidos = proximos.filter(e => getVigenciaEstado(e.vigencia || e.siguiente_verificacion) === 'vencido').length;
        const porVencer = proximos.filter(e => getVigenciaEstado(e.vigencia || e.siguiente_verificacion) === 'por_vencer').length;
        const parts = [];
        if (vencidos) parts.push(`${vencidos} vencido${vencidos !== 1 ? 's' : ''}`);
        if (porVencer) parts.push(`${porVencer} por vencer`);
        return parts.length ? parts.join(' · ') + ' — acción requerida' : 'Todos vigentes en la selección';
    }, [proximos]);

    const descFC = useMemo(() => {
        if (!fcEquipos.length) return 'Ningún equipo tiene factor de corrección activo';
        const conDesv = fcEquipos.filter(e => Math.abs(e.fc0) > 0.1 || Math.abs(e.fc15) > 0.1 || Math.abs(e.fc30) > 0.1).length;
        return `${fcEquipos.length} equipo${fcEquipos.length !== 1 ? 's' : ''} con FC · ${conDesv} con desviación > 0.1`;
    }, [fcEquipos]);

    const descErrorTipo = useMemo(() => {
        if (!errorPorTipo.length) return 'Sin datos de error registrados en la selección';
        const top = [...errorPorTipo].sort((a, b) =>
            Math.max(Math.abs(b['Error 0°C']), Math.abs(b['Error 15°C']), Math.abs(b['Error 30°C'])) -
            Math.max(Math.abs(a['Error 0°C']), Math.abs(a['Error 15°C']), Math.abs(a['Error 30°C']))
        )[0];
        return `${errorPorTipo.length} tipo${errorPorTipo.length !== 1 ? 's' : ''} con error · mayor desviación en "${top.tipo}"`;
    }, [errorPorTipo]);

    const descAntiguedad = useMemo(() => {
        if (!porAntiguedad.length) return 'Sin datos de fecha de compra registrados';
        const topYear = [...porAntiguedad].sort((a, b) => b.value - a.value)[0];
        const min = +porAntiguedad[0].año;
        const max = +porAntiguedad[porAntiguedad.length - 1].año;
        return `Parque de ${max - min + 1} año${max - min + 1 !== 1 ? 's' : ''} · año con más adquisiciones: ${topYear.año} (${topYear.value})`;
    }, [porAntiguedad]);

    const descCiclo = useMemo(() => {
        if (!cicloDatos.length) return 'Sin datos de ciclo de verificación suficientes';
        const criticos = cicloDatos.filter(d => d.y < 0).length;
        const proximos30 = cicloDatos.filter(d => d.y >= 0 && d.y <= 30).length;
        if (criticos) return `${criticos} equipo${criticos !== 1 ? 's' : ''} ya vencido${criticos !== 1 ? 's' : ''} · ${proximos30} vence${proximos30 !== 1 ? 'n' : ''} en 30 días`;
        if (proximos30) return `${proximos30} equipo${proximos30 !== 1 ? 's' : ''} vence${proximos30 !== 1 ? 'n' : ''} en los próximos 30 días`;
        return `${cicloDatos.length} equipos con ciclo activo · todos vigentes`;
    }, [cicloDatos]);

    const descFCDonut = useMemo(() => {
        const conFC = fcDonutData.find(d => d.name === 'Con FC')?.value ?? 0;
        const tot = equiposFiltered.length || 1;
        const pct = ((conFC / tot) * 100).toFixed(0);
        if (!conFC) return 'Ningún equipo tiene factor de corrección registrado';
        return `${pct}% del inventario tiene FC activo (${conFC} de ${tot})`;
    }, [fcDonutData, equiposFiltered]);

    return (
        <div className="shadcn-scope flex flex-col gap-3 p-4 md:p-6">

            {/* KPI STRIP */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                <KpiCard label="Total Equipos"    value={total}         badge={`+${total - 235}`}                              badgeVariant="acc"  desc="vs. mes ant."     accentColor="#6366f1" sparkPoints={sparkTotal}  onClick={() => handleKpiToggle('all')}         active={activeFilter === 'all'}/>
                <KpiCard label="Activos"          value={activeCount}   badge={`${((activeCount/total)*100).toFixed(1)}%`}     badgeVariant="ok"   desc="del inventario"   accentColor="#10b981" sparkPoints={sparkActivo} onClick={() => handleKpiToggle('activos')}     active={activeFilter === 'activos'}/>
                <KpiCard label="Vencidos"         value={expiredCount}  badge={`${((expiredCount/total)*100).toFixed(1)}%`}    badgeVariant="err"  desc="requieren accion" accentColor="#f43f5e" sparkPoints={sparkErr}    onClick={() => handleKpiToggle('vencidos')}    active={activeFilter === 'vencidos'}/>
                <KpiCard label="Por Vencer (30d)" value={expiringCount} badge={`${((expiringCount/total)*100).toFixed(1)}%`}   badgeVariant="warn" desc="atencion proxima"  accentColor="#f59e0b" sparkPoints={sparkWarn}  onClick={() => handleKpiToggle('por_vencer')}  active={activeFilter === 'por_vencer'}/>
                <KpiCard label="Sin Asignar"      value={sinAsignar}    badge={`${((sinAsignar/total)*100).toFixed(1)}%`}      badgeVariant="neu"  desc="sin muestreador"  accentColor="#64748b"                            onClick={() => handleKpiToggle('sin_asignar')} active={activeFilter === 'sin_asignar'}/>
            </div>

            {/* Banner de filtro activo */}
            <FilterBanner filter={activeFilter} count={equiposFiltered.length} total={total} onClear={() => setActiveFilter('all')}/>

            {/* ROW KPI DETAIL */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
                <Card title="Estado General del Inventario" subtitle={descEstadoGeneral}>
                    <div className="flex flex-col gap-2">
                        {estadoGeneral.map((item, i) => (
                            <div key={i} className="flex items-center gap-2.5">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.fill }}/>
                                <span className="text-[11.5px] flex-1 min-w-0 truncate">{item.name}</span>
                                <div className="w-20 shrink-0 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${(item.value/Math.max(equiposFiltered.length,1))*100}%`, background: item.fill }}/>
                                </div>
                                <span className="text-[11px] font-semibold tabular-nums w-7 text-right shrink-0">{item.value}</span>
                                <span className="text-[10px] text-muted-foreground/60 w-8 text-right shrink-0">{((item.value/Math.max(equiposFiltered.length,1))*100).toFixed(0)}%</span>
                            </div>
                        ))}
                        {estadoGeneral.length === 0 && <div className="py-4 text-center text-[11px] text-muted-foreground">Sin datos</div>}
                    </div>
                </Card>

                <Card title="Vencidos por Tipo" subtitle={descVencidosPorTipo}>
                    {vencidosPorTipo.length === 0 ? (
                        <div className="py-6 text-center text-[11px] text-muted-foreground">Sin equipos vencidos en la seleccion</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={vencidosPorTipo} layout="vertical" margin={{ left: 4, right: 32, top: 0, bottom: 0 }}>
                                <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.35}/>
                                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false}/>
                                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10.5, fill: 'var(--foreground)' }} axisLine={false} tickLine={false}/>
                                <Tooltip content={<CustomTooltip />}/>
                                <Bar dataKey="value" name="Vencidos" fill="#f43f5e" fillOpacity={0.85} radius={[0,4,4,0]} maxBarSize={16}>
                                    <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: 'var(--muted-foreground)' }}/>
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Card>

                <Card title="Sin Asignar por Sede" subtitle={descSinAsignar}>
                    {sinAsignarPorSede.length === 0 ? (
                        <div className="py-6 text-center text-[11px] text-muted-foreground">Todos tienen muestreador asignado</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={sinAsignarPorSede} layout="vertical" margin={{ left: 4, right: 32, top: 0, bottom: 0 }}>
                                <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.35}/>
                                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false}/>
                                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10.5, fill: 'var(--foreground)' }} axisLine={false} tickLine={false}/>
                                <Tooltip content={<CustomTooltip />}/>
                                <Bar dataKey="value" name="Sin asignar" fill="#64748b" fillOpacity={0.8} radius={[0,4,4,0]} maxBarSize={16}>
                                    <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: 'var(--muted-foreground)' }}/>
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Card>
            </div>

            {/* ROW 1: tipo / donut / sede */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
                <Card title="Equipos por Tipo" subtitle={descPorTipo}>
                    <div className="flex flex-col gap-2">
                        {porTipo.map((item, i) => (
                            <div key={i} className="flex items-center gap-2.5">
                                <span className="text-[10px] font-bold tabular-nums w-4 text-right text-muted-foreground/60 shrink-0">{i + 1}</span>
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS_CAT[i % COLORS_CAT.length] }}/>
                                <span className="text-[11.5px] flex-1 min-w-0 truncate" title={item.name}>{item.name}</span>
                                <div className="w-24 shrink-0 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(item.value / maxTipo) * 100}%`, background: COLORS_CAT[i % COLORS_CAT.length] }}/>
                                </div>
                                <span className="text-[11px] font-semibold tabular-nums w-7 text-right shrink-0">{item.value}</span>
                                <span className="text-[10px] text-muted-foreground/60 w-8 text-right shrink-0">
                                    {equiposFiltered.length > 0 ? ((item.value / equiposFiltered.length) * 100).toFixed(0) : 0}%
                                </span>
                            </div>
                        ))}
                        {porTipo.length === 0 && <div className="py-4 text-center text-[11px] text-muted-foreground">Sin datos</div>}
                    </div>
                </Card>

                <Card title="Estado de Vigencia" subtitle={descVigencia}>
                    <div className="flex justify-center">
                        <ResponsiveContainer width="100%" height={170}>
                            <PieChart>
                                <Pie data={vigenciaData} dataKey="value" cx="50%" cy="50%"
                                    innerRadius={52} outerRadius={78} paddingAngle={2} strokeWidth={2} stroke="var(--background)">
                                    {vigenciaData.map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={0.85}/>)}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2.5 -mt-1">
                        {vigenciaData.map((d, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }}/>
                                {d.name}
                            </div>
                        ))}
                    </div>
                </Card>

                <Card title="Por Sede / Ubicacion" subtitle={descPorSede}>
                    <ResponsiveContainer width="100%" height={210}>
                        <BarChart data={porSede} margin={{ left: 0, right: 10, top: 0, bottom: 20 }}>
                            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5}/>
                            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--foreground)' }} axisLine={false} tickLine={false} angle={-25} textAnchor="end"/>
                            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false}/>
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="value" name="Equipos" fill="#6366f1" fillOpacity={0.85} radius={[4,4,0,0]} maxBarSize={32}/>
                        </BarChart>
                    </ResponsiveContainer>
                </Card>
            </div>

            {/* ROW 2: vencimientos / tabla */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-2.5">
                <Card title="Vencimientos por Mes" subtitle={descVencimientosMes}>
                    <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={vencimientosMes} margin={{ left: 0, right: 8, top: 10, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gErr"  x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%"   stopColor="#f43f5e" stopOpacity={0.22}/><stop offset="100%" stopColor="#f43f5e" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="gWarn" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%"   stopColor="#f59e0b" stopOpacity={0.18}/><stop offset="100%" stopColor="#f59e0b" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="gOk"   x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.18}/><stop offset="100%" stopColor="#6366f1" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.35}/>
                            <XAxis dataKey="mes" tick={{ fontSize: 10.5, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false}/>
                            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={22} allowDecimals={false}/>
                            <Tooltip content={<VencimientosTooltip />} cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '5 4' }}/>
                            <Area type="monotone" dataKey="vencidos"   name="Vencidos"       stroke="#f43f5e" strokeWidth={2} fill="url(#gErr)"  dot={false} activeDot={{ r: 5, fill: '#f43f5e', stroke: 'var(--background)', strokeWidth: 2 }}/>
                            <Area type="monotone" dataKey="por_vencer" name="Por vencer"     stroke="#f59e0b" strokeWidth={2} fill="url(#gWarn)" dot={false} activeDot={{ r: 5, fill: '#f59e0b', stroke: 'var(--background)', strokeWidth: 2 }}/>
                            <Area type="monotone" dataKey="vigentes"   name="Prox. vigentes" stroke="#6366f1" strokeWidth={2} fill="url(#gOk)"   dot={false} activeDot={{ r: 5, fill: '#6366f1', stroke: 'var(--background)', strokeWidth: 2 }}/>
                        </AreaChart>
                    </ResponsiveContainer>
                    <Legend items={[['#f43f5e','Vencidos'],['#f59e0b','Por vencer'],['#6366f1','Prox. vigentes']]}/>
                </Card>

                <Card title="Proximos a Vencer" subtitle={descProximos}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[11.5px]">
                            <thead>
                                <tr className="border-b border-border">
                                    {['Codigo','Equipo','Vigencia','Estado'].map(h => (
                                        <th key={h} className="text-left pb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {proximos.map(e => {
                                    const est = getVigenciaEstado(e.vigencia || e.siguiente_verificacion);
                                    const pillClass = est === 'vencido'
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                        : est === 'por_vencer'
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400';
                                    return (
                                        <tr key={e.id_equipo} className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
                                            <td className="py-2 pr-2 font-mono text-[10.5px] text-muted-foreground">{e.codigo}</td>
                                            <td className="py-2 pr-2 max-w-[110px] truncate" title={e.nombre}>{e.nombre}</td>
                                            <td className={`py-2 pr-2 font-mono text-[10.5px] ${est==='vencido'?'text-red-600 dark:text-red-400':est==='por_vencer'?'text-amber-600 dark:text-amber-400':'text-emerald-600 dark:text-emerald-400'}`}>
                                                {e._fecha?.toLocaleDateString('es-CL') ?? '—'}
                                            </td>
                                            <td className="py-2">
                                                <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${pillClass}`}>
                                                    {est === 'vencido' ? 'Vencido' : est === 'por_vencer' ? 'Por vencer' : 'Vigente'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {proximos.length === 0 && (
                                    <tr><td colSpan={4} className="py-6 text-center text-[11px] text-muted-foreground">Sin equipos en la seleccion</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>

            {/* ROW 3: FC Divergente / Error por Punto */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                <Card title="Factor de Correccion por Equipo" subtitle={descFC}>
                    {fcEquipos.length === 0 ? (
                        <div className="py-8 text-center text-[11px] text-muted-foreground">Sin equipos con factor de correccion activo</div>
                    ) : (() => {
                        const allVals = fcEquipos.flatMap(e => [e.fc0, e.fc15, e.fc30]).filter(v => v !== 0);
                        const sorted = [...allVals].sort((a, b) => Math.abs(a) - Math.abs(b));
                        const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0.5;
                        const cap = Math.max(Math.abs(p95) * 1.2, 0.3);
                        const domain: [number, number] = [-cap, cap];
                        return (
                        <>
                        <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
                        <ResponsiveContainer width="100%" height={Math.max(200, fcEquipos.length * 32)}>
                            <BarChart data={fcEquipos} layout="vertical" margin={{ left: 4, right: 8, top: 0, bottom: 0 }}>
                                <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.4}/>
                                <XAxis type="number" tick={{ fontSize: 10.5, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} domain={domain} tickCount={7}/>
                                <YAxis type="category" dataKey="nombre" width={80} tick={{ fontSize: 10, fill: 'var(--foreground)' }} axisLine={false} tickLine={false}/>
                                <ReferenceLine x={0} stroke="var(--muted-foreground)" strokeWidth={1} strokeOpacity={0.5}/>
                                <Tooltip content={<CustomTooltip />}/>
                                <Bar dataKey="fc0"  name="FC 0°C"  maxBarSize={9} radius={[0,2,2,0]}>
                                    {fcEquipos.map((e, i) => <Cell key={i} fill={e.fc0  >= 0 ? '#10b981' : '#f43f5e'} fillOpacity={0.85}/>)}
                                </Bar>
                                <Bar dataKey="fc15" name="FC 15°C" maxBarSize={9} radius={[0,2,2,0]}>
                                    {fcEquipos.map((e, i) => <Cell key={i} fill={e.fc15 >= 0 ? '#6366f1' : '#f59e0b'} fillOpacity={0.85}/>)}
                                </Bar>
                                <Bar dataKey="fc30" name="FC 30°C" maxBarSize={9} radius={[0,2,2,0]}>
                                    {fcEquipos.map((e, i) => <Cell key={i} fill={e.fc30 >= 0 ? '#0ea5e9' : '#a855f7'} fillOpacity={0.85}/>)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                        </div>
                        <Legend items={[['#10b981','0°C (+)'],['#f43f5e','0°C (-)'],['#6366f1','15°C (+)'],['#f59e0b','15°C (-)'],['#0ea5e9','30°C (+)'],['#a855f7','30°C (-)']]}/>
                        </>
                        );
                    })()}
                </Card>

                <Card title="Error Promedio por Tipo" subtitle={descErrorTipo}>
                    {errorPorTipo.length === 0 ? (
                        <div className="py-8 text-center text-[11px] text-muted-foreground">Sin datos de error registrados</div>
                    ) : (() => {
                        const pts = ['Error 0°C','Error 15°C','Error 30°C'] as const;
                        const ptLabels = ['0°C','15°C','30°C'];
                        const ptColors = ['#10b981','#6366f1','#f59e0b'];
                        const allAbsVals = errorPorTipo.flatMap(r => pts.map(p => Math.abs(r[p])));
                        const maxAbs = Math.max(...allAbsVals, 0.01);
                        const cellBg = (val: number) => {
                            const intensity = Math.min(Math.abs(val) / maxAbs, 1);
                            const alpha = 0.08 + intensity * 0.55;
                            return val > 0 ? `rgba(16,185,129,${alpha})` : val < 0 ? `rgba(244,63,94,${alpha})` : 'transparent';
                        };
                        return (
                        <div className="overflow-x-auto">
                            <table className="w-full text-[11.5px]">
                                <thead>
                                    <tr className="border-b border-border">
                                        <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground w-[40%]">Tipo</th>
                                        {ptLabels.map((l, i) => (
                                            <th key={l} className="pb-2 text-center text-[10px] font-semibold uppercase tracking-widest" style={{ color: ptColors[i] }}>{l}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {errorPorTipo.map((row, ri) => (
                                        <tr key={ri} className="border-b border-border last:border-0">
                                            <td className="py-2 pr-3 text-[11px] font-medium truncate max-w-0 w-[40%]" title={row.tipo}>{row.tipo}</td>
                                            {pts.map((p, pi) => (
                                                <td key={pi} className="py-2 text-center">
                                                    <span className="inline-flex items-center justify-center rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold min-w-[48px]"
                                                        style={{ background: cellBg(row[p]), color: row[p] !== 0 ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                                                        {row[p] > 0 ? '+' : ''}{row[p].toFixed(2)}
                                                    </span>
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
                                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(16,185,129,0.5)' }}/>Error positivo</div>
                                <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(244,63,94,0.5)' }}/>Error negativo</div>
                            </div>
                        </div>
                        );
                    })()}
                </Card>
            </div>

            {/* ROW 4: Antiguedad / Scatter / FC donut */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_0.6fr] gap-2.5">
                <Card title="Equipos por Año de Compra" subtitle={descAntiguedad}>
                    {porAntiguedad.length === 0 ? (
                        <div className="py-8 text-center text-[11px] text-muted-foreground">Sin datos de fecha de compra</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={190}>
                            <BarChart data={porAntiguedad} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.4}/>
                                <XAxis dataKey="año" tick={{ fontSize: 10.5, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false}/>
                                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={22}/>
                                <Tooltip content={<CustomTooltip />}/>
                                <Bar dataKey="value" name="Equipos" radius={[4,4,0,0]} maxBarSize={28}>
                                    {porAntiguedad.map((_, i) => (
                                        <Cell key={i} fill="#6366f1" fillOpacity={0.3 + (i / Math.max(porAntiguedad.length - 1, 1)) * 0.6}/>
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Card>

                <Card title="Ciclo de Verificacion" subtitle={descCiclo}>
                    {cicloDatos.length === 0 ? (
                        <div className="py-8 text-center text-[11px] text-muted-foreground">Sin datos de ciclo de verificacion</div>
                    ) : (
                        <>
                        <ResponsiveContainer width="100%" height={200}>
                            <ScatterChart margin={{ left: 0, right: 10, top: 10, bottom: 10 }}>
                                <CartesianGrid stroke="var(--border)" strokeOpacity={0.35}/>
                                <XAxis type="number" dataKey="x" name="Dias desde ultima verificacion" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} label={{ value: 'Dias desde ultima verificacion', position: 'insideBottom', offset: -4, fontSize: 9, fill: 'var(--muted-foreground)' }}/>
                                <YAxis type="number" dataKey="y" name="Dias hasta vencimiento" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={32}/>
                                <ReferenceLine y={0}  stroke="#f43f5e" strokeWidth={1} strokeDasharray="4 3" opacity={0.6}/>
                                <ReferenceLine y={30} stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 3" opacity={0.5}/>
                                <ZAxis range={[30, 30]}/>
                                <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }}/>
                                <Scatter data={cicloDatos} shape={(props: any) => {
                                    const { cx, cy, payload } = props;
                                    return <circle cx={cx} cy={cy} r={5} fill={scatterColor(payload.estado)} fillOpacity={0.8} stroke="var(--background)" strokeWidth={1.5}/>;
                                }}/>
                            </ScatterChart>
                        </ResponsiveContainer>
                        <Legend items={[['#10b981','Vigente'],['#f59e0b','Por vencer'],['#f43f5e','Vencido']]}/>
                        </>
                    )}
                </Card>

                <Card title="Trazabilidad FC" subtitle={descFCDonut}>
                    <div className="flex justify-center">
                        <ResponsiveContainer width="100%" height={140}>
                            <PieChart>
                                <Pie data={fcDonutData} dataKey="value" cx="50%" cy="50%"
                                    innerRadius={42} outerRadius={62} paddingAngle={3} strokeWidth={2} stroke="var(--background)">
                                    {fcDonutData.map((entry, i) => <Cell key={i} fill={entry.fill} fillOpacity={0.85}/>)}
                                </Pie>
                                <Tooltip content={<CustomTooltip />}/>
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-col gap-2 mt-1">
                        {fcDonutData.map((d, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.fill }}/>
                                    {d.name}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="font-semibold tabular-nums">{d.value}</span>
                                    <span className="text-muted-foreground/60 text-[10px]">{equiposFiltered.length > 0 ? ((d.value/equiposFiltered.length)*100).toFixed(0) : 0}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

        </div>
    );
};
