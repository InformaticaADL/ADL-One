import React, { useEffect, useState, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { ObservacionesForm } from './ObservacionesForm';
import { ObservationTimeline } from './ObservationTimeline';
import { WorkflowAlert } from '../../../components/ui/WorkflowAlert';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import '../styles/FichasIngreso.css';

interface Props {
    fichaId: number;
    onBack: () => void;
}

// Inline Confirmation Modal (can be made global later if needed)
interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen, onClose, onConfirm, title, message,
    confirmText = 'Confirmar', cancelText = 'Cancelar', isDestructive = false
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
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '400px',
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
                    {title}
                </h3>
                <p style={{ color: '#4b5563', marginBottom: '24px', fontSize: '0.95rem' }}>
                    {message}
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: 'white',
                            color: '#374151',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontWeight: 500,
                            cursor: 'pointer'
                        }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: isDestructive ? '#dc2626' : '#16a34a',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontWeight: 500,
                            cursor: 'pointer'
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export const TechnicalDetailView: React.FC<Props> = ({ fichaId, onBack }) => {
    const { showToast } = useToast();
    const { user } = useAuth(); // Auth context
    const catalogos = useCachedCatalogos();

    // ... (state lines)
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'antecedentes' | 'analisis' | 'observaciones'>('antecedentes');
    const [data, setData] = useState<any>(null);
    const [laboratorios, setLaboratorios] = useState<any[]>([]);

    // Editable State
    const [tecnicaObs, setTecnicaObs] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    // Modal State
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDestructive?: boolean;
        confirmText?: string;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        isDestructive: false
    });

    // Memoize timeline creation data (MOVED TO TOP LEVEL TO AVOID HOOK ORDER VIOLATION)
    const timelineCreationData = useMemo(() => {
        if (!data) return undefined;
        return {
            date: data.fecha_fichacomercial || new Date().toISOString(),
            user: data.responsablemuestreo || 'Comercial',
            observation: data.observaciones_comercial || ''
        };
    }, [data]); // data includes enc so this is safe

    useEffect(() => {
        const loadFicha = async () => {
            if (!fichaId) return;
            setLoading(true);
            try {
                // Parallel fetch: Ficha + Labs
                const [response, labsData] = await Promise.all([
                    fichaService.getById(fichaId),
                    catalogos.getLaboratorios()
                ]);

                // console.log("Ficha Data Received:", response); // DEBUG LOG

                // Handle unwrapping of API response
                const fichaData = response.data || response;
                setData(fichaData);
                setLaboratorios(labsData || []);

                // If existing observations, populate local state
                // Attempt to read from flat structure (observaciones_jefaturatecnica) or fallback
                const existingObs = fichaData.observaciones_jefaturatecnica || (fichaData.observaciones && fichaData.observaciones.tecnica) || '';
                if (existingObs) {
                    setTecnicaObs(existingObs);
                }
            } catch (error) {
                console.error("Error loading ficha:", error);
                showToast({ type: 'error', message: "Error al cargar ficha" });
                // Optional: onBack(); 
            } finally {
                setLoading(false);
            }
        };

        loadFicha();
    }, [fichaId, showToast]);

    // Helper to get Lab Name
    const getLabName = (id: any) => {
        if (!id) return null;
        const lab = laboratorios.find((l: any) => l.id_laboratorioensayo === id || l.id_laboratorioensayo === Number(id));
        return lab ? lab.nombre_laboratorioensayo : null;
    };

    const executeAccept = async () => {
        setActionLoading(true);
        try {
            console.log('Aceptando ficha:', fichaId, 'Obs:', tecnicaObs, 'User:', user?.id);
            await fichaService.approve(fichaId, {
                observaciones: tecnicaObs,
                user: { id: user?.id || 0 }
            });
            showToast({ type: 'success', message: 'Ficha ACEPTADA correctamente' });
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

    const handleAcceptClick = () => {
        setModalConfig({
            isOpen: true,
            title: 'Confirmar Aprobación',
            message: '¿Está seguro de ACEPTAR esta ficha técnicamente? Esta acción habilitará la ficha para coordinación.',
            onConfirm: executeAccept,
            isDestructive: false,
            confirmText: 'Aceptar Ficha'
        });
    };

    const executeReject = async () => {
        setActionLoading(true);
        try {
            console.log('Rechazando ficha:', fichaId, 'Obs:', tecnicaObs, 'User:', user?.id);
            await fichaService.reject(fichaId, {
                observaciones: tecnicaObs,
                user: { id: user?.id || 0 }
            });
            showToast({ type: 'info', message: 'Ficha RECHAZADA correctamente' });
            setTimeout(() => {
                onBack();
            }, 1500);
        } catch (error) {
            console.error(error);
            showToast({ type: 'error', message: 'Error al rechazar ficha' });
        } finally {
            setActionLoading(false);
        }
    };

    const handleRejectClick = () => {
        if (!tecnicaObs.trim()) {
            showToast({ type: 'warning', message: 'Debe ingresar una observación para rechazar' });
            return;
        }
        setModalConfig({
            isOpen: true,
            title: 'Confirmar Rechazo',
            message: '¿Está seguro de RECHAZAR esta ficha? Deberá ser corregida por el área comercial.',
            onConfirm: executeReject,
            isDestructive: true,
            confirmText: 'Rechazar Ficha'
        });
    };

    if (loading) {
        return (
            <div className="loading-container-fullscreen">
                <div className="text-gray-500 font-medium">Cargando ficha {fichaId}...</div>
            </div>
        );
    }

    if (!data) {
        return <div className="p-8 text-center text-red-600">Error: Ficha incompleta o no encontrada.</div>;
    }

    const enc = data;
    const det = data.detalles || [];

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



    return (
        <div className="fichas-ingreso-container commercial-layout">
            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
                onConfirm={modalConfig.onConfirm}
                title={modalConfig.title}
                message={modalConfig.message}
                isDestructive={modalConfig.isDestructive}
                confirmText={modalConfig.confirmText}
            />

            <div className="header-row">
                <button onClick={onBack} className="btn-back">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Volver al Listado
                </button>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
                    <h2 className="page-title-geo">Gestión Técnica - Ficha N° {enc.fichaingresoservicio}</h2>
                    <span style={{
                        fontSize: '0.85rem',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        ...(() => {
                            const upperStatus = (enc.estado_ficha || '').toUpperCase();
                            let bg = '#e5e7eb'; let color = '#374151'; // Default

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
                            return { backgroundColor: bg, color: color };
                        })(),
                        fontWeight: 600
                    }}>
                        {(() => {
                            const txt = enc.estado_ficha || '-';
                            return txt.toLowerCase().split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                        })()}
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

                    {/* STATUS ALERTS - Todas bloquean botones excepto estados 0 y 3 */}
                    <div style={{ maxWidth: '800px', margin: '0 auto 1.5rem auto' }}>
                        {/* Ya procesada por Técnica - Aprobada */}
                        {data?.id_validaciontecnica === 1 && (
                            <WorkflowAlert
                                type="info"
                                title="Ficha Aprobada por Área Técnica"
                                message="Esta ficha fue aprobada y enviada a Coordinación. No se puede procesar nuevamente."
                            />
                        )}

                        {/* Ya procesada por Técnica - Rechazada */}
                        {data?.id_validaciontecnica === 2 && (
                            <WorkflowAlert
                                type="error"
                                title="Ficha Rechazada por Área Técnica"
                                message="Esta ficha fue rechazada y devuelta a Comercial. No se puede procesar nuevamente."
                            />
                        )}

                        {/* Bloqueada por Coordinación - Rechazada */}
                        {data?.id_validaciontecnica === 4 && (
                            <WorkflowAlert
                                type="warning"
                                title="Rechazada por Coordinación"
                                message="Esta ficha fue rechazada por Coordinación. No se pueden realizar acciones técnicas."
                            />
                        )}

                        {/* Bloqueada por Coordinación - Procesada */}
                        {[5, 6].includes(data?.id_validaciontecnica || 0) && (
                            <WorkflowAlert
                                type="info"
                                title="Gestionada por Coordinación"
                                message="Esta ficha ya fue procesada por Coordinación. No se pueden realizar acciones técnicas."
                            />
                        )}

                        {/* Anulada */}
                        {data?.id_validaciontecnica === 7 && (
                            <WorkflowAlert
                                type="error"
                                title="Ficha Anulada"
                                message="Esta ficha ha sido anulada y no se puede procesar."
                            />
                        )}
                    </div>

                    {/* ANTECEDENTES TAB (IGUAL QUE COMERCIAL) */}
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

                    {/* ANALISIS TAB (IGUAL QUE COMERCIAL) */}
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
                                                const errorYes = ['S', 's', 'Y', 'y', true].includes(row.llevaerror);

                                                // Resolve Names
                                                const labPrincipalName = getLabName(row.id_laboratorioensayo);
                                                const labSecundarioName = getLabName(row.id_laboratorioensayo_2);

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
                                                        <td style={{ padding: '8px' }}>
                                                            {labPrincipalName || (row.id_laboratorioensayo ? 'Enviado' : 'Interno')}
                                                        </td>
                                                        <td style={{ padding: '8px' }}>
                                                            {labSecundarioName || (row.id_laboratorioensayo_2 ? 'Enviado (Sec)' : '-')}
                                                        </td>
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

                    {activeTab === 'observaciones' && (
                        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#374151', marginBottom: '1rem' }}>Línea de Tiempo</h3>
                            <ObservationTimeline
                                fichaId={fichaId}
                                creationData={timelineCreationData}
                            />

                            <div style={{ marginTop: '2rem', borderTop: '1px solid #e5e7eb', paddingTop: '2rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#374151', marginBottom: '1rem' }}>Mi Gestión (Área Técnica)</h3>
                                <div className="observation-action-row" style={{
                                    borderLeft: '4px solid #3b82f6',
                                    paddingLeft: '1rem'
                                }}>
                                    <ObservacionesForm
                                        label="Observaciones Área Técnica"
                                        value={tecnicaObs}
                                        onChange={setTecnicaObs}
                                        readOnly={false}
                                        placeholder="Ingrese sus observaciones técnicas aquí..."
                                    >
                                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem', maxWidth: '1200px', margin: '1rem auto 0' }}>
                                            <button
                                                onClick={handleAcceptClick}
                                                disabled={actionLoading || ![0, 3].includes(data?.id_validaciontecnica || -1)}
                                                style={{
                                                    padding: '8px 24px',
                                                    backgroundColor: ![0, 3].includes(data?.id_validaciontecnica || -1) ? '#9ca3af' : '#10b981',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: (actionLoading || ![0, 3].includes(data?.id_validaciontecnica || -1)) ? 'not-allowed' : 'pointer',
                                                    fontWeight: 600,
                                                    fontSize: '0.9rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    opacity: (actionLoading || ![0, 3].includes(data?.id_validaciontecnica || -1)) ? 0.7 : 1,
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                                }}
                                            >
                                                <span>✅ Aceptar Ficha</span>
                                            </button>

                                            <button
                                                onClick={handleRejectClick}
                                                disabled={actionLoading || ![0, 3].includes(data?.id_validaciontecnica || -1)}
                                                style={{
                                                    padding: '8px 24px',
                                                    backgroundColor: ![0, 3].includes(data?.id_validaciontecnica || -1) ? '#9ca3af' : '#ef4444',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: (actionLoading || ![0, 3].includes(data?.id_validaciontecnica || -1)) ? 'not-allowed' : 'pointer',
                                                    fontWeight: 600,
                                                    fontSize: '0.9rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    opacity: (actionLoading || ![0, 3].includes(data?.id_validaciontecnica || -1)) ? 0.7 : 1,
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                                }}
                                            >
                                                <span>❌ Rechazar Ficha</span>
                                            </button>
                                        </div>
                                    </ObservacionesForm>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
