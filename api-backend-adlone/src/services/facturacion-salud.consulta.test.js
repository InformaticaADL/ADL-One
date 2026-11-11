import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describirFacturadoPor, tituloFactura, totalesFactura, consultarFacturaPorId, consultarFacturaPorFolio, grabarFactura, asociarGuias,
  netoGuiasUf, calcularNetoGuias, reservarGuias, liberarGuiasDeFactura, plegarDatosResumen, filasResumen, filasDetalle, columnasExcelDetalle,
  listarGuiasPendientes, datosExcelDetalle
} from './facturacion-salud.consulta.js';

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

const enc = {
  id_facturacion: 77, factura: 0, id_empresaservicio: 12, uf: 38000, usd: 0, uf_totalcaso: 10.005, mes: 'AGOSTO 2026', sigla: 'LSF',
  sigla_programa: 'PVA', fecha_facturacion: '31/08/2026'
};

test('facturado por: el valor depende del tipo', () => {
  assert.deepEqual(describirFacturadoPor({ facturado_por: 'Centro - Veterinario', centro: 'C1', veterinario: 'V1' }), { facturado_por: 'Centro - Veterinario', valor: 'C1 - V1' });
  assert.deepEqual(describirFacturadoPor({ facturado_por: 'Tipo de Agua', tipoagua: 'Mar' }), { facturado_por: 'Tipo de Agua', valor: 'Mar' });
  assert.deepEqual(describirFacturadoPor(undefined), { facturado_por: '', valor: '' });
});

test('título de los PDF: 3 letras del mes, ID, sigla de la empresa y del programa', () => {
  assert.equal(tituloFactura(enc), 'AGO ID77 LSF PVA');
});

test('totales: se redondea cada parte a 2 decimales y el total sale de las sumas sin redondear', () => {
  const t = totalesFactura({ uf_totalcaso: 10.005, ingresos: [{ valor: 1.004 }, { valor: 0.004 }], descuentos: [{ valor: 0.5 }] });
  assert.deepEqual(t, { uf_totalcaso: 10.01, uf_totalotrosing: 1.01, uf_totalotrosdes: 0.5, uf_totalfac: 10.51 });
});

test('consulta por ID: arma la ficha y los indicadores', async () => {
  const db = fakeDb([
    ['fac_consulta_una_factura_enc', [{ ...enc, id_empresaservicio: 500, usd: 950 }]],
    ['fac_consulta_una_factura_ing', [{ valor: 2 }]],
    ['fac_consulta_una_factura_des', [{ valor: 0.5 }]],
    ['fac_excel_detalle', [{ facturado_por: 'Centro', centro: 'C1', uf_tot: 4.123 }, { uf_tot: 1.001 }]],
    ['consulta_facturacion_ocompra', [{ ocompra: '9' }]]
  ]);
  const f = await consultarFacturaPorId(db, { id_facturacion: 77 });
  assert.equal(f.titulo, 'AGO ID77 LSF PVA C1'); // con el centro al final, como lo escribe el personal
  assert.equal(f.editable, true);
  assert.equal(f.llevaDolar, true);
  assert.equal(f.totalDetalleUf, 5.12);
  assert.equal(f.valor, 'C1');
  assert.equal(f.totalOtrosIngresos, 2);
  assert.equal(f.ordenes.length, 1);
  await assert.rejects(() => consultarFacturaPorId(fakeDb(), { id_facturacion: 1 }), /No existen datos/);
});

test('consulta por folio: toma la primera factura interna e informa las otras', async () => {
  const db = fakeDb([['fac_consulta_una_factura_enc_factura', [{ ...enc, factura: 555 }, { ...enc, id_facturacion: 78, factura: 555 }, { ...enc, id_facturacion: 78, factura: 555 }]]]);
  const f = await consultarFacturaPorFolio(db, { factura: 555 });
  assert.equal(f.encabezado.id_facturacion, 77);
  assert.deepEqual(f.otrasFacturasConElMismoFolio, [78]);
  assert.equal(f.editable, false); // con folio no se edita
});

