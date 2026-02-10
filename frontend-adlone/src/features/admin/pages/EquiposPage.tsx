import React, { useState, useEffect } from 'react';
import { equipoService, type Equipo } from '../services/equipo.service';
import { adminService } from '../../../services/admin.service';
import { EquipoForm } from '../components/EquipoForm';
import { useToast } from '../../../contexts/ToastContext';
import '../admin.css';

// --- Componente CustomSelect Animado ---
interface CustomSelectProps {
    value: string;
    options: string[];
    onChange: (val: string) => void;
    width?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, options, onChange, width = '140px' }) => {
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
            >
                <span>{value || 'Seleccionar'}</span>
                <svg className="select-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                        >
                            {opt}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

interface Props {
    onBack: () => void;
}

export const EquiposPage: React.FC<Props> = ({ onBack }) => {
    // View State
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
    const [selectedEquipo, setSelectedEquipo] = useState<Equipo | null>(null);
    const [showSolicitudes, setShowSolicitudes] = useState(false);
    const [solicitudesRealizadas, setSolicitudesRealizadas] = useState<any[]>([]);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [reviewSolicitud, setReviewSolicitud] = useState<any | null>(null);
    const [hiddenNotifications, setHiddenNotifications] = useState<number[]>([]);
    const [processingAction, setProcessingAction] = useState(false);
    const [adminFeedback, setAdminFeedback] = useState('');
    const [showConfirmBajaModal, setShowConfirmBajaModal] = useState(false);
    const [showConfirmAltaModal, setShowConfirmAltaModal] = useState(false); // For Reactivations
    const [equipoBajaPending, setEquipoBajaPending] = useState<{ id: string; nombre: string; datos_json?: any; id_solicitud?: number } | null>(null);
    const [equipoAltaPending, setEquipoAltaPending] = useState<{ id: string; nombre: string; codigo: string; originalId: number; datos_json?: any; id_solicitud?: number } | null>(null);
    const [reactivationVigencia, setReactivationVigencia] = useState<string>('');
    const [highlightedId, setHighlightedId] = useState<number | null>(null);
    const { showToast } = useToast();
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const filterMenuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (showConfirmAltaModal) {
            // Priority 1: Specific motive extraction (existing logic)
            if (equipoAltaPending?.datos_json?.motivo) {
                const motive = equipoAltaPending.datos_json.motivo;
                const code = (equipoAltaPending as any).codigo;

                if (code && motive) {
                    const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`${escapedCode}:\\s*(\\d{2}[/\\-]\\d{2}[/\\-]\\d{4}|\\d{4}[/\\-]\\d{2}[/\\-]\\d{2})`, 'i');
                    const match = motive.match(regex);

                    if (match && match[1]) {
                        let datePart = match[1].replace(/\//g, '-');
                        if (/^\d{2}-\d{2}-\d{4}$/.test(datePart)) {
                            const [d, m, y] = datePart.split('-');
                            datePart = `${y}-${m}-${d}`;
                        }
                        setReactivationVigencia(datePart);
                        return; // Found via motive, done.
                    }
                }
            }

            // Priority 2: Specific equipment 'vigencia' in the equipos_alta array (new multi-vigencia logic)
            if (equipoAltaPending?.id && equipoAltaPending?.datos_json?.equipos_alta) {
                const specificEq = equipoAltaPending.datos_json.equipos_alta.find((e: any) => String(e.id) === String(equipoAltaPending.id));
                if (specificEq?.vigencia) {
                    setReactivationVigencia(specificEq.vigencia);
                    return;
                }
            }

            // Priority 3: General 'vigencia' field in request JSON (fallback)
            if (equipoAltaPending?.datos_json?.vigencia) {
                setReactivationVigencia(equipoAltaPending.datos_json.vigencia);
            }

        } else {
            setReactivationVigencia('');
        }
    }, [showConfirmAltaModal, equipoAltaPending]);


    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showMobileFilters && filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
                setShowMobileFilters(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMobileFilters]);

    // Table State
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTipo, setFilterTipo] = useState('');
    const [filterSede, setFilterSede] = useState('');
    const [filterEstado, setFilterEstado] = useState('');
    const [page, setPage] = useState(1);
    const [limit] = useState(7);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [catalogs, setCatalogs] = useState<{ sedes: string[], tipos: string[], estados: string[] }>({
        sedes: ['PM', 'AY', 'VI', 'PA', 'PV', 'CH', 'Terreno'],
        tipos: ['Medidor de pH y Temperatura', 'Medidor de Oxígeno', 'Conductímetro', 'Turbidímetro', 'Multiparamétrico'],
        estados: ['Activo', 'Inactivo']
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = {
                page,
                limit,
                search: searchTerm,
                tipo: filterTipo,
                sede: filterSede,
                estado: filterEstado
            };
            const response = await equipoService.getEquipos(params);
            if (response) {
                setEquipos(response.data || []);
                setTotalPages(response.totalPages || 1);
                setTotalItems(response.total || 0);

                if ((response as any).catalogs) {
                    setCatalogs((response as any).catalogs);
                }
            } else {
                setEquipos([]);
            }
        } catch (error) {
            console.error('Error fetching equipos:', error);
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        fetchData();
    }, [page, filterTipo, filterSede, filterEstado]);


    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchData();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const handleCreate = () => {
        setSelectedEquipo(null);
        setViewMode('form');
    };

    const handleEdit = (equipo: Equipo) => {
        setSelectedEquipo(equipo);
        setViewMode('form');
    };

    const loadSolicitudes = async () => {
        try {
            // Fetch PENDING solicitudes for the admin to process
            const data = await adminService.getSolicitudes({ estado: 'PENDIENTE' });
            setSolicitudesRealizadas(data);
        } catch (error) {


            console.error("Error loading solicitudes:", error);
        }
    };

    useEffect(() => {
        loadSolicitudes();
    }, []);

    const handleFormSave = () => {
        setViewMode('list');
        fetchData();
        loadSolicitudes();
    };

    const handleNotificationClick = async (sol: any) => {
        setShowSolicitudes(false);
        setReviewSolicitud(sol);
        setAdminFeedback('');
    };

    const handleReject = async () => {
        if (!reviewSolicitud) return;

        if (!adminFeedback.trim()) {
            showToast({
                type: 'error',
                message: 'Debe ingresar un motivo para rechazar la solicitud',
                duration: 5000
            });
            return;
        }

        setProcessingAction(true);
        try {
            await adminService.updateSolicitudStatus(reviewSolicitud.id_solicitud, 'RECHAZADA', adminFeedback);
            showToast({ type: 'success', message: 'Solicitud rechazada correctamente', duration: 5000 });
            setReviewSolicitud(null);
            loadSolicitudes();
        } catch (error) {
            console.error("Error rejecting:", error);
            showToast({ type: 'error', message: 'Error al rechazar solicitud' });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleApprove = async () => {
        if (!reviewSolicitud) return;

        if (reviewSolicitud.tipo_solicitud === 'BAJA') {
            if (reviewSolicitud.datos_json?.id_equipo) {
                setEquipoBajaPending({
                    id: String(reviewSolicitud.datos_json.id_equipo),
                    nombre: reviewSolicitud.datos_json.nombre || reviewSolicitud.datos_json.codigo || 'Equipo',
                    datos_json: reviewSolicitud.datos_json,
                    id_solicitud: reviewSolicitud.id_solicitud
                });
                setShowConfirmBajaModal(true);
                setReviewSolicitud(null); // Close background modal
            }
        } else {
            const type = reviewSolicitud.tipo_solicitud;

            if (type === 'ALTA') {
                const isReactivation = reviewSolicitud.datos_json?.isReactivation;
                if (isReactivation) {
                    setEquipoAltaPending({
                        id: reviewSolicitud.datos_json.id_equipo_original,
                        nombre: reviewSolicitud.datos_json.nombre || 'Equipo',
                        codigo: reviewSolicitud.datos_json.codigo || '',
                        originalId: reviewSolicitud.datos_json.id_equipo_original,
                        datos_json: reviewSolicitud.datos_json,
                        id_solicitud: reviewSolicitud.id_solicitud
                    });
                    setShowConfirmAltaModal(true);
                    setReviewSolicitud(null); // Close background modal
                } else {
                    showToast({ type: 'info', message: 'Rellene los campos para continuar', duration: 5000 });
                    setReviewSolicitud(null);
                    setSelectedEquipo({
                        ...reviewSolicitud.datos_json,
                        id_equipo: undefined,
                        requestId: reviewSolicitud.id_solicitud
                    } as any);
                    setViewMode('form');
                }
            } else if (type === 'TRASPASO') {
                if (reviewSolicitud.datos_json?.id_equipo) {
                    showToast({ type: 'info', message: 'Rellene los campos para continuar', duration: 5000 });
                    const equipId = Number(reviewSolicitud.datos_json.id_equipo);
                    setReviewSolicitud(null);
                    setSelectedEquipo({
                        id_equipo: equipId,
                        requestId: reviewSolicitud.id_solicitud,
                        ubicacion: reviewSolicitud.datos_json.nueva_ubicacion,
                        id_muestreador: reviewSolicitud.datos_json.nuevo_responsable_id || 0,
                        vigencia: reviewSolicitud.datos_json.vigencia
                    } as any);
                    setViewMode('form');
                }
            }
        }
    };


    const confirmApproveAlta = async () => {
        if (!equipoAltaPending) return;
        if (!reactivationVigencia) {
            showToast({ type: 'warning', message: 'Debe seleccionar una fecha de vigencia' });
            return;
        }

        setProcessingAction(true);
        try {
            // 1. Fetch current data from DB to ensure no fields are lost
            const response = await equipoService.getEquipoById(equipoAltaPending.originalId);
            const currentEquipment = response.success ? response.data : (equipoAltaPending as any).datos_originales;

            await equipoService.updateEquipo(equipoAltaPending.originalId, {
                ...currentEquipment,
                estado: 'Activo',
                vigencia: reactivationVigencia
            });

            // 2. Handle partial or full approval
            const currentSolicitud = reviewSolicitud || { id_solicitud: equipoAltaPending.id_solicitud, datos_json: equipoAltaPending.datos_json };
            const equiposAlta = currentSolicitud.datos_json?.equipos_alta;

            if (equiposAlta) {
                const updatedEquiposAlta = equiposAlta.map((e: any) =>
                    String(e.id) === String(equipoAltaPending.id) ? { ...e, procesado: true } : e
                );
                const allProcessed = updatedEquiposAlta.every((e: any) => e.procesado);
                const updatedDatosJson = {
                    ...currentSolicitud.datos_json,
                    equipos_alta: updatedEquiposAlta
                };

                if (allProcessed) {
                    await adminService.updateSolicitudStatus(
                        equipoAltaPending.id_solicitud!,
                        'APROBADO',
                        adminFeedback || 'Reactivación completada',
                        updatedDatosJson
                    );
                    setReviewSolicitud(null);
                } else {
                    await adminService.updateSolicitudStatus(
                        equipoAltaPending.id_solicitud!,
                        'PENDIENTE',
                        'Reactivación parcial procesada',
                        updatedDatosJson
                    );
                    // Update local review modal state to show "REACTIVADO" immediately
                    const currentSolicitud = reviewSolicitud || { id_solicitud: equipoAltaPending.id_solicitud, datos_json: equipoAltaPending.datos_json };
                    setReviewSolicitud({ ...currentSolicitud, datos_json: updatedDatosJson });
                }
            } else {
                await adminService.updateSolicitudStatus(
                    equipoAltaPending.id_solicitud!,
                    'APROBADO',
                    adminFeedback || 'Equipo reactivado correctamente'
                );
            }

            showToast({ type: 'success', message: `Equipo ${equipoAltaPending.nombre} reactivado`, duration: 5000 });
            setAdminFeedback('');
            setEquipoAltaPending(null);
            setShowConfirmAltaModal(false);
            setReactivationVigencia('');
            fetchData();
            loadSolicitudes();
        } catch (error) {
            console.error("Error activating equipment:", error);
            showToast({ type: 'error', message: 'Error al reactivar el equipo' });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleApproveAllAlta = async () => {
        if (!reviewSolicitud) return;
        const pendingEquipos = (reviewSolicitud.datos_json?.equipos_alta || []).filter((e: any) => !e.procesado);
        if (pendingEquipos.length === 0) return;

        if (!reactivationVigencia) {
            // We reuse the confirm modal to get the date for all
            setEquipoAltaPending({
                id: 'all',
                nombre: 'TODOS LOS EQUIPOS PENDIENTES',
                codigo: 'Masivo',
                originalId: 0,
                datos_json: reviewSolicitud.datos_json,
                id_solicitud: reviewSolicitud.id_solicitud
            } as any);
            setShowConfirmAltaModal(true);
            return;
        }

        setProcessingAction(true);
        try {
            for (const eq of pendingEquipos) {
                // Fetch latest data for each equipment
                const resp = await equipoService.getEquipoById(Number(eq.id));
                const equipmentData = resp.success ? resp.data : (eq.datos_originales || eq);

                await equipoService.updateEquipo(Number(eq.id), {
                    ...equipmentData,
                    estado: 'Activo',
                    vigencia: reactivationVigencia
                });
            }

            const updatedEquiposAlta = (reviewSolicitud.datos_json?.equipos_alta || []).map((e: any) => ({ ...e, procesado: true }));
            const updatedDatosJson = {
                ...reviewSolicitud.datos_json,
                equipos_alta: updatedEquiposAlta
            };

            await adminService.updateSolicitudStatus(
                reviewSolicitud.id_solicitud,
                'APROBADO',
                adminFeedback || 'Todos los equipos han sido reactivados',
                updatedDatosJson
            );

            showToast({ type: 'success', message: `${pendingEquipos.length} equipos reactivados correctamente`, duration: 5000 });
            setReviewSolicitud(null);
            setShowConfirmAltaModal(false);
            setReactivationVigencia('');
            loadSolicitudes();
            fetchData();
        } catch (error) {
            console.error("Error in bulk reactivation:", error);
            showToast({ type: 'error', message: 'Error al procesar la reactivación masiva' });
        } finally {
            setProcessingAction(false);
        }
    };

    const confirmApproveBaja = async () => {
        if (!equipoBajaPending) return;
        setProcessingAction(true);
        try {
            await equipoService.deleteEquipo(Number(equipoBajaPending.id));
            const updatedEquiposBaja = (equipoBajaPending.datos_json?.equipos_baja || []).map((e: any) =>
                String(e.id) === String(equipoBajaPending.id) ? { ...e, procesado: true } : e
            );
            const allProcessed = updatedEquiposBaja.every((e: any) => e.procesado);
            const updatedDatosJson = {
                ...equipoBajaPending.datos_json,
                equipos_baja: updatedEquiposBaja
            };

            if (allProcessed) {
                await adminService.updateSolicitudStatus(
                    equipoBajaPending.id_solicitud!,
                    'APROBADO',
                    adminFeedback || 'Baja procesada correctamente',
                    updatedDatosJson
                );
                showToast({ type: 'success', message: 'Solicitud de baja completada' });
                setAdminFeedback('');
                setReviewSolicitud(null);
            } else {
                await adminService.updateSolicitudStatus(
                    equipoBajaPending.id_solicitud!,
                    'PENDIENTE',
                    'Baja parcial procesada',
                    updatedDatosJson
                );
                // Update local review modal state to show "PROCESADO" immediately
                setReviewSolicitud((prev: any) => prev ? { ...prev, datos_json: updatedDatosJson } : null);
                showToast({ type: 'success', message: `Equipo ${equipoBajaPending.nombre} eliminado` });
            }

            setEquipoBajaPending(null);
            setShowConfirmBajaModal(false);
            fetchData();
            loadSolicitudes();
        } catch (error) {
            console.error("Error approving deletion:", error);
            showToast({ type: 'error', message: 'Error al procesar la baja' });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleApproveAllBaja = async () => {
        if (!reviewSolicitud) return;
        const pendingEquipos = (reviewSolicitud.datos_json?.equipos_baja || []).filter((e: any) => !e.procesado);
        if (pendingEquipos.length === 0) return;
        setProcessingAction(true);
        try {
            for (const eq of pendingEquipos) {
                await equipoService.deleteEquipo(Number(eq.id));
            }
            const updatedEquiposBaja = (reviewSolicitud.datos_json?.equipos_baja || []).map((e: any) => ({ ...e, procesado: true }));
            const updatedDatosJson = {
                ...reviewSolicitud.datos_json,
                equipos_baja: updatedEquiposBaja
            };
            await adminService.updateSolicitudStatus(reviewSolicitud.id_solicitud, 'APROBADO', adminFeedback || 'Todos los equipos han sido dados de baja', updatedDatosJson);
            showToast({ type: 'success', message: `${pendingEquipos.length} equipos dados de baja correctamente`, duration: 5000 });
            setReviewSolicitud(null);
            loadSolicitudes();
            fetchData();
        } catch (error) {
            console.error("Error in bulk approval:", error);
            showToast({ type: 'error', message: 'Error al procesar la baja masiva' });
        } finally {
            setProcessingAction(false);
        }
    };


    const handleClearFilters = () => {
        setSearchTerm('');
        setFilterTipo('');
        setFilterSede('');
        setFilterEstado('');
        setPage(1);
    };

    const hasActiveFilters = searchTerm !== '' || filterTipo !== '' || filterSede !== '' || filterEstado !== '';

    if (viewMode === 'form') {
        return (
            <div className="admin-container animate-fade-in">
                <EquipoForm
                    initialData={selectedEquipo}
                    onCancel={() => setViewMode('list')}
                    onSave={handleFormSave}
                />
            </div>
        );
    }

    return (
        <div className="admin-container animate-fade-in">
            {/* Optimized Header */}
            <div className="admin-header-section responsive-header">
                <div style={{ justifySelf: 'start' }}>
                    <button onClick={onBack} className="btn-back" style={{ marginBottom: 0 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                        Volver
                    </button>
                </div>
                <div style={{ justifySelf: 'center' }}>
                    <h1 className="admin-title" style={{ margin: 0, fontSize: '1.5rem' }}>Gestión de Equipos</h1>
                </div>
                <div style={{ justifySelf: 'end' }}>
                    <div className="notification-container" style={{ position: 'relative' }} tabIndex={0} onBlur={() => setTimeout(() => setShowSolicitudes(false), 200)}>
                        <button
                            className="btn-secondary"
                            onClick={() => setShowSolicitudes(!showSolicitudes)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                            </svg>
                            Solicitudes
                            {solicitudesRealizadas.filter(s => {
                                const isPending = s.estado === 'PENDIENTE';
                                const isNotHidden = !hiddenNotifications.includes(s.id_solicitud);
                                const solDateStr = new Date(s.fecha_solicitud).toDateString();
                                const todayStr = new Date().toDateString();
                                return isPending && isNotHidden && solDateStr === todayStr;
                            }).length > 0 && (
                                    <span style={{
                                        background: '#ef4444',
                                        color: 'white',
                                        fontSize: '0.7rem',
                                        fontWeight: 'bold',
                                        minWidth: '18px',
                                        height: '18px',
                                        borderRadius: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '0 5px',
                                        marginLeft: '4px'
                                    }}>
                                        {solicitudesRealizadas.filter(s => {
                                            const isPending = s.estado === 'PENDIENTE';
                                            const isNotHidden = !hiddenNotifications.includes(s.id_solicitud);
                                            const solDateStr = new Date(s.fecha_solicitud).toDateString();
                                            const todayStr = new Date().toDateString();
                                            return isPending && isNotHidden && solDateStr === todayStr;
                                        }).length}
                                    </span>
                                )}
                        </button>

                        {showSolicitudes && (
                            <div className="notifications-dropdown" style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                width: '320px',
                                backgroundColor: 'white',
                                borderRadius: '12px',
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                                border: '1px solid #e5e7eb',
                                marginTop: '0.5rem',
                                zIndex: 1000,
                                overflow: 'hidden'
                            }}>
                                <div style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>
                                    Solicitudes Pendientes
                                </div>
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {solicitudesRealizadas.filter(s => {
                                        const isPending = s.estado === 'PENDIENTE';
                                        const isNotHidden = !hiddenNotifications.includes(s.id_solicitud);
                                        const solDateStr = new Date(s.fecha_solicitud).toDateString();
                                        const todayStr = new Date().toDateString();
                                        return isPending && isNotHidden && solDateStr === todayStr;
                                    }).length === 0 ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>
                                            No hay solicitudes pendientes hoy.
                                        </div>
                                    ) : (
                                        solicitudesRealizadas
                                            .filter(s => {
                                                const isPending = s.estado === 'PENDIENTE';
                                                const isNotHidden = !hiddenNotifications.includes(s.id_solicitud);
                                                const date = new Date(s.fecha_solicitud);
                                                const today = new Date();
                                                const isToday = date.getDate() === today.getDate() &&
                                                    date.getMonth() === today.getMonth() &&
                                                    date.getFullYear() === today.getFullYear();
                                                return isPending && isNotHidden && isToday;
                                            })
                                            .map((sol) => (
                                                <div
                                                    key={sol.id_solicitud}
                                                    style={{
                                                        padding: '1rem',
                                                        borderBottom: '1px solid #f9fafb',
                                                        cursor: 'pointer',
                                                        transition: 'background-color 0.2s',
                                                        position: 'relative'
                                                    }}
                                                    onClick={() => { handleNotificationClick(sol); setShowSolicitudes(false); }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                >
                                                    <div style={{ paddingRight: '1.5rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                                            <span style={{
                                                                fontSize: '0.6rem',
                                                                fontWeight: 'bold',
                                                                background: sol.tipo_solicitud === 'ALTA' ? '#dcfce7' : sol.tipo_solicitud === 'TRASPASO' ? '#dbeafe' : '#fee2e2',
                                                                color: sol.tipo_solicitud === 'ALTA' ? '#166534' : sol.tipo_solicitud === 'TRASPASO' ? '#1e40af' : '#991b1b',
                                                                padding: '1px 5px',
                                                                borderRadius: '3px'
                                                            }}>{sol.tipo_solicitud}</span>
                                                            <span style={{ fontWeight: 600, color: '#111827', fontSize: '0.85rem' }}>
                                                                {sol.tipo_solicitud === 'ALTA' ? (sol.datos_json?.nombre || 'Equipo') :
                                                                    sol.tipo_solicitud === 'BAJA' ? (sol.datos_json?.codigo || '') :
                                                                        (sol.datos_json?.codigo || '')}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                            {sol.nombre_solicitante} • {new Date(sol.fecha_solicitud).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setHiddenNotifications(prev => [...prev, sol.id_solicitud]);
                                                        }}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '1rem',
                                                            right: '0.5rem',
                                                            background: 'none',
                                                            border: 'none',
                                                            color: '#d1d5db',
                                                            cursor: 'pointer',
                                                            padding: '4px'
                                                        }}
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                    </button>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Filter Card: Responsive with Toggle Logic */}
            <div className={`filter-card ${showMobileFilters ? 'mobile-expanded' : ''}`}>
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
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                            onBlur={() => { if (!searchTerm) setIsSearchExpanded(false); }}
                            autoFocus={isSearchExpanded}
                        />
                    </div>

                    {/* Contenedor del Dropdown con Ref para cerrar al hacer clic fuera */}
                    <div className="filter-dropdown-wrapper" ref={filterMenuRef}>
                        {/* Botón de Filtros (Solo Móvil) */}
                        <button
                            className={`btn-filter-toggle ${showMobileFilters ? 'active' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                setShowMobileFilters(!showMobileFilters);
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="3" y1="12" x2="21" y2="12"></line>
                                <line x1="3" y1="6" x2="21" y2="6"></line>
                                <line x1="3" y1="18" x2="21" y2="18"></line>
                            </svg>
                            {showMobileFilters ? 'Cerrar' : 'Filtros'}
                        </button>

                        {/* Área Colapsable (Solo Filtros) */}
                        <div className="filter-collapsible-area">
                            <div className="filter-group-content">
                                <CustomSelect
                                    value={filterTipo || 'Tipo'}
                                    options={['Todos', ...catalogs.tipos]}
                                    onChange={(v) => { setFilterTipo(v === 'Todos' ? '' : v); setPage(1); }}
                                    width="200px"
                                />
                                <CustomSelect
                                    value={filterSede || 'Sede'}
                                    options={['Todos', ...catalogs.sedes]}
                                    onChange={(v) => { setFilterSede(v === 'Todos' ? '' : v); setPage(1); }}
                                    width="140px"
                                />
                                <CustomSelect
                                    value={filterEstado || 'Estado'}
                                    options={['Todos', ...catalogs.estados]}
                                    onChange={(v) => { setFilterEstado(v === 'Todos' ? '' : v); setPage(1); }}
                                    width="110px"
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
                </div>

                <button onClick={handleCreate} className="btn-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Nuevo Equipo
                </button>
            </div>

            {/* Table Area */}
            <div className="table-container" style={{ marginTop: '1.5rem' }}>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'center' }}>Código</th>
                            <th style={{ textAlign: 'center' }}>Nombre</th>
                            <th style={{ textAlign: 'center' }}>Tipo</th>
                            <th style={{ textAlign: 'center' }}>Ubicación</th>
                            <th style={{ textAlign: 'center' }}>Estado</th>
                            <th style={{ textAlign: 'center' }}>Vigencia</th>
                            <th style={{ textAlign: 'center' }}>Responsable</th>
                            <th style={{ textAlign: 'center', width: '140px', minWidth: '140px', paddingRight: '2rem' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="skeleton-row">
                                    <td colSpan={8}><div className="skeleton-line"></div></td>
                                </tr>
                            ))
                        ) : equipos.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="empty-state">No se encontraron equipos</td>
                            </tr>
                        ) : (
                            equipos.map((equipo) => (
                                <tr
                                    key={equipo.id_equipo}
                                    className={highlightedId === equipo.id_equipo ? 'row-highlighted' : ''}
                                    onClick={() => setHighlightedId(equipo.id_equipo)}
                                    style={{
                                        cursor: 'pointer',
                                        opacity: equipo.estado?.toLowerCase() === 'inactivo' ? 0.6 : 1,
                                        backgroundColor: highlightedId === equipo.id_equipo ? '#eef2ff' : (equipo.estado?.toLowerCase() === 'inactivo' ? '#f9fafb' : 'transparent'),
                                        borderLeft: highlightedId === equipo.id_equipo ? '4px solid #4f46e5' : 'none'
                                    }}
                                >
                                    <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}><span className="code-badge">{equipo.codigo}</span></td>
                                    <td style={{ fontWeight: 500, whiteSpace: 'nowrap', textAlign: 'center' }}>{equipo.nombre}</td>
                                    <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>{equipo.tipo}</td>
                                    <td style={{ textAlign: 'center' }}>{equipo.ubicacion}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span className={`status-pill ${equipo.estado?.toLowerCase() === 'activo' ? 'status-active' : 'status-inactive'}`}>
                                            {equipo.estado}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>{equipo.vigencia}</td>
                                    <td style={{ textAlign: 'center' }}>{equipo.nombre_asignado || '---'}</td>
                                    <td style={{ width: '100px', minWidth: '100px', paddingRight: '2rem' }}>
                                        <div className="action-buttons" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                                            <button className="btn-action-edit" onClick={() => handleEdit(equipo)}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination bar */}
            <div className="pagination-card">
                <div className="pagination-controls-wrapper">
                    <div className="pagination-buttons">
                        <button
                            className="btn-pagination"
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                        >
                            Anterior
                        </button>

                        <button
                            className="btn-pagination"
                            disabled={page === totalPages}
                            onClick={() => setPage(page + 1)}
                        >
                            Siguiente
                        </button>
                    </div>

                    <div className="pagination-summary">
                        {totalItems} equipos encontrados (Hoja {page} de {totalPages})
                    </div>
                </div>
            </div>

            {/* Modals area (Functional Core) */}
            {reviewSolicitud && (
                <div className="modal-overlay" style={{ zIndex: 10002 }}>
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Revisar Solicitud de {reviewSolicitud.tipo_solicitud}</h3>
                        </div>
                        <div className="modal-body">
                            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
                                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}><strong>Solicitante:</strong> {reviewSolicitud.nombre_solicitante}</p>
                                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}><strong>Fecha:</strong> {new Date(reviewSolicitud.fecha_solicitud).toLocaleString()}</p>
                                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '0.75rem 0' }} />
                                <div style={{ fontSize: '0.9rem', background: 'white', padding: '0.75rem', borderRadius: '4px', border: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {reviewSolicitud.tipo_solicitud === 'BAJA' && reviewSolicitud.datos_json?.equipos_baja ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <p style={{ margin: 0, fontWeight: 600, color: '#475569' }}>Equipos seleccionados ({reviewSolicitud.datos_json.equipos_baja.length}):</p>
                                                {reviewSolicitud.datos_json.equipos_baja.some((eq: any) => !eq.procesado) && (
                                                    <button onClick={handleApproveAllBaja} disabled={processingAction} className="btn-danger" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>DAR DE BAJA TODO</button>
                                                )}
                                            </div>
                                            {reviewSolicitud.datos_json.equipos_baja.map((eq: any) => (
                                                <div key={eq.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: eq.procesado ? '#f0fdf4' : '#f8fafc', borderRadius: '6px', border: eq.procesado ? '1px solid #bbf7d0' : '1px solid #e2e8f0', opacity: eq.procesado ? 0.7 : 1 }}>
                                                    <span style={{ fontWeight: 600, color: eq.procesado ? '#166534' : '#1e293b' }}>{eq.nombre}</span>
                                                    {!eq.procesado ? (
                                                        <button onClick={() => {
                                                            setEquipoBajaPending({
                                                                ...eq,
                                                                id_solicitud: reviewSolicitud.id_solicitud,
                                                                datos_json: reviewSolicitud.datos_json
                                                            });
                                                            setShowConfirmBajaModal(true);
                                                        }} className="btn-danger" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>BAJA</button>
                                                    ) : (
                                                        <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700 }}>PROCESADO</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (reviewSolicitud.tipo_solicitud === 'ALTA' && reviewSolicitud.datos_json?.isReactivation && reviewSolicitud.datos_json?.equipos_alta) ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                <p style={{ margin: 0, fontWeight: 600, color: '#475569' }}>Equipos para reactivación ({reviewSolicitud.datos_json.equipos_alta.length}):</p>
                                                {reviewSolicitud.datos_json.equipos_alta.some((eq: any) => !eq.procesado) && (
                                                    <button onClick={handleApproveAllAlta} disabled={processingAction} className="btn-success" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>REACTIVAR TODO</button>
                                                )}
                                            </div>
                                            {reviewSolicitud.datos_json.equipos_alta.map((eq: any) => (
                                                <div key={eq.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: eq.procesado ? '#f0fdf4' : '#f8fafc', borderRadius: '6px', border: eq.procesado ? '1px solid #bbf7d0' : '1px solid #e2e8f0', opacity: eq.procesado ? 0.7 : 1 }}>
                                                    <span style={{ fontWeight: 600, color: eq.procesado ? '#166534' : '#1e293b' }}>{eq.nombre}</span>
                                                    {!eq.procesado ? (
                                                        <button onClick={() => {
                                                            setEquipoAltaPending({
                                                                id: String(eq.id),
                                                                nombre: eq.nombre,
                                                                codigo: eq.datos_originales?.codigo || eq.codigo || '',
                                                                originalId: Number(eq.id),
                                                                datos_originales: eq.datos_originales,
                                                                datos_json: reviewSolicitud.datos_json,
                                                                id_solicitud: reviewSolicitud.id_solicitud
                                                            } as any);
                                                            setShowConfirmAltaModal(true);
                                                        }} className="btn-success" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>ACTIVAR</button>
                                                    ) : (
                                                        <span style={{ fontSize: '0.7rem', color: '#16a34a', fontWeight: 700 }}>REACTIVADO</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        Object.entries(reviewSolicitud.datos_json || {}).map(([key, val]) => {
                                            if (!val || key === 'equipos_baja' || key === 'equipos_alta' || key === 'isReactivation') return null;
                                            const labels: Record<string, string> = { codigo: 'Código', nombre: 'Nombre', tipo: 'Tipo', ubicacion: 'Ubicación Actual', nueva_ubicacion: 'Nueva Ubicación', responsable: 'Responsable', nuevo_responsable: 'Nuevo Responsable', motivo: 'Motivo', vigencia: 'Vigencia', id_equipo: 'ID Equipo' };
                                            return (
                                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: '#64748b', fontWeight: 500 }}>{labels[key] || key}:</span>
                                                    <span style={{ color: '#1e293b', fontWeight: 600 }}>{String(val)}</span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            <div className="form-group" style={{ padding: '0 1.5rem', marginBottom: '1rem' }}>
                                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Feedback / Observaciones Admin</span>
                                    <span style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>* Obligatorio para rechazar</span>
                                </label>
                                <textarea
                                    value={adminFeedback}
                                    onChange={(e) => setAdminFeedback(e.target.value)}
                                    placeholder="Ingrese motivo de rechazo o instrucciones..."
                                    className="form-input"
                                    style={{
                                        height: '80px',
                                        resize: 'vertical',
                                        borderColor: !adminFeedback.trim() ? '#fecaca' : '#e2e8f0'
                                    }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setReviewSolicitud(null)} disabled={processingAction}>Cerrar</button>
                            {reviewSolicitud.estado === 'PENDIENTE' && (
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button
                                        className="btn-danger"
                                        onClick={handleReject}
                                        disabled={processingAction || !adminFeedback.trim()}
                                        style={{
                                            minWidth: '100px',
                                            opacity: !adminFeedback.trim() ? 0.5 : 1,
                                            cursor: !adminFeedback.trim() ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        {processingAction ? '...' : 'Rechazar'}
                                    </button>
                                    {reviewSolicitud.tipo_solicitud !== 'BAJA' && !(reviewSolicitud.tipo_solicitud === 'ALTA' && reviewSolicitud.datos_json?.isReactivation && reviewSolicitud.datos_json?.equipos_alta) && (
                                        <button className="btn-success" onClick={handleApprove} disabled={processingAction} style={{ minWidth: '100px' }}>{processingAction ? '...' : 'Aprobar'}</button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showConfirmBajaModal && equipoBajaPending && (
                <div className="modal-overlay" style={{ zIndex: 10003 }}>
                    <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <div className="modal-body" style={{ padding: '2rem' }}>
                            <div style={{ width: '60px', height: '60px', backgroundColor: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: '#ef4444' }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                            </div>
                            <h3 style={{ marginBottom: '1rem', color: '#111827', fontSize: '1.25rem' }}>¿Confirmar Baja?</h3>
                            <p style={{ color: '#6b7280', fontSize: '0.95rem' }}>Eliminar permanentemente: <strong>{equipoBajaPending.nombre}</strong></p>
                        </div>
                        <div className="modal-footer" style={{ border: 'none', gap: '0.75rem' }}>
                            <button className="btn-cancel" onClick={() => setShowConfirmBajaModal(false)} disabled={processingAction} style={{ flex: 1 }}>Cancelar</button>
                            <button className="btn-danger" onClick={confirmApproveBaja} disabled={processingAction} style={{ flex: 1 }}>{processingAction ? '...' : 'Confirmar'}</button>
                        </div>
                    </div>
                </div>
            )}

            {showConfirmAltaModal && equipoAltaPending && (
                <div className="modal-overlay" style={{ zIndex: 10003 }}>
                    <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <div className="modal-body" style={{ padding: '2rem' }}>
                            <div style={{ width: '60px', height: '60px', backgroundColor: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: '#16a34a' }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            </div>
                            <h3 style={{ marginBottom: '1rem', color: '#111827', fontSize: '1.25rem' }}>¿Confirmar Alta?</h3>
                            <p style={{ color: '#6b7280', fontSize: '0.95rem', marginBottom: '1.5rem' }}>Activar nuevamente el equipo: <strong>{equipoAltaPending.nombre}</strong></p>

                            <div style={{ textAlign: 'left', background: '#f9fafb', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                                    {(equipoAltaPending as any).codigo || equipoAltaPending.nombre}: Fecha de Vigencia <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <input
                                    type="date"
                                    value={reactivationVigencia}
                                    onChange={(e) => setReactivationVigencia(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.625rem',
                                        borderRadius: '0.375rem',
                                        border: '1px solid #d1d5db',
                                        fontSize: '0.875rem'
                                    }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer" style={{ border: 'none', gap: '0.75rem' }}>
                            <button
                                className="btn-cancel"
                                onClick={() => {
                                    setShowConfirmAltaModal(false);
                                    setReactivationVigencia('');
                                }}
                                disabled={processingAction}
                                style={{ flex: 1 }}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn-success"
                                onClick={equipoAltaPending.id === 'all' ? handleApproveAllAlta : confirmApproveAlta}
                                disabled={processingAction || !reactivationVigencia}
                                style={{
                                    flex: 1,
                                    opacity: (!reactivationVigencia || processingAction) ? 0.6 : 1,
                                    cursor: (!reactivationVigencia || processingAction) ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {processingAction ? '...' : 'Reactivar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
