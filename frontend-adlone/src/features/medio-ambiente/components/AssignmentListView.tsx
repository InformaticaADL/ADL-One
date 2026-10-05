import React, { useState, useEffect, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { catalogosService } from '../services/catalogos.service';
import { useCatalogos } from '../context/CatalogosContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useFichasFiltersStore } from '../store/fichasFiltersStore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { DataPagination } from '@/components/ui/pagination';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
    IconSearch,
    IconEraser,
    IconCalendarStats,
    IconFilter,
    IconChevronDown,
    IconChevronRight,
    IconAlertTriangle,
    IconLayoutList
} from '@tabler/icons-react';

interface Props {
    onBackToMenu: () => void;
    onViewAssignment: (id: number) => void;
}

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';

interface CorrelativoInfo {
    frecuencia_correlativo: string;
    numero_servicio: number;
    status: string;
    en_ruta?: boolean;
}

interface Grupo {
    key: string;
    centro: string;
    empresa: string;
    fichas: any[];
    asignables: any[];
}

// El próximo servicio a agendar de una ficha: el primer correlativo DISPONIBLE
// (ni agendado ni comprometido en una ruta). Es la única unidad de agendamiento
// masivo — no importa si la ficha tiene 1, 12 o 48 servicios en total.
const proximoServicio = (ficha: any): CorrelativoInfo | null => {
    const corrs: CorrelativoInfo[] = Array.isArray(ficha?.correlativos) ? ficha.correlativos : [];
    return corrs.find((c) => c.status === 'DISPONIBLE' && !c.en_ruta) || null;
};

const esCompuesta = (ficha: any) =>
    String(ficha?.tipo_fichaingresoservicio || '').trim().toUpperCase() !== 'PUNTUAL';

// Instalación y retiro en días distintos sólo son obligatorios cuando el muestreo
// dura 24 h o más (misma regla que valida AssignmentDetailView antes de guardar).
const requiereRetiroAparte = (ficha: any) =>
    esCompuesta(ficha) && Number(ficha?.ma_duracion_muestreo || 0) >= 24;

const idDeFicha = (row: any): number => Number(row?.id_fichaingresoservicio || row?.fichaingresoservicio);

