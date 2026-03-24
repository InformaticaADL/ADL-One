import React, { useState, useEffect } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';

interface AnalysisFormProps {
    savedAnalysis: any[];
    onSavedAnalysisChange: (newAnalysis: any[]) => void;
}

export const AnalysisForm: React.FC<AnalysisFormProps> = ({ savedAnalysis, onSavedAnalysisChange }) => {
    const { showToast } = useToast();
    const catalogos = useCachedCatalogos();

    // ===== ESTADO: Filtros de Búsqueda =====
    const [normativa, setNormativa] = useState<string>('');
    const [referencia, setReferencia] = useState<string>('');
    const [searchText, setSearchText] = useState<string>('');

    // ===== ESTADO: Catálogos =====
    const [normativas, setNormativas] = useState<any[]>([]);
    const [referencias, setReferencias] = useState<any[]>([]);
    const [analysisResults, setAnalysisResults] = useState<any[]>([]);
    const [tiposMuestra] = useState([
        { id: 'Laboratorio', nombre: 'Laboratorio' },
        { id: 'Terreno', nombre: 'Terreno' }
    ]); // Opciones fijas
    const [laboratorios, setLaboratorios] = useState<any[]>([]);
    const [tiposEntrega, setTiposEntrega] = useState<any[]>([]);

    // ===== ESTADO: Configuración =====
    const [tipoMuestra, setTipoMuestra] = useState<string>('');

    // ===== ESTADO: Selección de Análisis =====
    const [selectedAnalysis, setSelectedAnalysis] = useState<Set<string>>(new Set());
    const [tempLabs, setTempLabs] = useState<Record<string, string>>({}); // Laboratorios por parámetro
    const [tempLabs2, setTempLabs2] = useState<Record<string, string>>({}); // Laboratorio 2 opcional
    const [tempDeliveries, setTempDeliveries] = useState<Record<string, string>>({}); // Tipos de entrega por parámetro

    // ===== FUNCIONES: Carga de Catálogos =====
    useEffect(() => {
        loadNormativas();
        loadLaboratorios(); // Cargar laboratorios al inicializar (FoxPro: Init)
        loadTiposEntrega(); // Cargar tipos entrega al inicializar (FoxPro: Init)
    }, []);

    const loadNormativas = async () => {
        try {
            const data = await catalogos.getNormativas();
            setNormativas(data || []);
        } catch (error) {
            console.error('Error loading normativas:', error);
            showToast({ type: 'error', message: 'Error al cargar normativas' });
        }
    };

    const loadLaboratorios = async () => {
        try {
            const data = await catalogos.getLaboratorios();
            setLaboratorios(data || []);
        } catch (error) {
            console.error('Error loading laboratorios:', error);
            showToast({ type: 'error', message: 'Error al cargar laboratorios' });
        }
    };

    const loadTiposEntrega = async () => {
        try {
            const data = await catalogos.getTiposEntrega();
            setTiposEntrega(data || []);
        } catch (error) {
            console.error('Error loading tipos entrega:', error);
            showToast({ type: 'error', message: 'Error al cargar tipos de entrega' });
        }
    };

    // ===== FUNCIONES: Cascadas =====
    useEffect(() => {
        if (normativa) {
            loadReferencias(normativa);
            setReferencia('');
        } else {
            setReferencias([]);
        }
    }, [normativa]);

    useEffect(() => {
        if (normativa && referencia) {
            loadAnalysisResults(normativa, referencia);
        } else {
            setAnalysisResults([]);
            setSelectedAnalysis(new Set()); // Limpiar selección
        }
    }, [normativa, referencia]);

    const loadReferencias = async (normativaId: string) => {
        try {
            const data = await catalogos.getReferenciasByNormativa(normativaId);
            setReferencias(data || []);
        } catch (error) {
            console.error('Error loading referencias:', error);
            showToast({ type: 'error', message: 'Error al cargar referencias' });
        }
    };

    const loadAnalysisResults = async (normativaId: string, referenciaId: string) => {
        try {
            const data = await catalogos.getAnalysisByNormativaReferencia(normativaId, referenciaId);
            setAnalysisResults(data || []);
        } catch (error) {
            console.error('Error loading analysis:', error);
            showToast({ type: 'error', message: 'Error al cargar análisis' });
        }
    };

    // ===== FUNCIONES: Filtrado =====
    const filteredAnalysis = analysisResults.filter(analysis =>
        analysis.nombre_tecnica?.toLowerCase().includes(searchText.toLowerCase()) ||
        analysis.id_referenciaanalisis?.toString().includes(searchText)
    );

    // ===== FUNCIONES: Selección de Análisis =====
    const handleSelectAll = () => {
        const allIds = new Set(filteredAnalysis.map(a => a.id_referenciaanalisis));
        setSelectedAnalysis(allIds);
    };

    const handleSelectNone = () => {
        setSelectedAnalysis(new Set());
        setTempLabs({}); // Limpiar laboratorios temporales
    };

    const handleToggleAnalysis = (id: string) => {
        const newSelection = new Set(selectedAnalysis);
        if (newSelection.has(id)) {
            newSelection.delete(id);
            // Limpiar estados temporales si se deselecciona
            const newTempLabs = { ...tempLabs };
            delete newTempLabs[id];
            setTempLabs(newTempLabs);

            const newTempLabs2 = { ...tempLabs2 };
            delete newTempLabs2[id];
            setTempLabs2(newTempLabs2);

            const newTempDeliveries = { ...tempDeliveries };
            delete newTempDeliveries[id];
            setTempDeliveries(newTempDeliveries);
        } else {
            newSelection.add(id);
        }
        setSelectedAnalysis(newSelection);
    };

    const handleTempLabChange = (analysisId: string, labId: string) => {
        setTempLabs(prev => ({
            ...prev,
            [analysisId]: labId
        }));
    };

    const handleTempLab2Change = (analysisId: string, labId: string) => {
        setTempLabs2(prev => ({
            ...prev,
            [analysisId]: labId
        }));
    };

    const handleTempDeliveryChange = (analysisId: string, deliveryId: string) => {
        setTempDeliveries(prev => ({
            ...prev,
            [analysisId]: deliveryId
        }));
    };

    // ===== FUNCIONES: Grabar Análisis =====
    const handleSaveAnalysis = () => {
        // Validaciones base
        if (!normativa || !referencia) {
            showToast({
                type: 'warning',
                message: 'Debes seleccionar una Normativa y Referencia antes de grabar',
                duration: 4000
            });
            return;
        }

        if (selectedAnalysis.size === 0) {
            showToast({
                type: 'warning',
                message: 'Debes seleccionar al menos un análisis',
                duration: 4000
            });
            return;
        }

        if (!tipoMuestra) {
            showToast({
                type: 'warning',
                message: 'Debes seleccionar el Tipo de Muestra',
                duration: 4000
            });
            return;
        }

        if (tipoMuestra === 'Laboratorio') {
            // Validar entrega y laboratorios para tipo Laboratorio
            const missingDeliveries = Array.from(selectedAnalysis).filter(id => !tempDeliveries[id]);
            if (missingDeliveries.length > 0) {
                showToast({
                    type: 'warning',
                    message: `Faltan tipos de entrega por asignar en ${missingDeliveries.length} análisis`,
                    duration: 4000
                });
                return;
            }

            const missingLabs = Array.from(selectedAnalysis).filter(id => !tempLabs[id]);
            if (missingLabs.length > 0) {
                showToast({
                    type: 'warning',
                    message: `Faltan laboratorios por asignar en ${missingLabs.length} análisis`,
                    duration: 4000
                });
                return;
            }
        }

        const newSavedAnalysis = Array.from(selectedAnalysis).map((id, index) => {
            const analysis = analysisResults.find(a => a.id_referenciaanalisis === id);
            
            // Determinar tipo de entrega
            let specificDeliveryId = tempDeliveries[id];
            if (tipoMuestra === 'Terreno') {
                const directaOption = tiposEntrega.find((t: any) =>
                    t.nombre_tipoentrega && t.nombre_tipoentrega.toUpperCase().includes('DIRECTA')
                );
                specificDeliveryId = directaOption?.id_tipoentrega || '';
            }
            
            const selectedTipoEntregaObj = tiposEntrega.find((t: any) => String(t.id_tipoentrega) === String(specificDeliveryId));

            // Determinar laboratorio
            const specificLabId = tempLabs[id];
            const selectedLabObj = laboratorios.find((l: any) => String(l.id_laboratorioensayo) === String(specificLabId));

            // Determinar laboratorio 2 (opcional)
            const specificLabId2 = tempLabs2[id];
            const selectedLabObj2 = laboratorios.find((l: any) => String(l.id_laboratorioensayo) === String(specificLabId2));

            let idLaboratorio = 0;
            let nombreLaboratorio = '';
            let idLaboratorio2 = null; // Default to null as requested
            let nombreLaboratorio2 = '';

            if (tipoMuestra === 'Terreno') {
                nombreLaboratorio = '';
                idLaboratorio = 0;
                idLaboratorio2 = null;
                nombreLaboratorio2 = '';
            } else {
                nombreLaboratorio = selectedLabObj?.nombre_laboratorioensayo || '';
                idLaboratorio = selectedLabObj?.id_laboratorioensayo || 0;
                
                idLaboratorio2 = selectedLabObj2?.id_laboratorioensayo || null;
                nombreLaboratorio2 = selectedLabObj2?.nombre_laboratorioensayo || '';
            }

            return {
                ...analysis,

                nombre_tecnica: analysis.nombre_tecnica,
                tipo_analisis: tipoMuestra,
                limitemax_d: analysis.limitemax_d,
                limitemax_h: analysis.limitemax_h,
                llevaerror: analysis.llevaerror,
                error_min: analysis.error_min,
                error_max: analysis.error_max,
                nombre_tipoentrega: selectedTipoEntregaObj?.nombre_tipoentrega || '',
                uf_individual: 0,
                nombre_laboratorioensayo: nombreLaboratorio,
                id_laboratorioensayo: idLaboratorio,
                // New Fields
                nombre_laboratorioensayo_2: nombreLaboratorio2,
                id_laboratorioensayo_2: idLaboratorio2,

                item: savedAnalysis.length + index + 1,
                id_tecnica: analysis.id_tecnica,
                estado: '',
                cumplimiento: '',
                cumplimiento_app: '',
                id_tipoentrega: selectedTipoEntregaObj?.id_tipoentrega || specificDeliveryId,
                id_transporte: 0,
                nombre_transporte: '',
                transporte_orden: '',
                resultado_fecha: '  /  /    ',
                resultado_hora: '',
                id_normativa: analysis.id_normativa,
                id_normativareferencia: analysis.id_normativareferencia,
                id_referenciaanalisis: analysis.id_referenciaanalisis,
                llevatraduccion: analysis.llevatraduccion,
                traduccion_0: analysis.traduccion_0,
                traduccion_1: analysis.traduccion_1,

                savedId: `${id}-${Date.now()}`
            };
        });

        onSavedAnalysisChange([...savedAnalysis, ...newSavedAnalysis]);

        setSelectedAnalysis(new Set());
        setTempLabs({});
        setTempLabs2({}); // Limpiar laboratorios 2 temporales
        setTempDeliveries({}); // Limpiar entregas temporales
        setSearchText('');

        // Resetear campos de configuración tras grabar exitosamente
        setTipoMuestra('');

        showToast({
            type: 'success',
            message: `${newSavedAnalysis.length} análisis grabados correctamente`,
            duration: 3000
        });
    };


    // Handler para cambios en celdas editables (UF)
    const handleUfChange = (savedId: string, newValue: string) => {
        const updatedAnalysis = savedAnalysis.map((item: any) => {
            if (item.savedId === savedId) {
                return { ...item, uf_individual: newValue };
            }
            return item;
        });
        onSavedAnalysisChange(updatedAnalysis);
    };

    // ===== FUNCIONES: Eliminar Análisis Grabado =====
    const handleDeleteSavedAnalysis = (savedId: string) => {
        onSavedAnalysisChange(savedAnalysis.filter((a: any) => a.savedId !== savedId));
        showToast({
            type: 'info',
            message: 'Análisis eliminado',
            duration: 3000
        });
    };

    // ... (inside JSX) ...

    return (
        <div className="analysis-form-container">
            {/* SECCIÓN SUPERIOR: Búsqueda y Configuración (Grilla Unificada) */}
            <div className="analysis-unified-grid">
                {/* COLUMNA IZQUIERDA: Búsqueda */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 className="grid-title search-title">Búsqueda de Análisis</h3>
                    
                    <div className="form-group grid-left">
                        <label>Normativa</label>
                        <select
                            value={normativa}
                            onChange={(e) => setNormativa(e.target.value)}
                            onFocus={() => setReferencia('')}
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                fontSize: '0.85rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                backgroundColor: 'white',
                                opacity: catalogos.isLoading('normativas') ? 0.7 : 1
                            }}
                        >
                            <option value="">Seleccione normativa...</option>
                            {normativas.map((n: any) => (
                                <option key={n.id_normativa} value={n.id_normativa}>{n.nombre_normativa}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group grid-left">
                        <label>Referencia</label>
                        <select
                            value={referencia}
                            onChange={(e) => setReferencia(e.target.value)}
                            disabled={!normativa}
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                fontSize: '0.85rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                backgroundColor: normativa ? 'white' : '#f3f4f6',
                                opacity: catalogos.isLoading(`referencias-${normativa}`) ? 0.7 : 1
                            }}
                        >
                            <option value="">Seleccione referencia...</option>
                            {referencias.map((r: any) => (
                                <option key={r.id_normativareferencia} value={r.id_normativareferencia}>
                                    {r.nombre_normativareferencia}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group grid-left">
                        <label>Buscar Análisis</label>
                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Buscar por código o nombre..."
                            disabled={!referencia}
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                fontSize: '0.85rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                backgroundColor: referencia ? 'white' : '#f3f4f6'
                            }}
                        />
                    </div>

                    <div className="grid-left" style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={handleSelectAll}
                            disabled={!referencia || filteredAnalysis.length === 0}
                            style={{
                                flex: 1,
                                padding: '6px 12px',
                                fontSize: '0.8rem',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: (referencia && filteredAnalysis.length > 0) ? 'pointer' : 'not-allowed',
                                opacity: (referencia && filteredAnalysis.length > 0) ? 1 : 0.5
                            }}
                        >
                            Seleccionar Todos
                        </button>
                        <button
                            onClick={handleSelectNone}
                            disabled={!referencia || selectedAnalysis.size === 0}
                            style={{
                                flex: 1,
                                padding: '6px 12px',
                                fontSize: '0.8rem',
                                backgroundColor: '#6b7280',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: (referencia && selectedAnalysis.size > 0) ? 'pointer' : 'not-allowed',
                                opacity: (referencia && selectedAnalysis.size > 0) ? 1 : 0.5
                            }}
                        >
                            Seleccionar Ninguno
                        </button>
                    </div>

                    <div className="grid-left" style={{ maxHeight: '310px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                            <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0, zIndex: 1 }}>
                                <tr>
                                    <th style={{ padding: '8px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>Análisis</th>
                                    <th style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid #e5e7eb', width: '60px' }}>☑️</th>
                                </tr>
                            </thead>
                            <tbody>
                                {catalogos.isLoading(`analysis-${normativa}-${referencia}`) ? (
                                    <tr>
                                        <td colSpan={2} style={{ padding: '2rem', textAlign: 'center' }}>Cargando análisis...</td>
                                    </tr>
                                ) : filteredAnalysis.length > 0 ? (
                                    filteredAnalysis.map(analysis => (
                                        <tr key={analysis.id_referenciaanalisis} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '8px' }}>{analysis.nombre_tecnica}</td>
                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedAnalysis.has(analysis.id_referenciaanalisis)}
                                                    onChange={() => handleToggleAnalysis(analysis.id_referenciaanalisis)}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={2} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                                            {normativa && referencia ? 'No se encontraron análisis' : 'Seleccione Normativa y Referencia'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* COLUMNA DERECHA: Configuración */}
                <div className="grid-right" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignSelf: 'start' }}>
                    <h3 className="grid-title config-title">Configuración de Análisis</h3>
                    
                    <div className="form-group">
                        <label>Tipo de Muestra *</label>
                        <select
                            value={tipoMuestra}
                            onChange={(e) => setTipoMuestra(e.target.value)}
                            disabled={!referencia}
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                fontSize: '0.85rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                backgroundColor: referencia ? 'white' : '#f3f4f6'
                            }}
                        >
                            <option value="">Seleccione tipo de muestra...</option>
                            {tiposMuestra.map(t => (
                                <option key={t.id} value={t.id}>{t.nombre}</option>
                            ))}
                        </select>
                    </div>

                    {selectedAnalysis.size > 0 && (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Análisis Seleccionados ({selectedAnalysis.size})
                                </label>
                                <button
                                    onClick={() => setSelectedAnalysis(new Set())}
                                    style={{ fontSize: '0.7rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                                >
                                    Limpiar Todo
                                </button>
                            </div>

                            <div style={{
                                padding: '0.5rem',
                                backgroundColor: '#f8fafc',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                                maxHeight: '520px',
                                overflow: 'auto'
                            }}>
                                 <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                    <thead style={{ backgroundColor: '#f1f5f9', position: 'sticky', top: 0, zIndex: 1 }}>
                                        <tr>
                                            <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>Análisis</th>
                                            {tipoMuestra === 'Laboratorio' && (
                                                <>
                                                    <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b', width: '120px' }}>Entrega</th>
                                                    <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b', width: '140px' }}>Lab 1</th>
                                                    <th style={{ padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#64748b', width: '140px' }}>Lab 2 (Opt)</th>
                                                </>
                                            )}
                                            <th style={{ padding: '6px 10px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', color: '#64748b', width: '40px' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Array.from(selectedAnalysis).map(id => {
                                            const analysis = analysisResults.find(a => a.id_referenciaanalisis === id);
                                            const specificLabId = tempLabs[id] || '';
                                            const specificDeliveryId = tempDeliveries[id] || '';
                                            return (
                                                <tr key={id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '6px 10px', fontWeight: 600, color: '#111827' }}>
                                                        {analysis?.nombre_tecnica || id}
                                                    </td>
                                                    {tipoMuestra === 'Laboratorio' && (
                                                        <>
                                                            <td style={{ padding: '6px 10px' }}>
                                                                <select
                                                                    value={specificDeliveryId}
                                                                    onChange={(e) => handleTempDeliveryChange(id, e.target.value)}
                                                                    style={{ width: '100%', fontSize: '0.7rem', padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                                                >
                                                                    <option value="">...</option>
                                                                    {tiposEntrega.map((t: any) => (
                                                                        <option key={t.id_tipoentrega} value={t.id_tipoentrega}>{t.nombre_tipoentrega}</option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                            <td style={{ padding: '6px 10px' }}>
                                                                <select
                                                                    value={specificLabId}
                                                                    onChange={(e) => handleTempLabChange(id, e.target.value)}
                                                                    style={{ width: '100%', fontSize: '0.7rem', padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                                                >
                                                                    <option value="">...</option>
                                                                    {laboratorios.map((l: any) => (
                                                                        <option key={l.id_laboratorioensayo} value={l.id_laboratorioensayo}>{l.nombre_laboratorioensayo}</option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                            <td style={{ padding: '6px 10px' }}>
                                                                <select
                                                                    value={tempLabs2[id] || ''}
                                                                    onChange={(e) => handleTempLab2Change(id, e.target.value)}
                                                                    style={{ width: '100%', fontSize: '0.7rem', padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: '4px', backgroundColor: '#fdfdfd' }}
                                                                >
                                                                    <option value="">(Ninguno)</option>
                                                                    {laboratorios.map((l: any) => (
                                                                        <option key={l.id_laboratorioensayo} value={l.id_laboratorioensayo}>{l.nombre_laboratorioensayo}</option>
                                                                    ))}
                                                                </select>
                                                            </td>
                                                        </>
                                                    )}
                                                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                                                        <button 
                                                            onClick={() => handleToggleAnalysis(id)} 
                                                            style={{ padding: '4px', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                 </table>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleSaveAnalysis}
                        disabled={
                            selectedAnalysis.size === 0 || 
                            !tipoMuestra || 
                            (tipoMuestra === 'Laboratorio' && (
                                Array.from(selectedAnalysis).some(id => !tempDeliveries[id]) ||
                                Array.from(selectedAnalysis).some(id => !tempLabs[id])
                            ))
                        }
                        className="save-analysis-btn"
                        style={{
                            width: '100%',
                            padding: '10px 16px',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            backgroundColor: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: (
                                selectedAnalysis.size > 0 && 
                                tipoMuestra && 
                                !(tipoMuestra === 'Laboratorio' && (
                                    Array.from(selectedAnalysis).some(id => !tempDeliveries[id]) ||
                                    Array.from(selectedAnalysis).some(id => !tempLabs[id])
                                ))
                            ) ? 'pointer' : 'not-allowed',
                            opacity: (
                                selectedAnalysis.size > 0 && 
                                tipoMuestra && 
                                !(tipoMuestra === 'Laboratorio' && (
                                    Array.from(selectedAnalysis).some(id => !tempDeliveries[id]) ||
                                    Array.from(selectedAnalysis).some(id => !tempLabs[id])
                                ))
                            ) ? 1 : 0.5,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                            marginTop: 'auto'
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        Grabar Análisis
                    </button>
                </div>
            </div>

            {/* SECCIÓN INFERIOR: Tabla de Análisis Grabados */}
            <div className="analysis-bottom-section">
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#374151' }}>
                    Análisis Grabados ({savedAnalysis.length})
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
                                <th style={{ padding: '8px', textAlign: 'center', borderBottom: '2px solid #e5e7eb', width: '80px' }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {savedAnalysis.length > 0 ? (
                                savedAnalysis.map(analysis => {
                                    return (
                                        <tr key={analysis.savedId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '8px' }}>{analysis.nombre_tecnica}</td>
                                            <td style={{ padding: '8px' }}>{analysis.tipo_analisis}</td>
                                            <td style={{ padding: '8px', textAlign: 'right' }}>{analysis.limitemax_d !== undefined ? analysis.limitemax_d : '-'}</td>
                                            <td style={{ padding: '8px', textAlign: 'right' }}>{analysis.limitemax_h !== undefined ? analysis.limitemax_h : '-'}</td>
                                            <td style={{ padding: '8px', textAlign: 'right' }}>
                                                {['S', 's', 'Y', 'y', true].includes(analysis.llevaerror) ? 'Sí' : 'No'}
                                            </td>
                                            <td style={{ padding: '8px', textAlign: 'right' }}>{analysis.error_min !== undefined ? analysis.error_min : '-'}</td>
                                            <td style={{ padding: '8px', textAlign: 'right' }}>{analysis.error_max !== undefined ? analysis.error_max : '-'}</td>
                                            <td style={{ padding: '8px' }}>{analysis.nombre_tipoentrega}</td>
                                            <td style={{ padding: '8px', textAlign: 'right' }}>
                                                <input
                                                    type="number"
                                                    value={analysis.uf_individual}
                                                    onChange={(e) => handleUfChange(analysis.savedId, e.target.value)}
                                                    onFocus={() => {
                                                        if (String(analysis.uf_individual) === '0') {
                                                            handleUfChange(analysis.savedId, '');
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        if (analysis.uf_individual === '' || String(analysis.uf_individual).trim() === '') {
                                                            handleUfChange(analysis.savedId, '0');
                                                        }
                                                    }}
                                                    style={{
                                                        width: '60px',
                                                        padding: '2px 4px',
                                                        border: '1px solid #d1d5db',
                                                        borderRadius: '4px',
                                                        textAlign: 'right'
                                                    }}
                                                />
                                            </td>
                                            <td style={{ padding: '8px' }}>
                                                <div>{analysis.nombre_laboratorioensayo || '-'}</div>
                                                {analysis.nombre_laboratorioensayo_2 && (
                                                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                        + {analysis.nombre_laboratorioensayo_2}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '8px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => handleDeleteSavedAnalysis(analysis.savedId)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        fontSize: '0.75rem',
                                                        backgroundColor: '#ef4444',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Eliminar
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={11} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                                        No hay análisis grabados
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <style>{`
                .analysis-form-container {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    padding: 1rem;
                }

                .analysis-unified-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.5rem 2rem;
                    padding: 1.5rem 1.5rem 4px 1.5rem; /* Minimized bottom padding */
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    background: white;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    align-items: start;
                    position: relative; /* Added for divider positioning */
                }

                /* Vertical Divider Line */
                @media (min-width: 1025px) {
                    .analysis-unified-grid::after {
                        content: '';
                        position: absolute;
                        top: 2rem;
                        bottom: 2rem;
                        left: 50%;
                        width: 1px;
                        background-color: #e5e7eb;
                        transform: translateX(-50%);
                    }
                }

                .grid-title {
                    margin: 0 0 0.5rem 0;
                    fontSize: 1rem;
                    fontWeight: 600;
                    color: #374151;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .form-group label {
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #374151;
                    margin-bottom: 2px;
                    display: block;
                }

                @media (max-width: 1024px) {
                    .analysis-unified-grid {
                        grid-template-columns: 1fr;
                    }
                }

                .analysis-bottom-section {
                    padding: 1.5rem;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    background: white;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }

                /* Hide spinners */
                input[type=number]::-webkit-outer-spin-button,
                input[type=number]::-webkit-inner-spin-button {
                  -webkit-appearance: none;
                  margin: 0;
                }
                input[type=number] {
                  -moz-appearance: textfield;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};
