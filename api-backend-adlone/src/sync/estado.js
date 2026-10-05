// Estado del motor en la base nueva: huellas ya sincronizadas, contadores por tabla y cola de errores.
import sql from 'mssql';

export const ejecutor = (tx) => async (text, params = {}) => {
  const rq = new sql.Request(tx);
  for (const [k, v] of Object.entries(params)) rq.input(k, v === undefined ? null : v);
  return (await rq.query(text)).recordset;
};

export async function cargarHuellas(pool, tabla) {
  const r = await pool.request().input('t', sql.VarChar(80), tabla).query(`SELECT clave, hash1, hash2, filas FROM mig_sync_huella WHERE tabla_legado=@t`);
  return new Map(r.recordset.map((x) => [x.clave, x]));
}

export async function guardarHuella(run, tabla, clave, h) {
  const p = { t: tabla, k: clave, h1: h.h1, h2: h.h2, n: h.n };
  const n = (await run(`UPDATE mig_sync_huella SET hash1=@h1, hash2=@h2, filas=@n, sincronizado_en=SYSDATETIME() WHERE tabla_legado=@t AND clave=@k; SELECT @@ROWCOUNT AS n`, p))[0].n;
  if (!n) await run(`INSERT INTO mig_sync_huella (tabla_legado, clave, hash1, hash2, filas) VALUES (@t,@k,@h1,@h2,@n)`, p);
}

export const borrarHuella = (run, tabla, clave) => run(`DELETE FROM mig_sync_huella WHERE tabla_legado=@t AND clave=@k`, { t: tabla, k: clave });

export async function tablasDeshabilitadas(pool) {
  const r = await pool.request().query(`SELECT tabla_legado FROM mig_sync_estado WHERE habilitado=0`);
  return new Set(r.recordset.map((x) => x.tabla_legado));
}

// Un cambio que falla no detiene la pasada: queda en la cola y se reintenta en la siguiente.
export async function registrarError(pool, tabla, clave, operacion, mensaje) {
  const p = { t: tabla, k: clave, o: operacion, m: String(mensaje).slice(0, 1000) };
  const r = await pool.request().input('t', sql.VarChar(80), p.t).input('k', sql.VarChar(200), p.k).input('o', sql.VarChar(10), p.o).input('m', sql.NVarChar(1000), p.m)
    .query(`UPDATE mig_sync_error SET reintentos=reintentos+1, mensaje=@m, ultimo_intento=SYSDATETIME() WHERE tabla_legado=@t AND clave=@k AND operacion=@o AND resuelto_en IS NULL; SELECT @@ROWCOUNT AS n`);
  if (!r.recordset[0].n) await pool.request().input('t', sql.VarChar(80), p.t).input('k', sql.VarChar(200), p.k).input('o', sql.VarChar(10), p.o).input('m', sql.NVarChar(1000), p.m)
    .query(`INSERT INTO mig_sync_error (tabla_legado, clave, operacion, mensaje) VALUES (@t,@k,@o,@m)`);
}

// Aviso informativo (no es un error y NO se reintenta): p. ej. cambió en el legado una fila que la revisión ya había fusionado.
// Queda abierto en mig_sync_error hasta que alguien lo marque como resuelto.
export async function registrarAviso(pool, tabla, clave, mensaje) {
  const m = `AVISO: ${String(mensaje).slice(0, 990)}`;
  const r = await pool.request().input('t', sql.VarChar(80), tabla).input('k', sql.VarChar(200), clave).input('m', sql.NVarChar(1000), m)
    .query(`UPDATE mig_sync_error SET mensaje=@m, ultimo_intento=SYSDATETIME() WHERE tabla_legado=@t AND clave=@k AND operacion='UPSERT' AND resuelto_en IS NULL AND mensaje LIKE N'AVISO:%'; SELECT @@ROWCOUNT AS n`);
  if (!r.recordset[0].n) await pool.request().input('t', sql.VarChar(80), tabla).input('k', sql.VarChar(200), clave).input('m', sql.NVarChar(1000), m)
    .query(`INSERT INTO mig_sync_error (tabla_legado, clave, operacion, mensaje) VALUES (@t,@k,'UPSERT',@m)`);
}

export const resolverErrores =(pool, tabla, clave) => pool.request().input('t', sql.VarChar(80), tabla).input('k', sql.VarChar(200), clave)
  .query(`UPDATE mig_sync_error SET resuelto_en=SYSDATETIME() WHERE tabla_legado=@t AND clave=@k AND resuelto_en IS NULL`);

export async function actualizarEstado(pool, tabla, c) {
  await pool.request().input('t', sql.VarChar(80), tabla).input('a', sql.Int, c.aplicados).input('b', sql.Int, c.borrados).input('e', sql.Int, c.errores).input('u', sql.NVarChar(500), c.ultimoError ? String(c.ultimoError).slice(0, 500) : null)
    .query(`IF EXISTS (SELECT 1 FROM mig_sync_estado WHERE tabla_legado=@t)
              UPDATE mig_sync_estado SET ultima_pasada=SYSDATETIME(), pasadas=pasadas+1, aplicados=aplicados+@a, borrados=borrados+@b, errores=errores+@e, ultimo_error=COALESCE(@u, ultimo_error) WHERE tabla_legado=@t
            ELSE INSERT INTO mig_sync_estado (tabla_legado, ultima_pasada, pasadas, aplicados, borrados, errores, ultimo_error) VALUES (@t, SYSDATETIME(), 1, @a, @b, @e, @u)`);
}
