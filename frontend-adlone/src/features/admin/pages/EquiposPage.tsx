import React, { useState, useEffect, useMemo } from 'react';
import {
    Typography,
    Button,
    Input,
    Tag,
    Tooltip,
    Select,
    Pagination,
    Modal,
    Alert,
    Spin
} from 'antd';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconPlus,
    IconSearch,
    IconEdit,
    IconPower,
    IconBell,
    IconDownload,
    IconAlertTriangle,
    IconInfoCircle,
    IconTrash,
    IconCheck,
    IconX,
    IconCalendarOff,
    IconUserOff
} from '@tabler/icons-react';

import { equipoService, type Equipo } from '../services/equipo.service';
import { EquipmentExportModal } from '../components/EquipmentExportModal';
import { adminService } from '../../../services/admin.service';
import { ursService } from '../../../services/urs.service';
import { EquipoForm } from '../components/EquipoForm';
import { EquipmentRequestsModal } from '../components/EquipmentRequestsModal';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavStore } from '../../../store/navStore';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import '../admin.css';

const { Text } = Typography;
const { TextArea } = Input;

const getStatusColor = (status: string) => {
    const s = (status || '').toUpperCase().trim();
    switch (s) {
        case 'PENDIENTE':
        case 'PENDIENTE_TECNICA':
        case 'PENDIENTE_CALIDAD': return 'gold';
        case 'EN_REVISION':
        case 'EN_REVISION_TECNICA': return 'cyan';
        case 'ACEPTADA': return 'teal';
        case 'RECHAZADA':
        case 'RECHAZADO_TECNICA': return 'red';
        case 'REALIZADA': return 'blue';
        default: return 'default';
    }
};

interface Props {
    onBack: () => void;
}

const parseDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    // Handle dd/MM/yyyy format (e.g. "30/06/2026")
    const ddmmyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = dateStr.match(ddmmyyyyPattern);
    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // 0-indexed month
        const year = parseInt(match[3], 10);
        const date = new Date(year, month, day);
        return isNaN(date.getTime()) ? null : date;
    }
    // Fallback to ISO / standard format
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
};

const isDateExpiringSoon = (dateStr?: string): boolean => {
    const d = parseDate(dateStr);
    if (!d) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30Days = new Date(today);
    in30Days.setDate(today.getDate() + 30);
    return d.getTime() >= today.getTime() && d.getTime() <= in30Days.getTime();
};

const isDateExpired = (dateStr?: string): boolean => {
    const d = parseDate(dateStr);
    if (!d) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
};

