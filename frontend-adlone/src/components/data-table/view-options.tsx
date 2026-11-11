import { type Table } from '@tanstack/react-table';
import { SlidersHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/** Botón «Vista» para elegir qué columnas se muestran. El nombre sale de `meta.titulo` o, si no, del id. */
export function DataTableViewOptions<TData>({ table }: { table: Table<TData> }) {
    const columnas = table.getAllColumns().filter((c) => typeof c.accessorFn !== 'undefined' && c.getCanHide());
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="ms-auto hidden h-8 text-sm lg:flex">
                    <SlidersHorizontal className="size-4" /> Vista
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[170px]">
                <DropdownMenuLabel>Columnas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columnas.map((c) => (
                    <DropdownMenuCheckboxItem key={c.id} className="capitalize" checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)}>
                        {(c.columnDef.meta as { titulo?: string } | undefined)?.titulo ?? c.id.replace(/_/g, ' ')}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
