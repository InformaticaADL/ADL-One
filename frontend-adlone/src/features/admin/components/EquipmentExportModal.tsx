import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { equipoService } from '../services/equipo.service';

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
    const [format, setFormat] = useState<'excel' | 'formulario'>('excel');
    const [status, setStatus] = useState<string>(initialFilters?.estado || 'Todos');
    const [dateFrom, setDateFrom] = useState<string>(initialFilters?.fechaDesde || '');
    const [dateTo, setDateTo] = useState<string>(initialFilters?.fechaHasta || '');
    const [selectedMuestreador, setSelectedMuestreador] = useState<string>(initialFilters?.id_muestreador || '');
    const [selectedTipo, setSelectedTipo] = useState<string>(initialFilters?.tipo || '');
    const [selectedSede, setSelectedSede] = useState<string>(initialFilters?.sede || '');
    const [exporting, setExporting] = useState(false);

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

            if (format === 'excel') {
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
            } else {
                // PDF Format - Fetch data first
                const response = await equipoService.getEquipos({ ...params, limit: 5000 });
                if (!response || !response.data) throw new Error("No hay datos para exportar");
                
                const data = response.data;
                const total = data.length;
                const activeCount = data.filter((eq: any) => eq.estado === 'Activo').length;
                const inactiveCount = total - activeCount;
                const countByType: { [key: string]: number } = {};
                data.forEach((eq: any) => {
                    countByType[eq.tipo] = (countByType[eq.tipo] || 0) + 1;
                });

                const doc = new jsPDF();
                const pageWidth = doc.internal.pageSize.getWidth();
                
                doc.setFontSize(18);
                doc.setTextColor(30, 41, 59);
                doc.text("REPORTE CONSOLIDADO DE EQUIPOS", pageWidth / 2, 20, { align: 'center' });
                
                autoTable(doc, {
                    startY: 30,
                    head: [['INDICADOR', 'VALOR']],
                    body: [
                        ['Total de Equipos', total],
                        ['Equipos Activos', activeCount],
                        ['Equipos Inactivos', inactiveCount],
                        ['Fecha de Descarga', new Date().toLocaleString()]
                    ],
                    theme: 'striped',
                    headStyles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' },
                    styles: { fontSize: 9 },
                    margin: { horizontal: 14 }
                });

                let currentY = (doc as any).lastAutoTable.finalY + 10;
                const tipos = Object.keys(countByType).sort();
                
                tipos.forEach(tipoName => {
                    const items = data.filter((eq: any) => eq.tipo === tipoName);
                    if (currentY > 260) { doc.addPage(); currentY = 20; }
                    
                    doc.setFillColor(59, 130, 246);
                    doc.rect(14, currentY, pageWidth - 28, 8, 'F');
                    doc.setFontSize(10);
                    doc.setTextColor(255, 255, 255);
                    doc.text(`TIPO: ${String(tipoName).toUpperCase()} (${items.length} equipos)`, 18, currentY + 5.5);
                    
                    currentY += 10;

                    autoTable(doc, {
                        startY: currentY,
                        head: [['#', 'CÓDIGO', 'NOMBRE', 'S/C', 'ESTADO', 'UBICACIÓN', 'VIGENCIA']],
                        body: items.map((eq: any, idx: number) => [
                            idx + 1, eq.codigo || '-', eq.nombre || '-', `${eq.sigla || '-'}/${eq.correlativo || '-'}`,
                            eq.estado || '-', eq.ubicacion || '-', eq.vigencia || '-'
                        ]),
                        theme: 'grid',
                        headStyles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontSize: 8 },
                        styles: { fontSize: 7, cellPadding: 2 },
                        margin: { horizontal: 14 },
                        didDrawPage: () => {
                            doc.setFontSize(8);
                            doc.setTextColor(148, 163, 184);
                            doc.text("ADL ONE :FIN DEL REPORTE - ADL One System", pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
                        }
                    });
                    currentY = (doc as any).lastAutoTable.finalY + 10;
                });

                doc.save(`Reporte_Equipos_PDF_${new Date().toISOString().split('T')[0]}.pdf`);
            }
            onClose();
        } catch (error) {
            console.error("Export error:", error);
            alert("Error al exportar los datos.");
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
                            <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.95rem' }}>Configure los filtros para su reporte personalizado</p>
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
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Formato de Salida</label>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button onClick={() => setFormat('excel')} style={{
                                    flex: 1, padding: '1rem', borderRadius: '16px',
                                    border: format === 'excel' ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                                    background: format === 'excel' ? '#eff6ff' : 'white',
                                    color: format === 'excel' ? '#1d4ed8' : '#64748b',
                                    fontWeight: 600, cursor: 'pointer', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                                }}>
                                    Excel (Multi-hoja)
                                </button>
                                <button onClick={() => setFormat('formulario')} style={{
                                    flex: 1, padding: '1rem', borderRadius: '16px',
                                    border: format === 'formulario' ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                                    background: format === 'formulario' ? '#eff6ff' : 'white',
                                    color: format === 'formulario' ? '#1d4ed8' : '#64748b',
                                    fontWeight: 600, cursor: 'pointer', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                                }}>
                                    PDF (Formulario)
                                </button>
                            </div>
                        </div>

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
                                {muestreadores.map(m => <option key={m.id_muestreador} value={m.id_muestreador}>{m.nombre_muestreador}</option>)}
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
                            background: exporting ? '#94a3b8' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
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
