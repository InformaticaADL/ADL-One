import apiClient from '../../../config/axios.config';

// Puestas en marcha de equipos (OI-FoGe-42): registro propio con verificación compartida entre el Área Técnica de
// Medio Ambiente y Gestión de Calidad. Con las dos firmas queda aprobada y entra al historial del equipo.

const BASE = '/api/puestas-marcha';

export type TipoPuestaMarcha = 'EQUIPO_NUEVO' | 'RETORNO_SERVICIO' | 'CAMBIO_SEDE' | 'REACTIVACION';
export type AreaPuestaMarcha = 'TECNICA' | 'CALIDAD';
export type EstadoPuestaMarcha = 'PENDIENTE_FIRMA' | 'APROBADA' | 'ANULADA';

export const TIPOS_PUESTA_MARCHA: { value: TipoPuestaMarcha; label: string }[] = [
    { value: 'EQUIPO_NUEVO', label: 'Recepción como equipo nuevo' },
    { value: 'RETORNO_SERVICIO', label: 'Retorno de servicio externo (diagnóstico, reparación o mantención)' },
    { value: 'CAMBIO_SEDE', label: 'Cambio de sede' },
    { value: 'REACTIVACION', label: 'Reactivación tras Fuera de Servicio' },
];
export const NOMBRE_AREA: Record<AreaPuestaMarcha, string> = { TECNICA: 'Área Técnica de Medio Ambiente', CALIDAD: 'Gestión de Calidad' };

/** Aviso visible de lo que se va a mejorar (lámina 11 del documento «Avance y Observaciones»). */

export interface FirmaPuestaMarcha { firmada: boolean; nombre: string | null; fecha: string | null }

export interface PuestaMarcha {
    id_puesta_marcha: number;
    id_equipo: number;
    codigo_equipo: string | null;
    nombre_equipo: string | null;
    sede: string | null;
    tipo: TipoPuestaMarcha;
    fecha: string;
    area_realiza: AreaPuestaMarcha;
    estado_recepcion: 'CUMPLE' | 'NO_CUMPLE';
    funcionamiento: 'OPERATIVO' | 'NO_OPERATIVO';
    patron_referencia: string | null;
    observacion: string;
    verificacion_tipo: 'TEMPERATURA' | 'CAUDAL' | null;
    verificacion_id: number | null;
    verificacion_codigo: string | null;
    verificacion_fecha: string | null;
    estado: EstadoPuestaMarcha;
    firmas: Record<AreaPuestaMarcha, FirmaPuestaMarcha>;
    en_historial: boolean;
    motivo_anulacion: string | null;
    nombre_crea: string | null;
    fecha_creacion: string;
    n_adjuntos?: number;
    items?: Record<string, string>;
    otros?: string;
}

export interface AdjuntoPuestaMarcha { id_adjunto: number; documento: string; archivo_nombre: string; nombre_usuario: string | null; fecha: string; observacion?: string | null }
export interface PuestaMarchaDetalle extends PuestaMarcha {
    adjuntos: AdjuntoPuestaMarcha[];
    aviso_futuro: string;
    /** Por qué áreas puede firmar quien mira. */
    mis_areas?: Record<AreaPuestaMarcha, boolean>;
    /** Gestión de Calidad: puede editar, adjuntar y ver el registro interno (también ya aprobada). */
    puede_editar?: boolean;
    /** Si la parte que falta ya se envió a firmar a alguien, por rol. */
    asignaciones?: Partial<Record<AreaPuestaMarcha, { id_usuario_destino: number; nombre_destino: string; fecha_creacion: string }>>;
}

export interface FirmantesPuesta {
    areas: Record<AreaPuestaMarcha, boolean>;
    /** Muestreadores con competencias: firman por Medio Ambiente. */
    muestreadores: { id_muestreador: number; nombre: string; firma_registrada: boolean }[];
}

export interface UsuarioParaFirmar { id_usuario: number; nombre: string }

export interface FirmaPendientePuesta { id_puesta_marcha: number; codigo_equipo: string | null; nombre_equipo: string | null; nombre_crea: string | null; rol: AreaPuestaMarcha; fecha_creacion: string }

export interface PatronReferencia { id_equipo: number; codigo: string; nombre: string; tipoequipo: string; sede: string | null }

export interface RegistroInternoPuesta { fecha_registro: string; evento_tipo: string; descripcion_humana: string; nombre_usuario: string | null }

export interface EdicionPuestaMarcha {
    fecha?: string;
    estado_recepcion?: 'CUMPLE' | 'NO_CUMPLE';
    funcionamiento?: 'OPERATIVO' | 'NO_OPERATIVO';
    patron_referencia?: string;
    observacion?: string;
    motivo: string;
}

export interface DatosEquipoPuesta {
    equipo: { id_equipo: number; codigo: string; nombre: string; tipoequipo: string | null; sede: string | null; marca: string | null; modelo: string | null; n_serie: string | null; estado_equipo: string | null };
    verificaciones_temperatura: { id_verificacion: number; fecha: string; cumple: string | null; patron_codigo: string | null; patron_nombre: string | null }[];
    /** Verificaciones de caudal (OI-FoGe-30) con V°B° de esta sonda. */
    verificaciones_caudal?: { id_verificacion: number; fecha: string; cumple: boolean | null; equipo_referencia: string | null }[];
}

