/**
 * add-masters-to-excel.js
 * --------------------------------------------------------------------------
 * Adds the reference master sheets (Empresa a Facturar, Empresa de Servicio,
 * Centros — con CÓDIGO CENTRO, y Zonas UTM) to an existing bulk-upload Excel,
 * adds a ZONA UTM dropdown on the FICHAS sheet, and rewrites the INSTRUCCIONES
 * sheet to document the new CÓDIGO CENTRO / ZONA UTM fields and the Costo
 * Operativo row in the ANALISIS sheet.
 *
 * Does NOT fill the CODIGO CENTRO or ZONA UTM columns in FICHAS — only adds
 * the master reference sheets, as requested.
 *
 * Usage:  node src/scripts/add-masters-to-excel.js [inputPath] [outputPath]
 */
import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const { getConnection, closeConnection } = await import('../config/database.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..'); // .../ADL ONE

const INPUT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(PROJECT_ROOT, 'Formato_Carga_Masiva_ADL_test_oficial_corregir.xlsx');
const OUTPUT = process.argv[3] ? path.resolve(process.argv[3]) : INPUT;

const trim = (v) => (v === null || v === undefined ? '' : String(v).trim());

// ── Styles (consistent with bulk-excel.service.js generateTemplate) ──────────
const MASTER_HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF203864' } };
const MASTER_HEAD_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
const DATA_FONT = { name: 'Calibri', size: 10 };
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
  right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
};
const CENTER = { horizontal: 'center', vertical: 'middle', wrapText: true };
const WRAP = { horizontal: 'left', vertical: 'middle', wrapText: true };

const colLetter = (n) => {
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

async function loadData(pool) {
  const clientes = (await pool.request().query(
    "SELECT id_empresa, nombre_empresa FROM mae_empresa ORDER BY nombre_empresa"
  )).recordset;

  const empServ = (await pool.request().query(
    "SELECT id_empresaservicio, nombre_empresaservicios FROM mae_empresaservicios WHERE habilitado='S' ORDER BY nombre_empresaservicios"
  )).recordset;

  const zonas = (await pool.request().query(
    "SELECT id_zonautm, nombre_zonautm FROM mae_zonautm WHERE habilitado='S' ORDER BY nombre_zonautm"
  )).recordset;

  // Only vigente centros; resolve empresa / tipo agua / barrio names.
  const centros = (await pool.request().query(`
    SELECT c.id_centro, c.codigo_centro, c.nombre_centro, c.id_empresa, c.id_zona,
           c.id_tipoagua, c.id_barrio,
           e.nombre_empresa, ta.nombre_tipoagua, b.nombre_barrio
    FROM mae_centro c
    LEFT JOIN mae_empresa e ON c.id_empresa = e.id_empresa
    LEFT JOIN mae_tipoagua ta ON c.id_tipoagua = ta.id_tipoagua
    LEFT JOIN mae_barrio b ON c.id_barrio = b.id_barrio
    WHERE c.vigente = 'S'
    ORDER BY e.nombre_empresa, c.nombre_centro
  `)).recordset;

  return { clientes, empServ, zonas, centros };
}

function rebuildMasterSheet(wb, sheetName, titleText, rows, colWidths) {
  const existing = wb.getWorksheet(sheetName);
  if (existing) wb.removeWorksheet(existing.id);
  const ws = wb.addWorksheet(sheetName, { state: 'visible' });

  const colCount = rows[0]?.length || 1;

  // Row 1: Title
  const t = ws.getCell('A1');
  t.value = titleText;
  t.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
  t.fill = MASTER_HEAD_FILL;
  t.alignment = CENTER;
  if (colCount > 1) ws.mergeCells(1, 1, 1, colCount);
  ws.getRow(1).height = 28;

  // Row 2: Note
  const n = ws.getCell('A2');
  n.value = '⚠️ Hoja de referencia — Use estos valores en la hoja FICHAS. No edite esta hoja.';
  n.font = { italic: true, size: 9, color: { argb: 'FF555555' } };
  n.alignment = WRAP;
  if (colCount > 1) ws.mergeCells(2, 1, 2, colCount);
  ws.getRow(2).height = 26;

  // Row 3: Headers
  rows[0].forEach((h, ci) => {
    const c = ws.getRow(3).getCell(ci + 1);
    c.value = h;
    c.fill = MASTER_HEAD_FILL;
    c.font = MASTER_HEAD_FONT;
    c.border = THIN_BORDER;
    c.alignment = CENTER;
  });
  ws.getRow(3).height = 24;

  // Data rows
  for (let ri = 1; ri < rows.length; ri++) {
    const dataRow = ws.getRow(ri + 3);
    rows[ri].forEach((val, ci) => {
      const c = dataRow.getCell(ci + 1);
      c.value = val ?? '';
      c.font = DATA_FONT;
      c.border = THIN_BORDER;
      c.alignment = WRAP;
    });
    dataRow.height = 18;
  }

  (colWidths || [35]).forEach((w, ci) => { ws.getColumn(ci + 1).width = w; });

  // Freeze header + autofilter
  ws.views = [{ state: 'frozen', ySplit: 3 }];
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: colCount } };

  return ws;
}

