import 'dotenv/config';
import { getConnection } from './src/config/database.js';

async function createDatabase() {
    try {
        const pool = await getConnection();
        console.log("Conectado. Intentando crear la base de datos ADL_ONE...");
        await pool.request().query("IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'ADL_ONE') BEGIN CREATE DATABASE ADL_ONE; END");
        console.log("✅ Base de datos ADL_ONE creada (o ya existía).");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error creando BD:", err);
        process.exit(1);
    }
}

createDatabase();
