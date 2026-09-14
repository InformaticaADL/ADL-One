import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts';
import {
  Select, Button, Tag, Progress, Timeline, Modal, Segmented, Typography, DatePicker
} from 'antd';
import dayjs from 'dayjs';
import {
  IconChevronLeft, IconX, IconBuilding, IconMapPin, IconUsers, IconInfoCircle, IconPlayerPauseFilled, IconPlayerPlayFilled, IconClock
} from '@tabler/icons-react';
import { fichaService } from '../services/ficha.service';

const { Text, Title } = Typography;

interface Props {
  onBack: () => void;
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280', '#ec4899', '#14b8a6'];

const normalize = (s: string) =>
    (s || '').normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Tarjeta base compartida por todos los widgets del dashboard.
function DashCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      borderRadius: 20, padding: 24, backgroundColor: 'var(--app-bg)',
      border: '1px solid var(--app-border)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      position: 'relative', height: '100%', boxSizing: 'border-box',
      ...style,
    }}>
      {children}
    </div>
  );
}

const tooltipStyle = { borderRadius: 12, border: '1px solid var(--app-border)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--app-bg-elevated)' };

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

  const StatCard = ({ title, value, color, data }: { title: string, value: string | number, color: string, data?: any[] }) => (
    <DashCard>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong style={{ fontSize: 13 }}>{title}</Text>
          <Tag color={color}>Filtrado</Tag>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>{value}</Text>
          {data && (
             <div style={{ width: 80, height: 40 }}>
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
      style={{
        position: 'absolute', top: '1rem', right: '1rem', width: 28, height: 28, borderRadius: 8,
        backgroundColor: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-text-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10,
      }}
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '500px', gap: '1rem' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--app-hover-bg)', borderTopColor: '#0ea5e9', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <Text type="secondary" strong>Cargando Inteligencia Operativa...</Text>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const activeAnalyticsList = activeTab === 'operativa' ? samplerAnalytics : companyAnalytics;
  const activePieData = activeTab === 'operativa' ? statusAnalytics : activeTab === 'comercial' ? objectiveAnalytics : subAreaAnalytics;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Button shape="circle" size="large" icon={<IconChevronLeft size={24} />} onClick={onBack} />
          <div>
            <Title level={3} style={{ margin: 0 }}>Dashboard Operativo</Title>
            <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Análisis Minimalista</Text>
          </div>
        </div>
        <Button danger icon={<IconX size={16} />} onClick={() => {
            setFilterMuestreador(null); setFilterEstado(null); setFilterEmpresaServicio(null); setFilterCentro(null); setFilterDateFrom(null); setFilterDateTo(null);
        }}>
          Limpiar Filtros
        </Button>
      </div>

      <Segmented
        value={activeTab}
        onChange={(v) => setActiveTab(v as string)}
        style={{ marginBottom: 24 }}
        options={[
          { label: 'Operativa', value: 'operativa', icon: <IconUsers size={16} /> },
          { label: 'Comercial', value: 'comercial', icon: <IconBuilding size={16} /> },
          { label: 'Logística', value: 'logistica', icon: <IconMapPin size={16} /> },
        ]}
      />

      <DashCard style={{ marginBottom: 24, height: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
          {activeTab === 'operativa' && (
            <>
              <Field label="Muestreador"><Select placeholder="Todos" options={muestreadores} value={filterMuestreador || undefined} onChange={(v) => setFilterMuestreador(v || null)} allowClear style={{ width: '100%' }} /></Field>
              <Field label="Estado"><Select placeholder="Todos" options={estados} value={filterEstado || undefined} onChange={(v) => setFilterEstado(v || null)} allowClear style={{ width: '100%' }} /></Field>
            </>
          )}
          {activeTab === 'comercial' && (
            <>
              <Field label="Empresa"><Select placeholder="Todas" options={empresasServicio} value={filterEmpresaServicio || undefined} onChange={(v) => { setFilterEmpresaServicio(v || null); setFilterCentro(null); }} allowClear style={{ width: '100%' }} /></Field>
              <Field label="Objetivo"><Select placeholder="Todos" options={objetivos} value={filterObjetivo || undefined} onChange={(v) => setFilterObjetivo(v || null)} allowClear style={{ width: '100%' }} /></Field>
            </>
          )}
          {activeTab === 'logistica' && (
            <>
              <Field label="Centro">
                <Select
                  placeholder="Todos"
                  options={Array.from(new Map(centros.filter(c => !filterEmpresaServicio || c.empresa === filterEmpresaServicio).map(c => [c.value, c])).values())}
                  value={filterCentro || undefined} onChange={(v) => setFilterCentro(v || null)} allowClear showSearch style={{ width: '100%' }}
                />
              </Field>
              <Field label="Sub-Área"><Select placeholder="Todas" options={subAreas} value={filterSubArea || undefined} onChange={(v) => setFilterSubArea(v || null)} allowClear style={{ width: '100%' }} /></Field>
            </>
          )}
          <Field label="Desde">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" value={filterDateFrom ? dayjs(filterDateFrom) : null} onChange={(d) => setFilterDateFrom(d ? d.toDate() : null)} />
          </Field>
          <Field label="Hasta">
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" value={filterDateTo ? dayjs(filterDateTo) : null} onChange={(d) => setFilterDateTo(d ? d.toDate() : null)} />
          </Field>
        </div>
      </DashCard>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
        <div style={{ gridColumn: 'span 12 / span 12' }} className="dash-col-4">
          <DashCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text strong style={{ fontSize: 13 }}>Inicios Hoy</Text>
              <Tag>{todayAgenda.filter(a => a.tipo_display === 'INICIO').length}</Tag>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
               {todayAgenda.filter(a => a.tipo_display === 'INICIO').slice(0, 3).map((ev, i) => (
                 <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--app-border)', borderRadius: 16 }}>
                   <IconCircle color="#1677ff"><IconPlayerPlayFilled size={12} /></IconCircle>
                   <div style={{ flex: 1, minWidth: 0 }}>
                     <Text strong style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev._centro_name}</Text>
                     <Text type="secondary" style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.muestreador_display}</Text>
                   </div>
                 </div>
               ))}
               {todayAgenda.filter(a => a.tipo_display === 'INICIO').length === 0 && <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>Sin inicios programados</Text>}
            </div>
          </DashCard>
        </div>

        <div className="dash-col-4">
          <DashCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text strong style={{ fontSize: 13 }}>Retiros Hoy</Text>
              <Tag>{todayAgenda.filter(a => a.tipo_display === 'RETIRO').length}</Tag>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
               {todayAgenda.filter(a => a.tipo_display === 'RETIRO').slice(0, 3).map((ev, i) => (
                 <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--app-border)', borderRadius: 16 }}>
                   <IconCircle color="#e03131"><IconPlayerPauseFilled size={12} /></IconCircle>
                   <div style={{ flex: 1, minWidth: 0 }}>
                     <Text strong style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev._centro_name}</Text>
                     <Text type="secondary" style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.muestreador_display}</Text>
                   </div>
                 </div>
               ))}
               {todayAgenda.filter(a => a.tipo_display === 'RETIRO').length === 0 && <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>Sin retiros programados</Text>}
            </div>
          </DashCard>
        </div>

        <div className="dash-col-4">
          <DashCard>
            <InfoButton title="Actividad" detail={chartExplanations['Actividad']} />
            <Text strong style={{ fontSize: 13 }}>Actividad <Tag color="green">{(filteredData.filter(f => normalize(f._status_name).includes('ejecutado')).length / (filteredData.length || 1) * 100).toFixed(0)}%</Tag></Text>
            <Text style={{ fontSize: 32, fontWeight: 800, display: 'block', margin: '8px 0 12px' }}>{filteredData.length}</Text>
            <div style={{ height: 90 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendAnalytics.slice(-6)}>
                  <Tooltip contentStyle={tooltipStyle} cursor={{fill: 'var(--app-hover-bg)'}} />
                  <Bar dataKey="ejecutados" radius={[4,4,0,0]} fill="#10b981" name="Completados" />
                  <Bar dataKey="pendientes" radius={[4,4,0,0]} fill="#cbd5e1" name="Activos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DashCard>
        </div>

        <div className="dash-col-4"><StatCard title="Total Fichas" value={filteredData.length} color="blue" data={trendAnalytics.map(t => ({ value: t.ejecutados + t.pendientes }))} /></div>
        <div className="dash-col-4"><StatCard title="En Proceso" value={filteredData.filter(f => normalize(f._status_name).includes('proceso')).length} color="orange" data={trendAnalytics.map(t => ({ value: t.pendientes }))} /></div>
        <div className="dash-col-4"><StatCard title="Ejecutados" value={filteredData.filter(f => normalize(f._status_name).includes('ejecutado')).length} color="green" data={trendAnalytics.map(t => ({ value: t.ejecutados }))} /></div>

        <div className="dash-col-4">
           <DashCard>
             <InfoButton title="Carga Operativa" detail={chartExplanations['Carga Operativa']} />
             <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 24 }}>Resumen de Carga</Text>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {activeAnalyticsList.slice(0, 5).map((item, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: 700 }}>{item.name}</Text>
                      <Text style={{ fontSize: 12, fontWeight: 800 }}>{item.value} Fts.</Text>
                    </div>
                    <Progress percent={(item.value / (filteredData.length || 1)) * 100} showInfo={false} strokeColor={COLORS[i % COLORS.length]} />
                  </div>
                ))}
             </div>
           </DashCard>
        </div>

        <div className="dash-col-4">
           <DashCard>
             <InfoButton title="Agenda para Hoy" detail={chartExplanations['Agenda para Hoy']} />
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
               <Text strong style={{ fontSize: 13 }}>Cronograma</Text>
               <Tag>Hoy</Tag>
             </div>
             <Timeline
                items={todayAgenda.slice(0, 4).map((ev, i) => ({
                    key: i,
                    dot: <IconClock size={12} />,
                    color: ev.tipo_display === 'INICIO' ? 'blue' : 'red',
                    children: (
                        <>
                            <Text strong style={{ fontSize: 12, display: 'block' }}>{ev._centro_name}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>{ev.tipo_display} - {ev.muestreador_display}</Text>
                        </>
                    ),
                }))}
             />
             {todayAgenda.length === 0 && <Text type="secondary" style={{ fontSize: 13, textAlign: 'center', display: 'block', marginTop: 24 }}>No hay eventos para hoy</Text>}
           </DashCard>
        </div>

        <div className="dash-col-4">
           <DashCard>
             <InfoButton title="Distribución Global" detail={chartExplanations['Distribución Global']} />
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
               <Text strong style={{ fontSize: 13 }}>Distribución</Text>
               <Tag color="red">{filteredData.filter(f => normalize(f._status_name).includes('cancela')).length} Anulados</Tag>
             </div>
             <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
               <div style={{ height: 180, width: '100%' }}>
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
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20 }}>
                {activePieData.slice(0, 4).map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <div>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 90 }}>{item.name}</Text>
                      <Text strong style={{ fontSize: 12 }}>{((item.value / (filteredData.length || 1)) * 100).toFixed(1)}%</Text>
                    </div>
                  </div>
                ))}
             </div>
           </DashCard>
        </div>

        <div style={{ gridColumn: 'span 12 / span 12' }}>
           <DashCard>
             <InfoButton title="Balance Diario" detail={chartExplanations['Balance Diario']} />
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
               <Text strong style={{ fontSize: 13 }}>Balance Operativo Diario (Inicios vs Retiros)</Text>
               <Segmented
                 value={trendFilter}
                 onChange={(v) => setTrendFilter(v as string)}
                 options={[
                   { label: '15 Días', value: '15' },
                   { label: '30 Días', value: '30' },
                   { label: '3 Meses', value: '90' },
                   { label: '1 Año', value: '365' },
                 ]}
               />
             </div>
             <div style={{ height: 300, width: '100%' }}>
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={dailyInOutTrend} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--app-border)" />
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

        <div className="dash-col-4">
           <DashCard>
             <InfoButton title="Top Centros" detail={chartExplanations['Top Centros']} />
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
               <Text strong style={{ fontSize: 13 }}>Top Centros Logísticos</Text>
               <Tag color="blue">Zonas</Tag>
             </div>
             <div style={{ height: 250, width: '100%' }}>
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={centroAnalytics} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--app-border)" />
                   <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                   <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                   <Tooltip contentStyle={tooltipStyle} cursor={{fill: 'var(--app-hover-bg)'}} />
                   <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#0ea5e9" name="Servicios" />
                 </BarChart>
               </ResponsiveContainer>
             </div>
           </DashCard>
        </div>

        <div className="dash-col-4">
           <DashCard>
             <InfoButton title="Carga por Día" detail={chartExplanations['Carga por Día']} />
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
               <Text strong style={{ fontSize: 13 }}>Carga por Día de la Semana</Text>
               <Tag color="purple">Patrón</Tag>
             </div>
             <div style={{ height: 250, width: '100%' }}>
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={weekdayAnalytics} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--app-border)" />
                   <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                   <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                   <Tooltip contentStyle={tooltipStyle} cursor={{fill: 'var(--app-hover-bg)'}} />
                   <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#d946ef" name="Fichas Históricas" />
                 </BarChart>
               </ResponsiveContainer>
             </div>
           </DashCard>
        </div>

        <div className="dash-col-4">
           <DashCard>
             <InfoButton title="Motivos de Cancelación" detail={chartExplanations['Motivos de Cancelación']} />
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
               <Text strong style={{ fontSize: 13 }}>Motivos de Cancelación</Text>
               <Tag color="red">Pérdidas</Tag>
             </div>
             <div style={{ height: 250, width: '100%' }}>
               {cancellationAnalytics.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={cancellationAnalytics} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--app-border)" />
                     <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                     <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                     <Tooltip contentStyle={tooltipStyle} cursor={{fill: 'var(--app-hover-bg)'}} />
                     <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#ef4444" name="Anulados" />
                   </BarChart>
                 </ResponsiveContainer>
               ) : (
                 <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <Text type="secondary" style={{ fontSize: 13 }}>No se registran anulaciones</Text>
                 </div>
               )}
             </div>
           </DashCard>
        </div>
      </div>

      <Modal
        open={!!infoModal}
        onCancel={() => setInfoModal(null)}
        closable={false}
        width={640}
        footer={null}
        styles={{ root: { borderRadius: 24 }, body: { padding: 32 } }}
      >
        {infoModal && (
          <div style={{ maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
              <Button type="text" shape="circle" icon={<IconX size={20} />} onClick={() => setInfoModal(null)} style={{ position: 'absolute', top: 0, right: 0 }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <IconCircle color="#1677ff" size={56}><IconInfoCircle size={28} /></IconCircle>
                <div>
                  <Text style={{ fontSize: 11, fontWeight: 800, color: 'var(--app-accent-text)', textTransform: 'uppercase', letterSpacing: 1, display: 'block' }}>Explicación Detallada</Text>
                  <Title level={4} style={{ margin: 0 }}>{infoModal.title}</Title>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <Text style={{ fontSize: 11, fontWeight: 800, color: 'var(--app-accent-text)', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>¿Qué muestra este gráfico?</Text>
                  <Text style={{ fontSize: 13.5, lineHeight: 1.6 }}>{infoModal.definition}</Text>
                </div>
                <div>
                  <Text style={{ fontSize: 11, fontWeight: 800, color: 'var(--app-accent-text)', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>¿Cómo se procesa la información?</Text>
                  <Text style={{ fontSize: 13.5, lineHeight: 1.6 }}>{infoModal.operation}</Text>
                </div>
                <div>
                  <Text style={{ fontSize: 11, fontWeight: 800, color: 'var(--app-accent-text)', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Interpretación y Uso</Text>
                  <Text style={{ fontSize: 13.5, lineHeight: 1.6 }}>{infoModal.data}</Text>
                </div>
              </div>

              <Button block size="large" style={{ marginTop: 24 }} onClick={() => setInfoModal(null)}>Entendido</Button>
          </div>
        )}
      </Modal>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 768px) { .dash-col-4 { grid-column: span 4 / span 4 !important; } }
      `}</style>
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

function IconCircle({ children, color, size = 32 }: { children: React.ReactNode; color: string; size?: number }) {
  return (
    <div style={{
      flexShrink: 0, width: size, height: size, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: `${color}1f`, color,
    }}>
      {children}
    </div>
  );
}
