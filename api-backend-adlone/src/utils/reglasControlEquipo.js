// Reglas de control de fechas de los equipos de Medio Ambiente.
//
// Una sola fuente de verdad para el backend y el formulario (el frontend la lee
// de GET /admin/equipos/reglas-control). Salen del inventario OI-FoGe-21:
//
//   MANTENCION_ANUAL         cada 12 meses  (Mantención anual preventiva)
//   CONTRASTACION_SEMESTRAL  cada 6 meses   (2 veces al año)
//   VERIFICACION_TRIMESTRAL  cada 3 meses   (Verificación trimestral de T°)
//   CALIBRACION_ANUAL        cada 12 meses  (calibración externa de los patrones)
//   SIN_VENCIMIENTO          complementos (baterías, botellas…): no vencen, solo se
//                            dan de baja a mano.
//
// Cada equipo rige por UNA modalidad: el par Ultima_verificacion /
// Siguiente_verificacion guarda las fechas de esa modalidad. Donde hay más de una
// opción (sonda de caudal, molinete) la persona elige y la otra no aplica.
// La columna "Calibracion/Verificacion" del Excel era solo una guía y no se guarda.

export const MODALIDADES = {
    MANTENCION_ANUAL: { meses: 12, nombre: 'Mantención anual preventiva', corto: 'Mantención anual' },
    CONTRASTACION_SEMESTRAL: { meses: 6, nombre: 'Contrastación semestral', corto: 'Contrastación semestral' },
    VERIFICACION_TRIMESTRAL: { meses: 3, nombre: 'Verificación trimestral de T°', corto: 'Verificación trimestral' },
    CALIBRACION_ANUAL: { meses: 12, nombre: 'Calibración anual de patrón', corto: 'Calibración anual' },
    SIN_VENCIMIENTO: { meses: null, nombre: 'Sin vencimiento (complemento)', corto: 'Sin vencimiento' },
};

const M = 'MANTENCION_ANUAL';
const C = 'CONTRASTACION_SEMESTRAL';
const V = 'VERIFICACION_TRIMESTRAL';
const K = 'CALIBRACION_ANUAL';
const S = 'SIN_VENCIMIENTO';

// Nombre de equipo (como en mae_equipo.nombre) → modalidades permitidas. La primera
// es la que se usa por defecto. Con más de una, la persona elige.
const REGLAS_POR_NOMBRE = {
    'MUESTREADOR AUTOMATICO': [M],
    'SONDA CAUDAL': [C, V],
    'MOLINETE': [C, M],
    'MEDIDOR PH PORTATIL': [V],
    'MEDIDOR DE PH': [V],
    'SONDA PH/TEMPERATURA': [V],
    'TERMOCUPLA': [V],
    'MEDIDOR DE OXIGENO DISUELTO': [V],
    'SONDA OXIGENO DISUELTO': [V],
    'MULTIPARAMETRO': [V],
    'SONDA MULTIPARAMETRO': [V],
    'TERMOMETRO PATRON': [K],
    'SONDA TERMOMETRO PATRON': [K],
    // Complementos y accesorios sin ciclo de fechas
    'BATERIA': [S],
    'CARGADOR DE BATERIAS': [S],
    'POWER PACK': [S],
    'CABLE DE DESCARGA DE DATOS': [S],
    'PEDESTAL': [S],
    'REFRIGERADOR': [S],
    'FILTRO': [S],
    'BOTELLA OCEANOGRAFICA': [S],
    'DRAGA PARA SEDIMENTOS': [S],
    'DISCO SECCHI': [S],
    'MALLA SURBER': [S],
    'TAMIZ SEDIMENTO': [S],
    'TOMADOR MUESTRA DE LODO': [S],
    'HUINCHE MECANICO': [S],
    'GPS': [S],
    'TESTER': [S],
    'POZOMETRO': [S],
    'MEDIDOR DE GASES': [S],
    'MEDIDOR DE FLUJO ULTRASONICO': [S],
    // Cloro: hoy sin ciclo (decisión pendiente sobre verificación con estándar)
    'MEDIDOR DE CLORO': [S],
    'MEDIDOR DE CLORO RESIDUAL': [S],
    'MEDIDOR DE CLORO TOTAL': [S],
    'MEDIDOR DE CLORO DIGITAL PATRON': [S],
};

