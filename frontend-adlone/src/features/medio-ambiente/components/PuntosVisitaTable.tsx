import React, { useState } from 'react';
import { IconClipboardText, IconPlus, IconTrash, IconWand } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    generarPuntos,
    nuevoPunto,
    puntosDesdeTexto,
    type PuntoFila,
} from '../utils/analisisVisita';

interface Props {
    puntos: PuntoFila[];
    onChange: (puntos: PuntoFila[]) => void;
    zonas: ComboboxOption[];
    /** Detecta la zona «No aplica» (entonces no se piden coordenadas). */
    zonaNoAplica: (zona: string) => boolean;
}

const estaVacio = (p: PuntoFila) => !p.puntoMuestreo.trim() && !p.zona && !p.utmNorte.trim() && !p.utmEste.trim() && !p.refGoogle.trim();

/**
 * Tabla de puntos de la visita (una ficha por punto). Se pueden escribir uno por uno, generar varios con réplicas
 * («Borde AZE, Control» × 3) o pegar desde Excel.
 */
export const PuntosVisitaTable: React.FC<Props> = ({ puntos, onChange, zonas, zonaNoAplica }) => {
    const [nombres, setNombres] = useState('');
    const [replicas, setReplicas] = useState('1');
    const [pegarAbierto, setPegarAbierto] = useState(false);
    const [textoPegado, setTextoPegado] = useState('');

    // Lo que se genera o pega parte con la zona del primer punto (suele ser la misma en todo el centro).
    const base = (): Partial<PuntoFila> => ({ zona: puntos[0]?.zona || '' });
    const agregar = (nuevos: PuntoFila[]) => {
        if (nuevos.length === 0) return;
        const sinVacios = puntos.length === 1 && estaVacio(puntos[0]) ? [] : puntos;
        onChange([...sinVacios, ...nuevos]);
    };

    const cambiar = (id: string, campo: keyof PuntoFila, valor: string) =>
        onChange(puntos.map((p) => {
            if (p.id !== id) return p;
            const nuevo = { ...p, [campo]: valor };
            // Con zona «No aplica» las coordenadas no corresponden.
            if (campo === 'zona' && zonaNoAplica(valor)) { nuevo.utmNorte = ''; nuevo.utmEste = ''; }
            return nuevo;
        }));

    const quitar = (id: string) => onChange(puntos.length > 1 ? puntos.filter((p) => p.id !== id) : [nuevoPunto()]);

    const generar = () => {
        const filas = generarPuntos(nombres, parseInt(replicas, 10) || 1, base());
        if (filas.length === 0) return;
        agregar(filas);
        setNombres('');
    };

    const pegar = () => {
        agregar(puntosDesdeTexto(textoPegado, base()));
        setTextoPegado('');
        setPegarAbierto(false);
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <div className="text-sm font-semibold text-foreground">Generar varios puntos</div>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[240px] flex-1">
                        <label className="mb-1 block text-xs text-muted-foreground" htmlFor="gen-nombres">Puntos (separados por coma)</label>
                        <Input
                            id="gen-nombres"
                            value={nombres}
                            onChange={(e) => setNombres(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); generar(); } }}
                            placeholder="Borde AZE, Control"
                        />
                    </div>
                    <div className="w-28">
                        <label className="mb-1 block text-xs text-muted-foreground" htmlFor="gen-replicas">Réplicas por punto</label>
                        <Input id="gen-replicas" type="number" min={1} max={50} value={replicas} onChange={(e) => setReplicas(e.target.value)} />
                    </div>
                    <Button type="button" onClick={generar} disabled={!nombres.trim()}><IconWand size={16} /> Generar</Button>
                    <Button type="button" variant="outline" onClick={() => setPegarAbierto(true)}><IconClipboardText size={16} /> Pegar desde Excel</Button>
                </div>
                <p className="m-0 text-xs text-muted-foreground">
                    «Borde AZE, Control» con 3 réplicas crea Borde AZE 1, 2 y 3 y Control 1, 2 y 3. Se crea una ficha por cada punto, todas agrupadas como una sola visita.
                </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[820px] border-collapse text-sm">
                    <thead>
                        <tr className="bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                            <th className="w-10 px-3 py-2">#</th>
                            <th className="px-3 py-2">Punto de muestreo *</th>
                            <th className="w-40 px-3 py-2">Zona UTM *</th>
                            <th className="w-36 px-3 py-2">UTM Norte</th>
                            <th className="w-36 px-3 py-2">UTM Este</th>
                            <th className="px-3 py-2">Referencia Google Maps</th>
                            <th className="w-10 px-3 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {puntos.map((p, i) => {
                            const sinCoord = !p.zona || zonaNoAplica(p.zona);
                            return (
                                <tr key={p.id} className="border-t border-border align-middle">
                                    <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                                    <td className="px-2 py-1.5"><Input aria-label={`Nombre del punto ${i + 1}`} value={p.puntoMuestreo} onChange={(e) => cambiar(p.id, 'puntoMuestreo', e.target.value)} placeholder="Ej.: Borde AZE 1" /></td>
                                    <td className="px-2 py-1.5">
                                        <Combobox options={zonas} value={p.zona || undefined} onValueChange={(v) => cambiar(p.id, 'zona', v || '')} placeholder="Zona…" />
                                    </td>
                                    <td className="px-2 py-1.5"><Input aria-label={`UTM Norte del punto ${i + 1}`} inputMode="numeric" value={p.utmNorte} disabled={sinCoord} onChange={(e) => cambiar(p.id, 'utmNorte', e.target.value)} /></td>
                                    <td className="px-2 py-1.5"><Input aria-label={`UTM Este del punto ${i + 1}`} inputMode="numeric" value={p.utmEste} disabled={sinCoord} onChange={(e) => cambiar(p.id, 'utmEste', e.target.value)} /></td>
                                    <td className="px-2 py-1.5"><Input aria-label={`Referencia del punto ${i + 1}`} value={p.refGoogle} onChange={(e) => cambiar(p.id, 'refGoogle', e.target.value)} placeholder="https://maps.app.goo.gl/…" /></td>
                                    <td className="px-1 py-1.5 text-center">
                                        <Button type="button" variant="ghost" size="icon" aria-label={`Quitar el punto ${i + 1}`} onClick={() => quitar(p.id)}><IconTrash size={16} /></Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="outline" onClick={() => onChange([...puntos, nuevoPunto({ zona: puntos[puntos.length - 1]?.zona || '' })])}>
                    <IconPlus size={16} /> Agregar punto
                </Button>
                <span className="text-xs text-muted-foreground">
                    {puntos.length === 1 ? 'Se creará 1 ficha.' : `Se crearán ${puntos.length} fichas, agrupadas como una sola visita.`} Sin referencia de Google Maps, la ficha queda inhabilitada para generar rutas.
                </span>
            </div>

            <Dialog open={pegarAbierto} onOpenChange={setPegarAbierto}>
                <DialogContent className="max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle>Pegar puntos desde Excel</DialogTitle>
                        <DialogDescription>
                            Copie las celdas en Excel y péguelas aquí. Una fila por punto, con las columnas en este orden: Punto, Zona, UTM Norte, UTM Este, Referencia Google Maps. Solo el punto es obligatorio; lo que falte puede completarse después.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        value={textoPegado}
                        onChange={(e) => setTextoPegado(e.target.value)}
                        rows={8}
                        placeholder={'Borde AZE 1\t19S\t5400000\t600000\nBorde AZE 2\t19S\t5400100\t600050'}
                        aria-label="Puntos pegados desde Excel"
                    />
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button variant="outline" onClick={() => setPegarAbierto(false)}>Cancelar</Button>
                        <Button onClick={pegar} disabled={!textoPegado.trim()}>Agregar los puntos</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
