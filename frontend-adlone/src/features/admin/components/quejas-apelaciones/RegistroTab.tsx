import React, { useEffect, useMemo, useState } from 'react';
import { IconDeviceFloppy, IconInfoCircle, IconLock, IconPaperclip, IconDownload, IconFileUpload } from '@tabler/icons-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '../../../../contexts/ToastContext';
import { quejasApelacionesService as api, mensajeError, type Caso } from '../../services/quejasApelaciones.service';
import { Campo, ConSugerencias, Segmentado, Seccion } from './comun';
import { TIPOS, ORIGENES, EMISORES, VIAS_INGRESO, MAX_ADJUNTO, TIPOS_ADJUNTO, today, noFuture, limites, fmtDateTime, kb, cleanCompany, cleanName, cleanEmail, cleanPhone, finalizePhone, cleanReference } from './reglas';
import { regErrors, regFrom, regPayload, type Errores, type RegForm } from './registro';

/** Campos en el orden del formulario de Calidad (OI-FoGe-05). */
export function RegistroFields({ form, setForm, errors, folio, web, readOnly, tipoFijo }: {
    form: RegForm; setForm: React.Dispatch<React.SetStateAction<RegForm>>; errors: Errores; folio?: string; web?: boolean; readOnly?: boolean;
    /** En las secciones Quejas / Apelaciones el tipo lo da la sección. */
    tipoFijo?: boolean;
}) {
    const setV = (k: keyof RegForm, v: string) => setForm((f) => ({ ...f, [k]: v }));
    const webNote = 'Lo registró el sistema al recibirla por la web; no se modifica.';
    return (
        <div className="flex flex-col gap-4">
            <Seccion>
                <div className="grid gap-3 sm:grid-cols-3">
                    <Campo label="N°">
                        {folio
                            ? <span className="font-mono text-lg font-bold text-primary">{folio}</span>
                            : <span className="text-sm italic text-muted-foreground">Se asigna automáticamente al guardar</span>}
                    </Campo>
                    <Campo label="Tipo" required>
                        <Segmentado ariaLabel="Tipo" options={TIPOS} value={form.tipo} onChange={(v) => setV('tipo', v)} disabled={readOnly || tipoFijo} />
                    </Campo>
                    <Campo label="Origen" required>
                        <Segmentado ariaLabel="Origen" options={ORIGENES} value={form.origen} onChange={(v) => setV('origen', v)} disabled={readOnly} />
                    </Campo>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Campo label="Presentada por" required>
                        <Segmentado ariaLabel="Presentada por" options={EMISORES} value={form.emisor} onChange={(v) => setV('emisor', v)} disabled={readOnly} />
                    </Campo>
                    <Campo label="Vía de ingreso" htmlFor="qa-via-ingreso" description={web ? 'Formulario web' : undefined}>
                        <ConSugerencias id="qa-via-ingreso" sugerencias={VIAS_INGRESO} maxLength={50} placeholder="En persona, correo, teléfono, fax…"
                            value={form.viaIngreso} onChange={(e) => setV('viaIngreso', e.target.value)} disabled={readOnly || web} />
                    </Campo>
                </div>
            </Seccion>
            <div className="grid gap-3 sm:grid-cols-2">
                <Campo label="Empresa" required error={errors.empresa}>
                    <Input value={form.empresa} disabled={readOnly} placeholder="Ej. Salmones del Sur S.A." onChange={(e) => setV('empresa', cleanCompany(e.target.value))} />
                </Campo>
                <Campo label="Fecha recepción" required error={errors.fechaRecepcion} description={web ? webNote : undefined}>
                    <Input type="date" max={today()} value={form.fechaRecepcion} disabled={readOnly || web} onChange={(e) => setV('fechaRecepcion', e.target.value)} />
                </Campo>
                <Campo label="Nombre" required error={errors.nombre}>
                    <Input value={form.nombre} disabled={readOnly} placeholder="Ej. María José Pérez" onChange={(e) => setV('nombre', cleanName(e.target.value))} />
                </Campo>
                <Campo label="Hora recepción" required error={errors.horaRecepcion} description={web ? webNote : undefined}>
                    <Input type="time" value={form.horaRecepcion} disabled={readOnly || web} onChange={(e) => setV('horaRecepcion', e.target.value)} />
                </Campo>
                <Campo label="Mail de contacto" required error={errors.correo} description={web ? 'Lo ingresó el cliente en la web; no se modifica.' : undefined}>
                    <Input type="email" value={form.correo} disabled={readOnly || web} placeholder="nombre@empresa.cl" onChange={(e) => setV('correo', cleanEmail(e.target.value))} />
                </Campo>
                <Campo label="Fecha tratamiento" description="Se completa sola al iniciar el tratamiento." error={noFuture(form.fechaTratamiento, form.fechaRecepcion).error}>
                    <Input type="date" {...limites(noFuture(form.fechaTratamiento, form.fechaRecepcion))} value={form.fechaTratamiento} disabled={readOnly}
                        onChange={(e) => setV('fechaTratamiento', e.target.value)} />
                </Campo>
                <Campo label="Fono de contacto" required error={errors.telefono}>
                    <Input inputMode="tel" value={form.telefono} disabled={readOnly} placeholder="+56912345678"
                        onFocus={() => { if (!form.telefono) setV('telefono', '+'); }}
                        onChange={(e) => setV('telefono', cleanPhone(e.target.value))}
                        onBlur={() => setForm((f) => ({ ...f, telefono: finalizePhone(f.telefono) }))} />
                </Campo>
                <Campo label="N° de informe, muestra u orden">
                    <Input value={form.numeroInforme} disabled={readOnly} placeholder="Opcional" onChange={(e) => setV('numeroInforme', cleanReference(e.target.value))} />
                </Campo>
            </div>
            <p className="text-xs text-muted-foreground">(*): Ítems obligatorios</p>
            <Campo label="Motivo de la queja o apelación" required error={errors.motivo} description={web ? 'Presentación original del cliente en la web; no se modifica.' : undefined}>
                <Textarea rows={4} maxLength={5000} value={form.motivo} disabled={readOnly || web} onChange={(e) => setV('motivo', e.target.value)} />
            </Campo>
        </div>
    );
}

