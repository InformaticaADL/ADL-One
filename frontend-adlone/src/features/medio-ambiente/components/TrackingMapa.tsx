import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';
import type { JornadaHoy, UltimaPosicion } from '../services/tracking.service';
import { colorPorMuestreador, inicialesDe } from '../utils/colorMuestreador';

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

// Centra el mapa en la jornada seleccionada. Depende de las coordenadas de la
// jornada seleccionada (no del array `jornadas` completo) a propósito: como
// trackingStore.ts crea un array nuevo en CADA evento de posición recibido
// (de cualquier muestreador, no solo el seleccionado), depender del array
// completo haría que el mapa se recentrara y perdiera el zoom del supervisor
// cada vez que llega cualquier ping — no solo cuando cambia la selección o se
// mueve la jornada seleccionada.
function CentradorMapa({ jornadas, selectedJornadaId }: { jornadas: JornadaHoy[]; selectedJornadaId: number | null }) {
    const map = useMap();
    const jornadaSeleccionada = selectedJornadaId
        ? jornadas.find((j) => j.id_jornada === selectedJornadaId)
        : undefined;
    const lat = jornadaSeleccionada?.ultima_posicion?.latitud;
    const lng = jornadaSeleccionada?.ultima_posicion?.longitud;

    useEffect(() => {
        if (lat !== undefined && lng !== undefined) {
            map.setView([lat, lng], 13);
        }
    }, [selectedJornadaId, lat, lng, map]);

    return null;
}

// Ícono a color por muestreador (en vez del pin genérico de Leaflet), con sus
// iniciales adentro — sin esto todos los muestreadores en terreno se ven
// como el mismo pin azul y el supervisor no puede distinguirlos de un
// vistazo. El seleccionado se dibuja levemente más grande y con borde más
// grueso para reforzar cuál está activo en el drawer de detalle.
function crearIconoMuestreador(idMuestreador: number, nombre: string, seleccionado: boolean): L.DivIcon {
    const color = colorPorMuestreador(idMuestreador);
    const tamano = seleccionado ? 36 : 30;
    return L.divIcon({
        className: 'tracking-marker-icon',
        html: `<div style="
            width: ${tamano}px;
            height: ${tamano}px;
            border-radius: 50%;
            background: ${color};
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 12px;
            font-family: sans-serif;
            border: ${seleccionado ? 3 : 2}px solid #fff;
            box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        ">${inicialesDe(nombre)}</div>`,
        iconSize: [tamano, tamano],
        iconAnchor: [tamano / 2, tamano / 2],
        popupAnchor: [0, -tamano / 2],
    });
}

export function TrackingMapa({ jornadas, selectedJornadaId, onSelectJornada }: TrackingMapaProps) {
    // Predicado de tipo (no un simple boolean) para que TypeScript realmente
    // angoste ultima_posicion a no-nulo dentro del .map() de abajo — con un
    // filter(j => j.ultima_posicion !== null) normal, TS no propaga ese
    // angostamiento y las aserciones "!" quedarían sin respaldo del compilador.
    const conPosicion = jornadas.filter(
        (j): j is JornadaHoy & { ultima_posicion: UltimaPosicion } => j.ultima_posicion !== null
    );

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
                    position={[j.ultima_posicion.latitud, j.ultima_posicion.longitud]}
                    icon={crearIconoMuestreador(j.id_muestreador, j.nombre_muestreador, j.id_jornada === selectedJornadaId)}
                    eventHandlers={{ click: () => onSelectJornada(j.id_jornada) }}
                >
                    <Popup>
                        <strong>{j.nombre_muestreador}</strong>
                        <br />
                        Última actualización: {new Date(j.ultima_posicion.timestamp_reporte).toLocaleTimeString('es-CL')}
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}
