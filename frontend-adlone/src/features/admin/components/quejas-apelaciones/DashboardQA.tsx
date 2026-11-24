import { useEffect, useState } from 'react';
import { IconAlertTriangle, IconClockHour4, IconFileSpreadsheet, IconCircleCheck } from '@tabler/icons-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useToast } from '../../../../contexts/ToastContext';
import { quejasApelacionesService as api, mensajeError, type Breakdown, type PlazoCaso, type Stats, type TipoCaso } from '../../services/quejasApelaciones.service';
import { Seccion, Segmentado } from './comun';
import { MESES, fmtDay } from './reglas';
import { exportarDashboardExcel } from './exportarExcel';

// Paleta categórica validada (dataviz: validate_palette.js, modo claro sobre #ffffff y oscuro sobre #1c1c1c).
// Cada entidad tiene su color fijo: Queja = serie 1, Apelación = serie 2, aunque se filtre por una sola.
// En modo claro las series 3-5 quedan bajo 3:1 de contraste: por eso hay leyenda y vista de tabla.
const ESTILOS = `
.qa-viz { --qa-s1:#2a78d6; --qa-s2:#eb6834; --qa-s3:#1baf7a; --qa-s4:#eda100; --qa-s5:#e87ba4; }
[data-theme='dark'] .qa-viz { --qa-s1:#3987e5; --qa-s2:#d95926; --qa-s3:#199e70; --qa-s4:#c98500; --qa-s5:#d55181; }`;
const SERIE = ['var(--qa-s1)', 'var(--qa-s2)', 'var(--qa-s3)', 'var(--qa-s4)', 'var(--qa-s5)'];
const EJE = { fontSize: 12, fill: 'var(--sc-muted-foreground)' };
const TOOLTIP = { borderRadius: 8, fontSize: 13, background: 'var(--sc-card)', border: '1px solid var(--sc-border)', color: 'var(--sc-foreground)' };

const FILTROS_TIPO = [{ value: 'todos', label: 'Todos' }, { value: 'queja', label: 'Quejas' }, { value: 'apelacion', label: 'Apelaciones' }];

function Kpi({ label, value, sub, tono, icono }: { label: string; value: string | number; sub?: string; tono?: 'destructive' | 'warning' | 'success'; icono?: React.ReactNode }) {
    return (
        <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={cn('mt-1 flex items-center gap-1.5 text-[28px] font-bold leading-tight text-foreground', tono === 'destructive' && 'text-destructive', tono === 'warning' && 'text-warning')}>
                {value}{icono}
            </p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
    );
}

/** Estado del plazo con ícono + texto (nunca solo color). */
function EstadoPlazo({ dias }: { dias: number | null }) {
    if (dias === null) return <span className="text-xs text-muted-foreground">Sin plazo</span>;
    if (dias < 0) return <Badge variant="destructive" className="gap-1"><IconAlertTriangle size={12} />Vencido hace {-dias} día{dias === -1 ? '' : 's'} háb.</Badge>;
    if (dias <= 3) return <Badge variant="warning" className="gap-1"><IconClockHour4 size={12} />{dias === 0 ? 'Vence hoy' : `Vence en ${dias} día${dias === 1 ? '' : 's'} háb.`}</Badge>;
    return <Badge variant="success" className="gap-1"><IconCircleCheck size={12} />{dias} días háb.</Badge>;
}

function Barras({ title, items, total }: { title: string; items: Breakdown[]; total: number }) {
    const max = Math.max(1, ...items.map((i) => i.total));
    return (
        <Seccion titulo={title}>
            {items.length ? (
                <ul className="flex flex-col gap-2">
                    {items.map((i) => (
                        <li key={i.value || i.label}>
                            <div className="flex justify-between gap-2 text-sm">
                                <span>{i.label}</span>
                                <span className="font-semibold">{i.total}{total > 0 && <span className="text-xs font-normal text-muted-foreground"> · {Math.round((i.total / total) * 100)}%</span>}</span>
                            </div>
                            <div className="h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${(i.total / max) * 100}%` }} /></div>
                        </li>
                    ))}
                </ul>
            ) : <p className="text-sm text-muted-foreground">Sin datos.</p>}
        </Seccion>
    );
}

