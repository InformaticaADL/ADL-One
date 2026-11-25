import apiClient from '../../../config/axios.config';
import type { PdfGenerado } from './fichasEquipo.service';

// G. Calidad → Calidad (base ADL-One): archivo de quejas y apelaciones cerradas, Listado OI-FoGe-06 y, en las
// próximas fases, auditorías internas. Ver api-backend-adlone/src/routes/calidad.routes.js.
const BASE = '/api/calidad';

export type TipoQa = 'queja' | 'apelacion';
export type FiltroEstadoQa = 'todos' | 'cerrados' | 'abiertos';

export interface FilaListadoQa {
    id: number;
    folio: string | null;
    tipo: TipoQa;
    origen: string | null;
    empresa: string | null;
    nombre: string | null;
    motivo: string | null;
    fecha_recepcion: string | null;
    estado: string;
    estadoLabel: string;
    cerrado: boolean;
    /** Ya copiado en el archivo de ADL-One. */
    archivado?: boolean;
}

export interface FiltrosListadoQa {
    anio?: number | null;
    tipo?: TipoQa | null;
    estado?: FiltroEstadoQa;
    /** Imprime el estado de cada caso bajo el reclamo. */
    conEstado?: boolean;
    /** Casos que no van en el PDF. */
    excluir?: number[];
}

export interface CasoArchivado {
    id_archivo: number; id_caso_adlweb: number; tipo: 'QUEJA' | 'APELACION'; folio: string | null; origen: string | null;
    empresa: string | null; nombre: string | null; fecha_recepcion: string | null; motivo: string | null; responsable: string | null;
    estado: string; procede: boolean | null; cerrado_en: string | null; acciones: number; fecha_copia: string; fecha_actualizacion: string | null;
}

const params = (f: FiltrosListadoQa) => ({
    ...(f.anio ? { anio: f.anio } : {}),
    ...(f.tipo ? { tipo: f.tipo } : {}),
    ...(f.estado && f.estado !== 'todos' ? { estado: f.estado } : {}),
    ...(f.conEstado ? { conEstado: '1' } : {}),
    ...(f.excluir?.length ? { excluir: f.excluir.join(',') } : {}),
});

export const mensajeError = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

export interface ElementoIso { id_elemento: number; referencia: string | null; nombre: string; orden: number; activo: boolean }
export interface ProgramaMes { estado: string; id_auditoria: number | null; id_item?: number }
export interface FilaPrograma { id_elemento: number; referencia: string | null; nombre: string; meses: Record<number, ProgramaMes> }
export interface Programa { anio: number; existe: boolean; fecha_actualizacion: string | null; observaciones: string | null; filas: FilaPrograma[] }

