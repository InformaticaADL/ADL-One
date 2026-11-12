import React, { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import {
    IconDna,
    IconSearch,
    IconDownload,
    IconRefresh,
    IconFilter,
    IconLock,
    IconX
} from '@tabler/icons-react';
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
import { useAuth } from '../../../contexts/AuthContext';
import {
    historicoBiologiaMolecularApiClient,
    exportHistoricoExcel,
    filterLowestCTHistorico,
    detectFormatFromData,
    type HistoricoMuestra
} from '../services/historicoBiologiaMolecular.service';

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

const OPCIONES_ANO = [
    { value: '2016', label: '2016 (Formato 3)' },
    { value: '2015', label: '2015 (Formato 3)' },
    { value: '2014', label: '2014 (Formato 3)' },
    { value: '2013', label: '2013 (Formato 3)' },
    { value: '2012', label: '2012 (Formato 2)' },
    { value: '2011', label: '2011 (Formato 2)' },
    { value: '2010', label: '2010 (Formato 2)' },
    { value: '2009', label: '2009 (Formato 2)' },
    { value: '2008', label: '2008 (Formato 1)' },
    { value: '2007', label: '2007 (Formato 1)' },
    { value: '2006', label: '2006 (Formato 1)' },
    { value: 'ALL', label: 'Todos los años (2006–2016)' },
];

const YEAR_GROUPS = [
    { label: '2006–2008', years: ['2006', '2007', '2008'] },
    { label: '2009–2012', years: ['2009', '2010', '2011', '2012'] },
    { label: '2013–2016', years: ['2013', '2014', '2015', '2016'] }
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

export const HistoricoBiologiaMolecularPage: React.FC<Props> = ({ onBack }) => {
    const { user, hasPermission } = useAuth();
    const { showToast } = useToast();

    // Verificación de seguridad
    const isFernandoB = (user?.username || '').trim().toUpperCase() === 'FERNANDOB';
    const isInformatica = hasPermission('INF_ACCESO') || (user?.permissions || []).includes('INF_ACCESO');
    const isAuthorized = isFernandoB || isInformatica;

    // Filtros de servidor (rango / año)
    const [selectedAno, setSelectedAno] = useState<string>('2016');
    const [fechaDesde, setFechaDesde] = useState<string>('2016-01-01');
    const [fechaHasta, setFechaHasta] = useState<string>('2016-12-31');

    const [loading, setLoading] = useState<boolean>(false);
    const [exportingExcel, setExportingExcel] = useState<boolean>(false);
    const [data, setData] = useState<HistoricoMuestra[]>([]);
    const [totalInDB, setTotalInDB] = useState<number>(0);
    const [isTruncated, setIsTruncated] = useState<boolean>(false);

    // Filtros locales en tiempo real (igual que Consulta de Muestras)
    const [soloMenorCT, setSoloMenorCT] = useState<boolean>(false);
    const [categoria, setCategoria] = useState<Categoria>('ALL');
    const [empresa, setEmpresa] = useState<string>('ALL');
    const [centro, setCentro] = useState<string>('ALL');
    const [organo, setOrgano] = useState<string>('ALL');
    const [agente, setAgente] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedRow, setSelectedRow] = useState<HistoricoMuestra | null>(null);
    const [page, setPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(10);
    const [filtrosAbiertos, setFiltrosAbiertos] = useState<boolean>(false);

    // Consulta al backend
    const handleFetch = async (overrideParams?: {
        ano?: string;
        fechaDesde?: string;
        fechaHasta?: string;
        fresco?: boolean;
    }) => {
        if (!isAuthorized) {
            showToast({
                message: 'No tiene permisos para consultar este módulo histórico.',
                type: 'error'
            });
            return;
        }

        const effAno = overrideParams?.ano !== undefined ? overrideParams.ano : selectedAno;
        const effDesde = overrideParams?.fechaDesde !== undefined ? overrideParams.fechaDesde : fechaDesde;
        const effHasta = overrideParams?.fechaHasta !== undefined ? overrideParams.fechaHasta : fechaHasta;

        const isFormat1Target =
            (effAno !== 'ALL' && Number(effAno) <= 2008) ||
            (effAno === 'ALL' && effHasta && Number(effHasta.slice(0, 4)) <= 2008);
        if (isFormat1Target && soloMenorCT) {
            setSoloMenorCT(false);
        }

        setLoading(true);
        try {
            const { data: result, totalCount, isTruncated: reachedLimit } =
                await historicoBiologiaMolecularApiClient.getConsultaHistoricoWithMeta({
                    ano: effAno !== 'ALL' ? effAno : undefined,
                    fecha_desde: effDesde || undefined,
                    fecha_hasta: effHasta || undefined,
                    limite: 100000,
                    fresco: overrideParams?.fresco ? 1 : undefined
                });

            setIsTruncated(reachedLimit);
            setTotalInDB(totalCount);
            setData(result);
            setPage(1);
            setFiltrosAbiertos(false);

            if (reachedLimit) {
                showToast({
                    message: `Se encontraron ${formatThousands(totalCount)} registros en BD (mostrando ${formatThousands(result.length)} en tabla). Para exportar la totalidad use Exportar Todo.`,
                    type: 'info'
                });
            } else {
                showToast({
                    message: `Se encontraron ${formatThousands(result.length)} registros históricos de Biología Molecular.`,
                    type: result.length > 0 ? 'success' : 'info'
                });
            }
        } catch (error) {
            console.error('Error al consultar data histórica:', error);
            const respuesta = (error as { response?: { data?: { message?: string } }; message?: string });
            showToast({
                message: respuesta?.response?.data?.message || respuesta?.message || 'Error al consultar datos en LaboratorioADLHistorico',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleYearSelect = (ano: string, autoFetch: boolean = true) => {
        const newDesde = ano !== 'ALL' ? `${ano}-01-01` : '2006-01-01';
        const newHasta = ano !== 'ALL' ? `${ano}-12-31` : '2016-12-31';
        if (ano !== 'ALL' && Number(ano) <= 2008 && soloMenorCT) {
            setSoloMenorCT(false);
        }
        setSelectedAno(ano);
        setFechaDesde(newDesde);
        setFechaHasta(newHasta);
        if (autoFetch) {
            void handleFetch({
                ano,
                fechaDesde: newDesde,
                fechaHasta: newHasta
            });
        }
    };

    const syncAnoWithDates = (newDesde: string, newHasta: string) => {
        const y1 = newDesde ? newDesde.slice(0, 4) : '';
        const y2 = newHasta ? newHasta.slice(0, 4) : '';
        if (y1 && y1 === y2 && Number(y1) >= 2006 && Number(y1) <= 2016) {
            setSelectedAno(y1);
        } else {
            setSelectedAno('ALL');
        }
    };

    useEffect(() => {
        if (isAuthorized) {
            void handleFetch();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Detectar qué formato histórico aplica según el año seleccionado o los datos cargados
    const activeFormat = useMemo((): 'FORMATO_1' | 'FORMATO_2' | 'FORMATO_3' | 'MIXTO' => {
        if (selectedAno !== 'ALL') {
            const y = parseInt(selectedAno, 10);
            if (y <= 2008) return 'FORMATO_1';
            if (y <= 2012) return 'FORMATO_2';
            return 'FORMATO_3';
        }
        return detectFormatFromData(data);
    }, [selectedAno, data]);

    useEffect(() => {
        if (activeFormat === 'FORMATO_1' && soloMenorCT) {
            setSoloMenorCT(false);
        }
    }, [activeFormat, soloMenorCT]);

    // Todos los pools, o solo el de menor CT por (caso, matriz, agente).
    const base = useMemo(() => {
        if (!soloMenorCT || activeFormat === 'FORMATO_1') return data;
        return filterLowestCTHistorico(data);
    }, [data, soloMenorCT, activeFormat]);

    // Métricas para los KPIs (mismo formato que Consulta de Muestras)
    const stats = useMemo(() => {
        const casos = new Set<string>();
        const centros = new Set<string>();
        let positivos = 0;
        let negativos = 0;
        for (const d of base) {
            if (d.n_caso) casos.add(d.n_caso);
            const c = (d.centro || '').trim();
            if (c && c !== 'NA') centros.add(c);
            const cat = categoriaDe(d.resultado);
            if (cat === 'POSITIVO') positivos++;
            else if (cat === 'NEGATIVO') negativos++;
        }
        return {
            total: base.length,
            casos: casos.size,
            centros: centros.size,
            positivos,
            negativos,
            otros: base.length - positivos - negativos
        };
    }, [base]);

    const porCategoria = useMemo(
        () => (categoria === 'ALL' ? base : base.filter((d) => categoriaDe(d.resultado) === categoria)),
        [base, categoria]
    );

    // Empresas disponibles
    const empresasDisponibles = useMemo(() => {
        const cuentas = new Map<string, number>();
        for (const d of porCategoria) {
            const emp = (d.empresa || '').trim();
            if (emp && emp !== 'NA') cuentas.set(emp, (cuentas.get(emp) || 0) + 1);
        }
        return Array.from(cuentas.entries())
            .map(([nombre, n]) => ({ nombre, n }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [porCategoria]);

    const empresaActiva = empresasDisponibles.some((e) => e.nombre === empresa) ? empresa : 'ALL';

    const porEmpresa = useMemo(
        () => (empresaActiva === 'ALL' ? porCategoria : porCategoria.filter((d) => (d.empresa || '').trim() === empresaActiva)),
        [porCategoria, empresaActiva]
    );

    // Centros disponibles
    const centrosDisponibles = useMemo(() => {
        const cuentas = new Map<string, number>();
        for (const d of porEmpresa) {
            const c = (d.centro || '').trim();
            if (c && c !== 'NA') cuentas.set(c, (cuentas.get(c) || 0) + 1);
        }
        return Array.from(cuentas.entries())
            .map(([nombre, n]) => ({ nombre, n }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [porEmpresa]);

    const centroActivo = centrosDisponibles.some((c) => c.nombre === centro) ? centro : 'ALL';

    const porCentro = useMemo(
        () => (centroActivo === 'ALL' ? porEmpresa : porEmpresa.filter((d) => (d.centro || '').trim() === centroActivo)),
        [porEmpresa, centroActivo]
    );

    // Matrices / Órganos disponibles (unificando tildes y mayúsculas/minúsculas)
    const organosDisponibles = useMemo(() => {
        const groups = new Map<string, { n: number; variants: Map<string, number> }>();
        for (const d of porCentro) {
            const org = (d.tejido_matriz || '').trim();
            if (org && org !== 'NA') {
                const key = normalizeFilterKey(org);
                const prev = groups.get(key) || { n: 0, variants: new Map<string, number>() };
                prev.n++;
                prev.variants.set(org, (prev.variants.get(org) || 0) + 1);
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

    const organoActivo = useMemo(() => {
        if (organo === 'ALL') return 'ALL';
        const targetKey = normalizeFilterKey(organo);
        const match = organosDisponibles.find((o) => normalizeFilterKey(o.nombre) === targetKey);
        return match ? match.nombre : 'ALL';
    }, [organosDisponibles, organo]);

    const porOrgano = useMemo(() => {
        if (organoActivo === 'ALL') return porCentro;
        const targetKey = normalizeFilterKey(organoActivo);
        return porCentro.filter((d) => normalizeFilterKey(d.tejido_matriz) === targetKey);
    }, [porCentro, organoActivo]);

    // Agentes / Técnicas disponibles
    const agentesDisponibles = useMemo(() => {
        const cuentas = new Map<string, number>();
        for (const d of porOrgano) {
            const ag = (d.agente || d.tecnica || '').trim();
            if (ag && ag !== 'NA') cuentas.set(ag, (cuentas.get(ag) || 0) + 1);
        }
        return Array.from(cuentas.entries())
            .map(([nombre, n]) => ({ nombre, n }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [porOrgano]);

    const agenteActivo = agentesDisponibles.some((a) => a.nombre === agente) ? agente : 'ALL';

    const filtrados = useMemo(() => {
        const porAg = agenteActivo === 'ALL' ? porOrgano : porOrgano.filter((d) => (d.agente || d.tecnica || '').trim() === agenteActivo);
        const q = searchQuery.trim().toLowerCase();
        if (!q) return porAg;
        return porAg.filter((item) => {
            return (
                (item.n_caso || '').toLowerCase().includes(q) ||
                (item.rut_empresa || '').toLowerCase().includes(q) ||
                (item.empresa || '').toLowerCase().includes(q) ||
                (item.rut_empresaservicio || '').toLowerCase().includes(q) ||
                (item.nombre_empresaservicio || '').toLowerCase().includes(q) ||
                (item.centro || '').toLowerCase().includes(q) ||
                (item.codigo_centro || '').toLowerCase().includes(q) ||
                (item.programa || '').toLowerCase().includes(q) ||
                (item.lote || '').toLowerCase().includes(q) ||
                (item.contenedor || '').toLowerCase().includes(q) ||
                (item.tejido_matriz || '').toLowerCase().includes(q) ||
                (item.agente || '').toLowerCase().includes(q) ||
                (item.tecnica || '').toLowerCase().includes(q) ||
                (item.especie || '').toLowerCase().includes(q) ||
                (item.estadio || '').toLowerCase().includes(q) ||
                String(item.pool ?? '').toLowerCase().includes(q) ||
                (item.resultado || '').toLowerCase().includes(q)
            );
        });
    }, [porOrgano, agenteActivo, searchQuery]);

    const opcionesEmpresa = useMemo(
        () => [
            { value: 'ALL', label: `Todas las empresas (${formatThousands(empresasDisponibles.length)})` },
            ...empresasDisponibles.map(({ nombre, n }) => ({ value: nombre, label: `${nombre} (${formatThousands(n)})` })),
        ],
        [empresasDisponibles]
    );

    const opcionesCentro = useMemo(
        () => [
            { value: 'ALL', label: `Todos los centros (${formatThousands(centrosDisponibles.length)})` },
            ...centrosDisponibles.map(({ nombre, n }) => ({ value: nombre, label: `${nombre} (${formatThousands(n)})` })),
        ],
        [centrosDisponibles]
    );

    const opcionesOrgano = useMemo(
        () => [
            { value: 'ALL', label: `Todas las matrices / órganos (${formatThousands(organosDisponibles.length)})` },
            ...organosDisponibles.map(({ nombre, n }) => ({ value: nombre, label: `${nombre} (${formatThousands(n)})` })),
        ],
        [organosDisponibles]
    );

    const opcionesAgente = useMemo(
        () => [
            { value: 'ALL', label: `Todos los agentes (${formatThousands(agentesDisponibles.length)})` },
            ...agentesDisponibles.map(({ nombre, n }) => ({ value: nombre, label: `${nombre} (${formatThousands(n)})` })),
        ],
        [agentesDisponibles]
    );

    const filtrosActivos = [
        soloMenorCT,
        categoria !== 'ALL',
        empresaActiva !== 'ALL',
        centroActivo !== 'ALL',
        organoActivo !== 'ALL',
        agenteActivo !== 'ALL',
        searchQuery.trim() !== ''
    ].filter(Boolean).length;

    const elegirCategoria = (c: Categoria) => { setCategoria(c); setPage(1); };

    const limpiarFiltros = () => {
        setSoloMenorCT(false);
        setCategoria('ALL');
        setEmpresa('ALL');
        setCentro('ALL');
        setOrgano('ALL');
        setAgente('ALL');
        setSearchQuery('');
        setPage(1);
    };

    const paginaActual = Math.min(page, Math.max(1, Math.ceil(filtrados.length / pageSize)));
    const visibles = useMemo(
        () => filtrados.slice((paginaActual - 1) * pageSize, paginaActual * pageSize),
        [filtrados, paginaActual, pageSize]
    );

    // Todos los registros pertenecientes al mismo Caso seleccionado para el modal de detalle
    const selectedCasoRows = useMemo(() => {
        if (!selectedRow) return [];
        const targetCaso = String(selectedRow.n_caso ?? '').trim();
        return base.filter((item) => String(item.n_caso ?? '').trim() === targetCaso);
    }, [base, selectedRow]);

    // Exportar a Excel
    const handleExportExcel = async () => {
        const toExport = filtrados.length > 0 ? filtrados : base;
        if (toExport.length === 0) {
            showToast({
                message: 'No hay datos para exportar.',
                type: 'warning'
            });
            return;
        }

        let yearPart = '';
        if (selectedAno !== 'ALL') {
            yearPart = `_${selectedAno}`;
        } else if (fechaDesde && fechaHasta) {
            const yDesde = fechaDesde.slice(0, 4);
            const yHasta = fechaHasta.slice(0, 4);
            yearPart = yDesde === yHasta ? `_${yDesde}` : `_${yDesde}_${yHasta}`;
        } else {
            yearPart = '_2006_2016';
        }

        const suffixCT = soloMenorCT ? '_menor_ct' : '';
        const today = new Date().toISOString().split('T')[0];
        const filename = `historico_laboratorio${yearPart}${suffixCT}_${today}.xlsx`;

        const hasClientOnlyFilter =
            empresaActiva !== 'ALL' ||
            agenteActivo !== 'ALL' ||
            organoActivo !== 'ALL' ||
            searchQuery.trim() !== '';
        const useStreaming = !hasClientOnlyFilter && (isTruncated || toExport.length > 150_000);

        if (useStreaming) {
            try {
                setExportingExcel(true);
                showToast({
                    message: 'Generando archivo Excel (.xlsx) completo desde el servidor vía streaming...',
                    type: 'info'
                });

                await historicoBiologiaMolecularApiClient.downloadExcel({
                    ano: selectedAno !== 'ALL' ? selectedAno : undefined,
                    fecha_desde: fechaDesde || undefined,
                    fecha_hasta: fechaHasta || undefined,
                    centro: centroActivo !== 'ALL' ? centroActivo : undefined,
                    resultado: categoria !== 'ALL' ? categoria : undefined,
                    solo_menor_ct: soloMenorCT
                }, filename);

                showToast({
                    message: 'Archivo Excel descargado con éxito con la totalidad de registros.',
                    type: 'success'
                });
            } catch (error) {
                console.error('Error al exportar Excel vía streaming:', error);
                showToast({
                    message: 'Error al generar Excel: ' + ((error as Error).message || 'Error desconocido'),
                    type: 'error'
                });
            } finally {
                setExportingExcel(false);
            }
            return;
        }

        try {
            setExportingExcel(true);
            exportHistoricoExcel(toExport, filename);
            showToast({
                message: `Archivo Excel generado con éxito (${formatThousands(toExport.length)} registros).`,
                type: 'success'
            });
        } catch (error) {
            console.error('Error al generar Excel en frontend:', error);
            showToast({
                message: 'Error al generar Excel: ' + ((error as Error).message || 'Error desconocido'),
                type: 'error'
            });
        } finally {
            setExportingExcel(false);
        }
    };

    if (!isAuthorized) {
        return (
            <div className="shadcn-scope w-full max-w-4xl mx-auto p-12 text-center space-y-4">
                <div className="inline-flex p-4 rounded-full bg-red-100 dark:bg-red-950/50 text-destructive mb-2">
                    <IconLock size={40} />
                </div>
                <h1 className="text-2xl font-bold text-foreground">Acceso Restringido</h1>
                <p className="text-muted-foreground max-w-md mx-auto">
                    Esta sección histórica solo puede ser consultada por el usuario <strong>FERNANDOB</strong> y personal autorizado del área de <strong>Informática</strong>.
                </p>
                {onBack && (
                    <Button variant="outline" onClick={onBack} className="mt-4">
                        Volver al menú
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="shadcn-scope flex h-full min-h-0 flex-col [&>*]:shrink-0">
            <div className="px-4 pt-4 md:px-6 md:pt-6">
                <PageHeader
                    title="Biología Molecular Histórico"
                    subtitle="Laboratorio ADL Histórico · Consulta y exportación de registros (2006 - 2016)"
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
                                        <SheetDescription>El año o rango de fechas consulta LaboratorioADLHistorico; el resto filtra lo ya cargado.</SheetDescription>
                                    </SheetHeader>

                                    <div className="flex flex-1 flex-col gap-4">
                                        <div>
                                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Año histórico</Label>
                                            <Combobox
                                                options={OPCIONES_ANO}
                                                value={selectedAno}
                                                onValueChange={(v) => {
                                                    const nextAno = v || '2016';
                                                    handleYearSelect(nextAno, false);
                                                }}
                                                placeholder="Seleccionar año"
                                                searchPlaceholder="Buscar año..."
                                            />
                                        </div>
                                        <div>
                                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Fecha desde (muestreo)</Label>
                                            <DatePicker
                                                value={fechaDesde}
                                                onChange={(val) => {
                                                    setFechaDesde(val);
                                                    syncAnoWithDates(val, fechaHasta);
                                                }}
                                                placeholder="Seleccionar fecha"
                                            />
                                        </div>
                                        <div>
                                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Fecha hasta (muestreo)</Label>
                                            <DatePicker
                                                value={fechaHasta}
                                                onChange={(val) => {
                                                    setFechaHasta(val);
                                                    syncAnoWithDates(fechaDesde, val);
                                                }}
                                                placeholder="Seleccionar fecha"
                                            />
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
                                                    placeholder="Caso, empresa, centro, agente, lote..."
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

                                        {empresasDisponibles.length > 0 && (
                                            <div>
                                                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Empresa</Label>
                                                <Combobox
                                                    options={opcionesEmpresa}
                                                    value={empresaActiva}
                                                    onValueChange={(v) => { setEmpresa(v || 'ALL'); setPage(1); }}
                                                    placeholder="Todas las empresas"
                                                    searchPlaceholder="Buscar empresa..."
                                                />
                                            </div>
                                        )}

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

                                        {organosDisponibles.length > 0 && (
                                            <div>
                                                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Matriz / Órgano</Label>
                                                <Combobox
                                                    options={opcionesOrgano}
                                                    value={organoActivo}
                                                    onValueChange={(v) => { setOrgano(v || 'ALL'); setPage(1); }}
                                                    placeholder="Todas las matrices / órganos"
                                                    searchPlaceholder="Buscar matriz u órgano..."
                                                />
                                            </div>
                                        )}

                                        {agentesDisponibles.length > 0 && (
                                            <div>
                                                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Agente / Técnica</Label>
                                                <Combobox
                                                    options={opcionesAgente}
                                                    value={agenteActivo}
                                                    onValueChange={(v) => { setAgente(v || 'ALL'); setPage(1); }}
                                                    placeholder="Todos los agentes"
                                                    searchPlaceholder="Buscar agente..."
                                                />
                                            </div>
                                        )}

                                        {activeFormat !== 'FORMATO_1' && (
                                            <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
                                                <div>
                                                    <Label htmlFor="toggle-hist-menor-ct" className="text-sm font-medium">Solo menor CT</Label>
                                                    <p className="mt-0.5 text-xs text-muted-foreground">Conserva el menor CT (≤ 28) de cada caso, matriz y agente.</p>
                                                </div>
                                                <Switch
                                                    id="toggle-hist-menor-ct"
                                                    checked={soloMenorCT}
                                                    onCheckedChange={(v) => { setSoloMenorCT(v); setPage(1); }}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <SheetFooter>
                                        {filtrosActivos > 0 && (
                                            <Button variant="outline" onClick={limpiarFiltros}>Limpiar filtros</Button>
                                        )}
                                        <Button onClick={() => void handleFetch({ fresco: true })} disabled={loading}>
                                            {loading ? 'Consultando...' : 'Consultar'}
                                        </Button>
                                    </SheetFooter>
                                </SheetContent>
                            </Sheet>

                            <Button variant="outline" onClick={() => void handleFetch()} disabled={loading || exportingExcel} title="Volver a consultar">
                                <IconRefresh size={16} className={loading ? 'animate-spin' : ''} /> Recargar
                            </Button>
                            <Button variant="outline" onClick={() => void handleExportExcel()} disabled={loading || exportingExcel || filtrados.length === 0}>
                                <IconDownload size={16} className={exportingExcel ? 'animate-spin' : ''} /> {exportingExcel ? 'Generando...' : 'Exportar Excel'}
                            </Button>
                        </div>
                    }
                />
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-1 md:px-6 md:pb-6">
                {/* Selector rápido de año histórico (2006–2016) */}
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    {YEAR_GROUPS.map((group) => (
                        <div
                            key={group.label}
                            className="inline-flex items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground"
                        >
                            <span className="hidden select-none px-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 sm:inline">
                                {group.label}
                            </span>
                            {group.years.map((ano) => {
                                const isSelected = selectedAno === ano;
                                return (
                                    <button
                                        key={ano}
                                        type="button"
                                        onClick={() => handleYearSelect(ano, true)}
                                        className={cn(
                                            'inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                                            isSelected ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground'
                                        )}
                                    >
                                        {ano}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={() => handleYearSelect('ALL', true)}
                        className={cn(
                            'inline-flex items-center justify-center whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                            selectedAno === 'ALL'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                        )}
                    >
                        Todos (2006–2016)
                    </button>
                </div>

                {/* Tarjetas KPI planas idénticas a Consulta de Muestras */}
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <Kpi
                        etiqueta="Total registros"
                        valor={isTruncated && !soloMenorCT && totalInDB > stats.total ? totalInDB : stats.total}
                        detalle={
                            soloMenorCT
                                ? 'Muestras con CT ≤ 28'
                                : isTruncated && totalInDB > stats.total
                                    ? 'Mostrando 50.000 en tabla'
                                    : 'Análisis totales'
                        }
                        activo={categoria === 'ALL'}
                        onClick={() => elegirCategoria('ALL')}
                    />
                    <Kpi etiqueta="Casos únicos" valor={stats.casos} detalle="Casos registrados" />
                    <Kpi etiqueta="Centros" valor={stats.centros} detalle="Centros productivos" />
                    <Kpi
                        etiqueta="Positivos"
                        valor={stats.positivos}
                        detalle="Análisis positivos"
                        acento="bg-destructive"
                        activo={categoria === 'POSITIVO'}
                        onClick={() => elegirCategoria('POSITIVO')}
                    />
                    <Kpi
                        etiqueta="Negativos"
                        valor={stats.negativos}
                        detalle="Análisis negativos"
                        acento="bg-success"
                        activo={categoria === 'NEGATIVO'}
                        onClick={() => elegirCategoria('NEGATIVO')}
                    />
                    <Kpi
                        etiqueta="En proceso / otros"
                        valor={stats.otros}
                        detalle="Otros resultados"
                        acento="bg-primary"
                        activo={categoria === 'OTROS'}
                        onClick={() => elegirCategoria('OTROS')}
                    />
                </div>

                {/* Tabla con el mismo contenedor y espaciado que Consulta de Muestras */}
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
                            {activeFormat === 'FORMATO_1' && (
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>N° Caso</TableHead>
                                    <TableHead>Empresa</TableHead>
                                    <TableHead>Programa</TableHead>
                                    <TableHead>Centro</TableHead>
                                    {selectedAno !== '2006' && <TableHead>Lugar Análisis</TableHead>}
                                    <TableHead>Especie</TableHead>
                                    <TableHead>Estadio</TableHead>
                                    <TableHead>Lote</TableHead>
                                    <TableHead>Tipo Agua</TableHead>
                                    <TableHead>Tipo Muestra</TableHead>
                                    <TableHead>Tipo Muestreo</TableHead>
                                    <TableHead className="text-center">N° Muestras</TableHead>
                                    <TableHead>Fecha recep.</TableHead>
                                    <TableHead>Fecha muestreo</TableHead>
                                    <TableHead>Técnica</TableHead>
                                    <TableHead>Agente</TableHead>
                                    <TableHead>Tejido</TableHead>
                                    <TableHead className="text-center">Expr1</TableHead>
                                    <TableHead className="text-center">Positivos</TableHead>
                                    <TableHead className="text-center">Negativos</TableHead>
                                    <TableHead>Intensidad</TableHead>
                                </TableRow>
                            )}
                            {activeFormat === 'FORMATO_2' && (
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Caso ADLab</TableHead>
                                    {selectedAno !== '2009' && (
                                        <>
                                            <TableHead>RUT Empresa</TableHead>
                                            <TableHead>Empresa</TableHead>
                                            <TableHead>RUT Emp. Servicio</TableHead>
                                            <TableHead>Empresa Servicio</TableHead>
                                        </>
                                    )}
                                    <TableHead>Centro</TableHead>
                                    <TableHead>Programa</TableHead>
                                    <TableHead>Matriz</TableHead>
                                    <TableHead className="text-center">Pool</TableHead>
                                    <TableHead>Agente</TableHead>
                                    <TableHead className="text-center">CT</TableHead>
                                    <TableHead>Resultado</TableHead>
                                    <TableHead>Resultado 2</TableHead>
                                    <TableHead className="text-center">CT 2</TableHead>
                                    <TableHead className="text-center">Positivos</TableHead>
                                    <TableHead>Fecha muestreo</TableHead>
                                    <TableHead>Fecha recep.</TableHead>
                                </TableRow>
                            )}
                            {activeFormat === 'FORMATO_3' && (
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Caso ADLab</TableHead>
                                    <TableHead>RUT Empresa</TableHead>
                                    <TableHead>Empresa</TableHead>
                                    <TableHead>RUT Emp. Servicio</TableHead>
                                    <TableHead>Empresa Servicio</TableHead>
                                    <TableHead>Fecha recep.</TableHead>
                                    <TableHead>Lote</TableHead>
                                    <TableHead>Contenedor</TableHead>
                                    <TableHead>Centro</TableHead>
                                    <TableHead>Cód. Centro</TableHead>
                                    <TableHead>Técnica</TableHead>
                                    <TableHead>Órgano</TableHead>
                                    <TableHead className="text-center">Pool</TableHead>
                                    <TableHead>Resultado</TableHead>
                                    <TableHead className="text-center">N° Pooles</TableHead>
                                    <TableHead className="text-center">N° Peces</TableHead>
                                    <TableHead className="text-center">CT</TableHead>
                                    <TableHead className="text-center">Estado</TableHead>
                                </TableRow>
                            )}
                            {activeFormat === 'MIXTO' && (
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>N° Caso</TableHead>
                                    <TableHead>Fecha muestreo</TableHead>
                                    <TableHead>Fecha recep.</TableHead>
                                    <TableHead>RUT Empresa</TableHead>
                                    <TableHead>Empresa</TableHead>
                                    <TableHead>RUT Emp. Servicio</TableHead>
                                    <TableHead>Empresa Servicio</TableHead>
                                    <TableHead>Centro</TableHead>
                                    <TableHead>Cód. Centro</TableHead>
                                    <TableHead>Programa / Lote</TableHead>
                                    <TableHead>Matriz / Órgano</TableHead>
                                    <TableHead>Técnica / Agente</TableHead>
                                    <TableHead className="text-center">Pool</TableHead>
                                    <TableHead className="text-center">CT</TableHead>
                                    <TableHead>Resultado</TableHead>
                                    <TableHead className="text-center">Pos/Neg · Peces</TableHead>
                                </TableRow>
                            )}
                        </TableHeader>
                        <TableBody>
                            {visibles.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={21} className="py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <IconDna size={28} className="opacity-40" />
                                            <span>{loading ? 'Consultando registros en LaboratorioADLHistorico...' : 'No se encontraron registros para el año y filtros seleccionados'}</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                visibles.map((row, idx) => {
                                    const agenteDisplay = row.agente || row.tecnica || '-';
                                    const tienePosNeg = row.positivos !== null && row.positivos !== undefined;

                                    if (activeFormat === 'FORMATO_1') {
                                        const nMuestrasDisplay = row.pool
                                            ? `${row.n_muestras ?? ''} (${row.pool})`.trim()
                                            : (row.n_muestras ?? '-');

                                        return (
                                            <TableRow
                                                key={`${row.id_caso}-${idx}`}
                                                onClick={() => setSelectedRow(row)}
                                                className="cursor-pointer"
                                                title="Clic para ver el detalle completo del caso"
                                            >
                                                <TableCell className="whitespace-nowrap font-medium tabular-nums">
                                                    <HighlightMatch text={row.n_caso} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[170px] truncate" title={row.empresa || ''}>
                                                    <HighlightMatch text={row.empresa} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[150px] truncate text-muted-foreground" title={row.programa || ''}>
                                                    <HighlightMatch text={row.programa} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[160px] truncate font-medium" title={row.centro || ''}>
                                                    <HighlightMatch text={row.centro} query={searchQuery} />
                                                </TableCell>
                                                {selectedAno !== '2006' && (
                                                    <TableCell className="max-w-[120px] truncate text-muted-foreground" title={row.lugar_analisis || ''}>
                                                        <HighlightMatch text={row.lugar_analisis} query={searchQuery} />
                                                    </TableCell>
                                                )}
                                                <TableCell className="max-w-[130px] truncate text-muted-foreground" title={row.especie || ''}>
                                                    <HighlightMatch text={row.especie} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[120px] truncate text-muted-foreground" title={row.estadio || ''}>
                                                    <HighlightMatch text={row.estadio} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[120px] truncate text-muted-foreground" title={row.lote || ''}>
                                                    <HighlightMatch text={row.lote} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[100px] truncate text-muted-foreground" title={row.tipo_agua || ''}>
                                                    <HighlightMatch text={row.tipo_agua} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[110px] truncate text-muted-foreground" title={row.tipo_muestra || ''}>
                                                    <HighlightMatch text={row.tipo_muestra} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[110px] truncate text-muted-foreground" title={row.tipo_muestreo || ''}>
                                                    <HighlightMatch text={row.tipo_muestreo} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-center tabular-nums">{nMuestrasDisplay}</TableCell>
                                                <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateOnly(row.fecha_recepcion)}</TableCell>
                                                <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateOnly(row.fecha_muestreo)}</TableCell>
                                                <TableCell className="max-w-[160px] truncate font-medium text-primary" title={row.tecnica || ''}>
                                                    <HighlightMatch text={row.tecnica} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[160px] truncate" title={row.agente || ''}>
                                                    <HighlightMatch text={row.agente} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[120px] truncate text-muted-foreground" title={row.tejido_matriz || ''}>
                                                    <HighlightMatch text={row.tejido_matriz} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="text-center tabular-nums text-muted-foreground">{row.expr1 ?? '-'}</TableCell>
                                                <TableCell className="text-center tabular-nums font-medium text-destructive">{row.positivos ?? '-'}</TableCell>
                                                <TableCell className="text-center tabular-nums font-medium text-success">{row.negativos ?? '-'}</TableCell>
                                                <TableCell className="max-w-[140px] truncate text-muted-foreground" title={row.intensidad || ''}>
                                                    <HighlightMatch text={row.intensidad} query={searchQuery} />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    }

                                    if (activeFormat === 'FORMATO_2') {
                                        return (
                                            <TableRow
                                                key={`${row.id_caso}-${idx}`}
                                                onClick={() => setSelectedRow(row)}
                                                className="cursor-pointer"
                                                title="Clic para ver el detalle completo del caso"
                                            >
                                                <TableCell className="whitespace-nowrap font-medium tabular-nums">
                                                    <HighlightMatch text={row.n_caso} query={searchQuery} />
                                                </TableCell>
                                                {selectedAno !== '2009' && (
                                                    <>
                                                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                                                            <HighlightMatch text={row.rut_empresa} query={searchQuery} />
                                                        </TableCell>
                                                        <TableCell className="max-w-[170px] truncate" title={row.empresa || ''}>
                                                            <HighlightMatch text={row.empresa} query={searchQuery} />
                                                        </TableCell>
                                                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                                                            <HighlightMatch text={row.rut_empresaservicio} query={searchQuery} />
                                                        </TableCell>
                                                        <TableCell className="max-w-[170px] truncate text-muted-foreground" title={row.nombre_empresaservicio || ''}>
                                                            <HighlightMatch text={row.nombre_empresaservicio} query={searchQuery} />
                                                        </TableCell>
                                                    </>
                                                )}
                                                <TableCell className="max-w-[180px] truncate font-medium" title={row.centro || ''}>
                                                    <HighlightMatch text={row.centro} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[160px] truncate text-muted-foreground" title={row.programa || ''}>
                                                    <HighlightMatch text={row.programa} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[150px] truncate text-muted-foreground" title={row.tejido_matriz || ''}>
                                                    <HighlightMatch text={row.tejido_matriz} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="text-center tabular-nums">
                                                    <HighlightMatch text={row.pool} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[240px] truncate font-medium text-primary" title={agenteDisplay}>
                                                    <HighlightMatch text={agenteDisplay} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="text-center tabular-nums">
                                                    {row.ct !== null && row.ct !== undefined && row.ct !== ''
                                                        ? (soloMenorCT ? <Badge variant="warning">{row.ct}</Badge> : row.ct)
                                                        : <span className="text-muted-foreground">-</span>}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap"><ResultadoBadge resultado={row.resultado} /></TableCell>
                                                <TableCell className="whitespace-nowrap"><ResultadoBadge resultado={row.resultado2} /></TableCell>
                                                <TableCell className="text-center tabular-nums text-muted-foreground">{row.ct2 ?? '-'}</TableCell>
                                                <TableCell className="text-center tabular-nums">{row.positivos ?? '-'}</TableCell>
                                                <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateOnly(row.fecha_muestreo)}</TableCell>
                                                <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateOnly(row.fecha_recepcion)}</TableCell>
                                            </TableRow>
                                        );
                                    }

                                    if (activeFormat === 'FORMATO_3') {
                                        return (
                                            <TableRow
                                                key={`${row.id_caso}-${idx}`}
                                                onClick={() => setSelectedRow(row)}
                                                className="cursor-pointer"
                                                title="Clic para ver el detalle completo del caso"
                                            >
                                                <TableCell className="whitespace-nowrap font-medium tabular-nums">
                                                    <HighlightMatch text={row.n_caso} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                                                    <HighlightMatch text={row.rut_empresa} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[170px] truncate" title={row.empresa || ''}>
                                                    <HighlightMatch text={row.empresa} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                                                    <HighlightMatch text={row.rut_empresaservicio} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[170px] truncate text-muted-foreground" title={row.nombre_empresaservicio || ''}>
                                                    <HighlightMatch text={row.nombre_empresaservicio} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateOnly(row.fecha_recepcion)}</TableCell>
                                                <TableCell className="max-w-[140px] truncate text-muted-foreground" title={row.lote || ''}>
                                                    <HighlightMatch text={row.lote} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[140px] truncate text-muted-foreground" title={row.contenedor || ''}>
                                                    <HighlightMatch text={row.contenedor} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[160px] truncate font-medium" title={row.centro || ''}>
                                                    <HighlightMatch text={row.centro} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                                                    <HighlightMatch text={row.codigo_centro} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate font-medium text-primary" title={agenteDisplay}>
                                                    <HighlightMatch text={agenteDisplay} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="max-w-[140px] truncate text-muted-foreground" title={row.tejido_matriz || ''}>
                                                    <HighlightMatch text={row.tejido_matriz} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="text-center tabular-nums">
                                                    <HighlightMatch text={row.pool} query={searchQuery} />
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap"><ResultadoBadge resultado={row.resultado} /></TableCell>
                                                <TableCell className="text-center tabular-nums text-muted-foreground">{row.pol_npooles ?? '-'}</TableCell>
                                                <TableCell className="text-center tabular-nums text-muted-foreground">{row.pol_npeces ?? '-'}</TableCell>
                                                <TableCell className="text-center tabular-nums">
                                                    {row.ct !== null && row.ct !== undefined && row.ct !== '' ? (
                                                        soloMenorCT ? <Badge variant="warning">{row.ct}</Badge> : row.ct
                                                    ) : row.genovariante ? (
                                                        <Badge variant="secondary" title="Genovariante">{row.genovariante}</Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-center tabular-nums text-muted-foreground">{row.estado_caso || '-'}</TableCell>
                                            </TableRow>
                                        );
                                    }

                                    // MIXTO
                                    const progOrLote = row.programa
                                        ? row.programa
                                        : (row.lote ? `${row.lote}${row.contenedor ? ` (${row.contenedor})` : ''}` : (row.contenedor || '-'));

                                    return (
                                        <TableRow
                                            key={`${row.id_caso}-${idx}`}
                                            onClick={() => setSelectedRow(row)}
                                            className="cursor-pointer"
                                            title="Clic para ver el detalle completo del caso"
                                        >
                                            <TableCell className="whitespace-nowrap font-medium tabular-nums">
                                                <HighlightMatch text={row.n_caso} query={searchQuery} />
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateOnly(row.fecha_muestreo)}</TableCell>
                                            <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateOnly(row.fecha_recepcion)}</TableCell>
                                            <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                                                <HighlightMatch text={row.rut_empresa} query={searchQuery} />
                                            </TableCell>
                                            <TableCell className="max-w-[170px] truncate" title={row.empresa || ''}>
                                                <HighlightMatch text={row.empresa} query={searchQuery} />
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                                                <HighlightMatch text={row.rut_empresaservicio} query={searchQuery} />
                                            </TableCell>
                                            <TableCell className="max-w-[170px] truncate text-muted-foreground" title={row.nombre_empresaservicio || ''}>
                                                <HighlightMatch text={row.nombre_empresaservicio} query={searchQuery} />
                                            </TableCell>
                                            <TableCell className="max-w-[170px] truncate font-medium" title={row.centro || ''}>
                                                <HighlightMatch text={row.centro} query={searchQuery} />
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                                                <HighlightMatch text={row.codigo_centro} query={searchQuery} />
                                            </TableCell>
                                            <TableCell className="max-w-[160px] truncate text-muted-foreground" title={progOrLote}>
                                                <HighlightMatch text={progOrLote} query={searchQuery} />
                                            </TableCell>
                                            <TableCell className="max-w-[130px] truncate text-muted-foreground" title={row.tejido_matriz || ''}>
                                                <HighlightMatch text={row.tejido_matriz} query={searchQuery} />
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate font-medium text-primary" title={agenteDisplay}>
                                                <HighlightMatch text={agenteDisplay} query={searchQuery} />
                                            </TableCell>
                                            <TableCell className="text-center tabular-nums">
                                                <HighlightMatch text={row.pool} query={searchQuery} />
                                            </TableCell>
                                            <TableCell className="text-center tabular-nums">
                                                {row.ct !== null && row.ct !== undefined && row.ct !== '' ? (
                                                    soloMenorCT ? <Badge variant="warning">{row.ct}</Badge> : row.ct
                                                ) : row.genovariante ? (
                                                    <Badge variant="secondary" title="Genovariante">{row.genovariante}</Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap"><ResultadoBadge resultado={row.resultado} /></TableCell>
                                            <TableCell className="whitespace-nowrap text-center tabular-nums">
                                                {tienePosNeg ? (
                                                    <span className="text-muted-foreground">
                                                        <strong className="text-destructive">{row.positivos}</strong> / <strong className="text-success">{row.negativos ?? '-'}</strong>
                                                    </span>
                                                ) : (row.pol_npooles !== null && row.pol_npooles !== undefined) || (row.pol_npeces !== null && row.pol_npeces !== undefined) ? (
                                                    <span className="text-muted-foreground">
                                                        {row.pol_npooles ?? '-'}p × {row.pol_npeces ?? '-'}
                                                    </span>
                                                ) : (
                                                    '-'
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
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

            {/* Modal de Detalle Completo del Caso Histórico */}
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
                                            <span>Detalle del Caso Histórico {selectedRow.n_caso}</span>
                                        </DialogTitle>
                                        <DialogDescription className="text-xs mt-1">
                                            Empresa: <strong className="text-foreground">{selectedRow.empresa || '-'}</strong> · Centro: <strong className="text-foreground">{selectedRow.centro || '-'}</strong>
                                        </DialogDescription>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ResultadoBadge resultado={selectedRow.resultado} />
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-xs">
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 bg-muted/30 p-4 rounded-lg border border-border">
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">N° Caso</span>
                                        <span className="font-mono font-bold text-sm text-foreground mt-0.5 block">
                                            <HighlightMatch text={selectedRow.n_caso} query={searchQuery} />
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
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">RUT Empresa</span>
                                        <span className="font-mono text-foreground mt-0.5 block">
                                            <HighlightMatch text={selectedRow.rut_empresa} query={searchQuery} />
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Empresa</span>
                                        <span className="font-medium text-foreground mt-0.5 block">
                                            <HighlightMatch text={selectedRow.empresa} query={searchQuery} />
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Empresa Servicio</span>
                                        <span className="font-medium text-foreground mt-0.5 block">
                                            <HighlightMatch text={selectedRow.nombre_empresaservicio} query={searchQuery} />
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Centro</span>
                                        <span className="font-medium text-foreground mt-0.5 block">
                                            <HighlightMatch text={selectedRow.centro} query={searchQuery} />
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Cód. Centro</span>
                                        <span className="font-mono text-foreground mt-0.5 block">
                                            <HighlightMatch text={selectedRow.codigo_centro} query={searchQuery} />
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Programa</span>
                                        <span className="font-medium text-foreground mt-0.5 block">
                                            <HighlightMatch text={selectedRow.programa} query={searchQuery} />
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Lote / Contenedor</span>
                                        <span className="font-medium text-foreground mt-0.5 block">
                                            <HighlightMatch
                                                text={[selectedRow.lote, selectedRow.contenedor].filter(Boolean).join(' · ') || null}
                                                query={searchQuery}
                                            />
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Matriz / Órgano</span>
                                        <span className="font-medium text-foreground mt-0.5 block">
                                            <HighlightMatch text={selectedRow.tejido_matriz} query={searchQuery} />
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
                                            <HighlightMatch text={selectedRow.agente || selectedRow.tecnica} query={searchQuery} />
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
                                        <span className="text-[11px] font-semibold text-muted-foreground uppercase block">Positivos / Negativos</span>
                                        <span className="font-mono font-semibold text-foreground mt-0.5 block">
                                            {selectedRow.positivos ?? '-'} / {selectedRow.negativos ?? '-'}
                                        </span>
                                    </div>
                                </div>

                                {selectedCasoRows.length > 1 && (
                                    <div className="rounded-lg border border-border overflow-hidden">
                                        <div className="bg-muted/40 px-3.5 py-2 border-b border-border flex items-center justify-between">
                                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                                                Todos los análisis del caso {selectedRow.n_caso} ({formatThousands(selectedCasoRows.length)})
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
                                                    <TableHead>Matriz / Órgano</TableHead>
                                                    <TableHead>Agente / Técnica</TableHead>
                                                    <TableHead className="text-center">Pool</TableHead>
                                                    <TableHead className="text-center">CT</TableHead>
                                                    <TableHead>Resultado</TableHead>
                                                    <TableHead className="text-center">CT 2</TableHead>
                                                    <TableHead className="text-center">Positivos</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedCasoRows.map((item, idx) => {
                                                    const agItem = item.agente || item.tecnica || '';
                                                    const agSel = selectedRow.agente || selectedRow.tecnica || '';
                                                    const isCurrent =
                                                        agItem === agSel &&
                                                        String(item.pool) === String(selectedRow.pool) &&
                                                        item.tejido_matriz === selectedRow.tejido_matriz;
                                                    return (
                                                        <TableRow
                                                            key={`${item.id_caso}-${idx}`}
                                                            onClick={() => setSelectedRow(item)}
                                                            className={cn(
                                                                'cursor-pointer',
                                                                isCurrent && 'bg-primary/10 font-semibold'
                                                            )}
                                                        >
                                                            <TableCell className="text-muted-foreground">{item.tejido_matriz || '-'}</TableCell>
                                                            <TableCell className="font-medium text-primary">{agItem || '-'}</TableCell>
                                                            <TableCell className="text-center tabular-nums">{item.pool ?? '-'}</TableCell>
                                                            <TableCell className="text-center tabular-nums font-semibold">{item.ct || '-'}</TableCell>
                                                            <TableCell><ResultadoBadge resultado={item.resultado} /></TableCell>
                                                            <TableCell className="text-center tabular-nums text-muted-foreground">{item.ct2 || '-'}</TableCell>
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

export default HistoricoBiologiaMolecularPage;
