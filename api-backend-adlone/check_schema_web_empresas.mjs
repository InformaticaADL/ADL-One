import { getConnection } from './src/config/database.js';

async function checkSchema() {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'web_empresas'
    `);
    console.log("Columns:");
    console.log(result.recordset);
    
    const constraints = await pool.request().query(`
      SELECT 
          tc.CONSTRAINT_NAME, 
          tc.CONSTRAINT_TYPE, 
          kcu.COLUMN_NAME 
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc 
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME 
      WHERE tc.TABLE_NAME = 'web_empresas'
    `);
    console.log("Constraints:");
    console.log(constraints.recordset);

    const indexes = await pool.request().query(`
        SELECT 
            IndexName = i.name,
            IsUnique = i.is_unique,
            ColumnName = c.name
        FROM 
            sys.indexes i
        INNER JOIN 
            sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        INNER JOIN 
            sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE 
            i.object_id = OBJECT_ID('web_empresas')
    `);
    console.log("Indexes:");
    console.log(indexes.recordset);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkSchema();
