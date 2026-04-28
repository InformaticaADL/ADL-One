import dotenv from 'dotenv';
dotenv.config();

const { getConnection } = await import('./src/config/database.js');

async function listTables() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE 'mae_%'");
        console.log('TABLAS MAESTRAS ENCONTRADAS:');
        console.log(result.recordset.map(t => t.TABLE_NAME));
        
        // También ver si hay FKs explícitas (aunque no siempre están definidas en el motor)
        const fks = await pool.request().query(`
            SELECT 
                parent_table = OBJECT_NAME(f.parent_object_id),
                parent_column = col.name,
                referenced_table = OBJECT_NAME(f.referenced_object_id),
                referenced_column = refcol.name
            FROM sys.foreign_keys AS f
            INNER JOIN sys.foreign_key_columns AS fc ON f.object_id = fc.constraint_object_id
            INNER JOIN sys.columns AS col ON fc.parent_object_id = col.object_id AND fc.parent_column_id = col.column_id
            INNER JOIN sys.columns AS refcol ON fc.referenced_object_id = refcol.object_id AND fc.referenced_column_id = refcol.column_id
            WHERE OBJECT_NAME(f.parent_object_id) = 'mae_empresaservicios'
        `);
        console.log('\nRELACIONES (FKs) DETECTADAS:');
        console.log(JSON.stringify(fks.recordset, null, 2));
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listTables();
