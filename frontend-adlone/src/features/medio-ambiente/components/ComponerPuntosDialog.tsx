import React, { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { nombreDeComposicion } from '../utils/analisisVisita';

interface Props {
    open: boolean;
    onOpenChange: (abierto: boolean) => void;
    /** Puntos entre los que se puede elegir (los que ya tienen parámetros). */
    puntos: Array<{ id: string; nombre: string }>;
    onConfirmar: (origenes: string[], nombre: string) => void;
}

/**
 * «Componer puntos»: crea un punto nuevo con el laboratorio de los puntos elegidos, tomado UNA sola vez sobre la mezcla de las muestras
 * (por ejemplo «Composición Estación 2 y 3»). Cada punto elegido se queda solo con sus análisis de terreno.
 */
export const ComponerPuntosDialog: React.FC<Props> = ({ open, onOpenChange, puntos, onConfirmar }) => {
    const [elegidos, setElegidos] = useState<string[]>([]);
    const [nombre, setNombre] = useState('');
    const [nombreEditado, setNombreEditado] = useState(false);

    useEffect(() => { if (open) { setElegidos([]); setNombre(''); setNombreEditado(false); } }, [open]);

    const sugerido = useMemo(() => nombreDeComposicion(puntos.filter((p) => elegidos.includes(p.id)).map((p) => p.nombre)), [puntos, elegidos]);
    const alternar = (id: string) => setElegidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    const nombreFinal = nombreEditado ? nombre : sugerido;
    const puedeCrear = elegidos.length >= 2 && nombreFinal.trim().length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[540px]">
                <DialogHeader>
                    <DialogTitle>Componer puntos</DialogTitle>
                    <DialogDescription>
                        Los análisis de laboratorio de los puntos que elijas se toman una sola vez, sobre la mezcla de sus muestras, en un punto nuevo. Cada punto elegido
                        se queda solo con sus análisis de terreno.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex max-h-60 flex-col gap-1.5 overflow-y-auto rounded-lg border border-border p-2">
                    {puntos.map((p) => (
                        <label key={p.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                            <Checkbox checked={elegidos.includes(p.id)} onCheckedChange={() => alternar(p.id)} />
                            {p.nombre || 'Sin nombre'}
                        </label>
                    ))}
                </div>
                <div>
                    <label className="mb-1 block text-xs text-muted-foreground" htmlFor="nombre-composicion">Nombre del punto compuesto</label>
                    <Input id="nombre-composicion" value={nombreFinal} onChange={(e) => { setNombre(e.target.value); setNombreEditado(true); }} placeholder="Composición Estación 2 y 3" />
                </div>
                <p className="m-0 text-xs text-muted-foreground">
                    {elegidos.length < 2 ? 'Elige al menos dos puntos.' : 'Si un análisis de laboratorio tenía distinto precio en los puntos elegidos, el compuesto conserva el más alto. Después puedes ajustar los precios.'}
                </p>
                <DialogFooter className="gap-2 sm:gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button disabled={!puedeCrear} onClick={() => { onConfirmar(elegidos, nombreFinal.trim()); onOpenChange(false); }}>Crear punto compuesto</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
