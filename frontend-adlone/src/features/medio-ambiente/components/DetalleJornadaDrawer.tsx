import { useEffect, useState } from 'react';
import { Drawer, Text, Timeline, Badge, Group, SimpleGrid, Box } from '@mantine/core';
import { IconCheck, IconClock, IconMapPin, IconFlagCheck } from '@tabler/icons-react';
import type { JornadaHoy } from '../services/tracking.service';
import { fichaCompletada, tipoVisitaHoy, contarFichasCompletadas } from '../utils/fichaHoyHelpers';

// Mientras la jornada sigue activa, "Horas trabajadas" se recalcula en vivo
// contra fecha_inicio en vez de mostrar el valor fijo del último snapshot:
// horas_trabajadas_minutos llega del backend en cada fetch (cada 60s, ver
// HoyEnVivoPage.tsx), pero entre un fetch y otro igual queremos que el
// contador avance visualmente. Una jornada "finalizada" ya no avanza — se
// muestra el total fijo que ya vino calculado del backend.
function formatearMinutos(totalMin: number): string {
    const min = Math.max(0, Math.floor(totalMin));
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatearHorasTrabajadas(jornada: JornadaHoy): string {
    if (jornada.estado === 'finalizada') return formatearMinutos(jornada.horas_trabajadas_minutos);
    const ms = Date.now() - new Date(jornada.fecha_inicio).getTime();
    return formatearMinutos(ms / 60000);
}

interface DetalleJornadaDrawerProps {
    jornada: JornadaHoy | null;
    opened: boolean;
    onClose: () => void;
}

// Leaflet dibuja sus propios panes internos (tiles, overlays, markers,
// tooltips, popups) con z-index hasta 700 dentro del propio MapContainer. El
// Drawer de Mantine, en cambio, se monta vía Portal con su z-index por
// defecto (~200) — más bajo que Leaflet — así que sin fijarlo explícitamente
// por encima, el mapa termina visualmente delante del drawer en vez de
// detrás. 1000 deja margen sobre cualquier pane de Leaflet.
const DRAWER_Z_INDEX = 1000;

export function DetalleJornadaDrawer({ jornada, opened, onClose }: DetalleJornadaDrawerProps) {
    if (!jornada) {
        return <Drawer opened={opened} onClose={onClose} position="right" size="sm" title="Detalle" zIndex={DRAWER_Z_INDEX} />;
    }

    const indiceActivo = jornada.fichas_hoy.findIndex((f) => !fichaCompletada(f));
    const { completadas, total } = contarFichasCompletadas(jornada.fichas_hoy);
    const finalizada = jornada.estado === 'finalizada';

    // Fuerza un re-render cada 30s para que "Horas trabajadas" avance en vivo
    // entre un fetch del snapshot y el siguiente (mismo patrón que
    // FlotaPanel.tsx usa para su badge de estado/tiempo relativo). No hace
    // nada útil si la jornada ya está finalizada (el valor es fijo), pero
    // tampoco molesta — se limpia igual al desmontar.
    const [, forceTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => forceTick((t) => t + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    return (
        <Drawer opened={opened} onClose={onClose} position="right" size="sm" title={jornada.nombre_muestreador} zIndex={DRAWER_Z_INDEX}>
            <Group mb="md">
                {finalizada ? (
                    <Badge color="blue" variant="light" leftSection={<IconFlagCheck size={12} />}>
                        Día finalizado
                    </Badge>
                ) : (
                    <Badge color={jornada.ultima_posicion ? 'green' : 'gray'} variant="light" leftSection={<IconMapPin size={12} />}>
                        {jornada.ultima_posicion ? 'En ruta' : 'Sin posición'}
                    </Badge>
                )}
            </Group>

            {finalizada && (
                <Text size="sm" fw={600} mb="md">
                    {completadas}/{total} ficha{total === 1 ? '' : 's'} completada{completadas === 1 ? '' : 's'}
                </Text>
            )}

            <SimpleGrid cols={2} mb="md">
                <Box>
                    <Text size="xs" c="dimmed">Fichas hoy</Text>
                    <Text fw={700}>{jornada.fichas_hoy.length}</Text>
                </Box>
                <Box>
                    <Text size="xs" c="dimmed">{finalizada ? 'Inicio · término' : 'Inicio jornada'}</Text>
                    <Text fw={700}>
                        {new Date(jornada.fecha_inicio).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                        {finalizada && jornada.fecha_fin && (
                            <> · {new Date(jornada.fecha_fin).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</>
                        )}
                    </Text>
                </Box>
                <Box>
                    <Text size="xs" c="dimmed">Horas trabajadas</Text>
                    <Text fw={700}>{formatearHorasTrabajadas(jornada)}</Text>
                </Box>
                <Box>
                    <Text size="xs" c="dimmed">Km recorridos</Text>
                    <Text fw={700}>{jornada.km_recorridos.toFixed(1)} km</Text>
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
                                title={
                                    <Group gap={6} wrap="nowrap">
                                        <Text size="sm" fw={600}>{ficha.frecuencia_correlativo}</Text>
                                        <Badge size="xs" variant="light" color={completada ? 'green' : 'blue'}>
                                            {tipoVisitaHoy(ficha)}
                                        </Badge>
                                    </Group>
                                }
                            >
                                <Text size="xs" c="dimmed" mb={2}>
                                    {completada ? 'Completada' : 'Pendiente'} · {ficha.hora_coordinador || '—'}
                                </Text>
                                {ficha.empresa && <Text size="xs">Empresa: {ficha.empresa}</Text>}
                                {ficha.centro && <Text size="xs">Centro: {ficha.centro}</Text>}
                                {ficha.objetivo && <Text size="xs">Objetivo: {ficha.objetivo}</Text>}
                            </Timeline.Item>
                        );
                    })}
                </Timeline>
            )}
        </Drawer>
    );
}
