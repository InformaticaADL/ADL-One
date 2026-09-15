import { useEffect, useState, useMemo } from 'react';
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
import { PageHeader } from '../../../components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

const TYPE_OPTIONS = [
    { label: 'Éxito', value: 'SUCCESS' },
    { label: 'Advertencia', value: 'WARNING' },
    { label: 'Error', value: 'ERROR' },
    { label: 'Información', value: 'INFO' },
];

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
            case 'SUCCESS': return <IconCircleCheck size={20} className="text-success" />;
            case 'WARNING': return <IconAlertTriangle size={20} className="text-warning" />;
            case 'ERROR': return <IconCircleX size={20} className="text-destructive" />;
            default: return <IconInfoCircle size={20} className="text-primary" />;
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
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Notificaciones"
                subtitle="Historial completo de alertas y mensajes del sistema."
                breadcrumbItems={[{ label: 'Inicio' }, { label: 'Notificaciones' }]}
                rightSection={unreadCount > 0 ? (
                    <Button variant="outline" disabled={markingAll} onClick={handleMarkAllAsRead}>
                        {markingAll ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <IconChecks size={16} />}
                        Marcar todas como leídas
                    </Button>
                ) : null}
            />

            <div className="mb-6 flex flex-wrap items-center gap-3">
                <div className="relative min-w-[200px] flex-1">
                    <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar notificaciones..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <Combobox
                    className="w-[170px]"
                    placeholder="Tipo"
                    value={typeFilter ?? undefined}
                    onValueChange={(v) => setTypeFilter(v || null)}
                    options={[{ value: '', label: 'Todos' }, ...TYPE_OPTIONS]}
                />
                {areas.length > 0 && (
                    <Combobox
                        className="w-[170px]"
                        placeholder="Área"
                        value={areaFilter ?? undefined}
                        onValueChange={(v) => setAreaFilter(v || null)}
                        options={[{ value: '', label: 'Todas' }, ...areas.map(a => ({ value: a, label: a }))]}
                    />
                )}
                <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                    <TabsList>
                        <TabsTrigger value="ALL">Todas</TabsTrigger>
                        <TabsTrigger value="UNREAD">No leídas</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {loading ? (
                <div className="flex h-[300px] items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            ) : filteredNotifications.length === 0 ? (
                <Card className="border-dashed bg-transparent p-8 text-center">
                    <div className="flex flex-col items-center gap-2">
                        <IconBell size={48} strokeWidth={1} className="text-muted-foreground" />
                        <p className="m-0 text-lg font-semibold text-muted-foreground">
                            {notifications.length === 0 ? 'No tienes notificaciones' : 'No hay resultados'}
                        </p>
                        <p className="text-[13px] text-muted-foreground">
                            {notifications.length === 0 ? 'Te avisaremos cuando haya algo nuevo para ti.' : 'Intenta cambiar los filtros seleccionados.'}
                        </p>
                    </div>
                </Card>
            ) : (
                <div className="flex flex-col gap-6">
                    {grouped.map(([groupName, items]) => (
                        <div key={groupName}>
                            <div className="mb-4 flex items-center gap-2">
                                <IconCalendar size={16} className="text-muted-foreground" />
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{groupName}</span>
                                <hr className="flex-1 border-t border-border" />
                            </div>

                            <div className="flex flex-col gap-3">
                                {items.map((notif) => (
                                    <Card
                                        key={notif.id_notificacion}
                                        onClick={() => handleNotificationClick(notif)}
                                        className={`cursor-pointer p-3 transition-all hover:-translate-y-0.5 hover:shadow-md ${notif.leido ? '' : 'border-l-4 border-l-primary bg-primary/5'}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="pt-1">
                                                {getIcon(notif.tipo)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="mb-1 flex justify-between gap-2">
                                                    <span className="text-[13px] font-semibold text-foreground">
                                                        {formatTitle(notif.titulo)}
                                                    </span>
                                                    <span className="shrink-0 text-xs text-muted-foreground">
                                                        {dayjs(notif.fecha).format('HH:mm')}
                                                    </span>
                                                </div>
                                                <p className="m-0 line-clamp-2 text-[13px] text-muted-foreground">
                                                    {notif.mensaje}
                                                </p>
                                                {notif.area && (
                                                    <Badge variant="outline" className="mt-2">
                                                        {notif.area}
                                                    </Badge>
                                                )}
                                            </div>
                                            <IconChevronRight size={18} className="shrink-0 self-center text-muted-foreground" />
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
