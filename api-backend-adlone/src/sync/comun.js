// Utilidades compartidas por los manejadores. Los ids del legado se conservan donde el módulo lo hace (IDENTITY_INSERT).
export const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const t = (s) => norm(s) || null;
export const raw = (s) => (s == null || norm(s) === '' ? null : String(s));
export const yes = (v) => v === true || v === 1 || /^(S|SI|1|TRUE)$/i.test(norm(v));
export const dt = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) && d.getUTCFullYear() > 1900 ? d : null);
export const numero = (v) => { if (v == null || norm(v) === '') return null; const n = Number(norm(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
export const soloFecha = (d) => (d instanceof Date && d.getUTCFullYear() > 1900 ? d : null);
export const sinTildes = (s) => norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
// Como yes(), pero con valor por defecto cuando el campo viene vacío (el legado deja muchas banderas en blanco).
export const si = (v, def = false) => { const x = norm(v); return x === '' ? def : /^(S|SI|1|TRUE)$/i.test(x); };
export const placeholder = (s) => norm(s) === '' || /^no\s*(aplica|informado)$/i.test(norm(s));
export const libre = (s, n) => { if (s == null || String(s).trim() === '') return null; const x = String(s); return x.length > n ? x.slice(0, n) : x; };

// INSERT o UPDATE de una fila con id conservado. Las claves con valor `undefined` se omiten (columnas con DEFAULT).
export async function upsertConId(run, tabla, id, obj) {
  const e = Object.entries(obj).filter(([, v]) => v !== undefined);
  const params = Object.fromEntries(e.map(([, v], i) => [`p${i}`, v])); params.id = id;
  const existe = (await run(`SELECT 1 AS x FROM ${tabla} WHERE id=@id`, { id })).length > 0;
  if (existe) { await run(`UPDATE ${tabla} SET ${e.map(([k], i) => `[${k}]=@p${i}`).join(', ')} WHERE id=@id`, params); return 'UPDATE'; }
  await run(`SET IDENTITY_INSERT ${tabla} ON; INSERT INTO ${tabla} ([id], ${e.map(([k]) => `[${k}]`).join(',')}) VALUES (@id, ${e.map((_, i) => `@p${i}`).join(',')}); SET IDENTITY_INSERT ${tabla} OFF;`, params);
  return 'INSERT';
}

// INSERT o UPDATE de una fila con id nuevo (IDENTITY); el id nuevo se busca en mig_id_map. Devuelve el id nuevo.
export async function upsertMapeado(run, { tablaLegado, idLegado, tabla, obj, buscarNatural }) {
  const e = Object.entries(obj).filter(([, v]) => v !== undefined);
  const params = Object.fromEntries(e.map(([, v], i) => [`p${i}`, v]));
  let idNuevo = (await run(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l`, { t: tablaLegado, l: idLegado }))[0]?.id_nuevo;
  if (idNuevo == null && buscarNatural) idNuevo = await buscarNatural();   // fila cargada antes sin mapa: se reconoce por su clave natural
  if (idNuevo != null) { await run(`UPDATE ${tabla} SET ${e.map(([k], i) => `[${k}]=@p${i}`).join(', ')} WHERE id=@id`, { ...params, id: idNuevo }); }
  else idNuevo = (await run(`DECLARE @o TABLE (id INT); INSERT INTO ${tabla} (${e.map(([k]) => `[${k}]`).join(',')}) OUTPUT INSERTED.id INTO @o VALUES (${e.map((_, i) => `@p${i}`).join(',')}); SELECT id FROM @o;`, params))[0].id;
  await run(`IF NOT EXISTS (SELECT 1 FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l) INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES (@t,@l,@n,@i)`, { t: tablaLegado, l: idLegado, n: tabla, i: idNuevo });
  return idNuevo;
}

// INSERT devolviendo el id nuevo (OUTPUT INTO: SQL Server no admite OUTPUT directo en tablas con triggers).
export async function insertar(run, tabla, obj) {
  const e = Object.entries(obj).filter(([, v]) => v !== undefined);
  const params = Object.fromEntries(e.map(([, v], i) => [`p${i}`, v]));
  return (await run(`DECLARE @o TABLE (id INT); INSERT INTO ${tabla} (${e.map(([k]) => `[${k}]`).join(',')}) OUTPUT INSERTED.id INTO @o VALUES (${e.map((_, i) => `@p${i}`).join(',')}); SELECT id FROM @o;`, params))[0].id;
}

export async function actualizar(run, tabla, id, obj) {
  const e = Object.entries(obj).filter(([, v]) => v !== undefined);
  const params = Object.fromEntries(e.map(([, v], i) => [`p${i}`, v])); params.id = id;
  await run(`UPDATE ${tabla} SET ${e.map(([k], i) => `[${k}]=@p${i}`).join(', ')} WHERE id=@id`, params);
}

// Deja en mig_id_map el par (id legado → id nuevo), creándolo o corrigiéndolo.
export async function fijarMapa(run, tablaLegado, idLegado, tabla, idNuevo, nota = null) {
  const p = { t: tablaLegado, l: idLegado, n: tabla, i: idNuevo, o: nota };
  const n = (await run(`UPDATE mig_id_map SET tabla_nueva=@n, id_nuevo=@i, nota=@o WHERE tabla_legado=@t AND id_legado=@l; SELECT @@ROWCOUNT AS n`, p))[0].n;
  if (!n) await run(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo, nota) VALUES (@t,@l,@n,@i,@o)`, p);
}

// Registra el par (id legado → id nuevo) solo si no existe (no pisa un mapa ya fijado, p. ej. una fusión).
export const asegurarMapa = (run, tablaLegado, idLegado, tabla, idNuevo, nota = null) => run(
  `IF NOT EXISTS (SELECT 1 FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l) INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo, nota) VALUES (@t,@l,@n,@i,@o)`,
  { t: tablaLegado, l: idLegado, n: tabla, i: idNuevo, o: nota });

export async function borrarMapeado(run, { tablaLegado, idLegado, tabla }) {
  const idNuevo = (await run(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l`, { t: tablaLegado, l: idLegado }))[0]?.id_nuevo;
  if (idNuevo == null) return false;
  await run(`DELETE FROM ${tabla} WHERE id=@i`, { i: idNuevo }); await run(`DELETE FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l`, { t: tablaLegado, l: idLegado });
  return true;
}
