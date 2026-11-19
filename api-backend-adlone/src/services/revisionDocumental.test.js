import test from 'node:test';
import assert from 'node:assert/strict';
import { conRangos, revisionDelAnio, revisionEnFecha, dmy } from './revisionDocumental.service.js';

const LISTA = [
    { anio: 2024, fecha_inicio: '2023-12-26' },
    { anio: 2025, fecha_inicio: '2025-01-06' },
    { anio: 2026, fecha_inicio: '2026-01-12' },
];

test('cada revisión termina el día anterior a la siguiente y solo una rige hoy', () => {
    const r = conRangos(LISTA, '2026-03-01');
    assert.deepEqual(r.map((x) => x.fecha_fin), ['2025-01-05', '2026-01-11', null]);
    assert.deepEqual(r.map((x) => x.vigente), [false, false, true]);
});

test('el 11.01.26 todavía rige la revisión 2025 y el 12.01.26 empieza la 2026', () => {
    assert.equal(revisionEnFecha(LISTA, '2026-01-11').anio, 2025);
    assert.equal(revisionEnFecha(LISTA, '2026-01-12').anio, 2026);
});

test('el historial de un año usa la revisión de ese año o la más reciente anterior', () => {
    assert.equal(dmy(revisionDelAnio(LISTA, 2025).fecha_inicio), '06/01/2025');
    assert.equal(revisionDelAnio(LISTA, 2030).anio, 2026);
    assert.equal(revisionDelAnio(LISTA, 2010).anio, 2024);
});

import { anioDeHistorial } from './revisionDocumental.service.js';

test('el historial sigue el periodo de la revisión documental, no el año del calendario', () => {
    assert.equal(anioDeHistorial(LISTA, 20260105), 2025); // todavía rige la revisión 2025
    assert.equal(anioDeHistorial(LISTA, 20260112), 2026);
    assert.equal(anioDeHistorial(LISTA, 20251231), 2025);
    assert.equal(anioDeHistorial(LISTA, 20231228), 2024); // la revisión 2024 empieza el 26.12.23
});

test('fuera de las revisiones registradas el historial usa el año del calendario', () => {
    assert.equal(anioDeHistorial(LISTA, 20190610), 2019);
    assert.equal(anioDeHistorial(LISTA, 20270315), 2027); // 2027 aún sin revisión registrada
});

import { encabezadoDe } from './revisionDocumental.service.js';

const DOC = { codigo: 'OI-FoGe-42', version: 'Versión 01', fecha_vigencia: '2020-12-28', fecha_revision: null };

test('el encabezado lleva la versión y vigencia del documento y la revisión anual que rige', () => {
    assert.deepEqual(encabezadoDe(DOC, LISTA, { fecha: '2026-03-01' }), { version: 'Versión 01', vigencia: '28/12/2020', revision: '12/01/2026', nombre: DOC.nombre || null });
});

test('una revisión propia del documento (modificación a mitad de año) reemplaza a la anual desde su fecha', () => {
    const doc = { ...DOC, fecha_revision: '2026-10-26' };
    assert.equal(encabezadoDe(doc, LISTA, { fecha: '2026-11-18' }).revision, '26/10/2026');
    assert.equal(encabezadoDe(doc, LISTA, { fecha: '2026-09-01' }).revision, '12/01/2026'); // aún no se modificaba
});

test('la revisión anual siguiente vuelve a mandar sobre una revisión propia anterior', () => {
    const doc = { ...DOC, fecha_revision: '2025-10-26' };
    assert.equal(encabezadoDe(doc, LISTA, { fecha: '2026-03-01' }).revision, '12/01/2026');
});

test('el historial de un año usa la revisión de ese año (y la propia si cae dentro de ese periodo)', () => {
    assert.equal(encabezadoDe(DOC, LISTA, { anio: 2025 }).revision, '06/01/2025');
    assert.equal(encabezadoDe({ ...DOC, fecha_revision: '2025-08-01' }, LISTA, { anio: 2025 }).revision, '01/08/2025');
});
