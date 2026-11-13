// PRUEBA 2 DE LAS OPERACIONES QUE ESCRIBEN: guias de despacho, notas de debito y otras ventas desde cero (con su exportacion).
// SOLO EN LA COPIA LOCAL (NTDMora\ADLLOCAL). Cada paso comprueba el estado de la base.
process.chdir('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone');
const base = 'file:///C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone/src/';
const db0 = await import(base + 'config/databaseSalud.js'); // candado: solo este equipo
const { facturacionSaludService: s } = await import(base + 'services/facturacion-salud.service.js');
const pool = await db0.getConnectionSalud();
const q = async (t) => (await pool.request().query('SET DATEFORMAT dmy; ' + t)).recordset;
const num = (v) => Number(v) || 0; const txt = (x) => String(x ?? '').trim();
const quien = (await q("SELECT @@SERVERNAME s, CAST(SERVERPROPERTY('MachineName') AS nvarchar(100)) m"))[0];
if (!/ADLLOCAL/i.test(quien.s)) { console.log('ABORTO: el servidor no es ADLLOCAL:', quien.s); process.exit(2); }
console.log(`Servidor de la prueba: ${quien.s} (maquina ${quien.m})\n`);

let ok = 0, mal = 0; const fallas = [];
const chequeo = (nombre, cond, detalle = '') => { if (cond) { ok++; console.log('  [OK ]', nombre); } else { mal++; fallas.push(nombre + (detalle ? ' -> ' + detalle : '')); console.log('  [FALLA]', nombre, detalle ? '-> ' + detalle : ''); } };
const lanza = async (nombre, fn, patron) => { try { await fn(); chequeo(nombre, false, 'no lanzo error'); } catch (e) { chequeo(nombre, patron.test(e.message), e.message); } };
const ELIGE = { 1: 1, 2: 2, 3: 4, 4: 5, 5: 3, 10: 3, 18: 8 };
const contadores = async () => (await q('SELECT id_facturacion, id_otroscobros FROM dbo.mae_id'))[0];
const cuenta = async (t, id) => num((await q(`SELECT COUNT(*) n FROM dbo.${t} WHERE id_facturacion = ${id}`))[0].n);
const guiasEstado = (ids) => q(`SELECT id_gd, estado, id_facturacion, factura, marca, uf, fecha_factura FROM Abastecimiento.dbo.gd_enc WHERE id_gd IN (${ids.join(',')}) ORDER BY id_gd`);

async function prefacturaDe(id) {
  const enc = (await q(`SELECT * FROM dbo.facturacion_enc WHERE id_facturacion = ${id}`))[0];
  const casos = (await q(`SELECT DISTINCT id_caso FROM dbo.facturacion_det WHERE id_facturacion = ${id}`)).map((d) => num(d.id_caso));
  const prog = num((await q(`SELECT TOP 1 id_programa FROM dbo.muestras WHERE id_caso = ${casos[0]}`))[0].id_programa);
  await s.eliminarPrefacturaSalud(id);
  const fi = (await q(`SELECT CONVERT(varchar(10), MIN(CONVERT(datetime, fecha_informe, 103)), 103) a, CONVERT(varchar(10), MAX(CONVERT(datetime, fecha_informe, 103)), 103) b FROM dbo.muestras WHERE id_caso IN (${casos.join(',')}) AND ISDATE(fecha_informe) = 1`))[0];
  const rango = { fecha_proceso_ini: fi.a, fecha_proceso_fin: fi.b };
  await s.valorizarCasosSalud({ id_empresaservicio: num(enc.id_empresaservicio), eligeprograma: ELIGE[prog], ...rango, valor_uf: num(enc.uf), valor_usd: num(enc.usd) });
  const c = await s.crearPrefacturasSalud({
    id_empresaservicio: num(enc.id_empresaservicio), eligeprograma: ELIGE[prog], criterio_agrupacion: txt(enc.facturado_por) || 'Na', casos_ids: casos,
    fecha_facturacion: txt(enc.fecha_facturacion), id_formapago: num(enc.id_formapago), id_glosa: num(enc.id_glosa), glosa: txt(enc.glosa), observaciones: txt(enc.observaciones),
    nota: txt(enc.nota), mes: txt(enc.mes), ano: txt(enc.ano), ...rango, fecha_informe_ini: txt(enc.fecha_informe_ini), fecha_informe_fin: txt(enc.fecha_informe_fin)
  });
  return { id: num(c.prefacturas[0].id_facturacion), casos, empresa: num(enc.id_empresaservicio), uf: num(enc.uf), fecha: txt(enc.fecha_facturacion) };
}

