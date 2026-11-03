import React, { useEffect, useRef, useState } from 'react';
import {
    IconChevronLeft, IconChevronRight, IconExternalLink, IconDownload, IconFileUnknown,
    IconFileTypePdf, IconPhoto, IconFile, IconZoomIn, IconZoomOut,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { tipoArchivo, extensionArchivo, nombreDescarga } from '../utils/tipoArchivo';

export interface DocumentoVisor {
    id: number;
    nombre: string;
    url: string;
    fecha?: string;
}

const TAMANOS_ICONO = {
    sm: { caja: 'h-8 w-8 rounded-md', icono: 16 },
    md: { caja: 'h-11 w-11 rounded-lg', icono: 22 },
    lg: { caja: 'h-14 w-14 rounded-xl', icono: 28 },
} as const;

// Ícono del archivo según su tipo: PDF en rojo, imágenes con su propia
// miniatura (o un ícono azul si no se pide miniatura) y el resto en gris con
// su extensión. Se usa en las tarjetas, el encabezado y la tira del visor.
export const ArchivoIcono: React.FC<{ url: string; size?: keyof typeof TAMANOS_ICONO; miniatura?: boolean; className?: string }> = ({
    url, size = 'md', miniatura = true, className,
}) => {
    const tipo = tipoArchivo(url);
    const ext = extensionArchivo(url);
    const t = TAMANOS_ICONO[size];
    const [imgError, setImgError] = useState(false);
    const conMiniatura = tipo === 'imagen' && miniatura && !imgError;

    return (
        <div
            className={cn(
                'relative flex shrink-0 items-center justify-center overflow-hidden',
                t.caja,
                tipo === 'pdf' && 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
                tipo === 'imagen' && !conMiniatura && 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
                tipo === 'otro' && 'bg-muted text-muted-foreground',
                className,
            )}
        >
            {conMiniatura ? (
                <img src={url} alt="" loading="lazy" onError={() => setImgError(true)} className="h-full w-full object-cover" />
            ) : tipo === 'pdf' ? (
                <IconFileTypePdf size={t.icono} />
            ) : tipo === 'imagen' ? (
                <IconPhoto size={t.icono} />
            ) : (
                <IconFile size={t.icono} />
            )}
            {/* La extensión va como etiqueta cuando el ícono no la dice (el de PDF ya la trae). */}
            {tipo !== 'pdf' && ext && size !== 'sm' && (
                <span className="absolute inset-x-0 bottom-0 bg-foreground/70 text-center text-[8px] font-bold uppercase leading-3 text-background">
                    {ext}
                </span>
            )}
        </div>
    );
};

const PASOS_ZOOM = [1, 1.5, 2, 3];

interface Props {
    documentos: DocumentoVisor[];
    // Índice del documento abierto; null = visor cerrado.
    indice: number | null;
    onIndiceChange: (indice: number | null) => void;
    subtitulo?: string;
}

// Visor en pantalla grande para los respaldos: PDF embebido, imágenes con zoom,
// y navegación entre los documentos del mismo grupo (flechas del teclado,
// botones laterales o la tira de miniaturas) sin cerrar y abrir cada uno.
export const DocumentoViewerModal: React.FC<Props> = ({ documentos, indice, onIndiceChange, subtitulo }) => {
    const doc = indice !== null ? documentos[indice] : undefined;
    const total = documentos.length;
    const tipo = doc ? tipoArchivo(doc.url) : 'otro';
    const ext = doc ? extensionArchivo(doc.url) : '';

    // Se guarda QUÉ url terminó de cargar (igual que PdfViewerModal), así el
    // spinner se reinicia solo al pasar de un documento a otro. El zoom se
    // guarda junto a su url por lo mismo: vuelve a 100% al cambiar de documento.
    const [urlListo, setUrlListo] = useState<string | null>(null);
    const [zoomState, setZoomState] = useState<{ url: string; paso: number } | null>(null);
    const [descargando, setDescargando] = useState(false);
    const tiraRef = useRef<HTMLDivElement>(null);

    const cargando = !!doc && tipo !== 'otro' && urlListo !== doc.url;
    const paso = doc && zoomState?.url === doc.url ? zoomState.paso : 0;
    const zoom = PASOS_ZOOM[paso];

    useEffect(() => {
        if (!doc) return;
        // El visor de PDF del navegador no siempre dispara `load` en el iframe.
        const t = setTimeout(() => setUrlListo(doc.url), 2000);
        return () => clearTimeout(t);
    }, [doc]);

    useEffect(() => {
        if (indice === null || total < 2) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') onIndiceChange((indice - 1 + total) % total);
            if (e.key === 'ArrowRight') onIndiceChange((indice + 1) % total);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [indice, total, onIndiceChange]);

    // Mantiene visible en la tira la miniatura del documento abierto.
    useEffect(() => {
        if (indice === null) return;
        tiraRef.current?.querySelector<HTMLElement>(`[data-indice="${indice}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }, [indice]);

    const cambiarZoom = (delta: number) => {
        if (!doc) return;
        const nuevo = Math.min(PASOS_ZOOM.length - 1, Math.max(0, paso + delta));
        setZoomState({ url: doc.url, paso: nuevo });
    };

    // Se descarga como blob para que el archivo baje con su nombre y extensión
    // (el atributo `download` se ignora con urls de otro origen, como el backend).
    const descargar = async () => {
        if (!doc) return;
        setDescargando(true);
        try {
            const res = await fetch(doc.url);
            if (!res.ok) throw new Error(String(res.status));
            const blobUrl = URL.createObjectURL(await res.blob());
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = nombreDescarga(doc.nombre, doc.url);
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        } catch {
            window.open(doc.url, '_blank', 'noopener');
        } finally {
            setDescargando(false);
        }
    };

    const meta = [
        ext ? ext.toUpperCase() : null,
        doc?.fecha,
        total > 1 && indice !== null ? `${indice + 1} de ${total}` : null,
    ].filter(Boolean).join(' · ');

    return (
        <Dialog open={!!doc} onOpenChange={(open) => { if (!open) onIndiceChange(null); }}>
            <DialogContent className="flex h-[92vh] w-[95vw] max-w-6xl flex-col gap-0 overflow-hidden p-0">
                <DialogHeader className="flex shrink-0 flex-row items-center gap-3 space-y-0 border-b border-border px-4 py-3 pr-12">
                    {doc && <ArchivoIcono url={doc.url} size="md" miniatura={false} />}
                    <div className="min-w-0 flex-1">
                        <DialogTitle className="truncate text-base" title={doc?.nombre}>{doc?.nombre || 'Documento'}</DialogTitle>
                        <DialogDescription className="truncate text-xs">
                            {subtitulo && <span className="font-medium text-foreground/80">{subtitulo}</span>}
                            {subtitulo && meta && ' · '}
                            {meta}
                        </DialogDescription>
                    </div>
                    {doc && (
                        <div className="flex shrink-0 items-center gap-1">
                            {tipo === 'imagen' && (
                                <div className="mr-1 flex items-center rounded-lg border border-border">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => cambiarZoom(-1)} disabled={paso === 0} aria-label="Alejar" title="Alejar">
                                        <IconZoomOut size={16} />
                                    </Button>
                                    <button
                                        type="button"
                                        className="min-w-12 px-1 text-xs tabular-nums text-muted-foreground hover:text-foreground"
                                        onClick={() => setZoomState({ url: doc.url, paso: 0 })}
                                        title="Ajustar a la ventana"
                                    >
                                        {paso === 0 ? 'Ajustar' : `${Math.round(zoom * 100)}%`}
                                    </button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => cambiarZoom(1)} disabled={paso === PASOS_ZOOM.length - 1} aria-label="Acercar" title="Acercar">
                                        <IconZoomIn size={16} />
                                    </Button>
                                </div>
                            )}
                            <Button variant="ghost" size="sm" asChild>
                                <a href={doc.url} target="_blank" rel="noopener noreferrer" title="Abrir en pestaña nueva">
                                    <IconExternalLink size={16} /> <span className="hidden sm:inline">Abrir</span>
                                </a>
                            </Button>
                            <Button variant="outline" size="sm" onClick={descargar} disabled={descargando} title="Descargar">
                                {descargando
                                    ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    : <IconDownload size={16} />}
                                <span className="hidden sm:inline">Descargar</span>
                            </Button>
                        </div>
                    )}
                </DialogHeader>

                <div className="relative min-h-0 flex-1 bg-muted/40">
                    {doc && cargando && (
                        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
                            <ArchivoIcono url={doc.url} size="lg" miniatura={false} className="animate-pulse" />
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    )}
                    {doc && tipo === 'pdf' && (
                        <iframe key={doc.url} src={doc.url} title={doc.nombre} onLoad={() => setUrlListo(doc.url)} className="h-full w-full border-0 bg-background" />
                    )}
                    {doc && tipo === 'imagen' && (
                        <div className={cn('h-full w-full overflow-auto p-4', paso === 0 && 'flex items-center justify-center')}>
                            <img
                                key={doc.url}
                                src={doc.url}
                                alt={doc.nombre}
                                onLoad={() => setUrlListo(doc.url)}
                                onClick={() => setZoomState({ url: doc.url, paso: paso === 0 ? 1 : 0 })}
                                style={paso === 0 ? undefined : { width: `${zoom * 100}%`, maxWidth: 'none' }}
                                className={cn(
                                    'mx-auto rounded-lg shadow-sm',
                                    paso === 0 ? 'max-h-full max-w-full cursor-zoom-in object-contain' : 'cursor-zoom-out',
                                )}
                            />
                        </div>
                    )}
                    {doc && tipo === 'otro' && (
                        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                            <IconFileUnknown size={48} className="text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Este tipo de archivo{ext ? ` (.${ext})` : ''} no se puede previsualizar en el navegador.</p>
                            <Button size="sm" onClick={descargar} disabled={descargando}><IconDownload size={16} /> Descargar</Button>
                        </div>
                    )}

                    {total > 1 && indice !== null && (
                        <>
                            <Button
                                variant="secondary"
                                size="icon"
                                className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full shadow-md"
                                onClick={() => onIndiceChange((indice - 1 + total) % total)}
                                aria-label="Documento anterior"
                            >
                                <IconChevronLeft size={18} />
                            </Button>
                            <Button
                                variant="secondary"
                                size="icon"
                                className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full shadow-md"
                                onClick={() => onIndiceChange((indice + 1) % total)}
                                aria-label="Documento siguiente"
                            >
                                <IconChevronRight size={18} />
                            </Button>
                        </>
                    )}
                </div>

                {total > 1 && (
                    <div ref={tiraRef} className="flex shrink-0 gap-2 overflow-x-auto border-t border-border bg-background px-3 py-2">
                        {documentos.map((d, i) => (
                            <button
                                key={d.id}
                                type="button"
                                data-indice={i}
                                onClick={() => onIndiceChange(i)}
                                title={d.nombre}
                                className={cn(
                                    'flex w-44 shrink-0 items-center gap-2 rounded-lg border p-1.5 text-left transition-colors',
                                    i === indice ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/40 hover:bg-muted/50',
                                )}
                            >
                                <ArchivoIcono url={d.url} size="sm" />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-medium text-foreground">{d.nombre}</span>
                                    <span className="block truncate text-[10px] text-muted-foreground">{[extensionArchivo(d.url).toUpperCase(), d.fecha].filter(Boolean).join(' · ')}</span>
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
