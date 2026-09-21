import { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    IconPlus, IconSearch, IconFolderOpen, IconCalendarEvent,
    IconClock, IconArrowLeft, IconInbox, IconSend, IconStarFilled,
} from '@tabler/icons-react';
import { ursService } from '../../../services/urs.service';
import { useNavStore } from '../../../store/navStore';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotificationStore } from '../../../store/notificationStore';
import { useToast } from '../../../contexts/ToastContext';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { PageHeader } from '../../../components/layout/PageHeader';
import RequestDetailPanel from './RequestDetailPanel';
import RequestActivityAndChat from './RequestActivityAndChat';

interface Request {
    id_solicitud: number;
    id_solicitante: number;
    titulo: string;
    nombre_tipo: string;
    estado: string;
    area_destino: string;
    fecha_solicitud: string;
    nombre_solicitante: string;
    prioridad?: string;
    conversacion_count?: number;
    unread_count?: number;
}

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';

const STATUS_LABEL: Record<string, string> = {
    PENDIENTE: 'Pendiente', EN_REVISION: 'En revisión', ACEPTADA: 'Aceptada',
    REALIZADA: 'Realizada', RECHAZADA: 'Rechazada', CANCELADA: 'Cancelada',
};
const STATUS_DOT: Record<string, string> = {
    PENDIENTE: 'bg-warning', EN_REVISION: 'bg-primary', ACEPTADA: 'bg-success',
    REALIZADA: 'bg-muted-foreground', RECHAZADA: 'bg-destructive', CANCELADA: 'bg-muted-foreground',
};
const STATUS_BADGE: Record<string, BadgeVariant> = {
    PENDIENTE: 'warning', EN_REVISION: 'default', ACEPTADA: 'success',
    REALIZADA: 'outline', RECHAZADA: 'destructive', CANCELADA: 'secondary',
};
const HIGH_PRIORITY = new Set(['ALTA', 'URGENTE', 'CRITICO']);

const FOLDER_ROW = 'flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors';
const FOLDER_ROW_ACTIVE = 'bg-muted text-foreground';
const FOLDER_ROW_INACTIVE = 'text-muted-foreground hover:bg-muted/60';

