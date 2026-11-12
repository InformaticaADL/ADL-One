import XLSX from 'xlsx';
import sql from 'mssql';
import { getConnectionHistorico, closeConnectionHistorico } from '../src/config/databaseHistorico.js';

const BASE_DIR = 'C:\\Users\\frehbein\\Desktop\\proyectos\\ADL-One\\DB HISTORICA ADL BMO';
const BATCH_SIZE = 2500;

// ============================================================================
// CONFIGURACIÓN DE ARCHIVOS POR FORMATO / TABLA
// ============================================================================

const FILES_2006_2008 = [
  { path: `${BASE_DIR}\\Año 2006\\PM-2006\\HISTORICO_ADL_PM-2006.xls`, fuente: 'HISTORICO_ADL_PM-2006.xls', anio: 2006 },
  { path: `${BASE_DIR}\\Año 2007\\AY-2007\\HISTORICO_ADL_AY-2007.xls`, fuente: 'HISTORICO_ADL_AY-2007.xls', anio: 2007 },
  { path: `${BASE_DIR}\\Año 2007\\CA-2007\\HISTORICO_ADL_CA-2007.xls`, fuente: 'HISTORICO_ADL_CA-2007.xls', anio: 2007 },
  { path: `${BASE_DIR}\\Año 2008\\AY-2008\\HISTORICO_ADL_AY-2008.xls`, fuente: 'HISTORICO_ADL_AY-2008.xls', anio: 2008 },
  { path: `${BASE_DIR}\\Año 2008\\CA-2008\\HISTORICO_ADL_CA-2008.xls`, fuente: 'HISTORICO_ADL_CA-2008.xls', anio: 2008 },
  { path: `${BASE_DIR}\\Año 2008\\PM-2008\\HISTORICO_ADL_PM-2008.xls`, fuente: 'HISTORICO_ADL_PM-2008.xls', anio: 2008 }
];

const FILES_2009_2012 = [
  { path: `${BASE_DIR}\\Año 2009\\AY-2009\\HISTORICO_ADL_AY-2009.xls`, fuente: 'HISTORICO_ADL_AY-2009.xls', anio: 2009 },
  { path: `${BASE_DIR}\\Año 2009\\PM-2009\\HISTORICO_ADL_PM-2009.xls`, fuente: 'HISTORICO_ADL_PM-2009.xls', anio: 2009 },
  { path: `${BASE_DIR}\\Año 2010\\AY-2010\\HISTORICO_ADL_AY-2010.xls`, fuente: 'HISTORICO_ADL_AY-2010.xls', anio: 2010 },
  { path: `${BASE_DIR}\\Año 2010\\PM-2010\\HISTORICO_ADL_PM-2010.xls`, fuente: 'HISTORICO_ADL_PM-2010.xls', anio: 2010 },
  { path: `${BASE_DIR}\\Año 2010\\VI-2010\\HISTORICO_ADL_VI-2010.xls`, fuente: 'HISTORICO_ADL_VI-2010.xls', anio: 2010 },
  { path: `${BASE_DIR}\\Año 2011\\PM-2011\\HISTORICO_ADL_PM-2011.xls`, fuente: 'HISTORICO_ADL_PM-2011.xls', anio: 2011 },
  { path: `${BASE_DIR}\\Año 2011\\VI-2011\\HISTORICO_ADL_VI-2011.xls`, fuente: 'HISTORICO_ADL_VI-2011.xls', anio: 2011 },
  { path: `${BASE_DIR}\\Año 2012\\AY-2012\\HISTORICO_ADL_AY-2012.xls`, fuente: 'HISTORICO_ADL_AY-2012.xls', anio: 2012 },
  { path: `${BASE_DIR}\\Año 2012\\PM-2012\\HISTORICO_ADL_PM-2012.xls`, fuente: 'HISTORICO_ADL_PM-2012.xls', anio: 2012 },
  { path: `${BASE_DIR}\\Año 2012\\VI-2012\\HISTORICO_ADL_VI-2012.xls`, fuente: 'HISTORICO_ADL_VI-2012.xls', anio: 2012 }
];

