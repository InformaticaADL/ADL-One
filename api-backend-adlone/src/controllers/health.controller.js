import healthService from '../services/health.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

class HealthController {
    /**
     * GET /api/health
     * Health check endpoint
     */
    async getHealth(req, res, next) {
        try {
            const healthData = await healthService.checkHealth();
            return successResponse(res, healthData, 'Health check successful');
        } catch (error) {
            next(error);
        }
    }
}

export default new HealthController();
