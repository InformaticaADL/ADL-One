import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nombreSpPrever,
  criteriosDisponibles,
  claveGrupoPrefactura,
  agruparLineasPrefactura,
  textoMesFacturacion,
  redondea,
  enTrozos,
  esProgramaOficial
} from './facturacion-salud.prefactura.js';

test('programas oficiales: PVA, Screening, Cisa-PVS-SRS, SAMIC y Caligus (combo "Programas Oficiales" de ADLSOFT v4)', () => {
  for (const p of [1, 2, 3, 8, 9]) assert.equal(esProgramaOficial(p), true, `programa ${p}`);
  for (const p of [4, 5, 6, 7]) assert.equal(esProgramaOficial(p), false, `programa ${p}`);
});

test('los programas oficiales no ofrecen "Tipo de Agua"; los de servicios sí', () => {
  assert.deepEqual(criteriosDisponibles(1), ['Na', 'Centro', 'Veterinario', 'Centro - Veterinario']);
  assert.equal(criteriosDisponibles(4).length, 6);
  assert.throws(() => nombreSpPrever(1, 'Tipo de Agua'), /no está disponible/);
});

test('nombre del procedimiento de pre-visualización, igual que en fac_unaempresa_v4', () => {
  assert.equal(nombreSpPrever(1, 'Na'), 'fac_prever_programa_pva_na_detalle');
  assert.equal(nombreSpPrever(2, 'Centro'), 'fac_prever_programa_screening_centro_detalle');
  assert.equal(nombreSpPrever(3, 'Veterinario'), 'fac_prever_programa_cisa_pvs_veterinario_detalle');
  assert.equal(nombreSpPrever(8, 'Centro - Veterinario'), 'fac_prever_programa_samic_centroveterinario_detalle');
  assert.equal(nombreSpPrever(9, 'Na'), 'fac_prever_programa_caligus_na_detalle');
  assert.equal(nombreSpPrever(4, 'Tipo de Agua'), 'fac_prever_programa_sd_atv_tagua_detalle');
  assert.equal(nombreSpPrever(5, 'Centro - Veterinario'), 'fac_prever_programa_id_centroveterinario_detalle');
  assert.equal(nombreSpPrever(6, 'Na'), 'fac_prever_programa_il_na_detalle');
});

test('ILab + "Tipo de Agua - Veterinario" usa el procedimiento de I+D, como ADLSOFT', () => {
  assert.equal(nombreSpPrever(6, 'Tipo de Agua - Veterinario'), 'fac_prever_programa_id_taguaveterinario_detalle');
});

test('SDiag-ATV + "Tipo de Agua - Veterinario" avisa: en ADLSOFT esa opción no funciona', () => {
  assert.throws(() => nombreSpPrever(4, 'Tipo de Agua - Veterinario'), /no tiene un procedimiento válido/);
});

test('programa fuera de Salud y criterio inventado se rechazan', () => {
  assert.throws(() => nombreSpPrever(7, 'Na'), /no se factura desde Salud/);
  assert.throws(() => nombreSpPrever(1, 'Por color'), /Criterio de agrupación no válido/);
});

test('claves de grupo: mismo criterio de comparación que los LOCATE de ADLSOFT', () => {
  const l = { id_programa: 1, id_centro: 7, cliente_entrega: 'Dra. Pérez   ', id_tipoagua: 2 };
  assert.equal(claveGrupoPrefactura('Na', l), 'P:1');
  assert.equal(claveGrupoPrefactura('Centro', l), 'C:7');
  assert.equal(claveGrupoPrefactura('Veterinario', l), 'V:Dra. Pérez');
  assert.equal(claveGrupoPrefactura('Centro - Veterinario', l), 'C:7|V:Dra. Pérez');
  assert.equal(claveGrupoPrefactura('Tipo de Agua', l), 'A:2');
  assert.equal(claveGrupoPrefactura('Tipo de Agua - Veterinario', l), 'A:2|V:Dra. Pérez');
});

const lineas = [
  { id_caso: 10, id_tecnica: 1, item: 1, id_programa: 1, id_centro: 5, cliente_entrega: 'Ana', vtatotal: 1.5 },
  { id_caso: 10, id_tecnica: 2, item: 2, id_programa: 1, id_centro: 5, cliente_entrega: 'Ana', vtatotal: 2 },
  { id_caso: 11, id_tecnica: 1, item: 1, id_programa: 1, id_centro: 6, cliente_entrega: 'Beto', vtatotal: 3 },
  { id_caso: 12, id_tecnica: 1, item: 1, id_programa: 1, id_centro: 5, cliente_entrega: 'Ana', vtatotal: 4 },
  { id_caso: 99, id_tecnica: 1, item: 1, id_programa: 1, id_centro: 9, cliente_entrega: 'Cata', vtatotal: 50 }
];

test('"Na": una sola pre-factura por programa; el primer id es Mae_id + 1', () => {
  const r = agruparLineasPrefactura(lineas, 'Na', [10, 11, 12], 74907);
  assert.equal(r.grupos.length, 1);
  assert.equal(r.grupos[0].id_facturacion, 74908);
  assert.equal(r.grupos[0].total_casos, 3);
  assert.equal(r.grupos[0].total_lineas, 4);
  assert.equal(r.grupos[0].uf_total, 10.5);
  assert.equal(r.lineas.length, 4);
});

