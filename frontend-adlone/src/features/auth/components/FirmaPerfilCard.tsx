import React, { useEffect, useRef, useState } from 'react';
import { IconSignature, IconUpload, IconPencil, IconTrash, IconInfoCircle } from '@tabler/icons-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '../../../contexts/ToastContext';
import { SignaturePad, type SignaturePadHandle } from '../../admin/components/verificacion-temperatura/SignaturePad';
import { firmaUsuarioService, imagenAFirma } from '../../../services/firmaUsuario.service';

const mensajeError = (e: unknown, porDefecto: string) =>
    (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
    || (e as { message?: string })?.message || porDefecto;

/**
 * Firma guardada del usuario: se dibuja o se importa una vez y se usa sola al
 * llenar formularios (ej. la columna FIRMA de la Ficha Técnica de Equipos).
 */
export const FirmaPerfilCard: React.FC = () => {
    const { showToast } = useToast();
    const [firma, setFirma] = useState<string | null>(null);
    const [disponible, setDisponible] = useState(true);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [dibujando, setDibujando] = useState(false);
    const [padVacio, setPadVacio] = useState(true);
    const padRef = useRef<SignaturePadHandle>(null);
    const archivoRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        firmaUsuarioService.obtener()
            .then((r) => { setFirma(r.firma); setDisponible(r.disponible); })
            .catch(() => showToast({ type: 'error', message: 'No se pudo leer tu firma' }))
            .finally(() => setCargando(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const guardar = async (nueva: string, origen: 'DIBUJADA' | 'IMPORTADA') => {
        setGuardando(true);
        try {
            await firmaUsuarioService.guardar(nueva, origen);
            setFirma(nueva);
            setDibujando(false);
            showToast({ type: 'success', message: 'Firma guardada' });
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo guardar la firma') });
        } finally {
            setGuardando(false);
        }
    };

    const importar = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const archivo = e.target.files?.[0];
        e.target.value = '';
        if (!archivo) return;
        try {
            await guardar(await imagenAFirma(archivo), 'IMPORTADA');
        } catch (err) {
            showToast({ type: 'error', message: mensajeError(err, 'No se pudo importar la imagen') });
        }
    };

    const quitar = async () => {
        setGuardando(true);
        try {
            await firmaUsuarioService.quitar();
            setFirma(null);
            showToast({ type: 'success', message: 'Firma eliminada' });
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo eliminar la firma') });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Card className="p-4">
            <div className="mb-4 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <IconSignature size={18} />
                </div>
                <span className="text-base font-semibold text-foreground">Mi firma</span>
            </div>

            {cargando ? (
                <div className="flex h-28 items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            ) : !disponible ? (
                <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <IconInfoCircle size={16} className="mt-0.5 shrink-0" />
                    Para guardar firmas falta ejecutar la migración add_firma_digital.sql en la base de datos.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                        Se usa al llenar formularios, como la columna FIRMA de la Ficha Técnica de Equipos, para no tener que firmar cada vez.
                    </p>
                    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border bg-white">
                        {firma
                            ? <img src={firma} alt="Tu firma guardada" className="max-h-28 max-w-full object-contain" />
                            : <span className="text-sm text-slate-400">Aún no tienes una firma guardada</span>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" disabled={guardando} onClick={() => { setPadVacio(true); setDibujando(true); }}>
                            <IconPencil size={16} /> {firma ? 'Volver a dibujar' : 'Dibujar firma'}
                        </Button>
                        <Button variant="outline" size="sm" disabled={guardando} onClick={() => archivoRef.current?.click()}>
                            <IconUpload size={16} /> Importar imagen
                        </Button>
                        {firma && (
                            <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={guardando} onClick={quitar}>
                                <IconTrash size={16} /> Quitar
                            </Button>
                        )}
                        <input ref={archivoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={importar} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">Para importar, usa una foto o escaneo de la firma sobre fondo blanco (PNG o JPG).</p>
                </div>
            )}

            <Dialog open={dibujando} onOpenChange={(o) => { if (!o && !guardando) setDibujando(false); }}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Dibujar firma</DialogTitle>
                        <DialogDescription>Firma con el mouse, el dedo o un lápiz. Reemplaza la firma guardada.</DialogDescription>
                    </DialogHeader>
                    <SignaturePad ref={padRef} onChange={setPadVacio} />
                    <DialogFooter className="gap-2">
                        <Button variant="outline" disabled={guardando} onClick={() => setDibujando(false)}>Cancelar</Button>
                        <Button disabled={padVacio || guardando} onClick={() => { const f = padRef.current?.toDataURL(); if (f) guardar(f, 'DIBUJADA'); }}>
                            {guardando ? 'Guardando…' : 'Guardar firma'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
};

export default FirmaPerfilCard;
