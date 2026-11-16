import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export interface PuntoVisita {
    id: number;
    titulo: string;
    detalle?: string;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Puntos que formarán la visita; el orden inicial es el de esta lista. */
    puntos: PuntoVisita[];
    /** Texto bajo el título, ej. el centro y la empresa. */
    descripcion?: string;
    /** Aviso opcional (ej. «2 puntos ya están ejecutados»). */
    aviso?: React.ReactNode;
    /** Si es true se ofrece «Agendar enseguida» (solo desde la pantalla de Asignación). */
    permiteAgendar?: boolean;
    /** Valor inicial de «Agendar enseguida». */
    agendarInicial?: boolean;
    /** Crea la visita. `agendar` indica si hay que seguir con el panel de agendar. Debe lanzar o rechazar si falla. */
    onConfirmar: (datos: { orden: number[]; nota?: string; agendar: boolean }) => Promise<void>;
}

/**
 * Crear una visita con varios puntos a partir de fichas puntuales sueltas del mismo centro: ordena los puntos, agrega una nota y,
 * si se quiere, sigue directo al panel de agendar. Avisa cómo verá la visita el técnico en la app.
 */
export const CrearVisitaDialog: React.FC<Props> = ({ open, onOpenChange, puntos, descripcion, aviso, permiteAgendar = false, agendarInicial = false, onConfirmar }) => {
    const [orden, setOrden] = useState<number[]>([]);
    const [nota, setNota] = useState('');
    const [agendar, setAgendar] = useState(false);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        if (open) {
            setOrden(puntos.map((p) => p.id));
            setNota('');
            setAgendar(permiteAgendar && agendarInicial);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const mover = (i: number, d: number) => setOrden((prev) => {
        const j = i + d;
        if (j < 0 || j >= prev.length) return prev;
        const sig = [...prev];
        [sig[i], sig[j]] = [sig[j], sig[i]];
        return sig;
    });

    const confirmar = async () => {
        setGuardando(true);
        try {
            await onConfirmar({ orden, nota: nota.trim() || undefined, agendar: permiteAgendar && agendar });
        } catch {
            // quien llama ya mostró el error
        } finally {
            setGuardando(false);
        }
    };

    const filas = orden.map((id) => puntos.find((p) => p.id === id)).filter(Boolean) as PuntoVisita[];
    const accion = permiteAgendar && agendar ? 'Crear y agendar' : 'Crear visita';

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!guardando) onOpenChange(o); }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Crear visita</DialogTitle>
                    <DialogDescription>
                        {filas.length} puntos{descripcion ? ` · ${descripcion}` : ''}. Ordénalos como se recorrerán.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex max-h-[300px] flex-col overflow-y-auto">
                    {filas.map((p, i) => (
                        <div key={p.id} className="flex items-center gap-3 border-t border-border py-2 first:border-t-0">
                            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs text-muted-foreground">{i + 1}</span>
                            <div className="min-w-0 flex-1">
                                <p className="m-0 truncate text-sm font-medium">{p.titulo}</p>
                                {p.detalle && <p className="m-0 truncate text-xs text-muted-foreground">{p.detalle}</p>}
                            </div>
                            <Button type="button" size="icon-xs" variant="outline" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>↑</Button>
                            <Button type="button" size="icon-xs" variant="outline" aria-label="Bajar" disabled={i === filas.length - 1} onClick={() => mover(i, 1)}>↓</Button>
                        </div>
                    ))}
                </div>

                <div>
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nota (opcional)</Label>
                    <Input value={nota} maxLength={250} onChange={(e) => setNota(e.target.value)} placeholder="Ej.: monitoreo mensual de noviembre" />
                </div>

                {permiteAgendar && (
                    <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                        <Switch id="agendar-enseguida" checked={agendar} onCheckedChange={setAgendar} className="mt-0.5" />
                        <div>
                            <Label htmlFor="agendar-enseguida" className="text-sm font-medium">Agendar enseguida</Label>
                            <p className="m-0 text-xs text-muted-foreground">
                                {agendar
                                    ? 'Al crear la visita se abre el panel de agendar, con fecha y responsable, para estos mismos puntos.'
                                    : 'Opcional. Si no agendas ahora, la visita queda en «Por agendar» y la agendas después, con todos sus puntos juntos.'}
                            </p>
                        </div>
                    </div>
                )}

                {aviso && (
                    <div className="rounded-lg bg-[color-mix(in_oklab,var(--sc-mark)_14%,transparent)] px-3 py-2 text-sm">{aviso}</div>
                )}

                <div className="rounded-lg bg-primary/10 px-3 py-2 text-sm">
                    <strong>En la app del técnico aparecerá como una visita de {filas.length} puntos:</strong> verá la lista de puntos para elegir, un FoMa único y firmará una sola vez
                    {permiteAgendar && agendar ? '.' : ', siempre que se agende junta y con el mismo N° de servicio.'}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>Cancelar</Button>
                    <Button onClick={confirmar} disabled={guardando || filas.length < 2}>{guardando ? 'Creando...' : accion}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
