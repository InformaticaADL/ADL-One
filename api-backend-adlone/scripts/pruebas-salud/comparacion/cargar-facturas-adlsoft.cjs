// Carga a la base de comparación (LaboratorioADL_comparacion, en la copia LOCAL) las facturas que ADLSOFT creó en producción después de
// un id (--desde). SOLO LEE de producción (SELECT con MAXDOP 1); solo escribe en la base de comparación local.
// Uso: node cargar-facturas-adlsoft.cjs <contraseña sa local> --desde=74908 [--origen=produccion|local] [--sin-pausa]
//   --origen=local lee de la copia local (para ensayar el procedimiento sin tocar producción).
const { sql, conectarLocal, conectarProduccion, leerFacturas } = require('./lib-facturas.cjs');
const pwd = process.argv[2];
const arg = (n, d) => (process.argv.find((a) => a.startsWith('--' + n + '=')) || '').split('=')[1] ?? d;
const desde = Number(arg('desde', 0)); const origen = arg('origen', 'produccion');
if (!pwd || !desde) { console.log('Uso: node cargar-facturas-adlsoft.cjs <pwd> --desde=<id_facturacion> [--origen=produccion|local]'); process.exit(1); }
(async () => {
  const master = await conectarLocal(pwd, 'master');
  await master.request().query("IF DB_ID('LaboratorioADL_comparacion') IS NULL CREATE DATABASE LaboratorioADL_comparacion");
  await master.close();
  const dest = await conectarLocal(pwd, 'LaboratorioADL_comparacion');
  await dest.request().query(`IF OBJECT_ID('dbo.filas') IS NULL CREATE TABLE dbo.filas (origen varchar(20) NOT NULL, tabla varchar(40) NOT NULL, id_facturacion int NOT NULL, clave varchar(120) NOT NULL, fila nvarchar(max) NOT NULL, cargado datetime2 NOT NULL DEFAULT SYSDATETIME());
    IF OBJECT_ID('dbo.carga') IS NULL CREATE TABLE dbo.carga (id int IDENTITY PRIMARY KEY, fecha datetime2 DEFAULT SYSDATETIME(), origen varchar(20), servidor varchar(100), desde int, facturas int, filas int)`);
  let pool, servidor;
  if (origen === 'local') { pool = await conectarLocal(pwd, 'LaboratorioADL'); servidor = 'LOCAL (ensayo)'; }
  else { const c = await conectarProduccion(); pool = c.pool; servidor = c.servidor; }
  console.log('origen:', origen, '| servidor:', servidor, '| desde id_facturacion >', desde);
  const t0 = Date.now();
  const filas = await leerFacturas(pool, desde, { pausaMs: process.argv.includes('--sin-pausa') ? 0 : 1500, log: (m) => console.log('  ', m) });
  await pool.close();
  const etiqueta = 'ADLSOFT';
  await dest.request().input('o', sql.VarChar, etiqueta).query('DELETE FROM dbo.filas WHERE origen = @o');
  const tabla = new sql.Table('dbo.filas'); tabla.create = false;
  tabla.columns.add('origen', sql.VarChar(20), { nullable: false }); tabla.columns.add('tabla', sql.VarChar(40), { nullable: false });
  tabla.columns.add('id_facturacion', sql.Int, { nullable: false }); tabla.columns.add('clave', sql.VarChar(120), { nullable: false }); tabla.columns.add('fila', sql.NVarChar(sql.MAX), { nullable: false });
  for (const f of filas) tabla.rows.add(etiqueta, f.tabla, f.id_facturacion, f.clave, JSON.stringify(f.fila));
  await dest.request().bulk(tabla);
  const facturas = filas.filter((f) => f.tabla === 'facturacion_enc').length;
  await dest.request().input('o', sql.VarChar, etiqueta).input('s', sql.VarChar, servidor).input('d', sql.Int, desde).input('f', sql.Int, facturas).input('n', sql.Int, filas.length)
    .query('INSERT dbo.carga (origen, servidor, desde, facturas, filas) VALUES (@o, @s, @d, @f, @n)');
  console.log(`cargadas ${facturas} facturas y ${filas.length} filas en LaboratorioADL_comparacion (${Math.round((Date.now() - t0) / 1000)} s)`);
  await dest.close();
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });
