import { useState, useMemo, useEffect } from 'react';
import {
    IconSearch, IconArrowRight, IconArrowLeft, IconCircleCheck, IconFileInvoice, IconEye,
    IconMail, IconWorldUpload, IconCheck,
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { DataPagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { useToast } from '../../../contexts/ToastContext';
import { facturacionService } from '../services/facturacion.service';
import API_CONFIG from '../../../config/api.config';
import { catalogosService, type EmpresaServicio, type Centro } from '../../medio-ambiente/services/catalogos.service';
import PdfViewerModal from './PdfViewerModal';

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

const PAGE_SIZE = 10;

const STEP_LABELS = ['Seleccionar casos', 'Agrupar y configurar', 'Confirmar', 'Resultado'];

function StepHeader({ step }: { step: number }) {
    return (
        <div className="mb-6 flex items-center">
            {STEP_LABELS.map((label, i) => (
                <div key={label} className="flex flex-1 items-center last:flex-none">
                    <div className="flex items-center gap-2">
                        <span
                            className={cn(
                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                                i < step ? 'bg-primary text-primary-foreground' : i === step ? 'border-2 border-primary text-primary' : 'border border-border text-muted-foreground'
                            )}
                        >
                            {i < step ? <IconCheck size={14} /> : i + 1}
                        </span>
                        <span className={cn('text-sm', i === step ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{label}</span>
                    </div>
                    {i < STEP_LABELS.length - 1 && <div className={cn('mx-3 h-px flex-1', i < step ? 'bg-primary' : 'bg-border')} />}
                </div>
            ))}
        </div>
    );
}

const AGRUPACION_OPTIONS: { value: AgrupacionTipo; title: string; desc: string }[] = [
    { value: 'SIN_AGRUPACION', title: 'Sin agrupación (recomendado)', desc: 'Todos los casos de un mismo cliente van en una sola pre-factura.' },
    { value: 'CENTRO', title: 'Por centro', desc: 'Una pre-factura distinta por cada centro del cliente.' },
    { value: 'TIPO_AGUA', title: 'Por tipo de agua', desc: 'Una pre-factura distinta por cada tipo de agua muestreada.' },
];

const FacturacionProcesar: React.FC = () => {
    const { showToast } = useToast();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [casos, setCasos] = useState<CasoFacturable[]>([]);
    const [buscado, setBuscado] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [page, setPage] = useState(1);
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
    const [idEmpresaServicioFiltro, setIdEmpresaServicioFiltro] = useState<string | undefined>();
    const [idCentroFiltro, setIdCentroFiltro] = useState<string | undefined>();

    useEffect(() => {
        facturacionService.listarFormasPago().then(setFormasPago).catch(() => showToast({ type: 'error', message: 'No se pudieron cargar las formas de pago' }));
        facturacionService.listarGlosas().then(setGlosas).catch(() => showToast({ type: 'error', message: 'No se pudieron cargar las glosas' }));
        catalogosService.getEmpresasServicio()
            .then((raw: any[]) => setEmpresas(raw.map((e) => ({ id: e.id_empresaservicio, nombre: e.nombre_empresaservicios }))))
            .catch(() => showToast({ type: 'error', message: 'No se pudieron cargar los clientes' }));
    }, []);

    const onEmpresaFiltroChange = async (val: string | undefined) => {
        setIdEmpresaServicioFiltro(val);
        setIdCentroFiltro(undefined);
        setCentros([]);
        if (!val) return;
        try {
            const raw: any[] = await catalogosService.getCentros(undefined, Number(val));
            setCentros(raw.map((c) => ({ id: c.id_centro, nombre: c.nombre_centro })));
        } catch { /* noop */ }
    };

    const buscarCasos = async () => {
        setLoading(true);
        setBuscado(true);
        try {
            const filtros: Record<string, any> = {};
            if (fechaDesde) filtros.fechaInicio = fechaDesde;
            if (fechaHasta) filtros.fechaFin = fechaHasta;
            if (idEmpresaServicioFiltro) filtros.idEmpresaServicio = Number(idEmpresaServicioFiltro);
            if (idCentroFiltro) filtros.idCentro = Number(idCentroFiltro);
            const data = await facturacionService.getCasosFacturables(filtros);
            setCasos(data || []);
            setSelectedIds([]);
            setPage(1);
        } catch {
            showToast({ type: 'error', message: 'No se pudieron cargar los casos facturables' });
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

    const totalPages = Math.max(1, Math.ceil(casos.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const paginatedCasos = casos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const allPageSelected = paginatedCasos.length > 0 && paginatedCasos.every((c) => selectedIds.includes(c.id_agendamam));

    const toggleSelected = (id: number) =>
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));

    const togglePageSelected = () => {
        const pageIds = paginatedCasos.map((c) => c.id_agendamam);
        setSelectedIds((prev) => (allPageSelected ? prev.filter((id) => !pageIds.includes(id)) : [...new Set([...prev, ...pageIds])]));
    };

    /** Al pasar a "Agrupar y configurar": auto-carga forma de pago del cliente (si la selección es de uno solo) y genera una glosa por defecto. */
    const irAConfigurar = async () => {
        setStep(1);
        if (!glosa) {
            const mesAnio = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
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
            showToast({ type: 'error', message: e?.message || 'No se pudo generar la vista previa' });
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
            showToast({ type: 'success', message: 'Pre-factura(s) creada(s) correctamente' });
            // Se generan los PDF de inmediato para que el documento quede a la
            // vista sin un paso extra: crear la pre-factura y no poder verla
            // era justo donde el proceso se cortaba.
            generarPdfsDeResultado(r);
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudieron crear las pre-facturas' });
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
            showToast({ type: 'success', message: `Pre-factura N° ${numeroId} publicada en el portal del cliente` });
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo publicar en el portal' });
        } finally {
            setPublicando(null);
        }
    };

    const enviarEmail = async (idPrefactura: number, numeroId: number) => {
        setEnviando(idPrefactura);
        try {
            await facturacionService.enviarPorEmail(idPrefactura);
            setEnviadas((prev) => ({ ...prev, [idPrefactura]: true }));
            showToast({ type: 'success', message: `Pre-factura N° ${numeroId} enviada por email` });
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo enviar el email' });
        } finally {
            setEnviando(null);
        }
    };

    const reiniciar = () => {
        setStep(0); setCasos([]); setSelectedIds([]); setBuscado(false); setPage(1);
        setResultado(null); setAgrupacionTipo('SIN_AGRUPACION'); setFormaPago(''); setGlosa(''); setObservaciones('');
        setPdfs({}); setPublicadas({}); setEnviadas({});
    };

    return (
        <div className="shadcn-scope w-full p-6 pb-12">
            <h2 className="mb-1 text-[22px] font-bold tracking-tight text-foreground">Procesar Facturación</h2>
            <p className="mb-6 text-sm text-muted-foreground">Selecciona casos con informe cerrado, agrúpalos y genera las pre-facturas.</p>

            <StepHeader step={step} />

            {step === 0 && (
                <>
                    <div className="mb-4 flex flex-wrap items-center gap-2.5">
                        <Combobox
                            value={idEmpresaServicioFiltro}
                            onValueChange={onEmpresaFiltroChange}
                            placeholder="Cliente"
                            searchPlaceholder="Buscar cliente..."
                            className="w-60"
                            options={[{ value: '', label: 'Todos los clientes' }, ...empresas.map((e) => ({ value: String(e.id), label: e.nombre }))]}
                        />
                        <Combobox
                            value={idCentroFiltro}
                            onValueChange={setIdCentroFiltro}
                            placeholder="Centro"
                            searchPlaceholder="Buscar centro..."
                            className="w-52"
                            disabled={!idEmpresaServicioFiltro}
                            options={[{ value: '', label: 'Todos los centros' }, ...centros.map((c) => ({ value: String(c.id), label: c.nombre }))]}
                        />
                        <DatePicker value={fechaDesde} onChange={setFechaDesde} placeholder="Informe desde" className="w-44" />
                        <DatePicker value={fechaHasta} onChange={setFechaHasta} placeholder="Informe hasta" className="w-44" />
                        <Button disabled={loading} onClick={buscarCasos}>
                            {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <IconSearch size={15} />}
                            Buscar casos facturables
                        </Button>
                    </div>

                    {!buscado ? (
                        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                            Define un rango de fechas (opcional) y busca los casos facturables.
                        </p>
                    ) : casos.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                            No hay casos facturables con esos filtros.
                        </p>
                    ) : (
                        <>
                            <div className="overflow-hidden rounded-xl border border-border bg-card">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="w-10">
                                                <Checkbox checked={allPageSelected} onCheckedChange={togglePageSelected} aria-label="Seleccionar todos" />
                                            </TableHead>
                                            <TableHead>N° Caso</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Centro</TableHead>
                                            <TableHead>Fecha informe</TableHead>
                                            <TableHead className="text-right">Precio</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paginatedCasos.map((c) => (
                                            <TableRow key={c.id_agendamam}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedIds.includes(c.id_agendamam)}
                                                        onCheckedChange={() => toggleSelected(c.id_agendamam)}
                                                        aria-label={`Seleccionar caso ${c.n_caso}`}
                                                    />
                                                </TableCell>
                                                <TableCell>{c.n_caso}</TableCell>
                                                <TableCell className="max-w-[220px] truncate">{c.empresaservicio_nombre}</TableCell>
                                                <TableCell className="max-w-[180px] truncate">{c.centro_nombre}</TableCell>
                                                <TableCell>{c.fecha_informe ? new Date(c.fecha_informe).toLocaleDateString('es-CL') : '—'}</TableCell>
                                                <TableCell className="text-right tabular-nums">{Number(c.precio_uf).toFixed(2)} UF</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="mt-3">
                                <DataPagination page={currentPage} pageSize={PAGE_SIZE} total={casos.length} onPageChange={setPage} />
                            </div>
                            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                                <div className="text-sm text-muted-foreground">
                                    <b className="tabular-nums text-foreground">{selectedIds.length}</b> caso(s) seleccionado(s) · <b className="tabular-nums text-foreground">{totalUfSeleccionado.toFixed(2)}</b> UF
                                </div>
                                <Button disabled={selectedIds.length === 0} onClick={irAConfigurar}>
                                    Continuar <IconArrowRight size={15} />
                                </Button>
                            </div>
                        </>
                    )}
                </>
            )}

            {step === 1 && (
                <>
                    <p className="mb-2.5 text-sm font-semibold text-foreground">Agrupación de la(s) pre-factura(s)</p>
                    <div className="mb-5 flex flex-col gap-2">
                        {AGRUPACION_OPTIONS.map((opt) => (
                            <label
                                key={opt.value}
                                className={cn(
                                    'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                                    agrupacionTipo === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                                )}
                            >
                                <input
                                    type="radio"
                                    name="agrupacionTipo"
                                    className="mt-1 h-4 w-4 accent-[var(--sc-primary)]"
                                    checked={agrupacionTipo === opt.value}
                                    onChange={() => setAgrupacionTipo(opt.value)}
                                />
                                <span>
                                    <span className="block text-sm font-semibold text-foreground">{opt.title}</span>
                                    <span className="block text-xs text-muted-foreground">{opt.desc}</span>
                                </span>
                            </label>
                        ))}
                    </div>

                    <p className="mb-2.5 text-sm font-semibold text-foreground">Datos adicionales</p>
                    <div className="mb-5 flex flex-col gap-2.5">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Forma de pago"
                                value={formaPago}
                                onChange={(e) => setFormaPago(e.target.value)}
                                className="flex-1"
                            />
                            <Combobox
                                value={undefined}
                                onValueChange={setFormaPago}
                                placeholder={cargandoConfig ? 'Cargando...' : 'Elegir'}
                                searchPlaceholder="Buscar forma de pago..."
                                className="w-44"
                                disabled={cargandoConfig}
                                options={formasPago.map((f) => ({ value: f.nombre_formapago, label: f.nombre_formapago }))}
                            />
                        </div>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Glosa"
                                value={glosa}
                                onChange={(e) => setGlosa(e.target.value)}
                                className="flex-1"
                            />
                            <Combobox
                                value={undefined}
                                onValueChange={setGlosa}
                                placeholder="Elegir"
                                searchPlaceholder="Buscar glosa..."
                                className="w-44"
                                options={glosas.map((g) => ({ value: g.nombre_glosa, label: g.nombre_glosa }))}
                            />
                        </div>
                        <textarea
                            placeholder="Observaciones"
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            rows={2}
                            className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>

                    <div className="flex items-center justify-between border-t border-border pt-4">
                        <Button variant="outline" onClick={() => setStep(0)}><IconArrowLeft size={15} /> Atrás</Button>
                        <div className="flex gap-2">
                            <Button variant="outline" disabled={previsualizando} onClick={previsualizarPdf}>
                                {previsualizando ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <IconEye size={15} />}
                                Vista previa PDF
                            </Button>
                            <Button onClick={() => setStep(2)}>Continuar <IconArrowRight size={15} /></Button>
                        </div>
                    </div>
                </>
            )}

            {step === 2 && (
                <>
                    <div className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                        <p className="font-medium text-foreground">Se crearán {grupos.length} pre-factura(s)</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Revisa la agrupación antes de confirmar. Los casos se reclaman de forma exclusiva al crear la pre-factura.
                        </p>
                    </div>
                    {grupos.map((g, i) => {
                        const totalUf = g.casos.reduce((s, c) => s + Number(c.precio_uf || 0), 0);
                        return (
                            <div key={i} className="mb-2.5 rounded-lg border border-border bg-card p-3.5">
                                <div className="text-sm font-semibold text-foreground">{g.empresa}{g.sub ? ` — ${g.sub}` : ''}</div>
                                <div className="mt-0.5 text-xs text-muted-foreground">{g.casos.length} caso(s) · {totalUf.toFixed(2)} UF</div>
                            </div>
                        );
                    })}

                    <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                        <Button variant="outline" onClick={() => setStep(1)}><IconArrowLeft size={15} /> Atrás</Button>
                        <Button disabled={creando} onClick={confirmar}>
                            {creando ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <IconCircleCheck size={15} />}
                            Confirmar y crear pre-facturas
                        </Button>
                    </div>
                </>
            )}

            {step === 3 && resultado && (
                <div className="flex flex-col items-center gap-6 py-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
                        <IconCircleCheck size={36} className="text-success" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">Pre-facturas creadas</h3>
                        <p className="mt-1 text-sm text-muted-foreground">Se generaron {resultado.length} pre-factura(s) correctamente.</p>
                    </div>

                    <div className="flex w-full max-w-xl flex-col gap-2.5 text-left">
                        {resultado.map((r) => {
                            const pdf = pdfs[r.id_prefactura];
                            return (
                                <Card key={r.id_prefactura}>
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <IconFileInvoice size={18} className="text-primary" />
                                                <span className="font-semibold text-foreground">PF #{r.numero_id}</span>
                                                <Badge variant="outline">{r.agrupacion_valor || 'Sin agrupación'}</Badge>
                                            </div>
                                            <span className="text-sm font-semibold tabular-nums text-foreground">{Number(r.total_uf).toFixed(2)} UF</span>
                                        </div>

                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={!pdf?.pdf_resumen_path}
                                                onClick={() => setPreviewUrl(`${API_CONFIG.getBaseURL()}${pdf.pdf_resumen_path}`)}
                                            >
                                                {!pdf ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <IconEye size={14} />}
                                                {pdf ? 'Ver documento' : 'Generando PDF…'}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={enviadas[r.id_prefactura]}
                                                onClick={() => enviarEmail(r.id_prefactura, r.numero_id)}
                                            >
                                                {enviando === r.id_prefactura ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <IconMail size={14} />}
                                                {enviadas[r.id_prefactura] ? 'Enviada por email' : 'Enviar por email'}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant={publicadas[r.id_prefactura] ? 'outline' : 'default'}
                                                disabled={publicadas[r.id_prefactura]}
                                                title="Queda disponible en ADL WEB GO, donde el cliente puede cargar su OC"
                                                onClick={() => publicar(r.id_prefactura, r.numero_id)}
                                            >
                                                {publicando === r.id_prefactura ? <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <IconWorldUpload size={14} />}
                                                {publicadas[r.id_prefactura] ? 'Publicada en el portal' : 'Publicar en el portal'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    <Button variant="outline" onClick={reiniciar}>Procesar más casos</Button>
                </div>
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
