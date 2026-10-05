// Detección de cambios por huellas: no toca el legado (solo SELECT).
//
// Para cada tabla se calcula, en el propio SQL Server, una huella por fila (o por grupo de filas):
//   hash1 = BINARY_CHECKSUM(*)   hash2 = CHECKSUM(*)   (dos huellas independientes: una colisión simultánea es muy improbable)
// y se compara con la huella guardada en la base nueva (mig_sync_huella). La conciliación nocturna cubre el riesgo residual.
// En los grupos de filas (tablas sin PK) las huellas de cada fila se SUMAN (módulo un primo cercano a 2^31, para caber en INT). Se probó con CHECKSUM_AGG (XOR)
// y falla: si dos filas del mismo grupo reciben exactamente la misma modificación (p. ej. marcar dos equipos como usados), los dos cambios se anulan y el grupo
// parece intacto (falso negativo, detectado en la prueba de escrituras de APP MAM, 2026-09-25). Con la suma, dos cambios iguales suman el doble y no se anulan.

const claveSql = (cols) => (cols.length === 1
  ? `CAST([${cols[0]}] AS NVARCHAR(60))`
  : `CONCAT(${cols.map((c) => `CAST([${c}] AS NVARCHAR(60))`).join(`,'|',`)})`);

// Todas las huellas actuales del legado para una tabla del registro.
export async function huellasLegado(poolLegado, cfg) {
  const cols = cfg.modo === 'grupo' ? cfg.unidad : cfg.pk;
  const k = claveSql(cols); const grupo = cols.map((c) => `[${c}]`).join(',');
  const consulta = (conCk) => (cfg.modo === 'grupo'
    ? `SELECT ${k} AS clave, ISNULL(CAST(SUM(CAST(BINARY_CHECKSUM(*) AS BIGINT)) % 2147483629 AS INT),0) AS h1, ${conCk ? 'ISNULL(CAST(SUM(CAST(CHECKSUM(*) AS BIGINT)) % 2147483629 AS INT),0)' : '0'} AS h2, COUNT(*) AS n FROM [${cfg.tabla}] GROUP BY ${grupo}`
    : `SELECT ${k} AS clave, BINARY_CHECKSUM(*) AS h1, ${conCk ? 'CHECKSUM(*)' : '0'} AS h2, 1 AS n FROM [${cfg.tabla}]`);
  try { return (await poolLegado.request().query(consulta(true))).recordset; }
  catch (e) {
    // CHECKSUM(*) no admite columnas text/ntext/image/xml: se usa solo BINARY_CHECKSUM (que las ignora) para esa tabla.
    if (/8116|noncomparable|not comparable|argument data type/i.test(e.message)) return (await poolLegado.request().query(consulta(false))).recordset;
    throw e;
  }
}

// Diferencias entre lo que hay en el legado y lo que ya se sincronizó.
//   upserts  → filas nuevas o cambiadas (o grupos)     borrados → claves que ya no existen en el legado
export function comparar(legado, guardado) {
  const upserts = [], vistos = new Set();
  for (const r of legado) {
    vistos.add(String(r.clave));
    const g = guardado.get(String(r.clave));
    if (!g || g.hash1 !== r.h1 || g.hash2 !== r.h2 || g.filas !== r.n) upserts.push({ clave: String(r.clave), h1: r.h1, h2: r.h2, n: r.n });
  }
  const borrados = []; for (const k of guardado.keys()) if (!vistos.has(k)) borrados.push(k);
  // Siempre en orden de clave: al fusionar por nombre, la fila del legado con el id menor es la que "crea" la fila nueva (igual que el cargador).
  const porClave = (a, b) => { const x = Number(a.clave ?? a), y = Number(b.clave ?? b); return Number.isFinite(x) && Number.isFinite(y) ? x - y : String(a.clave ?? a).localeCompare(String(b.clave ?? b)); };
  upserts.sort(porClave); borrados.sort(porClave);
  return { upserts, borrados };
}
