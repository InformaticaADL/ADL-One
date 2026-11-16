import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconSearch, IconFileSpreadsheet, IconX, IconRefresh, IconInfoCircle, IconFilter } from '@tabler/icons-react';
import {
    ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    LineChart, Line, Legend, LabelList,
} from 'recharts';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useToast } from '../../../../contexts/ToastContext';
import { verificacionTemperaturaService as api, type ResumenVerificaciones, type ResumenEquipo } from '../../services/verificacionTemperatura.service';
import { fmtFecha, fmtNum, hoyYmd, nombrePeriodo, TOLERANCIA } from '../../utils/verificacionTemperatura';

// Hoja "Resumen" de la planilla de verificaciones, con estadística y gráficos.
// Cada equipo muestra su última ficha hasta el periodo elegido; si aún no
// tiene ficha en el sistema, lo registrado en el equipo (dato de la planilla).

type Punto = 0 | 15 | 30;
type Registro = 'FIRMADA' | 'PENDIENTE_FIRMA' | 'BORRADOR' | 'SIN_FICHA';
type Resultado = 'CUMPLE' | 'NO_CUMPLE' | 'SIN_DATO';
type Antiguedad = '≤ 3 meses' | '3 a 6 meses' | '6 a 12 meses' | '> 12 meses' | 'Sin registro';

interface Fila {
    e: ResumenEquipo;
    fuente: 'ficha' | 'equipo' | null;
    fecha: string | null;
    errores: Record<Punto, number | null>;
    resultado: Resultado;
    registro: Registro;
    antiguedad: Antiguedad;
    maxAbs: number | null;
    vencida: boolean;
    vigencia: Vigencia;
}

