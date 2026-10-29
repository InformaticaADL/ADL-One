// Ejecutar con: node migrations/run-2026-10-27-grupo-muestreo.mjs
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
    const sql = fs.readFileSync(path.join(__dirname, '2026-10-27-grupo-muestreo.sql'), 'utf8');
    const pool = await mssql.connect(config);
    console.log('Conectado a PruebasInformatica');
    await pool.request().query(sql);
    const r = await pool.request().query(
        "SELECT name FROM sys.tables WHERE name IN ('App_Ma_GrupoMuestreo','App_Ma_GrupoMuestreo_Ficha') ORDER BY name"
    );
    console.log('Tablas presentes:', r.recordset.map((x) => x.name).join(', '));
    await pool.close();
    process.exit(0);
}

main().catch((e) => {
    console.error('Error aplicando la migración:', e.message);
    process.exit(1);
});
