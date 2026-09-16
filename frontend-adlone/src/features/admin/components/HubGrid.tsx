import React from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { Card } from '@/components/ui/card';

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
}

interface HubGridProps {
    options: HubOption[];
    onNavigate: (id: string) => void;
    emptyText?: string;
}

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

    return (
        <Card className="mt-6 divide-y divide-border overflow-hidden p-0">
            {options.map((opt) => (
                <button
                    key={opt.id}
                    type="button"
                    onClick={() => onNavigate(opt.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
                >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        {opt.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                            {opt.label}
                            {opt.badge}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                    <IconChevronRight size={16} className="shrink-0 text-muted-foreground" />
                </button>
            ))}
        </Card>
    );
}
