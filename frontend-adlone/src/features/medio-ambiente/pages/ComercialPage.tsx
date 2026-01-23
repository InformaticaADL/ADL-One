import React, { useState, useRef, useEffect } from 'react';
import { AntecedentesForm } from '../components/AntecedentesForm';
import type { AntecedentesFormHandle } from '../components/AntecedentesForm';
import { AnalysisForm } from '../components/AnalysisForm';
import { ObservacionesForm } from '../components/ObservacionesForm';
import { CommercialDetailView } from '../components/CommercialDetailView';
import { CatalogosProvider } from '../context/CatalogosContext';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos'; // Import Hook
import { ToastProvider, useToast } from '../../../contexts/ToastContext';
import { ToastContainer } from '../../../components/Toast/Toast';
import { fichaService } from '../services/ficha.service';
import '../styles/FichasIngreso.css'; // Ensure CSS is imported

interface Props {
    onBack: () => void;
}

// Inline Success Modal Component
const SuccessModal = ({
    isOpen,
    onClose,
    fichaId
}: {
    isOpen: boolean;
    onClose: () => void;
    fichaId: number | null
}) => {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '400px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                <div style={{
                    width: '60px',
                    height: '60px',
                    backgroundColor: '#dcfce7',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    color: '#16a34a'
                }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
                    ¡Ficha Creada Exitosamente!
                </h3>
                <p style={{ color: '#374151', marginBottom: '24px' }}>
                    Se ha generado la Ficha N° <strong>{fichaId}</strong> correctamente en el sistema.
                </p>
                <button
                    onClick={onClose}
                    style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: '#16a34a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '1rem',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#15803d'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
                >
                    Aceptar y Volver
                </button>
            </div>
        </div>
    );
};

