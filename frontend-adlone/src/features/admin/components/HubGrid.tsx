import React from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface HubOption {
    id: string;
    label: string;
    icon: React.ReactNode;
    /** @deprecated no longer rendered — every row uses the same neutral icon swatch, per the "minimize color usage" convention. Kept optional so existing call sites don't need to change their data. */
    color?: string;
    /** @deprecated see `color` */
    bg?: string;
    description: string;
    badge?: React.ReactNode;
    /** Agrupa visualmente las opciones bajo un subtítulo (ej. "Verificaciones"). Sin ella, lista plana de siempre. */
    grupo?: string;
}

interface HubGridProps {
    options: HubOption[];
    onNavigate: (id: string) => void;
    emptyText?: string;
}

const Fila: React.FC<{ opt: HubOption; onNavigate: (id: string) => void }> = ({ opt, onNavigate }) => (
    <button
        type="button"
        onClick={() => onNavigate(opt.id)}
        className="group flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/60"
    >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-150 group-hover:scale-105 mt-0.5">
            {opt.icon}
        </div>
        <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground leading-tight">
                {opt.label}
                {opt.badge}
            </p>
            <p className="truncate text-xs text-muted-foreground leading-snug">{opt.description}</p>
        </div>
        <IconChevronRight size={16} className="shrink-0 text-muted-foreground/60 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground mt-0.5" />
    </button>
);

// Fila de lista en vez de grid de tarjetas — funciona igual de bien con 1
// opción (varios hubs del admin solo tienen una) que con una decena, sin el
// efecto "tarjeta gigante flotando sola" que dejaba el grid con pocos ítems.
export function HubGrid({ options, onNavigate, emptyText = 'No tiene permisos para acceder a las funcionalidades de este módulo.' }: HubGridProps) {
    if (options.length === 0) {
        return (
            <Card className="mt-6 bg-muted/40 p-5">
                <p className="text-center text-sm text-muted-foreground">{emptyText}</p>
            </Card>
        );
    }

    // Con `grupo` en al menos una opción, se separan en secciones con subtítulo; sin él, lista plana (como siempre).
    const agrupar = options.some((o) => o.grupo);
    if (!agrupar) {
        return (
            <Card className="mt-6 divide-y divide-border overflow-hidden p-0">
                {options.map((opt) => <Fila key={opt.id} opt={opt} onNavigate={onNavigate} />)}
            </Card>
        );
    }

    const grupos: { nombre: string; items: HubOption[] }[] = [];
    for (const opt of options) {
        const nombre = opt.grupo || '';
        const existente = grupos.find((g) => g.nombre === nombre);
        if (existente) existente.items.push(opt);
        else grupos.push({ nombre, items: [opt] });
    }

    // Desde pantallas anchas los grupos van en tres columnas para distribución equilibrada.
    return (
        <div className="mt-4 grid items-start gap-x-6 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
            {grupos.map((g, i) => (
                <div key={g.nombre || i}>
                    {g.nombre && <h3 className="mb-2 px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.nombre}</h3>}
                    <Card className={cn('divide-y divide-border overflow-hidden p-0')}>
                        {g.items.map((opt) => <Fila key={opt.id} opt={opt} onNavigate={onNavigate} />)}
                    </Card>
                </div>
            ))}
        </div>
    );
}
