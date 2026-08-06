import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
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
    selectedMuestreadorId: number | null;
    onSelectMuestreador: (id: number) => void;
}

// Centra el mapa en la jornada seleccionada. Depende de las coordenadas de la
// jornada seleccionada (no del array `jornadas` completo) a propósito: como
// trackingStore.ts crea un array nuevo en CADA evento de posición recibido
// (de cualquier muestreador, no solo el seleccionado), depender del array
// completo haría que el mapa se recentrara y perdiera el zoom del supervisor
// cada vez que llega cualquier ping — no solo cuando cambia la selección o se
// mueve la jornada seleccionada.
function CentradorMapa({ jornadas, selectedMuestreadorId }: { jornadas: JornadaHoy[]; selectedMuestreadorId: number | null }) {
    const map = useMap();
    const jornadaSeleccionada = selectedMuestreadorId
        ? jornadas.find((j) => j.id_muestreador === selectedMuestreadorId)
        : undefined;
    const lat = jornadaSeleccionada?.ultima_posicion?.latitud;
    const lng = jornadaSeleccionada?.ultima_posicion?.longitud;

    // Centrado inicial: sin esto el mapa siempre abría en CENTRO_DEFECTO
    // (Santiago) con zoom 6, sin importar dónde esté realmente el equipo —
    // si todos los muestreadores están en otra región, el supervisor tenía
    // que buscar manualmente. Se ejecuta UNA sola vez, la primera vez que
    // hay al menos una posición conocida (con el mismo cuidado de no
    // depender del array `jornadas` completo en cada ping — solo importa la
    // CANTIDAD de posiciones conocidas la primera vez, no cada actualización
    // posterior). Después de ese primer ajuste, el supervisor puede navegar
    // el mapa libremente sin que se recentre solo.
    const yaCentroInicial = useRef(false);
    useEffect(() => {
        if (yaCentroInicial.current) return;
        const posiciones = jornadas
            .filter((j): j is JornadaHoy & { ultima_posicion: UltimaPosicion } => j.ultima_posicion !== null)
            .map((j) => [j.ultima_posicion.latitud, j.ultima_posicion.longitud] as [number, number]);
        if (posiciones.length === 0) return;

        yaCentroInicial.current = true;
        if (posiciones.length === 1) {
            map.setView(posiciones[0], 13);
        } else {
            map.fitBounds(posiciones, { padding: [50, 50], maxZoom: 14 });
        }
    }, [jornadas, map]);

    useEffect(() => {
        if (lat !== undefined && lng !== undefined) {
            map.setView([lat, lng], 13);
        }
    }, [selectedMuestreadorId, lat, lng, map]);

    return null;
}

// Ícono a color por muestreador (en vez del pin genérico de Leaflet), con sus
// iniciales adentro — sin esto todos los muestreadores en terreno se ven
// como el mismo pin azul y el supervisor no puede distinguirlos de un
// vistazo. El seleccionado se dibuja levemente más grande y con borde más
// grueso para reforzar cuál está activo en el drawer de detalle. Un
// muestreador que no está 'en_ruta' (pausado o con el día finalizado) sigue
// en el mapa (última posición conocida) pero atenuado, con una insignia
// distinta según el motivo — para no confundirlo con alguien todavía en
// movimiento, ni una pausa de almuerzo con el fin del día.
function crearIconoMuestreador(idMuestreador: number, nombre: string, seleccionado: boolean, estado: JornadaHoy['estado']): L.DivIcon {
    const color = colorPorMuestreador(idMuestreador);
    const tamano = seleccionado ? 36 : 30;
    const atenuado = estado !== 'en_ruta';
    const insignia = estado === 'pausada'
        ? { color: '#f08c00', simbolo: '❚❚' }
        : estado === 'finalizada'
            ? { color: '#228be6', simbolo: '✓' }
            : null;

    return L.divIcon({
        className: 'tracking-marker-icon',
        html: `<div style="position: relative; opacity: ${atenuado ? 0.55 : 1};">
            <div style="
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
            ">${inicialesDe(nombre)}</div>
            ${insignia ? `<div style="
                position: absolute; bottom: -2px; right: -2px;
                width: 16px; height: 16px; border-radius: 50%;
                background: ${insignia.color}; border: 2px solid #fff;
                display: flex; align-items: center; justify-content: center;
                font-size: 8px; color: #fff; font-weight: 700;
            ">${insignia.simbolo}</div>` : ''}
        </div>`,
        iconSize: [tamano, tamano],
        iconAnchor: [tamano / 2, tamano / 2],
        popupAnchor: [0, -tamano / 2],
    });
}

export function TrackingMapa({ jornadas, selectedMuestreadorId, onSelectMuestreador }: TrackingMapaProps) {
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
            <CentradorMapa jornadas={jornadas} selectedMuestreadorId={selectedMuestreadorId} />
            {conPosicion.map((j) => (
                <Marker
                    key={j.id_muestreador}
                    position={[j.ultima_posicion.latitud, j.ultima_posicion.longitud]}
                    icon={crearIconoMuestreador(j.id_muestreador, j.nombre_muestreador, j.id_muestreador === selectedMuestreadorId, j.estado)}
                    eventHandlers={{ click: () => onSelectMuestreador(j.id_muestreador) }}
                >
                    <Popup>
                        <strong>{j.nombre_muestreador}</strong>
                        <br />
                        {j.estado === 'pausada' ? 'En pausa' : j.estado === 'finalizada' ? 'Día finalizado' : 'Última actualización'}: {new Date(j.ultima_posicion.timestamp_reporte).toLocaleTimeString('es-CL')}
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}
