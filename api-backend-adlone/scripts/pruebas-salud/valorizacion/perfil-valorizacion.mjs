// PERFIL DE LA VALORIZACION: cuenta y mide cada consulta que el modulo envia a SQL. SOLO en la copia local (con candado).
process.chdir('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone');
const base = 'file:///C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/src/';
const db0 = await import(base + 'config/databaseSalud.js');
const { facturacionSaludService: s } = await import(base + 'services/facturacion-salud.service.js');
const pool = await db0.getConnectionSalud();
const quien = (await pool.request().query("SELECT @@SERVERNAME s")).recordset[0].s;
if (!/ADLLOCAL/i.test(quien)) { console.log('ABORTO', quien); process.exit(2); }
console.log('Servidor:', quien);

// instrumentacion: envuelve pool.request() para medir cada query/batch
const stats = new Map(); let total = 0, tTotal = 0;
const firma = (t) => { const x = String(t).replace(/\s+/g, ' ').trim().replace(/^SET DATEFORMAT dmy; ?/i, ''); const m = /^EXEC(?:UTE)?\s+(?:dbo\.)?(\w+)/i.exec(x); if (m) return 'EXEC ' + m[1]; const v = /^(SELECT|UPDATE|INSERT|DELETE)\b.*?(?:FROM|INTO|UPDATE)?\s+(?:dbo\.)?(\w+)/i.exec(x); return v ? v[1].toUpperCase() + ' ' + (/(?:FROM|INTO|UPDATE)\s+(?:dbo\.)?(\w+)/i.exec(x)?.[1] || '?') : x.slice(0, 40); };
const origRequest = pool.request.bind(pool);
pool.request = () => {
  const r = origRequest();
  const q = r.query.bind(r);
  r.query = async (t) => { const t0 = performance.now(); try { return await q(t); } finally { const ms = performance.now() - t0; const k = firma(t); const e = stats.get(k) || { n: 0, ms: 0, max: 0 }; e.n++; e.ms += ms; e.max = Math.max(e.max, ms); stats.set(k, e); total++; tTotal += ms; } };
  return r;
};
const resumen = (titulo, t0, desdeN, desdeMs) => console.log(`\n== ${titulo}: ${((performance.now() - t0) / 1000).toFixed(1)} s | consultas: ${total - desdeN} | tiempo de SQL sumado: ${((tTotal - desdeMs) / 1000).toFixed(1)} s`);
const top = (n = 12) => { const filas = [...stats.entries()].map(([k, v]) => ({ consulta: k, veces: v.n, total_s: +(v.ms / 1000).toFixed(2), prom_ms: Math.round(v.ms / v.n), max_ms: Math.round(v.max) })).sort((a, b) => b.total_s - a.total_s).slice(0, n); console.table(filas); stats.clear(); };

const rango = { fecha_proceso_ini: '01/10/2026', fecha_proceso_fin: '09/11/2026' };
const ELIGE = 4; // Servicios Diagnosticos
let n0 = total, m0 = tTotal, t0 = performance.now();
const emp = await s.getEmpresasConCasosElegibles({ eligeprograma: ELIGE, ...rango });
resumen(`1) Empresas con casos por facturar (${emp.length} empresas)`, t0, n0, m0); top(5);

// la empresa con mas casos entre las primeras
let mejor = null;
for (const e of emp.slice(0, 6)) { const c = await s.getCasosElegiblesPorEmpresa({ id_empresaservicio: e.id_empresaservicio, eligeprograma: ELIGE, ...rango }); if (!mejor || c.length > mejor.casos) mejor = { id: e.id_empresaservicio, nombre: String(e.nombre_empresaservicios).trim(), casos: c.length, lineas: c.reduce((a, x) => a + (x.lineas?.length || 0), 0) }; }
stats.clear(); total = 0; tTotal = 0;
console.log('\nEmpresa elegida:', JSON.stringify(mejor));

n0 = total; m0 = tTotal; t0 = performance.now();
const c = await s.getCasosElegiblesPorEmpresa({ id_empresaservicio: mejor.id, eligeprograma: ELIGE, ...rango });
resumen(`2) Leer los ${c.length} casos y sus lineas de la empresa`, t0, n0, m0); top(8);

n0 = total; m0 = tTotal; t0 = performance.now();
const v = await s.valorizarCasosSalud({ id_empresaservicio: mejor.id, eligeprograma: ELIGE, ...rango, valor_uf: 41242.32, valor_usd: 0 });
resumen(`3) VALORIZAR (${v.casosValorizados} casos, ${v.lineasValorizadas} lineas)`, t0, n0, m0); top(14);
await db0.closeConnectionSalud(); process.exit(0);
