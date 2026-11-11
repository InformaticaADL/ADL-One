/**
 * Otras ventas, notas de crédito y notas de débito (Facturación Salud), réplica de ADLSOFT:
 *   - fac_otrasventas_v2.scx                      → crear y mantener documentos de la tabla `facturacion_otro`
 *   - fac_electronica_exportatxt_afecta_otro_v2 / _exenta / _nc / _nd → archivos planos de cada tipo
 *   - fac_otroscobros.scx / fac_reversa_nc_casos.scx → versión antigua con nota de crédito parcial por casos (NO se replica, ver H-82)
 *
 * Los documentos de otras ventas comparten con las facturas de casos el contador `Mae_id.id_facturacion` y el espacio de números
 * `id_facturacion` (H-77). El N° del documento ante el SII (`numero_documento`) lo teclea la persona después de emitirlo.
 * Las diferencias deliberadas con ADLSOFT están marcadas con "DESVÍO" y documentadas en docs/facturacion-salud-replica-adlsoft.md.
 */
import sql from '../config/databaseSalud.js';
import { roundVfp, comunes, aFilaDte, csvFoxPro, fechaDmy } from './facturacion-salud.exportacion.js';

const N = sql.Numeric(10, 0);
const txt = (v) => String(v ?? '').trim();
const num = (v) => Number(v) || 0;
const FECHA_VACIA = '  /  /    ';

// ---------------------------------------------------------------------------------------------------------------------------
// Tipos de documento
// ---------------------------------------------------------------------------------------------------------------------------

/** Tipos que ofrece la pantalla: 1 factura electrónica, 8 nota de crédito electrónica, 10 nota de débito electrónica, 11 factura exenta. */
export const TIPOS_DOCUMENTO = { 1: 'FE', 8: 'NCE', 10: 'NDE', 11: 'FEE' };
/** Motivo (código de razón) de notas de crédito y débito. */
export const CODIGOS_RAZON = { 1: 'Anula', 2: 'Corrige texto', 3: 'Corrige montos' };
/** Cada archivo plano tiene su propio procedimiento de listado, prefijo de archivo y tipo de documento. */
export const FLUJOS = {
  FEA: { sp: 'fac_consulta_facturaelectronica_exporta_fea', prefijo: 'FE_OTRASVENTAS_', tipoDoc: 1, conOc: true },
  FEE: { sp: 'fac_consulta_facturaelectronica_exporta_fee', prefijo: 'FEE_', tipoDoc: 11, conOc: true },
  NCE: { sp: 'fac_consulta_facturaelectronica_exporta_nc', prefijo: 'NCE_', tipoDoc: 8, conOc: false },
  NDE: { sp: 'fac_consulta_facturaelectronica_exporta_nd', prefijo: 'NDE_', tipoDoc: 10, conOc: false }
};

// ---------------------------------------------------------------------------------------------------------------------------
// Crear documento
// ---------------------------------------------------------------------------------------------------------------------------

/** En pesos: monto en UF por el valor de la UF, sin redondear (así lo guarda ADLSOFT al cambiar la UF o el monto en UF). */
export const montoEnPesos = (monto_uf, uf) => num(monto_uf) * num(uf);

/**
 * Valida lo que valida la pantalla: tipo de documento y monto distintos de cero. Para notas de crédito y débito ADLSOFT toma la empresa
 * de la factura referenciada; para el resto, de la lista de empresas. El código de razón solo existe en notas.
 */
export function validarDocumento(d) {
  const tipo = num(d.id_tipodocumento);
  if (!TIPOS_DOCUMENTO[tipo] || !num(d.monto)) throw new Error('Debes ingresar todos los datos Solicitados.');
  if (!num(d.id_empresaservicio)) throw new Error('Debes elegir la empresa a facturar.');
  const esNota = tipo === 8 || tipo === 10;
  if (esNota && !CODIGOS_RAZON[num(d.cod_razon)]) throw new Error('Debes elegir el motivo de la nota (anula, corrige texto o corrige montos).');
  return { tipo, esNota, codRazon: esNota ? num(d.cod_razon) : 0, tipoImpuesto: txt(d.tipoimpuesto) === 'FEE' ? 'FEE' : 'FEA' };
}

