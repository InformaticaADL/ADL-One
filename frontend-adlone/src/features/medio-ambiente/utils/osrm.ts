// Ruteo real por calles vía OSRM (mismo servicio público que ya usa el
// Planificador de Rutas). router.project-osrm.org es la DEMO pública y
// gratuita del proyecto, pensada para consultas puntuales — no para uso
// continuo 24/7. Por eso quien llame a fetchOsrmRoute debe limitar la
// frecuencia (solo el muestreador seleccionado, no todos; no en cada
// render) para no arriesgar que bloqueen la IP por abuso.

export interface OsrmRoute {
    /** [lat, lon] por punto, en el orden que recorre la ruta. */
    coordinates: [number, number][];
    distanciaM: number;
    duracionS: number;
}

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

export async function fetchOsrmRoute(
    from: [number, number],
    to: [number, number],
    signal?: AbortSignal
): Promise<OsrmRoute | null> {
    try {
        const coordsStr = `${from[1]},${from[0]};${to[1]},${to[0]}`;
        const res = await fetch(`${OSRM_BASE}/${coordsStr}?overview=full&geometries=geojson`, { signal });
        if (!res.ok) return null;
        const data = await res.json();
        const route = data?.routes?.[0];
        if (!route) return null;
        return {
            coordinates: route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]),
            distanciaM: route.distance,
            duracionS: route.duration,
        };
    } catch (err) {
        if ((err as Error).name !== 'AbortError') {
            console.warn('OSRM routing falló:', err);
        }
        return null;
    }
}

// Distancia acumulada (Haversine) a lo largo de una polyline — usada para
// ubicar un punto a una fracción de distancia recorrida del total.
function distanciaHaversineM(a: [number, number], b: [number, number]): number {
    const R = 6371000;
    const dLat = (b[0] - a[0]) * Math.PI / 180;
    const dLon = (b[1] - a[1]) * Math.PI / 180;
    const sa = Math.sin(dLat / 2) ** 2 +
        Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa));
}

/**
 * Punto ubicado a `fraccion` (0..1) de la distancia total recorrida a lo
 * largo de `coordinates`. Con fraccion >= 1 devuelve el último punto; con
 * fraccion <= 0, el primero. Permite animar un marcador "pegado a la calle"
 * en vez de interpolar en línea recta entre el origen y el destino.
 */
export function puntoEnRuta(coordinates: [number, number][], fraccion: number): [number, number] {
    if (coordinates.length === 0) return [0, 0];
    if (coordinates.length === 1 || fraccion <= 0) return coordinates[0];
    if (fraccion >= 1) return coordinates[coordinates.length - 1];

    const segmentos: number[] = [];
    let total = 0;
    for (let i = 1; i < coordinates.length; i++) {
        const d = distanciaHaversineM(coordinates[i - 1], coordinates[i]);
        segmentos.push(d);
        total += d;
    }
    if (total === 0) return coordinates[0];

    const objetivo = total * fraccion;
    let acumulado = 0;
    for (let i = 0; i < segmentos.length; i++) {
        const siguienteAcumulado = acumulado + segmentos[i];
        if (siguienteAcumulado >= objetivo) {
            const t = segmentos[i] === 0 ? 0 : (objetivo - acumulado) / segmentos[i];
            const [lat1, lon1] = coordinates[i];
            const [lat2, lon2] = coordinates[i + 1];
            return [lat1 + (lat2 - lat1) * t, lon1 + (lon2 - lon1) * t];
        }
        acumulado = siguienteAcumulado;
    }
    return coordinates[coordinates.length - 1];
}
