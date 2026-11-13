import fs from 'fs';
const pdfjs = await import('file:///C:/Users/vremolcoy/Desktop/WebClientesV2/app/backend/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(process.argv[2])) }).promise;
const pg = await doc.getPage(Number(process.argv[3] || 1)); const vp = pg.getViewport({ scale: 1 });
const tc = await pg.getTextContent();
const keys = /Fecha de muestreo|Centro:|TOTAL CENTRO|TOTAL GENERAL|NETO|IVA|^PM-|Costo jornada|Costo operativo|RT-PCR|^[0-9]+,[0-9]{3}$|Informe:/;
const out = [];
for (const i of tc.items) { const s = i.str.trim(); if (!s || !keys.test(s)) continue; if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) continue; out.push([Math.round((vp.height - i.transform[5]) * 100) / 100, Math.round(i.transform[4] * 10) / 10, s]); }
const seen = new Set(); out.sort((a, b) => a[0] - b[0] || a[1] - b[1]).forEach(r => { const k = r[0] + '|' + r[2]; if (seen.has(k)) return; seen.add(k); if (/^[0-9]+,[0-9]{3}$/.test(r[2]) && r[1] < 540) return; console.log(r[0].toFixed(2).padStart(7), 'x=' + r[1], r[2]); });
