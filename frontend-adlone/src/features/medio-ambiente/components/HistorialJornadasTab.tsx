import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Group, Table, Text, TextInput, Loader, Center, Badge, ScrollArea, Button, Paper, SimpleGrid } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar, IconSearch, IconFileSpreadsheet } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { trackingService, type HistorialDia } from '../services/tracking.service';
import { HistorialDiaReplayModal } from './HistorialDiaReplayModal';

function formatearMinutos(totalMin: number): string {
    const min = Math.max(0, Math.floor(totalMin));
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Escapa para CSV: envuelve en comillas y duplica comillas internas solo si
// el valor las necesita (coma, comilla o salto de línea) — así los nombres
// normales quedan legibles sin comillas de más.
function celdaCSV(valor: string | number): string {
    const s = String(valor);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function exportarHistorialCSV(dias: HistorialDia[]) {
    const encabezado = ['Fecha', 'Muestreador', 'Tiempo de ruta (min)', 'Km recorridos', 'Fichas completadas', 'Fichas totales', 'Jornadas'];
    const filas = dias.map((d) => [
        d.dia,
        d.nombre_muestreador,
        Math.round(d.horas_trabajadas_minutos),
        d.km_recorridos.toFixed(2),
        d.fichas_completadas,
        d.fichas_total,
        d.num_jornadas,
    ]);
    // ﻿ (BOM): sin esto, Excel en Windows abre el CSV con tildes/ñ
    // rotas (asume Windows-1252 en vez de UTF-8) — el BOM le indica que lea
    // el archivo como UTF-8.
    const contenido = '﻿' + [encabezado, ...filas].map((fila) => fila.map(celdaCSV).join(',')).join('\n');
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `historial_jornadas_${dayjs().format('YYYY-MM-DD')}.csv`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
}

interface ResumenMuestreador {
    id_muestreador: number;
    nombre_muestreador: string;
    dias: number;
    minutos: number;
    km: number;
    fichasCompletadas: number;
    fichasTotal: number;
}

function calcularResumenPorMuestreador(dias: HistorialDia[]): ResumenMuestreador[] {
    const porMuestreador = new Map<number, ResumenMuestreador>();
    for (const d of dias) {
        if (!porMuestreador.has(d.id_muestreador)) {
            porMuestreador.set(d.id_muestreador, {
                id_muestreador: d.id_muestreador,
                nombre_muestreador: d.nombre_muestreador,
                dias: 0,
                minutos: 0,
                km: 0,
                fichasCompletadas: 0,
                fichasTotal: 0,
            });
        }
        const acc = porMuestreador.get(d.id_muestreador)!;
        acc.dias += 1;
        acc.minutos += d.horas_trabajadas_minutos;
        acc.km += d.km_recorridos;
        acc.fichasCompletadas += d.fichas_completadas;
        acc.fichasTotal += d.fichas_total;
    }
    return [...porMuestreador.values()].sort((a, b) => b.minutos - a.minutos);
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
    const [diaSeleccionado, setDiaSeleccionado] = useState<HistorialDia | null>(null);

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

    const resumenPorMuestreador = useMemo(() => calcularResumenPorMuestreador(diasFiltrados), [diasFiltrados]);

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
                <Button
                    variant="light"
                    size="xs"
                    mt={18}
                    leftSection={<IconFileSpreadsheet size={14} />}
                    disabled={diasFiltrados.length === 0}
                    onClick={() => exportarHistorialCSV(diasFiltrados)}
                >
                    Exportar CSV
                </Button>
            </Group>

            {!loading && !error && resumenPorMuestreador.length > 0 && (
                <Paper withBorder p="sm" mb="md">
                    <Text size="xs" fw={700} c="dimmed" mb={8} tt="uppercase">Resumen del período por muestreador</Text>
                    <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xs">
                        {resumenPorMuestreador.map((r) => (
                            <Group key={r.id_muestreador} justify="space-between" wrap="nowrap" gap="xs">
                                <Text size="sm" truncate>{r.nombre_muestreador}</Text>
                                <Group gap={6} wrap="nowrap">
                                    <Badge size="sm" variant="light" color="blue">{formatearMinutos(r.minutos)}</Badge>
                                    <Badge size="sm" variant="light" color="grape">{r.km.toFixed(1)} km</Badge>
                                    <Badge size="sm" variant="light" color={r.fichasTotal > 0 && r.fichasCompletadas === r.fichasTotal ? 'green' : 'gray'}>
                                        {r.fichasCompletadas}/{r.fichasTotal}
                                    </Badge>
                                </Group>
                            </Group>
                        ))}
                    </SimpleGrid>
                </Paper>
            )}

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
                            {diasFiltrados.map((d) => {
                                // Jornada con fichas asignadas ese día pero NINGUNA
                                // completada — posible ruta que no se concretó
                                // (problema técnico, cancelación de último minuto no
                                // reflejada, etc.), vale la pena que salte a la vista
                                // en vez de perderse entre el resto de filas normales.
                                const sinNingunaCompletada = d.fichas_total > 0 && d.fichas_completadas === 0;
                                return (
                                <Table.Tr
                                    key={`${d.id_muestreador}|${d.dia}`}
                                    onClick={() => setDiaSeleccionado(d)}
                                    style={{ cursor: 'pointer', backgroundColor: sinNingunaCompletada ? 'var(--mantine-color-red-0)' : undefined }}
                                >
                                    <Table.Td>{dayjs(d.dia).format('DD/MM/YYYY')}</Table.Td>
                                    <Table.Td>{d.nombre_muestreador}</Table.Td>
                                    <Table.Td>{formatearMinutos(d.horas_trabajadas_minutos)}</Table.Td>
                                    <Table.Td>{d.km_recorridos.toFixed(1)} km</Table.Td>
                                    <Table.Td>
                                        <Badge
                                            size="sm"
                                            variant="light"
                                            color={sinNingunaCompletada ? 'red' : (d.fichas_total > 0 && d.fichas_completadas === d.fichas_total ? 'green' : 'blue')}
                                        >
                                            {d.fichas_completadas}/{d.fichas_total}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>{d.num_jornadas > 1 ? `${d.num_jornadas} tramos` : '1 tramo'}</Table.Td>
                                </Table.Tr>
                                );
                            })}
                        </Table.Tbody>
                    </Table>
                </ScrollArea>
            )}

            <HistorialDiaReplayModal
                opened={diaSeleccionado !== null}
                onClose={() => setDiaSeleccionado(null)}
                idMuestreador={diaSeleccionado?.id_muestreador ?? null}
                nombreMuestreador={diaSeleccionado?.nombre_muestreador ?? ''}
                dia={diaSeleccionado?.dia ?? null}
            />
        </Box>
    );
}
