import apiClient from '../../../config/axios.config';
import type { PdfGenerado } from './fichasEquipo.service';

// G.C. MAM → verificaciones de terreno: OI-FoGe-26 (pH/oxígeno/cloro), OI-FoMa-03 (muestreador automático)
// y OI-FoMa-19 (materiales y EPP). Los tres se llenan desde el folio de la planilla OI-FoMa-01.
const BASE = '/api/verificaciones-terreno';

export type TipoFormulario = 'equipos' | 'mau' | 'materiales';
export type EstadoFormulario = 'BORRADOR' | 'FIRMADA' | 'ANULADA';
/** Cumple · No cumple · No aplica. */
export type Marca = 'C' | 'NC' | 'NA';

export interface ItemsApi {
    equipos: { ph: [string, string][]; oxigeno: [string, string][]; cloro: [string, string][] };
    buffers: [string, string][];
    mau: { grupo: string; items: [string, string][] }[];
    materiales: { grupo: string; items: [string, string][] }[];
    caracteristicas: [string, string][];
}

export interface EquipoMuestreo {
    id_equipo: number; codigo: string; nombre: string; marca: string | null; n_serie: string | null;
    familia: string | null; tiene_fc: boolean;
    error_t0: number | null; error_t15: number | null; error_t30: number | null;
}

export interface Muestreo {
    folio: number; id_agendamam: number; fecha: string; hora: string | null; hora_termino: string | null;
    empresa: string | null; lugar_muestreo: string | null; muestreador: string | null;
    tipo_agua: string | null; caracteristica: string | null;
    /** Lo medido en el agua. Es referencia: no son las lecturas de los buffers del formulario. */
    medicion: {
        ph: string | null; temperatura: string | null; temperatura_corregida: string | null;
        factor_correccion: number | null; observacion: string | null;
    };
    equipos: EquipoMuestreo[];
    sugerencias: Record<string, EquipoMuestreo | null>;
}

export interface MuestreoListado {
    folio: number; fecha: string; hora: string | null;
    empresa: string | null; punto: string | null; muestreador: string | null;
    /** Cuántos formularios de este tipo ya existen para ese folio (0 = ninguno). */
    hechos: number;
    /** El formulario vigente de ese folio, si ya se abrió alguna vez. */
    id_formulario: number | null;
    estado_formulario: EstadoFormulario | null;
}

export interface FilaListado {
    id: number; folio_foma: number | null; empresa: string | null; fecha: string | null;
    estado: EstadoFormulario; nombre_crea: string | null; nombre_firma: string | null; fecha_creacion: string;
}

/** Una fila cualquiera de los tres formularios; cada página usa los campos que le tocan. */
export interface Formulario {
    id_verificacion?: number; id_lista?: number;
    folio_foma: number | null; empresa: string | null; estado: EstadoFormulario;
    fecha_verificacion?: string | null; fecha?: string | null; hora_verificacion?: string | null;
    responsable_muestreo?: string | null; lugar_muestreo?: string | null; muestreador?: string | null;
    error_t0?: number | null; error_t15?: number | null; error_t30?: number | null;
    codigo_equipo_ph?: string | null; codigo_equipo_oxigeno?: string | null; codigo_equipo_cloro?: string | null;
    items_ph?: Record<string, Marca> | null; items_oxigeno?: Record<string, Marca> | null; items_cloro?: Record<string, Marca> | null;
    ajuste_ph?: Record<string, string>[] | null; verificacion_ph?: Record<string, string>[] | null;
    referencia_oxigeno?: Record<string, string> | null; mediciones_oxigeno?: Record<string, Record<string, string>> | null;
    referencia_cloro?: Record<string, Record<string, string>> | null; mediciones_cloro?: Record<string, string> | null;
    codigo_equipo?: string | null; codigo_sonda_caudal?: string | null;
    items?: Record<string, Marca | boolean> | null;
    nivel_real?: number | null; nivel_equipo?: number | null; acepta_nivel?: boolean | null;
    volumen_obtenido?: number | null; volumen_real?: number | null; acepta_volumen?: boolean | null;
    hora_inicio?: string | null; hora_termino?: string | null;
    lote_lavado?: string | null; caracteristica?: string | null; caracteristica_otro?: string | null;
    observaciones?: string | null;
    nombre_firma?: string | null; firma?: string | null; motivo_anulacion?: string | null;
    nombre_crea?: string | null;
}

export const mensajeError = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

export const verificacionTerrenoService = {
    items: async () => (await apiClient.get(`${BASE}/items`)).data.data as ItemsApi,

    /** Muestreos para elegir; `q` busca por folio, empresa o punto. */
    muestreos: async (tipo: TipoFormulario, q = '') =>
        (await apiClient.get(`${BASE}/${tipo}/muestreos`, { params: q ? { q } : {} })).data.data as MuestreoListado[],

    /** Lo que trae el muestreo, para mostrarlo antes de crear el formulario. */
    previo: async (tipo: TipoFormulario, folio: number | string) =>
        (await apiClient.get(`${BASE}/${tipo}/previo/${folio}`)).data.data as { muestreo: Muestreo; campos: Partial<Formulario> },

    listar: async (tipo: TipoFormulario, f: { anio?: number; estado?: string } = {}) =>
        (await apiClient.get(`${BASE}/${tipo}`, { params: f })).data.data as FilaListado[],

    crear: async (tipo: TipoFormulario, folio: number | string) =>
        (await apiClient.post(`${BASE}/${tipo}`, { folio })).data.data as { id: number; folio: number },

    /** Abre el formulario de un muestreo; lo crea con los datos del folio si todavía no existe. */
    abrir: async (tipo: TipoFormulario, folio: number | string) =>
        (await apiClient.post(`${BASE}/${tipo}/abrir/${folio}`)).data.data as { id: number; folio: number; creado: boolean },

    obtener: async (tipo: TipoFormulario, id: number) =>
        (await apiClient.get(`${BASE}/${tipo}/${id}`)).data.data as Formulario,

    guardar: async (tipo: TipoFormulario, id: number, datos: Partial<Formulario>) => {
        await apiClient.put(`${BASE}/${tipo}/${id}`, datos);
    },

    firmar: async (tipo: TipoFormulario, id: number, d: { nombre?: string; firma?: string | null }) => {
        await apiClient.post(`${BASE}/${tipo}/${id}/firmar`, d);
    },

    anular: async (tipo: TipoFormulario, id: number, motivo: string) => {
        await apiClient.post(`${BASE}/${tipo}/${id}/anular`, { motivo });
    },

    pdf: async (tipo: TipoFormulario, id: number): Promise<PdfGenerado> => {
        const r = await apiClient.get(`${BASE}/${tipo}/${id}/pdf`, { responseType: 'blob' });
        return { url: URL.createObjectURL(r.data as Blob), nombre: `${tipo}-${id}.pdf` };
    },

    /** Vista previa de lo que se está escribiendo, sin guardarlo. */
    vistaPreviaUrl: async (tipo: TipoFormulario, datos: Partial<Formulario>) =>
        URL.createObjectURL((await apiClient.post(`${BASE}/${tipo}/vista-previa`, datos, { responseType: 'blob' })).data as Blob),
};

export default verificacionTerrenoService;
