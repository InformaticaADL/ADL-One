import React, { useEffect, useState, useRef } from 'react';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import type { LugarAnalisis, EmpresaServicio, Cliente, Contacto, Centro } from '../services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';

// Add spinner animation CSS
const spinnerStyle = document.createElement('style');
spinnerStyle.innerHTML = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
if (!document.head.querySelector('style[data-spinner]')) {
    spinnerStyle.setAttribute('data-spinner', 'true');
    document.head.appendChild(spinnerStyle);
}

// --- Components ---

interface SearchableSelectProps {
    options: { id: string | number; nombre: string }[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    disabled?: boolean;
    label?: string;
    onFocus?: () => void;
    loading?: boolean;
    error?: string | null;
    onRetry?: () => void;
}

// Helper to dedup options
const dedupOptions = (options: { id: string | number; nombre: string }[]) => {
    const seen = new Set();
    return options.filter(opt => {
        const id = String(opt.id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });
};

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options, value, onChange, placeholder, disabled, label, onFocus, loading, error, onRetry
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => String(o?.id || '') === String(value || ''));

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
        (opt.nombre || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="form-group" ref={wrapperRef} style={{ position: 'relative' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
                {label}
                {loading && <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: '#6b7280' }}>⏳ Cargando...</span>}
            </label>
            <div
                className={`custom-select-trigger ${disabled ? 'disabled' : ''}`}
                onClick={() => {
                    if (!disabled && !loading) {
                        if (onFocus) {
                            const result = onFocus() as any;
                            if (result === false) return;
                        }
                        setIsOpen(!isOpen);
                    }
                }}
                style={{
                    padding: '6px 10px',
                    fontSize: '0.85rem',
                    border: error ? '1px solid #ef4444' : '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: disabled || loading ? '#f3f4f6' : 'white',
                    cursor: disabled || loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minHeight: '34px',
                    height: '34px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    width: '100%',
                    maxWidth: '100%',
                    overflow: 'hidden'
                }}
            >
                <span style={{
                    color: selectedOption ? '#111827' : '#9ca3af',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                    display: 'block'
                }}>
                    {loading ? 'Cargando...' : (selectedOption ? selectedOption.nombre : placeholder || 'Seleccione...')}
                </span>
                {loading ? (
                    <span style={{ fontSize: '0.7rem', color: '#6b7280', animation: 'spin 1s linear infinite' }}>⟳</span>
                ) : (
                    <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>▼</span>
                )}
            </div>

            {error && (
                <div style={{
                    marginTop: '4px',
                    padding: '6px 8px',
                    fontSize: '0.75rem',
                    color: '#dc2626',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>⚠️ {error}</span>
                    {onRetry && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRetry();
                            }}
                            style={{
                                marginLeft: '8px',
                                padding: '2px 8px',
                                fontSize: '0.7rem',
                                backgroundColor: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer'
                            }}
                        >
                            Reintentar
                        </button>
                    )}
                </div>
            )}