function writeInstrucciones(wb) {
  const existing = wb.getWorksheet('INSTRUCCIONES');
  if (existing) wb.removeWorksheet(existing.id);
  const ws = wb.addWorksheet('INSTRUCCIONES', { state: 'visible' });
  ws.getColumn(1).width = 120;

  const L = [
    { t: '📖 INSTRUCCIONES DE USO — CARGA MASIVA DE FICHAS', h: 1 },
    { t: '' },
    { t: '1. HOJA "FICHAS" — Una fila por cada ficha de ingreso. Las columnas marcadas con * son obligatorias.', b: 1 },
    { t: '   • EMPRESA DE SERVICIO * → Escriba el nombre. Valores válidos en la hoja "MAESTRO_EMP_SERVICIO".' },
    { t: '   • EMPRESA A FACTURAR * → Escriba el nombre del cliente. Valores válidos en la hoja "MAESTRO_EMP_FACTURAR".' },
    { t: '   • CODIGO CENTRO * (CAMPO NUEVO) → Escriba el código del centro. Búsquelo en la hoja "MAESTRO_CENTROS"', b: 1 },
    { t: '        (columna "Código Centro"). Cada centro tiene su código asociado a la empresa propietaria.' },
    { t: '   • CENTRO / FUENTE EMISORA * → Nombre del centro. Debe corresponder al mismo centro del código. Ver "MAESTRO_CENTROS".' },
    { t: '   • ZONA UTM (CAMPO NUEVO) → Seleccione la zona UTM desde la lista desplegable. Valores válidos en "MAESTRO_ZONAS_UTM".', b: 1 },
    { t: '        UTM NORTE y UTM ESTE son las coordenadas numéricas; ZONA UTM identifica el huso (ej. 18H, 19G).' },
    { t: '   • El resto de catálogos (Objetivo, Componente, Inspector, etc.) se buscan automáticamente por similitud de nombre.' },
    { t: '   • Columnas (auto): TOTAL SERVICIOS, NOMBRE TABLA y "🔁 UF TOTAL REAL (AUTO)" se calculan solas. No las edite.' },
    { t: '' },
    { t: '2. HOJA "ANALISIS" — Repita el ID MUESTRA por cada análisis de la ficha.', b: 1 },
    { t: '   • NOMBRE ANÁLISIS *, TIPO ANÁLISIS *, LABORATORIO 1 * y TIPO ENTREGA * son obligatorios por fila.' },
    { t: '   • La UF de cada análisis se escribe en la columna verde "✏️ UF (Escriba Aquí)".' },
    { t: '   • La suma de todas las UF de un ID MUESTRA aparece en "🔁 UF TOTAL REAL (AUTO)" de la hoja FICHAS.' },
    { t: '' },
    { t: '3. COSTO OPERATIVO — Se ingresa como UNA FILA ADICIONAL en la hoja "ANALISIS" (no en FICHAS).', b: 1 },
    { t: '   • ID MUESTRA → el mismo ID de la ficha (ej. M-001).' },
    { t: '   • NOMBRE ANÁLISIS → escriba exactamente: Costo Operativo' },
    { t: '   • TIPO ANÁLISIS → escriba exactamente: CostoOperativo   (una sola palabra, sin espacio).' },
    { t: '   • LABORATORIO 1, TIPO ENTREGA, NORMATIVA, REFERENCIA → déjelos VACÍOS.' },
    { t: '   • "✏️ UF (Escriba Aquí)" → el monto en UF del costo operativo. El sistema lo suma al UF TOTAL de la ficha.' },
    { t: '   • Ejemplo:   M-001 | Costo Operativo | CostoOperativo | (vacío) | (vacío) | (vacío) | (vacío) | 0.80' },
    { t: '' },
    { t: '4. HOJAS DE REFERENCIA (maestros): MAESTRO_EMP_FACTURAR, MAESTRO_EMP_SERVICIO, MAESTRO_CENTROS, MAESTRO_ZONAS_UTM.', b: 1 },
    { t: '   • Son solo de consulta. Use sus valores tal cual aparecen para evitar errores de coincidencia.' },
  ];

  L.forEach((item, i) => {
    const cell = ws.getCell(`A${i + 1}`);
    cell.value = item.t;
    if (item.h === 1) {
      cell.font = { bold: true, size: 14, color: { argb: 'FF203864' }, name: 'Calibri' };
    } else if (item.b) {
      cell.font = { bold: true, size: 11, name: 'Calibri' };
    } else {
      cell.font = { size: 11, name: 'Calibri' };
    }
    cell.alignment = { vertical: 'middle', wrapText: true };
  });

  return ws;
}

