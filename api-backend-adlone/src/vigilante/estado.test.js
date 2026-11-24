import test from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicial, evaluar } from './estado.js';

const MIN = 60 * 1000;
const CFG = { umbral: 3, recordatorioMs: 120 * MIN };
const FALLA = (motivo = 'sin respuesta') => ({ ok: false, motivo });
const BIEN = { ok: true };

// Corre una secuencia de resultados, uno por minuto, y devuelve las acciones que salieron (con su minuto).
const correr = (resultados, inicio = estadoInicial()) => {
    let estado = inicio; const acciones = [];
    resultados.forEach((r, i) => { const s = evaluar(estado, r, i * MIN, CFG); estado = s.estado; if (s.accion) acciones.push({ minuto: i, ...s.accion }); });
    return { estado, acciones };
};

test('un fallo suelto o dos seguidos no avisan', () => {
    assert.deepEqual(correr([FALLA(), FALLA()]).acciones, []);
});

test('avisa UNA vez al llegar al umbral y no repite en cada comprobación', () => {
    const { acciones } = correr([FALLA(), FALLA(), FALLA(), FALLA(), FALLA(), FALLA()]);
    assert.equal(acciones.length, 1);
    assert.equal(acciones[0].tipo, 'CAIDO');
    assert.equal(acciones[0].minuto, 2);
});

test('la caída se cuenta desde el PRIMER fallo, no desde el aviso', () => {
    const { acciones } = correr([BIEN, FALLA(), FALLA(), FALLA()]);
    assert.equal(acciones[0].desde, 1 * MIN);
    assert.equal(acciones[0].duracionMs, 2 * MIN);
});

test('un fallo intermitente (fallo, bien, fallo, bien) nunca avisa', () => {
    assert.deepEqual(correr([FALLA(), BIEN, FALLA(), BIEN, FALLA(), BIEN, FALLA(), BIEN]).acciones, []);
});

test('el contador de fallos se reinicia cuando vuelve a responder', () => {
    // 2 fallos, bien, 2 fallos: ninguna racha llega a 3
    assert.deepEqual(correr([FALLA(), FALLA(), BIEN, FALLA(), FALLA()]).acciones, []);
});

test('avisa que se recuperó, con cuánto duró la caída', () => {
    const { acciones, estado } = correr([FALLA(), FALLA(), FALLA(), FALLA(), BIEN]);
    assert.deepEqual(acciones.map((a) => a.tipo), ['CAIDO', 'RECUPERADO']);
    assert.equal(acciones[1].duracionMs, 4 * MIN);
    assert.equal(estado.caido, false);
});

test('mientras sigue caído manda un recordatorio cada 2 horas y no antes', () => {
    const resultados = Array(250).fill(null).map(() => FALLA());
    const { acciones } = correr(resultados);
    assert.deepEqual(acciones.map((a) => [a.tipo, a.minuto]), [['CAIDO', 2], ['RECORDATORIO', 122], ['RECORDATORIO', 242]]);
});

test('una parada a propósito (pm2 stopped o pausa) no avisa y borra la cuenta', () => {
    const DET = { ok: false, detenido: true };
    // 2 fallos, parada, 2 fallos: sin la parada habría llegado a 4
    assert.deepEqual(correr([FALLA(), FALLA(), DET, FALLA(), FALLA()]).acciones, []);
    // detenido durante un despliegue largo
    assert.deepEqual(correr([DET, DET, DET, DET, DET, BIEN]).acciones, []);
});

test('si estaba caído y alguien lo detiene para arreglarlo, no hay aviso de «recuperado»', () => {
    const { acciones, estado } = correr([FALLA(), FALLA(), FALLA(), { ok: false, detenido: true }, BIEN]);
    assert.deepEqual(acciones.map((a) => a.tipo), ['CAIDO']);
    assert.equal(estado.caido, false);
});

test('después de recuperarse y volver a caer, avisa de nuevo como una caída nueva', () => {
    const { acciones } = correr([FALLA(), FALLA(), FALLA(), BIEN, FALLA(), FALLA(), FALLA()]);
    assert.deepEqual(acciones.map((a) => a.tipo), ['CAIDO', 'RECUPERADO', 'CAIDO']);
});

test('guarda el último motivo conocido para el correo', () => {
    const { acciones } = correr([FALLA('timeout'), FALLA('timeout'), FALLA('HTTP 502')]);
    assert.equal(acciones[0].motivo, 'HTTP 502');
});

test('no modifica el estado que recibe', () => {
    const e = estadoInicial(); Object.freeze(e);
    assert.doesNotThrow(() => evaluar(e, FALLA(), 0, CFG));
});
