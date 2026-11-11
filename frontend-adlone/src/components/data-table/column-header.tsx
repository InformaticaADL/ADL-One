import { type Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface Props<TData, TValue> extends React.HTMLAttributes<HTMLDivElement> {
    column: Column<TData, TValue>;
    title: string;
}

/** Encabezado de columna con menú: ordenar ascendente / descendente y ocultar la columna. */
export function DataTableColumnHeader<TData, TValue>({ column, title, className }: Props<TData, TValue>) {
    if (!column.getCanSort()) return <div className={cn(className)}>{title}</div>;

    const orden = column.getIsSorted();
    return (
        <div className={cn('flex items-center gap-2', className)}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="-ms-3 h-8 text-sm data-[state=open]:bg-muted">
                        <span>{title}</span>
                        {orden === 'desc' ? <ArrowDown className="size-3.5" /> : orden === 'asc' ? <ArrowUp className="size-3.5" /> : <ChevronsUpDown className="size-3.5 text-muted-foreground" />}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => column.toggleSorting(false)}><ArrowUp className="size-3.5 text-muted-foreground" /> Ascendente</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => column.toggleSorting(true)}><ArrowDown className="size-3.5 text-muted-foreground" /> Descendente</DropdownMenuItem>
                    {column.getCanHide() && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => column.toggleVisibility(false)}><EyeOff className="size-3.5 text-muted-foreground" /> Ocultar columna</DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
