import { useEffect, useState } from 'react';
import { IconDeviceFloppy, IconScale, IconArrowBackUp, IconHistory, IconUserX, IconAlertTriangle } from '@tabler/icons-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useConfirmacion } from '@/components/ui/confirm-dialog';
import { useToast } from '../../../../contexts/ToastContext';
import { useSugerenciasPersonas } from './usuarios';
import { quejasApelacionesService as api, avisoCorreo, mensajeError, type Caso } from '../../services/quejasApelaciones.service';
import { Campo, ConRequisitos, ConSugerencias, RequisitosPanel, Seccion, Segmentado } from './comun';
import { CAUSAS_SUGERIDAS, fmtDay, limites, noFuture, visibles, acActivas } from './reglas';

const SI_NO = [{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }];
const boolSeg = (v: boolean | null) => (v === true ? 'si' : v === false ? 'no' : '');
const segBool = (v: string) => (v === 'si' ? true : v === 'no' ? false : null);

export function EvaluacionTab({ caso, onSaved, causas }: { caso: Caso; onSaved: () => void; causas: string[] }) {
    const { showToast } = useToast();
    const { confirmar, dialogo } = useConfirmacion();
    const personas = useSugerenciasPersonas();
    const init = () => ({
        relacionada: caso.relacionada_actividades, procede: caso.procede, evaluacion: caso.evaluacion || '',
        responsable: caso.responsable || '', participo: (caso.responsable_independiente ? 'no' : '') as '' | 'si' | 'no',
        requiereTnc: Boolean(caso.requiere_tnc), requiereAuditoria: Boolean(caso.requiere_auditoria),
        fechaEvaluacion: caso.fecha_evaluacion || '', respuestaFormal: caso.respuesta_formal || '',
        causa: caso.causa || '', requisito: caso.requisito || '', jefeArea: caso.jefe_area || '',
        reunionFecha: caso.reunion_fecha || '', reunionAsistentes: caso.reunion_asistentes || '', reunionDirectrices: caso.reunion_directrices || '',
    });
    const [f, setF] = useState(init);
    const [notificar, setNotificar] = useState(true);
    const [saving, setSaving] = useState(false);
    const [reabrir, setReabrir] = useState<null | 'reasignacion' | 'anulacion'>(null);
    useEffect(() => { setF(init()); }, [caso]); // eslint-disable-line react-hooks/exhaustive-deps
    const decidido = caso.estado !== 'registrada' && caso.estado !== 'en_evaluacion';
    const readOnly = caso.cerrado;
    const lockDecision = readOnly || decidido;
    const apelacion = caso.tipo === 'apelacion';
    const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

    // Requisitos para registrar la decisión, con el porqué de cada uno.
    const requisitos = visibles([
        { ok: f.relacionada !== null, label: 'Indicar si se relaciona con las actividades del laboratorio', why: 'Si no se relaciona, no corresponde tratarla (cl. 7.9.2).' },
        { ok: f.procede !== null, label: 'Indicar si procede', why: 'Define si el caso pasa a tratamiento o se cierra con respuesta formal.' },
        { ok: f.evaluacion.trim().length >= 10, label: 'Fundamento de la evaluación (mín. 10 caracteres)', why: 'La decisión debe basarse en información reunida y verificada.' },
        { ok: f.responsable.trim().length >= 2, label: 'Designar un responsable del caso', why: 'Alguien debe responder por la decisión y su seguimiento.' },
        { ok: f.participo === 'no', label: 'Confirmar que el responsable no participó en la actividad', why: 'Quien decide no puede haber participado en la actividad reclamada (cl. 7.9.6). Si participó, reasígnalo.' },
        { ok: f.causa.trim().length >= 2, label: 'Clasificar la causa', why: 'Se usa en la estadística para la revisión por la dirección.' },
        { ok: f.respuestaFormal.trim().length >= 10, label: 'Redactar la respuesta formal', why: 'Si no procede, el caso se cierra con esta respuesta al cliente.', show: f.procede === false },
        { ok: Boolean(f.reunionFecha) && f.reunionAsistentes.trim().length >= 2, label: 'Registrar la reunión de análisis (fecha y asistentes)', why: 'Las apelaciones se analizan en reunión antes de decidir.', show: apelacion },
    ]);
    const faltan = requisitos.filter((r) => !r.ok).length;
    const historial = caso.evaluacion_historial || [];

    const send = async (decidir: boolean) => {
        setSaving(true);
        try {
            const body: Record<string, unknown> = {
                evaluacion: f.evaluacion.trim(), responsable: f.responsable.trim(), responsableIndependiente: f.participo === 'no',
                requiereTnc: f.requiereTnc, requiereAuditoria: f.requiereAuditoria, fechaEvaluacion: f.fechaEvaluacion,
                respuestaFormal: f.respuestaFormal.trim(), causa: f.causa.trim(), requisito: f.requisito.trim(), jefeArea: f.jefeArea.trim(),
                reunionFecha: f.reunionFecha, reunionAsistentes: f.reunionAsistentes.trim(), reunionDirectrices: f.reunionDirectrices.trim(),
            };
            if (!decidido) { body.relacionada = f.relacionada; body.procede = f.procede; }
            if (decidir) { body.decidir = true; body.notificarCliente = notificar; }
            const r = await api.guardarEvaluacion(caso.id, body);
            showToast({
                type: r.correo === 'sin_cola' ? 'warning' : 'success',
                message: decidir ? `${r.estado === 'en_tratamiento' ? 'El caso pasa a tratamiento.' : 'El caso se cerró como no procedente.'}${avisoCorreo(r.correo)}` : 'Evaluación guardada.',
            });
            onSaved();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo guardar la evaluación') });
        } finally {
            setSaving(false);
        }
    };

    const confirmDecision = async () => {
        const ok = await confirmar({
            titulo: 'Registrar la decisión',
            mensaje: `${f.procede
                ? 'El caso pasará a la etapa de tratamiento. La decisión no se podrá cambiar.'
                : 'El caso se cerrará como «no procede» con la respuesta formal. No se podrá reabrir.'}${notificar ? ' Se enviará un correo al mail de contacto y quedará registrado en las notificaciones.' : ''}`,
            textoConfirmar: 'Registrar decisión',
        });
        if (ok) send(true);
    };

    const panel = !decidido && !readOnly
        ? <RequisitosPanel accion="registrar la decisión" requisitos={requisitos} nota={faltan > 0 && 'Mientras tanto puedes «Guardar» lo avanzado.'} />
        : null;
    const fechaReunion = noFuture(f.reunionFecha, caso.fecha_recepcion);
    const fechaEval = noFuture(f.fechaEvaluacion, caso.fecha_recepcion);

    return (
        <ConRequisitos panel={panel}>
            <div className="flex flex-col gap-4">
                {dialogo}
                <p className="text-sm text-muted-foreground">
                    Valida la presentación antes de tratarla (cl. 7.9.2): confirma si se relaciona con las actividades del laboratorio,
                    reúne y verifica la información (informe, ensayo o muestra) y designa un responsable que no participó en la actividad (cl. 7.9.6).
                </p>
                {decidido && (
                    <Alert variant={caso.procede ? 'warning' : 'default'}>
                        <IconScale />
                        <AlertDescription>
                            Decisión registrada{caso.fecha_evaluacion && ` el ${fmtDay(caso.fecha_evaluacion)}`}{caso.evaluado_por && ` por ${caso.evaluado_por}`}:{' '}
                            <b>{caso.procede ? 'procede' : 'no procede'}</b>.
                            {caso.estado === 'en_tratamiento' && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:text-destructive"
                                        disabled={acActivas(caso).length > 0} onClick={() => setReabrir('anulacion')}
                                        title={acActivas(caso).length ? 'Tiene acciones correctivas levantadas: la decisión ya no se puede anular; resuélvelas en el tratamiento.' : undefined}>
                                        <IconArrowBackUp size={14} />Anular decisión y volver a evaluar
                                    </Button>
                                    <span className="text-xs text-muted-foreground">Si la decisión no es válida (p. ej. el responsable sí participó o la información era errónea).</span>
                                </div>
                            )}
                            {caso.cerrado && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    El caso está cerrado y la respuesta ya se comunicó: no se reabre. Si hay que revisarlo, registra un nuevo caso (por ejemplo, una apelación).
                                </p>
                            )}
                        </AlertDescription>
                    </Alert>
                )}
                {historial.length > 0 && (
                    <Seccion titulo="Historial de la evaluación" icono={<IconHistory size={16} className="text-primary" />}>
                        <ul className="flex flex-col gap-3">
                            {historial.map((h, i) => (
                                <li key={i} className={`border-l-[3px] pl-3 ${h.tipo === 'anulacion' ? 'border-destructive' : 'border-warning'}`}>
                                    <p className="text-sm font-semibold">{h.tipoLabel} · {fmtDay(h.dia || h.fecha)}{h.hora ? ` ${h.hora}` : ''}{h.por ? ` · ${h.por}` : ''}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {[h.responsableAnterior && `Responsable anterior: ${h.responsableAnterior}`,
                                            h.decisionAnterior && `Decisión anulada: ${h.decisionAnterior}${h.fechaEvaluacionAnterior ? ` (${fmtDay(h.fechaEvaluacionAnterior)})` : ''}`]
                                            .filter(Boolean).join(' · ')}
                                    </p>
                                    <p className="whitespace-pre-wrap text-sm">Motivo: {h.motivo}</p>
                                </li>
                            ))}
                        </ul>
                    </Seccion>
                )}
                {apelacion && (
                    <Seccion titulo="Reunión de análisis de la apelación" className="bg-primary/[0.03]">
                        <p className="-mt-2 mb-3 text-xs text-muted-foreground">
                            Registra quiénes analizaron la apelación y las directrices definidas. Quienes participaron en la actividad apelada solo se contactan para validar información.
                        </p>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <Campo label="Fecha" required error={fechaReunion.error}>
                                <Input type="date" {...limites(fechaReunion)} disabled={readOnly} value={f.reunionFecha} onChange={(e) => set('reunionFecha', e.target.value)} />
                            </Campo>
                            <Campo label="Asistentes" required className="sm:col-span-2">
                                <Textarea rows={1} className="min-h-9" maxLength={4000} disabled={readOnly} value={f.reunionAsistentes}
                                    placeholder="Jefe Técnico de Medioambiente, Gerente General, SubGerente de Gestión de Calidad…"
                                    onChange={(e) => set('reunionAsistentes', e.target.value)} />
                            </Campo>
                        </div>
                        <Campo label="Directrices para responder" className="mt-3">
                            <Textarea rows={2} maxLength={8000} disabled={readOnly} value={f.reunionDirectrices} onChange={(e) => set('reunionDirectrices', e.target.value)} />
                        </Campo>
                    </Seccion>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                    <Campo label="¿Se relaciona con las actividades del laboratorio?" required>
                        <Segmentado ariaLabel="Se relaciona con las actividades" disabled={lockDecision} value={boolSeg(f.relacionada)} options={SI_NO}
                            onChange={(v) => setF((p) => ({ ...p, relacionada: segBool(v), procede: segBool(v) === false ? false : p.procede }))} />
                    </Campo>
                    <Campo label="¿Procede?" required>
                        <Segmentado ariaLabel="Procede" disabled={lockDecision || f.relacionada === false} value={boolSeg(f.procede)}
                            options={[{ value: 'si', label: 'Sí, procede' }, { value: 'no', label: 'No procede' }]}
                            tono={(v) => (v === 'si' ? 'warning' : 'primary')} onChange={(v) => set('procede', segBool(v))} />
                    </Campo>
                </div>
                <Campo label="Fundamento de la evaluación" required description="Información reunida y verificada, y por qué procede o no.">
                    <Textarea rows={3} maxLength={8000} disabled={readOnly} value={f.evaluacion} onChange={(e) => set('evaluacion', e.target.value)} />
                </Campo>
                <div className="grid gap-3 sm:grid-cols-2">
                    <Campo label="Responsable del caso" required htmlFor="qa-responsable" description="Elige un usuario de ADL-One o escribe otro nombre.">
                        {/* Otra persona → hay que volver a confirmar si participó en la actividad. */}
                        <ConSugerencias id="qa-responsable" sugerencias={personas} maxLength={200} disabled={readOnly} placeholder="Nombre y cargo" value={f.responsable}
                            onChange={(e) => { const v = e.target.value; setF((p) => ({ ...p, responsable: v, participo: '' })); }} />
                    </Campo>
                    <Campo label="Fecha de evaluación" error={fechaEval.error} description="Si la dejas vacía se usa la fecha de la decisión.">
                        <Input type="date" {...limites(fechaEval)} disabled={readOnly} value={f.fechaEvaluacion} onChange={(e) => set('fechaEvaluacion', e.target.value)} />
                    </Campo>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                    <Campo label="Causa" required htmlFor="qa-causa" description="Clasifica el caso para la estadística.">
                        <ConSugerencias id="qa-causa" sugerencias={[...new Set([...CAUSAS_SUGERIDAS, ...causas])]} disabled={readOnly} maxLength={120}
                            placeholder="Ej. Resultado de análisis" value={f.causa} onChange={(e) => set('causa', e.target.value)} />
                    </Campo>
                    <Campo label="Requisito afectado">
                        <Input disabled={readOnly} maxLength={500} placeholder="Norma, método o requisito de convenio" value={f.requisito} onChange={(e) => set('requisito', e.target.value)} />
                    </Campo>
                    <Campo label="Jefe de área que investiga" htmlFor="qa-jefe-area">
                        <ConSugerencias id="qa-jefe-area" sugerencias={personas} disabled={readOnly} maxLength={200} placeholder="Nombre y cargo" value={f.jefeArea} onChange={(e) => set('jefeArea', e.target.value)} />
                    </Campo>
                </div>
                <Campo label={`¿El responsable participó en la actividad que motivó la ${apelacion ? 'apelación' : 'queja'}?`} required
                    description="Quien decide debe ser independiente de la actividad reclamada (cl. 7.9.6).">
                    <Segmentado ariaLabel="El responsable participó" className="sm:max-w-sm" disabled={lockDecision} value={f.participo}
                        options={[{ value: 'no', label: 'No participó' }, { value: 'si', label: 'Sí participó' }]}
                        tono={(v) => (v === 'si' ? 'destructive' : 'success')} onChange={(v) => set('participo', v as 'si' | 'no')} />
                </Campo>
                {f.participo === 'si' && !lockDecision && (
                    <Alert variant="destructive">
                        <IconUserX />
                        <AlertTitle>No se puede registrar la decisión con este responsable</AlertTitle>
                        <AlertDescription>
                            La norma exige que la decisión la tome alguien que no participó en la actividad en cuestión. Registra la
                            reasignación para dejar constancia del motivo y volver a investigar con otra persona como responsable.
                            <div className="mt-2">
                                <Button size="sm" variant="outline" disabled={!caso.responsable} onClick={() => setReabrir('reasignacion')}>
                                    <IconArrowBackUp size={14} />Reasignar y volver a investigar
                                </Button>
                            </div>
                            {!caso.responsable && (
                                <p className="mt-1 text-xs text-muted-foreground">Para dejar constancia, primero «Guardar» con el responsable actual; o escribe directamente a otra persona.</p>
                            )}
                        </AlertDescription>
                    </Alert>
                )}
                <div className="flex flex-wrap gap-6">
                    <label className="flex items-center gap-2 text-sm">
                        <Checkbox disabled={readOnly} checked={f.requiereTnc} onCheckedChange={(v) => set('requiereTnc', v === true)} />Requiere trabajo no conforme (cl. 7.10)
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <Checkbox disabled={readOnly} checked={f.requiereAuditoria} onCheckedChange={(v) => set('requiereAuditoria', v === true)} />Requiere auditoría
                    </label>
                </div>
                {f.procede === false && (
                    <Campo label="Respuesta formal al cliente" required description="Fundamentos de por qué no procede. Con esto se cierra el caso.">
                        <Textarea rows={3} maxLength={8000} disabled={readOnly} value={f.respuestaFormal} onChange={(e) => set('respuestaFormal', e.target.value)} />
                    </Campo>
                )}
                {!readOnly && (
                    <>
                        {!decidido && (
                            <label className="flex items-start gap-2 text-sm">
                                <Checkbox className="mt-0.5" checked={notificar} onCheckedChange={(v) => setNotificar(v === true)} />
                                <span>
                                    {f.procede === false ? 'Enviar la respuesta formal al mail de contacto' : 'Avisar al mail de contacto que el caso pasa a tratamiento'}
                                    <span className="block text-xs text-muted-foreground">{f.procede === false ? 'Queda registrado como finalización de proceso.' : 'Queda registrado como avance de proceso.'}</span>
                                </span>
                            </label>
                        )}
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" disabled={saving} onClick={() => send(false)}><IconDeviceFloppy size={16} />Guardar</Button>
                            {!decidido && <Button disabled={faltan > 0 || saving} onClick={confirmDecision}><IconScale size={16} />Registrar decisión</Button>}
                        </div>
                    </>
                )}
                <ReabrirDialog caso={caso} tipo={reabrir} onClose={() => setReabrir(null)} onDone={() => { setReabrir(null); onSaved(); }} />
            </div>
        </ConRequisitos>
    );
}

