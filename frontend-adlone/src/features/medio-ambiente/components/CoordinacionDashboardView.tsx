import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  Paper, 
  Text, 
  Title, 
  Group, 
  Stack, 
  SimpleGrid, 
  Select, 
  Box,
  Tabs,
  Button
} from '@mantine/core';
import { 
  IconChevronLeft, 
  IconFilter, 
  IconX, 
  IconChartBar, 
  IconBuilding, 
  IconMapPin, 
  IconCalendar,
  IconAdjustmentsHorizontal,
  IconUsers,
  IconInfoCircle
} from '@tabler/icons-react';
import { DateInput } from '@mantine/dates';
import { fichaService } from '../services/ficha.service';

interface Props {
  onBack: () => void;
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6b7280', '#ec4899', '#06b6d4'];

const normalize = (s: string) => 
    (s || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();


export const CoordinacionDashboardView: React.FC<Props> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [operationalEvents, setOperationalEvents] = useState<any[]>([]);
  const [muestreadores, setMuestreadores] = useState<any[]>([]);
  const [estados, setEstados] = useState<any[]>([]);

  // Filters State
  const [filterMuestreador, setFilterMuestreador] = useState<string | null>(null);
  const [filterEstado, setFilterEstado] = useState<string | null>(null);
  const [filterEmpresaServicio, setFilterEmpresaServicio] = useState<string | null>(null);
  const [filterCentro, setFilterCentro] = useState<string | null>(null);
  const [filterObjetivo, setFilterObjetivo] = useState<string | null>(null);
  const [filterSubArea, setFilterSubArea] = useState<string | null>(null);
  const [filterDateFrom, setFilterDateFrom] = useState<Date | null>(null);
  const [filterDateTo, setFilterDateTo] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('operativa');

  // Info Modal State
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

        // --- ENRICH DATA ---
        const enriched: any[] = [];
        const eventFichaIds = new Set();

        (events || []).forEach((e: any) => {
          const fichaId = e.id_fichaingresoservicio || e.fichaingresoservicio || e.id;
          eventFichaIds.add(String(fichaId));
          const parentFicha = (fichas || []).find((f: any) => String(f.id_fichaingresoservicio || f.id || f.fichaingresoservicio) === String(fichaId));
          
          enriched.push({
            ...(parentFicha || {}),
            ...e,
            _muestreador_id: e.id_muestreador || null,
            _muestreador_name: (e.muestreador || e.nombre_muestreador || 'No Asignado').trim(),
            _status_name: (e.nombre_estadomuestreo || parentFicha?.estado_ficha || 'En Proceso').trim(),
            _status_id: e.id_estadomuestreo || null,
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
              _muestreador_id: f.id_muestreador || null,
              _muestreador_name: (f.muestreador || f.nombre_muestreador || 'No Asignado').trim(),
              _status_name: (f.estado_ficha || f.nombre_estadomuestreo || 'Pendiente Programar').trim(),
              _status_id: f.id_estadomuestreo || null,
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

        // --- DYNAMIC CATALOGS ---
        const uniqueMuentreadores = new Map();
        const uniqueEstados = new Map();
        const uniqueEmpresas = new Map();
        const uniqueObjetivos = new Map();
        const uniqueSubAreas = new Map();
        const uniqueCentros = new Map();

        enriched.forEach((f: any) => {
          if (f._muestreador_name && f._muestreador_name !== 'No Asignado') {
            uniqueMuentreadores.set(f._muestreador_name, { label: f._muestreador_name, value: f._muestreador_name });
          }
          if (f._status_name && f._status_name !== 'Sin Estado') {
            uniqueEstados.set(f._status_name, { label: f._status_name, value: f._status_name });
          }
          if (f._empresa_servicio_name && f._empresa_servicio_name !== 'Otros') {
            uniqueEmpresas.set(f._empresa_servicio_name, { label: f._empresa_servicio_name, value: f._empresa_servicio_name });
          }
          if (f._centro_name && f._centro_name !== 'Otros') {
            const key = `${f._centro_name}-${f._empresa_servicio_name}`;
            uniqueCentros.set(key, { label: f._centro_name, value: f._centro_name, empresa: f._empresa_servicio_name });
          }
          if (f._objetivo_name && f._objetivo_name !== 'Otro') {
            uniqueObjetivos.set(f._objetivo_name, { label: f._objetivo_name, value: f._objetivo_name });
          }
          if (f._subarea_name && f._subarea_name !== 'Global' && f._subarea_name !== 'Otro') {
            uniqueSubAreas.set(f._subarea_name, { label: f._subarea_name, value: f._subarea_name });
          }
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
    // Helper to match ISO for comparison
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
      // Status filter
      if (filterEstado) {
        if (f._status_name !== filterEstado) return false;
      }
      
      // Muestreador filter
      if (filterMuestreador) {
        if (f._muestreador_name !== filterMuestreador) return false;
      }

      // Empresa Servicio filter
      if (filterEmpresaServicio) {
        if (f._empresa_servicio_name !== filterEmpresaServicio) return false;
      }

      // Centro filter
      if (filterCentro) {
        if (f._centro_name !== filterCentro) return false;
      }

      // Objetivo filter
      if (filterObjetivo) {
        if (f._objetivo_name !== filterObjetivo) return false;
      }

      // SubArea filter
      if (filterSubArea) {
        if (f._subarea_name !== filterSubArea) return false;
      }

      // Date filter
      if (filterDateFrom || filterDateTo) {
        const rowDateStr = toISO(f._fecha || f.fecha || f.fecha_muestreo);
        if (!rowDateStr) return false;
        
        const rowDate = new Date(rowDateStr);
        if (filterDateFrom && rowDate < filterDateFrom) return false;
        if (filterDateTo && rowDate > filterDateTo) return false;
      }

      return true;
    });
  }, [data, filterEstado, filterMuestreador, filterEmpresaServicio, filterCentro, filterDateFrom, filterDateTo]);

  // --- Process Analytics ---
  
  // 1. Status Distribution

  // 2. Muestreador Performance (Count of samplings)
  const samplerAnalytics = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(f => {
      const m = f._muestreador_name || 'No Asignado';
      counts[m] = (counts[m] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredData]);

  // 3. Today's Agenda (Operational Events)
  const todayAgenda = useMemo(() => {
    const today = new Date();
    const tDia = today.getDate();
    const tMes = today.getMonth() + 1;
    const tAno = today.getFullYear();
    
    const events: any[] = [];
    
    operationalEvents.forEach(f => {
      // INICIO Event
      if (f.dia === tDia && f.mes === tMes && f.ano === tAno) {
        events.push({
          ...f,
          tipo_display: 'INICIO',
          id_display: f.fichaingresoservicio || f.id_fichaingresoservicio || f.id,
          muestreador_display: f.muestreador || f.muestreador_instalacion || 'Sin Asignar'
        });
      }
      
      // RETIRO Event
      if (f.fecha_retiro && f.fecha_retiro !== '01/01/1900') {
        const dRetiro = new Date(f.fecha_retiro);
        if (dRetiro.getUTCDate() === tDia && (dRetiro.getUTCMonth() + 1) === tMes && dRetiro.getUTCFullYear() === tAno) {
          events.push({
            ...f,
            tipo_display: 'RETIRO',
            id_display: f.fichaingresoservicio || f.id_fichaingresoservicio || f.id,
            muestreador_display: f.muestreador_retiro || f.muestreador || 'Sin Asignar'
          });
        }
      }
    });

    return events.slice(0, 10); // Show more items in the sidebar
  }, [operationalEvents]);

  // 4. Status Analytics
  const statusAnalytics = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(f => {
      const status = f._status_name || 'Sin Estado';
      counts[status] = (counts[status] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 8);
  }, [filteredData]);

  // 5. Monthly Trend
  // 6. Company Analytics (Comercial View)
  const companyAnalytics = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(f => {
      const company = f._empresa_servicio_name || 'Otros';
      counts[company] = (counts[company] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value).slice(0, 10);
  }, [filteredData]);

  // 7. Objective Distribution (Comercial View)
  const objectiveAnalytics = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(f => {
      const obj = f._objetivo_name || 'Otro';
      counts[obj] = (counts[obj] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value).slice(0, 8);
  }, [filteredData]);

  // 8. Center Analytics (Logística View)
  const centerAnalytics = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(f => {
      const center = f._centro_name || 'Otros';
      counts[center] = (counts[center] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value).slice(0, 10);
  }, [filteredData]);

  // 9. Sub-Area Analytics (Logística View)
  const subAreaAnalytics = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(f => {
      const sub = f._subarea_name || f.subarea || 'Global';
      counts[sub] = (counts[sub] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value).slice(0, 8);
  }, [filteredData]);

  // 5. Specialized Trend Analytics
  const trendAnalytics = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for(let i=5; i>=0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toLocaleString('es-ES', { month: 'short', year: '2-digit' }));
    }

    if (activeTab === 'operativa') {
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
          if (normalize(f._status_name).includes('ejecutado')) {
            monthlyData[label].ejecutados++;
          } else {
            monthlyData[label].pendientes++;
          }
        }
      });
      return Object.values(monthlyData);
    } 
    
