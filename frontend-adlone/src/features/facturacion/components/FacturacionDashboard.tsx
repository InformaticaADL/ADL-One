import { useEffect, useState, useCallback } from 'react';
import {
    Statistic, Card, Alert, Tag, Button, Spin, Empty, Tooltip, message,
} from 'antd';
import {
    IconRefresh, IconCoin, IconFileInvoice, IconCalendarDollar, IconAlertTriangle,
    IconClockHour4, IconRotate2, IconArrowUpRight,
} from '@tabler/icons-react';
import { facturacionService } from '../services/facturacion.service';

const C = {
    border: '#f0f0f0', text: 'rgba(0,0,0,0.88)', textSec: 'rgba(0,0,0,0.65)', textTer: 'rgba(0,0,0,0.45)',
    primary: '#1677ff', primaryBg: '#e6f4ff', bg: '#ffffff',
    green: '#389e0d', greenBg: '#f6ffed', orange: '#d46b08', orangeBg: '#fff7e6',
    red: '#cf1322', redBg: '#fff1f0',
};

const ESTADO_COLOR: Record<string, string> = {
    BORRADOR: 'default', PDF_GENERADO: 'blue', ENVIADA: 'blue', PENDIENTE_OC: 'gold',
    OC_RECIBIDA: 'cyan', EN_EMISION: 'purple', EMITIDA: 'green', ANULADA: 'red',
};
const ESTADO_LABEL: Record<string, string> = {
    BORRADOR: 'Borrador', PDF_GENERADO: 'PDF Generado', ENVIADA: 'Enviada', PENDIENTE_OC: 'Pendiente OC',
    OC_RECIBIDA: 'OC Recibida', EN_EMISION: 'En Emisión', EMITIDA: 'Emitida', ANULADA: 'Anulada',
};

const CSS = `
.adl-fd-wrap { width:100%; padding:24px 32px 48px; }
.adl-fd-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:22px; flex-wrap:wrap; gap:12px; }
.adl-fd-title { margin:0; font-size:22px; font-weight:700; color:${C.text}; letter-spacing:-.3px; }
.adl-fd-sub { margin:2px 0 0; font-size:13px; color:${C.textTer}; }
.adl-fd-kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:14px; margin-bottom:20px; }
.adl-fd-kpi { border-radius:12px; }
.adl-fd-kpi .ant-card-body { padding:18px 20px; }
.adl-fd-kpiicon { width:34px; height:34px; border-radius:9px; display:flex; align-items:center; justify-content:center; margin-bottom:10px; }
.adl-fd-section { margin-bottom:20px; }
.adl-fd-sectitle { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:${C.textTer}; margin:0 0 10px; }
.adl-fd-pipeline { display:flex; flex-wrap:wrap; gap:8px; }
.adl-fd-pipeitem { display:flex; align-items:center; column-gap:8px; background:${C.bg}; border:1px solid ${C.border}; border-radius:10px; padding:8px 14px; font-size:13px; }
.adl-fd-pipeitem b { font-family:'IBM Plex Mono', monospace; font-variant-numeric:tabular-nums; }
.adl-fd-alertrow { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid ${C.border}; font-size:13px; }
.adl-fd-alertrow:last-child { border-bottom:none; }
.adl-fd-alertname { font-weight:600; color:${C.text}; }
.adl-fd-alertmeta { color:${C.textTer}; font-size:12px; }
.adl-fd-empty { padding:24px; text-align:center; color:${C.textTer}; font-size:13px; }
`;

interface Props {
    onNavigate?: (vista: string) => void;
}

