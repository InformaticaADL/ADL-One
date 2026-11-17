import React, { useState, useEffect, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { FichaExportModal } from './FichaExportModal';
import { useTableSort } from '../../../hooks/useTableSort';
import { useFichasFiltersStore } from '../store/fichasFiltersStore';
import { useAuth } from '../../../contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Table, TableHeader, TableBody, TableRow, TableHead, SortableTableHead, TableCell } from '@/components/ui/table';
import { DataPagination } from '@/components/ui/pagination';
import { RowActionsMenu } from '@/components/ui/row-actions-menu';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CrearVisitaDialog } from './CrearVisitaDialog';
import { useToast } from '../../../contexts/ToastContext';
import {
    IconDownload,
    IconEye,
    IconSearch,
    IconEraser,
    IconFilter,
    IconChevronDown,
    IconChevronRight,
    IconLink,
} from '@tabler/icons-react';

interface Props {
    onBackToMenu: () => void;
    onViewDetail: (id: number) => void;
}

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'info' | 'destructive';

type SortKey = 'id' | 'estado' | 'fecha' | 'empresaFacturar' | 'empresaServicio' | 'objetivo';

export const FichasExploradorView: React.FC<Props> = ({ onBackToMenu, onViewDetail }) => {
    const { hasPermission } = useAuth();
    // Filtros persistidos fuera del componente (ver fichasFiltersStore): esta vista se
    // desmonta al ir a un detalle y se remonta limpia al volver, así que un useState
    // local perdería los filtros aplicados. Los setters locales son solo adaptadores
    // para no tener que tocar el resto del JSX de abajo.
    const {
        searchId, dateFrom, dateTo, searchEstado, searchTipo, searchEmpresaFacturar,
        searchEmpresaServicio, searchCentro, searchObjetivo, searchSubArea, searchUsuario,
    } = useFichasFiltersStore((s) => s.explorador);
    const setExplorador = useFichasFiltersStore((s) => s.setExplorador);
    const resetExplorador = useFichasFiltersStore((s) => s.resetExplorador);
    const setSearchId = (v: string) => setExplorador({ searchId: v });
    const setDateFrom = (v: string) => setExplorador({ dateFrom: v });
    const setDateTo = (v: string) => setExplorador({ dateTo: v });
    const setSearchEstado = (v: string) => setExplorador({ searchEstado: v });
    const setSearchTipo = (v: string) => setExplorador({ searchTipo: v });
    const setSearchEmpresaFacturar = (v: string) => setExplorador({ searchEmpresaFacturar: v });
    const setSearchEmpresaServicio = (v: string) => setExplorador({ searchEmpresaServicio: v });
    const setSearchCentro = (v: string) => setExplorador({ searchCentro: v });
    const setSearchObjetivo = (v: string) => setExplorador({ searchObjetivo: v });
    const setSearchSubArea = (v: string) => setExplorador({ searchSubArea: v });
    const setSearchUsuario = (v: string) => setExplorador({ searchUsuario: v });

    const [page, setPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [loading, setLoading] = useState(true);
    const [fichas, setFichas] = useState<any[]>([]);
    const [recarga, setRecarga] = useState(0);
    const [showExportModal, setShowExportModal] = useState(false);
    const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);


    useEffect(() => {
        const loadFichas = async () => {
            setLoading(true);
            try {
                const response = await fichaService.getAll();
                let data: any[] = [];
                if (Array.isArray(response)) data = response;
                else if (response && response.data && Array.isArray(response.data)) data = response.data;
                else if (response && Array.isArray(response.recordset)) data = response.recordset;

                // Ordenar por ID de mayor a menor
                data.sort((a, b) => {
                    const idA = a.id_fichaingresoservicio || a.fichaingresoservicio || 0;
                    const idB = b.id_fichaingresoservicio || b.fichaingresoservicio || 0;
                    return idB - idA;
                });

                setFichas(data || []);
            } catch (error) {
                console.error("Error loading fichas:", error);
            } finally {
                setLoading(false);
            }
        };
        loadFichas();
    }, [recarga]);

    useEffect(() => {
        setPage(1);
    }, [searchId, dateFrom, dateTo, searchEstado, searchTipo, searchEmpresaFacturar, searchEmpresaServicio, searchCentro, searchObjetivo, searchSubArea, searchUsuario]);

    const getUniqueValues = (key: string) => {
        const values = new Set<string>();
        fichas.forEach(f => {
            if (f[key]) values.add(String(f[key]).trim());
        });
        return Array.from(values).sort().map(val => ({ value: val, label: val }));
    };

    const uniqueEstados = useMemo(() => getUniqueValues('estado_ficha'), [fichas]);
    const uniqueTipos = useMemo(() => getUniqueValues('tipo_fichaingresoservicio'), [fichas]);
    const uniqueEmpFacturar = useMemo(() => getUniqueValues('empresa_facturar'), [fichas]);
    const uniqueEmpServicio = useMemo(() => getUniqueValues('empresa_servicio'), [fichas]);
    const uniqueCentros = useMemo(() => getUniqueValues('centro'), [fichas]);
    const uniqueObjetivos = useMemo(() => getUniqueValues('nombre_objetivomuestreo_ma'), [fichas]);
    const uniqueSubAreas = useMemo(() => getUniqueValues('nombre_subarea'), [fichas]);
    const uniqueUsuarios = useMemo(() => getUniqueValues('nombre_usuario'), [fichas]);

    // For FichaExportModal format
    const getPlainValues = (key: string) => {
        const values = new Set<string>();
        fichas.forEach(f => {
            if (f[key]) values.add(String(f[key]).trim());
        });
        return Array.from(values).sort();
    };

    const handleClearFilters = () => {
        setSearchId('');
        setDateFrom('');
        setDateTo('');
        setSearchEstado('');
        setSearchTipo('');
        setSearchEmpresaFacturar('');
        setSearchEmpresaServicio('');
        setSearchCentro('');
        setSearchObjetivo('');
        setSearchSubArea('');
        setSearchUsuario('');
    };

    const filteredFichas = fichas.filter(f => {
        const displayId = f.fichaingresoservicio || f.id_fichaingresoservicio || '';
        const matchId = searchId ? String(displayId).includes(searchId) : true;
        const check = (val: string, search: string) => (!search || (val || '').toString().toLowerCase().includes(search.toLowerCase()));

        const matchEstado = check(f.estado_ficha, searchEstado);
        const matchTipo = check(f.tipo_fichaingresoservicio, searchTipo);
        const matchEmpresaFacturar = check(f.empresa_facturar, searchEmpresaFacturar);
        const matchEmpresaServicio = check(f.empresa_servicio, searchEmpresaServicio);
        const matchCentro = check(f.centro, searchCentro);
        const matchObjetivo = check(f.nombre_objetivomuestreo_ma, searchObjetivo);
        const matchSubArea = check(f.nombre_subarea, searchSubArea);
        const matchUsuario = check(f.nombre_usuario, searchUsuario);

        let matchDate = true;
        if (dateFrom || dateTo) {
            if (!f.fecha) return false;
            const parts = f.fecha.split('/');
            if (parts.length === 3) {
                const [d, m, y] = parts;
                const rowDate = new Date(`${y}-${m}-${d}`);
                rowDate.setHours(0, 0, 0, 0);
                if (dateFrom) {
                    const dFrom = new Date(dateFrom);
                    dFrom.setHours(0, 0, 0, 0);
                    if (rowDate < dFrom) matchDate = false;
                }
                if (dateTo && matchDate) {
                    const dTo = new Date(dateTo);
                    dTo.setHours(0, 0, 0, 0);
                    if (rowDate > dTo) matchDate = false;
                }
            }
        }
        return matchId && matchDate && matchEstado && matchTipo && matchEmpresaFacturar && matchEmpresaServicio && matchCentro && matchObjetivo && matchSubArea && matchUsuario;
    });

    const getStatusProps = (status: string): { variant: BadgeVariant; label: string } => {
        const s = (status || '').toUpperCase();
        if (s.includes('RECHAZADA') || s.includes('CANCELADO') || s.includes('REVISAR')) return { variant: 'destructive', label: s };
        if (s.includes('COORDINACIÓN')) return { variant: 'info', label: s };
        if (s.includes('PROGRAMACIÓN')) return { variant: 'secondary', label: s };
        if (s.includes('PENDIENTE') || s.includes('ÁREA TÉCNICA')) return { variant: 'warning', label: 'PENDIENTE TÉCNICA' };
        if (s.includes('ASIGNAR')) return { variant: 'warning', label: s };
        if (s.includes('EN PROCESO')) return { variant: 'info', label: s };
        if (s.includes('VIGENTE') || s.includes('APROBADA') || s.includes('EJECUTADO')) return { variant: 'success', label: s };
        return { variant: 'outline', label: s || 'SIN ESTADO' };
    };

    const sortAccessors: Record<SortKey, (f: any) => string | number | null | undefined> = {
        id: (f) => f.fichaingresoservicio || f.id_fichaingresoservicio,
        estado: (f) => f.estado_ficha,
        fecha: (f) => f.fecha,
        empresaFacturar: (f) => f.empresa_facturar,
        empresaServicio: (f) => f.empresa_servicio,
        objetivo: (f) => f.nombre_objetivomuestreo_ma,
    };
    const { sorted: sortedFichas, sort, toggleSort } = useTableSort(filteredFichas, sortAccessors);
    const sortProps = (key: SortKey) => ({ active: sort.key === key, direction: sort.direction, onSort: () => { toggleSort(key); setPage(1); } });

    // ── Crear visita: fichas puntuales sueltas del mismo centro y empresa se agrupan como puntos de una sola visita.
    const { showToast } = useToast();
    const puedeCrearVisita = hasPermission('FI_CREAR') || hasPermission('FI_GEST_ASIG');
    const idDe = (x: any) => Number(x.id_fichaingresoservicio || x.fichaingresoservicio);
    const llaveLugar = (x: any) => String(x.centro || '').trim() + '|' + String(x.empresa_facturar || '').trim();
    const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
    const [idsVisita, setIdsVisita] = useState<number[] | null>(null);

    const fichasSeleccionadas = useMemo(() => fichas.filter((x) => seleccion.has(idDe(x))), [fichas, seleccion]);
    const mismoLugar = new Set(fichasSeleccionadas.map(llaveLugar)).size <= 1;
    const puedeCrear = puedeCrearVisita && fichasSeleccionadas.length >= 2 && mismoLugar;

    // Sugerencia: puntuales sueltas, del mismo centro y fecha, de la última semana en adelante.
    const sugerencia = useMemo(() => {
        const limite = new Date(); limite.setHours(0, 0, 0, 0); limite.setDate(limite.getDate() - 7);
        const grupos = new Map<string, any[]>();
        fichas.forEach((x) => {
            if (Number(x.id_grupo)) return;
            if (!String(x.tipo_fichaingresoservicio || '').toLowerCase().includes('puntual')) return;
            const p = String(x.fecha || '').split('/');
            if (p.length !== 3) return;
            if (new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0])) < limite) return;
            const k = llaveLugar(x) + '|' + x.fecha;
            grupos.set(k, [...(grupos.get(k) || []), x]);
        });
        let mejor: any[] = [];
        grupos.forEach((g) => { if (g.length > mejor.length) mejor = g; });
        return mejor.length >= 2 ? { fichas: mejor, centro: mejor[0].centro, fecha: mejor[0].fecha } : null;
    }, [fichas]);

    const abrirCrearVisita = (ids: number[]) => setIdsVisita([...ids].sort((a, b) => a - b));
    const confirmarCrearVisita = async ({ orden, nota }: { orden: number[]; nota?: string; agendar: boolean }) => {
        try {
            await fichaService.agrupar(orden, nota, true);
            showToast({ type: 'success', message: orden.length + ' puntos agrupados como una sola visita' });
            setIdsVisita(null); setSeleccion(new Set()); setRecarga((n) => n + 1);
        } catch (error: any) {
            showToast({ type: 'error', message: error?.response?.data?.message || 'No se pudo crear la visita' });
            throw error;
        }
    };
    const fichasDeVisita = (idsVisita || []).map((id) => fichas.find((x) => idDe(x) === id)).filter(Boolean) as any[];
    const ejecutadas = fichasDeVisita.filter((x) => /EJECUTAD|COMPLET/.test(String(x.estado_ficha || '').toUpperCase())).length;

    const panelFilterCount = [searchId, searchEstado, searchTipo, searchEmpresaFacturar, searchEmpresaServicio, searchCentro, searchObjetivo, searchSubArea, searchUsuario, dateFrom, dateTo].filter(Boolean).length;

    // Una visita con varios puntos se muestra como UNA fila (la del primer punto que cumple los filtros) que se despliega con todos
    // sus puntos. Los puntos de una misma visita siempre se ven completos al desplegar, aunque un filtro deje fuera a alguno.
    const [visitasAbiertas, setVisitasAbiertas] = useState<Set<number>>(new Set());
    const toggleVisita = (idGrupo: number) => setVisitasAbiertas(prev => {
        const sig = new Set(prev);
        if (sig.has(idGrupo)) sig.delete(idGrupo); else sig.add(idGrupo);
        return sig;
    });
    const puntosPorVisita = useMemo(() => {
        const m = new Map<number, any[]>();
        fichas.forEach(f => {
            const g = Number(f.id_grupo);
            if (!g) return;
            if (!m.has(g)) m.set(g, []);
            m.get(g)!.push(f);
        });
        m.forEach(lista => lista.sort((a, b) => (Number(a.grupo_orden) || 0) - (Number(b.grupo_orden) || 0)
            || Number(a.id_fichaingresoservicio) - Number(b.id_fichaingresoservicio)));
        return m;
    }, [fichas]);
    const filasVisibles = useMemo(() => {
        const vistos = new Set<number>();
        return sortedFichas.filter(f => {
            const g = Number(f.id_grupo);
            if (!g) return true;
            if (vistos.has(g)) return false;
            vistos.add(g);
            return true;
        });
    }, [sortedFichas]);

    const paginatedFichas = useMemo(() => {
        const start = (page - 1) * itemsPerPage;
        return filasVisibles.slice(start, start + itemsPerPage);
    }, [filasVisibles, page, itemsPerPage]);

    const handleDownloadPdf = async (e: React.MouseEvent | undefined, ficha: any) => {
        e?.stopPropagation();
        const idFicha = ficha.id_fichaingresoservicio || ficha.fichaingresoservicio;
        try {
            const pdfBlob = await fichaService.downloadPdf(Number(idFicha));
            const url = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            const fileName = ficha.frecuencia_correlativo || `Ficha_${idFicha}`;
            link.href = url;
            link.setAttribute('download', `${fileName}.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="shadcn-scope flex h-full min-h-0 flex-col [&>*]:shrink-0">
            <PageHeader
                title="Explorador de Fichas de Ingreso"
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'Explorador' }
                ]}
                rightSection={
                    <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xs text-muted-foreground">{filasVisibles.length} registros encontrados</span>

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
                                            <Input className="pl-8" placeholder="Buscar por ID..." value={searchId} onChange={(e) => setSearchId(e.target.value)} />
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Estado</Label>
                                        <Combobox placeholder="Todos" searchPlaceholder="Buscar estado..." options={uniqueEstados} value={searchEstado} onValueChange={setSearchEstado} />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tipo</Label>
                                        <Combobox placeholder="Todos" searchPlaceholder="Buscar tipo..." options={uniqueTipos} value={searchTipo} onValueChange={setSearchTipo} />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Empresa a Facturar</Label>
                                        <Combobox placeholder="Todos" searchPlaceholder="Buscar empresa..." options={uniqueEmpFacturar} value={searchEmpresaFacturar} onValueChange={setSearchEmpresaFacturar} />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Empresa de Servicio</Label>
                                        <Combobox placeholder="Todos" searchPlaceholder="Buscar empresa..." options={uniqueEmpServicio} value={searchEmpresaServicio} onValueChange={setSearchEmpresaServicio} />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Fuente Emisora</Label>
                                        <Combobox placeholder="Todos" searchPlaceholder="Buscar centro..." options={uniqueCentros} value={searchCentro} onValueChange={setSearchCentro} />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Objetivo de Muestreo</Label>
                                        <Combobox placeholder="Todos" searchPlaceholder="Buscar objetivo..." options={uniqueObjetivos} value={searchObjetivo} onValueChange={setSearchObjetivo} />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Sub Área</Label>
                                        <Combobox placeholder="Todos" searchPlaceholder="Buscar sub área..." options={uniqueSubAreas} value={searchSubArea} onValueChange={setSearchSubArea} />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Usuario</Label>
                                        <Combobox placeholder="Todos" searchPlaceholder="Buscar usuario..." options={uniqueUsuarios} value={searchUsuario} onValueChange={setSearchUsuario} />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Fecha Desde</Label>
                                        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Fecha Hasta</Label>
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

                        <ProtectedContent permission="FI_EXP_MC">
                            <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={() => setShowExportModal(true)}>
                                <IconDownload size={16} /> Exportar PDF
                            </Button>
                        </ProtectedContent>
                    </div>
                }
            />

            <FichaExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                initialFilters={{
                    ficha: searchId, estado: searchEstado, fechaDesde: dateFrom, fechaHasta: dateTo, tipo: searchTipo, empresaFacturar: searchEmpresaFacturar, empresaServicio: searchEmpresaServicio, centro: searchCentro, objetivo: searchObjetivo, subArea: searchSubArea, usuario: searchUsuario
                }}
                catalogos={{
                    estados: getPlainValues('estado_ficha'), tipos: getPlainValues('tipo_fichaingresoservicio'), empresasFacturar: getPlainValues('empresa_facturar'), empresasServicio: getPlainValues('empresa_servicio'), centros: getPlainValues('centro'), objetivos: getPlainValues('nombre_objetivomuestreo_ma'), subAreas: getPlainValues('nombre_subarea'), fichas: getPlainValues('id_fichaingresoservicio'), usuarios: getPlainValues('nombre_usuario')
                }}
            />

            {/* La franja toma el alto disponible (flex-1) y la tarjeta de adentro no:
                así la tabla scrollea por dentro y la paginación queda SIEMPRE en el
                mismo lugar, sin desplazarse al subir las filas por página. Sin
                overflow-y-auto acá, que scrollearía la página entera en vez de la
                tabla. */}
            <div className="flex min-h-0 flex-1 flex-col">
            {puedeCrearVisita && sugerencia && seleccion.size === 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg bg-primary/10 px-4 py-3 text-sm">
                    <span className="size-1.5 shrink-0 rounded-full bg-[var(--sc-mark)]" />
                    <span>
                        <strong>{sugerencia.fichas.length} fichas puntuales</strong> de {sugerencia.centro} del {sugerencia.fecha} están sueltas. Puedes crearlas como <strong>una sola visita</strong>.
                    </span>
                    <Button size="sm" className="ms-auto" onClick={() => { setSeleccion(new Set(sugerencia.fichas.map(idDe))); abrirCrearVisita(sugerencia.fichas.map(idDe)); }}>
                        Crear visita
                    </Button>
                </div>
            )}
            <Card className="flex min-h-0 flex-col p-0">
                <div className="relative flex min-h-0 flex-col overflow-hidden rounded-xl">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    )}
                    <Table containerClassName="min-h-0">
                        {/* Sticky a nivel de <th>: las columnas siguen visibles
                            al scrollear el listado. */}
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                {puedeCrearVisita && <TableHead className="w-10"><span className="sr-only">Seleccionar</span></TableHead>}
                                <SortableTableHead {...sortProps('id')} className="w-20">ID</SortableTableHead>
                                <SortableTableHead {...sortProps('estado')} className="text-center">Estado</SortableTableHead>
                                <SortableTableHead {...sortProps('fecha')}>Fecha</SortableTableHead>
                                <SortableTableHead {...sortProps('empresaServicio')}>Empresa de servicio</SortableTableHead>
                                <TableHead>Centro</TableHead>
                                <SortableTableHead {...sortProps('objetivo')}>Programa</SortableTableHead>
                                <TableHead>Base Operaciones</TableHead>
                                <TableHead className="w-16 text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedFichas.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                                        {loading ? 'Cargando...' : 'No se encontraron fichas.'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedFichas.map((ficha) => {
                                    const status = getStatusProps(ficha.estado_ficha);
                                    const isRejected = (ficha.estado_ficha || '').toUpperCase().includes('RECHAZADA');
                                    const idFicha = ficha.id_fichaingresoservicio || ficha.fichaingresoservicio;
                                    const idVisita = Number(ficha.id_grupo) || 0;
                                    const puntos = idVisita ? (puntosPorVisita.get(idVisita) || []) : [];
                                    const esVisita = idVisita > 0 && puntos.length > 1;
                                    const abierta = esVisita && visitasAbiertas.has(idVisita);
                                    const accionesDe = (f: any) => {
                                        const id = f.id_fichaingresoservicio || f.fichaingresoservicio;
                                        const rechazada = (f.estado_ficha || '').toUpperCase().includes('RECHAZADA');
                                        return [
                                            {
                                                label: 'Ver ficha',
                                                icon: <IconEye size={16} />,
                                                onClick: () => onViewDetail(id),
                                                hidden: !hasPermission('FI_CONSULTAR') && !hasPermission('FI_VER') && !hasPermission('FI_EDITAR'),
                                            },
                                            {
                                                label: rechazada ? 'Descargar PDF (ficha rechazada)' : 'Descargar PDF',
                                                icon: <IconDownload size={16} />,
                                                onClick: () => handleDownloadPdf(undefined, f),
                                                danger: rechazada,
                                                hidden: !hasPermission('FI_EXPORTAR_CFI') && !hasPermission('FI_EXP_AFE'),
                                            },
                                        ];
                                    };
                                    return (
                                        <React.Fragment key={String(idFicha)}>
                                        <TableRow className={esVisita ? 'cursor-pointer' : undefined} onClick={esVisita ? () => toggleVisita(idVisita) : undefined}>
                                            {puedeCrearVisita && (
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                    {!esVisita && (
                                                        <Checkbox
                                                            checked={seleccion.has(idDe(ficha))}
                                                            onCheckedChange={(v) => setSeleccion((prev) => { const sig = new Set(prev); if (v) sig.add(idDe(ficha)); else sig.delete(idDe(ficha)); return sig; })}
                                                            aria-label={'Seleccionar la ficha ' + (ficha.fichaingresoservicio || '')}
                                                        />
                                                    )}
                                                </TableCell>
                                            )}
                                            <TableCell className="font-semibold text-primary">
                                                {esVisita ? (
                                                    <span className="flex items-center gap-1.5">
                                                        {abierta ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                                                        <span>{ficha.fichaingresoservicio || '-'}</span>
                                                        <Badge variant="secondary" className="ml-1 whitespace-nowrap px-1.5 font-normal">Visita · {puntos.length} puntos</Badge>
                                                    </span>
                                                ) : (ficha.fichaingresoservicio || '-')}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {(() => {
                                                    if (!esVisita) return <Badge variant={status.variant}>{status.label}</Badge>;
                                                    // Visita: si todos sus puntos están igual, ese estado; si no, «Mixto» con el desglose.
                                                    const cuenta = new Map<string, { n: number; props: ReturnType<typeof getStatusProps> }>();
                                                    puntos.forEach((q) => { const sp = getStatusProps(q.estado_ficha); const c = cuenta.get(sp.label) || { n: 0, props: sp }; c.n++; cuenta.set(sp.label, c); });
                                                    if (cuenta.size === 1) return <Badge variant={status.variant}>{status.label}</Badge>;
                                                    const desglose = [...cuenta.entries()].map(([l, c]) => `${c.n} ${l}`).join(' · ');
                                                    return <Badge variant="secondary" title={desglose}>Mixto</Badge>;
                                                })()}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap">{ficha.fecha || '-'}</TableCell>
                                            <TableCell className="whitespace-normal break-words" title={ficha.empresa_servicio}>
                                                <span className="block font-medium">{ficha.empresa_servicio || '-'}</span>
                                                {ficha.empresa_facturar && ficha.empresa_facturar !== ficha.empresa_servicio && (
                                                    <span className="block text-xs text-muted-foreground">Factura a: {ficha.empresa_facturar}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="whitespace-normal break-words font-medium" title={ficha.centro}>{ficha.centro || '-'}</TableCell>
                                            <TableCell className="whitespace-normal break-words" title={ficha.nombre_objetivomuestreo_ma}>{ficha.nombre_objetivomuestreo_ma || '-'}</TableCell>
                                            <TableCell className="whitespace-normal break-words" title={ficha.base_operaciones}>{ficha.base_operaciones || '-'}</TableCell>
                                            {/* La columna PDF se quitó: su descarga vive acá, junto a
                                                "Ver ficha", en el menú de acciones estándar. */}
                                            <TableCell className="text-right">
                                                {esVisita ? (
                                                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                        <Button size="sm" variant="outline" onClick={() => onViewDetail(idDe(ficha))}>Ver visita</Button>
                                                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={abierta ? 'Ocultar los puntos' : 'Ver los puntos'} title={abierta ? 'Ocultar los puntos' : 'Ver los puntos'} onClick={() => toggleVisita(idVisita)}>
                                                            {abierta ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <RowActionsMenu actions={accionesDe(ficha)} />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                        {abierta && (
                                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                <TableCell colSpan={puedeCrearVisita ? 9 : 8} className="py-2.5 pl-9">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {puntos.map((p, i) => {
                                                            const st = getStatusProps(p.estado_ficha);
                                                            const idP = p.id_fichaingresoservicio || p.fichaingresoservicio;
                                                            return (
                                                                <button
                                                                    key={`${idFicha}-p${idP}`}
                                                                    type="button"
                                                                    onClick={() => onViewDetail(Number(idP))}
                                                                    title={`Ficha ${p.fichaingresoservicio || idP} · ${st.label}`}
                                                                    className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs hover:border-primary hover:bg-primary/5"
                                                                >
                                                                    <span className="font-semibold text-primary">{i + 1}</span>
                                                                    <span className="font-medium">{p.grupo_punto || 'sin nombre'}</span>
                                                                    <Badge variant={st.variant} className="px-1.5 py-0 text-[10px]">{st.label}</Badge>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            <DataPagination
                page={page}
                pageSize={itemsPerPage}
                total={filasVisibles.length}
                onPageChange={setPage}
                onPageSizeChange={(size) => { setItemsPerPage(size); setPage(1); }}
            />
            </div>

            {seleccion.size > 0 && (
                <div className="sticky bottom-3 z-10 mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-lg">
                    <span><strong>{seleccion.size}</strong> fichas seleccionadas · {seleccion.size < 2 ? 'marca al menos 2 para crear una visita' : mismoLugar ? 'mismo centro y empresa' : 'son de centros o empresas distintos'}</span>
                    <span className="ms-auto flex gap-2">
                        <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-white/10 hover:text-primary-foreground" onClick={() => setSeleccion(new Set())}>Limpiar</Button>
                        <Button size="sm" variant="secondary" disabled={!puedeCrear} onClick={() => abrirCrearVisita([...seleccion])}>
                            <IconLink size={15} /> Crear visita
                        </Button>
                    </span>
                </div>
            )}

            <CrearVisitaDialog
                open={idsVisita !== null}
                onOpenChange={(o) => { if (!o) setIdsVisita(null); }}
                puntos={fichasDeVisita.map((x) => ({ id: idDe(x), titulo: 'Ficha ' + (x.fichaingresoservicio || idDe(x)), detalle: (x.estado_ficha || 'Sin estado') + ' · ' + (x.fecha || '') }))}
                descripcion={String(fichasDeVisita[0]?.centro || '')}
                aviso={ejecutadas > 0 ? (<><strong>{ejecutadas} {ejecutadas === 1 ? 'punto ya está' : 'puntos ya están'} ejecutados.</strong> Se agrupan para ADL ONE y para facturación, pero sus firmas y documentos ya salieron por separado y no se rehacen.</>) : undefined}
                onConfirmar={confirmarCrearVisita}
            />
        </div>
    );
};
