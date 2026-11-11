import React, { useCallback, useEffect, useState } from 'react';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '../../../../contexts/ToastContext';
import { facturacionSaludService, mensajeError } from '../../services/facturacionSalud.service';
import { Campo, Seccion, SelectBuscable } from '../compartido';
import { aNumero, celdaTexto, fmtClp, fmtNum, type Fila } from '../formatos';

const MONEDAS = [
    { value: '$', label: 'Pesos ($)' },
    { value: 'U.F.', label: 'Unidades de fomento (U.F.)' },
    { value: 'U$', label: 'Dólares (U$)' },
];

/** Órdenes de compra con su valor y moneda (tabla de ADLSOFT «Asociación de una Orden de Compra»). */
const OcValorTab: React.FC<{ idFacturacion: number }> = ({ idFacturacion }) => {
    const { showToast } = useToast();
    const [filas, setFilas] = useState<Array<Fila>>([]);
    const [totalPesos, setTotalPesos] = useState(0);
    const [cargando, setCargando] = useState(true);

    const [numero, setNumero] = useState('');
    const [fecha, setFecha] = useState('');
    const [moneda, setMoneda] = useState('$');
    const [valor, setValor] = useState('');
    const [conversion, setConversion] = useState('');
    const [guardando, setGuardando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const r = await facturacionSaludService.listarOcAsociadas(idFacturacion);
            setFilas(r.filas);
            setTotalPesos(r.totalPesos);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudieron cargar las órdenes de compra.') });
        } finally {
            setCargando(false);
        }
    }, [idFacturacion, showToast]);

    useEffect(() => { cargar(); }, [cargar]);

    const agregar = async () => {
        setGuardando(true);
        try {
            await facturacionSaludService.agregarOcAsociada(idFacturacion, {
                oc: numero,
                oc_fecha_emision: fecha,
                oc_moneda: moneda,
                oc_valor: aNumero(valor),
                oc_conversion: moneda === '$' ? aNumero(valor) : aNumero(conversion),
            });
            setNumero(''); setFecha(''); setValor(''); setConversion('');
            showToast({ type: 'success', message: 'Se agregó la orden de compra.' });
            await cargar();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) });
        } finally {
            setGuardando(false);
        }
    };

    const eliminar = async (f: Fila) => {
        try {
            await facturacionSaludService.eliminarOcAsociada(idFacturacion, {
                oc: String(f.oc).trim(), oc_fecha_emision: String(f.oc_fecha_emision).trim(), oc_moneda: String(f.oc_moneda).trim(), oc_valor: f.oc_valor, oc_conversion: f.oc_conversion,
            });
            showToast({ type: 'success', message: 'Se eliminó la orden de compra.' });
            await cargar();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) });
        }
    };

    return (
        <Seccion titulo="Órdenes de compra con valor" descripcion="El monto en pesos de una orden en otra moneda se escribe a mano (no se calcula).">
            <div className="rounded-md border border-border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>N° orden</TableHead>
                            <TableHead>Fecha de emisión</TableHead>
                            <TableHead>Moneda</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead className="text-right">Monto en pesos</TableHead>
                            <TableHead className="w-12" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {cargando ? (
                            <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Cargando…</TableCell></TableRow>
                        ) : filas.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">Sin órdenes de compra con valor.</TableCell></TableRow>
                        ) : (
                            filas.map((f, i) => (
                                <TableRow key={i}>
                                    <TableCell className={celdaTexto}>{String(f.oc).trim()}</TableCell>
                                    <TableCell className={celdaTexto}>{String(f.oc_fecha_emision).trim()}</TableCell>
                                    <TableCell className={celdaTexto}>{String(f.oc_moneda).trim()}</TableCell>
                                    <TableCell className="text-right align-top tabular-nums">{fmtNum(f.oc_valor)}</TableCell>
                                    <TableCell className="text-right align-top tabular-nums">$ {fmtClp(f.oc_conversion)}</TableCell>
                                    <TableCell className="align-top"><Button variant="ghost" size="icon-xs" aria-label="Eliminar" onClick={() => eliminar(f)}><IconTrash size={14} /></Button></TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="text-right text-sm text-muted-foreground">Total en pesos: <span className="font-semibold text-foreground">$ {fmtClp(totalPesos)}</span></div>

            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr_1fr_1fr_auto]">
                <Campo label="N° orden"><Input value={numero} onChange={(e) => setNumero(e.target.value)} /></Campo>
                <Campo label="Fecha de emisión"><DatePicker value={fecha} onChange={setFecha} placeholder="Elegir fecha" /></Campo>
                <Campo label="Moneda"><SelectBuscable opciones={MONEDAS} valor={moneda} onChange={setMoneda} /></Campo>
                <Campo label="Valor"><Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
                <Campo label="Monto en pesos"><Input inputMode="decimal" value={moneda === '$' ? valor : conversion} onChange={(e) => setConversion(e.target.value)} disabled={moneda === '$'} /></Campo>
                <Button onClick={agregar} disabled={guardando || !numero || !fecha || !valor}><IconPlus size={16} />Agregar</Button>
            </div>
        </Seccion>
    );
};

export default OcValorTab;
