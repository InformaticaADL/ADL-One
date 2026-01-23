import { getConnection } from './src/config/database.js';
import sql from 'mssql';

const createSP = async () => {
    try {
        const pool = await getConnection();
        console.log('✅ Connected to SQL Server');

        const spName = 'MAM_FichaComercial_ConsultaComercial';

        // Check if SP exists
        const checkResult = await pool.request().query(`SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[${spName}]') AND type in (N'P', N'PC')`);

        const spBody = `
            SET NOCOUNT ON;
            SELECT        TOP (100) PERCENT dbo.App_Ma_FichaIngresoServicio_ENC.fichaingresoservicio, dbo.App_Ma_FichaIngresoServicio_ENC.estado_ficha, convert(varchar,dbo.App_Ma_FichaIngresoServicio_ENC.fecha_fichacomercial,103) AS fecha, 
                                     dbo.App_Ma_FichaIngresoServicio_ENC.tipo_fichaingresoservicio, dbo.mae_empresaservicios.nombre_empresaservicios AS empresa_facturar, dbo.mae_empresa.nombre_empresa AS empresa_servicio, 
                                     dbo.mae_centro.nombre_centro AS centro, dbo.mae_objetivomuestreo_ma.nombre_objetivomuestreo_ma, dbo.mae_subarea.nombre_subarea, dbo.mae_usuario.nombre_usuario, 
                                     dbo.App_Ma_FichaIngresoServicio_ENC.id_fichaingresoservicio
            FROM            dbo.App_Ma_FichaIngresoServicio_ENC INNER JOIN
                                     dbo.mae_empresaservicios ON dbo.App_Ma_FichaIngresoServicio_ENC.id_empresaservicio = dbo.mae_empresaservicios.id_empresaservicio INNER JOIN
                                     dbo.mae_empresa ON dbo.App_Ma_FichaIngresoServicio_ENC.id_empresa = dbo.mae_empresa.id_empresa INNER JOIN
                                     dbo.mae_centro ON dbo.App_Ma_FichaIngresoServicio_ENC.id_centro = dbo.mae_centro.id_centro INNER JOIN
                                     dbo.mae_objetivomuestreo_ma ON dbo.App_Ma_FichaIngresoServicio_ENC.id_objetivomuestreo_ma = dbo.mae_objetivomuestreo_ma.id_objetivomuestreo_ma INNER JOIN
                                     dbo.mae_subarea ON dbo.App_Ma_FichaIngresoServicio_ENC.id_subarea = dbo.mae_subarea.id_subarea INNER JOIN
                                     dbo.mae_usuario ON dbo.App_Ma_FichaIngresoServicio_ENC.id_usuario = dbo.mae_usuario.id_usuario
            ORDER BY dbo.App_Ma_FichaIngresoServicio_ENC.id_fichaingresoservicio DESC
        `;

        if (checkResult.recordset.length === 0) {
            console.log(`Creating Procedure ${spName}...`);
            await pool.request().query(`CREATE PROCEDURE [dbo].[${spName}] AS BEGIN ${spBody} END`);
            console.log('✅ Procedure CREATED successfully.');
        } else {
            console.log(`Altering Procedure ${spName}...`);
            await pool.request().query(`ALTER PROCEDURE [dbo].[${spName}] AS BEGIN ${spBody} END`);
            console.log('✅ Procedure ALTERED successfully.');
        }

        await pool.close();
        process.exit(0);
    } catch (error) {
        console.error('Error creating/altering SP:', error);
        process.exit(1);
    }
};

createSP();
