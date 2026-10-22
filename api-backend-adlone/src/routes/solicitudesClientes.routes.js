import { Router } from 'express';
import * as ctrl from '../controllers/solicitudesClientes.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// GET /api/solicitudes-clientes — lista solicitudes de las empresas del usuario logueado
router.get('/', authenticate, ctrl.listar);

// GET /api/solicitudes-clientes/:id — detalle de una solicitud
router.get('/:id', authenticate, ctrl.detalle);

// POST /api/solicitudes-clientes/:id/mensajes — responder
router.post('/:id/mensajes', authenticate, ctrl.responder);

// PATCH /api/solicitudes-clientes/:id/estado — cambiar estado
router.patch('/:id/estado', authenticate, ctrl.cambiarEstado);

// POST /api/solicitudes-clientes/:id/tomar — tomar la solicitud
router.post('/:id/tomar', authenticate, ctrl.tomar);

export default router;
