// Compara las facturas de ADLSOFT (cargadas en LaboratorioADL_comparacion) con las que ADL ONE creó en la copia local (id_facturacion > desde).
// SOLO LECTURA. Uso: node comparar-facturas.cjs <contraseña sa local> --desde=74908 [--salida=informe.md]
// Empareja primero por id_facturacion (si es la misma empresa y los mismos casos) y, si no, por empresa + conjunto de casos.
const fs = require('fs');
const { sql, num, norm, conectarLocal, leerFacturas } = require('./lib-facturas.cjs');
const pwd = process.argv[2];
const arg = (n, d) => (process.argv.find((a) => a.startsWith('--' + n + '=')) || '').split('=')[1] ?? d;
const desde = Number(arg('desde', 0)); const salida = arg('salida', '');
const desdeB = Number(arg('desdeB', desde)); // las facturas de ADL ONE se buscan con id > desdeB
const soloIds = arg('ids', '') ? new Set(arg('ids', '').split(',').map(Number)) : null; // acotar las facturas de ADLSOFT que se comparan
const esperadas = new Set(arg('esperadas', '').split(',').filter(Boolean)); // columnas cuya diferencia es esperada (ej.: factura,emitido en una prefactura)
if (!pwd || !desde) { console.log('Uso: node comparar-facturas.cjs <pwd> --desde=<id_facturacion> [--salida=informe.md]'); process.exit(1); }

const PISTAS = [
  [/^uf$/, 'UF distinta (cambia el costo operativo y los pesos)'], [/^factura$/, 'folio distinto'],
  [/^(vtaunitario|vtatotal)$/, 'valor de línea distinto: tarifa, UF, valor escrito a mano o regla de jornada'],
  [/^(uf_total|peso_total)/, 'total distinto: mirar las líneas'], [/^(fecha_facturacion|mes|ano)$/, 'fecha o mes de facturación distinto'],
  [/^(glosa|id_glosa|observaciones|nota)$/, 'texto de glosa distinto'], [/^(id_formapago)$/, 'forma de pago distinta'], [/^(emitido|eliminado)$/, 'estado de emisión distinto'],
  [/^(mf|estado)$/, 'estado de la línea distinto']
];
const pista = (col) => (PISTAS.find(([r]) => r.test(col)) || [0, ''])[1];
const IGNORAR = new Set(['id_facturacion']);

const agrupar = (filas) => {
  const f = new Map();
  for (const x of filas) { if (!f.has(x.id_facturacion)) f.set(x.id_facturacion, { enc: null, det: [], hijas: {}, lineas: new Map() }); }
  for (const x of filas) {
    const g = f.get(x.id_facturacion);
    if (x.tabla === 'facturacion_enc') g.enc = x.fila;
    else if (x.tabla === 'facturacion_det') g.det.push(x);
    else if (x.tabla !== 'muestras_detalle') (g.hijas[x.tabla] = g.hijas[x.tabla] || []).push(x.fila);
  }
  return f;
};
const lineasPorCaso = (filas) => { const m = new Map(); for (const x of filas.filter((y) => y.tabla === 'muestras_detalle')) m.set(x.clave, x.fila); return m; };
const casosDe = (g) => g.det.map((d) => num(d.fila.id_caso)).filter(Boolean).sort((a, b) => a - b);
const firma = (g) => `${num(g.enc?.id_empresaservicio)}|${[...new Set(casosDe(g))].join(',')}`;

function difColumnas(a, b) {
  const out = []; const cols = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const c of cols) { if (IGNORAR.has(c)) continue; if (norm(a[c]) !== norm(b[c])) out.push({ col: c, adlsoft: norm(a[c]), adlone: norm(b[c]) }); }
  return out;
}

