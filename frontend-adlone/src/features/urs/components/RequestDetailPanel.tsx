import { ursService } from '../../../services/urs.service';
import { useAuth } from '../../../contexts/AuthContext';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import FileIcon from './FileIcon';
import DeriveRequestModal from './DeriveRequestModal';
import { useToast } from '../../../contexts/ToastContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Timeline } from '@/components/ui/timeline';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
    IconFileText, IconCalendar, IconUser, IconAlertCircle, IconDownload, IconCheck, IconX,
    IconSearch, IconArrowUpRight, IconLock, IconMapPin, IconDeviceDesktop, IconAlertTriangle,
    IconArrowsExchange, IconHistory, IconArrowRight, IconChevronDown, IconChevronUp, IconCheckbox, IconBan,
    IconInfoCircle,
} from '@tabler/icons-react';

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

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';

const STATUS_BADGE: Record<string, BadgeVariant> = {
    PENDIENTE: 'warning', EN_REVISION: 'default', ACEPTADA: 'success',
    REALIZADA: 'outline', RECHAZADA: 'destructive', CANCELADA: 'secondary',
};

const priorityClass = (p?: string) => {
    const priority = p?.toUpperCase() || 'NORMAL';
    if (priority === 'ALTA' || priority === 'CRITICO' || priority === 'URGENTE') return 'text-destructive';
    if (priority === 'MEDIA') return 'text-warning';
    return 'text-primary';
};

const bulletColor = (action: string): string => {
    const a = action.toUpperCase();
    if (a.includes('ACEPTADA') || a.includes('APROBAD')) return 'var(--sc-success)';
    if (a.includes('REALIZADA')) return 'var(--sc-success)';
    if (a.includes('RECHAZAD')) return 'var(--sc-destructive)';
    if (a.includes('REVISION')) return 'var(--sc-primary)';
    if (a.includes('DERIVAD')) return '#722ed1';
    return 'var(--sc-muted-foreground)';
};
const actionBadgeVariant = (action: string): BadgeVariant => {
    const a = action.toUpperCase();
    if (a.includes('ACEPTADA') || a.includes('APROBAD') || a.includes('REALIZADA')) return 'success';
    if (a.includes('RECHAZAD')) return 'destructive';
    if (a.includes('REVISION')) return 'default';
    return 'outline';
};

type AlertType = 'info' | 'success' | 'warning' | 'error';

const alertStyles: Record<AlertType, string> = {
    info: 'border-primary/30 bg-primary/5 text-foreground',
    success: 'border-success/30 bg-success/10 text-foreground',
    warning: 'border-warning/30 bg-warning/10 text-foreground',
    error: 'border-destructive/30 bg-destructive/10 text-foreground',
};

function AlertBox({ type, icon, message, description }: { type: AlertType; icon?: React.ReactNode; message: React.ReactNode; description?: React.ReactNode }) {
    return (
        <div className={cn('flex gap-2 rounded-lg border p-3 text-sm', alertStyles[type])}>
            {icon !== null && <span className="mt-0.5 shrink-0">{icon ?? <IconInfoCircle size={16} />}</span>}
            <div className="min-w-0 flex-1">
                <div className="font-medium">{message}</div>
                {description && <div className="mt-1 text-muted-foreground">{description}</div>}
            </div>
        </div>
    );
}

interface RequestDetailPanelProps {
    request: any;
    onRequestUpdate: () => void;
    onReload: () => void;
}