// ---- elegir una empresa con guias pendientes y una factura emitida de 2026 con sus casos en la copia -------------------------------------
const cand = await q(`SELECT TOP 1 fe.id_facturacion id, fe.id_empresaservicio e FROM dbo.facturacion_enc fe
  WHERE fe.emitido='S' AND fe.factura>0 AND fe.fecha_facturacion LIKE '%/2026' AND fe.uf_totalotrosing=0 AND fe.uf_totalotrosdes=0
    AND fe.id_empresaservicio = 632
    AND (SELECT COUNT(DISTINCT id_caso) FROM dbo.facturacion_det d WHERE d.id_facturacion=fe.id_facturacion) BETWEEN 1 AND 5
    AND (SELECT COUNT(DISTINCT d.id_caso) FROM dbo.facturacion_det d JOIN dbo.muestras m ON m.id_caso=d.id_caso WHERE d.id_facturacion=fe.id_facturacion) = (SELECT COUNT(DISTINCT id_caso) FROM dbo.facturacion_det d WHERE d.id_facturacion=fe.id_facturacion)
    AND (SELECT TOP 1 m.id_programa FROM dbo.facturacion_det d JOIN dbo.muestras m ON m.id_caso=d.id_caso WHERE d.id_facturacion=fe.id_facturacion) IN (1,2,3,4,5,10,18)
  ORDER BY fe.id_facturacion DESC`);
if (!cand.length) { console.log('No hay una factura candidata con empresa con guias pendientes.'); process.exit(3); }
console.log(`== Preparacion: prefactura de la factura ${cand[0].id} (empresa ${cand[0].e}, que tiene guias pendientes)`);
const P = await prefacturaDe(num(cand[0].id)); console.log(`   prefactura ${P.id} de la empresa ${P.empresa}`);
const UF = 41300;

