import { useEffect, useState } from 'react';
import {
    Tabs, Card, Table, Tag, Button, DatePicker, InputNumber, Form, message, Spin,
    Select, Input, Switch, Divider, Empty, Statistic, Space, Alert, Collapse,
} from 'antd';
import { IconDeviceFloppy, IconCoin, IconBuildingBank } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { facturacionService } from '../services/facturacion.service';
import { catalogosService, type EmpresaServicio } from '../../medio-ambiente/services/catalogos.service';

const C = {
    border: '#f0f0f0', text: 'rgba(0,0,0,0.88)', textSec: 'rgba(0,0,0,0.65)', textTer: 'rgba(0,0,0,0.45)',
    primary: '#1677ff', bg: '#ffffff',
};

const CSS = `
.adl-fcf-wrap { width:100%; padding:24px 32px 48px; }
.adl-fcf-title { margin:0 0 4px; font-size:22px; font-weight:700; color:${C.text}; letter-spacing:-.3px; }
.adl-fcf-sub { margin:0 0 20px; font-size:13px; color:${C.textTer}; }
.adl-fcf-ufform { display:flex; align-items:flex-end; gap:10px; margin-bottom:18px; flex-wrap:wrap; }
.adl-fcf-sectitle { font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:${C.textTer}; margin:18px 0 10px; }
`;

const fmtUf = (n: number) => Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFecha = (v: string | null) => v ? new Date(v).toLocaleDateString('es-CL') : '—';
const fmtFechaHora = (v: string | null) => v ? new Date(v).toLocaleString('es-CL') : '—';

// --- Tab: Valor UF ---
const TabUf: React.FC = () => {
    const [historial, setHistorial] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actualizando, setActualizando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [fecha, setFecha] = useState(dayjs());
    const [valor, setValor] = useState<number | null>(null);

    const cargar = async () => {
        setLoading(true);
        try {
            setHistorial(await facturacionService.listarUfHistorial(30));
        } catch {
            message.error('No se pudo cargar el histórico de UF');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { cargar(); }, []);

    const actualizarDesdeBcch = async () => {
        setActualizando(true);
        try {
            const r = await facturacionService.actualizarUf();
            if (r.actualizado) message.success(`UF actualizada: ${r.valor}`);
            else message.info(r.motivo || 'Sin cambios');
            await cargar();
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'No se pudo actualizar desde el Banco Central');
        } finally {
            setActualizando(false);
        }
    };

    const registrarManual = async () => {
        if (!valor || valor <= 0) { message.warning('Ingresa un valor válido'); return; }
        setGuardando(true);
        try {
            await facturacionService.registrarUfManual(fecha.format('YYYY-MM-DD'), valor);
            message.success('Valor UF registrado');
            setValor(null);
            await cargar();
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'No se pudo registrar el valor');
        } finally {
            setGuardando(false);
        }
    };

    const actual = historial[0];

    return (
        <>
            <Space size={24} style={{ marginBottom: 20 }}>
                <Card size="small" style={{ minWidth: 180 }}>
                    <Statistic
                        title="UF vigente"
                        value={actual ? actual.valor : 0}
                        precision={2}
                        prefix={<IconCoin size={16} color={C.primary} />}
                        formatter={(v) => `$ ${fmtUf(Number(v))}`}
                    />
                    <div style={{ fontSize: 12, color: C.textTer, marginTop: 4 }}>
                        {actual ? `${fmtFecha(actual.fecha)} · ${actual.fuente === 'BCCH_API' ? 'Banco Central' : actual.fuente === 'MANUAL' ? 'Manual' : actual.fuente}` : 'Sin registros'}
                    </div>
                </Card>
                <Button icon={<IconBuildingBank size={15} />} loading={actualizando} onClick={actualizarDesdeBcch}>
                    Actualizar desde Banco Central
                </Button>
            </Space>

            <p className="adl-fcf-sectitle">Registrar / corregir manualmente</p>
            <div className="adl-fcf-ufform">
                <Form.Item label="Fecha" style={{ marginBottom: 0 }}>
                    <DatePicker value={fecha} onChange={(v) => v && setFecha(v)} allowClear={false} />
                </Form.Item>
                <Form.Item label="Valor UF" style={{ marginBottom: 0 }}>
                    <InputNumber min={0} step={0.01} value={valor} onChange={setValor} style={{ width: 160 }} />
                </Form.Item>
                <Button type="primary" icon={<IconDeviceFloppy size={15} />} loading={guardando} onClick={registrarManual}>
                    Guardar
                </Button>
            </div>

            <p className="adl-fcf-sectitle">Histórico</p>
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>
            ) : (
                <Table
                    size="small"
                    pagination={{ pageSize: 10, size: 'small' }}
                    rowKey="fecha"
                    dataSource={historial}
                    columns={[
                        { title: 'Fecha', dataIndex: 'fecha', render: fmtFecha },
                        { title: 'Valor', dataIndex: 'valor', align: 'right', render: (v) => fmtUf(v) },
                        {
                            title: 'Fuente', dataIndex: 'fuente', width: 130,
                            render: (v) => <Tag color={v === 'MANUAL' ? 'gold' : v === 'BCCH_API' ? 'blue' : 'default'}>{v}</Tag>,
                        },
                        { title: 'Registrado', dataIndex: 'fecha_registro', render: fmtFechaHora },
                    ]}
                />
            )}
        </>
    );
};

