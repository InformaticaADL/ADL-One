import React, { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { fichaService } from '../services/ficha.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useNavStore } from '../../../store/navStore';
import { useAuth } from '../../../contexts/AuthContext';
import apiClient from '../../../config/axios.config';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
    IconSearch,
    IconEraser,
    IconFilter,
    IconChevronDown,
    IconChevronRight,
    IconRefresh,
    IconAlertTriangle,
} from '@tabler/icons-react';

// Permisos que habilitan abrir el detalle de ejecución. No hay columna de
// acciones: se entra clickeando cualquier parte de la fila.
const PERMISOS_DETALLE = ['MA_COMERCIAL_HISTORIAL_DETALLE', 'FI_VER', 'FI_APROBAR_TEC', 'FI_APROBAR_COO'];

// El backend (mssql) devuelve los datetime guardados con GETDATE() (hora local del servidor)
// como si fueran UTC. Usamos los componentes UTC para evitar que el navegador
// reste el offset horario nuevamente.
const formatFechaHoraServidor = (value: string | Date) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

// value/onChange en formato 'yyyy-MM-dd' para calzar con el contrato de DatePicker,
// pero el resto del componente sigue trabajando con Date | null.
const toDateInputValue = (d: Date | null) => (d ? dayjs(d).format('YYYY-MM-DD') : '');
const fromDateInputValue = (v: string) => (v ? dayjs(v).toDate() : null);

interface Props {
    onBackToMenu: () => void;
}

// Qué falta para cerrar un muestreo (o una visita), en orden de prioridad
type EstadoCierre = 'curso' | 'firma' | 'caso' | 'listo' | 'hecho';
const ESTADOS_CIERRE: { clave: EstadoCierre; etiqueta: string }[] = [
    { clave: 'curso', etiqueta: 'En curso' },
    { clave: 'firma', etiqueta: 'Falta firma' },
    { clave: 'caso', etiqueta: 'Sin caso' },
    { clave: 'listo', etiqueta: 'Listo para marcar' },
];

interface GroupedMuestreo {
    fecha: string;
    etiqueta: string;
    items: any[];
}