type Vigencia = 'VIGENTE' | 'POR_VENCER' | 'VENCIDA' | 'SIN_FECHA';
const VIGENCIA: Record<Vigencia, string> = {
    VIGENTE: 'Vigente', POR_VENCER: 'Vence en 30 días', VENCIDA: 'Vencida', SIN_FECHA: 'Sin fecha',
};
const ESTADOS_EQUIPO = ['Operativo', 'Fuera de Servicio', 'Dado de Baja'];
const sumarDias = (ymd: string, dias: number) => {
    const d = new Date(`${ymd}T12:00:00`);
    d.setDate(d.getDate() + dias);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Filtros de la estadística (afectan indicadores, gráficos y tabla).
interface Filtros {
    sede: string;
    tipo: string;
    estado: string;          // '' = todos
    responsable: string;
    resultado: '' | Resultado;
    registro: '' | Registro;
    vigencia: '' | Vigencia;
    antiguedad: '' | Antiguedad;
    fueraEn: '' | 'cualquiera' | '0' | '15' | '30';
    origen: '' | 'ficha' | 'equipo';
    desde: string;
    hasta: string;
}
const FILTROS_INICIALES: Filtros = {
    sede: '', tipo: '', estado: 'Operativo', responsable: '', resultado: '', registro: '',
    vigencia: '', antiguedad: '', fueraEn: '', origen: '', desde: '', hasta: '',
};

const Sel: React.FC<{ etiqueta: string; valor: string; onCambio: (v: string) => void; opciones: { v: string; l: string }[]; todos: string }> = ({ etiqueta, valor, onCambio, opciones, todos }) => (
    <label className="flex min-w-0 flex-col gap-1">
        <span className="text-[11px] font-medium text-muted-foreground">{etiqueta}</span>
        <select
            value={valor}
            onChange={(e) => onCambio(e.target.value)}
            className={cn('h-8 w-full rounded-md border bg-background px-2 text-sm', valor ? 'border-primary text-foreground' : 'border-border text-muted-foreground')}
        >
            <option value="">{todos}</option>
            {opciones.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
    </label>
);

const REGISTRO: Record<Registro, { label: string; color: string; badge: 'success' | 'warning' | 'outline' | 'secondary' }> = {
    FIRMADA: { label: 'Firmada', color: '#16a34a', badge: 'success' },
    PENDIENTE_FIRMA: { label: 'Pendiente de firma', color: '#f59e0b', badge: 'warning' },
    BORRADOR: { label: 'En borrador', color: '#6366f1', badge: 'outline' },
    SIN_FICHA: { label: 'Sin ficha del periodo', color: '#94a3b8', badge: 'secondary' },
};
const RESULTADO: Record<Resultado, { label: string; color: string }> = {
    CUMPLE: { label: 'Cumple', color: '#16a34a' },
    NO_CUMPLE: { label: 'No cumple', color: '#ef4444' },
    SIN_DATO: { label: 'Sin dato', color: '#94a3b8' },
};
const ANTIGUEDADES: Antiguedad[] = ['≤ 3 meses', '3 a 6 meses', '6 a 12 meses', '> 12 meses', 'Sin registro'];
const COLOR_ANT: Record<Antiguedad, string> = {
    '≤ 3 meses': '#16a34a', '3 a 6 meses': '#84cc16', '6 a 12 meses': '#f59e0b', '> 12 meses': '#ef4444', 'Sin registro': '#94a3b8',
};

// Error redondeado a una décima (los cálculos traen ruido de punto flotante).
const r1 = (n: number) => Math.round(n * 10) / 10 + 0;
const BINS = ['< -0,5', ...Array.from({ length: 11 }, (_, i) => fmtNum(r1(-0.5 + i * 0.1))), '> 0,5'];
const binDe = (e: number) => (e < -TOLERANCIA - 1e-9 ? '< -0,5' : e > TOLERANCIA + 1e-9 ? '> 0,5' : fmtNum(r1(e)));

const mesesEntre = (desde: string, hasta: string) => {
    const [y1, m1, d1] = desde.split('-').map(Number);
    const [y2, m2, d2] = hasta.split('-').map(Number);
    return (y2 - y1) * 12 + (m2 - m1) + (d2 - d1) / 31;
};

const construir = (e: ResumenEquipo, hoy: string, en30: string): Fila => {
    const fichaCompleta = !!e.id_verificacion && (e.error0 !== null || e.error15 !== null || e.error30 !== null);
    const hayEquipo = e.eq_error0 !== null || e.eq_error15 !== null || e.eq_error30 !== null;
    const fuente = fichaCompleta ? 'ficha' : hayEquipo ? 'equipo' : null;
    const errores: Record<Punto, number | null> = fuente === 'ficha'
        ? { 0: e.error0, 15: e.error15, 30: e.error30 }
        : { 0: e.eq_error0, 15: e.eq_error15, 30: e.eq_error30 };
    const vals = Object.values(errores).filter((v): v is number => v !== null);
    const resultado: Resultado = !vals.length ? 'SIN_DATO' : vals.every((v) => Math.abs(v) <= TOLERANCIA + 1e-9) ? 'CUMPLE' : 'NO_CUMPLE';
    const fecha = (fuente === 'ficha' ? e.fecha_verificacion : null) || e.eq_ultima_verificacion || e.fecha_verificacion;
    const registro: Registro = e.del_periodo && e.estado ? (e.estado as Registro) : 'SIN_FICHA';
    let antiguedad: Antiguedad = 'Sin registro';
    if (fecha) {
        const m = mesesEntre(fecha.slice(0, 10), hoy);
        antiguedad = m <= 3 ? '≤ 3 meses' : m <= 6 ? '3 a 6 meses' : m <= 12 ? '6 a 12 meses' : '> 12 meses';
    }
    return {
        e, fuente, fecha, errores, resultado, registro, antiguedad,
        maxAbs: vals.length ? Math.max(...vals.map(Math.abs)) : null,
        vencida: !!e.eq_siguiente_verificacion && e.eq_siguiente_verificacion < hoy,
        vigencia: !e.eq_siguiente_verificacion ? 'SIN_FECHA'
            : e.eq_siguiente_verificacion < hoy ? 'VENCIDA'
                : e.eq_siguiente_verificacion <= en30 ? 'POR_VENCER' : 'VIGENTE',
    };
};

type FiltroGrafico =
    | { tipo: 'registro'; valor: Registro }
    | { tipo: 'resultado'; valor: Resultado; sede?: string }
    | { tipo: 'bin'; valor: string; punto: Punto }
    | { tipo: 'antiguedad'; valor: Antiguedad }
    | { tipo: 'vencida' };

const etiquetaFiltro = (f: FiltroGrafico) => {
    switch (f.tipo) {
        case 'registro': return REGISTRO[f.valor].label;
        case 'resultado': return `${RESULTADO[f.valor].label}${f.sede ? ` · ${f.sede}` : ''}`;
        case 'bin': return `Error ${f.punto} °C: ${f.valor}`;
        case 'antiguedad': return `Última verificación: ${f.valor}`;
        case 'vencida': return 'Vigencia vencida';
    }
};

const TooltipCaja: React.FC<{ active?: boolean; payload?: { name?: string; value?: number | string; color?: string; payload?: { fill?: string } }[]; label?: string | number; sufijo?: string }> = ({ active, payload, label, sufijo = '' }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
            {label !== undefined && label !== '' && <p className="mb-1 font-semibold text-foreground">{label}</p>}
            {payload.map((p, i) => (
                <p key={i} className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
                    {p.name}: <span className="font-medium text-foreground">{typeof p.value === 'number' ? fmtNum(p.value, 0) : p.value}{sufijo}</span>
                </p>
            ))}
        </div>
    );
};

const Tarjeta: React.FC<{ titulo: string; ayuda?: string; className?: string; children: React.ReactNode; accion?: React.ReactNode }> = ({ titulo, ayuda, className, children, accion }) => (
    <div className={cn('rounded-xl border border-border bg-card p-4', className)}>
        <div className="mb-2 flex items-start justify-between gap-2">
            <div>
                <p className="text-sm font-semibold">{titulo}</p>
                {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
            </div>
            {accion}
        </div>
        {children}
    </div>
);

export const ResumenVerificacionTemp: React.FC<{ periodo: string; onAbrirFicha: (id: number) => void }> = ({ periodo, onAbrirFicha }) => {
    const { showToast } = useToast();
    const [datos, setDatos] = useState<ResumenVerificaciones | null>(null);
    const [cargando, setCargando] = useState(false);
    const [f, setF] = useState<Filtros>(FILTROS_INICIALES);
    const [masFiltros, setMasFiltros] = useState(false);
    const cambiar = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setF((prev) => ({ ...prev, [k]: v }));
    const { sede, tipo } = f;
    const [busqueda, setBusqueda] = useState('');
    const [filtro, setFiltro] = useState<FiltroGrafico | null>(null);
    const [punto, setPunto] = useState<Punto>(0);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            setDatos(await api.resumen(periodo));
        } catch (err) {
            const mensaje = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            showToast({ type: 'error', message: mensaje || 'No se pudo cargar el resumen' });
        } finally {
            setCargando(false);
        }
    }, [periodo, showToast]);
    useEffect(() => { cargar(); }, [cargar]);

    const hoy = hoyYmd();
    const filas = useMemo(() => (datos?.equipos ?? []).map((e) => construir(e, hoy, sumarDias(hoy, 30))), [datos, hoy]);
    const sedes = useMemo(() => [...new Set(filas.map((x) => x.e.sede).filter(Boolean))].sort(), [filas]);
    const tipos = useMemo(() => [...new Set(filas.map((x) => x.e.tipoequipo).filter(Boolean))].sort(), [filas]);
    const responsables = useMemo(() => [...new Set(filas.map((x) => x.e.nombre_muestreador).filter((r): r is string => !!r))].sort((a, b) => a.localeCompare(b, 'es')), [filas]);

    // Base de la estadística: todos los filtros de arriba (los gráficos se
    // calculan sobre esto; el clic en un gráfico filtra solo la tabla).
    const base = useMemo(() => filas.filter((x) => {
        if (f.sede && x.e.sede !== f.sede) return false;
        if (f.tipo && x.e.tipoequipo !== f.tipo) return false;
        if (f.estado && (x.e.estado_equipo || '').toLowerCase() !== f.estado.toLowerCase()) return false;
        if (f.responsable && x.e.nombre_muestreador !== f.responsable) return false;
        if (f.resultado && x.resultado !== f.resultado) return false;
        if (f.registro && x.registro !== f.registro) return false;
        if (f.vigencia && x.vigencia !== f.vigencia) return false;
        if (f.antiguedad && x.antiguedad !== f.antiguedad) return false;
        if (f.origen && x.fuente !== f.origen) return false;
        if (f.fueraEn) {
            const puntos: Punto[] = f.fueraEn === 'cualquiera' ? [0, 15, 30] : [Number(f.fueraEn) as Punto];
            if (!puntos.some((p) => x.errores[p] !== null && Math.abs(x.errores[p] as number) > TOLERANCIA + 1e-9)) return false;
        }
        const fecha = x.fecha?.slice(0, 10) ?? '';
        if (f.desde && (!fecha || fecha < f.desde)) return false;
        if (f.hasta && (!fecha || fecha > f.hasta)) return false;
        return true;
    }), [filas, f]);

    // Filtros que difieren de los iniciales (el estado "Operativo" es el de partida).
    const filtrosActivos = (Object.keys(FILTROS_INICIALES) as (keyof Filtros)[]).filter((k) => f[k] !== FILTROS_INICIALES[k]).length;
    const extrasActivos = (['responsable', 'resultado', 'registro', 'vigencia', 'antiguedad', 'fueraEn', 'origen', 'desde', 'hasta'] as (keyof Filtros)[]).filter((k) => !!f[k]).length;

    const tabla = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        return base.filter((f) => {
            if (q && !`${f.e.codigo} ${f.e.nombre} ${f.e.nombre_muestreador ?? ''} ${f.e.equipo_asociado ?? ''}`.toLowerCase().includes(q)) return false;
            if (!filtro) return true;
            switch (filtro.tipo) {
                case 'registro': return f.registro === filtro.valor;
                case 'resultado': return f.resultado === filtro.valor && (!filtro.sede || f.e.sede === filtro.sede);
                case 'bin': { const v = f.errores[filtro.punto]; return v !== null && binDe(v) === filtro.valor; }
                case 'antiguedad': return f.antiguedad === filtro.valor;
                case 'vencida': return f.vencida;
            }
        });
    }, [base, busqueda, filtro]);

    // ── Indicadores ──
    const n = base.length;
    const cuenta = (pred: (f: Fila) => boolean) => base.filter(pred).length;
    const firmadas = cuenta((f) => f.registro === 'FIRMADA');
    const conDato = cuenta((f) => f.resultado !== 'SIN_DATO');
    const cumplen = cuenta((f) => f.resultado === 'CUMPLE');
    const noCumplen = cuenta((f) => f.resultado === 'NO_CUMPLE');
    const vencidas = cuenta((f) => f.vencida);
    const todosErrores = base.flatMap((f) => Object.values(f.errores).filter((v): v is number => v !== null));
    const promAbs = todosErrores.length ? todosErrores.reduce((a, b) => a + Math.abs(b), 0) / todosErrores.length : null;
    const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

    // ── Datos de los gráficos ──
    const dRegistro = (Object.keys(REGISTRO) as Registro[])
        .map((k) => ({ key: k, name: REGISTRO[k].label, value: cuenta((f) => f.registro === k), fill: REGISTRO[k].color }))
        .filter((d) => d.value > 0);
    const dSede = sedes.filter((s) => !sede || s === sede).map((s) => {
        const deSede = base.filter((f) => f.e.sede === s);
        return {
            sede: s,
            CUMPLE: deSede.filter((f) => f.resultado === 'CUMPLE').length,
            NO_CUMPLE: deSede.filter((f) => f.resultado === 'NO_CUMPLE').length,
            SIN_DATO: deSede.filter((f) => f.resultado === 'SIN_DATO').length,
        };
    }).filter((d) => d.CUMPLE + d.NO_CUMPLE + d.SIN_DATO > 0);
    const dBins = BINS.map((b) => ({
        bin: b,
        equipos: base.filter((f) => f.errores[punto] !== null && binDe(f.errores[punto] as number) === b).length,
        fuera: b === '< -0,5' || b === '> 0,5',
    }));
    const dAnt = ANTIGUEDADES.map((a) => ({ name: a, value: cuenta((f) => f.antiguedad === a), fill: COLOR_ANT[a] }));
    const dTop = [...base].filter((f) => f.maxAbs !== null).sort((a, b) => (b.maxAbs as number) - (a.maxAbs as number)).slice(0, 8)
        .map((f) => ({ codigo: f.e.codigo, valor: r1(f.maxAbs as number), fila: f }));
    const dSerie = (datos?.serie ?? []).slice(-12).map((s) => ({
        periodo: `${nombrePeriodo(s.periodo).slice(0, 3)} ${s.periodo.slice(2, 4)}`,
        Fichas: s.total,
        Firmadas: s.firmadas,
        '% cumple': s.cumplen + s.no_cumplen ? Math.round((s.cumplen / (s.cumplen + s.no_cumplen)) * 100) : null,
    }));

    const alternarFiltro = (f: FiltroGrafico) => setFiltro((prev) => (prev && JSON.stringify(prev) === JSON.stringify(f) ? null : f));

    const exportar = () => {
        const filasXls = tabla.map((f) => ({
            'Nombre Equipo': f.e.tipoequipo,
            'Código Interno': f.e.codigo,
            'Equipo asociado': f.e.equipo_asociado ?? '',
            Sede: f.e.sede,
            Responsable: f.e.nombre_muestreador ?? '',
            Fecha: f.fecha ? fmtFecha(f.fecha) : '',
            'Error 0,0 °C': f.errores[0],
            'Error 15,0 °C': f.errores[15],
            'Error 30,0 °C': f.errores[30],
            'FC 0,0 °C': f.errores[0] === null ? null : r1(-f.errores[0]),
            'FC 15,0 °C': f.errores[15] === null ? null : r1(-f.errores[15]),
            'FC 30,0 °C': f.errores[30] === null ? null : r1(-f.errores[30]),
            Resultado: RESULTADO[f.resultado].label,
            Estado: f.e.estado_equipo ?? '',
            [`Registro ${nombrePeriodo(periodo)}`]: REGISTRO[f.registro].label,
            Origen: f.fuente === 'ficha' ? 'Ficha OI-FoGe-39' : f.fuente === 'equipo' ? 'Dato del equipo' : '',
        }));
        const ws = XLSX.utils.json_to_sheet(filasXls);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Resumen');
        XLSX.writeFile(wb, `Resumen Verificaciones Intermedias T° - ${nombrePeriodo(periodo)}.xlsx`);
    };

    const kpis: { label: string; valor: string; detalle: string; tono?: string; onClick?: () => void; activo?: boolean }[] = [
        { label: 'Equipos', valor: String(n), detalle: f.estado ? f.estado.toLowerCase() : 'todos los estados' },
        { label: `Firmadas en ${nombrePeriodo(periodo)}`, valor: `${pct(firmadas, n)}%`, detalle: `${firmadas} de ${n}`, tono: 'text-success', onClick: () => alternarFiltro({ tipo: 'registro', valor: 'FIRMADA' }), activo: filtro?.tipo === 'registro' && filtro.valor === 'FIRMADA' },
        { label: 'Cumplen (±0,5 °C)', valor: `${pct(cumplen, conDato)}%`, detalle: `${cumplen} de ${conDato} con dato`, tono: 'text-success', onClick: () => alternarFiltro({ tipo: 'resultado', valor: 'CUMPLE' }), activo: filtro?.tipo === 'resultado' && filtro.valor === 'CUMPLE' && !filtro.sede },
        { label: 'No cumplen', valor: String(noCumplen), detalle: 'algún punto fuera de ±0,5', tono: noCumplen ? 'text-destructive' : undefined, onClick: () => alternarFiltro({ tipo: 'resultado', valor: 'NO_CUMPLE' }), activo: filtro?.tipo === 'resultado' && filtro.valor === 'NO_CUMPLE' && !filtro.sede },
        { label: 'Vigencia vencida', valor: String(vencidas), detalle: 'siguiente verificación pasada', tono: vencidas ? 'text-warning' : undefined, onClick: () => alternarFiltro({ tipo: 'vencida' }), activo: filtro?.tipo === 'vencida' },
        { label: 'Error medio |e|', valor: promAbs === null ? '—' : `${fmtNum(promAbs, 2)} °C`, detalle: `${todosErrores.length} puntos medidos` },
    ];

    return (
        <div className="flex flex-col gap-4">
            {/* Filtros de la estadística */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1">
                    {['', ...sedes].map((s) => (
                        <button
                            key={s || 'todas'}
                            type="button"
                            onClick={() => cambiar('sede', s)}
                            className={cn('h-8 rounded-md border px-3 text-sm transition-colors', sede === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted')}
                        >
                            {s || 'Todas las sedes'}
                        </button>
                    ))}
                </div>
                <select
                    value={tipo}
                    onChange={(e) => cambiar('tipo', e.target.value)}
                    className={cn('h-8 rounded-md border bg-background px-2 text-sm', tipo ? 'border-primary' : 'border-border')}
                    aria-label="Tipo de equipo"
                >
                    <option value="">Todos los tipos</option>
                    {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="flex rounded-lg border border-border p-0.5" role="group" aria-label="Estado del equipo">
                    {[...ESTADOS_EQUIPO, ''].map((e) => (
                        <button
                            key={e || 'todos'}
                            type="button"
                            onClick={() => cambiar('estado', e)}
                            className={cn('h-7 rounded-md px-2.5 text-xs font-medium transition-colors', f.estado === e ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                        >
                            {e || 'Todos'}
                        </button>
                    ))}
                </div>
                <Button variant={masFiltros || extrasActivos ? 'secondary' : 'outline'} size="sm" onClick={() => setMasFiltros((v) => !v)}>
                    <IconFilter size={15} /> Más filtros{extrasActivos > 0 && <Badge className="ml-0.5 h-4 px-1.5 text-[10px]">{extrasActivos}</Badge>}
                </Button>
                {filtrosActivos > 0 && (
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setF(FILTROS_INICIALES); setFiltro(null); }}>
                        <IconX size={15} /> Limpiar
                    </Button>
                )}
                <Button variant="ghost" size="sm" onClick={cargar} disabled={cargando} className="ml-auto">
                    <IconRefresh size={15} className={cn(cargando && 'animate-spin')} /> Actualizar
                </Button>
            </div>

            {masFiltros && (
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:grid-cols-3 lg:grid-cols-5">
                    <Sel etiqueta="Responsable" valor={f.responsable} onCambio={(v) => cambiar('responsable', v)} todos="Todos"
                        opciones={responsables.map((r) => ({ v: r, l: r }))} />
                    <Sel etiqueta="Resultado" valor={f.resultado} onCambio={(v) => cambiar('resultado', v as Filtros['resultado'])} todos="Todos"
                        opciones={(Object.keys(RESULTADO) as Resultado[]).map((k) => ({ v: k, l: RESULTADO[k].label }))} />
                    <Sel etiqueta={`Ficha de ${nombrePeriodo(periodo)}`} valor={f.registro} onCambio={(v) => cambiar('registro', v as Filtros['registro'])} todos="Todas"
                        opciones={(Object.keys(REGISTRO) as Registro[]).map((k) => ({ v: k, l: REGISTRO[k].label }))} />
                    <Sel etiqueta="Vigencia" valor={f.vigencia} onCambio={(v) => cambiar('vigencia', v as Filtros['vigencia'])} todos="Todas"
                        opciones={(Object.keys(VIGENCIA) as Vigencia[]).map((k) => ({ v: k, l: VIGENCIA[k] }))} />
                    <Sel etiqueta="Antigüedad de la última verificación" valor={f.antiguedad} onCambio={(v) => cambiar('antiguedad', v as Filtros['antiguedad'])} todos="Todas"
                        opciones={ANTIGUEDADES.map((a) => ({ v: a, l: a }))} />
                    <Sel etiqueta="Fuera de tolerancia (±0,5 °C)" valor={f.fueraEn} onCambio={(v) => cambiar('fueraEn', v as Filtros['fueraEn'])} todos="Sin filtro"
                        opciones={[{ v: 'cualquiera', l: 'En algún punto' }, { v: '0', l: 'A 0 °C' }, { v: '15', l: 'A 15 °C' }, { v: '30', l: 'A 30 °C' }]} />
                    <Sel etiqueta="Origen del dato" valor={f.origen} onCambio={(v) => cambiar('origen', v as Filtros['origen'])} todos="Todos"
                        opciones={[{ v: 'ficha', l: 'Ficha del sistema' }, { v: 'equipo', l: 'Dato del equipo' }]} />
                    <label className="flex min-w-0 flex-col gap-1">
                        <span className="text-[11px] font-medium text-muted-foreground">Última verificación desde</span>
                        <Input type="date" className={cn('h-8', f.desde && 'border-primary')} value={f.desde} max={f.hasta || undefined} onChange={(e) => cambiar('desde', e.target.value)} />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1">
                        <span className="text-[11px] font-medium text-muted-foreground">Última verificación hasta</span>
                        <Input type="date" className={cn('h-8', f.hasta && 'border-primary')} value={f.hasta} min={f.desde || undefined} onChange={(e) => cambiar('hasta', e.target.value)} />
                    </label>
                </div>
            )}

            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
                {kpis.map((k) => {
                    const Comp = k.onClick ? 'button' : 'div';
                    return (
                        <Comp
                            key={k.label}
                            {...(k.onClick ? { type: 'button' as const, onClick: k.onClick } : {})}
                            className={cn(
                                'rounded-xl border bg-card px-4 py-3 text-left',
                                k.onClick && 'transition-colors hover:border-primary/40',
                                k.activo ? 'border-primary ring-1 ring-primary' : 'border-border',
                            )}
                        >
                            <p className="truncate text-xs text-muted-foreground">{k.label}</p>
                            <p className={cn('text-2xl font-bold tabular-nums', k.tono)}>{k.valor}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{k.detalle}</p>
                        </Comp>
                    );
                })}
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
                <Tarjeta titulo={`Avance de ${nombrePeriodo(periodo)}`} ayuda="Estado de la ficha del periodo. Clic para filtrar.">
                    {dRegistro.length ? (
                        <div className="flex items-center gap-2">
                            <ResponsiveContainer width="55%" height={170}>
                                <PieChart>
                                    <Pie data={dRegistro} dataKey="value" nameKey="name" innerRadius={48} outerRadius={74} paddingAngle={2} stroke="var(--card)" strokeWidth={2}
                                        onClick={(d) => { const k = (d.payload as { key?: Registro } | undefined)?.key; if (k) alternarFiltro({ tipo: 'registro', valor: k }); }} className="cursor-pointer">
                                        {dRegistro.map((d) => (
                                            <Cell key={d.key} fill={d.fill} fillOpacity={filtro && !(filtro.tipo === 'registro' && filtro.valor === d.key) ? 0.35 : 0.9} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<TooltipCaja />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex flex-1 flex-col gap-1.5 text-xs">
                                {dRegistro.map((d) => (
                                    <button key={d.key} type="button" onClick={() => alternarFiltro({ tipo: 'registro', valor: d.key })} className="flex items-center gap-1.5 text-left hover:underline">
                                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.fill }} />
                                        <span className="flex-1">{d.name}</span>
                                        <b className="tabular-nums">{d.value}</b>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : <SinDatos />}
                </Tarjeta>

                <Tarjeta titulo="Resultado por sede" ayuda="Última verificación de cada equipo. Clic en una barra para filtrar.">
                    {dSede.length ? (
                        <ResponsiveContainer width="100%" height={170}>
                            <BarChart data={dSede} margin={{ left: -18, right: 4, top: 4, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                                <XAxis dataKey="sede" tick={{ fontSize: 11, fill: 'var(--foreground)' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={<TooltipCaja />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                                {(['CUMPLE', 'NO_CUMPLE', 'SIN_DATO'] as Resultado[]).map((k, i, arr) => (
                                    <Bar key={k} dataKey={k} name={RESULTADO[k].label} stackId="s" fill={RESULTADO[k].color} fillOpacity={0.85} maxBarSize={42}
                                        radius={i === arr.length - 1 ? [4, 4, 0, 0] : 0} className="cursor-pointer"
                                        onClick={(d) => alternarFiltro({ tipo: 'resultado', valor: k, sede: (d.payload as { sede?: string } | undefined)?.sede })} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <SinDatos />}
                </Tarjeta>

                <Tarjeta titulo="Antigüedad de la última verificación" ayuda="Meses desde la última verificación registrada. Clic para filtrar.">
                    {n ? (
                        <ResponsiveContainer width="100%" height={170}>
                            <BarChart data={dAnt} layout="vertical" margin={{ left: 4, right: 28, top: 0, bottom: 0 }}>
                                <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.4} />
                                <XAxis type="number" hide allowDecimals={false} />
                                <YAxis type="category" dataKey="name" width={86} tick={{ fontSize: 10.5, fill: 'var(--foreground)' }} axisLine={false} tickLine={false} />
                                <Tooltip content={<TooltipCaja />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                                <Bar dataKey="value" name="Equipos" radius={[0, 4, 4, 0]} maxBarSize={18} className="cursor-pointer"
                                    onClick={(d) => { const a = (d.payload as { name?: Antiguedad } | undefined)?.name; if (a) alternarFiltro({ tipo: 'antiguedad', valor: a }); }}>
                                    {dAnt.map((d) => <Cell key={d.name} fill={d.fill} fillOpacity={filtro && !(filtro.tipo === 'antiguedad' && filtro.valor === d.name) ? 0.35 : 0.85} />)}
                                    <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <SinDatos />}
                </Tarjeta>

                <Tarjeta
                    className="lg:col-span-2"
                    titulo="Distribución del error"
                    ayuda="Cuántos equipos tienen cada error (°C). En rojo, fuera de la tolerancia ±0,5. Clic en una barra para ver esos equipos."
                    accion={(
                        <div className="flex rounded-lg border border-border p-0.5">
                            {([0, 15, 30] as Punto[]).map((p) => (
                                <button key={p} type="button" onClick={() => setPunto(p)}
                                    className={cn('h-6 rounded-md px-2 text-xs transition-colors', punto === p ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
                                    {p} °C
                                </button>
                            ))}
                        </div>
                    )}
                >
                    {todosErrores.length ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={dBins} margin={{ left: -18, right: 4, top: 14, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                                <XAxis dataKey="bin" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} interval={0} />
                                <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={<TooltipCaja />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                                <Bar dataKey="equipos" name="Equipos" radius={[4, 4, 0, 0]} maxBarSize={34} className="cursor-pointer"
                                    onClick={(d) => { const b = (d.payload as { bin?: string } | undefined)?.bin; if (b) alternarFiltro({ tipo: 'bin', valor: b, punto }); }}>
                                    {dBins.map((d) => {
                                        const activo = filtro?.tipo === 'bin' && filtro.punto === punto && filtro.valor === d.bin;
                                        return <Cell key={d.bin} fill={d.fuera ? '#ef4444' : '#6366f1'} fillOpacity={filtro?.tipo === 'bin' && !activo ? 0.35 : 0.85} />;
                                    })}
                                    <LabelList dataKey="equipos" position="top" style={{ fontSize: 10, fill: 'var(--muted-foreground)' }} formatter={(v: unknown) => (Number(v) ? String(v) : '')} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <SinDatos />}
                </Tarjeta>

                <Tarjeta titulo="Mayor error" ayuda="Equipos con el mayor |error| en algún punto. Clic para abrir su ficha.">
                    {dTop.length ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={dTop} layout="vertical" margin={{ left: 4, right: 30, top: 0, bottom: 0 }}>
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="codigo" width={92} tick={{ fontSize: 10, fill: 'var(--foreground)' }} axisLine={false} tickLine={false} />
                                <Tooltip content={<TooltipCaja sufijo=" °C" />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                                <Bar dataKey="valor" name="|Error| máx." radius={[0, 4, 4, 0]} maxBarSize={16} className="cursor-pointer"
                                    onClick={(d) => {
                                        const fila = (d.payload as { fila?: Fila } | undefined)?.fila;
                                        if (fila?.e.id_verificacion) onAbrirFicha(fila.e.id_verificacion);
                                        else if (fila) setBusqueda(fila.e.codigo);
                                    }}>
                                    {dTop.map((d) => <Cell key={d.codigo} fill={d.valor > TOLERANCIA ? '#ef4444' : '#f59e0b'} fillOpacity={0.85} />)}
                                    <LabelList dataKey="valor" position="right" style={{ fontSize: 10, fill: 'var(--muted-foreground)' }} formatter={(v: unknown) => fmtNum(Number(v))} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <SinDatos />}
                </Tarjeta>

                <Tarjeta className="lg:col-span-3" titulo="Historial por periodo" ayuda="Fichas creadas y firmadas en cada campaña, y porcentaje que cumple.">
                    {dSerie.length >= 2 ? (
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={dSerie} margin={{ left: -14, right: 8, top: 8, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                                <XAxis dataKey="periodo" tick={{ fontSize: 10.5, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="n" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <YAxis yAxisId="p" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} unit="%" width={36} />
                                <Tooltip content={<TooltipCaja />} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Line yAxisId="n" type="monotone" dataKey="Fichas" stroke="#94a3b8" strokeWidth={2} dot={{ r: 3 }} />
                                <Line yAxisId="n" type="monotone" dataKey="Firmadas" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                                <Line yAxisId="p" type="monotone" dataKey="% cumple" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                            <IconInfoCircle size={16} /> El historial se arma con las fichas del sistema: aparecerá cuando haya al menos dos periodos con fichas.
                        </p>
                    )}
                </Tarjeta>
            </div>

            {/* Tabla con el formato de la hoja Resumen */}
            <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">Resumen por equipo</p>
                <span className="text-xs text-muted-foreground">{tabla.length} de {n}</span>
                {filtro && (
                    <Badge variant="secondary" className="gap-1 pr-1">
                        {etiquetaFiltro(filtro)}
                        <button type="button" onClick={() => setFiltro(null)} className="rounded p-0.5 hover:bg-background" aria-label="Quitar filtro"><IconX size={12} /></button>
                    </Badge>
                )}
                <div className="relative ml-auto w-full max-w-xs">
                    <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input className="h-8 pl-8" placeholder="Buscar equipo, asociado o responsable..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                </div>
                <Button variant="outline" size="sm" onClick={exportar} disabled={!tabla.length}>
                    <IconFileSpreadsheet size={15} className="text-green-600" /> Exportar Excel
                </Button>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
                {/* Unas 10 filas a la vista; el resto con scroll y el encabezado fijo
                    (por eso el encabezado va en una sola fila). */}
                <Table containerClassName="max-h-[600px]">
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Equipo</TableHead>
                            <TableHead>Sede</TableHead>
                            <TableHead>Responsable</TableHead>
                            <TableHead>Fecha</TableHead>
                            {[0, 15, 30].map((p) => (
                                <TableHead key={`e${p}`} className="whitespace-nowrap text-center" title={`Error a ${p} °C`}>Error {p}°</TableHead>
                            ))}
                            {[0, 15, 30].map((p) => (
                                <TableHead key={`f${p}`} className="whitespace-nowrap text-center" title={`Factor de corrección a ${p} °C`}>FC {p}°</TableHead>
                            ))}
                            <TableHead>Resultado</TableHead>
                            <TableHead>Estado equipo</TableHead>
                            <TableHead>Registro</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tabla.map((f) => {
                            const abrir = f.e.id_verificacion ? () => onAbrirFicha(f.e.id_verificacion as number) : undefined;
                            return (
                                <TableRow key={f.e.id_equipo} className={cn(abrir && 'cursor-pointer')} onClick={abrir}>
                                    <TableCell>
                                        <p className="font-semibold">{f.e.codigo}</p>
                                        <p className="max-w-[200px] truncate text-xs text-muted-foreground">
                                            {f.e.tipoequipo}{f.e.equipo_asociado ? ` · ${f.e.equipo_asociado}` : ''}
                                        </p>
                                    </TableCell>
                                    <TableCell><Badge variant="outline">{f.e.sede}</Badge></TableCell>
                                    <TableCell className="max-w-[150px] truncate text-sm">{f.e.nombre_muestreador || '—'}</TableCell>
                                    <TableCell className="whitespace-nowrap text-sm">
                                        {fmtFecha(f.fecha)}
                                        {f.fuente === 'equipo' && <p className="text-[10px] text-muted-foreground" title="Aún no hay ficha en el sistema: dato registrado en el equipo">dato del equipo</p>}
                                    </TableCell>
                                    {([0, 15, 30] as Punto[]).map((p) => {
                                        const v = f.errores[p];
                                        return <TableCell key={`e${p}`} className={cn('text-center tabular-nums', v !== null && Math.abs(v) > TOLERANCIA + 1e-9 && 'font-semibold text-destructive')}>{fmtNum(v === null ? null : r1(v))}</TableCell>;
                                    })}
                                    {([0, 15, 30] as Punto[]).map((p) => {
                                        const v = f.errores[p];
                                        return <TableCell key={`f${p}`} className="text-center tabular-nums text-muted-foreground">{fmtNum(v === null ? null : r1(-v))}</TableCell>;
                                    })}
                                    <TableCell>
                                        {f.resultado === 'SIN_DATO' ? <span className="text-xs text-muted-foreground">—</span>
                                            : <Badge variant={f.resultado === 'CUMPLE' ? 'success' : 'destructive'}>{RESULTADO[f.resultado].label}</Badge>}
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        <span className={cn((f.e.estado_equipo || '').toLowerCase() !== 'operativo' && 'text-muted-foreground')}>{f.e.estado_equipo || '—'}</span>
                                        {f.vencida && <p className="text-[10px] font-medium text-warning">vigencia vencida</p>}
                                    </TableCell>
                                    <TableCell><Badge variant={REGISTRO[f.registro].badge}>{REGISTRO[f.registro].label}</Badge></TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                {!cargando && tabla.length === 0 && (
                    <p className="py-10 text-center text-sm text-muted-foreground">Ningún equipo coincide con los filtros.</p>
                )}
            </div>
        </div>
    );
};

const SinDatos = () => <p className="py-10 text-center text-sm text-muted-foreground">Sin datos con estos filtros.</p>;
