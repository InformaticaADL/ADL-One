/**
 * Consulta de una factura y "Graba Factura" (Facturación Salud), réplica de ADLSOFT:
 *   - fac_consulta_una_factura_v4.scx → buscar por ID o por N° de factura, otros ingresos/descuentos, N° de factura y UF, guías,
 *                                      Excel de resumen y detalle
 *   - fac_guiasclientes.scx           → guías de despacho a clientes que se cobran como "otros ingresos"
 *
 * El N° de factura (folio) lo TECLEA la persona en esta pantalla; no viene de ningún sistema (ver H-59).
 * Las guías de despacho están en la base Abastecimiento (tablas gd_enc y gd_det).
 * Las diferencias deliberadas con ADLSOFT están marcadas con "DESVÍO" y documentadas en docs/facturacion-salud-replica-adlsoft.md.
 */
import sql from '../config/databaseSalud.js';
import { roundVfp } from './facturacion-salud.exportacion.js';

const N = sql.Numeric(10, 0);
const txt = (v) => String(v ?? '').trim();
const num = (v) => Number(v) || 0;
const r2 = (v) => roundVfp(v, 2);

/** Empresa a la que ADLSOFT le calcula además el total en dólares (Benchmark Genetics). */
export const ID_EMPRESA_CON_DOLAR = 500;
/** Concepto de "otros ingresos" con que se cobran las guías de despacho. */
export const ID_OTRO_INGRESO_GUIAS = 4;
export const NOMBRE_OTRO_INGRESO_GUIAS = 'Guías de despachos por materiales';

// ---------------------------------------------------------------------------------------------------------------------------
// Presentación de los datos de una factura
// ---------------------------------------------------------------------------------------------------------------------------

/** "Facturado por" y su valor (centro, veterinario, tipo de agua…), tomado de la primera línea del detalle. */
export function describirFacturadoPor(fila) {
  if (!fila) return { facturado_por: '', valor: '' };
  const por = txt(fila.facturado_por);
  const t = (v) => txt(v);
  const valores = {
    Centro: t(fila.centro),
    Veterinario: t(fila.veterinario),
    'Centro - Veterinario': `${t(fila.centro)} - ${t(fila.veterinario)}`,
    'Tipo de Agua': t(fila.tipoagua),
    'Tipo de Agua - Veterinario': `${t(fila.tipoagua)} - ${t(fila.veterinario)}`
  };
  return { facturado_por: por, valor: valores[por] ?? '' };
}

/** Mayúsculas sin tildes (la Ñ se conserva, como en los nombres que escribe el personal: «PACUÑA»). */
const mayusSinTildes = (s) => txt(s).toUpperCase().replace(/Ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'Ñ');

/**
 * Parte final del nombre de los PDF. ADLSOFT propone solo «<mes> ID<id> <sigla> <programa>» en un cuadro editable y el personal le agrega
 * a mano el N° de factura y el centro o el veterinario (H-92). Se automatiza con lo que muestran las muestras reales: si se factura por
 * veterinario, la inicial y el apellido («Pedo Acuña» → PACUÑA); en los demás casos el centro, sin la palabra «Piscicultura»
 * («Piscicultura Río Ignao» → RIO IGNAO, «Chesque Alto» → CHESQUE ALTO).
 */
export function detalleNombreArchivo(fila) {
  if (!fila) return '';
  if (txt(fila.facturado_por) === 'Veterinario') {
    const partes = txt(fila.veterinario).split(/\s+/).filter(Boolean);
    return partes.length > 1 ? mayusSinTildes(partes[0][0] + partes[partes.length - 1]) : mayusSinTildes(partes[0] || '');
  }
  return mayusSinTildes(txt(fila.centro).replace(/^piscicultura\s+/i, ''));
}

/** Nombre sugerido para los PDF: "<3 letras del mes> [FACTURA <folio>] ID<id> <sigla empresa> <sigla programa> <centro o veterinario>". */
export const tituloFactura = (enc, filaDetalle = null) =>
  [txt(enc.mes).slice(0, 3), num(enc.factura) > 0 ? `FACTURA ${num(enc.factura)}` : '', `ID${num(enc.id_facturacion)}`, txt(enc.sigla), txt(enc.sigla_programa), detalleNombreArchivo(filaDetalle)]
    .filter(Boolean).join(' ');