const UniversalInbox: React.FC = () => {
    const {
        setActiveSubmodule, pendingRequestId, setPendingRequestId, selectedRequestId, setSelectedRequestId,
        ursInboxMode, setUrsInboxMode, ursFilters, setUrsFilters, setUrsUnreadCount,
    } = useNavStore();

    const { user } = useAuth();
    const { showToast } = useToast();
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { markAsReadByRef, notifications } = useNotificationStore();

    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const searchTerm = ursFilters.searchTerm;
    const setSearchTerm = (v: string) => setUrsFilters({ searchTerm: v });
    const filter = { status: ursFilters.status, area: ursFilters.area, type: ursFilters.type };
    const setFilter = (f: { status: string; area: string; type: string }) => setUrsFilters(f);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const prevNotifCountRef = useRef(notifications.length);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const reqs = await ursService.getRequests();
            setRequests(reqs);
            setUrsUnreadCount(reqs.filter((r: any) => (r.unread_count || 0) > 0).length);
        } catch {
            showToast({ type: 'error', message: 'Error al cargar la bandeja de solicitudes' });
        } finally { setLoading(false); }
    };

    const loadRequestDetail = async (id: number, silent = false) => {
        if (!silent) setLoadingDetail(true);
        setRequests((prev) => prev.map((r) => (r.id_solicitud === id ? { ...r, unread_count: 0 } : r)));
        try {
            markAsReadByRef(id);
            const data = await ursService.getRequestDetail(id);
            setSelectedRequest(data);
        } catch {
            showToast({ type: 'error', message: 'Error al cargar el detalle de la solicitud' });
            setSelectedRequest(null);
        } finally { if (!silent) setLoadingDetail(false); }
    };

    useEffect(() => { loadInitialData(); }, []);
    useEffect(() => { if (pendingRequestId && !loading) { setSelectedRequestId(pendingRequestId); setPendingRequestId(null); } }, [pendingRequestId, loading]);

    const itemRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({});

    useEffect(() => {
        if (selectedRequestId) {
            loadRequestDetail(selectedRequestId);
            setTimeout(() => { itemRefs.current[selectedRequestId]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 500);
        } else setSelectedRequest(null);
    }, [selectedRequestId]);

    useEffect(() => {
        if (selectedRequestId && requests.length > 0) {
            const req = requests.find((r) => r.id_solicitud === selectedRequestId);
            if (req) {
                const targetMode = Number(req.id_solicitante) === Number(user?.id) ? 'SENT' : 'RECEIVED';
                if (ursInboxMode !== targetMode) setUrsInboxMode(targetMode);
            }
        }
    }, [selectedRequestId, requests.length, user?.id]);

    useEffect(() => {
        if (!selectedRequestId) return;
        const interval = setInterval(() => loadRequestDetail(selectedRequestId, true), 5000);
        return () => clearInterval(interval);
    }, [selectedRequestId]);

    useEffect(() => {
        if (notifications.length > prevNotifCountRef.current) {
            ursService.getRequests().then((reqs) => setRequests(reqs)).catch(() => {});
            if (selectedRequestId) loadRequestDetail(selectedRequestId, true);
        }
        prevNotifCountRef.current = notifications.length;
    }, [notifications.length]);

    useEffect(() => {
        const interval = setInterval(async () => {
            try { const reqs = await ursService.getRequests(); setRequests(reqs); } catch { /* silent */ }
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatDateTime = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr), today = new Date();
        if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
        return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
    };

    const filteredRequests = useMemo(() => requests.filter((req) => {
        const isMine = Number(req.id_solicitante) === Number(user?.id);
        if (ursInboxMode === 'SENT' && !isMine) return false;
        if (ursInboxMode === 'RECEIVED' && isMine) return false;
        const q = searchTerm.toLowerCase();
        const matchesSearch = (req.titulo || '').toLowerCase().includes(q) || (req.nombre_solicitante || '').toLowerCase().includes(q) || req.id_solicitud.toString().includes(searchTerm);
        return matchesSearch && (!filter.status || req.estado === filter.status) && (!filter.area || req.area_destino === filter.area) && (!filter.type || req.nombre_tipo === filter.type);
    }), [requests, searchTerm, filter, ursInboxMode, user]);

    const tipoOptions = useMemo(() => [...new Set(requests.map((r) => r.nombre_tipo).filter(Boolean))].sort(), [requests]);
    const areaOptions = useMemo(() => [...new Set(requests.map((r) => r.area_destino).filter(Boolean))].sort(), [requests]);

    const folderCounts = useMemo(() => {
        const received = requests.filter((r) => Number(r.id_solicitante) !== Number(user?.id));
        const sent = requests.filter((r) => Number(r.id_solicitante) === Number(user?.id));
        return {
            receivedUnread: received.filter((r) => (r.unread_count || 0) > 0).length,
            sentCount: sent.length,
        };
    }, [requests, user]);

    const groupedRequests = useMemo(() => {
        const groups: { [key: string]: Request[] } = {};
        filteredRequests.forEach((req) => {
            const date = new Date(req.fecha_solicitud), today = new Date();
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
            let group = 'Más antiguas';
            if (date.toDateString() === today.toDateString()) group = 'Hoy';
            else if (date.toDateString() === yesterday.toDateString()) group = 'Ayer';
            else if (date > new Date(today.getTime() - 7 * 864e5)) group = 'Esta semana';
            (groups[group] ||= []).push(req);
        });
        return groups;
    }, [filteredRequests]);

    const sidebarContent = (
        <>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setActiveSubmodule('urs-new-request')}>
                <IconPlus size={16} /> Nueva Solicitud
            </Button>

            <div className="flex flex-col gap-0.5">
                <button type="button" onClick={() => setUrsInboxMode('RECEIVED')}
                    className={cn(FOLDER_ROW, ursInboxMode === 'RECEIVED' ? FOLDER_ROW_ACTIVE : FOLDER_ROW_INACTIVE)}>
                    <span className="flex items-center gap-2"><IconInbox size={16} /> Recibidas</span>
                    {folderCounts.receivedUnread > 0 && <span className="text-xs font-semibold">{folderCounts.receivedUnread}</span>}
                </button>
                <button type="button" onClick={() => setUrsInboxMode('SENT')}
                    className={cn(FOLDER_ROW, ursInboxMode === 'SENT' ? FOLDER_ROW_ACTIVE : FOLDER_ROW_INACTIVE)}>
                    <span className="flex items-center gap-2"><IconSend size={16} /> Enviadas</span>
                    {folderCounts.sentCount > 0 && <span className="text-xs font-semibold">{folderCounts.sentCount}</span>}
                </button>
            </div>

            <div className="flex flex-col gap-0.5">
                <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Estados</p>
                <button type="button" onClick={() => setFilter({ ...filter, status: '' })}
                    className={cn(FOLDER_ROW, !filter.status ? FOLDER_ROW_ACTIVE : FOLDER_ROW_INACTIVE)}>
                    <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-muted-foreground" /> Todos</span>
                </button>
                {Object.keys(STATUS_LABEL).map((k) => (
                    <button key={k} type="button" onClick={() => setFilter({ ...filter, status: filter.status === k ? '' : k })}
                        className={cn(FOLDER_ROW, filter.status === k ? FOLDER_ROW_ACTIVE : FOLDER_ROW_INACTIVE)}>
                        <span className="flex items-center gap-2"><span className={cn('h-2 w-2 rounded-full', STATUS_DOT[k])} /> {STATUS_LABEL[k]}</span>
                    </button>
                ))}
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-3">
                <p className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Más filtros</p>
                <Combobox
                    value={filter.area || 'all'}
                    onValueChange={(v) => setFilter({ ...filter, area: v === 'all' ? '' : v })}
                    placeholder="Área: todas"
                    searchPlaceholder="Buscar área..."
                    options={[{ value: 'all', label: 'Área: todas' }, ...areaOptions.map((a) => ({ value: a, label: a }))]}
                />
                <Combobox
                    value={filter.type || 'all'}
                    onValueChange={(v) => setFilter({ ...filter, type: v === 'all' ? '' : v })}
                    placeholder="Todos los tipos"
                    searchPlaceholder="Buscar tipo..."
                    options={[{ value: 'all', label: 'Todos los tipos' }, ...tipoOptions.map((t) => ({ value: t, label: t }))]}
                />
            </div>
        </>
    );

    return (
        <div className="shadcn-scope flex h-full flex-col overflow-hidden bg-background">
            <div className="shrink-0 px-4 pt-4 md:px-6">
                <PageHeader
                    title="Solicitudes"
                    subtitle="Bandeja de solicitudes y mensajes del sistema."
                />
            </div>

            <div className="flex min-h-0 flex-1 overflow-hidden">
                {/* SIDEBAR · Carpetas y filtros (solo escritorio) */}
                {!isMobile && (
                    <div className="flex w-[220px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-border p-3">
                        {sidebarContent}
                    </div>
                )}

                {/* COLUMNA · Bandeja */}
                {(!isMobile || !selectedRequestId) && (
                    <div className={cn('flex min-w-0 shrink-0 flex-col border-r border-border', isMobile ? 'w-full border-r-0' : 'w-[300px]')}>
                        <div className="flex flex-col gap-2.5 border-b border-border p-3">
                            {isMobile && <div className="flex flex-col gap-3">{sidebarContent}</div>}
                            <div className="relative">
                                <IconSearch size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input placeholder="Buscar solicitudes…" className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto p-2">
                            {loading ? (
                                <div className="flex justify-center p-6">
                                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                </div>
                            ) : filteredRequests.length > 0 ? (
                                ['Hoy', 'Ayer', 'Esta semana', 'Más antiguas'].map((label) => {
                                    const groupReqs = groupedRequests[label];
                                    if (!groupReqs?.length) return null;
                                    return (
                                        <div key={label}>
                                            <div className="px-2 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</div>
                                            {groupReqs.map((req) => {
                                                const isActive = selectedRequestId === req.id_solicitud;
                                                const unread = (req.unread_count || 0) > 0;
                                                const isMine = Number(req.id_solicitante) === Number(user?.id);
                                                const isHighPriority = HIGH_PRIORITY.has((req.prioridad || '').toUpperCase());
                                                return (
                                                    <button key={req.id_solicitud} type="button"
                                                        ref={(el) => { itemRefs.current[req.id_solicitud] = el; }}
                                                        className={cn(
                                                            'mb-0.5 flex w-full items-start gap-2 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted',
                                                            isActive && 'border-primary/40 bg-primary/10'
                                                        )}
                                                        onClick={() => setSelectedRequestId(req.id_solicitud)}>
                                                        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', STATUS_DOT[req.estado] || 'bg-muted-foreground')} />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="mb-0.5 flex items-center justify-between gap-2">
                                                                <span className="flex min-w-0 items-center gap-1.5">
                                                                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                                        {isMine ? 'Para' : 'De'}
                                                                    </span>
                                                                    <span className="truncate text-sm font-semibold text-foreground">
                                                                        {isMine ? (req.area_destino || 'Sin destino') : (req.nombre_solicitante || 'Desconocido')}
                                                                    </span>
                                                                    {isHighPriority && <IconStarFilled size={12} className="shrink-0 text-warning" />}
                                                                    {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />}
                                                                </span>
                                                                <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(req.fecha_solicitud)}</span>
                                                            </div>
                                                            <div className={cn('truncate text-sm', unread ? 'font-bold text-foreground' : 'text-foreground/90')}>
                                                                {req.titulo || req.nombre_tipo}
                                                            </div>
                                                            <div className="flex items-center justify-between gap-2">
                                                                <Badge variant={STATUS_BADGE[req.estado] || 'outline'}>{STATUS_LABEL[req.estado] || req.estado}</Badge>
                                                                <span className="shrink-0 text-[11px] text-muted-foreground">#{req.id_solicitud}</span>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="flex flex-col items-center gap-3 px-6 py-16 text-center text-muted-foreground">
                                    <IconFolderOpen size={40} className="opacity-50" />
                                    <span className="text-sm">No hay solicitudes.</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* COLUMNA · Detalle */}
                {(!isMobile || selectedRequestId) && (
                    <div className="flex min-w-0 flex-1 flex-col border-r border-border">
                        {isMobile && selectedRequestId && (
                            <div className="flex items-center justify-between border-b border-border px-3 py-2">
                                <Button variant="ghost" onClick={() => setSelectedRequestId(null)}>
                                    <IconArrowLeft size={18} /> Detalle de solicitud
                                </Button>
                                <span className="rounded bg-muted px-1.5 py-px text-[11px] font-semibold text-muted-foreground">#{selectedRequestId}</span>
                            </div>
                        )}
                        {loadingDetail ? (
                            <div className="flex h-full flex-1 items-center justify-center">
                                <div className="flex flex-col items-center gap-3">
                                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                    <span className="text-sm text-muted-foreground">Abriendo solicitud…</span>
                                </div>
                            </div>
                        ) : selectedRequest ? (
                            <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30 p-4">
                                <RequestDetailPanel request={selectedRequest} onRequestUpdate={loadInitialData} onReload={() => loadRequestDetail(selectedRequestId!, true)} />
                                {isMobile && (
                                    <div className="mt-4">
                                        <div className="px-2 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Actividad y chat</div>
                                        <RequestActivityAndChat request={selectedRequest} onReload={() => loadRequestDetail(selectedRequestId!, true)} />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center text-muted-foreground">
                                <IconCalendarEvent size={48} className="opacity-40" />
                                <h2 className="m-0 text-base font-semibold text-foreground/80">Selecciona una solicitud</h2>
                                <span>Haz clic en la lista para ver detalles.</span>
                            </div>
                        )}
                    </div>
                )}

                {/* COLUMNA · Actividad y chat */}
                {!isMobile && (
                    <div className="flex w-[360px] min-w-0 shrink-0 flex-col">
                        {selectedRequest ? (
                            <RequestActivityAndChat request={selectedRequest} onReload={() => loadRequestDetail(selectedRequestId!, true)} />
                        ) : (
                            <div className="flex h-full flex-1 items-center justify-center">
                                <IconClock size={40} className="text-muted-foreground opacity-50" />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UniversalInbox;