const RequestDetailPanel: React.FC<RequestDetailPanelProps> = ({ request, onRequestUpdate, onReload }) => {
    const [isDeriving, setIsDeriving] = useState(false);
    const { user, token } = useAuth();
    const { showToast } = useToast();

    const [obsModalOpen, setObsModalOpen] = useState(false);
    const [obsText, setObsText] = useState('');
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const historyRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (historyOpen) {
            setTimeout(() => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 150);
        }
    }, [historyOpen]);

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

    if (!request) return <div className="flex h-full items-center justify-center text-muted-foreground">Selecciona una solicitud</div>;

    const dj = request.datos_json || {};

    return (
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-4">
            {/* Header */}
            <Card className="p-4">
                <div className="mb-3 flex items-center justify-between">
                    <Badge variant="outline">ID #{request.id_solicitud}</Badge>
                    <Badge variant={STATUS_BADGE[request.estado] || 'outline'}>{STATUS_LABEL[request.estado] || request.estado}</Badge>
                </div>
                {(request.origen_solicitud === 'MUESTREADOR' || dj.origen_solicitud === 'MUESTREADOR' || dj.app_version) && (
                    <div className="mb-2.5 flex items-center gap-1 text-xs font-semibold text-primary">📱 Solicitud enviada vía aplicación móvil ADL Sampling</div>
                )}
                <h2 className="m-0 mb-3.5 text-xl font-bold tracking-tight text-foreground">{request.titulo || request.nombre_tipo}</h2>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
                    <div className="flex items-start gap-2">
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Creada</div>
                            <div className="text-sm font-semibold text-foreground">{new Date(request.fecha_creacion).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><IconAlertCircle size={15} /></span>
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Prioridad</div>
                            <div className={cn('text-sm font-semibold', priorityClass(request.prioridad))}>{request.prioridad || 'NORMAL'}</div>
                        </div>
                    </div>
                    <div className="flex min-w-0 items-start gap-2">
                        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><IconUser size={15} /></span>
                        <div className="min-w-0">
                            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Solicitante</div>
                            <div className="truncate text-sm font-semibold text-foreground">{request.nombre_solicitante}</div>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Observations */}
            {request.observaciones && (
                <AlertBox type="info" message="Observaciones del Solicitante" description={<span className="italic">&quot;{request.observaciones}&quot;</span>} />
            )}

            {/* Data Detail */}
            <Card className="p-4">
                <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><IconFileText size={17} /></span>
                    <span className="text-base font-semibold text-foreground">Detalle de la Información</span>
                </div>
                <div className="flex flex-col gap-3">
                    {request.id_tipo === 7 || request.id_tipo === 8 ? (
                        <>
                            <div className="flex flex-col gap-1 rounded-lg border border-primary/30 bg-primary/5 p-3">
                                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Muestreador a deshabilitar</div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[17px] font-bold text-foreground">{dj.muestreador_origen_nombre}</span>
                                    <Badge variant="outline">ID: {dj.muestreador_origen_id || 'N/A'}</Badge>
                                </div>
                            </div>
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                                <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3">
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Traspaso de equipos</div>
                                    <span className={cn('text-sm font-semibold', dj.muestreador_origen_id ? 'text-success' : 'text-destructive')}>
                                        {dj.reasignacion_manual || dj.muestreador_destino_nombre || dj.base_destino ? '✅ SI' : '❌ NO'}
                                    </span>
                                </div>
                                <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3">
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Tipo de traspaso</div>
                                    <span className="text-sm font-semibold text-foreground">
                                        {dj.tipo_traspaso === 'IGUAL' || dj.tipo_traspaso === 'MUESTREADOR' ? 'A un Muestreador' :
                                            dj.tipo_traspaso === 'BASE' ? 'BASE' :
                                                dj.tipo_traspaso === 'DISTINGO' || dj.tipo_traspaso === 'MANUAL' ? 'Personalizado' :
                                                    dj.tipo_traspaso || 'N/A'}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3">
                                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Destino Final</div>
                                <span className="text-sm font-semibold text-foreground">
                                    {dj.tipo_traspaso === 'IGUAL' || dj.tipo_traspaso === 'MUESTREADOR' ? `👤 ${dj.muestreador_destino_nombre || 'Muestreador No Especificado'}` :
                                        dj.tipo_traspaso === 'BASE' ? `🏢 ${dj.base_destino || 'Base No Especificada'}` :
                                            dj.tipo_traspaso === 'DISTINGO' || dj.tipo_traspaso === 'MANUAL' ? `🛠️ Reasignación Manual (${dj.reasignacion_manual?.length || 0} equipos)` :
                                                `❓ ${dj.tipo_traspaso || 'No definido'}`}
                                </span>
                            </div>
                        </>
                    ) : (request.id_tipo === 1 || dj._form_type === 'ACTIVACION_EQUIPO') ? (
                        <>
                            <div className="flex flex-col gap-1 rounded-lg border border-primary/30 bg-primary/5 p-3">
                                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Nombre del Equipo</div>
                                <span className="text-[17px] font-bold text-foreground">{dj.nombre_equipo}</span>
                            </div>
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
                                    <IconDeviceDesktop size={18} />
                                    <div>
                                        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Tipo de Dispositivo</div>
                                        <span className="text-sm font-semibold text-foreground">{dj.tipo_equipo || 'N/A'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
                                    <IconMapPin size={18} />
                                    <div>
                                        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Sede / Ubicación</div>
                                        <span className="text-sm font-semibold text-foreground">{dj.nombre_ubicacion || dj.nombre_centro || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (request.id_tipo === 2 || request.id_tipo === 6 || dj._form_type === 'BAJA_EQUIPO') ? (
                        <>
                            <AlertBox type="error" icon={<IconAlertTriangle size={18} />} message="Equipo Desvinculado"
                                description={<span className="text-sm font-semibold text-foreground">{dj.nombre_equipo_full}</span>} />
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                                <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3">
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Causa</div>
                                    <span className="text-sm font-semibold text-destructive">{formatCodeValue(dj.motivo)}</span>
                                </div>
                                <div className="flex flex-col gap-1 rounded-lg border border-border bg-muted/40 p-3">
                                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Fecha Efectiva</div>
                                    <span className="text-sm font-semibold text-foreground">
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
                            <div className={cn('flex flex-col gap-1 rounded-lg border p-3', Number(request.id_tipo) === 12 ? 'border-destructive/30 bg-destructive/5' : 'border-primary/30 bg-primary/5')}>
                                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                    {Number(request.id_tipo) === 11 ? 'Equipo Referenciado (Extravío)' :
                                        Number(request.id_tipo) === 10 ? 'Equipo Referenciado (Problema Técnico)' :
                                            Number(request.id_tipo) === 14 ? 'Equipo Referenciado (Consulta)' :
                                                Number(request.id_tipo) === 15 ? 'Ficha/Servicio Referenciado (Consulta)' :
                                                    Number(request.id_tipo) === 12 ? 'Servicio a Anular' : 'Consulta General'}
                                </div>
                                <span className={cn('text-[17px] font-bold', Number(request.id_tipo) === 12 ? 'text-destructive' : 'text-primary')}>
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
                                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
                                    <IconCalendar size={18} className="text-primary" />
                                    <div>
                                        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Fecha del Suceso</div>
                                        <span className="text-sm font-semibold text-foreground">
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
                            <div className="flex flex-col gap-1 rounded-lg border border-success/30 bg-success/5 p-3">
                                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Equipo en Traspaso</div>
                                <span className="text-[17px] font-bold text-foreground">{dj.nombre_equipo_full}</span>
                            </div>
                            {dj.traspaso_de?.includes('UBICACION') && (
                                <div className="rounded-lg border border-border bg-muted/40 p-3">
                                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Cambio de Ubicación</div>
                                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                        <div className="flex flex-col gap-0.5 text-center">
                                            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Actual</span>
                                            <span className="text-sm font-semibold text-foreground">{dj.info_actual?.ubicacion || 'N/A'}</span>
                                        </div>
                                        <IconArrowsExchange size={20} className="text-primary" />
                                        <div className="flex flex-col gap-0.5 text-center">
                                            <span className="text-[11px] font-bold uppercase tracking-wide text-primary">Nueva</span>
                                            <span className="text-sm font-semibold text-foreground">{dj.nombre_centro_destino}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {dj.traspaso_de?.includes('RESPONSABLE') && (
                                <div className="rounded-lg border border-border bg-muted/40 p-3">
                                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Cambio de Responsable</div>
                                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                        <div className="flex flex-col gap-0.5 text-center">
                                            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Actual</span>
                                            <span className="text-sm font-semibold text-foreground">{dj.info_actual?.responsable || 'N/A'}</span>
                                        </div>
                                        <IconArrowsExchange size={20} className="text-success" />
                                        <div className="flex flex-col gap-0.5 text-center">
                                            <span className="text-[11px] font-bold uppercase tracking-wide text-success">Nuevo</span>
                                            <span className="text-sm font-semibold text-foreground">{dj.nombre_muestreador_destino}</span>
                                        </div>
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
                                        <div key={key} className="flex justify-between gap-3 border-b border-border py-1.5">
                                            <span className="text-sm capitalize text-muted-foreground">{key.replace(/_/g, ' ')}</span>
                                            <span className="text-right text-sm font-semibold text-foreground">{formatCodeValue(String(value))}</span>
                                        </div>
                                    );
                                })
                            ) : (
                                <span className="block py-4 text-center text-sm text-muted-foreground">No hay datos específicos disponibles.</span>
                            )}
                        </div>
                    )}
                </div>
            </Card>

            {/* Attachments */}
            <Card className="p-4">
                <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><IconDownload size={17} /></span>
                    <span className="text-base font-semibold text-foreground">Archivos Adjuntos</span>
                </div>
                <div className="flex flex-col gap-2">
                    {request.archivos_adjuntos && request.archivos_adjuntos.length > 0 ? (
                        request.archivos_adjuntos.map((file: any) => (
                            <a key={file.id_adjunto}
                                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-inherit no-underline transition-colors hover:bg-muted/50"
                                target="_blank" rel="noreferrer"
                                href={`${import.meta.env.VITE_API_URL}/api/urs/download/${file.id_adjunto}?token=${token}`}>
                                <span className="flex min-w-0 items-center gap-2">
                                    <FileIcon mimetype={file.tipo_archivo} filename={file.nombre_archivo} size={28} />
                                    <span className="min-w-0">
                                        <div className="truncate text-sm font-semibold text-primary">{file.nombre_archivo}</div>
                                        <div className="text-[11px] text-muted-foreground">{(file.tipo_archivo || 'Archivo').toUpperCase()} • {new Date(file.fecha).toLocaleDateString()}</div>
                                    </span>
                                </span>
                                <IconDownload size={18} className="text-muted-foreground" />
                            </a>
                        ))
                    ) : (
                        <span className="block py-4 text-center text-sm text-muted-foreground">No hay archivos adjuntos.</span>
                    )}
                </div>
            </Card>

            {/* Status message */}
            {request.estado === 'ACEPTADA' && <AlertBox type="success" message="Solicitud aceptada, se le avisará cuando se haya realizado lo solicitado." />}
            {request.estado === 'REALIZADA' && <AlertBox type="success" message="Solicitud realizada, por ende se cierra esta solicitud." />}
            {request.estado === 'RECHAZADA' && <AlertBox type="error" message="Solicitud rechazada. No se pueden realizar más acciones." />}
            {request.estado === 'EN_REVISION' && <AlertBox type="info" message="Solicitud en revisión. Se está evaluando para proceder." />}
            {request.estado === 'CANCELADA' && <AlertBox type="warning" message="Solicitud cancelada por el solicitante." />}

            {/* Management */}
            {!isClosed && (
                <Card className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-foreground text-background"><IconCheck size={17} /></span>
                        <span className="text-base font-semibold text-foreground">Gestión de Solicitud</span>
                    </div>
                    {(request.can_manage || request.can_derive) ? (
                        <div className="flex flex-col gap-2">
                            {request.can_manage && request.estado !== 'ACEPTADA' && (
                                <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
                                    <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={() => openObservationModal('ACEPTADA')}>
                                        <IconCheck size={16} /> Aceptar
                                    </Button>
                                    <Button variant="destructive" onClick={() => openObservationModal('RECHAZADA')}>
                                        <IconX size={16} /> Rechazar
                                    </Button>
                                    <Button onClick={() => openObservationModal('EN_REVISION')}>
                                        <IconSearch size={16} /> En Revisión
                                    </Button>
                                </div>
                            )}
                            {request.can_derive && (
                                <Button variant="outline" className="w-full" onClick={() => setIsDeriving(true)}>
                                    <IconArrowUpRight size={16} /> Derivar Solicitud
                                </Button>
                            )}
                            {request.can_manage && request.estado === 'ACEPTADA' && (
                                <Button size="lg" className="w-full bg-success text-success-foreground hover:bg-success/90" onClick={() => openObservationModal('REALIZADA')}>
                                    <IconCheckbox size={18} /> Marcar como Realizado
                                </Button>
                            )}
                        </div>
                    ) : (
                        <AlertBox type="info" icon={<IconLock size={16} />} message="Modo Lectura" description="Usted tiene acceso de visualización para este trámite." />
                    )}
                </Card>
            )}

            {/* Cancel */}
            {canCancel && (
                <Card className="p-4">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <div className="text-sm font-semibold text-foreground">¿Deseas retirar esta solicitud?</div>
                            <div className="text-[11px] text-muted-foreground">Solo el solicitante puede cancelar mientras esté pendiente.</div>
                        </div>
                        <Button variant="outline" onClick={() => openObservationModal('CANCELADA')}>
                            <IconBan size={16} /> Cancelar solicitud
                        </Button>
                    </div>
                </Card>
            )}

            {/* History */}
            <Card ref={historyRef} className="p-4">
                <button type="button" className="flex w-full items-center justify-between border-none bg-transparent p-0" onClick={() => setHistoryOpen(!historyOpen)}>
                    <div className="flex items-center gap-2">
                        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><IconHistory size={17} /></span>
                        <span className="text-base font-semibold text-foreground">Historial de Acciones</span>
                        {actionHistory.length > 0 && <Badge variant="outline">{actionHistory.length}</Badge>}
                    </div>
                    {historyOpen ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                </button>
                {historyOpen && (
                    actionHistory.length > 0 ? (
                        <div className="mt-4 max-h-80 overflow-y-auto">
                            <Timeline items={actionHistory.map((item, i) => ({
                                key: i,
                                color: bulletColor(item.action),
                                dot: item.type === 'derivation' ? <IconArrowRight size={14} color={bulletColor(item.action)} /> : undefined,
                                content: (
                                    <div>
                                        <div className="mb-0.5 flex flex-wrap items-center gap-2">
                                            <Badge variant={actionBadgeVariant(item.action)}>{formatCodeValue(item.action)}</Badge>
                                            <span className="text-[11px] text-muted-foreground">
                                                {new Date(item.date).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="text-[13px] text-muted-foreground">
                                            <span className="font-semibold text-foreground">{item.user || 'Sistema'}</span> • {item.observation || 'Sin detalle'}
                                        </div>
                                    </div>
                                ),
                            }))} />
                        </div>
                    ) : (
                        <span className="block py-4 text-center text-sm text-muted-foreground">Sin movimientos registrados.</span>
                    )
                )}
            </Card>

            {/* Observation Modal */}
            <Dialog open={obsModalOpen} onOpenChange={(open) => { if (!open) { setObsModalOpen(false); setPendingAction(null); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{getActionLabel(pendingAction)}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                        {(pendingAction === 'RECHAZADA' || pendingAction === 'REALIZADA' || pendingAction === 'CANCELADA') && (
                            <AlertBox type={pendingAction === 'RECHAZADA' ? 'error' : 'warning'} message={
                                pendingAction === 'RECHAZADA' ? 'Esta acción es irreversible. La solicitud quedará rechazada definitivamente.' :
                                    pendingAction === 'CANCELADA' ? 'La solicitud será cancelada. Esta acción no puede deshacerse.' :
                                        'Esta acción marcará la solicitud como completada. No podrá revertirse.'
                            } />
                        )}
                        <Textarea placeholder="Escriba sus observaciones para esta acción..." rows={4}
                            value={obsText} onChange={(e) => setObsText(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setObsModalOpen(false); setPendingAction(null); }}>Cancelar</Button>
                        <Button disabled={!obsText.trim() || actionLoading} onClick={confirmAction}>
                            {actionLoading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />}
                            {getActionLabel(pendingAction)}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DeriveRequestModal isOpen={isDeriving} requestId={request.id_solicitud} requestTypeId={request.id_tipo}
                onClose={() => setIsDeriving(false)}
                onSuccess={() => { showToast({ message: 'Solicitud derivada correctamente', type: 'success' }); onReload(); onRequestUpdate(); }} />
        </div>
    );
};

export default RequestDetailPanel;
