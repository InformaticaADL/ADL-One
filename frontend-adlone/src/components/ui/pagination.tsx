import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

type PageItem = number | 'ellipsis';

// Nunca más de 7 posiciones, sin importar cuántas páginas haya:
// 1 2 3 4 5 … 39  /  1 … 17 18 19 … 39  /  1 … 35 36 37 38 39
function getPageItems(page: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  if (page >= totalPages - 3) {
    return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'ellipsis', page - 1, page, page + 1, 'ellipsis', totalPages];
}

interface DataPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Si se pasa (junto con onPageSizeChange), muestra el selector "Filas por página". */
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function DataPagination({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizeOptions = PAGE_SIZE_OPTIONS, className }: DataPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    // Estándar único (el de Gestión de Equipos): la paginación va FUERA de la tarjeta
    // de la tabla, como fila hermana debajo, sin borde ni fondo propios. La separación
    // (mt-4) la pone este componente, NO el contenedor de cada página — si el padre
    // además aplicara gap, el espacio se duplicaría. Antes cada página ponía su propio
    // mt-3/mt-4/px-4 y no había dos pies de tabla iguales.
    <div className={cn('mt-4 flex shrink-0 flex-col items-center justify-between gap-3 sm:flex-row', className)}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">
          Mostrando <span className="font-medium text-foreground">{from}–{to}</span> de{' '}
          <span className="font-medium text-foreground">{total}</span> resultados
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">Filas por página</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-8 w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((size) => (
                  <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <nav aria-label="Paginación" className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-2.5"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Anterior</span>
          </Button>

          {getPageItems(page, totalPages).map((item, i) =>
            item === 'ellipsis' ? (
              <span key={`e-${i}`} className="flex h-8 w-8 items-center justify-center text-muted-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </span>
            ) : (
              <Button
                key={item}
                variant={item === page ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onPageChange(item)}
              >
                {item}
              </Button>
            )
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 px-2.5"
            disabled={page === totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}
