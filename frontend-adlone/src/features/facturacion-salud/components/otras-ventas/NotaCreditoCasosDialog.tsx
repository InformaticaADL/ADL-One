import React, { useEffect, useMemo, useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '../../../../contexts/ToastContext';
import { facturacionSaludService, mensajeError, type MaestrosDocumentos } from '../../services/facturacionSalud.service';
import { Campo, Segmentado, SelectBuscable } from '../compartido';
import { aNumero, celdaTexto, fmtNum, hoyIso, type Fila } from '../formatos';

interface Props {
    abierto: boolean;
    onCerrar: () => void;
    onCreada: () => void;
    maestros: MaestrosDocumentos;
}

/**
 * Nota de crédito parcial: devuelve solo algunos casos de una factura. Los casos elegidos quedan libres para volver a facturarse;
 * la factura original no cambia.
 */
const NotaCreditoCasosDialog: React.FC<Props> = ({ abierto, onCerrar, onCreada, maestros }) => {
    const { showToast } = useToast();
    const [folio, setFolio] = useState('');
    const [idFactura, setIdFactura] = useState<number | null>(null);
    const [empresa, setEmpresa] = useState('');
    const [casos, setCasos] = useState<Array<Fila>>([]);
    const [elegidos, setElegidos] = useState<Set<number>>(new Set());
    const [motivo, setMotivo] = useState('3');
    const [glosa, setGlosa] = useState('');
    const [formaPago, setFormaPago] = useState('1');
    const [fecha, setFecha] = useState(hoyIso());
    const [nota, setNota] = useState('');
    const [buscando, setBuscando] = useState(false);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        if (!abierto) return;
        setFolio(''); setIdFactura(null); setEmpresa(''); setCasos([]); setElegidos(new Set()); setMotivo('3'); setGlosa(''); setFormaPago('1'); setFecha(hoyIso()); setNota('');
    }, [abierto]);

    const glosas = useMemo(() => maestros.glosas.filter((g) => Number(g.id_tipodocumento) === 8).map((g) => ({ value: String(g.id_glosa), label: String(g.nombre_glosa).trim() })), [maestros.glosas]);
    const formas = useMemo(() => maestros.formasPago.map((f) => ({ value: String(f.id_formapago), label: String(f.nombre_formapago).trim() })), [maestros.formasPago]);
    const total = useMemo(() => casos.filter((c) => elegidos.has(Number(c.id_caso))).reduce((a, c) => a + Number(c.uf_totalfac || 0), 0), [casos, elegidos]);

    const buscar = async () => {
        setBuscando(true);
        try {
            const ficha = await facturacionSaludService.consultarFactura({ factura: aNumero(folio) });
            const id = Number(ficha.encabezado.id_facturacion);
            const lista = await facturacionSaludService.listarCasosDeFactura(id);
            setIdFactura(id);
            setEmpresa(String(ficha.encabezado.nombre_empresaservicios).trim());
            setCasos(lista);
            setElegidos(new Set());
        } catch (e) {
            setIdFactura(null);
            setCasos([]);
            showToast({ type: 'error', message: mensajeError(e, 'No existen datos para esa factura.') });
        } finally {
            setBuscando(false);
        }
    };

    const alternar = (id: number) =>
        setElegidos((p) => {
            const s = new Set(p);
            if (s.has(id)) s.delete(id);
            else s.add(id);
            return s;
        });

    const crear = async () => {
        if (!idFactura) return;
        setGuardando(true);
        try {
            const r = await facturacionSaludService.crearNotaCreditoCasos({
                id_facturacion_referencia: idFactura,
                ids_caso: Array.from(elegidos),
                cod_razon: Number(motivo),
                concepto_cobro: glosas.find((g) => g.value === glosa)?.label ?? '',
                id_formapago: Number(formaPago),
                fecha_documento: fecha,
                nota,
                tipoimpuesto: 'FEA',
            });
            showToast({ type: 'success', message: `Nota de crédito ${r.documento.id_facturacion} creada. ${r.lineasLiberadas} líneas quedaron disponibles para facturarse.` });
            onCreada();
            onCerrar();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo crear la nota de crédito.') });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
            <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Nota de crédito por casos</DialogTitle>
                    <DialogDescription>Elige los casos de una factura que se devuelven. El monto de la nota es la suma de lo que se facturó por esos casos.</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-5">
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto]">
                        <Campo label="N° de la factura"><Input inputMode="numeric" value={folio} onChange={(e) => setFolio(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && folio && buscar()} /></Campo>
                        <Button variant="outline" onClick={buscar} disabled={!folio || buscando}><IconSearch size={16} />{buscando ? 'Buscando…' : 'Buscar'}</Button>
                    </div>

                    {idFactura && (
                        <>
                            <p className="m-0 text-sm text-muted-foreground">Empresa: <span className="font-medium text-foreground">{empresa}</span></p>
                            <div className="max-h-[32vh] overflow-auto rounded-md border border-border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-10" />
                                            <TableHead>Caso</TableHead>
                                            <TableHead>Programa</TableHead>
                                            <TableHead>Fecha de informe</TableHead>
                                            <TableHead className="text-right">UF facturadas</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {casos.map((c) => (
                                            <TableRow key={c.id_caso} className="cursor-pointer" onClick={() => alternar(Number(c.id_caso))}>
                                                <TableCell className="align-top"><Checkbox checked={elegidos.has(Number(c.id_caso))} onCheckedChange={() => alternar(Number(c.id_caso))} /></TableCell>
                                                <TableCell className={celdaTexto}>{String(c.caso_adlab).trim()}</TableCell>
                                                <TableCell className={celdaTexto}>{String(c.nombre_programa).trim()}</TableCell>
                                                <TableCell className={celdaTexto}>{String(c.fecha_informe).trim()}</TableCell>
                                                <TableCell className="text-right align-top tabular-nums">{fmtNum(c.uf_totalfac, 3)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="text-right text-sm text-muted-foreground">Total de la nota: <span className="text-base font-semibold text-foreground">{fmtNum(total, 3)} UF</span></div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Campo label="Motivo"><Segmentado opciones={[{ value: '2', label: 'Corrige texto' }, { value: '3', label: 'Corrige montos' }]} valor={motivo} onChange={setMotivo} /></Campo>
                                <Campo label="Fecha del documento"><DatePicker value={fecha} onChange={setFecha} placeholder="Elegir fecha" /></Campo>
                                <Campo label="Glosa" className="md:col-span-2"><SelectBuscable opciones={glosas} valor={glosa} onChange={setGlosa} placeholder="Elegir glosa" /></Campo>
                                <Campo label="Forma de pago"><SelectBuscable opciones={formas} valor={formaPago} onChange={setFormaPago} /></Campo>
                            </div>
                            <Campo label="Nota"><Textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} /></Campo>
                            <Alert variant="info"><AlertDescription>La factura original queda como está. Si necesitas anularla completa, crea una nota de crédito común.</AlertDescription></Alert>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
                    <Button onClick={crear} disabled={!idFactura || elegidos.size === 0 || !glosa || guardando}>{guardando ? 'Creando…' : 'Crear nota de crédito'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default NotaCreditoCasosDialog;
