import express from 'express';
import { authenticate as checkAuth } from '../middlewares/auth.middleware.js';
import rutasPlanificadasController from '../controllers/rutas-planificadas.controller.js';

const router = express.Router();

// Obtener todas las rutas pendientes
router.get('/', checkAuth, rutasPlanificadasController.getAllRutas);

// Obtener detalle de una ruta
router.get('/:id', checkAuth, rutasPlanificadasController.getRutaDetalle);

// Crear nueva ruta (Solo guardar, sin asignar)
router.post('/', checkAuth, rutasPlanificadasController.createRuta);

// Eliminar ruta
router.delete('/:id', checkAuth, rutasPlanificadasController.deleteRuta);

// Convertir ruta guardada en asignación oficial (Batch update)
router.post('/:id/asignar', checkAuth, rutasPlanificadasController.asignarRuta);

export default router;
