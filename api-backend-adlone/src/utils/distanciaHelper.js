const RADIO_TIERRA_KM = 6371;

// Umbral de ruido GPS: por debajo de esto, la diferencia entre dos puntos se
// trata como el "temblor" normal de la lectura GPS (típicamente 10-50m en
// modo Balanced, peor en interiores), no como desplazamiento real. Sin este
// filtro, un dispositivo completamente quieto igual acumula varios km
// "recorridos" a lo largo de una jornada larga, porque cada ping trae
// coordenadas ligeramente distintas aunque la persona no se haya movido.
const UMBRAL_RUIDO_KM = 0.02; // 20 metros

function calcularDistanciaKm(a, b) {
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const sinDlat = Math.sin(dLat / 2);
    const sinDlon = Math.sin(dLon / 2);
    const chord = sinDlat * sinDlat +
        Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinDlon * sinDlon;
    return RADIO_TIERRA_KM * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
}

/**
 * Suma la distancia Haversine recorrida entre puntos GPS, en el orden dado.
 * Es la longitud del recorrido (ida y vuelta al mismo punto suma ambos
 * tramos), no el desplazamiento neto entre el primer y el último punto.
 * Misma lógica que api-app-mam/utils/distanciaHelper.js (duplicada a
 * propósito: son repos y runtimes distintos — CJS allá, ESM acá — y es
 * lógica pura sin dependencias compartidas que valga la pena centralizar).
 *
 * Usa un punto "ancla" en vez de comparar siempre contra el punto anterior:
 * el ancla solo avanza cuando un punto se aleja más de UMBRAL_RUIDO_KM de
 * ella. Así, el ruido GPS de un dispositivo quieto (que oscila unos metros
 * de un ping a otro, siempre alrededor de la misma posición real) nunca se
 * acumula — comparar solo contra el punto inmediatamente anterior sí lo
 * acumularía, porque cada salto individual pasaría el filtro aunque el
 * conjunto no represente ningún desplazamiento real.
 *
 * @param {Array<{lat: number, lon: number}>} puntosOrdenados - deben venir
 *   ordenados por timestamp_reporte ascendente, no por id_ubicacion: el
 *   tracking móvil encola posiciones offline y las sube en lote, así que el
 *   orden de inserción no siempre coincide con el orden real del recorrido.
 * @returns {number} km recorridos, redondeado a 2 decimales.
 */
export function calcularKmRecorridos(puntosOrdenados) {
    if (!puntosOrdenados || puntosOrdenados.length < 2) return 0;

    let totalKm = 0;
    let ancla = puntosOrdenados[0];
    for (let i = 1; i < puntosOrdenados.length; i++) {
        const distancia = calcularDistanciaKm(ancla, puntosOrdenados[i]);
        if (distancia >= UMBRAL_RUIDO_KM) {
            totalKm += distancia;
            ancla = puntosOrdenados[i];
        }
    }
    return Math.round(totalKm * 100) / 100;
}
