// Las columnas DATE (fecha de OC, de HES, de facturación…) llegan como medianoche UTC
// ("2026-09-28T00:00:00.000Z"). Pasadas por new Date() y mostradas en hora de Chile (UTC-3/-4)
// retroceden un día (28-09 se veía como 27-09). Cuando el valor es una fecha sin hora se
// formatea desde el texto; los instantes reales (creación, envío) siguen yendo por Date.
export const fmtFecha = (v: string | null | undefined): string => {
    if (!v) return '—';
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.0+)?Z?)?$/.exec(v);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return new Date(v).toLocaleDateString('es-CL');
};
