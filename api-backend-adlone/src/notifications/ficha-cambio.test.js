import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderEmail } from './renderer.js';

const CTX = { CORRELATIVO: '1091', REGISTRO: '«Edwards» (6 puntos)', TIPO_REGISTRO_MIN: 'visita', USUARIO: 'Pablo', FECHA: '24-11-2026', HORA: '10:00', APP_URL: 'http://app.test' };

test('los cuatro avisos de cambio de muestreo son el mismo correo, con la frase de lo que cambió', () => {
    const casos = {
        FICHA_MUESTREO_REAGENDADO: /Se cambió la fecha de un muestreo/,
        FICHA_MUESTREO_REASIGNADO: /Se cambió el responsable de un muestreo/,
        FICHA_MUESTREO_REAGENDADO_REASIGNADO: /Se cambiaron la fecha y el responsable/,
        FICHA_MUESTREO_REPROGRAMADO: /Se modificó la programación de un muestreo/,
    };
    for (const [codigo, frase] of Object.entries(casos)) {
        const r = renderEmail(codigo, CTX);
        assert.equal(r.asunto, 'Cambio en el muestreo: «Edwards» (6 puntos)', codigo);
        assert.match(r.html, /<h2[^>]*>Cambio en el muestreo<\/h2>/, codigo);
        assert.match(r.html, frase, codigo);
        assert.match(r.html, /REPROGRAMADA/, codigo);
    }
});
