import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { fichaService } from '../services/ficha.service';

export interface MuestreadorAgenda {
    id: number;
    nombre: string;
}

interface Props {
    muestreadores: MuestreadorAgenda[];
    /** Hay puntos marcados en la lista: un clic en un día agenda lo marcado en vez de mostrar el detalle. */
    hayAsignacion: boolean;
    /** Se eligió el día de un muestreador para lo marcado (fecha en formato yyyy-mm-dd). */
    onElegirDia: (idMuestreador: number, fechaYmd: string) => void;
    /** Cambia cuando hay que volver a leer la agenda (ej. después de agendar). */
    recarga?: number;
    /** Se soltó una visita ya agendada sobre otro muestreador y/o día. Quien llama confirma y reprograma. */
    onMoverVisita?: (visita: VisitaAgenda, idMuestreador: number, fechaYmd: string) => void;
}

export interface VisitaAgenda {
    key: string;
    mu: number;
    fecha: string;
    centro: string;
    cliente: string;
    puntos: number;
    ejecutada: boolean;
    /** Filas de la agenda que forman la visita (un punto por fila). */
    filas: any[];
    /** Se puede mover arrastrándola: no está ejecutada y su retiro cae el mismo día (puntual). */
    movible: boolean;
}
type Visita = VisitaAgenda;

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sumarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const lunesDe = (d: Date) => sumarDias(new Date(d.getFullYear(), d.getMonth(), d.getDate()), -((d.getDay() + 6) % 7));
const CORTO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const LARGO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const fechaCorta = (d: Date) => d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });

const nivelDe = (visitas: number, puntos: number) => {
    if (visitas === 0) return '';
    if (puntos >= 9 || visitas >= 3) return 'bg-primary/30';
    if (puntos >= 4 || visitas >= 2) return 'bg-primary/20';
    return 'bg-primary/10';
};

/**
 * Agenda de los muestreadores: la semana compacta (una fila baja por muestreador, con la carga de cada día) y el día por columnas.
 * Con puntos marcados en la lista, elegir un día de un muestreador abre «Agendar y asignar» con esa fecha y ese responsable.
 */
