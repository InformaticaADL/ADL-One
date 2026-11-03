// Cálculo del formulario OI-FoGe-39 (Verificación Intermedia de Temperatura).
// Replica las fórmulas de cada hoja de equipo del Excel:
//   TFP   = TP - error del patrón            (Temperatura final del patrón)
//   Error = TC - TFP                          (TC = lectura del equipo verificado)
//   Error del rango = promedio de sus 5 lecturas
//   FC    = -Error                            (hoja Resumen: IF(E<=0, ABS(E), -E))
//   Cumple si |Error| <= 0,5 °C en los tres rangos.
// El frontend tiene una copia de esta lógica para mostrar los cálculos en vivo;
// la que vale es esta (se recalcula siempre al guardar).

export const RANGOS = [0, 15, 30];
export const LECTURAS_POR_RANGO = 5;
export const TOLERANCIA = 0.5;
// Verificación trimestral: en el inventario la próxima es casi siempre +90/91/92
// días, que es exactamente "+3 meses de calendario" según el mes de partida.
export const MESES_VIGENCIA = 3;

const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};

// "+ 0" convierte -0 en 0, para que nunca se muestre "-0,0".
const redondear = (n, dec = 2) => (n === null ? null : Math.round(n * 10 ** dec) / 10 ** dec + 0);

export const lecturasVacias = () => Object.fromEntries(
    RANGOS.map((r) => [String(r), Array.from({ length: LECTURAS_POR_RANGO }, () => ({ tp: r, tc: null, hora: '' }))])
);

// Normaliza lo que llegue del cliente a exactamente 5 lecturas por rango.
export const normalizarLecturas = (entrada) => {
    let obj = entrada;
    if (typeof entrada === 'string') {
        try { obj = JSON.parse(entrada); } catch { obj = null; }
    }
    const base = lecturasVacias();
    if (!obj || typeof obj !== 'object') return base;
    for (const r of RANGOS) {
        const filas = Array.isArray(obj[String(r)]) ? obj[String(r)] : [];
        base[String(r)] = base[String(r)].map((def, i) => {
            const f = filas[i] || {};
            const tp = num(f.tp);
            return {
                tp: tp === null ? def.tp : tp,
                tc: num(f.tc),
                hora: typeof f.hora === 'string' ? f.hora.slice(0, 5) : '',
            };
        });
    }
    return base;
};

/**
 * @param lecturas  objeto normalizado (ver normalizarLecturas)
 * @param errPatron { 0: n, 15: n, 30: n }
 */
export const calcularVerificacion = (lecturas, errPatron) => {
    const rangos = {};
    let completas = true;
    for (const r of RANGOS) {
        const ep = num(errPatron?.[r]) ?? 0;
        const filas = (lecturas[String(r)] || []).map((f) => {
            const tfp = f.tp === null ? null : f.tp - ep;
            const error = f.tc === null || tfp === null ? null : f.tc - tfp;
            return { ...f, errorPatron: ep, tfp: redondear(tfp), error: redondear(error) };
        });
        const errores = filas.map((f) => f.error).filter((e) => e !== null);
        if (errores.length < LECTURAS_POR_RANGO) completas = false;
        const promedio = errores.length ? errores.reduce((a, b) => a + b, 0) / errores.length : null;
        const prom = redondear(promedio);
        rangos[r] = {
            filas,
            promedio: prom,
            fc: prom === null ? null : redondear(-prom),
            cumple: prom === null ? null : Math.abs(prom) <= TOLERANCIA + 1e-9,
        };
    }
    const evaluados = RANGOS.map((r) => rangos[r].cumple).filter((c) => c !== null);
    return {
        rangos,
        completas,
        cumple: completas ? evaluados.every(Boolean) : null,
    };
};

// Suma meses de calendario sin desbordar: 30-11 + 3 → 28/29-02 (no 02-03).
export const sumarMeses = (fechaYmd, meses = MESES_VIGENCIA) => {
    const [y, m, d] = String(fechaYmd).slice(0, 10).split('-').map(Number);
    const objetivo = new Date(Date.UTC(y, m - 1 + meses, 1));
    const ultimoDia = new Date(Date.UTC(objetivo.getUTCFullYear(), objetivo.getUTCMonth() + 1, 0)).getUTCDate();
    objetivo.setUTCDate(Math.min(d, ultimoDia));
    return objetivo.toISOString().slice(0, 10);
};
