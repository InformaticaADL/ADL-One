import React, { useState } from 'react';
import { adminExportService } from '../../admin/services/admin.service';
import { useToast } from '../../../contexts/ToastContext';
import { Modal, Button, Input, Select, Divider, Typography } from 'antd';
import {
    IconFileExport,
    IconTrash,
    IconDownload,
    IconInfoCircle
} from '@tabler/icons-react';

const { Title, Text } = Typography;

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
    const selectProps = { showSearch: true, allowClear: true, style: { width: '100%' }, placeholder: 'Seleccionar...' } as const;

    return (
        <Modal
            open={isOpen}
            onCancel={onClose}
            footer={null}
            width={640}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <IconFileExport size={20} color="#2f9e44" />
                    <Title level={4} style={{ margin: 0 }}>Exportar Fichas (General)</Title>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, backgroundColor: 'var(--app-accent-bg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconInfoCircle size={18} color="var(--app-accent-text)" />
                        <Text italic style={{ fontSize: 12, color: 'var(--app-accent-text)' }}>
                            Los campos vacíos no aplicarán filtros. Selección específica limitará el reporte.
                        </Text>
                    </div>
                    <Button type="text" size="small" icon={<IconTrash size={14} />} onClick={handleClear}>
                        Limpiar Filtros
                    </Button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <Field label="N° Ficha"><Select options={mapCatalog(catalogos.fichas)} value={filters.ficha || undefined} onChange={(v) => setFilters({ ...filters, ficha: v || '' })} {...selectProps} /></Field>
                    <Field label="Estado"><Select options={mapCatalog(catalogos.estados)} value={filters.estado || undefined} onChange={(v) => setFilters({ ...filters, estado: v || '' })} {...selectProps} /></Field>
                    <Field label="Fecha Desde"><Input type="date" value={filters.fechaDesde} onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })} /></Field>
                    <Field label="Fecha Hasta"><Input type="date" value={filters.fechaHasta} onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })} /></Field>
                    <Field label="Tipo"><Select options={mapCatalog(catalogos.tipos)} value={filters.tipo || undefined} onChange={(v) => setFilters({ ...filters, tipo: v || '' })} {...selectProps} /></Field>
                    <Field label="E. Facturar"><Select options={mapCatalog(catalogos.empresasFacturar)} value={filters.empresaFacturar || undefined} onChange={(v) => setFilters({ ...filters, empresaFacturar: v || '' })} {...selectProps} /></Field>
                    <Field label="E. Servicio"><Select options={mapCatalog(catalogos.empresasServicio)} value={filters.empresaServicio || undefined} onChange={(v) => setFilters({ ...filters, empresaServicio: v || '' })} {...selectProps} /></Field>
                    <Field label="Fuente Emisora"><Select options={mapCatalog(catalogos.centros)} value={filters.centro || undefined} onChange={(v) => setFilters({ ...filters, centro: v || '' })} {...selectProps} /></Field>
                    <Field label="Objetivo"><Select options={mapCatalog(catalogos.objetivos)} value={filters.objetivo || undefined} onChange={(v) => setFilters({ ...filters, objetivo: v || '' })} {...selectProps} /></Field>
                    <Field label="Sub Área"><Select options={mapCatalog(catalogos.subAreas)} value={filters.subArea || undefined} onChange={(v) => setFilters({ ...filters, subArea: v || '' })} {...selectProps} /></Field>
                    <Field label="Usuario"><Select options={mapCatalog(catalogos.usuarios)} value={filters.usuario || undefined} onChange={(v) => setFilters({ ...filters, usuario: v || '' })} {...selectProps} /></Field>
                </div>

                <Divider style={{ margin: 0 }} />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <Button onClick={onClose} disabled={exporting}>Cancelar</Button>
                    <Button danger type="primary" icon={<IconDownload size={18} />} onClick={handleExportPdf} loading={exporting}>
                        Exportar PDF
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
        </div>
    );
}