(async () => {
  const cmp = await conectarLocal(pwd, 'LaboratorioADL_comparacion');
  const carga = (await cmp.request().query("SELECT TOP 1 * FROM dbo.carga ORDER BY id DESC")).recordset[0];
  const rowsA = (await cmp.request().query("SELECT tabla, id_facturacion, clave, fila FROM dbo.filas WHERE origen = 'ADLSOFT'")).recordset.map((r) => ({ ...r, fila: JSON.parse(r.fila, (k, v) => (typeof v === 'string' && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(v) ? new Date(v) : v)) }));
  await cmp.close();
  const loc = await conectarLocal(pwd, 'LaboratorioADL');
  const rowsB = await leerFacturas(loc, desdeB, { pausaMs: 0 });
  await loc.close();

  const A = agrupar(rowsA), B = agrupar(rowsB);
  const LA = lineasPorCaso(rowsA), LB = lineasPorCaso(rowsB);
  const idsA = [...A.keys()].filter((i) => A.get(i).enc && (!soloIds || soloIds.has(i))), idsB = [...B.keys()].filter((i) => B.get(i).enc);
  const pares = []; const usadosB = new Set();
  for (const ia of idsA) {
    let ib = null;
    if (B.has(ia) && B.get(ia).enc && firma(A.get(ia)) === firma(B.get(ia))) ib = ia;
    else { ib = idsB.find((x) => !usadosB.has(x) && firma(B.get(x)) === firma(A.get(ia))) ?? null; }
    if (ib !== null) { usadosB.add(ib); pares.push([ia, ib]); }
  }
  const sinParejaA = idsA.filter((i) => !pares.some((p) => p[0] === i)), sinParejaB = idsB.filter((i) => !usadosB.has(i));

  const lineas = []; let totalDif = 0;
  const informe = [];
  informe.push(`# Comparación ADLSOFT vs ADL ONE`, '', `Generado: ${new Date().toISOString()} · ADLSOFT cargado: ${carga ? carga.fecha.toISOString() + ' desde ' + carga.servidor : '(sin carga)'} · facturas con id > ${desde}`, '',
    `- Facturas ADLSOFT: ${idsA.length} · facturas ADL ONE: ${idsB.length} · emparejadas: ${pares.length}`);
  const detalle = [];
  for (const [ia, ib] of pares) {
    const ga = A.get(ia), gb = B.get(ib); const dif = []; const esp = [];
    for (const d of difColumnas(ga.enc, gb.enc)) { if (esperadas.has(d.col)) { esp.push({ donde: 'encabezado', ...d }); continue; } dif.push({ donde: 'encabezado', ...d }); }
    // detalle de factura (caso|item)
    const ma = new Map(ga.det.map((x) => [x.clave, x.fila])), mb = new Map(gb.det.map((x) => [x.clave, x.fila]));
    for (const k of new Set([...ma.keys(), ...mb.keys()])) {
      if (!ma.has(k)) dif.push({ donde: 'detalle ' + k, col: '(fila)', adlsoft: 'no existe', adlone: 'existe' });
      else if (!mb.has(k)) dif.push({ donde: 'detalle ' + k, col: '(fila)', adlsoft: 'existe', adlone: 'no existe' });
      else for (const d of difColumnas(ma.get(k), mb.get(k))) { if (esperadas.has(d.col)) esp.push({ donde: 'detalle ' + k, ...d }); else dif.push({ donde: 'detalle ' + k, ...d }); }
    }
    // tablas hijas: se comparan como conjunto de filas
    for (const t of new Set([...Object.keys(ga.hijas), ...Object.keys(gb.hijas)])) {
      const fa = (ga.hijas[t] || []).map((f) => JSON.stringify(Object.fromEntries(Object.entries(f).filter(([c]) => !IGNORAR.has(c)).map(([c, v]) => [c, norm(v)])))).sort();
      const fb = (gb.hijas[t] || []).map((f) => JSON.stringify(Object.fromEntries(Object.entries(f).filter(([c]) => !IGNORAR.has(c)).map(([c, v]) => [c, norm(v)])))).sort();
      if (JSON.stringify(fa) !== JSON.stringify(fb)) dif.push({ donde: t, col: '(filas)', adlsoft: fa.length + ' filas', adlone: fb.length + ' filas' });
    }
    // líneas de los casos (valores y estado)
    for (const k of new Set([...ga.det, ...gb.det].map((x) => num(x.fila.id_caso)))) {
      for (const [clave, fa] of LA) {
        if (!clave.startsWith(k + '|')) continue;
        const fb = LB.get(clave);
        if (!fb) { dif.push({ donde: 'línea ' + clave, col: '(fila)', adlsoft: 'existe', adlone: 'no existe' }); continue; }
        for (const d of difColumnas(fa, fb)) { if (esperadas.has(d.col)) esp.push({ donde: 'línea ' + clave, ...d }); else dif.push({ donde: 'línea ' + clave, ...d }); }
      }
    }
    totalDif += dif.length;
    detalle.push({ esp, ia, ib, empresa: num(ga.enc.id_empresaservicio), folioA: norm(ga.enc.factura), casos: new Set(casosDe(ga)).size, dif });
  }
  const identicas = detalle.filter((d) => !d.dif.length).length;
  if (esperadas.size) informe.push(`- Diferencias esperadas (columnas ${[...esperadas].join(', ')}) aparte: ${detalle.reduce((a, d) => a + d.esp.length, 0)}`);
  informe.push(`- Idénticas: **${identicas}** de ${pares.length} · con diferencias: ${pares.length - identicas} (${totalDif} diferencias de columna)`);
  if (sinParejaA.length) informe.push(`- En ADLSOFT sin pareja en ADL ONE: ${sinParejaA.map((i) => `${i} (empresa ${num(A.get(i).enc.id_empresaservicio)}, ${new Set(casosDe(A.get(i))).size} casos)`).join('; ')}`);
  if (sinParejaB.length) informe.push(`- En ADL ONE sin pareja en ADLSOFT: ${sinParejaB.map((i) => `${i} (empresa ${num(B.get(i).enc.id_empresaservicio)}, ${new Set(casosDe(B.get(i))).size} casos)`).join('; ')}`);
  informe.push('', '## Detalle por factura', '', '| ID ADLSOFT | ID ADL ONE | Empresa | Folio | Casos | Resultado |', '|---|---|---|---|---|---|');
  for (const d of detalle) informe.push(`| ${d.ia} | ${d.ib}${d.ia === d.ib ? '' : ' (otro número)'} | ${d.empresa} | ${d.folioA} | ${d.casos} | ${d.dif.length ? d.dif.length + ' diferencias' : 'idéntica'} |`);
  for (const d of detalle.filter((x) => x.dif.length)) {
    informe.push('', `### ADLSOFT ${d.ia} ↔ ADL ONE ${d.ib}`, '', '| Dónde | Columna | ADLSOFT | ADL ONE | Causa probable |', '|---|---|---|---|---|');
    for (const x of d.dif.slice(0, 60)) informe.push(`| ${x.donde} | ${x.col} | ${x.adlsoft} | ${x.adlone} | ${pista(x.col)} |`);
    if (d.dif.length > 60) informe.push(`| … | | | | y ${d.dif.length - 60} más |`);
  }
  const texto = informe.join('\n');
  console.log(texto.length > 6000 ? texto.slice(0, 6000) + '\n…(informe completo en el archivo)' : texto);
  if (salida) { fs.writeFileSync(salida, texto); console.log('\ninforme guardado en', salida); }
  process.exit(0);
})().catch((e) => { console.log('ERR', e.message); process.exit(1); });
