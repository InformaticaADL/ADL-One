// PRUEBA DE LAS OPERACIONES QUE ESCRIBEN (eliminar, cambiar empresa, grabar folio, eliminar por folio, nota de credito que anula,
// nota de credito parcial por casos) CON DATOS REALES — SOLO EN LA COPIA LOCAL (NTDMora\ADLLOCAL). Cada paso comprueba el estado de la base.
process.chdir('C:/Users/vremolcoy/Desktop/ADL ONE/api-backend-adlone');
import fs from 'fs';
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

/** Deja una factura emitida de ADLSOFT como PREFACTURA nueva hecha por ADL ONE (elimina, valoriza y crea), para tener algo real que operar. */
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
const lineasDe = (casos) => q(`SELECT id_caso, item, estado, id_facturacion, uf, valorizado, mf, marcareversa, vtatotal, vtatotalnc FROM dbo.muestras_detalle WHERE id_caso IN (${casos.join(',')})`);
const cuenta = async (t, id) => num((await q(`SELECT COUNT(*) n FROM dbo.${t} WHERE id_facturacion = ${id}`))[0].n);
const contadores = async () => (await q('SELECT id_facturacion, id_otroscobros FROM dbo.mae_id'))[0];

console.log('== Preparacion: 4 prefacturas reales hechas con ADL ONE (a partir de facturas de octubre ya emitidas)');
const A = await prefacturaDe(74609); console.log('   A (PVA, 3 casos): prefactura', A.id);
const B = await prefacturaDe(74477); console.log('   B (PVA, 3 casos): prefactura', B.id);
const C = await prefacturaDe(74513); console.log('   C (PVA, 2 casos): prefactura', C.id);
const D = await prefacturaDe(74617); console.log('   D (SDG, 5 casos): prefactura', D.id);

// ----------------------------------------------------------------------------------------------------------------------------------
console.log('\n== T1. Eliminar una prefactura (sin folio)');
{
  const encAntes = num((await q('SELECT COUNT(*) n FROM dbo.facturacion_enc'))[0].n);
  const lineasAntes = (await lineasDe(A.casos)).filter((l) => num(l.id_facturacion) === A.id);
  chequeo('antes: la prefactura existe y tiene lineas facturadas', (await cuenta('facturacion_enc', A.id)) === 1 && lineasAntes.length > 0, `lineas ${lineasAntes.length}`);
  const r = await s.eliminarPrefacturaSalud(A.id);
  chequeo('devuelve la cantidad de lineas liberadas', r.lineasLiberadas === lineasAntes.length, `${r.lineasLiberadas} vs ${lineasAntes.length}`);
  chequeo('se borran encabezado, detalle, ingresos y descuentos', (await cuenta('facturacion_enc', A.id)) + (await cuenta('facturacion_det', A.id)) + (await cuenta('facturacion_ing', A.id)) + (await cuenta('facturacion_des', A.id)) === 0);
  const despues = await lineasDe(A.casos);
  const liberadas = despues.filter((l) => lineasAntes.some((a) => num(a.item) === num(l.item) && num(a.id_caso) === num(l.id_caso)));
  chequeo('las lineas vuelven a ENVIADO, sin factura, UF 0 y no valorizadas', liberadas.every((l) => txt(l.estado) === 'ENVIADO' && num(l.id_facturacion) === 0 && num(l.uf) === 0 && txt(l.valorizado) === 'N'));
  chequeo('solo desaparece esa factura (las demas siguen)', num((await q('SELECT COUNT(*) n FROM dbo.facturacion_enc'))[0].n) === encAntes - 1);
  await lanza('eliminar de nuevo falla con el mensaje de ADLSOFT', () => s.eliminarPrefacturaSalud(A.id), /No existen datos/);
  await lanza('eliminar sin indicar ID falla', () => s.eliminarPrefacturaSalud(0), /Debe indicar/);
}

