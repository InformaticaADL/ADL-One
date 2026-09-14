import React, { useState, useEffect, useMemo } from 'react';
import {
    IconFileText,
    IconSearch,
    IconChevronRight,
    IconPower,
    IconInfoCircle,
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, SortableTableHead, TableHead, TableCell } from '@/components/ui/table';

import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { useTableSort } from '../../../hooks/useTableSort';
import { ursService } from '../../../services/urs.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';

interface RequestType {
    id_tipo: number;
    nombre: string;
    descripcion?: string;
    area_destino: string;
    estado: boolean;
}

interface RequestsManagerProps {
    onBack: () => void;
    onConfigureType: (type: RequestType) => void;
}

type SortKey = 'nombre' | 'area' | 'estado';

const SORT_ACCESSORS: Record<SortKey, (t: RequestType) => string | number | null | undefined> = {
    nombre: (t) => t.nombre,
    area: (t) => t.area_destino,
    estado: (t) => (t.estado ? 0 : 1),
};

export const RequestsManager: React.FC<RequestsManagerProps> = ({ onBack, onConfigureType }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { showToast } = useToast();

    const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const types = await ursService.getRequestTypes(true);
            setRequestTypes(types);
        } catch (error) {
            console.error('Error loading request types:', error);
            showToast({ type: 'error', message: 'Error al cargar tipos de solicitud' });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (type: RequestType) => {
        try {
            setActionLoading(type.id_tipo);
            await (ursService as any).toggleTypeStatus(type.id_tipo, !type.estado);
            showToast({ type: 'success', message: `Trámite ${!type.estado ? 'habilitado' : 'deshabilitado'} correctamente` });
            await loadData();
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cambiar estado del trámite' });
        } finally {
            setActionLoading(null);
        }
    };

    const filteredTypes = useMemo(
        () => requestTypes.filter((t) =>
            t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.area_destino.toLowerCase().includes(searchTerm.toLowerCase())
        ),
        [requestTypes, searchTerm]
    );

    const { sorted, sort, toggleSort } = useTableSort(filteredTypes, SORT_ACCESSORS);
    const sortProps = (key: SortKey) => ({ active: sort.key === key, direction: sort.direction, onSort: () => toggleSort(key) });

    const typeIcon = (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
            <IconFileText size={20} />
        </div>
    );

    const actions = (type: RequestType) => (
        <div className="flex items-center justify-end gap-2">
            <Button
                variant="ghost"
                size="icon"
                className={type.estado ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : 'text-success hover:bg-success/10 hover:text-success'}
                title={type.estado ? 'Deshabilitar trámite' : 'Habilitar trámite'}
                onClick={() => handleToggleStatus(type)}
                disabled={actionLoading === type.id_tipo}
            >
                <IconPower size={18} />
            </Button>
            <Button size="sm" onClick={() => onConfigureType(type)}>
                Configurar accesos <IconChevronRight size={14} />
            </Button>
        </div>
    );

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Administración de Solicitudes"
                subtitle="Gestiona quién puede enviar y administrar los trámites URS."
                onBack={onBack}
                breadcrumbItems={[{ label: 'Administración', onClick: onBack }, { label: 'Solicitudes URS' }]}
                rightSection={
                    <div className="relative">
                        <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={isMobile ? 'w-full pl-8' : 'w-72 pl-8'}
                        />
                    </div>
                }
            />

            <div className="mt-6 flex flex-col gap-4">
                <div className="relative overflow-hidden rounded-xl border border-border bg-card">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    )}

                    {isMobile ? (
                        <div className="flex flex-col divide-y divide-border">
                            {sorted.length > 0 ? sorted.map((type) => (
                                <div key={type.id_tipo} className="p-3">
                                    <div className="mb-3 flex items-start justify-between gap-2">
                                        <div className="flex min-w-0 items-center gap-3">
                                            {typeIcon}
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-foreground">{type.nombre}</p>
                                                <p className="text-xs text-muted-foreground">ID: {type.id_tipo}</p>
                                            </div>
                                        </div>
                                        <Badge variant={type.estado ? 'success' : 'destructive'}>{type.estado ? 'Activo' : 'Inactivo'}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Badge variant="outline">{type.area_destino}</Badge>
                                        {actions(type)}
                                    </div>
                                </div>
                            )) : (
                                <p className="p-6 text-center text-sm text-muted-foreground">No se encontraron trámites</p>
                            )}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <SortableTableHead {...sortProps('nombre')}>Tipo de trámite</SortableTableHead>
                                    <SortableTableHead {...sortProps('area')}>Área responsable</SortableTableHead>
                                    <SortableTableHead {...sortProps('estado')}>Estado</SortableTableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sorted.length > 0 ? sorted.map((type) => (
                                    <TableRow key={type.id_tipo}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                {typeIcon}
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{type.nombre}</p>
                                                    <p className="text-xs text-muted-foreground">ID: {type.id_tipo}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell><Badge variant="outline">{type.area_destino}</Badge></TableCell>
                                        <TableCell><Badge variant={type.estado ? 'success' : 'destructive'}>{type.estado ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                                        <TableCell>{actions(type)}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={4} className="py-16 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <IconFileText size={40} className="text-muted-foreground/40" />
                                                <p className="text-sm font-medium text-muted-foreground">No se encontraron trámites</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>

                <div className="flex items-start gap-2 rounded-xl bg-muted/50 p-3.5">
                    <IconInfoCircle size={18} className="mt-0.5 shrink-0 text-primary" />
                    <div>
                        <p className="mb-1 text-sm font-semibold text-foreground">Información para administradores</p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                            La creación de nuevos tipos de formularios y la edición técnica están reservadas para el equipo de desarrollo.
                            Desde este panel puedes controlar <strong className="text-foreground">quién tiene permiso para enviar</strong> cada solicitud y{' '}
                            <strong className="text-foreground">quién tiene la autoridad para resolverla</strong>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
