import { useEffect, useState } from 'react';
import { Modal, Box, Text, Loader, Center, Timeline, Badge, Group } from '@mantine/core';
import { IconMapPin, IconClockHour4 } from '@tabler/icons-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import dayjs from 'dayjs';
import { trackingService, type HistorialDiaDetalle, type FichaVisitadaDia } from '../services/tracking.service';

interface HistorialDiaReplayModalProps {
    opened: boolean;
    onClose: () => void;
    idMuestreador: number | null;
    nombreMuestreador: string;
    dia: string | null; // 'YYYY-MM-DD'
}

// Ícono numerado (orden de visita), no el pin genérico — sin el número es
// imposible saber a simple vista en qué orden se recorrieron las fichas del
// día, que es justamente el dato que este replay quiere mostrar.
function crearIconoNumerado(numero: number): L.DivIcon {
    return L.divIcon({
        className: 'historial-replay-icon',
        html: `<div style="
            width: 28px; height: 28px; border-radius: 50%;
            background: #228be6; color: #fff;
            display: flex; align-items: center; justify-content: center;
            font-weight: 700; font-size: 13px; font-family: sans-serif;
            border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        ">${numero}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14],
    });
}

// Ajusta el mapa para que se vean todos los puntos del día al abrir el
// replay — sin esto abriría centrado en un punto por defecto que puede no
// tener nada que ver con dónde ocurrió la ruta ese día.
function AjustarBounds({ puntos }: { puntos: [number, number][] }) {
    const map = useMap();
    useEffect(() => {
        if (puntos.length === 0) return;
        if (puntos.length === 1) {
            map.setView(puntos[0], 14);
        } else {
            map.fitBounds(puntos, { padding: [40, 40], maxZoom: 15 });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [puntos.map((p) => p.join(',')).join('|'), map]);
    return null;
}

export function HistorialDiaReplayModal({ opened, onClose, idMuestreador, nombreMuestreador, dia }: HistorialDiaReplayModalProps) {
    const [detalle, setDetalle] = useState<HistorialDiaDetalle | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!opened || !idMuestreador || !dia) return;
        setLoading(true);
        setError(null);
        setDetalle(null);
        trackingService
            .getHistorialDia(idMuestreador, dia)
            .then(setDetalle)
            .catch(() => setError('No se pudo cargar el detalle del día.'))
            .finally(() => setLoading(false));
    }, [opened, idMuestreador, dia]);

    const fichas: FichaVisitadaDia[] = detalle?.fichas_visitadas || [];
    const puntos: [number, number][] = fichas.map((f) => [f.lat, f.lon]);

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={
                <Box>
                    <Text fw={700}>{nombreMuestreador}</Text>
                    <Text size="xs" c="dimmed">{dia ? dayjs(dia).format('DD/MM/YYYY') : ''}</Text>
                </Box>
            }
            size="xl"
        >
            {loading && (
                <Center h={300}>
                    <Loader />
                </Center>
            )}

            {!loading && error && (
                <Center h={300}>
                    <Text c="red">{error}</Text>
                </Center>
            )}

            {!loading && !error && fichas.length === 0 && (
                <Center h={300}>
                    <Text size="sm" c="dimmed">Sin fichas con visita confirmada este día.</Text>
                </Center>
            )}

            {!loading && !error && fichas.length > 0 && (
                <Box style={{ display: 'flex', gap: 16, height: 420 }}>
                    <Box style={{ flex: 2, borderRadius: 8, overflow: 'hidden' }}>
                        <MapContainer center={puntos[0]} zoom={13} style={{ height: '100%', width: '100%' }}>
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            />
                            <AjustarBounds puntos={puntos} />
                            {/* Línea recta entre visitas confirmadas — a propósito NO es
                                el trazo GPS real, que expondría cada calle por la que pasó
                                el muestreador entre una ficha y otra (incluyendo trayectos
                                personales). Solo conecta los puntos de trabajo verificados. */}
                            <Polyline positions={puntos} pathOptions={{ color: '#228be6', weight: 3, dashArray: '6 8' }} />
                            {fichas.map((f, idx) => (
                                <Marker key={`${f.id_agendamam}-${f.tipo}`} position={[f.lat, f.lon]} icon={crearIconoNumerado(idx + 1)}>
                                    <Popup>
                                        <strong>{f.nombre_centro}</strong>
                                        <br />
                                        {f.nombre_empresa}
                                        <br />
                                        {f.tipo === 'instalacion' ? 'Instalación' : 'Retiro'} · {dayjs(f.hora).format('HH:mm')}
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </Box>
                    <Box style={{ flex: 1, overflowY: 'auto' }}>
                        <Timeline active={fichas.length} bulletSize={22} lineWidth={2}>
                            {fichas.map((f, idx) => (
                                <Timeline.Item
                                    key={`${f.id_agendamam}-${f.tipo}`}
                                    title={f.nombre_centro}
                                    bullet={<Text size="xs" fw={700}>{idx + 1}</Text>}
                                >
                                    <Text size="xs" c="dimmed">{f.nombre_empresa}</Text>
                                    <Group gap={6} mt={4}>
                                        <IconClockHour4 size={13} />
                                        <Text size="xs">{dayjs(f.hora).format('HH:mm')}</Text>
                                        <Badge size="xs" variant="light" color={f.tipo === 'instalacion' ? 'blue' : 'orange'} leftSection={<IconMapPin size={10} />}>
                                            {f.tipo === 'instalacion' ? 'Instalación' : 'Retiro'}
                                        </Badge>
                                    </Group>
                                </Timeline.Item>
                            ))}
                        </Timeline>
                    </Box>
                </Box>
            )}
        </Modal>
    );
}
