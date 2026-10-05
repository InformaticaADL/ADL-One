// Mapas de ids y nombres que los manejadores necesitan, cargados una sola vez por pasada.
export async function mapa(ctx, run, tablaLegado) {
  ctx.cache ??= {};
  const k = `m:${tablaLegado}`;
  // id_nuevo > 0: las "sedes" del legado (muestreadores falsos) están en el mapa apuntando a 0 y NO son personas.
  if (!ctx.cache[k]) ctx.cache[k] = new Map((await run(`SELECT id_legado, id_nuevo FROM mig_id_map WHERE tabla_legado=@t AND id_nuevo > 0`, { t: tablaLegado })).map((r) => [Number(r.id_legado), r.id_nuevo]));
  return ctx.cache[k];
}

export async function nombres(ctx, run, tabla) {
  ctx.cache ??= {};
  const k = `n:${tabla}`;
  if (!ctx.cache[k]) ctx.cache[k] = new Map((await run(`SELECT id, nombre FROM ${tabla}`)).map((r) => [r.id, r.nombre]));
  return ctx.cache[k];
}

// Fila del legado por su clave (numérica).
import sql from 'mssql';
export async function filaLegado(leg, tabla, columna, valor) {
  return (await leg.request().input('v', sql.Numeric(18, 0), Number(valor)).query(`SELECT * FROM [${tabla}] WHERE [${columna}] = @v`)).recordset[0];
}
