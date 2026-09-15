import { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
    IconRefresh, IconUpload, IconCircleCheck, IconCircleX, IconFileTypePdf, IconSparkles,
} from '@tabler/icons-react';
import { facturacionService } from '../services/facturacion.service';
import { catalogosService, type EmpresaServicio } from '../../medio-ambiente/services/catalogos.service';
import PdfViewerModal from './PdfViewerModal';
import API_CONFIG from '../../../config/api.config';
import { useToast } from '../../../contexts/ToastContext';

const fmtFecha = (v: string | null) => v ? new Date(v).toLocaleDateString('es-CL') : '—';
const fmtFechaHora = (v: string | null) => v ? new Date(v).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const fmtClp = (n: number) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

// La extracción automática reporta su propia confianza: se muestra tal cual
// para que quien revisa sepa cuánto puede confiar en los campos sugeridos.
const CONFIANZA: Record<string, { variant: 'success' | 'warning' | 'destructive'; label: string }> = {
    ALTA: { variant: 'success', label: 'Confianza alta' },
    MEDIA: { variant: 'warning', label: 'Confianza media' },
    BAJA: { variant: 'destructive', label: 'Confianza baja' },
};

interface Candidato {
    id_candidato: number;
    id_prefactura: number | null;
    numero_id: number | null;
    id_empresaservicio: number;
    nombre_empresaservicios: string;
    origen: string;
    archivo_path: string;
    numero_oc_sugerido: string | null;
    fecha_oc_sugerida: string | null;
    numero_hes_sugerido: string | null;
    fecha_hes_sugerida: string | null;
    monto_sugerido: number | null;
    confianza: string | null;
    metodo_extraccion: string | null;
    estado: string;
    fecha_creacion: string;
}

