import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '../../../../contexts/ToastContext';
import { facturacionSaludService, mensajeError, type MaestrosDocumentos } from '../../services/facturacionSalud.service';
import { Campo, Dato, Seccion, SelectBuscable } from '../compartido';
import { aIso, aNumero, fmtClp, fmtNum, type Fila } from '../formatos';

interface Props {
    documento: Fila | null;
    onCerrar: () => void;
    onCambio: () => void;
    maestros: MaestrosDocumentos;
}

/** Cambios sobre un documento ya creado: N° del SII, fecha, glosa, UF, monto en UF, nota y órdenes de compra. */
const MantencionDialog: React.FC<Props> = ({ documento, onCerrar, onCambio, maestros }) => {
    const { showToast } = useToast();
    const idOtro = Number(documento?.id_otroscobros);
    const idDoc = Number(documento?.id_facturacion);

    const [numeroSii, setNumeroSii] = useState('');
    const [fecha, setFecha] = useState('');
    const [glosa, setGlosa] = useState('');
    const [uf, setUf] = useState('');
    const [montoUf, setMontoUf] = useState('');
    const [nota, setNota] = useState('');
    const [ordenes, setOrdenes] = useState<Array<Fila>>([]);
    const [nuevaOc, setNuevaOc] = useState({ ocompra: '', fecha: '', referencia: '', tipo: 'OC' as 'OC' | 'HES' });
    const [trabajando, setTrabajando] = useState<string | null>(null);

    const glosas = useMemo(
        () => maestros.glosas.filter((g) => Number(g.id_tipodocumento) === Number(documento?.id_tipodocumento)).map((g) => ({ value: String(g.nombre_glosa).trim(), label: String(g.nombre_glosa).trim() })),
        [maestros.glosas, documento?.id_tipodocumento]
    );

    const cargarOrdenes = useCallback(async () => {
        if (!idDoc) return;
        try { setOrdenes(await facturacionSaludService.listarOcHes(idDoc)); } catch { setOrdenes([]); }
    }, [idDoc]);

    useEffect(() => {
        if (!documento) return;
        setNumeroSii(String(Number(documento.numero_documento) || ''));
        setFecha(aIso(documento.fecha_documento));
        setGlosa(String(documento.concepto_cobro ?? '').trim());
        setUf(String(Number(documento.uf) || ''));
        setMontoUf(String(Number(documento.monto_uf) || ''));
        setNota(String(documento.nota ?? '').trim());
        setNuevaOc({ ocompra: '', fecha: '', referencia: '', tipo: 'OC' });
        cargarOrdenes();
    }, [documento, cargarOrdenes]);

    const guardar = async (clave: string, accion: () => Promise<unknown>, ok: string) => {
        setTrabajando(clave);
        try {
            await accion();
            showToast({ type: 'success', message: ok });
            onCambio();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) });
        } finally {
            setTrabajando(null);
        }
    };

    const boton = (clave: string, onClick: () => void, deshabilitado = false) => (
        <Button size="sm" onClick={onClick} disabled={deshabilitado || trabajando !== null}>{trabajando === clave ? 'Guardando…' : 'Guardar'}</Button>
    );

    if (!documento) return null;

    return (
        <Dialog open onOpenChange={(o) => !o && onCerrar()}>
            <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Documento {idDoc}</DialogTitle>
                    <DialogDescription>
                        <span className="inline-flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{String(documento.nombre_tipodocumento).trim()}</Badge>
                            <Badge variant={String(documento.emitido).trim() === 'S' ? 'secondary' : 'warning'}>{String(documento.emitido).trim() === 'S' ? 'Incluido en archivo' : 'Aún no incluido en archivo'}</Badge>
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-7">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <Dato label="Empresa" className="col-span-2">{String(documento.nombre_empresaservicios).trim()}</Dato>
                        <Dato label="Monto en UF">{fmtNum(documento.monto_uf)}</Dato>
                        <Dato label="Monto en pesos">$ {fmtClp(documento.monto)}</Dato>
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        <Seccion titulo="N° del documento (SII)">
                            <div className="flex flex-wrap items-end gap-3">
                                <Campo label="Número" className="w-full max-w-[200px]"><Input inputMode="numeric" value={numeroSii} onChange={(e) => setNumeroSii(e.target.value)} /></Campo>
                                {boton('numero', () => guardar('numero', () => facturacionSaludService.modificarOtraVenta(idOtro, 'numero', { numero_documento: aNumero(numeroSii) }), 'Se asignó el número del documento.'), !aNumero(numeroSii))}
                            </div>
                        </Seccion>
                        <Seccion titulo="Fecha del documento">
                            <div className="flex flex-wrap items-end gap-3">
                                <Campo label="Fecha" className="w-full max-w-[220px]"><DatePicker value={fecha} onChange={setFecha} placeholder="Elegir fecha" /></Campo>
                                {boton('fecha', () => guardar('fecha', () => facturacionSaludService.modificarOtraVenta(idOtro, 'fecha', { fecha }), 'Se cambió la fecha.'), !fecha)}
                            </div>
                        </Seccion>
                        <Seccion titulo="Valor de la UF">
                            <div className="flex flex-wrap items-end gap-3">
                                <Campo label="UF" className="w-full max-w-[200px]"><Input inputMode="decimal" value={uf} onChange={(e) => setUf(e.target.value)} /></Campo>
                                {boton('uf', () => guardar('uf', () => facturacionSaludService.modificarOtraVenta(idOtro, 'uf', { uf: aNumero(uf) }), 'Se cambió la UF y el monto en pesos.'), !(aNumero(uf) > 0))}
                            </div>
                        </Seccion>
                        <Seccion titulo="Monto en UF">
                            <div className="flex flex-wrap items-end gap-3">
                                <Campo label="Monto (UF)" className="w-full max-w-[200px]"><Input inputMode="decimal" value={montoUf} onChange={(e) => setMontoUf(e.target.value)} /></Campo>
                                {boton('montoUf', () => guardar('montoUf', () => facturacionSaludService.modificarOtraVenta(idOtro, 'monto-uf', { monto_uf: aNumero(montoUf) }), 'Se cambió el monto y los pesos.'), !(aNumero(montoUf) > 0))}
                            </div>
                        </Seccion>
                    </div>

                    <Seccion titulo="Glosa">
                        <div className="flex flex-wrap items-end gap-3">
                            <Campo label="Glosa" className="min-w-0 flex-1 basis-[280px]"><SelectBuscable opciones={glosas} valor={glosa} onChange={setGlosa} placeholder="Elegir glosa" /></Campo>
                            {boton('glosa', () => guardar('glosa', () => facturacionSaludService.modificarOtraVenta(idOtro, 'glosa', { concepto: glosa }), 'Se cambió la glosa.'), !glosa)}
                        </div>
                    </Seccion>

                    <Seccion titulo="Nota">
                        <Campo label="Nota"><Textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} /></Campo>
                        <div className="flex justify-end">{boton('nota', () => guardar('nota', () => facturacionSaludService.modificarOtraVenta(idOtro, 'nota', { nota }), 'Se guardó la nota.'))}</div>
                    </Seccion>

                    <Seccion titulo="Órdenes de compra y HES">
                        <div className="flex flex-col gap-2">
                            {ordenes.length === 0 ? (
                                <p className="m-0 text-sm text-muted-foreground">Sin órdenes de compra.</p>
                            ) : (
                                ordenes.map((o, i) => (
                                    <div key={i} className="flex items-start justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
                                        <span className="min-w-0 whitespace-normal break-words">
                                            <Badge variant="outline" className="mr-2">{String(o.tipo || 'OC').trim() || 'OC'}</Badge>
                                            {String(o.ocompra).trim()}{o.ocompra_fecha ? ` · ${String(o.ocompra_fecha).trim()}` : ''}{o.referencia ? ` · ${String(o.referencia).trim()}` : ''}
                                        </span>
                                        <Button variant="ghost" size="icon-xs" aria-label="Quitar" onClick={() => guardar('ocdel', async () => { await facturacionSaludService.eliminarOcHes(idDoc, String(o.ocompra).trim()); await cargarOrdenes(); }, 'Se quitó la referencia.')}><IconTrash size={14} /></Button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[110px_1fr_1fr_1.3fr_auto]">
                            <Campo label="Tipo"><SelectBuscable opciones={[{ value: 'OC', label: 'OC' }, { value: 'HES', label: 'HES' }]} valor={nuevaOc.tipo} onChange={(v) => setNuevaOc({ ...nuevaOc, tipo: v as 'OC' | 'HES' })} /></Campo>
                            <Campo label="Número"><Input value={nuevaOc.ocompra} onChange={(e) => setNuevaOc({ ...nuevaOc, ocompra: e.target.value })} /></Campo>
                            <Campo label="Fecha"><DatePicker value={nuevaOc.fecha} onChange={(f) => setNuevaOc({ ...nuevaOc, fecha: f })} placeholder="Elegir fecha" /></Campo>
                            <Campo label="Referencia"><Input value={nuevaOc.referencia} onChange={(e) => setNuevaOc({ ...nuevaOc, referencia: e.target.value })} /></Campo>
                            <Button variant="outline" disabled={!nuevaOc.ocompra.trim() || trabajando !== null} onClick={() => guardar('ocadd', async () => {
                                const d = { ocompra: nuevaOc.ocompra, fecha: nuevaOc.fecha, referencia: nuevaOc.referencia };
                                await facturacionSaludService.agregarOcHes(idDoc, nuevaOc.tipo === 'OC' ? { oc: d } : { hes: d });
                                setNuevaOc({ ocompra: '', fecha: '', referencia: '', tipo: nuevaOc.tipo });
                                await cargarOrdenes();
                            }, 'Se agregó la referencia.')}><IconPlus size={16} />Agregar</Button>
                        </div>
                    </Seccion>
                </div>

                <DialogFooter><Button variant="outline" onClick={onCerrar}>Cerrar</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MantencionDialog;
