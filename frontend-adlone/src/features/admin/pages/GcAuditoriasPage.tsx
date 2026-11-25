import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    IconClipboardCheck, IconDownload, IconDeviceFloppy, IconPlus, IconTrash, IconBan, IconSignature,
    IconLock, IconArrowLeft,
} from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useNavStore } from '../../../store/navStore';
import { useToast } from '../../../contexts/ToastContext';
import { VistaPreviaPdf } from '../components/VistaPreviaPdf';
import { CampoFirma } from '../components/CampoFirma';
import {
    calidadService, mensajeError, type AgendaItem, type Asistente, type Auditoria, type AuditoriaRow, type Hallazgo, type Hoja,
} from '../services/calidad.service';

type AgendaFila = AgendaItem & { id?: string };
type HojaFila = Hoja & { id?: string };

// G. Calidad → Calidad → Auditorías Internas: Plan (OI-FoGe-08), Reunión Inicial y Final (OI-FoGe-10) y Hallazgos
// (OI-FoGe-09), una auditoría a la vez. Se abre desde el Programa Anual (al crear una auditoría de un mes marcado)
// o se crea suelta aquí. Cada pestaña tiene su propia vista previa en vivo del PDF.

const ESTADO_LABEL: Record<string, string> = { PLANIFICADA: 'Planificada', EN_CURSO: 'En curso', CERRADA: 'Cerrada', ANULADA: 'Anulada' };
const ESTADO_VARIANT: Record<string, 'warning' | 'secondary' | 'success' | 'destructive'> = { PLANIFICADA: 'secondary', EN_CURSO: 'warning', CERRADA: 'success', ANULADA: 'destructive' };
const ANIO_ACTUAL = new Date().getFullYear();
const vacia = () => ({ id: Math.random().toString(36).slice(2) });

