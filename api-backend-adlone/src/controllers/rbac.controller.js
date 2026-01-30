import rbacService from '../services/rbac.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

class RbacController {
    // === Roles ===
    async getRoles(req, res) {
        try {
            const roles = await rbacService.getAllRoles();
            return successResponse(res, roles);
        } catch (error) {
            return errorResponse(res, 'Error fetching roles', 500);
        }
    }

    async createRole(req, res) {
        try {
            const { nombre, descripcion } = req.body;
            if (!nombre) {
                return errorResponse(res, 'Role name is required', 400);
            }
            const role = await rbacService.createRole(nombre, descripcion);
            return successResponse(res, role, 'Role created successfully');
        } catch (error) {
            return errorResponse(res, 'Error creating role', 500);
        }
    }

    // === Permissions ===
    async getPermissions(req, res) {
        try {
            const permissions = await rbacService.getAllPermissions();
            return successResponse(res, permissions);
        } catch (error) {
            return errorResponse(res, 'Error fetching permissions', 500);
        }
    }

    // === Role-Permission Assignment ===
    async getRolePermissions(req, res) {
        try {
            const { roleId } = req.params;
            const permissions = await rbacService.getRolePermissions(roleId);
            return successResponse(res, permissions);
        } catch (error) {
            return errorResponse(res, 'Error fetching role permissions', 500);
        }
    }

    async assignPermissions(req, res) {
        try {
            const { roleId } = req.params;
            const { permissionIds } = req.body; // Array of IDs

            if (!Array.isArray(permissionIds)) {
                return errorResponse(res, 'permissionIds must be an array', 400);
            }

            await rbacService.assignPermissionsToRole(roleId, permissionIds);
            return successResponse(res, null, 'Permissions assigned successfully');
        } catch (error) {
            return errorResponse(res, 'Error assigning permissions', 500);
        }
    }

    // === User-Role Assignment ===
    async getUsers(req, res) {
        try {
            const users = await rbacService.getAllUsers();
            return successResponse(res, users);
        } catch (error) {
            return errorResponse(res, 'Error fetching users', 500);
        }
    }

    async getUserRoles(req, res) {
        try {
            const { userId } = req.params;
            const roles = await rbacService.getUserRoles(userId);
            return successResponse(res, roles);
        } catch (error) {
            return errorResponse(res, 'Error fetching user roles', 500);
        }
    }

    async assignRoles(req, res) {
        try {
            const { userId } = req.params;
            const { roleIds } = req.body; // Array of IDs

            if (!Array.isArray(roleIds)) {
                return errorResponse(res, 'roleIds must be an array', 400);
            }

            await rbacService.assignRolesToUser(userId, roleIds);
            return successResponse(res, null, 'Roles assigned successfully');
        } catch (error) {
            return errorResponse(res, 'Error assigning user roles', 500);
        }
    }

    async getUsersByRole(req, res) {
        try {
            const { roleId } = req.params;
            const users = await rbacService.getUsersByRole(roleId);
            return successResponse(res, users);
        } catch (error) {
            return errorResponse(res, 'Error fetching users by role', 500);
        }
    }

    // === User CRUD ===
    async getAllUsersWithStatus(req, res) {
        try {
            const users = await rbacService.getAllUsersWithStatus();
            return successResponse(res, users);
        } catch (error) {
            return errorResponse(res, 'Error fetching users', 500);
        }
    }

    async createUser(req, res) {
        try {
            const { nombre_usuario, nombre_real, correo_electronico, mam_cargo, clave_usuario } = req.body;

            if (!nombre_usuario || !nombre_real || !clave_usuario) {
                return errorResponse(res, 'Nombre de usuario, nombre real y contraseña son requeridos', 400);
            }

            const user = await rbacService.createUser({
                nombre_usuario,
                nombre_real,
                correo_electronico,
                mam_cargo,
                clave_usuario
            });

            return successResponse(res, user, 'Usuario creado exitosamente');
        } catch (error) {
            return errorResponse(res, 'Error creating user', 500);
        }
    }

    async updateUser(req, res) {
        try {
            const { userId } = req.params;
            const { nombre_usuario, nombre_real, correo_electronico, mam_cargo } = req.body;

            await rbacService.updateUser(userId, {
                nombre_usuario,
                nombre_real,
                correo_electronico,
                mam_cargo
            });

            return successResponse(res, null, 'Usuario actualizado exitosamente');
        } catch (error) {
            return errorResponse(res, 'Error updating user', 500);
        }
    }

    async updateUserPassword(req, res) {
        try {
            const { userId } = req.params;
            const { new_password } = req.body;

            if (!new_password) {
                return errorResponse(res, 'Nueva contraseña es requerida', 400);
            }

            await rbacService.updateUserPassword(userId, new_password);
            return successResponse(res, null, 'Contraseña actualizada exitosamente');
        } catch (error) {
            return errorResponse(res, 'Error updating password', 500);
        }
    }

    async toggleUserStatus(req, res) {
        try {
            const { userId } = req.params;
            const { habilitado } = req.body;

            await rbacService.toggleUserStatus(userId, habilitado);
            return successResponse(res, null, `Usuario ${habilitado ? 'habilitado' : 'deshabilitado'} exitosamente`);
        } catch (error) {
            return errorResponse(res, 'Error toggling user status', 500);
        }
    }
}

export default new RbacController();
