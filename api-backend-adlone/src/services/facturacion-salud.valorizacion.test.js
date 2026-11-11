import test from 'node:test';
import assert from 'node:assert/strict';
import {
  columnaDeLista,
  esCasoDeProyecto,
  esLineaDerivada,
  tieneValorPrevio,
  cantidadYTotal,
  aplicaExcepcionViabilidad,
  resolverPrecioLinea,
  resolverPrecioProyecto,
  modalidadScreening,
  PROGRAMA
} from './facturacion-salud.valorizacion.js';

// Respuestas simuladas de los procedimientos de precios de ADLSOFT
const filaLista = { id_tipocobro: 3, precio_lista: 1, precio_lista_menos: 0.8, precio_lista_mas: 1.3, precio_lista_adl: 0.5 };
const repoBase = (extra = {}) => ({
  precioLista: async () => [filaLista],
  precioEspecial: async () => [],
  tipoListaPva: async () => [{ tipo_lista: 'General' }],
  precioPva: async () => [{ id_tipocobro: 4, uf_am: 2, uf_ad: 3 }],
  precioPvaPorCentro: async () => [{ id_tipocobro: 4, uf_am: 20, uf_ad: 30 }],
  precioScreening: async () => [{ id_tipocobro: 4, uf_individual: 5, uf_pool: 6, uf_individual_ap: 7, uf_pool_ap: 8 }],
  precioScreeningMultiplex: async () => [{ id_tipocobro: 4, uf_individual: 15, uf_pool: 16, uf_individual_ap: 17, uf_pool_ap: 18 }],
  precioEnsilaje: async () => [{ id_tipocobro: 3, uf_normativo: 10, uf_derivacion: 11, uf_nonormativo: 12 }],
  costoOperativoEnsilaje: async () => [],
  precioProa: async () => [],
  precioPack: async () => [],
  tipoListaCisa: async () => [{ tipo_lista: 'General' }],
  precioCisa: async () => [{ id_tipocobro: 4, uf_pool: 9 }],
  precioCisaPorCentro: async () => [{ id_tipocobro: 4, uf_pool: 90 }],
  tipoListaSrs: async () => [{ tipo_lista: 'Por centro' }],
  precioSrs: async () => [{ id_tipocobro: 4, uf_pool: 7 }],
  precioSrsPorCentro: async () => [{ id_tipocobro: 4, uf_pool: 70 }],
  precioMedioAmbiente: async () => [{ id_tipocobro: 3, uf_individual: 4 }],
  precioSamic: async () => [{ id_tipocobro: 3, uf: 6.5 }],
  precioProyecto: async () => [{ id_tipocobro: 3, uf_individual: 2.5, uf_pool: 3.5 }],
  ...extra
});
const caso = (extra = {}) => ({ id_empresaservicio: 10, id_empresa: 20, id_centro: 30, id_especie: 1, id_programa: 1, id_tipoagua: 5, precio_especial: 'N', proa: 'N', ensilaje: 'N', multiplex: 'N', apertura: 'N', ...extra });
const linea = (extra = {}) => ({ item: 1, id_tecnica: 100, nombre_tecnica: 'RT-PCR X', tipoingreso: 'INDIVIDUAL', pack: 'N', id_pack: 0, ...extra });

test('lista de precios de la empresa -> columna de mae_tecnica (espacios finales incluidos)', () => {
  assert.equal(columnaDeLista('Precio lista'), 'precio_lista');
  assert.equal(columnaDeLista('Precio convenio     '), 'precio_lista_menos');
  assert.equal(columnaDeLista('Precio recargo'), 'precio_lista_mas');
  assert.equal(columnaDeLista('Precio adl'), 'precio_lista_adl');
  assert.equal(columnaDeLista('Otra cosa'), null);
  assert.equal(columnaDeLista(null), null);
});

