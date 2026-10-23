import apiClient from '../config/axios.config';

export interface VerificadorSolicitud {
    id: number;
    id_usuario: number;
    nombre_usuario: string;
    asignado_en: string;
}

export const verificadorSolicitudesService = {
    async listar(): Promise<VerificadorSolicitud[]> {
        const response = await apiClient.get('/api/verificadores-solicitudes');
        return response.data.data;
    },

    async agregar(idUsuario: number): Promise<void> {
        await apiClient.post('/api/verificadores-solicitudes', { id_usuario: idUsuario });
    },

    async quitar(id: number): Promise<void> {
        await apiClient.delete(`/api/verificadores-solicitudes/${id}`);
    },
};

export default verificadorSolicitudesService;
