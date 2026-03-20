import { getConnection } from './src/config/database.js';
import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
    try {
        const pool = await getConnection();
        console.log('Altering column clave_usuario in mae_usuario...');
        await pool.request().query(`
            ALTER TABLE mae_usuario 
            ALTER COLUMN clave_usuario VARCHAR(100)
        `);
        console.log('✅ Column updated successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error updating column:', err);
        process.exit(1);
    }
}

runMigration();
