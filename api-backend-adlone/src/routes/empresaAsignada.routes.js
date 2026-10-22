import { Router } from 'express';
import * as ctrl from '../controllers/empresaAsignada.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';

const router = Router();

// GET /api/empresas-asignadas — lista todas las asignaciones (para la pantalla de configuración)
router.get('/', authenticate, verifyPermission('AI_SOLICITUDES_CLIENTES_CONFIG'), ctrl.listar);

// GET /api/empresas-asignadas/mias — empresas asignadas al usuario logueado (?area=LAB|MAM)
router.get('/mias', authenticate, ctrl.misEmpresas);

// POST /api/empresas-asignadas — crea una asignación (solo admins de solicitudes)
router.post('/', authenticate, verifyPermission('AI_SOLICITUDES_CLIENTES_CONFIG'), ctrl.crear);

// DELETE /api/empresas-asignadas/:id — borra una asignación (solo admins de solicitudes)
router.delete('/:id', authenticate, verifyPermission('AI_SOLICITUDES_CLIENTES_CONFIG'), ctrl.eliminar);

export default router;
