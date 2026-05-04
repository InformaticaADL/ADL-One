const sql = require('mssql');
const config = {
    server: '192.168.10.5',
    database: 'PruebasInformatica',
    user: 'sa',
    password: 'MGmerlin.10',
    options: {
        trustServerCertificate: true
    }
};

const TABLES_TO_INSPECT = [
    'mae_usuario', 'mae_rol', 'mae_permiso', 
    'rel_rol_permiso', 'rel_usuario_rol',
    'mae_solicitud', 'mae_solicitud_tipo', 'mae_solicitud_comentario', 
    'mae_equipo', 'mae_muestreador', 'mae_lugaranalisis',
    'App_Ma_FichaIngresoServicio_ENC', 'App_Ma_FichaIngresoServicio_DET',
    'mae_notificacion', 'mae_notificacion_regla'
];

async function inspectTables() {
    try {
        const pool = await sql.connect(config);
        const results = {};

        for (const table of TABLES_TO_INSPECT) {
            const colInfo = await pool.request()
                .input('table', sql.VarChar, table)
                .query(`
                    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = @table
                    ORDER BY ORDINAL_POSITION
                `);
            
            results[table] = colInfo.recordset;
        }

        console.log(JSON.stringify(results, null, 2));
        await sql.close();
    } catch (err) {
        process.exit(1);
    }
}

inspectTables();
