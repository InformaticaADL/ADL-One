// Ordena las líneas de la observación de un equipo por fecha: la más antigua
// arriba y la más nueva abajo. Las fechas vienen escritas a mano en muchos
// formatos (22.01.25, 12-06-24, 05/01/2027, 16 de octubre 2023, octubre 2023,
// 02.12.24Verificación...). Cada línea se ordena por la primera fecha que trae
// en su texto; si no trae ninguna, por la del prefijo "- [dd/mm/aaaa]" que
// agrega el sistema al registrarla. Las líneas sin ninguna fecha son notas
// generales ("El pH no tiene unidad de medida...") y quedan arriba, en su orden.
// A igual fecha va al final la última registrada; si no, se respeta el orden original.

const MESES = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
    septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const NOMBRES_MES = Object.keys(MESES).join('|');

const RE_PREFIJO = /^\s*-?\s*\[(\d{1,2})\/(\d{1,2})\/(\d{4})\]\s*/;
// dd.mm.aa / dd-mm-aaaa / dd/mm/aa (también separadores mezclados como 01.02-24).
const RE_NUMERICA = /(?<!\d)(\d{1,2})\s?[./-]\s?(\d{1,2})\s?[./-]\s?(\d{4}|\d{2})(?!\d)/g;
// "16 de octubre 2023", "16 de octubre de 2023", "16 octubre del 2023".
const RE_TEXTO_DIA = new RegExp(`(?<!\\d)(\\d{1,2})\\s+(?:de\\s+)?(${NOMBRES_MES})\\s+(?:de\\s+|del\\s+)?(\\d{4})(?!\\d)`, 'g');
// "octubre 2023", "septiembre de 2025" (sin día: se toma el 1).
const RE_TEXTO_MES = new RegExp(`\\b(${NOMBRES_MES})\\s+(?:de\\s+|del\\s+)?(\\d{4})(?!\\d)`, 'g');

const sinTildes = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Devuelve un número aaaammdd, o null si no es una fecha real.
const valor = (d, m, a) => {
    let anio = Number(a);
    if (String(a).length === 2) anio += 2000;
    const dia = Number(d);
    const mes = Number(m);
    if (anio < 1990 || anio > 2100 || mes < 1 || mes > 12 || dia < 1) return null;
    const diasMes = new Date(anio, mes, 0).getDate();
    if (dia > diasMes) return null;
    return anio * 10000 + mes * 100 + dia;
};

// Primera fecha válida dentro del texto (la que aparece antes en la línea).
const primeraFecha = (texto) => {
    const t = sinTildes(texto);
    const candidatas = [];
    for (const m of t.matchAll(RE_NUMERICA)) {
        const v = valor(m[1], m[2], m[3]);
        if (v) candidatas.push({ pos: m.index, v });
    }
    for (const m of t.matchAll(RE_TEXTO_DIA)) {
        const v = valor(m[1], MESES[m[2]], m[3]);
        if (v) candidatas.push({ pos: m.index, v });
    }
    for (const m of t.matchAll(RE_TEXTO_MES)) {
        // Si ya lo tomó el formato con día ("16 de octubre 2023"), gana ese.
        if (candidatas.some((c) => c.pos <= m.index && m.index - c.pos <= 6)) continue;
        const v = valor(1, MESES[m[1]], m[2]);
        if (v) candidatas.push({ pos: m.index, v });
    }
    if (!candidatas.length) return null;
    candidatas.sort((a, b) => a.pos - b.pos);
    return candidatas[0].v;
};

// Fecha del prefijo "- [dd/mm/aaaa]" (cuándo se registró la línea), o 0.
const fechaRegistro = (linea) => {
    const pref = linea.match(RE_PREFIJO);
    return (pref && valor(pref[1], pref[2], pref[3])) || 0;
};

export const fechaLineaObservacion = (linea) => {
    const pref = linea.match(RE_PREFIJO);
    const enTexto = primeraFecha(pref ? linea.slice(pref[0].length) : linea);
    if (enTexto) return enTexto;
    return pref ? valor(pref[1], pref[2], pref[3]) : null;
};

export const ordenarObservacion = (texto) => {
    if (texto === null || texto === undefined) return texto;
    const lineas = String(texto).split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim());
    if (lineas.length < 2) return lineas.join('\n') || String(texto).trim();
    const conFecha = lineas.map((l, i) => ({ l, i, f: fechaLineaObservacion(l), r: fechaRegistro(l) }));
    // A igual fecha, la registrada después por el sistema (prefijo "- [dd/mm/aaaa]"
    // más reciente) va más abajo; las que no tienen prefijo quedan antes.
    conFecha.sort((a, b) => {
        if (a.f === null && b.f === null) return a.i - b.i;
        if (a.f === null) return -1;
        if (b.f === null) return 1;
        return a.f - b.f || a.r - b.r || a.i - b.i;
    });
    return conFecha.map((x) => x.l).join('\n');
};
