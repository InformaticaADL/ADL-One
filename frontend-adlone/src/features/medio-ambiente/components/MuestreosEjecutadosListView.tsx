import React, { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import { fichaService } from '../services/ficha.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useNavStore } from '../../../store/navStore';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
    IconSearch,
    IconEraser,
    IconFilter,
    IconExternalLink,
} from '@tabler/icons-react';

// El backend (mssql) devuelve los datetime guardados con GETDATE() (hora local del servidor)
// como si fueran UTC. Usamos los componentes UTC para evitar que el navegador
// reste el offset horario nuevamente.
const formatFechaHoraServidor = (value: string | Date) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getUTCDate())}-${pad(d.getUTCMonth() + 1)}-${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

// value/onChange en formato 'yyyy-MM-dd' para calzar con el contrato de DatePicker,
// pero el resto del componente sigue trabajando con Date | null.
const toDateInputValue = (d: Date | null) => (d ? dayjs(d).format('YYYY-MM-DD') : '');
const fromDateInputValue = (v: string) => (v ? dayjs(v).toDate() : null);

interface Props {
    onBackToMenu: () => void;
}

interface GroupedMuestreo {
    fecha: string;
    etiqueta: string;
    items: any[];
}

export const MuestreosEjecutadosListView: React.FC<Props> = ({ onBackToMenu }) => {
    const { setSelectedFicha, setActiveSubmodule, activeModule } = useNavStore();
    const { showToast } = useToast();
    const [muestreos, setMuestreos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [realizadoStates, setRealizadoStates] = useState<Record<string, { realizado: boolean, userName: string, fecha: string }>>({});

    // Local cache: idAgendamam → caso_adlab asignado en esta sesión
    const [casoAdlabMap, setCasoAdlabMap] = useState<Record<string, string>>({});

    // Filters
    const [searchCorrelativo, setSearchCorrelativo] = useState('');
    const [searchCliente, setSearchCliente] = useState<string | null>(null);
    const [searchMuestreador, setSearchMuestreador] = useState<string | null>(null);
    const [searchObjetivo, setSearchObjetivo] = useState<string | null>(null);
    const [fechaDesde, setFechaDesde] = useState<Date | null>(null);
    const [fechaHasta, setFechaHasta] = useState<Date | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 12;

    useEffect(() => {
        loadMuestreos();
    }, []);

    const loadMuestreos = async () => {
        setLoading(true);
        try {
            const response = await fichaService.getMuestreosEjecutados();
            let data = [];
            if (Array.isArray(response)) data = response;
            else if (response && response.data && Array.isArray(response.data)) data = response.data;
            else if (response && Array.isArray(response.recordset)) data = response.recordset;

            setMuestreos(data || []);

            // Initialize realizadoStates from DB data
            const initialStates: Record<string, { realizado: boolean, userName: string, fecha: string }> = {};
            const initialCasos: Record<string, string> = {};
            (data || []).forEach((m: any) => {
                const key = m.id_agendamam?.toString();
                if (key && m.realizado_por_gem) {
                    initialStates[key] = {
                        realizado: true,
                        userName: m.realizado_por_gem,
                        fecha: m.fecha_realizado_gem ? formatFechaHoraServidor(m.fecha_realizado_gem) : ''
                    };
                }
                if (key && m.caso_adlab) {
                    initialCasos[key] = m.caso_adlab;
                }
            });
            setRealizadoStates(initialStates);
            setCasoAdlabMap(initialCasos);
        } catch (error) {
            console.error("Error loading muestreos ejecutados:", error);
            showToast({ type: 'error', message: "Error al cargar los muestreos ejecutados" });
        } finally {
            setLoading(false);
        }
    };

    const getUniqueValues = (key: string) => {
        const values = new Set<string>();
        muestreos.forEach(m => {
            if (m[key]) values.add(String(m[key]).trim());
        });
        return Array.from(values).sort().map(v => ({ value: v, label: v }));
    };

    const uniqueClientes = useMemo(() => getUniqueValues('cliente'), [muestreos]);
    const uniqueMuestreadores = useMemo(() => getUniqueValues('muestreador'), [muestreos]);
    const uniqueObjetivos = useMemo(() => getUniqueValues('objetivo'), [muestreos]);

    const handleClearFilters = () => {
        setSearchCorrelativo('');
        setSearchCliente(null);
        setSearchMuestreador(null);
        setSearchObjetivo(null);
        setFechaDesde(null);
        setFechaHasta(null);
        setCurrentPage(1);
    };

    const getDayLabel = (date: Date) => {
        const label = date.toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        // Capitalizar primera letra para que se vea mejor
        return label.charAt(0).toUpperCase() + label.slice(1);
    };

    const filteredMuestreos = useMemo(() => {
        return muestreos.filter(m => {
            const check = (val: string, search: string | null) => {
                if (!search) return true;
                return (val || '').toString().toLowerCase().includes(search.toLowerCase());
            };
            const matchCorr = check(m.frecuencia_correlativo, searchCorrelativo) || check(m.caso_adlab, searchCorrelativo);
            const matchCliente = check(m.cliente, searchCliente);
            const matchMues = check(m.muestreador, searchMuestreador);
            const matchObj = check(m.objetivo, searchObjetivo);

            // Filtro de fecha
            let matchFecha = false;
            if (m.fecha_retiro) {
                matchFecha = true;
                const fecha = new Date(m.fecha_retiro);
                if (fechaDesde) {
                    const desde = new Date(fechaDesde);
                    desde.setHours(0, 0, 0, 0);
                    matchFecha = matchFecha && fecha >= desde;
                }
                if (fechaHasta) {
                    const hasta = new Date(fechaHasta);
                    hasta.setHours(23, 59, 59, 999);
                    matchFecha = matchFecha && fecha <= hasta;
                }
            }

            return matchCorr && matchCliente && matchMues && matchObj && matchFecha;
        });
    }, [muestreos, searchCorrelativo, searchCliente, searchMuestreador, searchObjetivo, fechaDesde, fechaHasta]);

    const sortedMuestreos = useMemo(() => {
        return [...filteredMuestreos].sort((a, b) => {
            const dateA = a.fecha_retiro ? new Date(a.fecha_retiro).getTime() : 0;
            const dateB = b.fecha_retiro ? new Date(b.fecha_retiro).getTime() : 0;
            return dateB - dateA; // Más recientes primero
        });
    }, [filteredMuestreos]);

    const groupedMuestreos = useMemo(() => {
        const groups: Record<string, GroupedMuestreo> = {};

        sortedMuestreos.forEach(m => {
            if (!m.fecha_retiro) return;
            const fecha = new Date(m.fecha_retiro);
            fecha.setHours(0, 0, 0, 0);
            const fechaStr = fecha.toISOString().split('T')[0];

            if (!groups[fechaStr]) {
                groups[fechaStr] = {
                    fecha: fechaStr,
                    etiqueta: getDayLabel(fecha),
                    items: []
                };
            }
            groups[fechaStr].items.push(m);
        });

        return Object.values(groups).sort((a, b) => {
            return new Date(b.fecha).getTime() - new Date(a.fecha).getTime(); // Más recientes primero
        });
    }, [sortedMuestreos]);

    const totalItems = sortedMuestreos.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    // Paginate grouped data
    let itemCount = 0;
    const pageStart = (currentPage - 1) * itemsPerPage;
    const pageEnd = currentPage * itemsPerPage;
    const displayedGroups: GroupedMuestreo[] = [];

    for (const group of groupedMuestreos) {
        const groupStart = itemCount;
        const groupEnd = itemCount + group.items.length;

        if (groupEnd > pageStart && groupStart < pageEnd) {
            displayedGroups.push({
                ...group,
                items: group.items.slice(
                    Math.max(0, pageStart - groupStart),
                    Math.max(0, pageEnd - groupStart)
                )
            });
        }
        itemCount += group.items.length;
        if (itemCount >= pageEnd) break;
    }

    const showCaso = activeModule !== 'gem' && activeModule !== 'unidades-gem';

    return (
        <div className="shadcn-scope">
            <PageHeader
                title="Muestreos Completados"
                subtitle="Histórico de servicios ejecutados y reportes generados"
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'Muestreos Completados' }
                ]}
                rightSection={
                    <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xs text-muted-foreground">{filteredMuestreos.length} servicios registrados</span>
                        <Button variant="outline" onClick={handleClearFilters}>
                            <IconEraser size={14} /> Limpiar Filtros
                        </Button>
                    </div>
                }
            />

            <Card className="mb-4 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
                    <IconFilter size={18} /> Filtros de búsqueda
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
                    <Field label="Correlativo / ID Caso">
                        <div className="relative">
                            <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input className="pl-8" placeholder="Ej: 99-1 o ID Caso..." value={searchCorrelativo} onChange={(e) => setSearchCorrelativo(e.target.value)} />
                        </div>
                    </Field>
                    <Field label="Cliente">
                        <Combobox placeholder="Todos" searchPlaceholder="Buscar cliente..." options={uniqueClientes} value={searchCliente ?? ''} onValueChange={(v) => setSearchCliente(v || null)} />
                    </Field>
                    <Field label="Muestreador">
                        <Combobox placeholder="Todos" searchPlaceholder="Buscar muestreador..." options={uniqueMuestreadores} value={searchMuestreador ?? ''} onValueChange={(v) => setSearchMuestreador(v || null)} />
                    </Field>
                    <Field label="Objetivo">
                        <Combobox placeholder="Todos" searchPlaceholder="Buscar objetivo..." options={uniqueObjetivos} value={searchObjetivo ?? ''} onValueChange={(v) => setSearchObjetivo(v || null)} />
                    </Field>
                    <Field label="Desde">
                        <DatePicker value={toDateInputValue(fechaDesde)} onChange={(v) => setFechaDesde(fromDateInputValue(v))} />
                    </Field>
                    <Field label="Hasta">
                        <DatePicker value={toDateInputValue(fechaHasta)} onChange={(v) => setFechaHasta(fromDateInputValue(v))} />
                    </Field>
                </div>
            </Card>

            <div className="flex flex-col gap-4">
                {loading ? (
                    <Card>
                        <div className="flex flex-col items-center gap-2 p-8">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            <span className="text-[13px] text-muted-foreground">Cargando registros históricos...</span>
                        </div>
                    </Card>
                ) : displayedGroups.length === 0 ? (
                    <Card>
                        <p className="p-8 text-center text-muted-foreground">No se encontraron muestreos ejecutados.</p>
                    </Card>
                ) : (
                    displayedGroups.map((group) => (
                        <Card key={group.fecha} className="overflow-hidden p-0">
                            <div className="flex items-center justify-between bg-accent px-4 py-3">
                                <span className="text-sm font-semibold">{group.etiqueta}</span>
                                <Badge>{group.items.length} servicios</Badge>
                            </div>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            {showCaso && <TableHead className="w-[90px]">Caso ADLab</TableHead>}
                                            <TableHead className="w-[130px]">Correlativo</TableHead>
                                            <TableHead className="w-[110px]">Fecha</TableHead>
                                            <TableHead className="w-[180px]">Cliente</TableHead>
                                            <TableHead className="w-[180px]">F. Emisora</TableHead>
                                            <TableHead className="w-[160px]">Área / Obj.</TableHead>
                                            <TableHead className="w-[120px]">M. Inst.</TableHead>
                                            <TableHead className="w-[120px]">M. Ret.</TableHead>
                                            <TableHead className="w-[180px]">Realizado por GEM</TableHead>
                                            <TableHead className="w-20 text-center">Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {group.items.map((m, idx) => {
                                            const key = m.id_agendamam?.toString();
                                            const isRealizado = !!realizadoStates[key]?.realizado;
                                            return (
                                                <TableRow
                                                    key={`${m.id_agendamam || m.correlativo_ficha || m.id_fichaingresoservicio}-${idx}`}
                                                    className={isRealizado ? 'bg-success/5 hover:bg-success/10' : undefined}
                                                >
                                                    {showCaso && (
                                                        <TableCell>
                                                            {casoAdlabMap[key] ? <Badge>{casoAdlabMap[key]}</Badge> : <span className="text-xs text-muted-foreground">Sin asignar</span>}
                                                        </TableCell>
                                                    )}
                                                    <TableCell>
                                                        <div className="flex items-center gap-1 whitespace-nowrap">
                                                            <span className="text-xs font-semibold" title={m.frecuencia_correlativo}>{m.frecuencia_correlativo || '-'}</span>
                                                            {m.fecha_completado && dayjs().diff(dayjs(m.fecha_completado), 'hour') < 24 && <Badge variant="success">Nuevo</Badge>}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="whitespace-nowrap text-xs">{m.fecha_retiro ? new Date(m.fecha_retiro).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : '-'}</TableCell>
                                                    <TableCell className="max-w-[180px] truncate text-xs" title={m.cliente}>{m.cliente || '-'}</TableCell>
                                                    <TableCell className="max-w-[180px] truncate text-xs" title={m.centro}>{m.centro || '-'}</TableCell>
                                                    <TableCell>
                                                        <span className="block text-xs font-medium">{m.nombre_subarea || '-'}</span>
                                                        <span className="block text-[10px] text-muted-foreground">{m.objetivo || '-'}</span>
                                                    </TableCell>
                                                    <TableCell className="text-xs">{m.muestreador || 'Sin Asignar'}</TableCell>
                                                    <TableCell className="text-xs">{m.muestreador_retiro || '-'}</TableCell>
                                                    <TableCell>
                                                        {isRealizado ? (
                                                            <div>
                                                                <span className="block text-[10px] font-bold text-success">✓ Realizado</span>
                                                                <span className="block text-[10px] leading-tight text-muted-foreground">
                                                                    <strong>Por:</strong> {realizadoStates[key]?.userName}<br />
                                                                    <strong>Fecha:</strong> {realizadoStates[key]?.fecha}
                                                                </span>
                                                            </div>
                                                        ) : <span className="text-[10px] text-muted-foreground">Pendiente</span>}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <ProtectedContent permission={['MA_COMERCIAL_HISTORIAL_DETALLE', 'FI_VER', 'FI_APROBAR_TEC', 'FI_APROBAR_COO']}>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="rounded-full text-primary hover:bg-primary/10 hover:text-primary"
                                                                title="Ver Detalle Ejecución"
                                                                onClick={() => {
                                                                    setSelectedFicha(m.id_fichaingresoservicio || m.correlativo_ficha, m.frecuencia_correlativo);
                                                                    setActiveSubmodule('ma-ficha-detalle');
                                                                }}
                                                            >
                                                                <IconExternalLink size={16} />
                                                            </Button>
                                                        </ProtectedContent>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>
                    ))
                )}

                <div className="flex items-center justify-between px-1">
                    <span className="text-[13px] text-muted-foreground">
                        Mostrando {sortedMuestreos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).length} de {filteredMuestreos.length} registros
                    </span>
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>Anterior</Button>
                        <span className="px-2 text-[13px]">{currentPage} / {totalPages}</span>
                        <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>Siguiente</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
            {children}
        </div>
    );
}