const FacturacionDashboard: React.FC<Props> = ({ onNavigate }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actualizandoUf, setActualizandoUf] = useState(false);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const d = await facturacionService.getDashboard();
            setData(d);
        } catch {
            message.error('Error al cargar el dashboard de Facturación');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const handleActualizarUf = async () => {
        setActualizandoUf(true);
        try {
            const r = await facturacionService.actualizarUf();
            if (r.actualizado) message.success(`UF actualizada: ${r.valor}`);
            else message.info(r.motivo || 'UF ya estaba al día');
            await cargar();
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'No se pudo actualizar la UF');
        } finally {
            setActualizandoUf(false);
        }
    };

    const fmtUf = (n: number) => Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtClp = (n: number) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

    if (loading && !data) {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Spin size="large" description="Cargando dashboard…"><div style={{ padding: 60 }} /></Spin></div>;
    }
    if (!data) {
        return <div className="adl-fd-empty"><Empty description="No se pudo cargar el dashboard" /></div>;
    }

    const totalAlertas = (data.alertas?.oc_demoradas?.length || 0) + (data.alertas?.proximos_a_renovar?.length || 0) + (data.alertas?.uf_desactualizada ? 1 : 0);

    return (
        <div className="adl-fd-wrap">
            <style>{CSS}</style>

            <div className="adl-fd-header">
                <div>
                    <h2 className="adl-fd-title">Dashboard de Facturación</h2>
                    <p className="adl-fd-sub">Medio Ambiente · en vivo</p>
                </div>
                <Button icon={<IconRefresh size={16} />} onClick={cargar}>Actualizar</Button>
            </div>

            {data.alertas?.uf_desactualizada && (
                <Alert
                    style={{ marginBottom: 18 }}
                    type="warning"
                    showIcon
                    icon={<IconAlertTriangle size={16} />}
                    message="El valor de la UF no está actualizado a hoy"
                    action={
                        <Button size="small" type="primary" loading={actualizandoUf} onClick={handleActualizarUf}>
                            Actualizar UF ahora
                        </Button>
                    }
                />
            )}

            <div className="adl-fd-kpis">
                <Card className="adl-fd-kpi">
                    <div className="adl-fd-kpiicon" style={{ background: C.primaryBg, color: C.primary }}><IconCoin size={18} /></div>
                    <Statistic
                        title="Pendiente por facturar"
                        value={data.pendiente_facturar?.total_uf || 0}
                        precision={2}
                        suffix="UF"
                    />
                    <div style={{ fontSize: 12, color: C.textTer, marginTop: 2 }}>{data.pendiente_facturar?.cantidad || 0} caso(s) listos</div>
                </Card>

                <Card className="adl-fd-kpi">
                    <div className="adl-fd-kpiicon" style={{ background: C.greenBg, color: C.green }}><IconFileInvoice size={18} /></div>
                    <Statistic
                        title="Facturado este mes"
                        value={data.facturado_mes?.total_clp || 0}
                        formatter={(v) => `$ ${fmtClp(Number(v))}`}
                    />
                    <div style={{ fontSize: 12, color: C.textTer, marginTop: 2 }}>{data.facturado_mes?.cantidad || 0} factura(s) con folio</div>
                </Card>

                <Card className="adl-fd-kpi">
                    <div className="adl-fd-kpiicon" style={{ background: C.orangeBg, color: C.orange }}><IconCalendarDollar size={18} /></div>
                    <Statistic
                        title="Valor U.F. vigente"
                        value={data.valor_uf_actual?.valor || 0}
                        formatter={(v) => `$ ${fmtUf(Number(v))}`}
                    />
                    <div style={{ fontSize: 12, color: C.textTer, marginTop: 2 }}>
                        {data.valor_uf_actual?.fecha ? new Date(data.valor_uf_actual.fecha).toLocaleDateString('es-CL') : '—'}
                        {data.valor_uf_actual?.fuente === 'BCCH_API' && <Tag color="blue" style={{ marginLeft: 6, fontSize: 10 }}>Banco Central</Tag>}
                        {data.valor_uf_actual?.fuente === 'MANUAL' && <Tag style={{ marginLeft: 6, fontSize: 10 }}>Manual</Tag>}
                    </div>
                </Card>

                <Card className="adl-fd-kpi">
                    <div className="adl-fd-kpiicon" style={{ background: totalAlertas > 0 ? C.redBg : C.greenBg, color: totalAlertas > 0 ? C.red : C.green }}>
                        <IconAlertTriangle size={18} />
                    </div>
                    <Statistic title="Alertas activas" value={totalAlertas} />
                    <div style={{ fontSize: 12, color: C.textTer, marginTop: 2 }}>{totalAlertas === 0 ? 'Todo al día' : 'requieren atención'}</div>
                </Card>
            </div>

            <div className="adl-fd-section">
                <p className="adl-fd-sectitle">Pre-facturas por estado</p>
                {data.prefacturas_por_estado?.length ? (
                    <div className="adl-fd-pipeline">
                        {data.prefacturas_por_estado.map((e: any) => (
                            <div key={e.estado} className="adl-fd-pipeitem">
                                <Tag color={ESTADO_COLOR[e.estado] || 'default'} style={{ marginInlineEnd: 0 }}>
                                    {ESTADO_LABEL[e.estado] || e.estado}
                                </Tag>
                                <b>{e.cantidad}</b>
                                <span style={{ color: C.textTer }}>· {fmtUf(e.total_uf)} UF</span>
                            </div>
                        ))}
                    </div>
                ) : <div className="adl-fd-empty">Sin pre-facturas todavía.</div>}
            </div>

            <div className="adl-fd-section">
                <p className="adl-fd-sectitle">Órdenes de compra demoradas</p>
                <Card styles={{ body: { padding: 0 } }}>
                    {data.alertas?.oc_demoradas?.length ? data.alertas.oc_demoradas.map((oc: any) => (
                        <div key={oc.id_prefactura} className="adl-fd-alertrow">
                            <div>
                                <div className="adl-fd-alertname">PF #{oc.numero_id} — {oc.nombre_empresaservicios || 'Cliente sin nombre'}</div>
                                <div className="adl-fd-alertmeta">esperando OC hace {oc.dias_esperando} día(s)</div>
                            </div>
                            <Tooltip title="Ir a Pre-Facturas">
                                <Button size="small" type="text" icon={<IconArrowUpRight size={15} />} onClick={() => onNavigate?.('prefacturas')} />
                            </Tooltip>
                        </div>
                    )) : <div className="adl-fd-empty">Ninguna pre-factura demorada esperando OC.</div>}
                </Card>
            </div>

            <div className="adl-fd-section">
                <p className="adl-fd-sectitle">Próximas a renovar</p>
                <Card styles={{ body: { padding: 0 } }}>
                    {data.alertas?.proximos_a_renovar?.length ? data.alertas.proximos_a_renovar.map((f: any) => (
                        <div key={f.id_fichaingresoservicio} className="adl-fd-alertrow">
                            <div>
                                <div className="adl-fd-alertname">{f.nombre_empresaservicios} — {(f.nombre_centro || '').trim()}</div>
                                <div className="adl-fd-alertmeta">{f.servicios_completados}/{f.total_servicios} visitas completadas · última {f.ultima_fecha_muestreo ? new Date(f.ultima_fecha_muestreo).toLocaleDateString('es-CL') : '—'}</div>
                            </div>
                            <IconClockHour4 size={16} color={C.orange} />
                        </div>
                    )) : <div className="adl-fd-empty">Sin ciclos recurrentes por vencer.</div>}
                </Card>
            </div>

            {data.antiguedad_emision_sin_marcar_pago?.length > 0 && (
                <div className="adl-fd-section">
                    <p className="adl-fd-sectitle">Antigüedad de emisión (sin marcar pago)</p>
                    <div className="adl-fd-pipeline">
                        {data.antiguedad_emision_sin_marcar_pago.map((t: any) => (
                            <div key={t.tramo} className="adl-fd-pipeitem">
                                <IconRotate2 size={14} color={C.textTer} />
                                <span>{t.tramo} días</span>
                                <b>{t.cantidad}</b>
                                <span style={{ color: C.textTer }}>· $ {fmtClp(t.monto_total)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FacturacionDashboard;
