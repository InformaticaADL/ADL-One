import React, { useState, useEffect, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useToast } from '../../../contexts/ToastContext';
import { useTableSort } from '../../../hooks/useTableSort';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Table, TableHeader, TableBody, TableRow, TableHead, SortableTableHead, TableCell } from '@/components/ui/table';
import { DataPagination } from '@/components/ui/pagination';
import {
    IconSearch,
    IconEraser,
    IconFileDownload,
    IconEye,
    IconFilter
} from '@tabler/icons-react';

interface Props {
    onBackToMenu: () => void;
    onViewDetail: (id: number) => void;
}

type SortKey = 'id' | 'estado' | 'fecha' | 'tipo' | 'empresaFacturar' | 'centro';

export const CoordinationListView: React.FC<Props> = ({ onBackToMenu, onViewDetail }) => {
    const { showToast } = useToast();
    // State
    const [searchId, setSearchId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [fichas, setFichas] = useState<any[]>([]);

    const itemsPerPage = 15;

    useEffect(() => {
        loadFichas();
    }, []);

    const loadFichas = async () => {
        setLoading(true);
        try {
            const response = await fichaService.getAll();
            let data = [];
            if (Array.isArray(response)) data = response;
            else if (response && response.data && Array.isArray(response.data)) data = response.data;
            else if (response && Array.isArray(response.recordset)) data = response.recordset;

            setFichas(data || []);
        } catch (error) {
            console.error("Error loading coordination fichas:", error);
            showToast({ type: 'error', message: 'Error al cargar fichas de coordinación' });
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = () => {
        setSearchId('');
        setDateFrom('');
        setDateTo('');
        setPage(1);
    };

    const handleDownloadPdf = async (id: number) => {
        try {
            const blob = await fichaService.downloadPdf(id);
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Ficha_${id}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error downloading PDF:", error);
            showToast({ type: 'error', message: 'Error al descargar el PDF de la ficha' });
        }
    };

    const filteredFichas = useMemo(() => {
        return fichas.filter(f => {
            const displayId = f.fichaingresoservicio || f.id_fichaingresoservicio || '';
            const matchId = searchId ? String(displayId).includes(searchId) : true;

            let matchDate = true;
            if (dateFrom || dateTo) {
                if (!f.fecha) return false;
                let rowDate: Date;
                if (typeof f.fecha === 'string' && f.fecha.includes('/')) {
                    const parts = f.fecha.split('/');
                    rowDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                } else {
                    rowDate = new Date(f.fecha);
                }
                rowDate.setHours(0, 0, 0, 0);

                if (dateFrom && rowDate < new Date(dateFrom)) matchDate = false;
                if (dateTo && rowDate > new Date(dateTo)) matchDate = false;
            }

            return matchId && matchDate;
        });
    }, [fichas, searchId, dateFrom, dateTo]);

    const getStatusProps = (status: string): { variant: NonNullable<BadgeProps['variant']>; label: string } => {
        const s = (status || '').toUpperCase();
        if (s.includes('EMITIDA') || s.includes('VIGENTE') || s.includes('APROBADA')) return { variant: 'success', label: status };
        if (s.includes('RECHAZADA') || s.includes('ANULADA')) return { variant: 'destructive', label: status };
        if (s.includes('PENDIENTE')) return { variant: 'warning', label: status };
        return { variant: 'outline', label: status || '-' };
    };

    const sortAccessors: Record<SortKey, (f: any) => string | number | null | undefined> = {
        id: (f) => f.fichaingresoservicio || f.id_fichaingresoservicio,
        estado: (f) => f.estado_ficha,
        fecha: (f) => f.fecha,
        tipo: (f) => f.tipo_fichaingresoservicio,
        empresaFacturar: (f) => f.empresa_facturar,
        centro: (f) => f.centro,
    };
    const { sorted: sortedFichas, sort, toggleSort } = useTableSort(
        filteredFichas,
        sortAccessors,
        { key: 'id' as SortKey, direction: 'desc' }
    );
    const sortProps = (key: SortKey) => ({ active: sort.key === key, direction: sort.direction, onSort: () => { toggleSort(key); setPage(1); } });

    const paginatedFichas = useMemo(() => {
        const start = (page - 1) * itemsPerPage;
        return sortedFichas.slice(start, start + itemsPerPage);
    }, [sortedFichas, page]);

    return (
        <div className="shadcn-scope">
            <PageHeader
                title="Bandeja de Coordinación"
                subtitle="Consulta y seguimiento general de fichas de servicio"
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'Coordinación' }
                ]}
                rightSection={
                    <div className="flex items-center gap-2.5">
                        <span className="text-xs text-muted-foreground">{filteredFichas.length} fichas encontradas</span>
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
                    <Field label="N° Ficha">
                        <div className="relative">
                            <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input className="pl-8" placeholder="Ej: 105" value={searchId} onChange={(e) => setSearchId(e.target.value)} />
                        </div>
                    </Field>
                    <Field label="Fecha Desde">
                        <DatePicker value={dateFrom} onChange={setDateFrom} />
                    </Field>
                    <Field label="Fecha Hasta">
                        <DatePicker value={dateTo} onChange={setDateTo} />
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
                                <SortableTableHead {...sortProps('id')} className="w-[90px]">N° Ficha</SortableTableHead>
                                <SortableTableHead {...sortProps('estado')} className="w-[140px]">Estado</SortableTableHead>
                                <SortableTableHead {...sortProps('fecha')} className="w-[100px]">Fecha</SortableTableHead>
                                <SortableTableHead {...sortProps('tipo')} className="w-[110px]">Tipo</SortableTableHead>
                                <SortableTableHead {...sortProps('empresaFacturar')} className="w-[220px]">Empresa</SortableTableHead>
                                <TableHead className="w-[260px]">Servicio</TableHead>
                                <TableHead className="w-[90px] text-center" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedFichas.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                                        {loading ? 'Cargando...' : 'No se encontraron fichas en la bandeja.'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedFichas.map((f) => {
                                    const id = f.id_fichaingresoservicio || f.fichaingresoservicio;
                                    const status = getStatusProps(f.estado_ficha);
                                    return (
                                        <TableRow key={String(id)}>
                                            <TableCell className="font-semibold text-primary">{f.fichaingresoservicio || '-'}</TableCell>
                                            <TableCell><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                                            <TableCell className="whitespace-nowrap text-xs">{f.fecha || '-'}</TableCell>
                                            <TableCell className="text-xs">{f.tipo_fichaingresoservicio || '-'}</TableCell>
                                            <TableCell>
                                                <span className="block max-w-[200px] truncate text-[12.5px] font-semibold" title={f.empresa_facturar}>
                                                    {f.empresa_facturar || '-'}
                                                </span>
                                                <span className="block max-w-[200px] truncate text-xs text-muted-foreground" title={f.empresa_servicio}>
                                                    {f.empresa_servicio || '-'}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className="block max-w-[240px] truncate text-[12.5px]" title={f.centro}>
                                                    {f.centro || '-'}
                                                </span>
                                                <span
                                                    className="block max-w-[240px] truncate text-xs text-muted-foreground"
                                                    title={`${f.nombre_objetivomuestreo_ma || ''} · ${f.nombre_subarea || ''}`}
                                                >
                                                    {f.nombre_objetivomuestreo_ma || '-'}{f.nombre_subarea ? ` · ${f.nombre_subarea}` : ''}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex justify-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                        title="Descargar PDF"
                                                        onClick={() => handleDownloadPdf(id)}
                                                    >
                                                        <IconFileDownload size={16} />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-primary hover:bg-primary/10 hover:text-primary"
                                                        title="Ver Detalle"
                                                        onClick={() => onViewDetail(id)}
                                                    >
                                                        <IconEye size={16} />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="px-4 py-3">
                    <DataPagination page={page} pageSize={itemsPerPage} total={sortedFichas.length} onPageChange={setPage} />
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