test('derivaciones y secciones 10/13: se conservan con valor previo, si no quedan fuera', () => {
  assert.equal(esLineaDerivada(caso(), linea({ id_seccion: 10 })), true);
  assert.equal(esLineaDerivada(caso(), linea({ id_seccion: 13 })), true);
  assert.equal(esLineaDerivada(caso(), linea({ sederiva: 'S' })), true);
  assert.equal(esLineaDerivada(caso(), linea({ id_seccion: 5, sederiva: 'N' })), false);
  assert.equal(esLineaDerivada(caso({ proa: 'S' }), linea({ id_seccion: 10 })), false);
  assert.equal(esLineaDerivada(caso({ ensilaje: 'S' }), linea({ sederiva: 'S' })), false);
  assert.equal(tieneValorPrevio({ n_analisis: 2, vtaunitario: 1.5, vtatotal: 3 }), true);
  assert.equal(tieneValorPrevio({ n_analisis: 2, vtaunitario: 1.5, vtatotal: 0 }), false);
  assert.equal(tieneValorPrevio({ n_analisis: 0, vtaunitario: 1.5, vtatotal: 3 }), false);
});

test('caso de proyecto: solo programas 3 y 4 con id_proyecto', () => {
  assert.equal(esCasoDeProyecto({ id_proyecto: 7, id_programa: 3 }), true);
  assert.equal(esCasoDeProyecto({ id_proyecto: 7, id_programa: 4 }), true);
  assert.equal(esCasoDeProyecto({ id_proyecto: 7, id_programa: 1 }), false);
  assert.equal(esCasoDeProyecto({ id_proyecto: 0, id_programa: 3 }), false);
});

test('cantidad: Pez cuenta individuales o pools según la modalidad', () => {
  const l = linea({ ind_nmuestras: 4, pol_npooles: 2 });
  assert.deepEqual(cantidadYTotal({ idTipoCobro: 1, linea: l, caso: caso(), xvta: 2 }), { nAnalisis: 4, vtaUnitario: 2, vtaTotal: 8 });
  assert.equal(cantidadYTotal({ idTipoCobro: 1, linea: { ...l, tipoingreso: 'POOLES' }, caso: caso(), xvta: 2 }).nAnalisis, 2);
});

test('cantidad: Muestra, Cada uno, Tejido y Aislado usan solo las muestras individuales (sin caer a pools)', () => {
  const l = linea({ ind_nmuestras: 0, pol_npooles: 5 });
  for (const t of [2, 3, 5, 7]) {
    const r = cantidadYTotal({ idTipoCobro: t, linea: l, caso: caso(), xvta: 3 });
    assert.equal(r.nAnalisis, 0, `tipo ${t}`);
    assert.equal(r.vtaTotal, 0, `tipo ${t}`);
  }
  assert.equal(cantidadYTotal({ idTipoCobro: 3, linea: linea({ ind_nmuestras: 6 }), caso: caso(), xvta: 0.5 }).vtaTotal, 3);
});

test('cantidad: Pool usa pools (sin caer a individuales); en multiplex las líneas hijas (<300) no se cobran', () => {
  const l = linea({ item: 5, ind_nmuestras: 9, pol_npooles: 0 });
  assert.equal(cantidadYTotal({ idTipoCobro: 4, linea: l, caso: caso(), xvta: 2 }).nAnalisis, 0);
  const hija = linea({ item: 10, pol_npooles: 3 });
  const m = caso({ multiplex: 'S' });
  const principal = cantidadYTotal({ idTipoCobro: 4, linea: hija, caso: m, xvta: 2 });
  assert.deepEqual([principal.nAnalisis, principal.vtaUnitario, principal.vtaTotal], [0, 0, 0]);
  const enProyecto = cantidadYTotal({ idTipoCobro: 4, linea: hija, caso: m, xvta: 2, variante: 'proyecto' });
  assert.deepEqual([enProyecto.nAnalisis, enProyecto.vtaUnitario, enProyecto.vtaTotal], [3, 0, 0]);
  const madre = linea({ item: 300, pol_npooles: 3 });
  assert.equal(cantidadYTotal({ idTipoCobro: 4, linea: madre, caso: m, xvta: 2 }).vtaTotal, 6);
});

test('cantidad: Placa y medio redondea hacia arriba y exige un medio distinto de 1', () => {
  const base = { ind_nmuestras: 12, muestrasxplaca: 5, id_medios: 2 };
  assert.equal(cantidadYTotal({ idTipoCobro: 6, linea: linea(base), caso: caso(), xvta: 1 }).nAnalisis, 3);
  assert.equal(cantidadYTotal({ idTipoCobro: 6, linea: linea({ ...base, ind_nmuestras: 10 }), caso: caso(), xvta: 1 }).nAnalisis, 2);
  assert.equal(cantidadYTotal({ idTipoCobro: 6, linea: linea({ ...base, ind_nmuestras: 1, muestrasxplaca: 5 }), caso: caso(), xvta: 1 }).nAnalisis, 1);
  assert.equal(cantidadYTotal({ idTipoCobro: 6, linea: linea({ ...base, id_medios: 1 }), caso: caso(), xvta: 1 }).nAnalisis, 0);
  assert.equal(cantidadYTotal({ idTipoCobro: 6, linea: linea({ ...base, ind_nmuestras: 0 }), caso: caso(), xvta: 1 }).nAnalisis, 0);
});

