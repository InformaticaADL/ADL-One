import { getConnection } from './src/config/database.js';

async function checkSchema() {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'mae_empresa'
    `);
    console.log(result.recordset);
    
    const constraints = await pool.request().query(`
      SELECT 
          tc.CONSTRAINT_NAME, 
          tc.CONSTRAINT_TYPE, 
          kcu.COLUMN_NAME 
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc 
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME 
      WHERE tc.TABLE_NAME = 'mae_empresa'
    `);
    console.log("Constraints:");
    console.log(constraints.recordset);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkSchema();
