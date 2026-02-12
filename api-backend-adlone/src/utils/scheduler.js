import { equipoService } from '../services/equipo.service.js';
import logger from './logger.js';

export const initScheduler = () => {
    logger.info('Initializing Scheduler...');

    // Function to run the daily check
    const runDailyCheck = async () => {
        logger.info('Running Daily Expiration Check...');
        try {
            const result = await equipoService.inactivateExpiredEquipos();
            if (result.processed > 0) {
                logger.info(`Daily Check Complete: Inactivated ${result.processed} equipment(s).`);
            } else {
                logger.info('Daily Check Complete: No expired equipment found.');
            }
        } catch (error) {
            logger.error('Error verifying expired equipment:', error);
        }
    };

    // Run once on startup (optional, good for immediate effect in dev/restarts, maybe delay it slightly)
    setTimeout(() => {
        runDailyCheck();
    }, 10000); // 10 seconds after startup

    // Run every 24 hours (86400000 ms)
    setInterval(() => {
        runDailyCheck();
    }, 24 * 60 * 60 * 1000);

    logger.info('Scheduler initialized: Daily check set.');
};
