import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE || 'ADL_ONE_DB',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function fixSchema() {
    try {
        const pool = await sql.connect(config);
        console.log('Ampliando columnas de mae_solicitud_adjunto...');
        
        await pool.request().query(`
            ALTER TABLE mae_solicitud_adjunto 
            ALTER COLUMN nombre_archivo NVARCHAR(255);
            
            ALTER TABLE mae_solicitud_adjunto 
            ALTER COLUMN ruta_archivo NVARCHAR(500);
            
            ALTER TABLE mae_solicitud_adjunto 
            ALTER COLUMN tipo_archivo NVARCHAR(100);
            
            PRINT 'Esquema actualizado correctamente.';
        `);
        
        console.log('✅ Esquema actualizado.');
        await pool.close();
    } catch (err) {
        console.error('❌ Error actualizando esquema:', err);
    }
}

fixSchema();
