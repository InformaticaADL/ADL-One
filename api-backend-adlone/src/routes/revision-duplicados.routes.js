import express from 'express';
import { revisionDuplicadosController as c } from '../controllers/revisionDuplicados.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';

const router = express.Router();

// Revisión de duplicados del esquema nuevo. Mismo permiso que la sección Informática (INF_ACCESO).
router.use(authenticate, verifyPermission('INF_ACCESO'));

router.get('/resumen', c.resumen);
router.get('/', c.listar);
router.post('/resolver-lote', c.resolverLote);
router.post('/:id/resolver', c.resolver);

export default router;
