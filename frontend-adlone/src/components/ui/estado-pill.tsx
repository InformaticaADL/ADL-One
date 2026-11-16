import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Tonos de estado, siempre los mismos en todo el sistema:
 *  ok    → verde  (activo, vigente, ejecutada, aprobada)
 *  warn  → ámbar  (pendiente, por vencer, con aviso)
 *  bad   → rojo   (vencido, cancelada, rechazada)
 *  info  → azul   (agendada, en proceso, en calibración)
 *  off   → gris   (inactivo, deshabilitado, dado de baja)
 */
export type TonoEstado = 'ok' | 'warn' | 'bad' | 'info' | 'off';

const VARIANTE = { ok: 'success', warn: 'warning', bad: 'destructive', info: 'info', off: 'secondary' } as const;

interface Props {
  tono: TonoEstado;
  children: React.ReactNode;
  className?: string;
}

/** Píldora de estado con tinte suave. Úsala en tablas y cabeceras en lugar de texto suelto o puntos de color. */
export function EstadoPill({ tono, children, className }: Props) {
  return (
    <Badge variant={VARIANTE[tono]} className={cn('whitespace-nowrap rounded-full px-2.5 font-medium', tono === 'off' && 'text-muted-foreground', className)}>
      {children}
    </Badge>
  );
}