    if (activeTab === 'comercial') {
      const topObjectives = objectiveAnalytics.map(o => o.name);
      const monthlyData: Record<string, any> = {};
      months.forEach(m => {
        monthlyData[m] = { name: m };
        topObjectives.forEach(obj => monthlyData[m][obj] = 0);
      });

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
        const obj = f._objetivo_name || 'Otro';
        if (monthlyData[label] && topObjectives.includes(obj)) {
          monthlyData[label][obj]++;
        }
      });
      return Object.values(monthlyData);
    }

    if (activeTab === 'logistica') {
      const monthlyData: Record<string, { name: string, centros: Set<string>, volume: number }> = {};
      months.forEach(m => monthlyData[m] = { name: m, centros: new Set(), volume: 0 });

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
          monthlyData[label].volume++;
          if (f._centro_name) monthlyData[label].centros.add(f._centro_name);
        }
      });
      return Object.values(monthlyData).map(m => ({
        name: m.name,
        centros: m.centros.size,
        volume: m.volume
      }));
    }

    return [];
  }, [filteredData, activeTab, objectiveAnalytics]);

  // 10. Drill-down interaction helper
  const handleChartClick = (type: 'muestreador' | 'estado' | 'empresa' | 'centro' | 'objetivo' | 'subarea', value: string) => {
    if (!value) return;
    switch(type) {
      case 'muestreador': setFilterMuestreador(value); break;
      case 'estado': setFilterEstado(value); break;
      case 'empresa': setFilterEmpresaServicio(value); setFilterCentro(''); break;
      case 'centro': setFilterCentro(value); break;
      case 'objetivo': setFilterObjetivo(value); break;
      case 'subarea': setFilterSubArea(value); break;
    }
  };


  // --- Render Helpers ---

  const StatCard = ({ title, value, sub, color, icon }: { title: string, value: string | number, sub: string, color: string, icon: React.ReactNode }) => (
    <Paper radius="lg" p="md" withBorder shadow="sm" style={{ borderLeft: `4px solid ${color}` }}>
      <Group justify="space-between" align="center">
        <Stack gap={0}>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase">{title}</Text>
          <Group align="baseline" gap="xs">
            <Text size="xl" fw={800}>{value}</Text>
            <Text size="xs" c="dimmed">{sub}</Text>
          </Group>
        </Stack>
        <Box 
          p="xs" 
          style={{ 
            backgroundColor: `${color}15`, 
            color: color,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {icon}
        </Box>
      </Group>
    </Paper>
  );

  const InfoButton = ({ title, detail }: { title: string, detail: any }) => (
    <button 
      onClick={() => setInfoModal({ title, ...detail })}
      style={{
        position: 'absolute',
        top: '1.25rem',
        right: '1.25rem',
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        backgroundColor: '#f3f4f6',
        border: 'none',
        color: '#6b7280',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        zIndex: 10
      }}
      title="Información del gráfico"
      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    </button>
  );

  const chartExplanations: Record<string, { definition: string, operation: string, data: string }> = {
    'Carga por Muestreador': {
      definition: 'Histograma de carga operativa individual para el equipo de terreno.',
      operation: 'Agrupa todos los muestreos (ejecutados y pendientes) del periodo seleccionado por el nombre del técnico asignado.',
      data: 'Muestra quién tiene el mayor volumen de trabajo, permitiendo detectar cuellos de botella o desbalances en la asignación.'
    },
    'Eficiencia de Ejecución': {
      definition: 'Gráfico de tendencia temporal que compara el progreso de las tareas.',
      operation: 'Rastrea mes a mes la cantidad de muestreos que cambian a estado "Ejecutado" frente a los que permanecen en estados previos.',
      data: 'Permite visualizar si la capacidad operativa está aumentando o si hay una acumulación atípica de tareas pendientes en el tiempo.'
    },
    'Distribución de Estados': {
      definition: 'Gráfico circular que muestra la "salud" instantánea de la operación.',
      operation: 'Divide el total de muestreos filtrados en sectores proporcionales según su estado actual en el flujo de trabajo.',
      data: 'Identifica rápidamente qué porcentaje del trabajo total ya está finalizado, cuántos están en terreno y cuántos faltan por iniciar.'
    },
    'Agenda para Hoy': {
      definition: 'Panel de control de hitos críticos para la jornada actual.',
      operation: 'Filtra eventos de instalación ("INICIO") y retiro de equipos ("RETIRO") que ocurren en la fecha del sistema.',
      data: 'Muestra las tareas inmediatas que deben ser supervisadas hoy, incluyendo el técnico responsable y la ubicación.'
    },
    'Carga por Empresa Servicio': {
      definition: 'Desglose comercial del volumen de operación por proveedor externo.',
      operation: 'Suma todos los muestreos asociados a cada empresa de servicios o cliente corporativo.',
      data: 'Revela qué proveedores están generando la mayor demanda de servicios y ayuda a priorizar relaciones comerciales.'
    },
    'Crecimiento por Objetivo': {
      definition: 'Análisis de evolución de la demanda por tipo de servicio.',
      operation: 'Apila temporalmente los diferentes objetivos de muestreo para ver cómo varía el mix de servicios mes a mes.',
      data: 'Muestra qué tipos de análisis (ej. Fisicoquímicos vs Biológicos) están creciendo en importancia o frecuencia.'
    },
    'Mix de Objetivos': {
      definition: 'Distribución porcentual de los tipos de servicios solicitados.',
      operation: 'Muestra la relevancia de cada objetivo de muestreo dentro del volumen total comercial.',
      data: 'Ayuda a entender el perfil de servicio más común de la empresa y hacia dónde se orientan los recursos.'
    },
    'Insights de Rendimiento': {
      definition: 'Métricas clave de éxito y máximos operativos.',
      operation: 'Calcula automáticamente el proveedor con mayor volumen y la categoría predominante en el conjunto de datos activo.',
      data: 'Destaca directamente los puntos más relevantes del dashboard sin necesidad de analizar cada gráfico individual.'
    },
    'Volumen por Centro de Muestreo': {
      definition: 'Ranking de actividad por locación física o instalación.',
      operation: 'Agrupa los registros por el nombre del centro o planta de cultivo donde se realiza el muestreo.',
      data: 'Identifica los puntos geográficos de mayor concentración operativa, útil para optimizar rutas y logística.'
    },
    'Cobertura de Centros': {
      definition: 'Relación entre infraestructura atendida y volumen de muestras.',
      operation: 'Compara la cantidad de centros únicos visitados cada mes con el volumen total de muestreos realizados.',
      data: 'Indica si el aumento de volumen se debe a más muestras por centro o a que se están atendiendo más ubicaciones.'
    },
    'Áreas Ambientales': {
      definition: 'Clasificación de la operación por matriz o entorno ambiental.',
      operation: 'Segmenta el volumen total según el área de impacto (Mar, RILes, Agua Potable, etc.).',
      data: 'Muestra la especialización ambiental del periodo y permite asegurar que se cumplen los requisitos por matriz.'
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '500px', gap: '1rem' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #f3f4f6', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#6b7280', fontWeight: 500 }}>Analizando datos de coordinación...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="dashboard-container" style={{ padding: '0 1.5rem 2rem 1.5rem', animation: 'fadeIn 0.6s ease-out' }}>
      
      {/* Header & Controls */}
      <Box mb="xl" pos="relative">
        <Group justify="space-between" align="center">
          <Button 
            variant="light" 
            color="gray" 
            leftSection={<IconChevronLeft size={16} />}
            onClick={onBack}
            radius="md"
          >
            Cerrar Dashboard
          </Button>

          <Stack gap={0} align="center">
            <Title order={2} fw={800} style={{ letterSpacing: '-0.025em' }}>
              {activeTab === 'operativa' ? 'Gestión Operativa' : activeTab === 'comercial' ? 'Servicios y Clientes' : 'Logística de Centros'}
            </Title>
            <Text c="dimmed" fw={500} size="sm">
              {activeTab === 'operativa' ? 'Seguimiento de muestreadores y ejecución' : activeTab === 'comercial' ? 'Análisis de mercado y objetivos de servicio' : 'Rendimiento por centros y áreas ambientales'}
            </Text>
          </Stack>

          <Button 
            variant="outline" 
            color="red" 
            leftSection={<IconX size={16} />}
            onClick={() => {
              setFilterMuestreador(null);
              setFilterEstado(null);
              setFilterEmpresaServicio(null);
              setFilterCentro(null);
              setFilterObjetivo(null);
              setFilterSubArea(null);
              setFilterDateFrom(null);
              setFilterDateTo(null);
            }}
            radius="md"
          >
            Resetear Filtros
          </Button>
        </Group>
      </Box>

      <Tabs value={activeTab} onChange={setActiveTab} variant="outline" radius="md" mb="xl">
        <Tabs.List grow>
          <Tabs.Tab 
            value="operativa" 
            leftSection={<IconUsers size={16} />}
            style={{ fontWeight: 700 }}
          >
            Gestión Operativa
          </Tabs.Tab>
          <Tabs.Tab 
            value="comercial" 
            leftSection={<IconBuilding size={16} />}
            style={{ fontWeight: 700 }}
          >
            Servicios y Clientes
          </Tabs.Tab>
          <Tabs.Tab 
            value="logistica" 
            leftSection={<IconMapPin size={16} />}
            style={{ fontWeight: 700 }}
          >
            Logística y Centros
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {/* Dynamic Filter Bar based on Tab */}
      <Paper radius="lg" p="md" withBorder shadow="xs" mb="xl">
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4, lg: 5 }} spacing="md">
          {activeTab === 'operativa' && (
            <>
              <Select 
                label="Muestreador"
                placeholder="Todos"
                data={muestreadores}
                value={filterMuestreador}
                onChange={setFilterMuestreador}
                clearable
                leftSection={<IconUsers size={16} />}
              />
              <Select 
                label="Estado"
                placeholder="Todos"
                data={estados}
                value={filterEstado}
                onChange={setFilterEstado}
                clearable
                leftSection={<IconAdjustmentsHorizontal size={16} />}
              />
            </>
          )}

          {activeTab === 'comercial' && (
            <>
              <Select 
                label="Empresa Servicio"
                placeholder="Todas"
                data={empresasServicio}
                value={filterEmpresaServicio}
                onChange={(v) => { setFilterEmpresaServicio(v); setFilterCentro(null); }}
                clearable
                leftSection={<IconBuilding size={16} />}
              />
              <Select 
                label="Objetivo"
                placeholder="Todos"
                data={objetivos}
                value={filterObjetivo}
                onChange={setFilterObjetivo}
                clearable
                leftSection={<IconChartBar size={16} />}
              />
            </>
          )}

          {activeTab === 'logistica' && (
            <>
              <Select 
                label="Centro"
                placeholder="Todos"
                data={Array.from(new Map(centros.filter(c => !filterEmpresaServicio || c.empresa === filterEmpresaServicio).map(c => [c.value, c])).values())}
                value={filterCentro}
                onChange={setFilterCentro}
                clearable
                searchable
                leftSection={<IconMapPin size={16} />}
              />
              <Select 
                label="Sub-Área"
                placeholder="Todas"
                data={subAreas}
                value={filterSubArea}
                onChange={setFilterSubArea}
                clearable
                leftSection={<IconFilter size={16} />}
              />
            </>
          )}

          <DateInput 
            label="Desde"
            placeholder="Fecha inicio"
            value={filterDateFrom}
            onChange={(val: any) => setFilterDateFrom(val)}
            clearable
            leftSection={<IconCalendar size={16} />}
          />
          <DateInput 
            label="Hasta"
            placeholder="Fecha fin"
            value={filterDateTo}
            onChange={(val: any) => setFilterDateTo(val)}
            clearable
            leftSection={<IconCalendar size={16} />}
          />
        </SimpleGrid>
      </Paper>

      {/* Specialized Stat Cards by Tab */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg" mb="xl">
        {activeTab === 'operativa' && (
          <>
            <StatCard title="Muestreos Totales" value={filteredData.length} sub="Unidades de trabajo" color="#8b5cf6" icon={<IconChartBar size={24} />} />
            <StatCard title="En Proceso" value={filteredData.filter(f => normalize(f._status_name).includes('proceso')).length} sub="Activos ahora" color="#3b82f6" icon={<IconAdjustmentsHorizontal size={24} />} />
            <StatCard title="Ejecutados" value={filteredData.filter(f => normalize(f._status_name).includes('ejecutado')).length} sub="Completados" color="#10b981" icon={<IconChartBar size={24} />} />
            <StatCard title="Cancelados" value={filteredData.filter(f => normalize(f._status_name).includes('cancela')).length} sub="Sin ejecución" color="#ef4444" icon={<IconX size={24} />} />
          </>
        )}
        {activeTab === 'comercial' && (
          <>
            <StatCard title="Empresas Vigentes" value={new Set(filteredData.map(f => f._empresa_servicio_name)).size} sub="Proveedores" color="#8b5cf6" icon={<IconBuilding size={24} />} />
            <StatCard title="Proyectos" value={new Set(filteredData.map(f => f._id_ficha)).size} sub="Fichas activas" color="#6366f1" icon={<IconBuilding size={24} />} />
            <StatCard title="Objetivos Únicos" value={new Set(filteredData.map(f => f._objetivo_name)).size} sub="Tipos de servicio" color="#ec4899" icon={<IconAdjustmentsHorizontal size={24} />} />
            <StatCard title="Muestreos Totales" value={filteredData.length} sub="Volumen de servicio" color="#10b981" icon={<IconChartBar size={24} />} />
          </>
        )}
        {activeTab === 'logistica' && (
          <>
            <StatCard title="Centros Atendidos" value={new Set(filteredData.map(f => f._centro_name)).size} sub="Ubicaciones" color="#059669" icon={<IconMapPin size={24} />} />
            <StatCard title="Sub-Áreas" value={new Set(filteredData.map(f => f._subarea_name)).size} sub="Sectores" color="#0ea5e9" icon={<IconFilter size={24} />} />
            <StatCard title="Muestreos x Centro" value={(filteredData.length / (new Set(filteredData.map(f => f._centro_name)).size || 1)).toFixed(1)} sub="Promedio carga" color="#f59e0b" icon={<IconChartBar size={24} />} />
            <StatCard title="Eficiencia" value={((filteredData.filter(f => normalize(f._status_name).includes('ejecutado')).length / (filteredData.length || 1)) * 100).toFixed(0) + '%'} sub="Tasa ejecución" color="#10b981" icon={<IconChartBar size={24} />} />
          </>
        )}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="xl">
        {/* Main Chart Column */}
        <Stack gap="xl">
          
          {activeTab === 'operativa' && (
            <Paper withBorder radius="lg" p="xl" shadow="sm" pos="relative">
              <InfoButton title="Carga por Muestreador" detail={chartExplanations['Carga por Muestreador']} />
              <Title order={4} ta="center" mb="lg">Carga por Muestreador</Title>
              <div style={{ height: 350, minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={samplerAnalytics} layout="vertical" onClick={(data) => { if(data?.activeLabel) handleChartClick('muestreador', String(data.activeLabel)); }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24} name="Muestreos">
                      {samplerAnalytics.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Paper>
          )}

          {activeTab === 'comercial' && (
            <Paper withBorder radius="lg" p="xl" shadow="sm" pos="relative">
              <InfoButton title="Carga por Empresa Servicio" detail={chartExplanations['Carga por Empresa Servicio']} />
              <Title order={4} ta="center" mb="lg">Carga por Empresa Servicio</Title>
              <div style={{ height: 350, minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={companyAnalytics} layout="vertical" onClick={(data) => { if(data?.activeLabel) handleChartClick('empresa', String(data.activeLabel)); }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={150} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 8, 8, 0]} barSize={24} name="Muestreos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Paper>
          )}

          {activeTab === 'logistica' && (
            <Paper withBorder radius="lg" p="xl" shadow="sm" pos="relative">
              <InfoButton title="Volumen por Centro de Muestreo" detail={chartExplanations['Volumen por Centro de Muestreo']} />
              <Title order={4} ta="center" mb="lg">Volumen por Centro de Muestreo</Title>
              <div style={{ height: 350, minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={centerAnalytics} layout="vertical" onClick={(data) => { if(data?.activeLabel) handleChartClick('centro', String(data.activeLabel)); }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={150} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="value" fill="#059669" radius={[0, 8, 8, 0]} barSize={24} name="Muestreos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Paper>
          )}

          <Paper withBorder radius="lg" p="xl" shadow="sm" pos="relative">
            <InfoButton 
              title={activeTab === 'operativa' ? 'Eficiencia de Ejecución' : activeTab === 'comercial' ? 'Crecimiento por Objetivo' : 'Cobertura de Centros'} 
              detail={chartExplanations[activeTab === 'operativa' ? 'Eficiencia de Ejecución' : activeTab === 'comercial' ? 'Crecimiento por Objetivo' : 'Cobertura de Centros']} 
            />
            <Title order={4} ta="center" mb="lg">
              {activeTab === 'operativa' ? 'Eficiencia de Ejecución' : activeTab === 'comercial' ? 'Crecimiento por Objetivo' : 'Cobertura de Centros'}
            </Title>
            <div style={{ height: 250, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                {activeTab === 'operativa' ? (
                  <AreaChart data={trendAnalytics}>
                    <defs>
                      <linearGradient id="colorEjec" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                      <linearGradient id="colorPend" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="ejecutados" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorEjec)" name="Ejecutados" />
                    <Area type="monotone" dataKey="pendientes" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorPend)" name="Pendientes" />
                  </AreaChart>
                ) : activeTab === 'comercial' ? (
                  <AreaChart data={trendAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                    {objectiveAnalytics.map((obj, i) => (
                      <Area key={obj.name} type="monotone" dataKey={obj.name} stackId="1" stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.6} />
                    ))}
                  </AreaChart>
                ) : (
                  <BarChart data={trendAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                    <Bar dataKey="centros" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Centros Únicos" />
                    <Bar dataKey="volume" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Volumen Muestreos" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </Paper>
        </Stack>

        {/* Sidebar Column */}
        <Stack gap="xl">
          
          <Paper withBorder radius="lg" p="xl" shadow="sm" pos="relative">
            <InfoButton 
              title={activeTab === 'operativa' ? 'Distribución de Estados' : activeTab === 'comercial' ? 'Mix de Objetivos' : 'Áreas Ambientales'} 
              detail={chartExplanations[activeTab === 'operativa' ? 'Distribución de Estados' : activeTab === 'comercial' ? 'Mix de Objetivos' : 'Áreas Ambientales']} 
            />
            <Title order={4} ta="center" mb="lg">
              {activeTab === 'operativa' ? 'Distribución de Estados' : activeTab === 'comercial' ? 'Mix de Objetivos' : 'Áreas Ambientales'}
            </Title>
            <div style={{ height: 280, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activeTab === 'operativa' ? statusAnalytics : activeTab === 'comercial' ? objectiveAnalytics : subAreaAnalytics}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    onClick={(data) => { if(data?.name) handleChartClick(activeTab === 'operativa' ? 'estado' : activeTab === 'comercial' ? 'objetivo' : 'subarea', String(data.name)); }}
                  >
                    {(activeTab === 'operativa' ? statusAnalytics : activeTab === 'comercial' ? objectiveAnalytics : subAreaAnalytics).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <Stack gap="xs" mt="md">
              {(activeTab === 'operativa' ? statusAnalytics : activeTab === 'comercial' ? objectiveAnalytics : subAreaAnalytics).slice(0, 5).map((item, i) => (
                <Group key={i} justify="space-between" style={{ cursor: 'pointer' }} onClick={() => handleChartClick(activeTab === 'operativa' ? 'estado' : activeTab === 'comercial' ? 'objetivo' : 'subarea', String(item.name))}>
                  <Group gap="xs">
                    <Box style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: COLORS[i % COLORS.length] }} />
                    <Text size="xs" c="dimmed" truncate style={{ maxWidth: 120 }}>{item.name}</Text>
                  </Group>
                  <Text size="xs" fw={700}>{item.value}</Text>
                </Group>
              ))}
            </Stack>
          </Paper>

          <Paper withBorder radius="lg" p="xl" shadow="sm" flex={1} pos="relative">
            <InfoButton 
              title={activeTab === 'operativa' ? 'Agenda para Hoy' : 'Insights de Rendimiento'} 
              detail={chartExplanations[activeTab === 'operativa' ? 'Agenda para Hoy' : 'Insights de Rendimiento']} 
            />
            <Title order={4} ta="center" mb="lg">
               {activeTab === 'operativa' ? 'Agenda para Hoy' : 'Insights de Rendimiento'}
            </Title>
            <Stack gap="md">
              {activeTab === 'operativa' ? (
                todayAgenda.slice(0, 5).map((event: any, idx: number) => (
                  <Paper key={idx} p="sm" radius="md" withBorder style={{ borderLeft: `4px solid ${event.tipo_display === 'INICIO' ? '#3b82f6' : '#ef4444'}` }}>
                    <Text size="xs" fw={700}>{event.tipo_display}</Text>
                    <Text size="sm">{event.muestreador_display}</Text>
                    <Text size="xs" c="dimmed">{event._centro_name || event.nombre_empresaservicios}</Text>
                  </Paper>
                ))
              ) : (
                <>
                  <Paper p="md" radius="lg" bg="blue.0">
                    <Text size="xs" c="blue.7" fw={700} mb={4}>MÁXIMO VOLUMEN</Text>
                    <Text size="sm" fw={700}>
                      {activeTab === 'comercial' ? String(companyAnalytics[0]?.name || 'N/A') : String(centerAnalytics[0]?.name || 'N/A')}
                    </Text>
                  </Paper>
                  <Paper p="md" radius="lg" bg="pink.0">
                    <Text size="xs" c="pink.7" fw={700} mb={4}>PREDOMINANTE</Text>
                    <Text size="sm" fw={700}>
                      {activeTab === 'comercial' ? String(objectiveAnalytics[0]?.name || 'N/A') : String(subAreaAnalytics[0]?.name || 'N/A')}
                    </Text>
                  </Paper>
                </>
              )}
            </Stack>
          </Paper>
        </Stack>
      </SimpleGrid>

      {/* Info Modal */}
      {infoModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out'
        }} onClick={() => setInfoModal(null)}>
          <div style={{
            backgroundColor: 'white',
            padding: '2.5rem 2rem',
            borderRadius: '24px',
            maxWidth: '800px',
            width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            position: 'relative',
            animation: 'slideUp 0.3s ease-out',
            maxHeight: '85vh',
            overflowY: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setInfoModal(null)}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: '#9ca3af'
              }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ width: 44, height: 44, borderRadius: '12px', backgroundColor: '#8b5cf615', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconInfoCircle size={22} />
              </div>
              <Title order={3}>{infoModal?.title}</Title>
            </div>

            <Stack gap="xl">
              <div>
                <Text size="xs" fw={800} c="blue" tt="uppercase" lts="0.05em" mb={4}>¿QUÉ ES?</Text>
                <Text color="dimmed" size="sm" lh={1.6}>{infoModal?.definition}</Text>
              </div>
              <div>
                <Text size="xs" fw={800} c="blue" tt="uppercase" lts="0.05em" mb={4}>¿CÓMO FUNCIONA?</Text>
                <Text color="dimmed" size="sm" lh={1.6}>{infoModal?.operation}</Text>
              </div>
              <div>
                <Text size="xs" fw={800} c="blue" tt="uppercase" lts="0.05em" mb={4}>¿QUÉ MUESTRAN LOS DATOS?</Text>
                <Text color="dimmed" size="sm" lh={1.6}>{infoModal?.data}</Text>
              </div>
            </Stack>

            <button 
              onClick={() => setInfoModal(null)}
              className="btn-primary"
              style={{ width: '100%', marginTop: '2rem', borderRadius: '14px', padding: '12px', fontWeight: 700 }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .filter-group select, .filter-group input {
          transition: all 0.2s ease;
        }
        .filter-group select:focus, .filter-group input:focus {
          border-color: #8b5cf6 !important;
          box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1);
        }
      `}</style>
    </div>
  );
};
