import React, { useMemo, useState } from 'react';
import { IconPencil, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '../../../../contexts/ToastContext';
import { facturacionSaludService, mensajeError, type FichaFactura, type MaestrosDocumentos } from '../../services/facturacionSalud.service';
import { Campo, Seccion, SelectBuscable } from '../compartido';
import { aIso, celdaTexto, type Fila } from '../formatos';

interface Props {
    ficha: FichaFactura;
    maestros: MaestrosDocumentos;
    onActualizada: () => void;
}

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

/** Meses para elegir: desde 14 meses atrás hasta 3 meses adelante (ADLSOFT trae una lista fija que hay que reprogramar cada año). */
const opcionesMes = (actual: string) => {
    const hoy = new Date();
    const lista: string[] = [];
    for (let k = -14; k <= 3; k++) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() + k, 1);
        lista.push(`${MESES[d.getMonth()]} ${d.getFullYear()}`);
    }
    if (actual && !lista.includes(actual)) lista.unshift(actual);
    return lista.map((m) => ({ value: m, label: m }));
};

type OcForm = { ocompra: string; fecha: string; referencia: string };
const vacio: OcForm = { ocompra: '', fecha: '', referencia: '' };

/** Datos previos a exportar: fecha, forma de pago, glosa, mes, nota y órdenes de compra / HES que van en el archivo para el emisor. */
const EmisionTab: React.FC<Props> = ({ ficha, maestros, onActualizada }) => {
    const { showToast } = useToast();
    const id = Number(ficha.encabezado.id_facturacion);
    const em = ficha.emision ?? {};
    const emitida = String(em.emitido ?? '').trim() === 'S';

    const [fecha, setFecha] = useState(aIso(em.fecha_facturacion));
    const [formaPago, setFormaPago] = useState(String(em.id_formapago ?? ''));
    const [glosaId, setGlosaId] = useState(String(em.id_glosa ?? ''));
    const [mes, setMes] = useState(String(em.mes ?? '').trim());
    const [glosaLibre, setGlosaLibre] = useState(String(em.glosa ?? '').trim());
    const [nota, setNota] = useState(String(em.nota ?? '').trim());
    const [guardando, setGuardando] = useState<string | null>(null);

    const [oc, setOc] = useState<OcForm>(vacio);
    const [hes, setHes] = useState<OcForm>(vacio);
    const [editando, setEditando] = useState<{ ocompra: string; tipo: 'OC' | 'HES' } | null>(null);
    const [otrasFacturas, setOtrasFacturas] = useState<Array<Fila> | null>(null);

    const glosas = useMemo(() => maestros.glosas.filter((g) => Number(g.id_tipodocumento) === 1).map((g) => ({ value: String(g.id_glosa), label: String(g.nombre_glosa).trim() })), [maestros.glosas]);
    const formas = maestros.formasPago.map((f) => ({ value: String(f.id_formapago), label: String(f.nombre_formapago).trim() }));
    const nombreGlosa = glosas.find((g) => g.value === glosaId)?.label ?? String(em.nombre_glosa ?? '').trim();

    const guardar = async (clave: string, accion: () => Promise<unknown>, ok: string) => {
        setGuardando(clave);
        try {
            await accion();
            showToast({ type: 'success', message: ok });
            onActualizada();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) });
        } finally {
            setGuardando(null);
        }
    };

    const guardarGlosaYMes = () =>
        guardar('glosa', async () => {
            if (mes) await facturacionSaludService.modificarDatosExportacion(id, 'mes', { mes, nombreGlosa });
            await facturacionSaludService.modificarDatosExportacion(id, 'glosa', { id_glosa: Number(glosaId), nombreGlosa, mes });
        }, 'Se guardó la glosa.');

    const agregarOc = () =>
        guardar('oc', async () => {
            await facturacionSaludService.agregarOcHes(id, {
                oc: oc.ocompra ? { ocompra: oc.ocompra, fecha: oc.fecha, referencia: oc.referencia } : undefined,
                hes: hes.ocompra ? { ocompra: hes.ocompra, fecha: hes.fecha, referencia: hes.referencia } : undefined,
            });
            setOc(vacio);
            setHes(vacio);
        }, 'Se agregó la referencia.');

    const buscarEnOtras = async () => {
        const numero = oc.ocompra || hes.ocompra;
        if (!numero) return showToast({ type: 'warning', message: 'Escribe el número de la OC o de la HES.' });
        try {
            setOtrasFacturas(await facturacionSaludService.buscarOcEnOtrasFacturas(numero));
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) });
        }
    };

    const botonGuardar = (clave: string, onClick: () => void, deshabilitado = false) => (
        <Button size="sm" onClick={onClick} disabled={deshabilitado || guardando !== null}>{guardando === clave ? 'Guardando…' : 'Guardar'}</Button>
    );

    return (
        <div className="flex flex-col gap-8">
            {emitida && (
                <Alert variant="warning">
                    <AlertTitle>Esta factura ya fue incluida en un archivo para el emisor</AlertTitle>
                    <AlertDescription>Los cambios que hagas aquí no modifican el archivo que ya se generó.</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Seccion titulo="Fecha de facturación">
                    <div className="flex flex-wrap items-end gap-3">
                        <Campo label="Fecha" className="w-full max-w-[220px]"><DatePicker value={fecha} onChange={setFecha} placeholder="Elegir fecha" /></Campo>
                        {botonGuardar('fecha', () => guardar('fecha', () => facturacionSaludService.modificarDatosExportacion(id, 'fecha', { fecha }), 'Se guardó la fecha.'), !fecha)}
                    </div>
                </Seccion>

                <Seccion titulo="Forma de pago">
                    <div className="flex flex-wrap items-end gap-3">
                        <Campo label="Forma de pago" className="w-full max-w-[260px]"><SelectBuscable opciones={formas} valor={formaPago} onChange={setFormaPago} placeholder="Elegir forma de pago" /></Campo>
                        {botonGuardar('pago', () => guardar('pago', () => facturacionSaludService.modificarDatosExportacion(id, 'forma-pago', { id_formapago: Number(formaPago) }), 'Se guardó la forma de pago.'), !formaPago)}
                    </div>
                </Seccion>
            </div>

            <Seccion titulo="Glosa de la factura electrónica" descripcion="La glosa se arma como «glosa, mes». También puedes escribirla a mano.">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Campo label="Glosa"><SelectBuscable opciones={glosas} valor={glosaId} onChange={setGlosaId} placeholder="Elegir glosa" /></Campo>
                    <Campo label="Mes / año"><SelectBuscable opciones={opcionesMes(mes)} valor={mes} onChange={setMes} placeholder="Elegir mes" /></Campo>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="m-0 min-w-0 text-sm text-muted-foreground">Quedaría como: <span className="font-medium text-foreground">{nombreGlosa ? `${nombreGlosa}, ${mes}` : '—'}</span></p>
                    {botonGuardar('glosa', guardarGlosaYMes, !glosaId)}
                </div>
                <Campo label="Glosa escrita a mano"><Textarea rows={2} value={glosaLibre} onChange={(e) => setGlosaLibre(e.target.value)} /></Campo>
                <div className="flex justify-end">{botonGuardar('glosaLibre', () => guardar('glosaLibre', () => facturacionSaludService.modificarDatosExportacion(id, 'glosa-libre', { glosa: glosaLibre }), 'Se guardó la glosa.'), !glosaLibre.trim())}</div>
            </Seccion>

            <Seccion titulo="Nota" descripcion="Sale en el archivo como «Nota: …». Para quitarla hay que reemplazarla por otro texto.">
                <Campo label="Nota"><Textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} /></Campo>
                <div className="flex justify-end">{botonGuardar('nota', () => guardar('nota', () => facturacionSaludService.modificarDatosExportacion(id, 'nota', { nota }), 'Se guardó la nota.'), !nota.trim())}</div>
            </Seccion>

            <Seccion titulo="Orden de compra y HES" descripcion="Cada una sale como una línea de referencia en el archivo.">
                <div className="rounded-md border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-20">Tipo</TableHead>
                                <TableHead>Número</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Referencia</TableHead>
                                <TableHead className="w-24" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {ficha.ordenes.length === 0 ? (
                                <TableRow><TableCell colSpan={5} className="py-5 text-center text-muted-foreground">Sin órdenes de compra ni HES.</TableCell></TableRow>
                            ) : (
                                ficha.ordenes.map((o) => (
                                    <TableRow key={`${o.tipo}-${o.ocompra}`}>
                                        <TableCell className="align-top"><Badge variant="outline">{String(o.tipo || 'OC').trim() || 'OC'}</Badge></TableCell>
                                        <TableCell className={celdaTexto}>{String(o.ocompra).trim()}</TableCell>
                                        <TableCell className={celdaTexto}>{String(o.ocompra_fecha).trim()}</TableCell>
                                        <TableCell className={celdaTexto}>{String(o.referencia ?? '').trim()}</TableCell>
                                        <TableCell className="align-top">
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="icon-xs" aria-label="Editar" onClick={() => {
                                                    const tipo = String(o.tipo).trim() === 'HES' ? 'HES' : 'OC';
                                                    setEditando({ ocompra: String(o.ocompra).trim(), tipo });
                                                    const f = { ocompra: String(o.ocompra).trim(), fecha: aIso(o.ocompra_fecha), referencia: String(o.referencia ?? '').trim() };
                                                    if (tipo === 'HES') { setHes(f); setOc(vacio); } else { setOc(f); setHes(vacio); }
                                                }}><IconPencil size={14} /></Button>
                                                <Button variant="ghost" size="icon-xs" aria-label="Eliminar" onClick={() => guardar('ocdel', () => facturacionSaludService.eliminarOcHes(id, String(o.ocompra).trim()), 'Se eliminó la referencia.')}><IconTrash size={14} /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <FormOc titulo="Orden de compra" valor={oc} onChange={setOc} numeroBloqueado={editando?.tipo === 'OC'} />
                    <FormOc titulo="HES" valor={hes} onChange={setHes} numeroBloqueado={editando?.tipo === 'HES'} />
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={buscarEnOtras}><IconSearch size={15} />¿Dónde más se usó este número?</Button>
                    {editando ? (
                        <>
                            <Button variant="outline" size="sm" onClick={() => { setEditando(null); setOc(vacio); setHes(vacio); }}>Cancelar</Button>
                            <Button size="sm" disabled={guardando !== null} onClick={() => {
                                const f = editando.tipo === 'HES' ? hes : oc;
                                guardar('ocmod', async () => {
                                    await facturacionSaludService.modificarOcHes(id, { ocompra: editando.ocompra, tipo: editando.tipo, fecha: f.fecha, referencia: f.referencia });
                                    setEditando(null); setOc(vacio); setHes(vacio);
                                }, 'Se guardaron los cambios.');
                            }}>Guardar cambios</Button>
                        </>
                    ) : (
                        <Button size="sm" disabled={(!oc.ocompra && !hes.ocompra) || guardando !== null} onClick={agregarOc}><IconPlus size={15} />Agregar</Button>
                    )}
                </div>

                {otrasFacturas && (
                    <div className="rounded-md border border-border">
                        <Table>
                            <TableHeader>
                                <TableRow><TableHead>N° interno</TableHead><TableHead>Empresa</TableHead><TableHead>Fecha</TableHead><TableHead>Referencia</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {otrasFacturas.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="py-4 text-center text-muted-foreground">Ese número no se ha usado en otra factura.</TableCell></TableRow>
                                ) : (
                                    otrasFacturas.map((f, i) => (
                                        <TableRow key={i}>
                                            <TableCell className={celdaTexto}>{f.id_facturacion}</TableCell>
                                            <TableCell className={celdaTexto}>{String(f.nombre_empresaservicios ?? '').trim()}</TableCell>
                                            <TableCell className={celdaTexto}>{String(f.ocompra_fecha ?? '').trim()}</TableCell>
                                            <TableCell className={celdaTexto}>{String(f.referencia ?? '').trim()}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </Seccion>
        </div>
    );
};

const FormOc: React.FC<{ titulo: string; valor: OcForm; onChange: (v: OcForm) => void; numeroBloqueado?: boolean }> = ({ titulo, valor, onChange, numeroBloqueado }) => (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <div className="text-sm font-medium text-foreground">{titulo}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Número"><Input value={valor.ocompra} onChange={(e) => onChange({ ...valor, ocompra: e.target.value })} disabled={numeroBloqueado} /></Campo>
            <Campo label="Fecha"><DatePicker value={valor.fecha} onChange={(f) => onChange({ ...valor, fecha: f })} placeholder="Elegir fecha" /></Campo>
        </div>
        <Campo label="Referencia"><Input value={valor.referencia} onChange={(e) => onChange({ ...valor, referencia: e.target.value })} /></Campo>
    </div>
);

export default EmisionTab;
