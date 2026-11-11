import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validarDocumento, crearDocumento, buscarFacturaReferencia, listarDocumentos, asignarNumeroDocumento, cambiarFechaDocumento, cambiarUfDocumento,
  cambiarMontoUfDocumento, cambiarGlosaDocumento, filasDteDocumento, nombreArchivoOtros, exportarDocumentos, montoEnPesos, FLUJOS
} from './facturacion-salud.otrasventas.js';

function fakeDb(respuestas = []) {
  const log = [];
  return {
    log,
    request() {
      const params = {};
      const req = {
        input(n, _t, v) { params[n] = v; return req; },
        async query(texto) {
          log.push({ texto: texto.replace(/\s+/g, ' ').trim(), params: { ...params } });
          const r = respuestas.find(([patron]) => texto.includes(patron));
          return { recordset: r ? r[1] : [], rowsAffected: [r && r[2] !== undefined ? r[2] : 1] };
        }
      };
      return req;
    }
  };
}
const sentencias = (db) => db.log.map((x) => x.texto).join(' | ');

const doc = {
  id_facturacion: 74606, id_otroscobros: 2483, id_tipodocumento: 1, id_empresaservicio: 12, rut_empresaservicios: '77431760-0', nombre_empresaservicios: 'Cliente SpA',
  fecha_documento: '30/10/2026', concepto_cobro: 'Arriendo', monto: 453666, monto_uf: 11, uf: 41242.32, id_formapago: 1, nombre_formapago: '30 días',
  direccion_comercial: 'Calle 1', id_direccion: 3, id_giro: 4, id_ciudad: 5, nombre_ciudad: 'Puerto Montt', id_comunaef: 6, nombre_comunaef: 'Puerto Montt', nombre_giro: 'Giro',
  tipo_ref: 'FE', num_ref: '31981', fecha_ref: '29/10/2026', cod_razon: 1, motivo: 'Anula factura', observacion: '', nota: '', tipoimpuesto: 'FEA'
};

test('validación: tipo y monto; empresa; motivo en notas', () => {
  assert.throws(() => validarDocumento({ id_tipodocumento: 1, monto: 0, id_empresaservicio: 1 }), /datos Solicitados/);
  assert.throws(() => validarDocumento({ id_tipodocumento: 3, monto: 5, id_empresaservicio: 1 }), /datos Solicitados/);
  assert.throws(() => validarDocumento({ id_tipodocumento: 1, monto: 5 }), /empresa/);
  assert.throws(() => validarDocumento({ id_tipodocumento: 8, monto: 5, id_empresaservicio: 1 }), /motivo/);
  assert.deepEqual(validarDocumento({ id_tipodocumento: 8, monto: 5, id_empresaservicio: 1, cod_razon: 2 }), { tipo: 8, esNota: true, codRazon: 2, tipoImpuesto: 'FEA' });
  assert.equal(validarDocumento({ id_tipodocumento: 1, monto: 5, id_empresaservicio: 1, cod_razon: 3, tipoimpuesto: 'FEE' }).codRazon, 0);
});

test('crear: usa y aumenta los contadores, inserta con emitido N y guarda las OC sin tipo ni orden', async () => {
  const db = fakeDb([['FROM dbo.mae_id', [{ id_facturacion: 74907, id_otroscobros: 2487 }]]]);
  const r = await crearDocumento(db, {
    id_tipodocumento: 1, id_empresaservicio: 12, monto: 453666, monto_uf: 11, uf: 41242.32, fecha_documento: '2026-10-30', concepto_cobro: 'Arriendo', id_formapago: 1,
    ordenes_compra: [{ ocompra: '4500', fecha: '2026-10-01', referencia: 'r' }, { ocompra: '' }]
  });
  assert.deepEqual([r.id_facturacion, r.id_otroscobros, r.tipo], [74907, 2487, 'FE']);
  const s = sentencias(db);
  assert.match(s, /SELECT id_facturacion, id_otroscobros FROM dbo\.mae_id WITH \(UPDLOCK, HOLDLOCK\)/);
  assert.match(s, /UPDATE dbo\.mae_id SET id_facturacion = id_facturacion \+ 1, id_otroscobros = id_otroscobros \+ 1/);
  const ins = db.log.find((x) => x.texto.startsWith('INSERT dbo.facturacion_otro'));
  assert.equal(ins.params.fd, '30/10/2026');
  assert.match(ins.texto, /'N', @ti, @fp\)/);
  const oc = db.log.filter((x) => x.texto.startsWith('INSERT dbo.facturacion_ocompra'));
  assert.equal(oc.length, 1);
  assert.doesNotMatch(oc[0].texto, /tipo|orden/);
});

