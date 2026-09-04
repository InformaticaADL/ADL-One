import { ursService } from '../../../services/urs.service';
import { useAuth } from '../../../contexts/AuthContext';
import React, { useState, useMemo } from 'react';
import FileIcon from './FileIcon';
import DeriveRequestModal from './DeriveRequestModal';
import { useToast } from '../../../contexts/ToastContext';
import { ConfigProvider, Card, Tag, Alert, Button, Timeline, Modal, Input, Typography } from 'antd';
import {
    IconFileText, IconCalendar, IconUser, IconAlertCircle, IconDownload, IconCheck, IconX,
    IconSearch, IconArrowUpRight, IconLock, IconMapPin, IconDeviceDesktop, IconAlertTriangle,
    IconArrowsExchange, IconHistory, IconArrowRight, IconChevronDown, IconChevronUp, IconCheckbox, IconBan,
} from '@tabler/icons-react';

const { TextArea } = Input;
const { Text } = Typography;

const CODE_VALUE_MAP: Record<string, string> = {
    'VIDA_UTIL': 'Vida Útil', 'DANIO': 'Daño', 'DANO': 'Daño', 'OBSOLESCENCIA': 'Obsolescencia',
    'PERDIDA': 'Pérdida', 'ROBO': 'Robo', 'DETERIORO': 'Deterioro', 'REEMPLAZO': 'Reemplazo', 'OTRO': 'Otro',
    'EN_REVISION': 'En Revisión', 'PENDIENTE': 'Pendiente', 'ACEPTADA': 'Aceptada', 'RECHAZADA': 'Rechazada',
    'REALIZADA': 'Realizada', 'CANCELADA': 'Cancelada', 'NORMAL': 'Normal', 'ALTA': 'Alta', 'CRITICO': 'Crítico',
    'URGENTE': 'Urgente', 'MEDIA': 'Media', 'BAJA': 'Baja',
};

const formatCodeValue = (value: string | null | undefined): string => {
    if (!value) return 'N/A';
    const upper = String(value).trim().toUpperCase();
    if (CODE_VALUE_MAP[upper]) return CODE_VALUE_MAP[upper];
    return String(value)
        .replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
        .replace(/\bDe\b/g, 'de').replace(/\bDel\b/g, 'del').replace(/\bY\b/g, 'y')
        .replace(/\bEn\b/g, 'en').replace(/\bA\b/g, 'a');
};

const STATUS_LABEL: Record<string, string> = {
    PENDIENTE: 'Pendiente', EN_REVISION: 'En revisión', ACEPTADA: 'Aceptada',
    REALIZADA: 'Realizada', RECHAZADA: 'Rechazada', CANCELADA: 'Cancelada',
};
const STATUS_TAG: Record<string, string> = {
    PENDIENTE: 'gold', EN_REVISION: 'blue', ACEPTADA: 'green',
    REALIZADA: 'geekblue', RECHAZADA: 'red', CANCELADA: 'default',
};

const C = {
    border: '#f0f0f0', text: 'rgba(0,0,0,0.88)', textSec: 'rgba(0,0,0,0.65)', textTer: 'rgba(0,0,0,0.45)',
    primary: '#1677ff', primaryBg: '#e6f4ff', primaryBorder: '#91caff',
    green: '#389e0d', greenBg: '#f6ffed', greenBorder: '#b7eb8f',
    red: '#cf1322', redBg: '#fff1f0', redBorder: '#ffccc7', orange: '#d46b08',
    bg: '#ffffff', bgLayout: '#fafafa',
};

