import React from 'react';
import { IconArrowRight, IconCheck, IconChevronLeft } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type EstadoPaso = 'actual' | 'completo' | 'error' | 'pendiente';

export interface PasoInfo {
    id: string;
    titulo: string;
    descripcion: string;
    estado: EstadoPaso;
    /** Si el paso tiene un problema, este texto reemplaza a la descripción (por ejemplo «Faltan 3 campos»). */
    aviso?: string;
    /** Los pasos que todavía no se visitaron no se pueden abrir desde la lista. */
    bloqueado?: boolean;
}

interface Props {
    /** Nombre de la pestaña a la que pertenecen los pasos. */
    titulo: string;
    pasos: PasoInfo[];
    actual: number;
    /** Frase corta de ayuda para el paso actual. */
    ayuda: string;
    encabezado: { titulo: string; subtitulo: string };
    onElegirPaso: (indice: number) => void;
    onAtras?: () => void;
    /** Si no se pasa, no se muestra «Guardar borrador». */
    onBorrador?: () => void;
    textoSiguiente: string;
    onSiguiente: () => void;
    siguienteDeshabilitado?: boolean;
    guardando?: boolean;
    /** Total de la visita ya formateado («15,00 UF»); se muestra en el pie desde el paso en que corresponde. */
    totalVisita?: string;
    /** Botones propios del pie (por ejemplo «Cancelar»), antes del botón principal. */
    pieExtra?: React.ReactNode;
    /** Navegación libre (edición): sin barra de avance, todas las secciones se pueden abrir. */
    libre?: boolean;
    /** Clases extra para la grilla raíz (por ejemplo «p-0» cuando va dentro de otra tarjeta). */
    className?: string;
    children: React.ReactNode;
}

const claseNumero: Record<EstadoPaso, string> = {
    actual: 'bg-primary text-primary-foreground',
    completo: 'bg-success/15 text-success',
    error: 'bg-destructive/10 text-destructive',
    pendiente: 'bg-muted text-muted-foreground',
};

/**
 * Disposición «por pasos»: lista de pasos a la izquierda (con el avance y una ayuda corta), un solo trabajo por pantalla
 * a la derecha y un pie fijo con Atrás / Guardar borrador / Siguiente. El contenido de cada paso lo pone quien la usa.
 */
export const PasosLayout: React.FC<Props> = ({
    titulo, pasos, actual, ayuda, encabezado, onElegirPaso, onAtras, onBorrador,
    textoSiguiente, onSiguiente, siguienteDeshabilitado, guardando, totalVisita, pieExtra, libre, className, children,
}) => (
    <div className={cn('grid items-start gap-4 p-4 md:grid-cols-[250px_minmax(0,1fr)] md:p-6', className)}>
        <aside className="rounded-xl border border-border bg-card p-4 md:sticky md:top-4" aria-label={`Pasos de ${titulo}`}>
            <h2 className="m-0 text-[15px] font-semibold">{titulo}</h2>
            <div className="mb-2 mt-0.5 text-xs text-muted-foreground">{libre ? `${pasos.length} secciones` : `Paso ${actual + 1} de ${pasos.length}`}</div>
            {!libre && (
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((actual + 1) / pasos.length) * 100}%` }} />
                </div>
            )}
            <div className="flex flex-col gap-0.5">
                {pasos.map((p, i) => (
                    <button
                        key={p.id}
                        type="button"
                        disabled={p.bloqueado}
                        aria-current={p.estado === 'actual' ? 'step' : undefined}
                        onClick={() => onElegirPaso(i)}
                        className={cn(
                            'flex w-full items-start gap-2.5 rounded-lg border border-transparent p-2 text-left transition-colors',
                            p.estado === 'actual' ? 'border-primary bg-primary/10' : 'hover:bg-muted/60',
                            p.bloqueado && 'cursor-default opacity-55 hover:bg-transparent',
                        )}
                    >
                        <span className={cn('flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md text-[13px] font-bold', claseNumero[p.estado])}>
                            {p.estado === 'completo' ? <IconCheck size={15} /> : p.estado === 'error' ? '!' : i + 1}
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold leading-tight">{p.titulo}</span>
                            <span className={cn('block text-xs', p.estado === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
                                {p.estado === 'error' && p.aviso ? p.aviso : p.descripcion}
                            </span>
                        </span>
                    </button>
                ))}
            </div>
            <div className="mt-3 rounded-lg bg-primary/10 p-3 text-[13px]">
                <b className="mb-0.5 block text-xs text-primary">En este paso</b>
                {ayuda}
            </div>
        </aside>

        <section className="flex min-w-0 flex-col rounded-xl border border-border bg-card">
            <header className="border-b border-border px-5 pb-3 pt-4">
                <h2 className="m-0 text-lg font-semibold">{encabezado.titulo}</h2>
                <p className="m-0 mt-0.5 text-[13px] text-muted-foreground">{encabezado.subtitulo}</p>
            </header>
            <div className="min-h-[340px] px-5 py-4">{children}</div>
            <footer className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2.5 rounded-b-xl border-t border-border bg-muted px-5 py-3">
                {onAtras && (
                    <Button type="button" variant="outline" className="rounded-full" onClick={onAtras}>
                        <IconChevronLeft size={16} /> Atrás
                    </Button>
                )}
                {pieExtra}
                {onBorrador && <Button type="button" variant="outline" className="rounded-full" onClick={onBorrador}>Guardar borrador</Button>}
                {totalVisita && (
                    <div className="ml-auto text-right leading-tight">
                        <small className="block text-[11.5px] text-muted-foreground">Total de la visita</small>
                        <b className="text-xl tabular-nums text-primary">{totalVisita}</b>
                    </div>
                )}
                <Button type="button" className={cn('rounded-full', !totalVisita && 'ml-auto')} onClick={onSiguiente} disabled={siguienteDeshabilitado || guardando}>
                    {guardando && <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />}
                    {textoSiguiente}
                    {!guardando && /Siguiente|Continuar/.test(textoSiguiente) && <IconArrowRight size={16} />}
                </Button>
            </footer>
        </section>
    </div>
);
