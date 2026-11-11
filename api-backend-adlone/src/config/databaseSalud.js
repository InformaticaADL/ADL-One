import dotenv from 'dotenv';
import os from 'os';
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

// Candado reforzado: solo se acepta una dirección de ESTE equipo. Las dos bases se llaman igual (LaboratorioADL), así que el nombre de la
// base no distingue la copia de pruebas de la de producción: lo que distingue es el servidor.
const HOSTS_LOCALES = ['localhost', '127.0.0.1', '::1', '(local)', '.'];
if (!HOSTS_LOCALES.includes(rawHost.toLowerCase())) {
  throw new Error(
    `[BLOQUEO DE SEGURIDAD] Facturación Salud solo puede conectarse a este equipo (localhost); DB_SALUD_SERVER="${rawHost}" no está permitido.`
  );
}

// Con una instancia con nombre (DB_SALUD_INSTANCE, por ejemplo ADLLOCAL) se busca por nombre y no por puerto
const instanciaSalud = (process.env.DB_SALUD_INSTANCE || '').trim();

const configSalud = {
  server: rawHost,
  ...(instanciaSalud ? {} : { port: parseInt(process.env.DB_SALUD_PORT, 10) || 1433 }),
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
    ...(instanciaSalud ? { instanceName: instanciaSalud } : {}),
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
      .then(async (pool) => {
        // Segunda verificación, ya conectado: el servidor SQL tiene que estar instalado en ESTA máquina. Si no, se corta antes de ejecutar nada.
        const id = (await pool.request().query("SELECT CAST(SERVERPROPERTY('MachineName') AS nvarchar(128)) AS maquina, @@SERVERNAME AS servidor")).recordset[0];
        if (String(id.maquina).toLowerCase() !== os.hostname().toLowerCase()) {
          await pool.close();
          throw new Error(`[BLOQUEO DE SEGURIDAD] El servidor SQL "${id.servidor}" no está en este equipo (${os.hostname()}). Facturación Salud no puede usarlo.`);
        }
        logger.info(`✅ [Facturación Salud] Conectado a SQL local [${configSalud.database}] en ${id.servidor}`);
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

