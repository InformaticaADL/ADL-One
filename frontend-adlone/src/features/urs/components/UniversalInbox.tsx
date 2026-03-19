import React, { useState, useEffect, useMemo } from 'react';
import { ursService } from '../../../services/urs.service';
import { useNavStore } from '../../../store/navStore';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotificationStore } from '../../../store/notificationStore';
import RequestDetailPanel from './RequestDetailPanel';
import RequestActivityAndChat from './RequestActivityAndChat';
import './UniversalInbox.css';

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
}

const UniversalInbox: React.FC = () => {
    const { 
        setActiveSubmodule, 
        pendingRequestId, 
        setPendingRequestId, 
        selectedRequestId, 
        setSelectedRequestId,
        ursInboxMode, 
        setUrsInboxMode 
    } = useNavStore();
    const { user } = useAuth();
    const { markAsReadByRef } = useNotificationStore();
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState({ status: '', area: '', type: '' });
    // const [inboxMode, setInboxMode] = useState<'RECEIVED' | 'SENT'>('RECEIVED'); // Replaced by store
    // const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null); // Replaced by store
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const reqs = await ursService.getRequests();
            setRequests(reqs);
        } catch (error) {
            console.error("Error loading inbox data:", error);
        } finally {
            setLoading(false);
        }
    };

    // Optimistic reading
    const loadRequestDetail = async (id: number, silent = false) => {
        if (!silent) setLoadingDetail(true);
        
        // OPTIMISTIC: Mark as read in local state immediately
        setRequests(prev => prev.map(r => 
            r.id_solicitud === id ? { ...r, unread_count: 0 } : r
        ));

        try {
            // Mark as read in backend and local store
            markAsReadByRef(id);

            const data = await ursService.getRequestDetail(id);
            setSelectedRequest(data);
            
            // Re-fetch inbox to sync 'unread' flags visually
            // const updatedReqs = await ursService.getRequests(); // No need to full fetch here if we have polling
            // setRequests(updatedReqs);
        } catch (error) {
            console.error("Error loading request detail:", error);
        } finally {
            if (!silent) setLoadingDetail(false);
        }
    };


    useEffect(() => {
        loadInitialData();
    }, []);

    // Handle deep-linking from notifications (Phase 25)
    useEffect(() => {
        if (pendingRequestId && !loading) {
            setSelectedRequestId(pendingRequestId);
            setPendingRequestId(null); // Clear after use
        }
    }, [pendingRequestId, loading]);

    useEffect(() => {
        if (selectedRequestId) {
            loadRequestDetail(selectedRequestId);
        } else {
            setSelectedRequest(null);
        }
    }, [selectedRequestId]);

    // Polling for real-time messages (Phase 13)
    useEffect(() => {
        if (!selectedRequestId) return;
        const interval = setInterval(() => {
            loadRequestDetail(selectedRequestId, true);
        }, 5000); // 5 seconds (fast enough for local network collab)
        return () => clearInterval(interval);
    }, [selectedRequestId]);

    // Polling for the request list (Phase 27)
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const reqs = await ursService.getRequests();
                // Simple functional update to avoid unnecessary re-renders if nothing changed deeply
                // but usually we just set it since getRequests is relatively cheap
                setRequests(reqs);
            } catch (error) {
                console.error("Error polling inbox list:", error);
            }
        }, 30000); // Setiap 30 seconds for the list
        return () => clearInterval(interval);
    }, []);

    const formatDateTime = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) {
            return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString('es-CL', { 
            day: '2-digit', 
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).replace(',', '');
    };

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'PENDIENTE': return { color: '#c2410c', label: 'Pendiente' };
            case 'APROBADO': return { color: '#15803d', label: 'Aprobado' };
            case 'RECHAZADO': return { color: '#b91c1c', label: 'Rechazado' };
            case 'EN_REVISION': return { color: '#1d4ed8', label: 'En Revisión' };
            default: return { color: '#64748b', label: status };
        }
    };

    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            // Mode Filter (Sent vs Received)
            const isMine = Number(req.id_solicitante) === Number(user?.id);
            if (ursInboxMode === 'SENT' && !isMine) return false;
            if (ursInboxMode === 'RECEIVED' && isMine) return false;

            const matchesSearch = (req.titulo || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                   (req.nombre_solicitante || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                   req.id_solicitud.toString().includes(searchTerm);
            
            const matchesStatus = !filter.status || req.estado === filter.status;
            const matchesArea = !filter.area || req.area_destino === filter.area;
            const matchesType = !filter.type || req.nombre_tipo === filter.type;

            return matchesSearch && matchesStatus && matchesArea && matchesType;
        });
    }, [requests, searchTerm, filter, ursInboxMode, user]);

    return (
        <div className="universal-dashboard">
            {/* COLUMN 1: INBOX LIST */}
            <div className="col-inbox">
                <header className="inbox-header">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2>Solicitudes</h2>
                        <button className="btn-new-solicitud" onClick={() => setActiveSubmodule('urs-new-request')}>
                            <span>+</span> Nueva
                        </button>
                    </div>

                    <div className="inbox-mode-toggle">
                        <button 
                            className={`mode-btn ${ursInboxMode === 'RECEIVED' ? 'active' : ''}`}
                            onClick={() => setUrsInboxMode('RECEIVED')}
                        >
                            📥 Recibidas
                        </button>
                        <button 
                            className={`mode-btn ${ursInboxMode === 'SENT' ? 'active' : ''}`}
                            onClick={() => setUrsInboxMode('SENT')}
                        >
                            📤 Enviadas
                        </button>
                    </div>

                    <div className="branded-search-group" style={{ marginTop: '0.75rem' }}>
                        <div className="search-input-wrapper">
                            <span className="search-icon-v3">🔍</span>
                            <input 
                                type="text" 
                                placeholder="Buscar..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input-v3"
                            />
                        </div>
                    </div>

                    <div className="branded-filters">
                        <div className="custom-dropdown">
                             <label className="filter-label">Estado</label>
                             <select 
                                className="dropdown-trigger" 
                                value={filter.status} 
                                onChange={(e) => setFilter({...filter, status: e.target.value})}
                                style={{ appearance: 'none' }}
                             >
                                <option value="">Todos</option>
                                <option value="PENDIENTE">⏳ Pendientes</option>
                                <option value="APROBADO">✅ Aprobados</option>
                                <option value="RECHAZADO">❌ Rechazados</option>
                            </select>
                        </div>
                        
                        <div className="custom-dropdown">
                             <label className="filter-label">Área</label>
                             <select 
                                className="dropdown-trigger" 
                                value={filter.area} 
                                onChange={(e) => setFilter({...filter, area: e.target.value})}
                                style={{ appearance: 'none' }}
                             >
                                <option value="">Todas</option>
                                <option value="INF">💻 TI</option>
                                <option value="GC">⭐ Calidad</option>
                            </select>
                        </div>
                    </div>
                </header>

                <div className="inbox-list">
                    {loading ? (
                        <div className="v2-loading"><div className="v2-spinner"></div></div>
                    ) : (filteredRequests.length > 0 ? (
                        (() => {
                            const groups: { [key: string]: Request[] } = {};
                            filteredRequests.forEach(req => {
                                const date = new Date(req.fecha_solicitud);
                                const today = new Date();
                                const yesterday = new Date();
                                yesterday.setDate(yesterday.getDate() - 1);

                                let group = 'Más antiguas';
                                if (date.toDateString() === today.toDateString()) group = 'Hoy';
                                else if (date.toDateString() === yesterday.toDateString()) group = 'Ayer';
                                else if (date > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) group = 'Esta semana';

                                if (!groups[group]) groups[group] = [];
                                groups[group].push(req);
                            });

                            return ['Hoy', 'Ayer', 'Esta semana', 'Más antiguas'].map(label => {
                                const groupReqs = groups[label];
                                if (!groupReqs || groupReqs.length === 0) return null;
                                return (
                                    <React.Fragment key={label}>
                                        <div className="inbox-group-label">{label}</div>
                                        {groupReqs.map((req) => {
                                            const status = getStatusInfo(req.estado);
                                            const isMine = Number(req.id_solicitante) === Number(user?.id);
                                            const unread = (req as any).unread_count > 0;
                                            return (
                                                <div 
                                                    key={req.id_solicitud} 
                                                    className={`req-item ${selectedRequestId === req.id_solicitud ? 'active' : ''} ${unread ? 'unread' : ''}`}
                                                    onClick={() => setSelectedRequestId(req.id_solicitud)}
                                                >
                                                    <div className="req-item-top">
                                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                            <span className="req-item-id">#{req.id_solicitud}</span>
                                                            <span className={`origin-badge ${isMine ? 'sent' : 'received'}`}>
                                                                {isMine ? 'MÍO' : req.nombre_solicitante?.split(' ')[0]}
                                                            </span>
                                                        </div>
                                                        <span className="req-item-date">{formatDateTime(req.fecha_solicitud)}</span>
                                                    </div>
                                                    <div className="req-item-title" style={{ fontWeight: unread ? 800 : 500 }}>{req.titulo || req.nombre_tipo}</div>
                                                    <div className="req-item-meta">
                                                        <span className="status-dot" style={{ backgroundColor: status.color }}></span>
                                                        <span style={{ fontWeight: unread ? 700 : 400 }}>{status.label}</span>
                                                        <span style={{ marginLeft: 'auto' }}>
                                                            {unread && <span className="msg-count-dot"></span>}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            });
                        })()
                    ) : (
                        <div className="empty-inbox-state">
                            <span className="empty-icon">📂</span>
                            <p>No hay solicitudes que mostrar.</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* COLUMN 2: DETAILS */}
            <div className="col-details">
                {loadingDetail ? (
                    <div className="v2-loading"><div className="v2-spinner"></div><p>Abriendo solicitud...</p></div>
                ) : selectedRequest ? (
                    <RequestDetailPanel 
                        request={selectedRequest} 
                        onRequestUpdate={loadInitialData}
                        onReload={() => loadRequestDetail(selectedRequestId!, true)}
                    />
                ) : (
                    <div className="details-placeholder">
                        <div className="details-placeholder-icon">📋</div>
                        <h3>Selecciona una solicitud</h3>
                        <p>Haz clic en cualquier item de la lista para ver sus detalles y gestión.</p>
                    </div>
                )}
            </div>

            {/* COLUMN 3: ACTIVITY & MESSAGES */}
            {selectedRequest ? (
                <RequestActivityAndChat 
                    request={selectedRequest} 
                    onReload={() => loadRequestDetail(selectedRequestId!, true)}
                />
            ) : (
                <div className="col-activity">
                    <div className="details-placeholder" style={{ background: 'white' }}>
                        <div className="details-placeholder-icon">💬</div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default UniversalInbox;
