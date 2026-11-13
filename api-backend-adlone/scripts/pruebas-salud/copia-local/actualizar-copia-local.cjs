// Actualización INCREMENTAL de la copia local de LaboratorioADL (instancia ADLLOCAL): trae lo nuevo de producción sin rehacer todo.
// SOLO LEE de producción (SELECT con MAXDOP 1). Escribe únicamente en la instancia local, y se aborta si el destino no es esta máquina.
//   - tablas pequeñas (maestros, facturas, otras ventas, OC, planillas ATV): se reemplazan completas
//   - casos y líneas: se vuelve a traer el rango reciente (--ultimos, 4.000 casos por defecto, unas seis semanas) y los casos antiguos con líneas pendientes
//   - detalle de facturas: solo las facturas nuevas, cambiadas o eliminadas
//   - procedimientos de ADLSOFT y guías de despacho (Abastecimiento)
// Uso:   node actualizar-copia-local.cjs <contraseña sa local> [--ultimos=4000] [--solo-ver]
// Antes: detener el backend de ADL ONE y, si hay pruebas que conservar, sacarlas (las filas del rango reciente se reemplazan).
// Termina comparando producción contra la copia (casos, líneas pendientes, facturas y contadores).
const os = require('os');
process.chdir('C:/Users/vremolcoy/Desktop/WebClientesV2/app/backend');
require('C:/Users/vremolcoy/Desktop/WebClientesV2/app/backend/node_modules/dotenv').config();
const sql = require('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/node_modules/mssql');
const LIMITE_MB_COMPLETA = 60;
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toTimeString().slice(0, 8), ...a);
const origenCfg = (database) => ({ user: process.env.DB_USER, password: process.env.DB_PWD, server: process.env.DB_HOST, database, options: { encrypt: true, trustServerCertificate: true }, requestTimeout: 600000, pool: { max: 2, min: 0 } });
const destinoCfg = (database) => ({ user: 'sa', password: process.argv[2], server: 'localhost', port: 14330, database, options: { encrypt: true, trustServerCertificate: true }, requestTimeout: 600000, pool: { max: 2, min: 0 } });

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

// ---- copia a una tabla (o transacción) local, leyendo de producción en streaming ---------------------------------------------------
async function copiarA(orig, destino, tablaOrigen, tablaDestino, cols, where) {
  const lista = cols.map((c) => `[${c.nombre}]`).join(', ');
  const consulta = `SELECT ${lista} FROM dbo.[${tablaOrigen}] ${where ? 'WHERE ' + where : ''} OPTION (MAXDOP 1)`;
  const req = orig.request();
  req.stream = true;
  let lote = [];
  let total = 0;
  const volcar = async () => {
    if (!lote.length) return;
    const t = new sql.Table(`[dbo].[${tablaDestino}]`);
    t.create = false;
    for (const c of cols) t.columns.add(c.nombre, tipoBulk(c), { nullable: !!c.nulo });
    for (const f of lote) t.rows.add(...cols.map((c) => f[c.nombre]));
    await destino.request().bulk(t);
    total += lote.length;
    lote = [];
  };
  await new Promise((resolve, reject) => {
    let cola = Promise.resolve();
    req.on('row', (fila) => {
      lote.push(fila);
      if (lote.length >= 10000) { req.pause(); cola = cola.then(volcar).then(() => req.resume()).catch(reject); }
    });
    req.on('error', reject);
    req.on('done', () => { cola.then(volcar).then(resolve).catch(reject); });
    req.query(consulta);
  });
  return total;
}
const utiles = (cols) => cols.filter((c) => !c.calc && !['timestamp', 'rowversion'].includes(c.tipo.toLowerCase()));
const trozos = (lista, n) => { const r = []; for (let i = 0; i < lista.length; i += n) r.push(lista.slice(i, i + n)); return r; };

