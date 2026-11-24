import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconPaperclip, IconX, IconMailForward, IconEye, IconEyeOff, IconPencil, IconHistory } from '@tabler/icons-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuth } from '../../../../contexts/AuthContext';
import { useToast } from '../../../../contexts/ToastContext';
import { PasosLayout, type EstadoPaso, type PasoInfo } from '../../../medio-ambiente/components/PasosLayout';
import { quejasApelacionesService as api, avisoCorreo, mensajeError, type TipoCaso } from '../../services/quejasApelaciones.service';
import { Campo, ConSugerencias, Segmentado } from './comun';
import {
    EMISORES, ORIGENES, VIAS_INGRESO, MAX_ADJUNTO, TIPOS_ADJUNTO, today, kb, fmtDay, cleanCompany, cleanName, cleanEmail, cleanPhone, finalizePhone, cleanReference,
} from './reglas';
import { CASILLA_DE_CAMPO, emptyReg, regErrors, regPayload, type RegForm } from './registro';
import { FormularioOIFoGe05 } from './FormularioOIFoGe05';
import { valoresDeRegistro, type CampoFormulario } from './formularioValores';

// =============================================================================
// Nuevo registro de queja o apelación, con el mismo diseño "por pasos" que Nuevo
// Equipo y Nueva ficha (PasosLayout): lista de pasos con avance y ayuda, un paso
// por pantalla, pie con Atrás / Guardar borrador / Siguiente. A la derecha, la hoja
// OI-FoGe-05 se rellena en vivo y resalta la casilla que se está escribiendo.
// =============================================================================

type Paso = 'recepcion' | 'contacto' | 'motivo' | 'revision';
const ORDEN: Paso[] = ['recepcion', 'contacto', 'motivo', 'revision'];
const PASOS: Record<Paso, { titulo: string; descripcion: string; subtitulo: string; ayuda: string }> = {
    recepcion: {
        titulo: 'Recepción', descripcion: 'Cómo y cuándo llegó',
        subtitulo: 'Origen, quién la presenta, vía de ingreso y fecha y hora de recepción.',
        ayuda: 'La fecha de recepción define el plazo de respuesta (días hábiles). Lo marcado con * es obligatorio.',
    },
    contacto: {
        titulo: 'Quién la presenta', descripcion: 'Empresa y contacto',
        subtitulo: 'Empresa, nombre, mail y fono de contacto, y el N° de informe si lo hay.',
        ayuda: 'A este mail llegan el acuse de recibo y la respuesta formal: revísalo bien.',
    },
    motivo: {
        titulo: 'Motivo', descripcion: 'Qué plantea el cliente',
        subtitulo: 'Transcribe la presentación tal como llegó y adjunta el original si es escrita.',
        ayuda: 'Incluye fechas, informes o muestras involucradas: ayuda a evaluar si procede.',
    },
    revision: {
        titulo: 'Revisión y registro', descripcion: 'Acuse y confirmación',
        subtitulo: 'Revisa los datos, decide si enviar el acuse y registra el caso.',
        ayuda: 'Al registrar se asigna el N° de caso (QA-AAAA-NNNNN). El acuse lo envía ADLWeb en menos de un minuto.',
    },
};
// Campos obligatorios de cada paso, con su etiqueta corta para el aviso «Falta: …».
const OBLIGATORIOS: { key: keyof RegForm; label: string; paso: Paso }[] = [
    { key: 'fechaRecepcion', label: 'Fecha de recepción', paso: 'recepcion' },
    { key: 'horaRecepcion', label: 'Hora de recepción', paso: 'recepcion' },
    { key: 'empresa', label: 'Empresa', paso: 'contacto' },
    { key: 'nombre', label: 'Nombre', paso: 'contacto' },
    { key: 'correo', label: 'Mail de contacto', paso: 'contacto' },
    { key: 'telefono', label: 'Fono', paso: 'contacto' },
    { key: 'motivo', label: 'Motivo', paso: 'motivo' },
];
const idCampo = (k: keyof RegForm) => `nr-${k}`;
// "Organismo fiscalizador" no cabe en una línea en el selector: etiqueta corta.
const EMISORES_CORTOS = EMISORES.map((e) => (e.value === 'fiscalizador' ? { ...e, label: 'Fiscalizador' } : e));