            {isOpen && !disabled && !loading && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    marginTop: '4px',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    maxHeight: '200px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ padding: '4px' }}>
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '4px 8px',
                                fontSize: '0.8rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                outline: 'none'
                            }}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt, index) => (
                                <div
                                    key={`${opt.id}-${index}`}
                                    onClick={() => {
                                        if (opt.id !== undefined && opt.id !== null) {
                                            onChange(String(opt.id));
                                        }
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                    style={{
                                        padding: '6px 10px',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        backgroundColor: value === String(opt.id || '') ? '#f3f4f6' : 'transparent',
                                        color: '#374151'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = value === String(opt.id || '') ? '#f3f4f6' : 'transparent'}
                                >
                                    {opt.nombre}
                                </div>
                            ))
                        ) : (
                            <div style={{ padding: '8px', fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center' }}>
                                No se encontraron resultados
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const ReadOnlyField = ({ label, value }: { label: string, value: string }) => (
    <div className="form-group">
        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>{label}</label>
        <div style={{
            padding: '6px 10px',
            fontSize: '0.85rem',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            backgroundColor: '#f9fafb',
            color: '#4b5563',
            minHeight: '34px',
            display: 'flex',
            alignItems: 'center'
        }}>
            {value || '-'}
        </div>
    </div>
);

export const AntecedentesForm = () => {
    // Initialize cached catalogos hook
    const catalogos = useCachedCatalogos();

    // Initialize toast notifications
    const { showToast } = useToast();

    // Catalog State
    const [lugares, setLugares] = useState<LugarAnalisis[]>([]);
    const [empresas, setEmpresas] = useState<EmpresaServicio[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [contactos, setContactos] = useState<Contacto[]>([]);
    const [fuentesEmisoras, setFuentesEmisoras] = useState<Centro[]>([]);

    // Error states for catalogs
    const [catalogErrors, setCatalogErrors] = useState<{ [key: string]: string | null }>({});

    // Form State
    const [tipoMonitoreo, setTipoMonitoreo] = useState<string>('');
    const [selectedLugar, setSelectedLugar] = useState<string>('');
    const [selectedEmpresa, setSelectedEmpresa] = useState<string>('');
    const [selectedCliente, setSelectedCliente] = useState<string>('');
    const [selectedFuente, setSelectedFuente] = useState<string>('');
    const [selectedContacto, setSelectedContacto] = useState<string>('');

    // Auto-filled Address Fields
    const [ubicacion, setUbicacion] = useState<string>('');
    const [comuna, setComuna] = useState<string>('');
    const [region, setRegion] = useState<string>('');
    const [tipoAgua, setTipoAgua] = useState<string>('');
    const [codigo, setCodigo] = useState<string>('');

    // Otros antecedentes state


    // --- Block 2 State ---
    const [objetivos, setObjetivos] = useState<any[]>([]);
    const [selectedObjetivo, setSelectedObjetivo] = useState<string>('');
    const [frecuencia, setFrecuencia] = useState<string>('');
    const [factor, setFactor] = useState<string>('1');
    const [periodo, setPeriodo] = useState<string>('');
    const [frecuenciasOptions, setFrecuenciasOptions] = useState<any[]>([]); // New State for options
    const [totalServicios, setTotalServicios] = useState<string>(''); // New State

    // --- Block 3 State ---
    const [zona, setZona] = useState<string>('');
    const [utmNorte, setUtmNorte] = useState<string>('');
    const [utmEste, setUtmEste] = useState<string>('');
    const [selectedInstrumento, setSelectedInstrumento] = useState<string>('');
    const [nroInstrumento, setNroInstrumento] = useState<string>('');
    const [anioInstrumento, setAnioInstrumento] = useState<string>('');

    const [componentes, setComponentes] = useState<any[]>([]);
    const [selectedComponente, setSelectedComponente] = useState<string>('');
    const [subAreas, setSubAreas] = useState<any[]>([]);
    const [selectedSubArea, setSelectedSubArea] = useState<string>('');
    // Glosa (Text24)
    const [glosa, setGlosa] = useState<string>('');
    const [esETFA, setEsETFA] = useState<string>('No'); // Si/No
    const [inspectores, setInspectores] = useState<any[]>([]);
    const [selectedInspector, setSelectedInspector] = useState<string>('');

    // --- Block 4 State ---
    const [responsableMuestreo, setResponsableMuestreo] = useState<string>('ADL'); // Fixed default
    const [cargos, setCargos] = useState<any[]>([]); // New State
    const [cargoResponsable, setCargoResponsable] = useState<string>('');
    const [puntoMuestreo, setPuntoMuestreo] = useState<string>('');
    const [tiposMuestreo, setTiposMuestreo] = useState<any[]>([]);
    const [selectedTipoMuestreo, setSelectedTipoMuestreo] = useState<string>('');
    const [tiposMuestra, setTiposMuestra] = useState<any[]>([]);
    const [selectedTipoMuestra, setSelectedTipoMuestra] = useState<string>('');
    const [actividades, setActividades] = useState<any[]>([]);
    const [selectedActividad, setSelectedActividad] = useState<string>('');
    const [duracion, setDuracion] = useState<string>('');
    const [tiposDescarga, setTiposDescarga] = useState<any[]>([]);
    const [selectedTipoDescarga, setSelectedTipoDescarga] = useState<string>('');
    const [refGoogle, setRefGoogle] = useState<string>('');
    const [medicionCaudal, setMedicionCaudal] = useState<string>('');
    const [modalidades, setModalidades] = useState<any[]>([]);
    const [selectedModalidad, setSelectedModalidad] = useState<string>('');

    // --- Block 5 State ---
    const [formasCanal, setFormasCanal] = useState<any[]>([]);
    const [formaCanal, setFormaCanal] = useState<string>('');
    // const [detalleCanal, setDetalleCanal] = useState<string>(''); // Removed
    const [dispositivos, setDispositivos] = useState<any[]>([]);
    const [dispositivo, setDispositivo] = useState<string>('');

    // Load Catalogs on mount
    // Load Catalogs on mount (Only independent ones)
    useEffect(() => {
        loadLugares();
        loadEmpresas();
        loadClientes();
        loadCatalogosComplementarios();
    }, []);

    // Cascade: Monitoreo -> Sede
    useEffect(() => {
        if (!tipoMonitoreo) setSelectedLugar('');
    }, [tipoMonitoreo]);

    // Cascade: Cliente -> Fuente Emisora & Contacto & Objetivo
    useEffect(() => {
        setFuentesEmisoras([]);
        setSelectedFuente('');
        setContactos([]);
        setSelectedContacto('');
        setObjetivos([]); // Reset Objetivos
        setSelectedObjetivo('');

        if (selectedCliente) {
            loadFuentesEmisoras(Number(selectedCliente));
            loadContactos(Number(selectedCliente));
            loadObjetivos(Number(selectedCliente)); // Dependent load
        }
    }, [selectedCliente]);

    // Cascade: Componente -> SubArea
    useEffect(() => {
        setSubAreas([]);
        setSelectedSubArea('');
        if (selectedComponente) {
            loadSubAreas(selectedComponente);
        }
    }, [selectedComponente]);

    // Cascade: Tipo Muestreo -> Tipo Muestra
    useEffect(() => {
        setTiposMuestra([]);
        setSelectedTipoMuestra('');
        if (selectedTipoMuestreo) {
            loadTiposMuestra(selectedTipoMuestreo);
        }
    }, [selectedTipoMuestreo]);

    // Cascade: Tipo Muestra -> Actividad
    useEffect(() => {
        setActividades([]);
        setSelectedActividad('');
        if (selectedTipoMuestra) {
            loadActividades(selectedTipoMuestra);
        }
    }, [selectedTipoMuestra]);


    // Auto-population
    useEffect(() => {
        if (selectedFuente) {
            const fuente = fuentesEmisoras.find(f => f.id.toString() === selectedFuente);
            if (fuente) {
                setUbicacion(fuente.direccion || fuente.ubicacion || '');
                setComuna(fuente.comuna || fuente.nombre_comuna || '');
                setRegion(fuente.region || fuente.nombre_region || '');
                setTipoAgua(fuente.tipo_agua || '');
                setCodigo(fuente.codigo || '');
            }
        } else {
            setUbicacion('');
            setComuna('');
            setRegion('');
            setTipoAgua('');
            setCodigo('');
        }
    }, [selectedFuente, fuentesEmisoras]);

    const loadLugares = async () => {
        try {
            const data = await catalogos.getLugaresAnalisis();
            setLugares(data.map((item: any) => ({
                id: item.id_lugaranalisis || item.IdLugarAnalisis || item.ID || item.id,
                nombre: item.nombre_lugaranalisis || item.NombreLugar || item.Nombre || item.nombre
            })));
        } catch (err: any) {
            console.error(err);
        }
    };

    const loadEmpresas = async () => {
        try {
            const data = await catalogos.getEmpresasServicio();
            setEmpresas(data.map((item: any) => ({
                id: item.id_empresaservicio || item.id_empresa || item.IdEmpresa || item.id,
                nombre: item.nombre_empresaservicios || item.nombre_empresaservicio || item.razon_social || item.RazonSocial || item.nombre
            })));
        } catch (err: any) {
            console.error(err);
        }
    };

    const loadClientes = async () => {
        try {
            const data = await catalogos.getClientes();
            setClientes(data.map((item: any) => ({
                id: item.id_cliente || item.IdCliente || item.id || item.id_empresa,
                nombre: item.nombre_cliente || item.NombreCliente || item.nombre || item.razon_social || item.nombre_empresa
            })));
        } catch (err: any) {
            console.error(err);
        }
    };

    const loadContactos = async (clienteId: number) => {
        try {
            const data = await catalogos.getContactos(clienteId);
            setContactos(data.map((item: any) => ({
                id: item.id_contacto || item.IdContacto || item.id,
                nombre: item.nombre_contacto || item.NombreContacto || item.nombre || item.nombres || item.nombre_persona,
                email: item.email || item.Email || item.email_contacto,
                telefono: item.telefono || item.Telefono || item.fono || item.fono_contacto
            })));
        } catch (err: any) {
            console.error(err);
        }
    };

    const loadFuentesEmisoras = async (clienteId: number) => {
        try {
            const data = await catalogos.getCentros(clienteId);
            setFuentesEmisoras(data.map((item: any) => ({
                id: item.id_centro || item.id,
                nombre: item.nombre_centro || item.nombre,
                direccion: item.direccion || item.ubicacion,
                comuna: item.nombre_comuna || item.comuna,
                region: item.nombre_region || item.region,
                tipo_agua: item.tipo_agua || item.TipoAgua || item.tipoagua || item.Tipo_Agua || item.nombre_tipoagua,
                codigo: item.codigo_centro || item.Codigo || item.codigo || item.codigo_ma
            })));
        } catch (err: any) {
            console.error(err);
        }
    };

    const loadObjetivos = async (clienteId: number) => {
        try {
            const data = await catalogos.getObjetivosMuestreo(clienteId);
            setObjetivos((data || []).map((o: any) => ({
                id: o.id_objetivomuestreo_ma || o.id,
                nombre: o.nombre_objetivomuestreo_ma || o.nombre
            })));
        } catch (error) {
            console.error("Error loading objetivos", error);
        }
    };

    // Independent Catalog Loader
    const loadCatalogosComplementarios = async () => {
        try {
            // Batch 1: Core Catalogs (Lighter requests)
            const [comps, insp, tMuestreo, tDescarga, mods] = await Promise.all([
                catalogos.getComponentesAmbientales(),
                catalogos.getInspectores(),
                catalogos.getTiposMuestreo(),
                catalogos.getTiposDescarga(),
                catalogos.getModalidades()
            ]);

            setComponentes((comps || []).map((c: any) => ({
                id: c.id_tipomuestra || c.id,
                nombre: c.nombre_tipomuestra || c.nombre
            })));
            setInspectores((insp || []).map((i: any) => ({
                id: String(i.id_inspector || i.id || ''),
                nombre: i.nombre_inspector || i.nombre
            })));
            setTiposMuestreo((tMuestreo || []).map((t: any) => ({
                id: String(t.id_tipomuestreo || t.id || ''),
                nombre: t.nombre_tipomuestreo || t.nombre
            })));
            setTiposDescarga((tDescarga || []).map((t: any) => ({
                id: String(t.id_tipodescarga || t.id || ''),
                nombre: t.nombre_tipodescarga || t.nombre
            })));
            setModalidades((mods || []).map((m: any) => ({
                id: String(m.id_modalidad || m.id || ''),
                nombre: m.nombre_modalidad || m.nombre
            })));

            // Batch 2: Heavier Catalogs - Load on mount for now
            // (Lazy loading caused issues with fields not showing options)
            const [cargosList, freqsList, formasCanalList, dispositivosList] = await Promise.all([
                catalogos.getCargos(),
                catalogos.getFrecuenciasPeriodo(),
                catalogos.getFormasCanal(),
                catalogos.getDispositivosHidraulicos()
            ]);

            // Normalize Cargos
            const normCargos = (cargosList || []).map((c: any, index: number) => ({
                ...c,
                id: String(c.id_cargo || c.ID || c.id || `cargo-${index}`),
                nombre: c.nombre_cargo || c.Nombre || 'Sin Nombre',
                cliente: c.cliente || c.Cliente
            }));
            setCargos(normCargos);

            // Normalize Frecuencias
            const normFreqs = (freqsList || []).map((f: any, index: number) => ({
                ...f,
                id: String(f.id_frecuenciaperiodo || f.id || `freq-${index}`),
                nombre: f.nombre_frecuencia || f.nombre
            }));
            setFrecuenciasOptions(normFreqs);

            // Formas Canal
            setFormasCanal((formasCanalList || []).map((f: any) => ({
                id: String(f.id_formacanal || f.id || ''),
                nombre: f.nombre_formacanal || f.nombre
            })));

            // Dispositivos Hidraulicos
            setDispositivos((dispositivosList || []).map((d: any) => ({
                id: String(d.id_dispositivohidraulico || d.id || ''),
                nombre: d.nombre_dispositivohidraulico || d.nombre
            })));

            console.log('✅ All catalogs loaded successfully.');

        } catch (error) {
            console.error("Error loading complementarios", error);
            setCatalogErrors(prev => ({ ...prev, complementarios: 'Error al cargar catálogos' }));
        }
    };

    // Dependent Loaders
    const loadSubAreas = async (componenteId: string) => {
        try {
            const data = await catalogos.getSubAreas(componenteId);
            setSubAreas((data || []).map((s: any) => ({
                id: s.id_subarea || s.id,
                nombre: s.nombre_subarea || s.nombre
            })));
        } catch (error) { console.error('Error loading subareas', error); }
    };

    const loadTiposMuestra = async (tipoMuestreoId: string) => {
        try {
            const data = await catalogos.getTiposMuestra(tipoMuestreoId);
            setTiposMuestra(data || []);
        } catch (error) { console.error('Error loading tipos muestra', error); }
    };

    const loadActividades = async (tipoMuestraId: string) => {
        try {
            const data = await catalogos.getActividadesMuestreo(tipoMuestraId);
            setActividades(data || []);
        } catch (error) { console.error('Error loading actividades', error); }
    };

    // Logic for Cargo Options Filtering
    const getFilteredCargos = () => {
        if (responsableMuestreo === 'ADL') {
            // FoxPro: Where id_cargo = 53
            return cargos.filter(c => String(c.id) === '53');
        } else if (responsableMuestreo === 'Cliente') {
            // FoxPro: Where cliente='S'
            return cargos.filter(c => c.cliente === 'S' || c.cliente === true);
        }
        return cargos;
    };

    // Logic: Frecuencia Periodo
    // Logic: Frecuencia Periodo
    const handlePeriodoChange = (val: string) => {
        setPeriodo(val);
        // Find by normalized ID
        const selectedFreq = frecuenciasOptions.find(f => String(f.id) === val);

        if (selectedFreq) {
            const cant = String(selectedFreq.cantidad || 1);
            const mult = String(selectedFreq.multiplicadopor || 1);

            setFrecuencia(cant);
            setFactor(mult);

            // Calc Total
            setTotalServicios(String(Number(cant) * Number(mult)));
        }
    };

    // Reactive Glosa Logic
    useEffect(() => {
        if (selectedSubArea && selectedFuente && selectedObjetivo) {
            const fuenteName = fuentesEmisoras.find(f => String(f.id) === selectedFuente)?.nombre || '';
            const objName = objetivos.find(o => String(o.id) === selectedObjetivo)?.nombre || '';
            if (fuenteName && objName) {
                setGlosa(`${fuenteName.trim()} - ${objName.trim()}`);
            }
        } else if (!selectedSubArea) {
            setGlosa('');
        }
    }, [selectedSubArea, selectedFuente, selectedObjetivo, fuentesEmisoras, objetivos]);

    // Auto-select Inspector when ETFA becomes Yes
    useEffect(() => {
        if (esETFA === 'Si' && inspectores.length > 0) {
            // Check if current selection is valid
            const isValid = inspectores.some(i => String(i.id) === selectedInspector);
            if (!isValid || !selectedInspector) {
                setSelectedInspector(String(inspectores[0].id));
            }
        }
    }, [esETFA, inspectores, selectedInspector]);

    // Recalculate if user manually edits Freq or Factor (FoxPro enables them)
    useEffect(() => {
        if (frecuencia && factor) {
            setTotalServicios(String(Number(frecuencia) * Number(factor)));
        }
    }, [frecuencia, factor]);

    // Validation on Focus (FoxPro GotFocus)
    const handlePeriodoFocus = () => {
        if (!puntoMuestreo || puntoMuestreo.trim() === '') {
            alert('Debes ingresar el dato Punto de Muestreo');
            // In React we can't easily force focus back to another element programmatically 
            // without refs, but we can clear the selection or just show the alert.
            // For better UX, we could focus the ref if we had one for puntoMuestreo.
        }
    };

    // Initial auto-selection for ADL Default (FoxPro behavior)
    useEffect(() => {
        if (responsableMuestreo === 'ADL' && cargos.length > 0 && !cargoResponsable) {
            // Force ID 53 if available
            const cargoADL = cargos.find(c => String(c.id) === '53');
            if (cargoADL) {
                setCargoResponsable('53');
            }
        }
    }, [cargos, responsableMuestreo, cargoResponsable]);

    return (
        <div className="antecedentes-form" style={{ padding: '0.5rem' }}>
            {/* Grid Layout Container */}
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr' }}>

                {/* Row 1: Monitoreo, Base, Empresa Fac, Empresa Servicio */}
                <div className="form-grid-row grid-cols-4">
                    <div style={{ width: '100%', minWidth: 0 }}>
                        <SearchableSelect
                            label="Monitoreo agua/RIL"
                            value={tipoMonitoreo}
                            onChange={setTipoMonitoreo}
                            options={[
                                { id: 'Compuesta', nombre: 'Compuesta' },
                                { id: 'Puntual', nombre: 'Puntual' }
                            ]}
                        />
                    </div>
                    <div style={{ width: '100%', minWidth: 0 }}>
                        <SearchableSelect
                            label="Base de operaciones"
                            value={selectedLugar}
                            onChange={setSelectedLugar}
                            options={lugares.map(l => ({ id: l.id, nombre: l.nombre }))}
                            disabled={!tipoMonitoreo}
                        />
                    </div>
                    <div style={{ width: '100%', minWidth: 0 }}>
                        <SearchableSelect
                            label="Empresa a Facturar"
                            value={selectedEmpresa}
                            onChange={setSelectedEmpresa}
                            options={empresas.map(e => ({ id: e.id, nombre: e.nombre }))}
                        />
                    </div>
                    <div style={{ width: '100%', minWidth: 0 }}>
                        <SearchableSelect
                            label="Empresa de servicio"
                            value={selectedCliente}
                            onChange={setSelectedCliente}
                            options={clientes.map(c => ({ id: c.id, nombre: c.nombre }))}
                        />
                    </div>
                </div>

                {/* Row 2: Fuente, Tipo Agua, Ubicacion, Comuna, Region */}
                <div className="form-grid-row grid-cols-custom-5">
                    <div style={{ width: '100%', minWidth: 0 }}>
                        <SearchableSelect
                            label="Fuente emisora"
                            value={selectedFuente}
                            onChange={setSelectedFuente}
                            options={fuentesEmisoras.map(f => ({ id: f.id, nombre: f.nombre }))}
                            disabled={!selectedCliente}
                        />
                    </div>
                    <ReadOnlyField label="Tipo agua" value={tipoAgua} />
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Ubicaci&oacute;n</label>
                        <input
                            type="text"
                            value={ubicacion}
                            onChange={(e) => setUbicacion(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '6px 10px',
                                fontSize: '0.85rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                outline: 'none',
                                minHeight: '34px'
                            }}
                        />
                    </div>
                    <ReadOnlyField label="Comuna" value={comuna} />
                    <ReadOnlyField label="Regi&oacute;n" value={region} />
                </div>

                {/* Row 3: Codigo */}
                <div className="form-grid-row grid-cols-custom-2">
                    <ReadOnlyField label="C&oacute;digo" value={codigo} />
                    <div /> {/* Spacer */}
                </div>

                {/* Row 4: Contacto */}
                <div className="form-grid-row grid-cols-4">
                    <div style={{ width: '100%', minWidth: 0 }}>
                        <SearchableSelect
                            label="Contacto empresa"
                            value={selectedContacto}
                            onChange={setSelectedContacto}
                            options={contactos.map(c => ({ id: c.id, nombre: c.nombre }))}
                            disabled={!selectedCliente}
                        />
                    </div>
                    {/* Espaciadores si es necesario para mantener alineación */}
                    <div />
                    <div />
                    <div />
                </div>

                {/* --- Block 2: Datos del Servicio --- */}
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1f2937', marginTop: '0.5rem', marginBottom: '0.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.2rem' }}>Datos del Servicio</h3>

                {/* Row 1: Objetivo, Responsable, Cargo */}
                <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <SearchableSelect
                        label="Objetivo del Muestreo"
                        value={selectedObjetivo}
                        onChange={setSelectedObjetivo}
                        options={dedupOptions(objetivos.map((o, idx) => ({
                            id: o.id || o.ID || o.IdObjetivo || o.id_objetio || o.id_objetivo || o.xid_objetivo || o.id_objetivomuestreo_ma || `obj-${idx}`,
                            nombre: o.nombre || o.Nombre || o.descripcion || o.Descripcion || o.glosa || o.nombre_objetivo || o.nombre_objetivomuestreo_ma || 'Sin Nombre'
                        })))}
                    />
                    <SearchableSelect
                        label="Responsable Muestreo"
                        value={responsableMuestreo}
                        onChange={(val) => {
                            setResponsableMuestreo(val);
                            if (val === 'ADL') {
                                // FoxPro: Select ... Where id_cargo = 53
                                // Force ID 53 if available
                                const cargoADL = cargos.find(c => String(c.id) === '53');
                                if (cargoADL) {
                                    setCargoResponsable('53');
                                } else {
                                    // Fallback: Thisform.pageframe1.page1.combo13.Value = RTRIM(responsableM_cargo.nombre_cargo)
                                    // In FoxPro it selects the record by ID 53 first. We try to set the ID.
                                    // If not found, we clear it or try to find by name "Muestreador" if user insists,
                                    // but strict ADL logic demands ID 53.
                                    setCargoResponsable('');
                                }
                            } else {
                                // FoxPro: Value = ' '
                                setCargoResponsable('');
                            }
                        }}
                        options={[{ id: 'ADL', nombre: 'ADL' }, { id: 'Cliente', nombre: 'Cliente' }]}
                    />
                    <SearchableSelect
                        label="Cargo"
                        value={cargoResponsable}
                        onChange={setCargoResponsable}
                        options={dedupOptions(getFilteredCargos().map(c => ({
                            id: c.id,
                            nombre: c.nombre
                        })))}
                        disabled={responsableMuestreo === 'ADL'}
                    />
                </div>

                {/* Row 2: Punto, Frec Periodo, Frec Muestreo, Factor, Total */}
                <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Punto de Muestreo</label>
                        <input type="text" value={puntoMuestreo} onChange={(e) => setPuntoMuestreo(e.target.value)}
                            style={{ width: '100%', padding: '6px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                    </div>
                    <div onFocus={handlePeriodoFocus}>
                        <SearchableSelect
                            label="Frecuencia Periodo"
                            value={periodo}
                            onChange={handlePeriodoChange}
                            options={dedupOptions(frecuenciasOptions.map(f => ({
                                id: f.id,
                                nombre: f.nombre_frecuencia
                            })))}
                        />
                    </div>
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Frecuencia Muestreo</label>
                        <input type="number" value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)}
                            style={{ width: '100%', padding: '6px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                    </div>
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Factor</label>
                        <input type="number" value={factor} onChange={(e) => setFactor(e.target.value)}
                            style={{ width: '100%', padding: '6px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                    </div>
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Total Servicios</label>
                        <input type="number" value={totalServicios} readOnly disabled
                            style={{ width: '100%', padding: '6px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#f3f4f6' }} />
                    </div>
                </div>

                {/* Row 3: Coordenadas Geograficas (Zona), UTM E, UTM S */}
                <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <SearchableSelect
                        label="Coordenadas Geogr&aacute;ficas (Zona)"
                        value={zona}
                        onChange={(val) => {
                            setZona(val);
                            // LostFocus Logic: Clear values on ANY change (as per FoxPro text8.Value = '')
                            setUtmEste('');
                            setUtmNorte('');
                        }}
                        onFocus={() => {
                            // GotFocus Logic: Check Frecuencia Muestreo (Text9)
                            if (!frecuencia || String(frecuencia).trim() === '') {
                                alert('Debes ingresar el dato Frecuencia Muestreo');
                            }
                        }}
                        options={[
                            { id: '18G', nombre: '18G' },
                            { id: '18H', nombre: '18H' },
                            { id: '18F', nombre: '18F' },
                            { id: '19H', nombre: '19H' },
                            { id: '19F', nombre: '19F' },
                            { id: 'No aplica', nombre: 'No aplica' }
                        ]}
                    />
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>UTM (E)</label>
                        <input type="text" value={utmEste} onChange={(e) => setUtmEste(e.target.value)} disabled={zona === 'No aplica'}
                            style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', minHeight: '34px', backgroundColor: zona === 'No aplica' ? '#f3f4f6' : 'white' }} />
                    </div>
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>UTM (N)</label>
                        <input type="text" value={utmNorte} onChange={(e) => setUtmNorte(e.target.value)} disabled={zona === 'No aplica'}
                            style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', minHeight: '34px', backgroundColor: zona === 'No aplica' ? '#f3f4f6' : 'white' }} />
                    </div>
                </div>

                {/* --- Block 3: Clasificacion Tecnica --- */}
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1f2937', marginTop: '0.5rem', marginBottom: '0.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.2rem' }}>Clasificaci&oacute;n T&eacute;cnica</h3>

                {/* Row 1: Instrumento Ambiental, Nro, Anio */}
                <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <SearchableSelect
                        label="Instrumento Ambiental"
                        value={selectedInstrumento}
                        onChange={(val) => {
                            setSelectedInstrumento(val);
                            if (val === 'No aplica') {
                                setEsETFA('No');
                                setSelectedInspector('');
                            } else {
                                setEsETFA('Si');
                                if (inspectores.length > 0) {
                                    // Default to first inspector if available
                                    setSelectedInspector(String(inspectores[0].id));
                                }
                            }
                        }}
                        options={[
                            { id: 'Res. Exenta N°', nombre: 'Res. Exenta N°' },
                            { id: 'Res. SISS N°', nombre: 'Res. SISS N°' },
                            { id: 'RCA N°', nombre: 'RCA N°' },
                            { id: 'No aplica', nombre: 'No aplica' }
                        ]}
                    />

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>N&deg;</label>
                            <input type="text" value={nroInstrumento} onChange={(e) => setNroInstrumento(e.target.value)}
                                style={{ width: '100%', padding: '6px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>A&ntilde;o</label>
                            <input type="text" value={anioInstrumento} onChange={(e) => setAnioInstrumento(e.target.value)}
                                style={{ width: '100%', padding: '6px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                        </div>
                    </div>

                    <SearchableSelect
                        label="Componente Ambiental"
                        value={selectedComponente}
                        onChange={(val) => {
                            setSelectedComponente(val);
                            setSelectedSubArea(''); // InteractiveChange: Clear Sub Area
                        }}
                        onFocus={() => {
                            // GotFocus: Check if Instrumento is selected (or Nro, or just check 'selectedInstrumento' which drives logic)
                            // User logic said "Text26" (Instrumento or related field). 
                            // If Instrumento is 'No aplica', this field relies on that decision.
                            if (!selectedInstrumento || selectedInstrumento === '') {
                                alert('Debes ingresar el dato Instrumento Ambiental');
                            }
                        }}
                        options={componentes.map(c => ({ id: c.id, nombre: c.nombre }))}
                    />
                </div>

                {/* Row 2: Sub Area */}
                <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    <SearchableSelect
                        label="Sub &Aacute;rea"
                        value={selectedSubArea}
                        onFocus={() => {
                            if (!selectedComponente || selectedComponente === '') {
                                alert('Debes ingresar el dato Componente Ambiental');
                            }
                        }}
                        onChange={(val) => {
                            setSelectedSubArea(val);
                        }}
                        options={subAreas.map(s => ({ id: s.id, nombre: s.nombre }))}
                        disabled={!selectedComponente}
                    />
                </div>

                {/* Row 3: Glosa and Counter */}
                <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '1rem', alignItems: 'end' }}>
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Nombre de la tabla (Glosa)</label>
                        <input
                            type="text"
                            value={glosa}
                            maxLength={100} // Assuming 100 based on standard legacy behavior or 254. Let's use 100 for safety or ask. FoxPro standard often 254.
                            // User code: This.MaxLength - LEN. Let's assume 250 safely.
                            // InteractiveChange logic: Update counter.
                            onChange={(e) => {
                                setGlosa(e.target.value);
                            }}
                            onFocus={() => {
                                // GotFocus: Validates Sub Area (Combo10)
                                if (!selectedSubArea || selectedSubArea === '') {
                                    alert('Debes ingresar el dato Sub Área');
                                }
                            }}
                            onBlur={() => {
                                // LostFocus: Copy to Page2 (Analysis Tab). 
                                // Since we are on Page 1, we just ensure the state is consistent.
                                // In the future, this state 'glosa' will be passed to Page 2.
                            }}
                            style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', minHeight: '34px' }}
                        />
                    </div>
                    {/* Text11: Character Counter */}
                    <div className="form-group" style={{ width: '80px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Disponibles</label>
                        <input
                            type="text"
                            disabled
                            value={100 - (glosa ? glosa.length : 0)}
                            style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem', border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: '#f9fafb', textAlign: 'center' }}
                        />
                    </div>
                </div>

                {/* Row 4: ETFA, Inspector */}
                <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <SearchableSelect
                        label="¿Es ETFA?"
                        value={esETFA}
                        onChange={setEsETFA}
                        options={[{ id: 'Si', nombre: 'Si' }, { id: 'No', nombre: 'No' }]}
                        disabled={true}
                    />
                    <SearchableSelect
                        label="Inspector Ambiental"
                        value={selectedInspector}
                        onChange={setSelectedInspector}
                        options={inspectores.map(i => ({ id: String(i.id), nombre: i.nombre }))}
                        disabled={true}
                    />
                </div>

                {/* Row 8: Tipo Muestreo, Tipo Muestra, Actividad, Duracion, Tipo Descarga */}
                <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '1rem' }}>
                    <SearchableSelect
                        label="Tipo Muestreo"
                        value={selectedTipoMuestreo}
                        onFocus={() => {
                            if (!glosa || glosa.trim() === '') {
                                alert('Debes ingresar el dato Nombre de la tabla');
                            }
                        }}
                        onChange={(val) => {
                            setSelectedTipoMuestreo(val);
                            setSelectedTipoMuestra(''); // Reset child
                            // Removed duplicate API call - useEffect at line 312 handles this
                        }}
                        options={tiposMuestreo.map(t => ({ id: t.id, nombre: t.nombre }))}
                    />
                    <SearchableSelect
                        label="Tipo Muestra"
                        value={selectedTipoMuestra}
                        onFocus={() => {
                            if (!selectedTipoMuestreo || selectedTipoMuestreo === '') {
                                alert('Debes ingresar el dato Tipo de muestreo');
                            }
                        }}
                        onChange={(val) => {
                            setSelectedTipoMuestra(val);
                            setSelectedActividad(''); // Reset child
                            // Removed duplicate API call - useEffect at line 321 handles this
                        }}
                        options={tiposMuestra.map((t: any) => ({
                            id: String(t.id_tipomuestra_ma || t.id || ''),
                            nombre: t.nombre_tipomuestra_ma || t.nombre || t.Nombre || 'Sin Nombre'
                        }))}
                        disabled={!selectedTipoMuestreo}
                    />
                    <SearchableSelect
                        label="Actividad Muestreo"
                        value={selectedActividad}
                        onFocus={() => {
                            if (!selectedTipoMuestra || selectedTipoMuestra === '') {
                                alert('Debes ingresar el dato Tipo de muestra');
                                return false;
                            }
                        }}
                        onChange={setSelectedActividad}
                        options={actividades.map((a: any) => ({
                            id: String(a.id_actividadmuestreo || a.id || ''),
                            nombre: a.nombre_actividadmuestreo || a.nombre || a.Nombre || 'Sin Nombre'
                        }))}
                        disabled={!selectedTipoMuestra}
                    />
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Duraci&oacute;n (Hrs)</label>
                        <input type="number" value={duracion} onChange={(e) => setDuracion(e.target.value)} disabled={!selectedActividad}
                            style={{ width: '100%', padding: '6px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                    </div>
                    <SearchableSelect
                        label="Tipo Descarga"
                        value={selectedTipoDescarga}
                        onChange={setSelectedTipoDescarga}
                        onFocus={() => {
                            // Logic: If Monitoreo is NOT Puntual, Duration is required
                            const monitoreo = tipoMonitoreo || ''; // Use state
                            if (monitoreo !== 'Puntual') {
                                if (!duracion || duracion.trim() === '') {
                                    alert('Debes ingresar el dato Duración muestreo');
                                    return false;
                                }
                            }
                        }}
                        options={tiposDescarga.map((t: any) => ({
                            id: String(t.id || t.ID || t.id_tipodescarga || ''),
                            nombre: t.nombre || t.Nombre || t.nombre_tipodescarga || 'Sin Nombre'
                        }))}
                    />
                </div>

                {/* Row 9: Ref Google Maps */}
                <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Referencia Google Maps</label>
                        <input
                            type="text"
                            placeholder="https://maps..."
                            value={refGoogle}
                            onFocus={(e) => {
                                // Logic: If Monitoreo is NOT Puntual, Tipo Descarga is required
                                if (tipoMonitoreo !== 'Puntual') {
                                    if (!selectedTipoDescarga || selectedTipoDescarga === '') {
                                        alert('Debes ingresar el dato Tipo de descarga');
                                        e.target.blur(); // Remove focus to enforce "Kick out"
                                    }
                                }
                            }}
                            onChange={(e) => setRefGoogle(e.target.value)}
                            style={{ width: '100%', padding: '6px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                        />
                    </div>
                </div>

                {/* Row 10: Medicion Caudal, Modalidad, Forma Canal, Dispositivo */}
                <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
                    <SearchableSelect label="Medici&oacute;n Caudal" value={medicionCaudal} onChange={setMedicionCaudal}
                        options={[
                            { id: 'Automático', nombre: 'Automático' },
                            { id: 'Manual', nombre: 'Manual' }
                        ]}
                    />
                    <SearchableSelect
                        label="Modalidad"
                        value={selectedModalidad}
                        onChange={setSelectedModalidad}
                        onFocus={() => {
                            if (!medicionCaudal || medicionCaudal === '') {
                                showToast({
                                    type: 'warning',
                                    message: 'Debes ingresar el dato Medición caudal',
                                    duration: 4000
                                });
                                return false;
                            }
                        }}
                        options={modalidades.map((m: any) => ({
                            id: String(m.id_modalidad || m.id || m.ID || ''),
                            nombre: m.nombre_modalidad || m.nombre || m.Nombre || 'Sin Nombre'
                        }))}
                    />
                    <SearchableSelect
                        label="Forma Canal"
                        value={formaCanal}
                        onChange={(val) => {
                            setFormaCanal(val);
                        }}
                        onFocus={() => {
                            if (!selectedModalidad || selectedModalidad === '') {
                                showToast({
                                    type: 'warning',
                                    message: 'Debes ingresar el dato Modalidad',
                                    duration: 4000
                                });
                                return false;
                            }
                        }}
                        options={formasCanal}
                    />
                    <SearchableSelect
                        label="Dispositivo Hidr&aacute;ulico"
                        value={dispositivo}
                        onChange={setDispositivo}
                        options={dispositivos}
                    />
                </div>

            </div>
        </div>
    );
};
