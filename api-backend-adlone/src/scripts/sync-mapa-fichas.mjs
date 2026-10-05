// Reconstruye mig_id_map para las fichas (el cargador migracion-fic.mjs las creó con ids nuevos sin registrar la equivalencia).
// Criterio: cada ficha nueva con visitas se identifica por fic_visita.id_agendamam_legacy → ficha del legado (exacto).
// Las fichas sin visitas se asignan por posición SOLO si el criterio exacto demuestra que el orden coincide (ids nuevos crecientes con el id legado).
// Solo escribe en la base TEST. Sin --apply solo informa.
import 'dotenv/config'; import sql from 'mssql';
const APPLY = process.argv.includes('--apply');
const DB = process.env.MIG_TEST_DB || 'ADL ONE TEST'; if (!/TEST/i.test(DB)) { console.error('la base destino no contiene TEST'); process.exit(1); }
const cfg = (database) => ({ server: process.env.DB_SERVER, port: 1433, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database, requestTimeout: 120000, options: { encrypt: true, trustServerCertificate: true } });
const leg = await new sql.ConnectionPool(cfg(process.env.DB_DATABASE)).connect(), dst = await new sql.ConnectionPool(cfg(DB)).connect();
const L = async (s) => (await leg.request().query(s)).recordset, N = async (s) => (await dst.request().query(s)).recordset;
const enc = (await L(`SELECT id_fichaingresoservicio id FROM App_Ma_FichaIngresoServicio_ENC ORDER BY 1`)).map((r) => Number(r.id));
const nuevas = (await N(`SELECT id FROM fic_ficha ORDER BY id`)).map((r) => r.id);
console.log(`fichas legado=${enc.length} nuevas=${nuevas.length}`);
const ag = new Map((await L(`SELECT id_agendamam a, id_fichaingresoservicio f FROM App_Ma_Agenda_MUESTREOS`)).map((r) => [Number(r.a), Number(r.f)]));
const exacto = new Map(); let conflicto = 0;
for (const v of await N(`SELECT id_ficha, id_agendamam_legacy a FROM fic_visita WHERE id_agendamam_legacy IS NOT NULL`)) { const f = ag.get(Number(v.a)); if (f == null) continue; if (exacto.has(v.id_ficha) && exacto.get(v.id_ficha) !== f) conflicto++; exacto.set(v.id_ficha, f); }
let posCoincide = 0, posDifiere = 0; for (const [nueva, f] of exacto) { const i = nuevas.indexOf(nueva); if (enc[i] === f) posCoincide++; else posDifiere++; }
console.log(`por visitas: ${exacto.size} fichas; conflictos=${conflicto}; coincide con la posición=${posCoincide}; difiere=${posDifiere}`);
if (conflicto || posDifiere || nuevas.length !== enc.length) { console.log('NO se puede asumir la posición: hay que resolver a mano.'); process.exit(1); }
console.log('el criterio por posición es consistente con el exacto → se asigna posición a todas.');
if (!APPLY) { console.log('(informe) agrega --apply para escribir mig_id_map'); process.exit(0); }
let n = 0; for (let i = 0; i < enc.length; i++) {
  const r = await dst.request().input('l', sql.Int, enc[i]).input('n', sql.Int, nuevas[i]).query(`IF NOT EXISTS (SELECT 1 FROM mig_id_map WHERE tabla_legado='App_Ma_FichaIngresoServicio_ENC' AND id_legado=@l) INSERT INTO mig_id_map (tabla_legado,id_legado,tabla_nueva,id_nuevo) VALUES ('App_Ma_FichaIngresoServicio_ENC',@l,'fic_ficha',@n)`); n += r.rowsAffected[0] || 0;
}
console.log('mapas escritos:', n); process.exit(0);
