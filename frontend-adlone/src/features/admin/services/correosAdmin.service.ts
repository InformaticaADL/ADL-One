import apiClient from '../../../config/axios.config';

export type MotivoNoRecibe = 'sin_acceso' | 'fuera_de_la_seleccion_del_rol' | 'silenciado';
export type CanalSilencio = 'EMAIL' | 'WEB' | 'TODOS';

export interface EventoCorreo {
    codigo: string;
    descripcion: string;
    es_transaccional: boolean;
    oculto: boolean;
    modulo: string;
}
export interface TipoSolicitud { id_tipo: number; nombre: string }
export interface PersonaDestino {
    id_usuario: number;
    nombre: string | null;
    recibe: boolean;
    email: boolean;
    web: boolean;
    motivo: MotivoNoRecibe | null;
}
export interface CanalesAviso { email: boolean; web: boolean }
export interface Silencio { id_usuario: number; codigo_evento: string | null; canal: CanalSilencio }
export interface MiembroRol { id_usuario: number; nombre: string; tiene_acceso: boolean | null; elegido: boolean }
export interface RolDelAviso { id_rol: number; nombre_rol: string; limitado: boolean; miembros: MiembroRol[] }
export interface AvisoDePersona {
    codigo_evento: string;
    descripcion: string;
    recibe: boolean;
    email: boolean;
    web: boolean;
    motivo: MotivoNoRecibe | null;
}

export const MOTIVO_TEXTO: Record<MotivoNoRecibe, string> = {
    sin_acceso: 'Sin acceso a la solicitud',
    fuera_de_la_seleccion_del_rol: 'No está entre las personas elegidas del rol',
    silenciado: 'Silenciado',
};

export const correosAdminService = {
    async getCatalogo(): Promise<{ eventos: EventoCorreo[]; tipos: TipoSolicitud[] }> {
        return (await apiClient.get('/api/notifications/events/catalogo')).data;
    },
    async getDestinatarios(codigo: string, idTipo?: number | null): Promise<{ personas: PersonaDestino[]; silencios: Silencio[]; canales: CanalesAviso }> {
        return (await apiClient.get(`/api/notifications/events/${codigo}/destinatarios`, { params: idTipo ? { idTipo } : {} })).data;
    },
    async getRoles(codigo: string, idTipo?: number | null): Promise<RolDelAviso[]> {
        return (await apiClient.get(`/api/notifications/events/${codigo}/roles`, { params: idTipo ? { idTipo } : {} })).data.roles;
    },
    async guardarLimiteDeRol(codigo: string, idRol: number, usuarios: number[]): Promise<void> {
        await apiClient.put(`/api/notifications/events/${codigo}/limites`, { id_rol: idRol, usuarios });
    },
    async getPersona(idUsuario: number): Promise<{ silencios: Silencio[]; eventos: AvisoDePersona[] }> {
        return (await apiClient.get(`/api/notifications/personas/${idUsuario}`)).data;
    },
    async guardarSilencio(idUsuario: number, codigoEvento: string | null, silenciarEmail: boolean, silenciarWeb: boolean): Promise<void> {
        await apiClient.put('/api/notifications/silencios', { id_usuario: idUsuario, codigo_evento: codigoEvento, silenciar_email: silenciarEmail, silenciar_web: silenciarWeb });
    },
};

/** ¿Qué canales tiene silenciados una persona en un evento? (también cuenta el silencio global, de todos los eventos) */
export function canalesSilenciados(silencios: Silencio[], idUsuario: number, codigo: string | null): { email: boolean; web: boolean } {
    let email = false; let web = false;
    for (const s of silencios) {
        if (s.id_usuario !== idUsuario) continue;
        if (s.codigo_evento !== null && s.codigo_evento !== codigo) continue;
        if (s.canal === 'TODOS' || s.canal === 'EMAIL') email = true;
        if (s.canal === 'TODOS' || s.canal === 'WEB') web = true;
    }
    return { email, web };
}
