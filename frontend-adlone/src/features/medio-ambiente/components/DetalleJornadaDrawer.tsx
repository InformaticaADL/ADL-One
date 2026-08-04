import { useEffect, useState } from 'react';
import { Drawer, Text, Timeline, Badge, Group, SimpleGrid, Box } from '@mantine/core';
import { IconCheck, IconClock, IconMapPin } from '@tabler/icons-react';
import type { JornadaHoy } from '../services/tracking.service';

// "Horas trabajadas" se recalcula en vivo contra fecha_inicio en vez de
// mostrar el valor fijo del último snapshot: horas_trabajadas_minutos llega
// del backend en cada fetch (cada 60s, ver HoyEnVivoPage.tsx), pero entre un
// fetch y otro igual queremos que el contador avance visualmente.
function formatearHorasTrabajadas(fechaInicio: string): string {
    const ms = Date.now() - new Date(fechaInicio).getTime();
    if (ms < 0) return '0m';
    const totalMin = Math.floor(ms / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface DetalleJornadaDrawerProps {
    jornada: JornadaHoy | null;
    opened: boolean;
    onClose: () => void;
}

// Una ficha Compuesta aparece en el itinerario dos días distintos (instalación
// y retiro, con fecha_muestreo/fecha_retiro distintas) — usando la MISMA fila
// de App_Ma_Agenda_MUESTREOS ambas veces. Si solo mirásemos "cualquiera de los
// dos flags en 'S'", una ficha de retiro se vería "Completada" apenas se abre
// el drawer el día del retiro, porque instalacion_completado ya quedó en 'S'
// desde la visita anterior — antes de que el retiro realmente ocurra. Hay que
// mirar el flag que corresponde a la visita de HOY, no cualquiera de los dos.
function fichaCompletada(ficha: JornadaHoy['fichas_hoy'][number]): boolean {
    const hoy = new Date().toISOString().slice(0, 10);
    const esRetiroHoy = ficha.fecha_retiro?.slice(0, 10) === hoy;
    return esRetiroHoy ? ficha.retiro_completado === 'S' : ficha.instalacion_completado === 'S';
}

// Una ficha Puntual de proceso único tiene fecha_muestreo === fecha_retiro
// (instalación y retiro el mismo día, mismo muestreador): sin esta
// distinción, el itinerario mostraría "Instalación" o "Retiro" de forma
// arbitraria para una visita que en realidad es una sola.
function tipoVisitaHoy(ficha: JornadaHoy['fichas_hoy'][number]): string {
    const hoy = new Date().toISOString().slice(0, 10);
    const esInstalacionHoy = ficha.fecha_muestreo?.slice(0, 10) === hoy;
    const esRetiroHoy = ficha.fecha_retiro?.slice(0, 10) === hoy;
    if (esInstalacionHoy && esRetiroHoy) return 'Instalación y Retiro';
    return esRetiroHoy ? 'Retiro' : 'Instalación';
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

    // Fuerza un re-render cada 30s para que "Horas trabajadas" avance en vivo
    // entre un fetch del snapshot y el siguiente (mismo patrón que
    // FlotaPanel.tsx usa para su badge de estado/tiempo relativo).
    const [, forceTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => forceTick((t) => t + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    return (
        <Drawer opened={opened} onClose={onClose} position="right" size="sm" title={jornada.nombre_muestreador} zIndex={DRAWER_Z_INDEX}>
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
                <Box>
                    <Text size="xs" c="dimmed">Horas trabajadas</Text>
                    <Text fw={700}>{formatearHorasTrabajadas(jornada.fecha_inicio)}</Text>
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
