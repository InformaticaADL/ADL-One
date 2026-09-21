import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    IconRefresh, IconCoin, IconFileInvoice, IconCalendarDollar, IconAlertTriangle,
    IconClockHour4, IconRotate2, IconArrowUpRight,
} from '@tabler/icons-react';
import { facturacionService } from '../services/facturacion.service';
import { useToast } from '../../../contexts/ToastContext';

const ESTADO_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive'> = {
    BORRADOR: 'outline', PDF_GENERADO: 'secondary', ENVIADA: 'secondary', PENDIENTE_OC: 'warning',
    OC_RECIBIDA: 'secondary', EN_EMISION: 'secondary', EMITIDA: 'success', ANULADA: 'destructive',
};
const ESTADO_LABEL: Record<string, string> = {
    BORRADOR: 'Borrador', PDF_GENERADO: 'PDF Generado', ENVIADA: 'Enviada', PENDIENTE_OC: 'Pendiente OC',
    OC_RECIBIDA: 'OC Recibida', EN_EMISION: 'En Emisión', EMITIDA: 'Emitida', ANULADA: 'Anulada',
};

interface Props {
    onNavigate?: (vista: string) => void;
}

const FacturacionDashboard: React.FC<Props> = ({ onNavigate }) => {
    const { showToast } = useToast();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actualizandoUf, setActualizandoUf] = useState(false);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const d = await facturacionService.getDashboard();
            setData(d);
        } catch {
            showToast({ type: 'error', message: 'Error al cargar el dashboard de Facturación' });
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => { cargar(); }, [cargar]);

    const handleActualizarUf = async () => {
        setActualizandoUf(true);
        try {
            const r = await facturacionService.actualizarUf();
            if (r.actualizado) showToast({ type: 'success', message: `UF actualizada: ${r.valor}` });
            else showToast({ type: 'info', message: r.motivo || 'UF ya estaba al día' });
            await cargar();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo actualizar la UF' });
        } finally {
            setActualizandoUf(false);
        }
    };

    const fmtUf = (n: number) => Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtClp = (n: number) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

    if (loading && !data) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">Cargando dashboard…</p>
                </div>
            </div>
        );
    }
    if (!data) {
        return (
            <div className="flex h-full items-center justify-center p-10 text-sm text-muted-foreground">
                No se pudo cargar el dashboard
            </div>
        );
    }

    const totalAlertas = (data.alertas?.oc_demoradas?.length || 0) + (data.alertas?.proximos_a_renovar?.length || 0) + (data.alertas?.uf_desactualizada ? 1 : 0);

    return (
        <div className="shadcn-scope w-full p-6 pb-12 md:px-8">
            <div className="mb-[22px] flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="m-0 text-[22px] font-bold tracking-tight text-foreground">Dashboard de Facturación</h2>
                    <p className="m-0 mt-0.5 text-[13px] text-muted-foreground">Medio Ambiente · en vivo</p>
                </div>
                <Button variant="outline" onClick={cargar}>
                    <IconRefresh size={16} /> Actualizar
                </Button>
            </div>

            {data.alertas?.uf_desactualizada && (
                <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
                    <div className="flex items-center gap-2">
                        <IconAlertTriangle size={16} className="shrink-0 text-warning" />
                        <p className="text-sm text-foreground">El valor de la UF no está actualizado a hoy</p>
                    </div>
                    <Button size="sm" disabled={actualizandoUf} onClick={handleActualizarUf}>
                        {actualizandoUf && <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                        Actualizar UF ahora
                    </Button>
                </div>
            )}

            <div className="mb-5 grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <Card className="p-[18px_20px]">
                    <div className="mb-2.5 flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-primary/10 text-primary">
                        <IconCoin size={18} />
                    </div>
                    <p className="text-xs text-muted-foreground">Pendiente por facturar</p>
                    <p className="mt-0.5 text-xl font-semibold text-foreground">{fmtUf(data.pendiente_facturar?.total_uf || 0)} UF</p>
                    <div className="mt-0.5 text-xs text-muted-foreground">{data.pendiente_facturar?.cantidad || 0} caso(s) listos</div>
                </Card>

                <Card className="p-[18px_20px]">
                    <div className="mb-2.5 flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-success/10 text-success">
                        <IconFileInvoice size={18} />
                    </div>
                    <p className="text-xs text-muted-foreground">Facturado este mes</p>
                    <p className="mt-0.5 text-xl font-semibold text-foreground">$ {fmtClp(data.facturado_mes?.total_clp || 0)}</p>
                    <div className="mt-0.5 text-xs text-muted-foreground">{data.facturado_mes?.cantidad || 0} factura(s) con folio</div>
                </Card>

                <Card className="p-[18px_20px]">
                    <div className="mb-2.5 flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-warning/10 text-warning">
                        <IconCalendarDollar size={18} />
                    </div>
                    <p className="text-xs text-muted-foreground">Valor U.F. vigente</p>
                    <p className="mt-0.5 text-xl font-semibold text-foreground">$ {fmtUf(data.valor_uf_actual?.valor || 0)}</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        {data.valor_uf_actual?.fecha ? new Date(data.valor_uf_actual.fecha).toLocaleDateString('es-CL') : '—'}
                        {data.valor_uf_actual?.fuente === 'BCCH_API' && <Badge variant="secondary" className="text-[10px]">Banco Central</Badge>}
                        {data.valor_uf_actual?.fuente === 'MANUAL' && <Badge variant="outline" className="text-[10px]">Manual</Badge>}
                    </div>
                </Card>

                <Card className="p-[18px_20px]">
                    <div className={`mb-2.5 flex h-[34px] w-[34px] items-center justify-center rounded-[9px] ${totalAlertas > 0 ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                        <IconAlertTriangle size={18} />
                    </div>
                    <p className="text-xs text-muted-foreground">Alertas activas</p>
                    <p className="mt-0.5 text-xl font-semibold text-foreground">{totalAlertas}</p>
                    <div className="mt-0.5 text-xs text-muted-foreground">{totalAlertas === 0 ? 'Todo al día' : 'requieren atención'}</div>
                </Card>
            </div>

            <div className="mb-5">
                <p className="mb-2.5 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Pre-facturas por estado</p>
                {data.prefacturas_por_estado?.length ? (
                    <div className="flex flex-wrap gap-2">
                        {data.prefacturas_por_estado.map((e: any) => (
                            <div key={e.estado} className="flex items-center gap-2 rounded-[10px] border border-border bg-background px-3.5 py-2 text-sm">
                                <Badge variant={ESTADO_VARIANT[e.estado] || 'outline'}>{ESTADO_LABEL[e.estado] || e.estado}</Badge>
                                <b className="font-mono tabular-nums">{e.cantidad}</b>
                                <span className="text-muted-foreground">· {fmtUf(e.total_uf)} UF</span>
                            </div>
                        ))}
                    </div>
                ) : <div className="p-6 text-center text-[13px] text-muted-foreground">Sin pre-facturas todavía.</div>}
            </div>

            <div className="mb-5">
                <p className="mb-2.5 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Órdenes de compra demoradas</p>
                <Card className="overflow-hidden py-0">
                    {data.alertas?.oc_demoradas?.length ? data.alertas.oc_demoradas.map((oc: any) => (
                        <div key={oc.id_prefactura} className="flex items-center justify-between border-b border-border px-3.5 py-2.5 text-sm last:border-b-0">
                            <div>
                                <div className="font-semibold text-foreground">PF #{oc.numero_id} — {oc.nombre_empresaservicios || 'Cliente sin nombre'}</div>
                                <div className="text-xs text-muted-foreground">esperando OC hace {oc.dias_esperando} día(s)</div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Ir a Pre-Facturas"
                                onClick={() => onNavigate?.('fac-prefacturas')}
                            >
                                <IconArrowUpRight size={15} />
                            </Button>
                        </div>
                    )) : <div className="p-6 text-center text-[13px] text-muted-foreground">Ninguna pre-factura demorada esperando OC.</div>}
                </Card>
            </div>

            <div className="mb-5">
                <p className="mb-2.5 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Próximas a renovar</p>
                <Card className="overflow-hidden py-0">
                    {data.alertas?.proximos_a_renovar?.length ? data.alertas.proximos_a_renovar.map((f: any) => (
                        <div key={f.id_fichaingresoservicio} className="flex items-center justify-between border-b border-border px-3.5 py-2.5 text-sm last:border-b-0">
                            <div>
                                <div className="font-semibold text-foreground">{f.nombre_empresaservicios} — {(f.nombre_centro || '').trim()}</div>
                                <div className="text-xs text-muted-foreground">{f.servicios_completados}/{f.total_servicios} visitas completadas · última {f.ultima_fecha_muestreo ? new Date(f.ultima_fecha_muestreo).toLocaleDateString('es-CL') : '—'}</div>
                            </div>
                            <IconClockHour4 size={16} className="text-warning" />
                        </div>
                    )) : <div className="p-6 text-center text-[13px] text-muted-foreground">Sin ciclos recurrentes por vencer.</div>}
                </Card>
            </div>

            {data.antiguedad_emision_sin_marcar_pago?.length > 0 && (
                <div className="mb-5">
                    <p className="mb-2.5 text-[13px] font-bold uppercase tracking-wide text-muted-foreground">Antigüedad de emisión (sin marcar pago)</p>
                    <div className="flex flex-wrap gap-2">
                        {data.antiguedad_emision_sin_marcar_pago.map((t: any) => (
                            <div key={t.tramo} className="flex items-center gap-2 rounded-[10px] border border-border bg-background px-3.5 py-2 text-sm">
                                <IconRotate2 size={14} className="text-muted-foreground" />
                                <span>{t.tramo} días</span>
                                <b>{t.cantidad}</b>
                                <span className="text-muted-foreground">· $ {fmtClp(t.monto_total)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FacturacionDashboard;
