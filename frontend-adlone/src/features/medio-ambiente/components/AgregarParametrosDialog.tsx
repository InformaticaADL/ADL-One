import React, { useEffect, useMemo, useState } from 'react';

import { Radio } from '@/components/ui/radio';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { SelectBuscable } from './SelectBuscable';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
    LABORATORIOS_MAXIMOS,
    cantidadDePuntos,
    estaEn,
    idEntregaDirecta,
    type IdPunto,
    type NuevoParametro,
    type ParametroVisita,
    type TipoParametro,
} from '../utils/analisisVisita';

/** De dónde salen los catálogos (en la pantalla real, la API; en las pruebas, datos de ejemplo). */
export interface FuenteAnalisis {
    getNormativas: () => Promise<any[]>;
    getReferencias: (idNormativa: string) => Promise<any[]>;
    getAnalisis: (idNormativa: string, idReferencia: string) => Promise<any[]>;
    laboratorios: any[];
    tiposEntrega: any[];
}

interface Configuracion { ent: string; l1: string; l2: string }
const VACIA: Configuracion = { ent: '', l1: '', l2: '' };


interface Props {
    open: boolean;
    onOpenChange: (abierto: boolean) => void;
    tipo: TipoParametro;
    puntos: Array<{ id: IdPunto; nombre: string }>;
    puntoActual: IdPunto;
    parametros: ParametroVisita[];
    fuente: FuenteAnalisis;
    onAgregar: (nuevos: NuevoParametro[], donde: IdPunto[]) => void;
}

