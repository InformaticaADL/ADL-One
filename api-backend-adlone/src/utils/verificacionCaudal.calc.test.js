import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularCaudal, gradoDe, lecturasValidas } from './verificacionCaudal.calc.js';

test('promedio, desviación e índice con la referencia del molinete', () => {
    const r = calcularCaudal({ caudal_referencia: 10, lecturas: [9.8, 10.1, 9.9, 10.2] });
    assert.equal(r.n, 4);
    assert.equal(r.promedio, 10);
    assert.equal(r.desviacion, 0);
    assert.equal(r.indice, 1);
    assert.equal(r.grado, 'Perfecto');
    assert.equal(r.cumple, true);
    assert.equal(r.completa, true);
});

test('el índice es caudal menor / caudal mayor, sea cual sea el más alto', () => {
    const bajo = calcularCaudal({ caudal_referencia: 10, lecturas: [9, 9, 9] });
    const alto = calcularCaudal({ caudal_referencia: 9, lecturas: [10, 10, 10] });
    assert.equal(bajo.indice, 0.9);
    assert.equal(alto.indice, 0.9);
    assert.equal(bajo.desviacion, 10);
});

test('se acepta un índice mayor a 0,90: justo 0,90 no cumple', () => {
    assert.equal(calcularCaudal({ caudal_referencia: 10, lecturas: [9, 9, 9] }).cumple, false);
    assert.equal(calcularCaudal({ caudal_referencia: 10, lecturas: [9.5, 9.5, 9.5] }).cumple, true);
});

test('grados de correlación de la tabla del formulario', () => {
    assert.equal(gradoDe(1), 'Perfecto');
    assert.equal(gradoDe(0.95), 'Excelente');
    assert.equal(gradoDe(0.85), 'Buena');
    assert.equal(gradoDe(0.6), 'Regular');
    assert.equal(gradoDe(0.3), 'Mala');
});

test('sin referencia o con menos de 3 lecturas la verificación no está completa', () => {
    assert.equal(calcularCaudal({ caudal_referencia: '', lecturas: [1, 2, 3] }).completa, false);
    assert.equal(calcularCaudal({ caudal_referencia: 5, lecturas: [5, 5] }).completa, false);
    assert.deepEqual(lecturasValidas(['4,5', '', 'x', -1, 3]), [4.5, 3]);
});

import { lineaHistorialCaudal } from '../services/verificacionCaudal.service.js';

test('la línea del historial resume la verificación de caudal', () => {
    const l = lineaHistorialCaudal({ id_verificacion: 7, fecha_verificacion: '2026-11-19', cumple: true, caudal_referencia: 12.5, unidad: 'L/s',
        equipo_referencia: 'Molinete MOL.02/MA.PM', caudal_promedio: 12.32, desviacion_pct: 1.44, indice: 0.986, grado: 'Excelente' });
    assert.match(l, /^19\.11\.26 Verificación intermedia de caudal \(OI-FoGe-30, N° 7\): Cumple\./);
    assert.match(l, /índice 0,986 \(Excelente\)\.$/);
    const no = lineaHistorialCaudal({ id_verificacion: 8, fecha_verificacion: '2026-11-19', cumple: false, grado: 'Regular' });
    assert.match(no, /Fuera de Servicio/);
});
