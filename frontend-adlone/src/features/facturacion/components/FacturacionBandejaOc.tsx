import { useEffect, useState, useCallback, useRef } from 'react';
import {
    Table, Tag, Button, Empty, Spin, message, Modal, Input, DatePicker, Select, Alert, Space, Tooltip, Switch,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
    IconRefresh, IconUpload, IconCircleCheck, IconCircleX, IconFileTypePdf, IconSparkles,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { facturacionService } from '../services/facturacion.service';
import { catalogosService, type EmpresaServicio } from '../../medio-ambiente/services/catalogos.service';
import PdfViewerModal from './PdfViewerModal';
import API_CONFIG from '../../../config/api.config';

const C = {
    border: '#f0f0f0', text: 'rgba(0,0,0,0.88)', textSec: 'rgba(0,0,0,0.65)', textTer: 'rgba(0,0,0,0.45)',
    primary: '#1677ff', bg: '#ffffff',
};

const CSS = `
.adl-foc-wrap { width:100%; padding:28px 32px 56px; background:${C.bg}; }
.adl-foc-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:24px; flex-wrap:wrap; gap:12px; }
.adl-foc-title { margin:0; font-size:21px; font-weight:650; color:${C.text}; letter-spacing:-.3px; }
.adl-foc-sub { margin:3px 0 0; font-size:13px; color:${C.textTer}; }
.adl-foc-field { margin-bottom:16px; }
.adl-foc-field label { display:block; font-size:12.5px; color:${C.textSec}; margin-bottom:6px; }
`;

const fmtFecha = (v: string | null) => v ? new Date(v).toLocaleDateString('es-CL') : '—';
const fmtFechaHora = (v: string | null) => v ? new Date(v).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const fmtClp = (n: number) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

// La extracción automática reporta su propia confianza: se muestra tal cual
// para que quien revisa sepa cuánto puede confiar en los campos sugeridos.
const CONFIANZA: Record<string, { color: string; label: string }> = {
    ALTA: { color: 'green', label: 'Confianza alta' },
    MEDIA: { color: 'orange', label: 'Confianza media' },
    BAJA: { color: 'red', label: 'Confianza baja' },
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
    const [data, setData] = useState<Candidato[]>([]);
    const [loading, setLoading] = useState(true);

    const [confirmando, setConfirmando] = useState<Candidato | null>(null);
    const [numeroOc, setNumeroOc] = useState('');
    const [fechaOc, setFechaOc] = useState<dayjs.Dayjs | null>(null);
    const [numeroHes, setNumeroHes] = useState('');
    const [fechaHes, setFechaHes] = useState<dayjs.Dayjs | null>(null);
    const [guardando, setGuardando] = useState(false);

    const [pdfUrl, setPdfUrl] = useState<string | null>(null);

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
            message.error('No se pudo cargar la bandeja de OCs');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const abrirConfirmar = async (c: Candidato) => {
        setConfirmando(c);
        setNumeroOc(c.numero_oc_sugerido || '');
        setFechaOc(c.fecha_oc_sugerida ? dayjs(c.fecha_oc_sugerida) : null);
        setNumeroHes(c.numero_hes_sugerido || '');
        setFechaHes(c.fecha_hes_sugerida ? dayjs(c.fecha_hes_sugerida) : null);
        setPfDestino(undefined);
        // Una anticipada necesita que se elija la pre-factura destino: se
        // cargan solo las del mismo cliente para no ofrecer imposibles.
        if (!c.numero_id && prefacturas.length === 0) {
            try { setPrefacturas(await facturacionService.listarPrefacturas() || []); } catch { /* noop */ }
        }
    };

    const confirmar = async () => {
        if (!confirmando) return;
        if (!numeroOc.trim()) { message.warning('El número de OC es requerido'); return; }
        if (!confirmando.numero_id && !pfDestino) { message.warning('Elige la pre-factura contra la que se aplica esta OC'); return; }
        setGuardando(true);
        try {
            await facturacionService.confirmarCandidatoOc(confirmando.id_candidato, {
                numeroOc: numeroOc.trim(),
                fechaOc: fechaOc ? fechaOc.format('YYYY-MM-DD') : undefined,
                numeroHes: numeroHes.trim() || undefined,
                fechaHes: fechaHes ? fechaHes.format('YYYY-MM-DD') : undefined,
                idPrefactura: pfDestino,
            });
            message.success(`OC ${numeroOc.trim()} registrada`);
            setConfirmando(null);
            await cargar();
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'No se pudo confirmar la OC');
        } finally {
            setGuardando(false);
        }
    };

    const descartar = (c: Candidato) => {
        Modal.confirm({
            title: '¿Descartar este candidato?',
            content: 'Se marcará como descartado y saldrá de la bandeja. El archivo queda guardado.',
            okText: 'Descartar', okButtonProps: { danger: true }, cancelText: 'Cancelar',
            onOk: async () => {
                try {
                    await facturacionService.descartarCandidatoOc(c.id_candidato);
                    message.success('Candidato descartado');
                    await cargar();
                } catch (e: any) {
                    message.error(e?.response?.data?.message || 'No se pudo descartar');
                }
            },
        });
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
                message.error('No se pudieron cargar las pre-facturas');
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
        if (anticipada && !idEmpresaSel) { message.warning('Elige el cliente al que corresponde la OC'); return; }
        if (!anticipada && !idPrefacturaSel) { message.warning('Elige la pre-factura a la que corresponde la OC'); return; }
        if (!archivo) { message.warning('Adjunta el PDF de la OC'); return; }
        setSubiendo(true);
        try {
            const r = await facturacionService.crearCandidatoOc(
                anticipada ? null : idPrefacturaSel!, archivo, idEmpresaSel);
            if (r?.anticipada) {
                message.success('OC anticipada guardada: queda pendiente hasta que exista la pre-factura.');
            } else {
                message.success(r?.extraido
                    ? 'OC subida — se extrajeron datos automáticamente, revísalos antes de confirmar.'
                    : 'OC subida. No se pudieron extraer los datos: complétalos a mano al confirmar.');
            }
            setSubirOpen(false);
            await cargar();
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'No se pudo subir la OC');
        } finally {
            setSubiendo(false);
        }
    };

    const columns: ColumnsType<Candidato> = [
        {
            title: 'Pre-factura', dataIndex: 'numero_id', width: 150,
            render: (v, r: any) => v ? <b>N° {v}</b> : (
                <Tooltip title={r.prefacturas_disponibles > 0
                    ? `Este cliente tiene ${r.prefacturas_disponibles} pre-factura(s) a las que se puede aplicar`
                    : 'Todavía no hay ninguna pre-factura de este cliente'}>
                    <Tag color={r.prefacturas_disponibles > 0 ? 'blue' : 'gold'}>
                        Anticipada{r.prefacturas_disponibles > 0 ? ` · ${r.prefacturas_disponibles} disponible(s)` : ''}
                    </Tag>
                </Tooltip>
            ),
        },
        { title: 'Cliente', dataIndex: 'nombre_empresaservicios', ellipsis: true, render: (v) => v || '—' },
        {
            title: 'OC sugerida', dataIndex: 'numero_oc_sugerido', width: 190,
            render: (v, r) => v ? (
                <span>
                    <b>{v}</b>
                    {r.fecha_oc_sugerida && <span style={{ color: C.textTer }}> · {fmtFecha(r.fecha_oc_sugerida)}</span>}
                </span>
            ) : <Tag>Sin extraer</Tag>,
        },
        { title: 'HES', dataIndex: 'numero_hes_sugerido', width: 120, render: (v) => v || <span style={{ color: C.textTer }}>—</span> },
        {
            title: 'Monto', dataIndex: 'monto_sugerido', width: 120, align: 'right',
            render: (v) => v ? `$ ${fmtClp(v)}` : <span style={{ color: C.textTer }}>—</span>,
        },
        {
            title: 'Extracción', dataIndex: 'confianza', width: 150,
            render: (v, r) => {
                if (!v) return <Tag color="default">Manual</Tag>;
                const info = CONFIANZA[v] || { color: 'default', label: v };
                return (
                    <Tooltip title={r.metodo_extraccion === 'VISION_IA' ? 'Datos leídos automáticamente del PDF' : undefined}>
                        <Tag color={info.color} icon={<IconSparkles size={11} style={{ verticalAlign: -1, marginRight: 3 }} />}>
                            {info.label}
                        </Tag>
                    </Tooltip>
                );
            },
        },
        { title: 'Recibida', dataIndex: 'fecha_creacion', width: 140, render: fmtFechaHora },
        {
            title: '', width: 210, align: 'right',
            render: (_, r) => (
                <Space size={4}>
                    <Tooltip title="Ver el PDF de la OC">
                        <Button
                            size="small"
                            icon={<IconFileTypePdf size={14} />}
                            onClick={() => setPdfUrl(`${API_CONFIG.getBaseURL()}${r.archivo_path}`)}
                        />
                    </Tooltip>
                    <Button size="small" type="primary" icon={<IconCircleCheck size={14} />} onClick={() => abrirConfirmar(r)}>
                        Confirmar
                    </Button>
                    <Button size="small" danger icon={<IconCircleX size={14} />} onClick={() => descartar(r)} />
                </Space>
            ),
        },
    ];

    return (
        <div className="adl-foc-wrap">
            <style>{CSS}</style>

            <div className="adl-foc-header">
                <div>
                    <h2 className="adl-foc-title">Bandeja de Órdenes de Compra</h2>
                    <p className="adl-foc-sub">
                        OCs pendientes de confirmar. Adjunta el PDF que llegó por correo y confirma con un click.
                    </p>
                </div>
                <Space>
                    <Button icon={<IconRefresh size={16} />} onClick={cargar}>Actualizar</Button>
                    <Button type="primary" icon={<IconUpload size={16} />} onClick={abrirSubir}>Subir OC</Button>
                </Space>
            </div>

            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spin /></div>
            ) : data.length === 0 ? (
                <Empty description="No hay OCs pendientes de revisar." />
            ) : (
                <Table<Candidato>
                    rowKey="id_candidato"
                    columns={columns}
                    dataSource={data}
                    size="small"
                    pagination={{ pageSize: 20, size: 'small' }}
                />
            )}

            {/* Confirmar: los datos sugeridos son editables antes de registrarlos */}
            <Modal
                title={confirmando ? `Confirmar OC — Pre-factura N° ${confirmando.numero_id}` : 'Confirmar OC'}
                open={confirmando !== null}
                onCancel={() => setConfirmando(null)}
                onOk={confirmar}
                confirmLoading={guardando}
                okText="Registrar OC"
                width={520}
            >
                {confirmando && (
                    <>
                        {confirmando.confianza && confirmando.confianza !== 'ALTA' && (
                            <Alert
                                type="warning"
                                showIcon
                                style={{ marginBottom: 16 }}
                                message="Revisa los datos antes de confirmar"
                                description="La extracción automática no quedó segura de estos valores."
                            />
                        )}
                        {!confirmando.numero_oc_sugerido && (
                            <Alert
                                type="info"
                                showIcon
                                style={{ marginBottom: 16 }}
                                message="No se pudieron leer los datos del PDF — complétalos a mano."
                            />
                        )}
                        {!confirmando.numero_id && (
                            <div className="adl-foc-field">
                                <label>Pre-factura a la que se aplica *</label>
                                <Select
                                    showSearch
                                    style={{ width: '100%' }}
                                    placeholder="Pre-facturas de este cliente"
                                    optionFilterProp="label"
                                    value={pfDestino}
                                    onChange={setPfDestino}
                                    options={prefacturas
                                        .filter((p: any) => Number(p.id_empresaservicio) === Number(confirmando.id_empresaservicio))
                                        .map((p: any) => ({ value: p.id_prefactura, label: `N° ${p.numero_id} — ${p.estado}` }))}
                                />
                                <p style={{ fontSize: 12, color: C.textTer, margin: '6px 0 0' }}>
                                    Esta OC se cargó antes de que existiera la pre-factura.
                                </p>
                            </div>
                        )}
                        <div className="adl-foc-field">
                            <label>N° de Orden de Compra *</label>
                            <Input value={numeroOc} onChange={(e) => setNumeroOc(e.target.value)} placeholder="Ej: 4500123456" />
                        </div>
                        <div className="adl-foc-field">
                            <label>Fecha de la OC</label>
                            <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" value={fechaOc} onChange={setFechaOc} />
                        </div>
                        <div className="adl-foc-field">
                            <label>N° HES (si corresponde)</label>
                            <Input value={numeroHes} onChange={(e) => setNumeroHes(e.target.value)} placeholder="Opcional" />
                        </div>
                        <div className="adl-foc-field">
                            <label>Fecha HES</label>
                            <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" value={fechaHes} onChange={setFechaHes} />
                        </div>
                        <Button
                            type="link"
                            size="small"
                            icon={<IconFileTypePdf size={14} />}
                            style={{ paddingLeft: 0 }}
                            onClick={() => setPdfUrl(`${API_CONFIG.getBaseURL()}${confirmando.archivo_path}`)}
                        >
                            Ver el PDF mientras completas
                        </Button>
                    </>
                )}
            </Modal>

            {/* Subir una OC que llegó por correo */}
            <Modal
                title="Subir Orden de Compra"
                open={subirOpen}
                onCancel={() => setSubirOpen(false)}
                onOk={subir}
                confirmLoading={subiendo}
                okText="Subir"
                width={520}
            >
                <div className="adl-foc-field">
                    <Space size={8}>
                        <Switch size="small" checked={anticipada} onChange={setAnticipada} />
                        <span style={{ fontSize: 13, color: C.textSec }}>Todavía no existe la pre-factura</span>
                    </Space>
                </div>
                {anticipada ? (
                    <div className="adl-foc-field">
                        <label>Cliente al que corresponde *</label>
                        <Select
                            showSearch
                            style={{ width: '100%' }}
                            placeholder="Selecciona el cliente"
                            optionFilterProp="label"
                            value={idEmpresaSel}
                            onChange={setIdEmpresaSel}
                            options={empresas.map((e) => ({ value: e.id, label: e.nombre }))}
                        />
                        <p style={{ fontSize: 12, color: C.textTer, margin: '6px 0 0' }}>
                            Queda guardada esperando: cuando exista la pre-factura de este cliente, se confirma contra ella.
                        </p>
                    </div>
                ) : (
                    <div className="adl-foc-field">
                        <label>Pre-factura a la que corresponde *</label>
                        <Select
                            showSearch
                            style={{ width: '100%' }}
                            placeholder="Busca por número o cliente"
                            optionFilterProp="label"
                            value={idPrefacturaSel}
                            onChange={setIdPrefacturaSel}
                            options={prefacturas.map((p: any) => ({
                                value: p.id_prefactura,
                                label: `N° ${p.numero_id} — ${p.nombre_empresaservicios || 'Sin cliente'}`,
                            }))}
                        />
                    </div>
                )}
                <div className="adl-foc-field">
                    <label>PDF de la OC *</label>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="application/pdf"
                        style={{ display: 'none' }}
                        onChange={(e) => setArchivo(e.target.files?.[0] || null)}
                    />
                    <Button icon={<IconUpload size={14} />} onClick={() => fileRef.current?.click()}>
                        {archivo ? archivo.name : 'Seleccionar archivo'}
                    </Button>
                </div>
                <Alert
                    type="info"
                    showIcon
                    message="Al subirla se intentará leer el número de OC, la fecha y el monto del PDF. Siempre podrás corregirlos antes de confirmar."
                />
            </Modal>

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
