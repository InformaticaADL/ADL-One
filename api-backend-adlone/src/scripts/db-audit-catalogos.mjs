import dotenv from 'dotenv';
dotenv.config();
import sql from 'mssql';

const config = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: true, trustServerCertificate: true, enableArithAbort: true },
};

const pool = await sql.connect(config);

async function describeTable(name) {
  console.log(`\n\n########## ${name} ##########`);
  const cols = await pool.request().query(`
    SELECT c.name AS columna, ty.name AS tipo, c.max_length
    FROM sys.columns c
    JOIN sys.types ty ON c.user_type_id = ty.user_type_id
    WHERE c.object_id = OBJECT_ID('${name}')
    ORDER BY c.column_id
  `);
  console.log('Columnas:', cols.recordset.map(c => `${c.columna}(${c.tipo})`).join(', '));

  const count = await pool.request().query(`SELECT COUNT(*) AS n FROM ${name}`);
  console.log(`Total filas: ${count.recordset[0].n}`);

  const sample = await pool.request().query(`SELECT TOP 20 * FROM ${name} ORDER BY 1`);
  console.log('Muestra (primeras 20):');
  for (const row of sample.recordset) {
    console.log(' ', JSON.stringify(row));
  }
}

await describeTable('mae_zonas');
await describeTable('mae_zonageografica');
await describeTable('mae_tipoagua');
await describeTable('mae_barrio');

// Duplicados por nombre dentro de cada catálogo
console.log('\n\n########## Duplicados internos por nombre ##########');
for (const [table, col] of [['mae_zonas','nombre_zona'],['mae_tipoagua','nombre_tipoagua'],['mae_barrio','nombre_barrio']]) {
  try {
    const dup = await pool.request().query(`
      SELECT RTRIM(${col}) AS nombre, COUNT(*) AS n
      FROM ${table}
      GROUP BY RTRIM(${col})
      HAVING COUNT(*) > 1
    `);
    console.log(`${table}: ${dup.recordset.length} nombres duplicados`);
    for (const r of dup.recordset) console.log(`  "${r.nombre}": ${r.n}`);
  } catch (e) {
    console.log(`${table}: error -> ${e.message}`);
  }
}

// mae_zonageografica no tiene nombre_ column obvio -> listar columnas ya lo hizo arriba

await pool.close();
