import { getConnection } from '../src/config/database.js';
import sql from 'mssql';

async function createTable() {
    try {
        const pool = await getConnection();
        console.log('Creating table mae_solicitud_historial...');

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'mae_solicitud_historial')
            BEGIN
                CREATE TABLE mae_solicitud_historial (
                    id_historial INT IDENTITY(1,1) PRIMARY KEY,
                    id_solicitud NUMERIC(10,0) NOT NULL,
                    id_usuario NUMERIC(10,0) NOT NULL,
                    accion VARCHAR(50) NOT NULL,
                    estado_anterior VARCHAR(50),
                    estado_nuevo VARCHAR(50),
                    observacion VARCHAR(MAX),
                    fecha DATETIME DEFAULT GETDATE()
                );
                
                CREATE INDEX IX_SolicitudHistorial_Solicitud ON mae_solicitud_historial(id_solicitud);
                PRINT 'Table mae_solicitud_historial created successfully.';
            END
            ELSE
            BEGIN
                PRINT 'Table mae_solicitud_historial already exists.';
            END
        `);

        process.exit(0);
    } catch (err) {
        console.error('Error creating table:', err);
        process.exit(1);
    }
}

createTable();
