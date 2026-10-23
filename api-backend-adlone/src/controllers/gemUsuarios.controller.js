import rbacService from '../services/rbac.service.js';
import gemUsuariosService, { ROL_GEM } from '../services/gemUsuarios.service.js';
import auditService from '../services/audit.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

const actorId = (req) => req.user?.id || req.user?.id_usuario || 0;
const actorName = (req) => req.user?.nombre_usuario || req.user?.usuario || `ID:${actorId(req)}`;

// Deja operar solo sobre usuarios que ya pertenecen al rol GEM (id 20) — así el
// Jefe Técnico no puede, vía esta API acotada, tocar usuarios de otras áreas.
async function assertIsGemUser(res, userId) {
    const isGem = await gemUsuariosService.isGemUser(userId);
    if (!isGem) {
        errorResponse(res, 'Usuario fuera del área GEM', 403);
        return false;
    }
    return true;
}

class GemUsuariosController {
    async getUsuarios(req, res) {
        try {
            const users = await gemUsuariosService.getGemUsuarios();
            return successResponse(res, users);
        } catch (error) {
            return errorResponse(res, 'Error al obtener usuarios GEM', 500);
        }
    }

    async createUsuario(req, res) {
        try {
            const { nombre_usuario, nombre_real, correo_electronico, id_cargo, clave_usuario } = req.body;

            if (!nombre_usuario || !nombre_real || !clave_usuario) {
                return errorResponse(res, 'Nombre de usuario, nombre real y contraseña son requeridos', 400);
            }
            if (clave_usuario.length < 6) {
                return errorResponse(res, 'La contraseña debe tener al menos 6 caracteres', 400);
            }

            const user = await rbacService.createUser({ nombre_usuario, nombre_real, correo_electronico, id_cargo, clave_usuario });
            await rbacService.assignRolesToUser(user.id_usuario, [ROL_GEM]);

            auditService.log({
                usuario_id: actorId(req),
                area_key: 'medio_ambiente',
                modulo_nombre: 'Usuarios GEM',
                evento_tipo: 'GEM_USER_CREATE',
                entidad_nombre: 'mae_usuario',
                entidad_id: user.id_usuario,
                descripcion_humana: `${actorName(req)} creó el usuario GEM "${nombre_usuario}" (${nombre_real})`,
                datos_nuevos: { nombre_usuario, nombre_real, correo_electronico, id_cargo },
                severidad: 1
            });

            return successResponse(res, user, 'Usuario creado exitosamente');
        } catch (error) {
            if (error.code === 'DUPLICATE_USERNAME') return errorResponse(res, 'El nombre de usuario ya está en uso', 409);
            if (error.code === 'DUPLICATE_EMAIL') return errorResponse(res, 'El correo electrónico ya está en uso', 409);
            return errorResponse(res, 'Error al crear usuario', 500);
        }
    }

    async updateUsuario(req, res) {
        try {
            const { id } = req.params;
            if (!(await assertIsGemUser(res, id))) return;

            const { nombre_usuario, nombre_real, correo_electronico, id_cargo } = req.body;
            const previous = await rbacService.getUserById(id);

            await rbacService.updateUser(id, { nombre_usuario, nombre_real, correo_electronico, id_cargo });

            auditService.log({
                usuario_id: actorId(req),
                area_key: 'medio_ambiente',
                modulo_nombre: 'Usuarios GEM',
                evento_tipo: 'GEM_USER_UPDATE',
                entidad_nombre: 'mae_usuario',
                entidad_id: id,
                descripcion_humana: `${actorName(req)} actualizó los datos del usuario GEM "${previous?.nombre_usuario || id}"`,
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

    async updatePassword(req, res) {
        try {
            const { id } = req.params;
            if (!(await assertIsGemUser(res, id))) return;

            const { new_password } = req.body;
            if (!new_password) return errorResponse(res, 'Nueva contraseña es requerida', 400);
            if (new_password.length < 6) return errorResponse(res, 'La contraseña debe tener al menos 6 caracteres', 400);

            const targetUser = await rbacService.getUserById(id);
            await rbacService.updateUserPassword(id, new_password);

            auditService.log({
                usuario_id: actorId(req),
                area_key: 'medio_ambiente',
                modulo_nombre: 'Usuarios GEM',
                evento_tipo: 'PASSWORD_RESET',
                entidad_nombre: 'mae_usuario',
                entidad_id: id,
                descripcion_humana: `${actorName(req)} restableció la contraseña del usuario GEM "${targetUser?.nombre_usuario || id}"`,
                severidad: 2
            });

            return successResponse(res, null, 'Contraseña actualizada exitosamente');
        } catch (error) {
            return errorResponse(res, 'Error al actualizar contraseña', 500);
        }
    }

    async toggleStatus(req, res) {
        try {
            const { id } = req.params;
            if (!(await assertIsGemUser(res, id))) return;

            const { habilitado } = req.body;
            const requestingUserId = actorId(req);
            if (!habilitado && String(requestingUserId) === String(id)) {
                return errorResponse(res, 'No puedes deshabilitar tu propia cuenta', 403);
            }

            const targetUser = await rbacService.getUserById(id);
            await rbacService.toggleUserStatus(id, habilitado);

            auditService.log({
                usuario_id: requestingUserId,
                area_key: 'medio_ambiente',
                modulo_nombre: 'Usuarios GEM',
                evento_tipo: habilitado ? 'GEM_USER_ENABLE' : 'GEM_USER_DISABLE',
                entidad_nombre: 'mae_usuario',
                entidad_id: id,
                descripcion_humana: `${actorName(req)} ${habilitado ? 'habilitó' : 'deshabilitó'} al usuario GEM "${targetUser?.nombre_usuario || id}"`,
                datos_anteriores: { habilitado: habilitado ? 'N' : 'S' },
                datos_nuevos: { habilitado: habilitado ? 'S' : 'N' },
                severidad: habilitado ? 1 : 2
            });

            return successResponse(res, null, `Usuario ${habilitado ? 'habilitado' : 'deshabilitado'} exitosamente`);
        } catch (error) {
            return errorResponse(res, 'Error al cambiar estado del usuario', 500);
        }
    }

    async getEmpresas(req, res) {
        try {
            const { id } = req.params;
            if (!(await assertIsGemUser(res, id))) return;

            const empresas = await gemUsuariosService.getEmpresasAsignadas(id);
            return successResponse(res, empresas);
        } catch (error) {
            return errorResponse(res, 'Error al obtener empresas asignadas', 500);
        }
    }

    async setEmpresas(req, res) {
        try {
            const { id } = req.params;
            if (!(await assertIsGemUser(res, id))) return;

            const { empresaIds } = req.body;
            if (!Array.isArray(empresaIds)) return errorResponse(res, 'empresaIds must be an array', 400);

            await gemUsuariosService.setEmpresasAsignadas(id, empresaIds, actorId(req));

            auditService.log({
                usuario_id: actorId(req),
                area_key: 'medio_ambiente',
                modulo_nombre: 'Usuarios GEM',
                evento_tipo: 'GEM_USER_EMPRESAS_ASSIGN',
                entidad_nombre: 'mae_usuario',
                entidad_id: id,
                descripcion_humana: `${actorName(req)} actualizó las empresas a cargo del usuario GEM ID:${id}`,
                datos_nuevos: { empresa_ids: empresaIds },
                severidad: 1
            });

            return successResponse(res, null, 'Empresas asignadas exitosamente');
        } catch (error) {
            return errorResponse(res, 'Error al asignar empresas', 500);
        }
    }
}

export default new GemUsuariosController();