export const AgendaMuestreadores: React.FC<Props> = ({ muestreadores, hayAsignacion, onElegirDia, recarga = 0, onMoverVisita }) => {
    const [vista, setVista] = useState<'semana' | 'dia'>('semana');
    const [inicio, setInicio] = useState(() => lunesDe(new Date()));
    const [diaSel, setDiaSel] = useState(() => ymd(new Date()));
    const [filas, setFilas] = useState<any[]>([]);
    const [cargando, setCargando] = useState(false);
    const [busca, setBusca] = useState('');
    const [soloCarga, setSoloCarga] = useState(false);
    const [orden, setOrden] = useState<'nombre' | 'carga'>('nombre');
    const [detalle, setDetalle] = useState<{ mu: number; fecha: string } | null>(null);
    const arrastrando = useRef<Visita | null>(null);
    const [sobre, setSobre] = useState<string | null>(null);
    const [moviendo, setMoviendo] = useState<Visita | null>(null);
    const [movMu, setMovMu] = useState('');
    const [movFecha, setMovFecha] = useState('');
    const abrirMover = (v: Visita) => { setMoviendo(v); setMovMu(String(v.mu)); setMovFecha(v.fecha); };
    const confirmarMover = () => {
        if (moviendo && movMu && movFecha) onMoverVisita?.(moviendo, Number(movMu), movFecha);
        setMoviendo(null);
    };
    const botonMover = (v: Visita, clase?: string) => (onMoverVisita && !v.ejecutada ? (
        <Button size="sm" variant="outline" className={clase} disabled={!v.movible} title={v.movible ? 'Cambiar de día o de muestreador' : 'No se puede mover desde aquí: su retiro cae otro día. Reagéndala desde el detalle de la ficha.'} onClick={() => abrirMover(v)}>
            Mover…
        </Button>
    ) : null);

    const fin = useMemo(() => sumarDias(inicio, 6), [inicio]);
    const desde = ymd(inicio);
    const hasta = ymd(fin);

    useEffect(() => {
        let vivo = true;
        (async () => {
            setCargando(true);
            try {
                // La semana puede cruzar de mes: se leen los dos.
                const meses = new Map<string, [number, number]>();
                [inicio, fin].forEach((d) => meses.set(`${d.getFullYear()}-${d.getMonth() + 1}`, [d.getMonth() + 1, d.getFullYear()]));
                const respuestas = await Promise.all([...meses.values()].map(([m, a]) => fichaService.getEnProceso(m, a)));
                const todas = respuestas.flatMap((r: any) => (Array.isArray(r) ? r : (r?.data ?? [])));
                const vistos = new Set<unknown>();
                const unicas = todas.filter((r: any) => {
                    if (vistos.has(r.id_agenda)) return false;
                    vistos.add(r.id_agenda);
                    return true;
                });
                if (vivo) setFilas(unicas);
            } catch (error) {
                console.error('Error cargando la agenda de muestreadores:', error);
                if (vivo) setFilas([]);
            } finally {
                if (vivo) setCargando(false);
            }
        })();
        return () => { vivo = false; };
    }, [inicio, fin, recarga]);

    // Si se cambia de semana, el día elegido de la vista Día pasa al primero de esa semana.
    useEffect(() => {
        if (diaSel < desde || diaSel > hasta) setDiaSel(desde);
        setDetalle(null);
    }, [desde, hasta]); // eslint-disable-line react-hooks/exhaustive-deps

    const visitas = useMemo(() => {
        const mapa = new Map<string, Visita>();
        filas.forEach((r) => {
            const mu = Number(r.id_muestreador);
            if (!mu || r.motivo_cancelacion) return;
            const fecha = String(r.fecha || '').slice(0, 10);
            if (!fecha || fecha < desde || fecha > hasta) return;
            const servicio = String(r.correlativo || '').split('-')[1] || '';
            const clave = `${mu}|${fecha}|${Number(r.id_grupo) ? `g${r.id_grupo}-${servicio}` : `a${r.id_agenda}`}`;
            const v = mapa.get(clave) || { key: clave, mu, fecha, centro: String(r.centro || 'Sin centro').trim(), cliente: String(r.cliente || r.empresa_servicio || '').trim(), puntos: 0, ejecutada: true, filas: [], movible: true };
            v.puntos += 1;
            v.filas.push(r);
            if (!(String(r.instalacion_completado) === 'S' && String(r.retiro_completado) === 'S')) v.ejecutada = false;
            const retiro = String(r.fecha_retiro || '').slice(0, 10);
            if (String(r.instalacion_completado) === 'S' || (retiro && !retiro.startsWith('1900') && retiro !== fecha)) v.movible = false;
            mapa.set(clave, v);
        });
        return [...mapa.values()];
    }, [filas, desde, hasta]);

    const porCelda = useMemo(() => {
        const m = new Map<string, Visita[]>();
        visitas.forEach((v) => m.set(`${v.mu}|${v.fecha}`, [...(m.get(`${v.mu}|${v.fecha}`) || []), v]));
        return m;
    }, [visitas]);
    const deCelda = (mu: number, fecha: string) => porCelda.get(`${mu}|${fecha}`) || [];
    const puntosDe = (mu: number, fecha?: string) => visitas.filter((v) => v.mu === mu && (!fecha || v.fecha === fecha)).reduce((s, v) => s + v.puntos, 0);
    const nVisitasDe = (mu: number, fecha?: string) => visitas.filter((v) => v.mu === mu && (!fecha || v.fecha === fecha)).length;

    // Lunes a viernes siempre; sábado y domingo solo si alguien tiene visitas.
    const dias = useMemo(() => {
        const todos = Array.from({ length: 7 }, (_, i) => { const d = sumarDias(inicio, i); return { fecha: ymd(d), d, corto: CORTO[i], largo: LARGO[i] }; });
        return todos.filter((x, i) => i < 5 || visitas.some((v) => v.fecha === x.fecha));
    }, [inicio, visitas]);

    const lista = useMemo(() => {
        let l = muestreadores.filter((m) => !busca.trim() || m.nombre.toLowerCase().includes(busca.trim().toLowerCase()));
        if (soloCarga) l = l.filter((m) => nVisitasDe(m.id) > 0);
        l = [...l].sort((a, b) => (orden === 'carga' ? puntosDe(a.id) - puntosDe(b.id) : 0) || a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
        return l;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [muestreadores, busca, soloCarga, orden, visitas]);

    // Soltar sobre un día de un muestreador: puntos de la lista (agendar) o una visita ya agendada (reasignar).
    const zona = (mu: number, fecha: string) => {
        const clave = mu + '|' + fecha;
        const acepta = (e: React.DragEvent) => e.dataTransfer.types.includes('text/adl-visita') || (hayAsignacion && e.dataTransfer.types.includes('text/adl-asignar'));
        return {
            onDragOver: (e: React.DragEvent) => { if (acepta(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (sobre !== clave) setSobre(clave); } },
            onDragLeave: () => setSobre((prev) => (prev === clave ? null : prev)),
            onDrop: (e: React.DragEvent) => {
                setSobre(null);
                if (e.dataTransfer.types.includes('text/adl-visita') && arrastrando.current) {
                    e.preventDefault();
                    const v = arrastrando.current;
                    arrastrando.current = null;
                    if (v.mu === mu && v.fecha === fecha) return;
                    onMoverVisita?.(v, mu, fecha);
                } else if (hayAsignacion && e.dataTransfer.types.includes('text/adl-asignar')) {
                    e.preventDefault();
                    onElegirDia(mu, fecha);
                }
            },
        };
    };
    const arrastrable = (v: Visita) => (onMoverVisita && !v.ejecutada ? {
        draggable: true,
        onDragStart: (e: React.DragEvent) => { arrastrando.current = v; e.dataTransfer.setData('text/adl-visita', v.key); e.dataTransfer.effectAllowed = 'move'; },
        onDragEnd: () => { arrastrando.current = null; setSobre(null); },
    } : {});

    const elegirCelda = (mu: number, fecha: string) => {
        if (hayAsignacion) onElegirDia(mu, fecha);
        else setDetalle((prev) => (prev && prev.mu === mu && prev.fecha === fecha ? null : { mu, fecha }));
    };

    const titulo = vista === 'semana'
        ? `${fechaCorta(inicio)} al ${fechaCorta(fin)}`
        : (() => { const d = dias.find((x) => x.fecha === diaSel); return d ? `${d.largo} ${fechaCorta(d.d)}` : ''; })();

    const conVisitasDia = lista.filter((m) => nVisitasDe(m.id, diaSel) > 0);
    const libresDia = lista.filter((m) => nVisitasDe(m.id, diaSel) === 0);
    const nombreDe = (mu: number) => muestreadores.find((m) => m.id === mu)?.nombre || `Muestreador ${mu}`;

    return (
        <Card className="flex min-h-0 flex-col p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <Tabs value={vista} onValueChange={(v) => setVista(v as 'semana' | 'dia')}>
                    <TabsList>
                        <TabsTrigger value="semana">Semana</TabsTrigger>
                        <TabsTrigger value="dia">Día</TabsTrigger>
                    </TabsList>
                </Tabs>
                <span className="text-sm font-semibold">{titulo}</span>
                <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon-xs" aria-label="Semana anterior" onClick={() => setInicio((i) => sumarDias(i, -7))}><IconChevronLeft size={14} /></Button>
                    <Button variant="outline" size="sm" onClick={() => { setInicio(lunesDe(new Date())); setDiaSel(ymd(new Date())); }}>Hoy</Button>
                    <Button variant="outline" size="icon-xs" aria-label="Semana siguiente" onClick={() => setInicio((i) => sumarDias(i, 7))}><IconChevronRight size={14} /></Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
                <Input className="h-8 w-44" placeholder="Buscar muestreador..." aria-label="Buscar muestreador" value={busca} onChange={(e) => setBusca(e.target.value)} />
                <div className="flex items-center gap-2">
                    <Checkbox id="solo-carga" checked={soloCarga} onCheckedChange={(v) => setSoloCarga(!!v)} />
                    <Label htmlFor="solo-carga" className="text-sm font-normal">Solo con carga</Label>
                </div>
                <Combobox
                    className="h-8 w-48"
                    options={[{ value: 'nombre', label: 'Orden por nombre' }, { value: 'carga', label: 'Menos carga primero' }]}
                    value={orden}
                    onValueChange={(v) => setOrden((v as 'nombre' | 'carga') || 'nombre')}
                />
                <span className="ms-auto text-xs text-muted-foreground">
                    {vista === 'semana' ? `${lista.length} de ${muestreadores.length} muestreadores` : `${conVisitasDia.length} con visitas · ${libresDia.length} disponibles`}
                </span>
            </div>

            <p className="m-0 px-4 py-2 text-xs text-muted-foreground">
                {hayAsignacion
                    ? 'Arrastra los puntos marcados a un día de un muestreador, o haz clic en el día.'
                    : vista === 'semana'
                        ? 'Arrastra puntos de la lista a un día para agendarlos. Para mover una visita, haz clic en su celda y usa «Mover…» (o arrástrala).'
                        : 'Usa «Mover…» en una visita (o arrástrala a otra columna) para cambiar de responsable o de día.'}
            </p>

            <div className="relative">
                {cargando && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                )}

                {vista === 'semana' ? (
                    <>
                        <Table containerClassName="max-h-[460px]">
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="sticky left-0 z-10 min-w-44 bg-background">Muestreador</TableHead>
                                    {dias.map((d) => <TableHead key={d.fecha} className="min-w-24">{d.corto} {d.d.getDate()}</TableHead>)}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {lista.length === 0 ? (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={dias.length + 1} className="h-20 text-center text-sm text-muted-foreground">Ningún muestreador coincide con el filtro.</TableCell>
                                    </TableRow>
                                ) : lista.map((m) => (
                                    <TableRow key={m.id}>
                                        <TableCell className="sticky left-0 z-10 bg-background py-1.5">
                                            <div className="text-sm font-medium leading-tight">{m.nombre}</div>
                                            <div className="text-xs text-muted-foreground">{nVisitasDe(m.id)} visitas · {puntosDe(m.id)} pts</div>
                                        </TableCell>
                                        {dias.map((d) => {
                                            const v = nVisitasDe(m.id, d.fecha);
                                            const p = puntosDe(m.id, d.fecha);
                                            const activa = detalle && detalle.mu === m.id && detalle.fecha === d.fecha;
                                            return (
                                                <TableCell key={d.fecha} className="p-1">
                                                    <button
                                                        type="button"
                                                        {...zona(m.id, d.fecha)}
                                                        onClick={() => elegirCelda(m.id, d.fecha)}
                                                        aria-label={`${m.nombre}, ${d.largo} ${d.d.getDate()}: ${v} visitas`}
                                                        className={cn(
                                                            'flex h-10 w-full flex-col justify-center rounded-md px-2 text-left text-xs transition-colors hover:ring-2 hover:ring-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                                            nivelDe(v, p),
                                                            (activa || sobre === m.id + '|' + d.fecha) && 'ring-2 ring-primary'
                                                        )}
                                                    >
                                                        {v ? <span><strong className="text-sm">{v}</strong> {v === 1 ? 'visita' : 'visitas'} · {p} pts</span> : <span className="text-muted-foreground">—</span>}
                                                    </button>
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        <div className="flex flex-wrap items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground">
                            <span>Celda: visitas · puntos</span>
                            <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded-sm bg-primary/10" /> poca carga</span>
                            <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded-sm bg-primary/20" /> normal</span>
                            <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded-sm bg-primary/30" /> alta</span>
                        </div>

                        {detalle && (
                            <div className="border-t border-border px-4 py-3">
                                <div className="mb-1 flex items-center justify-between">
                                    <strong className="text-sm">{nombreDe(detalle.mu)} · {detalle.fecha.split('-').reverse().join('-')}</strong>
                                    <Button variant="ghost" size="sm" onClick={() => setDetalle(null)}>Cerrar</Button>
                                </div>
                                {deCelda(detalle.mu, detalle.fecha).length === 0 ? (
                                    <p className="m-0 text-sm text-muted-foreground">Sin visitas este día. Marca puntos en la lista y haz clic en la celda para agendarlos.</p>
                                ) : deCelda(detalle.mu, detalle.fecha).map((v) => (
                                    <div key={v.key} {...arrastrable(v)} className={cn('flex items-center justify-between gap-3 border-t border-border py-2 first:border-t-0', !v.ejecutada && onMoverVisita && 'cursor-grab')} title={!v.ejecutada && onMoverVisita ? (v.movible ? 'Arrástrala a otro día o muestreador' : 'Esta visita no se puede mover desde aquí') : undefined}>
                                        <div className="min-w-0">
                                            <p className="m-0 truncate text-sm font-medium">{v.centro}</p>
                                            <p className="m-0 truncate text-xs text-muted-foreground">{v.cliente || 'Sin cliente'} · {v.puntos} {v.puntos === 1 ? 'punto' : 'puntos'}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant={v.ejecutada ? 'success' : 'secondary'}>{v.ejecutada ? 'Ejecutada' : 'Agendada'}</Badge>
                                            {botonMover(v)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="flex flex-wrap gap-1.5 px-4 pb-1 pt-3">
                            {dias.map((d) => (
                                <Button key={d.fecha} size="sm" variant={d.fecha === diaSel ? 'default' : 'outline'} onClick={() => setDiaSel(d.fecha)}>{d.corto} {d.d.getDate()}</Button>
                            ))}
                        </div>
                        <div className="flex items-start gap-2.5 overflow-x-auto px-4 py-3">
                            {conVisitasDia.length === 0 ? (
                                <p className="m-0 py-4 text-sm text-muted-foreground">Nadie tiene visitas este día.</p>
                            ) : conVisitasDia.map((m) => (
                                <div key={m.id} {...zona(m.id, diaSel)} className={cn('w-52 shrink-0 rounded-lg bg-muted p-2.5 transition-shadow', sobre === m.id + '|' + diaSel && 'ring-2 ring-primary')}>
                                    <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                                        <strong className="truncate">{m.nombre}</strong>
                                        <span className="shrink-0 text-xs text-muted-foreground">{puntosDe(m.id, diaSel)} pts</span>
                                    </div>
                                    {deCelda(m.id, diaSel).map((v) => (
                                        <div key={v.key} {...arrastrable(v)} className={cn('mb-1.5 rounded-md border border-border border-l-[3px] border-l-primary bg-background px-2.5 py-2 text-xs', !v.ejecutada && onMoverVisita && 'cursor-grab')}>
                                            <strong className="block text-sm">{v.centro}</strong>
                                            {v.puntos} {v.puntos === 1 ? 'punto' : 'puntos'}{v.ejecutada ? ' · ejecutada' : ''}
                                            {botonMover(v, 'mt-1.5 h-7 w-full')}
                                        </div>
                                    ))}
                                    {hayAsignacion && (
                                        <Button size="sm" variant="outline" className="mt-1 w-full" onClick={() => onElegirDia(m.id, diaSel)}>Agendar aquí</Button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-4 py-3 text-sm">
                            <strong>Disponibles el {dias.find((x) => x.fecha === diaSel)?.largo.toLowerCase()}:</strong>
                            {libresDia.length === 0 ? <span className="text-muted-foreground">nadie</span> : libresDia.map((m) => (
                                <Button key={m.id} size="sm" variant="outline" {...zona(m.id, diaSel)} className={cn(sobre === m.id + '|' + diaSel && 'ring-2 ring-primary', !hayAsignacion && 'opacity-70')} title={hayAsignacion ? 'Agendar los puntos marcados con este muestreador' : 'Arrastra aquí puntos de la lista o una visita'} onClick={() => { if (hayAsignacion) onElegirDia(m.id, diaSel); }}>
                                    {m.nombre}
                                </Button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <Dialog open={moviendo !== null} onOpenChange={(o) => { if (!o) setMoviendo(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Mover visita</DialogTitle>
                        <DialogDescription>
                            {moviendo ? `${moviendo.centro} · ${moviendo.puntos} ${moviendo.puntos === 1 ? 'punto' : 'puntos'}` : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                        <div>
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Responsable</Label>
                            <Combobox options={muestreadores.map((m) => ({ value: String(m.id), label: m.nombre }))} value={movMu} onValueChange={setMovMu} placeholder="Seleccionar responsable..." searchPlaceholder="Buscar responsable..." />
                        </div>
                        <div>
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Fecha de muestreo</Label>
                            <DatePicker value={movFecha} onChange={setMovFecha} placeholder="Seleccionar fecha" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMoviendo(null)}>Cancelar</Button>
                        <Button onClick={confirmarMover} disabled={!movMu || !movFecha || (moviendo !== null && movMu === String(moviendo.mu) && movFecha === moviendo.fecha)}>Mover</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
};
