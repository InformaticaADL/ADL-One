const RADIO_TIERRA_KM = 6371;

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
 * Suma la distancia Haversine entre puntos GPS consecutivos, en el orden
 * dado. Es la longitud del recorrido (ida y vuelta al mismo punto suma
 * ambos tramos), no el desplazamiento neto entre el primer y el último
 * punto. Misma lógica que api-app-mam/utils/distanciaHelper.js (duplicada a
 * propósito: son repos y runtimes distintos — CJS allá, ESM acá — y es
 * lógica pura sin dependencias compartidas que valga la pena centralizar).
 * @param {Array<{lat: number, lon: number}>} puntosOrdenados - deben venir
 *   ordenados por timestamp_reporte ascendente, no por id_ubicacion: el
 *   tracking móvil encola posiciones offline y las sube en lote, así que el
 *   orden de inserción no siempre coincide con el orden real del recorrido.
 * @returns {number} km recorridos, redondeado a 2 decimales.
 */
export function calcularKmRecorridos(puntosOrdenados) {
    if (!puntosOrdenados || puntosOrdenados.length < 2) return 0;

    let totalKm = 0;
    for (let i = 1; i < puntosOrdenados.length; i++) {
        totalKm += calcularDistanciaKm(puntosOrdenados[i - 1], puntosOrdenados[i]);
    }
    return Math.round(totalKm * 100) / 100;
}
