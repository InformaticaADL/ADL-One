import test from 'node:test';
import assert from 'node:assert/strict';
import {
    FAMILIAS, reglaDeEquipo, resolverModalidad, sumarMeses, calcularSiguiente, normalizarNombreEquipo, catalogoReglas, MODALIDADES,
} from './reglasControlEquipo.js';

test('normaliza tildes, mayúsculas y espacios', () => {
    assert.equal(normalizarNombreEquipo('  Medidor  pH Portátil '), 'MEDIDOR PH PORTATIL');
    assert.equal(normalizarNombreEquipo('MUESTREADOR AUTOMÁTICO'), 'MUESTREADOR AUTOMATICO');
});

test('frecuencias: anual 12, semestral 6, trimestral 3', () => {
    assert.equal(MODALIDADES.MANTENCION_ANUAL.meses, 12);
    assert.equal(MODALIDADES.CONTRASTACION_SEMESTRAL.meses, 6);
    assert.equal(MODALIDADES.VERIFICACION_TRIMESTRAL.meses, 3);
});

test('sonda de caudal: semestral por defecto, trimestral opcional', () => {
    const r = reglaDeEquipo('SONDA CAUDAL');
    assert.equal(r.defecto, 'CONTRASTACION_SEMESTRAL');
    assert.deepEqual(r.permitidas, ['CONTRASTACION_SEMESTRAL', 'VERIFICACION_TRIMESTRAL']);
    assert.equal(resolverModalidad('SONDA CAUDAL', 'VERIFICACION_TRIMESTRAL'), 'VERIFICACION_TRIMESTRAL');
    assert.equal(resolverModalidad('SONDA CAUDAL', null), 'CONTRASTACION_SEMESTRAL');
    assert.equal(resolverModalidad('SONDA CAUDAL', 'MANTENCION_ANUAL'), 'CONTRASTACION_SEMESTRAL');
});

test('molinete: contrastación o mantención, excluyentes', () => {
    const r = reglaDeEquipo('MOLINETE ');
    assert.equal(r.elegible, true);
    assert.equal(resolverModalidad('Molinete', 'MANTENCION_ANUAL'), 'MANTENCION_ANUAL');
    assert.equal(resolverModalidad('Molinete', 'VERIFICACION_TRIMESTRAL'), 'CONTRASTACION_SEMESTRAL');
});

test('tipos de una sola modalidad ignoran lo pedido', () => {
    assert.equal(resolverModalidad('MUESTREADOR AUTOMÁTICO', 'CONTRASTACION_SEMESTRAL'), 'MANTENCION_ANUAL');
    assert.equal(resolverModalidad('Termometro patrón', null), 'CALIBRACION_ANUAL');
    assert.equal(resolverModalidad('SONDA PH/TEMPERATURA', null), 'VERIFICACION_TRIMESTRAL');
});

test('complementos no vencen', () => {
    assert.equal(resolverModalidad('BATERIA', null), 'SIN_VENCIMIENTO');
    assert.equal(resolverModalidad('Botella oceanografica', null), 'SIN_VENCIMIENTO');
    assert.equal(calcularSiguiente('2026-11-17', 'SIN_VENCIMIENTO'), null);
});

test('nombre sin regla → null (se comporta como antes)', () => {
    assert.equal(reglaDeEquipo('EQUIPO NUEVO RARO'), null);
    assert.equal(resolverModalidad('EQUIPO NUEVO RARO', 'MANTENCION_ANUAL'), null);
});

test('sumarMeses ajusta fin de mes y cruza de año', () => {
    assert.equal(sumarMeses('2026-08-31', 6), '2027-02-28');
    assert.equal(sumarMeses('2027-08-31', 6), '2028-02-29');
    assert.equal(sumarMeses('2026-11-17', 3), '2027-02-17');
    assert.equal(sumarMeses('2026-11-17', 12), '2027-11-17');
    assert.equal(sumarMeses('2026-01-31', 3), '2026-04-30');
    assert.equal(sumarMeses('basura', 3), null);
});

test('calcularSiguiente por modalidad', () => {
    assert.equal(calcularSiguiente('2026-06-10', 'CONTRASTACION_SEMESTRAL'), '2026-12-10');
    assert.equal(calcularSiguiente('2026-06-10', 'VERIFICACION_TRIMESTRAL'), '2026-09-10');
    assert.equal(calcularSiguiente('2026-06-10', 'MANTENCION_ANUAL'), '2027-06-10');
});

test('el catálogo cubre los 36 tipos del inventario', () => {
    assert.equal(Object.keys(catalogoReglas().equipos).length, 36);
});

test('las familias cubren cada nombre con regla, sin repetir', () => {
    const enFamilias = Object.values(FAMILIAS).flat();
    assert.equal(new Set(enFamilias).size, enFamilias.length);
    assert.deepEqual([...enFamilias].sort(), Object.keys(catalogoReglas().equipos).sort());
});
