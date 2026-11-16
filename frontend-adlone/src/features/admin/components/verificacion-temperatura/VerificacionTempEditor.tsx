import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
    IconTemperature, IconDeviceFloppy, IconFileTypePdf, IconSignature, IconArrowBackUp,
    IconBan, IconCircleCheck, IconAlertTriangle, IconInfoCircle, IconLock, IconChevronDown, IconLayoutColumns, IconX, IconTrash, IconRestore,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '../../../../contexts/ToastContext';
import PdfViewerModal from '../../../facturacion/components/PdfViewerModal';
import {
    verificacionTemperaturaService as api,
    type VerificacionDetalle, type PatronTemp, type MuestreadorFirma, type LecturasTemp, type AntecedentesPatron,
} from '../../services/verificacionTemperatura.service';
import { RANGOS, TOLERANCIA, calcular, fmtNum, fmtFecha, nombrePeriodo, parseNum, hoyYmd, ESTADO_META } from '../../utils/verificacionTemperatura';
import { FirmaMuestreadorDialog } from './FirmaMuestreadorDialog';

// Máxima división del termómetro verificado y del patrón: siempre 5 (el backend la fija igual).
const MAXIMA_DIVISION_FIJA = '5';

type Rango = '0' | '15' | '30';
type FilaTexto = { tp: string; tc: string; hora: string };

// Campos de "Antecedentes del Termómetro Patrón", en el orden de la hoja Excel.
type CampoPatron = keyof AntecedentesPatron;
const CAMPOS_PATRON: { campo: CampoPatron; label: string; tipo?: 'date'; placeholder?: string; fijo?: string }[] = [
    { campo: 'patron_marca', label: 'Marca' },
    { campo: 'patron_modelo', label: 'Modelo' },
    { campo: 'patron_serie', label: 'N° Serie' },
    { campo: 'patron_identificacion', label: 'Identificación especial' },
    { campo: 'patron_intervalo', label: 'Intervalo Indicación', placeholder: 'Ej: -50 a 150 °C' },
    { campo: 'patron_fecha_calibracion', label: 'Fecha Calibración', tipo: 'date' },
    { campo: 'patron_empresa', label: 'Empresa' },
    { campo: 'patron_maxima_division', label: 'Máxima división', fijo: MAXIMA_DIVISION_FIJA },
];
type AntecedentesTexto = Record<CampoPatron, string>;
const antecedentesTexto = (a?: Partial<AntecedentesPatron> | null): AntecedentesTexto =>
    Object.fromEntries(CAMPOS_PATRON.map(({ campo, fijo }) => [campo, fijo ?? (a?.[campo] ?? '').toString().slice(0, campo === 'patron_fecha_calibracion' ? 10 : undefined)])) as AntecedentesTexto;
type LecturasTexto = Record<Rango, FilaTexto[]>;

const aTexto = (l: LecturasTemp): LecturasTexto => Object.fromEntries(
    RANGOS.map((r) => [String(r), (l[String(r) as Rango] || []).map((f) => ({
        tp: f.tp === null ? '' : String(f.tp).replace('.', ','),
        tc: f.tc === null ? '' : String(f.tc).replace('.', ','),
        hora: f.hora || '',
    }))]),
) as LecturasTexto;

const aNumeros = (t: LecturasTexto): LecturasTemp => Object.fromEntries(
    RANGOS.map((r) => [String(r), t[String(r) as Rango].map((f) => ({ tp: parseNum(f.tp), tc: parseNum(f.tc), hora: f.hora }))]),
) as LecturasTemp;

// Comienzo de la observación: "- dd/mm/aaaa " con la fecha de la verificación.
const RE_FECHA_OBS = /^\s*-[ \t]*\d{1,2}[./-]\d{1,2}[./-]\d{4}[ \t]*/;
const prefijoObservacion = (ymd: string) => {
    const [y, m, d] = ymd.slice(0, 10).split('-');
    return `- ${d}/${m}/${y} `;
};

// Hora y minuto en que se registra una temperatura TP.
const horaAhora = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const mensajeError = (err: unknown, def: string) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message || def;

export interface FichaTempPanelHandle {
    guardar: () => Promise<void>;
}

interface PanelProps {
    idVerificacion: number;
    // Mesa de trabajo: varias fichas lado a lado, antecedentes plegados.
    compacto?: boolean;
    onChanged: () => void;
    onSucioChange?: (sucio: boolean) => void;
    onAnulada?: () => void;
    // Ficha en borrador eliminada (descartada): quien la abrió la saca de pantalla.
    onEliminada?: () => void;
}