export interface NuevaPuestaMarcha {
    id_equipo: number;
    fecha: string;
    tipo: TipoPuestaMarcha;
    area_realiza: AreaPuestaMarcha;
    estado_recepcion: 'CUMPLE' | 'NO_CUMPLE';
    /** Lo elige quien registra; si no viene, sale del estado de recepción. */
    funcionamiento?: 'OPERATIVO' | 'NO_OPERATIVO';
    patron_referencia?: string;
    observacion: string;
    verificacion_tipo?: 'TEMPERATURA' | 'CAUDAL' | null;
    verificacion_id?: number | null;
    verificacion_codigo?: string;
    verificacion_fecha?: string;
    /** Opción elegida de cada ítem del OI-FoGe-42 (caja, embalaje, manual, cable, accesorios, interruptor, comandos, encendido). */
    items?: Record<string, string>;
    otros?: string;
}

export const puestaMarchaService = {
    listar: async (filtros: { id_equipo?: number; estado?: string; q?: string } = {}) =>
        (await apiClient.get(BASE, { params: filtros })).data.data as PuestaMarcha[],
    obtener: async (id: number) => (await apiClient.get(`${BASE}/${id}`)).data.data as PuestaMarchaDetalle,
    datosEquipo: async (idEquipo: number) => (await apiClient.get(`${BASE}/equipo/${idEquipo}/datos`)).data.data as DatosEquipoPuesta,
    crear: async (cuerpo: NuevaPuestaMarcha) => (await apiClient.post(BASE, cuerpo)).data.data as PuestaMarchaDetalle,
    firmantes: async () => (await apiClient.get(`${BASE}/firmantes`)).data.data as FirmantesPuesta,
    patrones: async () => (await apiClient.get(`${BASE}/patrones`)).data.data as PatronReferencia[],
    editar: async (id: number, cuerpo: EdicionPuestaMarcha) => (await apiClient.put(`${BASE}/${id}`, cuerpo)).data.data as PuestaMarchaDetalle,
    registroInterno: async (id: number) => (await apiClient.get(`${BASE}/${id}/registro-interno`)).data.data as RegistroInternoPuesta[],
    firmar: async (id: number, cuerpo: { rol: AreaPuestaMarcha; imagen?: string; usar_registrada?: boolean; id_muestreador?: number }) =>
        (await apiClient.post(`${BASE}/${id}/firmar`, cuerpo)).data.data as PuestaMarchaDetalle,
    /** Personas con el permiso para firmar por ese rol (Combobox de "Enviar a firmar"). */
    usuariosParaFirmar: async (rol: AreaPuestaMarcha) => (await apiClient.get(`${BASE}/usuarios-para-firmar`, { params: { rol } })).data.data as UsuarioParaFirmar[],
    /** Envía la parte que falta a una persona concreta: le llega como "Firmas pendientes". */
    enviarAFirmar: async (id: number, cuerpo: { rol: AreaPuestaMarcha; id_usuario_destino: number }) =>
        (await apiClient.post(`${BASE}/${id}/enviar-a-firmar`, cuerpo)).data.data as PuestaMarchaDetalle,
    /** Puestas en marcha que me enviaron a firmar y siguen pendientes. */
    firmasPendientes: async () => (await apiClient.get(`${BASE}/firmas-pendientes`)).data.data as FirmaPendientePuesta[],
    anular: async (id: number, motivo: string) => (await apiClient.post(`${BASE}/${id}/anular`, { motivo })).data.data as PuestaMarchaDetalle,
    adjuntar: async (id: number, documento: string, archivo: File, observacion?: string) => {
        const f = new FormData();
        f.append('documento', documento);
        if (observacion) f.append('observacion', observacion);
        f.append('archivo', archivo);
        return (await apiClient.post(`${BASE}/${id}/adjuntos`, f, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data as PuestaMarchaDetalle;
    },
    eliminarAdjunto: async (idAdjunto: number) => (await apiClient.delete(`${BASE}/adjuntos/${idAdjunto}`)).data.data as PuestaMarchaDetalle,
    /** Descarga el documento (con la sesión) y lo entrega para guardarlo. */
    descargarAdjunto: async (a: AdjuntoPuestaMarcha) => {
        const blob = (await apiClient.get(`${BASE}/adjuntos/${a.id_adjunto}`, { responseType: 'blob' })).data as Blob;
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = a.archivo_nombre;
        enlace.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
    /** El OI-FoGe-42 como quedaría con lo que se lleva llenado (no guarda nada). */
    vistaPreviaUrl: async (cuerpo: Partial<NuevaPuestaMarcha>) =>
        URL.createObjectURL((await apiClient.post(`${BASE}/vista-previa`, cuerpo, { responseType: 'blob' })).data as Blob),
    /** Cómo quedaría el formulario de una puesta en marcha guardada con los cambios de la edición. */
    vistaPreviaEdicionUrl: async (id: number, cambios: Partial<EdicionPuestaMarcha>) =>
        URL.createObjectURL((await apiClient.post(`${BASE}/${id}/vista-previa`, cambios, { responseType: 'blob' })).data as Blob),
    pdfUrl: async (id: number) => URL.createObjectURL((await apiClient.get(`${BASE}/${id}/pdf`, { responseType: 'blob' })).data as Blob),
};
