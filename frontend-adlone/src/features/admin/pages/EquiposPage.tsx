import React, { useState, useEffect, useMemo } from 'react';
import { 
    Container, 
    Stack, 
    Group, 
    Title, 
    Text, 
    Button, 
    Table, 
    Badge, 
    ActionIcon, 
    Paper, 
    LoadingOverlay, 
    Tooltip, 
    Box, 
    TextInput, 
    Select, 
    Pagination, 
    Divider, 
    Menu, 
    Modal, 
    ScrollArea, 
    Textarea,
    Grid,
    Alert
} from '@mantine/core';
import { 
    IconArrowLeft,
    IconPlus, 
    IconSearch, 
    IconX, 
    IconEdit, 
    IconPower, 
    IconBell, 
    IconDownload, 
    IconAlertTriangle,
    IconInfoCircle,
    IconTrash
} from '@tabler/icons-react';

import { equipoService, type Equipo } from '../services/equipo.service';
import { EquipmentExportModal } from '../components/EquipmentExportModal';
import { adminService } from '../../../services/admin.service';
import { EquipoForm } from '../components/EquipoForm';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavStore } from '../../../store/navStore';

interface Props {
    onBack: () => void;
}

export const EquiposPage: React.FC<Props> = ({ onBack }) => {
    // --- View State ---
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
    const [selectedEquipo, setSelectedEquipo] = useState<Equipo | null>(null);
    const [solicitudesRealizadas, setSolicitudesRealizadas] = useState<any[]>([]);
    
    // Modals State
    const [reviewSolicitud, setReviewSolicitud] = useState<any | null>(null);
    const [processingAction, setProcessingAction] = useState(false);
    const [showConfirmBajaModal, setShowConfirmBajaModal] = useState(false);
    const [showConfirmAltaModal, setShowConfirmAltaModal] = useState(false); 
    const [equipoBajaPending, setEquipoBajaPending] = useState<{ id: string; nombre: string; datos_json: any; id_solicitud?: number } | null>(null);
    const [bajaObservation, setBajaObservation] = useState('');
    const [equipoAltaPending, setEquipoAltaPending] = useState<{ id: string; nombre: string; codigo: string; originalId: number; datos_json: any; id_solicitud?: number; vigencia_propuesta?: string } | null>(null);
    const [reactivationVigencia, setReactivationVigencia] = useState<string>('');
    const [rejectionTarget, setRejectionTarget] = useState<{ type: 'SOLICITUD' | 'ITEM'; equipo?: any; bulkType?: 'ALTA' | 'BAJA' } | null>(null);
    const [showRejectionReasonModal, setShowRejectionReasonModal] = useState(false);
    const [localRejectionFeedback, setLocalRejectionFeedback] = useState('');
    const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);
    const [equipoStatusPending, setEquipoStatusPending] = useState<Equipo | null>(null);
    const [statusObservation, setStatusObservation] = useState('');
    const [showResolutionModal, setShowResolutionModal] = useState(false);
    const [resolutionFeedback, setResolutionFeedback] = useState('');
    const [resolutionDate, setResolutionDate] = useState('');
    const [solicitudInResolution, setSolicitudInResolution] = useState<any | null>(null);
    const [showExportModal, setShowExportModal] = useState(false);

    const { showToast } = useToast();
    const { hasPermission } = useAuth();
    
    // Permissions
    const isGCMan = hasPermission('GC_ACCESO') || hasPermission('GC_EQUIPOS');
    const isMAMan = hasPermission('AI_MA_SOLICITUDES') || hasPermission('MA_A_GEST_EQUIPO');
    const isSuper = hasPermission('AI_MA_ADMIN_ACCESO');
    const canCreateEquipo = hasPermission('AI_MA_CREAR_EQUIPO') || isSuper;
    const canEditEquipo = hasPermission('AI_MA_EDITAR_EQUIPO') || isSuper;

    // --- Table & Filters State ---
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTipo, setFilterTipo] = useState<string | null>(null);
    const [filterSede, setFilterSede] = useState<string | null>(null);
    const [filterEstado, setFilterEstado] = useState<string | null>(null);
    const [filterMuestreador, setFilterMuestreador] = useState<string | null>(null);
    const [filterFechaDesde, setFilterFechaDesde] = useState('');
    const [filterFechaHasta, setFilterFechaHasta] = useState('');
    
    const [page, setPage] = useState(1);
    const [limit] = useState(10); // increased for Mantine UI
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [muestreadorList, setMuestreadorList] = useState<any[]>([]);
    
    const [catalogs, setCatalogs] = useState<{ sedes: string[], tipos: string[], estados: string[] }>({
        sedes: ['PM', 'AY', 'VI', 'PA', 'PV', 'CH', 'Terreno'],
        tipos: ['Medidor de pH y Temperatura', 'Medidor de Oxígeno', 'Conductímetro', 'Turbidímetro', 'Multiparamétrico'],
        estados: ['Activo', 'Inactivo']
    });

    const { pendingRequestId, setPendingRequestId, hideNotification } = useNavStore();

    // --- Side Effects ---
    useEffect(() => {
        const fetchFiltersData = async () => {
            try {
                const msRes = await adminService.getMuestreadores('', 'ACTIVOS');
                if (msRes && msRes.data) {
                    setMuestreadorList(msRes.data);
                }
            } catch (error) {
                console.error("Error loading muestreadores for filters", error);
            }
        };
        fetchFiltersData();
        loadSolicitudes();
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchData();
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [page, filterTipo, filterSede, filterEstado, searchTerm, filterFechaDesde, filterFechaHasta, filterMuestreador]);

    // Notification handling from NavStore
    useEffect(() => {
        if (pendingRequestId && solicitudesRealizadas.length > 0) {
            const sol = solicitudesRealizadas.find(s => s.id_solicitud === pendingRequestId);
            if (sol) {
                handleNotificationClick(sol);
                setPendingRequestId(null);
            }
        }
    }, [pendingRequestId, solicitudesRealizadas]);

    // Date pre-filling for reactivation
    useEffect(() => {
        if (showConfirmAltaModal) {
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
                        return;
                    }
                }
            }
            if (equipoAltaPending?.id && equipoAltaPending?.datos_json?.equipos_alta) {
                const specificEq = equipoAltaPending.datos_json.equipos_alta.find((e: any) => String(e.id) === String(equipoAltaPending.id));
                if (specificEq?.vigencia) {
                    setReactivationVigencia(specificEq.vigencia);
                    return;
                }
            }
            if (equipoAltaPending?.datos_json?.vigencia) {
                setReactivationVigencia(equipoAltaPending.datos_json.vigencia);
            }
        } else {
            setReactivationVigencia('');
        }
    }, [showConfirmAltaModal, equipoAltaPending]);

    // --- Data Loaders ---
    const fetchData = async () => {
        setLoading(true);
        try {
            const params = {
                page,
                limit,
                search: searchTerm,
                tipo: filterTipo || '',
                sede: filterSede || '',
                estado: filterEstado || '',
                fechaDesde: filterFechaDesde,
                fechaHasta: filterFechaHasta,
                id_muestreador: filterMuestreador || ''
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

    const loadSolicitudes = async () => {
        try {
            const targetStates = ['PENDIENTE', 'PENDIENTE_CALIDAD'].join(',');
            const data = await adminService.getSolicitudes({ estado: targetStates });
            const managementTypes = [
                'ALTA', 'TRASPASO', 'BAJA', 'VIGENCIA_PROXIMA',
                'NUEVO_EQUIPO', 'EQUIPO_PERDIDO', 'REVISION', 'REPORTE_PROBLEMA',
                'EQUIPO_DESHABILITADO'
            ];
            const filteredData = data.filter((s: any) => managementTypes.includes(s.tipo_solicitud));
            setSolicitudesRealizadas(filteredData);
        } catch (error) {
            console.error("Error loading solicitudes:", error);
        }
    };

    // --- Handlers ---
    const handleNotificationClick = async (sol: any) => {
        const type = sol.tipo_solicitud;
        const isCreation = type === 'NUEVO_EQUIPO' || (type === 'ALTA' && !sol.datos_json?.isReactivation);
        if (isCreation) {
            setSelectedEquipo({
                ...sol.datos_json,
                id_equipo: undefined,
                requestId: sol.id_solicitud,
                requestStatus: sol.estado
            } as any);
            setViewMode('form');
        } else {
            setReviewSolicitud(sol);
        }
    };

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
                id: `pending-solicitude-${equipo.id_equipo}`,
                type: 'warning',
                message: `Atención: Este equipo tiene una solicitud de ${pending.tipo_solicitud} PENDIENTE`,
                duration: 5000
            });
        }
        setSelectedEquipo(equipo);
        setViewMode('form');
    };

    const handleToggleStatus = async (equipo: Equipo) => {
        setEquipoStatusPending(equipo);
        setStatusObservation('');
        setShowStatusConfirmModal(true);
    };

    const confirmToggleStatus = async () => {
        if (!equipoStatusPending) return;
        setProcessingAction(true);
        try {
            const newStatus = equipoStatusPending.estado?.toLowerCase() === 'activo' ? 'Inactivo' : 'Activo';
            const response = await equipoService.getEquipoById(equipoStatusPending.id_equipo);
            const latestData = response.success ? response.data : equipoStatusPending;
            await equipoService.updateEquipo(equipoStatusPending.id_equipo, {
                ...latestData,
                estado: newStatus,
                observacion: statusObservation
            });
            showToast({ type: 'success', message: `Equipo puesto como ${newStatus}` });
            setShowStatusConfirmModal(false);
            setEquipoStatusPending(null);
            fetchData();
        } catch (error: any) {
            showToast({ type: 'error', message: error.message || 'Error al cambiar el estado' });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleApprove = async () => {
        if (!reviewSolicitud) return;
        const needsTechnicalReview = reviewSolicitud.estado === 'PENDIENTE_TECNICA';

        if (needsTechnicalReview) {
            setProcessingAction(true);
            try {
                const type = reviewSolicitud.tipo_solicitud;
                const isInternal = type === 'EQUIPO_PERDIDO' || type === 'REPORTE_PROBLEMA';
                await adminService.updateSolicitudStatus(
                    reviewSolicitud.id_solicitud,
                    isInternal ? 'EN_REVISION' : 'PENDIENTE_CALIDAD',
                    isInternal ? 'Aceptado por Área Técnica' : 'Derivado a Calidad'
                );
                showToast({ type: 'success', message: 'Solicitud enviada a la siguiente etapa' });
                hideNotification(`${reviewSolicitud.id_solicitud}-${reviewSolicitud.estado}`);
                setReviewSolicitud(null);
                loadSolicitudes();
            } catch (error) {
                showToast({ type: 'error', message: 'Error al procesar solicitud' });
            } finally {
                setProcessingAction(false);
            }
            return;
        }

        if (reviewSolicitud.tipo_solicitud === 'BAJA' || reviewSolicitud.tipo_solicitud === 'EQUIPO_PERDIDO') {
            if (reviewSolicitud.datos_json?.id_equipo) {
                setEquipoBajaPending({
                    id: String(reviewSolicitud.datos_json.id_equipo),
                    nombre: reviewSolicitud.datos_json.nombre || reviewSolicitud.datos_json.codigo || 'Equipo',
                    datos_json: reviewSolicitud.datos_json,
                    id_solicitud: reviewSolicitud.id_solicitud
                });
                setBajaObservation('');
                setShowConfirmBajaModal(true);
                setReviewSolicitud(null);
            }
        } else {
            const type = reviewSolicitud.tipo_solicitud;
            if (type === 'ALTA' || type === 'NUEVO_EQUIPO') {
                const isReactivation = type === 'ALTA' && reviewSolicitud.datos_json?.isReactivation;
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
                    setReactivationVigencia(reviewSolicitud.datos_json.vigencia || '');
                    setShowConfirmAltaModal(true);
                    setReviewSolicitud(null);
                } else {
                    hideNotification(`${reviewSolicitud.id_solicitud}-${reviewSolicitud.estado}`);
                    setReviewSolicitud(null);
                    setSelectedEquipo({
                        ...reviewSolicitud.datos_json,
                        id_equipo: undefined,
                        requestId: reviewSolicitud.id_solicitud,
                        requestStatus: reviewSolicitud.estado
                    } as any);
                    setViewMode('form');
                }
            } else if (type === 'TRASPASO') {
                if (reviewSolicitud.datos_json?.id_equipo) {
                    const equipId = Number(reviewSolicitud.datos_json.id_equipo);
                    hideNotification(`${reviewSolicitud.id_solicitud}-${reviewSolicitud.estado}`);
                    setReviewSolicitud(null);
                    setSelectedEquipo({
                        id_equipo: equipId,
                        requestId: reviewSolicitud.id_solicitud,
                        requestStatus: reviewSolicitud.estado,
                        ubicacion: reviewSolicitud.datos_json.nueva_ubicacion,
                        id_muestreador: reviewSolicitud.datos_json.nuevo_responsable_id || 0,
                        vigencia: reviewSolicitud.datos_json.vigencia
                    } as any);
                    setViewMode('form');
                }
            } else if (type === 'VIGENCIA_PROXIMA') {
                const idEquipo = reviewSolicitud.datos_json.id_equipo;
                if (idEquipo) {
                    setEquipoAltaPending({
                        id: String(idEquipo),
                        nombre: reviewSolicitud.datos_json.nombre_equipo || 'Equipo',
                        codigo: reviewSolicitud.datos_json.codigo_equipo || '',
                        originalId: Number(idEquipo),
                        datos_json: reviewSolicitud.datos_json,
                        id_solicitud: reviewSolicitud.id_solicitud,
                        vigencia_propuesta: reviewSolicitud.datos_json.nueva_vigencia_solicitada
                    } as any);
                    setReactivationVigencia(reviewSolicitud.datos_json.nueva_vigencia_solicitada || '');
                    setShowConfirmAltaModal(true);
                    setReviewSolicitud(null);
                }
            } else if (['EQUIPO_PERDIDO', 'REPORTE_PROBLEMA', 'REVISION', 'EQUIPO_DESHABILITADO'].includes(type)) {
                if (reviewSolicitud.estado === 'PENDIENTE_CALIDAD') {
                    setResolutionFeedback('');
                    setResolutionDate(reviewSolicitud.datos_json?.vigencia || '');
                    setSolicitudInResolution(reviewSolicitud);
                    setShowResolutionModal(true);
                    setReviewSolicitud(null);
                } else {
                    setProcessingAction(true);
                    try {
                        await adminService.updateSolicitudStatus(reviewSolicitud.id_solicitud, 'APROBADO', 'Aprobado por Calidad');
                        showToast({ type: 'success', message: 'Solicitud aprobada' });
                        hideNotification(`${reviewSolicitud.id_solicitud}-${reviewSolicitud.estado}`);
                        setReviewSolicitud(null);
                        loadSolicitudes();
                        fetchData();
                    } catch (error) {
                        showToast({ type: 'error', message: 'Error al aprobar' });
                    } finally {
                        setProcessingAction(false);
                    }
                }
            }
        }
    };

    const confirmFinalResolution = async () => {
        if (!resolutionFeedback.trim()) return;
        setProcessingAction(true);
        try {
            await adminService.updateSolicitudStatus(solicitudInResolution.id_solicitud, 'APROBADO', resolutionFeedback);
            const idEquipo = solicitudInResolution.datos_json?.id_equipo || solicitudInResolution.datos_json?.id_equipo_original;
            if (idEquipo && resolutionDate) {
                await adminService.updateEquipo(idEquipo, {
                    vigencia: resolutionDate,
                    estado: 'Activo',
                    observacion: `Reactivación aprobada: ${resolutionFeedback}`
                });
            }
            showToast({ type: 'success', message: 'Resolución completada' });
            setShowResolutionModal(false);
            loadSolicitudes();
            fetchData();
        } catch (error) {
            showToast({ type: 'error', message: 'Error procesando resolución' });
        } finally {
            setProcessingAction(false);
        }
    };

    const confirmApproveAlta = async () => {
        if (!equipoAltaPending || !reactivationVigencia) return;
        setProcessingAction(true);
        try {
            const resp = await equipoService.getEquipoById(equipoAltaPending.originalId);
            const current = resp.success ? resp.data : {};
            const isVigenciaOnly = equipoAltaPending.datos_json?.tipo_solicitud === 'VIGENCIA_PROXIMA';

            await equipoService.updateEquipo(equipoAltaPending.originalId, {
                ...current,
                estado: isVigenciaOnly ? (current.estado || 'Activo') : 'Activo',
                vigencia: reactivationVigencia
            });

            const currentSol = reviewSolicitud || { id_solicitud: equipoAltaPending.id_solicitud, datos_json: equipoAltaPending.datos_json };
            const eqAltas = currentSol.datos_json?.equipos_alta;

            if (eqAltas) {
                const updated = eqAltas.map((e: any) => String(e.id) === String(equipoAltaPending.id) ? { ...e, procesado: true } : e);
                const allDone = updated.every((e: any) => e.procesado);
                const newJson = { ...currentSol.datos_json, equipos_alta: updated };
                
                await adminService.updateSolicitudStatus(
                    equipoAltaPending.id_solicitud!,
                    allDone ? 'APROBADO' : 'PENDIENTE',
                    allDone ? 'Reactivación finalizada' : 'Parcial procesada',
                    newJson,
                    equipoAltaPending.id,
                    'APROBADO'
                );
                if (allDone) {
                    setReviewSolicitud(null);
                    hideNotification(`${equipoAltaPending.id_solicitud}-PENDIENTE`);
                } else {
                    setReviewSolicitud({ ...currentSol, datos_json: newJson });
                }
            } else {
                await adminService.updateSolicitudStatus(equipoAltaPending.id_solicitud!, 'APROBADO', 'Procesado', undefined, equipoAltaPending.id, 'APROBADO');
                setReviewSolicitud(null);
                hideNotification(`${equipoAltaPending.id_solicitud}-PENDIENTE`);
            }

            showToast({ type: 'success', message: 'Reactivación correcta' });
            setShowConfirmAltaModal(false);
            fetchData();
            loadSolicitudes();
        } catch (error) {
            showToast({ type: 'error', message: 'Error al activar' });
        } finally {
            setProcessingAction(false);
        }
    };

    const confirmApproveBaja = async () => {
        if (!equipoBajaPending) return;
        const isLost = equipoBajaPending.datos_json?.tipo_solicitud === 'EQUIPO_PERDIDO';
        if (isLost && !bajaObservation.trim()) return;

        setProcessingAction(true);
        try {
            if (!isLost) await equipoService.deleteEquipo(Number(equipoBajaPending.id));
            
            const eqBajas = (equipoBajaPending.datos_json?.equipos_baja || []).map((e: any) =>
                String(e.id) === String(equipoBajaPending.id) ? { ...e, procesado: true } : e
            );
            const allDone = eqBajas.every((e: any) => e.procesado);
            const newJson = { ...equipoBajaPending.datos_json, equipos_baja: eqBajas };

            await adminService.updateSolicitudStatus(
                equipoBajaPending.id_solicitud!,
                allDone ? 'APROBADO' : 'PENDIENTE',
                isLost ? bajaObservation : 'Baja procesada',
                newJson,
                equipoBajaPending.id,
                'APROBADO'
            );

            if (allDone) {
                setReviewSolicitud(null);
                hideNotification(`${equipoBajaPending.id_solicitud}-PENDIENTE`);
            } else {
                setReviewSolicitud((prev: any) => prev ? { ...prev, datos_json: newJson } : null);
            }
            setShowConfirmBajaModal(false);
            fetchData();
            loadSolicitudes();
        } catch (error) {
            showToast({ type: 'error', message: 'Error en baja' });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleReject = async (feedback: string) => {
        if (!reviewSolicitud) return;
        setProcessingAction(true);
        try {
            const finalStatus = reviewSolicitud.estado === 'PENDIENTE_TECNICA' ? 'RECHAZADO_TECNICA' : 'RECHAZADA';
            await adminService.updateSolicitudStatus(reviewSolicitud.id_solicitud, finalStatus, feedback);
            showToast({ type: 'success', message: 'Rechazo completado' });
            hideNotification(`${reviewSolicitud.id_solicitud}-${reviewSolicitud.estado}`);
            setReviewSolicitud(null);
            loadSolicitudes();
        } catch (error) {
            showToast({ type: 'error', message: 'Error al rechazar' });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleApproveAllBaja = async () => {
        if (!reviewSolicitud || !reviewSolicitud.datos_json?.equipos_baja) return;
        setProcessingAction(true);
        try {
            const list = reviewSolicitud.datos_json.equipos_baja;
            const pending = list.filter((e: any) => !e.procesado);
            for (const item of pending) {
                await equipoService.deleteEquipo(Number(item.id));
            }
            const updatedList = list.map((e: any) => ({ ...e, procesado: true }));
            await adminService.updateSolicitudStatus(
                reviewSolicitud.id_solicitud,
                'APROBADO',
                'Baja masiva aprobada por administración',
                { ...reviewSolicitud.datos_json, equipos_baja: updatedList }
            );
            showToast({ type: 'success', message: 'Todos los equipos han sido dados de baja' });
            hideNotification(`${reviewSolicitud.id_solicitud}-${reviewSolicitud.estado}`);
            setReviewSolicitud(null);
            loadSolicitudes();
            fetchData();
        } catch (error) {
            showToast({ type: 'error', message: 'Error en procesamiento masivo' });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleApproveAllAlta = async () => {
        if (!reviewSolicitud || !reviewSolicitud.datos_json?.equipos_alta) return;
        setProcessingAction(true);
        try {
            const list = reviewSolicitud.datos_json.equipos_alta;
            const pending = list.filter((e: any) => !e.procesado);
            for (const item of pending) {
                const resp = await equipoService.getEquipoById(item.id);
                const current = resp.success ? resp.data : {};
                await equipoService.updateEquipo(item.id, {
                    ...current,
                    estado: 'Activo',
                    vigencia: item.vigencia || current.vigencia
                });
            }
            const updatedList = list.map((e: any) => ({ ...e, procesado: true }));
            await adminService.updateSolicitudStatus(
                reviewSolicitud.id_solicitud,
                'APROBADO',
                'Reactivación masiva aprobada',
                { ...reviewSolicitud.datos_json, equipos_alta: updatedList }
            );
            showToast({ type: 'success', message: 'Todos los equipos han sido reactivados' });
            hideNotification(`${reviewSolicitud.id_solicitud}-${reviewSolicitud.estado}`);
            setReviewSolicitud(null);
            loadSolicitudes();
            fetchData();
        } catch (error) {
            showToast({ type: 'error', message: 'Error en reactivación masiva' });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleOpenIndividualRejection = (item: any, bulkType: 'ALTA' | 'BAJA') => {
        setRejectionTarget({ type: 'ITEM', equipo: item, bulkType });
        setLocalRejectionFeedback('');
        setShowRejectionReasonModal(true);
    };

    const confirmRejectWithFeedback = async () => {
        if (!reviewSolicitud || !localRejectionFeedback.trim()) return;
        setProcessingAction(true);
        try {
            if (rejectionTarget?.type === 'SOLICITUD') {
                await handleReject(localRejectionFeedback);
            } else {
                const { equipo, bulkType } = rejectionTarget!;
                const field = bulkType === 'BAJA' ? 'equipos_baja' : 'equipos_alta';
                const list = reviewSolicitud.datos_json[field];
                const updatedList = list.map((e: any) => 
                    String(e.id) === String(equipo.id) ? { ...e, procesado: true, rechazado: true } : e
                );
                const allDone = updatedList.every((e: any) => e.procesado);
                const someApproved = updatedList.some((e: any) => e.procesado && !e.rechazado);

                await adminService.updateSolicitudStatus(
                    reviewSolicitud.id_solicitud,
                    allDone ? (someApproved ? 'APROBADO' : 'RECHAZADO') : 'PENDIENTE',
                    localRejectionFeedback,
                    { ...reviewSolicitud.datos_json, [field]: updatedList },
                    equipo.id,
                    'RECHAZADO'
                );

                if (allDone) {
                    hideNotification(`${reviewSolicitud.id_solicitud}-${reviewSolicitud.estado}`);
                    setReviewSolicitud(null);
                } else {
                    setReviewSolicitud({
                        ...reviewSolicitud,
                        datos_json: { ...reviewSolicitud.datos_json, [field]: updatedList }
                    });
                }
                showToast({ type: 'info', message: 'Item rechazado' });
            }
            setShowRejectionReasonModal(false);
            loadSolicitudes();
        } catch (error) {
            showToast({ type: 'error', message: 'Error al rechazar' });
        } finally {
            setProcessingAction(false);
        }
    };

    const handleClearFilters = () => {
        setSearchTerm('');
        setFilterTipo(null);
        setFilterSede(null);
        setFilterEstado(null);
        setFilterMuestreador(null);
        setFilterFechaDesde('');
        setFilterFechaHasta('');
        setPage(1);
    };

    // --- Helper Logic ---
    const getTipoLabelDisplay = (sol: any) => {
        const type = sol.tipo_solicitud;
        if (type === 'ALTA') return sol.datos_json?.isReactivation ? 'Activación' : 'Creación';
        if (['NUEVO_EQUIPO', 'BAJA', 'TRASPASO', 'VIGENCIA_PROXIMA', 'REPORTE_PROBLEMA', 'REVISION', 'EQUIPO_PERDIDO', 'EQUIPO_DESHABILITADO'].includes(type)) {
            return type.replace(/_/g, ' ');
        }
        return type;
    };

    const getPendingRequestsForEquipo = (id: number) => {
        return solicitudesRealizadas.filter(sol => {
            const d = sol.datos_json || {};
            if (sol.tipo_solicitud === 'TRASPASO' && String(d.id_equipo) === String(id)) return true;
            if (sol.tipo_solicitud === 'BAJA' && d.equipos_baja?.some((eb: any) => String(eb.id) === String(id))) return true;
            if (sol.tipo_solicitud === 'ALTA' && d.isReactivation && d.equipos_alta?.some((ea: any) => String(ea.id) === String(id))) return true;
            return false;
        });
    };

    const hasActiveFilters = useMemo(() => 
        searchTerm !== '' || filterTipo || filterSede || filterEstado || filterMuestreador || filterFechaDesde || filterFechaHasta,
    [searchTerm, filterTipo, filterSede, filterEstado, filterMuestreador, filterFechaDesde, filterFechaHasta]);

    // --- Render Logic ---
    if (viewMode === 'form') {
        return (
            <Container fluid py="xl">
                <EquipoForm
                    initialData={selectedEquipo}
                    onCancel={() => setViewMode('list')}
                    onSave={() => { setViewMode('list'); fetchData(); loadSolicitudes(); }}
                    pendingRequests={selectedEquipo ? getPendingRequestsForEquipo(selectedEquipo.id_equipo) : []}
                    onRefreshSolicitudes={() => { loadSolicitudes(); fetchData(); }}
                />
            </Container>
        );
    }

    return (
        <Container fluid py="lg">
            <Stack gap="lg">
                <Paper withBorder p="md" radius="md" shadow="sm">
                    <Group justify="space-between">
                        <Group>
                            <ActionIcon variant="subtle" size="lg" onClick={onBack} color="gray">
                                <IconArrowLeft size={20} />
                            </ActionIcon>
                            <Box>
                                <Title order={2}>Gestión de Equipos</Title>
                                <Text size="sm" c="dimmed">Administra y supervisa los equipos de medición del sistema.</Text>
                            </Box>
                        </Group>

                        <Group>
                            <Menu shadow="md" width={300} closeOnItemClick={false}>
                                <Menu.Target>
                                    <Button 
                                        variant="light" 
                                        leftSection={<IconBell size={18} />}
                                        rightSection={solicitudesRealizadas.length > 0 && <Badge size="xs" color="red" circle>{solicitudesRealizadas.length}</Badge>}
                                    >
                                        Solicitudes
                                    </Button>
                                </Menu.Target>
                                <Menu.Dropdown>
                                    <Menu.Label>Solicitudes Pendientes</Menu.Label>
                                    <ScrollArea.Autosize mah={400} type="scroll">
                                        {solicitudesRealizadas.length === 0 ? (
                                            <Box p="lg" style={{ textAlign: 'center' }}>
                                                <Text size="xs" c="dimmed">No hay solicitudes pendientes.</Text>
                                            </Box>
                                        ) : (
                                            solicitudesRealizadas.map(sol => (
                                                <Menu.Item 
                                                    key={sol.id_solicitud} 
                                                    onClick={() => handleNotificationClick(sol)}
                                                    leftSection={<IconInfoCircle size={16} color="blue" />}
                                                >
                                                    <Stack gap={2}>
                                                        <Group justify="space-between">
                                                            <Text size="xs" fw={700}>{getTipoLabelDisplay(sol)}</Text>
                                                            <Text size="xs" c="dimmed">{new Date(sol.fecha_solicitud).toLocaleDateString()}</Text>
                                                        </Group>
                                                        <Text size="xs" lineClamp={1}>{sol.datos_json?.nombre || sol.datos_json?.codigo || 'Solicitud'}</Text>
                                                        <Text size="xs" c="dimmed">{sol.nombre_solicitante}</Text>
                                                    </Stack>
                                                </Menu.Item>
                                            ))
                                        )}
                                    </ScrollArea.Autosize>
                                </Menu.Dropdown>
                            </Menu>

                            <Button 
                                variant="outline" 
                                leftSection={<IconDownload size={18} />} 
                                onClick={() => setShowExportModal(true)}
                            >
                                Exportar
                            </Button>

                            <Button 
                                leftSection={<IconPlus size={18} />} 
                                onClick={handleCreate}
                                disabled={!canCreateEquipo}
                                color="adl-blue"
                            >
                                Nuevo Equipo
                            </Button>
                        </Group>
                    </Group>
                </Paper>

                <Paper withBorder p="md" radius="md" shadow="xs">
                    <Grid align="flex-end">
                        <Grid.Col span={{ base: 12, md: 3 }}>
                            <TextInput
                                label="Buscar"
                                placeholder="Nombre o código..."
                                leftSection={<IconSearch size={16} />}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                            />
                        </Grid.Col>
                        <Grid.Col span={{ base: 6, md: 2 }}>
                            <Select
                                label="Tipo"
                                placeholder="Todos"
                                data={['Todos', ...catalogs.tipos]}
                                value={filterTipo}
                                onChange={v => setFilterTipo(v === 'Todos' ? null : v)}
                                clearable
                            />
                        </Grid.Col>
                        <Grid.Col span={{ base: 6, md: 1.5 }}>
                            <Select
                                label="Sede"
                                placeholder="Todas"
                                data={['Todos', ...catalogs.sedes]}
                                value={filterSede}
                                onChange={v => setFilterSede(v === 'Todos' ? null : v)}
                                clearable
                            />
                        </Grid.Col>
                        <Grid.Col span={{ base: 6, md: 1.5 }}>
                            <Select
                                label="Estado"
                                placeholder="Todos"
                                data={['Todos', ...catalogs.estados]}
                                value={filterEstado}
                                onChange={v => setFilterEstado(v === 'Todos' ? null : v)}
                                clearable
                            />
                        </Grid.Col>
                        <Grid.Col span={{ base: 6, md: 2 }}>
                            <Select
                                label="Responsable"
                                placeholder="Todos"
                                data={['Todos', ...muestreadorList.map(m => m.nombre_muestreador)]}
                                value={muestreadorList.find(m => String(m.id_muestreador) === filterMuestreador)?.nombre_muestreador || null}
                                onChange={v => {
                                    if (v === 'Todos' || !v) setFilterMuestreador(null);
                                    else {
                                        const found = muestreadorList.find(m => m.nombre_muestreador === v);
                                        if (found) setFilterMuestreador(String(found.id_muestreador));
                                    }
                                }}
                                clearable
                                searchable
                            />
                        </Grid.Col>
                        <Grid.Col span={{ base: 6, md: 2 }}>
                            <Group gap={5} grow>
                                <TextInput
                                    label="Vigencia"
                                    type="date"
                                    value={filterFechaDesde}
                                    onChange={(e) => setFilterFechaDesde(e.target.value)}
                                />
                                <TextInput
                                    label=" "
                                    type="date"
                                    value={filterFechaHasta}
                                    onChange={(e) => setFilterFechaHasta(e.target.value)}
                                />
                            </Group>
                        </Grid.Col>
                        {hasActiveFilters && (
                            <Grid.Col span="auto">
                                <Button variant="subtle" color="red" leftSection={<IconX size={16} />} onClick={handleClearFilters}>
                                    Limpiar
                                </Button>
                            </Grid.Col>
                        )}
                    </Grid>
                </Paper>

                <Paper withBorder p={0} radius="md" style={{ overflow: 'hidden', position: 'relative' }}>
                    <LoadingOverlay visible={loading} />
                    <ScrollArea.Autosize mah={600}>
                        <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
                            <Table.Thead bg="gray.0">
                                <Table.Tr>
                                    <Table.Th w={40}></Table.Th>
                                    <Table.Th>Código</Table.Th>
                                    <Table.Th>Nombre</Table.Th>
                                    <Table.Th>Tipo</Table.Th>
                                    <Table.Th>Sede</Table.Th>
                                    <Table.Th>Estado</Table.Th>
                                    <Table.Th>Vigencia</Table.Th>
                                    <Table.Th>Responsable</Table.Th>
                                    <Table.Th ta="right">Acciones</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {equipos.length === 0 ? (
                                    <Table.Tr>
                                        <Table.Td colSpan={9} ta="center" py="xl">
                                            <Text c="dimmed">No se encontraron equipos.</Text>
                                        </Table.Td>
                                    </Table.Tr>
                                ) : (
                                    equipos.map(equipo => {
                                        const isInactive = equipo.estado?.toLowerCase() === 'inactivo';
                                        const hasPending = getPendingRequestsForEquipo(equipo.id_equipo).length > 0;
                                        
                                        const checkExp = (v?: string) => {
                                            if (!v) return false;
                                            const d = new Date(v);
                                            return !isNaN(d.getTime()) && (d.getTime() - Date.now()) <= (30 * 86400000);
                                        };
                                        const expiring = checkExp(equipo.vigencia);

                                        return (
                                            <Table.Tr key={equipo.id_equipo}>
                                                <Table.Td>
                                                    {hasPending && (
                                                        <Tooltip label="Solicitud técnica pendiente">
                                                            <IconAlertTriangle size={18} color="var(--mantine-color-orange-6)" />
                                                        </Tooltip>
                                                    )}
                                                </Table.Td>
                                                <Table.Td>
                                                    <Badge variant="light" color="blue" radius="sm">
                                                        {equipo.codigo}
                                                    </Badge>
                                                </Table.Td>
                                                <Table.Td fw={600}>{equipo.nombre}</Table.Td>
                                                <Table.Td>{equipo.tipo}</Table.Td>
                                                <Table.Td>{equipo.ubicacion}</Table.Td>
                                                <Table.Td>
                                                    <Badge color={isInactive ? 'red' : 'green'} variant="dot">
                                                        {equipo.estado}
                                                    </Badge>
                                                </Table.Td>
                                                <Table.Td>
                                                    <Text size="sm" color={expiring ? 'orange.7' : 'inherit'} fw={expiring ? 700 : 400}>
                                                        {equipo.vigencia}
                                                    </Text>
                                                </Table.Td>
                                                <Table.Td>{equipo.nombre_asignado || '---'}</Table.Td>
                                                <Table.Td>
                                                    <Group gap="xs" justify="flex-end">
                                                        <Tooltip label="Editar">
                                                            <ActionIcon 
                                                                variant="subtle" 
                                                                onClick={() => handleEdit(equipo)} 
                                                                disabled={!canEditEquipo}
                                                            >
                                                                <IconEdit size={18} />
                                                            </ActionIcon>
                                                        </Tooltip>
                                                        <Tooltip label={isInactive ? 'Activar' : 'Desactivar'}>
                                                            <ActionIcon 
                                                                variant="light" 
                                                                color={isInactive ? 'green' : 'red'}
                                                                onClick={() => handleToggleStatus(equipo)}
                                                                disabled={!canEditEquipo}
                                                            >
                                                                <IconPower size={18} />
                                                            </ActionIcon>
                                                        </Tooltip>
                                                    </Group>
                                                </Table.Td>
                                            </Table.Tr>
                                        );
                                    })
                                )}
                            </Table.Tbody>
                        </Table>
                    </ScrollArea.Autosize>
                    <Divider />
                    <Group justify="space-between" p="md">
                        <Text size="xs" c="dimmed">{totalItems} equipos en total</Text>
                        <Pagination 
                            total={totalPages} 
                            value={page} 
                            onChange={setPage} 
                            size="sm" 
                            radius="md" 
                            color="adl-blue"
                        />
                    </Group>
                </Paper>
            </Stack>

            {/* --- Modals Area --- */}

            {/* Review Solicitud Modal */}
            <Modal
                opened={!!reviewSolicitud}
                onClose={() => setReviewSolicitud(null)}
                title={
                    <Group gap="xs">
                        <IconBell size={20} color="blue" />
                        <Text fw={700}>Revisar Solicitud de {reviewSolicitud && getTipoLabelDisplay(reviewSolicitud)}</Text>
                    </Group>
                }
                size="lg"
                radius="md"
            >
                <LoadingOverlay visible={processingAction} />
                {reviewSolicitud && (
                    <Stack gap="lg">
                        <Paper withBorder p="md" bg="gray.0" radius="md">
                            <Grid grow>
                                <Grid.Col span={6}>
                                    <Text size="xs" c="dimmed" fw={700}>Solicitante</Text>
                                    <Text size="sm" fw={600}>{reviewSolicitud.nombre_solicitante}</Text>
                                </Grid.Col>
                                <Grid.Col span={6}>
                                    <Text size="xs" c="dimmed" fw={700}>Fecha</Text>
                                    <Text size="sm">{new Date(reviewSolicitud.fecha_solicitud).toLocaleString()}</Text>
                                </Grid.Col>
                            </Grid>
                        </Paper>

                        {/* Special case for BULK BAJA/ALTA */}
                        {((reviewSolicitud.tipo_solicitud === 'BAJA' && reviewSolicitud.datos_json?.equipos_baja) || 
                          (reviewSolicitud.tipo_solicitud === 'ALTA' && reviewSolicitud.datos_json?.isReactivation && reviewSolicitud.datos_json?.equipos_alta)) ? (
                            <Stack gap="sm">
                                <Group justify="space-between">
                                    <Text fw={700} size="sm">Equipos involucrados</Text>
                                    <Button 
                                        size="xs" 
                                        variant="light" 
                                        color={reviewSolicitud.tipo_solicitud === 'BAJA' ? 'red' : 'green'}
                                        onClick={reviewSolicitud.tipo_solicitud === 'BAJA' ? handleApproveAllBaja : handleApproveAllAlta}
                                    >
                                        Procesar Todo
                                    </Button>
                                </Group>
                                <ScrollArea h={250}>
                                    <Stack gap="xs">
                                        {(reviewSolicitud.datos_json.equipos_baja || reviewSolicitud.datos_json.equipos_alta).map((eq: any) => (
                                            <Paper key={eq.id} withBorder p="xs" radius="sm" bg={eq.procesado ? 'gray.0' : 'white'}>
                                                <Group justify="space-between">
                                                    <Box>
                                                        <Text size="sm" fw={600} td={eq.procesado ? 'line-through' : 'none'}>{eq.nombre}</Text>
                                                        <Text size="xs" c="dimmed">{eq.codigo || eq.datos_originales?.codigo}</Text>
                                                        {eq.vigencia && <Text size="xs" c="green" fw={700}>Propuesta: {eq.vigencia}</Text>}
                                                    </Box>
                                                    {!eq.procesado ? (
                                                        <Group gap={5}>
                                                            <Button size="compact-xs" color={reviewSolicitud.tipo_solicitud === 'BAJA' ? 'red' : 'green'} 
                                                                onClick={() => {
                                                                    if (reviewSolicitud.tipo_solicitud === 'BAJA') {
                                                                        setEquipoBajaPending({ ...eq, id_solicitud: reviewSolicitud.id_solicitud, datos_json: reviewSolicitud.datos_json });
                                                                        setShowConfirmBajaModal(true);
                                                                    } else {
                                                                        setEquipoAltaPending({ ...eq, id: String(eq.id), originalId: Number(eq.id), id_solicitud: reviewSolicitud.id_solicitud, datos_json: reviewSolicitud.datos_json, vigencia_propuesta: eq.vigencia } as any);
                                                                        setReactivationVigencia(eq.vigencia || '');
                                                                        setShowConfirmAltaModal(true);
                                                                    }
                                                                }}
                                                            >
                                                                Aprobar
                                                            </Button>
                                                            <Button size="compact-xs" variant="outline" color="red" onClick={() => handleOpenIndividualRejection(eq, reviewSolicitud.tipo_solicitud as any)}>
                                                                Rechazar
                                                            </Button>
                                                        </Group>
                                                    ) : (
                                                        <Badge color={eq.rechazado ? 'red' : 'green'} size="xs">{eq.rechazado ? 'RECHAZADO' : 'PROCESADO'}</Badge>
                                                    )}
                                                </Group>
                                            </Paper>
                                        ))}
                                    </Stack>
                                </ScrollArea>
                            </Stack>
                        ) : reviewSolicitud.tipo_solicitud === 'EQUIPO_PERDIDO' ? (
                            <Stack gap="md">
                                <Alert color="red" title="Reporte de Pérdida / Extravío" icon={<IconAlertTriangle size={18} />}>
                                    Indica {reviewSolicitud.datos_json?.tipo_perdida} ocurrido el {reviewSolicitud.datos_json?.fecha_incidente}.
                                </Alert>
                                <Paper withBorder p="md" radius="sm">
                                    <Text size="xs" fw={700} c="dimmed" mb={5}>CIRCUNSTANCIAS</Text>
                                    <Text size="sm">{reviewSolicitud.datos_json?.circunstancias || 'No detalladas'}</Text>
                                </Paper>
                            </Stack>
                        ) : (
                            <Box style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                <Stack gap={8}>
                                    {Object.entries(reviewSolicitud.datos_json || {}).map(([key, val]) => {
                                        if (!val || ['equipos_baja', 'equipos_alta', 'isReactivation', 'id_muestreador', 'id_equipo_original'].includes(key)) return null;
                                        if (key === 'archivo_adjunto') return (
                                            <Box key={key} mt="xs">
                                                <Text size="xs" fw={700} c="dimmed">Archivo Adjunto:</Text>
                                                <Paper withBorder mt={5} p={4} radius="sm">
                                                    <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:8002'}${val}`} 
                                                         style={{ width: '100%', maxHeight: 200, objectFit: 'contain' }} alt="adjunto" />
                                                </Paper>
                                            </Box>
                                        );
                                        return (
                                            <Group key={key} justify="space-between">
                                                <Text size="xs" fw={700} c="dimmed" style={{ textTransform: 'uppercase' }}>{key.replace(/_/g, ' ')}:</Text>
                                                <Text size="sm" fw={600}>{String(val)}</Text>
                                            </Group>
                                        );
                                    })}
                                    {reviewSolicitud.feedback_admin && (
                                        <Alert color="orange" mt="md" title="Observación Técnica">
                                            {reviewSolicitud.feedback_admin}
                                        </Alert>
                                    )}
                                </Stack>
                            </Box>
                        )}

                        <Group justify="flex-end" mt="xl">
                            <Button variant="subtle" onClick={() => setReviewSolicitud(null)}>Cerrar</Button>
                            {(reviewSolicitud.estado === 'PENDIENTE' || reviewSolicitud.estado === 'PENDIENTE_TECNICA' || reviewSolicitud.estado === 'PENDIENTE_CALIDAD') && (
                                <Group gap="sm">
                                    <Button variant="light" color="red" onClick={() => { setRejectionTarget({ type: 'SOLICITUD' }); setLocalRejectionFeedback(''); setShowRejectionReasonModal(true); }}>
                                        Rechazar
                                    </Button>
                                    {reviewSolicitud.estado === 'PENDIENTE_TECNICA' && (isMAMan || isSuper) && (
                                        <Button color="green" onClick={handleApprove}>
                                            {(reviewSolicitud.tipo_solicitud === 'EQUIPO_PERDIDO' || reviewSolicitud.tipo_solicitud === 'REPORTE_PROBLEMA') 
                                                ? 'Procesar' : 'Derivar a Calidad'}
                                        </Button>
                                    )}
                                    {reviewSolicitud.estado === 'PENDIENTE_CALIDAD' && (isGCMan || isSuper) && (
                                        <Button color="green" onClick={handleApprove}>Aprobar Final</Button>
                                    )}
                                    {reviewSolicitud.estado === 'PENDIENTE' && (
                                        <Button color="green" onClick={handleApprove}>Aprobar</Button>
                                    )}
                                </Group>
                            )}
                        </Group>
                    </Stack>
                )}
            </Modal>

            {/* Confirm Baja Modal */}
            <Modal
                opened={showConfirmBajaModal}
                onClose={() => setShowConfirmBajaModal(false)}
                title="Confirmar Baja / Pérdida"
                centered
                radius="md"
            >
                <Stack gap="md" align="center" py="md">
                    <IconTrash size={48} color="var(--mantine-color-red-6)" />
                    <Text ta="center">¿Estás seguro de dar de baja al equipo <b>{equipoBajaPending?.nombre}</b>?</Text>
                    {equipoBajaPending?.datos_json?.tipo_solicitud === 'EQUIPO_PERDIDO' && (
                        <Box w="100%">
                            <Textarea 
                                label="Observación Final de Pérdida" 
                                required 
                                value={bajaObservation}
                                onChange={(e) => setBajaObservation(e.currentTarget.value)}
                                minRows={3}
                            />
                        </Box>
                    )}
                    <Group grow w="100%" mt="lg">
                        <Button variant="subtle" color="gray" onClick={() => setShowConfirmBajaModal(false)}>Cancelar</Button>
                        <Button color="red" onClick={confirmApproveBaja} loading={processingAction}>Confirmar Baja</Button>
                    </Group>
                </Stack>
            </Modal>

            {/* Confirm Alta / Reactivation Modal */}
            <Modal
                opened={showConfirmAltaModal}
                onClose={() => setShowConfirmAltaModal(false)}
                title="Confirmar Reactivación / Vigencia"
                centered
                radius="md"
            >
                <Stack gap="md" py="md">
                    <Text ta="center">Se actualizará el equipo: <b>{equipoAltaPending?.nombre}</b></Text>
                    <TextInput 
                        label="Nueva Fecha de Vigencia"
                        type="date"
                        required
                        value={reactivationVigencia}
                        onChange={(e) => setReactivationVigencia(e.currentTarget.value)}
                    />
                    <Group grow mt="lg">
                        <Button variant="subtle" color="gray" onClick={() => setShowConfirmAltaModal(false)}>Cancelar</Button>
                        <Button color="green" onClick={confirmApproveAlta} loading={processingAction}>Confirmar Actividad</Button>
                    </Group>
                </Stack>
            </Modal>

            {/* Resolution Modal */}
            <Modal
                opened={showResolutionModal}
                onClose={() => setShowResolutionModal(false)}
                title="Resolución Final de Calidad"
                radius="md"
            >
                <Stack gap="md">
                    <Textarea 
                        label="Observación de Calidad" 
                        required 
                        minRows={4}
                        placeholder="Escribe la resolución de calidad aquí..."
                        value={resolutionFeedback}
                        onChange={(e) => setResolutionFeedback(e.currentTarget.value)}
                    />
                    {['EQUIPO_DESHABILITADO', 'ALTA'].includes(solicitudInResolution?.tipo_solicitud) && (
                        <TextInput 
                            label="Actualizar Vigencia"
                            type="date"
                            value={resolutionDate}
                            onChange={(e) => setResolutionDate(e.currentTarget.value)}
                        />
                    )}
                    <Group grow mt="lg">
                        <Button variant="subtle" color="gray" onClick={() => setShowResolutionModal(false)}>Cancelar</Button>
                        <Button color="green" onClick={confirmFinalResolution} loading={processingAction}>Aprobar Final</Button>
                    </Group>
                </Stack>
            </Modal>

            {/* Status Confirm Modal */}
            <Modal
                opened={showStatusConfirmModal}
                onClose={() => setShowStatusConfirmModal(false)}
                title={equipoStatusPending?.estado === 'Activo' ? 'Desactivar Equipo' : 'Activar Equipo'}
                centered
                radius="md"
            >
                <Stack align="center" gap="md">
                    <IconPower size={48} color={equipoStatusPending?.estado === 'Activo' ? 'red' : 'green'} />
                    <Text ta="center">¿Cambiar estado de <b>{equipoStatusPending?.nombre}</b> a {equipoStatusPending?.estado === 'Activo' ? 'Inactivo' : 'Activo'}?</Text>
                    <Textarea 
                        label="Motivo del cambio" 
                        w="100%"
                        value={statusObservation}
                        onChange={(e) => setStatusObservation(e.currentTarget.value)}
                    />
                    <Group grow w="100%">
                        <Button variant="subtle" color="gray" onClick={() => setShowStatusConfirmModal(false)}>Cancelar</Button>
                        <Button color={equipoStatusPending?.estado === 'Activo' ? 'red' : 'green'} onClick={confirmToggleStatus} loading={processingAction}>Confirmar</Button>
                    </Group>
                </Stack>
            </Modal>

            {/* Rejection Reason Modal */}
            <Modal
                opened={showRejectionReasonModal}
                onClose={() => setShowRejectionReasonModal(false)}
                title="Motivo de Rechazo"
                radius="md"
            >
                <Stack gap="md">
                    <Text size="sm">Indique por qué está rechazando esta solicitud/equipo.</Text>
                    <Textarea 
                        label="Feedback / Observaciones" 
                        required 
                        minRows={4}
                        value={localRejectionFeedback}
                        onChange={(e) => setLocalRejectionFeedback(e.currentTarget.value)}
                    />
                    <Group grow mt="lg">
                        <Button variant="subtle" color="gray" onClick={() => setShowRejectionReasonModal(false)}>Cancelar</Button>
                        <Button color="red" onClick={confirmRejectWithFeedback} loading={processingAction}>Confirmar Rechazo</Button>
                    </Group>
                </Stack>
            </Modal>

            <EquipmentExportModal 
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                catalogs={catalogs}
                muestreadores={muestreadorList}
                initialFilters={{
                    tipo: filterTipo || '',
                    sede: filterSede || '',
                    estado: filterEstado || '',
                    fechaDesde: filterFechaDesde,
                    fechaHasta: filterFechaHasta,
                    id_muestreador: filterMuestreador || ''
                }}
            />
        </Container>
    );
};