// ----------------------------------------------------------------------------------------------------------------------------------
console.log('\n== T7. Guias de despacho: reservar, asociar al grabar, liberar y eliminar');
{
  const pend = await s.listarGuiasPendientesSalud(P.empresa);
  chequeo('el listado de guias pendientes de la empresa trae filas', pend.length >= 2, `filas ${pend.length}`);
  const ids = [...new Set(pend.map((g) => num(g.id_gd)))];
  const g12 = ids.slice(0, 1); const g3 = ids[1]; // una guia se elige para la factura y la otra simula la reserva de otra factura de la misma empresa
  // neto esperado segun las reglas de ADLSOFT: pesos / UF, UF tal cual, dolares ignorados
  const det = await q(`SELECT id_gd, id_moneda, tneto FROM Abastecimiento.dbo.gd_det WHERE id_gd IN (${g12.join(',')})`);
  const esperado = det.reduce((a, d) => a + (num(d.id_moneda) === 1 ? num(d.tneto) / UF : num(d.id_moneda) === 3 ? num(d.tneto) : 0), 0);
  const calc = await s.calcularNetoGuiasSalud({ ids_gd: g12, uf: UF });
  chequeo('calcula el neto en UF (pesos ÷ UF, UF tal cual, dolares no suman)', Math.abs(calc.netoUf - esperado) < 0.0001, `${calc.netoUf} vs ${esperado}`);
  chequeo('calcular no cambia nada', (await guiasEstado(g12)).every((g) => num(g.marca) === 0 && txt(g.estado) === 'Pendiente'));
  await lanza('calcular sin UF falla', () => s.calcularNetoGuiasSalud({ ids_gd: g12, uf: 0 }), /Valor de la U\.F\./);

  const linea = await s.reservarGuiasSalud({ ids_gd: g12, uf: UF, id_facturacion: P.id });
  const reservadas = await guiasEstado(g12);
  chequeo('reservar marca las guias elegidas (marca 1) y siguen pendientes', reservadas.every((g) => num(g.marca) === 1 && txt(g.estado) === 'Pendiente' && num(g.factura) === 0));
  chequeo('devuelve la linea de otros ingresos con el neto', Math.abs(num(linea.valor) - esperado) < 0.0001, JSON.stringify(linea));
  await s.reservarGuiasSalud({ ids_gd: [g3], uf: UF, id_facturacion: 0 }); // otra reserva de la MISMA empresa (como si fuera de otra factura)

  await s.grabarFacturaSalud({ id_facturacion: P.id, factura: 0, uf: UF, ingresos: [{ id_otrosingresos: linea.id_otrosingresos, valor: linea.valor }], descuentos: [] });
  const enc = (await q(`SELECT uf_totalotrosing, fecha_facturacion FROM dbo.facturacion_enc WHERE id_facturacion = ${P.id}`))[0];
  chequeo('la linea de guias queda como otro ingreso de la factura', (await cuenta('facturacion_ing', P.id)) === 1 && Math.abs(num(enc.uf_totalotrosing) - Math.round(esperado * 100) / 100) < 0.006, JSON.stringify(enc));
  const asoc = await guiasEstado([...g12, g3]);
  chequeo('al grabar, las guias reservadas pasan a FACTURADO con el ID, la UF y la fecha de la factura', asoc.every((g) => txt(g.estado).toUpperCase() === 'FACTURADO' && num(g.id_facturacion) === P.id && num(g.uf) === UF && txt(g.fecha_factura) === txt(enc.fecha_facturacion)), JSON.stringify(asoc.slice(0, 1)));
  chequeo('RAREZA H-61 confirmada: toma TODAS las reservadas de la empresa, tambien la que no se eligio para esta factura', asoc.filter((g) => num(g.id_gd) === g3).every((g) => num(g.id_facturacion) === P.id));
  chequeo('RAREZA H-60 confirmada: en el primer grabado el N° de factura de las guias queda en 0', asoc.every((g) => num(g.factura) === 0));

  const libres = await s.liberarGuiasSalud(P.id);
  const despues = await guiasEstado([...g12, g3]);
  chequeo('liberar deja pendientes todas las guias de la factura (sin factura, sin marca, UF 0, sin fecha)', libres === 2 && despues.every((g) => txt(g.estado) === 'Pendiente' && num(g.id_facturacion) === 0 && num(g.marca) === 0 && num(g.uf) === 0 && /^[\s/]*$/.test(txt(g.fecha_factura))), `liberadas ${libres} ${JSON.stringify(despues.slice(0, 1))}`);

  await s.reservarGuiasSalud({ ids_gd: g12, uf: UF, id_facturacion: P.id });
  await s.grabarFacturaSalud({ id_facturacion: P.id, factura: 0, uf: UF, ingresos: [{ id_otrosingresos: linea.id_otrosingresos, valor: linea.valor }], descuentos: [] });
  await s.grabarFacturaSalud({ id_facturacion: P.id, factura: 99010, uf: UF });
  const trasFolio = await guiasEstado(g12);
  chequeo('RAREZA H-60 confirmada: al grabar el folio las guias ya asociadas NO reciben el numero (siguen en 0)', trasFolio.every((g) => num(g.factura) === 0 && num(g.id_facturacion) === P.id));
  await s.eliminarPrefacturaSalud(P.id);
  const fin = await guiasEstado(g12);
  chequeo('eliminar la factura libera sus guias de despacho', fin.every((g) => txt(g.estado) === 'Pendiente' && num(g.id_facturacion) === 0 && num(g.marca) === 0));
}

