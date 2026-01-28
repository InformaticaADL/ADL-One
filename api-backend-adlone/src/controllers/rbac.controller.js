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
}

export default new RbacController();
