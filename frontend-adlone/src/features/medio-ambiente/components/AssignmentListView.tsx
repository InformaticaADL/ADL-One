import React, { useState, useEffect } from 'react';
import { fichaService } from '../services/ficha.service';
import '../styles/FichasIngreso.css';

interface Props {
    onBackToMenu: () => void;
    onViewAssignment: (id: number) => void;
}

export const AssignmentListView: React.FC<Props> = ({ onBackToMenu, onViewAssignment }) => {
    // State
    const [filterDate, setFilterDate] = useState('');
    const [filterText, setFilterText] = useState(''); // "campo de texto, que traera de la base de datos"

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [fichas, setFichas] = useState<any[]>([]);

    // Constants
    const itemsPerPage = 10;

    // Load Data Effect
    useEffect(() => {
        const loadFichas = async () => {
            setLoading(true);
            try {
                const response = await fichaService.getForAssignment();
                let data = [];
                if (Array.isArray(response)) data = response;
                else if (response && response.data && Array.isArray(response.data)) data = response.data;
                else if (response && Array.isArray(response.recordset)) data = response.recordset;

                setFichas(data || []);

            } catch (error) {
                console.error("Error loading fichas for assignment:", error);
            } finally {
                setLoading(false);
            }
        };

        loadFichas();
    }, []);

    // Filter Logic
    const filteredFichas = fichas.filter(f => {
        // Basic filtering example (can be expanded based on "text field" purpose)
        const matchesText = filterText
            ? Math.random() > -1 // Placeholder logic
            && (
                String(f.fichaingresoservicio || '').includes(filterText) ||
                String(f.nombre_empresa || '').toLowerCase().includes(filterText.toLowerCase()) ||
                String(f.nombre_centro || '').toLowerCase().includes(filterText.toLowerCase())
            )
            : true;

        const matchesDate = filterDate
            ? f.fecha_muestreo === filterDate
            || (f.fecha && f.fecha.includes(filterDate))
            : true;

        return matchesText && matchesDate;
    });

    // Pagination Logic
    const totalPages = Math.ceil(filteredFichas.length / itemsPerPage);
    const displayedFichas = filteredFichas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const emptyRows = itemsPerPage - displayedFichas.length;

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    // Style
    const cellStyle: React.CSSProperties = {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        padding: '6px 8px'
    };

    return (
        <div className="fichas-ingreso-container commercial-layout">
            {/* Header */}
            <div className="header-row">
                <button onClick={onBackToMenu} className="btn-back">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Volver al Menú
                </button>
                <h2 className="page-title-geo">Planificación y Asignación</h2>
            </div>

            {/* Top Inputs Section */}
            <div style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex',
                gap: '2rem',
                alignItems: 'end'
            }}>
                <div className="form-group" style={{ flex: '0 0 200px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
                        Selección de Fecha
                    </label>
                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                    />
                </div>

                <div className="form-group" style={{ flex: '1', maxWidth: '400px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
                        Búsqueda (Filtro)
                    </label>
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="responsive-table-container">
                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Cargando asignaciones...</div>
                ) : (
                    <>
                        <table className="compact-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f9fafb', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>N°Ficha</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Estado</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Monitoreo</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>E.Facturar</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>E.Servicio</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Fuente Emisora</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Obj.Muestreo</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Sub Área</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Sync</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap', textAlign: 'center' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody style={{ fontSize: '10px' }}>
                                {displayedFichas.map((row, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', height: '36px' }}>
                                        <td style={{ fontWeight: 600, ...cellStyle }}>{row.fichaingresoservicio || row.id_fichaingresoservicio}</td>

                                        <td style={cellStyle}>
                                            {(() => {
                                                const estado = (row.nombre_estadomuestreo || row.estado_ficha || '').toUpperCase();
                                                let bgColor = '#f3f4f6'; // Default Gray
                                                let textColor = '#4b5563';

                                                if (estado.includes('POR ASIGNAR')) {
                                                    bgColor = '#ffedd5'; // Orange
                                                    textColor = '#c2410c';
                                                } else if (estado.includes('PENDIENTE')) {
                                                    bgColor = '#fee2e2'; // Red
                                                    textColor = '#991b1b';
                                                } else if (estado.includes('EJECUTADO') || estado.includes('VIGENTE') || estado.includes('EMITIDA')) {
                                                    bgColor = '#dcfce7'; // Green
                                                    textColor = '#166534';
                                                }

                                                return (
                                                    <span style={{
                                                        padding: '1px 6px',
                                                        borderRadius: '9999px',
                                                        fontSize: '9px',
                                                        fontWeight: 600,
                                                        backgroundColor: bgColor,
                                                        color: textColor
                                                    }}>
                                                        {row.nombre_estadomuestreo || row.estado_ficha || '-'}
                                                    </span>
                                                );
                                            })()}
                                        </td>

                                        <td style={cellStyle}>{row.nombre_frecuencia || row.frecuencia || '-'}</td>
                                        <td style={cellStyle}>{row.empresa_facturar || '-'}</td>
                                        <td style={cellStyle}>{row.empresa_servicio || row.nombre_empresaservicios || '-'}</td>
                                        <td style={cellStyle}>{row.centro || row.nombre_centro || '-'}</td>
                                        <td style={cellStyle}>{row.nombre_objetivomuestreo_ma || '-'}</td>
                                        <td style={cellStyle}>{row.subarea || row.nombre_subarea || '-'}</td>

                                        <td style={cellStyle}>
                                            <span style={{
                                                padding: '1px 6px',
                                                borderRadius: '9999px',
                                                fontSize: '9px',
                                                fontWeight: 600,
                                                backgroundColor: row.sincronizado === 'S' ? '#dcfce7' : '#fee2e2',
                                                color: row.sincronizado === 'S' ? '#166534' : '#991b1b'
                                            }}>
                                                {row.sincronizado === 'S' ? 'SI' : 'NO'}
                                            </span>
                                        </td>

                                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap', padding: '6px' }}>
                                            <button
                                                title="Asignar"
                                                onClick={() => onViewAssignment(row.id_fichaingresoservicio || row.fichaingresoservicio)}
                                                style={{
                                                    border: 'none',
                                                    background: 'none',
                                                    color: '#8b5cf6',
                                                    cursor: 'pointer',
                                                    padding: '2px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f3ff'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {Array.from({ length: Math.max(0, emptyRows) }).map((_, i) => (
                                    <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #e5e7eb', height: '36px' }}>
                                        <td colSpan={10}>&nbsp;</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="pagination-controls" style={{ marginTop: '0' }}>
                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                Mostrando {filteredFichas.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} a {Math.min(currentPage * itemsPerPage, filteredFichas.length)} de {filteredFichas.length} registros
                            </span>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="pagination-btn" style={{ fontSize: '0.8rem', padding: '4px 10px' }} disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>Anterior</button>
                                <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontSize: '0.85rem', fontWeight: 500 }}>{currentPage}</div>
                                <button className="pagination-btn" style={{ fontSize: '0.8rem', padding: '4px 10px' }} disabled={currentPage === totalPages || totalPages === 0} onClick={() => goToPage(currentPage + 1)}>Siguiente</button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
