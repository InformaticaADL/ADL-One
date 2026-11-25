import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { IconAlertTriangle, IconExternalLink, IconFileText, IconMaximize, IconMinimize } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import type { PdfGenerado } from '../services/fichasEquipo.service';

interface Props {
    /** Genera el PDF con los datos actuales; null = todavía no hay qué mostrar. */
    generar: () => Promise<PdfGenerado | null>;
    /**
     * Cambia cuando cambian los datos del documento (ej. JSON de lo editado).
     * La vista se regenera un momento después del último cambio.
     */
    clave: string;
    /** Sin datos suficientes: se muestra este aviso en vez del documento. */
    aviso?: string | null;
    className?: string;
    /** Si se pasa, aparece el botón Ampliar/Reducir (el contenedor decide cuánto espacio le da). */
    ampliada?: boolean;
    onAmpliar?: () => void;
}

const ESPERA_MS = 700;

/**
 * Vista previa en vivo de una ficha de equipo: el mismo PDF que se descarga,
 * generado por el backend, que se actualiza al editar. Mientras se genera la
 * nueva versión se sigue viendo la anterior (sin parpadeo).
 */
export const VistaPreviaPdf: React.FC<Props> = ({ generar, clave, aviso, className, ampliada, onAmpliar }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [cargando, setCargando] = useState(false);
    const [falla, setFalla] = useState(false);
    const generarRef = useRef(generar);
    useLayoutEffect(() => { generarRef.current = generar; });
    const turno = useRef(0);
    const urlRef = useRef<string | null>(null);

    useEffect(() => {
        if (aviso) return;
        const mio = ++turno.current;
        const t = setTimeout(async () => {
            setCargando(true);
            try {
                const r = await generarRef.current();
                // Una respuesta vieja (ya se pidió otra) se descarta.
                if (mio !== turno.current) { if (r) URL.revokeObjectURL(r.url); return; }
                if (urlRef.current) URL.revokeObjectURL(urlRef.current);
                urlRef.current = r?.url ?? null;
                setUrl(urlRef.current);
                setFalla(false);
            } catch {
                if (mio === turno.current) setFalla(true);
            } finally {
                if (mio === turno.current) setCargando(false);
            }
        }, ESPERA_MS);
        return () => clearTimeout(t);
    }, [clave, aviso]);

    useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

    return (
        <div className={cn('relative flex min-h-[320px] flex-col overflow-hidden rounded-lg border border-border bg-muted/40', className)}>
            <div className="flex items-center justify-between gap-2 border-b border-border bg-card px-3 py-1.5">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><IconFileText size={14} /> Vista previa del documento</span>
                <div className="flex items-center gap-1">
                    {cargando && !aviso && (
                        <span className="mr-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Actualizando…
                        </span>
                    )}
                    {url && !aviso && (
                        <button type="button" onClick={() => window.open(url, '_blank', 'noopener')} title="Abrir el documento en otra pestaña"
                            className="flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                            <IconExternalLink size={14} /> Abrir
                        </button>
                    )}
                    {onAmpliar && (
                        <button type="button" onClick={onAmpliar} title={ampliada ? 'Volver al formulario' : 'Ver el documento a todo el ancho'}
                            className="flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium transition-colors hover:bg-muted">
                            {ampliada ? <><IconMinimize size={14} /> Reducir</> : <><IconMaximize size={14} /> Ampliar</>}
                        </button>
                    )}
                </div>
            </div>
            {aviso ? (
                <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">{aviso}</div>
            ) : url ? (
                // Con la barra del visor: botones de zoom (+/−) y ajustar al ancho. La página abre ajustada al ancho.
                <iframe key={url} title="Vista previa del documento" src={`${url}#toolbar=1&navpanes=0&view=FitH&zoom=page-width`} className="min-h-0 w-full flex-1 bg-white" />
            ) : (
                <div className="flex flex-1 items-center justify-center">
                    {falla
                        ? <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><IconAlertTriangle size={16} /> No se pudo generar la vista previa</span>
                        : <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
                </div>
            )}
            {falla && url && !aviso && (
                <span className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-md bg-card px-2 py-1 text-[11px] text-muted-foreground shadow">No se pudo actualizar; se muestra la versión anterior</span>
            )}
        </div>
    );
};

export default VistaPreviaPdf;
