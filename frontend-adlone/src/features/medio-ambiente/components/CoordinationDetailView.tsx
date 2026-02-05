import React, { useEffect, useState } from 'react';
import { fichaService } from '../services/ficha.service';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import { WorkflowAlert } from '../../../components/ui/WorkflowAlert';
import '../styles/FichasIngreso.css';

interface Props {
    fichaId: number;
    initialTab?: 'antecedentes' | 'analisis' | 'agenda' | 'observaciones';
    onBack: () => void;
}

export const CoordinationDetailView: React.FC<Props> = ({ fichaId, initialTab = 'antecedentes', onBack }) => {
    const { showToast } = useToast();
    const { user } = useAuth();
    const {
        getInspectores
    } = useCachedCatalogos();

    // State
    const [loading, setLoading] = useState(true);
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'antecedentes' | 'analisis' | 'observaciones'>(initialTab as any || 'antecedentes');
    const [data, setData] = useState<any>(null);

    // Editable State (Coordination)
    const [coordObs, setCoordObs] = useState('');
    const [selectedMuestreador, setSelectedMuestreador] = useState<number | ''>('');
    const [fechaMuestreo, setFechaMuestreo] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Status Validation
    const [fichaStatus, setFichaStatus] = useState<number | null>(null);

    useEffect(() => {
        const loadFicha = async () => {
            if (!fichaId) return;
            setLoading(true);
            try {
                const response = await fichaService.getById(fichaId);
                const fichaData = response.data || response;
                setData(fichaData);

                // Store status for validation
                if (fichaData.encabezado?.id_validaciontecnica !== undefined) {
                    setFichaStatus(fichaData.encabezado.id_validaciontecnica);
                }

                // Load initial values
                if (fichaData.observaciones?.coordinador) {
                    setCoordObs(fichaData.observaciones.coordinador);
                }

                // Pre-fill Agenda if valid (assuming check enc fields)
                if (fichaData.encabezado) {
                    if (fichaData.encabezado.id_muestreador) setSelectedMuestreador(fichaData.encabezado.id_muestreador);

                    // Format date to yyyy-MM-dd
                    if (fichaData.encabezado.fecha_muestreo) {
                        const d = new Date(fichaData.encabezado.fecha_muestreo);
                        if (!isNaN(d.getTime())) {
                            const year = d.getFullYear();
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            setFechaMuestreo(`${year}-${month}-${day}`);
                        }
                    }
                }

                // Load Muestreadores
                try {
                    const inspectoresData = await getInspectores();
                    setMuestreadores(inspectoresData || []);
                } catch (catError) {
                    console.error("Error loading muestreadores:", catError);
                }

            } catch (error) {
                console.error("Error loading ficha:", error);
                showToast({ type: 'error', message: "Error al cargar ficha" });
            } finally {
                setLoading(false);
            }
        };

        loadFicha();
    }, [fichaId]);

    const handleSaveAgenda = async () => {
        if (!selectedMuestreador || !fechaMuestreo) {
            showToast({ type: 'warning', message: 'Debe seleccionar Muestreador y Fecha' });
            return;
        }

        setActionLoading(true);
        try {
            // Guarda Agenda + Observaciones
            await fichaService.updateAgenda(fichaId, {
                idMuestreador: selectedMuestreador,
                fecha: fechaMuestreo,
                observaciones: coordObs
            });

            showToast({ type: 'success', message: 'Ficha aceptada y asignada correctamente' });
        } catch (error) {
            console.error(error);
            showToast({ type: 'error', message: 'Error al actualizar agenda' });
        } finally {
            setActionLoading(false);
        }
    };

    // Keep standalone save if needed, or just use handleSaveAgenda for the "Aceptar" button
    const handleAccept = async () => {
        if (!window.confirm('¿Está seguro de ACEPTAR la Ficha Comercial?')) return;
        setActionLoading(true);
        try {
            await fichaService.approveCoordinacion(fichaId, {
                observaciones: coordObs,
                user: { id: user?.id || 0 }
            });
            showToast({ type: 'success', message: 'ACEPTADA la Ficha Comercial y enviado correo' });
            setTimeout(() => {
                onBack();
            }, 1500);
        } catch (error) {
            console.error(error);
            showToast({ type: 'error', message: 'Error al aceptar ficha' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleReview = async () => {
        if (!window.confirm('¿Está seguro en enviar a REVISIÓN la Ficha Comercial a Jefatura Técnica?')) return;
        setActionLoading(true);
        try {
            await fichaService.reviewCoordinacion(fichaId, {
                observaciones: coordObs,
                user: { id: user?.id || 0 }
            });
            showToast({ type: 'info', message: 'Ficha enviada a REVISIÓN y correo enviado' });
            setTimeout(() => {
                onBack();
            }, 1500);
        } catch (error) {
            console.error(error);
            showToast({ type: 'error', message: 'Error al enviar a revisión' });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500 font-medium">Cargando datos...</div>
            </div>
        );
    }

    if (!data || !data.encabezado) {
        return <div className="p-8 text-center text-red-600">Error: Ficha incompleta o no encontrada.</div>;
    }

    const { encabezado: enc, detalles: det, observaciones: obs } = data;

    // Helper Components
    const StaticField = ({ label, value, fullWidth = false }: { label: string, value: any, fullWidth?: boolean }) => (
        <div className={`form-group ${fullWidth ? 'col-span-full' : ''}`} style={{ width: '100%', minWidth: 0 }}>
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
                display: 'flex', alignItems: 'center', width: '100%'
            }}>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                    {value || '-'}
                </span>
            </div>
        </div>
    );

    const ReadOnlyObservationArea = ({ label, value }: { label: string, value: string }) => (
        <div style={{
            padding: '1.5rem',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: 'white',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            maxWidth: '800px',
            margin: '0 auto',
            width: '100%'
        }}>
            <div className="form-group">
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '8px', display: 'block' }}>
                    {label}
                </label>
                <textarea
                    readOnly
                    value={value || ''}
                    rows={6}
                    style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '0.9rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        resize: 'none',
                        fontFamily: 'inherit',
                        minHeight: '120px',
                        backgroundColor: '#f9fafb',
                        color: '#374151'
                    }}
                />
            </div>
        </div>
    );

    return (
        <div className="fichas-ingreso-container commercial-layout">
            <div className="header-row">
                <button onClick={onBack} className="btn-back">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Volver
                </button>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
                    <h2 className="page-title-geo">Coordinación - Ficha N° {enc.fichaingresoservicio}</h2>
                    <span style={{
                        fontSize: '0.85rem',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        backgroundColor: '#f3f4f6',
                        color: '#4b5563',
                        fontWeight: 600
                    }}>
                        {enc.estado_ficha}
                    </span>
                </div>
            </div>

            {/* Status Validation Banner */}
            {fichaStatus !== null && fichaStatus !== 1 && (
                <WorkflowAlert
                    type="warning"
                    title="Acción Bloqueada"
                    message="Esta ficha requiere aprobación del Área Técnica antes de que Coordinación pueda aprobar o rechazar. Estado actual no permite esta acción."
                />
            )}

            {/* Tabs */}
            <div className="tabs-container">
                <button className={`tab-button ${activeTab === 'antecedentes' ? 'active' : ''}`} onClick={() => setActiveTab('antecedentes')}>Antecedentes</button>
                <button className={`tab-button ${activeTab === 'analisis' ? 'active' : ''}`} onClick={() => setActiveTab('analisis')}>Análisis</button>
                <button className={`tab-button ${activeTab === 'observaciones' ? 'active' : ''}`} onClick={() => setActiveTab('observaciones')}>Observaciones / Validación</button>
            </div>

            <div className="tab-content-area" style={{ padding: '1rem' }}>

                {/* ANTECEDENTES TAB (FULL VIEW) */}
                {activeTab === 'antecedentes' && (
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
                            <StaticField label="Inspector Ambiental" value={enc.nombre_inspector} />
                            <div style={{ gridColumn: 'span 2' }}>
                                <StaticField label="Punto de Muestreo" value={enc.ma_punto_muestreo} fullWidth />
                            </div>
                        </div>

                        <div className="form-grid-row grid-cols-4">
                            <div style={{ gridColumn: 'span 2' }}>
                                <StaticField label="Zona / Coordenadas" value={enc.ma_coordenadas || (enc.coordenadas_ruta ? `Ruta: ${enc.coordenadas_ruta}` : '')} fullWidth />
                            </div>
                        </div>

                        {/* Block 2: Frecuencia */}
                        <div style={{ marginTop: '1rem', marginBottom: '0.5rem', borderBottom: '1px solid #e5e7eb' }}></div>
                        <div className="form-grid-row grid-cols-4">
                            <StaticField label="Frecuencia" value={enc.frecuencia} />
                            <StaticField label="Periodo" value={enc.nombre_frecuencia} />
                            <StaticField label="Multiplicado Por" value={enc.frecuencia_factor} />
                            <StaticField label="Total Servicios" value={enc.total_servicios} />
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
                        </div>
                    </div>
                )}

                {/* ANALISIS TAB (FULL VIEW) */}
                {activeTab === 'analisis' && (
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
                                            <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>Lab. Derivado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {det.map((row: any, i: number) => {
                                            const analysisName = row.nombre_tecnica || row.nombre_determinacion || row.nombre_examen || row.nombre_analisis || '-';
                                            const errorYes = ['S', 's', 'Y', 'y', true].includes(row.llevaerror);

                                            return (
                                                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                    <td style={{ padding: '8px', fontWeight: 500 }}>{analysisName}</td>
                                                    <td style={{ padding: '8px' }}>{row.tipo_analisis || row.nombre_tipomuestra}</td>
                                                    <td style={{ padding: '8px', textAlign: 'right' }}>{row.limitemax_d ?? '-'}</td>
                                                    <td style={{ padding: '8px', textAlign: 'right' }}>{row.limitemax_h ?? '-'}</td>
                                                    <td style={{ padding: '8px', textAlign: 'right' }}>{errorYes ? 'Sí' : 'No'}</td>
                                                    <td style={{ padding: '8px', textAlign: 'right' }}>{row.error_min ?? '-'}</td>
                                                    <td style={{ padding: '8px', textAlign: 'right' }}>{row.error_max ?? '-'}</td>
                                                    <td style={{ padding: '8px' }}>{row.nombre_tipoentrega || row.nombre_entrega}</td>
                                                    <td style={{ padding: '8px', textAlign: 'right' }}>{row.uf_individual || row.uf || 0}</td>
                                                    <td style={{ padding: '8px' }}>{row.nombre_laboratorioensayo || row.nombre_laboratorio || row.laboratorio || '-'}</td>
                                                </tr>
                                            );
                                        })}
                                        {det.length === 0 && (
                                            <tr>
                                                <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                                                    No hay análisis registrados.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* OBSERVACIONES TAB */}
                {activeTab === 'observaciones' && (
                    <div style={{ display: 'grid', gap: '2rem' }}>
                        <ReadOnlyObservationArea label="Observaciones Comercial" value={obs.comercial} />
                        <ReadOnlyObservationArea label="Observaciones Área Técnica" value={obs.tecnica} />

                        <div style={{
                            padding: '1.5rem',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            backgroundColor: 'white',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                            maxWidth: '800px',
                            margin: '0 auto',
                            width: '100%',
                            display: 'grid',
                            gridTemplateColumns: 'minmax(0, 1fr) auto', // Input | Actions
                            gap: '1.5rem',
                            borderLeft: '4px solid #8b5cf6' // Violet for Coordination context
                        }}>
                            <div className="form-group">
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827', marginBottom: '8px', display: 'block' }}>
                                    Observaciones Área Coordinación (Editable)
                                </label>
                                <textarea
                                    value={coordObs}
                                    onChange={(e) => setCoordObs(e.target.value)}
                                    rows={6}
                                    placeholder="Ingrese observaciones de logística..."
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        fontSize: '0.9rem',
                                        border: '1px solid #8b5cf6',
                                        borderRadius: '6px',
                                        resize: 'vertical',
                                        fontFamily: 'inherit',
                                        minHeight: '120px',
                                        backgroundColor: 'white',
                                        color: '#111827'
                                    }}
                                />
                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px', textAlign: 'right' }}>
                                    {coordObs.length} caracteres
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.8rem' }}>
                                <button
                                    onClick={handleAccept}
                                    disabled={actionLoading || fichaStatus !== 1}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: (actionLoading || fichaStatus !== 1) ? '#86efac' : '#10b981', // Green
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: (actionLoading || fichaStatus !== 1) ? 'not-allowed' : 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.9rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        minWidth: '120px',
                                        opacity: (actionLoading || fichaStatus !== 1) ? 0.6 : 1
                                    }}
                                >
                                    <span>✅ Aceptar</span>
                                </button>

                                <button
                                    onClick={handleReview}
                                    disabled={actionLoading || fichaStatus !== 1}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: (actionLoading || fichaStatus !== 1) ? '#fca5a5' : '#ef4444',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: (actionLoading || fichaStatus !== 1) ? 'not-allowed' : 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.9rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        minWidth: '120px',
                                        opacity: (actionLoading || fichaStatus !== 1) ? 0.6 : 1
                                    }}
                                >
                                    <span>🔄 Revisar</span>
                                </button>
                                {fichaStatus !== 1 && (
                                    <div style={{ fontSize: '0.75rem', color: '#dc2626', textAlign: 'center', fontWeight: 500, marginTop: '4px' }}>
                                        Requiere aprobación de Área Técnica
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};
