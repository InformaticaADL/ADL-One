/* =====================================================================
   Migración de fac_ (DOCUMENTOS): legado (PruebasInformatica) → esquema v5
   =====================================================================
   Uso:
     node src/scripts/migracion-fac-docs.mjs                 → ensayo: carga y hace ROLLBACK
     node src/scripts/migracion-fac-docs.mjs --apply         → carga y confirma (COMMIT)
     node src/scripts/migracion-fac-docs.mjs --apply --reset → borra los documentos fac_ previos y recarga
     node src/scripts/migracion-fac-docs.mjs --solo-reset --reset --apply → solo vacía (antes de recargar fic_)

   Requiere: parche 9_patch_fac_docs.sql; geo_, cat_, cli_, fac_ (precios) y las visitas (fic_)
   ya cargadas (prefactura_caso apunta a fic_visita por id_agendamam_legacy).
   SEGURIDAD: del legado solo lee; solo escribe en una base cuyo nombre contenga "TEST";
   una transacción; sin --apply termina en ROLLBACK.

   REGLAS
     - Se CONSERVAN los ids del legado (IDENTITY_INSERT): los documentos se citan entre sí.
     - fac_cliente_config: sus requiere_oc / requiere_hes / email_facturacion / forma_pago_default
       se copian a cli_empresa_servicio (la configuración de facturación manda sobre el maestro).
     - prefactura_caso: id_agendamam → fic_visita.id_agendamam_legacy; sin visita no se carga.
     - Las secuencias fac_seq_prefactura / fac_seq_cotizacion se reinician en max(numero)+1.
   ===================================================================== */
import dotenv from 'dotenv'; dotenv.config();
import sql from 'mssql';

const APPLY = process.argv.includes('--apply');
const RESET = process.argv.includes('--reset');
const TEST_DB = process.env.MIG_TEST_DB || 'ADL ONE TEST';
if (!/TEST/i.test(TEST_DB)) { console.error(`ABORTADO: la base destino "${TEST_DB}" no contiene "TEST".`); process.exit(1); }

const cfg = (database) => ({ server: process.env.DB_SERVER, port: 1433, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database,
  requestTimeout: 120000, options: { encrypt: true, trustServerCertificate: true } });
