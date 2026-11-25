import './env.js';
import sql from 'mssql';
import logger from '../utils/logger.js';

// ============================================================================
// Conexión a la base de datos de ADLWeb (sitio público adldiagnostic.cl).
//
// ADL-One la usa SOLO para Gestión de Calidad → Calidad → Quejas y apelaciones:
// los casos los crea el formulario público de ADLWeb y se administran desde las
// dos aplicaciones sobre las MISMAS tablas (dbo.quejas_apelaciones y afines).
// La base de ADL-One no se modifica por esto.
//
// useUTC: false — igual que ADLWeb (api-backend-adlclone/db.js). Las columnas
// DATE de esas tablas se leen y escriben como fecha local; con useUTC: true las
// fechas quedarían corridas un día respecto de lo que muestra ADLWeb.
//
// La estructura de las tablas la mantiene ADLWeb (ensureQualitySchema); acá no se
// crean ni alteran tablas, así que el usuario SQL solo necesita leer y escribir.
// ============================================================================
const env = (k, def) => {
    const v = process.env[k];
    return v === undefined || v === '' ? def : v;
};

const configAdlWeb = {
    server: env('ADLWEB_DB_SERVER', process.env.DB_SERVER || 'localhost'),
    port: parseInt(env('ADLWEB_DB_PORT', process.env.DB_PORT), 10) || 1433,
    database: env('ADLWEB_DB_DATABASE', 'ADLWeb'),
    user: env('ADLWEB_DB_USER', process.env.DB_USER),
    password: env('ADLWEB_DB_PASSWORD', process.env.DB_PASSWORD),
    options: {
        encrypt: env('ADLWEB_DB_ENCRYPT', 'false') !== 'false',
        trustServerCertificate: env('ADLWEB_DB_TRUST_SERVER_CERTIFICATE', 'true') === 'true',
        enableArithAbort: true,
        useUTC: false,
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 60000,
        acquireTimeoutMillis: 30000,
    },
};

let poolPromise = null;

/** Pool propio (no el global de mssql) hacia la base de ADLWeb. */
export const getConnectionAdlWeb = () => {
    if (!poolPromise) {
        poolPromise = new sql.ConnectionPool(configAdlWeb)
            .connect()
            .then((pool) => {
                logger.info(`✅ [ADLWeb] Conectado a [${configAdlWeb.database}] en ${configAdlWeb.server}`);
                return pool;
            })
            .catch((error) => {
                poolPromise = null; // el próximo intento vuelve a conectar
                logger.error(`❌ [ADLWeb] Error al conectar a [${configAdlWeb.database}] en ${configAdlWeb.server}:`, error);
                throw error;
            });
    }
    return poolPromise;
};

export const closeConnectionAdlWeb = async () => {
    if (!poolPromise) return;
    const pool = await poolPromise;
    await pool.close();
    poolPromise = null;
};

export default sql;