/** Selector de archivo (PDF o imagen de hasta 5 MB). */
export function ArchivoInput({ archivo, onChange, onError }: { archivo: File | null; onChange: (f: File | null) => void; onError: (m: string) => void }) {
    return (
        <div className="flex items-center gap-2">
            <Input type="file" accept={TIPOS_ADJUNTO} className="cursor-pointer file:mr-3 file:cursor-pointer file:border-0 file:bg-transparent file:text-sm file:font-medium"
                onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    if (f && f.size > MAX_ADJUNTO) { onError('El archivo supera los 5 MB.'); e.target.value = ''; onChange(null); return; }
                    onChange(f);
                }} />
            {archivo && <span className="shrink-0 text-xs text-muted-foreground">{kb(archivo.size)}</span>}
        </div>
    );
}

export function RegistroTab({ caso, onSaved }: { caso: Caso; onSaved: () => void }) {
    const { showToast } = useToast();
    const [form, setForm] = useState<RegForm>(() => regFrom(caso));
    const [tried, setTried] = useState(false);
    const [saving, setSaving] = useState(false);
    useEffect(() => { setForm(regFrom(caso)); setTried(false); }, [caso]);
    const web = caso.canal === 'web';
    const readOnly = caso.cerrado;
    const errors = useMemo(() => regErrors(form, web), [form, web]);
    const dirty = JSON.stringify(regPayload(form)) !== JSON.stringify(regPayload(regFrom(caso)));

    const save = async () => {
        setTried(true);
        if (Object.keys(errors).length) return;
        setSaving(true);
        try {
            const body: Record<string, string> = regPayload(form);
            if (web) ['motivo', 'correo', 'fechaRecepcion', 'horaRecepcion', 'viaIngreso'].forEach((k) => delete body[k]);
            await api.editarRegistro(caso.id, body);
            showToast({ type: 'success', message: 'Registro guardado.' });
            onSaved();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo guardar el registro') });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {web && (
                <Alert variant="info"><IconInfoCircle /><AlertDescription>
                    Ingresó por el formulario web: el N°, el origen, la fecha y la hora de recepción se asignaron automáticamente.
                </AlertDescription></Alert>
            )}
            {caso.cerrado && <Alert><IconLock /><AlertDescription>El caso está cerrado: el registro ya no se modifica.</AlertDescription></Alert>}
            <RegistroFields form={form} setForm={setForm} errors={tried ? errors : {}} folio={caso.folio} web={web} readOnly={readOnly} />
            {!readOnly && (
                <div className="flex items-center justify-end gap-3">
                    {dirty && <span className="text-xs text-warning">Hay cambios sin guardar</span>}
                    <Button onClick={save} disabled={!dirty || saving}><IconDeviceFloppy size={16} />{saving ? 'Guardando…' : 'Guardar registro'}</Button>
                </div>
            )}
            <AdjuntosSection caso={caso} onSaved={onSaved} />
        </div>
    );
}

function AdjuntosSection({ caso, onSaved }: { caso: Caso; onSaved: () => void }) {
    const { showToast } = useToast();
    const [file, setFile] = useState<File | null>(null);
    const [desc, setDesc] = useState('');
    const [saving, setSaving] = useState(false);
    const [inputKey, setInputKey] = useState(0);
    const subir = async () => {
        if (!file) return;
        setSaving(true);
        try {
            await api.subirAdjunto(caso.id, file, desc.trim());
            showToast({ type: 'success', message: 'Adjunto guardado en el caso.' });
            setFile(null);
            setDesc('');
            setInputKey((k) => k + 1);
            onSaved();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo guardar el adjunto') });
        } finally {
            setSaving(false);
        }
    };
    const descargar = (id: number, nombre: string) => api.descargar(`/${caso.id}/adjuntos/${id}`, nombre)
        .catch(() => showToast({ type: 'error', message: 'No se pudo descargar el adjunto' }));
    return (
        <Seccion titulo="Adjuntos" icono={<IconPaperclip size={16} className="text-primary" />}>
            <p className="-mt-2 mb-3 text-xs text-muted-foreground">La queja original escrita y las evidencias quedan junto al registro.</p>
            {caso.adjuntos.length ? (
                <ul className="flex flex-col divide-y divide-border">
                    {caso.adjuntos.map((a) => (
                        <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{a.nombre}</p>
                                <p className="text-xs text-muted-foreground">{a.descripcion ? `${a.descripcion} · ` : ''}{kb(a.tamano)} · {a.subido_por || '—'} · {fmtDateTime(a.creado_en)}</p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => descargar(a.id, a.nombre)}><IconDownload size={14} />Descargar</Button>
                        </li>
                    ))}
                </ul>
            ) : <p className="text-sm text-muted-foreground">Sin adjuntos.</p>}
            <div className="mt-3 grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <div key={inputKey}><ArchivoInput archivo={file} onChange={setFile} onError={(m) => showToast({ type: 'error', message: m })} /></div>
                <Input placeholder="Descripción (opcional)" value={desc} maxLength={300} onChange={(e) => setDesc(e.target.value)} />
                <Button size="sm" className="h-9" disabled={!file || saving} onClick={subir}><IconFileUpload size={14} />{saving ? 'Subiendo…' : 'Subir'}</Button>
            </div>
        </Seccion>
    );
}