const FacturacionBandejaOc: React.FC = () => {
    const { showToast } = useToast();
    const [data, setData] = useState<Candidato[]>([]);
    const [loading, setLoading] = useState(true);

    const [confirmando, setConfirmando] = useState<Candidato | null>(null);
    const [numeroOc, setNumeroOc] = useState('');
    const [fechaOc, setFechaOc] = useState('');
    const [numeroHes, setNumeroHes] = useState('');
    const [fechaHes, setFechaHes] = useState('');
    const [guardando, setGuardando] = useState(false);

    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

    const [descartando, setDescartando] = useState<Candidato | null>(null);
    const [procesandoDescarte, setProcesandoDescarte] = useState(false);

    // --- Subida manual de una OC que llegó por correo ---
    const [subirOpen, setSubirOpen] = useState(false);
    const [prefacturas, setPrefacturas] = useState<any[]>([]);
    const [idPrefacturaSel, setIdPrefacturaSel] = useState<number | undefined>();
    const [archivo, setArchivo] = useState<File | null>(null);
    const [subiendo, setSubiendo] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    // OC anticipada: el cliente la mandó antes de que existiera la pre-factura.
    const [anticipada, setAnticipada] = useState(false);
    const [empresas, setEmpresas] = useState<EmpresaServicio[]>([]);
    const [idEmpresaSel, setIdEmpresaSel] = useState<number | undefined>();
    // Al confirmar una anticipada hay que decir contra qué pre-factura va.
    const [pfDestino, setPfDestino] = useState<number | undefined>();

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            setData(await facturacionService.listarCandidatosOc() || []);
        } catch {
            showToast({ type: 'error', message: 'No se pudo cargar la bandeja de OCs' });
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { cargar(); }, [cargar]);

    const abrirConfirmar = async (c: Candidato) => {
        setConfirmando(c);
        setNumeroOc(c.numero_oc_sugerido || '');
        setFechaOc(c.fecha_oc_sugerida ? c.fecha_oc_sugerida.slice(0, 10) : '');
        setNumeroHes(c.numero_hes_sugerido || '');
        setFechaHes(c.fecha_hes_sugerida ? c.fecha_hes_sugerida.slice(0, 10) : '');
        setPfDestino(undefined);
        // Una anticipada necesita que se elija la pre-factura destino: se
        // cargan solo las del mismo cliente para no ofrecer imposibles.
        if (!c.numero_id && prefacturas.length === 0) {
            try { setPrefacturas(await facturacionService.listarPrefacturas() || []); } catch { /* noop */ }
        }
    };

    const confirmar = async () => {
        if (!confirmando) return;
        if (!numeroOc.trim()) { showToast({ type: 'warning', message: 'El número de OC es requerido' }); return; }
        if (!confirmando.numero_id && !pfDestino) { showToast({ type: 'warning', message: 'Elige la pre-factura contra la que se aplica esta OC' }); return; }
        setGuardando(true);
        try {
            await facturacionService.confirmarCandidatoOc(confirmando.id_candidato, {
                numeroOc: numeroOc.trim(),
                fechaOc: fechaOc || undefined,
                numeroHes: numeroHes.trim() || undefined,
                fechaHes: fechaHes || undefined,
                idPrefactura: pfDestino,
            });
            showToast({ type: 'success', message: `OC ${numeroOc.trim()} registrada` });
            setConfirmando(null);
            await cargar();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo confirmar la OC' });
        } finally {
            setGuardando(false);
        }
    };

    const descartar = async () => {
        if (!descartando) return;
        setProcesandoDescarte(true);
        try {
            await facturacionService.descartarCandidatoOc(descartando.id_candidato);
            showToast({ type: 'success', message: 'Candidato descartado' });
            setDescartando(null);
            await cargar();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo descartar' });
        } finally {
            setProcesandoDescarte(false);
        }
    };

    const abrirSubir = async () => {
        setSubirOpen(true);
        setIdPrefacturaSel(undefined);
        setIdEmpresaSel(undefined);
        setAnticipada(false);
        setArchivo(null);
        if (prefacturas.length === 0) {
            try {
                setPrefacturas(await facturacionService.listarPrefacturas() || []);
            } catch {
                showToast({ type: 'error', message: 'No se pudieron cargar las pre-facturas' });
            }
        }
        if (empresas.length === 0) {
            try {
                const raw: any[] = await catalogosService.getEmpresasServicio();
                setEmpresas(raw.map((e) => ({ id: e.id_empresaservicio, nombre: e.nombre_empresaservicios })));
            } catch { /* el modo anticipada queda sin lista, el normal igual sirve */ }
        }
    };

    const subir = async () => {
        if (anticipada && !idEmpresaSel) { showToast({ type: 'warning', message: 'Elige el cliente al que corresponde la OC' }); return; }
        if (!anticipada && !idPrefacturaSel) { showToast({ type: 'warning', message: 'Elige la pre-factura a la que corresponde la OC' }); return; }
        if (!archivo) { showToast({ type: 'warning', message: 'Adjunta el PDF de la OC' }); return; }
        setSubiendo(true);
        try {
            const r = await facturacionService.crearCandidatoOc(
                anticipada ? null : idPrefacturaSel!, archivo, idEmpresaSel);
            if (r?.anticipada) {
                showToast({ type: 'success', message: 'OC anticipada guardada: queda pendiente hasta que exista la pre-factura.' });
            } else {
                showToast({
                    type: 'success',
                    message: r?.extraido
                        ? 'OC subida — se extrajeron datos automáticamente, revísalos antes de confirmar.'
                        : 'OC subida. No se pudieron extraer los datos: complétalos a mano al confirmar.',
                });
            }
            setSubirOpen(false);
            await cargar();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo subir la OC' });
        } finally {
            setSubiendo(false);
        }
    };

    return (
        <div className="shadcn-scope w-full p-7 pb-14">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="m-0 text-[21px] font-semibold tracking-tight text-foreground">Bandeja de Órdenes de Compra</h2>
                    <p className="m-0 mt-0.5 text-[13px] text-muted-foreground">
                        OCs pendientes de confirmar. Adjunta el PDF que llegó por correo y confirma con un click.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={cargar}>
                        <IconRefresh size={16} /> Actualizar
                    </Button>
                    <Button onClick={abrirSubir}>
                        <IconUpload size={16} /> Subir OC
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-14">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            ) : data.length === 0 ? (
                <p className="p-10 text-center text-sm text-muted-foreground">No hay OCs pendientes de revisar.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Pre-factura</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>OC sugerida</TableHead>
                            <TableHead>HES</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead>Extracción</TableHead>
                            <TableHead>Recibida</TableHead>
                            <TableHead className="text-right"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((r: any) => (
                            <TableRow key={r.id_candidato}>
                                <TableCell>
                                    {r.numero_id ? <b>N° {r.numero_id}</b> : (
                                        <span title={r.prefacturas_disponibles > 0
                                            ? `Este cliente tiene ${r.prefacturas_disponibles} pre-factura(s) a las que se puede aplicar`
                                            : 'Todavía no hay ninguna pre-factura de este cliente'}>
                                            <Badge variant={r.prefacturas_disponibles > 0 ? 'secondary' : 'warning'}>
                                                Anticipada{r.prefacturas_disponibles > 0 ? ` · ${r.prefacturas_disponibles} disponible(s)` : ''}
                                            </Badge>
                                        </span>
                                    )}
                                </TableCell>
                                <TableCell className="max-w-[220px] truncate">{r.nombre_empresaservicios || '—'}</TableCell>
                                <TableCell>
                                    {r.numero_oc_sugerido ? (
                                        <span>
                                            <b>{r.numero_oc_sugerido}</b>
                                            {r.fecha_oc_sugerida && <span className="text-muted-foreground"> · {fmtFecha(r.fecha_oc_sugerida)}</span>}
                                        </span>
                                    ) : <Badge variant="outline">Sin extraer</Badge>}
                                </TableCell>
                                <TableCell>{r.numero_hes_sugerido || <span className="text-muted-foreground">—</span>}</TableCell>
                                <TableCell className="text-right">
                                    {r.monto_sugerido ? `$ ${fmtClp(r.monto_sugerido)}` : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell>
                                    {!r.confianza ? <Badge variant="outline">Manual</Badge> : (() => {
                                        const info = CONFIANZA[r.confianza] || { variant: 'outline' as const, label: r.confianza };
                                        return (
                                            <span title={r.metodo_extraccion === 'VISION_IA' ? 'Datos leídos automáticamente del PDF' : undefined}>
                                                <Badge variant={info.variant}>
                                                    <IconSparkles size={11} className="mr-0.5" /> {info.label}
                                                </Badge>
                                            </span>
                                        );
                                    })()}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">{fmtFechaHora(r.fecha_creacion)}</TableCell>
                                <TableCell>
                                    <div className="flex items-center justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            title="Ver el PDF de la OC"
                                            onClick={() => setPdfUrl(`${API_CONFIG.getBaseURL()}${r.archivo_path}`)}
                                        >
                                            <IconFileTypePdf size={14} />
                                        </Button>
                                        <Button size="sm" onClick={() => abrirConfirmar(r)}>
                                            <IconCircleCheck size={14} /> Confirmar
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            title="Descartar"
                                            onClick={() => setDescartando(r)}
                                        >
                                            <IconCircleX size={14} />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {/* Confirmar: los datos sugeridos son editables antes de registrarlos */}
            <Dialog open={confirmando !== null} onOpenChange={(open) => { if (!open) setConfirmando(null); }}>
                <DialogContent className="max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>{confirmando ? `Confirmar OC — Pre-factura N° ${confirmando.numero_id}` : 'Confirmar OC'}</DialogTitle>
                    </DialogHeader>
                    {confirmando && (
                        <>
                            {confirmando.confianza && confirmando.confianza !== 'ALTA' && (
                                <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3">
                                    <p className="text-sm font-medium text-foreground">Revisa los datos antes de confirmar</p>
                                    <p className="text-sm text-muted-foreground">La extracción automática no quedó segura de estos valores.</p>
                                </div>
                            )}
                            {!confirmando.numero_oc_sugerido && (
                                <div className="mb-4 rounded-lg border border-border bg-muted/40 p-3">
                                    <p className="text-sm text-foreground">No se pudieron leer los datos del PDF — complétalos a mano.</p>
                                </div>
                            )}
                            {!confirmando.numero_id && (
                                <div className="mb-4">
                                    <label className="mb-1.5 block text-xs text-muted-foreground">Pre-factura a la que se aplica *</label>
                                    <Combobox
                                        value={pfDestino !== undefined ? String(pfDestino) : undefined}
                                        onValueChange={(v) => setPfDestino(Number(v))}
                                        placeholder="Pre-facturas de este cliente"
                                        searchPlaceholder="Buscar pre-factura..."
                                        options={prefacturas
                                            .filter((p: any) => Number(p.id_empresaservicio) === Number(confirmando.id_empresaservicio))
                                            .map((p: any) => ({ value: String(p.id_prefactura), label: `N° ${p.numero_id} — ${p.estado}` }))}
                                    />
                                    <p className="mt-1.5 text-xs text-muted-foreground">Esta OC se cargó antes de que existiera la pre-factura.</p>
                                </div>
                            )}
                            <div className="mb-4">
                                <label className="mb-1.5 block text-xs text-muted-foreground">N° de Orden de Compra *</label>
                                <Input value={numeroOc} onChange={(e) => setNumeroOc(e.target.value)} placeholder="Ej: 4500123456" />
                            </div>
                            <div className="mb-4">
                                <label className="mb-1.5 block text-xs text-muted-foreground">Fecha de la OC</label>
                                <DatePicker value={fechaOc} onChange={setFechaOc} />
                            </div>
                            <div className="mb-4">
                                <label className="mb-1.5 block text-xs text-muted-foreground">N° HES (si corresponde)</label>
                                <Input value={numeroHes} onChange={(e) => setNumeroHes(e.target.value)} placeholder="Opcional" />
                            </div>
                            <div className="mb-4">
                                <label className="mb-1.5 block text-xs text-muted-foreground">Fecha HES</label>
                                <DatePicker value={fechaHes} onChange={setFechaHes} />
                            </div>
                            <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0"
                                onClick={() => setPdfUrl(`${API_CONFIG.getBaseURL()}${confirmando.archivo_path}`)}
                            >
                                <IconFileTypePdf size={14} /> Ver el PDF mientras completas
                            </Button>
                        </>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmando(null)}>Cancelar</Button>
                        <Button disabled={guardando} onClick={confirmar}>
                            {guardando && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                            Registrar OC
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Subir una OC que llegó por correo */}
            <Dialog open={subirOpen} onOpenChange={setSubirOpen}>
                <DialogContent className="max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>Subir Orden de Compra</DialogTitle>
                    </DialogHeader>
                    <div className="mb-4 flex items-center gap-2">
                        <Switch checked={anticipada} onCheckedChange={setAnticipada} />
                        <span className="text-sm text-muted-foreground">Todavía no existe la pre-factura</span>
                    </div>
                    {anticipada ? (
                        <div className="mb-4">
                            <label className="mb-1.5 block text-xs text-muted-foreground">Cliente al que corresponde *</label>
                            <Combobox
                                value={idEmpresaSel !== undefined ? String(idEmpresaSel) : undefined}
                                onValueChange={(v) => setIdEmpresaSel(Number(v))}
                                placeholder="Selecciona el cliente"
                                searchPlaceholder="Buscar cliente..."
                                options={empresas.map((e) => ({ value: String(e.id), label: e.nombre }))}
                            />
                            <p className="mt-1.5 text-xs text-muted-foreground">
                                Queda guardada esperando: cuando exista la pre-factura de este cliente, se confirma contra ella.
                            </p>
                        </div>
                    ) : (
                        <div className="mb-4">
                            <label className="mb-1.5 block text-xs text-muted-foreground">Pre-factura a la que corresponde *</label>
                            <Combobox
                                value={idPrefacturaSel !== undefined ? String(idPrefacturaSel) : undefined}
                                onValueChange={(v) => setIdPrefacturaSel(Number(v))}
                                placeholder="Busca por número o cliente"
                                searchPlaceholder="Buscar pre-factura..."
                                options={prefacturas.map((p: any) => ({
                                    value: String(p.id_prefactura),
                                    label: `N° ${p.numero_id} — ${p.nombre_empresaservicios || 'Sin cliente'}`,
                                }))}
                            />
                        </div>
                    )}
                    <div className="mb-4">
                        <label className="mb-1.5 block text-xs text-muted-foreground">PDF de la OC *</label>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                        />
                        <Button variant="outline" onClick={() => fileRef.current?.click()}>
                            <IconUpload size={14} /> {archivo ? archivo.name : 'Seleccionar archivo'}
                        </Button>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <p className="text-sm text-foreground">
                            Al subirla se intentará leer el número de OC, la fecha y el monto del PDF. Siempre podrás corregirlos antes de confirmar.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSubirOpen(false)}>Cancelar</Button>
                        <Button disabled={subiendo} onClick={subir}>
                            {subiendo && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                            Subir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={descartando !== null} onOpenChange={(open) => { if (!open) setDescartando(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Descartar este candidato?</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Se marcará como descartado y saldrá de la bandeja. El archivo queda guardado.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDescartando(null)}>Cancelar</Button>
                        <Button variant="destructive" disabled={procesandoDescarte} onClick={descartar}>
                            {procesandoDescarte && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                            Descartar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <PdfViewerModal
                open={pdfUrl !== null}
                url={pdfUrl || ''}
                title="Orden de Compra"
                onClose={() => setPdfUrl(null)}
            />
        </div>
    );
};

export default FacturacionBandejaOc;
