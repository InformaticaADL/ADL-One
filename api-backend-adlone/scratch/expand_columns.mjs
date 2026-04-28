import 'dotenv/config';
import { getConnection } from '../src/config/database.js';
import sql from 'mssql';

async function run() {
    try {
        console.log('--- STARTING DB MIGRATION: Expanding mae_empresaservicios columns ---');
        const pool = await getConnection();
        
        const queries = [
            "ALTER TABLE mae_empresaservicios ALTER COLUMN resumenejecutivo VARCHAR(MAX)",
            "ALTER TABLE mae_empresaservicios ALTER COLUMN nombre_fantasia VARCHAR(100)",
            "ALTER TABLE mae_empresaservicios ALTER COLUMN sigla VARCHAR(100)",
            "ALTER TABLE mae_empresaservicios ALTER COLUMN nombre_empresaservicios VARCHAR(200)",
            "ALTER TABLE mae_empresaservicios ALTER COLUMN giro_empresaservicios VARCHAR(200)",
            "ALTER TABLE mae_empresaservicios ALTER COLUMN direccion_empresaservicios VARCHAR(200)",
            "ALTER TABLE mae_empresaservicios ALTER COLUMN ciudad_empresaservicios VARCHAR(100)",
            "ALTER TABLE mae_empresaservicios ALTER COLUMN contacto_empresaservicios VARCHAR(200)",
            "ALTER TABLE mae_empresaservicios ALTER COLUMN direccion_comercial VARCHAR(200)"
        ];

        for (const query of queries) {
            console.log(`Executing: ${query}`);
            await pool.request().query(query);
        }

        console.log('✅ Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

run();
