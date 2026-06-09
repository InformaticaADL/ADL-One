import sql from 'mssql';
import logger from '../utils/logger.js';

// Cifrado de la conexión a SQL Server.
//  - DB_ENCRYPT: cifra el tráfico (credenciales y datos). Seguro por defecto (true).
//  - DB_TRUST_SERVER_CERTIFICATE: si es false, valida el certificado del servidor
//    (recomendado en producción con un cert válido). true solo evita MITM si la red
//    es de confianza; sirve como paso intermedio mientras se instala un cert real.
const encrypt = process.env.DB_ENCRYPT !== 'false';
const trustServerCertificate = process.env.DB_TRUST_SERVER_CERTIFICATE === 'true';

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE || 'ADL_ONE_DB',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt,
    trustServerCertificate,
    enableArithAbort: true,
    useUTC: true,
  },
  pool: {
    max: 25,                      // Increased from 10 to handle more concurrent requests
    min: 5,                       // Keep 5 connections warm
    idleTimeoutMillis: 60000,     // 60 seconds (increased from 30)
    acquireTimeoutMillis: 30000,  // 30 seconds timeout to acquire connection
    createTimeoutMillis: 30000,   // 30 seconds timeout to create connection
  },
};

logger.info(`DB Config → server: ${config.server}, db: ${config.database}, user: ${config.user}`);


let poolPromise = null;

export const getConnection = () => {
  if (!poolPromise) {
    poolPromise = sql.connect(config)
      .then((pool) => {
        logger.info('✅ Connected to SQL Server successfully');
        return pool;
      })
      .catch((error) => {
        // Reset so the next call retries instead of returning a rejected promise forever
        poolPromise = null;
        logger.error('❌ Database connection error:', error);
        throw error;
      });
  }
  return poolPromise;
};

export const closeConnection = async () => {
  try {
    if (poolPromise) {
      const pool = await poolPromise;
      await pool.close();
      poolPromise = null;
      logger.info('✅ Database connection closed');
    }
  } catch (error) {
    logger.error('❌ Error closing database connection:', error);
    throw error;
  }
};

export default sql;
