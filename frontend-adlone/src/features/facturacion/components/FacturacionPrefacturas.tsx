import { useEffect, useState, useCallback } from 'react';
import {
    IconRefresh, IconFileText, IconMail, IconExternalLink,
    IconTruck, IconHistory, IconSend2, IconFileExport, IconDownload, IconFolders,
    IconPencil, IconBan, IconTrash, IconChevronDown,
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { DataPagination } from '@/components/ui/pagination';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '../../../contexts/ToastContext';
import { facturacionService } from '../services/facturacion.service';
import API_CONFIG from '../../../config/api.config';
import PdfViewerModal from './PdfViewerModal';
import { descargarArchivo } from '../utils/download';

const ESTADO_BADGE: Record<string, 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive'> = {
    BORRADOR: 'secondary', PDF_GENERADO: 'outline', ENVIADA: 'outline', PENDIENTE_OC: 'warning',
    OC_RECIBIDA: 'outline', EN_EMISION: 'outline', EMITIDA: 'success', ANULADA: 'destructive',
};
const ESTADO_LABEL: Record<string, string> = {
    BORRADOR: 'Borrador', PDF_GENERADO: 'PDF Generado', ENVIADA: 'Enviada', PENDIENTE_OC: 'Pendiente OC',
    OC_RECIBIDA: 'OC Recibida', EN_EMISION: 'En Emisión', EMITIDA: 'Emitida', ANULADA: 'Anulada',
};

interface Prefactura {
    id_prefactura: number;
    numero_id: number;
    id_empresaservicio: number;
    nombre_empresaservicios: string;
    agrupacion_tipo: string;
    agrupacion_valor: string;
    estado: string;
    valor_uf: number;
    total_uf: number;
    total_clp: number;
    email_enviado: boolean;
    fecha_email: string | null;
    fecha_creacion: string;
    cantidad_casos: number;
    cantidad_oc: number;
}

const fmtClp = (n: number) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
const fmtUf = (n: number) => Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFecha = (v: string | null) => v ? new Date(v).toLocaleDateString('es-CL') : '—';
const fmtFechaHora = (v: string | null) => v ? new Date(v).toLocaleString('es-CL') : '—';
const PAGE_SIZE = 15;

// Estados en los que todavía se puede corregir (mismo criterio que el
// backend: después de emitir, ADL ONE y el Sistema de Ventas quedarían
// diciendo cosas distintas).
const EDITABLES = ['BORRADOR', 'PDF_GENERADO', 'ENVIADA', 'PENDIENTE_OC', 'OC_RECIBIDA'];
const EMITIBLES = ['OC_RECIBIDA', 'ENVIADA'];

interface EditarForm {
    glosa?: string;
    glosa_fe?: string;
    observaciones?: string;
    forma_pago?: string;
    facturado_por?: string;
    descuento_uf?: number;
    ingreso_uf?: number;
}

interface CasoPrefactura {
    id_pf_caso: number;
    id_agendamam?: number;
    correlativo_caso: string;
    nombre_centro: string;
    precio_venta_uf: number;
}

