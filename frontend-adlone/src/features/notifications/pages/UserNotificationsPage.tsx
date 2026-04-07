import { useEffect } from 'react';
import { 
    Title, 
    Text, 
    Paper, 
    Stack, 
    Group, 
    Badge, 
    Divider,
    Box
} from '@mantine/core';
import { 
    IconBell, 
    IconCalendar,
    IconChevronRight,
    IconInfoCircle,
    IconAlertTriangle,
    IconCircleCheck,
    IconCircleX
} from '@tabler/icons-react';
import { useNotificationStore, type Notification } from '../../../store/notificationStore';
import { useNavStore } from '../../../store/navStore';
import { handleNotificationNavigation } from '../utils/notificationNavigation';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

export const UserNotificationsPage = () => {
    const { notifications, fetchNotifications, markAsRead } = useNotificationStore();
    const { 
        setActiveModule, setActiveSubmodule, 
        setPendingRequestId, setPendingChatId, setSelectedRequestId 
    } = useNavStore();

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const handleNotificationClick = async (notif: Notification) => {
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
            case 'SUCCESS': return <IconCircleCheck size={20} color="var(--mantine-color-green-6)" />;
            case 'WARNING': return <IconAlertTriangle size={20} color="var(--mantine-color-orange-6)" />;
            case 'ERROR': return <IconCircleX size={20} color="var(--mantine-color-red-6)" />;
            default: return <IconInfoCircle size={20} color="var(--mantine-color-blue-6)" />;
        }
    };

    const formatTitle = (title: string) => {
        if (!title) return '';
        // Reemplazar guiones bajos por espacios y limpiar el prefijo "Aviso: " si es un código interno
        let cleanTitle = title;
        if (title.includes('_')) {
            cleanTitle = title.replace(/^Aviso:\s*/, '').replace(/_/g, ' ');
        }
        return cleanTitle;
    };

    // Grouping logic
    const groupNotifications = () => {
        const groups: Record<string, Notification[]> = {
            'Hoy': [],
            'Ayer': [],
            'Esta semana': [],
            'Anteriores': []
        };

        const now = dayjs();

        notifications.forEach(n => {
            const date = dayjs(n.fecha);
            if (date.isSame(now, 'day')) {
                groups['Hoy'].push(n);
            } else if (date.isSame(now.subtract(1, 'day'), 'day')) {
                groups['Ayer'].push(n);
            } else if (date.isAfter(now.subtract(7, 'day'))) {
                groups['Esta semana'].push(n);
            } else {
                groups['Anteriores'].push(n);
            }
        });

        return Object.entries(groups).filter(([_, items]) => items.length > 0);
    };

    const grouped = groupNotifications();

    return (
        <Box p="xl" style={{ width: '100%' }}>
            <Box mb="xl">
                <Group justify="space-between" align="flex-end">
                    <div>
                        <Title order={1} fw={800} style={{ letterSpacing: '-0.02em' }}>Notificaciones</Title>
                        <Text c="dimmed" size="sm">Historial completo de alertas y mensajes del sistema.</Text>
                    </div>
                </Group>
            </Box>

            {notifications.length === 0 ? (
                <Paper p="xl" radius="md" withBorder style={{ textAlign: 'center', backgroundColor: 'transparent', borderStyle: 'dashed' }}>
                    <Stack align="center" gap="xs">
                        <IconBell size={48} color="var(--mantine-color-gray-4)" stroke={1} />
                        <Title order={3} c="dimmed">No tienes notificaciones</Title>
                        <Text c="dimmed" size="sm">Te avisaremos cuando haya algo nuevo para ti.</Text>
                    </Stack>
                </Paper>
            ) : (
                <Stack gap="xl">
                    {grouped.map(([groupName, items]) => (
                        <div key={groupName}>
                            <Group gap="xs" mb="md">
                                <IconCalendar size={16} color="var(--mantine-color-dimmed)" />
                                <Text size="xs" fw={700} c="dimmed" tt="uppercase" lts={1}>{groupName}</Text>
                                <Divider style={{ flex: 1 }} />
                            </Group>
                            
                            <Stack gap="sm">
                                {items.map((notif) => (
                                    <Paper 
                                        key={notif.id_notificacion}
                                        p="md"
                                        radius="md"
                                        withBorder
                                        className="notif-card"
                                        onClick={() => handleNotificationClick(notif)}
                                        style={{
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            borderLeft: notif.leido ? 'none' : '4px solid var(--mantine-color-adl-blue-6)',
                                            backgroundColor: notif.leido ? 'white' : 'var(--mantine-color-adl-blue-0)',
                                            position: 'relative'
                                        }}
                                    >
                                        <Group wrap="nowrap" align="flex-start">
                                            <Box style={{ paddingTop: 4 }}>
                                                {getIcon(notif.tipo)}
                                            </Box>
                                            <div style={{ flex: 1 }}>
                                                <Group justify="space-between" mb={4}>
                                                    <Text size="sm" fw={700} c={notif.leido ? 'dark.4' : 'dark.7'}>
                                                        {formatTitle(notif.titulo)}
                                                    </Text>

                                                    <Text size="xs" c="dimmed">
                                                        {dayjs(notif.fecha).format('HH:mm')}
                                                    </Text>
                                                </Group>
                                                <Text size="sm" c="dimmed" lineClamp={2}>
                                                    {notif.mensaje}
                                                </Text>
                                                {notif.area && (
                                                    <Badge size="xs" variant="light" color="gray" mt="xs">
                                                        {notif.area}
                                                    </Badge>
                                                )}
                                            </div>
                                            <IconChevronRight size={18} color="var(--mantine-color-gray-4)" style={{ alignSelf: 'center' }} />
                                        </Group>
                                    </Paper>
                                ))}
                            </Stack>
                        </div>
                    ))}
                </Stack>
            )}

            <style>{`
                .notif-card:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--mantine-shadow-md);
                    border-color: var(--mantine-color-adl-blue-2);
                }
            `}</style>
        </Box>
    );
};
