import { useState, useMemo, useEffect } from 'react';
import {
    Steps, Button, DatePicker, Table, Tag, Radio, Select, Input, message, Result,
    Empty, Space, Statistic, Card, Alert, Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
    IconSearch, IconArrowRight, IconArrowLeft, IconCircleCheck, IconFileInvoice, IconEye,
    IconMail, IconWorldUpload,
} from '@tabler/icons-react';
import dayjs, { Dayjs } from 'dayjs';
import { facturacionService } from '../services/facturacion.service';
import API_CONFIG from '../../../config/api.config';
import { catalogosService, type EmpresaServicio, type Centro } from '../../medio-ambiente/services/catalogos.service';
import PdfViewerModal from './PdfViewerModal';

const { RangePicker } = DatePicker;

const C = {
    border: '#f0f0f0', text: 'rgba(0,0,0,0.88)', textSec: 'rgba(0,0,0,0.65)', textTer: 'rgba(0,0,0,0.45)',
    primary: '#1677ff', bg: '#ffffff',
};

type AgrupacionTipo = 'SIN_AGRUPACION' | 'CENTRO' | 'TIPO_AGUA';

interface CasoFacturable {
    id_agendamam: number;
    n_caso: string;
    id_fichaingresoservicio: number;
    id_empresaservicio: number;
    empresaservicio_nombre: string;
    id_empresa: number;
    empresa_nombre: string;
    id_centro: number;
    centro_nombre: string;
    id_tipoagua: string | number;
    fecha_informe: string;
    precio_uf: number;
}

const CSS = `
.adl-fp-wrap { width:100%; padding:24px 32px 48px; }
.adl-fp-title { margin:0 0 4px; font-size:22px; font-weight:700; color:${C.text}; letter-spacing:-.3px; }
.adl-fp-sub { margin:0 0 22px; font-size:13px; color:${C.textTer}; }
.adl-fp-filters { display:flex; align-items:center; gap:10px; margin-bottom:16px; flex-wrap:wrap; }
.adl-fp-footer { display:flex; align-items:center; justify-content:space-between; margin-top:16px; padding-top:16px; border-top:1px solid ${C.border}; }
.adl-fp-selinfo { font-size:13px; color:${C.textSec}; }
.adl-fp-selinfo b { color:${C.text}; font-variant-numeric:tabular-nums; }
.adl-fp-groupcard { border:1px solid ${C.border}; border-radius:10px; padding:14px 16px; margin-bottom:10px; background:${C.bg}; }
.adl-fp-groupname { font-weight:600; font-size:13.5px; color:${C.text}; }
.adl-fp-groupmeta { font-size:12px; color:${C.textTer}; margin-top:2px; }
.adl-fp-radiogroup .ant-radio-wrapper { display:flex; align-items:flex-start; padding:10px 12px; border:1px solid ${C.border}; border-radius:10px; margin:0 0 8px; }
.adl-fp-radiotext { margin-left:4px; }
.adl-fp-radiotitle { font-weight:600; font-size:13.5px; color:${C.text}; }
.adl-fp-radiodesc { font-size:12px; color:${C.textTer}; margin-top:1px; }
`;

