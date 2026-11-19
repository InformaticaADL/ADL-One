import React, { useState } from 'react';
import { IconPlus, IconFileDescription } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '../../../contexts/ToastContext';
import PdfViewerModal from '../../facturacion/components/PdfViewerModal';
import { PuestasMarchaEquipo } from './PuestasMarchaEquipo';
import { NuevaPuestaDialog, DetalleDialog } from '../pages/GcPuestaMarchaPage';
import { puestaMarchaService, type PuestaMarcha } from '../services/puestaMarcha.service';

interface Props {
    equipo: { id_equipo: number; codigo?: string | null; nombre?: string | null } | null;
    onClose: () => void;
    /** Abre el formulario OI-FoGe-42 libre (solo para imprimir o consultar fichas antiguas; no crea registro). */
    onFormularioLibre?: () => void;
}

/**
 * Puesta en marcha desde el Inventario de Equipos: las que tiene el equipo, registrar una nueva (con el equipo ya
 * elegido) y abrir cada una para firmarla, adjuntar documentos o ver su PDF. Es la misma Puesta en Marcha de G. Calidad.
 */
export const PuestaMarchaEquipoDialog: React.FC<Props> = ({ equipo, onClose, onFormularioLibre }) => {
    const { showToast } = useToast();
    const [nueva, setNueva] = useState(false);
    const [abierta, setAbierta] = useState<number | null>(null);
    const [recarga, setRecarga] = useState(0);
    const [pdf, setPdf] = useState<{ url: string; titulo: string } | null>(null);

    if (!equipo) return null;

    const verPdf = async (p: PuestaMarcha) => {
        try {
            setPdf({ url: await puestaMarchaService.pdfUrl(p.id_puesta_marcha), titulo: `OI-FoGe-42 ${p.codigo_equipo ?? ''}` });
        } catch {
            showToast({ type: 'error', message: 'No se pudo generar el PDF' });
        }
    };

    return (
        <>
            <Dialog open={!nueva && abierta === null && !pdf} onOpenChange={(o) => { if (!o) onClose(); }}>
                <DialogContent className="shadcn-scope w-[95vw] max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Recepción y puesta en marcha · {equipo.codigo}</DialogTitle>
                        <DialogDescription>{equipo.nombre} · Formulario OI-FoGe-42 con verificación de Área Técnica y Gestión de Calidad.</DialogDescription>
                    </DialogHeader>
                    <PuestasMarchaEquipo idEquipo={equipo.id_equipo} onAbrir={setAbierta} recarga={recarga} mostrarVacio />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        {onFormularioLibre ? (
                            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onFormularioLibre} title="Formulario sin registro: para imprimir en blanco o consultar fichas guardadas antes">
                                <IconFileDescription size={15} /> Formulario libre (sin registro)
                            </Button>
                        ) : <span />}
                        <Button onClick={() => setNueva(true)}><IconPlus size={16} /> Nueva puesta en marcha</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {nueva && (
                <NuevaPuestaDialog
                    idEquipoInicial={equipo.id_equipo}
                    onClose={() => setNueva(false)}
                    onCreada={(id) => { setNueva(false); setRecarga((r) => r + 1); setAbierta(id); }}
                />
            )}
            {abierta !== null && (
                <DetalleDialog key={abierta} id={abierta} onClose={() => { setAbierta(null); setRecarga((r) => r + 1); }} onCambio={() => setRecarga((r) => r + 1)} verPdf={verPdf} />
            )}
            <PdfViewerModal open={!!pdf} onClose={() => setPdf(null)} url={pdf?.url ?? null} title={pdf?.titulo} />
        </>
    );
};

export default PuestaMarchaEquipoDialog;
