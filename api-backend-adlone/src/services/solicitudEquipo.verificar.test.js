import test from 'node:test';
import assert from 'node:assert/strict';
import { cambiosPara, pendientesDe } from './solicitudEquipo.service.js';

const eq = (extra = {}) => ({ codigo: 'MOD.06/MA.PM', responsable: 'Pablo Flores', id_muestreador: 258, sede: 'PM', estado_equipo: 'Operativo', fecha_baja: null, ultima_verificacion: '2026-08-01', siguiente_verificacion: '2027-08-01', ...extra });

test('traspaso de responsable sin aplicar: el equipo sigue con el responsable anterior', () => {
    const { cambios, payload } = cambiosPara('TRASPASO_EQUIPO', { traspaso_de: ['RESPONSABLE'], id_muestreador_destino: '1010', nombre_muestreador_destino: 'Fernando Cárdenas' }, eq());
    const p = pendientesDe(cambios, payload, eq());
    assert.equal(p.length, 1);
    assert.equal(p[0].etiqueta, 'Responsable');
    assert.equal(p[0].esperado, 'Fernando Cárdenas');
});

test('traspaso de responsable ya aplicado: sin pendientes', () => {
    const d = { traspaso_de: ['RESPONSABLE'], id_muestreador_destino: '1010', nombre_muestreador_destino: 'Fernando Cárdenas' };
    const { cambios, payload } = cambiosPara('TRASPASO_EQUIPO', d, eq());
    assert.deepEqual(pendientesDe(cambios, payload, eq({ id_muestreador: 1010 })), []);
});

test('traspaso de sede: compara la sede sin distinguir mayúsculas y detecta el código sin actualizar', () => {
    const d = { traspaso_de: ['UBICACION'], id_centro_destino: 'VI', nombre_centro_destino: 'Villarrica' };
    const { cambios, payload } = cambiosPara('TRASPASO_EQUIPO', d, eq());
    assert.deepEqual(pendientesDe(cambios, payload, eq({ sede: 'vi', codigo: 'MOD.06/MA.VI' })), []);
    assert.ok(pendientesDe(cambios, payload, eq({ sede: 'vi' })).some((x) => x.campo === 'codigo'));
});

test('baja: pendiente hasta que el estado queda «Dado de Baja»', () => {
    const { cambios, payload } = cambiosPara('BAJA_EQUIPO', { fecha_baja: '2026-11-18' }, eq());
    assert.equal(pendientesDe(cambios, payload, eq()).length, 2);
    assert.deepEqual(pendientesDe(cambios, payload, eq({ estado_equipo: 'Dado de Baja', fecha_baja: '2026-11-18' })), []);
});

test('un tipo sin cambios sobre el equipo no tiene pendientes', () => {
    const { cambios, payload } = cambiosPara('REPORTE_PROBLEMA', {}, eq());
    assert.deepEqual(pendientesDe(cambios, payload, eq()), []);
});

test('el equipo de la solicitud se identifica por su código, no por el id guardado (que puede apuntar a otro equipo)', async () => {
    const { codigoSolicitado } = await import('./solicitudEquipo.service.js');
    assert.equal(codigoSolicitado({ codigo_equipo: 'MOD.11/MA.PM', id_equipo: '320' }), 'MOD.11/MA.PM');
    assert.equal(codigoSolicitado({ nombre_equipo_full: 'MEDIDOR DE OXIGENO DISUELTO [MOD.06/MA.VI]' }), 'MOD.06/MA.VI');
    assert.equal(codigoSolicitado({ equipo_nombre: 'FILTRO [FL-04]' }), 'FL-04');
    assert.equal(codigoSolicitado({ id_equipo: '320' }), '');
});