async function main() {
  console.log('[add-masters] Input :', INPUT);
  console.log('[add-masters] Output:', OUTPUT);

  const pool = await getConnection();
  const { clientes, empServ, zonas, centros } = await loadData(pool);
  console.log(`[add-masters] Loaded: clientes=${clientes.length}, empServ=${empServ.length}, zonas=${zonas.length}, centros(vigentes)=${centros.length}`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(INPUT);

  // ── 1. MAESTRO_EMP_FACTURAR ────────────────────────────────────────────────
  rebuildMasterSheet(
    wb,
    'MAESTRO_EMP_FACTURAR',
    'MAESTRO: Empresas a Facturar (Clientes)',
    [['Nombre Empresa a Facturar'], ...clientes.map((c) => [trim(c.nombre_empresa)])],
    [55]
  );

  // ── 2. MAESTRO_EMP_SERVICIO ────────────────────────────────────────────────
  rebuildMasterSheet(
    wb,
    'MAESTRO_EMP_SERVICIO',
    'MAESTRO: Empresas de Servicio',
    [['Nombre Empresa de Servicio'], ...empServ.map((e) => [trim(e.nombre_empresaservicios)])],
    [55]
  );

  // ── 3. MAESTRO_CENTROS (incluye CÓDIGO CENTRO) ─────────────────────────────
  rebuildMasterSheet(
    wb,
    'MAESTRO_CENTROS',
    'MAESTRO: Centros / Fuentes Emisoras (vigentes)',
    [
      ['Empresa Propietaria', 'Código Centro', 'Nombre Centro / Fuente Emisora', 'Tipo de Agua', 'Barrio', 'ID Zona', 'ID Centro'],
      ...centros.map((c) => [
        trim(c.nombre_empresa),
        trim(c.codigo_centro),
        trim(c.nombre_centro),
        trim(c.nombre_tipoagua),
        trim(c.nombre_barrio),
        c.id_zona ?? '',
        c.id_centro ?? '',
      ]),
    ],
    [42, 16, 42, 18, 26, 10, 12]
  );

  // ── 4. MAESTRO_ZONAS_UTM ───────────────────────────────────────────────────
  const zonasRows = [['Nombre Zona UTM'], ...zonas.map((z) => [trim(z.nombre_zonautm)])];
  rebuildMasterSheet(wb, 'MAESTRO_ZONAS_UTM', 'MAESTRO: Zonas UTM', zonasRows, [22]);

  // ── 5. INSTRUCCIONES (rewrite) ─────────────────────────────────────────────
  writeInstrucciones(wb);

  // ── 6. ZONA UTM dropdown on FICHAS ─────────────────────────────────────────
  const wsFichas = wb.getWorksheet('FICHAS');
  if (wsFichas) {
    const cmF = {};
    wsFichas.getRow(3).eachCell({ includeEmpty: false }, (c, i) => {
      const h = String(c.value || '').replace(/[\r\n🔁✏️\*]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
      if (h) cmF[h] = i;
    });
    const zonaIdx = cmF['ZONA UTM'];
    if (zonaIdx) {
      const col = colLetter(zonaIdx);
      const lastZonaRow = 3 + zonasRows.length - 1; // header at row3 -> data 4..
      const formula = `MAESTRO_ZONAS_UTM!$A$4:$A$${lastZonaRow}`;
      for (let r = 4; r <= 2003; r++) {
        wsFichas.getCell(`${col}${r}`).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [formula],
          showErrorMessage: true,
          errorStyle: 'warning',
          errorTitle: 'Zona UTM no en maestro',
          error: 'Valor no encontrado en MAESTRO_ZONAS_UTM. Puede ingresarlo igualmente.',
          showInputMessage: true,
          promptTitle: 'Zona UTM',
          prompt: 'Seleccione la Zona UTM (ver hoja MAESTRO_ZONAS_UTM).',
        };
      }
      console.log(`[add-masters] ZONA UTM dropdown added on column ${col} (range ${formula})`);
    } else {
      console.warn('[add-masters] WARNING: ZONA UTM column not found on FICHAS — dropdown skipped.');
    }
  }

  await wb.xlsx.writeFile(OUTPUT);
  console.log('[add-masters] ✅ Saved:', OUTPUT);
}

try {
  await main();
} catch (e) {
  console.error('[add-masters] ERROR:', e);
  process.exitCode = 1;
} finally {
  await closeConnection().catch(() => {});
  process.exit(process.exitCode || 0);
}
