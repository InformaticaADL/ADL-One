import React, { useEffect, useState } from 'react';
import { IconListCheck, IconPlus, IconBan, IconPencil, IconFileText, IconDeviceFloppy, IconFlagCheck, IconAlertTriangle } from '@tabler/icons-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useConfirmacion } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { useToast } from '../../../../contexts/ToastContext';
import { quejasApelacionesService as api, mensajeError, type Accion, type Caso, type Seguimiento } from '../../services/quejasApelaciones.service';
import { Campo, ConRequisitos, ConSugerencias, RequisitosPanel, Seccion, Segmentado } from './comun';
import { useSugerenciasPersonas } from './usuarios';
import { TECNICAS, fmtDay, fmtDateTime, limites, noFuture, notBefore, visibles, acActivas } from './reglas';

const AC_VARIANT: Record<string, 'warning' | 'success' | 'secondary'> = { abierta: 'warning', cerrada: 'success', anulada: 'secondary' };
const descargarFormulario = (caso: Caso, a: Accion) => api.descargar(`/${caso.id}/acciones/${a.id}/formulario`, `OI-FoGe-02 ${a.folio}.odt`);

// Anuladas = levantadas por error: se muestran (trazabilidad) pero no cuentan.
export function AccionesSection({ caso, canEdit, onSaved }: { caso: Caso; canEdit: boolean; onSaved: () => void }) {
    const { showToast } = useToast();
    const [editing, setEditing] = useState<Accion | null>(null);
    const [anulando, setAnulando] = useState<Accion | null>(null);
    const [creating, setCreating] = useState(false);
    // Al recargar el caso, la acción abierta en el diálogo se actualiza con los datos nuevos.
    useEffect(() => {
        if (editing) setEditing(caso.acciones.find((a) => a.id === editing.id) || null);
    }, [caso]); // eslint-disable-line react-hooks/exhaustive-deps
    const activas = acActivas(caso).length;

    const abrir = async () => {
        setCreating(true);
        try {
            const r = await api.abrirAccion(caso.id);
            showToast({ type: 'success', message: `Acción correctiva ${r.folio} abierta.` });
            onSaved();
            const nueva = r.acciones.find((a) => a.id === r.id);
            if (nueva) setEditing(nueva);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo abrir la acción correctiva') });
        } finally {
            setCreating(false);
        }
    };
    const formulario = (a: Accion) => descargarFormulario(caso, a).catch(() => showToast({ type: 'error', message: 'No se pudo generar el formulario OI-FoGe-02' }));

    return (
        <Seccion
            titulo={<>Acciones correctivas <Badge variant="secondary">{activas}</Badge>{caso.acciones.length > activas && <span className="text-xs font-normal text-muted-foreground">+ {caso.acciones.length - activas} anulada(s)</span>}</>}
            icono={<IconListCheck size={18} className="text-primary" />}
            accion={canEdit && caso.estado === 'en_tratamiento' && (
                <Button size="sm" variant="outline" disabled={creating} onClick={abrir}><IconPlus size={14} />Levantar acción correctiva</Button>
            )}
        >
            <p className="-mt-2 mb-3 text-xs text-muted-foreground">
                Si la queja o apelación procede, se levanta una no conformidad con su acción correctiva. El caso no se puede cerrar mientras haya acciones abiertas.
            </p>
            {caso.acciones.length ? (
                <div className="overflow-x-auto rounded-md border border-border">
                    <Table>
                        <TableHeader><TableRow><TableHead>N°</TableHead><TableHead>Responsable</TableHead><TableHead>Plazo</TableHead><TableHead>Estado</TableHead><TableHead /></TableRow></TableHeader>
                        <TableBody>
                            {caso.acciones.map((a) => {
                                const anulada = a.estado === 'anulada';
                                return (
                                    <TableRow key={a.id} className={cn(anulada && 'bg-muted/40')}>
                                        <TableCell>
                                            <span className={cn('font-mono text-sm font-bold', anulada ? 'text-muted-foreground line-through' : 'text-primary')}>{a.folio}</span>
                                            {anulada && (
                                                <p className="max-w-[360px] whitespace-pre-wrap text-xs text-muted-foreground">
                                                    Anulada {a.anulada_en ? `el ${fmtDateTime(a.anulada_en)}` : ''}{a.anulada_por ? ` por ${a.anulada_por}` : ''}. Motivo: {a.anulacion_motivo}
                                                </p>
                                            )}
                                        </TableCell>
                                        <TableCell>{a.responsable || '—'}</TableCell>
                                        <TableCell>{fmtDay(a.plazo)}</TableCell>
                                        <TableCell><Badge variant={AC_VARIANT[a.estado] || 'secondary'}>{a.estadoLabel}</Badge></TableCell>
                                        <TableCell>
                                            <div className="flex justify-end gap-1">
                                                {canEdit && a.estado === 'abierta' && caso.estado === 'en_tratamiento' && (
                                                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" title="Anular: si se levantó por error (pide un motivo y queda registrado)"
                                                        onClick={() => setAnulando(a)}><IconBan size={14} />Anular</Button>
                                                )}
                                                <Button size="sm" variant="ghost" onClick={() => setEditing(a)}><IconPencil size={14} />{a.estado !== 'abierta' || !canEdit ? 'Ver' : 'Editar'}</Button>
                                                <Button size="sm" variant="outline" onClick={() => formulario(a)}><IconFileText size={14} />OI-FoGe-02</Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            ) : <p className="text-sm text-muted-foreground">Sin acciones correctivas.</p>}
            {editing && <AccionDialog caso={caso} ac={editing} readOnly={!canEdit || editing.estado !== 'abierta'} onClose={() => setEditing(null)} onSaved={onSaved} />}
            <AnularAccionDialog caso={caso} ac={anulando} onClose={() => setAnulando(null)} onDone={() => { setAnulando(null); onSaved(); }} />
        </Seccion>
    );
}

// Anular una acción correctiva levantada por error: motivo obligatorio.
function AnularAccionDialog({ caso, ac, onClose, onDone }: { caso: Caso; ac: Accion | null; onClose: () => void; onDone: () => void }) {
    const { showToast } = useToast();
    const [motivo, setMotivo] = useState('');
    const [saving, setSaving] = useState(false);
    useEffect(() => { if (ac) setMotivo(''); }, [ac]);
    const submit = async () => {
        if (!ac) return;
        setSaving(true);
        try {
            await api.anularAccion(caso.id, ac.id, motivo.trim());
            showToast({ type: 'warning', message: `Acción correctiva ${ac.folio} anulada.` });
            onDone();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo anular la acción correctiva') });
        } finally {
            setSaving(false);
        }
    };
    const largo = motivo.trim().length;
    return (
        <Dialog open={ac !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Anular acción correctiva <span className="font-mono">{ac?.folio}</span></DialogTitle>
                    <DialogDescription>Obligatorio. Queda en la acción, en la auditoría y en el formulario OI-FoGe-05.</DialogDescription>
                </DialogHeader>
                <Alert variant="warning"><IconAlertTriangle /><AlertDescription>
                    Úsalo solo si la acción se levantó por error. No se borra: queda como <b>Anulada</b> con el motivo, quién la anuló y cuándo,
                    para que el número siga siendo trazable. Deja de contar como acción abierta y ya no impide cerrar el caso.
                </AlertDescription></Alert>
                <Campo label="Motivo de la anulación" required>
                    <Textarea rows={3} maxLength={2000} autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Ej. Se levantó dos veces por error; la no conformidad se trata en AC-2026-00001." />
                </Campo>
                <DialogFooter className="items-center sm:justify-between">
                    <span className={cn('text-xs', largo >= 10 ? 'text-muted-foreground' : 'text-warning')}>
                        {largo >= 10 ? 'Listo para anular.' : `Escribe al menos 10 caracteres (${largo}/10).`}
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>Cancelar</Button>
                        <Button variant="destructive" disabled={largo < 10 || saving} onClick={submit}><IconBan size={16} />Anular acción</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

const triSeg = (v: boolean | null) => (v === true ? 'si' : v === false ? 'no' : '');
const segBool = (v: string) => (v === 'si' ? true : v === 'no' ? false : null);
const emptySeg = (): Seguimiento => ({ fecha: '', cumplimiento: '', responsable: '', observaciones: '' });

function AccionDialog({ caso, ac, readOnly, onClose, onSaved }: { caso: Caso; ac: Accion; readOnly: boolean; onClose: () => void; onSaved: () => void }) {
    const { showToast } = useToast();
    const { confirmar, dialogo } = useConfirmacion();
    const personas = useSugerenciasPersonas();
    const init = () => ({
        area: ac.area || '', fechaDeteccion: ac.fecha_deteccion || '', fechaInicio: ac.fecha_inicio || '', detectadoPor: ac.detectado_por || '',
        requisito: ac.requisito || '', hallazgo: ac.hallazgo || '', justificacion: ac.justificacion || '', correccion: ac.correccion_inmediata || '',
        procedeAc: ac.procede_ac, participantes: ac.participantes || '', tecnica: ac.tecnica || '', alcance: ac.alcance || '',
        accion: ac.accion_propuesta || '', responsable: ac.responsable || '', plazo: ac.plazo || '', fechaSeguimiento: ac.fecha_seguimiento || '',
        cumplimientoPlazo: ac.cumplimiento_plazo, observaciones: ac.observaciones || '',
        seguimientos: [0, 1, 2].map((i) => ({ ...emptySeg(), ...(ac.seguimientos[i] || {}) })),
        eficacia: ac.eficacia || '', causaEliminada: ac.causa_eliminada, seLevantaNc: ac.se_levanta_nc,
        observacionesFinales: ac.observaciones_finales || '', cierreNombre: ac.cierre_nombre || '', cierreFecha: ac.cierre_fecha || '',
    });
    const [f, setF] = useState(init);
    const [saving, setSaving] = useState(false);
    useEffect(() => { setF(init()); }, [ac]); // eslint-disable-line react-hooks/exhaustive-deps
    type F = ReturnType<typeof init>;
    const set = <K extends keyof F>(k: K, v: F[K]) => setF((p) => ({ ...p, [k]: v }));
    const txt = (k: keyof F) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { const v = e.target.value; setF((p) => ({ ...p, [k]: v })); };
    const setSeg = (i: number, k: keyof Seguimiento, v: string) => setF((p) => ({ ...p, seguimientos: p.seguimientos.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }));
    const rec = caso.fecha_recepcion;

    const yn = (k: 'procedeAc' | 'cumplimientoPlazo' | 'causaEliminada' | 'seLevantaNc', label: string) => (
        <Campo label={label}>
            <Segmentado ariaLabel={label} className="w-40" disabled={readOnly} value={triSeg(f[k])} options={[{ value: 'si', label: 'SI' }, { value: 'no', label: 'NO' }]}
                onChange={(v) => set(k, segBool(v))} />
        </Campo>
    );
    const ta = (label: string, k: keyof F, description?: string) => (
        <Campo label={label} description={description}>
            <Textarea rows={2} maxLength={8000} disabled={readOnly} value={f[k] as string} onChange={txt(k)} />
        </Campo>
    );
    const fecha = (label: string, k: 'fechaDeteccion' | 'fechaInicio' | 'cierreFecha' | 'plazo' | 'fechaSeguimiento', planificada = false) => {
        const r = planificada ? notBefore(f[k], rec) : noFuture(f[k], rec);
        return (
            <Campo label={label} error={r.error}>
                <Input type="date" {...limites(r)} disabled={readOnly} value={f[k]} onChange={txt(k)} />
            </Campo>
        );
    };

    const send = async (cerrar: boolean) => {
        setSaving(true);
        try {
            const { seguimientos, ...rest } = f;
            const body: Record<string, unknown> = {
                ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])),
                seguimientos: seguimientos.filter((x) => x.fecha || x.cumplimiento || x.responsable || x.observaciones),
            };
            if (cerrar) body.cerrar = true;
            await api.guardarAccion(caso.id, ac.id, body);
            showToast({ type: 'success', message: cerrar ? `Acción correctiva ${ac.folio} cerrada.` : 'Acción correctiva guardada.' });
            onSaved();
            if (cerrar) onClose();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo guardar la acción correctiva') });
        } finally {
            setSaving(false);
        }
    };
    // Lo que exige el servidor para cerrar la acción (mismo orden del formulario).
    const conAc = f.procedeAc === true;
    const requisitos = visibles([
        { ok: f.procedeAc !== null, label: 'Indicar si procede una acción correctiva', why: 'Sección I: define si se implementa una acción o solo la corrección inmediata.' },
        { ok: f.accion.trim().length >= 5, label: 'Acción correctiva propuesta', why: 'Sección III: qué se hará para eliminar la causa.', show: conAc },
        { ok: f.responsable.trim().length >= 2, label: 'Responsable de implementación', why: 'Sección III: quién la implementa.', show: conAc },
        { ok: Boolean(f.plazo), label: 'Plazo de implementación', why: 'Sección III: fecha comprometida.', show: conAc },
        { ok: f.eficacia.trim().length >= 5, label: 'Comprobación de la eficacia', why: 'Sección IV: evidencia de que la acción funcionó.', show: conAc },
        { ok: f.causaEliminada !== null, label: 'Indicar si la causa fue eliminada', why: 'Sección IV: resultado de la verificación.', show: conAc },
        { ok: f.cierreNombre.trim().length >= 2 && Boolean(f.cierreFecha), label: 'Nombre y fecha de cierre', why: 'Sección IV: quién cierra la acción y cuándo (firma en el impreso).' },
    ]);
    const faltan = requisitos.filter((r) => !r.ok).length;
    const confirmClose = async () => {
        if (await confirmar({ titulo: `Cerrar ${ac.folio}`, mensaje: 'La acción correctiva quedará cerrada y ya no se podrá modificar.', textoConfirmar: 'Cerrar acción' })) send(true);
    };

    return (
        <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className={cn(readOnly ? 'sm:max-w-3xl' : 'sm:max-w-6xl')}>
                {dialogo}
                <DialogHeader>
                    <DialogTitle className="flex flex-wrap items-center gap-2">
                        Acción correctiva <span className="font-mono text-primary">{ac.folio}</span>
                        <Badge variant={caso.tipo === 'apelacion' ? 'info' : 'destructive'}>Origen: {caso.tipoLabel} {caso.folio}</Badge>
                    </DialogTitle>
                    <DialogDescription>Formulario OI-FoGe-02 (Acción Correctiva).</DialogDescription>
                </DialogHeader>
                <ConRequisitos panel={readOnly ? null : <RequisitosPanel accion="cerrar la acción" requisitos={requisitos} nota={faltan > 0 && 'Mientras tanto puedes «Guardar» lo avanzado.'} />}>
                    <div className="flex flex-col gap-4">
                        {ac.estado === 'anulada' && (
                            <Alert><IconBan /><AlertTitle>Acción correctiva anulada (levantada por error)</AlertTitle><AlertDescription>
                                {ac.anulada_en ? `El ${fmtDateTime(ac.anulada_en)}` : ''}{ac.anulada_por ? ` por ${ac.anulada_por}` : ''}. Motivo: {ac.anulacion_motivo}
                            </AlertDescription></Alert>
                        )}
                        <Seccion titulo="Detalle">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Campo label="Área en que se detecta"><Input disabled={readOnly} maxLength={200} value={f.area} onChange={txt('area')} /></Campo>
                                <Campo label="Nombre y cargo de quien detecta" htmlFor={`qa-detecta-${ac.id}`}><ConSugerencias id={`qa-detecta-${ac.id}`} sugerencias={personas} disabled={readOnly} maxLength={300} value={f.detectadoPor} onChange={txt('detectadoPor')} /></Campo>
                                {fecha('Fecha de detección', 'fechaDeteccion')}
                                {fecha('Fecha inicio tratamiento', 'fechaInicio')}
                            </div>
                            <Campo label="Requisito afectado" className="mt-3"><Input disabled={readOnly} maxLength={500} value={f.requisito} onChange={txt('requisito')} /></Campo>
                        </Seccion>
                        <Seccion titulo="Sección I · Descripción de la no conformidad">
                            <div className="flex flex-col gap-3">
                                {ta('Descripción del hallazgo encontrado', 'hallazgo')}
                                {ta('Justificación de por qué es una no conformidad', 'justificacion')}
                                {ta('Corrección inmediata', 'correccion')}
                                {yn('procedeAc', '¿Procede una acción correctiva?')}
                            </div>
                        </Seccion>
                        <Seccion titulo="Sección II · Análisis de la causa">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Campo label="Participantes"><Input disabled={readOnly} value={f.participantes} onChange={txt('participantes')} /></Campo>
                                <Campo label="Técnica utilizada" htmlFor={`qa-tecnica-${ac.id}`}>
                                    <ConSugerencias id={`qa-tecnica-${ac.id}`} sugerencias={TECNICAS} disabled={readOnly} maxLength={300} value={f.tecnica} onChange={txt('tecnica')} />
                                </Campo>
                            </div>
                            <div className="mt-3">{ta('Alcance de la no conformidad (detalle)', 'alcance')}</div>
                        </Seccion>
                        <Seccion titulo="Sección III · Acción correctiva propuesta">
                            <div className="flex flex-col gap-3">
                                {ta('Acción correctiva propuesta', 'accion')}
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <Campo label="Responsable de implementación" htmlFor={`qa-resp-ac-${ac.id}`}><ConSugerencias id={`qa-resp-ac-${ac.id}`} sugerencias={personas} disabled={readOnly} maxLength={200} value={f.responsable} onChange={txt('responsable')} /></Campo>
                                    {fecha('Plazo de implementación', 'plazo', true)}
                                    {fecha('Fecha de seguimiento', 'fechaSeguimiento', true)}
                                </div>
                                {yn('cumplimientoPlazo', 'Cumplimiento plazo implementación')}
                                {ta('Observaciones', 'observaciones')}
                            </div>
                        </Seccion>
                        <Seccion titulo="Sección IV · Seguimiento">
                            <div className="flex flex-col gap-4">
                                {['Primer', 'Segundo', 'Tercer'].map((n, i) => {
                                    const s = f.seguimientos[i];
                                    const r = noFuture(s.fecha, rec);
                                    return (
                                        <div key={n} className="rounded-md border border-border/70 p-3">
                                            <p className="mb-2 text-sm font-semibold">{n} seguimiento</p>
                                            <div className="grid gap-3 sm:grid-cols-3">
                                                <Campo label="Fecha" error={r.error}><Input type="date" {...limites(r)} disabled={readOnly} value={s.fecha} onChange={(e) => setSeg(i, 'fecha', e.target.value)} /></Campo>
                                                <Campo label="Cumplimiento" htmlFor={`qa-cumple-${ac.id}-${i}`}>
                                                    <ConSugerencias id={`qa-cumple-${ac.id}-${i}`} sugerencias={['Sí', 'Parcial', 'No']} disabled={readOnly} maxLength={50} value={s.cumplimiento} onChange={(e) => setSeg(i, 'cumplimiento', e.target.value)} />
                                                </Campo>
                                                <Campo label="Responsable" htmlFor={`qa-resp-seg-${ac.id}-${i}`}><ConSugerencias id={`qa-resp-seg-${ac.id}-${i}`} sugerencias={personas} disabled={readOnly} maxLength={200} value={s.responsable} onChange={(e) => setSeg(i, 'responsable', e.target.value)} /></Campo>
                                            </div>
                                            <Campo label="Observaciones" className="mt-2"><Input disabled={readOnly} maxLength={2000} value={s.observaciones} onChange={(e) => setSeg(i, 'observaciones', e.target.value)} /></Campo>
                                        </div>
                                    );
                                })}
                                {ta('Comprobación de la eficacia', 'eficacia', 'Evidencia observada con la que se comprueba la eficacia de la acción.')}
                                <div className="flex flex-wrap gap-6">
                                    {yn('causaEliminada', '¿La causa fue eliminada?')}
                                    {yn('seLevantaNc', 'Se levanta NC')}
                                </div>
                                {ta('Observaciones y comentarios', 'observacionesFinales')}
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Campo label="Nombre (cierre)" htmlFor={`qa-cierre-${ac.id}`}><ConSugerencias id={`qa-cierre-${ac.id}`} sugerencias={personas} disabled={readOnly} maxLength={200} value={f.cierreNombre} onChange={txt('cierreNombre')} /></Campo>
                                    {fecha('Fecha (cierre)', 'cierreFecha')}
                                </div>
                                <p className="text-xs text-muted-foreground">La firma se estampa en el formulario impreso.</p>
                            </div>
                        </Seccion>
                    </div>
                </ConRequisitos>
                <DialogFooter className="sm:justify-between">
                    <Button variant="outline" onClick={() => descargarFormulario(caso, ac).catch(() => showToast({ type: 'error', message: 'No se pudo generar el formulario OI-FoGe-02' }))}>
                        <IconFileText size={16} />Formulario OI-FoGe-02
                    </Button>
                    {readOnly ? <Button variant="outline" onClick={onClose}>Cerrar</Button> : (
                        <div className="flex gap-2">
                            <Button variant="outline" disabled={saving} onClick={() => send(false)}><IconDeviceFloppy size={16} />Guardar</Button>
                            <Button className="bg-success text-white hover:bg-success/90" disabled={faltan > 0 || saving} onClick={confirmClose}><IconFlagCheck size={16} />Cerrar acción</Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
