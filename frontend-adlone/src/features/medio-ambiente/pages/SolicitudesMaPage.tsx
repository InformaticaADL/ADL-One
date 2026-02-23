import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavStore } from '../../../store/navStore';

import { adminService } from '../../../services/admin.service';
import { equipoService } from '../../admin/services/equipo.service';
import type { Equipo } from '../../admin/services/equipo.service';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { HybridSelect } from '../../../components/ui/HybridSelect';
import '../styles/FichasIngreso.css'; // Reusing established styles
import '../../admin/admin.css';

interface Props {
    onBack?: () => void;
    viewOnly?: boolean;
}

type SolicitudeType = 'ALTA' | 'TRASPASO' | 'BAJA' | 'REVISION' | 'VIGENCIA_PROXIMA' | 'EQUIPO_PERDIDO' | 'REPORTE_PROBLEMA' | 'NUEVO_EQUIPO' | 'EQUIPO_DESHABILITADO';
type TabType = 'PENDIENTES' | 'REVISION' | 'POR_VALIDAR' | 'HISTORIAL';

// --- Componente CustomSelect Animado (Reused from EquiposPage) ---
interface CustomSelectProps {
    value: string;
    options: string[];
    onChange: (val: string) => void;
    label?: string;
    width?: string;
    height?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, options, onChange, label, width = '140px', height = '42px' }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`custom-select-container ${isOpen ? 'open' : ''}`} style={{ width }} ref={containerRef}>
            <div
                className="custom-select-trigger"
                onClick={() => setIsOpen(!isOpen)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', height }}
            >
                <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {(!value || value === 'Todos') ? (
                        <span style={{ color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }}>{label}</span>
                    ) : (
                        <span style={{ color: '#1e293b', fontWeight: 600 }}>{value}</span>
                    )}
                </span>
                <svg className="select-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: 'auto' }}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>
            {isOpen && (
                <div className="custom-options">
                    {options.map((opt) => (
                        <div
                            key={opt}
                            className={`custom-option ${value === opt ? 'selected' : ''}`}
                            onClick={() => {
                                onChange(opt);
                                setIsOpen(false);
                            }}
                            style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                padding: '0.6rem 1rem'
                            }}
                            title={opt}
                        >
                            {opt}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const SolicitudesMaPage: React.FC<Props> = ({ onBack, viewOnly = false }) => {
    const { showToast } = useToast();
    const { hasPermission, user } = useAuth();
    const [isReplying, setIsReplying] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>(viewOnly ? 'POR_VALIDAR' : 'PENDIENTES');
    const [viewMode, setViewMode] = useState<'LIST' | 'FORM'>('LIST');
    const [type, setType] = useState<SolicitudeType>('NUEVO_EQUIPO');
    const isAlta = type === 'ALTA';
    const isNuevoEq = type === 'NUEVO_EQUIPO';
    const [loading, setLoading] = useState(false);

    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);

    // Permission checks
    const isGCMan = hasPermission('AI_GC_EQUIPOS') || hasPermission('AI_GC_ACCESO');
    const isMAMan = hasPermission('AI_MA_SOLICITUDES') || hasPermission('AI_MA_EQUIPOS');
    const isSuperAdmin = hasPermission('MA_ADMIN_ACCESO');

    // Data for selectors
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [muestreadores, setMuestreadores] = useState<any[]>([]);

    // List of equipment for bulk deletion / reactivation
    const [equiposBaja, setEquiposBaja] = useState<{ id: string; nombre: string }[]>([]);
    const [equiposAlta, setEquiposAlta] = useState<{ id: string; nombre: string; vigencia: string; datos_originales?: Equipo }[]>([]);

    // History of user's own requests
    // History and Lists
    const [incomingRequests, setIncomingRequests] = useState<any[]>([]); // Muestreador -> Tecnica
    const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]); // Tecnica -> Calidad
    const [qualityVouchers, setQualityVouchers] = useState<any[]>([]);   // Special "Vouchers" view
    const [reviewedHistory, setReviewedHistory] = useState<any[]>([]);   // Reviewed by me
    const [respondedHistory, setRespondedHistory] = useState<any[]>([]); // Responded by Calidad

    // Modal Review State
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showConfirmConclude, setShowConfirmConclude] = useState(false);
    const [reviewFeedback, setReviewFeedback] = useState('');
    const [reviewAction, setReviewAction] = useState<'DERIVADO' | 'RECHAZADO' | 'CONCLUIDO' | null>(null);
    const [editedData, setEditedData] = useState<any>(null);

    const getTipoLabel = (tipo: string) => {
        if (tipo === 'ALTA') return 'Activación/Creación';
        if (tipo === 'BAJA') return 'Baja de Equipo';
        if (tipo === 'TRASPASO') return 'Traspaso';
        if (tipo === 'REVISION') return 'Revisión';
        if (tipo === 'VIGENCIA_PROXIMA') return 'Vigencia Próxima';
        if (tipo === 'EQUIPO_PERDIDO') return 'Baja por Pérdida';
        if (tipo === 'REPORTE_PROBLEMA') return 'Reporte de Problema';
        if (tipo === 'NUEVO_EQUIPO') return 'Nuevo Equipo';
        if (tipo === 'EQUIPO_DESHABILITADO') return 'Equipo Deshabilitado';
        return tipo.replace(/_/g, ' ');
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'EN_REVISION_TECNICA': return 'EN REVISIÓN';
            case 'PENDIENTE_TECNICA': return 'PENDIENTE TÉCNICA';
            case 'PENDIENTE_CALIDAD': return 'PENDIENTE';
            case 'RECHAZADO_TECNICA': return 'RECHAZADO TÉCNICA';
            default: return status.replace(/_/g, ' ');
        }
    };

    // Date formatter to handle different formats safely
    const formatDateValue = (dateVal: any) => {
        if (!dateVal) return 'N/A';
        // If it already looks like dd/mm/yyyy, return as is
        if (typeof dateVal === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateVal)) {
            return dateVal;
        }

        try {
            const date = new Date(dateVal);
            if (isNaN(date.getTime())) return String(dateVal);
            return date.toLocaleDateString('es-ES');
        } catch {
            return String(dateVal);
        }
    };

    // Reset edited data when modal closes or request changes
    useEffect(() => {
        if (selectedRequest) {
            setEditedData(selectedRequest.datos_json);
        } else {
            setEditedData(null);
        }
    }, [selectedRequest, showReviewModal]);


    // Pagination for outgoing requests
    const [outgoingPage, setOutgoingPage] = useState(0);
    const [incomingPage, setIncomingPage] = useState(0);
    const [voucherPage, setVoucherPage] = useState(0);
    const [historialPage, setHistorialPage] = useState(0);
    const ITEMS_PER_PAGE = 5;

    const { pendingRequestId, setPendingRequestId } = useNavStore();


    // Catalogs for dynamic selectors
    const [tiposCatalogo, setTiposCatalogo] = useState<string[]>([]);
    const [nombresCatalogo, setNombresCatalogo] = useState<string[]>([]);
    const [sedesCatalogo, setSedesCatalogo] = useState<string[]>([]);


    const INITIAL_FORM_DATA = {
        // Alta fields
        codigo: '',
        nombre: '',
        tipo: '',
        ubicacion: '',
        responsable: '',
        id_muestreador: '',
        vigencia: '',

        // Traspaso / Baja shared
        id_equipo: '',
        id_equipo_original: null as number | null,
        nueva_ubicacion: '',
        nuevo_responsable: '',
        motivo: '',

        // REVISION fields
        motivo_revision: '',
        descripcion: '',
        urgencia: '',

        // VIGENCIA_PROXIMA fields
        vigencia_actual: '',
        nueva_vigencia_solicitada: '',
        justificacion: '',

        // EQUIPO_PERDIDO fields
        fecha_incidente: '',
        ubicacion_ultima: '',
        circunstancias: '',
        tipo_perdida: '',
        acciones_tomadas: '',
        testigos: '',

        // REPORTE_PROBLEMA fields
        tipo_problema: '',
        severidad: '',
        sintomas: '',
        frecuencia: '',
        afecta_mediciones: false
    };

    // Form Data
    const [formData, setFormData] = useState(INITIAL_FORM_DATA);
    const [isReactivation, setIsReactivation] = useState(false);
    const [altaSubtype, setAltaSubtype] = useState<'CREAR' | 'ACTIVAR' | null>(null);
    const [pendingBajaIds, setPendingBajaIds] = useState<string[]>([]);
    const [generatingCode, setGeneratingCode] = useState(false);

    // Filter and Search State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTipo, setFilterTipo] = useState('');
    const [filterEquipo, setFilterEquipo] = useState('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const filterMenuRef = useRef<HTMLDivElement>(null);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [directToQuality, setDirectToQuality] = useState(true);

    // --- Filtering Logic ---
    const handleClearFilters = () => {
        setSearchTerm('');
        setFilterTipo('');
        setFilterEquipo('');
    };

    const hasActiveFilters = searchTerm !== '' || filterTipo !== '' || filterEquipo !== '';

    // Click outside listener for filters
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showMobileFilters && filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
                setShowMobileFilters(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMobileFilters]);

    // Helper to check if a request matches the filters
    const matchesFilters = (sol: any) => {
        const d = sol.datos_json || {};
        const eqInfo = equipos.find(e => String(e.id_equipo) === String(d.id_equipo)) as Equipo | undefined;

        // 1. Search Term (Focus on Equipment Type and common fields)
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            const equipType = (d.tipo || d.tipo_equipo || eqInfo?.tipo || '').toLowerCase();
            const nombre = (d.nombre || d.nombre_equipo || eqInfo?.nombre || '').toLowerCase();
            const codigo = (d.codigo || d.codigo_equipo || eqInfo?.codigo || '').toLowerCase();
            const tipoLabel = getTipoLabel(sol.tipo_solicitud).toLowerCase();

            if (!equipType.includes(search) &&
                !nombre.includes(search) &&
                !codigo.includes(search) &&
                !tipoLabel.includes(search)) {
                return false;
            }
        }

        // 2. Filter Tipo de Solicitud
        if (filterTipo && filterTipo !== 'Todos') {
            if (getTipoLabel(sol.tipo_solicitud) !== filterTipo) return false;
        }

        // 3. Filter Tipo de Equipo
        if (filterEquipo && filterEquipo !== 'Todos') {
            const equipType = d.tipo || d.tipo_equipo || eqInfo?.tipo || '';
            if (equipType !== filterEquipo) return false;
        }

        return true;
    };

    const filteredIncoming = useMemo(() => incomingRequests.filter(matchesFilters), [incomingRequests, searchTerm, filterTipo, filterEquipo, equipos]);
    const filteredOutgoing = useMemo(() => outgoingRequests.filter(matchesFilters), [outgoingRequests, searchTerm, filterTipo, filterEquipo, equipos]);
    const filteredVouchers = useMemo(() => qualityVouchers.filter(matchesFilters), [qualityVouchers, searchTerm, filterTipo, filterEquipo, equipos]);
    const filteredHistory = useMemo(() => {
        const combined = [...reviewedHistory, ...respondedHistory];
        return combined.filter(matchesFilters).sort((a, b) => new Date(b.fecha_solicitud).getTime() - new Date(a.fecha_solicitud).getTime());
    }, [reviewedHistory, respondedHistory, searchTerm, filterTipo, filterEquipo, equipos]);

    // Reset pagination when filters change
    useEffect(() => {
        setIncomingPage(0);
        setOutgoingPage(0);
        setVoucherPage(0);
        setHistorialPage(0);
    }, [searchTerm, filterTipo, filterEquipo]);

    // Update catalogs based on equipment data
    useEffect(() => {
        if (equipos.length > 0) {
            const sedes = Array.from(new Set(equipos.map(e => e.ubicacion).filter(Boolean)));
            setSedesCatalogo(sedes.sort());
        }
    }, [equipos]);

    const loadHistory = async () => {
        try {
            // Role detection for worklist selection
            // Role detection already handled at component level

            // 1. Incoming (Pendientes Tab): Work waiting for ME
            // For MA (Technical): ONLY PENDIENTE_TECNICA (PENDIENTE_CALIDAD goes to History)
            // For GC (Quality): ONLY PENDIENTE_CALIDAD
            // Note: If user has both permissions, prioritize MA view (Technical Area)
            let incomingStatesArr: string[] = [];

            if (isSuperAdmin) {
                incomingStatesArr.push('PENDIENTE_TECNICA', 'PENDIENTE_CALIDAD');
            } else {
                if (isMAMan) {
                    incomingStatesArr.push('PENDIENTE_TECNICA');
                }
                if (isGCMan) {
                    incomingStatesArr.push('PENDIENTE_CALIDAD');
                }
            }

            const incomingStates = incomingStatesArr.join(',');

            const incoming = await adminService.getSolicitudes({
                estado: incomingStates || 'PENDIENTE_TECNICA',
                origen_solicitud: isMAMan ? 'MUESTREADOR' : undefined
            });

            // User Request: Include all relevant management types in the Pendientes tab.
            // Note: REVISION and REPORTE_PROBLEMA were previously excluded but are restored for visibility.
            const managementTypes = [
                'ALTA', 'BAJA', 'TRASPASO', 'VIGENCIA_PROXIMA',
                'EQUIPO_PERDIDO', 'NUEVO_EQUIPO', 'CONSULTA_GENERAL',
                'EQUIPO_DESHABILITADO', 'REPORTE_PROBLEMA', 'REVISION'
            ];
            const filteredIncoming = incoming.filter((s: any) => managementTypes.includes(s.tipo_solicitud));

            setIncomingRequests(filteredIncoming);

            // 2. En Revisión (Outgoing Tab): Work being actively reviewed by Technical Area
            // For MA: EN_REVISION_TECNICA (accepted and under review)
            // For GC: Nothing (they don't have an "in review" stage)
            let outgoingStates = '';
            if (isMAMan || isSuperAdmin) {
                outgoingStates = 'EN_REVISION_TECNICA';
            }

            if (outgoingStates) {
                const outgoing = await adminService.getSolicitudes({
                    estado: outgoingStates
                });
                setOutgoingRequests(outgoing);
            } else {
                setOutgoingRequests([]);
            }

            // 3. Technical History: Requests where Technical Area completed their work
            // - RECHAZADO_TECNICA: Rejected by Tech
            // - PENDIENTE_CALIDAD: Approved by Tech and sent to Quality (Tech work is done)
            if (isMAMan || isSuperAdmin) {
                const reviewed = await adminService.getSolicitudes({
                    estado: 'RECHAZADO_TECNICA,PENDIENTE_CALIDAD'
                });
                setReviewedHistory(reviewed);
            }

            // 4. Final History: Responded by Quality (Approved or Rejected)
            const responded = await adminService.getSolicitudes({
                estado: 'APROBADO,RECHAZADO'
            });
            setRespondedHistory(responded);

            // 5. Quality Vouchers: Specific view for items pending Quality validation AND Evidence of closed items
            // Filter: PENDIENTE_CALIDAD, APROBADO, RECHAZADO and types: EQUIPO_PERDIDO (Baja perdida), REPORTE_PROBLEMA, REVISION
            // Only show requests derived to Quality by Technical Area or already closed.
            const vouchers = await adminService.getSolicitudes({
                estado: 'PENDIENTE_CALIDAD,APROBADO,RECHAZADO'
            });
            const voucherTypes = ['EQUIPO_PERDIDO', 'REPORTE_PROBLEMA', 'REVISION', 'BAJA'];
            const filteredVouchers = vouchers.filter((v: any) => voucherTypes.includes(v.tipo_solicitud));
            setQualityVouchers(filteredVouchers);

        } catch (error) {
            console.error("Error loading lists:", error);
        }
    };



    const loadInitialData = async () => {
        try {
            // For Traspaso/Baja we need the equipment list
            const equiposRes = await equipoService.getEquipos({ limit: 1000 });
            setEquipos(equiposRes.data || []);

            // Set dynamic catalogs
            if (equiposRes.catalogs) {
                setTiposCatalogo(equiposRes.catalogs.tipos || []);
                setNombresCatalogo(equiposRes.catalogs.nombres || []);
                setSedesCatalogo(equiposRes.catalogs.sedes || []);
            }


            // For Alta we might need responsible list (muestreadores)
            const mueRes = await adminService.getMuestreadores('', 'ACTIVOS');
            setMuestreadores(mueRes.data || []);

            loadHistory();

            const pendingRes = await adminService.getSolicitudes({ estado: 'PENDIENTE_CALIDAD,PENDIENTE_TECNICA' });
            const ids: string[] = [];
            pendingRes.forEach((sol: any) => {
                if (sol.tipo_solicitud === 'BAJA' && sol.datos_json?.equipos_baja) {
                    sol.datos_json.equipos_baja.forEach((eb: any) => ids.push(String(eb.id)));
                }
            });
            setPendingBajaIds(ids);
        } catch (error) {
            console.error("Error loading data for solicitudes:", error);
        }
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    // Handle automatic selection reactively whenever pendingRequestId changes
    // Handle automatic selection from nav
    useEffect(() => {
        if (pendingRequestId) {
            // Search in all lists
            const all = [...incomingRequests, ...outgoingRequests, ...reviewedHistory, ...respondedHistory];
            const found = all.find(s => String(s.id_solicitud) === String(pendingRequestId));
            if (found) {
                // Determine which tab to open
                if (found.estado === 'PENDIENTE_TECNICA' || found.estado === 'PENDIENTE_CALIDAD') {
                    setActiveTab('PENDIENTES');
                    if (found.estado === 'PENDIENTE_TECNICA') {
                        // Open modal if it is incoming
                        setSelectedRequest(found);
                        setShowReviewModal(true);
                    }
                } else {
                    setActiveTab('HISTORIAL');
                }
                setPendingRequestId(null);
            }
        }
    }, [pendingRequestId, incomingRequests, outgoingRequests, reviewedHistory, respondedHistory, setPendingRequestId]);



    useEffect(() => {
        const canGenerate = ((altaSubtype === 'CREAR' && type === 'ALTA') || type === 'NUEVO_EQUIPO') &&
            formData.nombre &&
            formData.tipo &&
            formData.ubicacion &&
            formData.responsable &&
            formData.id_muestreador &&
            formData.vigencia;

        if (canGenerate) {
            const timer = setTimeout(async () => {
                setGeneratingCode(true);
                try {
                    const res = await equipoService.suggestNextCode(formData.tipo, formData.ubicacion, formData.nombre);
                    if (res.success && res.data.suggestedCode) {
                        setFormData(prev => ({ ...prev, codigo: res.data.suggestedCode }));
                    }
                } catch (error) {
                    console.error("Error suggesting code:", error);
                } finally {
                    setGeneratingCode(false);
                }
            }, 600); // Debounce to avoid too many calls while typing last fields
            return () => clearTimeout(timer);
        }
    }, [formData.nombre, formData.tipo, formData.ubicacion, formData.responsable, formData.id_muestreador, formData.vigencia, altaSubtype, type]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        confirmSubmit();
    };


    const confirmSubmit = async () => {
        setLoading(true);
        // setShowConfirm(false); // Removed unused state update
        try {
            // Find IDs for names picked from suggestions to maintain data integrity
            const matchingResponsable = muestreadores.find(m => m.nombre_muestreador === formData.responsable);
            const matchingNuevoResponsable = muestreadores.find(m => m.nombre_muestreador === formData.nuevo_responsable);

            // If originated from Technical Web, it goes to Quality directly (PENDIENTE_CALIDAD)
            // Backend handles this based on origen_solicitud logic we added
            let specificData = {};

            switch (type) {
                case 'ALTA':
                    specificData = {
                        codigo: formData.codigo,
                        nombre: formData.nombre,
                        tipo: formData.tipo,
                        ubicacion: formData.ubicacion,
                        responsable: formData.responsable,
                        id_muestreador: formData.id_muestreador || matchingResponsable?.id_muestreador || null,
                        vigencia: formData.vigencia,
                        isReactivation,
                        equipos_alta: isReactivation ? equiposAlta : null
                    };
                    break;
                case 'NUEVO_EQUIPO':
                    specificData = {
                        codigo: formData.codigo,
                        nombre: formData.nombre,
                        tipo: formData.tipo,
                        ubicacion: formData.ubicacion,
                        responsable: formData.responsable,
                        id_muestreador: formData.id_muestreador || matchingResponsable?.id_muestreador || null,
                        vigencia: formData.vigencia,
                        motivo: formData.motivo
                    };
                    break;
                case 'BAJA':
                    specificData = {
                        motivo: formData.motivo,
                        equipos_baja: equiposBaja
                    };
                    break;
                case 'TRASPASO':
                    const originalEq = equipos.find(e => String(e.id_equipo) === formData.id_equipo);
                    specificData = {
                        id_equipo: formData.id_equipo,
                        nueva_ubicacion: formData.nueva_ubicacion,
                        nuevo_responsable: formData.nuevo_responsable,
                        nuevo_responsable_id: matchingNuevoResponsable?.id_muestreador || null,
                        motivo: formData.motivo,
                        ...(originalEq ? {
                            equipo_nombre: originalEq.nombre,
                            equipo_codigo: originalEq.codigo,
                            equipo_tipo: originalEq.tipo,
                            ubicacion_actual: originalEq.ubicacion,
                            responsable_actual: originalEq.nombre_asignado
                        } : {})
                    };
                    break;
                case 'REVISION':
                    const revEq = equipos.find(e => String(e.id_equipo) === formData.id_equipo);
                    specificData = {
                        id_equipo: formData.id_equipo,
                        motivo_revision: formData.motivo_revision,
                        descripcion: formData.descripcion,
                        urgencia: formData.urgencia,
                        nombre: revEq?.nombre,
                        codigo: revEq?.codigo,
                        tipo: revEq?.tipo,
                        ubicacion: revEq?.ubicacion,
                        vigencia: revEq?.vigencia,
                        id_muestreador: revEq?.id_muestreador,
                        responsable: revEq?.nombre_asignado
                    };
                    break;
                case 'VIGENCIA_PROXIMA':
                    const vigEq = equipos.find(e => String(e.id_equipo) === formData.id_equipo);
                    specificData = {
                        id_equipo: formData.id_equipo,
                        vigencia_actual: formData.vigencia_actual,
                        nueva_vigencia_solicitada: formData.nueva_vigencia_solicitada,
                        justificacion: formData.justificacion,
                        nombre: vigEq?.nombre,
                        codigo: vigEq?.codigo,
                        tipo: vigEq?.tipo,
                        ubicacion: vigEq?.ubicacion,
                        vigencia: vigEq?.vigencia,
                        id_muestreador: vigEq?.id_muestreador,
                        responsable: vigEq?.nombre_asignado
                    };
                    break;
                case 'EQUIPO_PERDIDO':
                    const lostEq = equipos.find(e => String(e.id_equipo) === formData.id_equipo);
                    specificData = {
                        id_equipo: formData.id_equipo,
                        fecha_incidente: formData.fecha_incidente,
                        tipo_perdida: formData.tipo_perdida,
                        ubicacion_ultima: formData.ubicacion_ultima,
                        circunstancias: formData.circunstancias,
                        acciones_tomadas: formData.acciones_tomadas,
                        testigos: formData.testigos,
                        nombre: lostEq?.nombre,
                        codigo: lostEq?.codigo,
                        tipo: lostEq?.tipo,
                        ubicacion_registrada: lostEq?.ubicacion,
                        vigencia: lostEq?.vigencia,
                        id_muestreador: lostEq?.id_muestreador,
                        responsable: lostEq?.nombre_asignado
                    };
                    break;
                case 'REPORTE_PROBLEMA':
                    const probEq = equipos.find(e => String(e.id_equipo) === formData.id_equipo);
                    specificData = {
                        id_equipo: formData.id_equipo,
                        tipo_problema: formData.tipo_problema,
                        frecuencia: formData.frecuencia,
                        afecta_mediciones: formData.afecta_mediciones,
                        descripcion: formData.descripcion,
                        sintomas: formData.sintomas,
                        nombre: probEq?.nombre,
                        codigo: probEq?.codigo,
                        tipo: probEq?.tipo,
                        ubicacion: probEq?.ubicacion,
                        vigencia: probEq?.vigencia,
                        id_muestreador: probEq?.id_muestreador,
                        responsable: probEq?.nombre_asignado
                    };
                    break;
                case 'EQUIPO_DESHABILITADO':
                    const deshabEq = equipos.find(e => String(e.id_equipo) === formData.id_equipo);
                    specificData = {
                        id_equipo: formData.id_equipo,
                        motivo: formData.motivo || formData.descripcion,
                        nombre: deshabEq?.nombre,
                        codigo: deshabEq?.codigo,
                        tipo: deshabEq?.tipo,
                        ubicacion: deshabEq?.ubicacion,
                        vigencia: formData.vigencia, // Nueva vigencia propuesta
                        id_muestreador: deshabEq?.id_muestreador,
                        responsable: deshabEq?.nombre_asignado
                    };
                    break;
            }

            const payload = {
                tipo_solicitud: type,
                origen_solicitud: ((isMAMan || isSuperAdmin) && directToQuality) ? 'TECNICA' : 'MUESTREADOR',
                datos_json: specificData
            };

            await adminService.createSolicitud(payload);

            const sentToQuality = (isMAMan || isSuperAdmin) && directToQuality;

            showToast({
                type: 'success',
                message: `Solicitud de ${type.toLowerCase()} enviada ${sentToQuality ? 'directamente a Calidad' : 'al Área Técnica'}`,
                duration: 5000
            });

            setFormData(INITIAL_FORM_DATA);
            setAltaSubtype(null);

            if (type === 'BAJA') {
                const newIds = equiposBaja.map(eb => String(eb.id));
                setPendingBajaIds(prev => [...prev, ...newIds]);
            }

            setIsReactivation(false);
            setEquiposBaja([]);
            setEquiposAlta([]);
            loadHistory();

        } catch (error) {
            showToast({
                type: 'error',
                message: 'Error al enviar la solicitud',
                duration: 5000
            });
        } finally {
            setLoading(false);
        }
    };

    const submitTechnicalReview = async () => {
        if (!selectedRequest || !reviewAction) return;
        setLoading(true);
        try {
            // If PENDIENTE_TECNICA and DERIVADO action, accept for review (move to EN_REVISION_TECNICA)
            if (selectedRequest.estado === 'PENDIENTE_TECNICA' && reviewAction === 'DERIVADO') {
                await adminService.acceptSolicitudForReview(selectedRequest.id_solicitud, reviewFeedback);
                showToast({
                    type: 'success',
                    message: 'Solicitud aceptada para revisión',
                    duration: 4000
                });
            }
            // If CONCLUIDO action, Approve directly (bypass Calidad)
            else if (reviewAction === 'CONCLUIDO') {
                await adminService.updateSolicitudStatus(
                    selectedRequest.id_solicitud,
                    'APROBADO',
                    reviewFeedback,
                    editedData
                );
                showToast({
                    type: 'success',
                    message: selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' ? 'Equipo fuera de servicio procesado correctamente' : 'Solicitud aprobada y concluida correctamente',
                    duration: 4000
                });
            }
            // If EN_REVISION_TECNICA or PENDIENTE_TECNICA with RECHAZADO, use reviewTechnical
            else {
                await adminService.reviewSolicitudTechnical(
                    selectedRequest.id_solicitud,
                    reviewAction,
                    reviewFeedback || '',
                    editedData // Send edited data
                );
                showToast({
                    type: 'success',
                    message: `Solicitud ${reviewAction === 'DERIVADO' ? 'aprobada y derivada' : 'rechazada'} correctamente`,
                    duration: 4000
                });
            }

            setShowReviewModal(false);
            setSelectedRequest(null);
            setReviewFeedback('');
            setReviewAction(null);
            loadHistory();
        } catch (error) {
            showToast({
                type: 'error',
                message: 'Error al procesar la revisión técnica',
                duration: 5000
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSendReply = async () => {
        if (!reviewFeedback.trim()) {
            showToast({ type: 'error', message: 'Debe ingresar una respuesta.' });
            return;
        }

        setLoading(true);
        try {
            await adminService.updateSolicitudStatus(
                selectedRequest.id_solicitud,
                'APROBADO',
                reviewFeedback,
                undefined,
                undefined,
                'APROBADO'
            );

            showToast({ type: 'success', message: 'Respuesta enviada correctamente.' });

            // Local update to keep it visible
            setQualityVouchers(prev => prev.map(v =>
                v.id_solicitud === selectedRequest.id_solicitud
                    ? {
                        ...v,
                        estado: 'APROBADO',
                        feedback_admin: reviewFeedback,
                        usuario_aprueba_nombre: (user as any)?.nombre || 'Administrador'
                    }
                    : v
            ));

            // Also update history lists if present
            setRespondedHistory(prev => [
                {
                    ...selectedRequest,
                    estado: 'APROBADO',
                    feedback_admin: reviewFeedback,
                    usuario_aprueba_nombre: (user as any)?.nombre || 'Administrador',
                    fecha_final: new Date().toISOString()
                },
                ...prev
            ]);

            setIsReplying(false);
            setReviewFeedback('');
            setShowReviewModal(false);

        } catch (error) {
            console.error(error);
            showToast({ type: 'error', message: 'Error al enviar respuesta.' });
        } finally {
            setLoading(false);
        }
    };



    const handleOpenDetails = (request: any, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedRequest(request);

        // Only show review modal if it's actually reviewable
        const isReviewable = !viewOnly && (request.estado === 'PENDIENTE_TECNICA' || request.estado === 'EN_REVISION_TECNICA' || request.estado === 'PENDIENTE_CALIDAD');
        setShowReviewModal(isReviewable);
        setReviewAction(null);
        setReviewFeedback('');

        if (isGCMan && request.estado === 'PENDIENTE_CALIDAD') {
            setReviewFeedback('');
        }
    };

    return (
        <div className="admin-container" style={{ paddingTop: '0.25rem', height: '100dvh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* --- SECCIÓN FIJA SUPERIOR --- */}
            <div style={{ padding: '0.25rem 1rem 0', background: 'transparent', zIndex: 10 }}>
                <div className="admin-header-section responsive-header">
                    <div style={{ justifySelf: 'start' }}>
                        {(onBack || viewMode === 'FORM') && (
                            <button
                                onClick={() => {
                                    if (viewMode === 'FORM') {
                                        setViewMode('LIST');
                                    } else if (onBack) {
                                        onBack();
                                    }
                                }}
                                className="btn-back"
                                style={{ margin: 0 }}
                            >
                                <span className="icon-circle" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                                </span> Volver
                            </button>
                        )}
                    </div>
                    <div style={{ justifySelf: 'center', textAlign: 'center' }}>
                        <h1 className="admin-title" style={{ margin: '0 0 0.1rem 0', fontSize: '1.25rem' }}>
                            {viewMode === 'LIST' ? (viewOnly ? 'Reportes y Vouchers' : 'Gestión de Solicitudes') : 'Nueva Solicitud'}
                        </h1>
                        {viewMode === 'LIST' && !viewOnly && (
                            <p className="admin-subtitle mobile-hide" style={{ margin: 0, fontSize: '0.8rem' }}>
                                Revise solicitudes entrantes y gestione sus envíos.
                            </p>
                        )}
                    </div>
                    <div style={{ justifySelf: 'end' }}>
                        {viewMode === 'LIST' && !viewOnly ? (
                            <button
                                onClick={() => setViewMode('FORM')}
                                className="btn-primary"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem' }}
                            >
                                <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span> Nueva Solicitud
                            </button>
                        ) : null}
                    </div>
                </div>

                {viewMode === 'LIST' && (
                    <>
                        {/* Tabs Control */}
                        {!viewOnly && (
                            <div className="tabs-container" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                <button
                                    onClick={() => setActiveTab('PENDIENTES')}
                                    style={{
                                        padding: '0.6rem 1.2rem',
                                        background: 'none',
                                        border: 'none',
                                        borderBottom: activeTab === 'PENDIENTES' ? '2px solid #2563eb' : '2px solid transparent',
                                        color: activeTab === 'PENDIENTES' ? '#2563eb' : '#64748b',
                                        fontWeight: activeTab === 'PENDIENTES' ? 700 : 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.4rem',
                                        fontSize: '0.85rem',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    Pendientes
                                    {incomingRequests.length > 0 && (
                                        <span style={{ background: '#ef4444', color: 'white', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px' }}>
                                            {incomingRequests.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setActiveTab('REVISION')}
                                    style={{
                                        padding: '0.6rem 1.2rem',
                                        background: 'none',
                                        border: 'none',
                                        borderBottom: activeTab === 'REVISION' ? '2px solid #10b981' : '2px solid transparent',
                                        color: activeTab === 'REVISION' ? '#10b981' : '#64748b',
                                        fontWeight: activeTab === 'REVISION' ? 700 : 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        fontSize: '0.85rem',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    En Revisión
                                    {outgoingRequests.length > 0 && (
                                        <span style={{ background: '#10b981', color: 'white', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px' }}>
                                            {outgoingRequests.length}
                                        </span>
                                    )}
                                </button>

                                <button
                                    className={`tab-btn ${activeTab === 'HISTORIAL' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('HISTORIAL')}
                                    style={{
                                        padding: '0.6rem 1.2rem',
                                        background: 'none',
                                        border: 'none',
                                        borderBottom: activeTab === 'HISTORIAL' ? '2px solid #2563eb' : '2px solid transparent',
                                        color: activeTab === 'HISTORIAL' ? '#2563eb' : '#64748b',
                                        fontWeight: activeTab === 'HISTORIAL' ? 700 : 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        fontSize: '0.85rem',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    Historial
                                </button>
                            </div>
                        )}

                        {/* --- Filter Card: Standardized with toggle logic --- */}
                        <div className={`filter-card ${showMobileFilters ? 'mobile-expanded' : ''}`} style={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 20,
                            background: 'white',
                            borderRadius: '0.5rem',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                            padding: '0.5rem 1rem',
                            maxWidth: '1000px',
                            margin: '0.25rem auto 1rem',
                            width: '100%',
                            boxSizing: 'border-box',
                        }}>
                            <div className="filter-controls-left">
                                <div className="search-container">
                                    <div
                                        className="search-icon"
                                        onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                                    >
                                        {isSearchExpanded && searchTerm ? (
                                            <svg
                                                className="close-icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSearchTerm('');
                                                    setIsSearchExpanded(false);
                                                }}
                                                width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                            >
                                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                                <line x1="6" y1="6" x2="18" y2="18"></line>
                                            </svg>
                                        ) : (
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                        )}
                                    </div>
                                    <input
                                        type="text"
                                        className={`search-input ${isSearchExpanded || searchTerm ? 'expanded' : ''}`}
                                        placeholder="Buscar..."
                                        value={searchTerm}
                                        onChange={(e) => { setSearchTerm(e.target.value); setIncomingPage(0); setOutgoingPage(0); setVoucherPage(0); setHistorialPage(0); }}
                                        onBlur={() => { if (!searchTerm) setIsSearchExpanded(false); }}
                                        autoFocus={isSearchExpanded}
                                    />
                                </div>

                                <div className="filter-dropdown-wrapper" ref={filterMenuRef}>
                                    <button
                                        className={`btn-filter-toggle ${showMobileFilters ? 'active' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); setShowMobileFilters(!showMobileFilters); }}
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <line x1="3" y1="12" x2="21" y2="12"></line>
                                            <line x1="3" y1="6" x2="21" y2="6"></line>
                                            <line x1="3" y1="18" x2="21" y2="18"></line>
                                        </svg>
                                        {showMobileFilters ? 'Cerrar' : 'Filtros'}
                                    </button>

                                    <div className="filter-collapsible-area">
                                        <div className="filter-group-content">
                                            <CustomSelect
                                                label="Solicitud"
                                                value={filterTipo || 'Tipo'}
                                                options={['Todos', 'Baja por Pérdida', 'Reporte de Problema', 'Equipo Deshabilitado', 'Revisión', 'Traspaso', 'Activación/Creación', 'Vigencia Próxima']}
                                                onChange={(v) => { setFilterTipo(v === 'Todos' ? '' : v); setIncomingPage(0); setOutgoingPage(0); setVoucherPage(0); setHistorialPage(0); }}
                                                width="200px"
                                            />
                                            <CustomSelect
                                                label="Equipo"
                                                value={filterEquipo || 'Equipo'}
                                                options={['Todos', ...tiposCatalogo]}
                                                onChange={(v) => { setFilterEquipo(v === 'Todos' ? '' : v); setIncomingPage(0); setOutgoingPage(0); setVoucherPage(0); setHistorialPage(0); }}
                                                width="150px"
                                            />
                                            {hasActiveFilters && (
                                                <button className="btn-clear" onClick={handleClearFilters}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                                                    Limpiar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>{/* end filter-controls-left */}
                        </div>{/* end filter-card */}
                    </>
                )}
                {/* The closing div for the fixed header section */}
            </div>



            {/* --- SECCIÓN SCROLLABLE CONTENT --- */}
            <div className="admin-content-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 1rem 1rem', background: 'transparent' }}>

                {viewMode === 'LIST' && (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0, width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
                        {activeTab === 'PENDIENTES' && (
                            <div className="animate-fade-in" style={{ width: '100%', minWidth: 0 }}>
                                {filteredIncoming.length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', color: '#94a3b8', border: '1px dashed #cbd5e1' }}>
                                        {hasActiveFilters ? 'No se encontraron resultados para los filtros seleccionados.' : 'No hay solicitudes pendientes de revisión técnica.'}
                                    </div>
                                ) : (
                                    <>
                                        <div className="table-container" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                            <table className="admin-table">
                                                <thead>
                                                    <tr>
                                                        <th style={{ textAlign: 'center' }}>Tipo</th>
                                                        <th style={{ textAlign: 'center' }}>Código/Nombre</th>
                                                        <th style={{ textAlign: 'center' }}>Detalle</th>
                                                        <th style={{ textAlign: 'center' }}>Estado</th>
                                                        <th style={{ textAlign: 'center' }}>Solicitante</th>
                                                        <th style={{ textAlign: 'center' }}>Fecha</th>
                                                        <th style={{ textAlign: 'center', width: '120px' }}>Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredIncoming.slice(incomingPage * ITEMS_PER_PAGE, (incomingPage + 1) * ITEMS_PER_PAGE).map(sol => {
                                                        const isReviewable = sol.estado === 'PENDIENTE_TECNICA' || sol.estado === 'EN_REVISION_TECNICA';
                                                        return (
                                                            <tr key={sol.id_solicitud}
                                                                onClick={() => {
                                                                    setSelectedRequest(sol);
                                                                    setShowReviewModal(true);
                                                                    setReviewAction(null);
                                                                    setReviewFeedback('');
                                                                }}
                                                                style={{ cursor: 'pointer', transition: 'all 0.2s', borderLeft: isReviewable ? '4px solid #f97316' : '4px solid transparent' }}
                                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                            >
                                                                <td style={{ textAlign: 'center' }}>
                                                                    <span style={{
                                                                        fontSize: '0.65rem',
                                                                        fontWeight: 'bold',
                                                                        padding: '2px 6px',
                                                                        borderRadius: '4px',
                                                                        background: '#dbeafe',
                                                                        color: '#1e40af',
                                                                        whiteSpace: 'nowrap'
                                                                    }}>
                                                                        {getTipoLabel(sol.tipo_solicitud)}
                                                                    </span>
                                                                </td>
                                                                <td style={{ textAlign: 'left' }}>
                                                                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>
                                                                        {sol.datos_json?.codigo || sol.datos_json?.codigo_equipo || 'N/A'}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                                                                        {sol.datos_json?.nombre || sol.datos_json?.nombre_equipo || 'Sin nombre'}
                                                                    </div>
                                                                </td>
                                                                <td className="mobile-hide" style={{ textAlign: 'left', maxWidth: '200px' }}>
                                                                    <div style={{
                                                                        fontSize: '0.8rem',
                                                                        color: '#334155',
                                                                        whiteSpace: 'nowrap',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis'
                                                                    }} title={sol.datos_json?.motivo || 'Sin detalle'}>
                                                                        {sol.datos_json?.motivo || sol.datos_json?.motivo_revision || sol.datos_json?.justificacion || sol.datos_json?.descripcion || sol.datos_json?.circunstancias || sol.datos_json?.comentario || 'No especificado'}
                                                                    </div>
                                                                </td>
                                                                <td className="mobile-hide" style={{ textAlign: 'center' }}>
                                                                    <span style={{
                                                                        fontSize: '0.7rem',
                                                                        fontWeight: 600,
                                                                        padding: '2px 8px',
                                                                        borderRadius: '12px',
                                                                        background: sol.estado === 'PENDIENTE_TECNICA' ? '#dbeafe' : '#ffedd5',
                                                                        color: sol.estado === 'PENDIENTE_TECNICA' ? '#1e40af' : '#c2410c'
                                                                    }}>
                                                                        {getStatusLabel(sol.estado)}
                                                                    </span>
                                                                </td>
                                                                <td className="mobile-hide" style={{ textAlign: 'center', fontSize: '0.8rem', color: '#475569' }}>
                                                                    {sol.nombre_solicitante || 'N/A'}
                                                                </td>
                                                                <td className="mobile-hide" style={{ textAlign: 'center', fontSize: '0.8rem', color: '#475569' }}>
                                                                    {new Date(sol.fecha_solicitud).toLocaleDateString()}
                                                                </td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                                                                        <button
                                                                            className="btn-primary"
                                                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setSelectedRequest(sol);
                                                                                setShowReviewModal(true);
                                                                                setReviewAction(null);
                                                                                setReviewFeedback('');
                                                                            }}
                                                                        >
                                                                            Revisar
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>

                                        {filteredIncoming.length > ITEMS_PER_PAGE && (
                                            <div className="pagination-card">
                                                <div className="pagination-controls-wrapper">
                                                    <div className="pagination-buttons">
                                                        <button
                                                            className="btn-pagination"
                                                            disabled={incomingPage === 0}
                                                            onClick={() => setIncomingPage(prev => Math.max(0, prev - 1))}
                                                        >
                                                            Anterior
                                                        </button>
                                                        <button
                                                            className="btn-pagination"
                                                            disabled={incomingPage >= Math.ceil(filteredIncoming.length / ITEMS_PER_PAGE) - 1}
                                                            onClick={() => setIncomingPage(prev => Math.min(Math.ceil(filteredIncoming.length / ITEMS_PER_PAGE) - 1, prev + 1))}
                                                        >
                                                            Siguiente
                                                        </button>
                                                    </div>
                                                    <div className="pagination-summary">
                                                        {filteredIncoming.length} solicitudes encontradas (Hoja {incomingPage + 1} de {Math.ceil(filteredIncoming.length / ITEMS_PER_PAGE)})
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === 'REVISION' && (
                            <div className="animate-fade-in" style={{ width: '100%', minWidth: 0 }}>
                                {filteredOutgoing.length === 0 ? (
                                    <div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', color: '#94a3b8', border: '1px dashed #cbd5e1' }}>
                                        {hasActiveFilters ? 'No se encontraron resultados para los filtros seleccionados.' : 'No hay solicitudes esperando respuesta de Calidad.'}
                                    </div>
                                ) : (
                                    <>
                                        <div className="table-container" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                            <table className="admin-table">
                                                <thead>
                                                    <tr>
                                                        <th style={{ textAlign: 'center' }}>Tipo</th>
                                                        <th style={{ textAlign: 'center' }}>Código/Nombre</th>
                                                        <th style={{ textAlign: 'center' }}>Detalle</th>
                                                        <th style={{ textAlign: 'center' }}>Estado</th>
                                                        <th style={{ textAlign: 'center' }}>Solicitante</th>
                                                        <th style={{ textAlign: 'center' }}>Fecha</th>
                                                        <th style={{ textAlign: 'center', width: '120px' }}>Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredOutgoing.slice(outgoingPage * ITEMS_PER_PAGE, (outgoingPage + 1) * ITEMS_PER_PAGE).map(sol => (
                                                        <tr key={sol.id_solicitud}
                                                            onClick={() => {
                                                                setSelectedRequest(sol);
                                                                setReviewFeedback('');
                                                            }}
                                                            style={{ cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid transparent' }}
                                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                        >
                                                            <td style={{ textAlign: 'center' }}>
                                                                <span style={{
                                                                    fontSize: '0.65rem',
                                                                    fontWeight: 'bold',
                                                                    padding: '2px 6px',
                                                                    borderRadius: '4px',
                                                                    background: '#dcfce7',
                                                                    color: '#166534',
                                                                    whiteSpace: 'nowrap'
                                                                }}>
                                                                    {getTipoLabel(sol.tipo_solicitud)}
                                                                </span>
                                                            </td>
                                                            <td style={{ textAlign: 'left' }}>
                                                                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>
                                                                    {sol.datos_json?.codigo || sol.datos_json?.codigo_equipo || 'N/A'}
                                                                </div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                                                                    {sol.datos_json?.nombre || sol.datos_json?.nombre_equipo || 'Sin nombre'}
                                                                </div>
                                                            </td>
                                                            <td className="mobile-hide" style={{ textAlign: 'left', maxWidth: '200px' }}>
                                                                <div style={{
                                                                    fontSize: '0.8rem',
                                                                    color: '#334155',
                                                                    whiteSpace: 'nowrap',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis'
                                                                }} title={sol.datos_json?.motivo || 'Sin detalle'}>
                                                                    {sol.datos_json?.motivo || sol.datos_json?.motivo_revision || sol.datos_json?.justificacion || sol.datos_json?.descripcion || sol.datos_json?.circunstancias || sol.datos_json?.comentario || 'No especificado'}
                                                                </div>
                                                            </td>
                                                            <td className="mobile-hide" style={{ textAlign: 'center' }}>
                                                                <span style={{
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 600,
                                                                    padding: '2px 8px',
                                                                    borderRadius: '12px',
                                                                    background: '#dbeafe',
                                                                    color: '#1e40af'
                                                                }}>
                                                                    {getStatusLabel(sol.estado)}
                                                                </span>
                                                            </td>
                                                            <td className="mobile-hide" style={{ textAlign: 'center', fontSize: '0.8rem', color: '#475569' }}>
                                                                {sol.nombre_solicitante || 'N/A'}
                                                            </td>
                                                            <td className="mobile-hide" style={{ textAlign: 'center', fontSize: '0.8rem', color: '#475569' }}>
                                                                {new Date(sol.fecha_solicitud).toLocaleDateString()}
                                                            </td>
                                                            <td style={{ textAlign: 'center' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                                                                    <button
                                                                        className="btn-success"
                                                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: '#10b981' }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedRequest(sol);
                                                                            setReviewFeedback('');
                                                                        }}
                                                                    >
                                                                        {isGCMan && sol.estado === 'PENDIENTE_CALIDAD' ? 'Procesar' : 'Ver Detalles'}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {filteredOutgoing.length > ITEMS_PER_PAGE && (
                                            <div className="pagination-card">
                                                <div className="pagination-controls-wrapper">
                                                    <div className="pagination-buttons">
                                                        <button
                                                            className="btn-pagination"
                                                            disabled={outgoingPage === 0}
                                                            onClick={() => setOutgoingPage(prev => Math.max(0, prev - 1))}
                                                        >
                                                            Anterior
                                                        </button>
                                                        <button
                                                            className="btn-pagination"
                                                            disabled={outgoingPage >= Math.ceil(filteredOutgoing.length / ITEMS_PER_PAGE) - 1}
                                                            onClick={() => setOutgoingPage(prev => Math.min(Math.ceil(filteredOutgoing.length / ITEMS_PER_PAGE) - 1, prev + 1))}
                                                        >
                                                            Siguiente
                                                        </button>
                                                    </div>
                                                    <div className="pagination-summary">
                                                        {filteredOutgoing.length} solicitudes encontradas (Hoja {outgoingPage + 1} de {Math.ceil(filteredOutgoing.length / ITEMS_PER_PAGE)})
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === 'POR_VALIDAR' && (
                            <div className="animate-fade-in" style={{ padding: '0.5rem', width: '100%', minWidth: 0 }}>


                                {filteredVouchers.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '4rem', background: 'white', borderRadius: '16px', border: '2px dashed #e2e8f0' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{hasActiveFilters ? '??' : '?'}</div>
                                        <h3 style={{ color: '#64748b', margin: 0 }}>{hasActiveFilters ? 'Sin resultados' : 'Todo al día'}</h3>
                                        <p style={{ color: '#94a3b8' }}>{hasActiveFilters ? 'No se encontraron vouchers que coincidan con los filtros.' : 'No hay vouchers pendientes de validación.'}</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="table-container" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                            <table className="admin-table">
                                                <thead>
                                                    <tr>
                                                        <th style={{ textAlign: 'center' }}>Tipo</th>
                                                        <th style={{ textAlign: 'center' }}>Código/Nombre</th>
                                                        <th style={{ textAlign: 'center' }}>Detalle</th>
                                                        <th style={{ textAlign: 'center' }}>Estado</th>
                                                        <th style={{ textAlign: 'center' }}>Solicitante</th>
                                                        <th style={{ textAlign: 'center' }}>Fecha</th>
                                                        <th style={{ textAlign: 'center', width: '120px' }}>Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredVouchers.slice(voucherPage * ITEMS_PER_PAGE, (voucherPage + 1) * ITEMS_PER_PAGE).map(voucher => (
                                                        <tr key={voucher.id_solicitud}
                                                            onClick={(e) => handleOpenDetails(voucher, e)}
                                                            style={{ cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid transparent' }}
                                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                        >
                                                            <td style={{ textAlign: 'center' }}>
                                                                <span style={{
                                                                    fontSize: '0.65rem',
                                                                    fontWeight: 'bold',
                                                                    padding: '2px 6px',
                                                                    borderRadius: '4px',
                                                                    background: voucher.estado === 'APROBADO' ? '#dcfce7' : '#ffedd5',
                                                                    color: voucher.estado === 'APROBADO' ? '#166534' : '#c2410c',
                                                                    whiteSpace: 'nowrap'
                                                                }}>
                                                                    {getTipoLabel(voucher.tipo_solicitud)}
                                                                </span>
                                                            </td>
                                                            <td style={{ textAlign: 'left' }}>
                                                                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>
                                                                    {voucher.datos_json?.codigo || 'N/A'}
                                                                </div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                                                                    {voucher.datos_json?.nombre || 'Sin nombre'}
                                                                </div>
                                                            </td>
                                                            <td style={{ textAlign: 'left', maxWidth: '200px' }}>
                                                                <div style={{
                                                                    fontSize: '0.8rem',
                                                                    color: '#334155',
                                                                    whiteSpace: 'nowrap',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis'
                                                                }} title={voucher.datos_json?.descripcion || voucher.datos_json?.motivo || voucher.datos_json?.sintomas || 'Sin detalle'}>
                                                                    {voucher.datos_json?.descripcion || voucher.datos_json?.motivo || voucher.datos_json?.sintomas || 'Sin descripción detallada.'}
                                                                </div>
                                                            </td>
                                                            <td style={{ textAlign: 'center' }}>
                                                                <span style={{
                                                                    fontSize: '0.7rem',
                                                                    fontWeight: 600,
                                                                    padding: '2px 8px',
                                                                    borderRadius: '12px',
                                                                    background: voucher.estado === 'APROBADO' ? '#dcfce7' :
                                                                        voucher.estado?.includes('RECHAZAD') ? '#fee2e2' :
                                                                            voucher.estado === 'PENDIENTE_TECNICA' ? '#dbeafe' :
                                                                                voucher.estado === 'EN_REVISION_TECNICA' ? '#dbeafe' : '#ffedd5',
                                                                    color: voucher.estado === 'APROBADO' ? '#166534' :
                                                                        voucher.estado?.includes('RECHAZAD') ? '#991b1b' :
                                                                            voucher.estado === 'PENDIENTE_TECNICA' ? '#1e40af' :
                                                                                voucher.estado === 'EN_REVISION_TECNICA' ? '#1e40af' : '#c2410c'
                                                                }}>
                                                                    {getStatusLabel(voucher.estado)}
                                                                </span>
                                                            </td>
                                                            <td style={{ textAlign: 'center', fontSize: '0.8rem', color: '#475569' }}>
                                                                {voucher.nombre_solicitante || 'N/A'}
                                                            </td>
                                                            <td style={{ textAlign: 'center', fontSize: '0.8rem', color: '#475569' }}>
                                                                {new Date(voucher.fecha_solicitud).toLocaleDateString()}
                                                            </td>
                                                            <td style={{ textAlign: 'center' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                                                                    <button
                                                                        className="btn-primary"
                                                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                                                                        onClick={(e) => handleOpenDetails(voucher, e)}
                                                                    >
                                                                        Ver Detalles
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {filteredVouchers.length > ITEMS_PER_PAGE && (
                                            <div className="pagination-card">
                                                <div className="pagination-controls-wrapper">
                                                    <div className="pagination-buttons">
                                                        <button
                                                            className="btn-pagination"
                                                            disabled={voucherPage === 0}
                                                            onClick={() => setVoucherPage(prev => Math.max(0, prev - 1))}
                                                        >
                                                            Anterior
                                                        </button>
                                                        <button
                                                            className="btn-pagination"
                                                            disabled={voucherPage >= Math.ceil(filteredVouchers.length / ITEMS_PER_PAGE) - 1}
                                                            onClick={() => setVoucherPage(prev => Math.min(Math.ceil(filteredVouchers.length / ITEMS_PER_PAGE) - 1, prev + 1))}
                                                        >
                                                            Siguiente
                                                        </button>
                                                    </div>
                                                    <div className="pagination-summary">
                                                        {filteredVouchers.length} vouchers encontrados (Hoja {voucherPage + 1} de {Math.ceil(filteredVouchers.length / ITEMS_PER_PAGE)})
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === 'HISTORIAL' && (
                            <div className="animate-fade-in" style={{ padding: '0.5rem', width: '100%', minWidth: 0 }}>
                                {filteredHistory.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '4rem', background: 'white', borderRadius: '16px', border: '2px dashed #e2e8f0' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>??</div>
                                        <h3 style={{ color: '#64748b', margin: 0 }}>{hasActiveFilters ? 'Sin resultados' : 'Sin historial'}</h3>
                                        <p style={{ color: '#94a3b8' }}>{hasActiveFilters ? 'No se encontraron registros que coincidan con los filtros.' : 'No hay historial de solicitudes registradas.'}</p>
                                    </div>
                                ) : (() => {
                                    const pagedHistory = filteredHistory.slice(historialPage * ITEMS_PER_PAGE, (historialPage + 1) * ITEMS_PER_PAGE);
                                    return (
                                        <>
                                            <div className="table-container" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                                <table className="admin-table">
                                                    <thead>
                                                        <tr>
                                                            <th style={{ textAlign: 'center' }}>Tipo</th>
                                                            <th style={{ textAlign: 'center' }}>Código/Nombre</th>
                                                            <th style={{ textAlign: 'center' }}>Detalle</th>
                                                            <th style={{ textAlign: 'center' }}>Estado</th>
                                                            <th style={{ textAlign: 'center' }}>Solicitante</th>
                                                            <th style={{ textAlign: 'center' }}>Fecha</th>
                                                            <th style={{ textAlign: 'center', width: '120px' }}>Acciones</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {pagedHistory.map(sol => (
                                                            <tr key={sol.id_solicitud}
                                                                onClick={() => { setSelectedRequest(sol); setShowReviewModal(true); setIsReplying(false); setReviewAction(null); setReviewFeedback(''); }}
                                                                style={{ cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid transparent' }}
                                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                                            >
                                                                <td style={{ textAlign: 'center' }}>
                                                                    <span style={{ fontSize: '0.65rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', whiteSpace: 'nowrap' }}>
                                                                        {getTipoLabel(sol.tipo_solicitud)}
                                                                    </span>
                                                                </td>
                                                                <td style={{ textAlign: 'left' }}>
                                                                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>
                                                                        {sol.datos_json?.codigo || sol.datos_json?.codigo_equipo || 'N/A'}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                                                                        {sol.datos_json?.nombre || sol.datos_json?.nombre_equipo || 'Sin nombre'}
                                                                    </div>
                                                                </td>
                                                                <td style={{ textAlign: 'left', maxWidth: '200px' }}>
                                                                    <div style={{ fontSize: '0.8rem', color: '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                                                                        title={sol.datos_json?.motivo || sol.datos_json?.descripcion || 'Sin detalle'}>
                                                                        {sol.datos_json?.motivo || sol.datos_json?.motivo_revision || sol.datos_json?.justificacion || sol.datos_json?.descripcion || sol.datos_json?.circunstancias || sol.datos_json?.comentario || 'No especificado'}
                                                                    </div>
                                                                </td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    <span style={{
                                                                        fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px',
                                                                        background: sol.estado === 'APROBADO' ? '#dcfce7' : sol.estado?.includes('RECHAZAD') ? '#fee2e2' : sol.estado === 'PENDIENTE_CALIDAD' ? '#ffedd5' : '#f1f5f9',
                                                                        color: sol.estado === 'APROBADO' ? '#166534' : sol.estado?.includes('RECHAZAD') ? '#991b1b' : sol.estado === 'PENDIENTE_CALIDAD' ? '#c2410c' : '#475569',
                                                                        textTransform: 'uppercase'
                                                                    }}>
                                                                        {getStatusLabel(sol.estado)}
                                                                    </span>
                                                                </td>
                                                                <td style={{ textAlign: 'center', fontSize: '0.8rem', color: '#475569' }}>
                                                                    {sol.nombre_solicitante || 'N/A'}
                                                                </td>
                                                                <td style={{ textAlign: 'center', fontSize: '0.8rem', color: '#475569' }}>
                                                                    {new Date(sol.fecha_solicitud).toLocaleDateString()}
                                                                </td>
                                                                <td style={{ textAlign: 'center' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                                                                        <button
                                                                            className="btn-primary"
                                                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: '#64748b' }}
                                                                            onClick={(e) => { e.stopPropagation(); setSelectedRequest(sol); setShowReviewModal(true); setIsReplying(false); setReviewAction(null); setReviewFeedback(''); }}
                                                                        >
                                                                            Ver
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {filteredHistory.length > ITEMS_PER_PAGE && (
                                                <div className="pagination-card">
                                                    <div className="pagination-controls-wrapper">
                                                        <div className="pagination-buttons">
                                                            <button
                                                                className="btn-pagination"
                                                                disabled={historialPage === 0}
                                                                onClick={() => setHistorialPage(prev => Math.max(0, prev - 1))}
                                                            >
                                                                Anterior
                                                            </button>
                                                            <button
                                                                className="btn-pagination"
                                                                disabled={historialPage >= Math.ceil(filteredHistory.length / ITEMS_PER_PAGE) - 1}
                                                                onClick={() => setHistorialPage(prev => Math.min(Math.ceil(filteredHistory.length / ITEMS_PER_PAGE) - 1, prev + 1))}
                                                            >
                                                                Siguiente
                                                            </button>
                                                        </div>
                                                        <div className="pagination-summary">
                                                            {filteredHistory.length} solicitudes encontradas (Hoja {historialPage + 1} de {Math.ceil(filteredHistory.length / ITEMS_PER_PAGE)})
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                    </div>
                )}

                {viewMode === 'FORM' && (
                    <div className="form-card" style={{ maxWidth: '1000px', margin: '0 auto', background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                        {/* Selector de Tipo - Grid uniforme */}
                        <div className="tipo-solicitud-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '0.625rem',
                            marginBottom: '2rem',
                            borderBottom: '1px solid #f1f5f9',
                            paddingBottom: '1.75rem'
                        }}>
                            {(['ALTA', 'TRASPASO', 'BAJA', 'REVISION', 'VIGENCIA_PROXIMA', 'EQUIPO_PERDIDO', 'REPORTE_PROBLEMA', 'NUEVO_EQUIPO', 'EQUIPO_DESHABILITADO'] as SolicitudeType[]).map(t => {
                                // Restrict EQUIPO_DESHABILITADO creation to Muestreadores only (hide for Technical/Admin)
                                if (t === 'EQUIPO_DESHABILITADO' && (isMAMan || isSuperAdmin)) return null;

                                const getActiveColor = () => {
                                    if (t === 'ALTA') return '#16a34a';
                                    if (t === 'TRASPASO') return '#2563eb';
                                    if (t === 'BAJA') return '#dc2626';
                                    if (t === 'REVISION') return '#d97706';
                                    if (t === 'VIGENCIA_PROXIMA') return '#9333ea';
                                    if (t === 'EQUIPO_PERDIDO') return '#475569';
                                    if (t === 'REPORTE_PROBLEMA') return '#e11d48';
                                    if (t === 'NUEVO_EQUIPO') return '#0891b2';
                                    if (t === 'EQUIPO_DESHABILITADO') return '#be123c';
                                    return '#64748b';
                                };

                                const getIcon = () => {
                                    if (t === 'ALTA') return (
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 4 12 14.01 9 11.01" /><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /></svg>
                                    );
                                    if (t === 'TRASPASO') return (
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                                    );
                                    if (t === 'BAJA') return (
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                                    );
                                    if (t === 'REVISION') return (
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                    );
                                    if (t === 'VIGENCIA_PROXIMA') return (
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                                    );
                                    if (t === 'EQUIPO_PERDIDO') return (
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
                                    );
                                    if (t === 'REPORTE_PROBLEMA') return (
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                                    );
                                    if (t === 'NUEVO_EQUIPO') return (
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                                    );
                                    if (t === 'EQUIPO_DESHABILITADO') return (
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
                                    );
                                    return null;
                                };

                                const isActive = type === t;
                                const activeColor = getActiveColor();

                                return (
                                    <button
                                        key={t}
                                        onClick={() => {
                                            setType(t);
                                            setAltaSubtype(t === 'ALTA' ? 'ACTIVAR' : null);
                                            setIsReactivation(t === 'ALTA');
                                            setFormData(INITIAL_FORM_DATA);
                                            setEquiposBaja([]);
                                            setEquiposAlta([]);
                                        }}
                                        title={getTipoLabel(t)}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.35rem',
                                            padding: '0.75rem 0.5rem',
                                            borderRadius: '10px',
                                            border: isActive ? `2px solid ${activeColor}` : '2px solid transparent',
                                            fontWeight: 600,
                                            fontSize: '0.72rem',
                                            cursor: 'pointer',
                                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                                            backgroundColor: isActive ? activeColor : '#f8fafc',
                                            color: isActive ? 'white' : '#64748b',
                                            boxShadow: isActive ? `0 4px 12px ${activeColor}40` : '0 1px 2px rgba(0,0,0,0.04)',
                                            transform: isActive ? 'translateY(-1px)' : 'translateY(0)',
                                            textAlign: 'center',
                                            lineHeight: '1.2',
                                            height: '72px',
                                            overflow: 'hidden',
                                        }}
                                        onMouseEnter={e => {
                                            if (!isActive) {
                                                e.currentTarget.style.backgroundColor = `${activeColor}12`;
                                                e.currentTarget.style.borderColor = `${activeColor}50`;
                                                e.currentTarget.style.color = activeColor;
                                            }
                                        }}
                                        onMouseLeave={e => {
                                            if (!isActive) {
                                                e.currentTarget.style.backgroundColor = '#f8fafc';
                                                e.currentTarget.style.borderColor = 'transparent';
                                                e.currentTarget.style.color = '#64748b';
                                            }
                                        }}
                                    >
                                        <span style={{ opacity: isActive ? 1 : 0.6 }}>{getIcon()}</span>
                                        <span>{getTipoLabel(t)}</span>
                                    </button>
                                );
                            })}
                        </div>


                        <form onSubmit={handleSubmit}>
                            {(isMAMan || isSuperAdmin) && (
                                <div
                                    className="quality-card-responsive"
                                    style={{
                                        gridColumn: 'span 2',
                                        marginBottom: '1.5rem',
                                        padding: '1rem',
                                        background: directToQuality ? '#eff6ff' : '#f8fafc',
                                        border: directToQuality ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                                        borderRadius: '12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <div className="quality-card-content">
                                        <div style={{
                                            width: '42px',
                                            height: '42px',
                                            borderRadius: '10px',
                                            background: directToQuality ? '#3b82f6' : '#f1f5f9',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: directToQuality ? 'white' : '#64748b',
                                            flexShrink: 0
                                        }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                                <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                            </svg>
                                        </div>
                                        <div style={{ textAlign: 'left' }}>
                                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e293b', fontWeight: 700, lineHeight: '1.2' }}>Enviar directamente a Calidad</h4>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>Salta la revisión técnica intermedio</p>
                                        </div>
                                    </div>
                                    <div
                                        onClick={() => setDirectToQuality(!directToQuality)}
                                        style={{
                                            width: '54px',
                                            height: '30px',
                                            background: directToQuality ? '#2563eb' : '#e2e8f0',
                                            borderRadius: '15px',
                                            padding: '4px',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s ease',
                                            position: 'relative',
                                            flexShrink: 0,
                                            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)'
                                        }}
                                    >
                                        <div style={{
                                            width: '22px',
                                            height: '22px',
                                            background: 'white',
                                            borderRadius: '11px',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            transform: `translateX(${directToQuality ? '24px' : '0px'})`,
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                                        }} />
                                    </div>
                                </div>
                            )}
                            <div className="form-grid-responsive" style={{ marginBottom: '1.5rem' }}>
                                {isAlta && (
                                    <>
                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <SearchableSelect
                                                label="Seleccionar Equipo para Reactivación"
                                                placeholder="Busque por nombre o código..."
                                                value=""
                                                onChange={(val) => {
                                                    const eq = equipos.find(e => String(e.id_equipo) === val);
                                                    if (eq && !equiposAlta.find(a => a.id === val)) {
                                                        setEquiposAlta(prev => [...prev, {
                                                            id: String(eq.id_equipo),
                                                            nombre: `${eq.nombre} (${eq.codigo})`,
                                                            vigencia: '',
                                                            datos_originales: eq
                                                        }]);
                                                    }
                                                }}
                                                options={equipos
                                                    .filter(e => {
                                                        const idStr = String(e.id_equipo);
                                                        return (e.estado?.toLowerCase() === 'inactivo' || (e as any).habilitado === 'N') &&
                                                            !equiposAlta.find(a => a.id === idStr);
                                                    })
                                                    .map(e => ({ id: String(e.id_equipo), nombre: `${e.codigo} - ${e.nombre} ` }))}
                                            />
                                        </div>

                                        {equiposAlta.length > 0 && (
                                            <div style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
                                                <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', fontWeight: 600, color: '#4b5563' }}>Equipos seleccionados y fecha de vigencia:</p>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                    {equiposAlta.map((eq, idx) => (
                                                        <div key={eq.id} style={{
                                                            background: '#f8fafc',
                                                            padding: '0.25rem 0.5rem',
                                                            borderRadius: '6px',
                                                            border: '1px solid #e2e8f0',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.75rem',
                                                            boxShadow: 'none',
                                                            marginBottom: '2px'
                                                        }}>
                                                            <div style={{ flex: 1, fontWeight: 600, color: '#334155', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {eq.nombre}
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Vig:</span>
                                                                <input
                                                                    type="date"
                                                                    value={eq.vigencia}
                                                                    onChange={(e) => {
                                                                        const newV = e.target.value;
                                                                        setEquiposAlta(prev => prev.map((p, i) => i === idx ? { ...p, vigencia: newV } : p));
                                                                    }}
                                                                    className="form-input"
                                                                    style={{ padding: '2px 4px', fontSize: '0.7rem', height: '24px', width: '110px' }}
                                                                    required
                                                                    min={new Date().toISOString().split('T')[0]}
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => setEquiposAlta(prev => prev.filter(p => p.id !== eq.id))}
                                                                style={{
                                                                    background: 'none',
                                                                    border: 'none',
                                                                    color: '#ef4444',
                                                                    cursor: 'pointer',
                                                                    padding: '2px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    opacity: 0.7
                                                                }}
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="form-group prob-desc" style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
                                            <label className="form-label">Observaciones (Opcional)</label>
                                            <textarea name="motivo" value={formData.motivo} onChange={handleChange} className="form-input" style={{ height: '80px', resize: 'vertical' }} placeholder="Ingrese observaciones adicionales..."></textarea>
                                        </div>

                                        <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                            <button
                                                type="submit"
                                                disabled={loading || equiposAlta.length === 0 || equiposAlta.some(eq => !eq.vigencia)}
                                                style={{
                                                    background: (loading || equiposAlta.length === 0 || equiposAlta.some(eq => !eq.vigencia))
                                                        ? '#cbd5e1'
                                                        : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                                    padding: '0.8rem 2.5rem',
                                                    borderRadius: '10px',
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    border: 'none',
                                                    cursor: (loading || equiposAlta.length === 0) ? 'not-allowed' : 'pointer',
                                                    boxShadow: (loading || equiposAlta.length === 0) ? 'none' : '0 4px 6px rgba(22, 163, 74, 0.2)',
                                                    transition: 'all 0.3s ease'
                                                }}
                                            >
                                                {loading ? 'Procesando...' : 'Confirmar Solicitud de Activación'}
                                            </button>
                                        </div>
                                    </>
                                )}

                                {isNuevoEq && (
                                    <>
                                        {/* Código del Equipo - solo */}
                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>Código del Equipo</span>
                                                {generatingCode && <span style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>Generando...</span>}
                                            </label>
                                            <input
                                                type="text"
                                                name="codigo"
                                                value={formData.codigo}
                                                onChange={handleChange}
                                                className="form-input"
                                                required
                                                placeholder={generatingCode ? "Generando código..." : "Se generará automáticamente"}
                                                readOnly
                                                style={{
                                                    backgroundColor: (generatingCode || formData.codigo) ? '#f8fafc' : 'white',
                                                    color: generatingCode ? '#94a3b8' : '#1e293b',
                                                    fontWeight: formData.codigo ? 700 : 400,
                                                    border: formData.codigo ? '2px solid #3b82f640' : '1px solid #cbd5e1'
                                                }}
                                            />
                                        </div>

                                        {/* Nombre del Equipo - solo */}
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <HybridSelect
                                                label="Nombre del Equipo"
                                                placeholder="Ej: Multiparámetro"
                                                value={formData.nombre}
                                                onChange={(val) => handleSelectChange('nombre', val)}
                                                options={nombresCatalogo.filter(n => {
                                                    if (!formData.tipo) return true;
                                                    return equipos.some(e => e.tipo === formData.tipo && e.nombre === n);
                                                })}
                                                strict={true}
                                                required
                                            />
                                        </div>

                                        {/* Tipo de Equipo - solo */}
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <HybridSelect
                                                label="Tipo de Equipo"
                                                placeholder="Ej: Instrumento"
                                                value={formData.tipo}
                                                onChange={(val) => {
                                                    // Only clear nombre if the current nombre is incompatible with the new tipo
                                                    const currentNombre = formData.nombre;
                                                    let isCompatible = true;
                                                    if (currentNombre && val) {
                                                        isCompatible = equipos.some(e => e.tipo === val && e.nombre === currentNombre);
                                                    }
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        tipo: val,
                                                        codigo: '',
                                                        nombre: isCompatible ? prev.nombre : ''
                                                    }));
                                                }}
                                                options={tiposCatalogo.length > 0 ? tiposCatalogo : ['Analizador', 'Balanza', 'Cámara Fotográfica', 'Centrífuga', 'GPS', 'Instrumento', 'Medidor', 'Multiparámetro', 'Phmetro', 'Sonda']}
                                                strict={true}
                                                required
                                            />
                                        </div>

                                        {/* Responsable - solo */}
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <HybridSelect
                                                label="Responsable"
                                                placeholder="Ej: Juan Pérez"
                                                value={formData.responsable}
                                                onChange={(val) => {
                                                    const matching = muestreadores.find(m => m.nombre_muestreador === val);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        responsable: val,
                                                        id_muestreador: matching?.id_muestreador || ''
                                                    }));
                                                }}
                                                options={muestreadores.map(m => m.nombre_muestreador)}
                                                strict={true}
                                                required
                                            />
                                        </div>

                                        {/* Ubicación + Fecha de Vigencia - juntos, Ubicación más ancha */}
                                        <div className="nuevo-eq-ubicacion-row" style={{ gridColumn: 'span 2' }}>
                                            <div>
                                                <HybridSelect
                                                    label="Ubicación"
                                                    placeholder="Seleccione ubicación..."
                                                    value={formData.ubicacion}
                                                    onChange={(val) => handleSelectChange('ubicacion', val)}
                                                    options={sedesCatalogo.length > 0 ? sedesCatalogo : ['AY', 'VI', 'PM', 'PA', 'PV', 'CH', 'CM', 'CN', 'Terreno']}
                                                    strict={true}
                                                    required
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label className="form-label">Fecha de Vigencia</label>
                                                <input
                                                    type="date"
                                                    name="vigencia"
                                                    value={formData.vigencia}
                                                    onChange={handleChange}
                                                    className="form-input"
                                                    required
                                                    min={new Date().toISOString().split('T')[0]}
                                                />
                                            </div>
                                        </div>

                                        {/* Observaciones - sola */}
                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <label className="form-label">Observaciones (Opcional)</label>
                                            <textarea name="motivo" value={formData.motivo} onChange={handleChange} className="form-input" style={{ height: '80px', resize: 'vertical' }} placeholder="Ingrese cualquier observación relevante..."></textarea>
                                        </div>

                                        <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'center', marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '2.5rem' }}>
                                            <button
                                                type="submit"
                                                disabled={loading || !formData.nombre || !formData.tipo || !formData.ubicacion || !formData.responsable || !formData.id_muestreador || !formData.vigencia}
                                                style={{
                                                    background: (loading || !formData.nombre || !formData.tipo || !formData.ubicacion || !formData.responsable || !formData.id_muestreador || !formData.vigencia)
                                                        ? '#cbd5e1'
                                                        : 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
                                                    padding: '1rem 4rem',
                                                    borderRadius: '12px',
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    fontSize: '1rem',
                                                    border: 'none',
                                                    cursor: (loading || !formData.nombre || !formData.tipo || !formData.ubicacion || !formData.responsable || !formData.id_muestreador || !formData.vigencia) ? 'not-allowed' : 'pointer',
                                                    boxShadow: (loading || !formData.nombre || !formData.tipo || !formData.ubicacion || !formData.responsable || !formData.id_muestreador || !formData.vigencia) ? 'none' : '0 10px 15px -3px rgba(8, 145, 178, 0.3)',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    transform: loading ? 'none' : 'translateY(0)'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!(loading || !formData.nombre || !formData.tipo || !formData.ubicacion || !formData.responsable || !formData.id_muestreador || !formData.vigencia)) {
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                        e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(8, 145, 178, 0.4)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = (loading || !formData.nombre || !formData.tipo || !formData.ubicacion || !formData.responsable || !formData.id_muestreador || !formData.vigencia) ? 'none' : '0 10px 15px -3px rgba(8, 145, 178, 0.3)';
                                                }}
                                            >
                                                {loading ? 'Enviando...' : 'Enviar Solicitud de Creación'}
                                            </button>
                                        </div>
                                    </>
                                )}

                                {type === 'TRASPASO' && (
                                    <>
                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <SearchableSelect
                                                label="Seleccionar Equipo"
                                                placeholder="Busque equipo por nombre o código..."
                                                value={formData.id_equipo}
                                                onChange={(val) => handleSelectChange('id_equipo', val)}
                                                options={equipos.map(e => ({ id: String(e.id_equipo), nombre: `${e.codigo} - ${e.nombre} ` }))}
                                            />
                                        </div>

                                        {formData.id_equipo && (
                                            <>
                                                <div className="form-group">
                                                    <label className="form-label" style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Ubicación Actual</label>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        value={equipos.find(e => String(e.id_equipo) === formData.id_equipo)?.ubicacion || ''}
                                                        readOnly
                                                        style={{
                                                            backgroundColor: '#f1f5f9',
                                                            color: '#64748b',
                                                            border: '1px solid #e2e8f0',
                                                            cursor: 'not-allowed',
                                                            fontSize: '0.8rem',
                                                            padding: '0.4rem 0.75rem',
                                                            height: 'auto'
                                                        }}
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label" style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Responsable Actual</label>
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        value={equipos.find(e => String(e.id_equipo) === formData.id_equipo)?.nombre_asignado || 'Sin Asignar'}
                                                        readOnly
                                                        style={{
                                                            backgroundColor: '#f1f5f9',
                                                            color: '#64748b',
                                                            border: '1px solid #e2e8f0',
                                                            cursor: 'not-allowed',
                                                            fontSize: '0.8rem',
                                                            padding: '0.4rem 0.75rem',
                                                            height: 'auto'
                                                        }}
                                                    />
                                                </div>
                                            </>
                                        )}
                                        <HybridSelect
                                            label="Ubicación"
                                            placeholder="Seleccione ubicación..."
                                            value={formData.nueva_ubicacion}
                                            onChange={(val) => handleSelectChange('nueva_ubicacion', val)}
                                            options={sedesCatalogo.length > 0 ? sedesCatalogo : ['AY', 'VI', 'PM', 'PA', 'CM', 'CN', 'Terreno']}
                                            strict={true}
                                            required
                                        />

                                        <HybridSelect
                                            label="Nuevo Responsable"
                                            placeholder="Nombre nuevo responsable"
                                            value={formData.nuevo_responsable}
                                            onChange={(val) => {
                                                const matching = muestreadores.find(m => m.nombre_muestreador === val);
                                                setFormData(prev => ({
                                                    ...prev,
                                                    nuevo_responsable: val,
                                                    nuevo_responsable_id: matching?.id_muestreador || ''
                                                }));
                                            }}
                                            options={muestreadores
                                                .filter(m => {
                                                    const currentEq = equipos.find(e => String(e.id_equipo) === formData.id_equipo);
                                                    return !currentEq || Number(m.id_muestreador) !== Number(currentEq.id_muestreador);
                                                })
                                                .map(m => m.nombre_muestreador)}
                                            strict={true}
                                            required
                                        />
                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <label className="form-label">Observaciones (Opcional)</label>
                                            <textarea name="motivo" value={formData.motivo} onChange={handleChange} className="form-input" style={{ height: '80px', resize: 'vertical' }} placeholder="Motivo del traspaso u observaciones..."></textarea>
                                        </div>
                                        <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'center', marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '2.5rem' }}>
                                            <button
                                                type="submit"
                                                disabled={loading || !formData.id_equipo || !formData.nueva_ubicacion || !formData.nuevo_responsable}
                                                style={{
                                                    background: (loading || !formData.id_equipo || !formData.nueva_ubicacion || !formData.nuevo_responsable)
                                                        ? '#cbd5e1'
                                                        : 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                                                    padding: '1rem 4rem',
                                                    borderRadius: '12px',
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    fontSize: '1rem',
                                                    border: 'none',
                                                    cursor: (loading || !formData.id_equipo || !formData.nueva_ubicacion || !formData.nuevo_responsable) ? 'not-allowed' : 'pointer',
                                                    boxShadow: (loading || !formData.id_equipo || !formData.nueva_ubicacion || !formData.nuevo_responsable) ? 'none' : '0 10px 15px -3px rgba(37, 99, 235, 0.3)',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    transform: 'translateY(0)'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!(loading || !formData.id_equipo || !formData.nueva_ubicacion || !formData.nuevo_responsable)) {
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                        e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(37, 99, 235, 0.4)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = (loading || !formData.id_equipo || !formData.nueva_ubicacion || !formData.nuevo_responsable) ? 'none' : '0 10px 15px -3px rgba(37, 99, 235, 0.3)';
                                                }}
                                            >
                                                {loading ? 'Enviando...' : 'Solicitar Traspaso'}
                                            </button>
                                        </div>
                                    </>
                                )}

                                {type === 'BAJA' && (
                                    <>
                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <SearchableSelect
                                                label="Seleccionar Equipos para Baja"
                                                placeholder="Busque equipo por nombre o código..."
                                                value=""
                                                onChange={(val) => {
                                                    const eq = equipos.find(e => String(e.id_equipo) === val);
                                                    if (eq && !equiposBaja.find(b => b.id === val)) {
                                                        setEquiposBaja(prev => [...prev, {
                                                            id: String(eq.id_equipo),
                                                            nombre: eq.nombre,
                                                            codigo: eq.codigo,
                                                            tipo: eq.tipo,
                                                            responsable: eq.nombre_asignado,
                                                            ubicacion: eq.ubicacion
                                                        }]);
                                                    }
                                                }}
                                                options={equipos
                                                    .filter(e => {
                                                        const idStr = String(e.id_equipo);
                                                        return (e.estado?.toLowerCase() === 'activo' || (e as any).habilitado === 'S' || !(e.estado)) &&
                                                            !equiposBaja.find(b => b.id === idStr) &&
                                                            !pendingBajaIds.includes(idStr);
                                                    })
                                                    .map(e => ({ id: String(e.id_equipo), nombre: `${e.codigo} - ${e.nombre} ` }))}
                                            />
                                        </div>
                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <label className="form-label">Observaciones</label>
                                            <textarea name="motivo" value={formData.motivo} onChange={handleChange} className="form-input" style={{ height: '100px', resize: 'vertical' }} required placeholder="Explique el motivo de la baja u otras observaciones..."></textarea>
                                        </div>

                                        <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'center', marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '2.5rem' }}>
                                            <button
                                                type="submit"
                                                disabled={loading || equiposBaja.length === 0 || !formData.motivo}
                                                style={{
                                                    background: (loading || equiposBaja.length === 0 || !formData.motivo)
                                                        ? '#cbd5e1'
                                                        : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                                    padding: '1rem 4rem',
                                                    borderRadius: '12px',
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    fontSize: '1rem',
                                                    border: 'none',
                                                    cursor: (loading || equiposBaja.length === 0 || !formData.motivo) ? 'not-allowed' : 'pointer',
                                                    boxShadow: (loading || equiposBaja.length === 0 || !formData.motivo) ? 'none' : '0 10px 15px -3px rgba(239, 68, 68, 0.3)',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    transform: 'translateY(0)'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!(loading || equiposBaja.length === 0 || !formData.motivo)) {
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                        e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(239, 68, 68, 0.4)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = (loading || equiposBaja.length === 0 || !formData.motivo) ? 'none' : '0 10px 15px -3px rgba(239, 68, 68, 0.3)';
                                                }}
                                            >
                                                {loading ? 'Solicitando...' : 'Solicitar Baja de Equipos'}
                                            </button>
                                        </div>
                                    </>
                                )}
                                {type === 'REVISION' && (
                                    <>
                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <SearchableSelect
                                                label="Equipo a Revisar *"
                                                placeholder="Busque por nombre o código..."
                                                value={formData.id_equipo}
                                                onChange={(val) => {
                                                    const eq = equipos.find(e => String(e.id_equipo) === val);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        id_equipo: val,
                                                        nombre: eq?.nombre || '',
                                                        codigo: eq?.codigo || ''
                                                    }));
                                                }}
                                                options={equipos
                                                    .filter(e => e.estado === 'Activo')
                                                    .map(e => ({ id: String(e.id_equipo), nombre: `${e.codigo} - ${e.nombre}` }))}
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label" style={{ whiteSpace: 'nowrap' }}>Motivo de Revisión *</label>
                                            <select
                                                name="motivo_revision"
                                                value={formData.motivo_revision}
                                                onChange={handleChange}
                                                required
                                                className="form-input"
                                            >
                                                <option value="">Seleccione motivo</option>
                                                <option value="CALIBRACION">Calibración</option>
                                                <option value="COMPORTAMIENTO_ANORMAL">Comportamiento Anormal</option>
                                                <option value="REVISION_PERIODICA">Revisión Periódica</option>
                                                <option value="OTRO">Otro</option>
                                            </select>
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Urgencia *</label>
                                            <select
                                                name="urgencia"
                                                value={formData.urgencia}
                                                onChange={handleChange}
                                                required
                                                className="form-input"
                                            >
                                                <option value="">Seleccione urgencia</option>
                                                <option value="BAJA">Baja</option>
                                                <option value="MEDIA">Media</option>
                                                <option value="ALTA">Alta</option>
                                            </select>
                                        </div>

                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <label className="form-label">Descripción Detallada *</label>
                                            <textarea
                                                name="descripcion"
                                                value={formData.descripcion}
                                                onChange={handleChange}
                                                required
                                                rows={4}
                                                placeholder="Describa el motivo de la revisión..."
                                                className="form-input"
                                                style={{ height: '100px', resize: 'vertical' }}
                                            />
                                        </div>

                                        <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'center', marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '2.5rem' }}>
                                            <button
                                                type="submit"
                                                disabled={loading || !formData.id_equipo || !formData.motivo_revision || !formData.descripcion || !formData.urgencia}
                                                style={{
                                                    background: (loading || !formData.id_equipo || !formData.motivo_revision || !formData.descripcion || !formData.urgencia)
                                                        ? '#cbd5e1'
                                                        : 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
                                                    padding: '1rem 4rem',
                                                    borderRadius: '12px',
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    fontSize: '1rem',
                                                    border: 'none',
                                                    cursor: (loading || !formData.id_equipo || !formData.motivo_revision || !formData.descripcion || !formData.urgencia) ? 'not-allowed' : 'pointer',
                                                    boxShadow: (loading || !formData.id_equipo || !formData.motivo_revision || !formData.descripcion || !formData.urgencia) ? 'none' : '0 10px 15px -3px rgba(8, 145, 178, 0.3)',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    transform: 'translateY(0)'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!(loading || !formData.id_equipo || !formData.motivo_revision || !formData.descripcion || !formData.urgencia)) {
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                        e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(8, 145, 178, 0.4)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = (loading || !formData.id_equipo || !formData.motivo_revision || !formData.descripcion || !formData.urgencia) ? 'none' : '0 10px 15px -3px rgba(8, 145, 178, 0.3)';
                                                }}
                                            >
                                                {loading ? 'Enviando...' : 'Solicitar Revisión'}
                                            </button>
                                        </div>
                                    </>
                                )}

                                {type === 'VIGENCIA_PROXIMA' && (
                                    <>
                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <SearchableSelect
                                                label="Equipo próximo a vencer *"
                                                placeholder="Busque equipo..."
                                                value={formData.id_equipo}
                                                onChange={(val) => {
                                                    const eq = equipos.find(e => String(e.id_equipo) === val);
                                                    setFormData({
                                                        ...formData,
                                                        id_equipo: val,
                                                        vigencia_actual: eq?.vigencia || ''
                                                    });
                                                }}
                                                options={equipos
                                                    .filter(e => {
                                                        if (!e.vigencia) return false;
                                                        const vigDate = new Date(e.vigencia);
                                                        const today = new Date();
                                                        const diffDays = Math.ceil((vigDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                                        return diffDays <= 60 && diffDays >= -30; // Mostrar vencidos hace poco o por vencer en 60 dias
                                                    })
                                                    .map(e => ({ id: String(e.id_equipo), nombre: `${e.codigo} - ${e.nombre} (Vence: ${formatDateValue(e.vigencia)})` }))}
                                            />
                                        </div>

                                        {formData.vigencia_actual && (
                                            <div style={{ gridColumn: 'span 2', fontSize: '0.85rem', color: '#6b7280', display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.25rem', paddingLeft: '0.25rem' }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#9ca3af' }}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                <span><strong>Vigencia Actual:</strong> {formatDateValue(formData.vigencia_actual)}</span>
                                            </div>
                                        )}

                                        <div className="form-group">
                                            <label className="form-label">Nueva Vigencia Solicitada *</label>
                                            <input
                                                type="date"
                                                name="nueva_vigencia_solicitada"
                                                value={formData.nueva_vigencia_solicitada}
                                                onChange={handleChange}
                                                required
                                                min={new Date().toISOString().split('T')[0]}
                                                className="form-input"
                                            />
                                        </div>

                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <label className="form-label">Justificación *</label>
                                            <textarea
                                                name="justificacion"
                                                value={formData.justificacion}
                                                onChange={handleChange}
                                                required
                                                rows={3}
                                                placeholder="Explique por qué necesita extender la vigencia..."
                                                className="form-input"
                                                style={{ height: '80px', resize: 'vertical' }}
                                            />
                                        </div>

                                        <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'center', marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '2.5rem' }}>
                                            <button
                                                type="submit"
                                                disabled={loading || !formData.id_equipo || !formData.nueva_vigencia_solicitada || !formData.justificacion}
                                                style={{
                                                    background: (loading || !formData.id_equipo || !formData.nueva_vigencia_solicitada || !formData.justificacion)
                                                        ? '#cbd5e1'
                                                        : 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
                                                    padding: '1rem 4rem',
                                                    borderRadius: '12px',
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    fontSize: '1rem',
                                                    border: 'none',
                                                    cursor: (loading || !formData.id_equipo || !formData.nueva_vigencia_solicitada || !formData.justificacion) ? 'not-allowed' : 'pointer',
                                                    boxShadow: (loading || !formData.id_equipo || !formData.nueva_vigencia_solicitada || !formData.justificacion) ? 'none' : '0 10px 15px -3px rgba(8, 145, 178, 0.3)',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    transform: 'translateY(0)'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!(loading || !formData.id_equipo || !formData.nueva_vigencia_solicitada || !formData.justificacion)) {
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                        e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(8, 145, 178, 0.4)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = (loading || !formData.id_equipo || !formData.nueva_vigencia_solicitada || !formData.justificacion) ? 'none' : '0 10px 15px -3px rgba(8, 145, 178, 0.3)';
                                                }}
                                            >
                                                {loading ? 'Enviando...' : 'Solicitar Extensión'}
                                            </button>
                                        </div>
                                    </>
                                )}

                                {type === 'EQUIPO_PERDIDO' && (
                                    <>
                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <SearchableSelect
                                                label="Equipo Perdido *"
                                                placeholder="Seleccione el equipo perdido..."
                                                value={formData.id_equipo}
                                                onChange={(val) => {
                                                    const eq = equipos.find(e => String(e.id_equipo) === val);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        id_equipo: val,
                                                        nombre: eq?.nombre || '',
                                                        codigo: eq?.codigo || ''
                                                    }));
                                                }}
                                                options={equipos
                                                    .filter(e => e.estado === 'Activo')
                                                    .map(e => ({ id: String(e.id_equipo), nombre: `${e.codigo} - ${e.nombre}` }))}
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Fecha del Incidente *</label>
                                            <input
                                                type="date"
                                                name="fecha_incidente"
                                                value={formData.fecha_incidente}
                                                onChange={handleChange}
                                                required
                                                max={new Date().toISOString().split('T')[0]}
                                                className="form-input"
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Tipo de Pérdida *</label>
                                            <select
                                                name="tipo_perdida"
                                                value={formData.tipo_perdida}
                                                onChange={handleChange}
                                                required
                                                className="form-input"
                                            >
                                                <option value="">Seleccione tipo</option>
                                                <option value="EXTRAVIO">Extravío</option>
                                                <option value="ROBO">Robo</option>
                                                <option value="DANO_IRREPARABLE">Daño Irreparable</option>
                                                <option value="OTRO">Otro</option>
                                            </select>
                                        </div>

                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <label className="form-label">Ubicación Última Conocida *</label>
                                            <input
                                                type="text"
                                                name="ubicacion_ultima"
                                                value={formData.ubicacion_ultima}
                                                onChange={handleChange}
                                                required
                                                placeholder="Ej: Planta PM, Terreno Sector A"
                                                className="form-input"
                                            />
                                        </div>

                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <label className="form-label">Explícanos tu situación *</label>
                                            <textarea
                                                name="circunstancias"
                                                value={formData.circunstancias}
                                                onChange={handleChange}
                                                required
                                                rows={3}
                                                placeholder="Describa detalladamente cómo ocurrió la pérdida..."
                                                className="form-input"
                                                style={{ height: '80px', resize: 'vertical' }}
                                            />
                                        </div>

                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <label className="form-label">Acciones Tomadas *</label>
                                            <textarea
                                                name="acciones_tomadas"
                                                value={formData.acciones_tomadas}
                                                onChange={handleChange}
                                                required
                                                rows={2}
                                                placeholder="Búsqueda realizada, denuncias presentadas, etc."
                                                className="form-input"
                                                style={{ height: '60px', resize: 'vertical' }}
                                            />
                                        </div>

                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <label className="form-label">Testigos o Referencias (Opcional)</label>
                                            <input
                                                type="text"
                                                name="testigos"
                                                value={formData.testigos}
                                                onChange={handleChange}
                                                placeholder="Nombres de testigos o personas de contacto"
                                                className="form-input"
                                            />
                                        </div>

                                        <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'center', marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '2.5rem' }}>
                                            <button
                                                type="submit"
                                                disabled={loading || !formData.id_equipo || !formData.fecha_incidente || !formData.tipo_perdida || !formData.ubicacion_ultima || !formData.circunstancias || !formData.acciones_tomadas}
                                                style={{
                                                    background: (loading || !formData.id_equipo || !formData.fecha_incidente || !formData.tipo_perdida || !formData.ubicacion_ultima || !formData.circunstancias || !formData.acciones_tomadas)
                                                        ? '#cbd5e1'
                                                        : 'linear-gradient(135deg, #475569 0%, #1e293b 100%)',
                                                    padding: '1rem 4rem',
                                                    borderRadius: '12px',
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    fontSize: '1rem',
                                                    border: 'none',
                                                    cursor: (loading || !formData.id_equipo || !formData.fecha_incidente || !formData.tipo_perdida || !formData.ubicacion_ultima || !formData.circunstancias || !formData.acciones_tomadas) ? 'not-allowed' : 'pointer',
                                                    boxShadow: (loading || !formData.id_equipo || !formData.fecha_incidente || !formData.tipo_perdida || !formData.ubicacion_ultima || !formData.circunstancias || !formData.acciones_tomadas) ? 'none' : '0 10px 15px -3px rgba(71, 85, 105, 0.3)',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    transform: 'translateY(0)'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!(loading || !formData.id_equipo || !formData.fecha_incidente || !formData.tipo_perdida || !formData.ubicacion_ultima || !formData.circunstancias || !formData.acciones_tomadas)) {
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                        e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(71, 85, 105, 0.4)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = (loading || !formData.id_equipo || !formData.fecha_incidente || !formData.tipo_perdida || !formData.ubicacion_ultima || !formData.circunstancias || !formData.acciones_tomadas) ? 'none' : '0 10px 15px -3px rgba(71, 85, 105, 0.3)';
                                                }}
                                            >
                                                {loading ? 'Procesando...' : 'Enviar Solicitud de Pérdida'}
                                            </button>
                                        </div>
                                    </>
                                )}

                                {type === 'REPORTE_PROBLEMA' && (
                                    <>
                                        <div className="form-group prob-equipo" style={{ gridColumn: 'span 2' }}>
                                            <SearchableSelect
                                                label="Equipo con Problema *"
                                                placeholder="Seleccione el equipo..."
                                                value={formData.id_equipo}
                                                onChange={(val) => {
                                                    const eq = equipos.find(e => String(e.id_equipo) === val);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        id_equipo: val,
                                                        nombre: eq?.nombre || '',
                                                        codigo: eq?.codigo || ''
                                                    }));
                                                }}
                                                options={equipos
                                                    .filter(e => e.estado === 'Activo')
                                                    .map(e => ({ id: String(e.id_equipo), nombre: `${e.codigo} - ${e.nombre}` }))}
                                            />
                                        </div>

                                        <div className="prob-tipo-frecuencia-row" style={{ gridColumn: 'span 2' }}>
                                            <div className="form-group prob-tipo">
                                                <label className="form-label">Tipo de Problema *</label>
                                                <select
                                                    name="tipo_problema"
                                                    value={formData.tipo_problema}
                                                    onChange={handleChange}
                                                    required
                                                    className="form-input"
                                                >
                                                    <option value="">Seleccione tipo</option>
                                                    <option value="FALLA_TECNICA">Falla Técnica</option>
                                                    <option value="LECTURAS_INCORRECTAS">Lecturas Incorrectas</option>
                                                    <option value="DANO_FISICO">Daño Físico</option>
                                                    <option value="BATERIA">Batería/Alimentación</option>
                                                    <option value="CONECTIVIDAD">Conectividad</option>
                                                    <option value="OTRO">Otro</option>
                                                </select>
                                            </div>

                                            <div className="form-group prob-frecuencia">
                                                <label className="form-label">Frecuencia *</label>
                                                <select
                                                    name="frecuencia"
                                                    value={formData.frecuencia}
                                                    onChange={handleChange}
                                                    required
                                                    className="form-input"
                                                >
                                                    <option value="">Seleccione frecuencia</option>
                                                    <option value="CONSTANTE">Constante</option>
                                                    <option value="INTERMITENTE">Intermitente</option>
                                                    <option value="OCASIONAL">Ocasional</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="form-group prob-afecta" style={{ gridColumn: 'span 2' }}>
                                            <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>¿Afecta la calidad de las mediciones?</label>
                                            <div className="form-actions-stack" style={{ display: 'flex', gap: '1rem' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, afecta_mediciones: true }))}
                                                    style={{
                                                        flex: 1,
                                                        padding: '0.8rem',
                                                        borderRadius: '8px',
                                                        border: formData.afecta_mediciones ? '2px solid #ef4444' : '1px solid #e2e8f0',
                                                        background: formData.afecta_mediciones ? '#fee2e2' : 'white',
                                                        color: formData.afecta_mediciones ? '#991b1b' : '#64748b',
                                                        fontWeight: formData.afecta_mediciones ? 700 : 400,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    SÍ
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({ ...prev, afecta_mediciones: false }))}
                                                    style={{
                                                        flex: 1,
                                                        padding: '0.8rem',
                                                        borderRadius: '8px',
                                                        border: !formData.afecta_mediciones ? '2px solid #22c55e' : '1px solid #e2e8f0',
                                                        background: !formData.afecta_mediciones ? '#dcfce7' : 'white',
                                                        color: !formData.afecta_mediciones ? '#15803d' : '#64748b',
                                                        fontWeight: !formData.afecta_mediciones ? 700 : 400,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    NO
                                                </button>
                                            </div>
                                        </div>

                                        <div className="form-group prob-desc" style={{ gridColumn: 'span 2' }}>
                                            <label className="form-label">Descripción Detallada *</label>
                                            <textarea
                                                name="descripcion"
                                                value={formData.descripcion}
                                                onChange={handleChange}
                                                required
                                                rows={3}
                                                placeholder="Describa el problema en detalle..."
                                                className="form-input"
                                                style={{ height: '80px', resize: 'vertical' }}
                                            />
                                        </div>

                                        <div className="form-group prob-sintomas" style={{ gridColumn: 'span 2' }}>
                                            <label className="form-label">Síntomas Observados *</label>
                                            <textarea
                                                name="sintomas"
                                                value={formData.sintomas}
                                                onChange={handleChange}
                                                required
                                                rows={2}
                                                placeholder="Ej: Lecturas erráticas, pantalla parpadeante, etc."
                                                className="form-input"
                                                style={{ height: '60px', resize: 'vertical' }}
                                            />
                                        </div>

                                        <div className="prob-actions" style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'center', marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '2.5rem' }}>
                                            <button
                                                type="submit"
                                                disabled={loading || !formData.id_equipo || !formData.tipo_problema || !formData.frecuencia || !formData.descripcion || !formData.sintomas}
                                                style={{
                                                    background: (loading || !formData.id_equipo || !formData.tipo_problema || !formData.frecuencia || !formData.descripcion || !formData.sintomas)
                                                        ? '#cbd5e1'
                                                        : 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                                                    padding: '1rem 4rem',
                                                    borderRadius: '12px',
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    fontSize: '1rem',
                                                    border: 'none',
                                                    cursor: (loading || !formData.id_equipo || !formData.tipo_problema || !formData.frecuencia || !formData.descripcion || !formData.sintomas) ? 'not-allowed' : 'pointer',
                                                    boxShadow: (loading || !formData.id_equipo || !formData.tipo_problema || !formData.frecuencia || !formData.descripcion || !formData.sintomas) ? 'none' : '0 10px 15px -3px rgba(225, 29, 72, 0.3)',
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    transform: 'translateY(0)'
                                                }}
                                                onMouseEnter={(e) => {
                                                    if (!(loading || !formData.id_equipo || !formData.tipo_problema || !formData.frecuencia || !formData.descripcion || !formData.sintomas)) {
                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                        e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(225, 29, 72, 0.4)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                    e.currentTarget.style.boxShadow = (loading || !formData.id_equipo || !formData.tipo_problema || !formData.frecuencia || !formData.descripcion || !formData.sintomas) ? 'none' : '0 10px 15px -3px rgba(225, 29, 72, 0.3)';
                                                }}
                                            >
                                                {loading ? 'Procesando...' : 'Enviar Reporte de Problema'}
                                            </button>
                                        </div>
                                    </>
                                )}

                                {type === 'EQUIPO_DESHABILITADO' && (
                                    <>
                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <div style={{
                                                background: '#fff1f2',
                                                border: '1px solid #fecdd3',
                                                borderRadius: '8px',
                                                padding: '1rem',
                                                marginBottom: '1.5rem',
                                                display: 'flex',
                                                gap: '0.75rem',
                                                alignItems: 'flex-start'
                                            }}>
                                                <div style={{
                                                    minWidth: '24px',
                                                    height: '24px',
                                                    borderRadius: '50%',
                                                    background: '#f43f5e',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'white',
                                                    marginTop: '2px'
                                                }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                </div>
                                                <div>
                                                    <p style={{ margin: '0 0 0.25rem 0', fontWeight: 700, color: '#9f1239', fontSize: '0.9rem' }}>Análisis / Reactivación de Equipo Deshabilitado</p>
                                                    <p style={{ margin: 0, color: '#be123c', fontSize: '0.8rem' }}>
                                                        Solicite el análisis de un equipo que se encuentra actualmente "Inactivo" o deshabilitado. Indique el motivo y proponga una nueva fecha de vigencia si corresponde reactivarlo.
                                                    </p>
                                                </div>
                                            </div>

                                            <SearchableSelect
                                                label="Equipo a Analizar / Reactivar *"
                                                placeholder="Busque equipo inactivo..."
                                                value={formData.id_equipo}
                                                onChange={(val) => {
                                                    const eq = equipos.find(e => String(e.id_equipo) === val);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        id_equipo: val,
                                                        nombre: eq?.nombre || '',
                                                        codigo: eq?.codigo || ''
                                                    }));
                                                }}
                                                options={equipos
                                                    .filter(e => e.estado !== 'Activo') // Mostrar solo equipos INACTIVOS/Deshabilitados
                                                    .map(e => ({ id: String(e.id_equipo), nombre: `${e.codigo} - ${e.nombre} (${e.estado})` }))}
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Nueva Fecha de Vigencia Propuesta *</label>
                                            <input
                                                type="date"
                                                name="vigencia"
                                                value={formData.vigencia}
                                                onChange={handleChange}
                                                required
                                                min={new Date().toISOString().split('T')[0]}
                                                className="form-input"
                                            />
                                        </div>

                                        <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                            <label className="form-label">Observaciones / Motivo de Reactivación *</label>
                                            <textarea
                                                name="motivo"
                                                value={formData.motivo}
                                                onChange={handleChange}
                                                required
                                                rows={3}
                                                placeholder="Explique por qué se solicita activar este equipo..."
                                                className="form-input"
                                                style={{ height: '100px', resize: 'vertical' }}
                                            />
                                        </div>

                                        <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                            <button
                                                type="submit"
                                                disabled={loading || !formData.id_equipo || !formData.motivo || !formData.vigencia}
                                                style={{
                                                    background: (loading || !formData.id_equipo || !formData.motivo || !formData.vigencia)
                                                        ? '#cbd5e1'
                                                        : 'linear-gradient(135deg, #be123c 0%, #881337 100%)',
                                                    padding: '0.8rem 2.5rem',
                                                    borderRadius: '10px',
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    border: 'none',
                                                    cursor: (loading || !formData.id_equipo || !formData.motivo || !formData.vigencia) ? 'not-allowed' : 'pointer',
                                                    boxShadow: (loading || !formData.id_equipo || !formData.motivo || !formData.vigencia) ? 'none' : '0 4px 6px rgba(190, 18, 60, 0.2)',
                                                    transition: 'all 0.3s ease'
                                                }}
                                            >
                                                {loading ? 'Procesando...' : 'Solicitar Análisis/Reactivación'}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </form>
                    </div>
                )
                }


                {/* Technical Review Modal - Redesigned */}
                {
                    showReviewModal && selectedRequest && (
                        <div className="modal-overlay" style={{ zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}>
                            <div className="modal-content" style={{
                                background: 'white',
                                borderRadius: '8px',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                                width: '100%',
                                maxWidth: '600px',
                                maxHeight: '90vh',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden'
                            }}>
                                {/* Header: Minimalist White */}
                                <div className="modal-header" style={{
                                    background: 'white',
                                    padding: '1.25rem 1.5rem 0.5rem 1.5rem',
                                    borderTopLeftRadius: '8px',
                                    borderTopRightRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start'
                                }}>
                                    <div>
                                        <div style={{
                                            color: '#F59E0B',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            fontSize: '0.75rem',
                                            letterSpacing: '0.05em',
                                            marginBottom: '0.25rem'
                                        }}>
                                            REVISIÓN TÉCNICA
                                        </div>
                                        <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', fontWeight: 700 }}>
                                            {getTipoLabel(selectedRequest.tipo_solicitud)}
                                        </h3>
                                    </div>
                                    <button
                                        onClick={() => { setShowReviewModal(false); setSelectedRequest(null); setReviewAction(null); setReviewFeedback(''); }}
                                        style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>

                                <div className="modal-body" style={{ padding: '0 1.5rem 1.5rem 1.5rem', overflowY: 'auto', flex: 1 }}>

                                    {/* Info Card with Red Accent */}
                                    <div style={{
                                        marginTop: '1rem',
                                        background: 'white',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        borderLeft: '4px solid #ef4444',
                                        padding: '1rem',
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '1rem',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>SOLICITANTE</div>
                                            <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.95rem' }}>{selectedRequest.nombre_solicitante}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>FECHA</div>
                                            <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.95rem' }}>{new Date(selectedRequest.fecha_solicitud).toLocaleString()}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>ESTADO</div>
                                            <div style={{
                                                display: 'inline-block',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                background: '#FEF3C7',
                                                color: '#D97706',
                                                fontSize: '0.75rem',
                                                fontWeight: 700
                                            }}>
                                                {getStatusLabel(selectedRequest.estado)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Details Section */}
                                    <div style={{ marginTop: '1.5rem' }}>
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>Detalles de la Solicitud</h4>

                                        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                                            <label style={{ display: 'block', color: '#64748b', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Descripción / Motivo</label>
                                            <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '6px', color: '#334155', fontSize: '0.9rem', lineHeight: '1.5' }}>

                                                {/* ALTA Details */}
                                                {selectedRequest.tipo_solicitud === 'ALTA' && (
                                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                        {selectedRequest.datos_json?.muestreador && (
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>MUESTREADOR</strong>
                                                                <span style={{ fontWeight: 600 }}>{selectedRequest.datos_json.muestreador}</span>
                                                            </div>
                                                        )}
                                                        {selectedRequest.datos_json?.equipos_alta && selectedRequest.datos_json.equipos_alta.length > 0 && (
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>EQUIPOS A ACTIVAR ({selectedRequest.datos_json.equipos_alta.length})</strong>
                                                                <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                                                                    {selectedRequest.datos_json.equipos_alta.map((eq: any, i: number) => (
                                                                        <div key={i} style={{ padding: '0.6rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{eq.nombre}</span>
                                                                            <span style={{ fontSize: '0.75rem', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                                                                Vence: {eq.vigencia ? new Date(eq.vigencia).toLocaleDateString() : 'N/A'}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {selectedRequest.datos_json?.motivo && (
                                                            <div style={{ marginTop: '0.5rem' }}>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>OBSERVACIONES</strong>
                                                                <p style={{ margin: 0, color: '#334155' }}>{selectedRequest.datos_json.motivo}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* TRASPASO Details */}
                                                {selectedRequest.tipo_solicitud === 'TRASPASO' && (
                                                    <div style={{ display: 'grid', gap: '1rem' }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>ORIGEN</strong>
                                                                <div style={{ fontWeight: 600 }}>{selectedRequest.datos_json?.ubicacion_actual}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{selectedRequest.datos_json?.responsable_actual}</div>
                                                            </div>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>DESTINO</strong>
                                                                <div style={{ fontWeight: 600, color: '#2563eb' }}>{selectedRequest.datos_json?.nueva_ubicacion}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{selectedRequest.datos_json?.nuevo_responsable}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* BAJA Details */}
                                                {selectedRequest.tipo_solicitud === 'BAJA' && (
                                                    <div style={{ display: 'grid', gap: '1rem' }}>
                                                        <div>
                                                            <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>MOTIVO DE BAJA</strong>
                                                            <div style={{ fontWeight: 600, color: '#991b1b' }}>{selectedRequest.datos_json?.motivo}</div>
                                                        </div>
                                                        {selectedRequest.datos_json?.equipos_baja && selectedRequest.datos_json.equipos_baja.length > 0 && (
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>EQUIPOS A DAR DE BAJA ({selectedRequest.datos_json.equipos_baja.length})</strong>
                                                                <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto', marginTop: '0.5rem' }}>
                                                                    {selectedRequest.datos_json.equipos_baja.map((eq: any) => (
                                                                        <div key={eq.id} style={{ padding: '0.5rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem' }}>
                                                                            <strong>{eq.nombre}</strong> <span style={{ color: '#64748b' }}>({eq.codigo})</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* REPORTE_PROBLEMA Details */}
                                                {selectedRequest.tipo_solicitud === 'REPORTE_PROBLEMA' && (
                                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>TIPO PROBLEMA</strong>
                                                                <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedRequest.datos_json?.tipo_problema}</span>
                                                            </div>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>SEVERIDAD</strong>
                                                                <span style={{
                                                                    color: selectedRequest.datos_json?.severidad === 'CRITICA' ? '#dc2626' :
                                                                        selectedRequest.datos_json?.severidad === 'ALTA' ? '#ea580c' : '#0f172a',
                                                                    fontWeight: 700,
                                                                    display: 'flex', alignItems: 'center', gap: '4px'
                                                                }}>
                                                                    {selectedRequest.datos_json?.severidad === 'CRITICA' && '??'}
                                                                    {selectedRequest.datos_json?.severidad}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>FRECUENCIA</strong>
                                                                <span>{selectedRequest.datos_json?.frecuencia}</span>
                                                            </div>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>UBICACIÓN</strong>
                                                                <span>{selectedRequest.datos_json?.ubicacion || equipos.find(e => String(e.id_equipo) === String(selectedRequest.datos_json?.id_equipo))?.ubicacion || '-'}</span>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>AFECTA MEDICIONES</strong>
                                                                <span>{selectedRequest.datos_json?.afecta_mediciones ? 'SÍ' : 'NO'}</span>
                                                            </div>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>SÍNTOMAS</strong>
                                                                <p style={{ margin: 0, color: '#334155', fontStyle: 'italic' }}>{selectedRequest.datos_json?.sintomas}</p>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>DESCRIPCIÓN</strong>
                                                            <p style={{ margin: 0, color: '#334155' }}>{selectedRequest.datos_json?.descripcion}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* REVISION Details */}
                                                {selectedRequest.tipo_solicitud === 'REVISION' && (
                                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>MOTIVO REVISIÓN</strong>
                                                                <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedRequest.datos_json?.motivo_revision}</span>
                                                            </div>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>URGENCIA</strong>
                                                                <span style={{
                                                                    color: selectedRequest.datos_json?.urgencia === 'ALTA' ? '#dc2626' :
                                                                        selectedRequest.datos_json?.urgencia === 'MEDIA' ? '#d97706' : '#16a34a',
                                                                    fontWeight: 700
                                                                }}>
                                                                    {selectedRequest.datos_json?.urgencia}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>UBICACIÓN</strong>
                                                                <span>{selectedRequest.datos_json?.ubicacion || equipos.find(e => String(e.id_equipo) === String(selectedRequest.datos_json?.id_equipo))?.ubicacion || '-'}</span>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>DESCRIPCIÓN</strong>
                                                            <p style={{ margin: 0, color: '#334155' }}>{selectedRequest.datos_json?.descripcion}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* EQUIPO_PERDIDO Details */}
                                                {selectedRequest.tipo_solicitud === 'EQUIPO_PERDIDO' && (
                                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>TIPO PÉRDIDA</strong>
                                                                <span style={{ color: '#dc2626', fontWeight: 700 }}>{selectedRequest.datos_json?.tipo_perdida}</span>
                                                            </div>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>FECHA INCIDENTE</strong>
                                                                <span>{selectedRequest.datos_json?.fecha_incidente ? new Date(selectedRequest.datos_json.fecha_incidente).toLocaleDateString() : '-'}</span>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>UBICACIÓN ÚLTIMA</strong>
                                                            <span>{selectedRequest.datos_json?.ubicacion_ultima}</span>
                                                        </div>
                                                        <div>
                                                            <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>EXPLÍCANOS TU SITUACIÓN</strong>
                                                            <p style={{ margin: 0, color: '#334155' }}>{selectedRequest.datos_json?.circunstancias}</p>
                                                        </div>
                                                        <div>
                                                            <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>ACCIONES TOMADAS</strong>
                                                            <p style={{ margin: 0, color: '#334155' }}>{selectedRequest.datos_json?.acciones_tomadas}</p>
                                                        </div>
                                                        {selectedRequest.datos_json?.testigos && (
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>TESTIGOS</strong>
                                                                <span>{selectedRequest.datos_json.testigos}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* VIGENCIA_PROXIMA Details */}
                                                {selectedRequest.tipo_solicitud === 'VIGENCIA_PROXIMA' && (() => {
                                                    const eqData = equipos.find(e => String(e.id_equipo) === String(selectedRequest.datos_json?.id_equipo));
                                                    // Prioritize JSON data then fallback to equipment catalog
                                                    const nombre = selectedRequest.datos_json?.nombre || eqData?.nombre || 'N/A';
                                                    const codigo = selectedRequest.datos_json?.codigo || eqData?.codigo || 'N/A';
                                                    const tipo = eqData?.tipo || 'N/A';
                                                    const ubicacion = eqData?.ubicacion || 'N/A';
                                                    const responsable = eqData?.nombre_asignado || 'N/A';

                                                    // Show the requested new validity if present, otherwise just show current validity or 'N/A'
                                                    // The user screenshot shows "VIGENCIA: 28/02/2026", likely the *requested* one as it's future
                                                    const vigenciaRaw = selectedRequest.datos_json?.nueva_vigencia_solicitada ||
                                                        selectedRequest.datos_json?.vigencia_propuesta ||
                                                        selectedRequest.datos_json?.vigencia ||
                                                        selectedRequest.datos_json?.nueva_vigencia ||
                                                        eqData?.vigencia;

                                                    const justificacion = selectedRequest.datos_json?.justificacion ||
                                                        selectedRequest.datos_json?.motivo ||
                                                        selectedRequest.datos_json?.descripcion ||
                                                        selectedRequest.datos_json?.observacion ||
                                                        selectedRequest.datos_json?.comentario ||
                                                        selectedRequest.datos_json?.razon;

                                                    return (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                                            {justificacion && (
                                                                <div>
                                                                    <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>JUSTIFICACIÓN / DETALLE</strong>
                                                                    <div style={{ background: '#white', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#1e293b', fontWeight: 500 }}>
                                                                        {justificacion}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                                                                <div>
                                                                    <strong style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>EQUIPO:</strong>
                                                                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{nombre}</span>
                                                                </div>
                                                                <div>
                                                                    <strong style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>CÓDIGO:</strong>
                                                                    <span style={{ fontWeight: 700, color: '#0284c7' }}>{codigo}</span>
                                                                </div>
                                                                <div>
                                                                    <strong style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>TIPO:</strong>
                                                                    <span style={{ color: '#475569' }}>{tipo}</span>
                                                                </div>
                                                                <div>
                                                                    <strong style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>UBICACIÓN:</strong>
                                                                    <span style={{ color: '#475569' }}>{ubicacion}</span>
                                                                </div>
                                                                <div>
                                                                    <strong style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>RESPONSABLE:</strong>
                                                                    <span style={{ color: '#475569' }}>{responsable}</span>
                                                                </div>
                                                                <div>
                                                                    <strong style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>VIGENCIA:</strong>
                                                                    <span style={{ fontWeight: 700, color: '#10b981' }}>
                                                                        {vigenciaRaw ? formatDateValue(vigenciaRaw) : 'N/A'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* EQUIPO_DESHABILITADO Details */}
                                                {selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && (
                                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f0f9ff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#0369a1', textTransform: 'uppercase' }}>EQUIPO</strong>
                                                                <span style={{ fontWeight: 700, color: '#0c4a6e', fontSize: '0.9rem' }}>
                                                                    {selectedRequest.datos_json?.nombre || selectedRequest.datos_json?.equipo_nombre || 'N/A'}
                                                                </span>
                                                                <div style={{ fontSize: '0.8rem', color: '#0284c7' }}>
                                                                    {selectedRequest.datos_json?.codigo || selectedRequest.datos_json?.equipo_codigo}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#0369a1', textTransform: 'uppercase' }}>VIGENCIA PROPUESTA</strong>
                                                                <span style={{ fontWeight: 700, color: '#0284c7', fontSize: '1rem' }}>
                                                                    {selectedRequest.datos_json?.vigencia ? new Date(selectedRequest.datos_json.vigencia).toLocaleDateString() : 'No definida'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>MOTIVO DE ANÁLISIS / REACTIVACIÓN</strong>
                                                            <p style={{ margin: 0, color: '#334155', fontWeight: 500, background: 'white', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                                                {selectedRequest.datos_json?.motivo || selectedRequest.datos_json?.descripcion || selectedRequest.datos_json?.comentario || 'No especificado'}
                                                            </p>
                                                        </div>

                                                        <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: '6px', border: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <div style={{ color: '#4b5563', fontSize: '0.75rem', fontWeight: 700 }}>ESTADO ACTUAL</div>
                                                            <div style={{ color: '#6b7280', fontWeight: 600, fontSize: '0.85rem' }}>
                                                                {equipos.find(e => String(e.id_equipo) === String(selectedRequest.datos_json?.id_equipo))?.estado || 'Desconocido'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* CONSULTA_GENERAL Details */}
                                                {selectedRequest.tipo_solicitud === 'CONSULTA_GENERAL' && (
                                                    <div style={{ display: 'grid', gap: '1rem' }}>
                                                        <div>
                                                            <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>ASUNTO / TÍTULO</strong>
                                                            <div style={{ fontWeight: 600, color: '#1e293b' }}>{selectedRequest.datos_json?.asunto || 'Consulta General'}</div>
                                                        </div>
                                                        <div>
                                                            <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>DESCRIPCIÓN DE LA CONSULTA</strong>
                                                            <div style={{
                                                                background: 'white',
                                                                padding: '1rem',
                                                                borderRadius: '6px',
                                                                border: '1px solid #e2e8f0',
                                                                color: '#334155',
                                                                whiteSpace: 'pre-wrap'
                                                            }}>
                                                                {selectedRequest.datos_json?.descripcion || selectedRequest.datos_json?.mensaje || selectedRequest.datos_json?.consulta || 'Sin detalle provisto.'}
                                                            </div>
                                                        </div>
                                                        {(selectedRequest.datos_json?.referencia || selectedRequest.datos_json?.equipo_relacionado) && (
                                                            <div>
                                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Referencia (Opcional):</span>
                                                                <div style={{ color: '#475569', fontSize: '0.85rem' }}>
                                                                    {selectedRequest.datos_json.referencia || selectedRequest.datos_json.equipo_relacionado}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Generic Failover - Skip if it has a specific block above */}
                                                {(!selectedRequest.tipo_solicitud || !['ALTA', 'TRASPASO', 'BAJA', 'REVISION', 'REPORTE_PROBLEMA', 'EQUIPO_PERDIDO', 'VIGENCIA_PROXIMA', 'NUEVO_EQUIPO', 'EQUIPO_DESHABILITADO', 'CONSULTA_GENERAL'].includes(selectedRequest.tipo_solicitud)) && (
                                                    selectedRequest.datos_json?.descripcion || selectedRequest.datos_json?.motivo || selectedRequest.datos_json?.comentario || selectedRequest.datos_json?.justificacion || 'Sin descripción disponible.'
                                                )}
                                            </div>
                                        </div>

                                        {(!viewOnly && (selectedRequest.estado === 'PENDIENTE_TECNICA' || selectedRequest.estado === 'EN_REVISION_TECNICA')) && (
                                            <div style={{ marginTop: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem' }}>
                                                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', background: '#3b82f6', color: 'white', fontSize: '10px' }}>?</span>
                                                    Resolución Técnica
                                                </h4>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                                    {/* Approve & Derivate Button / Tile */}
                                                    <div
                                                        onClick={() => {
                                                            setReviewAction('DERIVADO');
                                                            if (selectedRequest.tipo_solicitud === 'CONSULTA_GENERAL') {
                                                                setReviewFeedback('Solicitar coordinación o revisión física a través de correo');
                                                            }
                                                        }}
                                                        style={{
                                                            cursor: 'pointer',
                                                            border: reviewAction === 'DERIVADO' ? '2px solid #22c55e' : '1px solid #e2e8f0',
                                                            borderRadius: '8px',
                                                            padding: '0.75rem 0.5rem',
                                                            background: reviewAction === 'DERIVADO' ? '#F0FDF4' : 'white',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            gap: '0.4rem',
                                                            transition: 'all 0.2s',
                                                            textAlign: 'center'
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: '28px', height: '28px', borderRadius: '50%',
                                                            background: reviewAction === 'DERIVADO' ? '#22c55e' : '#f1f5f9',
                                                            color: reviewAction === 'DERIVADO' ? 'white' : '#cbd5e1',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                        </div>
                                                        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: reviewAction === 'DERIVADO' ? '#15803d' : '#64748b' }}>
                                                            {selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO'
                                                                ? (selectedRequest.estado === 'PENDIENTE_TECNICA' ? 'Aceptar para análisis' : 'Derivar')
                                                                : 'Aprobar y Derivar'}
                                                        </span>
                                                    </div>

                                                    {/* Approve & Conclude Button / Tile */}
                                                    {selectedRequest.tipo_solicitud !== 'EQUIPO_PERDIDO' &&
                                                        selectedRequest.tipo_solicitud !== 'VIGENCIA_PROXIMA' &&
                                                        !(selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && selectedRequest.estado === 'PENDIENTE_TECNICA') && (
                                                            <div
                                                                onClick={() => {
                                                                    setReviewAction('CONCLUIDO');
                                                                    setReviewFeedback('');
                                                                }}
                                                                style={{
                                                                    cursor: 'pointer',
                                                                    border: reviewAction === 'CONCLUIDO' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                                                    borderRadius: '8px',
                                                                    padding: '0.75rem 0.5rem',
                                                                    background: reviewAction === 'CONCLUIDO' ? '#EFF6FF' : 'white',
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    alignItems: 'center',
                                                                    gap: '0.4rem',
                                                                    transition: 'all 0.2s',
                                                                    textAlign: 'center'
                                                                }}
                                                            >
                                                                <div style={{
                                                                    width: '28px', height: '28px', borderRadius: '50%',
                                                                    background: reviewAction === 'CONCLUIDO' ? '#3b82f6' : '#f1f5f9',
                                                                    color: reviewAction === 'CONCLUIDO' ? 'white' : '#cbd5e1',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                }}>
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                                                </div>
                                                                <span style={{ fontWeight: 700, fontSize: '0.8rem', color: reviewAction === 'CONCLUIDO' ? '#1d4ed8' : '#64748b' }}>
                                                                    {selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' ? 'Solucionado' : 'Aprobar y Concluir'}
                                                                </span>
                                                            </div>
                                                        )}

                                                    {/* Reject Button / Tile */}
                                                    <div
                                                        onClick={() => {
                                                            setReviewAction('RECHAZADO');
                                                            setReviewFeedback('');
                                                        }}
                                                        style={{
                                                            cursor: 'pointer',
                                                            border: reviewAction === 'RECHAZADO' ? '2px solid #ef4444' : '1px solid #e2e8f0',
                                                            borderRadius: '8px',
                                                            padding: '0.75rem 0.5rem',
                                                            background: reviewAction === 'RECHAZADO' ? '#FEF2F2' : 'white',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'center',
                                                            gap: '0.4rem',
                                                            transition: 'all 0.2s',
                                                            textAlign: 'center'
                                                        }}
                                                    >
                                                        <div style={{
                                                            width: '28px', height: '28px', borderRadius: '50%',
                                                            background: reviewAction === 'RECHAZADO' ? '#ef4444' : '#f1f5f9',
                                                            color: reviewAction === 'RECHAZADO' ? 'white' : '#cbd5e1',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                        </div>
                                                        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: reviewAction === 'RECHAZADO' ? '#b91c1c' : '#64748b' }}>
                                                            {selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' ? 'Rechazar' : 'Rechazar Solicitud'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {reviewAction && (
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
                                                            {selectedRequest.tipo_solicitud === 'EQUIPO_PERDIDO' ? 'Observación de la solicitud' :
                                                                (selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && reviewAction === 'RECHAZADO') ? 'Motivo de Rechazo' :
                                                                    (selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && reviewAction === 'DERIVADO') ? 'Detalle de la investigación / Lo que pasa' :
                                                                        (selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && reviewAction === 'CONCLUIDO') ? 'Explicación de la solución / Pasos extra' :
                                                                            selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' ? 'Detalles técnicos / Sustento' : 'Comentarios de la Revisión'} <span style={{ color: '#ef4444' }}>*</span>
                                                        </label>
                                                        <textarea
                                                            className="form-input"
                                                            placeholder={selectedRequest.tipo_solicitud === 'EQUIPO_PERDIDO'
                                                                ? "Ingrese observaciones sobre la pérdida u otras instrucciones..."
                                                                : (selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && reviewAction === 'DERIVADO')
                                                                    ? "Detalle aquí los hallazgos de la investigación técnica and la situación actual..."
                                                                    : (selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && reviewAction === 'CONCLUIDO')
                                                                        ? "Detalle la solución aplicada o los pasos adicionales requeridos para el usuario..."
                                                                        : "Ingrese observaciones técnicas adicionales o instrucciones para Calidad..."}
                                                            value={reviewFeedback}
                                                            onChange={(e) => setReviewFeedback(e.target.value)}
                                                            style={{
                                                                width: '100%',
                                                                minHeight: '80px',
                                                                padding: '0.75rem',
                                                                fontSize: '0.9rem',
                                                                borderRadius: '6px',
                                                                border: '1px solid #cbd5e1',
                                                                outline: 'none',
                                                                resize: 'vertical',
                                                                fontFamily: 'inherit'
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Reply Section for Quality Review */}
                                        {(selectedRequest.estado === 'PENDIENTE_CALIDAD' &&
                                            ['REPORTE_PROBLEMA', 'REVISION'].includes(selectedRequest.tipo_solicitud) &&
                                            isReplying) && (
                                                <div style={{ marginTop: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', background: '#F8FAFC' }}>
                                                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>Respuesta a Solicitud</h4>
                                                    <label style={{ display: 'block', color: '#64748b', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                                                        Mensaje de Respuesta / Instrucciones <span style={{ color: '#ef4444' }}>*</span>
                                                    </label>
                                                    <textarea
                                                        value={reviewFeedback}
                                                        onChange={(e) => setReviewFeedback(e.target.value)}
                                                        placeholder="Ingrese su respuesta para solicitar el equipo o dar instrucciones..."
                                                        style={{
                                                            width: '100%',
                                                            padding: '1rem',
                                                            borderRadius: '6px',
                                                            border: '1px solid #cbd5e1',
                                                            background: 'white',
                                                            color: '#334155',
                                                            fontSize: '0.9rem',
                                                            lineHeight: '1.5',
                                                            minHeight: '120px',
                                                            resize: 'none',
                                                            outline: 'none'
                                                        }}
                                                    />
                                                </div>
                                            )}
                                    </div>

                                    {/* Footer */}
                                    <div className="modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', background: 'white' }}>
                                        <button
                                            onClick={() => { setShowReviewModal(false); setSelectedRequest(null); }}
                                            style={{
                                                marginRight: 'auto',
                                                padding: '0.6rem 1.25rem',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                background: 'white',
                                                color: '#334155',
                                                fontWeight: 600,
                                                fontSize: '0.9rem',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {viewOnly ? 'Cerrar' : (isReplying ? 'Cancelar' : 'Cancelar')}
                                        </button>
                                        {!viewOnly && (
                                            <>
                                                {/* Reply Flow Buttons */}
                                                {(selectedRequest.estado === 'PENDIENTE_CALIDAD' &&
                                                    ['REPORTE_PROBLEMA', 'REVISION'].includes(selectedRequest.tipo_solicitud)) ? (
                                                    <>
                                                        {!isReplying ? (
                                                            <button
                                                                onClick={() => {
                                                                    setIsReplying(true);
                                                                    setReviewFeedback('');
                                                                }}
                                                                style={{
                                                                    padding: '0.6rem 1.25rem',
                                                                    borderRadius: '6px',
                                                                    border: 'none',
                                                                    background: '#3b82f6',
                                                                    color: 'white',
                                                                    fontWeight: 600,
                                                                    fontSize: '0.9rem',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.5rem'
                                                                }}
                                                            >
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                                                Responder
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={handleSendReply}
                                                                disabled={loading || !reviewFeedback.trim()}
                                                                style={{
                                                                    padding: '0.6rem 1.25rem',
                                                                    borderRadius: '6px',
                                                                    border: 'none',
                                                                    background: !reviewFeedback.trim() ? '#94a3b8' : '#16a34a',
                                                                    color: 'white',
                                                                    fontWeight: 600,
                                                                    fontSize: '0.9rem',
                                                                    cursor: (loading || !reviewFeedback.trim()) ? 'not-allowed' : 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.5rem'
                                                                }}
                                                            >
                                                                {loading ? 'Enviando...' : 'Enviar Respuesta'}
                                                            </button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={submitTechnicalReview}
                                                        disabled={
                                                            !reviewAction ||
                                                            (reviewAction === 'RECHAZADO' && !reviewFeedback.trim()) ||
                                                            (reviewAction === 'DERIVADO' && selectedRequest.tipo_solicitud === 'CONSULTA_GENERAL' && !reviewFeedback.trim()) ||
                                                            loading
                                                        }
                                                        style={{
                                                            padding: '0.6rem 1.25rem',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            background: !reviewAction ? '#94a3b8' : '#64748b',
                                                            color: 'white',
                                                            fontWeight: 600,
                                                            fontSize: '0.9rem',
                                                            cursor: (!reviewAction || loading) ? 'not-allowed' : 'pointer',
                                                        }}
                                                    >
                                                        {loading ? 'Procesando...' : 'Confirmar Revisión'}
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Request Detail Modal - Redesigned to match Review Modal */}
                {
                    selectedRequest && !showReviewModal && (
                        <div className="modal-overlay" style={{ zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)' }}>
                            <div className="modal-content" style={{
                                background: 'white',
                                borderRadius: '8px',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                                width: '100%',
                                maxWidth: '600px',
                                maxHeight: '90vh',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden'
                            }}>
                                {/* Header: Minimalist White */}
                                <div className="modal-header" style={{
                                    background: 'white',
                                    padding: '1.25rem 1.5rem 0.5rem 1.5rem',
                                    borderTopLeftRadius: '8px',
                                    borderTopRightRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start'
                                }}>
                                    <div>
                                        <div style={{
                                            color: '#F59E0B',
                                            fontWeight: 700,
                                            textTransform: 'uppercase',
                                            fontSize: '0.75rem',
                                            letterSpacing: '0.05em',
                                            marginBottom: '0.25rem'
                                        }}>
                                            DETALLE DE SOLICITUD
                                        </div>
                                        <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', fontWeight: 700 }}>
                                            {getTipoLabel(selectedRequest.tipo_solicitud)}
                                        </h3>

                                        {/* REVISION */}
                                    </div>
                                    <button
                                        onClick={() => { setSelectedRequest(null); }}
                                        style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>

                                <div className="modal-body" style={{ padding: '0 1.5rem 1.5rem 1.5rem', overflowY: 'auto', flex: 1 }}>

                                    {/* Info Card with Red Accent */}
                                    <div style={{
                                        marginTop: '1rem',
                                        background: 'white',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        borderLeft: '4px solid #ef4444',
                                        padding: '1rem',
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '1rem',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>SOLICITANTE</div>
                                            <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.95rem' }}>{selectedRequest.nombre_solicitante}</div>
                                            {(selectedRequest.email_solicitante || selectedRequest.email_muestreador) && (
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', wordBreak: 'break-all', maxWidth: '100%' }}>{selectedRequest.email_solicitante || selectedRequest.email_muestreador}</div>
                                            )}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>FECHA</div>
                                            <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.95rem' }}>{new Date(selectedRequest.fecha_solicitud).toLocaleString()}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>ESTADO</div>
                                            <div style={{
                                                display: 'inline-block',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                background: selectedRequest.estado === 'APROBADO' ? '#dcfce7' : selectedRequest.estado?.includes('RECHAZAD') ? '#fee2e2' : '#FEF3C7',
                                                color: selectedRequest.estado === 'APROBADO' ? '#166534' : selectedRequest.estado?.includes('RECHAZAD') ? '#991b1b' : '#D97706',
                                                fontSize: '0.75rem',
                                                fontWeight: 700
                                            }}>
                                                {getStatusLabel(selectedRequest.estado)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Details Section */}
                                    <div style={{ marginTop: '1.5rem' }}>
                                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>Detalles de la Solicitud</h4>

                                        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                                            <label style={{ display: 'block', color: '#64748b', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Descripción / Motivo</label>
                                            <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '6px', color: '#334155', fontSize: '0.9rem', lineHeight: '1.5' }}>

                                                {/* ALTA Details */}
                                                {selectedRequest.tipo_solicitud === 'ALTA' && (
                                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                        {selectedRequest.datos_json?.muestreador && (
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>MUESTREADOR</strong>
                                                                <span style={{ fontWeight: 600 }}>{selectedRequest.datos_json.muestreador}</span>
                                                            </div>
                                                        )}
                                                        {selectedRequest.datos_json?.equipos_alta && selectedRequest.datos_json.equipos_alta.length > 0 && (
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>EQUIPOS A ACTIVAR ({selectedRequest.datos_json.equipos_alta.length})</strong>
                                                                <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
                                                                    {selectedRequest.datos_json.equipos_alta.map((eq: any, i: number) => (
                                                                        <div key={i} style={{ padding: '0.6rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{eq.nombre}</span>
                                                                            <span style={{ fontSize: '0.75rem', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                                                                Vence: {eq.vigencia ? new Date(eq.vigencia).toLocaleDateString() : 'N/A'}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {selectedRequest.datos_json?.motivo && (
                                                            <div style={{ marginTop: '0.5rem' }}>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>OBSERVACIONES</strong>
                                                                <p style={{ margin: 0, color: '#334155' }}>{selectedRequest.datos_json.motivo}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* TRASPASO Details */}
                                                {selectedRequest.tipo_solicitud === 'TRASPASO' && (
                                                    <div style={{ display: 'grid', gap: '1rem' }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>ORIGEN</strong>
                                                                <div style={{ fontWeight: 600 }}>{selectedRequest.datos_json?.ubicacion_actual}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{selectedRequest.datos_json?.responsable_actual}</div>
                                                            </div>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>DESTINO</strong>
                                                                <div style={{ fontWeight: 600, color: '#2563eb' }}>{selectedRequest.datos_json?.nueva_ubicacion}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{selectedRequest.datos_json?.nuevo_responsable}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* BAJA Details */}
                                                {selectedRequest.tipo_solicitud === 'BAJA' && (
                                                    <div style={{ display: 'grid', gap: '1rem' }}>
                                                        <div>
                                                            <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>MOTIVO DE BAJA</strong>
                                                            <div style={{ fontWeight: 600, color: '#991b1b' }}>{selectedRequest.datos_json?.motivo}</div>
                                                        </div>
                                                        {selectedRequest.datos_json?.equipos_baja && selectedRequest.datos_json.equipos_baja.length > 0 && (
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>EQUIPOS A DAR DE BAJA ({selectedRequest.datos_json.equipos_baja.length})</strong>
                                                                <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto', marginTop: '0.5rem' }}>
                                                                    {selectedRequest.datos_json.equipos_baja.map((eq: any) => (
                                                                        <div key={eq.id} style={{ padding: '0.5rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.85rem' }}>
                                                                            <strong>{eq.nombre}</strong> <span style={{ color: '#64748b' }}>({eq.codigo})</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* REPORTE_PROBLEMA Details */}
                                                {selectedRequest.tipo_solicitud === 'REPORTE_PROBLEMA' && (
                                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>TIPO PROBLEMA</strong>
                                                                <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedRequest.datos_json?.tipo_problema}</span>
                                                            </div>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>SEVERIDAD</strong>
                                                                <span style={{
                                                                    color: selectedRequest.datos_json?.severidad === 'CRITICA' ? '#dc2626' :
                                                                        selectedRequest.datos_json?.severidad === 'ALTA' ? '#ea580c' : '#0f172a',
                                                                    fontWeight: 700
                                                                }}>
                                                                    {selectedRequest.datos_json?.severidad}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>FRECUENCIA</strong>
                                                                <span>{selectedRequest.datos_json?.frecuencia}</span>
                                                            </div>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>UBICACIÓN</strong>
                                                                <span>{selectedRequest.datos_json?.ubicacion || '-'}</span>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>AFECTA MEDICIONES</strong>
                                                                <span>{selectedRequest.datos_json?.afecta_mediciones ? 'SÍ' : 'NO'}</span>
                                                            </div>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>SÍNTOMAS</strong>
                                                                <p style={{ margin: 0, color: '#334155', fontStyle: 'italic' }}>{selectedRequest.datos_json?.sintomas}</p>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>DESCRIPCIÓN</strong>
                                                            <p style={{ margin: 0, color: '#334155' }}>{selectedRequest.datos_json?.descripcion}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* REVISION Details */}
                                                {selectedRequest.tipo_solicitud === 'REVISION' && (
                                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>MOTIVO REVISIÓN</strong>
                                                                <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedRequest.datos_json?.motivo_revision}</span>
                                                            </div>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>URGENCIA</strong>
                                                                <span style={{ fontWeight: 700 }}>{selectedRequest.datos_json?.urgencia}</span>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>DESCRIPCIÓN</strong>
                                                            <p style={{ margin: 0, color: '#334155' }}>{selectedRequest.datos_json?.descripcion}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* EQUIPO_PERDIDO Details */}
                                                {selectedRequest.tipo_solicitud === 'EQUIPO_PERDIDO' && (
                                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                                            <div><strong style={{ fontSize: '0.75rem', color: '#64748b' }}>TIPO PÉRDIDA</strong> <span style={{ color: '#dc2626', fontWeight: 700 }}>{selectedRequest.datos_json?.tipo_perdida}</span></div>
                                                            <div><strong style={{ fontSize: '0.75rem', color: '#64748b' }}>FECHA</strong> <span>{selectedRequest.datos_json?.fecha_incidente ? new Date(selectedRequest.datos_json.fecha_incidente).toLocaleDateString() : '-'}</span></div>
                                                        </div>
                                                        <div><strong style={{ fontSize: '0.75rem', color: '#64748b' }}>EXPLÍCANOS TU SITUACIÓN</strong> <p style={{ margin: 0 }}>{selectedRequest.datos_json?.circunstancias}</p></div>
                                                    </div>
                                                )}

                                                {/* CONSULTA_GENERAL Details */}
                                                {selectedRequest.tipo_solicitud === 'CONSULTA_GENERAL' && (
                                                    <div style={{ display: 'grid', gap: '1rem' }}>
                                                        <div>
                                                            <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>CONSULTA</strong>
                                                            <p style={{ margin: 0, color: '#334155' }}>{selectedRequest.datos_json?.descripcion || selectedRequest.datos_json?.consulta || 'Sin descripción'}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* EQUIPO_DESHABILITADO Details */}
                                                {selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && (() => {
                                                    const eqInfo = equipos.find(e => String(e.id_equipo) === String(selectedRequest.datos_json?.id_equipo));
                                                    const nombre = selectedRequest.datos_json?.nombre || eqInfo?.nombre || 'Desconocido';
                                                    const codigo = selectedRequest.datos_json?.codigo || eqInfo?.codigo || 'Desconocido';
                                                    const tipo = selectedRequest.datos_json?.tipo || eqInfo?.tipo || 'Desconocido';
                                                    const ubicacion = selectedRequest.datos_json?.ubicacion || eqInfo?.ubicacion || 'Desconocido';
                                                    const estado = eqInfo?.estado || 'Cargando...';

                                                    return (
                                                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                                                                <div>
                                                                    <strong style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Equipo</strong>
                                                                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{nombre}</span>
                                                                </div>
                                                                <div>
                                                                    <strong style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Código</strong>
                                                                    <span style={{ fontWeight: 700, color: '#0369a1' }}>{codigo}</span>
                                                                </div>
                                                                <div style={{ marginTop: '0.5rem' }}>
                                                                    <strong style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Tipo</strong>
                                                                    <span style={{ color: '#475569', fontSize: '0.85rem' }}>{tipo}</span>
                                                                </div>
                                                                <div style={{ marginTop: '0.5rem' }}>
                                                                    <strong style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Ubicación</strong>
                                                                    <span style={{ color: '#475569', fontSize: '0.85rem' }}>{ubicacion}</span>
                                                                </div>
                                                                <div style={{ marginTop: '0.5rem' }}>
                                                                    <strong style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Responsable</strong>
                                                                    <span style={{ color: '#475569', fontSize: '0.85rem' }}>
                                                                        {selectedRequest.datos_json?.responsable || eqInfo?.nombre_asignado || 'N/A'}
                                                                    </span>
                                                                </div>
                                                                <div style={{ marginTop: '0.5rem' }}>
                                                                    <strong style={{ display: 'block', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Vigencia</strong>
                                                                    <span style={{ color: '#059669', fontSize: '0.85rem', fontWeight: 700 }}>
                                                                        {formatDateValue(selectedRequest.datos_json?.vigencia || eqInfo?.vigencia)}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>MOTIVO FUERA DE SERVICIO</strong>
                                                                <p style={{ margin: 0, color: '#334155', fontWeight: 500 }}>
                                                                    {selectedRequest.datos_json?.motivo || selectedRequest.datos_json?.descripcion || selectedRequest.datos_json?.comentario || 'No especificado'}
                                                                </p>
                                                            </div>
                                                            <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#fff7ed', borderRadius: '6px', border: '1px solid #ffedd5' }}>
                                                                <div style={{ color: '#9a3412', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>ESTADO ACTUAL DEL EQUIPO</div>
                                                                <div style={{ color: '#c2410c', fontWeight: 600 }}>
                                                                    {estado}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* NUEVO_EQUIPO Details */}
                                                {selectedRequest.tipo_solicitud === 'NUEVO_EQUIPO' && (
                                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>CÓDIGO GENERADO</strong>
                                                                <span style={{ fontWeight: 700, color: '#0369a1' }}>{selectedRequest.datos_json?.codigo}</span>
                                                            </div>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>TIPO</strong>
                                                                <span>{selectedRequest.datos_json?.tipo}</span>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>NOMBRE DEL EQUIPO</strong>
                                                            <span style={{ fontWeight: 600 }}>{selectedRequest.datos_json?.nombre}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>UBICACIÓN</strong>
                                                                <span>{selectedRequest.datos_json?.ubicacion}</span>
                                                            </div>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>RESPONSABLE</strong>
                                                                <span>{selectedRequest.datos_json?.responsable}</span>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>FECHA VIGENCIA</strong>
                                                            <span style={{ color: '#059669', fontWeight: 700 }}>{selectedRequest.datos_json?.vigencia ? new Date(selectedRequest.datos_json.vigencia).toLocaleDateString() : '-'}</span>
                                                        </div>
                                                        {selectedRequest.datos_json?.motivo && (
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>OBSERVACIONES</strong>
                                                                <p style={{ margin: 0, color: '#334155' }}>{selectedRequest.datos_json.motivo}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* VIGENCIA_PROXIMA Details */}
                                                {selectedRequest.tipo_solicitud === 'VIGENCIA_PROXIMA' && (
                                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>VIGENCIA ACTUAL</strong>
                                                                <span style={{ textDecoration: 'line-through', color: '#64748b' }}>
                                                                    {selectedRequest.datos_json?.vigencia_actual ? new Date(selectedRequest.datos_json.vigencia_actual).toLocaleDateString() : '-'}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>NUEVA VIGENCIA</strong>
                                                                <span style={{ color: '#2563eb', fontWeight: 700 }}>
                                                                    {selectedRequest.datos_json?.nueva_vigencia_solicitada ? new Date(selectedRequest.datos_json.nueva_vigencia_solicitada).toLocaleDateString() : '-'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <strong style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>JUSTIFICACIÓN</strong>
                                                            <p style={{ margin: 0, color: '#334155', fontStyle: 'italic' }}>{selectedRequest.datos_json?.justificacion}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Generic Failover */}
                                                {(!selectedRequest.tipo_solicitud || !['ALTA', 'TRASPASO', 'BAJA', 'REVISION', 'REPORTE_PROBLEMA', 'EQUIPO_PERDIDO', 'CONSULTA_GENERAL', 'NUEVO_EQUIPO', 'VIGENCIA_PROXIMA', 'EQUIPO_DESHABILITADO'].includes(selectedRequest.tipo_solicitud)) && (
                                                    selectedRequest.datos_json?.descripcion || selectedRequest.datos_json?.motivo || selectedRequest.datos_json?.comentario || selectedRequest.datos_json?.justificacion || 'Sin descripción disponible.'
                                                )}
                                            </div>

                                            {/* Technical Feedback Display */}
                                            {selectedRequest.feedback_tecnica && (
                                                <div style={{ marginTop: '1rem', padding: '1rem', background: '#F0FDF4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                        <strong style={{ fontSize: '0.7rem', color: '#166534', textTransform: 'uppercase' }}>RESOLUCIÓN TÉCNICA</strong>
                                                        {selectedRequest.fecha_tecnica && (
                                                            <span style={{ fontSize: '0.65rem', color: '#166534', opacity: 0.8 }}>
                                                                {new Date(selectedRequest.fecha_tecnica).toLocaleDateString()} {new Date(selectedRequest.fecha_tecnica).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p style={{ margin: '0 0 0.5rem 0', color: '#15803d', fontSize: '0.9rem' }}>{selectedRequest.feedback_tecnica}</p>
                                                    {selectedRequest.usuario_tecnica_nombre && (
                                                        <div style={{ fontSize: '0.7rem', color: '#166534', fontStyle: 'italic', borderTop: '1px solid #bbf7d060', paddingTop: '0.4rem' }}>
                                                            Revisado por: {selectedRequest.usuario_tecnica_nombre}
                                                            {selectedRequest.email_tecnica && (
                                                                <span style={{ display: 'block', fontSize: '0.65rem', opacity: 0.85 }}>{selectedRequest.email_tecnica}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Quality Feedback Display */}
                                            {(selectedRequest.feedback_admin || (selectedRequest.estado === 'APROBADO' && selectedRequest.usuario_aprueba_nombre)) && (
                                                <div style={{ marginTop: '0.75rem', padding: '1rem', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                        <strong style={{ fontSize: '0.7rem', color: '#475569', textTransform: 'uppercase' }}>RESOLUCIÓN FINAL / CALIDAD</strong>
                                                        {selectedRequest.fecha_final && (
                                                            <span style={{ fontSize: '0.65rem', color: '#475569', opacity: 0.8 }}>
                                                                {new Date(selectedRequest.fecha_final).toLocaleDateString()} {new Date(selectedRequest.fecha_final).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '0.9rem', fontWeight: 500 }}>
                                                        {selectedRequest.feedback_admin || (selectedRequest.estado === 'APROBADO' ? 'Solicitud aprobada correctamente.' : 'Sin comentarios adicionales.')}
                                                    </p>
                                                    {selectedRequest.usuario_aprueba_nombre && (
                                                        <div style={{ fontSize: '0.7rem', color: '#475569', fontStyle: 'italic', borderTop: '1px solid #e2e8f060', paddingTop: '0.4rem' }}>
                                                            Procesado por: {selectedRequest.usuario_aprueba_nombre}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Equipment Footer Info in Details Box */}
                                            {selectedRequest.tipo_solicitud !== 'VIGENCIA_PROXIMA' &&
                                                selectedRequest.tipo_solicitud !== 'EQUIPO_DESHABILITADO' &&
                                                (selectedRequest.datos_json?.equipo_nombre || selectedRequest.datos_json?.nombre || selectedRequest.datos_json?.id_equipo) && (
                                                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'start' }}>
                                                            <div>
                                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Equipo:</span>
                                                                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>
                                                                    {selectedRequest.datos_json.equipo_nombre || selectedRequest.datos_json.nombre || equipos.find(e => String(e.id_equipo) === String(selectedRequest.datos_json?.id_equipo))?.nombre || 'N/A'}
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Código:</span>
                                                                <div style={{ fontWeight: 700, color: '#0369a1', fontSize: '0.9rem' }}>
                                                                    {selectedRequest.datos_json.equipo_codigo || selectedRequest.datos_json.codigo || equipos.find(e => String(e.id_equipo) === String(selectedRequest.datos_json?.id_equipo))?.codigo || 'N/A'}
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Tipo:</span>
                                                                <div style={{ color: '#475569', fontSize: '0.85rem' }}>
                                                                    {selectedRequest.datos_json.equipo_tipo || selectedRequest.datos_json.tipo || equipos.find(e => String(e.id_equipo) === String(selectedRequest.datos_json?.id_equipo))?.tipo || 'N/A'}
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Ubicación:</span>
                                                                <div style={{ color: '#475569', fontSize: '0.85rem' }}>
                                                                    {selectedRequest.datos_json.ubicacion || selectedRequest.datos_json.ubicacion_actual || equipos.find(e => String(e.id_equipo) === String(selectedRequest.datos_json?.id_equipo))?.ubicacion || 'N/A'}
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Responsable:</span>
                                                                <div style={{ color: '#475569', fontSize: '0.85rem' }}>
                                                                    {muestreadores.find(m => String(m.id_muestreador) === String(selectedRequest.datos_json?.id_muestreador))?.nombre_muestreador ||
                                                                        muestreadores.find(m => String(m.id_muestreador) === String(selectedRequest.datos_json?.id_muestreador))?.nombre ||
                                                                        selectedRequest.datos_json.responsable || selectedRequest.datos_json.responsable_actual ||
                                                                        equipos.find(e => String(e.id_equipo) === String(selectedRequest.datos_json?.id_equipo))?.nombre_asignado || 'N/A'}
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Vigencia:</span>
                                                                <div style={{ color: '#059669', fontSize: '0.85rem', fontWeight: 700 }}>
                                                                    {formatDateValue(selectedRequest.datos_json.vigencia || equipos.find(e => String(e.id_equipo) === String(selectedRequest.datos_json?.id_equipo))?.vigencia)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                        </div>
                                    </div>

                                    {/* Confirmation Reply UI for Report/Revision */}
                                    {isReplying && (
                                        <div style={{ marginTop: '1.5rem' }}>
                                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>Respuesta a Solicitud</h4>
                                            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                                                <label style={{ display: 'block', color: '#64748b', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                                                    Mensaje de Respuesta / Instrucciones <span style={{ color: '#ef4444' }}>*</span>
                                                </label>
                                                <textarea
                                                    value={reviewFeedback}
                                                    onChange={(e) => setReviewFeedback(e.target.value)}
                                                    placeholder="Ingrese su respuesta para solicitar el equipo o dar instrucciones..."
                                                    style={{
                                                        width: '100%',
                                                        padding: '1rem',
                                                        borderRadius: '6px',
                                                        border: '1px solid #cbd5e1',
                                                        background: '#F8FAFC',
                                                        color: '#334155',
                                                        fontSize: '0.9rem',
                                                        lineHeight: '1.5',
                                                        minHeight: '120px',
                                                        resize: 'none',
                                                        outline: 'none'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Conclusion Feedback Input for CONSULTA_GENERAL - Inside modal-body */}
                                    {(selectedRequest.tipo_solicitud === 'CONSULTA_GENERAL' && selectedRequest.estado === 'EN_REVISION_TECNICA' && !viewOnly) && (
                                        <div style={{ marginTop: '1.5rem' }}>
                                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>Respuesta Técnica / Conclusión</h4>
                                            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                                                <label style={{ display: 'block', color: '#64748b', fontSize: '0.8rem', marginBottom: '0.5rem' }}>Respuesta / Conclusión <span style={{ color: '#ef4444' }}>*</span></label>
                                                <textarea
                                                    value={reviewFeedback}
                                                    onChange={(e) => setReviewFeedback(e.target.value)}
                                                    placeholder="Describa la resolución de la consulta..."
                                                    style={{
                                                        width: '100%',
                                                        padding: '1rem',
                                                        borderRadius: '6px',
                                                        border: 'none',
                                                        background: '#F8FAFC',
                                                        color: '#334155',
                                                        fontSize: '0.9rem',
                                                        lineHeight: '1.5',
                                                        minHeight: '120px',
                                                        resize: 'none',
                                                        outline: 'none'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {selectedRequest.tipo_solicitud === 'VIGENCIA_PROXIMA' && selectedRequest.estado === 'EN_REVISION_TECNICA' && !viewOnly && (
                                        <div style={{ marginTop: '1.5rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '1rem' }}>
                                            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e40af', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                                Propuesta Técnica de Nueva Vigencia
                                            </h4>
                                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                                <label style={{ display: 'block', color: '#1e40af', fontSize: '0.8rem', fontWeight: 600 }}>Nueva Fecha de Vencimiento <span style={{ color: '#ef4444' }}>*</span></label>
                                                <input
                                                    type="date"
                                                    min={new Date().toISOString().split('T')[0]}
                                                    value={editedData?.nueva_vigencia_solicitada ? new Date(editedData.nueva_vigencia_solicitada).toISOString().split('T')[0] : ''}
                                                    onChange={(e) => setEditedData({ ...editedData, nueva_vigencia_solicitada: e.target.value })}
                                                    style={{
                                                        width: '100%',
                                                        padding: '0.75rem',
                                                        borderRadius: '6px',
                                                        border: '1px solid #bfdbfe',
                                                        background: 'white',
                                                        color: '#1e293b',
                                                        fontSize: '1rem',
                                                        outline: 'none'
                                                    }}
                                                />
                                                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#1d4ed8', fontStyle: 'italic' }}>
                                                    Indique la fecha final de vigencia que Calidad deberá validar.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Feedback Input for EN_REVISION_TECNICA (Other types) */}
                                    {(selectedRequest.tipo_solicitud !== 'CONSULTA_GENERAL' && selectedRequest.estado === 'EN_REVISION_TECNICA' && !viewOnly) && (
                                        <div style={{ marginTop: '1.5rem' }}>
                                            {/* Action Tiles for Detail Modal (Consistency with Review Modal) */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                                                <div
                                                    onClick={() => setReviewAction('DERIVADO')}
                                                    style={{
                                                        cursor: 'pointer',
                                                        border: reviewAction === 'DERIVADO' ? '2px solid #22c55e' : '1px solid #e2e8f0',
                                                        borderRadius: '8px',
                                                        padding: '0.75rem 0.5rem',
                                                        background: reviewAction === 'DERIVADO' ? '#F0FDF4' : 'white',
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s', textAlign: 'center'
                                                    }}
                                                >
                                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: reviewAction === 'DERIVADO' ? '#22c55e' : '#f1f5f9', color: reviewAction === 'DERIVADO' ? 'white' : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                    </div>
                                                    <span style={{ fontWeight: 700, fontSize: '0.8rem', color: reviewAction === 'DERIVADO' ? '#15803d' : '#64748b' }}>
                                                        {selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' ? 'Derivar' : 'Aprobar y Derivar'}
                                                    </span>
                                                </div>

                                                {selectedRequest.tipo_solicitud !== 'EQUIPO_PERDIDO' && selectedRequest.tipo_solicitud !== 'VIGENCIA_PROXIMA' && (
                                                    <div
                                                        onClick={() => {
                                                            setReviewAction('CONCLUIDO');
                                                            setReviewFeedback('');
                                                        }}
                                                        style={{
                                                            cursor: 'pointer',
                                                            border: reviewAction === 'CONCLUIDO' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                                            borderRadius: '8px',
                                                            padding: '0.75rem 0.5rem',
                                                            background: reviewAction === 'CONCLUIDO' ? '#EFF6FF' : 'white',
                                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s', textAlign: 'center'
                                                        }}
                                                    >
                                                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: reviewAction === 'CONCLUIDO' ? '#3b82f6' : '#f1f5f9', color: reviewAction === 'CONCLUIDO' ? 'white' : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                                        </div>
                                                        <span style={{ fontWeight: 700, fontSize: '0.8rem', color: reviewAction === 'CONCLUIDO' ? '#1d4ed8' : '#64748b' }}>
                                                            {selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' ? 'Solucionado' : 'Aprobar y Concluir'}
                                                        </span>
                                                    </div>
                                                )}

                                                <div
                                                    onClick={() => {
                                                        setReviewAction('RECHAZADO');
                                                        setReviewFeedback('');
                                                    }}
                                                    style={{
                                                        cursor: 'pointer',
                                                        border: reviewAction === 'RECHAZADO' ? '2px solid #ef4444' : '1px solid #e2e8f0',
                                                        borderRadius: '8px',
                                                        padding: '0.75rem 0.5rem',
                                                        background: reviewAction === 'RECHAZADO' ? '#FEF2F2' : 'white',
                                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', transition: 'all 0.2s', textAlign: 'center'
                                                    }}
                                                >
                                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: reviewAction === 'RECHAZADO' ? '#ef4444' : '#f1f5f9', color: reviewAction === 'RECHAZADO' ? 'white' : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                    </div>
                                                    <span style={{ fontWeight: 700, fontSize: '0.8rem', color: reviewAction === 'RECHAZADO' ? '#b91c1c' : '#64748b' }}>
                                                        {selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' ? 'Rechazar' : 'Rechazar Solicitud'}
                                                    </span>
                                                </div>
                                            </div>

                                            {reviewAction && (
                                                <>
                                                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>Observaciones de la Revisión</h4>
                                                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                                                        <label style={{ display: 'block', color: '#64748b', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                                                            {selectedRequest.tipo_solicitud === 'EQUIPO_PERDIDO' ? 'Observación de la solicitud' :
                                                                (selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && reviewAction === 'RECHAZADO') ? 'Motivo de Rechazo' :
                                                                    (selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && reviewAction === 'DERIVADO') ? 'Detalle de la investigación / Lo que pasa' :
                                                                        (selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && reviewAction === 'CONCLUIDO') ? 'Explicación de la solución / Pasos extra' :
                                                                            'Comentarios de la Revisión'}
                                                            <span style={{ color: '#ef4444' }}> *</span>
                                                        </label>
                                                        {/* Optional Date Selection for EQUIPO_DESHABILITADO Derivation */}
                                                        {selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && reviewAction === 'DERIVADO' && (
                                                            <div style={{ marginTop: '1rem', background: '#eff6ff', padding: '1rem', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                                                                <label style={{ display: 'block', color: '#1e40af', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem' }}>Nueva Fecha de Validación <span style={{ color: '#ef4444' }}>*</span></label>
                                                                <input
                                                                    type="date"
                                                                    min={new Date().toISOString().split('T')[0]}
                                                                    value={editedData?.nueva_vigencia_solicitada ? new Date(editedData.nueva_vigencia_solicitada).toISOString().split('T')[0] : ''}
                                                                    onChange={(e) => setEditedData({ ...editedData, nueva_vigencia_solicitada: e.target.value })}
                                                                    style={{
                                                                        width: '100%',
                                                                        padding: '0.6rem',
                                                                        borderRadius: '6px',
                                                                        border: '1px solid #bfdbfe',
                                                                        fontSize: '0.9rem',
                                                                        outline: 'none'
                                                                    }}
                                                                />
                                                                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#1e40af', fontStyle: 'italic' }}>Especifique la fecha recomendada para la próxima revisión técnica.</p>
                                                            </div>
                                                        )}

                                                        <textarea
                                                            value={reviewFeedback}
                                                            onChange={(e) => setReviewFeedback(e.target.value)}
                                                            placeholder={selectedRequest.tipo_solicitud === 'EQUIPO_PERDIDO'
                                                                ? "Ingrese observaciones sobre la pérdida u otras instrucciones..."
                                                                : selectedRequest.tipo_solicitud === 'VIGENCIA_PROXIMA'
                                                                    ? "Detalle el sustento técnico para la nueva fecha de vigencia..."
                                                                    : selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && reviewAction === 'DERIVADO'
                                                                        ? "Detalle aquí los hallazgos de la investigación técnica and la situación actual..."
                                                                        : selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && reviewAction === 'CONCLUIDO'
                                                                            ? "Detalle la solución aplicada o los pasos adicionales requeridos para el usuario..."
                                                                            : "Ingrese observaciones técnicas adicionales o instrucciones para Calidad..."}
                                                            style={{
                                                                width: '100%',
                                                                padding: '1rem',
                                                                borderRadius: '6px',
                                                                border: 'none',
                                                                background: '#F8FAFC',
                                                                color: '#334155',
                                                                fontSize: '0.9rem',
                                                                lineHeight: '1.5',
                                                                minHeight: '120px',
                                                                resize: 'none',
                                                                outline: 'none',
                                                                marginTop: (selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && reviewAction === 'DERIVADO') ? '1rem' : '0'
                                                            }}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="modal-footer" style={{
                                    padding: '1rem 1.5rem',
                                    borderTop: '1px solid #e2e8f0',
                                    display: 'flex',
                                    justifyContent: (selectedRequest.tipo_solicitud === 'CONSULTA_GENERAL' && selectedRequest.estado === 'EN_REVISION_TECNICA' && !viewOnly) ? 'space-between' : 'flex-end',
                                    gap: '0.75rem',
                                    background: 'white'
                                }}>
                                    {/* Special Footer for CONSULTA_GENERAL Review */}
                                    {(selectedRequest.tipo_solicitud === 'CONSULTA_GENERAL' && selectedRequest.estado === 'EN_REVISION_TECNICA' && !viewOnly) ? (
                                        <>
                                            <button
                                                onClick={() => { setShowReviewModal(false); setSelectedRequest(null); }}
                                                style={{
                                                    marginRight: 'auto',
                                                    padding: '0.6rem 1.25rem',
                                                    borderRadius: '6px',
                                                    border: '1px solid #cbd5e1',
                                                    background: 'white',
                                                    color: '#334155',
                                                    fontWeight: 600,
                                                    fontSize: '0.9rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (!reviewFeedback.trim()) {
                                                        showToast({ type: 'error', message: 'Debe ingresar una respuesta o conclusión' });
                                                        return;
                                                    }
                                                    setShowConfirmConclude(true);
                                                }}
                                                disabled={loading || !reviewFeedback.trim()}
                                                style={{
                                                    padding: '0.6rem 1.25rem',
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    background: !reviewFeedback.trim() ? '#94a3b8' : '#16a34a',
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    fontSize: '0.9rem',
                                                    cursor: (loading || !reviewFeedback.trim()) ? 'not-allowed' : 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.5rem'
                                                }}
                                            >
                                                {loading ? 'Procesando...' : (
                                                    <>
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>
                                                        Concluido
                                                    </>
                                                )}
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            {/* Generic Close/Cancel Button */}
                                            <button
                                                onClick={() => { setShowReviewModal(false); setSelectedRequest(null); }}
                                                style={{
                                                    marginRight: 'auto',
                                                    padding: '0.6rem 1.25rem',
                                                    borderRadius: '6px',
                                                    border: '1px solid #cbd5e1',
                                                    background: 'white',
                                                    color: '#334155',
                                                    fontWeight: 600,
                                                    fontSize: '0.9rem',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {((viewOnly && !isGCMan) || (viewOnly && !['PENDIENTE_CALIDAD'].includes(selectedRequest.estado))) ? 'Cerrar' : ((isReplying) ? 'Cancelar' : 'Cancelar')}
                                            </button>

                                            {/* Reply Flow for Quality (Always allow if isGCMan/Admin) */}
                                            {((!viewOnly || isGCMan) &&
                                                selectedRequest.estado === 'PENDIENTE_CALIDAD' &&
                                                ['REPORTE_PROBLEMA', 'REVISION'].includes(selectedRequest.tipo_solicitud)) && (
                                                    <>
                                                        {!isReplying ? (
                                                            <button
                                                                onClick={() => {
                                                                    setIsReplying(true);
                                                                    setReviewFeedback('');
                                                                }}
                                                                style={{
                                                                    padding: '0.6rem 1.25rem',
                                                                    borderRadius: '6px',
                                                                    border: 'none',
                                                                    background: '#3b82f6',
                                                                    color: 'white',
                                                                    fontWeight: 600,
                                                                    fontSize: '0.9rem',
                                                                    cursor: 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.5rem'
                                                                }}
                                                            >
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                                                Responder
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={handleSendReply}
                                                                disabled={loading || !reviewFeedback.trim()}
                                                                style={{
                                                                    padding: '0.6rem 1.25rem',
                                                                    borderRadius: '6px',
                                                                    border: 'none',
                                                                    background: !reviewFeedback.trim() ? '#94a3b8' : '#16a34a',
                                                                    color: 'white',
                                                                    fontWeight: 600,
                                                                    fontSize: '0.9rem',
                                                                    cursor: (loading || !reviewFeedback.trim()) ? 'not-allowed' : 'pointer',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.5rem'
                                                                }}
                                                            >
                                                                {loading ? 'Enviando...' : 'Enviar Respuesta'}
                                                            </button>
                                                        )}
                                                    </>
                                                )}

                                            {/* Special Footer for EQUIPO_DESHABILITADO Review */}
                                            {(selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && selectedRequest.estado === 'EN_REVISION_TECNICA' && !viewOnly && reviewAction === 'CONCLUIDO') && (
                                                <button
                                                    onClick={() => {
                                                        if (!reviewFeedback.trim()) {
                                                            showToast({ type: 'error', message: 'Debe ingresar el detalle de la investigación o los pasos realizados para solucionar' });
                                                            return;
                                                        }
                                                        setShowConfirmConclude(true);
                                                    }}
                                                    disabled={loading || !reviewFeedback.trim()}
                                                    style={{
                                                        padding: '0.6rem 1.25rem',
                                                        borderRadius: '6px',
                                                        border: 'none',
                                                        background: !reviewFeedback.trim() ? '#94a3b8' : '#3b82f6',
                                                        color: 'white',
                                                        fontWeight: 700,
                                                        fontSize: '0.9rem',
                                                        cursor: (loading || !reviewFeedback.trim()) ? 'not-allowed' : 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem'
                                                    }}
                                                >
                                                    {loading ? 'Procesando...' : (
                                                        <>
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                                            Confirmar Solución
                                                        </>
                                                    )}
                                                </button>
                                            )}

                                            {/* Derivation Action Button */}
                                            {(selectedRequest.estado === 'EN_REVISION_TECNICA' && !viewOnly && (
                                                (selectedRequest.tipo_solicitud !== 'CONSULTA_GENERAL' && selectedRequest.tipo_solicitud !== 'EQUIPO_DESHABILITADO') ||
                                                (selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && reviewAction === 'DERIVADO')
                                            )) && (
                                                    <button
                                                        onClick={async () => {
                                                            setLoading(true);
                                                            try {
                                                                await adminService.reviewSolicitudTechnical(
                                                                    selectedRequest.id_solicitud,
                                                                    'DERIVADO',
                                                                    reviewFeedback || '',
                                                                    editedData
                                                                );
                                                                showToast({
                                                                    type: 'success',
                                                                    message: 'Solicitud derivada a Calidad correctamente',
                                                                    duration: 4000
                                                                });
                                                                setSelectedRequest(null);
                                                                setReviewFeedback('');
                                                                loadHistory();
                                                            } catch (error) {
                                                                console.error("Error finalizing derivation:", error);
                                                                showToast({ type: 'error', message: 'Error al derivar la solicitud' });
                                                            } finally {
                                                                setLoading(false);
                                                            }
                                                        }}
                                                        disabled={loading ||
                                                            (selectedRequest.tipo_solicitud === 'VIGENCIA_PROXIMA' && (!editedData?.nueva_vigencia_solicitada || !reviewFeedback.trim())) ||
                                                            (selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && (!editedData?.nueva_vigencia_solicitada || !reviewFeedback.trim())) ||
                                                            (selectedRequest.tipo_solicitud === 'EQUIPO_PERDIDO' && !reviewFeedback.trim()) ||
                                                            (!reviewFeedback.trim())
                                                        }
                                                        style={{
                                                            padding: '0.6rem 1.25rem',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            background: (loading ||
                                                                (selectedRequest.tipo_solicitud === 'VIGENCIA_PROXIMA' && (!editedData?.nueva_vigencia_solicitada || !reviewFeedback.trim())) ||
                                                                (selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && (!editedData?.nueva_vigencia_solicitada || !reviewFeedback.trim())) ||
                                                                (selectedRequest.tipo_solicitud === 'EQUIPO_PERDIDO' && !reviewFeedback.trim()) ||
                                                                (!reviewFeedback.trim())) ? '#94a3b8' : '#16a34a',
                                                            color: 'white',
                                                            fontWeight: 700,
                                                            fontSize: '0.9rem',
                                                            cursor: (loading ||
                                                                (selectedRequest.tipo_solicitud === 'VIGENCIA_PROXIMA' && (!editedData?.nueva_vigencia_solicitada || !reviewFeedback.trim())) ||
                                                                (selectedRequest.tipo_solicitud === 'EQUIPO_DESHABILITADO' && (!editedData?.nueva_vigencia_solicitada || !reviewFeedback.trim())) ||
                                                                (selectedRequest.tipo_solicitud === 'EQUIPO_PERDIDO' && !reviewFeedback.trim()) ||
                                                                (!reviewFeedback.trim())) ? 'not-allowed' : 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.5rem'
                                                        }}
                                                    >
                                                        {loading ? 'Procesando...' : (
                                                            <>
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                                Derivar a Calidad
                                                            </>
                                                        )}
                                                    </button>
                                                )}

                                            {/* Reject Action Button */}
                                            {(selectedRequest.estado === 'EN_REVISION_TECNICA' && !viewOnly && reviewAction === 'RECHAZADO') && (
                                                <button
                                                    onClick={async () => {
                                                        setLoading(true);
                                                        try {
                                                            await adminService.reviewSolicitudTechnical(
                                                                selectedRequest.id_solicitud,
                                                                'RECHAZADO',
                                                                reviewFeedback || '',
                                                                editedData
                                                            );
                                                            showToast({
                                                                type: 'success',
                                                                message: 'Solicitud rechazada correctamente',
                                                                duration: 4000
                                                            });
                                                            setSelectedRequest(null);
                                                            setReviewFeedback('');
                                                            loadHistory();
                                                        } catch (error) {
                                                            console.error("Error finalizing rejection:", error);
                                                            showToast({ type: 'error', message: 'Error al rechazar la solicitud' });
                                                        } finally {
                                                            setLoading(false);
                                                        }
                                                    }}
                                                    disabled={loading || !reviewFeedback.trim()}
                                                    style={{
                                                        padding: '0.6rem 1.25rem',
                                                        borderRadius: '6px',
                                                        border: 'none',
                                                        background: !reviewFeedback.trim() ? '#94a3b8' : '#ef4444',
                                                        color: 'white',
                                                        fontWeight: 700,
                                                        fontSize: '0.9rem',
                                                        cursor: (loading || !reviewFeedback.trim()) ? 'not-allowed' : 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem'
                                                    }}
                                                >
                                                    {loading ? 'Procesando...' : (
                                                        <>
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                            Confirmar Rechazo
                                                        </>
                                                    )}
                                                </button>
                                            )}

                                            {/* Standard Technical Review - Only if NOT viewOnly (and not caught by above logic) */}
                                            {!viewOnly && !['PENDIENTE_CALIDAD', 'EN_REVISION_TECNICA'].includes(selectedRequest.estado) && (
                                                <button
                                                    onClick={submitTechnicalReview}
                                                    disabled={
                                                        !reviewAction ||
                                                        (reviewAction === 'RECHAZADO' && !reviewFeedback.trim()) ||
                                                        (reviewAction === 'DERIVADO' && selectedRequest.tipo_solicitud === 'CONSULTA_GENERAL' && !reviewFeedback.trim()) ||
                                                        loading
                                                    }
                                                    style={{
                                                        padding: '0.6rem 1.25rem',
                                                        borderRadius: '6px',
                                                        border: 'none',
                                                        background: !reviewAction ? '#94a3b8' : '#64748b',
                                                        color: 'white',
                                                        fontWeight: 600,
                                                        fontSize: '0.9rem',
                                                        cursor: (!reviewAction || loading) ? 'not-allowed' : 'pointer',
                                                    }}
                                                >
                                                    {loading ? 'Procesando...' : 'Confirmar Revisión'}
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                }


                {
                    loading && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            background: 'rgba(255, 255, 255, 0.8)',
                            backdropFilter: 'blur(4px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 12000,
                            animation: 'fadeIn 0.3s ease'
                        }}>
                            <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                        @keyframes fadeIn {
                            from { opacity: 0; }
                            to { opacity: 1; }
                        }
                        @keyframes pulse {
                            0%, 100% { opacity: 1; transform: scale(1); }
                            50% { opacity: 0.7; transform: scale(0.98); }
                        }
                    `}</style>
                            <div style={{
                                width: '50px',
                                height: '50px',
                                border: '4px solid #f3f3f3',
                                borderTop: '4px solid #2563eb',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                                marginBottom: '1rem',
                                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.2)'
                            }}></div>
                            <div style={{
                                fontWeight: 700,
                                color: '#1e40af',
                                fontSize: '1.1rem',
                                letterSpacing: '0.05em',
                                animation: 'pulse 1.5s ease-in-out infinite'
                            }}>
                                PROCESANDO ACCIÓN...
                            </div>
                        </div>
                    )
                }

                {/* Custom Confirmation Popup for 'Concluido' */}
                {
                    showConfirmConclude && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            background: 'rgba(15, 23, 42, 0.4)',
                            backdropFilter: 'blur(4px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 20000,
                            animation: 'fadeIn 0.2s ease-out'
                        }}>
                            <div style={{
                                background: 'white',
                                padding: '2rem',
                                borderRadius: '16px',
                                width: '90%',
                                maxWidth: '400px',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                                textAlign: 'center'
                            }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    background: '#dcfce7',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    margin: '0 auto 1.25rem',
                                    color: '#16a34a'
                                }}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>
                                </div>

                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem' }}>
                                    ¿Confirmar Conclusión?
                                </h3>

                                <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '2rem' }}>
                                    ¿Confirmas que la consulta ha sido resuelta? El estado pasará a <strong>APROBADO</strong> y se notificará al solicitante.
                                </p>

                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button
                                        onClick={() => setShowConfirmConclude(false)}
                                        disabled={loading}
                                        style={{
                                            flex: 1,
                                            padding: '0.75rem',
                                            borderRadius: '8px',
                                            border: '1px solid #e2e8f0',
                                            background: 'white',
                                            color: '#475569',
                                            fontWeight: 600,
                                            fontSize: '0.95rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={async () => {
                                            setLoading(true);
                                            setShowConfirmConclude(false);
                                            try {
                                                await adminService.updateSolicitudStatus(
                                                    selectedRequest.id_solicitud,
                                                    'APROBADO',
                                                    reviewFeedback,
                                                    selectedRequest.datos_json
                                                );
                                                showToast({ type: 'success', message: 'Consulta concluida exitosamente' });
                                                setSelectedRequest(null);
                                                setReviewFeedback('');
                                                loadHistory();
                                            } catch (error) {
                                                console.error('Error concluding request:', error);
                                                showToast({ type: 'error', message: 'Error al concluir la consulta' });
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        disabled={loading}
                                        style={{
                                            flex: 2,
                                            padding: '0.75rem',
                                            borderRadius: '8px',
                                            border: 'none',
                                            background: '#1e293b',
                                            color: 'white',
                                            fontWeight: 600,
                                            fontSize: '0.95rem',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                        }}
                                    >
                                        Sí, Concluir
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >
        </div >
    );
};

export default SolicitudesMaPage;