// ----------------------------------------------------------------------------------------------------------------------------------
console.log('\n== T8. Notas de debito');
{
  const R = await prefacturaDe(74609); await s.grabarFacturaSalud({ id_facturacion: R.id, factura: 99020, uf: UF });
  const encR = (await q(`SELECT uf, uf_totalfac, peso_totalfac, fecha_facturacion, id_empresaservicio FROM dbo.facturacion_enc WHERE id_facturacion = ${R.id}`))[0];
  const nd = { id_tipodocumento: 10, cod_razon: 2, id_empresaservicio: num(encR.id_empresaservicio), factura: 99020, uf: UF, monto: 50000, monto_uf: 50000 / UF, fecha_documento: '16/11/2026', tipo_ref: 'FE', num_ref: '99020', fecha_ref: txt(encR.fecha_facturacion), id_facturacion_referencia: R.id, id_formapago: 1, concepto_cobro: 'Nota de debito de prueba' };
  await lanza('sin motivo falla', () => s.crearOtraVentaSalud({ ...nd, cod_razon: 0 }), /motivo/i);
  await lanza('monto cero falla', () => s.crearOtraVentaSalud({ ...nd, monto: 0 }), /todos los datos/i);
  const c0 = await contadores();
  const r = await s.crearOtraVentaSalud(nd);
  const c1 = await contadores();
  const fila = (await q(`SELECT id_tipodocumento, cod_razon, emitido, tipo_ref, num_ref, monto FROM dbo.facturacion_otro WHERE id_facturacion = ${r.id_facturacion}`))[0];
  chequeo('queda registrada (tipo 10, razon 2, no emitida, con su referencia)', fila && num(fila.id_tipodocumento) === 10 && num(fila.cod_razon) === 2 && txt(fila.emitido) === 'N' && txt(fila.num_ref) === '99020', JSON.stringify(fila));
  chequeo('toma el numero del contador y aumenta los dos contadores', num(r.id_facturacion) === num(c0.id_facturacion) && num(c1.id_facturacion) === num(c0.id_facturacion) + 1 && num(c1.id_otroscobros) === num(c0.id_otroscobros) + 1);
  chequeo('una nota de debito NO toca la factura referenciada', (await cuenta('facturacion_enc', R.id)) === 1 && (await cuenta('facturacion_det', R.id)) > 0);
  const r2 = await s.crearOtraVentaSalud({ ...nd, cod_razon: 1, concepto_cobro: 'ND con razon Anula' });
  chequeo('ni siquiera con razon «Anula» (solo la nota de CREDITO anula)', (await cuenta('facturacion_enc', R.id)) === 1 && !!r2.id_facturacion);
  const lista = await s.listarDocumentosArchivoSalud('NDE', 'NO emitidos');
  chequeo('aparece en el listado del archivo de notas de debito', lista.some((d) => num(d.id_facturacion) === r.id_facturacion));
  const ex = await s.exportarDocumentosArchivoSalud('NDE', [r.id_facturacion]);
  const lineas = Buffer.from(ex.contenidoAnsiBase64, 'base64').toString('latin1').split('\r\n').filter(Boolean);
  chequeo('el archivo NDE_<id>.TXT trae el encabezado y una fila (las notas no llevan filas de OC)', ex.nombreArchivo === `NDE_${r.id_facturacion}.TXT` && lineas.length === 2, `${ex.nombreArchivo} lineas ${lineas.length}`);
  chequeo('al exportar queda emitida', txt((await q(`SELECT emitido FROM dbo.facturacion_otro WHERE id_facturacion = ${r.id_facturacion}`))[0].emitido) === 'S');
}

