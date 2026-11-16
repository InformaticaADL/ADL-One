import XLSX from 'xlsx';
import sql from 'mssql';
import path from 'path';
import { getConnectionHistorico, closeConnectionHistorico } from '../src/config/databaseHistorico.js';

const FILES_2010 = [
  {
    path: 'C:\\Users\\frehbein\\Desktop\\proyectos\\ADL-One\\DB HISTORICA ADL BMO\\Año 2010\\AY-2010\\HISTORICO_ADL_AY-2010.xls',
    fuente_origen: 'HISTORICO_ADL_AY-2010.xls',
    descripcion: 'Aysén (AY-2010)'
  },
  {
    path: 'C:\\Users\\frehbein\\Desktop\\proyectos\\ADL-One\\DB HISTORICA ADL BMO\\Año 2010\\PM-2010\\HISTORICO_ADL_PM-2010.xls',
    fuente_origen: 'HISTORICO_ADL_PM-2010.xls',
    descripcion: 'Puerto Montt (PM-2010)'
  },
  {
    path: 'C:\\Users\\frehbein\\Desktop\\proyectos\\ADL-One\\DB HISTORICA ADL BMO\\Año 2010\\VI-2010\\HISTORICO_ADL_VI-2010.xls',
    fuente_origen: 'HISTORICO_ADL_VI-2010.xls',
    descripcion: 'Villarrica (VI-2010)'
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
  if (str === '' || ['NULL', 'NA', 'NI', '-', '.', ','].includes(str.toUpperCase())) return null;
  const num = parseInt(str, 10);
  return isNaN(num) ? null : num;
}

function cleanDecimal(val) {
  if (val === null || val === undefined) return null;
  const str = String(val).trim().replace(',', '.');
  if (str === '' || ['NULL', 'NA', 'NI', '-', '.', ','].includes(str.toUpperCase())) return null;
  let num = parseFloat(str);
  if (isNaN(num)) return null;

  // Corregir valores de Ct sin punto decimal (ej: 25417 -> 25.417, 2762 -> 27.62)
  if (num > 10000 && num < 100000) {
    num = num / 1000;
  } else if (num > 1000 && num < 10000) {
    num = num / 100;
  }

  // Asegurar que quepa en DECIMAL(8, 4)
  if (num > 9999.9999 || num < -9999.9999) return null;

  return num;
}

function parseExcelDate(val) {
  if (val === null || val === undefined || val === '') return null;
  const str = String(val).trim();
  if (['NA', 'NI', '-', 'NULL', 'null', '00-00-2010', '/  /', ''].includes(str)) return null;

  // Si es un número serial de Excel (ej: 40269)
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
  table.columns.add('ct', sql.Decimal(8, 4), { nullable: true });
  table.columns.add('ct2', sql.Decimal(8, 4), { nullable: true });
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

  // Si el archivo ya fue parcialmente insertado, limpiarlo antes para evitar duplicados
  try {
    const delRes = await pool.request().query(`DELETE FROM dbo.historico_laboratorio_unificado WHERE fuente_origen = '${fuente_origen}'`);
    if (delRes.rowsAffected[0] > 0) {
      console.log(`   🧹 Se eliminaron ${delRes.rowsAffected[0]} registros previos de esta fuente para recarga limpia.`);
    }
  } catch (delErr) {
    // Si no tiene permiso de DELETE se omite
  }

  const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
  const sheetName = workbook.SheetNames[0];
  const allRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });

  // En 2010 la columna de caso es 'caso_adlab'
  const rows = allRows.filter(r => r['caso_adlab'] !== null && String(r['caso_adlab']).trim() !== '');

  console.log(`📊 Filas válidas a insertar: ${rows.length}`);

  const fechaCarga = new Date();
  let totalInserted = 0;
  let batchIndex = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    batchIndex++;
    const slice = rows.slice(i, i + BATCH_SIZE);
    const table = createSqlTable();

    for (const r of slice) {
      table.rows.add(
        cleanString(r['caso_adlab'], 100),
        null, // empresa
        cleanString(r['programa'], 255),
        cleanString(r['nombre_centro'], 255),
        null, // especie
        null, // estadio
        null, // lote
        null, // tipo_agua
        null, // tipo_muestra
        null, // tipo_muestreo
        cleanString(r['matriz'], 150),
        null, // n_muestras
        cleanString(r['pool'], 50),
        parseExcelDate(r['fecha_muestreo']),
        parseExcelDate(r['fecha_recepcion']),
        null, // tecnica
        cleanString(r['agente'], 150),
        cleanString(r['resultado'], 100),
        cleanString(r['resultado2'], 100),
        cleanDecimal(r['ct']),
        cleanDecimal(r['ct2']),
        cleanInt(r['positivos']),
        null, // negativos
        null, // intensidad
        null, // expr1
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
  console.log(`🚀 Iniciando proceso de carga para el Año 2010 (AY, PM, VI)...`);

  const pool = await getConnectionHistorico();
  let granTotal = 0;

  for (const f of FILES_2010) {
    const inserted = await procesarArchivo(pool, f);
    granTotal += inserted;
  }

  const totalTime = ((Date.now() - globalStart) / 1000).toFixed(2);
  console.log(`\n======================================================`);
  console.log(`🎉 CARGA TOTAL AÑO 2010 FINALIZADA`);
  console.log(`   - Total registros cargados en 2010: ${granTotal}`);
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
  console.error('❌ Error durante la carga de 2010:', err);
  await closeConnectionHistorico().catch(() => {});
  process.exit(1);
});