/**
 * Crea un documento. Pasos de ADLSOFT: lee y aumenta en 1 los contadores `Mae_id.id_facturacion` e `id_otroscobros`, inserta en
 * `facturacion_otro` con emitido = 'N', y, si es una nota de crédito que anula (código 1), borra la factura de casos referenciada y
 * devuelve sus líneas a ENVIADO. Después guarda las OC elegidas.
 * Igual que ADLSOFT, la nota que anula borra la factura cuyo ID se encontró en la búsqueda de la referencia, sea de casos o de otra venta
 * (H-77). Única diferencia: la lectura del contador toma un bloqueo para que dos personas no obtengan el mismo número (D-20).
 */
export async function crearDocumento(db, datos) {
  const { tipo, esNota, codRazon, tipoImpuesto } = validarDocumento(datos);
  const contador = ((await db.request().query('SELECT id_facturacion, id_otroscobros FROM dbo.mae_id WITH (UPDLOCK, HOLDLOCK);')).recordset || [])[0];
  if (!contador) throw new Error('No se pudo leer el contador de documentos (Mae_id).');
  const idFacturacion = num(contador.id_facturacion);
  const idOtroCobro = num(contador.id_otroscobros);
  await db.request().query('UPDATE dbo.mae_id SET id_facturacion = id_facturacion + 1, id_otroscobros = id_otroscobros + 1;');

  const concepto = txt(datos.concepto_cobro);
  await db.request()
    .input('oc', N, idOtroCobro).input('idf', N, idFacturacion).input('td', N, tipo).input('fac', N, num(datos.factura))
    .input('emp', N, num(datos.id_empresaservicio)).input('con', sql.VarChar(200), concepto).input('nd', N, num(datos.numero_documento))
    .input('fd', sql.VarChar(10), fechaDmy(datos.fecha_documento) || FECHA_VACIA).input('uf', sql.Numeric(14, 3), num(datos.uf))
    .input('monto', sql.Numeric(14, 3), num(datos.monto)).input('muf', sql.Numeric(14, 3), num(datos.monto_uf)).input('obs', sql.VarChar(200), '')
    .input('cr', N, codRazon).input('tr', sql.VarChar(10), txt(datos.tipo_ref)).input('nr', sql.VarChar(20), txt(datos.num_ref))
    .input('fr', sql.VarChar(10), fechaDmy(datos.fecha_ref) || FECHA_VACIA).input('mot', sql.VarChar(200), concepto)
    .input('nota', sql.VarChar(500), txt(datos.nota)).input('ti', sql.VarChar(3), tipoImpuesto).input('fp', N, num(datos.id_formapago))
    .query(`INSERT dbo.facturacion_otro (id_otroscobros, id_facturacion, id_tipodocumento, factura, id_empresaservicio, concepto_cobro, numero_documento,
              fecha_documento, uf, monto, monto_uf, observacion, cod_razon, tipo_ref, num_ref, fecha_ref, motivo, nota, emitido, tipoimpuesto, id_formapago)
            VALUES (@oc, @idf, @td, @fac, @emp, @con, @nd, @fd, @uf, @monto, @muf, @obs, @cr, @tr, @nr, @fr, @mot, @nota, 'N', @ti, @fp);`);

  let facturaAnulada = null;
  if (tipo === 8 && codRazon === 1 && num(datos.id_facturacion_referencia)) {
    const ref = num(datos.id_facturacion_referencia);
    await db.request().input('id', N, ref).query(`DELETE dbo.facturacion_enc WHERE id_facturacion = @id; DELETE dbo.facturacion_det WHERE id_facturacion = @id;`);
    const l = await db.request().input('id', N, ref)
      .query("UPDATE dbo.muestras_detalle SET id_facturacion = 0, estado = 'ENVIADO', mf = 0 WHERE id_facturacion = @id;");
    facturaAnulada = { id_facturacion: ref, lineasLiberadas: l.rowsAffected?.[0] ?? 0 };
  }

  // OC elegidas al crear: ADLSOFT las guarda sin tipo ni orden (ver H-80)
  for (const o of datos.ordenes_compra || []) {
    if (!txt(o.ocompra)) continue;
    await db.request().input('o', sql.VarChar(50), txt(o.ocompra)).input('f', sql.VarChar(10), fechaDmy(o.fecha) || FECHA_VACIA)
      .input('r', sql.VarChar(50), txt(o.referencia)).input('id', N, idFacturacion)
      .query('INSERT dbo.facturacion_ocompra (ocompra, ocompra_fecha, referencia, id_facturacion) VALUES (@o, @f, @r, @id);');
  }
  return { id_otroscobros: idOtroCobro, id_facturacion: idFacturacion, tipo: TIPOS_DOCUMENTO[tipo], facturaAnulada };
}