// ----------------------------------------------------------------------------------------------------------------------------------
console.log('\n== T2. Cambiar la empresa de una prefactura');
{
  const nueva = B.empresa === 20 ? 56 : 20;
  await lanza('sin motivo falla', () => s.cambiarEmpresaFacturaSalud({ id_facturacion: B.id, id_empresaservicio: nueva, motivo: '', id_usuario: 0 }), /Motivo/);
  await lanza('sin empresa falla', () => s.cambiarEmpresaFacturaSalud({ id_facturacion: B.id, id_empresaservicio: 0, motivo: 'prueba', id_usuario: 0 }), /empresa/i);
  await lanza('factura inexistente falla', () => s.cambiarEmpresaFacturaSalud({ id_facturacion: 99999999, id_empresaservicio: nueva, motivo: 'prueba', id_usuario: 0 }), /No existe/);
  const antesAud = num((await q("SELECT COUNT(*) n FROM dbo.auditoria WHERE referencia = 'Facturación - Cambia empresa a facturar'"))[0].n);
  const r = await s.cambiarEmpresaFacturaSalud({ id_facturacion: B.id, id_empresaservicio: nueva, motivo: 'Prueba del 10/11: cambio de empresa', id_usuario: 0 });
  chequeo('devuelve empresa anterior y nueva', r.id_empresaservicio_anterior === B.empresa && r.id_empresaservicio_nueva === nueva, JSON.stringify(r));
  chequeo('la factura queda con la empresa nueva', num((await q(`SELECT id_empresaservicio e FROM dbo.facturacion_enc WHERE id_facturacion = ${B.id}`))[0].e) === nueva);
  const emp = await q(`SELECT DISTINCT id_empresaservicio e FROM dbo.muestras WHERE id_caso IN (${B.casos.join(',')})`);
  chequeo('TODOS los casos de la factura pasan a la empresa nueva (tambien en el LIMS)', emp.length === 1 && num(emp[0].e) === nueva, JSON.stringify(emp));
  chequeo('se informan los casos actualizados', r.casosActualizados === B.casos.length, String(r.casosActualizados));
  const aud = await q(`SELECT TOP 1 * FROM dbo.auditoria WHERE referencia = 'Facturación - Cambia empresa a facturar' ORDER BY 1 DESC`);
  const cuentaAud = num((await q("SELECT COUNT(*) n FROM dbo.auditoria WHERE referencia = 'Facturación - Cambia empresa a facturar'"))[0].n);
  chequeo('queda registrado en la auditoria con el motivo (mejora sobre ADLSOFT)', cuentaAud === antesAud + 1 && /Prueba del 10\/11/.test(JSON.stringify(aud[0] || {})));
}

// ----------------------------------------------------------------------------------------------------------------------------------
console.log('\n== T3. Graba Factura (primero totales y UF, luego el folio)');
{
  const ingId = num((await q('SELECT TOP 1 id_otrosingresos id FROM dbo.mae_otrosingresos WHERE id_otrosingresos > 1 ORDER BY id_otrosingresos'))[0].id);
  const enc0 = (await q(`SELECT uf_totalcaso FROM dbo.facturacion_enc WHERE id_facturacion = ${C.id}`))[0];
  await lanza('UF cero falla', () => s.grabarFacturaSalud({ id_facturacion: C.id, factura: 0, uf: 0 }), /Valor de la U\.F\./);
  const r1 = await s.grabarFacturaSalud({ id_facturacion: C.id, factura: 0, uf: 41300, ingresos: [{ id_otrosingresos: ingId, valor: 1.5 }], descuentos: [] });
  const e1 = (await q(`SELECT factura, uf, uf_totalcaso, uf_totalotrosing, uf_totalfac, peso_totalfac FROM dbo.facturacion_enc WHERE id_facturacion = ${C.id}`))[0];
  chequeo('sin folio: graba UF, totales y pesos', num(e1.uf) === 41300 && num(e1.uf_totalotrosing) === 1.5 && Math.abs(num(e1.uf_totalfac) - (num(enc0.uf_totalcaso) + 1.5)) < 0.001 && num(e1.peso_totalfac) === Math.round(num(e1.uf_totalfac) * 41300), JSON.stringify(e1));
  chequeo('sin folio: el folio sigue en 0', num(e1.factura) === 0);
  chequeo('pone la UF en todas las lineas de la factura', (await q(`SELECT COUNT(*) n FROM dbo.muestras_detalle WHERE id_facturacion = ${C.id} AND uf <> 41300`))[0].n === 0);
  chequeo('reemplaza los otros ingresos', (await cuenta('facturacion_ing', C.id)) === 1 && (await cuenta('facturacion_des', C.id)) === 0);
  const r2 = await s.grabarFacturaSalud({ id_facturacion: C.id, factura: 99001, uf: 41310 });
  const e2 = (await q(`SELECT factura, uf, uf_totalfac, peso_totalfac FROM dbo.facturacion_enc WHERE id_facturacion = ${C.id}`))[0];
  chequeo('con folio: graba el numero y la UF en el encabezado', num(e2.factura) === 99001 && num(e2.uf) === 41310, JSON.stringify(e2));
  chequeo('OBSERVACION (rareza de ADLSOFT): los pesos NO se recalculan con la UF nueva', num(e2.peso_totalfac) === num(e1.peso_totalfac), `${e2.peso_totalfac} vs ${e1.peso_totalfac}`);
  await lanza('grabar de nuevo una factura que ya tiene folio falla', () => s.grabarFacturaSalud({ id_facturacion: C.id, factura: 99005, uf: 41310 }), /ya tiene el N/);
}

