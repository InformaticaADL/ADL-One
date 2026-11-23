import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ComposedChart, Line,
} from 'recharts';
import { IconRefresh, IconX, IconCalendarEvent, IconCalendarWeek, IconAlertTriangle, IconClockPlay, IconChecklist, IconArrowBackUp } from '@tabler/icons-react';

import { fichaService } from '../services/ficha.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useNavStore } from '../../../store/navStore';
import { useFichasFiltersStore } from '../store/fichasFiltersStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface Props {
  onBack: () => void;
}

// ───────── Tipos ─────────
interface FilaAgenda {
  id_agenda: number; id_ficha: number; punto: string | null; id_grupo: number | null; correlativo: string;
  fecha: string; fecha_retiro: string | null; id_muestreador: number; muestreador: string | null;
  centro: string | null; empresa_servicio: string | null; programa: string | null; tipo_ficha: string | null;
  id_estadomuestreo: number | null; instalacion_completado: string | null; retiro_completado: string | null;
  realizado_por_gem: string | null; estado_caso: string | null;
}
interface Etapa { etapa: string; visitas: number; puntos: number; dias_mas_antigua: number | null }
interface Visita {
  key: string; fecha: string; muestreador: string; centro: string; empresa: string; programa: string;
  puntos: number; hechos: number; realizada: boolean; noRealizada: boolean; diasAtraso: number;
}

const COLOR = { realizada: 'var(--sc-success)', pendiente: 'var(--sc-warning)', noRealizada: 'var(--sc-destructive)', agendada: 'var(--sc-primary)' };
const marcado = (v: unknown) => v === true || v === 1 || ['S', 'SI', '1', 'TRUE'].includes(String(v ?? '').trim().toUpperCase());
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sumarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const lunesDe = (d: Date) => sumarDias(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
const limpio = (s: string | null | undefined, vacio: string) => (s || '').trim() || vacio;
const tooltipStyle = { borderRadius: 10, border: '1px solid var(--sc-border)', backgroundColor: 'var(--sc-card)' };

const ETAPAS_ORDEN: { clave: string; titulo: string; ayuda: string }[] = [
  { clave: 'tecnica', titulo: 'Validación técnica', ayuda: 'Fichas que esperan al Área Técnica' },
  { clave: 'coordinacion', titulo: 'Validación coordinación', ayuda: 'Aprobadas por Técnica, esperan a Coordinación' },
  { clave: 'programacion', titulo: 'Por programar', ayuda: 'Aprobadas, sin fecha ni muestreador' },
  { clave: 'terreno', titulo: 'En terreno', ayuda: 'Con servicios agendados o en ejecución' },
];

// Un servicio ejecutado: terminado, o con instalación completada si es puntual / con instalación y retiro si es compuesta.
const ejecutada = (f: FilaAgenda) =>
  f.id_estadomuestreo === 3 || marcado(f.realizado_por_gem)
  || (marcado(f.instalacion_completado) && (String(f.tipo_ficha || '').toLowerCase() === 'puntual' || marcado(f.retiro_completado)));
const cancelada = (f: FilaAgenda) => String(f.estado_caso || '').toUpperCase().includes('CANCELAD');

/** Agrupa los servicios en visitas: mismo grupo, día y número de servicio; una ficha suelta es una visita. */
function armarVisitas(filas: FilaAgenda[], hoy: string): Visita[] {
  const mapa = new Map<string, FilaAgenda[]>();
  filas.filter((f) => !cancelada(f)).forEach((f) => {
    const servicio = String(f.correlativo || '').split('-')[1] || '';
    const clave = `${f.id_grupo ? `g${f.id_grupo}-${servicio}` : `a${f.id_agenda}`}|${f.fecha}`;
    mapa.set(clave, [...(mapa.get(clave) || []), f]);
  });
  return [...mapa.entries()].map(([key, fs]) => {
    const hechos = fs.filter(ejecutada).length;
    const realizada = hechos === fs.length;
    const fecha = fs[0].fecha;
    const noRealizada = !realizada && fecha < hoy;
    const dias = noRealizada ? Math.round((new Date(hoy + 'T00:00:00').getTime() - new Date(fecha + 'T00:00:00').getTime()) / 86400000) : 0;
    return {
      key, fecha, muestreador: limpio(fs[0].muestreador, 'Sin asignar'), centro: limpio(fs[0].centro, 'Sin centro'),
      empresa: limpio(fs[0].empresa_servicio, 'Sin empresa'), programa: limpio(fs[0].programa, 'Sin programa'),
      puntos: fs.length, hechos, realizada, noRealizada, diasAtraso: dias,
    };
  });
}

function Kpi({ icono, titulo, valor, detalle, color, onClick, ayuda }: {
  icono: React.ReactNode; titulo: string; valor: React.ReactNode; detalle?: React.ReactNode; color?: string; onClick?: () => void; ayuda?: string;
}) {
  const Tag: any = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={ayuda}
      className={cn('flex flex-col gap-1 rounded-xl border border-border bg-card p-4 text-left', onClick && 'transition-colors hover:border-primary hover:bg-primary/5')}
    >
      <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground" style={color ? { color } : undefined}>{icono}{titulo}</span>
      <span className="text-3xl font-extrabold leading-none tracking-tight text-foreground">{valor}</span>
      {detalle && <span className="text-xs text-muted-foreground">{detalle}</span>}
    </Tag>
  );
}

