import { useEffect, useState, useMemo } from 'react';
import {
    Typography,
    Card,
    Tag,
    Segmented,
    Select,
    Input,
    Button,
    Spin
} from 'antd';
import {
    IconBell,
    IconCalendar,
    IconChevronRight,
    IconInfoCircle,
    IconAlertTriangle,
    IconCircleCheck,
    IconCircleX,
    IconSearch,
    IconChecks
} from '@tabler/icons-react';
import { useNotificationStore, type Notification } from '../../../store/notificationStore';
import { useNavStore } from '../../../store/navStore';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { handleNotificationNavigation } from '../utils/notificationNavigation';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

const { Title, Text } = Typography;

dayjs.locale('es');

export const UserNotificationsPage = () => {
    const { notifications, loading, fetchNotifications, markAsRead, markAllAsRead } = useNotificationStore();
    const {
        setActiveModule, setActiveSubmodule,
        setPendingRequestId, setPendingChatId, setSelectedRequestId, setFichasMode
    } = useNavStore();
    const { hasPermission } = useAuth();
    const { showToast } = useToast();

    const [statusFilter, setStatusFilter] = useState('ALL');
    const [areaFilter, setAreaFilter] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<string | null>(null);
    const [searchFilter, setSearchFilter] = useState('');
    const [markingAll, setMarkingAll] = useState(false);
    const [hoveredId, setHoveredId] = useState<number | null>(null);

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
            setSelectedRequestId,
            setFichasMode,
            hasPermission,
            showToast
        });
    };

    const handleMarkAllAsRead = async () => {
        setMarkingAll(true);
        try {
            await markAllAsRead();
        } finally {
            setMarkingAll(false);
        }
    };

    const getIcon = (tipo: string) => {
        switch (tipo) {
            case 'SUCCESS': return <IconCircleCheck size={20} color="#2f9e44" />;
            case 'WARNING': return <IconAlertTriangle size={20} color="#e8590c" />;
            case 'ERROR': return <IconCircleX size={20} color="#e03131" />;
            default: return <IconInfoCircle size={20} color="#1c7ed6" />;
        }
    };

    const formatTitle = (title: string) => {
        if (!title) return '';
        if (title.includes('_')) {
            return title.replace(/^Aviso:\s*/, '').replace(/_/g, ' ');
        }
        return title;
    };

    const areas = useMemo(() => {
        const uniqueAreas = new Set(notifications.map(n => n.area).filter(Boolean));
        return Array.from(uniqueAreas) as string[];
    }, [notifications]);

    const unreadCount = notifications.filter(n => !n.leido).length;

    const filteredNotifications = useMemo(() => {
        return notifications.filter(n => {
            if (statusFilter === 'UNREAD' && n.leido) return false;
            if (areaFilter && n.area !== areaFilter) return false;
            if (typeFilter && n.tipo !== typeFilter) return false;
            if (searchFilter) {
                const searchLower = searchFilter.toLowerCase();
                const titleLower = formatTitle(n.titulo).toLowerCase();
                const messageLower = (n.mensaje || '').toLowerCase();
                if (!titleLower.includes(searchLower) && !messageLower.includes(searchLower)) return false;
            }
            return true;
        });
    }, [notifications, statusFilter, areaFilter, typeFilter, searchFilter]);

    const groupNotifications = () => {
        const groups: Record<string, Notification[]> = {
            'Hoy': [],
            'Ayer': [],
            'Esta semana': [],
            'Anteriores': []
        };
        const now = dayjs();
        filteredNotifications.forEach(n => {
            const date = dayjs(n.fecha);
            if (date.isSame(now, 'day')) groups['Hoy'].push(n);
            else if (date.isSame(now.subtract(1, 'day'), 'day')) groups['Ayer'].push(n);
            else if (date.isAfter(now.subtract(7, 'day'))) groups['Esta semana'].push(n);
            else groups['Anteriores'].push(n);
        });
        return Object.entries(groups).filter(([, items]) => items.length > 0);
    };

    const grouped = groupNotifications();

    return (
        <div style={{ padding: 32, width: '100%' }}>
            <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <Title level={1} style={{ margin: 0, letterSpacing: '-0.02em' }}>Notificaciones</Title>
                        <Text type="secondary" style={{ fontSize: 13 }}>Historial completo de alertas y mensajes del sistema.</Text>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Input
                            placeholder="Buscar notificaciones..."
                            prefix={<IconSearch size={16} style={{ color: 'var(--app-text-secondary)' }} />}
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            style={{ minWidth: 200, flex: 1 }}
                        />
                        <Select
                            placeholder="Tipo"
                            options={[
                                { label: 'Éxito', value: 'SUCCESS' },
                                { label: 'Advertencia', value: 'WARNING' },
                                { label: 'Error', value: 'ERROR' },
                                { label: 'Información', value: 'INFO' }
                            ]}
                            value={typeFilter ?? undefined}
                            onChange={(v) => setTypeFilter(v ?? null)}
                            allowClear
                            style={{ minWidth: 160 }}
                        />
                        {areas.length > 0 && (
                            <Select
                                placeholder="Área"
                                options={areas.map(a => ({ value: a, label: a }))}
                                value={areaFilter ?? undefined}
                                onChange={(v) => setAreaFilter(v ?? null)}
                                allowClear
                                style={{ minWidth: 160 }}
                            />
                        )}
                        <Segmented
                            value={statusFilter}
                            onChange={(v) => setStatusFilter(v as string)}
                            options={[
                                { label: 'Todas', value: 'ALL' },
                                { label: 'No leídas', value: 'UNREAD' },
                            ]}
                        />
                        {unreadCount > 0 && (
                            <Button
                                icon={<IconChecks size={16} />}
                                loading={markingAll}
                                onClick={handleMarkAllAsRead}
                            >
                                Marcar todas como leídas
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Spin size="large" />
                </div>
            ) : filteredNotifications.length === 0 ? (
                <Card style={{ textAlign: 'center', backgroundColor: 'transparent', borderStyle: 'dashed' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <IconBell size={48} color="var(--app-text-secondary)" strokeWidth={1} />
                        <Title level={3} type="secondary" style={{ margin: 0 }}>
                            {notifications.length === 0 ? 'No tienes notificaciones' : 'No hay resultados'}
                        </Title>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                            {notifications.length === 0 ? 'Te avisaremos cuando haya algo nuevo para ti.' : 'Intenta cambiar los filtros seleccionados.'}
                        </Text>
                    </div>
                </Card>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {grouped.map(([groupName, items]) => (
                        <div key={groupName}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                <IconCalendar size={16} color="var(--app-text-secondary)" />
                                <Text type="secondary" strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{groupName}</Text>
                                <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--app-border)' }} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {items.map((notif) => {
                                    const hovering = hoveredId === notif.id_notificacion;
                                    return (
                                        <Card
                                            key={notif.id_notificacion}
                                            size="small"
                                            onClick={() => handleNotificationClick(notif)}
                                            onMouseEnter={() => setHoveredId(notif.id_notificacion)}
                                            onMouseLeave={() => setHoveredId(null)}
                                            style={{
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                borderLeft: notif.leido ? undefined : '4px solid #0062a8',
                                                backgroundColor: notif.leido ? undefined : 'var(--app-accent-bg)',
                                                transform: hovering ? 'translateY(-2px)' : 'none',
                                                boxShadow: hovering ? '0 8px 20px rgba(0,0,0,0.08)' : undefined,
                                            }}
                                        >
                                            <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-start', gap: 12 }}>
                                                <div style={{ paddingTop: 4 }}>
                                                    {getIcon(notif.tipo)}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                        <Text strong style={{ fontSize: 13 }}>
                                                            {formatTitle(notif.titulo)}
                                                        </Text>
                                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                                            {dayjs(notif.fecha).format('HH:mm')}
                                                        </Text>
                                                    </div>
                                                    <Text type="secondary" style={{ fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                        {notif.mensaje}
                                                    </Text>
                                                    {notif.area && (
                                                        <Tag style={{ marginTop: 8 }}>
                                                            {notif.area}
                                                        </Tag>
                                                    )}
                                                </div>
                                                <IconChevronRight size={18} color="var(--app-text-secondary)" style={{ alignSelf: 'center' }} />
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
