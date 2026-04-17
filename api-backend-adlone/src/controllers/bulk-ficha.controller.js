import bulkFichaService from '../services/bulk-ficha.service.js';
import logger from '../utils/logger.js';
import { successResponse, errorResponse } from '../utils/response.js';
import multer from 'multer';

// Configure multer for memory storage (we process buffers directly)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 20 * 1024 * 1024, // 20MB per file
        files: 1000 // Max 1000 files per batch
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error(`Archivo rechazado: ${file.originalname} no es un PDF válido`), false);
        }
    }
});

class BulkFichaController {

    // Multer middleware for multipart upload
    getUploadMiddleware() {
        return upload.array('pdfs', 1000);
    }

    /**
     * POST /api/fichas/bulk-parse
     * Upload and parse PDF files. Returns parsed results for review.
     */
    async parseBatch(req, res) {
        try {
            const files = req.files;

            if (!files || files.length === 0) {
                return errorResponse(res, 'No se recibieron archivos PDF', 400);
            }

            logger.info(`[BulkFicha] Received ${files.length} PDFs for parsing`);

            const result = await bulkFichaService.processBatch(files);

            return successResponse(res, result, `Procesados ${result.total} archivos: ${result.ready} listos, ${result.warnings} con advertencias, ${result.errors} con errores`);

        } catch (err) {
            logger.error('[BulkFicha] Error in parseBatch:', err);

            if (err.code === 'LIMIT_FILE_COUNT') {
                return errorResponse(res, 'Se excedió el límite de 1000 archivos por lote', 400);
            }
            if (err.code === 'LIMIT_FILE_SIZE') {
                return errorResponse(res, 'Un archivo excede el tamaño máximo de 20MB', 400);
            }

            return errorResponse(res, 'Error al procesar los archivos PDF', 500, err.message);
        }
    }

    /**
     * POST /api/fichas/bulk-commit
     * Commit validated items to create actual fichas.
     * Body: { items: [...], userId: number }
     */
    async commitBatch(req, res) {
        try {
            const { items, userId } = req.body;

            if (!items || !Array.isArray(items) || items.length === 0) {
                return errorResponse(res, 'No se recibieron fichas para crear', 400);
            }

            const effectiveUserId = userId || (req.user ? (req.user.id_usuario || req.user.id) : 0);

            if (!effectiveUserId) {
                return errorResponse(res, 'Se requiere un usuario autenticado para crear fichas', 401);
            }

            logger.info(`[BulkFicha] Committing ${items.length} fichas for user ${effectiveUserId}`);

            const result = await bulkFichaService.commitBatch(items, effectiveUserId);

            return successResponse(res, result, `Creadas ${result.created} de ${result.total} fichas`);

        } catch (err) {
            logger.error('[BulkFicha] Error in commitBatch:', err);
            return errorResponse(res, 'Error al crear las fichas', 500, err.message);
        }
    }
}

export default new BulkFichaController();