// Formulario web del OI-FoGe-39. Mismas secciones que la hoja Excel: antecedentes
// del termómetro, termómetro patrón, mediciones (5 por rango), resumen y
// observación. Los cálculos se ven en vivo; el backend los recalcula al guardar.
//
// Cada lectura se registra al escribir su temperatura TP: se marca la hora y
// minuto de ese momento y la TP queda bloqueada (se guarda sola en segundos).
export const FichaTempPanel = forwardRef<FichaTempPanelHandle, PanelProps>(({ idVerificacion, compacto, onChanged, onSucioChange, onAnulada, onEliminada }, ref) => {
    const { showToast } = useToast();
    const raizRef = useRef<HTMLDivElement>(null);
    const [v, setV] = useState<VerificacionDetalle | null>(null);
    const [patrones, setPatrones] = useState<PatronTemp[]>([]);
    const [muestreadores, setMuestreadores] = useState<MuestreadorFirma[]>([]);
    const [cargando, setCargando] = useState(false);

    const [fecha, setFecha] = useState('');
    const [idPatron, setIdPatron] = useState('');
    const [idMuestreador, setIdMuestreador] = useState('');
    const [observacion, setObservacion] = useState('');
    const [antecedentes, setAntecedentes] = useState<AntecedentesTexto>(() => antecedentesTexto(null));
    const [lecturas, setLecturas] = useState<LecturasTexto | null>(null);
    const [sucio, setSucio] = useState(false);
    const [verAntecedentes, setVerAntecedentes] = useState(!compacto);

    const [accion, setAccion] = useState<string | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [pdfAbierto, setPdfAbierto] = useState(false);
    const [firmaAbierta, setFirmaAbierta] = useState(false);
    const [anularAbierto, setAnularAbierto] = useState(false);
    const [motivoAnular, setMotivoAnular] = useState('');
    const [eliminarAbierto, setEliminarAbierto] = useState(false);

    // Cada edición suma 1: si llega la respuesta de un guardado y hubo cambios
    // mientras tanto, no se pisan con lo que devolvió el servidor.
    const cambiosRef = useRef(0);
    const colaRef = useRef<Promise<unknown>>(Promise.resolve());
    const autoguardadoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const marcar = () => { cambiosRef.current += 1; setSucio(true); };

    useEffect(() => { onSucioChange?.(sucio); }, [sucio, onSucioChange]);

    const cargarEn = useCallback((d: VerificacionDetalle) => {
        setV(d);
        setFecha(d.fecha_verificacion);
        setIdPatron(d.id_patron ? String(d.id_patron) : '');
        setIdMuestreador(d.id_muestreador ? String(d.id_muestreador) : '');
        setObservacion(d.observacion || '');
        setAntecedentes(antecedentesTexto(d));
        setLecturas(aTexto(d.lecturas));
        setSucio(false);
    }, []);

    useEffect(() => {
        setCargando(true);
        Promise.all([api.obtener(idVerificacion), api.patrones(), api.muestreadores()])
            .then(([d, p, m]) => { cargarEn(d); setPatrones(p); setMuestreadores(m); })
            .catch((err) => showToast({ type: 'error', message: mensajeError(err, 'No se pudo abrir la ficha') }))
            .finally(() => setCargando(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idVerificacion]);

    useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);
    useEffect(() => () => { if (autoguardadoRef.current) clearTimeout(autoguardadoRef.current); }, []);

    const editable = v?.estado === 'BORRADOR';

    // Error del patrón para el cálculo en vivo: el guardado en la ficha, o el
    // actual del patrón si se acaba de elegir otro.
    const errPatron = useMemo(() => {
        if (!v) return { 0: 0, 15: 0, 30: 0 };
        const elegido = patrones.find((p) => String(p.id_equipo) === idPatron);
        if (elegido && Number(idPatron) !== v.id_patron) return { 0: elegido.error0, 15: elegido.error15, 30: elegido.error30 };
        return { 0: v.patron_error0, 15: v.patron_error15, 30: v.patron_error30 };
    }, [v, patrones, idPatron]);

    const calc = useMemo(() => (lecturas ? calcular(aNumeros(lecturas), errPatron) : null), [lecturas, errPatron]);

    // Los guardados van en fila: el automático (al registrar una TP) y el del
    // botón nunca se cruzan.
    const guardarAhora = async (silencioso: boolean) => {
        if (!v || !lecturas || v.estado !== 'BORRADOR') return null;
        const marca = cambiosRef.current;
        const d = await api.actualizar(v.id_verificacion, {
            fecha_verificacion: fecha,
            maxima_division: MAXIMA_DIVISION_FIJA,
            id_patron: idPatron ? Number(idPatron) : undefined,
            lecturas: aNumeros(lecturas),
            observacion,
            id_muestreador: idMuestreador ? Number(idMuestreador) : null,
            patron_antecedentes: Object.fromEntries(CAMPOS_PATRON.map(({ campo }) => [campo, antecedentes[campo].trim() || null])) as unknown as AntecedentesPatron,
        });
        if (cambiosRef.current === marca) cargarEn(d); else setV(d);
        onChanged();
        if (!silencioso) showToast({ type: 'success', message: `Ficha de ${d.codigo_equipo} guardada` });
        return d;
    };
    const guardarRef = useRef(guardarAhora);
    guardarRef.current = guardarAhora;
    const guardar = (silencioso = false) => {
        const p = colaRef.current.then(() => guardarRef.current(silencioso));
        colaRef.current = p.catch(() => undefined);
        return p;
    };

    useImperativeHandle(ref, () => ({ guardar: async () => { await guardar(true); } }));

    const programarAutoguardado = () => {
        if (autoguardadoRef.current) clearTimeout(autoguardadoRef.current);
        autoguardadoRef.current = setTimeout(() => {
            guardar(true).catch((err) => showToast({ type: 'error', message: mensajeError(err, 'No se pudo guardar la temperatura registrada') }));
        }, 600);
    };

    // TP: al confirmarla (Enter o salir de la celda) se registra con la hora
    // actual y queda bloqueada.
    const registrarTp = (r: Rango, i: number, valor: string) => {
        if (parseNum(valor) === null) return;
        setLecturas((prev) => prev && ({
            ...prev,
            [r]: prev[r].map((f, k) => (k === i && !f.hora ? { ...f, tp: valor, hora: horaAhora() } : f)),
        }));
        marcar();
        programarAutoguardado();
    };

    // × en una TP registrada: se borra junto con su hora y la lectura vuelve a
    // quedar por registrar (TP nominal del rango).
    const borrarTp = (r: Rango, i: number) => {
        setLecturas((prev) => prev && ({
            ...prev,
            [r]: prev[r].map((f, k) => (k === i ? { ...f, tp: r, hora: '' } : f)),
        }));
        marcar();
        programarAutoguardado();
        setTimeout(() => raizRef.current?.querySelector<HTMLInputElement>(`[data-celda="tp-${r}-${i}"]`)?.focus(), 0);
    };

    const setTc = (r: Rango, i: number, valor: string) => {
        setLecturas((prev) => prev && ({ ...prev, [r]: prev[r].map((f, k) => (k === i ? { ...f, tc: valor } : f)) }));
        marcar();
    };

    const ejecutar = async (nombre: string, fn: () => Promise<void>) => {
        setAccion(nombre);
        try { await fn(); } catch (err) { showToast({ type: 'error', message: mensajeError(err, 'No se pudo completar la acción') }); } finally { setAccion(null); }
    };

    const verPdf = () => ejecutar('pdf', async () => {
        if (editable && sucio) await guardar(true);
        const url = await api.pdfUrl(v!.id_verificacion);
        setPdfUrl(url);
        setPdfAbierto(true);
    });

    // "Firmar": si está en borrador la cierra (pasa a pendiente de firma) y abre
    // la firma. Solo esta ficha cambia; las demás de la mesa siguen abiertas.
    const firmar = () => ejecutar('firmar', async () => {
        if (v!.estado === 'BORRADOR') {
            if (sucio) await guardar(true);
            const d = await api.enviarFirma(v!.id_verificacion);
            cargarEn(d);
            onChanged();
        }
        setFirmaAbierta(true);
    });

    const volverBorrador = () => ejecutar('volver', async () => {
        const d = await api.volverBorrador(v!.id_verificacion);
        cargarEn(d);
        onChanged();
    });

    // Descartar cambios: vuelve a lo último guardado (las TP ya registradas se
    // guardan solas, así que esas quedan).
    const descartar = () => ejecutar('descartar', async () => {
        if (autoguardadoRef.current) { clearTimeout(autoguardadoRef.current); autoguardadoRef.current = null; }
        await colaRef.current;
        cambiosRef.current += 1;
        cargarEn(await api.obtener(idVerificacion));
        showToast({ type: 'info', message: 'Cambios descartados' });
    });

    const eliminar = () => ejecutar('eliminar', async () => {
        if (autoguardadoRef.current) { clearTimeout(autoguardadoRef.current); autoguardadoRef.current = null; }
        await colaRef.current;
        await api.eliminar(idVerificacion);
        setEliminarAbierto(false);
        setSucio(false);
        onChanged();
        showToast({ type: 'success', message: `Ficha de ${v?.codigo_equipo ?? ''} eliminada` });
        onEliminada?.();
    });

    const anular = () => ejecutar('anular', async () => {
        await api.anular(v!.id_verificacion, motivoAnular.trim());
        setAnularAbierto(false);
        setMotivoAnular('');
        onChanged();
        showToast({ type: 'success', message: 'Ficha anulada' });
        if (onAnulada) onAnulada();
        else cargarEn(await api.obtener(v!.id_verificacion));
    });

    // Enter baja por la misma columna: en TP salta siempre a la siguiente TP por
    // registrar (se salta las ya bloqueadas; al pasar la 5ª sigue en el rango
    // siguiente); en TC, a la TC siguiente. Flecha arriba sube. Solo dentro de esta ficha.
    const navegarCelda = (celda: string, paso: 1 | -1) => {
        const [col, rango, fila] = celda.split('-');
        const orden = RANGOS.map(String);
        let ri = orden.indexOf(rango);
        let i = Number(fila);
        const raiz = raizRef.current;
        for (let n = 0; n < 15; n++) {
            i += paso;
            if (i > 4) { ri += 1; i = 0; }
            if (i < 0) { ri -= 1; i = 4; }
            if (ri < 0 || ri >= orden.length) return;
            const destino = raiz?.querySelector<HTMLInputElement>(`[data-celda="${col}-${orden[ri]}-${i}"]`);
            if (destino && !destino.disabled) { destino.focus(); return; }
        }
    };

    const meta = v ? ESTADO_META[v.estado] : null;
    const muestreadorNombre = muestreadores.find((m) => String(m.id_muestreador) === idMuestreador)?.nombre_muestreador;
    const tpPendientes = lecturas ? RANGOS.reduce<number>((s, r) => s + lecturas[String(r) as Rango].filter((f) => !f.hora).length, 0) : 15;
    const tcPendientes = calc ? RANGOS.reduce<number>((s, r) => s + (5 - calc.rangos[r].completas), 0) : 15;
    const lecturasCompletas = !!calc && tpPendientes === 0 && tcPendientes === 0;
    const textoObservacion = observacion.replace(RE_FECHA_OBS, '').trim();
    // "- dd/mm/aaaa " del comienzo (null si la observación aún no lo tiene).
    const fechaObservacion = observacion.match(RE_FECHA_OBS)?.[0] ?? null;

    // Al completar las 15 lecturas, la observación se empieza con "- dd/mm/aaaa "
    // (fecha de la verificación) y queda por escribir el texto. Si cambia la
    // fecha, la del comienzo la sigue.
    useEffect(() => {
        if (!editable || !lecturasCompletas || !fecha) return;
        const prefijo = prefijoObservacion(fecha);
        if (!observacion.trim()) { setObservacion(prefijo); marcar(); return; }
        const m = observacion.match(RE_FECHA_OBS);
        if (!m) { setObservacion(prefijo + observacion.trim()); marcar(); return; }
        if (m[0].trim() !== prefijo.trim()) { setObservacion(prefijo + observacion.slice(m[0].length)); marcar(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editable, lecturasCompletas, fecha]);

    const faltaParaFirmar = !calc ? 'Cargando'
        : tpPendientes > 0 ? `Faltan ${tpPendientes} temperatura(s) TP por registrar`
            : tcPendientes > 0 ? `Faltan ${tcPendientes} lectura(s) TC`
                : !idMuestreador ? 'Indique el muestreador que firma'
                    : !textoObservacion ? 'Escriba la observación después de la fecha'
                        : null;

    if (cargando || !v || !lecturas || !calc) {
        return (
            <div className="flex h-full min-h-[200px] flex-1 items-center justify-center">
                <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    const resumenAntecedentes = [
        v.patron_codigo ? `Patrón ${v.patron_codigo}` : 'Sin patrón',
        `Máx. división ${MAXIMA_DIVISION_FIJA}`,
        muestreadorNombre || v.muestreador_nombre ? `Firma ${muestreadorNombre || v.muestreador_nombre}` : 'Sin muestreador',
    ].join(' · ');

    return (
        <div ref={raizRef} className="@container flex min-h-0 flex-1 flex-col">
            {/* Encabezado de la ficha */}
            <div className={cn('flex shrink-0 flex-wrap items-center gap-3 border-b border-border', compacto ? 'bg-muted/40 px-3 py-2' : 'px-5 py-3 pr-12')}>
                {!compacto && (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <IconTemperature size={22} />
                    </div>
                )}
                <div className="min-w-0 flex-1 text-left">
                    <p className={cn('truncate font-semibold', compacto ? 'text-sm' : 'text-base')}>
                        {compacto ? v.codigo_equipo : 'OI-FoGe-39 · Verificación Intermedia de Temperatura'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                        {compacto
                            ? `${v.nombre_equipo} · Sede ${v.sede} · Ficha N° ${v.id_verificacion}`
                            : `${v.codigo_equipo} · ${v.nombre_equipo} · Sede ${v.sede} · ${nombrePeriodo(v.periodo)} · Ficha N° ${v.id_verificacion}`}
                    </p>
                </div>
                {calc.cumple !== null && compacto && <Badge variant={calc.cumple ? 'success' : 'destructive'}>{calc.cumple ? 'Cumple' : 'No cumple'}</Badge>}
                {meta && <Badge variant={meta.badge}>{meta.label}</Badge>}
                {sucio && editable && <span className="text-xs text-warning">Sin guardar</span>}
            </div>

            <div className={cn('min-h-0 flex-1 overflow-y-auto bg-muted/30', compacto ? 'p-3' : 'p-4 md:p-5')}>
                {v.estado === 'ANULADA' && (
                    <p className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                        <IconBan size={16} /> Ficha anulada{v.motivo_anulacion ? `: ${v.motivo_anulacion}` : ''}.
                    </p>
                )}
                {v.estado === 'PENDIENTE_FIRMA' && (
                    <p className="mb-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
                        <IconSignature size={16} className="shrink-0 text-warning" />
                        <span>Lecturas cerradas. Falta la firma de <b>{v.muestreador_nombre || 'el muestreador'}</b>.</span>
                    </p>
                )}
                {v.estado === 'FIRMADA' && (
                    <p className="mb-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm">
                        <IconCircleCheck size={16} className="shrink-0 text-success" />
                        <span>
                            Firmada por <b>{v.muestreador_nombre}</b>. El PDF quedó como documento de la revisión de {v.codigo_equipo};
                            siguiente revisión: <b>{fmtFecha(v.siguiente_verificacion)}</b>.
                        </span>
                    </p>
                )}

                {/* Antecedentes (B18:H28 de la hoja), con el estilo de las tarjetas de Mediciones. */}
                <section className={cn('rounded-xl border border-border bg-background', compacto ? 'p-3' : 'p-4')}>
                    <div className={cn('flex flex-wrap items-center gap-2', verAntecedentes && 'mb-3')}>
                        <button
                            type="button"
                            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary"
                            onClick={() => setVerAntecedentes((x) => !x)}
                            title={verAntecedentes ? 'Ocultar antecedentes' : 'Ver antecedentes'}
                        >
                            <IconChevronDown size={14} className={cn('transition-transform', !verAntecedentes && '-rotate-90')} />
                            Antecedentes
                        </button>
                        {!verAntecedentes && <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{resumenAntecedentes}</span>}
                        {verAntecedentes && <span className="text-xs text-muted-foreground">Termómetro verificado y termómetro patrón utilizado</span>}
                        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                            Fecha
                            <Input type="date" className="h-8 w-40 text-sm" value={fecha} max={hoyYmd()} disabled={!editable} onChange={(e) => { setFecha(e.target.value); marcar(); }} />
                        </label>
                    </div>
                    {verAntecedentes && (
                        <>
                            <div className="grid gap-4 @4xl:grid-cols-[2fr_3fr]">
                                <Tarjeta titulo="Antecedentes del Térmómetro">
                                    <div className="-mb-px">
                                        <FilaDato label="Equipo"><span className="block truncate text-sm font-medium">{v.nombre_equipo}</span></FilaDato>
                                        <FilaDato label="Código"><span className="block text-sm font-semibold">{v.codigo_equipo}</span></FilaDato>
                                        <FilaDato label="Máxima división"><ValorFijo valor={MAXIMA_DIVISION_FIJA} /></FilaDato>
                                        <FilaDato label="Muestreador que firma">
                                            {editable ? (
                                                <Combobox
                                                    value={idMuestreador}
                                                    onValueChange={(x) => { setIdMuestreador(x); marcar(); }}
                                                    placeholder="Seleccione quién firma"
                                                    searchPlaceholder="Buscar muestreador..."
                                                    options={muestreadores.map((m) => ({ value: String(m.id_muestreador), label: `${m.nombre_muestreador}${m.habilitado !== 'S' ? ' (Inactivo)' : ''}` }))}
                                                />
                                            ) : <span className="block truncate text-sm">{v.muestreador_nombre || muestreadorNombre || '—'}</span>}
                                        </FilaDato>
                                    </div>
                                </Tarjeta>

                                <Tarjeta
                                    titulo="Antecedentes del Térmómetro Patrón"
                                    accion={editable && Number(idPatron) !== v.id_patron && idPatron
                                        ? <span className="flex items-center gap-1 text-[11px] text-warning"><IconInfoCircle size={12} /> Se tomará su error actual</span>
                                        : undefined}
                                >
                                    <div className="border-b border-border/60 px-3 py-2">
                                        {editable ? (
                                            <Combobox
                                                value={idPatron}
                                                onValueChange={(x) => {
                                                    setIdPatron(x);
                                                    setAntecedentes(antecedentesTexto(patrones.find((p) => String(p.id_equipo) === x)?.antecedentes));
                                                    marcar();
                                                }}
                                                placeholder="Seleccione el patrón"
                                                options={patrones.map((p) => ({ value: String(p.id_equipo), label: `${p.nombre} (${p.codigo})` }))}
                                            />
                                        ) : <span className="block text-sm font-medium">{v.patron_nombre} ({v.patron_codigo})</span>}
                                    </div>
                                    {/* 2 columnas solo si hay ancho (ventana de una ficha); en la mesa, una: cada dato se lee completo. */}
                                    <div className="-mb-px grid @2xl:grid-cols-2">
                                        {CAMPOS_PATRON.map(({ campo, label, tipo, placeholder, fijo }) => (
                                            <FilaDato key={campo} label={label} angosta={!compacto}>
                                                {fijo ? <ValorFijo valor={fijo} /> : (
                                                    <Input
                                                        type={tipo || 'text'}
                                                        className="h-8 text-sm"
                                                        value={antecedentes[campo]}
                                                        placeholder={editable ? placeholder : undefined}
                                                        disabled={!editable}
                                                        max={tipo === 'date' ? hoyYmd() : undefined}
                                                        onChange={(e) => { setAntecedentes((prev) => ({ ...prev, [campo]: e.target.value })); marcar(); }}
                                                    />
                                                )}
                                            </FilaDato>
                                        ))}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 border-t bg-muted/40 px-3 py-2">
                                        <span className="text-xs text-muted-foreground">Error</span>
                                        <div className="ml-auto grid grid-cols-3 gap-2">
                                            {RANGOS.map((r) => (
                                                <div key={r} className="min-w-[72px] rounded-md border border-border bg-background px-2 py-1 text-center">
                                                    <p className="text-[10px] text-muted-foreground">{({ 0: '0,0 °', 15: '15,0°', 30: '30,0°' } as Record<number, string>)[r]}</p>
                                                    <p className="text-sm font-bold tabular-nums">{fmt1(errPatron[r])}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Tarjeta>
                            </div>
                            {editable && (
                                <p className="mt-2 text-[11px] text-muted-foreground">
                                    El error del patrón se descuenta de cada lectura TP. Los antecedentes se guardan con el patrón: la próxima ficha que lo use los trae ya llenos.
                                </p>
                            )}
                        </>
                    )}
                </section>

                {/* Mediciones */}
                <section className={cn('mt-4 rounded-xl border border-border bg-background', compacto ? 'p-3' : 'p-4')}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">Mediciones</h3>
                        <span className="text-xs text-muted-foreground">
                            Al escribir la TP se marca la hora y queda fija · TFP = TP − error patrón · Error = TC − TFP
                        </span>
                        {editable && (tpPendientes > 0 || tcPendientes > 0) && (
                            <Badge variant="warning" className="ml-auto">{Math.max(tpPendientes, tcPendientes)} lectura(s) por completar</Badge>
                        )}
                    </div>
                    <div className="grid gap-4 @6xl:grid-cols-3">
                        {RANGOS.map((r) => {
                            const k = String(r) as Rango;
                            const d = calc.rangos[r];
                            return (
                                <div key={r} className={cn('overflow-hidden rounded-lg border', d.cumple === false ? 'border-destructive/40' : 'border-border')}>
                                    <div className="flex items-center justify-between gap-2 bg-muted/60 px-3 py-2">
                                        <span className="text-sm font-semibold">{r.toFixed(1)}°C</span>
                                    </div>
                                    {/* Mismas columnas y orden que la hoja Excel (C31:H31); en gris las que se calculan. */}
                                    <table className="w-full table-fixed text-sm">
                                        <colgroup>
                                            <col className="w-6" />
                                            <col />
                                            <col className="w-[13%]" />
                                            <col className="w-[13%]" />
                                            <col />
                                            <col className="w-[15%]" />
                                            <col className="w-[13%]" />
                                        </colgroup>
                                        <thead>
                                            <tr className="border-b border-border text-[10.5px] leading-tight text-muted-foreground">
                                                <th className="py-1.5 font-medium">#</th>
                                                <th className="py-1.5 font-medium">Temperatura<br />termómetro<br />patrón (TP)</th>
                                                <th className="bg-muted/50 py-1.5 font-medium">Error<br />termometro<br />patrón</th>
                                                <th className="bg-muted/50 py-1.5 font-medium">Temperatura final<br />termómetro<br />patrón (TFP)</th>
                                                <th className="py-1.5 font-medium">Temperatura<br />termómetro<br />calibrando (TC)</th>
                                                <th className="py-1.5 font-medium">Hora</th>
                                                <th className="bg-muted/50 py-1.5 font-medium">Error de medición<br />TC-TFP</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {lecturas[k].map((f, i) => {
                                                const c = d.filas[i];
                                                const registrada = !!f.hora;
                                                const fuera = registrada && c.error !== null && Math.abs(c.error) > TOLERANCIA;
                                                return (
                                                    <tr key={i} className="border-b border-border/60 last:border-0">
                                                        <td className="text-center text-xs text-muted-foreground">{i + 1}</td>
                                                        <td className="p-1">
                                                            <CeldaTp
                                                                valor={f.tp}
                                                                registrada={registrada}
                                                                hora={f.hora}
                                                                nominal={fmt1(r)}
                                                                disabled={!editable}
                                                                onRegistrar={(x) => registrarTp(k, i, x)}
                                                                onBorrar={() => borrarTp(k, i)}
                                                                celda={`tp-${k}-${i}`}
                                                                onNavegar={navegarCelda}
                                                            />
                                                        </td>
                                                        <td className="bg-muted/50 px-1 text-center text-sm tabular-nums text-muted-foreground">{fmt1(errPatron[r])}</td>
                                                        <td className="bg-muted/50 px-1 text-center text-sm tabular-nums">{registrada ? fmt1(c.tfp) : ''}</td>
                                                        <td className="p-1"><CeldaNum value={f.tc} disabled={!editable} onChange={(x) => setTc(k, i, x)} destacar={registrada} celda={`tc-${k}-${i}`} onNavegar={navegarCelda} /></td>
                                                        <td className={cn('px-1 text-center text-xs tabular-nums', registrada ? 'font-medium' : 'text-muted-foreground')} title={registrada ? `TP registrada a las ${f.hora}` : 'Se marca al escribir la TP'}>
                                                            {f.hora || '—'}
                                                        </td>
                                                        <td className={cn('bg-muted/50 px-1 text-center font-semibold tabular-nums', fuera && 'text-destructive')}>{registrada ? fmt1(c.error) : ''}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    <div className={cn('flex items-center justify-between border-t px-3 py-2', d.cumple === false ? 'border-destructive/30 bg-destructive/5' : d.cumple ? 'border-success/20 bg-success/5' : 'border-border bg-muted/40')}>
                                        <span className="text-xs text-muted-foreground">Promedio · FC {fmtNum(d.fc)}</span>
                                        <span className="flex items-center gap-2">
                                            <span className="text-base font-bold tabular-nums">{fmtNum(d.promedio)}</span>
                                            {d.cumple !== null && <Badge variant={d.cumple ? 'success' : 'destructive'}>{d.cumple ? 'Cumple' : 'No cumple'}</Badge>}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Resumen y Cumple / No Cumple (E53:F61 de la hoja) + observación, con el estilo de Mediciones. */}
                <section className={cn('mt-4 rounded-xl border border-border bg-background', compacto ? 'p-3' : 'p-4')}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">Resultado</h3>
                        <span className="text-xs text-muted-foreground">
                            Rango de aceptación: Error de medición <b className="text-foreground">≤ +/- {fmt1(TOLERANCIA)}°C</b>
                        </span>
                        {calc.cumple === null && <Badge variant="outline" className="ml-auto">Se marca al completar las 15 lecturas</Badge>}
                    </div>
                    <div className="grid gap-4 @3xl:grid-cols-[minmax(240px,300px)_minmax(200px,240px)_1fr]">
                        <Tarjeta titulo="Resumen">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border text-[11px] text-muted-foreground">
                                        <th className="py-1.5 font-medium">Rango Temperatura</th>
                                        <th className="py-1.5 font-medium">Error</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {RANGOS.map((r) => {
                                        const d = calc.rangos[r];
                                        return (
                                            <tr key={r} className="border-b border-border/60 last:border-0">
                                                <td className="py-2 text-center font-medium">{fmt1(r)}°</td>
                                                <td className={cn('py-2 text-center font-bold tabular-nums', d.cumple === false && 'text-destructive')}>
                                                    {fmt1(d.promedio) || '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </Tarjeta>

                        <Tarjeta titulo="Cumple / No Cumple">
                            {[
                                { label: 'Cumple', marcado: calc.cumple === true, tono: 'border-success/40 bg-success/15 text-success' },
                                { label: 'No Cumple', marcado: calc.cumple === false, tono: 'border-destructive/40 bg-destructive/15 text-destructive' },
                            ].map((o) => (
                                <div key={o.label} className={cn('flex items-center justify-between border-b border-border/60 px-3 py-2.5 last:border-0', o.marcado && 'bg-muted/30')}>
                                    <span className={cn('text-sm', o.marcado ? 'font-semibold' : 'text-muted-foreground')}>{o.label}</span>
                                    <span className={cn('flex h-7 w-7 items-center justify-center rounded-md border text-sm font-bold', o.marcado ? o.tono : 'border-border bg-background')}>
                                        {o.marcado ? 'X' : ''}
                                    </span>
                                </div>
                            ))}
                        </Tarjeta>

                        <Tarjeta
                            titulo="Observación"
                            accion={editable
                                ? <span className={cn('text-[11px]', lecturasCompletas && !textoObservacion ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                                    {lecturasCompletas ? (textoObservacion ? 'Obligatoria' : 'Escriba la observación después de la fecha') : 'Se fecha al completar las lecturas'}
                                </span>
                                : undefined}
                            className="flex flex-col"
                        >
                            <div className="flex flex-1 flex-col gap-1.5 p-2">
                                {/* La fecha del comienzo es fija (no se puede borrar): el cuadro solo tiene el texto. */}
                                {fechaObservacion && (
                                    <span className="flex w-fit items-center gap-1.5 rounded-md border border-border bg-muted/60 px-2 py-1 text-sm font-medium tabular-nums" title="Fecha de la verificación: se agrega sola y no se puede borrar">
                                        {fechaObservacion.trim()}
                                        <IconLock size={11} className="text-muted-foreground" />
                                    </span>
                                )}
                                <Textarea
                                    rows={compacto ? 3 : 5}
                                    maxLength={2000 - (fechaObservacion?.length ?? 0)}
                                    className={cn('flex-1 resize-none', editable && lecturasCompletas && !textoObservacion && 'border-destructive/50')}
                                    placeholder={lecturasCompletas ? 'Ej: Sonda nueva, cambio de cartridge, se envía a servicio técnico...' : 'Al completar las 15 lecturas se agrega la fecha y se escribe la observación.'}
                                    value={fechaObservacion ? observacion.slice(fechaObservacion.length) : observacion}
                                    disabled={!editable}
                                    onChange={(e) => { setObservacion((fechaObservacion ?? '') + e.target.value); marcar(); }}
                                />
                            </div>
                        </Tarjeta>
                    </div>
                </section>
            </div>

            {/* Acciones de esta ficha */}
            <div className={cn('flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-background', compacto ? 'px-3 py-2' : 'px-5 py-3')}>
                {/* Borrador: se elimina (no queda registro). Enviada a firma: se anula. */}
                {editable && (
                    <Button variant="ghost" size={compacto ? 'sm' : 'default'} className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setEliminarAbierto(true)} disabled={!!accion} title="Eliminar esta ficha en borrador sin guardarla">
                        <IconTrash size={15} /> Eliminar
                    </Button>
                )}
                {v.estado === 'PENDIENTE_FIRMA' && (
                    <Button variant="ghost" size={compacto ? 'sm' : 'default'} className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setAnularAbierto(true)} disabled={!!accion}>
                        <IconBan size={15} /> Anular
                    </Button>
                )}
                {editable && sucio && (
                    <Button variant="ghost" size={compacto ? 'sm' : 'default'} onClick={descartar} disabled={!!accion} title="Volver a lo último guardado">
                        {accion === 'descartar' ? <Spinner /> : <IconRestore size={15} />} Descartar cambios
                    </Button>
                )}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    {v.estado !== 'ANULADA' && (
                        <Button variant="outline" size={compacto ? 'sm' : 'default'} onClick={verPdf} disabled={!!accion}>
                            {accion === 'pdf' ? <Spinner /> : <IconFileTypePdf size={15} />}
                            {compacto ? 'PDF' : v.estado === 'FIRMADA' ? 'Ver PDF' : 'Vista previa PDF'}
                        </Button>
                    )}
                    {editable && (
                        <Button variant="outline" size={compacto ? 'sm' : 'default'} onClick={() => ejecutar('guardar', async () => { await guardar(); })} disabled={!!accion || !sucio}>
                            {accion === 'guardar' ? <Spinner /> : <IconDeviceFloppy size={15} />} Guardar
                        </Button>
                    )}
                    {v.estado === 'PENDIENTE_FIRMA' && (
                        <Button variant="outline" size={compacto ? 'sm' : 'default'} onClick={volverBorrador} disabled={!!accion}>
                            {accion === 'volver' ? <Spinner /> : <IconArrowBackUp size={15} />} Volver a editar
                        </Button>
                    )}
                    {(editable || v.estado === 'PENDIENTE_FIRMA') && (
                        <Button
                            size={compacto ? 'sm' : 'default'}
                            onClick={firmar}
                            disabled={!!accion || (editable && !!faltaParaFirmar)}
                            title={editable && faltaParaFirmar ? faltaParaFirmar : `Firmar la ficha de ${v.codigo_equipo}`}
                        >
                            {accion === 'firmar' ? <Spinner light /> : <IconSignature size={15} />} Firmar
                        </Button>
                    )}
                    {v.estado === 'FIRMADA' && (
                        <Button size={compacto ? 'sm' : 'default'} variant="outline" disabled className="border-success/40 text-success disabled:opacity-100">
                            <IconCircleCheck size={15} /> Firmada
                        </Button>
                    )}
                </div>
            </div>

            <PdfViewerModal
                open={pdfAbierto}
                onClose={() => setPdfAbierto(false)}
                url={pdfUrl}
                title={`OI-FoGe-39 · ${v.codigo_equipo}${v.estado !== 'FIRMADA' ? ' (vista previa, sin firma)' : ''}`}
            />

            <FirmaMuestreadorDialog
                verificacion={firmaAbierta ? v : null}
                onClose={() => setFirmaAbierta(false)}
                onFirmado={(d) => {
                    setFirmaAbierta(false);
                    cargarEn(d);
                    onChanged();
                    showToast({ type: 'success', message: `Ficha de ${d.codigo_equipo} firmada` });
                }}
            />

            <EliminarFichaDialog
                ficha={eliminarAbierto ? v : null}
                eliminando={accion === 'eliminar'}
                onConfirmar={eliminar}
                onCancelar={() => setEliminarAbierto(false)}
            />

            <Dialog open={anularAbierto} onOpenChange={(o) => { if (!o && accion !== 'anular') setAnularAbierto(false); }}>
                <DialogContent className="max-w-md gap-4">
                    <DialogHeader>
                        <DialogTitle>¿Anular esta ficha?</DialogTitle>
                        <DialogDescription>{v.codigo_equipo} · {nombrePeriodo(v.periodo)}. La ficha queda registrada como anulada y no afecta al equipo.</DialogDescription>
                    </DialogHeader>
                    <Textarea rows={3} autoFocus placeholder="Motivo de la anulación (obligatorio)" value={motivoAnular} onChange={(e) => setMotivoAnular(e.target.value)} className="resize-none" />
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setAnularAbierto(false)} disabled={accion === 'anular'}>Cancelar</Button>
                        <Button variant="destructive" onClick={anular} disabled={!motivoAnular.trim() || accion === 'anular'}>
                            {accion === 'anular' ? <Spinner light /> : <IconBan size={15} />} Anular ficha
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
});
FichaTempPanel.displayName = 'FichaTempPanel';

// Confirmación para eliminar una ficha en borrador (desde la ficha o desde la lista).
export const EliminarFichaDialog: React.FC<{
    ficha: { codigo_equipo: string; nombre_equipo?: string; periodo: string } | null;
    eliminando: boolean; onConfirmar: () => void; onCancelar: () => void;
}> = ({ ficha, eliminando, onConfirmar, onCancelar }) => (
    <Dialog open={!!ficha} onOpenChange={(o) => { if (!o && !eliminando) onCancelar(); }}>
        <DialogContent className="max-w-md gap-5" showCloseButton={!eliminando}>
            <DialogHeader className="items-center text-center sm:text-center">
                <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <IconTrash size={24} />
                </div>
                <DialogTitle>¿Eliminar la ficha de {ficha?.codigo_equipo}?</DialogTitle>
                <DialogDescription>
                    {ficha?.nombre_equipo ? `${ficha.nombre_equipo} · ` : ''}{ficha ? nombrePeriodo(ficha.periodo) : ''}.
                    Se borra todo lo ingresado (lecturas, antecedentes y observación) y no queda guardada.
                    El equipo no cambia y se puede volver a crear su ficha.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-center">
                <Button variant="outline" onClick={onCancelar} disabled={eliminando}>Cancelar</Button>
                <Button variant="destructive" onClick={onConfirmar} disabled={eliminando}>
                    {eliminando ? <Spinner light /> : <IconTrash size={15} />} Eliminar ficha
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);

// Ventana "¿Hay cambios sin guardar?" al cerrar (una ficha o la mesa completa).
const ConfirmarCierre: React.FC<{
    open: boolean; detalle: React.ReactNode; guardando: boolean;
    onGuardarYCerrar: () => void; onCerrarSinGuardar: () => void; onSeguir: () => void;
}> = ({ open, detalle, guardando, onGuardarYCerrar, onCerrarSinGuardar, onSeguir }) => (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !guardando) onSeguir(); }}>
        <DialogContent className="max-w-md gap-5" showCloseButton={!guardando}>
            <DialogHeader className="items-center text-center sm:text-center">
                <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
                    <IconAlertTriangle size={24} />
                </div>
                <DialogTitle>Hay cambios sin guardar</DialogTitle>
                <DialogDescription>{detalle}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
                <Button onClick={onGuardarYCerrar} disabled={guardando}>
                    {guardando ? <Spinner light /> : <IconDeviceFloppy size={15} />}
                    {guardando ? 'Guardando...' : 'Guardar y cerrar'}
                </Button>
                <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onCerrarSinGuardar} disabled={guardando}>
                    Cerrar sin guardar
                </Button>
                <Button variant="ghost" onClick={onSeguir} disabled={guardando}>Seguir editando</Button>
            </div>
        </DialogContent>
    </Dialog>
);

interface Props {
    idVerificacion: number | null;
    onClose: () => void;
    onChanged: () => void;
}

// Una ficha sola, en ventana completa.
export const VerificacionTempEditor: React.FC<Props> = ({ idVerificacion, onClose, onChanged }) => {
    const { showToast } = useToast();
    const panelRef = useRef<FichaTempPanelHandle>(null);
    const [sucio, setSucio] = useState(false);
    const [confirmar, setConfirmar] = useState(false);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => { setSucio(false); setConfirmar(false); }, [idVerificacion]);

    const cerrar = () => { if (sucio) setConfirmar(true); else onClose(); };
    const guardarYCerrar = async () => {
        setGuardando(true);
        try {
            await panelRef.current?.guardar();
            setConfirmar(false);
            onClose();
        } catch (err) {
            showToast({ type: 'error', message: mensajeError(err, 'No se pudo guardar la ficha') });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Dialog open={!!idVerificacion} onOpenChange={(open) => { if (!open) cerrar(); }}>
            <DialogContent className="flex h-[95vh] w-[98vw] max-w-[1680px] flex-col gap-0 overflow-hidden p-0">
                <DialogTitle className="sr-only">OI-FoGe-39 · Verificación Intermedia de Temperatura</DialogTitle>
                <DialogDescription className="sr-only">Ficha de verificación de temperatura</DialogDescription>
                {idVerificacion && (
                    <FichaTempPanel ref={panelRef} idVerificacion={idVerificacion} onChanged={onChanged} onSucioChange={setSucio} onAnulada={onClose} onEliminada={onClose} />
                )}
            </DialogContent>
            <ConfirmarCierre
                open={confirmar}
                detalle="Modificó la ficha y aún no la guardó. Si cierra sin guardar, se perderán los datos ingresados desde el último guardado."
                guardando={guardando}
                onGuardarYCerrar={guardarYCerrar}
                onCerrarSinGuardar={() => { setConfirmar(false); onClose(); }}
                onSeguir={() => setConfirmar(false)}
            />
        </Dialog>
    );
};

// Mesa de trabajo: varias fichas lado a lado para llenar los equipos que están
// en la mesa al mismo tiempo. Cada ficha se guarda y se firma por separado; al
// firmar una, las demás siguen abiertas.
export const MesaVerificacionTemp: React.FC<{ ids: number[]; onClose: () => void; onChanged: () => void; onQuitar: (id: number) => void }> = ({ ids, onClose, onChanged, onQuitar }) => {
    const { showToast } = useToast();
    const refs = useRef<Record<number, FichaTempPanelHandle | null>>({});
    const [sucias, setSucias] = useState<Record<number, boolean>>({});
    const [confirmar, setConfirmar] = useState(false);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => { setSucias({}); setConfirmar(false); }, [ids]);

    const cambiar = useMemo(
        () => Object.fromEntries(ids.map((id) => [id, (s: boolean) => setSucias((prev) => (prev[id] === s ? prev : { ...prev, [id]: s }))])),
        [ids],
    ) as Record<number, (s: boolean) => void>;

    const pendientes = ids.filter((id) => sucias[id]);
    const cerrar = () => { if (pendientes.length) setConfirmar(true); else onClose(); };
    const guardarYCerrar = async () => {
        setGuardando(true);
        try {
            for (const id of pendientes) await refs.current[id]?.guardar();
            setConfirmar(false);
            onClose();
        } catch (err) {
            showToast({ type: 'error', message: mensajeError(err, 'No se pudo guardar una de las fichas') });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Dialog open={ids.length > 0} onOpenChange={(open) => { if (!open) cerrar(); }}>
            <DialogContent className="flex h-[96vh] w-[99vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
                <DialogHeader className="shrink-0 space-y-0 border-b border-border px-5 py-3 pr-12">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <IconLayoutColumns size={20} />
                        </div>
                        <div className="min-w-0 text-left">
                            <DialogTitle className="text-base">Mesa de verificación · {ids.length} equipo{ids.length === 1 ? '' : 's'}</DialogTitle>
                            <DialogDescription className="text-xs">
                                Llene las fichas en paralelo. Cada TP marca su hora al escribirla y se guarda sola; cada equipo se firma por separado.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>
                <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto bg-muted/40 p-3">
                    {ids.map((id) => (
                        <div key={id} className="flex min-h-0 min-w-[520px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                            <FichaTempPanel
                                ref={(h) => { refs.current[id] = h; }}
                                idVerificacion={id}
                                compacto
                                onChanged={onChanged}
                                onSucioChange={cambiar[id]}
                                onEliminada={() => onQuitar(id)}
                            />
                        </div>
                    ))}
                </div>
            </DialogContent>
            <ConfirmarCierre
                open={confirmar}
                detalle={`Hay ${pendientes.length} ficha(s) con cambios sin guardar. Si cierra sin guardar, se perderán los datos ingresados desde el último guardado.`}
                guardando={guardando}
                onGuardarYCerrar={guardarYCerrar}
                onCerrarSinGuardar={() => { setConfirmar(false); onClose(); }}
                onSeguir={() => setConfirmar(false)}
            />
        </Dialog>
    );
};

// Tarjeta con barra de título gris, igual a las de cada rango en Mediciones.
const Tarjeta: React.FC<{ titulo: React.ReactNode; accion?: React.ReactNode; className?: string; children: React.ReactNode }> = ({ titulo, accion, className, children }) => (
    <div className={cn('overflow-hidden rounded-lg border border-border', className)}>
        <div className="flex min-h-[40px] items-center justify-between gap-2 bg-muted/60 px-3 py-2">
            <span className="text-sm font-semibold">{titulo}</span>
            {accion}
        </div>
        {children}
    </div>
);

// Fila etiqueta / valor con separador suave, como las filas de lecturas.
const FilaDato: React.FC<{ label: string; angosta?: boolean; children: React.ReactNode }> = ({ label, angosta, children }) => (
    <div className="flex items-center gap-2 border-b border-border/60 px-3 py-1.5">
        <span className={cn('shrink-0 text-xs text-muted-foreground', angosta ? 'w-28' : 'w-36')}>{label}</span>
        <div className="min-w-0 flex-1">{children}</div>
    </div>
);

// Valor fijo del formulario (no se edita).
const ValorFijo: React.FC<{ valor: string }> = ({ valor }) => (
    <span className="flex h-8 items-center gap-1.5 text-sm font-semibold" title="Valor fijo del formulario, no se modifica">
        {valor}
        <IconLock size={12} className="text-muted-foreground" />
    </span>
);

// Formato de la planilla (#,##0.0): siempre 1 decimal.
const fmt1 = (n: number | null | undefined) => (n === null || n === undefined || Number.isNaN(Number(n))
    ? ''
    : (Math.round(Number(n) * 10) / 10 + 0).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

// TP: mientras no se registra, la celda está vacía (el nominal del rango queda
// de guía). Al confirmar con Enter o al salir de la celda se registra: la fila
// toma la hora actual y la TP queda bloqueada. No se edita: solo se puede
// borrar con la × (borra también la hora) y volver a escribir.
const CeldaTp: React.FC<{
    valor: string; registrada: boolean; hora: string; nominal: string; disabled?: boolean;
    onRegistrar: (v: string) => void; onBorrar: () => void; celda: string; onNavegar: (celda: string, paso: 1 | -1) => void;
}> = ({ valor, registrada, hora, nominal, disabled, onRegistrar, onBorrar, celda, onNavegar }) => {
    const [borrador, setBorrador] = useState('');
    if (registrada) {
        return (
            <div className="group relative flex h-8 items-center justify-center gap-1 rounded-md bg-muted/50 px-1.5 text-sm font-medium tabular-nums" title={`Registrada a las ${hora}. No se puede modificar.`}>
                {valor}
                <IconLock size={11} className="shrink-0 text-muted-foreground" />
                {!disabled && (
                    <button
                        type="button"
                        onClick={onBorrar}
                        className="absolute right-1 flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        title="Borrar esta TP y su hora para volver a registrarla"
                        aria-label="Borrar temperatura TP"
                    >
                        <IconX size={13} />
                    </button>
                )}
            </div>
        );
    }
    const registrar = () => {
        if (parseNum(borrador) !== null) onRegistrar(borrador);
        setBorrador('');
    };
    return (
        <Input
            inputMode="decimal"
            data-celda={celda}
            title="Escriba la temperatura del patrón: al confirmarla se marca la hora y queda fija."
            className={cn('h-8 px-1.5 text-center text-sm tabular-nums', !disabled && 'border-primary/40 bg-primary/5')}
            value={borrador}
            placeholder={nominal}
            disabled={disabled}
            onBlur={registrar}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Tab') {
                    if (e.key === 'Enter') e.preventDefault();
                    registrar();
                    if (e.key === 'Enter') onNavegar(celda, 1);
                }
                if (e.key === 'ArrowUp') { e.preventDefault(); onNavegar(celda, -1); }
            }}
            onChange={(e) => setBorrador(e.target.value.replace(/[^0-9.,-]/g, ''))}
        />
    );
};

// TC: celda numérica libre. Enter / flecha abajo pasan a la TP de la lectura
// siguiente; flecha arriba, a la TC anterior.
const CeldaNum: React.FC<{
    value: string; onChange: (v: string) => void; disabled?: boolean; destacar?: boolean;
    celda: string; onNavegar: (celda: string, paso: 1 | -1) => void;
}> = ({ value, onChange, disabled, destacar, celda, onNavegar }) => (
    <Input
        inputMode="decimal"
        data-celda={celda}
        className={cn('h-8 px-1.5 text-center text-sm tabular-nums', destacar && !value && !disabled && 'border-primary/40 bg-primary/5')}
        value={value}
        disabled={disabled}
        onFocus={(e) => e.currentTarget.select()}
        onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); onNavegar(celda, 1); }
            if (e.key === 'ArrowUp') { e.preventDefault(); onNavegar(celda, -1); }
        }}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,-]/g, ''))}
    />
);

const Spinner: React.FC<{ light?: boolean }> = ({ light }) => (
    <span className={cn('h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent', light ? 'border-primary-foreground' : 'border-current')} />
);
