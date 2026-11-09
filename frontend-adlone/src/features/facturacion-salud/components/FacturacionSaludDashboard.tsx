import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    IconRefresh,
    IconCoin,
    IconFileInvoice,
    IconCalendarDollar,
    IconStethoscope,
    IconArrowUpRight,
    IconReceipt2,
    IconFileExport,
    IconDatabase,
} from '@tabler/icons-react';
import { facturacionSaludService } from '../services/facturacionSalud.service';
import { useToast } from '../../../contexts/ToastContext';

interface Props {
    onNavigate?: (vista: string) => void;
    onSelectPrograma?: (eligeprograma: number) => void;
}

const PROGRAMA_TO_ELIGE: Record<number, number> = {
    1: 1,  // PVA
    2: 2,  // Screening
    3: 3,  // Peces Reproductores
    4: 4,  // Servicio Diagnóstico
    5: 5,  // I+D
    6: 6,  // Investigación Lab
    7: 4,  // Salud -> Servicio Diagnóstico
    8: 7,  // Genética
    10: 5, // I+D
    18: 8, // SAMIC
    19: 9, // Susceptibilidad Caligus
};

const FacturacionSaludDashboard: React.FC<Props> = ({ onNavigate, onSelectPrograma }) => {
    const { showToast } = useToast();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const d = await facturacionSaludService.getDashboard();
            setData(d);
        } catch (e: any) {
            showToast({
                type: 'error',
                message: e?.response?.data?.message || 'Error al cargar el dashboard de Facturación Salud',
            });
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const fmtUf = (n: number) =>
        Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtClp = (n: number) =>
        Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

    if (loading && !data) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-sm text-muted-foreground">Consultando LaboratorioADL en localhost…</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex h-64 items-center justify-center p-10 text-sm text-muted-foreground">
                No se pudo cargar el dashboard de Facturación Salud.
            </div>
        );
    }

    const kpis = data.kpis || {};
    const pendientesPorPrograma = data.pendientesPorPrograma || [];
    const resumenOtros = data.resumenOtros || [];

    const TIPO_DOC_LABELS: Record<number, string> = {
        1: 'FEA — Factura Afecta Otras Ventas',
        11: 'FEE — Factura Electrónica Exenta',
        8: 'NCE — Nota de Crédito Electrónica',
        10: 'NDE — Nota de Débito Electrónica',
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="m-0 text-lg font-bold tracking-tight text-foreground md:text-xl">
                        Resumen Operativo · Facturación Área Salud
                    </h2>
                    <p className="m-0 mt-0.5 text-xs text-muted-foreground">
                        Réplica integral del motor ADLSoft Visual FoxPro sobre base local{' '}
                        <span className="font-mono font-semibold text-foreground">
                            {data.connection?.server}/{data.connection?.database}
                        </span>
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={cargar}>
                        <IconRefresh size={15} /> Actualizar
                    </Button>
                    <Button size="sm" onClick={() => onNavigate?.('fs-procesar')}>
                        <IconStethoscope size={15} /> Ir a Valorizar Casos
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div
                className="grid gap-3.5"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}
            >
                <Card className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <IconStethoscope size={18} />
                        </div>
                        <Badge variant="outline" className="text-[11px]">Estado ENVIADO</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Casos de Salud pendientes por facturar</p>
                    <p className="mt-0.5 text-2xl font-bold text-foreground">
                        {fmtClp(kpis.totalCasosPendientes || 0)} casos
                    </p>
                    <div className="mt-1 text-xs text-muted-foreground">
                        {fmtClp(kpis.totalLineasPendientes || 0)} líneas de análisis elegibles
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10 text-warning">
                            <IconFileInvoice size={18} />
                        </div>
                        <Badge variant="warning" className="text-[11px]">Pendientes DTE</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Pre-facturas pendientes de emisión DTE</p>
                    <p className="mt-0.5 text-2xl font-bold text-foreground">
                        {fmtClp(kpis.prefacturasPendientesDte || 0)}
                    </p>
                    <div className="mt-1 text-xs text-muted-foreground">
                        Acumulado: {fmtUf(kpis.ufPendienteEmision || 0)} UF
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 text-success">
                            <IconCoin size={18} />
                        </div>
                        <Badge variant="success" className="text-[11px]">Emitidas</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Facturas de casos emitidas a DTE</p>
                    <p className="mt-0.5 text-2xl font-bold text-foreground">
                        {fmtClp(kpis.prefacturasEmitidasDte || 0)}
                    </p>
                    <div className="mt-1 text-xs text-muted-foreground">
                        Histórico en facturacion_enc
                    </div>
                </Card>

                <Card className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                            <IconCalendarDollar size={18} />
                        </div>
                        <Badge variant="secondary" className="text-[11px]">Referencia UF</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Última UF registrada en Facturación</p>
                    <p className="mt-0.5 text-2xl font-bold text-foreground">
                        $ {fmtUf(kpis.ultimaUf || 38500)}
                    </p>
                    <div className="mt-1 text-xs text-muted-foreground">
                        Editable al valorizar o crear factura
                    </div>
                </Card>
            </div>

            {/* Accesos Rápidos a los 4 Módulos */}
            <div className="grid gap-3 md:grid-cols-4">
                <Card
                    onClick={() => onNavigate?.('fs-procesar')}
                    className="cursor-pointer border-l-4 border-l-primary p-4 transition hover:bg-muted/40"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-primary">Paso 1</span>
                        <IconArrowUpRight size={16} className="text-muted-foreground" />
                    </div>
                    <p className="mt-1 text-sm font-bold text-foreground">Pre-Facturación y Valorización</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        8 Programas de Salud, 11 reglas tarifarias, costos operativos ATV/MOWI y agrupación.
                    </p>
                </Card>

                <Card
                    onClick={() => onNavigate?.('fs-prefacturas')}
                    className="cursor-pointer border-l-4 border-l-amber-500 p-4 transition hover:bg-muted/40"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">Paso 2</span>
                        <IconArrowUpRight size={16} className="text-muted-foreground" />
                    </div>
                    <p className="mt-1 text-sm font-bold text-foreground">Bandeja de Pre-Facturas</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Otros Ingresos (OI), Descuentos (OD), OC/HES, Excel Resumen/Detalle y Reproceso.
                    </p>
                </Card>

                <Card
                    onClick={() => onNavigate?.('fs-otras-ventas')}
                    className="cursor-pointer border-l-4 border-l-purple-500 p-4 transition hover:bg-muted/40"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">Paso 3</span>
                        <IconReceipt2 size={16} className="text-muted-foreground" />
                    </div>
                    <p className="mt-1 text-sm font-bold text-foreground">Otras Ventas y Notas (NC/ND)</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        FEA Otras Ventas, FEE Exenta, NDE y NCE con liberación o reversa selectiva de casos.
                    </p>
                </Card>

                <Card
                    onClick={() => onNavigate?.('fs-dte')}
                    className="cursor-pointer border-l-4 border-l-emerald-500 p-4 transition hover:bg-muted/40"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Paso 4</span>
                        <IconFileExport size={16} className="text-muted-foreground" />
                    </div>
                    <p className="mt-1 text-sm font-bold text-foreground">Exportación DTE (35 Columnas)</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Generación de archivo plano CSV/TXT felectronicatxt para los 5 flujos tributarios.
                    </p>
                </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                {/* Tabla de Casos Pendientes por Programa de Salud */}
                <Card className="p-4 lg:col-span-2">
                    <div className="mb-3 flex items-center justify-between">
                        <div>
                            <h3 className="m-0 text-sm font-bold text-foreground">
                                Casos Pendientes de Facturar por Programa de Salud
                            </h3>
                            <p className="m-0 text-xs text-muted-foreground">
                                Muestras con estado = 'ENVIADO', id_facturacion = 0 y clasifica IN ('CLIENTE','COMPLEMENT')
                            </p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="border-b border-border text-[11px] uppercase text-muted-foreground">
                                    <th className="py-2 pr-3">ID Prog</th>
                                    <th className="py-2 px-3">Programa de Salud</th>
                                    <th className="py-2 px-3 text-right">Casos</th>
                                    <th className="py-2 px-3 text-right">Líneas</th>
                                    <th className="py-2 px-3 text-right">UF Acumulado</th>
                                    <th className="py-2 pl-3 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {pendientesPorPrograma.map((row: any) => {
                                    const elige = PROGRAMA_TO_ELIGE[Number(row.id_programa)] || 4;
                                    return (
                                        <tr key={row.id_programa} className="hover:bg-muted/40">
                                            <td className="py-2.5 pr-3 font-mono font-semibold text-muted-foreground">
                                                #{row.id_programa}
                                            </td>
                                            <td className="py-2.5 px-3 font-medium text-foreground">
                                                {row.nombre_programa}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-semibold text-foreground">
                                                {fmtClp(row.total_casos)}
                                            </td>
                                            <td className="py-2.5 px-3 text-right text-muted-foreground">
                                                {fmtClp(row.total_lineas)}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono text-foreground">
                                                {fmtUf(row.uf_acumulado)} UF
                                            </td>
                                            <td className="py-2.5 pl-3 text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 px-2 text-xs"
                                                    onClick={() => {
                                                        onSelectPrograma?.(elige);
                                                        onNavigate?.('fs-procesar');
                                                    }}
                                                >
                                                    Procesar <IconArrowUpRight size={13} />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {pendientesPorPrograma.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-6 text-center text-muted-foreground">
                                            No hay casos pendientes en este momento.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {/* Resumen de Otras Ventas y Notas (facturacion_otro) */}
                <Card className="p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <div>
                            <h3 className="m-0 text-sm font-bold text-foreground">
                                Otras Ventas y Notas (facturacion_otro)
                            </h3>
                            <p className="m-0 text-xs text-muted-foreground">
                                Documentos emitidos y pendientes DTE
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => onNavigate?.('fs-otras-ventas')}
                        >
                            Ver todos
                        </Button>
                    </div>

                    <div className="space-y-2.5">
                        {resumenOtros.map((r: any) => (
                            <div
                                key={r.id_tipodocumento}
                                className="rounded-lg border border-border p-3 hover:bg-muted/30"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-foreground">
                                        {TIPO_DOC_LABELS[Number(r.id_tipodocumento)] || `Tipo #${r.id_tipodocumento}`}
                                    </span>
                                    <Badge variant={Number(r.pendientes_dte) > 0 ? 'warning' : 'secondary'} className="text-[10px]">
                                        {r.pendientes_dte} pend. DTE
                                    </Badge>
                                </div>
                                <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Total docs: {fmtClp(r.total_docs)}</span>
                                    <span className="font-mono font-medium text-foreground">
                                        $ {fmtClp(r.monto_total_clp)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                            <IconDatabase size={14} /> Base de Datos Local Aislada
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                            Todas las valorizaciones, prefacturas, notas de crédito y exportaciones DTE se ejecutan en{' '}
                            <strong>localhost (LaboratorioADL)</strong> sin tocar producción.
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default FacturacionSaludDashboard;

