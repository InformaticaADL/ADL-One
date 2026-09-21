import React, { useState, useEffect } from 'react';
import { IconDownload } from '@tabler/icons-react';
import { equipoService } from '../services/equipo.service';
import { useToast } from '../../../contexts/ToastContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface EquipmentExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    catalogs: {
        tipos: string[];
        sedes: string[];
        estados: string[];
        nombres?: string[];
    };
    muestreadores: any[];
    initialFilters?: {
        search?: string;
        tipo?: string;
        sede?: string;
        estado?: string;
        fechaDesde?: string;
        fechaHasta?: string;
        id_muestreador?: string;
    };
}

export const EquipmentExportModal: React.FC<EquipmentExportModalProps> = ({
    isOpen,
    onClose,
    catalogs,
    muestreadores,
    initialFilters
}) => {
    const [status, setStatus] = useState<string>(initialFilters?.estado || 'Todos');
    const [dateFrom, setDateFrom] = useState<string>(initialFilters?.fechaDesde || '');
    const [dateTo, setDateTo] = useState<string>(initialFilters?.fechaHasta || '');
    const [selectedMuestreador, setSelectedMuestreador] = useState<string>(initialFilters?.id_muestreador || '');
    const [selectedTipo, setSelectedTipo] = useState<string>(initialFilters?.tipo || '');
    const [selectedSede, setSelectedSede] = useState<string>(initialFilters?.sede || '');
    const [searchTerm, setSearchTerm] = useState<string>(initialFilters?.search || '');
    const [exporting, setExporting] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        if (isOpen && initialFilters) {
            setStatus(initialFilters.estado || 'Todos');
            setDateFrom(initialFilters.fechaDesde || '');
            setDateTo(initialFilters.fechaHasta || '');
            setSelectedMuestreador(initialFilters.id_muestreador || '');
            setSelectedTipo(initialFilters.tipo || '');
            setSelectedSede(initialFilters.sede || '');
            setSearchTerm(initialFilters.search || '');
        }
    }, [isOpen, initialFilters]);

    const handleExport = async () => {
        if (exporting) return;
        setExporting(true);
        try {
            const params = {
                search: searchTerm,
                tipo: selectedTipo,
                sede: selectedSede,
                estado: status === 'Todos' ? '' : status,
                fechaDesde: dateFrom,
                fechaHasta: dateTo,
                id_muestreador: selectedMuestreador
            };

            const buffer = await equipoService.exportEquiposExcel(params);
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Reporte_INT_Equipos_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            onClose();
        } catch (error) {
            console.error("Export error:", error);
            showToast({ type: 'error', message: 'Error al exportar los datos.' });
        } finally {
            setExporting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Exportar Equipos</DialogTitle>
                </DialogHeader>
                <p className="-mt-2 text-sm text-muted-foreground">
                    Configure los filtros para su reporte personalizado (Formato Excel)
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                        <Label className="mb-1.5 block">Estado</Label>
                        <Combobox
                            value={status}
                            onValueChange={setStatus}
                            options={[
                                { value: 'Todos', label: 'Todos' },
                                { value: 'Activo', label: 'Solo Activos' },
                                { value: 'Inactivo', label: 'Solo Inactivos' },
                            ]}
                        />
                    </div>

                    <div>
                        <Label className="mb-1.5 block">Responsable</Label>
                        <Combobox
                            value={selectedMuestreador}
                            onValueChange={setSelectedMuestreador}
                            placeholder="Todos los Responsables"
                            searchPlaceholder="Buscar responsable..."
                            options={muestreadores.map((m) => ({
                                value: String(m.id_muestreador),
                                label: m.habilitado === 'N' || m.habilitado === false
                                    ? `${m.nombre_muestreador} (Inactivo)`
                                    : m.nombre_muestreador,
                            }))}
                        />
                    </div>

                    <div>
                        <Label className="mb-1.5 block">Desde (Vigencia)</Label>
                        <DatePicker value={dateFrom} onChange={setDateFrom} />
                    </div>
                    <div>
                        <Label className="mb-1.5 block">Hasta (Vigencia)</Label>
                        <DatePicker value={dateTo} onChange={setDateTo} />
                    </div>

                    <div>
                        <Label className="mb-1.5 block">Tipo de Equipo</Label>
                        <Combobox
                            value={selectedTipo}
                            onValueChange={setSelectedTipo}
                            placeholder="Cualquier Tipo"
                            searchPlaceholder="Buscar tipo..."
                            options={catalogs.tipos.map((t) => ({ value: t, label: t }))}
                        />
                    </div>

                    <div>
                        <Label className="mb-1.5 block">Ubicación</Label>
                        <Combobox
                            value={selectedSede}
                            onValueChange={setSelectedSede}
                            placeholder="Cualquier Ubicación"
                            searchPlaceholder="Buscar ubicación..."
                            options={catalogs.sedes.map((s) => ({ value: s, label: s }))}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleExport} disabled={exporting}>
                        {exporting ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        ) : (
                            <IconDownload size={16} />
                        )}
                        {exporting ? 'Exportando...' : 'Descargar Reporte'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
