// Compara dos corridas de probar-sp-con-indices.cjs. Uso: node comparar-sp.cjs A B
const fs = require('fs');
const a = JSON.parse(fs.readFileSync(`sp-${process.argv[2]}.json`, 'utf8')), b = JSON.parse(fs.readFileSync(`sp-${process.argv[3]}.json`, 'utf8'));
const nombres = Object.keys(a.salida);
const dif = [], errNuevo = [], lentos = [];
let iguales = 0, conDatos = 0;
for (const n of nombres) {
  const x = a.salida[n], y = b.salida[n];
  if (!y) { dif.push([n, 'no se ejecutó en B']); continue; }
  if ((x.filas || 0) > 0) conDatos++;
  if (x.error || y.error) { if ((x.error || '') !== (y.error || '')) errNuevo.push([n, 'A: ' + (x.error || 'ok'), 'B: ' + (y.error || 'ok')]); else iguales++; }
  else if (x.hash !== y.hash) dif.push([n, `filas ${x.filas} -> ${y.filas}`]);
  else iguales++;
  if (y.ms > 2000 && y.ms > x.ms * 2) lentos.push([n, x.ms + ' ms -> ' + y.ms + ' ms']);
}
const tot = (o) => Object.values(o.salida).reduce((s, v) => s + v.ms, 0);
console.log(`Procedimientos: ${nombres.length} | iguales: ${iguales} | con datos en A: ${conDatos} | resultados distintos: ${dif.length} | errores distintos: ${errNuevo.length}`);
console.log(`Base intacta A: ${a.intacta} B: ${b.intacta} | tiempo total A ${Math.round(tot(a) / 1000)} s, B ${Math.round(tot(b) / 1000)} s`);
for (const d of dif) console.log('DISTINTO ', d.join(' | '));
for (const d of errNuevo) console.log('ERROR    ', d.join(' | '));
for (const d of lentos) console.log('MAS LENTO', d.join(' | '));