test('cantidad: Identificación usa el número de identificaciones del caso; NA da cero', () => {
  assert.equal(cantidadYTotal({ idTipoCobro: 8, linea: linea(), caso: caso(), xvta: 2, nIdentificaciones: 4 }).vtaTotal, 8);
  assert.equal(cantidadYTotal({ idTipoCobro: 8, linea: linea(), caso: caso(), xvta: 2, nIdentificaciones: 0 }).nAnalisis, 0);
  assert.equal(cantidadYTotal({ idTipoCobro: 0, linea: linea({ ind_nmuestras: 9 }), caso: caso(), xvta: 2 }).vtaTotal, 0);
});

test('Viabilidad ADLMag (316/317) siempre cuenta 1', () => {
  const r = aplicaExcepcionViabilidad(316, { nAnalisis: 9, vtaUnitario: 2.5, vtaTotal: 22.5 });
  assert.deepEqual(r, { nAnalisis: 1, vtaUnitario: 2.5, vtaTotal: 2.5 });
  assert.equal(aplicaExcepcionViabilidad(100, { nAnalisis: 9, vtaUnitario: 2.5, vtaTotal: 22.5 }).nAnalisis, 9);
});

test('PVA: tarifa general o por centro; mar o dulce según el tipo de agua del centro', async () => {
  const mar = await resolverPrecioLinea({ caso: caso({ id_tipoagua: 5 }), linea: linea(), columna: 'precio_lista' }, repoBase());
  assert.deepEqual([mar.xvta, mar.idTipoCobro], [2, 4]);
  const dulce = await resolverPrecioLinea({ caso: caso({ id_tipoagua: 15 }), linea: linea(), columna: 'precio_lista' }, repoBase());
  assert.equal(dulce.xvta, 3);
  const otro = await resolverPrecioLinea({ caso: caso({ id_tipoagua: 99 }), linea: linea(), columna: 'precio_lista' }, repoBase());
  assert.equal(otro.xvta, 2);
  const porCentro = await resolverPrecioLinea({ caso: caso(), linea: linea(), columna: 'precio_lista' },
    repoBase({ tipoListaPva: async () => [{ tipo_lista: 'Por centro' }] }));
  assert.equal(porCentro.xvta, 20);
  const sinLista = await resolverPrecioLinea({ caso: caso(), linea: linea(), columna: 'precio_lista' }, repoBase({ tipoListaPva: async () => [] }));
  assert.deepEqual([sinLista.xvta, sinLista.idTipoCobro], [0, 0]);
  const sinTarifa = await resolverPrecioLinea({ caso: caso(), linea: linea(), columna: 'precio_lista' }, repoBase({ precioPva: async () => [] }));
  assert.equal(sinTarifa.xvta, 0);
});

test('Screening: apertura, modalidad del caso para 281/282 y multiplex', async () => {
  const c = caso({ id_programa: PROGRAMA.SCREENING });
  const ind = await resolverPrecioLinea({ caso: c, linea: linea({ tipoingreso: 'INDIVIDUAL' }), columna: 'precio_lista' }, repoBase());
  assert.equal(ind.xvta, 5);
  const pool = await resolverPrecioLinea({ caso: c, linea: linea({ tipoingreso: 'POOLES' }), columna: 'precio_lista' }, repoBase());
  assert.equal(pool.xvta, 6);
  const apertura = await resolverPrecioLinea({ caso: caso({ id_programa: 2, apertura: 'S' }), linea: linea({ tipoingreso: 'POOLES' }), columna: 'precio_lista' }, repoBase());
  assert.equal(apertura.xvta, 8);
  const co = await resolverPrecioLinea({ caso: c, linea: linea({ id_tecnica: 282, tipoingreso: 'INDIVIDUAL' }), columna: 'precio_lista', poolOIndv: 'POOLES' }, repoBase());
  assert.equal(co.xvta, 6);
  const mp = await resolverPrecioLinea({ caso: caso({ id_programa: 2, multiplex: 'S' }), linea: linea({ tipoingreso: 'POOLES' }), columna: 'precio_lista' }, repoBase());
  assert.equal(mp.xvta, 16);
  const sinModalidad = await resolverPrecioLinea({ caso: c, linea: linea({ tipoingreso: '' }), columna: 'precio_lista' }, repoBase());
  assert.deepEqual([sinModalidad.xvta, sinModalidad.idTipoCobro], [0, 0]);
});

