import { MapContainer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { BaseTiles } from './BaseTiles';
import { BASEMAPS, BASEMAP_STORAGE_KEY, leerBasemapGuardado } from '../utils/basemaps';
import type { JornadaHoy, UltimaPosicion } from '../services/tracking.service';
import { colorPorMuestreador, inicialesDe } from '../utils/colorMuestreador';
import { fetchOsrmRoute, puntoEnRuta } from '../utils/osrm';
import { siguienteFichaPendiente } from '../utils/fichaHoyHelpers';

// Fix para los íconos por defecto de Leaflet, que no se resuelven bien en el
// bundle de Vite.
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

export interface RutaProyectadaInfo {
    distanciaM: number;
    duracionS: number;
    centro: string | null;
}

interface TrackingMapaProps {
    jornadas: JornadaHoy[];
    selectedMuestreadorId: number | null;
    onSelectMuestreador: (id: number) => void;
    /** Distancia/tiempo reales (OSRM) a la próxima ficha del seleccionado, para que
        el drawer de detalle los muestre. null mientras no hay selección o ruta. */
    onRutaProyectada?: (info: RutaProyectadaInfo | null) => void;
}

// Ruta real por calle desde la posición actual del muestreador SELECCIONADO
// hasta su próxima ficha pendiente — solo se recalcula cuando llega un ping
// real nuevo de ESE muestreador (no en cada frame de la animación), para no
// saturar el servicio OSRM. Si no hay ficha pendiente con coordenadas, o el
// muestreador no está en_ruta, no se dibuja nada.
function RutaProyectada({
    jornada,
    posicionActual,
    onRutaProyectada,
}: {
    jornada: JornadaHoy | undefined;
    posicionActual: [number, number] | null;
    onRutaProyectada?: (info: RutaProyectadaInfo | null) => void;
}) {
    const [ruta, setRuta] = useState<{ coords: [number, number][]; info: RutaProyectadaInfo } | null>(null);

    const siguiente = jornada && jornada.estado === 'en_ruta' ? siguienteFichaPendiente(jornada.fichas_hoy) : null;
    const destino: [number, number] | null = siguiente
        ? [Number(siguiente.ubicacion_lat), Number(siguiente.ubicacion_lon)]
        : null;
    const timestampPing = jornada?.ultima_posicion?.timestamp_reporte ?? null;

    useEffect(() => {
        if (!posicionActual || !destino || !Number.isFinite(destino[0]) || !Number.isFinite(destino[1])) {
            setRuta(null);
            onRutaProyectada?.(null);
            return;
        }
        const controller = new AbortController();
        fetchOsrmRoute(posicionActual, destino, controller.signal).then((r) => {
            if (!r || controller.signal.aborted) return;
            const info: RutaProyectadaInfo = { distanciaM: r.distanciaM, duracionS: r.duracionS, centro: siguiente?.centro ?? null };
            setRuta({ coords: r.coordinates, info });
            onRutaProyectada?.(info);
        });
        return () => controller.abort();
        // Clave en el timestamp del último ping real (no en posicionActual, que
        // cambia en cada frame animado) para recalcular solo cuando hay un ping
        // real nuevo del muestreador seleccionado.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timestampPing, destino?.[0], destino?.[1]]);

    if (!ruta) return null;
    return (
        <Polyline
            positions={ruta.coords}
            pathOptions={{ color: '#228be6', weight: 4, opacity: 0.7, dashArray: '8 8' }}
        />
    );
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

    // flyTo (no setView): un salto instantáneo al cambiar de muestreador se
    // sentía brusco — el vuelo animado deja claro visualmente "nos estamos
    // moviendo hacia este vehículo" en vez de un corte seco de cuadro.
    // Depende solo de selectedMuestreadorId (no de lat/lng en cada ping del
    // seleccionado) para no relanzar el vuelo cada vez que se mueve.
    const selectedIdRef = useRef(selectedMuestreadorId);
    useEffect(() => {
        if (selectedMuestreadorId === null) return;
        const cambioDeSeleccion = selectedIdRef.current !== selectedMuestreadorId;
        selectedIdRef.current = selectedMuestreadorId;
        if (!cambioDeSeleccion) return;
        if (lat !== undefined && lng !== undefined) {
            map.flyTo([lat, lng], 15, { duration: 1.2 });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMuestreadorId, map]);

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
// `conCalles`: solo true para el muestreador SELECCIONADO (ver TrackingMapa
// más abajo). Pide a OSRM la ruta real por calle entre los dos últimos pings
// reales y anima el ícono a lo largo de esa geometría en vez de una línea
// recta — así se mueve "pegado a la calle" como Uber, no en diagonal cruzando
// manzanas. No se activa para el resto de los marcadores a la vez: OSRM demo
// es un servicio público gratuito, no pensado para pedir una ruta por cada
// ping de cada muestreador en simultáneo (ver utils/osrm.ts).
function usePosicionUber(target: [number, number], timestampReporte: string, enMovimiento: boolean, conCalles: boolean): [number, number] {
    const tInicial = new Date(timestampReporte).getTime();
    const [pos, setPos] = useState<[number, number]>(target);
    const posRef = useRef<[number, number]>(target);
    const prevPuntoRef = useRef<PuntoConTiempo | null>(null);
    const currPuntoRef = useRef<PuntoConTiempo>({ lat: target[0], lon: target[1], t: Number.isFinite(tInicial) ? tInicial : Date.now() });
    const correccionRef = useRef<{ desde: [number, number]; inicio: number } | null>(null);
    const ultimoRenderRef = useRef(0);
    const frameRef = useRef<number | undefined>(undefined);
    // Ruta por calle del TRAMO actual (entre prevPunto y currPunto). null
    // mientras no haya una (sin conCalles, mientras OSRM resuelve, o si falló)
    // — el tick cae de vuelta a la extrapolación lineal en esos casos.
    const rutaTramoRef = useRef<{ coords: [number, number][]; duracionS: number; inicioT: number } | null>(null);

    // Llegó un ping real distinto del actual: guarda desde dónde había que
    // corregir (la posición mostrada en este instante, sea real o
    // extrapolada) para que el loop de animación la funda suavemente hacia
    // el punto real nuevo, y desplaza prev/curr para recalcular la velocidad
    // del tramo siguiente.
    useEffect(() => {
        const t = new Date(timestampReporte).getTime();
        if (!Number.isFinite(t) || t === currPuntoRef.current.t) return;

        const prevAnterior = currPuntoRef.current;
        prevPuntoRef.current = prevAnterior;
        currPuntoRef.current = { lat: target[0], lon: target[1], t };
        correccionRef.current = { desde: posRef.current, inicio: performance.now() };
        rutaTramoRef.current = null;

        if (conCalles) {
            const controller = new AbortController();
            fetchOsrmRoute([prevAnterior.lat, prevAnterior.lon], [target[0], target[1]], controller.signal)
                .then((ruta) => {
                    if (!ruta || controller.signal.aborted) return;
                    rutaTramoRef.current = { coords: ruta.coordinates, duracionS: ruta.duracionS, inicioT: t };
                });
            return () => controller.abort();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target[0], target[1], timestampReporte, conCalles]);

    useEffect(() => {
        function tick() {
            const curr = currPuntoRef.current;
            const correccion = correccionRef.current;
            let destino: [number, number];

            const ruta = rutaTramoRef.current;
            const dtDesdePing = Date.now() - curr.t;
            if (enMovimiento && ruta && ruta.inicioT === curr.t && dtDesdePing < MAX_EXTRAPOLACION_MS) {
                // Fracción del tiempo típico de ese tramo (según OSRM) ya transcurrido
                // desde el ping — no la distancia, para no "teletransportar" si el
                // muestreador va más lento de lo que OSRM asume.
                const fraccion = ruta.duracionS > 0 ? (dtDesdePing / 1000) / ruta.duracionS : 1;
                destino = puntoEnRuta(ruta.coords, fraccion);
            } else if (enMovimiento && prevPuntoRef.current) {
                const prev = prevPuntoRef.current;
                const dtTramo = curr.t - prev.t;
                if (dtTramo > 0 && dtDesdePing < MAX_EXTRAPOLACION_MS) {
                    const velLat = (curr.lat - prev.lat) / dtTramo;
                    const velLon = (curr.lon - prev.lon) / dtTramo;
                    destino = [curr.lat + velLat * dtDesdePing, curr.lon + velLon * dtDesdePing];
                } else {
                    destino = [curr.lat, curr.lon];
                }
            } else {
                destino = [curr.lat, curr.lon];
            }

            let siguiente: [number, number];
            if (correccion) {
                const t = Math.min((performance.now() - correccion.inicio) / DURACION_CORRECCION_MS, 1);
                const suavizado = 1 - Math.pow(1 - t, 3);
                siguiente = [
                    correccion.desde[0] + (destino[0] - correccion.desde[0]) * suavizado,
                    correccion.desde[1] + (destino[1] - correccion.desde[1]) * suavizado,
                ];
                if (t >= 1) correccionRef.current = null;
            } else {
                siguiente = destino;
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
    /** Solo el seleccionado reporta su posición animada hacia arriba, para que
        TrackingMapa pueda proyectar la ruta por calle hacia su próxima ficha. */
    onPosicionActual?: (pos: [number, number]) => void;
}

function MarcadorMuestreador({ jornada, seleccionado, onSelectMuestreador, onPosicionActual }: MarcadorMuestreadorProps) {
    const posicionAnimada = usePosicionUber(
        [jornada.ultima_posicion.latitud, jornada.ultima_posicion.longitud],
        jornada.ultima_posicion.timestamp_reporte,
        jornada.estado === 'en_ruta',
        seleccionado
    );

    useEffect(() => {
        if (seleccionado) onPosicionActual?.(posicionAnimada);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seleccionado, posicionAnimada[0], posicionAnimada[1]]);

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

export function TrackingMapa({ jornadas, selectedMuestreadorId, onSelectMuestreador, onRutaProyectada }: TrackingMapaProps) {
    // Predicado de tipo (no un simple boolean) para que TypeScript realmente
    // angoste ultima_posicion a no-nulo dentro del .map() de abajo — con un
    // filter(j => j.ultima_posicion !== null) normal, TS no propaga ese
    // angostamiento y las aserciones "!" quedarían sin respaldo del compilador.
    const conPosicion = jornadas.filter(
        (j): j is JornadaHoy & { ultima_posicion: UltimaPosicion } => j.ultima_posicion !== null
    );

    const [basemapId, setBasemapId] = useState<string>(leerBasemapGuardado);
    const [posicionSeleccionado, setPosicionSeleccionado] = useState<[number, number] | null>(null);
    const jornadaSeleccionada = jornadas.find((j) => j.id_muestreador === selectedMuestreadorId);

    // Al cambiar de muestreador seleccionado, descarta la posición animada del
    // anterior — sin esto, RutaProyectada podría usar un instante la posición
    // vieja antes de que el nuevo marcador reporte la suya.
    useEffect(() => {
        setPosicionSeleccionado(null);
    }, [selectedMuestreadorId]);

    const cambiarBasemap = (id: string) => {
        setBasemapId(id);
        try { localStorage.setItem(BASEMAP_STORAGE_KEY, id); } catch { /* no-op */ }
    };

    return (
        // isolate: el selector de basemap de abajo usa z-[1000] para quedar
        // sobre el mapa; sin stacking context propio ese 1000 compite en la
        // raíz y también tapaba los overlays de la app (popover de
        // notificaciones, diálogos), que viven en z-300.
        <div className="shadcn-scope relative isolate h-full w-full">
            {/* Selector de fondo de mapa. onMouseDown/onWheel stopPropagation para
                que interactuar con el control no arrastre ni haga zoom en el mapa. */}
            <div
                className="absolute right-2 top-2 z-[1000] flex gap-0.5 rounded-lg border border-border bg-card/95 p-0.5 shadow-md"
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onWheel={(e) => e.stopPropagation()}
            >
                {BASEMAPS.map((b) => (
                    <button
                        key={b.id}
                        type="button"
                        onClick={() => cambiarBasemap(b.id)}
                        className={cn(
                            'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                            basemapId === b.id ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
                        )}
                    >
                        {b.label}
                    </button>
                ))}
            </div>

            <MapContainer center={CENTRO_DEFECTO} zoom={6} style={{ height: '100%', width: '100%' }}>
                <BaseTiles styleId={basemapId} />
                <CentradorMapa jornadas={jornadas} selectedMuestreadorId={selectedMuestreadorId} />
                {conPosicion.map((j) => (
                    <MarcadorMuestreador
                        key={j.id_muestreador}
                        jornada={j}
                        seleccionado={j.id_muestreador === selectedMuestreadorId}
                        onSelectMuestreador={onSelectMuestreador}
                        onPosicionActual={j.id_muestreador === selectedMuestreadorId ? setPosicionSeleccionado : undefined}
                    />
                ))}
                <RutaProyectada
                    jornada={jornadaSeleccionada}
                    posicionActual={posicionSeleccionado}
                    onRutaProyectada={onRutaProyectada}
                />
            </MapContainer>
        </div>
    );
}