export const AgregarParametrosDialog: React.FC<Props> = ({ open, onOpenChange, tipo, puntos, puntoActual, parametros, fuente, onAgregar }) => {
    const esLab = tipo === 'laboratorio';
    const [normativas, setNormativas] = useState<any[]>([]);
    const [referencias, setReferencias] = useState<any[]>([]);
    const [resultados, setResultados] = useState<any[]>([]);
    const [normativa, setNormativa] = useState('');
    const [referencia, setReferencia] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [cargando, setCargando] = useState(false);
    const [marcados, setMarcados] = useState<Set<string>>(new Set());
    const [porDefecto, setPorDefecto] = useState<Configuracion>(VACIA);
    // Valores cambiados a mano en una fila: tienen prioridad sobre «por defecto» hasta que se cambie ese mismo campo arriba.
    const [propios, setPropios] = useState<Record<string, Partial<Configuracion>>>({});
    const [donde, setDonde] = useState<'todos' | 'pers' | null>(puntos.length > 1 ? null : 'todos');
    const [puntosElegidos, setPuntosElegidos] = useState<Set<IdPunto>>(() => new Set([puntoActual]));
    const variosPuntos = puntos.length > 1;

    // El diálogo se monta al abrirse (el padre no lo renderiza cerrado), así que parte de cero y solo carga las normativas.
    useEffect(() => {
        fuente.getNormativas().then((n) => setNormativas(n || [])).catch(() => setNormativas([]));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const elegirNormativa = (id: string) => {
        setNormativa(id); setReferencia(''); setReferencias([]); setResultados([]); setMarcados(new Set()); setPropios({});
        if (id) fuente.getReferencias(id).then((r) => setReferencias(r || [])).catch(() => setReferencias([]));
    };
    const elegirReferencia = (id: string) => {
        setReferencia(id); setResultados([]); setMarcados(new Set()); setPropios({});
        if (!normativa || !id) return;
        setCargando(true);
        fuente.getAnalisis(normativa, id).then((a) => setResultados(a || [])).catch(() => setResultados([])).finally(() => setCargando(false));
    };

    const destino = useMemo<IdPunto[]>(
        () => (donde === 'pers' ? puntos.filter((p) => puntosElegidos.has(p.id)).map((p) => p.id) : puntos.map((p) => p.id)),
        [donde, puntos, puntosElegidos],
    );

    const filtrados = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        return !q ? resultados : resultados.filter((a) => String(a.nombre_tecnica || '').toLowerCase().includes(q) || String(a.id_referenciaanalisis).includes(q));
    }, [resultados, busqueda]);

    const yaEsta = (a: any): boolean => {
        const existente = parametros.find((p) => p.tipo === tipo && p.base.id_referenciaanalisis === a.id_referenciaanalisis);
        return !!existente && destino.length > 0 && destino.every((id) => estaEn(existente, id));
    };
    const notaDe = (a: any): string => {
        const existente = parametros.find((p) => p.tipo === tipo && p.base.id_referenciaanalisis === a.id_referenciaanalisis);
        if (!existente) return '';
        if (yaEsta(a)) return donde === 'pers' ? 'ya está en los puntos elegidos' : 'ya está en todos los puntos';
        return `ya está en ${cantidadDePuntos(existente)} de ${puntos.length} puntos`;
    };

    const alternar = (a: any, marcar: boolean) => {
        const id = String(a.id_referenciaanalisis);
        setMarcados((prev) => { const s = new Set(prev); if (marcar) s.add(id); else s.delete(id); return s; });
        if (!marcar) setPropios((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== id)));
    };
    const marcarTodos = () => setMarcados(new Set(filtrados.filter((a) => !yaEsta(a)).map((a) => String(a.id_referenciaanalisis))));

    const efectivo = (id: string): Configuracion => ({ ...porDefecto, ...propios[id] });
    const cambiarDefecto = (campo: keyof Configuracion, valor: string) => {
        setPorDefecto((p) => ({ ...p, [campo]: valor }));
        // Cambiar un campo arriba lo aplica a todas las filas: se olvidan los cambios propios de ese campo.
        setPropios((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).filter(([c]) => c !== campo))])));
    };
    const cambiarFila = (id: string, campo: keyof Configuracion, valor: string) =>
        setPropios((prev) => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }));

    const faltantes = esLab ? [...marcados].filter((id) => { const c = efectivo(id); return !c.l1 || !c.ent; }) : [];
    const repetidos = esLab ? [...marcados].filter((id) => { const c = efectivo(id); return c.l2 && c.l2 === c.l1; }) : [];
    const sinDonde = donde === null || (donde === 'pers' && puntosElegidos.size === 0);
    const aAgregar = [...marcados].filter((id) => { const a = resultados.find((x) => String(x.id_referenciaanalisis) === id); return a && !yaEsta(a); });
    const puedeAgregar = aAgregar.length > 0 && faltantes.length === 0 && repetidos.length === 0 && !sinDonde;
    const motivo = sinDonde ? (donde === 'pers' ? 'Marque al menos un punto.' : 'Responda dónde se agregan.')
        : faltantes.length > 0 ? 'Falta elegir el tipo de entrega y el laboratorio 1.'
            : repetidos.length > 0 ? 'El laboratorio 2 no puede ser el mismo que el 1.'
                : aAgregar.length === 0 ? 'Nada marcado.' : `${aAgregar.length} marcado${aAgregar.length > 1 ? 's' : ''}`;

    const agregar = () => {
        const normObj = normativas.find((n) => String(n.id_normativa) === normativa);
        const refObj = referencias.find((r) => String(r.id_normativareferencia) === referencia);
        const entregaDirecta = idEntregaDirecta(fuente.tiposEntrega);
        const nuevos: NuevoParametro[] = aAgregar.map((id) => {
            const a = resultados.find((x) => String(x.id_referenciaanalisis) === id)!;
            const c = efectivo(id);
            return {
                tipo,
                fila: {
                    ...a,
                    id_normativa: normObj?.id_normativa ?? Number(normativa),
                    nombre_normativa: normObj?.nombre_normativa || '',
                    id_normativareferencia: refObj?.id_normativareferencia ?? Number(referencia),
                    nombre_normativareferencia: refObj?.nombre_normativareferencia || '',
                },
                idLab1: esLab ? Number(c.l1) : 0,
                idLab2: esLab && LABORATORIOS_MAXIMOS >= 2 ? Number(c.l2) || 0 : 0,
                idTipoEntrega: esLab ? Number(c.ent) : entregaDirecta,
                precio: 0,
            };
        });
        onAgregar(nuevos, destino);
        onOpenChange(false);
    };

    const opcionesLab = (excluir?: string) => fuente.laboratorios
        .filter((l) => String(l.id_laboratorioensayo) !== excluir)
        .map((l) => ({ value: String(l.id_laboratorioensayo), label: String(l.nombre_laboratorioensayo) }));
    const opcionesEntrega = fuente.tiposEntrega.map((t) => ({ value: String(t.id_tipoentrega), label: String(t.nombre_tipoentrega) }));

    // Las tres listas llevan buscador. El laboratorio 1 y el 2 no pueden ser el mismo: a cada una se le quita el de la otra.
    const controles = (valor: Configuracion, onCambio: (c: keyof Configuracion, v: string) => void) => (
        <>
            <SelectBuscable placeholder="Tipo de entrega…" valor={valor.ent} opciones={opcionesEntrega} onCambio={(v) => onCambio('ent', v)} />
            <SelectBuscable placeholder="Laboratorio 1…" valor={valor.l1} opciones={opcionesLab(valor.l2)} onCambio={(v) => onCambio('l1', v)} />
            {LABORATORIOS_MAXIMOS >= 2 && (
                <SelectBuscable
                    placeholder="Sin laboratorio 2"
                    valor={valor.l2}
                    opciones={[{ value: '', label: 'Sin laboratorio 2' }, ...opcionesLab(valor.l1)]}
                    onCambio={(v) => onCambio('l2', v)}
                />
            )}
        </>
    );
    const columnas = LABORATORIOS_MAXIMOS >= 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-[960px] flex-col gap-0 overflow-hidden p-0">
                <DialogHeader className="px-5 pb-2 pt-5">
                    <DialogTitle>{esLab ? 'Agregar parámetros de laboratorio' : 'Agregar parámetros de terreno'}</DialogTitle>
                    <DialogDescription>
                        {esLab
                            ? 'Elija normativa y tabla, marque los parámetros y defina el tipo de entrega y los laboratorios: el 1 es obligatorio; el 2, opcional.'
                            : 'Elija normativa y tabla y marque los parámetros. Los de terreno no llevan laboratorio ni tipo de entrega.'}
                    </DialogDescription>
                </DialogHeader>

                {esLab && (
                    <div className="border-y border-border bg-muted/40 px-5 py-3">
                        <p className="m-0 mb-2 text-xs text-muted-foreground"><b className="text-foreground">Por defecto para todos los marcados.</b> Cambie uno en su fila si es distinto.</p>
                        <div className={cn('grid grid-cols-1 gap-2', columnas)}>
                            {controles(porDefecto, cambiarDefecto)}
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto px-5 py-3">
                    <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <span className="mb-1 block text-xs text-muted-foreground">Normativa</span>
                            <Combobox placeholder="Seleccione normativa…" options={normativas.map((n) => ({ value: String(n.id_normativa), label: n.nombre_normativa }))} value={normativa || undefined} onValueChange={(v) => elegirNormativa(v || '')} />
                        </div>
                        <div>
                            <span className="mb-1 block text-xs text-muted-foreground">Tabla / referencia</span>
                            <Combobox placeholder="Seleccione tabla…" options={referencias.map((r) => ({ value: String(r.id_normativareferencia), label: r.nombre_normativareferencia }))} value={referencia || undefined} onValueChange={(v) => elegirReferencia(v || '')} disabled={!normativa} />
                        </div>
                    </div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Input className="h-8 max-w-[260px]" placeholder="Filtrar por nombre o código…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} disabled={!referencia} aria-label="Filtrar parámetros" />
                        <Button type="button" variant="outline" size="sm" onClick={marcarTodos} disabled={!referencia || filtrados.length === 0}>Marcar todos los de esta tabla</Button>
                        {marcados.size > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => { setMarcados(new Set()); setPropios({}); }}>Quitar marcas</Button>}
                    </div>

                    <div className="rounded-lg border border-border">
                        {cargando ? <p className="m-0 p-4 text-center text-sm text-muted-foreground">Cargando…</p>
                            : filtrados.length === 0 ? <p className="m-0 p-4 text-center text-sm text-muted-foreground">{normativa && referencia ? 'Sin resultados.' : 'Elija normativa y tabla.'}</p>
                                : filtrados.map((a) => {
                                    const id = String(a.id_referenciaanalisis);
                                    const ya = yaEsta(a);
                                    const marcado = marcados.has(id) && !ya;
                                    const nota = notaDe(a);
                                    return (
                                        <div key={id} className={cn('flex flex-wrap items-center gap-3 border-b border-border px-3 py-2 last:border-b-0', ya && 'opacity-50')}>
                                            <label className="flex min-w-[200px] flex-1 cursor-pointer items-center gap-3">
                                                <Checkbox checked={marcado || ya} disabled={ya} onCheckedChange={(v) => alternar(a, v === true)} aria-label={a.nombre_tecnica} />
                                                <span className="text-sm"><b className="font-semibold">{a.nombre_tecnica}</b>{nota && <small className="block text-xs text-muted-foreground">{nota}</small>}</span>
                                            </label>
                                            {esLab && marcado && (
                                                <div className={cn('grid w-full grid-cols-1 gap-2 sm:w-auto sm:min-w-[460px] sm:flex-1', columnas)}>
                                                    {controles(efectivo(id), (c, v) => cambiarFila(id, c, v))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                    </div>
                </div>

                {variosPuntos && (
                    <div className="border-t border-border bg-warning/10 px-5 py-3">
                        <p className="m-0 mb-1 text-sm font-semibold text-foreground">¿Dónde se agregan?</p>
                        <div role="radiogroup" aria-label="Dónde se agregan" className="flex flex-col">
                            <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-background/60"><Radio checked={donde === 'todos'} onChange={() => setDonde('todos')} /> 1. Todos los puntos</label>
                            <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-background/60"><Radio checked={donde === 'pers'} onChange={() => setDonde('pers')} /> 2. Personalizado</label>
                        </div>
                        {donde === 'pers' && (
                            <div className="ml-5 mt-1">
                                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 sm:grid-cols-3">
                                    {puntos.map((p) => (
                                        <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-background/60">
                                            <Checkbox className="size-5 [&_svg]:size-4" checked={puntosElegidos.has(p.id)} onCheckedChange={(v) => setPuntosElegidos((prev) => { const s = new Set(prev); if (v === true) s.add(p.id); else s.delete(p.id); return s; })} />
                                            {p.nombre || 'sin nombre'}
                                        </label>
                                    ))}
                                </div>
                                <div className="mt-2 flex gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={() => setPuntosElegidos(new Set(puntos.map((p) => p.id)))}>Marcar todos</Button>
                                    <Button type="button" variant="outline" size="sm" onClick={() => setPuntosElegidos(new Set())}>Quitar todos</Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter className="flex-row items-center justify-between gap-2 border-t border-border px-5 py-3 sm:justify-between">
                    <span className="text-sm text-muted-foreground">{motivo}</span>
                    <span className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button onClick={agregar} disabled={!puedeAgregar}>{aAgregar.length > 0 ? `Agregar ${aAgregar.length}` : 'Agregar'}</Button>
                    </span>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
