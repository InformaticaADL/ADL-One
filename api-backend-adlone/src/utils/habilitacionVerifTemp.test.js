import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtroEstadoVerifTemp, requiereHabilitacion } from './habilitacionVerifTemp.js';

test('Operativo no necesita habilitación; Fuera de Servicio y Dado de Baja sí', () => {
    assert.equal(requiereHabilitacion('Operativo'), false);
    assert.equal(requiereHabilitacion('Fuera de Servicio'), true);
    assert.equal(requiereHabilitacion('Dado de Baja'), true);
    assert.equal(requiereHabilitacion(null), false);
});

test('con la columna, los Fuera de Servicio y Dados de Baja entran solo si están habilitados', () => {
    const f = filtroEstadoVerifTemp(true);
    assert.match(f, /NOT LIKE '%baja%'/);
    assert.match(f, /NOT LIKE '%fuera%'/);
    assert.match(f, /OR ISNULL\(e\.habilitado_verif_temp, 0\) = 1/);
});

test('sin la columna (migración pendiente), los Fuera de Servicio y Dados de Baja no entran', () => {
    const f = filtroEstadoVerifTemp(false);
    assert.doesNotMatch(f, /habilitado_verif_temp/);
    assert.match(f, /NOT LIKE '%fuera%'/);
});
