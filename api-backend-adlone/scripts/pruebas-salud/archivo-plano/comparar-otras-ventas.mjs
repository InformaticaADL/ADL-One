process.chdir('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone');
import fs from 'fs';
const base='file:///C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/src/';
const db0 = await import(base+'config/databaseSalud.js');
const ov = await import(base+'services/facturacion-salud.otrasventas.js');
const ex = await import(base+'services/facturacion-salud.exportacion.js');
const db = await db0.getConnectionSalud();
const [archivo, flujo, ...ids] = process.argv.slice(2);
const lista = (await db.request().query(`EXEC dbo.${ov.FLUJOS[flujo].sp};`)).recordset;
const filas = [];
for (const id of ids.map(Number)) {
  const doc = lista.find((r) => Number(r.id_facturacion) === id && Number(r.id_tipodocumento) === ov.FLUJOS[flujo].tipoDoc);
  if (!doc) { console.log('documento', id, 'no sale en el listado del flujo', flujo); continue; }
  const oc = ov.FLUJOS[flujo].conOc ? (await db.request().query(`EXEC dbo.consulta_facturacion_ocompra @xid_facturacion = ${id}`)).recordset : [];
  filas.push(...ov.filasDteDocumento(flujo, doc, oc));
}
const mio = ex.aBufferAnsi(ex.csvFoxPro(filas)); const real = fs.readFileSync(archivo);
console.log('bytes real:', real.length, '| bytes ADL ONE:', mio.length, '| IDENTICOS:', Buffer.compare(real, mio) === 0);
if (Buffer.compare(real, mio) !== 0) { const a = real.toString('latin1').split('\r\n'), m = mio.toString('latin1').split('\r\n'); a.forEach((l, i) => { if (l !== m[i]) { console.log('REAL :', l.slice(0, 600)); console.log('MIO  :', (m[i] || '').slice(0, 600)); } }); }
await db0.closeConnectionSalud(); process.exit(0);
