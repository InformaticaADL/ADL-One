
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { fichaService } from '../services/ficha.service';

interface Props {
  onBack: () => void;
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#6b7280', '#ec4899', '#06b6d4'];

export const CoordinacionDashboardView: React.FC<Props> = ({ onBack }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [operationalEvents, setOperationalEvents] = useState<any[]>([]);
  const [muestreadores, setMuestreadores] = useState<any[]>([]);
  const [estados, setEstados] = useState<any[]>([]);

  // Filters State
  const [filterMuestreador, setFilterMuestreador] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterEmpresaServicio, setFilterEmpresaServicio] = useState('');
  const [filterCentro, setFilterCentro] = useState('');
  const [filterObjetivo, setFilterObjetivo] = useState('');
  const [filterSubArea, setFilterSubArea] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [activeTab, setActiveTab] = useState<'operativa' | 'comercial' | 'logistica'>('operativa');

  // Info Modal State
  const [infoModal, setInfoModal] = useState<{ title: string, definition: string, operation: string, data: string } | null>(null);

  const [empresasServicio, setEmpresasServicio] = useState<any[]>([]);
  const [centros, setCentros] = useState<any[]>([]);
  const [objetivos, setObjetivos] = useState<any[]>([]);
  const [subAreas, setSubAreas] = useState<any[]>([]);


