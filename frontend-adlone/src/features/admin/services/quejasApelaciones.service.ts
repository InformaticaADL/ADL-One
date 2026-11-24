import apiClient from '../../../config/axios.config';

// Quejas y apelaciones (G. Calidad → Calidad). Los datos viven en la base de ADLWeb; el backend de
// ADL-One los lee y escribe (ver api-backend-adlone/src/services/quejasApelaciones.service.js).
const BASE = '/api/calidad/quejas-apelaciones';

export interface Notificacion {
    id: number; etapa: string; etapaLabel: string; notificado_a: string; via: string;
    observaciones?: string | null; fecha: string; automatico: boolean; creado_por?: string | null; creado_en: string;
}
export interface CasoRow {
    id: number; folio: string; tipo: string; tipoLabel: string; origen: string; origenLabel: string; canal: string; canalLabel: string;
    empresa: string; nombre: string; correo: string; telefono: string; fecha_recepcion: string; hora_recepcion: string;
    fecha_tratamiento: string | null; area: string | null; areaLabel: string | null; numero_informe: string | null;
    estado: string; estadoLabel: string; procede: boolean | null; responsable: string | null; plazo_vence: string | null;
    cerrado_en: string | null; vencida: boolean; cerrado: boolean; notificaciones?: number;
    emisor: string | null; emisorLabel: string | null; via_ingreso: string | null; causa: string | null; jefe_area: string | null;
    acciones_abiertas?: number;
}
export interface Adjunto { id: number; nombre: string; tipo_mime: string; tamano: number; descripcion: string | null; subido_por: string | null; creado_en: string }
export interface Seguimiento { fecha: string; cumplimiento: string; responsable: string; observaciones: string }
export interface Accion {
    id: number; folio: string; caso_id: number; estado: string; estadoLabel: string; area: string | null;
    fecha_deteccion: string | null; fecha_inicio: string | null; detectado_por: string | null; requisito: string | null;
    hallazgo: string | null; justificacion: string | null; correccion_inmediata: string | null; procede_ac: boolean | null;
    participantes: string | null; tecnica: string | null; alcance: string | null; accion_propuesta: string | null;
    responsable: string | null; plazo: string | null; fecha_seguimiento: string | null; cumplimiento_plazo: boolean | null;
    observaciones: string | null; seguimientos: Seguimiento[]; eficacia: string | null; causa_eliminada: boolean | null;
    se_levanta_nc: boolean | null; observaciones_finales: string | null; cierre_nombre: string | null; cierre_fecha: string | null;
    cerrado_por: string | null; anulacion_motivo?: string | null; anulada_por?: string | null; anulada_en?: string | null;
}
export interface HistorialEvaluacion {
    tipo: 'reasignacion' | 'anulacion'; tipoLabel: string; fecha: string; dia?: string; hora?: string; por: string | null; motivo: string;
    responsableAnterior: string | null; decisionAnterior: string | null; fechaEvaluacionAnterior: string | null; evaluadoPorAnterior: string | null;
}
export interface Caso extends Omit<CasoRow, 'notificaciones'> {
    motivo: string; adjunto_nombre: string | null;
    relacionada_actividades: boolean | null; evaluacion: string | null; responsable_independiente: boolean | null;
    requiere_tnc: boolean | null; requiere_auditoria: boolean | null; fecha_evaluacion: string | null; evaluado_por: string | null;
    analisis_causa: string | null; acciones_correctivas: string | null; acciones_preventivas: string | null; tratamiento: string | null;
    conclusiones: string | null; participantes: string | null; aprobado_por: string | null; respuesta_formal: string | null;
    eficacia: string | null; cerrado_por: string | null; creado_por: string | null; creado_en: string;
    consentimiento?: { version_documentos: string; creado_en: string } | null;
    notificaciones: Notificacion[];
    requisito: string | null; reunion_fecha: string | null; reunion_asistentes: string | null; reunion_directrices: string | null;
    adjuntos: Adjunto[]; acciones: Accion[];
    evaluacion_historial: HistorialEvaluacion[];
}
export interface Breakdown { value: string; label: string; total: number }
export interface Stats {
    anio: number; anios: number[]; total: number; abiertos: number; vencidos: number; cerrados: number;
    procedentes: number; noProcedentes: number; sinEvaluar: number; noRelacionadas: number; trabajoNoConforme: number; auditorias: number;
    diasPromedioEvaluacion: number | null; diasPromedioCierre: number | null; cerradosEnPlazo: number; porcentajeEnPlazo: number | null;
    porTipo: Breakdown[]; porOrigen: Breakdown[]; porCanal: Breakdown[]; porEstado: Breakdown[];
    porMes: { mes: number; queja: number; apelacion: number }[];
    porCausa: Breakdown[]; causasTendencia: string[]; tendenciaCausas: Record<string, number>[];
    porEmisor: Breakdown[]; porVia: Breakdown[];
    // Dashboard: casos abiertos hoy (de cualquier año)
    tipo: TipoCaso | null;
    plazos: PlazoCaso[];
    porVencer: number; vencidosHoy: number; abiertosHoy: number;
    cargaResponsables: { responsable: string; abiertos: number; vencidos: number }[];
}
export type TipoCaso = 'queja' | 'apelacion';
export interface PlazoCaso {
    id: number; folio: string; tipo: TipoCaso; tipoLabel: string; empresa: string; nombre: string; responsable: string | null;
    estado: string; estadoLabel: string; plazo_vence: string | null; diasHabiles: number | null;
}
export interface EventoHistorial {
    fecha: string; tipo: 'recepcion' | 'notificacion' | 'correo' | 'alerta' | 'reapertura' | 'decision' | 'accion' | 'adjunto' | 'cierre';
    titulo: string; detalle: string | null; por: string | null;
}
export interface EntradaAuditoria { fecha: string; operacion: string; campo: string | null; detalle: string; por: string | null }
export interface CorreoCola {
    id: number; tipo: string; tipoLabel: string; evento_id: string; estado: 'pendiente' | 'enviando' | 'enviado' | 'error' | 'revisar' | 'descartado';
    estadoLabel: string; intentos: number; ultimo_error: string | null; solicitado_por: string | null; origen: string | null;
    creado_en: string; tomado_en: string | null; enviado_en: string | null;
}
export interface UsuarioAdlOne { id_usuario: number; nombre: string; cargo: string | null }
/**
 * Correo al cliente: ADL-One lo deja en la cola de ADLWeb, que lo envía en menos de un minuto.
 * null = no se pidió; 'sin_cola' = la cola no está disponible (falta actualizar ADLWeb).
 */
