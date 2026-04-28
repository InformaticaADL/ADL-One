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
    console.log('✅ Connected to SQL Server');

    // Expand additional problematic columns
    const query = `
      ALTER TABLE mae_empresaservicios ALTER COLUMN lote_facturacion VARCHAR(20);
      ALTER TABLE mae_empresaservicios ALTER COLUMN precio_lista VARCHAR(50);
      ALTER TABLE mae_empresaservicios ALTER COLUMN rut_empresaservicios VARCHAR(50);
      ALTER TABLE mae_empresaservicios ALTER COLUMN rlegal_rut VARCHAR(50);
      ALTER TABLE mae_empresaservicios ALTER COLUMN rlegal_nombre VARCHAR(200);
      ALTER TABLE mae_empresaservicios ALTER COLUMN fono_empresaservicios VARCHAR(100);
      ALTER TABLE mae_empresaservicios ALTER COLUMN fono_contacto VARCHAR(100);
    `;

    await pool.request().query(query);
    console.log('✅ Columns expanded successfully');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();
