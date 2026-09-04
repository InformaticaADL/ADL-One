import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Spin, message } from 'antd';
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
                message.error('No se pudo descargar el archivo');
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
            message.error('No se pudo abrir el archivo');
            setEstado(VACIO);
        }
    }, []);

    const cerrar = (img: boolean) => {
        const refActiva = img ? urlImgRef : urlPdfRef;
        if (refActiva.current) { URL.revokeObjectURL(refActiva.current); refActiva.current = null; }
        (img ? setImagen : setPdf)(VACIO);
    };

    const Visores = () => (
        <>
            <PdfViewerModal open={pdf.open} onClose={() => cerrar(false)} url={pdf.url} title={pdf.nombre} />
            <Modal
                open={imagen.open}
                onCancel={() => cerrar(true)}
                footer={null}
                width="80vw"
                style={{ top: 20 }}
                styles={{ body: { padding: 0, minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' } }}
                title={imagen.nombre}
                destroyOnHidden
            >
                {imagen.cargando ? <Spin style={{ padding: 60 }} /> : (
                    imagen.url && <img src={imagen.url} alt={imagen.nombre} style={{ maxWidth: '100%', maxHeight: '80vh', display: 'block' }} />
                )}
            </Modal>
        </>
    );

    return { abrirArchivo, Visores };
}
