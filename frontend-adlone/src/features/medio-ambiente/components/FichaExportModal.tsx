import React, { useState } from 'react';
import { adminExportService } from '../../admin/services/admin.service';
import { useToast } from '../../../contexts/ToastContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import {
    IconFileExport,
    IconTrash,
    IconDownload,
    IconInfoCircle
} from '@tabler/icons-react';

interface FichaExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialFilters: {
        ficha: string;
        estado: string;
        fechaDesde: string;
        fechaHasta: string;
        tipo: string;
        empresaFacturar: string;
        empresaServicio: string;
        centro: string;
        objetivo: string;
        subArea: string;
        usuario: string;
    };
    catalogos: {
        estados: string[];
        tipos: string[];
        empresasFacturar: string[];
        empresasServicio: string[];
        centros: string[];
        objetivos: string[];
        subAreas: string[];
        fichas: string[];
        usuarios: string[];
    };
}

export const FichaExportModal: React.FC<FichaExportModalProps> = ({
    isOpen,
    onClose,
    initialFilters,
    catalogos
}) => {
    const [filters, setFilters] = useState(initialFilters);
    const [exporting, setExporting] = useState(false);
    const { showToast } = useToast();

    const handleExportPdf = async () => {
        setExporting(true);
        try {
            const params = {
                ficha: filters.ficha || undefined,
                estado: filters.estado || undefined,
                fechaDesde: filters.fechaDesde || undefined,
                fechaHasta: filters.fechaHasta || undefined,
                tipo: filters.tipo || undefined,
                empresaFacturar: filters.empresaFacturar || undefined,
                empresaServicio: filters.empresaServicio || undefined,
                centro: filters.centro || undefined,
                objetivo: filters.objetivo || undefined,
                subArea: filters.subArea || undefined,
                usuario: filters.usuario || undefined,
            };

            const blob = await adminExportService.getExportPdf(params);

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Reporte_Fichas_${new Date().toISOString().split('T')[0]}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            onClose();
        } catch (error: any) {
            console.error('Export PDF error:', error);
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al exportar PDF.' });
        } finally {
            setExporting(false);
        }
    };

    const handleClear = () => {
        setFilters({
            ficha: '', estado: '', fechaDesde: '', fechaHasta: '',
            tipo: '', empresaFacturar: '', empresaServicio: '',
            centro: '', objetivo: '', subArea: '', usuario: ''
        });
    };

    const mapCatalog = (arr: string[]) => arr.map(v => ({ value: v, label: v }));

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2.5">
                        <IconFileExport size={20} className="text-success" />
                        Exportar Fichas (General)
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/5 p-2.5">
                        <div className="flex items-center gap-2">
                            <IconInfoCircle size={18} className="text-primary" />
                            <span className="text-xs italic text-primary">
                                Los campos vacíos no aplicarán filtros. Selección específica limitará el reporte.
                            </span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={handleClear}>
                            <IconTrash size={14} /> Limpiar Filtros
                        </Button>
                    </div>

                    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
                        <Field label="N° Ficha">
                            <Combobox options={mapCatalog(catalogos.fichas)} value={filters.ficha} onValueChange={(v) => setFilters({ ...filters, ficha: v })} placeholder="Seleccionar..." searchPlaceholder="Buscar ficha..." />
                        </Field>
                        <Field label="Estado">
                            <Combobox options={mapCatalog(catalogos.estados)} value={filters.estado} onValueChange={(v) => setFilters({ ...filters, estado: v })} placeholder="Seleccionar..." searchPlaceholder="Buscar estado..." />
                        </Field>
                        <Field label="Fecha Desde">
                            <Input type="date" value={filters.fechaDesde} onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })} />
                        </Field>
                        <Field label="Fecha Hasta">
                            <Input type="date" value={filters.fechaHasta} onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })} />
                        </Field>
                        <Field label="Tipo">
                            <Combobox options={mapCatalog(catalogos.tipos)} value={filters.tipo} onValueChange={(v) => setFilters({ ...filters, tipo: v })} placeholder="Seleccionar..." searchPlaceholder="Buscar tipo..." />
                        </Field>
                        <Field label="E. Facturar">
                            <Combobox options={mapCatalog(catalogos.empresasFacturar)} value={filters.empresaFacturar} onValueChange={(v) => setFilters({ ...filters, empresaFacturar: v })} placeholder="Seleccionar..." searchPlaceholder="Buscar empresa..." />
                        </Field>
                        <Field label="E. Servicio">
                            <Combobox options={mapCatalog(catalogos.empresasServicio)} value={filters.empresaServicio} onValueChange={(v) => setFilters({ ...filters, empresaServicio: v })} placeholder="Seleccionar..." searchPlaceholder="Buscar empresa..." />
                        </Field>
                        <Field label="Fuente Emisora">
                            <Combobox options={mapCatalog(catalogos.centros)} value={filters.centro} onValueChange={(v) => setFilters({ ...filters, centro: v })} placeholder="Seleccionar..." searchPlaceholder="Buscar centro..." />
                        </Field>
                        <Field label="Objetivo">
                            <Combobox options={mapCatalog(catalogos.objetivos)} value={filters.objetivo} onValueChange={(v) => setFilters({ ...filters, objetivo: v })} placeholder="Seleccionar..." searchPlaceholder="Buscar objetivo..." />
                        </Field>
                        <Field label="Sub Área">
                            <Combobox options={mapCatalog(catalogos.subAreas)} value={filters.subArea} onValueChange={(v) => setFilters({ ...filters, subArea: v })} placeholder="Seleccionar..." searchPlaceholder="Buscar sub área..." />
                        </Field>
                        <Field label="Usuario">
                            <Combobox options={mapCatalog(catalogos.usuarios)} value={filters.usuario} onValueChange={(v) => setFilters({ ...filters, usuario: v })} placeholder="Seleccionar..." searchPlaceholder="Buscar usuario..." />
                        </Field>
                    </div>

                    <div className="flex justify-end gap-2 border-t border-border pt-4">
                        <Button variant="outline" onClick={onClose} disabled={exporting}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleExportPdf} disabled={exporting}>
                            {exporting && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                            <IconDownload size={18} /> Exportar PDF
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
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