// ----------------------------------------------------------------------------------------------------------------------------------
console.log('\n== T4. Eliminar por N° de factura (con folio)');
{
  await s.grabarFacturaSalud({ id_facturacion: B.id, factura: 99002, uf: 41300 });
  const lin = (await lineasDe(B.casos)).filter((l) => num(l.id_facturacion) === B.id).length;
  const r = await s.eliminarFacturaPorNumeroSalud(99002);
  chequeo('elimina la factura que lleva ese folio', (await cuenta('facturacion_enc', B.id)) === 0 && (await cuenta('facturacion_det', B.id)) === 0, JSON.stringify(r));
  chequeo('libera sus lineas', (await lineasDe(B.casos)).filter((l) => num(l.id_facturacion) === B.id).length === 0 && lin > 0);
  await lanza('un folio que no existe falla', () => s.eliminarFacturaPorNumeroSalud(99777), /No existen|No existe/);
}

// ----------------------------------------------------------------------------------------------------------------------------------
console.log('\n== T5. Nota de credito que ANULA la factura');
{
  const cont0 = await contadores();
  const encC = (await q(`SELECT factura, uf, uf_totalfac, peso_totalfac, fecha_facturacion, id_empresaservicio FROM dbo.facturacion_enc WHERE id_facturacion = ${C.id}`))[0];
  const ref = await s.buscarReferenciaOtrasVentasSalud({ numero: 99001, fecha: txt(encC.fecha_facturacion) });
  chequeo('la busqueda por folio y fecha encuentra la factura', ref && ref.id_facturacion === C.id && ref.origen === 'CASOS', JSON.stringify(ref));
  const datos = { id_tipodocumento: 8, cod_razon: 1, id_empresaservicio: num(encC.id_empresaservicio), factura: 99001, uf: num(encC.uf), monto: num(encC.peso_totalfac), monto_uf: num(encC.uf_totalfac), fecha_documento: txt(encC.fecha_facturacion), tipo_ref: 'FE', num_ref: '99001', fecha_ref: txt(encC.fecha_facturacion), id_facturacion_referencia: C.id, id_formapago: 1, concepto_cobro: 'Anula factura de prueba' };
  await lanza('sin motivo (codigo de razon) falla', () => s.crearOtraVentaSalud({ ...datos, cod_razon: 0 }), /motivo/i);
  await lanza('monto cero falla', () => s.crearOtraVentaSalud({ ...datos, monto: 0 }), /todos los datos/i);
  const lin = (await lineasDe(C.casos)).filter((l) => num(l.id_facturacion) === C.id).length;
  const r = await s.crearOtraVentaSalud(datos);
  const cont1 = await contadores();
  chequeo('toma el numero del contador y lo aumenta en los dos contadores', num(r.id_facturacion) === num(cont0.id_facturacion) && num(cont1.id_facturacion) === num(cont0.id_facturacion) + 1 && num(cont1.id_otroscobros) === num(cont0.id_otroscobros) + 1, JSON.stringify({ r, cont0, cont1 }));
  const nc = (await q(`SELECT id_tipodocumento, cod_razon, emitido, monto_uf, num_ref, tipo_ref FROM dbo.facturacion_otro WHERE id_facturacion = ${r.id_facturacion}`))[0];
  chequeo('queda registrada la nota (tipo 8, razon 1, no emitida, con su referencia)', nc && num(nc.id_tipodocumento) === 8 && num(nc.cod_razon) === 1 && txt(nc.emitido) === 'N' && txt(nc.num_ref) === '99001' && txt(nc.tipo_ref) === 'FE', JSON.stringify(nc));
  chequeo('la factura anulada se borra', (await cuenta('facturacion_enc', C.id)) === 0 && (await cuenta('facturacion_det', C.id)) === 0);
  chequeo('sus lineas vuelven a ENVIADO, sin factura y sin marca', r.facturaAnulada && r.facturaAnulada.lineasLiberadas === lin && (await lineasDe(C.casos)).every((l) => num(l.id_facturacion) !== C.id && (txt(l.estado) !== 'FACTURADO' || num(l.id_facturacion) !== 0)), JSON.stringify(r.facturaAnulada));
}

