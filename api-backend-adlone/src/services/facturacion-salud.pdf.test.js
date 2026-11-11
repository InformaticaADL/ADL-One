import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { datosFacturadoPor, armarDatosResumen, crearPdfResumen, nombreArchivoResumen, nombreSeguro, subcarpetaDe, guardarPdf } from './facturacion-salud.pdf.js';

const fila = {
  id_facturacion: 74900, factura: 32021, empresa: 'SALMONES BLUMAR MAGALLANES SPA', fecha: '30/10/2026', uf_ingresos: 1, uf_descuentos: 0.5, uf_caso: 10.005, uf_total: 10.505,
  valor_uf: 41242.32, facturado_por: 'Centro - Veterinario', programa: 'Medio Ambiente', dato1: 'Centro 1', dato2: 'Dra. Pérez', dato3: 'Mar', id_empresaservicio: 664
};

test('facturado por: los datos se reubican según el tipo', () => {
  assert.equal(datosFacturadoPor(fila).texto, 'Centro - Veterinario( Centro 1   Dra. Pérez )');
  assert.equal(datosFacturadoPor({ ...fila, facturado_por: 'Veterinario' }).detalle, 'Dra. Pérez');
  assert.equal(datosFacturadoPor({ ...fila, facturado_por: 'Tipo de Agua' }).detalle, 'Mar');
  assert.equal(datosFacturadoPor({ ...fila, facturado_por: 'Centro' }).detalle, 'Centro 1');
});

test('datos del resumen: primera fila, UF a 2 decimales, pesos del total redondeado y conceptos reales', () => {
  const d = armarDatosResumen({
    resumen: [fila, { ...fila, factura: 1 }],
    ingresos: [{ id_otrosingresos: 4, nombre_otrosingresos: 'Guías de despachos por materiales', valor: 1 }, { id_otrosingresos: 0, nombre_otrosingresos: '', valor: 0 }],
    descuentos: []
  });
  assert.equal(d.factura, 32021);
  assert.equal(d.ufTotal, 10.51);
  assert.equal(d.pesosTotal, Math.round(10.51 * 41242.32));
  assert.equal(d.ingresos.length, 1); // la fila en cero de ADLSOFT no se imprime
  assert.equal(d.llevaDolar, false);
  assert.equal(armarDatosResumen({ resumen: [{ ...fila, id_empresaservicio: 500, usd_total: 100.456, valor_usd: 950 }] }).llevaDolar, true);
  assert.throws(() => armarDatosResumen({ resumen: [] }), /no tiene datos/);
});

test('el PDF se genera con varias páginas si hay muchos conceptos', async () => {
  const pocos = await crearPdfResumen(armarDatosResumen({ resumen: [fila] }), { ahora: new Date(2026, 10, 10, 9, 5, 3) });
  assert.equal(pocos.subarray(0, 4).toString(), '%PDF');
  const muchos = await crearPdfResumen(armarDatosResumen({
    resumen: [fila],
    ingresos: Array.from({ length: 80 }, (_, i) => ({ id_otrosingresos: i + 1, nombre_otrosingresos: `Concepto ${i + 1} con un texto bastante largo para que ocupe más de una línea en la página`, valor: i }))
  }));
  assert.ok(muchos.length > pocos.length);
  assert.ok((muchos.toString('latin1').match(/\/Type \/Page\b/g) || []).length >= 2);
});

test('nombre del archivo y carpeta <año>/<MES>', () => {
  assert.equal(nombreArchivoResumen('OCT ID74900 BLU: MAM'), 'OCT ID74900 BLU MAM RESUMEN.PDF');
  assert.equal(nombreSeguro('a/b:c*d'), 'a b c d');
  assert.equal(subcarpetaDe('30/10/2026'), path.join('2026', 'OCTUBRE'));
  assert.equal(subcarpetaDe('05/01/2027'), path.join('2027', 'ENERO'));
  assert.equal(subcarpetaDe('', new Date(2026, 8, 3)), path.join('2026', 'SEPTIEMBRE'));
});

test('guardar: crea la carpeta base y las subcarpetas; sin carpeta configurada no guarda', () => {
  const base = path.join(os.tmpdir(), `adl-pdf-${Date.now()}`, 'Documentos');
  const ruta = guardarPdf(Buffer.from('%PDF-prueba'), { carpetaBase: base, titulo: 'OCT ID1 X Y', fechaFacturacion: '30/10/2026' });
  assert.equal(ruta, path.join(base, '2026', 'OCTUBRE', 'OCT ID1 X Y RESUMEN.PDF'));
  assert.equal(fs.readFileSync(ruta, 'utf8'), '%PDF-prueba');
  assert.equal(guardarPdf(Buffer.from('x'), { carpetaBase: '', titulo: 'a', fechaFacturacion: '' }), null);
  fs.rmSync(path.dirname(path.dirname(path.dirname(ruta))), { recursive: true, force: true });
});

const lineas = [
  { empresa: 'Cliente', id_facturacion: 9, factura: 100, fecha: '30/10/2026', programa: 'Contingencia ISA', facturado_por: 'Centro', centro: 'C1', caso: 'PM-1', tecnica: 'PCR', n_analisis: 2, uf_uni: 0.45, uf_tot: 0.9, uf_valor: 40000, n_recepcion: '123', id_empresaservicio: 12, fecha_proceso_ini: '01/10/2026', fecha_proceso_fin: '31/10/2026' },
  { empresa: 'Cliente', id_facturacion: 9, factura: 100, fecha: '30/10/2026', programa: 'Contingencia ISA', facturado_por: 'Centro', centro: 'C2', caso: 'PM-2', tecnica: 'Costo operativo', n_analisis: 1, uf_uni: 0.1, uf_tot: 0.105, uf_valor: 40000, n_recepcion: '124', id_empresaservicio: 12 }
];

