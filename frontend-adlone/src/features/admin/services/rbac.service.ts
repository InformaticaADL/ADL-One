import axios from 'axios';
import API_CONFIG from '../../../config/api.config';

// Define Types
export interface Role {
    id_rol: number;
    nombre_rol: string;
    descripcion: string;
    estado: boolean;
}

export interface Permission {
    id_permiso: number;
    codigo: string;
    nombre: string;
    modulo: string;
    submodulo: string;
    tipo: string;
}

export interface User {
    id_usuario: number;
    nombre_usuario: string;
    nombre_real: string;
    correo_electronico?: string;
    habilitado?: string;
}

export interface CreateUserData {
    nombre_usuario: string;
    nombre_real: string;
    correo_electronico?: string;
    clave_usuario: string;
}

export interface UpdateUserData {
    nombre_usuario: string;
    nombre_real: string;
    correo_electronico?: string;
}

class RbacService {
    // Helper to get headers
    private getConfig() {
        const token = sessionStorage.getItem('token');
        return {
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json'
            }
        };
    }

    // === Roles ===
    async getRoles(): Promise<Role[]> {
        const response = await axios.get(`${API_CONFIG.getBaseURL()}/api/rbac/roles`, this.getConfig());
        return response.data.data;
    }

    async createRole(nombre: string, descripcion: string): Promise<Role> {
        const response = await axios.post(`${API_CONFIG.getBaseURL()}/api/rbac/roles`, {
            nombre,
            descripcion
        }, this.getConfig());
        return response.data.data;
    }

    // === Permissions ===
    async getAllPermissions(): Promise<Permission[]> {
        const response = await axios.get(`${API_CONFIG.getBaseURL()}/api/rbac/permissions`, this.getConfig());
        return response.data.data;
    }

    // === Role-Permissions ===
    async getRolePermissions(roleId: number): Promise<Permission[]> {
        const response = await axios.get(`${API_CONFIG.getBaseURL()}/api/rbac/roles/${roleId}/permissions`, this.getConfig());
        return response.data.data;
    }

    async assignPermissionsToRole(roleId: number, permissionIds: number[]): Promise<void> {
        await axios.post(`${API_CONFIG.getBaseURL()}/api/rbac/roles/${roleId}/permissions`, {
            permissionIds
        }, this.getConfig());
    }

    // === Users ===
    async getUsers(): Promise<User[]> {
        const response = await axios.get(`${API_CONFIG.getBaseURL()}/api/rbac/users`, this.getConfig());
        return response.data.data;
    }

    // === User-Roles ===
    async getUserRoles(userId: number): Promise<Role[]> {
        const response = await axios.get(`${API_CONFIG.getBaseURL()}/api/rbac/users/${userId}/roles`, this.getConfig());
        return response.data.data;
    }

    async assignRolesToUser(userId: number, roleIds: number[]): Promise<void> {
        await axios.post(`${API_CONFIG.getBaseURL()}/api/rbac/users/${userId}/roles`, {
            roleIds
        }, this.getConfig());
    }

    async getUsersByRole(roleId: number): Promise<User[]> {
        const response = await axios.get(`${API_CONFIG.getBaseURL()}/api/rbac/roles/${roleId}/users`, this.getConfig());
        return response.data.data;
    }

    // === User CRUD ===
    async getAllUsersWithStatus(): Promise<User[]> {
        const response = await axios.get(`${API_CONFIG.getBaseURL()}/api/rbac/users/all`, this.getConfig());
        return response.data.data;
    }

    async createUser(userData: CreateUserData): Promise<User> {
        const response = await axios.post(`${API_CONFIG.getBaseURL()}/api/rbac/users/create`, userData, this.getConfig());
        return response.data.data;
    }

    async updateUser(userId: number, userData: UpdateUserData): Promise<void> {
        await axios.put(`${API_CONFIG.getBaseURL()}/api/rbac/users/${userId}`, userData, this.getConfig());
    }

    async updateUserPassword(userId: number, newPassword: string): Promise<void> {
        await axios.put(`${API_CONFIG.getBaseURL()}/api/rbac/users/${userId}/password`, {
            new_password: newPassword
        }, this.getConfig());
    }

    async toggleUserStatus(userId: number, habilitado: boolean): Promise<void> {
        await axios.put(`${API_CONFIG.getBaseURL()}/api/rbac/users/${userId}/status`, {
            habilitado
        }, this.getConfig());
    }
}

export const rbacService = new RbacService();
