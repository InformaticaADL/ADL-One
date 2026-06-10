import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTemplate, isEmptyValue } from './placeholders.js';

test('resolveTemplate replaces {VAR} and {VAR_UPPER} placeholders', () => {
    const result = resolveTemplate('Hola {nombre}, ficha #{CORRELATIVO}', {
        nombre: 'Juan',
        CORRELATIVO: '1245',
    });
    assert.equal(result, 'Hola Juan, ficha #1245');
});

test('resolveTemplate converts ISO dates (YYYY-MM-DD) to DD-MM-YYYY', () => {
    const result = resolveTemplate('Fecha: {FECHA_ISO}', { FECHA_ISO: '2026-06-10' });
    assert.equal(result, 'Fecha: 10-06-2026');
});

test('resolveTemplate ignores object/null/undefined context values', () => {
    const result = resolveTemplate('Servicios: {servicios} - Cliente: {cliente}', {
        servicios: [{ a: 1 }],
        cliente: null,
    });
    assert.equal(result, 'Servicios: {servicios} - Cliente: {cliente}');
});

test('resolveTemplate combines two placeholders in the same template', () => {
    const result = resolveTemplate('{FECHA} {HORA}', { FECHA: '10 de junio de 2026', HORA: '16:18' });
    assert.equal(result, '10 de junio de 2026 16:18');
});

test('isEmptyValue treats null, undefined, blank and "No aplica" as empty', () => {
    assert.equal(isEmptyValue(null), true);
    assert.equal(isEmptyValue(undefined), true);
    assert.equal(isEmptyValue('   '), true);
    assert.equal(isEmptyValue('No aplica'), true);
    assert.equal(isEmptyValue('no especificado'), true);
    assert.equal(isEmptyValue('Planta Puerto Montt'), false);
});

test('isEmptyValue treats unresolved {PLACEHOLDER} strings as empty', () => {
    assert.equal(isEmptyValue('{ALGUNA_VARIABLE}'), true);
    assert.equal(isEmptyValue('Texto {ALGUNA_VARIABLE} mezclado'), true);
});
