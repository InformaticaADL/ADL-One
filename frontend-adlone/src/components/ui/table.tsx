import * as React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** Clases para el div que envuelve la tabla y hace de contenedor de scroll.
      Sirve para acotarle el alto (ej. "min-h-0 flex-1" dentro de una página a
      pantalla completa): así la tabla scrollea sola, con el encabezado sticky,
      en vez de estirar y scrollear la página entera. */
  containerClassName?: string;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, ...props }, ref) => (
    <div className={cn('relative w-full overflow-auto', containerClassName)}>
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  )
);
Table.displayName = 'Table';

// Encabezado fijo por defecto, no opt-in: toda tabla del sistema scrollea dentro
// de su tarjeta, así que sin esto los títulos de columna se pierden al bajar. El
// sticky va a nivel de <th> (no de <thead>, que el navegador no posiciona) y
// necesita fondo propio para que las filas no se transparenten por debajo. Si la
// tabla no tiene ancestro scrolleable, sticky simplemente no hace nada.
const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn(
        '[&_tr]:border-b [&_tr]:border-border',
        '[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-card',
        className
      )}
      {...props}
    />
  )
);
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
  )
);
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn('border-t border-border bg-muted/50 font-medium', className)} {...props} />
  )
);
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn('border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted', className)}
      {...props}
    />
  )
);
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'h-9 px-2.5 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground [&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  )
);
TableHead.displayName = 'TableHead';

interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  active: boolean;
  direction: 'asc' | 'desc';
  onSort: () => void;
}

// Encabezado clickeable: asc → desc → sin orden. Toda tabla del sistema
// usa esto en sus columnas de datos (no en "Acciones").
const SortableTableHead = React.forwardRef<HTMLTableCellElement, SortableTableHeadProps>(
  ({ className, children, active, direction, onSort, ...props }, ref) => (
    <TableHead
      ref={ref}
      className={className}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      {...props}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          '-ml-2 inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium uppercase tracking-wide transition-colors hover:bg-muted hover:text-foreground',
          active && 'text-foreground'
        )}
      >
        {children}
        {active ? (
          direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  )
);
SortableTableHead.displayName = 'SortableTableHead';

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    // py-2: el alto de fila es lo que decide cuántas filas entran sin scroll,
    // más que el tamaño de letra. Con 10 filas por página, py-3 empujaba la
    // última fuera de pantalla en monitores de 1080p.
    <td ref={ref} className={cn('px-2.5 py-2 align-middle [&:has([role=checkbox])]:pr-0', className)} {...props} />
  )
);
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
  )
);
TableCaption.displayName = 'TableCaption';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  SortableTableHead,
  TableRow,
  TableCell,
  TableCaption,
};
