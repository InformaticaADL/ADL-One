import fs from 'fs';
const pdfjs = await import('file:///C:/Users/vremolcoy/Desktop/WebClientesV2/app/backend/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(process.argv[2])) }).promise;
const pg = await doc.getPage(1); const vp = pg.getViewport({ scale: 1 }); const tc = await pg.getTextContent();
tc.items.filter(i => i.str.trim()).map(i => [Math.round((vp.height - i.transform[5]) * 100) / 100, Math.round(i.transform[4] * 10) / 10, Math.round(i.width * 10) / 10, i.str]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).forEach(r => console.log(r[0].toFixed(2).padStart(7), 'x=' + String(r[1]).padStart(6), 'w=' + String(r[2]).padStart(5), r[3]));
