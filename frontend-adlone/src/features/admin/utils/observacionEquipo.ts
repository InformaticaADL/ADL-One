// Copia de api-backend-adlone/src/utils/observacionEquipo.js (mantener iguales):
// el backend ordena al guardar y el formulario usa esta para mostrar el orden
// final mientras se escribe.
//
// Ordena las líneas de la observación por fecha: la más antigua arriba y la más
// nueva abajo. Cada línea se ordena por la primera fecha de su texto (22.01.25,
// 12-06-24, 05/01/2027, 16 de octubre 2023, octubre 2023...); si no trae, por la
// del prefijo "- [dd/mm/aaaa]" que agrega el sistema. Las líneas sin fecha son
// notas generales y quedan arriba. A igual fecha va al final la última
// registrada (prefijo más reciente); si no, se respeta el orden original.

const MESES: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
    septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const NOMBRES_MES = Object.keys(MESES).join('|');

const RE_PREFIJO = /^\s*-?\s*\[(\d{1,2})\/(\d{1,2})\/(\d{4})\]\s*/;
const RE_NUMERICA = /(?<!\d)(\d{1,2})\s?[./-]\s?(\d{1,2})\s?[./-]\s?(\d{4}|\d{2})(?!\d)/g;
const RE_TEXTO_DIA = new RegExp(`(?<!\\d)(\\d{1,2})\\s+(?:de\\s+)?(${NOMBRES_MES})\\s+(?:de\\s+|del\\s+)?(\\d{4})(?!\\d)`, 'g');
const RE_TEXTO_MES = new RegExp(`\\b(${NOMBRES_MES})\\s+(?:de\\s+|del\\s+)?(\\d{4})(?!\\d)`, 'g');

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// aaaammdd, o null si no es una fecha real.
const valor = (d: string | number, m: string | number, a: string): number | null => {
    let anio = Number(a);
    if (a.length === 2) anio += 2000;
    const dia = Number(d);
    const mes = Number(m);
    if (anio < 1990 || anio > 2100 || mes < 1 || mes > 12 || dia < 1) return null;
    if (dia > new Date(anio, mes, 0).getDate()) return null;
    return anio * 10000 + mes * 100 + dia;
};

const primeraFecha = (texto: string): number | null => {
    const t = sinTildes(texto);
    const candidatas: { pos: number; v: number }[] = [];
    for (const m of t.matchAll(RE_NUMERICA)) {
        const v = valor(m[1], m[2], m[3]);
        if (v) candidatas.push({ pos: m.index ?? 0, v });
    }
    for (const m of t.matchAll(RE_TEXTO_DIA)) {
        const v = valor(m[1], MESES[m[2]], m[3]);
        if (v) candidatas.push({ pos: m.index ?? 0, v });
    }
    for (const m of t.matchAll(RE_TEXTO_MES)) {
        const pos = m.index ?? 0;
        if (candidatas.some((c) => c.pos <= pos && pos - c.pos <= 6)) continue;
        const v = valor(1, MESES[m[1]], m[2]);
        if (v) candidatas.push({ pos, v });
    }
    if (!candidatas.length) return null;
    candidatas.sort((a, b) => a.pos - b.pos);
    return candidatas[0].v;
};

const fechaRegistro = (linea: string): number => {
    const pref = linea.match(RE_PREFIJO);
    return (pref && valor(pref[1], pref[2], pref[3])) || 0;
};

export const fechaLineaObservacion = (linea: string): number | null => {
    const pref = linea.match(RE_PREFIJO);
    const enTexto = primeraFecha(pref ? linea.slice(pref[0].length) : linea);
    if (enTexto) return enTexto;
    return pref ? valor(pref[1], pref[2], pref[3]) : null;
};

export const ordenarObservacion = (texto: string): string => {
    const lineas = texto.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim());
    if (lineas.length < 2) return lineas.join('\n');
    return lineas
        .map((l, i) => ({ l, i, f: fechaLineaObservacion(l), r: fechaRegistro(l) }))
        .sort((a, b) => {
            if (a.f === null && b.f === null) return a.i - b.i;
            if (a.f === null) return -1;
            if (b.f === null) return 1;
            return a.f - b.f || a.r - b.r || a.i - b.i;
        })
        .map((x) => x.l)
        .join('\n');
};
