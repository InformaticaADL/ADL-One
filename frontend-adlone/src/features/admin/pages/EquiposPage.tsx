import React, { useState, useEffect, useMemo } from 'react';
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
    IconFilter
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { DataPagination } from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { useMediaQuery } from '../../../hooks/useMediaQuery';
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

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';

const getStatusBadgeVariant = (status: string): BadgeVariant => {
    const s = (status || '').toUpperCase().trim();
    switch (s) {
        case 'PENDIENTE':
        case 'PENDIENTE_TECNICA':
        case 'PENDIENTE_CALIDAD': return 'warning';
        case 'EN_REVISION':
        case 'EN_REVISION_TECNICA': return 'secondary';
        case 'ACEPTADA': return 'success';
        case 'RECHAZADA':
        case 'RECHAZADO_TECNICA': return 'destructive';
        case 'REALIZADA': return 'outline';
        default: return 'outline';
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
    const [filtersSheetOpen, setFiltersSheetOpen] = useState(false);
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
    const [totalItems, setTotalItems] = useState(0);
    const [expiringCount, setExpiringCount] = useState(0);
    const [expiredCount, setExpiredCount] = useState(0);
    const [inactiveSamplerCount, setInactiveSamplerCount] = useState(0);
    const [filterExpired, setFilterExpired] = useState(false);
    const [filterInactiveSampler, setFilterInactiveSampler] = useState(false);
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

                setTotalItems(response.total || 0);
                setExpiringCount(response.expiringCount ?? 0);
                setExpiredCount(response.expiredCount ?? 0);
                setInactiveSamplerCount(response.inactiveSamplerCount ?? 0);
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

    // Cuenta solo los filtros que viven dentro del panel lateral (Tipo/Sede/
    // Estado/Responsable/Vigencia) — búsqueda y los 3 atajos rápidos tienen
    // su propio indicador visual y no suman acá.
    const panelFilterCount = useMemo(() =>
        [filterTipo, filterSede, filterEstado, filterMuestreador, filterFechaDesde, filterFechaHasta].filter(Boolean).length,
    [filterTipo, filterSede, filterEstado, filterMuestreador, filterFechaDesde, filterFechaHasta]);

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

    const isExpiredOrSoon = (equipo: Equipo) => isDateExpiringSoon(equipo.vigencia) || isDateExpired(equipo.vigencia);

    const rowActions = (equipo: Equipo, isInactive: boolean) => (
        <div className="flex justify-end gap-1">
            <ProtectedContent permission="AI_MA_EDITAR_EQUIPO">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Editar"
                    aria-label="Editar"
                    onClick={() => handleEdit(equipo)}
                    disabled={!canEditEquipo}
                >
                    <IconEdit size={16} />
                </Button>
            </ProtectedContent>
            <ProtectedContent permission={isInactive ? "EQ_ACTIVAR" : "EQ_DESACTIVAR"}>
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-8 w-8', isInactive ? 'text-success hover:bg-success/10 hover:text-success' : 'text-destructive hover:bg-destructive/10 hover:text-destructive')}
                    title={isInactive ? 'Activar' : 'Desactivar'}
                    aria-label={isInactive ? 'Activar' : 'Desactivar'}
                    onClick={() => handleToggleStatus(equipo)}
                    disabled={!canEditEquipo}
                >
                    <IconPower size={16} />
                </Button>
            </ProtectedContent>
        </div>
    );

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <div className="flex flex-col gap-4">
                <PageHeader
                    title="Gestión de Equipos"
                    subtitle="Administra y supervisa los equipos de medición del sistema."
                    breadcrumbItems={[{ label: 'Equipos', onClick: onBack }, { label: 'Gestión de Equipos' }]}
                    rightSection={
                        <ProtectedContent permission="AI_MA_CREAR_EQUIPO">
                            <Button
                                className={cn(isMobile && 'w-full')}
                                onClick={() => { setSelectedEquipo(null); setViewMode('form'); }}
                                disabled={!canCreateEquipo}
                            >
                                <IconPlus size={16} /> Nuevo{!isMobile && ' Equipo'}
                            </Button>
                        </ProtectedContent>
                    }
                />

                <div className="inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
                    <button
                        type="button"
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
                        className={cn(
                            'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-colors',
                            isPorVencerActive ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground'
                        )}
                    >
                        Por vencer{expiringCount > 0 && ` (${expiringCount})`}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const nextVal = !filterExpired;
                            setFilterExpired(nextVal);
                            setFilterEstado(nextVal ? 'Activo' : null);
                            setFilterInactiveSampler(false);
                            setFilterFechaDesde('');
                            setFilterFechaHasta('');
                            setPage(1);
                        }}
                        className={cn(
                            'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-colors',
                            filterExpired ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground'
                        )}
                    >
                        Vencidos{expiredCount > 0 && ` (${expiredCount})`}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const nextVal = !filterInactiveSampler;
                            setFilterInactiveSampler(nextVal);
                            setFilterEstado(null);
                            setFilterExpired(false);
                            setFilterFechaDesde('');
                            setFilterFechaHasta('');
                            setPage(1);
                        }}
                        className={cn(
                            'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-colors',
                            filterInactiveSampler ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground'
                        )}
                    >
                        Muestreador inactivo{inactiveSamplerCount > 0 && ` (${inactiveSamplerCount})`}
                    </button>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Nombre o código..."
                            value={localSearchTerm}
                            onChange={(e) => setLocalSearchTerm(e.target.value)}
                            className="w-56 pl-8"
                        />
                    </div>

                    <Sheet open={filtersSheetOpen} onOpenChange={setFiltersSheetOpen}>
                        <SheetTrigger asChild>
                            <Button variant="outline">
                                <IconFilter size={16} /> Filtros
                                {panelFilterCount > 0 && (
                                    <Badge variant="secondary" className="ml-1 px-1.5">{panelFilterCount}</Badge>
                                )}
                            </Button>
                        </SheetTrigger>
                        <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-sm">
                            <SheetHeader>
                                <SheetTitle>Filtros</SheetTitle>
                            </SheetHeader>

                            <div className="flex flex-1 flex-col gap-4">
                                <div>
                                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tipo</Label>
                                    <Select value={filterTipo ?? 'all'} onValueChange={(v) => setFilterTipo(v === 'all' ? null : v)}>
                                        <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos los tipos</SelectItem>
                                            {catalogs.tipos.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Sede</Label>
                                    <Select value={filterSede ?? 'all'} onValueChange={(v) => setFilterSede(v === 'all' ? null : v)}>
                                        <SelectTrigger><SelectValue placeholder="Sede" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas las sedes</SelectItem>
                                            {catalogs.sedes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Estado</Label>
                                    <Select
                                        value={filterEstado ?? 'all'}
                                        onValueChange={(v) => {
                                            const nextEstado = v === 'all' ? null : v;
                                            setFilterEstado(nextEstado);
                                            if (nextEstado !== 'Activo') {
                                                setFilterExpired(false);
                                                setFilterInactiveSampler(false);
                                            }
                                        }}
                                    >
                                        <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos los estados</SelectItem>
                                            {catalogs.estados.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Responsable</Label>
                                    <Select value={filterMuestreador ?? 'all'} onValueChange={(v) => setFilterMuestreador(v === 'all' ? null : v)}>
                                        <SelectTrigger><SelectValue placeholder="Responsable" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos los responsables</SelectItem>
                                            {muestreadorList.map(m => (
                                                <SelectItem key={m.id_muestreador} value={String(m.id_muestreador)}>
                                                    {m.habilitado === 'N' || m.habilitado === false ? `${m.nombre_muestreador} (Inactivo)` : m.nombre_muestreador}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Vigencia desde</Label>
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
                                <div>
                                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Vigencia hasta</Label>
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

                            <SheetFooter>
                                {panelFilterCount > 0 && (
                                    <Button
                                        variant="outline"
                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        onClick={() => {
                                            setFilterTipo(null);
                                            setFilterSede(null);
                                            setFilterEstado(null);
                                            setFilterMuestreador(null);
                                            setFilterFechaDesde('');
                                            setFilterFechaHasta('');
                                            setFilterExpired(false);
                                            setFilterInactiveSampler(false);
                                        }}
                                    >
                                        <IconX size={16} /> Limpiar filtros
                                    </Button>
                                )}
                                <Button onClick={() => setFiltersSheetOpen(false)}>Aplicar</Button>
                            </SheetFooter>
                        </SheetContent>
                    </Sheet>

                    {hasActiveFilters && (
                        <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={handleClearFilters}>
                            <IconX size={16} /> Limpiar todo
                        </Button>
                    )}
                    </div>

                    <ProtectedContent permission="EQ_EXP">
                        <Button variant="outline" size="sm" onClick={() => setShowExportModal(true)}>
                            <IconDownload size={15} /> Exportar
                        </Button>
                    </ProtectedContent>
                </div>

                <div className="relative overflow-hidden rounded-xl border border-border bg-card">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    )}

                    {isMobile ? (
                        <div className="flex flex-col divide-y divide-border">
                            {sortedEquipos.length === 0 ? (
                                <p className="p-6 text-center text-sm text-muted-foreground">No se encontraron equipos.</p>
                            ) : (
                                sortedEquipos.map(equipo => {
                                    const isInactive = equipo.estado?.toLowerCase() === 'inactivo';
                                    const pendingRequests = getPendingRequestsForEquipo(equipo.id_equipo);
                                    const hasAccepted = pendingRequests.some(req => req.estado === 'ACEPTADA');
                                    const expired = isExpiredOrSoon(equipo);

                                    return (
                                        <div key={equipo.id_equipo} className="flex flex-col gap-2 p-3.5">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-foreground">{equipo.codigo || 'S/N'}</p>
                                                    <p className="truncate text-sm font-medium text-foreground">{equipo.nombre}</p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-1">
                                                    {hasAccepted && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-warning"
                                                            title="Contiene solicitudes aceptadas listas para ejecutarse."
                                                            onClick={() => {
                                                                setRequestsEquipoInfo({ id: equipo.id_equipo, nombre: equipo.nombre, codigo: equipo.codigo });
                                                                setShowRequestsModal(true);
                                                            }}
                                                        >
                                                            <IconAlertTriangle size={16} />
                                                        </Button>
                                                    )}
                                                    <Badge variant={isInactive ? 'destructive' : 'success'}>{equipo.estado}</Badge>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                <span>Tipo: {equipo.tipo}</span>
                                                <span>Sede: {equipo.ubicacion}</span>
                                                <span className={cn(expired && 'font-bold text-foreground')}>Vigencia: {equipo.vigencia}</span>
                                                <span>
                                                    Resp.: {equipo.nombre_asignado || '---'}
                                                    {equipo.habilitado_muestreador === 'N' && <Badge variant="destructive" className="ml-1">Inactivo</Badge>}
                                                </span>
                                            </div>
                                            <div className="mt-1 flex justify-end">{rowActions(equipo, isInactive)}</div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-10">Alerta</TableHead>
                                    <TableHead>Código</TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Sede</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Vigencia</TableHead>
                                    <TableHead>Responsable</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedEquipos.length === 0 ? (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                                            No se encontraron equipos.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedEquipos.map(equipo => {
                                        const isInactive = equipo.estado?.toLowerCase() === 'inactivo';
                                        const pendingRequests = getPendingRequestsForEquipo(equipo.id_equipo);
                                        const hasAccepted = pendingRequests.some(req => req.estado === 'ACEPTADA');

                                        const expiringSoon = isDateExpiringSoon(equipo.vigencia);
                                        const expired = isDateExpired(equipo.vigencia);

                                        return (
                                            <TableRow key={equipo.id_equipo}>
                                                <TableCell>
                                                    {hasAccepted && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-warning"
                                                            title="Contiene solicitudes aceptadas listas para ejecutarse. Clic para abrirlas."
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setRequestsEquipoInfo({ id: equipo.id_equipo, nombre: equipo.nombre, codigo: equipo.codigo });
                                                                setShowRequestsModal(true);
                                                            }}
                                                        >
                                                            <IconAlertTriangle size={14} />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-sm font-semibold text-foreground">{equipo.codigo || 'S/N'}</TableCell>
                                                <TableCell className="font-medium text-foreground">{equipo.nombre}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{equipo.tipo}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{equipo.ubicacion}</TableCell>
                                                <TableCell><Badge variant={isInactive ? 'destructive' : 'success'}>{equipo.estado}</Badge></TableCell>
                                                <TableCell>
                                                    <span className={cn('text-sm text-foreground', (expired || expiringSoon) && 'font-bold')}>
                                                        {equipo.vigencia}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    {equipo.nombre_asignado ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-sm text-muted-foreground">{equipo.nombre_asignado}</span>
                                                            {equipo.habilitado_muestreador === 'N' && <Badge variant="destructive">Inactivo</Badge>}
                                                        </div>
                                                    ) : '---'}
                                                </TableCell>
                                                <TableCell>{rowActions(equipo, isInactive)}</TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>

                <DataPagination page={page} pageSize={limit} total={totalItems} onPageChange={setPage} />
            </div>

            {/* --- Modals Area --- */}

            {/* Review Solicitud Dialog */}
            <Dialog open={!!reviewSolicitud} onOpenChange={(open) => { if (!open) setReviewSolicitud(null); }}>
                <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
                    <DialogHeader>
                        <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
                            <div className="flex items-center gap-2">
                                <IconBell size={20} className="text-primary" />
                                <DialogTitle>Revisar Solicitud de {reviewSolicitud && getTipoLabelDisplay(reviewSolicitud)}</DialogTitle>
                            </div>
                            {reviewSolicitud && (
                                <Badge variant={getStatusBadgeVariant(reviewSolicitud.estado)}>{reviewSolicitud.estado.replace(/_/g, ' ')}</Badge>
                            )}
                        </div>
                    </DialogHeader>

                    <div className="relative">
                        {(processingAction || loadingHistorial) && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            </div>
                        )}
                        {reviewSolicitud && (
                            <div className="flex flex-col gap-5">
                                <div className="rounded-lg border border-border bg-muted/40 p-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs font-bold uppercase text-muted-foreground">Solicitante</p>
                                            <p className="text-sm font-semibold text-foreground">{reviewSolicitud.nombre_solicitante}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold uppercase text-muted-foreground">Fecha</p>
                                            <p className="text-sm text-foreground">{new Date(reviewSolicitud.fecha_solicitud).toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>

                                {solicitudHistorial.length > 0 && (
                                    <div className="rounded-lg border border-border p-4">
                                        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-muted-foreground">
                                            <IconInfoCircle size={14} /> Historial de acciones
                                        </p>
                                        <div className="flex max-h-[150px] flex-col gap-1.5 overflow-y-auto">
                                            {solicitudHistorial.map((h, i) => (
                                                <div key={i} className={cn('py-1', i < solicitudHistorial.length - 1 && 'border-b border-border')}>
                                                    <div className="flex items-center justify-between">
                                                        <Badge variant={h.accion === 'APROBADO' ? 'success' : h.accion === 'RECHAZADO' ? 'destructive' : 'outline'}>
                                                            {h.accion}
                                                        </Badge>
                                                        <span className="text-[11px] text-muted-foreground">{new Date(h.fecha_accion).toLocaleString()}</span>
                                                    </div>
                                                    <p className="mt-0.5 text-xs font-semibold text-foreground">{h.nombre_usuario || 'Sistema'}</p>
                                                    <p className="text-xs italic text-muted-foreground">{h.observacion || 'Sin observación'}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Special case for BULK BAJA/ALTA */}
                                {((reviewSolicitud.tipo_solicitud === 'BAJA' && reviewSolicitud.datos_json?.equipos_baja) ||
                                  (reviewSolicitud.tipo_solicitud === 'ALTA' && reviewSolicitud.datos_json?.isReactivation && reviewSolicitud.datos_json?.equipos_alta)) ? (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-semibold text-foreground">Equipos involucrados</p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className={reviewSolicitud.tipo_solicitud === 'BAJA'
                                                    ? 'border-destructive/40 text-destructive hover:bg-destructive/10'
                                                    : 'border-success/40 text-success hover:bg-success/10'}
                                                onClick={reviewSolicitud.tipo_solicitud === 'BAJA' ? handleApproveAllBaja : handleApproveAllAlta}
                                            >
                                                Procesar Todo
                                            </Button>
                                        </div>
                                        <div className="flex max-h-[250px] flex-col gap-2 overflow-y-auto">
                                            {(reviewSolicitud.datos_json.equipos_baja || reviewSolicitud.datos_json.equipos_alta).map((eq: any) => (
                                                <div key={eq.id} className={cn('rounded-md border border-border p-2', eq.procesado && 'bg-muted/40')}>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div>
                                                            <p className={cn('text-sm font-semibold text-foreground', eq.procesado && 'line-through')}>{eq.nombre}</p>
                                                            <p className="text-xs text-muted-foreground">{eq.codigo || eq.datos_originales?.codigo}</p>
                                                            {eq.vigencia && <p className="text-xs font-bold text-success">Propuesta: {eq.vigencia}</p>}
                                                        </div>
                                                        {!eq.procesado ? (
                                                            <div className="flex shrink-0 gap-1.5">
                                                                <Button
                                                                    size="sm"
                                                                    className={reviewSolicitud.tipo_solicitud === 'BAJA'
                                                                        ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                                                        : 'bg-success text-success-foreground hover:bg-success/90'}
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
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                                                                    onClick={() => handleOpenIndividualRejection(eq, reviewSolicitud.tipo_solicitud as 'ALTA' | 'BAJA')}
                                                                >
                                                                    Rechazar
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Badge variant={eq.rechazado ? 'destructive' : 'success'}>{eq.rechazado ? 'RECHAZADO' : 'PROCESADO'}</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : reviewSolicitud.tipo_solicitud === 'EQUIPO_PERDIDO' ? (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                                            <IconAlertTriangle size={18} className="mt-0.5 shrink-0 text-destructive" />
                                            <div>
                                                <p className="text-sm font-semibold text-foreground">Reporte de Pérdida / Extravío</p>
                                                <p className="text-sm text-muted-foreground">
                                                    Indica {reviewSolicitud.datos_json?.tipo_perdida} ocurrido el {reviewSolicitud.datos_json?.fecha_incidente}.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="rounded-md border border-border p-4">
                                            <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">Circunstancias</p>
                                            <p className="text-sm text-foreground">{reviewSolicitud.datos_json?.circunstancias || 'No detalladas'}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="max-h-[350px] overflow-y-auto">
                                        <div className="flex flex-col gap-2">
                                            {Object.entries(reviewSolicitud.datos_json || {}).map(([key, val]) => {
                                                if (!val || ['equipos_baja', 'equipos_alta', 'isReactivation', 'id_muestreador', 'id_equipo_original'].includes(key)) return null;
                                                if (key === 'archivo_adjunto') return (
                                                    <div key={key} className="mt-2">
                                                        <p className="text-xs font-bold uppercase text-muted-foreground">Archivo Adjunto:</p>
                                                        <div className="mt-1 rounded-md border border-border p-1">
                                                            <img
                                                                src={`${import.meta.env.VITE_API_URL || 'http://localhost:8002'}${val}`}
                                                                className="max-h-[200px] w-full object-contain"
                                                                alt="adjunto"
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                                return (
                                                    <div key={key} className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-bold uppercase text-muted-foreground">{key.replace(/_/g, ' ')}:</span>
                                                        <span className="text-sm font-semibold text-foreground">{String(val)}</span>
                                                    </div>
                                                );
                                            })}
                                            {reviewSolicitud.feedback_admin && (
                                                <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-3">
                                                    <p className="text-sm font-semibold text-foreground">Observación Técnica</p>
                                                    <p className="text-sm text-muted-foreground">{reviewSolicitud.feedback_admin}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setReviewSolicitud(null)}>Cerrar</Button>

                                    {(reviewSolicitud.estado === 'PENDIENTE' || reviewSolicitud.estado === 'PENDIENTE_TECNICA' || reviewSolicitud.estado === 'PENDIENTE_CALIDAD') && (
                                        <>
                                            <Button
                                                variant="destructive"
                                                onClick={() => {
                                                    setRejectionTarget({ type: 'SOLICITUD' });
                                                    setLocalRejectionFeedback('');
                                                    setShowRejectionReasonModal(true);
                                                }}
                                            >
                                                <IconX size={16} /> Rechazar
                                            </Button>

                                            {reviewSolicitud.estado === 'PENDIENTE_TECNICA' && (isMAMan || isSuper) && (
                                                <Button
                                                    className="border-sky-300 bg-sky-600 text-white hover:bg-sky-700"
                                                    onClick={handleApprove}
                                                >
                                                    {(reviewSolicitud.tipo_solicitud === 'EQUIPO_PERDIDO' || reviewSolicitud.tipo_solicitud === 'REPORTE_PROBLEMA')
                                                        ? 'En Revisión' : 'Derivar a Calidad'}
                                                </Button>
                                            )}

                                            {(reviewSolicitud.estado === 'PENDIENTE' || reviewSolicitud.estado === 'PENDIENTE_CALIDAD') && (
                                                <Button
                                                    className="bg-success text-success-foreground hover:bg-success/90"
                                                    onClick={handleApprove}
                                                >
                                                    <IconCheck size={16} /> {reviewSolicitud.estado === 'PENDIENTE_CALIDAD' ? 'Aprobar Final' : 'Aprobar'}
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </DialogFooter>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Confirm Baja Dialog */}
            <Dialog open={showConfirmBajaModal} onOpenChange={setShowConfirmBajaModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Baja / Pérdida</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-4 py-2">
                        <IconTrash size={48} className="text-destructive" />
                        <p className="text-center text-sm text-foreground">
                            ¿Estás seguro de dar de baja al equipo <b>{equipoBajaPending?.nombre}</b>?
                        </p>

                        {associatedActiveEquiposBaja.length > 0 && (
                            <div className="w-full rounded-lg border border-warning/40 bg-warning/10 p-3">
                                <div className="flex items-start gap-2">
                                    <IconAlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-foreground">Equipo Asociado Activo</p>
                                        <p className="mb-2 text-xs text-muted-foreground">
                                            <strong>Advertencia:</strong> Este equipo se encuentra configurado como el equipo asociado de los siguientes equipos activos. Al darlo de baja, estas unidades perderán su equipo asociado:
                                        </p>
                                        <ul className="max-h-[100px] list-disc overflow-y-auto pl-4 text-xs text-foreground">
                                            {associatedActiveEquiposBaja.map(e => (
                                                <li key={e.id_equipo}><strong>{e.codigo}</strong> - {e.nombre} ({e.ubicacion})</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {equipoBajaPending?.datos_json?.tipo_solicitud === 'EQUIPO_PERDIDO' && (
                            <div className="w-full">
                                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Observación Final de Pérdida *</Label>
                                <Textarea value={bajaObservation} onChange={(e) => setBajaObservation(e.target.value)} rows={3} />
                            </div>
                        )}
                    </div>
                    <DialogFooter className="sm:justify-stretch">
                        <Button variant="outline" className="flex-1" onClick={() => setShowConfirmBajaModal(false)}>Cancelar</Button>
                        <Button variant="destructive" className="flex-1" onClick={confirmApproveBaja} disabled={processingAction}>
                            {processingAction && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                            Confirmar Baja
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm Alta / Reactivation Dialog */}
            <Dialog open={showConfirmAltaModal} onOpenChange={setShowConfirmAltaModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Reactivación / Vigencia</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-2">
                        <p className="text-center text-sm text-foreground">Se actualizará el equipo: <b>{equipoAltaPending?.nombre}</b></p>
                        <div>
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nueva Fecha de Vigencia *</Label>
                            <Input type="date" value={reactivationVigencia} onChange={(e) => setReactivationVigencia(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter className="sm:justify-stretch">
                        <Button variant="outline" className="flex-1" onClick={() => setShowConfirmAltaModal(false)}>Cancelar</Button>
                        <Button className="flex-1 bg-success text-success-foreground hover:bg-success/90" onClick={confirmApproveAlta} disabled={processingAction}>
                            {processingAction && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                            Confirmar Actividad
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Resolution Dialog */}
            <Dialog open={showResolutionModal} onOpenChange={setShowResolutionModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Resolución Final de Calidad</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <div>
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Observación de Calidad *</Label>
                            <Textarea
                                rows={4}
                                placeholder="Escribe la resolución de calidad aquí..."
                                value={resolutionFeedback}
                                onChange={(e) => setResolutionFeedback(e.target.value)}
                            />
                        </div>
                        {['EQUIPO_DESHABILITADO', 'ALTA'].includes(solicitudInResolution?.tipo_solicitud) && (
                            <div>
                                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Actualizar Vigencia</Label>
                                <Input type="date" value={resolutionDate} onChange={(e) => setResolutionDate(e.target.value)} />
                            </div>
                        )}
                    </div>
                    <DialogFooter className="sm:justify-stretch">
                        <Button variant="outline" className="flex-1" onClick={() => setShowResolutionModal(false)}>Cancelar</Button>
                        <Button className="flex-1 bg-success text-success-foreground hover:bg-success/90" onClick={confirmFinalResolution} disabled={processingAction}>
                            {processingAction && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                            Aprobar Final
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Status Confirm Dialog */}
            <Dialog open={showStatusConfirmModal} onOpenChange={setShowStatusConfirmModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{equipoStatusPending?.estado === 'Activo' ? 'Desactivar Equipo' : 'Activar Equipo'}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col items-center gap-4">
                        <IconPower size={48} className={equipoStatusPending?.estado === 'Activo' ? 'text-destructive' : 'text-success'} />
                        <p className="text-center text-sm text-foreground">
                            ¿Cambiar estado de <b>{equipoStatusPending?.nombre}</b> a {equipoStatusPending?.estado === 'Activo' ? 'Inactivo' : 'Activo'}?
                        </p>

                        {associatedActiveEquipos.length > 0 && (
                            <div className="w-full rounded-lg border border-warning/40 bg-warning/10 p-3">
                                <div className="flex items-start gap-2">
                                    <IconAlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-foreground">Equipo Asociado Activo</p>
                                        <p className="mb-2 text-xs text-muted-foreground">
                                            <strong>Advertencia:</strong> Este equipo se encuentra configurado como el equipo asociado de los siguientes equipos activos. Al desactivarlo, quedará inactivo para ellos:
                                        </p>
                                        <ul className="max-h-[100px] list-disc overflow-y-auto pl-4 text-xs text-foreground">
                                            {associatedActiveEquipos.map(e => (
                                                <li key={e.id_equipo}><strong>{e.codigo}</strong> - {e.nombre} ({e.ubicacion})</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="w-full">
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                                Motivo del cambio{equipoStatusPending?.estado === 'Activo' ? ' *' : ''}
                            </Label>
                            <Textarea
                                value={statusObservation}
                                onChange={(e) => setStatusObservation(e.target.value)}
                                placeholder={equipoStatusPending?.estado === 'Activo' ? "Describa el motivo de la desactivación (obligatorio)..." : "Observaciones..."}
                            />
                        </div>
                    </div>
                    <DialogFooter className="sm:justify-stretch">
                        <Button variant="outline" className="flex-1" onClick={() => setShowStatusConfirmModal(false)}>Cancelar</Button>
                        <Button
                            className={cn('flex-1', equipoStatusPending?.estado === 'Activo'
                                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                : 'bg-success text-success-foreground hover:bg-success/90')}
                            onClick={confirmToggleStatus}
                            disabled={processingAction || (equipoStatusPending?.estado === 'Activo' && !statusObservation.trim())}
                        >
                            {processingAction && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                            Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rejection Reason Dialog */}
            <Dialog open={showRejectionReasonModal} onOpenChange={setShowRejectionReasonModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Motivo de Rechazo</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <p className="text-sm text-foreground">Indique por qué está rechazando esta solicitud/equipo.</p>
                        <div>
                            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Feedback / Observaciones *</Label>
                            <Textarea rows={4} value={localRejectionFeedback} onChange={(e) => setLocalRejectionFeedback(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter className="sm:justify-stretch">
                        <Button variant="outline" className="flex-1" onClick={() => setShowRejectionReasonModal(false)}>Cancelar</Button>
                        <Button variant="destructive" className="flex-1" onClick={confirmRejectWithFeedback} disabled={processingAction}>
                            {processingAction && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                            Confirmar Rechazo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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

function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <textarea
            className={cn(
                'flex min-h-[72px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                className
            )}
            {...props}
        />
    );
}

export default EquiposPage;
