import React from 'react';
import {
    IconBell,
    IconInfoCircle,
    IconAlertTriangle,
    IconCircleCheck,
    IconCircleX,
    IconChevronRight,
    IconX
} from '@tabler/icons-react';
import { useNotificationStore, type Notification } from '../../../store/notificationStore';
import { useNavStore } from '../../../store/navStore';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { Popover, Button, Divider, Tag } from 'antd';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
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

    // Referencia para saber dónde está el botón (panel móvil flotante)
    const targetRef = React.useRef<HTMLDivElement>(null);
    const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);

    React.useEffect(() => {
        if (opened && isMobile && targetRef.current) {
            setTargetRect(targetRef.current.getBoundingClientRect());
        }
    }, [opened, isMobile]);

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
            case 'SUCCESS': return <IconCircleCheck size={16} color="#2f9e44" />;
            case 'WARNING': return <IconAlertTriangle size={16} color="#e8590c" />;
            case 'ERROR': return <IconCircleX size={16} color="#e03131" />;
            default: return <IconInfoCircle size={16} color="#1c7ed6" />;
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

    /* ── Contenido original del panel (compartido mobile/desktop) ── */
    const panelContent = (
        <>
            <div style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--app-text)' }}>Notificaciones Recientes</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {unreadNotifications.length > 0 && (
                            <Tag color="red" bordered={false} style={{ marginInlineEnd: 0, fontSize: 11 }}>
                                {unreadNotifications.length} nuevas
                            </Tag>
                        )}
                        {unreadNotifications.length > 0 && (
                            <Button type="text" size="small" onClick={markAllAsRead} style={{ fontSize: 11, color: 'var(--app-text-secondary)', height: 22, padding: '0 6px' }}>
                                Marcar todas como leídas
                            </Button>
                        )}
                        {isMobile && (
                            <Button type="text" shape="circle" size="small" icon={<IconX size={16} />} onClick={onClose} />
                        )}
                    </div>
                </div>
                <Divider style={{ margin: '8px 0' }} />

                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                        <div style={{ padding: '32px 0', textAlign: 'center' }}>
                            <IconBell size={32} color="var(--app-border)" stroke={1} />
                            <div style={{ fontSize: 12, color: 'var(--app-text-secondary)', marginTop: 8 }}>No tienes notificaciones pendientes</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {recentNotifications.map((notif) => (
                                <div
                                    key={notif.id_notificacion}
                                    role="button"
                                    tabIndex={0}
                                    onPointerDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleItemClick(notif);
                                    }}
                                    style={{
                                        borderRadius: 8,
                                        padding: 8,
                                        backgroundColor: notif.leido ? 'transparent' : 'var(--app-accent-bg)',
                                        transition: 'background-color 0.2s',
                                        width: '100%',
                                        display: 'block',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        border: 'none',
                                    }}
                                    onMouseEnter={(e) => { if (notif.leido) e.currentTarget.style.backgroundColor = 'var(--app-hover-bg)'; }}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = notif.leido ? 'transparent' : 'var(--app-accent-bg)')}
                                >
                                    <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start', gap: 8 }}>
                                        <div style={{ paddingTop: 2 }}>{getIcon(notif.tipo)}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{
                                                fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                color: notif.leido ? 'var(--app-text-secondary)' : 'var(--app-text)',
                                            }}>
                                                {formatTitle(notif.titulo)}
                                            </div>
                                            <div style={{
                                                fontSize: 12, color: 'var(--app-text-secondary)', marginBottom: 2,
                                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                            }}>
                                                {notif.mensaje}
                                            </div>
                                            <div style={{ fontSize: 10, color: 'var(--app-accent-text)', fontWeight: 500 }}>
                                                {dayjs(notif.fecha).fromNow()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <Divider style={{ margin: 0 }} />
            <div style={{ padding: 8 }}>
                <Button
                    type="text"
                    block
                    size="small"
                    icon={<IconChevronRight size={14} />}
                    iconPosition="end"
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleViewAll();
                    }}
                >
                    Ver todas las notificaciones
                </Button>
            </div>
        </>
    );

    /* ── MOBILE: panel flotante posicionado sobre el sidebar ── */
    if (isMobile) {
        return (
            <>
                <div ref={targetRef} style={{ width: '100%' }}>
                    {children}
                </div>
                {opened && createPortal(
                    <>
                        {/* Overlay para cerrar al tocar fuera */}
                        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 299, backgroundColor: 'transparent' }} />
                        <div
                            style={{
                                position: 'fixed',
                                top: targetRect ? targetRect.bottom + 8 : 70,
                                left: 10,
                                width: 'calc(100% - 20px)',
                                maxWidth: 340,
                                zIndex: 300,
                                backgroundColor: 'var(--app-glass-bg-strong)',
                                backdropFilter: 'blur(12px)',
                                WebkitBackdropFilter: 'blur(12px)',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                                borderRadius: 12,
                                overflow: 'hidden',
                                border: '1px solid var(--app-border)',
                            }}
                        >
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {panelContent}
                            </div>
                        </div>
                    </>,
                    document.body
                )}
            </>
        );
    }

    /* ── DESKTOP: Popover de Ant Design — cierre por click-afuera confiable
       vía rc-trigger (a diferencia del Popover de Mantine, que en este panel
       no lo detectaba de forma consistente). ── */
    return (
        <Popover
            open={opened}
            onOpenChange={(next) => { if (!next) onClose(); }}
            trigger="click"
            placement="rightTop"
            arrow={{ pointAtCenter: true }}
            styles={{ container: { padding: 0, borderRadius: 12, overflow: 'hidden', width: 350 } }}
            content={panelContent}
        >
            <div style={{ width: '100%' }}>
                {children}
            </div>
        </Popover>
    );
};