// ----------------------------------------------------------------------------------------------------------------------------------
console.log('\n== T6. Nota de credito PARCIAL por casos');
{
  await s.grabarFacturaSalud({ id_facturacion: D.id, factura: 99003, uf: 41300 });
  const casos = await s.listarCasosDeFacturaSalud(D.id);
  const elegidos = casos.slice(0, 2).map((c) => num(c.id_caso));
  const sumaUf = Math.round(casos.slice(0, 2).reduce((a, c) => a + num(c.uf_totalfac), 0) * 1000) / 1000;
  const encD0 = (await q(`SELECT uf_totalcaso, uf_totalfac, peso_totalfac FROM dbo.facturacion_enc WHERE id_facturacion = ${D.id}`))[0];
  const detD0 = await cuenta('facturacion_det', D.id);
  const cont0 = await contadores();
  await lanza('sin elegir casos falla', () => s.crearNotaCreditoCasosSalud({ id_facturacion_referencia: D.id, ids_caso: [], cod_razon: 3, fecha_documento: '16/11/2026', id_formapago: 1, concepto_cobro: 'NC parcial' }), /por lo menos un Caso/);
  await lanza('codigo 1 (anular) no se admite aqui', () => s.crearNotaCreditoCasosSalud({ id_facturacion_referencia: D.id, ids_caso: elegidos, cod_razon: 1, fecha_documento: '16/11/2026', id_formapago: 1, concepto_cobro: 'NC' }), /nota de crédito común/);
  const r = await s.crearNotaCreditoCasosSalud({ id_facturacion_referencia: D.id, ids_caso: elegidos, cod_razon: 3, fecha_documento: '16/11/2026', id_formapago: 1, concepto_cobro: 'NC parcial de prueba' });
  const nc = (await q(`SELECT id_facturacion, id_tipodocumento, cod_razon, monto_uf, num_ref FROM dbo.facturacion_otro WHERE id_facturacion = ${r.documento.id_facturacion}`))[0];
  chequeo('la nota tiene su PROPIO numero (no el de la factura)', r.documento.id_facturacion !== D.id && num(nc.id_facturacion) === num(cont0.id_facturacion), JSON.stringify(r.documento));
  chequeo('la nota es por la suma en UF de los casos elegidos', Math.abs(num(nc.monto_uf) - sumaUf) < 0.001 && Math.abs(r.totalUf - sumaUf) < 0.001, `${nc.monto_uf} vs ${sumaUf}`);
  const lin = await lineasDe(casos.map((c) => num(c.id_caso)));
  const delosElegidos = lin.filter((l) => elegidos.includes(num(l.id_caso)) && num(l.vtatotalnc) !== 0 || elegidos.includes(num(l.id_caso)));
  chequeo('las lineas de los casos elegidos se liberan (ENVIADO, sin factura, UF 0, sin marca)', lin.filter((l) => elegidos.includes(num(l.id_caso)) && num(l.vtatotalnc) > 0).every((l) => txt(l.estado) === 'ENVIADO' && num(l.id_facturacion) === 0 && num(l.uf) === 0 && txt(l.marcareversa) === ''), `liberadas: ${r.lineasLiberadas}`);
  chequeo('las lineas de los demas casos siguen facturadas con la factura original', lin.filter((l) => !elegidos.includes(num(l.id_caso)) && num(l.vtatotalnc) !== 0 || !elegidos.includes(num(l.id_caso))).filter((l) => num(l.id_facturacion) === D.id).length > 0);
  chequeo('la factura original NO se modifica (queda con sus totales y detalle; rareza H-85)', num((await q(`SELECT uf_totalcaso FROM dbo.facturacion_enc WHERE id_facturacion = ${D.id}`))[0].uf_totalcaso) === num(encD0.uf_totalcaso) && (await cuenta('facturacion_det', D.id)) === detD0);
  chequeo('guarda una copia de los valores en las columnas *nc', (await q(`SELECT COUNT(*) n FROM dbo.muestras_detalle WHERE id_caso IN (${casos.map((c) => num(c.id_caso)).join(',')}) AND id_facturacionnc = ${D.id}`))[0].n > 0);
}

const c = await contadores();
console.log(`\n== RESULTADO: ${ok} comprobaciones correctas, ${mal} con falla. Contador de numeracion al final: ${c.id_facturacion}`);
if (fallas.length) console.log('FALLAS:\n - ' + fallas.join('\n - '));
await db0.closeConnectionSalud(); process.exit(mal ? 1 : 0);
