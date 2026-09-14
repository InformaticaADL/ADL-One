import { useState, useEffect, useMemo, useRef } from 'react';
import { ConfigProvider, Tabs, Input, Select, Tag, Button, Empty, Spin, Badge } from 'antd';
import {
    IconPlus, IconSearch, IconChevronRight, IconFolderOpen, IconCalendarEvent,
    IconClock, IconArrowLeft,
} from '@tabler/icons-react';
import { ursService } from '../../../services/urs.service';
import { useNavStore } from '../../../store/navStore';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotificationStore } from '../../../store/notificationStore';
import { useToast } from '../../../contexts/ToastContext';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
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

const STATUS_TAG: Record<string, string> = {
    PENDIENTE: 'gold', EN_REVISION: 'blue', ACEPTADA: 'green',
    REALIZADA: 'geekblue', RECHAZADA: 'red', CANCELADA: 'default',
};
const STATUS_LABEL: Record<string, string> = {
    PENDIENTE: 'Pendiente', EN_REVISION: 'En revisión', ACEPTADA: 'Aceptada',
    REALIZADA: 'Realizada', RECHAZADA: 'Rechazada', CANCELADA: 'Cancelada',
};

const C = {
    border: '#f0f0f0',
    text: 'rgba(0,0,0,0.88)',
    textSec: 'rgba(0,0,0,0.65)',
    textTer: 'rgba(0,0,0,0.45)',
    primary: '#1677ff',
    primaryBg: '#e6f4ff',
    bg: '#ffffff',
    bgLayout: '#f5f5f5',
};

