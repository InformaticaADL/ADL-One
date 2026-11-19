import test from 'node:test';
import assert from 'node:assert/strict';
import { elegirFilaRepetida } from './equipo-excel-import.service.js';

const fila = (rowNumber, estado_equipo) => ({
    rowNumber, codigo: 'MAU.06/MA.PM', estado_equipo,
    estado: /baja|fuera de servicio/i.test(estado_equipo) ? 'Inactivo' : 'Activo',
});

test('código repetido: se usa la fila operativa aunque sea la primera', () => {
    const op = fila(90, 'Operativo');
    const baja = fila(120, 'Dado de Baja');
    assert.equal(elegirFilaRepetida(op, baja).usar, op);
});

test('código repetido: se usa la fila operativa aunque sea la última', () => {
    const fuera = fila(90, 'Fuera de Servicio');
    const op = fila(120, 'Operativo');
    assert.equal(elegirFilaRepetida(fuera, op).usar, op);
});

test('código repetido en el mismo estado: se usa la última fila', () => {
    assert.equal(elegirFilaRepetida(fila(90, 'Operativo'), fila(120, 'Operativo')).usar.rowNumber, 120);
    assert.equal(elegirFilaRepetida(fila(90, 'Dado de Baja'), fila(120, 'Fuera de Servicio')).usar.rowNumber, 120);
});
