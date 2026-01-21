import React, { useState, useEffect } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';

export const AnalysisForm = () => {
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
    const [labDerivado, setLabDerivado] = useState<string>('');
    const [tipoEntrega, setTipoEntrega] = useState<string>('');

    // ===== ESTADO: Selección de Análisis =====
    const [selectedAnalysis, setSelectedAnalysis] = useState<Set<string>>(new Set());

    // ===== ESTADO: Análisis Grabados =====
    const [savedAnalysis, setSavedAnalysis] = useState<any[]>([]);

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
            // console.log('✅ Normativas loaded:', data?.length);
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
            // Auto-load referencias when normativa changes to prevent double-click issue
            loadReferencias(normativa);
            setReferencia('');
        } else {
            setReferencias([]);
            // setReferencia(''); // Already handled in state update
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

    // ===== FUNCIONES: Selección de Análisis =====
    const handleSelectAll = () => {
        const allIds = new Set(filteredAnalysis.map(a => a.id_referenciaanalisis));
        setSelectedAnalysis(allIds);
    };

    const handleSelectNone = () => {
        setSelectedAnalysis(new Set());
    };

    const handleToggleAnalysis = (id: string) => {
        const newSelection = new Set(selectedAnalysis);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedAnalysis(newSelection);
    };

    // ===== FUNCIONES: Filtrado =====
    const filteredAnalysis = analysisResults.filter(analysis =>
        analysis.nombre_tecnica?.toLowerCase().includes(searchText.toLowerCase()) ||
        analysis.id_referenciaanalisis?.toString().includes(searchText)
    );

    // ===== FUNCIONES: Grabar Análisis =====
    const handleSaveAnalysis = () => {
        // Validaciones
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

        if (!tipoEntrega) {
            showToast({
                type: 'warning',
                message: 'Debes seleccionar el Tipo de Entrega',
                duration: 4000
            });
            return;
        }

        // Obtener datos detallados de catálogos seleccionados
        // Corrección: Asegurar comparación de tipos (String vs Number)
        const selectedTipoEntregaObj = tiposEntrega.find((t: any) => String(t.id_tipoentrega) === String(tipoEntrega));
        // Nota: labDerivado puede ser '' si es Terreno, find retornará undefined
        const selectedLabObj = laboratorios.find((l: any) => String(l.id_laboratorioensayo) === String(labDerivado));

        // Agregar análisis seleccionados a la tabla de guardados
        // Mapeo basado en lógica FoxPro (det_fichacomercial)
        const newSavedAnalysis = Array.from(selectedAnalysis).map((id, index) => {
            const analysis = analysisResults.find(a => a.id_referenciaanalisis === id);

            // Determinar valores condicionales para Laboratorio
            let idLaboratorio = 0;
            let nombreLaboratorio = '';

            if (tipoMuestra === 'Terreno') {
                nombreLaboratorio = '';
                idLaboratorio = 0;
            } else {
                nombreLaboratorio = selectedLabObj?.nombre_laboratorioensayo || '';
                idLaboratorio = selectedLabObj?.id_laboratorioensayo || 0;
            }

            return {
                ...analysis, // Mantener datos originales por si acaso

                // Campos det_fichacomercial
                nombre_tecnica: analysis.nombre_tecnica,
                tipo_analisis: tipoMuestra, // Combo3.Value
                limitemax_d: analysis.limitemax_d, // Direct mapping from API
                limitemax_h: analysis.limitemax_h, // Direct mapping from API
                llevaerror: analysis.llevaerror,
                error_min: analysis.error_min,
                error_max: analysis.error_max,
                nombre_tipoentrega: selectedTipoEntregaObj?.nombre_tipoentrega || '',
                uf_individual: 0, // Not in API, defaulting to 0 as in FoxPro
                nombre_laboratorioensayo: nombreLaboratorio,
                id_laboratorioensayo: idLaboratorio,
                item: savedAnalysis.length + index + 1, // Sequential
                id_tecnica: analysis.id_tecnica,
                estado: '',
                cumplimiento: '',
                cumplimiento_app: '',
                id_tipoentrega: selectedTipoEntregaObj?.id_tipoentrega || tipoEntrega, // Prefer obj id or fallback
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

                // Metadata frontend
                savedId: `${id}-${Date.now()}`
            };
        });

        setSavedAnalysis([...savedAnalysis, ...newSavedAnalysis]);

        // Limpiar selección
        setSelectedAnalysis(new Set());

        showToast({
            type: 'success',
            message: `${newSavedAnalysis.length} análisis grabados correctamente`,
            duration: 3000
        });
    };

    // Handler para cambios en celdas editables (UF)
    const handleUfChange = (savedId: string, newValue: string) => {
        setSavedAnalysis(prev => prev.map(item => {
            if (item.savedId === savedId) {
                // Allow string to support empty input
                return { ...item, uf_individual: newValue };
            }
            return item;
        }));
    };

    // ===== FUNCIONES: Eliminar Análisis Grabado =====
    const handleDeleteSavedAnalysis = (savedId: string) => {
        setSavedAnalysis(savedAnalysis.filter(a => a.savedId !== savedId));
        showToast({
            type: 'info',
            message: 'Análisis eliminado',
            duration: 3000
        });
    };

    return (
        <div className="analysis-form-container">
            {/* SECCIÓN SUPERIOR: Búsqueda y Configuración */}
            <div className="analysis-top-section">
                {/* PANEL IZQUIERDO: Búsqueda y Selección */}
                <div className="analysis-left-panel">
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#374151' }}>
                        Búsqueda de Análisis
                    </h3>

                    {/* Campo 1: Normativa */}
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
                            Normativa
                        </label>
                        <select
                            value={normativa}
                            onChange={(e) => setNormativa(e.target.value)}
                            onFocus={() => {
                                // GotFocus: Limpiar Referencia (FoxPro: combo7.value = " ")
                                setReferencia('');
                            }}
                            // Removed disabled attribute to prevent flicker
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
                                <option key={n.id_normativa} value={n.id_normativa}>
                                    {n.nombre_normativa}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Campo 2: Referencia */}
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
                            Referencia
                        </label>
                        <select
                            value={referencia}
                            onChange={(e) => {
                                setReferencia(e.target.value);
                            }}
                            // Removed onFocus loader (now in useEffect) and disabled state
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

                    {/* Campo 3: Búsqueda */}
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
                            Buscar Análisis
                        </label>
                        <input
                            type="text"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Buscar por código o nombre..."
                            disabled={!referencia} // Habilitado solo cuando hay referencia (FoxPro: text2.Enabled)
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

                    {/* Botones de Selección */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                            onClick={handleSelectAll}
                            disabled={!referencia || filteredAnalysis.length === 0} // Habilitado solo con referencia (FoxPro: command1.Enabled)
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

                    {/* Campo 4: Tabla de Resultados */}
                    <div style={{ marginTop: '1rem', maxHeight: '320px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
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
                                        <td colSpan={2} style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                                <div style={{
                                                    width: '24px',
                                                    height: '24px',
                                                    border: '3px solid #f3f4f6',
                                                    borderTop: '3px solid #3b82f6',
                                                    borderRadius: '50%',
                                                    animation: 'spin 1s linear infinite'
                                                }}></div>
                                                <span>Cargando análisis...</span>
                                            </div>
                                        </td>
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
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                        {selectedAnalysis.size > 0 && `${selectedAnalysis.size} análisis seleccionados`}
                    </div>
                </div>

                {/* PANEL DERECHO: Configuración */}
                <div className="analysis-right-panel">
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#374151' }}>
                        Configuración de Análisis
                    </h3>

                    {/* Campo 5: Tipo de Muestra */}
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
                            Tipo de Muestra *
                        </label>
                        <select
                            value={tipoMuestra}
                            onChange={(e) => {
                                const newValue = e.target.value;
                                setTipoMuestra(newValue);

                                // InteractiveChange: Lógica condicional según selección
                                if (newValue === 'Laboratorio') {
                                    // Laboratorio: Habilitar Lab Derivado y Tipo Entrega, deshabilitar botón Grabar (limpiando tipoEntrega)
                                    setLabDerivado('');
                                    setTipoEntrega('');
                                } else if (newValue === 'Terreno') {
                                    // Terreno: Deshabilitar Lab Derivado, establecer Tipo Entrega = 'Directa', habilitar botón Grabar
                                    setLabDerivado('');

                                    // Buscar ID de 'Directa' en tiposEntrega
                                    const directaOption = tiposEntrega.find((t: any) =>
                                        t.nombre_tipoentrega && t.nombre_tipoentrega.toUpperCase().includes('DIRECTA')
                                    );

                                    if (directaOption) {
                                        setTipoEntrega(directaOption.id_tipoentrega);
                                    } else {
                                        console.warn('Opción "Directa" no encontrada en tiposEntrega');
                                        setTipoEntrega(''); // Fallback
                                    }
                                }
                            }}
                            disabled={!referencia} // Habilitado solo cuando hay referencia (FoxPro: combo3.Enabled)
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

                    {/* Campo 6: Laboratorio Derivado */}
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
                            Laboratorio Derivado
                        </label>
                        <select
                            value={labDerivado}
                            onChange={(e) => setLabDerivado(e.target.value)}
                            disabled={!referencia || tipoMuestra !== 'Laboratorio'} // Habilitado solo con referencia Y Tipo Muestra = Laboratorio
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                fontSize: '0.85rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                backgroundColor: (referencia && tipoMuestra === 'Laboratorio') ? 'white' : '#f3f4f6'
                            }}
                        >
                            <option value="">Seleccione laboratorio...</option>
                            {laboratorios.map((l: any) => (
                                <option key={l.id_laboratorioensayo} value={l.id_laboratorioensayo}>
                                    {l.nombre_laboratorioensayo}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Campo 7: Tipo de Entrega */}
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
                            Tipo de Entrega *
                        </label>
                        <select
                            value={tipoEntrega}
                            onChange={(e) => setTipoEntrega(e.target.value)}
                            // LostFocus logic is implicit in React via state updates enabling the button
                            disabled={!referencia || tipoMuestra === 'Terreno'} // Habilitado solo con referencia Y Tipo Muestra != Terreno
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                fontSize: '0.85rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                backgroundColor: (referencia && tipoMuestra !== 'Terreno') ? 'white' : '#f3f4f6'
                            }}
                        >
                            <option value="">Seleccione tipo de entrega...</option>
                            {tiposEntrega.map((t: any) => (
                                <option key={t.id_tipoentrega} value={t.id_tipoentrega}>{t.nombre_tipoentrega}</option>
                            ))}
                        </select>
                    </div>

                    {/* Campo 8: Botón Grabar Análisis */}
                    <button
                        onClick={handleSaveAnalysis}
                        disabled={
                            selectedAnalysis.size === 0 ||
                            !tipoMuestra ||
                            !tipoEntrega ||
                            tipoEntrega === '' ||
                            (tipoMuestra === 'Laboratorio' && !labDerivado)
                        }
                        style={{
                            marginTop: 'auto',
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
                                tipoEntrega &&
                                tipoEntrega !== '' &&
                                !(tipoMuestra === 'Laboratorio' && !labDerivado)
                            ) ? 'pointer' : 'not-allowed',
                            opacity: (
                                selectedAnalysis.size > 0 &&
                                tipoMuestra &&
                                tipoEntrega &&
                                tipoEntrega !== '' &&
                                !(tipoMuestra === 'Laboratorio' && !labDerivado)
                            ) ? 1 : 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
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
                                                    style={{
                                                        width: '60px',
                                                        padding: '2px 4px',
                                                        border: '1px solid #d1d5db',
                                                        borderRadius: '4px',
                                                        textAlign: 'right'
                                                    }}
                                                />
                                            </td>
                                            <td style={{ padding: '8px' }}>{analysis.nombre_laboratorioensayo || '-'}</td>
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

            {/* CSS Inline para el componente */}
            <style>{`
                .analysis-form-container {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    padding: 1rem;
                }

                .analysis-top-section {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1.5rem;
                }

                .analysis-left-panel,
                .analysis-right-panel {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    padding: 1.5rem;
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    background: white;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }

                .analysis-bottom-section {
                    padding: 1.5rem;
                    border: 1px solid #e5e7eb;
                    borderRadius: 8px;
                    background: white;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }

                /* Hide spinners for Chrome, Safari, Edge, Opera */
                input[type=number]::-webkit-outer-spin-button,
                input[type=number]::-webkit-inner-spin-button {
                  -webkit-appearance: none;
                  margin: 0;
                }
                
                /* Hide spinners for Firefox */
                input[type=number] {
                  -moz-appearance: textfield;
                }

                @media (max-width: 1024px) {
                    .analysis-top-section {
                        grid-template-columns: 1fr;
                    }
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};
