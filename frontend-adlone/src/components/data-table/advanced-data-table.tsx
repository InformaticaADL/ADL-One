import { useEffect, useMemo, useState } from 'react';
import {
    type ColumnDef,
    type ColumnFiltersState,
    type SortingState,
    type Table as TanTable,
    type VisibilityState,
    flexRender,
    getCoreRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTableBulkActions } from './bulk-actions';
import { DataTableFacetedFilter, type OpcionFiltro } from './faceted-filter';
import { DataTablePagination } from './pagination';
import { DataTableViewOptions } from './view-options';

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface FiltroFaceta {
    /** id de la columna sobre la que filtra. */
    columna: string;
    titulo: string;
    opciones: OpcionFiltro[];
}

interface Props<TData> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    columns: ColumnDef<TData, any>[];
    data: TData[];
    /** Identificador estable de cada fila (para que la selección sobreviva a un refresco). */
    getRowId?: (fila: TData) => string;
    /** Buscador de texto libre: `texto` devuelve todo lo que se puede buscar en la fila. */
    busqueda?: { placeholder: string; texto: (fila: TData) => string };
    filtros?: FiltroFaceta[];
    /** Filtros que arrancan aplicados (ej. solo «Activo»). «Limpiar» los quita. */
    filtrosIniciales?: ColumnFiltersState;
    /** Con acciones masivas la tabla gana una columna de casillas y la barra flotante. */
    entidad?: { singular: string; plural: string };
    accionesMasivas?: (table: TanTable<TData>) => React.ReactNode;
    /** Botones extra a la derecha de la barra de herramientas (ej. Exportar). */
    barraDerecha?: React.ReactNode;
    pageSize?: number;
    cargando?: boolean;
    mensajeVacio?: string;
    /** Recibe la tabla ya filtrada (ej. para exportar lo que se está viendo). */
    onTabla?: (table: TanTable<TData>) => void;
}

/**
 * Tabla con el kit completo del «shadcn-admin»: buscador, filtros por faceta con contadores, columnas visibles,
 * encabezados con menú, selección de filas con barra flotante de acciones masivas, paginación y esqueleto de carga.
 * Las columnas se definen con `ColumnDef` de TanStack (usa `DataTableColumnHeader` para el menú del encabezado).
 */
export function AdvancedDataTable<TData>({
    columns, data, getRowId, busqueda, filtros = [], filtrosIniciales = [], entidad, accionesMasivas, barraDerecha,
    pageSize = 10, cargando, mensajeVacio = 'Sin resultados.', onTabla,
}: Props<TData>) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(filtrosIniciales);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = useState({});
    const [globalFilter, setGlobalFilter] = useState('');
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize });

    const seleccionable = !!accionesMasivas;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const columnas = useMemo<ColumnDef<TData, any>[]>(() => {
        if (!seleccionable) return columns;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const seleccion: ColumnDef<TData, any> = {
            id: 'seleccion',
            enableSorting: false,
            enableHiding: false,
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
                    onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
                    aria-label="Seleccionar todas las filas de la página"
                />
            ),
            cell: ({ row }) => (
                <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label="Seleccionar fila" />
            ),
            meta: { className: 'w-10' },
        };
        return [seleccion, ...columns];
    }, [columns, seleccionable]);

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data,
        columns: columnas,
        getRowId: getRowId ? (fila) => getRowId(fila) : undefined,
        state: { sorting, columnFilters, columnVisibility, rowSelection, globalFilter, pagination },
        enableRowSelection: seleccionable,
        onSortingChange: setSorting,
        onColumnFiltersChange: (u) => { setColumnFilters(u); setPagination((p) => ({ ...p, pageIndex: 0 })); },
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        onGlobalFilterChange: (v) => { setGlobalFilter(v); setPagination((p) => ({ ...p, pageIndex: 0 })); },
        onPaginationChange: setPagination,
        globalFilterFn: (row, _id, valor: string) => !valor || (busqueda ? sinAcentos(busqueda.texto(row.original)).includes(sinAcentos(valor)) : true),
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
    });

    useEffect(() => { onTabla?.(table); }, [table, onTabla, data, columnFilters, globalFilter]);

    // Si el filtro deja menos páginas que la actual, se vuelve a la última que exista.
    const totalPaginas = table.getPageCount();
    useEffect(() => {
        if (pagination.pageIndex > 0 && pagination.pageIndex >= totalPaginas) setPagination((p) => ({ ...p, pageIndex: Math.max(0, totalPaginas - 1) }));
    }, [totalPaginas, pagination.pageIndex]);

    const filtrado = columnFilters.length > 0 || globalFilter !== '';
    const filas = table.getRowModel().rows;
    const visibles = table.getVisibleLeafColumns().length;

    const hayElegidos = seleccionable && table.getFilteredSelectedRowModel().rows.length > 0;

    return (
        <div className={cn('flex flex-1 flex-col gap-4', hayElegidos && 'pb-20')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-1 flex-wrap items-center gap-2">
                    {busqueda && (
                        <Input
                            value={globalFilter}
                            onChange={(e) => table.setGlobalFilter(e.target.value)}
                            placeholder={busqueda.placeholder}
                            className="h-8 w-37.5 lg:w-62.5"
                        />
                    )}
                    <div className="flex flex-wrap gap-2">
                        {filtros.map((f) => {
                            const col = table.getColumn(f.columna);
                            return col ? <DataTableFacetedFilter key={f.columna} column={col} title={f.titulo} options={f.opciones} /> : null;
                        })}
                    </div>
                    {filtrado && (
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-sm lg:px-3" onClick={() => { table.resetColumnFilters(true); table.setGlobalFilter(''); setColumnFilters([]); }}>
                            Restablecer <X className="ms-2 h-4 w-4" />
                        </Button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {barraDerecha}
                    <DataTableViewOptions table={table} />
                </div>
            </div>

            <div className="overflow-hidden rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((grupo) => (
                            <TableRow key={grupo.id} className="hover:bg-transparent">
                                {grupo.headers.map((h) => (
                                    <TableHead key={h.id} colSpan={h.colSpan} className={cn('h-10 whitespace-nowrap px-2 text-sm font-medium normal-case tracking-normal text-foreground', h.column.columnDef.meta?.className)}>
                                        {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {cargando && data.length === 0 ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <TableRow key={`esqueleto-${i}`} className="hover:bg-transparent">
                                    {Array.from({ length: visibles }).map((__, j) => (
                                        <TableCell key={j}><div className="h-4 animate-pulse rounded bg-muted" style={{ width: `${55 + ((i * 7 + j * 13) % 35)}%` }} /></TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : filas.length ? (
                            filas.map((fila) => (
                                <TableRow key={fila.id} data-state={fila.getIsSelected() ? 'selected' : undefined} className="data-[state=selected]:bg-muted">
                                    {fila.getVisibleCells().map((c) => (
                                        <TableCell key={c.id} className={cn('whitespace-nowrap p-2', c.column.columnDef.meta?.className)}>
                                            {flexRender(c.column.columnDef.cell, c.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={visibles} className="h-24 text-center text-muted-foreground">{mensajeVacio}</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <DataTablePagination table={table} className="mt-auto" />

            {accionesMasivas && entidad && (
                <DataTableBulkActions table={table} entidad={entidad}>{accionesMasivas(table)}</DataTableBulkActions>
            )}
        </div>
    );
}
