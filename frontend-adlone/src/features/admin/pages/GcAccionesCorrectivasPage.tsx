import React, { useCallback, useEffect, useState } from 'react';
import { IconClipboardList, IconDownload, IconDeviceFloppy, IconBan, IconCircleCheck, IconPlus, IconArrowLeft, IconSignature } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useNavStore } from '../../../store/navStore';
import { useToast } from '../../../contexts/ToastContext';
import { CampoFirma } from '../components/CampoFirma';
import { VistaPreviaPdf } from '../components/VistaPreviaPdf';
import {
    calidadService, mensajeError, type AccionCorrectiva, type AccionRow, type OrigenAc, type SeguimientoAc,
} from '../services/calidad.service';

// G. Calidad → Calidad → Acciones Correctivas (OI-FoGe-02). Las de auditoría interna se abren desde un hallazgo NC
// (fase 3); aquí también se puede abrir una suelta (queja, apelación, auditoría externa, revisión de gerencia,
// autodetectada u otro). El formulario tiene 4 secciones, como el documento, y su PDF en vivo a la derecha.

const ORIGEN_LABEL: Record<OrigenAc, string> = {
    AUDITORIA_INTERNA: 'Auditoría Interna', AUDITORIA_EXTERNA_2: 'Auditoría Externa (2ª Parte)', AUDITORIA_EXTERNA_3: 'Auditoría Externa (3ª Parte)',
    QUEJA: 'Queja', APELACION: 'Apelación', REVISION_GERENCIA: 'Revisiones de Gerencia', AUTODETECTADA: 'Autodetectada', OTRO: 'Otro',
};
const ESTADO_VARIANT = { ABIERTA: 'warning', CERRADA: 'success', ANULADA: 'destructive' } as const;

export const GcAccionesCorrectivasPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { setActiveSubmodule, pendingAccionId, setPendingAccionId } = useNavStore();
    const { showToast } = useToast();
    const [lista, setLista] = useState<AccionRow[]>([]);
    const [cargando, setCargando] = useState(true);
    const [filtroEstado, setFiltroEstado] = useState('ABIERTA');
    const [elegida, setElegida] = useState<number | null>(null);
    const [creando, setCreando] = useState(false);
    const [nuevoOrigen, setNuevoOrigen] = useState<OrigenAc>('AUTODETECTADA');

    const cargarLista = useCallback(async () => {
        setCargando(true);
        try { setLista(await calidadService.listarAcciones(filtroEstado === 'TODAS' ? {} : { estado: filtroEstado })); } catch { /* vacío */ } finally { setCargando(false); }
    }, [filtroEstado]);
    useEffect(() => { cargarLista(); }, [cargarLista]);

    useEffect(() => { if (pendingAccionId) { setElegida(pendingAccionId); setPendingAccionId(null); } }, [pendingAccionId, setPendingAccionId]);

    const crear = async () => {
        setCreando(true);
        try {
            const r = await calidadService.crearAccion({ origen: nuevoOrigen });
            showToast({ type: 'success', message: `Acción correctiva ${r.folio} creada.` });
            await cargarLista();
            setElegida(r.id_accion);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo crear la acción correctiva.' });
        } finally {
            setCreando(false);
        }
    };

    return (
        <div className="shadcn-scope flex w-full flex-col gap-4 p-4 md:p-6 lg:h-[calc(100vh-64px)]">
            <PageHeader
                title="Acciones Correctivas"
                subtitle="Formulario OI-FoGe-02: análisis de causa, acción propuesta, seguimientos y comprobación de la eficacia."
                onBack={onBack}
                breadcrumbItems={[{ label: 'Calidad', onClick: () => setActiveSubmodule('gc-hub-cal') }, { label: 'Acciones Correctivas' }]}
            />
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_1fr]">
                <div className="flex min-h-0 flex-col gap-3">
                    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
                        <span className="text-xs font-medium text-muted-foreground">Nueva acción correctiva (origen distinto de auditoría interna)</span>
                        <Select value={nuevoOrigen} onValueChange={(v) => setNuevoOrigen(v as OrigenAc)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {(Object.keys(ORIGEN_LABEL) as OrigenAc[]).filter((o) => o !== 'AUDITORIA_INTERNA').map((o) => <SelectItem key={o} value={o}>{ORIGEN_LABEL[o]}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button size="sm" onClick={crear} disabled={creando}><IconPlus size={14} /> Crear</Button>
                    </section>
                    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                            <span className="flex items-center gap-1.5 text-sm font-semibold"><IconClipboardList size={15} /> Acciones</span>
                            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                                <SelectTrigger className="h-7 w-28 text-[11px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ABIERTA">Abiertas</SelectItem>
                                    <SelectItem value="CERRADA">Cerradas</SelectItem>
                                    <SelectItem value="ANULADA">Anuladas</SelectItem>
                                    <SelectItem value="TODAS">Todas</SelectItem>
                                </SelectContent>
                            </Select>
                        </header>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {cargando ? (
                                <div className="flex justify-center p-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
                            ) : lista.length === 0 ? (
                                <p className="px-3 py-6 text-center text-xs text-muted-foreground">No hay acciones correctivas.</p>
                            ) : (
                                lista.map((a) => (
                                    <button key={a.id_accion} type="button" onClick={() => setElegida(a.id_accion)}
                                        className={cn('flex w-full flex-col gap-0.5 border-b border-border px-3 py-2 text-left transition-colors hover:bg-muted', elegida === a.id_accion && 'bg-primary/10')}>
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-xs font-semibold">{a.folio}</span>
                                            <Badge variant={ESTADO_VARIANT[a.estado]} className="text-[10px]">{a.estado === 'ABIERTA' ? (a.vencida ? 'Vencida' : 'Abierta') : a.estado === 'CERRADA' ? 'Cerrada' : 'Anulada'}</Badge>
                                        </span>
                                        <span className="text-[11px] text-muted-foreground">{ORIGEN_LABEL[a.origen]}{a.area ? ` · ${a.area}` : ''}</span>
                                        {a.responsable && <span className="text-[11px] text-muted-foreground">Responsable: {a.responsable}</span>}
                                    </button>
                                ))
                            )}
                        </div>
                    </section>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    {elegida ? (
                        <DetalleAccion id={elegida} onCambio={cargarLista} onCerrar={() => setElegida(null)} />
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                            <IconClipboardList size={40} className="opacity-40" />
                            <span>Elija una acción correctiva o cree una nueva.</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const vacioSeguimiento = (): SeguimientoAc => ({ fecha: '', cumplimiento: '', responsable: '', observaciones: '' });

const DetalleAccion: React.FC<{ id: number; onCambio: () => void; onCerrar: () => void }> = ({ id, onCambio, onCerrar }) => {
    const { showToast } = useToast();
    const [a, setA] = useState<AccionCorrectiva | null>(null);
    const [cargando, setCargando] = useState(true);
    const [d, setD] = useState<Partial<AccionCorrectiva> & { seguimientos: SeguimientoAc[] }>({ seguimientos: [] });
    const [guardando, setGuardando] = useState(false);
    const [anulando, setAnulando] = useState(false);
    const [cerrando, setCerrando] = useState(false);
    const [motivo, setMotivo] = useState('');
    const [nombreCierre, setNombreCierre] = useState('');
    const [firmaCierre, setFirmaCierre] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const r = await calidadService.obtenerAccion(id);
            setA(r);
            setD({ ...r, seguimientos: r.seguimientos.length ? r.seguimientos : [vacioSeguimiento()] });
            setNombreCierre(r.cierre_nombre || '');
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo cargar la acción correctiva.' });
        } finally {
            setCargando(false);
        }
    }, [id, showToast]);
    useEffect(() => { cargar(); }, [cargar]);

    const bloqueado = a?.estado !== 'ABIERTA';
    const generar = useCallback(() => calidadService.accionVistaPreviaUrl(id, d).then((url) => ({ url, nombre: 'OI-FoGe-02 Acción Correctiva.pdf' })), [id, d]);

    const guardar = async () => {
        setGuardando(true);
        try {
            await calidadService.guardarAccion(id, d);
            showToast({ type: 'success', message: 'Acción correctiva guardada.' });
            await cargar(); onCambio();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo guardar.' });
        } finally {
            setGuardando(false);
        }
    };
    const cerrar = async () => {
        try {
            await calidadService.cerrarAccion(id, { nombre: nombreCierre, firma: firmaCierre });
            showToast({ type: 'success', message: 'Acción correctiva cerrada.' });
            setCerrando(false);
            await cargar(); onCambio();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo cerrar.' });
        }
    };
    const anular = async () => {
        try {
            await calidadService.anularAccion(id, motivo);
            showToast({ type: 'success', message: 'Acción correctiva anulada.' });
            setAnulando(false); setMotivo('');
            await cargar(); onCambio();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo anular.' });
        }
    };
    const descargar = async () => {
        const pdf = await calidadService.accionPdf(id);
        const el = document.createElement('a'); el.href = pdf.url; el.download = pdf.nombre; el.click();
        setTimeout(() => URL.revokeObjectURL(pdf.url), 4000);
    };

    const campo = (k: keyof typeof d, label: string, rows = 2) => (
        <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">{label}</span>
            <Textarea disabled={bloqueado} rows={rows} value={(d[k] as string) || ''} onChange={(e) => setD((p) => ({ ...p, [k]: e.target.value }))} /></label>
    );
    const siNo = (k: 'procede_ac' | 'cumplimiento_plazo' | 'causa_eliminada' | 'se_levanta_nc', label: string) => (
        <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-muted-foreground">{label}</span>
            <div className="flex gap-1">
                {([['SI', true], ['NO', false]] as const).map(([txt, val]) => (
                    <button key={txt} type="button" disabled={bloqueado} onClick={() => setD((p) => ({ ...p, [k]: val }))}
                        className={cn('rounded px-2.5 py-1 font-semibold', d[k] === val ? (val ? 'bg-success text-white' : 'bg-destructive text-white') : 'bg-muted text-muted-foreground')}>
                        {txt}
                    </button>
                ))}
            </div>
        </div>
    );

    if (cargando || !a) return <div className="flex h-full items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

    return (
        <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCerrar}><IconArrowLeft size={14} /></Button>
                    <span className="font-mono text-sm font-semibold">{a.folio}</span>
                    <Badge variant={ESTADO_VARIANT[a.estado]}>{a.estado === 'ABIERTA' ? 'Abierta' : a.estado === 'CERRADA' ? 'Cerrada' : 'Anulada'}</Badge>
                    <span className="text-xs text-muted-foreground">{ORIGEN_LABEL[a.origen]}</span>
                </div>
                {a.estado === 'ABIERTA' && (
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setAnulando(true)}><IconBan size={14} /> Anular</Button>
                        <Button size="sm" className="bg-success text-white hover:bg-success/90" onClick={() => setCerrando(true)}><IconCircleCheck size={14} /> Cerrar</Button>
                    </div>
                )}
            </div>
            {a.estado === 'ANULADA' && a.motivo_anulacion && <p className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">Anulada: {a.motivo_anulacion}</p>}

            <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]">
                <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
                    <div className="grid gap-2 sm:grid-cols-2">
                        <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">Área en que se detecta</span>
                            <Input disabled={bloqueado} value={d.area || ''} onChange={(e) => setD((p) => ({ ...p, area: e.target.value }))} /></label>
                        <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">Requisito afectado</span>
                            <Input disabled={bloqueado} value={d.requisito || ''} onChange={(e) => setD((p) => ({ ...p, requisito: e.target.value }))} /></label>
                        <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">Fecha de Detección</span>
                            <Input type="date" disabled={bloqueado} value={d.fecha_deteccion || ''} onChange={(e) => setD((p) => ({ ...p, fecha_deteccion: e.target.value }))} /></label>
                        <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">Fecha inicio Tratamiento</span>
                            <Input type="date" disabled={bloqueado} value={d.fecha_inicio || ''} onChange={(e) => setD((p) => ({ ...p, fecha_inicio: e.target.value }))} /></label>
                    </div>
                    <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">Nombre y cargo de quien detecta</span>
                        <Input disabled={bloqueado} value={d.detectado_por || ''} onChange={(e) => setD((p) => ({ ...p, detectado_por: e.target.value }))} /></label>

                    <div className="rounded-lg border border-border p-2.5">
                        <p className="mb-2 text-xs font-semibold">SECCIÓN I: Descripción de la No Conformidad</p>
                        {campo('hallazgo', 'Descripción del hallazgo encontrado')}
                        {campo('justificacion', 'Justificación de por qué es una No Conformidad')}
                        {campo('correccion_inmediata', 'Corrección Inmediata')}
                        {siNo('procede_ac', '¿Procede una acción correctiva?')}
                    </div>
                    <div className="rounded-lg border border-border p-2.5">
                        <p className="mb-2 text-xs font-semibold">SECCIÓN II: Análisis de la Causa</p>
                        <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">Participantes</span>
                            <Input disabled={bloqueado} value={d.participantes || ''} onChange={(e) => setD((p) => ({ ...p, participantes: e.target.value }))} /></label>
                        <label className="mt-2 flex flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">Técnica utilizada</span>
                            <Input disabled={bloqueado} value={d.tecnica || ''} onChange={(e) => setD((p) => ({ ...p, tecnica: e.target.value }))} /></label>
                        <div className="mt-2">{campo('alcance', 'Alcance de la No Conformidad (Detalle)')}</div>
                    </div>
                    <div className="rounded-lg border border-border p-2.5">
                        <p className="mb-2 text-xs font-semibold">SECCIÓN III: Acción Correctiva Propuesta</p>
                        {campo('accion_propuesta', 'Acción propuesta')}
                        <div className="grid gap-2 sm:grid-cols-3">
                            <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">Responsable</span>
                                <Input disabled={bloqueado} value={d.responsable || ''} onChange={(e) => setD((p) => ({ ...p, responsable: e.target.value }))} /></label>
                            <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">Plazo</span>
                                <Input type="date" disabled={bloqueado} value={d.plazo || ''} onChange={(e) => setD((p) => ({ ...p, plazo: e.target.value }))} /></label>
                            <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">Fecha de seguimiento</span>
                                <Input type="date" disabled={bloqueado} value={d.fecha_seguimiento || ''} onChange={(e) => setD((p) => ({ ...p, fecha_seguimiento: e.target.value }))} /></label>
                        </div>
                        {siNo('cumplimiento_plazo', 'Cumplimiento plazo implementación')}
                        {campo('observaciones', 'Observaciones')}
                    </div>
                    <div className="rounded-lg border border-border p-2.5">
                        <p className="mb-2 text-xs font-semibold">SECCIÓN IV: Seguimiento</p>
                        {['Primer', 'Segundo', 'Tercer'].map((n, i) => {
                            const s = d.seguimientos[i] || vacioSeguimiento();
                            const set = (patch: Partial<SeguimientoAc>) => setD((p) => {
                                const segs = [...p.seguimientos];
                                while (segs.length <= i) segs.push(vacioSeguimiento());
                                segs[i] = { ...segs[i], ...patch };
                                return { ...p, seguimientos: segs };
                            });
                            return (
                                <div key={n} className="mb-2 flex flex-col gap-1.5 rounded-md border border-border/70 p-2">
                                    <span className="text-[11px] font-semibold text-muted-foreground">{n} Seguimiento</span>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        <Input type="date" disabled={bloqueado} placeholder="Fecha" className="h-7 text-[11px]" value={s.fecha || ''} onChange={(e) => set({ fecha: e.target.value })} />
                                        <Input disabled={bloqueado} placeholder="Cumplimiento" className="h-7 text-[11px]" value={s.cumplimiento || ''} onChange={(e) => set({ cumplimiento: e.target.value })} />
                                        <Input disabled={bloqueado} placeholder="Responsable" className="h-7 text-[11px]" value={s.responsable || ''} onChange={(e) => set({ responsable: e.target.value })} />
                                    </div>
                                    <Textarea disabled={bloqueado} rows={1} placeholder="Observaciones" className="text-[11px]" value={s.observaciones || ''} onChange={(e) => set({ observaciones: e.target.value })} />
                                </div>
                            );
                        })}
                        {campo('eficacia', 'Comprobación de la eficacia (evidencia observada)')}
                        {siNo('causa_eliminada', '¿La causa fue eliminada?')}
                        {siNo('se_levanta_nc', 'Se levanta NC')}
                        {campo('observaciones_finales', 'Observaciones y comentarios')}
                    </div>
                    {!bloqueado && <Button size="sm" onClick={guardar} disabled={guardando} className="w-fit"><IconDeviceFloppy size={14} /> {guardando ? 'Guardando…' : 'Guardar'}</Button>}
                </div>
                <div className="flex min-h-[320px] flex-col gap-2">
                    <VistaPreviaPdf className="flex-1" generar={generar} clave={JSON.stringify(d)} />
                    <div className="flex justify-end"><Button size="sm" variant="outline" onClick={descargar}><IconDownload size={14} /> Descargar</Button></div>
                </div>
            </div>

            <Dialog open={anulando} onOpenChange={(v) => { if (!v) setAnulando(false); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Anular acción correctiva</DialogTitle><DialogDescription>Escriba el motivo.</DialogDescription></DialogHeader>
                    <Textarea rows={3} autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (obligatorio)" />
                    <DialogFooter><Button variant="outline" onClick={() => setAnulando(false)}>Volver</Button><Button variant="destructive" onClick={anular} disabled={motivo.trim().length < 3}>Anular</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={cerrando} onOpenChange={(v) => { if (!v) setCerrando(false); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Cerrar acción correctiva</DialogTitle><DialogDescription>Nombre y firma de quien cierra.</DialogDescription></DialogHeader>
                    <Input placeholder="Nombre" value={nombreCierre} onChange={(e) => setNombreCierre(e.target.value)} />
                    <CampoFirma titulo="Firma" nombre={nombreCierre} onChange={(img) => setFirmaCierre(img)} />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCerrando(false)}>Volver</Button>
                        <Button onClick={cerrar} disabled={!nombreCierre.trim()}><IconSignature size={14} /> Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default GcAccionesCorrectivasPage;
