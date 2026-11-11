/**
 * Facturación electrónica de los casos (Facturación Salud), réplica de ADLSOFT:
 *   - fac_electronica_modifica_exportatxt_v2.scx → datos previos a exportar (fecha, forma de pago, glosa, mes, nota, OC y HES)
 *   - fac_electronica_exportatxt_v2.scx          → archivo plano de 35 columnas ("FE_CASOS_<ids>.TXT")
 *
 * El archivo plano de ADLSOFT sale de un cursor de Visual FoxPro (`felectronicatxt`) cuyos campos tienen largo fijo: los textos
 * se cortan en silencio y los números (TOTALDOC, NETO…) se guardan SIEMPRE como enteros, redondeando al guardarlos. Eso es parte
 * del formato y se replica aquí (ver `FORMATO_CAMPOS`).
 * Las diferencias deliberadas están marcadas con "DESVÍO" y documentadas en docs/facturacion-salud-replica-adlsoft.md.
 */
import sql from '../config/databaseSalud.js';
import { SQL_LISTADO_FACTURAS_CASOS } from './facturacion-salud.listado-facturas.sql.js';

const N = sql.Numeric(10, 0);
const txt = (v) => String(v ?? '').trim();
const num = (v) => Number(v) || 0;

// ---------------------------------------------------------------------------------------------------------------------------
// Aritmética de Visual FoxPro
// ---------------------------------------------------------------------------------------------------------------------------

/** ROUND de FoxPro: mitad hacia afuera (2,5 → 3; −2,5 → −3). */
export function roundVfp(valor, decimales = 0) {
  const v = Number(valor) || 0;
  const f = 10 ** decimales;
  const abs = Math.abs(v);
  return Math.sign(v) * Math.round(abs * f * (1 + Number.EPSILON)) / f;
}

/**
 * Montos de la fila principal y de las filas de OC/HES de una factura de casos.
 * Con órdenes de compra, la fila principal usa el total en UF redondeado a 2 decimales y pesos enteros; las filas de OC/HES y las
 * facturas sin OC usan el total sin redondear y un decimal. Como el campo es entero, el valor se vuelve a redondear al guardarlo.
 */
