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
 * Usa un punto "ancla" que solo avanza cuando el movimiento queda
 * CONFIRMADO por dos puntos consecutivos, no por uno solo. Con datos reales
 * (jornada de prueba: dispositivo quieto, 14 pings cada ~45s) se detectó que
 * un solo ping con error de precisión — un salto aislado de ~24m que en el
 * siguiente ping volvía a la posición original — hacía que el ancla
 * avanzara DOS veces (ida y "vuelta"), sumando ~49m de un dispositivo que
 * nunca se movió.
 *
 * Regla de confirmación (v2 — la v1 comparaba el punto nuevo contra el
 * PENDIENTE, no contra el ancla, y eso rompía el caso normal de caminata
 * continua: a ~1.4 m/s y 45s entre pings, dos pings consecutivos quedan a
 * ~60m entre sí, muy por encima del umbral de 20m, así que ese primer
 * criterio nunca los confirmaba entre ellos y el ancla no avanzaba nunca
 * durante una caminata real): un punto "lejos del ancla" se acepta como
 * confirmado en cuanto el punto SIGUIENTE también está lejos del ancla
 * (no importa cuán lejos esté ese siguiente punto del pendiente, solo que
 * no haya vuelto a estar cerca del ancla) — dos pings consecutivos de
 * acuerdo en que uno ya no está donde estaba el ancla es suficiente para
 * confirmar movimiento real. Un pendiente solo se descarta como ruido
 * cuando el punto siguiente SÍ vuelve a estar cerca del ancla original.
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
    let pendiente = null;

    for (let i = 1; i < puntosOrdenados.length; i++) {
        const punto = puntosOrdenados[i];
        const lejosDelAncla = calcularDistanciaKm(ancla, punto) >= UMBRAL_RUIDO_KM;

        if (!lejosDelAncla) {
            // De vuelta cerca del ancla: si había un pendiente esperando
            // confirmación, era ruido (fue y volvió) — se descarta sin sumar.
            pendiente = null;
            continue;
        }

        if (pendiente !== null) {
            // El punto anterior también estaba lejos del ancla, y este de
            // nuevo — dos pings de acuerdo confirman que el desplazamiento
            // es real, no un rebote de un solo ping.
            totalKm += calcularDistanciaKm(ancla, pendiente);
            ancla = pendiente;
        }
        pendiente = punto;
    }

    // Si el ÚLTIMO punto de la jornada quedó como pendiente sin confirmar
    // (no hay más pings para desmentirlo ni confirmarlo), se cuenta igual —
    // de lo contrario, el tramo más reciente de cualquier jornada nunca se
    // sumaría, porque siempre falta "un ping más" para confirmarlo. Solo se
    // descarta un pendiente cuando un ping POSTERIOR demuestra que fue
    // ruido (vuelve cerca del ancla).
    if (pendiente !== null) {
        totalKm += calcularDistanciaKm(ancla, pendiente);
    }

    return Math.round(totalKm * 100) / 100;
}
