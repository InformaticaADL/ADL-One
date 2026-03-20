import React, { useState } from 'react';
import { adminExportService } from '../../admin/services/admin.service';
import { 
    Modal, 
    Button, 
    Group, 
    Stack, 
    Title, 
    Text, 
    SimpleGrid, 
    TextInput, 
    Select, 
    Divider,
    ThemeIcon 
} from '@mantine/core';
import { 
    IconFileExport, 
    IconTrash, 
    IconX, 
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
            // In a real app, use toast here
            alert(error.response?.data?.message || 'Error al exportar PDF.');
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
        <Modal 
            opened={isOpen} 
            onClose={onClose} 
            title={
                <Group gap="xs">
                    <ThemeIcon color="green" variant="light">
                        <IconFileExport size={18} />
                    </ThemeIcon>
                    <Title order={4}>Exportar Fichas (General)</Title>
                </Group>
            }
            size="lg"
            radius="md"
        >
            <Stack gap="md">
                <Group justify="space-between" align="center" bg="blue.0" p="xs" style={{ borderRadius: '8px', border: '1px solid var(--mantine-color-blue-1)' }}>
                    <Group gap="xs">
                        <IconInfoCircle size={18} color="var(--mantine-color-blue-6)" />
                        <Text size="xs" c="blue.8" italic>
                            Los campos vacíos no aplicarán filtros. Selección específica limitará el reporte.
                        </Text>
                    </Group>
                    <Button 
                        variant="subtle" 
                        color="gray" 
                        size="compact-xs" 
                        leftSection={<IconTrash size={14} />}
                        onClick={handleClear}
                    >
                        Limpiar Filtros
                    </Button>
                </Group>

                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                    <Select label="N° Ficha" placeholder="Seleccionar..." data={mapCatalog(catalogos.fichas)} value={filters.ficha} onChange={(v) => setFilters({...filters, ficha: v || ''})} searchable clearable size="xs" />
                    <Select label="Estado" placeholder="Seleccionar..." data={mapCatalog(catalogos.estados)} value={filters.estado} onChange={(v) => setFilters({...filters, estado: v || ''})} searchable clearable size="xs" />
                    <TextInput label="Fecha Desde" type="date" value={filters.fechaDesde} onChange={(e) => setFilters({...filters, fechaDesde: e.target.value})} size="xs" />
                    <TextInput label="Fecha Hasta" type="date" value={filters.fechaHasta} onChange={(e) => setFilters({...filters, fechaHasta: e.target.value})} size="xs" />
                    <Select label="Tipo" placeholder="Seleccionar..." data={mapCatalog(catalogos.tipos)} value={filters.tipo} onChange={(v) => setFilters({...filters, tipo: v || ''})} searchable clearable size="xs" />
                    <Select label="E. Facturar" placeholder="Seleccionar..." data={mapCatalog(catalogos.empresasFacturar)} value={filters.empresaFacturar} onChange={(v) => setFilters({...filters, empresaFacturar: v || ''})} searchable clearable size="xs" />
                    <Select label="E. Servicio" placeholder="Seleccionar..." data={mapCatalog(catalogos.empresasServicio)} value={filters.empresaServicio} onChange={(v) => setFilters({...filters, empresaServicio: v || ''})} searchable clearable size="xs" />
                    <Select label="Fuente Emisora" placeholder="Seleccionar..." data={mapCatalog(catalogos.centros)} value={filters.centro} onChange={(v) => setFilters({...filters, centro: v || ''})} searchable clearable size="xs" />
                    <Select label="Objetivo" placeholder="Seleccionar..." data={mapCatalog(catalogos.objetivos)} value={filters.objetivo} onChange={(v) => setFilters({...filters, objetivo: v || ''})} searchable clearable size="xs" />
                    <Select label="Sub Área" placeholder="Seleccionar..." data={mapCatalog(catalogos.subAreas)} value={filters.subArea} onChange={(v) => setFilters({...filters, subArea: v || ''})} searchable clearable size="xs" />
                    <Select label="Usuario" placeholder="Seleccionar..." data={mapCatalog(catalogos.usuarios)} value={filters.usuario} onChange={(v) => setFilters({...filters, usuario: v || ''})} searchable clearable size="xs" />
                </SimpleGrid>

                <Divider />

                <Group justify="flex-end" gap="sm">
                    <Button variant="outline" color="gray" onClick={onClose} disabled={exporting}>
                        Cancelar
                    </Button>
                    <Button 
                        color="red" 
                        leftSection={<IconDownload size={18} />} 
                        onClick={handleExportPdf}
                        loading={exporting}
                    >
                        Exportar PDF
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
};
