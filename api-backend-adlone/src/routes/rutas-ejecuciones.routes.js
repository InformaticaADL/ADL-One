import express from 'express';
import { authenticate as checkAuth } from '../middlewares/auth.middleware.js';
import rutasEjecucionesController from '../controllers/rutas-ejecuciones.controller.js';

const router = express.Router();

// Fichas de una plantilla con sus correlativos disponibles (para el modal de nueva ejecución)
router.get('/plantilla/:id/fichas-disponibles', checkAuth, rutasEjecucionesController.getFichasDisponibles);

// Historial de ejecuciones de una plantilla
router.get('/plantilla/:id', checkAuth, rutasEjecucionesController.getEjecucionesByPlantilla);

// Detalle de una ejecución
router.get('/:id', checkAuth, rutasEjecucionesController.getEjecucionById);

// Crear nueva ejecución (asigna fichas seleccionadas con sus correlativos)
router.post('/', checkAuth, rutasEjecucionesController.createEjecucion);

export default router;
