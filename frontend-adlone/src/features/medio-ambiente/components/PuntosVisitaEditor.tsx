import React, { useMemo, useState } from 'react';

import { IconArrowBackUp, IconMapPin, IconTrash } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { refAutomatica } from '../utils/utm';
import { MapaUbicacionDialog } from './MapaUbicacionDialog';
import { cn } from '@/lib/utils';

export interface FilaPunto { id: number; punto: string; zona: string; utmNorte: string; utmEste: string; refGoogle: string }

export const sinCoordenadas = (zona: string) => !zona || /^\s*(no\s*aplica|n\/?a)\s*$/i.test(zona);

interface Props {
    filas: FilaPunto[];
    /** Cómo estaba cada punto al abrir la edición (para marcar las filas que cambiaron). */
    inicial: FilaPunto[];
    onChange: (filas: FilaPunto[]) => void;
    zonas: ComboboxOption[];
    /** Fichas marcadas para quitar de la visita (se cancelan al guardar). */
    quitados?: number[];
    onQuitar?: (id: number) => void;
    onDeshacerQuitar?: (id: number) => void;
}

/**
 * Tabla de los puntos de una visita que ya existe (nombre, zona, coordenadas y mapa), con el mismo diseño de la tabla con la que se crea la visita.
 * Es un componente controlado: el estado vive en quien lo usa. No agrega ni quita puntos (eso crearía o cancelaría fichas).
 */
export const PuntosVisitaEditor: React.FC<Props> = ({ filas, inicial, onChange, zonas, quitados = [], onQuitar, onDeshacerQuitar }) => {
    const [mapaDe, setMapaDe] = useState<FilaPunto | null>(null);
    const opcionesZona = useMemo(() => [{ value: '', label: '— Sin zona —' }, ...zonas], [zonas]);

    const cambiar = (id: number, campo: keyof FilaPunto, valor: string) =>
        onChange(filas.map((f) => {
            if (f.id !== id) return f;
            const nuevo = { ...f, [campo]: valor };
            // Con zona «No aplica» (o sin zona) las coordenadas no corresponden.
            if (campo === 'zona' && sinCoordenadas(valor)) { nuevo.utmNorte = ''; nuevo.utmEste = ''; }
            if (campo === 'zona' || campo === 'utmNorte' || campo === 'utmEste') return refAutomatica(nuevo);
            return nuevo;
        }));

    // Una sola zona para todos los puntos. Las coordenadas de cada punto se conservan (salvo sin zona o «No aplica»).
    const aplicarZonaATodos = (zona: string) =>
        onChange(filas.map((f) => refAutomatica(sinCoordenadas(zona) ? { ...f, zona, utmNorte: '', utmEste: '' } : { ...f, zona })));
    const zonaComun = filas.length > 0 && filas.every((f) => f.zona && f.zona === filas[0].zona) ? filas[0].zona : '';
    const sinNombre = filas.some((f) => !f.punto.trim());

    return (
        <div>
            <div className="mb-3 max-w-xs">
                <label className="mb-1 block text-xs text-muted-foreground">Zona UTM para todos los puntos</label>
                <Combobox options={opcionesZona} value={zonaComun || undefined} onValueChange={(v) => aplicarZonaATodos(v || '')} placeholder="Elegir zona…" />
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full border-collapse text-[13px]">
                    <thead>
                        <tr className="bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                            <th className="w-10 px-3 py-2">#</th>
                            <th className="min-w-[180px] px-2 py-2">Punto de muestreo *</th>
                            <th className="min-w-[150px] px-2 py-2">Zona UTM</th>
                            <th className="min-w-[110px] px-2 py-2">UTM Norte</th>
                            <th className="min-w-[110px] px-2 py-2">UTM Este</th>
                            <th className="min-w-[200px] px-2 py-2">Referencia (mapa)</th>
                            {onQuitar && <th className="w-24 px-2 py-2" />}
                        </tr>
                    </thead>
                    <tbody>
                        {filas.map((f, i) => {
                            const sinCoord = sinCoordenadas(f.zona);
                            const cambiada = JSON.stringify(f) !== JSON.stringify(inicial[i]);
                            const quitado = quitados.includes(f.id);
                            return (
                                <tr key={f.id} className={cn('border-t border-border', cambiada && 'bg-primary/5', quitado && 'bg-destructive/5')}>
                                    <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                                    <td className="px-2 py-1.5"><Input aria-label={`Nombre del punto ${i + 1}`} disabled={quitado} value={f.punto} onChange={(e) => cambiar(f.id, 'punto', e.target.value)} aria-invalid={!f.punto.trim()} /></td>
                                    <td className="px-2 py-1.5"><Combobox disabled={quitado} options={opcionesZona} value={f.zona || undefined} onValueChange={(v) => cambiar(f.id, 'zona', v || '')} placeholder="Sin zona" /></td>
                                    <td className="px-2 py-1.5"><Input aria-label={`UTM Norte del punto ${i + 1}`} inputMode="numeric" value={f.utmNorte} disabled={sinCoord || quitado} onChange={(e) => cambiar(f.id, 'utmNorte', e.target.value)} /></td>
                                    <td className="px-2 py-1.5"><Input aria-label={`UTM Este del punto ${i + 1}`} inputMode="numeric" value={f.utmEste} disabled={sinCoord || quitado} onChange={(e) => cambiar(f.id, 'utmEste', e.target.value)} /></td>
                                    <td className="px-2 py-1.5"><div className="flex items-center gap-1"><Input aria-label={`Referencia del punto ${i + 1}`} disabled={quitado} value={f.refGoogle} onChange={(e) => cambiar(f.id, 'refGoogle', e.target.value)} placeholder="Opcional (se genera de las UTM)" /><Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={`Ver en el mapa el punto ${i + 1}`} title="Ver en el mapa lo que resulta de la zona y las UTM" onClick={() => setMapaDe(f)}><IconMapPin size={16} /></Button></div></td>
                                    {onQuitar && (
                                        <td className="px-2 py-1.5 text-right">
                                            {quitado ? (
                                                <Button type="button" variant="ghost" size="sm" onClick={() => onDeshacerQuitar?.(f.id)}><IconArrowBackUp size={15} /> Deshacer</Button>
                                            ) : (
                                                <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" aria-label={`Quitar el punto ${i + 1}`} onClick={() => onQuitar(f.id)} disabled={filas.length - quitados.length <= 1}><IconTrash size={15} /> Quitar</Button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {sinNombre && <p className="mb-0 mt-2 text-xs text-destructive">Todos los puntos deben tener nombre.</p>}
            <p className="mb-0 mt-3 text-xs text-muted-foreground">Aquí se corrigen los puntos que ya existen. «Quitar» cancela la ficha de ese punto al guardar (con un motivo, sin borrar nada) y la visita debe conservar al menos un punto.</p>
            {mapaDe && <MapaUbicacionDialog open onClose={() => setMapaDe(null)} nombre={mapaDe.punto} zona={mapaDe.zona} utmNorte={mapaDe.utmNorte} utmEste={mapaDe.utmEste} refGoogle={mapaDe.refGoogle} />}
        </div>
    );
};