test('modalidad de Screening: la fija la técnica 146 del caso; sin ella, pool', () => {
  assert.equal(modalidadScreening({ id_programa: 2, lineas: [{ id_tecnica: 146, tipoingreso: 'INDIVIDUAL' }] }), 'INDIVIDUAL');
  assert.equal(modalidadScreening({ id_programa: 2, lineas: [{ id_tecnica: 5, tipoingreso: 'INDIVIDUAL' }] }), 'POOLES');
  assert.equal(modalidadScreening({ id_programa: 1, lineas: [] }), '');
});

test('Servicio Diagnóstico: orden ensilaje > PROA > pack > precio especial > lista', async () => {
  const sd = (extra) => caso({ id_programa: PROGRAMA.SERVICIO_DIAGNOSTICO, ...extra });
  const col = 'precio_lista';
  const lista = await resolverPrecioLinea({ caso: sd(), linea: linea(), columna: col }, repoBase());
  assert.deepEqual([lista.xvta, lista.idTipoCobro, lista.sinCostoOperativo], [1, 3, false]);
  const esp = await resolverPrecioLinea({ caso: sd({ precio_especial: 'S' }), linea: linea(), columna: col }, repoBase({ precioEspecial: async () => [{ precio_especial: 0.7, id_tipocobro: 3 }] }));
  assert.equal(esp.xvta, 0.7);
  const espSinFila = await resolverPrecioLinea({ caso: sd({ precio_especial: 'S' }), linea: linea(), columna: col }, repoBase());
  assert.equal(espSinFila.xvta, 1);
  const pack = await resolverPrecioLinea({ caso: sd({ precio_especial: 'S' }), linea: linea({ pack: 'S', id_pack: 4 }), columna: col },
    repoBase({ precioPack: async () => [{ valor: 0.4, id_tipocobro: 3 }] }));
  assert.equal(pack.xvta, 0.4);
  const packSinFila = await resolverPrecioLinea({ caso: sd(), linea: linea({ pack: 'S', id_pack: 4 }), columna: col }, repoBase());
  assert.equal(packSinFila.xvta, 0);
  const proa = await resolverPrecioLinea({ caso: sd({ proa: 'S' }), linea: linea({ pack: 'S' }), columna: col }, repoBase({ precioProa: async () => [{ uf: 0.9, id_tipocobro: 3 }] }));
  assert.deepEqual([proa.xvta, proa.sinCostoOperativo], [0.9, true]);
  const proaSinFila = await resolverPrecioLinea({ caso: sd({ proa: 'S' }), linea: linea(), columna: col }, repoBase());
  assert.deepEqual([proaSinFila.xvta, proaSinFila.sinCostoOperativo], [1, true]);
});

test('Servicio Diagnóstico con ensilaje: normativo, derivación (veterinario 33) o no normativo', async () => {
  const c = (extra) => caso({ id_programa: 3, ensilaje: 'S', ...extra });
  const noNorm = await resolverPrecioLinea({ caso: c(), linea: linea(), columna: 'precio_lista' }, repoBase());
  assert.deepEqual([noNorm.xvta, noNorm.sinCostoOperativo], [12, true]);
  const deriv = await resolverPrecioLinea({ caso: c({ id_veterinario: 33 }), linea: linea(), columna: 'precio_lista' }, repoBase());
  assert.equal(deriv.xvta, 11);
  const norm = await resolverPrecioLinea({ caso: c(), linea: linea(), columna: 'precio_lista' }, repoBase({ costoOperativoEnsilaje: async () => [{ x: 1 }] }));
  assert.equal(norm.xvta, 10);
});

