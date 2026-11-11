import { type Table } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Números de página a mostrar: hasta 5 botones y «…» en los saltos (idéntico al de la plantilla). */
function numerosDePagina(actual: number, total: number): (number | '...')[] {
    const max = 5;
    if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);
    const r: (number | '...')[] = [1];
    if (actual <= 3) {
        r.push(2, 3, 4, '...', total);
    } else if (actual >= total - 2) {
        r.push('...');
        for (let i = total - 3; i <= total; i++) r.push(i);
    } else {
        r.push('...', actual - 1, actual, actual + 1, '...', total);
    }
    return r;
}

/**
 * Paginación de la plantilla: «Filas por página» (10–50), «Página X de Y», primera/anterior, números, siguiente/última.
 * Se adapta al ancho del contenido con consultas de contenedor (`@container/content`, que pone el layout).
 */
export function DataTablePagination<TData>({ table, className }: { table: Table<TData>; className?: string }) {
    const actual = table.getState().pagination.pageIndex + 1;
    const total = table.getPageCount();
    const numeros = numerosDePagina(actual, total);

    return (
        <div
            className={cn('flex items-center justify-between overflow-clip px-2', '@max-2xl/content:flex-col-reverse @max-2xl/content:gap-4', className)}
            style={{ overflowClipMargin: 1 }}
        >
            <div className="flex w-full items-center justify-between">
                <div className="flex w-25 items-center justify-center text-sm font-medium @2xl/content:hidden">
                    Página {actual} de {total}
                </div>
                <div className="flex items-center gap-2 @max-2xl/content:flex-row-reverse">
                    <Select value={`${table.getState().pagination.pageSize}`} onValueChange={(v) => table.setPageSize(Number(v))}>
                        <SelectTrigger className="h-8 w-17.5">
                            <SelectValue placeholder={table.getState().pagination.pageSize} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {[10, 20, 30, 40, 50].map((n) => (
                                <SelectItem key={n} value={`${n}`}>{n}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="hidden text-sm font-medium sm:block">Filas por página</p>
                </div>
            </div>

            <div className="flex items-center sm:space-x-6 lg:space-x-8">
                <div className="flex w-25 items-center justify-center text-sm font-medium @max-3xl/content:hidden">
                    Página {actual} de {total}
                </div>
                <div className="flex items-center space-x-2">
                    <Button variant="outline" className="size-8 p-0 @max-md/content:hidden" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                        <span className="sr-only">Ir a la primera página</span>
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" className="size-8 p-0" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                        <span className="sr-only">Ir a la página anterior</span>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {numeros.map((n, i) => (
                        <div key={`${n}-${i}`} className="flex items-center">
                            {n === '...' ? (
                                <span className="px-1 text-sm text-muted-foreground">...</span>
                            ) : (
                                <Button variant={actual === n ? 'default' : 'outline'} className="h-8 min-w-8 px-2" onClick={() => table.setPageIndex(n - 1)}>
                                    <span className="sr-only">Ir a la página {n}</span>
                                    {n}
                                </Button>
                            )}
                        </div>
                    ))}

                    <Button variant="outline" className="size-8 p-0" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                        <span className="sr-only">Ir a la página siguiente</span>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" className="size-8 p-0 @max-md/content:hidden" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
                        <span className="sr-only">Ir a la última página</span>
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