test('nota de crédito que anula: borra la factura encontrada en la referencia y devuelve sus líneas (como ADLSOFT, sea de casos o de otra venta)', async () => {
  const base = { id_tipodocumento: 8, cod_razon: 1, id_empresaservicio: 12, monto: 100, id_facturacion_referencia: 555 };
  const conCasos = fakeDb([['FROM dbo.mae_id', [{ id_facturacion: 1, id_otroscobros: 1 }]]]);
  const r = await crearDocumento(conCasos, { ...base, origen_referencia: 'CASOS' });
  assert.deepEqual(r.facturaAnulada, { id_facturacion: 555, lineasLiberadas: 1 });
  assert.match(sentencias(conCasos), /DELETE dbo\.facturacion_enc WHERE id_facturacion = @id; DELETE dbo\.facturacion_det WHERE id_facturacion = @id/);
  assert.match(sentencias(conCasos), /UPDATE dbo\.muestras_detalle SET id_facturacion = 0, estado = 'ENVIADO', mf = 0 WHERE id_facturacion = @id/);
  const deOtra = fakeDb([['FROM dbo.mae_id', [{ id_facturacion: 1, id_otroscobros: 1 }]]]);
  const r2 = await crearDocumento(deOtra, { ...base, origen_referencia: 'OTRAS_VENTAS' });
  assert.deepEqual(r2.facturaAnulada, { id_facturacion: 555, lineasLiberadas: 1 });
  const sinReferencia = fakeDb([['FROM dbo.mae_id', [{ id_facturacion: 1, id_otroscobros: 1 }]]]);
  assert.equal((await crearDocumento(sinReferencia, { ...base, id_facturacion_referencia: 0 })).facturaAnulada, null);
  await assert.rejects(() => crearDocumento(fakeDb(), { id_tipodocumento: 1, id_empresaservicio: 1, monto: 1 }), /Mae_id/);
});

test('referencia: afecta busca en casos y luego en otras ventas; exenta solo en otras ventas', async () => {
  const casos = fakeDb([['consulta_facturacion_otros_factura @', [{ id_facturacion: 9, id_empresaservicio: 3, nombre_empresaservicios: 'X', uf: 1, peso_totalfac: 2, uf_totalfac: 3, fecha_facturacion: '01/10/2026' }]]]);
  const a = await buscarFacturaReferencia(casos, { numero: 100, fecha: '2026-10-01' });
  assert.deepEqual([a.origen, a.id_facturacion, a.tipo_ref, a.num_ref], ['CASOS', 9, 'FE', '100']);
  const solo = fakeDb([['consulta_facturacion_otros_factura_otrasventas', [{ id_facturacion: 7 }]]]);
  const b = await buscarFacturaReferencia(solo, { numero: 100, fecha: '01/10/2026', tipoImpuesto: 'FEE' });
  assert.equal(b.origen, 'OTRAS_VENTAS');
  assert.equal(solo.log.length, 1);
  assert.equal(await buscarFacturaReferencia(fakeDb(), { numero: 1, fecha: '01/01/2026' }), null);
});