// --- Tab: Clientes (fac_cliente_config) ---
const TabClientes: React.FC = () => {
    const [empresas, setEmpresas] = useState<EmpresaServicio[]>([]);
    const [idSel, setIdSel] = useState<number | undefined>();
    const [loadingCfg, setLoadingCfg] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [tieneConfigGuardada, setTieneConfigGuardada] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        catalogosService.getEmpresasServicio()
            .then((raw: any[]) => setEmpresas(raw.map((e) => ({ id: e.id_empresaservicio, nombre: e.nombre_empresaservicios }))))
            .catch(() => message.error('No se pudieron cargar los clientes'));
    }, []);

    const seleccionar = async (id: number) => {
        setIdSel(id);
        setLoadingCfg(true);
        try {
            const cfg = await facturacionService.getClienteConfig(id);
            setTieneConfigGuardada(!!cfg?.tiene_config_guardada);
            form.setFieldsValue({
                requiereOc: cfg?.requiere_oc !== 'N',
                requiereHes: cfg?.requiere_hes === 'S',
                emailFacturacion: cfg?.email_facturacion || '',
                formaPagoDefault: cfg?.forma_pago_default || '',
                diasAlertaOc: cfg?.dias_alerta_oc ?? 10,
                rut: cfg?.rut || '',
                razonSocial: cfg?.razon_social || '',
                direccion: cfg?.direccion || '',
                giro: cfg?.giro || '',
                idCliVentas: cfg?.id_cli_ventas ?? undefined,
                idDirVentas: cfg?.id_dir_ventas ?? undefined,
                idGirVentas: cfg?.id_gir_ventas ?? undefined,
                idCiuVentas: cfg?.id_ciu_ventas ?? undefined,
                nomCiuVentas: cfg?.nom_ciu_ventas || '',
                idComVentas: cfg?.id_com_ventas ?? undefined,
                nomComVentas: cfg?.nom_com_ventas || '',
                idFormapagoVentas: cfg?.id_formapago_ventas ?? 1,
                portalClienteCodigo: cfg?.portal_cliente_codigo || '',
                portalSedeCodigo: cfg?.portal_sede_codigo || '',
            });
        } catch {
            message.error('No se pudo cargar la configuración del cliente');
        } finally {
            setLoadingCfg(false);
        }
    };

    const guardar = async () => {
        if (!idSel) return;
        try {
            const values = await form.validateFields();
            setGuardando(true);
            await facturacionService.upsertClienteConfig(idSel, {
                requiereOc: values.requiereOc ? 'S' : 'N',
                requiereHes: values.requiereHes ? 'S' : 'N',
                emailFacturacion: values.emailFacturacion || undefined,
                formaPagoDefault: values.formaPagoDefault || undefined,
                diasAlertaOc: values.diasAlertaOc,
                rut: values.rut || undefined,
                razonSocial: values.razonSocial || undefined,
                direccion: values.direccion || undefined,
                giro: values.giro || undefined,
                idCliVentas: values.idCliVentas,
                idDirVentas: values.idDirVentas,
                idGirVentas: values.idGirVentas,
                idCiuVentas: values.idCiuVentas,
                nomCiuVentas: values.nomCiuVentas || undefined,
                idComVentas: values.idComVentas,
                nomComVentas: values.nomComVentas || undefined,
                idFormapagoVentas: values.idFormapagoVentas,
                portalClienteCodigo: values.portalClienteCodigo || undefined,
                portalSedeCodigo: values.portalSedeCodigo || undefined,
            });
            message.success('Configuración guardada');
            setTieneConfigGuardada(true);
        } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.response?.data?.message || 'No se pudo guardar la configuración');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <>
            <Select
                showSearch
                allowClear
                style={{ width: 340, marginBottom: 16 }}
                placeholder="Selecciona un cliente para configurar"
                optionFilterProp="label"
                options={empresas.map((e) => ({ value: e.id, label: e.nombre }))}
                onChange={(v) => v ? seleccionar(v) : setIdSel(undefined)}
            />

            {!idSel ? (
                <Empty description="Selecciona un cliente para ver o editar su configuración de facturación." />
            ) : loadingCfg ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>
            ) : (
                <Form form={form} layout="vertical">
                    {!tieneConfigGuardada ? (
                        <Alert
                            type="info"
                            showIcon
                            style={{ marginBottom: 16 }}
                            message="Aún no hay configuración guardada para este cliente"
                            description="Los campos ya vienen pre-cargados con lo que existe en la ficha del cliente (RUT, dirección, giro, email). Revísalos y guarda para confirmarlos como su configuración de facturación."
                        />
                    ) : (
                        <Alert type="success" showIcon style={{ marginBottom: 16 }} message="Este cliente ya tiene configuración de facturación guardada." />
                    )}
                    <p className="adl-fcf-sectitle">Envío y OC</p>
                    <Form.Item name="emailFacturacion" label="Email de facturación" rules={[{ type: 'email', message: 'Email inválido' }]}>
                        <Input placeholder="facturacion@cliente.cl" />
                    </Form.Item>
                    <Space size={24}>
                        <Form.Item name="requiereOc" label="Requiere Orden de Compra" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                        <Form.Item name="requiereHes" label="Requiere HES" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                        <Form.Item name="diasAlertaOc" label="Alertar OC demorada (días)">
                            <InputNumber min={1} />
                        </Form.Item>
                    </Space>
                    <Form.Item name="formaPagoDefault" label="Forma de pago por defecto">
                        <Input placeholder="Opcional" />
                    </Form.Item>

                    <Divider />
                    <p className="adl-fcf-sectitle">Datos SII</p>
                    <Space size={12} wrap>
                        <Form.Item name="rut" label="RUT"><Input style={{ width: 150 }} placeholder="76.123.456-7" /></Form.Item>
                        <Form.Item name="razonSocial" label="Razón social"><Input style={{ width: 260 }} /></Form.Item>
                    </Space>
                    <Space size={12} wrap>
                        <Form.Item name="direccion" label="Dirección"><Input style={{ width: 260 }} /></Form.Item>
                        <Form.Item name="giro" label="Giro"><Input style={{ width: 200 }} /></Form.Item>
                    </Space>

                    <Divider />
                    <Collapse
                        ghost
                        items={[
                            {
                                key: 'ventas',
                                label: <span className="adl-fcf-sectitle" style={{ margin: 0 }}>Sistema de Ventas (avanzado / opcional)</span>,
                                children: (
                                    <>
                                        <Alert
                                            type="info"
                                            showIcon
                                            style={{ marginBottom: 12 }}
                                            message="No es necesario llenar esto para emitir"
                                            description="Al emitir, el sistema busca automáticamente al cliente en el Sistema de Ventas por su RUT. Completa estos campos solo si quieres forzar un ID específico, o si la emisión te avisa que no encontró al cliente por RUT."
                                        />
                                        <Space size={12} wrap>
                                            <Form.Item name="idCliVentas" label="ID cliente"><InputNumber style={{ width: 120 }} /></Form.Item>
                                            <Form.Item name="idDirVentas" label="ID dirección"><InputNumber style={{ width: 120 }} /></Form.Item>
                                            <Form.Item name="idGirVentas" label="ID giro"><InputNumber style={{ width: 120 }} /></Form.Item>
                                            <Form.Item name="idFormapagoVentas" label="ID forma pago"><InputNumber style={{ width: 120 }} /></Form.Item>
                                        </Space>
                                        <Space size={12} wrap>
                                            <Form.Item name="idCiuVentas" label="ID ciudad"><InputNumber style={{ width: 120 }} /></Form.Item>
                                            <Form.Item name="nomCiuVentas" label="Nombre ciudad"><Input style={{ width: 160 }} /></Form.Item>
                                            <Form.Item name="idComVentas" label="ID comuna"><InputNumber style={{ width: 120 }} /></Form.Item>
                                            <Form.Item name="nomComVentas" label="Nombre comuna"><Input style={{ width: 160 }} /></Form.Item>
                                        </Space>
                                    </>
                                ),
                            },
                            {
                                key: 'portal',
                                label: <span className="adl-fcf-sectitle" style={{ margin: 0 }}>Portal ADL WEB GO (avanzado / opcional)</span>,
                                children: (
                                    <>
                                        <Alert
                                            type="warning"
                                            showIcon
                                            style={{ marginBottom: 12 }}
                                            message="Solo si vas a publicar la pre-factura en el portal del cliente"
                                            description="Estos códigos son propios de ADL WEB GO (WebClientesV2) y no se pueden resolver automáticamente desde ADL ONE — hay que coordinarlos con ese equipo antes de usar 'Publicar en portal'. El flujo normal de facturación (procesar, pre-factura, OC, emisión) no los necesita."
                                        />
                                        <Space size={12} wrap>
                                            <Form.Item name="portalClienteCodigo" label="Código cliente portal"><Input style={{ width: 180 }} /></Form.Item>
                                            <Form.Item name="portalSedeCodigo" label="Código sede portal"><Input style={{ width: 180 }} /></Form.Item>
                                        </Space>
                                    </>
                                ),
                            },
                        ]}
                    />

                    <Button type="primary" icon={<IconDeviceFloppy size={15} />} loading={guardando} onClick={guardar} style={{ marginTop: 16 }}>
                        Guardar configuración
                    </Button>
                </Form>
            )}
        </>
    );
};

const FacturacionConfiguracion: React.FC = () => {
    return (
        <div className="adl-fcf-wrap">
            <style>{CSS}</style>
            <h2 className="adl-fcf-title">Configuración</h2>
            <p className="adl-fcf-sub">Valor UF y datos de facturación por cliente.</p>
            <Tabs
                items={[
                    { key: 'uf', label: 'Valor UF', children: <TabUf /> },
                    { key: 'clientes', label: 'Clientes', children: <TabClientes /> },
                ]}
            />
        </div>
    );
};

export default FacturacionConfiguracion;
