import { useEffect } from 'react';

/**
 * Diseño del «shadcn-admin». La paleta neutra (clase `ui-neutral`) la activa el layout para todo el sistema; la escala
 * tipográfica de la plantilla (clase `ui-escala-plantilla`: text-sm 14 px, text-2xl 24 px…) la pide cada página migrada con
 * `useTemaNeutro({ escala: true })` y se quita al salir de ella. Van sobre <html> y no sobre la página porque los menús y
 * popovers se montan fuera de ella. Con contador de usos: la clase se quita cuando se cierra la última página que la pidió.
 */
const usos: Record<string, number> = { 'ui-neutral': 0, 'ui-escala-plantilla': 0 };

function activar(clase: string) {
    usos[clase] += 1;
    document.documentElement.classList.add(clase);
    return () => {
        usos[clase] -= 1;
        if (usos[clase] <= 0) document.documentElement.classList.remove(clase);
    };
}

export function useTemaNeutro(opciones: { escala?: boolean } = {}) {
    const escala = !!opciones.escala;
    useEffect(() => {
        const quitarTema = activar('ui-neutral');
        const quitarEscala = escala ? activar('ui-escala-plantilla') : undefined;
        return () => { quitarTema(); quitarEscala?.(); };
    }, [escala]);
}
