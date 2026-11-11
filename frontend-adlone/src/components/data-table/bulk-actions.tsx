import { useEffect, useRef, useState } from 'react';
import { type Table } from '@tanstack/react-table';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props<TData> {
    table: Table<TData>;
    /** Nombre en singular y plural de lo seleccionado: «usuario» / «usuarios». */
    entidad: { singular: string; plural: string };
    /** Botones de acción (van a la derecha del contador). */
    children: React.ReactNode;
}

/**
 * Barra flotante que aparece abajo al centro cuando hay filas marcadas: botón redondo para limpiar la
 * selección, contador y las acciones. Se maneja con teclado (flechas, Inicio/Fin) y Esc limpia la selección.
 * Anuncia los cambios de selección a los lectores de pantalla.
 */
export function DataTableBulkActions<TData>({ table, entidad, children }: Props<TData>) {
    const cantidad = table.getFilteredSelectedRowModel().rows.length;
    const barra = useRef<HTMLDivElement>(null);
    const [anuncio, setAnuncio] = useState('');
    const nombre = cantidad === 1 ? entidad.singular : entidad.plural;

    useEffect(() => {
        if (cantidad === 0) return;
        queueMicrotask(() => setAnuncio(`${cantidad} ${nombre} seleccionados. La barra de acciones está disponible.`));
        const t = setTimeout(() => setAnuncio(''), 3000);
        return () => clearTimeout(t);
    }, [cantidad, nombre]);

    const limpiar = () => table.resetRowSelection();

    const onKeyDown = (e: React.KeyboardEvent) => {
        const botones = Array.from(barra.current?.querySelectorAll('button') ?? []);
        if (!botones.length) return;
        const i = botones.findIndex((b) => b === document.activeElement);
        if (e.key === 'ArrowRight') { e.preventDefault(); botones[(i + 1) % botones.length]?.focus(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); botones[i <= 0 ? botones.length - 1 : i - 1]?.focus(); }
        else if (e.key === 'Home') { e.preventDefault(); botones[0]?.focus(); }
        else if (e.key === 'End') { e.preventDefault(); botones[botones.length - 1]?.focus(); }
        else if (e.key === 'Escape') {
            // Si el Escape era de un menú desplegable, no se limpia la selección.
            const el = (e.target as HTMLElement) ?? null;
            if (el?.closest('[role="menu"]') || el?.closest('[aria-haspopup="menu"]')) return;
            e.preventDefault();
            limpiar();
        }
    };

    if (cantidad === 0) return null;

    return (
        <TooltipProvider delayDuration={200}>
            <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">{anuncio}</div>
            <div
                ref={barra}
                role="toolbar"
                aria-label={`Acciones para ${cantidad} ${nombre} seleccionados`}
                tabIndex={-1}
                onKeyDown={onKeyDown}
                className={cn(
                    'fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl',
                    'animate-in fade-in-0 slide-in-from-bottom-4 duration-300',
                    'transition-all ease-out hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
                )}
            >
                <div className="shadcn-scope flex items-center gap-x-2 rounded-xl border bg-background/95 p-2 shadow-xl backdrop-blur-lg supports-[backdrop-filter]:bg-background/60">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={limpiar} className="size-6 rounded-full" aria-label="Quitar selección">
                                <X className="size-3.5" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Quitar selección (Esc)</TooltipContent>
                    </Tooltip>

                    <span className="h-5 w-px bg-border" aria-hidden="true" />

                    <div className="flex items-center gap-x-1 text-sm">
                        <Badge className="min-w-8 justify-center rounded-lg" aria-label={`${cantidad} seleccionados`}>{cantidad}</Badge>
                        <span className="hidden sm:inline">{nombre}</span> seleccionados
                    </div>

                    <span className="h-5 w-px bg-border" aria-hidden="true" />

                    {children}
                </div>
            </div>
        </TooltipProvider>
    );
}
