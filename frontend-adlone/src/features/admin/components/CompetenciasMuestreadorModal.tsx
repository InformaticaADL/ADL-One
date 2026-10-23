import React, { useState, useEffect, useRef } from 'react';
import { IconUpload, IconTrash, IconFile, IconCheck } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle, AttachmentActions, AttachmentAction, AttachmentTrigger } from '@/components/ui/attachment';
import { cn } from '@/lib/utils';
import { adminService } from '../../../services/admin.service';
import { useToast } from '../../../contexts/ToastContext';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import PdfViewerModal from '../../facturacion/components/PdfViewerModal';
import API_CONFIG from '../../../config/api.config';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    muestreador: { id_muestreador: number; nombre_muestreador: string } | null;
}

// Pantalla acotada para Gestión de Calidad (permiso MU_COMPETENCIAS): solo
// Competencias y Documentos — nada de nombre/correo/firma/estado, eso sigue
// siendo exclusivo del formulario completo de Jefe Técnico (MuestreadorForm).
// El listado de documentos es el mismo que usa ese formulario (mismas rutas
// backend), así que lo que suba una u otra área lo ven ambas.
export const CompetenciasMuestreadorModal: React.FC<Props> = ({ isOpen, onClose, muestreador }) => {
    const { showToast } = useToast();
    const isMobile = useMediaQuery('(max-width: 768px)');

    const [allCompetencias, setAllCompetencias] = useState<any[]>([]);
    const [compAsignadas, setCompAsignadas] = useState<any[]>([]);
    const [compSeleccionadas, setCompSeleccionadas] = useState<number[]>([]);
    const [guardandoComp, setGuardandoComp] = useState(false);

    const [documentos, setDocumentos] = useState<any[]>([]);
    const [docFile, setDocFile] = useState<File | null>(null);
    const [docNombre, setDocNombre] = useState('');
    const [docUploading, setDocUploading] = useState(false);
    const docFileInputRef = useRef<HTMLInputElement>(null);
    const [previewDoc, setPreviewDoc] = useState<{ url: string; nombre: string } | null>(null);

    useEffect(() => {
        if (!isOpen || !muestreador) return;
        adminService.getCompetencias(false).then(setAllCompetencias).catch(() => {});
        adminService.getCompetenciasMuestreador(muestreador.id_muestreador).then((rows: any[]) => {
            setCompAsignadas(rows);
            setCompSeleccionadas(rows.filter((r) => r.activo === 'S').map((r) => r.id_competencia));
        }).catch(() => {});
        adminService.getDocumentosMuestreador(muestreador.id_muestreador).then(setDocumentos).catch(() => {});
    }, [isOpen, muestreador]);

    const handleGuardarCompetencias = async () => {
        if (!muestreador) return;
        setGuardandoComp(true);
        try {
            await adminService.setCompetenciasMuestreador(muestreador.id_muestreador, compSeleccionadas);
            showToast({ type: 'success', message: 'Competencias actualizadas' });
        } catch {
            showToast({ type: 'error', message: 'Error al guardar competencias' });
        } finally {
            setGuardandoComp(false);
        }
    };

    const handleUploadDoc = async () => {
        if (!muestreador || !docFile) return;
        setDocUploading(true);
        try {
            await adminService.uploadDocumentoMuestreador(muestreador.id_muestreador, docFile, docNombre || docFile.name);
            const list = await adminService.getDocumentosMuestreador(muestreador.id_muestreador);
            setDocumentos(list);
            setDocFile(null);
            setDocNombre('');
            showToast({ type: 'success', message: 'Documento agregado' });
        } catch {
            showToast({ type: 'error', message: 'Error al subir documento' });
        } finally {
            setDocUploading(false);
        }
    };

    const handleDeleteDoc = async (idDoc: number) => {
        try {
            await adminService.deleteDocumentoMuestreador(idDoc);
            setDocumentos((prev) => prev.filter((d) => d.id_documento !== idDoc));
            showToast({ type: 'success', message: 'Documento eliminado' });
        } catch {
            showToast({ type: 'error', message: 'Error al eliminar documento' });
        }
    };

    if (!muestreador) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-4 overflow-hidden">
                <DialogHeader>
                    <DialogTitle>Competencias y Documentos — {muestreador.nombre_muestreador}</DialogTitle>
                </DialogHeader>
                <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
                    <Card className="p-5">
                        <div className="flex flex-col gap-4">
                            <p className={cn('text-base font-semibold text-primary', isMobile ? 'text-center' : 'text-left')}>Competencias</p>
                            <p className="text-[13px] text-muted-foreground">Marque las competencias del muestreador. Se pueden agregar y quitar libremente.</p>
                            <div className={cn('grid gap-1', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                                {allCompetencias.map((c) => (
                                    <label key={c.id_competencia} className="flex items-center gap-2 py-1">
                                        <Checkbox
                                            checked={compSeleccionadas.includes(c.id_competencia)}
                                            onCheckedChange={(checked) => {
                                                const on = checked === true;
                                                setCompSeleccionadas((prev) => on ? [...prev, c.id_competencia] : prev.filter((x) => x !== c.id_competencia));
                                            }}
                                        />
                                        <span className="text-sm text-foreground">{c.nombre_competencia}</span>
                                    </label>
                                ))}
                            </div>
                            {compAsignadas.filter((c) => c.activo !== 'S').length > 0 && (
                                <div>
                                    <p className="mt-2 text-xs font-semibold text-muted-foreground">Competencias inactivas (conservadas):</p>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {compAsignadas.filter((c) => c.activo !== 'S').map((c) => (
                                            <Badge key={c.id_competencia} variant="outline">{c.nombre_competencia}</Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <Button className="self-end" onClick={handleGuardarCompetencias} disabled={guardandoComp}>
                                {guardandoComp ? (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                ) : (
                                    <IconCheck size={16} />
                                )}
                                Guardar Competencias
                            </Button>
                        </div>
                    </Card>

                    <Card className="p-5">
                        <div className="flex flex-col gap-4">
                            <p className={cn('text-base font-semibold text-primary', isMobile ? 'text-center' : 'text-left')}>Documentos / Certificados</p>
                            <p className="text-[13px] text-muted-foreground">Adjunte respaldos de cursos o capacitaciones (disponible para cualquier muestreador).</p>
                            <div className="flex flex-wrap items-end gap-2">
                                <div className="min-w-[160px] flex-1">
                                    <input
                                        ref={docFileInputRef}
                                        type="file"
                                        accept="application/pdf,image/*"
                                        className="hidden"
                                        onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                                    />
                                    <div className="relative">
                                        <Input
                                            readOnly
                                            placeholder="Seleccionar archivo"
                                            value={docFile?.name ?? ''}
                                            onClick={() => docFileInputRef.current?.click()}
                                            className={cn('cursor-pointer', docFile && 'pr-8')}
                                        />
                                        {docFile && (
                                            <IconTrash
                                                size={14}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground"
                                                onClick={(e) => { e.stopPropagation(); setDocFile(null); }}
                                            />
                                        )}
                                    </div>
                                </div>
                                <Input className="min-w-[160px] flex-1" placeholder="Nombre/Título (opcional)" value={docNombre} onChange={(e) => setDocNombre(e.target.value)} />
                                <Button onClick={handleUploadDoc} disabled={docUploading || !docFile}>
                                    {docUploading ? (
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                    ) : (
                                        <IconUpload size={16} />
                                    )}
                                    Subir
                                </Button>
                            </div>
                            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
                                {documentos.length === 0 && <p className="text-xs text-muted-foreground">Sin documentos.</p>}
                                {documentos.map((d) => (
                                    <Attachment key={d.id_documento} size="sm">
                                        <AttachmentTrigger aria-label={`Abrir ${d.nombre_documento}`} onClick={() => setPreviewDoc({ url: `${API_CONFIG.getBaseURL()}${d.ruta_archivo}`, nombre: d.nombre_documento })} />
                                        <AttachmentMedia>
                                            <IconFile />
                                        </AttachmentMedia>
                                        <AttachmentContent>
                                            <AttachmentTitle>{d.nombre_documento}</AttachmentTitle>
                                        </AttachmentContent>
                                        <AttachmentActions>
                                            <AttachmentAction aria-label={`Eliminar ${d.nombre_documento}`} className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteDoc(d.id_documento)}>
                                                <IconTrash size={14} />
                                            </AttachmentAction>
                                        </AttachmentActions>
                                    </Attachment>
                                ))}
                            </div>
                        </div>
                    </Card>
                </div>
            </DialogContent>
            <PdfViewerModal open={!!previewDoc} onClose={() => setPreviewDoc(null)} url={previewDoc?.url ?? null} title={previewDoc?.nombre} />
        </Dialog>
    );
};
