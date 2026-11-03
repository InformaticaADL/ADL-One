import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    IconTemperature, IconDeviceFloppy, IconSend, IconFileTypePdf, IconSignature, IconArrowBackUp,
    IconBan, IconCircleCheck, IconAlertTriangle, IconCopy, IconInfoCircle,
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

type Rango = '0' | '15' | '30';
type FilaTexto = { tp: string; tc: string; hora: string };

// Campos de "Antecedentes del Termómetro Patrón", en el orden de la hoja Excel.
type CampoPatron = keyof AntecedentesPatron;
const CAMPOS_PATRON: { campo: CampoPatron; label: string; tipo?: 'date'; placeholder?: string }[] = [
    { campo: 'patron_marca', label: 'Marca' },
    { campo: 'patron_modelo', label: 'Modelo' },
    { campo: 'patron_serie', label: 'N° Serie' },
    { campo: 'patron_identificacion', label: 'Identificación especial' },
    { campo: 'patron_intervalo', label: 'Intervalo Indicación', placeholder: 'Ej: -50 a 150 °C' },
    { campo: 'patron_fecha_calibracion', label: 'Fecha Calibración', tipo: 'date' },
    { campo: 'patron_empresa', label: 'Empresa' },
    { campo: 'patron_maxima_division', label: 'Máxima división', placeholder: 'Ej: 0,1 °C' },
];
type AntecedentesTexto = Record<CampoPatron, string>;
const antecedentesTexto = (a?: Partial<AntecedentesPatron> | null): AntecedentesTexto =>
    Object.fromEntries(CAMPOS_PATRON.map(({ campo }) => [campo, (a?.[campo] ?? '').toString().slice(0, campo === 'patron_fecha_calibracion' ? 10 : undefined)])) as AntecedentesTexto;
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

// Por cada celda de las lecturas 2-5: true si se escribió a mano (ya no sigue a la lectura 1).
type Fijadas = Record<Rango, Record<keyof FilaTexto, boolean>[]>;
const SIN_FIJAR = { tp: false, tc: false, hora: false };

// Al abrir una ficha guardada, las celdas que difieren de la lectura 1 se
// consideran escritas a mano, para no pisarlas al cambiar la primera.
const fijadasAlCargar = (t: LecturasTexto | null): Fijadas => Object.fromEntries(
    RANGOS.map((r) => {
        const filas = t?.[String(r) as Rango] || [];
        return [String(r), Array.from({ length: 5 }, (_, k) => (k === 0 || !filas[k]
            ? { ...SIN_FIJAR }
            : {
                tp: filas[k].tp !== valorAuto('tp', filas[0].tp, k),
                tc: filas[k].tc !== valorAuto('tc', filas[0].tc, k),
                hora: filas[k].hora !== valorAuto('hora', filas[0].hora, k),
            }))];
    }),
) as Fijadas;

