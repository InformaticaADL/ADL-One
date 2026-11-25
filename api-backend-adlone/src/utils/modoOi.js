// Cómo se reparte el OI (caso de laboratorio) entre los puntos de una visita.
//
// Medido el 2026-11-25 sobre los informes del LIMS (OI desde 2025): casi todos los programas informan UN PUNTO POR OI (Seguimiento Ambiental 646 de 647,
// Control Interno 425 de 427, Autocontrol RILes 696 de 696, BAP 79 de 79…). La excepción es Certificación ASC: el informe de un mismo OI trae todos los
// puntos de la visita (116 de 154 OI listan 6: «Borde Aze R-1/R-2/R-3» y «Control R-1/R-2/R-3»). Por eso:
//   · 'visita': un solo OI para todos los puntos de la visita (ASC);
//   · 'punto': un OI por punto (el resto).
// Es solo el valor por defecto: quien asigna el OI puede cambiarlo en cada visita (solo este punto, toda la visita o los puntos que elija).

/** 'visita' si el programa informa todos los puntos en un solo OI; 'punto' en los demás. */
function modoOiDePrograma(nombrePrograma) {
    return /\bASC\b/i.test(String(nombrePrograma || '')) ? 'visita' : 'punto';
}

/**
 * A qué muestreos de la visita se aplica el OI que se está asignando.
 *   propio: id_agendamam del punto desde el que se asigna.
 *   hermanos: [{ id_agendamam, retiro_completado }] los otros puntos de la visita (sin cancelados).
 *   alcance: 'punto' | 'visita' | 'puntos' (si no viene, el valor por defecto del programa).
 *   idsElegidos: con alcance 'puntos', los id_agendamam elegidos entre los hermanos.
 * Devuelve { alcance, ids, pendientes }: `ids` reciben el OI ahora (el propio y los hermanos con el retiro completado); `pendientes` son los
 * hermanos que debían recibirlo pero aún no completan el retiro.
 */
function repartirOi({ propio, hermanos, alcance, idsElegidos = [], modoPorDefecto = 'punto' }) {
    const modo = ['punto', 'visita', 'puntos'].includes(alcance) ? alcance : modoPorDefecto;
    let destino;
    if (modo === 'visita') destino = hermanos;
    else if (modo === 'puntos') {
        const elegidos = new Set((idsElegidos || []).map(Number));
        destino = hermanos.filter((h) => elegidos.has(Number(h.id_agendamam)));
    } else destino = [];
    const listos = destino.filter((h) => h.retiro_completado === 'S');
    const pendientes = destino.filter((h) => h.retiro_completado !== 'S');
    return { alcance: modo, ids: [Number(propio), ...listos.map((h) => Number(h.id_agendamam))], pendientes };
}

export { modoOiDePrograma, repartirOi };
