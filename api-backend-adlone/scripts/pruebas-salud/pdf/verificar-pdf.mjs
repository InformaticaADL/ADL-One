import fs from 'fs';
const pdfjs = await import('file:///C:/Users/vremolcoy/Desktop/WebClientesV2/app/backend/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
async function items(f) { const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(f)) }).promise; const out = []; for (let n = 1; n <= doc.numPages; n++) { const pg = await doc.getPage(n); const vp = pg.getViewport({ scale: 1 }); const tc = await pg.getTextContent(); for (const i of tc.items) if (i.str.trim()) out.push({ p: n, y: vp.height - i.transform[5], x: i.transform[4], s: i.str.trim() }); } return { n: doc.numPages, out }; }
const pares = JSON.parse(process.argv[2]);
for (const [nombre, orig, mio] of pares) {
  const A = await items(orig), B = await items(mio); let faltan = [], maxdy = 0, total = 0;
  const norm = (s) => s.replace(/ADLSoft/, 'ADL ONE').replace(/\s+/g, ' ');
  for (const a of A.out) {
    if (/^Informe:|^Factura N°|^: ?\d+$|U\.F\.:$/.test(a.s)) continue; // folio, hora y fusiones del extractor
    total++;
    const palabras = norm(a.s).split(' ');
    const fila = B.out.filter((b) => b.p === a.p && Math.abs(b.y - a.y) < 0.6 && Math.abs(b.x - a.x) < 3).map((b) => norm(b.s)).join(' ');
    const ok = palabras.every((w) => fila.includes(w));
    if (!ok) faltan.push(`${a.p}:${a.y.toFixed(2)} x=${a.x.toFixed(1)} ${a.s}`);
    else { const b = B.out.find((b) => b.p === a.p && Math.abs(b.y - a.y) < 0.6 && Math.abs(b.x - a.x) < 3 && norm(b.s).includes(palabras[0])); if (b) maxdy = Math.max(maxdy, Math.abs(b.y - a.y)); }
  }
  console.log(`${nombre}: hojas ${A.n}/${B.n} | textos ${total} | sin pareja ${faltan.length} | desvio maximo de altura ${maxdy.toFixed(2)} pt`);
  faltan.slice(0, 6).forEach((x) => console.log('    falta:', x));
}
