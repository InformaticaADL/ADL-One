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
    'mae_usuario', 'mae_rol', 'mae_permiso', 'rel_rol_permiso', 'rel_usuario_rol',
    'mae_solicitud', 'mae_solicitud_tipo', 'mae_solicitud_comentario', 'rel_solicitud_tipo_permiso',
    'mae_equipo', 'mae_muestreador', 'mae_lugaranalisis',
    'App_Ma_FichaIngresoServicio_ENC', 'App_Ma_FichaIngresoServicio_DET',
    'mae_notificacion', 'mae_notificacion_regla'
];

async function inspectTables() {
    try {
        const pool = await sql.connect(config);
        const results = {};

        for (const table of TABLES_TO_INSPECT) {
            console.log(`Inspecting ${table}...`);
            const colInfo = await pool.request()
                .input('table', sql.VarChar, table)
                .query(`
                    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
                    FROM INFORMATION_SCHEMA.COLUMNS
                    WHERE TABLE_NAME = @table
                    ORDER BY ORDINAL_POSITION
                `);
            
            const fkInfo = await pool.request()
                .input('table', sql.VarChar, table)
                .query(`
                    SELECT
                        OBJECT_NAME(f.parent_object_id) AS TableName,
                        COL_NAME(fc.parent_object_id, fc.parent_column_id) AS ColumnName,
                        OBJECT_NAME (f.referenced_object_id) AS ReferenceTableName,
                        COL_NAME(f.referenced_object_id, f.key_index_id) AS ReferenceColumnName
                    FROM sys.foreign_keys AS f
                    INNER JOIN sys.foreign_key_columns AS fc
                        ON f.OBJECT_ID = fc.constraint_object_id
                    WHERE OBJECT_NAME(f.parent_object_id) = @table
                `);

            results[table] = {
                columns: colInfo.recordset,
                foreignKeys: fkInfo.recordset
            };
        }

        console.log(JSON.stringify(results, null, 2));
        await sql.close();
    } catch (err) {
        console.error(err);
    }
}

inspectTables();
