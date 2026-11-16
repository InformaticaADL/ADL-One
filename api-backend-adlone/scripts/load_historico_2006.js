import XLSX from 'xlsx';
import sql from 'mssql';
import path from 'path';
import { getConnectionHistorico, closeConnectionHistorico } from '../src/config/databaseHistorico.js';
import logger from '../src/utils/logger.js';

const EXCEL_PATH = 'C:\\Users\\frehbein\\Desktop\\proyectos\\ADL-One\\DB HISTORICA ADL BMO\\Año 2006\\PM-2006\\HISTORICO_ADL_PM-2006.xls';
const FUENTE_ORIGEN = 'HISTORICO_ADL_PM-2006.xls';
const BATCH_SIZE = 2500;

function cleanString(val, maxLen) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (str === '' || str.toUpperCase() === 'NULL') return null;
  return maxLen ? str.slice(0, maxLen) : str;
}

function cleanInt(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (str === '' || str.toUpperCase() === 'NULL' || str.toUpperCase() === 'NA' || str.toUpperCase() === 'NI') return null;
  const num = parseInt(str, 10);
  return isNaN(num) ? null : num;
}

function parseExcelDate(val) {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim();
  if (['NA', 'NI', '-', 'NULL', 'null', '00-00-2006', ''].includes(str)) return null;

  // Corregir erratas puntuales del archivo histórico
  if (str === '2117/11/2006') return new Date('2006-11-17T00:00:00Z');
  if (str === '28--01-2006') return new Date('2006-01-28T00:00:00Z');

  // Si es un número serial de Excel (ej: 38729)
  if (typeof val === 'number' || (!isNaN(val) && !str.includes('/') && !str.includes('-'))) {
    const num = Number(val);
    if (num > 0 && num < 100000) {
      const date = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Si viene en formato DD/MM/YYYY o DD-MM-YYYY
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

function createSqlTable() {
  const table = new sql.Table('historico_laboratorio_unificado');
  table.create = false;

  table.columns.add('n_caso', sql.VarChar(100), { nullable: true });
  table.columns.add('empresa', sql.VarChar(255), { nullable: true });
  table.columns.add('programa', sql.VarChar(255), { nullable: true });
  table.columns.add('centro', sql.VarChar(255), { nullable: true });
  table.columns.add('especie', sql.VarChar(100), { nullable: true });
  table.columns.add('estadio', sql.VarChar(100), { nullable: true });
  table.columns.add('lote', sql.VarChar(100), { nullable: true });
  table.columns.add('tipo_agua', sql.VarChar(100), { nullable: true });
  table.columns.add('tipo_muestra', sql.VarChar(150), { nullable: true });
  table.columns.add('tipo_muestreo', sql.VarChar(150), { nullable: true });
  table.columns.add('tejido_matriz', sql.VarChar(150), { nullable: true });
  table.columns.add('n_muestras', sql.Int, { nullable: true });
  table.columns.add('pool', sql.VarChar(50), { nullable: true });
  table.columns.add('fecha_muestreo', sql.Date, { nullable: true });
  table.columns.add('fecha_recepcion', sql.Date, { nullable: true });
  table.columns.add('tecnica', sql.VarChar(100), { nullable: true });
  table.columns.add('agente', sql.VarChar(150), { nullable: true });
  table.columns.add('resultado', sql.VarChar(100), { nullable: true });
  table.columns.add('resultado2', sql.VarChar(100), { nullable: true });
  table.columns.add('ct', sql.Decimal(10, 2), { nullable: true });
  table.columns.add('ct2', sql.Decimal(10, 2), { nullable: true });
  table.columns.add('positivos', sql.Int, { nullable: true });
  table.columns.add('negativos', sql.Int, { nullable: true });
  table.columns.add('intensidad', sql.VarChar(100), { nullable: true });
  table.columns.add('expr1', sql.VarChar(255), { nullable: true });
  table.columns.add('fuente_origen', sql.VarChar(100), { nullable: false });
  table.columns.add('fecha_carga', sql.DateTime2, { nullable: false });

  return table;
}

async function run() {
  console.log(`\n📂 Leyendo archivo Excel: ${EXCEL_PATH}`);
  const startTime = Date.now();

  const workbook = XLSX.readFile(EXCEL_PATH, { cellDates: false, raw: false });
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });

  console.log(`📊 Total de filas en Excel: ${rows.length}`);

  const pool = await getConnectionHistorico();
  const fechaCarga = new Date();

  let totalInserted = 0;
  let batchIndex = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batchIndex++;
    const slice = rows.slice(i, i + BATCH_SIZE);
    const table = createSqlTable();

    for (const r of slice) {
      const agente = cleanString(r['AGENTE'], 150);
      const positivos = cleanInt(r['POSITIVOS']);
      const negativos = cleanInt(r['NEGATIVOS']);

      // Determinar resultado
      let resultado = null;
      if (agente && (agente.toLowerCase() === 'positivo' || agente.toLowerCase() === 'negativo')) {
        resultado = agente;
      } else if (positivos !== null && positivos > 0) {
        resultado = 'Positivo';
      } else if (negativos !== null && negativos > 0) {
        resultado = 'Negativo';
      }

      table.rows.add(
        cleanString(r['N CASO'], 100),
        cleanString(r['EMPRESA'], 255),
        cleanString(r['PROGRAMA'], 255),
        cleanString(r['CENTRO'], 255),
        cleanString(r['ESPECIE'], 100),
        cleanString(r['ESTADIO'], 100),
        cleanString(r['LOTE'], 100),
        cleanString(r['TIPO AGUA'], 100),
        cleanString(r['TIPO MUESTRA'], 150),
        cleanString(r['TIPO MUESTREO'], 150),
        cleanString(r['TEJIDO'], 150),
        cleanInt(r['N MUESTRAS']),
        null, // pool
        parseExcelDate(r['FECHA MUESTREO']),
        parseExcelDate(r['FECHA RECEPCION']),
        cleanString(r['TECNICA'], 100),
        agente,
        resultado,
        null, // resultado2
        null, // ct
        null, // ct2
        positivos,
        negativos,
        cleanString(r['INTENSIDAD'], 100),
        cleanString(r['EXPR1'], 255),
        FUENTE_ORIGEN,
        fechaCarga
      );
    }

    const request = pool.request();
    const result = await request.bulk(table);
    totalInserted += (result.rowsAffected || slice.length);
    console.log(`    lote ${batchIndex}: ${totalInserted} / ${rows.length} filas insertadas...`);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Carga completada exitosamente!`);
  console.log(`   - Filas insertadas: ${totalInserted}`);
  console.log(`   - Tiempo transcurrido: ${durationSec}s`);

  // Verificar en base de datos
  const verifyRes = await pool.request().query(`
    SELECT 
      COUNT(*) AS total_registros,
      MIN(fecha_muestreo) AS min_fecha_muestreo,
      MAX(fecha_muestreo) AS max_fecha_muestreo,
      COUNT(DISTINCT n_caso) AS casos_distintos
    FROM dbo.historico_laboratorio_unificado
    WHERE fuente_origen = '${FUENTE_ORIGEN}'
  `);

  console.log('\n📈 Resumen en LaboratorioADLHistorico:');
  console.log(verifyRes.recordset[0]);

  await closeConnectionHistorico();
}

run().catch(async (err) => {
  console.error('❌ Error durante la carga:', err);
  await closeConnectionHistorico().catch(() => {});
  process.exit(1);
});
