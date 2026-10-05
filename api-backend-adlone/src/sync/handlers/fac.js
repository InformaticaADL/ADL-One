// Manejadores del módulo fac_ (precios y documentos). Mismas reglas que scripts/migracion-fac.mjs y scripts/migracion-fac-docs.mjs.
//   PRECIOS: convenio (precio ABSOLUTO; id_programama no se migra; sin servicio resoluble no se copia) y sus tarifas, con la "tabla"
//   de LaboratorioADL (id + nombre). Una tarifa cuya técnica no está en cat_ no se copia. Si hay varias tarifas para el mismo
//   (convenio, técnica, tabla) queda el precio de la de id MAYOR (la última), pase lo que pase con las demás.
//   DOCUMENTOS: se conservan los ids del legado (los documentos se citan entre sí). fac_cliente_config manda sobre 4 campos de
//   cli_empresa_servicio (requiere OC/HES, correo de facturación, forma de pago). Las secuencias de numeración se mantienen por encima
//   del máximo copiado.
import sql from 'mssql';
import { norm, t, raw, si, dt, numero, upsertConId, upsertMapeado, borrarMapeado, insertar, fijarMapa } from '../comun.js';
import { mapa, filaLegado } from './contexto.js';

const n0 = (v) => numero(v) ?? 0;
const opt = (v) => { const n = numero(v); return n == null ? null : n; };
const idNuevo = async (run, tablaLegado, idLegado) => (await run(`SELECT id_nuevo FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l`, { t: tablaLegado, l: Number(idLegado) }))[0]?.id_nuevo;
const existe = async (run, tabla, id) => (await run(`SELECT 1 x FROM ${tabla} WHERE id=@i`, { i: Number(id) })).length > 0;
const usuarioId = (v) => (Number(v) > 0 ? Number(v) : null);

// Mantiene la secuencia por encima del máximo copiado (solo la sube).
async function asegurarSecuencia(run, secuencia, tabla) {
  const max = (await run(`SELECT ISNULL(MAX(numero),0) m FROM ${tabla}`))[0].m; const actual = Number((await run(`SELECT CAST(current_value AS BIGINT) c FROM sys.sequences WHERE name=@n`, { n: secuencia }))[0]?.c ?? 0);
  if (Number(max) + 1 > actual) await run(`ALTER SEQUENCE ${secuencia} RESTART WITH ${Number(max) + 1}`);
}

/* ---------- convenios y tarifas ---------- */
let nombresTablaCache = null;   // nombre de cada "tabla" de LaboratorioADL: se lee una vez por proceso
async function nombreTabla(leg, id) {
  if (!nombresTablaCache) { try { nombresTablaCache = new Map((await leg.request().query(`SELECT id_tablama, nombre_tablama FROM LaboratorioADL.dbo.mae_tablama`)).recordset.map((r) => [Number(r.id_tablama), t(r.nombre_tablama)])); } catch { nombresTablaCache = new Map(); } }
  return nombresTablaCache.get(Number(id)) ?? null;
}

const convenio = {
  async upsert({ ctx, run, leg, clave }) {
    const c = await filaLegado(leg, 'fac_convenio', 'id_convenio', clave); if (!c) return 'SIN_FILA'; const idL = Number(c.id_convenio);
    const srv = (await mapa(ctx, run, 'mae_empresaservicios')).get(Number(c.id_empresaservicio));
    if (!srv) return si(c.habilitado) ? `AVISO: convenio HABILITADO ${idL} con servicio ${c.id_empresaservicio} inexistente en cli_: no se copia` : undefined;
    const cenL = Number(c.id_centro); const cen = cenL > 0 ? (await mapa(ctx, run, 'mae_centro')).get(cenL) ?? null : null;   // centro inexistente: aplica a todo el servicio
    await upsertMapeado(run, { tablaLegado: 'fac_convenio', idLegado: idL, tabla: 'fac_convenio',
      obj: { nombre: (t(c.nombre) || `Convenio ${idL}`).slice(0, 150), id_empresa_servicio: srv, id_centro: cen, aplica_sobre: 'absoluto', prioridad: 10, vigencia_desde: c.vigencia_desde instanceof Date ? c.vigencia_desde : null, vigencia_hasta: c.vigencia_hasta instanceof Date ? c.vigencia_hasta : null, habilitado: si(c.habilitado) } });
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'fac_convenio', idLegado: Number(clave), tabla: 'fac_convenio' }),
};

