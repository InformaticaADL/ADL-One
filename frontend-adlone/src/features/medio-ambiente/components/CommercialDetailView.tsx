import React, { useEffect, useState } from 'react';
import { fichaService } from '../services/ficha.service';
import { useToast } from '../../../contexts/ToastContext';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import '../styles/FichasIngreso.css';

interface Props {
    fichaId: number;
    onBack: () => void;
}

export const CommercialDetailView: React.FC<Props> = ({ fichaId, onBack }) => {
    const { showToast } = useToast();
    const catalogos = useCachedCatalogos();

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'antecedentes' | 'analisis' | 'observaciones'>('antecedentes');
    const [data, setData] = useState<any>(null);
    const [laboratorios, setLaboratorios] = useState<any[]>([]);

    useEffect(() => {
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

        loadData();
    }, [fichaId, showToast]);

    // Helper to get Lab Name
    const getLabName = (id: any) => {
        if (!id) return null;
        const lab = laboratorios.find(l => l.id_laboratorioensayo === id || l.id_laboratorioensayo === Number(id));
        return lab ? lab.nombre_laboratorioensayo : null;
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

    // Helper for Observation TextArea styling
    const ObservationArea = ({ label, value }: { label: string, value: string }) => (
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

    // Guard clause if enc is null (still loading or error)
    if (!enc) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="text-gray-500">Cargando información de la ficha...</div>
            </div>
        );
    }


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
                    <h2 className="page-title-geo">Ficha N° {enc.fichaingresoservicio}</h2>
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
                <button className={`tab-button ${activeTab === 'antecedentes' ? 'active' : ''}`} onClick={() => setActiveTab('antecedentes')}>Antecedentes</button>
                <button className={`tab-button ${activeTab === 'analisis' ? 'active' : ''}`} onClick={() => setActiveTab('analisis')}>Análisis</button>
                <button className={`tab-button ${activeTab === 'observaciones' ? 'active' : ''}`} onClick={() => setActiveTab('observaciones')}>Observaciones / Validación</button>
            </div>

            <div className="tab-content-areaWrapper" style={{ padding: '0.5rem' }}>
                <div className="tab-content-area" style={{ display: 'block' }}>

                    {/* ANTECEDENTES TAB */}
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
                                {/* Updated to use enc.agenda?.nombre_inspector */}
                                <StaticField label="Inspector Ambiental" value={enc.agenda?.nombre_inspector || '-'} />
                                <div style={{ gridColumn: 'span 2' }}>
                                    <StaticField label="Punto de Muestreo" value={enc.ma_punto_muestreo} fullWidth />
                                </div>
                            </div>

                            <div className="form-grid-row grid-cols-4">
                                <div style={{ gridColumn: 'span 2' }}>
                                    <StaticField label="Zona / Coordenadas" value={enc.ma_coordenadas || (enc.coordenadas_ruta ? `Ruta: ${enc.coordenadas_ruta}` : '')} fullWidth />
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
                    )}

                    {/* ANALISIS TAB */}
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
                    )}

                    {/* OBSERVACIONES TAB - Updated to map correct fields */}
                    {activeTab === 'observaciones' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <ObservationArea label="Observaciones Comercial / Atención Cliente" value={enc.observaciones_comercial} />
                            <ObservationArea label="Validación Técnica / Coordinación" value={enc.observaciones_jefaturatecnica} />
                            <ObservationArea label="Observaciones Coordinador" value={enc.observaciones_coordinador} />
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
