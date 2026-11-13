// Mini copia de LaboratorioADL (y Abastecimiento) en la instancia local ADLLOCAL.
// SOLO LEE de producción (SELECT con MAXDOP 1). Escribe únicamente en la instancia local.
// Uso: node crear-copia-local.cjs <contraseña sa local> [meses de historia, 18 por defecto]
process.chdir('C:/Users/vremolcoy/Desktop/WebClientesV2/app/backend');
require('C:/Users/vremolcoy/Desktop/WebClientesV2/app/backend/node_modules/dotenv').config();
const sql = require('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/node_modules/mssql');
const MESES = Number(process.argv[3]) || 18;
const LIMITE_MB_COMPLETA = 60;
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);

const origenCfg = (database) => ({ user: process.env.DB_USER, password: process.env.DB_PWD, server: process.env.DB_HOST, database, options: { encrypt: true, trustServerCertificate: true }, requestTimeout: 600000, pool: { max: 2, min: 0 } });
const destinoCfg = (database) => ({ user: 'sa', password: process.argv[2], server: 'localhost', port: 14330, database, options: { encrypt: true, trustServerCertificate: true }, requestTimeout: 600000, pool: { max: 1, min: 1 } });

// ---- tipos ---------------------------------------------------------------------------------------------------------------
function ddlTipo(c) {
  const t = c.tipo.toLowerCase();
  const len = (n) => (n === -1 ? 'MAX' : String(n));
  if (['varchar', 'char', 'varbinary', 'binary'].includes(t)) return `${t}(${len(c.max_length)})`;
  if (['nvarchar', 'nchar'].includes(t)) return `${t}(${c.max_length === -1 ? 'MAX' : c.max_length / 2})`;
  if (['numeric', 'decimal'].includes(t)) return `${t}(${c.precision},${c.scale})`;
  if (['datetime2', 'time', 'datetimeoffset'].includes(t)) return `${t}(${c.scale})`;
  if (t === 'text') return 'varchar(MAX)';
  if (t === 'ntext') return 'nvarchar(MAX)';
  if (t === 'image') return 'varbinary(MAX)';
  if (t === 'timestamp' || t === 'rowversion') return 'binary(8)';
  return t;
}
function tipoBulk(c) {
  const t = c.tipo.toLowerCase();
  const n = c.max_length === -1 ? sql.MAX : c.max_length;
  switch (t) {
    case 'varchar': case 'text': return sql.VarChar(t === 'text' ? sql.MAX : n);
    case 'char': return sql.Char(n);
    case 'nvarchar': case 'ntext': return sql.NVarChar(t === 'ntext' || c.max_length === -1 ? sql.MAX : c.max_length / 2);
    case 'nchar': return sql.NChar(c.max_length / 2);
    case 'numeric': return sql.Numeric(c.precision, c.scale);
    case 'decimal': return sql.Decimal(c.precision, c.scale);
    case 'int': return sql.Int; case 'bigint': return sql.BigInt; case 'smallint': return sql.SmallInt; case 'tinyint': return sql.TinyInt;
    case 'bit': return sql.Bit; case 'float': return sql.Float; case 'real': return sql.Real;
    case 'money': return sql.Money; case 'smallmoney': return sql.SmallMoney;
    case 'datetime': return sql.DateTime; case 'smalldatetime': return sql.SmallDateTime; case 'date': return sql.Date;
    case 'datetime2': return sql.DateTime2(c.scale); case 'time': return sql.Time(c.scale);
    case 'uniqueidentifier': return sql.UniqueIdentifier;
    case 'varbinary': case 'binary': case 'image': case 'timestamp': case 'rowversion': return sql.VarBinary(c.max_length === -1 || t === 'image' ? sql.MAX : c.max_length);
    default: return sql.VarChar(sql.MAX);
  }
}

async function columnas(pool, tabla) {
  return (await pool.request().input('t', sql.NVarChar(128), tabla).query(`
    SELECT c.name AS nombre, ty.name AS tipo, c.max_length, c.precision, c.scale, c.is_nullable AS nulo, c.is_identity AS ident, c.is_computed AS calc
    FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID(QUOTENAME(@t)) AND ty.name <> 'sysname' ORDER BY c.column_id;`)).recordset;
}

async function crearTabla(dest, tabla, cols) {
  const defs = cols.filter((c) => !c.calc && !['timestamp', 'rowversion'].includes(c.tipo.toLowerCase())).map((c) => `[${c.nombre}] ${ddlTipo(c)} ${c.nulo ? 'NULL' : 'NOT NULL'}`);
  await dest.request().batch(`IF OBJECT_ID(N'dbo.${tabla}') IS NOT NULL DROP TABLE dbo.[${tabla}]; CREATE TABLE dbo.[${tabla}] (${defs.join(', ')});`);
  return cols.filter((c) => !c.calc && !['timestamp', 'rowversion'].includes(c.tipo.toLowerCase()));
}