const FILES_2013_2016 = [
  { path: `${BASE_DIR}\\Año 2013\\HISTORICO_ADL_2013.xlsx`, fuente: 'HISTORICO_ADL_2013.xlsx', anio: 2013 },
  { path: `${BASE_DIR}\\Año 2014\\HISTORICO_ADL_2014.xlsx`, fuente: 'HISTORICO_ADL_2014.xlsx', anio: 2014 },
  { path: `${BASE_DIR}\\Año 2015\\HISTORICO_ADL_2015.xlsx`, fuente: 'HISTORICO_ADL_2015.xlsx', anio: 2015 },
  { path: `${BASE_DIR}\\Año 2016\\HISTORICO_ADL_2016.xlsx`, fuente: 'HISTORICO_ADL_2016.xlsx', anio: 2016 }
];

// ============================================================================
// FUNCIONES DE LIMPIEZA Y NORMALIZACIÓN COMUNES
// ============================================================================

function cleanString(val, maxLen) {
  if (val === null || val === undefined) return null;
  const str = String(val).replace(/\s+/g, ' ').trim();
  if (str === '' || str.toUpperCase() === 'NULL') return null;
  return maxLen ? str.slice(0, maxLen) : str;
}

function cleanInt(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (str === '' || ['NULL', 'NA', 'NI', '-', '.', ','].includes(str.toUpperCase())) return null;
  const num = parseInt(str, 10);
  return isNaN(num) ? null : num;
}

function cleanCtDecimal(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim().replace(',', '.');
  if (str === '' || ['NULL', 'NA', 'NI', '-', '.', ','].includes(str.toUpperCase())) return null;
  let num = parseFloat(str);
  if (isNaN(num)) return null;

  // Normalizar CT sin punto decimal (ej: 25417 -> 25.417, 4076 -> 40.76)
  if (num > 10000 && num < 100000) {
    num = num / 1000;
  } else if (num > 1000 && num < 10000) {
    num = num / 100;
  }

  // En PCR un CT válido es estrictamente > 0 y <= 60
  if (num <= 0 || num > 60) return null;

  return Number(num.toFixed(4));
}

function parseMuestrasAndPool2006_2008(val) {
  if (val === null || val === undefined) return { n_muestras: null, pool: null };
  const str = String(val).trim();
  if (str === '' || ['NULL', 'NA', 'NI', '-', '.'].includes(str.toUpperCase())) {
    return { n_muestras: null, pool: null };
  }

  let pool = null;
  const match = str.match(/\((.*?)\)/);
  if (match) {
    pool = match[1].trim();
  }

  const num = parseInt(str, 10);
  return {
    n_muestras: isNaN(num) ? null : num,
    pool: pool ? cleanString(pool, 50) : null
  };
}

function parseExcelDate(val) {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim();
  if ([
    'NA', 'NI', '-', 'NULL', 'null', '/  /', '',
    '00-00-2006', '00-00-2007', '00-00-2008', '00-00-2009', '00-00-2010', '00-00-2011', '00-00-2012'
  ].includes(str)) return null;

  // Erratas tipográficas conocidas en archivos históricos 2006-2008
  if (str === '2117/11/2006') return new Date('2006-11-17T00:00:00Z');
  if (str === '28--01-2006') return new Date('2006-01-28T00:00:00Z');
  if (str === '27502/2007') return new Date('2007-02-27T00:00:00Z');
  if (str === '0810-2007') return new Date('2007-10-08T00:00:00Z');
  if (str === '1404/2008') return new Date('2008-04-14T00:00:00Z');
  if (str === '290-01-2008') return new Date('2008-01-29T00:00:00Z');
  if (str === '31/0/2008' || str === '18/18/2005') return null;

  // Si es número serial de Excel
  if (typeof val === 'number' || (!isNaN(val) && !str.includes('/') && !str.includes('-'))) {
    const num = Number(val);
    if (num > 0 && num < 100000) {
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Formato DD/MM/YYYY o DD-MM-YYYY
  const parts = str.split(/[/ -]/).filter(p => p.length > 0);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);

    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    }
    if (year < 100) year += 2000;

    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(Date.UTC(year, month - 1, day));
    }
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function fixKnownDateTypos(fuente, nCaso, fm, fr) {
  let fixedFm = fm;
  let fixedFr = fr;

  // Correcciones puntuales de años mal tipeados en origen
  if (fuente === 'HISTORICO_ADL_PM-2008.xls') {
    if (nCaso === '2688' && fixedFm && fixedFm.getUTCFullYear() === 2004) {
      fixedFm = new Date(Date.UTC(2008, 3, 24)); // 2008-04-24
    } else if (nCaso === '3943' && fixedFm && fixedFm.getUTCFullYear() === 2005) {
      fixedFm = new Date(Date.UTC(2008, 11, 5)); // 2008-12-05
    } else if (nCaso === '3941' && fixedFr && fixedFr.getUTCFullYear() === 2005) {
      fixedFr = new Date(Date.UTC(2008, 10, 8)); // 2008-11-08
    } else if (nCaso === '4803' && fixedFm && fixedFm.getUTCFullYear() === 2005) {
      fixedFm = new Date(Date.UTC(2008, 6, 15)); // 2008-07-15
    }
  } else if (fuente === 'HISTORICO_ADL_AY-2008.xls') {
    if (nCaso === '275' && fixedFr && fixedFr.getUTCFullYear() === 2005) {
      fixedFr = new Date(Date.UTC(2008, 6, 8)); // 2008-07-08
    }
  } else if (fuente === 'HISTORICO_ADL_PM-2012.xls') {
    if (nCaso === 'PM-30549' && fixedFm && fixedFm.getUTCFullYear() === 2002) {
      fixedFm = new Date(Date.UTC(2012, 4, 14)); // 2012-05-14
    }
  }

  return { fecha_muestreo: fixedFm, fecha_recepcion: fixedFr };
}

