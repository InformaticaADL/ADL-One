// Lógica de decisión del vigilante: cuándo hay que avisar. No usa red, correo ni reloj propio (todo entra por parámetros), para poder probarla.
//
// Reglas:
//   · Un fallo suelto no avisa: hacen falta `umbral` comprobaciones seguidas con fallo (así un reinicio de segundos no molesta a nadie).
//   · Se avisa UNA vez cuando se cae, un recordatorio cada `recordatorioMs` mientras siga caído, y UNA vez cuando vuelve.
//   · Una parada a propósito (`detenido`: pm2 en «stopped», o una pausa manual) no es una caída: se olvida cualquier cuenta y no se manda nada.
//     Si el servicio estaba caído y alguien lo detiene para arreglarlo, tampoco se manda aviso de «recuperado».

export const estadoInicial = () => ({ fallos: 0, primerFallo: null, caido: false, desde: null, ultimoAviso: null, ultimoMotivo: null });

/**
 * @param {object} prev   estado anterior de UN servicio (ver estadoInicial)
 * @param {{ok:boolean, detenido?:boolean, motivo?:string}} r  resultado de la comprobación actual
 * @param {number} ahora  milisegundos (Date.now())
 * @param {{umbral:number, recordatorioMs:number}} cfg
 * @returns {{estado:object, accion:null|{tipo:'CAIDO'|'RECORDATORIO'|'RECUPERADO', desde:number, duracionMs:number, fallos:number, motivo:string|null}}}
 */
export function evaluar(prev, r, ahora, cfg) {
    // Parada a propósito: no es una caída.
    if (r.detenido) return { estado: estadoInicial(), accion: null };

    // Todo bien: si estaba caído, se avisa que volvió.
    if (r.ok) {
        const accion = prev.caido
            ? { tipo: 'RECUPERADO', desde: prev.desde, duracionMs: ahora - prev.desde, fallos: prev.fallos, motivo: prev.ultimoMotivo }
            : null;
        return { estado: estadoInicial(), accion };
    }

    // Fallo.
    const fallos = prev.fallos + 1;
    const estado = {
        ...prev,
        fallos,
        primerFallo: prev.fallos === 0 ? ahora : prev.primerFallo,
        ultimoMotivo: r.motivo || prev.ultimoMotivo,
    };

    if (!prev.caido) {
        if (fallos < cfg.umbral) return { estado, accion: null };
        estado.caido = true;
        estado.desde = estado.primerFallo;
        estado.ultimoAviso = ahora;
        return { estado, accion: { tipo: 'CAIDO', desde: estado.desde, duracionMs: ahora - estado.desde, fallos, motivo: estado.ultimoMotivo } };
    }

    // Sigue caído: recordatorio cada cierto tiempo.
    if (ahora - prev.ultimoAviso >= cfg.recordatorioMs) {
        estado.ultimoAviso = ahora;
        return { estado, accion: { tipo: 'RECORDATORIO', desde: prev.desde, duracionMs: ahora - prev.desde, fallos, motivo: estado.ultimoMotivo } };
    }
    return { estado, accion: null };
}
