import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconDownload, IconFileExport, IconSearch } from '@tabler/icons-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '../../../contexts/ToastContext';
import { facturacionSaludService, mensajeError, type ArchivoGenerado, type EstadoLista, type FlujoArchivo } from '../services/facturacionSalud.service';
import { Campo, Segmentado, SelectBuscable } from './compartido';
import { celdaTexto, descargarArchivoAnsi, fmtClp, fmtNum, type Fila } from './formatos';

const FLUJOS: Array<{ value: FlujoArchivo; label: string; descripcion: string }> = [
    { value: 'CASOS', label: 'Facturas de casos', descripcion: 'Facturas de los programas de laboratorio.' },
    { value: 'FEA', label: 'Otras ventas afectas', descripcion: 'Facturas electrónicas de otras ventas, con IVA.' },
    { value: 'FEE', label: 'Facturas exentas', descripcion: 'Facturas electrónicas exentas de IVA.' },
    { value: 'NCE', label: 'Notas de crédito', descripcion: 'Notas de crédito electrónicas.' },
    { value: 'NDE', label: 'Notas de débito', descripcion: 'Notas de débito electrónicas.' },
];

const ESTADOS: Array<{ value: EstadoLista; label: string }> = [
    { value: 'NO emitidos', label: 'Aún no incluidos en archivo' },
    { value: 'Emitidos', label: 'Ya incluidos en archivo' },
    { value: 'Todos', label: 'Todos' },
];

/** Monto en pesos neto de una fila del listado (casos: UF × valor UF; otras ventas: monto guardado). */
const montoPesos = (flujo: FlujoArchivo, f: Fila): number =>
    flujo === 'CASOS' ? Math.round(Math.round((Number(f.uf_totalfac) || 0) * 100) / 100 * (Number(f.uf) || 0)) : Math.round(Number(f.monto) || 0);

