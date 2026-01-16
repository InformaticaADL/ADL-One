import { getConnection } from '../config/database.js';

class HealthService {
    /**
     * Check the health status of the API and database
     * @returns {Promise<Object>} Health status information
     */
    async checkHealth() {
        let dbStatus = 'disconnected';
        let dbMessage = 'Database not configured';
        let dbDetails = null;

        try {
            const pool = await getConnection();
            const result = await pool.request().query('SELECT @@VERSION as version, DB_NAME() as [database]');

            dbStatus = 'connected';
            dbMessage = 'Database connection successful';
            dbDetails = {
                version: result.recordset[0].version.split('\n')[0],
                database: result.recordset[0].database,
            };
        } catch (error) {
            dbStatus = 'disconnected';
            dbMessage = error.message || 'Database connection failed';
        }

        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: dbStatus,
            message: 'ADL One API is running successfully',
            databaseMessage: dbMessage,
            ...(dbDetails && { databaseDetails: dbDetails }),
            environment: process.env.NODE_ENV || 'development',
            version: '1.0.0',
        };
    }
}

export default new HealthService();
