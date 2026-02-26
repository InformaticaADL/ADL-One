import sql from 'mssql';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const config = {
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT) || 1433,
    database: process.env.DB_DATABASE || 'ADL_ONE_DB',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
    }
};

async function updatePermissions() {
    try {
        await sql.connect(config);
        console.log('Connected to DB');

        const result = await sql.query(`
            UPDATE mae_permiso 
            SET modulo = 'Gestión de Calidad', submodulo = 'GC - Equipos'
            WHERE submodulo = 'MA - Equipos';
        `);

        console.log('Update result:', result.rowsAffected);

        // Also check if there's any pending permission under AI that should be updated
        const checkResult = await sql.query(`
            SELECT id_permiso, nombre, codigo, modulo, submodulo FROM mae_permiso 
            WHERE submodulo LIKE '%Equipos%';
        `);
        console.log('Current Equipos Permissions:', checkResult.recordset);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await sql.close();
        console.log('Connection closed');
    }
}

updatePermissions();