export const calidadService = {
    // ── Elementos ISO (catálogo editable) ──
    elementosIso: async (todos = false) => (await apiClient.get(`${BASE}/iso-elementos`, { params: todos ? { todos: '1' } : {} })).data.data as ElementoIso[],
    crearElementoIso: async (d: { referencia?: string; nombre: string }) => (await apiClient.post(`${BASE}/iso-elementos`, d)).data.data as { id_elemento: number },
    editarElementoIso: async (id: number, d: { referencia?: string; nombre?: string; activo?: boolean }) => { await apiClient.put(`${BASE}/iso-elementos/${id}`, d); },

    // ── Programa Anual (OI-FoGe-07) ──
    programa: async (anio: number) => (await apiClient.get(`${BASE}/programa/${anio}`)).data.data as Programa,
    guardarPrograma: async (anio: number, d: { meses: Record<number, number[]>; observaciones?: string; fecha_actualizacion?: string | null }) =>
        (await apiClient.put(`${BASE}/programa/${anio}`, d)).data.data as { ok: boolean; bloqueados: { elemento: string; mes: number }[] },
    programaPdf: async (anio: number): Promise<PdfGenerado> => {
        const r = await apiClient.get(`${BASE}/programa/${anio}/pdf`, { responseType: 'blob' });
        return { url: URL.createObjectURL(r.data as Blob), nombre: `OI-FoGe-07 Programa Anual de Auditorías Internas ${anio}.pdf` };
    },
    /** Vista previa con lo que se está marcando en pantalla (sin guardar nada). */
    programaVistaPreviaUrl: async (anio: number, d: { meses: Record<number, number[]>; observaciones?: string }) =>
        URL.createObjectURL((await apiClient.post(`${BASE}/programa/${anio}/vista-previa`, d, { responseType: 'blob' })).data as Blob),

    listadoQa: async (f: FiltrosListadoQa) =>
        (await apiClient.get(`${BASE}/listado-qa`, { params: params(f) })).data.data as { fuente: 'adlweb' | 'archivo'; filas: FilaListadoQa[] },
    /** PDF del Listado OI-FoGe-06 (url local; quien lo pide libera la anterior). */
    listadoQaPdf: async (f: FiltrosListadoQa): Promise<PdfGenerado> => {
        const r = await apiClient.get(`${BASE}/listado-qa/pdf`, { params: params(f), responseType: 'blob' });
        return { url: URL.createObjectURL(r.data as Blob), nombre: `OI-FoGe-06 Listado de Quejas y Apelaciones${f.anio ? ` ${f.anio}` : ''}.pdf` };
    },
    archivoQa: async (f: { anio?: number | null; tipo?: TipoQa | null } = {}) =>
        (await apiClient.get(`${BASE}/archivo-qa`, { params: params(f) })).data.data as { casos: CasoArchivado[]; ultima_copia: string | null },
    sincronizarArchivoQa: async () =>
        (await apiClient.post(`${BASE}/archivo-qa/sincronizar`)).data.data as { copiados: number; actualizados: number; revisados: number; omitido?: string },

    // ── Auditorías internas ──
    listarAuditorias: async (anio?: number) => (await apiClient.get(`${BASE}/auditorias`, { params: anio ? { anio } : {} })).data.data as AuditoriaRow[],
    crearAuditoria: async (d: { anio: number; mes?: number }) => (await apiClient.post(`${BASE}/auditorias`, d)).data.data as { id_auditoria: number; folio: string },
    crearAuditoriaDesdeItem: async (idItem: number) => (await apiClient.post(`${BASE}/programa/item/${idItem}/auditoria`)).data.data as { id_auditoria: number; folio: string },
    obtenerAuditoria: async (id: number) => (await apiClient.get(`${BASE}/auditorias/${id}`)).data.data as Auditoria,
    anularAuditoria: async (id: number, motivo: string) => { await apiClient.post(`${BASE}/auditorias/${id}/anular`, { motivo }); },

    guardarPlan: async (id: number, d: PlanInput) => { await apiClient.put(`${BASE}/auditorias/${id}/plan`, d); },
    planPdf: async (id: number): Promise<PdfGenerado> => {
        const r = await apiClient.get(`${BASE}/auditorias/${id}/plan/pdf`, { responseType: 'blob' });
        return { url: URL.createObjectURL(r.data as Blob), nombre: `OI-FoGe-08 Plan de Auditoría.pdf` };
    },
    planVistaPreviaUrl: async (id: number, d: PlanInput) =>
        URL.createObjectURL((await apiClient.post(`${BASE}/auditorias/${id}/plan/vista-previa`, d, { responseType: 'blob' })).data as Blob),

    guardarReunion: async (id: number, reunion: 'INICIAL' | 'FINAL', d: ReunionInput) => { await apiClient.put(`${BASE}/auditorias/${id}/reunion/${reunion}`, d); },
    reunionPdf: async (id: number): Promise<PdfGenerado> => {
        const r = await apiClient.get(`${BASE}/auditorias/${id}/reunion/pdf`, { responseType: 'blob' });
        return { url: URL.createObjectURL(r.data as Blob), nombre: `OI-FoGe-10 Reunión Inicial y Final.pdf` };
    },
    reunionVistaPreviaUrl: async (id: number, reunion: 'INICIAL' | 'FINAL', d: ReunionInput) =>
        URL.createObjectURL((await apiClient.post(`${BASE}/auditorias/${id}/reunion/${reunion}/vista-previa`, d, { responseType: 'blob' })).data as Blob),

    guardarHallazgos: async (id: number, d: { hojas: Hoja[] }) =>
        (await apiClient.put(`${BASE}/auditorias/${id}/hallazgos`, d)).data.data as { ok: boolean; bloqueados: { hoja: string; requisito: string | null }[] },
    hallazgosPdf: async (id: number): Promise<PdfGenerado> => {
        const r = await apiClient.get(`${BASE}/auditorias/${id}/hallazgos/pdf`, { responseType: 'blob' });
        return { url: URL.createObjectURL(r.data as Blob), nombre: `OI-FoGe-09 Hallazgos de Auditoría.pdf` };
    },
    hallazgosVistaPreviaUrl: async (id: number, d: { hojas: Hoja[] }) =>
        URL.createObjectURL((await apiClient.post(`${BASE}/auditorias/${id}/hallazgos/vista-previa`, d, { responseType: 'blob' })).data as Blob),

    // ── Informe (OI-FoGe-11) ──
    guardarInforme: async (id: number, d: InformeInput) => { await apiClient.put(`${BASE}/auditorias/${id}/informe`, d); },
    informePdf: async (id: number): Promise<PdfGenerado> => {
        const r = await apiClient.get(`${BASE}/auditorias/${id}/informe/pdf`, { responseType: 'blob' });
        return { url: URL.createObjectURL(r.data as Blob), nombre: `OI-FoGe-11 Informe de Auditoría.pdf` };
    },
    informeVistaPreviaUrl: async (id: number, d: InformeInput) =>
        URL.createObjectURL((await apiClient.post(`${BASE}/auditorias/${id}/informe/vista-previa`, d, { responseType: 'blob' })).data as Blob),

    // ── Acciones Correctivas (OI-FoGe-02) ──
    listarAcciones: async (f: { anio?: number; estado?: string; origen?: string } = {}) => (await apiClient.get(`${BASE}/acciones`, { params: f })).data.data as AccionRow[],
    crearAccion: async (d: { origen: OrigenAc; origen_otro?: string; area?: string; fecha_deteccion?: string; detectado_por?: string; requisito?: string }) =>
        (await apiClient.post(`${BASE}/acciones`, d)).data.data as { id_accion: number; folio: string },
    abrirAccionDesdeHallazgo: async (idAuditoria: number, idHallazgo: number) =>
        (await apiClient.post(`${BASE}/auditorias/${idAuditoria}/hallazgos/${idHallazgo}/accion`)).data.data as { id_accion: number; folio: string },
    obtenerAccion: async (id: number) => (await apiClient.get(`${BASE}/acciones/${id}`)).data.data as AccionCorrectiva,
    guardarAccion: async (id: number, d: Partial<AccionCorrectiva>) => { await apiClient.put(`${BASE}/acciones/${id}`, d); },
    cerrarAccion: async (id: number, d: { nombre?: string; firma?: string | null }) => { await apiClient.post(`${BASE}/acciones/${id}/cerrar`, d); },
    anularAccion: async (id: number, motivo: string) => { await apiClient.post(`${BASE}/acciones/${id}/anular`, { motivo }); },
    accionPdf: async (id: number): Promise<PdfGenerado> => {
        const r = await apiClient.get(`${BASE}/acciones/${id}/pdf`, { responseType: 'blob' });
        return { url: URL.createObjectURL(r.data as Blob), nombre: `OI-FoGe-02 Acción Correctiva.pdf` };
    },
    accionVistaPreviaUrl: async (id: number, d: Partial<AccionCorrectiva>) =>
        URL.createObjectURL((await apiClient.post(`${BASE}/acciones/${id}/vista-previa`, d, { responseType: 'blob' })).data as Blob),
};

