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

test('un dispositivo quieto (jitter GPS < 20m entre pings) no acumula km', () => {
    const puntos = [
        { lat: 0, lon: 0 },
        { lat: 0, lon: 0.0001 },
        { lat: 0, lon: 0.00005 },
        { lat: 0, lon: 0.00015 },
        { lat: 0, lon: 0 },
    ];
    const km = calcularKmRecorridos(puntos);
    assert.equal(km, 0, `esperaba 0 (solo ruido GPS), obtuvo ${km}`);
});

test('un desplazamiento real sigue contando aunque venga precedido de ruido GPS', () => {
    const puntos = [
        { lat: 0, lon: 0 },
        { lat: 0, lon: 0.0001 },
        { lat: 0, lon: 0.001 },
    ];
    const km = calcularKmRecorridos(puntos);
    assert.ok(km > 0.08 && km < 0.15, `esperaba ~0.111 (el tramo real), obtuvo ${km}`);
});