test('mantención: número, fecha, glosa, UF y monto en UF', async () => {
  const db = fakeDb([['SELECT monto_uf', [{ monto_uf: 11 }]], ['SELECT uf FROM', [{ uf: 40000 }]]]);
  await assert.rejects(() => asignarNumeroDocumento(db, { id_otroscobros: 1, numero_documento: 0 }), /N° del Documento/);
  await asignarNumeroDocumento(db, { id_otroscobros: 1, numero_documento: 31990 });
  await assert.rejects(() => cambiarFechaDocumento(db, { id_otroscobros: 1, fecha: '' }), /Fecha/);
  await assert.rejects(() => cambiarGlosaDocumento(db, { id_otroscobros: 1, concepto: ' ' }), /Glosa/);
  await cambiarUfDocumento(db, { id_otroscobros: 1, uf: 41000 });
  const uf = db.log.filter((x) => x.texto.startsWith('UPDATE dbo.facturacion_otro SET uf'))[0];
  assert.equal(uf.params.monto, 11 * 41000);
  await cambiarMontoUfDocumento(db, { id_otroscobros: 1, monto_uf: 12 });
  const mu = db.log.filter((x) => x.texto.startsWith('UPDATE dbo.facturacion_otro SET monto_uf'))[0];
  assert.equal(mu.params.monto, 12 * 40000);
  await assert.rejects(() => cambiarUfDocumento(db, { id_otroscobros: 1, uf: 0 }), /Valor UF/);
  assert.equal(montoEnPesos(1.5, 1000), 1500);
});

test('listado: solo emitidos o no emitidos según el filtro', async () => {
  const db = fakeDb([['consulta_facturacion_otros', [{ emitido: 'N' }, { emitido: 'S' }, { emitido: 'N ' }]]]);
  assert.equal((await listarDocumentos(db)).length, 2);
  assert.equal((await listarDocumentos(db, { estado: 'Emitidos' })).length, 1);
  assert.equal((await listarDocumentos(db, { estado: 'Todos' })).length, 3);
});

test('archivo FE de otras ventas: IVA 19 % sobre el monto; las OC repiten el total y usan su propio tipo', () => {
  const filas = filasDteDocumento('FEA', doc, [{ tipo: 'OC', ocompra: '9', ocompra_fecha: '01/10/2026', referencia: 'r' }, { tipo: '', ocompra: '10' }]);
  assert.equal(filas.length, 3);
  assert.deepEqual([filas[0].n_td, filas[0].neto, filas[0].totaldoc, filas[0].claseserv, filas[0].detalle, filas[0].tipo_ref], ['FE', 453666, 539863, 'OTRAS VENTAS', 'Arriendo', '']);
  assert.deepEqual([filas[1].totaldoc, filas[1].cantidad, filas[1].neto, filas[1].tipo_ref], [539863, 0, 0, 'OC']);
  assert.equal(filas[2].tipo_ref, ''); // OC guardada sin tipo (H-80)
});

test('archivo FEE: sin IVA, referencias del documento y OC siempre como "OC"', () => {
  const filas = filasDteDocumento('FEE', { ...doc, id_tipodocumento: 11 }, [{ tipo: 'HES', ocompra: '9' }]);
  assert.deepEqual([filas[0].n_td, filas[0].totaldoc, filas[0].neto, filas[0].tipo_ref, filas[0].num_ref, filas[0].cod_razon], ['FEE', 453666, 453666, 'FE', '31981', 1]);
  assert.equal(filas[1].tipo_ref, 'OC');
});

test('archivo NCE: AFE con IVA o EXE sin IVA, y motivo con " . " aunque no haya observación', () => {
  const afecta = filasDteDocumento('NCE', { ...doc, id_tipodocumento: 8 })[0];
  assert.deepEqual([afecta.n_td, afecta.ocompra, afecta.neto, afecta.totaldoc, afecta.motivo], ['NCE', 'AFE', 453666, 539863, 'Anula factura . ']);
  const exenta = filasDteDocumento('NCE', { ...doc, id_tipodocumento: 8, tipoimpuesto: 'FEE' })[0];
  assert.deepEqual([exenta.ocompra, exenta.totaldoc], ['EXE', 453666]);
  assert.equal(filasDteDocumento('NCE', doc).length, 1); // las notas no llevan filas de OC aunque existan
});

test('archivo NDE: siempre EXE y sin IVA', () => {
  const f = filasDteDocumento('NDE', { ...doc, id_tipodocumento: 10, tipoimpuesto: 'FEA' })[0];
  assert.deepEqual([f.n_td, f.ocompra, f.totaldoc, f.neto, f.motivo], ['NDE', 'EXE', 453666, 453666, 'Anula factura']);
  assert.throws(() => filasDteDocumento('XX', doc), /desconocido/);
});