const leg = await new sql.ConnectionPool(cfg(process.env.DB_DATABASE)).connect();
const dst = await new sql.ConnectionPool(cfg(TEST_DB)).connect();
const L = async (q) => (await leg.request().query(q)).recordset;
const tx = new sql.Transaction(dst); await tx.begin();
const run = async (text, params = {}) => { const rq = new sql.Request(tx); for (const [k, v] of Object.entries(params)) rq.input(k, v === undefined ? null : v); return (await rq.query(text)).recordset; };
// Inserta conservando el id del legado (IDENTITY_INSERT solo dura este lote).
const insId = async (table, id, obj) => {
  const e = Object.entries({ id, ...obj }).filter(([, v]) => v !== undefined);
  const params = Object.fromEntries(e.map(([, v], i) => [`p${i}`, v]));
  await run(`SET IDENTITY_INSERT ${table} ON; INSERT INTO ${table} (${e.map(([k]) => `[${k}]`).join(',')}) VALUES (${e.map((_, i) => `@p${i}`).join(',')}); SET IDENTITY_INSERT ${table} OFF;`, params);
};
const mapear = (tl, il, tn, inu) => run(`INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES (@a,@b,@c,@d)`, { a: tl, b: il, c: tn, d: inu });
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const t = (s) => norm(s) || null;
const raw = (s) => (s == null || norm(s) === '' ? null : String(s));   // conserva saltos de línea (JSON, textos largos)
const num = (v) => { if (v == null || norm(v) === '') return null; const n = Number(norm(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const yes = (v) => v === true || v === 1 || /^(S|SI|1|TRUE)$/i.test(norm(v));
const dt = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) && d.getUTCFullYear() > 1900 ? d : null);
const warns = new Map(); const warn = (k, ej) => { const w = warns.get(k) || { n: 0, ej: [] }; w.n++; if (w.ej.length < 4 && ej != null) w.ej.push(ej); warns.set(k, w); };
const n0 = (v) => num(v) ?? 0;

try {
  if (!(await run(`SELECT OBJECT_ID('fac_cotizacion') AS o`))[0].o) throw new Error('Falta el parche 9_patch_fac_docs.sql (tabla fac_cotizacion). Ejecútalo en SSMS sobre la base de prueba.');
  const ORDEN = ['fac_oc_candidato', 'fac_emision', 'fac_orden_compra', 'fac_prefactura_caso', 'fac_prefactura', 'fac_lote_emision', 'fac_historial',
    'fac_cotizacion_portal_solicitud', 'fac_cotizacion_item', 'fac_cotizacion_seccion', 'fac_cotizacion', 'fac_cliente_config', 'fac_valor_uf'];
  let previo = 0; for (const tb of ORDEN) previo += (await run(`SELECT COUNT(*) n FROM ${tb}`))[0].n;
  if (previo > 0 && !RESET) throw new Error('Las tablas de documentos fac_ ya tienen datos. Usa --reset para borrarlas y recargar.');
  if (RESET) {
    await run(`UPDATE fic_ficha SET id_cotizacion = NULL WHERE id_cotizacion IS NOT NULL`);
    await run(`DELETE FROM mig_id_map WHERE tabla_nueva IN (${ORDEN.map((x) => `'${x}'`).join(',')})`);
    for (const tb of ORDEN) await run(`DELETE FROM ${tb}`);
  }
  if (process.argv.includes('--solo-reset')) { // vacía los documentos y termina (necesario antes de recargar fic_: los casos apuntan a las visitas)
    if (!APPLY) { console.log('Ensayo de --solo-reset: se revierte. Agrega --apply para confirmar.'); await tx.rollback(); } else { await tx.commit(); console.log('Documentos fac_ vaciados en', TEST_DB); }
    await leg.close(); await dst.close(); process.exit(0);
  }
  const desdeMapa = async (tl) => new Map((await run(`SELECT id_legado, id_nuevo FROM mig_id_map WHERE tabla_legado=@t`, { t: tl })).map((r) => [Number(r.id_legado), r.id_nuevo]));
  const SRV = await desdeMapa('mae_empresaservicios'), EMP = await desdeMapa('mae_empresa'), CEN = await desdeMapa('mae_centro'), TEC = await desdeMapa('mae_tecnica');
  const NOR = await desdeMapa('mae_Normativa'), NREF = await desdeMapa('mae_NormativaReferencia'), RAN = await desdeMapa('App_Ma_ReferenciaAnalisis'), CONV = await desdeMapa('fac_convenio');
  const AGO = await desdeMapa('mae_tipoagua');
  if (!SRV.size) throw new Error('cli_ no está migrado (mig_id_map sin mae_empresaservicios).');
  const visitas = new Map((await run(`SELECT id, id_agendamam_legacy FROM fic_visita WHERE id_agendamam_legacy IS NOT NULL`)).map((r) => [Number(r.id_agendamam_legacy), r.id]));
  let tablas = new Map(); try { tablas = new Map((await L(`SELECT id_tablama, nombre_tablama FROM LaboratorioADL.dbo.mae_tablama`)).map((r) => [Number(r.id_tablama), t(r.nombre_tablama)])); } catch { warn('sin acceso a mae_tablama: los ítems quedan solo con el id de tabla'); }
  const cuentas = {};
  const cargar = (tabla, n) => { cuentas[tabla] = (cuentas[tabla] || 0) + n; };

  /* ---------- UF ---------- */
  for (const r of await L(`SELECT * FROM fac_valor_uf ORDER BY id_uf`)) { await insId('fac_valor_uf', Number(r.id_uf), { fecha: r.fecha, valor: num(r.valor), fuente: t(r.fuente) || 'MANUAL', creado_por_id: num(r.id_usuario) ?? undefined, creado_en: dt(r.fecha_registro) ?? undefined }); await mapear('fac_valor_uf', Number(r.id_uf), 'fac_valor_uf', Number(r.id_uf)); cargar('fac_valor_uf', 1); }

  /* ---------- Configuración por cliente (+ copia de los 4 campos al maestro) ---------- */
  for (const r of await L(`SELECT * FROM fac_cliente_config ORDER BY id_config`)) {
    const s = SRV.get(Number(r.id_empresaservicio)); if (!s) { warn('cliente_config sin servicio en cli_ (no se carga)', r.id_empresaservicio); continue; }
    await insId('fac_cliente_config', Number(r.id_config), { id_empresa_servicio: s, dias_alerta_oc: num(r.dias_alerta_oc) ?? undefined, rut: t(r.rut)?.slice(0, 12), razon_social: t(r.razon_social), direccion: t(r.direccion), giro: t(r.giro),
      id_cli_ventas: num(r.id_cli_ventas) ?? undefined, id_dir_ventas: num(r.id_dir_ventas) ?? undefined, id_gir_ventas: num(r.id_gir_ventas) ?? undefined, id_ciu_ventas: num(r.id_ciu_ventas) ?? undefined, nom_ciu_ventas: t(r.nom_ciu_ventas),
      id_com_ventas: num(r.id_com_ventas) ?? undefined, nom_com_ventas: t(r.nom_com_ventas), id_formapago_ventas: num(r.id_formapago_ventas) ?? undefined, portal_cliente_codigo: t(r.portal_cliente_codigo), portal_sede_codigo: t(r.portal_sede_codigo),
      habilitado: yes(r.habilitado), creado_por_id: num(r.id_usuario) ?? undefined, creado_en: dt(r.fecha_creacion) ?? undefined, modificado_en: dt(r.fecha_modificacion) ?? undefined });
    await run(`UPDATE cli_empresa_servicio SET requiere_oc=@oc, requiere_hes=@hes, email_facturacion=COALESCE(@em, email_facturacion), forma_pago_default=COALESCE(@fp, forma_pago_default) WHERE id=@id`,
      { oc: yes(r.requiere_oc), hes: yes(r.requiere_hes), em: t(r.email_facturacion), fp: t(r.forma_pago_default)?.slice(0, 50), id: s });
    await mapear('fac_cliente_config', Number(r.id_config), 'fac_cliente_config', Number(r.id_config)); cargar('fac_cliente_config', 1);
  }

  /* ---------- Cotizaciones ---------- */
  const cotOk = new Set();
  for (const r of await L(`SELECT * FROM fac_cotizacion ORDER BY id_cotizacion`)) {
    const s = SRV.get(Number(r.id_empresaservicio)); if (!s) { warn('cotización sin servicio en cli_ (no se carga, tampoco sus ítems)', `${r.id_cotizacion}: srv ${r.id_empresaservicio}`); continue; }
    const cen = Number(r.id_centro) > 0 ? CEN.get(Number(r.id_centro)) : null; if (Number(r.id_centro) > 0 && !cen) warn('cotización con centro inexistente (queda sin centro)', `${r.id_cotizacion}: ${r.id_centro}`);
    await insId('fac_cotizacion', Number(r.id_cotizacion), { numero: Number(r.numero_cotizacion), id_empresa_servicio: s, id_empresa: EMP.get(Number(r.id_empresa)) ?? undefined, id_centro: cen ?? undefined, glosa: t(r.glosa), observaciones: t(r.observaciones),
      valor_uf: n0(r.valor_uf), subtotal_uf: n0(r.subtotal_uf), total_uf: n0(r.total_uf), neto_clp: n0(r.neto_clp), iva_clp: n0(r.iva_clp), total_clp: n0(r.total_clp), estado: t(r.estado) || 'BORRADOR', vigente_hasta: dt(r.fecha_vigencia) ?? undefined,
      referencia_externa_portal: t(r.referencia_externa_portal) ?? undefined, portal_publicado: yes(r.portal_publicado), portal_publicado_en: dt(r.fecha_portal_publicado) ?? undefined, convertida_a_ficha_en: dt(r.fecha_convertida_ficha) ?? undefined,
      creado_por_id: num(r.id_usuario) ?? undefined, creado_en: dt(r.fecha_creacion) ?? undefined, modificado_en: dt(r.fecha_modificacion) ?? undefined });
    cotOk.add(Number(r.id_cotizacion)); await mapear('fac_cotizacion', Number(r.id_cotizacion), 'fac_cotizacion', Number(r.id_cotizacion)); cargar('fac_cotizacion', 1);
  }
  for (const r of await L(`SELECT * FROM fac_cotizacion_seccion ORDER BY id_seccion`)) {
    if (!cotOk.has(Number(r.id_cotizacion))) { warn('sección de cotización no cargada', r.id_seccion); continue; }
    await insId('fac_cotizacion_seccion', Number(r.id_seccion), { id_cotizacion: Number(r.id_cotizacion), orden: Number(r.orden), titulo: t(r.titulo) || '(sin título)', subtotal_uf: n0(r.subtotal_uf) }); cargar('fac_cotizacion_seccion', 1);
  }
  for (const r of await L(`SELECT * FROM fac_cotizacion_item ORDER BY id_item`)) {
    if (!cotOk.has(Number(r.id_cotizacion))) { warn('ítem de cotización no cargado', r.id_item); continue; }
    const tec = Number(r.id_tecnica) > 0 ? TEC.get(Number(r.id_tecnica)) : null; if (Number(r.id_tecnica) > 0 && !tec) warn('ítem con técnica fuera de cat_ (queda sin técnica; conserva la descripción)', r.id_tecnica);
    const cv = Number(r.id_convenio_resuelto) > 0 ? CONV.get(Number(r.id_convenio_resuelto)) : null; if (Number(r.id_convenio_resuelto) > 0 && !cv) warn('ítem con convenio no cargado (queda sin convenio)', r.id_convenio_resuelto);
    const tab = num(r.id_tablama);
    await insId('fac_cotizacion_item', Number(r.id_item), { id_cotizacion: Number(r.id_cotizacion), id_seccion: num(r.id_seccion) ?? undefined, id_tecnica: tec ?? undefined, id_tabla_legado: tab ?? undefined, nombre_tabla: (tablas.get(tab) || undefined)?.slice(0, 150),
      descripcion: t(r.descripcion), cantidad: Number(r.cantidad), precio_unitario_uf: num(r.precio_unitario_uf) ?? undefined, precio_total_uf: num(r.precio_total_uf) ?? undefined, id_convenio_resuelto: cv ?? undefined, especificidad: num(r.especificidad) ?? undefined,
      id_normativa: NOR.get(Number(r.id_normativa)) ?? undefined, id_normativa_referencia: NREF.get(Number(r.id_normativareferencia)) ?? undefined, id_referencia_analisis: RAN.get(Number(r.id_referenciaanalisis)) ?? undefined, precio_manual: yes(r.precio_manual) }); cargar('fac_cotizacion_item', 1);
  }
  for (const r of await L(`SELECT * FROM fac_cotizacion_portal_solicitud ORDER BY id_solicitud_portal`)) {
    const s = Number(r.id_empresaservicio) > 0 ? SRV.get(Number(r.id_empresaservicio)) : null; if (Number(r.id_empresaservicio) > 0 && !s) warn('solicitud de portal con servicio fuera de cli_ (queda sin servicio)', r.id_empresaservicio);
    const cot = Number(r.id_cotizacion) > 0 && cotOk.has(Number(r.id_cotizacion)) ? Number(r.id_cotizacion) : null;
    await insId('fac_cotizacion_portal_solicitud', Number(r.id_solicitud_portal), { referencia_externa: t(r.referencia_externa), id_empresa_servicio: s ?? undefined, rut_cliente_portal: t(r.rut_cliente_portal), nombre_cliente_portal: t(r.nombre_cliente_portal), titulo: t(r.titulo) || '(sin título)',
      descripcion: raw(r.descripcion), items_json: raw(r.items_json), atendida: yes(r.atendida), id_cotizacion: cot ?? undefined, estado_portal: t(r.estado_portal) || 'ABIERTA', ultimo_mensaje_texto: t(r.ultimo_mensaje_texto), ultimo_mensaje_autor: t(r.ultimo_mensaje_autor),
      ultimo_mensaje_en: dt(r.ultimo_mensaje_fecha) ?? undefined, staff_ultima_vista_en: dt(r.staff_ultima_vista) ?? undefined, solicitante_nombre: t(r.solicitante_nombre), solicitante_email: t(r.solicitante_email), creado_en: dt(r.fecha_creacion) ?? undefined }); cargar('fac_cotizacion_portal_solicitud', 1);
  }

  /* ---------- Lotes, prefacturas, casos, OC, emisiones ---------- */
  for (const r of await L(`SELECT * FROM fac_lote_emision ORDER BY id_lote`)) { await insId('fac_lote_emision', Number(r.id_lote), { nombre_archivo: t(r.nombre_archivo) || '(sin nombre)', tipo_documento: t(r.tipo_documento), archivo_path: t(r.archivo_path), cantidad_prefacturas: Number(r.cantidad_prefacturas), estado: t(r.estado), creado_por_id: num(r.id_usuario) ?? undefined, creado_en: dt(r.fecha_creacion) ?? undefined }); cargar('fac_lote_emision', 1); }
  const pfOk = new Set();
  for (const r of await L(`SELECT * FROM fac_prefactura ORDER BY id_prefactura`)) {
    const s = SRV.get(Number(r.id_empresaservicio)); if (!s) { warn('prefactura sin servicio en cli_ (no se carga, tampoco sus casos/OC/emisiones)', `${r.id_prefactura}: srv ${r.id_empresaservicio}`); continue; }
    await insId('fac_prefactura', Number(r.id_prefactura), { numero: Number(r.numero_id), id_empresa_servicio: s, id_empresa: EMP.get(Number(r.id_empresa)) ?? undefined, agrupacion_tipo: t(r.agrupacion_tipo), agrupacion_valor: t(r.agrupacion_valor), fecha_facturacion: dt(r.fecha_facturacion) ?? undefined,
      forma_pago: t(r.forma_pago), mes_ano: t(r.mes_ano), glosa: t(r.glosa), glosa_fe: t(r.glosa_fe), observaciones: t(r.observaciones), facturado_por: t(r.facturado_por), valor_uf: n0(r.valor_uf), subtotal_uf: n0(r.subtotal_uf), descuento_uf: n0(r.descuento_uf), ingreso_uf: n0(r.ingreso_uf),
      total_uf: n0(r.total_uf), neto_clp: n0(r.neto_clp), iva_clp: n0(r.iva_clp), total_clp: n0(r.total_clp), estado: t(r.estado), pdf_detalle_path: t(r.pdf_detalle_path), pdf_resumen_path: t(r.pdf_resumen_path), email_enviado: yes(r.email_enviado), email_enviado_en: dt(r.fecha_email) ?? undefined,
      email_message_id: t(r.email_message_id), portal_publicado: yes(r.portal_publicado), portal_publicado_en: dt(r.fecha_portal_publicado) ?? undefined, creado_por_id: num(r.id_usuario) ?? undefined, creado_en: dt(r.fecha_creacion) ?? undefined, modificado_en: dt(r.fecha_modificacion) ?? undefined });
    pfOk.add(Number(r.id_prefactura)); await mapear('fac_prefactura', Number(r.id_prefactura), 'fac_prefactura', Number(r.id_prefactura)); cargar('fac_prefactura', 1);
  }
  for (const r of await L(`SELECT * FROM fac_prefactura_caso ORDER BY id_pf_caso`)) {
    const v = visitas.get(Number(r.id_agendamam)); if (!v) { warn('caso de prefactura sin visita en fic_ (NO se carga; ¿están cargadas las fichas?)', `caso ${r.id_pf_caso}: agenda ${r.id_agendamam}`); continue; }
    if (!pfOk.has(Number(r.id_prefactura))) { warn('caso de prefactura no cargado (su prefactura no se cargó)', r.id_pf_caso); continue; }
    await insId('fac_prefactura_caso', Number(r.id_pf_caso), { id_prefactura: Number(r.id_prefactura), id_visita: v, precio_analisis_uf: n0(r.precio_analisis_uf), costo_operativo_uf: n0(r.costo_operativo_uf), precio_venta_uf: n0(r.precio_venta_uf), precio_venta_clp: n0(r.precio_venta_clp),
      nombre_centro: t(r.nombre_centro), id_tipo_agua: AGO.get(Number(r.id_tipoagua)) ?? undefined, fecha_informe: dt(r.fecha_informe) ?? undefined }); cargar('fac_prefactura_caso', 1);
  }
  const ocOk = new Set();
  for (const r of await L(`SELECT * FROM fac_orden_compra ORDER BY id_oc`)) {
    if (!pfOk.has(Number(r.id_prefactura))) { warn('orden de compra no cargada (su prefactura no se cargó)', r.id_oc); continue; }
    await insId('fac_orden_compra', Number(r.id_oc), { id_prefactura: Number(r.id_prefactura), numero_oc: t(r.numero_oc) || '(sin número)', fecha_oc: dt(r.fecha_oc) ?? undefined, referencia: t(r.referencia), numero_hes: t(r.numero_hes), fecha_hes: dt(r.fecha_hes) ?? undefined, observaciones: t(r.observaciones), creado_por_id: num(r.id_usuario) ?? undefined, creado_en: dt(r.fecha_registro) ?? undefined });
    ocOk.add(Number(r.id_oc)); cargar('fac_orden_compra', 1);
  }
  for (const r of await L(`SELECT * FROM fac_emision ORDER BY id_emision`)) {
    if (!pfOk.has(Number(r.id_prefactura))) { warn('emisión no cargada (su prefactura no se cargó)', r.id_emision); continue; }
    await insId('fac_emision', Number(r.id_emision), { id_prefactura: Number(r.id_prefactura), id_lote: num(r.id_lote) ?? undefined, tipo_documento: t(r.tipo_documento), folio_sii: t(r.folio_sii), fecha_emision: dt(r.fecha_emision) ?? undefined, folio_referencia: t(r.folio_referencia),
      monto_neto: num(r.monto_neto) ?? undefined, iva: num(r.iva) ?? undefined, monto_total: num(r.monto_total) ?? undefined, estado: t(r.estado), pagada: yes(r.pagada), fecha_pago: dt(r.fecha_pago) ?? undefined, pagada_por_id: num(r.id_usuario_pago) ?? undefined,
      creado_por_id: num(r.id_usuario) ?? undefined, creado_en: dt(r.fecha_creacion) ?? undefined, modificado_en: dt(r.fecha_modificacion) ?? undefined }); cargar('fac_emision', 1);
  }
  for (const r of await L(`SELECT * FROM fac_oc_candidato ORDER BY id_candidato`)) {
    const s = Number(r.id_empresaservicio) > 0 ? SRV.get(Number(r.id_empresaservicio)) : null;
    await insId('fac_oc_candidato', Number(r.id_candidato), { id_prefactura: pfOk.has(Number(r.id_prefactura)) ? Number(r.id_prefactura) : undefined, id_empresa_servicio: s ?? undefined, origen: t(r.origen), archivo_path: t(r.archivo_path), numero_oc_sugerido: t(r.numero_oc_sugerido),
      fecha_oc_sugerida: dt(r.fecha_oc_sugerida) ?? undefined, numero_hes_sugerido: t(r.numero_hes_sugerido), fecha_hes_sugerida: dt(r.fecha_hes_sugerida) ?? undefined, monto_sugerido: num(r.monto_sugerido) ?? undefined, confianza: t(r.confianza), metodo_extraccion: t(r.metodo_extraccion),
      estado: t(r.estado), id_oc_creada: ocOk.has(Number(r.id_oc_creada)) ? Number(r.id_oc_creada) : undefined, creado_por_id: num(r.id_usuario) ?? undefined, creado_en: dt(r.fecha_creacion) ?? undefined, resuelto_en: dt(r.fecha_resolucion) ?? undefined }); cargar('fac_oc_candidato', 1);
  }
  for (const r of await L(`SELECT * FROM fac_historial ORDER BY id_historial`)) {
    await insId('fac_historial', Number(r.id_historial), { entidad: t(r.entidad), id_entidad: Number(r.id_entidad), accion: t(r.accion), estado_anterior: t(r.estado_anterior), estado_nuevo: t(r.estado_nuevo), descripcion: t(r.descripcion), datos_json: raw(r.datos_json), creado_por_id: num(r.id_usuario) ?? undefined, creado_en: dt(r.fecha) ?? undefined }); cargar('fac_historial', 1);
  }

  /* ---------- Secuencias: continúan tras el máximo cargado ---------- */
  const mp = (await run(`SELECT ISNULL(MAX(numero),0) m FROM fac_prefactura`))[0].m, mc = (await run(`SELECT ISNULL(MAX(numero),0) m FROM fac_cotizacion`))[0].m;
  await run(`ALTER SEQUENCE fac_seq_prefactura RESTART WITH ${Number(mp) + 1}`); await run(`ALTER SEQUENCE fac_seq_cotizacion RESTART WITH ${Number(mc) + 1}`);

  /* ---------- Conciliación ---------- */
  const filas = [['fac_valor_uf', 'fac_valor_uf'], ['fac_cliente_config', 'fac_cliente_config'], ['fac_lote_emision', 'fac_lote_emision'], ['fac_cotizacion', 'fac_cotizacion'], ['fac_cotizacion_seccion', 'fac_cotizacion_seccion'], ['fac_cotizacion_item', 'fac_cotizacion_item'],
    ['fac_cotizacion_portal_solicitud', 'fac_cotizacion_portal_solicitud'], ['fac_prefactura', 'fac_prefactura'], ['fac_prefactura_caso', 'fac_prefactura_caso'], ['fac_orden_compra', 'fac_orden_compra'], ['fac_emision', 'fac_emision'], ['fac_oc_candidato', 'fac_oc_candidato'], ['fac_historial', 'fac_historial']];
  const tabla = []; for (const [l, n] of filas) { const a = (await L(`SELECT COUNT(*) n FROM ${l}`))[0].n, b = (await run(`SELECT COUNT(*) n FROM ${n}`))[0].n; tabla.push({ tabla: n, legado: a, nuevo: b, ok: a === b ? 'OK' : 'DIFIERE' }); }
  console.log(`\n== Conciliación (${APPLY ? 'APLICAR' : 'ENSAYO'} en [${TEST_DB}]) ==`); console.table(tabla);
  const sm = async (lq, dq) => { const a = Number((await L(lq))[0].s ?? 0), b = Number((await run(dq))[0].s ?? 0); return `${a.toFixed(2)} → ${b.toFixed(2)} ${Math.abs(a - b) < 0.01 ? 'OK' : 'DIFIERE'}`; };
  console.log('suma prefactura.total_clp :', await sm('SELECT SUM(total_clp) s FROM fac_prefactura', 'SELECT SUM(total_clp) s FROM fac_prefactura'));
  console.log('suma prefactura.total_uf  :', await sm('SELECT SUM(total_uf) s FROM fac_prefactura', 'SELECT SUM(total_uf) s FROM fac_prefactura'));
  console.log('suma caso.precio_venta_clp:', await sm('SELECT SUM(precio_venta_clp) s FROM fac_prefactura_caso', 'SELECT SUM(precio_venta_clp) s FROM fac_prefactura_caso'));
  console.log('suma cotizacion.total_uf  :', await sm('SELECT SUM(total_uf) s FROM fac_cotizacion', 'SELECT SUM(total_uf) s FROM fac_cotizacion'));
  console.log(`secuencias: prefactura → ${Number(mp) + 1}, cotización → ${Number(mc) + 1}`);
  console.log('\n== Advertencias =='); if (!warns.size) console.log('  (ninguna)'); for (const [k, w] of warns) console.log(`  ${w.n} × ${k}${w.ej.length ? '  ej: ' + w.ej.join(' | ') : ''}`);
  if (APPLY) { await tx.commit(); console.log('\nCOMMIT realizado.'); } else { await tx.rollback(); console.log('\nENSAYO: ROLLBACK (nada se guardó). Usa --apply para confirmar.'); }
} catch (e) { try { await tx.rollback(); } catch { /* cerrada */ } console.error('\nERROR (ROLLBACK):', e.message); process.exitCode = 1; }
finally { await leg.close(); await dst.close(); }
