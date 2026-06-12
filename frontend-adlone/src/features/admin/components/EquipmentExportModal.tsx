import React, { useState, useEffect } from 'react';
import { equipoService } from '../services/equipo.service';
import { useToast } from '../../../contexts/ToastContext';

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
        }
    }, [isOpen, initialFilters]);

    if (!isOpen) return null;

    const handleExport = async () => {
        if (exporting) return;
        setExporting(true);
        try {
            const params = {
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
        <div className="export-modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.4)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 10000,
            animation: 'fadeIn 0.3s ease-out'
        }}>
            <div className="export-modal-content" style={{
                background: 'rgba(255, 255, 255, 0.95)', width: '600px',
                borderRadius: '24px', padding: '2.5rem',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)', position: 'relative',
                overflow: 'hidden'
            }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                        <div>
                            <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.75rem', fontWeight: 800 }}>Exportar Equipos</h2>
                            <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.95rem' }}>Configure los filtros para su reporte personalizado (Formato Excel)</p>
                        </div>
                        <button onClick={onClose} style={{
                            background: '#f1f5f9', border: 'none', width: '36px', height: '36px',
                            borderRadius: '10px', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', cursor: 'pointer', color: '#64748b'
                        }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>


                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Estado</label>
                            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                <option value="Todos">Todos</option>
                                <option value="Activo">Solo Activos</option>
                                <option value="Inactivo">Solo Inactivos</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Responsable</label>
                            <select value={selectedMuestreador} onChange={(e) => setSelectedMuestreador(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                <option value="">Todos los Responsables</option>
                                {muestreadores.map(m => (
                                    <option key={m.id_muestreador} value={m.id_muestreador}>
                                        {m.habilitado === 'N' || m.habilitado === false
                                            ? `${m.nombre_muestreador} (Inactivo)`
                                            : m.nombre_muestreador}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Desde (Vigencia)</label>
                            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }} />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Hasta (Vigencia)</label>
                            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }} />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Tipo de Equipo</label>
                            <select value={selectedTipo} onChange={(e) => setSelectedTipo(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                <option value="">Cualquier Tipo</option>
                                {catalogs.tipos.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Ubicación</label>
                            <select value={selectedSede} onChange={(e) => setSelectedSede(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                <option value="">Cualquier Ubicación</option>
                                {catalogs.sedes.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                        <button onClick={onClose} style={{ padding: '0.75rem 1.5rem', borderRadius: '14px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>
                            Cancelar
                        </button>
                        <button onClick={handleExport} disabled={exporting} style={{
                            padding: '0.75rem 2.5rem', borderRadius: '14px', border: 'none',
                            background: exporting ? '#94a3b8' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: 'white', fontWeight: 700, cursor: exporting ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.75rem'
                        }}>
                            {exporting ? 'Exportando...' : 'Descargar Reporte'}
                        </button>
                    </div>
                </div>
            </div>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            `}</style>
        </div>
    );
};
