import apiClient from '../config/axios.config';

export interface SolicitudClienteResumen {
    id: number;
    asunto: string;
    estado: 'recibida' | 'en_revision' | 'respondida' | 'cerrada';
    creada_en: string;
    actualizada_en: string;
    id_cliente: number;
    cliente_nombre: string;
    solicitante_nombre: string;
    responsable_nombre: string | null;
    id_empresa: number;
    area: 'LAB' | 'MAM';
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

export interface SolicitudClienteDetalle {
    id: number;
    asunto: string;
    estado: SolicitudClienteResumen['estado'];
    creada_en: string;
    id_cliente: number;
    cliente_nombre: string;
    referencias: any[];
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

    async cambiarEstado(id: number, estado: SolicitudClienteResumen['estado']): Promise<void> {
        await apiClient.patch(`/api/solicitudes-clientes/${id}/estado`, { estado });
    },

    async tomar(id: number): Promise<void> {
        await apiClient.post(`/api/solicitudes-clientes/${id}/tomar`);
    },
};

export default solicitudesClientesService;
