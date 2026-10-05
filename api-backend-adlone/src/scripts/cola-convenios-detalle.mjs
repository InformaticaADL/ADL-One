/* =====================================================================
   Enriquece el detalle de la cola FAC_CONVENIO (revision_duplicado) en la base nueva de PRUEBA
   =====================================================================
   Uso: node src/scripts/cola-convenios-detalle.mjs [--apply]     (sin --apply solo muestra un ejemplo)

   Agrega a cada par PENDIENTE lo que hace falta para decidir sin salir de la pantalla:
   servicio, empresa y centro de cada convenio; cuántas tarifas tiene; en cuántas cotizaciones
   se usó; y la comparación de precios entre ambos (técnicas+tabla en común y cuántas con precio distinto).
   Los pares SIN técnica+tabla en común (complementarios) se marcan MANTENER_SEPARADO automáticamente.
   Ejecutar después de cargar fac_ (migracion-fac.mjs).
   Solo escribe en una base cuyo nombre contenga "TEST". No toca legado.
   ===================================================================== */
import dotenv from 'dotenv'; dotenv.config();
import sql from 'mssql';

const APPLY = process.argv.includes('--apply');
const TEST_DB = process.env.MIG_TEST_DB || 'ADL ONE TEST';
if (!/TEST/i.test(TEST_DB)) { console.error(`ABORTADO: la base destino "${TEST_DB}" no contiene "TEST".`); process.exit(1); }
const dst = await new sql.ConnectionPool({ server: process.env.DB_SERVER, port: 1433, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: TEST_DB,
  requestTimeout: 120000, options: { encrypt: true, trustServerCertificate: true } }).connect();
const q = async (text, p = {}) => { const rq = dst.request(); for (const [k, v] of Object.entries(p)) rq.input(k, v); return (await rq.query(text)).recordset; };

try {
  const conv = new Map((await q(`
    SELECT c.id, c.nombre, c.habilitado, s.nombre AS servicio, e.razon_social AS empresa, ce.nombre AS centro,
           (SELECT COUNT(*) FROM fac_convenio_precio p WHERE p.id_convenio = c.id) AS tarifas,
           (SELECT COUNT(DISTINCT i.id_cotizacion) FROM fac_cotizacion_item i WHERE i.id_convenio_resuelto = c.id) AS usos
    FROM fac_convenio c
    JOIN cli_empresa_servicio s ON s.id = c.id_empresa_servicio
    JOIN cli_empresa e ON e.id = s.id_empresa
    LEFT JOIN cli_centro ce ON ce.id = c.id_centro`)).map((r) => [r.id, r]));
  const precios = async (id) => new Map((await q(`SELECT id_tecnica, ISNULL(id_tabla_legado,-1) tab, precio_uf FROM fac_convenio_precio WHERE id_convenio=@i`, { i: id })).map((r) => [`${r.id_tecnica}|${r.tab}`, Number(r.precio_uf)]));
  const pares = await q(`SELECT id, id_registro_a a, id_registro_b b, detalle_json FROM revision_duplicado WHERE entidad='FAC_CONVENIO' AND estado='PENDIENTE' ORDER BY id`);
  let n = 0, auto = 0, ejemplo = null;
  for (const p of pares) {
    const A = conv.get(p.a), B = conv.get(p.b); if (!A || !B) continue;
    const pa = await precios(p.a), pb = await precios(p.b);
    let comunes = 0, distintos = 0; for (const [k, v] of pa) if (pb.has(k)) { comunes++; if (Math.abs(pb.get(k) - v) > 0.0005) distintos++; }
    const old = JSON.parse(p.detalle_json);
    const lado = (C, prev) => ({ ...prev, nombre: C.nombre, servicio: C.servicio, empresa: C.empresa, centro: C.centro || '(todo el servicio)', tarifas: C.tarifas, usos: C.usos, habilitado: !!C.habilitado, fichas: 0 });
    const nuevo = { a: lado(A, old.a), b: lado(B, old.b), comparacion: { en_comun: comunes, precio_distinto: distintos, solo_a: pa.size - comunes, solo_b: pb.size - comunes } };
    ejemplo ||= nuevo;
    // Sin técnica+tabla en común no hay nada que arbitrar: son convenios complementarios del mismo cliente/centro.
    // Se marcan MANTENER_SEPARADO (sin usuario: automático, con la evidencia en el detalle) y quedan visibles en "Separados".
    const complementario = comunes === 0 && A.tarifas + B.tarifas > 0; if (complementario) auto++;
    if (APPLY) await q(`UPDATE revision_duplicado SET detalle_json=@j${complementario ? ", estado='MANTENER_SEPARADO', revisado_en=SYSDATETIME(), observacion=@o" : ''} WHERE id=@id`,
      { j: JSON.stringify(nuevo), id: p.id, ...(complementario ? { o: 'Automático: los dos convenios no tienen ninguna técnica+tabla en común (complementarios); no hay precios que arbitrar.' } : {}) });
    n++;
  }
  console.log(`${n} pares ${APPLY ? 'actualizados' : 'analizados (usa --apply para guardar)'}; ${auto} complementarios ${APPLY ? 'marcados como separados' : 'se marcarían como separados'}`); if (ejemplo) console.log(JSON.stringify(ejemplo, null, 1));
} finally { await dst.close(); }
