// Código de un equipo: SIGLA.CORRELATIVO/MA.SEDE (ej. MAU.01/MA.PM), según lo definido por Gestión de Calidad:
//   · Sigla: la define Calidad, son las 3 primeras letras relevantes del equipo y no se repite entre tipos.
//   · Correlativo: único y general para la sigla (un MAU es MAU en todas las sedes), según adquisición e ingreso.
//   · MA: área de Medio Ambiente.
//   · Sede: dónde está el equipo (PM Puerto Montt, VI Villarrica, AY Puerto Aysén, PA Punta Arenas). Al cambiar de sede
//     el código se mantiene y solo cambia esta última parte.

export const SEDES_CODIGO = ['PM', 'VI', 'AY', 'PA'];
const RE_CODIGO = /^([A-Za-z]{3})\.(\d{2,})\/MA\.([A-Za-z]{2})$/;

/** Partes de un código válido, o null si no tiene el formato SIGLA.NN/MA.SEDE. */
export const partesCodigo = (codigo) => {
    const m = String(codigo || '').trim().match(RE_CODIGO);
    return m ? { sigla: m[1], correlativo: Number(m[2]), sede: m[3].toUpperCase() } : null;
};

/**
 * Valida el código que se digita al crear un equipo de un tipo nuevo. Devuelve el mensaje de error o null si está bien.
 * `sede` es la sede elegida en el formulario: la del código debe ser la misma.
 */
export const validarCodigoTipoNuevo = (codigo, sede) => {
    const p = partesCodigo(codigo);
    if (!p) return 'El código debe tener el formato SIGLA.NN/MA.SEDE, con una sigla de 3 letras (ej. COM.01/MA.PM).';
    if (!SEDES_CODIGO.includes(p.sede)) return `La sede del código debe ser ${SEDES_CODIGO.join(', ')}.`;
    if (sede && String(sede).trim().toUpperCase() !== p.sede) return `La sede del código (${p.sede}) no coincide con la sede del equipo (${String(sede).trim().toUpperCase()}).`;
    if (p.correlativo < 1) return 'El correlativo debe ser 01 o mayor.';
    return null;
};

/** El mismo código con otra sede (cambio de sede: el código se mantiene y solo cambia la última parte). */
export const codigoConSede = (codigo, sede) => {
    const p = partesCodigo(codigo);
    if (!p || !SEDES_CODIGO.includes(String(sede || '').toUpperCase())) return null;
    return String(codigo).trim().replace(/\/MA\.[A-Za-z]{2}$/, `/MA.${String(sede).toUpperCase()}`);
};
