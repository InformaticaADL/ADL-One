import React, { useState } from 'react';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { adminExportService } from '../../admin/services/admin.service';

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

    if (!isOpen) return null;

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
            alert(error.response?.data?.message || 'Error al exportar PDF.');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
        }}>
            <div className="modal-content" style={{
                backgroundColor: 'white',
                padding: '2rem',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '600px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                animation: 'pve-fadeIn 0.3s ease-out'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem', fontWeight: 700 }}>Exportar Fichas (General)</h2>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                            onClick={() => setFilters({
                                ficha: '', estado: '', fechaDesde: '', fechaHasta: '',
                                tipo: '', empresaFacturar: '', empresaServicio: '',
                                centro: '', objetivo: '', subArea: '', usuario: ''
                            })}
                            style={{ 
                                border: '1px solid #e2e8f0', 
                                background: 'white', 
                                cursor: 'pointer', 
                                color: '#64748b',
                                fontSize: '0.75rem',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                            title="Limpiar todos los campos"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                            Limpiar Filtros
                        </button>
                        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>

                <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1.5rem', fontStyle: 'italic' }}>
                    Nota: Los campos vacíos no aplicarán filtros. Si selecciona una ficha o estado, la exportación se limitará a esa selección.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                    <SearchableSelect
                        label="N° Ficha"
                        placeholder="Buscar ficha..."
                        value={filters.ficha}
                        onChange={(val) => setFilters({...filters, ficha: val})}
                        options={catalogos.fichas.map(v => ({ id: v, nombre: v }))}
                    />

                    <SearchableSelect
                        label="Estado"
                        value={filters.estado}
                        onChange={(val) => setFilters({...filters, estado: val})}
                        options={catalogos.estados.map(v => ({ id: v, nombre: v }))}
                    />

                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Fecha Desde</label>
                        <input 
                            type="date" 
                            value={filters.fechaDesde} 
                            onChange={(e) => setFilters({...filters, fechaDesde: e.target.value})}
                            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                        />
                    </div>

                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '4px', display: 'block' }}>Fecha Hasta</label>
                        <input 
                            type="date" 
                            value={filters.fechaHasta} 
                            onChange={(e) => setFilters({...filters, fechaHasta: e.target.value})}
                            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                        />
                    </div>

                    <SearchableSelect
                        label="Tipo"
                        value={filters.tipo}
                        onChange={(val) => setFilters({...filters, tipo: val})}
                        options={catalogos.tipos.map(v => ({ id: v, nombre: v }))}
                    />

                    <SearchableSelect
                        label="E. Facturar"
                        value={filters.empresaFacturar}
                        onChange={(val) => setFilters({...filters, empresaFacturar: val})}
                        options={catalogos.empresasFacturar.map(v => ({ id: v, nombre: v }))}
                    />

                    <SearchableSelect
                        label="E. Servicio"
                        value={filters.empresaServicio}
                        onChange={(val) => setFilters({...filters, empresaServicio: val})}
                        options={catalogos.empresasServicio.map(v => ({ id: v, nombre: v }))}
                    />

                    <SearchableSelect
                        label="Fuente Emisora"
                        value={filters.centro}
                        onChange={(val) => setFilters({...filters, centro: val})}
                        options={catalogos.centros.map(v => ({ id: v, nombre: v }))}
                    />

                    <SearchableSelect
                        label="Objetivo"
                        value={filters.objetivo}
                        onChange={(val) => setFilters({...filters, objetivo: val})}
                        options={catalogos.objetivos.map(v => ({ id: v, nombre: v }))}
                    />

                    <SearchableSelect
                        label="Sub Área"
                        value={filters.subArea}
                        onChange={(val) => setFilters({...filters, subArea: val})}
                        options={catalogos.subAreas.map(v => ({ id: v, nombre: v }))}
                    />

                    <SearchableSelect
                        label="Usuario"
                        value={filters.usuario}
                        onChange={(val) => setFilters({...filters, usuario: val})}
                        options={catalogos.usuarios.map(v => ({ id: v, nombre: v }))}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                    <button 
                        onClick={onClose}
                        style={{
                            padding: '0.6rem 1.2rem',
                            borderRadius: '10px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: 'white',
                            color: '#64748b',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleExportPdf}
                        disabled={exporting}
                        style={{
                            padding: '0.6rem 1.8rem',
                            borderRadius: '10px',
                            border: 'none',
                            backgroundColor: '#e11d48',
                            color: 'white',
                            fontWeight: 600,
                            cursor: exporting ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.4)'
                        }}
                    >
                        {exporting ? 'Generando PDF...' : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                Exportar PDF
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
