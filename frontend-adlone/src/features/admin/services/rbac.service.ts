import apiClient from '../../../config/axios.config';

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
    // No longer need getConfig() - apiClient handles token automatically

    // === Roles ===
    async getRoles(): Promise<Role[]> {
        const response = await apiClient.get('/api/rbac/roles');
        return response.data.data;
    }

    async createRole(nombre: string, descripcion: string): Promise<Role> {
        const response = await apiClient.post('/api/rbac/roles', {
            nombre,
            descripcion
        });
        return response.data.data;
    }

    // === Permissions ===
    async getAllPermissions(): Promise<Permission[]> {
        const response = await apiClient.get('/api/rbac/permissions');
        return response.data.data;
    }

    // === Role-Permissions ===
    async getRolePermissions(roleId: number): Promise<Permission[]> {
        const response = await apiClient.get(`/api/rbac/roles/${roleId}/permissions`);
        return response.data.data;
    }

    async assignPermissionsToRole(roleId: number, permissionIds: number[]): Promise<void> {
        await apiClient.post(`/api/rbac/roles/${roleId}/permissions`, {
            permissionIds
        });
    }

    // === Users ===
    async getUsers(): Promise<User[]> {
        const response = await apiClient.get('/api/rbac/users');
        return response.data.data;
    }

    // === User-Roles ===
    async getUserRoles(userId: number): Promise<Role[]> {
        const response = await apiClient.get(`/api/rbac/users/${userId}/roles`);
        return response.data.data;
    }

    async assignRolesToUser(userId: number, roleIds: number[]): Promise<void> {
        await apiClient.post(`/api/rbac/users/${userId}/roles`, {
            roleIds
        });
    }

    async getUsersByRole(roleId: number): Promise<User[]> {
        const response = await apiClient.get(`/api/rbac/roles/${roleId}/users`);
        return response.data.data;
    }

    // === User CRUD ===
    async getAllUsersWithStatus(): Promise<User[]> {
        const response = await apiClient.get('/api/rbac/users/all');
        return response.data.data;
    }

    async createUser(userData: CreateUserData): Promise<User> {
        const response = await apiClient.post('/api/rbac/users/create', userData);
        return response.data.data;
    }

    async updateUser(userId: number, userData: UpdateUserData): Promise<void> {
        await apiClient.put(`/api/rbac/users/${userId}`, userData);
    }

    async updateUserPassword(userId: number, newPassword: string): Promise<void> {
        await apiClient.put(`/api/rbac/users/${userId}/password`, {
            new_password: newPassword
        });
    }

    async toggleUserStatus(userId: number, habilitado: boolean): Promise<void> {
        await apiClient.put(`/api/rbac/users/${userId}/status`, {
            habilitado
        });
    }
}

export const rbacService = new RbacService();
