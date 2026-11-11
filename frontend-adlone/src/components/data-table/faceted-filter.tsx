import * as React from 'react';
import { type Column } from '@tanstack/react-table';
import { Check, CirclePlus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface OpcionFiltro {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
}

interface Props<TData, TValue> {
    column?: Column<TData, TValue>;
    title: string;
    options: OpcionFiltro[];
}

/** Filtro por faceta: botón con «+», lista con casillas, contador por opción y las elegidas resumidas en el botón. */
export function DataTableFacetedFilter<TData, TValue>({ column, title, options }: Props<TData, TValue>) {
    const facets = column?.getFacetedUniqueValues();
    const seleccion = new Set((column?.getFilterValue() as string[] | undefined) ?? []);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 border-dashed text-sm">
                    <CirclePlus className="size-4" />
                    {title}
                    {seleccion.size > 0 && (
                        <>
                            <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
                            <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">{seleccion.size}</Badge>
                            <div className="hidden gap-1 lg:flex">
                                {seleccion.size > 2 ? (
                                    <Badge variant="secondary" className="rounded-sm px-1 font-normal">{seleccion.size} elegidos</Badge>
                                ) : (
                                    options.filter((o) => seleccion.has(o.value)).map((o) => (
                                        <Badge key={o.value} variant="secondary" className="rounded-sm px-1 font-normal">{o.label}</Badge>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-0" align="start">
                <Command>
                    <CommandInput placeholder={title} />
                    <CommandList>
                        <CommandEmpty>Sin resultados.</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => {
                                const elegido = seleccion.has(option.value);
                                return (
                                    <CommandItem
                                        key={option.value}
                                        value={option.label}
                                        onSelect={() => {
                                            const nuevo = new Set(seleccion);
                                            if (elegido) nuevo.delete(option.value); else nuevo.add(option.value);
                                            column?.setFilterValue(nuevo.size ? Array.from(nuevo) : undefined);
                                        }}
                                    >
                                        <div className={cn('flex size-4 items-center justify-center rounded-sm border border-primary', elegido ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible')}>
                                            <Check className="size-3.5 text-primary-foreground" />
                                        </div>
                                        {option.icon && <option.icon className="size-4 text-muted-foreground" />}
                                        <span>{option.label}</span>
                                        {facets?.get(option.value) !== undefined && (
                                            <span className="ms-auto flex size-4 items-center justify-center font-mono text-xs text-muted-foreground">{facets.get(option.value)}</span>
                                        )}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                        {seleccion.size > 0 && (
                            <>
                                <CommandSeparator />
                                <CommandGroup>
                                    <CommandItem onSelect={() => column?.setFilterValue(undefined)} className="justify-center text-center">
                                        Quitar filtro
                                    </CommandItem>
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
