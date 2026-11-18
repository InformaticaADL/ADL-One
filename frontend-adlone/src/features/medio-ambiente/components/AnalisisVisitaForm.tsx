import React, { useMemo, useState } from 'react';
import { IconCopy, IconPlus, IconX } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
    LABORATORIOS_MAXIMOS,
    agregarParametros,
    aCentesimas,
    cantidadDePuntos,
    configurarFijo,
    copiarPuntoATodos,
    estaEn,
    formatoUF,
    parteDelCostoOperativo,
    repartirEnPunto,
    repartirVisita,
    seEnvia,
    sumaDeLosPuntos,
    totalDeLaVisita,
    totalDelPunto,
    valorDelPuntoConCosto,
    type NuevoParametro,
    type ParametroVisita,
    type PuntoFila,
    type TipoParametro,
} from '../utils/analisisVisita';
import { AgregarParametrosDialog, type FuenteAnalisis } from './AgregarParametrosDialog';
import { SelectBuscable } from './SelectBuscable';

/**
 * «Puntos y análisis» se reparte en dos pantallas con un solo trabajo cada una:
 *  - ParametrosVisitaForm: qué se mide en cada punto y en qué laboratorio (sin precios).
 *  - PrecioVisitaForm: la tarifa de cada parámetro en cada punto, el reparto rápido y el costo operativo.
 * El costo operativo es una línea más de la tabla (como un análisis) y entra al reparto rápido. El valor de un punto y el
 * total de la visita son SIEMPRE la suma de las tarifas.
 */

const claseInput = 'flex h-8 w-full rounded-md border border-border bg-background px-2 py-1 pr-8 text-right text-[13px] tabular-nums text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

const clonar = (params: ParametroVisita[]): ParametroVisita[] => params.map((p) => ({ ...p, base: { ...p.base }, en: { ...p.en }, u: { ...p.u } }));
const textoUF = (centesimas: number) => (centesimas / 100).toFixed(2).replace('.', ',');

const ConUF: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
    <span className={cn('relative inline-block', className)}>
        {children}
        <b className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground">UF</b>
    </span>
);

/** Campo de UF: se escribe con coma o punto, guarda centésimas y avisa en cada tecla. */
const CampoUF: React.FC<{ valor: number; onCambio: (centesimas: number) => void; ariaLabel: string; className?: string }> = ({ valor, onCambio, ariaLabel, className }) => {
    const [editando, setEditando] = useState<string | null>(null);
    return (
        <ConUF className={className}>
            <input
                data-uf
                inputMode="decimal"
                aria-label={ariaLabel}
                className={claseInput}
                value={editando ?? textoUF(valor)}
                onFocus={(e) => { setEditando(textoUF(valor)); e.currentTarget.select(); }}
                onBlur={() => setEditando(null)}
                onChange={(e) => { setEditando(e.target.value); onCambio(aCentesimas(e.target.value)); }}
            />
        </ConUF>
    );
};

/** Igual que CampoUF pero avisa solo al terminar (salir del campo o Enter), para poder pedir confirmación antes de cambiar nada. */
const CampoUFAlTerminar: React.FC<{ valor: number; onTerminar: (centesimas: number) => void; ariaLabel: string; title?: string; className?: string }> = ({ valor, onTerminar, ariaLabel, title, className }) => {
    const [editando, setEditando] = useState<string | null>(null);
    return (
        <ConUF className={className}>
            <input
                data-uf
                inputMode="decimal"
                aria-label={ariaLabel}
                title={title}
                className={cn(claseInput, 'font-semibold')}
                value={editando ?? textoUF(valor)}
                onFocus={(e) => { setEditando(textoUF(valor)); e.currentTarget.select(); }}
                onChange={(e) => setEditando(e.target.value)}
                onBlur={() => {
                    const c = editando === null ? valor : aCentesimas(editando);
                    setEditando(null);
                    if (c !== valor) onTerminar(c);
                }}
            />
        </ConUF>
    );
};

