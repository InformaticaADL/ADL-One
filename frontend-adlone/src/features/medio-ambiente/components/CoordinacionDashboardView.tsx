import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line
} from 'recharts';
import { 
  Paper, Text, Title, Group, Stack, SimpleGrid, Select, Box, Tabs, Button, ActionIcon, Grid, Progress, Timeline, Badge, ThemeIcon, Avatar, Center, SegmentedControl
} from '@mantine/core';
import { 
  IconChevronLeft, IconFilter, IconX, IconChartBar, IconBuilding, IconMapPin, IconCalendar, IconAdjustmentsHorizontal, IconUsers, IconInfoCircle, IconPlayerPauseFilled, IconPlayerPlayFilled, IconClock
} from '@tabler/icons-react';
import { DateInput } from '@mantine/dates';
import { fichaService } from '../services/ficha.service';

interface Props {
  onBack: () => void;
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280', '#ec4899', '#14b8a6'];

const normalize = (s: string) => 
    (s || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

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
  const [activeTab, setActiveTab] = useState<string | null>('operativa');
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

  const StatCard = ({ title, value, sub, color, data }: { title: string, value: string | number, sub: string, color: string, data?: any[] }) => (
    <Paper radius="xl" p="lg" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)' }}>
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text size="sm" fw={700} c="dark.4">{title}</Text>
          <Badge color={color} variant="light" size="sm">Filtrado</Badge>
        </Group>
        <Group align="flex-end" justify="space-between">
          <Text size="2.5rem" fw={800} c="dark.9" lh={1}>{value}</Text>
          {data && (
             <Box w={80} h={40}>
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={data}>
                      <Area type="monotone" dataKey="value" stroke={`var(--mantine-color-${color}-5)`} fill={`var(--mantine-color-${color}-1)`} strokeWidth={2} />
                   </AreaChart>
                </ResponsiveContainer>
             </Box>
          )}
        </Group>
      </Stack>
    </Paper>
  );

