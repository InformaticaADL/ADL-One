import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    type AvanceFicha, estaCompletada, proximoAtrasado, faltaProgramar, fechaCorta,
} from '../utils/avanceFicha';

// Barra de avance chica: «3 / 12», una barra y debajo lo más útil (último ejecutado y próximo agendado).
export const AvanceFichaCelda: React.FC<{ avance: AvanceFicha }> = ({ avance }) => {
    const pct = avance.total > 0 ? Math.round((100 * avance.ejecutados) / avance.total) : 0;
    const completada = estaCompletada(avance);
    const atrasado = proximoAtrasado(avance);
    const sinProgramar = faltaProgramar(avance);
    return (
        <div className="min-w-[110px]">
            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums text-foreground">{avance.ejecutados} / {avance.total}</span>
                {completada && <Badge variant="success" className="px-1.5 py-0 text-[10px]">Completa</Badge>}
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={avance.total} aria-valuenow={avance.ejecutados} aria-label="Servicios ejecutados">
                <div className={cn('h-full rounded-full', completada ? 'bg-success' : 'bg-primary')} style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-1 space-y-0.5 text-[11px] leading-tight text-muted-foreground">
                {avance.ultimo && <div>Último: {fechaCorta(avance.ultimo)}</div>}
                {avance.proximo && (
                    <div className={cn(atrasado && 'font-medium text-destructive')}>
                        Próximo: {fechaCorta(avance.proximo)}{atrasado ? ' · atrasado' : ''}
                    </div>
                )}
                {!avance.proximo && sinProgramar && <div>Sin servicios agendados</div>}
                {avance.suspendidos > 0 && <div className="text-warning">{avance.suspendidos} suspendido{avance.suspendidos > 1 ? 's' : ''}</div>}
            </div>
        </div>
    );
};
