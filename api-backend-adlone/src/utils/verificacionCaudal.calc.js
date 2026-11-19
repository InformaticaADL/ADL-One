// Cálculo del formulario OI-FoGe-30 «Verificación Intermedia Sonda Caudal» (verificación semestral, ±10 %).
//
//   Caudal promedio  = promedio de las lecturas del caudal que marca la sonda (hasta 10, como las casillas del formulario).
//   % Desviación     = |caudal promedio − caudal de referencia| / caudal de referencia × 100.
//   Índice           = caudal menor obtenido / caudal mayor obtenido (entre el promedio de la sonda y la referencia).
//   Grado            = 1 Perfecto · 0,90 a 0,99 Excelente · 0,80 a 0,89 Buena · 0,50 a 0,79 Regular · < 0,50 Mala.
//   Se acepta un índice > 0,90 (10 % de desviación).

export const MAX_LECTURAS = 10;
export const MIN_LECTURAS = 3;
export const INDICE_ACEPTACION = 0.9;

export const GRADOS = [
    { desde: 1, hasta: 1, grado: 'Perfecto', texto: '1' },
    { desde: 0.9, hasta: 0.99, grado: 'Excelente', texto: '0.90 a 0.99' },
    { desde: 0.8, hasta: 0.89, grado: 'Buena', texto: '0.80 a 0.89' },
    { desde: 0.5, hasta: 0.79, grado: 'Regular', texto: '0.50 a 0.79' },
    { desde: 0, hasta: 0.49, grado: 'Mala', texto: '< a 0.50' },
];

const redondear = (n, d) => Math.round(n * 10 ** d) / 10 ** d;

/** Grado de correlación de un índice (se compara con dos decimales, como en la tabla del formulario). */
export const gradoDe = (indice) => {
    if (indice === null || indice === undefined || Number.isNaN(indice)) return null;
    const i = redondear(indice, 2);
    if (i >= 1) return 'Perfecto';
    if (i >= 0.9) return 'Excelente';
    if (i >= 0.8) return 'Buena';
    if (i >= 0.5) return 'Regular';
    return 'Mala';
};

/** Solo números positivos; lo vacío o inválido se descarta. */
export const lecturasValidas = (lecturas) => (Array.isArray(lecturas) ? lecturas : [])
    .map((v) => (typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v)))
    .filter((v) => Number.isFinite(v) && v > 0)
    .slice(0, MAX_LECTURAS);

/**
 * Resultado de la verificación. `completa` exige el caudal de referencia y al menos MIN_LECTURAS lecturas.
 * → { n, promedio, desviacion, indice, grado, cumple, completa } (números redondeados para mostrar e imprimir).
 */
export const calcularCaudal = ({ caudal_referencia, lecturas }) => {
    const ref = Number(String(caudal_referencia ?? '').replace(',', '.'));
    const l = lecturasValidas(lecturas);
    const n = l.length;
    const promedio = n ? l.reduce((a, b) => a + b, 0) / n : null;
    const hayRef = Number.isFinite(ref) && ref > 0;
    if (promedio === null || !hayRef) {
        return { n, promedio: promedio === null ? null : redondear(promedio, 3), desviacion: null, indice: null, grado: null, cumple: null, completa: false };
    }
    const desviacion = (Math.abs(promedio - ref) / ref) * 100;
    const indice = Math.min(promedio, ref) / Math.max(promedio, ref);
    return {
        n,
        promedio: redondear(promedio, 3),
        desviacion: redondear(desviacion, 2),
        indice: redondear(indice, 3),
        grado: gradoDe(indice),
        cumple: redondear(indice, 3) > INDICE_ACEPTACION,
        completa: n >= MIN_LECTURAS,
    };
};
