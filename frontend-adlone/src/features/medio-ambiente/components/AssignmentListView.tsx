import React, { useState, useEffect } from 'react';
import { fichaService } from '../services/ficha.service';
import '../styles/FichasIngreso.css';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';

interface Props {
    onBackToMenu: () => void;
    onViewAssignment: (id: number) => void;
}

export const AssignmentListView: React.FC<Props> = ({ onBackToMenu, onViewAssignment }) => {
    // State
    // State
    const [searchId, setSearchId] = useState('');
    const [searchEstado, setSearchEstado] = useState('');
    const [searchMonitoreo, setSearchMonitoreo] = useState('');
    const [searchEmpresaFacturar, setSearchEmpresaFacturar] = useState('');
    const [searchEmpresaServicio, setSearchEmpresaServicio] = useState('');
    const [searchCentro, setSearchCentro] = useState('');
    const [searchObjetivo, setSearchObjetivo] = useState('');
    const [searchSubArea, setSearchSubArea] = useState('');

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

                // DEBUG: Ver qué datos recibimos para la ficha 70
                const ficha70 = data.find((f: any) => f.id === 70 || f.fichaingresoservicio === '70');
                if (ficha70) {
                    console.log('🔍 DEBUG Ficha 70:', {
                        estado_ficha: ficha70.estado_ficha,
                        nombre_estadomuestreo: ficha70.nombre_estadomuestreo,
                        id_estadomuestreo: ficha70.id_estadomuestreo,
                        allKeys: Object.keys(ficha70)
                    });
                }

            } catch (error) {
                console.error("Error loading fichas for assignment:", error);
            } finally {
                setLoading(false);
            }
        };

        loadFichas();
    }, []);

    // Reset to page 1 when any filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchId, searchEstado, searchMonitoreo, searchEmpresaFacturar, searchEmpresaServicio, searchCentro, searchObjetivo, searchSubArea]);

    // Derived unique values
    const getUniqueValues = (key: string) => {
        const values = new Set<string>();
        fichas.forEach(f => {
            if (f[key]) values.add(String(f[key]).trim());
        });
        return Array.from(values).sort();
    };

    const uniqueEstados = React.useMemo(() => {
        const v1 = getUniqueValues('estado_ficha');
        return v1.length > 0 ? v1 : getUniqueValues('nombre_estadomuestreo');
    }, [fichas]);

    const uniqueMonitoreo = React.useMemo(() => {
        const v1 = getUniqueValues('nombre_frecuencia');
        return v1.length > 0 ? v1 : getUniqueValues('frecuencia');
    }, [fichas]);
    const uniqueEmpFacturar = React.useMemo(() => getUniqueValues('empresa_facturar'), [fichas]);
    // Try both field names for empresa servicio
    const uniqueEmpServicio = React.useMemo(() => {
        const set = new Set<string>();
        fichas.forEach(f => {
            const val = f.empresa_servicio || f.nombre_empresaservicios;
            if (val) set.add(String(val).trim());
        });
        return Array.from(set).sort();
    }, [fichas]);

    // Try both field names for centro
    const uniqueCentros = React.useMemo(() => {
        const set = new Set<string>();
        fichas.forEach(f => {
            const val = f.centro || f.nombre_centro;
            if (val) set.add(String(val).trim());
        });
        return Array.from(set).sort();
    }, [fichas]);

    const uniqueObjetivos = React.useMemo(() => getUniqueValues('nombre_objetivomuestreo_ma'), [fichas]);

    // Try both field names for subarea
    const uniqueSubAreas = React.useMemo(() => {
        const set = new Set<string>();
        fichas.forEach(f => {
            const val = f.subarea || f.nombre_subarea;
            if (val) set.add(String(val).trim());
        });
        return Array.from(set).sort();
    }, [fichas]);

    const handleClearFilters = () => {
        setSearchId('');
        setSearchEstado('');
        setSearchMonitoreo('');
        setSearchEmpresaFacturar('');
        setSearchEmpresaServicio('');
        setSearchCentro('');
        setSearchObjetivo('');
        setSearchSubArea('');
    };

    // Filter Logic
    const filteredFichas = fichas.filter(f => {
        const displayId = f.fichaingresoservicio || f.id_fichaingresoservicio || '';
        const matchId = searchId ? String(displayId).includes(searchId) : true;

        // Helper for check
        const check = (val: string, search: string) => {
            if (!search) return true;
            return (val || '').toString().toLowerCase().includes(search.toLowerCase());
        };

        const matchEstado = check(f.estado_ficha || f.nombre_estadomuestreo, searchEstado);
        const matchMonitoreo = check(f.nombre_frecuencia || f.frecuencia, searchMonitoreo);
        const matchEmpFacturar = check(f.empresa_facturar, searchEmpresaFacturar);
        const matchEmpServicio = check(f.empresa_servicio || f.nombre_empresaservicios, searchEmpresaServicio);
        const matchCentro = check(f.centro || f.nombre_centro, searchCentro);
        const matchObjetivo = check(f.nombre_objetivomuestreo_ma, searchObjetivo);
        const matchSubArea = check(f.subarea || f.nombre_subarea, searchSubArea);

        return matchId && matchEstado && matchMonitoreo && matchEmpFacturar && matchEmpServicio && matchCentro && matchObjetivo && matchSubArea;
    });

    // Sorting Logic: Por Asignar -> Pendiente -> Ejecutado -> Others
    const getStatusPriority = (status: string) => {
        const s = (status || '').toUpperCase();
        if (s.includes('POR ASIGNAR')) return 1;
        if (s.includes('PENDIENTE')) return 2;
        if (s.includes('EJECUTADO') || s.includes('VIGENTE') || s.includes('EMITIDA')) return 3;
        return 4;
    };

    const sortedFichas = [...filteredFichas].sort((a, b) => {
        const statusA = a.estado_ficha || a.nombre_estadomuestreo || '';
        const statusB = b.estado_ficha || b.nombre_estadomuestreo || '';
        return getStatusPriority(statusA) - getStatusPriority(statusB);
    });

    // Pagination Logic
    const totalPages = Math.ceil(sortedFichas.length / itemsPerPage);
    const displayedFichas = sortedFichas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
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

            {/* Filters */}
            <div style={{
                backgroundColor: 'white',
                padding: '1rem',
                borderRadius: '12px',
                marginBottom: '1rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: '0.8rem',
                    alignItems: 'end'
                }}>
                    <div className="form-group">
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#374151', marginBottom: '2px', display: 'block' }}>N° Ficha</label>
                        <input type="text" placeholder="Buscar..." value={searchId} onChange={(e) => setSearchId(e.target.value)} style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.75rem', height: '30px' }} />
                    </div>

                    <SearchableSelect
                        label="Estado"
                        placeholder="Estado..."
                        value={searchEstado}
                        onChange={setSearchEstado}
                        options={uniqueEstados.map(val => ({ id: val, nombre: val }))}
                    />

                    <SearchableSelect
                        label="Monitoreo"
                        placeholder="Frecuencia..."
                        value={searchMonitoreo}
                        onChange={setSearchMonitoreo}
                        options={uniqueMonitoreo.map(val => ({ id: val, nombre: val }))}
                    />

                    <SearchableSelect
                        label="E. Facturar"
                        placeholder="Empresa..."
                        value={searchEmpresaFacturar}
                        onChange={setSearchEmpresaFacturar}
                        options={uniqueEmpFacturar.map(val => ({ id: val, nombre: val }))}
                    />

                    <SearchableSelect
                        label="E. Servicio"
                        placeholder="Empresa..."
                        value={searchEmpresaServicio}
                        onChange={setSearchEmpresaServicio}
                        options={uniqueEmpServicio.map(val => ({ id: val, nombre: val }))}
                    />

                    <SearchableSelect
                        label="Fuente Emisora"
                        placeholder="Centro..."
                        value={searchCentro}
                        onChange={setSearchCentro}
                        options={uniqueCentros.map(val => ({ id: val, nombre: val }))}
                    />

                    <SearchableSelect
                        label="Obj. Muestreo"
                        placeholder="Objetivo..."
                        value={searchObjetivo}
                        onChange={setSearchObjetivo}
                        options={uniqueObjetivos.map(val => ({ id: val, nombre: val }))}
                    />

                    <SearchableSelect
                        label="Sub Área"
                        placeholder="Sub Área..."
                        value={searchSubArea}
                        onChange={setSearchSubArea}
                        options={uniqueSubAreas.map(val => ({ id: val, nombre: val }))}
                    />



                    <div style={{ display: 'flex', alignItems: 'end' }}>
                        <button
                            onClick={handleClearFilters}
                            style={{
                                padding: '5px 10px',
                                height: '30px',
                                width: '100%',
                                backgroundColor: 'white',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                color: '#6b7280',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                fontWeight: 500,
                                fontSize: '0.75rem'
                            }}
                            title="Limpiar Filtros"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                            Limpiar
                        </button>
                    </div>
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
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Frecuencia</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>E.Facturar</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>E.Servicio</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Fuente Emisora</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Obj.Muestreo</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Sub Área</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap', textAlign: 'center' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody style={{ fontSize: '10px' }}>
                                {displayedFichas.map((row, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                        <td style={{ fontWeight: 600, ...cellStyle }}>{row.fichaingresoservicio || row.id_fichaingresoservicio}</td>

                                        <td style={cellStyle}>
                                            {(() => {
                                                const estado = (row.estado_ficha || row.nombre_estadomuestreo || '').toUpperCase();
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
                                                        {row.estado_ficha || row.nombre_estadomuestreo || '-'}
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
                                        <td>&nbsp;</td>
                                        <td>&nbsp;</td>
                                        <td>&nbsp;</td>
                                        <td>&nbsp;</td>
                                        <td>&nbsp;</td>
                                        <td>&nbsp;</td>
                                        <td>&nbsp;</td>
                                        <td>&nbsp;</td>
                                        <td>&nbsp;</td>
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
