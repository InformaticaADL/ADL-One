import { useEffect, useState } from 'react';
import { Drawer, Text, Timeline, Badge, Group, SimpleGrid, Box } from '@mantine/core';
import { IconCheck, IconClock, IconMapPin, IconFlagCheck, IconPlayerPause, IconBattery2 } from '@tabler/icons-react';
import type { JornadaHoy } from '../services/tracking.service';
import { fichaCompletada, tipoVisitaHoy, contarFichasCompletadas } from '../utils/fichaHoyHelpers';

// Mientras la jornada sigue activa ('en_ruta'), "Tiempo de ruta" se
// recalcula en vivo contra fecha_inicio en vez de mostrar el valor fijo del
// último snapshot: horas_trabajadas_minutos llega del backend en cada fetch
// (cada 60s, ver HoyEnVivoPage.tsx), pero entre un fetch y otro igual
// queremos que el contador avance visualmente. 'pausada' y 'finalizada' ya
// no avanzan — se muestra el total fijo que vino calculado del backend (para
// 'pausada' es la suma de los tramos ya cerrados, sin contar la pausa).
function formatearMinutos(totalMin: number): string {
    const min = Math.max(0, Math.floor(totalMin));
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatearHorasTrabajadas(jornada: JornadaHoy): string {
    if (jornada.estado !== 'en_ruta') return formatearMinutos(jornada.horas_trabajadas_minutos);
    // horas_trabajadas_cerradas_minutos (tramos YA cerrados) + minutos desde
    // que empezó el tramo ACTIVO — antes se calculaba desde jornada.
    // fecha_inicio (el inicio del PRIMER tramo del día), así que una pausa de
    // almuerzo se sumaba como si fuera trabajo hasta el próximo fetch del
    // snapshot (cada 60s), donde el número "saltaba" hacia abajo de golpe.
    const inicioTramoActual = jornada.fecha_inicio_tramo_actual ?? jornada.fecha_inicio;
    const msTramoActual = Date.now() - new Date(inicioTramoActual).getTime();
    return formatearMinutos(jornada.horas_trabajadas_cerradas_minutos + msTramoActual / 60000);
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
    const enRuta = jornada.estado === 'en_ruta';
    const pausada = jornada.estado === 'pausada';
    const finalizada = jornada.estado === 'finalizada';
    const tieneBateria = jornada.bateria_inicio != null && jornada.bateria_fin != null;

    // Fuerza un re-render cada 30s para que "Tiempo de ruta" avance en vivo
    // entre un fetch del snapshot y el siguiente (mismo patrón que
    // FlotaPanel.tsx usa para su badge de estado/tiempo relativo). No hace
    // nada útil si la jornada ya no está 'en_ruta' (el valor es fijo), pero
    // tampoco molesta — se limpia igual al desmontar.
    const [, forceTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => forceTick((t) => t + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    return (
        <Drawer
            opened={opened}
            onClose={onClose}
            position="right"
            size="sm"
            title={jornada.nombre_muestreador}
            zIndex={DRAWER_Z_INDEX}
            // El título del Drawer trunca con "..." por defecto (pensado para
            // títulos cortos) — un nombre largo terminaba cortado. Se permite
            // que ocupe más de una línea en vez de recortarlo.
            styles={{ title: { whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset', fontWeight: 700 } }}
        >
            <Group mb="md">
                {pausada ? (
                    <Badge color="orange" variant="light" leftSection={<IconPlayerPause size={12} />}>
                        En pausa
                    </Badge>
                ) : finalizada ? (
                    <Badge color="blue" variant="light" leftSection={<IconFlagCheck size={12} />}>
                        Día finalizado
                    </Badge>
                ) : (
                    <Badge color={jornada.ultima_posicion ? 'green' : 'gray'} variant="light" leftSection={<IconMapPin size={12} />}>
                        {jornada.ultima_posicion ? 'En ruta' : 'Sin posición'}
                    </Badge>
                )}
            </Group>

            {!enRuta && (
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
                    <Text size="xs" c="dimmed">Inicio jornada</Text>
                    <Text fw={700}>
                        {new Date(jornada.fecha_inicio).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {!enRuta && jornada.fecha_fin && (
                        <>
                            <Text size="xs" c="dimmed" mt={4}>{pausada ? 'Pausado a las' : 'Término jornada'}</Text>
                            <Text fw={700}>
                                {new Date(jornada.fecha_fin).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </>
                    )}
                </Box>
                <Box>
                    <Text size="xs" c="dimmed">Tiempo de ruta</Text>
                    <Text fw={700}>{formatearHorasTrabajadas(jornada)}</Text>
                </Box>
                <Box>
                    <Text size="xs" c="dimmed">Km recorridos</Text>
                    <Text fw={700}>{jornada.km_recorridos.toFixed(1)} km</Text>
                </Box>
                {tieneBateria && (
                    <Box>
                        <Text size="xs" c="dimmed">
                            <IconBattery2 size={12} style={{ verticalAlign: 'text-bottom', marginRight: 2 }} />
                            Batería
                        </Text>
                        <Text fw={700}>{jornada.bateria_inicio}% → {jornada.bateria_fin}%</Text>
                    </Box>
                )}
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
                                    {ficha.tiempo_trabajo_minutos != null && ` · ${formatearMinutos(ficha.tiempo_trabajo_minutos)} en terreno`}
                                </Text>
                                {/* Promedio histórico por objetivo de muestreo (ver
                                    getSnapshotHoy en tracking.service.js) — null hasta que
                                    se acumulen al menos 3 fichas completadas con ese mismo
                                    objetivo, para no mostrar un "esperado" basado en 1-2
                                    muestras. Se muestra aunque la ficha siga pendiente, como
                                    referencia de cuánto suele tomar. */}
                                {ficha.tiempo_estimado_minutos != null && (
                                    <Text size="xs" c="dimmed" mb={2}>
                                        Esperado: ≈{formatearMinutos(ficha.tiempo_estimado_minutos)} (promedio histórico)
                                        {ficha.tiempo_trabajo_minutos != null && ficha.tiempo_trabajo_minutos > ficha.tiempo_estimado_minutos * 1.3 && (
                                            <Text component="span" c="orange" fw={600}> · sobre lo esperado</Text>
                                        )}
                                    </Text>
                                )}
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
