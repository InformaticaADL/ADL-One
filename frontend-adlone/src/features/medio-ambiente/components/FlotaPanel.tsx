import { Box, ScrollArea, Text, TextInput, Badge, Stack, UnstyledButton, Group, Avatar } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import type { JornadaHoy } from '../services/tracking.service';
import { colorPorMuestreador, inicialesDe } from '../utils/colorMuestreador';

interface FlotaPanelProps {
    jornadas: JornadaHoy[];
    selectedJornadaId: number | null;
    onSelectJornada: (id: number) => void;
}

const UMBRAL_SIN_SENAL_MS = 10 * 60 * 1000; // 10 minutos, per diseño "Hoy en Vivo"

function estadoDeJornada(jornada: JornadaHoy): { label: string; color: string } {
    if (!jornada.ultima_posicion) return { label: 'Sin posición', color: 'gray' };
    const msDesdeUltimoPing = Date.now() - new Date(jornada.ultima_posicion.timestamp_reporte).getTime();
    if (msDesdeUltimoPing > UMBRAL_SIN_SENAL_MS) return { label: 'Sin señal', color: 'gray' };
    return { label: 'En ruta', color: 'green' };
}

function tiempoRelativo(fechaIso: string): string {
    const segundos = Math.floor((Date.now() - new Date(fechaIso).getTime()) / 1000);
    if (segundos < 60) return `hace ${segundos}s`;
    const minutos = Math.floor(segundos / 60);
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    return `hace ${horas} h`;
}

export function FlotaPanel({ jornadas, selectedJornadaId, onSelectJornada }: FlotaPanelProps) {
    const [busqueda, setBusqueda] = useState('');

    // Fuerza un re-render cada 15s para que estadoDeJornada/tiempoRelativo se
    // reevalúen aunque no llegue ningún evento nuevo por socket — sin esto, un
    // muestreador sin pings nuevos se queda "En ruta" para siempre en vez de
    // pasar a "Sin señal" al cruzar el umbral de 10 minutos.
    const [, forceTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => forceTick((t) => t + 1), 15_000);
        return () => clearInterval(id);
    }, []);

    const jornadasFiltradas = useMemo(
        () => jornadas.filter((j) => j.nombre_muestreador.toLowerCase().includes(busqueda.toLowerCase())),
        [jornadas, busqueda]
    );

    return (
        <Box style={{ width: 280, borderRight: '1px solid var(--mantine-color-gray-3)', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box p="sm">
                <Group justify="space-between" mb="xs">
                    <Text fw={700} size="sm">Hoy en vivo</Text>
                    <Badge size="sm" variant="light">{jornadas.length} en terreno</Badge>
                </Group>
                <TextInput
                    placeholder="Buscar muestreador..."
                    size="xs"
                    leftSection={<IconSearch size={14} />}
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.currentTarget.value)}
                />
            </Box>
            <ScrollArea style={{ flex: 1 }} p="sm" pt={0}>
                <Stack gap="xs">
                    {jornadasFiltradas.length === 0 && (
                        <Text size="sm" c="dimmed" ta="center" mt="md">
                            No hay muestreadores en terreno en este momento.
                        </Text>
                    )}
                    {jornadasFiltradas.map((j) => {
                        const estado = estadoDeJornada(j);
                        const seleccionada = j.id_jornada === selectedJornadaId;
                        return (
                            <UnstyledButton
                                key={j.id_jornada}
                                onClick={() => onSelectJornada(j.id_jornada)}
                                p="xs"
                                style={{
                                    borderRadius: 8,
                                    border: `1px solid ${seleccionada ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-gray-3)'}`,
                                    backgroundColor: seleccionada ? 'var(--mantine-color-blue-0)' : 'transparent',
                                }}
                            >
                                <Group justify="space-between" wrap="nowrap">
                                    <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                                        <Avatar size={22} radius="xl" color="white" style={{ backgroundColor: colorPorMuestreador(j.id_muestreador), flexShrink: 0 }}>
                                            <Text size={10} fw={700} c="white">{inicialesDe(j.nombre_muestreador)}</Text>
                                        </Avatar>
                                        <Text size="sm" fw={600} truncate>{j.nombre_muestreador}</Text>
                                    </Group>
                                    <Badge size="xs" color={estado.color} variant="dot">{estado.label}</Badge>
                                </Group>
                                <Text size="xs" c="dimmed">
                                    {j.fichas_hoy.length} ficha(s) hoy
                                    {j.ultima_posicion && ` · act. ${tiempoRelativo(j.ultima_posicion.timestamp_reporte)}`}
                                </Text>
                            </UnstyledButton>
                        );
                    })}
                </Stack>
            </ScrollArea>
        </Box>
    );
}