function Seccion({ titulo, subtitulo, children, className }: { titulo: string; subtitulo?: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn('rounded-xl p-5', className)}>
      <div className="mb-3">
        <h4 className="m-0 text-base font-semibold">{titulo}</h4>
        {subtitulo && <p className="m-0 text-xs text-muted-foreground">{subtitulo}</p>}
      </div>
      {children}
    </Card>
  );
}

export const CoordinacionDashboardView: React.FC<Props> = ({ onBack }) => {
  const setFichasMode = useNavStore((s) => s.setFichasMode);
  const setCalendario = useFichasFiltersStore((s) => s.setCalendario);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [agenda, setAgenda] = useState<FilaAgenda[]>([]);
  const [actualizado, setActualizado] = useState<Date | null>(null);

  const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes' | 'trimestre'>('semana');
  const [fPrograma, setFPrograma] = useState('');
  const [fEmpresa, setFEmpresa] = useState('');
  const [fMuestreador, setFMuestreador] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const r = await fichaService.getDashboardOperativo();
      setEtapas(r?.etapas ?? []);
      setAgenda(r?.agenda ?? []);
      setActualizado(new Date());
    } catch (e: any) {
      setError(e?.response?.data?.message || 'No se pudo cargar el dashboard.');
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  // Se refresca solo cada 2 minutos mientras está abierto.
  useEffect(() => { const t = setInterval(cargar, 120000); return () => clearInterval(t); }, [cargar]);

  const hoyDate = useMemo(() => new Date(), [actualizado]); // eslint-disable-line react-hooks/exhaustive-deps
  const hoy = ymd(hoyDate);

  // Filtros de programa / empresa / muestreador aplicados a los servicios
  const filas = useMemo(() => agenda.filter((f) =>
    (!fPrograma || limpio(f.programa, 'Sin programa') === fPrograma)
    && (!fEmpresa || limpio(f.empresa_servicio, 'Sin empresa') === fEmpresa)
    && (!fMuestreador || limpio(f.muestreador, 'Sin asignar') === fMuestreador)), [agenda, fPrograma, fEmpresa, fMuestreador]);
  const visitas = useMemo(() => armarVisitas(filas, hoy), [filas, hoy]);

  const opciones = useMemo(() => {
    const u = (f: (x: FilaAgenda) => string) => Array.from(new Set(agenda.map(f))).sort((a, b) => a.localeCompare(b)).map((v) => ({ value: v, label: v }));
    return {
      programas: u((x) => limpio(x.programa, 'Sin programa')),
      empresas: u((x) => limpio(x.empresa_servicio, 'Sin empresa')),
      muestreadores: u((x) => limpio(x.muestreador, 'Sin asignar')),
    };
  }, [agenda]);

  // Rango del período elegido
  const [desde, hasta] = useMemo(() => {
    if (periodo === 'hoy') return [hoy, hoy];
    if (periodo === 'semana') { const l = lunesDe(hoyDate); return [ymd(l), ymd(sumarDias(l, 6))]; }
    if (periodo === 'mes') return [ymd(new Date(hoyDate.getFullYear(), hoyDate.getMonth(), 1)), ymd(new Date(hoyDate.getFullYear(), hoyDate.getMonth() + 1, 0))];
    return [ymd(sumarDias(hoyDate, -90)), ymd(sumarDias(hoyDate, 45))];
  }, [periodo, hoy, hoyDate]);
  const delPeriodo = useMemo(() => visitas.filter((v) => v.fecha >= desde && v.fecha <= hasta), [visitas, desde, hasta]);

  // ───────── KPIs ─────────
  const hoyV = visitas.filter((v) => v.fecha === hoy);
  const lunes = ymd(lunesDe(hoyDate)), domingo = ymd(sumarDias(lunesDe(hoyDate), 6));
  const semanaV = visitas.filter((v) => v.fecha >= lunes && v.fecha <= domingo);
  const noRealizadas = visitas.filter((v) => v.noRealizada).sort((a, b) => b.diasAtraso - a.diasAtraso);
  const etapa = (c: string) => etapas.find((e) => e.etapa === c);
  const porValidar = (etapa('tecnica')?.visitas || 0) + (etapa('coordinacion')?.visitas || 0);
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  // ───────── Tablas y gráficos ─────────
  const cargaMuestreadores = useMemo(() => {
    const m = new Map<string, { nombre: string; visitas: number; realizadas: number; noRealizadas: number; proximas: number }>();
    delPeriodo.forEach((v) => {
      const x = m.get(v.muestreador) || { nombre: v.muestreador, visitas: 0, realizadas: 0, noRealizadas: 0, proximas: 0 };
      x.visitas++;
      if (v.realizada) x.realizadas++; else if (v.noRealizada) x.noRealizadas++; else x.proximas++;
      m.set(v.muestreador, x);
    });
    return [...m.values()].sort((a, b) => b.visitas - a.visitas);
  }, [delPeriodo]);
  const maxCarga = Math.max(1, ...cargaMuestreadores.map((c) => c.visitas));

  const porPrograma = useMemo(() => {
    const m = new Map<string, { programa: string; Realizadas: number; Pendientes: number; 'No realizadas': number }>();
    delPeriodo.forEach((v) => {
      const x = m.get(v.programa) || { programa: v.programa, Realizadas: 0, Pendientes: 0, 'No realizadas': 0 };
      if (v.realizada) x.Realizadas++; else if (v.noRealizada) x['No realizadas']++; else x.Pendientes++;
      m.set(v.programa, x);
    });
    return [...m.values()].sort((a, b) => (b.Realizadas + b.Pendientes + b['No realizadas']) - (a.Realizadas + a.Pendientes + a['No realizadas'])).slice(0, 8);
  }, [delPeriodo]);

  const tendencia = useMemo(() => {
    const semanas: { semana: string; Agendadas: number; Realizadas: number }[] = [];
    const base = lunesDe(hoyDate);
    for (let i = 7; i >= 0; i--) {
      const ini = sumarDias(base, -7 * i), fin = sumarDias(ini, 6);
      const v = visitas.filter((x) => x.fecha >= ymd(ini) && x.fecha <= ymd(fin));
      semanas.push({ semana: ini.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }), Agendadas: v.length, Realizadas: v.filter((x) => x.realizada).length });
    }
    return semanas;
  }, [visitas, hoyDate]);

  const verNoRealizadas = () => {
    setCalendario({ selectedEmpresa: fEmpresa, selectedMuestreador: fMuestreador, selectedCentro: '', selectedPrograma: fPrograma, selectedEstado: 'no_realizada', searchTerm: '' });
    setFichasMode('calendar');
  };
  const chips = ([
    fPrograma && ['Programa', fPrograma, () => setFPrograma('')],
    fEmpresa && ['Empresa', fEmpresa, () => setFEmpresa('')],
    fMuestreador && ['Muestreador', fMuestreador, () => setFMuestreador('')],
  ].filter(Boolean) as [string, string, () => void][]);

  const maxEtapa = Math.max(1, ...ETAPAS_ORDEN.map((e) => etapa(e.clave)?.visitas || 0));
  const nombrePeriodo = { hoy: 'hoy', semana: 'esta semana', mes: 'este mes', trimestre: 'los últimos 90 días y próximos 45' }[periodo];

  return (
    <div className="shadcn-scope">
      <PageHeader
        title="Dashboard Operativo"
        subtitle="La operación en visitas: qué se hizo, qué falta y dónde se atasca"
        onBack={onBack}
        breadcrumbItems={[{ label: 'Fichas de Ingreso', onClick: onBack }, { label: 'Dashboard Operativo' }]}
        rightSection={
          <div className="flex items-center gap-2">
            {actualizado && <span className="hidden text-xs text-muted-foreground sm:inline">Actualizado {actualizado.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>}
            <Button variant="outline" onClick={cargar} disabled={cargando}><IconRefresh size={16} className={cn(cargando && 'animate-spin')} /> Actualizar</Button>
          </div>
        }
      />

      {error && <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {/* Filtros */}
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as typeof periodo)}>
          <TabsList>
            <TabsTrigger value="hoy">Hoy</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mes</TabsTrigger>
            <TabsTrigger value="trimestre">90 días</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="w-52"><Combobox placeholder="Programa: todos" options={opciones.programas} value={fPrograma} onValueChange={(v) => setFPrograma(v || '')} /></div>
        <div className="w-60"><Combobox placeholder="Empresa: todas" options={opciones.empresas} value={fEmpresa} onValueChange={(v) => setFEmpresa(v || '')} /></div>
        <div className="w-52"><Combobox placeholder="Muestreador: todos" options={opciones.muestreadores} value={fMuestreador} onValueChange={(v) => setFMuestreador(v || '')} /></div>
      </div>
      {chips.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Filtrando por:</span>
          {chips.map(([etiqueta, valor, quitar]) => (
            <span key={etiqueta} className="inline-flex max-w-[260px] items-center gap-1 rounded-full border border-primary/40 bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs">
              <span className="text-muted-foreground">{etiqueta}:</span><strong className="truncate" title={valor}>{valor}</strong>
              <button type="button" aria-label={`Quitar el filtro ${etiqueta}`} onClick={quitar} className="rounded-full p-0.5 hover:bg-primary/20"><IconX size={12} /></button>
            </span>
          ))}
          {chips.length > 1 && <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => { setFPrograma(''); setFEmpresa(''); setFMuestreador(''); }}>Limpiar todos</Button>}
        </div>
      )}

      {/* Indicadores */}
      <div className="mb-5 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))' }}>
        <Kpi icono={<IconCalendarEvent size={15} />} titulo="Visitas hoy" valor={hoyV.length}
          detalle={hoyV.length ? `${hoyV.filter((v) => v.realizada).length} realizadas · ${hoyV.filter((v) => !v.realizada).length} por hacer` : 'Sin visitas hoy'} />
        <Kpi icono={<IconCalendarWeek size={15} />} titulo="Esta semana" valor={semanaV.length}
          detalle={semanaV.length ? `${pct(semanaV.filter((v) => v.realizada).length, semanaV.length)}% realizadas (${semanaV.filter((v) => v.realizada).length} de ${semanaV.length})` : 'Sin visitas'} />
        <Kpi icono={<IconAlertTriangle size={15} />} titulo="No realizadas" color={noRealizadas.length ? COLOR.noRealizada : undefined} valor={noRealizadas.length}
          detalle={noRealizadas.length ? `La más antigua: ${noRealizadas[0].diasAtraso} días` : 'Todo al día'}
          onClick={noRealizadas.length ? verNoRealizadas : undefined} ayuda="Visitas con fecha pasada que no se ejecutaron ni se cancelaron. Clic para verlas en el calendario." />
        <Kpi icono={<IconClockPlay size={15} />} titulo="Por programar" valor={etapa('programacion')?.visitas ?? 0}
          detalle={etapa('programacion')?.dias_mas_antigua != null ? `La más antigua: ${etapa('programacion')!.dias_mas_antigua} días` : undefined}
          onClick={() => setFichasMode('list_assign')} ayuda="Visitas aprobadas que esperan fecha y muestreador. Clic para ir a Asignación." />
        <Kpi icono={<IconChecklist size={15} />} titulo="Por validar" valor={porValidar}
          detalle={`${etapa('tecnica')?.visitas ?? 0} en Técnica · ${etapa('coordinacion')?.visitas ?? 0} en Coordinación`}
          onClick={() => setFichasMode('list_fichas')} ayuda="Visitas que esperan validación. Clic para ir al explorador." />
        <Kpi icono={<IconArrowBackUp size={15} />} titulo="Rechazadas" valor={etapa('rechazada')?.visitas ?? 0}
          detalle="Devueltas a Comercial para corregir" onClick={() => setFichasMode('list_fichas')} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        {/* Embudo */}
        <Seccion titulo="Dónde está el trabajo" subtitulo="Visitas por etapa, hoy. Muestra dónde se acumula.">
          <div className="flex flex-col gap-3">
            {ETAPAS_ORDEN.map((e) => {
              const d = etapa(e.clave);
              const n = d?.visitas || 0;
              return (
                <div key={e.clave} title={e.ayuda}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-medium">{e.titulo}</span>
                    <span><strong>{n}</strong> <span className="text-xs text-muted-foreground">{n === 1 ? 'visita' : 'visitas'}{d?.puntos ? ` · ${d.puntos} puntos` : ''}</span></span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded bg-muted">
                    <div className="h-full rounded" style={{ width: `${Math.max(n ? 2 : 0, Math.round((n / maxEtapa) * 100))}%`, backgroundColor: e.clave === 'terreno' ? COLOR.agendada : COLOR.pendiente }} />
                  </div>
                  {d?.dias_mas_antigua != null && n > 0 && <span className="text-[11px] text-muted-foreground">La más antigua lleva {d.dias_mas_antigua} {d.dias_mas_antigua === 1 ? 'día' : 'días'}</span>}
                </div>
              );
            })}
          </div>
        </Seccion>

        {/* Tendencia */}
        <Seccion titulo="Últimas 8 semanas" subtitulo="Visitas agendadas y visitas realizadas por semana">
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={tendencia} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--sc-border)" />
                <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Agendadas" fill={COLOR.agendada} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="Realizadas" stroke={COLOR.realizada} strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Seccion>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        {/* Carga por muestreador */}
        <Seccion titulo="Carga por muestreador" subtitulo={`Visitas ${nombrePeriodo}`}>
          {cargaMuestreadores.length === 0 ? <p className="m-0 text-sm text-muted-foreground">Sin visitas en el período.</p> : (
            <div className="max-h-[320px] overflow-y-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="text-left text-xs font-medium text-muted-foreground">
                    <th className="py-1.5 pr-2">Muestreador</th><th className="px-2 py-1.5">Carga</th>
                    <th className="px-2 py-1.5 text-right">Visitas</th><th className="px-2 py-1.5 text-right">Realiz.</th><th className="py-1.5 pl-2 text-right">Sin realizar</th>
                  </tr>
                </thead>
                <tbody>
                  {cargaMuestreadores.map((c) => (
                    <tr key={c.nombre} className="border-t border-border">
                      <td className="py-1.5 pr-2 font-medium">{c.nombre}</td>
                      <td className="min-w-[90px] px-2 py-1.5">
                        <div className="flex h-2 w-full overflow-hidden rounded bg-muted" title={`${c.realizadas} realizadas · ${c.proximas} por hacer · ${c.noRealizadas} no realizadas`}>
                          <div style={{ width: `${(c.realizadas / maxCarga) * 100}%`, backgroundColor: COLOR.realizada }} />
                          <div style={{ width: `${(c.proximas / maxCarga) * 100}%`, backgroundColor: COLOR.pendiente }} />
                          <div style={{ width: `${(c.noRealizadas / maxCarga) * 100}%`, backgroundColor: COLOR.noRealizada }} />
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{c.visitas}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{c.realizadas}</td>
                      <td className="py-1.5 pl-2 text-right tabular-nums" style={c.noRealizadas ? { color: COLOR.noRealizada, fontWeight: 600 } : undefined}>{c.noRealizadas || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Seccion>

        {/* Por programa */}
        <Seccion titulo="Por programa" subtitulo={`Visitas ${nombrePeriodo}, según su estado`}>
          {porPrograma.length === 0 ? <p className="m-0 text-sm text-muted-foreground">Sin visitas en el período.</p> : (
            <div style={{ height: Math.max(180, porPrograma.length * 38 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porPrograma} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--sc-border)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="programa" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Realizadas" stackId="a" fill={COLOR.realizada} />
                  <Bar dataKey="Pendientes" stackId="a" fill={COLOR.pendiente} />
                  <Bar dataKey="No realizadas" stackId="a" fill={COLOR.noRealizada} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Seccion>
      </div>

      {/* Requiere atención */}
      <Seccion titulo="Requiere atención" subtitulo="Visitas que no se realizaron en su fecha, de la más atrasada a la más reciente" className="mb-6">
        {noRealizadas.length === 0 ? (
          <p className="m-0 text-sm text-muted-foreground">No hay visitas atrasadas. Todo lo agendado y vencido se realizó o se canceló.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="text-left text-xs font-medium text-muted-foreground">
                    <th className="py-1.5 pr-3">Centro</th><th className="px-3 py-1.5">Programa</th><th className="px-3 py-1.5">Muestreador</th>
                    <th className="px-3 py-1.5">Fecha</th><th className="px-3 py-1.5 text-right">Atraso</th><th className="py-1.5 pl-3 text-right">Avance</th>
                  </tr>
                </thead>
                <tbody>
                  {noRealizadas.slice(0, 8).map((v) => (
                    <tr key={v.key} className="border-t border-border">
                      <td className="py-1.5 pr-3"><span className="block font-semibold">{v.centro}</span><span className="block text-xs text-muted-foreground">{v.empresa}</span></td>
                      <td className="px-3 py-1.5">{v.programa}</td>
                      <td className="px-3 py-1.5">{v.muestreador}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{v.fecha.split('-').reverse().join('-')}</td>
                      <td className="px-3 py-1.5 text-right"><Badge variant="secondary" style={{ backgroundColor: COLOR.noRealizada, color: 'var(--sc-destructive-foreground)' }}>{v.diasAtraso} {v.diasAtraso === 1 ? 'día' : 'días'}</Badge></td>
                      <td className="py-1.5 pl-3 text-right tabular-nums text-muted-foreground">{v.hechos} de {v.puntos} puntos</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{noRealizadas.length > 8 ? `Mostrando 8 de ${noRealizadas.length}.` : `${noRealizadas.length} ${noRealizadas.length === 1 ? 'visita' : 'visitas'}.`} Se pueden reagendar, dejar pendientes o cancelar desde el calendario.</span>
              <Button size="sm" onClick={verNoRealizadas}>Verlas en el calendario</Button>
            </div>
          </>
        )}
      </Seccion>
    </div>
  );
};
