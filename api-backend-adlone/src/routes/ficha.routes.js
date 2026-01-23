import express from 'express';
import fichaController from '../controllers/ficha.controller.js';
// import authMiddleware from '../middlewares/auth.middleware.js'; // Uncomment if needed

const router = express.Router();

router.get('/', fichaController.getAll);
router.post('/create', fichaController.create);
router.get('/:id', fichaController.getById);

export default router;