// Reasignar responsable / anular decisión: exige motivo y queda en el historial.
function ReabrirDialog({ caso, tipo, onClose, onDone }: { caso: Caso; tipo: null | 'reasignacion' | 'anulacion'; onClose: () => void; onDone: () => void }) {
    const { showToast } = useToast();
    const [motivo, setMotivo] = useState('');
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (tipo) setMotivo(''); }, [tipo]);
    const anulacion = tipo === 'anulacion';
    const submit = async () => {
        if (!tipo) return;
        setSaving(true);
        try {
            await api.reabrirEvaluacion(caso.id, tipo, motivo.trim());
            showToast({ type: 'warning', message: anulacion ? 'Decisión anulada: el caso volvió a evaluación.' : 'Responsable reasignado: designa al nuevo responsable.' });
            onDone();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo reabrir la evaluación') });
        } finally {
            setSaving(false);
        }
    };
    return (
        <Dialog open={tipo !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{anulacion ? 'Anular la decisión y volver a evaluar' : 'Reasignar el responsable y volver a investigar'}</DialogTitle>
                    <DialogDescription>Queda en el historial del caso, en la auditoría y en el formulario OI-FoGe-05.</DialogDescription>
                </DialogHeader>
                <Alert variant={anulacion ? 'destructive' : 'warning'}>
                    <IconAlertTriangle />
                    <AlertDescription>
                        {anulacion ? (
                            <>Se anulará la decisión «{caso.procede ? 'procede' : 'no procede'}» del {fmtDay(caso.fecha_evaluacion)}
                                {caso.evaluado_por ? ` (registrada por ${caso.evaluado_por})` : ''}. El caso vuelve a <b>En evaluación</b>,
                                se quita al responsable{caso.responsable ? <> <b>{caso.responsable}</b></> : ''} y habrá que decidir de nuevo.
                                El fundamento escrito se conserva como punto de partida.</>
                        ) : (
                            <>Se quitará a <b>{caso.responsable}</b> como responsable del caso. Luego designa a una persona que no participó
                                en la actividad y continúa la investigación.</>
                        )}
                    </AlertDescription>
                </Alert>
                <Campo label="Motivo" required description={`${motivo.trim().length}/10 caracteres mínimos.`}>
                    <Textarea rows={3} maxLength={2000} autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)}
                        placeholder={anulacion ? 'Ej. Se detectó que el responsable participó en el muestreo del informe reclamado.' : 'Ej. El responsable participó en el análisis del informe reclamado.'} />
                </Campo>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button variant={anulacion ? 'destructive' : 'default'} disabled={motivo.trim().length < 10 || saving} onClick={submit}>
                        <IconArrowBackUp size={16} />{anulacion ? 'Anular decisión' : 'Reasignar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
