import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fechaDmy, eliminarFacturaPorId, eliminarFacturaPorNumero, cambiarEmpresaFactura, normalizarOc, agregarOc, eliminarOc,
  totalOcPesos, totalFacturaUf, grabarOtrosIngresosDescuentos
} from './facturacion-salud.mantencion.js';

/** Doble de `db`: registra cada sentencia y responde con filas según un patrón del texto SQL. */
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
const sentencias = (db) => db.log.map((x) => x.texto);

test('fechaDmy acepta ISO y dd/mm/yyyy y rechaza el resto', () => {
  assert.equal(fechaDmy('2026-11-09'), '09/11/2026');
  assert.equal(fechaDmy('09/11/2026'), '09/11/2026');
  assert.equal(fechaDmy('mañana'), '');
});

test('eliminar por ID: libera líneas con estado ENVIADO, uf 0 y valorizado N, borra las 4 tablas y libera guías', async () => {
  const db = fakeDb([['SELECT id_facturacion FROM dbo.facturacion_enc', [{ id_facturacion: 77 }]]]);
  const r = await eliminarFacturaPorId(db, { id_facturacion: 77 });
  const s = sentencias(db).join(' | ');
  assert.match(s, /UPDATE dbo\.muestras_detalle SET estado = 'ENVIADO', id_facturacion = 0, uf = 0, valorizado = 'N' WHERE id_facturacion = @id/);
  for (const t of ['facturacion_enc', 'facturacion_det', 'facturacion_des', 'facturacion_ing']) assert.match(s, new RegExp(`DELETE dbo\\.${t} WHERE id_facturacion = @id`));
  assert.match(s, /UPDATE Abastecimiento\.dbo\.gd_enc SET estado = 'Pendiente'/);
  assert.doesNotMatch(s, /facturacion_oc/); // igual que ADLSOFT: las OC quedan huérfanas
  assert.equal(r.id_facturacion, 77);
});

test('eliminar por ID inexistente falla sin escribir nada', async () => {
  const db = fakeDb();
  await assert.rejects(() => eliminarFacturaPorId(db, { id_facturacion: 5 }), /No existen datos para ese N° ID Facturación/);
  assert.equal(db.log.length, 1);
});

test('eliminar por número toma solo la primera factura interna, no libera guías e informa las demás', async () => {
  const db = fakeDb([
    ['WHERE factura = @f', [{ id_facturacion: 10 }, { id_facturacion: 11 }, { id_facturacion: 12 }]],
    ['SELECT id_facturacion FROM dbo.facturacion_enc WHERE id_facturacion', [{ id_facturacion: 10 }]]
  ]);
  const r = await eliminarFacturaPorNumero(db, { factura: 555 });
  assert.equal(r.id_facturacion, 10);
  assert.deepEqual(r.otrasFacturasConElMismoNumero, [11, 12]);
  assert.doesNotMatch(sentencias(db).join(' '), /gd_enc/);
});

test('cambiar empresa exige motivo y que exista la factura; actualiza encabezado, casos y auditoría', async () => {
  await assert.rejects(() => cambiarEmpresaFactura(fakeDb(), { id_facturacion: 1, id_empresaservicio_nueva: 2, motivo: '  ' }), /Motivo/);
  await assert.rejects(() => cambiarEmpresaFactura(fakeDb(), { id_facturacion: 1, id_empresaservicio_nueva: 2, motivo: 'x' }), /No existe ID Facturación/);
  const db = fakeDb([['SELECT id_facturacion, id_empresaservicio FROM dbo.facturacion_enc', [{ id_facturacion: 1, id_empresaservicio: 9 }]]]);
  const r = await cambiarEmpresaFactura(db, { id_facturacion: 1, id_empresaservicio_nueva: 2, motivo: 'Facturar a la matriz', id_usuario: 4 });
  const s = sentencias(db).join(' | ');
  assert.match(s, /UPDATE dbo\.facturacion_enc SET id_empresaservicio = @e WHERE id_facturacion = @id/);
  assert.match(s, /UPDATE m SET m\.id_empresaservicio = @e FROM dbo\.muestras m WHERE m\.id_caso IN/);
  const aud = db.log.find((x) => x.texto.includes('actualiza_auditoria'));
  assert.equal(aud.params.m, 'Facturar a la matriz');
  assert.equal(aud.params.o, '9');
  assert.equal(r.id_empresaservicio_anterior, 9);
});