const CSS = `
.adl-rd-root { display:flex; flex-direction:column; row-gap:16px; max-width:820px; margin:0 auto; width:100%; }
.adl-rd-empty { display:flex; align-items:center; justify-content:center; height:100%; color:${C.textTer}; }
.adl-rd-cardhead { display:flex; align-items:center; column-gap:8px; }
.adl-rd-icon { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:6px; background:${C.primaryBg}; color:${C.primary}; flex-shrink:0; }
.adl-rd-sectitle { margin:0; font-size:16px; font-weight:600; color:${C.text}; }
.adl-rd-idrow { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
.adl-rd-title { margin:0 0 14px; font-size:20px; font-weight:700; letter-spacing:-.3px; color:${C.text}; }
.adl-rd-mtag { display:flex; align-items:center; column-gap:4px; font-size:12px; font-weight:600; color:${C.primary}; margin-bottom:10px; }
.adl-rd-meta { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:16px; }
.adl-rd-metaitem { display:flex; column-gap:8px; align-items:flex-start; min-width:0; }
.adl-rd-metaicon { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:6px; background:${C.bgLayout}; color:${C.textSec}; flex-shrink:0; }
.adl-rd-label { font-size:11px; text-transform:uppercase; font-weight:700; color:${C.textTer}; letter-spacing:.4px; }
.adl-rd-value { font-size:14px; font-weight:600; color:${C.text}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.adl-rd-tiles { display:flex; flex-direction:column; row-gap:12px; }
.adl-rd-tile { border:1px solid ${C.border}; border-radius:8px; padding:12px; background:${C.bgLayout}; display:flex; flex-direction:column; row-gap:3px; }
.adl-rd-tile.brand { background:${C.primaryBg}; border-color:${C.primaryBorder}; }
.adl-rd-tile.danger { background:${C.redBg}; border-color:${C.redBorder}; }
.adl-rd-tile.success { background:${C.greenBg}; border-color:${C.greenBorder}; }
.adl-rd-tile.icon { flex-direction:row; align-items:center; column-gap:8px; }
.adl-rd-valuelg { font-size:17px; font-weight:700; color:${C.text}; }
.adl-rd-tilerow { display:flex; align-items:center; justify-content:space-between; column-gap:8px; }
.adl-rd-grid2 { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; }
.adl-rd-swap { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; column-gap:12px; }
.adl-rd-swapcol { text-align:center; display:flex; flex-direction:column; row-gap:2px; }
.adl-rd-kv { display:flex; justify-content:space-between; column-gap:12px; padding:6px 0; border-bottom:1px solid ${C.border}; }
.adl-rd-kvk { font-size:14px; color:${C.textTer}; text-transform:capitalize; }
.adl-rd-kvv { font-size:14px; font-weight:600; text-align:right; color:${C.text}; }
.adl-rd-file { display:flex; align-items:center; justify-content:space-between; column-gap:12px; padding:12px; border:1px solid ${C.border}; border-radius:8px; text-decoration:none; color:inherit; cursor:pointer; transition:background .15s; }
.adl-rd-file:hover { background:${C.bgLayout}; }
.adl-rd-filemeta { display:flex; align-items:center; column-gap:8px; min-width:0; }
.adl-rd-filename { font-size:14px; font-weight:600; color:${C.primary}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.adl-rd-filesub { font-size:11px; color:${C.textTer}; }
.adl-rd-muted { font-size:14px; color:${C.textTer}; text-align:center; padding:16px 0; display:block; }
.adl-rd-actions { display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:8px; }
.adl-rd-collapse { display:flex; align-items:center; justify-content:space-between; width:100%; background:none; border:none; padding:0; cursor:pointer; }
`;

const bulletColor = (action: string): string => {
    const a = action.toUpperCase();
    if (a.includes('ACEPTADA') || a.includes('APROBAD')) return C.green;
    if (a.includes('REALIZADA')) return '#237804';
    if (a.includes('RECHAZAD')) return C.red;
    if (a.includes('REVISION')) return C.primary;
    if (a.includes('DERIVAD')) return '#722ed1';
    return '#8c8c8c';
};
const actionTag = (action: string): string => {
    const a = action.toUpperCase();
    if (a.includes('ACEPTADA') || a.includes('APROBAD') || a.includes('REALIZADA')) return 'green';
    if (a.includes('RECHAZAD')) return 'red';
    if (a.includes('REVISION')) return 'blue';
    if (a.includes('DERIVAD')) return 'purple';
    return 'default';
};