const sumaValores = (lista) => (lista || []).reduce((a, x) => a + num(x.valor), 0);

async function leerFactura(db, enc) {
  const id = num(enc.id_facturacion);
  const lee = async (sp) => (await db.request().input('id', N, id).query(`EXEC dbo.${sp} @xid_facturacion = @id;`)).recordset || [];
  const [ingresos, descuentos, detalle, ordenes] = await Promise.all([
    lee('fac_consulta_una_factura_ing'), lee('fac_consulta_una_factura_des'), lee('fac_excel_detalle'), lee('consulta_facturacion_ocompra')
  ]);
  const usd = num(enc.usd);
  // Datos que ADLSOFT muestra en la pantalla de datos previos a exportar (no vienen en el procedimiento de la ficha)
  const emision = ((await db.request().input('id', N, id).query(
    `SELECT e.fecha_facturacion, e.id_formapago, e.id_glosa, LTRIM(RTRIM(ISNULL(g.nombre_glosa, ''))) AS nombre_glosa, e.glosa, e.mes, e.nota, e.emitido, e.eliminado
     FROM dbo.facturacion_enc e LEFT JOIN dbo.mae_glosa g ON g.id_glosa = e.id_glosa WHERE e.id_facturacion = @id;`
  )).recordset || [])[0] || {};
  return {
    emision,
    encabezado: enc,
    titulo: tituloFactura(enc, detalle[0]),
    tieneFolio: num(enc.factura) > 0,
    // con folio la pantalla bloquea todas las ediciones; sin folio se puede editar (salvo perfil "COM", que no tiene acceso)
    editable: !(num(enc.factura) > 0),
    ingresos, descuentos, ordenes, detalle,
    totalOtrosIngresos: r2(sumaValores(ingresos)),
    totalOtrosDescuentos: r2(sumaValores(descuentos)),
    totalDetalleUf: r2(detalle.reduce((a, d) => a + num(d.uf_tot), 0)),
    ...describirFacturadoPor(detalle[0]),
    llevaDolar: num(enc.id_empresaservicio) === ID_EMPRESA_CON_DOLAR,
    usdTotalCasos: usd ? (num(enc.uf_totalcaso) * num(enc.uf)) / usd : 0
  };
}

/** Busca por ID de facturación (botón de la lupa junto al N° interno). */
export async function consultarFacturaPorId(db, { id_facturacion }) {
  const id = num(id_facturacion);
  const r = await db.request().input('id', N, id).query('EXEC dbo.fac_consulta_una_factura_enc @xid_facturacion = @id;');
  const filas = r.recordset || [];
  if (!filas.length) throw new Error('No existen datos registrados para esta FACTURA.');
  return leerFactura(db, filas[0]);
}

/**
 * Busca por N° de factura. Un mismo número puede cubrir varias facturas internas; ADLSOFT se queda con la primera que devuelve el
 * procedimiento (sin orden definido). Aquí se informa además cuáles son las otras (ver H-01 y H-28).
 */
