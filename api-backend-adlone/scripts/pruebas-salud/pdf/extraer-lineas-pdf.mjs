import fs from 'fs';
const pdfjs = await import('file:///C:/Users/vremolcoy/Desktop/WebClientesV2/app/backend/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(process.argv[2])), useSystemFonts: true }).promise;
const pg = await doc.getPage(Number(process.argv[3]||1)); const vp = pg.getViewport({ scale: 1 });
const ops = await pg.getOperatorList(); const O = pjs => pjs; const names = Object.fromEntries(Object.entries(pdfjs.OPS).map(([k,v])=>[v,k]));
let ctm = [1,0,0,1,0,0]; const stack = []; let fill = null, stroke = null, lw = null;
const mul = (a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const hex = (a)=> '#'+a.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
let imgN = 0;
for (let i = 0; i < ops.fnArray.length; i++) {
  const n = names[ops.fnArray[i]], a = ops.argsArray[i];
  if (n === 'save') stack.push([ctm.slice(), fill, stroke, lw]); else if (n === 'restore') { [ctm, fill, stroke, lw] = stack.pop(); }
  else if (n === 'transform') ctm = mul(ctm, a);
  else if (n === 'setFillRGBColor') fill = a.length===1? a[0] : String(a);
  else if (n === 'setStrokeRGBColor') stroke = a.length===1? a[0] : String(a);
  else if (n === 'setLineWidth') lw = a[0];
  else if (n === 'constructPath') { console.log('PATH', JSON.stringify(a).slice(0,200), 'ctm', ctm.map(v=>Math.round(v*10)/10).join(','), 'fill', fill, 'stroke', stroke, 'lw', lw); }
  else if (n === 'paintImageXObject' || n === 'paintInlineImageXObject' || n==='paintImageMaskXObject') { console.log('IMAGE', n, a?.[0], 'ctm', ctm.map(v=>Math.round(v*10)/10).join(','), '=> x', Math.round(ctm[4]), 'y(top)', Math.round(vp.height - ctm[5] - ctm[3]), 'w', Math.round(ctm[0]), 'h', Math.round(ctm[3])); }
  else if (['fill','stroke','fillStroke','rectangle','showText','setFont'].includes(n)) { if (n!=='showText') console.log(n, JSON.stringify(a).slice(0,80), 'fill', fill, 'stroke', stroke); }
}
