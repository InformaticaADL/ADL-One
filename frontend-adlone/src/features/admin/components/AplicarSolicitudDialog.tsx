import React, { useEffect, useState } from 'react';
import { IconAlertTriangle, IconArrowRight, IconCircleCheck, IconInfoCircle, IconMessage } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '../../../contexts/ToastContext';
import { equipoService, type PlanSolicitudEquipo, type EquipoDelPlan, type ResultadoAplicar } from '../services/equipo.service';

// Pantalla que se abre sola cuando Gestión de Calidad acepta una solicitud que cambia un equipo. A la
// izquierda, qué hay que cambiar (los datos de la solicitud y la observación que se escribió al aceptar); a la
// derecha, el equipo con lo que cambia marcado en verde. Al presionar "Actualizar" se hacen los cambios con esos
// datos (también en los equipos asociados cuando es un traspaso) y se deja la observación de la aceptación, por
// eso no se pide otra. La solicitud queda como realizada.

const fechaDMY = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('-') : '—');
const mensajeError = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

// Campos que se muestran en la ficha de la derecha y a qué cambio de la solicitud corresponden.
const CAMPOS: { campo: string; etiqueta: string; valor: (e: EquipoDelPlan) => string }[] = [
    { campo: 'codigo', etiqueta: 'Código', valor: (e) => e.codigo },
    { campo: 'nombre', etiqueta: 'Nombre', valor: (e) => e.nombre },
    { campo: 'tipo', etiqueta: 'Tipo', valor: (e) => e.tipo || '—' },
    { campo: 'ubicacion', etiqueta: 'Sede', valor: (e) => e.sede || '—' },
    { campo: 'id_muestreador', etiqueta: 'Responsable', valor: (e) => e.responsable || '—' },
    { campo: 'estado_equipo', etiqueta: 'Estado', valor: (e) => e.estado_equipo || '—' },
    { campo: 'ultima_verificacion', etiqueta: 'Última revisión', valor: (e) => fechaDMY(e.ultima_verificacion) },
    { campo: 'siguiente_verificacion', etiqueta: 'Siguiente revisión', valor: (e) => fechaDMY(e.siguiente_verificacion) },
    { campo: 'fecha_baja', etiqueta: 'Fecha de baja', valor: (e) => fechaDMY(e.fecha_baja) },
];

interface Props {
    idSolicitud: number | null;
    onClose: () => void;
    /** Los equipos quedaron actualizados y la solicitud realizada. */
    onAplicada: (plan: PlanSolicitudEquipo, resultado: ResultadoAplicar) => void;
}

