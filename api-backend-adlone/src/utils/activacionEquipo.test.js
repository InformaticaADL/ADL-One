import test from 'node:test';
import assert from 'node:assert/strict';
import { advertenciaActivacion } from './activacionEquipo.js';

const HOY = '2026-11-17';
const db = { nombre: 'MEDIDOR PH PORTÁTIL', estado: 'Inactivo', estado_equipo: 'Operativo', ultima_verificacion: '2026-04-27', siguiente_verificacion: '2026-07-26', modalidad_control: 'VERIFICACION_TRIMESTRAL' };
const excel = { nombre: 'MEDIDOR PH PORTÁTIL', estado: 'Activo', estado_equipo: 'Operativo', ultima_verificacion: '2026-04-27', siguiente_verificacion: '2026-07-26' };

test('Excel activo, sistema inactivo por vencimiento y sin fechas nuevas → alerta', () => {
    const t = advertenciaActivacion(excel, db, HOY);
    assert.match(t, /venció el 26-07-2026/);
    assert.match(t, /no trae una nueva/);
});

test('el Excel trae fecha nueva pero ya vencida → alerta de fecha vencida', () => {
    const t = advertenciaActivacion({ ...excel, siguiente_verificacion: '2026-09-01' }, db, HOY);
    assert.match(t, /que quedaría \(01-09-2026\) ya venció/);
});

test('el Excel trae una siguiente revisión vigente → sin alerta', () => {
    assert.equal(advertenciaActivacion({ ...excel, ultima_verificacion: '2026-11-10', siguiente_verificacion: '2027-02-10' }, db, HOY), null);
});

test('sin fecha en ninguno de los dos → no se puede activar', () => {
    const t = advertenciaActivacion({ ...excel, ultima_verificacion: null, siguiente_verificacion: null }, { ...db, ultima_verificacion: null, siguiente_verificacion: null }, HOY);
    assert.match(t, /No se podrá activar/);
});

test('si el Excel no trae fecha se usa la del sistema (vigente → sin alerta)', () => {
    assert.equal(advertenciaActivacion({ ...excel, siguiente_verificacion: null }, { ...db, siguiente_verificacion: '2027-01-05' }, HOY), null);
});

test('no aplica a complementos sin vencimiento ni a bajas / fuera de servicio', () => {
    assert.equal(advertenciaActivacion({ ...excel, nombre: 'BATERIA' }, { ...db, nombre: 'BATERIA', modalidad_control: 'SIN_VENCIMIENTO', siguiente_verificacion: null }, HOY), null);
    assert.equal(advertenciaActivacion(excel, { ...db, estado_equipo: 'Fuera de Servicio' }, HOY), null);
    assert.equal(advertenciaActivacion({ ...excel, estado: 'Inactivo' }, db, HOY), null);
    assert.equal(advertenciaActivacion(excel, { ...db, estado: 'Activo' }, HOY), null);
});

test('acepta fechas como Date', () => {
    const t = advertenciaActivacion(excel, { ...db, siguiente_verificacion: new Date('2026-07-26T00:00:00Z') }, HOY);
    assert.match(t, /26-07-2026/);
});
