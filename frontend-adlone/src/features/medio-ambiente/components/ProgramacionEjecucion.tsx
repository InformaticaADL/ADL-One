import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { IconExternalLink } from '@tabler/icons-react';
import { type AvanceFicha, estaCompletada, proximoAtrasado, hoyISO, fechaLarga, mesAnio } from '../utils/avanceFicha';

export interface ServicioProgramado {
    id_agendamam: number;
    numero: number | null;
    correlativo: string;
    id_estado: number;
    estado: string;
    fecha_programada: string | null;
    fecha_ejecucion: string | null;
    muestreador: string | null;
    caso_adlab: string | null;
    realizado_por_gem: boolean;
}

export interface ProgramacionFicha {
    servicios: ServicioProgramado[];
    resumen: AvanceFicha;
}

type Variante = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'info' | 'destructive';

// Estados de la agenda: 0 Por asignar · 1 Pendiente · 3 Ejecutado · 4/5 Suspendido · 6/7 Cancelado.
const varianteDe = (s: ServicioProgramado): Variante => {
    if (s.id_estado === 3) return 'success';
    if (s.id_estado === 4 || s.id_estado === 5) return 'warning';
    if (s.id_estado === 6 || s.id_estado === 7) return 'destructive';
    if (s.id_estado === 1) return 'info';
    return 'secondary';
};

interface Props {
    programacion: ProgramacionFicha | null;
    cargando: boolean;
    error: boolean;
    /** Punto consultado cuando la ficha es parte de una visita con varios puntos. */
    visita?: { punto: string; puntos: number } | null;
    /** Si puede abrir el detalle del muestreo ejecutado (acceso a Muestreos Completados). */
    puedeAbrir: boolean;
    onAbrir: (servicio: ServicioProgramado) => void;
    onReintentar: () => void;
}

export const ProgramacionEjecucion: React.FC<Props> = ({ programacion, cargando, error, visita, puedeAbrir, onAbrir, onReintentar }) => {
    if (cargando && !programacion) {
        return <p className="py-8 text-center text-sm text-muted-foreground">Cargando la programación…</p>;
    }
    if (error || !programacion) {
        return (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="text-sm text-muted-foreground">No se pudo cargar la programación de esta ficha.</p>
                <Button variant="outline" size="sm" onClick={onReintentar}>Reintentar</Button>
            </div>
        );
    }

    const { servicios, resumen } = programacion;
    if (servicios.length === 0) {
        return <p className="py-8 text-center text-sm text-muted-foreground">Esta ficha aún no tiene servicios en la agenda.</p>;
    }

    const pct = resumen.total > 0 ? Math.round((100 * resumen.ejecutados) / resumen.total) : 0;
    const completa = estaCompletada(resumen);
    const atrasado = proximoAtrasado(resumen);
    const hoy = hoyISO();

    return (
        <div className="flex flex-col gap-4">
            <section className="rounded-xl border border-border bg-card p-4 md:p-5">
                <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
                    <div className="min-w-[200px] flex-1">
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-semibold tabular-nums text-foreground">{resumen.ejecutados}</span>
                            <span className="text-sm text-muted-foreground">de {resumen.total} servicios ejecutados</span>
                            {completa && <Badge variant="success">Completada</Badge>}
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={resumen.total} aria-valuenow={resumen.ejecutados} aria-label="Servicios ejecutados">
                            <div className={cn('h-full rounded-full', completa ? 'bg-success' : 'bg-primary')} style={{ width: `${pct}%` }} />
                        </div>
                    </div>
                    <dl className="flex flex-wrap gap-x-8 gap-y-2">
                        <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Último ejecutado</dt>
                            <dd className="mt-0.5 text-sm font-medium">{resumen.ultimo ? fechaLarga(resumen.ultimo) : 'Ninguno aún'}</dd>
                        </div>
                        <div>
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Próximo agendado</dt>
                            <dd className={cn('mt-0.5 text-sm font-medium', atrasado && 'text-destructive')}>
                                {resumen.proximo ? `${fechaLarga(resumen.proximo)}${atrasado ? ' · atrasado' : ''}` : completa ? '—' : 'Sin agendar'}
                            </dd>
                        </div>
                        {resumen.suspendidos > 0 && (
                            <div>
                                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Suspendidos</dt>
                                <dd className="mt-0.5 text-sm font-medium text-warning">{resumen.suspendidos}</dd>
                            </div>
                        )}
                        {resumen.cancelados > 0 && (
                            <div>
                                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cancelados</dt>
                                <dd className="mt-0.5 text-sm font-medium text-destructive">{resumen.cancelados}</dd>
                            </div>
                        )}
                    </dl>
                </div>
                {visita && visita.puntos > 1 && (
                    <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                        Esta ficha es el punto «{visita.punto || 'sin nombre'}» de una visita de {visita.puntos} puntos. Los puntos se ejecutan juntos, así que cada servicio avanza para todos a la vez.
                    </p>
                )}
            </section>

            <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-16">Servicio</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Programado</TableHead>
                            <TableHead>Ejecutado</TableHead>
                            <TableHead>Muestreador</TableHead>
                            <TableHead>Caso</TableHead>
                            <TableHead className="w-28 text-right"><span className="sr-only">Acciones</span></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {servicios.map((s) => {
                            const vencido = (s.id_estado === 0 || s.id_estado === 1) && !!s.fecha_programada && s.fecha_programada < hoy;
                            return (
                                <TableRow key={s.id_agendamam} className={cn(s.id_estado === 6 || s.id_estado === 7 ? 'opacity-60' : undefined)}>
                                    <TableCell className="font-semibold tabular-nums">{s.numero ?? '—'}<span className="font-normal text-muted-foreground"> / {resumen.total + resumen.cancelados}</span></TableCell>
                                    <TableCell><Badge variant={varianteDe(s)}>{s.estado}</Badge></TableCell>
                                    <TableCell className={cn(vencido && 'font-medium text-destructive')}>
                                        {s.fecha_programada ? (
                                            <>
                                                {fechaLarga(s.fecha_programada)}
                                                {vencido && <span className="block text-[11px]">vencido</span>}
                                            </>
                                        ) : <span className="text-muted-foreground">Sin programar</span>}
                                    </TableCell>
                                    <TableCell>
                                        {s.fecha_ejecucion ? (
                                            <>
                                                {fechaLarga(s.fecha_ejecucion)}
                                                <span className="block text-[11px] capitalize text-muted-foreground">{mesAnio(s.fecha_ejecucion)}</span>
                                            </>
                                        ) : <span className="text-muted-foreground">—</span>}
                                    </TableCell>
                                    <TableCell>{s.muestreador || <span className="text-muted-foreground">—</span>}{s.realizado_por_gem && <span className="block text-[11px] text-muted-foreground">Hecho por GEM</span>}</TableCell>
                                    <TableCell>{s.caso_adlab || <span className="text-muted-foreground">—</span>}</TableCell>
                                    <TableCell className="text-right">
                                        {s.id_estado === 3 && puedeAbrir && (
                                            <Button variant="outline" size="sm" onClick={() => onAbrir(s)} title="Abrir el detalle del muestreo ejecutado">
                                                <IconExternalLink size={14} /> Ver muestreo
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};
