import React, { useMemo } from 'react';

import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface FilaPunto { id: number; punto: string; zona: string; utmNorte: string; utmEste: string; refGoogle: string }

export const sinCoordenadas = (zona: string) => !zona || /^\s*(no\s*aplica|n\/?a)\s*$/i.test(zona);

interface Props {
    filas: FilaPunto[];
    /** Cómo estaba cada punto al abrir la edición (para marcar las filas que cambiaron). */
    inicial: FilaPunto[];
    onChange: (filas: FilaPunto[]) => void;
    zonas: ComboboxOption[];
}

/**
 * Tabla de los puntos de una visita que ya existe (nombre, zona, coordenadas y mapa), con el mismo diseño de la tabla con la que se crea la visita.
 * Es un componente controlado: el estado vive en quien lo usa. No agrega ni quita puntos (eso crearía o cancelaría fichas).
 */
export const PuntosVisitaEditor: React.FC<Props> = ({ filas, inicial, onChange, zonas }) => {
    const opcionesZona = useMemo(() => [{ value: '', label: '— Sin zona —' }, ...zonas], [zonas]);

    const cambiar = (id: number, campo: keyof FilaPunto, valor: string) =>
        onChange(filas.map((f) => {
            if (f.id !== id) return f;
            const nuevo = { ...f, [campo]: valor };
            // Con zona «No aplica» (o sin zona) las coordenadas no corresponden.
            if (campo === 'zona' && sinCoordenadas(valor)) { nuevo.utmNorte = ''; nuevo.utmEste = ''; }
            return nuevo;
        }));

    // Una sola zona para todos los puntos. Las coordenadas de cada punto se conservan (salvo sin zona o «No aplica»).
    const aplicarZonaATodos = (zona: string) =>
        onChange(filas.map((f) => (sinCoordenadas(zona) ? { ...f, zona, utmNorte: '', utmEste: '' } : { ...f, zona })));
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
                        </tr>
                    </thead>
                    <tbody>
                        {filas.map((f, i) => {
                            const sinCoord = sinCoordenadas(f.zona);
                            const cambiada = JSON.stringify(f) !== JSON.stringify(inicial[i]);
                            return (
                                <tr key={f.id} className={cn('border-t border-border', cambiada && 'bg-primary/5')}>
                                    <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                                    <td className="px-2 py-1.5"><Input aria-label={`Nombre del punto ${i + 1}`} value={f.punto} onChange={(e) => cambiar(f.id, 'punto', e.target.value)} aria-invalid={!f.punto.trim()} /></td>
                                    <td className="px-2 py-1.5"><Combobox options={opcionesZona} value={f.zona || undefined} onValueChange={(v) => cambiar(f.id, 'zona', v || '')} placeholder="Sin zona" /></td>
                                    <td className="px-2 py-1.5"><Input aria-label={`UTM Norte del punto ${i + 1}`} inputMode="numeric" value={f.utmNorte} disabled={sinCoord} onChange={(e) => cambiar(f.id, 'utmNorte', e.target.value)} /></td>
                                    <td className="px-2 py-1.5"><Input aria-label={`UTM Este del punto ${i + 1}`} inputMode="numeric" value={f.utmEste} disabled={sinCoord} onChange={(e) => cambiar(f.id, 'utmEste', e.target.value)} /></td>
                                    <td className="px-2 py-1.5"><Input aria-label={`Referencia del punto ${i + 1}`} value={f.refGoogle} onChange={(e) => cambiar(f.id, 'refGoogle', e.target.value)} placeholder="https://maps.app.goo.gl/…" /></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {sinNombre && <p className="mb-0 mt-2 text-xs text-destructive">Todos los puntos deben tener nombre.</p>}
            <p className="mb-0 mt-3 text-xs text-muted-foreground">Aquí solo se cambian los datos de los puntos que ya existen. Para agregar o quitar un punto hay que crear o cancelar su ficha.</p>
        </div>
    );
};
