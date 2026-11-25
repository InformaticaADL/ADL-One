import React, { useEffect, useState } from 'react';
import { IconDeviceFloppy, IconFlagCheck, IconInfoCircle, IconAlertTriangle, IconUserX } from '@tabler/icons-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useConfirmacion } from '@/components/ui/confirm-dialog';
import { useToast } from '../../../../contexts/ToastContext';
import { quejasApelacionesService as api, avisoCorreo, mensajeError, type Caso } from '../../services/quejasApelaciones.service';
import { Campo, ConRequisitos, ConSugerencias, RequisitosPanel, Seccion, Segmentado } from './comun';
import { useSugerenciasPersonas } from './usuarios';
import { fmtDateTime, limites, noFuture, visibles } from './reglas';
import { AccionesSection } from './AccionesCorrectivas';

export function TratamientoTab({ caso, onSaved }: { caso: Caso; onSaved: () => void }) {
    const { showToast } = useToast();
    const { confirmar, dialogo } = useConfirmacion();
    const personas = useSugerenciasPersonas();
    const init = () => ({
        fechaTratamiento: caso.fecha_tratamiento || '', analisisCausa: caso.analisis_causa || '',
        accionesCorrectivas: caso.acciones_correctivas || '', accionesPreventivas: caso.acciones_preventivas || '',
        tratamiento: caso.tratamiento || '', conclusiones: caso.conclusiones || '', participantes: caso.participantes || '',
        aprobadoPor: caso.aprobado_por || '', respuestaFormal: caso.respuesta_formal || '', eficacia: caso.eficacia || '',
    });
    const [f, setF] = useState(init);
    // ¿Quien aprueba participó en la actividad? '' = sin responder (se confirma al cerrar, no se guarda como borrador).
    const [aprobadorParticipo, setAprobadorParticipo] = useState<'' | 'si' | 'no'>('');
    const independiente = aprobadorParticipo === 'no';
    const [notificar, setNotificar] = useState(true);
    const [saving, setSaving] = useState(false);
    useEffect(() => { setF(init()); setAprobadorParticipo(''); }, [caso]); // eslint-disable-line react-hooks/exhaustive-deps
    type F = ReturnType<typeof init>;
    const set = (k: keyof F) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { const v = e.target.value; setF((p) => ({ ...p, [k]: v })); };

    if (caso.estado === 'no_procede') {
        return <Alert><IconInfoCircle /><AlertDescription>El caso se cerró en la evaluación porque no procede. La respuesta formal está en la pestaña Evaluación.</AlertDescription></Alert>;
    }
    if (caso.estado === 'registrada' || caso.estado === 'en_evaluacion') {
        return (
            <Alert variant="warning"><IconAlertTriangle /><AlertDescription>
                Primero completa la evaluación y registra si el caso procede. Después podrás registrar aquí el tratamiento.
            </AlertDescription></Alert>
        );
    }
    const cerrada = caso.estado === 'cerrada';
    const readOnly = cerrada;
    const abiertas = caso.acciones.filter((a) => a.estado === 'abierta');
    const requisitos = visibles([
        {
            ok: abiertas.length === 0,
            label: abiertas.length ? `Cerrar las acciones correctivas abiertas (${abiertas.map((a) => a.folio).join(', ')})` : 'Acciones correctivas cerradas',
            why: 'El caso no se cierra con acciones correctivas abiertas: ciérralas en su formulario OI-FoGe-02 (botón «Editar»).',
        },
        { ok: f.conclusiones.trim().length >= 10, label: 'Conclusiones (mín. 10 caracteres)', why: 'Resumen de cómo se resolvió el caso; va en el formulario OI-FoGe-05.' },
        { ok: f.participantes.trim().length >= 2, label: 'Participantes del tratamiento', why: 'Quiénes trabajaron en resolver el caso (nombre y cargo).' },
        { ok: f.aprobadoPor.trim().length >= 2, label: 'Quién revisa, aprueba y firma el cierre', why: 'La resolución la aprueba la persona designada (cl. 7.9.6).' },
        { ok: independiente, label: 'Confirmar que quien aprueba no participó en la actividad', why: 'Quien aprueba debe ser independiente de la actividad reclamada (cl. 7.9.6). Si participó, designa a otra persona (subrogancia).' },
        { ok: f.respuestaFormal.trim().length >= 10, label: 'Respuesta formal al cliente (mín. 10 caracteres)', why: 'Es la comunicación de cierre al cliente (cl. 7.9.7).' },
    ]);
    const faltan = requisitos.filter((r) => !r.ok).length;

    const send = async (cerrar: boolean, soloEficacia = false) => {
        setSaving(true);
        try {
            const body: Record<string, unknown> = soloEficacia
                ? { eficacia: f.eficacia.trim() }
                : Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]));
            if (cerrar) { body.cerrar = true; body.aprobadorIndependiente = independiente; body.notificarCliente = notificar; }
            const r = await api.guardarTratamiento(caso.id, body);
            showToast({
                type: r.correo === 'sin_cola' ? 'warning' : 'success',
                message: cerrar ? `Caso cerrado.${avisoCorreo(r.correo)}` : soloEficacia ? 'Verificación de eficacia guardada.' : 'Tratamiento guardado.',
            });
            onSaved();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo guardar el tratamiento') });
        } finally {
            setSaving(false);
        }
    };

    const confirmClose = async () => {
        const ok = await confirmar({
            titulo: 'Cerrar el caso',
            mensaje: `El caso quedará cerrado y ya no se podrá modificar (solo la verificación de eficacia).${notificar ? ' Se enviará la respuesta formal al mail de contacto y quedará registrada como finalización de proceso.' : ''}`,
            textoConfirmar: 'Cerrar caso',
        });
        if (ok) send(true);
    };

    const area = (label: string, k: keyof F, extra: { required?: boolean; placeholder?: string; description?: string; rows?: number } = {}) => (
        <Campo label={label} required={extra.required} description={extra.description}>
            <Textarea rows={extra.rows || 2} maxLength={8000} disabled={readOnly} value={f[k]} onChange={set(k)} placeholder={extra.placeholder} />
        </Campo>
    );
    const panel = !readOnly ? <RequisitosPanel accion="cerrar el caso" requisitos={requisitos} nota={faltan > 0 && 'Mientras tanto puedes «Guardar» lo avanzado.'} /> : null;
    const fechaTrat = noFuture(f.fechaTratamiento, caso.fecha_recepcion);

    return (
        <ConRequisitos panel={panel}>
            <div className="flex flex-col gap-4">
                {dialogo}
                {cerrada && (
                    <Alert variant="success"><IconFlagCheck /><AlertDescription>
                        Caso cerrado el {fmtDateTime(caso.cerrado_en)}{caso.cerrado_por && ` por ${caso.cerrado_por}`}. Aprobó: <b>{caso.aprobado_por}</b>.
                    </AlertDescription></Alert>
                )}
                <Campo label="Fecha tratamiento" error={fechaTrat.error} className="sm:max-w-[220px]">
                    <Input type="date" {...limites(fechaTrat)} disabled={readOnly} value={f.fechaTratamiento} onChange={set('fechaTratamiento')} />
                </Campo>
                {area('Análisis de causa', 'analisisCausa', { placeholder: '¿Por qué ocurrió? Causa raíz.' })}
                <AccionesSection caso={caso} canEdit={!cerrada} onSaved={onSaved} />
                <div className="grid gap-3 sm:grid-cols-2">
                    {area('Otras acciones correctivas (texto)', 'accionesCorrectivas', { description: 'Lo que no requiera un formulario de acción correctiva.' })}
                    {area('Acciones preventivas', 'accionesPreventivas')}
                </div>
                {area('Tratamiento', 'tratamiento', { placeholder: 'Qué se hizo para resolver el caso.' })}
                {area('Conclusiones', 'conclusiones', { required: true })}
                {area('Participantes', 'participantes', { required: true, placeholder: 'Nombre y cargo, uno por línea.' })}
                <div className="flex items-center gap-3 pt-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resolución (cl. 7.9.6 y 7.9.7)</span>
                    <span className="h-px flex-1 bg-border" />
                </div>
                <Campo label="Revisa, aprueba y firma el cierre" required htmlFor="qa-aprobado-por" description="SubGerente de Gestión de Calidad o quien designe (subrogancia).">
                    <ConSugerencias id="qa-aprobado-por" sugerencias={personas} maxLength={200} disabled={readOnly} placeholder="Nombre y cargo" value={f.aprobadoPor}
                        onChange={(e) => { const v = e.target.value; setF((p) => ({ ...p, aprobadoPor: v })); setAprobadorParticipo(''); }} />
                </Campo>
                {!readOnly && (
                    <>
                        <Campo label={`¿Quien aprueba participó en la actividad que motivó la ${caso.tipo === 'apelacion' ? 'apelación' : 'queja'}?`} required
                            description="Se confirma al momento de cerrar; no queda guardado como borrador.">
                            <Segmentado ariaLabel="Quien aprueba participó" className="sm:max-w-sm" value={aprobadorParticipo}
                                options={[{ value: 'no', label: 'No participó' }, { value: 'si', label: 'Sí participó' }]}
                                tono={(v) => (v === 'si' ? 'destructive' : 'success')} onChange={(v) => setAprobadorParticipo(v as 'si' | 'no')} />
                        </Campo>
                        {aprobadorParticipo === 'si' && (
                            <Alert variant="destructive">
                                <IconUserX />
                                <AlertTitle>Esta persona no puede aprobar el cierre</AlertTitle>
                                <AlertDescription>
                                    La resolución debe aprobarla alguien que no participó en la actividad en cuestión (cl. 7.9.6).
                                    Escribe en «Revisa, aprueba y firma el cierre» a otra persona; por ejemplo, quien subrogue al SubGerente de Gestión de Calidad.
                                </AlertDescription>
                            </Alert>
                        )}
                    </>
                )}
                {area('Respuesta formal al cliente', 'respuestaFormal', { required: true, rows: 3 })}
                {!readOnly && (
                    <>
                        <label className="flex items-start gap-2 text-sm">
                            <Checkbox className="mt-0.5" checked={notificar} onCheckedChange={(v) => setNotificar(v === true)} />
                            <span>
                                Al cerrar, enviar la respuesta formal al mail de contacto
                                <span className="block text-xs text-muted-foreground">Queda registrado como finalización de proceso.</span>
                            </span>
                        </label>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" disabled={saving} onClick={() => send(false)}><IconDeviceFloppy size={16} />Guardar</Button>
                            <Button className="bg-success text-white hover:bg-success/90" disabled={faltan > 0 || saving} onClick={confirmClose}><IconFlagCheck size={16} />Cerrar caso</Button>
                        </div>
                    </>
                )}
                {cerrada && (
                    <Seccion>
                        <Campo label="Verificación de la eficacia de las acciones" description="Se registra después del cierre, cuando se comprueba que las acciones funcionaron.">
                            <Textarea rows={2} maxLength={8000} value={f.eficacia} onChange={set('eficacia')} />
                        </Campo>
                        <div className="mt-3 flex justify-end">
                            <Button size="sm" disabled={saving || f.eficacia === (caso.eficacia || '')} onClick={() => send(false, true)}>
                                <IconDeviceFloppy size={14} />Guardar verificación
                            </Button>
                        </div>
                    </Seccion>
                )}
            </div>
        </ConRequisitos>
    );
}
