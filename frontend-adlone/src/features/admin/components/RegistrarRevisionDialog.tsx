import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconAlertTriangle, IconCircleCheck, IconExternalLink, IconPaperclip, IconPencil, IconThermometer, IconX } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useToast } from '../../../contexts/ToastContext';
import { equipoService, type Equipo } from '../services/equipo.service';
import { COLOR_CONTROL, sumarMeses, type ReglasControl, type ModalidadControl } from '../utils/reglasControlEquipo';

// Vista dividida para registrar la revisión de un equipo (o de varios a la vez):
//   · A un lado, QUÉ CORRESPONDE: el tipo de control (anual, semestral, trimestral…), qué es, cada cuánto
//     se hace y en qué punto del ciclo está el equipo (última, vence, atraso).
//   · Al otro, LO QUE SE EDITA: fecha en que se realizó, observación, informe y, en la sonda de caudal y el
//     molinete, qué control lleva.
// Guarda la fecha como Última revisión y calcula la Siguiente con la frecuencia del control (queda una
// versión nueva en el historial del equipo, como cualquier actualización).

const REALIZADA: Record<ModalidadControl, string> = {
    MANTENCION_ANUAL: 'Mantención anual preventiva',
    CONTRASTACION_SEMESTRAL: 'Contrastación semestral',
    VERIFICACION_TRIMESTRAL: 'Verificación trimestral de T°',
    CALIBRACION_ANUAL: 'Calibración anual del patrón',
    SIN_VENCIMIENTO: 'Revisión',
};

// Qué es cada control, en pocas palabras.
const EXPLICACION: Record<ModalidadControl, { frecuencia: string; que: string; incluye: string }> = {
    MANTENCION_ANUAL: {
        frecuencia: 'Una vez al año',
        que: 'Mantención preventiva del equipo: revisión técnica general para que siga funcionando bien.',
        incluye: 'Queda un informe o certificado de la mantención, que se puede adjuntar.',
    },
    CONTRASTACION_SEMESTRAL: {
        frecuencia: 'Dos veces al año (cada 6 meses)',
        que: 'Contrastación: se compara el equipo contra una referencia para confirmar que mide dentro de lo esperado.',
        incluye: 'Queda el resultado o certificado de la contrastación, que se puede adjuntar.',
    },
    VERIFICACION_TRIMESTRAL: {
        frecuencia: 'Cuatro veces al año (cada 3 meses)',
        que: 'Verificación intermedia de temperatura contra el termómetro patrón, en 0, 15 y 30 °C.',
        incluye: 'La verificación formal se hace en Verificación de Temperatura (ficha OI-FoGe-39); aquí se deja el registro de que se hizo.',
    },
    CALIBRACION_ANUAL: {
        frecuencia: 'Una vez al año',
        que: 'Calibración externa del termómetro patrón: de él dependen las verificaciones de los demás equipos.',
        incluye: 'Queda el certificado de calibración, que se puede adjuntar.',
    },
    SIN_VENCIMIENTO: { frecuencia: 'Sin fecha de vencimiento', que: 'Este equipo no tiene una revisión periódica.', incluye: '' },
};

// Mínimo de caracteres de la observación obligatoria (evita un punto o un guion).
const MIN_OBSERVACION = 3;

const hoyISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fechaDMY = (iso?: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('-') : '—');
const fechaCorta = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}.${m}.${y.slice(2)}`; };
const msDe = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const diasEntre = (desde: string, hasta: string) => Math.round((msDe(hasta) - msDe(desde)) / 86400000);
const mensajeError = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

interface Props {
    equipos: Equipo[];
    reglas: ReglasControl | null;
    onClose: () => void;
    /** Se guardó al menos un equipo. */
    onGuardado: (ids: number[]) => void;
    /** Abrir la ficha completa del equipo para editarlo (solo con un equipo). */
    onAbrirFicha?: (equipo: Equipo) => void;
    /** Ir a Verificación de Temperatura (ficha OI-FoGe-39), para las verificaciones trimestrales. */
    onIrVerificacionTemperatura?: () => void;
}

interface Detalle { marca?: string; modelo?: string; n_serie?: string; observacion?: string; equipo_asociado?: string }

const Contenido: React.FC<Props> = ({ equipos, reglas, onClose, onGuardado, onAbrirFicha, onIrVerificacionTemperatura }) => {
    const { showToast } = useToast();
    const abierto = equipos.length > 0;
    const unico = equipos.length === 1 ? equipos[0] : null;
    const [fecha, setFecha] = useState(hoyISO());
    const [nota, setNota] = useState('');
    const [archivo, setArchivo] = useState<File | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Control elegido (solo cambia en la sonda de caudal y el molinete, que admiten dos).
    const [elegida, setElegida] = useState<ModalidadControl | null>((unico?.modalidad_control as ModalidadControl) ?? null);
    const [detalle, setDetalle] = useState<Detalle | null>(null);
    const entrada = useRef<HTMLInputElement>(null);
    const idUnico = unico?.id_equipo;

    // Datos que el resumen no trae (marca, modelo, serie y observaciones) para el equipo elegido.
    useEffect(() => {
        if (!idUnico) return;
        let vigente = true;
        equipoService.getEquipoById(idUnico).then((r) => { if (vigente) setDetalle(r?.data ?? null); }).catch(() => { /* el panel sigue sin ese detalle */ });
        return () => { vigente = false; };
    }, [idUnico]);

    const modalidadDe = (e: Equipo): ModalidadControl =>
        ((unico && e.id_equipo === unico.id_equipo ? elegida : null) ?? e.modalidad_control ?? 'VERIFICACION_TRIMESTRAL') as ModalidadControl;

    // Siguiente fecha de cada equipo según su control.
    const filas = useMemo(() => equipos.map((e) => {
        const m = ((unico && e.id_equipo === unico.id_equipo ? elegida : null) ?? e.modalidad_control ?? 'VERIFICACION_TRIMESTRAL') as ModalidadControl;
        const meses = reglas?.modalidades?.[m]?.meses ?? null;
        return { equipo: e, modalidad: m, siguiente: meses && fecha ? sumarMeses(fecha, meses) : '' };
    }), [equipos, reglas, fecha, elegida, unico]);

    const modalidades = Array.from(new Set(filas.map((f) => f.modalidad)));
    const titulo = modalidades.length === 1 ? `Registrar ${REALIZADA[modalidades[0]].toLowerCase()}` : 'Registrar revisión';
    const hoy = hoyISO();
    const fechaFutura = fecha > hoy;
    const observacionOk = nota.trim().length >= MIN_OBSERVACION;
    const permitidas = unico ? (reglas?.equipos?.[String(unico.nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase()]?.permitidas ?? []) : [];
    const cambioControl = !!unico && !!elegida && elegida !== unico.modalidad_control;

    const guardar = async () => {
        if (!fecha || fechaFutura || !observacionOk) return;
        setGuardando(true);
        setError(null);
        const hechos: number[] = [];
        const fallos: string[] = [];
        try {
            // El informe (un solo equipo) se sube primero: si falla, no se toca el equipo.
            let doc: { documento_nombre: string; documento_ruta: string } | null = null;
            if (unico && archivo) doc = await equipoService.subirArchivoDocumento(archivo, archivo.name.replace(/\.[^.]+$/, ''));

            for (const f of filas) {
                try {
                    // La línea se agrega debajo de las observaciones que ya tiene (el servidor la pone al final).
                    const linea = `${fechaCorta(fecha)} ${REALIZADA[f.modalidad]} realizada${nota.trim() ? `: ${nota.trim()}` : ''}`;
                    const cambios: Partial<Equipo> & Record<string, unknown> = {
                        ultima_verificacion: fecha,
                        observacion_agregada: linea,
                    };
                    if (unico && f.equipo.id_equipo === unico.id_equipo && cambioControl) cambios.modalidad_control = f.modalidad;
                    if (f.siguiente) {
                        cambios.siguiente_verificacion = f.siguiente;
                        // vigencia sigue a la siguiente revisión; con una fecha ya pasada solo se manda la siguiente
                        // (el backend rechaza el update completo si la vigencia es anterior a hoy).
                        if (f.siguiente >= hoy) cambios.vigencia = f.siguiente;
                    }
                    if (doc) Object.assign(cambios, doc);
                    await equipoService.updateEquipo(f.equipo.id_equipo, cambios);
                    hechos.push(f.equipo.id_equipo);
                } catch (e) {
                    fallos.push(`${f.equipo.codigo}: ${mensajeError(e) || 'no se pudo guardar'}`);
                }
            }
        } catch (e) {
            setError(mensajeError(e) || 'No se pudo subir el documento.');
            setGuardando(false);
            return;
        }
        setGuardando(false);
        if (hechos.length) {
            showToast({ type: 'success', message: hechos.length === 1 ? 'Revisión registrada' : `Revisión registrada en ${hechos.length} equipos` });
            onGuardado(hechos);
        }
        if (fallos.length) setError(fallos.join(' · '));
        else onClose();
    };

    // ── Lado izquierdo: qué corresponde ──
    const panelCorresponde = (() => {
        if (unico) {
            const m = modalidadDe(unico);
            const info = reglas?.modalidades?.[m];
            const ex = EXPLICACION[m];
            const ultima = unico.ultima_verificacion ? String(unico.ultima_verificacion).slice(0, 10) : '';
            const vence = unico.siguiente_verificacion ? String(unico.siguiente_verificacion).slice(0, 10) : '';
            const dias = vence ? diasEntre(hoy, vence) : null;
            const cicloTotal = ultima && vence ? Math.max(1, diasEntre(ultima, vence)) : 0;
            const avance = cicloTotal ? Math.min(100, Math.max(0, (diasEntre(ultima, hoy) / cicloTotal) * 100)) : 0;
            const lineas = String(detalle?.observacion || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(-3).reverse();
            return (
                <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
                    <div>
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Qué corresponde</span>
                        <div className="mt-1 flex items-center gap-2">
                            <span className={cn('h-3 w-3 shrink-0 rounded-full', COLOR_CONTROL[m]?.punto)} />
                            <span className="text-base font-semibold leading-tight">{info?.nombre ?? REALIZADA[m]}</span>
                        </div>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">{ex.frecuencia}</p>
                    </div>
                    <p className="text-sm">{ex.que}</p>
                    {ex.incluye && <p className="text-xs text-muted-foreground">{ex.incluye}</p>}

                    {/* En qué punto del ciclo está */}
                    <div className="rounded-lg border border-border bg-background p-3">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">Estado de la revisión</span>
                            {dias === null ? <Badge variant="outline">Sin fecha</Badge>
                                : dias < 0 ? <Badge variant="destructive">Atrasada {-dias} d</Badge>
                                    : dias <= 30 ? <Badge variant="warning">Vence en {dias} d</Badge>
                                        : <Badge variant="success">Al día · {dias} d</Badge>}
                        </div>
                        <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-muted">
                            <span className={cn('rounded-full', dias !== null && dias < 0 ? 'bg-destructive' : COLOR_CONTROL[m]?.barra)} style={{ width: `${dias !== null && dias < 0 ? 100 : avance}%` }} />
                        </div>
                        <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                            <span>Última: {fechaDMY(ultima)}</span>
                            <span>Vence: {fechaDMY(vence)}</span>
                        </div>
                    </div>

                    {/* El equipo */}
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div className="col-span-2"><dt className="text-[11px] text-muted-foreground">Equipo</dt><dd className="font-medium">{unico.codigo} · {unico.nombre}</dd></div>
                        <div><dt className="text-[11px] text-muted-foreground">Sede</dt><dd>{unico.ubicacion || '—'}</dd></div>
                        <div><dt className="text-[11px] text-muted-foreground">Responsable</dt><dd className="truncate" title={unico.nombre_asignado || ''}>{unico.nombre_asignado || '—'}</dd></div>
                        {(detalle?.marca || detalle?.modelo) && <div><dt className="text-[11px] text-muted-foreground">Marca / modelo</dt><dd className="truncate">{[detalle?.marca, detalle?.modelo].filter(Boolean).join(' · ')}</dd></div>}
                        {detalle?.n_serie && <div><dt className="text-[11px] text-muted-foreground">N° de serie</dt><dd className="truncate">{detalle.n_serie}</dd></div>}
                    </dl>

                    {lineas.length > 0 && (
                        <div>
                            <span className="text-[11px] text-muted-foreground">Últimas observaciones</span>
                            <ul className="mt-1 flex flex-col gap-1 text-xs">
                                {lineas.map((l, i) => <li key={i} className="line-clamp-2 rounded bg-background px-2 py-1 text-muted-foreground">{l}</li>)}
                            </ul>
                        </div>
                    )}
                </div>
            );
        }
        // Varios equipos: cada uno con su control y su vencimiento.
        return (
            <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <div>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Qué corresponde</span>
                    <p className="mt-1 text-base font-semibold leading-tight">{equipos.length} equipos seleccionados</p>
                    <p className="mt-1 text-xs text-muted-foreground">Cada uno con su propio control; la fecha se aplica a todos.</p>
                </div>
                <ul className="flex max-h-[22rem] flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border bg-background">
                    {filas.map((f) => {
                        const vence = f.equipo.siguiente_verificacion ? String(f.equipo.siguiente_verificacion).slice(0, 10) : '';
                        const dias = vence ? diasEntre(hoy, vence) : null;
                        return (
                            <li key={f.equipo.id_equipo} className="flex flex-col gap-0.5 px-3 py-2">
                                <span className="flex items-center justify-between gap-2 text-sm">
                                    <b>{f.equipo.codigo}</b>
                                    <span className="flex items-center gap-1.5 text-xs"><span className={cn('h-2 w-2 rounded-full', COLOR_CONTROL[f.modalidad]?.punto)} />{reglas?.modalidades?.[f.modalidad]?.corto}</span>
                                </span>
                                <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                    <span className="truncate">{f.equipo.nombre}</span>
                                    <span className={cn('shrink-0', dias !== null && dias < 0 && 'text-destructive')}>
                                        {dias === null ? 'sin fecha' : dias < 0 ? `atrasada ${-dias} d` : `vence en ${dias} d`} → próxima {fechaDMY(f.siguiente)}
                                    </span>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    })();

    return (
        <Dialog open={abierto} onOpenChange={(v) => { if (!v && !guardando) onClose(); }}>
            <DialogContent className="max-h-[92vh] max-w-4xl grid-cols-[minmax(0,1fr)] gap-4 overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{titulo}</DialogTitle>
                    <DialogDescription>{unico ? `${unico.codigo} · ${unico.nombre}` : `${equipos.length} equipos seleccionados`}</DialogDescription>
                </DialogHeader>

                <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                    {panelCorresponde}

                    {/* ── Lado derecho: lo que se edita ── */}
                    <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-border p-4">
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Lo que se registra</span>

                        {/* Sonda de caudal y molinete: el control es a elección y solo rige el elegido */}
                        {unico && permitidas.length > 1 && elegida && (
                            <div>
                                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Control de fechas de este equipo</Label>
                                <div className="flex flex-wrap gap-2">
                                    {permitidas.map((m) => (
                                        <Button key={m} type="button" size="sm" variant={m === elegida ? 'default' : 'outline'} onClick={() => setElegida(m as ModalidadControl)}>
                                            {reglas?.modalidades?.[m as ModalidadControl]?.nombre ?? m}
                                        </Button>
                                    ))}
                                </div>
                                {cambioControl && <p className="mt-1 text-[11px] text-muted-foreground">Se guardará el cambio de control junto con la revisión.</p>}
                            </div>
                        )}

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Fecha en que se realizó</Label>
                                <DatePicker value={fecha} onChange={setFecha} />
                                {fechaFutura && <p className="mt-1 text-xs text-destructive">No puede ser una fecha futura.</p>}
                            </div>
                            {unico && (
                                <div>
                                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Próxima revisión (automática)</Label>
                                    <div className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-sm font-medium">{fechaDMY(filas[0]?.siguiente)}</div>
                                </div>
                            )}
                        </div>

                        <div>
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Observación <span className="text-destructive">*</span></Label>
                            <Textarea
                                rows={3}
                                value={nota}
                                onChange={(e) => setNota(e.target.value)}
                                placeholder="Ej.: certificado N° 123, hecho por Geodex…"
                                aria-required="true"
                                className={cn(!observacionOk && 'border-destructive/50')}
                            />
                            <p className={cn('mt-1 text-[11px]', observacionOk ? 'text-muted-foreground' : 'text-destructive')}>
                                {observacionOk ? 'Queda en la observación del equipo con la fecha.' : 'Obligatoria: escriba qué se hizo para poder registrar.'}
                            </p>
                        </div>

                        {unico && (
                            <div>
                                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Informe o certificado (opcional)</Label>
                                <input ref={entrada} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
                                {archivo ? (
                                    <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                                        <span className="flex min-w-0 items-center gap-2"><IconPaperclip size={15} className="shrink-0" /><span className="truncate">{archivo.name}</span></span>
                                        <Button type="button" variant="ghost" size="icon-xs" onClick={() => { setArchivo(null); if (entrada.current) entrada.current.value = ''; }} aria-label="Quitar documento"><IconX size={14} /></Button>
                                    </div>
                                ) : (
                                    <Button type="button" variant="outline" size="sm" onClick={() => entrada.current?.click()}><IconPaperclip size={14} /> Adjuntar documento</Button>
                                )}
                            </div>
                        )}

                        {error && (
                            <p className="flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"><IconAlertTriangle size={14} className="mt-px shrink-0" /> {error}</p>
                        )}

                        {/* Otras formas de hacerlo */}
                        {((unico && onAbrirFicha) || (modalidades.includes('VERIFICACION_TRIMESTRAL') && onIrVerificacionTemperatura)) && (
                            <div className="mt-auto flex flex-wrap gap-2 border-t border-border pt-3">
                                {unico && onAbrirFicha && (
                                    <Button type="button" variant="ghost" size="sm" onClick={() => onAbrirFicha(unico)}><IconPencil size={14} /> Editar el equipo (ficha completa)</Button>
                                )}
                                {modalidades.includes('VERIFICACION_TRIMESTRAL') && onIrVerificacionTemperatura && (
                                    <Button type="button" variant="ghost" size="sm" onClick={onIrVerificacionTemperatura}><IconThermometer size={14} /> Hacerla en Verificación de Temperatura <IconExternalLink size={12} /></Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
                    <Button onClick={guardar} disabled={guardando || !fecha || fechaFutura || !observacionOk} title={!observacionOk ? 'Escriba la observación para registrar' : undefined}>
                        <IconCircleCheck size={16} /> {guardando ? 'Guardando…' : unico ? 'Registrar' : `Registrar en ${equipos.length} equipos`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// Con otros equipos seleccionados el formulario parte de cero (fecha de hoy, sin observación ni documento).
export const RegistrarRevisionDialog: React.FC<Props> = (props) => (
    <Contenido key={props.equipos.map((e) => e.id_equipo).join(',')} {...props} />
);

export default RegistrarRevisionDialog;
