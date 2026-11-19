import apiClient from '../../../config/axios.config';

// Fichas de equipo enviadas a firmar (Solicitudes > Firmas pendientes). Quien las prepara las revisa y las envía;
// quien debe firmar las ve sin opción de guardarlas, y firma dibujando, con su firma registrada o con el celular.

const BASE = '/api/firmas-fichas';

export type EstadoFichaFirma = 'PENDIENTE' | 'COMPLETA' | 'CANCELADA';

export interface FirmanteFicha { rol: 'ENTREGA' | 'RESPONSABLE_AREA'; nombre: string; cargo: string | null; estado: 'PENDIENTE' | 'FIRMADA'; modo?: string | null; fecha_firma?: string | null }

export interface FirmaPendiente {
    id_ficha_firma: number;
    tipo_ficha: string;
    codigo_equipo: string | null;
    nombre_equipo: string | null;
    nombre_crea: string | null;
    fecha_creacion: string;
    rol: 'ENTREGA' | 'RESPONSABLE_AREA';
    /** Todos sus cargos en la ficha (puede ser responsable de entrega y de área a la vez). */
    roles: ('ENTREGA' | 'RESPONSABLE_AREA')[];
    firmadas: number;
    total: number;
}

export interface FichaFirmaEnviada {
    id_ficha_firma: number;
    tipo_ficha: string;
    codigo_equipo: string | null;
    nombre_equipo: string | null;
    estado: EstadoFichaFirma;
    fecha_creacion: string;
    fecha_completa: string | null;
    id_documento: number | null;
    motivo_cancelacion: string | null;
    firmantes: FirmanteFicha[];
}

export interface DetalleFichaFirma {
    id_ficha_firma: number;
    tipo_ficha: string;
    estado: EstadoFichaFirma;
    codigo_equipo: string | null;
    nombre_equipo: string | null;
    nombre_crea: string | null;
    fecha_creacion: string;
    fecha_completa: string | null;
    id_documento: number | null;
    motivo_cancelacion: string | null;
    es_creador: boolean;
    puede_firmar: boolean;
    mi_rol: 'ENTREGA' | 'RESPONSABLE_AREA' | null;
    mis_roles: ('ENTREGA' | 'RESPONSABLE_AREA')[];
    /** Quien firma como responsable de entrega debe pedir también la firma de quien recibe el equipo. */
    requiere_firma_equipo: boolean;
    responsable_equipo: string;
    fecha_entrega: string;
    observaciones: string;
    firmantes: FirmanteFicha[];
}

export interface SesionQrFirma { token: string; url: string; qr: string; expira: string }
export interface EstadoQrFirma { estado: 'pendiente' | 'completo'; expira: string; slots: { id: string; firmada: boolean; firma: string | null }[] }

export const fichaFirmaService = {
    /** Envía la ficha de entrega a firmar. `datos` = lo del formulario (sin las firmas de entrega y de área). */
    crear: async (datos: Record<string, unknown>) => (await apiClient.post(BASE, datos)).data.data as { id_ficha_firma: number },
    pendientes: async () => (await apiClient.get(`${BASE}/pendientes`)).data.data as FirmaPendiente[],
    contar: async () => (await apiClient.get(`${BASE}/pendientes/contar`)).data.data.total as number,
    enviadas: async () => (await apiClient.get(`${BASE}/enviadas`)).data.data as FichaFirmaEnviada[],
    obtener: async (id: number) => (await apiClient.get(`${BASE}/${id}`)).data.data as DetalleFichaFirma,
    /** El PDF se baja con el token y se muestra con una url local (solo para ver). */
    pdfUrl: async (id: number) => URL.createObjectURL((await apiClient.get(`${BASE}/${id}/pdf`, { responseType: 'blob' })).data as Blob),
    /** La ficha como quedaría con las firmas que se están poniendo (sin guardarlas). */
    vistaPreviaUrl: async (id: number, cuerpo: { imagen?: string; usar_registrada?: boolean; imagen_equipo?: string }) =>
        URL.createObjectURL((await apiClient.post(`${BASE}/${id}/vista-previa`, cuerpo, { responseType: 'blob' })).data as Blob),
    firmar: async (id: number, cuerpo: { imagen?: string; usar_registrada?: boolean; imagen_equipo?: string }) =>
        (await apiClient.post(`${BASE}/${id}/firmar`, cuerpo)).data.data as { completa: boolean; faltan: number; error?: string },
    /** QR para dibujar la firma del Perfil desde el celular. */
    crearQrPerfil: async () => (await apiClient.post(`${BASE}/perfil/qr`)).data.data as SesionQrFirma,
    /** `slots` dice cuáles firmas ya están hechas en la pantalla: en el celular quedan en gris. */
    crearQr: async (id: number, slots: { id: string; firmada?: boolean }[] = []) => (await apiClient.post(`${BASE}/${id}/qr`, { slots })).data.data as SesionQrFirma,
    estadoQr: async (token: string) => (await apiClient.get(`${BASE}/qr/${token}`)).data.data as EstadoQrFirma,
    cancelar: async (id: number, motivo: string) => { await apiClient.post(`${BASE}/${id}/cancelar`, { motivo }); },
};
