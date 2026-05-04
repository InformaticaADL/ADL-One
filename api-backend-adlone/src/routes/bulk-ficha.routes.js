import { Router } from 'express';
import bulkFichaController from '../controllers/bulk-ficha.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';
import { validateRequest, bulkFichaValidationSchemas } from '../middlewares/validate.middleware.js';

const router = Router();

// Upload and parse PDFs - returns parsed results for review
router.post('/bulk-parse', 
    authenticate,
    verifyPermission('FI_CREAR'),
    bulkFichaController.getUploadMiddleware(),
    (req, res) => bulkFichaController.parseBatch(req, res)
);

// Commit validated items - creates actual fichas
router.post('/bulk-commit',
    authenticate,
    verifyPermission('FI_CREAR'),
    validateRequest(bulkFichaValidationSchemas.commitBatch),
    (req, res) => bulkFichaController.commitBatch(req, res)
);

export default router;