export type OrigenAc = 'AUDITORIA_INTERNA' | 'AUDITORIA_EXTERNA_2' | 'AUDITORIA_EXTERNA_3' | 'QUEJA' | 'APELACION' | 'REVISION_GERENCIA' | 'AUTODETECTADA' | 'OTRO';
export type EstadoAc = 'ABIERTA' | 'CERRADA' | 'ANULADA';
export interface AccionRow {
    id_accion: number; folio: string | null; origen: OrigenAc; estado: EstadoAc; area: string | null; fecha_deteccion: string | null;
    plazo: string | null; responsable: string | null; requisito: string | null; id_auditoria: number | null; vencida: boolean;
}
export interface SeguimientoAc { fecha?: string | null; cumplimiento?: string | null; responsable?: string | null; observaciones?: string | null }
export interface AccionCorrectiva {
    id_accion: number; folio: string | null; origen: OrigenAc; origen_otro: string | null; id_auditoria: number | null; id_hallazgo: number | null;
    estado: EstadoAc; area: string | null; fecha_deteccion: string | null; fecha_inicio: string | null; detectado_por: string | null; requisito: string | null;
    hallazgo: string | null; justificacion: string | null; correccion_inmediata: string | null; procede_ac: boolean | null;
    participantes: string | null; tecnica: string | null; alcance: string | null;
    accion_propuesta: string | null; responsable: string | null; plazo: string | null; fecha_seguimiento: string | null;
    cumplimiento_plazo: boolean | null; observaciones: string | null; seguimientos: SeguimientoAc[];
    eficacia: string | null; causa_eliminada: boolean | null; se_levanta_nc: boolean | null; observaciones_finales: string | null;
    cierre_nombre: string | null; cierre_fecha: string | null; cierre_firma?: string | null; motivo_anulacion: string | null;
}
export type InformeInput = {
    representante_auditado?: string; documentos_referencia?: string; entrevistados?: string; descripcion_hallazgos?: string;
    juicio_auditor?: string; capacidad_sistema?: string; oportunidades?: string; distribucion?: string;
    fecha_informe?: string | null; firma_auditor_lider?: string | null;
};

