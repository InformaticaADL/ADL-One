import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    IconSignature, IconCircleCheck, IconAlertTriangle, IconWriting, IconId, IconDeviceMobile, IconRefresh, IconCopy,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '../../../../contexts/ToastContext';
import { verificacionTemperaturaService, type MuestreadorFirma, type VerificacionDetalle } from '../../services/verificacionTemperatura.service';
import { fmtFecha, fmtNum } from '../../utils/verificacionTemperatura';
import { SignaturePad, type SignaturePadHandle } from './SignaturePad';

interface Props {
    verificacion: VerificacionDetalle | null;
    onClose: () => void;
    onFirmado: (v: VerificacionDetalle) => void;
}

type Modo = 'celular' | 'dibujar' | 'registrada';
type SesionRemota = { token: string; url: string; qr: string; expira: string };

const mensajeError = (err: unknown) => (err as { response?: { data?: { message?: string } } })?.response?.data?.message;

// Firma del muestreador: hasta acá la ficha solo existe como vista previa
// temporal. Al firmar, el backend genera el PDF definitivo, lo deja como
// documento de la revisión del equipo y actualiza sus datos.
//
// Tres formas de firmar:
//  - Celular: se muestra un QR; el muestreador lo escanea, firma en su celular
//    y presiona "Grabar firma". La firma aparece acá (se consulta cada 2 s).
//  - Aquí: firma en pantalla con mouse, dedo o lápiz.
//  - Registrada: la firma guardada en la ficha del muestreador (se muestra antes de usarla).
export const FirmaMuestreadorDialog: React.FC<Props> = ({ verificacion: v, onClose, onFirmado }) => {
    const { showToast } = useToast();
    const padRef = useRef<SignaturePadHandle>(null);
    const [muestreadores, setMuestreadores] = useState<MuestreadorFirma[]>([]);
    const [idMuestreador, setIdMuestreador] = useState<string>('');
    const [modo, setModo] = useState<Modo>('celular');
    const [padVacio, setPadVacio] = useState(true);
    const [acepta, setAcepta] = useState(false);
    const [firmando, setFirmando] = useState(false);

    // Celular
    const [sesion, setSesion] = useState<SesionRemota | null>(null);
    const [firmaCelular, setFirmaCelular] = useState<string | null>(null);
    const [generando, setGenerando] = useState(false);
    const [errorRemoto, setErrorRemoto] = useState<string | null>(null);
    const [ahora, setAhora] = useState(Date.now());

    // Registrada
    const [registrada, setRegistrada] = useState<{ nombre: string; firma: string | null } | null>(null);
    const [cargandoRegistrada, setCargandoRegistrada] = useState(false);

    useEffect(() => {
        if (!v) return;
        setIdMuestreador(v.id_muestreador ? String(v.id_muestreador) : '');
        setModo('celular');
        setAcepta(false);
        setPadVacio(true);
        verificacionTemperaturaService.muestreadores().then(setMuestreadores).catch(() => setMuestreadores([]));
    }, [v]);

    // Cambiar de muestreador invalida el QR y la firma ya recibida (el celular muestra su nombre).
    useEffect(() => {
        setSesion(null);
        setFirmaCelular(null);
        setErrorRemoto(null);
        setRegistrada(null);
    }, [idMuestreador, v]);

    const seleccionado = useMemo(() => muestreadores.find((m) => String(m.id_muestreador) === idMuestreador), [muestreadores, idMuestreador]);
    const tieneFirmaRegistrada = !!seleccionado?.tiene_firma;

    const generarQr = useCallback(async () => {
        if (!v || !idMuestreador) return;
        setGenerando(true);
        setErrorRemoto(null);
        setFirmaCelular(null);
        try {
            setSesion(await verificacionTemperaturaService.iniciarFirmaRemota(v.id_verificacion, Number(idMuestreador)));
        } catch (err) {
            setErrorRemoto(mensajeError(err) || 'No se pudo generar el código QR');
        } finally {
            setGenerando(false);
        }
    }, [v, idMuestreador]);

    // El QR se genera solo al entrar a "Celular" con un muestreador elegido.
    useEffect(() => {
        if (v && modo === 'celular' && idMuestreador && !sesion && !generando && !errorRemoto) generarQr();
    }, [v, modo, idMuestreador, sesion, generando, errorRemoto, generarQr]);

    // Espera la firma del celular: consulta cada 2 segundos. Al "Grabar firma" en
    // el celular la ficha ya queda firmada y registrada en el equipo (lo hace el
    // backend), así que acá solo se muestra la firma un momento y se cierra.
    useEffect(() => {
        if (!v || !sesion || firmaCelular || modo !== 'celular') return;
        const t = setInterval(async () => {
            setAhora(Date.now());
            try {
                const r = await verificacionTemperaturaService.estadoFirmaRemota(v.id_verificacion, sesion.token);
                if (r.estado === 'firmado' && r.firma && r.registrada) {
                    setFirmaCelular(r.firma);
                    showToast({ type: 'success', message: `Firmada desde el celular: el PDF quedó guardado en ${v.codigo_equipo} y se actualizó su revisión` });
                    const detalle = await verificacionTemperaturaService.obtener(v.id_verificacion);
                    setTimeout(() => onFirmado(detalle), 1200);
                }
            } catch (err) {
                setErrorRemoto(mensajeError(err) || 'El código QR ya no es válido');
                setSesion(null);
            }
        }, 2000);
        return () => clearInterval(t);
    }, [v, sesion, firmaCelular, modo, showToast, onFirmado]);

    // "Firma registrada": se muestra el nombre y la imagen que se va a usar.
    useEffect(() => {
        if (modo !== 'registrada' || !idMuestreador || registrada) return;
        setCargandoRegistrada(true);
        verificacionTemperaturaService.firmaRegistrada(Number(idMuestreador))
            .then((r) => setRegistrada({ nombre: r.nombre_muestreador, firma: r.firma }))
            .catch(() => setRegistrada({ nombre: seleccionado?.nombre_muestreador || '', firma: null }))
            .finally(() => setCargandoRegistrada(false));
    }, [modo, idMuestreador, registrada, seleccionado]);

    const puedeFirmar = !!idMuestreador && acepta && (
        modo === 'celular' ? !!firmaCelular
            : modo === 'dibujar' ? !padVacio
                : tieneFirmaRegistrada && !!registrada?.firma
    );

    const firmar = async () => {
        if (!v || !puedeFirmar) return;
        const firma = modo === 'celular' ? firmaCelular : modo === 'dibujar' ? padRef.current?.toDataURL() : null;
        if (modo !== 'registrada' && !firma) return;
        setFirmando(true);
        try {
            const res = await verificacionTemperaturaService.firmar(v.id_verificacion, {
                id_muestreador: Number(idMuestreador),
                firma: firma || undefined,
                usar_firma_registrada: modo === 'registrada',
            });
            showToast({ type: 'success', message: `Ficha firmada: el PDF quedó guardado en ${v.codigo_equipo} y se actualizó su revisión` });
            onFirmado(res);
        } catch (err) {
            showToast({ type: 'error', message: mensajeError(err) || 'No se pudo firmar la ficha' });
        } finally {
            setFirmando(false);
        }
    };

    const copiarEnlace = async () => {
        if (!sesion) return;
        try { await navigator.clipboard.writeText(sesion.url); showToast({ type: 'success', message: 'Enlace copiado' }); } catch { /* sin portapapeles */ }
    };

    const ok = v?.cumple === 'S';
    const minutosRestantes = sesion ? Math.max(0, Math.ceil((new Date(sesion.expira).getTime() - ahora) / 60000)) : 0;

    const opciones: { id: Modo; label: string; icono: React.ReactNode; deshabilitado?: boolean; title?: string }[] = [
        { id: 'celular', label: 'Firmar con celular', icono: <IconDeviceMobile size={15} /> },
        { id: 'dibujar', label: 'Firmar aquí', icono: <IconWriting size={15} /> },
        { id: 'registrada', label: 'Firma registrada', icono: <IconId size={15} />, deshabilitado: !tieneFirmaRegistrada, title: !tieneFirmaRegistrada ? 'El muestreador no tiene una firma registrada' : undefined },
    ];

    return (
        <Dialog open={!!v} onOpenChange={(open) => { if (!open && !firmando) onClose(); }}>
            <DialogContent className="max-h-[94vh] max-w-xl gap-4 overflow-y-auto" showCloseButton={!firmando}>
                {v && (
                    <>
                        <DialogHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <IconSignature size={22} />
                                </div>
                                <div className="min-w-0 text-left">
                                    <DialogTitle>Firma del muestreador</DialogTitle>
                                    <DialogDescription>{v.codigo_equipo} · Verificación del {fmtFecha(v.fecha_verificacion)}</DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className={cn('flex items-center gap-3 rounded-lg border p-3', ok ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5')}>
                            {ok ? <IconCircleCheck size={22} className="shrink-0 text-success" /> : <IconAlertTriangle size={22} className="shrink-0 text-destructive" />}
                            <div className="min-w-0 flex-1 text-sm">
                                <p className={cn('font-semibold', ok ? 'text-success' : 'text-destructive')}>{ok ? 'Cumple' : 'No cumple'}</p>
                                <p className="text-xs text-muted-foreground">
                                    Error 0 / 15 / 30 °C: <b className="text-foreground">{fmtNum(v.error0)} / {fmtNum(v.error15)} / {fmtNum(v.error30)}</b>
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium">Muestreador que firma <span className="text-destructive">*</span></label>
                            <Combobox
                                value={idMuestreador}
                                onValueChange={setIdMuestreador}
                                placeholder="Seleccione el muestreador"
                                searchPlaceholder="Buscar muestreador..."
                                options={muestreadores.map((m) => ({
                                    value: String(m.id_muestreador),
                                    label: `${m.nombre_muestreador}${m.habilitado !== 'S' ? ' (Inactivo)' : ''}`,
                                }))}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                            {opciones.map((o) => (
                                <button
                                    key={o.id}
                                    type="button"
                                    disabled={o.deshabilitado}
                                    title={o.title}
                                    onClick={() => setModo(o.id)}
                                    className={cn(
                                        'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                                        modo === o.id ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {o.icono} <span className="truncate">{o.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* ── Firmar con celular (QR) ── */}
                        {modo === 'celular' && (
                            !idMuestreador ? (
                                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Seleccione el muestreador para generar el código QR.</p>
                            ) : firmaCelular ? (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-1.5 text-sm font-medium text-success"><IconCircleCheck size={16} /> Firmada desde el celular y registrada en el equipo</span>
                                    </div>
                                    <div className="flex h-44 items-center justify-center rounded-lg border border-border bg-white p-3">
                                        <img src={firmaCelular} alt={`Firma de ${seleccionado?.nombre_muestreador || 'el muestreador'}`} className="max-h-full max-w-full object-contain" />
                                    </div>
                                    <p className="text-center text-xs text-muted-foreground">{seleccionado?.nombre_muestreador}</p>
                                </div>
                            ) : errorRemoto ? (
                                <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center">
                                    <p className="text-sm text-destructive">{errorRemoto}</p>
                                    <Button size="sm" variant="outline" onClick={generarQr} disabled={generando}><IconRefresh size={14} /> Generar código nuevo</Button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-start">
                                    <div className="flex h-[200px] w-[200px] shrink-0 items-center justify-center rounded-lg border border-border bg-white p-2">
                                        {sesion && !generando
                                            ? <img src={sesion.qr} alt="Código QR para firmar desde el celular" className="h-full w-full" />
                                            : <span className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
                                    </div>
                                    <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
                                        <p className="font-medium">Escanee el código con el celular del muestreador</p>
                                        <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                                            <li>Abra la cámara y apunte al código QR.</li>
                                            <li>Firme con el dedo y marque que está de acuerdo.</li>
                                            <li>Presione <b className="text-foreground">Grabar firma</b>: aparecerá aquí.</li>
                                        </ol>
                                        <p className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                            Esperando la firma… {sesion && `(vence en ${minutosRestantes} min)`}
                                        </p>
                                        {sesion && (
                                            <div className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                                                <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground" title={sesion.url}>{sesion.url}</span>
                                                <Button variant="ghost" size="icon-xs" onClick={copiarEnlace} title="Copiar enlace" aria-label="Copiar enlace"><IconCopy size={12} /></Button>
                                            </div>
                                        )}
                                        <p className="text-[11px] text-muted-foreground">El celular debe estar conectado a la misma red Wi-Fi que este equipo.</p>
                                    </div>
                                </div>
                            )
                        )}

                        {/* ── Firmar aquí ── */}
                        {modo === 'dibujar' && <SignaturePad ref={padRef} onChange={setPadVacio} />}

                        {/* ── Firma registrada: nombre y firma que se van a usar ── */}
                        {modo === 'registrada' && (
                            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                                {cargandoRegistrada ? (
                                    <div className="flex h-44 items-center justify-center"><span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
                                ) : registrada?.firma ? (
                                    <>
                                        <div className="flex h-44 items-center justify-center rounded-md bg-white p-3">
                                            <img src={registrada.firma} alt={`Firma registrada de ${registrada.nombre}`} className="max-h-full max-w-full object-contain" />
                                        </div>
                                        <p className="text-center text-sm font-semibold">{registrada.nombre}</p>
                                        <p className="text-center text-[11px] text-muted-foreground">Firma registrada en la ficha del muestreador</p>
                                    </>
                                ) : (
                                    <p className="py-6 text-center text-sm text-muted-foreground">{registrada?.nombre || 'El muestreador'} no tiene una firma registrada.</p>
                                )}
                            </div>
                        )}

                        <label className="flex cursor-pointer items-start gap-2 text-sm">
                            <Checkbox checked={acepta} onCheckedChange={(c) => setAcepta(c === true)} className="mt-0.5" />
                            <span className="text-muted-foreground">
                                El muestreador revisó las mediciones y el resultado de esta verificación y está de acuerdo con ellos.
                            </span>
                        </label>

                        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                            Al firmar se genera el PDF definitivo, queda guardado como documento de la revisión del equipo y se actualizan su
                            Error 0/15/30, Factor de Corrección, Última revisión ({fmtFecha(v.fecha_verificacion)}) y Siguiente revisión (+3 meses).
                            Esta acción no se puede deshacer.
                        </p>

                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={onClose} disabled={firmando}>Cancelar</Button>
                            <Button onClick={firmar} disabled={!puedeFirmar || firmando}>
                                {firmando
                                    ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                    : <IconSignature size={15} />}
                                {firmando ? 'Firmando...' : 'Firmar y registrar en el equipo'}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};