interface Confirmacion { titulo: string; texto: string; boton: string; alAceptar: () => void }

const DialogoConfirmar: React.FC<{ c: Confirmacion | null; onCerrar: () => void }> = ({ c, onCerrar }) => (
    <Dialog open={!!c} onOpenChange={(abierto) => { if (!abierto) onCerrar(); }}>
        <DialogContent className="max-w-[460px]">
            <DialogHeader>
                <DialogTitle>{c?.titulo}</DialogTitle>
                <DialogDescription>{c?.texto}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
                <Button onClick={() => { const f = c?.alAceptar; onCerrar(); f?.(); }}>{c?.boton}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);

const nombreDelPunto = (puntos: PuntoFila[], id: string) => puntos.find((p) => p.id === id)?.puntoMuestreo.trim() || `Punto ${puntos.findIndex((p) => p.id === id) + 1}`;
const tarifasConValor = (parametros: ParametroVisita[], ids: string[]) =>
    ids.reduce((n, id) => n + parametros.filter((p) => seEnvia(p) && estaEn(p, id) && (p.u[id] || 0) > 0).length, 0);

/** Estado de un punto para mostrarlo en la lista de puntos y en el encabezado. */
const estadoDelPunto = (parametros: ParametroVisita[], id: string): { nivel: 'ok' | 'error'; texto: string } => {
    const aqui = parametros.filter((p) => seEnvia(p) && estaEn(p, id));
    if (aqui.length === 0) return { nivel: 'error', texto: 'Sin parámetros' };
    const faltas = aqui.filter((p) => p.tipo === 'laboratorio' && (!p.idLab1 || !p.idTipoEntrega)).length;
    if (faltas > 0) return { nivel: 'error', texto: `Faltan datos de laboratorio (${faltas})` };
    return { nivel: 'ok', texto: `${aqui.length} ${aqui.length === 1 ? 'parámetro' : 'parámetros'}` };
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Pantalla «Parámetros»
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

interface PropsParametros {
    puntos: PuntoFila[];
    parametros: ParametroVisita[];
    onParametrosChange: (parametros: ParametroVisita[]) => void;
    fuente: FuenteAnalisis;
}

export const ParametrosVisitaForm: React.FC<PropsParametros> = ({ puntos, parametros, onParametrosChange, fuente }) => {
    const [activo, setActivo] = useState<string>(puntos[0]?.id || '');
    const [dialogo, setDialogo] = useState<TipoParametro | null>(null);
    const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);

    const ids = useMemo(() => puntos.map((p) => p.id), [puntos]);
    const idActivo = ids.includes(activo) ? activo : ids[0];
    const nombreDe = (id: string) => nombreDelPunto(puntos, id);

    const mutar = (fn: (copia: ParametroVisita[]) => ParametroVisita[] | void) => {
        const copia = clonar(parametros);
        const resultado = fn(copia);
        onParametrosChange(resultado || copia);
    };
    const alAgregar = (nuevos: NuevoParametro[], donde: string[]) => mutar((c) => agregarParametros(c, nuevos, donde, ids));
    const opcionesEntrega = fuente.tiposEntrega.map((t) => ({ value: String(t.id_tipoentrega), label: String(t.nombre_tipoentrega) }));
    // Un laboratorio no puede ser el 1 y el 2 a la vez: a cada lista se le quita el que eligió la otra.
    const opcionesLab = (excluir: number) => fuente.laboratorios
        .filter((l) => Number(l.id_laboratorioensayo) !== excluir)
        .map((l) => ({ value: String(l.id_laboratorioensayo), label: String(l.nombre_laboratorioensayo) }));

    const delPunto = parametros.filter((p) => estaEn(p, idActivo));
    const estadoActivo = estadoDelPunto(parametros, idActivo);

    const pedirCopia = () => {
        const otros = ids.length - 1;
        setConfirmacion({
            titulo: '¿Copiar este punto a los demás?',
            texto: `Los otros ${otros} ${otros === 1 ? 'punto quedará' : 'puntos quedarán'} con los mismos parámetros, laboratorios y tarifas que «${nombreDe(idActivo)}». Lo que tienen hoy se reemplaza.`,
            boton: 'Sí, copiar',
            alAceptar: () => mutar((c) => copiarPuntoATodos(c, idActivo, ids)),
        });
    };

    const seccion = (tipo: TipoParametro, titulo: string) => {
        const filas = delPunto.filter((p) => p.tipo === tipo);
        const lab = tipo === 'laboratorio';
        return (
            <div key={tipo}>
                <div className="flex items-center justify-between border-y border-border bg-muted/40 px-4 py-2">
                    <span className="text-sm font-semibold">
                        {titulo} <span className="font-normal text-muted-foreground">({filas.length}){lab ? '' : ' · se miden en el lugar'}</span>
                    </span>
                    <Button type="button" size="sm" onClick={() => setDialogo(tipo)}><IconPlus size={14} /> Agregar</Button>
                </div>
                {filas.length === 0 ? (
                    <p className="m-0 border-b border-border px-4 py-3 text-sm text-muted-foreground">Ninguno en este punto.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-[13.5px]">
                            <thead>
                                {lab && filas.length > 1 && (
                                    <tr className="bg-primary/[0.04]">
                                        <td className="border-b border-dashed border-primary/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">Aplicar a todos los parámetros de laboratorio de este punto</td>
                                        <td className="border-b border-dashed border-primary/30 px-3 py-1.5">
                                            <SelectBuscable placeholder="Entrega de todos…" valor="" opciones={opcionesEntrega}
                                                onCambio={(v) => { const n = Number(v) || 0; if (n) mutar((c) => { for (const q of c) if (q.tipo === 'laboratorio' && estaEn(q, idActivo)) q.idTipoEntrega = n; }); }} />
                                        </td>
                                        <td className="border-b border-dashed border-primary/30 px-3 py-1.5">
                                            <SelectBuscable placeholder="Laboratorio 1 de todos…" valor="" opciones={opcionesLab(0)}
                                                onCambio={(v) => { const n = Number(v) || 0; if (n) mutar((c) => { for (const q of c) if (q.tipo === 'laboratorio' && estaEn(q, idActivo)) { q.idLab1 = n; if (q.idLab2 === n) q.idLab2 = 0; } }); }} />
                                        </td>
                                        {LABORATORIOS_MAXIMOS >= 2 && (
                                            <td className="border-b border-dashed border-primary/30 px-3 py-1.5">
                                                <SelectBuscable placeholder="Laboratorio 2 de todos…" valor="" opciones={[{ value: '-1', label: 'Sin laboratorio 2 (quitar)' }, ...opcionesLab(0)]}
                                                    onCambio={(v) => { const n = Number(v); if (n) mutar((c) => { for (const q of c) if (q.tipo === 'laboratorio' && estaEn(q, idActivo) && (n === -1 || q.idLab1 !== n)) q.idLab2 = n === -1 ? 0 : n; }); }} />
                                            </td>
                                        )}
                                        <td className="border-b border-dashed border-primary/30" />
                                    </tr>
                                )}
                                <tr className="text-xs font-medium text-muted-foreground">
                                    <th className="border-b border-border px-3 py-1.5 text-left font-medium">Parámetro</th>
                                    {lab && <th className="whitespace-nowrap border-b border-border px-3 py-1.5 text-left font-medium">Entrega</th>}
                                    {lab && <th className="whitespace-nowrap border-b border-border px-3 py-1.5 text-left font-medium">Laboratorio 1</th>}
                                    {lab && LABORATORIOS_MAXIMOS >= 2 && <th className="whitespace-nowrap border-b border-border px-3 py-1.5 text-left font-medium">Laboratorio 2 <span className="font-normal">(opcional)</span></th>}
                                    <th className="w-9 border-b border-border" />
                                </tr>
                            </thead>
                            <tbody>
                                {filas.map((p) => {
                                    const sinLab = lab && seEnvia(p) && (!p.idLab1 || !p.idTipoEntrega);
                                    const enN = cantidadDePuntos(p);
                                    return (
                                        <tr key={p.id} className={cn('align-middle', sinLab && 'shadow-[inset_3px_0_0_var(--destructive)]')}>
                                            <td className="border-b border-border px-3 py-1.5">
                                                <div className="font-medium">{p.nombre}</div>
                                                <div className="text-[11.5px] text-muted-foreground">
                                                    {p.nombreNormativa || p.nombreTabla ? `${p.nombreNormativa} · ${p.nombreTabla}` : 'Sin normativa'}
                                                    {enN < ids.length && ` · en ${enN} de ${ids.length} puntos`}
                                                </div>
                                                {p.fijo && p.base.id_referenciaanalisis == null && (
                                                    <SelectBuscable
                                                        className="mt-1 max-w-[460px]"
                                                        placeholder="Elija normativa y tabla para incluirlo…"
                                                        valor=""
                                                        opciones={(p.opciones || []).map((o) => ({ value: String(o.id_referenciaanalisis), label: `${o.nombre_normativa} · ${o.nombre_normativareferencia}` }))}
                                                        onCambio={(v) => mutar((c) => { const q = c.find((x) => x.id === p.id); if (q) configurarFijo(q, v || null); })}
                                                    />
                                                )}
                                            </td>
                                            {lab && (
                                                <td className="border-b border-border px-3 py-1.5">
                                                    <SelectBuscable
                                                        placeholder="Elegir…"
                                                        invalido={!p.idTipoEntrega}
                                                        valor={p.idTipoEntrega ? String(p.idTipoEntrega) : ''}
                                                        opciones={opcionesEntrega}
                                                        onCambio={(v) => mutar((c) => { const q = c.find((x) => x.id === p.id); if (q) q.idTipoEntrega = Number(v) || 0; })}
                                                    />
                                                </td>
                                            )}
                                            {lab && (
                                                <td className="border-b border-border px-3 py-1.5">
                                                    <SelectBuscable
                                                        placeholder="Elegir…"
                                                        invalido={!p.idLab1}
                                                        valor={p.idLab1 ? String(p.idLab1) : ''}
                                                        opciones={opcionesLab(p.idLab2)}
                                                        onCambio={(v) => mutar((c) => { const q = c.find((x) => x.id === p.id); if (q) q.idLab1 = Number(v) || 0; })}
                                                    />
                                                </td>
                                            )}
                                            {lab && LABORATORIOS_MAXIMOS >= 2 && (
                                                <td className="border-b border-border px-3 py-1.5">
                                                    <SelectBuscable
                                                        placeholder="Sin laboratorio 2"
                                                        valor={p.idLab2 ? String(p.idLab2) : ''}
                                                        opciones={[{ value: '', label: 'Sin laboratorio 2' }, ...opcionesLab(p.idLab1)]}
                                                        onCambio={(v) => mutar((c) => { const q = c.find((x) => x.id === p.id); if (q) q.idLab2 = Number(v) || 0; })}
                                                    />
                                                </td>
                                            )}
                                            <td className="border-b border-border px-1 py-1.5 text-center">
                                                <button
                                                    type="button"
                                                    className="h-7 w-7 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                                    title={`Quitar solo de ${nombreDe(idActivo)}${enN > 1 ? ' (sigue en los otros puntos)' : ''}`}
                                                    aria-label={`Quitar ${p.nombre} de ${nombreDe(idActivo)}`}
                                                    onClick={() => mutar((c) => { const q = c.find((x) => x.id === p.id); if (q) q.en[idActivo] = false; return c.filter((x) => cantidadDePuntos(x) > 0); })}
                                                ><IconX size={16} className="mx-auto" /></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div>
            {/* Puntos: todos en una fila; el que tiene un problema lleva un aviso */}
            <div className="mb-3 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
                {puntos.map((p) => {
                    const e = estadoDelPunto(parametros, p.id);
                    const act = p.id === idActivo;
                    return (
                        <button
                            key={p.id}
                            type="button"
                            aria-pressed={act}
                            onClick={() => setActivo(p.id)}
                            className={cn(
                                'relative rounded-lg border bg-card px-2.5 py-1.5 text-left text-xs leading-snug transition-colors',
                                act ? 'border-primary bg-primary text-primary-foreground' : e.nivel === 'error' ? 'border-destructive/60 hover:bg-muted/60' : 'border-border hover:bg-muted/60',
                            )}
                        >
                            {e.nivel === 'error' && <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-destructive text-[11px] font-bold text-white">!</span>}
                            <b className="block break-words text-[13.5px] leading-tight" title={nombreDe(p.id)}>{nombreDe(p.id)}</b>
                            <span className={cn('block break-words text-[11.5px]', act ? 'opacity-85' : 'text-muted-foreground')}>{e.texto}</span>
                        </button>
                    );
                })}
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-2.5">
                    <h4 className="m-0 flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                        {nombreDe(idActivo)}
                        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', estadoActivo.nivel === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-success/15 text-success')}>{estadoActivo.texto}</span>
                    </h4>
                    {ids.length > 1 && (
                        <Button type="button" variant="outline" size="sm" onClick={pedirCopia}><IconCopy size={14} /> Copiar a los demás puntos</Button>
                    )}
                </div>
                {delPunto.filter(seEnvia).length === 0 && (
                    <p className="m-0 border-b border-border bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive">
                        Este punto no tiene parámetros. Agregue al menos uno de terreno o de laboratorio.
                    </p>
                )}
                {seccion('terreno', 'Terreno')}
                {seccion('laboratorio', 'Laboratorio')}
            </div>

            {dialogo && (
                <AgregarParametrosDialog
                    open
                    onOpenChange={(a) => { if (!a) setDialogo(null); }}
                    tipo={dialogo}
                    puntos={ids.map((id) => ({ id, nombre: nombreDe(id) }))}
                    puntoActual={idActivo}
                    parametros={parametros}
                    fuente={fuente}
                    onAgregar={alAgregar}
                />
            )}
            <DialogoConfirmar c={confirmacion} onCerrar={() => setConfirmacion(null)} />
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Pantalla «Precio»
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

interface PropsPrecio {
    puntos: PuntoFila[];
    parametros: ParametroVisita[];
    onParametrosChange: (parametros: ParametroVisita[]) => void;
    /** Costo operativo de la visita, en centésimas de UF. Una línea más de la tabla; cada punto lleva su parte. */
    costoOperativo: number;
    onCostoOperativoChange: (centesimas: number) => void;
}

export const PrecioVisitaForm: React.FC<PropsPrecio> = ({ puntos, parametros, onParametrosChange, costoOperativo, onCostoOperativoChange }) => {
    const [repartoTipo, setRepartoTipo] = useState<'visita' | 'punto'>('visita');
    const [repartoValor, setRepartoValor] = useState<number>(0);
    const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
    const matriz = React.useRef<HTMLDivElement>(null);

    const ids = useMemo(() => puntos.map((p) => p.id), [puntos]);
    const nombreDe = (id: string) => nombreDelPunto(puntos, id);
    const enviables = parametros.filter(seEnvia);

    const mutar = (fn: (copia: ParametroVisita[]) => ParametroVisita[] | void) => {
        const copia = clonar(parametros);
        const resultado = fn(copia);
        onParametrosChange(resultado || copia);
    };

    const total = totalDeLaVisita(enviables, ids, costoOperativo);
    const enCero = ids.filter((id) => valorDelPuntoConCosto(enviables, ids, id, costoOperativo) === 0);

    const pedirReparto = () => {
        if (repartoValor <= 0) return;
        const hacer = () => {
            const copia = clonar(parametros);
            const nuevoCosto = repartirVisita(copia, ids, { tipo: repartoTipo, valor: repartoValor });
            onParametrosChange(copia);
            onCostoOperativoChange(nuevoCosto);
        };
        const n = tarifasConValor(parametros, ids) + (costoOperativo > 0 ? 1 : 0);
        if (n === 0) { hacer(); return; }
        setConfirmacion({
            titulo: '¿Reemplazar las tarifas actuales?',
            texto: `Hay ${n} ${n === 1 ? 'tarifa con valor' : 'tarifas con valor'} (el costo operativo cuenta como una). Al repartir se reemplazan por partes iguales.`,
            boton: 'Sí, repartir',
            alAceptar: hacer,
        });
    };

    const pedirValorDelPunto = (id: string, valor: number) => {
        // El valor del punto incluye su parte del costo operativo: a los parámetros les queda el resto.
        const parte = parteDelCostoOperativo(costoOperativo, ids.length, Math.max(0, ids.indexOf(id)));
        const hacer = () => mutar((c) => { repartirEnPunto(c, id, Math.max(0, valor - parte)); });
        const n = tarifasConValor(parametros, [id]);
        if (n === 0) { hacer(); return; }
        setConfirmacion({
            titulo: '¿Reemplazar las tarifas de este punto?',
            texto: `«${nombreDe(id)}» tiene ${n} ${n === 1 ? 'tarifa con valor' : 'tarifas con valor'}. El nuevo valor (con su parte del costo operativo) se reparte en partes iguales entre sus parámetros.`,
            boton: 'Sí, reemplazar',
            alAceptar: hacer,
        });
    };

    // «Enter» en una tarifa pasa a la siguiente de la tabla.
    const alTeclear = (e: React.KeyboardEvent) => {
        const el = e.target as HTMLElement;
        if (e.key !== 'Enter' || !el.hasAttribute('data-uf')) return;
        e.preventDefault();
        const lista = Array.from(matriz.current?.querySelectorAll<HTMLInputElement>('[data-uf]') || []);
        const i = lista.indexOf(el as HTMLInputElement);
        (el as HTMLInputElement).blur();
        if (i >= 0 && lista[i + 1]) lista[i + 1].focus();
    };

    const filasDe = (tipo: TipoParametro, titulo: string) => {
        const l = enviables.filter((p) => p.tipo === tipo);
        if (l.length === 0) return null;
        return (
            <React.Fragment key={tipo}>
                <tr>
                    <td colSpan={ids.length + 2} className="sticky left-0 bg-muted/40 px-3 py-1.5 text-xs font-semibold">{titulo}</td>
                </tr>
                {l.map((p) => (
                    <tr key={p.id}>
                        <td className="sticky left-0 z-[1] min-w-[150px] border-b border-border bg-card px-3 py-1.5">{p.nombre}</td>
                        {ids.map((id) => (
                            <td key={id} className="border-b border-border px-1.5 py-1 text-right">
                                {estaEn(p, id)
                                    ? <CampoUF className="w-[88px]" valor={p.u[id] || 0} ariaLabel={`Tarifa de ${p.nombre} en ${nombreDe(id)}`} onCambio={(c) => mutar((q) => { const x = q.find((y) => y.id === p.id); if (x) x.u[id] = c; })} />
                                    : <span className="text-muted-foreground">—</span>}
                            </td>
                        ))}
                        <td className="sticky right-0 border-b border-border bg-card px-3 py-1.5 text-right font-semibold tabular-nums">
                            {formatoUF(ids.reduce((s, id) => s + (estaEn(p, id) ? p.u[id] || 0 : 0), 0))}
                        </td>
                    </tr>
                ))}
            </React.Fragment>
        );
    };

    return (
        <div ref={matriz} onKeyDown={alTeclear}>
            <div className="mb-3.5 overflow-hidden rounded-xl border border-border">
                <div className="flex flex-wrap items-end gap-x-4 gap-y-2.5 px-4 py-3">
                    <label className="text-xs text-muted-foreground">Partir de
                        <select className="mt-1 block h-9 w-[210px] rounded-md border border-border bg-background px-2 text-sm text-foreground" value={repartoTipo} onChange={(e) => setRepartoTipo(e.target.value as 'visita' | 'punto')}>
                            <option value="visita">Valor de toda la visita</option>
                            <option value="punto">Valor de cada punto</option>
                        </select>
                    </label>
                    <label className="text-xs text-muted-foreground">Valor
                        <div className="mt-1"><CampoUF className="w-[120px]" valor={repartoValor} ariaLabel="Valor para repartir" onCambio={setRepartoValor} /></div>
                    </label>
                    <Button type="button" onClick={pedirReparto} disabled={repartoValor <= 0}>Repartir</Button>
                    <span className="min-w-[200px] flex-1 text-xs text-muted-foreground">El costo operativo entra al reparto como un parámetro más. Es solo el punto de partida: después ajuste cada tarifa.</span>
                </div>
            </div>

            {enCero.length > 0 && (
                <p className="mb-3 rounded-md bg-warning/10 px-3 py-2 text-[13px] text-warning">
                    {enCero.map(nombreDe).join(', ')} {enCero.length > 1 ? 'están' : 'está'} en 0,00 UF. Se puede crear igual.
                </p>
            )}

            <div className="overflow-hidden rounded-xl border border-border">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[13.5px]">
                        <thead>
                            <tr className="text-xs font-medium text-muted-foreground">
                                <th className="sticky left-0 z-[1] border-b border-border bg-card px-3 py-1.5 text-left font-medium">Parámetro</th>
                                {ids.map((id) => <th key={id} title={nombreDe(id)} className="max-w-[120px] truncate border-b border-border px-2 py-1.5 text-right font-medium">{nombreDe(id)}</th>)}
                                <th className="sticky right-0 z-[1] border-b border-border bg-card px-3 py-1.5 text-right font-medium">Suma</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filasDe('terreno', 'Terreno')}{filasDe('laboratorio', 'Laboratorio')}
                            <tr>
                                <td colSpan={ids.length + 2} className="sticky left-0 bg-muted/40 px-3 py-1.5 text-xs font-semibold">Costo operativo</td>
                            </tr>
                            <tr>
                                <td className="sticky left-0 z-[1] min-w-[150px] border-b border-border bg-card px-3 py-1.5" title="Es uno por visita; cada punto lleva una parte igual.">Costo operativo de la visita</td>
                                {ids.map((id, i) => (
                                    <td key={id} className="border-b border-border px-3 py-1 text-right tabular-nums text-muted-foreground" title="Parte de este punto">{formatoUF(parteDelCostoOperativo(costoOperativo, ids.length, i))}</td>
                                ))}
                                <td className="sticky right-0 border-b border-border bg-card px-1.5 py-1 text-right">
                                    <CampoUF className="w-[88px]" valor={costoOperativo} ariaLabel="Costo operativo de la visita" onCambio={onCostoOperativoChange} />
                                </td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr className="bg-muted/40 font-bold">
                                <td className="sticky left-0 z-[1] min-w-[150px] bg-muted px-3 py-1.5">Valor del punto · Total de la visita</td>
                                {ids.map((id) => (
                                    <td key={id} className="px-1.5 py-1 text-right">
                                        <CampoUFAlTerminar className="w-[88px]" valor={valorDelPuntoConCosto(enviables, ids, id, costoOperativo)} ariaLabel={`Valor de ${nombreDe(id)}`} title="Es la suma de sus parámetros más su parte del costo operativo. Si lo escribe, se reparte en partes iguales." onTerminar={(c) => pedirValorDelPunto(id, c)} />
                                    </td>
                                ))}
                                <td className="sticky right-0 bg-muted px-3 py-1.5 text-right tabular-nums" title="Total de la visita">{formatoUF(total)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            <DialogoConfirmar c={confirmacion} onCerrar={() => setConfirmacion(null)} />
        </div>
    );
};
