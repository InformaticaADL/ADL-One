// Ejecutar con: node migrations/run-2026-10-23-verificadores-solicitudes.mjs
// (desde C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mssql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT) || 1433,
    database: 'PruebasInformatica', // Siempre PruebasInformatica, no DB_DATABASE
    options: {
        encrypt: process.env.DB_ENCRYPT !== 'false',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
        enableArithAbort: true,
    },
};

async function main() {
    const sqlTexto = fs.readFileSync(
        path.join(__dirname, 'add_verificadores_solicitudes.sql'),
        'utf8'
    );
    // El archivo usa GO como separador de lotes (estilo sqlcmd/SSMS) -- el driver
    // mssql no lo entiende, así que se parte y se ejecuta lote por lote.
    const lotes = sqlTexto.split(/^\s*GO\s*$/im).map(l => l.trim()).filter(Boolean);
    const pool = await mssql.connect(config);
    console.log('Conectado a PruebasInformatica');
    for (const lote of lotes) {
        await pool.request().query(lote);
    }
    console.log('Migración aplicada: rel_usuario_verificador_solicitudes + permiso AI_SOLICITUDES_VERIFICADORES_CONFIG');
    await pool.close();
    process.exit(0);
}

main().catch((e) => {
    console.error('Error en migración:', e.message);
    process.exit(1);
});
