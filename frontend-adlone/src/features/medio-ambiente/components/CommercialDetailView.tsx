import React, { useEffect, useState, useRef, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { ObservacionesForm } from './ObservacionesForm';
import { ObservationTimeline } from './ObservationTimeline';
import { AntecedentesForm, type AntecedentesFormHandle } from './AntecedentesForm'; // Import Form
import { AnalysisForm } from './AnalysisForm'; // Import Form
import { ConfirmModal } from '../../../components/common/ConfirmModal'; // Import ConfirmModal
import { useToast } from '../../../contexts/ToastContext';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import { useAuth } from '../../../contexts/AuthContext'; // Import Auth
import '../styles/FichasIngreso.css';

interface Props {
    fichaId: number;
    onBack: () => void;
}

const mapToAntecedentes = (enc: any, agenda: any) => {
    if (!enc) return {};
    // Ensure agenda is at least an empty object if undefined
    agenda = agenda || {};

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

    // Normalize input string (handle both DB field names)
    const rawInst = (enc.instrumento_ambiental || enc.ma_instrumento_ambiental || '').trim();

    if (rawInst && rawInst !== 'No aplica') {
        const upper = rawInst.toUpperCase();

        if (upper.startsWith('RCA')) selInst = 'RCA';
        else if (upper.startsWith('RES. EX') || upper.startsWith('RES EX') || upper.startsWith('RESOLUCION EX')) selInst = 'Res. Ex.';
        else if (upper.startsWith('DECRETO')) selInst = 'Decreto';
        else if (upper.startsWith('CARTA')) selInst = 'Carta';
        else selInst = 'Otro';

        // Extract Number/Year
        // If it was mapped to a type, remove that type prefix to get the number
        // For 'Otro', the whole string is the number/desc
        let rest = rawInst;
        if (selInst !== 'Otro') {
            // Basic removal of the detected prefix (case insensitive-ish)
            if (selInst === 'Res. Ex.') rest = rawInst.replace(/^Res\.?\s*Ex(enta)?\.?\s*(N°)?/i, '').trim();
            else if (selInst === 'RCA') rest = rawInst.replace(/^RCA\s*(N°)?/i, '').trim();
            else if (selInst === 'Decreto') rest = rawInst.replace(/^Decreto\s*(N°)?/i, '').trim();
            else if (selInst === 'Carta') rest = rawInst.replace(/^Carta\s*(N°)?/i, '').trim();
        }

        const splitSlash = rest.split('/');
        if (splitSlash.length === 2) {
            nroInst = splitSlash[0].trim();
            anioInst = splitSlash[1].trim();
        } else {
            nroInst = rest;
        }
    } else if (rawInst === 'No aplica') {
        selInst = 'No aplica';
    }

    return {
        // Form: selectedEmpresa refers to "Empresa Servicio" catalog
        selectedEmpresa: enc.id_empresaservicios,

        // Form: selectedCliente refers to "Cliente" catalog (DB: id_empresa is usually the client)
        selectedCliente: enc.id_empresa,

        // Form: selectedFuente refers to "Centro" catalog
        selectedFuente: enc.id_centro,

        // If contact is not in ENC, might be in a join or not returned. 
        // Assuming we might need to fetch or it's just id_contacto if it exists.
        selectedContacto: enc.id_contacto || '',

        // Form: selectedObjetivo
        selectedObjetivo: enc.id_objetivomuestreo_ma,

        selectedComponente: enc.id_tipomuestra,
        selectedSubArea: enc.id_subarea,

        // Instrument
        selectedInstrumento: selInst || enc.ma_instrumento_ambiental || '',
        nroInstrumento: nroInst || enc.ma_nro_instrumento || '',
        anioInstrumento: anioInst || enc.ma_anio_instrumento || '',

        selectedInspector: agenda.id_inspectorambiental || enc.id_inspectorambiental || '',

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

        // FREQUENCY FIX: Read from Agenda or Enc defaults
        frecuencia: agenda.frecuencia || enc.frecuencia || enc.ma_frecuencia,
        totalServicios: agenda.total_servicios || enc.total_servicios || enc.total_servicios_ma,
        factor: agenda.frecuencia_factor || enc.frecuencia_factor,
        periodo: agenda.id_frecuencia || enc.id_frecuencia,

        // Missing Fields (Monitoreo, Lugar, Punto, Coords)
        tipoMonitoreo: enc.tipo_fichaingresoservicio || '',
        selectedLugar: enc.id_lugaranalisis || '',
        puntoMuestreo: enc.ma_punto_muestreo || '',
        zona: zona || '', // These were parsed at the top but not returned
        utmNorte: utmNorte || '',
        utmEste: utmEste || '',
        glosa: enc.nombre_tabla || enc.nombre_tabla_largo || enc.glosa || enc.ma_nombre_tabla || ''
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

    // New: Ref for Observation Form to allow adding comments during edit
    // New: State for Observation Form during edit
    const [newObservation, setNewObservation] = useState('');

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

    const [showCancelModal, setShowCancelModal] = useState(false);
    // const { user } = useAuth(); // Unused


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
        // Fix: 'data' is the flat object containing Encabezado fields + agenda + detalles
        // passing data.encabezado was undefined, causing empty mapping.
        mappedInitialDataRef.current = mapToAntecedentes(data, data.agenda);


        // 3. Set state to trigger edit mode
        setAnalysisList(mappedAnalysis);
        setNewObservation(''); // Reset new observation explicitly
        setIsEditing(true);
        setActiveTab('antecedentes');
    };

    // CANCEL EDIT
    const handleCancelEdit = () => {
        // Use custom modal instead of window.confirm
        setShowCancelModal(true);
    };

    const confirmCancelEdit = () => {
        setIsEditing(false);
        setAnalysisList([]);
        setNewObservation('');
        mappedInitialDataRef.current = null; // Clear the ref
        setShowCancelModal(false);
        // Optional: Reload data to be safe?
        // loadData(); // Not strictly necessary if we didn't mutate 'data' state directly
    };

    // SAVE CHANGES
    const handleSaveChanges = async () => {
        // We need data from AntecedentesForm. 
        // If the user hasn't visited the Antecedentes tab since clicking Edit, the Ref might be null (if conditional rendering).
        // I will change the render logic below to keep AntecedentesForm mounted (hidden) if isEditing is true.

        if (!fichaId) return;

        if (!antecedentesRef.current) {
            // Should not happen if we fix render logic
            showToast({ type: 'error', message: 'Error: Formulario de antecedentes no inicializado.' });
            return;
        }

        // Validation: Mandatory Observation
        if (!newObservation || !newObservation.trim()) {
            showToast({ type: 'error', message: 'Debe ingresar una observación (En pestaña Validación) para guardar los cambios.' });
            // Switch to Observaciones tab to show the field
            setActiveTab('observaciones');
            return;
        }

        const antData = antecedentesRef.current.getData();

        // If newObs is empty, we don't send it or send empty string? 
        // Backend handles empty string as "no change" or "empty observation".
        // But we want to log it if present.

        const payload = {
            antecedentes: antData,
            analisis: analysisList,
            observaciones: newObservation // Send specific new observation for history
        };

        try {
            setLoading(true);
            const response = await fichaService.update(fichaId, payload);
            if (response && response.success) {
                showToast({ type: 'success', message: 'Ficha actualizada correctamente' });
                setIsEditing(false);
                setNewObservation('');
                loadData(); // Reload fresh data
                // Redirect to List (as requested)
                if (onBack) onBack();
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

    // Helper function to get status styles
    const getStatusStyle = (status: string) => {
        const upperStatus = (status || '').toUpperCase();

        // Default
        let bg = '#f3f4f6'; // Gray-100
        let color = '#4b5563'; // Gray-600

        if (upperStatus.includes('RECHAZADA') || upperStatus.includes('ANULADA') || upperStatus.includes('REVISAR')) {
            bg = '#fee2e2'; color = '#991b1b'; // Red
        } else if (upperStatus.includes('COORDINACIÓN')) {
            bg = '#dbeafe'; color = '#1e40af'; // Blue
        } else if (upperStatus.includes('PROGRAMACIÓN')) { // Specific check before generic PENDIENTE
            bg = '#ede9fe'; color = '#5b21b6'; // Purple
        } else if (upperStatus.includes('PENDIENTE') || upperStatus.includes('ÁREA TÉCNICA')) {
            bg = '#fef3c7'; color = '#92400e'; // Amber/Orange
        } else if (upperStatus.includes('ASIGNAR')) {
            bg = '#ffedd5'; color = '#c2410c'; // Orange Intense
        } else if (upperStatus.includes('VIGENTE') || upperStatus.includes('APROBADA') || upperStatus.includes('EJECUTADO') || upperStatus.includes('EN PROCESO')) {
            bg = '#dcfce7'; color = '#166534'; // Green
        } else if (upperStatus.includes('BORRADOR')) {
            bg = '#f3f4f6'; color = '#4b5563'; // Gray
        }

        return { backgroundColor: bg, color };
    };

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
            <div className="header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                {/* LEFT SIDE: Back + Title + Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={onBack} className="btn-back" disabled={isEditing && loading} style={{ margin: 0 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                        Volver
                    </button>

                    <h2 className="page-title-geo" style={{ margin: 0 }}>Ficha N° {enc.fichaingresoservicio} {isEditing ? '(Edición)' : ''}</h2>

                    {(() => {


                        return (
                            <span style={{
                                ...getStatusStyle(enc.estado_ficha),
                                fontSize: '0.85rem',
                                padding: '2px 8px',
                                borderRadius: '999px',
                                fontWeight: 600
                            }}>
                                {(() => {
                                    const txt = enc.estado_ficha || '-';
                                    return txt.toLowerCase().split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                                })()}
                            </span>
                        );
                    })()}
                </div>

                {/* RIGHT SIDE: Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {isEditing ? (
                        <>
                            <button
                                onClick={handleSaveChanges}
                                disabled={loading}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    opacity: loading ? 0.6 : 1,
                                    boxShadow: '0 1px 2px rgba(16, 185, 129, 0.2)',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    if (!loading) {
                                        e.currentTarget.style.backgroundColor = '#059669';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#10b981';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                                {loading ? 'Descargando...' : 'Guardar'}
                            </button>
                            <button
                                onClick={handleCancelEdit}
                                disabled={loading}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#f3f4f6',
                                    color: '#374151',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
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
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                                    padding: '6px 12px',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 1px 2px rgba(59, 130, 246, 0.2)',
                                    transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#2563eb';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#3b82f6';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                                Editar
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs-container">
                <button className={`tab-button ${activeTab === 'antecedentes' ? 'active' : ''}`} onClick={() => setActiveTab('antecedentes')}>Antecedentes</button>
                <button className={`tab-button ${activeTab === 'analisis' ? 'active' : ''}`} onClick={() => setActiveTab('analisis')}>Análisis</button>
                <button className={`tab-button ${activeTab === 'observaciones' ? 'active' : ''}`} onClick={() => setActiveTab('observaciones')}>Observaciones / Validación</button>
            </div>

            <div className="tab-content-areaWrapper" style={{ padding: '0.5rem' }}>
                <div className="tab-content-area" style={{ display: 'block' }}>

                    {/* ANTECEDENTES TAB */}
                    {/* If editing, we keep it mounted (via display style) if active or just always if editing? 
                        To persist form state, we MUST keep it mounted.
                        So: If isEditing, always render AntecedentesForm, toggle display: none.
                    */}
                    {/* ANTECEDENTES TAB - EDIT MODE (Keep mounted to preserve Ref) */}
                    {isEditing && (
                        <div style={{ display: activeTab === 'antecedentes' ? 'flex' : 'none', flexDirection: 'column', gap: '1rem' }}>
                            <AntecedentesForm
                                key="antecedentes-edit-form"
                                ref={antecedentesRef}
                                initialData={mappedInitialDataRef.current}
                            />

                            {/* Removed duplicate observations form and buttons from here */}
                        </div>
                    )}

                    {/* ANTECEDENTES TAB - VIEW MODE */}
                    {!isEditing && activeTab === 'antecedentes' && (
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

                            {/* Block 2: Frecuencia */}
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
                            <ObservationTimeline
                                fichaId={fichaId}
                                creationData={timelineCreationData}
                            />

                            {/* New Observation Field for Edit Mode */}
                            {isEditing && (
                                <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#166534', marginBottom: '1rem' }}>
                                        Nueva Observación (Obligatorio para guardar)
                                    </h3>
                                    <ObservacionesForm
                                        label="Ingrese el motivo del cambio o nueva observación:"
                                        value={newObservation}
                                        onChange={setNewObservation}
                                        readOnly={false}
                                        placeholder="Escriba aquí los detalles de la edición..."
                                    />
                                </div>
                            )}

                            {!isEditing && (
                                <div style={{ marginTop: '2rem', borderTop: '1px solid #e5e7eb', paddingTop: '2rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#374151', marginBottom: '1rem' }}>Observaciones Actuales</h3>
                                    <ObservacionesForm
                                        label="Observaciones Comercial / Atención Cliente"
                                        value={enc.observaciones_comercial}
                                        onChange={() => { }}
                                        readOnly={true} // Always Read Only here as edit is main form
                                    />
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
            {/* Confirm Modal */}
            <ConfirmModal
                isOpen={showCancelModal}
                title="Descartar cambios"
                message="¿Estás seguro de que deseas cancelar la edición? Los cambios no guardados se perderán."
                onConfirm={confirmCancelEdit}
                onCancel={() => setShowCancelModal(false)}
            />
        </div >
    );
}
