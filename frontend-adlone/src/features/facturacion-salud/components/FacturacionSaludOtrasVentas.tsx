import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    IconPlus,
    IconSearch,
    IconRefresh,
    IconFilePlus,
    IconAlertTriangle,
    IconCheck,
    IconX,
} from '@tabler/icons-react';
import { facturacionSaludService } from '../services/facturacionSalud.service';
import { useToast } from '../../../contexts/ToastContext';

const TIPOS_DOC = [
    { id: 1, codigo: 'FEA', label: '1 — FEA (Factura Afecta Otras Ventas)' },
    { id: 11, codigo: 'FEE', label: '11 — FEE (Factura Electrónica Exenta)' },
    { id: 8, codigo: 'NCE', label: '8 — NCE (Nota de Crédito Electrónica)' },
    { id: 10, codigo: 'NDE', label: '10 — NDE (Nota de Débito Electrónica)' },
];

// Selector de tipo con el mismo diseño de los flujos de Exportación DTE.
const FILTROS_TIPO = [
    { id: 'ALL', label: 'Todos los documentos', sub: 'facturacion_otro', desc: 'Todos los documentos de facturacion_otro: FEA, FEE, NCE y NDE.' },
    { id: '1', label: '1. FEA Otras Ventas (Afectas 19%)', sub: 'id_tipodocumento = 1', desc: 'Facturas afectas de otras ventas (totaldoc = neto * 1.19).' },
    { id: '11', label: '2. FEE Facturas Exentas (Sin IVA)', sub: 'id_tipodocumento = 11', desc: 'Facturas exentas de IVA (totaldoc = neto).' },
    { id: '8', label: '3. NCE Notas de Crédito', sub: 'id_tipodocumento = 8', desc: 'Notas de crédito: anulan, corrigen texto o reversan casos de la factura de referencia.' },
    { id: '10', label: '4. NDE Notas de Débito', sub: 'id_tipodocumento = 10', desc: 'Notas de débito sobre una factura de referencia.' },
];

const CODIGOS_RAZON_NC = [
    {
        id: 1,
        label: '1 — Anula Documento de Referencia',
        desc: 'Elimina la factura referenciada de facturacion_enc y libera automáticamente todos sus casos al estado ENVIADO (id_facturacion = 0).',
    },
    {
        id: 2,
        label: '2 — Corrige Texto Documento de Referencia',
        desc: 'Nota de crédito formal por corrección de glosa/datos. Mantiene los casos en estado FACTURADO.',
    },
    {
        id: 3,
        label: '3 — Corrige Montos (Reversa Selectiva de Casos)',
        desc: "Permite marcar qué casos de la factura se reversan (marcareversa = 'S') y suma automáticamente sus montos en UF.",
    },
];

