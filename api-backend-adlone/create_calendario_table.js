import { getConnection, closeConnection } from './src/config/database.js';

async function createTable() {
    try {
        const pool = await getConnection();
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='mae_calendario_tecnico' AND xtype='U')
            BEGIN
                CREATE TABLE [dbo].[mae_calendario_tecnico](
                    [id_evento] [numeric](10, 0) IDENTITY(1,1) NOT NULL,
                    [titulo] [varchar](200) NOT NULL,
                    [fecha_inicio] [datetime] NOT NULL,
                    [fecha_fin] [datetime] NOT NULL,
                    [id_empresa] [numeric](10, 0) NULL,
                    [id_punto_muestreo] [numeric](10, 0) NULL,
                    [id_muestreador] [numeric](10, 0) NULL,
                    [estado] [varchar](50) DEFAULT 'Programado',
                    [observaciones] [varchar](500) NULL,
                    [fecha_creacion] [datetime] DEFAULT GETDATE(),
                    [usuario_creacion] [numeric](10, 0) NULL,
                 CONSTRAINT [PK_mae_calendario_tecnico] PRIMARY KEY CLUSTERED 
                (
                    [id_evento] ASC
                )WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
                ) ON [PRIMARY]
                PRINT 'Tabla mae_calendario_tecnico creada con exito'
            END
            ELSE
            BEGIN
                PRINT 'La tabla mae_calendario_tecnico ya existe'
            END
        `);
        console.log('Migración completada con éxito.');
        await closeConnection();
    } catch (err) {
        console.error('Error al crear la tabla', err);
        process.exit(1);
    }
}

createTable();
