import { useEffect, useState } from 'react';
import {
    type ColumnDef,
    type SortingState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown, SearchIcon } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { DataPagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    /** Placeholder del buscador global. Si se omite, no se muestra la barra de búsqueda. */
    searchPlaceholder?: string;
    /** Filas por página (client-side). Default 10. */
    pageSize?: number;
    /** Mensaje cuando no hay resultados (ej. tras filtrar). */
    emptyMessage?: string;
    /** Clases para el contenedor scrolleable de la tabla (ver Table.containerClassName). */
    containerClassName?: string;
    /** Si la tabla va dentro de un panel de alto fijo con scroll propio, fija el encabezado arriba. */
    stickyHeader?: boolean;
    /** Oculta la paginación (ej. si la lista ya viene acotada por un filtro del servidor). */
    hidePagination?: boolean;
    /** Clases para el <div> raíz del componente (ej. "min-h-0 flex-1" si va dentro de un panel flex de alto fijo). */
    className?: string;
}

/**
 * Tabla genérica sobre @tanstack/react-table: ordenamiento por columna, búsqueda
 * global y paginación ya resueltos una sola vez. Usa los mismos primitivos
 * visuales (Table/TableHead/...) y el mismo componente de paginación
 * (DataPagination) que el resto del sistema, para que una tabla armada con
 * esto no se vea distinta a las tablas manuales existentes.
 *
 * No reemplaza ninguna tabla existente — es aditivo. Para usarla, definí las
 * columnas con `ColumnDef<TuTipo>[]` (ver docs de tanstack table) y pasale
 * `data`. Todo el resto (buscar, ordenar, paginar) funciona solo.
 */
export function DataTable<TData, TValue>({
    columns,
    data,
    searchPlaceholder,
    pageSize = 10,
    emptyMessage = 'Sin resultados.',
    containerClassName,
    stickyHeader,
    hidePagination,
    className,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize } },
        state: { sorting, globalFilter },
    });

    const { pageIndex, pageSize: currentPageSize } = table.getState().pagination;
    const totalRows = table.getFilteredRowModel().rows.length;

    // Si `data` viene de un filtro externo (búsqueda, tabs de estado, etc.) y
    // encoge, evita quedar parado en una página vacía por haber navegado más
    // adelante antes de filtrar.
    useEffect(() => {
        table.setPageIndex(0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    return (
        <div className={cn('flex flex-col gap-3', className)}>
            {searchPlaceholder && (
                <div className="relative w-full max-w-sm">
                    <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={globalFilter}
                        onChange={(e) => table.setGlobalFilter(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="pl-8"
                    />
                </div>
            )}

            <Table containerClassName={containerClassName}>
                <TableHeader className={stickyHeader ? '[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:border-b [&_th]:border-border [&_th]:bg-card' : undefined}>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="hover:bg-transparent">
                            {headerGroup.headers.map((header) => {
                                const canSort = header.column.getCanSort();
                                const sortDir = header.column.getIsSorted();
                                return (
                                    <TableHead key={header.id} aria-sort={sortDir ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                                        {header.isPlaceholder ? null : canSort ? (
                                            <button
                                                type="button"
                                                onClick={header.column.getToggleSortingHandler()}
                                                className={cn(
                                                    '-ml-2 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium uppercase tracking-wide transition-colors hover:bg-muted hover:text-foreground',
                                                    sortDir && 'text-foreground'
                                                )}
                                            >
                                                {flexRender(header.column.columnDef.header, header.getContext())}
                                                {sortDir === 'asc' ? (
                                                    <ArrowUp className="h-3.5 w-3.5" />
                                                ) : sortDir === 'desc' ? (
                                                    <ArrowDown className="h-3.5 w-3.5" />
                                                ) : (
                                                    <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                                                )}
                                            </button>
                                        ) : (
                                            flexRender(header.column.columnDef.header, header.getContext())
                                        )}
                                    </TableHead>
                                );
                            })}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows.length ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow key={row.id}>
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id}>
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                {emptyMessage}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>

            {!hidePagination && (
                <DataPagination
                    page={pageIndex + 1}
                    pageSize={currentPageSize}
                    total={totalRows}
                    onPageChange={(page) => table.setPageIndex(page - 1)}
                    onPageSizeChange={(size) => table.setPageSize(size)}
                />
            )}
        </div>
    );
}