const tarifa = {
  async upsert({ ctx, run, leg, clave }) {
    const f = await filaLegado(leg, 'fac_tarifa', 'id_tarifa', clave); if (!f) return 'SIN_FILA';
    const conv = await idNuevo(run, 'fac_convenio', f.id_convenio); if (!conv) return undefined;   // su convenio no se copió (servicio inexistente): el cargador tampoco
    const tec = (await mapa(ctx, run, 'mae_tecnica')).get(Number(f.id_tecnica)); if (!tec) return undefined;   // técnica fuera de cat_ (Laboratorio)
    const tab = Number(f.id_tablama);
    // varias tarifas para la misma clave: manda la de id mayor
    const ultima = (await leg.request().input('c', sql.Numeric(18, 0), Number(f.id_convenio)).input('t', sql.Numeric(18, 0), Number(f.id_tecnica)).input('b', sql.Numeric(18, 0), tab)
      .query(`SELECT TOP 1 id_tarifa, uf_individual FROM fac_tarifa WHERE id_convenio=@c AND id_tecnica=@t AND id_tablama=@b ORDER BY id_tarifa DESC`)).recordset[0];
    const precio = numero(ultima.uf_individual); if (precio == null) throw new Error(`la tarifa ${ultima.id_tarifa} no tiene precio`);
    const previo = await idNuevo(run, 'fac_tarifa', f.id_tarifa);
    const dup = (await run(`SELECT id FROM fac_convenio_precio WHERE id_convenio=@c AND id_tecnica=@t AND ISNULL(id_tabla_legado,-1)=@b AND id_pack IS NULL`, { c: conv, t: tec, b: tab }))[0]?.id;
    const nombre = (await nombreTabla(leg, tab))?.slice(0, 150) ?? null;
    if (dup && dup !== previo) {   // ya hay una fila para esta clave (otra tarifa del legado): se comparte y queda el precio de la última
      await run(`UPDATE fac_convenio_precio SET precio_uf=@p, nombre_tabla=COALESCE(@n, nombre_tabla) WHERE id=@i`, { p: precio, n: nombre, i: dup }); return;
    }
    await upsertMapeado(run, { tablaLegado: 'fac_tarifa', idLegado: Number(f.id_tarifa), tabla: 'fac_convenio_precio', obj: { id_convenio: conv, id_tecnica: tec, tipo_precio: 'precio_fijo', precio_uf: precio, id_tabla_legado: tab, nombre_tabla: nombre } });
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'fac_tarifa', idLegado: Number(clave), tabla: 'fac_convenio_precio' }),
};

/* ---------- documentos con id conservado ---------- */
// def: { legado, pk, nueva, orden de columnas → obj(r, ctx, run, leg) , dependencias }
const conId = (def) => ({
  async upsert({ ctx, run, leg, clave }) {
    const r = await filaLegado(leg, def.legado, def.pk, clave); if (!r) return 'SIN_FILA'; const id = Number(r[def.pk]);
    const obj = await def.obj(r, { ctx, run, leg, id }); if (typeof obj === 'string') return obj;   // 'AVISO: …' o undefined (no se copia)
    if (!obj) return undefined;
    await upsertConId(run, def.nueva, id, obj);
    if (def.despues) await def.despues({ ctx, run, leg, r, id, obj });
    await run(`IF NOT EXISTS (SELECT 1 FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l) INSERT INTO mig_id_map (tabla_legado, id_legado, tabla_nueva, id_nuevo) VALUES (@t,@l,@n,@i)`, { t: def.legado, l: id, n: def.nueva, i: id });
  },
  async borrar({ run, clave }) { await run(`DELETE FROM ${def.nueva} WHERE id=@i`, { i: Number(clave) }); await run(`DELETE FROM mig_id_map WHERE tabla_legado=@t AND id_legado=@l`, { t: def.legado, l: Number(clave) }); },
});

