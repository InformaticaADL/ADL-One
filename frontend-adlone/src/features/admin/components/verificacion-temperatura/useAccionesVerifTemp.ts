import { useEffect, useState } from 'react';
import { verificacionTemperaturaService as api, type AccionesVerifTemp } from '../../services/verificacionTemperatura.service';

// Qué puede hacer el usuario en Verificación de Temperatura. Se pide una vez
// por sesión (el backend decide; la pantalla solo oculta botones). Hasta que
// llega la respuesta se muestra todo: si no corresponde, el backend lo rechaza.
const TODO: AccionesVerifTemp = { firmar: true, patron: true };
let cache: AccionesVerifTemp | null = null;
let pedido: Promise<AccionesVerifTemp> | null = null;

const pedir = () => {
    if (cache) return Promise.resolve(cache);
    if (!pedido) {
        pedido = api.acciones().then((a) => { cache = a; return a; }).catch(() => { pedido = null; return TODO; });
    }
    return pedido;
};

export const useAccionesVerifTemp = (): AccionesVerifTemp => {
    const [acciones, setAcciones] = useState<AccionesVerifTemp>(cache ?? TODO);
    useEffect(() => {
        let vivo = true;
        pedir().then((a) => { if (vivo) setAcciones(a); });
        return () => { vivo = false; };
    }, []);
    return acciones;
};