interface RequestDetailPanelProps {
    request: any;
    onRequestUpdate: () => void;
    onReload: () => void;
}

const RequestDetailPanel: React.FC<RequestDetailPanelProps> = ({ request, onRequestUpdate, onReload }) => {
    const [isDeriving, setIsDeriving] = useState(false);
    const { token, user } = useAuth();
    const { showToast } = useToast();

    const [obsModalOpen, setObsModalOpen] = useState(false);
    const [obsText, setObsText] = useState('');
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);

    const isClosed = request?.estado === 'REALIZADA' || request?.estado === 'RECHAZADA' || request?.estado === 'CANCELADA';
    const isCreator = Number(request?.id_solicitante) === Number(user?.id);
    const canCancel = !isClosed && request?.estado === 'PENDIENTE' && isCreator;

    const actionHistory = useMemo(() => {
        if (!request) return [];
        const items: { date: string; action: string; user: string; observation: string; type: string }[] = [];
        (request.conversacion || []).forEach((msg: any) => {
            if (msg.es_sistema) {
                let action = msg.mensaje || '';
                let obs = '';
                const match = action.match(/^Cambio de estado a ([^:]+)(?::\s*(.+))?$/);
                if (match) { action = match[1].trim(); obs = match[2]?.trim() || ''; }
                items.push({ date: msg.fecha, action, user: msg.nombre_usuario || 'Sistema', observation: obs, type: 'status' });
            }
        });
        (request.historial_derivaciones || []).forEach((d: any) => {
            items.push({
                date: d.fecha,
                action: `Derivada → ${d.usuario_destino || d.rol_destino || d.area_destino || 'Otro destino'}`,
                user: d.usuario_origen || 'Sistema', observation: d.motivo || '', type: 'derivation',
            });
        });
        items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return items;
    }, [request]);

    const openObservationModal = (actionType: string) => { setPendingAction(actionType); setObsText(''); setObsModalOpen(true); };

    const getActionLabel = (actionType: string | null) => {
        switch (actionType) {
            case 'ACEPTADA': return 'Aceptar Solicitud';
            case 'RECHAZADA': return 'Rechazar Solicitud';
            case 'EN_REVISION': return 'Poner En Revisión';
            case 'REALIZADA': return 'Marcar como Realizada';
            case 'CANCELADA': return 'Cancelar Solicitud';
            default: return 'Confirmar';
        }
    };

    const confirmAction = async () => {
        if (!pendingAction || !obsText.trim()) return;
        setActionLoading(true);
        try {
            await ursService.updateStatus(request.id_solicitud, { status: pendingAction, comment: obsText.trim() });
            const messages: Record<string, string> = {
                'ACEPTADA': 'Solicitud aceptada correctamente', 'RECHAZADA': 'Solicitud rechazada',
                'EN_REVISION': 'Solicitud puesta en revisión', 'REALIZADA': 'Solicitud marcada como realizada',
                'CANCELADA': 'Solicitud cancelada',
            };
            showToast({ message: messages[pendingAction] || 'Estado actualizado', type: 'success' });
            setObsModalOpen(false);
            onReload();
            onRequestUpdate();
        } catch (error) {
            console.error('Error updating status:', error);
            showToast({ message: 'Error al actualizar el estado', type: 'error' });
        } finally { setActionLoading(false); }
    };

    if (!request) return <div className="adl-rd-empty">Selecciona una solicitud</div>;

    const priorityColor = (p?: string) => {
        const priority = p?.toUpperCase() || 'NORMAL';
        if (priority === 'ALTA' || priority === 'CRITICO' || priority === 'URGENTE') return C.red;
        if (priority === 'MEDIA') return C.orange;
        return C.primary;
    };

    const dj = request.datos_json || {};

    return (
        <ConfigProvider theme={{ token: { colorPrimary: C.primary, borderRadius: 8 } }}>
            <style>{CSS}</style>
            <div className="adl-rd-root">
                {/* Header */}
                <Card size="small" styles={{ body: { padding: 16 } }}>
                    <div className="adl-rd-idrow">
                        <Tag>ID #{request.id_solicitud}</Tag>
                        <Tag color={STATUS_TAG[request.estado] || 'default'} style={{ marginInlineEnd: 0 }}>{STATUS_LABEL[request.estado] || request.estado}</Tag>
                    </div>
                    {(request.origen_solicitud === 'MUESTREADOR' || dj.origen_solicitud === 'MUESTREADOR' || dj.app_version) && (
                        <div className="adl-rd-mtag">📱 Solicitud enviada vía aplicación móvil ADL Sampling</div>
                    )}
                    <h2 className="adl-rd-title">{request.titulo || request.nombre_tipo}</h2>
                    <div className="adl-rd-meta">
                        <div className="adl-rd-metaitem">
                            <span className="adl-rd-metaicon"><IconFileText size={15} /></span>
                            <div style={{ minWidth: 0 }}>
                                <div className="adl-rd-label">Tipo</div>
                                <div className="adl-rd-value">{request.nombre_tipo}</div>
                            </div>
                        </div>
                        <div className="adl-rd-metaitem">
                            <span className="adl-rd-metaicon"><IconCalendar size={15} /></span>
                            <div>
                                <div className="adl-rd-label">Creada</div>
                                <div className="adl-rd-value">{new Date(request.fecha_creacion).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                            </div>
                        </div>
                        <div className="adl-rd-metaitem">
                            <span className="adl-rd-metaicon"><IconAlertCircle size={15} /></span>
                            <div>
                                <div className="adl-rd-label">Prioridad</div>
                                <div className="adl-rd-value" style={{ color: priorityColor(request.prioridad) }}>{request.prioridad || 'NORMAL'}</div>
                            </div>
                        </div>
                        <div className="adl-rd-metaitem">
                            <span className="adl-rd-metaicon" style={{ background: C.primaryBg, color: C.primary }}><IconUser size={15} /></span>
                            <div style={{ minWidth: 0 }}>
                                <div className="adl-rd-label">Solicitante</div>
                                <div className="adl-rd-value">{request.nombre_solicitante}</div>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Observations */}
                {request.observaciones && (
                    <Alert type="info" showIcon message="Observaciones del Solicitante"
                        description={<Text italic>"{request.observaciones}"</Text>} />
                )}

                {/* Data Detail */}
                <Card size="small" styles={{ body: { padding: 16 } }}
                    title={<div className="adl-rd-cardhead"><span className="adl-rd-icon"><IconFileText size={17} /></span><span className="adl-rd-sectitle">Detalle de la Información</span></div>}>
                    <div className="adl-rd-tiles">
                        {request.id_tipo === 7 || request.id_tipo === 8 ? (
                            <>
                                <div className="adl-rd-tile brand">
                                    <div className="adl-rd-label">Muestreador a deshabilitar</div>
                                    <div className="adl-rd-tilerow">
                                        <span className="adl-rd-valuelg">{dj.muestreador_origen_nombre}</span>
                                        <Tag color="blue" style={{ marginInlineEnd: 0 }}>ID: {dj.muestreador_origen_id || 'N/A'}</Tag>
                                    </div>
                                </div>
                                <div className="adl-rd-grid2">
                                    <div className="adl-rd-tile">
                                        <div className="adl-rd-label">Traspaso de equipos</div>
                                        <span className="adl-rd-value" style={{ color: dj.muestreador_origen_id ? C.green : C.red }}>
                                            {dj.reasignacion_manual || dj.muestreador_destino_nombre || dj.base_destino ? '✅ SI' : '❌ NO'}
                                        </span>
                                    </div>
                                    <div className="adl-rd-tile">
                                        <div className="adl-rd-label">Tipo de traspaso</div>
                                        <span className="adl-rd-value">
                                            {dj.tipo_traspaso === 'IGUAL' || dj.tipo_traspaso === 'MUESTREADOR' ? 'A un Muestreador' :
                                                dj.tipo_traspaso === 'BASE' ? 'BASE' :
                                                    dj.tipo_traspaso === 'DISTINGO' || dj.tipo_traspaso === 'MANUAL' ? 'Personalizado' :
                                                        dj.tipo_traspaso || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                                <div className="adl-rd-tile">
                                    <div className="adl-rd-label">Destino Final</div>
                                    <span className="adl-rd-value">
                                        {dj.tipo_traspaso === 'IGUAL' || dj.tipo_traspaso === 'MUESTREADOR' ? `👤 ${dj.muestreador_destino_nombre || 'Muestreador No Especificado'}` :
                                            dj.tipo_traspaso === 'BASE' ? `🏢 ${dj.base_destino || 'Base No Especificada'}` :
                                                dj.tipo_traspaso === 'DISTINGO' || dj.tipo_traspaso === 'MANUAL' ? `🛠️ Reasignación Manual (${dj.reasignacion_manual?.length || 0} equipos)` :
                                                    `❓ ${dj.tipo_traspaso || 'No definido'}`}
                                    </span>
                                </div>
                            </>
                        ) : (request.id_tipo === 1 || dj._form_type === 'ACTIVACION_EQUIPO') ? (
                            <>
                                <div className="adl-rd-tile brand">
                                    <div className="adl-rd-label">Nombre del Equipo</div>
                                    <span className="adl-rd-valuelg">{dj.nombre_equipo}</span>
                                </div>
                                <div className="adl-rd-grid2">
                                    <div className="adl-rd-tile icon">
                                        <IconDeviceDesktop size={18} />
                                        <div>
                                            <div className="adl-rd-label">Tipo de Dispositivo</div>
                                            <span className="adl-rd-value">{dj.tipo_equipo || 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div className="adl-rd-tile icon">
                                        <IconMapPin size={18} />
                                        <div>
                                            <div className="adl-rd-label">Sede / Ubicación</div>
                                            <span className="adl-rd-value">{dj.nombre_ubicacion || dj.nombre_centro || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (request.id_tipo === 2 || request.id_tipo === 6 || dj._form_type === 'BAJA_EQUIPO') ? (
                            <>
                                <Alert type="error" showIcon icon={<IconAlertTriangle size={18} />} message="Equipo Desvinculado"
                                    description={<span className="adl-rd-value">{dj.nombre_equipo_full}</span>} />
                                <div className="adl-rd-grid2">
                                    <div className="adl-rd-tile">
                                        <div className="adl-rd-label">Causa</div>
                                        <span className="adl-rd-value" style={{ color: C.red }}>{formatCodeValue(dj.motivo)}</span>
                                    </div>
                                    <div className="adl-rd-tile">
                                        <div className="adl-rd-label">Fecha Efectiva</div>
                                        <span className="adl-rd-value">
                                            📅 {dj.fecha_baja ? (() => {
                                                const parts = String(dj.fecha_baja).split('T')[0].split('-');
                                                return parts.length === 3 ? (parts[0].length === 4 ? `${parts[2]}/${parts[1]}/${parts[0]}` : parts.join('/')) : dj.fecha_baja;
                                            })() : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </>
                        ) : ([10, 11, 12, 13, 14, 15].includes(Number(request.id_tipo))) ? (
                            <>
                                <div className={`adl-rd-tile ${Number(request.id_tipo) === 12 ? 'danger' : 'brand'}`}>
                                    <div className="adl-rd-label">
                                        {Number(request.id_tipo) === 11 ? 'Equipo Referenciado (Extravío)' :
                                            Number(request.id_tipo) === 10 ? 'Equipo Referenciado (Problema Técnico)' :
                                                Number(request.id_tipo) === 14 ? 'Equipo Referenciado (Consulta)' :
                                                    Number(request.id_tipo) === 15 ? 'Ficha/Servicio Referenciado (Consulta)' :
                                                        Number(request.id_tipo) === 12 ? 'Servicio a Anular' : 'Consulta General'}
                                    </div>
                                    <span className="adl-rd-valuelg" style={{ color: Number(request.id_tipo) === 12 ? C.red : C.primary }}>
                                        {(() => {
                                            const name = dj.nombre_equipo_full || dj.equipo_nombre || dj.nombre_equipo || dj.id_muestreo || dj.correlativo || dj.num_ficha;
                                            const code = dj.codigo_equipo || dj.equipo_codigo;
                                            if (!name && !code) return 'N/A';
                                            if (typeof name === 'string' && name.includes('[')) return name;
                                            if (name && code) return `${name} [${code}]`;
                                            return name || code;
                                        })()}
                                    </span>
                                </div>
                                {(dj.fecha_extravio || dj.fecha_suceso || dj.fecha_ocurrencia) && (
                                    <div className="adl-rd-tile icon">
                                        <IconCalendar size={18} color={C.primary} />
                                        <div>
                                            <div className="adl-rd-label">Fecha del Suceso</div>
                                            <span className="adl-rd-value">
                                                📅 {(() => {
                                                    const d = dj.fecha_extravio || dj.fecha_suceso || dj.fecha_ocurrencia;
                                                    if (!d) return 'N/A';
                                                    const parts = String(d).split('T')[0].split('-');
                                                    if (parts.length === 3) return parts[0].length === 4 ? `${parts[2]}/${parts[1]}/${parts[0]}` : parts.join('/');
                                                    return String(d);
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (request.id_tipo === 3 || dj._form_type === 'TRASPASO_EQUIPO') ? (
                            <>
                                <div className="adl-rd-tile success">
                                    <div className="adl-rd-label">Equipo en Traspaso</div>
                                    <span className="adl-rd-valuelg">{dj.nombre_equipo_full}</span>
                                </div>
                                {dj.traspaso_de?.includes('UBICACION') && (
                                    <div className="adl-rd-tile">
                                        <div className="adl-rd-label" style={{ marginBottom: 6 }}>Cambio de Ubicación</div>
                                        <div className="adl-rd-swap">
                                            <div className="adl-rd-swapcol"><span className="adl-rd-label">Actual</span><span className="adl-rd-value">{dj.info_actual?.ubicacion || 'N/A'}</span></div>
                                            <IconArrowsExchange size={20} color={C.primary} />
                                            <div className="adl-rd-swapcol"><span className="adl-rd-label" style={{ color: C.primary }}>Nueva</span><span className="adl-rd-value">{dj.nombre_centro_destino}</span></div>
                                        </div>
                                    </div>
                                )}
                                {dj.traspaso_de?.includes('RESPONSABLE') && (
                                    <div className="adl-rd-tile">
                                        <div className="adl-rd-label" style={{ marginBottom: 6 }}>Cambio de Responsable</div>
                                        <div className="adl-rd-swap">
                                            <div className="adl-rd-swapcol"><span className="adl-rd-label">Actual</span><span className="adl-rd-value">{dj.info_actual?.responsable || 'N/A'}</span></div>
                                            <IconArrowsExchange size={20} color={C.green} />
                                            <div className="adl-rd-swapcol"><span className="adl-rd-label" style={{ color: C.green }}>Nuevo</span><span className="adl-rd-value">{dj.nombre_muestreador_destino}</span></div>
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div>
                                {dj && typeof dj === 'object' && Object.keys(dj).length > 0 ? (
                                    Object.entries(dj).map(([key, value]) => {
                                        if (['prioridad', 'titulo', 'descripcion', '_form_type'].includes(key)) return null;
                                        return (
                                            <div key={key} className="adl-rd-kv">
                                                <span className="adl-rd-kvk">{key.replace(/_/g, ' ')}</span>
                                                <span className="adl-rd-kvv">{formatCodeValue(String(value))}</span>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <span className="adl-rd-muted">No hay datos específicos disponibles.</span>
                                )}
                            </div>
                        )}
                    </div>
                </Card>

                {/* Attachments */}
                <Card size="small" styles={{ body: { padding: 16 } }}
                    title={<div className="adl-rd-cardhead"><span className="adl-rd-icon"><IconDownload size={17} /></span><span className="adl-rd-sectitle">Archivos Adjuntos</span></div>}>
                    <div style={{ display: 'flex', flexDirection: 'column', rowGap: 8 }}>
                        {request.archivos_adjuntos && request.archivos_adjuntos.length > 0 ? (
                            request.archivos_adjuntos.map((file: any) => (
                                <a key={file.id_adjunto} className="adl-rd-file" target="_blank" rel="noreferrer"
                                    href={`${import.meta.env.VITE_API_URL}/api/urs/download/${file.id_adjunto}?token=${token}`}>
                                    <span className="adl-rd-filemeta">
                                        <FileIcon mimetype={file.tipo_archivo} filename={file.nombre_archivo} size={28} />
                                        <span style={{ minWidth: 0 }}>
                                            <div className="adl-rd-filename">{file.nombre_archivo}</div>
                                            <div className="adl-rd-filesub">{(file.tipo_archivo || 'Archivo').toUpperCase()} • {new Date(file.fecha).toLocaleDateString()}</div>
                                        </span>
                                    </span>
                                    <IconDownload size={18} color={C.textTer} />
                                </a>
                            ))
                        ) : (
                            <span className="adl-rd-muted">No hay archivos adjuntos.</span>
                        )}
                    </div>
                </Card>

                {/* Status message */}
                {request.estado === 'ACEPTADA' && <Alert type="success" showIcon message="Solicitud aceptada, se le avisará cuando se haya realizado lo solicitado." />}
                {request.estado === 'REALIZADA' && <Alert type="success" showIcon message="Solicitud realizada, por ende se cierra esta solicitud." />}
                {request.estado === 'RECHAZADA' && <Alert type="error" showIcon message="Solicitud rechazada. No se pueden realizar más acciones." />}
                {request.estado === 'EN_REVISION' && <Alert type="info" showIcon message="Solicitud en revisión. Se está evaluando para proceder." />}
                {request.estado === 'CANCELADA' && <Alert type="warning" showIcon message="Solicitud cancelada por el solicitante." />}

                {/* Management */}
                {!isClosed && (
                    <Card size="small" styles={{ body: { padding: 16 } }}
                        title={<div className="adl-rd-cardhead"><span className="adl-rd-icon" style={{ background: C.text, color: '#fff' }}><IconCheck size={17} /></span><span className="adl-rd-sectitle">Gestión de Solicitud</span></div>}>
                        {(request.can_manage || request.can_derive) ? (
                            <div style={{ display: 'flex', flexDirection: 'column', rowGap: 8 }}>
                                {request.can_manage && request.estado !== 'ACEPTADA' && (
                                    <div className="adl-rd-actions">
                                        <Button type="primary" icon={<IconCheck size={16} />} style={{ background: C.green, borderColor: C.green }} onClick={() => openObservationModal('ACEPTADA')}>Aceptar</Button>
                                        <Button danger type="primary" icon={<IconX size={16} />} onClick={() => openObservationModal('RECHAZADA')}>Rechazar</Button>
                                        <Button type="primary" icon={<IconSearch size={16} />} onClick={() => openObservationModal('EN_REVISION')}>En Revisión</Button>
                                    </div>
                                )}
                                {request.can_derive && (
                                    <Button block icon={<IconArrowUpRight size={16} />} onClick={() => setIsDeriving(true)}>Derivar Solicitud</Button>
                                )}
                                {request.can_manage && request.estado === 'ACEPTADA' && (
                                    <Button block type="primary" size="large" icon={<IconCheckbox size={18} />} style={{ background: C.green, borderColor: C.green }} onClick={() => openObservationModal('REALIZADA')}>Marcar como Realizado</Button>
                                )}
                            </div>
                        ) : (
                            <Alert type="info" showIcon icon={<IconLock size={16} />} message="Modo Lectura" description="Usted tiene acceso de visualización para este trámite." />
                        )}
                    </Card>
                )}

                {/* Cancel */}
                {canCancel && (
                    <Card size="small" styles={{ body: { padding: 16 } }}>
                        <div className="adl-rd-tilerow">
                            <div>
                                <div className="adl-rd-value">¿Deseas retirar esta solicitud?</div>
                                <div className="adl-rd-filesub">Solo el solicitante puede cancelar mientras esté pendiente.</div>
                            </div>
                            <Button icon={<IconBan size={16} />} onClick={() => openObservationModal('CANCELADA')}>Cancelar solicitud</Button>
                        </div>
                    </Card>
                )}

                {/* History */}
                <Card size="small" styles={{ body: { padding: 16 } }}>
                    <button type="button" className="adl-rd-collapse" onClick={() => setHistoryOpen(!historyOpen)}>
                        <div className="adl-rd-cardhead">
                            <span className="adl-rd-icon" style={{ background: C.bgLayout, color: C.textSec }}><IconHistory size={17} /></span>
                            <span className="adl-rd-sectitle">Historial de Acciones</span>
                            {actionHistory.length > 0 && <Tag>{actionHistory.length}</Tag>}
                        </div>
                        {historyOpen ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                    </button>
                    {historyOpen && (
                        actionHistory.length > 0 ? (
                            <div style={{ maxHeight: 320, overflowY: 'auto', marginTop: 16 }}>
                                <Timeline items={actionHistory.map((item) => ({
                                    color: bulletColor(item.action),
                                    dot: item.type === 'derivation' ? <IconArrowRight size={14} color={bulletColor(item.action)} /> : undefined,
                                    children: (
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', columnGap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                                                <Tag color={actionTag(item.action)} style={{ marginInlineEnd: 0 }}>{formatCodeValue(item.action)}</Tag>
                                                <span style={{ fontSize: 11, color: C.textTer }}>
                                                    {new Date(item.date).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: 13, color: C.textSec }}>
                                                <span style={{ fontWeight: 600, color: C.text }}>{item.user || 'Sistema'}</span> • {item.observation || 'Sin detalle'}
                                            </div>
                                        </div>
                                    ),
                                }))} />
                            </div>
                        ) : (
                            <span className="adl-rd-muted">Sin movimientos registrados.</span>
                        )
                    )}
                </Card>

                {/* Observation Modal */}
                <Modal open={obsModalOpen} title={getActionLabel(pendingAction)}
                    onCancel={() => { setObsModalOpen(false); setPendingAction(null); }}
                    onOk={confirmAction} okText={getActionLabel(pendingAction)} cancelText="Cancelar"
                    confirmLoading={actionLoading} okButtonProps={{ disabled: !obsText.trim() }}>
                    <div style={{ display: 'flex', flexDirection: 'column', rowGap: 12 }}>
                        {(pendingAction === 'RECHAZADA' || pendingAction === 'REALIZADA' || pendingAction === 'CANCELADA') && (
                            <Alert type={pendingAction === 'RECHAZADA' ? 'error' : 'warning'} showIcon message={
                                pendingAction === 'RECHAZADA' ? 'Esta acción es irreversible. La solicitud quedará rechazada definitivamente.' :
                                    pendingAction === 'CANCELADA' ? 'La solicitud será cancelada. Esta acción no puede deshacerse.' :
                                        'Esta acción marcará la solicitud como completada. No podrá revertirse.'
                            } />
                        )}
                        <TextArea placeholder="Escriba sus observaciones para esta acción..." rows={4}
                            value={obsText} onChange={(e) => setObsText(e.target.value)} />
                    </div>
                </Modal>

                <DeriveRequestModal isOpen={isDeriving} requestId={request.id_solicitud} requestTypeId={request.id_tipo}
                    onClose={() => setIsDeriving(false)}
                    onSuccess={() => { showToast({ message: 'Solicitud derivada correctamente', type: 'success' }); onReload(); onRequestUpdate(); }} />
            </div>
        </ConfigProvider>
    );
};

export default RequestDetailPanel;