test('grabar sin folio: totales, pesos, UF en las líneas, reemplazo de ingresos/descuentos y guías', async () => {
  const db = fakeDb([['fac_consulta_una_factura_enc', [enc]]]);
  const r = await grabarFactura(db, {
    id_facturacion: 77, factura: 0, uf: 38000, ingresos: [{ id_otrosingresos: 4, valor: 2 }], descuentos: []
  });
  assert.equal(r.modo, 'totales');
  assert.equal(r.uf_totalfac, 12.01);
  assert.equal(r.peso_totalfac, 456380); // ROUND(ROUND(12,01, 2) × 38000, 0)
  const s = sentencias(db);
  assert.match(s, /UPDATE dbo\.facturacion_enc SET factura = @f, uf_totalcaso = @c, uf_totalotrosing = @i, uf_totalotrosdes = @d, uf_totalfac = @t, peso_totalfac = @p, uf = @uf, usd_totalfac = @usd WHERE id_facturacion = @id/);
  assert.match(s, /UPDATE dbo\.muestras_detalle SET uf = @uf WHERE id_facturacion = @id/);
  assert.match(s, /DELETE dbo\.facturacion_ing WHERE id_facturacion = @id; DELETE dbo\.facturacion_des WHERE id_facturacion = @id/);
  assert.equal(db.log.filter((x) => x.texto.startsWith('INSERT dbo.facturacion_ing')).length, 1);
  assert.equal(db.log.filter((x) => x.texto.startsWith('INSERT dbo.facturacion_des')).length, 0); // sin placeholder en cero
  const g = db.log.find((x) => x.texto.includes('Abastecimiento.dbo.gd_enc'));
  assert.equal(g.params.f, 0); // las guías quedan con N° 0: H-60
});

test('grabar empresa 500: total en dólares; sin USD no se puede', async () => {
  const db = fakeDb([['fac_consulta_una_factura_enc', [{ ...enc, id_empresaservicio: 500, usd: 950, uf_totalcaso: 10 }]]]);
  const r = await grabarFactura(db, { id_facturacion: 77, factura: 0, uf: 38000 });
  assert.equal(r.usd_totalfac, 380000 / 950);
  await assert.rejects(() => grabarFactura(fakeDb([['fac_consulta_una_factura_enc', [{ ...enc, id_empresaservicio: 500, usd: 0 }]]]), { id_facturacion: 77, uf: 38000 }), /USD/);
});

test('grabar con folio: solo número y UF, y las guías reservadas reciben el número', async () => {
  const db = fakeDb([['fac_consulta_una_factura_enc', [enc]]]);
  const r = await grabarFactura(db, { id_facturacion: 77, factura: 1234, uf: 38100 });
  assert.equal(r.modo, 'folio');
  const s = sentencias(db);
  assert.match(s, /UPDATE dbo\.facturacion_enc SET factura = @f, uf = @uf WHERE id_facturacion = @id/);
  assert.doesNotMatch(s, /muestras_detalle|peso_totalfac/); // no actualiza las líneas ni los pesos (H-63)
  assert.equal(db.log.find((x) => x.texto.includes('gd_enc')).params.f, 1234);
});

test('grabar: rechaza facturas con folio, sin UF o sin ID', async () => {
  await assert.rejects(() => grabarFactura(fakeDb([['fac_consulta_una_factura_enc', [{ ...enc, factura: 9 }]]]), { id_facturacion: 77, uf: 1, factura: 5 }), /ya tiene el N° de factura 9/);
  await assert.rejects(() => grabarFactura(fakeDb([['fac_consulta_una_factura_enc', [enc]]]), { id_facturacion: 77, uf: 0 }), /U\.F\./);
  await assert.rejects(() => grabarFactura(fakeDb(), { id_facturacion: 0 }), /No puedes grabar nada/);
});

test('guías: el neto en UF convierte pesos, deja UF y descarta dólares', () => {
  assert.equal(netoGuiasUf([{ id_moneda: 1, tneto: 38000 }, { id_moneda: 3, tneto: 2.5 }, { id_moneda: 2, tneto: 999 }], 38000), 3.5);
});

test('guías: calcular no escribe; reservar marca y devuelve la línea de otros ingresos (concepto 4)', async () => {
  const db = fakeDb([['gd_det', [{ id_gd: 1, item: 1, id_moneda: 1, tneto: 76000 }]]]);
  await assert.rejects(() => calcularNetoGuias(db, { ids_gd: [1], uf: 0 }), /U\.F\./);
  const calc = await calcularNetoGuias(db, { ids_gd: [1], uf: 38000 });
  assert.equal(calc.netoUf, 2);
  assert.equal(db.log.filter((x) => x.texto.startsWith('UPDATE')).length, 0);
  const r = await reservarGuias(db, { ids_gd: [1, 2], uf: 38000, id_facturacion: 77 });
  assert.deepEqual([r.id_otrosingresos, r.nombre_otrosingresos], [4, 'Guías de despachos por materiales']);
  assert.equal(db.log.filter((x) => x.texto.startsWith('UPDATE Abastecimiento.dbo.gd_enc SET marca = 1')).length, 2);
});

