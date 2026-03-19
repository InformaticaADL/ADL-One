import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function migrate() {
    try {
        const pool = await getConnection();
        console.log("Adding 'permiso_resolucion' to 'mae_solicitud_tipo'...");
        
        await pool.request().query(`
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE object_id = OBJECT_ID('mae_solicitud_tipo') 
                AND name = 'permiso_resolucion'
            )
            BEGIN
                ALTER TABLE mae_solicitud_tipo ADD permiso_resolucion NVARCHAR(50) NULL;
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
