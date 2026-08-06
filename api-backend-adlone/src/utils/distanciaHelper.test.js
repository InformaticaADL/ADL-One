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

test('un solo ping con salto aislado que vuelve al origen no cuenta como movimiento (caso real detectado)', () => {
    // Reproduce el patrón encontrado en datos reales: 3 puntos casi
    // idénticos, un salto de ~24m (1 solo ping), y de vuelta a la posición
    // original — el dispositivo nunca se movió, fue un rebote de precisión.
    const puntos = [
        { lat: -41.4204427, lon: -72.9146851 },
        { lat: -41.4204432, lon: -72.9147244 },
        { lat: -41.4204475, lon: -72.9146857 },
        { lat: -41.4204452, lon: -72.9146834 },
        { lat: -41.4206359, lon: -72.9148278 }, // salto aislado (~24m)
        { lat: -41.4204448, lon: -72.9146783 }, // vuelve cerca del origen
        { lat: -41.4204404, lon: -72.9147121 },
        { lat: -41.4204439, lon: -72.9147143 },
    ];
    const km = calcularKmRecorridos(puntos);
    assert.equal(km, 0, `esperaba 0 (salto aislado descartado como ruido), obtuvo ${km}`);
});

test('un desplazamiento real de dos tramos confirmados por puntos consecutivos sí se suma', () => {
    const puntos = [
        { lat: 0, lon: 0 },
        { lat: 0, lon: 0.0001 },
        { lat: 0, lon: 0.001 },    // se aleja (~111m) — queda pendiente
        { lat: 0, lon: 0.0011 },   // confirma: sigue cerca del punto anterior
    ];
    const km = calcularKmRecorridos(puntos);
    assert.ok(km > 0.1, `esperaba > 0.1 (movimiento confirmado), obtuvo ${km}`);
});

test('ida y vuelta CONFIRMADA (varios puntos en el destino) suma el recorrido real', () => {
    const puntos = [
        { lat: 0, lon: 0 },
        { lat: 0, lon: 1 },    // llega
        { lat: 0, lon: 1.0001 }, // confirma que está ahí
        { lat: 0, lon: 0 },    // vuelve
        { lat: 0, lon: 0.0001 }, // confirma que volvió
    ];
    const km = calcularKmRecorridos(puntos);
    assert.ok(km > 200, `esperaba > 200 (ida + vuelta confirmadas), obtuvo ${km}`);
});