/** Emisión: arma el archivo plano de 35 columnas que se entrega al emisor electrónico. */
const FacturacionSaludDte: React.FC = () => {
    const { showToast } = useToast();
    const [flujo, setFlujo] = useState<FlujoArchivo>('CASOS');
    const [estado, setEstado] = useState<EstadoLista>('NO emitidos');
    const [busqueda, setBusqueda] = useState('');
    const [filas, setFilas] = useState<Array<Fila>>([]);
    const [cargando, setCargando] = useState(true);
    const [elegidas, setElegidas] = useState<Set<number>>(new Set());
    const [confirmar, setConfirmar] = useState(false);
    const [generando, setGenerando] = useState(false);
    const [resultado, setResultado] = useState<ArchivoGenerado | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        setElegidas(new Set());
        try {
            setFilas(await facturacionSaludService.listarParaArchivo(flujo, estado));
        } catch (e) {
            setFilas([]);
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo cargar el listado.') });
        } finally {
            setCargando(false);
        }
    }, [flujo, estado, showToast]);

    useEffect(() => { cargar(); }, [cargar]);
    useEffect(() => { setResultado(null); }, [flujo]);

    const visibles = useMemo(() => {
        const t = busqueda.trim().toLowerCase();
        // Una factura que abarca más de un área de negocio aparece repetida en el listado de ADLSOFT: aquí se muestra una sola vez
        const vistos = new Set<number>();
        const unicas = filas.filter((f) => (vistos.has(Number(f.id_facturacion)) ? false : (vistos.add(Number(f.id_facturacion)), true)));
        const ordenadas = unicas.sort((a, b) => Number(b.id_facturacion) - Number(a.id_facturacion));
        if (!t) return ordenadas;
        return ordenadas.filter((f) => [f.id_facturacion, f.factura, f.numero_documento, f.nombre_empresaservicios, f.concepto_cobro, f.nombre_anegocio].some((v) => String(v ?? '').toLowerCase().includes(t)));
    }, [filas, busqueda]);

    const alternar = (id: number) =>
        setElegidas((p) => {
            const s = new Set(p);
            if (s.has(id)) s.delete(id);
            else s.add(id);
            return s;
        });

    const todasElegidas = visibles.length > 0 && visibles.every((f) => elegidas.has(Number(f.id_facturacion)));
    const totalElegido = visibles.filter((f) => elegidas.has(Number(f.id_facturacion))).reduce((a, f) => a + montoPesos(flujo, f), 0);

    const generar = async () => {
        setGenerando(true);
        try {
            const r = await facturacionSaludService.generarArchivo(flujo, Array.from(elegidas));
            setResultado(r);
            descargarArchivoAnsi(r.nombreArchivo, r.contenidoAnsiBase64);
            showToast({ type: 'success', message: `Se generó ${r.nombreArchivo} con ${r.documentos} documento(s).` });
            setConfirmar(false);
            await cargar();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo generar el archivo.') });
        } finally {
            setGenerando(false);
        }
    };

    const esCasos = flujo === 'CASOS';
    const flujoActual = FLUJOS.find((f) => f.value === flujo)!;

    return (
        <div className="flex flex-col gap-5">
            <Card className="p-5">
                <div className="flex flex-col gap-4">
                    <Campo label="Archivo a generar" ayuda={flujoActual.descripcion}><Segmentado opciones={FLUJOS.map((f) => ({ value: f.value, label: f.label }))} valor={flujo} onChange={(v) => setFlujo(v as FlujoArchivo)} /></Campo>
                    <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                        <Campo label="Buscar">
                            <div className="relative">
                                <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input className="pl-9" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Empresa, N° interno o N° de documento" />
                            </div>
                        </Campo>
                        <Campo label="Mostrar"><SelectBuscable opciones={ESTADOS} valor={estado} onChange={(v) => setEstado(v as EstadoLista)} /></Campo>
                    </div>
                </div>
            </Card>

            {resultado && (
                <Alert variant="success">
                    <AlertTitle>Archivo generado: {resultado.nombreArchivo}</AlertTitle>
                    <AlertDescription>
                        <span className="flex flex-wrap items-center gap-3">
                            <span>{resultado.documentos} documento(s) y {resultado.filas} línea(s). Los documentos quedaron marcados como incluidos en archivo.</span>
                            <Button variant="outline" size="sm" onClick={() => descargarArchivoAnsi(resultado.nombreArchivo, resultado.contenidoAnsiBase64)}><IconDownload size={15} />Descargar otra vez</Button>
                        </span>
                    </AlertDescription>
                </Alert>
            )}

            <Card className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10"><Checkbox checked={todasElegidas} onCheckedChange={(c) => setElegidas(c ? new Set(visibles.map((f) => Number(f.id_facturacion))) : new Set())} aria-label="Elegir todos" /></TableHead>
                                <TableHead className="w-24">N° interno</TableHead>
                                <TableHead>{esCasos ? 'N° de factura' : 'N° SII'}</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead className="min-w-[240px]">Empresa</TableHead>
                                <TableHead className="min-w-[200px]">{esCasos ? 'Área de negocio' : 'Glosa'}</TableHead>
                                {esCasos && <TableHead className="text-right">UF</TableHead>}
                                <TableHead className="text-right">Neto $</TableHead>
                                <TableHead>Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {cargando ? (
                                <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">Cargando…</TableCell></TableRow>
                            ) : visibles.length === 0 ? (
                                <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No hay documentos para mostrar.</TableCell></TableRow>
                            ) : (
                                visibles.map((f) => {
                                    const id = Number(f.id_facturacion);
                                    return (
                                        <TableRow key={id} className="cursor-pointer" onClick={() => alternar(id)}>
                                            <TableCell className="align-top"><Checkbox checked={elegidas.has(id)} onCheckedChange={() => alternar(id)} aria-label={`Elegir ${id}`} /></TableCell>
                                            <TableCell className={celdaTexto}>{id}</TableCell>
                                            <TableCell className={celdaTexto}>{Number(esCasos ? f.factura : f.numero_documento) || <span className="text-muted-foreground">Sin número</span>}</TableCell>
                                            <TableCell className={celdaTexto}>{String(esCasos ? f.fecha_facturacion : f.fecha_documento).trim()}</TableCell>
                                            <TableCell className={celdaTexto}>{String(f.nombre_empresaservicios).trim()}</TableCell>
                                            <TableCell className={celdaTexto}>{String(esCasos ? f.nombre_anegocio : f.concepto_cobro).trim()}</TableCell>
                                            {esCasos && <TableCell className="text-right align-top tabular-nums">{fmtNum(f.uf_totalfac)}</TableCell>}
                                            <TableCell className="text-right align-top tabular-nums">{fmtClp(montoPesos(flujo, f))}</TableCell>
                                            <TableCell className="align-top"><Badge variant={String(f.emitido).trim() === 'S' ? 'secondary' : 'warning'}>{String(f.emitido).trim() === 'S' ? 'En archivo' : 'Pendiente'}</Badge></TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
                    <p className="m-0 text-sm text-muted-foreground">{elegidas.size} elegido(s) · neto <span className="font-semibold text-foreground">$ {fmtClp(totalElegido)}</span></p>
                    <Button disabled={elegidas.size === 0} onClick={() => setConfirmar(true)}><IconFileExport size={16} />Generar archivo</Button>
                </div>
            </Card>

            <Dialog open={confirmar} onOpenChange={setConfirmar}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Generar el archivo?</DialogTitle>
                        <DialogDescription>
                            Se generará el archivo de {elegidas.size} documento(s) y quedarán marcados como incluidos en archivo. Revisa que los datos para el emisor (fecha, glosa, forma de pago y órdenes de compra) estén completos.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmar(false)}>Cancelar</Button>
                        <Button onClick={generar} disabled={generando}>{generando ? 'Generando…' : 'Generar y descargar'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default FacturacionSaludDte;
