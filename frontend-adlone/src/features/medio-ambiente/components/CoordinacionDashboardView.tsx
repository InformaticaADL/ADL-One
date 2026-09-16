import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts';
import {
  IconChevronLeft, IconX, IconBuilding, IconMapPin, IconUsers, IconInfoCircle, IconPlayerPauseFilled, IconPlayerPlayFilled, IconClock
} from '@tabler/icons-react';
import { fichaService } from '../services/ficha.service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Timeline } from '@/components/ui/timeline';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Props {
  onBack: () => void;
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280', '#ec4899', '#14b8a6'];

const normalize = (s: string) =>
    (s || '').normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Tarjeta base compartida por todos los widgets del dashboard.
function DashCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn('relative h-full rounded-[20px] p-6', className)}>
      {children}
    </Card>
  );
}

const tooltipStyle = { borderRadius: 12, border: '1px solid var(--sc-border)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--sc-card)' };

const dateToInputValue = (d: Date | null) => {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const CoordinacionDashboardView: React.FC<Props> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [operationalEvents, setOperationalEvents] = useState<any[]>([]);
  const [muestreadores, setMuestreadores] = useState<any[]>([]);
  const [estados, setEstados] = useState<any[]>([]);

  const [filterMuestreador, setFilterMuestreador] = useState<string | null>(null);
  const [filterEstado, setFilterEstado] = useState<string | null>(null);
  const [filterEmpresaServicio, setFilterEmpresaServicio] = useState<string | null>(null);
  const [filterCentro, setFilterCentro] = useState<string | null>(null);
  const [filterObjetivo, setFilterObjetivo] = useState<string | null>(null);
  const [filterSubArea, setFilterSubArea] = useState<string | null>(null);
  const [filterDateFrom, setFilterDateFrom] = useState<Date | null>(null);
  const [filterDateTo, setFilterDateTo] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<string>('operativa');
  const [infoModal, setInfoModal] = useState<{ title: string, definition: string, operation: string, data: string } | null>(null);

  const [empresasServicio, setEmpresasServicio] = useState<any[]>([]);
  const [centros, setCentros] = useState<any[]>([]);
  const [objetivos, setObjetivos] = useState<any[]>([]);
  const [subAreas, setSubAreas] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [fichasRes, opRes] = await Promise.all([
          fichaService.getAll(),
          fichaService.getEnProceso()
        ]);

        let fichas = [];
        if (Array.isArray(fichasRes)) fichas = fichasRes;
        else if ((fichasRes as any)?.data && Array.isArray((fichasRes as any).data)) fichas = (fichasRes as any).data;
        else if ((fichasRes as any)?.recordset && Array.isArray((fichasRes as any).recordset)) fichas = (fichasRes as any).recordset;

        let events = [];
        if (Array.isArray(opRes)) events = opRes;
        else if ((opRes as any)?.data && Array.isArray((opRes as any).data)) events = (opRes as any).data;
        else if ((opRes as any)?.recordset && Array.isArray((opRes as any).recordset)) events = (opRes as any).recordset;

        setOperationalEvents(events || []);

        const enriched: any[] = [];
        const eventFichaIds = new Set();

        (events || []).forEach((e: any) => {
          const fichaId = e.id_fichaingresoservicio || e.fichaingresoservicio || e.id;
          eventFichaIds.add(String(fichaId));
          const parentFicha = (fichas || []).find((f: any) => String(f.id_fichaingresoservicio || f.id || f.fichaingresoservicio) === String(fichaId));

          enriched.push({
            ...(parentFicha || {}),
            ...e,
            _muestreador_name: (e.muestreador || e.nombre_muestreador || 'No Asignado').trim(),
            _status_name: (e.nombre_estadomuestreo || parentFicha?.estado_ficha || 'En Proceso').trim(),
            _fecha: e.fecha || e.fecha_muestreo || parentFicha?.fecha || null,
            _id_ficha: fichaId,
            _empresa_servicio_name: (e.empresa_servicio || e.nombre_empresaservicios || parentFicha?.empresa_servicio || parentFicha?.nombre_empresaservicios || 'Otros').trim(),
            _centro_name: (e.centro || e.nombre_centro || parentFicha?.centro || parentFicha?.nombre_centro || 'Otros').trim(),
            _objetivo_name: (e.objetivo || e.nombre_objetivo || parentFicha?.objetivo || parentFicha?.nombre_objetivo || 'Otro').trim(),
            _subarea_name: (e.subarea || e.nombre_subarea || parentFicha?.subarea || parentFicha?.nombre_subarea || 'Global').trim()
          });
        });

        (fichas || []).forEach((f: any) => {
          const fichaId = f.id_fichaingresoservicio || f.id || f.fichaingresoservicio;
          if (!eventFichaIds.has(String(fichaId))) {
            enriched.push({
              ...f,
              _muestreador_name: (f.muestreador || f.nombre_muestreador || 'No Asignado').trim(),
              _status_name: (f.estado_ficha || f.nombre_estadomuestreo || 'Pendiente Programar').trim(),
              _fecha: f.fecha || null,
              _id_ficha: fichaId,
              _empresa_servicio_name: (f.empresa_servicio || f.nombre_empresaservicios || 'Otros').trim(),
              _centro_name: (f.centro || f.nombre_centro || 'Otros').trim(),
              _objetivo_name: (f.objetivo || f.nombre_objetivo || 'Otro').trim(),
              _subarea_name: (f.subarea || f.nombre_subarea || 'Global').trim()
            });
          }
        });

        setData(enriched);

        const uniqueMuentreadores = new Map();
        const uniqueEstados = new Map();
        const uniqueEmpresas = new Map();
        const uniqueObjetivos = new Map();
        const uniqueSubAreas = new Map();
        const uniqueCentros = new Map();

        enriched.forEach((f: any) => {
          if (f._muestreador_name && f._muestreador_name !== 'No Asignado') uniqueMuentreadores.set(f._muestreador_name, { label: f._muestreador_name, value: f._muestreador_name });
          if (f._status_name && f._status_name !== 'Sin Estado') uniqueEstados.set(f._status_name, { label: f._status_name, value: f._status_name });
          if (f._empresa_servicio_name && f._empresa_servicio_name !== 'Otros') uniqueEmpresas.set(f._empresa_servicio_name, { label: f._empresa_servicio_name, value: f._empresa_servicio_name });
          if (f._centro_name && f._centro_name !== 'Otros') uniqueCentros.set(f._centro_name + f._empresa_servicio_name, { label: f._centro_name, value: f._centro_name, empresa: f._empresa_servicio_name });
          if (f._objetivo_name && f._objetivo_name !== 'Otro') uniqueObjetivos.set(f._objetivo_name, { label: f._objetivo_name, value: f._objetivo_name });
          if (f._subarea_name && f._subarea_name !== 'Global' && f._subarea_name !== 'Otro') uniqueSubAreas.set(f._subarea_name, { label: f._subarea_name, value: f._subarea_name });
        });

        setMuestreadores(Array.from(uniqueMuentreadores.values()).sort((a,b) => a.label.localeCompare(b.label)));
        setEstados(Array.from(uniqueEstados.values()).sort((a,b) => a.label.localeCompare(b.label)));
        setEmpresasServicio(Array.from(uniqueEmpresas.values()).sort((a,b) => a.label.localeCompare(b.label)));
        setObjetivos(Array.from(uniqueObjetivos.values()).sort((a,b) => a.label.localeCompare(b.label)));
        setSubAreas(Array.from(uniqueSubAreas.values()).sort((a,b) => a.label.localeCompare(b.label)));
        setCentros(Array.from(uniqueCentros.values()).sort((a,b) => a.label.localeCompare(b.label)));

      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredData = useMemo(() => {
    const toISO = (d: any) => {
      if (!d) return '';
      if (typeof d === 'string' && d.includes('/')) {
        const parts = d.split('/');
        if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      try {
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return '';
        return dateObj.toISOString().split('T')[0];
      } catch { return ''; }
    };

    return data.filter(f => {
      if (filterEstado && f._status_name !== filterEstado) return false;
      if (filterMuestreador && f._muestreador_name !== filterMuestreador) return false;
      if (filterEmpresaServicio && f._empresa_servicio_name !== filterEmpresaServicio) return false;
      if (filterCentro && f._centro_name !== filterCentro) return false;
      if (filterObjetivo && f._objetivo_name !== filterObjetivo) return false;
      if (filterSubArea && f._subarea_name !== filterSubArea) return false;
      if (filterDateFrom || filterDateTo) {
        const rowDateStr = toISO(f._fecha || f.fecha || f.fecha_muestreo);
        if (!rowDateStr) return false;
        const rowDate = new Date(rowDateStr);
        if (filterDateFrom && rowDate < filterDateFrom) return false;
        if (filterDateTo && rowDate > filterDateTo) return false;
      }
      return true;
    });
  }, [data, filterEstado, filterMuestreador, filterEmpresaServicio, filterCentro, filterDateFrom, filterDateTo, filterObjetivo, filterSubArea]);

  const samplerAnalytics = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(f => { const m = f._muestreador_name || 'No Asignado'; counts[m] = (counts[m] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [filteredData]);

  const todayAgenda = useMemo(() => {
    const today = new Date();
    const tDia = today.getDate(), tMes = today.getMonth() + 1, tAno = today.getFullYear();
    const events: any[] = [];
    operationalEvents.forEach(f => {
      if (f.dia === tDia && f.mes === tMes && f.ano === tAno) {
        events.push({ ...f, tipo_display: 'INICIO', muestreador_display: f.muestreador || f.muestreador_instalacion || 'Sin Asignar' });
      }
      if (f.fecha_retiro && f.fecha_retiro !== '01/01/1900') {
        const dRetiro = new Date(f.fecha_retiro);
        if (dRetiro.getUTCDate() === tDia && (dRetiro.getUTCMonth() + 1) === tMes && dRetiro.getUTCFullYear() === tAno) {
          events.push({ ...f, tipo_display: 'RETIRO', muestreador_display: f.muestreador_retiro || f.muestreador || 'Sin Asignar' });
        }
      }
    });
    return events.slice(0, 10);
  }, [operationalEvents]);

  const statusAnalytics = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(f => { const status = f._status_name || 'Sin Estado'; counts[status] = (counts[status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filteredData]);

  const companyAnalytics = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(f => { const company = f._empresa_servicio_name || 'Otros'; counts[company] = (counts[company] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);
  }, [filteredData]);

  const objectiveAnalytics = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(f => { const obj = f._objetivo_name || 'Otro'; counts[obj] = (counts[obj] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 8);
  }, [filteredData]);

  const subAreaAnalytics = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(f => { const sub = f._subarea_name || f.subarea || 'Global'; counts[sub] = (counts[sub] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 8);
  }, [filteredData]);

  const centroAnalytics = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(f => { const centro = f._centro_name || 'Otros'; counts[centro] = (counts[centro] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 10);
  }, [filteredData]);

  const weekdayAnalytics = useMemo(() => {
    const counts = { 'Lunes': 0, 'Martes': 0, 'Miércoles': 0, 'Jueves': 0, 'Viernes': 0, 'Sábado': 0, 'Domingo': 0 };
    const dayMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    filteredData.forEach(f => {
      const dStr = f._fecha || f.fecha || f.fecha_muestreo;
      if (!dStr) return;
      let date = new Date(dStr);
      if (isNaN(date.getTime()) && typeof dStr === 'string' && dStr.includes('/')) {
        const [d, m, y] = dStr.split('/');
        date = new Date(`${y}-${m}-${d}`);
      }
      if (!isNaN(date.getTime())) {
        const dayName = dayMap[date.getDay()];
        if (counts[dayName as keyof typeof counts] !== undefined) counts[dayName as keyof typeof counts]++;
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredData]);

  const cancellationAnalytics = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(f => {
      if (normalize(f._status_name).includes('cancela') || normalize(f._status_name).includes('anulad')) {
        const motivo = (f.motivo_cancelacion || f.motivo_anulacion || 'Sin especificar').trim();
        counts[motivo] = (counts[motivo] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value).slice(0, 8);
  }, [filteredData]);

  const trendAnalytics = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for(let i=5; i>=0; i--) { months.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toLocaleString('es-ES', { month: 'short', year: '2-digit' })); }

    const monthlyData: Record<string, { name: string, ejecutados: number, pendientes: number }> = {};
    months.forEach(m => monthlyData[m] = { name: m, ejecutados: 0, pendientes: 0 });

    filteredData.forEach(f => {
      const dStr = f._fecha || f.fecha || f.fecha_muestreo;
      if (!dStr) return;
      let date = new Date(dStr);
      if (isNaN(date.getTime()) && typeof dStr === 'string' && dStr.includes('/')) {
        const [d, m, y] = dStr.split('/');
        date = new Date(`${y}-${m}-${d}`);
      }
      if (isNaN(date.getTime())) return;
      const label = date.toLocaleString('es-ES', { month: 'short', year: '2-digit' });
      if (monthlyData[label]) {
        if (normalize(f._status_name).includes('ejecutado')) monthlyData[label].ejecutados++;
        else monthlyData[label].pendientes++;
      }
    });
    return Object.values(monthlyData);
  }, [filteredData]);

  const [trendFilter, setTrendFilter] = useState('365');

  const dailyInOutTrend = useMemo(() => {
    const days: string[] = [];
    const now = new Date();
    const daysToSubtract = parseInt(trendFilter) - 1;
    for(let i=daysToSubtract; i>=0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        days.push(d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }));
    }

    const dailyData: Record<string, { name: string, inicios: number, retiros: number }> = {};
    days.forEach(d => dailyData[d] = { name: d, inicios: 0, retiros: 0 });

    operationalEvents.forEach(f => {
      if (f.fecha || f.fecha_muestreo) {
        let date = new Date(f.fecha || f.fecha_muestreo);
        if (isNaN(date.getTime()) && typeof (f.fecha || f.fecha_muestreo) === 'string' && (f.fecha || f.fecha_muestreo).includes('/')) {
            const [d, m, y] = (f.fecha || f.fecha_muestreo).split('/');
            date = new Date(`${y}-${m}-${d}`);
        }
        if (!isNaN(date.getTime())) {
            const label = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            if (dailyData[label]) dailyData[label].inicios++;
        }
      }
      if (f.fecha_retiro && f.fecha_retiro !== '01/01/1900') {
        let date = new Date(f.fecha_retiro);
        if (isNaN(date.getTime()) && typeof f.fecha_retiro === 'string' && f.fecha_retiro.includes('/')) {
            const [d, m, y] = f.fecha_retiro.split('/');
            date = new Date(`${y}-${m}-${d}`);
        }
        if (!isNaN(date.getTime())) {
            const label = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
            if (dailyData[label]) dailyData[label].retiros++;
        }
      }
    });
    return Object.values(dailyData);
  }, [operationalEvents, trendFilter]);

  const StatCard = ({ title, value, data }: { title: string, value: string | number, color: string, data?: any[] }) => (
    <DashCard>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold">{title}</span>
          <Badge variant="secondary">Filtrado</Badge>
        </div>
        <div className="flex items-end justify-between">
          <span className="text-[40px] font-extrabold leading-none">{value}</span>
          {data && (
             <div className="h-10 w-20">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={data}>
                      <Area type="monotone" dataKey="value" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.15} strokeWidth={2} />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
          )}
        </div>
      </div>
    </DashCard>
  );

  const InfoButton = ({ title, detail }: { title: string, detail: any }) => (
    <button
      onClick={() => setInfoModal({ title, ...detail })}
      className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground"
      title="Explicación detallada"
    >
      <IconInfoCircle size={16} />
    </button>
  );

  const chartExplanations: Record<string, { definition: string, operation: string, data: string }> = {
    'Carga Operativa': {
      definition: 'Muestra un desglose del volumen de trabajo actual asignado a cada recurso (ya sea técnico de terreno o cliente corporativo).',
      operation: 'Suma el número total de fichas (en todos los estados) vinculadas al recurso en el periodo temporal filtrado.',
      data: 'Permite identificar visualmente desbalances en la carga de trabajo (quién está saturado vs quién tiene capacidad) o qué cliente representa el mayor volumen actual.'
    },
    'Agenda para Hoy': {
      definition: 'Línea de tiempo cronológica de los hitos operativos que deben ocurrir en el día en curso.',
      operation: 'Cruza la fecha de hoy con las fechas programadas de INICIO y RETIRO de los muestreos en la base de datos.',
      data: 'Ayuda al coordinador a hacer seguimiento en tiempo real de las salidas a terreno y las llegadas de muestras al laboratorio.'
    },
    'Distribución Global': {
      definition: 'Vista panorámica porcentual que clasifica todo el trabajo filtrado en una categoría principal.',
      operation: 'Agrupa el volumen total según Estado (si estás en vista Operativa), Objetivo Comercial o Área Ambiental, y calcula su peso relativo.',
      data: 'Detecta rápidamente cuellos de botella (por ej. si hay un gran porcentaje en estado "Pendiente" o "En Aprobación") o la concentración de negocio en un área particular.'
    },
    'Actividad': {
      definition: 'Indicador rápido de eficiencia y progreso reciente.',
      operation: 'Calcula la proporción de tareas completadas exitosamente versus el volumen total activo.',
      data: 'Un porcentaje alto indica que la operación está fluyendo correctamente; un porcentaje bajo alerta de posibles retrasos operativos.'
    },
    'Balance Diario': {
      definition: 'Compara la cantidad de servicios iniciados versus los retirados (finalizados en terreno) de forma diaria.',
      operation: 'Cruza las fechas de inicio programado y las fechas de retiro efectivas desde la agenda operativa abarcando los últimos 365 días.',
      data: 'Al tener una perspectiva anual por día, permite visualizar el pulso exacto de la operación día a día, detectando inmediatamente picos de alta demanda, estacionalidad o caídas drásticas en el terreno.'
    },
    'Top Centros': {
      definition: 'Identifica las zonas geográficas o sedes (Centros) con mayor carga de trabajo.',
      operation: 'Suma el número total de fichas activas vinculadas a cada Centro logístico.',
      data: 'Ayuda a planificar recursos vehiculares e infraestructura por zonas, detectando qué sedes soportan el mayor volumen de la operación.'
    },
    'Carga por Día': {
      definition: 'Patrón estadístico de concentración de demanda por día de la semana.',
      operation: 'Extrae el día de la semana (Lunes a Domingo) de todas las fechas programadas.',
      data: 'Permite descubrir si existen "días pico" sistemáticos (ej. todos los viernes colapsan) para prever y reforzar turnos de terreno con anticipación.'
    },
    'Motivos de Cancelación': {
      definition: 'Desglose de las causas exactas por las que los servicios fracasan o se anulan.',
      operation: 'Filtra únicamente las fichas en estado "Cancelado" o "Anulado" y las agrupa por el motivo ingresado por el operador.',
      data: 'Indicador crítico de calidad: permite atacar directamente las causas operativas de pérdida (ej. falla logística vs culpa del cliente).'
    }
  };

  if (loading) {
    return (
      <div className="flex h-[500px] flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
        <span className="text-sm font-semibold text-muted-foreground">Cargando Inteligencia Operativa...</span>
      </div>
    );
  }

  const activeAnalyticsList = activeTab === 'operativa' ? samplerAnalytics : companyAnalytics;
  const activePieData = activeTab === 'operativa' ? statusAnalytics : activeTab === 'comercial' ? objectiveAnalytics : subAreaAnalytics;

  return (
    <div className="shadcn-scope">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="h-11 w-11 rounded-full" onClick={onBack}>
            <IconChevronLeft size={24} />
          </Button>
          <div>
            <h3 className="m-0 text-xl font-semibold">Dashboard Operativo</h3>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Análisis Minimalista</span>
          </div>
        </div>
        <Button
          variant="destructive"
          onClick={() => {
            setFilterMuestreador(null); setFilterEstado(null); setFilterEmpresaServicio(null); setFilterCentro(null); setFilterDateFrom(null); setFilterDateTo(null);
          }}
        >
          <IconX size={16} /> Limpiar Filtros
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="operativa" className="gap-1.5"><IconUsers size={16} /> Operativa</TabsTrigger>
          <TabsTrigger value="comercial" className="gap-1.5"><IconBuilding size={16} /> Comercial</TabsTrigger>
          <TabsTrigger value="logistica" className="gap-1.5"><IconMapPin size={16} /> Logística</TabsTrigger>
        </TabsList>
      </Tabs>

      <DashCard className="mb-6 h-auto">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
          {activeTab === 'operativa' && (
            <>
              <Field label="Muestreador"><Combobox placeholder="Todos" options={muestreadores} value={filterMuestreador ?? ''} onValueChange={(v) => setFilterMuestreador(v || null)} /></Field>
              <Field label="Estado"><Combobox placeholder="Todos" options={estados} value={filterEstado ?? ''} onValueChange={(v) => setFilterEstado(v || null)} /></Field>
            </>
          )}
          {activeTab === 'comercial' && (
            <>
              <Field label="Empresa"><Combobox placeholder="Todas" options={empresasServicio} value={filterEmpresaServicio ?? ''} onValueChange={(v) => { setFilterEmpresaServicio(v || null); setFilterCentro(null); }} /></Field>
              <Field label="Objetivo"><Combobox placeholder="Todos" options={objetivos} value={filterObjetivo ?? ''} onValueChange={(v) => setFilterObjetivo(v || null)} /></Field>
            </>
          )}
          {activeTab === 'logistica' && (
            <>
              <Field label="Centro">
                <Combobox
                  placeholder="Todos"
                  options={Array.from(new Map(centros.filter(c => !filterEmpresaServicio || c.empresa === filterEmpresaServicio).map(c => [c.value, c])).values())}
                  value={filterCentro ?? ''} onValueChange={(v) => setFilterCentro(v || null)}
                />
              </Field>
              <Field label="Sub-Área"><Combobox placeholder="Todas" options={subAreas} value={filterSubArea ?? ''} onValueChange={(v) => setFilterSubArea(v || null)} /></Field>
            </>
          )}
          <Field label="Desde">
            <DatePicker value={dateToInputValue(filterDateFrom)} onChange={(v) => setFilterDateFrom(v ? new Date(v) : null)} />
          </Field>
          <Field label="Hasta">
            <DatePicker value={dateToInputValue(filterDateTo)} onChange={(v) => setFilterDateTo(v ? new Date(v) : null)} />
          </Field>
        </div>
      </DashCard>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-4">
          <DashCard>
            <div className="mb-4 flex justify-between">
              <span className="text-[13px] font-semibold">Inicios Hoy</span>
              <Badge variant="secondary">{todayAgenda.filter(a => a.tipo_display === 'INICIO').length}</Badge>
            </div>
            <div className="flex flex-col gap-2.5">
               {todayAgenda.filter(a => a.tipo_display === 'INICIO').slice(0, 3).map((ev, i) => (
                 <div key={i} className="flex items-center gap-2.5 rounded-2xl border border-border p-2.5">
                   <IconCircle color="#1677ff"><IconPlayerPlayFilled size={12} /></IconCircle>
                   <div className="min-w-0 flex-1">
                     <span className="block truncate text-xs font-semibold">{ev._centro_name}</span>
                     <span className="block truncate text-xs text-muted-foreground">{ev.muestreador_display}</span>
                   </div>
                 </div>
               ))}
               {todayAgenda.filter(a => a.tipo_display === 'INICIO').length === 0 && <span className="text-center text-xs text-muted-foreground">Sin inicios programados</span>}
            </div>
          </DashCard>
        </div>

        <div className="col-span-12 md:col-span-4">
          <DashCard>
            <div className="mb-4 flex justify-between">
              <span className="text-[13px] font-semibold">Retiros Hoy</span>
              <Badge variant="secondary">{todayAgenda.filter(a => a.tipo_display === 'RETIRO').length}</Badge>
            </div>
            <div className="flex flex-col gap-2.5">
               {todayAgenda.filter(a => a.tipo_display === 'RETIRO').slice(0, 3).map((ev, i) => (
                 <div key={i} className="flex items-center gap-2.5 rounded-2xl border border-border p-2.5">
                   <IconCircle color="#e03131"><IconPlayerPauseFilled size={12} /></IconCircle>
                   <div className="min-w-0 flex-1">
                     <span className="block truncate text-xs font-semibold">{ev._centro_name}</span>
                     <span className="block truncate text-xs text-muted-foreground">{ev.muestreador_display}</span>
                   </div>
                 </div>
               ))}
               {todayAgenda.filter(a => a.tipo_display === 'RETIRO').length === 0 && <span className="text-center text-xs text-muted-foreground">Sin retiros programados</span>}
            </div>
          </DashCard>
        </div>

        <div className="col-span-12 md:col-span-4">
          <DashCard>
            <InfoButton title="Actividad" detail={chartExplanations['Actividad']} />
            <span className="text-[13px] font-semibold">
              Actividad{' '}
              <Badge variant="success">{(filteredData.filter(f => normalize(f._status_name).includes('ejecutado')).length / (filteredData.length || 1) * 100).toFixed(0)}%</Badge>
            </span>
            <span className="my-2 block text-[32px] font-extrabold">{filteredData.length}</span>
            <div className="h-[90px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendAnalytics.slice(-6)}>
                  <Tooltip contentStyle={tooltipStyle} cursor={{fill: 'var(--sc-muted)'}} />
                  <Bar dataKey="ejecutados" radius={[4,4,0,0]} fill="#10b981" name="Completados" />
                  <Bar dataKey="pendientes" radius={[4,4,0,0]} fill="#cbd5e1" name="Activos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DashCard>
        </div>

        <div className="col-span-12 md:col-span-4"><StatCard title="Total Fichas" value={filteredData.length} color="blue" data={trendAnalytics.map(t => ({ value: t.ejecutados + t.pendientes }))} /></div>
        <div className="col-span-12 md:col-span-4"><StatCard title="En Proceso" value={filteredData.filter(f => normalize(f._status_name).includes('proceso')).length} color="orange" data={trendAnalytics.map(t => ({ value: t.pendientes }))} /></div>
        <div className="col-span-12 md:col-span-4"><StatCard title="Ejecutados" value={filteredData.filter(f => normalize(f._status_name).includes('ejecutado')).length} color="green" data={trendAnalytics.map(t => ({ value: t.ejecutados }))} /></div>

        <div className="col-span-12 md:col-span-4">
           <DashCard>
             <InfoButton title="Carga Operativa" detail={chartExplanations['Carga Operativa']} />
             <span className="mb-6 block text-[13px] font-semibold">Resumen de Carga</span>
             <div className="flex flex-col gap-5">
                {activeAnalyticsList.slice(0, 5).map((item, i) => (
                  <div key={i}>
                    <div className="mb-1.5 flex justify-between">
                      <span className="text-xs font-bold">{item.name}</span>
                      <span className="text-xs font-extrabold">{item.value} Fts.</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, (item.value / (filteredData.length || 1)) * 100)}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                ))}
             </div>
           </DashCard>
        </div>

        <div className="col-span-12 md:col-span-4">
           <DashCard>
             <InfoButton title="Agenda para Hoy" detail={chartExplanations['Agenda para Hoy']} />
             <div className="mb-6 flex justify-between">
               <span className="text-[13px] font-semibold">Cronograma</span>
               <Badge variant="secondary">Hoy</Badge>
             </div>
             <Timeline
                items={todayAgenda.slice(0, 4).map((ev, i) => ({
                    key: i,
                    dot: <IconClock size={12} />,
                    color: ev.tipo_display === 'INICIO' ? '#1677ff' : '#e03131',
                    content: (
                        <>
                            <span className="block text-xs font-semibold">{ev._centro_name}</span>
                            <span className="text-xs text-muted-foreground">{ev.tipo_display} - {ev.muestreador_display}</span>
                        </>
                    ),
                }))}
             />
             {todayAgenda.length === 0 && <span className="mt-6 block text-center text-sm text-muted-foreground">No hay eventos para hoy</span>}
           </DashCard>
        </div>

        <div className="col-span-12 md:col-span-4">
           <DashCard>
             <InfoButton title="Distribución Global" detail={chartExplanations['Distribución Global']} />
             <div className="mb-4 flex justify-between">
               <span className="text-[13px] font-semibold">Distribución</span>
               <Badge variant="destructive">{filteredData.filter(f => normalize(f._status_name).includes('cancela')).length} Anulados</Badge>
             </div>
             <div className="mt-4 flex justify-center">
               <div className="h-[180px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={activePieData} innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                        {activePieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                 </ResponsiveContainer>
               </div>
             </div>
             <div className="mt-5 grid grid-cols-2 gap-3">
                {activePieData.slice(0, 4).map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <div>
                      <span className="block max-w-[90px] truncate text-xs text-muted-foreground">{item.name}</span>
                      <span className="text-xs font-semibold">{((item.value / (filteredData.length || 1)) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
             </div>
           </DashCard>
        </div>

        <div className="col-span-12">
           <DashCard>
             <InfoButton title="Balance Diario" detail={chartExplanations['Balance Diario']} />
             <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
               <span className="text-[13px] font-semibold">Balance Operativo Diario (Inicios vs Retiros)</span>
               <Tabs value={trendFilter} onValueChange={setTrendFilter}>
                 <TabsList>
                   <TabsTrigger value="15">15 Días</TabsTrigger>
                   <TabsTrigger value="30">30 Días</TabsTrigger>
                   <TabsTrigger value="90">3 Meses</TabsTrigger>
                   <TabsTrigger value="365">1 Año</TabsTrigger>
                 </TabsList>
               </Tabs>
             </div>
             <div className="h-[300px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={dailyInOutTrend} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--sc-border)" />
                   <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} minTickGap={30} />
                   <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                   <Tooltip contentStyle={tooltipStyle} />
                   <Line type="monotone" dataKey="inicios" stroke="#0ea5e9" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Inicios" />
                   <Line type="monotone" dataKey="retiros" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Retiros" />
                 </LineChart>
               </ResponsiveContainer>
             </div>
           </DashCard>
        </div>

        <div className="col-span-12 md:col-span-4">
           <DashCard>
             <InfoButton title="Top Centros" detail={chartExplanations['Top Centros']} />
             <div className="mb-4 flex justify-between">
               <span className="text-[13px] font-semibold">Top Centros Logísticos</span>
               <Badge variant="secondary">Zonas</Badge>
             </div>
             <div className="h-[250px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={centroAnalytics} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--sc-border)" />
                   <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                   <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                   <Tooltip contentStyle={tooltipStyle} cursor={{fill: 'var(--sc-muted)'}} />
                   <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#0ea5e9" name="Servicios" />
                 </BarChart>
               </ResponsiveContainer>
             </div>
           </DashCard>
        </div>

        <div className="col-span-12 md:col-span-4">
           <DashCard>
             <InfoButton title="Carga por Día" detail={chartExplanations['Carga por Día']} />
             <div className="mb-4 flex justify-between">
               <span className="text-[13px] font-semibold">Carga por Día de la Semana</span>
               <Badge variant="secondary">Patrón</Badge>
             </div>
             <div className="h-[250px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={weekdayAnalytics} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--sc-border)" />
                   <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                   <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                   <Tooltip contentStyle={tooltipStyle} cursor={{fill: 'var(--sc-muted)'}} />
                   <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#d946ef" name="Fichas Históricas" />
                 </BarChart>
               </ResponsiveContainer>
             </div>
           </DashCard>
        </div>

        <div className="col-span-12 md:col-span-4">
           <DashCard>
             <InfoButton title="Motivos de Cancelación" detail={chartExplanations['Motivos de Cancelación']} />
             <div className="mb-4 flex justify-between">
               <span className="text-[13px] font-semibold">Motivos de Cancelación</span>
               <Badge variant="destructive">Pérdidas</Badge>
             </div>
             <div className="h-[250px] w-full">
               {cancellationAnalytics.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={cancellationAnalytics} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--sc-border)" />
                     <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                     <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                     <Tooltip contentStyle={tooltipStyle} cursor={{fill: 'var(--sc-muted)'}} />
                     <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#ef4444" name="Anulados" />
                   </BarChart>
                 </ResponsiveContainer>
               ) : (
                 <div className="flex h-full items-center justify-center">
                   <span className="text-sm text-muted-foreground">No se registran anulaciones</span>
                 </div>
               )}
             </div>
           </DashCard>
        </div>
      </div>

      <Dialog open={!!infoModal} onOpenChange={(open) => { if (!open) setInfoModal(null); }}>
        <DialogContent className="max-w-[640px] rounded-3xl p-8">
          {infoModal && (
            <div className="max-h-[80vh] overflow-y-auto">
              <DialogHeader className="mb-6 flex-row items-center gap-4 space-y-0">
                <IconCircle color="#1677ff" size={56}><IconInfoCircle size={28} /></IconCircle>
                <div>
                  <span className="block text-[11px] font-extrabold uppercase tracking-wide text-primary">Explicación Detallada</span>
                  <DialogTitle className="text-lg">{infoModal.title}</DialogTitle>
                </div>
              </DialogHeader>

              <div className="flex flex-col gap-5">
                <div>
                  <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-primary">¿Qué muestra este gráfico?</span>
                  <span className="text-[13.5px] leading-relaxed">{infoModal.definition}</span>
                </div>
                <div>
                  <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-primary">¿Cómo se procesa la información?</span>
                  <span className="text-[13.5px] leading-relaxed">{infoModal.operation}</span>
                </div>
                <div>
                  <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-primary">Interpretación y Uso</span>
                  <span className="text-[13.5px] leading-relaxed">{infoModal.data}</span>
                </div>
              </div>

              <Button size="lg" className="mt-6 w-full" onClick={() => setInfoModal(null)}>Entendido</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
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

function IconCircle({ children, color, size = 32 }: { children: React.ReactNode; color: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: `${color}1f`, color }}
    >
      {children}
    </div>
  );
}