function Spinner({ className }: { className?: string }) {
    return <div className={cn('h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)} />;
}

const FacturacionPrefacturas: React.FC = () => {
    const { showToast } = useToast();
    const [data, setData] = useState<Prefactura[]>([]);
    const [loading, setLoading] = useState(true);
    const [estadoFiltro, setEstadoFiltro] = useState<string | undefined>(undefined);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [page, setPage] = useState(1);

    const [drawerId, setDrawerId] = useState<number | null>(null);
    const [detalle, setDetalle] = useState<any>(null);
    const [detalleLoading, setDetalleLoading] = useState(false);
    const [accionLoading, setAccionLoading] = useState<string | null>(null);

    const [ocModalOpen, setOcModalOpen] = useState(false);
    const [ocForm, setOcForm] = useState<{ numeroOc: string; fechaOc: string; referencia: string; numeroHes: string; fechaHes: string; observaciones: string }>(
        { numeroOc: '', fechaOc: '', referencia: '', numeroHes: '', fechaHes: '', observaciones: '' }
    );

    const [lotes, setLotes] = useState<any[]>([]);
    const [lotesVisible, setLotesVisible] = useState(false);
    const [lotesLoading, setLotesLoading] = useState(false);

    // Corrección antes de emitir: editar cabecera, quitar un caso mal incluido
    // o anular entera. El backend bloquea las tres una vez emitida.
    const [editarOpen, setEditarOpen] = useState(false);
    const [editarForm, setEditarForm] = useState<EditarForm>({});
    const [guardandoEdicion, setGuardandoEdicion] = useState(false);

    const [confirmQuitarCaso, setConfirmQuitarCaso] = useState<CasoPrefactura | null>(null);
    const [anularOpen, setAnularOpen] = useState(false);
    const [motivoAnulacion, setMotivoAnulacion] = useState('');
    const [anulando, setAnulando] = useState(false);

    const [visorUrl, setVisorUrl] = useState<string | null>(null);
    const [visorTitulo, setVisorTitulo] = useState('');
    const [descargando, setDescargando] = useState<number | null>(null);
    const [emitiendo, setEmitiendo] = useState(false);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const r = await facturacionService.listarPrefacturas(estadoFiltro ? { estado: estadoFiltro } : {});
            setData(r || []);
        } catch {
            showToast({ type: 'error', message: 'No se pudieron cargar las pre-facturas' });
        } finally {
            setLoading(false);
        }
    }, [estadoFiltro]);

    useEffect(() => { cargar(); }, [cargar]);

    const abrirDetalle = async (id: number) => {
        setDrawerId(id);
        setDetalleLoading(true);
        try {
            const d = await facturacionService.getPrefacturaDetalle(id);
            setDetalle(d);
        } catch {
            showToast({ type: 'error', message: 'No se pudo cargar el detalle' });
        } finally {
            setDetalleLoading(false);
        }
    };

    const cerrarDetalle = () => { setDrawerId(null); setDetalle(null); };

    const puedeCorregir = detalle && EDITABLES.includes(detalle.estado);

    const abrirEditar = () => {
        setEditarForm({
            glosa: detalle.glosa, glosa_fe: detalle.glosa_fe, observaciones: detalle.observaciones,
            forma_pago: detalle.forma_pago, facturado_por: detalle.facturado_por,
            descuento_uf: Number(detalle.descuento_uf) || 0, ingreso_uf: Number(detalle.ingreso_uf) || 0,
        });
        setEditarOpen(true);
    };

    const guardarEdicion = async () => {
        setGuardandoEdicion(true);
        try {
            const actualizada = await facturacionService.actualizarPrefactura(drawerId!, editarForm);
            setDetalle(actualizada);
            showToast({ type: 'success', message: 'Pre-factura corregida' });
            setEditarOpen(false);
            await cargar();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo corregir la pre-factura' });
        } finally {
            setGuardandoEdicion(false);
        }
    };

    const confirmarQuitarCaso = async () => {
        if (!confirmQuitarCaso) return;
        try {
            const actualizada = await facturacionService.quitarCasoDePrefactura(drawerId!, confirmQuitarCaso.id_pf_caso);
            setDetalle(actualizada);
            showToast({ type: 'success', message: 'Caso devuelto a la cola de facturables' });
            await cargar();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo quitar el caso' });
        } finally {
            setConfirmQuitarCaso(null);
        }
    };

    const anular = async () => {
        if (!motivoAnulacion.trim()) { showToast({ type: 'warning', message: 'Indica el motivo de la anulación' }); return; }
        setAnulando(true);
        try {
            const r = await facturacionService.anularPrefactura(drawerId!, motivoAnulacion.trim());
            showToast({ type: 'success', message: `Pre-factura anulada · ${r.casos_liberados} caso(s) liberado(s)` });
            setAnularOpen(false);
            setMotivoAnulacion('');
            cerrarDetalle();
            await cargar();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo anular' });
        } finally {
            setAnulando(false);
        }
    };

    const refrescarDetalle = async () => { if (drawerId) await abrirDetalle(drawerId); };

    const baseUrl = API_CONFIG.getBaseURL();

    const generarPdf = async () => {
        if (!drawerId) return;
        setAccionLoading('pdf');
        try {
            await facturacionService.generarPdfs(drawerId);
            showToast({ type: 'success', message: 'PDF generado' });
            await refrescarDetalle();
            await cargar();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo generar el PDF' });
        } finally {
            setAccionLoading(null);
        }
    };

    const enviarEmail = async () => {
        if (!drawerId) return;
        setAccionLoading('email');
        try {
            await facturacionService.enviarPorEmail(drawerId);
            showToast({ type: 'success', message: 'Pre-factura enviada por email' });
            await refrescarDetalle();
            await cargar();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo enviar el email' });
        } finally {
            setAccionLoading(null);
        }
    };

    const registrarOc = async () => {
        if (!drawerId) return;
        if (!ocForm.numeroOc.trim()) { showToast({ type: 'error', message: 'El N° de Orden de Compra es requerido' }); return; }
        try {
            setAccionLoading('oc');
            const r = await facturacionService.registrarOrdenCompra(drawerId, {
                numeroOc: ocForm.numeroOc,
                fechaOc: ocForm.fechaOc || undefined,
                referencia: ocForm.referencia || undefined,
                numeroHes: ocForm.numeroHes || undefined,
                fechaHes: ocForm.fechaHes || undefined,
                observaciones: ocForm.observaciones || undefined,
            });
            // El HES faltante avisa, no bloquea: la OC igual quedó registrada.
            if (r?.aviso_hes) {
                showToast({ type: 'warning', message: r.aviso_hes, duration: 8000 });
            } else {
                showToast({ type: 'success', message: 'Orden de compra registrada' });
            }
            setOcModalOpen(false);
            setOcForm({ numeroOc: '', fechaOc: '', referencia: '', numeroHes: '', fechaHes: '', observaciones: '' });
            await refrescarDetalle();
            await cargar();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo registrar la OC' });
        } finally {
            setAccionLoading(null);
        }
    };

    const cargarLotes = async () => {
        setLotesLoading(true);
        try {
            setLotes(await facturacionService.listarLotesEmision());
        } catch {
            showToast({ type: 'error', message: 'No se pudieron cargar los archivos de emisión' });
        } finally {
            setLotesLoading(false);
        }
    };

    const generarArchivoPlanoSeleccion = async () => {
        if (selectedIds.length === 0) return;
        setEmitiendo(true);
        try {
            const r = await facturacionService.generarArchivoPlano(selectedIds);
            showToast({ type: 'success', message: `Archivo generado: ${r.nombre_archivo} (${r.cantidad_prefacturas} pre-factura(s))` });
            // Avisos que no impiden emitir pero conviene resolver (ej. HES
            // faltante en un cliente que lo exige: el Sistema de Ventas lo
            // rechazaría después sin explicar el motivo).
            if (r?.avisos?.length) {
                showToast({ type: 'warning', message: `El archivo se generó, pero revisa esto: ${r.avisos.join(' · ')}`, duration: 10000 });
            }
            setSelectedIds([]);
            await cargar();
            if (lotesVisible) await cargarLotes();
            await descargarArchivo(`${baseUrl}${r.archivo_path}`, r.nombre_archivo);
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo generar el archivo plano' });
        } finally {
            setEmitiendo(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const paginated = data.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const seleccionables = data.filter((p) => EMITIBLES.includes(p.estado));

    return (
        <div className="shadcn-scope w-full p-6 pb-12">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-[22px] font-bold tracking-tight text-foreground">Pre-Facturas</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">Listado, detalle, PDF, órdenes de compra y emisión.</p>
                </div>
                <Button variant="outline" onClick={cargar}><IconRefresh size={16} /> Actualizar</Button>
            </div>

            <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
                <Combobox
                    value={estadoFiltro}
                    onValueChange={(v) => { setEstadoFiltro(v || undefined); setPage(1); }}
                    placeholder="Filtrar por estado"
                    searchPlaceholder="Buscar estado..."
                    className="w-56"
                    options={[{ value: '', label: 'Todos los estados' }, ...Object.entries(ESTADO_LABEL).map(([value, label]) => ({ value, label }))]}
                />
            </div>

            {selectedIds.length > 0 && (
                <div className="mb-3 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-2 text-sm">
                    <span><b className="text-foreground">{selectedIds.length}</b> pre-factura(s) seleccionada(s) para emisión</span>
                    <Button size="sm" disabled={emitiendo} onClick={generarArchivoPlanoSeleccion}>
                        {emitiendo ? <Spinner className="border-primary-foreground" /> : <IconFileExport size={14} />}
                        Generar archivo plano
                    </Button>
                </div>
            )}

            {loading ? (
                <div className="flex justify-center p-16">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            ) : data.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">No hay pre-facturas con ese filtro.</p>
            ) : (
                <>
                    <div className="overflow-hidden rounded-xl border border-border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-10">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-border"
                                            checked={paginated.filter((p) => EMITIBLES.includes(p.estado)).length > 0 && paginated.filter((p) => EMITIBLES.includes(p.estado)).every((p) => selectedIds.includes(p.id_prefactura))}
                                            onChange={() => {
                                                const ids = paginated.filter((p) => EMITIBLES.includes(p.estado)).map((p) => p.id_prefactura);
                                                const allSel = ids.every((id) => selectedIds.includes(id));
                                                setSelectedIds((prev) => allSel ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
                                            }}
                                            aria-label="Seleccionar todas"
                                        />
                                    </TableHead>
                                    <TableHead>N°</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Agrupación</TableHead>
                                    <TableHead className="text-right">Casos</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-center">OC</TableHead>
                                    <TableHead>Creada</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginated.map((r) => (
                                    <TableRow key={r.id_prefactura} className="cursor-pointer" onClick={() => abrirDetalle(r.id_prefactura)}>
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-border"
                                                disabled={!EMITIBLES.includes(r.estado)}
                                                checked={selectedIds.includes(r.id_prefactura)}
                                                onChange={() => setSelectedIds((prev) => prev.includes(r.id_prefactura) ? prev.filter((id) => id !== r.id_prefactura) : [...prev, r.id_prefactura])}
                                                aria-label={`Seleccionar pre-factura ${r.numero_id}`}
                                            />
                                        </TableCell>
                                        <TableCell className="font-semibold">{r.numero_id}</TableCell>
                                        <TableCell className="max-w-[220px] truncate">{r.nombre_empresaservicios}</TableCell>
                                        <TableCell>{r.agrupacion_valor || (r.agrupacion_tipo === 'SIN_AGRUPACION' ? 'Sin agrupación' : r.agrupacion_tipo)}</TableCell>
                                        <TableCell className="text-right">{r.cantidad_casos}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="tabular-nums">{fmtUf(r.total_uf)} UF</div>
                                            <div className="text-xs text-muted-foreground">$ {fmtClp(r.total_clp)}</div>
                                        </TableCell>
                                        <TableCell><Badge variant={ESTADO_BADGE[r.estado] || 'secondary'}>{ESTADO_LABEL[r.estado] || r.estado}</Badge></TableCell>
                                        <TableCell className="text-center">{r.cantidad_oc > 0 ? <Badge variant="outline">{r.cantidad_oc}</Badge> : '—'}</TableCell>
                                        <TableCell>{fmtFecha(r.fecha_creacion)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="mt-3">
                        <DataPagination page={currentPage} pageSize={PAGE_SIZE} total={data.length} onPageChange={setPage} />
                    </div>
                </>
            )}
            {!loading && seleccionables.length === 0 && data.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                    Solo pueden emitirse pre-facturas en estado "OC Recibida" o "Enviada" (sin OC requerida).
                </p>
            )}

            <div className="my-6 border-t border-border" />
            <button
                type="button"
                className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary"
                onClick={() => { const next = !lotesVisible; setLotesVisible(next); if (next && lotes.length === 0) cargarLotes(); }}
            >
                <IconFolders size={15} /> Archivos de emisión generados
                <IconChevronDown size={14} className={cn('transition-transform', lotesVisible && 'rotate-180')} />
            </button>
            {lotesVisible && (
                <div className="mt-3">
                    {lotesLoading ? (
                        <div className="flex justify-center p-8">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    ) : lotes.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Aún no se ha generado ningún archivo plano.</p>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-border bg-card">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead>Archivo</TableHead>
                                        <TableHead className="text-right">Pre-facturas</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Generado</TableHead>
                                        <TableHead />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lotes.map((r: any) => (
                                        <TableRow key={r.id_lote}>
                                            <TableCell>{r.nombre_archivo}</TableCell>
                                            <TableCell className="text-right">{r.cantidad_prefacturas}</TableCell>
                                            <TableCell><Badge variant="secondary">{r.estado}</Badge></TableCell>
                                            <TableCell>{fmtFechaHora(r.fecha_creacion)}</TableCell>
                                            <TableCell>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={descargando === r.id_lote}
                                                    onClick={async () => {
                                                        setDescargando(r.id_lote);
                                                        try {
                                                            await descargarArchivo(`${baseUrl}${r.archivo_path}`, r.nombre_archivo);
                                                        } catch {
                                                            showToast({ type: 'error', message: 'No se pudo descargar el archivo' });
                                                        } finally {
                                                            setDescargando(null);
                                                        }
                                                    }}
                                                >
                                                    {descargando === r.id_lote ? <Spinner /> : <IconDownload size={13} />}
                                                    Descargar
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            )}

            <Sheet open={drawerId !== null} onOpenChange={(open) => { if (!open) cerrarDetalle(); }}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
                    <SheetHeader>
                        <div className="flex items-center gap-2">
                            <SheetTitle>{detalle ? `Pre-Factura N° ${detalle.numero_id}` : 'Detalle'}</SheetTitle>
                            {detalle && <Badge variant={ESTADO_BADGE[detalle.estado] || 'secondary'}>{ESTADO_LABEL[detalle.estado] || detalle.estado}</Badge>}
                        </div>
                    </SheetHeader>

                    {detalleLoading || !detalle ? (
                        <div className="flex justify-center p-16">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <div className="col-span-2">
                                    <div className="text-xs text-muted-foreground">Cliente</div>
                                    <div className="text-foreground">{detalle.nombre_empresaservicios}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Agrupación</div>
                                    <div className="text-foreground">{detalle.agrupacion_valor || detalle.agrupacion_tipo}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Valor UF</div>
                                    <div className="text-foreground">{fmtUf(detalle.valor_uf)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Creada</div>
                                    <div className="text-foreground">{fmtFecha(detalle.fecha_creacion)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Email enviado</div>
                                    <div className="text-foreground">{detalle.email_enviado ? fmtFecha(detalle.fecha_email) : 'No'}</div>
                                </div>
                            </div>

                            <div className="mb-4 flex gap-6 rounded-lg border border-border bg-muted/30 p-4">
                                <div>
                                    <div className="text-xs text-muted-foreground">Total UF</div>
                                    <div className="text-lg font-semibold text-foreground">{fmtUf(detalle.total_uf)} UF</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Total CLP</div>
                                    <div className="text-lg font-semibold text-foreground">$ {fmtClp(detalle.total_clp)}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Casos</div>
                                    <div className="text-lg font-semibold text-foreground">{detalle.casos?.length || 0}</div>
                                </div>
                            </div>

                            <div className="mb-4 flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" disabled={accionLoading === 'pdf'} onClick={generarPdf}>
                                    {accionLoading === 'pdf' ? <Spinner /> : <IconFileText size={14} />}
                                    Generar PDF
                                </Button>
                                {detalle.pdf_resumen_path && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        title="Ver PDF resumen"
                                        onClick={() => { setVisorTitulo(`Pre-Factura N° ${detalle.numero_id} — Resumen`); setVisorUrl(`${baseUrl}${detalle.pdf_resumen_path}`); }}
                                    >
                                        <IconExternalLink size={14} /> PDF resumen
                                    </Button>
                                )}
                                {detalle.pdf_detalle_path && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        title="Ver PDF detalle"
                                        onClick={() => { setVisorTitulo(`Pre-Factura N° ${detalle.numero_id} — Detalle`); setVisorUrl(`${baseUrl}${detalle.pdf_detalle_path}`); }}
                                    >
                                        <IconExternalLink size={14} /> PDF detalle
                                    </Button>
                                )}
                                <Button size="sm" variant="outline" disabled={accionLoading === 'email'} onClick={enviarEmail}>
                                    {accionLoading === 'email' ? <Spinner /> : <IconMail size={14} />}
                                    Enviar por email
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setOcModalOpen(true)}>
                                    <IconTruck size={14} /> Registrar OC/HES
                                </Button>
                                {puedeCorregir && (
                                    <>
                                        <Button size="sm" variant="outline" title="Corregir glosa, forma de pago, observaciones o descuentos" onClick={abrirEditar}>
                                            <IconPencil size={14} /> Corregir
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            title="Anula la pre-factura y devuelve sus casos a la cola de facturables"
                                            onClick={() => setAnularOpen(true)}
                                        >
                                            <IconBan size={14} /> Anular
                                        </Button>
                                    </>
                                )}
                            </div>
                            {!puedeCorregir && detalle.estado !== 'ANULADA' && (
                                <div className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                                    <p className="font-medium text-foreground">Ya no se puede corregir</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        La pre-factura fue emitida o está en emisión: modificarla acá dejaría ADL ONE y el Sistema de Ventas con datos distintos.
                                    </p>
                                </div>
                            )}

                            <div className="my-4 border-t border-border" />

                            <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Casos incluidos ({detalle.casos?.length || 0})</p>
                            <div className="mb-5 overflow-hidden rounded-xl border border-border bg-card">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead>N° Caso</TableHead>
                                            <TableHead>Centro</TableHead>
                                            <TableHead className="text-right">UF</TableHead>
                                            {puedeCorregir && (detalle.casos?.length || 0) > 1 && <TableHead className="w-10" />}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {(detalle.casos || []).map((c: any) => (
                                            <TableRow key={c.id_pf_caso}>
                                                <TableCell>{c.correlativo_caso}</TableCell>
                                                <TableCell className="max-w-[200px] truncate">{c.nombre_centro}</TableCell>
                                                <TableCell className="text-right tabular-nums">{fmtUf(c.precio_venta_uf)}</TableCell>
                                                {puedeCorregir && (detalle.casos?.length || 0) > 1 && (
                                                    <TableCell>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                            title="Quitar de esta pre-factura y devolverlo a la cola"
                                                            onClick={() => setConfirmQuitarCaso(c)}
                                                        >
                                                            <IconTrash size={13} />
                                                        </Button>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">Órdenes de compra / HES ({detalle.ordenes_compra?.length || 0})</p>
                            {detalle.ordenes_compra?.length ? (
                                <div className="mb-5 overflow-hidden rounded-xl border border-border bg-card">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead>N° OC</TableHead>
                                                <TableHead>Fecha OC</TableHead>
                                                <TableHead>N° HES</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {detalle.ordenes_compra.map((oc: any) => (
                                                <TableRow key={oc.id_orden_compra}>
                                                    <TableCell>{oc.numero_oc}</TableCell>
                                                    <TableCell>{fmtFecha(oc.fecha_oc)}</TableCell>
                                                    <TableCell>{oc.numero_hes || '—'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <p className="mb-5 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Sin OC registradas</p>
                            )}

                            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                <IconHistory size={13} /> Historial
                            </p>
                            <div className="flex flex-col gap-4">
                                {(detalle.historial || []).map((h: any, i: number) => (
                                    <div key={i} className="relative pl-5">
                                        <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-primary" />
                                        {i < (detalle.historial || []).length - 1 && <span className="absolute left-[3px] top-3.5 h-full w-px bg-border" />}
                                        <div className="text-sm font-semibold text-foreground">{h.descripcion || h.accion}</div>
                                        <div className="text-xs text-muted-foreground">{fmtFechaHora(h.fecha)}</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            <Dialog open={ocModalOpen} onOpenChange={setOcModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Registrar Orden de Compra / HES</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-3.5">
                        <FieldLabel label="N° Orden de Compra" required>
                            <Input placeholder="Ej: 4500123456" value={ocForm.numeroOc} onChange={(e) => setOcForm({ ...ocForm, numeroOc: e.target.value })} />
                        </FieldLabel>
                        <FieldLabel label="Fecha OC">
                            <DatePicker value={ocForm.fechaOc} onChange={(v) => setOcForm({ ...ocForm, fechaOc: v })} />
                        </FieldLabel>
                        <FieldLabel label="Referencia">
                            <Input placeholder="Opcional" value={ocForm.referencia} onChange={(e) => setOcForm({ ...ocForm, referencia: e.target.value })} />
                        </FieldLabel>
                        <FieldLabel label="N° HES (si corresponde)">
                            <Input placeholder="Opcional" value={ocForm.numeroHes} onChange={(e) => setOcForm({ ...ocForm, numeroHes: e.target.value })} />
                        </FieldLabel>
                        <FieldLabel label="Fecha HES">
                            <DatePicker value={ocForm.fechaHes} onChange={(v) => setOcForm({ ...ocForm, fechaHes: v })} />
                        </FieldLabel>
                        <FieldLabel label="Observaciones">
                            <textarea
                                rows={2}
                                value={ocForm.observaciones}
                                onChange={(e) => setOcForm({ ...ocForm, observaciones: e.target.value })}
                                className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                        </FieldLabel>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOcModalOpen(false)}>Cancelar</Button>
                        <Button disabled={accionLoading === 'oc'} onClick={registrarOc}>
                            {accionLoading === 'oc' ? <Spinner className="border-primary-foreground" /> : <IconSend2 size={14} />}
                            Registrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={editarOpen} onOpenChange={setEditarOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{detalle ? `Corregir Pre-Factura N° ${detalle.numero_id}` : 'Corregir'}</DialogTitle>
                    </DialogHeader>
                    <div className="mb-1 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
                        <p className="font-medium text-foreground">Los PDF ya generados se invalidan</p>
                        <p className="mt-1 text-xs text-muted-foreground">Hay que volver a generarlos para que reflejen la corrección; así nadie envía por correo la versión antigua.</p>
                    </div>
                    <div className="flex flex-col gap-3.5">
                        <FieldLabel label="Glosa">
                            <Input value={editarForm.glosa || ''} onChange={(e) => setEditarForm({ ...editarForm, glosa: e.target.value })} />
                        </FieldLabel>
                        <FieldLabel label="Glosa factura electrónica">
                            <Input value={editarForm.glosa_fe || ''} onChange={(e) => setEditarForm({ ...editarForm, glosa_fe: e.target.value })} />
                        </FieldLabel>
                        <FieldLabel label="Forma de pago">
                            <Input value={editarForm.forma_pago || ''} onChange={(e) => setEditarForm({ ...editarForm, forma_pago: e.target.value })} />
                        </FieldLabel>
                        <FieldLabel label="Facturado por">
                            <Input value={editarForm.facturado_por || ''} onChange={(e) => setEditarForm({ ...editarForm, facturado_por: e.target.value })} />
                        </FieldLabel>
                        <div className="grid grid-cols-2 gap-3">
                            <FieldLabel label="Descuento (UF)">
                                <Input type="number" min={0} step={0.01} value={editarForm.descuento_uf ?? 0} onChange={(e) => setEditarForm({ ...editarForm, descuento_uf: Number(e.target.value) })} />
                            </FieldLabel>
                            <FieldLabel label="Ingreso adicional (UF)">
                                <Input type="number" min={0} step={0.01} value={editarForm.ingreso_uf ?? 0} onChange={(e) => setEditarForm({ ...editarForm, ingreso_uf: Number(e.target.value) })} />
                            </FieldLabel>
                        </div>
                        <FieldLabel label="Observaciones">
                            <textarea
                                rows={2}
                                value={editarForm.observaciones || ''}
                                onChange={(e) => setEditarForm({ ...editarForm, observaciones: e.target.value })}
                                className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                        </FieldLabel>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditarOpen(false)}>Cancelar</Button>
                        <Button disabled={guardandoEdicion} onClick={guardarEdicion}>
                            {guardandoEdicion ? <Spinner className="border-primary-foreground" /> : null}
                            Guardar cambios
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={confirmQuitarCaso !== null} onOpenChange={(open) => { if (!open) setConfirmQuitarCaso(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Quitar el caso {confirmQuitarCaso?.correlativo_caso || confirmQuitarCaso?.id_agendamam}?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">Vuelve a la cola de facturables para incluirlo en otra pre-factura. Se recalculan los totales.</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmQuitarCaso(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={confirmarQuitarCaso}>Quitar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={anularOpen} onOpenChange={(open) => { setAnularOpen(open); if (!open) setMotivoAnulacion(''); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Anular la pre-factura N° {detalle?.numero_id}?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Sus {detalle?.casos?.length || 0} caso(s) vuelven a la cola de facturables. La pre-factura queda anulada, no se borra.
                    </p>
                    <Label className="text-xs font-medium text-muted-foreground">Motivo de la anulación</Label>
                    <Input placeholder="Motivo de la anulación" value={motivoAnulacion} onChange={(e) => setMotivoAnulacion(e.target.value)} />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAnularOpen(false)}>Cancelar</Button>
                        <Button variant="destructive" disabled={anulando} onClick={anular}>
                            {anulando ? <Spinner className="border-primary-foreground" /> : null}
                            Anular
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <PdfViewerModal open={visorUrl !== null} onClose={() => setVisorUrl(null)} url={visorUrl} title={visorTitulo} />
        </div>
    );
};

function FieldLabel({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
                {label}{required && <span className="text-destructive"> *</span>}
            </Label>
            {children}
        </div>
    );
}

export default FacturacionPrefacturas;
