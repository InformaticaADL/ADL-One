import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function run() {
  try {
    const pool = await sql.connect(config);
    const result = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'mae_empresaservicios' 
      AND DATA_TYPE = 'varchar' 
      AND CHARACTER_MAXIMUM_LENGTH > 0 
      AND CHARACTER_MAXIMUM_LENGTH < 100
    `);
    console.log(JSON.stringify(result.recordset, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
