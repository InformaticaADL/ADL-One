import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularKmRecorridos } from './distanciaHelper.js';

test('menos de 2 puntos retorna 0 km', () => {
    assert.equal(calcularKmRecorridos([]), 0);
    assert.equal(calcularKmRecorridos([{ lat: 0, lon: 0 }]), 0);
    assert.equal(calcularKmRecorridos(null), 0);
});

test('un solo tramo calcula la distancia Haversine entre los 2 puntos', () => {
    const km = calcularKmRecorridos([{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }]);
    assert.ok(Math.abs(km - 111.19) < 0.5, `esperaba ~111.19, obtuvo ${km}`);
});

test('ida y vuelta al mismo punto suma el recorrido real, no el desplazamiento neto', () => {
    const puntos = [{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 0, lon: 0 }];
    const km = calcularKmRecorridos(puntos);
    assert.ok(km > 200, `esperaba > 200 (ida + vuelta), obtuvo ${km}`);
});
