import { useEffect, useState } from 'react';
import { Modal, Typography, Spin, Timeline, Tag } from 'antd';
import { IconMapPin, IconClockHour4 } from '@tabler/icons-react';
import { MapContainer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { BaseTiles } from './BaseTiles';
import L from 'leaflet';
import dayjs from 'dayjs';
import { trackingService, type HistorialDiaDetalle, type FichaVisitadaDia } from '../services/tracking.service';

const { Text } = Typography;

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
            open={opened}
            onCancel={onClose}
            footer={null}
            width={860}
            title={
                <div>
                    <Text strong style={{ display: 'block' }}>{nombreMuestreador}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{dia ? dayjs(dia).format('DD/MM/YYYY') : ''}</Text>
                </div>
            }
        >
            {loading && (
                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Spin />
                </div>
            )}

            {!loading && error && (
                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Text type="danger">{error}</Text>
                </div>
            )}

            {!loading && !error && fichas.length === 0 && (
                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>Sin fichas con visita confirmada este día.</Text>
                </div>
            )}

            {!loading && !error && fichas.length > 0 && (
                <div style={{ display: 'flex', gap: 16, height: 420 }}>
                    <div style={{ flex: 2, borderRadius: 8, overflow: 'hidden' }}>
                        <MapContainer center={puntos[0]} zoom={13} style={{ height: '100%', width: '100%' }}>
                            <BaseTiles />
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
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        <Timeline
                            items={fichas.map((f, idx) => ({
                                key: `${f.id_agendamam}-${f.tipo}`,
                                dot: <Text strong style={{ fontSize: 12 }}>{idx + 1}</Text>,
                                children: (
                                    <div>
                                        <Text strong style={{ fontSize: 13, display: 'block' }}>{f.nombre_centro}</Text>
                                        <Text type="secondary" style={{ fontSize: 12 }}>{f.nombre_empresa}</Text>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                            <IconClockHour4 size={13} />
                                            <Text style={{ fontSize: 12 }}>{dayjs(f.hora).format('HH:mm')}</Text>
                                            <Tag color={f.tipo === 'instalacion' ? 'blue' : 'orange'} icon={<IconMapPin size={10} style={{ verticalAlign: 'text-bottom' }} />}>
                                                {f.tipo === 'instalacion' ? 'Instalación' : 'Retiro'}
                                            </Tag>
                                        </div>
                                    </div>
                                ),
                            }))}
                        />
                    </div>
                </div>
            )}
        </Modal>
    );
}