const CSS = `
.adl-urs-root { display:flex; height:100%; overflow:hidden; background:${C.bg}; }
.adl-urs-col1 { flex-shrink:0; width:360px; display:flex; flex-direction:column; min-width:0; border-right:1px solid ${C.border}; }
.adl-urs-col1.mobile { width:100%; border-right:none; }
.adl-urs-col2 { flex:1; display:flex; flex-direction:column; min-width:0; border-right:1px solid ${C.border}; }
.adl-urs-col3 { flex-shrink:0; width:360px; display:flex; flex-direction:column; min-width:0; }
.adl-urs-header { padding:16px 16px 0; display:flex; flex-direction:column; row-gap:10px; border-bottom:1px solid ${C.border}; }
.adl-urs-title { margin:0; font-size:20px; font-weight:700; color:${C.text}; }
.adl-urs-filters { display:flex; column-gap:8px; }
.adl-urs-scroll { flex:1; min-height:0; overflow-y:auto; padding:8px; }
.adl-urs-group { font-size:12px; font-weight:700; color:${C.textTer}; text-transform:uppercase; letter-spacing:.5px; padding:12px 8px 4px; }
.adl-urs-item { display:block; width:100%; text-align:left; border:1px solid transparent; background:transparent; cursor:pointer; border-radius:8px; padding:10px 12px; margin-bottom:2px; transition:background .15s; }
.adl-urs-item:hover { background:${C.bgLayout}; }
.adl-urs-item.active { background:${C.primaryBg}; border-color:#91caff; }
.adl-urs-itemtop { display:flex; align-items:center; justify-content:space-between; column-gap:8px; margin-bottom:2px; }
.adl-urs-id { display:inline-block; font-size:11px; font-weight:600; color:${C.textSec}; background:${C.bgLayout}; border-radius:4px; padding:1px 6px; }
.adl-urs-from { font-size:12px; font-weight:600; color:${C.primary}; }
.adl-urs-time { font-size:12px; color:${C.textTer}; flex-shrink:0; }
.adl-urs-subject { font-size:14px; color:${C.text}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:2px 0 6px; }
.adl-urs-subject.unread { font-weight:700; }
.adl-urs-itembottom { display:flex; align-items:center; justify-content:space-between; }
.adl-urs-itembl { display:flex; align-items:center; column-gap:6px; }
.adl-urs-empty { display:flex; flex-direction:column; align-items:center; row-gap:12px; padding:64px 24px; text-align:center; color:${C.textTer}; }
.adl-urs-center { flex:1; display:flex; align-items:center; justify-content:center; height:100%; }
.adl-urs-detail { flex:1; min-height:0; overflow-y:auto; padding:16px; background:${C.bgLayout}; }
.adl-urs-mobilebar { display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-bottom:1px solid ${C.border}; }
.adl-urs-emptydetail { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; row-gap:6px; color:${C.textTer}; text-align:center; }
.adl-urs-emptydetail h2 { font-size:16px; font-weight:600; margin:0; color:${C.textSec}; }
`;

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
        return d.toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
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

    return (
        <ConfigProvider theme={{ token: { colorPrimary: C.primary, borderRadius: 8 } }}>
            <style>{CSS}</style>
            <div className="adl-urs-root">
                {/* COLUMNA 1 · Bandeja */}
                {(!isMobile || !selectedRequestId) && (
                    <div className={`adl-urs-col1 ${isMobile ? 'mobile' : ''}`}>
                        <div className="adl-urs-header">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <h1 className="adl-urs-title">Solicitudes</h1>
                                <Button type="primary" shape="circle" icon={<IconPlus size={18} />} aria-label="Nueva solicitud"
                                    onClick={() => setActiveSubmodule('urs-new-request')} />
                            </div>
                            <Tabs activeKey={ursInboxMode} size="small" style={{ marginBottom: -8 }}
                                onChange={(k) => setUrsInboxMode(k as 'RECEIVED' | 'SENT')}
                                items={[{ key: 'RECEIVED', label: 'Recibidas' }, { key: 'SENT', label: 'Enviadas' }]} />
                            <Input allowClear placeholder="Buscar…" prefix={<IconSearch size={16} color={C.textTer} />}
                                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            <div className="adl-urs-filters">
                                <Select size="small" style={{ flex: 1 }} value={filter.status}
                                    onChange={(v) => setFilter({ ...filter, status: v })}
                                    options={[{ value: '', label: 'Estado: todos' }, ...Object.keys(STATUS_LABEL).map((k) => ({ value: k, label: STATUS_LABEL[k] }))]} />
                                <Select size="small" style={{ flex: 1 }} value={filter.area}
                                    onChange={(v) => setFilter({ ...filter, area: v })}
                                    options={[{ value: '', label: 'Área: todas' }, ...areaOptions.map((a) => ({ value: a, label: a }))]} />
                            </div>
                            <div style={{ paddingBottom: 12 }}>
                                <Select size="small" style={{ width: '100%' }} value={filter.type}
                                    onChange={(v) => setFilter({ ...filter, type: v })}
                                    options={[{ value: '', label: 'Todos los tipos' }, ...tipoOptions.map((t) => ({ value: t, label: t }))]} />
                            </div>
                        </div>

                        <div className="adl-urs-scroll">
                            {loading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spin /></div>
                            ) : filteredRequests.length > 0 ? (
                                ['Hoy', 'Ayer', 'Esta semana', 'Más antiguas'].map((label) => {
                                    const groupReqs = groupedRequests[label];
                                    if (!groupReqs?.length) return null;
                                    return (
                                        <div key={label}>
                                            <div className="adl-urs-group">{label}</div>
                                            {groupReqs.map((req) => {
                                                const isActive = selectedRequestId === req.id_solicitud;
                                                const unread = (req.unread_count || 0) > 0;
                                                const isMine = Number(req.id_solicitante) === Number(user?.id);
                                                return (
                                                    <button key={req.id_solicitud} type="button"
                                                        ref={(el) => { itemRefs.current[req.id_solicitud] = el; }}
                                                        className={`adl-urs-item ${isActive ? 'active' : ''}`}
                                                        onClick={() => setSelectedRequestId(req.id_solicitud)}>
                                                        <div className="adl-urs-itemtop">
                                                            <span className="adl-urs-itembl">
                                                                <span className="adl-urs-id">#{req.id_solicitud}</span>
                                                                {!isMine && <span className="adl-urs-from">{req.nombre_solicitante?.split(' ').slice(0, 2).join(' ')}</span>}
                                                            </span>
                                                            <span className="adl-urs-time">{formatDateTime(req.fecha_solicitud)}</span>
                                                        </div>
                                                        <div className={`adl-urs-subject ${unread ? 'unread' : ''}`}>{req.titulo || req.nombre_tipo}</div>
                                                        <div className="adl-urs-itembottom">
                                                            <span className="adl-urs-itembl">
                                                                <Tag color={STATUS_TAG[req.estado] || 'default'} style={{ marginInlineEnd: 0 }}>
                                                                    {STATUS_LABEL[req.estado] || req.estado}
                                                                </Tag>
                                                                {unread && <Badge color="red" />}
                                                            </span>
                                                            <IconChevronRight size={18} color={C.textTer} />
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="adl-urs-empty">
                                    <IconFolderOpen size={40} opacity={0.5} />
                                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No hay solicitudes." />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* COLUMNA 2 · Detalle */}
                {(!isMobile || selectedRequestId) && (
                    <div className="adl-urs-col2">
                        {isMobile && selectedRequestId && (
                            <div className="adl-urs-mobilebar">
                                <Button type="text" icon={<IconArrowLeft size={18} />} onClick={() => setSelectedRequestId(null)}>Detalle de solicitud</Button>
                                <span className="adl-urs-id">#{selectedRequestId}</span>
                            </div>
                        )}
                        {loadingDetail ? (
                            <div className="adl-urs-center"><Spin tip="Abriendo solicitud…"><div style={{ padding: 40 }} /></Spin></div>
                        ) : selectedRequest ? (
                            <div className="adl-urs-detail">
                                <RequestDetailPanel request={selectedRequest} onRequestUpdate={loadInitialData} onReload={() => loadRequestDetail(selectedRequestId!, true)} />
                                {isMobile && (
                                    <div style={{ marginTop: 16 }}>
                                        <div className="adl-urs-group">Actividad y chat</div>
                                        <RequestActivityAndChat request={selectedRequest} onReload={() => loadRequestDetail(selectedRequestId!, true)} />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="adl-urs-emptydetail">
                                <IconCalendarEvent size={48} opacity={0.4} />
                                <h2>Selecciona una solicitud</h2>
                                <span>Haz clic en la lista para ver detalles.</span>
                            </div>
                        )}
                    </div>
                )}

                {/* COLUMNA 3 · Actividad y chat */}
                {!isMobile && (
                    <div className="adl-urs-col3">
                        {selectedRequest ? (
                            <RequestActivityAndChat request={selectedRequest} onReload={() => loadRequestDetail(selectedRequestId!, true)} />
                        ) : (
                            <div className="adl-urs-center"><IconClock size={40} color={C.textTer} opacity={0.5} /></div>
                        )}
                    </div>
                )}
            </div>
        </ConfigProvider>
    );
};

export default UniversalInbox;
