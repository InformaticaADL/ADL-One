import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconCalendarPlus, IconCheck, IconPencil, IconPlus, IconLock, IconX, IconAlertTriangle, IconArrowUpRight, IconArrowDownRight, IconEqual } from '@tabler/icons-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '../../../../contexts/ToastContext';
import {
    verificacionTemperaturaService as api,
    type ErroresPatron, type ErrorPatronRegistro, type ErrorPatronEntrada,
} from '../../services/verificacionTemperatura.service';
import { useAccionesVerifTemp } from './useAccionesVerifTemp';
import { fmtFecha, fmtNum, hoyYmd } from '../../utils/verificacionTemperatura';

// Tabla "Errores de patrón" de la planilla: por año, la última calibración de
// cada termómetro patrón y su error a 0, 15 y 30 °C. El año más reciente de
// cada patrón es el que usan las fichas nuevas (el backend lo copia al equipo).

interface Fila {
    id_equipo: number;
    anio: number;
    fecha_calibracion: string;
    error0: string;
    error15: string;
    error30: string;
    valido_hasta: string;
}

// La planilla calcula "Válido hasta" como calibración + 365 días.
const mas365 = (ymd: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
    const d = new Date(`${ymd}T12:00:00`);
    d.setDate(d.getDate() + 365);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const txt = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n).replace('.', ','));
const aEntrada = (f: Fila): ErrorPatronEntrada => ({
    id_equipo: f.id_equipo,
    anio: f.anio,
    fecha_calibracion: f.fecha_calibracion || null,
    error0: f.error0.trim() === '' ? null : f.error0.replace(',', '.'),
    error15: f.error15.trim() === '' ? null : f.error15.replace(',', '.'),
    error30: f.error30.trim() === '' ? null : f.error30.replace(',', '.'),
    valido_hasta: f.valido_hasta || null,
});
const desdeRegistro = (r: ErrorPatronRegistro): Fila => ({
    id_equipo: r.id_equipo, anio: r.anio,
    fecha_calibracion: r.fecha_calibracion || '',
    error0: txt(r.error0), error15: txt(r.error15), error30: txt(r.error30),
    valido_hasta: r.valido_hasta || '',
});

// Un color por temperatura, el mismo en los tres patrones.
const PUNTOS = [
    { k: 'error0', l: '0 °C', color: 'var(--sc-primary)' },
    { k: 'error15', l: '15 °C', color: 'var(--sc-success)' },
    { k: 'error30', l: '30 °C', color: 'var(--sc-warning)' },
] as const;

const mensajeError = (err: unknown, porDefecto: string) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message || porDefecto;