// Familias para agrupar y filtrar (nombre de equipo → familia).
export const FAMILIAS = {
    'pH / Temperatura': ['MEDIDOR PH PORTATIL', 'MEDIDOR DE PH', 'SONDA PH/TEMPERATURA', 'TERMOCUPLA'],
    'Oxígeno disuelto': ['MEDIDOR DE OXIGENO DISUELTO', 'SONDA OXIGENO DISUELTO'],
    'Multiparámetro': ['MULTIPARAMETRO', 'SONDA MULTIPARAMETRO'],
    'Caudal y muestreo automático': ['SONDA CAUDAL', 'MOLINETE', 'MEDIDOR DE FLUJO ULTRASONICO', 'MUESTREADOR AUTOMATICO'],
    'Cloro': ['MEDIDOR DE CLORO', 'MEDIDOR DE CLORO RESIDUAL', 'MEDIDOR DE CLORO TOTAL', 'MEDIDOR DE CLORO DIGITAL PATRON'],
    'Patrones de temperatura': ['TERMOMETRO PATRON', 'SONDA TERMOMETRO PATRON'],
    'Otros instrumentos': ['MEDIDOR DE GASES', 'GPS', 'TESTER', 'POZOMETRO'],
    'Muestreo manual y accesorios': ['BOTELLA OCEANOGRAFICA', 'DRAGA PARA SEDIMENTOS', 'DISCO SECCHI', 'MALLA SURBER', 'TAMIZ SEDIMENTO', 'TOMADOR MUESTRA DE LODO', 'HUINCHE MECANICO', 'FILTRO'],
    'Energía y soporte': ['BATERIA', 'CARGADOR DE BATERIAS', 'POWER PACK', 'CABLE DE DESCARGA DE DATOS', 'PEDESTAL', 'REFRIGERADOR'],
};

export const normalizarNombreEquipo = (nombre) =>
    String(nombre ?? '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

/** Modalidades permitidas para un nombre de equipo, o null si el nombre no tiene regla. */
export const reglaDeEquipo = (nombre) => {
    const permitidas = REGLAS_POR_NOMBRE[normalizarNombreEquipo(nombre)];
    if (!permitidas) return null;
    return { permitidas: [...permitidas], defecto: permitidas[0], elegible: permitidas.length > 1 };
};

/**
 * Modalidad que rige para un equipo. Respeta la pedida si es una de las permitidas;
 * si no, usa la de por defecto. Sin regla para el nombre devuelve null (el equipo
 * sigue como hasta ahora).
 */
export const resolverModalidad = (nombre, pedida) => {
    const regla = reglaDeEquipo(nombre);
    if (!regla) return null;
    const p = String(pedida ?? '').trim().toUpperCase();
    return regla.permitidas.includes(p) ? p : regla.defecto;
};

/** Familia a la que pertenece un nombre de equipo, o '' si no tiene. */
export const familiaDeEquipo = (nombre) => {
    const n = normalizarNombreEquipo(nombre);
    return Object.entries(FAMILIAS).find(([, nombres]) => nombres.includes(n))?.[0] ?? '';
};

export const mesesDeModalidad = (modalidad) => MODALIDADES[modalidad]?.meses ?? null;

const pad = (n) => String(n).padStart(2, '0');

/** Suma meses de calendario a 'YYYY-MM-DD' (31-ago + 6 meses → 28/29-feb). */
export const sumarMeses = (fechaISO, meses) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fechaISO ?? ''));
    if (!m || !Number.isFinite(meses)) return null;
    const y = Number(m[1]);
    const mes0 = Number(m[2]) - 1 + meses;
    const anio = y + Math.floor(mes0 / 12);
    const mesDestino = ((mes0 % 12) + 12) % 12;
    const ultimoDia = new Date(Date.UTC(anio, mesDestino + 1, 0)).getUTCDate();
    return `${anio}-${pad(mesDestino + 1)}-${pad(Math.min(Number(m[3]), ultimoDia))}`;
};

/** Próxima fecha = última + frecuencia de la modalidad; null si no vence o falta la última. */
export const calcularSiguiente = (ultimaISO, modalidad) => {
    const meses = mesesDeModalidad(modalidad);
    return meses ? sumarMeses(ultimaISO, meses) : null;
};

/** Catálogo serializable para el frontend. */
export const catalogoReglas = () => ({
    modalidades: Object.fromEntries(Object.entries(MODALIDADES).map(([k, v]) => [k, { ...v }])),
    familias: Object.fromEntries(Object.entries(FAMILIAS).map(([k, v]) => [k, [...v]])),
    equipos: Object.fromEntries(
        Object.keys(REGLAS_POR_NOMBRE).map((n) => [n, { permitidas: REGLAS_POR_NOMBRE[n], defecto: REGLAS_POR_NOMBRE[n][0] }]),
    ),
});
