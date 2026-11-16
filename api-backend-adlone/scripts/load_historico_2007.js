import XLSX from 'xlsx';
import sql from 'mssql';
import path from 'path';
import { getConnectionHistorico, closeConnectionHistorico } from '../src/config/databaseHistorico.js';

const FILES_2007 = [
  {
    path: 'C:\\Users\\frehbein\\Desktop\\proyectos\\ADL-One\\DB HISTORICA ADL BMO\\Año 2007\\AY-2007\\HISTORICO_ADL_AY-2007.xls',
    fuente_origen: 'HISTORICO_ADL_AY-2007.xls',
    descripcion: 'Aysén (AY-2007)'
  },
  {
    path: 'C:\\Users\\frehbein\\Desktop\\proyectos\\ADL-One\\DB HISTORICA ADL BMO\\Año 2007\\CA-2007\\HISTORICO_ADL_CA-2007.xls',
    fuente_origen: 'HISTORICO_ADL_CA-2007.xls',
    descripcion: 'Castro (CA-2007)'
  }
];

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
  if (str === '' || ['NULL', 'NA', 'NI', '-', '.'].includes(str.toUpperCase())) return null;
  const num = parseInt(str, 10);
  return isNaN(num) ? null : num;
}

function parseMuestrasAndPool(val) {
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
  if (['NA', 'NI', '-', 'NULL', 'null', '00-00-2006', '00-00-2007', ''].includes(str)) return null;

  // Erratas tipográficas puntuales detectadas en archivos históricos de 2007
  if (str === '27502/2007') return new Date('2007-02-27T00:00:00Z');
  if (str === '0810-2007') return new Date('2007-10-08T00:00:00Z');
  if (str === '2117/11/2006') return new Date('2006-11-17T00:00:00Z');
  if (str === '28--01-2006') return new Date('2006-01-28T00:00:00Z');

  // Si es un número serial de Excel (ej: 39084)
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

async function procesarArchivo(pool, fileConfig) {
  const { path: filePath, fuente_origen, descripcion } = fileConfig;
  console.log(`\n======================================================`);
  console.log(`📂 Procesando ${descripcion}`);
  console.log(`   Ruta: ${filePath}`);
  const startTime = Date.now();

  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  const sheetName = workbook.SheetNames[0];
  const allRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });

  // Filtrar filas completamente vacías si existieran
  const rows = allRows.filter(r => r['N CASO'] !== null && String(r['N CASO']).trim() !== '');

  console.log(`📊 Filas válidas a insertar: ${rows.length}`);

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
      const { n_muestras, pool } = parseMuestrasAndPool(r['N MUESTRAS']);

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
        n_muestras,
        pool,
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
        fuente_origen,
        fechaCarga
      );
    }

    const request = pool.request();
    const result = await request.bulk(table);
    totalInserted += (result.rowsAffected || slice.length);
    console.log(`    Lote ${batchIndex}: ${totalInserted} / ${rows.length} filas insertadas...`);
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ ${descripcion} completado exitosamente: ${totalInserted} filas en ${durationSec}s`);
  return totalInserted;
}

async function run() {
  const globalStart = Date.now();
  console.log(`🚀 Iniciando proceso de carga para el Año 2007...`);

  const pool = await getConnectionHistorico();
  let granTotal = 0;

  for (const f of FILES_2007) {
    const inserted = await procesarArchivo(pool, f);
    granTotal += inserted;
  }

  const totalTime = ((Date.now() - globalStart) / 1000).toFixed(2);
  console.log(`\n======================================================`);
  console.log(`🎉 CARGA TOTAL AÑO 2007 FINALIZADA`);
  console.log(`   - Total registros cargados en 2007: ${granTotal}`);
  console.log(`   - Tiempo total: ${totalTime}s`);

  // Resumen acumulado en la base de datos
  const verifyRes = await pool.request().query(`
    SELECT 
      fuente_origen,
      COUNT(*) AS total_registros,
      MIN(fecha_muestreo) AS min_fecha_muestreo,
      MAX(fecha_muestreo) AS max_fecha_muestreo,
      COUNT(DISTINCT n_caso) AS casos_distintos
    FROM dbo.historico_laboratorio_unificado
    GROUP BY fuente_origen
    ORDER BY fuente_origen
  `);

  console.log('\n📈 Resumen por fuente en LaboratorioADLHistorico:');
  console.table(verifyRes.recordset);

  const totalGral = await pool.request().query(`
    SELECT COUNT(*) AS total_acumulado_db FROM dbo.historico_laboratorio_unificado
  `);
  console.log(`📌 Registros totales acumulados en la tabla: ${totalGral.recordset[0].total_acumulado_db}`);

  await closeConnectionHistorico();
}

run().catch(async (err) => {
  console.error('❌ Error durante la carga de 2007:', err);
  await closeConnectionHistorico().catch(() => {});
  process.exit(1);
});
