import React, { useState, useEffect, useMemo } from 'react';
import { Card, Typography, Input, Tag, Spin, Tabs } from 'antd';
import {
    IconSearch,
    IconFolder,
    IconMail,
    IconChevronRight
} from '@tabler/icons-react';
import { notificationService } from '../../../services/notification.service';
import { useToast } from '../../../contexts/ToastContext';
import { useNavStore } from '../../../store/navStore';
import { PageHeader } from '../../../components/layout/PageHeader';

const { Text } = Typography;

interface NotificationEvent {
    id_evento: number;
    codigo_evento: string;
    descripcion: string;
    asunto_template: string;
    modulo?: string;
}

interface Props {
    onBack?: () => void;
    onSelectEvent: (event: NotificationEvent) => void;
}

export const NotificationEventsPage: React.FC<Props> = ({ onBack, onSelectEvent }) => {
    const { showToast } = useToast();
    const { adminSearchTerm, setAdminSearchTerm } = useNavStore();
    const [events, setEvents] = useState<NotificationEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<string>('');

    useEffect(() => {
        loadEvents();
        return () => setAdminSearchTerm('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadEvents = async () => {
        try {
            setLoading(true);
            const data = await notificationService.getEvents();
            setEvents(data);

            // Logic to determine initial tab
            const modules: string[] = Array.from(new Set(data.map((e: NotificationEvent) => e.modulo || 'General')));
            if (modules.length > 0) {
                setActiveTab(modules[0]);
            }

            if (adminSearchTerm) {
                setSearchTerm(adminSearchTerm);
            }
        } catch (error) {
            showToast({ type: 'error', message: "Error al cargar eventos" });
        } finally {
            setLoading(false);
        }
    };

    const getThemeColor = (code: string) => {
        if (code.includes('_ALTA')) return 'blue';
        if (code.includes('_BAJA')) return 'red';
        if (code.includes('_REVISION')) return 'orange';
        if (code.includes('_VIGENCIA')) return 'magenta';
        if (code.includes('_TRASPASO')) return 'cyan';
        if (code.includes('_REAC')) return 'green';
        if (code.includes('_NUEVO_EQUIPO')) return 'geekblue';
        return 'default';
    };

    const filteredEvents = useMemo(() => {
        return events.filter(ev =>
            ev.codigo_evento.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ev.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (ev.modulo && ev.modulo.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [events, searchTerm]);

    const modules = useMemo(() => {
        const mods = Array.from(new Set(events.map(e => e.modulo || 'General'))).sort();
        return mods;
    }, [events]);

    if (loading) {
        return (
            <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <Spin size="large" />
                    <Text type="secondary" style={{ fontSize: 13 }}>Cargando catálogo de notificaciones...</Text>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: 16, width: '100%' }}>
            <PageHeader
                title="Configuración de Notificaciones"
                subtitle="Paso 1: Seleccione el evento del sistema que desea configurar."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Administración', onClick: onBack },
                    { label: 'Notificaciones', onClick: onBack },
                    { label: 'Selección de Evento' }
                ]}
                rightSection={
                    <Input
                        placeholder="Buscar por código o descripción..."
                        value={searchTerm}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                        prefix={<IconSearch size={16} style={{ color: 'var(--app-text-secondary)' }} />}
                        style={{ width: 350 }}
                    />
                }
            />

            <div style={{ marginTop: 32 }}>
                {searchTerm ? (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                            <IconSearch size={20} color="#1c7ed6" />
                            <Text strong>Resultados para "{searchTerm}" ({filteredEvents.length})</Text>
                            <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--app-border)' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                            {filteredEvents.map(ev => (
                                <EventCard key={ev.id_evento} event={ev} onSelect={onSelectEvent} color={getThemeColor(ev.codigo_evento)} />
                            ))}
                            {filteredEvents.length === 0 && (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40 }}>
                                    <Text type="secondary">No se encontraron eventos coincidentes.</Text>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <Tabs
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        items={modules.map(mod => ({
                            key: mod,
                            label: <span><IconFolder size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />{mod}</span>,
                            children: (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                                    {events.filter(e => (e.modulo || 'General') === mod).map(ev => (
                                        <EventCard key={ev.id_evento} event={ev} onSelect={onSelectEvent} color={getThemeColor(ev.codigo_evento)} />
                                    ))}
                                </div>
                            ),
                        }))}
                    />
                )}
            </div>
        </div>
    );
};

interface EventCardProps {
    event: NotificationEvent;
    onSelect: (event: NotificationEvent) => void;
    color: string;
}

const EventCard = ({ event, onSelect, color }: EventCardProps) => {
    const [hovering, setHovering] = useState(false);
    return (
        <div onClick={() => onSelect(event)} onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)} style={{ cursor: 'pointer' }}>
            <Card
                size="small"
                style={{
                    height: '100%',
                    transition: 'all 0.2s ease',
                    transform: hovering ? 'translateY(-4px)' : 'none',
                    boxShadow: hovering ? '0 8px 20px rgba(0,0,0,0.08)' : undefined,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'nowrap' }}>
                    <Tag color={color}>{event.codigo_evento}</Tag>
                    <IconChevronRight size={16} color="var(--app-text-secondary)" />
                </div>

                <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
                    {event.descripcion}
                </Text>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <IconMail size={14} color="var(--app-text-secondary)" />
                    <Text type="secondary" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {event.asunto_template}
                    </Text>
                </div>
            </Card>
        </div>
    );
};
