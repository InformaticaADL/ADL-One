import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    IconFileExport,
    IconSearch,
    IconRefresh,
    IconEye,
    IconDownload,
    IconCheck,
    IconX,
} from '@tabler/icons-react';
import { facturacionSaludService } from '../services/facturacionSalud.service';
import { useToast } from '../../../contexts/ToastContext';

const FLUJOS_DTE = [
    {
        id: 'FEA_CASOS',
        codigo: 'FEA',
        label: '1. FEA Casos (Facturas de Casos Salud)',
        sp: 'fac_consulta_facturaelectronica_exporta',
        desc: 'Exporta facturacion_enc con desglose multi-línea de OC y HES (facturacion_ocompra)',
    },
    {
        id: 'FEA_OTROS',
        codigo: 'FEA',
        label: '2. FEA Otras Ventas (Afectas 19%)',
        sp: 'fac_consulta_facturaelectronica_exporta_fea',
        desc: 'Exporta facturacion_otro con id_tipodocumento = 1 (totaldoc = neto * 1.19)',
    },
    {
        id: 'FEE',
        codigo: 'FEE',
        label: '3. FEE Facturas Exentas (Sin IVA)',
        sp: 'fac_consulta_facturaelectronica_exporta_fee',
        desc: 'Exporta facturacion_otro con id_tipodocumento = 11 (totaldoc = neto)',
    },
    {
        id: 'NCE',
        codigo: 'NCE',
        label: '4. NCE Notas de Crédito Electrónicas',
        sp: 'fac_consulta_facturaelectronica_exporta_nc',
        desc: 'Exporta facturacion_otro con id_tipodocumento = 8 (incluye tipo_ref, num_ref, cod_razon y AFE/EXE)',
    },
    {
        id: 'NDE',
        codigo: 'NDE',
        label: '5. NDE Notas de Débito Electrónicas',
        sp: 'fac_consulta_facturaelectronica_exporta_nd',
        desc: 'Exporta facturacion_otro con id_tipodocumento = 10',
    },
];