const FacturacionSaludOtrasVentas: React.FC = () => {
    const { showToast } = useToast();

    const [documentos, setDocumentos] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [tipoFilter, setTipoFilter] = useState<string>('ALL');
    const [emitidoFilter, setEmitidoFilter] = useState<string>('ALL');
    const [busqueda, setBusqueda] = useState<string>('');

    const [maestros, setMaestros] = useState<any>({
        empresasServicio: [],
        formasPago: [],
        glosas: [],
    });

    // Modal de creación de nuevo documento en facturacion_otro
    const [modalOpen, setModalOpen] = useState<boolean>(false);
    const [saving, setSaving] = useState<boolean>(false);
    const [form, setForm] = useState({
        id_tipodocumento: 1,
        id_empresaservicio: 0,
        concepto_cobro: '',
        fecha_documento: new Date().toISOString().slice(0, 10),
        uf: 38500,
        monto_uf: 0,
        monto: 0,
        observacion: '',
        tipo_ref: '33',
        num_ref: '',
        fecha_ref: '',
        cod_razon: 1,
        motivo: 'ANULA FACTURA',
        nota: '',
        tipoimpuesto: 'AFE',
        id_formapago: 1,
        origen_referencia: 'CASOS' as 'CASOS' | 'OTRAS_VENTAS',
        id_facturacion_referencia: null as number | null,
    });

    // Buscador de Factura de Referencia para NC / ND
    const [folioBuscar, setFolioBuscar] = useState<string>('');
    const [buscandoRef, setBuscandoRef] = useState<boolean>(false);
    const [facturaRef, setFacturaRef] = useState<any | null>(null);
    const [casosRef, setCasosRef] = useState<any[]>([]);
    const [casosReversarIds, setCasosReversarIds] = useState<Set<number>>(new Set());

    const cargarDocumentos = useCallback(async () => {
        setLoading(true);
        try {
            const lista = await facturacionSaludService.listarOtrosCobros({
                id_tipodocumento: tipoFilter,
                emitido: emitidoFilter,
                busqueda,
                limite: 300,
            });
            setDocumentos(lista || []);
        } catch (e: any) {
            showToast({
                type: 'error',
                message: e?.response?.data?.message || 'Error al cargar documentos de Otras Ventas / Notas',
            });
        } finally {
            setLoading(false);
        }
    }, [tipoFilter, emitidoFilter, busqueda, showToast]);

    useEffect(() => {
        cargarDocumentos();
    }, [cargarDocumentos]);

    useEffect(() => {
        facturacionSaludService
            .getMaestros()
            .then((d) => {
                setMaestros(d);
                if (d.empresasServicio?.length > 0) {
                    setForm((prev) => ({
                        ...prev,
                        id_empresaservicio: d.empresasServicio[0].id_empresaservicio,
                    }));
                }
            })
            .catch(() => {});

        facturacionSaludService
            .getDashboard()
            .then((d) => {
                if (d?.kpis?.ultimaUf) {
                    setForm((prev) => ({ ...prev, uf: Number(d.kpis.ultimaUf) }));
                }
            })
            .catch(() => {});
    }, []);

    const handleBuscarReferencia = async () => {
        if (!folioBuscar.trim()) return;
        setBuscandoRef(true);
        try {
            const res = await facturacionSaludService.buscarFacturaReferencia(
                folioBuscar.trim(),
                form.origen_referencia
            );
            const doc = res.documento;
            setFacturaRef(doc);
            setCasosRef(res.casos || []);
            setCasosReversarIds(new Set());

            const ufDoc = Number(doc.uf || form.uf || 38500);
            const ufTot = Number(doc.uf_totalfac || 0);
            const clpTot = Number(doc.peso_totalfac || Math.round(ufTot * ufDoc));

            setForm((prev) => ({
                ...prev,
                id_facturacion_referencia: Number(doc.id_facturacion),
                id_empresaservicio: Number(doc.id_empresaservicio),
                uf: ufDoc,
                monto_uf: prev.cod_razon === 2 ? 0 : ufTot,
                monto: prev.cod_razon === 2 ? 0 : clpTot,
                num_ref: String(doc.factura || doc.id_facturacion),
                fecha_ref: doc.fecha_facturacion || '',
                concepto_cobro:
                    prev.id_tipodocumento === 8
                        ? `NOTA DE CRÉDITO REF. FACTURA #${doc.factura || doc.id_facturacion}`
                        : `NOTA DE DÉBITO REF. FACTURA #${doc.factura || doc.id_facturacion}`,
            }));

            showToast({
                type: 'success',
                message: `Factura #${doc.id_facturacion} (${doc.nombre_empresaservicios}) cargada con ${res.casos?.length || 0} caso(s).`,
            });
        } catch (e: any) {
            showToast({
                type: 'error',
                message: e?.response?.data?.message || 'No se encontró la factura de referencia',
            });
            setFacturaRef(null);
            setCasosRef([]);
        } finally {
            setBuscandoRef(false);
        }
    };

    // Cuando cod_razon = 3 (Corrige Montos / Reversa Parcial), recalcular monto_uf según los casos marcados
    useEffect(() => {
        if (form.id_tipodocumento === 8 && Number(form.cod_razon) === 3 && casosRef.length > 0) {
            const sumaUf = casosRef
                .filter((c) => casosReversarIds.has(Number(c.id_caso)))
                .reduce((acc, c) => acc + Number(c.uf_totalfac || c.vtatotal || 0), 0);
            const ufRed = Math.round(sumaUf * 100) / 100;
            setForm((prev) => ({
                ...prev,
                monto_uf: ufRed,
                monto: Math.round(ufRed * Number(prev.uf || 0)),
            }));
        }
    }, [casosReversarIds, casosRef, form.id_tipodocumento, form.cod_razon]);

    const handleCrearDocumento = async () => {
        if (!form.id_empresaservicio) {
            showToast({ type: 'error', message: 'Seleccione una Empresa de Servicio.' });
            return;
        }
        if (!form.concepto_cobro.trim()) {
            showToast({ type: 'error', message: 'Ingrese el Concepto de Cobro / Glosa.' });
            return;
        }
        setSaving(true);
        try {
            const res = await facturacionSaludService.crearOtroCobro({
                ...form,
                casos_reversar_ids: Array.from(casosReversarIds),
            });
            showToast({
                type: 'success',
                message: `Documento #${res.id_facturacion} creado exitosamente. ${res.accionCasos !== 'NINGUNA' ? res.accionCasos : ''}`,
            });
            setModalOpen(false);
            setFacturaRef(null);
            setCasosRef([]);
            setCasosReversarIds(new Set());
            cargarDocumentos();
        } catch (e: any) {
            showToast({
                type: 'error',
                message: e?.response?.data?.message || 'Error al registrar documento',
            });
        } finally {
            setSaving(false);
        }
    };

    const fmtUf = (n: number) =>
        Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtClp = (n: number) =>
        Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

    const esNota = form.id_tipodocumento === 8 || form.id_tipodocumento === 10;

    const badgePorTipo = (td: number) => {
        if (td === 1) return <Badge variant="secondary">1 · FEA Otras Ventas</Badge>;
        if (td === 11) return <Badge variant="outline">11 · FEE Exenta</Badge>;
        if (td === 8) return <Badge variant="destructive">8 · NCE Nota Crédito</Badge>;
        if (td === 10) return <Badge variant="warning">10 · NDE Nota Débito</Badge>;
        return <Badge variant="outline">Tipo {td}</Badge>;
    };

    return (
        <div className="space-y-4">
            {/* Tipos de documento (mismo diseño que los flujos de Exportación DTE) */}
            <Card className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h3 className="m-0 text-base font-bold text-foreground">
                            Otras Ventas, Facturas Exentas y Notas de Crédito / Débito (facturacion_otro)
                        </h3>
                        <p className="m-0 text-xs text-muted-foreground">
                            Replica <span className="font-mono">fac_otrasventas_v2.scx</span> y{' '}
                            <span className="font-mono">fac_reversa_nc_casos.scx</span> (liberación automática o
                            reversa selectiva de casos por Nota de Crédito)
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={cargarDocumentos}>
                        <IconRefresh size={15} /> Recargar
                    </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                    {FILTROS_TIPO.map((t) => {
                        const active = tipoFilter === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTipoFilter(t.id)}
                                className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                                    active
                                        ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-sm'
                                        : 'border-border bg-background text-foreground hover:bg-muted/50'
                                }`}
                            >
                                <div>{t.label}</div>
                                <div className={`font-mono text-[10px] ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                                    {t.sub}
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <IconSearch size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Filtrar por ID, Cliente, Concepto o Referencia..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="h-8 w-64 rounded border border-input bg-background pl-8 pr-2 text-xs"
                            />
                        </div>

                        <select
                            value={emitidoFilter}
                            onChange={(e) => setEmitidoFilter(e.target.value)}
                            className="h-8 rounded border border-input bg-background px-2 text-xs font-medium"
                        >
                            <option value="ALL">Estado DTE: Todos</option>
                            <option value="N">Solo pendientes de emisión (emitido &lt;&gt; 'S')</option>
                            <option value="S">Solo emitidos (emitido = 'S')</option>
                        </select>
                    </div>

                    <Button size="sm" onClick={() => setModalOpen(true)}>
                        <IconPlus size={15} /> Nuevo Documento / Nota de Crédito
                    </Button>
                </div>
            </Card>

            {/* Tabla de Documentos del tipo seleccionado */}
            <Card className="p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{FILTROS_TIPO.find((t) => t.id === tipoFilter)?.desc}</span>
                    <span>
                        Mostrando <strong>{documentos.length}</strong> documento(s)
                    </span>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-xs text-muted-foreground">
                        Cargando registros de facturacion_otro...
                    </div>
                ) : (
                    <div className="max-h-[500px] overflow-auto">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                                <tr className="border-b border-border text-[11px] uppercase text-muted-foreground">
                                    <th className="py-2 pl-2 pr-2">ID Fact.</th>
                                    <th className="py-2 px-2">Tipo Documento</th>
                                    <th className="py-2 px-2">Fecha</th>
                                    <th className="py-2 px-2">Cliente / RUT</th>
                                    <th className="py-2 px-2">Concepto / Glosa</th>
                                    <th className="py-2 px-2">Referencia (NC/ND)</th>
                                    <th className="py-2 px-2 text-right">Monto UF</th>
                                    <th className="py-2 px-2 text-right">Neto ($ CLP)</th>
                                    <th className="py-2 pl-2 pr-2 text-right">Estado DTE</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {documentos.map((doc) => (
                                    <tr key={doc.id_otroscobros} className="hover:bg-muted/30">
                                        <td className="py-2 pl-2 pr-2 font-mono font-bold text-primary">
                                            #{doc.id_facturacion}
                                        </td>
                                        <td className="py-2 px-2">{badgePorTipo(Number(doc.id_tipodocumento))}</td>
                                        <td className="py-2 px-2 font-mono text-[11px]">{doc.fecha_documento}</td>
                                        <td className="py-2 px-2">
                                            <div className="font-semibold text-foreground">
                                                {doc.nombre_empresaservicios}
                                            </div>
                                            <div className="font-mono text-[10px] text-muted-foreground">
                                                {doc.rut_empresaservicios}
                                            </div>
                                        </td>
                                        <td className="py-2 px-2 max-w-xs truncate" title={doc.concepto_cobro}>
                                            {doc.concepto_cobro}
                                        </td>
                                        <td className="py-2 px-2 text-[11px]">
                                            {doc.num_ref ? (
                                                <div>
                                                    <span className="font-mono font-semibold">
                                                        Ref #{doc.num_ref}
                                                    </span>{' '}
                                                    ({doc.fecha_ref})
                                                    {doc.cod_razon > 0 && (
                                                        <div className="text-[10px] text-muted-foreground">
                                                            Cód. Razón {doc.cod_razon}: {doc.motivo}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-2 text-right font-mono">
                                            {fmtUf(doc.monto_uf)} UF
                                        </td>
                                        <td className="py-2 px-2 text-right font-mono font-bold text-foreground">
                                            $ {fmtClp(doc.monto)}
                                        </td>
                                        <td className="py-2 pl-2 pr-2 text-right">
                                            <Badge
                                                variant={doc.emitido === 'S' ? 'success' : 'warning'}
                                                className="text-[10px]"
                                            >
                                                {doc.emitido === 'S' ? 'Emitido DTE' : 'Pendiente DTE'}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                                {documentos.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="py-8 text-center text-muted-foreground">
                                            No hay documentos de este tipo para los filtros seleccionados.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Modal para Emitir Nuevo Documento (FEA, FEE, NCE con reversa de casos, NDE) */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <Card className="max-h-[92vh] w-full max-w-4xl overflow-y-auto p-5">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <div>
                                <h3 className="m-0 text-base font-bold text-foreground">
                                    Registrar Documento en Otras Ventas / Nota de Crédito o Débito
                                </h3>
                                <p className="m-0 text-xs text-muted-foreground">
                                    Inserta en <span className="font-mono">dbo.facturacion_otro</span> en localhost y
                                    ejecuta las reglas de reversa sobre casos si es Nota de Crédito (NCE).
                                </p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
                                <IconX size={16} />
                            </Button>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="md:col-span-2">
                                <label className="mb-1 block text-xs font-semibold">Tipo de Documento</label>
                                <select
                                    value={form.id_tipodocumento}
                                    onChange={(e) => {
                                        const td = Number(e.target.value);
                                        setForm({
                                            ...form,
                                            id_tipodocumento: td,
                                            tipoimpuesto: td === 11 ? 'EXE' : 'AFE',
                                        });
                                    }}
                                    className="h-9 w-full rounded border border-input bg-background px-2.5 text-xs font-semibold"
                                >
                                    {TIPOS_DOC.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold">Fecha Documento</label>
                                <input
                                    type="date"
                                    value={form.fecha_documento}
                                    onChange={(e) => setForm({ ...form, fecha_documento: e.target.value })}
                                    className="h-9 w-full rounded border border-input bg-background px-2.5 text-xs"
                                />
                            </div>
                        </div>

                        {/* Bloque Especial para Notas de Crédito (8 = NCE) y Notas de Débito (10 = NDE) */}
                        {esNota && (
                            <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3.5 space-y-3">
                                <h4 className="m-0 text-xs font-bold uppercase text-amber-700 dark:text-amber-400">
                                    Documento de Referencia Tributaria y Reversa de Casos (NCE / NDE)
                                </h4>

                                <div className="grid gap-2 md:grid-cols-4">
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold">Origen Factura</label>
                                        <select
                                            value={form.origen_referencia}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    origen_referencia: e.target.value as 'CASOS' | 'OTRAS_VENTAS',
                                                })
                                            }
                                            className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                                        >
                                            <option value="CASOS">Factura de Casos (facturacion_enc)</option>
                                            <option value="OTRAS_VENTAS">Otras Ventas (facturacion_otro)</option>
                                        </select>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="mb-1 block text-xs font-semibold">
                                            Buscar por ID Facturación o N° Folio Factura
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Ej: 74906"
                                                value={folioBuscar}
                                                onChange={(e) => setFolioBuscar(e.target.value)}
                                                className="h-8 flex-1 rounded border border-input bg-background px-2 font-mono text-xs"
                                            />
                                            <Button
                                                size="sm"
                                                className="h-8 px-3 text-xs"
                                                onClick={handleBuscarReferencia}
                                                disabled={buscandoRef}
                                            >
                                                <IconSearch size={13} />{' '}
                                                {buscandoRef ? 'Buscando...' : 'Cargar Factura'}
                                            </Button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-xs font-semibold">Impuesto Referencia</label>
                                        <select
                                            value={form.tipoimpuesto}
                                            onChange={(e) => setForm({ ...form, tipoimpuesto: e.target.value })}
                                            className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                                        >
                                            <option value="AFE">AFE (Afecta a IVA 19%)</option>
                                            <option value="EXE">EXE (Exenta de IVA)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid gap-2 md:grid-cols-4">
                                    <div className="md:col-span-2">
                                        <label className="mb-1 block text-xs font-semibold">
                                            Código de Razón SII (cod_razon)
                                        </label>
                                        <select
                                            value={form.cod_razon}
                                            onChange={(e) => {
                                                const r = Number(e.target.value);
                                                setForm({
                                                    ...form,
                                                    cod_razon: r,
                                                    motivo:
                                                        r === 1
                                                            ? 'ANULA FACTURA'
                                                            : r === 2
                                                            ? 'CORRIGE TEXTO EN FACTURA'
                                                            : 'CORRIGE MONTO EN FACTURA',
                                                });
                                            }}
                                            className="h-8 w-full rounded border border-input bg-background px-2 text-xs font-semibold"
                                        >
                                            {CODIGOS_RAZON_NC.map((cr) => (
                                                <option key={cr.id} value={cr.id}>
                                                    {cr.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-xs font-semibold">Folio Ref (num_ref)</label>
                                        <input
                                            type="text"
                                            value={form.num_ref}
                                            onChange={(e) => setForm({ ...form, num_ref: e.target.value })}
                                            className="h-8 w-full rounded border border-input bg-background px-2 font-mono text-xs"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-xs font-semibold">
                                            Fecha Ref (fecha_ref)
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="DD/MM/YYYY"
                                            value={form.fecha_ref}
                                            onChange={(e) => setForm({ ...form, fecha_ref: e.target.value })}
                                            className="h-8 w-full rounded border border-input bg-background px-2 font-mono text-xs"
                                        />
                                    </div>
                                </div>

                                {/* Explicación del efecto de cod_razon sobre los casos */}
                                {form.id_tipodocumento === 8 && (
                                    <div className="flex items-start gap-2 rounded bg-background p-2.5 text-xs">
                                        <IconAlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                                        <div>
                                            <strong>Efecto en Casos de Laboratorio: </strong>
                                            {CODIGOS_RAZON_NC.find((c) => c.id === Number(form.cod_razon))?.desc}
                                        </div>
                                    </div>
                                )}

                                {/* Selector Interactivo de Casos para Reversa Parcial (cod_razon = 3) */}
                                {form.id_tipodocumento === 8 &&
                                    Number(form.cod_razon) === 3 &&
                                    casosRef.length > 0 && (
                                        <div className="rounded border border-border bg-background p-2.5">
                                            <p className="m-0 mb-2 text-xs font-bold">
                                                Seleccione los Casos a Reversar (marcareversa = 'S') —{' '}
                                                {casosReversarIds.size} seleccionado(s):
                                            </p>
                                            <div className="max-h-40 overflow-y-auto">
                                                <table className="w-full text-left text-xs">
                                                    <thead>
                                                        <tr className="border-b border-border text-[10px] text-muted-foreground">
                                                            <th className="py-1">Reversar</th>
                                                            <th className="py-1">Caso ADLAB</th>
                                                            <th className="py-1">Centro</th>
                                                            <th className="py-1 text-right">Total UF Caso</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-border/50">
                                                        {casosRef.map((c: any) => {
                                                            const idC = Number(c.id_caso);
                                                            const checked = casosReversarIds.has(idC);
                                                            return (
                                                                <tr key={idC}>
                                                                    <td className="py-1">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={checked}
                                                                            onChange={(e) => {
                                                                                const next = new Set(casosReversarIds);
                                                                                if (e.target.checked) next.add(idC);
                                                                                else next.delete(idC);
                                                                                setCasosReversarIds(next);
                                                                            }}
                                                                        />
                                                                    </td>
                                                                    <td className="py-1 font-mono font-bold">
                                                                        #{c.caso_adlab || c.id_caso}
                                                                    </td>
                                                                    <td className="py-1">{c.nombre_centro || '—'}</td>
                                                                    <td className="py-1 text-right font-mono">
                                                                        {fmtUf(c.uf_totalfac || c.vtatotal)} UF
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                            </div>
                        )}

                        {/* Datos del Cliente y Montos */}
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="md:col-span-2">
                                <label className="mb-1 block text-xs font-semibold">Empresa de Servicio</label>
                                <select
                                    value={form.id_empresaservicio}
                                    onChange={(e) =>
                                        setForm({ ...form, id_empresaservicio: Number(e.target.value) })
                                    }
                                    className="h-9 w-full rounded border border-input bg-background px-2.5 text-xs"
                                >
                                    {(maestros.empresasServicio || []).map((es: any) => (
                                        <option key={es.id_empresaservicio} value={es.id_empresaservicio}>
                                            {es.nombre_empresaservicios} ({es.rut_empresaservicios})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold">Forma de Pago</label>
                                <select
                                    value={form.id_formapago}
                                    onChange={(e) => setForm({ ...form, id_formapago: Number(e.target.value) })}
                                    className="h-9 w-full rounded border border-input bg-background px-2.5 text-xs"
                                >
                                    {(maestros.formasPago || []).map((fp: any) => (
                                        <option key={fp.id_formapago} value={fp.id_formapago}>
                                            {fp.nombre_formapago}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="md:col-span-3">
                                <label className="mb-1 block text-xs font-semibold">
                                    Concepto de Cobro / Glosa Principal (concepto_cobro)
                                </label>
                                <input
                                    type="text"
                                    value={form.concepto_cobro}
                                    onChange={(e) => setForm({ ...form, concepto_cobro: e.target.value })}
                                    placeholder="Ej: SERVICIO DE MUESTREO Y ANÁLISIS ESPECIAL..."
                                    className="h-9 w-full rounded border border-input bg-background px-2.5 text-xs"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold">Valor UF ($ CLP)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={form.uf}
                                    onChange={(e) => {
                                        const u = Number(e.target.value);
                                        setForm({
                                            ...form,
                                            uf: u,
                                            monto: Math.round(Number(form.monto_uf || 0) * u),
                                        });
                                    }}
                                    className="h-9 w-full rounded border border-input bg-background px-2.5 font-mono text-xs"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold">Monto en UF (monto_uf)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={form.monto_uf}
                                    onChange={(e) => {
                                        const mUf = Number(e.target.value);
                                        setForm({
                                            ...form,
                                            monto_uf: mUf,
                                            monto: Math.round(mUf * Number(form.uf || 0)),
                                        });
                                    }}
                                    className="h-9 w-full rounded border border-input bg-background px-2.5 font-mono text-xs font-bold"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold">Monto Neto en Pesos ($ CLP)</label>
                                <input
                                    type="number"
                                    step="1"
                                    value={form.monto}
                                    onChange={(e) => setForm({ ...form, monto: Number(e.target.value) })}
                                    className="h-9 w-full rounded border border-input bg-background px-2.5 font-mono text-xs font-bold"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="mb-1 block text-xs font-semibold">Motivo / Observación</label>
                                <input
                                    type="text"
                                    value={form.motivo}
                                    onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                                    className="h-9 w-full rounded border border-input bg-background px-2.5 text-xs"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold">Nota pie DTE</label>
                                <input
                                    type="text"
                                    value={form.nota}
                                    onChange={(e) => setForm({ ...form, nota: e.target.value })}
                                    className="h-9 w-full rounded border border-input bg-background px-2.5 text-xs"
                                />
                            </div>
                        </div>

                        <div className="mt-5 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setModalOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleCrearDocumento} disabled={saving}>
                                <IconCheck size={16} />
                                {saving ? 'Guardando Documento...' : 'Registrar Documento'}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default FacturacionSaludOtrasVentas;

