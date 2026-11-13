const fs = require('fs'); const base = process.argv[2]; const want = process.argv.slice(3).map(Number);
const b = fs.readFileSync(base + '.frx'); const memoFile = fs.existsSync(base + '.frt') ? base + '.frt' : base + '.FRT'; const m = fs.readFileSync(memoFile);
const n = b.readUInt32LE(4), hdr = b.readUInt16LE(8), rl = b.readUInt16LE(10); const campos = [];
let off = 1; for (let o = 32; o < hdr && b[o] !== 0x0d; o += 32) { const nm = b.slice(o, o + 11).toString('latin1').replace(/\0.*$/, ''); const t = String.fromCharCode(b[o + 11]); const l = b[o + 16]; campos.push({ nm, t, l, off }); off += l; }
const bs = m.readUInt16BE(6) || 64; const memo = (k) => { if (!k) return ''; const p = k * bs; const len = m.readUInt32BE(p + 4); return m.slice(p + 8, p + 8 + len).toString('latin1'); };
for (const i of want) { const r = b.slice(hdr + i * rl, hdr + (i + 1) * rl); console.log('--- obj', i);
  for (const c of campos) { const raw = r.slice(c.off, c.off + c.l).toString('latin1'); let v = c.t === 'M' ? memo(parseInt(raw.trim() || '0', 10) || r.readUInt32LE(c.off)) : raw.trim(); if (v && !/^[\0\s]*$/.test(v) && !['0','0.000'].includes(v)) console.log(' ', c.nm, '=', JSON.stringify(v).slice(0, 700)); } }
