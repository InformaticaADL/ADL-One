import React, { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { IconDna, IconDownload, IconFilter, IconRefresh } from '@tabler/icons-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { DataPagination } from '@/components/ui/pagination';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useToast } from '../../../contexts/ToastContext';
import {
    biologiaMolecularApiClient,
    exportBiologiaMolecularExcel,
    filterLowestCTByCasoMatrizAgente,
    type BiologiaMolecularMuestra
} from '../services/biologiaMolecular.service';

const FORMATO_ISO = 'YYYY-MM-DD';

// Cifras con punto (.) como separador de miles.
const formatThousands = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null || val === '') return '0';
    const num = Number(val);
    if (isNaN(num)) return String(val);
    return Math.trunc(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Fechas a DD/MM/YYYY.
const formatDateOnly = (val?: string | Date | null): string => {
    if (!val) return '-';
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
            const [y, m, d] = trimmed.slice(0, 10).split('-');
            return `${d}/${m}/${y}`;
        }
        if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) return trimmed.slice(0, 10);
        const parsed = new Date(trimmed);
        return isNaN(parsed.getTime()) ? trimmed : dayjs(parsed).format('DD/MM/YYYY');
    }
    return val instanceof Date && !isNaN(val.getTime()) ? dayjs(val).format('DD/MM/YYYY') : String(val);
};

// Una sola definición de qué es cada resultado. Antes esta misma condición
// (r === 'p' || r.includes('pos'), etc.) estaba copiada en los KPIs, en el filtro y en
// el badge: bastaba corregir una para que las otras tres quedaran desalineadas.
type ClaseResultado = 'POSITIVO' | 'NEGATIVO' | 'EN_PROCESO' | 'INDETERMINADO' | 'OTRO';
const clasificarResultado = (resultado?: string | null): ClaseResultado => {
    const r = String(resultado ?? '').toLowerCase().trim();
    if (r === 'p' || r.includes('pos')) return 'POSITIVO';
    if (r === 'n' || r.includes('neg')) return 'NEGATIVO';
    if (r === 'ep' || r.includes('proc') || r.includes('pend')) return 'EN_PROCESO';
    if (r.includes('indet') || r.includes('sos')) return 'INDETERMINADO';
    return 'OTRO';
};

type Categoria = 'ALL' | 'POSITIVO' | 'NEGATIVO' | 'OTROS';
// "Otros" es todo lo que no es ni positivo ni negativo (en proceso, indeterminado…).
const categoriaDe = (resultado?: string | null): Exclude<Categoria, 'ALL'> => {
    const c = clasificarResultado(resultado);
    return c === 'POSITIVO' || c === 'NEGATIVO' ? c : 'OTROS';
};

const OPCIONES_RESULTADO = [
    { value: 'ALL', label: 'Todos' },
    { value: 'POSITIVO', label: 'Positivo' },
    { value: 'NEGATIVO', label: 'Negativo' },
    { value: 'OTROS', label: 'En proceso / otros' },
];

const ResultadoBadge: React.FC<{ resultado?: string | null }> = ({ resultado }) => {
    if (!resultado) return <span className="text-muted-foreground">-</span>;
    switch (clasificarResultado(resultado)) {
        case 'POSITIVO':
            return <Badge variant="destructive">{resultado === 'P' ? 'Positivo (P)' : resultado}</Badge>;
        case 'NEGATIVO':
            return <Badge variant="success">{resultado === 'N' ? 'Negativo (N)' : resultado}</Badge>;
        case 'EN_PROCESO':
            return <Badge variant="secondary">{resultado === 'EP' ? 'En Proceso (EP)' : resultado}</Badge>;
        case 'INDETERMINADO':
            return <Badge variant="warning">{resultado}</Badge>;
        default:
            return <Badge variant="outline">{resultado}</Badge>;
    }
};

interface KpiProps {
    etiqueta: string;
    valor: number;
    detalle: string;
    acento?: string;
    activo?: boolean;
    onClick?: () => void;
}

// Tarjeta plana: el color vive solo en un punto de acento, no en fondos ni gradientes.
// Las que filtran son un Button de Shadcn, no un div con onClick (no se llega con teclado).
const Kpi: React.FC<KpiProps> = ({ etiqueta, valor, detalle, acento, activo, onClick }) => {
    const contenido = (
        <>
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                {acento && <span className={cn('h-1.5 w-1.5 rounded-full', acento)} />}
                {etiqueta}
            </span>
            <span className="text-2xl font-semibold tabular-nums text-foreground">{formatThousands(valor)}</span>
            <span className="text-xs font-normal text-muted-foreground">{detalle}</span>
        </>
    );
    if (!onClick) {
        return <Card className="flex flex-col items-start gap-1 px-4 py-3">{contenido}</Card>;
    }
    return (
        <Button
            variant="outline"
            onClick={onClick}
            aria-pressed={activo}
            className={cn('h-auto flex-col items-start gap-1 rounded-xl px-4 py-3 text-left', activo && 'border-primary ring-1 ring-primary')}
        >
            {contenido}
        </Button>
    );
};

