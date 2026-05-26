import { Router } from 'express';
import rbacController from '../controllers/rbac.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';

const router = Router();

// All RBAC routes should be protected
// For now, assume only a SuperAdmin or user with 'RBAC_MANAGE' can access these.
// Since permissions are self-hosted, we might need an initial 'ADMIN_ACCESS' seeded.
// For the purpose of this implementation, we'll use authenticate + optional permission check.

router.use(authenticate);

// === Roles ===
router.get('/roles', rbacController.getRoles);
router.post('/roles', verifyPermission(['RBAC_MANAGE', 'INF_ROLES']), rbacController.createRole);
router.put('/roles/:roleId', verifyPermission(['RBAC_MANAGE', 'INF_ROLES']), rbacController.updateRole);
router.put('/roles/:roleId/status', verifyPermission(['RBAC_MANAGE', 'INF_ROLES']), rbacController.toggleRoleStatus);
// RB-09: cantidad de usuarios asociados al rol (para confirmar deshabilitación/eliminación)
router.get('/roles/:roleId/users-count', verifyPermission(['RBAC_MANAGE', 'INF_ROLES']), rbacController.getRoleUsersCount);

// === Permissions ===
router.get('/permissions', rbacController.getPermissions);

// === Role-Permission Assignment ===
router.get('/roles/:roleId/permissions', rbacController.getRolePermissions);
router.post('/roles/:roleId/permissions', verifyPermission(['RBAC_MANAGE', 'INF_ROLES']), rbacController.assignPermissions);

// === User-Role Assignment ===
router.get('/users', rbacController.getUsers);
router.get('/users/:userId/roles', rbacController.getUserRoles);
router.post('/users/:userId/roles', verifyPermission(['RBAC_MANAGE', 'INF_USUARIOS']), rbacController.assignRoles);

// GET /roles/:roleId/users - Get all users belonging to a role
router.get('/roles/:roleId/users', rbacController.getUsersByRole);

// === User CRUD ===
router.get('/users/all', rbacController.getAllUsersWithStatus);
router.post('/users/create', verifyPermission(['RBAC_MANAGE', 'INF_USUARIOS']), rbacController.createUser);
router.put('/users/:userId', verifyPermission(['RBAC_MANAGE', 'INF_USUARIOS']), rbacController.updateUser);
router.put('/users/:userId/password', verifyPermission(['RBAC_MANAGE', 'INF_USUARIOS']), rbacController.updateUserPassword);
router.put('/users/:userId/status', verifyPermission(['RBAC_MANAGE', 'INF_USUARIOS']), rbacController.toggleUserStatus);


export default router;
