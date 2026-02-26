const sql = require('mssql');
require('dotenv').config({ path: '../../.env' });

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '123456',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE || 'ADL_One',
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function runMigration() {
    try {
        const pool = await sql.connect(config);
        console.log('✅ Connected to SQL Server successfully');

        const query = `
            UPDATE mae_permiso SET codigo = 'MA_A_GEST_EQUIPO' WHERE codigo = 'AI_MA_A_GEST_EQUIPO';
            UPDATE mae_permiso SET codigo = 'MA_A_REPORTES' WHERE codigo = 'AI_MA_A_REPORTES';
            UPDATE mae_permiso SET codigo = 'MA_ACCESO' WHERE codigo = 'AI_MA_ACCESO';
            UPDATE mae_permiso SET codigo = 'MA_MUESTREADORES' WHERE codigo = 'AI_MA_MUESTREADORES';
        `;

        await pool.request().query(query);
        console.log('Migration executed successfully');

    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        sql.close();
    }
}

runMigration();
