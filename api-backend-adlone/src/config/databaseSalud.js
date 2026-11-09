import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import sql from 'mssql';
import logger from '../utils/logger.js';

// ============================================================================
// CONEXIÓN EXCLUSIVA LOCAL (LOCALHOST) PARA FACTURACIÓN SALUD
// PROHIBIDO CONECTAR A 192.168.10.5 POR REGLA ESTRICTA DE PRUEBAS LOCALES
// ============================================================================
const rawHost = (process.env.DB_SALUD_SERVER || 'localhost').trim();

if (rawHost.includes('192.168.10.5')) {
  throw new Error(
    '[BLOQUEO DE SEGURIDAD] Facturación Salud tiene estrictamente prohibido apuntar a 192.168.10.5. Debe usar localhost.'
  );
}

const configSalud = {
  server: rawHost,
  port: parseInt(process.env.DB_SALUD_PORT, 10) || 1433,
  database: process.env.DB_SALUD_DATABASE || 'LaboratorioADL',
  user: process.env.DB_SALUD_USER || 'sa',
  password: process.env.DB_SALUD_PASSWORD,
  options: {
    encrypt: process.env.DB_SALUD_ENCRYPT !== undefined
      ? process.env.DB_SALUD_ENCRYPT !== 'false'
      : true,
    trustServerCertificate: process.env.DB_SALUD_TRUST_SERVER_CERTIFICATE !== undefined
      ? process.env.DB_SALUD_TRUST_SERVER_CERTIFICATE === 'true'
      : true,
    enableArithAbort: true,
    useUTC: true,
  },
  pool: {
    max: 15,
    min: 1,
    idleTimeoutMillis: 60000,
    acquireTimeoutMillis: 30000,
  },
};

let poolSaludPromise = null;

/**
 * Obtiene el pool de conexión exclusivo a localhost -> LaboratorioADL para Facturación Salud.
 */
export const getConnectionSalud = () => {
  if (configSalud.server.includes('192.168.10.5')) {
    return Promise.reject(
      new Error('[BLOQUEO DE SEGURIDAD] Facturación Salud solo puede conectarse a localhost.')
    );
  }

  if (!poolSaludPromise) {
    poolSaludPromise = new sql.ConnectionPool(configSalud)
      .connect()
      .then((pool) => {
        logger.info(`✅ [Facturación Salud] Conectado a SQL local [${configSalud.database}] en ${configSalud.server}:${configSalud.port}`);
        return pool;
      })
      .catch((error) => {
        poolSaludPromise = null;
        logger.error(`❌ [Facturación Salud] Error al conectar a SQL local [${configSalud.database}] en ${configSalud.server}:`, error);
        throw error;
      });
  }
  return poolSaludPromise;
};

export const closeConnectionSalud = async () => {
  try {
    if (poolSaludPromise) {
      const pool = await poolSaludPromise;
      await pool.close();
      poolSaludPromise = null;
      logger.info('✅ [Facturación Salud] Conexión local cerrada');
    }
  } catch (error) {
    logger.error('❌ [Facturación Salud] Error al cerrar conexión local:', error);
    throw error;
  }
};

export const getSaludConnectionInfo = () => ({
  server: configSalud.server,
  port: configSalud.port,
  database: configSalud.database,
  user: configSalud.user
});

export default sql;

