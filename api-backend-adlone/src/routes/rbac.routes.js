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
router.post('/roles', rbacController.createRole); // Add verifyPermission('RBAC_MANAGE') later

// === Permissions ===
router.get('/permissions', rbacController.getPermissions);

// === Role-Permission Assignment ===
// GET /roles/1/permissions
router.get('/roles/:roleId/permissions', rbacController.getRolePermissions);
// POST /roles/1/permissions  { permissionIds: [1, 2, 3] }
router.post('/roles/:roleId/permissions', rbacController.assignPermissions);

// === User-Role Assignment ===
router.get('/users', rbacController.getUsers); // [NEW] List all users
// GET /users/1/roles
router.get('/users/:userId/roles', rbacController.getUserRoles);
// POST /users/1/roles { roleIds: [1, 2] }
router.post('/users/:userId/roles', rbacController.assignRoles);

// GET /roles/:roleId/users - Get all users belonging to a role
router.get('/roles/:roleId/users', rbacController.getUsersByRole);

// === User CRUD ===
router.get('/users/all', rbacController.getAllUsersWithStatus); // Get all users with status
router.post('/users/create', rbacController.createUser); // Create new user
router.put('/users/:userId', rbacController.updateUser); // Update user info
router.put('/users/:userId/password', rbacController.updateUserPassword); // Update password
router.put('/users/:userId/status', rbacController.toggleUserStatus); // Enable/disable user


export default router;
