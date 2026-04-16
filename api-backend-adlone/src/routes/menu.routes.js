import express from 'express';
import menuController from '../controllers/menu.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

import { verifyPermission } from '../middlewares/verifyPermission.js';

const router = express.Router();

// Public / Personal Menu
// GET /api/menu
router.get('/', authenticate, menuController.getDynamicMenu);

// Admin Menu Management Routes (Protected with INF_ACCESO)
const adminAuth = [authenticate, verifyPermission('INF_ACCESO')];

router.get('/admin/modulos', adminAuth, menuController.getAllAdminData);
router.post('/admin/modulos', adminAuth, menuController.createModulo);
router.put('/admin/modulos/:id', adminAuth, menuController.updateModulo);
router.delete('/admin/modulos/:id', adminAuth, menuController.deleteModulo);

router.post('/admin/links', adminAuth, menuController.createLink);
router.put('/admin/links/:id', adminAuth, menuController.updateLink);
router.delete('/admin/links/:id', adminAuth, menuController.deleteLink);

export default router;