async function copiarDatos(orig, dest, tabla, cols, where) {
  const lista = cols.map((c) => `[${c.nombre}]`).join(', ');
  const consulta = `SELECT ${lista} FROM dbo.[${tabla}] ${where ? 'WHERE ' + where : ''} OPTION (MAXDOP 1)`;
  const req = orig.request();
  req.stream = true;
  let lote = [];
  let total = 0;
  const volcar = async () => {
    if (!lote.length) return;
    const t = new sql.Table(`[dbo].[${tabla}]`);
    t.create = false;
    for (const c of cols) t.columns.add(c.nombre, tipoBulk(c), { nullable: !!c.nulo });
    for (const f of lote) t.rows.add(...cols.map((c) => f[c.nombre]));
    await dest.request().bulk(t);
    total += lote.length;
    lote = [];
  };
  await new Promise((resolve, reject) => {
    let cola = Promise.resolve();
    req.on('row', (fila) => {
      lote.push(fila);
      if (lote.length >= 10000) {
        req.pause();
        cola = cola.then(volcar).then(() => req.resume()).catch(reject);
      }
    });
    req.on('error', reject);
    req.on('done', () => { cola.then(volcar).then(resolve).catch(reject); });
    req.query(consulta);
  });
  return total;
}

(async () => {
  let orig = await new sql.ConnectionPool(origenCfg('LaboratorioADL')).connect();
  const master = await new sql.ConnectionPool(destinoCfg('master')).connect();
  // si producción corta la conexión se reconecta y se repite la consulta (hasta 3 veces)
  const q = async (s) => {
    for (let i = 1; ; i++) {
      try { return (await orig.request().query(s)).recordset; } catch (e) {
        if (i >= 3) throw new Error('consulta de origen: ' + e.message);
        log('reintento de lectura:', e.message); try { await orig.close(); } catch { /* ya cerrada */ }
        await pausa(2000); orig = await new sql.ConnectionPool(origenCfg('LaboratorioADL')).connect();
      }
    }
  };

  // ---- bases locales ----------------------------------------------------------------------------------------------------
  for (const bd of ['LaboratorioADL', 'Abastecimiento']) {
    await master.request().batch(`IF DB_ID(N'${bd}') IS NULL CREATE DATABASE [${bd}] COLLATE Modern_Spanish_CI_AS;`);
    // los ALTER DATABASE se hacen solo si hace falta: después de ejecutarlos, las conexiones nuevas fallan un rato (ECONNRESET)
    const est = (await master.request().query(`SELECT recovery_model_desc AS r, compatibility_level AS c FROM sys.databases WHERE name = N'${bd}'`)).recordset[0];
    if (est.r !== 'SIMPLE') await master.request().batch(`ALTER DATABASE [${bd}] SET RECOVERY SIMPLE;`);
    if (est.c > 110 || est.c < 100) {
      try { await master.request().batch(`ALTER DATABASE [${bd}] SET COMPATIBILITY_LEVEL = 100;`); } catch { await master.request().batch(`ALTER DATABASE [${bd}] SET COMPATIBILITY_LEVEL = 110;`); }
    }
  }
  // El SQL Server local rechaza una conexión nueva mientras otra de este mismo proceso ya hizo consultas (ECONNRESET): se usa una sola a la vez
  await master.close();
  log('bases locales listas');
  log('conectando al destino…');
  const conectar = async (bd) => { for (let i = 1; ; i++) { try { return await new sql.ConnectionPool(destinoCfg(bd)).connect(); } catch (e) { if (i >= 20) throw e; log('reintentando conexión a', bd, '-', e.message); await pausa(3000); } } };
  const dest = await conectar('LaboratorioADL');
  log('destino conectado');

  // ---- qué tablas ---------------------------------------------------------------------------------------------------------
  log('leyendo la lista de procedimientos de origen…');
  const procs = await q("SELECT name FROM sys.procedures WHERE name LIKE 'fac[_]%' OR name LIKE 'consulta[_]%' OR name LIKE 'Consulta%' OR name LIKE 'maestro[_]%' OR name LIKE 'actualiza_auditoria' OR name LIKE 'facturacion[_]%' OR name LIKE 'OtrasVentas%'");
  const nombres = procs.map((p) => `'${p.name}'`).join(',');
  log('leyendo dependencias…');
  const dep = await q(`SELECT DISTINCT d.referenced_entity_name AS nombre FROM sys.sql_expression_dependencies d JOIN sys.objects p ON p.object_id = d.referencing_id JOIN sys.objects o ON o.object_id = d.referenced_id AND o.type = 'U' WHERE p.name IN (${nombres})`);
  log('dependencias leídas');
  const extra = await q("SELECT name AS nombre FROM sys.tables WHERE name LIKE 'mae[_]%' OR name LIKE 'facturacion%' OR name IN ('Mae_id','auditoria','atv_planilla','muestras','muestras_detalle')");
  const tablas = [...new Set([...dep, ...extra].map((t) => t.nombre))].sort();
  log('leyendo tamaños…');
  const tam = Object.fromEntries((await q("SELECT OBJECT_NAME(p.object_id) AS tabla, SUM(p.used_page_count)*8/1024 AS mb FROM sys.dm_db_partition_stats p JOIN sys.objects o ON o.object_id=p.object_id AND o.type='U' GROUP BY p.object_id")).map((t) => [t.tabla, t.mb]));
  // la base de producción tiene nivel de compatibilidad 100: no existe TRY_CONVERT, se valida la fecha con ISDATE
  const umbral = (await q(`SET DATEFORMAT dmy; SELECT MIN(id_caso) AS id FROM muestras WHERE CASE WHEN ISDATE(fecha_recepcion) = 1 THEN CONVERT(datetime, fecha_recepcion, 103) END >= DATEADD(month, -${MESES}, GETDATE())`))[0].id;
  log(`tablas a crear: ${tablas.length} | casos desde id_caso ${umbral} (${MESES} meses)`);

  const resumen = [];
  for (const tabla of tablas) {
    try {
      const cols = await crearTabla(dest, tabla, await columnas(orig, tabla));
      const mb = tam[tabla] || 0;
      let where = null;
      let copiar = mb <= LIMITE_MB_COMPLETA;
      if (tabla === 'muestras' || tabla === 'muestras_detalle') { where = `id_caso >= ${umbral}`; copiar = true; }
      if (['auditoria'].includes(tabla)) copiar = false;
      if (tabla === 'facturacion_det') copiar = true;
      let n = 0;
      if (copiar) n = await copiarDatos(orig, dest, tabla, cols, where);
      resumen.push([tabla, copiar ? n : 'vacía', mb]);
      log(`  ${tabla}: ${copiar ? n + ' filas' : 'solo estructura'} (${mb} MB en origen)`);
      await pausa(150);
    } catch (e) {
      log(`  ERROR en ${tabla}: ${e.message}`);
      resumen.push([tabla, 'ERROR ' + e.message, 0]);
    }
  }

  // ---- procedimientos ---------------------------------------------------------------------------------------------------------
  const defs = await q(`SELECT p.name, m.definition AS def, m.uses_ansi_nulls AS an, m.uses_quoted_identifier AS qi FROM sys.procedures p JOIN sys.sql_modules m ON m.object_id = p.object_id WHERE p.name IN (${nombres})`);
  let ok = 0; const fallos = [];
  for (const d of defs) {
    try {
      await dest.request().batch(`IF OBJECT_ID(N'dbo.[${d.name}]') IS NOT NULL DROP PROCEDURE dbo.[${d.name}]`);
      await dest.request().batch(`SET ANSI_NULLS ${d.an ? 'ON' : 'OFF'}; SET QUOTED_IDENTIFIER ${d.qi ? 'ON' : 'OFF'};`);
      await dest.request().batch(d.def);
      ok++;
    } catch (e) { fallos.push([d.name, e.message.slice(0, 120)]); }
  }
  log(`procedimientos creados: ${ok} de ${defs.length}; con error: ${fallos.length}`);
  fallos.slice(0, 15).forEach(([n, m]) => log('  FALLO', n, m));

  // ---- Abastecimiento (guías de despacho) ---------------------------------------------------------------------------------------
  const origAb = await new sql.ConnectionPool(origenCfg('Abastecimiento')).connect();
  const tam2 = (await dest.request().query("SELECT SUM(size)*8/1024 AS mb FROM sys.database_files WHERE type = 0")).recordset[0].mb;
  await dest.close();
  const destAb = await conectar('Abastecimiento');
  for (const tabla of ['gd_enc', 'gd_det']) {
    const cols = await crearTabla(destAb, tabla, await columnas(origAb, tabla));
    const n = await copiarDatos(origAb, destAb, tabla, cols, null);
    log(`  Abastecimiento.${tabla}: ${n} filas`);
  }
  const spAb = (await origAb.request().query("SELECT m.definition AS def FROM sys.sql_modules m WHERE m.object_id = OBJECT_ID('dbo.fac_guiasdespachoclientes')")).recordset[0];
  if (spAb) { await destAb.request().batch("IF OBJECT_ID(N'dbo.fac_guiasdespachoclientes') IS NOT NULL DROP PROCEDURE dbo.fac_guiasdespachoclientes"); await destAb.request().batch(spAb.def); log('  Abastecimiento: procedimiento de guías creado'); }

  log(`LISTO. LaboratorioADL local: ${tam2} MB de datos. Tablas con error: ${resumen.filter((r) => String(r[1]).startsWith('ERROR')).length}`);
  await Promise.all([orig.close(), origAb.close(), destAb.close()]);
})().catch((e) => { console.error('ERROR FATAL', e.message); process.exit(1); });
