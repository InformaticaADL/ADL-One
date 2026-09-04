import { Modal, Spin } from 'antd';
import { useState, useEffect } from 'react';

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
        <Modal
            open={open}
            onCancel={onClose}
            footer={null}
            width="90vw"
            style={{ top: 16, paddingBottom: 0 }}
            styles={{ body: { padding: 0, height: '85vh' } }}
            title={title || 'Vista de documento'}
            destroyOnHidden
        >
            {url ? (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    {loading && (
                        // pointer-events:none — antes esta capa tapaba el iframe
                        // y, si el spinner se quedaba pegado, bloqueaba el
                        // scroll y los controles del visor de PDF.
                        <div style={{
                            position: 'absolute', inset: 0, pointerEvents: 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Spin />
                        </div>
                    )}
                    <iframe
                        src={url}
                        onLoad={() => setUrlListo(url)}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        title={title || 'PDF'}
                    />
                </div>
            ) : (
                // Mientras se descarga el archivo (los adjuntos van con token,
                // así que llegan por fetch antes de tener una url que mostrar).
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Spin />
                </div>
            )}
        </Modal>
    );
};

export default PdfViewerModal;
