import test from 'node:test';
import assert from 'node:assert/strict';
import { cambiosPara } from './solicitudEquipo.service.js';

const eq = { responsable: 'Pablo Flores', sede: 'PM', estado_equipo: 'Operativo', ultima_verificacion: '2026-08-01', siguiente_verificacion: '2026-11-01', fecha_baja: null };

test('traspaso de responsable: solo cambia el responsable', () => {
    const r = cambiosPara('TRASPASO_EQUIPO', { traspaso_de: ['RESPONSABLE'], id_muestreador_destino: '229', nombre_muestreador_destino: 'Angelo Chiesa' }, eq);
    assert.deepEqual(r.payload, { id_muestreador: 229 });
    assert.deepEqual(r.cambios.map((c) => [c.etiqueta, c.actual, c.nuevo]), [['Responsable', 'Pablo Flores', 'Angelo Chiesa']]);
});

test('traspaso de responsable y sede: cambia los dos', () => {
    const r = cambiosPara('TRASPASO_EQUIPO', { traspaso_de: ['RESPONSABLE', 'UBICACION'], id_muestreador_destino: '229', nombre_muestreador_destino: 'Angelo Chiesa', id_centro_destino: 'VI', nombre_centro_destino: 'Villarrica (VI)' }, eq);
    assert.deepEqual(r.payload, { id_muestreador: 229, ubicacion: 'VI' });
    assert.equal(r.cambios.length, 2);
});

test('traspaso sin destino no cambia nada', () => {
    const r = cambiosPara('TRASPASO_EQUIPO', { traspaso_de: ['RESPONSABLE'] }, eq);
    assert.deepEqual(r.payload, {});
    assert.equal(r.cambios.length, 0);
});

test('baja: estado y fecha de baja', () => {
    const r = cambiosPara('BAJA_EQUIPO', { fecha_baja: '2026-11-18' }, eq);
    assert.deepEqual(r.payload, { estado_equipo: 'Dado de Baja', fecha_baja: '2026-11-18' });
    assert.equal(r.cambios[0].nuevo, 'Dado de Baja');
});

test('extensión de vigencia: última y siguiente revisión', () => {
    const r = cambiosPara('EXTENSION_VIGENCIA', { fecha_revision: '2026-11-18', nueva_vigencia: '2099-02-18' }, eq);
    assert.equal(r.payload.ultima_verificacion, '2026-11-18');
    assert.equal(r.payload.siguiente_verificacion, '2099-02-18');
    assert.equal(r.payload.vigencia, '2099-02-18');
});

test('reporte de problema: sin cambios de campos (solo observación)', () => {
    const r = cambiosPara('REPORTE_PROBLEMA', { descripcion_problema: 'no enciende' }, eq);
    assert.deepEqual(r.payload, {});
    assert.deepEqual(r.cambios, []);
});

test('traspaso de sede: el código se mantiene y solo cambia la sede del final', () => {
    const r = cambiosPara('TRASPASO_EQUIPO', { traspaso_de: ['UBICACION'], id_centro_destino: 'VI', nombre_centro_destino: 'Villarrica' },
        { codigo: 'MAU.01/MA.PM', sede: 'PM' });
    assert.equal(r.payload.ubicacion, 'VI');
    assert.equal(r.payload.codigo, 'MAU.01/MA.VI');
    assert.ok(r.cambios.some((c) => c.campo === 'codigo' && c.actual === 'MAU.01/MA.PM' && c.nuevo === 'MAU.01/MA.VI'));
});
