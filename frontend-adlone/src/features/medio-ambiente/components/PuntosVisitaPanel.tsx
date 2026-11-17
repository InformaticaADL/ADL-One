import React, { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { fichaService } from '../services/ficha.service';
import { formatoUF, aCentesimas } from '../utils/analisisVisita';

export interface PuntoDeVisita {
    id_fichaingresoservicio: number;
    punto: string;
    estado: string;
}

interface LineaAnalisis {
    clave: string;
    nombre: string;
    detalle: string; // normativa · tabla
    tipo: 'terreno' | 'laboratorio';
    uf: number; // centésimas
}

interface Resumen {
    zonaRaw: string; // la zona tal cual está guardada (vacía si no tiene)
    utmNorte: string;
    utmEste: string;
    zona: string;
    utm: string;
    referencia: string;
    lineas: LineaAnalisis[];
    costoOperativo: number; // centésimas
    valor: number; // centésimas, con costo operativo
}

export interface DatosVisita {
    ids: number[];
    res: Record<number, Resumen | null>;
    cargados: boolean;
    mismosAnalisis: boolean;
}

const nombreDe = (r: any): string => String(r.nombre_tecnica || r.nombre_determinacion || r.nombre_examen || '').trim();

function resumir(data: any): Resumen {
    const detalles: any[] = Array.isArray(data?.detalles) ? data.detalles : [];
    const regulares = detalles.filter((r) => r.tipo_analisis !== 'CostoOperativo');
    const co = detalles.filter((r) => r.tipo_analisis === 'CostoOperativo').reduce((s, r) => s + aCentesimas(r.uf_individual), 0);
    const lineas: LineaAnalisis[] = regulares.map((r) => {
        const normativa = String(r.nombre_normativa || '').trim();
        const tabla = String(r.nombre_normativareferencia || r.nombre_referencia || '').trim();
        const esTerreno = String(r.tipo_analisis || '').toLowerCase().startsWith('terr');
        return {
            clave: `${nombreDe(r)}|${normativa}|${tabla}`,
            nombre: nombreDe(r) || 'Sin nombre',
            detalle: [normativa, tabla].filter(Boolean).join(' · '),
            tipo: esTerreno ? 'terreno' : 'laboratorio',
            uf: aCentesimas(r.uf_individual),
        };
    });
    const coord = String(data?.ma_coordenadas || '').trim();
    const m = coord.match(/^(.*?) UTM (\d*)E (\d*)S/);
    const zona = m ? m[1] : (coord || '');
    const utm = m && (m[2] || m[3]) ? `${m[2] || '—'} E · ${m[3] || '—'} S` : '';
    return { zonaRaw: zona || '', utmNorte: m ? m[2] : '', utmEste: m ? m[3] : '', zona: zona || 'Sin zona', utm, referencia: String(data?.referencia_googlemaps || '').trim(), lineas, costoOperativo: co, valor: lineas.reduce((s, l) => s + l.uf, 0) + co };
}

/** Lee la ficha de cada punto de la visita (una sola vez) y arma lo que necesitan la tabla de puntos y la matriz de precios. */
export function useDatosVisita(puntos: PuntoDeVisita[], version = 0): DatosVisita {
    const [res, setRes] = useState<Record<number, Resumen | null>>({});
    const clave = puntos.map((p) => p.id_fichaingresoservicio).join(',');
    useEffect(() => {
        let vivo = true;
        setRes({});
        puntos.forEach((p) => {
            const id = Number(p.id_fichaingresoservicio);
            fichaService.getById(id)
                .then((r: any) => {
                    const d = r?.data && r.success !== false ? r.data : r;
                    if (vivo) setRes((prev) => ({ ...prev, [id]: resumir(d) }));
                })
                .catch(() => { if (vivo) setRes((prev) => ({ ...prev, [id]: null })); });
        });
        return () => { vivo = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clave, version]);
    const ids = puntos.map((p) => Number(p.id_fichaingresoservicio));
    const cargados = ids.every((id) => res[id] !== undefined);
    const mismosAnalisis = useMemo(() => {
        const firmas = ids.map((id) => res[id]).filter((r): r is Resumen => !!r).map((r) => r.lineas.map((l) => l.clave).sort().join('|'));
        return firmas.length > 1 && new Set(firmas).size === 1;
    }, [res]); // eslint-disable-line react-hooks/exhaustive-deps
    return { ids, res, cargados, mismosAnalisis };
}

interface PropsTabla {
    puntos: PuntoDeVisita[];
    /** Ficha que se está mirando (la que muestran las demás pestañas). */
    activoId: number;
    onCambiar: (id: number) => void;
    datos: DatosVisita;
    /** Solo con FI_EXP_VER_UF (Comercial). Sin el permiso no se muestra ningún valor. */
    verPrecios?: boolean;
}

/** Tabla de los puntos de la visita: qué cambia de un punto a otro (nombre, zona/UTM, estado, valor). Un clic en una fila elige el punto. */
export const PuntosVisitaTabla: React.FC<PropsTabla> = ({ puntos, activoId, onCambiar, datos, verPrecios = false }) => {
    const { res, cargados, mismosAnalisis } = datos;
    return (
        <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h4 className="m-0 text-base font-semibold">Puntos de la visita ({puntos.length})</h4>
                {cargados && (
                    <span className="text-xs text-muted-foreground">
                        {mismosAnalisis ? `Todos los puntos llevan los mismos análisis; cambian el punto y la ubicación${verPrecios ? ' y el valor' : ''}.` : 'Los análisis no son iguales en todos los puntos.'}
                    </span>
                )}
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full border-collapse text-[13px]">
                    <thead>
                        <tr className="bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                            <th className="w-10 px-3 py-2">#</th>
                            <th className="px-3 py-2">Punto de muestreo</th>
                            <th className="px-3 py-2">Ficha</th>
                            <th className="px-3 py-2">Zona UTM</th>
                            <th className="px-3 py-2">Coordenadas</th>
                            <th className="px-3 py-2">Mapa</th>
                            <th className="px-3 py-2">Estado</th>
                            {verPrecios && <th className="px-3 py-2 text-right">Valor (UF)</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {puntos.map((p, i) => {
                            const id = Number(p.id_fichaingresoservicio);
                            const r = res[id];
                            const activo = id === Number(activoId);
                            return (
                                <tr
                                    key={id}
                                    role="button"
                                    tabIndex={0}
                                    aria-current={activo ? 'true' : undefined}
                                    onClick={() => { if (!activo) onCambiar(id); }}
                                    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !activo) { e.preventDefault(); onCambiar(id); } }}
                                    className={cn('cursor-pointer border-t border-border transition-colors hover:bg-muted/40', activo && 'bg-primary/10 font-medium')}
                                >
                                    <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                                    <td className="px-3 py-1.5">{p.punto || 'Sin nombre'}{activo && <span className="ml-2 text-[11px] font-normal text-primary">en pantalla</span>}</td>
                                    <td className="px-3 py-1.5 text-muted-foreground">N° {id}</td>
                                    <td className="px-3 py-1.5 text-muted-foreground">{r === undefined ? 'Cargando…' : r === null ? '—' : r.zona}</td>
                                    <td className="px-3 py-1.5 text-muted-foreground">{r ? (r.utm || '—') : '—'}</td>
                                    <td className="px-3 py-1.5">
                                        {r?.referencia
                                            ? <a href={r.referencia} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary underline-offset-2 hover:underline">Abrir</a>
                                            : <span className="text-muted-foreground">—</span>}
                                    </td>
                                    <td className="px-3 py-1.5"><Badge variant="secondary">{p.estado || '—'}</Badge></td>
                                    {verPrecios && <td className="px-3 py-1.5 text-right tabular-nums">{r ? formatoUF(r.valor) : '—'}</td>}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            <p className="mb-0 mt-2 text-xs text-muted-foreground">El punto «en pantalla» es el que muestran las pestañas Antecedentes y Validación e Historial. Para cambiarlo, haz clic en otra fila.</p>
        </section>
    );
};

/** Matriz de parámetros por punto con el precio de cada uno (solo lectura), como la de «Análisis y precio» al crear la visita. */
export const MatrizPrecioVisita: React.FC<{ puntos: PuntoDeVisita[]; datos: DatosVisita; verPrecios?: boolean }> = ({ puntos, datos, verPrecios = false }) => {
    const { ids, res, cargados } = datos;

    const matriz = useMemo(() => {
        const filas = new Map<string, { nombre: string; detalle: string; tipo: 'terreno' | 'laboratorio'; porPunto: Record<number, number> }>();
        ids.forEach((id) => (res[id]?.lineas || []).forEach((l) => {
            const f = filas.get(l.clave) || { nombre: l.nombre, detalle: l.detalle, tipo: l.tipo, porPunto: {} };
            f.porPunto[id] = (f.porPunto[id] || 0) + l.uf;
            filas.set(l.clave, f);
        }));
        const lista = [...filas.values()];
        return { terreno: lista.filter((f) => f.tipo === 'terreno'), laboratorio: lista.filter((f) => f.tipo === 'laboratorio') };
    }, [res]); // eslint-disable-line react-hooks/exhaustive-deps

    const total = ids.reduce((s, id) => s + (res[id]?.valor || 0), 0);
    const totalCo = ids.reduce((s, id) => s + (res[id]?.costoOperativo || 0), 0);

    const filasDe = (tipo: 'terreno' | 'laboratorio', titulo: string) => {
        const lista = matriz[tipo];
        if (lista.length === 0) return null;
        return (
            <React.Fragment key={tipo}>
                <tr><td colSpan={ids.length + (verPrecios ? 2 : 1)} className="bg-muted/40 px-3 py-1.5 text-xs font-semibold">{titulo}</td></tr>
                {lista.map((f) => (
                    <tr key={f.nombre + f.detalle} className="border-t border-border">
                        <td className="min-w-[200px] px-3 py-1.5">
                            <span className="font-medium">{f.nombre}</span>
                            {f.detalle && <span className="block text-[11px] text-muted-foreground">{f.detalle}</span>}
                        </td>
                        {ids.map((id) => (
                            <td key={id} className="px-3 py-1.5 text-right tabular-nums">
                                {f.porPunto[id] === undefined ? <span className="text-muted-foreground">—</span> : verPrecios ? formatoUF(f.porPunto[id]) : <span className="text-success" aria-label="Incluido">✓</span>}
                            </td>
                        ))}
                        {verPrecios && <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatoUF(Object.values(f.porPunto).reduce((a, b) => a + b, 0))}</td>}
                    </tr>
                ))}
            </React.Fragment>
        );
    };

    if (!cargados) return <p className="text-sm text-muted-foreground">Cargando los análisis de cada punto…</p>;
    return (
        <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-[13px]">
                <thead>
                    <tr className="text-left text-xs font-medium text-muted-foreground">
                        <th className="px-3 py-2">Parámetro</th>
                        {puntos.map((p) => <th key={p.id_fichaingresoservicio} className="max-w-[130px] truncate px-3 py-2 text-right" title={p.punto}>{p.punto || 'Sin nombre'}</th>)}
                        {verPrecios && <th className="px-3 py-2 text-right">Suma</th>}
                    </tr>
                </thead>
                <tbody>
                    {filasDe('terreno', 'Terreno')}
                    {filasDe('laboratorio', 'Laboratorio')}
                    {verPrecios && (<tr className="border-t border-border bg-muted/30">
                        <td className="px-3 py-1.5 font-medium">Costo operativo <span className="text-[11px] font-normal text-muted-foreground">(una parte por punto)</span></td>
                        {ids.map((id) => <td key={id} className="px-3 py-1.5 text-right tabular-nums">{formatoUF(res[id]?.costoOperativo || 0)}</td>)}
                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatoUF(totalCo)}</td>
                    </tr>)}
                </tbody>
                {verPrecios && <tfoot>
                    <tr className="border-t border-border bg-muted/40 font-bold">
                        <td className="px-3 py-1.5">Valor del punto · Total de la visita</td>
                        {ids.map((id) => <td key={id} className="px-3 py-1.5 text-right tabular-nums">{formatoUF(res[id]?.valor || 0)}</td>)}
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatoUF(total)}</td>
                    </tr>
                </tfoot>}
            </table>
        </div>
    );
};
