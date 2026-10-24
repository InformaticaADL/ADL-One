import apiClient from '../config/axios.config';

export type EstadoSolicitudCliente = 'recibida' | 'en_revision' | 'respondida' | 'cerrada';

export interface SolicitudClienteResumen {
    id: number;
    asunto: string;
    estado: EstadoSolicitudCliente;
    creada_en: string;
    actualizada_en: string;
    id_cliente: number;
    cliente_nombre: string;
    solicitante_nombre: string;
    solicitante_email?: string | null;
    responsable_nombre: string | null;
    id_empresa: number;
    area: 'LAB' | 'MAM';
    /** Códigos de los casos a los que se refiere la solicitud, separados por coma. */
    casos?: string | null;
}

export interface SolicitudClienteMensaje {
    id: number;
    es_adl: number;
    texto: string;
    creado_en: string;
    autor_externo: string | null;
    autor_externo_email: string | null;
    autor_nombre: string;
}

export interface SolicitudClienteReferencia {
    id: number;
    id_caso: number | null;
    id_documento: number | null;
    caso_codigo: string | null;
    documento_nombre: string | null;
    documento_nombre_original: string | null;
    documento_disponible: number;
}

export interface SolicitudClienteDetalle {
    id: number;
    asunto: string;
    estado: EstadoSolicitudCliente;
    creada_en: string;
    actualizada_en?: string;
    id_cliente: number;
    cliente_nombre: string;
    solicitante_nombre?: string | null;
    solicitante_email?: string | null;
    responsable_nombre?: string | null;
    referencias: SolicitudClienteReferencia[];
    mensajes: SolicitudClienteMensaje[];
}

export const solicitudesClientesService = {
    async listar(): Promise<SolicitudClienteResumen[]> {
        const response = await apiClient.get('/api/solicitudes-clientes');
        return response.data.data;
    },

    async detalle(id: number): Promise<SolicitudClienteDetalle> {
        const response = await apiClient.get(`/api/solicitudes-clientes/${id}`);
        return response.data.data;
    },

    async responder(id: number, texto: string): Promise<void> {
        await apiClient.post(`/api/solicitudes-clientes/${id}/mensajes`, { texto });
    },

    async cambiarEstado(id: number, estado: EstadoSolicitudCliente): Promise<void> {
        await apiClient.patch(`/api/solicitudes-clientes/${id}/estado`, { estado });
    },

    async tomar(id: number): Promise<void> {
        await apiClient.post(`/api/solicitudes-clientes/${id}/tomar`);
    },
};

export default solicitudesClientesService;