interface Props {
    onBack?: () => void;
}

export const BiologiaMolecularPage: React.FC<Props> = ({ onBack }) => {
    const { showToast } = useToast();

    // El rango arranca el 1 de enero del año en curso. Estaba escrito a mano como
    // '2026-01-01', así que en 2027 la consulta inicial habría traído el año anterior.
    const [fechaDesde, setFechaDesde] = useState<string>(() => dayjs().startOf('year').format(FORMATO_ISO));
    const [fechaHasta, setFechaHasta] = useState<string>(() => dayjs().format(FORMATO_ISO));

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<BiologiaMolecularMuestra[]>([]);
    const [soloMenorCT, setSoloMenorCT] = useState(false);
    const [categoria, setCategoria] = useState<Categoria>('ALL');
    const [centro, setCentro] = useState('ALL');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

    const consultar = async () => {
        if (!fechaDesde || !fechaHasta) {
            showToast({ message: 'Debe ingresar un rango de fechas válido.', type: 'warning' });
            return;
        }
        if (fechaDesde > fechaHasta) {
            showToast({ message: 'La fecha desde no puede ser posterior a la fecha hasta.', type: 'warning' });
            return;
        }

        setLoading(true);
        try {
            const result = await biologiaMolecularApiClient.getConsultaMuestras({
                fecha_desde: fechaDesde,
                fecha_hasta: fechaHasta,
                id_lugaranalisis: 1
            });
            setData(result);
            setPage(1);
            setFiltrosAbiertos(false);
            showToast({
                message: `Se encontraron ${formatThousands(result.length)} registros de Biología Molecular.`,
                type: result.length > 0 ? 'success' : 'info'
            });
        } catch (error) {
            console.error('Error al consultar Biología Molecular:', error);
            const respuesta = (error as { response?: { data?: { message?: string } }; message?: string });
            showToast({
                message: respuesta?.response?.data?.message || respuesta?.message || 'Error al consultar datos en LaboratorioADL',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void consultar();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Todos los pools, o solo el de menor CT por (caso, matriz, agente).
    const base = useMemo(() => (soloMenorCT ? filterLowestCTByCasoMatrizAgente(data) : data), [data, soloMenorCT]);

    // Un único recorrido para los KPIs.
    const stats = useMemo(() => {
        const casos = new Set<string | number>();
        const centros = new Set<string>();
        let positivos = 0;
        let negativos = 0;
        for (const d of base) {
            casos.add(d.caso_adlab);
            centros.add(d.nombre_centro);
            const cat = categoriaDe(d.resultado);
            if (cat === 'POSITIVO') positivos++;
            else if (cat === 'NEGATIVO') negativos++;
        }
        return { total: base.length, casos: casos.size, centros: centros.size, positivos, negativos, otros: base.length - positivos - negativos };
    }, [base]);

    const porCategoria = useMemo(
        () => (categoria === 'ALL' ? base : base.filter((d) => categoriaDe(d.resultado) === categoria)),
        [base, categoria]
    );

    // Centros presentes en la categoría elegida, con su cantidad de muestras.
    const centrosDisponibles = useMemo(() => {
        const cuentas = new Map<string, number>();
        for (const d of porCategoria) {
            const c = (d.nombre_centro || '').trim();
            if (c) cuentas.set(c, (cuentas.get(c) || 0) + 1);
        }
        return Array.from(cuentas.entries())
            .map(([nombre, n]) => ({ nombre, n }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [porCategoria]);

    // Si el centro elegido ya no existe en la categoría, se trata como "todos". Se deriva
    // en vez de corregir el estado con un efecto, que dispararía un render extra.
    const centroActivo = centrosDisponibles.some((c) => c.nombre === centro) ? centro : 'ALL';

    const filtrados = useMemo(
        () => (centroActivo === 'ALL' ? porCategoria : porCategoria.filter((d) => (d.nombre_centro || '').trim() === centroActivo)),
        [porCategoria, centroActivo]
    );

    const opcionesCentro = useMemo(
        () => [
            { value: 'ALL', label: `Todos los centros (${formatThousands(centrosDisponibles.length)})` },
            ...centrosDisponibles.map(({ nombre, n }) => ({ value: nombre, label: `${nombre} (${formatThousands(n)})` })),
        ],
        [centrosDisponibles]
    );

    const filtrosActivos = [soloMenorCT, categoria !== 'ALL', centroActivo !== 'ALL'].filter(Boolean).length;

    const elegirCategoria = (c: Categoria) => { setCategoria(c); setPage(1); };

    const limpiarFiltros = () => {
        setSoloMenorCT(false);
        setCategoria('ALL');
        setCentro('ALL');
        setPage(1);
    };

    const paginaActual = Math.min(page, Math.max(1, Math.ceil(filtrados.length / pageSize)));
    const visibles = useMemo(
        () => filtrados.slice((paginaActual - 1) * pageSize, paginaActual * pageSize),
        [filtrados, paginaActual, pageSize]
    );

    const exportar = () => {
        const aExportar = filtrados.length > 0 ? filtrados : base;
        if (aExportar.length === 0) {
            showToast({ message: 'No hay datos para exportar.', type: 'warning' });
            return;
        }
        try {
            const sufijoCT = soloMenorCT ? '_menor_ct_max28' : '';
            const sufijoCat = categoria !== 'ALL' ? `_${categoria.toLowerCase()}` : '';
            const sufijoCentro = centroActivo !== 'ALL' ? `_${centroActivo.replace(/\s+/g, '_')}` : '';
            exportBiologiaMolecularExcel(aExportar, `biologia_molecular_${fechaDesde}_al_${fechaHasta}${sufijoCT}${sufijoCat}${sufijoCentro}`);
            showToast({
                message: `Archivo Excel generado con éxito (${formatThousands(aExportar.length)} registros${soloMenorCT ? ' - Menor CT ≤ 28' : ''}).`,
                type: 'success'
            });
        } catch (error) {
            showToast({ message: 'Error al generar el archivo Excel: ' + (error as Error).message, type: 'error' });
        }
    };

    return (
        <div className="shadcn-scope flex h-full min-h-0 flex-col [&>*]:shrink-0">
            <PageHeader
                title="Biología Molecular"
                subtitle="Consulta detallada de muestras y resultados por rango de fecha"
                onBack={onBack}
                rightSection={
                    <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xs text-muted-foreground">
                            {formatThousands(filtrados.length)} registros · {formatDateOnly(fechaDesde)} – {formatDateOnly(fechaHasta)}
                        </span>

                        <Sheet open={filtrosAbiertos} onOpenChange={setFiltrosAbiertos}>
                            <SheetTrigger asChild>
                                <Button variant="outline">
                                    <IconFilter size={16} /> Filtros
                                    {filtrosActivos > 0 && <Badge variant="secondary" className="ml-1 px-1.5">{filtrosActivos}</Badge>}
                                </Button>
                            </SheetTrigger>
                            <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-sm">
                                <SheetHeader>
                                    <SheetTitle>Filtros de búsqueda</SheetTitle>
                                    <SheetDescription>El rango de fechas consulta LaboratorioADL; el resto filtra lo ya cargado.</SheetDescription>
                                </SheetHeader>

                                <div className="flex flex-1 flex-col gap-4">
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Fecha desde (muestreo)</Label>
                                        <DatePicker value={fechaDesde} onChange={setFechaDesde} placeholder="Seleccionar fecha" />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Fecha hasta (muestreo)</Label>
                                        <DatePicker value={fechaHasta} onChange={setFechaHasta} placeholder="Seleccionar fecha" />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Lugar de análisis</Label>
                                        <p className="text-sm">Puerto Montt</p>
                                    </div>

                                    <div className="h-px bg-border" />

                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Resultado</Label>
                                        <Combobox
                                            options={OPCIONES_RESULTADO}
                                            value={categoria}
                                            onValueChange={(v) => elegirCategoria((v || 'ALL') as Categoria)}
                                            placeholder="Todos"
                                            searchPlaceholder="Buscar resultado..."
                                        />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Centro</Label>
                                        <Combobox
                                            options={opcionesCentro}
                                            value={centroActivo}
                                            onValueChange={(v) => { setCentro(v || 'ALL'); setPage(1); }}
                                            placeholder="Todos los centros"
                                            searchPlaceholder="Buscar centro..."
                                        />
                                    </div>
                                    <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                                        <div>
                                            <Label htmlFor="toggle-menor-ct" className="text-sm font-medium">Solo menor CT</Label>
                                            <p className="mt-0.5 text-xs text-muted-foreground">Conserva el menor CT (≤ 28) de cada caso, matriz y agente.</p>
                                        </div>
                                        <Switch
                                            id="toggle-menor-ct"
                                            checked={soloMenorCT}
                                            onCheckedChange={(v) => { setSoloMenorCT(v); setPage(1); }}
                                        />
                                    </div>
                                </div>

                                <SheetFooter>
                                    {filtrosActivos > 0 && (
                                        <Button variant="outline" onClick={limpiarFiltros}>Limpiar filtros</Button>
                                    )}
                                    <Button onClick={() => void consultar()} disabled={loading}>
                                        {loading ? 'Consultando...' : 'Consultar'}
                                    </Button>
                                </SheetFooter>
                            </SheetContent>
                        </Sheet>

                        <Button variant="outline" onClick={() => void consultar()} disabled={loading} title="Volver a consultar">
                            <IconRefresh size={16} className={loading ? 'animate-spin' : ''} /> Recargar
                        </Button>
                        <Button variant="outline" onClick={exportar} disabled={loading || filtrados.length === 0}>
                            <IconDownload size={16} /> Exportar Excel
                        </Button>
                    </div>
                }
            />

            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-4 md:px-6 md:pb-6">
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <Kpi etiqueta="Total registros" valor={stats.total} detalle={soloMenorCT ? 'Muestras con CT ≤ 28' : 'Análisis totales'}
                        activo={categoria === 'ALL'} onClick={() => elegirCategoria('ALL')} />
                    <Kpi etiqueta="Casos únicos" valor={stats.casos} detalle="Casos registrados" />
                    <Kpi etiqueta="Centros" valor={stats.centros} detalle="Centros productivos" />
                    <Kpi etiqueta="Positivos" valor={stats.positivos} detalle="Análisis positivos" acento="bg-destructive"
                        activo={categoria === 'POSITIVO'} onClick={() => elegirCategoria('POSITIVO')} />
                    <Kpi etiqueta="Negativos" valor={stats.negativos} detalle="Análisis negativos" acento="bg-success"
                        activo={categoria === 'NEGATIVO'} onClick={() => elegirCategoria('NEGATIVO')} />
                    <Kpi etiqueta="En proceso" valor={stats.otros} detalle="Pendientes de resultado" acento="bg-primary"
                        activo={categoria === 'OTROS'} onClick={() => elegirCategoria('OTROS')} />
                </div>

                {/* La tarjeta se encoge y la tabla scrollea por dentro: la paginación queda
                    siempre en el mismo lugar (mismo patrón que Equipos y el Explorador). */}
                <div className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
                    {loading && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    )}
                    <Table containerClassName="min-h-0">
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>Caso ADLab</TableHead>
                                <TableHead>Fecha recep.</TableHead>
                                <TableHead>Centro</TableHead>
                                <TableHead>Programa</TableHead>
                                <TableHead>Matriz</TableHead>
                                <TableHead>Agente / Técnica</TableHead>
                                <TableHead className="text-center">Pool</TableHead>
                                <TableHead className="text-center">CT</TableHead>
                                <TableHead>Resultado</TableHead>
                                <TableHead className="text-center">CT 2</TableHead>
                                <TableHead>Resultado 2</TableHead>
                                <TableHead className="text-center">Positivos</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {visibles.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={12} className="py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <IconDna size={28} className="opacity-40" />
                                            <span>{loading ? 'Consultando registros en LaboratorioADL...' : 'No se encontraron registros para el rango y filtros seleccionados'}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                visibles.map((row, idx) => (
                                    <TableRow key={`${row.caso_adlab}-${row.agente}-${row.pool}-${idx}`}>
                                        <TableCell className="whitespace-nowrap font-medium tabular-nums">{row.caso_adlab}</TableCell>
                                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateOnly(row.fecha_recepcion)}</TableCell>
                                        <TableCell className="max-w-[200px] truncate" title={row.nombre_centro}>{row.nombre_centro || '-'}</TableCell>
                                        <TableCell className="max-w-[160px] truncate text-muted-foreground" title={row.programa}>{row.programa || '-'}</TableCell>
                                        <TableCell className="max-w-[140px] truncate text-muted-foreground" title={row.matriz}>{row.matriz || '-'}</TableCell>
                                        <TableCell className="max-w-[220px] truncate font-medium text-primary" title={row.agente}>{row.agente || '-'}</TableCell>
                                        <TableCell className="text-center tabular-nums">{row.pool ?? '-'}</TableCell>
                                        <TableCell className="text-center tabular-nums">
                                            {row.ct !== null && row.ct !== undefined && row.ct !== ''
                                                ? (soloMenorCT ? <Badge variant="warning">{row.ct}</Badge> : row.ct)
                                                : <span className="text-muted-foreground">-</span>}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap"><ResultadoBadge resultado={row.resultado} /></TableCell>
                                        <TableCell className="text-center tabular-nums text-muted-foreground">{row.ct2 ?? '-'}</TableCell>
                                        <TableCell className="whitespace-nowrap"><ResultadoBadge resultado={row.resultado2} /></TableCell>
                                        <TableCell className="text-center tabular-nums">{row.positivos ?? '-'}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <DataPagination
                    page={paginaActual}
                    pageSize={pageSize}
                    total={filtrados.length}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                />
            </div>
        </div>
    );
};

export default BiologiaMolecularPage;
