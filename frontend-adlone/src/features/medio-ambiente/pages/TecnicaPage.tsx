import React, { useState, useEffect } from 'react';
import { TechnicalDetailView } from '../components/TechnicalDetailView';
import { CatalogosProvider } from '../context/CatalogosContext';
import { ToastProvider } from '../../../contexts/ToastContext';
import { ToastContainer } from '../../../components/Toast/Toast';
import { fichaService } from '../services/ficha.service';
import '../styles/FichasIngreso.css';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';

interface Props {
    onBack: () => void;
}

// --- Technical List Component (Adapted from ConsultarFichasView) ---
const TechnicalListView = ({ onBackToMenu, onViewDetail }: { onBackToMenu: () => void, onViewDetail: (id: number) => void }) => {
    // State
    const [searchId, setSearchId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Filters
    const [searchEstado, setSearchEstado] = useState('');
    const [searchTipo, setSearchTipo] = useState('');
    const [searchEmpresaFacturar, setSearchEmpresaFacturar] = useState('');
    const [searchEmpresaServicio, setSearchEmpresaServicio] = useState('');
    const [searchCentro, setSearchCentro] = useState('');
    const [searchObjetivo, setSearchObjetivo] = useState('');
    const [searchSubArea, setSearchSubArea] = useState('');
    const [searchUsuario, setSearchUsuario] = useState('');
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
                // Fetch All Fichas (Same Service)
                const response = await fichaService.getAll();
                let data = [];
                if (Array.isArray(response)) data = response;
                else if (response && response.data && Array.isArray(response.data)) data = response.data;
                else if (response && Array.isArray(response.recordset)) data = response.recordset;

                setFichas(data || []);

            } catch (error) {
                console.error("Error loading fichas:", error);
            } finally {
                setLoading(false);
            }
        };

        loadFichas();
    }, []);

    // Derived unique values for datalists
    const getUniqueValues = (key: string) => {
        const values = new Set<string>();
        fichas.forEach(f => {
            if (f[key]) values.add(String(f[key]).trim());
        });
        return Array.from(values).sort();
    };

    const uniqueEstados = React.useMemo(() => getUniqueValues('estado_ficha'), [fichas]);
    const uniqueTipos = React.useMemo(() => getUniqueValues('tipo_fichaingresoservicio'), [fichas]);
    const uniqueEmpFacturar = React.useMemo(() => getUniqueValues('empresa_facturar'), [fichas]);
    const uniqueEmpServicio = React.useMemo(() => getUniqueValues('empresa_servicio'), [fichas]);
    const uniqueCentros = React.useMemo(() => getUniqueValues('centro'), [fichas]);
    const uniqueObjetivos = React.useMemo(() => getUniqueValues('nombre_objetivomuestreo_ma'), [fichas]);
    const uniqueSubAreas = React.useMemo(() => getUniqueValues('nombre_subarea'), [fichas]);
    const uniqueUsuarios = React.useMemo(() => getUniqueValues('nombre_usuario'), [fichas]);

    const handleClearFilters = () => {
        setSearchId('');
        setDateFrom('');
        setDateTo('');
        setSearchEstado('');
        setSearchTipo('');
        setSearchEmpresaFacturar('');
        setSearchEmpresaServicio('');
        setSearchCentro('');
        setSearchObjetivo('');
        setSearchSubArea('');
        setSearchUsuario('');
    };

    // Filter Logic
    const filteredFichas = fichas.filter(f => {
        const displayId = f.fichaingresoservicio || f.id_fichaingresoservicio || '';
        const matchId = searchId ? String(displayId).includes(searchId) : true;

        // Helper for case-insensitive check
        const check = (val: string, search: string) => {
            if (!search) return true;
            return (val || '').toString().toLowerCase().includes(search.toLowerCase());
        };

        const matchEstado = check(f.estado_ficha, searchEstado);
        const matchTipo = check(f.tipo_fichaingresoservicio, searchTipo);
        const matchEmpresaFacturar = check(f.empresa_facturar, searchEmpresaFacturar);
        const matchEmpresaServicio = check(f.empresa_servicio, searchEmpresaServicio);
        const matchCentro = check(f.centro, searchCentro);
        const matchObjetivo = check(f.nombre_objetivomuestreo_ma, searchObjetivo);
        const matchSubArea = check(f.nombre_subarea, searchSubArea);
        const matchUsuario = check(f.nombre_usuario, searchUsuario);

        let matchDate = true;
        if (dateFrom || dateTo) {
            if (!f.fecha) return false;
            // Parse dd/mm/yyyy
            const parts = f.fecha.split('/');
            if (parts.length === 3) {
                const [d, m, y] = parts;
                const rowDate = new Date(`${y}-${m}-${d}`);
                rowDate.setHours(0, 0, 0, 0);

                if (dateFrom) {
                    const dFrom = new Date(dateFrom);
                    dFrom.setHours(0, 0, 0, 0);
                    if (rowDate < dFrom) matchDate = false;
                }
                if (dateTo && matchDate) {
                    const dTo = new Date(dateTo);
                    dTo.setHours(0, 0, 0, 0);
                    if (rowDate > dTo) matchDate = false;
                }
            }
        }

        return matchId && matchDate && matchEstado && matchTipo && matchEmpresaFacturar && matchEmpresaServicio && matchCentro && matchObjetivo && matchSubArea && matchUsuario;
    });

    // Pagination Logic
    const totalPages = Math.ceil(filteredFichas.length / itemsPerPage);
    const displayedFichas = filteredFichas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // Calculate empty rows for fixed height
    const emptyRows = itemsPerPage - displayedFichas.length;

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    // Style for cells
    const cellStyle: React.CSSProperties = {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        padding: '6px 8px'
    };

    // Label style
    const labelStyle: React.CSSProperties = {
        fontSize: '0.7rem',
        fontWeight: 600,
        color: '#374151',
        marginBottom: '2px',
        display: 'block'
    };

    return (
        <div className="fichas-ingreso-container commercial-layout">
            {/* Header */}
            <div className="header-row">
                <button onClick={onBackToMenu} className="btn-back">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Volver
                </button>
                <h2 className="page-title-geo">Gestión Técnica</h2>
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

                    <div className="form-group">
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#374151', marginBottom: '2px', display: 'block' }}>Fecha Desde</label>
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.75rem', height: '30px' }} />
                    </div>

                    <div className="form-group">
                        <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#374151', marginBottom: '2px', display: 'block' }}>Fecha Hasta</label>
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.75rem', height: '30px' }} />
                    </div>

                    <SearchableSelect
                        label="Tipo"
                        placeholder="Tipo..."
                        value={searchTipo}
                        onChange={setSearchTipo}
                        options={uniqueTipos.map(val => ({ id: val, nombre: val }))}
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
                        label="Objetivo"
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

                    <SearchableSelect
                        label="Usuario"
                        placeholder="Usuario..."
                        value={searchUsuario}
                        onChange={setSearchUsuario}
                        options={uniqueUsuarios.map(val => ({ id: val, nombre: val }))}
                    />

                    <div className="form-group">
                        <label style={{ ...labelStyle, visibility: 'hidden' }}>Limpiar</label>
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
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Cargando fichas...</div>
                ) : (
                    <>
                        <table className="compact-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f9fafb', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>N° Ficha</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Estado</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Fecha</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Tipo</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>E. Facturar</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>E. Servicio</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Fuente Emisora</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Objetivo</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Sub Área</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap' }}>Usuario</th>
                                    <th style={{ padding: '8px', whiteSpace: 'nowrap', textAlign: 'center' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody style={{ fontSize: '10px' }}>
                                {displayedFichas.map((ficha, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                        <td data-label="N° Ficha" style={{ fontWeight: 600, ...cellStyle }}>{ficha.fichaingresoservicio || '-'}</td>
                                        <td data-label="Estado" style={{ ...cellStyle, whiteSpace: 'normal', overflow: 'visible', textOverflow: 'clip', minWidth: '120px' }}>
                                            <span style={{
                                                padding: '1px 6px',
                                                borderRadius: '9999px',
                                                fontSize: '9px',
                                                fontWeight: 600,
                                                backgroundColor: (() => {
                                                    const est = (ficha.estado_ficha || '').toUpperCase();
                                                    if (est.includes('RECHAZADA')) return '#fee2e2'; // Rojo
                                                    if (est.includes('PENDIENTE TÉCNICA')) return '#fef3c7'; // Amarillo/Naranja
                                                    if (est.includes('PENDIENTE COORDINACIÓN')) return '#dbeafe'; // Azul
                                                    if (est.includes('REVISAR')) return '#fee2e2'; // Rojo
                                                    if (est.includes('EN PROCESO')) return '#dcfce7'; // Verde
                                                    if (est.includes('BORRADOR')) return '#f3f4f6'; // Gris
                                                    if (est.includes('VIGENTE')) return '#dcfce7'; // Verde (Legacy)
                                                    return '#f3f4f6'; // Default Gris
                                                })(),
                                                color: (() => {
                                                    const est = (ficha.estado_ficha || '').toUpperCase();
                                                    if (est.includes('RECHAZADA')) return '#991b1b';
                                                    if (est.includes('PENDIENTE TÉCNICA')) return '#92400e';
                                                    if (est.includes('PENDIENTE COORDINACIÓN')) return '#1e40af';
                                                    if (est.includes('REVISAR')) return '#991b1b';
                                                    if (est.includes('EN PROCESO')) return '#166534';
                                                    if (est.includes('BORRADOR')) return '#4b5563';
                                                    if (est.includes('VIGENTE')) return '#166534';
                                                    return '#4b5563';
                                                })()
                                            }}>
                                                {ficha.estado_ficha || '-'}
                                            </span>
                                        </td>
                                        <td data-label="Fecha" style={cellStyle}>{ficha.fecha || '-'}</td>
                                        <td data-label="Tipo" style={cellStyle}>{ficha.tipo_fichaingresoservicio || '-'}</td>

                                        <td data-label="E. Facturar" style={cellStyle} title={ficha.empresa_facturar}>{ficha.empresa_facturar || '-'}</td>
                                        <td data-label="E. Servicio" style={cellStyle} title={ficha.empresa_servicio}>{ficha.empresa_servicio || '-'}</td>
                                        <td data-label="Fuente Emisora" style={cellStyle} title={ficha.centro}>{ficha.centro || '-'}</td>
                                        <td data-label="Objetivo" style={cellStyle} title={ficha.nombre_objetivomuestreo_ma}>{ficha.nombre_objetivomuestreo_ma || '-'}</td>
                                        <td data-label="Sub Área" style={cellStyle} title={ficha.nombre_subarea}>{ficha.nombre_subarea || '-'}</td>

                                        <td data-label="Usuario" style={cellStyle}>{ficha.nombre_usuario || '-'}</td>
                                        <td data-label="Acciones" style={{ textAlign: 'center', whiteSpace: 'nowrap', padding: '6px' }}>
                                            <button
                                                title="Gestionar Ficha"
                                                onClick={() => onViewDetail(ficha.id_fichaingresoservicio || ficha.fichaingresoservicio)}
                                                style={{
                                                    border: 'none',
                                                    background: 'none',
                                                    color: '#3b82f6',
                                                    cursor: 'pointer',
                                                    padding: '2px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#eff6ff'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                {/* Edit/Manage Icon instead of Eye? Eye is fine for View/Audit */}
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {/* Empty Rows Filling */}
                                {Array.from({ length: Math.max(0, emptyRows) }).map((_, i) => (
                                    <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #e5e7eb', height: '36px' }}>
                                        <td colSpan={11}>&nbsp;</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination Controls */}
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

// --- Main Orchestrator ---
const TecnicaPageContent: React.FC<Props> = ({ onBack }) => {
    const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
    const [selectedFichaId, setSelectedFichaId] = useState<number | null>(null);

    const handleViewDetail = (id: number) => {
        setSelectedFichaId(id);
        setViewMode('detail');
    };

    if (viewMode === 'list') {
        return (
            <TechnicalListView
                onBackToMenu={onBack}
                onViewDetail={handleViewDetail}
            />
        );
    }

    if (viewMode === 'detail' && selectedFichaId) {
        return (
            <TechnicalDetailView
                fichaId={selectedFichaId}
                onBack={() => setViewMode('list')}
            />
        );
    }

    return null;
};

// --- Export with Providers ---
export const TecnicaPage: React.FC<Props> = (props) => {
    return (
        <ToastProvider>
            <CatalogosProvider>
                <TecnicaPageContent {...props} />
            </CatalogosProvider>
            <ToastContainer />
        </ToastProvider>
    );
};
