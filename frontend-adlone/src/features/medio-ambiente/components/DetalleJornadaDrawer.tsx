import { Drawer, Text, Timeline, Badge, Group, SimpleGrid, Box } from '@mantine/core';
import { IconCheck, IconClock, IconMapPin } from '@tabler/icons-react';
import type { JornadaHoy } from '../services/tracking.service';

interface DetalleJornadaDrawerProps {
    jornada: JornadaHoy | null;
    opened: boolean;
    onClose: () => void;
}

function fichaCompletada(ficha: JornadaHoy['fichas_hoy'][number]): boolean {
    return ficha.retiro_completado === 'S' || ficha.instalacion_completado === 'S';
}

export function DetalleJornadaDrawer({ jornada, opened, onClose }: DetalleJornadaDrawerProps) {
    if (!jornada) {
        return <Drawer opened={opened} onClose={onClose} position="right" size="sm" title="Detalle" />;
    }

    const indiceActivo = jornada.fichas_hoy.findIndex((f) => !fichaCompletada(f));

    return (
        <Drawer opened={opened} onClose={onClose} position="right" size="sm" title={jornada.nombre_muestreador}>
            <Group mb="md">
                <Badge color={jornada.ultima_posicion ? 'green' : 'gray'} variant="light" leftSection={<IconMapPin size={12} />}>
                    {jornada.ultima_posicion ? 'En ruta' : 'Sin posición'}
                </Badge>
            </Group>

            <SimpleGrid cols={2} mb="md">
                <Box>
                    <Text size="xs" c="dimmed">Fichas hoy</Text>
                    <Text fw={700}>{jornada.fichas_hoy.length}</Text>
                </Box>
                <Box>
                    <Text size="xs" c="dimmed">Inicio jornada</Text>
                    <Text fw={700}>
                        {new Date(jornada.fecha_inicio).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </Box>
            </SimpleGrid>

            <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs">Itinerario de hoy</Text>

            {jornada.fichas_hoy.length === 0 ? (
                <Text size="sm" c="dimmed">Sin fichas agendadas hoy.</Text>
            ) : (
                <Timeline active={indiceActivo === -1 ? jornada.fichas_hoy.length : indiceActivo} bulletSize={20}>
                    {jornada.fichas_hoy.map((ficha) => {
                        const completada = fichaCompletada(ficha);
                        return (
                            <Timeline.Item
                                key={ficha.id_agendamam}
                                bullet={completada ? <IconCheck size={12} /> : <IconClock size={12} />}
                                title={ficha.frecuencia_correlativo}
                            >
                                <Text size="xs" c="dimmed">
                                    {completada ? 'Completada' : 'Pendiente'} · {ficha.hora_coordinador || '—'}
                                </Text>
                            </Timeline.Item>
                        );
                    })}
                </Timeline>
            )}
        </Drawer>
    );
}