test('detalle: variante según programa y empresa, y líneas que la versión con jornada no imprime', async () => {
  const { variantePdfDetalle, filtrarLineasJornada, armarDatosDetalle, crearPdfDetalle, nombreArchivoDetalle, leerDatosDetalle } = await import('./facturacion-salud.pdf.js');
  assert.deepEqual(variantePdfDetalle({ programa: 'PVA' }), { plantilla: 'general', jornada: false });
  assert.deepEqual(variantePdfDetalle({ programa: 'Screening', id_programa: 2, id_unegocio: 1, id_empresaservicio: 56 }), { plantilla: 'screening', jornada: false });
  assert.deepEqual(variantePdfDetalle({ programa: 'Screening', id_programa: 2, id_unegocio: 3, id_empresaservicio: 56 }), { plantilla: 'screening', jornada: true });
  assert.deepEqual(variantePdfDetalle({ programa: 'Screening', id_programa: 2, id_unegocio: 3, id_empresaservicio: 7 }), { plantilla: 'screening', jornada: false });
  const f = filtrarLineasJornada([{ n_analisis: 0, tecnica: 'Costo jornada' }, { n_analisis: 1, tecnica: 'Costo jornada' }, { n_analisis: 3, tecnica: 'x', id_tecnica: 961 }, { n_analisis: 3, tecnica: 'y', id_tecnica: 10 }]);
  assert.deepEqual(f.map((x) => x.tecnica), ['Costo jornada', 'y']);

  const d = armarDatosDetalle({ filas: lineas });
  assert.equal(d.grupos.length, 2);
  assert.equal(d.totalUf, 1.01); // 0,9 + 0,105 = 1,005 → 1,01
  assert.equal(d.neto, Math.round(1.01 * 40000));
  assert.equal(d.iva, Math.round(d.neto * 0.19));
  assert.equal(d.total, d.neto + d.iva);
  assert.equal(d.grupos[0].totalPesos, 36000);
  assert.throws(() => armarDatosDetalle({ filas: [] }), /no tiene líneas/);

  assert.equal(nombreArchivoDetalle('OCT ID9 X Y'), 'OCT ID9 X Y.PDF');
  const corto = await crearPdfDetalle(d);
  assert.equal(corto.subarray(0, 4).toString(), '%PDF');
  const muchas = await crearPdfDetalle(armarDatosDetalle({ filas: Array.from({ length: 150 }, (_, i) => ({ ...lineas[0], caso: `PM-${i}`, tecnica: `Técnica larga número ${i} con descripción extensa para ocupar espacio` })) }));
  assert.ok((muchas.toString('latin1').match(/\/Type \/Page\b/g) || []).length >= 3);

  // la lectura usa el formato de fecha día/mes y la versión con jornada cuando corresponde
  const llamadas = [];
  const db = { request() { const r = { input() { return r; }, async query(t) { llamadas.push(t); return { recordset: t.includes('jornada') ? [{ ...lineas[0], programa: 'Screening', id_programa: 2, id_unegocio: 3, id_empresaservicio: 56 }] : [{ ...lineas[0], programa: 'Screening', id_programa: 2, id_unegocio: 3, id_empresaservicio: 56 }] }; } }; return r; } };
  await leerDatosDetalle(db, { id_facturacion: 9 });
  assert.equal(llamadas.length, 2);
  assert.ok(llamadas.every((t) => t.startsWith('SET DATEFORMAT dmy;')));
});

test('detalle (réplica de ADLSOFT): «Facturado por» con «Veterinario:» fijo, rango de informe y totales con 3 decimales', async () => {
  const { textoFacturadoPorDetalle, armarDatosDetalle } = await import('./facturacion-salud.pdf.js');
  // ADLSOFT escribe siempre «<por>(Veterinario: <veterinario> )», incluso si se factura por centro (H-89)
  assert.equal(textoFacturadoPorDetalle({ facturado_por: 'Veterinario', veterinario: 'Pedo Acuña', id_programa: 3 }), 'Veterinario(Veterinario: Pedo Acuña )');
  assert.equal(textoFacturadoPorDetalle({ facturado_por: 'Centro', veterinario: 'Ana', id_programa: 3 }), 'Centro(Veterinario: Ana )');
  // el programa 9 imprime solo el veterinario
  assert.equal(textoFacturadoPorDetalle({ facturado_por: 'Centro', veterinario: 'Ana', id_programa: 9 }), 'Ana');
  // «Fecha proceso» muestra el rango de las fechas de INFORME, no el de proceso (H-90)
  const d = armarDatosDetalle({ filas: [{ ...lineas[0], fecha_informe_ini: '21/09/2026', fecha_informe_fin: '20/10/2026', fecha_proceso_ini: '01/01/2022', fecha_proceso_fin: '20/10/2026' }] });
  assert.equal(d.fechaProceso, '21/09/2026 - 20/10/2026');
});

test('detalle y resumen: tamaño carta como ADLSOFT', async () => {
  const { armarDatosDetalle, crearPdfDetalle, armarDatosResumen, crearPdfResumen } = await import('./facturacion-salud.pdf.js');
  const det = await crearPdfDetalle(armarDatosDetalle({ filas: lineas }));
  const res = await crearPdfResumen(armarDatosResumen({ resumen: [{ id_facturacion: 9, factura: 0, empresa: 'X', programa: 'P', fecha: '30/10/2026', facturado_por: 'Centro', dato1: 'C1', valor_uf: 40000, uf_total: 1, uf_caso: 1 }] }));
  for (const pdf of [det, res]) {
    const t = pdf.toString('latin1');
    assert.ok(/\/MediaBox \[0 0 612 792\]/.test(t), 'tamaño carta');
  }
});
