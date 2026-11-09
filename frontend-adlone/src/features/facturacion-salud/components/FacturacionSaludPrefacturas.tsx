import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    IconSearch,
    IconRefresh,
    IconFileSpreadsheet,
    IconTrash,
    IconPlus,
    IconDeviceFloppy,
    IconEye,
    IconX,
} from '@tabler/icons-react';
import { facturacionSaludService } from '../services/facturacionSalud.service';
import { useToast } from '../../../contexts/ToastContext';

const FacturacionSaludPrefacturas: React.FC = () => {
    const { showToast } = useToast();

    const [prefacturas, setPrefacturas] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [emitidoFilter, setEmitidoFilter] = useState<string>('N');
    const [busqueda, setBusqueda] = useState<string>('');

    const [maestros, setMaestros] = useState<any>({
        formasPago: [],
        glosas: [],
        otrosIngresos: [],
        otrosDescuentos: [],
    });

    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [detalle, setDetalle] = useState<any | null>(null);
    const [loadingDetalle, setLoadingDetalle] = useState<boolean>(false);

    // Formulario de edición de encabezado y OC/HES
    const [editEnc, setEditEnc] = useState<any>({
        fecha_facturacion: '',
        id_formapago: 1,
        id_glosa: 1,
        glosa: '',
        observaciones: '',
        nota: '',
        uf: 38500,
        ordenes_compra: [] as any[],
    });
    const [savingEnc, setSavingEnc] = useState<boolean>(false);

    // Formularios para agregar OI y OD
    const [nuevoOiId, setNuevoOiId] = useState<string>('');
    const [nuevoOiValor, setNuevoOiValor] = useState<string>('');
    const [nuevoOdId, setNuevoOdId] = useState<string>('');
    const [nuevoOdValor, setNuevoOdValor] = useState<string>('');

    const cargarPrefacturas = useCallback(async () => {
        setLoading(true);
        try {
            const lista = await facturacionSaludService.listarPrefacturas({
                emitido: emitidoFilter,
                busqueda,
                limite: 300,
            });
            setPrefacturas(lista || []);
        } catch (e: any) {
            showToast({
                type: 'error',
                message: e?.response?.data?.message || 'Error al cargar pre-facturas de Salud',
            });
        } finally {
            setLoading(false);
        }
    }, [emitidoFilter, busqueda, showToast]);

    useEffect(() => {
        cargarPrefacturas();
    }, [cargarPrefacturas]);

    useEffect(() => {
        facturacionSaludService
            .getMaestros()
            .then((d) => {
                setMaestros(d);
                if (d.otrosIngresos?.length > 0) setNuevoOiId(String(d.otrosIngresos[0].id_otrosingresos));
                if (d.otrosDescuentos?.length > 0) setNuevoOdId(String(d.otrosDescuentos[0].id_otrosdescuentos));
            })
            .catch(() => {});
    }, []);

    const abrirDetalle = async (idFacturacion: number) => {
        setSelectedId(idFacturacion);
        setLoadingDetalle(true);
        try {
            const det = await facturacionSaludService.getPrefacturaDetalle(idFacturacion);
            setDetalle(det);
            const enc = det.encabezado || {};
            setEditEnc({
                fecha_facturacion: enc.fecha_facturacion || '',
                id_formapago: enc.id_formapago || 1,
                id_glosa: enc.id_glosa || 1,
                glosa: enc.glosa || '',
                observaciones: enc.observaciones || '',
                nota: enc.nota || '',
                uf: enc.uf || 38500,
                ordenes_compra:
                    det.ordenesCompra && det.ordenesCompra.length > 0
                        ? det.ordenesCompra
                        : enc.ocompra
                        ? [
                              {
                                  ocompra: enc.ocompra,
                                  ocompra_fecha: enc.ocompra_fecha || '',
                                  referencia: 'Orden de Compra',
                                  tipo: 'OC',
                                  orden: 1,
                              },
                          ]
                        : [],
            });
        } catch (e: any) {
            showToast({
                type: 'error',
                message: e?.response?.data?.message || 'Error al cargar detalle de la pre-factura',
            });
        } finally {
            setLoadingDetalle(false);
        }
    };

    const handleGuardarDatosPrefactura = async () => {
        if (!selectedId) return;
        setSavingEnc(true);
        try {
            const updated = await facturacionSaludService.actualizarPrefactura(selectedId, editEnc);
            setDetalle(updated);
            showToast({
                type: 'success',
                message: `Pre-factura #${selectedId} actualizada (Glosa, Forma de Pago y OC/HES).`,
            });
            cargarPrefacturas();
        } catch (e: any) {
            showToast({
                type: 'error',
                message: e?.response?.data?.message || 'Error al actualizar la pre-factura',
            });
        } finally {
            setSavingEnc(false);
        }
    };

    const handleAgregarOi = async () => {
        if (!selectedId || !nuevoOiId || !nuevoOiValor || Number(nuevoOiValor) <= 0) return;
        try {
            const updated = await facturacionSaludService.agregarOtroIngreso(selectedId, {
                id_otrosingresos: Number(nuevoOiId),
                valor: Number(nuevoOiValor),
            });
            setDetalle(updated);
            setNuevoOiValor('');
            showToast({ type: 'success', message: 'Otro Ingreso (OI) agregado y total recalculado.' });
            cargarPrefacturas();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'Error al agregar Otro Ingreso' });
        }
    };

    const handleEliminarOi = async (idOi: number) => {
        if (!selectedId) return;
        try {
            const updated = await facturacionSaludService.eliminarOtroIngreso(selectedId, idOi);
            setDetalle(updated);
            showToast({ type: 'success', message: 'Otro Ingreso eliminado.' });
            cargarPrefacturas();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'Error al eliminar Otro Ingreso' });
        }
    };

    const handleAgregarOd = async () => {
        if (!selectedId || !nuevoOdId || !nuevoOdValor || Number(nuevoOdValor) <= 0) return;
        try {
            const updated = await facturacionSaludService.agregarOtroDescuento(selectedId, {
                id_otrosdescuentos: Number(nuevoOdId),
                valor: Number(nuevoOdValor),
            });
            setDetalle(updated);
            setNuevoOdValor('');
            showToast({ type: 'success', message: 'Otro Descuento (OD) agregado y total recalculado.' });
            cargarPrefacturas();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'Error al agregar Otro Descuento' });
        }
    };

    const handleEliminarOd = async (idOd: number) => {
        if (!selectedId) return;
        try {
            const updated = await facturacionSaludService.eliminarOtroDescuento(selectedId, idOd);
            setDetalle(updated);
            showToast({ type: 'success', message: 'Otro Descuento eliminado.' });
            cargarPrefacturas();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'Error al eliminar Otro Descuento' });
        }
    };

    const handleQuitarCaso = async (idCaso: number, casoAdlab: string) => {
        if (!selectedId) return;
        if (
            !window.confirm(
                `¿Quitar el Caso #${casoAdlab} de la Pre-Factura #${selectedId}? El caso volverá al estado 'ENVIADO' (id_facturacion = 0).`
            )
        ) {
            return;
        }
        try {
            const updated = await facturacionSaludService.quitarCasoPrefactura(selectedId, idCaso);
            setDetalle(updated);
            showToast({
                type: 'success',
                message: `Caso #${casoAdlab} quitado y liberado a 'ENVIADO'.`,
            });
            cargarPrefacturas();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'Error al quitar caso' });
        }
    };

    const handleEliminarPrefacturaCompleta = async (idFacturacion: number) => {
        if (
            !window.confirm(
                `¿Eliminar por completo la Pre-Factura #${idFacturacion} y devolver TODOS sus casos al estado 'ENVIADO' para reprocesar?`
            )
        ) {
            return;
        }
        try {
            await facturacionSaludService.eliminarPrefactura(idFacturacion);
            showToast({
                type: 'success',
                message: `Pre-Factura #${idFacturacion} eliminada. Todos sus casos volvieron a 'ENVIADO'.`,
            });
            if (selectedId === idFacturacion) {
                setSelectedId(null);
                setDetalle(null);
            }
            cargarPrefacturas();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'Error al eliminar pre-factura' });
        }
    };

    const fmtUf = (n: number) =>
        Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtClp = (n: number) =>
        Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

    return (
        <div className="space-y-4">
            {/* Barra de Filtros */}
            <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="m-0 text-base font-bold text-foreground">
                            Bandeja de Pre-Facturas de Casos (facturacion_enc)
                        </h3>
                        <p className="m-0 text-xs text-muted-foreground">
                            Replica <span className="font-mono">fac_facturacreada_oi_od.scx</span> y{' '}
                            <span className="font-mono">fac_elimina_reprocesa_v2.scx</span> (OI/OD, OC/HES, Excel y
                            Liberación de Casos)
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <IconSearch size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Buscar por ID, Folio, Cliente, RUT, OC..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="h-9 w-64 rounded-md border border-input bg-background pl-8 pr-3 text-xs"
                            />
                        </div>

                        <select
                            value={emitidoFilter}
                            onChange={(e) => setEmitidoFilter(e.target.value)}
                            className="h-9 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
                        >
                            <option value="N">Pendientes de Emisión DTE (emitido = N)</option>
                            <option value="S">Emitidas a DTE (emitido = S)</option>
                            <option value="ALL">Todas las Pre-Facturas</option>
                        </select>

                        <Button variant="outline" size="sm" onClick={cargarPrefacturas}>
                            <IconRefresh size={15} /> Actualizar
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Tabla Principal de Pre-Facturas */}
            <Card className="p-4">
                {loading ? (
                    <div className="py-12 text-center text-xs text-muted-foreground">
                        Consultando facturacion_enc en localhost...
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="border-b border-border text-[11px] uppercase text-muted-foreground">
                                    <th className="py-2 pr-2">ID Fact.</th>
                                    <th className="py-2 px-2">Fecha</th>
                                    <th className="py-2 px-2">Cliente / RUT</th>
                                    <th className="py-2 px-2">Agrupación</th>
                                    <th className="py-2 px-2 text-right">Casos</th>
                                    <th className="py-2 px-2 text-right">UF Casos</th>
                                    <th className="py-2 px-2 text-right">+OI / -OD</th>
                                    <th className="py-2 px-2 text-right">UF Final</th>
                                    <th className="py-2 px-2 text-right">Neto ($ CLP)</th>
                                    <th className="py-2 px-2">OC / DTE</th>
                                    <th className="py-2 pl-2 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {prefacturas.map((pf) => (
                                    <tr
                                        key={pf.id_facturacion}
                                        className={`hover:bg-muted/30 ${
                                            selectedId === pf.id_facturacion ? 'bg-primary/5' : ''
                                        }`}
                                    >
                                        <td className="py-2.5 pr-2 font-mono font-bold text-primary">
                                            #{pf.id_facturacion}
                                        </td>
                                        <td className="py-2.5 px-2 font-mono text-[11px]">
                                            {pf.fecha_facturacion}
                                        </td>
                                        <td className="py-2.5 px-2">
                                            <div className="font-semibold text-foreground">
                                                {pf.nombre_empresaservicios}
                                            </div>
                                            <div className="font-mono text-[10px] text-muted-foreground">
                                                {pf.rut_empresaservicios}
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-2 text-muted-foreground">
                                            {pf.facturado_por || 'Na'}
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-semibold">
                                            {pf.total_casos}
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-mono">
                                            {fmtUf(pf.uf_totalcaso)}
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-mono text-[11px]">
                                            <span className="text-emerald-600">+{fmtUf(pf.uf_totalotrosing)}</span> /{' '}
                                            <span className="text-rose-600">-{fmtUf(pf.uf_totalotrosdes)}</span>
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-mono font-bold text-foreground">
                                            {fmtUf(pf.uf_totalfac)} UF
                                        </td>
                                        <td className="py-2.5 px-2 text-right font-mono font-semibold text-foreground">
                                            $ {fmtClp(pf.peso_totalfac)}
                                        </td>
                                        <td className="py-2.5 px-2">
                                            <div className="flex flex-wrap items-center gap-1">
                                                {pf.ocompra && (
                                                    <Badge variant="outline" className="font-mono text-[10px]">
                                                        OC: {pf.ocompra}
                                                    </Badge>
                                                )}
                                                <Badge
                                                    variant={pf.emitido === 'S' ? 'success' : 'warning'}
                                                    className="text-[10px]"
                                                >
                                                    {pf.emitido === 'S' ? 'Emitida DTE' : 'Pend. DTE'}
                                                </Badge>
                                            </div>
                                        </td>
                                        <td className="py-2.5 pl-2 text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 px-2 text-xs"
                                                    onClick={() => abrirDetalle(pf.id_facturacion)}
                                                >
                                                    <IconEye size={13} /> Gestionar
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2 text-xs text-emerald-700"
                                                    title="Descargar Excel Detalle de Análisis"
                                                    onClick={() =>
                                                        facturacionSaludService.descargarExcelPrefactura(
                                                            pf.id_facturacion,
                                                            'DETALLE'
                                                        )
                                                    }
                                                >
                                                    <IconFileSpreadsheet size={14} /> Excel
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2 text-xs text-destructive"
                                                    title="Eliminar Pre-Factura y liberar casos a ENVIADO"
                                                    onClick={() => handleEliminarPrefacturaCompleta(pf.id_facturacion)}
                                                >
                                                    <IconTrash size={14} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {prefacturas.length === 0 && (
                                    <tr>
                                        <td colSpan={11} className="py-8 text-center text-muted-foreground">
                                            No se encontraron pre-facturas con los filtros seleccionados.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Modal de Gestión Integral de una Pre-Factura (OI, OD, OC/HES, Excel, Casos) */}
            {selectedId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <Card className="max-h-[92vh] w-full max-w-5xl overflow-y-auto p-5">
                        {loadingDetalle || !detalle ? (
                            <div className="py-12 text-center text-xs text-muted-foreground">
                                Cargando detalle de Pre-Factura #{selectedId}...
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {/* Encabezado del Modal */}
                                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="m-0 text-lg font-bold text-foreground">
                                                Pre-Factura #{detalle.encabezado.id_facturacion} ·{' '}
                                                {detalle.encabezado.nombre_empresaservicios}
                                            </h3>
                                            <Badge variant="outline" className="font-mono text-xs">
                                                {detalle.encabezado.rut_empresaservicios}
                                            </Badge>
                                        </div>
                                        <p className="m-0 mt-1 text-xs text-muted-foreground">
                                            Fórmula ADLSoft:{' '}
                                            <span className="font-mono">
                                                uf_totalfac ({fmtUf(detalle.encabezado.uf_totalfac)} UF) = uf_totalcaso
                                                ({fmtUf(detalle.encabezado.uf_totalcaso)}) + OI (
                                                {fmtUf(detalle.encabezado.uf_totalotrosing)}) - OD (
                                                {fmtUf(detalle.encabezado.uf_totalotrosdes)})
                                            </span>{' '}
                                            → Neto:{' '}
                                            <strong className="text-foreground">
                                                $ {fmtClp(detalle.encabezado.peso_totalfac)}
                                            </strong>
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                facturacionSaludService.descargarExcelPrefactura(selectedId, 'RESUMEN')
                                            }
                                        >
                                            <IconFileSpreadsheet size={15} /> Excel Resumen
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-emerald-600 text-emerald-700"
                                            onClick={() =>
                                                facturacionSaludService.descargarExcelPrefactura(selectedId, 'DETALLE')
                                            }
                                        >
                                            <IconFileSpreadsheet size={15} /> Excel Detalle (fac_excel_detalle)
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedId(null);
                                                setDetalle(null);
                                            }}
                                        >
                                            <IconX size={16} /> Cerrar
                                        </Button>
                                    </div>
                                </div>

                                {/* Sección 1: Otros Ingresos (OI) y Otros Descuentos (OD) */}
                                <div className="grid gap-4 md:grid-cols-2">
                                    {/* Otros Ingresos (facturacion_ing) */}
                                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3.5">
                                        <h4 className="m-0 mb-2 text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
                                            Otros Ingresos — OI (facturacion_ing)
                                        </h4>
                                        <div className="mb-2 flex gap-2">
                                            <select
                                                value={nuevoOiId}
                                                onChange={(e) => setNuevoOiId(e.target.value)}
                                                className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs"
                                            >
                                                {(maestros.otrosIngresos || []).map((oi: any) => (
                                                    <option key={oi.id_otrosingresos} value={oi.id_otrosingresos}>
                                                        {oi.nombre_otrosingresos}
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                step="0.01"
                                                placeholder="UF"
                                                value={nuevoOiValor}
                                                onChange={(e) => setNuevoOiValor(e.target.value)}
                                                className="h-8 w-24 rounded border border-input bg-background px-2 font-mono text-xs"
                                            />
                                            <Button size="sm" className="h-8 px-2.5 text-xs" onClick={handleAgregarOi}>
                                                <IconPlus size={14} /> Agregar
                                            </Button>
                                        </div>

                                        <div className="space-y-1 text-xs">
                                            {(detalle.otrosIngresos || []).map((oi: any) => (
                                                <div
                                                    key={oi.id_otrosingresos}
                                                    className="flex items-center justify-between rounded bg-background px-2.5 py-1.5"
                                                >
                                                    <span>{oi.nombre_otrosingresos}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-emerald-600">
                                                            +{fmtUf(oi.valor)} UF
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEliminarOi(oi.id_otrosingresos)}
                                                            className="text-destructive hover:underline"
                                                        >
                                                            Eliminar
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {(detalle.otrosIngresos || []).length === 0 && (
                                                <p className="m-0 text-[11px] text-muted-foreground">
                                                    Sin otros ingresos registrados.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Otros Descuentos (facturacion_des) */}
                                    <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3.5">
                                        <h4 className="m-0 mb-2 text-xs font-bold uppercase text-rose-700 dark:text-rose-400">
                                            Otros Descuentos — OD (facturacion_des)
                                        </h4>
                                        <div className="mb-2 flex gap-2">
                                            <select
                                                value={nuevoOdId}
                                                onChange={(e) => setNuevoOdId(e.target.value)}
                                                className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs"
                                            >
                                                {(maestros.otrosDescuentos || []).map((od: any) => (
                                                    <option key={od.id_otrosdescuentos} value={od.id_otrosdescuentos}>
                                                        {od.nombre_otrosdescuentos}
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                step="0.01"
                                                placeholder="UF"
                                                value={nuevoOdValor}
                                                onChange={(e) => setNuevoOdValor(e.target.value)}
                                                className="h-8 w-24 rounded border border-input bg-background px-2 font-mono text-xs"
                                            />
                                            <Button size="sm" className="h-8 px-2.5 text-xs" onClick={handleAgregarOd}>
                                                <IconPlus size={14} /> Agregar
                                            </Button>
                                        </div>

                                        <div className="space-y-1 text-xs">
                                            {(detalle.otrosDescuentos || []).map((od: any) => (
                                                <div
                                                    key={od.id_otrosdescuentos}
                                                    className="flex items-center justify-between rounded bg-background px-2.5 py-1.5"
                                                >
                                                    <span>{od.nombre_otrosdescuentos}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-rose-600">
                                                            -{fmtUf(od.valor)} UF
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEliminarOd(od.id_otrosdescuentos)}
                                                            className="text-destructive hover:underline"
                                                        >
                                                            Eliminar
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {(detalle.otrosDescuentos || []).length === 0 && (
                                                <p className="m-0 text-[11px] text-muted-foreground">
                                                    Sin otros descuentos registrados.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Sección 2: Modificación Pre-Exportación DTE y Asociación de OC / HES */}
                                <div className="rounded-lg border border-border p-3.5">
                                    <div className="mb-3 flex items-center justify-between">
                                        <h4 className="m-0 text-xs font-bold uppercase text-foreground">
                                            Datos de Facturación y Asociación de Órdenes de Compra / HES (facturacion_ocompra)
                                        </h4>
                                        <Button size="sm" onClick={handleGuardarDatosPrefactura} disabled={savingEnc}>
                                            <IconDeviceFloppy size={15} />
                                            {savingEnc ? 'Guardando...' : 'Guardar Cambios Pre-Factura'}
                                        </Button>
                                    </div>

                                    <div className="grid gap-3 md:grid-cols-4">
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold">Fecha Facturación</label>
                                            <input
                                                type="text"
                                                value={editEnc.fecha_facturacion}
                                                onChange={(e) =>
                                                    setEditEnc({ ...editEnc, fecha_facturacion: e.target.value })
                                                }
                                                placeholder="DD/MM/YYYY"
                                                className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold">Valor UF ($ CLP)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editEnc.uf}
                                                onChange={(e) =>
                                                    setEditEnc({ ...editEnc, uf: Number(e.target.value) })
                                                }
                                                className="h-8 w-full rounded border border-input bg-background px-2 font-mono text-xs"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold">Forma de Pago</label>
                                            <select
                                                value={editEnc.id_formapago}
                                                onChange={(e) =>
                                                    setEditEnc({
                                                        ...editEnc,
                                                        id_formapago: Number(e.target.value),
                                                    })
                                                }
                                                className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                                            >
                                                {(maestros.formasPago || []).map((fp: any) => (
                                                    <option key={fp.id_formapago} value={fp.id_formapago}>
                                                        {fp.nombre_formapago}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold">Nota Pie DTE</label>
                                            <input
                                                type="text"
                                                value={editEnc.nota}
                                                onChange={(e) => setEditEnc({ ...editEnc, nota: e.target.value })}
                                                className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                                            />
                                        </div>
                                        <div className="md:col-span-4">
                                            <label className="mb-1 block text-xs font-semibold">
                                                Glosa / Detalle Principal DTE
                                            </label>
                                            <input
                                                type="text"
                                                value={editEnc.glosa}
                                                onChange={(e) => setEditEnc({ ...editEnc, glosa: e.target.value })}
                                                className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                                            />
                                        </div>
                                    </div>

                                    {/* Lista editable de OC / HES */}
                                    <div className="mt-3 border-t border-border pt-3">
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="text-xs font-semibold">
                                                Referencias Tributarias (OC / HES — generan líneas adicionales en archivo plano DTE)
                                            </span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-xs"
                                                onClick={() =>
                                                    setEditEnc({
                                                        ...editEnc,
                                                        ordenes_compra: [
                                                            ...(editEnc.ordenes_compra || []),
                                                            {
                                                                tipo: 'OC',
                                                                ocompra: '',
                                                                ocompra_fecha: editEnc.fecha_facturacion || '',
                                                                referencia: 'Orden de Compra',
                                                                orden: (editEnc.ordenes_compra?.length || 0) + 1,
                                                            },
                                                        ],
                                                    })
                                                }
                                            >
                                                <IconPlus size={13} /> Agregar Línea OC / HES
                                            </Button>
                                        </div>

                                        <div className="space-y-2">
                                            {(editEnc.ordenes_compra || []).map((oc: any, idx: number) => (
                                                <div key={idx} className="grid gap-2 md:grid-cols-5">
                                                    <select
                                                        value={oc.tipo || 'OC'}
                                                        onChange={(e) => {
                                                            const next = [...editEnc.ordenes_compra];
                                                            next[idx] = { ...next[idx], tipo: e.target.value };
                                                            setEditEnc({ ...editEnc, ordenes_compra: next });
                                                        }}
                                                        className="h-8 rounded border border-input bg-background px-2 text-xs"
                                                    >
                                                        <option value="OC">OC (Orden de Compra)</option>
                                                        <option value="HES">HES (Hoja Entrada Servicio)</option>
                                                    </select>
                                                    <input
                                                        type="text"
                                                        placeholder="Número OC o HES..."
                                                        value={oc.ocompra || ''}
                                                        onChange={(e) => {
                                                            const next = [...editEnc.ordenes_compra];
                                                            next[idx] = { ...next[idx], ocompra: e.target.value };
                                                            setEditEnc({ ...editEnc, ordenes_compra: next });
                                                        }}
                                                        className="h-8 rounded border border-input bg-background px-2 font-mono text-xs"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Fecha DD/MM/YYYY"
                                                        value={oc.ocompra_fecha || ''}
                                                        onChange={(e) => {
                                                            const next = [...editEnc.ordenes_compra];
                                                            next[idx] = { ...next[idx], ocompra_fecha: e.target.value };
                                                            setEditEnc({ ...editEnc, ordenes_compra: next });
                                                        }}
                                                        className="h-8 rounded border border-input bg-background px-2 font-mono text-xs"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Referencia / Glosa OC"
                                                        value={oc.referencia || ''}
                                                        onChange={(e) => {
                                                            const next = [...editEnc.ordenes_compra];
                                                            next[idx] = { ...next[idx], referencia: e.target.value };
                                                            setEditEnc({ ...editEnc, ordenes_compra: next });
                                                        }}
                                                        className="h-8 rounded border border-input bg-background px-2 text-xs"
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-8 text-xs text-destructive"
                                                        onClick={() => {
                                                            const next = editEnc.ordenes_compra.filter(
                                                                (_: any, i: number) => i !== idx
                                                            );
                                                            setEditEnc({ ...editEnc, ordenes_compra: next });
                                                        }}
                                                    >
                                                        Quitar
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Sección 3: Casos Incluidos en la Pre-Factura */}
                                <div className="rounded-lg border border-border p-3.5">
                                    <h4 className="m-0 mb-2 text-xs font-bold uppercase text-foreground">
                                        Casos Incluidos en la Pre-Factura ({detalle.casos?.length || 0})
                                    </h4>
                                    <div className="max-h-60 overflow-y-auto">
                                        <table className="w-full border-collapse text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-border text-[11px] text-muted-foreground">
                                                    <th className="py-1.5">Caso ADLAB</th>
                                                    <th className="py-1.5">Programa</th>
                                                    <th className="py-1.5">Centro</th>
                                                    <th className="py-1.5">Veterinario</th>
                                                    <th className="py-1.5">Recepción / Informe</th>
                                                    <th className="py-1.5 text-right">UF Caso</th>
                                                    <th className="py-1.5 text-right">Liberar Caso</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {(detalle.casos || []).map((c: any) => (
                                                    <tr key={c.id_caso}>
                                                        <td className="py-1.5 font-mono font-bold">
                                                            #{c.caso_adlab || c.id_caso}
                                                        </td>
                                                        <td className="py-1.5">{c.nombre_programa}</td>
                                                        <td className="py-1.5">{c.nombre_centro}</td>
                                                        <td className="py-1.5">{c.cliente_entrega}</td>
                                                        <td className="py-1.5 font-mono text-[11px]">
                                                            {c.fecha_recepcion} → {c.fecha_informe}
                                                        </td>
                                                        <td className="py-1.5 text-right font-mono font-bold">
                                                            {fmtUf(c.uf_caso)} UF
                                                        </td>
                                                        <td className="py-1.5 text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 px-2 text-[11px] text-destructive"
                                                                onClick={() =>
                                                                    handleQuitarCaso(c.id_caso, c.caso_adlab)
                                                                }
                                                            >
                                                                Quitar y devolver a ENVIADO
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            )}
        </div>
    );
};

export default FacturacionSaludPrefacturas;

