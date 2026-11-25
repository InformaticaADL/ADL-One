import { useEffect, useState } from 'react';
import {
    IconInbox, IconFlag, IconMail, IconAlertTriangle, IconArrowBackUp, IconScale, IconListCheck, IconPaperclip, IconFlagCheck, IconHistory,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useToast } from '../../../../contexts/ToastContext';
import { quejasApelacionesService as api, mensajeError, type EntradaAuditoria, type EventoHistorial } from '../../services/quejasApelaciones.service';
import { Seccion } from './comun';

// Ícono y tono de cada tipo de evento. El tono acompaña al ícono y al texto (nunca solo el color).
const ESTILO: Record<EventoHistorial['tipo'], { icono: typeof IconInbox; tono: string }> = {
    recepcion: { icono: IconInbox, tono: 'bg-primary/10 text-primary' },
    notificacion: { icono: IconFlag, tono: 'bg-primary/10 text-primary' },
    correo: { icono: IconMail, tono: 'bg-muted text-muted-foreground' },
    alerta: { icono: IconAlertTriangle, tono: 'bg-warning/15 text-warning' },
    reapertura: { icono: IconArrowBackUp, tono: 'bg-warning/15 text-warning' },
    decision: { icono: IconScale, tono: 'bg-primary/10 text-primary' },
    accion: { icono: IconListCheck, tono: 'bg-muted text-muted-foreground' },
    adjunto: { icono: IconPaperclip, tono: 'bg-muted text-muted-foreground' },
    cierre: { icono: IconFlagCheck, tono: 'bg-success/15 text-success' },
};
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

/** Todo lo ocurrido con el caso, en orden: recepción, notificaciones, correos, decisiones, acciones, adjuntos y cierre. */
export function HistorialTab({ casoId, version }: { casoId: number; version: number }) {
    const { showToast } = useToast();
    const [datos, setDatos] = useState<{ eventos: EventoHistorial[]; auditoria: EntradaAuditoria[] } | null>(null);
    const [verAuditoria, setVerAuditoria] = useState(false);
    useEffect(() => {
        let vigente = true;
        api.historial(casoId)
            .then((d) => { if (vigente) setDatos(d); })
            .catch((e) => showToast({ type: 'error', message: mensajeError(e, 'No se pudo cargar el historial') }));
        return () => { vigente = false; };
    }, [casoId, version, showToast]);

    if (!datos) return <p className="py-8 text-center text-sm text-muted-foreground">Cargando historial…</p>;
    return (
        <div className="flex flex-col gap-4">
            <Seccion titulo="Línea de tiempo" icono={<IconHistory size={16} className="text-primary" />}
                accion={<span className="text-xs text-muted-foreground">{datos.eventos.length} eventos · ADL-One y panel de ADLWeb</span>}>
                {datos.eventos.length ? (
                    <ol className="relative ml-4 border-l border-border">
                        {datos.eventos.map((e, i) => {
                            const { icono: Icono, tono } = ESTILO[e.tipo] || ESTILO.correo;
                            return (
                                <li key={i} className="mb-5 ml-6 last:mb-0">
                                    <span className={cn('absolute -left-4 flex size-8 items-center justify-center rounded-full ring-4 ring-card', tono)}>
                                        <Icono size={15} />
                                    </span>
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                        <p className="text-sm font-semibold text-foreground">{e.titulo}</p>
                                        <time className="text-xs text-muted-foreground" dateTime={e.fecha}>{fecha(e.fecha)} · {hora(e.fecha)}</time>
                                    </div>
                                    {e.detalle && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{e.detalle}</p>}
                                    {e.por && <p className="mt-0.5 text-xs text-muted-foreground">Por {e.por}</p>}
                                </li>
                            );
                        })}
                    </ol>
                ) : <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>}
            </Seccion>
            <Seccion titulo="Registro de auditoría" accion={
                <Button size="sm" variant="ghost" onClick={() => setVerAuditoria((v) => !v)}>{verAuditoria ? 'Ocultar' : `Ver (${datos.auditoria.length})`}</Button>
            }>
                {!verAuditoria ? (
                    <p className="text-sm text-muted-foreground">Cada cambio guardado, con quién y cuándo (incluye lo hecho desde el panel de ADLWeb).</p>
                ) : datos.auditoria.length ? (
                    <div className="overflow-x-auto rounded-md border border-border">
                        <Table className="min-w-[640px]">
                            <TableHeader><TableRow><TableHead className="w-36">Fecha</TableHead><TableHead className="w-40">Acción</TableHead><TableHead>Detalle</TableHead><TableHead className="w-44">Usuario</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {datos.auditoria.map((a, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="text-xs">{fecha(a.fecha)} {hora(a.fecha)}</TableCell>
                                        <TableCell className="text-xs font-medium">{a.operacion}{a.campo ? <span className="block font-normal text-muted-foreground">{a.campo}</span> : null}</TableCell>
                                        <TableCell className="whitespace-pre-wrap text-xs">{a.detalle}</TableCell>
                                        <TableCell className="text-xs">{a.por}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : <p className="text-sm text-muted-foreground">Sin registros de auditoría.</p>}
            </Seccion>
        </div>
    );
}