export function DashboardQA({ onAbrirCaso }: { onAbrirCaso: (p: PlazoCaso) => void }) {
    const { showToast } = useToast();
    const [anio, setAnio] = useState(String(new Date().getFullYear()));
    const [tipo, setTipo] = useState<'todos' | TipoCaso>('todos');
    const [stats, setStats] = useState<Stats | null>(null);
    const [tablaMes, setTablaMes] = useState(false);
    const [tablaCausa, setTablaCausa] = useState(false);
    useEffect(() => {
        let vigente = true;
        api.estadistica(anio, tipo === 'todos' ? null : tipo)
            .then((s) => { if (vigente) setStats(s); })
            .catch((e) => showToast({ type: 'error', message: mensajeError(e, 'No se pudo cargar el dashboard') }));
        return () => { vigente = false; };
    }, [anio, tipo, showToast]);

    const seccion = tipo === 'queja' ? 'Quejas' : tipo === 'apelacion' ? 'Apelaciones' : 'Quejas y apelaciones';
    const filtros = (
        <div className="flex flex-wrap items-center gap-2">
            <Segmentado ariaLabel="Tipo" className="w-auto min-w-72" options={FILTROS_TIPO} value={tipo} onChange={(v) => setTipo(v as 'todos' | TipoCaso)} />
            <Select value={anio} onValueChange={setAnio}>
                <SelectTrigger className="w-28" aria-label="Año"><SelectValue /></SelectTrigger>
                <SelectContent>{(stats?.anios.length ? stats.anios : [Number(anio)]).map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" className="ml-auto" disabled={!stats} onClick={() => stats && exportarDashboardExcel(stats, seccion).catch(() => showToast({ type: 'error', message: 'No se pudo generar el Excel' }))}>
                <IconFileSpreadsheet size={16} />Excel (revisión por la dirección)
            </Button>
        </div>
    );
    if (!stats) return <div className="flex flex-col gap-4">{filtros}<p className="py-10 text-center text-sm text-muted-foreground">Cargando dashboard…</p></div>;

    // Series del gráfico mensual: solo las del tipo filtrado, cada una con su color fijo.
    const series = [
        { key: 'Queja', color: SERIE[0], ver: tipo !== 'apelacion' },
        { key: 'Apelación', color: SERIE[1], ver: tipo !== 'queja' },
    ].filter((s) => s.ver);
    const mes = stats.porMes.map((m) => ({ mes: MESES[m.mes - 1], Queja: m.queja, Apelación: m.apelacion }));
    const trend = stats.tendenciaCausas.map((r) => ({ ...r, mes: MESES[(r.mes as number) - 1] })) as Record<string, string | number>[];
    const conCausa = stats.porCausa.some((c) => c.value);
    const maxCarga = Math.max(1, ...stats.cargaResponsables.map((c) => c.abiertos));

    return (
        <div className="qa-viz flex flex-col gap-4">
            <style>{ESTILOS}</style>
            {filtros}

            <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hoy · casos abiertos de cualquier año</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    <Kpi label="Abiertos" value={stats.abiertosHoy} sub="En registro, evaluación o tratamiento" />
                    <Kpi label="Por vencer" value={stats.porVencer} sub="Plazo en 3 días hábiles o menos" tono={stats.porVencer ? 'warning' : undefined}
                        icono={stats.porVencer ? <IconClockHour4 size={18} aria-label="Atención" /> : undefined} />
                    <Kpi label="Vencidos" value={stats.vencidosHoy} sub="Fuera del plazo de respuesta" tono={stats.vencidosHoy ? 'destructive' : undefined}
                        icono={stats.vencidosHoy ? <IconAlertTriangle size={18} aria-label="Requiere atención" /> : undefined} />
                </div>
            </div>
            <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Año {stats.anio}</p>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Kpi label="Recibidos" value={stats.total} sub={stats.porTipo.filter((t) => tipo === 'todos' || t.value === tipo).map((t) => `${t.total} ${t.label.toLowerCase()}${t.total === 1 ? '' : 's'}`).join(' · ')} />
                    <Kpi label="Cerrados en plazo" value={stats.porcentajeEnPlazo === null ? '—' : `${stats.porcentajeEnPlazo}%`} sub={`${stats.cerradosEnPlazo} de ${stats.cerrados} cerrados`} />
                    <Kpi label="Días promedio al cierre" value={stats.diasPromedioCierre ?? '—'} sub={`Evaluación: ${stats.diasPromedioEvaluacion ?? '—'} días (corridos)`} />
                    <Kpi label="Procedentes" value={stats.procedentes} sub={`${stats.noProcedentes} no proceden · ${stats.sinEvaluar} sin evaluar`} />
                </div>
            </div>

            <Seccion titulo="Plazos de los casos abiertos" accion={<span className="text-xs text-muted-foreground">Pulsa un caso para abrirlo</span>}>
                {stats.plazos.length ? (
                    <div className="overflow-x-auto rounded-md border border-border">
                        <Table className="min-w-[720px]">
                            <TableHeader><TableRow><TableHead>N°</TableHead><TableHead>Tipo</TableHead><TableHead>Empresa</TableHead><TableHead>Responsable</TableHead><TableHead>Estado</TableHead><TableHead>Plazo</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {stats.plazos.map((p) => (
                                    <TableRow key={p.id} tabIndex={0} className="cursor-pointer" onClick={() => onAbrirCaso(p)} onKeyDown={(e) => { if (e.key === 'Enter') onAbrirCaso(p); }}>
                                        <TableCell className="font-mono text-sm font-bold text-primary">{p.folio}</TableCell>
                                        <TableCell className="text-sm">{p.tipoLabel}</TableCell>
                                        <TableCell className="text-sm">{p.empresa}</TableCell>
                                        <TableCell className="text-sm">{p.responsable || <span className="text-muted-foreground">Sin responsable</span>}</TableCell>
                                        <TableCell className="text-sm">{p.estadoLabel}</TableCell>
                                        <TableCell><span className="mr-2 text-sm">{fmtDay(p.plazo_vence)}</span><EstadoPlazo dias={p.diasHabiles} /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : <p className="text-sm text-muted-foreground">No hay casos abiertos.</p>}
            </Seccion>

            <div className="grid gap-4 xl:grid-cols-2">
                <Seccion titulo={`Recibidos por mes · ${stats.anio}`} accion={<Button size="sm" variant="ghost" onClick={() => setTablaMes((s) => !s)}>{tablaMes ? 'Ver gráfico' : 'Ver tabla'}</Button>}>
                    {tablaMes ? (
                        <div className="overflow-x-auto rounded-md border border-border">
                            <Table>
                                <TableHeader><TableRow><TableHead>Mes</TableHead>{series.map((s) => <TableHead key={s.key}>{s.key === 'Queja' ? 'Quejas' : 'Apelaciones'}</TableHead>)}</TableRow></TableHeader>
                                <TableBody>{mes.map((d) => <TableRow key={d.mes}><TableCell>{d.mes}</TableCell>{series.map((s) => <TableCell key={s.key}>{d[s.key as 'Queja' | 'Apelación']}</TableCell>)}</TableRow>)}</TableBody>
                            </Table>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={mes} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="30%">
                                <CartesianGrid vertical={false} stroke="var(--sc-border)" />
                                <XAxis dataKey="mes" tickLine={false} axisLine={{ stroke: 'var(--sc-border)' }} tick={EJE} />
                                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={EJE} />
                                <Tooltip cursor={{ fill: 'var(--sc-muted)', opacity: 0.5 }} contentStyle={TOOLTIP} />
                                {series.length > 1 && <Legend wrapperStyle={{ fontSize: 13 }} />}
                                {series.map((s, i) => (
                                    <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color} stroke="var(--sc-card)" strokeWidth={2} maxBarSize={28}
                                        radius={i === series.length - 1 ? [4, 4, 0, 0] : undefined} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Seccion>
                <Seccion titulo={`Tendencia por causa · ${stats.anio}`} accion={conCausa && <Button size="sm" variant="ghost" onClick={() => setTablaCausa((s) => !s)}>{tablaCausa ? 'Ver gráfico' : 'Ver tabla'}</Button>}>
                    {!conCausa ? <p className="text-sm text-muted-foreground">Aún no hay casos con causa clasificada este año.</p> : tablaCausa ? (
                        <div className="overflow-x-auto rounded-md border border-border">
                            <Table className="min-w-[480px]">
                                <TableHeader><TableRow><TableHead>Mes</TableHead>{stats.causasTendencia.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
                                <TableBody>{trend.map((r) => <TableRow key={String(r.mes)}><TableCell>{r.mes}</TableCell>{stats.causasTendencia.map((c) => <TableCell key={c}>{r[c]}</TableCell>)}</TableRow>)}</TableBody>
                            </Table>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <LineChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                <CartesianGrid vertical={false} stroke="var(--sc-border)" />
                                <XAxis dataKey="mes" tickLine={false} axisLine={{ stroke: 'var(--sc-border)' }} tick={EJE} />
                                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={EJE} />
                                <Tooltip contentStyle={TOOLTIP} />
                                <Legend wrapperStyle={{ fontSize: 13 }} />
                                {stats.causasTendencia.map((c, i) => (
                                    <Line key={c} type="monotone" dataKey={c} stroke={SERIE[i % SERIE.length]} strokeWidth={2}
                                        dot={{ r: 4, strokeWidth: 2, stroke: 'var(--sc-card)' }} activeDot={{ r: 5 }} />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </Seccion>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <Seccion titulo="Carga por responsable" className="lg:col-span-1">
                    {stats.cargaResponsables.length ? (
                        <ul className="flex flex-col gap-2">
                            {stats.cargaResponsables.map((c) => (
                                <li key={c.responsable}>
                                    <div className="flex justify-between gap-2 text-sm">
                                        <span className={cn(c.responsable === 'Sin responsable' && 'text-muted-foreground')}>{c.responsable}</span>
                                        <span className="font-semibold">{c.abiertos}{c.vencidos > 0 && <span className="ml-1 text-xs font-normal text-destructive">· {c.vencidos} vencido{c.vencidos === 1 ? '' : 's'}</span>}</span>
                                    </div>
                                    <div className="h-1.5 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${(c.abiertos / maxCarga) * 100}%` }} /></div>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-sm text-muted-foreground">Sin casos abiertos.</p>}
                </Seccion>
                <Barras title="Por causa" items={stats.porCausa} total={stats.total} />
                <Barras title="Por estado" items={stats.porEstado} total={stats.total} />
                <Barras title="Presentada por" items={stats.porEmisor} total={stats.total} />
                <Barras title="Por vía de ingreso" items={stats.porVia} total={stats.total} />
                <Barras title="Por origen" items={stats.porOrigen} total={stats.total} />
            </div>
            <p className="text-xs text-muted-foreground">
                Indicadores para la revisión por la dirección (NCh-ISO/IEC 17025 cl. 8.9) y la auditoría interna (cl. 8.8). Incluye los casos recibidos por la web y los registrados en ADL-One o en el panel de ADLWeb.
            </p>
        </div>
    );
}
