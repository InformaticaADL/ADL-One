import { getConnection } from './src/config/database.js';

async function checkSchema() {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT TABLE_SCHEMA, TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME LIKE '%web%empresa%'
    `);
    console.log("Tables matching '%web%empresa%':");
    console.log(result.recordset);
    
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkSchema();
