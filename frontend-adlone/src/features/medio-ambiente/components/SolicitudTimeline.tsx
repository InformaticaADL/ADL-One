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
    IconUsers, 
    IconInfoCircle,
    IconChevronDown,
    IconArrowRight
} from '@tabler/icons-react';
import { adminService } from '../../../services/admin.service';

interface TimelineEvent {
    id: string; // Unique ID for key/expansion
    date: Date;
    action: string;
    user: string;
    observation: string;
    stateChange?: { from: string; to: string };
    type: 'CREATION' | 'APPROVAL' | 'REJECTION' | 'REVIEW' | 'ASSIGNMENT' | 'OTHER';
}

interface SolicitudTimelineProps {
    solicitudId: number;
    // Optional data to synthesize creation event if missing in DB history
    creationData?: {
        date: string;
        user: string;
        observation: string;
    };
}

export const SolicitudTimeline: React.FC<SolicitudTimelineProps> = ({ solicitudId, creationData }) => {
    const [events, setEvents] = useState<TimelineEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (solicitudId) {
            setLoading(true);
            adminService.getSolicitudHistorial(solicitudId)
                .then(data => {
                    const mappedEvents: TimelineEvent[] = (data || []).map((item: any, idx: number) => {
                        const date = new Date(item.fecha);
                        return {
                            id: `hist-${item.id_historial || idx}`,
                            date: date,
                            action: item.accion,
                            user: item.nombre_real || item.nombre_usuario || 'Sistema',
                            observation: item.observacion,
                            stateChange: item.estado_nuevo ? { from: item.estado_anterior, to: item.estado_nuevo } : undefined,
                            type: determineType(item.accion)
                        };
                    });

                    const hasCreation = mappedEvents.some(e => e.type === 'CREATION');

                    if (!hasCreation && creationData) {
                        const creationEvent: TimelineEvent = {
                            id: 'synth-creation',
                            date: new Date(creationData.date),
                            action: 'Creación de Solicitud',
                            user: creationData.user,
                            observation: creationData.observation || 'Solicitud ingresada al sistema.',
                            type: 'CREATION'
                        };
                        mappedEvents.push(creationEvent);
                    }

                    // Sort descending (newest first)
                    mappedEvents.sort((a, b) => b.date.getTime() - a.date.getTime());
                    setEvents(mappedEvents);
                })
                .catch(err => console.error('Failed to load history:', err))
                .finally(() => setLoading(false));
        }
    }, [solicitudId, creationData]);

    const determineType = (action: string): TimelineEvent['type'] => {
        if (!action) return 'OTHER';
        const act = action.toUpperCase();
        if (act.includes('CREACION')) return 'CREATION';
        if (act.includes('APROB') || act.includes('ACEPT')) return 'APPROVAL';
        if (act.includes('RECHAZ')) return 'REJECTION';
        if (act.includes('REVISION')) return 'REVIEW';
        if (act.includes('ASIGN')) return 'ASSIGNMENT';
        if (act.includes('RESOLUCION')) return 'APPROVAL';
        return 'OTHER';
    };

    const toggleExpand = (id: string) => {
        const next = new Set(expandedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedIds(next);
    };

    const getIcon = (type: TimelineEvent['type']) => {
        switch (type) {
            case 'CREATION': return <IconPencil size={14} />;
            case 'APPROVAL': return <IconCheck size={14} />;
            case 'REJECTION': return <IconX size={14} />;
            case 'REVIEW': return <IconAlertTriangle size={14} />;
            case 'ASSIGNMENT': return <IconUsers size={14} />;
            default: return <IconInfoCircle size={14} />;
        }
    };

    const getColor = (type: TimelineEvent['type']) => {
        switch (type) {
            case 'CREATION': return 'indigo';
            case 'APPROVAL': return 'green';
            case 'REJECTION': return 'red';
            case 'REVIEW': return 'yellow';
            case 'ASSIGNMENT': return 'grape';
            default: return 'gray';
        }
    };

    const getFriendlyAction = (action: string) => {
        const actionMap: Record<string, string> = {
            'CREACION_SOLICITUD': 'Creación de Solicitud',
            'ACEPTACION_REVISION': 'Aceptado para Revisión',
            'DERIVACION_CALIDAD': 'Derivado a Calidad',
            'CONCLUIDO_TECNICA': 'Concluido por Área Técnica',
            'RECHAZADO_TECNICA': 'Rechazado por Área Técnica',
            'APROBACION_CALIDAD': 'Aprobado por Calidad',
            'RECHAZO_CALIDAD': 'Rechazado por Calidad',
            'CIERRE_AUTOMATICO': 'Cierre Automático',
            'CAMBIO_ESTADO': 'Cambio de Estado'
        };
        return actionMap[action] || action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
    };

    const getFriendlyState = (s: string) => {
        if (!s) return '';
        const states: Record<string, string> = {
            'PENDIENTE': 'Pendiente',
            'PENDIENTE_TECNICA': 'Pendiente Área Técnica',
            'EN_REVISION_TECNICA': 'En Revisión Área Técnica',
            'PENDIENTE_CALIDAD': 'Pendiente Área Calidad',
            'APROBADO': 'Aprobado',
            'RECHAZADO': 'Rechazado',
            'CONCLUIDO': 'Concluido',
            'DERIVADO': 'Derivado'
        };
        return states[s] || s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
    };

    if (loading) return (
        <Center p="xl">
            <Stack align="center" gap="xs">
                <Loader size="sm" />
                <Text size="xs" c="dimmed">Cargando historial...</Text>
            </Stack>
        </Center>
    );

    if (events.length === 0) return (
        <Center p="xl">
            <Text size="sm" c="dimmed" fs="italic">No hay historial disponible.</Text>
        </Center>
    );

    return (
        <Timeline active={0} bulletSize={30} lineWidth={2}>
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
                                        <Text size="sm" fw={600}>{getFriendlyAction(event.action)}</Text>
                                        <Group gap={8} mt={4}>
                                            <Badge variant="light" color="gray" size="xs">{event.user}</Badge>
                                            <Text size="xs" c="dimmed">•</Text>
                                            <Text size="xs" c="dimmed">{event.date.toLocaleDateString('es-CL')} {event.date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</Text>
                                        </Group>
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
                                        <Group gap="xs" mb="sm" wrap="nowrap">
                                            {event.stateChange.from && (
                                                <>
                                                    <Badge variant="outline" color="gray" size="sm" radius="sm">
                                                        {getFriendlyState(event.stateChange.from)}
                                                    </Badge>
                                                    <IconArrowRight size={12} style={{ color: 'var(--mantine-color-gray-4)' }} />
                                                </>
                                            )}
                                            <Badge variant="filled" color={color} size="sm" radius="sm">
                                                {getFriendlyState(event.stateChange.to)}
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
                                        <Text size="xs" c="dimmed" fs="italic">Sin observaciones registradas.</Text>
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
