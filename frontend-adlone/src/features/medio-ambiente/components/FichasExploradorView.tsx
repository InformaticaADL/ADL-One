import React, { useState, useEffect, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { FichaExportModal } from './FichaExportModal';
import { useTableSort } from '../../../hooks/useTableSort';
import { useFichasFiltersStore } from '../store/fichasFiltersStore';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Table, TableHeader, TableBody, TableRow, TableHead, SortableTableHead, TableCell } from '@/components/ui/table';
import { DataPagination } from '@/components/ui/pagination';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import {
    IconDownload,
    IconEye,
    IconSearch,
    IconEraser,
    IconFilter,
} from '@tabler/icons-react';

interface Props {
    onBackToMenu: () => void;
    onViewDetail: (id: number) => void;
}

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';

type SortKey = 'id' | 'estado' | 'fecha' | 'empresaFacturar' | 'empresaServicio' | 'objetivo';

export const FichasExploradorView: React.FC<Props> = ({ onBackToMenu, onViewDetail }) => {
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
    const [loading, setLoading] = useState(true);
    const [fichas, setFichas] = useState<any[]>([]);
    const [showExportModal, setShowExportModal] = useState(false);
    const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);

    const itemsPerPage = 10;

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
    }, []);

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
        if (s.includes('COORDINACIÓN')) return { variant: 'default', label: s };
        if (s.includes('PROGRAMACIÓN')) return { variant: 'secondary', label: s };
        if (s.includes('PENDIENTE') || s.includes('ÁREA TÉCNICA')) return { variant: 'warning', label: 'PENDIENTE TÉCNICA' };
        if (s.includes('ASIGNAR')) return { variant: 'warning', label: s };
        if (s.includes('VIGENTE') || s.includes('APROBADA') || s.includes('EJECUTADO') || s.includes('EN PROCESO')) return { variant: 'success', label: s };
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

    const panelFilterCount = [searchId, searchEstado, searchTipo, searchEmpresaFacturar, searchEmpresaServicio, searchCentro, searchObjetivo, searchSubArea, searchUsuario, dateFrom, dateTo].filter(Boolean).length;

    const paginatedFichas = useMemo(() => {
        const start = (page - 1) * itemsPerPage;
        return sortedFichas.slice(start, start + itemsPerPage);
    }, [sortedFichas, page]);

    const handleDownloadPdf = async (e: React.MouseEvent, ficha: any) => {
        e.stopPropagation();
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
        // Columna de alto completo: encabezado y filtros quedan fijos arriba
        // ([&>*]:shrink-0) y la tarjeta de la tabla toma el resto con su propio
        // scroll. La tabla igual crece porque flex-1 le deja basis 0 y grow 1.
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
                        <span className="text-xs text-muted-foreground">{sortedFichas.length} registros encontrados</span>

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

            <Card className="flex min-h-0 flex-1 flex-col p-0">
                <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    )}
                    <Table containerClassName="min-h-0 flex-1">
                        {/* Sticky a nivel de <th>: las columnas siguen visibles
                            al scrollear el listado. */}
                        <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:border-b [&_th]:border-border [&_th]:bg-card">
                            <TableRow className="hover:bg-transparent">
                                <SortableTableHead {...sortProps('id')} className="w-20">ID</SortableTableHead>
                                <SortableTableHead {...sortProps('estado')} className="text-center">Estado</SortableTableHead>
                                <SortableTableHead {...sortProps('fecha')}>Fecha</SortableTableHead>
                                <SortableTableHead {...sortProps('empresaFacturar')}>Facturar a</SortableTableHead>
                                <SortableTableHead {...sortProps('empresaServicio')}>E. Servicio</SortableTableHead>
                                <SortableTableHead {...sortProps('objetivo')}>Objetivo</SortableTableHead>
                                <TableHead>Base Operaciones</TableHead>
                                <TableHead className="text-center">PDF</TableHead>
                                <TableHead className="text-center">Ver</TableHead>
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
                                    return (
                                        <TableRow key={String(idFicha)}>
                                            <TableCell className="font-semibold text-primary">{ficha.fichaingresoservicio || '-'}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={status.variant}>{status.label}</Badge>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-xs">{ficha.fecha || '-'}</TableCell>
                                            <TableCell className="max-w-[160px] truncate" title={ficha.empresa_facturar}>{ficha.empresa_facturar || '-'}</TableCell>
                                            <TableCell className="max-w-[160px] truncate" title={ficha.empresa_servicio}>{ficha.empresa_servicio || '-'}</TableCell>
                                            <TableCell className="max-w-[160px] truncate" title={ficha.nombre_objetivomuestreo_ma}>{ficha.nombre_objetivomuestreo_ma || '-'}</TableCell>
                                            <TableCell className="max-w-[140px] truncate" title={ficha.base_operaciones}>{ficha.base_operaciones || '-'}</TableCell>
                                            <TableCell className="text-center">
                                                <ProtectedContent permission={['FI_EXPORTAR_CFI', 'FI_EXP_AFE']}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className={isRejected ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : undefined}
                                                        title={isRejected ? 'Atención: esta ficha ha sido rechazada' : 'Descargar PDF'}
                                                        onClick={(e) => handleDownloadPdf(e, ficha)}
                                                    >
                                                        <IconDownload size={18} />
                                                    </Button>
                                                </ProtectedContent>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <ProtectedContent permission={['FI_CONSULTAR', 'FI_VER', 'FI_APROBAR_TEC', 'FI_RECHAZAR_TEC', 'FI_APROBAR_COO', 'FI_RECHAZAR_COO', 'FI_EDITAR']}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-primary hover:bg-primary/10 hover:text-primary"
                                                        title="Ver ficha"
                                                        onClick={() => onViewDetail(idFicha)}
                                                    >
                                                        <IconEye size={18} />
                                                    </Button>
                                                </ProtectedContent>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="shrink-0 px-4 py-3">
                    <DataPagination page={page} pageSize={itemsPerPage} total={sortedFichas.length} onPageChange={setPage} />
                </div>
            </Card>
        </div>
    );
};
