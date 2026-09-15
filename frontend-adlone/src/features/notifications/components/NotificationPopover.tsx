import React from 'react';
import {
    IconBell,
    IconInfoCircle,
    IconAlertTriangle,
    IconCircleCheck,
    IconCircleX,
    IconChevronRight,
} from '@tabler/icons-react';
import { useNotificationStore, type Notification } from '../../../store/notificationStore';
import { useNavStore } from '../../../store/navStore';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/es';

dayjs.extend(relativeTime);
dayjs.locale('es');

interface NotificationPopoverProps {
    opened: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

export const NotificationPopover: React.FC<NotificationPopoverProps> = ({ opened, onClose, children }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { notifications, markAsRead, markAllAsRead } = useNotificationStore();
    const { setActiveModule, setActiveSubmodule, setPendingRequestId, setPendingChatId, setSelectedRequestId, setFichasMode } = useNavStore();
    const { hasPermission } = useAuth();
    const { showToast } = useToast();

    // Mismos permisos que FichasIngresoPage exige para 'list_fichas' / 'list_ejecutados'
    const FICHA_DETALLE_PERMS = ['FI_CONSULTAR', 'FI_VER', 'FI_APROBAR_TEC', 'FI_RECHAZAR_TEC', 'FI_APROBAR_COO', 'FI_RECHAZAR_COO', 'FI_EDITAR'];
    const FICHA_EJECUTADOS_PERMS = ['MA_COMERCIAL_HISTORIAL_ACCESO', 'FI_EXP_MC'];

    const unreadNotifications = notifications.filter(n => !n.leido);
    const recentNotifications = notifications.slice(0, 5);

    const formatTitle = (title: string) => {
        if (!title) return '';
        if (title.includes('_')) {
            return title.replace(/^Aviso:\s*/i, '').replace(/_/g, ' ');
        }
        return title;
    };

    const handleItemClick = (notif: Notification) => {
        onClose();

        if (!notif.leido) {
            markAsRead(notif.id_notificacion).catch(console.error);
        }

        if (notif.id_referencia) {
            const titulo = (notif.titulo || '').toLowerCase();
            const mensaje = (notif.mensaje || '').toLowerCase();
            const area = (notif.area || '').toLowerCase();

            // Chat — check FIRST to prevent mis-routing
            if (area === 'chat' || area === 'mensajería') {
                setPendingChatId(notif.id_referencia);
                setActiveModule('chat');
                setActiveSubmodule('');
            } else {
                // Solicitudes: route to URS inbox with request selected
                const isRequest =
                    titulo.includes('solicitud') || titulo.includes('estado') ||
                    titulo.includes('derivación') || titulo.includes('derivacion') ||
                    titulo.includes('baja') || titulo.includes('traspaso') ||
                    titulo.includes('asignación') || titulo.includes('equipo') ||
                    titulo.includes('activación') || titulo.includes('comentario') ||
                    titulo.includes('mensaje en #') || titulo.includes('nuevo mensaje') ||
                    titulo.includes('consulta') || mensaje.includes('ficha/servicio') ||
                    area === 'urs' || area === 'solicitudes' ||
                    area === 'gestión de calidad' || area === 'gestion de calidad';

                if (isRequest) {
                    setSelectedRequestId(notif.id_referencia);
                    setActiveModule('solicitudes');
                    setActiveSubmodule('');
                } else if (titulo.includes('muestreo completado')) {
                    // Muestreo Completado: lleva al listado de Muestreos Ejecutados, no al detalle de la ficha
                    if (!hasPermission(FICHA_EJECUTADOS_PERMS)) {
                        showToast({ type: 'error', message: 'No tienes permiso para ver el listado de Muestreos Ejecutados.' });
                        return;
                    }
                    setActiveModule('medio-ambiente');
                    setActiveSubmodule('ma-fichas-ingreso');
                    setFichasMode('list_ejecutados');
                } else if (titulo.includes('ficha') || (mensaje.includes('ficha') && !mensaje.includes('ficha/servicio')) || titulo.includes('programación') || mensaje.includes('muestreo')) {
                    if (!hasPermission(FICHA_DETALLE_PERMS)) {
                        showToast({ type: 'error', message: 'No tienes permiso para ver el detalle de esta ficha.' });
                        return;
                    }
                    setPendingRequestId(notif.id_referencia);
                    setActiveModule('medio-ambiente');
                    setActiveSubmodule('ma-fichas-ingreso');
                } else {
                    // Fallback: still route to solicitudes
                    setSelectedRequestId(notif.id_referencia);
                    setActiveModule('solicitudes');
                    setActiveSubmodule('');
                }
            }
        } else if (notif.area === 'Chat') {
            setActiveModule('chat');
            setActiveSubmodule('');
        }

        if (isMobile) {
            window.dispatchEvent(new CustomEvent('close-mobile-sidebar'));
        }
    };

    const getIcon = (tipo: string) => {
        switch (tipo) {
            case 'SUCCESS': return <IconCircleCheck size={16} className="text-success" />;
            case 'WARNING': return <IconAlertTriangle size={16} className="text-warning" />;
            case 'ERROR': return <IconCircleX size={16} className="text-destructive" />;
            default: return <IconInfoCircle size={16} className="text-primary" />;
        }
    };

    const handleViewAll = () => {
        onClose();
        if (isMobile) {
            window.dispatchEvent(new CustomEvent('close-mobile-sidebar'));
        }
        setActiveModule('notificaciones');
        setActiveSubmodule('');
    };

    return (
        <Popover open={opened} onOpenChange={(next) => { if (!next) onClose(); }}>
            <PopoverAnchor>
                <div className="w-full">{children}</div>
            </PopoverAnchor>
            <PopoverContent
                align={isMobile ? 'end' : 'start'}
                side={isMobile ? 'bottom' : 'right'}
                sideOffset={isMobile ? 8 : 4}
                className={cn('shadcn-scope flex flex-col p-0', isMobile ? 'w-[calc(100vw-20px)] max-w-[340px]' : 'w-[350px]')}
            >
                <div className="p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-[13px] font-bold text-foreground">Notificaciones Recientes</span>
                        <div className="flex items-center gap-1.5">
                            {unreadNotifications.length > 0 && (
                                <Badge variant="destructive">{unreadNotifications.length} nuevas</Badge>
                            )}
                            {unreadNotifications.length > 0 && (
                                <Button variant="ghost" size="sm" className="h-[22px] px-1.5 text-[11px] text-muted-foreground" onClick={markAllAsRead}>
                                    Marcar todas como leídas
                                </Button>
                            )}
                        </div>
                    </div>
                    <hr className="my-2 border-t border-border" />

                    <div className="max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="py-8 text-center">
                                <IconBell size={32} strokeWidth={1} className="mx-auto text-border" />
                                <div className="mt-2 text-xs text-muted-foreground">No tienes notificaciones pendientes</div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1">
                                {recentNotifications.map((notif) => (
                                    <button
                                        key={notif.id_notificacion}
                                        type="button"
                                        onPointerDown={(e) => e.preventDefault()}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleItemClick(notif);
                                        }}
                                        className={cn(
                                            'block w-full rounded-lg p-2 text-left transition-colors hover:bg-muted',
                                            notif.leido ? 'bg-transparent' : 'bg-primary/5'
                                        )}
                                    >
                                        <div className="flex items-start gap-2">
                                            <div className="pt-0.5">{getIcon(notif.tipo)}</div>
                                            <div className="min-w-0 flex-1">
                                                <div className={cn('truncate text-xs font-bold', notif.leido ? 'text-muted-foreground' : 'text-foreground')}>
                                                    {formatTitle(notif.titulo)}
                                                </div>
                                                <div className="mb-0.5 line-clamp-2 text-xs text-muted-foreground">
                                                    {notif.mensaje}
                                                </div>
                                                <div className="text-[10px] font-medium text-primary">
                                                    {dayjs(notif.fecha).fromNow()}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <hr className="border-t border-border" />
                <div className="p-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between"
                        onPointerDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleViewAll();
                        }}
                    >
                        Ver todas las notificaciones
                        <IconChevronRight size={14} />
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
};