export const AplicarSolicitudDialog: React.FC<Props> = ({ idSolicitud, onClose, onAplicada }) => {
    const { showToast } = useToast();
    const [plan, setPlan] = useState<PlanSolicitudEquipo | null>(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [verId, setVerId] = useState<number | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [fallos, setFallos] = useState<string[]>([]);

    useEffect(() => {
        if (!idSolicitud) return;
        let vigente = true;
        // Cada vez que se abre una solicitud se parte de cero.
        Promise.resolve().then(() => { if (vigente) { setPlan(null); setError(null); setFallos([]); setCargando(true); } });
        equipoService.planSolicitud(idSolicitud)
            .then((p) => { if (vigente) { setPlan(p); setVerId(p.equipos[0]?.id_equipo ?? null); } })
            .catch((e) => { if (vigente) setError(mensajeError(e) || 'No se pudieron preparar los cambios de esta solicitud.'); })
            .finally(() => { if (vigente) setCargando(false); });
        return () => { vigente = false; };
    }, [idSolicitud]);

    const equipoVisto = plan?.equipos.find((e) => e.id_equipo === verId) ?? plan?.equipos[0] ?? null;
    const aceptada = plan?.estado === 'ACEPTADA';
    const huboCambios = !!plan?.equipos.some((e) => e.cambios.length > 0);

    const actualizar = async () => {
        if (!plan || !idSolicitud) return;
        setGuardando(true);
        setFallos([]);
        try {
            const r = await equipoService.aplicarSolicitud(idSolicitud);
            if (r.resultados.every((x) => x.ok)) {
                showToast({ type: 'success', message: r.resultados.length > 1 ? `${r.resultados.length} equipos actualizados` : 'Equipo actualizado' });
                onAplicada(plan, r);
            } else {
                setFallos(r.resultados.filter((x) => !x.ok).map((x) => `${x.codigo}: ${x.error || 'no se pudo actualizar'}`));
            }
        } catch (e) {
            setFallos([mensajeError(e) || 'No se pudo actualizar el equipo.']);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Dialog open={!!idSolicitud} onOpenChange={(v) => { if (!v && !guardando) onClose(); }}>
            <DialogContent className="max-h-[94vh] max-w-6xl grid-cols-[minmax(0,1fr)] gap-4 overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>{plan ? `Solicitud #${plan.id_solicitud} · ${plan.nombre_tipo}` : 'Aplicar solicitud'}</DialogTitle>
                    <DialogDescription>Revise lo que cambia y presione Actualizar: se aplica con los datos de la solicitud.</DialogDescription>
                </DialogHeader>

                {cargando && <p className="py-10 text-center text-sm text-muted-foreground">Preparando los cambios…</p>}
                {error && <p className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm text-destructive"><IconAlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}</p>}

                {plan && equipoVisto && (
                    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                        {/* ── Izquierda: qué hay que cambiar ── */}
                        <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
                            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Qué hay que cambiar</span>

                            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div><dt className="text-[11px] text-muted-foreground">Solicitante</dt><dd className="truncate font-medium">{plan.solicitante || '—'}</dd></div>
                                <div><dt className="text-[11px] text-muted-foreground">Fecha de la solicitud</dt><dd className="font-medium">{fechaDMY(plan.fecha_creacion)}</dd></div>
                                {plan.motivo && <div className="col-span-2"><dt className="text-[11px] text-muted-foreground">Motivo</dt><dd>{plan.motivo}</dd></div>}
                            </dl>

                            {/* La observación escrita al aceptar: es la que queda en el equipo */}
                            <div className="rounded-lg border border-success/40 bg-success/5 p-3">
                                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-success"><IconMessage size={14} /> Observación de Gestión de Calidad al aceptar</p>
                                <p className="whitespace-pre-wrap break-words text-sm">{plan.observacion_aceptacion || 'No se escribió una observación al aceptar.'}</p>
                                <p className="mt-1.5 text-[11px] text-muted-foreground">Queda en la observación del equipo con la fecha de hoy, debajo de las anteriores. No se pide otra.</p>
                            </div>

                            <div className="flex flex-col gap-2">
                                {plan.equipos.map((e) => (
                                    <button
                                        key={e.id_equipo}
                                        type="button"
                                        onClick={() => setVerId(e.id_equipo)}
                                        className={cn('rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/50', equipoVisto.id_equipo === e.id_equipo ? 'border-primary ring-1 ring-primary/40' : 'border-border')}
                                    >
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-semibold">{e.codigo} <span className="font-normal text-muted-foreground">· {e.nombre}</span></span>
                                            <Badge variant={e.rol === 'PRINCIPAL' ? 'default' : 'outline'}>{e.rol === 'PRINCIPAL' ? 'Equipo de la solicitud' : 'Equipo asociado'}</Badge>
                                        </span>
                                        {e.cambios.length > 0 ? (
                                            <ul className="mt-2 flex flex-col gap-1">
                                                {e.cambios.map((c) => (
                                                    <li key={c.campo} className="flex flex-wrap items-center gap-1.5 text-sm">
                                                        <span className="text-xs text-muted-foreground">{c.etiqueta}:</span>
                                                        <span className="text-muted-foreground line-through">{c.actual}</span>
                                                        <IconArrowRight size={13} className="text-muted-foreground" />
                                                        <span className="rounded bg-success/15 px-1.5 py-0.5 font-medium text-success">{c.nuevo}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="mt-1.5 text-xs text-muted-foreground">Sin cambios de datos: solo queda la observación.</p>
                                        )}
                                    </button>
                                ))}
                            </div>
                            {plan.equipos.length > 1 && (
                                <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><IconInfoCircle size={14} className="mt-px shrink-0" /> En un traspaso también se actualizan los equipos asociados, con el mismo cambio y la misma observación.</p>
                            )}
                        </div>

                        {/* ── Derecha: el equipo, con lo que cambia en verde ── */}
                        <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Equipo</span>
                                <Badge variant="outline">{equipoVisto.rol === 'PRINCIPAL' ? 'Equipo de la solicitud' : 'Equipo asociado'}</Badge>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {CAMPOS.map((f) => {
                                    const c = equipoVisto.cambios.find((x) => x.campo === f.campo);
                                    return (
                                        <div key={f.campo} className={cn('rounded-lg border p-2.5', c ? 'border-success/50 bg-success/10' : 'border-border bg-background')}>
                                            <p className={cn('text-[11px]', c ? 'font-medium text-success' : 'text-muted-foreground')}>{f.etiqueta}{c ? ' · se actualiza' : ''}</p>
                                            {c ? (
                                                <>
                                                    <p className="text-sm font-semibold text-success">{c.nuevo}</p>
                                                    <p className="text-[11px] text-muted-foreground line-through">{c.actual}</p>
                                                </>
                                            ) : (
                                                <p className="truncate text-sm" title={f.valor(equipoVisto)}>{f.valor(equipoVisto)}</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {!huboCambios && (
                                <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">Esta solicitud no cambia datos del equipo: al actualizar solo se deja la observación en su ficha.</p>
                            )}
                        </div>
                    </div>
                )}

                {plan && !aceptada && (
                    <p className="flex items-start gap-1.5 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-sm text-warning"><IconAlertTriangle size={15} className="mt-0.5 shrink-0" /> Esta solicitud está en estado {plan.estado}: solo se puede actualizar el equipo cuando está aceptada.</p>
                )}
                {fallos.length > 0 && (
                    <p className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"><IconAlertTriangle size={14} className="mt-px shrink-0" /> {fallos.join(' · ')}</p>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={guardando}>Ahora no</Button>
                    <Button onClick={actualizar} disabled={guardando || !plan || !aceptada}>
                        <IconCircleCheck size={16} /> {guardando ? 'Actualizando…' : plan && plan.equipos.length > 1 ? `Actualizar ${plan.equipos.length} equipos` : 'Actualizar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AplicarSolicitudDialog;