test('solo cuentan los casos marcados por el usuario', () => {
  const r = agruparLineasPrefactura(lineas, 'Na', [10], 100);
  assert.equal(r.lineas.length, 2);
  assert.ok(r.lineas.every((x) => x.id_caso === 10));
});

test('"Centro": un id nuevo por cada centro, en el orden en que aparecen', () => {
  const r = agruparLineasPrefactura(lineas, 'Centro', [10, 11, 12], 100);
  assert.deepEqual(r.grupos.map((g) => [g.id_facturacion, g.total_casos]), [[101, 2], [102, 1]]);
  assert.deepEqual(r.lineas.filter((x) => x.id_caso === 11).map((x) => x.id_facturacion), [102]);
});

test('"Veterinario": agrupa por cliente_entrega sin importar espacios finales', () => {
  const conEspacios = lineas.map((l) => (l.cliente_entrega === 'Ana' ? { ...l, cliente_entrega: 'Ana  ' } : l));
  const r = agruparLineasPrefactura(conEspacios, 'Veterinario', [10, 11, 12], 0);
  assert.equal(r.grupos.length, 2);
});

test('sin casos marcados no hay grupos ni líneas', () => {
  const r = agruparLineasPrefactura(lineas, 'Na', [], 100);
  assert.deepEqual(r, { grupos: [], lineas: [] });
});

test('mes de la factura: texto "MES AÑO" como el combo de ADLSOFT', () => {
  assert.equal(textoMesFacturacion('', '', '09/11/2026'), 'NOVIEMBRE 2026');
  assert.equal(textoMesFacturacion('octubre', '2025', ''), 'OCTUBRE 2025');
  assert.equal(textoMesFacturacion('OCTUBRE 2025', '2026', ''), 'OCTUBRE 2025');
  assert.equal(textoMesFacturacion('', '', ''), '');
});

test('redondeo estilo FoxPro y trozos', () => {
  assert.equal(redondea(2.675, 2), 2.68);
  assert.equal(redondea(1472351.5, 0), 1472352);
  assert.equal(redondea(-1.5, 0), -2);
  assert.deepEqual(enTrozos([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});

import {
  nombreSpEmpresas,
  nombreSpCasos,
  aplicaAtbplex,
  tramoDePrecioPorRango,
  mapConLimite
} from './facturacion-salud.prefactura.js';

test('procedimientos de elegibilidad por programa (botón Procesar y doble clic)', () => {
  assert.equal(nombreSpEmpresas(1), 'fac_agrupaempresa_entrefechas_pva');
  assert.equal(nombreSpEmpresas(3), 'fac_agrupaempresa_entrefechas_cisa_pvs');
  assert.equal(nombreSpEmpresas(8), 'fac_agrupaempresa_entrefechas_samic');
  assert.equal(nombreSpCasos(2), 'fac_agrupaempresacasos_entrefechas_screening');
  assert.equal(nombreSpCasos(9), 'fac_agrupaempresacasos_entrefechas_caligus');
  assert.equal(nombreSpCasos(5), 'fac_agrupaempresacasos_entrefechas_id');
  assert.equal(nombreSpCasos(6), 'fac_agrupaempresacasos_entrefechas_il');
});

test('SDiag-ATV: normal, ensilaje y PROA (ensilaje tiene prioridad)', () => {
  assert.equal(nombreSpCasos(4), 'fac_agrupaempresacasos_entrefechas_sd_atv');
  assert.equal(nombreSpCasos(4, { ensilaje: true }), 'fac_agrupaempresacasos_entrefechas_sd_atv_ensilaje');
  assert.equal(nombreSpCasos(4, { proa: true }), 'fac_agrupaempresacasos_entrefechas_sd_atv_proa');
  assert.equal(nombreSpEmpresas(4, { ensilaje: true, proa: true }), 'fac_agrupaempresa_entrefechas_sd_atv_ensilaje');
  assert.throws(() => nombreSpEmpresas(7), /no se factura desde Salud/);
});

test('ATBPlex solo en SDiag-ATV normal', () => {
  assert.equal(aplicaAtbplex(4), true);
  assert.equal(aplicaAtbplex(4, { ensilaje: true }), false);
  assert.equal(aplicaAtbplex(4, { proa: true }), false);
  assert.equal(aplicaAtbplex(1), false);
});

test('tramo de precio por rango de pools', () => {
  const tramos = [{ rangodesde: 1, rangohasta: 10, valor: 5 }, { rangodesde: 11, rangohasta: 50, valor: 4 }];
  assert.equal(tramoDePrecioPorRango(tramos, 10).valor, 5);
  assert.equal(tramoDePrecioPorRango(tramos, 11).valor, 4);
  assert.equal(tramoDePrecioPorRango(tramos, 51), null);
  assert.equal(tramoDePrecioPorRango([], 3), null);
});

test('mapConLimite procesa todo sin pasar del límite de paralelismo', async () => {
  let activos = 0;
  let maximo = 0;
  const vistos = [];
  await mapConLimite([1, 2, 3, 4, 5, 6, 7], 3, async (x) => {
    activos++;
    maximo = Math.max(maximo, activos);
    await new Promise((r) => setTimeout(r, 5));
    vistos.push(x);
    activos--;
  });
  assert.equal(vistos.length, 7);
  assert.ok(maximo <= 3);
});
