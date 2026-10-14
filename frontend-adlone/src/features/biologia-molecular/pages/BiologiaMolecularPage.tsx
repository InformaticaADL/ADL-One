import React, { useState, useEffect, useMemo } from 'react';
import {
    IconDna,
    IconSearch,
    IconDownload,
    IconCalendar,
    IconRefresh,
    IconFilter,
    IconBuildingHospital,
    IconCheck,
    IconAlertTriangle,
    IconFlask,
    IconChevronLeft,
    IconChevronRight,
    IconTrendingDown
} from '@tabler/icons-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '../../../contexts/ToastContext';
import {
    biologiaMolecularApiClient,
    exportBiologiaMolecularExcel,
    filterLowestCTByCasoMatrizAgente,
    type BiologiaMolecularMuestra
} from '../services/biologiaMolecular.service';

// Helper para formatear cifras con punto (.) como separador de miles
const formatThousands = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null || val === '') return '0';
    const num = Number(val);
    if (isNaN(num)) return String(val);
    return Math.trunc(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// Helper para formatear fechas a formato DD/MM/YYYY
const formatDateOnly = (val?: string | Date | null): string => {
    if (!val) return '-';
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
            const [y, m, d] = trimmed.slice(0, 10).split('-');
            return `${d}/${m}/${y}`;
        }
        if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
            return trimmed.slice(0, 10);
        }
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
            const d = String(parsed.getDate()).padStart(2, '0');
            const m = String(parsed.getMonth() + 1).padStart(2, '0');
            const y = parsed.getFullYear();
            return `${d}/${m}/${y}`;
        }
        return trimmed;
    }
    if (val instanceof Date && !isNaN(val.getTime())) {
        const d = String(val.getDate()).padStart(2, '0');
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const y = val.getFullYear();
        return `${d}/${m}/${y}`;
    }
    return String(val);
};

interface Props {
    onBack?: () => void;
}

