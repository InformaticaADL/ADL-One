import mssql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '1nformatica.2024',
    server: process.env.DB_SERVER || 'WS2016',
    database: process.env.DB_NAME || 'PruebasInformatica',
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function migrate() {
    try {
        let pool = await mssql.connect(config);
        console.log('Connected to DB');

        // 1. Create mae_solicitud_archivo
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'mae_solicitud_archivo')
            CREATE TABLE mae_solicitud_archivo (
                id_archivo NUMERIC(10,0) PRIMARY KEY IDENTITY(1,1),
                id_solicitud NUMERIC(10,0) NOT NULL,
                id_comentario NUMERIC(10,0) NULL,
                nombre_original NVARCHAR(255),
                nombre_sistema NVARCHAR(255),
                mime_type NVARCHAR(100),
                peso_bytes INT,
                fecha_creacion DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
            );
        `);
        console.log('Table mae_solicitud_archivo ensured');

        // 2. Add observaciones to mae_solicitud
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('mae_solicitud') AND name = 'observaciones')
            ALTER TABLE mae_solicitud ADD observaciones NVARCHAR(MAX) NULL;
        `);
        console.log('Column observaciones added to mae_solicitud');

        // 3. Update id_estado if needed
        // Assuming mae_solicitud_estado exists from previous phases
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

migrate();
