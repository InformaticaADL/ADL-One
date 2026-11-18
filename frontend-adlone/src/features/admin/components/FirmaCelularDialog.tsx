import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IconCircleCheck, IconClock, IconCopy, IconDeviceMobile, IconRefresh } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '../../../contexts/ToastContext';
import { fichasEquipoService, type SesionFirmaFicha } from '../services/fichasEquipo.service';

export interface SlotFirma {
    id: string;
    titulo: string;
    nombre?: string | null;
    /** Ya está firmada en el formulario (dibujada, guardada o importada): no se pide al celular. */
    firmada: boolean;
}

interface Props {
    open: boolean;
    onClose: () => void;
    titulo: string;
    subtitulo?: string;
    slots: SlotFirma[];
    /** Llega una firma hecha en el celular: el formulario la pone en su campo. */
    onFirma: (id: string, imagen: string) => void;
}

const mensajeError = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

/**
 * Firmar las firmas de una ficha con el celular: muestra un QR; el celular lista solo las firmas
 * que faltan (las ya firmadas en pantalla —dibujadas o importadas— no se piden) y cada una vuelve
 * al formulario apenas se graba. Mismo enfoque que el QR de Verificación de Temperatura.
 */
export const FirmaCelularDialog: React.FC<Props> = ({ open, onClose, titulo, subtitulo, slots, onFirma }) => {
    const { showToast } = useToast();
    const [sesion, setSesion] = useState<SesionFirmaFicha | null>(null);
    const [generando, setGenerando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Firmas recibidas del celular (por slot), para mostrarlas aunque el formulario ya las tenga.
    const [delCelular, setDelCelular] = useState<Record<string, string>>({});
    const [completo, setCompleto] = useState(false);
    const [ahora, setAhora] = useState(() => Date.now());
    // Lo último entregado al formulario por slot: solo se vuelve a entregar si el celular rehízo la firma.
    const entregadas = useRef<Record<string, string>>({});
    // Los slots que se pidieron al abrir (el resto ya venía firmado).
    const pedidos = useRef<string[]>([]);
    const slotsRef = useRef(slots);
    useEffect(() => { slotsRef.current = slots; });
    const onFirmaRef = useRef(onFirma);
    useEffect(() => { onFirmaRef.current = onFirma; });

    const generar = useCallback(async () => {
        const pendientes = slotsRef.current.filter((s) => !s.firmada);
        pedidos.current = pendientes.map((s) => s.id);
        if (!pendientes.length) return;
        setGenerando(true); setError(null); setCompleto(false);
        try {
            setSesion(await fichasEquipoService.crearFirmaRemota({
                titulo, subtitulo,
                slots: pendientes.map((s) => ({ id: s.id, titulo: s.titulo, nombre: s.nombre || null })),
            }));
        } catch (e) {
            setError(mensajeError(e) || 'No se pudo generar el código QR.');
        } finally {
            setGenerando(false);
        }
    }, [titulo, subtitulo]);

    // Al abrir: sesión nueva. Al cerrar: se limpia todo.
    useEffect(() => {
        if (!open) { setSesion(null); setError(null); setDelCelular({}); setCompleto(false); entregadas.current = {}; return; }
        generar();
    }, [open, generar]);

    // Espera las firmas del celular: consulta cada 2 segundos.
    useEffect(() => {
        if (!open || !sesion || completo) return;
        const t = setInterval(async () => {
            setAhora(Date.now());
            try {
                const r = await fichasEquipoService.estadoFirmaRemota(sesion.token);
                for (const s of r.slots) {
                    if (s.firmada && s.firma && entregadas.current[s.id] !== s.firma) {
                        entregadas.current[s.id] = s.firma;
                        setDelCelular((p) => ({ ...p, [s.id]: s.firma as string }));
                        onFirmaRef.current(s.id, s.firma);
                    }
                }
                if (r.estado === 'completo') {
                    setCompleto(true);
                    showToast({ type: 'success', message: 'Todas las firmas llegaron desde el celular' });
                }
            } catch (e) {
                setError(mensajeError(e) || 'El código QR ya no es válido.');
                setSesion(null);
            }
        }, 2000);
        return () => clearInterval(t);
    }, [open, sesion, completo, showToast]);

    const minutosRestantes = sesion ? Math.max(0, Math.ceil((new Date(sesion.expira).getTime() - ahora) / 60000)) : 0;
    const sinPendientes = slots.every((s) => s.firmada && !pedidos.current.includes(s.id)) && !sesion && !generando && !error;

    const copiar = async () => {
        if (!sesion) return;
        try { await navigator.clipboard.writeText(sesion.url); showToast({ type: 'success', message: 'Enlace copiado' }); } catch { /* sin portapapeles */ }
    };

    const estadoDe = (s: SlotFirma) => (delCelular[s.id] ? 'celular' : s.firmada ? 'listo' : 'pendiente') as 'celular' | 'listo' | 'pendiente';

    const listas = slots.filter((x) => x.firmada).length;

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            {/* grid-cols-[minmax(0,1fr)]: sin esto el contenido ensancha la columna y se sale de la ventana. */}
            <DialogContent className="max-w-xl grid-cols-[minmax(0,1fr)] gap-5">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><IconDeviceMobile size={18} /> Firmar con el celular</DialogTitle>
                    <DialogDescription>{titulo}{subtitulo ? ` · ${subtitulo}` : ''}</DialogDescription>
                </DialogHeader>

                {/* 1. Qué hacer: escanear el QR (o aviso si no hay nada que pedir / hubo un error / ya llegaron todas) */}
                {sinPendientes ? (
                    <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Todas las firmas ya están hechas: no hay nada que pedir al celular.</p>
                ) : error ? (
                    <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
                        <p className="text-sm text-destructive">{error}</p>
                        <Button size="sm" variant="outline" onClick={generar} disabled={generando}><IconRefresh size={14} /> Generar código nuevo</Button>
                    </div>
                ) : completo ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-8 text-center">
                        <IconCircleCheck size={40} className="text-success" />
                        <p className="text-sm font-semibold text-success">Llegaron todas las firmas</p>
                        <p className="text-xs text-muted-foreground">Ya están en la ficha. Puede cerrar esta ventana.</p>
                    </div>
                ) : (
                    <div className="grid min-w-0 gap-4 rounded-lg border border-border p-4 sm:grid-cols-[auto_minmax(0,1fr)]">
                        <div className="mx-auto flex h-44 w-44 shrink-0 items-center justify-center rounded-lg border border-border bg-white p-2 sm:mx-0">
                            {sesion && !generando
                                ? <img src={sesion.qr} alt="Código QR para firmar desde el celular" className="h-full w-full" />
                                : <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
                        </div>
                        <div className="flex min-w-0 flex-col gap-3">
                            <ol className="flex flex-col gap-2 text-sm">
                                {[
                                    <>Abra la cámara del celular y apunte al código.</>,
                                    <>Toque cada firma que falta y firme con el dedo.</>,
                                    <>Presione <b>Grabar firma</b>: aparece aquí y en la ficha.</>,
                                ].map((t, i) => (
                                    <li key={i} className="flex items-start gap-2.5">
                                        <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{i + 1}</span>
                                        <span className="min-w-0">{t}</span>
                                    </li>
                                ))}
                            </ol>
                            {sesion && (
                                <div className="flex min-w-0 items-center gap-1 rounded-md bg-muted px-2 py-1">
                                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground" title={sesion.url}>{sesion.url}</span>
                                    <Button variant="ghost" size="icon-xs" onClick={copiar} title="Copiar enlace" aria-label="Copiar enlace"><IconCopy size={12} /></Button>
                                </div>
                            )}
                            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Esperando las firmas…
                                </span>
                                {sesion && <span>· vence en {minutosRestantes} min</span>}
                            </p>
                            <p className="text-[11px] text-muted-foreground">El celular debe estar en la misma red Wi-Fi que este equipo.</p>
                        </div>
                    </div>
                )}

                {/* 2. Las firmas de la ficha: las ya hechas no se piden al celular; las que faltan quedan pendientes */}
                <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold">Firmas de la ficha</span>
                        <Badge variant={listas === slots.length ? 'success' : 'outline'} className={listas === slots.length ? '' : 'text-muted-foreground'}>{listas} de {slots.length} listas</Badge>
                    </div>
                    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                        {slots.map((s) => {
                            const e = estadoDe(s);
                            return (
                                <li key={s.id} className="flex min-w-0 items-center gap-3 px-3 py-2.5">
                                    <span className={e === 'pendiente' ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground' : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/15 text-success'}>
                                        {e === 'pendiente' ? <IconClock size={15} /> : <IconCircleCheck size={16} />}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium leading-tight">{s.titulo}</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {s.nombre ? `${s.nombre} · ` : ''}{e === 'celular' ? 'firmada desde el celular' : e === 'listo' ? 'ya firmada en la ficha' : 'falta firmar'}
                                        </p>
                                    </div>
                                    {e === 'celular' && delCelular[s.id] && (
                                        <div className="flex h-10 w-20 shrink-0 items-center justify-center rounded border border-border bg-white"><img src={delCelular[s.id]} alt="" className="max-h-9 max-w-full object-contain" /></div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <DialogFooter>
                    <Button variant={completo ? 'default' : 'outline'} onClick={onClose}>{completo ? 'Listo' : 'Cerrar'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default FirmaCelularDialog;