export type EstadoCorreo = 'en_cola' | 'ya_en_cola' | 'sin_cola' | null;
export interface ResultadoCorreo { estado?: string; cambios?: string[]; correo: EstadoCorreo }

/** Texto que se agrega al aviso según cómo quedó el correo al cliente. */
const AVISOS_CORREO: Record<Exclude<EstadoCorreo, null>, string> = {
    en_cola: ' El correo al cliente quedó en cola: ADLWeb lo enviará en menos de un minuto.',
    ya_en_cola: ' Ese correo ya estaba en cola; no se duplicó.',
    sin_cola: ' El correo al cliente NO quedó en cola: la cola de ADLWeb no está disponible.',
};
export const avisoCorreo = (correo: EstadoCorreo) => (correo ? AVISOS_CORREO[correo] : '');

const datos = <T,>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

/** Mensaje de error que devuelve el backend ({ message }). */
export const mensajeError = (e: unknown, porDefecto: string) =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message || porDefecto;

export const quejasApelacionesService = {
    listar: (tipo?: TipoCaso) => datos<CasoRow[]>(apiClient.get(BASE, { params: tipo ? { tipo } : {} })),
    estadistica: (anio: string, tipo?: TipoCaso | null) => datos<Stats>(apiClient.get(`${BASE}/estadistica`, { params: { anio, ...(tipo ? { tipo } : {}) } })),
    historial: (id: number) => datos<{ eventos: EventoHistorial[]; auditoria: EntradaAuditoria[] }>(apiClient.get(`${BASE}/${id}/historial`)),
    correos: (id: number) => datos<CorreoCola[]>(apiClient.get(`${BASE}/${id}/correos`)),
    reintentarCorreo: (id: number, correoId: number) => datos<CorreoCola[]>(apiClient.post(`${BASE}/${id}/correos/${correoId}/reintentar`)),
    usuarios: () => datos<UsuarioAdlOne[]>(apiClient.get(`${BASE}/usuarios`)),
    obtener: (id: number) => datos<Caso>(apiClient.get(`${BASE}/${id}`)),
    crear: (body: Record<string, unknown>) => datos<{ id: number; folio: string; correo: EstadoCorreo }>(apiClient.post(BASE, body)),
    editarRegistro: (id: number, body: Record<string, unknown>) => datos<{ cambios: string[] }>(apiClient.put(`${BASE}/${id}/registro`, body)),
    guardarEvaluacion: (id: number, body: Record<string, unknown>) => datos<ResultadoCorreo>(apiClient.put(`${BASE}/${id}/evaluacion`, body)),
    reabrirEvaluacion: (id: number, tipo: string, motivo: string) => datos<{ estado: string }>(apiClient.post(`${BASE}/${id}/evaluacion/reabrir`, { tipo, motivo })),
    guardarTratamiento: (id: number, body: Record<string, unknown>) => datos<ResultadoCorreo>(apiClient.put(`${BASE}/${id}/tratamiento`, body)),
    enviarAcuse: (id: number) => datos<{ correo: EstadoCorreo; notificaciones: Notificacion[] }>(apiClient.post(`${BASE}/${id}/acuse`)),
    agregarNotificacion: (id: number, body: Record<string, unknown>) => datos<{ notificaciones: Notificacion[] }>(apiClient.post(`${BASE}/${id}/notificaciones`, body)),
    subirAdjunto: (id: number, archivo: File, descripcion: string) => {
        const fd = new FormData();
        fd.append('archivo', archivo);
        fd.append('descripcion', descripcion);
        return datos<{ adjuntos: Adjunto[] }>(apiClient.post(`${BASE}/${id}/adjuntos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }));
    },
    abrirAccion: (id: number) => datos<{ id: number; folio: string; acciones: Accion[] }>(apiClient.post(`${BASE}/${id}/acciones`, {})),
    guardarAccion: (id: number, acId: number, body: Record<string, unknown>) => datos<{ acciones: Accion[] }>(apiClient.put(`${BASE}/${id}/acciones/${acId}`, body)),
    anularAccion: (id: number, acId: number, motivo: string) => datos<{ acciones: Accion[] }>(apiClient.post(`${BASE}/${id}/acciones/${acId}/anular`, { motivo })),

    /** Descarga un archivo del backend (formularios .odt y adjuntos) con el token de la sesión. */
    descargar: async (ruta: string, nombre: string) => {
        const res = await apiClient.get(`${BASE}${ruta}`, { responseType: 'blob' });
        const href = URL.createObjectURL(res.data as Blob);
        const a = document.createElement('a');
        a.href = href;
        a.download = nombre;
        a.click();
        URL.revokeObjectURL(href);
    },
};