// --- Commercial Form Component ---
const CommercialForm = ({ onBackToMenu }: { onBackToMenu: () => void }) => {
    const { showToast } = useToast();

    // Estado de la pestaña activa
    const [activeTab, setActiveTab] = useState<'antecedentes' | 'analisis' | 'observaciones'>('antecedentes');

    // Estado persistente del formulario
    const [observaciones, setObservaciones] = useState('');

    // Lifted State for Analysis
    const [savedAnalysis, setSavedAnalysis] = useState<any[]>([]);

    // State for Success Modal
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [createdFichaId, setCreatedFichaId] = useState<number | null>(null);

    // Ref for Antecedentes Form
    const antecedentesRef = useRef<AntecedentesFormHandle>(null);

    const handleSave = async () => {
        try {
            // 1. Get Data from Antecedentes
            const antData = antecedentesRef.current?.getData();

            // Helper to validate Antecedentes
            const validateAntecedentes = (data: any) => {
                const requiredFields = [
                    { key: 'selectedLugar', label: 'Base de Operaciones' },
                    { key: 'selectedEmpresa', label: 'Empresa a Facturar' },
                    { key: 'selectedCliente', label: 'Empresa de Servicio' },
                    { key: 'selectedContacto', label: 'Contacto empresa' },
                    { key: 'responsableMuestreo', label: 'Responsable Muestreo' },
                    { key: 'cargoResponsable', label: 'Cargo Responsable' }
                ];

                for (const field of requiredFields) {
                    if (!data || !data[field.key] || String(data[field.key]).trim() === '') {
                        return `Falta completar: ${field.label}`;
                    }
                }
                return null;
            };

            const antError = validateAntecedentes(antData);
            if (antError) {
                showToast({ type: 'error', message: antError });
                setActiveTab('antecedentes');
                return;
            }

            // 2. Validate Analysis
            if (savedAnalysis.length === 0) {
                showToast({ type: 'warning', message: 'Debes ingresar al menos un análisis' });
                setActiveTab('analisis');
                return;
            }

            // 3. Prepare Payload
            const payload = {
                antecedentes: antData,
                analisis: savedAnalysis,
                observaciones: observaciones,
                user: { id: 1 }
            };

            // 4. Call Service
            const result = await fichaService.create(payload);

            if (result && (result.success || result.data?.success)) {
                const idToUse = result.data?.id || result.id;
                if (idToUse) {
                    setCreatedFichaId(Number(idToUse));
                    setShowSuccessModal(true);
                } else {
                    showToast({ type: 'warning', message: 'Ficha creada pero no se recibió un ID válido.' });
                }
            } else {
                showToast({ type: 'error', message: 'Error al respuesta del servidor' });
            }

        } catch (error: any) {
            console.error("Error saving ficha:", error);
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al grabar la ficha' });
        }
    };

    const handleCloseSuccess = () => {
        setShowSuccessModal(false);
        setCreatedFichaId(null);
        onBackToMenu(); // Go back to menu after success
    };

    return (
        <div className="fichas-ingreso-container commercial-layout">
            <SuccessModal
                isOpen={showSuccessModal}
                onClose={handleCloseSuccess}
                fichaId={createdFichaId}
            />

            {/* Header Row */}
            <div className="header-row">
                <button onClick={onBackToMenu} className="btn-back">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Volver al Menú
                </button>
                <h2 className="page-title-geo">Nueva Ficha Comercial</h2>
            </div>

            {/* Navegación por Pestañas */}
            <div className="tabs-container">
                <button
                    className={`tab-button ${activeTab === 'antecedentes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('antecedentes')}
                >
                    Antecedentes
                </button>
                <button
                    className={`tab-button ${activeTab === 'analisis' ? 'active' : ''}`}
                    onClick={() => setActiveTab('analisis')}
                >
                    Análisis
                </button>
                <button
                    className={`tab-button ${activeTab === 'observaciones' ? 'active' : ''}`}
                    onClick={() => setActiveTab('observaciones')}
                >
                    Observaciones
                </button>
            </div>

            {/* Contenido Dinámico */}
            <div className="tab-content-area">
                <div className="fade-in" style={{ display: activeTab === 'antecedentes' ? 'block' : 'none' }}>
                    <AntecedentesForm ref={antecedentesRef} />
                </div>

                <div className="fade-in" style={{ display: activeTab === 'analisis' ? 'block' : 'none' }}>
                    <AnalysisForm
                        savedAnalysis={savedAnalysis}
                        onSavedAnalysisChange={setSavedAnalysis}
                    />
                </div>

                <div className="fade-in" style={{ display: activeTab === 'observaciones' ? 'block' : 'none' }}>
                    <ObservacionesForm
                        value={observaciones}
                        onChange={setObservaciones}
                    />
                </div>
            </div>

            {/* Acciones */}
            <div className="form-actions">
                <button className="btn-save" onClick={handleSave}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1-2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    Grabar Ficha
                </button>
            </div>
        </div>
    );
};

// --- Menu Selection Component ---
const CommercialMenu = ({ onCreate, onConsult, onBack }: { onCreate: () => void, onConsult: () => void, onBack: () => void }) => {
    return (
        <div className="fichas-ingreso-container commercial-layout">
            <div className="header-row">
                <button onClick={onBack} className="btn-back">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Volver
                </button>
                <h2 className="page-title-geo">Gestión Comercial</h2>
            </div>

            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem'
            }}>
                <h1 style={{ fontSize: '1.8rem', color: '#1f2937', marginBottom: '3rem', fontWeight: 600 }}>
                    Seleccione una opción
                </h1>

                <div className="cards-grid" style={{ width: '100%', maxWidth: '900px' }}>
                    {/* Nueva Ficha Card */}
                    <div
                        onClick={onCreate}
                        className="selection-card"
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-5px)';
                            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                            e.currentTarget.style.borderColor = '#3b82f6';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                        }}
                    >
                        <div className="card-icon" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                        </div>
                        <h3 className="card-title">Nueva Ficha</h3>
                        <p className="card-description">Crear una nueva solicitud de análisis desde cero.</p>
                    </div>

                    {/* Consultar Ficha Card */}
                    <div
                        onClick={onConsult}
                        className="selection-card"
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-5px)';
                            e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)';
                            e.currentTarget.style.borderColor = '#8b5cf6';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                        }}
                    >
                        <div className="card-icon" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>
                        <h3 className="card-title">Consultar Fichas</h3>
                        <p className="card-description">Buscar, visualizar y gestionar fichas existentes.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// --- Consultar Fichas Component (Updated with Backend Logic & SP Columns) ---
const ConsultarFichasView = ({ onBackToMenu, onViewDetail }: { onBackToMenu: () => void, onViewDetail: (id: number) => void }) => {
    // Hooks


    // State
    const [searchId, setSearchId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
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
                // Fetch Fichas directly (SP returns mapped names)
                const response = await fichaService.getAll();
                let data = [];
                // Check format
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



    const handleClearFilters = () => {
        setSearchId('');
        setDateFrom('');
        setDateTo('');
    };

    // Filter Logic
    const filteredFichas = fichas.filter(f => {
        const displayId = f.fichaingresoservicio || f.id_fichaingresoservicio || '';
        const matchId = searchId ? String(displayId).includes(searchId) : true;

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

        return matchId && matchDate;
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

    // Style for cells: No wrap, small font, ellipsis on overflow
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
                <h2 className="page-title-geo">Consultar Fichas Comerciales</h2>
            </div>

            {/* Filters */}
            <div style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'end',
                flexWrap: 'wrap'
            }}>
                <div className="form-group" style={{ flex: '0 0 120px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
                        N° Ficha
                    </label>
                    <input
                        type="text"
                        placeholder="Ej: 105"
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                    />
                </div>

                <div className="form-group" style={{ flex: '0 0 140px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
                        Fecha Desde
                    </label>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                    />
                </div>

                <div className="form-group" style={{ flex: '0 0 140px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
                        Fecha Hasta
                    </label>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                    />
                </div>

                <div style={{ flex: '0 0 auto', paddingBottom: '1px', display: 'flex', gap: '0.5rem' }}>
                    <button
                        onClick={handleClearFilters}
                        style={{
                            padding: '6px 10px',
                            height: '34px',
                            backgroundColor: 'white',
                            border: '1px solid #d1d5db',
                            borderRadius: '0.5rem',
                            color: '#6b7280',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontWeight: 500,
                            fontSize: '0.85rem'
                        }}
                        title="Limpiar Filtros"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
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
                                    <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb', height: '36px' }}>
                                        <td data-label="N° Ficha" style={{ fontWeight: 600, ...cellStyle }}>{ficha.fichaingresoservicio || '-'}</td>
                                        <td data-label="Estado" style={cellStyle}>
                                            <span style={{
                                                padding: '1px 6px',
                                                borderRadius: '9999px',
                                                fontSize: '9px',
                                                fontWeight: 600,
                                                backgroundColor: (ficha.estado_ficha || '').includes('Borrador') ? '#f3f4f6' : (ficha.estado_ficha || '').includes('Emitida') || (ficha.estado_ficha || '').includes('VIGENTE') ? '#dcfce7' : '#fee2e2',
                                                color: (ficha.estado_ficha || '').includes('Borrador') ? '#4b5563' : (ficha.estado_ficha || '').includes('Emitida') || (ficha.estado_ficha || '').includes('VIGENTE') ? '#166534' : '#991b1b'
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
                                                title="Ver Detalle"
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
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
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
const ComercialPageContent: React.FC<Props> = ({ onBack }) => {
    const [viewMode, setViewMode] = useState<'menu' | 'create' | 'consult' | 'consult-detail'>('menu');
    const [selectedFichaId, setSelectedFichaId] = useState<number | null>(null);

    const handleViewDetail = (id: number) => {
        setSelectedFichaId(id);
        setViewMode('consult-detail');
    };

    if (viewMode === 'menu') {
        return (
            <CommercialMenu
                onCreate={() => setViewMode('create')}
                onConsult={() => setViewMode('consult')}
                onBack={onBack}
            />
        );
    }

    if (viewMode === 'create') {
        return <CommercialForm onBackToMenu={() => setViewMode('menu')} />;
    }

    if (viewMode === 'consult') {
        return (
            <ConsultarFichasView
                onBackToMenu={() => setViewMode('menu')}
                onViewDetail={handleViewDetail}
            />
        );
    }

    if (viewMode === 'consult-detail' && selectedFichaId) {
        return (
            <CommercialDetailView
                fichaId={selectedFichaId}
                onBack={() => setViewMode('consult')}
            />
        );
    }

    return null;
};

// --- Export with Providers ---
export const ComercialPage: React.FC<Props> = (props) => {
    return (
        <ToastProvider>
            {/* CatalogosProvider moved here to share context between Form and Consult View */}
            <CatalogosProvider>
                <ComercialPageContent {...props} />
            </CatalogosProvider>
            <ToastContainer />
        </ToastProvider>
    );
};