// Grid helpers (replace Mantine Grid/Grid.Col)
const gridRowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16, width: '100%' };

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
    const [showRequestsModal, setShowRequestsModal] = useState(false);
    const [requestsEquipoInfo, setRequestsEquipoInfo] = useState<{ id: string | number; nombre: string; codigo?: string } | null>(null);

    const { showToast } = useToast();
    const { hasPermission } = useAuth();
    const isMobile = useMediaQuery('(max-width: 768px)');

    // Permissions — RB-08: AI_MA_ADMIN_ACCESO eliminado
    const isMAMan = hasPermission('AI_MA_SOLICITUDES') || hasPermission('MA_A_GEST_EQUIPO');
    const canCreateEquipo = hasPermission('AI_MA_CREAR_EQUIPO');
    const canEditEquipo = hasPermission('AI_MA_EDITAR_EQUIPO');
    const isSuper = false;

    // --- Table & Filters State ---
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [allEquipos, setAllEquipos] = useState<Equipo[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [localSearchTerm, setLocalSearchTerm] = useState('');

    const associatedActiveEquipos = useMemo(() => {
        if (!equipoStatusPending || equipoStatusPending.estado !== 'Activo') return [];
        return allEquipos.filter(e =>
            e.estado === 'Activo' &&
            String(e.equipo_asociado).trim().toLowerCase() === String(equipoStatusPending.codigo).trim().toLowerCase() &&
            e.id_equipo !== equipoStatusPending.id_equipo
        );
    }, [equipoStatusPending, allEquipos]);

    const associatedActiveEquiposBaja = useMemo(() => {
        if (!equipoBajaPending) return [];
        const fullEquipo = allEquipos.find(e => String(e.id_equipo) === String(equipoBajaPending.id));
        const codigo = fullEquipo?.codigo || equipoBajaPending.datos_json?.codigo;
        if (!codigo) return [];
        return allEquipos.filter(e =>
            e.estado === 'Activo' &&
            String(e.equipo_asociado).trim().toLowerCase() === String(codigo).trim().toLowerCase() &&
            String(e.id_equipo) !== String(equipoBajaPending.id)
        );
    }, [equipoBajaPending, allEquipos]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setSearchTerm(localSearchTerm);
        }, 400);
        return () => clearTimeout(timer);
    }, [localSearchTerm]);

    const [filterTipo, setFilterTipo] = useState<string | null>(null);
    const [filterSede, setFilterSede] = useState<string | null>(null);
    const [filterEstado, setFilterEstado] = useState<string | null>(null);
    const [filterMuestreador, setFilterMuestreador] = useState<string | null>(null);
    const [filterFechaDesde, setFilterFechaDesde] = useState('');
    const [filterFechaHasta, setFilterFechaHasta] = useState('');

    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [expiringCount, setExpiringCount] = useState(0);
    const [expiredCount, setExpiredCount] = useState(0);
    const [inactiveSamplerCount, setInactiveSamplerCount] = useState(0);
    const [filterExpired, setFilterExpired] = useState(false);
    const [filterInactiveSampler, setFilterInactiveSampler] = useState(false);
    const [expiringAlertDismissed, setExpiringAlertDismissed] = useState(false);
    const [muestreadorList, setMuestreadorList] = useState<any[]>([]);

    const formatLocalDate = (date: Date): string => {
        const offset = date.getTimezoneOffset();
        const localDate = new Date(date.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    };

    const todayStr = useMemo(() => formatLocalDate(new Date()), []);
    const in30Str = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return formatLocalDate(d);
    }, []);

    const isPorVencerActive = useMemo(() => {
        return filterFechaDesde === todayStr && filterFechaHasta === in30Str && !filterExpired && !filterInactiveSampler;
    }, [filterFechaDesde, filterFechaHasta, todayStr, in30Str, filterExpired, filterInactiveSampler]);

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
                const msRes = await adminService.getMuestreadores('', '');
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
        setPage(1);
    }, [searchTerm, filterTipo, filterSede, filterEstado, filterMuestreador, filterFechaDesde, filterFechaHasta, filterExpired, filterInactiveSampler]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchData();
        }, 300);
        return () => clearTimeout(delayDebounceFn);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, filterTipo, filterSede, filterEstado, searchTerm, filterFechaDesde, filterFechaHasta, filterMuestreador, filterExpired, filterInactiveSampler]);

    // Notification handling from NavStore
    useEffect(() => {
        if (pendingRequestId && solicitudesRealizadas.length > 0) {
            const sol = solicitudesRealizadas.find(s => s.id_solicitud === pendingRequestId);
            if (sol) {
                handleNotificationClick(sol);
                setPendingRequestId(null);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pendingRequestId, solicitudesRealizadas]);

    // Date pre-filling for reactivation
    useEffect(() => {
        if (showConfirmAltaModal) {
            if (equipoAltaPending?.datos_json?.motivo) {
                const motive = equipoAltaPending.datos_json.motivo;
                const code = equipoAltaPending.codigo;
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
    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
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
                id_muestreador: filterMuestreador || '',
                expiredOnly: filterExpired,
                inactiveSamplerOnly: filterInactiveSampler,
                sortBy: 'vigencia'
            };
            const response = await equipoService.getEquipos(params);
            if (response) {
                setEquipos(response.data || []);
                // Fetch all equipments asynchronously for active association warnings
                equipoService.getEquipos({ limit: 5000 }).then(res => {
                    if (res && res.data) {
                        setAllEquipos(res.data);
                    }
                }).catch(err => console.error("Error fetching all equipments for association checks", err));

                setTotalPages(response.totalPages || 1);
                setTotalItems(response.total || 0);
                setExpiringCount(response.expiringCount ?? 0);
                setExpiredCount(response.expiredCount ?? 0);
                setInactiveSamplerCount(response.inactiveSamplerCount ?? 0);
                setExpiringAlertDismissed(false);
                if (response.catalogs) {
                    setCatalogs(response.catalogs);
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
            // Load all active states so sort covers both pending and accepted solicitudes
            const [legacyAceptada, legacyPendiente, ursAceptada, ursPendiente, ursEnRevision] = await Promise.all([
                adminService.getSolicitudes({ estado: 'ACEPTADA' }).catch(() => []),
                adminService.getSolicitudes({ estado: 'PENDIENTE' }).catch(() => []),
                ursService.getRequests({ estado: 'ACEPTADA' }).catch(() => []),
                ursService.getRequests({ estado: 'PENDIENTE' }).catch(() => []),
                ursService.getRequests({ estado: 'EN_REVISION' }).catch(() => []),
            ]);

            // URS solicitudes: accept all (matching by id_equipo in getPendingRequestsForEquipo is the real guard)
            // Legacy solicitudes: filter by modulo/type keywords since they don't use id_equipo the same way
            const ursAll = [
                ...(Array.isArray(ursAceptada) ? ursAceptada : []),
                ...(Array.isArray(ursPendiente) ? ursPendiente : []),
                ...(Array.isArray(ursEnRevision) ? ursEnRevision : []),
            ];
            const legacyAll = [
                ...(Array.isArray(legacyAceptada) ? legacyAceptada : []),
                ...(Array.isArray(legacyPendiente) ? legacyPendiente : []),
            ].filter((s: any) => {
                if (s.modulo_destino === 'EQUIPOS') return true;
                const tipoRaw = (s.tipo_solicitud || '').toUpperCase();
                return tipoRaw.includes('EQUIPO') || tipoRaw.includes('TRASPASO') ||
                       tipoRaw.includes('BAJA') || tipoRaw.includes('ALTA') ||
                       tipoRaw.includes('MUESTREADOR') || tipoRaw.includes('REVISI');
            });

            // Merge and deduplicate by id_solicitud
            const seen = new Set<number>();
            const filteredData = [...ursAll, ...legacyAll].filter((s: any) => {
                const id = s.id_solicitud;
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
            });

            setSolicitudesRealizadas(filteredData);
        } catch (error) {
            console.error("Error loading solicitudes:", error);
        }
    };

    // --- Handlers ---
    const handleNotificationClick = async (sol: any) => {
        const type = sol.tipo_solicitud || sol.nombre_tipo || '';
        const isCreation = type === 'NUEVO_EQUIPO' || (type === 'ALTA' && !sol.datos_json?.isReactivation);
        if (isCreation) {
            setSelectedEquipo({
                ...sol.datos_json,
                id_equipo: undefined,
                requestId: sol.id_solicitud,
                requestStatus: sol.estado
            } as Equipo);
            setViewMode('form');
        } else {
            setReviewSolicitud(sol);
        }
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
                    });
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
                    } as Equipo);
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
                    });
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
        const solicitudId = equipoAltaPending.id_solicitud;
        if (!solicitudId) {
            showToast({ type: 'error', message: 'No se encontró el ID de la solicitud asociada' });
            return;
        }
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

            const currentSol = { id_solicitud: solicitudId, datos_json: equipoAltaPending.datos_json };
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


    const [solicitudHistorial, setSolicitudHistorial] = useState<any[]>([]);
    const [loadingHistorial, setLoadingHistorial] = useState(false);

    useEffect(() => {
        const fetchHistorial = async () => {
            if (reviewSolicitud?.id_solicitud) {
                setLoadingHistorial(true);
                try {
                    const res = await adminService.getSolicitudHistorial(reviewSolicitud.id_solicitud);
                    setSolicitudHistorial(res.data || []);
                } catch {
                    showToast({ type: 'error', message: 'No se pudo cargar el historial de la solicitud' });
                } finally {
                    setLoadingHistorial(false);
                }
            } else {
                setSolicitudHistorial([]);
            }
        };
        fetchHistorial();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reviewSolicitud]);

    const handleClearFilters = () => {
        setLocalSearchTerm('');
        setSearchTerm('');
        setFilterTipo(null);
        setFilterSede(null);
        setFilterEstado(null);
        setFilterMuestreador(null);
        setFilterFechaDesde('');
        setFilterFechaHasta('');
        setFilterExpired(false);
        setFilterInactiveSampler(false);
        setPage(1);
    };

    // --- Helper Logic ---
    const getTipoLabelDisplay = (sol: any) => {
        const type = (sol.tipo_solicitud || sol.nombre_tipo || '');
        if (type === 'ALTA') return sol.datos_json?.isReactivation ? 'Activación' : 'Creación';
        if (['NUEVO_EQUIPO', 'BAJA', 'TRASPASO', 'VIGENCIA_PROXIMA', 'REPORTE_PROBLEMA', 'REVISION', 'EQUIPO_PERDIDO', 'EQUIPO_DESHABILITADO', 'BAJA_EQUIPO', 'TRASPASO_EQUIPO'].includes(type) || type.toUpperCase().includes('EQUIPO')) {
            return type.replace(/_/g, ' ');
        }
        return type;
    };

    const getPendingRequestsForEquipo = (id: number) => {
        return solicitudesRealizadas.filter(sol => {
            const d = sol.datos_json || {};
            const typeRaw = (sol.tipo_solicitud || sol.nombre_tipo || '').toUpperCase();
            const formType = (d._form_type || '').toUpperCase();

            // Check direct id_equipo
            if (String(d.id_equipo) === String(id)) return true;
            if (String(d.id_equipo_original) === String(id)) return true;

            // Special cases for bulk or specific types
            if ((typeRaw.includes('TRASPASO') || formType.includes('TRASPASO')) && String(d.id_equipo || d.id_equipo_original) === String(id)) return true;
            if (typeRaw.includes('BAJA') || formType.includes('BAJA')) {
                if (d.equipos_baja?.some((eb: any) => String(eb.id) === String(id))) return true;
                if (String(d.id_equipo || d.id_equipo_original) === String(id)) return true;
            }
            if ((typeRaw.includes('ALTA') || formType.includes('ALTA')) && (d.isReactivation || typeRaw.includes('REACTIVACION') || formType.includes('REACTIVACION'))) {
                if (d.equipos_alta?.some((ea: any) => String(ea.id) === String(id))) return true;
                if (String(d.id_equipo_original || d.id_equipo) === String(id)) return true;
            }

            // Include other types that might reference an equipment
            const typeMatched = ['EQUIPO_PERDIDO', 'REPORTE_PROBLEMA', 'REVISION', 'EQUIPO_DESHABILITADO', 'VIGENCIA_PROXIMA'];
            if (typeMatched.some(t => typeRaw.includes(t) || formType.includes(t)) || typeRaw.includes('REVISI')) {
                if (String(d.id_equipo) === String(id) || String(d.id_equipo_original) === String(id)) return true;
            }

            return false;
        });
    };

    const hasActiveFilters = useMemo(() =>
        searchTerm !== '' || filterTipo || filterSede || filterEstado || filterMuestreador || filterFechaDesde || filterFechaHasta || filterExpired || filterInactiveSampler,
    [searchTerm, filterTipo, filterSede, filterEstado, filterMuestreador, filterFechaDesde, filterFechaHasta, filterExpired, filterInactiveSampler]);

    // Equipos con solicitudes pendientes aparecen primero; luego los que vencen pronto (más cercano primero)
    const sortedEquipos = useMemo(() => {
        return [...equipos].sort((a, b) => {
            const aAlert = getPendingRequestsForEquipo(a.id_equipo).length > 0 ? 2 : 0;
            const bAlert = getPendingRequestsForEquipo(b.id_equipo).length > 0 ? 2 : 0;
            const aExp = (isDateExpiringSoon(a.vigencia) || isDateExpired(a.vigencia)) ? 1 : 0;
            const bExp = (isDateExpiringSoon(b.vigencia) || isDateExpired(b.vigencia)) ? 1 : 0;
            const priorityDiff = (bAlert + bExp) - (aAlert + aExp);
            if (priorityDiff !== 0) return priorityDiff;
            // Mismo nivel de prioridad: ordenar por fecha de vigencia ascendente (vence antes = primero)
            const aDate = parseDate(a.vigencia)?.getTime() ?? Infinity;
            const bDate = parseDate(b.vigencia)?.getTime() ?? Infinity;
            return aDate - bDate;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [equipos, solicitudesRealizadas]);

    // --- Render Logic ---
    if (viewMode === 'form') {
        return (
            <div style={{ padding: 24, width: '100%' }}>
                <EquipoForm
                    initialData={selectedEquipo}
                    onCancel={() => setViewMode('list')}
                    onSave={() => { setViewMode('list'); fetchData(); loadSolicitudes(); }}
                    pendingRequests={selectedEquipo ? getPendingRequestsForEquipo(selectedEquipo.id_equipo) : []}
                    onRefreshSolicitudes={() => { loadSolicitudes(); fetchData(); }}
                />
            </div>
        );
    }

    return (
        <div style={{ padding: 24, width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {expiringCount > 0 && !expiringAlertDismissed && (
                    <Alert
                        showIcon
                        icon={<IconAlertTriangle size={20} />}
                        message="Atención: Equipos por Vencer"
                        type="warning"
                        closable
                        onClose={() => setExpiringAlertDismissed(true)}
                        description={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: 12 }}>
                                <Text style={{ fontSize: 13 }}>
                                    Hay <b>{expiringCount}</b> equipo{expiringCount !== 1 ? 's' : ''} que vence{expiringCount === 1 ? '' : 'n'} en los próximos 30 días.
                                </Text>
                                <Button
                                    size="small"
                                    type="primary"
                                    style={{ flexShrink: 0, backgroundColor: '#e8590c', borderColor: '#e8590c' }}
                                    onClick={() => {
                                        setFilterFechaDesde(todayStr);
                                        setFilterFechaHasta(in30Str);
                                        setFilterEstado('Activo');
                                        setFilterExpired(false);
                                        setFilterInactiveSampler(false);
                                        setPage(1);
                                    }}
                                >
                                    Ver equipos
                                </Button>
                            </div>
                        }
                    />
                )}

                <PageHeader
                    title="Gestión de Equipos"
                    subtitle="Administra y supervisa los equipos de medición del sistema."
                    onBack={onBack}
                    rightSection={
                        <>
                            <ProtectedContent permission="EQ_EXP">
                                <Button
                                    danger
                                    icon={<IconDownload size={18} />}
                                    onClick={() => setShowExportModal(true)}
                                    size={isMobile ? "small" : "middle"}
                                    style={{ flex: isMobile ? 1 : 'auto' }}
                                >
                                    Exportar EQ
                                </Button>
                            </ProtectedContent>

                            <ProtectedContent permission="AI_MA_CREAR_EQUIPO">
                                <Button
                                    type="primary"
                                    icon={<IconPlus size={18} />}
                                    onClick={() => { setSelectedEquipo(null); setViewMode('form'); }}
                                    size={isMobile ? "small" : "middle"}
                                    style={{ flex: isMobile ? 1 : 'auto' }}
                                >
                                    Nuevo {isMobile ? '' : 'Equipo'}
                                </Button>
                            </ProtectedContent>
                        </>
                    }
                />

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', width: '100%' }}>
                    <div
                        className={`kpi-card-por-vencer ${isPorVencerActive ? 'active' : ''}`}
                        style={{
                            flex: '1 1 280px',
                            minWidth: '250px',
                            border: '1px solid var(--app-border)',
                            borderRadius: 8,
                            padding: 16,
                            cursor: 'pointer'
                        }}
                        onClick={() => {
                            if (isPorVencerActive) {
                                setFilterFechaDesde('');
                                setFilterFechaHasta('');
                                setFilterEstado(null);
                            } else {
                                setFilterFechaDesde(todayStr);
                                setFilterFechaHasta(in30Str);
                                setFilterEstado('Activo');
                                setFilterExpired(false);
                                setFilterInactiveSampler(false);
                            }
                            setPage(1);
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'center' }}>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Por Vencer (30 días)</Text>
                                <Text strong style={{ fontSize: 22 }}>{expiringCount}</Text>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 42,
                                    height: 42,
                                    borderRadius: 8,
                                    backgroundColor: '#fff4e6',
                                    color: '#e8590c',
                                    flexShrink: 0
                                }}
                            >
                                <IconAlertTriangle size={24} />
                            </div>
                        </div>
                    </div>

                    <div
                        className={`kpi-card-activos-vencidos ${filterExpired ? 'active' : ''}`}
                        style={{
                            flex: '1 1 280px',
                            minWidth: '250px',
                            border: '1px solid var(--app-border)',
                            borderRadius: 8,
                            padding: 16,
                            cursor: 'pointer'
                        }}
                        onClick={() => {
                            const nextVal = !filterExpired;
                            setFilterExpired(nextVal);
                            if (nextVal) {
                                setFilterEstado('Activo');
                            } else {
                                setFilterEstado(null);
                            }
                            setFilterInactiveSampler(false);
                            setFilterFechaDesde('');
                            setFilterFechaHasta('');
                            setPage(1);
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'center' }}>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Activos con vigencia vencida</Text>
                                <Text strong style={{ fontSize: 22 }}>{expiredCount}</Text>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 42,
                                    height: 42,
                                    borderRadius: 8,
                                    backgroundColor: '#fff5f5',
                                    color: '#e03131',
                                    flexShrink: 0
                                }}
                            >
                                <IconCalendarOff size={24} />
                            </div>
                        </div>
                    </div>

                    <div
                        className={`kpi-card-muestreadores-vencidos ${filterInactiveSampler ? 'active' : ''}`}
                        style={{
                            flex: '1 1 280px',
                            minWidth: '250px',
                            border: '1px solid var(--app-border)',
                            borderRadius: 8,
                            padding: 16,
                            cursor: 'pointer'
                        }}
                        onClick={() => {
                            const nextVal = !filterInactiveSampler;
                            setFilterInactiveSampler(nextVal);
                            setFilterEstado(null);
                            setFilterExpired(false);
                            setFilterFechaDesde('');
                            setFilterFechaHasta('');
                            setPage(1);
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'center' }}>
                            <div>
                                <Text type="secondary" style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Equipos con muestreadores vencidos</Text>
                                <Text strong style={{ fontSize: 22 }}>{inactiveSamplerCount}</Text>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 42,
                                    height: 42,
                                    borderRadius: 8,
                                    backgroundColor: '#f3e8fd',
                                    color: '#9c36b5',
                                    flexShrink: 0
                                }}
                            >
                                <IconUserOff size={24} />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 16 }}>
                    <div style={{ ...gridRowStyle, alignItems: 'flex-end' }}>
                        <div style={{ gridColumn: isMobile ? 'span 12' : 'span 3' }}>
                            <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Buscar</Text>
                            <Input
                                placeholder="Nombre o código..."
                                prefix={<IconSearch size={16} />}
                                value={localSearchTerm}
                                onChange={(e) => setLocalSearchTerm(e.currentTarget.value)}
                            />
                        </div>
                        <div style={{ gridColumn: isMobile ? 'span 6' : 'span 2' }}>
                            <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Tipo</Text>
                            <Select
                                placeholder="Todos"
                                options={['Todos', ...catalogs.tipos].map(t => ({ value: t, label: t }))}
                                value={filterTipo ?? 'Todos'}
                                onChange={v => setFilterTipo(v === 'Todos' ? null : v)}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div style={{ gridColumn: isMobile ? 'span 6' : 'span 2' }}>
                            <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Sede</Text>
                            <Select
                                placeholder="Todas"
                                options={['Todos', ...catalogs.sedes].map(t => ({ value: t, label: t }))}
                                value={filterSede ?? 'Todos'}
                                onChange={v => setFilterSede(v === 'Todos' ? null : v)}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div style={{ gridColumn: isMobile ? 'span 6' : 'span 2' }}>
                            <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Estado</Text>
                            <Select
                                placeholder="Todos"
                                options={['Todos', ...catalogs.estados].map(t => ({ value: t, label: t }))}
                                value={filterEstado ?? 'Todos'}
                                onChange={v => {
                                    const nextEstado = v === 'Todos' ? null : v;
                                    setFilterEstado(nextEstado);
                                    if (nextEstado !== 'Activo') {
                                        setFilterExpired(false);
                                        setFilterInactiveSampler(false);
                                    }
                                }}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div style={{ gridColumn: isMobile ? 'span 6' : 'span 3' }}>
                            <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Responsable</Text>
                            <Select
                                placeholder="Todos"
                                options={muestreadorList.map(m => ({
                                    value: String(m.id_muestreador),
                                    label: m.habilitado === 'N' || m.habilitado === false
                                        ? `${m.nombre_muestreador} (Inactivo)`
                                        : m.nombre_muestreador
                                }))}
                                value={filterMuestreador ?? undefined}
                                onChange={v => setFilterMuestreador(v || null)}
                                allowClear
                                showSearch
                                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div style={{ gridColumn: isMobile ? 'span 12' : 'span 4' }}>
                            <div style={{ display: 'flex', gap: 5 }}>
                                <div style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Vigencia</Text>
                                    <Input
                                        type="date"
                                        value={filterFechaDesde}
                                        onChange={(e) => {
                                            setFilterFechaDesde(e.target.value);
                                            setFilterExpired(false);
                                            setFilterInactiveSampler(false);
                                        }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>&nbsp;</Text>
                                    <Input
                                        type="date"
                                        value={filterFechaHasta}
                                        onChange={(e) => {
                                            setFilterFechaHasta(e.target.value);
                                            setFilterExpired(false);
                                            setFilterInactiveSampler(false);
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                        {hasActiveFilters && (
                            <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'flex-end' }}>
                                <Button danger type="text" icon={<IconX size={16} />} onClick={handleClearFilters}>
                                    Limpiar
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
                    {loading && (
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.6)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Spin size="large" />
                        </div>
                    )}
                    <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ backgroundColor: 'var(--app-hover-bg)' }}>
                                <tr>
                                    <th style={{ width: 40, padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--app-border)' }}>Alerta</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--app-border)' }}>Código</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--app-border)' }}>Nombre</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--app-border)' }}>Tipo</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--app-border)' }}>Sede</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--app-border)' }}>Estado</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--app-border)' }}>Vigencia</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--app-border)' }}>Responsable</th>
                                    <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '1px solid var(--app-border)' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {equipos.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} style={{ textAlign: 'center', padding: '32px 0' }}>
                                            <Text type="secondary">No se encontraron equipos.</Text>
                                        </td>
                                    </tr>
                                ) : (
                                    sortedEquipos.map(equipo => {
                                        const isInactive = equipo.estado?.toLowerCase() === 'inactivo';
                                        const pendingRequests = getPendingRequestsForEquipo(equipo.id_equipo);
                                        const hasAccepted = pendingRequests.some(req => req.estado === 'ACEPTADA');

                                        const expiringSoon = isDateExpiringSoon(equipo.vigencia);
                                        const expired = isDateExpired(equipo.vigencia);

                                        return (
                                            <tr key={equipo.id_equipo} style={{ borderBottom: '1px solid var(--app-border)' }}>
                                                <td style={{ padding: '10px 12px' }}>
                                                    {hasAccepted && (
                                                        <Tooltip title="Contiene solicitudes aceptadas listas para ejecutarse. Clic para abrirlas.">
                                                            <Button
                                                                type="text"
                                                                size="small"
                                                                style={{ color: '#e8590c' }}
                                                                icon={<IconAlertTriangle size={14} />}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setRequestsEquipoInfo({ id: equipo.id_equipo, nombre: equipo.nombre, codigo: equipo.codigo });
                                                                    setShowRequestsModal(true);
                                                                }}
                                                            />
                                                        </Tooltip>
                                                    )}
                                                </td>
                                                <td style={{ padding: '10px 12px' }}>
                                                    <Text strong style={{ fontSize: 13, color: '#1864ab', whiteSpace: 'nowrap' }}>
                                                        {equipo.codigo || 'S/N'}
                                                    </Text>
                                                </td>
                                                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{equipo.nombre}</td>
                                                <td style={{ padding: '10px 12px' }}>{equipo.tipo}</td>
                                                <td style={{ padding: '10px 12px' }}>{equipo.ubicacion}</td>
                                                <td style={{ padding: '10px 12px' }}>
                                                    <Tag color={isInactive ? 'red' : 'green'}>
                                                        {equipo.estado}
                                                    </Tag>
                                                </td>
                                                <td style={{ padding: '10px 12px' }}>
                                                    <Text
                                                        style={{
                                                            fontSize: 13,
                                                            color: expired ? '#c92a2a' : expiringSoon ? '#e8590c' : 'inherit',
                                                            fontWeight: expired || expiringSoon ? 700 : 400
                                                        }}
                                                    >
                                                        {equipo.vigencia}
                                                    </Text>
                                                </td>
                                                <td style={{ padding: '10px 12px' }}>
                                                    {equipo.nombre_asignado ? (
                                                        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'nowrap' }}>
                                                            <Text style={{ fontSize: 13 }}>{equipo.nombre_asignado}</Text>
                                                            {equipo.habilitado_muestreador === 'N' && (
                                                                <Tag color="red">Inactivo</Tag>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        '---'
                                                    )}
                                                </td>
                                                <td style={{ padding: '10px 12px' }}>
                                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                        <ProtectedContent permission="AI_MA_EDITAR_EQUIPO">
                                                            <Tooltip title="Editar">
                                                                <Button
                                                                    type="text"
                                                                    size="small"
                                                                    icon={<IconEdit size={18} />}
                                                                    onClick={() => handleEdit(equipo)}
                                                                    disabled={!canEditEquipo}
                                                                />
                                                            </Tooltip>
                                                        </ProtectedContent>
                                                        <ProtectedContent permission={isInactive ? "EQ_ACTIVAR" : "EQ_DESACTIVAR"}>
                                                            <Tooltip title={isInactive ? 'Activar' : 'Desactivar'}>
                                                                <Button
                                                                    type="text"
                                                                    size="small"
                                                                    style={{ color: isInactive ? '#2f9e44' : '#e03131' }}
                                                                    icon={<IconPower size={18} />}
                                                                    onClick={() => handleToggleStatus(equipo)}
                                                                    disabled={!canEditEquipo}
                                                                />
                                                            </Tooltip>
                                                        </ProtectedContent>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ borderTop: '1px solid var(--app-border)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: 16, flexWrap: isMobile ? 'wrap' : 'nowrap', gap: 12 }}>
                        <Text style={{ fontSize: 12 }} type="secondary">
                            {isMobile ? `${totalItems} eq.` : `${totalItems} equipos en total`}
                        </Text>
                        <Pagination
                            total={totalPages * limit}
                            pageSize={limit}
                            current={page}
                            onChange={setPage}
                            size={isMobile ? "small" : undefined}
                            showSizeChanger={false}
                            simple={isMobile}
                        />
                    </div>
                </div>
            </div>

            {/* --- Modals Area --- */}

            {/* Review Solicitud Modal */}
            <Modal
                open={!!reviewSolicitud}
                onCancel={() => setReviewSolicitud(null)}
                title={
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', flex: 1, paddingRight: 24 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <IconBell size={20} color="#1c7ed6" />
                            <Text strong>Revisar Solicitud de {reviewSolicitud && getTipoLabelDisplay(reviewSolicitud)}</Text>
                        </div>
                        {reviewSolicitud && (
                            <Tag color={getStatusColor(reviewSolicitud.estado)}>
                                {reviewSolicitud.estado.replace(/_/g, ' ')}
                            </Tag>
                        )}
                    </div>
                }
                width={700}
                footer={null}
            >
                <div style={{ position: 'relative' }}>
                    {(processingAction || loadingHistorial) && (
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.6)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Spin size="large" />
                        </div>
                    )}
                    {reviewSolicitud && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 16, backgroundColor: 'var(--app-hover-bg)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div>
                                        <Text style={{ fontSize: 12, fontWeight: 700 }} type="secondary">Solicitante</Text>
                                        <Text strong style={{ fontSize: 13, display: 'block' }}>{reviewSolicitud.nombre_solicitante}</Text>
                                    </div>
                                    <div>
                                        <Text style={{ fontSize: 12, fontWeight: 700 }} type="secondary">Fecha</Text>
                                        <Text style={{ fontSize: 13, display: 'block' }}>{new Date(reviewSolicitud.fecha_solicitud).toLocaleString()}</Text>
                                    </div>
                                </div>
                            </div>

                            {solicitudHistorial.length > 0 && (
                                <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 16 }}>
                                    <Text style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }} type="secondary">
                                        <IconInfoCircle size={14} /> HISTORIAL DE ACCIONES
                                    </Text>
                                    <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                            {solicitudHistorial.map((h, i) => (
                                                <div key={i} style={{ padding: 5, borderBottom: i < solicitudHistorial.length - 1 ? '1px solid var(--app-border)' : 'none' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Tag color={h.accion === 'APROBADO' ? 'green' : h.accion === 'RECHAZADO' ? 'red' : 'blue'}>
                                                            {h.accion}
                                                        </Tag>
                                                        <Text style={{ fontSize: 11 }} type="secondary">{new Date(h.fecha_accion).toLocaleString()}</Text>
                                                    </div>
                                                    <Text style={{ fontSize: 12, fontWeight: 600, marginTop: 2, display: 'block' }}>{h.nombre_usuario || 'Sistema'}</Text>
                                                    <Text style={{ fontSize: 12, fontStyle: 'italic' }}>{h.observacion || 'Sin observación'}</Text>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Special case for BULK BAJA/ALTA */}
                            {((reviewSolicitud.tipo_solicitud === 'BAJA' && reviewSolicitud.datos_json?.equipos_baja) ||
                              (reviewSolicitud.tipo_solicitud === 'ALTA' && reviewSolicitud.datos_json?.isReactivation && reviewSolicitud.datos_json?.equipos_alta)) ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text strong style={{ fontSize: 13 }}>Equipos involucrados</Text>
                                        <Button
                                            size="small"
                                            style={reviewSolicitud.tipo_solicitud === 'BAJA' ? { color: '#e03131', borderColor: '#ffc9c9' } : { color: '#2f9e44', borderColor: '#b2f2bb' }}
                                            onClick={reviewSolicitud.tipo_solicitud === 'BAJA' ? handleApproveAllBaja : handleApproveAllAlta}
                                        >
                                            Procesar Todo
                                        </Button>
                                    </div>
                                    <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {(reviewSolicitud.datos_json.equipos_baja || reviewSolicitud.datos_json.equipos_alta).map((eq: any) => (
                                                <div key={eq.id} style={{ border: '1px solid var(--app-border)', borderRadius: 6, padding: 8, backgroundColor: eq.procesado ? 'var(--app-hover-bg)' : 'transparent' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <Text strong style={{ fontSize: 13, textDecoration: eq.procesado ? 'line-through' : 'none', display: 'block' }}>{eq.nombre}</Text>
                                                            <Text style={{ fontSize: 12 }} type="secondary">{eq.codigo || eq.datos_originales?.codigo}</Text>
                                                            {eq.vigencia && <Text style={{ fontSize: 12, color: '#2f9e44', fontWeight: 700, display: 'block' }}>Propuesta: {eq.vigencia}</Text>}
                                                        </div>
                                                        {!eq.procesado ? (
                                                            <div style={{ display: 'flex', gap: 5 }}>
                                                                <Button
                                                                    size="small"
                                                                    type="primary"
                                                                    style={reviewSolicitud.tipo_solicitud === 'BAJA' ? { backgroundColor: '#e03131', borderColor: '#e03131' } : { backgroundColor: '#2f9e44', borderColor: '#2f9e44' }}
                                                                    onClick={() => {
                                                                        if (reviewSolicitud.tipo_solicitud === 'BAJA') {
                                                                            setEquipoBajaPending({ ...eq, id_solicitud: reviewSolicitud.id_solicitud, datos_json: reviewSolicitud.datos_json });
                                                                            setShowConfirmBajaModal(true);
                                                                        } else {
                                                                            setEquipoAltaPending({ id: String(eq.id), nombre: eq.nombre || '', codigo: eq.codigo || '', originalId: Number(eq.id), datos_json: reviewSolicitud.datos_json, id_solicitud: reviewSolicitud.id_solicitud, vigencia_propuesta: eq.vigencia });
                                                                            setReactivationVigencia(eq.vigencia || '');
                                                                            setShowConfirmAltaModal(true);
                                                                        }
                                                                    }}
                                                                >
                                                                    Aprobar
                                                                </Button>
                                                                <Button danger size="small" onClick={() => handleOpenIndividualRejection(eq, reviewSolicitud.tipo_solicitud as 'ALTA' | 'BAJA')}>
                                                                    Rechazar
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Tag color={eq.rechazado ? 'red' : 'green'}>{eq.rechazado ? 'RECHAZADO' : 'PROCESADO'}</Tag>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : reviewSolicitud.tipo_solicitud === 'EQUIPO_PERDIDO' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <Alert type="error" showIcon icon={<IconAlertTriangle size={18} />} message="Reporte de Pérdida / Extravío" description={
                                        <>Indica {reviewSolicitud.datos_json?.tipo_perdida} ocurrido el {reviewSolicitud.datos_json?.fecha_incidente}.</>
                                    } />
                                    <div style={{ border: '1px solid var(--app-border)', borderRadius: 6, padding: 16 }}>
                                        <Text style={{ fontSize: 12, fontWeight: 700, marginBottom: 5, display: 'block' }} type="secondary">CIRCUNSTANCIAS</Text>
                                        <Text style={{ fontSize: 13 }}>{reviewSolicitud.datos_json?.circunstancias || 'No detalladas'}</Text>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ maxHeight: 350, overflowY: 'auto' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {Object.entries(reviewSolicitud.datos_json || {}).map(([key, val]) => {
                                            if (!val || ['equipos_baja', 'equipos_alta', 'isReactivation', 'id_muestreador', 'id_equipo_original'].includes(key)) return null;
                                            if (key === 'archivo_adjunto') return (
                                                <div key={key} style={{ marginTop: 8 }}>
                                                    <Text style={{ fontSize: 12, fontWeight: 700 }} type="secondary">Archivo Adjunto:</Text>
                                                    <div style={{ border: '1px solid var(--app-border)', marginTop: 5, padding: 4, borderRadius: 6 }}>
                                                        <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:8002'}${val}`}
                                                             style={{ width: '100%', maxHeight: 200, objectFit: 'contain' }} alt="adjunto" />
                                                    </div>
                                                </div>
                                            );
                                            return (
                                                <div key={key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Text style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }} type="secondary">{key.replace(/_/g, ' ')}:</Text>
                                                    <Text strong style={{ fontSize: 13 }}>{String(val)}</Text>
                                                </div>
                                            );
                                        })}
                                        {reviewSolicitud.feedback_admin && (
                                            <Alert type="warning" showIcon style={{ marginTop: 16 }} message="Observación Técnica" description={reviewSolicitud.feedback_admin} />
                                        )}
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
                                <Button onClick={() => setReviewSolicitud(null)}>Cerrar</Button>

                                {(reviewSolicitud.estado === 'PENDIENTE' || reviewSolicitud.estado === 'PENDIENTE_TECNICA' || reviewSolicitud.estado === 'PENDIENTE_CALIDAD') && (
                                    <>
                                        {/* RECHAZAR - Always available for pending states */}
                                        <Button
                                            danger
                                            icon={<IconX size={16} />}
                                            onClick={() => {
                                                setRejectionTarget({ type: 'SOLICITUD' });
                                                setLocalRejectionFeedback('');
                                                setShowRejectionReasonModal(true);
                                            }}
                                        >
                                            Rechazar
                                        </Button>

                                        {/* DERIVAR / EN REVISION - Depends on state */}
                                        {reviewSolicitud.estado === 'PENDIENTE_TECNICA' && (isMAMan || isSuper) && (
                                            <Button
                                                type="primary"
                                                style={{ backgroundColor: '#0c8599', borderColor: '#0c8599' }}
                                                onClick={handleApprove}
                                            >
                                                {(reviewSolicitud.tipo_solicitud === 'EQUIPO_PERDIDO' || reviewSolicitud.tipo_solicitud === 'REPORTE_PROBLEMA')
                                                    ? 'En Revisión' : 'Derivar a Calidad'}
                                            </Button>
                                        )}

                                        {/* APROBAR - Primary Action */}
                                        {(reviewSolicitud.estado === 'PENDIENTE' || reviewSolicitud.estado === 'PENDIENTE_CALIDAD') && (
                                            <Button
                                                type="primary"
                                                style={{ backgroundColor: '#2f9e44', borderColor: '#2f9e44' }}
                                                icon={<IconCheck size={16} />}
                                                onClick={handleApprove}
                                            >
                                                {reviewSolicitud.estado === 'PENDIENTE_CALIDAD' ? 'Aprobar Final' : 'Aprobar'}
                                            </Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Confirm Baja Modal */}
            <Modal
                open={showConfirmBajaModal}
                onCancel={() => setShowConfirmBajaModal(false)}
                title="Confirmar Baja / Pérdida"
                centered
                footer={null}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', padding: '16px 0' }}>
                    <IconTrash size={48} color="#e03131" />
                    <Text style={{ textAlign: 'center' }}>¿Estás seguro de dar de baja al equipo <b>{equipoBajaPending?.nombre}</b>?</Text>

                    {associatedActiveEquiposBaja.length > 0 && (
                        <Alert
                            type="warning"
                            showIcon
                            icon={<IconAlertTriangle size={18} />}
                            message="Equipo Asociado Activo"
                            style={{ width: '100%' }}
                            description={
                                <>
                                    <Text style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
                                        <strong>Advertencia:</strong> Este equipo se encuentra configurado como el equipo asociado de los siguientes equipos activos. Al darlo de baja, estas unidades perderán su equipo asociado:
                                    </Text>
                                    <div style={{ maxHeight: 100, overflowY: 'auto', width: '100%' }}>
                                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, textAlign: 'left' }}>
                                            {associatedActiveEquiposBaja.map(e => (
                                                <li key={e.id_equipo}>
                                                    <strong>{e.codigo}</strong> - {e.nombre} ({e.ubicacion})
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </>
                            }
                        />
                    )}

                    {equipoBajaPending?.datos_json?.tipo_solicitud === 'EQUIPO_PERDIDO' && (
                        <div style={{ width: '100%' }}>
                            <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Observación Final de Pérdida *</Text>
                            <TextArea
                                value={bajaObservation}
                                onChange={(e) => setBajaObservation(e.currentTarget.value)}
                                rows={3}
                            />
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, width: '100%', marginTop: 16 }}>
                        <Button style={{ flex: 1 }} onClick={() => setShowConfirmBajaModal(false)}>Cancelar</Button>
                        <Button style={{ flex: 1 }} danger type="primary" onClick={confirmApproveBaja} loading={processingAction}>Confirmar Baja</Button>
                    </div>
                </div>
            </Modal>

            {/* Confirm Alta / Reactivation Modal */}
            <Modal
                open={showConfirmAltaModal}
                onCancel={() => setShowConfirmAltaModal(false)}
                title="Confirmar Reactivación / Vigencia"
                centered
                footer={null}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
                    <Text style={{ textAlign: 'center' }}>Se actualizará el equipo: <b>{equipoAltaPending?.nombre}</b></Text>
                    <div>
                        <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Nueva Fecha de Vigencia *</Text>
                        <Input
                            type="date"
                            value={reactivationVigencia}
                            onChange={(e) => setReactivationVigencia(e.currentTarget.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <Button style={{ flex: 1 }} onClick={() => setShowConfirmAltaModal(false)}>Cancelar</Button>
                        <Button type="primary" style={{ backgroundColor: '#2f9e44', borderColor: '#2f9e44', flex: 1 }} onClick={confirmApproveAlta} loading={processingAction}>Confirmar Actividad</Button>
                    </div>
                </div>
            </Modal>

            {/* Resolution Modal */}
            <Modal
                open={showResolutionModal}
                onCancel={() => setShowResolutionModal(false)}
                title="Resolución Final de Calidad"
                footer={null}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Observación de Calidad *</Text>
                        <TextArea
                            rows={4}
                            placeholder="Escribe la resolución de calidad aquí..."
                            value={resolutionFeedback}
                            onChange={(e) => setResolutionFeedback(e.currentTarget.value)}
                        />
                    </div>
                    {['EQUIPO_DESHABILITADO', 'ALTA'].includes(solicitudInResolution?.tipo_solicitud) && (
                        <div>
                            <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Actualizar Vigencia</Text>
                            <Input
                                type="date"
                                value={resolutionDate}
                                onChange={(e) => setResolutionDate(e.currentTarget.value)}
                            />
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <Button style={{ flex: 1 }} onClick={() => setShowResolutionModal(false)}>Cancelar</Button>
                        <Button style={{ flex: 1, backgroundColor: '#2f9e44', borderColor: '#2f9e44' }} type="primary" onClick={confirmFinalResolution} loading={processingAction}>Aprobar Final</Button>
                    </div>
                </div>
            </Modal>

            {/* Status Confirm Modal */}
            <Modal
                open={showStatusConfirmModal}
                onCancel={() => setShowStatusConfirmModal(false)}
                title={equipoStatusPending?.estado === 'Activo' ? 'Desactivar Equipo' : 'Activar Equipo'}
                centered
                footer={null}
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    <IconPower size={48} color={equipoStatusPending?.estado === 'Activo' ? '#e03131' : '#2f9e44'} />
                    <Text style={{ textAlign: 'center' }}>¿Cambiar estado de <b>{equipoStatusPending?.nombre}</b> a {equipoStatusPending?.estado === 'Activo' ? 'Inactivo' : 'Activo'}?</Text>

                    {associatedActiveEquipos.length > 0 && (
                        <Alert
                            type="warning"
                            showIcon
                            icon={<IconAlertTriangle size={18} />}
                            message="Equipo Asociado Activo"
                            style={{ width: '100%' }}
                            description={
                                <>
                                    <Text style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>
                                        <strong>Advertencia:</strong> Este equipo se encuentra configurado como el equipo asociado de los siguientes equipos activos. Al desactivarlo, quedará inactivo para ellos:
                                    </Text>
                                    <div style={{ maxHeight: 100, overflowY: 'auto', width: '100%' }}>
                                        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11, textAlign: 'left' }}>
                                            {associatedActiveEquipos.map(e => (
                                                <li key={e.id_equipo}>
                                                    <strong>{e.codigo}</strong> - {e.nombre} ({e.ubicacion})
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </>
                            }
                        />
                    )}

                    <div style={{ width: '100%' }}>
                        <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                            Motivo del cambio{equipoStatusPending?.estado === 'Activo' ? ' *' : ''}
                        </Text>
                        <TextArea
                            value={statusObservation}
                            onChange={(e) => setStatusObservation(e.currentTarget.value)}
                            placeholder={equipoStatusPending?.estado === 'Activo' ? "Describa el motivo de la desactivación (obligatorio)..." : "Observaciones..."}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                        <Button style={{ flex: 1 }} onClick={() => setShowStatusConfirmModal(false)}>Cancelar</Button>
                        <Button
                            style={{ flex: 1, backgroundColor: equipoStatusPending?.estado === 'Activo' ? '#e03131' : '#2f9e44', borderColor: equipoStatusPending?.estado === 'Activo' ? '#e03131' : '#2f9e44' }}
                            type="primary"
                            onClick={confirmToggleStatus}
                            loading={processingAction}
                            disabled={equipoStatusPending?.estado === 'Activo' && !statusObservation.trim()}
                        >
                            Confirmar
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Rejection Reason Modal */}
            <Modal
                open={showRejectionReasonModal}
                onCancel={() => setShowRejectionReasonModal(false)}
                title="Motivo de Rechazo"
                footer={null}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <Text style={{ fontSize: 13 }}>Indique por qué está rechazando esta solicitud/equipo.</Text>
                    <div>
                        <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Feedback / Observaciones *</Text>
                        <TextArea
                            rows={4}
                            value={localRejectionFeedback}
                            onChange={(e) => setLocalRejectionFeedback(e.currentTarget.value)}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <Button style={{ flex: 1 }} onClick={() => setShowRejectionReasonModal(false)}>Cancelar</Button>
                        <Button style={{ flex: 1 }} danger type="primary" onClick={confirmRejectWithFeedback} loading={processingAction}>Confirmar Rechazo</Button>
                    </div>
                </div>
            </Modal>

            <EquipmentExportModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                catalogs={catalogs}
                muestreadores={muestreadorList}
                initialFilters={{
                    search: searchTerm || '',
                    tipo: filterTipo || '',
                    sede: filterSede || '',
                    estado: filterEstado || '',
                    fechaDesde: filterFechaDesde,
                    fechaHasta: filterFechaHasta,
                    id_muestreador: filterMuestreador || ''
                }}
            />

            <EquipmentRequestsModal
                isOpen={showRequestsModal}
                onClose={() => setShowRequestsModal(false)}
                idEquipo={requestsEquipoInfo?.id || null}
                nombreEquipo={requestsEquipoInfo?.nombre || ''}
                codigoEquipo={requestsEquipoInfo?.codigo}
                requests={requestsEquipoInfo ? getPendingRequestsForEquipo(requestsEquipoInfo.id as number).filter((s: any) => s.estado === 'ACEPTADA') : []}
                onRefresh={() => { fetchData(true); loadSolicitudes(); }}
            />
        </div>
    );
};
