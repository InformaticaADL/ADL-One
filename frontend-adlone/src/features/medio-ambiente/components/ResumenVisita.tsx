import React, { useState } from 'react';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';

import { cn } from '@/lib/utils';
import {
    estaEn,
    formatoUF,
    parteDelCostoOperativo,
    seEnvia,
    totalDeLaVisita,
    valorDelPuntoConCosto,
    type ParametroVisita,
    type PuntoFila,
} from '../utils/analisisVisita';

interface Props {
    puntos: PuntoFila[];
    parametros: ParametroVisita[];
    /** Centésimas de UF; una línea más de la visita: cada punto lleva una parte igual. */
    costoOperativo: number;
    nombreLaboratorio: (id: number) => string;
    nombreTipoEntrega: (id: number) => string;
}

const celda = 'border-b border-border px-3 py-1.5';

/**
 * Resumen final de la visita: un renglón por punto (con sus parámetros de terreno y de laboratorio) y, al pie, la suma de los
 * puntos, el costo operativo y el total. Cada punto se despliega para revisar qué parámetros lleva y a qué precio.
 */
export const ResumenVisita: React.FC<Props> = ({ puntos, parametros, costoOperativo, nombreLaboratorio, nombreTipoEntrega }) => {
    const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
    const enviables = parametros.filter(seEnvia);
    const ids = puntos.map((p) => p.id);
    const alternar = (id: string) => setAbiertos((a) => ({ ...a, [id]: !a[id] }));

    return (
        <div className="mb-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full border-collapse text-[13.5px]">
                <thead>
                    <tr className="text-xs font-medium text-muted-foreground">
                        <th className={cn(celda, 'text-left font-medium')}>Punto <span className="font-normal">(clic para ver los parámetros)</span></th>
                        <th className={cn(celda, 'whitespace-nowrap text-right font-medium')}>Parámetros terreno</th>
                        <th className={cn(celda, 'whitespace-nowrap text-right font-medium')}>Parámetros laboratorio</th>
                        <th className={cn(celda, 'text-right font-medium')}>Valor</th>
                    </tr>
                </thead>
                <tbody>
                    {puntos.map((p, i) => {
                        const aqui = enviables.filter((x) => estaEn(x, p.id));
                        const terreno = aqui.filter((x) => x.tipo === 'terreno');
                        const lab = aqui.filter((x) => x.tipo === 'laboratorio');
                        const abierto = !!abiertos[p.id];
                        const nombre = p.puntoMuestreo.trim() || `Punto ${i + 1}`;
                        return (
                            <React.Fragment key={p.id}>
                                <tr className="cursor-pointer hover:bg-muted/40" onClick={() => alternar(p.id)}>
                                    <td className={celda}>
                                        <button
                                            type="button"
                                            aria-expanded={abierto}
                                            aria-label={`${abierto ? 'Ocultar' : 'Ver'} los parámetros de ${nombre}`}
                                            className="flex items-center gap-1.5 text-left font-medium"
                                            onClick={(e) => { e.stopPropagation(); alternar(p.id); }}
                                        >
                                            {abierto ? <IconChevronDown size={15} /> : <IconChevronRight size={15} />}
                                            {nombre}
                                        </button>
                                    </td>
                                    <td className={cn(celda, 'text-right tabular-nums')}>{terreno.length}</td>
                                    <td className={cn(celda, 'text-right tabular-nums')}>{lab.length}</td>
                                    <td className={cn(celda, 'text-right tabular-nums')}>{formatoUF(valorDelPuntoConCosto(enviables, ids, p.id, costoOperativo))} UF</td>
                                </tr>
                                {abierto && (
                                    <tr>
                                        <td colSpan={4} className="border-b border-border bg-muted/30 px-4 py-3">
                                            <div className="grid gap-4 md:grid-cols-2">
                                                <div>
                                                    <div className="mb-1 text-xs font-semibold text-muted-foreground">Parámetros de terreno ({terreno.length})</div>
                                                    {terreno.length === 0 ? <p className="m-0 text-xs text-muted-foreground">Ninguno.</p> : (
                                                        <ul className="m-0 list-none p-0 text-[13px]">
                                                            {terreno.map((x) => (
                                                                <li key={x.id} className="flex justify-between gap-3 py-0.5">
                                                                    <span>{x.nombre}</span>
                                                                    <span className="tabular-nums text-muted-foreground">{formatoUF(x.u[p.id] || 0)} UF</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="mb-1 text-xs font-semibold text-muted-foreground">Parámetros de laboratorio ({lab.length})</div>
                                                    {lab.length === 0 ? <p className="m-0 text-xs text-muted-foreground">Ninguno.</p> : (
                                                        <ul className="m-0 list-none p-0 text-[13px]">
                                                            {lab.map((x) => (
                                                                <li key={x.id} className="py-0.5">
                                                                    <div className="flex justify-between gap-3">
                                                                        <span>{x.nombre}</span>
                                                                        <span className="tabular-nums text-muted-foreground">{formatoUF(x.u[p.id] || 0)} UF</span>
                                                                    </div>
                                                                    <div className="text-[11.5px] text-muted-foreground">
                                                                        {[nombreTipoEntrega(x.idTipoEntrega), nombreLaboratorio(x.idLab1), x.idLab2 ? nombreLaboratorio(x.idLab2) : ''].filter(Boolean).join(' · ')}
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="mt-3 flex justify-between gap-3 border-t border-border pt-2 text-[13px]">
                                                <span>Costo operativo (parte de este punto)</span>
                                                <span className="tabular-nums text-muted-foreground">{formatoUF(parteDelCostoOperativo(costoOperativo, ids.length, ids.indexOf(p.id)))} UF</span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr className="bg-muted/40 font-bold">
                        <td className="px-3 py-1.5" colSpan={3}>Total de la visita (incluye el costo operativo de {formatoUF(costoOperativo)} UF)</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatoUF(totalDeLaVisita(enviables, ids, costoOperativo))} UF</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};
