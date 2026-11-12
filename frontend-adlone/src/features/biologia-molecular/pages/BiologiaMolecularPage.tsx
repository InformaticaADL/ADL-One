import React, { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { IconDna, IconDownload, IconFilter, IconRefresh, IconSearch, IconX } from '@tabler/icons-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { DataPagination } from '@/components/ui/pagination';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
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

/**
 * Normaliza un texto para agrupar y comparar ignorando mayúsculas/minúsculas,
 * tildes (áéíóúü) y espacios repetidos, sin alterar el valor original de la tabla.
 */
const normalizeFilterKey = (val?: string | null): string => {
    if (!val) return '';
    return val
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .replace(/[áàäâ]/g, 'a')
        .replace(/[éèëê]/g, 'e')
        .replace(/[íìïî]/g, 'i')
        .replace(/[óòöô]/g, 'o')
        .replace(/[úùüû]/g, 'u');
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

/**
 * Remarca en amarillo/ámbar cualquier fragmento que coincida con el texto buscado.
 */
const HighlightMatch: React.FC<{ text?: string | number | null; query?: string; fallback?: string }> = ({
    text,
    query,
    fallback = '-'
}) => {
    const raw = text !== null && text !== undefined && text !== '' ? String(text) : '';
    if (!raw) return <>{fallback}</>;
    const q = (query || '').trim();
    if (!q) return <>{raw}</>;

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = raw.split(new RegExp(`(${escaped})`, 'gi'));

    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === q.toLowerCase() ? (
                    <mark
                        key={i}
                        className="rounded-xs bg-amber-300/80 px-0.5 font-semibold text-foreground dark:bg-amber-500/40"
                    >
                        {part}
                    </mark>
                ) : (
                    <React.Fragment key={i}>{part}</React.Fragment>
                )
            )}
        </>
    );
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

    // La pantalla abre con los últimos 30 días. Antes traía todo el año en curso (85 mil filas, ~33 MB y varios segundos de CPU del
    // servidor del laboratorio) cada vez que alguien la abría; para ver un período más largo se elige el rango y se consulta.
    const [fechaDesde, setFechaDesde] = useState<string>(() => dayjs().subtract(30, 'day').format(FORMATO_ISO));
    const [fechaHasta, setFechaHasta] = useState<string>(() => dayjs().format(FORMATO_ISO));

    const [loading, setLoading] = useState(false);
    const [exportingExcel, setExportingExcel] = useState(false);
    const [data, setData] = useState<BiologiaMolecularMuestra[]>([]);
    const [soloMenorCT, setSoloMenorCT] = useState(false);
    const [categoria, setCategoria] = useState<Categoria>('ALL');
    const [centro, setCentro] = useState('ALL');
    const [matriz, setMatriz] = useState('ALL');
    const [tecnica, setTecnica] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedRow, setSelectedRow] = useState<BiologiaMolecularMuestra | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

    // `fresco`: el botón Consultar pide datos al día; la consulta automática al abrir usa lo que el servidor ya tenga guardado.
    const consultar = async (fresco = false) => {
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
                id_lugaranalisis: 1,
                limite: 100000,
                ...(fresco ? { fresco: 1 as const } : {})
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

    // Si el centro elegido ya no existe en la categoría, se trata como "todos".
    const centroActivo = centrosDisponibles.some((c) => c.nombre === centro) ? centro : 'ALL';

    const porCentro = useMemo(
        () => (centroActivo === 'ALL' ? porCategoria : porCategoria.filter((d) => (d.nombre_centro || '').trim() === centroActivo)),
        [porCategoria, centroActivo]
    );

    // Matrices disponibles según categoría y centro seleccionados (unificando tildes y mayúsculas/minúsculas).
    const matricesDisponibles = useMemo(() => {
        const groups = new Map<string, { n: number; variants: Map<string, number> }>();
        for (const d of porCentro) {
            const m = (d.matriz || '').trim();
            if (m && m !== 'NA') {
                const key = normalizeFilterKey(m);
                const prev = groups.get(key) || { n: 0, variants: new Map<string, number>() };
                prev.n++;
                prev.variants.set(m, (prev.variants.get(m) || 0) + 1);
                groups.set(key, prev);
            }
        }
        return Array.from(groups.values())
            .map(({ n, variants }) => {
                let bestLabel = '';
                let bestCount = -1;
                for (const [variant, vCount] of variants.entries()) {
                    if (vCount > bestCount || (vCount === bestCount && /[áéíóúÁÉÍÓÚ]/.test(variant))) {
                        bestLabel = variant;
                        bestCount = vCount;
                    }
                }
                return { nombre: bestLabel, n };
            })
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
    }, [porCentro]);

    const matrizActiva = useMemo(() => {
        if (matriz === 'ALL') return 'ALL';
        const targetKey = normalizeFilterKey(matriz);
        const match = matricesDisponibles.find((m) => normalizeFilterKey(m.nombre) === targetKey);
        return match ? match.nombre : 'ALL';
    }, [matricesDisponibles, matriz]);

    const porMatriz = useMemo(() => {
        if (matrizActiva === 'ALL') return porCentro;
        const targetKey = normalizeFilterKey(matrizActiva);
        return porCentro.filter((d) => normalizeFilterKey(d.matriz) === targetKey);
    }, [porCentro, matrizActiva]);

    // Agentes / técnicas disponibles según categoría, centro y matriz seleccionados.
    const tecnicasDisponibles = useMemo(() => {
        const cuentas = new Map<string, number>();
        for (const d of porMatriz) {
            const t = (d.agente || '').trim();
            if (t) cuentas.set(t, (cuentas.get(t) || 0) + 1);
        }
        return Array.from(cuentas.entries())
            .map(([nombre, n]) => ({ nombre, n }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [porMatriz]);

    const tecnicaActiva = tecnicasDisponibles.some((t) => t.nombre === tecnica) ? tecnica : 'ALL';

    const filtrados = useMemo(() => {
        const porTec = tecnicaActiva === 'ALL' ? porMatriz : porMatriz.filter((d) => (d.agente || '').trim() === tecnicaActiva);
        const q = searchQuery.trim().toLowerCase();
        if (!q) return porTec;
        return porTec.filter((item) => {
            return (
                String(item.caso_adlab ?? '').toLowerCase().includes(q) ||
                (item.nombre_centro || '').toLowerCase().includes(q) ||
                (item.programa || '').toLowerCase().includes(q) ||
                (item.matriz || '').toLowerCase().includes(q) ||
                (item.agente || '').toLowerCase().includes(q) ||
                String(item.pool ?? '').toLowerCase().includes(q) ||
                (item.resultado || '').toLowerCase().includes(q) ||
                (item.observaciones || '').toLowerCase().includes(q) ||
                (item.comentario || '').toLowerCase().includes(q)
            );
        });
    }, [porMatriz, tecnicaActiva, searchQuery]);

    const opcionesCentro = useMemo(
        () => [
            { value: 'ALL', label: `Todos los centros (${formatThousands(centrosDisponibles.length)})` },
            ...centrosDisponibles.map(({ nombre, n }) => ({ value: nombre, label: `${nombre} (${formatThousands(n)})` })),
        ],
        [centrosDisponibles]
    );

    const opcionesMatriz = useMemo(
        () => [
            { value: 'ALL', label: `Todas las matrices (${formatThousands(matricesDisponibles.length)})` },
            ...matricesDisponibles.map(({ nombre, n }) => ({ value: nombre, label: `${nombre} (${formatThousands(n)})` })),
        ],
        [matricesDisponibles]
    );

    const opcionesTecnica = useMemo(
        () => [
            { value: 'ALL', label: `Todos los agentes (${formatThousands(tecnicasDisponibles.length)})` },
            ...tecnicasDisponibles.map(({ nombre, n }) => ({ value: nombre, label: `${nombre} (${formatThousands(n)})` })),
        ],
        [tecnicasDisponibles]
    );

    const filtrosActivos = [
        soloMenorCT,
        categoria !== 'ALL',
        centroActivo !== 'ALL',
        matrizActiva !== 'ALL',
        tecnicaActiva !== 'ALL',
        searchQuery.trim() !== ''
    ].filter(Boolean).length;

    const elegirCategoria = (c: Categoria) => { setCategoria(c); setPage(1); };

    const limpiarFiltros = () => {
        setSoloMenorCT(false);
        setCategoria('ALL');
        setCentro('ALL');
        setMatriz('ALL');
        setTecnica('ALL');
        setSearchQuery('');
        setPage(1);
    };

    const paginaActual = Math.min(page, Math.max(1, Math.ceil(filtrados.length / pageSize)));
    const visibles = useMemo(
        () => filtrados.slice((paginaActual - 1) * pageSize, paginaActual * pageSize),
        [filtrados, paginaActual, pageSize]
    );

    // Todos los registros pertenecientes al mismo Caso ADLab seleccionado para el modal de detalle
    const selectedCasoRows = useMemo(() => {
        if (!selectedRow) return [];
        const targetCaso = String(selectedRow.caso_adlab ?? '').trim();
        return base.filter((item) => String(item.caso_adlab ?? '').trim() === targetCaso);
    }, [base, selectedRow]);

    const exportar = async () => {
        const aExportar = filtrados.length > 0 ? filtrados : base;
        if (aExportar.length === 0) {
            showToast({ message: 'No hay datos para exportar.', type: 'warning' });
            return;
        }

        const sufijoCT = soloMenorCT ? '_menor_ct_max28' : '';
        const sufijoCat = categoria !== 'ALL' ? `_${categoria.toLowerCase()}` : '';
        const sufijoCentro = centroActivo !== 'ALL' ? `_${centroActivo.replace(/\s+/g, '_')}` : '';
        const sufijoMatriz = matrizActiva !== 'ALL' ? `_${matrizActiva.replace(/\s+/g, '_')}` : '';
        const sufijoTec = tecnicaActiva !== 'ALL' ? `_${tecnicaActiva.replace(/\s+/g, '_')}` : '';
        const baseFilename = `biologia_molecular_${fechaDesde}_al_${fechaHasta}${sufijoCT}${sufijoCat}${sufijoCentro}${sufijoMatriz}${sufijoTec}`;

        if (data.length >= 100_000 || aExportar.length >= 50_000) {
            try {
                setExportingExcel(true);
                showToast({
                    message: 'Generando archivo Excel (.xlsx) completo desde el servidor...',
                    type: 'info'
                });
                await biologiaMolecularApiClient.downloadExcel({
                    fecha_desde: fechaDesde,
                    fecha_hasta: fechaHasta,
                    id_lugaranalisis: 1,
                    solo_menor_ct: soloMenorCT,
                    categoria,
                    centro: centroActivo,
                    matriz: matrizActiva,
                    tecnica: tecnicaActiva
                }, `${baseFilename}.xlsx`);
                showToast({
                    message: 'Archivo Excel (.xlsx) descargado con éxito.',
                    type: 'success'
                });
            } catch (error) {
                showToast({ message: 'Error al generar el archivo Excel: ' + (error as Error).message, type: 'error' });
            } finally {
                setExportingExcel(false);
            }
            return;
        }

        try {
            setExportingExcel(true);
            exportBiologiaMolecularExcel(aExportar, baseFilename);
            showToast({
                message: `Archivo Excel generado con éxito (${formatThousands(aExportar.length)} registros${soloMenorCT ? ' - Menor CT ≤ 28' : ''}).`,
                type: 'success'
            });
        } catch (error) {
            showToast({ message: 'Error al generar el archivo Excel: ' + (error as Error).message, type: 'error' });
        } finally {
            setExportingExcel(false);
        }
    };

    return (
        <div className="shadcn-scope flex h-full min-h-0 flex-col [&>*]:shrink-0">
            <div className="px-4 pt-4 md:px-6 md:pt-6">
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
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Buscar en resultados</Label>
                                        <div className="relative">
                                            <IconSearch
                                                size={15}
                                                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                                            />
                                            <Input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => {
                                                    setSearchQuery(e.target.value);
                                                    setPage(1);
                                                }}
                                                placeholder="Caso (ej. PM-168244), agente, centro..."
                                                className="pl-8 pr-7"
                                            />
                                            {searchQuery && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSearchQuery('');
                                                        setPage(1);
                                                    }}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                                    title="Limpiar búsqueda"
                                                >
                                                    <IconX size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

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
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Matriz</Label>
                                        <Combobox
                                            options={opcionesMatriz}
                                            value={matrizActiva}
                                            onValueChange={(v) => { setMatriz(v || 'ALL'); setPage(1); }}
                                            placeholder="Todas las matrices"
                                            searchPlaceholder="Buscar matriz..."
                                        />
                                    </div>
                                    <div>
                                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Agente / Técnica</Label>
                                        <Combobox
                                            options={opcionesTecnica}
                                            value={tecnicaActiva}
                                            onValueChange={(v) => { setTecnica(v || 'ALL'); setPage(1); }}
                                            placeholder="Todos los agentes"
                                            searchPlaceholder="Buscar agente..."
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
                                    <Button onClick={() => void consultar(true)} disabled={loading}>
                                        {loading ? 'Consultando...' : 'Consultar'}
                                    </Button>
                                </SheetFooter>
                            </SheetContent>
                        </Sheet>

                        <Button variant="outline" onClick={() => void consultar(true)} disabled={loading || exportingExcel} title="Volver a consultar">
                            <IconRefresh size={16} className={loading ? 'animate-spin' : ''} /> Recargar
                        </Button>
                        <Button variant="outline" onClick={() => void exportar()} disabled={loading || exportingExcel || filtrados.length === 0}>
                            <IconDownload size={16} className={exportingExcel ? 'animate-spin' : ''} /> {exportingExcel ? 'Generando...' : 'Exportar Excel'}
                        </Button>
                    </div>
                }
                />
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-1 md:px-6 md:pb-6">
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
                    <Table
                        containerClassName="min-h-0"
                        className="[&_th]:px-3.5 [&_td]:px-3.5 [&_td]:py-2.5 [&_th:first-child]:pl-5 [&_td:first-child]:pl-5 [&_th:last-child]:pr-5 [&_td:last-child]:pr-5"
                    >
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
                                    <TableRow
                                        key={`${row.caso_adlab}-${row.agente}-${row.pool}-${idx}`}
                                        onClick={() => setSelectedRow(row)}
                                        className="cursor-pointer"
                                        title="Clic para ver el detalle completo del caso"
                                    >
                                        <TableCell className="whitespace-nowrap font-medium tabular-nums">
                                            <HighlightMatch text={row.caso_adlab} query={searchQuery} />
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateOnly(row.fecha_recepcion)}</TableCell>
                                        <TableCell className="max-w-[200px] truncate" title={row.nombre_centro}>
                                            <HighlightMatch text={row.nombre_centro} query={searchQuery} />
                                        </TableCell>
                                        <TableCell className="max-w-[160px] truncate text-muted-foreground" title={row.programa}>
                                            <HighlightMatch text={row.programa} query={searchQuery} />
                                        </TableCell>
                                        <TableCell className="max-w-[140px] truncate text-muted-foreground" title={row.matriz}>
                                            <HighlightMatch text={row.matriz} query={searchQuery} />
                                        </TableCell>
                                        <TableCell className="max-w-[220px] truncate font-medium text-primary" title={row.agente}>
                                            <HighlightMatch text={row.agente} query={searchQuery} />
                                        </TableCell>
                                        <TableCell className="text-center tabular-nums">
                                            <HighlightMatch text={row.pool} query={searchQuery} />
                                        </TableCell>
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

            {/* Modal de Detalle Completo del Caso */}
            <Dialog open={!!selectedRow} onOpenChange={(open) => !open && setSelectedRow(null)}>
                <DialogContent
                    className="flex h-[88vh] max-h-[92vh] w-[96vw] max-w-7xl sm:max-w-7xl flex-col overflow-hidden p-0 gap-0"
                    style={{ maxWidth: '1360px', width: '96vw', height: '88vh', maxHeight: '92vh' }}
                >
                    {selectedRow && (
                        <>
                            <DialogHeader className="border-b border-border px-6 py-4 shrink-0 bg-muted/20">
                                <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
                                    <div>
                                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                                            <IconDna size={20} className="text-primary" />
                                            <span>Detalle del Caso {selectedRow.caso_adlab}</span>
                                        </DialogTitle>
                                        <DialogDescription className="text-xs mt-1">
                                            Centro: <strong className="text-foreground">{selectedRow.nombre_centro || '-'}</strong> · Programa: <strong className="text-foreground">{selectedRow.programa || '-'}</strong>
                                        </DialogDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ResultadoBadge resultado={selectedRow.resultado} />
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-xs">
                                {/* Grilla con todas las columnas del registro seleccionado */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 bg-muted/30 p-4 rounded-lg border border-border">
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Caso ADLab</span>
                                        <span className="font-mono font-bold text-sm text-foreground mt-0.5 block">
                                            <HighlightMatch text={selectedRow.caso_adlab} query={searchQuery} />
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Fecha Recepción</span>
                                        <span className="font-mono font-medium text-foreground mt-0.5 block">{formatDateOnly(selectedRow.fecha_recepcion)}</span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Fecha Muestreo</span>
                                        <span className="font-mono font-medium text-foreground mt-0.5 block">{formatDateOnly(selectedRow.fecha_muestreo)}</span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Centro</span>
                                        <span className="font-medium text-foreground mt-0.5 block">
                                            <HighlightMatch text={selectedRow.nombre_centro} query={searchQuery} />
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Programa</span>
                                        <span className="font-medium text-foreground mt-0.5 block">
                                            <HighlightMatch text={selectedRow.programa} query={searchQuery} />
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Matriz</span>
                                        <span className="font-medium text-foreground mt-0.5 block">
                                            <HighlightMatch text={selectedRow.matriz} query={searchQuery} />
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Pool</span>
                                        <span className="font-mono font-semibold text-foreground mt-0.5 block">
                                            <HighlightMatch text={selectedRow.pool} query={searchQuery} />
                                        </span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Agente / Técnica</span>
                                        <span className="font-semibold text-primary mt-0.5 block">
                                            <HighlightMatch text={selectedRow.agente} query={searchQuery} />
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">CT</span>
                                        <span className="font-mono font-bold text-foreground mt-0.5 block">
                                            {selectedRow.ct !== null && selectedRow.ct !== undefined && selectedRow.ct !== '' ? selectedRow.ct : '-'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Resultado</span>
                                        <div className="mt-1"><ResultadoBadge resultado={selectedRow.resultado} /></div>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">CT 2</span>
                                        <span className="font-mono text-foreground mt-0.5 block">
                                            {selectedRow.ct2 !== null && selectedRow.ct2 !== undefined && selectedRow.ct2 !== '' ? selectedRow.ct2 : '-'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Resultado 2</span>
                                        <div className="mt-1">
                                            <ResultadoBadge resultado={selectedRow.resultado2} />
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Positivos</span>
                                        <span className="font-mono font-semibold text-foreground mt-0.5 block">
                                            {selectedRow.positivos !== null && selectedRow.positivos !== undefined && selectedRow.positivos !== '' ? selectedRow.positivos : '-'}
                                        </span>
                                    </div>
                                </div>

                                {/* Observaciones y Comentario lado a lado en escritorio */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="rounded-lg border border-border bg-background p-3.5">
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                            Observaciones
                                        </span>
                                        <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap break-words">
                                            {selectedRow.observaciones ? (
                                                <HighlightMatch text={selectedRow.observaciones} query={searchQuery} />
                                            ) : (
                                                <span className="text-muted-foreground italic">Sin observaciones registradas</span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-border bg-background p-3.5">
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                                            Comentario
                                        </span>
                                        <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap break-words">
                                            {selectedRow.comentario ? (
                                                <HighlightMatch text={selectedRow.comentario} query={searchQuery} />
                                            ) : (
                                                <span className="text-muted-foreground italic">Sin comentarios registrados</span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {/* Otros análisis / pooles del mismo Caso ADLab */}
                                {selectedCasoRows.length > 1 && (
                                    <div className="rounded-lg border border-border overflow-hidden">
                                        <div className="bg-muted/40 px-3.5 py-2 border-b border-border flex items-center justify-between">
                                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                Todos los análisis del caso {selectedRow.caso_adlab} ({formatThousands(selectedCasoRows.length)})
                                            </span>
                                            <span className="text-[11px] text-muted-foreground">
                                                Clic en una fila para ver su detalle
                                            </span>
                                        </div>
                                        <Table
                        containerClassName="min-h-0"
                        className="[&_th]:px-3.5 [&_td]:px-3.5 [&_td]:py-2.5 [&_th:first-child]:pl-5 [&_td:first-child]:pl-5 [&_th:last-child]:pr-5 [&_td:last-child]:pr-5"
                    >
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
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
                                                {selectedCasoRows.map((item, idx) => {
                                                    const isCurrent =
                                                        item.agente === selectedRow.agente &&
                                                        String(item.pool) === String(selectedRow.pool) &&
                                                        item.matriz === selectedRow.matriz;
                                                    return (
                                                        <TableRow
                                                            key={`${item.caso_adlab}-${item.agente}-${item.pool}-${idx}`}
                                                            onClick={() => setSelectedRow(item)}
                                                            className={cn(
                                                                'cursor-pointer',
                                                                isCurrent && 'bg-primary/10 font-semibold'
                                                            )}
                                                        >
                                                            <TableCell className="text-muted-foreground">{item.matriz || '-'}</TableCell>
                                                            <TableCell className="font-medium text-primary">{item.agente || '-'}</TableCell>
                                                            <TableCell className="text-center tabular-nums">{item.pool ?? '-'}</TableCell>
                                                            <TableCell className="text-center tabular-nums font-semibold">{item.ct || '-'}</TableCell>
                                                            <TableCell><ResultadoBadge resultado={item.resultado} /></TableCell>
                                                            <TableCell className="text-center tabular-nums text-muted-foreground">{item.ct2 || '-'}</TableCell>
                                                            <TableCell><ResultadoBadge resultado={item.resultado2} /></TableCell>
                                                            <TableCell className="text-center tabular-nums">{item.positivos ?? '-'}</TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>

                            <DialogFooter className="border-t border-border px-6 py-3 shrink-0 bg-muted/10">
                                <Button variant="outline" size="sm" onClick={() => setSelectedRow(null)}>
                                    Cerrar
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default BiologiaMolecularPage;
