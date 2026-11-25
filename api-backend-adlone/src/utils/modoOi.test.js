// node --test src/utils/modoOi.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { modoOiDePrograma, repartirOi } from './modoOi.js';

test('solo Certificación ASC informa todos los puntos en un OI; el resto, un OI por punto', () => {
    assert.equal(modoOiDePrograma('Certificación ASC'), 'visita');
    assert.equal(modoOiDePrograma('Certificación ASC '), 'visita');
    assert.equal(modoOiDePrograma('Seguimiento Ambiental'), 'punto');
    assert.equal(modoOiDePrograma('Compromisos Ambientales'), 'punto');
    assert.equal(modoOiDePrograma('Control Interno'), 'punto');
    assert.equal(modoOiDePrograma('Autocontrol RILes'), 'punto');
    assert.equal(modoOiDePrograma('Certificación BAP'), 'punto');
    assert.equal(modoOiDePrograma('Casas de Ejemplo'), 'punto', 'no confundir con una palabra que contenga asc');
    assert.equal(modoOiDePrograma(null), 'punto');
});

const hermanos = [
    { id_agendamam: 11, retiro_completado: 'S' },
    { id_agendamam: 12, retiro_completado: 'S' },
    { id_agendamam: 13, retiro_completado: 'N' },
];

test('alcance «punto»: el OI es solo del punto desde el que se asigna', () => {
    const r = repartirOi({ propio: 10, hermanos, alcance: 'punto' });
    assert.deepEqual(r.ids, [10]);
    assert.equal(r.pendientes.length, 0);
});

test('alcance «visita»: todos los puntos con el retiro completado, y los demás quedan pendientes', () => {
    const r = repartirOi({ propio: 10, hermanos, alcance: 'visita' });
    assert.deepEqual(r.ids, [10, 11, 12]);
    assert.deepEqual(r.pendientes.map((h) => h.id_agendamam), [13]);
});

test('alcance «puntos»: solo los elegidos (y solo si son de la visita)', () => {
    const r = repartirOi({ propio: 10, hermanos, alcance: 'puntos', idsElegidos: [12, 999] });
    assert.deepEqual(r.ids, [10, 12], 'el 999 no es de la visita y se ignora');
    const r2 = repartirOi({ propio: 10, hermanos, alcance: 'puntos', idsElegidos: [13] });
    assert.deepEqual(r2.ids, [10]);
    assert.deepEqual(r2.pendientes.map((h) => h.id_agendamam), [13], 'el elegido sin retiro completado queda pendiente');
});

test('sin alcance se usa el valor por defecto del programa', () => {
    assert.deepEqual(repartirOi({ propio: 10, hermanos, modoPorDefecto: 'visita' }).ids, [10, 11, 12]);
    assert.deepEqual(repartirOi({ propio: 10, hermanos, modoPorDefecto: 'punto' }).ids, [10]);
    assert.equal(repartirOi({ propio: 10, hermanos, alcance: 'cualquier-cosa', modoPorDefecto: 'punto' }).alcance, 'punto');
});

test('una ficha sin hermanos recibe el OI sola, en cualquier modo', () => {
    assert.deepEqual(repartirOi({ propio: 10, hermanos: [], alcance: 'visita' }).ids, [10]);
});
