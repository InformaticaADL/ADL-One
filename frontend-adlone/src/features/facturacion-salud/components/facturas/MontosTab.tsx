import React, { useMemo, useState } from 'react';
import { IconPlus, IconTrash, IconTruckDelivery } from '@tabler/icons-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '../../../../contexts/ToastContext';
import { facturacionSaludService, mensajeError, type FichaFactura, type MaestrosDocumentos } from '../../services/facturacionSalud.service';
import { Campo, Dato, Seccion, SelectBuscable } from '../compartido';
import { aNumero, celdaTexto, fmtClp, fmtNum } from '../formatos';
import GuiasDialog from './GuiasDialog';

interface Props {
    ficha: FichaFactura;
    maestros: MaestrosDocumentos;
    onActualizada: () => void;
}

type Linea = { id: number; nombre: string; valor: number };

const ID_GUIAS = 4;
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Montos de la factura: otros ingresos y descuentos, guías de despacho, valor de la UF y N° de factura ("Graba Factura" de ADLSOFT). */
const MontosTab: React.FC<Props> = ({ ficha, maestros, onActualizada }) => {
    const { showToast } = useToast();
    const enc = ficha.encabezado;
    const id = Number(enc.id_facturacion);
    const editable = ficha.editable;

    const [ingresos, setIngresos] = useState<Linea[]>(ficha.ingresos.map((i) => ({ id: Number(i.id_otrosingresos), nombre: String(i.nombre_otrosingresos).trim(), valor: Number(i.valor) })));
    const [descuentos, setDescuentos] = useState<Linea[]>(ficha.descuentos.map((d) => ({ id: Number(d.id_otrosdescuentos), nombre: String(d.nombre_otrosdescuentos).trim(), valor: Number(d.valor) })));
    const [uf, setUf] = useState(String(Number(enc.uf) || ''));
    const [folio, setFolio] = useState('');
    const [nuevoIng, setNuevoIng] = useState('');
    const [valorIng, setValorIng] = useState('');
    const [nuevoDes, setNuevoDes] = useState('');
    const [valorDes, setValorDes] = useState('');
    const [guiasAbierto, setGuiasAbierto] = useState(false);
    const [grabando, setGrabando] = useState(false);

    const totales = useMemo(() => {
        const caso = Number(enc.uf_totalcaso) || 0;
        const ing = ingresos.reduce((a, x) => a + x.valor, 0);
        const des = descuentos.reduce((a, x) => a + x.valor, 0);
        const total = r2(caso + ing - des);
        return { caso: r2(caso), ing: r2(ing), des: r2(des), total, pesos: Math.round(total * aNumero(uf)) };
    }, [enc.uf_totalcaso, ingresos, descuentos, uf]);

    const opcionesIng = maestros.otrosIngresos.map((o) => ({ value: String(o.id_otrosingresos), label: String(o.nombre_otrosingresos).trim() }));
    const opcionesDes = maestros.otrosDescuentos.map((o) => ({ value: String(o.id_otrosdescuentos), label: String(o.nombre_otrosdescuentos).trim() }));

    const agregarIngreso = () => {
        const valor = aNumero(valorIng);
        if (!nuevoIng || !valor) return showToast({ type: 'warning', message: 'Debes ingresar el concepto y su valor.' });
        const nombre = opcionesIng.find((o) => o.value === nuevoIng)?.label ?? '';
        setIngresos((p) => [...p, { id: Number(nuevoIng), nombre, valor }]);
        setNuevoIng('');
        setValorIng('');
    };

    const agregarDescuento = () => {
        const valor = aNumero(valorDes);
        if (!nuevoDes || !valor) return showToast({ type: 'warning', message: 'Debes ingresar el concepto y su valor.' });
        const nombre = opcionesDes.find((o) => o.value === nuevoDes)?.label ?? '';
        setDescuentos((p) => [...p, { id: Number(nuevoDes), nombre, valor }]);
        setNuevoDes('');
        setValorDes('');
    };

    // Quitar una línea de "guías de despacho" libera las guías de la factura (como en ADLSOFT)
    const quitarIngreso = async (indice: number) => {
        const linea = ingresos[indice];
        setIngresos((p) => p.filter((_, i) => i !== indice));
        if (linea.id === ID_GUIAS) {
            try {
                await facturacionSaludService.liberarGuias(id);
                showToast({ type: 'info', message: 'Las guías de despacho de la factura quedaron pendientes otra vez.' });
            } catch (e) {
                showToast({ type: 'error', message: mensajeError(e) });
            }
        }
    };

    const grabar = async () => {
        const valorUf = aNumero(uf);
        if (!(valorUf > 0)) return showToast({ type: 'warning', message: 'Debes ingresar el valor de la UF.' });
        setGrabando(true);
        try {
            const r = await facturacionSaludService.grabarFactura(id, {
                factura: aNumero(folio),
                uf: valorUf,
                ingresos: ingresos.map((x) => ({ id_otrosingresos: x.id, valor: x.valor })),
                descuentos: descuentos.map((x) => ({ id_otrosdescuentos: x.id, valor: x.valor })),
            });
            showToast({
                type: 'success',
                message: r.modo === 'folio' ? `Se grabó la factura N° ${r.factura}.` : `Se grabó el N° interno ${id}.`,
            });
            onActualizada();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo grabar la factura.') });
        } finally {
            setGrabando(false);
        }
    };

    return (
        <div className="flex flex-col gap-8">
            {!editable && (
                <Alert variant="info">
                    <AlertTitle>La factura ya tiene N° {Number(enc.factura)}</AlertTitle>
                    <AlertDescription>Con número asignado solo se puede consultar. Para cambiar montos hay que eliminarla y volver a crearla.</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Seccion titulo="Otros ingresos" descripcion="Se suman al total de los casos.">
                    <ListaConceptos lineas={ingresos} editable={editable} onQuitar={quitarIngreso} vacio="Sin otros ingresos." />
                    {editable && (
                        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
                            <Campo label="Concepto"><SelectBuscable opciones={opcionesIng} valor={nuevoIng} onChange={setNuevoIng} placeholder="Elegir concepto" /></Campo>
                            <Campo label="Valor (UF)"><Input inputMode="decimal" value={valorIng} onChange={(e) => setValorIng(e.target.value)} placeholder="0,00" /></Campo>
                            <Button variant="outline" onClick={agregarIngreso}><IconPlus size={16} />Agregar</Button>
                        </div>
                    )}
                    {editable && (
                        <div>
                            <Button variant="outline" size="sm" onClick={() => setGuiasAbierto(true)} disabled={!(aNumero(uf) > 0)}>
                                <IconTruckDelivery size={16} />Agregar guías de despacho
                            </Button>
                        </div>
                    )}
                </Seccion>

                <Seccion titulo="Otros descuentos" descripcion="Se restan del total de los casos.">
                    <ListaConceptos lineas={descuentos} editable={editable} onQuitar={(i) => setDescuentos((p) => p.filter((_, k) => k !== i))} vacio="Sin otros descuentos." />
                    {editable && (
                        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_140px_auto]">
                            <Campo label="Concepto"><SelectBuscable opciones={opcionesDes} valor={nuevoDes} onChange={setNuevoDes} placeholder="Elegir concepto" /></Campo>
                            <Campo label="Valor (UF)"><Input inputMode="decimal" value={valorDes} onChange={(e) => setValorDes(e.target.value)} placeholder="0,00" /></Campo>
                            <Button variant="outline" onClick={agregarDescuento}><IconPlus size={16} />Agregar</Button>
                        </div>
                    )}
                </Seccion>
            </div>

            <div className="grid grid-cols-1 gap-6 rounded-xl border border-border bg-muted/30 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <Dato label="Total casos (UF)">{fmtNum(totales.caso)}</Dato>
                    <Dato label="Otros ingresos (UF)">{fmtNum(totales.ing)}</Dato>
                    <Dato label="Otros descuentos (UF)">{fmtNum(totales.des)}</Dato>
                    <Dato label="Total factura (UF)"><span className="text-base font-semibold">{fmtNum(totales.total)}</span></Dato>
                    <Dato label="Total en pesos"><span className="text-base font-semibold">$ {fmtClp(totales.pesos)}</span></Dato>
                    {ficha.llevaDolar && <Dato label="Total casos en dólares">US$ {fmtNum(ficha.usdTotalCasos)}</Dato>}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Campo label="Valor de la UF"><Input inputMode="decimal" value={uf} onChange={(e) => setUf(e.target.value)} disabled={!editable} /></Campo>
                    <Campo label="N° de factura" ayuda="Déjalo en blanco para grabar solo los montos; después se asigna el número.">
                        <Input inputMode="numeric" value={editable ? folio : String(Number(enc.factura))} onChange={(e) => setFolio(e.target.value)} disabled={!editable} placeholder="Sin número" />
                    </Campo>
                </div>
            </div>

            {editable && (
                <div className="flex justify-end">
                    <Button onClick={grabar} disabled={grabando}>{grabando ? 'Grabando…' : aNumero(folio) > 0 ? 'Grabar N° de factura' : 'Grabar montos'}</Button>
                </div>
            )}

            <GuiasDialog
                abierto={guiasAbierto}
                onCerrar={() => setGuiasAbierto(false)}
                idFacturacion={id}
                idEmpresaServicio={Number(enc.id_empresaservicio)}
                uf={aNumero(uf)}
                onAgregar={(l) => setIngresos((p) => [...p, { id: l.id_otrosingresos, nombre: l.nombre_otrosingresos, valor: l.valor }])}
            />
        </div>
    );
};

const ListaConceptos: React.FC<{ lineas: Linea[]; editable: boolean; onQuitar: (i: number) => void; vacio: string }> = ({ lineas, editable, onQuitar, vacio }) => (
    <div className="rounded-md border border-border">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="w-32 text-right">Valor (UF)</TableHead>
                    {editable && <TableHead className="w-12" />}
                </TableRow>
            </TableHeader>
            <TableBody>
                {lineas.length === 0 ? (
                    <TableRow><TableCell colSpan={editable ? 3 : 2} className="py-5 text-center text-muted-foreground">{vacio}</TableCell></TableRow>
                ) : (
                    lineas.map((l, i) => (
                        <TableRow key={`${l.id}-${i}`}>
                            <TableCell className={celdaTexto}>{l.nombre || `Concepto ${l.id}`}</TableCell>
                            <TableCell className="text-right align-top tabular-nums">{fmtNum(l.valor)}</TableCell>
                            {editable && (
                                <TableCell className="align-top">
                                    <Button variant="ghost" size="icon-xs" aria-label="Quitar" onClick={() => onQuitar(i)}><IconTrash size={14} /></Button>
                                </TableCell>
                            )}
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    </div>
);

export default MontosTab;
