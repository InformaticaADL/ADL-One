/* Conciliación legado ↔ base nueva (pensada para correr cada noche). Solo LEE en ambas bases.
 *
 *   node src/sync/conciliacion.mjs                 → todos los módulos
 *   node src/sync/conciliacion.mjs --modulo fac    → uno solo
 *   Código de salida: 0 = limpia, 1 = hay diferencias (para que un programador de tareas o un monitor lo detecte).
 *
 * Por cada tabla del registro comprueba:
 *   1. filas del legado vs filas ya sincronizadas (huellas guardadas);
 *   2. cambios pendientes (huella distinta) y borrados pendientes: el motor debería haberlos aplicado;
 *   3. errores abiertos en la cola (los AVISO se cuentan aparte: son informativos);
 *   4. tablas apagadas con el interruptor.
 * Y una vez por base: equivalencias (mig_id_map) que apuntan a una fila que ya no existe en la base nueva.
 * Es un control de "el motor está al día"; el contenido campo por campo lo cubren las baterías de prueba de cada módulo.
 */
import 'dotenv/config';
import { getConnection } from '../config/database.js';
import { getConnectionNueva } from '../config/databaseNueva.js';
import { REGISTRO } from './registro.js';
import { huellasLegado, comparar } from './detector.js';
import { cargarHuellas, tablasDeshabilitadas } from './estado.js';

const arg = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };
const modulo = arg('--modulo');
const leg = await getConnection(), nuevo = await getConnectionNueva();
const apagadas = await tablasDeshabilitadas(nuevo);
const filas = []; let problemas = 0;

for (const cfg of REGISTRO.filter((c) => !modulo || c.modulo === modulo).sort((a, b) => a.orden - b.orden)) {
  const actual = await huellasLegado(leg, cfg), guardado = await cargarHuellas(nuevo, cfg.tabla);
  const { upserts, borrados } = comparar(actual, guardado);
  const nLeg = actual.reduce((s, r) => s + Number(r.n), 0), nSync = [...guardado.values()].reduce((s, r) => s + Number(r.filas), 0);
  const err = (await nuevo.request().input('t', cfg.tabla).query(`SELECT SUM(CASE WHEN mensaje LIKE N'AVISO:%' THEN 0 ELSE 1 END) errores, SUM(CASE WHEN mensaje LIKE N'AVISO:%' THEN 1 ELSE 0 END) avisos FROM mig_sync_error WHERE tabla_legado=@t AND resuelto_en IS NULL`)).recordset[0];
  const f = { modulo: cfg.modulo, tabla: cfg.tabla, legado: nLeg, sincronizadas: nSync, pendientes: upserts.length, por_borrar: borrados.length, errores: err.errores || 0, avisos: err.avisos || 0, apagada: apagadas.has(cfg.tabla) ? 'SÍ' : '' };
  f.estado = f.apagada || f.pendientes || f.por_borrar || f.errores ? 'REVISAR' : 'OK'; if (f.estado !== 'OK') problemas++;
  filas.push(f);
}
console.log(`\n== CONCILIACIÓN ${new Date().toISOString().replace('T', ' ').slice(0, 19)}${modulo ? ` (módulo ${modulo})` : ''} ==`);
console.table(filas);

// Equivalencias que apuntan a filas inexistentes (id_nuevo > 0; los ids ≤ 0 son marcadores de sedes)
const destinos = (await nuevo.request().query(`SELECT DISTINCT tabla_nueva FROM mig_id_map WHERE id_nuevo > 0`)).recordset.map((r) => r.tabla_nueva);
const huerfanas = [];
for (const tb of destinos) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tb)) continue;
  try { const n = (await nuevo.request().query(`SELECT COUNT(*) n FROM mig_id_map m WHERE m.tabla_nueva='${tb}' AND m.id_nuevo > 0 AND NOT EXISTS (SELECT 1 FROM ${tb} x WHERE x.id = m.id_nuevo)`)).recordset[0].n; if (n) huerfanas.push({ tabla_nueva: tb, equivalencias_huerfanas: n }); }
  catch (e) { huerfanas.push({ tabla_nueva: tb, equivalencias_huerfanas: `no comprobable: ${e.message.slice(0, 60)}` }); }
}
if (huerfanas.length) { problemas++; console.log('Equivalencias (mig_id_map) que apuntan a filas inexistentes:'); console.table(huerfanas); } else console.log(`Equivalencias (mig_id_map): ${destinos.length} tablas destino sin huérfanas.`);
const totAvisos = filas.reduce((s, f) => s + Number(f.avisos), 0); if (totAvisos) console.log(`Avisos informativos abiertos: ${totAvisos} (no cuentan como diferencia).`);
console.log(problemas ? `\nRESULTADO: ${problemas} punto(s) a revisar.` : '\nRESULTADO: conciliación limpia.');
process.exit(problemas ? 1 : 0);
