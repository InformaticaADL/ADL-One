import sql from 'mssql';
import logger from '../utils/logger.js';

// Conexión a la base del esquema nuevo (rediseño por módulos: geo_, cat_, per_, eqp_, cli_…).
// Mientras dure la migración es "ADL ONE TEST"; se cambia con DB_NUEVA_DATABASE.
// Usa el mismo servidor y usuario que la base legada.
const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_NUEVA_DATABASE || 'ADL ONE TEST',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT !== 'false',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true,
    useUTC: true,
  },
  pool: { max: 5, min: 0, idleTimeoutMillis: 60000 },
};

let poolPromise = null;

// Pool propio (ConnectionPool, no el global de sql.connect) para no pisar la conexión legada.
export const getConnectionNueva = () => {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect()
      .then((pool) => {
        logger.info(`✅ Conectado a la base nueva [${config.database}]`);
        return pool;
      })
      .catch((error) => {
        poolPromise = null;
        logger.error('❌ Error de conexión a la base nueva:', error);
        throw error;
      });
  }
  return poolPromise;
};

export const nombreBaseNueva = () => config.database;
