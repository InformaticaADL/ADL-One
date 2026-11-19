import React, { useCallback, useEffect, useState } from 'react';
import { IconPlus, IconSearch, IconFileTypePdf, IconBan, IconCircleCheck, IconClock, IconEdit, IconDroplet } from '@tabler/icons-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { firmaUsuarioService } from '../../../services/firmaUsuario.service';
import PdfViewerModal from '../../facturacion/components/PdfViewerModal';
import { CampoFirma } from '../components/CampoFirma';
import { sumarMeses } from '../utils/reglasControlEquipo';
import {
    verificacionCaudalService as api,
    calcularCaudal,
    UNIDADES_CAUDAL,
    MAX_LECTURAS,
    MIN_LECTURAS,
    type VerificacionCaudal,
    type SondaCaudal,
    type ReferenciaCaudal,
    type CuerpoVerifCaudal,
} from '../services/verificacionCaudal.service';

interface Props { onBack: () => void }

const mensajeError = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
const hoyYmd = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dmy = (ymd: string | null | undefined) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : '—');
const num = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? '—' : v.toLocaleString('es-CL', { maximumFractionDigits: d }));

const EstadoBadge: React.FC<{ v: VerificacionCaudal }> = ({ v }) => (
    v.estado === 'FIRMADA' ? <Badge variant="success" className="gap-1"><IconCircleCheck size={12} /> Con V°B°</Badge>
        : v.estado === 'ANULADA' ? <Badge variant="destructive" className="gap-1"><IconBan size={12} /> Anulada</Badge>
            : <Badge variant="warning" className="gap-1"><IconClock size={12} /> Borrador</Badge>
);
const ResultadoBadge: React.FC<{ cumple: boolean | null; grado: string | null }> = ({ cumple, grado }) => (
    cumple === null ? <span className="text-xs text-muted-foreground">—</span>
        : <Badge variant={cumple ? 'success' : 'destructive'}>{cumple ? 'Cumple' : 'No cumple'}{grado ? ` · ${grado}` : ''}</Badge>
);

const TABLA_GRADOS: [string, string][] = [['1', 'Perfecto'], ['0.90 a 0.99', 'Excelente'], ['0.80 a 0.89', 'Buena'], ['0.50 a 0.79', 'Regular'], ['< a 0.50', 'Mala']];

/** Celda «Etiqueta : valor» como las filas de la ficha OI-FoGe-30. */
const CeldaFicha: React.FC<{ etiqueta: string; children: React.ReactNode; className?: string }> = ({ etiqueta, children, className }) => (
    <div className={cn('flex min-h-9 flex-wrap items-center gap-x-2 border-border px-2.5 py-1.5 text-sm', className)}>
        <span className="text-xs text-muted-foreground">{etiqueta}</span>
        <span className="font-semibold tabular-nums">{children}</span>
    </div>
);