test('la columna de la lista de la empresa decide el precio de lista (convenio, recargo, ADL)', async () => {
  const c = caso({ id_programa: PROGRAMA.ATV });
  for (const [col, esperado] of [['precio_lista', 1], ['precio_lista_menos', 0.8], ['precio_lista_mas', 1.3], ['precio_lista_adl', 0.5]]) {
    const r = await resolverPrecioLinea({ caso: c, linea: linea(), columna: col }, repoBase());
    assert.equal(r.xvta, esperado, col);
  }
});

test('I+D, Laboratorio y Caligus: precio especial o lista', async () => {
  for (const p of [4, 7, 19]) {
    const r = await resolverPrecioLinea({ caso: caso({ id_programa: p, precio_especial: 'S' }), linea: linea(), columna: 'precio_lista_menos' },
      repoBase({ precioEspecial: async () => [{ precio_especial: 0.6, id_tipocobro: 3 }] }));
    assert.equal(r.xvta, 0.6, `programa ${p}`);
    const l = await resolverPrecioLinea({ caso: caso({ id_programa: p }), linea: linea(), columna: 'precio_lista_menos' }, repoBase());
    assert.equal(l.xvta, 0.8, `programa ${p}`);
  }
});

test('CISA, Salmón Chile y SRS usan uf_pool; general o por centro según la lista de la empresa', async () => {
  const cisa = await resolverPrecioLinea({ caso: caso({ id_programa: 5 }), linea: linea(), columna: 'precio_lista' }, repoBase());
  assert.equal(cisa.xvta, 9);
  const cisaCentro = await resolverPrecioLinea({ caso: caso({ id_programa: 5 }), linea: linea(), columna: 'precio_lista' },
    repoBase({ tipoListaCisa: async () => [{ tipo_lista: 'Por centro' }] }));
  assert.equal(cisaCentro.xvta, 90);
  const salmon = await resolverPrecioLinea({ caso: caso({ id_programa: 6 }), linea: linea(), columna: 'precio_lista' }, repoBase());
  assert.equal(salmon.xvta, 9);
  const srs = await resolverPrecioLinea({ caso: caso({ id_programa: 10 }), linea: linea(), columna: 'precio_lista' }, repoBase());
  assert.equal(srs.xvta, 70);
});

test('SAMIC, Medio Ambiente y programa desconocido', async () => {
  const samic = await resolverPrecioLinea({ caso: caso({ id_programa: 18 }), linea: linea(), columna: 'precio_lista' }, repoBase());
  assert.equal(samic.xvta, 6.5);
  const ma = await resolverPrecioLinea({ caso: caso({ id_programa: 9 }), linea: linea(), columna: 'precio_lista' }, repoBase());
  assert.equal(ma.xvta, 4);
  const raro = await resolverPrecioLinea({ caso: caso({ id_programa: 77 }), linea: linea(), columna: 'precio_lista' }, repoBase());
  assert.deepEqual([raro.xvta, raro.idTipoCobro], [0, 0]);
});

test('RT-PCR-ELF se cobra con la tarifa de la técnica 193', async () => {
  const vistas = [];
  const repo = repoBase({ precioLista: async (t) => { vistas.push(t); return [filaLista]; } });
  await resolverPrecioLinea({ caso: caso({ id_programa: 8 }), linea: linea({ id_tecnica: 55, nombre_tecnica: 'RT-PCR-ELF Salmo' }), columna: 'precio_lista' }, repo);
  await resolverPrecioLinea({ caso: caso({ id_programa: 8 }), linea: linea({ id_tecnica: 55, nombre_tecnica: 'RT-PCR ISAV' }), columna: 'precio_lista' }, repo);
  assert.deepEqual(vistas, [193, 55]);
});

test('proyecto: tarifa individual o pool del proyecto; sin tarifa, cero (no cae a la lista)', async () => {
  const c = caso({ id_programa: 3, id_proyecto: 8 });
  const ind = await resolverPrecioProyecto({ caso: c, linea: linea({ tipoingreso: 'INDIVIDUAL' }) }, repoBase());
  assert.deepEqual([ind.xvta, ind.idTipoCobro], [2.5, 3]);
  const pool = await resolverPrecioProyecto({ caso: c, linea: linea({ tipoingreso: 'POOLES' }) }, repoBase());
  assert.equal(pool.xvta, 3.5);
  const sin = await resolverPrecioProyecto({ caso: c, linea: linea() }, repoBase({ precioProyecto: async () => [] }));
  assert.deepEqual([sin.xvta, sin.idTipoCobro], [0, 0]);
});