export interface AuditoriaRow {
    id_auditoria: number; folio: string | null; anio: number; mes: number | null; estado: string; fecha: string | null;
    auditor_lider: string | null; no_conformidades: number; observaciones: number;
}
export interface AgendaItem { id_agenda?: number; horario?: string | null; area?: string | null; criterio?: string | null; auditor?: string | null; observacion?: string | null }
export interface Asistente { id_asistente?: number; nombre: string; cargo?: string | null; firma?: string | null; fecha_firma?: string | null }
export interface Hallazgo {
    id_hallazgo?: number; requisito?: string | null; que_verificar?: string | null; evidencia?: string | null;
    resultado?: 'C' | 'NC' | 'OBS' | null; observaciones?: string | null; id_accion?: number | null;
}
export interface Hoja {
    id_hoja?: number; id_agenda?: number | null; area?: string | null; auditor?: string | null; fecha?: string | null;
    observaciones_oportunidades?: string | null; hallazgos: Hallazgo[];
}
export interface Auditoria {
    id_auditoria: number; folio: string | null; anio: number; mes: number | null; estado: string;
    fecha: string | null; objetivos: string | null; alcance: string | null; auditor_lider: string | null;
    fecha_reunion_inicial: string | null; fecha_reunion_final: string | null;
    agenda: AgendaItem[]; asistentes_inicial: Asistente[]; asistentes_final: Asistente[]; hojas: Hoja[];
    motivo_anulacion?: string | null;
    representante_auditado?: string | null; documentos_referencia?: string | null; entrevistados?: string | null;
    descripcion_hallazgos?: string | null; juicio_auditor?: string | null; capacidad_sistema?: string | null;
    oportunidades?: string | null; distribucion?: string | null; fecha_informe?: string | null; firma_auditor_lider?: string | null;
}
export type PlanInput = { fecha?: string | null; objetivos?: string; alcance?: string; auditor_lider?: string; agenda?: AgendaItem[] };
export type ReunionInput = { fecha?: string | null; asistentes: Asistente[] };
