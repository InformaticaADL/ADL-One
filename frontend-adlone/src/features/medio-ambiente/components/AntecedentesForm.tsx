import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import type { LugarAnalisis, EmpresaServicio, Cliente, Contacto, Centro } from '../services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import '../styles/FichasIngreso.css';
import '../styles/FormGrids.css';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
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

// Define interface for exposed methods
export interface AntecedentesFormHandle {
    getData: () => any;
}

// --- Components ---



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

export const AntecedentesForm = forwardRef<AntecedentesFormHandle, { initialData?: any, onValidationChange?: (isValid: boolean) => void }>((props, ref) => {
    const { initialData, onValidationChange } = props;
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
    const [_catalogErrors, setCatalogErrors] = useState<{ [key: string]: string | null }>({});

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

    // --- Block 2 State ---
    const [objetivos, setObjetivos] = useState<any[]>([]);
    const [selectedObjetivo, setSelectedObjetivo] = useState<string>('');
    const [frecuencia, setFrecuencia] = useState<string>('');
    const [factor, setFactor] = useState<string>('1');
    const [periodo, setPeriodo] = useState<string>('');
    const [frecuenciasOptions, setFrecuenciasOptions] = useState<any[]>([]);
    const [totalServicios, setTotalServicios] = useState<string>('');

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
    const [responsableMuestreo, setResponsableMuestreo] = useState<string>('ADL');
    const [cargos, setCargos] = useState<any[]>([]);
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
    const [formaCanal, setFormaCanal] = useState<string>(String(initialData?.formaCanal ?? ''));

    const [detalleCanal, setDetalleCanal] = useState<string>(initialData?.detalleCanal || '');

    const [dispositivos, setDispositivos] = useState<any[]>([]);
    const [dispositivo, setDispositivo] = useState<string>(String(initialData?.dispositivo ?? ''));
    const [detalleDispositivo, setDetalleDispositivo] = useState<string>(initialData?.detalleDispositivo || '');

    // Extra state for id_tipo_agua (separate from the display string)
    const [idTipoAgua, setIdTipoAgua] = useState<number | null>(initialData?.idTipoAgua || null);

    // Track if we're currently hydrating from initialData to prevent cascade clearing
    // Start as TRUE if initialData exists to block initial cascades
    const isHydrating = useRef(!!initialData);
    // Force false initially to ensures backup effect runs if useState misses
    const hasHydrated = useRef(false);

    // Validation Effect
    useEffect(() => {
        const checkValidity = () => {
            const requiredFields = [
                tipoMonitoreo,
                selectedLugar,
                selectedCliente,
                selectedFuente,
                selectedObjetivo,
                puntoMuestreo,
                zona,
                utmNorte,
                utmEste,
                selectedComponente,
                selectedSubArea,
                glosa,
                selectedTipoMuestreo,
                selectedTipoMuestra,
                selectedActividad,
                duracion,
                responsableMuestreo,
                cargoResponsable,
                selectedInstrumento,
                nroInstrumento,
                anioInstrumento,
                frecuencia,
                factor,
                periodo
            ];

            const isValid = requiredFields.every(field => {
                if (field === null || field === undefined) return false;
                return String(field).trim().length > 0 && String(field) !== 'null';
            });

            if (onValidationChange) {
                onValidationChange(isValid);
            }
        };

        checkValidity();
    }, [
        tipoMonitoreo, selectedLugar, selectedCliente, selectedFuente, selectedObjetivo,
        puntoMuestreo, zona, utmNorte, utmEste, selectedComponente, selectedSubArea,
        glosa, selectedTipoMuestreo, selectedTipoMuestra, selectedActividad, duracion,
        responsableMuestreo, cargoResponsable, selectedInstrumento, nroInstrumento,
        anioInstrumento, frecuencia, factor, periodo, onValidationChange
    ]);

    // Debug: Track component mount/unmount
    useEffect(() => {
        console.log('🟢 AntecedentesForm MOUNTED');
        return () => {
            console.log('🔴 AntecedentesForm UNMOUNTED');
        };
    }, []);


    // Initial Data Hydration - Backup for late props
    useEffect(() => {
        if (initialData && !hasHydrated.current) {
            console.log('Hydrating AntecedentesForm (Backup Effect)', initialData);
            isHydrating.current = true;

            setTipoMonitoreo(initialData.tipoMonitoreo || '');
            setSelectedLugar(String(initialData.selectedLugar ?? ''));
            setSelectedEmpresa(String(initialData.selectedEmpresa ?? ''));
            setSelectedCliente(String(initialData.selectedCliente ?? ''));
            setSelectedFuente(String(initialData.selectedFuente ?? ''));
            setSelectedContacto(String(initialData.selectedContacto ?? ''));
            setSelectedObjetivo(String(initialData.selectedObjetivo ?? ''));
            setUbicacion(initialData.ubicacion || '');
            setComuna(initialData.comuna || '');
            setRegion(initialData.region || '');
            setTipoAgua(initialData.tipoAgua || '');
            setIdTipoAgua(initialData.idTipoAgua ?? null);
            setCodigo(initialData.codigo || '');
            setGlosa(initialData.glosa || '');
            setEsETFA(initialData.esETFA || 'No');
            setPuntoMuestreo(initialData.puntoMuestreo || '');
            setZona(initialData.zona || '');
            setUtmNorte(initialData.utmNorte || '');
            setUtmEste(initialData.utmEste || '');
            setSelectedComponente(String(initialData.selectedComponente ?? ''));
            setSelectedSubArea(String(initialData.selectedSubArea ?? ''));
            setSelectedInstrumento(initialData.selectedInstrumento || '');
            setNroInstrumento(initialData.nroInstrumento || '');
            setAnioInstrumento(initialData.anioInstrumento || '');
            setSelectedInspector(String(initialData.selectedInspector ?? ''));
            setResponsableMuestreo(initialData.responsableMuestreo || 'ADL');
            setCargoResponsable(String(initialData.cargoResponsable ?? ''));
            setSelectedTipoMuestreo(String(initialData.selectedTipoMuestreo ?? ''));
            setSelectedTipoMuestra(String(initialData.selectedTipoMuestra ?? ''));
            setSelectedActividad(String(initialData.selectedActividad ?? ''));
            setDuracion(initialData.duracion || '');
            setSelectedTipoDescarga(String(initialData.selectedTipoDescarga ?? ''));
            setRefGoogle(initialData.refGoogle || '');
            setMedicionCaudal(initialData.medicionCaudal || '');
            setSelectedModalidad(String(initialData.selectedModalidad ?? ''));
            setFormaCanal(String(initialData.formaCanal ?? ''));
            setDetalleCanal(initialData.detalleCanal || '');
            setDispositivo(String(initialData.dispositivo ?? ''));
            setDetalleDispositivo(initialData.detalleDispositivo || '');
            setFrecuencia(String(initialData.frecuencia ?? ''));
            setFactor(String(initialData.factor ?? '1'));
            setPeriodo(String(initialData.periodo ?? ''));
            setTotalServicios(String(initialData.totalServicios ?? ''));

            hasHydrated.current = true;
            // Note: isHydrating will be disabled by catalog loader or timeout if needed
        }
    }, [initialData]);
    useImperativeHandle(ref, () => ({
        getData: () => {
            // Find selected contact name
            const contactoObj = contactos.find(c => String(c.id) === selectedContacto);

            const data = {
                tipoMonitoreo: tipoMonitoreo || '',
                selectedLugar: selectedLugar || '',
                selectedEmpresa: selectedEmpresa || '',
                selectedCliente: selectedCliente || '',
                selectedFuente: selectedFuente || '',
                tipoAgua: tipoAgua || '',
                idTipoAgua,
                selectedObjetivo: selectedObjetivo || '',
                glosa: glosa || '',
                esETFA: esETFA || '',
                puntoMuestreo: puntoMuestreo || '',
                zona: zona || '',
                utmNorte: utmNorte || '',
                utmEste: utmEste || '',
                selectedComponente: selectedComponente || '',
                selectedSubArea: selectedSubArea || '',
                selectedTipoDescarga: selectedTipoDescarga || '',
                selectedContacto: selectedContacto || '',
                contactoNombre: contactoObj ? contactoObj.nombre : '',
                selectedTipoMuestreo: selectedTipoMuestreo || '',
                selectedTipoMuestra: selectedTipoMuestra || '',
                selectedActividad: selectedActividad || '',
                duracion: duracion || '',
                refGoogle: refGoogle || '',
                medicionCaudal: medicionCaudal || '',
                selectedModalidad: selectedModalidad || '',
                formaCanal: formaCanal || '',
                detalleCanal: detalleCanal || '',
                dispositivo: dispositivo || '',
                detalleDispositivo: detalleDispositivo || '',
                responsableMuestreo: responsableMuestreo || '',
                cargoResponsable: cargoResponsable || '',
                selectedInspector: selectedInspector || '',
                frecuencia: frecuencia || '',
                factor: factor || '',
                periodo: periodo || '',
                totalServicios: totalServicios || '',
                ubicacion: ubicacion || '',
                comuna: comuna || '',
                region: region || '',
                selectedInstrumento: selectedInstrumento || '',
                nroInstrumento: nroInstrumento || '',
                anioInstrumento: anioInstrumento || ''
            };

            console.log('🔍 DEBUG getData() - selectedInspector:', selectedInspector);
            console.log('🔍 DEBUG getData() - idTipoAgua:', idTipoAgua);
            console.log('🔍 DEBUG getData() - FREQUENCY DATA:', {
                frecuencia,
                factor,
                periodo,
                totalServicios
            });

            return data;
        }
    }));

    // Load Catalogs on mount (Only independent ones)
    useEffect(() => {
        loadLugares();
        loadEmpresas();
        loadClientes();
        loadCatalogosComplementarios();
    }, []);

    // Cascade: Monitoreo -> Sede
    useEffect(() => {
        console.log('🔄 [Cascade] tipoMonitoreo changed:', tipoMonitoreo, 'isHydrating:', isHydrating.current);
        // Skip clearing if we're hydrating
        if (isHydrating.current) {
            console.log('⏸️ [Cascade] Skipping tipoMonitoreo cascade (hydrating)');
            return;
        }

        // Hydration Guard
        if (initialData && initialData.tipoMonitoreo === tipoMonitoreo && initialData.selectedLugar === selectedLugar) {
            console.log('⏸️ [Cascade] Skipping tipoMonitoreo cascade (matches initialData)');
            return;
        }

        if (!tipoMonitoreo) setSelectedLugar('');
    }, [tipoMonitoreo]);

    // Cascade: Cliente -> Fuente Emisora & Contacto & Objetivo
    useEffect(() => {
        console.log('🔄 [Cascade] selectedCliente changed:', selectedCliente, 'isHydrating:', isHydrating.current);
        // Skip clearing if we're hydrating
        if (isHydrating.current) {
            console.log('⏸️ [Cascade] Skipping selectedCliente cascade (hydrating)');
            return;
        }

        // Hydration Check: If we are matching initial Data, don't wipe dependent fields
        const isRestoring = initialData && String(initialData.selectedCliente) === String(selectedCliente);

        if (!isRestoring) {
            if (selectedCliente && selectedCliente !== 'No Aplica') {
                // Auto-population: Find linked Empresa de Servicio
                console.log('🔍 [Debug] Searching for client:', selectedCliente, 'in', clientes.length, 'clients');
                const clienteObj = clientes.find(c => String(c.id) === String(selectedCliente));
                console.log('🔍 [Debug] Found client object:', clienteObj);

                const linkedEmpresaId = clienteObj?.id_empresaservicio;
                console.log('🔍 [Debug] Linked Empresa ID from client:', linkedEmpresaId);

                if (linkedEmpresaId && linkedEmpresaId !== 0 && linkedEmpresaId !== '0') {
                    console.log('✨ [Debug] Calling setSelectedEmpresa with:', String(linkedEmpresaId));
                    setSelectedEmpresa(String(linkedEmpresaId));
                } else {
                    console.log('⚠️ [Debug] No linked ID found in client object or it is invalid:', linkedEmpresaId);
                }
            } else {
                setFuentesEmisoras([]);
                setSelectedFuente('');
                setContactos([]);
                setSelectedContacto('');
                setObjetivos([]); // Reset Objetivos
                setSelectedObjetivo('');
            }
        }

        if (selectedCliente && selectedCliente !== 'No Aplica') {
            loadFuentesEmisoras(Number(selectedCliente));
            loadContactos(Number(selectedCliente));
            loadObjetivos(Number(selectedCliente)); // Dependent load
        }
    }, [selectedCliente, clientes]);

    // Cascade: Componente -> SubArea
    useEffect(() => {
        console.log('🔄 [Cascade] selectedComponente changed:', selectedComponente, 'isHydrating:', isHydrating.current);
        if (isHydrating.current) {
            console.log('⏸️ [Cascade] Skipping selectedComponente cascade (hydrating)');
            return;
        }
        const isRestoring = initialData && String(initialData.selectedComponente) === String(selectedComponente);
        console.log('🔍 [Cascade] selectedComponente isRestoring:', isRestoring);
        if (!isRestoring) {
            console.log('🗑️ [Cascade] Clearing subAreas');
            setSubAreas([]);
            setSelectedSubArea('');
        }
        if (selectedComponente) {
            loadSubAreas(selectedComponente);
        }
    }, [selectedComponente]);

    // Cascade: Tipo Muestreo -> Tipo Muestra
    useEffect(() => {
        if (isHydrating.current) return;
        const isRestoring = initialData && String(initialData.selectedTipoMuestreo) === String(selectedTipoMuestreo);
        if (!isRestoring) {
            setTiposMuestra([]);
            setSelectedTipoMuestra('');
        }
        if (selectedTipoMuestreo) {
            loadTiposMuestra(selectedTipoMuestreo);
        }
    }, [selectedTipoMuestreo]);

    // Cascade: Tipo Muestra -> Actividad
    useEffect(() => {
        if (isHydrating.current) return;
        const isRestoring = initialData && String(initialData.selectedTipoMuestra) === String(selectedTipoMuestra);
        if (!isRestoring) {
            setActividades([]);
            setSelectedActividad('');
        }
        if (selectedTipoMuestra) {
            loadActividades(selectedTipoMuestra);
        }
    }, [selectedTipoMuestra]);


    // Auto-population (Derived Fields)
    useEffect(() => {
        // ALLOW auto-population during hydration because initialData might not have these derived text fields,
        // or we need to ensure they match the selected Fuente.
        // if (isHydrating.current) return; <--- REMOVED THIS GUARD

        if (selectedFuente) {
            const fuente = fuentesEmisoras.find(f => f.id.toString() === selectedFuente);
            if (fuente) {
                setUbicacion(fuente.direccion || fuente.ubicacion || '');
                setComuna(fuente.comuna || fuente.nombre_comuna || '');
                setRegion(fuente.region || fuente.nombre_region || '');
                setTipoAgua(fuente.tipo_agua || '');
                // Try to find reasonable ID: id_tipoagua, or parse from somewhere if not present
                const fuenteAny = fuente as any;
                const idTipo = fuenteAny.id_tipoagua || fuenteAny.IdTipoAgua || fuenteAny.ID_TIPOAGUA || null;
                setIdTipoAgua(idTipo);
                setCodigo(fuente.codigo || '');
            }
        } else if (!initialData) {
            // Only clear if we're not in edit mode (no initialData)
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
                id: item.id_empresaservicio || item.IdEmpresaServicio || item.id_empresa || item.IdEmpresa || item.id,
                nombre: item.nombre_empresaservicios || item.nombre_empresaservicio || item.razon_social || item.RazonSocial || item.nombre,
                email: item.email_empresa || item.email || item.Email || ''
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
                nombre: item.nombre_cliente || item.NombreCliente || item.nombre || item.razon_social || item.nombre_empresa,
                email: item.email_empresa || item.email || item.Email || '',
                id_empresaservicio: item.id_empresaservicio || item.IdEmpresaServicio || 0
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
            const mapped = data.map((item: any) => ({
                id: item.id_centro || item.id,
                nombre: item.nombre_centro || item.nombre,
                direccion: item.direccion || item.ubicacion,
                comuna: item.nombre_comuna || item.comuna,
                region: item.nombre_region || item.region,
                tipo_agua: item.tipo_agua || item.TipoAgua || item.tipoagua || item.Tipo_Agua || item.nombre_tipoagua,
                id_tipoagua: item.id_tipoagua || item.IdTipoAgua || item.ID_TIPOAGUA,
                codigo: item.codigo_centro || item.Codigo || item.codigo || item.codigo_ma
            }));
            setFuentesEmisoras(mapped);

            // Auto-select first available Fuente Emisora if not hydrating
            if (!isHydrating.current && mapped.length > 0) {
                console.log('✨ Auto-selecting first Fuente Emisora:', mapped[0].nombre);
                setSelectedFuente(String(mapped[0].id));
            }
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
                id: String(i.id_inspectorambiental || i.id_inspector || i.id || ''),
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
                id: String(f.id_frecuenciaperiodo || f.id_frecuencia || f.id || `freq-${index}`),
                nombre: f.nombre_frecuencia || f.nombre
            }));
            setFrecuenciasOptions(normFreqs);

            // FORCE RE-HYDRATION: Ensure Periodo is selected once options are loaded
            if (initialData?.periodo) {
                const pId = String(initialData.periodo);
                const match = normFreqs.find(f => String(f.id) === pId);
                if (match) {
                    setPeriodo(pId);
                }
            }

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

            // If we're in edit mode (hydrating), load dependent catalogs before disabling flag
            if (isHydrating.current && initialData) {
                console.log('📦 Loading dependent catalogs for edit mode...');

                // Load dependent catalogs based on initialData
                const dependentLoads: Promise<void>[] = [];

                if (initialData.selectedCliente) {
                    dependentLoads.push(
                        loadFuentesEmisoras(Number(initialData.selectedCliente)),
                        loadContactos(Number(initialData.selectedCliente)),
                        loadObjetivos(Number(initialData.selectedCliente))
                    );
                }

                if (initialData.selectedComponente) {
                    dependentLoads.push(loadSubAreas(String(initialData.selectedComponente)));
                }

                if (initialData.selectedTipoMuestreo) {
                    dependentLoads.push(loadTiposMuestra(String(initialData.selectedTipoMuestreo)));
                }

                if (initialData.selectedTipoMuestra) {
                    dependentLoads.push(loadActividades(String(initialData.selectedTipoMuestra)));
                }

                // Wait for all dependent catalogs to load
                await Promise.all(dependentLoads);
                console.log('✅ Dependent catalogs loaded successfully');

                // NOW it's safe to disable hydration flag
                console.log('🔓 Disabling hydration flag - all catalogs loaded');
                isHydrating.current = false;
            } else if (isHydrating.current) {
                // Not in edit mode but flag is still set (shouldn't happen)
                console.log('🔓 Disabling hydration flag - catalogs loaded');
                isHydrating.current = false;
            }

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
    const handlePeriodoChange = (val: string) => {
        console.log('🔄 handlePeriodoChange called with val:', val);
        setPeriodo(val);
        // Find by normalized ID
        const selectedFreq = frecuenciasOptions.find(f => String(f.id) === val);
        console.log('🔍 selectedFreq found:', selectedFreq);

        if (selectedFreq) {
            const cant = String(selectedFreq.cantidad || 1);
            const mult = String(selectedFreq.multiplicadopor || 1);
            console.log('📊 Setting frecuencia:', cant, 'factor:', mult);

            setFrecuencia(cant);
            setFactor(mult);

            // Calc Total
            setTotalServicios(String(Number(cant) * Number(mult)));
        } else if (val === 'No Aplica') {
            setFrecuencia('No Aplica');
            setFactor('No Aplica');
            setTotalServicios('No Aplica');
        } else {
            console.warn('⚠️ No matching frequency found for periodo:', val);
            setFrecuencia('');
            setFactor('');
            setTotalServicios('');
        }
    };

    // Reactive Glosa Logic
    useEffect(() => {
        // Skip during hydration to preserve loaded value
        if (isHydrating.current) return;

        if (selectedSubArea && selectedFuente && selectedObjetivo) {
            const fuenteName = fuentesEmisoras.find(f => String(f.id) === selectedFuente)?.nombre || '';
            const objName = objetivos.find(o => String(o.id) === selectedObjetivo)?.nombre || '';
            if (fuenteName && objName) {
                setGlosa(`${fuenteName.trim()} - ${objName.trim()}`);
            }
        } else if (!selectedSubArea && !initialData) {
            // Only clear if not in edit mode
            setGlosa('');
        }
    }, [selectedSubArea, selectedFuente, selectedObjetivo, fuentesEmisoras, objetivos]);

    // Auto-select Inspector when ETFA becomes Yes
    useEffect(() => {
        if (isHydrating.current) return;
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
        // ALLOW calculation during hydration to ensure total services is correct
        // if (isHydrating.current) return; 

        if (frecuencia === 'No Aplica' || factor === 'No Aplica' || periodo === 'No Aplica') {
            setTotalServicios('No Aplica');
        } else if (frecuencia && factor && !isNaN(Number(frecuencia)) && !isNaN(Number(factor))) {
            setTotalServicios(String(Number(frecuencia) * Number(factor)));
        } else {
            setTotalServicios('');
        }
    }, [frecuencia, factor, periodo]);

    // Auto-assign Cargo based on Responsable Muestreo (FoxPro LostFocus logic)
    useEffect(() => {
        if (isHydrating.current) return;
        if (responsableMuestreo === 'ADL') {
            // Auto-assign id_cargo = 53 (Muestreador) when ADL is selected
            setCargoResponsable('53');
        } else if (responsableMuestreo === 'Cliente') {
            // Clear cargo to allow manual selection
            setCargoResponsable('');
        }
    }, [responsableMuestreo]);

    // Validation on Focus (FoxPro GotFocus)
    const handlePeriodoFocus = () => {
        if (!puntoMuestreo || puntoMuestreo.trim() === '') {
            showToast({ type: 'warning', message: 'Debes ingresar el dato Punto de Muestreo', duration: 4000 });
            // In React we can't easily force focus back to another element programmatically 
            // without refs, but we can clear the selection or just show the alert.
            // For better UX, we could focus the ref if we had one for puntoMuestreo.
        }
    };

    // Initial auto-selection for ADL Default (FoxPro behavior)
    useEffect(() => {
        if (isHydrating.current) return;
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
                            label="Monitoreo agua/RIL *"
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
                            label="Base de operaciones *"
                            value={selectedLugar}
                            onChange={setSelectedLugar}
                            options={[
                                { id: 'No Aplica', nombre: 'No Aplica' },
                                ...lugares.map(l => ({ id: l.id, nombre: l.nombre }))
                            ]}
                            disabled={!tipoMonitoreo}
                        />
                    </div>
                    <div style={{ width: '100%', minWidth: 0 }}>
                        <SearchableSelect
                            label="Empresa a Facturar *"
                            value={selectedCliente}
                            onChange={setSelectedCliente}
                            options={[
                                { id: 'No Aplica', nombre: 'No Aplica' },
                                ...clientes.map(c => ({ id: c.id, nombre: c.nombre }))
                            ]}
                        />
                    </div>
                    <div style={{ width: '100%', minWidth: 0 }}>
                        <SearchableSelect
                            label="Empresa de servicio"
                            value={selectedEmpresa}
                            onChange={setSelectedEmpresa}
                            options={[
                                { id: 'No Aplica', nombre: 'No Aplica' },
                                ...empresas.map(e => ({ id: e.id, nombre: e.nombre }))
                            ]}
                        />
                    </div>
                </div>

                {/* Row 2: Fuente, Tipo Agua, Ubicacion, Comuna, Region */}
                <div className="form-grid-row grid-cols-custom-5">
                    <div style={{ width: '100%', minWidth: 0 }}>
                        <SearchableSelect
                            label="Fuente emisora *"
                            value={selectedFuente}
                            onChange={setSelectedFuente}
                            options={[
                                { id: 'No Aplica', nombre: 'No Aplica' },
                                ...fuentesEmisoras.map(f => ({ id: f.id, nombre: f.nombre }))
                            ]}
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
                            label="Contacto empresa *"
                            value={selectedContacto}
                            onChange={setSelectedContacto}
                            options={[
                                { id: 'No Aplica', nombre: 'No Aplica' },
                                ...contactos.map(c => ({ id: c.id, nombre: c.nombre }))
                            ]}
                            disabled={!selectedCliente}
                        />
                    </div>
                    <ReadOnlyField label="Correo Empresa" value={clientes.find(c => String(c.id) === selectedCliente)?.email || '-'} />
                    <ReadOnlyField label="Correo Contacto" value={contactos.find(c => String(c.id) === selectedContacto)?.email || '-'} />
                    <div />
                </div>

                {/* --- Block 2: Datos del Servicio --- */}
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1f2937', marginTop: '0.5rem', marginBottom: '0.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.2rem' }}>Datos del Servicio</h3>

                {/* Row 1: Objetivo, Responsable, Cargo */}
                <div className="form-grid-row grid-cols-3">
                    <SearchableSelect
                        label="Objetivo del Muestreo *"
                        value={selectedObjetivo}
                        onChange={setSelectedObjetivo}
                        options={[
                            { id: 'No Aplica', nombre: 'No Aplica' },
                            ...dedupOptions(objetivos.map((o, idx) => ({
                                id: o.id || o.ID || o.IdObjetivo || o.id_objetio || o.id_objetivo || o.xid_objetivo || o.id_objetivomuestreo_ma || `obj-${idx}`,
                                nombre: o.nombre || o.Nombre || o.descripcion || o.Descripcion || o.glosa || o.nombre_objetivo || o.nombre_objetivomuestreo_ma || 'Sin Nombre'
                            })))
                        ]}
                    />
                    <SearchableSelect
                        label="Responsable Muestreo *"
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
                        options={[
                            { id: 'No Aplica', nombre: 'No Aplica' },
                            { id: 'ADL', nombre: 'ADL' },
                            { id: 'Cliente', nombre: 'Cliente' }
                        ]}
                    />
                    <SearchableSelect
                        label="Cargo *"
                        value={cargoResponsable}
                        onChange={setCargoResponsable}
                        options={[
                            { id: 'No Aplica', nombre: 'No Aplica' },
                            ...dedupOptions(getFilteredCargos().map(c => ({
                                id: c.id,
                                nombre: c.nombre
                            })))
                        ]}
                        disabled={responsableMuestreo === 'ADL'}
                    />
                </div>

                {/* Row 2: Punto, Frec Periodo, Frec Muestreo, Factor, Total */}
                <div className="form-grid-row grid-cols-custom-5">
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Punto de Muestreo *</label>
                        <input type="text" value={puntoMuestreo} onChange={(e) => setPuntoMuestreo(e.target.value)}
                            style={{ width: '100%', padding: '6px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                    </div>
                    <div onFocus={handlePeriodoFocus}>
                        <SearchableSelect
                            label="Frecuencia Periodo *"
                            value={periodo}
                            onChange={handlePeriodoChange}
                            options={[
                                { id: 'No Aplica', nombre: 'No Aplica' },
                                ...dedupOptions(frecuenciasOptions.map(f => ({
                                    id: String(f.id),
                                    nombre: f.nombre || f.nombre_frecuencia || 'Sin Nombre'
                                })))
                            ]}
                            disabled={!puntoMuestreo || puntoMuestreo.trim() === ''}
                        />
                    </div>
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Frecuencia Muestreo *</label>
                        <input
                            type="text"
                            value={frecuencia}
                            onChange={(e) => setFrecuencia(e.target.value)}
                            disabled={!periodo || periodo === 'No Aplica'}
                            style={{
                                width: '100%',
                                padding: '6px',
                                fontSize: '0.85rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                backgroundColor: (!periodo || periodo === 'No Aplica') ? '#f3f4f6' : 'white',
                                cursor: (!periodo || periodo === 'No Aplica') ? 'not-allowed' : 'text'
                            }}
                        />
                    </div>
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Factor *</label>
                        <input
                            type="text"
                            value={factor}
                            onChange={(e) => setFactor(e.target.value)}
                            disabled={!periodo || periodo === 'No Aplica'}
                            style={{
                                width: '100%',
                                padding: '6px',
                                fontSize: '0.85rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                backgroundColor: (!periodo || periodo === 'No Aplica') ? '#f3f4f6' : 'white',
                                cursor: (!periodo || periodo === 'No Aplica') ? 'not-allowed' : 'text'
                            }}
                        />
                    </div>
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Total Servicios</label>
                        <input type="text" value={totalServicios} readOnly disabled
                            style={{ width: '100%', padding: '6px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#f3f4f6' }} />
                    </div>
                </div>

                {/* Row 3: Coordenadas Geograficas (Zona), UTM E, UTM S */}
                <div className="form-grid-row grid-cols-3">
                    <SearchableSelect
                        label="Coordenadas Geogr&aacute;ficas (Zona) *"
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
                                showToast({ type: 'warning', message: 'Debes ingresar el dato Frecuencia Muestreo', duration: 4000 });
                            }
                        }}
                        disabled={!frecuencia || String(frecuencia).trim() === ''}
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
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>UTM (E) *</label>
                        <input type="text" value={utmEste} onChange={(e) => setUtmEste(e.target.value)} disabled={!zona || zona === 'No aplica'}
                            style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', minHeight: '34px', backgroundColor: (!zona || zona === 'No aplica') ? '#f3f4f6' : 'white' }} />
                    </div>
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>UTM (N) *</label>
                        <input type="text" value={utmNorte} onChange={(e) => setUtmNorte(e.target.value)} disabled={!zona || zona === 'No aplica'}
                            style={{ width: '100%', padding: '6px 10px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', minHeight: '34px', backgroundColor: (!zona || zona === 'No aplica') ? '#f3f4f6' : 'white' }} />
                    </div>
                    <div style={{ width: '100%', minWidth: 0, display: 'flex', alignItems: 'flex-end', paddingBottom: '0' }}>
                    </div>
                </div>

                {/* --- Block 3: Clasificacion Tecnica --- */}
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1f2937', marginTop: '0.5rem', marginBottom: '0.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.2rem' }}>Clasificaci&oacute;n T&eacute;cnica</h3>

                {/* Row 1: Instrumento Ambiental, Nro, Anio */}
                <div className="form-grid-row grid-cols-3">
                    <SearchableSelect
                        label="Instrumento Ambiental *"
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
                            { id: 'RCA', nombre: 'RCA' },
                            { id: 'Res. Ex.', nombre: 'Res. Ex.' }, // Matches CommercialDetailView mapping
                            { id: 'Decreto', nombre: 'Decreto' },
                            { id: 'Carta', nombre: 'Carta' },
                            { id: 'Otro', nombre: 'Otro' },
                            { id: 'No aplica', nombre: 'No aplica' }
                        ]}
                    />

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>N&deg; *</label>
                            <input type="text" value={nroInstrumento} onChange={(e) => setNroInstrumento(e.target.value)}
                                style={{ width: '100%', padding: '6px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'text' }} />
                        </div>
                        <div className="form-group" style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>A&ntilde;o *</label>
                            <input type="text" value={anioInstrumento} onChange={(e) => setAnioInstrumento(e.target.value)}
                                style={{ width: '100%', padding: '6px', fontSize: '0.85rem', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'text' }} />
                        </div>
                    </div>

                    <SearchableSelect
                        label="Componente Ambiental *"
                        value={selectedComponente}
                        onChange={(val) => {
                            setSelectedComponente(val);
                            setSelectedSubArea(''); // InteractiveChange: Clear Sub Area
                        }}
                        options={[
                            { id: 'No Aplica', nombre: 'No Aplica' },
                            ...componentes.map(c => ({ id: c.id, nombre: c.nombre }))
                        ]}
                    />
                </div>

                {/* Row 2: Sub Area */}
                <div className="form-grid-row grid-cols-1">
                    <SearchableSelect
                        label="Sub &Aacute;rea *"
                        value={selectedSubArea}
                        onFocus={() => {
                            if (!selectedComponente || selectedComponente === '') {
                                showToast({ type: 'warning', message: 'Debes ingresar el dato Componente Ambiental', duration: 4000 });
                            }
                        }}
                        onChange={(val) => {
                            setSelectedSubArea(val);
                        }}
                        options={[
                            { id: 'No Aplica', nombre: 'No Aplica' },
                            ...subAreas.map(s => ({ id: s.id, nombre: s.nombre }))
                        ]}
                    />
                </div>

                {/* Row 3: Glosa and Counter */}
                {/* Row 3: Glosa and Counter */}
                <div className="form-grid-row grid-cols-1">
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Nombre de la tabla (Glosa) *</label>
                        <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
                            <input
                                type="text"
                                value={glosa}
                                maxLength={100}
                                onChange={(e) => {
                                    setGlosa(e.target.value);
                                }}
                                onBlur={() => {
                                    // LostFocus: Copy to Page2 (Analysis Tab). 
                                }}
                                style={{
                                    width: '100%',
                                    padding: '6px 60px 6px 10px', // Right padding for counter text
                                    fontSize: '0.85rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    outline: 'none',
                                    minHeight: '34px',
                                    backgroundColor: 'white',
                                    cursor: 'text'
                                }}
                            />
                            <span style={{
                                position: 'absolute',
                                right: '10px',
                                fontSize: '0.75rem',
                                color: '#9ca3af',
                                fontWeight: 500,
                                pointerEvents: 'none',
                                backgroundColor: 'transparent'
                            }}>
                                {glosa ? glosa.length : 0}/100
                            </span>
                        </div>
                    </div>
                </div>

                <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <SearchableSelect
                        label="¿Es ETFA?"
                        value={esETFA}
                        onChange={setEsETFA}
                        options={[{ id: 'Si', nombre: 'Si' }, { id: 'No', nombre: 'No' }]}
                    />
                    <SearchableSelect
                        label="Inspector Ambiental"
                        value={selectedInspector}
                        onChange={setSelectedInspector}
                        options={[
                            { id: 'No Aplica', nombre: 'No Aplica' },
                            ...inspectores.map((i: any) => ({
                                id: String(i.id_inspectorambiental || i.id || ''),
                                nombre: i.nombre_inspector || i.nombre || 'Sin Nombre'
                            }))
                        ]}
                        // Enabled if ADL is responsible, or just enabled to allow selection
                        disabled={responsableMuestreo !== 'ADL'}
                    />
                </div>

                {/* Row 8: Tipo Muestreo, Tipo Muestra, Actividad, Duracion, Tipo Descarga */}
                <div className="form-grid-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '1rem' }}>
                    <SearchableSelect
                        label="Tipo Muestreo *"
                        value={selectedTipoMuestreo}
                        onFocus={() => {
                            if (!glosa || glosa.trim() === '') {
                                showToast({ type: 'warning', message: 'Debes ingresar el dato Nombre de la tabla', duration: 4000 });
                            }
                        }}
                        onChange={(val) => {
                            setSelectedTipoMuestreo(val);
                            setSelectedTipoMuestra(''); // Reset child
                            // Removed duplicate API call - useEffect at line 312 handles this
                        }}
                        options={[
                            { id: 'No Aplica', nombre: 'No Aplica' },
                            ...tiposMuestreo.map(t => ({ id: t.id, nombre: t.nombre }))
                        ]}
                    />
                    <SearchableSelect
                        label="Tipo Muestra *"
                        value={selectedTipoMuestra}
                        onFocus={() => {
                            if (!selectedTipoMuestreo || selectedTipoMuestreo === '') {
                                showToast({ type: 'warning', message: 'Debes ingresar el dato Tipo de muestreo', duration: 4000 });
                            }
                        }}
                        onChange={(val) => {
                            setSelectedTipoMuestra(val);
                            setSelectedActividad(''); // Reset child
                            // Removed duplicate API call - useEffect at line 321 handles this
                        }}
                        options={[
                            { id: 'No Aplica', nombre: 'No Aplica' },
                            ...tiposMuestra.map((t: any) => ({
                                id: String(t.id_tipomuestra_ma || t.id || ''),
                                nombre: t.nombre_tipomuestra_ma || t.nombre || t.Nombre || 'Sin Nombre'
                            }))
                        ]}
                    />
                    <SearchableSelect
                        label="Actividad Muestreo *"
                        value={selectedActividad}
                        onFocus={() => {
                            if (!selectedTipoMuestra || selectedTipoMuestra === '') {
                                showToast({ type: 'warning', message: 'Debes ingresar el dato Tipo de muestra', duration: 4000 });
                                return false;
                            }
                        }}
                        onChange={(val) => {
                            setSelectedActividad(val);
                            if (val === 'No Aplica') setDuracion('');
                        }}
                        options={[
                            { id: 'No Aplica', nombre: 'No Aplica' },
                            ...actividades.map((a: any) => ({
                                id: String(a.id_actividadmuestreo || a.id || ''),
                                nombre: a.nombre_actividadmuestreo || a.nombre || a.Nombre || 'Sin Nombre'
                            }))
                        ]}
                    />
                    <div className="form-group">
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>Duraci&oacute;n (Hrs) *</label>
                        <input type="number" value={duracion} onChange={(e) => setDuracion(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '6px',
                                fontSize: '0.85rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                backgroundColor: 'white',
                                cursor: 'text'
                            }} />
                    </div>
                    <SearchableSelect
                        label="Tipo Descarga"
                        value={selectedTipoDescarga}
                        onChange={(val) => {
                            setSelectedTipoDescarga(val);
                            if (val === 'No Aplica') setRefGoogle('No Aplica');
                            else if (refGoogle === 'No Aplica') setRefGoogle('');
                        }}
                        options={[
                            { id: 'No Aplica', nombre: 'No Aplica' },
                            ...tiposDescarga.map((t: any) => ({
                                id: String(t.id || t.ID || t.id_tipodescarga || ''),
                                nombre: t.nombre || t.Nombre || t.nombre_tipodescarga || 'Sin Nombre'
                            }))
                        ]}
                        disabled={tipoMonitoreo !== 'Puntual' && (!duracion || duracion.trim() === '')}
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
                            onChange={(e) => setRefGoogle(e.target.value)}
                            disabled={tipoMonitoreo !== 'Puntual' && (!selectedTipoDescarga || selectedTipoDescarga === '' || selectedTipoDescarga === 'No Aplica')}
                            style={{
                                width: '100%',
                                padding: '6px',
                                fontSize: '0.85rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '6px',
                                backgroundColor: (tipoMonitoreo !== 'Puntual' && (!selectedTipoDescarga || selectedTipoDescarga === '' || selectedTipoDescarga === 'No Aplica')) ? '#f3f4f6' : 'white',
                                cursor: (tipoMonitoreo !== 'Puntual' && (!selectedTipoDescarga || selectedTipoDescarga === '' || selectedTipoDescarga === 'No Aplica')) ? 'not-allowed' : 'text'
                            }}
                        />
                    </div>
                </div>

                {/* Row 10: Medicion Caudal, Modalidad, Forma Canal, Dispositivo */}
                <div className="form-grid-row grid-cols-4">
                    <SearchableSelect label="Medici&oacute;n Caudal" value={medicionCaudal} onChange={setMedicionCaudal}
                        options={[
                            { id: 'No Aplica', nombre: 'No Aplica' },
                            { id: 'Automático', nombre: 'Automático' },
                            { id: 'Manual', nombre: 'Manual' }
                        ]}
                    />
                    <SearchableSelect
                        label="Modalidad"
                        value={selectedModalidad}
                        onChange={(val) => {
                            setSelectedModalidad(val);
                            if (val === 'No Aplica') {
                                setFormaCanal('No Aplica');
                                setDetalleCanal('No Aplica');
                                setDispositivo('No Aplica');
                                setDetalleDispositivo('No Aplica');
                            } else if (!val || val.trim() === '') {
                                setFormaCanal('');
                                setDetalleCanal('');
                                setDispositivo('');
                                setDetalleDispositivo('');
                            }
                        }}
                        options={[
                            { id: 'No Aplica', nombre: 'No Aplica' },
                            ...modalidades.map((m: any) => ({
                                id: String(m.id_modalidad || m.id || m.ID || ''),
                                nombre: m.nombre_modalidad || m.nombre || m.Nombre || 'Sin Nombre'
                            }))
                        ]}
                        disabled={!medicionCaudal || medicionCaudal === '' || medicionCaudal === 'No Aplica'}
                    />

                    {/* Group: Forma Canal + Detalle */}
                    <div>
                        <SearchableSelect
                            label="Forma Canal"
                            value={formaCanal}
                            onChange={(val) => {
                                setFormaCanal(val);
                                if (val === 'No Aplica') setDetalleCanal('No Aplica');
                                else if (detalleCanal === 'No Aplica') setDetalleCanal('');
                            }}
                            options={[
                                { id: 'No Aplica', nombre: 'No Aplica' },
                                ...formasCanal
                            ]}
                            disabled={!selectedModalidad || selectedModalidad === '' || selectedModalidad === 'No Aplica'}
                        />
                        <div style={{ marginTop: '4px' }}>
                            <input
                                type="text"
                                placeholder="Medida Canal"
                                value={detalleCanal}
                                onChange={(e) => setDetalleCanal(e.target.value)}
                                disabled={!formaCanal || formaCanal === 'No Aplica'}
                                style={{
                                    width: '100%',
                                    padding: '6px',
                                    fontSize: '0.85rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    backgroundColor: (!formaCanal || formaCanal === 'No Aplica') ? '#f3f4f6' : 'white',
                                    cursor: (!formaCanal || formaCanal === 'No Aplica') ? 'not-allowed' : 'text'
                                }}
                            />
                        </div>
                    </div>

                    {/* Group: Dispositivo + Detalle */}
                    <div>
                        <SearchableSelect
                            label="Dispositivo Hidr&aacute;ulico"
                            value={dispositivo}
                            onChange={(val) => {
                                setDispositivo(val);
                                if (val === 'No Aplica') setDetalleDispositivo('No Aplica');
                                else if (detalleDispositivo === 'No Aplica') setDetalleDispositivo('');
                            }}
                            options={[
                                { id: 'No Aplica', nombre: 'No Aplica' },
                                ...dispositivos
                            ]}
                            disabled={!selectedModalidad || selectedModalidad === '' || selectedModalidad === 'No Aplica'}
                        />
                        <div style={{ marginTop: '4px' }}>
                            <input
                                type="text"
                                placeholder="Medida Dispositivo"
                                value={detalleDispositivo}
                                onChange={(e) => setDetalleDispositivo(e.target.value)}
                                disabled={!dispositivo || dispositivo === 'No Aplica'}
                                style={{
                                    width: '100%',
                                    padding: '6px',
                                    fontSize: '0.85rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '6px',
                                    backgroundColor: (!dispositivo || dispositivo === 'No Aplica') ? '#f3f4f6' : 'white',
                                    cursor: (!dispositivo || dispositivo === 'No Aplica') ? 'not-allowed' : 'text'
                                }}
                            />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
});