// ── Borrador en este navegador (igual que Nuevo Equipo) ──────────────────────
interface Borrador { version: 1; guardadoEn: number; form: RegForm; enviarAcuse: boolean; paso: Paso; maxPaso: number }
const claveBorrador = (idUsuario: unknown, tipo: TipoCaso) => `adlone:borrador-qa-v1:${tipo}:${idUsuario ?? 0}`;
const leerBorrador = (clave: string): Borrador | null => {
    try {
        const d = JSON.parse(localStorage.getItem(clave) || 'null');
        return d?.version === 1 && d.form ? d : null;
    } catch { return null; }
};
const escribirBorrador = (clave: string, b: Borrador) => { try { localStorage.setItem(clave, JSON.stringify(b)); return true; } catch { return false; } };
const borrarBorrador = (clave: string) => { try { localStorage.removeItem(clave); } catch { /* sin almacenamiento */ } };
const hayContenido = (f: RegForm) => Boolean(f.empresa || f.nombre || f.correo || (f.telefono && f.telefono !== '+') || f.motivo || f.viaIngreso || f.numeroInforme);
const haceCuanto = (t: number) => {
    const m = Math.max(0, Math.round((Date.now() - t) / 60000));
    return m < 1 ? 'recién' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} día(s)`;
};

/** Grupo del resumen final, con su botón «Editar» que vuelve al paso. */
function Resumen({ titulo, onEditar, filas }: { titulo: string; onEditar: () => void; filas: [string, React.ReactNode][] }) {
    return (
        <div className="rounded-lg border border-border">
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
                <p className="text-sm font-semibold">{titulo}</p>
                <Button type="button" size="sm" variant="ghost" className="h-7" onClick={onEditar}><IconPencil size={14} />Editar</Button>
            </div>
            <dl className="grid grid-cols-[minmax(110px,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 px-3 py-2.5 text-sm">
                {filas.map(([k, v]) => (
                    <React.Fragment key={k}>
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="min-w-0 break-words font-medium">{v || <span className="font-normal text-muted-foreground">—</span>}</dd>
                    </React.Fragment>
                ))}
            </dl>
        </div>
    );
}

export function NuevoRegistroVista({ tipo, onCancel, onCreated }: { tipo: TipoCaso; onCancel: () => void; onCreated: (id: number) => void }) {
    const { showToast } = useToast();
    const { user } = useAuth();
    const clave = claveBorrador(user?.id, tipo);
    const [form, setFormState] = useState<RegForm>(() => emptyReg(tipo));
    const [enviarAcuse, setEnviarAcuse] = useState(true);
    const [archivo, setArchivo] = useState<File | null>(null);
    const [paso, setPaso] = useState<Paso>('recepcion');
    const [maxPaso, setMaxPaso] = useState(0);
    // Pasos en los que ya se pulsó «Siguiente»: ahí se muestran los errores aunque el campo no se haya tocado.
    const [intentados, setIntentados] = useState<Set<Paso>>(new Set());
    const [tocados, setTocados] = useState<Set<keyof RegForm>>(new Set());
    const [saving, setSaving] = useState(false);
    const [resaltar, setResaltar] = useState<CampoFormulario | null>(null);
    const [verHoja, setVerHoja] = useState(true);
    const [borradorPendiente, setBorradorPendiente] = useState<Borrador | null>(() => leerBorrador(clave));
    const apagar = useRef<ReturnType<typeof setTimeout> | null>(null);
    const topRef = useRef<HTMLDivElement>(null);
    useEffect(() => () => { if (apagar.current) clearTimeout(apagar.current); }, []);

    // Igual que setState, pero detecta qué campo cambió para resaltar su casilla en la hoja.
    const actual = useRef(form);
    const setV = (k: keyof RegForm, valor: string) => {
        if (actual.current[k] === valor) return;
        const next = { ...actual.current, [k]: valor };
        actual.current = next;
        setFormState(next);
        const casilla = CASILLA_DE_CAMPO[k];
        if (casilla) {
            setResaltar(casilla);
            if (apagar.current) clearTimeout(apagar.current);
            apagar.current = setTimeout(() => setResaltar(null), 2500);
        }
    };
    const tocar = (k: keyof RegForm) => setTocados((s) => (s.has(k) ? s : new Set(s).add(k)));

    const errors = useMemo(() => regErrors(form), [form]);
    const faltanDe = (p: Paso) => OBLIGATORIOS.filter((o) => o.paso === p && errors[o.key]);
    const err = (k: keyof RegForm) => {
        const p = OBLIGATORIOS.find((o) => o.key === k)?.paso;
        return (tocados.has(k) || (p && intentados.has(p))) ? errors[k] : undefined;
    };

    // ── Borrador: se guarda solo cada 4 s y al salir; al volver se ofrece continuarlo ──
    const estadoRef = useRef<Borrador | null>(null);
    estadoRef.current = { version: 1, guardadoEn: Date.now(), form, enviarAcuse, paso, maxPaso };
    const registrado = useRef(false);
    const guardarBorrador = (aviso = false) => {
        const e = estadoRef.current;
        if (registrado.current || borradorPendiente || !e || !hayContenido(e.form)) return;
        const ok = escribirBorrador(clave, { ...e, guardadoEn: Date.now() });
        if (aviso) showToast(ok ? { type: 'success', message: 'Borrador guardado en este navegador.' } : { type: 'error', message: 'No se pudo guardar el borrador (almacenamiento del navegador no disponible).' });
    };
    const guardarRef = useRef(guardarBorrador);
    guardarRef.current = guardarBorrador;
    useEffect(() => {
        const guardar = () => guardarRef.current();
        const t = setInterval(guardar, 4000);
        window.addEventListener('beforeunload', guardar);
        return () => { clearInterval(t); window.removeEventListener('beforeunload', guardar); };
    }, []);
    const continuarBorrador = () => {
        const d = borradorPendiente;
        setBorradorPendiente(null);
        if (!d) return;
        const f = { ...emptyReg(tipo), ...d.form, tipo };
        actual.current = f;
        setFormState(f);
        setEnviarAcuse(d.enviarAcuse);
        setPaso(ORDEN.includes(d.paso) ? d.paso : 'recepcion');
        setMaxPaso(Math.min(d.maxPaso || 0, ORDEN.length - 1));
    };
    const descartarBorrador = () => { borrarBorrador(clave); setBorradorPendiente(null); };

    // ── Pasos: estado de cada uno y navegación ──
    const idx = ORDEN.indexOf(paso);
    const pasosInfo: PasoInfo[] = ORDEN.map((id, i) => {
        const f = faltanDe(id).length;
        const visitado = i <= maxPaso;
        const estado: EstadoPaso = i === idx ? 'actual' : visitado ? (f > 0 ? 'error' : 'completo') : 'pendiente';
        return { id, titulo: PASOS[id].titulo, descripcion: PASOS[id].descripcion, estado, aviso: f ? `Faltan ${f} ${f > 1 ? 'campos' : 'campo'}` : undefined, bloqueado: !visitado };
    });
    const irA = (p: Paso) => {
        const i = ORDEN.indexOf(p);
        setPaso(p);
        setMaxPaso((m) => Math.max(m, i));
        setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
    };
    const enfocar = (k: keyof RegForm) => setTimeout(() => {
        const el = document.getElementById(idCampo(k));
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el?.focus({ preventScroll: true });
    }, 60);
    const avisarFaltan = (f: typeof OBLIGATORIOS) => showToast({
        id: 'qa-paso-guard', type: 'warning',
        message: `Falta: ${f.slice(0, 3).map((x) => x.label).join(', ')}${f.length > 3 ? ` y ${f.length - 3} más` : ''}.`,
    });

    const registrar = async () => {
        // Antes de registrar se revisan todos los pasos: se lleva al primero con algo pendiente.
        const pendiente = ORDEN.find((p) => faltanDe(p).length);
        if (pendiente) {
            const f = faltanDe(pendiente);
            setIntentados((s) => new Set(s).add(pendiente));
            avisarFaltan(f);
            irA(pendiente);
            enfocar(f[0].key);
            return;
        }
        setSaving(true);
        try {
            const r = await api.crear({ ...regPayload(form), fechaTratamiento: '', enviarAcuse });
            if (archivo) {
                try { await api.subirAdjunto(r.id, archivo, `${tipo === 'apelacion' ? 'Apelación' : 'Queja'} original escrita`); } catch (e) {
                    showToast({ type: 'warning', message: mensajeError(e, 'El caso se creó, pero no se pudo adjuntar el archivo') });
                }
            }
            registrado.current = true;
            borrarBorrador(clave);
            setBorradorPendiente(null);
            showToast({ type: r.correo === 'sin_cola' ? 'warning' : 'success', message: `Caso ${r.folio} registrado.${avisoCorreo(r.correo)}` });
            onCreated(r.id);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo crear el registro') });
        } finally {
            setSaving(false);
        }
    };
    const siguiente = () => {
        if (paso === 'revision') { registrar(); return; }
        const f = faltanDe(paso);
        if (f.length) {
            setIntentados((s) => new Set(s).add(paso));
            avisarFaltan(f);
            enfocar(f[0].key);
            return;
        }
        irA(ORDEN[idx + 1]);
    };

    const emisorLabel = EMISORES.find((e) => e.value === form.emisor)?.label || '';
    const valores = useMemo(() => valoresDeRegistro(form, emisorLabel, enviarAcuse), [form, emisorLabel, enviarAcuse]);
    const etiqueta = tipo === 'apelacion' ? 'apelación' : 'queja';
    const largoMotivo = form.motivo.trim().length;
    const ver = (p: Paso) => (paso === p ? 'flex flex-col gap-5' : 'hidden');

    return (
        <div ref={topRef} className="flex scroll-mt-4 flex-col gap-4">
            {borradorPendiente && (
                <Alert variant="info">
                    <IconHistory />
                    <AlertTitle>Tienes una {etiqueta} sin terminar ({haceCuanto(borradorPendiente.guardadoEn)})</AlertTitle>
                    <AlertDescription>
                        {[borradorPendiente.form.empresa, borradorPendiente.form.nombre].filter(Boolean).join(' · ') || 'Sin empresa todavía'}
                        {' · '}quedó en «{PASOS[borradorPendiente.paso]?.titulo || 'Recepción'}».
                        <div className="mt-2 flex gap-2">
                            <Button size="sm" onClick={continuarBorrador}>Continuar el borrador</Button>
                            <Button size="sm" variant="outline" onClick={descartarBorrador}>Descartar y empezar de nuevo</Button>
                        </div>
                    </AlertDescription>
                </Alert>
            )}

            <div className={cn('grid items-start gap-4', verHoja && 'xl:grid-cols-[minmax(0,1fr)_minmax(400px,0.8fr)]')}>
                <PasosLayout
                    className="p-0 md:p-0"
                    titulo={tipo === 'apelacion' ? 'Nueva apelación' : 'Nueva queja'}
                    pasos={pasosInfo}
                    actual={idx}
                    ayuda={PASOS[paso].ayuda}
                    encabezado={{ titulo: PASOS[paso].titulo, subtitulo: PASOS[paso].subtitulo }}
                    onElegirPaso={(i) => { if (i <= maxPaso) irA(ORDEN[i]); }}
                    onAtras={idx > 0 ? () => irA(ORDEN[idx - 1]) : undefined}
                    onBorrador={() => guardarBorrador(true)}
                    textoSiguiente={paso === 'revision' ? `Registrar ${etiqueta}` : 'Siguiente'}
                    onSiguiente={siguiente}
                    guardando={saving}
                    pieExtra={(
                        <>
                            <Button type="button" variant="outline" className="rounded-full" onClick={onCancel}>Cancelar</Button>
                            <Button type="button" variant="ghost" className="hidden rounded-full xl:inline-flex" onClick={() => setVerHoja((v) => !v)}>
                                {verHoja ? <><IconEyeOff size={16} />Ocultar hoja</> : <><IconEye size={16} />Ver hoja</>}
                            </Button>
                        </>
                    )}
                >
                    {/* 1 · Recepción */}
                    <div className={ver('recepcion')}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Campo label="Origen" required>
                                <Segmentado ariaLabel="Origen" options={ORIGENES} value={form.origen} onChange={(v) => setV('origen', v)} />
                            </Campo>
                            <Campo label="Presentada por" required>
                                <Segmentado ariaLabel="Presentada por" options={EMISORES_CORTOS} value={form.emisor} onChange={(v) => setV('emisor', v)} />
                            </Campo>
                        </div>
                        <Campo label="Vía de ingreso" htmlFor={idCampo('viaIngreso')} description="Elige una o escribe otra.">
                            <ConSugerencias id={idCampo('viaIngreso')} sugerencias={VIAS_INGRESO.filter((v) => v !== 'Formulario web')} maxLength={50}
                                placeholder="En persona, correo electrónico, teléfono, carta…" value={form.viaIngreso} onChange={(e) => setV('viaIngreso', e.target.value)} />
                        </Campo>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Campo label="Fecha de recepción" required htmlFor={idCampo('fechaRecepcion')} error={err('fechaRecepcion')}>
                                <Input id={idCampo('fechaRecepcion')} type="date" max={today()} value={form.fechaRecepcion}
                                    onChange={(e) => setV('fechaRecepcion', e.target.value)} onBlur={() => tocar('fechaRecepcion')} />
                            </Campo>
                            <Campo label="Hora de recepción" required htmlFor={idCampo('horaRecepcion')} error={err('horaRecepcion')}>
                                <Input id={idCampo('horaRecepcion')} type="time" value={form.horaRecepcion}
                                    onChange={(e) => setV('horaRecepcion', e.target.value)} onBlur={() => tocar('horaRecepcion')} />
                            </Campo>
                        </div>
                    </div>

                    {/* 2 · Quién la presenta */}
                    <div className={ver('contacto')}>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Campo label="Empresa" required htmlFor={idCampo('empresa')} error={err('empresa')}>
                                <Input id={idCampo('empresa')} value={form.empresa} placeholder="Ej. Salmones del Sur S.A."
                                    onChange={(e) => setV('empresa', cleanCompany(e.target.value))} onBlur={() => tocar('empresa')} />
                            </Campo>
                            <Campo label="Nombre" required htmlFor={idCampo('nombre')} error={err('nombre')}>
                                <Input id={idCampo('nombre')} value={form.nombre} placeholder="Ej. María José Pérez"
                                    onChange={(e) => setV('nombre', cleanName(e.target.value))} onBlur={() => tocar('nombre')} />
                            </Campo>
                            <Campo label="Mail de contacto" required htmlFor={idCampo('correo')} error={err('correo')}>
                                <Input id={idCampo('correo')} type="email" value={form.correo} placeholder="nombre@empresa.cl"
                                    onChange={(e) => setV('correo', cleanEmail(e.target.value))} onBlur={() => tocar('correo')} />
                            </Campo>
                            <Campo label="Fono de contacto" required htmlFor={idCampo('telefono')} error={err('telefono')}>
                                <Input id={idCampo('telefono')} inputMode="tel" value={form.telefono} placeholder="+56912345678"
                                    onFocus={() => { if (!form.telefono) setV('telefono', '+'); }}
                                    onChange={(e) => setV('telefono', cleanPhone(e.target.value))}
                                    onBlur={() => { setV('telefono', finalizePhone(actual.current.telefono)); tocar('telefono'); }} />
                            </Campo>
                        </div>
                        <Campo label="N° de informe, muestra u orden" htmlFor={idCampo('numeroInforme')} description="Opcional. Ayuda a ubicar la actividad reclamada.">
                            <Input id={idCampo('numeroInforme')} value={form.numeroInforme} placeholder="Ej. LE-1234/2026" onChange={(e) => setV('numeroInforme', cleanReference(e.target.value))} />
                        </Campo>
                    </div>

                    {/* 3 · Motivo */}
                    <div className={ver('motivo')}>
                        <div>
                            <Campo label={`Motivo de la ${etiqueta}`} required htmlFor={idCampo('motivo')} error={err('motivo')}>
                                <Textarea id={idCampo('motivo')} rows={9} maxLength={5000} value={form.motivo} className="resize-y leading-relaxed"
                                    placeholder="¿Qué plantea el cliente? Incluye fechas, informes o muestras involucradas."
                                    onChange={(e) => setV('motivo', e.target.value)} onBlur={() => tocar('motivo')} />
                            </Campo>
                            <p className={cn('mt-1 text-right text-xs tabular-nums', largoMotivo > 0 && largoMotivo < 10 ? 'text-warning' : 'text-muted-foreground')}>
                                {largoMotivo < 10 ? `Mínimo 10 caracteres · ${largoMotivo}/10` : `${form.motivo.length}/5000`}
                            </p>
                        </div>
                        <label htmlFor="nr-adjunto" className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-3 text-sm transition-colors',
                            archivo ? 'border-primary/40 bg-primary/10' : 'border-border bg-muted/30 hover:bg-muted/50',
                        )}>
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground"><IconPaperclip size={18} /></span>
                            <span className="min-w-0 flex-1">
                                {archivo
                                    ? <><span className="block truncate font-semibold">{archivo.name}</span><span className="text-xs text-muted-foreground">{kb(archivo.size)} · se guardará junto al caso</span></>
                                    : <><span className="block font-semibold">Adjuntar la {etiqueta} original (opcional)</span><span className="text-xs text-muted-foreground">Carta, correo o fax escaneado · PDF o imagen de hasta 5 MB</span></>}
                            </span>
                            {archivo && (
                                <Button type="button" size="icon-xs" variant="ghost" aria-label="Quitar adjunto" onClick={(e) => { e.preventDefault(); setArchivo(null); }}><IconX size={14} /></Button>
                            )}
                            <input id="nr-adjunto" type="file" accept={TIPOS_ADJUNTO} className="sr-only"
                                onChange={(e) => {
                                    const f = e.target.files?.[0] || null;
                                    e.target.value = '';
                                    if (f && f.size > MAX_ADJUNTO) { showToast({ type: 'error', message: 'El archivo supera los 5 MB.' }); return; }
                                    setArchivo(f);
                                }} />
                        </label>
                    </div>

                    {/* 4 · Revisión y registro */}
                    <div className={ver('revision')}>
                        <Resumen titulo="Recepción" onEditar={() => irA('recepcion')} filas={[
                            ['Tipo · origen', `${tipo === 'apelacion' ? 'Apelación' : 'Queja'} · ${form.origen === 'interno' ? 'Interno' : 'Externo'}`],
                            ['Presentada por', emisorLabel],
                            ['Vía de ingreso', form.viaIngreso],
                            ['Recepción', `${fmtDay(form.fechaRecepcion)} ${form.horaRecepcion}`],
                        ]} />
                        <Resumen titulo="Quién la presenta" onEditar={() => irA('contacto')} filas={[
                            ['Empresa', form.empresa], ['Nombre', form.nombre], ['Mail', form.correo],
                            ['Fono', finalizePhone(form.telefono)], ['N° de informe', form.numeroInforme],
                        ]} />
                        <Resumen titulo="Motivo" onEditar={() => irA('motivo')} filas={[
                            ['Motivo', <span className="line-clamp-4 whitespace-pre-wrap font-normal">{form.motivo}</span>],
                            ['Adjunto', archivo ? `${archivo.name} (${kb(archivo.size)})` : ''],
                        ]} />
                        <label className={cn('flex items-start gap-3 rounded-lg border p-3 transition-colors', enviarAcuse ? 'border-primary/40 bg-primary/10' : 'border-border bg-muted/30')}>
                            <Switch checked={enviarAcuse} onCheckedChange={setEnviarAcuse} className="mt-0.5" aria-label="Enviar acuse de recibo" />
                            <span className="text-sm">
                                <span className="flex items-center gap-1.5 font-semibold"><IconMailForward size={15} className="text-primary" />Enviar acuse de recibo al mail de contacto</span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                    {enviarAcuse
                                        ? `Con el N° de caso y el código para seguirlo en adldiagnostic.cl. Lo envía ADLWeb en menos de un minuto${form.correo ? ` a ${form.correo}` : ''} y queda como notificación de inicio de proceso.`
                                        : 'No se enviará. Podrás enviarlo después desde «Correos y notificaciones» o registrar que se avisó por otra vía.'}
                                </span>
                            </span>
                        </label>
                    </div>
                </PasosLayout>

                {verHoja && (
                    <aside className="min-w-0 xl:sticky xl:top-4" aria-label="Vista previa del formulario OI-FoGe-05">
                        <div className="overflow-hidden rounded-xl border border-border bg-card">
                            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                                <span className="relative flex size-2.5" aria-hidden="true">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
                                    <span className="relative inline-flex size-2.5 rounded-full bg-success" />
                                </span>
                                <h2 className="m-0 text-[15px] font-semibold">OI-FoGe-05 · en vivo</h2>
                                <span className="ml-auto text-xs text-muted-foreground">Se rellena mientras escribes</span>
                            </div>
                            <div className="max-h-[calc(100dvh-200px)] overflow-y-auto p-4"
                                style={{ backgroundColor: 'var(--sc-muted)', backgroundImage: 'radial-gradient(color-mix(in srgb, var(--sc-muted-foreground) 22%, transparent) 1px, transparent 1px)', backgroundSize: '14px 14px' }}>
                                <FormularioOIFoGe05 v={valores} resaltar={resaltar} borrador className="rounded-sm" />
                            </div>
                        </div>
                    </aside>
                )}
            </div>
        </div>
    );
}