test('guías: asociar toma todas las reservadas de la empresa; liberar vuelve todas las de la factura a pendiente', async () => {
  const db = fakeDb();
  await asociarGuias(db, { id_empresaservicio: 12, id_facturacion: 77, factura: 0, fecha_facturacion: '31/08/2026', uf: 38000 });
  assert.match(db.log[0].texto, /WHERE id_empresaservicio = @e AND marca = 1 AND factura = 0 AND estado = 'Pendiente'/);
  await liberarGuiasDeFactura(db, { id_facturacion: 77 });
  assert.match(db.log[1].texto, /SET estado = 'Pendiente', id_facturacion = 0, fecha_factura = ' \/ \/ ', marca = 0, uf = 0 WHERE id_facturacion = @id/);
  const g = await listarGuiasPendientes(fakeDb([['fac_guiasdespachoclientes', [{ id_gd: 5 }]]]), { id_empresaservicio: 12 });
  assert.equal(g.length, 1);
});

test('Excel: los datos del resumen se reubican según por qué se factura y los pesos no se redondean', () => {
  assert.deepEqual(plegarDatosResumen({ facturado_por: 'Veterinario', dato1: 'C', dato2: 'V', dato3: 'A' }), { facturado_por: 'Veterinario', dato1: 'V', dato2: '', dato3: '' });
  assert.deepEqual(plegarDatosResumen({ facturado_por: 'Tipo de Agua', dato1: 'C', dato2: 'V', dato3: 'A' }), { facturado_por: 'Tipo de Agua', dato1: 'A', dato2: '', dato3: '' });
  assert.equal(plegarDatosResumen({ facturado_por: 'Centro - Veterinario', dato1: 'C', dato2: 'V', dato3: 'A' }).dato3, '');
  const [f] = filasResumen([{ facturado_por: 'Centro', uf_total: 1.2345, valor_uf: 38000 }]);
  assert.equal(f.pesos_total, 1.2345 * 38000);
  assert.equal(filasResumen([{ facturado_por: 'Centro', uf_total: 1.2345, valor_uf: 38001 }], { redondearPesos: true })[0].pesos_total, 46912.23);
  assert.equal(filasDetalle([{ uf_tot: 2, uf_valor: 100 }])[0].pesos_total, 200);
});

test('Excel de detalle: columnas con lote y con dólar para la empresa 500', async () => {
  assert.ok(columnasExcelDetalle({ lote: true }).includes('lote'));
  assert.ok(!columnasExcelDetalle().includes('usd_valor'));
  const d = await datosExcelDetalle(fakeDb([['fac_excel_detalle_lote', [{ id_empresaservicio: 500, uf_tot: 1, uf_valor: 2 }]]]), { id_facturacion: 1, lote: true });
  assert.ok(d.columnas.includes('usd_valor') && d.columnas.includes('lote'));
});

test('nombre de los PDF igual al que escribe el personal en ADLSOFT (muestras reales de octubre de 2026)', () => {
  // facturada por centro: lleva el folio y el centro sin la palabra «Piscicultura» ni tildes
  assert.equal(
    tituloFactura({ mes: 'OCTUBRE 2026', factura: 31873, id_facturacion: 74389, sigla: 'AQUAGEN', sigla_programa: 'SCR' }, { facturado_por: 'Centro', centro: 'Piscicultura Río Ignao', veterinario: 'Sebastián Pérez' }),
    'OCT FACTURA 31873 ID74389 AQUAGEN SCR RIO IGNAO'
  );
  // prefactura sin folio, por veterinario: inicial y apellido, conservando la Ñ
  assert.equal(
    tituloFactura({ mes: 'OCTUBRE 2026', factura: 0, id_facturacion: 74398, sigla: 'S.BLUMAR', sigla_programa: 'SDG' }, { facturado_por: 'Veterinario', centro: 'Elena Norte', veterinario: 'Pedo Acuña' }),
    'OCT ID74398 S.BLUMAR SDG PACUÑA'
  );
  // «Na»: se usa el centro
  assert.equal(
    tituloFactura({ mes: 'JUNIO 2026', factura: 30632, id_facturacion: 72325, sigla: 'NALCAHUE', sigla_programa: 'MAM' }, { facturado_por: 'Na', centro: 'Chesque Alto', veterinario: 'Guillermo Zelada' }),
    'JUN FACTURA 30632 ID72325 NALCAHUE MAM CHESQUE ALTO'
  );
});
