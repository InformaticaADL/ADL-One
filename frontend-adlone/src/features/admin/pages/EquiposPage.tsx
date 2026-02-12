import React, { useState, useEffect } from 'react';
import { equipoService, type Equipo } from '../services/equipo.service';
import { adminService } from '../../../services/admin.service';
import { EquipoForm } from '../components/EquipoForm';
import { useToast } from '../../../contexts/ToastContext';

import { useNavStore } from '../../../store/navStore';
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
    const [solicitudesRealizadas, setSolicitudesRealizadas] = useState<any[]>([]);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [reviewSolicitud, setReviewSolicitud] = useState<any | null>(null);
    const [processingAction, setProcessingAction] = useState(false);
    const [showConfirmBajaModal, setShowConfirmBajaModal] = useState(false);
    const [showConfirmAltaModal, setShowConfirmAltaModal] = useState(false); // For Reactivations
    const [equipoBajaPending, setEquipoBajaPending] = useState<{ id: string; nombre: string; datos_json?: any; id_solicitud?: number } | null>(null);
    const [equipoAltaPending, setEquipoAltaPending] = useState<{ id: string; nombre: string; codigo: string; originalId: number; datos_json?: any; id_solicitud?: number; vigencia_propuesta?: string } | null>(null);
    const [reactivationVigencia, setReactivationVigencia] = useState<string>('');
    const [highlightedId, setHighlightedId] = useState<number | null>(null);
    const [showPendingList, setShowPendingList] = useState(false);
    const [rejectionTarget, setRejectionTarget] = useState<{ type: 'SOLICITUD' | 'ITEM'; equipo?: any; bulkType?: 'ALTA' | 'BAJA' } | null>(null);
    const [showRejectionReasonModal, setShowRejectionReasonModal] = useState(false);
    const [localRejectionFeedback, setLocalRejectionFeedback] = useState('');

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

    const handleNotificationClick = async (sol: any) => {
        const type = sol.tipo_solicitud;
        const isAltaCreation = type === 'ALTA' && !sol.datos_json?.isReactivation;

        if (isAltaCreation) {
            // Direct to form
            setSelectedEquipo({
                ...sol.datos_json,
                id_equipo: undefined,
                requestId: sol.id_solicitud
            } as any);
            setViewMode('form');
        } else {
            // Show review modal as usual
            setReviewSolicitud(sol);
        }
    };

    // Notification link logic
    const { pendingRequestId, setPendingRequestId, hideNotification } = useNavStore();
    useEffect(() => {
        if (pendingRequestId && solicitudesRealizadas.length > 0) {
            const sol = solicitudesRealizadas.find(s => s.id_solicitud === pendingRequestId);
            if (sol) {
                handleNotificationClick(sol);
                setPendingRequestId(null); // Clear once handled
            }
        }
    }, [pendingRequestId, solicitudesRealizadas]);

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
        const pending = solicitudesRealizadas.find(sol => {
            if (sol.estado !== 'PENDIENTE') return false;
            const datos = sol.datos_json || {};
            if (sol.tipo_solicitud === 'TRASPASO' && String(datos.id_equipo) === String(equipo.id_equipo)) return true;
            if (sol.tipo_solicitud === 'BAJA' && datos.equipos_baja && Array.isArray(datos.equipos_baja)) {
                return datos.equipos_baja.some((eb: any) => String(eb.id) === String(equipo.id_equipo));
            }
            if (sol.tipo_solicitud === 'ALTA' && datos.isReactivation && datos.equipos_alta && Array.isArray(datos.equipos_alta)) {
                return datos.equipos_alta.some((ea: any) => String(ea.id) === String(equipo.id_equipo));
            }
            return false;
        });

        if (pending) {
            showToast({
                type: 'warning',
                message: `Atención: Este equipo tiene una solicitud de ${pending.tipo_solicitud} PENDIENTE: ${pending.datos_json?.motivo || 'Sin motivo especificado'}`,
                duration: 8000
            });
        }
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

    const getPendingRequestsForEquipo = (equipoId: number) => {
        if (!solicitudesRealizadas || solicitudesRealizadas.length === 0) return [];

        return solicitudesRealizadas.filter(sol => {
            if (sol.estado !== 'PENDIENTE') return false;

            const datos = sol.datos_json || {};

            // TRASPASO: uses id_equipo
            if (sol.tipo_solicitud === 'TRASPASO' && String(datos.id_equipo) === String(equipoId)) {
                return true;
            }

            // BAJA: uses equipos_baja list
            if (sol.tipo_solicitud === 'BAJA' && datos.equipos_baja && Array.isArray(datos.equipos_baja)) {
                return datos.equipos_baja.some((eb: any) => String(eb.id) === String(equipoId));
            }

            // ALTA (Reactivation): uses equipos_alta list
            if (sol.tipo_solicitud === 'ALTA' && datos.isReactivation && datos.equipos_alta && Array.isArray(datos.equipos_alta)) {
                return datos.equipos_alta.some((ea: any) => String(ea.id) === String(equipoId));
            }

            return false;
        });
    };

    const handleFormSave = () => {
        setViewMode('list');
        fetchData();
        loadSolicitudes();
    };


    const handleOpenGlobalRejection = () => {
        if (!reviewSolicitud) return;
        setRejectionTarget({ type: 'SOLICITUD' });
        setLocalRejectionFeedback('');
        setShowRejectionReasonModal(true);
    };

    const handleReject = async (feedback: string) => {
        if (!reviewSolicitud) return;

        setProcessingAction(true);
        try {
            await adminService.updateSolicitudStatus(reviewSolicitud.id_solicitud, 'RECHAZADA', feedback);
            showToast({ type: 'success', message: 'Solicitud rechazada correctamente', duration: 5000 });
            hideNotification(`${reviewSolicitud.id_solicitud}-PENDIENTE`);
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
                        id_solicitud: reviewSolicitud.id_solicitud,
                        vigencia_propuesta: reviewSolicitud.datos_json.vigencia
                    });
                    if (reviewSolicitud.datos_json.vigencia) {
                        setReactivationVigencia(reviewSolicitud.datos_json.vigencia);
                    }
                    setShowConfirmAltaModal(true);
                    hideNotification(`${reviewSolicitud.id_solicitud}-PENDIENTE`);
                    setReviewSolicitud(null);
                    // Close background modal
                } else {
                    showToast({ type: 'info', message: 'Rellene los campos para continuar', duration: 5000 });
                    hideNotification(`${reviewSolicitud.id_solicitud}-PENDIENTE`);
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
                        'Reactivación completada',
                        updatedDatosJson,
                        equipoAltaPending.id,
                        'APROBADO'
                    );
                    hideNotification(`${equipoAltaPending.id_solicitud}-PENDIENTE`);
                    setReviewSolicitud(null);
                } else {
                    await adminService.updateSolicitudStatus(
                        equipoAltaPending.id_solicitud!,
                        'PENDIENTE',
                        'Reactivación parcial procesada',
                        updatedDatosJson,
                        equipoAltaPending.id,
                        'APROBADO'
                    );
                    // Update local review modal state to show "REACTIVADO" immediately
                    const currentSolicitud = reviewSolicitud || { id_solicitud: equipoAltaPending.id_solicitud, datos_json: equipoAltaPending.datos_json };
                    setReviewSolicitud({ ...currentSolicitud, datos_json: updatedDatosJson });
                }
            } else {
                await adminService.updateSolicitudStatus(
                    equipoAltaPending.id_solicitud!,
                    'APROBADO',
                    'Equipo reactivado correctamente',
                    undefined,
                    equipoAltaPending.id,
                    'APROBADO'
                );
                hideNotification(`${equipoAltaPending.id_solicitud}-PENDIENTE`);
            }

            showToast({ type: 'success', message: `Equipo ${equipoAltaPending.nombre} reactivado`, duration: 5000 });
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
                'Todos los equipos han sido reactivados',
                updatedDatosJson
            );
            hideNotification(`${reviewSolicitud.id_solicitud}-PENDIENTE`);

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
                    'Baja procesada correctamente',
                    updatedDatosJson,
                    equipoBajaPending.id,
                    'APROBADO'
                );
                showToast({ type: 'success', message: 'Solicitud de baja completada' });
                setReviewSolicitud(null);
                hideNotification(`${equipoBajaPending.id_solicitud}-PENDIENTE`);
            } else {
                await adminService.updateSolicitudStatus(
                    equipoBajaPending.id_solicitud!,
                    'PENDIENTE',
                    'Baja parcial procesada',
                    updatedDatosJson,
                    equipoBajaPending.id,
                    'APROBADO'
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
            await adminService.updateSolicitudStatus(reviewSolicitud.id_solicitud, 'APROBADO', 'Todos los equipos han sido dados de baja', updatedDatosJson);
            hideNotification(`${reviewSolicitud.id_solicitud}-PENDIENTE`);
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


    const handleOpenIndividualRejection = (equipo: any, type: 'ALTA' | 'BAJA') => {
        setRejectionTarget({ type: 'ITEM', equipo, bulkType: type });
        setLocalRejectionFeedback('');
        setShowRejectionReasonModal(true);
    };

    const handleRejectIndividualItem = async (equipo: any, type: 'ALTA' | 'BAJA', feedback: string) => {
        if (!reviewSolicitud) return;

        setProcessingAction(true);
        try {
            const currentSolicitud = reviewSolicitud;
            const field = type === 'ALTA' ? 'equipos_alta' : 'equipos_baja';
            const list = currentSolicitud.datos_json?.[field] || [];

            const updatedList = list.map((e: any) =>
                String(e.id) === String(equipo.id) ? { ...e, procesado: true, rechazado: true } : e
            );

            const updatedDatosJson = {
                ...currentSolicitud.datos_json,
                [field]: updatedList
            };

            const allProcessed = updatedList.every((e: any) => e.procesado);
            const anyApproved = updatedList.some((e: any) => e.procesado && !e.rechazado);

            if (allProcessed) {
                const finalStatus = anyApproved ? 'APROBADO' : 'RECHAZADO';
                await adminService.updateSolicitudStatus(
                    currentSolicitud.id_solicitud,
                    finalStatus,
                    feedback,
                    updatedDatosJson,
                    equipo.id,
                    'RECHAZADO'
                );
                hideNotification(`${currentSolicitud.id_solicitud}-PENDIENTE`);
                setReviewSolicitud(null);
            } else {
                await adminService.updateSolicitudStatus(
                    currentSolicitud.id_solicitud,
                    'PENDIENTE',
                    feedback || 'Rechazo parcial procesado',
                    updatedDatosJson,
                    equipo.id,
                    'RECHAZADO'
                );
                setReviewSolicitud({ ...currentSolicitud, datos_json: updatedDatosJson });
            }

            showToast({ type: 'success', message: `Equipo ${equipo.nombre} rechazado` });
            loadSolicitudes();
        } catch (error) {
            console.error("Error individual rejection:", error);
            showToast({ type: 'error', message: 'Error al rechazar el equipo' });
        } finally {
            setProcessingAction(false);
        }
    };

    const confirmRejectWithFeedback = async () => {
        if (!reviewSolicitud || !rejectionTarget || !localRejectionFeedback.trim()) {
            showToast({ type: 'warning', message: 'Debe ingresar un motivo para rechazar' });
            return;
        }

        const feedback = localRejectionFeedback;
        setShowRejectionReasonModal(false);

        if (rejectionTarget.type === 'ITEM') {
            await handleRejectIndividualItem(rejectionTarget.equipo, rejectionTarget.bulkType!, feedback);
        } else {
            await handleReject(feedback);
        }
        setRejectionTarget(null);
        setLocalRejectionFeedback('');
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
                    pendingRequests={selectedEquipo ? getPendingRequestsForEquipo(selectedEquipo.id_equipo) : []}
                    onRefreshSolicitudes={loadSolicitudes}
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
                    <div style={{ position: 'relative' }}>
                        <button
                            className={`btn-pending-requests ${showPendingList ? 'active' : ''}`}
                            onClick={() => setShowPendingList(!showPendingList)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                background: showPendingList ? '#f1f5f9' : 'white',
                                color: '#475569',
                                fontSize: '0.9rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                            </svg>
                            Solicitudes
                            {solicitudesRealizadas.length > 0 && (
                                <span style={{
                                    background: '#ef4444',
                                    color: 'white',
                                    fontSize: '0.7rem',
                                    padding: '1px 5px',
                                    borderRadius: '10px',
                                    minWidth: '18px',
                                    textAlign: 'center'
                                }}>
                                    {solicitudesRealizadas.length}
                                </span>
                            )}
                        </button>

                        {showPendingList && (
                            <div className="pending-dropdown animate-fade-in" style={{
                                position: 'absolute',
                                top: 'calc(100% + 8px)',
                                right: 0,
                                width: '320px',
                                background: 'white',
                                borderRadius: '12px',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                border: '1px solid #e2e8f0',
                                zIndex: 1000,
                                overflow: 'hidden'
                            }}>
                                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>
                                    Lista de Pendientes
                                </div>
                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    {solicitudesRealizadas.length === 0 ? (
                                        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                                            No hay solicitudes pendientes
                                        </div>
                                    ) : (
                                        solicitudesRealizadas.map((sol) => (
                                            <div
                                                key={sol.id_solicitud}
                                                className="pending-item"
                                                style={{
                                                    padding: '0.75rem 1rem',
                                                    borderBottom: '1px solid #f8fafc',
                                                    cursor: 'pointer',
                                                    transition: 'background-color 0.2s'
                                                }}
                                                onClick={() => {
                                                    handleNotificationClick(sol);
                                                    setShowPendingList(false);
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                    <span style={{
                                                        fontSize: '0.65rem',
                                                        fontWeight: 'bold',
                                                        padding: '1px 5px',
                                                        borderRadius: '4px',
                                                        background: sol.tipo_solicitud === 'ALTA' ? '#dcfce7' : sol.tipo_solicitud === 'TRASPASO' ? '#dbeafe' : '#fee2e2',
                                                        color: sol.tipo_solicitud === 'ALTA' ? '#166534' : sol.tipo_solicitud === 'TRASPASO' ? '#1e40af' : '#991b1b'
                                                    }}>
                                                        {sol.tipo_solicitud}
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                                        {new Date(sol.fecha_solicitud).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div style={{ fontWeight: 600, fontSize: '0.8rem', color: '#334155' }}>
                                                    {sol.tipo_solicitud === 'ALTA' ? (sol.datos_json?.nombre || 'Equipo') :
                                                        sol.tipo_solicitud === 'BAJA' ? (sol.datos_json?.codigo || 'Baja') :
                                                            (sol.datos_json?.codigo || 'Traspaso')}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                    Solicitado por: {sol.nombre_solicitante || 'Usuario'}
                                                </div>
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
                            equipos.map((equipo) => {
                                const isInactive = equipo.estado?.toLowerCase() === 'inactivo';
                                const hasPending = getPendingRequestsForEquipo(equipo.id_equipo).length > 0;
                                const isSelected = highlightedId === equipo.id_equipo;

                                // Helper for expiration check
                                const checkIsExpiring = (vigenciaStr?: string) => {
                                    if (!vigenciaStr) return false;
                                    const d = new Date(vigenciaStr);
                                    if (isNaN(d.getTime())) return false;
                                    const today = new Date();
                                    const diffTime = d.getTime() - today.getTime();
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    return diffDays <= 30;
                                };

                                const isExpiring = checkIsExpiring(equipo.vigencia);

                                return (
                                    <tr
                                        key={equipo.id_equipo}
                                        className={isSelected ? 'row-highlighted' : ''}
                                        onClick={() => {
                                            setHighlightedId(equipo.id_equipo);
                                            const pendingList = getPendingRequestsForEquipo(equipo.id_equipo);
                                            if (pendingList.length > 0) {
                                                const pending = pendingList[0];
                                                showToast({
                                                    type: 'warning',
                                                    message: `Solicitud de ${pending.tipo_solicitud} Pendiente: ${pending.datos_json?.motivo || 'Sin motivo especificado'}`,
                                                    duration: 8000
                                                });
                                            }
                                        }}
                                        style={{
                                            cursor: 'pointer',
                                            opacity: isInactive ? 0.8 : 1,
                                            backgroundColor: isSelected
                                                ? (isInactive ? '#fef2f2' : (hasPending ? '#fff7ed' : '#eef2ff'))
                                                : (isInactive ? '#f9fafb' : 'transparent'),
                                            borderLeft: isSelected
                                                ? (isInactive ? '4px solid #ef4444' : (hasPending ? '4px solid #f97316' : '4px solid #4f46e5'))
                                                : 'none',
                                            // Orange line for expiring (inset shadow to coexist with border)
                                            boxShadow: isExpiring ? 'inset 4px 0 0 0 #f97316' : 'none',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}><span className="code-badge">{equipo.codigo}</span></td>
                                        <td style={{ fontWeight: 500, whiteSpace: 'nowrap', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                {equipo.nombre}
                                                {getPendingRequestsForEquipo(equipo.id_equipo).length > 0 && (
                                                    <span title="Solicitud Pendiente" style={{ cursor: 'help' }}>⚠️</span>
                                                )}
                                            </div>
                                        </td>
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
                                );
                            })
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
                            <h3 className="modal-title">
                                {reviewSolicitud.tipo_solicitud === 'ALTA' && !reviewSolicitud.datos_json?.isReactivation
                                    ? 'Revisar Solicitud de Creación de Equipo'
                                    : `Revisar Solicitud de ${reviewSolicitud.tipo_solicitud === 'ALTA' ? 'Activación' : (reviewSolicitud.tipo_solicitud === 'TRASPASO' ? 'Traspaso' : 'Baja')}`
                                }
                            </h3>
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
                                                <div key={eq.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: eq.procesado ? (eq.rechazado ? '#fef2f2' : '#f0fdf4') : '#f8fafc', borderRadius: '6px', border: eq.procesado ? (eq.rechazado ? '1px solid #fecaca' : '1px solid #bbf7d0') : '1px solid #e2e8f0', opacity: eq.procesado ? 0.7 : 1 }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{
                                                            fontWeight: 600,
                                                            color: eq.procesado ? (eq.rechazado ? '#991b1b' : '#166534') : '#1e293b',
                                                            textDecoration: eq.procesado ? 'line-through' : 'none'
                                                        }}>
                                                            {eq.nombre}
                                                        </span>
                                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{eq.codigo}</span>
                                                    </div>
                                                    {!eq.procesado ? (
                                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                            <button
                                                                onClick={() => {
                                                                    setEquipoBajaPending({
                                                                        ...eq,
                                                                        id_solicitud: reviewSolicitud.id_solicitud,
                                                                        datos_json: reviewSolicitud.datos_json
                                                                    });
                                                                    setShowConfirmBajaModal(true);
                                                                }}
                                                                className="btn-danger"
                                                                style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#dc2626' }}
                                                            >
                                                                BAJA
                                                            </button>
                                                            <button
                                                                onClick={() => handleOpenIndividualRejection(eq, 'BAJA')}
                                                                className="btn-secondary"
                                                                style={{ fontSize: '0.7rem', padding: '2px 8px', color: '#dc2626', borderColor: '#fecaca' }}
                                                            >
                                                                RECHAZAR
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: '0.7rem', color: eq.rechazado ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                                                            {eq.rechazado ? 'RECHAZADO' : 'PROCESADO'}
                                                        </span>
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
                                                <div key={eq.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: eq.procesado ? (eq.rechazado ? '#fef2f2' : '#f0fdf4') : '#f8fafc', borderRadius: '6px', border: eq.procesado ? (eq.rechazado ? '1px solid #fecaca' : '1px solid #bbf7d0') : '1px solid #e2e8f0', opacity: eq.procesado ? 0.7 : 1 }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{
                                                            fontWeight: 600,
                                                            color: eq.procesado ? (eq.rechazado ? '#991b1b' : '#166534') : '#1e293b',
                                                            textDecoration: eq.procesado ? 'line-through' : 'none'
                                                        }}>
                                                            {eq.nombre}
                                                        </span>
                                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{eq.datos_originales?.codigo || eq.codigo}</span>
                                                        {eq.vigencia && (
                                                            <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, marginTop: '2px' }}>
                                                                📅 Vigencia Propuesta: {eq.vigencia}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {!eq.procesado ? (
                                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                            <button
                                                                onClick={() => {
                                                                    setEquipoAltaPending({
                                                                        id: String(eq.id),
                                                                        nombre: eq.nombre,
                                                                        codigo: eq.datos_originales?.codigo || eq.codigo || '',
                                                                        originalId: Number(eq.id),
                                                                        datos_originales: eq.datos_originales,
                                                                        datos_json: reviewSolicitud.datos_json,
                                                                        id_solicitud: reviewSolicitud.id_solicitud,
                                                                        vigencia_propuesta: eq.vigencia
                                                                    } as any);
                                                                    if (eq.vigencia) setReactivationVigencia(eq.vigencia);
                                                                    setShowConfirmAltaModal(true);
                                                                }}
                                                                className="btn-success"
                                                                style={{ fontSize: '0.7rem', padding: '2px 8px', background: '#16a34a' }}
                                                            >
                                                                ACTIVAR
                                                            </button>
                                                            <button
                                                                onClick={() => handleOpenIndividualRejection(eq, 'ALTA')}
                                                                className="btn-secondary"
                                                                style={{ fontSize: '0.7rem', padding: '2px 8px', color: '#dc2626', borderColor: '#fecaca' }}
                                                            >
                                                                RECHAZAR
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span style={{ fontSize: '0.7rem', color: eq.rechazado ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                                                            {eq.rechazado ? 'RECHAZADO' : 'REACTIVADO'}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        Object.entries(reviewSolicitud.datos_json || {}).map(([key, val]) => {
                                            if (!val || key === 'equipos_baja' || key === 'equipos_alta' || key === 'isReactivation') return null;
                                            const labels: Record<string, string> = { codigo: 'Código', nombre: 'Nombre', tipo: 'Tipo', ubicacion: 'Ubicación', nueva_ubicacion: 'Nueva Ubicación', responsable: 'Responsable', nuevo_responsable: 'Nuevo Responsable', motivo: 'Motivo', vigencia: 'Vigencia', id_equipo: 'ID Equipo' };
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

                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setReviewSolicitud(null)} disabled={processingAction}>Cerrar</button>
                            {reviewSolicitud.estado === 'PENDIENTE' && (
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button
                                        className="btn-danger"
                                        onClick={handleOpenGlobalRejection}
                                        disabled={processingAction}
                                        style={{ minWidth: '100px' }}
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
                                    {(equipoAltaPending as any).codigo || equipoAltaPending.nombre}:{(equipoAltaPending as any).vigencia_propuesta && <span style={{ color: '#16a34a', marginLeft: '8px' }}> (Vigencia Propuesta: {(equipoAltaPending as any).vigencia_propuesta})</span>}
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

            {showRejectionReasonModal && (
                <div className="modal-overlay" style={{ zIndex: 10005 }}>
                    <div className="modal-content" style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Motivo de Rechazo</h3>
                        </div>
                        <div className="modal-body" style={{ padding: '1.5rem' }}>
                            <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1rem' }}>
                                {rejectionTarget?.type === 'ITEM'
                                    ? `Indique el motivo por el cual está rechazando el equipo: ${rejectionTarget.equipo?.nombre}`
                                    : 'Indique el motivo por el cual está rechazando toda la solicitud.'}
                            </p>
                            <div className="form-group">
                                <label className="form-label">Feedback / Observaciones <span style={{ color: '#dc2626' }}>*</span></label>
                                <textarea
                                    className="form-input"
                                    style={{ height: '100px', resize: 'none' }}
                                    placeholder="Ej: Documentación incompleta, equipo no corresponde..."
                                    value={localRejectionFeedback}
                                    onChange={(e) => setLocalRejectionFeedback(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => { setShowRejectionReasonModal(false); setRejectionTarget(null); }} disabled={processingAction}>Cancelar</button>
                            <button
                                className="btn-danger"
                                onClick={confirmRejectWithFeedback}
                                disabled={processingAction || !localRejectionFeedback.trim()}
                                style={{ opacity: !localRejectionFeedback.trim() ? 0.6 : 1 }}
                            >
                                {processingAction ? '...' : 'Confirmar Rechazo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading Overlay */}
            {processingAction && (
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
                    zIndex: 10000,
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
                        PROCESANDO SOLICITUD...
                    </div>
                </div>
            )}
        </div>
    );
};
