// Biblioteca común de la comparación ADLSOFT vs ADL ONE. SOLO LEE de la base de origen.
const sql = require('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/node_modules/mssql');

const TABLAS_FACTURA = ['facturacion_enc', 'facturacion_det', 'facturacion_otro', 'facturacion_ing', 'facturacion_des', 'facturacion_oc', 'facturacion_ocompra'];
const num = (v) => Number(v) || 0;

const cfgLocal = (pwd, database) => ({ user: 'sa', password: pwd, server: 'localhost', port: 14330, database, options: { encrypt: true, trustServerCertificate: true }, requestTimeout: 600000 });

/** Conexión a la copia local; aborta si no es la instancia local de esta máquina. */
async function conectarLocal(pwd, database) {
  const m = await new sql.ConnectionPool(cfgLocal(pwd, 'master')).connect();
  const r = (await m.request().query("SELECT @@SERVERNAME s, CAST(SERVERPROPERTY('MachineName') AS nvarchar(100)) m")).recordset[0];
  await m.close();
  if (!/ADLLOCAL/i.test(r.s) || r.m.toUpperCase() !== require('os').hostname().toUpperCase()) throw new Error('NO ES LA COPIA LOCAL DE ESTA MAQUINA: ' + r.s);
  return new sql.ConnectionPool(cfgLocal(pwd, database)).connect();
}

/** Conexión a producción (192.168.10.5) con las credenciales del backend de WebClientes. SOLO SE USA PARA SELECT. */
async function conectarProduccion() {
  const path = 'C:/Users/vremolcoy/Desktop/WebClientesV2/app/backend/';
  require(path + 'node_modules/dotenv').config({ path: path + '.env' });
  const p = await new sql.ConnectionPool({ server: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PWD, database: process.env.DB_LIMS, options: { encrypt: false, trustServerCertificate: true }, requestTimeout: 600000 }).connect();
  const s = (await p.request().query('SELECT @@SERVERNAME s')).recordset[0].s;
  if (/ADLLOCAL/i.test(s)) throw new Error('Se esperaba producción y es la copia local');
  return { pool: p, servidor: s };
}

const norm = (v) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'number') return String(Math.round(v * 10000) / 10000);
  if (Buffer.isBuffer(v)) return v.toString('hex');
  return String(v).trim();
};

/**
 * Lee de una base (producción o copia) las facturas con id_facturacion > desde, sus tablas hijas y las líneas (muestras_detalle) de sus casos.
 * Devuelve filas planas {tabla, id_facturacion, clave, fila}. Todas las consultas van con MAXDOP 1 y una pausa entre tablas
 * (las tablas hijas no tienen índice por id_facturacion: son lecturas completas de tabla).
 */
async function leerFacturas(pool, desde, { pausaMs = 1500, log = () => {} } = {}) {
  const filas = [];
  const pausa = () => new Promise((r) => setTimeout(r, pausaMs));
  for (const t of TABLAS_FACTURA) {
    const rs = (await pool.request().input('d', sql.Int, desde).query(`SELECT * FROM dbo.${t} WHERE id_facturacion > @d OPTION (MAXDOP 1)`)).recordset;
    const orden = rs.map((f) => ({ f, j: JSON.stringify(f) })).sort((a, b) => (a.j < b.j ? -1 : 1));
    orden.forEach(({ f }, i) => {
      const id = num(f.id_facturacion);
      const clave = t === 'facturacion_enc' ? String(id) : t === 'facturacion_det' ? `${num(f.id_caso)}|${norm(f.item)}` : `#${i}`;
      filas.push({ tabla: t, id_facturacion: id, clave, fila: f });
    });
    log(`${t}: ${rs.length} filas`);
    await pausa();
  }
  const casos = [...new Set(filas.filter((x) => x.tabla === 'facturacion_det').map((x) => num(x.fila.id_caso)).filter(Boolean))];
  let lineas = 0;
  for (let i = 0; i < casos.length; i += 400) {
    const trozo = casos.slice(i, i + 400);
    const rs = (await pool.request().query(`SELECT * FROM dbo.muestras_detalle WHERE id_caso IN (${trozo.join(',')}) OPTION (MAXDOP 1)`)).recordset;
    for (const f of rs) filas.push({ tabla: 'muestras_detalle', id_facturacion: num(f.id_facturacion), clave: `${num(f.id_caso)}|${norm(f.id_tecnica)}|${norm(f.item)}|${norm(f.id_organo)}`, fila: f });
    lineas += rs.length;
  }
  log(`muestras_detalle: ${lineas} líneas de ${casos.length} casos`);
  return filas;
}

module.exports = { sql, TABLAS_FACTURA, num, norm, conectarLocal, conectarProduccion, leerFacturas };