export const MuestreosEjecutadosListView: React.FC<Props> = ({ onBackToMenu }) => {
    const { setSelectedFicha, setActiveSubmodule, activeModule } = useNavStore();
    const { hasPermission } = useAuth();
    const puedeVerDetalle = hasPermission(PERMISOS_DETALLE);
    const showCaso = activeModule !== 'gem' && activeModule !== 'unidades-gem';

    const abrirDetalle = (m: any) => {
        setSelectedFicha(m.id_fichaingresoservicio || m.correlativo_ficha, m.frecuencia_correlativo);
        setActiveSubmodule('ma-ficha-detalle');
    };
    const { showToast } = useToast();
    const [muestreos, setMuestreos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [realizadoStates, setRealizadoStates] = useState<Record<string, { realizado: boolean, userName: string, fecha: string }>>({});

    // Local cache: idAgendamam → caso_adlab asignado en esta sesión
    const [casoAdlabMap, setCasoAdlabMap] = useState<Record<string, string>>({});

    // Filters
    const [searchCorrelativo, setSearchCorrelativo] = useState('');
    const [searchCliente, setSearchCliente] = useState<string | null>(null);
    const [searchMuestreador, setSearchMuestreador] = useState<string | null>(null);
    const [searchObjetivo, setSearchObjetivo] = useState<string | null>(null);
    const [fechaDesde, setFechaDesde] = useState<Date | null>(null);
    const [fechaHasta, setFechaHasta] = useState<Date | null>(null);
    const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [filtroEstado, setFiltroEstado] = useState<EstadoCierre | 'todos'>('todos');
    // Visitas con varios puntos: una sola fila por visita; los puntos se ven al desplegarla.
    const [visitasAbiertas, setVisitasAbiertas] = useState<Set<string>>(new Set());
    const alternarVisita = (clave: string) => setVisitasAbiertas((prev) => {
        const nuevo = new Set(prev);
        if (nuevo.has(clave)) nuevo.delete(clave); else nuevo.add(clave);
        return nuevo;
    });
    const itemsPerPage = 12;

    useEffect(() => {
        loadMuestreos();
        // Se mantiene al día sin recargar la página: por ejemplo, "Falta registrar la firma" desaparece solo al registrarla en la app.
        const refrescar = () => { if (document.visibilityState === 'visible') loadMuestreos(true); };
        const intervalo = window.setInterval(refrescar, 45000);
        document.addEventListener('visibilitychange', refrescar);
        window.addEventListener('focus', refrescar);
        return () => {
            window.clearInterval(intervalo);
            document.removeEventListener('visibilitychange', refrescar);
            window.removeEventListener('focus', refrescar);
        };
    }, []);

    const loadMuestreos = async (silencioso = false) => {
        if (!silencioso) setLoading(true);
        try {
            const response = await fichaService.getMuestreosEjecutados();
            let data = [];
            if (Array.isArray(response)) data = response;
            else if (response && response.data && Array.isArray(response.data)) data = response.data;
            else if (response && Array.isArray(response.recordset)) data = response.recordset;

            setMuestreos(data || []);

            // Initialize realizadoStates from DB data
            const initialStates: Record<string, { realizado: boolean, userName: string, fecha: string }> = {};
            const initialCasos: Record<string, string> = {};
            (data || []).forEach((m: any) => {
                const key = m.id_agendamam?.toString();
                if (key && m.realizado_por_gem) {
                    initialStates[key] = {
                        realizado: true,
                        userName: m.realizado_por_gem,
                        fecha: m.fecha_realizado_gem ? formatFechaHoraServidor(m.fecha_realizado_gem) : ''
                    };
                }
                if (key && m.caso_adlab) {
                    initialCasos[key] = m.caso_adlab;
                }
            });
            setRealizadoStates(initialStates);
            setCasoAdlabMap(initialCasos);
        } catch (error) {
            console.error("Error loading muestreos ejecutados:", error);
            if (!silencioso) showToast({ type: 'error', message: "Error al cargar los muestreos ejecutados" });
        } finally {
            if (!silencioso) setLoading(false);
        }
    };

    const getUniqueValues = (key: string) => {
        const values = new Set<string>();
        muestreos.forEach(m => {
            if (m[key]) values.add(String(m[key]).trim());
        });
        return Array.from(values).sort().map(v => ({ value: v, label: v }));
    };

    const uniqueClientes = useMemo(() => getUniqueValues('cliente'), [muestreos]);
    const uniqueMuestreadores = useMemo(() => getUniqueValues('muestreador'), [muestreos]);
    const uniqueObjetivos = useMemo(() => getUniqueValues('objetivo'), [muestreos]);

    const activeFilterCount = [searchCorrelativo, searchCliente, searchMuestreador, searchObjetivo, fechaDesde, fechaHasta].filter(Boolean).length;

    const handleClearFilters = () => {
        setSearchCorrelativo('');
        setSearchCliente(null);
        setSearchMuestreador(null);
        setSearchObjetivo(null);
        setFechaDesde(null);
        setFechaHasta(null);
        setCurrentPage(1);
    };

    const getDayLabel = (date: Date) => {
        // timeZone: 'UTC' — fecha_retiro llega como "YYYY-MM-DDT00:00:00.000Z" (fecha
        // pura, sin hora real). Sin fijar UTC, en cualquier huso detrás de UTC (Chile)
        // esa medianoche se interpreta como la tarde del día anterior.
        const label = date.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
        // Capitalizar primera letra para que se vea mejor
        return label.charAt(0).toUpperCase() + label.slice(1);
    };

    const filteredMuestreos = useMemo(() => {
        return muestreos.filter(m => {
            const check = (val: string, search: string | null) => {
                if (!search) return true;
                return (val || '').toString().toLowerCase().includes(search.toLowerCase());
            };
            const matchCorr = check(m.frecuencia_correlativo, searchCorrelativo) || check(m.caso_adlab, searchCorrelativo);
            const matchCliente = check(m.cliente, searchCliente);
            const matchMues = check(m.muestreador, searchMuestreador);
            const matchObj = check(m.objetivo, searchObjetivo);

            // Filtro de fecha — comparación por string de fecha ("YYYY-MM-DD"), no por
            // Date/horas: fecha_retiro es una medianoche UTC pura, y comparar objetos
            // Date con setHours local corre el día en husos detrás de UTC (Chile),
            // dejando fuera del filtro registros que sí correspondían a ese día.
            let matchFecha = false;
            if (m.fecha_retiro) {
                const fechaStr = m.fecha_retiro.split('T')[0];
                matchFecha = true;
                if (fechaDesde) matchFecha = matchFecha && fechaStr >= fechaDesde;
                if (fechaHasta) matchFecha = matchFecha && fechaStr <= fechaHasta;
            }

            return matchCorr && matchCliente && matchMues && matchObj && matchFecha;
        });
    }, [muestreos, searchCorrelativo, searchCliente, searchMuestreador, searchObjetivo, fechaDesde, fechaHasta]);

    const sortedMuestreos = useMemo(() => {
        return [...filteredMuestreos].sort((a, b) => {
            const dateA = a.fecha_retiro ? new Date(a.fecha_retiro).getTime() : 0;
            const dateB = b.fecha_retiro ? new Date(b.fecha_retiro).getTime() : 0;
            return dateB - dateA; // Más recientes primero
        });
    }, [filteredMuestreos]);

    const groupedBase = useMemo(() => {
        const groups: Record<string, GroupedMuestreo> = {};

        sortedMuestreos.forEach(m => {
            if (!m.fecha_retiro) return;
            // fecha_retiro es una fecha pura ("YYYY-MM-DDT00:00:00.000Z"): se toma el
            // trozo de fecha directo del string en vez de pasar por Date+setHours, que
            // reinterpreta esa medianoche UTC en el huso local y corre el día (bug real:
            // un muestreo cerrado el 01/10 aparecía agrupado bajo el 30/09 en Chile).
            const fechaStr = m.fecha_retiro.split('T')[0];

            if (!groups[fechaStr]) {
                groups[fechaStr] = {
                    fecha: fechaStr,
                    etiqueta: getDayLabel(new Date(`${fechaStr}T00:00:00Z`)),
                    items: []
                };
            }
            groups[fechaStr].items.push(m);
        });

        for (const g of Object.values(groups)) {
            const entradas: any[] = [];
            const porVisita = new Map<string, any>();
            for (const m of g.items) {
                const servicio = String(m.frecuencia_correlativo || '').split('-')[1] || '';
                if (m.id_grupo == null || !servicio) { entradas.push(m); continue; }
                const clave = `${m.id_grupo}-${servicio}`;
                const existente = porVisita.get(clave);
                if (existente) { existente.miembros.push(m); continue; }
                const visita = { ...m, _visita: true, _clave: clave, miembros: [m] };
                porVisita.set(clave, visita);
                entradas.push(visita);
            }
            // Una "visita" de un solo punto ejecutado se ve como una fila normal
            // Dentro de la visita, los puntos van en el orden en que se hicieron (por hora)
            const clave = (m: any) => (m.ma_muestreo_fechai && m.ma_muestreo_horai ? `${String(m.ma_muestreo_fechai).slice(0, 10)} ${String(m.ma_muestreo_horai).slice(0, 5)}` : '');
            for (const e of entradas) if (e._visita) e.miembros.sort((a: any, b: any) => (clave(a) && clave(b) ? clave(a).localeCompare(clave(b)) : clave(a) ? -1 : clave(b) ? 1 : 0));
            g.items = entradas.map((e) => (e._visita && e.miembros.length === 1 && !(Number(e.visita_total) > 1) ? e.miembros[0] : e));
        }

        return Object.values(groups).sort((a, b) => {
            return new Date(b.fecha).getTime() - new Date(a.fecha).getTime(); // Más recientes primero
        });
    }, [sortedMuestreos]);

    const estadoDe = (e: any): EstadoCierre => {
        const miembros: any[] = e._visita ? e.miembros : [e];
        const pendientes = e._visita ? (e.visita_pendientes || []).length : 0;
        if (pendientes > 0) return 'curso';
        if (e._visita && !miembros.some((x: any) => String(x.nombre_observadorterreno || '').trim() || String(x.nombre_observadorterreno_retiro || '').trim())) return 'firma';
        if (showCaso && !miembros.some((x: any) => casoAdlabMap[x.id_agendamam?.toString()])) return 'caso';
        const realizados = miembros.filter((x: any) => realizadoStates[x.id_agendamam?.toString()]?.realizado).length;
        return realizados === miembros.length ? 'hecho' : 'listo';
    };
    const conteoEstados = useMemo(() => {
        const c: Record<EstadoCierre, number> = { curso: 0, firma: 0, caso: 0, listo: 0, hecho: 0 };
        groupedBase.forEach((g) => g.items.forEach((e) => { c[estadoDe(e)] += 1; }));
        return c;
    }, [groupedBase, realizadoStates, casoAdlabMap]);
    const groupedMuestreos = useMemo(() => {
        if (filtroEstado === 'todos') return groupedBase;
        return groupedBase
            .map((g) => ({ ...g, items: g.items.filter((e) => estadoDe(e) === filtroEstado) }))
            .filter((g) => g.items.length > 0);
    }, [groupedBase, filtroEstado, realizadoStates, casoAdlabMap]);

    const totalItems = groupedMuestreos.reduce((a, g) => a + g.items.length, 0);
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    // Paginate grouped data
    let itemCount = 0;
    const pageStart = (currentPage - 1) * itemsPerPage;
    const pageEnd = currentPage * itemsPerPage;
    const displayedGroups: GroupedMuestreo[] = [];

    for (const group of groupedMuestreos) {
        const groupStart = itemCount;
        const groupEnd = itemCount + group.items.length;

        if (groupEnd > pageStart && groupStart < pageEnd) {
            displayedGroups.push({
                ...group,
                items: group.items.slice(
                    Math.max(0, pageStart - groupStart),
                    Math.max(0, pageEnd - groupStart)
                )
            });
        }
        itemCount += group.items.length;
        if (itemCount >= pageEnd) break;
    }


    // Una entrada del listado: un punto único o una visita con varios puntos. Dice qué falta para cerrarla; "Abrir" lleva al detalle.
    const renderEntrada = (m: any, idx: number) => {
        const esVisita = !!m._visita;
        const miembros: any[] = esVisita ? m.miembros : [m];
        const clave = esVisita ? m._clave : `${m.id_agendamam || m.correlativo_ficha || m.id_fichaingresoservicio}-${idx}`;
        const pendientes: { id_agendamam: number; punto: string | null }[] = esVisita ? (m.visita_pendientes || []) : [];
        const ejecutados = miembros.length;
        const total = esVisita ? Math.max(Number(m.visita_total) || 0, ejecutados + pendientes.length) : 1;
        const estado = estadoDe(m);
        const abierta = visitasAbiertas.has(clave);
        const casos = Array.from(new Set(miembros.map((x: any) => casoAdlabMap[x.id_agendamam?.toString()]).filter(Boolean)));
        const fotosTotal = miembros.reduce((a: number, x: any) => a + (x.fotos_medicion?.total || 0), 0);
        const muestra: string[] = miembros.flatMap((x: any) => x.fotos_medicion?.muestra || []).slice(0, 3);
        const primero = miembros[0];
        const realizado = realizadoStates[primero.id_agendamam?.toString()];
        const abrir = () => abrirDetalle(primero);
        const etiqueta = estado === 'curso' ? { v: 'outline' as const, t: 'En curso' }
            : estado === 'firma' ? { v: 'warning' as const, t: 'Falta firma' }
            : estado === 'caso' ? { v: 'warning' as const, t: 'Sin caso' }
            : estado === 'listo' ? { v: 'success' as const, t: 'Listo para marcar' }
            : { v: 'secondary' as const, t: 'Realizado' };
        const marca = estado === 'hecho' || estado === 'listo'
            ? 'border-success bg-success text-white'
            : estado === 'curso' ? 'border-dashed border-primary text-primary' : 'border-warning text-warning';
        return (
            <div key={`entrada-${clave}`} className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 max-sm:grid-cols-[auto_minmax(0,1fr)]">
                    <span className={cn('grid h-[22px] w-[22px] place-items-center rounded-full border-[1.5px] text-[11px] font-semibold', marca)}>
                        {estado === 'hecho' || estado === 'listo' ? '✓' : estado === 'curso' ? ejecutados : '!'}
                    </span>
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold tracking-tight" title={m.cliente}>
                            {m.cliente || '-'} <span className="font-normal text-muted-foreground">· {m.centro || '-'}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{esVisita ? `Visita · ${total} puntos` : 'Punto único'}</span>
                            <span>{m.nombre_subarea || m.objetivo || '-'}</span>
                            <span>{m.muestreador || 'Sin asignar'}{m.muestreador_retiro && m.muestreador_retiro !== m.muestreador ? ` / ${m.muestreador_retiro}` : ''}</span>
                            {!esVisita && <span title={m.frecuencia_correlativo}>{m.frecuencia_correlativo || '-'}</span>}
                            {!esVisita && m.fecha_completado && dayjs().diff(dayjs(m.fecha_completado), 'hour') < 24 && <Badge variant="success">Nuevo</Badge>}
                            {esVisita && (
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="h-1 w-20 overflow-hidden rounded-full bg-muted">
                                        <span className={cn('block h-full rounded-full', ejecutados === total ? 'bg-success' : 'bg-foreground')} style={{ width: `${(100 * ejecutados) / total}%` }} />
                                    </span>
                                    <span className="tabular-nums">{ejecutados} de {total}</span>
                                </span>
                            )}
                            {muestra.length > 0 && (
                                <span className="inline-flex items-center gap-1" title={`${fotosTotal} foto(s) de mediciones`}>
                                    {muestra.map((ruta) => (
                                        <img key={ruta} src={`${apiClient.defaults.baseURL}${ruta}`} alt="" className="h-6 w-6 rounded border border-border object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    ))}
                                    {fotosTotal > muestra.length && <span className="tabular-nums">+{fotosTotal - muestra.length}</span>}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2 max-sm:col-start-2 max-sm:justify-start">
                        {showCaso && (casos.length > 0 ? <Badge variant="secondary" className="tabular-nums">{casos.join(' · ')}</Badge> : <span className="text-xs text-muted-foreground">Sin caso</span>)}
                        <Badge variant={etiqueta.v}>{etiqueta.t}</Badge>
                        {esVisita && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={abierta ? 'Ocultar los puntos' : 'Mostrar los puntos'} aria-expanded={abierta} onClick={() => alternarVisita(clave)}>
                                {abierta ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                            </Button>
                        )}
                        {puedeVerDetalle && <Button variant="outline" size="sm" onClick={abrir}>Abrir</Button>}
                    </div>
                </div>
                {estado === 'curso' && (
                    <div className="mx-4 mb-3 ml-[50px] flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-xs font-medium text-warning">
                        <IconAlertTriangle size={14} className="shrink-0" />
                        Faltan {pendientes.length} {pendientes.length === 1 ? 'punto' : 'puntos'} por ejecutar. Los documentos se generan al completar todos.
                    </div>
                )}
                {estado === 'firma' && (
                    <div className="mx-4 mb-3 ml-[50px] flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-xs font-medium text-warning">
                        <IconAlertTriangle size={14} className="shrink-0" />
                        Falta registrar la firma del observador: la visita no se puede dar por cerrada.
                    </div>
                )}
                {esVisita && abierta && (
                    <div className="divide-y divide-border border-t border-border bg-muted/40">
                        {miembros.map((p: any, i: number) => {
                            const k = p.id_agendamam?.toString();
                            const ok = !!realizadoStates[k]?.realizado;
                            const fotos = p.fotos_medicion?.muestra || [];
                            return (
                                <div key={`${k}-${i}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-2 text-[13px] max-sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                                    <span className="grid h-[22px] w-[22px] place-items-center rounded-full border-[1.5px] border-success bg-success text-[11px] font-semibold text-white">✓</span>
                                    <div className="min-w-0">
                                        <span className="font-medium">{p.punto_muestreo || 'Sin nombre'}</span>
                                        <span className="ml-2 text-xs text-muted-foreground" title={p.frecuencia_correlativo}>{p.frecuencia_correlativo}</span>
                                    </div>
                                    <span className="flex items-center gap-1 max-sm:hidden">
                                        {fotos.map((ruta: string) => (
                                            <img key={ruta} src={`${apiClient.defaults.baseURL}${ruta}`} alt="" className="h-6 w-6 rounded border border-border object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        ))}
                                    </span>
                                    <span className="flex items-center gap-2">
                                        {ok && <Badge variant="success">Realizado</Badge>}
                                        {puedeVerDetalle && <Button variant="ghost" size="sm" onClick={() => abrirDetalle(p)}>Ver</Button>}
                                    </span>
                                </div>
                            );
                        })}
                        {pendientes.map((p, i) => (
                            <div key={`pend-${p.id_agendamam}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 text-[13px] text-muted-foreground">
                                <span className="grid h-[22px] w-[22px] place-items-center rounded-full border-[1.5px] border-dashed border-border text-[11px] font-semibold">{ejecutados + i + 1}</span>
                                <span>{p.punto || 'Sin nombre'}</span>
                                <span className="text-xs font-medium text-warning">Pendiente de ejecutar</span>
                            </div>
                        ))}
                    </div>
                )}
                {!esVisita && realizado?.realizado && (
                    <div className="border-t border-border bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground">
                        Realizado por <span className="font-medium text-foreground">{realizado.userName}</span>{realizado.fecha ? ` · ${realizado.fecha}` : ''}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="shadcn-scope">
            <PageHeader
                title="Muestreos Completados"
                subtitle="Histórico de servicios ejecutados y reportes generados"
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'Muestreos Completados' }
                ]}
                rightSection={
                    <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xs text-muted-foreground">{filteredMuestreos.length} servicios registrados</span>
                        <Button variant="outline" onClick={() => loadMuestreos()} disabled={loading} title="Volver a cargar el listado">
                            <IconRefresh size={16} /> Actualizar
                        </Button>
                        {/* Los filtros vivían en una tarjeta siempre visible que empujaba el
                            listado fuera de pantalla. Ahora van en el panel lateral, igual
                            que en el resto de los listados. */}
                        <Sheet open={filtersSheetOpen} onOpenChange={setFiltersSheetOpen}>
                            <SheetTrigger asChild>
                                <Button variant="outline">
                                    <IconFilter size={16} /> Filtros
                                    {activeFilterCount > 0 && (
                                        <Badge variant="secondary" className="ml-1 px-1.5">{activeFilterCount}</Badge>
                                    )}
                                </Button>
                            </SheetTrigger>
                            <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-sm">
                                <SheetHeader>
                                    <SheetTitle>Filtros de búsqueda</SheetTitle>
                                </SheetHeader>

                                <div className="flex flex-1 flex-col gap-4">
                                    <Field label="Correlativo / ID Caso">
                                        <div className="relative">
                                            <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                            <Input className="pl-8" placeholder="Ej: 99-1 o ID Caso..." value={searchCorrelativo} onChange={(e) => setSearchCorrelativo(e.target.value)} />
                                        </div>
                                    </Field>
                                    <Field label="Cliente">
                                        <Combobox placeholder="Todos" searchPlaceholder="Buscar cliente..." options={uniqueClientes} value={searchCliente ?? ''} onValueChange={(v) => setSearchCliente(v || null)} />
                                    </Field>
                                    <Field label="Muestreador">
                                        <Combobox placeholder="Todos" searchPlaceholder="Buscar muestreador..." options={uniqueMuestreadores} value={searchMuestreador ?? ''} onValueChange={(v) => setSearchMuestreador(v || null)} />
                                    </Field>
                                    <Field label="Objetivo">
                                        <Combobox placeholder="Todos" searchPlaceholder="Buscar objetivo..." options={uniqueObjetivos} value={searchObjetivo ?? ''} onValueChange={(v) => setSearchObjetivo(v || null)} />
                                    </Field>
                                    <Field label="Desde">
                                        <DatePicker value={toDateInputValue(fechaDesde)} onChange={(v) => setFechaDesde(fromDateInputValue(v))} />
                                    </Field>
                                    <Field label="Hasta">
                                        <DatePicker value={toDateInputValue(fechaHasta)} onChange={(v) => setFechaHasta(fromDateInputValue(v))} />
                                    </Field>
                                </div>

                                <SheetFooter>
                                    {activeFilterCount > 0 && (
                                        <Button
                                            variant="outline"
                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            onClick={handleClearFilters}
                                        >
                                            <IconEraser size={16} /> Limpiar filtros
                                        </Button>
                                    )}
                                    <Button onClick={() => setFiltersSheetOpen(false)}>Aplicar</Button>
                                </SheetFooter>
                            </SheetContent>
                        </Sheet>
                    </div>
                }
            />

            <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-background p-0.5" role="group" aria-label="Filtrar por estado">
                        {[{ clave: 'todos' as const, etiqueta: 'Todos' }, ...ESTADOS_CIERRE].map((op) => (
                            <button
                                key={op.clave}
                                type="button"
                                aria-pressed={filtroEstado === op.clave}
                                onClick={() => { setFiltroEstado(op.clave); setCurrentPage(1); }}
                                className={cn('rounded-md px-3 py-1 text-[13px] font-medium transition-colors', filtroEstado === op.clave ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}
                            >
                                {op.etiqueta}{op.clave !== 'todos' && conteoEstados[op.clave] > 0 ? <span className="ml-1.5 tabular-nums text-muted-foreground">{conteoEstados[op.clave]}</span> : null}
                            </button>
                        ))}
                    </div>
                </div>
                {loading ? (
                    <Card>
                        <div className="flex flex-col items-center gap-2 p-8">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            <span className="text-[13px] text-muted-foreground">Cargando registros históricos...</span>
                        </div>
                    </Card>
                ) : displayedGroups.length === 0 ? (
                    <Card>
                        <p className="p-8 text-center text-muted-foreground">No se encontraron muestreos ejecutados.</p>
                    </Card>
                ) : (
                    displayedGroups.map((group) => (
                        <section key={group.fecha} className="flex flex-col gap-2">
                            <div className="flex items-center gap-3 pt-2 text-[13px] font-semibold text-muted-foreground">
                                <span>{group.etiqueta} · {group.items.length}</span>
                                <span className="h-px flex-1 bg-border" />
                            </div>
                            {group.items.map((m, idx) => renderEntrada(m, idx))}
                        </section>
                    ))
                )}

                <div className="flex items-center justify-between px-1">
                    <span className="text-[13px] text-muted-foreground">
                        Mostrando {Math.min(itemsPerPage, Math.max(0, totalItems - (currentPage - 1) * itemsPerPage))} de {totalItems} {totalItems === 1 ? 'muestreo' : 'muestreos'}
                    </span>
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>Anterior</Button>
                        <span className="px-2 text-[13px]">{currentPage} / {totalPages}</span>
                        <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>Siguiente</Button>
                    </div>
                </div>
            </div>
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
