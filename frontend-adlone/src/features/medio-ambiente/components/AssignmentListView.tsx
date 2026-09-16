import React, { useState, useEffect, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { useToast } from '../../../contexts/ToastContext';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { DataPagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import {
    IconSearch,
    IconEraser,
    IconCalendarStats,
    IconFilter
} from '@tabler/icons-react';

interface Props {
    onBackToMenu: () => void;
    onViewAssignment: (id: number) => void;
}

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';

export const AssignmentListView: React.FC<Props> = ({ onBackToMenu, onViewAssignment }) => {
    const { showToast } = useToast();
    // State
    const [searchId, setSearchId] = useState('');
    const [searchEstado, setSearchEstado] = useState<string | null>(null);
    const [searchMonitoreo, setSearchMonitoreo] = useState<string | null>(null);
    const [searchEmpresaFacturar, setSearchEmpresaFacturar] = useState<string | null>(null);
    const [searchEmpresaServicio, setSearchEmpresaServicio] = useState<string | null>(null);
    const [searchCentro, setSearchCentro] = useState<string | null>(null);
    const [searchObjetivo, setSearchObjetivo] = useState<string | null>(null);
    const [searchSubArea, setSearchSubArea] = useState<string | null>(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [fichas, setFichas] = useState<any[]>([]);
    const [assignmentCounts, setAssignmentCounts] = useState<Record<number, { assigned: number; total: number }>>({});

    const itemsPerPage = 12;

    useEffect(() => {
        loadFichas();
    }, []);

    useEffect(() => {
        const loadAssignmentCounts = async () => {
            const itemsPerPage = 12;
            const counts: Record<number, { assigned: number; total: number }> = {};

            const fichasToLoad = fichas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

            for (const ficha of fichasToLoad) {
                const fichId = ficha.id_fichaingresoservicio || ficha.fichaingresoservicio;
                if (!fichId || assignmentCounts[fichId]) continue;

                try {
                    const data = await fichaService.getAssignmentDetail(fichId);
                    if (Array.isArray(data)) {
                        const total = data.filter(r => !['CANCELADO', 'ANULADO'].includes((r.nombre_estadomuestreo || '').toUpperCase())).length;
                        const assigned = data.filter(r =>
                            !['CANCELADO', 'ANULADO'].includes((r.nombre_estadomuestreo || '').toUpperCase()) &&
                            r.id_muestreador
                        ).length;
                        counts[fichId] = { assigned, total };
                    }
                } catch (error) {
                    console.error(`Error loading counts for ficha ${fichId}:`, error);
                }
            }
            if (Object.keys(counts).length > 0) {
                setAssignmentCounts(prev => ({ ...prev, ...counts }));
            }
        };

        loadAssignmentCounts();
    }, [fichas, currentPage]);

    const loadFichas = async () => {
        setLoading(true);
        try {
            const response = await fichaService.getForAssignment();
            let data = [];
            if (Array.isArray(response)) data = response;
            else if (response && response.data && Array.isArray(response.data)) data = response.data;
            else if (response && Array.isArray(response.recordset)) data = response.recordset;

            setFichas(data || []);
        } catch (error) {
            console.error("Error loading fichas for assignment:", error);
            showToast({ type: 'error', message: 'Error al cargar fichas para asignación' });
        } finally {
            setLoading(false);
        }
    };

    const getUniqueValues = (key: string) => {
        const values = new Set<string>();
        fichas.forEach(f => {
            if (f[key]) values.add(String(f[key]).trim());
        });
        return Array.from(values).sort().map(v => ({ value: v, label: v }));
    };

    const uniqueEstados = useMemo(() => {
        const v1 = getUniqueValues('estado_ficha');
        return v1.length > 0 ? v1 : getUniqueValues('nombre_estadomuestreo');
    }, [fichas]);

    const uniqueMonitoreo = useMemo(() => {
        const v1 = getUniqueValues('nombre_frecuencia');
        return v1.length > 0 ? v1 : getUniqueValues('frecuencia');
    }, [fichas]);

    const uniqueEmpFacturar = useMemo(() => getUniqueValues('empresa_facturar'), [fichas]);

    const uniqueEmpServicio = useMemo(() => {
        const set = new Set<string>();
        fichas.forEach(f => {
            const val = f.empresa_servicio || f.nombre_empresaservicios;
            if (val) set.add(String(val).trim());
        });
        return Array.from(set).sort().map(v => ({ value: v, label: v }));
    }, [fichas]);

    const uniqueCentros = useMemo(() => {
        const set = new Set<string>();
        fichas.forEach(f => {
            const val = f.centro || f.nombre_centro;
            if (val) set.add(String(val).trim());
        });
        return Array.from(set).sort().map(v => ({ value: v, label: v }));
    }, [fichas]);

    const uniqueObjetivos = useMemo(() => getUniqueValues('nombre_objetivomuestreo_ma'), [fichas]);

    const uniqueSubAreas = useMemo(() => {
        const set = new Set<string>();
        fichas.forEach(f => {
            const val = f.subarea || f.nombre_subarea;
            if (val) set.add(String(val).trim());
        });
        return Array.from(set).sort().map(v => ({ value: v, label: v }));
    }, [fichas]);

    const handleClearFilters = () => {
        setSearchId('');
        setSearchEstado(null);
        setSearchMonitoreo(null);
        setSearchEmpresaFacturar(null);
        setSearchEmpresaServicio(null);
        setSearchCentro(null);
        setSearchObjetivo(null);
        setSearchSubArea(null);
        setDateFrom('');
        setDateTo('');
        setCurrentPage(1);
    };

    const filteredFichas = useMemo(() => {
        return fichas.filter(f => {
            const displayId = f.fichaingresoservicio || f.id_fichaingresoservicio || '';
            const matchId = searchId ? String(displayId).includes(searchId) : true;

            const check = (val: string, search: string | null) => {
                if (!search) return true;
                return (val || '').toString().toLowerCase().includes(search.toLowerCase());
            };

            const matchEstado = check(f.estado_ficha || f.nombre_estadomuestreo, searchEstado);
            const matchMonitoreo = check(f.nombre_frecuencia || f.frecuencia, searchMonitoreo);
            const matchEmpFacturar = check(f.empresa_facturar, searchEmpresaFacturar);
            const matchEmpServicio = check(f.empresa_servicio || f.nombre_empresaservicios, searchEmpresaServicio);
            const matchCentro = check(f.centro || f.nombre_centro, searchCentro);
            const matchObjetivo = check(f.nombre_objetivomuestreo_ma, searchObjetivo);
            const matchSubArea = check(f.subarea || f.nombre_subarea, searchSubArea);

            let matchDate = true;
            if (dateFrom || dateTo) {
                const fDate = f.fecha || f.fecha_muestreo;
                if (!fDate) matchDate = false;
                else {
                    let rowDate: Date;
                    if (typeof fDate === 'string' && fDate.includes('/')) {
                        const parts = fDate.split('/');
                        rowDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    } else {
                        rowDate = new Date(fDate);
                    }
                    rowDate.setHours(0, 0, 0, 0);

                    if (dateFrom && rowDate < new Date(dateFrom)) matchDate = false;
                    if (dateTo && rowDate > new Date(dateTo)) matchDate = false;
                }
            }

            return matchId && matchEstado && matchMonitoreo && matchEmpFacturar && matchEmpServicio && matchCentro && matchObjetivo && matchSubArea && matchDate;
        });
    }, [fichas, searchId, searchEstado, searchMonitoreo, searchEmpresaFacturar, searchEmpresaServicio, searchCentro, searchObjetivo, searchSubArea, dateFrom, dateTo]);

    const sortedFichas = useMemo(() => {
        const getStatusPriority = (status: string) => {
            const s = (status || '').toUpperCase();
            if (s.includes('POR ASIGNAR')) return 1;
            if (s.includes('PENDIENTE')) return 2;
            if (s.includes('EJECUTADO') || s.includes('VIGENTE') || s.includes('EMITIDA')) return 3;
            return 4;
        };

        return [...filteredFichas].sort((a, b) => {
            const statusA = a.estado_ficha || a.nombre_estadomuestreo || '';
            const statusB = b.estado_ficha || b.nombre_estadomuestreo || '';
            const p = getStatusPriority(statusA) - getStatusPriority(statusB);
            if (p !== 0) return p;

            const fichIdA = a.id_fichaingresoservicio || a.fichaingresoservicio;
            const fichIdB = b.id_fichaingresoservicio || b.fichaingresoservicio;
            const countsA = assignmentCounts[fichIdA];
            const countsB = assignmentCounts[fichIdB];

            const pendingA = countsA ? countsA.total - countsA.assigned : 0;
            const pendingB = countsB ? countsB.total - countsB.assigned : 0;

            if (pendingA !== pendingB) return pendingB - pendingA;
            return (b.id_fichaingresoservicio || 0) - (a.id_fichaingresoservicio || 0);
        });
    }, [filteredFichas, assignmentCounts]);

    const paginatedFichas = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedFichas.slice(start, start + itemsPerPage);
    }, [sortedFichas, currentPage]);

    const getStatusVariant = (status: string): BadgeVariant => {
        const s = (status || '').toUpperCase();
        if (s.includes('COORDINACIÓN')) return 'destructive';
        if (s.includes('PROGRAMACIÓN')) return 'secondary';
        if (s.includes('EN PROCESO') || s.includes('VIGENTE') || s.includes('APROBADA') || s.includes('EJECUTADO')) return 'success';
        if (s.includes('PENDIENTE') || s.includes('ÁREA TÉCNICA')) return 'warning';
        if (s.includes('RECHAZADA') || s.includes('CANCELADO') || s.includes('ANULADA')) return 'destructive';
        return 'outline';
    };

    return (
        <div className="shadcn-scope">
            <PageHeader
                title="Planificación y Asignación"
                subtitle="Gestión de recursos y programación de muestreos"
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'Asignación' }
                ]}
                rightSection={
                    <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-xs text-muted-foreground">{filteredFichas.length} registros encontrados</span>
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
                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                    <Field label="N° Ficha">
                        <div className="relative">
                            <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input className="pl-8" placeholder="Ej: 1234" value={searchId} onChange={(e) => setSearchId(e.target.value)} />
                        </div>
                    </Field>
                    <Field label="Estado">
                        <Combobox placeholder="Todos" searchPlaceholder="Buscar estado..." options={uniqueEstados} value={searchEstado ?? ''} onValueChange={(v) => setSearchEstado(v || null)} />
                    </Field>
                    <Field label="Monitoreo">
                        <Combobox placeholder="Todos" searchPlaceholder="Buscar monitoreo..." options={uniqueMonitoreo} value={searchMonitoreo ?? ''} onValueChange={(v) => setSearchMonitoreo(v || null)} />
                    </Field>
                    <Field label="E. Facturar">
                        <Combobox placeholder="Todos" searchPlaceholder="Buscar empresa..." options={uniqueEmpFacturar} value={searchEmpresaFacturar ?? ''} onValueChange={(v) => setSearchEmpresaFacturar(v || null)} />
                    </Field>
                    <Field label="E. Servicio">
                        <Combobox placeholder="Todos" searchPlaceholder="Buscar empresa..." options={uniqueEmpServicio} value={searchEmpresaServicio ?? ''} onValueChange={(v) => setSearchEmpresaServicio(v || null)} />
                    </Field>
                    <Field label="Fuente Emisora">
                        <Combobox placeholder="Todos" searchPlaceholder="Buscar centro..." options={uniqueCentros} value={searchCentro ?? ''} onValueChange={(v) => setSearchCentro(v || null)} />
                    </Field>
                    <Field label="Obj. Muestreo">
                        <Combobox placeholder="Todos" searchPlaceholder="Buscar objetivo..." options={uniqueObjetivos} value={searchObjetivo ?? ''} onValueChange={(v) => setSearchObjetivo(v || null)} />
                    </Field>
                    <Field label="Sub Área">
                        <Combobox placeholder="Todos" searchPlaceholder="Buscar sub área..." options={uniqueSubAreas} value={searchSubArea ?? ''} onValueChange={(v) => setSearchSubArea(v || null)} />
                    </Field>
                    <Field label="Desde">
                        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </Field>
                    <Field label="Hasta">
                        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </Field>
                </div>
            </Card>

            <Card className="p-0">
                <div className="relative overflow-hidden rounded-xl">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    )}
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-20">N° Ficha</TableHead>
                                <TableHead className="text-center">Estado</TableHead>
                                <TableHead>Cliente / E. Servicio</TableHead>
                                <TableHead>F. Emisora</TableHead>
                                <TableHead className="text-center">Asignación</TableHead>
                                <TableHead className="text-center">Asignar</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedFichas.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                                        {loading ? 'Cargando...' : 'No se encontraron fichas.'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedFichas.map((row) => {
                                    const idFicha = row.id_fichaingresoservicio || row.fichaingresoservicio;
                                    const status = row.estado_ficha || row.nombre_estadomuestreo;
                                    const counts = assignmentCounts[idFicha];
                                    const pending = counts ? counts.total - counts.assigned : 0;
                                    const statusUpper = (status || '').toUpperCase();
                                    const isPendingCoordinacion = statusUpper.includes('COORDINAC');

                                    return (
                                        <TableRow key={String(idFicha)}>
                                            <TableCell className="font-semibold text-primary">{row.fichaingresoservicio || row.id_fichaingresoservicio}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={getStatusVariant(status)}>{status || '-'}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <span className="block truncate text-xs font-semibold" title={row.empresa_facturar}>
                                                    {row.empresa_facturar || '-'}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground" title={row.empresa_servicio || row.nombre_empresaservicios}>
                                                    {row.empresa_servicio || row.nombre_empresaservicios || '-'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="block truncate text-xs" title={row.centro || row.nombre_centro}>
                                                    {row.centro || row.nombre_centro || '-'}
                                                </span>
                                                <span className="text-xs text-muted-foreground">{row.nombre_frecuencia || row.frecuencia || '-'}</span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {!counts ? (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                ) : (
                                                    <div>
                                                        <span className={cn('block text-xs font-semibold', counts.assigned > 0 ? 'text-success' : 'text-muted-foreground')}>
                                                            {counts.assigned} asignados
                                                        </span>
                                                        {pending > 0 && <span className="block text-xs text-warning">{pending} pendientes</span>}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <ProtectedContent permission="FI_GEST_ASIG">
                                                    {isPendingCoordinacion ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            disabled
                                                            title="Pendiente de aprobación por Área de Coordinación. No es posible gestionar la asignación hasta que sea aprobado."
                                                        >
                                                            <IconCalendarStats size={18} />
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="icon"
                                                            className="rounded-full bg-[#9c36b5] text-white hover:bg-[#9c36b5]/90"
                                                            title="Gestionar Asignación"
                                                            onClick={() => onViewAssignment(row.id_fichaingresoservicio || row.fichaingresoservicio)}
                                                        >
                                                            <IconCalendarStats size={18} />
                                                        </Button>
                                                    )}
                                                </ProtectedContent>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="px-4 py-3">
                    <DataPagination page={currentPage} pageSize={itemsPerPage} total={sortedFichas.length} onPageChange={setCurrentPage} />
                </div>
            </Card>
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
