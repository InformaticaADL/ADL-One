import React, { useState, useEffect, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { FichaExportModal } from './FichaExportModal';
import { useTableSort } from '../../../hooks/useTableSort';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Table, TableHeader, TableBody, TableRow, TableHead, SortableTableHead, TableCell } from '@/components/ui/table';
import { DataPagination } from '@/components/ui/pagination';
import {
    IconAdjustmentsHorizontal,
    IconDownload,
    IconTrash,
    IconEye,
} from '@tabler/icons-react';

interface Props {
    onBackToMenu: () => void;
    onViewDetail: (id: number) => void;
}

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';

type SortKey = 'id' | 'estado' | 'fecha' | 'empresaFacturar' | 'empresaServicio' | 'objetivo';

export const FichasExploradorView: React.FC<Props> = ({ onBackToMenu, onViewDetail }) => {
    const [searchId, setSearchId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchEstado, setSearchEstado] = useState('');
    const [searchTipo, setSearchTipo] = useState('');
    const [searchEmpresaFacturar, setSearchEmpresaFacturar] = useState('');
    const [searchEmpresaServicio, setSearchEmpresaServicio] = useState('');
    const [searchCentro, setSearchCentro] = useState('');
    const [searchObjetivo, setSearchObjetivo] = useState('');
    const [searchSubArea, setSearchSubArea] = useState('');
    const [searchUsuario, setSearchUsuario] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [fichas, setFichas] = useState<any[]>([]);
    const [showExportModal, setShowExportModal] = useState(false);

    const itemsPerPage = 10;

    useEffect(() => {
        const loadFichas = async () => {
            setLoading(true);
            try {
                const response = await fichaService.getAll();
                let data: any[] = [];
                if (Array.isArray(response)) data = response;
                else if (response && response.data && Array.isArray(response.data)) data = response.data;
                else if (response && Array.isArray(response.recordset)) data = response.recordset;

                // Ordenar por ID de mayor a menor
                data.sort((a, b) => {
                    const idA = a.id_fichaingresoservicio || a.fichaingresoservicio || 0;
                    const idB = b.id_fichaingresoservicio || b.fichaingresoservicio || 0;
                    return idB - idA;
                });

                setFichas(data || []);
            } catch (error) {
                console.error("Error loading fichas:", error);
            } finally {
                setLoading(false);
            }
        };
        loadFichas();
    }, []);

    useEffect(() => {
        setPage(1);
    }, [searchId, dateFrom, dateTo, searchEstado, searchTipo, searchEmpresaFacturar, searchEmpresaServicio, searchCentro, searchObjetivo, searchSubArea, searchUsuario]);

    const getUniqueValues = (key: string) => {
        const values = new Set<string>();
        fichas.forEach(f => {
            if (f[key]) values.add(String(f[key]).trim());
        });
        return Array.from(values).sort().map(val => ({ value: val, label: val }));
    };

    const uniqueEstados = useMemo(() => getUniqueValues('estado_ficha'), [fichas]);
    const uniqueTipos = useMemo(() => getUniqueValues('tipo_fichaingresoservicio'), [fichas]);
    const uniqueEmpFacturar = useMemo(() => getUniqueValues('empresa_facturar'), [fichas]);
    const uniqueEmpServicio = useMemo(() => getUniqueValues('empresa_servicio'), [fichas]);
    const uniqueCentros = useMemo(() => getUniqueValues('centro'), [fichas]);
    const uniqueObjetivos = useMemo(() => getUniqueValues('nombre_objetivomuestreo_ma'), [fichas]);
    const uniqueSubAreas = useMemo(() => getUniqueValues('nombre_subarea'), [fichas]);
    const uniqueUsuarios = useMemo(() => getUniqueValues('nombre_usuario'), [fichas]);

    // For FichaExportModal format
    const getPlainValues = (key: string) => {
        const values = new Set<string>();
        fichas.forEach(f => {
            if (f[key]) values.add(String(f[key]).trim());
        });
        return Array.from(values).sort();
    };

    const handleClearFilters = () => {
        setSearchId('');
        setDateFrom('');
        setDateTo('');
        setSearchEstado('');
        setSearchTipo('');
        setSearchEmpresaFacturar('');
        setSearchEmpresaServicio('');
        setSearchCentro('');
        setSearchObjetivo('');
        setSearchSubArea('');
        setSearchUsuario('');
    };

    const filteredFichas = fichas.filter(f => {
        const displayId = f.fichaingresoservicio || f.id_fichaingresoservicio || '';
        const matchId = searchId ? String(displayId).includes(searchId) : true;
        const check = (val: string, search: string) => (!search || (val || '').toString().toLowerCase().includes(search.toLowerCase()));

        const matchEstado = check(f.estado_ficha, searchEstado);
        const matchTipo = check(f.tipo_fichaingresoservicio, searchTipo);
        const matchEmpresaFacturar = check(f.empresa_facturar, searchEmpresaFacturar);
        const matchEmpresaServicio = check(f.empresa_servicio, searchEmpresaServicio);
        const matchCentro = check(f.centro, searchCentro);
        const matchObjetivo = check(f.nombre_objetivomuestreo_ma, searchObjetivo);
        const matchSubArea = check(f.nombre_subarea, searchSubArea);
        const matchUsuario = check(f.nombre_usuario, searchUsuario);

        let matchDate = true;
        if (dateFrom || dateTo) {
            if (!f.fecha) return false;
            const parts = f.fecha.split('/');
            if (parts.length === 3) {
                const [d, m, y] = parts;
                const rowDate = new Date(`${y}-${m}-${d}`);
                rowDate.setHours(0, 0, 0, 0);
                if (dateFrom) {
                    const dFrom = new Date(dateFrom);
                    dFrom.setHours(0, 0, 0, 0);
                    if (rowDate < dFrom) matchDate = false;
                }
                if (dateTo && matchDate) {
                    const dTo = new Date(dateTo);
                    dTo.setHours(0, 0, 0, 0);
                    if (rowDate > dTo) matchDate = false;
                }
            }
        }
        return matchId && matchDate && matchEstado && matchTipo && matchEmpresaFacturar && matchEmpresaServicio && matchCentro && matchObjetivo && matchSubArea && matchUsuario;
    });

    const getStatusProps = (status: string): { variant: BadgeVariant; label: string } => {
        const s = (status || '').toUpperCase();
        if (s.includes('RECHAZADA') || s.includes('CANCELADO') || s.includes('REVISAR')) return { variant: 'destructive', label: s };
        if (s.includes('COORDINACIÓN')) return { variant: 'default', label: s };
        if (s.includes('PROGRAMACIÓN')) return { variant: 'secondary', label: s };
        if (s.includes('PENDIENTE') || s.includes('ÁREA TÉCNICA')) return { variant: 'warning', label: 'PENDIENTE TÉCNICA' };
        if (s.includes('ASIGNAR')) return { variant: 'warning', label: s };
        if (s.includes('VIGENTE') || s.includes('APROBADA') || s.includes('EJECUTADO') || s.includes('EN PROCESO')) return { variant: 'success', label: s };
        return { variant: 'outline', label: s || 'SIN ESTADO' };
    };

    const sortAccessors: Record<SortKey, (f: any) => string | number | null | undefined> = {
        id: (f) => f.fichaingresoservicio || f.id_fichaingresoservicio,
        estado: (f) => f.estado_ficha,
        fecha: (f) => f.fecha,
        empresaFacturar: (f) => f.empresa_facturar,
        empresaServicio: (f) => f.empresa_servicio,
        objetivo: (f) => f.nombre_objetivomuestreo_ma,
    };
    const { sorted: sortedFichas, sort, toggleSort } = useTableSort(filteredFichas, sortAccessors);
    const sortProps = (key: SortKey) => ({ active: sort.key === key, direction: sort.direction, onSort: () => { toggleSort(key); setPage(1); } });

    const paginatedFichas = useMemo(() => {
        const start = (page - 1) * itemsPerPage;
        return sortedFichas.slice(start, start + itemsPerPage);
    }, [sortedFichas, page]);

    const handleDownloadPdf = async (e: React.MouseEvent, ficha: any) => {
        e.stopPropagation();
        const idFicha = ficha.id_fichaingresoservicio || ficha.fichaingresoservicio;
        try {
            const pdfBlob = await fichaService.downloadPdf(Number(idFicha));
            const url = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            const fileName = ficha.frecuencia_correlativo || `Ficha_${idFicha}`;
            link.href = url;
            link.setAttribute('download', `${fileName}.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="shadcn-scope">
            <PageHeader
                title="Explorador de Fichas de Ingreso"
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'Explorador' }
                ]}
                rightSection={
                    <ProtectedContent permission="FI_EXP_MC">
                        <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={() => setShowExportModal(true)}>
                            <IconDownload size={16} /> Exportar PDF
                        </Button>
                    </ProtectedContent>
                }
            />

            <Card className="mb-4 p-4">
                <div className="mb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                        <IconAdjustmentsHorizontal size={18} /> Filtros de búsqueda
                    </span>
                    <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                        <IconTrash size={14} /> Limpiar filtros
                    </Button>
                </div>

                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                    <Field label="N° Ficha">
                        <Input placeholder="Buscar por ID..." value={searchId} onChange={(e) => setSearchId(e.target.value)} />
                    </Field>
                    <Field label="Estado">
                        <Combobox placeholder="Seleccionar..." searchPlaceholder="Buscar estado..." options={uniqueEstados} value={searchEstado} onValueChange={setSearchEstado} />
                    </Field>
                    <Field label="Fecha Desde">
                        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </Field>
                    <Field label="Fecha Hasta">
                        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </Field>
                    <Field label="Tipo">
                        <Combobox placeholder="Seleccionar..." searchPlaceholder="Buscar tipo..." options={uniqueTipos} value={searchTipo} onValueChange={setSearchTipo} />
                    </Field>
                    <Field label="Empresa">
                        <Combobox placeholder="Seleccionar..." searchPlaceholder="Buscar empresa..." options={uniqueEmpFacturar} value={searchEmpresaFacturar} onValueChange={setSearchEmpresaFacturar} />
                    </Field>
                    <Field label="E. Servicio">
                        <Combobox placeholder="Seleccionar..." searchPlaceholder="Buscar empresa..." options={uniqueEmpServicio} value={searchEmpresaServicio} onValueChange={setSearchEmpresaServicio} />
                    </Field>
                    <Field label="Fuente Emisora">
                        <Combobox placeholder="Seleccionar..." searchPlaceholder="Buscar centro..." options={uniqueCentros} value={searchCentro} onValueChange={setSearchCentro} />
                    </Field>
                    <Field label="Objetivo">
                        <Combobox placeholder="Seleccionar..." searchPlaceholder="Buscar objetivo..." options={uniqueObjetivos} value={searchObjetivo} onValueChange={setSearchObjetivo} />
                    </Field>
                    <Field label="Sub Área">
                        <Combobox placeholder="Seleccionar..." searchPlaceholder="Buscar sub área..." options={uniqueSubAreas} value={searchSubArea} onValueChange={setSearchSubArea} />
                    </Field>
                    <Field label="Usuario">
                        <Combobox placeholder="Seleccionar..." searchPlaceholder="Buscar usuario..." options={uniqueUsuarios} value={searchUsuario} onValueChange={setSearchUsuario} />
                    </Field>
                </div>
            </Card>

            <FichaExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                initialFilters={{
                    ficha: searchId, estado: searchEstado, fechaDesde: dateFrom, fechaHasta: dateTo, tipo: searchTipo, empresaFacturar: searchEmpresaFacturar, empresaServicio: searchEmpresaServicio, centro: searchCentro, objetivo: searchObjetivo, subArea: searchSubArea, usuario: searchUsuario
                }}
                catalogos={{
                    estados: getPlainValues('estado_ficha'), tipos: getPlainValues('tipo_fichaingresoservicio'), empresasFacturar: getPlainValues('empresa_facturar'), empresasServicio: getPlainValues('empresa_servicio'), centros: getPlainValues('centro'), objetivos: getPlainValues('nombre_objetivomuestreo_ma'), subAreas: getPlainValues('nombre_subarea'), fichas: getPlainValues('id_fichaingresoservicio'), usuarios: getPlainValues('nombre_usuario')
                }}
            />

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
                                <SortableTableHead {...sortProps('id')} className="w-20">ID</SortableTableHead>
                                <SortableTableHead {...sortProps('estado')} className="text-center">Estado</SortableTableHead>
                                <SortableTableHead {...sortProps('fecha')}>Fecha</SortableTableHead>
                                <SortableTableHead {...sortProps('empresaFacturar')}>Facturar a</SortableTableHead>
                                <SortableTableHead {...sortProps('empresaServicio')}>E. Servicio</SortableTableHead>
                                <SortableTableHead {...sortProps('objetivo')}>Objetivo</SortableTableHead>
                                <TableHead className="text-center">PDF</TableHead>
                                <TableHead className="text-center">Ver</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginatedFichas.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                                        {loading ? 'Cargando...' : 'No se encontraron fichas.'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedFichas.map((ficha) => {
                                    const status = getStatusProps(ficha.estado_ficha);
                                    const isRejected = (ficha.estado_ficha || '').toUpperCase().includes('RECHAZADA');
                                    const idFicha = ficha.id_fichaingresoservicio || ficha.fichaingresoservicio;
                                    return (
                                        <TableRow key={String(idFicha)}>
                                            <TableCell className="font-semibold text-primary">{ficha.fichaingresoservicio || '-'}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant={status.variant}>{status.label}</Badge>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-xs">{ficha.fecha || '-'}</TableCell>
                                            <TableCell className="max-w-[160px] truncate" title={ficha.empresa_facturar}>{ficha.empresa_facturar || '-'}</TableCell>
                                            <TableCell className="max-w-[160px] truncate" title={ficha.empresa_servicio}>{ficha.empresa_servicio || '-'}</TableCell>
                                            <TableCell className="max-w-[160px] truncate" title={ficha.nombre_objetivomuestreo_ma}>{ficha.nombre_objetivomuestreo_ma || '-'}</TableCell>
                                            <TableCell className="text-center">
                                                <ProtectedContent permission={['FI_EXPORTAR_CFI', 'FI_EXP_AFE']}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className={isRejected ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : undefined}
                                                        title={isRejected ? 'Atención: esta ficha ha sido rechazada' : 'Descargar PDF'}
                                                        onClick={(e) => handleDownloadPdf(e, ficha)}
                                                    >
                                                        <IconDownload size={18} />
                                                    </Button>
                                                </ProtectedContent>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <ProtectedContent permission={['FI_CONSULTAR', 'FI_VER', 'FI_APROBAR_TEC', 'FI_RECHAZAR_TEC', 'FI_APROBAR_COO', 'FI_RECHAZAR_COO', 'FI_EDITAR']}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-primary hover:bg-primary/10 hover:text-primary"
                                                        title="Ver ficha"
                                                        onClick={() => onViewDetail(idFicha)}
                                                    >
                                                        <IconEye size={18} />
                                                    </Button>
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
