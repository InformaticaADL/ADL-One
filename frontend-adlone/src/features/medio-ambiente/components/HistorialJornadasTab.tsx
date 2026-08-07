import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Group, Table, Text, TextInput, Loader, Center, Badge, ScrollArea } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconSearch } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { trackingService, type HistorialDia } from '../services/tracking.service';

function formatearMinutos(totalMin: number): string {
    const min = Math.max(0, Math.floor(totalMin));
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Por defecto, últimos 7 días — vista rápida de la semana. El supervisor
// ajusta el rango manualmente si necesita algo más amplio (ej. rendición
// mensual).
const HOY = dayjs();
const HACE_7_DIAS = HOY.subtract(6, 'day');

export function HistorialJornadasTab() {
    const [fechaDesde, setFechaDesde] = useState<Date | null>(HACE_7_DIAS.toDate());
    const [fechaHasta, setFechaHasta] = useState<Date | null>(HOY.toDate());
    const [busqueda, setBusqueda] = useState('');
    const [dias, setDias] = useState<HistorialDia[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Guard de carrera: si el usuario cambia de fecha rápido (dos requests en
    // vuelo), sin esto podía ganar la que responde último, no la que se pidió
    // último — dejando en pantalla el resultado de un rango que ya no es el
    // seleccionado.
    const solicitudActual = useRef(0);
    useEffect(() => {
        if (!fechaDesde || !fechaHasta) return;
        const idSolicitud = ++solicitudActual.current;
        setLoading(true);
        setError(null);
        trackingService
            .getHistorial(dayjs(fechaDesde).format('YYYY-MM-DD'), dayjs(fechaHasta).format('YYYY-MM-DD'))
            .then((resultado) => {
                if (idSolicitud !== solicitudActual.current) return;
                setDias(resultado);
            })
            .catch(() => {
                if (idSolicitud !== solicitudActual.current) return;
                setError('No se pudo cargar el historial de jornadas.');
            })
            .finally(() => {
                if (idSolicitud !== solicitudActual.current) return;
                setLoading(false);
            });
    }, [fechaDesde, fechaHasta]);

    const diasFiltrados = useMemo(
        () => dias.filter((d) => d.nombre_muestreador.toLowerCase().includes(busqueda.toLowerCase())),
        [dias, busqueda]
    );

    return (
        <Box style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16 }}>
            <Group mb="md" gap="sm">
                <DatePickerInput
                    label="Desde"
                    value={fechaDesde}
                    onChange={(val: any) => setFechaDesde(val)}
                    locale="es"
                    size="xs"
                    maxDate={fechaHasta ?? undefined}
                    leftSection={<IconCalendar size={14} />}
                    valueFormat="DD/MM/YYYY"
                    w={150}
                />
                <DatePickerInput
                    label="Hasta"
                    value={fechaHasta}
                    onChange={(val: any) => setFechaHasta(val)}
                    locale="es"
                    size="xs"
                    minDate={fechaDesde ?? undefined}
                    maxDate={new Date()}
                    leftSection={<IconCalendar size={14} />}
                    valueFormat="DD/MM/YYYY"
                    w={150}
                />
                <TextInput
                    label="Muestreador"
                    placeholder="Buscar por nombre..."
                    size="xs"
                    leftSection={<IconSearch size={14} />}
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.currentTarget.value)}
                    w={220}
                />
            </Group>

            {loading && (
                <Center style={{ flex: 1 }}>
                    <Loader />
                </Center>
            )}

            {!loading && error && (
                <Center style={{ flex: 1 }}>
                    <Text c="red">{error}</Text>
                </Center>
            )}

            {!loading && !error && diasFiltrados.length === 0 && (
                <Center style={{ flex: 1 }}>
                    <Text size="sm" c="dimmed">Sin jornadas registradas en este rango.</Text>
                </Center>
            )}

            {!loading && !error && diasFiltrados.length > 0 && (
                <ScrollArea style={{ flex: 1 }}>
                    <Table stickyHeader striped highlightOnHover verticalSpacing="xs">
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Fecha</Table.Th>
                                <Table.Th>Muestreador</Table.Th>
                                <Table.Th>Tiempo de ruta</Table.Th>
                                <Table.Th>Km recorridos</Table.Th>
                                <Table.Th>Fichas</Table.Th>
                                <Table.Th>Jornadas</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {diasFiltrados.map((d) => (
                                <Table.Tr key={`${d.id_muestreador}|${d.dia}`}>
                                    <Table.Td>{dayjs(d.dia).format('DD/MM/YYYY')}</Table.Td>
                                    <Table.Td>{d.nombre_muestreador}</Table.Td>
                                    <Table.Td>{formatearMinutos(d.horas_trabajadas_minutos)}</Table.Td>
                                    <Table.Td>{d.km_recorridos.toFixed(1)} km</Table.Td>
                                    <Table.Td>
                                        <Badge
                                            size="sm"
                                            variant="light"
                                            color={d.fichas_total > 0 && d.fichas_completadas === d.fichas_total ? 'green' : 'blue'}
                                        >
                                            {d.fichas_completadas}/{d.fichas_total}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>{d.num_jornadas > 1 ? `${d.num_jornadas} tramos` : '1 tramo'}</Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </ScrollArea>
            )}
        </Box>
    );
}
