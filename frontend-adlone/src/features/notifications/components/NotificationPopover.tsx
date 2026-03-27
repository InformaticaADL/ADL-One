import React from 'react';
import { 
    Popover, 
    Text, 
    Group, 
    Stack, 
    UnstyledButton, 
    Badge, 
    Box, 
    ScrollArea, 
    Divider,
    Button
} from '@mantine/core';
import { 
    IconBell, 
    IconInfoCircle, 
    IconAlertTriangle, 
    IconCircleCheck, 
    IconCircleX,
    IconChevronRight
} from '@tabler/icons-react';
import { useNotificationStore, type Notification } from '../../../store/notificationStore';
import { useNavStore } from '../../../store/navStore';
import { handleNotificationNavigation } from '../utils/notificationNavigation';
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
    const { notifications, markAsRead } = useNotificationStore();
    const { setActiveModule, setActiveSubmodule, setPendingRequestId, setPendingChatId, setSelectedRequestId } = useNavStore();
    const isMobile = useMediaQuery('(max-width: 500px)');
    const isTablet = useMediaQuery('(max-width: 1024px)');

    const unreadNotifications = notifications.filter(n => !n.leido);
    const recentNotifications = notifications.slice(0, 5);

    const handleItemClick = async (notif: Notification) => {
        onClose();
        if (!notif.leido) {
            await markAsRead(notif.id_notificacion);
        }

        handleNotificationNavigation(notif, {
            setActiveModule,
            setActiveSubmodule,
            setPendingRequestId,
            setPendingChatId,
            setSelectedRequestId
        });
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
        setActiveModule('notificaciones');
        setActiveSubmodule('');
    };

    return (
        <Popover 
            opened={opened} 
            onClose={onClose} 
            width={isMobile ? 'calc(100vw - 20px)' : 350} 
            position={isMobile ? 'bottom' : (isTablet ? 'bottom-start' : 'right-start')} 
            withArrow={!isMobile} 
            withinPortal
            zIndex={1000}
            shadow="xl"
            offset={isMobile ? 5 : 15}
            transitionProps={{ transition: 'pop-top-left', duration: 200 }}
            styles={{
                dropdown: {
                    padding: 0,
                    borderRadius: '12px',
                    border: '1px solid var(--mantine-color-gray-2)',
                    overflow: 'hidden'
                }
            }}
        >
            <Popover.Target>
                <div style={{ width: '100%' }}>
                    {children}
                </div>
            </Popover.Target>

            <Popover.Dropdown>
                <Box p="md" style={{ backgroundColor: 'white' }}>
                    <Group justify="space-between" mb="xs">
                        <Text fw={700} size="sm">Notificaciones Recientes</Text>
                        {unreadNotifications.length > 0 && (
                            <Badge size="xs" color="red" variant="filled">
                                {unreadNotifications.length} nuevas
                            </Badge>
                        )}
                    </Group>
                    <Divider my="xs" />

                    <ScrollArea.Autosize mah={isMobile ? '60vh' : 400} type="hover">
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
                                        onClick={() => handleItemClick(notif)}
                                        p="xs"
                                        style={{
                                            borderRadius: '8px',
                                            backgroundColor: notif.leido ? 'transparent' : 'var(--mantine-color-adl-blue-0)',
                                            transition: 'background-color 0.2s',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--mantine-color-gray-0)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = notif.leido ? 'transparent' : 'var(--mantine-color-adl-blue-0)')}
                                    >
                                        <Group wrap="nowrap" align="flex-start" gap="sm">
                                            <Box style={{ paddingTop: 2 }}>{getIcon(notif.tipo)}</Box>
                                            <div style={{ flex: 1 }}>
                                                <Text size="xs" fw={700} lineClamp={1} c={notif.leido ? 'dark.3' : 'dark.7'}>
                                                    {notif.titulo}
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
                
                <Divider />
                <Box p="xs" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                    <Button 
                        variant="subtle" 
                        fullWidth 
                        size="compact-xs" 
                        rightSection={<IconChevronRight size={14} />}
                        onClick={handleViewAll}
                    >
                        Ver todas las notificaciones
                    </Button>
                </Box>
            </Popover.Dropdown>
        </Popover>
    );
};
