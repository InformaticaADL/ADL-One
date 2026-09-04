import { useEffect, useState } from 'react';
import {
    Table, Tag, Button, Empty, Spin, message, Select, Alert, Space, Modal, DatePicker, Statistic, Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { IconRefresh, IconCash, IconAlertTriangle } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { facturacionService } from '../services/facturacion.service';
import { catalogosService, type EmpresaServicio } from '../../medio-ambiente/services/catalogos.service';

const C = {
    border: '#f0f0f0', text: 'rgba(0,0,0,0.88)', textSec: 'rgba(0,0,0,0.65)', textTer: 'rgba(0,0,0,0.45)',
    primary: '#1677ff', bg: '#ffffff', red: '#cf1322', green: '#389e0d', orange: '#d46b08',
};

const CSS = `
.adl-fec-wrap { width:100%; padding:28px 32px 56px; background:${C.bg}; }
.adl-fec-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; flex-wrap:wrap; gap:12px; }
.adl-fec-title { margin:0; font-size:21px; font-weight:650; color:${C.text}; letter-spacing:-.3px; }
.adl-fec-sub { margin:3px 0 0; font-size:13px; color:${C.textTer}; }
.adl-fec-kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:16px; margin-bottom:24px; max-width:900px; }
.adl-fec-kpi { border:1px solid ${C.border}; border-radius:10px; background:#fff; padding:18px 20px; }
`;

const fmtClp = (n: number) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
const fmtFecha = (v: string | null) => v ? new Date(v).toLocaleDateString('es-CL') : '—';

// Tramos de antigüedad: solo informan hace cuánto se emitió, NO mora — no hay
// fuente de pago automática (ver comentario de la Fase 8 en el servicio).
const tramoColor = (dias: number) => dias > 90 ? C.red : dias > 60 ? C.orange : dias > 30 ? '#8c8c8c' : C.green;

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
    const [empresas, setEmpresas] = useState<EmpresaServicio[]>([]);
    const [idEmpresaSel, setIdEmpresaSel] = useState<number | undefined>();
    const [facturas, setFacturas] = useState<Factura[]>([]);
    const [resumen, setResumen] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const [pagando, setPagando] = useState<Factura | null>(null);
    const [fechaPago, setFechaPago] = useState<dayjs.Dayjs | null>(dayjs());
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const raw: any[] = await catalogosService.getEmpresasServicio();
                setEmpresas(raw.map((e) => ({ id: e.id_empresaservicio, nombre: e.nombre_empresaservicios })));
            } catch {
                message.error('No se pudieron cargar los clientes');
            }
        })();
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
            message.error('No se pudo cargar el estado de cuenta');
        } finally {
            setLoading(false);
        }
    };

    const onEmpresaChange = (val: number) => {
        setIdEmpresaSel(val);
        setFacturas([]);
        setResumen(null);
        cargar(val);
    };

    const marcarPagada = async () => {
        if (!pagando) return;
        setGuardando(true);
        try {
            await facturacionService.marcarFacturaPagada(
                pagando.id_emision,
                fechaPago ? fechaPago.format('YYYY-MM-DD') : undefined);
            message.success(`Factura ${pagando.folio_sii || pagando.id_emision} marcada como pagada`);
            setPagando(null);
            await cargar();
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'No se pudo marcar como pagada');
        } finally {
            setGuardando(false);
        }
    };

    const columns: ColumnsType<Factura> = [
        { title: 'Folio', dataIndex: 'folio_sii', width: 100, render: (v) => v ? <b>{v}</b> : <Tag>Sin folio</Tag> },
        { title: 'Tipo', dataIndex: 'tipo_documento', width: 110, render: (v) => v || '—' },
        { title: 'Pre-factura', dataIndex: 'numero_id', width: 110, render: (v) => `N° ${v}` },
        { title: 'Emisión', dataIndex: 'fecha_emision', width: 110, render: fmtFecha },
        {
            title: 'Antigüedad', dataIndex: 'dias_desde_emision', width: 120,
            render: (v, r) => r.pagada
                ? <span style={{ color: C.textTer }}>—</span>
                : <span style={{ color: tramoColor(v), fontWeight: 600 }}>{v} días</span>,
        },
        { title: 'Neto', dataIndex: 'monto_neto', width: 120, align: 'right', render: (v) => `$ ${fmtClp(v)}` },
        { title: 'IVA', dataIndex: 'iva', width: 110, align: 'right', render: (v) => `$ ${fmtClp(v)}` },
        {
            title: 'Total', dataIndex: 'monto_total', width: 130, align: 'right',
            render: (v) => <b style={{ fontVariantNumeric: 'tabular-nums' }}>$ {fmtClp(v)}</b>,
        },
        {
            title: 'Pago', dataIndex: 'pagada', width: 160,
            render: (v, r) => v
                ? <Tag color="green">Pagada · {fmtFecha(r.fecha_pago)}</Tag>
                : <Tag color="default">Sin marcar</Tag>,
        },
        {
            title: '', width: 130, align: 'right',
            render: (_, r) => r.pagada ? null : (
                <Button size="small" icon={<IconCash size={14} />} onClick={() => { setPagando(r); setFechaPago(dayjs()); }}>
                    Marcar pagada
                </Button>
            ),
        },
    ];

    return (
        <div className="adl-fec-wrap">
            <style>{CSS}</style>

            <div className="adl-fec-header">
                <div>
                    <h2 className="adl-fec-title">Estado de cuenta</h2>
                    <p className="adl-fec-sub">Facturas emitidas por cliente y su antigüedad desde la emisión.</p>
                </div>
                <Space>
                    <Select
                        showSearch
                        style={{ width: 320 }}
                        placeholder="Selecciona un cliente"
                        optionFilterProp="label"
                        value={idEmpresaSel}
                        onChange={onEmpresaChange}
                        options={empresas.map((e) => ({ value: e.id, label: e.nombre }))}
                    />
                    <Button icon={<IconRefresh size={16} />} disabled={!idEmpresaSel} onClick={() => cargar()}>Actualizar</Button>
                </Space>
            </div>

            {/* El estado de pago es MANUAL: no hay integración con el sistema de
                ventas que informe pagos, y decirlo evita que alguien lea estos
                números como una cartola real. */}
            <Alert
                type="info"
                showIcon
                icon={<IconAlertTriangle size={16} />}
                style={{ marginBottom: 22, maxWidth: 900 }}
                message="El pago se marca a mano"
                description="No hay una fuente automática de pagos conectada, así que “sin marcar” significa que nadie lo registró todavía — no necesariamente que esté impago."
            />

            {!idEmpresaSel ? (
                <Empty description="Elige un cliente para ver su estado de cuenta." />
            ) : loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spin /></div>
            ) : (
                <>
                    {resumen && (
                        <div className="adl-fec-kpis">
                            <div className="adl-fec-kpi">
                                <Statistic
                                    title="Total facturado"
                                    value={resumen.total_facturado}
                                    formatter={(v) => `$ ${fmtClp(Number(v))}`}
                                    valueStyle={{ fontSize: 20, color: C.text }}
                                />
                            </div>
                            <div className="adl-fec-kpi">
                                <Statistic
                                    title="Sin marcar como pagado"
                                    value={resumen.total_sin_marcar_pago}
                                    formatter={(v) => `$ ${fmtClp(Number(v))}`}
                                    valueStyle={{ fontSize: 20, color: resumen.total_sin_marcar_pago > 0 ? C.orange : C.green }}
                                />
                            </div>
                            <div className="adl-fec-kpi">
                                <Statistic
                                    title="Facturas sin marcar"
                                    value={resumen.cantidad_sin_marcar_pago}
                                    suffix={`/ ${facturas.length}`}
                                    valueStyle={{ fontSize: 20, color: C.text }}
                                />
                            </div>
                        </div>
                    )}

                    {facturas.length === 0 ? (
                        <Empty description="Este cliente no tiene facturas emitidas con folio registrado." />
                    ) : (
                        <Table<Factura>
                            rowKey="id_emision"
                            columns={columns}
                            dataSource={facturas}
                            size="small"
                            pagination={{ pageSize: 20, size: 'small' }}
                        />
                    )}
                </>
            )}

            <Modal
                title={pagando ? `Marcar pagada — Folio ${pagando.folio_sii || pagando.id_emision}` : 'Marcar pagada'}
                open={pagando !== null}
                onCancel={() => setPagando(null)}
                onOk={marcarPagada}
                confirmLoading={guardando}
                okText="Marcar pagada"
                width={420}
            >
                {pagando && (
                    <>
                        <p style={{ fontSize: 13, color: C.textSec, marginBottom: 16 }}>
                            Total de la factura: <b style={{ color: C.text }}>$ {fmtClp(pagando.monto_total)}</b>
                        </p>
                        <label style={{ display: 'block', fontSize: 12.5, color: C.textSec, marginBottom: 6 }}>Fecha del pago</label>
                        <Tooltip title="Queda registrada como fecha de pago de esta factura">
                            <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" value={fechaPago} onChange={setFechaPago} />
                        </Tooltip>
                    </>
                )}
            </Modal>
        </div>
    );
};

export default FacturacionEstadoCuenta;
