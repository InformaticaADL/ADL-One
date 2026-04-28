import sql from 'mssql';

const config = {
  server: '192.168.10.5',
  port: 1433,
  database: 'PruebasInformatica',
  user: 'sa',
  password: 'MGmerlin.10',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function listColumns() {
    try {
        const pool = await sql.connect(config);
        const colRes = await pool.request().query(`
            SELECT TABLE_NAME, COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME IN ('mae_empresa', 'mae_contacto', 'mae_centro', 'mae_empresaservicios')
        `);
        console.log('COLUMNS:', JSON.stringify(colRes.recordset));
        
        await pool.close();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listColumns();