// ============================================================================
// NORMALIZACIÓN ESPECÍFICA PARA 2013–2016 (ANOMALÍAS A, B y C)
// ============================================================================

function normalizarFila2013_2016(r) {
  let rut_empresa = cleanString(r['rut_empresa'], 50);
  let nombre_empresa = cleanString(r['nombre_empresa'], 255);
  let rut_empresaservicio = cleanString(r['rut_empresaservicio'], 50);
  let nombre_empresaservicio = cleanString(r['nombre_empresaservicio'], 255);
  let caso_adlab = cleanString(r['caso_adlab'], 100);
  let fecha_recepcion = parseExcelDate(r['fecha_recepcion']);
  let lote = cleanString(r['lote'], 150);
  let contenedor = cleanString(r['contenedor'], 255);
  let nombre_centro = cleanString(r['nombre_centro'], 255);
  let codigo_centro = cleanString(r['codigo_centro'], 100);
  let nombre_tecnica = cleanString(r['nombre_tecnica'], 150);
  let nombre_organo = cleanString(r['nombre_organo'], 150);
  let rawPool = r['pool'];
  let rawResultado = cleanString(r['resultado'], 50);
  let rawNpooles = r['pol_npooles'];
  let rawNpeces = r['pol_npeces'];
  let rawCt = r['ct'];
  let estado_caso = cleanString(r['estado_caso'], 50);

  let pool = null;
  let resultado = null;
  let pol_npooles = null;
  let pol_npeces = null;
  let ct = null;
  let genovariante = null;

  // ANOMALÍA B: Desfase total hacia la derecha por coma en contenedor o lote
  // Se detecta porque 'resultado' tiene el número de pool (entero) y 'pol_npooles' tiene 'N' o 'P'
  const resIsNumeric = rawResultado !== null && /^\d+$/.test(rawResultado);
  const npoolesStr = rawNpooles !== null && rawNpooles !== undefined ? String(rawNpooles).trim().toUpperCase() : '';

  if (resIsNumeric && ['N', 'P', 'EP', 'NA'].includes(npoolesStr)) {
    contenedor = cleanString(contenedor && nombre_centro ? `${contenedor}, ${nombre_centro}` : (contenedor || nombre_centro), 255);
    nombre_centro = cleanString(codigo_centro, 255);
    codigo_centro = cleanString(nombre_tecnica, 100);
    nombre_tecnica = cleanString(nombre_organo, 150);
    nombre_organo = cleanString(rawPool, 150);
    pool = cleanInt(rawResultado);
    resultado = npoolesStr;
    pol_npooles = cleanInt(rawNpeces);

    // En la columna ct cayó pol_npeces (y en las filas positivas con genovariante cayó "1.II", "1.B-I", "3.II")
    const ctStr = rawCt !== null && rawCt !== undefined ? String(rawCt).trim() : '';
    if (ctStr.includes('.') && /[IVX]/i.test(ctStr)) {
      const [pecesPart, genoPart] = ctStr.split('.');
      pol_npeces = cleanInt(pecesPart);
      genovariante = cleanString(genoPart, 20);
      ct = null;
    } else {
      pol_npeces = cleanInt(ctStr);
      ct = null;
    }
  } else {
    // ANOMALÍA A: Técnica con coma partida entre codigo_centro y nombre_tecnica (ej: "RT-PCR ELF (BKD" y "IPNV)")
    if (
      nombre_tecnica &&
      nombre_tecnica.endsWith(')') &&
      !nombre_tecnica.includes('(') &&
      codigo_centro &&
      codigo_centro.includes('(')
    ) {
      nombre_tecnica = cleanString(`${codigo_centro}, ${nombre_tecnica}`, 150);
      if (nombre_centro && nombre_centro.includes(',')) {
        const lastComma = nombre_centro.lastIndexOf(',');
        const realCentro = nombre_centro.slice(0, lastComma).trim();
        const realCodigo = nombre_centro.slice(lastComma + 1).trim();
        nombre_centro = cleanString(realCentro, 255);
        codigo_centro = cleanString(realCodigo, 100);
      } else {
        codigo_centro = null;
      }
    }

    pool = cleanInt(rawPool);
    resultado = rawResultado ? rawResultado.toUpperCase() : null;
    pol_npooles = cleanInt(rawNpooles);
    pol_npeces = cleanInt(rawNpeces);

    // ANOMALÍA C: Genovariante en columna ct (ej: 'I', 'II', 'III', 'B-I', 'I-II', 'V') o CT fuera de rango
    if (rawCt !== null && rawCt !== undefined && String(rawCt).trim() !== '') {
      const ctTrim = String(rawCt).trim();
      if (/[IVX]/i.test(ctTrim) && isNaN(parseFloat(ctTrim.replace(',', '.')))) {
        genovariante = cleanString(ctTrim.toUpperCase(), 20);
        ct = null;
      } else {
        ct = cleanCtDecimal(ctTrim);
      }
    }
  }

  return {
    rut_empresa,
    nombre_empresa,
    rut_empresaservicio,
    nombre_empresaservicio,
    caso_adlab,
    fecha_recepcion,
    lote,
    contenedor,
    nombre_centro,
    codigo_centro,
    nombre_tecnica,
    nombre_organo,
    pool,
    resultado,
    pol_npooles,
    pol_npeces,
    ct,
    genovariante,
    estado_caso
  };
}