// ----------------------------------------------------------------------------------------------------------------------------------
console.log('\n== T9. Otras ventas desde cero (FEA afecta y FEE exportacion), mantencion y archivo plano');
{
  const base = { id_empresaservicio: P.empresa, monto: 1000000, monto_uf: 24.213, uf: UF, fecha_documento: '16/11/2026', id_formapago: 1, concepto_cobro: 'Servicio de prueba', tipoimpuesto: 'FEA', ordenes_compra: [{ ocompra: 'OC-1234', fecha: '10/11/2026', referencia: 'OC' }] };
  await lanza('sin tipo de documento falla', () => s.crearOtraVentaSalud({ ...base, id_tipodocumento: 0 }), /todos los datos/i);
  await lanza('sin empresa falla', () => s.crearOtraVentaSalud({ ...base, id_tipodocumento: 1, id_empresaservicio: 0 }), /empresa/i);
  const c0 = await contadores();
  const fea = await s.crearOtraVentaSalud({ ...base, id_tipodocumento: 1 });
  const f = (await q(`SELECT id_otroscobros, id_tipodocumento, emitido, monto, monto_uf, uf, concepto_cobro, tipoimpuesto FROM dbo.facturacion_otro WHERE id_facturacion = ${fea.id_facturacion}`))[0];
  chequeo('crea la factura afecta (tipo 1, no emitida, FEA) y aumenta los contadores', f && num(f.id_tipodocumento) === 1 && txt(f.emitido) === 'N' && txt(f.tipoimpuesto) === 'FEA' && num(fea.id_facturacion) === num(c0.id_facturacion) && num((await contadores()).id_facturacion) === num(c0.id_facturacion) + 1, JSON.stringify(f));
  const oc = await q(`SELECT ocompra, tipo, orden FROM dbo.facturacion_ocompra WHERE id_facturacion = ${fea.id_facturacion}`);
  chequeo('guarda la OC elegida al crear, sin tipo ni orden (rareza H-80)', oc.length === 1 && txt(oc[0].ocompra) === 'OC-1234' && txt(oc[0].tipo) === '', JSON.stringify(oc));
  const idOC = num(f.id_otroscobros);

  await lanza('numero de documento cero falla', () => s.modificarOtraVentaSalud('numero', { id_otroscobros: idOC, numero_documento: 0 }), /N° del Documento/);
  await s.modificarOtraVentaSalud('numero', { id_otroscobros: idOC, numero_documento: 5555 });
  await lanza('fecha vacia falla', () => s.modificarOtraVentaSalud('fecha', { id_otroscobros: idOC, fecha: '' }), /Fecha/);
  await s.modificarOtraVentaSalud('fecha', { id_otroscobros: idOC, fecha: '17/11/2026' });
  await lanza('glosa vacia falla', () => s.modificarOtraVentaSalud('glosa', { id_otroscobros: idOC, concepto: '' }), /Glosa/);
  await s.modificarOtraVentaSalud('glosa', { id_otroscobros: idOC, concepto: 'Servicio de prueba corregido' });
  await s.modificarOtraVentaSalud('nota', { id_otroscobros: idOC, nota: 'nota de prueba' });
  await lanza('UF cero falla', () => s.modificarOtraVentaSalud('uf', { id_otroscobros: idOC, uf: 0 }), /Valor UF/);
  await s.modificarOtraVentaSalud('uf', { id_otroscobros: idOC, uf: 41400 });
  let m = (await q(`SELECT numero_documento, fecha_documento, concepto_cobro, nota, uf, monto, monto_uf FROM dbo.facturacion_otro WHERE id_otroscobros = ${idOC}`))[0];
  chequeo('mantencion: numero, fecha, glosa y nota quedan grabados', num(m.numero_documento) === 5555 && txt(m.fecha_documento) === '17/11/2026' && txt(m.concepto_cobro) === 'Servicio de prueba corregido' && txt(m.nota) === 'nota de prueba', JSON.stringify(m));
  chequeo('cambiar la UF recalcula los pesos con el monto en UF (la columna guarda pesos enteros)', Math.abs(num(m.monto) - 24.213 * 41400) < 1 && num(m.uf) === 41400, `${m.monto} vs ${24.213 * 41400}`);
  await s.modificarOtraVentaSalud('monto-uf', { id_otroscobros: idOC, monto_uf: 30 });
  m = (await q(`SELECT uf, monto, monto_uf FROM dbo.facturacion_otro WHERE id_otroscobros = ${idOC}`))[0];
  chequeo('cambiar el monto en UF recalcula los pesos con la UF del documento', Math.abs(num(m.monto) - 30 * 41400) < 0.01 && num(m.monto_uf) === 30, JSON.stringify(m));

  const pend = await s.listarOtrasVentasSalud('NO emitidos');
  chequeo('aparece en la lista de otras ventas no emitidas', pend.some((d) => num(d.id_facturacion) === fea.id_facturacion));
  const ex = await s.exportarDocumentosArchivoSalud('FEA', [fea.id_facturacion]);
  const lineas = Buffer.from(ex.contenidoAnsiBase64, 'base64').toString('latin1').split('\r\n').filter(Boolean);
  chequeo('el archivo FE_OTRASVENTAS_<id>.TXT trae encabezado, fila principal y fila de la OC', ex.nombreArchivo === `FE_OTRASVENTAS_${fea.id_facturacion}.TXT` && lineas.length === 3, `${ex.nombreArchivo} lineas ${lineas.length}`);
  chequeo('al exportar queda emitida y sale de la lista de no emitidas', txt((await q(`SELECT emitido FROM dbo.facturacion_otro WHERE id_facturacion = ${fea.id_facturacion}`))[0].emitido) === 'S' && !(await s.listarOtrasVentasSalud('NO emitidos')).some((d) => num(d.id_facturacion) === fea.id_facturacion));

  const fee = await s.crearOtraVentaSalud({ ...base, id_tipodocumento: 11, tipoimpuesto: 'FEE', concepto_cobro: 'Exportacion de prueba' });
  const exE = await s.exportarDocumentosArchivoSalud('FEE', [fee.id_facturacion]);
  const textoE = Buffer.from(exE.contenidoAnsiBase64, 'base64').toString('latin1');
  chequeo('exportacion (FEE): archivo FEE_<id>.TXT y la fila de la OC lleva el tipo «OC»', exE.nombreArchivo === `FEE_${fee.id_facturacion}.TXT` && /,"OC","OC-1234"/.test(textoE), exE.nombreArchivo);
}

const c = await contadores();
console.log(`\n== RESULTADO: ${ok} comprobaciones correctas, ${mal} con falla. Contador de numeracion al final: ${c.id_facturacion}`);
if (fallas.length) console.log('FALLAS:\n - ' + fallas.join('\n - '));
await db0.closeConnectionSalud(); process.exit(mal ? 1 : 0);
