/**
 * fix-excel-formulas.js
 * --------------------------------------------------------------------------
 * Repairs the "Registros quitados: Fórmula" corruption in the bulk-upload
 * Excel. Causes:
 *   • FICHAS cols FREC.CANTIDAD / FACTOR use a broken EXTERNAL link "[1]_MAPPINGS!"
 *   • FICHAS TOTAL SERVICIOS uses a SHARED formula (ExcelJS writes invalid XML)
 *   • ANALISIS ID MUESTRA (rows 154+) uses EXTERNAL link "[1]FICHAS!A$nn"
 *   • ANALISIS _CNT uses a SHARED COUNTIF formula
 *
 * Fix: rewrite the FICHAS helper columns as clean INTERNAL, NON-shared formulas;
 * convert ANALISIS ID MUESTRA formula cells to their cached literal value;
 * rewrite _CNT as a clean normal formula; force full recalculation on load.
 *
 * Usage: node src/scripts/fix-excel-formulas.js [path]
 */
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
const FILE = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(PROJECT_ROOT, 'Formato_Carga_Masiva_ADL_test_oficial_corregir.xlsx');

const DATA_START = 4;
const DATA_END = 2003;

const colLetter = (n) => {
  let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(FILE);

// ── FICHAS: rewrite helper formula columns (clean, internal, non-shared) ─────
const f = wb.getWorksheet('FICHAS');
if (!f) throw new Error('FICHAS sheet not found');

// Resolve column indices from header row 3
const cmF = {};
f.getRow(3).eachCell({ includeEmpty: false }, (c, i) => {
  const h = String(c.value || '').replace(/[\r\n🔁✏️\*]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  if (h) cmF[h] = i;
});
const A = colLetter(1);
const idxFrec = cmF['FRECUENCIA PERÍODO (SELECCIONE)'] || cmF['FRECUENCIA PERIODO (SELECCIONE)'] ||
                Object.entries(cmF).find(([k]) => k.startsWith('FRECUENCIA PER'))?.[1] || 14;
const idxFrecCant = Object.entries(cmF).find(([k]) => k.startsWith('FREC. CANTIDAD'))?.[1] || (idxFrec + 1);
const idxFactor = Object.entries(cmF).find(([k]) => k.startsWith('FACTOR'))?.[1] || (idxFrec + 2);
const idxTotal = Object.entries(cmF).find(([k]) => k.startsWith('TOTAL SERVICIOS'))?.[1] || (idxFrec + 3);
const idxUfTotal = Object.entries(cmF).find(([k]) => k.includes('UF TOTAL'))?.[1] || 41;

const N = colLetter(idxFrec);
const O = colLetter(idxFrecCant);
const P = colLetter(idxFactor);
const Q = colLetter(idxTotal);
const UF = colLetter(idxUfTotal);

console.log(`[fix] FICHAS cols → Frec=${N}${idxFrec} Cant=${O}${idxFrecCant} Factor=${P}${idxFactor} Total=${Q}${idxTotal} UF=${UF}${idxUfTotal}`);

const setFormula = (ws, addr, formula, fallbackResult = '') => {
  const cur = ws.getCell(addr).value;
  const prev = (cur && typeof cur === 'object' && cur.result !== undefined && cur.result !== null) ? cur.result : fallbackResult;
  ws.getCell(addr).value = { formula, result: prev };
};

for (let r = DATA_START; r <= DATA_END; r++) {
  setFormula(f, `${O}${r}`, `IF(${N}${r}="","",IFERROR(VLOOKUP(IF(ISNUMBER(${N}${r}),TEXT(${N}${r},"0"),${N}${r}),_MAPPINGS!$A$1:$C$24,2,FALSE),1))`);
  setFormula(f, `${P}${r}`, `IF(${N}${r}="","",IFERROR(VLOOKUP(IF(ISNUMBER(${N}${r}),TEXT(${N}${r},"0"),${N}${r}),_MAPPINGS!$A$1:$C$24,3,FALSE),1))`);
  setFormula(f, `${Q}${r}`, `IF(AND(${O}${r}<>"",${P}${r}<>""),${O}${r}*${P}${r},"")`);
  setFormula(f, `${UF}${r}`, `IF(${A}${r}="","",SUMIF(ANALISIS!$A:$A,${A}${r},ANALISIS!$I:$I))`, 0);
}

// ── ANALISIS: convert ID MUESTRA formula cells to literal values; fix _CNT ───
const a = wb.getWorksheet('ANALISIS');
if (!a) throw new Error('ANALISIS sheet not found');

const cmA = {};
a.getRow(3).eachCell({ includeEmpty: false }, (c, i) => {
  const h = String(c.value || '').replace(/[\r\n🔁✏️\*]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  if (h) cmA[h] = i;
});
const idxCnt = cmA['_CNT'] || 10;
const cntLt = colLetter(idxCnt);

let converted = 0;
const lastRow = a.rowCount;
for (let r = DATA_START; r <= lastRow; r++) {
  const idCell = a.getRow(r).getCell(1);
  const v = idCell.value;
  if (v && typeof v === 'object' && (v.formula || v.sharedFormula)) {
    // Replace external/shared formula with its cached literal value
    const res = (v.result !== undefined && v.result !== null) ? v.result : '';
    idCell.value = res === '' ? null : res;
    converted++;
  }
}
console.log(`[fix] ANALISIS ID MUESTRA: converted ${converted} formula cells to literal values`);

// _CNT: clean normal formula across full data range
for (let r = DATA_START; r <= DATA_END; r++) {
  const cur = a.getCell(`${cntLt}${r}`).value;
  const prev = (cur && typeof cur === 'object' && cur.result !== undefined && cur.result !== null) ? cur.result : 0;
  a.getCell(`${cntLt}${r}`).value = {
    formula: `IF(${A}${r}<>"",COUNTIF($A$${DATA_START}:$A$${DATA_END},${A}${r}),0)`,
    result: prev,
  };
}
console.log(`[fix] ANALISIS _CNT rewritten on col ${cntLt}`);

// ── Safety net: any remaining external "[1]" or shared formulas anywhere ─────
let remaining = 0;
wb.eachSheet((ws) => {
  for (let r = 1; r <= ws.rowCount; r++) {
    ws.getRow(r).eachCell({ includeEmpty: false }, (c) => {
      const v = c.value;
      if (v && typeof v === 'object') {
        if (typeof v.formula === 'string' && v.formula.includes('[1]')) {
          // strip external link prefix -> internal reference
          c.value = { formula: v.formula.replace(/\[1\]/g, ''), result: (v.result ?? '') };
          remaining++;
        } else if (v.sharedFormula) {
          // any leftover shared dependent -> freeze to its cached value
          c.value = (v.result ?? '') === '' ? null : v.result;
          remaining++;
        }
      }
    });
  }
});
if (remaining) console.log(`[fix] Safety net cleaned ${remaining} extra external/shared formula cells`);

// Force Excel to recalc everything on open so cached values refresh
wb.calcProperties = { fullCalcOnLoad: true };

await wb.xlsx.writeFile(FILE);
console.log('[fix] ✅ Saved repaired file:', FILE);
