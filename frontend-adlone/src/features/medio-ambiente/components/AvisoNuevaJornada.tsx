import { useEffect } from 'react';
import { IconPlayerPlay } from '@tabler/icons-react';
import { useTrackingStore } from '../../../store/trackingStore';

const DURACION_MS = 6_000;

// Toast efímero propio de esta pantalla — se posiciona fijo arriba a la
// derecha del mapa, se autodescarta solo después de DURACION_MS.
export function AvisoNuevaJornada() {
    const avisoJornadaIniciada = useTrackingStore((s) => s.avisoJornadaIniciada);
    const limpiarAvisoJornadaIniciada = useTrackingStore((s) => s.limpiarAvisoJornadaIniciada);

    useEffect(() => {
        if (!avisoJornadaIniciada) return;
        const id = setTimeout(limpiarAvisoJornadaIniciada, DURACION_MS);
        return () => clearTimeout(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [avisoJornadaIniciada?.id]);

    if (!avisoJornadaIniciada) return null;

    return (
        <div
            key={avisoJornadaIniciada.id}
            className="shadcn-scope absolute right-4 top-4 z-[1000] flex max-w-[320px] items-center gap-2 rounded-[10px] border border-border bg-card p-3 shadow-lg"
        >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <IconPlayerPlay size={14} />
            </div>
            <span className="text-[13px] text-foreground">
                <strong>{avisoJornadaIniciada.nombreMuestreador}</strong> ha iniciado su ruta
            </span>
        </div>
    );
}
