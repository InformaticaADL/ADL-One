import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';
import type { JornadaHoy } from '../services/tracking.service';

// Fix para los íconos por defecto de Leaflet, que no se resuelven bien en el
// bundle de Vite (mismo fix ya usado en AssignmentMapView.tsx).
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
});

const CENTRO_DEFECTO: [number, number] = [-33.4489, -70.6693]; // Santiago

interface TrackingMapaProps {
    jornadas: JornadaHoy[];
    selectedJornadaId: number | null;
    onSelectJornada: (id: number) => void;
}

// Centra el mapa en la jornada seleccionada cuando cambia la selección, sin
// desmontar/recrear el MapContainer (useMap da acceso a la instancia viva).
function CentradorMapa({ jornadas, selectedJornadaId }: { jornadas: JornadaHoy[]; selectedJornadaId: number | null }) {
    const map = useMap();
    useEffect(() => {
        if (!selectedJornadaId) return;
        const jornada = jornadas.find((j) => j.id_jornada === selectedJornadaId);
        if (jornada?.ultima_posicion) {
            map.setView([jornada.ultima_posicion.latitud, jornada.ultima_posicion.longitud], 13);
        }
    }, [selectedJornadaId, jornadas, map]);
    return null;
}

export function TrackingMapa({ jornadas, selectedJornadaId, onSelectJornada }: TrackingMapaProps) {
    const conPosicion = jornadas.filter((j) => j.ultima_posicion !== null);

    return (
        <MapContainer center={CENTRO_DEFECTO} zoom={6} style={{ height: '100%', width: '100%' }}>
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <CentradorMapa jornadas={jornadas} selectedJornadaId={selectedJornadaId} />
            {conPosicion.map((j) => (
                <Marker
                    key={j.id_jornada}
                    position={[j.ultima_posicion!.latitud, j.ultima_posicion!.longitud]}
                    eventHandlers={{ click: () => onSelectJornada(j.id_jornada) }}
                >
                    <Popup>
                        <strong>{j.nombre_muestreador}</strong>
                        <br />
                        Última actualización: {new Date(j.ultima_posicion!.timestamp_reporte).toLocaleTimeString('es-CL')}
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}