export const GcAuditoriasPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { setActiveSubmodule, pendingAuditoriaId, setPendingAuditoriaId } = useNavStore();
    const { showToast } = useToast();

    const [lista, setLista] = useState<AuditoriaRow[]>([]);
    const [cargandoLista, setCargandoLista] = useState(true);
    const [elegida, setElegida] = useState<number | null>(null);
    const [creando, setCreando] = useState(false);
    const [nuevoAnio, setNuevoAnio] = useState(ANIO_ACTUAL);
    const [nuevoMes, setNuevoMes] = useState('');

    const cargarLista = useCallback(async () => {
        setCargandoLista(true);
        try { setLista(await calidadService.listarAuditorias()); } catch { /* se muestra vacío */ } finally { setCargandoLista(false); }
    }, []);
    useEffect(() => { cargarLista(); }, [cargarLista]);

    useEffect(() => {
        if (pendingAuditoriaId) { setElegida(pendingAuditoriaId); setPendingAuditoriaId(null); }
    }, [pendingAuditoriaId, setPendingAuditoriaId]);

    const crear = async () => {
        setCreando(true);
        try {
            const r = await calidadService.crearAuditoria({ anio: nuevoAnio, mes: nuevoMes ? Number(nuevoMes) : undefined });
            showToast({ type: 'success', message: `Auditoría ${r.folio} creada.` });
            await cargarLista();
            setElegida(r.id_auditoria);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo crear la auditoría.' });
        } finally {
            setCreando(false);
        }
    };

    return (
        <div className="shadcn-scope flex w-full flex-col gap-4 p-4 md:p-6 lg:h-[calc(100vh-64px)]">
            <PageHeader
                title="Auditorías Internas"
                subtitle="Plan (OI-FoGe-08), Reunión Inicial y Final (OI-FoGe-10) y Hallazgos (OI-FoGe-09)."
                onBack={onBack}
                breadcrumbItems={[{ label: 'Calidad', onClick: () => setActiveSubmodule('gc-hub-cal') }, { label: 'Auditorías Internas' }]}
            />
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_1fr]">
                <div className="flex min-h-0 flex-col gap-3">
                    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
                        <span className="text-xs font-medium text-muted-foreground">Nueva auditoría</span>
                        <div className="flex gap-1.5">
                            <Input type="number" className="h-8 text-xs" value={nuevoAnio} onChange={(e) => setNuevoAnio(Number(e.target.value))} />
                            <Input type="number" placeholder="Mes" min={1} max={12} className="h-8 w-16 text-xs" value={nuevoMes} onChange={(e) => setNuevoMes(e.target.value)} />
                        </div>
                        <Button size="sm" onClick={crear} disabled={creando}><IconPlus size={14} /> Crear</Button>
                    </section>
                    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <header className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-sm font-semibold"><IconClipboardCheck size={15} /> Auditorías</header>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {cargandoLista ? (
                                <div className="flex justify-center p-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
                            ) : lista.length === 0 ? (
                                <p className="px-3 py-6 text-center text-xs text-muted-foreground">No hay auditorías creadas.</p>
                            ) : (
                                lista.map((a) => (
                                    <button key={a.id_auditoria} type="button" onClick={() => setElegida(a.id_auditoria)}
                                        className={cn('flex w-full flex-col gap-0.5 border-b border-border px-3 py-2 text-left transition-colors hover:bg-muted', elegida === a.id_auditoria && 'bg-primary/10')}>
                                        <span className="flex items-center justify-between gap-2">
                                            <span className="font-mono text-xs font-semibold">{a.folio}</span>
                                            <Badge variant={ESTADO_VARIANT[a.estado]} className="text-[10px]">{ESTADO_LABEL[a.estado] || a.estado}</Badge>
                                        </span>
                                        <span className="text-[11px] text-muted-foreground">{a.fecha ? a.fecha.split('-').reverse().join('/') : 'Sin fecha'}{a.auditor_lider ? ` · ${a.auditor_lider}` : ''}</span>
                                        {a.no_conformidades > 0 && <Badge variant="destructive" className="mt-0.5 w-fit text-[10px]">{a.no_conformidades} NC</Badge>}
                                    </button>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    {elegida ? (
                        <DetalleAuditoria id={elegida} onCambio={cargarLista} onCerrar={() => setElegida(null)} />
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
                            <IconClipboardCheck size={40} className="opacity-40" />
                            <span>Elija una auditoría o cree una nueva.</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Detalle de una auditoría: Plan / Reunión / Hallazgos ──────────────────

const DetalleAuditoria: React.FC<{ id: number; onCambio: () => void; onCerrar: () => void }> = ({ id, onCambio, onCerrar }) => {
    const { showToast } = useToast();
    const [a, setA] = useState<Auditoria | null>(null);
    const [cargando, setCargando] = useState(true);
    const [anulando, setAnulando] = useState(false);
    const [motivo, setMotivo] = useState('');

    const cargar = useCallback(async () => {
        setCargando(true);
        try { setA(await calidadService.obtenerAuditoria(id)); } catch (e) { showToast({ type: 'error', message: mensajeError(e) || 'No se pudo cargar la auditoría.' }); } finally { setCargando(false); }
    }, [id, showToast]);
    useEffect(() => { cargar(); }, [cargar]);

    const anular = async () => {
        try {
            await calidadService.anularAuditoria(id, motivo);
            showToast({ type: 'success', message: 'Auditoría anulada.' });
            setAnulando(false); setMotivo('');
            await cargar(); onCambio();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo anular.' });
        }
    };

    if (cargando || !a) return <div className="flex h-full items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

    return (
        <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onCerrar}><IconArrowLeft size={14} /></Button>
                    <span className="font-mono text-sm font-semibold">{a.folio}</span>
                    <Badge variant={ESTADO_VARIANT[a.estado]}>{ESTADO_LABEL[a.estado] || a.estado}</Badge>
                </div>
                {a.estado !== 'ANULADA' && (
                    <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => setAnulando(true)}>
                        <IconBan size={14} /> Anular
                    </Button>
                )}
            </div>
            {a.estado === 'ANULADA' && a.motivo_anulacion && (
                <p className="border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive">Anulada: {a.motivo_anulacion}</p>
            )}
            <Tabs defaultValue="plan" className="flex min-h-0 flex-1 flex-col">
                <TabsList className="mx-4 mt-2 w-fit">
                    <TabsTrigger value="plan">Plan</TabsTrigger>
                    <TabsTrigger value="reunion">Reunión</TabsTrigger>
                    <TabsTrigger value="hallazgos">Hallazgos{a.hojas.some((h) => h.hallazgos.some((x) => x.resultado === 'NC')) && (
                        <Badge variant="destructive" className="ml-1.5 h-4 px-1 text-[10px]">NC</Badge>
                    )}</TabsTrigger>
                    <TabsTrigger value="informe">Informe</TabsTrigger>
                </TabsList>
                <TabsContent value="plan" className="min-h-0 flex-1 overflow-hidden p-4 pt-3">
                    <PlanTab auditoria={a} bloqueado={a.estado === 'ANULADA'} onGuardado={cargar} />
                </TabsContent>
                <TabsContent value="reunion" className="min-h-0 flex-1 overflow-hidden p-4 pt-3">
                    <ReunionTab auditoria={a} bloqueado={a.estado === 'ANULADA'} onGuardado={cargar} />
                </TabsContent>
                <TabsContent value="hallazgos" className="min-h-0 flex-1 overflow-hidden p-4 pt-3">
                    <HallazgosTab auditoria={a} bloqueado={a.estado === 'ANULADA'} onGuardado={cargar} />
                </TabsContent>
                <TabsContent value="informe" className="min-h-0 flex-1 overflow-hidden p-4 pt-3">
                    <InformeTab auditoria={a} bloqueado={a.estado === 'ANULADA'} onGuardado={cargar} />
                </TabsContent>
            </Tabs>

            <Dialog open={anulando} onOpenChange={(v) => { if (!v) setAnulando(false); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Anular auditoría</DialogTitle>
                        <DialogDescription>Libera el mes del programa para poder reprogramarlo. Escriba el motivo.</DialogDescription>
                    </DialogHeader>
                    <Textarea rows={3} autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (obligatorio)" />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAnulando(false)}>Volver</Button>
                        <Button variant="destructive" onClick={anular} disabled={motivo.trim().length < 3}>Anular</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

// ─── Plan (OI-FoGe-08) ───────────────────────────────────────────────────────

const PlanTab: React.FC<{ auditoria: Auditoria; bloqueado: boolean; onGuardado: () => Promise<void> }> = ({ auditoria, bloqueado, onGuardado }) => {
    const { showToast } = useToast();
    const [fecha, setFecha] = useState(auditoria.fecha || '');
    const [objetivos, setObjetivos] = useState(auditoria.objetivos || '');
    const [alcance, setAlcance] = useState(auditoria.alcance || '');
    const [lider, setLider] = useState(auditoria.auditor_lider || '');
    const [agenda, setAgenda] = useState<AgendaFila[]>(auditoria.agenda.length ? auditoria.agenda : [vacia()]);
    const [guardando, setGuardando] = useState(false);

    const datos = useMemo(() => ({ fecha, objetivos, alcance, auditor_lider: lider, agenda }), [fecha, objetivos, alcance, lider, agenda]);
    const generar = useCallback(() => calidadService.planVistaPreviaUrl(auditoria.id_auditoria, datos).then((url) => ({ url, nombre: 'OI-FoGe-08 Plan de Auditoría.pdf' })), [auditoria.id_auditoria, datos]);

    const guardar = async () => {
        setGuardando(true);
        try {
            await calidadService.guardarPlan(auditoria.id_auditoria, datos);
            showToast({ type: 'success', message: 'Plan guardado.' });
            await onGuardado();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo guardar el plan.' });
        } finally {
            setGuardando(false);
        }
    };
    const descargar = async () => {
        const pdf = await calidadService.planPdf(auditoria.id_auditoria);
        const el = document.createElement('a'); el.href = pdf.url; el.download = pdf.nombre; el.click();
        setTimeout(() => URL.revokeObjectURL(pdf.url), 4000);
    };

    return (
        <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
                <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">Fecha</span>
                        <Input type="date" disabled={bloqueado} value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
                    <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">Auditor líder</span>
                        <Input disabled={bloqueado} value={lider} onChange={(e) => setLider(e.target.value)} /></label>
                </div>
                <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">Objetivos</span>
                    <Textarea rows={2} disabled={bloqueado} value={objetivos} onChange={(e) => setObjetivos(e.target.value)} /></label>
                <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">Alcance</span>
                    <Textarea rows={2} disabled={bloqueado} value={alcance} onChange={(e) => setAlcance(e.target.value)} /></label>

                <div className="flex flex-col gap-2 rounded-lg border border-border p-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">Agenda</span>
                        {!bloqueado && <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => setAgenda((p) => [...p, vacia()])}><IconPlus size={12} /> Fila</Button>}
                    </div>
                    {agenda.map((f, i) => (
                        <div key={f.id_agenda ?? (f as { id?: string }).id ?? i} className="grid grid-cols-[70px_1fr_1fr_1fr_auto] gap-1">
                            <Input disabled={bloqueado} placeholder="Horario" className="h-7 text-[11px]" value={f.horario || ''} onChange={(e) => setAgenda((p) => p.map((x, j) => (j === i ? { ...x, horario: e.target.value } : x)))} />
                            <Input disabled={bloqueado} placeholder="Área" className="h-7 text-[11px]" value={f.area || ''} onChange={(e) => setAgenda((p) => p.map((x, j) => (j === i ? { ...x, area: e.target.value } : x)))} />
                            <Input disabled={bloqueado} placeholder="Criterio" className="h-7 text-[11px]" value={f.criterio || ''} onChange={(e) => setAgenda((p) => p.map((x, j) => (j === i ? { ...x, criterio: e.target.value } : x)))} />
                            <Input disabled={bloqueado} placeholder="Auditor" className="h-7 text-[11px]" value={f.auditor || ''} onChange={(e) => setAgenda((p) => p.map((x, j) => (j === i ? { ...x, auditor: e.target.value } : x)))} />
                            {!bloqueado && <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setAgenda((p) => p.filter((_, j) => j !== i))}><IconTrash size={12} /></Button>}
                        </div>
                    ))}
                </div>
                {!bloqueado && <Button size="sm" onClick={guardar} disabled={guardando} className="w-fit"><IconDeviceFloppy size={14} /> {guardando ? 'Guardando…' : 'Guardar plan'}</Button>}
            </div>
            <div className="flex min-h-[320px] flex-col gap-2">
                <VistaPreviaPdf className="flex-1" generar={generar} clave={JSON.stringify(datos)} />
                <div className="flex justify-end"><Button size="sm" variant="outline" onClick={descargar}><IconDownload size={14} /> Descargar</Button></div>
            </div>
        </div>
    );
};

// ─── Reunión Inicial y Final (OI-FoGe-10) ───────────────────────────────────

const ReunionTab: React.FC<{ auditoria: Auditoria; bloqueado: boolean; onGuardado: () => Promise<void> }> = ({ auditoria, bloqueado, onGuardado }) => {
    const { showToast } = useToast();
    const [fecha, setFecha] = useState(auditoria.fecha || '');
    const [inicial, setInicial] = useState<Asistente[]>(auditoria.asistentes_inicial.length ? auditoria.asistentes_inicial : []);
    const [final, setFinal] = useState<Asistente[]>(auditoria.asistentes_final.length ? auditoria.asistentes_final : []);
    const [guardandoI, setGuardandoI] = useState(false);
    const [guardandoF, setGuardandoF] = useState(false);
    const [firmando, setFirmando] = useState<{ tipo: 'INICIAL' | 'FINAL'; i: number } | null>(null);

    const datos = useMemo(() => ({ fecha, inicial, final }), [fecha, inicial, final]);
    const generar = useCallback(() => calidadService.reunionVistaPreviaUrl(auditoria.id_auditoria, 'INICIAL', { fecha, asistentes: inicial })
        .then((url) => ({ url, nombre: 'OI-FoGe-10 Reunión Inicial y Final.pdf' })), [auditoria.id_auditoria, fecha, inicial]);
    // La vista previa combina lo que haya en pantalla de ambas reuniones: se pide aparte para "final" y se muestra solo una,
    // así que se genera con la de inicial (el backend conserva lo guardado de la otra reunión).

    const guardar = async (tipo: 'INICIAL' | 'FINAL') => {
        const set = tipo === 'INICIAL' ? setGuardandoI : setGuardandoF;
        set(true);
        try {
            await calidadService.guardarReunion(auditoria.id_auditoria, tipo, { fecha, asistentes: tipo === 'INICIAL' ? inicial : final });
            showToast({ type: 'success', message: `Reunión ${tipo === 'INICIAL' ? 'inicial' : 'final'} guardada.` });
            await onGuardado();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo guardar.' });
        } finally {
            set(false);
        }
    };
    const descargar = async () => {
        const pdf = await calidadService.reunionPdf(auditoria.id_auditoria);
        const el = document.createElement('a'); el.href = pdf.url; el.download = pdf.nombre; el.click();
        setTimeout(() => URL.revokeObjectURL(pdf.url), 4000);
    };

    const Lista: React.FC<{ tipo: 'INICIAL' | 'FINAL'; valores: Asistente[]; set: (v: Asistente[]) => void; guardando: boolean }> = ({ tipo, valores, set, guardando }) => (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-2">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">Reunión {tipo === 'INICIAL' ? 'inicial' : 'final'}</span>
                {!bloqueado && <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => set([...valores, { nombre: '' }])}><IconPlus size={12} /> Persona</Button>}
            </div>
            {valores.map((p, i) => (
                <div key={p.id_asistente ?? i} className="flex items-center gap-1.5">
                    <Input disabled={bloqueado} placeholder="Nombre" className="h-7 flex-1 text-[11px]" value={p.nombre} onChange={(e) => set(valores.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} />
                    <Input disabled={bloqueado} placeholder="Cargo" className="h-7 w-28 text-[11px]" value={p.cargo || ''} onChange={(e) => set(valores.map((x, j) => (j === i ? { ...x, cargo: e.target.value } : x)))} />
                    {!bloqueado && (
                        <Button size="sm" variant={p.firma ? 'secondary' : 'outline'} className="h-7 px-2 text-[11px]" onClick={() => setFirmando({ tipo, i })}>
                            <IconSignature size={12} /> {p.firma ? 'Firmada' : 'Firmar'}
                        </Button>
                    )}
                    {!bloqueado && <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => set(valores.filter((_, j) => j !== i))}><IconTrash size={12} /></Button>}
                </div>
            ))}
            {!bloqueado && <Button size="sm" onClick={() => guardar(tipo)} disabled={guardando} className="w-fit"><IconDeviceFloppy size={14} /> {guardando ? 'Guardando…' : `Guardar reunión ${tipo === 'INICIAL' ? 'inicial' : 'final'}`}</Button>}
        </div>
    );

    const asistenteFirmando = firmando ? (firmando.tipo === 'INICIAL' ? inicial : final)[firmando.i] : null;

    return (
        <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
                <label className="flex w-40 flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">Fecha de la auditoría</span>
                    <Input type="date" disabled={bloqueado} value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
                <Lista tipo="INICIAL" valores={inicial} set={setInicial} guardando={guardandoI} />
                <Lista tipo="FINAL" valores={final} set={setFinal} guardando={guardandoF} />
            </div>
            <div className="flex min-h-[320px] flex-col gap-2">
                <VistaPreviaPdf className="flex-1" generar={generar} clave={JSON.stringify(datos)} />
                <div className="flex justify-end"><Button size="sm" variant="outline" onClick={descargar}><IconDownload size={14} /> Descargar</Button></div>
            </div>

            <Dialog open={!!firmando} onOpenChange={(v) => { if (!v) setFirmando(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Firma de {asistenteFirmando?.nombre || 'la persona'}</DialogTitle></DialogHeader>
                    {firmando && (
                        <CampoFirma
                            titulo="Firma"
                            nombre={asistenteFirmando?.nombre || ''}
                            onChange={(img: string | null) => {
                                const set = firmando.tipo === 'INICIAL' ? setInicial : setFinal;
                                const base = firmando.tipo === 'INICIAL' ? inicial : final;
                                set(base.map((x, j) => (j === firmando.i ? { ...x, firma: img } : x)));
                            }}
                        />
                    )}
                    <DialogFooter><Button onClick={() => setFirmando(null)}>Listo</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

// ─── Hallazgos (OI-FoGe-09) ──────────────────────────────────────────────────

const vaciaHoja = (): HojaFila => ({ id: Math.random().toString(36).slice(2), hallazgos: [] });

const HallazgosTab: React.FC<{ auditoria: Auditoria; bloqueado: boolean; onGuardado: () => Promise<void> }> = ({ auditoria, bloqueado, onGuardado }) => {
    const { showToast } = useToast();
    const { setActiveSubmodule, setPendingAccionId } = useNavStore();
    const [hojas, setHojas] = useState<HojaFila[]>(auditoria.hojas.length ? auditoria.hojas : [vaciaHoja()]);
    const [guardando, setGuardando] = useState(false);
    const [abriendo, setAbriendo] = useState<number | null>(null);

    const abrirAccion = async (idHallazgo: number) => {
        setAbriendo(idHallazgo);
        try {
            const r = await calidadService.abrirAccionDesdeHallazgo(auditoria.id_auditoria, idHallazgo);
            showToast({ type: 'success', message: `Acción correctiva ${r.folio} abierta.` });
            await onGuardado();
            setPendingAccionId(r.id_accion);
            setActiveSubmodule('gc-acciones');
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo abrir la acción correctiva.' });
        } finally {
            setAbriendo(null);
        }
    };

    const generar = useCallback(() => calidadService.hallazgosVistaPreviaUrl(auditoria.id_auditoria, { hojas })
        .then((url) => ({ url, nombre: 'OI-FoGe-09 Hallazgos de Auditoría.pdf' })), [auditoria.id_auditoria, hojas]);

    const guardar = async () => {
        setGuardando(true);
        try {
            const r = await calidadService.guardarHallazgos(auditoria.id_auditoria, { hojas });
            if (r.bloqueados.length) showToast({ type: 'warning', message: `${r.bloqueados.length} hallazgo(s) con acción correctiva no se pudieron cambiar.` });
            else showToast({ type: 'success', message: 'Hallazgos guardados.' });
            await onGuardado();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudieron guardar.' });
        } finally {
            setGuardando(false);
        }
    };
    const descargar = async () => {
        const pdf = await calidadService.hallazgosPdf(auditoria.id_auditoria);
        const el = document.createElement('a'); el.href = pdf.url; el.download = pdf.nombre; el.click();
        setTimeout(() => URL.revokeObjectURL(pdf.url), 4000);
    };

    const cambiarHoja = (i: number, patch: Partial<Hoja>) => setHojas((p) => p.map((h, j) => (j === i ? { ...h, ...patch } : h)));
    const cambiarHallazgo = (i: number, k: number, patch: Partial<Hallazgo>) =>
        setHojas((p) => p.map((h, j) => (j === i ? { ...h, hallazgos: h.hallazgos.map((x, l) => (l === k ? { ...x, ...patch } : x)) } : h)));

    return (
        <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
            <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
                {hojas.map((h, i) => (
                    <div key={h.id_hoja ?? h.id ?? i} className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
                        <div className="grid grid-cols-[1fr_1fr_120px_auto] gap-1.5">
                            <Input disabled={bloqueado} placeholder="Área / Proceso" className="h-7 text-[11px]" value={h.area || ''} onChange={(e) => cambiarHoja(i, { area: e.target.value })} />
                            <Input disabled={bloqueado} placeholder="Auditor" className="h-7 text-[11px]" value={h.auditor || ''} onChange={(e) => cambiarHoja(i, { auditor: e.target.value })} />
                            <Input disabled={bloqueado} type="date" className="h-7 text-[11px]" value={h.fecha || ''} onChange={(e) => cambiarHoja(i, { fecha: e.target.value })} />
                            {!bloqueado && <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setHojas((p) => p.filter((_, j) => j !== i))}><IconTrash size={12} /></Button>}
                        </div>
                        <div className="flex flex-col gap-1.5">
                            {h.hallazgos.map((hz, k) => {
                                const lock = !!hz.id_accion;
                                return (
                                    <div key={hz.id_hallazgo ?? k} className={cn('flex flex-col gap-1 rounded-md border p-1.5', lock ? 'border-destructive/40 bg-destructive/5' : 'border-border/70')}>
                                        <div className="flex gap-1.5">
                                            <Input disabled={bloqueado} placeholder="Requisito" className="h-6 flex-1 text-[10px]" value={hz.requisito || ''} onChange={(e) => cambiarHallazgo(i, k, { requisito: e.target.value })} />
                                            <Input disabled={bloqueado} placeholder="Qué verificar" className="h-6 flex-1 text-[10px]" value={hz.que_verificar || ''} onChange={(e) => cambiarHallazgo(i, k, { que_verificar: e.target.value })} />
                                        </div>
                                        <Input disabled={bloqueado} placeholder="Evidencia objetiva" className="h-6 text-[10px]" value={hz.evidencia || ''} onChange={(e) => cambiarHallazgo(i, k, { evidencia: e.target.value })} />
                                        <div className="flex items-center gap-1.5">
                                            {(['C', 'NC', 'OBS'] as const).map((r) => (
                                                <button key={r} type="button" disabled={bloqueado || lock} onClick={() => cambiarHallazgo(i, k, { resultado: r })}
                                                    className={cn('rounded px-2 py-0.5 text-[10px] font-semibold', hz.resultado === r ? (r === 'NC' ? 'bg-destructive text-white' : r === 'OBS' ? 'bg-warning text-white' : 'bg-success text-white') : 'bg-muted text-muted-foreground')}>
                                                    {r}
                                                </button>
                                            ))}
                                            {lock && (
                                                <Button size="sm" variant="outline" className="h-5 px-1.5 text-[10px] text-destructive" onClick={() => { setPendingAccionId(hz.id_accion!); setActiveSubmodule('gc-acciones'); }}>
                                                    <IconLock size={10} /> Ver acción correctiva
                                                </Button>
                                            )}
                                            {!bloqueado && !lock && hz.resultado === 'NC' && hz.id_hallazgo && (
                                                <Button size="sm" variant="destructive" className="h-5 px-1.5 text-[10px]" disabled={abriendo === hz.id_hallazgo} onClick={() => abrirAccion(hz.id_hallazgo!)}>
                                                    {abriendo === hz.id_hallazgo ? 'Abriendo…' : 'Abrir acción correctiva'}
                                                </Button>
                                            )}
                                            {!bloqueado && !lock && <Button size="sm" variant="ghost" className="ml-auto h-5 w-5 p-0 text-muted-foreground" onClick={() => cambiarHoja(i, { hallazgos: h.hallazgos.filter((_, l) => l !== k) })}><IconTrash size={10} /></Button>}
                                        </div>
                                    </div>
                                );
                            })}
                            {!bloqueado && <Button size="sm" variant="outline" className="h-6 w-fit px-2 text-[10px]" onClick={() => cambiarHoja(i, { hallazgos: [...h.hallazgos, {}] })}><IconPlus size={11} /> Hallazgo</Button>}
                        </div>
                        <Textarea disabled={bloqueado} rows={2} placeholder="Observaciones y Oportunidades" className="text-[11px]" value={h.observaciones_oportunidades || ''}
                            onChange={(e) => cambiarHoja(i, { observaciones_oportunidades: e.target.value })} />
                    </div>
                ))}
                {!bloqueado && (
                    <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setHojas((p) => [...p, vaciaHoja()])}><IconPlus size={14} /> Área auditada</Button>
                        <Button size="sm" onClick={guardar} disabled={guardando}><IconDeviceFloppy size={14} /> {guardando ? 'Guardando…' : 'Guardar hallazgos'}</Button>
                    </div>
                )}
            </div>
            <div className="flex min-h-[320px] flex-col gap-2">
                <VistaPreviaPdf className="flex-1" generar={generar} clave={JSON.stringify(hojas)} />
                <div className="flex justify-end"><Button size="sm" variant="outline" onClick={descargar}><IconDownload size={14} /> Descargar</Button></div>
            </div>
        </div>
    );
};

// ─── Informe (OI-FoGe-11) ────────────────────────────────────────────────────

const InformeTab: React.FC<{ auditoria: Auditoria; bloqueado: boolean; onGuardado: () => Promise<void> }> = ({ auditoria, bloqueado, onGuardado }) => {
    const { showToast } = useToast();
    const [d, setD] = useState({
        representante_auditado: auditoria.representante_auditado || '', documentos_referencia: auditoria.documentos_referencia || '',
        entrevistados: auditoria.entrevistados || '', descripcion_hallazgos: auditoria.descripcion_hallazgos || '',
        juicio_auditor: auditoria.juicio_auditor || '', capacidad_sistema: auditoria.capacidad_sistema || '',
        oportunidades: auditoria.oportunidades || '', distribucion: auditoria.distribucion || '', fecha_informe: auditoria.fecha_informe || '',
    });
    const [guardando, setGuardando] = useState(false);
    const nc = auditoria.hojas.flatMap((h) => h.hallazgos).filter((h) => h.resultado === 'NC').length;
    const obs = auditoria.hojas.flatMap((h) => h.hallazgos).filter((h) => h.resultado === 'OBS').length;

    const generar = useCallback(() => calidadService.informeVistaPreviaUrl(auditoria.id_auditoria, d).then((url) => ({ url, nombre: 'OI-FoGe-11 Informe de Auditoría.pdf' })), [auditoria.id_auditoria, d]);
    const guardar = async () => {
        setGuardando(true);
        try {
            await calidadService.guardarInforme(auditoria.id_auditoria, d);
            showToast({ type: 'success', message: d.fecha_informe ? 'Informe guardado. La auditoría quedó cerrada.' : 'Informe guardado.' });
            await onGuardado();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo guardar el informe.' });
        } finally {
            setGuardando(false);
        }
    };
    const descargar = async () => {
        const pdf = await calidadService.informePdf(auditoria.id_auditoria);
        const el = document.createElement('a'); el.href = pdf.url; el.download = pdf.nombre; el.click();
        setTimeout(() => URL.revokeObjectURL(pdf.url), 4000);
    };
    const campo = (k: keyof typeof d, label: string, rows = 2) => (
        <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">{label}</span>
            <Textarea disabled={bloqueado} rows={rows} value={d[k]} onChange={(e) => setD((p) => ({ ...p, [k]: e.target.value }))} /></label>
    );

    return (
        <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
                <div className="flex gap-2 text-xs">
                    <Badge variant={nc ? 'destructive' : 'success'}>{nc} no conformidad(es)</Badge>
                    <Badge variant="outline">{obs} observación(es)</Badge>
                </div>
                <label className="flex flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">Representante del auditado</span>
                    <Input disabled={bloqueado} value={d.representante_auditado} onChange={(e) => setD((p) => ({ ...p, representante_auditado: e.target.value }))} /></label>
                {campo('documentos_referencia', 'Documentos de referencia', 1)}
                {campo('entrevistados', 'Listado de personas entrevistadas', 1)}
                {campo('descripcion_hallazgos', 'Descripción de los hallazgos')}
                {campo('juicio_auditor', 'Juicio del auditor sobre el cumplimiento con la norma')}
                {campo('capacidad_sistema', 'Capacidad del sistema para lograr los objetivos de calidad')}
                {campo('oportunidades', 'Oportunidades / Fortalezas del Sistema de Gestión')}
                {campo('distribucion', 'Distribución del informe', 1)}
                <label className="flex w-40 flex-col gap-1 text-xs"><span className="font-medium text-muted-foreground">Fecha del informe</span>
                    <Input type="date" disabled={bloqueado} value={d.fecha_informe} onChange={(e) => setD((p) => ({ ...p, fecha_informe: e.target.value }))} /></label>
                <p className="text-[11px] text-muted-foreground">Al poner la fecha del informe, la auditoría queda cerrada.</p>
                {!bloqueado && <Button size="sm" onClick={guardar} disabled={guardando} className="w-fit"><IconDeviceFloppy size={14} /> {guardando ? 'Guardando…' : 'Guardar informe'}</Button>}
            </div>
            <div className="flex min-h-[320px] flex-col gap-2">
                <VistaPreviaPdf className="flex-1" generar={generar} clave={JSON.stringify(d)} />
                <div className="flex justify-end"><Button size="sm" variant="outline" onClick={descargar}><IconDownload size={14} /> Descargar</Button></div>
            </div>
        </div>
    );
};

export default GcAuditoriasPage;
