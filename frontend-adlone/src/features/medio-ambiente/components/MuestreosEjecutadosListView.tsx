import React, { useState, useEffect } from 'react';
import { fichaService } from '../services/ficha.service';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { useToast } from '../../../contexts/ToastContext';

interface Props {
    onBackToMenu: () => void;
    onViewDetail: (id: number) => void;
}

export const MuestreosEjecutadosListView: React.FC<Props> = ({ onBackToMenu, onViewDetail }) => {
    const { showToast } = useToast();
    const [muestreos, setMuestreos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchCorrelativo, setSearchCorrelativo] = useState('');
    const [searchCliente, setSearchCliente] = useState('');
    const [searchMuestreador, setSearchMuestreador] = useState('');
    const [searchObjetivo, setSearchObjetivo] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        const loadMuestreos = async () => {
            setLoading(true);
            try {
                const response = await fichaService.getMuestreosEjecutados();
                let data = [];
                if (Array.isArray(response)) data = response;
                else if (response && response.data && Array.isArray(response.data)) data = response.data;
                else if (response && Array.isArray(response.recordset)) data = response.recordset;

                setMuestreos(data || []);
            } catch (error) {
                console.error("Error loading muestreos ejecutados:", error);
                showToast({ type: 'error', message: "Error al cargar los muestreos ejecutados" });
            } finally {
                setLoading(false);
            }
        };

        loadMuestreos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchCorrelativo, searchCliente, searchMuestreador, searchObjetivo]);

    // Derived unique values for datalists
    const getUniqueValues = (key: string) => {
        const values = new Set<string>();
        muestreos.forEach(m => {
            if (m[key]) values.add(String(m[key]).trim());
        });
        return Array.from(values).sort();
    };

    const uniqueClientes = React.useMemo(() => getUniqueValues('cliente'), [muestreos]);
    const uniqueMuestreadores = React.useMemo(() => getUniqueValues('muestreador'), [muestreos]);
    const uniqueObjetivos = React.useMemo(() => getUniqueValues('objetivo'), [muestreos]);

    const handleClearFilters = () => {
        setSearchCorrelativo('');
        setSearchCliente('');
        setSearchMuestreador('');
        setSearchObjetivo('');
    };

    const filteredMuestreos = muestreos.filter(m => {
        const check = (val: string, search: string) => {
            if (!search) return true;
            return (val || '').toString().toLowerCase().includes(search.toLowerCase());
        };
        const matchCorr = check(m.frecuencia_correlativo, searchCorrelativo);
        const matchCliente = check(m.cliente, searchCliente);
        const matchMues = check(m.muestreador, searchMuestreador);
        const matchObj = check(m.objetivo, searchObjetivo);

        return matchCorr && matchCliente && matchMues && matchObj;
    });

    const totalPages = Math.ceil(filteredMuestreos.length / itemsPerPage);
    const displayedMuestreos = filteredMuestreos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const emptyRows = itemsPerPage - displayedMuestreos.length;

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const handleDownloadPdf = async (e: React.MouseEvent, idFicha: number) => {
        e.stopPropagation();
        try {
            if (!idFicha) {
                showToast({ type: 'error', message: "No se pudo obtener el ID de la ficha" });
                return;
            }
            showToast({ type: 'info', message: "Generando reporte PDF..." });
            const pdfBlob = await fichaService.downloadPdf(idFicha);
            const url = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Ficha_${idFicha}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error al descargar PDF:", error);
            showToast({ type: 'error', message: "Error al descargar el PDF" });
        }
    };

    const handleComingSoon = (feature: string) => {
        showToast({ type: 'info', message: `${feature}: Funcionalidad próximamente disponible` });
    };

    const cellStyle: React.CSSProperties = {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        padding: '6px'
    };

    return (
        <div className="fichas-ingreso-container commercial-layout">
            <div className="header-row" style={{ display: 'flex', position: 'relative', justifyContent: 'center', alignItems: 'center', marginBottom: '1.5rem' }}>
                <button onClick={onBackToMenu} className="btn-back" style={{ position: 'absolute', left: 0, margin: 0 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Volver al Menú
                </button>
                <h2 className="page-title-geo" style={{ margin: 0 }}>Muestreos Completados</h2>
            </div>

            {/* Filters */}
            <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', alignItems: 'end' }}>
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Correlativo</label>
                        <input type="text" placeholder="Ej: 99-1-Ejecutado..." value={searchCorrelativo} onChange={(e) => setSearchCorrelativo(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.8rem', height: '34px' }} />
                    </div>
                    <SearchableSelect label="Cliente" placeholder="Todos" value={searchCliente} onChange={setSearchCliente} options={uniqueClientes.map(val => ({ id: val, nombre: val }))} />
                    <SearchableSelect label="Muestreador" placeholder="Todos" value={searchMuestreador} onChange={setSearchMuestreador} options={uniqueMuestreadores.map(val => ({ id: val, nombre: val }))} />
                    <SearchableSelect label="Objetivo" placeholder="Todos" value={searchObjetivo} onChange={setSearchObjetivo} options={uniqueObjetivos.map(val => ({ id: val, nombre: val }))} />
                    
                    <div className="form-group" style={{ display: 'flex' }}>
                        <button onClick={handleClearFilters} style={{ padding: '6px 12px', height: '34px', width: '100%', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '6px', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 500, fontSize: '0.8rem' }} title="Limpiar Filtros">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                            Limpiar
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="responsive-table-container">
                {loading ? (
                    <div style={{ padding: '4rem', textAlign: 'center', color: '#6b7280', fontSize: '1.2rem' }}>Cargando muestreos ejecutados...</div>
                ) : (
                    <>
                        <table className="compact-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f9fafb', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Correlativo</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Fecha M.</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Cliente</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Fuente Emisora</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>SubÁrea / Objetivo</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Muestreador</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap', textAlign: 'center' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedMuestreos.map((m, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                        <td style={{ fontWeight: 600, ...cellStyle }} title={m.frecuencia_correlativo}>{m.frecuencia_correlativo || '-'}</td>
                                        <td style={cellStyle}>{m.fecha_muestreo ? new Date(m.fecha_muestreo).toLocaleDateString('es-CL', { timeZone: 'UTC' }) : '-'}</td>
                                        <td style={cellStyle} title={m.cliente}>{m.cliente || '-'}</td>
                                        <td style={cellStyle} title={m.centro}>{m.centro || '-'}</td>
                                        <td style={cellStyle} title={`${m.nombre_subarea} - ${m.objetivo}`}>{m.nombre_subarea} - {m.objetivo}</td>
                                        <td style={cellStyle} title={m.muestreador}>{m.muestreador || 'Sin Asignar'}</td>
                                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap', padding: '6px', display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                            <button
                                                title="Ver Datos (Ficha)"
                                                onClick={() => onViewDetail(m.id_fichaingresoservicio || m.correlativo_ficha)}
                                                style={{ border: 'none', background: '#f3f4f6', color: '#4b5563', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#e5e7eb'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f3f4f6'; }}
                                            >
                                                📊 Datos
                                            </button>
                                            <button
                                                title="Descargar Informe PDF"
                                                onClick={(e) => handleDownloadPdf(e, m.id_fichaingresoservicio || m.correlativo_ficha)}
                                                style={{ border: 'none', background: '#fee2e2', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fecaca'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; }}
                                            >
                                                📄 Informe
                                            </button>
                                            <button
                                                title="Ver Fotos"
                                                onClick={() => handleComingSoon("Fotos")}
                                                style={{ border: '1px dashed #d1d5db', background: 'transparent', color: '#9ca3af', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                📷 Fotos
                                            </button>
                                            <button
                                                title="Historial de Envío"
                                                onClick={() => handleComingSoon("Detalles de Envío")}
                                                style={{ border: '1px dashed #d1d5db', background: 'transparent', color: '#9ca3af', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                                            >
                                                ✉️ Envío
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {/* Empty Rows Filling */}
                                {Array.from({ length: Math.max(0, emptyRows) }).map((_, i) => (
                                    <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #e5e7eb', height: '45px' }}>
                                        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        <div className="pagination-controls" style={{ marginTop: '0', padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                                Mostrando {filteredMuestreos.length > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0} a {Math.min(currentPage * itemsPerPage, filteredMuestreos.length)} de {filteredMuestreos.length} muestreos
                            </span>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="pagination-btn" style={{ fontSize: '0.8rem', padding: '4px 10px' }} disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>Anterior</button>
                                <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>{currentPage}</div>
                                <button className="pagination-btn" style={{ fontSize: '0.8rem', padding: '4px 10px' }} disabled={currentPage === totalPages || totalPages === 0} onClick={() => goToPage(currentPage + 1)}>Siguiente</button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
