import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import sql from 'mssql';
import logger from '../utils/logger.js';

const encrypt = (process.env.DB_FACTURACION_ENCRYPT ?? process.env.DB_ENCRYPT) !== 'false';
const trustServerCertificate = (process.env.DB_FACTURACION_TRUST_SERVER_CERTIFICATE ?? process.env.DB_TRUST_SERVER_CERTIFICATE) === 'true';
const rawDatabase = (process.env.DB_FACTURACION_DATABASE || 'ADLFacturacion').trim();

// ============================================================================
// CANDADO ESTRICTO: SOLO SE PERMITE CONECTAR A LA BASE DE DATOS ADLFacturacion
// ============================================================================
if (rawDatabase.toUpperCase() !== 'ADLFACTURACION') {
  throw new Error(
    `[BLOQUEO DE SEGURIDAD] El pool de facturación solo puede conectarse a ADLFacturacion; DB_FACTURACION_DATABASE="${rawDatabase}" no está permitido.`
  );
}

const configFacturacion = {
  server: process.env.DB_FACTURACION_SERVER || process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_FACTURACION_PORT || process.env.DB_PORT || '1433', 10),
  database: 'ADLFacturacion',
  user: process.env.DB_FACTURACION_USER || process.env.DB_USER,
  password: process.env.DB_FACTURACION_PASSWORD || process.env.DB_PASSWORD,
  options: {
    encrypt,
    trustServerCertificate,
    enableArithAbort: true,
    useUTC: true,
  },
  pool: {
    max: 20,
    min: 2,
    idleTimeoutMillis: 60000,
    acquireTimeoutMillis: 30000,
    createTimeoutMillis: 30000,
  },
};

let poolFacturacionPromise = null;

export const getConnectionFacturacion = async () => {
  if (!poolFacturacionPromise) {
    poolFacturacionPromise = new sql.ConnectionPool(configFacturacion)
      .connect()
      .then(async (pool) => {
        const check = (await pool.request().query('SELECT DB_NAME() AS db, @@SERVERNAME AS srv')).recordset?.[0];
        if (String(check?.db || '').trim().toUpperCase() !== 'ADLFACTURACION') {
          await pool.close();
          throw new Error(
            `[BLOQUEO DE SEGURIDAD] Conexión rechazada: la base activa "${check?.db}" en ${check?.srv} no es ADLFacturacion.`
          );
        }
        logger.info(`✅ [ADLFacturacion] Conectado exclusivamente a [${check.db}] en ${check.srv}`);
        return pool;
      })
      .catch((error) => {
        poolFacturacionPromise = null;
        logger.error(`❌ [ADLFacturacion] Error al conectar a [${configFacturacion.database}] en ${configFacturacion.server}:`, error);
        throw error;
      });
  }
  return poolFacturacionPromise;
};

export const closeConnectionFacturacion = async () => {
  if (poolFacturacionPromise) {
    const pool = await poolFacturacionPromise;
    await pool.close();
    poolFacturacionPromise = null;
  }
};

export default sql;
