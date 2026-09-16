import React, { useState, useEffect, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { useTableSort } from '../../../hooks/useTableSort';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Table, TableHeader, TableBody, TableRow, TableHead, SortableTableHead, TableCell } from '@/components/ui/table';
import { DataPagination } from '@/components/ui/pagination';
import {
    IconSearch,
    IconEraser,
    IconEdit,
    IconFilter,
    IconClockPlay
} from '@tabler/icons-react';

interface Props {
    onBackToMenu: () => void;
    onViewDetail: (id: number) => void;
}

type SortKey = 'id' | 'fecha' | 'muestreador' | 'tipo' | 'empresa' | 'objetivo';

export const EnProcesoListView: React.FC<Props> = ({ onBackToMenu, onViewDetail }) => {
    // State
    const [searchId, setSearchId] = useState('');
    const [dateFrom, setDateFrom] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [dateTo, setDateTo] = useState(() => {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    });
    const { showToast } = useToast();

    const [searchTipo, setSearchTipo] = useState<string | null>(null);
    const [searchEmpresaServicio, setSearchEmpresaServicio] = useState<string | null>(null);
    const [searchMuestreador, setSearchMuestreador] = useState<string | null>(null);
    const [searchObjetivo, setSearchObjetivo] = useState<string | null>(null);
    const [searchSubArea, setSearchSubArea] = useState<string | null>(null);

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [fichas, setFichas] = useState<any[]>([]);

    const itemsPerPage = 12;

    useEffect(() => {
        loadFichas();
    }, []);

    const loadFichas = async () => {
        setLoading(true);
        try {
            const response = await fichaService.getEnProceso();
            let data = [];
            if (Array.isArray(response)) data = response;
            else if (response && response.data && Array.isArray(response.data)) data = response.data;
            else if (response && Array.isArray(response.recordset)) data = response.recordset;

            setFichas(data || []);
        } catch (error) {
            console.error("Error loading en proceso fichas:", error);
            showToast({ type: 'error', message: 'Error cargando las fichas en proceso.' });
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

    const uniqueTipos = useMemo(() => getUniqueValues('tipo_ficha'), [fichas]);
    const uniqueEmpServicio = useMemo(() => getUniqueValues('empresa_servicio'), [fichas]);
    const uniqueMuestreadores = useMemo(() => getUniqueValues('muestreador'), [fichas]);
    const uniqueObjetivos = useMemo(() => getUniqueValues('objetivo'), [fichas]);
    const uniqueSubAreas = useMemo(() => getUniqueValues('subarea'), [fichas]);

    const handleClearFilters = () => {
        setSearchId('');
        setDateFrom('');
        setDateTo('');
        setSearchTipo(null);
        setSearchEmpresaServicio(null);
        setSearchMuestreador(null);
        setSearchObjetivo(null);
        setSearchSubArea(null);
        setPage(1);
    };

    const filteredFichas = useMemo(() => {
        return fichas.filter(f => {
            const displayId = f.correlativo || f.id || f.fichaingresoservicio || '';
            const matchId = searchId ? String(displayId).includes(searchId) : true;

            const check = (val: string, search: string | null) => {
                if (!search) return true;
                return (val || '').toString().toLowerCase().includes(search.toLowerCase());
            };

            const matchTipo = check(f.tipo_ficha, searchTipo);
            const matchEmpresaServicio = check(f.empresa_servicio, searchEmpresaServicio);
            const matchMuestreador = check(f.muestreador, searchMuestreador);
            const matchObjetivo = check(f.objetivo, searchObjetivo);
            const matchSubArea = check(f.subarea, searchSubArea);

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

            return matchId && matchDate && matchTipo && matchEmpresaServicio && matchMuestreador && matchObjetivo && matchSubArea;
        });
    }, [fichas, searchId, dateFrom, dateTo, searchTipo, searchEmpresaServicio, searchMuestreador, searchObjetivo, searchSubArea]);

    const sortAccessors: Record<SortKey, (f: any) => string | number | null | undefined> = {
        id: (f) => f.correlativo || f.id,
        fecha: (f) => f.fecha,
        muestreador: (f) => f.muestreador,
        tipo: (f) => f.tipo_ficha,
        empresa: (f) => f.empresa_servicio,
        objetivo: (f) => f.objetivo,
    };
    const { sorted: sortedFichas, sort, toggleSort } = useTableSort(
        filteredFichas,
        sortAccessors,
        { key: 'fecha' as SortKey, direction: 'desc' }
    );
    const sortProps = (key: SortKey) => ({ active: sort.key === key, direction: sort.direction, onSort: () => { toggleSort(key); setPage(1); } });

    const paginatedFichas = useMemo(() => {
        const start = (page - 1) * itemsPerPage;
        return sortedFichas.slice(start, start + itemsPerPage);
    }, [sortedFichas, page]);

    return (
        <div className="shadcn-scope">
            <PageHeader
                title="Fichas en Proceso"
                subtitle="Seguimiento de servicios programados y en ejecución"
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'En Proceso' }
                ]}
                rightSection={
                    <div className="flex items-center gap-2.5">
                        <span className="text-xs text-muted-foreground">{filteredFichas.length} registros</span>
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
                    <Field label="Desde">
                        <DatePicker value={dateFrom} onChange={setDateFrom} />
                    </Field>
                    <Field label="Hasta">
                        <DatePicker value={dateTo} onChange={setDateTo} />
                    </Field>
                    <Field label="Tipo Ficha">
                        <Combobox placeholder="Todos" searchPlaceholder="Buscar tipo..." options={uniqueTipos} value={searchTipo ?? ''} onValueChange={(v) => setSearchTipo(v || null)} />
                    </Field>
                    <Field label="Empresa Servicio">
                        <Combobox placeholder="Todos" searchPlaceholder="Buscar empresa..." options={uniqueEmpServicio} value={searchEmpresaServicio ?? ''} onValueChange={(v) => setSearchEmpresaServicio(v || null)} />
                    </Field>
                    <Field label="Muestreador">
                        <Combobox placeholder="Todos" searchPlaceholder="Buscar muestreador..." options={uniqueMuestreadores} value={searchMuestreador ?? ''} onValueChange={(v) => setSearchMuestreador(v || null)} />
                    </Field>
                    <Field label="Objetivo">
                        <Combobox placeholder="Todos" searchPlaceholder="Buscar objetivo..." options={uniqueObjetivos} value={searchObjetivo ?? ''} onValueChange={(v) => setSearchObjetivo(v || null)} />
                    </Field>
                    <Field label="Sub Área">
                        <Combobox placeholder="Todos" searchPlaceholder="Buscar sub área..." options={uniqueSubAreas} value={searchSubArea ?? ''} onValueChange={(v) => setSearchSubArea(v || null)} />
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
                                <SortableTableHead {...sortProps('fecha')} className="w-[110px]">Fecha M.</SortableTableHead>
                                <SortableTableHead {...sortProps('muestreador')} className="w-[160px]">Muestreador</SortableTableHead>
                                <SortableTableHead {...sortProps('tipo')} className="w-[120px]">Tipo</SortableTableHead>
                                <SortableTableHead {...sortProps('empresa')} className="w-[220px]">Empresa / Contacto</SortableTableHead>
                                <SortableTableHead {...sortProps('objetivo')} className="w-[220px]">Objetivo / Sub Área</SortableTableHead>
                                <TableHead className="w-[60px] text-center" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedFichas.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                                        {loading ? 'Cargando...' : 'No se encontraron fichas en proceso.'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedFichas.map((f) => (
                                    <TableRow key={`${f.id}-${f.correlativo}`}>
                                        <TableCell className="font-semibold text-primary">{f.correlativo || f.id || '-'}</TableCell>
                                        <TableCell className="text-[12.5px] font-medium">{f.fecha ? new Date(f.fecha).toLocaleDateString('es-ES') : 'Sin Fecha'}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                <IconClockPlay size={14} className="text-primary" />
                                                <span className="text-[12.5px] font-medium">{f.muestreador || 'Por Asignar'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell><Badge variant="secondary">{f.tipo_ficha || '-'}</Badge></TableCell>
                                        <TableCell>
                                            <span className="block max-w-[200px] truncate text-[12.5px] font-medium" title={f.empresa_servicio}>
                                                {f.empresa_servicio || '-'}
                                            </span>
                                            <span className="block max-w-[200px] truncate text-xs text-muted-foreground" title={f.contacto}>
                                                {f.contacto || f.correo_empresa || '-'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="block max-w-[200px] truncate text-[12.5px]" title={f.objetivo}>
                                                {f.objetivo || '-'}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{f.subarea || '-'}</span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <ProtectedContent permission="FI_VER">
                                                <Button
                                                    size="icon"
                                                    className="bg-teal-600 text-white hover:bg-teal-600/90"
                                                    title="Gestionar Ficha"
                                                    onClick={() => onViewDetail(f.id)}
                                                >
                                                    <IconEdit size={16} />
                                                </Button>
                                            </ProtectedContent>
                                        </TableCell>
                                    </TableRow>
                                ))
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