test('OC: en pesos la conversión es el valor; en otra moneda se exige; valores y fecha obligatorios', () => {
  assert.deepEqual(normalizarOc({ oc: ' 4500 ', oc_fecha_emision: '2026-11-02', oc_moneda: '$', oc_valor: 1000 }),
    { oc: '4500', oc_fecha_emision: '02/11/2026', oc_moneda: '$', oc_valor: 1000, oc_conversion: 1000 });
  assert.throws(() => normalizarOc({ oc: '1', oc_fecha_emision: '2026-11-02', oc_moneda: 'U.F.', oc_valor: 10 }), /Concepto/);
  assert.equal(normalizarOc({ oc: '1', oc_fecha_emision: '02/11/2026', oc_moneda: 'U.F.', oc_valor: 10, oc_conversion: 390000 }).oc_conversion, 390000);
  assert.throws(() => normalizarOc({ oc: '', oc_fecha_emision: '02/11/2026', oc_moneda: '$', oc_valor: 5 }), /Concepto/);
  assert.throws(() => normalizarOc({ oc: '1', oc_fecha_emision: '02/11/2026', oc_moneda: 'EUR', oc_valor: 5, oc_conversion: 5 }), /Concepto/);
});

test('OC: agregar inserta y audita igual que ADLSOFT; eliminar borra por todos los campos y audita', async () => {
  const db = fakeDb();
  await agregarOc(db, { id_facturacion: 9, oc: 'A1', oc_fecha_emision: '2026-11-02', oc_moneda: '$', oc_valor: 500, id_usuario: 3, ahora: new Date(2026, 10, 9, 8, 5, 3) });
  assert.match(db.log[0].texto, /INSERT dbo\.facturacion_oc/);
  assert.equal(db.log[0].params.fecha, '09/11/2026');
  assert.equal(db.log[0].params.hora, '08:05:03');
  assert.equal(db.log[1].params.r, 'Facturación - Agrega O.Compra');
  assert.equal(db.log[1].params.c, 9); // el ID de facturación va en la columna id_caso, como en ADLSOFT
  await eliminarOc(db, { id_facturacion: 9, oc: 'A1', oc_fecha_emision: '02/11/2026', oc_moneda: '$', oc_valor: 500, oc_conversion: 500 });
  assert.match(db.log[2].texto, /DELETE dbo\.facturacion_oc WHERE id_facturacion = @id AND oc = @oc AND oc_fecha_emision = @fe AND oc_moneda = @mo AND oc_valor = @va AND oc_conversion = @co/);
  assert.equal(db.log[3].params.t, 'ELIMINA');
});

test('totales: OC en pesos suma conversión; factura = casos + ingresos − descuentos', () => {
  assert.equal(totalOcPesos([{ oc_conversion: 100 }, { oc_conversion: 250.5 }]), 350.5);
  assert.equal(totalFacturaUf({ uf_totalcaso: 10, ingresos: [{ valor: 2 }], descuentos: [{ valor: 0.5 }, { valor: 1 }] }), 10.5);
});

test('OI/OD: recalcula el total, reemplaza filas y deja una fila en cero cuando no hay', async () => {
  const db = fakeDb([['SELECT uf_totalcaso, mf', [{ uf_totalcaso: 20, mf: 1 }]]]);
  const r = await grabarOtrosIngresosDescuentos(db, { facturas: [{ id_facturacion: 5, ingresos: [{ id_otrosingresos: 3, valor: 1.5 }], descuentos: [] }] });
  assert.deepEqual(r, [{ id_facturacion: 5, uf_totalotrosing: 1.5, uf_totalotrosdes: 0, uf_totalfac: 21.5 }]);
  const s = sentencias(db).join(' | ');
  assert.match(s, /DELETE dbo\.facturacion_ing WHERE id_facturacion = @id; DELETE dbo\.facturacion_des WHERE id_facturacion = @id/);
  const insDes = db.log.find((x) => x.texto.includes('INSERT dbo.facturacion_des'));
  assert.deepEqual([insDes.params.c, insDes.params.v], [0, 0]);
});

test('OI/OD: rechaza concepto sin valor y facturas que ya no están en creación', async () => {
  const enCreacion = fakeDb([['SELECT uf_totalcaso, mf', [{ uf_totalcaso: 1, mf: 1 }]]]);
  await assert.rejects(() => grabarOtrosIngresosDescuentos(enCreacion, { facturas: [{ id_facturacion: 1, ingresos: [{ id_otrosingresos: 3, valor: 0 }] }] }), /Concepto/);
  const cerrada = fakeDb([['SELECT uf_totalcaso, mf', [{ uf_totalcaso: 1, mf: 3 }]]]);
  await assert.rejects(() => grabarOtrosIngresosDescuentos(cerrada, { facturas: [{ id_facturacion: 1 }] }), /ya no está en creación/);
});
