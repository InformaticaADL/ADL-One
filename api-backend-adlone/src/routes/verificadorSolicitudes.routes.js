import { Router } from 'express';
import * as ctrl from '../controllers/verificadorSolicitudes.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';

const router = Router();

// GET /api/verificadores-solicitudes — lista todos los verificadores (para la pantalla de configuración)
router.get('/', authenticate, verifyPermission('AI_SOLICITUDES_VERIFICADORES_CONFIG'), ctrl.listar);

// POST /api/verificadores-solicitudes — agrega un verificador (solo admins de solicitudes)
router.post('/', authenticate, verifyPermission('AI_SOLICITUDES_VERIFICADORES_CONFIG'), ctrl.crear);

// DELETE /api/verificadores-solicitudes/:id — quita un verificador (solo admins de solicitudes)
router.delete('/:id', authenticate, verifyPermission('AI_SOLICITUDES_VERIFICADORES_CONFIG'), ctrl.eliminar);

export default router;
