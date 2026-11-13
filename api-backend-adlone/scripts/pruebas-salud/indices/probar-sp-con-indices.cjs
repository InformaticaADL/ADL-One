// PRUEBA DE SEGURIDAD DE INDICES: ejecuta TODOS los procedimientos de LaboratorioADL (copia LOCAL) con parametros de ejemplo y guarda,
// por procedimiento, un hash de lo que devuelve (filas ordenadas) o el error. Se corre antes y despues de crear los indices y se comparan
// con comparar-sp.cjs. Cada ejecucion va dentro de una transaccion que se deshace. Solo copia local.
// Uso: node probar-sp-con-indices.cjs <contraseña sa local> <etiqueta> [filtroNombre]
const sql = require('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/node_modules/mssql');
const crypto = require('crypto'); const fs = require('fs');
const cfg = (database) => ({ user: 'sa', password: process.argv[2], server: 'localhost', port: 14330, database, options: { encrypt: true, trustServerCertificate: true }, requestTimeout: 180000, pool: { max: 1 } });
const FECHA_INI = '2026-01-01', FECHA_FIN = '2026-11-10';
const valor = (nombre, tipo, ej) => {
  const n = nombre.toLowerCase().replace('@', '');
  if (/date|time/.test(tipo)) return new Date(/fin|hasta|term/.test(n) ? FECHA_FIN : FECHA_INI);
  if (/char|text/.test(tipo)) {
    if (/fecha|fec_|desde|hasta|ini|fin/.test(n)) return /fin|hasta/.test(n) ? '10/11/2026' : '01/01/2026';
    if (/factura/.test(n)) return '31873';
    if (/rut/.test(n)) return '76.000.000-0';
    if (/estado/.test(n)) return 'ENVIADO';
    return 'a';
  }
  if (/bit/.test(tipo)) return 0;
  if (/empresa/.test(n)) return ej.empresa;
  if (/caso/.test(n)) return ej.caso;
  if (/facturacion/.test(n)) return ej.fact;
  if (/factura/.test(n)) return 31873;
  if (/uf|dolar|valor/.test(n)) return 41242.32;
  if (/programa|eligeprograma/.test(n)) return 1;
  if (/ano|anio|year/.test(n)) return 2026;
  if (/mes/.test(n)) return 10;
  return 1;
};
const tipoMssql = (t) => ({ int: sql.Int, bigint: sql.BigInt, smallint: sql.SmallInt, tinyint: sql.TinyInt, bit: sql.Bit, decimal: sql.Float, numeric: sql.Float, float: sql.Float, real: sql.Float, money: sql.Float, smallmoney: sql.Float, datetime: sql.DateTime, smalldatetime: sql.DateTime, date: sql.Date, datetime2: sql.DateTime, char: sql.VarChar, varchar: sql.VarChar, nchar: sql.NVarChar, nvarchar: sql.NVarChar, text: sql.VarChar, ntext: sql.NVarChar }[t] || sql.VarChar);
(async () => {
  const p = await new sql.ConnectionPool(cfg('LaboratorioADL')).connect();
  const info = (await p.request().query(`SELECT @@SERVERNAME s, (SELECT compatibility_level FROM sys.databases WHERE name=DB_NAME()) compat, (SELECT COUNT(*) FROM sys.indexes WHERE type=2) indices`)).recordset[0];
  if (!/ADLLOCAL/i.test(info.s)) throw new Error('NO ES LA COPIA LOCAL: ' + info.s);
  console.log('servidor', info.s, '| compat', info.compat, '| indices no clustered', info.indices);
  const ej = { empresa: 96, caso: (await p.request().query('SELECT TOP 1 id_caso c FROM facturacion_det WHERE id_facturacion = 74609')).recordset[0]?.c || 1, fact: 74609 };
  const antes = (await p.request().query('SELECT (SELECT COUNT(*) FROM facturacion_enc) a, (SELECT COUNT(*) FROM facturacion_det) b, (SELECT COUNT(*) FROM muestras_detalle) c, (SELECT SUM(CAST(ISNULL(id_facturacion,0) AS bigint)) FROM muestras_detalle) d')).recordset[0];
  const filtro = process.argv[4] ? new RegExp(process.argv[4], 'i') : null;
  const sps = (await p.request().query(`SELECT o.object_id id, o.name FROM sys.objects o WHERE o.type = 'P' AND o.is_ms_shipped = 0 ORDER BY o.name`)).recordset.filter((x) => !filtro || filtro.test(x.name));
  const pars = (await p.request().query(`SELECT object_id id, name, TYPE_NAME(user_type_id) t, is_output o FROM sys.parameters WHERE parameter_id > 0`)).recordset;
  const salida = {}; let i = 0;
  for (const sp of sps) {
    i++; const ps = pars.filter((x) => x.id === sp.id);
    const tx = new sql.Transaction(p); await tx.begin();
    const t0 = performance.now(); let r;
    try {
      const rq = new sql.Request(tx);
      for (const x of ps) { const v = valor(x.name, x.t, ej); if (x.o) rq.output(x.name.replace('@', ''), tipoMssql(x.t)); else rq.input(x.name.replace('@', ''), tipoMssql(x.t), v); }
      const res = await rq.execute('dbo.' + sp.name);
      const sets = (res.recordsets || []).map((rs) => rs.map((f) => JSON.stringify(f, (k, v) => (typeof v === 'bigint' ? String(v) : v))).sort());
      const h = crypto.createHash('sha1'); for (const s of sets) { h.update(String(s.length) + '|'); for (const f of s) h.update(f); h.update('#'); }
      r = { hash: h.digest('hex'), conjuntos: sets.length, filas: sets.reduce((a, s) => a + s.length, 0) };
    } catch (e) { r = { error: String(e.message).slice(0, 200) }; }
    try { await tx.rollback(); } catch { /* ya cerrada */ }
    r.ms = Math.round(performance.now() - t0); salida[sp.name] = r;
    if (i % 50 === 0) console.log(i + '/' + sps.length);
  }
  const despues = (await p.request().query('SELECT (SELECT COUNT(*) FROM facturacion_enc) a, (SELECT COUNT(*) FROM facturacion_det) b, (SELECT COUNT(*) FROM muestras_detalle) c, (SELECT SUM(CAST(ISNULL(id_facturacion,0) AS bigint)) FROM muestras_detalle) d')).recordset[0];
  const intacta = JSON.stringify(antes) === JSON.stringify(despues);
  fs.writeFileSync(`sp-${process.argv[3]}.json`, JSON.stringify({ info, ej, intacta, salida }, null, 1));
  const v = Object.values(salida);
  console.log('listo:', v.length, 'procedimientos | con datos:', v.filter((x) => x.filas > 0).length, '| vacios:', v.filter((x) => x.filas === 0).length, '| con error:', v.filter((x) => x.error).length, '| base intacta:', intacta);
  await p.close();
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });
