import React, { useState, useEffect } from 'react';
import { fichaService } from '../services/ficha.service';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { useToast } from '../../../contexts/ToastContext';
import '../styles/FichasIngreso.css';

interface Props {
    onBackToMenu: () => void;
    onViewDetail: (id: number) => void;
}

export const EnProcesoListView: React.FC<Props> = ({ onBackToMenu, onViewDetail }) => {
    // State
    const [searchId, setSearchId] = useState('');
    const [dateFrom, setDateFrom] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    });
    const [dateTo, setDateTo] = useState(() => {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
    });
    const { showToast } = useToast();

    // Filters
    const [searchTipo, setSearchTipo] = useState('');
    const [searchEmpresaServicio, setSearchEmpresaServicio] = useState('');
    const [searchMuestreador, setSearchMuestreador] = useState('');
    const [searchObjetivo, setSearchObjetivo] = useState('');
    const [searchSubArea, setSearchSubArea] = useState('');

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
                const response = await fichaService.getEnProceso();
                let data = [];
                if (Array.isArray(response)) data = response;
                else if (response && response.data && Array.isArray(response.data)) data = response.data;
                else if (response && Array.isArray(response.recordset)) data = response.recordset;

                setFichas(data || []);
            } catch (error) {
                console.error("Error loading en proceso fichas:", error);
                showToast({ type: 'error', message: 'Error cargando las fichas en proceso.' });
            } finally {
                setLoading(false);
            }
        };

        loadFichas();
    }, [showToast]);

    // Reset to page 1 when any filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchId, dateFrom, dateTo, searchTipo, searchEmpresaServicio, searchMuestreador, searchObjetivo, searchSubArea]);

    // Derived unique values for datalists
    const getUniqueValues = (key: string) => {
        const values = new Set<string>();
        fichas.forEach(f => {
            if (f[key]) values.add(String(f[key]).trim());
        });
        return Array.from(values).sort();
    };

    const uniqueTipos = React.useMemo(() => getUniqueValues('tipo_ficha'), [fichas]);
    const uniqueEmpServicio = React.useMemo(() => getUniqueValues('empresa_servicio'), [fichas]);
    const uniqueMuestreadores = React.useMemo(() => getUniqueValues('muestreador'), [fichas]);
    const uniqueObjetivos = React.useMemo(() => getUniqueValues('objetivo'), [fichas]);
    const uniqueSubAreas = React.useMemo(() => getUniqueValues('subarea'), [fichas]);

    const handleClearFilters = () => {
        setSearchId('');
        setDateFrom(''); // Allowing it to really clear so they can see all if they want
        setDateTo('');
        setSearchTipo('');
        setSearchEmpresaServicio('');
        setSearchMuestreador('');
        setSearchObjetivo('');
        setSearchSubArea('');
    };

    // Filter Logic
    const filteredFichas = fichas.filter(f => {
        const displayId = f.correlativo || f.id || '';
        const matchId = searchId ? String(displayId).includes(searchId) : true;

        const check = (val: string, search: string) => {
            if (!search) return true;
            return (val || '').toString().toLowerCase().includes(search.toLowerCase());
        };

        const matchTipo = check(f.tipo_ficha, searchTipo);
        const matchEmpresaServicio = check(f.empresa_servicio, searchEmpresaServicio);
        const matchMuestreador = check(f.muestreador, searchMuestreador);
        const matchObjetivo = check(f.objetivo, searchObjetivo);
        const matchSubArea = check(f.subarea, searchSubArea);

        let matchDate = true;
        if (dateFrom || dateTo) {
            // f.fecha might come as a DB Date string or string "YYYY-MM-DD"
            // Ensure we handle various formats.
            if (!f.fecha) return false;
            let rowDate: Date;
            if (typeof f.fecha === 'string' && f.fecha.includes('/')) {
                const parts = f.fecha.split('/');
                if (parts.length === 3) {
                    const [d, m, y] = parts;
                    rowDate = new Date(`${y}-${m}-${d}`);
                } else {
                    rowDate = new Date(f.fecha);
                }
            } else {
                rowDate = new Date(f.fecha);
            }
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

        return matchId && matchDate && matchTipo && matchEmpresaServicio && matchMuestreador && matchObjetivo && matchSubArea;
    });

    // Pagination Logic
    const totalPages = Math.ceil(filteredFichas.length / itemsPerPage) || 1;
    const displayedFichas = filteredFichas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
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
        padding: '10px 12px',
        fontSize: '13px'
    };

    const labelStyle: React.CSSProperties = {
        fontSize: '0.7rem',
        fontWeight: 600,
        color: '#374151',
        marginBottom: '2px',
        display: 'block'
    };

    return (
        <div className="fichas-ingreso-container commercial-layout">
            <div className="header-row">
                <button onClick={onBackToMenu} className="btn-back">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Volver al Menú
                </button>
                <h2 className="page-title-geo">Fichas en Proceso</h2>
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
                        <label style={labelStyle}>N° Ficha</label>
                        <input type="text" placeholder="Buscar..." value={searchId} onChange={(e) => setSearchId(e.target.value)} style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.75rem', height: '30px' }} />
                    </div>

                    <div className="form-group">
                        <label style={labelStyle}>Fecha Muestreo Desde</label>
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.75rem', height: '30px' }} />
                    </div>

                    <div className="form-group">
                        <label style={labelStyle}>Fecha Muestreo Hasta</label>
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.75rem', height: '30px' }} />
                    </div>

                    <SearchableSelect
                        label="Tipo Ficha"
                        placeholder="Tipo..."
                        value={searchTipo}
                        onChange={setSearchTipo}
                        options={uniqueTipos.map(val => ({ id: val, nombre: val }))}
                    />

                    <SearchableSelect
                        label="Empresa Servicio"
                        placeholder="Empresa..."
                        value={searchEmpresaServicio}
                        onChange={setSearchEmpresaServicio}
                        options={uniqueEmpServicio.map(val => ({ id: val, nombre: val }))}
                    />

                    <SearchableSelect
                        label="Muestreador"
                        placeholder="Muestreador..."
                        value={searchMuestreador}
                        onChange={setSearchMuestreador}
                        options={uniqueMuestreadores.map(val => ({ id: val, nombre: val }))}
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
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280', fontSize: '15px' }}>Cargando fichas en proceso...</div>
                ) : (
                    <>
                        <table className="compact-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', tableLayout: 'auto' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f9fafb', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>
                                    <th style={{ padding: '12px', whiteSpace: 'nowrap', width: '75px', fontSize: '12px' }}>N° Ficha</th>
                                    <th style={{ padding: '12px', whiteSpace: 'nowrap', width: '95px', fontSize: '12px' }}>Fecha M.</th>
                                    <th style={{ padding: '12px', whiteSpace: 'nowrap', width: '130px', fontSize: '12px' }}>Muestreador</th>
                                    <th style={{ padding: '12px', whiteSpace: 'nowrap', width: '85px', fontSize: '12px' }}>Tipo</th>
                                    <th style={{ padding: '12px', whiteSpace: 'nowrap', fontSize: '12px' }}>Empresa Srv.</th>
                                    <th style={{ padding: '12px', whiteSpace: 'nowrap', fontSize: '12px' }}>Contacto</th>
                                    <th style={{ padding: '12px', whiteSpace: 'nowrap', fontSize: '12px' }}>Objetivo</th>
                                    <th style={{ padding: '12px', whiteSpace: 'nowrap', width: '85px', fontSize: '12px' }}>Sub Área</th>
                                    <th style={{ padding: '12px', whiteSpace: 'nowrap', textAlign: 'center', width: '65px', fontSize: '12px' }}>Acc.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayedFichas.map((ficha, idx) => {
                                    const fechaFormat = ficha.fecha ?
                                        new Date(ficha.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                        : 'Sin Fecha';

                                    return (
                                        <tr key={`${ficha.id}-${idx}`} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                            <td data-label="N° Ficha" style={{ fontWeight: 600, ...cellStyle }}>{ficha.correlativo || ficha.id || '-'}</td>
                                            <td data-label="Fecha M." style={{ ...cellStyle }}>{fechaFormat}</td>
                                            <td data-label="Muestreador" style={cellStyle} title={ficha.muestreador}>{ficha.muestreador || 'Por Asignar'}</td>
                                            <td data-label="Tipo" style={cellStyle} title={ficha.tipo_ficha}>{ficha.tipo_ficha || '-'}</td>
                                            <td data-label="Empresa Srv." style={cellStyle} title={ficha.correo_empresa ? `${ficha.empresa_servicio} - ${ficha.correo_empresa}` : ficha.empresa_servicio}>
                                                {ficha.empresa_servicio || '-'}
                                                {ficha.correo_empresa && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{ficha.correo_empresa}</div>}
                                            </td>
                                            <td data-label="Contacto" style={cellStyle} title={ficha.correo_contacto ? `${ficha.contacto} - ${ficha.correo_contacto}` : ficha.contacto}>
                                                {ficha.contacto || '-'}
                                                {ficha.correo_contacto && <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{ficha.correo_contacto}</div>}
                                            </td>
                                            <td data-label="Objetivo" style={cellStyle} title={ficha.objetivo}>{ficha.objetivo || '-'}</td>
                                            <td data-label="Sub Área" style={cellStyle} title={ficha.subarea}>{ficha.subarea || '-'}</td>
                                            <td data-label="Acciones" style={{ textAlign: 'center', whiteSpace: 'nowrap', padding: '8px' }}>
                                                <button
                                                    title="Gestionar Ficha"
                                                    onClick={() => onViewDetail(ficha.id)}
                                                    style={{
                                                        border: 'none',
                                                        background: 'none',
                                                        color: '#10b981', // Emerald for En proceso
                                                        cursor: 'pointer',
                                                        padding: '2px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d1fae5'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {/* Empty Rows Filling */}
                                {Array.from({ length: Math.max(0, emptyRows) }).map((_, i) => (
                                    <tr key={`empty-${i}`} style={{ borderBottom: '1px solid #e5e7eb', height: '48px' }}>
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