const FacturacionSaludDte: React.FC = () => {
    const { showToast } = useToast();

    const [flujo, setFlujo] = useState<string>('FEA_CASOS');
    const [soloPendientes, setSoloPendientes] = useState<boolean>(true);
    const [busqueda, setBusqueda] = useState<string>('');
    const [documentos, setDocumentos] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [marcarEmitido, setMarcarEmitido] = useState<boolean>(false);

    // Previsualización de las 35 columnas de felectronicatxt
    const [previewData, setPreviewData] = useState<any | null>(null);
    const [generando, setGenerando] = useState<boolean>(false);

    const cargarDocumentos = useCallback(async () => {
        setLoading(true);
        try {
            const lista = await facturacionSaludService.listarDocumentosDte({
                flujo,
                solo_pendientes: soloPendientes,
                busqueda,
            });
            setDocumentos(lista || []);
            setSelectedIds(new Set((lista || []).slice(0, 50).map((d: any) => Number(d.id_facturacion))));
        } catch (e: any) {
            showToast({
                type: 'error',
                message: e?.response?.data?.message || 'Error al consultar documentos para exportación DTE',
            });
        } finally {
            setLoading(false);
        }
    }, [flujo, soloPendientes, busqueda, showToast]);

    useEffect(() => {
        cargarDocumentos();
        setPreviewData(null);
    }, [cargarDocumentos]);

    const handleGenerarArchivoPlano = async (descargarDirecto: boolean) => {
        if (selectedIds.size === 0) {
            showToast({ type: 'error', message: 'Seleccione al menos un documento para exportar.' });
            return;
        }
        setGenerando(true);
        try {
            const res = await facturacionSaludService.generarArchivoDte({
                flujo,
                ids_facturacion: Array.from(selectedIds),
                marcar_emitido: descargarDirecto ? marcarEmitido : false,
            });
            setPreviewData(res);

            if (descargarDirecto && res.csvContent) {
                const blob = new Blob([res.csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                link.setAttribute('download', `felectronicatxt_${flujo.toLowerCase()}_${stamp}.csv`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);

                showToast({
                    type: 'success',
                    message: `Archivo DTE generado (${res.total_documentos} documento(s), ${res.total_lineas_txt} línea(s) de 35 columnas).`,
                });
                if (marcarEmitido) cargarDocumentos();
            } else {
                showToast({
                    type: 'info',
                    message: `Previsualización generada: ${res.total_lineas_txt} fila(s) con las 35 columnas de felectronicatxt.`,
                });
            }
        } catch (e: any) {
            showToast({
                type: 'error',
                message: e?.response?.data?.message || 'Error al generar archivo plano DTE',
            });
        } finally {
            setGenerando(false);
        }
    };

    const fmtClp = (n: number) =>
        Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
    const fmtUf = (n: number) =>
        Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const flujoActual = FLUJOS_DTE.find((f) => f.id === flujo);

    return (
        <div className="space-y-4">
            {/* Pestañas de los 5 Flujos Tributarios DTE */}
            <Card className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h3 className="m-0 text-base font-bold text-foreground">
                            Exportación de Facturación Electrónica DTE — 35 Columnas (felectronicatxt)
                        </h3>
                        <p className="m-0 text-xs text-muted-foreground">
                            Replica los 5 flujos de exportación de Visual FoxPro (<span className="font-mono">COPY TO TYPE XL5 / CSV</span>)
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={cargarDocumentos}>
                        <IconRefresh size={15} /> Recargar
                    </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                    {FLUJOS_DTE.map((f) => {
                        const active = flujo === f.id;
                        return (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => setFlujo(f.id)}
                                className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                                    active
                                        ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-sm'
                                        : 'border-border bg-background text-foreground hover:bg-muted/50'
                                }`}
                            >
                                <div>{f.label}</div>
                                <div
                                    className={`font-mono text-[10px] ${
                                        active ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                    }`}
                                >
                                    SP: {f.sp}
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
                                placeholder="Filtrar por ID, Cliente, RUT o Glosa..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="h-8 w-64 rounded border border-input bg-background pl-8 pr-2 text-xs"
                            />
                        </div>

                        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium">
                            <input
                                type="checkbox"
                                checked={soloPendientes}
                                onChange={(e) => setSoloPendientes(e.target.checked)}
                            />
                            <span>Mostrar solo pendientes de emisión (emitido &lt;&gt; 'S')</span>
                        </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <label className="flex cursor-pointer items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                            <input
                                type="checkbox"
                                checked={marcarEmitido}
                                onChange={(e) => setMarcarEmitido(e.target.checked)}
                            />
                            <span>Al descargar, marcar como Emitido (emitido = 'S')</span>
                        </label>

                        <Button
                            variant="outline"
                            size="sm"
                            disabled={generando || selectedIds.size === 0}
                            onClick={() => handleGenerarArchivoPlano(false)}
                        >
                            <IconEye size={15} /> Previsualizar 35 Columnas ({selectedIds.size})
                        </Button>

                        <Button
                            size="sm"
                            disabled={generando || selectedIds.size === 0}
                            onClick={() => handleGenerarArchivoPlano(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <IconDownload size={15} /> Descargar Archivo Plano DTE (.csv)
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Previsualización Interactiva de las 35 Columnas de felectronicatxt */}
            {previewData && (
                <Card className="border-emerald-500/40 bg-emerald-500/5 p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <div>
                            <h4 className="m-0 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                                Vista Previa Cursor <span className="font-mono">felectronicatxt</span> ({previewData.headers?.length} columnas · {previewData.total_lineas_txt} filas generadas para {previewData.total_documentos} documento(s))
                            </h4>
                            <p className="m-0 text-xs text-muted-foreground">
                                Incluye las líneas secundarias de Orden de Compra (OC) y HES con cantidad=0 y neto=0 según regla 7.3.
                            </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setPreviewData(null)}>
                            <IconX size={15} /> Cerrar Vista Previa
                        </Button>
                    </div>

                    <div className="max-h-72 overflow-auto rounded border border-border bg-background">
                        <table className="w-full border-collapse text-left font-mono text-[11px]">
                            <thead className="sticky top-0 bg-muted">
                                <tr className="border-b border-border text-[10px] text-muted-foreground">
                                    {(previewData.headers || []).map((col: string, i: number) => (
                                        <th key={col} className="whitespace-nowrap px-2 py-1.5">
                                            {i + 1}. {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {(previewData.rows || []).map((r: any, idx: number) => (
                                    <tr
                                        key={idx}
                                        className={
                                            Number(r.cantidad) === 0
                                                ? 'bg-amber-500/10 text-amber-900 dark:text-amber-300'
                                                : 'hover:bg-muted/30'
                                        }
                                    >
                                        {(previewData.headers || []).map((col: string) => (
                                            <td key={col} className="whitespace-nowrap px-2 py-1">
                                                {String(r[col] ?? '')}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Tabla de Documentos del Flujo Seleccionado */}
            <Card className="p-4">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{flujoActual?.desc}</span>
                    <span>
                        Mostrando <strong>{documentos.length}</strong> documento(s) · Seleccionados:{' '}
                        <strong>{selectedIds.size}</strong>
                    </span>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-xs text-muted-foreground">
                        Ejecutando {flujoActual?.sp} en localhost...
                    </div>
                ) : (
                    <div className="max-h-[500px] overflow-y-auto">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                                <tr className="border-b border-border text-[11px] uppercase text-muted-foreground">
                                    <th className="py-2 pl-2 pr-1">
                                        <input
                                            type="checkbox"
                                            checked={
                                                documentos.length > 0 &&
                                                selectedIds.size === documentos.length
                                            }
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedIds(
                                                        new Set(documentos.map((d) => Number(d.id_facturacion)))
                                                    );
                                                } else {
                                                    setSelectedIds(new Set());
                                                }
                                            }}
                                        />
                                    </th>
                                    <th className="py-2 px-2">Prefactura</th>
                                    <th className="py-2 px-2">Tipo DTE</th>
                                    <th className="py-2 px-2">Fecha</th>
                                    <th className="py-2 px-2">RUT / Cliente</th>
                                    <th className="py-2 px-2">Detalle / Glosa</th>
                                    <th className="py-2 px-2">Forma Pago / Giro</th>
                                    <th className="py-2 px-2 text-right">Neto ($ CLP)</th>
                                    <th className="py-2 px-2 text-right">Total Doc ($ CLP)</th>
                                    <th className="py-2 pr-2 text-right">Emitido</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {documentos.map((doc) => {
                                    const idFac = Number(doc.id_facturacion);
                                    const checked = selectedIds.has(idFac);
                                    return (
                                        <tr key={idFac} className="hover:bg-muted/30">
                                            <td className="py-2 pl-2 pr-1">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(e) => {
                                                        const next = new Set(selectedIds);
                                                        if (e.target.checked) next.add(idFac);
                                                        else next.delete(idFac);
                                                        setSelectedIds(next);
                                                    }}
                                                />
                                            </td>
                                            <td className="py-2 px-2 font-mono font-bold text-primary">
                                                #{idFac}
                                            </td>
                                            <td className="py-2 px-2">
                                                <Badge variant="outline" className="font-mono text-[10px]">
                                                    {flujoActual?.codigo}
                                                </Badge>
                                            </td>
                                            <td className="py-2 px-2 font-mono text-[11px]">
                                                {doc.fecha_facturacion || doc.fecha_documento}
                                            </td>
                                            <td className="py-2 px-2">
                                                <div className="font-semibold text-foreground">
                                                    {doc.nombre_empresaservicios}
                                                </div>
                                                <div className="font-mono text-[10px] text-muted-foreground">
                                                    {doc.rut_empresaservicios}
                                                </div>
                                            </td>
                                            <td className="py-2 px-2 max-w-xs truncate">
                                                {doc.glosa || doc.concepto_cobro}
                                            </td>
                                            <td className="py-2 px-2 text-[11px] text-muted-foreground">
                                                <div>{doc.nombre_formapago || '—'}</div>
                                                <div className="truncate max-w-[180px] text-[10px]">
                                                    {doc.nombre_giro || ''}
                                                </div>
                                            </td>
                                            <td className="py-2 px-2 text-right font-mono font-semibold">
                                                $ {fmtClp(doc.neto_calculado)}
                                            </td>
                                            <td className="py-2 px-2 text-right font-mono font-bold text-foreground">
                                                $ {fmtClp(doc.totaldoc_calculado)}
                                            </td>
                                            <td className="py-2 pr-2 text-right">
                                                <Badge
                                                    variant={doc.emitido === 'S' ? 'success' : 'warning'}
                                                    className="text-[10px]"
                                                >
                                                    {doc.emitido === 'S' ? 'Sí' : 'Pendiente'}
                                                </Badge>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {documentos.length === 0 && (
                                    <tr>
                                        <td colSpan={10} className="py-8 text-center text-muted-foreground">
                                            No hay documentos en este flujo DTE para los filtros seleccionados.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default FacturacionSaludDte;

