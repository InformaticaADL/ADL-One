import React, { useCallback, useEffect, useState } from 'react';
import { IconCalendarCheck, IconPlus, IconTrash, IconDeviceFloppy, IconInfoCircle, IconEdit, IconFileText } from '@tabler/icons-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useNavStore } from '../../../store/navStore';
import { revisionDocumentalService as api, type RevisionDocumental, type RevisionesDocumentales, type DocumentoControlado } from '../services/revisionDocumental.service';

interface Props {
    onBack: () => void;
}

const dmy = (ymd: string | null) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : '—');
const hoyYmd = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const mensajeError = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

// Revisión documental: el encabezado de cada documento (Versión, Fecha Vigencia y Fecha Revisión) que sale en los PDF
// que genera la aplicación. La Fecha Revisión es la revisión anual que rige (cada año inicia en su fecha y dura hasta el
// día anterior a la siguiente) o, si el documento se modificó a mitad de año, su revisión propia.
export const GcRevisionDocumentalPage: React.FC<Props> = ({ onBack }) => {
    const { setActiveSubmodule } = useNavStore();
    const { hasPermission } = useAuth();
    const { showToast } = useToast();
    const [filas, setFilas] = useState<RevisionDocumental[]>([]);
    const [editable, setEditable] = useState(false);
    const [cargando, setCargando] = useState(true);
    const [anio, setAnio] = useState(String(new Date().getFullYear() + 1));
    const [fecha, setFecha] = useState('');
    const [motivo, setMotivo] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [documentos, setDocumentos] = useState<DocumentoControlado[]>([]);
    const [docsEditables, setDocsEditables] = useState(false);
    const [editando, setEditando] = useState<DocumentoControlado | null>(null);
    const [aEliminar, setAEliminar] = useState<number | null>(null);
    const [eliminando, setEliminando] = useState(false);
    const puede = hasPermission('GC_EQUIPOS') || hasPermission('MA_A_GEST_EQUIPO');

    const aplicar = (r: RevisionesDocumentales) => {
        setFilas(r.revisiones);
        setEditable(r.editable);
        setDocumentos(r.documentos || []);
        setDocsEditables(!!r.documentos_editables);
    };

    const cargar = useCallback(async () => {
        try {
            aplicar(await api.listar());
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudieron leer las fechas de revisión' });
        } finally {
            setCargando(false);
        }
         
    }, [showToast]);
    useEffect(() => { cargar(); }, [cargar]);

    const guardar = async () => {
        setGuardando(true);
        try {
            aplicar(await api.guardar(Number(anio), { fecha_inicio: fecha, motivo: motivo.trim() || undefined }));
            setFecha(''); setMotivo('');
            showToast({ type: 'success', message: `Revisión ${anio} guardada` });
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo guardar la fecha de revisión' });
        } finally {
            setGuardando(false);
        }
    };

    const eliminar = async (a: number) => {
        setEliminando(true);
        try {
            aplicar(await api.eliminar(a));
            showToast({ type: 'success', message: `Revisión ${a} eliminada` });
            setAEliminar(null);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo eliminar la revisión' });
        } finally {
            setEliminando(false);
        }
    };

    const vigente = filas.find((f) => f.vigente);

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Revisión documental"
                subtitle="Versión, fecha de vigencia y fecha de revisión del encabezado de cada documento."
                onBack={onBack}
                breadcrumbItems={[{ label: 'G.C. MAM', onClick: () => setActiveSubmodule('gc-hub-mam') }, { label: 'Revisión documental' }]}
            />

            {/* Documentos: el encabezado que sale hoy en cada PDF */}
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><IconFileText size={16} /> Documentos</h2>
            {!docsEditables && !cargando && (
                <p className="mb-3 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                    <IconInfoCircle size={16} className="shrink-0" />
                    Se muestran los encabezados actuales de los formularios. Para poder cambiarlos falta ejecutar la migración <code>add_documentos_control.sql</code>.
                </p>
            )}
            {/* Celular: una tarjeta por documento, con su encabezado como sale en el PDF */}
            <div className="mb-6 flex flex-col gap-2 md:hidden">
                {documentos.map((d) => (
                    <div key={d.codigo} className="rounded-xl border border-border bg-card p-3">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="font-semibold">{d.codigo}</p>
                                <p className="text-xs text-muted-foreground">{d.nombre}</p>
                            </div>
                            {puede && docsEditables && (
                                <Button size="sm" variant="outline" className="shrink-0" onClick={() => setEditando(d)}><IconEdit size={14} /> Editar</Button>
                            )}
                        </div>
                        <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                            <div><dt className="text-muted-foreground">Versión</dt><dd className="font-medium">{d.encabezado.version}</dd></div>
                            <div><dt className="text-muted-foreground">Vigencia</dt><dd className="font-medium">{d.encabezado.vigencia}</dd></div>
                            <div>
                                <dt className="text-muted-foreground">Revisión</dt>
                                <dd className="font-medium">
                                    {d.encabezado.revision}
                                    {d.fecha_revision && dmy(d.fecha_revision) === d.encabezado.revision && <Badge variant="outline" className="ml-1">propia</Badge>}
                                </dd>
                            </div>
                        </dl>
                    </div>
                ))}
            </div>
            <div className="mb-6 hidden overflow-hidden rounded-xl border border-border md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Documento</TableHead>
                            <TableHead>Versión</TableHead>
                            <TableHead>Fecha Vigencia</TableHead>
                            <TableHead>Fecha Revisión</TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {documentos.map((d) => (
                            <TableRow key={d.codigo}>
                                <TableCell className="whitespace-nowrap font-semibold">{d.codigo}</TableCell>
                                <TableCell>{d.nombre}</TableCell>
                                <TableCell className="whitespace-nowrap">{d.encabezado.version}</TableCell>
                                <TableCell className="whitespace-nowrap">{d.encabezado.vigencia}</TableCell>
                                <TableCell className="whitespace-nowrap">
                                    {d.encabezado.revision}
                                    {d.fecha_revision && dmy(d.fecha_revision) === d.encabezado.revision && <Badge variant="outline" className="ml-2">propia</Badge>}
                                </TableCell>
                                <TableCell>
                                    {puede && docsEditables && (
                                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar encabezado" onClick={() => setEditando(d)}><IconEdit size={15} /></Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><IconCalendarCheck size={16} /> Revisión anual</h2>

            {vigente && (
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                    <IconCalendarCheck size={22} className="shrink-0 text-primary" />
                    <p className="text-sm">
                        Hoy rige la <b>revisión {vigente.anio}</b>: inicia el <b>{dmy(vigente.fecha_inicio)}</b>
                        {vigente.fecha_fin ? <> y termina el {dmy(vigente.fecha_fin)}</> : <> y rige hasta que se registre la siguiente</>}.
                        Esa fecha sale en la ficha técnica, la ficha de entrega y la de recepción; el historial usa la del año que muestra.
                    </p>
                </div>
            )}

            {!editable && !cargando && (
                <p className="mb-4 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                    <IconInfoCircle size={16} className="shrink-0" />
                    Se muestran las fechas por defecto. Para poder cambiarlas falta ejecutar la migración <code>add_revision_documental.sql</code>.
                </p>
            )}

            {/* Celular: una tarjeta por año */}
            <div className="flex flex-col gap-2 md:hidden">
                {[...filas].reverse().map((f) => (
                    <div key={f.anio} className="flex items-start justify-between gap-2 rounded-xl border border-border bg-card p-3">
                        <div className="min-w-0 text-sm">
                            <div className="font-semibold">Revisión {f.anio} {f.vigente && <Badge variant="success" className="ml-1">Vigente</Badge>}</div>
                            <p className="text-xs text-muted-foreground">Del {dmy(f.fecha_inicio)} {f.fecha_fin ? `al ${dmy(f.fecha_fin)}` : 'en adelante'}</p>
                            {f.motivo && <p className="text-xs text-muted-foreground">{f.motivo}</p>}
                        </div>
                        {puede && editable && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => setAEliminar(f.anio)} title="Eliminar esta revisión">
                                <IconTrash size={15} />
                            </Button>
                        )}
                    </div>
                ))}
            </div>
            <div className="hidden overflow-hidden rounded-xl border border-border md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Año</TableHead>
                            <TableHead>Fecha de revisión (inicio)</TableHead>
                            <TableHead>Rige hasta</TableHead>
                            <TableHead>Motivo</TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[...filas].reverse().map((f) => (
                            <TableRow key={f.anio}>
                                <TableCell className="font-semibold">{f.anio} {f.vigente && <Badge variant="success" className="ml-2">Vigente</Badge>}</TableCell>
                                <TableCell>{dmy(f.fecha_inicio)}</TableCell>
                                <TableCell>{dmy(f.fecha_fin)}</TableCell>
                                <TableCell className="text-muted-foreground">{f.motivo || ''}</TableCell>
                                <TableCell>
                                    {puede && editable && (
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setAEliminar(f.anio)} title="Eliminar esta revisión">
                                            <IconTrash size={15} />
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {puede && editable && (
                <div className="mt-5 rounded-xl border border-border p-4">
                    <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><IconPlus size={15} /> Registrar o corregir una revisión</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[110px_180px_1fr_auto] lg:items-end">
                        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                            Año
                            <Input type="number" value={anio} onChange={(e) => setAnio(e.target.value)} />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                            Fecha en que inicia
                            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                            Motivo (opcional)
                            <Input value={motivo} maxLength={300} placeholder="Revisión anual, cambio de un documento…" onChange={(e) => setMotivo(e.target.value)} />
                        </label>
                        <Button onClick={guardar} disabled={guardando || !fecha || !anio}>
                            <IconDeviceFloppy size={15} /> Guardar
                        </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">Si el año ya existe, se cambia su fecha. La fecha debe quedar entre la de la revisión anterior y la siguiente.</p>
                </div>
            )}

            {editando && <EditarDocumentoDialog doc={editando} onClose={() => setEditando(null)} onGuardado={aplicar} />}

            <Dialog open={aEliminar !== null} onOpenChange={(o) => { if (!o && !eliminando) setAEliminar(null); }}>
                <DialogContent className="shadcn-scope sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>¿Eliminar la revisión {aEliminar}?</DialogTitle>
                        <DialogDescription>
                            Los formularios de ese año usarán la revisión anterior. Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setAEliminar(null)} disabled={eliminando}>Cancelar</Button>
                        <Button variant="destructive" onClick={() => aEliminar !== null && eliminar(aEliminar)} disabled={eliminando}>
                            <IconTrash size={15} /> Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

// Editar el encabezado de un documento: versión, vigencia y (si se modificó a mitad de año) su revisión propia.
const EditarDocumentoDialog: React.FC<{ doc: DocumentoControlado; onClose: () => void; onGuardado: (r: RevisionesDocumentales) => void }> = ({ doc, onClose, onGuardado }) => {
    const { showToast } = useToast();
    const [nombre, setNombre] = useState(doc.nombre);
    const [version, setVersion] = useState(doc.version);
    const [vigencia, setVigencia] = useState(doc.fecha_vigencia);
    const [revision, setRevision] = useState(doc.fecha_revision || '');
    const [motivo, setMotivo] = useState(doc.motivo || '');
    const [guardando, setGuardando] = useState(false);
    // Vista previa (derecha): el formulario con logo y encabezado tal como saldría, se regenera tras cada cambio.
    const conFormulario = doc.codigo !== 'OI-FoGe-23';
    const [previa, setPrevia] = useState<string | null>(null);
    const [generando, setGenerando] = useState(false);
    useEffect(() => {
        if (!conFormulario) return;
        let vigente = true;
        const t = setTimeout(async () => {
            setGenerando(true);
            try {
                const url = await api.vistaPreviaUrl(doc.codigo, { nombre: nombre.trim(), version: version.trim(), fecha_vigencia: vigencia, fecha_revision: revision || null });
                if (!vigente) { URL.revokeObjectURL(url); return; }
                setPrevia((antes) => { if (antes) URL.revokeObjectURL(antes); return url; });
            } catch { /* la vista previa queda como estaba */ }
            finally { if (vigente) setGenerando(false); }
        }, 500);
        return () => { vigente = false; clearTimeout(t); };
    }, [conFormulario, doc.codigo, nombre, version, vigencia, revision]);
    useEffect(() => () => { setPrevia((antes) => { if (antes) URL.revokeObjectURL(antes); return null; }); }, []);

    const guardar = async () => {
        setGuardando(true);
        try {
            onGuardado(await api.guardarDocumento(doc.codigo, { nombre: nombre.trim(), version: version.trim(), fecha_vigencia: vigencia, fecha_revision: revision || null, motivo: motivo.trim() || undefined }));
            showToast({ type: 'success', message: `Encabezado de ${doc.codigo} guardado` });
            onClose();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo guardar el encabezado' });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Dialog open onOpenChange={(o) => { if (!o && !guardando) onClose(); }}>
            <DialogContent className={cn('shadcn-scope flex max-h-[94vh] w-[97vw] flex-col gap-3 overflow-hidden',
                conFormulario ? 'h-[94vh] max-w-[1300px] sm:max-w-[1300px]' : 'sm:max-w-lg')}>
                <DialogHeader>
                    <DialogTitle>{doc.codigo} · {doc.nombre}</DialogTitle>
                    <DialogDescription>
                        Lo que se guarde aquí sale en el encabezado de los PDF que se generen desde ahora. Las fichas ya guardadas no cambian.
                        {conFormulario && ' A la derecha se ve cómo queda el formulario.'}
                    </DialogDescription>
                </DialogHeader>
                <div className={cn('grid min-h-0 flex-1 gap-4', conFormulario && 'lg:grid-cols-[minmax(0,420px)_1fr]')}>
                <div className="grid content-start gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
                        Nombre del documento
                        <Input value={nombre} maxLength={200} onChange={(e) => setNombre(e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        Versión
                        <Input value={version} maxLength={20} placeholder="Versión 02" onChange={(e) => {
                            const v = e.target.value;
                            setVersion(v);
                            // Nueva versión: vigencia y revisión pasan a ser la fecha del cambio (hasta la próxima revisión anual).
                            if (v.trim() !== doc.version) { setVigencia(hoyYmd()); setRevision(hoyYmd()); }
                            else { setVigencia(doc.fecha_vigencia); setRevision(doc.fecha_revision || ''); }
                        }} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        Fecha Vigencia
                        <Input type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
                        Fecha Revisión propia (opcional)
                        <Input type="date" value={revision} onChange={(e) => setRevision(e.target.value)} />
                        <span className="text-[11px]">La fecha de la modificación del documento. Rige hasta la próxima revisión anual, que la vuelve a alinear con los demás. Vacía = rige la revisión anual.</span>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
                        Motivo del cambio (opcional)
                        <Input value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
                    </label>
                </div>
                {conFormulario && (
                    <div className="relative hidden min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-muted/30 lg:flex">
                        <div className="flex items-center justify-between border-b border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                            <span>Vista previa · {doc.codigo}</span>
                            {generando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
                        </div>
                        {previa
                            ? <iframe title={`Vista previa del formulario ${doc.codigo}`} src={`${previa}#toolbar=0&navpanes=0&view=FitH`} className="min-h-0 w-full flex-1 bg-white" />
                            : <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Generando vista previa…</div>}
                    </div>
                )}
                </div>
                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
                    <Button onClick={guardar} disabled={guardando || !nombre.trim() || !version.trim() || !vigencia}><IconDeviceFloppy size={15} /> Guardar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default GcRevisionDocumentalPage;
