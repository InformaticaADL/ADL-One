import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function checkMessages() {
    try {
        console.log('Connecting to:', config.server, 'Database:', config.database);
        let pool = await sql.connect(config);
        
        console.log('\n--- Checking mae_solicitud_comentario for ID #66 ---');
        console.log('\n--- Updating user photo paths in DB ---');
        // Convert 'C:\programa\laboratorioadl\fotos\image.jpg' -> '/uploads/profile_pics/image.jpg'
        const updateResult = await pool.request().query(`
            UPDATE mae_usuario 
            SET foto = '/uploads/profile_pics/' + 
                CASE 
                    WHEN CHARINDEX('\\', REVERSE(foto)) > 0 
                    THEN REVERSE(LEFT(REVERSE(foto), CHARINDEX('\\', REVERSE(foto)) - 1))
                    ELSE foto 
                END
            WHERE foto LIKE 'C:\\programa\\laboratorioadl\\fotos\\%'
        `);
        console.log('Rows updated:', updateResult.rowsAffected[0]);

        const check = await pool.request().query('SELECT TOP 5 foto FROM mae_usuario WHERE foto IS NOT NULL');
        console.log('Sample of new paths:', check.recordset);

        console.log('\n--- Checking recent comments ---');
        const recent = await pool.request().query('SELECT TOP 5 * FROM mae_solicitud_comentario ORDER BY fecha DESC');
        console.log(recent.recordset);

        console.log('\n--- Checking if mae_usuario has all required users ---');
        const users = await pool.request().query('SELECT id_usuario, usuario FROM mae_usuario');
        console.log('Total users:', users.recordset.length);

        await pool.close();
    } catch (err) {
        console.error('SQL error', err);
    }
}

checkMessages();