export const AssignmentListView: React.FC<Props> = ({ onBackToMenu, onViewAssignment }) => {
    const { showToast } = useToast();
    const { user, hasPermission } = useAuth();
    const { getCatalogo } = useCatalogos();
    // Filtros persistidos fuera del componente (ver fichasFiltersStore): esta vista se
    // desmonta al ir a un detalle y se remonta limpia al volver, así que un useState
    // local perdería los filtros aplicados.
    const {
        searchId, searchEstado, searchMonitoreo, searchEmpresaFacturar, searchEmpresaServicio,
        searchCentro, searchObjetivo, searchSubArea, dateFrom, dateTo,
    } = useFichasFiltersStore((s) => s.asignacion);
    const setAsignacion = useFichasFiltersStore((s) => s.setAsignacion);
    const setSearchId = (v: string) => setAsignacion({ searchId: v });
    const setSearchEstado = (v: string | null) => setAsignacion({ searchEstado: v });
    const setSearchMonitoreo = (v: string | null) => setAsignacion({ searchMonitoreo: v });
    const setSearchEmpresaFacturar = (v: string | null) => setAsignacion({ searchEmpresaFacturar: v });
    const setSearchEmpresaServicio = (v: string | null) => setAsignacion({ searchEmpresaServicio: v });
    const setSearchCentro = (v: string | null) => setAsignacion({ searchCentro: v });
    const setSearchObjetivo = (v: string | null) => setAsignacion({ searchObjetivo: v });
    const setSearchSubArea = (v: string | null) => setAsignacion({ searchSubArea: v });
    const setDateFrom = (v: string) => setAsignacion({ dateFrom: v });
    const setDateTo = (v: string) => setAsignacion({ dateTo: v });

    const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
    const [quickSearch, setQuickSearch] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [fichas, setFichas] = useState<any[]>([]);
    const [muestreadores, setMuestreadores] = useState<any[]>([]);

    const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
    const [seleccion, setSeleccion] = useState<Set<number>>(new Set());

    const [asignarOpen, setAsignarOpen] = useState(false);
    const [fechaInstalacion, setFechaInstalacion] = useState('');
    const [fechaRetiro, setFechaRetiro] = useState('');
    const [muestreadorInst, setMuestreadorInst] = useState<string | null>(null);
    const [muestreadorRet, setMuestreadorRet] = useState<string | null>(null);
    const [mismoResponsable, setMismoResponsable] = useState(true);
    const [observacion, setObservacion] = useState('');
    const [saving, setSaving] = useState(false);

    const [gruposPorPagina, setGruposPorPagina] = useState(10);
    const puedeAsignar = hasPermission('FI_GEST_ASIG');

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [response, mData] = await Promise.all([
                    fichaService.getForAssignment(),
                    getCatalogo('muestreadores', () => catalogosService.getMuestreadores())
                ]);

                let data = [];
                if (Array.isArray(response)) data = response;
                else if (response && response.data && Array.isArray(response.data)) data = response.data;
                else if (response && Array.isArray(response.recordset)) data = response.recordset;

                setFichas(data || []);
                setMuestreadores(Array.isArray(mData) ? mData : []);
            } catch (error) {
                console.error("Error loading fichas for assignment:", error);
                showToast({ type: 'error', message: 'Error al cargar fichas para asignación' });
            } finally {
                setLoading(false);
            }
        };
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getUniqueValues = (key: string) => {
        const values = new Set<string>();
        fichas.forEach(f => {
            if (f[key]) values.add(String(f[key]).trim());
        });
        return Array.from(values).sort().map(v => ({ value: v, label: v }));
    };

    const uniqueEstados = useMemo(() => {
        const v1 = getUniqueValues('estado_ficha');
        return v1.length > 0 ? v1 : getUniqueValues('nombre_estadomuestreo');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fichas]);

    const uniqueMonitoreo = useMemo(() => {
        const v1 = getUniqueValues('nombre_frecuencia');
        return v1.length > 0 ? v1 : getUniqueValues('frecuencia');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fichas]);

    const uniqueEmpFacturar = useMemo(() => getUniqueValues('empresa_facturar'), [fichas]);

    const uniqueEmpServicio = useMemo(() => {
        const set = new Set<string>();
        fichas.forEach(f => {
            const val = f.empresa_servicio || f.nombre_empresaservicios;
            if (val) set.add(String(val).trim());
        });
        return Array.from(set).sort().map(v => ({ value: v, label: v }));
    }, [fichas]);

    const uniqueCentros = useMemo(() => {
        const set = new Set<string>();
        fichas.forEach(f => {
            const val = f.centro || f.nombre_centro;
            if (val) set.add(String(val).trim());
        });
        return Array.from(set).sort().map(v => ({ value: v, label: v }));
    }, [fichas]);

    const uniqueObjetivos = useMemo(() => getUniqueValues('nombre_objetivomuestreo_ma'), [fichas]);

    const uniqueSubAreas = useMemo(() => {
        const set = new Set<string>();
        fichas.forEach(f => {
            const val = f.subarea || f.nombre_subarea;
            if (val) set.add(String(val).trim());
        });
        return Array.from(set).sort().map(v => ({ value: v, label: v }));
    }, [fichas]);

    const muestreadorOptions = useMemo(
        () => muestreadores.map((m: any) => ({ value: String(m.id_muestreador), label: m.nombre_muestreador })),
        [muestreadores]
    );

    const panelFilterCount = [searchId, searchEstado, searchMonitoreo, searchEmpresaFacturar, searchEmpresaServicio, searchCentro, searchObjetivo, searchSubArea, dateFrom, dateTo].filter(Boolean).length;

    const handleClearFilters = () => {
        setSearchId('');
        setSearchEstado(null);
        setSearchMonitoreo(null);
        setSearchEmpresaFacturar(null);
        setSearchEmpresaServicio(null);
        setSearchCentro(null);
        setSearchObjetivo(null);
        setSearchSubArea(null);
        setDateFrom('');
        setDateTo('');
        setCurrentPage(1);
    };

    const filteredFichas = useMemo(() => {
        const q = quickSearch.trim().toLowerCase();
        return fichas.filter(f => {
            const displayId = f.fichaingresoservicio || f.id_fichaingresoservicio || '';
            const matchId = searchId ? String(displayId).includes(searchId) : true;

            const check = (val: string, search: string | null) => {
                if (!search) return true;
                return (val || '').toString().toLowerCase().includes(search.toLowerCase());
            };

            const matchEstado = check(f.estado_ficha || f.nombre_estadomuestreo, searchEstado);
            const matchMonitoreo = check(f.nombre_frecuencia || f.frecuencia, searchMonitoreo);
            const matchEmpFacturar = check(f.empresa_facturar, searchEmpresaFacturar);
            const matchEmpServicio = check(f.empresa_servicio || f.nombre_empresaservicios, searchEmpresaServicio);
            const matchCentro = check(f.centro || f.nombre_centro, searchCentro);
            const matchObjetivo = check(f.nombre_objetivomuestreo_ma, searchObjetivo);
            const matchSubArea = check(f.subarea || f.nombre_subarea, searchSubArea);

            const matchQuick = !q || [
                f.centro || f.nombre_centro,
                f.ma_punto_muestreo,
                f.empresa_facturar,
                f.empresa_servicio || f.nombre_empresaservicios,
                String(displayId)
            ].some(v => String(v || '').toLowerCase().includes(q));

            let matchDate = true;
            if (dateFrom || dateTo) {
                const fDate = f.fecha || f.fecha_muestreo;
                if (!fDate) matchDate = false;
                else {
                    let rowDate: Date;
                    if (typeof fDate === 'string' && fDate.includes('/')) {
                        const parts = fDate.split('/');
                        rowDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    } else {
                        rowDate = new Date(fDate);
                    }
                    rowDate.setHours(0, 0, 0, 0);

                    if (dateFrom && rowDate < new Date(dateFrom)) matchDate = false;
                    if (dateTo && rowDate > new Date(dateTo)) matchDate = false;
                }
            }

            return matchId && matchEstado && matchMonitoreo && matchEmpFacturar && matchEmpServicio && matchCentro && matchObjetivo && matchSubArea && matchQuick && matchDate;
        });
    }, [fichas, quickSearch, searchId, searchEstado, searchMonitoreo, searchEmpresaFacturar, searchEmpresaServicio, searchCentro, searchObjetivo, searchSubArea, dateFrom, dateTo]);

    // Varias fichas del mismo centro son puntos distintos del mismo lugar físico y se
    // muestrean el mismo día — agruparlas es lo que permite agendarlas de una vez.
    const grupos = useMemo<Grupo[]>(() => {
        const mapa = new Map<string, Grupo>();
        filteredFichas.forEach((f) => {
            const centro = String(f.centro || f.nombre_centro || 'Sin centro').trim();
            const key = String(f.id_centro ?? centro);
            if (!mapa.has(key)) {
                mapa.set(key, {
                    key,
                    centro,
                    empresa: String(f.empresa_facturar || f.empresa_servicio || f.nombre_empresaservicios || '').trim(),
                    fichas: [],
                    asignables: []
                });
            }
            const g = mapa.get(key)!;
            g.fichas.push(f);
            const bloqueadoPorCoordinacion = String(f.estado_ficha || f.nombre_estadomuestreo || '').toUpperCase().includes('COORDINAC');
            if (!bloqueadoPorCoordinacion && proximoServicio(f)) g.asignables.push(f);
        });

        const lista = Array.from(mapa.values());
        lista.forEach((g) => {
            g.fichas.sort((a, b) =>
                String(a.ma_punto_muestreo || '').localeCompare(String(b.ma_punto_muestreo || '')) ||
                idDeFicha(a) - idDeFicha(b)
            );
        });
        // Primero los centros con más trabajo por agendar: es donde el agendado en bloque rinde.
        lista.sort((a, b) => b.asignables.length - a.asignables.length || a.centro.localeCompare(b.centro));
        return lista;
    }, [filteredFichas]);

    const gruposPaginados = useMemo(() => {
        const start = (currentPage - 1) * gruposPorPagina;
        return grupos.slice(start, start + gruposPorPagina);
    }, [grupos, currentPage]);

    const fichasSeleccionadas = useMemo(
        () => filteredFichas.filter((f) => seleccion.has(idDeFicha(f))),
        [filteredFichas, seleccion]
    );

    const hayCompuestas = useMemo(() => fichasSeleccionadas.some(requiereRetiroAparte), [fichasSeleccionadas]);
    const compuestasCount = useMemo(() => fichasSeleccionadas.filter(requiereRetiroAparte).length, [fichasSeleccionadas]);

    const toggleFicha = (id: number) => {
        setSeleccion((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleGrupo = (g: Grupo) => {
        const ids = g.asignables.map(idDeFicha);
        const todos = ids.length > 0 && ids.every((id) => seleccion.has(id));
        setSeleccion((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => { if (todos) next.delete(id); else next.add(id); });
            return next;
        });
    };

    const estadoGrupo = (g: Grupo): boolean | 'indeterminate' => {
        const ids = g.asignables.map(idDeFicha);
        if (ids.length === 0) return false;
        const marcados = ids.filter((id) => seleccion.has(id)).length;
        if (marcados === 0) return false;
        if (marcados === ids.length) return true;
        return 'indeterminate';
    };

    const getStatusVariant = (status: string): BadgeVariant => {
        const s = (status || '').toUpperCase();
        if (s.includes('COORDINACIÓN')) return 'destructive';
        if (s.includes('PROGRAMACIÓN')) return 'secondary';
        if (s.includes('EN PROCESO') || s.includes('VIGENTE') || s.includes('APROBADA') || s.includes('EJECUTADO')) return 'success';
        if (s.includes('PENDIENTE') || s.includes('ÁREA TÉCNICA')) return 'warning';
        if (s.includes('RECHAZADA') || s.includes('CANCELADO') || s.includes('ANULADA')) return 'destructive';
        return 'outline';
    };

    const abrirAsignar = () => {
        setFechaInstalacion('');
        setFechaRetiro('');
        setMuestreadorInst(null);
        setMuestreadorRet(null);
        setMismoResponsable(true);
        setObservacion('');
        setAsignarOpen(true);
    };

    const confirmarAsignacion = async () => {
        if (!fechaInstalacion) {
            showToast({ type: 'warning', message: 'Debe indicar la fecha de muestreo' });
            return;
        }
        if (!muestreadorInst) {
            showToast({ type: 'warning', message: 'Debe seleccionar un responsable' });
            return;
        }

        const hoy = new Date().toISOString().split('T')[0];
        if (fechaInstalacion < hoy) {
            showToast({ type: 'error', message: 'No se permiten fechas anteriores a hoy' });
            return;
        }
        if (hayCompuestas) {
            if (!fechaRetiro) {
                showToast({ type: 'warning', message: 'La selección incluye muestreos compuestos: indique la fecha de retiro' });
                return;
            }
            if (fechaRetiro < fechaInstalacion) {
                showToast({ type: 'error', message: 'La fecha de retiro no puede ser anterior a la de instalación' });
                return;
            }
            if (fechaRetiro === fechaInstalacion) {
                showToast({ type: 'error', message: 'En muestreos de 24 h o más, instalación y retiro no pueden ser el mismo día' });
                return;
            }
        }

        setSaving(true);
        try {
            const objetivo = fichasSeleccionadas;
            // La agenda se relee justo antes de escribir: da el id_agendamam real del próximo
            // servicio y evita pisar algo que otro usuario haya agendado mientras se elegía.
            const detalles = await Promise.allSettled(objetivo.map((f) => fichaService.getAssignmentDetail(idDeFicha(f))));

            const assignments: any[] = [];
            const omitidas: string[] = [];

            objetivo.forEach((f, i) => {
                const etiqueta = f.ma_punto_muestreo || `Ficha #${idDeFicha(f)}`;
                const res = detalles[i];
                if (res.status === 'rejected' || !Array.isArray(res.value)) {
                    omitidas.push(etiqueta);
                    return;
                }
                const corr = proximoServicio(f);
                const row = corr
                    ? res.value.find((r: any) => String(r.frecuencia_correlativo || '').trim() === String(corr.frecuencia_correlativo).trim())
                    : null;
                if (!row || !row.id_agendamam) {
                    omitidas.push(etiqueta);
                    return;
                }

                const necesitaRetiro = requiereRetiroAparte(f);
                const idInst = Number(muestreadorInst);
                const idRet = necesitaRetiro && !mismoResponsable && muestreadorRet ? Number(muestreadorRet) : idInst;

                assignments.push({
                    id: row.id_agendamam,
                    fecha: fechaInstalacion,
                    // Puntual: instalación y retiro son el mismo día y el mismo responsable,
                    // igual que hace el detalle ficha por ficha.
                    fechaRetiro: necesitaRetiro ? fechaRetiro : fechaInstalacion,
                    idMuestreadorInstalacion: idInst,
                    idMuestreadorRetiro: idRet,
                    idFichaIngresoServicio: idDeFicha(f),
                    frecuenciaCorrelativo: row.frecuencia_correlativo || 'PorAsignar',
                    expectAvailable: true
                });
            });

            if (assignments.length === 0) {
                showToast({ type: 'error', message: 'No se encontraron servicios disponibles para agendar. Refresque la lista.' });
                return;
            }

            const response = await fichaService.batchUpdateAgenda({
                assignments,
                user: user ? { id: user.id } : { id: 0 },
                observaciones: 'Asignación en bloque por centro desde Planificación y Asignación.',
                observacionNotificacion: observacion.trim() || null
            });

            showToast({
                type: 'success',
                message: response?.message || `${assignments.length} servicio${assignments.length !== 1 ? 's' : ''} agendado${assignments.length !== 1 ? 's' : ''}`
            });
            if (omitidas.length > 0) {
                showToast({ type: 'warning', message: `Se omitieron ${omitidas.length}: ${omitidas.slice(0, 3).join(', ')}${omitidas.length > 3 ? '…' : ''}` });
            }

            setAsignarOpen(false);
            setSeleccion(new Set());

            const refreshed = await fichaService.getForAssignment();
            let data = [];
            if (Array.isArray(refreshed)) data = refreshed;
            else if (refreshed && refreshed.data && Array.isArray(refreshed.data)) data = refreshed.data;
            setFichas(data || []);
        } catch (error: any) {
            console.error('Error en asignación masiva:', error);
            showToast({ type: 'error', message: error?.response?.data?.message || 'Error al agendar los servicios seleccionados' });
        } finally {
            setSaving(false);
        }
    };

    return (
        // Columna de alto completo: encabezado y filtros quedan fijos arriba
        // ([&>*]:shrink-0) y la tarjeta de la lista toma el resto con su propio scroll.
        <div className="shadcn-scope relative flex h-full min-h-0 flex-col [&>*]:shrink-0">
            <PageHeader
                title="Planificación y Asignación"
                subtitle="Gestión de recursos y programación de muestreos"
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'Asignación' }
                ]}
                rightSection={
                    <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xs text-muted-foreground">
                            {filteredFichas.length} fichas en {grupos.length} centro{grupos.length !== 1 ? 's' : ''}
                        </span>

                        <Sheet open={filtersSheetOpen} onOpenChange={setFiltersSheetOpen}>
                            <SheetTrigger asChild>
                                <Button variant="outline">
                                    <IconFilter size={16} /> Filtros
                                    {panelFilterCount > 0 && (
                                        <Badge variant="secondary" className="ml-1 px-1.5">{panelFilterCount}</Badge>
                                    )}
                                </Button>
                            </SheetTrigger>
                            <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-sm">
                                <SheetHeader>
                                    <SheetTitle>Filtros de búsqueda</SheetTitle>
                                </SheetHeader>

                                <div className="flex flex-1 flex-col gap-4">
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">N° Ficha</Label>
                                        <div className="relative">
                                            <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                            <Input className="pl-8" placeholder="Ej: 1234" value={searchId} onChange={(e) => setSearchId(e.target.value)} />
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Estado</Label>
                                        <Combobox placeholder="Todos" searchPlaceholder="Buscar estado..." options={uniqueEstados} value={searchEstado ?? ''} onValueChange={(v) => setSearchEstado(v || null)} />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Monitoreo</Label>
                                        <Combobox placeholder="Todos" searchPlaceholder="Buscar monitoreo..." options={uniqueMonitoreo} value={searchMonitoreo ?? ''} onValueChange={(v) => setSearchMonitoreo(v || null)} />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Empresa a Facturar</Label>
                                        <Combobox placeholder="Todos" searchPlaceholder="Buscar empresa..." options={uniqueEmpFacturar} value={searchEmpresaFacturar ?? ''} onValueChange={(v) => setSearchEmpresaFacturar(v || null)} />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Empresa de Servicio</Label>
                                        <Combobox placeholder="Todos" searchPlaceholder="Buscar empresa..." options={uniqueEmpServicio} value={searchEmpresaServicio ?? ''} onValueChange={(v) => setSearchEmpresaServicio(v || null)} />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Fuente Emisora</Label>
                                        <Combobox placeholder="Todos" searchPlaceholder="Buscar centro..." options={uniqueCentros} value={searchCentro ?? ''} onValueChange={(v) => setSearchCentro(v || null)} />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Objetivo de Muestreo</Label>
                                        <Combobox placeholder="Todos" searchPlaceholder="Buscar objetivo..." options={uniqueObjetivos} value={searchObjetivo ?? ''} onValueChange={(v) => setSearchObjetivo(v || null)} />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Sub Área</Label>
                                        <Combobox placeholder="Todos" searchPlaceholder="Buscar sub área..." options={uniqueSubAreas} value={searchSubArea ?? ''} onValueChange={(v) => setSearchSubArea(v || null)} />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Desde</Label>
                                        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Hasta</Label>
                                        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                                    </div>
                                </div>

                                <SheetFooter>
                                    {panelFilterCount > 0 && (
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

            {/* La tarjeta no lleva flex-1 (se estiraría dejando un hueco con pocos
                centros) ni esta franja overflow-y-auto (scrollearía la página, empujando
                la paginación fuera de vista al subir los centros por página). Con min-h-0
                la tarjeta mide su contenido mientras entra y se encoge cuando no: ahí
                scrollea el listado por dentro y la paginación queda fija abajo. */}
            <div className="flex min-h-0 flex-1 flex-col">
            <Card className="flex min-h-0 flex-col p-0">
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="relative w-full max-w-sm">
                        <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="pl-8"
                            placeholder="Buscar centro o punto de muestreo..."
                            value={quickSearch}
                            onChange={(e) => { setQuickSearch(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <IconLayoutList size={14} /> Agrupado por centro
                    </div>
                </div>

                <div className="relative flex min-h-0 flex-col overflow-hidden">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    )}

                    <div className="min-h-0 overflow-y-auto">
                        {gruposPaginados.length === 0 ? (
                            <p className="py-10 text-center text-sm text-muted-foreground">
                                {loading ? 'Cargando...' : 'No se encontraron fichas.'}
                            </p>
                        ) : (
                            gruposPaginados.map((g) => {
                                // Colapsados por defecto: con cientos de centros, abrirlos todos
                                // deja una lista imposible de recorrer. Se abre el que interesa.
                                const abierto = abiertos[g.key] === true;
                                const marcados = g.asignables.filter((f) => seleccion.has(idDeFicha(f))).length;

                                return (
                                    <div key={g.key}>
                                        <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5">
                                            {puedeAsignar && (
                                                <Checkbox
                                                    checked={estadoGrupo(g)}
                                                    disabled={g.asignables.length === 0}
                                                    onCheckedChange={() => toggleGrupo(g)}
                                                    aria-label={`Seleccionar todos los puntos de ${g.centro}`}
                                                />
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setAbiertos((p) => ({ ...p, [g.key]: !abierto }))}
                                                aria-expanded={abierto}
                                                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                            >
                                                {abierto
                                                    ? <IconChevronDown size={16} className="shrink-0 text-muted-foreground" />
                                                    : <IconChevronRight size={16} className="shrink-0 text-muted-foreground" />}
                                                <span className="min-w-0">
                                                    <span className="block truncate text-sm font-semibold" title={g.centro}>{g.centro}</span>
                                                    <span className="block truncate text-xs text-muted-foreground" title={g.empresa}>{g.empresa || '-'}</span>
                                                </span>
                                            </button>
                                            <span className="shrink-0 text-xs text-muted-foreground">
                                                {g.fichas.length} punto{g.fichas.length !== 1 ? 's' : ''} · {g.asignables.length} por agendar
                                            </span>
                                            {marcados > 0 && (
                                                <Badge variant="secondary" className="shrink-0">{marcados} sel.</Badge>
                                            )}
                                        </div>

                                        {abierto && g.fichas.map((f) => {
                                            const id = idDeFicha(f);
                                            const corr = proximoServicio(f);
                                            const status = f.estado_ficha || f.nombre_estadomuestreo;
                                            const bloqueadoPorCoordinacion = String(status || '').toUpperCase().includes('COORDINAC');
                                            const asignable = !!corr && !bloqueadoPorCoordinacion;
                                            const total = Number(f.total_servicios || 0);

                                            return (
                                                <div
                                                    key={String(id)}
                                                    className={cn(
                                                        'flex items-center gap-3 border-b border-border/60 px-4 py-2.5 transition-colors hover:bg-muted/40',
                                                        seleccion.has(id) && 'bg-primary/5'
                                                    )}
                                                >
                                                    {puedeAsignar && (
                                                        <Checkbox
                                                            checked={seleccion.has(id)}
                                                            disabled={!asignable}
                                                            onCheckedChange={() => toggleFicha(id)}
                                                            aria-label={`${f.ma_punto_muestreo || `Ficha ${id}`}, servicio ${corr?.numero_servicio ?? '-'} de ${total}`}
                                                        />
                                                    )}

                                                    <div className="min-w-0 flex-1 pl-1">
                                                        <span className="block truncate text-sm font-medium" title={f.ma_punto_muestreo || undefined}>
                                                            {f.ma_punto_muestreo || `Ficha #${f.fichaingresoservicio || id}`}
                                                        </span>
                                                        <span className="block truncate text-xs text-muted-foreground" title={f.nombre_objetivomuestreo_ma || undefined}>
                                                            #{f.fichaingresoservicio || id}
                                                            {f.nombre_objetivomuestreo_ma ? ` · ${f.nombre_objetivomuestreo_ma}` : ''}
                                                        </span>
                                                    </div>

                                                    <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                                                        {corr ? (
                                                            <Badge variant="outline" className="font-normal">servicio {corr.numero_servicio}/{total}</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="font-normal text-muted-foreground">{total}/{total} agendados</Badge>
                                                        )}
                                                        <Badge variant={esCompuesta(f) ? 'warning' : 'secondary'} className="font-normal">
                                                            {f.tipo_fichaingresoservicio || '-'}
                                                        </Badge>
                                                    </div>

                                                    <div className="hidden w-40 shrink-0 justify-end sm:flex">
                                                        <Badge variant={getStatusVariant(status)}>{status || '-'}</Badge>
                                                    </div>

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="shrink-0"
                                                        title={bloqueadoPorCoordinacion
                                                            ? 'Pendiente de aprobación por Área de Coordinación.'
                                                            : 'Abrir detalle de asignación (servicio por servicio)'}
                                                        disabled={bloqueadoPorCoordinacion}
                                                        onClick={() => onViewAssignment(id)}
                                                    >
                                                        <IconCalendarStats size={17} />
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

            </Card>

            <DataPagination
                page={currentPage}
                pageSize={gruposPorPagina}
                total={grupos.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => { setGruposPorPagina(size); setCurrentPage(1); }}
            />
            </div>

            {puedeAsignar && seleccion.size > 0 && (
                <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center">
                    <div className="pointer-events-auto flex items-center gap-4 rounded-xl bg-foreground py-2.5 pl-5 pr-2.5 shadow-lg">
                        <span className="whitespace-nowrap text-sm font-medium text-background">
                            {seleccion.size} punto{seleccion.size !== 1 ? 's' : ''} seleccionado{seleccion.size !== 1 ? 's' : ''}
                        </span>
                        <span className="h-5 w-px bg-background/25" />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-background/70 hover:bg-background/10 hover:text-background"
                            onClick={() => setSeleccion(new Set())}
                        >
                            Limpiar
                        </Button>
                        <Button size="sm" onClick={abrirAsignar}>
                            <IconCalendarStats size={15} /> Agendar y asignar
                        </Button>
                    </div>
                </div>
            )}

            <Sheet open={asignarOpen} onOpenChange={setAsignarOpen}>
                <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
                    <SheetHeader className="border-b border-border px-6 py-5">
                        <SheetTitle>Agendar y asignar</SheetTitle>
                        <SheetDescription>Se agenda el próximo servicio pendiente de cada punto.</SheetDescription>
                    </SheetHeader>

                    <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
                        <section className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selección</span>
                                <span className="text-xs text-muted-foreground">
                                    {fichasSeleccionadas.length} punto{fichasSeleccionadas.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="flex max-h-44 flex-col gap-1.5 overflow-y-auto rounded-lg border border-border bg-muted/40 p-3">
                                {fichasSeleccionadas.map((f) => {
                                    const corr = proximoServicio(f);
                                    return (
                                        <div key={String(idDeFicha(f))} className="flex items-center justify-between gap-2 text-xs">
                                            <span className="truncate" title={`${f.centro || f.nombre_centro} · ${f.ma_punto_muestreo || ''}`}>
                                                {f.ma_punto_muestreo || `Ficha #${idDeFicha(f)}`}
                                            </span>
                                            <span className="shrink-0 text-muted-foreground">
                                                {corr ? `${corr.numero_servicio}/${f.total_servicios}` : '-'}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        {hayCompuestas && (
                            <div className="flex gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3">
                                <IconAlertTriangle size={17} className="mt-0.5 shrink-0 text-warning" />
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-semibold">
                                        {compuestasCount} punto{compuestasCount !== 1 ? 's' : ''} con muestreo compuesto (24 h o más)
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        La instalación y el retiro no pueden ser el mismo día, así que se piden ambas fechas.
                                        Los puntos puntuales usan sólo la fecha de muestreo.
                                    </span>
                                </div>
                            </div>
                        )}

                        <section className="flex flex-col gap-2">
                            <Label>{hayCompuestas ? 'Fecha de instalación' : 'Fecha de muestreo'}</Label>
                            <DatePicker value={fechaInstalacion} onChange={setFechaInstalacion} placeholder="Seleccionar fecha" />
                        </section>

                        {hayCompuestas && (
                            <section className="flex flex-col gap-2">
                                <Label>Fecha de retiro</Label>
                                <DatePicker value={fechaRetiro} onChange={setFechaRetiro} placeholder="Seleccionar fecha" />
                            </section>
                        )}

                        <section className="flex flex-col gap-2">
                            <Label>Responsable{hayCompuestas ? ' de instalación' : ''}</Label>
                            <Combobox
                                options={muestreadorOptions}
                                value={muestreadorInst ?? ''}
                                onValueChange={(v) => setMuestreadorInst(v || null)}
                                placeholder="Seleccionar responsable..."
                                searchPlaceholder="Buscar responsable..."
                            />
                        </section>

                        {hayCompuestas && (
                            <section className="flex flex-col gap-2.5">
                                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                                    <Checkbox checked={mismoResponsable} onCheckedChange={(v) => setMismoResponsable(v === true)} />
                                    Mismo responsable para el retiro
                                </label>
                                {!mismoResponsable && (
                                    <div className="flex flex-col gap-2">
                                        <Label>Responsable de retiro</Label>
                                        <Combobox
                                            options={muestreadorOptions}
                                            value={muestreadorRet ?? ''}
                                            onValueChange={(v) => setMuestreadorRet(v || null)}
                                            placeholder="Seleccionar responsable..."
                                            searchPlaceholder="Buscar responsable..."
                                        />
                                    </div>
                                )}
                            </section>
                        )}

                        <section className="flex flex-col gap-2">
                            <Label>Observación <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                            <Textarea
                                rows={3}
                                value={observacion}
                                onChange={(e) => setObservacion(e.target.value)}
                                placeholder="Se incluye en la notificación al responsable"
                            />
                        </section>
                    </div>

                    <SheetFooter className="border-t border-border px-6 py-4">
                        <Button variant="outline" onClick={() => setAsignarOpen(false)} disabled={saving}>Cancelar</Button>
                        <Button onClick={confirmarAsignacion} disabled={saving} className="flex-1">
                            {saving ? 'Agendando...' : `Confirmar · ${fichasSeleccionadas.length} servicio${fichasSeleccionadas.length !== 1 ? 's' : ''}`}
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    );
};
