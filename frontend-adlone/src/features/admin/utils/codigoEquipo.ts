// Código de un equipo: SIGLA.CORRELATIVO/MA.SEDE (ej. MAU.01/MA.PM). Misma regla que el backend
// (api-backend-adlone/src/utils/codigoEquipo.js), definida por Gestión de Calidad: sigla de 3 letras que no se repite
// entre tipos, correlativo general para la sigla y la sede del equipo al final.

export const SEDES_CODIGO = ['PM', 'VI', 'AY', 'PA'];
const RE_CODIGO = /^([A-Za-z]{3})\.(\d{2,})\/MA\.([A-Za-z]{2})$/;

/** Mensaje de error del código digitado para un tipo de equipo nuevo, o null si está bien. */
export const validarCodigoTipoNuevo = (codigo: string, sede?: string | null): string | null => {
    const m = String(codigo || '').trim().match(RE_CODIGO);
    if (!m) return 'El código debe tener el formato SIGLA.NN/MA.SEDE, con una sigla de 3 letras (ej. COM.01/MA.PM).';
    const s = m[3].toUpperCase();
    if (!SEDES_CODIGO.includes(s)) return `La sede del código debe ser ${SEDES_CODIGO.join(', ')}.`;
    if (sede && String(sede).trim().toUpperCase() !== s) return `La sede del código (${s}) no coincide con la sede del equipo (${String(sede).trim().toUpperCase()}).`;
    if (Number(m[2]) < 1) return 'El correlativo debe ser 01 o mayor.';
    return null;
};

// Palabras que no cuentan para la sigla (las 3 primeras letras relevantes del equipo).
const PALABRAS_VACIAS = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'para', 'y', 'con', 'en', 'a']);

/**
 * Sigla propuesta para un tipo nuevo: las 3 primeras letras relevantes del nombre, en mayúsculas
 * (ej. «Computador portátil» → COM). Calidad la puede cambiar.
 */
export const sugerirSigla = (nombre?: string | null): string => {
    const palabras = String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z ]/g, ' ').split(/\s+/)
        .filter((p) => p && !PALABRAS_VACIAS.has(p.toLowerCase()));
    return (palabras[0] || '').slice(0, 3).toUpperCase();
};

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Documentos que exige la norma al ingresar un equipo, según Gestión de Calidad:
 *  · Lo que mide temperatura (sondas de pH, multiparámetros, medidores de oxígeno, medidores de pH portátiles):
 *    certificado de calibración de laboratorio (cualquier laboratorio).
 *  · Sondas de caudal: certificado de calibración (las valida por 2 años). Excepción solo de respaldo (proveedor Dilaco):
 *    sin certificado se acepta, pero Medio Ambiente le hace una verificación semestral inicial.
 *  · Muestreadores automáticos: informe técnico y puesta en marcha obligatoria (área técnica o proveedor).
 */
export const requisitosNorma = (nombre?: string | null, tipo?: string | null, queMide?: string | null): string[] => {
    const t = normalizar(`${nombre || ''} ${tipo || ''}`);
    const mide = normalizar(queMide || '');
    if (/muestreador\s+automatic/.test(t)) {
        return ['Informe técnico del equipo.', 'Puesta en marcha obligatoria (OI-FoGe-42): la puede hacer el área técnica o el proveedor, pero debe quedar el respaldo.'];
    }
    if (/caudal/.test(t)) {
        return [
            'Certificado de calibración (valida la sonda por 2 años): obligatorio.',
            'Excepción solo de respaldo (proveedor Dilaco): sin certificado se acepta, pero Medio Ambiente debe hacerle una verificación semestral inicial.',
        ];
    }
    if (/temperatura/.test(mide) || /\bph\b|multipar|oxigeno|temperatura/.test(t)) {
        return ['Certificado de calibración de laboratorio (de cualquier laboratorio): obligatorio.'];
    }
    return [];
};