const srvDe = async (ctx, run, v) => (await mapa(ctx, run, 'mae_empresaservicios')).get(Number(v));
const padre = async (run, tabla, id, etiqueta) => { if (!(await existe(run, tabla, id))) throw new Error(`${etiqueta} ${id} aún no existe en ${tabla}`); };

const DOCS = {
  fac_valor_uf: conId({ legado: 'fac_valor_uf', pk: 'id_uf', nueva: 'fac_valor_uf',
    obj: (r) => ({ fecha: r.fecha, valor: numero(r.valor), fuente: t(r.fuente) || 'MANUAL', creado_por_id: usuarioId(r.id_usuario), creado_en: dt(r.fecha_registro) ?? undefined }) }),

  fac_cliente_config: conId({ legado: 'fac_cliente_config', pk: 'id_config', nueva: 'fac_cliente_config',
    async obj(r, { ctx, run }) { const s = await srvDe(ctx, run, r.id_empresaservicio); if (!s) return undefined;
      return { id_empresa_servicio: s, dias_alerta_oc: opt(r.dias_alerta_oc), rut: t(r.rut)?.slice(0, 12) ?? null, razon_social: t(r.razon_social), direccion: t(r.direccion), giro: t(r.giro), id_cli_ventas: opt(r.id_cli_ventas), id_dir_ventas: opt(r.id_dir_ventas),
        id_gir_ventas: opt(r.id_gir_ventas), id_ciu_ventas: opt(r.id_ciu_ventas), nom_ciu_ventas: t(r.nom_ciu_ventas), id_com_ventas: opt(r.id_com_ventas), nom_com_ventas: t(r.nom_com_ventas), id_formapago_ventas: opt(r.id_formapago_ventas),
        portal_cliente_codigo: t(r.portal_cliente_codigo), portal_sede_codigo: t(r.portal_sede_codigo), habilitado: si(r.habilitado), creado_por_id: usuarioId(r.id_usuario), creado_en: dt(r.fecha_creacion) ?? undefined, modificado_en: dt(r.fecha_modificacion) }; },
    // la configuración de facturación manda sobre el maestro del servicio
    async despues({ ctx, run, r }) { const s = await srvDe(ctx, run, r.id_empresaservicio);
      await run(`UPDATE cli_empresa_servicio SET requiere_oc=@oc, requiere_hes=@hes, email_facturacion=COALESCE(@em, email_facturacion), forma_pago_default=COALESCE(@fp, forma_pago_default) WHERE id=@id`, { oc: si(r.requiere_oc), hes: si(r.requiere_hes), em: t(r.email_facturacion), fp: t(r.forma_pago_default)?.slice(0, 50), id: s }); } }),

  fac_lote_emision: conId({ legado: 'fac_lote_emision', pk: 'id_lote', nueva: 'fac_lote_emision',
    obj: (r) => ({ nombre_archivo: t(r.nombre_archivo) || '(sin nombre)', tipo_documento: t(r.tipo_documento), archivo_path: t(r.archivo_path), cantidad_prefacturas: Number(r.cantidad_prefacturas), estado: t(r.estado), creado_por_id: usuarioId(r.id_usuario), creado_en: dt(r.fecha_creacion) ?? undefined }) }),

  fac_cotizacion: conId({ legado: 'fac_cotizacion', pk: 'id_cotizacion', nueva: 'fac_cotizacion',
    async obj(r, { ctx, run }) { const s = await srvDe(ctx, run, r.id_empresaservicio); if (!s) return `AVISO: cotización ${r.id_cotizacion} con servicio ${r.id_empresaservicio} inexistente en cli_: no se copia`;
      const cen = Number(r.id_centro) > 0 ? (await mapa(ctx, run, 'mae_centro')).get(Number(r.id_centro)) ?? null : null; const emp = (await mapa(ctx, run, 'mae_empresa')).get(Number(r.id_empresa)) ?? null;
      return { numero: Number(r.numero_cotizacion), id_empresa_servicio: s, id_empresa: emp, id_centro: cen, glosa: t(r.glosa), observaciones: t(r.observaciones), valor_uf: n0(r.valor_uf), subtotal_uf: n0(r.subtotal_uf), total_uf: n0(r.total_uf), neto_clp: n0(r.neto_clp), iva_clp: n0(r.iva_clp), total_clp: n0(r.total_clp),
        estado: t(r.estado) || 'BORRADOR', vigente_hasta: dt(r.fecha_vigencia), referencia_externa_portal: t(r.referencia_externa_portal), portal_publicado: si(r.portal_publicado), portal_publicado_en: dt(r.fecha_portal_publicado), convertida_a_ficha_en: dt(r.fecha_convertida_ficha),
        creado_por_id: usuarioId(r.id_usuario), creado_en: dt(r.fecha_creacion) ?? undefined, modificado_en: dt(r.fecha_modificacion) }; },
    despues: ({ run }) => asegurarSecuencia(run, 'fac_seq_cotizacion', 'fac_cotizacion') }),

  fac_cotizacion_seccion: conId({ legado: 'fac_cotizacion_seccion', pk: 'id_seccion', nueva: 'fac_cotizacion_seccion',
    async obj(r, { run }) { await padre(run, 'fac_cotizacion', r.id_cotizacion, 'la cotización'); return { id_cotizacion: Number(r.id_cotizacion), orden: Number(r.orden), titulo: t(r.titulo) || '(sin título)', subtotal_uf: n0(r.subtotal_uf) }; } }),

  fac_cotizacion_item: conId({ legado: 'fac_cotizacion_item', pk: 'id_item', nueva: 'fac_cotizacion_item',
    async obj(r, { ctx, run, leg }) { await padre(run, 'fac_cotizacion', r.id_cotizacion, 'la cotización'); if (Number(r.id_seccion) > 0) await padre(run, 'fac_cotizacion_seccion', r.id_seccion, 'la sección');
      const tec = Number(r.id_tecnica) > 0 ? (await mapa(ctx, run, 'mae_tecnica')).get(Number(r.id_tecnica)) ?? null : null;
      const cv = Number(r.id_convenio_resuelto) > 0 ? await idNuevo(run, 'fac_convenio', r.id_convenio_resuelto) ?? null : null; const tab = numero(r.id_tablama);
      return { id_cotizacion: Number(r.id_cotizacion), id_seccion: opt(r.id_seccion), id_tecnica: tec, id_tabla_legado: tab, nombre_tabla: tab != null ? (await nombreTabla(leg, tab))?.slice(0, 150) ?? null : null, descripcion: t(r.descripcion), cantidad: Number(r.cantidad),
        precio_unitario_uf: opt(r.precio_unitario_uf), precio_total_uf: opt(r.precio_total_uf), id_convenio_resuelto: cv, especificidad: opt(r.especificidad), id_normativa: (await mapa(ctx, run, 'mae_Normativa')).get(Number(r.id_normativa)) ?? null,
        id_normativa_referencia: (await mapa(ctx, run, 'mae_NormativaReferencia')).get(Number(r.id_normativareferencia)) ?? null, id_referencia_analisis: (await mapa(ctx, run, 'App_Ma_ReferenciaAnalisis')).get(Number(r.id_referenciaanalisis)) ?? null, precio_manual: si(r.precio_manual) }; } }),

  fac_cotizacion_portal_solicitud: conId({ legado: 'fac_cotizacion_portal_solicitud', pk: 'id_solicitud_portal', nueva: 'fac_cotizacion_portal_solicitud',
    async obj(r, { ctx, run }) { const s = Number(r.id_empresaservicio) > 0 ? await srvDe(ctx, run, r.id_empresaservicio) ?? null : null; const cot = Number(r.id_cotizacion) > 0 && (await existe(run, 'fac_cotizacion', r.id_cotizacion)) ? Number(r.id_cotizacion) : null;
      return { referencia_externa: t(r.referencia_externa), id_empresa_servicio: s, rut_cliente_portal: t(r.rut_cliente_portal), nombre_cliente_portal: t(r.nombre_cliente_portal), titulo: t(r.titulo) || '(sin título)', descripcion: raw(r.descripcion), items_json: raw(r.items_json), atendida: si(r.atendida),
        id_cotizacion: cot, estado_portal: t(r.estado_portal) || 'ABIERTA', ultimo_mensaje_texto: t(r.ultimo_mensaje_texto), ultimo_mensaje_autor: t(r.ultimo_mensaje_autor), ultimo_mensaje_en: dt(r.ultimo_mensaje_fecha), staff_ultima_vista_en: dt(r.staff_ultima_vista),
        solicitante_nombre: t(r.solicitante_nombre), solicitante_email: t(r.solicitante_email), creado_en: dt(r.fecha_creacion) ?? undefined }; } }),

  fac_prefactura: conId({ legado: 'fac_prefactura', pk: 'id_prefactura', nueva: 'fac_prefactura',
    async obj(r, { ctx, run }) { const s = await srvDe(ctx, run, r.id_empresaservicio); if (!s) return `AVISO: prefactura ${r.id_prefactura} con servicio ${r.id_empresaservicio} inexistente en cli_: no se copia`;
      return { numero: Number(r.numero_id), id_empresa_servicio: s, id_empresa: (await mapa(ctx, run, 'mae_empresa')).get(Number(r.id_empresa)) ?? null, agrupacion_tipo: t(r.agrupacion_tipo), agrupacion_valor: t(r.agrupacion_valor), fecha_facturacion: dt(r.fecha_facturacion), forma_pago: t(r.forma_pago), mes_ano: t(r.mes_ano),
        glosa: t(r.glosa), glosa_fe: t(r.glosa_fe), observaciones: t(r.observaciones), facturado_por: t(r.facturado_por), valor_uf: n0(r.valor_uf), subtotal_uf: n0(r.subtotal_uf), descuento_uf: n0(r.descuento_uf), ingreso_uf: n0(r.ingreso_uf), total_uf: n0(r.total_uf), neto_clp: n0(r.neto_clp), iva_clp: n0(r.iva_clp), total_clp: n0(r.total_clp),
        estado: t(r.estado), pdf_detalle_path: t(r.pdf_detalle_path), pdf_resumen_path: t(r.pdf_resumen_path), email_enviado: si(r.email_enviado), email_enviado_en: dt(r.fecha_email), email_message_id: t(r.email_message_id), portal_publicado: si(r.portal_publicado), portal_publicado_en: dt(r.fecha_portal_publicado),
        creado_por_id: usuarioId(r.id_usuario), creado_en: dt(r.fecha_creacion) ?? undefined, modificado_en: dt(r.fecha_modificacion) }; },
    despues: ({ run }) => asegurarSecuencia(run, 'fac_seq_prefactura', 'fac_prefactura') }),

  fac_prefactura_caso: conId({ legado: 'fac_prefactura_caso', pk: 'id_pf_caso', nueva: 'fac_prefactura_caso',
    async obj(r, { ctx, run }) { await padre(run, 'fac_prefactura', r.id_prefactura, 'la prefactura');
      const v = (await run(`SELECT id FROM fic_visita WHERE id_agendamam_legacy=@a`, { a: Number(r.id_agendamam) }))[0]?.id; if (!v) throw new Error(`la visita de la agenda ${r.id_agendamam} aún no existe en fic_visita`);
      return { id_prefactura: Number(r.id_prefactura), id_visita: v, precio_analisis_uf: n0(r.precio_analisis_uf), costo_operativo_uf: n0(r.costo_operativo_uf), precio_venta_uf: n0(r.precio_venta_uf), precio_venta_clp: n0(r.precio_venta_clp), nombre_centro: t(r.nombre_centro),
        id_tipo_agua: (await mapa(ctx, run, 'mae_tipoagua')).get(Number(r.id_tipoagua)) ?? null, fecha_informe: dt(r.fecha_informe) }; } }),

  fac_orden_compra: conId({ legado: 'fac_orden_compra', pk: 'id_oc', nueva: 'fac_orden_compra',
    async obj(r, { run }) { await padre(run, 'fac_prefactura', r.id_prefactura, 'la prefactura'); return { id_prefactura: Number(r.id_prefactura), numero_oc: t(r.numero_oc) || '(sin número)', fecha_oc: dt(r.fecha_oc), referencia: t(r.referencia), numero_hes: t(r.numero_hes), fecha_hes: dt(r.fecha_hes), observaciones: t(r.observaciones), creado_por_id: usuarioId(r.id_usuario), creado_en: dt(r.fecha_registro) ?? undefined }; } }),

  fac_emision: conId({ legado: 'fac_emision', pk: 'id_emision', nueva: 'fac_emision',
    async obj(r, { run }) { await padre(run, 'fac_prefactura', r.id_prefactura, 'la prefactura'); if (Number(r.id_lote) > 0) await padre(run, 'fac_lote_emision', r.id_lote, 'el lote');
      return { id_prefactura: Number(r.id_prefactura), id_lote: opt(r.id_lote), tipo_documento: t(r.tipo_documento), folio_sii: t(r.folio_sii), fecha_emision: dt(r.fecha_emision), folio_referencia: t(r.folio_referencia), monto_neto: opt(r.monto_neto), iva: opt(r.iva), monto_total: opt(r.monto_total), estado: t(r.estado),
        pagada: si(r.pagada), fecha_pago: dt(r.fecha_pago), pagada_por_id: usuarioId(r.id_usuario_pago), creado_por_id: usuarioId(r.id_usuario), creado_en: dt(r.fecha_creacion) ?? undefined, modificado_en: dt(r.fecha_modificacion) }; } }),

  fac_oc_candidato: conId({ legado: 'fac_oc_candidato', pk: 'id_candidato', nueva: 'fac_oc_candidato',
    async obj(r, { ctx, run }) { const s = Number(r.id_empresaservicio) > 0 ? await srvDe(ctx, run, r.id_empresaservicio) ?? null : null; const pf = Number(r.id_prefactura) > 0 && (await existe(run, 'fac_prefactura', r.id_prefactura)) ? Number(r.id_prefactura) : null;
      const oc = Number(r.id_oc_creada) > 0 && (await existe(run, 'fac_orden_compra', r.id_oc_creada)) ? Number(r.id_oc_creada) : null;
      return { id_prefactura: pf, id_empresa_servicio: s, origen: t(r.origen), archivo_path: t(r.archivo_path), numero_oc_sugerido: t(r.numero_oc_sugerido), fecha_oc_sugerida: dt(r.fecha_oc_sugerida), numero_hes_sugerido: t(r.numero_hes_sugerido), fecha_hes_sugerida: dt(r.fecha_hes_sugerida),
        monto_sugerido: opt(r.monto_sugerido), confianza: t(r.confianza), metodo_extraccion: t(r.metodo_extraccion), estado: t(r.estado), id_oc_creada: oc, creado_por_id: usuarioId(r.id_usuario), creado_en: dt(r.fecha_creacion) ?? undefined, resuelto_en: dt(r.fecha_resolucion) }; } }),

  fac_historial: conId({ legado: 'fac_historial', pk: 'id_historial', nueva: 'fac_historial',
    obj: (r) => ({ entidad: t(r.entidad), id_entidad: Number(r.id_entidad), accion: t(r.accion), estado_anterior: t(r.estado_anterior), estado_nuevo: t(r.estado_nuevo), descripcion: t(r.descripcion), datos_json: raw(r.datos_json), creado_por_id: usuarioId(r.id_usuario), creado_en: dt(r.fecha) ?? undefined }) }),
};

export const manejadores = { fac_convenio: convenio, fac_tarifa: tarifa, ...DOCS };
