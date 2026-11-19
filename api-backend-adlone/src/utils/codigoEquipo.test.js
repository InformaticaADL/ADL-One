import test from 'node:test';
import assert from 'node:assert/strict';
import { partesCodigo, validarCodigoTipoNuevo, codigoConSede } from './codigoEquipo.js';

test('el código de un equipo tiene sigla de 3 letras, correlativo, área y sede', () => {
    assert.deepEqual(partesCodigo('MAU.01/MA.PM'), { sigla: 'MAU', correlativo: 1, sede: 'PM' });
    assert.equal(partesCodigo('MAUX.01/MA.PM'), null);
    assert.equal(partesCodigo('MAU-01/MA.PM'), null);
});

test('un tipo nuevo exige el formato completo y que la sede del código sea la del equipo', () => {
    assert.equal(validarCodigoTipoNuevo('COM.01/MA.PM', 'PM'), null);
    assert.match(validarCodigoTipoNuevo('COMP.01/MA.PM', 'PM'), /3 letras/);
    assert.match(validarCodigoTipoNuevo('COM.01/MA.VI', 'PM'), /no coincide/);
    assert.match(validarCodigoTipoNuevo('COM.01/MA.XX', 'XX'), /sede del código/);
    assert.match(validarCodigoTipoNuevo('COM.00/MA.PM', 'PM'), /01 o mayor/);
});

test('al cambiar de sede el código se mantiene y solo cambia la sede', () => {
    assert.equal(codigoConSede('MAU.01/MA.PM', 'VI'), 'MAU.01/MA.VI');
    assert.equal(codigoConSede('pHs.77/MA.VI', 'AY'), 'pHs.77/MA.AY');
    assert.equal(codigoConSede('MAU.01/MA.PM', 'XX'), null);
});
