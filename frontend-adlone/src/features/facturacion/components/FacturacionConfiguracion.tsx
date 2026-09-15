import { useEffect, useState } from 'react';
import { IconDeviceFloppy, IconCoin, IconBuildingBank, IconChevronDown } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { DataPagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { useToast } from '../../../contexts/ToastContext';
import { facturacionService } from '../services/facturacion.service';
import { catalogosService, type EmpresaServicio } from '../../medio-ambiente/services/catalogos.service';

const fmtUf = (n: number) => Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFecha = (v: string | null) => v ? new Date(v).toLocaleDateString('es-CL') : '—';
const fmtFechaHora = (v: string | null) => v ? new Date(v).toLocaleString('es-CL') : '—';
const todayIso = () => new Date().toISOString().slice(0, 10);
const PAGE_SIZE = 10;

// --- Tab: Valor UF ---
const TabUf: React.FC = () => {
    const { showToast } = useToast();
    const [historial, setHistorial] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actualizando, setActualizando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [fecha, setFecha] = useState(todayIso());
    const [valor, setValor] = useState<string>('');
    const [page, setPage] = useState(1);

    const cargar = async () => {
        setLoading(true);
        try {
            setHistorial(await facturacionService.listarUfHistorial(30));
        } catch {
            showToast({ type: 'error', message: 'No se pudo cargar el histórico de UF' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { cargar(); }, []);

    const actualizarDesdeBcch = async () => {
        setActualizando(true);
        try {
            const r = await facturacionService.actualizarUf();
            if (r.actualizado) showToast({ type: 'success', message: `UF actualizada: ${r.valor}` });
            else showToast({ type: 'info', message: r.motivo || 'Sin cambios' });
            await cargar();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo actualizar desde el Banco Central' });
        } finally {
            setActualizando(false);
        }
    };

    const registrarManual = async () => {
        const num = Number(valor);
        if (!num || num <= 0) { showToast({ type: 'warning', message: 'Ingresa un valor válido' }); return; }
        setGuardando(true);
        try {
            await facturacionService.registrarUfManual(fecha, num);
            showToast({ type: 'success', message: 'Valor UF registrado' });
            setValor('');
            await cargar();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo registrar el valor' });
        } finally {
            setGuardando(false);
        }
    };

    const actual = historial[0];
    const totalPages = Math.max(1, Math.ceil(historial.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const paginated = historial.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    return (
        <>
            <div className="mb-5 flex flex-wrap items-end gap-6">
                <Card className="min-w-[180px]">
                    <CardContent className="p-4">
                        <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <IconCoin size={16} className="text-primary" /> UF vigente
                        </p>
                        <p className="text-2xl font-semibold text-foreground">$ {fmtUf(actual ? actual.valor : 0)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {actual ? `${fmtFecha(actual.fecha)} · ${actual.fuente === 'BCCH_API' ? 'Banco Central' : actual.fuente === 'MANUAL' ? 'Manual' : actual.fuente}` : 'Sin registros'}
                        </p>
                    </CardContent>
                </Card>
                <Button variant="outline" disabled={actualizando} onClick={actualizarDesdeBcch}>
                    {actualizando ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <IconBuildingBank size={15} />}
                    Actualizar desde Banco Central
                </Button>
            </div>

            <p className="mb-2.5 mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Registrar / corregir manualmente</p>
            <div className="mb-4 flex flex-wrap items-end gap-2.5">
                <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Fecha</Label>
                    <DatePicker value={fecha} onChange={(v) => v && setFecha(v)} className="w-[160px]" />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Valor UF</Label>
                    <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={valor}
                        onChange={(e) => setValor(e.target.value)}
                        className="w-40"
                    />
                </div>
                <Button disabled={guardando} onClick={registrarManual}>
                    {guardando ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <IconDeviceFloppy size={15} />}
                    Guardar
                </Button>
            </div>

            <p className="mb-2.5 mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Histórico</p>
            {loading ? (
                <div className="flex justify-center p-10">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    <div className="overflow-hidden rounded-xl border border-border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Fecha</TableHead>
                                    <TableHead className="text-right">Valor</TableHead>
                                    <TableHead>Fuente</TableHead>
                                    <TableHead>Registrado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginated.length > 0 ? paginated.map((h, i) => (
                                    <TableRow key={i}>
                                        <TableCell>{fmtFecha(h.fecha)}</TableCell>
                                        <TableCell className="text-right tabular-nums">{fmtUf(h.valor)}</TableCell>
                                        <TableCell>
                                            <Badge variant={h.fuente === 'MANUAL' ? 'warning' : h.fuente === 'BCCH_API' ? 'outline' : 'secondary'}>{h.fuente}</Badge>
                                        </TableCell>
                                        <TableCell>{fmtFechaHora(h.fecha_registro)}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Sin registros</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <DataPagination page={currentPage} pageSize={PAGE_SIZE} total={historial.length} onPageChange={setPage} />
                </div>
            )}
        </>
    );
};

interface ClienteConfigForm {
    requiereOc?: boolean;
    requiereHes?: boolean;
    emailFacturacion?: string;
    formaPagoDefault?: string;
    diasAlertaOc?: number;
    rut?: string;
    razonSocial?: string;
    direccion?: string;
    giro?: string;
    idCliVentas?: number;
    idDirVentas?: number;
    idGirVentas?: number;
    idCiuVentas?: number;
    nomCiuVentas?: string;
    idComVentas?: number;
    nomComVentas?: string;
    idFormapagoVentas?: number;
    portalClienteCodigo?: string;
    portalSedeCodigo?: string;
}

// --- Tab: Clientes (fac_cliente_config) ---
const TabClientes: React.FC = () => {
    const { showToast } = useToast();
    const [empresas, setEmpresas] = useState<EmpresaServicio[]>([]);
    const [idSel, setIdSel] = useState<string | undefined>();
    const [loadingCfg, setLoadingCfg] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [tieneConfigGuardada, setTieneConfigGuardada] = useState(false);
    const [ventasOpen, setVentasOpen] = useState(false);
    const [portalOpen, setPortalOpen] = useState(false);

    const [values, setValues] = useState<ClienteConfigForm>({});
    const setField = <K extends keyof ClienteConfigForm>(k: K, v: ClienteConfigForm[K]) =>
        setValues((prev) => ({ ...prev, [k]: v }));

    useEffect(() => {
        catalogosService.getEmpresasServicio()
            .then((raw: any[]) => setEmpresas(raw.map((e) => ({ id: e.id_empresaservicio, nombre: e.nombre_empresaservicios }))))
            .catch(() => showToast({ type: 'error', message: 'No se pudieron cargar los clientes' }));
    }, []);

    const seleccionar = async (idStr: string | undefined) => {
        setIdSel(idStr);
        if (!idStr) return;
        const id = Number(idStr);
        setLoadingCfg(true);
        try {
            const cfg = await facturacionService.getClienteConfig(id);
            setTieneConfigGuardada(!!cfg?.tiene_config_guardada);
            setValues({
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
            showToast({ type: 'error', message: 'No se pudo cargar la configuración del cliente' });
        } finally {
            setLoadingCfg(false);
        }
    };

    const guardar = async () => {
        if (!idSel) return;
        if (values.emailFacturacion && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.emailFacturacion)) {
            showToast({ type: 'error', message: 'Email inválido' });
            return;
        }
        setGuardando(true);
        try {
            await facturacionService.upsertClienteConfig(Number(idSel), {
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
            showToast({ type: 'success', message: 'Configuración guardada' });
            setTieneConfigGuardada(true);
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo guardar la configuración' });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <>
            <Combobox
                value={idSel}
                onValueChange={seleccionar}
                placeholder="Selecciona un cliente para configurar"
                searchPlaceholder="Buscar cliente..."
                className="mb-4 w-[340px]"
                options={empresas.map((e) => ({ value: String(e.id), label: e.nombre }))}
            />

            {!idSel ? (
                <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                    Selecciona un cliente para ver o editar su configuración de facturación.
                </p>
            ) : loadingCfg ? (
                <div className="flex justify-center p-10">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {!tieneConfigGuardada ? (
                        <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                            <p className="font-medium text-foreground">Aún no hay configuración guardada para este cliente</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Los campos ya vienen pre-cargados con lo que existe en la ficha del cliente (RUT, dirección, giro, email). Revísalos y guarda para confirmarlos como su configuración de facturación.
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-foreground">
                            Este cliente ya tiene configuración de facturación guardada.
                        </div>
                    )}

                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Envío y OC</p>
                    <Field label="Email de facturación">
                        <Input placeholder="facturacion@cliente.cl" value={values.emailFacturacion || ''} onChange={(e) => setField('emailFacturacion', e.target.value)} />
                    </Field>
                    <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-2">
                            <Switch checked={!!values.requiereOc} onCheckedChange={(v) => setField('requiereOc', v)} id="requiereOc" />
                            <Label htmlFor="requiereOc" className="text-sm font-normal">Requiere Orden de Compra</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch checked={!!values.requiereHes} onCheckedChange={(v) => setField('requiereHes', v)} id="requiereHes" />
                            <Label htmlFor="requiereHes" className="text-sm font-normal">Requiere HES</Label>
                        </div>
                        <Field label="Alertar OC demorada (días)" className="w-40">
                            <Input type="number" min={1} value={values.diasAlertaOc ?? ''} onChange={(e) => setField('diasAlertaOc', e.target.value ? Number(e.target.value) : undefined)} />
                        </Field>
                    </div>
                    <Field label="Forma de pago por defecto">
                        <Input placeholder="Opcional" value={values.formaPagoDefault || ''} onChange={(e) => setField('formaPagoDefault', e.target.value)} />
                    </Field>

                    <div className="border-t border-border pt-4">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Datos SII</p>
                        <div className="flex flex-wrap gap-3">
                            <Field label="RUT" className="w-[150px]">
                                <Input placeholder="76.123.456-7" value={values.rut || ''} onChange={(e) => setField('rut', e.target.value)} />
                            </Field>
                            <Field label="Razón social" className="w-[260px]">
                                <Input value={values.razonSocial || ''} onChange={(e) => setField('razonSocial', e.target.value)} />
                            </Field>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3">
                            <Field label="Dirección" className="w-[260px]">
                                <Input value={values.direccion || ''} onChange={(e) => setField('direccion', e.target.value)} />
                            </Field>
                            <Field label="Giro" className="w-[200px]">
                                <Input value={values.giro || ''} onChange={(e) => setField('giro', e.target.value)} />
                            </Field>
                        </div>
                    </div>

                    <div className="border-t border-border pt-4">
                        <button
                            type="button"
                            onClick={() => setVentasOpen((v) => !v)}
                            className="flex w-full items-center justify-between text-left text-xs font-bold uppercase tracking-wide text-muted-foreground"
                        >
                            Sistema de Ventas (avanzado / opcional)
                            <IconChevronDown size={14} className={cn('transition-transform', ventasOpen && 'rotate-180')} />
                        </button>
                        {ventasOpen && (
                            <div className="mt-3 flex flex-col gap-3">
                                <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                                    <p className="font-medium text-foreground">No es necesario llenar esto para emitir</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Al emitir, el sistema busca automáticamente al cliente en el Sistema de Ventas por su RUT. Completa estos campos solo si quieres forzar un ID específico, o si la emisión te avisa que no encontró al cliente por RUT.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <Field label="ID cliente" className="w-[120px]"><Input type="number" value={values.idCliVentas ?? ''} onChange={(e) => setField('idCliVentas', e.target.value ? Number(e.target.value) : undefined)} /></Field>
                                    <Field label="ID dirección" className="w-[120px]"><Input type="number" value={values.idDirVentas ?? ''} onChange={(e) => setField('idDirVentas', e.target.value ? Number(e.target.value) : undefined)} /></Field>
                                    <Field label="ID giro" className="w-[120px]"><Input type="number" value={values.idGirVentas ?? ''} onChange={(e) => setField('idGirVentas', e.target.value ? Number(e.target.value) : undefined)} /></Field>
                                    <Field label="ID forma pago" className="w-[120px]"><Input type="number" value={values.idFormapagoVentas ?? ''} onChange={(e) => setField('idFormapagoVentas', e.target.value ? Number(e.target.value) : undefined)} /></Field>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <Field label="ID ciudad" className="w-[120px]"><Input type="number" value={values.idCiuVentas ?? ''} onChange={(e) => setField('idCiuVentas', e.target.value ? Number(e.target.value) : undefined)} /></Field>
                                    <Field label="Nombre ciudad" className="w-40"><Input value={values.nomCiuVentas || ''} onChange={(e) => setField('nomCiuVentas', e.target.value)} /></Field>
                                    <Field label="ID comuna" className="w-[120px]"><Input type="number" value={values.idComVentas ?? ''} onChange={(e) => setField('idComVentas', e.target.value ? Number(e.target.value) : undefined)} /></Field>
                                    <Field label="Nombre comuna" className="w-40"><Input value={values.nomComVentas || ''} onChange={(e) => setField('nomComVentas', e.target.value)} /></Field>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-border pt-4">
                        <button
                            type="button"
                            onClick={() => setPortalOpen((v) => !v)}
                            className="flex w-full items-center justify-between text-left text-xs font-bold uppercase tracking-wide text-muted-foreground"
                        >
                            Portal ADL WEB GO (avanzado / opcional)
                            <IconChevronDown size={14} className={cn('transition-transform', portalOpen && 'rotate-180')} />
                        </button>
                        {portalOpen && (
                            <div className="mt-3 flex flex-col gap-3">
                                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
                                    <p className="font-medium text-foreground">Solo si vas a publicar la pre-factura en el portal del cliente</p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Estos códigos son propios de ADL WEB GO (WebClientesV2) y no se pueden resolver automáticamente desde ADL ONE — hay que coordinarlos con ese equipo antes de usar "Publicar en portal". El flujo normal de facturación (procesar, pre-factura, OC, emisión) no los necesita.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <Field label="Código cliente portal" className="w-[180px]"><Input value={values.portalClienteCodigo || ''} onChange={(e) => setField('portalClienteCodigo', e.target.value)} /></Field>
                                    <Field label="Código sede portal" className="w-[180px]"><Input value={values.portalSedeCodigo || ''} onChange={(e) => setField('portalSedeCodigo', e.target.value)} /></Field>
                                </div>
                            </div>
                        )}
                    </div>

                    <Button disabled={guardando} onClick={guardar} className="mt-2 w-fit">
                        {guardando ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <IconDeviceFloppy size={15} />}
                        Guardar configuración
                    </Button>
                </div>
            )}
        </>
    );
};

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
            {children}
        </div>
    );
}

const FacturacionConfiguracion: React.FC = () => {
    return (
        <div className="shadcn-scope w-full p-6 pb-12">
            <h2 className="mb-1 text-[22px] font-bold tracking-tight text-foreground">Configuración</h2>
            <p className="mb-5 text-sm text-muted-foreground">Valor UF y datos de facturación por cliente.</p>
            <Tabs defaultValue="uf">
                <TabsList className="mb-4">
                    <TabsTrigger value="uf">Valor UF</TabsTrigger>
                    <TabsTrigger value="clientes">Clientes</TabsTrigger>
                </TabsList>
                <TabsContent value="uf">
                    <TabUf />
                </TabsContent>
                <TabsContent value="clientes">
                    <TabClientes />
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default FacturacionConfiguracion;
