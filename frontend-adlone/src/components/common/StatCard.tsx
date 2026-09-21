import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
    icon: ReactNode;
    label: string;
    value: number | string;
    tone?: 'primary' | 'warning' | 'destructive' | 'success' | 'muted';
}

// Fila de KPIs rápidos arriba de una lista (rutas guardadas, jornadas de
// hoy, etc.) — un vistazo al estado general antes de bajar al detalle fila
// por fila, en vez de que el único resumen sea un badge suelto en el header.
export function StatCard({ icon, label, value, tone = 'muted' }: StatCardProps) {
    return (
        <div className="flex min-w-[140px] flex-1 items-center gap-3 rounded-xl border border-border bg-card p-3">
            <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                tone === 'primary' && 'bg-primary/10 text-primary',
                tone === 'warning' && 'bg-warning/10 text-warning',
                tone === 'destructive' && 'bg-destructive/10 text-destructive',
                tone === 'success' && 'bg-success/10 text-success',
                tone === 'muted' && 'bg-muted text-muted-foreground'
            )}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="m-0 text-lg font-bold leading-tight text-foreground">{value}</p>
                <p className="m-0 truncate text-xs text-muted-foreground">{label}</p>
            </div>
        </div>
    );
}
