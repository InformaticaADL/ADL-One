import dotenv from 'dotenv';
dotenv.config();

import sql from 'mssql';
import logger from '../utils/logger.js';

// Conexión independiente a la base de datos histórica (LaboratorioADLHistorico).
// Permite sobreescribir servidor/puerto/usuario/contraseña si difieren de la base principal,
// pero por defecto reutiliza la configuración de SQL Server del entorno.
const config = {
  server: process.env.DB_HISTORICO_SERVER || process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_HISTORICO_PORT || process.env.DB_PORT) || 1433,
  database: process.env.DB_HISTORICO_DATABASE || 'LaboratorioADLHistorico',
  user: process.env.DB_HISTORICO_USER || process.env.DB_USER,
  password: process.env.DB_HISTORICO_PASSWORD || process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_HISTORICO_ENCRYPT !== undefined
      ? process.env.DB_HISTORICO_ENCRYPT !== 'false'
      : process.env.DB_ENCRYPT !== 'false',
    trustServerCertificate: process.env.DB_HISTORICO_TRUST_SERVER_CERTIFICATE !== undefined
      ? process.env.DB_HISTORICO_TRUST_SERVER_CERTIFICATE === 'true'
      : process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true,
    useUTC: true,
  },
  pool: {
    max: parseInt(process.env.DB_HISTORICO_POOL_MAX) || 10,
    min: parseInt(process.env.DB_HISTORICO_POOL_MIN) || 0,
    idleTimeoutMillis: 60000,
    acquireTimeoutMillis: 30000,
  },
};

let poolPromise = null;

/**
 * Retorna el pool de conexión para LaboratorioADLHistorico.
 * Usa new sql.ConnectionPool para mantener un pool aislado y no interferir con la conexión global de database.js.
 */
export const getConnectionHistorico = () => {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then((pool) => {
        logger.info(`✅ Conectado a la base histórica [${config.database}] en ${config.server}`);
        return pool;
      })
      .catch((error) => {
        poolPromise = null;
        logger.error(`❌ Error al conectar a la base histórica [${config.database}]:`, error);
        throw error;
      });
  }
  return poolPromise;
};

/**
 * Cierra el pool de conexión histórica si está activo.
 */
export const closeConnectionHistorico = async () => {
  try {
    if (poolPromise) {
      const pool = await poolPromise;
      await pool.close();
      poolPromise = null;
      logger.info('✅ Conexión a base histórica cerrada');
    }
  } catch (error) {
    logger.error('❌ Error al cerrar conexión a base histórica:', error);
    throw error;
  }
};

export const nombreBaseHistorica = () => config.database;

export default {
  getConnectionHistorico,
  closeConnectionHistorico,
  nombreBaseHistorica,
};
