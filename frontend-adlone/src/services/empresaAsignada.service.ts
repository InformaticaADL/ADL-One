import apiClient from '../config/axios.config';

export interface EmpresaAsignada {
    id: number;
    id_usuario: number;
    nombre_usuario: string;
    id_empresa: number;
    nombre_empresa: string | null;
    area: 'LAB' | 'MAM';
    asignado_en: string;
}

export interface EmpresaCatalogo {
    id_empresa: number;
    nombre_empresa: string;
}

export const empresaAsignadaService = {
    async listarTodas(): Promise<EmpresaAsignada[]> {
        const response = await apiClient.get('/api/empresas-asignadas');
        return response.data.data;
    },

    async asignar(idUsuario: number, idEmpresa: number, area: 'LAB' | 'MAM'): Promise<void> {
        await apiClient.post('/api/empresas-asignadas', { id_usuario: idUsuario, id_empresa: idEmpresa, area });
    },

    async quitar(id: number): Promise<void> {
        await apiClient.delete(`/api/empresas-asignadas/${id}`);
    },

    // Acotado a empresas con cliente activo en WebClientesV2 (no el catálogo completo del LIMS).
    async empresas(): Promise<EmpresaCatalogo[]> {
        const response = await apiClient.get('/api/empresas-asignadas/catalogo-portal');
        return response.data.data;
    },
};

export default empresaAsignadaService;
