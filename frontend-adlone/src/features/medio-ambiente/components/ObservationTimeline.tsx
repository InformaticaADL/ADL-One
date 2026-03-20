import React, { useEffect, useState } from 'react';
import { 
    Timeline, 
    Text, 
    Paper, 
    Group, 
    Stack, 
    ThemeIcon, 
    Badge, 
    Collapse, 
    UnstyledButton,
    Loader,
    Center,
    Box
} from '@mantine/core';
import { 
    IconPencil, 
    IconCheck, 
    IconX, 
    IconAlertTriangle, 
    IconCalendar, 
    IconInfoCircle,
    IconChevronDown
} from '@tabler/icons-react';
import { fichaService } from '../services/ficha.service';

interface TimelineEvent {
    id: string; // Unique ID for key/expansion
    date: Date;
    action: string;
    user: string;
    observation: string;
    stateChange?: { from: string; to: string };
    type: 'CREATION' | 'APPROVAL' | 'REJECTION' | 'REVIEW' | 'ASSIGNMENT' | 'OTHER';
}

interface ObservationTimelineProps {
    fichaId: number;
    // Optional data to synthesize creation event if missing in DB history
    creationData?: {
        date: string;
        user: string;
        observation: string;
    };
}

export const ObservationTimeline: React.FC<ObservationTimelineProps> = ({ fichaId, creationData }) => {
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (fichaId) {
            setLoading(true);
            fichaService.getHistorial(fichaId)
                .then(data => {
                    const mappedEvents: TimelineEvent[] = (data || []).map((item: any, idx: number) => ({
                        id: `hist-${item.id_historial || idx}`,
                        date: new Date(item.fecha),
                        action: item.accion,
                        user: item.nombre_real || item.nombre_usuario || 'Sistema',
                        observation: item.observacion,
                        stateChange: item.estado_nuevo ? { from: item.estado_anterior, to: item.estado_nuevo } : undefined,
                        type: determineType(item.accion)
                    }));

                    // Check if Creation exists
                    const hasCreation = mappedEvents.some(e => e.type === 'CREATION');

                    if (!hasCreation && creationData) {
                        // Synthesize creation event
                        const creationEvent: TimelineEvent = {
                            id: 'synth-creation',
                            date: new Date(creationData.date),
                            action: 'FICHA CREADA',
                            user: creationData.user || 'Desconocido',
                            observation: creationData.observation,
                            type: 'CREATION',
                            stateChange: { from: '', to: 'NUEVA' }
                        };
                        mappedEvents.push(creationEvent);
                    }

                    // Sort by date ASCENDING for timeline flow (Oldest first)
                    mappedEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

                    setEvents(mappedEvents);
                })
                .catch(err => console.error("Error loading history:", err))
                .finally(() => setLoading(false));
        }
    }, [fichaId, creationData]);

    const determineType = (action: string): TimelineEvent['type'] => {
        const act = action.toUpperCase();
        if (act.includes('CREACION') || act.includes('CREADA')) return 'CREATION';
        if (act.includes('APROB') || act.includes('ACEPT')) return 'APPROVAL';
        if (act.includes('RECHAZ')) return 'REJECTION';
        if (act.includes('REVISI')) return 'REVIEW';
        if (act.includes('ASIGNA')) return 'ASSIGNMENT';
        return 'OTHER';
    };

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedIds);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedIds(newExpanded);
    };

    const getIcon = (type: TimelineEvent['type']) => {
        switch (type) {
            case 'CREATION': return <IconPencil size={14} />;
            case 'APPROVAL': return <IconCheck size={14} />;
            case 'REJECTION': return <IconX size={14} />;
            case 'REVIEW': return <IconAlertTriangle size={14} />;
            case 'ASSIGNMENT': return <IconCalendar size={14} />;
            default: return <IconInfoCircle size={14} />;
        }
    };

    const getColor = (type: TimelineEvent['type']) => {
        switch (type) {
            case 'CREATION': return 'blue';
            case 'APPROVAL': return 'teal';
            case 'REJECTION': return 'red';
            case 'REVIEW': return 'orange';
            case 'ASSIGNMENT': return 'violet';
            default: return 'gray';
        }
    };

    const humanizeAction = (action: string): string => {
        const actionMap: Record<string, string> = {
            'aprobacion_tecnica': 'aprobada por el Área Técnica',
            'aprobacion_coordinacion': 'aprobada por el Área Coordinación',
            'rechazo_tecnica': 'rechazada por el Área Técnica, solicitud de revisión',
            'rechazo_coordinacion': 'rechazada por el Área Coordinación, solicitud de revisión',
            'asignacion_muestreador': 'programación realizada por el Área Coordinación',
            'ASIGNACION_MASIVA': 'programación realizada por el Área Coordinación',
            'ASIGNACION_MUESTREO': 'programación realizada por el Área Coordinación',
            'revision': 'en revisión',
            'creacion': 'creada por el Área Comercial',
            'CREACION_FICHA': 'creada por el Área Comercial',
            'actualizacion': 'actualizada',
            'FICHA CREADA': 'creada por el Área Comercial',
            'EDICION_POR_AREA_COMERCIAL': 'editada por el Área Comercial',
            'EDICION_COMERCIAL': 'editada por el Área Comercial'
        };

        if (actionMap[action]) return actionMap[action];
        const lowerAction = action.toLowerCase();
        if (actionMap[lowerAction]) return actionMap[lowerAction];
        return action.replace(/_/g, ' ').toLowerCase();
    };

    if (loading) return (
        <Center p="xl">
            <Stack align="center" gap="xs">
                <Loader size="sm" />
                <Text size="xs" c="dimmed">Cargando línea de tiempo...</Text>
            </Stack>
        </Center>
    );

    if (events.length === 0) return (
        <Center p="xl">
            <Text size="sm" c="dimmed" fs="italic">No hay eventos registrados.</Text>
        </Center>
    );

    return (
        <Timeline active={events.length} bulletSize={30} lineWidth={2}>
            {events.map((event) => {
                const isExpanded = expandedIds.has(event.id);
                const color = getColor(event.type);

                return (
                    <Timeline.Item 
                        key={event.id}
                        bullet={
                            <ThemeIcon 
                                size={22} 
                                radius="xl" 
                                color={color} 
                                variant="light"
                            >
                                {getIcon(event.type)}
                            </ThemeIcon>
                        }
                    >
                        <Paper withBorder radius="md" p={0} shadow="xs" style={{ overflow: 'hidden' }}>
                            <UnstyledButton 
                                onClick={() => toggleExpand(event.id)}
                                w="100%"
                                p="md"
                                bg={isExpanded ? `${color}.0` : 'transparent'}
                                style={{ borderBottom: isExpanded ? `1px solid var(--mantine-color-${color}-1)` : 'none' }}
                            >
                                <Group justify="space-between" align="flex-start" wrap="nowrap">
                                    <Box style={{ flex: 1 }}>
                                        <Text size="sm" fw={600} lh={1.2}>
                                            {`Ficha ${fichaId} ${humanizeAction(event.action)}`}
                                        </Text>
                                        <Text size="xs" c="dimmed" mt={4}>
                                            Responsable: <Text component="span" fw={700} c="gray.7">{event.user}</Text>
                                        </Text>
                                        <Text size="xs" c="dimmed">
                                            {event.date.toLocaleString()}
                                        </Text>
                                    </Box>
                                    <IconChevronDown 
                                        size={16} 
                                        style={{ 
                                            transform: isExpanded ? 'rotate(180deg)' : 'none', 
                                            transition: 'transform 200ms ease',
                                            color: 'var(--mantine-color-gray-4)'
                                        }} 
                                    />
                                </Group>
                            </UnstyledButton>

                            <Collapse in={isExpanded}>
                                <Box p="md">
                                    {event.stateChange && (
                                        <Group gap="xs" mb="sm">
                                            <Badge variant="outline" color="gray" size="sm" radius="sm">
                                                {event.stateChange.from || 'Inicio'}
                                            </Badge>
                                            <Text size="xs" c="dimmed">→</Text>
                                            <Badge variant="filled" color={color} size="sm" radius="sm">
                                                {event.stateChange.to}
                                            </Badge>
                                        </Group>
                                    )}

                                    {event.observation ? (
                                        <Paper bg="gray.0" p="sm" radius="sm" withBorder>
                                            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                                                {event.observation}
                                            </Text>
                                        </Paper>
                                    ) : (
                                        <Text size="xs" c="dimmed" fs="italic">
                                            Sin observaciones registradas.
                                        </Text>
                                    )}
                                </Box>
                            </Collapse>
                        </Paper>
                    </Timeline.Item>
                );
            })}
        </Timeline>
    );
};
