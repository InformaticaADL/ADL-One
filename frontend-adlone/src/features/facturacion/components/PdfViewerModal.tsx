import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
    open: boolean;
    onClose: () => void;
    url: string | null;
    title?: string;
}

const PdfViewerModal: React.FC<Props> = ({ open, onClose, url, title }) => {
    // Se guarda QUÉ url terminó de cargar, no un booleano: así el spinner se
    // reinicia solo al pasar de un documento a otro, sin tener que ponerlo en
    // true desde el efecto (que causaría un render en cascada).
    const [urlListo, setUrlListo] = useState<string | null>(null);
    const loading = !!url && urlListo !== url;

    useEffect(() => {
        if (!url) return;
        // Con una url de blob el visor del navegador no siempre dispara `load`
        // (el contenido ya es local), y el spinner se quedaba encima para
        // siempre. Este corte lo saca igual; si el PDF ya se ve, sobra.
        const t = setTimeout(() => setUrlListo(url), 1500);
        return () => clearTimeout(t);
    }, [url]);

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent className="flex h-[85vh] w-[90vw] max-w-none flex-col gap-0 p-0">
                <DialogHeader className="shrink-0 border-b border-border px-4 py-3">
                    <DialogTitle>{title || 'Vista de documento'}</DialogTitle>
                </DialogHeader>
                <div className="min-h-0 flex-1">
                    {url ? (
                        <div className="relative h-full w-full">
                            {loading && (
                                // pointer-events-none — antes esta capa tapaba el iframe
                                // y, si el spinner se quedaba pegado, bloqueaba el
                                // scroll y los controles del visor de PDF.
                                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                </div>
                            )}
                            <iframe
                                src={url}
                                onLoad={() => setUrlListo(url)}
                                className="h-full w-full border-0"
                                title={title || 'PDF'}
                            />
                        </div>
                    ) : (
                        // Mientras se descarga el archivo (los adjuntos van con token,
                        // así que llegan por fetch antes de tener una url que mostrar).
                        <div className="flex h-full items-center justify-center">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default PdfViewerModal;