(async () => {
  const pwd = process.argv[2];
  const atras = Number((process.argv.find((a) => a.startsWith('--ultimos=')) || '').split('=')[1]) || 4000; // cuántos casos hacia atrás se vuelven a traer
  const soloVer = process.argv.includes('--solo-ver');
  if (!pwd) { console.log('Uso: node actualizar-copia-local.cjs <contraseña sa local> [--ultimos=4000] [--solo-ver]'); process.exit(1); }
  const t0 = Date.now();

  // ---- seguridad: el destino TIENE que ser la instancia local de esta máquina, y el origen otro servidor -----------------------
  const dest = await new sql.ConnectionPool(destinoCfg('LaboratorioADL')).connect();
  const sd = (await dest.request().query("SELECT @@SERVERNAME s, CAST(SERVERPROPERTY('MachineName') AS nvarchar(100)) m")).recordset[0];
  if (!/ADLLOCAL/i.test(sd.s) || String(sd.m).toLowerCase() !== os.hostname().toLowerCase()) { console.log('ABORTO: el destino no es la instancia local de esta máquina:', sd.s, sd.m); process.exit(2); }
  let orig = await new sql.ConnectionPool(origenCfg('LaboratorioADL')).connect();
  const so = (await orig.request().query('SELECT @@SERVERNAME s')).recordset[0].s;
  if (String(so).toLowerCase() === String(sd.s).toLowerCase() || /ADLLOCAL/i.test(so)) { console.log('ABORTO: el origen no puede ser la instancia local:', so); process.exit(2); }
  log(`Origen (solo lectura): ${so}  ->  Destino: ${sd.s}`);

  const q = async (s) => { for (let i = 1; ; i++) { try { return (await orig.request().query(`SET DATEFORMAT dmy; ${s} OPTION (MAXDOP 1)`)).recordset; } catch (e) { if (i >= 3) throw new Error('consulta de origen: ' + e.message); log('reintento de lectura:', e.message); try { await orig.close(); } catch { /* ya cerrada */ } await pausa(2000); orig = await new sql.ConnectionPool(origenCfg('LaboratorioADL')).connect(); } } };
  const ql = async (s) => (await dest.request().query(`SET DATEFORMAT dmy; ${s}`)).recordset;

  // ---- qué refrescar -----------------------------------------------------------------------------------------------------------
  const umbralLocal = Number((await ql('SELECT MIN(id_caso) id FROM muestras'))[0].id);
  const maxLocal = Number((await ql('SELECT MAX(id_caso) id FROM muestras'))[0].id);
  // se vuelve a traer todo lo que esté por encima de (último caso de la copia − N): los casos nuevos y los de las últimas semanas, que son los que siguen cambiando
  // (no se usa la fecha de recepción: un caso con la fecha mal digitada movería el límite y obligaría a traer miles de casos de más)
  const idDesde = Math.max(maxLocal - atras, umbralLocal);
  const maxProd = Number((await q('SELECT MAX(id_caso) id FROM muestras'))[0].id);
  const pend = 'estado = \'ENVIADO\' AND ISNULL(id_facturacion, 0) = 0';
  const pendProdViejos = (await q(`SELECT DISTINCT id_caso FROM muestras_detalle WHERE ${pend} AND id_caso >= ${umbralLocal} AND id_caso < ${idDesde}`)).map((r) => Number(r.id_caso));
  const pendLocalViejos = (await ql(`SELECT DISTINCT id_caso FROM muestras_detalle WHERE ${pend} AND id_caso >= ${umbralLocal} AND id_caso < ${idDesde}`)).map((r) => Number(r.id_caso));
  const viejos = [...new Set([...pendProdViejos, ...pendLocalViejos])];
  const nuevosEnProd = Number((await q(`SELECT COUNT(*) n FROM muestras WHERE id_caso > ${maxLocal}`))[0].n);
  log(`Casos: la copia llega a ${maxLocal}, producción a ${maxProd} (${nuevosEnProd} casos nuevos). Se refresca desde el caso ${idDesde} (los últimos ${atras} casos de la copia) y ${viejos.length} casos anteriores con líneas pendientes.`);

  // ---- facturación: facturas nuevas, eliminadas o cambiadas ---------------------------------------------------------------------
  const resumenDet = async (consulta) => new Map((await consulta('SELECT id_facturacion, COUNT(*) n, CAST(SUM(CAST(vtatotal AS float)) AS decimal(18,3)) s FROM facturacion_det GROUP BY id_facturacion')).map((r) => [Number(r.id_facturacion), `${r.n}|${r.s}`]));
  const dProd = await resumenDet(q); const dLocal = await resumenDet(ql);
  const detCopiar = [...dProd.keys()].filter((id) => dLocal.get(id) !== dProd.get(id));
  const detBorrar = [...dLocal.keys()].filter((id) => dLocal.get(id) !== dProd.get(id));
  log(`Detalle de facturas: ${detCopiar.length} facturas por traer o actualizar, ${detBorrar.filter((id) => !dProd.has(id)).length} eliminadas en producción.`);

  if (soloVer) { log('--solo-ver: no se escribió nada.'); await verificar(); await dest.close(); await orig.close(); return; }

  // ---- 1) tablas pequeñas: se reemplazan completas (se copia a una tabla nueva y se cambia al final: si algo falla, la original queda) --------
  const grandes = new Set(['muestras', 'muestras_detalle', 'facturacion_det', 'auditoria']);
  const tam = Object.fromEntries((await q("SELECT OBJECT_NAME(p.object_id) AS tabla, SUM(p.used_page_count)*8/1024 AS mb FROM sys.dm_db_partition_stats p JOIN sys.objects o ON o.object_id=p.object_id AND o.type='U' GROUP BY p.object_id")).map((t) => [String(t.tabla).toLowerCase(), Number(t.mb)]));
  const locales = (await ql("SELECT name FROM sys.tables WHERE schema_id = SCHEMA_ID('dbo')")).map((r) => r.name);
  for (const tabla of locales) {
    if (grandes.has(tabla.toLowerCase()) || (tam[tabla.toLowerCase()] ?? 0) > LIMITE_MB_COMPLETA) continue;
    const cols = utiles(await columnas(orig, tabla));
    const nuevo = `${tabla}__nuevo`;
    await crearTabla(dest, nuevo, cols);
    const n = await copiarA(orig, dest, tabla, nuevo, cols, null);
    const tx = new sql.Transaction(dest); await tx.begin();
    try { await new sql.Request(tx).batch(`DROP TABLE dbo.[${tabla}]; EXEC sp_rename N'dbo.[${nuevo}]', N'${tabla}';`); await tx.commit(); } catch (e) { await tx.rollback(); throw e; }
    log(`  ${tabla}: ${n} filas`);
    await pausa(100);
  }

  // ---- 2) casos y líneas: se borra y se vuelve a traer el rango reciente y los casos viejos con líneas pendientes, en una sola transacción ---
  for (const tabla of ['muestras', 'muestras_detalle']) {
    const a = (await columnas(orig, tabla)).map((c) => c.nombre).join(','); const b = (await columnas(dest, tabla)).map((c) => c.nombre).join(',');
    if (a !== b) { console.log(`ABORTO: la estructura de ${tabla} cambió en producción; usa el refresco completo (crear-copia-local.cjs).`); process.exit(3); }
  }
  const colsM = utiles(await columnas(orig, 'muestras')); const colsD = utiles(await columnas(orig, 'muestras_detalle'));
  let tx = new sql.Transaction(dest); await tx.begin();
  try {
    for (const [tabla, cols] of [['muestras_detalle', colsD], ['muestras', colsM]]) {
      await new sql.Request(tx).batch(`DELETE FROM dbo.[${tabla}] WHERE id_caso >= ${idDesde}`);
      const n = await copiarA(orig, tx, tabla, tabla, cols, `id_caso >= ${idDesde}`);
      log(`  ${tabla} (casos >= ${idDesde}): ${n} filas`);
      for (const lote of trozos(viejos, 400)) {
        await new sql.Request(tx).batch(`DELETE FROM dbo.[${tabla}] WHERE id_caso IN (${lote.join(',')})`);
        await copiarA(orig, tx, tabla, tabla, cols, `id_caso IN (${lote.join(',')})`);
      }
    }
    await tx.commit();
  } catch (e) { await tx.rollback(); throw e; }

  // ---- 3) detalle de facturas: solo las facturas nuevas o cambiadas, y se quitan las eliminadas -------------------------------------
  const colsF = utiles(await columnas(orig, 'facturacion_det'));
  tx = new sql.Transaction(dest); await tx.begin();
  try {
    for (const lote of trozos(detBorrar, 400)) await new sql.Request(tx).batch(`DELETE FROM dbo.facturacion_det WHERE id_facturacion IN (${lote.join(',')})`);
    let n = 0;
    for (const lote of trozos(detCopiar, 400)) n += await copiarA(orig, tx, 'facturacion_det', 'facturacion_det', colsF, `id_facturacion IN (${lote.join(',')})`);
    await tx.commit();
    log(`  facturacion_det: ${n} líneas traídas`);
  } catch (e) { await tx.rollback(); throw e; }

  // ---- 4) procedimientos de ADLSOFT (por si cambiaron) ----------------------------------------------------------------------------
  const defs = await q("SELECT p.name, m.definition AS def, m.uses_ansi_nulls AS an, m.uses_quoted_identifier AS qi FROM sys.procedures p JOIN sys.sql_modules m ON m.object_id = p.object_id WHERE p.name LIKE 'fac[_]%' OR p.name LIKE 'consulta[_]%' OR p.name LIKE 'Consulta%' OR p.name LIKE 'maestro[_]%' OR p.name LIKE 'actualiza_auditoria' OR p.name LIKE 'facturacion[_]%' OR p.name LIKE 'OtrasVentas%'");
  let ok = 0; const fallos = [];
  for (const d of defs) {
    try {
      await dest.request().batch(`IF OBJECT_ID(N'dbo.[${d.name}]') IS NOT NULL DROP PROCEDURE dbo.[${d.name}]`);
      await dest.request().batch(`SET ANSI_NULLS ${d.an ? 'ON' : 'OFF'}; SET QUOTED_IDENTIFIER ${d.qi ? 'ON' : 'OFF'};`);
      await dest.request().batch(d.def); ok++;
    } catch (e) { fallos.push([d.name, e.message.slice(0, 100)]); }
  }
  log(`  procedimientos: ${ok} de ${defs.length}${fallos.length ? ' | con error: ' + fallos.map((f) => f[0]).join(', ') : ''}`);

  // ---- 5) guías de despacho (Abastecimiento) ----------------------------------------------------------------------------------------
  const origAb = await new sql.ConnectionPool(origenCfg('Abastecimiento')).connect();
  const destAb = await new sql.ConnectionPool(destinoCfg('Abastecimiento')).connect();
  for (const tabla of ['gd_enc', 'gd_det']) {
    const cols = utiles(await columnas(origAb, tabla)); const nuevo = `${tabla}__nuevo`;
    await crearTabla(destAb, nuevo, cols);
    const n = await copiarA(origAb, destAb, tabla, nuevo, cols, null);
    const t2 = new sql.Transaction(destAb); await t2.begin();
    try { await new sql.Request(t2).batch(`DROP TABLE dbo.[${tabla}]; EXEC sp_rename N'dbo.[${nuevo}]', N'${tabla}';`); await t2.commit(); } catch (e) { await t2.rollback(); throw e; }
    log(`  Abastecimiento.${tabla}: ${n} filas`);
  }
  await origAb.close(); await destAb.close();

  await verificar();
  log(`LISTO en ${Math.round((Date.now() - t0) / 1000)} s.`);
  await dest.close(); await orig.close();

  // ---- verificación: la copia debe quedar igual a producción en lo que importa para facturar -------------------------------------------
  async function verificar() {
    const pares = [
      ['casos (desde el primero de la copia)', `SELECT COUNT(*) n FROM muestras WHERE id_caso >= ${umbralLocal}`],
      ['líneas de análisis (mismo rango)', `SELECT COUNT(*) n FROM muestras_detalle WHERE id_caso >= ${umbralLocal}`],
      ['líneas PENDIENTES de facturar (mismo rango)', `SELECT COUNT(*) n FROM muestras_detalle WHERE ${pend} AND id_caso >= ${umbralLocal}`],
      ['líneas FACTURADAS (mismo rango)', `SELECT COUNT(*) n FROM muestras_detalle WHERE estado = 'FACTURADO' AND id_caso >= ${umbralLocal}`],
      ['casos FINAL (mismo rango)', `SELECT COUNT(*) n FROM muestras WHERE estado_caso = 'FINAL' AND id_caso >= ${umbralLocal}`],
      ['facturas (facturacion_enc)', 'SELECT COUNT(*) n FROM facturacion_enc'],
      ['facturas emitidas', "SELECT COUNT(*) n FROM facturacion_enc WHERE emitido = 'S'"],
      ['detalle de facturas', 'SELECT COUNT(*) n FROM facturacion_det'],
      ['otras ventas', 'SELECT COUNT(*) n FROM facturacion_otro'],
      ['contador de numeración (Mae_id.id_facturacion)', 'SELECT TOP 1 id_facturacion n FROM Mae_id'],
      ['contador de casos (Mae_id.id_caso)', 'SELECT TOP 1 id_caso n FROM Mae_id']
    ];
    console.log('\nComparación producción vs copia local:');
    let difieren = 0;
    for (const [nombre, consulta] of pares) {
      const p = Number((await q(consulta))[0].n); const l = Number((await ql(consulta))[0].n);
      if (p !== l) difieren++;
      console.log(`  ${p === l ? 'igual' : 'DIFERENTE'}  ${nombre.padEnd(48)} producción ${String(p).padStart(9)} | copia ${String(l).padStart(9)}${p === l ? '' : '  (dif ' + (p - l) + ')'}`);
    }
    console.log(difieren ? `\n${difieren} diferencias: producción está viva (los casos y facturas siguen cambiando); si son pocas y recientes es normal. Vuelve a correr justo antes de probar.` : '\nLa copia coincide con producción en todo lo comparado.');
  }
})().catch((e) => { console.error('ERROR FATAL', e.message); process.exit(1); });
