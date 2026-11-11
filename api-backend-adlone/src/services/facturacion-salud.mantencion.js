/**
 * Mantención de facturas ya creadas (Facturación Salud), réplica de ADLSOFT:
 *   - fac_elimina_reprocesa_v2.scx      → eliminar por N° de factura / por ID facturación
 *   - fac_cambiaempresafacturar_v1.scx  → cambiar la empresa a facturar
 *   - fac_ocompra_factura.scx           → órdenes de compra asociadas (tabla facturacion_oc)
 *   - fac_facturacreada_oi_od.scx       → otros ingresos / otros descuentos de las facturas recién creadas
 *
 * Cada función recibe `db`, un objeto con `request()` que devuelve un Request de mssql (el pool o una transacción), y no abre
 * conexiones por su cuenta: así se puede probar con un doble y decidir fuera si va dentro de una transacción.
 * Las diferencias deliberadas con ADLSOFT están marcadas con "DESVÍO" y documentadas en docs/facturacion-salud-replica-adlsoft.md.
 */
import sql from '../config/databaseSalud.js';

const N = sql.Numeric(10, 0);
const txt = (v) => String(v ?? '').trim();
const num = (v) => Number(v) || 0;

/** dd/mm/yyyy a partir de yyyy-mm-dd o dd/mm/yyyy; vacío si no se entiende */
export function fechaDmy(v) {
  const s = txt(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) { const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${y}`; }
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0, 10);
  return '';
}

// ---------------------------------------------------------------------------------------------------------------------------
// Eliminar factura
// ---------------------------------------------------------------------------------------------------------------------------

/**
 * "Elimina ID Facturación" (y, sin la parte de guías, "Elimina Factura"): devuelve las líneas a estado ENVIADO, sin factura, con
 * UF 0 y valorizado 'N', y borra encabezado, detalle, descuentos e ingresos. No toca facturacion_oc ni facturacion_ocompra (ADLSOFT
 * tampoco: deja esas filas huérfanas). Con `liberarGuias` también deja las guías de despacho (Abastecimiento.gd_enc) como pendientes.
 */
export async function eliminarFacturaPorId(db, { id_facturacion, liberarGuias = true }) {
  const id = num(id_facturacion);
  if (!id) throw new Error('Debe indicar el ID de facturación.');
  const existe = await db.request().input('id', N, id).query('SELECT id_facturacion FROM dbo.facturacion_enc WHERE id_facturacion = @id;');
  if (!(existe.recordset || []).length) throw new Error('No existen datos para ese N° ID Facturación');

  const lineas = await db.request().input('id', N, id)
    .query("UPDATE dbo.muestras_detalle SET estado = 'ENVIADO', id_facturacion = 0, uf = 0, valorizado = 'N' WHERE id_facturacion = @id;");
  await db.request().input('id', N, id).query(`
    DELETE dbo.facturacion_enc WHERE id_facturacion = @id;
    DELETE dbo.facturacion_det WHERE id_facturacion = @id;
    DELETE dbo.facturacion_des WHERE id_facturacion = @id;
    DELETE dbo.facturacion_ing WHERE id_facturacion = @id;`);
  let guias = 0;
  if (liberarGuias) {
    // gd_enc vive en la base Abastecimiento; ADLSOFT la deja pendiente, sin factura ni fecha, marca 0 y uf 0
    const g = await db.request().input('id', N, id)
      .query("UPDATE Abastecimiento.dbo.gd_enc SET estado = 'Pendiente', id_facturacion = 0, fecha_factura = '  /  /    ', marca = 0, uf = 0 WHERE id_facturacion = @id;");
    guias = g.rowsAffected?.[0] ?? 0;
  }
  return { id_facturacion: id, lineasLiberadas: lineas.rowsAffected?.[0] ?? 0, guiasLiberadas: guias };
}

/**
 * "Elimina Factura" por N° de factura. Un mismo número de factura puede cubrir varias facturas internas (una por centro,
 * veterinario o tipo de agua); ADLSOFT toma solo la primera que encuentra y NO libera las guías. Aquí se hace lo mismo, pero se
 * informa cuántas otras facturas internas comparten el número para que quien llama pueda avisar.
 */
export async function eliminarFacturaPorNumero(db, { factura }) {
  const f = num(factura);
  if (!f) throw new Error('Debe indicar el N° de factura.');
  const filas = (await db.request().input('f', N, f).query('SELECT id_facturacion FROM dbo.facturacion_enc WHERE factura = @f ORDER BY id_facturacion;')).recordset || [];
  if (!filas.length) throw new Error('No existen datos para ese N° Factura');
  const [primera, ...otras] = filas.map((r) => num(r.id_facturacion));
  const r = await eliminarFacturaPorId(db, { id_facturacion: primera, liberarGuias: false });
  return { ...r, factura: f, otrasFacturasConElMismoNumero: otras };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Cambiar empresa a facturar
// ---------------------------------------------------------------------------------------------------------------------------

/**
 * Cambia la empresa de una factura y de TODOS los casos que la componen (también se cambia muestras.id_empresaservicio, es decir,
 * la empresa del caso en el LIMS). El motivo es obligatorio. ADLSOFT no guarda el motivo en ningún lado y no valida nada más;
 * la segunda opción de su pantalla ("dejar los casos para re-procesar") no hace nada.
 * DESVÍO: el motivo se registra en `auditoria` (ADLSOFT lo descarta).
 */
export async function cambiarEmpresaFactura(db, { id_facturacion, id_empresaservicio_nueva, motivo, id_usuario = 0 }) {
  const id = num(id_facturacion);
  const nueva = num(id_empresaservicio_nueva);
  if (!id) throw new Error('No existe ID Facturación');
  if (!nueva) throw new Error('Debe elegir la empresa a facturar.');
  if (!txt(motivo)) throw new Error('Debe ingresar el Motivo.');

  const enc = (await db.request().input('id', N, id)
    .query('SELECT id_facturacion, id_empresaservicio FROM dbo.facturacion_enc WHERE id_facturacion = @id;')).recordset || [];
  if (!enc.length) throw new Error('No existe ID Facturación');
  const anterior = num(enc[0].id_empresaservicio);

  await db.request().input('id', N, id).input('e', N, nueva)
    .query('UPDATE dbo.facturacion_enc SET id_empresaservicio = @e WHERE id_facturacion = @id;');
  const casos = await db.request().input('id', N, id).input('e', N, nueva).query(`
    UPDATE m SET m.id_empresaservicio = @e
    FROM dbo.muestras m
    WHERE m.id_caso IN (SELECT DISTINCT d.id_caso FROM dbo.muestras_detalle d WHERE d.id_facturacion = @id);`);

  await auditar(db, {
    id_referencia: id, referencia: 'Facturación - Cambia empresa a facturar', campo: 'Empresa a facturar',
    original: String(anterior), tipo: 'CAMBIA', nuevo: String(nueva), motivo: txt(motivo).slice(0, 100), id_usuario
  });
  return { id_facturacion: id, id_empresaservicio_anterior: anterior, id_empresaservicio_nueva: nueva, casosActualizados: casos.rowsAffected?.[0] ?? 0 };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Órdenes de compra asociadas (facturacion_oc)
// ---------------------------------------------------------------------------------------------------------------------------

export const MONEDAS_OC = ['$', 'U.F.', 'U$'];

/** Total en pesos: suma de `oc_conversion` (en la base, "conversión" es el monto en pesos, no una tasa). */
export const totalOcPesos = (filas) => (filas || []).reduce((a, f) => a + num(f.oc_conversion), 0);

export async function listarOcAsociadas(db, { id_facturacion }) {
  const r = await db.request().input('id', N, num(id_facturacion)).query(
    'SELECT id_facturacion, oc, oc_fecha_emision, oc_moneda, oc_valor, oc_conversion, id_usuario, fecha, hora FROM dbo.facturacion_oc WHERE id_facturacion = @id ORDER BY oc;');
  const filas = r.recordset || [];
  return { filas, totalPesos: totalOcPesos(filas) };
}

/** Valida y normaliza una OC a agregar. En pesos la conversión es el mismo valor; en otra moneda hay que indicarla (en pesos). */
export function normalizarOc({ oc, oc_fecha_emision, oc_moneda, oc_valor, oc_conversion }) {
  const moneda = txt(oc_moneda);
  const valor = num(oc_valor);
  const conversion = moneda === '$' ? valor : num(oc_conversion);
  const fecha = fechaDmy(oc_fecha_emision);
  if (!txt(oc) || !fecha || !MONEDAS_OC.includes(moneda) || !(valor > 0) || !(conversion > 0)) {
    throw new Error('Debes ingresar el Concepto y su valor.');
  }
  return { oc: txt(oc), oc_fecha_emision: fecha, oc_moneda: moneda, oc_valor: valor, oc_conversion: conversion };
}

export async function agregarOc(db, { id_facturacion, id_usuario = 0, ahora = new Date(), ...datos }) {
  const id = num(id_facturacion);
  const o = normalizarOc(datos);
  await db.request()
    .input('id', N, id).input('oc', sql.VarChar(50), o.oc).input('fe', sql.VarChar(10), o.oc_fecha_emision).input('mo', sql.VarChar(10), o.oc_moneda)
    .input('va', sql.Numeric(14, 2), o.oc_valor).input('co', sql.Numeric(14, 2), o.oc_conversion).input('us', N, num(id_usuario))
    .input('fecha', sql.VarChar(10), fechaHoy(ahora)).input('hora', sql.VarChar(10), horaHoy(ahora))
    .query(`INSERT dbo.facturacion_oc (id_facturacion, oc, oc_fecha_emision, oc_moneda, oc_valor, oc_conversion, id_usuario, fecha, hora)
            VALUES (@id, @oc, @fe, @mo, @va, @co, @us, @fecha, @hora);`);
  await auditar(db, { id_referencia: id, referencia: 'Facturación - Agrega O.Compra', campo: 'O.Compra', original: ' ', tipo: 'AGREGA', nuevo: ' ', motivo: `Agregar O.Compra asociada: ${o.oc}`, id_usuario, ahora });
  return o;
}

/**
 * Borra la OC que coincide en todos los campos. Si hubiera filas idénticas (ADLSOFT permite repetirlas), se borran todas.
 * DESVÍO: ADLSOFT audita solo "Agrega"; aquí también se audita "Elimina" (la pantalla lo intentaba pero hoy no hay ningún registro).
 */
export async function eliminarOc(db, { id_facturacion, id_usuario = 0, ahora = new Date(), ...datos }) {
  const id = num(id_facturacion);
  const fecha = fechaDmy(datos.oc_fecha_emision);
  const r = await db.request()
    .input('id', N, id).input('oc', sql.VarChar(50), txt(datos.oc)).input('fe', sql.VarChar(10), fecha).input('mo', sql.VarChar(10), txt(datos.oc_moneda))
    .input('va', sql.Numeric(14, 2), num(datos.oc_valor)).input('co', sql.Numeric(14, 2), num(datos.oc_conversion))
    .query(`DELETE dbo.facturacion_oc WHERE id_facturacion = @id AND oc = @oc AND oc_fecha_emision = @fe AND oc_moneda = @mo
            AND oc_valor = @va AND oc_conversion = @co;`);
  await auditar(db, { id_referencia: id, referencia: 'Facturación - Elimina O.Compra', campo: 'O.Compra', original: ' ', tipo: 'ELIMINA', nuevo: ' ', motivo: `Elimina O.Compra asociada: ${txt(datos.oc)}`, id_usuario, ahora });
  return { eliminadas: r.rowsAffected?.[0] ?? 0 };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Otros ingresos / otros descuentos de las facturas recién creadas ("Graba" de fac_facturacreada_oi_od)
// ---------------------------------------------------------------------------------------------------------------------------

/** Total de la factura en UF: total de casos + otros ingresos − otros descuentos. */
export const totalFacturaUf = ({ uf_totalcaso, ingresos, descuentos }) =>
  num(uf_totalcaso) + sumaValores(ingresos) - sumaValores(descuentos);

const sumaValores = (lista) => (lista || []).reduce((a, x) => a + num(x.valor), 0);

/** Una línea de ingreso/descuento: ADLSOFT exige concepto y un valor distinto de cero (acepta negativos). */
export function validarConcepto(c, campoId) {
  if (!num(c[campoId]) || !num(c.valor)) throw new Error('Debes ingresar el Concepto y su valor.');
  return { [campoId]: num(c[campoId]), valor: num(c.valor) };
}

/**
 * Graba, para cada factura, sus otros ingresos y descuentos y los totales del encabezado (solo facturas aún en creación, mf = 1).
 * Sin ingresos (o sin descuentos) ADLSOFT inserta igual una fila en cero con concepto 0.
 * DESVÍO: ADLSOFT solo inserta, así que grabar dos veces duplica las filas; aquí se reemplazan las de la factura.
 */
export async function grabarOtrosIngresosDescuentos(db, { facturas }) {
  const resultados = [];
  for (const f of facturas || []) {
    const id = num(f.id_facturacion);
    const enc = (await db.request().input('id', N, id).query('SELECT uf_totalcaso, mf FROM dbo.facturacion_enc WHERE id_facturacion = @id;')).recordset || [];
    if (!enc.length) throw new Error(`No existe la factura ${id}.`);
    if (num(enc[0].mf) !== 1) throw new Error(`La factura ${id} ya no está en creación.`);
    const ingresos = (f.ingresos || []).map((c) => validarConcepto(c, 'id_otrosingresos'));
    const descuentos = (f.descuentos || []).map((c) => validarConcepto(c, 'id_otrosdescuentos'));
    const totIng = sumaValores(ingresos);
    const totDes = sumaValores(descuentos);
    const totFac = totalFacturaUf({ uf_totalcaso: enc[0].uf_totalcaso, ingresos, descuentos });

    await db.request().input('id', N, id).input('ti', sql.Numeric(14, 3), totIng).input('td', sql.Numeric(14, 3), totDes).input('tf', sql.Numeric(14, 3), totFac)
      .query('UPDATE dbo.facturacion_enc SET uf_totalotrosing = @ti, uf_totalotrosdes = @td, uf_totalfac = @tf WHERE id_facturacion = @id;');
    await db.request().input('id', N, id).query('DELETE dbo.facturacion_ing WHERE id_facturacion = @id; DELETE dbo.facturacion_des WHERE id_facturacion = @id;');
    for (const c of ingresos.length ? ingresos : [{ id_otrosingresos: 0, valor: 0 }]) {
      await db.request().input('id', N, id).input('c', N, c.id_otrosingresos).input('v', sql.Numeric(14, 3), c.valor)
        .query('INSERT dbo.facturacion_ing (id_facturacion, id_otrosingresos, valor) VALUES (@id, @c, @v);');
    }
    for (const c of descuentos.length ? descuentos : [{ id_otrosdescuentos: 0, valor: 0 }]) {
      await db.request().input('id', N, id).input('c', N, c.id_otrosdescuentos).input('v', sql.Numeric(14, 3), c.valor)
        .query('INSERT dbo.facturacion_des (id_facturacion, id_otrosdescuentos, valor) VALUES (@id, @c, @v);');
    }
    resultados.push({ id_facturacion: id, uf_totalotrosing: totIng, uf_totalotrosdes: totDes, uf_totalfac: totFac });
  }
  return resultados;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Auditoría (procedimiento actualiza_auditoria de ADLSOFT)
// ---------------------------------------------------------------------------------------------------------------------------

const dos = (n) => String(n).padStart(2, '0');
const fechaHoy = (d) => `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
const horaHoy = (d) => `${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;

/**
 * ADLSOFT guarda aquí el ID de facturación en la columna `id_caso` (mezcla dos numeraciones) y el usuario de ADLSOFT; ADL ONE
 * guarda el id de su propio usuario. Se mantiene igual para que los registros nuevos se lean junto a los antiguos.
 */
async function auditar(db, { id_referencia, referencia, campo, original, tipo, nuevo, motivo, id_usuario = 0, ahora = new Date() }) {
  await db.request()
    .input('c', N, id_referencia).input('r', sql.VarChar(50), referencia).input('n', sql.VarChar(50), campo).input('o', sql.VarChar(50), original)
    .input('t', sql.VarChar(10), tipo).input('x', sql.VarChar(50), nuevo).input('m', sql.VarChar(100), motivo).input('u', N, num(id_usuario))
    .input('h', sql.VarChar(10), horaHoy(ahora)).input('f', sql.VarChar(10), fechaHoy(ahora))
    .query(`EXEC dbo.actualiza_auditoria @xid_caso = @c, @xreferencia = @r, @xnombre_campo = @n, @xdato_original = @o, @xtipo_correccion = @t,
            @xreemplazar_por = @x, @xmotivo = @m, @xid_usuario = @u, @xhora = @h, @xfecha = @f;`);
}