// Lo que la lectura k (0-4) toma de la lectura 1. TP y TC se repiten; la hora
// avanza 1 minuto por lectura, como en la planilla (14:20, 14:21, … 14:24).
function valorAuto(campo: keyof FilaTexto, valorPrimera: string, k: number): string {
    if (campo !== 'hora' || !valorPrimera || k === 0) return valorPrimera;
    const [h, m] = valorPrimera.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return valorPrimera;
    const total = (h * 60 + m + k) % (24 * 60);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

const mensajeError = (err: unknown, def: string) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message || def;

interface Props {
    idVerificacion: number | null;
    onClose: () => void;
    onChanged: () => void;
}

// Formulario web del OI-FoGe-39. Mismas secciones que la hoja Excel: antecedentes
// del termómetro, termómetro patrón, mediciones (5 por rango), resumen y
// observación. Los cálculos se ven en vivo; el backend los recalcula al guardar.
export const VerificacionTempEditor: React.FC<Props> = ({ idVerificacion, onClose, onChanged }) => {
    const { showToast } = useToast();
    const [v, setV] = useState<VerificacionDetalle | null>(null);
    const [patrones, setPatrones] = useState<PatronTemp[]>([]);
    const [muestreadores, setMuestreadores] = useState<MuestreadorFirma[]>([]);
    const [cargando, setCargando] = useState(false);

    const [fecha, setFecha] = useState('');
    const [maxDiv, setMaxDiv] = useState('');
    const [idPatron, setIdPatron] = useState('');
    const [idMuestreador, setIdMuestreador] = useState('');
    const [observacion, setObservacion] = useState('');
    const [antecedentes, setAntecedentes] = useState<AntecedentesTexto>(() => antecedentesTexto(null));
    const [lecturas, setLecturas] = useState<LecturasTexto | null>(null);
    const [sucio, setSucio] = useState(false);
    const [manual, setManual] = useState<Fijadas>(() => fijadasAlCargar(null));

    const [accion, setAccion] = useState<string | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [pdfAbierto, setPdfAbierto] = useState(false);
    const [firmaAbierta, setFirmaAbierta] = useState(false);
    const [anularAbierto, setAnularAbierto] = useState(false);
    const [motivoAnular, setMotivoAnular] = useState('');
    const [confirmarCierre, setConfirmarCierre] = useState(false);

    const cargarEn = useCallback((d: VerificacionDetalle) => {
        setV(d);
        setFecha(d.fecha_verificacion);
        setMaxDiv(d.maxima_division || '');
        setIdPatron(d.id_patron ? String(d.id_patron) : '');
        setIdMuestreador(d.id_muestreador ? String(d.id_muestreador) : '');
        setObservacion(d.observacion || '');
        setAntecedentes(antecedentesTexto(d));
        const texto = aTexto(d.lecturas);
        setLecturas(texto);
        setManual(fijadasAlCargar(texto));
        setSucio(false);
    }, []);

    useEffect(() => {
        if (!idVerificacion) { setV(null); return; }
        setCargando(true);
        Promise.all([api.obtener(idVerificacion), api.patrones(), api.muestreadores()])
            .then(([d, p, m]) => { cargarEn(d); setPatrones(p); setMuestreadores(m); })
            .catch((err) => { showToast({ type: 'error', message: mensajeError(err, 'No se pudo abrir la ficha') }); onClose(); })
            .finally(() => setCargando(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idVerificacion]);

    useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

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

    // Llenado automático, como se usa la planilla: en ~79% de los rangos las 5
    // lecturas son idénticas, así que lo escrito en la lectura 1 se copia a las
    // lecturas 2-5. Una celda que se edita a mano queda "fija" y deja de seguir
    // a la 1; si se vacía, vuelve a seguirla.
    const setCelda = (r: Rango, i: number, campo: keyof FilaTexto, valor: string) => {
        if (i === 0) {
            setLecturas((prev) => prev && ({
                ...prev,
                [r]: prev[r].map((f, k) => (k === 0 || !manual[r][k][campo] ? { ...f, [campo]: valorAuto(campo, valor, k) } : f)),
            }));
        } else {
            setManual((prev) => ({
                ...prev,
                [r]: prev[r].map((m, k) => (k === i ? { ...m, [campo]: valor !== '' } : m)),
            }));
            setLecturas((prev) => prev && ({
                ...prev,
                [r]: prev[r].map((f, k) => (k === i ? { ...f, [campo]: valor === '' ? valorAuto(campo, prev[r][0][campo], k) : valor } : f)),
            }));
        }
        setSucio(true);
    };

    // Vuelve a igualar las lecturas 2-5 a la 1 y les quita lo "fijo".
    const repetirPrimera = (r: Rango) => {
        setLecturas((prev) => prev && ({
            ...prev,
            [r]: prev[r].map((f, k) => (k === 0 ? f : {
                tp: prev[r][0].tp, tc: prev[r][0].tc, hora: valorAuto('hora', prev[r][0].hora, k),
            })),
        }));
        setManual((prev) => ({ ...prev, [r]: prev[r].map(() => ({ ...SIN_FIJAR })) }));
        setSucio(true);
    };

    const guardar = async (silencioso = false) => {
        if (!v || !lecturas) return null;
        const d = await api.actualizar(v.id_verificacion, {
            fecha_verificacion: fecha,
            maxima_division: maxDiv,
            id_patron: idPatron ? Number(idPatron) : undefined,
            lecturas: aNumeros(lecturas),
            observacion,
            id_muestreador: idMuestreador ? Number(idMuestreador) : null,
            patron_antecedentes: Object.fromEntries(CAMPOS_PATRON.map(({ campo }) => [campo, antecedentes[campo].trim() || null])) as unknown as AntecedentesPatron,
        });
        cargarEn(d);
        onChanged();
        if (!silencioso) showToast({ type: 'success', message: 'Ficha guardada' });
        return d;
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

    const enviarFirma = () => ejecutar('enviar', async () => {
        if (sucio) await guardar(true);
        const d = await api.enviarFirma(v!.id_verificacion);
        cargarEn(d);
        onChanged();
        showToast({ type: 'success', message: 'Ficha lista para la firma del muestreador' });
    });

    const volverBorrador = () => ejecutar('volver', async () => {
        const d = await api.volverBorrador(v!.id_verificacion);
        cargarEn(d);
        onChanged();
    });

    const anular = () => ejecutar('anular', async () => {
        await api.anular(v!.id_verificacion, motivoAnular.trim());
        setAnularAbierto(false);
        setMotivoAnular('');
        onChanged();
        showToast({ type: 'success', message: 'Ficha anulada' });
        onClose();
    });

    // Con cambios sin guardar se pregunta con una ventana propia (no window.confirm).
    const cerrar = () => {
        if (sucio && editable) { setConfirmarCierre(true); return; }
        onClose();
    };

    const guardarYCerrar = () => ejecutar('guardar-cerrar', async () => {
        await guardar(true);
        showToast({ type: 'success', message: 'Ficha guardada' });
        setConfirmarCierre(false);
        onClose();
    });

    // Mueve el foco a la lectura siguiente/anterior de la misma columna (TP o TC);
    // al pasar la 5ª sigue en la 1ª del rango siguiente (0 → 15 → 30).
    const navegarCelda = (celda: string, paso: 1 | -1) => {
        const [col, rango, fila] = celda.split('-');
        const orden = RANGOS.map(String);
        let ri = orden.indexOf(rango);
        let i = Number(fila) + paso;
        if (i > 4) { ri += 1; i = 0; }
        if (i < 0) { ri -= 1; i = 4; }
        if (ri < 0 || ri >= orden.length) return;
        document.querySelector<HTMLInputElement>(`[data-celda="${col}-${orden[ri]}-${i}"]`)?.focus();
    };

    const meta = v ? ESTADO_META[v.estado] : null;
    const muestreadorNombre = muestreadores.find((m) => String(m.id_muestreador) === idMuestreador)?.nombre_muestreador;
    const faltantes = calc ? RANGOS.reduce<number>((s, r) => s + (5 - calc.rangos[r].completas), 0) : 15;

    return (
        <Dialog open={!!idVerificacion} onOpenChange={(open) => { if (!open && !accion) cerrar(); }}>
            <DialogContent className="flex h-[95vh] w-[98vw] max-w-[1680px] flex-col gap-0 overflow-hidden p-0" showCloseButton={!accion}>
                <DialogHeader className="shrink-0 space-y-0 border-b border-border px-5 py-3 pr-12">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <IconTemperature size={22} />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                            <DialogTitle className="truncate text-base">
                                OI-FoGe-39 · Verificación Intermedia de Temperatura
                            </DialogTitle>
                            <DialogDescription className="truncate text-xs">
                                {v ? `${v.codigo_equipo} · ${v.nombre_equipo} · Sede ${v.sede} · ${nombrePeriodo(v.periodo)} · Ficha N° ${v.id_verificacion}` : 'Cargando...'}
                            </DialogDescription>
                        </div>
                        {meta && <Badge variant={meta.badge}>{meta.label}</Badge>}
                        {sucio && editable && <span className="text-xs text-warning">Cambios sin guardar</span>}
                    </div>
                </DialogHeader>

                {cargando || !v || !lecturas || !calc ? (
                    <div className="flex flex-1 items-center justify-center">
                        <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 p-4 md:p-5">
                        {v.estado === 'ANULADA' && (
                            <p className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                                <IconBan size={16} /> Ficha anulada{v.motivo_anulacion ? `: ${v.motivo_anulacion}` : ''}.
                            </p>
                        )}
                        {v.estado === 'PENDIENTE_FIRMA' && (
                            <p className="mb-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3 text-sm">
                                <IconSignature size={16} className="text-warning" />
                                Lecturas cerradas. Falta la firma de <b>{v.muestreador_nombre || 'el muestreador'}</b>: recién ahí se guarda el PDF en el equipo y se actualiza su revisión.
                            </p>
                        )}
                        {v.estado === 'FIRMADA' && (
                            <p className="mb-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm">
                                <IconCircleCheck size={16} className="text-success" />
                                Firmada por <b>{v.muestreador_nombre}</b>. El PDF quedó como documento de la revisión de {v.codigo_equipo};
                                siguiente revisión: <b>{fmtFecha(v.siguiente_verificacion)}</b>.
                            </p>
                        )}

                        {/* Antecedentes (B18:H28 de la hoja), con el estilo de las tarjetas de Mediciones. */}
                        <section className="rounded-xl border border-border bg-background p-4">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">Antecedentes</h3>
                                <span className="text-xs text-muted-foreground">Termómetro verificado y termómetro patrón utilizado</span>
                                <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                                    Fecha
                                    <Input type="date" className="h-8 w-40 text-sm" value={fecha} max={hoyYmd()} disabled={!editable} onChange={(e) => { setFecha(e.target.value); setSucio(true); }} />
                                </label>
                            </div>
                            <div className="grid gap-4 xl:grid-cols-[2fr_3fr]">
                                <Tarjeta titulo="Antecedentes del Térmómetro">
                                    <div className="-mb-px">
                                        <FilaDato label="Equipo"><span className="block truncate text-sm font-medium">{v.nombre_equipo}</span></FilaDato>
                                        <FilaDato label="Código"><span className="block text-sm font-semibold">{v.codigo_equipo}</span></FilaDato>
                                        <FilaDato label="Máxima división">
                                            <Input className="h-8 text-sm" placeholder={editable ? 'Ej: 0,1 °C' : undefined} value={maxDiv} disabled={!editable} onChange={(e) => { setMaxDiv(e.target.value); setSucio(true); }} />
                                        </FilaDato>
                                        <FilaDato label="Muestreador que firma">
                                            {editable ? (
                                                <Combobox
                                                    value={idMuestreador}
                                                    onValueChange={(x) => { setIdMuestreador(x); setSucio(true); }}
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
                                                    setSucio(true);
                                                }}
                                                placeholder="Seleccione el patrón"
                                                options={patrones.map((p) => ({ value: String(p.id_equipo), label: `${p.nombre} (${p.codigo})` }))}
                                            />
                                        ) : <span className="block text-sm font-medium">{v.patron_nombre} ({v.patron_codigo})</span>}
                                    </div>
                                    <div className="-mb-px grid sm:grid-cols-2">
                                        {CAMPOS_PATRON.map(({ campo, label, tipo, placeholder }) => (
                                            <FilaDato key={campo} label={label} angosta>
                                                <Input
                                                    type={tipo || 'text'}
                                                    className="h-8 text-sm"
                                                    value={antecedentes[campo]}
                                                    placeholder={editable ? placeholder : undefined}
                                                    disabled={!editable}
                                                    max={tipo === 'date' ? hoyYmd() : undefined}
                                                    onChange={(e) => { setAntecedentes((prev) => ({ ...prev, [campo]: e.target.value })); setSucio(true); }}
                                                />
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
                        </section>

                        {/* Mediciones */}
                        <section className="mt-4 rounded-xl border border-border bg-background p-4">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">Mediciones</h3>
                                <span className="text-xs text-muted-foreground">
                                    TP = termómetro patrón · TC = equipo verificado · TFP = TP − error patrón · Error = TC − TFP
                                </span>
                                {editable && faltantes > 0 && <Badge variant="warning" className="ml-auto">{faltantes} lectura(s) por completar</Badge>}
                            </div>
                            <div className="grid gap-4 min-[1400px]:grid-cols-3">
                                {RANGOS.map((r) => {
                                    const k = String(r) as Rango;
                                    const d = calc.rangos[r];
                                    return (
                                        <div key={r} className={cn('overflow-hidden rounded-lg border', d.cumple === false ? 'border-destructive/40' : 'border-border')}>
                                            <div className="flex items-center justify-between gap-2 bg-muted/60 px-3 py-2">
                                                <span className="text-sm font-semibold">{r.toFixed(1)}°C</span>
                                                {editable && (
                                                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => repetirPrimera(k)} title="Vuelve a copiar la lectura 1 en las 4 siguientes (también las cambiadas a mano)">
                                                        <IconCopy size={13} /> Igualar a la 1ª
                                                    </Button>
                                                )}
                                            </div>
                                            {/* Mismas columnas y orden que la hoja Excel (C31:H31); en gris las que se calculan. */}
                                            <table className="w-full table-fixed text-sm">
                                                <colgroup>
                                                    <col className="w-6" />
                                                    <col />
                                                    <col className="w-[13%]" />
                                                    <col className="w-[13%]" />
                                                    <col />
                                                    <col className="w-[21%]" />
                                                    <col className="w-[13%]" />
                                                </colgroup>
                                                <thead>
                                                    <tr className="border-b border-border text-[10.5px] leading-tight text-muted-foreground">
                                                        <th className="py-1.5 font-medium">#</th>
                                                        <th className="py-1.5 font-medium" >Temperatura<br />termómetro<br />patrón (TP)</th>
                                                        <th className="bg-muted/50 py-1.5 font-medium" >Error<br />termometro<br />patrón</th>
                                                        <th className="bg-muted/50 py-1.5 font-medium" >Temperatura final<br />termómetro<br />patrón (TFP)</th>
                                                        <th className="py-1.5 font-medium" >Temperatura<br />termómetro<br />calibrando (TC)</th>
                                                        <th className="py-1.5 font-medium">Hora</th>
                                                        <th className="bg-muted/50 py-1.5 font-medium" >Error de medición<br />TC-TFP</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {lecturas[k].map((f, i) => {
                                                        const c = d.filas[i];
                                                        const fuera = c.error !== null && Math.abs(c.error) > TOLERANCIA;
                                                        return (
                                                            <tr key={i} className="border-b border-border/60 last:border-0">
                                                                <td className="text-center text-xs text-muted-foreground">{i + 1}</td>
                                                                <td className="p-1"><CeldaNum value={f.tp} disabled={!editable} auto={i > 0 && !manual[k][i].tp} onChange={(x) => setCelda(k, i, 'tp', x)} celda={`tp-${k}-${i}`} onNavegar={navegarCelda} /></td>
                                                                <td className="bg-muted/50 px-1 text-center text-sm tabular-nums text-muted-foreground">{fmt1(errPatron[r])}</td>
                                                                <td className="bg-muted/50 px-1 text-center text-sm tabular-nums">{fmt1(c.tfp)}</td>
                                                                <td className="p-1"><CeldaNum value={f.tc} disabled={!editable} auto={i > 0 && !manual[k][i].tc} onChange={(x) => setCelda(k, i, 'tc', x)} destacar={i === 0} celda={`tc-${k}-${i}`} onNavegar={navegarCelda} /></td>
                                                                <td className="p-1">
                                                                    <Input
                                                                        type="time"
                                                                        className={cn('h-8 px-1 text-xs', i > 0 && !manual[k][i].hora && 'text-muted-foreground')}
                                                                        value={f.hora}
                                                                        disabled={!editable}
                                                                        onChange={(e) => setCelda(k, i, 'hora', e.target.value)}
                                                                    />
                                                                </td>
                                                                <td className={cn('bg-muted/50 px-1 text-center font-semibold tabular-nums', fuera && 'text-destructive')}>{fmt1(c.error)}</td>
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
                        <section className="mt-4 rounded-xl border border-border bg-background p-4">
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">Resultado</h3>
                                <span className="text-xs text-muted-foreground">
                                    Rango de aceptación: Error de medición <b className="text-foreground">≤ +/- {fmt1(TOLERANCIA)}°C</b>
                                </span>
                                {calc.cumple === null && <Badge variant="outline" className="ml-auto">Se marca al completar las 15 lecturas</Badge>}
                            </div>
                            <div className="grid gap-4 lg:grid-cols-[minmax(240px,300px)_minmax(200px,240px)_1fr]">
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
                                    accion={calc.cumple === false ? <span className="text-[11px] text-destructive">Obligatoria si no cumple</span> : undefined}
                                    className="flex flex-col"
                                >
                                    <div className="flex flex-1 p-2">
                                        <Textarea
                                            rows={5}
                                            maxLength={2000}
                                            className="flex-1 resize-none"
                                            placeholder="Ej: Sonda nueva, cambio de cartridge, se envía a servicio técnico..."
                                            value={observacion}
                                            disabled={!editable}
                                            onChange={(e) => { setObservacion(e.target.value); setSucio(true); }}
                                        />
                                    </div>
                                </Tarjeta>
                            </div>
                        </section>
                    </div>
                )}

                {v && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-background px-5 py-3">
                        {(v.estado === 'BORRADOR' || v.estado === 'PENDIENTE_FIRMA') && (
                            <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setAnularAbierto(true)} disabled={!!accion}>
                                <IconBan size={15} /> Anular
                            </Button>
                        )}
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            {v.estado !== 'ANULADA' && (
                                <Button variant="outline" onClick={verPdf} disabled={!!accion}>
                                    {accion === 'pdf' ? <Spinner /> : <IconFileTypePdf size={15} />}
                                    {v.estado === 'FIRMADA' ? 'Ver PDF' : 'Vista previa PDF'}
                                </Button>
                            )}
                            {editable && (
                                <>
                                    <Button variant="outline" onClick={() => ejecutar('guardar', async () => { await guardar(); })} disabled={!!accion || !sucio}>
                                        {accion === 'guardar' ? <Spinner /> : <IconDeviceFloppy size={15} />} Guardar borrador
                                    </Button>
                                    <Button onClick={enviarFirma} disabled={!!accion || !calc?.completas || !idMuestreador || (calc?.cumple === false && !observacion.trim())}
                                        title={!calc?.completas ? 'Complete las 15 lecturas' : !idMuestreador ? 'Indique el muestreador que firma' : undefined}>
                                        {accion === 'enviar' ? <Spinner light /> : <IconSend size={15} />} Enviar a firma
                                    </Button>
                                </>
                            )}
                            {v.estado === 'PENDIENTE_FIRMA' && (
                                <>
                                    <Button variant="outline" onClick={volverBorrador} disabled={!!accion}>
                                        {accion === 'volver' ? <Spinner /> : <IconArrowBackUp size={15} />} Volver a editar
                                    </Button>
                                    <Button onClick={() => setFirmaAbierta(true)} disabled={!!accion}>
                                        <IconSignature size={15} /> Firmar
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>

            <PdfViewerModal
                open={pdfAbierto}
                onClose={() => setPdfAbierto(false)}
                url={pdfUrl}
                title={v ? `OI-FoGe-39 · ${v.codigo_equipo}${v.estado !== 'FIRMADA' ? ' (vista previa, sin firma)' : ''}` : undefined}
            />

            <FirmaMuestreadorDialog
                verificacion={firmaAbierta ? v : null}
                onClose={() => setFirmaAbierta(false)}
                onFirmado={(d) => { setFirmaAbierta(false); cargarEn(d); onChanged(); }}
            />

            <Dialog open={confirmarCierre} onOpenChange={(o) => { if (!o && accion !== 'guardar-cerrar') setConfirmarCierre(false); }}>
                <DialogContent className="max-w-md gap-5" showCloseButton={accion !== 'guardar-cerrar'}>
                    <DialogHeader className="items-center text-center sm:text-center">
                        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
                            <IconAlertTriangle size={24} />
                        </div>
                        <DialogTitle>Hay cambios sin guardar</DialogTitle>
                        <DialogDescription>
                            Modificó la ficha de <b className="text-foreground">{v?.codigo_equipo}</b> y aún no la guardó.
                            Si cierra sin guardar, se perderán las lecturas y datos ingresados desde el último guardado.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-2">
                        <Button onClick={guardarYCerrar} disabled={accion === 'guardar-cerrar'}>
                            {accion === 'guardar-cerrar' ? <Spinner light /> : <IconDeviceFloppy size={15} />}
                            {accion === 'guardar-cerrar' ? 'Guardando...' : 'Guardar y cerrar'}
                        </Button>
                        <Button
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => { setConfirmarCierre(false); onClose(); }}
                            disabled={accion === 'guardar-cerrar'}
                        >
                            Cerrar sin guardar
                        </Button>
                        <Button variant="ghost" onClick={() => setConfirmarCierre(false)} disabled={accion === 'guardar-cerrar'}>
                            Seguir editando
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={anularAbierto} onOpenChange={(o) => { if (!o && accion !== 'anular') setAnularAbierto(false); }}>
                <DialogContent className="max-w-md gap-4">
                    <DialogHeader>
                        <DialogTitle>¿Anular esta ficha?</DialogTitle>
                        <DialogDescription>{v?.codigo_equipo} · {v && nombrePeriodo(v.periodo)}. La ficha queda registrada como anulada y no afecta al equipo.</DialogDescription>
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

// Formato de la planilla (#,##0.0): siempre 1 decimal.
const fmt1 = (n: number | null | undefined) => (n === null || n === undefined || Number.isNaN(Number(n))
    ? ''
    : (Math.round(Number(n) * 10) / 10 + 0).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

// auto: valor copiado de la lectura 1 (gris); al escribir encima queda fijo (negro).
// Al entrar a una celda copiada se muestra vacía (el valor copiado queda de
// sugerencia) para escribir encima; si se sale sin escribir, sigue el copiado.
// En una celda escrita a mano se selecciona el texto para reemplazarlo.
// Enter / flecha abajo pasan a la lectura siguiente; flecha arriba, a la anterior.
const CeldaNum: React.FC<{
    value: string; onChange: (v: string) => void; disabled?: boolean; destacar?: boolean; auto?: boolean;
    celda: string; onNavegar: (celda: string, paso: 1 | -1) => void;
}> = ({ value, onChange, disabled, destacar, auto, celda, onNavegar }) => {
    const [editando, setEditando] = useState(false);
    const vaciar = editando && auto;
    return (
        <Input
            inputMode="decimal"
            data-celda={celda}
            title={auto ? 'Copiado de la lectura 1. Escriba para cambiarlo.' : undefined}
            className={cn(
                'h-8 px-1.5 text-center text-sm tabular-nums',
                destacar && !value && !disabled && 'border-primary/40 bg-primary/5',
                auto && !editando && 'border-dashed text-muted-foreground',
            )}
            value={vaciar ? '' : value}
            placeholder={vaciar ? value : undefined}
            disabled={disabled}
            onFocus={(e) => { setEditando(true); if (!auto) e.currentTarget.select(); }}
            onBlur={() => setEditando(false)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); onNavegar(celda, 1); }
                if (e.key === 'ArrowUp') { e.preventDefault(); onNavegar(celda, -1); }
            }}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9.,-]/g, ''))}
        />
    );
};

const Spinner: React.FC<{ light?: boolean }> = ({ light }) => (
    <span className={cn('h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent', light ? 'border-primary-foreground' : 'border-current')} />
);
