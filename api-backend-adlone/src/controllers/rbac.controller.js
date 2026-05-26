import rbacService from '../services/rbac.service.js';
import auditService from '../services/audit.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

const actorId = (req) => req.user?.id || req.user?.id_usuario || 0;
const actorName = (req) => req.user?.nombre_usuario || req.user?.usuario || `ID:${actorId(req)}`;

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
            if (!nombre) return errorResponse(res, 'El nombre del rol es requerido', 400);

            const role = await rbacService.createRole(nombre, descripcion);

            auditService.log({
                usuario_id: actorId(req),
                area_key: 'it',
                modulo_nombre: 'Administración RBAC',
                evento_tipo: 'ROLE_CREATE',
                entidad_nombre: 'mae_rol',
                entidad_id: role.id_rol,
                descripcion_humana: `${actorName(req)} creó el rol "${nombre}"`,
                datos_nuevos: { nombre, descripcion },
                severidad: 1
            });

            return successResponse(res, role, 'Rol creado exitosamente');
        } catch (error) {
            return errorResponse(res, 'Error al crear rol', 500);
        }
    }

    async updateRole(req, res) {
        try {
            const { roleId } = req.params;
            const { nombre, descripcion } = req.body;
            if (!nombre) return errorResponse(res, 'El nombre del rol es requerido', 400);

            const previousRoles = await rbacService.getAllRoles();
            const previous = previousRoles.find(r => String(r.id_rol) === String(roleId));

            await rbacService.updateRole(roleId, nombre, descripcion);

            auditService.log({
                usuario_id: actorId(req),
                area_key: 'it',
                modulo_nombre: 'Administración RBAC',
                evento_tipo: 'ROLE_UPDATE',
                entidad_nombre: 'mae_rol',
                entidad_id: roleId,
                descripcion_humana: `${actorName(req)} actualizó el rol "${previous?.nombre_rol || roleId}"`,
                datos_anteriores: previous ? { nombre: previous.nombre_rol, descripcion: previous.descripcion } : null,
                datos_nuevos: { nombre, descripcion },
                severidad: 1
            });

            return successResponse(res, null, 'Rol actualizado exitosamente');
        } catch (error) {
            return errorResponse(res, 'Error al actualizar rol', 500);
        }
    }

    // RB-09: contar usuarios asociados al rol
    async getRoleUsersCount(req, res) {
        try {
            const { roleId } = req.params;
            const data = await rbacService.getRoleUsersCount(roleId);
            return successResponse(res, data);
        } catch (err) {
            logger.error('Error in getRoleUsersCount:', err);
            return errorResponse(res, 'Error al consultar usuarios del rol', 500);
        }
    }

    async toggleRoleStatus(req, res) {
        try {
            const { roleId } = req.params;
            const { estado } = req.body;

            const roles = await rbacService.getAllRoles();
            const role = roles.find(r => String(r.id_rol) === String(roleId));

            await rbacService.toggleRoleStatus(roleId, estado);

            auditService.log({
                usuario_id: actorId(req),
                area_key: 'it',
                modulo_nombre: 'Administración RBAC',
                evento_tipo: estado ? 'ROLE_ENABLE' : 'ROLE_DISABLE',
                entidad_nombre: 'mae_rol',
                entidad_id: roleId,
                descripcion_humana: `${actorName(req)} ${estado ? 'activó' : 'desactivó'} el rol "${role?.nombre_rol || roleId}"`,
                datos_nuevos: { estado },
                severidad: estado ? 1 : 2
            });

            return successResponse(res, null, `Rol ${estado ? 'activado' : 'desactivado'} exitosamente`);
        } catch (error) {
            return errorResponse(res, 'Error al cambiar estado del rol', 500);
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
            const { permissionIds } = req.body;

            if (!Array.isArray(permissionIds)) {
                return errorResponse(res, 'permissionIds must be an array', 400);
            }

            // Capture previous permissions for audit diff
            const previousPerms = await rbacService.getRolePermissions(roleId);
            const previousIds = previousPerms.map(p => p.id_permiso);

            await rbacService.assignPermissionsToRole(roleId, permissionIds);

            const roles = await rbacService.getAllRoles();
            const role = roles.find(r => String(r.id_rol) === String(roleId));

            auditService.log({
                usuario_id: actorId(req),
                area_key: 'it',
                modulo_nombre: 'Administración RBAC',
                evento_tipo: 'ROLE_PERMISSIONS_UPDATE',
                entidad_nombre: 'mae_rol',
                entidad_id: roleId,
                descripcion_humana: `${actorName(req)} actualizó los permisos del rol "${role?.nombre_rol || roleId}" (${previousIds.length} → ${permissionIds.length} permisos)`,
                datos_anteriores: { permission_ids: previousIds },
                datos_nuevos: { permission_ids: permissionIds },
                severidad: 2
            });

            return successResponse(res, null, 'Permisos asignados exitosamente');
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
            const { roleIds } = req.body;

            if (!Array.isArray(roleIds)) {
                return errorResponse(res, 'roleIds must be an array', 400);
            }

            // Capture previous roles for audit diff
            const previousRoles = await rbacService.getUserRoles(userId);
            const previousIds = previousRoles.map(r => r.id_rol);

            const sorted = arr => [...arr].sort((a, b) => a - b);
            if (JSON.stringify(sorted(previousIds)) === JSON.stringify(sorted(roleIds))) {
                return successResponse(res, null, 'Sin cambios en roles');
            }

            await rbacService.assignRolesToUser(userId, roleIds);

            const targetUser = await rbacService.getUserById(userId);

            auditService.log({
                usuario_id: actorId(req),
                area_key: 'it',
                modulo_nombre: 'Administración RBAC',
                evento_tipo: 'USER_ROLES_ASSIGN',
                entidad_nombre: 'mae_usuario',
                entidad_id: userId,
                descripcion_humana: `${actorName(req)} modificó los roles de "${targetUser?.nombre_usuario || userId}"`,
                datos_anteriores: { role_ids: previousIds },
                datos_nuevos: { role_ids: roleIds },
                severidad: 2
            });

            return successResponse(res, null, 'Roles asignados exitosamente');
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
            const { nombre_usuario, nombre_real, correo_electronico, id_cargo, clave_usuario } = req.body;

            if (!nombre_usuario || !nombre_real || !clave_usuario) {
                return errorResponse(res, 'Nombre de usuario, nombre real y contraseña son requeridos', 400);
            }

            if (clave_usuario.length < 6) {
                return errorResponse(res, 'La contraseña debe tener al menos 6 caracteres', 400);
            }

            const user = await rbacService.createUser({
                nombre_usuario,
                nombre_real,
                correo_electronico,
                id_cargo,
                clave_usuario
            });

            auditService.log({
                usuario_id: actorId(req),
                area_key: 'it',
                modulo_nombre: 'Administración RBAC',
                evento_tipo: 'USER_CREATE',
                entidad_nombre: 'mae_usuario',
                entidad_id: user.id_usuario,
                descripcion_humana: `${actorName(req)} creó el usuario "${nombre_usuario}" (${nombre_real})`,
                datos_nuevos: { nombre_usuario, nombre_real, correo_electronico, id_cargo },
                severidad: 1
            });

            return successResponse(res, user, 'Usuario creado exitosamente');
        } catch (error) {
            if (error.code === 'DUPLICATE_USERNAME') {
                return errorResponse(res, 'El nombre de usuario ya está en uso', 409);
            }
            if (error.code === 'DUPLICATE_EMAIL') {
                return errorResponse(res, 'El correo electrónico ya está en uso', 409);
            }
            return errorResponse(res, 'Error al crear usuario', 500);
        }
    }

    async updateUser(req, res) {
        try {
            const { userId } = req.params;
            const { nombre_usuario, nombre_real, correo_electronico, id_cargo } = req.body;

            const previous = await rbacService.getUserById(userId);

            await rbacService.updateUser(userId, { nombre_usuario, nombre_real, correo_electronico, id_cargo });

            auditService.log({
                usuario_id: actorId(req),
                area_key: 'it',
                modulo_nombre: 'Administración RBAC',
                evento_tipo: 'USER_UPDATE',
                entidad_nombre: 'mae_usuario',
                entidad_id: userId,
                descripcion_humana: `${actorName(req)} actualizó los datos del usuario "${previous?.nombre_usuario || userId}"`,
                datos_anteriores: previous ? {
                    nombre_usuario: previous.nombre_usuario,
                    nombre_real: previous.nombre_real,
                    correo_electronico: previous.correo_electronico,
                    id_cargo: previous.id_cargo
                } : null,
                datos_nuevos: { nombre_usuario, nombre_real, correo_electronico, id_cargo },
                severidad: 1
            });

            return successResponse(res, null, 'Usuario actualizado exitosamente');
        } catch (error) {
            if (error.code === 'DUPLICATE_USERNAME') return errorResponse(res, 'El nombre de usuario ya está en uso', 409);
            if (error.code === 'DUPLICATE_EMAIL') return errorResponse(res, 'El correo electrónico ya está en uso', 409);
            return errorResponse(res, 'Error al actualizar usuario', 500);
        }
    }

    async updateUserPassword(req, res) {
        try {
            const { userId } = req.params;
            const { new_password } = req.body;

            if (!new_password) return errorResponse(res, 'Nueva contraseña es requerida', 400);
            if (new_password.length < 6) return errorResponse(res, 'La contraseña debe tener al menos 6 caracteres', 400);

            const targetUser = await rbacService.getUserById(userId);
            const adminId = actorId(req);

            await rbacService.updateUserPassword(userId, new_password);

            // Admin resetting someone else's password is higher severity than self-change
            const isSelfChange = String(adminId) === String(userId);
            auditService.log({
                usuario_id: adminId,
                area_key: 'it',
                modulo_nombre: 'Administración RBAC',
                evento_tipo: 'PASSWORD_RESET',
                entidad_nombre: 'mae_usuario',
                entidad_id: userId,
                descripcion_humana: isSelfChange
                    ? `El usuario "${targetUser?.nombre_usuario || userId}" cambió su propia contraseña (vía Admin)`
                    : `${actorName(req)} restableció la contraseña del usuario "${targetUser?.nombre_usuario || userId}"`,
                severidad: isSelfChange ? 1 : 2
            });

            return successResponse(res, null, 'Contraseña actualizada exitosamente');
        } catch (error) {
            return errorResponse(res, 'Error al actualizar contraseña', 500);
        }
    }

    async toggleUserStatus(req, res) {
        try {
            const { userId } = req.params;
            const { habilitado } = req.body;
            const requestingUserId = actorId(req);

            if (!habilitado && String(requestingUserId) === String(userId)) {
                return errorResponse(res, 'No puedes deshabilitar tu propia cuenta', 403);
            }

            const targetUser = await rbacService.getUserById(userId);
            await rbacService.toggleUserStatus(userId, habilitado);

            auditService.log({
                usuario_id: requestingUserId,
                area_key: 'it',
                modulo_nombre: 'Administración RBAC',
                evento_tipo: habilitado ? 'USER_ENABLE' : 'USER_DISABLE',
                entidad_nombre: 'mae_usuario',
                entidad_id: userId,
                descripcion_humana: `${actorName(req)} ${habilitado ? 'habilitó' : 'deshabilitó'} al usuario "${targetUser?.nombre_usuario || userId}"`,
                datos_anteriores: { habilitado: habilitado ? 'N' : 'S' },
                datos_nuevos: { habilitado: habilitado ? 'S' : 'N' },
                severidad: habilitado ? 1 : 2
            });

            return successResponse(res, null, `Usuario ${habilitado ? 'habilitado' : 'deshabilitado'} exitosamente`);
        } catch (error) {
            return errorResponse(res, 'Error al cambiar estado del usuario', 500);
        }
    }
}

export default new RbacController();