export async function consultarFacturaPorFolio(db, { factura }) {
  const r = await db.request().input('f', N, num(factura)).query('EXEC dbo.fac_consulta_una_factura_enc_factura @xfactura = @f;');
  const filas = r.recordset || [];
  if (!filas.length) throw new Error('No existen datos registrados para esta FACTURA.');
  const resultado = await leerFactura(db, filas[0]);
  const otras = [...new Set(filas.slice(1).map((x) => num(x.id_facturacion)))].filter((id) => id !== num(filas[0].id_facturacion));
  return { ...resultado, otrasFacturasConElMismoFolio: otras };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Graba Factura
// ---------------------------------------------------------------------------------------------------------------------------

/** Total de la factura en UF: casos + ingresos − descuentos, redondeado a 2 decimales como en la pantalla. */
export function totalesFactura({ uf_totalcaso, ingresos, descuentos }) {
  const caso = r2(uf_totalcaso);
  const ing = r2(sumaValores(ingresos));
  const des = r2(sumaValores(descuentos));
  return { uf_totalcaso: caso, uf_totalotrosing: ing, uf_totalotrosdes: des, uf_totalfac: r2(num(uf_totalcaso) + sumaValores(ingresos) - sumaValores(descuentos)) };
}

/**
 * "Graba Factura". Dos casos, según el N° de factura tecleado:
 *  - **Sin N° de factura (0)**: graba los totales, el valor de la UF, los pesos y (empresa 500) el total en dólares; reemplaza los otros
 *    ingresos y descuentos; pone la UF en todas las líneas de la factura; y asocia las guías reservadas de la empresa.
 *  - **Con N° de factura**: solo graba el número y la UF en el encabezado y asocia las guías reservadas.
 * DESVÍO: se exige que la factura no tenga ya un N° (la pantalla de ADLSOFT bloquea los campos, pero nada lo impide en la base) y que
 * la UF sea mayor que cero (con UF 0 los pesos quedarían en cero).
 */
export async function grabarFactura(db, { id_facturacion, factura = 0, uf, ingresos = [], descuentos = [] }) {
  const id = num(id_facturacion);
  if (!id) throw new Error('Lo siento, No puedes grabar nada, revisa la información.');
  const enc = ((await db.request().input('id', N, id).query('EXEC dbo.fac_consulta_una_factura_enc @xid_facturacion = @id;')).recordset || [])[0];
  if (!enc) throw new Error('No existen datos registrados para esta FACTURA.');
  if (num(enc.factura) > 0) throw new Error(`La factura interna ${id} ya tiene el N° de factura ${num(enc.factura)}.`);
  const valorUf = num(uf);
  if (!(valorUf > 0)) throw new Error('Debe ingresar el Valor de la U.F.');
  const folio = num(factura);

  if (folio === 0) {
    const t = totalesFactura({ uf_totalcaso: enc.uf_totalcaso, ingresos, descuentos });
    const pesos = roundVfp(r2(t.uf_totalfac) * valorUf, 0);
    let usdTotal = 0;
    if (num(enc.id_empresaservicio) === ID_EMPRESA_CON_DOLAR) {
      if (!(r2(enc.usd) > 0)) throw new Error('Para la empresa de id 500 la factura debe tener el Valor USD.');
      usdTotal = pesos / r2(enc.usd);
    }
    await db.request().input('id', N, id).input('f', N, 0).input('c', sql.Numeric(14, 3), t.uf_totalcaso).input('i', sql.Numeric(14, 3), t.uf_totalotrosing)
      .input('d', sql.Numeric(14, 3), t.uf_totalotrosdes).input('t', sql.Numeric(14, 3), t.uf_totalfac).input('p', sql.Numeric(14, 0), pesos)
      .input('uf', sql.Numeric(14, 3), valorUf).input('usd', sql.Numeric(14, 3), usdTotal)
      .query(`UPDATE dbo.facturacion_enc SET factura = @f, uf_totalcaso = @c, uf_totalotrosing = @i, uf_totalotrosdes = @d, uf_totalfac = @t,
              peso_totalfac = @p, uf = @uf, usd_totalfac = @usd WHERE id_facturacion = @id;
              UPDATE dbo.muestras_detalle SET uf = @uf WHERE id_facturacion = @id;`);
    await db.request().input('id', N, id).query('DELETE dbo.facturacion_ing WHERE id_facturacion = @id; DELETE dbo.facturacion_des WHERE id_facturacion = @id;');
    for (const c of ingresos) {
      await db.request().input('id', N, id).input('c', N, num(c.id_otrosingresos)).input('v', sql.Numeric(14, 3), num(c.valor))
        .query('INSERT dbo.facturacion_ing (id_facturacion, id_otrosingresos, valor) VALUES (@id, @c, @v);');
    }
    for (const c of descuentos) {
      await db.request().input('id', N, id).input('c', N, num(c.id_otrosdescuentos)).input('v', sql.Numeric(14, 3), num(c.valor))
        .query('INSERT dbo.facturacion_des (id_facturacion, id_otrosdescuentos, valor) VALUES (@id, @c, @v);');
    }
    const guias = await asociarGuias(db, { id_empresaservicio: enc.id_empresaservicio, id_facturacion: id, factura: 0, fecha_facturacion: enc.fecha_facturacion, uf: valorUf });
    return { modo: 'totales', id_facturacion: id, ...t, peso_totalfac: pesos, usd_totalfac: usdTotal, guiasAsociadas: guias };
  }

  await db.request().input('id', N, id).input('f', N, folio).input('uf', sql.Numeric(14, 3), valorUf)
    .query('UPDATE dbo.facturacion_enc SET factura = @f, uf = @uf WHERE id_facturacion = @id;');
  const guias = await asociarGuias(db, { id_empresaservicio: enc.id_empresaservicio, id_facturacion: id, factura: folio, fecha_facturacion: enc.fecha_facturacion, uf: valorUf });
  return { modo: 'folio', id_facturacion: id, factura: folio, uf: valorUf, guiasAsociadas: guias };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Guías de despacho a clientes (Abastecimiento)
// ---------------------------------------------------------------------------------------------------------------------------

/**
 * Guías reservadas (marca 1), pendientes y sin factura de la empresa pasan a FACTURADO con el ID, el N° y la fecha de la factura.
 * Ojo: toma TODAS las reservadas de la empresa, no solo las que se eligieron para esta factura. Como en el primer grabado el N° de
 * factura es 0, esas guías quedan con N° 0 para siempre (ver H-60).
 */
export async function asociarGuias(db, { id_empresaservicio, id_facturacion, factura, fecha_facturacion, uf }) {
  const r = await db.request().input('e', N, num(id_empresaservicio)).input('id', N, num(id_facturacion)).input('f', N, num(factura))
    .input('fe', sql.VarChar(10), txt(fecha_facturacion)).input('uf', sql.Numeric(14, 3), num(uf))
    .query(`UPDATE Abastecimiento.dbo.gd_enc SET estado = 'FACTURADO', id_facturacion = @id, factura = @f, fecha_factura = @fe, marca = 1, uf = @uf
            WHERE id_empresaservicio = @e AND marca = 1 AND factura = 0 AND estado = 'Pendiente';`);
  return r.rowsAffected?.[0] ?? 0;
}

/** Guías pendientes de la empresa para elegir (procedimiento de ADLSOFT: tipos de guía 1, 2 y 9). */
export async function listarGuiasPendientes(db, { id_empresaservicio }) {
  const r = await db.request().input('e', N, num(id_empresaservicio)).query('EXEC Abastecimiento.dbo.fac_guiasdespachoclientes @xid_empresaservicio = @e;');
  return r.recordset || [];
}

/** Neto de las guías elegidas en UF: pesos ÷ UF, UF tal cual y dólares ignorados (suman 0). */
export function netoGuiasUf(detalles, uf) {
  return (detalles || []).reduce((total, d) => {
    const moneda = num(d.id_moneda);
    if (moneda === 1) return total + num(d.tneto) / num(uf);
    if (moneda === 3) return total + num(d.tneto);
    return total;
  }, 0);
}

/** Calcula el neto en UF de las guías elegidas (botón "Calcular"). No cambia nada. */
export async function calcularNetoGuias(db, { ids_gd, uf }) {
  if (!(num(uf) > 0)) throw new Error('Debe ingresar el Valor de la U.F.');
  const detalles = [];
  for (const id of ids_gd || []) {
    const r = await db.request().input('g', N, num(id)).query('SELECT id_gd, item, id_moneda, tneto FROM Abastecimiento.dbo.gd_det WHERE id_gd = @g ORDER BY item;');
    detalles.push(...(r.recordset || []));
  }
  return { netoUf: netoGuiasUf(detalles, uf), detalles };
}

/**
 * Reserva las guías elegidas (marca = 1) y devuelve la línea de "otros ingresos" que las cobra. La línea no se guarda aquí: hay que
 * mandarla en "Graba Factura". Si no se llega a grabar, las guías quedan reservadas y las toma la próxima factura de esa empresa (H-61).
 */
export async function reservarGuias(db, { ids_gd, uf, id_facturacion }) {
  const { netoUf } = await calcularNetoGuias(db, { ids_gd, uf });
  for (const id of ids_gd || []) {
    await db.request().input('g', N, num(id)).query('UPDATE Abastecimiento.dbo.gd_enc SET marca = 1 WHERE id_gd = @g;');
  }
  return { id_facturacion: num(id_facturacion), id_otrosingresos: ID_OTRO_INGRESO_GUIAS, nombre_otrosingresos: NOMBRE_OTRO_INGRESO_GUIAS, valor: netoUf };
}

/** Deja pendientes todas las guías de una factura (lo que hace ADLSOFT al quitar CUALQUIER fila de otros ingresos). */
export async function liberarGuiasDeFactura(db, { id_facturacion }) {
  const r = await db.request().input('id', N, num(id_facturacion))
    .query("UPDATE Abastecimiento.dbo.gd_enc SET estado = 'Pendiente', id_facturacion = 0, fecha_factura = '  /  /    ', marca = 0, uf = 0 WHERE id_facturacion = @id;");
  return r.rowsAffected?.[0] ?? 0;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Excel de resumen y detalle
// ---------------------------------------------------------------------------------------------------------------------------

export const COLUMNAS_EXCEL_RESUMEN = ['factura', 'empresa', 'fecha', 'uf_ingresos', 'uf_descuentos', 'uf_caso', 'uf_total', 'pesos_total', 'valor_uf', 'facturado_por', 'programa', 'dato1', 'dato2', 'dato3'];
export const columnasExcelDetalle = ({ empresa500 = false, lote = false } = {}) => [
  'empresa', 'factura', 'fecha', 'facturado_por', 'programa', 'centro', ...(lote ? ['lote'] : []), 'veterinario', 'tipoagua', 'caso', 'tecnica', 'organo',
  'medio', 'n_analisis', 'uf_uni', 'uf_tot', 'pesos_total', 'uf_valor', ...(empresa500 ? ['usd_valor'] : []), 'fecha_informe_ini', 'fecha_informe_fin', 'fecha_muestreo'
];

/** Los tres datos del resumen (centro, veterinario, tipo de agua) se reubican según por qué se factura. */
export function plegarDatosResumen(fila) {
  const f = { ...fila };
  switch (txt(f.facturado_por)) {
    case 'Centro': f.dato2 = ''; f.dato3 = ''; break;
    case 'Veterinario': f.dato1 = f.dato2; f.dato2 = ''; f.dato3 = ''; break;
    case 'Centro - Veterinario': f.dato3 = ''; break;
    case 'Tipo de Agua': f.dato1 = f.dato3; f.dato2 = ''; f.dato3 = ''; break;
    case 'Tipo de Agua - Veterinario': f.dato1 = f.dato3; f.dato2 = ''; f.dato3 = ''; break;
    default: break;
  }
  return f;
}

/**
 * Filas del resumen. En el Excel los pesos van sin redondear (UF total × valor UF) y en el PDF a 2 decimales (H-62).
 */
export function filasResumen(filas, { redondearPesos = false } = {}) {
  return (filas || []).map((x) => {
    const f = plegarDatosResumen(x);
    const pesos = num(f.uf_total) * num(f.valor_uf);
    return { ...f, pesos_total: redondearPesos ? r2(pesos) : pesos };
  });
}

/** Filas del detalle con los pesos de cada línea (sin redondear, como en el Excel de ADLSOFT). */
export function filasDetalle(filas) {
  return (filas || []).map((f) => ({ ...f, pesos_total: num(f.uf_tot) * num(f.uf_valor) }));
}

export async function datosExcelResumen(db, { id_facturacion }) {
  const r = await db.request().input('id', N, num(id_facturacion)).query('EXEC dbo.fac_excel_resumen @xid_facturacion = @id;');
  return { columnas: COLUMNAS_EXCEL_RESUMEN, filas: filasResumen(r.recordset || []) };
}

export async function datosExcelDetalle(db, { id_facturacion, lote = false }) {
  const r = await db.request().input('id', N, num(id_facturacion)).query(`EXEC dbo.${lote ? 'fac_excel_detalle_lote' : 'fac_excel_detalle'} @xid_facturacion = @id;`);
  const filas = filasDetalle(r.recordset || []);
  const empresa500 = filas.length > 0 && num(filas[0].id_empresaservicio) === ID_EMPRESA_CON_DOLAR;
  return { columnas: columnasExcelDetalle({ empresa500, lote }), filas };
}
