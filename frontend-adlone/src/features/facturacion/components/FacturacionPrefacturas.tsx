import { useEffect, useState, useCallback } from 'react';
import {
    Table, Tag, Select, Button, Drawer, Descriptions, Empty, Spin, message,
    Modal, Form, Input, DatePicker, Timeline, Statistic, Tooltip, Divider,
    InputNumber, Alert,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
    IconRefresh, IconFileText, IconMail, IconFilePlus, IconExternalLink,
    IconTruck, IconHistory, IconSend2, IconFileExport, IconDownload, IconFolders,
    IconPencil, IconBan, IconTrash,
} from '@tabler/icons-react';
import { facturacionService } from '../services/facturacion.service';
import API_CONFIG from '../../../config/api.config';
import PdfViewerModal from './PdfViewerModal';
import { descargarArchivo } from '../utils/download';

const C = {
    border: '#f0f0f0', text: 'rgba(0,0,0,0.88)', textSec: 'rgba(0,0,0,0.65)', textTer: 'rgba(0,0,0,0.45)',
    primary: '#1677ff', bg: '#ffffff',
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
.adl-fpr-wrap { width:100%; padding:24px 32px 48px; }
.adl-fpr-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:18px; flex-wrap:wrap; gap:12px; }
.adl-fpr-title { margin:0; font-size:22px; font-weight:700; color:${C.text}; letter-spacing:-.3px; }
.adl-fpr-sub { margin:2px 0 0; font-size:13px; color:${C.textTer}; }
.adl-fpr-filters { display:flex; align-items:center; gap:10px; margin-bottom:14px; flex-wrap:wrap; }
.adl-fpr-bulkbar { display:flex; align-items:center; justify-content:space-between; background:#e6f4ff; border:1px solid #91caff; border-radius:8px; padding:8px 14px; margin-bottom:12px; font-size:13px; }
.adl-fpr-drawer-stats { display:flex; gap:24px; margin-bottom:18px; }
.adl-fpr-drawer-actions { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px; }
.adl-fpr-sectitle { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:${C.textTer}; margin:0 0 10px; }
`;

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

const FacturacionPrefacturas: React.FC = () => {
    const [data, setData] = useState<Prefactura[]>([]);
    const [loading, setLoading] = useState(true);
    const [estadoFiltro, setEstadoFiltro] = useState<string | undefined>(undefined);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const [drawerId, setDrawerId] = useState<number | null>(null);
    const [detalle, setDetalle] = useState<any>(null);
    const [detalleLoading, setDetalleLoading] = useState(false);
    const [accionLoading, setAccionLoading] = useState<string | null>(null);

    const [ocModalOpen, setOcModalOpen] = useState(false);
    const [ocForm] = Form.useForm();
    const [emitiendo, setEmitiendo] = useState(false);

    const [lotes, setLotes] = useState<any[]>([]);
    const [lotesVisible, setLotesVisible] = useState(false);
    const [lotesLoading, setLotesLoading] = useState(false);

    // Corrección antes de emitir: editar cabecera, quitar un caso mal incluido
    // o anular entera. El backend bloquea las tres una vez emitida.
    const [editarOpen, setEditarOpen] = useState(false);
    const [editarForm] = Form.useForm();
    const [guardandoEdicion, setGuardandoEdicion] = useState(false);

    const [visorUrl, setVisorUrl] = useState<string | null>(null);
    const [visorTitulo, setVisorTitulo] = useState('');
    const [descargando, setDescargando] = useState<number | null>(null);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const r = await facturacionService.listarPrefacturas(estadoFiltro ? { estado: estadoFiltro } : {});
            setData(r || []);
        } catch {
            message.error('No se pudieron cargar las pre-facturas');
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
            message.error('No se pudo cargar el detalle');
        } finally {
            setDetalleLoading(false);
        }
    };

    const cerrarDetalle = () => { setDrawerId(null); setDetalle(null); };

    // Estados en los que todavía se puede corregir (mismo criterio que el
    // backend: después de emitir, ADL ONE y el Sistema de Ventas quedarían
    // diciendo cosas distintas).
    const EDITABLES = ['BORRADOR', 'PDF_GENERADO', 'ENVIADA', 'PENDIENTE_OC', 'OC_RECIBIDA'];
    const puedeCorregir = detalle && EDITABLES.includes(detalle.estado);

    const abrirEditar = () => {
        editarForm.setFieldsValue({
            glosa: detalle.glosa, glosa_fe: detalle.glosa_fe, observaciones: detalle.observaciones,
            forma_pago: detalle.forma_pago, facturado_por: detalle.facturado_por,
            descuento_uf: Number(detalle.descuento_uf) || 0, ingreso_uf: Number(detalle.ingreso_uf) || 0,
        });
        setEditarOpen(true);
    };

    const guardarEdicion = async () => {
        const values = await editarForm.validateFields();
        setGuardandoEdicion(true);
        try {
            const actualizada = await facturacionService.actualizarPrefactura(drawerId!, values);
            setDetalle(actualizada);
            message.success('Pre-factura corregida');
            setEditarOpen(false);
            await cargar();
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'No se pudo corregir la pre-factura');
        } finally {
            setGuardandoEdicion(false);
        }
    };

    const quitarCaso = (caso: any) => {
        Modal.confirm({
            title: `¿Quitar el caso ${caso.correlativo_caso || caso.id_agendamam}?`,
            content: 'Vuelve a la cola de facturables para incluirlo en otra pre-factura. Se recalculan los totales.',
            okText: 'Quitar', okButtonProps: { danger: true }, cancelText: 'Cancelar',
            onOk: async () => {
                try {
                    const actualizada = await facturacionService.quitarCasoDePrefactura(drawerId!, caso.id_pf_caso);
                    setDetalle(actualizada);
                    message.success('Caso devuelto a la cola de facturables');
                    await cargar();
                } catch (e: any) {
                    message.error(e?.response?.data?.message || 'No se pudo quitar el caso');
                }
            },
        });
    };

    const anular = () => {
        let motivo = '';
        Modal.confirm({
            title: `¿Anular la pre-factura N° ${detalle.numero_id}?`,
            content: (
                <div>
                    <p style={{ marginBottom: 10 }}>
                        Sus {detalle.casos?.length || 0} caso(s) vuelven a la cola de facturables. La pre-factura queda anulada, no se borra.
                    </p>
                    <Input placeholder="Motivo de la anulación" onChange={(e) => { motivo = e.target.value; }} />
                </div>
            ),
            okText: 'Anular', okButtonProps: { danger: true }, cancelText: 'Cancelar',
            onOk: async () => {
                if (!motivo.trim()) { message.warning('Indica el motivo de la anulación'); return Promise.reject(); }
                try {
                    const r = await facturacionService.anularPrefactura(drawerId!, motivo.trim());
                    message.success(`Pre-factura anulada · ${r.casos_liberados} caso(s) liberado(s)`);
                    cerrarDetalle();
                    await cargar();
                } catch (e: any) {
                    message.error(e?.response?.data?.message || 'No se pudo anular');
                    return Promise.reject();
                }
            },
        });
    };

    const refrescarDetalle = async () => { if (drawerId) await abrirDetalle(drawerId); };

    const baseUrl = API_CONFIG.getBaseURL();

    const generarPdf = async () => {
        if (!drawerId) return;
        setAccionLoading('pdf');
        try {
            await facturacionService.generarPdfs(drawerId);
            message.success('PDF generado');
            await refrescarDetalle();
            await cargar();
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'No se pudo generar el PDF');
        } finally {
            setAccionLoading(null);
        }
    };

    const enviarEmail = async () => {
        if (!drawerId) return;
        setAccionLoading('email');
        try {
            await facturacionService.enviarPorEmail(drawerId);
            message.success('Pre-factura enviada por email');
            await refrescarDetalle();
            await cargar();
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'No se pudo enviar el email');
        } finally {
            setAccionLoading(null);
        }
    };

    const registrarOc = async () => {
        if (!drawerId) return;
        try {
            const values = await ocForm.validateFields();
            setAccionLoading('oc');
            const r = await facturacionService.registrarOrdenCompra(drawerId, {
                numeroOc: values.numeroOc,
                fechaOc: values.fechaOc ? values.fechaOc.format('YYYY-MM-DD') : undefined,
                referencia: values.referencia,
                numeroHes: values.numeroHes,
                fechaHes: values.fechaHes ? values.fechaHes.format('YYYY-MM-DD') : undefined,
                observaciones: values.observaciones,
            });
            // El HES faltante avisa, no bloquea: la OC igual quedó registrada.
            if (r?.aviso_hes) {
                message.warning({ content: r.aviso_hes, duration: 8 });
            } else {
                message.success('Orden de compra registrada');
            }
            setOcModalOpen(false);
            ocForm.resetFields();
            await refrescarDetalle();
            await cargar();
        } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.response?.data?.message || 'No se pudo registrar la OC');
        } finally {
            setAccionLoading(null);
        }
    };

    const cargarLotes = async () => {
        setLotesLoading(true);
        try {
            setLotes(await facturacionService.listarLotesEmision());
        } catch {
            message.error('No se pudieron cargar los archivos de emisión');
        } finally {
            setLotesLoading(false);
        }
    };

    const generarArchivoPlanoSeleccion = async () => {
        if (selectedIds.length === 0) return;
        setEmitiendo(true);
        try {
            const r = await facturacionService.generarArchivoPlano(selectedIds);
            message.success(`Archivo generado: ${r.nombre_archivo} (${r.cantidad_prefacturas} pre-factura(s))`);
            // Avisos que no impiden emitir pero conviene resolver (ej. HES
            // faltante en un cliente que lo exige: el Sistema de Ventas lo
            // rechazaría después sin explicar el motivo).
            if (r?.avisos?.length) {
                Modal.warning({
                    title: 'El archivo se generó, pero revisa esto',
                    width: 560,
                    content: (
                        <ul style={{ paddingLeft: 18, margin: '10px 0 0' }}>
                            {r.avisos.map((a: string, i: number) => <li key={i} style={{ marginBottom: 6 }}>{a}</li>)}
                        </ul>
                    ),
                });
            }
            setSelectedIds([]);
            await cargar();
            if (lotesVisible) await cargarLotes();
            await descargarArchivo(`${baseUrl}${r.archivo_path}`, r.nombre_archivo);
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'No se pudo generar el archivo plano');
        } finally {
            setEmitiendo(false);
        }
    };

    const columns: ColumnsType<Prefactura> = [
        { title: 'N°', dataIndex: 'numero_id', width: 90, render: (v) => <b>{v}</b> },
        { title: 'Cliente', dataIndex: 'nombre_empresaservicios', ellipsis: true },
        {
            title: 'Agrupación', dataIndex: 'agrupacion_valor', width: 160,
            render: (v, r) => v || (r.agrupacion_tipo === 'SIN_AGRUPACION' ? 'Sin agrupación' : r.agrupacion_tipo),
        },
        { title: 'Casos', dataIndex: 'cantidad_casos', width: 70, align: 'right' },
        {
            title: 'Total', dataIndex: 'total_uf', width: 130, align: 'right',
            render: (v, r) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUf(v)} UF<br /><span style={{ fontSize: 11, color: C.textTer }}>$ {fmtClp(r.total_clp)}</span></span>,
        },
        {
            title: 'Estado', dataIndex: 'estado', width: 130,
            render: (v) => <Tag color={ESTADO_COLOR[v] || 'default'}>{ESTADO_LABEL[v] || v}</Tag>,
        },
        {
            title: 'OC', dataIndex: 'cantidad_oc', width: 60, align: 'center',
            render: (v) => v > 0 ? <Tag color="cyan">{v}</Tag> : '—',
        },
        { title: 'Creada', dataIndex: 'fecha_creacion', width: 110, render: fmtFecha },
    ];

    const seleccionables = data.filter((p) => ['OC_RECIBIDA', 'ENVIADA'].includes(p.estado));

    return (
        <div className="adl-fpr-wrap">
            <style>{CSS}</style>

            <div className="adl-fpr-header">
                <div>
                    <h2 className="adl-fpr-title">Pre-Facturas</h2>
                    <p className="adl-fpr-sub">Listado, detalle, PDF, órdenes de compra y emisión.</p>
                </div>
                <Button icon={<IconRefresh size={16} />} onClick={cargar}>Actualizar</Button>
            </div>

            <div className="adl-fpr-filters">
                <Select
                    allowClear
                    placeholder="Filtrar por estado"
                    style={{ width: 220 }}
                    value={estadoFiltro}
                    onChange={setEstadoFiltro}
                    options={Object.entries(ESTADO_LABEL).map(([value, label]) => ({ value, label }))}
                />
            </div>

            {selectedIds.length > 0 && (
                <div className="adl-fpr-bulkbar">
                    <span><b>{selectedIds.length}</b> pre-factura(s) seleccionada(s) para emisión</span>
                    <Button
                        type="primary"
                        size="small"
                        icon={<IconFileExport size={14} />}
                        loading={emitiendo}
                        onClick={generarArchivoPlanoSeleccion}
                    >
                        Generar archivo plano
                    </Button>
                </div>
            )}

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spin /></div>
            ) : data.length === 0 ? (
                <Empty description="No hay pre-facturas con ese filtro." />
            ) : (
                <Table<Prefactura>
                    rowKey="id_prefactura"
                    columns={columns}
                    dataSource={data}
                    size="small"
                    pagination={{ pageSize: 15, size: 'small' }}
                    onRow={(r) => ({ onClick: () => abrirDetalle(r.id_prefactura), style: { cursor: 'pointer' } })}
                    rowSelection={{
                        selectedRowKeys: selectedIds,
                        onChange: (keys) => setSelectedIds(keys as number[]),
                        getCheckboxProps: (r) => ({ disabled: !['OC_RECIBIDA', 'ENVIADA'].includes(r.estado) }),
                    }}
                />
            )}
            {!loading && seleccionables.length === 0 && data.length > 0 && (
                <p style={{ fontSize: 12, color: C.textTer, marginTop: 8 }}>
                    Solo pueden emitirse pre-facturas en estado "OC Recibida" o "Enviada" (sin OC requerida).
                </p>
            )}

            <Divider />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: lotesVisible ? 12 : 0 }}>
                <Button
                    type="text"
                    icon={<IconFolders size={15} />}
                    onClick={() => { const next = !lotesVisible; setLotesVisible(next); if (next && lotes.length === 0) cargarLotes(); }}
                >
                    Archivos de emisión generados
                </Button>
            </div>
            {lotesVisible && (
                lotesLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><Spin /></div>
                ) : lotes.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aún no se ha generado ningún archivo plano." />
                ) : (
                    <Table
                        size="small"
                        pagination={{ pageSize: 10, size: 'small' }}
                        rowKey="id_lote"
                        dataSource={lotes}
                        columns={[
                            { title: 'Archivo', dataIndex: 'nombre_archivo' },
                            { title: 'Pre-facturas', dataIndex: 'cantidad_prefacturas', width: 110, align: 'right' },
                            { title: 'Estado', dataIndex: 'estado', width: 130, render: (v) => <Tag>{v}</Tag> },
                            { title: 'Generado', dataIndex: 'fecha_creacion', width: 160, render: fmtFechaHora },
                            {
                                title: '', width: 110,
                                render: (_, r: any) => (
                                    <Button
                                        size="small"
                                        icon={<IconDownload size={13} />}
                                        loading={descargando === r.id_lote}
                                        onClick={async () => {
                                            setDescargando(r.id_lote);
                                            try {
                                                await descargarArchivo(`${baseUrl}${r.archivo_path}`, r.nombre_archivo);
                                            } catch {
                                                message.error('No se pudo descargar el archivo');
                                            } finally {
                                                setDescargando(null);
                                            }
                                        }}
                                    >
                                        Descargar
                                    </Button>
                                ),
                            },
                        ]}
                    />
                )
            )}

            <Drawer
                title={detalle ? `Pre-Factura N° ${detalle.numero_id}` : 'Detalle'}
                width={620}
                open={drawerId !== null}
                onClose={cerrarDetalle}
                extra={detalle && <Tag color={ESTADO_COLOR[detalle.estado] || 'default'}>{ESTADO_LABEL[detalle.estado] || detalle.estado}</Tag>}
            >
                {detalleLoading || !detalle ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spin /></div>
                ) : (
                    <>
                        <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
                            <Descriptions.Item label="Cliente" span={2}>{detalle.nombre_empresaservicios}</Descriptions.Item>
                            <Descriptions.Item label="Agrupación">{detalle.agrupacion_valor || detalle.agrupacion_tipo}</Descriptions.Item>
                            <Descriptions.Item label="Valor UF">{fmtUf(detalle.valor_uf)}</Descriptions.Item>
                            <Descriptions.Item label="Creada">{fmtFecha(detalle.fecha_creacion)}</Descriptions.Item>
                            <Descriptions.Item label="Email enviado">{detalle.email_enviado ? fmtFecha(detalle.fecha_email) : 'No'}</Descriptions.Item>
                        </Descriptions>

                        <div className="adl-fpr-drawer-stats">
                            <Statistic title="Total UF" value={detalle.total_uf} precision={2} suffix="UF" valueStyle={{ fontSize: 18 }} />
                            <Statistic title="Total CLP" value={detalle.total_clp} formatter={(v) => `$ ${fmtClp(Number(v))}`} valueStyle={{ fontSize: 18 }} />
                            <Statistic title="Casos" value={detalle.casos?.length || 0} valueStyle={{ fontSize: 18 }} />
                        </div>

                        <div className="adl-fpr-drawer-actions">
                            <Button size="small" icon={<IconFileText size={14} />} loading={accionLoading === 'pdf'} onClick={generarPdf}>
                                Generar PDF
                            </Button>
                            {detalle.pdf_resumen_path && (
                                <Tooltip title="Ver PDF resumen">
                                    <Button
                                        size="small"
                                        icon={<IconExternalLink size={14} />}
                                        onClick={() => { setVisorTitulo(`Pre-Factura N° ${detalle.numero_id} — Resumen`); setVisorUrl(`${baseUrl}${detalle.pdf_resumen_path}`); }}
                                    >
                                        PDF resumen
                                    </Button>
                                </Tooltip>
                            )}
                            {detalle.pdf_detalle_path && (
                                <Tooltip title="Ver PDF detalle">
                                    <Button
                                        size="small"
                                        icon={<IconExternalLink size={14} />}
                                        onClick={() => { setVisorTitulo(`Pre-Factura N° ${detalle.numero_id} — Detalle`); setVisorUrl(`${baseUrl}${detalle.pdf_detalle_path}`); }}
                                    >
                                        PDF detalle
                                    </Button>
                                </Tooltip>
                            )}
                            <Button size="small" icon={<IconMail size={14} />} loading={accionLoading === 'email'} onClick={enviarEmail}>
                                Enviar por email
                            </Button>
                            <Button size="small" icon={<IconTruck size={14} />} onClick={() => setOcModalOpen(true)}>
                                Registrar OC/HES
                            </Button>
                            {puedeCorregir && (
                                <>
                                    <Tooltip title="Corregir glosa, forma de pago, observaciones o descuentos">
                                        <Button size="small" icon={<IconPencil size={14} />} onClick={abrirEditar}>Corregir</Button>
                                    </Tooltip>
                                    <Tooltip title="Anula la pre-factura y devuelve sus casos a la cola de facturables">
                                        <Button size="small" danger icon={<IconBan size={14} />} onClick={anular}>Anular</Button>
                                    </Tooltip>
                                </>
                            )}
                        </div>
                        {!puedeCorregir && detalle.estado !== 'ANULADA' && (
                            <Alert
                                type="info"
                                showIcon
                                style={{ marginBottom: 16 }}
                                message="Ya no se puede corregir"
                                description="La pre-factura fue emitida o está en emisión: modificarla acá dejaría ADL ONE y el Sistema de Ventas con datos distintos."
                            />
                        )}

                        <Divider style={{ margin: '4px 0 16px' }} />

                        <p className="adl-fpr-sectitle">Casos incluidos ({detalle.casos?.length || 0})</p>
                        <Table
                            size="small"
                            pagination={false}
                            rowKey="id_pf_caso"
                            dataSource={detalle.casos || []}
                            style={{ marginBottom: 20 }}
                            columns={[
                                { title: 'N° Caso', dataIndex: 'correlativo_caso', width: 110 },
                                { title: 'Centro', dataIndex: 'nombre_centro', ellipsis: true },
                                { title: 'UF', dataIndex: 'precio_venta_uf', width: 80, align: 'right', render: (v) => fmtUf(v) },
                                ...(puedeCorregir && (detalle.casos?.length || 0) > 1 ? [{
                                    title: '', width: 40, align: 'center' as const,
                                    render: (_: any, r: any) => (
                                        <Tooltip title="Quitar de esta pre-factura y devolverlo a la cola">
                                            <Button size="small" type="text" danger icon={<IconTrash size={13} />} onClick={() => quitarCaso(r)} />
                                        </Tooltip>
                                    ),
                                }] : []),
                            ]}
                        />

                        <p className="adl-fpr-sectitle">Órdenes de compra / HES ({detalle.ordenes_compra?.length || 0})</p>
                        {detalle.ordenes_compra?.length ? (
                            <Table
                                size="small"
                                pagination={false}
                                rowKey="id_orden_compra"
                                dataSource={detalle.ordenes_compra}
                                style={{ marginBottom: 20 }}
                                columns={[
                                    { title: 'N° OC', dataIndex: 'numero_oc', width: 110 },
                                    { title: 'Fecha OC', dataIndex: 'fecha_oc', width: 100, render: fmtFecha },
                                    { title: 'N° HES', dataIndex: 'numero_hes', render: (v) => v || '—' },
                                ]}
                            />
                        ) : <Empty style={{ marginBottom: 20 }} image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin OC registradas" />}

                        <p className="adl-fpr-sectitle"><IconHistory size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Historial</p>
                        <Timeline
                            items={(detalle.historial || []).map((h: any) => ({
                                children: (
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 600 }}>{h.descripcion || h.accion}</div>
                                        <div style={{ fontSize: 11, color: C.textTer }}>{fmtFechaHora(h.fecha)}</div>
                                    </div>
                                ),
                            }))}
                        />
                    </>
                )}
            </Drawer>

            <Modal
                title="Registrar Orden de Compra / HES"
                open={ocModalOpen}
                onCancel={() => setOcModalOpen(false)}
                onOk={registrarOc}
                confirmLoading={accionLoading === 'oc'}
                okText="Registrar"
                okButtonProps={{ icon: <IconSend2 size={14} /> }}
            >
                <Form form={ocForm} layout="vertical">
                    <Form.Item name="numeroOc" label="N° Orden de Compra" rules={[{ required: true, message: 'Requerido' }]}>
                        <Input placeholder="Ej: 4500123456" />
                    </Form.Item>
                    <Form.Item name="fechaOc" label="Fecha OC">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="referencia" label="Referencia">
                        <Input placeholder="Opcional" />
                    </Form.Item>
                    <Form.Item name="numeroHes" label="N° HES (si corresponde)">
                        <Input placeholder="Opcional" />
                    </Form.Item>
                    <Form.Item name="fechaHes" label="Fecha HES">
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="observaciones" label="Observaciones">
                        <Input.TextArea rows={2} />
                    </Form.Item>
                </Form>
            </Modal>

            <Modal
                title={detalle ? `Corregir Pre-Factura N° ${detalle.numero_id}` : 'Corregir'}
                open={editarOpen}
                onCancel={() => setEditarOpen(false)}
                onOk={guardarEdicion}
                confirmLoading={guardandoEdicion}
                okText="Guardar cambios"
                width={540}
            >
                <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="Los PDF ya generados se invalidan"
                    description="Hay que volver a generarlos para que reflejen la corrección; así nadie envía por correo la versión antigua."
                />
                <Form form={editarForm} layout="vertical">
                    <Form.Item name="glosa" label="Glosa">
                        <Input />
                    </Form.Item>
                    <Form.Item name="glosa_fe" label="Glosa factura electrónica">
                        <Input />
                    </Form.Item>
                    <Form.Item name="forma_pago" label="Forma de pago">
                        <Input />
                    </Form.Item>
                    <Form.Item name="facturado_por" label="Facturado por">
                        <Input />
                    </Form.Item>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Form.Item name="descuento_uf" label="Descuento (UF)">
                            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item name="ingreso_uf" label="Ingreso adicional (UF)">
                            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
                        </Form.Item>
                    </div>
                    <Form.Item name="observaciones" label="Observaciones">
                        <Input.TextArea rows={2} />
                    </Form.Item>
                </Form>
            </Modal>

            <PdfViewerModal open={visorUrl !== null} onClose={() => setVisorUrl(null)} url={visorUrl} title={visorTitulo} />
        </div>
    );
};

export default FacturacionPrefacturas;
