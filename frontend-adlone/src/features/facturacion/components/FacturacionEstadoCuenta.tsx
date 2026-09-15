import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { IconRefresh, IconCash, IconAlertTriangle } from '@tabler/icons-react';
import { facturacionService } from '../services/facturacion.service';
import { catalogosService, type EmpresaServicio } from '../../medio-ambiente/services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';

const fmtClp = (n: number) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
const fmtFecha = (v: string | null) => v ? new Date(v).toLocaleDateString('es-CL') : '—';
const hoyStr = () => new Date().toISOString().slice(0, 10);

// Tramos de antigüedad: solo informan hace cuánto se emitió, NO mora — no hay
// fuente de pago automática (ver comentario de la Fase 8 en el servicio).
const tramoClass = (dias: number) => dias > 90 ? 'text-destructive' : dias > 60 ? 'text-warning' : dias > 30 ? 'text-muted-foreground' : 'text-success';

interface Factura {
    id_emision: number;
    folio_sii: number | null;
    tipo_documento: string;
    fecha_emision: string;
    monto_neto: number;
    iva: number;
    monto_total: number;
    pagada: boolean;
    fecha_pago: string | null;
    id_prefactura: number;
    numero_id: number;
    dias_desde_emision: number;
}

const FacturacionEstadoCuenta: React.FC = () => {
    const { showToast } = useToast();
    const [empresas, setEmpresas] = useState<EmpresaServicio[]>([]);
    const [idEmpresaSel, setIdEmpresaSel] = useState<number | undefined>();
    const [facturas, setFacturas] = useState<Factura[]>([]);
    const [resumen, setResumen] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const [pagando, setPagando] = useState<Factura | null>(null);
    const [fechaPago, setFechaPago] = useState<string>(hoyStr());
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const raw: any[] = await catalogosService.getEmpresasServicio();
                setEmpresas(raw.map((e) => ({ id: e.id_empresaservicio, nombre: e.nombre_empresaservicios })));
            } catch {
                showToast({ type: 'error', message: 'No se pudieron cargar los clientes' });
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cargar = async (idEmpresa?: number) => {
        const id = idEmpresa ?? idEmpresaSel;
        if (!id) return;
        setLoading(true);
        try {
            const r = await facturacionService.getEstadoCuenta(id);
            setFacturas(r?.facturas || []);
            setResumen(r?.resumen || null);
        } catch {
            showToast({ type: 'error', message: 'No se pudo cargar el estado de cuenta' });
        } finally {
            setLoading(false);
        }
    };

    const onEmpresaChange = (val: string) => {
        const id = Number(val);
        setIdEmpresaSel(id);
        setFacturas([]);
        setResumen(null);
        cargar(id);
    };

    const marcarPagada = async () => {
        if (!pagando) return;
        setGuardando(true);
        try {
            await facturacionService.marcarFacturaPagada(pagando.id_emision, fechaPago || undefined);
            showToast({ type: 'success', message: `Factura ${pagando.folio_sii || pagando.id_emision} marcada como pagada` });
            setPagando(null);
            await cargar();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo marcar como pagada' });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="shadcn-scope w-full p-7 pb-14">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="m-0 text-[21px] font-semibold tracking-tight text-foreground">Estado de cuenta</h2>
                    <p className="m-0 mt-0.5 text-[13px] text-muted-foreground">Facturas emitidas por cliente y su antigüedad desde la emisión.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-80">
                        <Combobox
                            value={idEmpresaSel !== undefined ? String(idEmpresaSel) : undefined}
                            onValueChange={onEmpresaChange}
                            placeholder="Selecciona un cliente"
                            searchPlaceholder="Buscar cliente..."
                            options={empresas.map((e) => ({ value: String(e.id), label: e.nombre }))}
                        />
                    </div>
                    <Button variant="outline" disabled={!idEmpresaSel} onClick={() => cargar()}>
                        <IconRefresh size={16} /> Actualizar
                    </Button>
                </div>
            </div>

            {/* El estado de pago es MANUAL: no hay integración con el sistema de
                ventas que informe pagos, y decirlo evita que alguien lea estos
                números como una cartola real. */}
            <div className="mb-[22px] flex max-w-[900px] items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
                <IconAlertTriangle size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                <div>
                    <p className="text-sm font-medium text-foreground">El pago se marca a mano</p>
                    <p className="text-sm text-muted-foreground">No hay una fuente automática de pagos conectada, así que “sin marcar” significa que nadie lo registró todavía — no necesariamente que esté impago.</p>
                </div>
            </div>

            {!idEmpresaSel ? (
                <p className="p-10 text-center text-sm text-muted-foreground">Elige un cliente para ver su estado de cuenta.</p>
            ) : loading ? (
                <div className="flex justify-center p-14">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            ) : (
                <>
                    {resumen && (
                        <div className="mb-6 grid max-w-[900px] gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
                            <Card className="p-[18px_20px]">
                                <p className="text-xs text-muted-foreground">Total facturado</p>
                                <p className="mt-1 text-xl font-semibold text-foreground">$ {fmtClp(resumen.total_facturado)}</p>
                            </Card>
                            <Card className="p-[18px_20px]">
                                <p className="text-xs text-muted-foreground">Sin marcar como pagado</p>
                                <p className={`mt-1 text-xl font-semibold ${resumen.total_sin_marcar_pago > 0 ? 'text-warning' : 'text-success'}`}>
                                    $ {fmtClp(resumen.total_sin_marcar_pago)}
                                </p>
                            </Card>
                            <Card className="p-[18px_20px]">
                                <p className="text-xs text-muted-foreground">Facturas sin marcar</p>
                                <p className="mt-1 text-xl font-semibold text-foreground">{resumen.cantidad_sin_marcar_pago} / {facturas.length}</p>
                            </Card>
                        </div>
                    )}

                    {facturas.length === 0 ? (
                        <p className="p-10 text-center text-sm text-muted-foreground">Este cliente no tiene facturas emitidas con folio registrado.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Folio</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Pre-factura</TableHead>
                                    <TableHead>Emisión</TableHead>
                                    <TableHead>Antigüedad</TableHead>
                                    <TableHead className="text-right">Neto</TableHead>
                                    <TableHead className="text-right">IVA</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead>Pago</TableHead>
                                    <TableHead className="text-right"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {facturas.map((r) => (
                                    <TableRow key={r.id_emision}>
                                        <TableCell>{r.folio_sii ? <b>{r.folio_sii}</b> : <Badge variant="outline">Sin folio</Badge>}</TableCell>
                                        <TableCell>{r.tipo_documento || '—'}</TableCell>
                                        <TableCell>N° {r.numero_id}</TableCell>
                                        <TableCell>{fmtFecha(r.fecha_emision)}</TableCell>
                                        <TableCell>
                                            {r.pagada
                                                ? <span className="text-muted-foreground">—</span>
                                                : <span className={`font-semibold ${tramoClass(r.dias_desde_emision)}`}>{r.dias_desde_emision} días</span>}
                                        </TableCell>
                                        <TableCell className="text-right">$ {fmtClp(r.monto_neto)}</TableCell>
                                        <TableCell className="text-right">$ {fmtClp(r.iva)}</TableCell>
                                        <TableCell className="text-right"><b className="tabular-nums">$ {fmtClp(r.monto_total)}</b></TableCell>
                                        <TableCell>
                                            {r.pagada
                                                ? <Badge variant="success">Pagada · {fmtFecha(r.fecha_pago)}</Badge>
                                                : <Badge variant="outline">Sin marcar</Badge>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {!r.pagada && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => { setPagando(r); setFechaPago(hoyStr()); }}
                                                >
                                                    <IconCash size={14} /> Marcar pagada
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </>
            )}

            <Dialog open={pagando !== null} onOpenChange={(open) => { if (!open) setPagando(null); }}>
                <DialogContent className="max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>{pagando ? `Marcar pagada — Folio ${pagando.folio_sii || pagando.id_emision}` : 'Marcar pagada'}</DialogTitle>
                    </DialogHeader>
                    {pagando && (
                        <>
                            <p className="mb-4 text-sm text-muted-foreground">
                                Total de la factura: <b className="text-foreground">$ {fmtClp(pagando.monto_total)}</b>
                            </p>
                            <label className="mb-1.5 block text-xs text-muted-foreground">Fecha del pago</label>
                            <DatePicker value={fechaPago} onChange={setFechaPago} />
                            <p className="mt-1.5 text-xs text-muted-foreground">Queda registrada como fecha de pago de esta factura.</p>
                        </>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPagando(null)}>Cancelar</Button>
                        <Button disabled={guardando} onClick={marcarPagada}>
                            {guardando && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                            Marcar pagada
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default FacturacionEstadoCuenta;
