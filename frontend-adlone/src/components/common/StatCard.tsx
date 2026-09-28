import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
    icon: ReactNode;
    label: string;
    value: number | string;
    tone?: 'primary' | 'warning' | 'destructive' | 'success' | 'muted';
    /** Variante apilada (ícono arriba, valor y label abajo) para filas de 4
        KPIs en pantallas de celular, donde la variante horizontal no cabe. */
    compact?: boolean;
}

// Fila de KPIs rápidos arriba de una lista (rutas guardadas, jornadas de
// hoy, etc.) — un vistazo al estado general antes de bajar al detalle fila
// por fila, en vez de que el único resumen sea un badge suelto en el header.
export function StatCard({ icon, label, value, tone = 'muted', compact = false }: StatCardProps) {
    return (
        <div className={cn(
            'flex rounded-xl border border-border bg-card',
            // basis-0 + flex-1: en la fila de 4 de celular todas las tarjetas
            // miden lo mismo sin importar el largo del label ("Finalizados" vs
            // "En pausa"), y min-w-0 deja que se encojan bajo su contenido en
            // vez de desbordar o empujarse a otra línea.
            compact ? 'min-w-0 flex-1 basis-0 flex-col items-center gap-1 p-2 text-center' : 'min-w-[140px] flex-1 items-center gap-3 p-3'
        )}>
            <div className={cn(
                'flex shrink-0 items-center justify-center rounded-lg',
                compact ? 'h-7 w-7' : 'h-9 w-9',
                tone === 'primary' && 'bg-primary/10 text-primary',
                tone === 'warning' && 'bg-warning/10 text-warning',
                tone === 'destructive' && 'bg-destructive/10 text-destructive',
                tone === 'success' && 'bg-success/10 text-success',
                tone === 'muted' && 'bg-muted text-muted-foreground'
            )}>
                {icon}
            </div>
            <div className="w-full min-w-0">
                <p className={cn('m-0 font-bold leading-tight tabular-nums text-foreground', compact ? 'text-base' : 'text-lg')}>{value}</p>
                <p className={cn('m-0 truncate text-muted-foreground', compact ? 'text-[11px] leading-tight' : 'text-xs')}>{label}</p>
            </div>
        </div>
    );
}