test('exportar: nombre de archivo por flujo, marca emitido por ID y rechaza documentos de otro tipo', async () => {
  assert.equal(nombreArchivoOtros('NCE', [1, 2]), 'NCE_1_2.TXT');
  assert.equal(nombreArchivoOtros('FEA', [7]), 'FE_OTRASVENTAS_7.TXT');
  const db = fakeDb([[FLUJOS.NCE.sp, [{ ...doc, id_tipodocumento: 8 }, { ...doc, id_facturacion: 9, id_tipodocumento: 1 }]]]);
  const r = await exportarDocumentos(db, { flujo: 'NCE', ids_facturacion: [74606] });
  assert.deepEqual([r.documentos, r.nombreArchivo], [1, 'NCE_74606.TXT']);
  assert.equal(db.log.filter((x) => x.texto.startsWith("UPDATE dbo.facturacion_otro SET emitido = 'S' WHERE id_facturacion = @id")).length, 1);
  assert.equal(db.log.filter((x) => x.texto.includes('consulta_facturacion_ocompra')).length, 0); // notas sin OC
  await assert.rejects(() => exportarDocumentos(db, { flujo: 'NCE', ids_facturacion: [9] }), /no están disponibles/);
  await assert.rejects(() => exportarDocumentos(db, { flujo: 'NCE', ids_facturacion: [] }), /al menos un documento/);
  await assert.rejects(() => exportarDocumentos(db, { flujo: 'ZZ', ids_facturacion: [1] }), /desconocido/);
});

test('nota de crédito por casos: marca, crea la nota por la suma, copia las líneas y libera solo las marcadas', async () => {
  const { crearNotaCreditoPorCasos, listarCasosDeFactura } = await import('./facturacion-salud.otrasventas.js');
  const casos = [{ id_caso: 1, uf_totalfac: 2.5 }, { id_caso: 2, uf_totalfac: 1.25 }, { id_caso: 3, uf_totalfac: 9 }];
  const db = fakeDb([
    ['fac_reversa_casos_factura', casos],
    ['SELECT factura, id_empresaservicio', [{ factura: 777, id_empresaservicio: 12, uf: 40000, fecha_facturacion: '01/10/2026' }]],
    ['FROM dbo.mae_id', [{ id_facturacion: 5000, id_otroscobros: 90 }]]
  ]);
  assert.equal((await listarCasosDeFactura(db, { id_facturacion: 10 })).length, 3);
  const r = await crearNotaCreditoPorCasos(db, { id_facturacion_referencia: 10, ids_caso: [1, 2], concepto_cobro: 'Casos mal facturados', id_formapago: 1, fecha_documento: '2026-11-02' });
  assert.equal(r.totalUf, 3.75);
  assert.deepEqual(r.casos, [1, 2]);
  assert.equal(r.documento.id_facturacion, 5000); // ID propio, no el de la factura
  const s = sentencias(db);
  assert.equal(db.log.filter((x) => x.texto.includes("SET marcareversa = 'S'")).length, 2);
  const ins = db.log.find((x) => x.texto.startsWith('INSERT dbo.facturacion_otro'));
  assert.deepEqual([ins.params.td, ins.params.cr, ins.params.fac, ins.params.tr, ins.params.nr, ins.params.muf, ins.params.monto], [8, 3, 777, 'FE', '777', 3.75, 150000]);
  assert.ok(s.indexOf('id_facturacionnc = id_facturacion') > s.indexOf('INSERT dbo.facturacion_otro'));
  assert.match(s, /SET marcareversa = '', estado = 'ENVIADO', id_facturacion = 0, uf = 0 WHERE id_facturacion = @id AND marcareversa = 'S'/);
  assert.doesNotMatch(s, /DELETE/);
  await assert.rejects(() => crearNotaCreditoPorCasos(db, { id_facturacion_referencia: 10, ids_caso: [] }), /por lo menos un Caso/);
  await assert.rejects(() => crearNotaCreditoPorCasos(db, { id_facturacion_referencia: 10, ids_caso: [1], cod_razon: 1 }), /nota de crédito común/);
});
