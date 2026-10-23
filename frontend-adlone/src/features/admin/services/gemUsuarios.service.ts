import apiClient from '../../../config/axios.config';
import type { User, CreateUserData, UpdateUserData } from './rbac.service';

export interface EmpresaAsignada {
    id_empresa: number;
    nombre_empresa: string;
}

class GemUsuariosService {
    async getUsuarios(): Promise<User[]> {
        const response = await apiClient.get('/api/admin/gem-usuarios');
        return response.data.data;
    }

    async createUsuario(userData: CreateUserData): Promise<User> {
        const response = await apiClient.post('/api/admin/gem-usuarios', userData);
        return response.data.data;
    }

    async updateUsuario(userId: number, userData: UpdateUserData): Promise<void> {
        await apiClient.put(`/api/admin/gem-usuarios/${userId}`, userData);
    }

    async updatePassword(userId: number, newPassword: string): Promise<void> {
        await apiClient.put(`/api/admin/gem-usuarios/${userId}/password`, { new_password: newPassword });
    }

    async toggleStatus(userId: number, habilitado: boolean): Promise<void> {
        await apiClient.put(`/api/admin/gem-usuarios/${userId}/status`, { habilitado });
    }

    async getEmpresas(userId: number): Promise<EmpresaAsignada[]> {
        const response = await apiClient.get(`/api/admin/gem-usuarios/${userId}/empresas`);
        return response.data.data;
    }

    async setEmpresas(userId: number, empresaIds: number[]): Promise<void> {
        await apiClient.put(`/api/admin/gem-usuarios/${userId}/empresas`, { empresaIds });
    }
}

export const gemUsuariosService = new GemUsuariosService();
