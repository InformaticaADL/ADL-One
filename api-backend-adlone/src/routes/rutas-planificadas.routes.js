import express from 'express';
import { authenticate as checkAuth } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';
import rutasPlanificadasController from '../controllers/rutas-planificadas.controller.js';

const router = express.Router();

// ─── Grupos ────────────────────────────────────────────────────────────────────
router.get('/grupos', checkAuth, rutasPlanificadasController.getGrupos);
router.post('/grupos', checkAuth, verifyPermission('MA_RUTA_CREAR'), rutasPlanificadasController.createGrupo);
router.put('/grupos/:id', checkAuth, verifyPermission('MA_RUTA_CREAR'), rutasPlanificadasController.updateGrupo);
router.delete('/grupos/:id', checkAuth, verifyPermission('MA_RUTA_CREAR'), rutasPlanificadasController.deleteGrupo);

// ─── Rutas ─────────────────────────────────────────────────────────────────────
router.get('/', checkAuth, rutasPlanificadasController.getAllRutas);
router.post('/', checkAuth, verifyPermission('MA_RUTA_CREAR'), rutasPlanificadasController.createRuta);
router.get('/:id', checkAuth, rutasPlanificadasController.getRutaDetalle);
router.patch('/:id/grupo', checkAuth, verifyPermission('MA_RUTA_CREAR'), rutasPlanificadasController.updateRutaGrupo);
router.put('/:id', checkAuth, verifyPermission('MA_RUTA_CREAR'), rutasPlanificadasController.updateRuta);
router.delete('/:id', checkAuth, verifyPermission('MA_RUTA_CREAR'), rutasPlanificadasController.deleteRuta);
router.post('/:id/clone', checkAuth, verifyPermission('MA_RUTA_CREAR'), rutasPlanificadasController.cloneRuta);
router.post('/:id/asignar', checkAuth, verifyPermission(['MA_RUTA_CREAR', 'FI_GEST_ASIG']), rutasPlanificadasController.asignarRuta);

export default router;
