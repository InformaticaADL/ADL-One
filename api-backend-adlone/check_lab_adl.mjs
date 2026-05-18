import sql from 'mssql';

async function checkSchema() {
  const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: 'LaboratorioADL',
    options: {
      encrypt: false, // For local/development environments
      trustServerCertificate: true,
      enableArithAbort: true,
      requestTimeout: 300000
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };

  try {
    const pool = await sql.connect(config);
    
    // Check columns
    const columns = await pool.request().query(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'web_empresas'
    `);
    console.log("--- COLUMNS ---");
    console.log(columns.recordset);
    
    // Check constraints
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
    console.log("--- CONSTRAINTS ---");
    console.log(constraints.recordset);

    // Check indexes
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
    console.log("--- INDEXES ---");
    console.log(indexes.recordset);

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

checkSchema();
