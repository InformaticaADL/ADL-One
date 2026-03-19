import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function migrate() {
    try {
        const pool = await getConnection();
        console.log("Creating 'mae_solicitud_tipo_permiso' table...");
        
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[mae_solicitud_tipo_permiso]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [dbo].[mae_solicitud_tipo_permiso](
                    [id_relacion] [int] IDENTITY(1,1) NOT NULL,
                    [id_tipo] [numeric](10, 0) NOT NULL,
                    [id_usuario] [numeric](10, 0) NULL,
                    [id_rol] [numeric](10, 0) NULL,
                    [accion] [varchar](20) NOT NULL, -- 'CREAR', 'RESOLVER'
                    [fecha_asignacion] [datetime] DEFAULT GETDATE(),
                    CONSTRAINT [PK_mae_solicitud_tipo_permiso] PRIMARY KEY CLUSTERED ([id_relacion] ASC)
                );

                ALTER TABLE [dbo].[mae_solicitud_tipo_permiso] WITH CHECK ADD CONSTRAINT [FK_sol_tipo_permiso_tipo] FOREIGN KEY([id_tipo])
                REFERENCES [dbo].[mae_solicitud_tipo] ([id_tipo]);

                ALTER TABLE [dbo].[mae_solicitud_tipo_permiso] WITH CHECK ADD CONSTRAINT [FK_sol_tipo_permiso_usr] FOREIGN KEY([id_usuario])
                REFERENCES [dbo].[mae_usuario] ([id_usuario]);

                ALTER TABLE [dbo].[mae_solicitud_tipo_permiso] WITH CHECK ADD CONSTRAINT [FK_sol_tipo_permiso_rol] FOREIGN KEY([id_rol])
                REFERENCES [dbo].[mae_rol] ([id_rol]);
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
