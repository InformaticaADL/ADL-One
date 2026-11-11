import { useEffect, useRef } from 'react';
import LoadingBar, { type LoadingBarRef } from 'react-top-loading-bar';
import { useNavStore } from '../../store/navStore';

/**
 * Barra fina de carga arriba de la pantalla (la misma de la plantilla): avanza y se completa cada vez que se cambia de
 * módulo o de sección. ADL ONE no tiene rutas que esperar, así que dura lo que tarda en montarse la pantalla nueva.
 */
export function NavigationProgress() {
    const ref = useRef<LoadingBarRef>(null);
    const { activeModule, activeSubmodule } = useNavStore();
    const primera = useRef(true);

    useEffect(() => {
        if (primera.current) { primera.current = false; return; }
        ref.current?.continuousStart();
        const t = setTimeout(() => ref.current?.complete(), 450);
        return () => clearTimeout(t);
    }, [activeModule, activeSubmodule]);

    return <LoadingBar color="var(--sc-muted-foreground)" ref={ref} shadow={true} height={2} />;
}
