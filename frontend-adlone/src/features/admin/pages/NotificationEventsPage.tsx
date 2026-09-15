import React, { useState, useEffect, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

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
            <div className="shadcn-scope flex h-[400px] w-full flex-col items-center justify-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Cargando catálogo de notificaciones...</p>
            </div>
        );
    }

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
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
                    <div className="relative w-[350px]">
                        <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por código o descripción..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                }
            />

            <div className="mt-8">
                {searchTerm ? (
                    <div>
                        <div className="mb-6 flex items-center gap-3">
                            <IconSearch size={20} className="text-primary" />
                            <p className="text-sm font-semibold text-foreground">Resultados para "{searchTerm}" ({filteredEvents.length})</p>
                            <hr className="flex-1 border-t border-border" />
                        </div>
                        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                            {filteredEvents.map(ev => (
                                <EventCard key={ev.id_evento} event={ev} onSelect={onSelectEvent} />
                            ))}
                            {filteredEvents.length === 0 && (
                                <div className="py-10 text-center text-sm text-muted-foreground" style={{ gridColumn: '1 / -1' }}>
                                    No se encontraron eventos coincidentes.
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="flex-wrap">
                            {modules.map(mod => (
                                <TabsTrigger key={mod} value={mod} className="gap-1.5">
                                    <IconFolder size={16} /> {mod}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        {modules.map(mod => (
                            <TabsContent key={mod} value={mod}>
                                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                                    {events.filter(e => (e.modulo || 'General') === mod).map(ev => (
                                        <EventCard key={ev.id_evento} event={ev} onSelect={onSelectEvent} />
                                    ))}
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                )}
            </div>
        </div>
    );
};

interface EventCardProps {
    event: NotificationEvent;
    onSelect: (event: NotificationEvent) => void;
}

const EventCard = ({ event, onSelect }: EventCardProps) => {
    return (
        <Card
            onClick={() => onSelect(event)}
            className="flex cursor-pointer flex-col gap-2 p-4 transition-all hover:-translate-y-1 hover:shadow-md"
        >
            <div className="flex items-center justify-between">
                <Badge variant="outline" className="font-mono normal-case">{event.codigo_evento}</Badge>
                <IconChevronRight size={16} className="text-muted-foreground" />
            </div>

            <p className="text-sm font-semibold text-foreground">{event.descripcion}</p>

            <div className="flex items-center gap-2">
                <IconMail size={14} className="shrink-0 text-muted-foreground" />
                <p className="truncate text-xs text-muted-foreground">{event.asunto_template}</p>
            </div>
        </Card>
    );
};
