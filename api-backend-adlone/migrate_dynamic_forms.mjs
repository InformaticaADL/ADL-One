import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function migrate() {
    try {
        const pool = await getConnection();
        console.log("Adding 'formulario_config' to 'mae_solicitud_tipo'...");
        
        await pool.request().query(`
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID('mae_solicitud_tipo') 
                AND name = 'formulario_config'
            )
            BEGIN
                ALTER TABLE mae_solicitud_tipo ADD formulario_config NVARCHAR(MAX) NULL;
            END
        `);
        
        console.log("Success!");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
}

migrate();
