import express from 'express';
import { authenticate as checkAuth } from '../middlewares/auth.middleware.js';
import rutasPlanificadasController from '../controllers/rutas-planificadas.controller.js';

const router = express.Router();

// ─── Grupos ────────────────────────────────────────────────────────────────────
router.get('/grupos', checkAuth, rutasPlanificadasController.getGrupos);
router.post('/grupos', checkAuth, rutasPlanificadasController.createGrupo);
router.put('/grupos/:id', checkAuth, rutasPlanificadasController.updateGrupo);
router.delete('/grupos/:id', checkAuth, rutasPlanificadasController.deleteGrupo);

// ─── Rutas ─────────────────────────────────────────────────────────────────────
router.get('/', checkAuth, rutasPlanificadasController.getAllRutas);
router.post('/', checkAuth, rutasPlanificadasController.createRuta);
router.get('/:id', checkAuth, rutasPlanificadasController.getRutaDetalle);
router.patch('/:id/grupo', checkAuth, rutasPlanificadasController.updateRutaGrupo);
router.put('/:id', checkAuth, rutasPlanificadasController.updateRuta);
router.delete('/:id', checkAuth, rutasPlanificadasController.deleteRuta);
router.post('/:id/clone', checkAuth, rutasPlanificadasController.cloneRuta);
router.post('/:id/asignar', checkAuth, rutasPlanificadasController.asignarRuta);

export default router;