// Pestaña «Errores de patrón» de Verificación de Temperatura.
export const ErroresPatronPanel: React.FC = () => {
    const { showToast } = useToast();
    const [datos, setDatos] = useState<ErroresPatron | null>(null);
    const [cargando, setCargando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    // Edición en la fila: clave = id_error, o "n-<año>-<patrón>" para una fila nueva.
    const [edicion, setEdicion] = useState<{ clave: string; idError: number | null; fila: Fila } | null>(null);
    const [nuevoAnio, setNuevoAnio] = useState<{ anio: number; filas: Fila[]; observacion: string } | null>(null);
    // Diálogo de confirmación para eliminar un año completo (en caso de duplicados o casos excepcionales).
    const [anioAEliminar, setAnioAEliminar] = useState<number | null>(null);
    const [eliminandoAnio, setEliminandoAnio] = useState(false);
    // Al agregar un patrón a un año desde la tabla se pide la observación (va a la ficha del equipo);
    // al corregir el registro vigente (idError), el motivo de la corrección (va a la auditoría).
    const [pedirObs, setPedirObs] = useState<{ entrada: ErrorPatronEntrada; observacion: string; idError: number | null } | null>(null);
    // Registrar o corregir errores de patrón requiere GC_VERIF_TEMP_PATRON; sin él solo se consulta.
    const puede = useAccionesVerifTemp();

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            setDatos(await api.erroresPatron());
        } catch (err) {
            showToast({ type: 'error', message: mensajeError(err, 'No se pudieron cargar los errores de patrón') });
        } finally {
            setCargando(false);
        }
    }, [showToast]);

    useEffect(() => { cargar(); }, [cargar]);

    const registros = useMemo(() => datos?.registros ?? [], [datos]);
    const patrones = useMemo(() => datos?.patrones ?? [], [datos]);
    const anios = useMemo(() => [...new Set(registros.map((r) => r.anio))].sort((a, b) => b - a), [registros]);
    // Año vigente de cada patrón (el más reciente que tiene).
    const vigente = useMemo(() => {
        const m = new Map<number, number>();
        for (const r of registros) m.set(r.id_equipo, Math.max(m.get(r.id_equipo) ?? 0, r.anio));
        return m;
    }, [registros]);
    const ultimoDe = (idEquipo: number) => registros.filter((r) => r.id_equipo === idEquipo).sort((a, b) => b.anio - a.anio)[0];

    // Misma escala en los tres gráficos, para poder compararlos: el mayor
    // |error| registrado, con un mínimo de ±0,3 °C.
    const limiteY = useMemo(() => {
        const vals = registros.flatMap((r) => [r.error0, r.error15, r.error30]).filter((v): v is number => v !== null).map(Math.abs);
        return Math.max(0.3, Math.ceil((Math.max(0, ...vals) + 0.05) * 10) / 10);
    }, [registros]);

    const respuesta = (d: ErroresPatron, msg: string) => {
        setDatos(d);
        showToast({ type: 'success', message: msg });
    };

    const guardarEdicion = async () => {
        if (!edicion) return;
        setGuardando(true);
        try {
            // Registro nuevo: primero la observación; corrección: primero el motivo.
            // Se guarda desde el diálogo.
            setPedirObs({ entrada: aEntrada(edicion.fila), observacion: '', idError: edicion.idError });
        } catch (err) {
            showToast({ type: 'error', message: mensajeError(err, 'No se pudo guardar') });
        } finally {
            setGuardando(false);
        }
    };

    const guardarConObs = async () => {
        if (!pedirObs || !pedirObs.observacion.trim()) return;
        setGuardando(true);
        try {
            const correccion = pedirObs.idError !== null;
            const d = correccion
                ? await api.actualizarErrorPatron(pedirObs.idError as number, pedirObs.entrada, pedirObs.observacion.trim())
                : await api.guardarErroresPatron([pedirObs.entrada], pedirObs.observacion.trim());
            setPedirObs(null);
            setEdicion(null);
            respuesta(d, correccion ? 'Corrección guardada (queda en la auditoría)' : 'Registro guardado y equipo patrón actualizado');
        } catch (err) {
            showToast({ type: 'error', message: mensajeError(err, 'No se pudo guardar') });
        } finally {
            setGuardando(false);
        }
    };

    const guardarNuevoAnio = async () => {
        if (!nuevoAnio) return;
        if (anios.includes(nuevoAnio.anio)) {
            showToast({ type: 'warning', message: `${nuevoAnio.anio} ya existe: edita sus filas en la tabla` });
            return;
        }
        if (!nuevoAnio.observacion.trim()) {
            showToast({ type: 'warning', message: 'Escribe la observación del nuevo certificado: queda en la ficha de cada equipo patrón' });
            return;
        }
        setGuardando(true);
        try {
            const d = await api.guardarErroresPatron(nuevoAnio.filas.map(aEntrada), nuevoAnio.observacion.trim());
            setNuevoAnio(null);
            respuesta(d, `Año ${nuevoAnio.anio} agregado y equipos patrón actualizados`);
        } catch (err) {
            showToast({ type: 'error', message: mensajeError(err, 'No se pudo guardar el año') });
        } finally {
            setGuardando(false);
        }
    };

    const confirmarEliminarAnio = async () => {
        if (!anioAEliminar) return;
        setEliminandoAnio(true);
        try {
            const d = await api.eliminarAnioErroresPatron(anioAEliminar);
            setAnioAEliminar(null);
            respuesta(d, `Año ${anioAEliminar} eliminado correctamente`);
        } catch (err) {
            showToast({ type: 'error', message: mensajeError(err, 'No se pudo eliminar el año') });
        } finally {
            setEliminandoAnio(false);
        }
    };

    const abrirNuevoAnio = () => {
        setEdicion(null);
        const anio = Math.max(new Date().getFullYear(), (anios[0] ?? 0) + 1);
        setNuevoAnio({
            anio,
            filas: patrones.filter((p) => p.habilitado === 'S').map((p) => {
                const u = ultimoDe(p.id_equipo);
                // Se propone como última calibración el día en que se registra el
                // certificado nuevo, y +365 días de vigencia (como la planilla).
                const fc = hoyYmd();
                return u
                    ? { ...desdeRegistro(u), anio, fecha_calibracion: fc, valido_hasta: mas365(fc) }
                    : { id_equipo: p.id_equipo, anio, fecha_calibracion: '', error0: txt(p.error0), error15: txt(p.error15), error30: txt(p.error30), valido_hasta: '' };
            }),
            observacion: '',
        });
    };

    const hoy = hoyYmd();
    const nombrePatron = (id: number) => patrones.find((p) => p.id_equipo === id)?.codigo ?? `#${id}`;

    return (
        <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                    Errores de los termómetros patrón por año, según su certificado de calibración.
                    El año más reciente de cada patrón (<b className="text-foreground">Vigente</b>) es el que usan las fichas nuevas.
                </p>

                {datos && !datos.disponible && (
                    <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                        <IconAlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
                        <p>
                            Falta ejecutar la migración <code className="rounded bg-muted px-1">add_errores_termometro_patron.sql</code>.
                            Mientras tanto se muestran solo los errores que usan hoy las fichas, sin historial ni edición.
                        </p>
                    </div>
                )}

                {/* Un panel por termómetro patrón: lo que usan hoy las fichas nuevas,
                    el cambio frente al año anterior y la evolución de sus 3 puntos. */}
                <div className="grid gap-3 lg:grid-cols-3">
                    {patrones.filter((p) => p.habilitado === 'S').map((p) => (
                        <TarjetaPatron
                            key={p.id_equipo}
                            patron={p}
                            serie={registros.filter((r) => r.id_equipo === p.id_equipo).sort((a, b) => a.anio - b.anio)}
                            limite={limiteY}
                        />
                    ))}
                </div>

                {datos?.disponible && (
                    <>
                        {puede.patron && (
                            <div className="flex justify-end">
                                <Button size="sm" onClick={abrirNuevoAnio} disabled={!!nuevoAnio || guardando}>
                                    <IconCalendarPlus size={15} /> Nuevo año
                                </Button>
                            </div>
                        )}

                        {nuevoAnio && (
                            <div className="rounded-xl border-2 border-primary/40 bg-primary/5 p-3">
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold">Nuevo año</span>
                                    <Input
                                        type="number"
                                        className="h-8 w-24"
                                        value={nuevoAnio.anio}
                                        onChange={(e) => {
                                            const anio = Number(e.target.value);
                                            setNuevoAnio((p) => p && { ...p, anio, filas: p.filas.map((f) => ({ ...f, anio })) });
                                        }}
                                    />
                                    <span className="text-xs text-muted-foreground">Viene con los errores del último año y la fecha de hoy como última calibración: corrige lo que cambió según el nuevo certificado.</span>
                                </div>
                                <TablaAnio
                                    filas={nuevoAnio.filas.map((f, i) => ({
                                        clave: `nuevo-${i}`,
                                        idEquipo: f.id_equipo,
                                        editando: f,
                                        onCambiar: (nf: Fila) => setNuevoAnio((p) => p && { ...p, filas: p.filas.map((x, j) => (j === i ? nf : x)) }),
                                        onQuitar: () => setNuevoAnio((p) => p && { ...p, filas: p.filas.filter((_, j) => j !== i) }),
                                    }))}
                                    nombrePatron={nombrePatron}
                                    hoy={hoy}
                                />
                                <div className="mt-3">
                                    <p className="mb-1 text-xs font-medium">Observación <span className="text-destructive">*</span></p>
                                    <Textarea
                                        rows={2}
                                        maxLength={600}
                                        value={nuevoAnio.observacion}
                                        onChange={(e) => setNuevoAnio((p) => p && { ...p, observacion: e.target.value })}
                                        placeholder="Ej.: Certificado de calibración N° 1234 (laboratorio X). Se actualizan errores y vigencia del patrón."
                                    />
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Al guardar, cada equipo patrón de la lista queda con los errores nuevos, la última calibración, la próxima revisión («Válido hasta») y esta observación en su ficha, como una revisión más de su historial.
                                    </p>
                                </div>
                                <div className="mt-2 flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={() => setNuevoAnio(null)} disabled={guardando}>Cancelar</Button>
                                    <Button size="sm" onClick={guardarNuevoAnio} disabled={guardando || nuevoAnio.filas.length === 0 || !nuevoAnio.observacion.trim()}>
                                        <IconCheck size={15} /> Guardar {nuevoAnio.anio}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {cargando && !registros.length && <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>}
                        {!cargando && !registros.length && !nuevoAnio && (
                            <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay años registrados. Usa «Nuevo año» para cargar el primero.</p>
                        )}

                        {anios.map((anio) => {
                            const delAnio = registros.filter((r) => r.anio === anio);
                            // Solo se puede agregar un patrón a un año posterior a su vigente
                            // (los años pasados no se modifican).
                            const faltan = patrones.filter((p) => p.habilitado === 'S'
                                && !delAnio.some((r) => r.id_equipo === p.id_equipo)
                                && (vigente.get(p.id_equipo) ?? 0) < anio);
                            const editandoNueva = edicion && !edicion.idError && edicion.fila.anio === anio ? edicion : null;
                            return (
                                <div key={anio}>
                                    <TablaAnio
                                        anio={anio}
                                        onEliminarAnio={puede.patron ? () => setAnioAEliminar(anio) : undefined}
                                        filas={[
                                            ...delAnio.map((r) => {
                                                const clave = String(r.id_error);
                                                const enEdicion = edicion?.clave === clave ? edicion.fila : null;
                                                return {
                                                    clave,
                                                    idEquipo: r.id_equipo,
                                                    registro: r,
                                                    vigente: vigente.get(r.id_equipo) === anio,
                                                    editando: enEdicion,
                                                    onEditar: puede.patron ? () => { setNuevoAnio(null); setEdicion({ clave, idError: r.id_error, fila: desdeRegistro(r) }); } : undefined,
                                                    onCambiar: (f: Fila) => setEdicion((e) => e && { ...e, fila: f }),
                                                    onGuardar: guardarEdicion,
                                                    onCancelar: () => setEdicion(null),
                                                };
                                            }),
                                            ...(editandoNueva ? [{
                                                clave: editandoNueva.clave,
                                                idEquipo: editandoNueva.fila.id_equipo,
                                                editando: editandoNueva.fila,
                                                onCambiar: (f: Fila) => setEdicion((e) => e && { ...e, fila: f }),
                                                onGuardar: guardarEdicion,
                                                onCancelar: () => setEdicion(null),
                                            }] : []),
                                        ]}
                                        nombrePatron={nombrePatron}
                                        hoy={hoy}
                                        guardando={guardando}
                                    />
                                    {faltan.length > 0 && !editandoNueva && puede.patron && (
                                        <div className="mt-1 flex flex-wrap gap-1.5">
                                            {faltan.map((p) => (
                                                <Button
                                                    key={p.id_equipo}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() => {
                                                        setNuevoAnio(null);
                                                        const u = ultimoDe(p.id_equipo);
                                                        setEdicion({
                                                            clave: `n-${anio}-${p.id_equipo}`,
                                                            idError: null,
                                                            fila: u ? { ...desdeRegistro(u), anio } : { id_equipo: p.id_equipo, anio, fecha_calibracion: '', error0: '', error15: '', error30: '', valido_hasta: '' },
                                                        });
                                                    }}
                                                >
                                                    <IconPlus size={13} /> Agregar {p.codigo} a {anio}
                                                </Button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </>
                )}

            <Dialog open={!!pedirObs} onOpenChange={(o) => { if (!o && !guardando) setPedirObs(null); }}>
                <DialogContent className="shadcn-scope sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{pedirObs?.idError ? 'Motivo de la corrección' : 'Observación del nuevo certificado'}</DialogTitle>
                        <DialogDescription>
                            {pedirObs ? `${nombrePatron(pedirObs.entrada.id_equipo)} · año ${pedirObs.entrada.anio}` : ''}.{' '}
                            {pedirObs?.idError
                                ? 'Cambia los errores que usan las fichas de verificación: el motivo queda en la auditoría junto con los valores anteriores y los nuevos.'
                                : 'Queda en la ficha del equipo patrón junto con sus errores, última calibración y próxima revisión.'}
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea
                        rows={3}
                        maxLength={600}
                        autoFocus
                        value={pedirObs?.observacion ?? ''}
                        onChange={(e) => setPedirObs((p) => p && { ...p, observacion: e.target.value })}
                        placeholder={pedirObs?.idError ? 'Ej.: Error de digitación del error a 15 °C (certificado N° 1234).' : 'Ej.: Certificado de calibración N° 1234 (laboratorio X).'}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPedirObs(null)} disabled={guardando}>Cancelar</Button>
                        <Button onClick={guardarConObs} disabled={guardando || !pedirObs?.observacion.trim()}>
                            <IconCheck size={15} /> {guardando ? 'Guardando…' : 'Guardar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Diálogo de confirmación para eliminar un año completo */}
            <Dialog open={anioAEliminar !== null} onOpenChange={(o) => { if (!o && !eliminandoAnio) setAnioAEliminar(null); }}>
                <DialogContent className="shadcn-scope sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <IconAlertTriangle size={20} /> Eliminar año {anioAEliminar}
                        </DialogTitle>
                        <DialogDescription className="space-y-2 pt-2 text-left">
                            <p>
                                ¿Seguro que deseas eliminar el <b>año {anioAEliminar}</b> de la tabla de errores de patrón?
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Se eliminarán los registros de calibración de todos los termómetros patrón para este año.
                                Si este año estaba vigente, los equipos se resincronizarán automáticamente con su año anterior más reciente.
                            </p>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setAnioAEliminar(null)} disabled={eliminandoAnio}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={confirmarEliminarAnio} disabled={eliminandoAnio}>
                            <IconX size={15} /> {eliminandoAnio ? 'Eliminando…' : `Eliminar ${anioAEliminar}`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

// ── Tabla de un año (mismo formato que la planilla) ─────────────────────────
interface FilaTabla {
    clave: string;
    idEquipo: number;
    registro?: ErrorPatronRegistro;
    vigente?: boolean;
    editando: Fila | null;
    onEditar?: () => void;
    onCambiar: (f: Fila) => void;
    onGuardar?: () => void;
    onCancelar?: () => void;
    onQuitar?: () => void;
}

const TablaAnio: React.FC<{
    anio?: number;
    filas: FilaTabla[];
    nombrePatron: (id: number) => string;
    hoy: string;
    guardando?: boolean;
    onEliminarAnio?: () => void;
}> = ({ anio, filas, nombrePatron, hoy, guardando, onEliminarAnio }) => (
    <div className="overflow-x-auto rounded-lg border border-border">
        {/* Anchos fijos: así todos los años quedan con las columnas alineadas,
            aunque uno tenga la etiqueta «Vigente» o «(vencido)». */}
        <table className="w-full min-w-[760px] table-fixed text-sm">
            <colgroup>
                <col className="w-[100px]" />
                <col />
                <col className="w-[150px]" />
                <col className="w-[88px]" />
                <col className="w-[88px]" />
                <col className="w-[88px]" />
                <col className="w-[190px]" />
                <col className="w-[96px]" />
            </colgroup>
            <thead>
                <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-2 py-1.5 text-left font-bold text-foreground">
                        <div className="flex items-center gap-1.5">
                            <span>{anio ?? ''}</span>
                            {onEliminarAnio && (
                                <button
                                    type="button"
                                    className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-destructive/15 hover:text-destructive"
                                    onClick={onEliminarAnio}
                                    title={`Eliminar año ${anio}`}
                                    aria-label={`Eliminar año ${anio}`}
                                >
                                    <IconX size={13} stroke={2.5} />
                                </button>
                            )}
                        </div>
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium">Termómetro patrón</th>
                    <th className="px-2 py-1.5 text-center font-medium">Última calibración</th>
                    <th className="px-2 py-1.5 text-center font-medium">0 °C</th>
                    <th className="px-2 py-1.5 text-center font-medium">15 °C</th>
                    <th className="px-2 py-1.5 text-center font-medium">30 °C</th>
                    <th className="px-2 py-1.5 text-center font-medium">Válido hasta</th>
                    <th className="px-2 py-1.5 text-right">
                        {onEliminarAnio && (
                            <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground/60 hover:bg-destructive/15 hover:text-destructive transition-colors"
                                onClick={onEliminarAnio}
                                title={`Eliminar año ${anio}`}
                            >
                                <IconX size={14} />
                            </Button>
                        )}
                    </th>
                </tr>
            </thead>
            <tbody>
                {filas.map((f) => {
                    const r = f.registro;
                    if (f.editando) {
                        const e = f.editando;
                        const set = (campo: keyof Fila, valor: string) => {
                            const nf = { ...e, [campo]: valor } as Fila;
                            // Válido hasta sigue a la calibración mientras no se haya cambiado a mano.
                            if (campo === 'fecha_calibracion' && (!e.valido_hasta || e.valido_hasta === mas365(e.fecha_calibracion))) nf.valido_hasta = mas365(valor);
                            f.onCambiar(nf);
                        };
                        const onKey = (ev: React.KeyboardEvent) => {
                            if (ev.key === 'Enter') f.onGuardar?.();
                            if (ev.key === 'Escape') f.onCancelar?.();
                        };
                        return (
                            <tr key={f.clave} className="border-b border-border bg-primary/5 last:border-0">
                                <td className="px-2 py-1" />
                                <td className="px-2 py-1 font-medium">{nombrePatron(f.idEquipo)}</td>
                                <td className="px-1 py-1"><Input type="date" className="h-8" value={e.fecha_calibracion} onChange={(ev) => set('fecha_calibracion', ev.target.value)} onKeyDown={onKey} /></td>
                                {(['error0', 'error15', 'error30'] as const).map((k) => (
                                    <td key={k} className="px-1 py-1">
                                        <Input inputMode="decimal" className="h-8 text-center tabular-nums" value={e[k]} placeholder="0,0" onChange={(ev) => set(k, ev.target.value)} onKeyDown={onKey} />
                                    </td>
                                ))}
                                <td className="px-1 py-1"><Input type="date" className="h-8" value={e.valido_hasta} onChange={(ev) => set('valido_hasta', ev.target.value)} onKeyDown={onKey} /></td>
                                <td className="px-1 py-1 text-right">
                                    {f.onGuardar ? (
                                        <div className="flex justify-end gap-0.5">
                                            <Button size="icon" className="h-7 w-7" onClick={f.onGuardar} disabled={guardando} title="Guardar (Enter)"><IconCheck size={15} /></Button>
                                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={f.onCancelar} disabled={guardando} title="Cancelar (Esc)"><IconX size={15} /></Button>
                                        </div>
                                    ) : f.onQuitar && (
                                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={f.onQuitar} title="No incluir este patrón"><IconX size={15} /></Button>
                                    )}
                                </td>
                            </tr>
                        );
                    }
                    if (!r) return null;
                    const vencido = !!r.valido_hasta && r.valido_hasta < hoy;
                    return (
                        <tr key={f.clave} className="group border-b border-border last:border-0 hover:bg-muted/30">
                            <td className="px-2 py-1.5">
                                {f.vigente && <Badge variant="success" className="px-1.5 text-[10px]">Vigente</Badge>}
                            </td>
                            <td className="px-2 py-1.5 font-medium">{r.codigo}</td>
                            <td className="px-2 py-1.5 text-center tabular-nums">{fmtFecha(r.fecha_calibracion)}</td>
                            {[r.error0, r.error15, r.error30].map((v, i) => (
                                <td key={i} className={cn('px-2 py-1.5 text-center tabular-nums', v !== null && Math.abs(v) >= 0.2 && 'font-semibold text-warning')}>{fmtNum(v)}</td>
                            ))}
                            <td className={cn('px-2 py-1.5 text-center tabular-nums', vencido && f.vigente && 'font-semibold text-destructive')}>
                                {fmtFecha(r.valido_hasta)}
                                {vencido && f.vigente && <span className="ml-1 text-[10px] font-medium">(vencido)</span>}
                            </td>
                            <td className="px-1 py-1 text-right">
                                {/* Solo el vigente se corrige; ninguno se elimina (es historial). */}
                                {f.vigente && f.onEditar ? (
                                    <Button size="icon" variant="ghost" className="h-7 w-7 opacity-60 transition-opacity group-hover:opacity-100" onClick={f.onEditar} disabled={guardando} title="Corregir el registro vigente">
                                        <IconPencil size={14} />
                                    </Button>
                                ) : f.vigente ? (
                                    <span className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground/50" title="Corregir requiere el permiso GC_VERIF_TEMP_PATRON">
                                        <IconLock size={13} />
                                    </span>
                                ) : (
                                    <span className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground/50" title="Año pasado: queda como historial y no se modifica">
                                        <IconLock size={14} />
                                    </span>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);

// ── Panel de un termómetro patrón ──────────────────────────────────────────
type PatronInfo = ErroresPatron['patrones'][number];

const Cambio: React.FC<{ actual: number | null; anterior: number | null | undefined }> = ({ actual, anterior }) => {
    if (actual === null || anterior === null || anterior === undefined) return null;
    const d = Math.round((actual - anterior) * 100) / 100;
    if (d === 0) return <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground" title="Igual que el año anterior"><IconEqual size={11} /> igual</span>;
    // Se aleja de 0 = empeora; se acerca = mejora.
    const empeora = Math.abs(actual) > Math.abs(anterior);
    const Icono = d > 0 ? IconArrowUpRight : IconArrowDownRight;
    return (
        <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-medium', empeora ? 'text-warning' : 'text-success')}
            title={`${d > 0 ? '+' : ''}${fmtNum(d)} °C frente al año anterior (${empeora ? 'se aleja de 0' : 'se acerca a 0'})`}>
            <Icono size={11} /> {d > 0 ? '+' : ''}{fmtNum(d)}
        </span>
    );
};

const TarjetaPatron: React.FC<{ patron: PatronInfo; serie: ErrorPatronRegistro[]; limite: number }> = ({ patron, serie, limite }) => {
    const ultimo = serie[serie.length - 1];
    const anterior = serie[serie.length - 2];
    const datos = serie.map((r) => ({ anio: String(r.anio), error0: r.error0, error15: r.error15, error30: r.error30 }));
    return (
        <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="font-semibold">{patron.codigo}</p>
                    <p className="text-xs text-muted-foreground">
                        Sede {patron.sede}{ultimo ? ` · calibrado ${fmtFecha(ultimo.fecha_calibracion)}` : ''}
                    </p>
                </div>
                {ultimo && <Badge variant="success" className="px-1.5 text-[10px]">Vigente {ultimo.anio}</Badge>}
            </div>

            {/* Errores que usan hoy las fichas nuevas y su cambio frente al año anterior */}
            <div className="mt-2 grid grid-cols-3 gap-1.5">
                {PUNTOS.map((pt) => (
                    <div key={pt.k} className="rounded-lg bg-muted/40 px-2 py-1.5 text-center">
                        <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                            <span className="h-2 w-2 rounded-full" style={{ background: pt.color }} /> {pt.l}
                        </p>
                        <p className="text-lg font-bold leading-tight tabular-nums">{fmtNum(patron[pt.k])}</p>
                        <Cambio actual={ultimo ? ultimo[pt.k] : null} anterior={anterior?.[pt.k]} />
                    </div>
                ))}
            </div>

            {datos.length > 1 ? (
                <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={datos} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                        <XAxis dataKey="anio" tick={{ fontSize: 10.5, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                        {/* Ancho suficiente para "-0,15" (con 34 px se cortaba el signo). */}
                        <YAxis
                            domain={[-limite, limite]}
                            ticks={[-limite, -limite / 2, 0, limite / 2, limite]}
                            interval={0}
                            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                            axisLine={false}
                            tickLine={false}
                            width={46}
                            tickFormatter={(v: number) => fmtNum(Math.round(v * 100) / 100 + 0)}
                        />
                        <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.6} />
                        <Tooltip
                            formatter={(v, nombre) => [`${fmtNum(v as number)} °C`, nombre]}
                            labelFormatter={(l) => `Año ${l}`}
                            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        />
                        {PUNTOS.map((pt) => (
                            <Line key={pt.k} type="monotone" dataKey={pt.k} name={pt.l} stroke={pt.color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            ) : (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                    {serie.length ? 'El gráfico aparece desde el segundo año registrado.' : 'Sin historial registrado.'}
                </p>
            )}
        </div>
    );
};
