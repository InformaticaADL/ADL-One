import React, { useEffect, useState, useRef, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { ObservacionesForm } from './ObservacionesForm';
import { ObservationTimeline } from './ObservationTimeline';
import { AntecedentesForm, type AntecedentesFormHandle } from './AntecedentesForm'; // Import Form
import { AnalysisForm } from './AnalysisForm'; // Import Form
import { useToast } from '../../../contexts/ToastContext';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import { useAuth } from '../../../contexts/AuthContext'; // Import Auth
import '../styles/FichasIngreso.css';

interface Props {
    fichaId: number;
    onBack: () => void;
}

const mapToAntecedentes = (enc: any) => {
    if (!enc) return {};

    // Parse Coordinates
    let zona = '', utmNorte = '', utmEste = '';
    const coordStr = enc.ma_coordenadas || '';
    const coordMatch = coordStr.match(/^(.*?) UTM (\d+)E (\d+)S/);
    if (coordMatch) {
        zona = coordMatch[1];
        utmNorte = coordMatch[2];
        utmEste = coordMatch[3];
    } else {
        const parts = coordStr.split(' ');
        zona = parts[0] || '';
    }

    // Parse Instrumento
    let selInst = '';
    let nroInst = '';
    let anioInst = '';
    if (enc.instrumento_ambiental && enc.instrumento_ambiental !== 'No aplica') {
        if (enc.instrumento_ambiental.startsWith('RCA')) selInst = 'RCA';
        else if (enc.instrumento_ambiental.startsWith('Res. Ex.')) selInst = 'Res. Ex.';
        else if (enc.instrumento_ambiental.startsWith('Decreto')) selInst = 'Decreto';
        else if (enc.instrumento_ambiental.startsWith('Carta')) selInst = 'Carta';
        else selInst = 'Otro';

        const rest = enc.instrumento_ambiental.replace(selInst, '').trim();
        const splitSlash = rest.split('/');
        if (splitSlash.length === 2) {
            nroInst = splitSlash[0];
            anioInst = splitSlash[1];
        } else {
            nroInst = rest;
        }
    } else if (enc.instrumento_ambiental === 'No aplica') {
        selInst = 'No aplica';
    }

    return {
        tipoMonitoreo: enc.tipo_fichaingresoservicio,
        selectedLugar: enc.id_lugaranalisis,
        selectedEmpresa: enc.id_empresaservicio,
        selectedCliente: enc.id_empresa,
        selectedFuente: enc.id_centro,
        selectedContacto: enc.id_contacto,
        cliente_entrega: enc.cliente_entrega,
        selectedObjetivo: enc.id_objetivomuestreo_ma,

        // Address fields (will be auto-populated by useEffect[selectedFuente] if empty)
        ubicacion: enc.ubicacion || '',
        comuna: enc.comuna || enc.nombre_comuna || '',
        region: enc.region || enc.nombre_region || '',
        tipoAgua: enc.tipo_agua || enc.nombre_tipoagua || '',
        idTipoAgua: enc.id_tipoagua,
        codigo: enc.codigo || enc.codigo_centro || '',

        glosa: enc.nombre_tabla_largo,
        esETFA: enc.etfa === 'S' ? 'Si' : 'No',

        puntoMuestreo: enc.ma_punto_muestreo,
        zona, utmNorte, utmEste,

        selectedComponente: enc.id_tipomuestra,
        selectedSubArea: enc.id_subarea,

        selectedInstrumento: selInst,
        nroInstrumento: nroInst,
        anioInstrumento: anioInst,

        selectedInspector: enc.id_inspectorambiental || '',

        responsableMuestreo: enc.responsablemuestreo,
        cargoResponsable: enc.id_cargo,

        selectedTipoMuestreo: enc.id_tipomuestreo,
        selectedTipoMuestra: enc.id_tipomuestra_ma,
        selectedActividad: enc.id_actividadmuestreo,
        duracion: enc.ma_duracion_muestreo,
        selectedTipoDescarga: enc.id_tipodescarga,
        refGoogle: enc.referencia_googlemaps,
        medicionCaudal: enc.medicion_caudal,
        selectedModalidad: enc.id_modalidad,
        formaCanal: enc.id_formacanal,
        detalleCanal: enc.formacanal_medida,
        dispositivo: enc.id_dispositivohidraulico,
        detalleDispositivo: enc.dispositivohidraulico_medida,

        frecuencia: enc.frecuencia,
        totalServicios: enc.total_servicios,
        factor: enc.frecuencia_factor, // Fixed: was frecuenciaFactor
        periodo: enc.id_frecuencia
    };
};

export const CommercialDetailView: React.FC<Props> = ({ fichaId, onBack }) => {
    const { showToast } = useToast();
    const catalogos = useCachedCatalogos();
    const { hasPermission } = useAuth(); // Auth hook

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'antecedentes' | 'analisis' | 'observaciones'>('antecedentes');
    const [data, setData] = useState<any>(null);
    const [laboratorios, setLaboratorios] = useState<any[]>([]);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [analysisList, setAnalysisList] = useState<any[]>([]); // For Analysis Edit
    const antecedentesRef = useRef<AntecedentesFormHandle>(null);

    // Store mapped initial data in a ref to prevent re-creation on every render
    // This ref is ONLY updated when entering edit mode (in handleEditStart)
    const mappedInitialDataRef = useRef<any>(null);

    // Memoize timeline creation data (MOVED TO TOP LEVEL TO AVOID HOOK ORDER VIOLATION)
    const timelineCreationData = useMemo(() => {
        if (!data) return undefined;
        return {
            date: data.fecha_fichacomercial || new Date().toISOString(),
            user: data.responsablemuestreo || 'Comercial',
            observation: data.observaciones_comercial || ''
        };
    }, [data]);

    useEffect(() => {
        loadData();
    }, [fichaId]);

    const loadData = async () => {
        if (!fichaId) return;
        setLoading(true);
        try {
            // Parallel fetch: Ficha data + Labs catalog
            const [fichaResponse, labsData] = await Promise.all([
                fichaService.getById(fichaId),
                catalogos.getLaboratorios()
            ]);

            // Handle different response structures for Ficha
            let fichaData = null;
            if (fichaResponse && fichaResponse.success && fichaResponse.data) {
                fichaData = fichaResponse.data;
            } else if (fichaResponse && fichaResponse.encabezado) {
                fichaData = fichaResponse;
            } else if (fichaResponse && fichaResponse.fichaingresoservicio) {
                fichaData = fichaResponse;
            }

            if (fichaData) {
                setData(fichaData);
            } else {
                showToast({ type: 'error', message: 'No se pudo cargar la ficha (datos inválidos)' });
            }

            setLaboratorios(labsData || []);

        } catch (error) {
            console.error("Error loading ficha or catalogs:", error);
            showToast({ type: 'error', message: "Error al cargar datos" });
        } finally {
            setLoading(false);
        }
    };

    // Helper to get Lab Name
    const getLabName = (id: any) => {
        if (!id) return null;
        const lab = laboratorios.find(l => l.id_laboratorioensayo === id || l.id_laboratorioensayo === Number(id));
        return lab ? lab.nombre_laboratorioensayo : null;
    };

    // START EDIT MODE
    const handleEditStart = () => {
        if (!data) return;

        // 1. Prepare Analysis Data
        // Map current 'det' to 'savedAnalysis' format
        const currentDet = data.detalles || [];
        const mappedAnalysis = currentDet.map((row: any, index: number) => ({
            ...row,
            savedId: `edit - ${index} -${Date.now()} `, // Temporary ID for frontend key
            // Ensure fields match what AnalysisForm expects
            nombre_tecnica: row.nombre_tecnica || row.nombre_determinacion || row.nombre_examen,
            tipo_analisis: row.tipo_analisis || row.nombre_tipomuestra, // Fallback if name is used
            nombre_tipoentrega: row.nombre_tipoentrega,
            nombre_laboratorioensayo: getLabName(row.id_laboratorioensayo),
            nombre_laboratorioensayo_2: getLabName(row.id_laboratorioensayo_2),
            // Ensure numeric IDs are set
            id_normativa: row.id_normativa,
            id_referenciaanalisis: row.id_referenciaanalisis,
            id_tecnica: row.id_tecnica,
            item: index + 1
        }));

        // 2. Map Antecedentes data ONCE and store in ref BEFORE setting isEditing
        // This ensures the ref is populated when AntecedentesForm first renders
        console.log('🔍 Raw DB values for frecuencia:', {
            frecuencia: data.encabezado?.frecuencia,
            frecuencia_factor: data.encabezado?.frecuencia_factor,
            id_frecuencia: data.encabezado?.id_frecuencia,
            total_servicios: data.encabezado?.total_servicios
        });
        console.log('🔍 Raw DB values for instrumento:', {
            ma_instrumento_ambiental: data.encabezado?.ma_instrumento_ambiental
        });

        mappedInitialDataRef.current = mapToAntecedentes(data);
        console.log('📋 Mapped initial data for edit mode:', mappedInitialDataRef.current);

        // 3. Set state to trigger edit mode
        setAnalysisList(mappedAnalysis);
        setIsEditing(true);
        // Reset Tab to Antecedentes to ensure ref is mounted when form renders?
        // Or keep current tab. AntecedentesForm will mount when tab is active.
        // Better to force 'antecedentes' if user clicks edit? No, let them stay.
        // BUT: antecedentesRef.current will be null if tab is not 'antecedentes'.
        // So when saving, we must ensure Antecedentes tab is mounted or data is captured.
        // Actually, Component unmounts when tab changes. This is bad for persistence during tab switch in Edit Mode.
        // FIX: In Creation, we used 'display: none' style to keep all tabs mounted.
        // Here, we use conditional rendering `activeTab === ...`.
        // To support editing across tabs, we should switch to `display: none` or store state in parent.
        // Since I'm refactoring, let's switch to `display: block / none` style for the content areas in Edit Mode
        // OR simpler: Just force user to save per tab? No, "Edit Ficha" implies whole ficha.
        // I will change the Tab rendering to keep components alive but hidden.
    };

    // CANCEL EDIT
    const handleCancelEdit = () => {
        setIsEditing(false);
        setAnalysisList([]);
        mappedInitialDataRef.current = null; // Clear the ref
        // Optional: Reload data to be safe?
        // loadData(); // Not strictly necessary if we didn't mutate 'data' state directly
    };

    // SAVE CHANGES
    const handleSaveChanges = async () => {
        // We need data from AntecedentesForm. 
        // If the user hasn't visited the Antecedentes tab since clicking Edit, the Ref might be null (if conditional rendering).
        // I will change the render logic below to keep AntecedentesForm mounted (hidden) if isEditing is true.

        if (!antecedentesRef.current) {
            // Should not happen if we fix render logic
            showToast({ type: 'error', message: 'Error: Formulario de antecedentes no inicializado.' });
            return;
        }

        const antData = antecedentesRef.current.getData();
        const obs = data.observaciones_comercial || ''; // Or if we allow editing obs here? usually handled in history.
        // We will keep obs as is or let AntecedentesForm handle it if it has an Obs field (it doesn't, mainly specific fields).
        // Actually AntecedentesForm doesn't have "Observaciones Comercial" big text area, that's usually separate.
        // We'll trust Encabezado update for the main fields.

        const payload = {
            antecedentes: antData,
            analisis: analysisList,
            observaciones: obs // If we add an input for this later
        };

        try {
            setLoading(true);
            const response = await fichaService.update(fichaId, payload);
            if (response && response.success) {
                showToast({ type: 'success', message: 'Ficha actualizada correctamente' });
                setIsEditing(false);
                loadData(); // Reload fresh data
            } else {
                showToast({ type: 'error', message: response.message || 'Error al actualizar ficha' });
            }
        } catch (error) {
            console.error('Update error:', error);
            showToast({ type: 'error', message: 'Excepción al guardar cambios' });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-container-fullscreen">
                <div className="text-gray-500 font-medium">Cargando ficha {fichaId}...</div>
            </div>
        );
    }

    if (!data) return null;

    // Destructure based on the flat structure from SP
    const enc = data;
    const det = data.detalles || [];
    // Observations are on enc directly now

    // Helper Component for Static Fields
    const StaticField = ({ label, value, fullWidth = false }: { label: string, value: any, fullWidth?: boolean }) => (
        <div className={`form - group ${fullWidth ? 'col-span-full' : ''} `} style={{ width: '100%', minWidth: 0 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
                {label}
            </label>
            <div style={{
                padding: '6px 10px',
                fontSize: '0.85rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                minHeight: '34px',
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                overflow: 'hidden',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                    {value || '-'}
                </span>
            </div>
        </div>
    );

    // Determines if we should show the "Edit" button
    const canEdit = hasPermission('MA_COMERCIAL_EDITAR') && !isEditing;

    return (
        <div className="fichas-ingreso-container commercial-layout">
            <div className="header-row">
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={onBack} className="btn-back" disabled={isEditing && loading}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                        Volver
                    </button>
                    {/* EDIT ACTION BUTTONS */}
                    {isEditing ? (
                        <>
                            <button
                                onClick={handleSaveChanges}
                                disabled={loading}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    opacity: loading ? 0.6 : 1,
                                    boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    if (!loading) {
                                        e.currentTarget.style.backgroundColor = '#059669';
                                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#10b981';
                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.2)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                {loading ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                            <button
                                onClick={handleCancelEdit}
                                disabled={loading}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#f3f4f6',
                                    color: '#374151',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '8px',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    opacity: loading ? 0.6 : 1,
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    if (!loading) {
                                        e.currentTarget.style.backgroundColor = '#e5e7eb';
                                        e.currentTarget.style.borderColor = '#9ca3af';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                                    e.currentTarget.style.borderColor = '#d1d5db';
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                                Cancelar
                            </button>
                        </>
                    ) : (
                        canEdit && (
                            <button
                                onClick={handleEditStart}
                                style={{
                                    padding: '10px 20px',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#2563eb';
                                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.3)';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#3b82f6';
                                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.2)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                                Editar Ficha
                            </button>
                        )
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
                    <h2 className="page-title-geo">Ficha N° {enc.fichaingresoservicio} {isEditing ? '(Edición)' : ''}</h2>
                    <span style={{
                        fontSize: '0.85rem',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        backgroundColor: (enc.estado_ficha || '').includes('VIGENTE') ? '#dcfce7' : '#fee2e2',
                        color: (enc.estado_ficha || '').includes('VIGENTE') ? '#166534' : '#991b1b',
                        fontWeight: 600
                    }}>
                        {enc.estado_ficha}
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs-container">
                <button className={`tab - button ${activeTab === 'antecedentes' ? 'active' : ''} `} onClick={() => setActiveTab('antecedentes')}>Antecedentes</button>
                <button className={`tab - button ${activeTab === 'analisis' ? 'active' : ''} `} onClick={() => setActiveTab('analisis')}>Análisis</button>
                <button className={`tab - button ${activeTab === 'observaciones' ? 'active' : ''} `} onClick={() => setActiveTab('observaciones')}>Observaciones / Validación</button>
            </div>

            <div className="tab-content-areaWrapper" style={{ padding: '0.5rem' }}>
                <div className="tab-content-area" style={{ display: 'block' }}>

                    {/* ANTECEDENTES TAB */}
                    {/* If editing, we keep it mounted (via display style) if active or just always if editing? 
                        To persist form state, we MUST keep it mounted.
                        So: If isEditing, always render AntecedentesForm, toggle display: none.
                    */}
                    {isEditing ? (
                        <div style={{ display: activeTab === 'antecedentes' ? 'block' : 'none' }}>
                            <AntecedentesForm ref={antecedentesRef} initialData={mappedInitialDataRef.current} />
                        </div>
                    ) : (
                        activeTab === 'antecedentes' && (
                            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr' }}>
                                <div className="form-grid-row grid-cols-4">
                                    <StaticField label="Monitoreo agua/RIL" value={enc.tipo_fichaingresoservicio} />
                                    <StaticField label="Base de operaciones" value={enc.nombre_lugaranalisis} />
                                    <StaticField label="Empresa a Facturar" value={enc.nombre_empresa} />
                                    <StaticField label="Empresa de servicio" value={enc.nombre_empresaservicios} />
                                </div>

                                <div className="form-grid-row grid-cols-4">
                                    <StaticField label="Fuente Emisora" value={enc.nombre_centro} />
                                    <StaticField label="Ubicación" value={enc.ubicacion} />
                                    <StaticField label="Comuna" value={enc.nombre_comuna} />
                                    <StaticField label="Región" value={enc.nombre_region} />
                                </div>

                                <div className="form-grid-row grid-cols-4">
                                    <StaticField label="Tipo de agua" value={enc.nombre_tipoagua || enc.tipo_agua} />
                                    <StaticField label="Código" value={enc.codigo_centro} />
                                    <StaticField label="Contacto empresa" value={enc.nombre_contacto} />
                                    <StaticField label="Objetivo del Muestreo" value={enc.nombre_objetivomuestreo_ma} />
                                </div>

                                <div className="form-grid-row grid-cols-1">
                                    <StaticField label="Tabla" value={enc.nombre_tabla_largo} fullWidth />
                                </div>

                                <div className="form-grid-row grid-cols-4">
                                    <StaticField label="¿Es ETFA?" value={enc.etfa === 'S' || enc.etfa === true ? 'Si' : 'No'} />
                                    {/* Updated to use enc.agenda?.nombre_inspector */}
                                    <StaticField label="Inspector Ambiental" value={enc.agenda?.nombre_inspector || '-'} />
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <StaticField label="Punto de Muestreo" value={enc.ma_punto_muestreo} fullWidth />
                                    </div>
                                </div>

                                <div className="form-grid-row grid-cols-4">
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <StaticField label="Zona / Coordenadas" value={enc.ma_coordenadas || (enc.coordenadas_ruta ? `Ruta: ${enc.coordenadas_ruta} ` : '')} fullWidth />
                                    </div>
                                </div>

                                {/* Block 2: Frecuencia - Updated to use enc.agenda fields */}
                                <div style={{ marginTop: '1rem', marginBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}></div>
                                <div className="form-grid-row grid-cols-4">
                                    <StaticField label="Frecuencia" value={enc.agenda?.frecuencia || '-'} />
                                    <StaticField label="Periodo" value={enc.agenda?.nombre_frecuencia || '-'} />
                                    <StaticField label="Multiplicado Por" value={enc.agenda?.frecuencia_factor || '-'} />
                                    <StaticField label="Total Servicios" value={enc.agenda?.total_servicios || '-'} />
                                </div>

                                {/* Block 3: Detalles Muestra */}
                                <div style={{ marginTop: '1rem', marginBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}></div>
                                <div className="form-grid-row grid-cols-3">
                                    <StaticField label="Componente Ambiental" value={enc.nombre_tipomuestra} />
                                    <StaticField label="Sub Área" value={enc.nombre_subarea} />
                                    <StaticField label="Instrumento Ambiental" value={enc.instrumento_ambiental} />
                                </div>

                                {/* Block 4: Responsable */}
                                <div style={{ marginTop: '1rem', marginBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}></div>
                                <div className="form-grid-row grid-cols-4">
                                    <StaticField label="Responsable Muestreo" value={enc.responsablemuestreo} />
                                    <StaticField label="Cargo Responsable" value={enc.nombre_cargo} />
                                </div>

                                <div className="form-grid-row grid-cols-5">
                                    <StaticField label="Tipo Muestreo" value={enc.nombre_tipomuestreo} />
                                    <StaticField label="Tipo Muestra" value={enc.nombre_tipomuestra_ma} />
                                    <StaticField label="Actividad" value={enc.nombre_actividadmuestreo} />
                                    <StaticField label="Duración Muestreo" value={enc.ma_duracion_muestreo} />
                                    <StaticField label="Tipo Descarga" value={enc.nombre_tipodescarga} />
                                </div>

                                <div className="form-grid-row grid-cols-4">
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <StaticField label="Referencia Google Maps" value={enc.referencia_googlemaps} fullWidth />
                                    </div>
                                    <StaticField label="¿Medición Caudal?" value={enc.medicion_caudal} />
                                    <StaticField label="Modalidad" value={enc.nombre_modalidad} />
                                </div>

                                {/* Block 5: Hidraulica */}
                                <div style={{ marginTop: '1rem', marginBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}></div>
                                <div className="form-grid-row grid-cols-4">
                                    <StaticField label="Forma del Canal" value={enc.nombre_formacanal} />
                                    <StaticField label="Detalle (Medidas)" value={enc.formacanal_medida} />
                                    <StaticField label="Dispositivo Hidráulico" value={enc.nombre_dispositivohidraulico} />
                                    <StaticField label="Detalle (Medidas)" value={enc.dispositivohidraulico_medida} />
                                </div>
                            </div>
                        )
                    )}

                    {/* ANALISIS TAB */}
                    {activeTab === 'analisis' && (
                        isEditing ? (
                            <AnalysisForm
                                savedAnalysis={analysisList}
                                onSavedAnalysisChange={setAnalysisList}
                            />
                        ) : (
                            <div>
                                {/* Same Layout as AnalysisForm Top Section */}
                                <div className="analysis-top-section" style={{
                                    display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', marginBottom: '1.5rem',
                                    padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white'
                                }}>
                                    <div className="form-grid-row grid-cols-2">
                                        <StaticField label="Normativa Seleccionada" value={det[0]?.nombre_normativa} />
                                        <StaticField label="Referencia Seleccionada" value={det[0]?.nombre_normativareferencia || det[0]?.nombre_referencia} />
                                    </div>
                                </div>

                                <div className="analysis-bottom-section" style={{
                                    padding: '1.5rem',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    background: 'white',
                                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                                }}>
                                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#374151' }}>
                                        Análisis Solicitados ({det.length})
                                    </h3>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                            <thead style={{ backgroundColor: '#f9fafb' }}>
                                                <tr>
                                                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Análisis</th>
                                                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tipo Muestra</th>
                                                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Límite Min</th>
                                                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Límite Max</th>
                                                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Error</th>
                                                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Error Min</th>
                                                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Error Max</th>
                                                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Tipo Entrega</th>
                                                    <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #e5e7eb' }}>Valor U.F.</th>
                                                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Lab. Principal</th>
                                                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Lab. Secundario</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {det.map((row: any, i: number) => {
                                                    const analysisName = row.nombre_tecnica || row.nombre_determinacion || row.nombre_examen || row.nombre_analisis || '-';

                                                    // Resolve Names
                                                    const labPrincipalName = getLabName(row.id_laboratorioensayo);

                                                    // Check both possible property names for secondary lab
                                                    const idLab2 = row.id_laboratorioensayo_2 || row.id_laboratorioensayo2;
                                                    const labSecundarioName = getLabName(idLab2);

                                                    const tipoMuestra = row.nombre_tipomuestra || row.tipo_analisis || row.tipo_muestra || row.tipomuestra || '-';

                                                    return (
                                                        <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                                            <td style={{ padding: '8px' }}>{analysisName}</td>
                                                            <td style={{ padding: '8px' }}>{tipoMuestra}</td>
                                                            <td style={{ padding: '8px', textAlign: 'right' }}>{row.limitemax_d}</td>
                                                            <td style={{ padding: '8px', textAlign: 'right' }}>{row.limitemax_h}</td>
                                                            <td style={{ padding: '8px', textAlign: 'right' }}>{row.llevaerror || row.llevaerror === 'S' || row.llevaerror === true ? 'Sí' : 'No'}</td>
                                                            <td style={{ padding: '8px', textAlign: 'right' }}>{row.error_min}</td>
                                                            <td style={{ padding: '8px', textAlign: 'right' }}>{row.error_max}</td>
                                                            <td style={{ padding: '8px' }}>{row.nombre_tipoentrega || '-'}</td>
                                                            <td style={{ padding: '8px', textAlign: 'right' }}>{row.uf_individual}</td>
                                                            <td style={{ padding: '8px' }}>
                                                                {labPrincipalName || (row.id_laboratorioensayo ? 'Enviado' : 'Interno')}
                                                            </td>
                                                            <td style={{ padding: '8px' }}>
                                                                {labSecundarioName || (idLab2 ? 'Enviado (Sec)' : '-')}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                                {det.length === 0 && (
                                                    <tr>
                                                        <td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                                                            No hay análisis registrados para esta ficha.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )
                    )}

                    {/* OBSERVACIONES TAB - Timeline Layout */}
                    {/* Hide Observaciones when editing if we don't want to show it. Or show read-only */}
                    {activeTab === 'observaciones' && (
                        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#374151', marginBottom: '1rem' }}>Línea de Tiempo</h3>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#374151', marginBottom: '1rem' }}>Línea de Tiempo</h3>
                            <ObservationTimeline
                                fichaId={fichaId}
                                creationData={timelineCreationData}
                            />

                            <div style={{ marginTop: '2rem', borderTop: '1px solid #e5e7eb', paddingTop: '2rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#374151', marginBottom: '1rem' }}>Observaciones Actuales</h3>
                                <ObservacionesForm
                                    label="Observaciones Comercial / Atención Cliente"
                                    value={enc.observaciones_comercial}
                                    onChange={() => { }}
                                    readOnly={true} // Always Read Only here as edit is main form
                                />
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div >
    );
}