export const BiologiaMolecularPage: React.FC<Props> = ({ onBack }) => {
    const { showToast } = useToast();

    // Filtros de Fecha (2 inputs)
    const todayStr = useMemo(() => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }, []);

    const [fechaDesde, setFechaDesde] = useState<string>('2026-01-01');
    const [fechaHasta, setFechaHasta] = useState<string>(() => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });

    const [loading, setLoading] = useState<boolean>(false);
    const [data, setData] = useState<BiologiaMolecularMuestra[]>([]);
    const [soloMenorCT, setSoloMenorCT] = useState<boolean>(false);
    const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'POSITIVO' | 'NEGATIVO' | 'OTROS'>('ALL');
    const [selectedCentro, setSelectedCentro] = useState<string>('ALL');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(25);

    // Cargar datos al montar o al presionar Consultar
    const handleFetch = async () => {
        if (!fechaDesde || !fechaHasta) {
            showToast({
                message: 'Debe ingresar un rango de fechas válido.',
                type: 'warning'
            });
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
            setCurrentPage(1);

            showToast({
                message: `Se encontraron ${formatThousands(result.length)} registros de Biología Molecular.`,
                type: result.length > 0 ? 'success' : 'info'
            });
        } catch (error: any) {
            console.error('Error al consultar Biología Molecular:', error);
            showToast({
                message: error?.response?.data?.message || error.message || 'Error al consultar datos en LaboratorioADL',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        handleFetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Datos base: todos los pools o filtrados al menor CT por cada (caso, matriz, agente)
    const processedData = useMemo(() => {
        if (!soloMenorCT) return data;
        return filterLowestCTByCasoMatrizAgente(data);
    }, [data, soloMenorCT]);

    // Métricas para los KPIs
    const stats = useMemo(() => {
        const totalRegistros = processedData.length;
        const casosUnicos = new Set(processedData.map(d => d.caso_adlab)).size;
        const centrosUnicos = new Set(processedData.map(d => d.nombre_centro)).size;
        const positivos = processedData.filter(d => {
            const r = String(d.resultado || '').toLowerCase().trim();
            return r === 'p' || r.includes('pos');
        }).length;
        const negativos = processedData.filter(d => {
            const r = String(d.resultado || '').toLowerCase().trim();
            return r === 'n' || r.includes('neg');
        }).length;
        const otros = totalRegistros - (positivos + negativos);
        return { totalRegistros, casosUnicos, centrosUnicos, positivos, negativos, otros };
    }, [processedData]);

    // Datos filtrados según la categoría (Todos / Positivo / Negativo / Otros)
    const categoryData = useMemo(() => {
        if (selectedCategory === 'POSITIVO') {
            return processedData.filter((item) => {
                const r = String(item.resultado || '').toLowerCase().trim();
                return r === 'p' || r.includes('pos');
            });
        }
        if (selectedCategory === 'NEGATIVO') {
            return processedData.filter((item) => {
                const r = String(item.resultado || '').toLowerCase().trim();
                return r === 'n' || r.includes('neg');
            });
        }
        if (selectedCategory === 'OTROS') {
            return processedData.filter((item) => {
                const r = String(item.resultado || '').toLowerCase().trim();
                return r !== 'p' && !r.includes('pos') && r !== 'n' && !r.includes('neg');
            });
        }
        return processedData;
    }, [processedData, selectedCategory]);

    // Lista dinámica de centros disponibles en la categoría seleccionada con su cantidad de muestras
    const availableCentros = useMemo(() => {
        const counts = new Map<string, number>();
        for (const item of categoryData) {
            const c = (item.nombre_centro || '').trim();
            if (c) {
                counts.set(c, (counts.get(c) || 0) + 1);
            }
        }
        return Array.from(counts.entries())
            .map(([nombre, count]) => ({ nombre, count }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [categoryData]);

    // Si cambia la categoría y el centro previamente seleccionado no existe en ella, resetear a 'ALL'
    useEffect(() => {
        if (selectedCentro !== 'ALL') {
            const exists = availableCentros.some((c) => c.nombre === selectedCentro);
            if (!exists) {
                setSelectedCentro('ALL');
                setCurrentPage(1);
            }
        }
    }, [availableCentros, selectedCentro]);

    // Datos finales filtrados por categoría y centro
    const filteredData = useMemo(() => {
        if (selectedCentro === 'ALL' || !selectedCentro) {
            return categoryData;
        }
        return categoryData.filter((item) => (item.nombre_centro || '').trim() === selectedCentro);
    }, [categoryData, selectedCentro]);

    // Exportar a Excel (exporta la vista filtrada o todo el conjunto procesado)
    const handleExportExcel = () => {
        const toExport = filteredData.length > 0 ? filteredData : processedData;
        if (toExport.length === 0) {
            showToast({
                message: 'No hay datos para exportar.',
                type: 'warning'
            });
            return;
        }
        try {
            const suffixCT = soloMenorCT ? '_menor_ct_max28' : '';
            const suffixCat = selectedCategory !== 'ALL' ? `_${selectedCategory.toLowerCase()}` : '';
            const suffixCentro = selectedCentro !== 'ALL' ? `_${selectedCentro.replace(/\s+/g, '_')}` : '';
            exportBiologiaMolecularExcel(toExport, `biologia_molecular_${fechaDesde}_al_${fechaHasta}${suffixCT}${suffixCat}${suffixCentro}`);
            showToast({
                message: `Archivo Excel generado con éxito (${formatThousands(toExport.length)} registros${soloMenorCT ? ' - Menor CT ≤ 28' : ''}).`,
                type: 'success'
            });
        } catch (error: any) {
            showToast({
                message: 'Error al generar el archivo Excel: ' + error.message,
                type: 'error'
            });
        }
    };

    // Paginación
    const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredData.slice(start, start + pageSize);
    }, [filteredData, currentPage, pageSize]);

    // Render de Badge para Resultados
    const renderResultadoBadge = (resultado?: string) => {
        if (!resultado) return <span className="text-muted-foreground text-xs italic">-</span>;
        const resLower = resultado.toLowerCase().trim();

        if (resLower === 'p' || resLower.includes('pos')) {
            return (
                <Badge variant="destructive" className="font-semibold text-xs px-2 py-0.5">
                    {resultado === 'P' ? 'Positivo (P)' : resultado}
                </Badge>
            );
        }
        if (resLower === 'n' || resLower.includes('neg')) {
            return (
                <Badge variant="outline" className="border-emerald-500/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold text-xs px-2 py-0.5">
                    {resultado === 'N' ? 'Negativo (N)' : resultado}
                </Badge>
            );
        }
        if (resLower === 'ep' || resLower.includes('proc') || resLower.includes('pend')) {
            return (
                <Badge variant="secondary" className="border-blue-500/40 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-semibold text-xs px-2 py-0.5">
                    {resultado === 'EP' ? 'En Proceso (EP)' : resultado}
                </Badge>
            );
        }
        if (resLower.includes('indet') || resLower.includes('sos')) {
            return (
                <Badge variant="secondary" className="border-amber-500/40 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-medium text-xs px-2 py-0.5">
                    {resultado}
                </Badge>
            );
        }
        return (
            <Badge variant="secondary" className="font-medium text-xs px-2 py-0.5">
                {resultado}
            </Badge>
        );
    };

    return (
        <div className="shadcn-scope w-full max-w-[98%] xl:max-w-[1700px] mx-auto p-4 md:p-6 space-y-6">
            <PageHeader
                title="Biología Molecular"
                subtitle="Consulta detallada de muestras y resultados por rango de fecha"
                onBack={onBack}
                rightSection={
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleFetch}
                            disabled={loading}
                            className="gap-1.5"
                        >
                            <IconRefresh size={15} className={loading ? 'animate-spin' : ''} />
                            Recargar
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleExportExcel}
                            disabled={loading || filteredData.length === 0}
                            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            <IconDownload size={15} />
                            Exportar Excel ({formatThousands(filteredData.length)})
                        </Button>
                    </div>
                }
            />

            {/* Formulario de Filtro por Rango de Fecha */}
            <Card className="border-border shadow-sm">
                <CardContent className="p-4 md:p-6">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleFetch();
                        }}
                        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end"
                    >
                        <div>
                            <Label htmlFor="fecha_desde" className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <IconCalendar size={14} className="text-primary" />
                                Fecha Desde (Muestreo)
                            </Label>
                            <Input
                                id="fecha_desde"
                                type="date"
                                min="2012-01-01"
                                max={fechaHasta || todayStr}
                                value={fechaDesde}
                                onChange={(e) => setFechaDesde(e.target.value)}
                                className="h-10 text-sm font-medium"
                                required
                            />
                        </div>

                        <div>
                            <Label htmlFor="fecha_hasta" className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <IconCalendar size={14} className="text-primary" />
                                Fecha Hasta (Muestreo)
                            </Label>
                            <Input
                                id="fecha_hasta"
                                type="date"
                                min="2012-01-01"
                                max={todayStr}
                                value={fechaHasta}
                                onChange={(e) => setFechaHasta(e.target.value)}
                                className="h-10 text-sm font-medium"
                                required
                            />
                        </div>

                        <div>
                            <Label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                                <IconBuildingHospital size={14} className="text-primary" />
                                Lugar de Análisis
                            </Label>
                            <div className="h-10 px-3 flex items-center bg-muted/50 rounded-md border border-input text-xs font-medium text-foreground">
                                Puerto Montt
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                type="submit"
                                disabled={loading}
                                className="h-10 flex-1 gap-2 font-medium"
                            >
                                <IconSearch size={16} className={loading ? 'animate-spin' : ''} />
                                {loading ? 'Consultando...' : 'Consultar'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {/* Tarjetas de Métricas Rápidas (Interactivas para filtrar con un clic) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card 
                    onClick={() => { setSelectedCategory('ALL'); setCurrentPage(1); }}
                    className={`p-3.5 cursor-pointer transition-all hover:shadow-md ${selectedCategory === 'ALL' ? 'ring-2 ring-primary bg-primary/5' : 'bg-gradient-to-br from-background to-muted/30'}`}
                >
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Registros</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{formatThousands(stats.totalRegistros)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                        {soloMenorCT ? 'Muestras con CT ≤ 28' : 'Análisis totales'}
                    </p>
                </Card>
                <Card className="p-3.5 bg-gradient-to-br from-background to-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Casos Únicos</p>
                    <p className="text-2xl font-bold text-primary mt-1">{formatThousands(stats.casosUnicos)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Casos registrados</p>
                </Card>
                <Card className="p-3.5 bg-gradient-to-br from-background to-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Centros</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{formatThousands(stats.centrosUnicos)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Centros productivos</p>
                </Card>
                <Card 
                    onClick={() => { setSelectedCategory('POSITIVO'); setCurrentPage(1); }}
                    className={`p-3.5 cursor-pointer transition-all hover:shadow-md ${selectedCategory === 'POSITIVO' ? 'ring-2 ring-red-500 bg-red-100/40 dark:bg-red-950/40' : 'bg-gradient-to-br from-red-50/30 to-red-100/20 dark:from-red-950/20 dark:to-background border-red-200/40 dark:border-red-900/40'}`}
                >
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider">Positivos</p>
                        {selectedCategory === 'POSITIVO' && <span className="text-[10px] bg-red-600 text-white rounded px-1 font-bold">Activo</span>}
                    </div>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{formatThousands(stats.positivos)}</p>
                    <p className="text-[10px] text-red-600/70 dark:text-red-400/70 mt-0.5 font-medium">Análisis positivos</p>
                </Card>
                <Card 
                    onClick={() => { setSelectedCategory('NEGATIVO'); setCurrentPage(1); }}
                    className={`p-3.5 cursor-pointer transition-all hover:shadow-md ${selectedCategory === 'NEGATIVO' ? 'ring-2 ring-emerald-500 bg-emerald-100/40 dark:bg-emerald-950/40' : 'bg-gradient-to-br from-emerald-50/30 to-emerald-100/20 dark:from-emerald-950/20 dark:to-background border-emerald-200/40 dark:border-emerald-900/40'}`}
                >
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Negativos</p>
                        {selectedCategory === 'NEGATIVO' && <span className="text-[10px] bg-emerald-600 text-white rounded px-1 font-bold">Activo</span>}
                    </div>
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatThousands(stats.negativos)}</p>
                    <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5 font-medium">Análisis negativos</p>
                </Card>
                <Card 
                    onClick={() => { setSelectedCategory('OTROS'); setCurrentPage(1); }}
                    className={`p-3.5 cursor-pointer transition-all hover:shadow-md ${selectedCategory === 'OTROS' ? 'ring-2 ring-blue-500 bg-blue-100/40 dark:bg-blue-950/40' : 'bg-gradient-to-br from-blue-50/30 to-blue-100/20 dark:from-blue-950/20 dark:to-background border-blue-200/40 dark:border-blue-900/40'}`}
                >
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">En Proceso (EP)</p>
                        {selectedCategory === 'OTROS' && <span className="text-[10px] bg-blue-600 text-white rounded px-1 font-bold">Activo</span>}
                    </div>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatThousands(stats.otros)}</p>
                    <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 mt-0.5 font-medium">Análisis pendientes de resultado</p>
                </Card>
            </div>

            {/* Tabla de Resultados y Filtros */}
            <Card className="border-border shadow-sm overflow-hidden">
                <div className="p-3 md:p-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-muted/20">
                    {/* Switch Menor CT por Caso y Matriz */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all shadow-sm ${
                        soloMenorCT 
                            ? 'border-amber-500/50 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 ring-1 ring-amber-500/20' 
                            : 'border-border bg-background text-foreground hover:border-primary/40'
                    }`}>
                        <Switch
                            id="toggle-menor-ct"
                            checked={soloMenorCT}
                            onCheckedChange={(checked) => {
                                setSoloMenorCT(checked);
                                setCurrentPage(1);
                            }}
                        />
                        <Label
                            htmlFor="toggle-menor-ct"
                            className="text-xs font-semibold cursor-pointer select-none flex items-center gap-1.5"
                        >
                            <IconTrendingDown size={14} className={soloMenorCT ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'} />
                            <span>Menor CT (≤ 28) por Caso/Matriz</span>
                        </Label>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Filtro Rápido por Categoría (Resultado) */}
                        <div className="flex items-center rounded-lg border border-border bg-background p-0.5 shadow-sm text-xs">
                            <button
                                type="button"
                                onClick={() => { setSelectedCategory('ALL'); setCurrentPage(1); }}
                                className={`px-2.5 py-1.5 rounded-md font-medium transition-all ${
                                    selectedCategory === 'ALL'
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                                }`}
                            >
                                Todos ({formatThousands(stats.totalRegistros)})
                            </button>
                            <button
                                type="button"
                                onClick={() => { setSelectedCategory('POSITIVO'); setCurrentPage(1); }}
                                className={`px-2.5 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                                    selectedCategory === 'POSITIVO'
                                        ? 'bg-red-600 text-white shadow-sm font-semibold'
                                        : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                                }`}
                            >
                                <span className={`h-1.5 w-1.5 rounded-full ${selectedCategory === 'POSITIVO' ? 'bg-white' : 'bg-red-500'}`} />
                                Positivo ({formatThousands(stats.positivos)})
                            </button>
                            <button
                                type="button"
                                onClick={() => { setSelectedCategory('NEGATIVO'); setCurrentPage(1); }}
                                className={`px-2.5 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                                    selectedCategory === 'NEGATIVO'
                                        ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                                        : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                }`}
                            >
                                <span className={`h-1.5 w-1.5 rounded-full ${selectedCategory === 'NEGATIVO' ? 'bg-white' : 'bg-emerald-500'}`} />
                                Negativo ({formatThousands(stats.negativos)})
                            </button>
                            {stats.otros > 0 && (
                                <button
                                    type="button"
                                    onClick={() => { setSelectedCategory('OTROS'); setCurrentPage(1); }}
                                    className={`px-2.5 py-1.5 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                                        selectedCategory === 'OTROS'
                                            ? 'bg-blue-600 text-white shadow-sm font-semibold'
                                            : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                                    }`}
                                >
                                    <span className={`h-1.5 w-1.5 rounded-full ${selectedCategory === 'OTROS' ? 'bg-white' : 'bg-blue-500'}`} />
                                    En Proceso ({formatThousands(stats.otros)})
                                </button>
                            )}
                        </div>

                        {/* Selector Dinámico de Centro */}
                        <select
                            value={selectedCentro}
                            onChange={(e) => {
                                setSelectedCentro(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="h-8 text-xs border border-input rounded-md px-2.5 bg-background text-foreground shadow-sm max-w-[210px] truncate"
                            title="Filtrar por centro"
                        >
                            <option value="ALL">
                                Todos los centros ({formatThousands(availableCentros.length)})
                            </option>
                            {availableCentros.map(({ nombre, count }) => (
                                <option key={nombre} value={nombre}>
                                    {nombre} ({formatThousands(count)})
                                </option>
                            ))}
                        </select>

                        {/* Tamaño de página */}
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                setPageSize(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="h-8 text-xs border border-input rounded-md px-2 bg-background text-foreground shadow-sm"
                        >
                            <option value={15}>15 por pág.</option>
                            <option value={25}>25 por pág.</option>
                            <option value={50}>50 por pág.</option>
                            <option value={100}>100 por pág.</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-muted/60 text-muted-foreground font-semibold border-b border-border">
                                <th className="p-2.5 pl-4 whitespace-nowrap">Caso ADLab</th>
                                <th className="p-2.5 whitespace-nowrap">Fecha Recep.</th>
                                <th className="p-2.5 whitespace-nowrap">Centro</th>
                                <th className="p-2.5 whitespace-nowrap">Programa</th>
                                <th className="p-2.5 whitespace-nowrap">Matriz</th>
                                <th className="p-2.5 whitespace-nowrap">Agente / Técnica</th>
                                <th className="p-2.5 text-center whitespace-nowrap">Pool</th>
                                <th className="p-2.5 text-center whitespace-nowrap">CT</th>
                                <th className="p-2.5 whitespace-nowrap">Resultado</th>
                                <th className="p-2.5 text-center whitespace-nowrap">CT 2</th>
                                <th className="p-2.5 whitespace-nowrap">Resultado 2</th>
                                <th className="p-2.5 text-center pr-4 whitespace-nowrap">Positivos</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={12} className="text-center py-12 text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <IconRefresh size={28} className="animate-spin text-primary" />
                                            <p className="text-sm font-medium">Consultando registros en LaboratorioADL...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedData.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="text-center py-12 text-muted-foreground">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <IconDna size={32} className="opacity-40 text-muted-foreground" />
                                            <p className="text-sm font-medium">No se encontraron registros para el rango y filtros seleccionados</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedData.map((row, idx) => (
                                    <tr
                                        key={`${row.caso_adlab}-${row.agente}-${row.pool}-${idx}`}
                                        className="hover:bg-muted/40 transition-colors"
                                    >
                                        <td className="p-2.5 pl-4 font-mono font-bold text-foreground whitespace-nowrap">
                                            {row.caso_adlab}
                                        </td>
                                        <td className="p-2.5 font-mono text-muted-foreground whitespace-nowrap">
                                            {formatDateOnly(row.fecha_recepcion)}
                                        </td>
                                        <td className="p-2.5 font-medium text-foreground max-w-[180px] truncate" title={row.nombre_centro}>
                                            {row.nombre_centro || '-'}
                                        </td>
                                        <td className="p-2.5 text-muted-foreground max-w-[140px] truncate" title={row.programa}>
                                            {row.programa || '-'}
                                        </td>
                                        <td className="p-2.5 text-muted-foreground max-w-[120px] truncate" title={row.matriz}>
                                            {row.matriz || '-'}
                                        </td>
                                        <td className="p-2.5 font-medium text-primary max-w-[200px] truncate" title={row.agente}>
                                            {row.agente || '-'}
                                        </td>
                                        <td className="p-2.5 text-center font-mono">
                                            {row.pool ?? '-'}
                                        </td>
                                        <td className="p-2.5 text-center font-mono font-semibold text-foreground">
                                            {row.ct !== null && row.ct !== undefined && row.ct !== '' ? (
                                                soloMenorCT ? (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/20">
                                                        {row.ct}
                                                    </span>
                                                ) : (
                                                    row.ct
                                                )
                                            ) : (
                                                <span className="text-muted-foreground font-normal italic">-</span>
                                            )}
                                        </td>
                                        <td className="p-2.5 whitespace-nowrap">
                                            {renderResultadoBadge(row.resultado)}
                                        </td>
                                        <td className="p-2.5 text-center font-mono text-muted-foreground">
                                            {row.ct2 ?? '-'}
                                        </td>
                                        <td className="p-2.5 whitespace-nowrap">
                                            {row.resultado2 ? renderResultadoBadge(row.resultado2) : <span className="text-muted-foreground italic">-</span>}
                                        </td>
                                        <td className="p-2.5 text-center pr-4 font-mono font-semibold">
                                            {row.positivos ?? '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Controles de Paginación */}
                {filteredData.length > 0 && (
                    <div className="p-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/10">
                        <span>
                            Mostrando {formatThousands(((currentPage - 1) * pageSize) + 1)} a {formatThousands(Math.min(currentPage * pageSize, filteredData.length))} de {formatThousands(filteredData.length)} filas
                        </span>

                        <div className="flex items-center gap-1.5">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="h-7 w-7 p-0"
                            >
                                <IconChevronLeft size={14} />
                            </Button>
                            <span className="font-medium text-foreground px-1.5">
                                {formatThousands(currentPage)} / {formatThousands(totalPages)}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="h-7 w-7 p-0"
                            >
                                <IconChevronRight size={14} />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default BiologiaMolecularPage;