/**
 * Busca la factura que referencia una nota (por N° y fecha). Con impuesto afecto (FEA) busca primero entre las facturas de casos y luego
 * entre las otras ventas; con exento (FEE) solo entre las otras ventas. Devuelve null si no existe.
 */
export async function buscarFacturaReferencia(db, { numero, fecha, tipoImpuesto = 'FEA' }) {
  const f = num(numero);
  const fd = fechaDmy(fecha);
  const buscar = async (sp) => ((await db.request().input('f', N, f).input('d', sql.VarChar(10), fd).query(`EXEC dbo.${sp} @xfactura = @f, @xfacturafecha = @d;`)).recordset || [])[0];
  let origen = 'CASOS';
  let fila = txt(tipoImpuesto) === 'FEE' ? null : await buscar('consulta_facturacion_otros_factura');
  if (!fila) { fila = await buscar('consulta_facturacion_otros_factura_otrasventas'); origen = 'OTRAS_VENTAS'; }
  if (!fila) return null;
  return {
    origen, id_facturacion: num(fila.id_facturacion), id_empresaservicio: num(fila.id_empresaservicio), nombre_empresaservicios: txt(fila.nombre_empresaservicios),
    uf: num(fila.uf), peso_totalfac: num(fila.peso_totalfac), uf_totalfac: num(fila.uf_totalfac), tipo_ref: 'FE', num_ref: String(f), fecha_ref: txt(fila.fecha_facturacion)
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Listado y mantención
// ---------------------------------------------------------------------------------------------------------------------------

export async function listarDocumentos(db, { estado = 'NO emitidos' } = {}) {
  const filas = ((await db.request().query('EXEC dbo.consulta_facturacion_otros;')).recordset || []);
  if (estado === 'Todos') return filas;
  const quiere = estado === 'Emitidos' ? 'S' : 'N';
  return filas.filter((r) => txt(r.emitido) === quiere);
}

const actualizar = async (db, id_otroscobros, set, params) => {
  const id = num(id_otroscobros);
  if (!id) throw new Error('Debes elegir un documento.');
  const req = db.request().input('id', N, id);
  for (const [n, t, v] of params) req.input(n, t, v);
  const r = await req.query(`UPDATE dbo.facturacion_otro SET ${set} WHERE id_otroscobros = @id;`);
  return { actualizados: r.rowsAffected?.[0] ?? 0 };
};

/** Asigna el N° que el SII entregó al documento (obligatorio, distinto de cero). */
export async function asignarNumeroDocumento(db, { id_otroscobros, numero_documento }) {
  if (!num(numero_documento)) throw new Error('Debes ingresar N° del Documento.');
  return actualizar(db, id_otroscobros, 'numero_documento = @n', [['n', N, num(numero_documento)]]);
}

export const grabarNotaDocumento = (db, { id_otroscobros, nota }) => actualizar(db, id_otroscobros, 'nota = @n', [['n', sql.VarChar(500), txt(nota)]]);

export async function cambiarFechaDocumento(db, { id_otroscobros, fecha }) {
  const f = fechaDmy(fecha);
  if (!f) throw new Error('Debes ingresar Fecha Facturación');
  return actualizar(db, id_otroscobros, 'fecha_documento = @f', [['f', sql.VarChar(10), f]]);
}

export async function cambiarGlosaDocumento(db, { id_otroscobros, concepto }) {
  if (!txt(concepto)) throw new Error('Debes ingresar la Glosa');
  return actualizar(db, id_otroscobros, 'concepto_cobro = @c', [['c', sql.VarChar(200), txt(concepto)]]);
}

/** Cambia el valor de la UF y recalcula el monto en pesos con el monto en UF que tenía el documento (que debe leerse al momento). */
export async function cambiarUfDocumento(db, { id_otroscobros, uf }) {
  if (!(num(uf) > 0)) throw new Error('Debes ingresar Valor UF');
  const doc = ((await db.request().input('id', N, num(id_otroscobros)).query('SELECT monto_uf FROM dbo.facturacion_otro WHERE id_otroscobros = @id;')).recordset || [])[0];
  if (!doc) throw new Error('Debes elegir un documento.');
  return actualizar(db, id_otroscobros, 'uf = @uf, monto = @monto', [['uf', sql.Numeric(14, 3), num(uf)], ['monto', sql.Numeric(14, 3), montoEnPesos(doc.monto_uf, uf)]]);
}

/** Cambia el monto en UF y recalcula el monto en pesos con la UF que tenía el documento. */
export async function cambiarMontoUfDocumento(db, { id_otroscobros, monto_uf }) {
  if (!(num(monto_uf) > 0)) throw new Error('Debes ingresar Monto UF');
  const doc = ((await db.request().input('id', N, num(id_otroscobros)).query('SELECT uf FROM dbo.facturacion_otro WHERE id_otroscobros = @id;')).recordset || [])[0];
  if (!doc) throw new Error('Debes elegir un documento.');
  return actualizar(db, id_otroscobros, 'monto_uf = @m, monto = @monto', [['m', sql.Numeric(14, 3), num(monto_uf)], ['monto', sql.Numeric(14, 3), montoEnPesos(monto_uf, doc.uf)]]);
}

// ---------------------------------------------------------------------------------------------------------------------------
// Archivos planos
// ---------------------------------------------------------------------------------------------------------------------------

const montoBase = (doc) => num(doc.monto);

/** Datos que cambian según el flujo: tipo de documento, montos, textos de referencia y qué se escribe en la columna `ocompra`. */
function plantilla(flujo, doc) {
  const m = montoBase(doc);
  const refDoc = { tipo_ref: txt(doc.tipo_ref), num_ref: txt(doc.num_ref), fecha_ref: doc.fecha_ref, cod_razon: num(doc.cod_razon) };
  switch (flujo) {
    case 'FEA': return { n_td: 'FE', ocompra: '', totaldoc: m + m * 0.19, neto: m, refs: { tipo_ref: '', num_ref: '', fecha_ref: '', cod_razon: 0 }, motivo: '' };
    case 'FEE': return { n_td: 'FEE', ocompra: '', totaldoc: m, neto: m, refs: refDoc, motivo: txt(doc.motivo) };
    case 'NCE': {
      const afecta = txt(doc.tipoimpuesto) === 'FEA';
      return {
        n_td: 'NCE', ocompra: afecta ? 'AFE' : 'EXE', neto: roundVfp(m, 0), totaldoc: afecta ? roundVfp(m + m * 0.19, 0) : roundVfp(m, 0),
        refs: refDoc, motivo: `${txt(doc.motivo)} . ${txt(doc.observacion)}`
      };
    }
    case 'NDE': return { n_td: 'NDE', ocompra: 'EXE', neto: m, totaldoc: roundVfp(m, 0), refs: refDoc, motivo: txt(doc.motivo) };
    default: throw new Error(`Flujo desconocido: ${flujo}`);
  }
}

/** Filas del archivo para un documento: una principal y, en facturas (FEA y FEE), una por cada OC / HES. */
export function filasDteDocumento(flujo, doc, ordenesCompra = []) {
  const p = plantilla(flujo, doc);
  const base = { ...comunes(doc), prefactura: doc.id_facturacion, n_td: p.n_td, ffac: doc.fecha_documento, id_formapago: doc.id_formapago };
  const filas = [aFilaDte({
    ...base, ocompra: p.ocompra, totaldoc: p.totaldoc, cantidad: 1, claseserv: 'OTRAS VENTAS', tiposerv: 'ADL', detalle: txt(doc.concepto_cobro), neto: p.neto,
    oficargo: 'Casa Matriz', proyecto: 'Laboratorio', ...p.refs, motivo: p.motivo
  })];
  if (FLUJOS[flujo].conOc) {
    for (const o of ordenesCompra || []) {
      filas.push(aFilaDte({
        ...base, ocompra: '', totaldoc: p.totaldoc, cantidad: 0, claseserv: '', tiposerv: '', detalle: '', neto: 0, oficargo: '', proyecto: '',
        tipo_ref: flujo === 'FEE' ? 'OC' : txt(o.tipo), num_ref: txt(o.ocompra), fecha_ref: o.ocompra_fecha, cod_razon: 0, motivo: txt(o.referencia)
      }));
    }
  }
  return filas;
}

export const nombreArchivoOtros = (flujo, ids) => `${FLUJOS[flujo].prefijo}${ids.map((i) => String(num(i))).join('_')}.TXT`;

export async function listarParaExportar(db, { flujo, estado = 'NO emitidos' }) {
  if (!FLUJOS[flujo]) throw new Error(`Flujo desconocido: ${flujo}`);
  const filas = (await db.request().query(`EXEC dbo.${FLUJOS[flujo].sp};`)).recordset || [];
  if (estado === 'Todos') return filas;
  return filas.filter((r) => (estado === 'Emitidos') === (txt(r.emitido) === 'S'));
}

/**
 * Arma el archivo del flujo para los documentos elegidos y los marca como emitidos (por ID de facturación). Como en ADLSOFT no se
 * valida que ya estuvieran emitidos. El listado de ADLSOFT incluye además cualquier fila sin N° de factura de cualquier tipo (H-79); aquí
 * solo se admiten documentos del tipo del flujo.
 */
export async function exportarDocumentos(db, { flujo, ids_facturacion }) {
  if (!FLUJOS[flujo]) throw new Error(`Flujo desconocido: ${flujo}`);
  const pedidas = [...new Set((ids_facturacion || []).map(num).filter(Boolean))];
  if (!pedidas.length) throw new Error('Debe seleccionar al menos un documento.');
  const lista = (await db.request().query(`EXEC dbo.${FLUJOS[flujo].sp};`)).recordset || [];
  const docs = [];
  const vistos = new Set();
  for (const r of lista) {
    const id = num(r.id_facturacion);
    if (pedidas.includes(id) && !vistos.has(id) && num(r.id_tipodocumento) === FLUJOS[flujo].tipoDoc) { vistos.add(id); docs.push(r); }
  }
  const faltan = pedidas.filter((id) => !vistos.has(id));
  if (faltan.length) throw new Error(`Los documentos ${faltan.join(', ')} no están disponibles para este archivo.`);

  const filas = [];
  for (const doc of docs) {
    let oc = [];
    if (FLUJOS[flujo].conOc) {
      oc = (await db.request().input('id', N, num(doc.id_facturacion)).query('EXEC dbo.consulta_facturacion_ocompra @xid_facturacion = @id;')).recordset || [];
    }
    filas.push(...filasDteDocumento(flujo, doc, oc));
    await db.request().input('id', N, num(doc.id_facturacion)).query("UPDATE dbo.facturacion_otro SET emitido = 'S' WHERE id_facturacion = @id;");
  }
  const ids = docs.map((d) => num(d.id_facturacion));
  return { flujo, nombreArchivo: nombreArchivoOtros(flujo, ids), contenido: csvFoxPro(filas), documentos: ids.length, filas: filas.length, ids };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Nota de crédito parcial por casos (pantallas fac_otroscobros y fac_reversa_nc_casos)
// ---------------------------------------------------------------------------------------------------------------------------

/** Casos de una factura con su total en UF (para elegir cuáles devuelve la nota de crédito). */
export async function listarCasosDeFactura(db, { id_facturacion }) {
  const filas = (await db.request().input('id', N, num(id_facturacion)).query('EXEC dbo.fac_reversa_casos_factura @xid_facturacion = @id;')).recordset || [];
  return filas.map((f) => ({ ...f, uf_totalfac: num(f.uf_totalfac) }));
}

/**
 * Nota de crédito que devuelve solo algunos casos de una factura. Pasos de ADLSOFT (versión antigua de la pantalla): marca las líneas de
 * los casos elegidos (\`marcareversa = 'S'\`); crea la nota por la suma de sus totales en UF; guarda una copia de todas las líneas de la
 * factura en las columnas \`*nc\`; y libera las marcadas (sin factura, ENVIADO, UF 0, sin marca) para que se puedan volver a facturar.
 * La factura original no se modifica: sigue con sus totales y su detalle (H-85).
 * DESVÍO: la nota recibe su propio ID (ADLSOFT le ponía el de la factura, y por eso hay un ID repetido entre facturas y otras ventas).
 * Solo admite corrección de texto o de montos (códigos 2 y 3); anular entera es la nota de crédito común.
 */
export async function crearNotaCreditoPorCasos(db, datos) {
  const idRef = num(datos.id_facturacion_referencia);
  const casos = await listarCasosDeFactura(db, { id_facturacion: idRef });
  if (!casos.length) throw new Error('No existen datos para esa Factura.');
  const elegidos = casos.filter((c) => (datos.ids_caso || []).map(num).includes(num(c.id_caso)));
  if (!elegidos.length) throw new Error('Debe seleccionar por lo menos un Caso.');
  const totalUf = roundVfp(elegidos.reduce((a, c) => a + num(c.uf_totalfac), 0), 3);
  if (!(totalUf > 0)) throw new Error('Debe seleccionar por lo menos un Caso.');
  const codRazon = num(datos.cod_razon) || 3;
  if (codRazon === 1) throw new Error('Para anular la factura completa use la nota de crédito común.');

  const enc = ((await db.request().input('id', N, idRef).query('SELECT factura, id_empresaservicio, uf, fecha_facturacion FROM dbo.facturacion_enc WHERE id_facturacion = @id;')).recordset || [])[0];
  if (!enc) throw new Error('No existen datos para esa Factura.');
  const uf = num(datos.uf) || num(enc.uf);
  if (!(uf > 0)) throw new Error('Debes ingresar Valor UF');

  for (const c of elegidos) {
    await db.request().input('c', N, num(c.id_caso)).input('id', N, idRef)
      .query("UPDATE dbo.muestras_detalle SET marcareversa = 'S' WHERE id_caso = @c AND id_facturacion = @id;");
  }
  const documento = await crearDocumento(db, {
    ...datos, id_tipodocumento: 8, cod_razon: codRazon, id_empresaservicio: num(enc.id_empresaservicio), factura: num(enc.factura), uf,
    monto_uf: totalUf, monto: montoEnPesos(totalUf, uf), tipo_ref: 'FE', num_ref: String(num(enc.factura)), fecha_ref: txt(enc.fecha_facturacion),
    id_facturacion_referencia: 0, origen_referencia: ''
  });
  await db.request().input('id', N, idRef).query(`UPDATE dbo.muestras_detalle SET id_facturacionnc = id_facturacion, n_analisisnc = n_analisis,
    vtaunitarionc = vtaunitario, vtatotalnc = vtatotal, ufnc = uf WHERE id_facturacion = @id;`);
  const l = await db.request().input('id', N, idRef)
    .query("UPDATE dbo.muestras_detalle SET marcareversa = '', estado = 'ENVIADO', id_facturacion = 0, uf = 0 WHERE id_facturacion = @id AND marcareversa = 'S';");
  return { documento, totalUf, casos: elegidos.map((c) => num(c.id_caso)), lineasLiberadas: l.rowsAffected?.[0] ?? 0 };
}