// Verificación Intermedia Sonda Caudal (OI-FoGe-30): verificación semestral (±10 %) de las sondas de caudal contra un
// molinete. Se llena en borrador; con el V°B° se aplica al equipo (próxima verificación o Fuera de Servicio), queda en su
// historial y el PDF firmado va al Archivo de Fichas.
export const GcVerificacionCaudalPage: React.FC<Props> = ({ onBack }) => {
    const { showToast } = useToast();
    const [filas, setFilas] = useState<VerificacionCaudal[]>([]);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [estado, setEstado] = useState('');
    const [formulario, setFormulario] = useState<{ inicial?: VerificacionCaudal } | null>(null);
    const [abierta, setAbierta] = useState<number | null>(null);
    const [pdf, setPdf] = useState<{ url: string; titulo: string } | null>(null);

    const cargar = useCallback(async () => {
        try {
            setFilas(await api.listar({ q: busqueda.trim() || undefined, estado: estado || undefined }));
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudieron leer las verificaciones' });
        } finally {
            setCargando(false);
        }
    }, [busqueda, estado, showToast]);
    useEffect(() => { const t = setTimeout(cargar, 250); return () => clearTimeout(t); }, [cargar]);

    const verPdf = async (v: VerificacionCaudal) => {
        try {
            setPdf({ url: await api.pdfUrl(v.id_verificacion), titulo: `OI-FoGe-30 ${v.codigo_equipo ?? ''}` });
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo generar el PDF' });
        }
    };

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Verificación Sonda Caudal"
                subtitle="Formulario OI-FoGe-30 · Verificación intermedia semestral (±10 %) contra el equipo de referencia."
                onBack={onBack}
                breadcrumbItems={[{ label: 'Gestión de Calidad', onClick: onBack }, { label: 'Verificación Sonda Caudal' }]}
                rightSection={<Button onClick={() => setFormulario({})}><IconPlus size={16} /> Nueva verificación</Button>}
            />

            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
                <div className="relative min-w-0 flex-1">
                    <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-8" placeholder="Buscar por sonda o equipo de referencia…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                </div>
                <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 md:pb-0">
                    {[['', 'Todas'], ['BORRADOR', 'Borradores'], ['FIRMADA', 'Con V°B°'], ['ANULADA', 'Anuladas']].map(([v, l]) => (
                        <button key={v || 'todas'} type="button" onClick={() => setEstado(v)}
                            className={cn('h-9 shrink-0 whitespace-nowrap rounded-md border px-3 text-sm transition-colors', estado === v ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted')}>
                            {l}
                        </button>
                    ))}
                </div>
            </div>

            {/* Celular: tarjetas */}
            <div className="flex flex-col gap-2 md:hidden">
                {cargando ? <p className="rounded-xl border border-border py-10 text-center text-sm text-muted-foreground">Cargando…</p>
                    : filas.length === 0 ? <p className="rounded-xl border border-border py-10 text-center text-sm text-muted-foreground">No hay verificaciones con estos filtros.</p>
                        : filas.map((v) => (
                            <div key={v.id_verificacion} role="button" tabIndex={0} onClick={() => setAbierta(v.id_verificacion)} onKeyDown={(e) => { if (e.key === 'Enter') setAbierta(v.id_verificacion); }}
                                className="rounded-xl border border-border bg-card p-3 active:bg-muted/50">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-semibold">{v.codigo_equipo}</p>
                                        <p className="text-xs text-muted-foreground">{dmy(v.fecha_verificacion)} · Próxima {dmy(v.fecha_proxima)}</p>
                                    </div>
                                    <EstadoBadge v={v} />
                                </div>
                                <div className="mt-2 flex items-center justify-between gap-2">
                                    <ResultadoBadge cumple={v.cumple} grado={v.grado} />
                                    <span className="text-xs text-muted-foreground">Desv. {num(v.desviacion_pct)} %</span>
                                </div>
                            </div>
                        ))}
            </div>

            {/* Tablet y escritorio: tabla */}
            <div className="hidden overflow-hidden rounded-xl border border-border md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Sonda</TableHead>
                            <TableHead>Referencia</TableHead>
                            <TableHead className="text-right">Desviación</TableHead>
                            <TableHead>Resultado</TableHead>
                            <TableHead>Próxima</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {cargando ? <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">Cargando…</TableCell></TableRow>
                            : filas.length === 0 ? <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No hay verificaciones con estos filtros.</TableCell></TableRow>
                                : filas.map((v) => (
                                    <TableRow key={v.id_verificacion} className="cursor-pointer" onClick={() => setAbierta(v.id_verificacion)}>
                                        <TableCell className="whitespace-nowrap">{dmy(v.fecha_verificacion)}</TableCell>
                                        <TableCell><span className="font-semibold">{v.codigo_equipo}</span> <span className="text-xs text-muted-foreground">{v.sede}</span></TableCell>
                                        <TableCell className="text-muted-foreground">{v.equipo_referencia || '—'}</TableCell>
                                        <TableCell className="text-right tabular-nums">{num(v.desviacion_pct)} %</TableCell>
                                        <TableCell><ResultadoBadge cumple={v.cumple} grado={v.grado} /></TableCell>
                                        <TableCell className="whitespace-nowrap">{dmy(v.fecha_proxima)}</TableCell>
                                        <TableCell><EstadoBadge v={v} /></TableCell>
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Ver PDF" onClick={() => verPdf(v)}><IconFileTypePdf size={16} /></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                    </TableBody>
                </Table>
            </div>

            {formulario && (
                <FormularioCaudalDialog
                    inicial={formulario.inicial}
                    onClose={() => setFormulario(null)}
                    onGuardada={(v) => { setFormulario(null); cargar(); setAbierta(v.id_verificacion); }}
                />
            )}
            {abierta !== null && (
                <DetalleCaudalDialog key={abierta} id={abierta} onClose={() => { setAbierta(null); cargar(); }} onCambio={cargar} verPdf={verPdf}
                    onEditar={(v) => { setAbierta(null); setFormulario({ inicial: v }); }} />
            )}
            <PdfViewerModal open={!!pdf} onClose={() => setPdf(null)} url={pdf?.url ?? null} title={pdf?.titulo} />
        </div>
    );
};

// ─── Formulario (nuevo o borrador) con vista previa ─────────────────────────

const FormularioCaudalDialog: React.FC<{ inicial?: VerificacionCaudal; onClose: () => void; onGuardada: (v: VerificacionCaudal) => void }> = ({ inicial, onClose, onGuardada }) => {
    const { showToast } = useToast();
    const [sondas, setSondas] = useState<SondaCaudal[]>([]);
    const [referencias, setReferencias] = useState<ReferenciaCaudal[]>([]);
    const [idEquipo, setIdEquipo] = useState(inicial ? String(inicial.id_equipo) : '');
    const [fecha, setFecha] = useState(inicial?.fecha_verificacion || hoyYmd());
    const [idRef, setIdRef] = useState(inicial?.id_equipo_referencia ? String(inicial.id_equipo_referencia) : '');
    const [caudalRef, setCaudalRef] = useState(inicial?.caudal_referencia !== null && inicial?.caudal_referencia !== undefined ? String(inicial.caudal_referencia).replace('.', ',') : '');
    const [unidad, setUnidad] = useState(inicial?.unidad || 'L/s');
    const [lecturas, setLecturas] = useState<string[]>(() => {
        const l = (inicial?.lecturas || []).map((x) => String(x).replace('.', ','));
        return [...l, ...Array(Math.max(0, MAX_LECTURAS - l.length)).fill('')].slice(0, MAX_LECTURAS);
    });
    const [observacion, setObservacion] = useState(inicial?.observacion || '');
    const [guardando, setGuardando] = useState(false);
    const [previa, setPrevia] = useState<string | null>(null);
    const [generando, setGenerando] = useState(false);

    useEffect(() => {
        let vigente = true;
        api.elegibles().then((l) => { if (vigente) setSondas(l); }).catch(() => { if (vigente) setSondas([]); });
        api.referencias().then((l) => {
            if (!vigente) return;
            setReferencias(l);
            // Con un solo molinete, se propone solo.
            if (!inicial && l.length === 1) setIdRef(String(l[0].id_equipo));
        }).catch(() => { if (vigente) setReferencias([]); });
        return () => { vigente = false; };
    }, [inicial]);

    const calc = calcularCaudal(caudalRef, lecturas);
    const sonda = sondas.find((s) => String(s.id_equipo) === idEquipo);
    // Fecha próxima como la calcula el servidor: según el control de fechas de la sonda (semestral por defecto).
    const fechaProxima = /^\d{4}-\d{2}-\d{2}$/.test(fecha)
        ? sumarMeses(fecha, sonda?.modalidad_control === 'VERIFICACION_TRIMESTRAL' ? 3 : 6) : '';
    const cuerpo = (): CuerpoVerifCaudal => ({
        id_equipo: Number(idEquipo) || undefined, fecha_verificacion: fecha, id_equipo_referencia: idRef ? Number(idRef) : null,
        caudal_referencia: caudalRef, unidad, lecturas: lecturas.filter((x) => x.trim()), observacion: observacion.trim() || undefined,
    });

    useEffect(() => {
        let vigente = true;
        const t = setTimeout(async () => {
            setGenerando(true);
            try {
                const url = await api.vistaPreviaUrl(cuerpo());
                if (!vigente) { URL.revokeObjectURL(url); return; }
                setPrevia((antes) => { if (antes) URL.revokeObjectURL(antes); return url; });
            } catch { /* la vista previa queda como estaba */ }
            finally { if (vigente) setGenerando(false); }
        }, 500);
        return () => { vigente = false; clearTimeout(t); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idEquipo, fecha, idRef, caudalRef, unidad, lecturas, observacion]);
    useEffect(() => () => { setPrevia((antes) => { if (antes) URL.revokeObjectURL(antes); return null; }); }, []);

    const guardar = async () => {
        setGuardando(true);
        try {
            const v = inicial ? await api.actualizar(inicial.id_verificacion, cuerpo()) : await api.crear(cuerpo());
            showToast({ type: 'success', message: calc.completa ? 'Verificación guardada: falta el V°B°' : 'Borrador guardado' });
            onGuardada(v);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo guardar la verificación' });
        } finally {
            setGuardando(false);
        }
    };

    const faltan = [!idEquipo && 'la sonda', !fecha && 'la fecha'].filter(Boolean) as string[];
    const pendientesVoBo = [!idRef && 'el equipo de referencia', !caudalRef.trim() && 'el caudal de referencia', calc.n < MIN_LECTURAS && `al menos ${MIN_LECTURAS} lecturas`].filter(Boolean) as string[];

    return (
        <Dialog open onOpenChange={(o) => { if (!o && !guardando) onClose(); }}>
            <DialogContent className="shadcn-scope flex h-[94vh] w-[97vw] max-w-[1400px] flex-col gap-3 overflow-hidden sm:max-w-[1400px]">
                <DialogHeader>
                    <DialogTitle>{inicial ? `Verificación de caudal · ${inicial.codigo_equipo}` : 'Nueva verificación de caudal'}</DialogTitle>
                    <DialogDescription>Formulario OI-FoGe-30: a la derecha se ve cómo va quedando.</DialogDescription>
                </DialogHeader>

                <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
                    <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
                        {/* Mismo orden que la ficha OI-FoGe-30: sonda, tabla del índice, verificación semestral, observación y V°B°. */}
                        <section className="space-y-2 rounded-lg border border-border p-3">
                            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                                Sonda verificada
                                <Combobox options={sondas.map((s) => ({ value: String(s.id_equipo), label: `${s.codigo} · ${s.nombre}${s.sede ? ` · Sede ${s.sede}` : ''}` }))} value={idEquipo} onValueChange={setIdEquipo} placeholder="Seleccione la sonda…" disabled={!!inicial} />
                            </label>
                            {sonda && (
                                <p className="text-xs text-muted-foreground">
                                    Última verificación {dmy(sonda.ultima_verificacion)} · Control {sonda.modalidad_control === 'VERIFICACION_TRIMESTRAL' ? 'trimestral' : 'semestral'}.
                                </p>
                            )}
                        </section>

                        <section className="overflow-hidden rounded-lg border border-border text-sm">
                            <div className="grid grid-cols-[1.6fr_1fr] border-b border-border bg-muted/40 text-center text-xs font-semibold">
                                <span className="border-r border-border px-2 py-1.5">Índice = Caudal menor obtenido / Caudal mayor obtenido</span>
                                <span className="px-2 py-1.5">Grado Correlación</span>
                            </div>
                            {TABLA_GRADOS.map(([rango, grado]) => {
                                const marcado = calc.grado === grado;
                                return (
                                    <div key={grado} className={cn('grid grid-cols-[1.6fr_1fr] border-b border-border text-center text-xs',
                                        marcado && (calc.cumple ? 'bg-success/15 font-semibold' : 'bg-destructive/10 font-semibold'))}>
                                        <span className="border-r border-border px-2 py-1">{rango}</span>
                                        <span className="px-2 py-1">{grado}{marcado ? ' (obtenido)' : ''}</span>
                                    </div>
                                );
                            })}
                            <p className="px-2 py-1.5 text-center text-xs italic text-muted-foreground">Se acepta un índice &gt; a 0.90 (10% de desviación)</p>
                        </section>

                        <section className="overflow-hidden rounded-lg border border-border">
                            <p className="border-b border-border bg-muted/40 px-3 py-2 text-center text-xs font-semibold">Verificación Caudal Semestral (+/- 10%)</p>
                            <div className="grid border-b border-border sm:grid-cols-2">
                                <label className="flex flex-col gap-1 border-border p-2.5 text-xs text-muted-foreground sm:border-r">
                                    Fecha Verificación
                                    <Input type="date" value={fecha} max={hoyYmd()} onChange={(e) => setFecha(e.target.value)} />
                                </label>
                                <div className="flex flex-col gap-1 p-2.5 text-xs text-muted-foreground">
                                    Fecha Próxima Verificación
                                    <span className="flex h-9 items-center rounded-md border border-dashed border-border bg-muted/30 px-3 text-sm text-foreground tabular-nums">{fechaProxima ? dmy(fechaProxima) : '—'}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-border p-2.5">
                                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                                    Caudal referencia
                                    <Input inputMode="decimal" value={caudalRef} placeholder="Ej. 12,5" onChange={(e) => setCaudalRef(e.target.value)} />
                                </label>
                                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                                    Unidad
                                    <div className="flex gap-1">
                                        {UNIDADES_CAUDAL.map((u) => (
                                            <button key={u} type="button" onClick={() => setUnidad(u)} className={cn('h-9 rounded-md border px-3 text-sm', unidad === u ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted')}>{u}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <label className="flex flex-col gap-1 border-b border-border p-2.5 text-xs text-muted-foreground">
                                Equipo referencia
                                <Combobox options={referencias.map((r) => ({ value: String(r.id_equipo), label: `${r.tipoequipo} ${r.codigo}` }))} value={idRef} onValueChange={setIdRef} placeholder="Seleccione el molinete…" />
                            </label>
                            <div className="flex flex-col gap-1 border-b border-border p-2.5 text-xs text-muted-foreground">
                                <span>Caudal equipo ({unidad}) <span className="text-[11px]">· lecturas de la sonda, hasta {MAX_LECTURAS}; mínimo {MIN_LECTURAS} para el V°B°</span></span>
                                <div className="grid grid-cols-5 gap-1.5 xl:grid-cols-10">
                                    {lecturas.map((l, i) => (
                                        <Input key={i} inputMode="decimal" aria-label={`Lectura ${i + 1}`} title={`Lectura ${i + 1}`} className="h-9 px-1 text-center tabular-nums" value={l}
                                            onChange={(e) => setLecturas((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))} />
                                    ))}
                                </div>
                            </div>
                            <div className="grid sm:grid-cols-2">
                                <CeldaFicha etiqueta="Caudal promedio :" className="border-b sm:border-r">{calc.promedio !== null ? `${num(calc.promedio, 3)} ${unidad}` : '—'}</CeldaFicha>
                                <CeldaFicha etiqueta="% Desviación:" className="border-b">{calc.desviacion === null ? '—' : `${num(calc.desviacion)} %`}</CeldaFicha>
                                <CeldaFicha etiqueta="Índice :" className="border-b sm:border-b-0 sm:border-r">{num(calc.indice, 3)}</CeldaFicha>
                                <CeldaFicha etiqueta="Resultado:"><ResultadoBadge cumple={calc.cumple} grado={calc.grado} /></CeldaFicha>
                            </div>
                        </section>

                        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                            Observación (opcional)
                            <Textarea rows={2} maxLength={1000} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
                        </label>
                        <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">El V°B° se da después de guardar.</p>
                    </div>

                    <div className="relative hidden min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-muted/30 lg:flex">
                        <div className="flex items-center justify-between border-b border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                            <span>Vista previa · OI-FoGe-30</span>
                            {generando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
                        </div>
                        {previa
                            ? <iframe title="Vista previa del formulario OI-FoGe-30" src={`${previa}#toolbar=0&navpanes=0&view=FitH`} className="min-h-0 w-full flex-1 bg-white" />
                            : <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Generando vista previa…</div>}
                    </div>
                </div>

                <DialogFooter className="items-center gap-2 sm:justify-between">
                    <span className="text-xs text-muted-foreground">
                        {faltan.length ? `Falta: ${faltan.join(', ')}.` : pendientesVoBo.length ? `Se guarda como borrador. Para el V°B° falta: ${pendientesVoBo.join(', ')}.` : 'Lista para el V°B°.'}
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
                        <Button onClick={guardar} disabled={faltan.length > 0 || guardando}>Guardar</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ─── Detalle: V°B°, PDF y anulación ─────────────────────────────────────────

const DetalleCaudalDialog: React.FC<{ id: number; onClose: () => void; onCambio: () => void; verPdf: (v: VerificacionCaudal) => void; onEditar: (v: VerificacionCaudal) => void }> = ({ id, onClose, onCambio, verPdf, onEditar }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [v, setV] = useState<VerificacionCaudal | null>(null);
    const [miFirma, setMiFirma] = useState<string | null>(null);
    const [firma, setFirma] = useState<{ imagen: string | null; usar: boolean }>({ imagen: null, usar: false });
    const [ocupado, setOcupado] = useState(false);
    const [anulando, setAnulando] = useState(false);
    const [motivo, setMotivo] = useState('');

    useEffect(() => {
        let vigente = true;
        api.obtener(id).then((d) => { if (vigente) setV(d); }).catch((e) => { showToast({ type: 'error', message: mensajeError(e) || 'No se pudo abrir la verificación' }); onClose(); });
        firmaUsuarioService.obtener().then((f) => { if (vigente) setMiFirma(f.firma); }).catch(() => { if (vigente) setMiFirma(null); });
        return () => { vigente = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const ejecutar = async (fn: () => Promise<VerificacionCaudal>, ok: string) => {
        setOcupado(true);
        try { setV(await fn()); onCambio(); showToast({ type: 'success', message: ok }); }
        catch (e) { showToast({ type: 'error', message: mensajeError(e) || 'No se pudo completar la acción' }); }
        finally { setOcupado(false); }
    };

    if (!v) return null;
    const borrador = v.estado === 'BORRADOR';
    const completa = !!v.equipo_referencia && v.caudal_referencia !== null && v.lecturas.length >= MIN_LECTURAS;

    return (
        <Dialog open onOpenChange={(o) => { if (!o && !ocupado) onClose(); }}>
            <DialogContent className="shadcn-scope w-[95vw] max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex flex-wrap items-center gap-2"><IconDroplet size={18} className="text-primary" /> {v.codigo_equipo} <EstadoBadge v={v} /></DialogTitle>
                    <DialogDescription>{v.nombre_equipo} · Verificación del {dmy(v.fecha_verificacion)} · Próxima {dmy(v.fecha_proxima)}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                    <p><span className="text-muted-foreground">Equipo referencia:</span> {v.equipo_referencia || '—'}</p>
                    <p><span className="text-muted-foreground">Caudal referencia:</span> {num(v.caudal_referencia, 4)} {v.unidad}</p>
                    <p className="sm:col-span-2"><span className="text-muted-foreground">Lecturas:</span> {v.lecturas.length ? v.lecturas.map((x) => num(x, 3)).join(' · ') : '—'}</p>
                    <p><span className="text-muted-foreground">Promedio:</span> {num(v.caudal_promedio, 3)} {v.unidad} · <span className="text-muted-foreground">Desviación:</span> {num(v.desviacion_pct)} %</p>
                    <p><span className="text-muted-foreground">Índice:</span> {num(v.indice, 3)} <ResultadoBadge cumple={v.cumple} grado={v.grado} /></p>
                    {v.observacion && <p className="whitespace-pre-wrap sm:col-span-2"><span className="text-muted-foreground">Observación:</span> {v.observacion}</p>}
                    {v.firmada && <p className="text-success sm:col-span-2">V°B° de {v.nombre_vobo}</p>}
                    {v.estado === 'ANULADA' && <p className="text-destructive sm:col-span-2">Anulada: {v.motivo_anulacion}</p>}
                </div>

                {borrador && v.puede_firmar && (
                    completa ? (
                        <div className="flex flex-col gap-3 rounded-lg border border-primary/40 p-3">
                            <p className="text-sm font-semibold">V°B°</p>
                            <p className="text-xs text-muted-foreground">
                                {v.cumple ? 'Al dar el V°B° se registra la verificación en el equipo y su próxima verificación queda el ' + dmy(v.fecha_proxima) + '.'
                                    : 'No cumple: al dar el V°B° el equipo pasa a Fuera de Servicio hasta corregirse y verificarse de nuevo.'}
                            </p>
                            <div className="max-w-md">
                                <CampoFirma titulo="V°B°" nombre={user?.name || ''} guardada={miFirma} usarGuardadaInicial={false} importable={false} onChange={(f, usar) => setFirma({ imagen: f, usar })} />
                            </div>
                            <Button className="self-start" disabled={(!firma.imagen && !firma.usar) || ocupado}
                                onClick={() => ejecutar(() => api.firmar(v.id_verificacion, firma.usar ? { usar_registrada: true } : { imagen: firma.imagen ?? undefined }), 'V°B° registrado: la verificación quedó en el equipo')}>
                                Dar V°B°
                            </Button>
                        </div>
                    ) : <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">Para el V°B° falta completar el equipo de referencia, el caudal de referencia y al menos {MIN_LECTURAS} lecturas.</p>
                )}
                {borrador && !v.puede_firmar && <p className="text-xs text-muted-foreground">Dar el V°B° requiere el permiso «Verificación de caudal: dar el V°B°».</p>}

                <DialogFooter className="flex-wrap items-center gap-2 sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => verPdf(v)}><IconFileTypePdf size={15} /> Ver PDF</Button>
                        {borrador && <Button variant="outline" onClick={() => onEditar(v)}><IconEdit size={15} /> Editar</Button>}
                        {borrador && !anulando && <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setAnulando(true)}><IconBan size={15} /> Anular</Button>}
                    </div>
                    {anulando && (
                        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-1">
                            <Input className="min-w-0 flex-1" placeholder="Motivo de la anulación" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
                            <Button variant="destructive" disabled={!motivo.trim() || ocupado} onClick={() => ejecutar(() => api.anular(v.id_verificacion, motivo.trim()), 'Verificación anulada')}>Confirmar</Button>
                            <Button variant="ghost" onClick={() => setAnulando(false)}>Cancelar</Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default GcVerificacionCaudalPage;
