import React, { useState, useEffect, useMemo } from 'react';
import { 
    Stack, 
    Grid, 
    Card, 
    Text, 
    TextInput, 
    Badge, 
    Group, 
    Box, 
    Loader, 
    Center,
    UnstyledButton,
    Tabs,
    Divider
} from '@mantine/core';
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
    const [activeTab, setActiveTab] = useState<string | null>(null);

    useEffect(() => {
        loadEvents();
        return () => setAdminSearchTerm('');
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
        if (code.includes('_VIGENCIA')) return 'pink';
        if (code.includes('_TRASPASO')) return 'teal';
        if (code.includes('_REAC')) return 'green';
        if (code.includes('_NUEVO_EQUIPO')) return 'indigo';
        return 'gray';
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

    // If searching, we might want to show all results regardless of tab, or highlight tabs with results
    // Let's implement a "Search Results" view if searching, or keep tabs but show matches count

    if (loading) {
        return (
            <Center h={400}>
                <Stack align="center">
                    <Loader size="xl" type="bars" color="blue" />
                    <Text size="sm" c="dimmed">Cargando catálogo de notificaciones...</Text>
                </Stack>
            </Center>
        );
    }

    return (
        <Box p="md" style={{ width: '100%' }}>
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
                    <TextInput 
                        placeholder="Buscar por código o descripción..."
                        value={searchTerm}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.currentTarget.value)}
                        leftSection={<IconSearch size={16} />}
                        w={350}
                        radius="md"
                    />
                }
            />

            <Box mt="xl">
                {searchTerm ? (
                    <Box>
                        <Group mb="lg">
                            <IconSearch size={20} color="var(--mantine-color-blue-6)" />
                            <Text fw={700}>Resultados para "{searchTerm}" ({filteredEvents.length})</Text>
                            <Divider flex={1} />
                        </Group>
                        <Grid>
                            {filteredEvents.map(ev => (
                                <Grid.Col key={ev.id_evento} span={{ base: 12, sm: 6, lg: 4 }}>
                                    <EventCard event={ev} onSelect={onSelectEvent} color={getThemeColor(ev.codigo_evento)} />
                                </Grid.Col>
                            ))}
                            {filteredEvents.length === 0 && (
                                <Grid.Col span={12}>
                                    <Center py={40}>
                                        <Text c="dimmed">No se encontraron eventos coincidentes.</Text>
                                    </Center>
                                </Grid.Col>
                            )}
                        </Grid>
                    </Box>
                ) : (
                    <Tabs value={activeTab} onChange={setActiveTab} variant="pills" radius="md">
                        <Tabs.List mb="xl">
                            {modules.map(mod => (
                                <Tabs.Tab 
                                    key={mod} 
                                    value={mod} 
                                    leftSection={<IconFolder size={16} />}
                                >
                                    {mod}
                                </Tabs.Tab>
                            ))}
                        </Tabs.List>

                        {modules.map(mod => (
                            <Tabs.Panel key={mod} value={mod}>
                                <Grid>
                                    {events.filter(e => (e.modulo || 'General') === mod).map(ev => (
                                        <Grid.Col key={ev.id_evento} span={{ base: 12, sm: 6, lg: 4 }}>
                                            <EventCard event={ev} onSelect={onSelectEvent} color={getThemeColor(ev.codigo_evento)} />
                                        </Grid.Col>
                                    ))}
                                </Grid>
                            </Tabs.Panel>
                        ))}
                    </Tabs>
                )}
            </Box>
        </Box>
    );
};

interface EventCardProps {
    event: NotificationEvent;
    onSelect: (event: NotificationEvent) => void;
    color: string;
}

const EventCard = ({ event, onSelect, color }: EventCardProps) => (
    <UnstyledButton onClick={() => onSelect(event)} w="100%">
        <Card 
            withBorder 
            padding="lg" 
            radius="md" 
            style={{
                height: '100%',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 'var(--mantine-shadow-md)',
                    borderColor: `var(--mantine-color-${color}-light-color)`
                }
            }}
        >
            <Group justify="space-between" mb="xs" wrap="nowrap">
                <Badge color={color} variant="light" size="xs" radius="sm">
                    {event.codigo_evento}
                </Badge>
                <IconChevronRight size={16} color="var(--mantine-color-gray-4)" />
            </Group>

            <Text fw={700} size="md" mb="xs" lineClamp={2}>
                {event.descripcion}
            </Text>

            <Group gap="xs" mt="auto">
                <IconMail size={14} color="var(--mantine-color-gray-5)" />
                <Text size="xs" c="dimmed" lineClamp={1}>
                    {event.asunto_template}
                </Text>
            </Group>
        </Card>
    </UnstyledButton>
);
