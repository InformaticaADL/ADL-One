import apiClient from '../../../config/axios.config';

// Verificación Intermedia Sonda Caudal (OI-FoGe-30): verificación semestral (±10 %) de una sonda de caudal contra un
// equipo de referencia (molinete). Con el V°B° se aplica al equipo y queda en el Archivo de Fichas.

const BASE = '/api/verificaciones-caudal';

export type EstadoVerifCaudal = 'BORRADOR' | 'FIRMADA' | 'ANULADA';
export const UNIDADES_CAUDAL = ['L/s', 'm³/h'] as const;

export interface VerificacionCaudal {
    id_verificacion: number;
    id_equipo: number;
    codigo_equipo: string | null;
    nombre_equipo: string | null;
    sede: string | null;
    fecha_verificacion: string;
    fecha_proxima: string | null;
    id_equipo_referencia: number | null;
    equipo_referencia: string | null;
    caudal_referencia: number | null;
    unidad: string | null;
    lecturas: number[];
    caudal_promedio: number | null;
    desviacion_pct: number | null;
    indice: number | null;
    grado: string | null;
    cumple: boolean | null;
    observacion: string | null;
    estado: EstadoVerifCaudal;
    firmada: boolean;
    nombre_vobo: string | null;
    fecha_firma: string | null;
    motivo_anulacion: string | null;
    nombre_crea: string | null;
    fecha_creacion: string;
    /** Quien mira puede dar el V°B° (rol de Calidad o de Medio Ambiente). */
    puede_firmar?: boolean;
}

export interface SondaCaudal { id_equipo: number; codigo: string; nombre: string; sede: string | null; estado_equipo: string | null; modalidad_control: string | null; ultima_verificacion: string | null; siguiente_verificacion: string | null }
export interface ReferenciaCaudal { id_equipo: number; codigo: string; nombre: string; tipoequipo: string; sede: string | null }

export interface CuerpoVerifCaudal {
    id_equipo?: number;
    fecha_verificacion: string;
    fecha_proxima?: string;
    id_equipo_referencia?: number | null;
    equipo_referencia?: string;
    caudal_referencia?: number | string | null;
    unidad?: string;
    lecturas: (number | string)[];
    observacion?: string;
}

export const verificacionCaudalService = {
    listar: async (filtros: { estado?: string; q?: string; id_equipo?: number } = {}) =>
        (await apiClient.get(BASE, { params: filtros })).data.data as VerificacionCaudal[],
    elegibles: async () => (await apiClient.get(`${BASE}/elegibles`)).data.data as SondaCaudal[],
    referencias: async () => (await apiClient.get(`${BASE}/referencias`)).data.data as ReferenciaCaudal[],
    obtener: async (id: number) => (await apiClient.get(`${BASE}/${id}`)).data.data as VerificacionCaudal,
    crear: async (cuerpo: CuerpoVerifCaudal) => (await apiClient.post(BASE, cuerpo)).data.data as VerificacionCaudal,
    actualizar: async (id: number, cuerpo: CuerpoVerifCaudal) => (await apiClient.put(`${BASE}/${id}`, cuerpo)).data.data as VerificacionCaudal,
    firmar: async (id: number, cuerpo: { imagen?: string; usar_registrada?: boolean }) =>
        (await apiClient.post(`${BASE}/${id}/firmar`, cuerpo)).data.data as VerificacionCaudal,
    anular: async (id: number, motivo: string) => (await apiClient.post(`${BASE}/${id}/anular`, { motivo })).data.data as VerificacionCaudal,
    pdfUrl: async (id: number) => URL.createObjectURL((await apiClient.get(`${BASE}/${id}/pdf`, { responseType: 'blob' })).data as Blob),
    vistaPreviaUrl: async (cuerpo: CuerpoVerifCaudal) =>
        URL.createObjectURL((await apiClient.post(`${BASE}/vista-previa`, cuerpo, { responseType: 'blob' })).data as Blob),
};

// ── Cálculo (mismo que el servidor: api-backend-adlone/src/utils/verificacionCaudal.calc.js) ──
export const MAX_LECTURAS = 10;
export const MIN_LECTURAS = 3;
const redondear = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

export const gradoDe = (indice: number | null) => {
    if (indice === null || Number.isNaN(indice)) return null;
    const i = redondear(indice, 2);
    if (i >= 1) return 'Perfecto';
    if (i >= 0.9) return 'Excelente';
    if (i >= 0.8) return 'Buena';
    if (i >= 0.5) return 'Regular';
    return 'Mala';
};

export const lecturasValidas = (lecturas: (number | string)[]) => lecturas
    .map((v) => (typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v)))
    .filter((v) => Number.isFinite(v) && v > 0)
    .slice(0, MAX_LECTURAS);

/** Promedio, % desviación e índice (caudal menor / caudal mayor); se acepta un índice > 0,90. */
export const calcularCaudal = (referencia: number | string | null | undefined, lecturas: (number | string)[]) => {
    const ref = Number(String(referencia ?? '').replace(',', '.'));
    const l = lecturasValidas(lecturas);
    const promedio = l.length ? l.reduce((a, b) => a + b, 0) / l.length : null;
    if (promedio === null || !(Number.isFinite(ref) && ref > 0)) {
        return { n: l.length, promedio: promedio === null ? null : redondear(promedio, 3), desviacion: null as number | null, indice: null as number | null, grado: null as string | null, cumple: null as boolean | null, completa: false };
    }
    const indice = Math.min(promedio, ref) / Math.max(promedio, ref);
    return {
        n: l.length,
        promedio: redondear(promedio, 3),
        desviacion: redondear((Math.abs(promedio - ref) / ref) * 100, 2),
        indice: redondear(indice, 3),
        grado: gradoDe(indice),
        cumple: redondear(indice, 3) > 0.9,
        completa: l.length >= MIN_LECTURAS,
    };
};