// ============================================================================
// VERIFICACIÓN DE LAS 3 TABLAS EN SQL SERVER
// ============================================================================

async function verifyThreeTablesExist(pool) {
  console.log('\n🔍 Verificando existencia de las 3 tablas y nuevas columnas en LaboratorioADLHistorico...');

  const res = await pool.request().query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME IN ('historico_bmo_2006_2008', 'historico_bmo_2009_2012', 'historico_bmo_2013_2016')
  `);

  const found = res.recordset.map(r => r.TABLE_NAME);
  const expected = ['historico_bmo_2006_2008', 'historico_bmo_2009_2012', 'historico_bmo_2013_2016'];
  const missing = expected.filter(t => !found.includes(t));

  if (missing.length > 0) {
    throw new Error(
      `Faltan las siguientes tablas en LaboratorioADLHistorico: ${missing.join(', ')}. ` +
      `Ejecuta primero scripts/create_3_tables_historico.sql con un usuario administrador en SQL Server.`
    );
  }

  // Verificar nuevas columnas 2010–2016
  const colRes = await pool.request().query(`
    SELECT TABLE_NAME, COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME IN ('historico_bmo_2009_2012', 'historico_bmo_2013_2016')
  `);

  const colSet = new Set(colRes.recordset.map(r => `${r.TABLE_NAME}.${r.COLUMN_NAME}`));
  const requiredCols = [
    'historico_bmo_2009_2012.rut_empresa',
    'historico_bmo_2009_2012.nombre_empresa',
    'historico_bmo_2009_2012.rut_empresaservicio',
    'historico_bmo_2009_2012.nombre_empresaservicio',
    'historico_bmo_2013_2016.rut_empresa',
    'historico_bmo_2013_2016.rut_empresaservicio',
    'historico_bmo_2013_2016.nombre_empresaservicio',
    'historico_bmo_2013_2016.codigo_centro'
  ];

  const missingCols = requiredCols.filter(c => !colSet.has(c));
  if (missingCols.length > 0) {
    throw new Error(
      `Faltan las nuevas columnas 2010-2016 en LaboratorioADLHistorico: ${missingCols.join(', ')}. ` +
      `Ejecuta el script scripts/create_3_tables_historico.sql en SQL Server Management Studio.`
    );
  }

  console.log('✅ Las 3 tablas y todas las nuevas columnas (2010–2016) están listas.');
}

// ============================================================================
// CARGA DE TABLA 1: 2006–2008 DESDE EXCEL ORIGINALES
// ============================================================================

function buildSqlTable2006_2008() {
  const table = new sql.Table('historico_bmo_2006_2008');
  table.create = false;
  table.columns.add('n_caso', sql.VarChar(100), { nullable: true });
  table.columns.add('empresa', sql.VarChar(255), { nullable: true });
  table.columns.add('programa', sql.VarChar(255), { nullable: true });
  table.columns.add('centro', sql.VarChar(255), { nullable: true });
  table.columns.add('lugar_analisis', sql.VarChar(100), { nullable: true });
  table.columns.add('especie', sql.VarChar(100), { nullable: true });
  table.columns.add('estadio', sql.VarChar(100), { nullable: true });
  table.columns.add('lote', sql.VarChar(100), { nullable: true });
  table.columns.add('tipo_agua', sql.VarChar(100), { nullable: true });
  table.columns.add('tipo_muestra', sql.VarChar(150), { nullable: true });
  table.columns.add('tipo_muestreo', sql.VarChar(150), { nullable: true });
  table.columns.add('tejido', sql.VarChar(150), { nullable: true });
  table.columns.add('n_muestras', sql.Int, { nullable: true });
  table.columns.add('pool', sql.VarChar(50), { nullable: true });
  table.columns.add('fecha_muestreo', sql.Date, { nullable: true });
  table.columns.add('fecha_recepcion', sql.Date, { nullable: true });
  table.columns.add('tecnica', sql.VarChar(100), { nullable: true });
  table.columns.add('agente', sql.VarChar(150), { nullable: true });
  table.columns.add('resultado', sql.VarChar(100), { nullable: true });
  table.columns.add('positivos', sql.Int, { nullable: true });
  table.columns.add('negativos', sql.Int, { nullable: true });
  table.columns.add('intensidad', sql.VarChar(100), { nullable: true });
  table.columns.add('expr1', sql.VarChar(255), { nullable: true });
  table.columns.add('fuente_origen', sql.VarChar(100), { nullable: false });
  table.columns.add('fecha_carga', sql.DateTime2, { nullable: false });
  return table;
}

async function load2006_2008(pool) {
  console.log('\n======================================================');
  console.log('📂 INICIANDO CARGA FORMATO 1: dbo.historico_bmo_2006_2008');
  console.log('======================================================');

  let totalGrupo = 0;
  for (const f of FILES_2006_2008) {
    const t0 = Date.now();
    try {
      await pool.request().query(`DELETE FROM dbo.historico_bmo_2006_2008 WHERE fuente_origen = '${f.fuente}'`);
    } catch (_) {}
    const wb = XLSX.readFile(f.path, { cellDates: false, raw: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const rows = allRows.filter(r => r['N CASO'] !== null && String(r['N CASO']).trim() !== '');

    const fechaCarga = new Date();
    let inserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const slice = rows.slice(i, i + BATCH_SIZE);
      const table = buildSqlTable2006_2008();

      for (const r of slice) {
        const nCaso = cleanString(r['N CASO'], 100);
        const agente = cleanString(r['AGENTE'], 150);
        const positivos = cleanInt(r['POSITIVOS']);
        const negativos = cleanInt(r['NEGATIVOS']);
        const { n_muestras, pool: poolVal } = f.anio === 2006
          ? { n_muestras: cleanInt(r['N MUESTRAS']), pool: null }
          : parseMuestrasAndPool2006_2008(r['N MUESTRAS']);

        let resultado = null;
        if (agente && (agente.toLowerCase() === 'positivo' || agente.toLowerCase() === 'negativo')) {
          resultado = agente.charAt(0).toUpperCase() + agente.slice(1).toLowerCase();
        } else if (positivos !== null && positivos > 0) {
          resultado = 'Positivo';
        } else if (negativos !== null && negativos > 0) {
          resultado = 'Negativo';
        } else if (agente && ['pendiente', 'se adjunta informe'].includes(agente.toLowerCase())) {
          resultado = agente;
        }

        const rawFm = parseExcelDate(r['FECHA MUESTREO']);
        const rawFr = parseExcelDate(r['FECHA RECEPCION']);
        const { fecha_muestreo, fecha_recepcion } = fixKnownDateTypos(f.fuente, nCaso, rawFm, rawFr);

        table.rows.add(
          nCaso,
          cleanString(r['EMPRESA'], 255),
          cleanString(r['PROGRAMA'], 255),
          cleanString(r['CENTRO'], 255),
          cleanString(r['LUGAR ANALISIS'], 100),
          cleanString(r['ESPECIE'], 100),
          cleanString(r['ESTADIO'], 100),
          cleanString(r['LOTE'], 100),
          cleanString(r['TIPO AGUA'], 100),
          cleanString(r['TIPO MUESTRA'], 150),
          cleanString(r['TIPO MUESTREO'], 150),
          cleanString(r['TEJIDO'], 150),
          n_muestras,
          poolVal,
          fecha_muestreo,
          fecha_recepcion,
          cleanString(r['TECNICA'], 100),
          agente,
          resultado,
          positivos,
          negativos,
          cleanString(r['INTENSIDAD'], 100),
          cleanString(r['EXPR1'], 255),
          f.fuente,
          fechaCarga
        );
      }

      const res = await pool.request().bulk(table);
      inserted += (res.rowsAffected || slice.length);
    }

    totalGrupo += inserted;
    console.log(`   ✅ ${f.fuente}: ${inserted} filas (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  console.log(`🎉 Total dbo.historico_bmo_2006_2008: ${totalGrupo} filas.`);
}

// ============================================================================
// CARGA DE TABLA 2: 2009–2012 DESDE EXCEL ORIGINALES
// ============================================================================

function buildSqlTable2009_2012() {
  const table = new sql.Table('historico_bmo_2009_2012');
  table.create = false;
  table.columns.add('caso_adlab', sql.VarChar(100), { nullable: true });
  table.columns.add('rut_empresa', sql.VarChar(50), { nullable: true });
  table.columns.add('nombre_empresa', sql.VarChar(255), { nullable: true });
  table.columns.add('rut_empresaservicio', sql.VarChar(50), { nullable: true });
  table.columns.add('nombre_empresaservicio', sql.VarChar(255), { nullable: true });
  table.columns.add('nombre_centro', sql.VarChar(255), { nullable: true });
  table.columns.add('programa', sql.VarChar(255), { nullable: true });
  table.columns.add('matriz', sql.VarChar(150), { nullable: true });
  table.columns.add('pool', sql.VarChar(50), { nullable: true });
  table.columns.add('agente', sql.VarChar(150), { nullable: true });
  table.columns.add('ct', sql.Decimal(8, 4), { nullable: true });
  table.columns.add('resultado', sql.VarChar(50), { nullable: true });
  table.columns.add('resultado2', sql.VarChar(50), { nullable: true });
  table.columns.add('ct2', sql.Decimal(8, 4), { nullable: true });
  table.columns.add('positivos', sql.Int, { nullable: true });
  table.columns.add('fecha_muestreo', sql.Date, { nullable: true });
  table.columns.add('fecha_recepcion', sql.Date, { nullable: true });
  table.columns.add('fuente_origen', sql.VarChar(100), { nullable: false });
  table.columns.add('fecha_carga', sql.DateTime2, { nullable: false });
  return table;
}

async function load2009_2012(pool, { fromYear = 2009 } = {}) {
  console.log('\n======================================================');
  console.log(`📂 INICIANDO CARGA FORMATO 2: dbo.historico_bmo_2009_2012 (desde ${fromYear})`);
  console.log('======================================================');

  let totalGrupo = 0;
  const targetFiles = FILES_2009_2012.filter(f => f.anio >= fromYear);
  for (const f of targetFiles) {
    const t0 = Date.now();
    try {
      await pool.request().query(`DELETE FROM dbo.historico_bmo_2009_2012 WHERE fuente_origen = '${f.fuente}'`);
    } catch (_) {}
    const wb = XLSX.readFile(f.path, { cellDates: false, raw: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const rows = allRows.filter(r => r['caso_adlab'] !== null && String(r['caso_adlab']).trim() !== '');

    const fechaCarga = new Date();
    let inserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const slice = rows.slice(i, i + BATCH_SIZE);
      const table = buildSqlTable2009_2012();

      for (const r of slice) {
        const casoAdlab = cleanString(r['caso_adlab'], 100);
        const rawFm = parseExcelDate(r['fecha_muestreo']);
        const rawFr = parseExcelDate(r['fecha_recepcion']);
        const { fecha_muestreo, fecha_recepcion } = fixKnownDateTypos(f.fuente, casoAdlab, rawFm, rawFr);

        table.rows.add(
          casoAdlab,
          cleanString(r['rut_empresa'], 50),
          cleanString(r['nombre_empresa'], 255),
          cleanString(r['rut_empresaservicio'], 50),
          cleanString(r['nombre_empresaservicio'], 255),
          cleanString(r['nombre_centro'], 255),
          cleanString(r['programa'], 255),
          cleanString(r['matriz'], 150),
          cleanString(r['pool'], 50),
          cleanString(r['agente'], 150),
          cleanCtDecimal(r['ct']),
          cleanString(r['resultado'], 50),
          cleanString(r['resultado2'], 50),
          cleanCtDecimal(r['ct2']),
          cleanInt(r['positivos']),
          fecha_muestreo,
          fecha_recepcion,
          f.fuente,
          fechaCarga
        );
      }

      const res = await pool.request().bulk(table);
      inserted += (res.rowsAffected || slice.length);
    }

    totalGrupo += inserted;
    console.log(`   ✅ ${f.fuente}: ${inserted} filas (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  console.log(`🎉 Total insertado en dbo.historico_bmo_2009_2012: ${totalGrupo} filas.`);
}

// ============================================================================
// CARGA DE TABLA 3: 2013–2016 DESDE EXCEL ORIGINALES
// ============================================================================

function buildSqlTable2013_2016() {
  const table = new sql.Table('historico_bmo_2013_2016');
  table.create = false;
  table.columns.add('rut_empresa', sql.VarChar(50), { nullable: true });
  table.columns.add('nombre_empresa', sql.VarChar(255), { nullable: true });
  table.columns.add('rut_empresaservicio', sql.VarChar(50), { nullable: true });
  table.columns.add('nombre_empresaservicio', sql.VarChar(255), { nullable: true });
  table.columns.add('caso_adlab', sql.VarChar(100), { nullable: true });
  table.columns.add('fecha_recepcion', sql.Date, { nullable: true });
  table.columns.add('lote', sql.VarChar(150), { nullable: true });
  table.columns.add('contenedor', sql.VarChar(255), { nullable: true });
  table.columns.add('nombre_centro', sql.VarChar(255), { nullable: true });
  table.columns.add('codigo_centro', sql.VarChar(100), { nullable: true });
  table.columns.add('nombre_tecnica', sql.VarChar(150), { nullable: true });
  table.columns.add('nombre_organo', sql.VarChar(150), { nullable: true });
  table.columns.add('pool', sql.Int, { nullable: true });
  table.columns.add('resultado', sql.VarChar(50), { nullable: true });
  table.columns.add('pol_npooles', sql.Int, { nullable: true });
  table.columns.add('pol_npeces', sql.Int, { nullable: true });
  table.columns.add('ct', sql.Decimal(8, 4), { nullable: true });
  table.columns.add('genovariante', sql.VarChar(20), { nullable: true });
  table.columns.add('estado_caso', sql.VarChar(50), { nullable: true });
  table.columns.add('fuente_origen', sql.VarChar(100), { nullable: false });
  table.columns.add('fecha_carga', sql.DateTime2, { nullable: false });
  return table;
}

async function load2013_2016(pool) {
  console.log('\n======================================================');
  console.log('📂 INICIANDO CARGA FORMATO 3: dbo.historico_bmo_2013_2016');
  console.log('======================================================');

  let totalGrupo = 0;
  for (const f of FILES_2013_2016) {
    const t0 = Date.now();
    try {
      await pool.request().query(`DELETE FROM dbo.historico_bmo_2013_2016 WHERE fuente_origen = '${f.fuente}'`);
    } catch (_) {}
    const wb = XLSX.readFile(f.path, { cellDates: false, raw: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json(sheet, { defval: null });
    const rows = allRows.filter(r => r['caso_adlab'] !== null && String(r['caso_adlab']).trim() !== '');

    const fechaCarga = new Date();
    let inserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const slice = rows.slice(i, i + BATCH_SIZE);
      const table = buildSqlTable2013_2016();

      for (const rawRow of slice) {
        const n = normalizarFila2013_2016(rawRow);
        table.rows.add(
          n.rut_empresa,
          n.nombre_empresa,
          n.rut_empresaservicio,
          n.nombre_empresaservicio,
          n.caso_adlab,
          n.fecha_recepcion,
          n.lote,
          n.contenedor,
          n.nombre_centro,
          n.codigo_centro,
          n.nombre_tecnica,
          n.nombre_organo,
          n.pool,
          n.resultado,
          n.pol_npooles,
          n.pol_npeces,
          n.ct,
          n.genovariante,
          n.estado_caso,
          f.fuente,
          fechaCarga
        );
      }

      const res = await pool.request().bulk(table);
      inserted += (res.rowsAffected || slice.length);
    }

    totalGrupo += inserted;
    console.log(`   ✅ ${f.fuente}: ${inserted} filas (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  console.log(`🎉 Total dbo.historico_bmo_2013_2016: ${totalGrupo} filas.`);
}

// ============================================================================
// AUDITORÍA POST-CARGA
// ============================================================================

async function runPostLoadAudit(pool) {
  console.log('\n======================================================');
  console.log('🔍 AUDITORÍA DE CALIDAD Y VERACIDAD POST-CARGA');
  console.log('======================================================');

  const q1 = await pool.request().query(`
    SELECT 'historico_bmo_2006_2008' AS tabla, COUNT(*) AS filas, MIN(fecha_muestreo) AS min_fm, MAX(fecha_muestreo) AS max_fm, MIN(fecha_recepcion) AS min_fr, MAX(fecha_recepcion) AS max_fr FROM dbo.historico_bmo_2006_2008
    UNION ALL
    SELECT 'historico_bmo_2009_2012', COUNT(*), MIN(fecha_muestreo), MAX(fecha_muestreo), MIN(fecha_recepcion), MAX(fecha_recepcion) FROM dbo.historico_bmo_2009_2012
    UNION ALL
    SELECT 'historico_bmo_2013_2016', COUNT(*), NULL, NULL, MIN(fecha_recepcion), MAX(fecha_recepcion) FROM dbo.historico_bmo_2013_2016
  `);
  console.table(q1.recordset);

  const q2 = await pool.request().query(`
    SELECT 
      (SELECT COUNT(*) FROM dbo.historico_bmo_2009_2012 WHERE ct <= 0 OR ct > 60 OR ct2 <= 0 OR ct2 > 60) AS ct_fuera_rango_09_12,
      (SELECT COUNT(*) FROM dbo.historico_bmo_2013_2016 WHERE ct <= 0 OR ct > 60) AS ct_fuera_rango_13_16,
      (SELECT COUNT(*) FROM dbo.historico_bmo_2013_2016 WHERE resultado NOT IN ('P', 'N', 'EP', 'NA')) AS resultados_invalidos_13_16,
      (SELECT COUNT(*) FROM dbo.historico_bmo_2013_2016 WHERE nombre_tecnica LIKE '%)%' AND nombre_tecnica NOT LIKE '%(%') AS tecnicas_partidas_13_16,
      (SELECT COUNT(*) FROM dbo.historico_bmo_2013_2016 WHERE genovariante IS NOT NULL) AS genovariantes_extraidas_13_16
  `);
  console.log('📌 Verificación de anomalías (deben ser 0 errores):');
  console.table(q2.recordset);
}

async function main() {
  const globalStart = Date.now();
  const isFrom2010 = process.argv.includes('--from-2010');
  const pool = await getConnectionHistorico();

  await verifyThreeTablesExist(pool);
  if (!isFrom2010) {
    await load2006_2008(pool);
  }
  await load2009_2012(pool, { fromYear: isFrom2010 ? 2010 : 2009 });
  await load2013_2016(pool);
  await runPostLoadAudit(pool);

  console.log(`\n⏱️ Proceso completo finalizado en ${((Date.now() - globalStart) / 1000).toFixed(1)}s`);
  await closeConnectionHistorico();
}

main().catch(async (err) => {
  console.error('❌ Error en la carga de las 3 tablas:', err);
  await closeConnectionHistorico().catch(() => {});
  process.exit(1);
});