const FacturacionProcesar: React.FC = () => {
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [rango, setRango] = useState<[Dayjs, Dayjs] | null>(null);
    const [casos, setCasos] = useState<CasoFacturable[]>([]);
    const [buscado, setBuscado] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [agrupacionTipo, setAgrupacionTipo] = useState<AgrupacionTipo>('SIN_AGRUPACION');
    const [formaPago, setFormaPago] = useState('');
    const [glosa, setGlosa] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [creando, setCreando] = useState(false);
    const [resultado, setResultado] = useState<any[] | null>(null);
    // Entrega inmediata de lo recién creado: PDFs, envío por email y
    // publicación en el portal, sin salir de esta pantalla.
    const [pdfs, setPdfs] = useState<Record<number, any>>({});
    const [publicando, setPublicando] = useState<number | null>(null);
    const [publicadas, setPublicadas] = useState<Record<number, boolean>>({});
    const [enviando, setEnviando] = useState<number | null>(null);
    const [enviadas, setEnviadas] = useState<Record<number, boolean>>({});
    const [cargandoConfig, setCargandoConfig] = useState(false);
    const [previsualizando, setPrevisualizando] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [formasPago, setFormasPago] = useState<{ id_formapago: number; nombre_formapago: string }[]>([]);
    const [glosas, setGlosas] = useState<{ id_glosa: number; nombre_glosa: string }[]>([]);
    const [empresas, setEmpresas] = useState<EmpresaServicio[]>([]);
    const [centros, setCentros] = useState<Centro[]>([]);
    const [idEmpresaServicioFiltro, setIdEmpresaServicioFiltro] = useState<number | undefined>();
    const [idCentroFiltro, setIdCentroFiltro] = useState<number | undefined>();

    useEffect(() => {
        facturacionService.listarFormasPago().then(setFormasPago).catch(() => message.error('No se pudieron cargar las formas de pago'));
        facturacionService.listarGlosas().then(setGlosas).catch(() => message.error('No se pudieron cargar las glosas'));
        catalogosService.getEmpresasServicio()
            .then((raw: any[]) => setEmpresas(raw.map((e) => ({ id: e.id_empresaservicio, nombre: e.nombre_empresaservicios }))))
            .catch(() => message.error('No se pudieron cargar los clientes'));
    }, []);

    const onEmpresaFiltroChange = async (val: number | undefined) => {
        setIdEmpresaServicioFiltro(val);
        setIdCentroFiltro(undefined);
        setCentros([]);
        if (!val) return;
        try {
            const raw: any[] = await catalogosService.getCentros(undefined, val);
            setCentros(raw.map((c) => ({ id: c.id_centro, nombre: c.nombre_centro })));
        } catch { /* noop */ }
    };

    const buscarCasos = async () => {
        setLoading(true);
        setBuscado(true);
        try {
            const filtros: Record<string, any> = {};
            if (rango) {
                filtros.fechaInicio = rango[0].format('YYYY-MM-DD');
                filtros.fechaFin = rango[1].format('YYYY-MM-DD');
            }
            if (idEmpresaServicioFiltro) filtros.idEmpresaServicio = idEmpresaServicioFiltro;
            if (idCentroFiltro) filtros.idCentro = idCentroFiltro;
            const data = await facturacionService.getCasosFacturables(filtros);
            setCasos(data || []);
            setSelectedIds([]);
        } catch {
            message.error('No se pudieron cargar los casos facturables');
        } finally {
            setLoading(false);
        }
    };

    const seleccionados = useMemo(
        () => casos.filter((c) => selectedIds.includes(c.id_agendamam)),
        [casos, selectedIds]
    );
    const totalUfSeleccionado = seleccionados.reduce((s, c) => s + Number(c.precio_uf || 0), 0);

    const grupos = useMemo(() => {
        const map = new Map<string, { empresa: string; sub: string; casos: CasoFacturable[] }>();
        for (const c of seleccionados) {
            const sub = agrupacionTipo === 'CENTRO' ? (c.centro_nombre || 'Sin centro')
                : agrupacionTipo === 'TIPO_AGUA' ? `Tipo agua: ${c.id_tipoagua ?? '—'}`
                : '';
            const key = `${c.id_empresaservicio}::${sub}`;
            if (!map.has(key)) map.set(key, { empresa: c.empresaservicio_nombre, sub, casos: [] });
            map.get(key)!.casos.push(c);
        }
        return Array.from(map.values());
    }, [seleccionados, agrupacionTipo]);

    const columns: ColumnsType<CasoFacturable> = [
        { title: 'N° Caso', dataIndex: 'n_caso', width: 100 },
        { title: 'Cliente', dataIndex: 'empresaservicio_nombre', ellipsis: true },
        { title: 'Centro', dataIndex: 'centro_nombre', ellipsis: true, width: 180 },
        {
            title: 'Fecha informe', dataIndex: 'fecha_informe', width: 130,
            render: (v) => v ? new Date(v).toLocaleDateString('es-CL') : '—',
        },
        {
            title: 'Precio', dataIndex: 'precio_uf', width: 110, align: 'right',
            render: (v) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Number(v).toFixed(2)} UF</span>,
        },
    ];

    /** Al pasar a "Agrupar y configurar": auto-carga forma de pago del cliente (si la selección es de uno solo) y genera una glosa por defecto. */
    const irAConfigurar = async () => {
        setStep(1);
        if (!glosa) {
            const mesAnio = dayjs().format('MMMM YYYY');
            setGlosa(`Servicio de Muestreo y Análisis de Medio Ambiente – ${mesAnio} – ${seleccionados.length} caso(s)`);
        }
        const idsEmpresa = new Set(seleccionados.map((c) => c.id_empresaservicio));
        if (!formaPago && idsEmpresa.size === 1) {
            setCargandoConfig(true);
            try {
                const cfg = await facturacionService.getClienteConfig(seleccionados[0].id_empresaservicio);
                if (cfg?.forma_pago_default) setFormaPago(cfg.forma_pago_default);
            } catch { /* la carga automática es una comodidad, no bloquea el flujo si falla */ }
            finally { setCargandoConfig(false); }
        }
    };

    const previsualizarPdf = async () => {
        setPrevisualizando(true);
        try {
            const response = await fetch(`${API_CONFIG.getBaseURL()}/api/facturacion/prefacturas/preview-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`,
                },
                body: JSON.stringify({ idAgendamamList: selectedIds, agrupacionTipo }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.message || 'No se pudo generar la vista previa');
            }
            const blob = await response.blob();
            setPreviewUrl(URL.createObjectURL(blob));
        } catch (e: any) {
            message.error(e?.message || 'No se pudo generar la vista previa');
        } finally {
            setPrevisualizando(false);
        }
    };

    const confirmar = async () => {
        setCreando(true);
        try {
            const r = await facturacionService.crearPrefacturas({
                idAgendamamList: selectedIds,
                agrupacionTipo,
                formaPago: formaPago || undefined,
                glosa: glosa || undefined,
                observaciones: observaciones || undefined,
            });
            setResultado(r);
            setStep(3);
            message.success('Pre-factura(s) creada(s) correctamente');
            // Se generan los PDF de inmediato para que el documento quede a la
            // vista sin un paso extra: crear la pre-factura y no poder verla
            // era justo donde el proceso se cortaba.
            generarPdfsDeResultado(r);
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'No se pudieron crear las pre-facturas');
        } finally {
            setCreando(false);
        }
    };

    // PDFs listos apenas se crea la pre-factura, para poder abrirlos en el
    // mismo paso. Guarda las rutas por id_prefactura.
    const generarPdfsDeResultado = async (creadas: any[]) => {
        for (const pf of creadas) {
            try {
                const d = await facturacionService.generarPdfs(pf.id_prefactura);
                setPdfs((prev) => ({ ...prev, [pf.id_prefactura]: d }));
            } catch {
                /* si un PDF falla, el resto igual queda disponible */
            }
        }
    };

    const publicar = async (idPrefactura: number, numeroId: number) => {
        setPublicando(idPrefactura);
        try {
            await facturacionService.publicarPrefacturaEnPortal(idPrefactura);
            setPublicadas((prev) => ({ ...prev, [idPrefactura]: true }));
            message.success(`Pre-factura N° ${numeroId} publicada en el portal del cliente`);
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'No se pudo publicar en el portal');
        } finally {
            setPublicando(null);
        }
    };

    const enviarEmail = async (idPrefactura: number, numeroId: number) => {
        setEnviando(idPrefactura);
        try {
            await facturacionService.enviarPorEmail(idPrefactura);
            setEnviadas((prev) => ({ ...prev, [idPrefactura]: true }));
            message.success(`Pre-factura N° ${numeroId} enviada por email`);
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'No se pudo enviar el email');
        } finally {
            setEnviando(null);
        }
    };

    const reiniciar = () => {
        setStep(0); setCasos([]); setSelectedIds([]); setBuscado(false);
        setResultado(null); setAgrupacionTipo('SIN_AGRUPACION'); setFormaPago(''); setGlosa(''); setObservaciones('');
        setPdfs({}); setPublicadas({}); setEnviadas({});
    };

    return (
        <div className="adl-fp-wrap">
            <style>{CSS}</style>
            <h2 className="adl-fp-title">Procesar Facturación</h2>
            <p className="adl-fp-sub">Selecciona casos con informe cerrado, agrúpalos y genera las pre-facturas.</p>

            <Steps
                current={step}
                style={{ marginBottom: 26 }}
                items={[
                    { title: 'Seleccionar casos' },
                    { title: 'Agrupar y configurar' },
                    { title: 'Confirmar' },
                    { title: 'Resultado' },
                ]}
            />

            {step === 0 && (
                <>
                    <div className="adl-fp-filters">
                        <Select
                            allowClear
                            showSearch
                            placeholder="Cliente"
                            style={{ width: 240 }}
                            optionFilterProp="label"
                            value={idEmpresaServicioFiltro}
                            onChange={onEmpresaFiltroChange}
                            options={empresas.map((e) => ({ value: e.id, label: e.nombre }))}
                        />
                        <Select
                            allowClear
                            showSearch
                            placeholder="Centro"
                            style={{ width: 200 }}
                            disabled={!idEmpresaServicioFiltro}
                            optionFilterProp="label"
                            value={idCentroFiltro}
                            onChange={setIdCentroFiltro}
                            options={centros.map((c) => ({ value: c.id, label: c.nombre }))}
                        />
                        <RangePicker
                            value={rango}
                            onChange={(v) => setRango(v as [Dayjs, Dayjs] | null)}
                            placeholder={['Informe desde', 'Informe hasta']}
                        />
                        <Button type="primary" icon={<IconSearch size={15} />} loading={loading} onClick={buscarCasos}>
                            Buscar casos facturables
                        </Button>
                    </div>

                    {!buscado ? (
                        <Empty description="Define un rango de fechas (opcional) y busca los casos facturables." />
                    ) : casos.length === 0 ? (
                        <Empty description="No hay casos facturables con esos filtros." />
                    ) : (
                        <>
                            <Table<CasoFacturable>
                                rowKey="id_agendamam"
                                columns={columns}
                                dataSource={casos}
                                size="small"
                                pagination={{ pageSize: 10, size: 'small' }}
                                rowSelection={{
                                    selectedRowKeys: selectedIds,
                                    onChange: (keys) => setSelectedIds(keys as number[]),
                                }}
                            />
                            <div className="adl-fp-footer">
                                <div className="adl-fp-selinfo">
                                    <b>{selectedIds.length}</b> caso(s) seleccionado(s) · <b>{totalUfSeleccionado.toFixed(2)}</b> UF
                                </div>
                                <Button
                                    type="primary"
                                    disabled={selectedIds.length === 0}
                                    icon={<IconArrowRight size={15} />}
                                    iconPosition="end"
                                    onClick={irAConfigurar}
                                >
                                    Continuar
                                </Button>
                            </div>
                        </>
                    )}
                </>
            )}

            {step === 1 && (
                <>
                    <p className="adl-fp-sub" style={{ marginBottom: 10, fontWeight: 600, color: C.text }}>Agrupación de la(s) pre-factura(s)</p>
                    <Radio.Group
                        className="adl-fp-radiogroup"
                        value={agrupacionTipo}
                        onChange={(e) => setAgrupacionTipo(e.target.value)}
                        style={{ display: 'block', marginBottom: 20 }}
                    >
                        <Radio value="SIN_AGRUPACION">
                            <span className="adl-fp-radiotext">
                                <div className="adl-fp-radiotitle">Sin agrupación (recomendado)</div>
                                <div className="adl-fp-radiodesc">Todos los casos de un mismo cliente van en una sola pre-factura.</div>
                            </span>
                        </Radio>
                        <Radio value="CENTRO">
                            <span className="adl-fp-radiotext">
                                <div className="adl-fp-radiotitle">Por centro</div>
                                <div className="adl-fp-radiodesc">Una pre-factura distinta por cada centro del cliente.</div>
                            </span>
                        </Radio>
                        <Radio value="TIPO_AGUA">
                            <span className="adl-fp-radiotext">
                                <div className="adl-fp-radiotitle">Por tipo de agua</div>
                                <div className="adl-fp-radiodesc">Una pre-factura distinta por cada tipo de agua muestreada.</div>
                            </span>
                        </Radio>
                    </Radio.Group>

                    <p className="adl-fp-sub" style={{ marginBottom: 10, fontWeight: 600, color: C.text }}>Datos adicionales</p>
                    <Space direction="vertical" style={{ width: '100%', marginBottom: 20 }} size={10}>
                        <Select
                            mode="tags"
                            placeholder="Forma de pago"
                            loading={cargandoConfig}
                            showSearch
                            optionFilterProp="label"
                            value={formaPago ? [formaPago] : []}
                            onChange={(v) => setFormaPago(v[v.length - 1] || '')}
                            options={formasPago.map((f) => ({ value: f.nombre_formapago, label: f.nombre_formapago }))}
                            style={{ width: '100%' }}
                        />
                        <Select
                            mode="tags"
                            placeholder="Glosa"
                            showSearch
                            optionFilterProp="label"
                            value={glosa ? [glosa] : []}
                            onChange={(v) => setGlosa(v[v.length - 1] || '')}
                            options={glosas.map((g) => ({ value: g.nombre_glosa, label: g.nombre_glosa }))}
                            style={{ width: '100%' }}
                        />
                        <Input.TextArea placeholder="Observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} />
                    </Space>

                    <div className="adl-fp-footer">
                        <Button icon={<IconArrowLeft size={15} />} onClick={() => setStep(0)}>Atrás</Button>
                        <Space>
                            <Button icon={<IconEye size={15} />} loading={previsualizando} onClick={previsualizarPdf}>
                                Vista previa PDF
                            </Button>
                            <Button type="primary" icon={<IconArrowRight size={15} />} iconPosition="end" onClick={() => setStep(2)}>
                                Continuar
                            </Button>
                        </Space>
                    </div>
                </>
            )}

            {step === 2 && (
                <>
                    <Alert
                        style={{ marginBottom: 16 }}
                        type="info"
                        showIcon
                        message={`Se crearán ${grupos.length} pre-factura(s)`}
                        description="Revisa la agrupación antes de confirmar. Los casos se reclaman de forma exclusiva al crear la pre-factura."
                    />
                    {grupos.map((g, i) => {
                        const totalUf = g.casos.reduce((s, c) => s + Number(c.precio_uf || 0), 0);
                        return (
                            <div key={i} className="adl-fp-groupcard">
                                <div className="adl-fp-groupname">{g.empresa}{g.sub ? ` — ${g.sub}` : ''}</div>
                                <div className="adl-fp-groupmeta">{g.casos.length} caso(s) · {totalUf.toFixed(2)} UF</div>
                            </div>
                        );
                    })}

                    <div className="adl-fp-footer">
                        <Button icon={<IconArrowLeft size={15} />} onClick={() => setStep(1)}>Atrás</Button>
                        <Button type="primary" icon={<IconCircleCheck size={15} />} loading={creando} onClick={confirmar}>
                            Confirmar y crear pre-facturas
                        </Button>
                    </div>
                </>
            )}

            {step === 3 && resultado && (
                <Result
                    status="success"
                    title="Pre-facturas creadas"
                    subTitle={`Se generaron ${resultado.length} pre-factura(s) correctamente.`}
                    extra={[
                        <Button key="reset" onClick={reiniciar}>Procesar más casos</Button>,
                    ]}
                >
                    <Space direction="vertical" style={{ width: '100%' }} size={10}>
                        {resultado.map((r) => {
                            const pdf = pdfs[r.id_prefactura];
                            return (
                                <Card key={r.id_prefactura} size="small">
                                    <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                                        <Space>
                                            <IconFileInvoice size={18} color={C.primary} />
                                            <span style={{ fontWeight: 600 }}>PF #{r.numero_id}</span>
                                            <Tag>{r.agrupacion_valor || 'Sin agrupación'}</Tag>
                                        </Space>
                                        <Statistic value={r.total_uf} precision={2} suffix="UF" valueStyle={{ fontSize: 15 }} />
                                    </Space>

                                    <Space wrap style={{ marginTop: 12 }}>
                                        <Button
                                            size="small"
                                            icon={<IconEye size={14} />}
                                            disabled={!pdf?.pdf_resumen_path}
                                            loading={!pdf}
                                            onClick={() => setPreviewUrl(`${API_CONFIG.getBaseURL()}${pdf.pdf_resumen_path}`)}
                                        >
                                            {pdf ? 'Ver documento' : 'Generando PDF…'}
                                        </Button>
                                        <Button
                                            size="small"
                                            icon={<IconMail size={14} />}
                                            loading={enviando === r.id_prefactura}
                                            disabled={enviadas[r.id_prefactura]}
                                            onClick={() => enviarEmail(r.id_prefactura, r.numero_id)}
                                        >
                                            {enviadas[r.id_prefactura] ? 'Enviada por email' : 'Enviar por email'}
                                        </Button>
                                        <Tooltip title="Queda disponible en ADL WEB GO, donde el cliente puede cargar su OC">
                                            <Button
                                                size="small"
                                                type={publicadas[r.id_prefactura] ? 'default' : 'primary'}
                                                icon={<IconWorldUpload size={14} />}
                                                loading={publicando === r.id_prefactura}
                                                disabled={publicadas[r.id_prefactura]}
                                                onClick={() => publicar(r.id_prefactura, r.numero_id)}
                                            >
                                                {publicadas[r.id_prefactura] ? 'Publicada en el portal' : 'Publicar en el portal'}
                                            </Button>
                                        </Tooltip>
                                    </Space>
                                </Card>
                            );
                        })}
                    </Space>
                </Result>
            )}

            <PdfViewerModal
                open={previewUrl !== null}
                onClose={() => { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}
                url={previewUrl}
                title="Vista previa de facturación"
            />
        </div>
    );
};

export default FacturacionProcesar;
