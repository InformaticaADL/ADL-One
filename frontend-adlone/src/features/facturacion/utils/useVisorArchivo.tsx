import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '../../../contexts/ToastContext';
import PdfViewerModal from '../components/PdfViewerModal';

type Estado = { open: boolean; url: string | null; nombre: string; cargando: boolean };
const VACIO: Estado = { open: false, url: null, nombre: '', cargando: false };

const esPdf = (n = '', m = '') => m.toLowerCase().includes('pdf') || n.toLowerCase().endsWith('.pdf');
const esImagen = (n = '', m = '') => m.toLowerCase().includes('image') || /\.(jpe?g|png|gif|webp|bmp)$/i.test(n);

/**
 * Abre PDFs e imágenes dentro de la app en vez de descargarlos.
 *
 * Los adjuntos viajan por endpoints con Bearer token, así que NO se le puede
 * pasar la URL directa al visor: un iframe o un <img> no mandan el header y
 * reciben 401. Se baja el archivo por fetch autenticado y se muestra desde una
 * URL de blob. Word/Excel y el resto no tienen visor: ahí "ver" es descargar.
 */
export function useVisorArchivo() {
    const { showToast } = useToast();
    const [pdf, setPdf] = useState<Estado>(VACIO);
    const [imagen, setImagen] = useState<Estado>(VACIO);
    const urlPdfRef = useRef<string | null>(null);
    const urlImgRef = useRef<string | null>(null);
    // Dos clics seguidos sobre archivos distintos podían mostrar el nombre de
    // uno con el contenido del otro.
    const pedidoRef = useRef(0);

    useEffect(() => () => {
        if (urlPdfRef.current) URL.revokeObjectURL(urlPdfRef.current);
        if (urlImgRef.current) URL.revokeObjectURL(urlImgRef.current);
    }, []);

    const bajarBlob = async (url: string) => {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!r.ok) throw new Error(`No se pudo obtener el archivo (${r.status})`);
        return r.blob();
    };

    const abrirArchivo = useCallback(async (url: string, nombre: string, mime = '') => {
        const pdfDoc = esPdf(nombre, mime);
        const img = !pdfDoc && esImagen(nombre, mime);

        if (!pdfDoc && !img) {
            try {
                const blob = await bajarBlob(url);
                const objectUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = nombre || 'archivo';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(objectUrl);
            } catch {
                showToast({ type: 'error', message: 'No se pudo descargar el archivo' });
            }
            return;
        }

        const pedido = ++pedidoRef.current;
        const setEstado = img ? setImagen : setPdf;
        const refActiva = img ? urlImgRef : urlPdfRef;

        setEstado({ open: true, url: null, nombre, cargando: true });
        try {
            const blob = await bajarBlob(url);
            if (pedido !== pedidoRef.current) return;
            if (refActiva.current) URL.revokeObjectURL(refActiva.current);
            const objectUrl = URL.createObjectURL(blob);
            refActiva.current = objectUrl;
            setEstado({ open: true, url: objectUrl, nombre, cargando: false });
        } catch {
            if (pedido !== pedidoRef.current) return;
            showToast({ type: 'error', message: 'No se pudo abrir el archivo' });
            setEstado(VACIO);
        }
    }, [showToast]);

    const cerrar = (img: boolean) => {
        const refActiva = img ? urlImgRef : urlPdfRef;
        if (refActiva.current) { URL.revokeObjectURL(refActiva.current); refActiva.current = null; }
        (img ? setImagen : setPdf)(VACIO);
    };

    const Visores = () => (
        <>
            <PdfViewerModal open={pdf.open} onClose={() => cerrar(false)} url={pdf.url} title={pdf.nombre} />
            <Dialog open={imagen.open} onOpenChange={(next) => { if (!next) cerrar(true); }}>
                <DialogContent className="flex max-h-[85vh] w-[80vw] max-w-none flex-col gap-3">
                    <DialogHeader>
                        <DialogTitle>{imagen.nombre}</DialogTitle>
                    </DialogHeader>
                    <div className="flex min-h-[200px] items-center justify-center overflow-auto">
                        {imagen.cargando ? (
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        ) : (
                            imagen.url && <img src={imagen.url} alt={imagen.nombre} className="block max-h-[80vh] max-w-full" />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );

    return { abrirArchivo, Visores };
}
