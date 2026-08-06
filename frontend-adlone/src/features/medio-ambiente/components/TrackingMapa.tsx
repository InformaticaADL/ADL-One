import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
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

// El backend solo reporta un ping cada ~30s (INTERVALO_REPORTE_MS en
// app-mam/utils/trackingHelper.js, para no gastar batería/datos del
// muestreador), pero el ícono no tiene por qué quedarse quieto ese tiempo:
// mientras haya dos pings reales consecutivos, se extrapola la posición
// hacia adelante usando la velocidad de ese último tramo (estilo "Uber"),
// como si el muestreador siguiera caminando en la misma dirección. Si pasa
// demasiado tiempo sin un ping real que lo confirme, se deja de extrapolar
// (no tiene sentido seguir "caminando" sobre una suposición cada vez más
// vieja) y el ícono queda quieto en la última posición predicha. Se fija en
// ~1.3x el intervalo real: suficiente margen para un ping levemente atrasado
// sin dejar que la extrapolación se estire mucho más allá de lo que el
// backend puede confirmar.
const MAX_EXTRAPOLACION_MS = 40_000;

// Cuando llega un ping real, la posición mostrada puede estar en cualquier
// punto extrapolado (no necesariamente el último real) — en vez de saltar de
// golpe al dato real, se funde suavemente hacia él en esta duración antes de
// retomar la extrapolación con la nueva velocidad.
const DURACION_CORRECCION_MS = 1500;

// No hace falta re-renderizar en cada frame de 60fps para que el ojo lo vea
// fluido a la velocidad de una persona caminando — se limita la frecuencia de
// setState para no generar renders de más en un dashboard con varios
// muestreadores a la vez.
const INTERVALO_MIN_RENDER_MS = 150;

interface PuntoConTiempo {
    lat: number;
    lon: number;
    t: number;
}

// Anima la posición mostrada de un muestreador de forma continua entre
// pings reales, extrapolando su trayectoria (velocidad del último tramo
// confirmado) en vez de quedarse quieto esperando el próximo ping. El
// componente que llama a este hook está keyed por id_muestreador (ver
// TrackingMapa más abajo), así que cada instancia siempre corresponde al
// mismo muestreador durante toda su vida.
function usePosicionUber(target: [number, number], timestampReporte: string, enMovimiento: boolean): [number, number] {
    const tInicial = new Date(timestampReporte).getTime();
    const [pos, setPos] = useState<[number, number]>(target);
    const posRef = useRef<[number, number]>(target);
    const prevPuntoRef = useRef<PuntoConTiempo | null>(null);
    const currPuntoRef = useRef<PuntoConTiempo>({ lat: target[0], lon: target[1], t: Number.isFinite(tInicial) ? tInicial : Date.now() });
    const correccionRef = useRef<{ desde: [number, number]; inicio: number } | null>(null);
    const ultimoRenderRef = useRef(0);
    const frameRef = useRef<number | undefined>(undefined);

    // Llegó un ping real distinto del actual: guarda desde dónde había que
    // corregir (la posición mostrada en este instante, sea real o
    // extrapolada) para que el loop de animación la funda suavemente hacia
    // el punto real nuevo, y desplaza prev/curr para recalcular la velocidad
    // del tramo siguiente.
    useEffect(() => {
        const t = new Date(timestampReporte).getTime();
        if (!Number.isFinite(t) || t === currPuntoRef.current.t) return;

        prevPuntoRef.current = currPuntoRef.current;
        currPuntoRef.current = { lat: target[0], lon: target[1], t };
        correccionRef.current = { desde: posRef.current, inicio: performance.now() };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target[0], target[1], timestampReporte]);

    useEffect(() => {
        function tick() {
            const curr = currPuntoRef.current;
            const correccion = correccionRef.current;
            let siguiente: [number, number];

            if (correccion) {
                const t = Math.min((performance.now() - correccion.inicio) / DURACION_CORRECCION_MS, 1);
                const suavizado = 1 - Math.pow(1 - t, 3);
                siguiente = [
                    correccion.desde[0] + (curr.lat - correccion.desde[0]) * suavizado,
                    correccion.desde[1] + (curr.lon - correccion.desde[1]) * suavizado,
                ];
                if (t >= 1) correccionRef.current = null;
            } else if (enMovimiento && prevPuntoRef.current) {
                const prev = prevPuntoRef.current;
                const dtDesdePing = Date.now() - curr.t;
                const dtTramo = curr.t - prev.t;
                if (dtTramo > 0 && dtDesdePing < MAX_EXTRAPOLACION_MS) {
                    const velLat = (curr.lat - prev.lat) / dtTramo;
                    const velLon = (curr.lon - prev.lon) / dtTramo;
                    siguiente = [curr.lat + velLat * dtDesdePing, curr.lon + velLon * dtDesdePing];
                } else {
                    siguiente = [curr.lat, curr.lon];
                }
            } else {
                siguiente = [curr.lat, curr.lon];
            }

            posRef.current = siguiente;
            const ahora = performance.now();
            if (ahora - ultimoRenderRef.current >= INTERVALO_MIN_RENDER_MS) {
                ultimoRenderRef.current = ahora;
                setPos(siguiente);
            }
            frameRef.current = requestAnimationFrame(tick);
        }
        frameRef.current = requestAnimationFrame(tick);

        return () => {
            if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current);
        };
    }, [enMovimiento]);

    return pos;
}

interface MarcadorMuestreadorProps {
    jornada: JornadaHoy & { ultima_posicion: UltimaPosicion };
    seleccionado: boolean;
    onSelectMuestreador: (id: number) => void;
}

function MarcadorMuestreador({ jornada, seleccionado, onSelectMuestreador }: MarcadorMuestreadorProps) {
    const posicionAnimada = usePosicionUber(
        [jornada.ultima_posicion.latitud, jornada.ultima_posicion.longitud],
        jornada.ultima_posicion.timestamp_reporte,
        jornada.estado === 'en_ruta'
    );

    return (
        <Marker
            position={posicionAnimada}
            icon={crearIconoMuestreador(jornada.id_muestreador, jornada.nombre_muestreador, seleccionado, jornada.estado)}
            eventHandlers={{ click: () => onSelectMuestreador(jornada.id_muestreador) }}
        >
            <Popup>
                <strong>{jornada.nombre_muestreador}</strong>
                <br />
                {jornada.estado === 'pausada' ? 'En pausa' : jornada.estado === 'finalizada' ? 'Día finalizado' : 'Última actualización'}: {new Date(jornada.ultima_posicion.timestamp_reporte).toLocaleTimeString('es-CL')}
            </Popup>
        </Marker>
    );
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
                <MarcadorMuestreador
                    key={j.id_muestreador}
                    jornada={j}
                    seleccionado={j.id_muestreador === selectedMuestreadorId}
                    onSelectMuestreador={onSelectMuestreador}
                />
            ))}
        </MapContainer>
    );
}