  const normalize = (s: string) => 
    (s || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();


  useEffect(() => {
    const fetchData = async () => {
      try {
        const [fichasRes, opRes] = await Promise.all([
          fichaService.getAll(),
          fichaService.getEnProceso() // Fetch ALL operational data for full enrichment
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
            _muestreador_name: e.muestreador || e.nombre_muestreador || 'No Asignado',
            _status_name: e.nombre_estadomuestreo || parentFicha?.estado_ficha || 'En Proceso',
            _status_id: e.id_estadomuestreo || null,
            _fecha: e.fecha || e.fecha_muestreo || parentFicha?.fecha || null,
            _id_ficha: fichaId,
            _empresa_servicio_name: e.empresa_servicio || e.nombre_empresaservicios || parentFicha?.empresa_servicio || parentFicha?.nombre_empresaservicios || 'Otros',
            _centro_name: e.centro || e.nombre_centro || parentFicha?.centro || parentFicha?.nombre_centro || 'Otros',
            _objetivo_name: e.objetivo || e.nombre_objetivo || parentFicha?.objetivo || parentFicha?.nombre_objetivo || 'Otro',
            _subarea_name: e.subarea || e.nombre_subarea || parentFicha?.subarea || parentFicha?.nombre_subarea || 'Global'
          });
        });

        // 2. Add fichas that don't have operational events yet
        (fichas || []).forEach((f: any) => {
          const fichaId = f.id_fichaingresoservicio || f.id || f.fichaingresoservicio;
          if (!eventFichaIds.has(String(fichaId))) {
            enriched.push({
              ...f,
              _muestreador_id: f.id_muestreador || null,
              _muestreador_name: f.muestreador || f.nombre_muestreador || 'No Asignado',
              _status_name: f.estado_ficha || f.nombre_estadomuestreo || 'Pendiente Programar',
              _status_id: f.id_estadomuestreo || null,
              _fecha: f.fecha || null,
              _id_ficha: fichaId,
              _empresa_servicio_name: f.empresa_servicio || f.nombre_empresaservicios || 'Otros',
              _centro_name: f.centro || f.nombre_centro || 'Otros',
              _objetivo_name: f.objetivo || f.nombre_objetivo || 'Otro',
              _subarea_name: f.subarea || f.nombre_subarea || 'Global'
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
        const allCentros: any[] = [];

        enriched.forEach((f: any) => {
          if (f._muestreador_name && f._muestreador_name !== 'No Asignado') {
            uniqueMuentreadores.set(f._muestreador_name, { id: f._muestreador_id || f._muestreador_name, nombre: f._muestreador_name });
          }
          if (f._status_name && f._status_name !== 'Sin Estado') {
            uniqueEstados.set(f._status_name, { id: f._status_id || f._status_name, nombre: f._status_name });
          }
          if (f._empresa_servicio_name && f._empresa_servicio_name !== 'Otros') {
            uniqueEmpresas.set(f._empresa_servicio_name, { id: f._empresa_servicio_name, nombre: f._empresa_servicio_name });
          }
          if (f._centro_name && f._centro_name !== 'Otros') {
            allCentros.push({ nombre: f._centro_name, empresa: f._empresa_servicio_name });
          }
          if (f._objetivo_name && f._objetivo_name !== 'Otro') {
            uniqueObjetivos.set(f._objetivo_name, { id: f._objetivo_name, nombre: f._objetivo_name });
          }
          if (f._subarea_name && f._subarea_name !== 'Global' && f._subarea_name !== 'Otro') {
            uniqueSubAreas.set(f._subarea_name, { id: f._subarea_name, nombre: f._subarea_name });
          }
        });

        setMuestreadores(Array.from(uniqueMuentreadores.values()).sort((a,b) => a.nombre.localeCompare(b.nombre)));
        setEstados(Array.from(uniqueEstados.values()).sort((a,b) => a.nombre.localeCompare(b.nombre)));
        setEmpresasServicio(Array.from(uniqueEmpresas.values()).sort((a,b) => a.nombre.localeCompare(b.nombre)));
        setObjetivos(Array.from(uniqueObjetivos.values()).sort((a,b) => a.nombre.localeCompare(b.nombre)));
        setSubAreas(Array.from(uniqueSubAreas.values()).sort((a,b) => a.nombre.localeCompare(b.nombre)));
        setCentros(allCentros);

      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Filter Logic ---
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
        const val = normalize(filterEstado);
        const match = 
          normalize(f._status_name).includes(val) || 
          String(f._status_id) === filterEstado;
        if (!match) return false;
      }
      
      // Muestreador filter
      if (filterMuestreador) {
        const val = normalize(filterMuestreador);
        const match = 
          normalize(f._muestreador_name).includes(val) || 
          String(f._muestreador_id) === filterMuestreador;
        if (!match) return false;
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
        
        if (filterDateFrom && rowDateStr < filterDateFrom) return false;
        if (filterDateTo && rowDateStr > filterDateTo) return false;
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
    <div style={{
      backgroundColor: 'white',
      padding: '1.25rem',
      borderRadius: '20px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
      border: '1px solid #f3f4f6',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem'
    }}>
      <div style={{ 
        width: 48, height: 48, borderRadius: '12px', backgroundColor: `${color}15`, 
        color, display: 'flex', alignItems: 'center', justifyContent: 'center' 
      }}>
        {icon}
      </div>
      <div>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase' }}>{title}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>{value}</span>
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{sub}</span>
        </div>
      </div>
    </div>
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
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        marginBottom: '2rem', 
        position: 'relative',
        padding: '0 1rem'
      }}>
        <div style={{ position: 'absolute', left: 0 }}>
          <button onClick={onBack} className="btn-back" style={{ margin: 0, padding: '8px 16px', borderRadius: '10px' }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 16 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Cerrar Dashboard
          </button>
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', letterSpacing: '-0.025em', marginBottom: '0.25rem' }}>
            {activeTab === 'operativa' ? 'Gestión Operativa' : activeTab === 'comercial' ? 'Servicios y Clientes' : 'Logística de Centros'}
          </h2>
          <p style={{ fontSize: '1rem', color: '#6b7280', fontWeight: 500 }}>
            {activeTab === 'operativa' ? 'Seguimiento de muestreadores y ejecución' : activeTab === 'comercial' ? 'Análisis de mercado y objetivos de servicio' : 'Rendimiento por centros y áreas ambientales'}
          </p>
        </div>

        <div style={{ position: 'absolute', right: 0 }}>
          <button 
            onClick={() => {
              setFilterMuestreador('');
              setFilterEstado('');
              setFilterEmpresaServicio('');
              setFilterCentro('');
              setFilterObjetivo('');
              setFilterSubArea('');
              setFilterDateFrom('');
              setFilterDateTo('');
            }}
            className="btn-secondary"
            style={{ 
              padding: '8px 16px', 
              borderRadius: '10px', 
              fontSize: '0.85rem',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#fee2e2';
              e.currentTarget.style.color = '#dc2626';
              e.currentTarget.style.borderColor = '#fca5a5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '';
              e.currentTarget.style.color = '';
              e.currentTarget.style.borderColor = '';
            }}
          >
            Resetear Filtros
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb', padding: '0 0.5rem' }}>
        {[
          { id: 'operativa', label: 'Gestión Operativa', icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v10m-5-5h10M5 20h14" /></svg> },
          { id: 'comercial', label: 'Servicios y Clientes', icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8z" /></svg> },
          { id: 'logistica', label: 'Logística y Centros', icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.75rem 0.25rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: activeTab === tab.id ? '#8b5cf6' : '#6b7280',
              border: 'none',
              backgroundColor: 'transparent',
              borderBottom: activeTab === tab.id ? '3px solid #8b5cf6' : '3px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '-2px'
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dynamic Filter Bar based on Tab */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '1.25rem', 
        borderRadius: '20px', 
        marginBottom: '2rem', 
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.04)',
        border: '1px solid #f3f4f6',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '1rem',
        alignItems: 'end'
      }}>
        {activeTab === 'operativa' && (
          <>
            <div className="filter-group">
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem', display: 'block' }}>MUESTREADOR</label>
              <select value={filterMuestreador} onChange={(e) => setFilterMuestreador(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '0.8rem' }}>
                <option value="">Todos</option>
                {muestreadores.map(m => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem', display: 'block' }}>ESTADO</label>
              <select value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '0.8rem' }}>
                <option value="">Todos</option>
                {estados.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
              </select>
            </div>
          </>
        )}

        {activeTab === 'comercial' && (
          <>
            <div className="filter-group">
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem', display: 'block' }}>EMPRESA SERVICIO</label>
              <select value={filterEmpresaServicio} onChange={(e) => { setFilterEmpresaServicio(e.target.value); setFilterCentro(''); }} style={{ width: '100%', padding: '8px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '0.8rem' }}>
                <option value="">Todas</option>
                {empresasServicio.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem', display: 'block' }}>OBJETIVO</label>
              <select value={filterObjetivo} onChange={(e) => setFilterObjetivo(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '0.8rem' }}>
                <option value="">Todos</option>
                {objetivos.map(o => <option key={o.id} value={o.nombre}>{o.nombre}</option>)}
              </select>
            </div>
          </>
        )}

        {activeTab === 'logistica' && (
          <>
            <div className="filter-group">
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem', display: 'block' }}>CENTRO</label>
              <select value={filterCentro} onChange={(e) => setFilterCentro(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '0.8rem' }}>
                <option value="">Todos</option>
                {Array.from(new Set(centros.filter(c => !filterEmpresaServicio || c.empresa === filterEmpresaServicio).map(c => c.nombre)))
                  .sort().map(c => <option key={c as string} value={c as string}>{c as string}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem', display: 'block' }}>SUB-ÁREA</label>
              <select value={filterSubArea} onChange={(e) => setFilterSubArea(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '0.8rem' }}>
                <option value="">Todas</option>
                {subAreas.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
              </select>
            </div>
          </>
        )}

        <div className="filter-group">
          <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem', display: 'block' }}>DESDE</label>
          <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '0.8rem' }} />
        </div>
        <div className="filter-group">
          <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#374151', marginBottom: '0.4rem', display: 'block' }}>HASTA</label>
          <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '10px', border: '1px solid #e5e7eb', fontSize: '0.8rem' }} />
        </div>
      </div>

      {/* Specialized Stat Cards by Tab */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {activeTab === 'operativa' && (
          <>
            <StatCard title="Muestreos Totales" value={filteredData.length} sub="Unidades de trabajo" color="#8b5cf6" icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} />
            <StatCard title="En Proceso" value={filteredData.filter(f => normalize(f._status_name).includes('proceso')).length} sub="Activos ahora" color="#3b82f6" icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>} />
            <StatCard title="Ejecutados" value={filteredData.filter(f => normalize(f._status_name).includes('ejecutado')).length} sub="Completados" color="#10b981" icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>} />
            <StatCard title="Cancelados" value={filteredData.filter(f => normalize(f._status_name).includes('cancela')).length} sub="Sin ejecución" color="#ef4444" icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>} />
          </>
        )}
        {activeTab === 'comercial' && (
          <>
            <StatCard title="Empresas Vigentes" value={new Set(filteredData.map(f => f._empresa_servicio_name)).size} sub="Proveedores" color="#8b5cf6" icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8z" /></svg>} />
            <StatCard title="Proyectos" value={new Set(filteredData.map(f => f._id_ficha)).size} sub="Fichas activas" color="#6366f1" icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7l9-4 9 4-9 4-9-4zM3 13l9-4 9 4-9 4-9-4zM3 19l9-4 9 4-9 4-9-4z" /></svg>} />
            <StatCard title="Objetivos Únicos" value={new Set(filteredData.map(f => f._objetivo_name)).size} sub="Tipos de servicio" color="#ec4899" icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /></svg>} />
            <StatCard title="Muestreos Totales" value={filteredData.length} sub="Volumen de servicio" color="#10b981" icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20v-6M6 20V10M18 20V4" /></svg>} />
          </>
        )}
        {activeTab === 'logistica' && (
          <>
            <StatCard title="Centros Atendidos" value={new Set(filteredData.map(f => f._centro_name)).size} sub="Ubicaciones" color="#059669" icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>} />
            <StatCard title="Sub-Áreas" value={new Set(filteredData.map(f => f._subarea_name)).size} sub="Sectores" color="#0ea5e9" icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>} />
            <StatCard title="Muestreos x Centro" value={(filteredData.length / (new Set(filteredData.map(f => f._centro_name)).size || 1)).toFixed(1)} sub="Promedio carga" color="#f59e0b" icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>} />
            <StatCard title="Eficiencia" value={((filteredData.filter(f => normalize(f._status_name).includes('ejecutado')).length / (filteredData.length || 1)) * 100).toFixed(0) + '%'} sub="Tasa ejecución" color="#10b981" icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12L12 22l-10-10l10-10l10 10z" /></svg>} />
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        {/* Main Chart Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {activeTab === 'operativa' && (
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #f3f4f6', position: 'relative' }}>
              <InfoButton title="Carga por Muestreador" detail={chartExplanations['Carga por Muestreador']} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '1.5rem', textAlign: 'center' }}>Carga por Muestreador</h3>
              <div style={{ height: 350 }}>
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
            </div>
          )}

          {activeTab === 'comercial' && (
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #f3f4f6', position: 'relative' }}>
              <InfoButton title="Carga por Empresa Servicio" detail={chartExplanations['Carga por Empresa Servicio']} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '1.5rem', textAlign: 'center' }}>Carga por Empresa Servicio</h3>
              <div style={{ height: 350 }}>
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
            </div>
          )}

          {activeTab === 'logistica' && (
            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #f3f4f6', position: 'relative' }}>
              <InfoButton title="Volumen por Centro de Muestreo" detail={chartExplanations['Volumen por Centro de Muestreo']} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '1.5rem', textAlign: 'center' }}>Volumen por Centro de Muestreo</h3>
              <div style={{ height: 350 }}>
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
            </div>
          )}

          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #f3f4f6', position: 'relative' }}>
            <InfoButton 
              title={activeTab === 'operativa' ? 'Eficiencia de Ejecución' : activeTab === 'comercial' ? 'Crecimiento por Objetivo' : 'Cobertura de Centros'} 
              detail={chartExplanations[activeTab === 'operativa' ? 'Eficiencia de Ejecución' : activeTab === 'comercial' ? 'Crecimiento por Objetivo' : 'Cobertura de Centros']} 
            />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '1.5rem', textAlign: 'center' }}>
              {activeTab === 'operativa' ? 'Eficiencia de Ejecución' : activeTab === 'comercial' ? 'Crecimiento por Objetivo' : 'Cobertura de Centros'}
            </h3>
            <div style={{ height: 250 }}>
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
          </div>
        </div>

        {/* Sidebar Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #f3f4f6', position: 'relative' }}>
            <InfoButton 
              title={activeTab === 'operativa' ? 'Distribución de Estados' : activeTab === 'comercial' ? 'Mix de Objetivos' : 'Áreas Ambientales'} 
              detail={chartExplanations[activeTab === 'operativa' ? 'Distribución de Estados' : activeTab === 'comercial' ? 'Mix de Objetivos' : 'Áreas Ambientales']} 
            />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '1.5rem', textAlign: 'center' }}>
              {activeTab === 'operativa' ? 'Distribución de Estados' : activeTab === 'comercial' ? 'Mix de Objetivos' : 'Áreas Ambientales'}
            </h3>
            <div style={{ height: 280 }}>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
              {(activeTab === 'operativa' ? statusAnalytics : activeTab === 'comercial' ? objectiveAnalytics : subAreaAnalytics).slice(0, 5).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => handleChartClick(activeTab === 'operativa' ? 'estado' : activeTab === 'comercial' ? 'objetivo' : 'subarea', String(item.name))}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: COLORS[i % COLORS.length] }} />
                    <span style={{ fontSize: '0.75rem', color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{item.name}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', border: '1px solid #f3f4f6', flexGrow: 1, position: 'relative' }}>
            <InfoButton 
              title={activeTab === 'operativa' ? 'Agenda para Hoy' : 'Insights de Rendimiento'} 
              detail={chartExplanations[activeTab === 'operativa' ? 'Agenda para Hoy' : 'Insights de Rendimiento']} 
            />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', marginBottom: '1rem', textAlign: 'center' }}>
               {activeTab === 'operativa' ? 'Agenda para Hoy' : 'Insights de Rendimiento'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {activeTab === 'operativa' ? (
                todayAgenda.slice(0, 5).map((event: any, idx: number) => (
                  <div key={idx} style={{ padding: '0.75rem', borderRadius: '12px', backgroundColor: '#f9fafb', borderLeft: `4px solid ${event.tipo_display === 'INICIO' ? '#3b82f6' : '#ef4444'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827' }}>{event.tipo_display}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#4b5563', margin: 0 }}>{event.muestreador_display}</p>
                    <p style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{event._centro_name || event.nombre_empresaservicios}</p>
                  </div>
                ))
              ) : (
                <>
                  <div style={{ padding: '1rem', borderRadius: '15px', backgroundColor: '#f0f9ff' }}>
                    <p style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 600, marginBottom: '0.3rem' }}>MÁXIMO VOLUMEN</p>
                    <p style={{ fontSize: '0.85rem', color: '#1e3a8a', fontWeight: 700 }}>
                      {activeTab === 'comercial' ? String(companyAnalytics[0]?.name || 'N/A') : String(centerAnalytics[0]?.name || 'N/A')}
                    </p>
                  </div>
                  <div style={{ padding: '1rem', borderRadius: '15px', backgroundColor: '#fdf2f8' }}>
                    <p style={{ fontSize: '0.75rem', color: '#be185d', fontWeight: 600, marginBottom: '0.3rem' }}>PREDOMINANTE</p>
                    <p style={{ fontSize: '0.85rem', color: '#831843', fontWeight: 700 }}>
                      {activeTab === 'comercial' ? String(objectiveAnalytics[0]?.name || 'N/A') : String(subAreaAnalytics[0]?.name || 'N/A')}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

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
            maxWidth: '500px',
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
                <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <h4 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', margin: 0 }}>{infoModal.title}</h4>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>¿QUÉ ES?</p>
                <p style={{ color: '#4b5563', lineHeight: 1.6, fontSize: '0.95rem', margin: 0 }}>{infoModal.definition}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>¿CÓMO FUNCIONA?</p>
                <p style={{ color: '#4b5563', lineHeight: 1.6, fontSize: '0.95rem', margin: 0 }}>{infoModal.operation}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>¿QUÉ MUESTRAN LOS DATOS?</p>
                <p style={{ color: '#4b5563', lineHeight: 1.6, fontSize: '0.95rem', margin: 0 }}>{infoModal.data}</p>
              </div>
            </div>

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