export function montosFacturaCasos({ uf_totalfac, uf }, conOc) {
  const total = num(uf_totalfac) * num(uf);
  if (conOc) {
    const base = roundVfp(roundVfp(uf_totalfac, 2) * num(uf), 0);
    return {
      principal: { neto: roundVfp(base, 0), totaldoc: roundVfp(roundVfp(base + base * 0.19, 0), 0) },
      filaOc: { neto: 0, totaldoc: roundVfp(roundVfp(total + total * 0.19, 1), 0) }
    };
  }
  return {
    principal: { neto: roundVfp(roundVfp(total, 1), 0), totaldoc: roundVfp(roundVfp(total + total * 0.19, 1), 0) },
    filaOc: null
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Formato del archivo plano
// ---------------------------------------------------------------------------------------------------------------------------

/** Las 35 columnas, en el orden del COPY TO. `c` = texto con largo máximo, `n` = número entero, `d` = fecha dd/mm/yyyy. */
export const FORMATO_CAMPOS = [
  ['prefactura', 'n'], ['n_td', 'c', 20], ['ffac', 'd'], ['oficina', 'c', 30], ['id_cli', 'n'], ['id_dir', 'n'], ['id_gir', 'n'],
  ['id_formapago', 'n'], ['banco', 'c', 30], ['documento', 'c', 20], ['ocompra', 'c', 20], ['totaldoc', 'n'], ['cantidad', 'n'],
  ['claseserv', 'c', 30], ['tiposerv', 'c', 30], ['detalle', 'c', 150], ['neto', 'n'], ['oficargo', 'c', 30], ['proyecto', 'c', 30],
  ['rut_cli', 'c', 10], ['nom_cli', 'c', 100], ['nom_dir', 'c', 100], ['dir', 'c', 100], ['id_ciu', 'n'], ['ciudad', 'c', 40],
  ['id_com', 'n'], ['nom_com', 'c', 40], ['nom_gir', 'c', 100], ['nom_fp', 'c', 40], ['tipo_ref', 'c', 20], ['num_ref', 'c', 20],
  ['fecha_ref', 'd'], ['cod_razon', 'n'], ['motivo', 'c', 150], ['nota', 'c', 250]
];
export const COLUMNAS_DTE = FORMATO_CAMPOS.map(([nombre]) => nombre);

/** dd/mm/yyyy desde una fecha en texto (dd/mm/yyyy o ISO); '' si no es una fecha. */
export function fechaDmy(v) {
  const s = txt(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${y}`; }
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0, 10);
  return '';
}

/** Una fila normalizada como la dejaría el cursor de FoxPro: textos cortados al largo del campo y números enteros. */
export function aFilaDte(datos) {
  const fila = {};
  for (const [nombre, tipo, largo] of FORMATO_CAMPOS) {
    const v = datos[nombre];
    if (tipo === 'c') fila[nombre] = String(v ?? '').slice(0, largo);
    else if (tipo === 'n') fila[nombre] = roundVfp(num(v), 0);
    else fila[nombre] = fechaDmy(v);
  }
  return fila;
}

/** Datos del cliente y del documento que se repiten en todas las filas de una factura. */
export function comunes(doc) {
  const direccion = txt(doc.direccion_comercial).slice(0, 100);
  return {
    prefactura: doc.id_facturacion, n_td: 'FE', ffac: doc.fecha_facturacion, oficina: 'Casa Matriz', id_cli: doc.id_empresaservicio,
    id_dir: doc.id_direccion, id_gir: doc.id_giro,
    // ADLSOFT envía el código de la forma de pago de la EMPRESA, pero el nombre de la forma de pago de la FACTURA (ver H-44)
    id_formapago: doc.id_formapago,
    banco: 'Banco', documento: 'Documento', ocompra: '', rut_cli: doc.rut_empresaservicios,
    nom_cli: txt(doc.nombre_empresaservicios).slice(0, 100), nom_dir: direccion, dir: direccion, id_ciu: doc.id_ciudad,
    ciudad: txt(doc.nombre_ciudad).slice(0, 40), id_com: doc.id_comunaef, nom_com: txt(doc.nombre_comunaef).slice(0, 40),
    nom_gir: txt(doc.nombre_giro).slice(0, 100), nom_fp: txt(doc.nombre_formapago).slice(0, 30),
    cod_razon: 0, nota: txt(doc.nota) ? `Nota: ${txt(doc.nota)}` : ''
  };
}

/** Filas del archivo para una factura de casos: la principal y, si tiene, una por cada OC / HES. */
export function filasDteFacturaCasos(doc, ordenesCompra = []) {
  const oc = (ordenesCompra || []);
  const montos = montosFacturaCasos(doc, oc.length > 0);
  const filas = [aFilaDte({
    ...comunes(doc), totaldoc: montos.principal.totaldoc, cantidad: 1, claseserv: txt(doc.nombre_anegocio), tiposerv: 'ADL',
    detalle: txt(doc.glosa), neto: montos.principal.neto, oficargo: 'Casa Matriz', proyecto: 'Laboratorio',
    tipo_ref: '', num_ref: '', fecha_ref: '', motivo: ''
  })];
  for (const o of oc) {
    filas.push(aFilaDte({
      ...comunes(doc), totaldoc: montos.filaOc.totaldoc, cantidad: 0, claseserv: '', tiposerv: '', detalle: '', neto: 0, oficargo: '', proyecto: '',
      tipo_ref: txt(o.tipo), num_ref: txt(o.ocompra), fecha_ref: o.ocompra_fecha, motivo: txt(o.referencia)
    }));
  }
  return filas;
}

/**
 * CSV como lo escribe COPY TO … TYPE CSV: encabezado con los nombres, textos entre comillas, números sin formato, fechas dd/mm/yyyy
 * sin comillas y fecha vacía como "/  /". Líneas terminadas en CRLF.
 * DESVÍO: una comilla dentro de un texto se duplica (FoxPro la deja sin proteger y rompe la fila); los saltos de línea se cambian por espacio.
 */
export function csvFoxPro(filas) {
  const celda = (valor, tipo) => {
    if (tipo === 'n') return String(valor);
    if (tipo === 'd') return valor || '/  /';
    return `"${String(valor).replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`;
  };
  const lineas = filas.map((f) => FORMATO_CAMPOS.map(([nombre, tipo]) => celda(f[nombre], tipo)).join(','));
  return [COLUMNAS_DTE.join(','), ...lineas].join('\r\n') + '\r\n';
}

/** El archivo sale en la página de códigos de Windows (ANSI), no en UTF-8. */
export const aBufferAnsi = (texto) => Buffer.from(texto, 'latin1');

export const nombreArchivoCasos = (ids) => `FE_CASOS_${ids.map((i) => String(num(i))).join('_')}.TXT`;

// ---------------------------------------------------------------------------------------------------------------------------
// Listado y exportación
// ---------------------------------------------------------------------------------------------------------------------------

export const ESTADOS_LISTA = ['NO emitidos', 'Emitidos', 'Eliminado', 'Todos'];

const esEmitida = (r) => txt(r.emitido) === 'S';

/** Aplica el filtro de la pantalla ("NO emitidos" por defecto) al resultado de fac_consulta_facturaelectronica_exporta. */
export function filtrarLista(filas, estado = 'NO emitidos') {
  if (estado === 'Emitidos') return filas.filter(esEmitida);
  if (estado === 'Eliminado') return filas.filter((r) => txt(r.eliminado) === 'S');
  if (estado === 'Todos') return filas;
  return filas.filter((r) => !esEmitida(r));
}

/**
 * Misma consulta que fac_consulta_facturaelectronica_exporta, pero con el filtro de estado y de facturas puesto en el WHERE (antes de unir
 * con muestras_detalle). MEJORA M-35: el procedimiento original devuelve las ~5.750 facturas historicas y se filtraba despues en memoria.
 */
export async function consultarListadoFacturasCasos(db, { estado = 'NO emitidos', ids = null } = {}) {
  const cond = [];
  const emi = "ISNULL(RTRIM(dbo.facturacion_enc.emitido), '')";
  if (estado === 'Emitidos') cond.push(emi + " = 'S'");
  else if (estado === 'Eliminado') cond.push("ISNULL(RTRIM(dbo.facturacion_enc.eliminado), '') = 'S'");
  else if (estado !== 'Todos') cond.push(emi + " <> 'S'");
  if (ids) cond.push('dbo.facturacion_enc.id_facturacion IN (' + (ids.map((i) => Math.trunc(num(i))).filter(Boolean).join(',') || '0') + ')');
  const sqlTexto = '-- fac_consulta_facturaelectronica_exporta (con filtro previo)\n' + SQL_LISTADO_FACTURAS_CASOS.replace('{{FILTRO}}', cond.length ? 'WHERE ' + cond.join(' AND ') : '');
  return (await db.request().query(sqlTexto)).recordset || [];
}

export async function listarFacturasParaExportar(db, { estado = 'NO emitidos' } = {}) {
  return filtrarLista(await consultarListadoFacturasCasos(db, { estado }), estado);
}

/**
 * Arma el archivo de las facturas elegidas y las marca como emitidas (`emitido = 'S'`). No valida si ya estaban emitidas: en
 * ADLSOFT la selección es libre. El listado de ADLSOFT puede traer más de una fila por factura (una por área de negocio); aquí cada
 * factura entra una sola vez.
 * DESVÍO: ADLSOFT marca cada factura al armarla, ANTES de guardar el archivo; si se cancela el cuadro "Guardar como", quedan marcadas
 * sin archivo. Aquí el archivo y la marca van juntos y quien llama debería entregar el archivo en la misma respuesta.
 */
export async function exportarFacturasCasos(db, { ids_facturacion }) {
  const pedidas = [...new Set((ids_facturacion || []).map(num).filter(Boolean))];
  if (!pedidas.length) throw new Error('Debe seleccionar al menos una factura.');
  const lista = await consultarListadoFacturasCasos(db, { estado: 'Todos', ids: pedidas });
  const docs = [];
  const vistos = new Set();
  for (const r of lista) {
    const id = num(r.id_facturacion);
    if (pedidas.includes(id) && !vistos.has(id)) { vistos.add(id); docs.push(r); }
  }
  const faltan = pedidas.filter((id) => !vistos.has(id));
  if (faltan.length) throw new Error(`Las facturas ${faltan.join(', ')} no están disponibles para exportar.`);

  const filas = [];
  for (const doc of docs) {
    const oc = (await db.request().input('id', N, num(doc.id_facturacion)).query('EXEC dbo.consulta_facturacion_ocompra @xid_facturacion = @id;')).recordset || [];
    filas.push(...filasDteFacturaCasos(doc, oc));
    await db.request().input('id', N, num(doc.id_facturacion)).query("UPDATE dbo.facturacion_enc SET emitido = 'S' WHERE id_facturacion = @id;");
  }
  const ids = docs.map((d) => num(d.id_facturacion));
  return { nombreArchivo: nombreArchivoCasos(ids), contenido: csvFoxPro(filas), documentos: ids.length, filas: filas.length, ids };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Datos previos a exportar (fac_electronica_modifica_exportatxt_v2)
// ---------------------------------------------------------------------------------------------------------------------------

/** Glosa armada por la pantalla: "<glosa>, <mes>" (con el mes vacío queda "<glosa>, " con coma al final: ver H-48). */
export const glosaConMes = (nombreGlosa, mes) => `${txt(nombreGlosa)}, ${txt(mes)}`;

/** Botón que arma la glosa a partir de glosa + mes (+ observaciones). Solo llena el cuadro; se graba con "Grabar glosa". */
export const armarGlosa = ({ nombreGlosa, mes, observaciones }) =>
  txt(observaciones) ? `${glosaConMes(nombreGlosa, mes)}, ${txt(observaciones)}` : glosaConMes(nombreGlosa, mes);

const idFactura = (id) => {
  const n = num(id);
  if (!n) throw new Error('Debe elegir una factura.');
  return n;
};

const actualizarEnc = (db, id, sentenciaSet, params) => {
  const req = db.request().input('id', N, idFactura(id));
  for (const [nombre, tipo, valor] of params) req.input(nombre, tipo, valor);
  return req.query(`UPDATE dbo.facturacion_enc SET ${sentenciaSet} WHERE id_facturacion = @id;`);
};

export async function grabarFechaFacturacion(db, { id_facturacion, fecha }) {
  const f = fechaDmy(fecha);
  if (!f) throw new Error('Debes ingresar Fecha de Facturación');
  await actualizarEnc(db, id_facturacion, 'fecha_facturacion = @f', [['f', sql.VarChar(10), f]]);
  return { fecha_facturacion: f };
}

export async function grabarFormaPago(db, { id_facturacion, id_formapago }) {
  if (!num(id_formapago)) throw new Error('Debes ingresar la Forma de Pago');
  await actualizarEnc(db, id_facturacion, 'id_formapago = @fp', [['fp', N, num(id_formapago)]]);
}

/** Graba la nota. Para borrarla ADLSOFT no ofrece nada: exige un texto. */
export async function grabarNota(db, { id_facturacion, nota }) {
  if (!txt(nota)) throw new Error('Debes ingresar la Nota');
  await actualizarEnc(db, id_facturacion, 'nota = @nota', [['nota', sql.VarChar(500), txt(nota)]]);
}

/** Graba la glosa escrita a mano. */
export async function grabarGlosaLibre(db, { id_facturacion, glosa }) {
  if (!txt(glosa)) throw new Error('Glosa Factura electrónica vacía.');
  await actualizarEnc(db, id_facturacion, 'glosa = @g', [['g', sql.VarChar(500), txt(glosa)]]);
}

/** Cambia la glosa elegida del maestro y reescribe el texto con el mes que tenga la pantalla. */
export async function grabarGlosaMaestro(db, { id_facturacion, id_glosa, nombreGlosa, mes }) {
  if (!num(id_glosa) || !txt(nombreGlosa)) throw new Error('Debes ingresar la Glosa');
  const glosa = glosaConMes(nombreGlosa, mes);
  await actualizarEnc(db, id_facturacion, 'id_glosa = @ig, glosa = @g', [['ig', N, num(id_glosa)], ['g', sql.VarChar(500), glosa]]);
  return { glosa };
}

/** Cambia el mes/año y reescribe la glosa con la glosa elegida. */
export async function grabarMes(db, { id_facturacion, mes, nombreGlosa }) {
  if (!txt(mes)) throw new Error('Debes ingresar el Mes / Año');
  const glosa = glosaConMes(nombreGlosa, mes);
  await actualizarEnc(db, id_facturacion, 'mes = @m, glosa = @g', [['m', sql.VarChar(20), txt(mes)], ['g', sql.VarChar(500), glosa]]);
  return { glosa };
}

// --- OC y HES libres (facturacion_ocompra) ----------------------------------------------------------------------------------

const FECHA_VACIA = '  /  /    ';
const ORDEN = { OC: 1, HES: 2 };

/**
 * Agrega la OC y/o la HES de una factura. Cada una solo se guarda si trae número; la fecha puede ir vacía (queda como "  /  /    ").
 * No hay control de duplicados ni se rellena la columna `oc`. `referencia` es opcional.
 */
export async function agregarOcHes(db, { id_facturacion, oc, hes }) {
  const id = idFactura(id_facturacion);
  const insertar = async (tipo, d) => {
    await db.request().input('o', sql.VarChar(50), txt(d.ocompra)).input('f', sql.VarChar(10), fechaDmy(d.fecha) || FECHA_VACIA)
      .input('r', sql.VarChar(50), txt(d.referencia)).input('id', N, id).input('t', sql.VarChar(10), tipo).input('ord', N, ORDEN[tipo])
      .query('INSERT dbo.facturacion_ocompra (ocompra, ocompra_fecha, referencia, id_facturacion, tipo, orden) VALUES (@o, @f, @r, @id, @t, @ord);');
  };
  let agregadas = 0;
  if (oc && txt(oc.ocompra)) { await insertar('OC', oc); agregadas++; }
  if (hes && txt(hes.ocompra)) { await insertar('HES', hes); agregadas++; }
  return { agregadas };
}

/** Cambia fecha y referencia de la OC o HES elegida (se identifica por factura, número y tipo). */
export async function modificarOcHes(db, { id_facturacion, ocompra, tipo, fecha, referencia }) {
  if (!ORDEN[tipo]) throw new Error('El tipo debe ser OC o HES.');
  await db.request().input('f', sql.VarChar(10), fechaDmy(fecha) || FECHA_VACIA).input('r', sql.VarChar(50), txt(referencia)).input('ord', N, ORDEN[tipo])
    .input('id', N, idFactura(id_facturacion)).input('o', sql.VarChar(50), txt(ocompra)).input('t', sql.VarChar(10), tipo)
    .query('UPDATE dbo.facturacion_ocompra SET ocompra_fecha = @f, referencia = @r, orden = @ord WHERE id_facturacion = @id AND ocompra = @o AND tipo = @t;');
}

/** Borra por número: si la OC y la HES de la factura tuvieran el mismo número, se borran las dos. */
export async function eliminarOcHes(db, { id_facturacion, ocompra }) {
  const r = await db.request().input('o', sql.VarChar(50), txt(ocompra)).input('id', N, idFactura(id_facturacion))
    .query('DELETE dbo.facturacion_ocompra WHERE ocompra = @o AND id_facturacion = @id;');
  return { eliminadas: r.rowsAffected?.[0] ?? 0 };
}

/** Dónde más se usó este número de OC (el procedimiento solo mira los primeros 12 caracteres). */
export async function buscarOcEnOtrasFacturas(db, { ocompra }) {
  const r = await db.request().input('o', sql.VarChar(12), txt(ocompra).slice(0, 12)).query('EXEC dbo.consulta_ocompra_facturacion_v2 @xocompra = @o;');
  return r.recordset || [];
}

/** OC y HES de una factura o documento, en el orden en que salen en el archivo. */
export async function listarOcHes(db, { id_facturacion }) {
  const r = await db.request().input('id', N, idFactura(id_facturacion)).query('EXEC dbo.consulta_facturacion_ocompra @xid_facturacion = @id;');
  return r.recordset || [];
}
