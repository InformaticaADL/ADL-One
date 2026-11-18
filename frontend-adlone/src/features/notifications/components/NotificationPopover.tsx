import React from 'react';
import {
    IconBell,
    IconInfoCircle,
    IconAlertTriangle,
    IconCircleCheck,
    IconCircleX,
    IconChevronRight,
    IconChecks,
} from '@tabler/icons-react';
import { useNotificationStore, type Notification } from '../../../store/notificationStore';
import { useNavStore } from '../../../store/navStore';
import { handleNotificationNavigation } from '../utils/notificationNavigation';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
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
    const { setActiveModule, setActiveSubmodule, setPendingRequestId, setPendingChatId, setPendingSolicitudClienteId, setSelectedRequestId, setFichasMode } = useNavStore();
    const { hasPermission } = useAuth();
    const { showToast } = useToast();


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
        // Misma lógica de destino que la página de notificaciones (una sola copia)
        handleNotificationNavigation(notif, {
            setActiveModule, setActiveSubmodule, setPendingRequestId, setPendingChatId, setPendingSolicitudClienteId,
            setSelectedRequestId, setFichasMode, hasPermission, showToast,
        });
        if (isMobile) window.dispatchEvent(new CustomEvent('close-mobile-sidebar'));
    };

    // Cada tipo lleva su ícono dentro de un círculo del mismo color, para que se distinga de un vistazo.
    const estiloDe = (tipo: string) => {
        switch (tipo) {
            case 'SUCCESS': return { Icono: IconCircleCheck, clase: 'bg-success/10 text-success' };
            case 'WARNING': return { Icono: IconAlertTriangle, clase: 'bg-warning/10 text-warning' };
            case 'ERROR': return { Icono: IconCircleX, clase: 'bg-destructive/10 text-destructive' };
            default: return { Icono: IconInfoCircle, clase: 'bg-primary/10 text-primary' };
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

    const nuevas = unreadNotifications.length;

    return (
        <Popover open={opened} onOpenChange={(next) => { if (!next) onClose(); }}>
            <PopoverAnchor>
                <div className="w-full">{children}</div>
            </PopoverAnchor>
            {/* La campana vive en el extremo derecho de la barra: el panel se abre hacia abajo, alineado a su borde derecho. */}
            <PopoverContent
                align="end"
                side="bottom"
                sideOffset={8}
                className={cn('shadcn-scope flex flex-col overflow-hidden p-0', isMobile ? 'w-[calc(100vw-16px)] max-w-[380px]' : 'w-[380px]')}
            >
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">Notificaciones</span>
                        {nuevas > 0 && (
                            <span className="whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold leading-4 text-primary">
                                {nuevas} {nuevas === 1 ? 'nueva' : 'nuevas'}
                            </span>
                        )}
                    </div>
                    {nuevas > 0 && (
                        <button
                            type="button"
                            onClick={markAllAsRead}
                            className="flex items-center gap-1 whitespace-nowrap text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <IconChecks size={14} />
                            Marcar todas como leídas
                        </button>
                    )}
                </div>

                <div className="max-h-[420px] overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="px-4 py-10 text-center">
                            <IconBell size={32} strokeWidth={1} className="mx-auto text-border" />
                            <div className="mt-2 text-xs text-muted-foreground">No tienes notificaciones pendientes</div>
                        </div>
                    ) : (
                        <ul className="m-0 list-none divide-y divide-border p-0">
                            {recentNotifications.map((notif) => {
                                const { Icono, clase } = estiloDe(notif.tipo);
                                return (
                                    <li key={notif.id_notificacion}>
                                        <button
                                            type="button"
                                            onPointerDown={(e) => e.preventDefault()}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleItemClick(notif);
                                            }}
                                            className={cn(
                                                'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted',
                                                !notif.leido && 'bg-primary/[0.04]'
                                            )}
                                        >
                                            <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', clase)}>
                                                <Icono size={16} />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className={cn('line-clamp-2 block text-[13px] leading-snug', notif.leido ? 'font-medium text-muted-foreground' : 'font-semibold text-foreground')}>
                                                    {formatTitle(notif.titulo)}
                                                </span>
                                                {notif.mensaje && (
                                                    <span className="mt-0.5 line-clamp-2 block whitespace-pre-line text-xs leading-snug text-muted-foreground">
                                                        {notif.mensaje}
                                                    </span>
                                                )}
                                                <span className="mt-1 block text-[11px] text-muted-foreground/80">
                                                    {dayjs(notif.fecha).fromNow()}
                                                </span>
                                            </span>
                                            {!notif.leido && (
                                                <span aria-label="Sin leer" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className="border-t border-border bg-muted/30 p-1.5">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-center gap-1 text-primary hover:text-primary"
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
