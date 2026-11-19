import test from 'node:test';
import assert from 'node:assert/strict';
import { lineaHistorial, TIPOS, AVISO_FUTURO } from './puestaMarcha.service.js';

const base = { fecha: '2026-03-15', tipo: 'EQUIPO_NUEVO', observacion: 'Se recepciona y queda\nconforme', verificacion_tipo: null };

test('la línea del historial lleva fecha corta, acción y la observación como conector', () => {
    assert.equal(lineaHistorial(base), '15.03.26 Puesta en marcha (equipo nuevo). Realizada por: Se recepciona y queda conforme.');
});

test('con una verificación de temperatura vinculada cita su documento y la fecha en que se realizó', () => {
    const l = lineaHistorial({ ...base, verificacion_tipo: 'TEMPERATURA', verificacion_codigo: '(OI-FoGe-39 N° 120)', verificacion_fecha: '2026-03-16' });
    assert.match(l, /Se asocia Verificación de Temperatura \(OI-FoGe-39 N° 120\) realizada el 16\/03\/2026/);
});

test('con una verificación de caudal cita el código que se digitó', () => {
    const l = lineaHistorial({ ...base, verificacion_tipo: 'CAUDAL', verificacion_codigo: 'VC-45', verificacion_fecha: '2026-03-17' });
    assert.match(l, /Se asocia Verificación de Caudal VC-45 realizada el 17\/03\/2026/);
});

test('los documentos adjuntos al aprobar se nombran en la línea', () => {
    const l = lineaHistorial(base, [{ documento: 'Informe del proveedor' }, { documento: 'Certificado' }]);
    assert.match(l, /Se asocian documentos: Informe del proveedor, Certificado\.$/);
});

test('los tipos de puesta en marcha son los cuatro del procedimiento y hay aviso de mejora futura', () => {
    assert.deepEqual(TIPOS, ['EQUIPO_NUEVO', 'RETORNO_SERVICIO', 'CAMBIO_SEDE', 'REACTIVACION']);
    assert.match(AVISO_FUTURO, /mejorar/);
});

import { itemsValidos } from './puestaMarcha.service.js';

test('de los ítems del formulario solo se guardan las opciones que trae el OI-FoGe-42', () => {
    assert.deepEqual(itemsValidos({ caja: 'Con Golpe', encendido: 'Enciende', manual: 'Quizás', otro: 'x' }), { caja: 'Con Golpe', encendido: 'Enciende' });
    assert.deepEqual(itemsValidos(null), {});
});

import { partesRegistradas, funcionamientoDe, areasPorRoles, lineaComplemento } from './puestaMarcha.service.js';

test('«Se registra»: las tres partes del formulario se marcan siempre (definido por Gestión de Calidad)', () => {
    assert.deepEqual(partesRegistradas({ items: {} }), { recepcion: true, puesta_marcha: true, verificacion: true });
});

test('el funcionamiento lo elige quien registra; puede no cumplir la recepción y quedar operativo', () => {
    assert.equal(funcionamientoDe('NO_CUMPLE', 'OPERATIVO'), 'OPERATIVO');
    assert.equal(funcionamientoDe('CUMPLE', undefined), 'OPERATIVO');
    assert.equal(funcionamientoDe('NO_CUMPLE', 'otro'), 'NO_OPERATIVO');
    assert.equal(funcionamientoDe('', undefined), '');
});

test('firman por Calidad su área y por Medio Ambiente técnica, coordinación y gerencia técnica', () => {
    assert.deepEqual(areasPorRoles(['Área Gestión de Calidad']), { CALIDAD: true, TECNICA: false });
    assert.deepEqual(areasPorRoles(['Área Técnica MAM']), { CALIDAD: false, TECNICA: true });
    assert.deepEqual(areasPorRoles(['Área Coordinación MAM']), { CALIDAD: false, TECNICA: true });
    assert.deepEqual(areasPorRoles(['Gerencia Tecnica']), { CALIDAD: false, TECNICA: true });
    assert.deepEqual(areasPorRoles(['Área Comercial']), { CALIDAD: false, TECNICA: false });
    assert.deepEqual(areasPorRoles(['Área Informática']), { CALIDAD: true, TECNICA: true });
});

test('un documento adjuntado después complementa el historial con su observación', () => {
    assert.equal(
        lineaComplemento({ fecha: '2026-03-15' }, 'Informe de mantención', 'Se reemplazó el sensor', '2026-04-02'),
        '02.04.26 Complemento a la puesta en marcha del 15/03/2026: se adjunta Informe de mantención. Se reemplazó el sensor.',
    );
    assert.equal(lineaComplemento({ fecha: '2026-03-15' }, 'Certificado', '', '2026-04-02'), '02.04.26 Complemento a la puesta en marcha del 15/03/2026: se adjunta Certificado.');
});