  const InfoButton = ({ title, detail }: { title: string, detail: any }) => (
    <button 
      onClick={() => setInfoModal({ title, ...detail })}
      style={{
        position: 'absolute',
        top: '1rem',
        right: '1rem',
        width: '28px',
        height: '28px',
        borderRadius: '8px',
        backgroundColor: 'white',
        border: '1px solid var(--mantine-color-gray-2)',
        color: 'var(--mantine-color-gray-5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        zIndex: 10
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
        <div style={{ width: 40, height: 40, border: '3px solid #f8fafc', borderTopColor: '#0ea5e9', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#64748b', fontWeight: 600 }}>Cargando Inteligencia Operativa...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const activeAnalyticsList = activeTab === 'operativa' ? samplerAnalytics : companyAnalytics;
  const activePieData = activeTab === 'operativa' ? statusAnalytics : activeTab === 'comercial' ? objectiveAnalytics : subAreaAnalytics;

  return (
    <Box p="md" style={{ width: '100%', animation: 'fadeIn 0.6s ease-out', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      
      <Box mb="xl">
        <Group justify="space-between" align="center">
          <Group>
            <ActionIcon variant="white" color="gray" size="xl" onClick={onBack} radius="xl" style={{ border: '1px solid var(--mantine-color-gray-2)' }}>
              <IconChevronLeft size={24} />
            </ActionIcon>
            <Stack gap={0}>
              <Title order={3} fw={800} c="dark.9">Dashboards Inteligentes</Title>
              <Text c="dimmed" fw={600} size="xs" tt="uppercase" lts={1}>Análisis Minimalista</Text>
            </Stack>
          </Group>
          <Button variant="white" color="red" leftSection={<IconX size={16} />} onClick={() => { 
              setFilterMuestreador(null); setFilterEstado(null); setFilterEmpresaServicio(null); setFilterCentro(null); setFilterDateFrom(null); setFilterDateTo(null);
          }} radius="xl" style={{ border: '1px solid var(--mantine-color-gray-2)' }}>
            Limpiar Filtros
          </Button>
        </Group>
      </Box>

      <Tabs value={activeTab} onChange={setActiveTab} variant="pills" radius="xl" mb="xl" color="dark">
        <Tabs.List>
          <Tabs.Tab value="operativa" leftSection={<IconUsers size={16} />}>Operativa</Tabs.Tab>
          <Tabs.Tab value="comercial" leftSection={<IconBuilding size={16} />}>Comercial</Tabs.Tab>
          <Tabs.Tab value="logistica" leftSection={<IconMapPin size={16} />}>Logística</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Paper radius="xl" p="md" bg="white" shadow="xs" mb="xl" style={{ border: '1px solid var(--mantine-color-gray-2)' }}>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4, lg: 5 }} spacing="md">
          {activeTab === 'operativa' && (
            <>
              <Select label="Muestreador" placeholder="Todos" data={muestreadores} value={filterMuestreador} onChange={setFilterMuestreador} clearable radius="md" />
              <Select label="Estado" placeholder="Todos" data={estados} value={filterEstado} onChange={setFilterEstado} clearable radius="md" />
            </>
          )}
          {activeTab === 'comercial' && (
            <>
              <Select label="Empresa" placeholder="Todas" data={empresasServicio} value={filterEmpresaServicio} onChange={(v) => { setFilterEmpresaServicio(v); setFilterCentro(null); }} clearable radius="md" />
              <Select label="Objetivo" placeholder="Todos" data={objetivos} value={filterObjetivo} onChange={setFilterObjetivo} clearable radius="md" />
            </>
          )}
          {activeTab === 'logistica' && (
            <>
              <Select label="Centro" placeholder="Todos" data={Array.from(new Map(centros.filter(c => !filterEmpresaServicio || c.empresa === filterEmpresaServicio).map(c => [c.value, c])).values())} value={filterCentro} onChange={setFilterCentro} clearable searchable radius="md" />
              <Select label="Sub-Área" placeholder="Todas" data={subAreas} value={filterSubArea} onChange={setFilterSubArea} clearable radius="md" />
            </>
          )}
          <DateInput label="Desde" placeholder="Inicio" value={filterDateFrom} onChange={(val: any) => setFilterDateFrom(val)} clearable radius="md" />
          <DateInput label="Hasta" placeholder="Fin" value={filterDateTo} onChange={(val: any) => setFilterDateTo(val)} clearable radius="md" />
        </SimpleGrid>
      </Paper>

      <Grid gutter="lg">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper radius="xl" p="lg" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)', height: '100%' }}>
            <Group justify="space-between" mb="md">
              <Text fw={700} size="sm">Inicios Hoy</Text>
              <Badge size="sm" color="gray" variant="light">{todayAgenda.filter(a => a.tipo_display === 'INICIO').length}</Badge>
            </Group>
            <Stack gap="sm">
               {todayAgenda.filter(a => a.tipo_display === 'INICIO').slice(0, 3).map((ev, i) => (
                 <Group key={i} p="sm" style={{ border: '1px solid var(--mantine-color-gray-1)', borderRadius: 16 }}>
                   <ThemeIcon radius="xl" color="blue" variant="light"><IconPlayerPlayFilled size={12} /></ThemeIcon>
                   <Box style={{ flex: 1, minWidth: 0 }}>
                     <Text size="xs" fw={700} truncate>{ev._centro_name}</Text>
                     <Text size="xs" c="dimmed" truncate>{ev.muestreador_display}</Text>
                   </Box>
                 </Group>
               ))}
               {todayAgenda.filter(a => a.tipo_display === 'INICIO').length === 0 && <Text c="dimmed" size="xs" ta="center">Sin inicios programados</Text>}
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper radius="xl" p="lg" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)', height: '100%' }}>
            <Group justify="space-between" mb="md">
              <Text fw={700} size="sm">Retiros Hoy</Text>
              <Badge size="sm" color="gray" variant="light">{todayAgenda.filter(a => a.tipo_display === 'RETIRO').length}</Badge>
            </Group>
            <Stack gap="sm">
               {todayAgenda.filter(a => a.tipo_display === 'RETIRO').slice(0, 3).map((ev, i) => (
                 <Group key={i} p="sm" style={{ border: '1px solid var(--mantine-color-gray-1)', borderRadius: 16 }}>
                   <ThemeIcon radius="xl" color="red" variant="light"><IconPlayerPauseFilled size={12} /></ThemeIcon>
                   <Box style={{ flex: 1, minWidth: 0 }}>
                     <Text size="xs" fw={700} truncate>{ev._centro_name}</Text>
                     <Text size="xs" c="dimmed" truncate>{ev.muestreador_display}</Text>
                   </Box>
                 </Group>
               ))}
               {todayAgenda.filter(a => a.tipo_display === 'RETIRO').length === 0 && <Text c="dimmed" size="xs" ta="center">Sin retiros programados</Text>}
            </Stack>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Paper radius="xl" p="lg" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)', height: '100%', position: 'relative' }}>
            <InfoButton title="Actividad" detail={chartExplanations['Actividad']} />
            <Text fw={700} size="sm">Actividad <Badge color="green" variant="light">{(filteredData.filter(f => normalize(f._status_name).includes('ejecutado')).length / (filteredData.length || 1) * 100).toFixed(0)}%</Badge></Text>
            <Text size="2rem" fw={800} mt="xs" mb="md">{filteredData.length}</Text>
            <Box h={90}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendAnalytics.slice(-6)}>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{fill: '#f8fafc'}} />
                  <Bar dataKey="ejecutados" radius={[4,4,0,0]} fill="#10b981" name="Completados" />
                  <Bar dataKey="pendientes" radius={[4,4,0,0]} fill="#e2e8f0" name="Activos" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <StatCard title="Total Fichas" value={filteredData.length} sub="" color="blue" data={trendAnalytics.map(t => ({ value: t.ejecutados + t.pendientes }))} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <StatCard title="En Proceso" value={filteredData.filter(f => normalize(f._status_name).includes('proceso')).length} sub="" color="orange" data={trendAnalytics.map(t => ({ value: t.pendientes }))} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <StatCard title="Ejecutados" value={filteredData.filter(f => normalize(f._status_name).includes('ejecutado')).length} sub="" color="green" data={trendAnalytics.map(t => ({ value: t.ejecutados }))} />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
           <Paper radius="xl" p="xl" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)', height: '100%', position: 'relative' }}>
             <InfoButton title="Carga Operativa" detail={chartExplanations['Carga Operativa']} />
             <Text fw={700} size="sm" mb="xl">Resumen de Carga</Text>
             <Stack gap="lg" mt="md">
                {activeAnalyticsList.slice(0, 5).map((item, i) => (
                  <Box key={i}>
                    <Group justify="space-between" mb={6}>
                      <Text size="xs" fw={700} c="dark.7">{item.name}</Text>
                      <Text size="xs" fw={800}>{item.value} Fts.</Text>
                    </Group>
                    <Progress value={(item.value / (filteredData.length || 1)) * 100} color={COLORS[i % COLORS.length]} size="md" radius="xl" />
                  </Box>
                ))}
             </Stack>
           </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
           <Paper radius="xl" p="xl" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)', height: '100%', position: 'relative' }}>
             <InfoButton title="Agenda para Hoy" detail={chartExplanations['Agenda para Hoy']} />
             <Group justify="space-between" mb="xl">
               <Text fw={700} size="sm">Cronograma</Text>
               <Badge variant="light" color="gray">Hoy</Badge>
             </Group>
             <Timeline active={todayAgenda.length > 0 ? 1 : 0} bulletSize={24} lineWidth={2} color="blue">
                {todayAgenda.slice(0, 4).map((ev, i) => (
                  <Timeline.Item key={i} bullet={<IconClock size={12} />} title={<Text size="xs" fw={700}>{ev._centro_name}</Text>} color={ev.tipo_display === 'INICIO' ? 'blue' : 'red'}>
                    <Text c="dimmed" size="xs" mt={4}>{ev.tipo_display} - {ev.muestreador_display}</Text>
                  </Timeline.Item>
                ))}
             </Timeline>
             {todayAgenda.length === 0 && <Text c="dimmed" size="sm" ta="center" mt="xl">No hay eventos para hoy</Text>}
           </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
           <Paper radius="xl" p="xl" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)', height: '100%', position: 'relative' }}>
             <InfoButton title="Distribución Global" detail={chartExplanations['Distribución Global']} />
             <Group justify="space-between" mb="md">
               <Text fw={700} size="sm">Distribución</Text>
               <Badge color="red" variant="light">{filteredData.filter(f => normalize(f._status_name).includes('cancela')).length} Anulados</Badge>
             </Group>
             <Center mt="md">
               <div style={{ height: 180, width: '100%' }}>
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={activePieData}
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {activePieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    </PieChart>
                 </ResponsiveContainer>
               </div>
             </Center>
             <SimpleGrid cols={2} mt="lg">
                {activePieData.slice(0, 4).map((item, i) => (
                  <Group key={i} gap="xs">
                    <Box w={8} h={8} style={{ borderRadius: '50%', backgroundColor: COLORS[i % COLORS.length] }} />
                    <Stack gap={0}>
                      <Text size="xs" c="dimmed" truncate w={90}>{item.name}</Text>
                      <Text size="xs" fw={800}>{((item.value / (filteredData.length || 1)) * 100).toFixed(1)}%</Text>
                    </Stack>
                  </Group>
                ))}
             </SimpleGrid>
           </Paper>
        </Grid.Col>

        <Grid.Col span={12}>
           <Paper radius="xl" p="xl" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)' }}>
             <InfoButton title="Balance Diario" detail={chartExplanations['Balance Diario']} />
             <Group justify="space-between" mb="md">
               <Text fw={700} size="sm">Balance Operativo Diario (Inicios vs Retiros)</Text>
               <SegmentedControl 
                 value={trendFilter}
                 onChange={setTrendFilter}
                 data={[
                   { label: '15 Días', value: '15' },
                   { label: '30 Días', value: '30' },
                   { label: '3 Meses', value: '90' },
                   { label: '1 Año', value: '365' },
                 ]}
                 size="xs"
                 radius="xl"
                 color="blue"
               />
             </Group>
             <Box h={300} w="100%">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={dailyInOutTrend} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} minTickGap={30} />
                   <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                   <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                   <Line type="monotone" dataKey="inicios" stroke="#0ea5e9" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Inicios" />
                   <Line type="monotone" dataKey="retiros" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 6 }} name="Retiros" />
                 </LineChart>
               </ResponsiveContainer>
             </Box>
           </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
           <Paper radius="xl" p="xl" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)', position: 'relative' }}>
             <InfoButton title="Top Centros" detail={chartExplanations['Top Centros']} />
             <Group justify="space-between" mb="md">
               <Text fw={700} size="sm">Top Centros Logísticos</Text>
               <Badge color="blue" variant="light">Zonas</Badge>
             </Group>
             <Box h={250} w="100%">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={centroAnalytics} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                   <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                   <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                   <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{fill: '#f8fafc'}} />
                   <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#0ea5e9" name="Servicios" />
                 </BarChart>
               </ResponsiveContainer>
             </Box>
           </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
           <Paper radius="xl" p="xl" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)', position: 'relative' }}>
             <InfoButton title="Carga por Día" detail={chartExplanations['Carga por Día']} />
             <Group justify="space-between" mb="md">
               <Text fw={700} size="sm">Carga por Día de la Semana</Text>
               <Badge color="grape" variant="light">Patrón</Badge>
             </Group>
             <Box h={250} w="100%">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={weekdayAnalytics} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                   <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                   <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                   <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{fill: '#f8fafc'}} />
                   <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#d946ef" name="Fichas Históricas" />
                 </BarChart>
               </ResponsiveContainer>
             </Box>
           </Paper>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
           <Paper radius="xl" p="xl" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)', position: 'relative' }}>
             <InfoButton title="Motivos de Cancelación" detail={chartExplanations['Motivos de Cancelación']} />
             <Group justify="space-between" mb="md">
               <Text fw={700} size="sm">Motivos de Cancelación</Text>
               <Badge color="red" variant="light">Pérdidas</Badge>
             </Group>
             <Box h={250} w="100%">
               {cancellationAnalytics.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={cancellationAnalytics} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                     <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                     <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                     <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{fill: '#f8fafc'}} />
                     <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#ef4444" name="Anulados" />
                   </BarChart>
                 </ResponsiveContainer>
               ) : (
                 <Center h="100%">
                   <Text c="dimmed" size="sm">No se registran anulaciones</Text>
                 </Center>
               )}
             </Box>
           </Paper>
        </Grid.Col>

      </Grid>

      {infoModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setInfoModal(null)}>
          <div style={{
            backgroundColor: 'white', padding: '3rem', borderRadius: '32px',
            maxWidth: '600px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            position: 'relative', animation: 'slideUp 0.3s ease-out'
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setInfoModal(null)} style={{
                position: 'absolute', top: '1.5rem', right: '1.5rem', border: 'none',
                background: 'none', cursor: 'pointer', color: '#9ca3af'
              }}>
              <IconX size={24} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
              <ThemeIcon size={56} radius="xl" color="blue" variant="light">
                <IconInfoCircle size={28} />
              </ThemeIcon>
              <Title order={3} fw={800} c="dark.9">{infoModal?.title}</Title>
            </div>

            <Stack gap="xl">
              <Box>
                <Text size="xs" fw={800} c="blue.6" tt="uppercase" lts={1} mb="xs">¿Qué muestra este gráfico?</Text>
                <Text c="dark.6" size="sm" lh={1.6}>{infoModal?.definition}</Text>
              </Box>
              <Box>
                <Text size="xs" fw={800} c="blue.6" tt="uppercase" lts={1} mb="xs">¿Cómo se procesa la información?</Text>
                <Text c="dark.6" size="sm" lh={1.6}>{infoModal?.operation}</Text>
              </Box>
              <Box>
                <Text size="xs" fw={800} c="blue.6" tt="uppercase" lts={1} mb="xs">Interpretación y Uso</Text>
                <Text c="dark.6" size="sm" lh={1.6}>{infoModal?.data}</Text>
              </Box>
            </Stack>

            <Button fullWidth size="lg" radius="xl" mt="xl" onClick={() => setInfoModal(null)} color="dark">
              Entendido
            </Button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </Box>
  );
};
