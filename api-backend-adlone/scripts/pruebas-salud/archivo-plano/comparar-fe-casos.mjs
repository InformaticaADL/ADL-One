process.chdir('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone');
import fs from 'fs';
const base='file:///C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/src/';
const db0 = await import(base+'config/databaseSalud.js');
const ex = await import(base+'services/facturacion-salud.exportacion.js');
const db = await db0.getConnectionSalud();
const [archivo, ...ids] = process.argv.slice(2); const idsN = ids.map(Number);
const lista = (await db.request().query('EXEC dbo.fac_consulta_facturaelectronica_exporta;')).recordset;
const filas = [];
for (const id of idsN) {
  const doc = lista.find((r) => Number(r.id_facturacion) === id);
  if (!doc) { console.log('FACTURA', id, 'no sale en el listado de exportacion'); continue; }
  const oc = (await db.request().query(`EXEC dbo.consulta_facturacion_ocompra @xid_facturacion = ${id}`)).recordset;
  filas.push(...ex.filasDteFacturaCasos(doc, oc));
}
const mio = ex.aBufferAnsi(ex.csvFoxPro(filas));
const real = fs.readFileSync(archivo);
console.log('bytes real:', real.length, '| bytes ADL ONE:', mio.length, '| IDENTICOS:', Buffer.compare(real, mio) === 0);
if (Buffer.compare(real, mio) !== 0) {
  const L = (b) => b.toString('latin1').split('\r\n'); const a = L(real), m = L(mio);
  console.log('lineas real:', a.length, 'ADL ONE:', m.length);
  const csv = (s) => s.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((x) => x.replace(/,$/, '')) || [];
  let n = 0;
  for (let i = 0; i < Math.max(a.length, m.length) && n < 25; i++) if (a[i] !== m[i]) { const ca = csv(a[i] || ''), cm = csv(m[i] || ''); for (let c = 0; c < Math.max(ca.length, cm.length); c++) if (ca[c] !== cm[c]) { console.log(`linea ${i + 1} col ${c + 1}: REAL=${ca[c]}  | ADLONE=${cm[c]}`); n++; } }
}
await db0.closeConnectionSalud(); process.exit(0);
