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
import { Box, Group, Text, Badge, Button, Divider, ScrollArea, Stack, UnstyledButton, Popover, Portal, ActionIcon } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
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
    
    // Referencia para saber dónde está el botón
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
            case 'SUCCESS': return <IconCircleCheck size={16} color="var(--mantine-color-green-6)" />;
            case 'WARNING': return <IconAlertTriangle size={16} color="var(--mantine-color-orange-6)" />;
            case 'ERROR': return <IconCircleX size={16} color="var(--mantine-color-red-6)" />;
            default: return <IconInfoCircle size={16} color="var(--mantine-color-blue-6)" />;
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
            <Box p="md" style={{ backgroundColor: 'transparent' }}>
                <Group justify="space-between" mb="xs">
                    <Text fw={700} size="sm">Notificaciones Recientes</Text>
                    <Group gap={6}>
                        {unreadNotifications.length > 0 && (
                            <Badge size="xs" color="red" variant="filled">
                                {unreadNotifications.length} nuevas
                            </Badge>
                        )}
                        {unreadNotifications.length > 0 && (
                            <Button variant="subtle" size="compact-xs" color="gray" onClick={markAllAsRead}>
                                Marcar todas como leídas
                            </Button>
                        )}
                        {isMobile && (
                            <ActionIcon variant="subtle" color="gray" onClick={onClose} size="sm" radius="xl" ml={4}>
                                <IconX size={18} />
                            </ActionIcon>
                        )}
                    </Group>
                </Group>
                <Divider my="xs" />

                <ScrollArea.Autosize mah={400} type="hover">
                    {notifications.length === 0 ? (
                        <Box py="xl" style={{ textAlign: 'center' }}>
                            <IconBell size={32} color="var(--mantine-color-gray-4)" stroke={1} />
                            <Text size="xs" c="dimmed" mt="sm">No tienes notificaciones pendientes</Text>
                        </Box>
                    ) : (
                        <Stack gap={4}>
                            {recentNotifications.map((notif) => (
                                <UnstyledButton
                                    key={notif.id_notificacion}
                                    onPointerDown={(e) => e.preventDefault()}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleItemClick(notif);
                                    }}
                                    p="xs"
                                    style={{
                                        borderRadius: '8px',
                                        backgroundColor: notif.leido ? 'transparent' : 'var(--mantine-color-adl-blue-0)',
                                        transition: 'background-color 0.2s',
                                        width: '100%',
                                        display: 'block',
                                        textAlign: 'left'
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--mantine-color-gray-0)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = notif.leido ? 'transparent' : 'var(--mantine-color-adl-blue-0)')}
                                >
                                    <Group wrap="nowrap" align="flex-start" gap="sm">
                                        <Box style={{ paddingTop: 2 }}>{getIcon(notif.tipo)}</Box>
                                        <div style={{ flex: 1 }}>
                                            <Text size="xs" fw={700} lineClamp={1} c={notif.leido ? 'dark.3' : 'dark.7'}>
                                                {formatTitle(notif.titulo)}
                                            </Text>
                                            <Text size="xs" c="dimmed" lineClamp={2} mb={2}>
                                                {notif.mensaje}
                                            </Text>
                                            <Text size="10px" c="blue.7" fw={500}>
                                                {dayjs(notif.fecha).fromNow()}
                                            </Text>
                                        </div>
                                    </Group>
                                </UnstyledButton>
                            ))}
                        </Stack>
                    )}
                </ScrollArea.Autosize>
            </Box>

            <Divider color="rgba(0,0,0,0.05)" />
            <Box p="xs" style={{ backgroundColor: 'rgba(248, 249, 250, 0.4)' }}>
                <Button
                    variant="subtle"
                    fullWidth
                    size="compact-xs"
                    rightSection={<IconChevronRight size={14} />}
                    onPointerDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleViewAll();
                    }}
                >
                    Ver todas las notificaciones
                </Button>
            </Box>
        </>
    );

    /* ── MOBILE: Portal con diseño original, posicionado sobre el sidebar ── */
    if (isMobile) {
        return (
            <>
                <div ref={targetRef} style={{ width: '100%' }}>
                    {children}
                </div>
                {opened && (
                    <Portal>
                        {/* Overlay para cerrar al tocar fuera */}
                        <div
                            onClick={onClose}
                            style={{
                                position: 'fixed',
                                inset: 0,
                                zIndex: 299,
                                backgroundColor: 'transparent',
                            }}
                        />
                        {/* Panel con diseño original flotante */}
                        <div
                            style={{
                                position: 'fixed',
                                top: targetRect ? targetRect.bottom + 8 : 70, // Aparece justo debajo del botón
                                left: 10,
                                width: 'calc(100% - 20px)',
                                maxWidth: 340,
                                zIndex: 300,
                                backgroundColor: 'rgba(255, 255, 255, 0.7)',
                                backdropFilter: 'blur(12px)',
                                WebkitBackdropFilter: 'blur(12px)',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                border: '1px solid var(--mantine-color-gray-2)',
                            }}
                        >
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {panelContent}
                            </div>
                        </div>
                    </Portal>
                )}
            </>
        );
    }

    /* ── DESKTOP: Popover original ── */
    return (
        <Popover 
            opened={opened} 
            onClose={onClose} 
            width={350} 
            position="right-start" 
            withArrow 
            shadow="xl"
            offset={15}
            zIndex={400}
            transitionProps={{ transition: 'pop-top-left', duration: 200 }}
            styles={{
                dropdown: {
                    padding: 0,
                    borderRadius: '12px',
                    border: '1px solid var(--mantine-color-gray-2)',
                    overflow: 'hidden',
                    backgroundColor: 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                }
            }}
        >
            <Popover.Target>
                <div style={{ width: '100%' }}>
                    {children}
                </div>
            </Popover.Target>

            <Popover.Dropdown>
                {panelContent}
            </Popover.Dropdown>
        </Popover>
    );
};
